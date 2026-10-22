/**
 * Helpers for the playtest scripts: one GM browser plus one browser per player, a step runner that never aborts the
 * whole run, and screenshot naming. Never prints .env values.
 */
import { openBrowser, collectConsole, login, baseUrl, SHOTS } from "./lib.mjs";

export { SHOTS };
export const S = "leverage-gta";

/** Logs a player in by display name (players in the playtest world have no password). */
export async function loginAs(page, env, label) {
  await page.goto(`${baseUrl(env)}/join`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForSelector('select[name="userId"] option[value]:not([value=""])', { state: "attached", timeout: 30000 });
  await page.selectOption('select[name="userId"]', { label });
  await page.click('button[name="join"]');
  await page.waitForFunction(() => window.game?.ready === true, null, { timeout: 90000 });
  await page.waitForTimeout(1500);
}

/** Opens GM + the two players. */
export async function openTable(env, names) {
  const gm = await openBrowser(env);
  await login(gm.page, env);
  const table = { gm: { ...gm, log: collectConsole(gm.page) }, players: {} };
  gm.page.on("crash", () => console.log("CRASH page of the GM"));
  for (const name of names) {
    const b = await openBrowser(env, { secondary: true });
    b.log = collectConsole(b.page);
    b.page.on("crash", () => console.log(`CRASH page of ${name}`));
    await loginAs(b.page, env, name);
    table.players[name] = b;
  }
  table.close = async () => {
    for (const p of Object.values(table.players)) await p.browser.close().catch(() => {});
    await table.gm.browser.close().catch(() => {});
  };
  return table;
}

let counter = 0;
/** Starts screenshot numbering after `n`. */
export const setCounter = (n) => { counter = n; };
const results = [];
export const report = results;

/** Takes a screenshot named playtest-NN-<name>.png. */
export async function shot(page, name, clip) {
  counter += 1;
  const file = `${SHOTS}/playtest-${String(counter).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path: file, ...(clip ? { clip } : {}) });
  return file;
}

/** Runs a step; records pass/fail and keeps going. `fn` returns a note string or an object (JSON-ed). */
export async function step(name, fn, page) {
  try {
    const out = await fn();
    results.push({ name, ok: true, note: typeof out === "string" ? out : JSON.stringify(out ?? "") });
    console.log(`OK   ${name}${out ? ` :: ${typeof out === "string" ? out : JSON.stringify(out)}` : ""}`);
    return out;
  } catch (e) {
    results.push({ name, ok: false, note: String(e?.message ?? e).split("\n")[0] });
    console.log(`FAIL ${name} :: ${String(e?.message ?? e).split("\n").slice(0, 3).join(" | ")}`);
    if (page) await shot(page, `FAIL-${name.replace(/\W+/g, "-").slice(0, 30)}`).catch(() => {});
    return null;
  }
}

/** The ids of a crew actor's items by name. */
export const itemId = (page, actorName, itemName) => page.evaluate(([a, i]) => game.actors.getName(a).items.find((x) => x.name === i)?.id, [actorName, itemName]);

/**
 * Adds a die through the Pool builder window ("+ DIE" opens it; the old dropdown menu is gone). `text` is a loose die
 * ("d4") or the name of a Trait/Asset/Talent/Specialty/Wallet chip. The window is closed with "done" afterwards.
 */
export async function addDie(page, text) {
  if (!(await page.locator(".lv-pool-builder").count())) {
    await page.locator(".crew-sheet [data-action=addDie]").click();
    await page.locator(".lv-pool-builder .lv-pb-chip").first().waitFor({ timeout: 5000 });
  }
  const loose = /^d\d+$/.test(text);
  const chip = loose
    ? page.locator(`.lv-pool-builder .lv-pb-chip[data-ref="${text}"]`).first()
    : page.locator(".lv-pool-builder .lv-pb-chip", { hasText: text }).first();
  await chip.click();
  await page.waitForTimeout(300);
  await page.locator('.lv-pool-builder [data-action="done"]').click();
  await page.locator(".lv-pool-builder").waitFor({ state: "detached", timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
}

/**
 * The playtest narrates the classic automatic roll (KEEP button, totals on the card): switches the world to it and
 * returns a function that puts the previous mode back. The Prime flow has its own scripts (P-prime.mjs ...).
 * @param {import("playwright").Page} gm
 */
export async function useClassicRolls(gm) {
  const prior = await gm.evaluate(async (s) => { const m = game.settings.get(s, "rules.rollMode"); await game.settings.set(s, "rules.rollMode", "classic"); return m; }, S);
  return () => gm.evaluate(([s, m]) => game.settings.set(s, "rules.rollMode", m), [S, prior]).catch(() => {});
}

/** Current pool chips text of the open crew sheet. */
export const chips = (page) => page.locator(".crew-sheet .lv-tray .lv-chip:not(.lv-chip--add)").allInnerTexts();

/** Presses ROLL on the crew sheet and returns the new chat message id. */
export async function pressRoll(page) {
  const before = await page.evaluate(() => game.messages.contents.at(-1)?.id);
  await page.locator(".crew-sheet .lv-tray [data-action=roll]").click();
  await page.waitForFunction((b) => game.messages.contents.at(-1)?.id !== b, before, { timeout: 10000 });
  await page.waitForTimeout(900);
  return page.evaluate(() => game.messages.contents.at(-1).id);
}

/** The roll flag of a message. */
export const rollFlag = (page, id) => page.evaluate((i) => {
  const f = game.messages.get(i).getFlag("leverage-gta", "roll");
  return { total: f.total, entries: f.entries.map((e) => `${e.label}:d${e.faces}=${e.result}${e.one ? "(1)" : ""}${e.kept ? "*" : ""}`), keptCount: f.keptCount, ppSpent: f.ppSpent, distinctionPP: f.distinctionPP };
}, id);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Closes open ApplicationV2 windows whose id matches. */
export const closeApps = (page, re) => page.evaluate((src) => {
  const rx = new RegExp(src, "i");
  for (const app of foundry.applications.instances.values()) if (rx.test(app.id)) app.close();
}, re.source);
