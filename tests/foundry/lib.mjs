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

/**
 * Opens a browser. Pass `{ secondary: true }` for a second browser of the SAME test run (e.g. a player next to the
 * GM): it skips the lock, which the first browser of the run already holds (waiting for it would deadlock).
 * @param {object} env Result of `requireEnv()`.
 * @param {{secondary?: boolean}} [options]
 */
export async function openBrowser(env, { secondary = false } = {}) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.log("FOUNDRY: playwright not installed (npm i -D playwright && npx playwright install chromium)");
    process.exit(2);
  }
  const release = secondary ? () => {} : await acquireLock();
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
  await installJobHelpers(page);
}

/**
 * Defines `window.lvTestJob` in the page, the test stand-in of the old `activeJob` setting now that the active Job is a
 * world Item: `get()` reads `{name, goal}` of the active Job; `snapshot()` remembers the status of every world Job;
 * `set({name, goal})` makes a new active Job (the others go back to planned; an empty name leaves none active);
 * `restore(snapshot)` deletes the Jobs created since and puts the statuses back.
 * @param {import("playwright").Page} page
 */
export async function installJobHelpers(page) {
  await page.evaluate(() => {
    const worldJobs = () => game.items.filter((i) => i.type === "job" && !i.parent);
    window.lvTestJob = {
      get: () => {
        const job = worldJobs().find((i) => i.system.status === "active");
        return job ? { name: job.name, goal: job.system.goal } : { name: "", goal: "" };
      },
      snapshot: () => worldJobs().map((i) => ({ id: i.id, status: i.system.status })),
      set: async ({ name = "", goal = "" } = {}) => {
        const active = worldJobs().filter((i) => i.system.status === "active");
        if (active.length) await Item.updateDocuments(active.map((i) => ({ _id: i.id, "system.status": "planned" })));
        if (name) await Item.create({ name, type: "job", system: { status: "active", goal }, ownership: { default: 2 } }, { lvWorldJob: true });
      },
      restore: async (snapshot = []) => {
        const keep = new Set(snapshot.map((e) => e.id));
        const extra = worldJobs().filter((i) => !keep.has(i.id)).map((i) => i.id);
        if (extra.length) await Item.deleteDocuments(extra);
        const updates = snapshot.filter((e) => game.items.get(e.id)?.system.status !== e.status).map((e) => ({ _id: e.id, "system.status": e.status }));
        if (updates.length) await Item.updateDocuments(updates);
      }
    };
  });
}

/**
 * Relaunches the world through the setup screen (needed after system.json changes).
 * Verified selectors on Foundry v14 (pt-BR UI):
 *  - /join: `input[name="adminPassword"]` + the submit button that sits next to it
 *    (text "Voltar à Configuração" / "Return to Setup"); it deactivates the world and lands on `<route>/setup`.
 *  - setup, Worlds tab: `li[data-package-id="<world id>"] a[data-action="worldLaunch"]` (hidden until hover, so it is clicked via DOM).
 *  - a tour overlay may cover setup: exit with `a.step-button.exit, a.step-button[data-action="exit"]` first.
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
  await dismissTours(page);
  const launch = page.locator(`li[data-package-id="${world}"] a[data-action="worldLaunch"]`).first();
  await launch.waitFor({ state: "attached", timeout: 30000 });
  await launch.evaluate((a) => a.click());
  await confirmLaunchDialogs(page);
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

/** Exits the Foundry tour overlays ("Backups Overview"...) that cover setup and swallow clicks (`a.step-button.exit, a.step-button[data-action="exit"]`). */
async function dismissTours(page) {
  await page.waitForSelector("li[data-package-id]", { state: "attached", timeout: 30000 });
  for (let i = 0; i < 4; i++) {
    const exit = page.locator('a.step-button.exit, a.step-button[data-action="exit"]').first();
    if (!(await exit.isVisible({ timeout: 1500 }).catch(() => false))) break;
    await exit.click();
    await page.waitForTimeout(500);
  }
}

/** Buttons of the dialogs Foundry shows when a world launches: data migration, backup, and plain confirmations. */
const LAUNCH_DIALOG_BUTTONS = [
  /Iniciar Migra|Begin Migration|Start Migration/i,
  /^\s*Backup\s*$/i,
  /Pular|Skip|N[aã]o|No Backup|Sem Backup/i,
  /^\s*(Sim|Yes|Confirmar|Confirm|OK)\s*$/i
];

/**
 * After clicking "launch world": clicks through the migration dialog ("Migração dos Dados de Mundo" ->
 * "Iniciar Migração") and the backup dialog (declined, nothing to save in the test world) until the page leaves setup.
 * Setup is also cleared of tours, which can pop up over these dialogs. Gives up quietly after 45 s; the caller polls /join.
 */
async function confirmLaunchDialogs(page) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline && /\/setup/.test(page.url())) {
    await dismissTours(page).catch(() => {});
    let clicked = false;
    for (const pattern of LAUNCH_DIALOG_BUTTONS) {
      const button = page.locator(".application button, dialog button").filter({ hasText: pattern }).first();
      if (await button.isVisible({ timeout: 400 }).catch(() => false)) {
        await button.click({ timeout: 2500 }).catch(() => {});
        clicked = true;
        break;
      }
    }
    await page.waitForTimeout(clicked ? 800 : 1200);
  }
}
