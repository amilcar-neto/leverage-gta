/**
 * Check: the sheet seal is a button (owner locks/unlocks freely; disabled when the GM turns off `playersCanUnlock`)
 * and the GM's optional party Money list in the HUD. Creates [TEST] data and deletes it. Exit: 0 pass, 1 fail, 2 n/a.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
let ids = null;
let playerBrowser = null;
let saved = null;

try {
  await login(page, env);
  saved = await page.evaluate(() => ({
    can: game.settings.get("leverage-gta", "playersCanUnlock"),
    party: game.settings.get("leverage-gta", "hud.showPartyMoney")
  }));
  ids = await page.evaluate(async () => {
    const a = await Actor.create({ name: "[TEST] Lock Hero with a very long name indeed", type: "crew", system: { money: { steps: 8 } } });
    const b = await Actor.create({ name: "[TEST] Broke Pal", type: "crew", system: { money: { steps: 0 } } });
    let user = game.users.find((u) => u.name === "[TEST] Player");
    const created = !user;
    user ??= await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    await a.update({ ownership: { [user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER } });
    await user.update({ character: a.id });
    await game.settings.set("leverage-gta", "playersCanUnlock", true);
    return { a: a.id, b: b.id, user: user.id, created };
  });
  playerBrowser = await openBrowser(env, { secondary: true });
  const pp = playerBrowser.page;
  collectConsole(pp);
  await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });
  const seal = () => pp.evaluate((id) => {
    const el = game.actors.get(id).sheet.element?.querySelector(".lv-lock-seal");
    return el ? { tag: el.tagName, disabled: el.disabled, locked: el.classList.contains("is-locked"), title: el.title } : null;
  }, ids.a);
  await pp.evaluate((id) => game.actors.get(id).sheet.render(true), ids.a);
  await pp.waitForSelector(".lv-lock-seal", { timeout: 10000 });
  let s = await seal();
  record("seal is an enabled BUTTON, locked by default", s?.tag === "BUTTON" && !s.disabled && s.locked, s);
  await pp.click(".lv-lock-seal");
  await pp.waitForFunction(() => document.querySelector(".lv-lock-seal.is-unlocked"), null, { timeout: 8000 });
  record("owner click unlocks (flag set)", await pp.evaluate((id) => game.actors.get(id).getFlag("leverage-gta", "sheetUnlocked") === true, ids.a));
  record("unlocked: + ADD visible", (await pp.locator(".lv-add-btn").count()) > 0);
  await pp.screenshot({ path: `${SHOTS}/lock-unlocked.png` });
  // GM forbids unlocking
  await page.evaluate(() => game.settings.set("leverage-gta", "playersCanUnlock", false));
  await pp.waitForFunction(() => document.querySelector(".lv-lock-seal.is-locked"), null, { timeout: 8000 });
  s = await seal();
  record("forced lock: seal disabled with tooltip, + ADD gone", s?.disabled && s.locked && s.title.length > 10 && (await pp.locator(".lv-add-btn").count()) === 0, s);
  await pp.screenshot({ path: `${SHOTS}/lock-forced.png` });
  await page.evaluate(() => game.settings.set("leverage-gta", "playersCanUnlock", true));
  await pp.waitForFunction(() => document.querySelector(".lv-lock-seal.is-unlocked"), null, { timeout: 8000 });
  record("policy back on: own choice restored (unlocked)", true);
  await pp.click(".lv-lock-seal");
  await pp.waitForFunction(() => document.querySelector(".lv-lock-seal.is-locked"), null, { timeout: 8000 });
  record("owner can lock again", true);

  // Party Money
  const hud = (sel) => page.locator(`#leverage-hud ${sel}`);
  await page.evaluate(() => game.settings.set("leverage-gta", "hud.showPartyMoney", false));
  await page.waitForTimeout(400);
  record("party list hidden by default", (await hud(".lv-hud-party").count()) === 0);
  await page.evaluate(() => { canvas.tokens?.releaseAll(); });
  await page.evaluate(() => game.settings.set("leverage-gta", "hud.showPartyMoney", true));
  await page.waitForSelector("#leverage-hud .lv-hud-party", { timeout: 8000 });
  const rows = await page.evaluate(() => [...document.querySelectorAll("#leverage-hud .lv-hud-party-row")].map((r) => r.textContent.trim().replace(/\s+/g, " ")));
  record("GM with nothing selected sees player rows", rows.some((r) => r.includes("Lock Hero")), rows);
  record("player-only rows (Broke Pal is not a player's)", !rows.some((r) => r.includes("Broke Pal")), rows);
  await page.screenshot({ path: `${SHOTS}/hud-party.png`, clip: { x: 1100, y: 0, width: 820, height: 400 } });
  await page.click("#leverage-hud .lv-hud-party-head");
  await page.waitForFunction(() => !document.querySelector("#leverage-hud .lv-hud-party-list"), null, { timeout: 5000 });
  record("party list folds", true);
  await page.screenshot({ path: `${SHOTS}/hud-party-folded.png`, clip: { x: 1100, y: 0, width: 820, height: 400 } });
  await page.click("#leverage-hud .lv-hud-party-head");
  const playerHud = await pp.locator("#leverage-hud .lv-hud-party").count();
  record("player never sees the party list", playerHud === 0, playerHud);
} catch (error) {
  record("script ran without exceptions", false, String(error?.stack ?? error));
} finally {
  await playerBrowser?.browser.close().catch(() => {});
  await page.evaluate(async ({ i, s }) => {
    if (s) { await game.settings.set("leverage-gta", "playersCanUnlock", s.can); await game.settings.set("leverage-gta", "hud.showPartyMoney", s.party); await game.settings.set("leverage-gta", "hud.partyCollapsed", false); }
    if (!i) return;
    if (i.created) await game.users.get(i.user)?.delete();
    else await game.users.get(i.user)?.update({ character: null });
    await game.actors.get(i.a)?.delete();
    await game.actors.get(i.b)?.delete();
  }, { i: ids, s: saved }).catch(() => {});
  record("no own console errors", log.own().length === 0, log.own());
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
  await browser.close();
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}
