/**
 * Shared helpers for the Foundry (Playwright) checks.
 * Never print values from .env.
 */
import { mkdirSync } from "node:fs";
import { loadEnv, missing } from "../../tools/env.mjs";

export const SHOTS = "tests/foundry/screenshots";
export const SYSTEM_ID = "leverage-gta";

/** Loads .env and exits with code 2 when required keys are missing. */
export function requireEnv(keys = ["FOUNDRY_URL", "FOUNDRY_USER"]) {
  const env = loadEnv();
  const need = missing(env, keys);
  if (need.length) {
    console.log(`FOUNDRY: not configured (missing ${need.join(", ")})`);
    process.exit(2);
  }
  mkdirSync(SHOTS, { recursive: true });
  return env;
}

export const baseUrl = (env) => env.FOUNDRY_URL.replace(/\/$/, "");

/** Launches Chromium and a 1920x1080 page (Caddy basic auth applied when configured). Exits 2 without playwright. */
const LOCK = ".cache/foundry.lock";

/**
 * Only one browser may be logged in as the test user at a time. Waits for the lock (a directory, atomic to
 * create), steals it when older than 20 minutes, and releases it when the browser closes or the process exits.
 */
async function acquireLock() {
  const { mkdirSync, rmSync, statSync } = await import("node:fs");
  mkdirSync(".cache", { recursive: true });
  const deadline = Date.now() + 15 * 60 * 1000;
  for (;;) {
    try { mkdirSync(LOCK); break; } catch {
      try { if (Date.now() - statSync(LOCK).mtimeMs > 20 * 60 * 1000) rmSync(LOCK, { recursive: true, force: true }); } catch { /* raced */ }
      if (Date.now() > deadline) throw new Error("Timed out waiting for the Foundry test lock");
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  let released = false;
  return () => { if (!released) { released = true; try { rmSync(LOCK, { recursive: true, force: true }); } catch { /* ignore */ } } };
}

export async function openBrowser(env) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.log("FOUNDRY: playwright not installed (npm i -D playwright && npx playwright install chromium)");
    process.exit(2);
  }
  const release = await acquireLock();
  process.on("exit", release);
  const browser = await chromium.launch();
  const close = browser.close.bind(browser);
  browser.close = async () => { try { await close(); } finally { release(); } };
  const httpCredentials = env.FOUNDRY_HTTP_USER
    ? { username: env.FOUNDRY_HTTP_USER, password: env.FOUNDRY_HTTP_PASSWORD ?? "" } : undefined;
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, httpCredentials });
  return { browser, page };
}

/**
 * Collects console errors/warnings and page errors.
 * @returns {{errors: string[], warnings: string[], own: () => string[], other: () => string[]}}
 */
export function collectConsole(page) {
  const errors = [];
  const warnings = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
    else if (m.type() === "warning") warnings.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`${e.message}\n${e.stack ?? ""}`));
  const isOwn = (t) => /leverage/i.test(t);
  return {
    errors, warnings,
    own: () => errors.filter(isOwn),
    other: () => errors.filter((t) => !isOwn(t))
  };
}

/**
 * Logs in to the running world as FOUNDRY_USER and waits for game.ready.
 * The user's option must be enabled in the select, i.e. nobody is logged in as it.
 */
export async function login(page, env) {
  await page.goto(`${baseUrl(env)}/join`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector('select[name="userId"] option[value]:not([value=""])', { state: "attached", timeout: 30000 });
  await page.selectOption('select[name="userId"]', { label: env.FOUNDRY_USER });
  if (env.FOUNDRY_PASSWORD) await page.fill('input[name="password"]', env.FOUNDRY_PASSWORD);
  await page.click('button[name="join"]');
  await page.waitForFunction(() => window.game?.ready === true, null, { timeout: 90000 });
  await page.waitForTimeout(1500);
}

/**
 * Relaunches the world through the setup screen (needed after system.json changes).
 * Verified selectors on Foundry v14 (pt-BR UI):
 *  - /join: `input[name="adminPassword"]` + the submit button that sits next to it
 *    (text "Voltar à Configuração" / "Return to Setup"); it deactivates the world and lands on `<route>/setup`.
 *  - setup, Worlds tab: `li[data-package-id="<world id>"] a[data-action="worldLaunch"]` (hidden until hover, so it is clicked via DOM).
 *  - a tour overlay may cover setup: exit with `a.step-button.exit` first.
 * Afterwards /join lists the users again; call login() next.
 */
export async function relaunchWorld(page, env) {
  const world = env.FOUNDRY_WORLD || SYSTEM_ID;
  await page.goto(`${baseUrl(env)}/join`, { waitUntil: "domcontentloaded", timeout: 30000 });
  const adminForm = page.locator('input[name="adminPassword"]');
  const visible = (loc) => loc.waitFor({ state: "visible", timeout: 8000 }).then(() => true, () => false);
  if (await visible(adminForm)) {
    // World is running: /join shows "Voltar à Configuração" with the admin password.
    await adminForm.fill(env.FOUNDRY_ADMIN_PASSWORD ?? "");
    await page.click('form:has(input[name="adminPassword"]) button[type="submit"]');
    await page.waitForURL(/\/setup/, { timeout: 30000 });
  } else if (!/\/setup/.test(page.url())) {
    // World already inactive ("no active game session"): go to /setup directly (may ask for the admin password).
    await page.goto(`${baseUrl(env)}/setup`, { waitUntil: "domcontentloaded", timeout: 30000 });
    if (await visible(adminForm)) {
      await adminForm.fill(env.FOUNDRY_ADMIN_PASSWORD ?? "");
      await page.click('form:has(input[name="adminPassword"]) button[type="submit"]');
    }
  }
  // A Foundry tour overlay ("Backups Overview") covers setup and swallows clicks: exit it (`a.step-button.exit`).
  await page.waitForSelector('li[data-package-id]', { state: "attached", timeout: 30000 });
  for (let i = 0; i < 3; i++) {
    const exit = page.locator("a.step-button.exit").first();
    if (!(await exit.isVisible({ timeout: 1500 }).catch(() => false))) break;
    await exit.click();
    await page.waitForTimeout(500);
  }
  const launch = page.locator(`li[data-package-id="${world}"] a[data-action="worldLaunch"]`).first();
  await launch.waitFor({ state: "attached", timeout: 30000 });
  await launch.evaluate((a) => a.click());
  // The setup page reloads/navigates while the world starts poll /join instead.
  // The setup page can crash Chromium while the world starts, so leave it right away and poll /join.
  await page.goto("about:blank").catch(() => {});
  await new Promise((r) => setTimeout(r, 3000));
  const probe = page;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    try {
      await probe.goto(`${baseUrl(env)}/join`, { waitUntil: "domcontentloaded", timeout: 15000 });
      await probe.waitForSelector('select[name="userId"]', { state: "attached", timeout: 5000 });
      return;
    } catch { await new Promise((r) => setTimeout(r, 2000)); }
  }
  throw new Error("relaunchWorld: world did not reach the join screen within 90s");
}
