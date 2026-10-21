/**
 * Check: the HUD stays above an open crew sheet (Money and Plot Points clickable) and goes under a dialog.
 * Player [TEST] owns a [TEST] crew; the page opens the sheet and the chat sidebar, then hit-tests the HUD buttons
 * with elementFromPoint. Deletes what it creates. Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
let ids = null;
let playerBrowser = null;

try {
  await login(page, env);
  ids = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "[TEST] Hud Layer", type: "crew", system: { money: { steps: 8 } } });
    let user = game.users.find((u) => u.name === "[TEST] Player");
    const created = !user;
    user ??= await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    await actor.update({ ownership: { [user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER } });
    await user.update({ character: actor.id });
    return { actor: actor.id, user: user.id, created };
  });
  playerBrowser = await openBrowser(env, { secondary: true });
  const pp = playerBrowser.page;
  collectConsole(pp);
  await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });
  await pp.evaluate((id) => game.actors.get(id).sheet.render(true), ids.actor);
  await pp.locator(".application.crew-sheet").waitFor({ timeout: 10000 });
  await pp.waitForTimeout(1500);
  const hit = (selector) => pp.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return "missing";
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return el.contains(top) || top?.closest("#leverage-hud") ? "hud" : (top?.className ?? "none");
  }, selector);
  record("HUD money button on top of the sheet", (await hit("#leverage-hud button")) === "hud", await hit("#leverage-hud button"));
  // Move the sheet under the HUD to force the overlap.
  await pp.evaluate(() => {
    const hud = document.querySelector("#leverage-hud").getBoundingClientRect();
    const sheet = game.actors.contents.find((a) => a.name === "[TEST] Hud Layer").sheet;
    sheet.setPosition({ left: Math.max(0, hud.left - 400), top: 0, width: 900 });
  });
  await pp.waitForTimeout(500);
  await pp.screenshot({ path: `${SHOTS}/HUDLAYER-over-sheet.png` });
  const overlap = await pp.evaluate(() => {
    const hud = document.querySelector("#leverage-hud button").getBoundingClientRect();
    const win = document.querySelector(".application.crew-sheet").getBoundingClientRect();
    return hud.right > win.left && hud.left < win.right && hud.bottom > win.top && hud.top < win.bottom;
  });
  record("sheet overlaps the HUD", overlap);
  record("HUD button clickable above the overlapping sheet", (await hit("#leverage-hud button")) === "hud", await hit("#leverage-hud button"));
  const z = await pp.evaluate(() => getComputedStyle(document.querySelector("#leverage-hud")).zIndex);
  // A stand-in for a core dialog (opening a real one crashes the GPU-less test Chromium).
  await pp.evaluate(() => document.body.insertAdjacentHTML("beforeend", `<div class="application dialog" id="lv-test-dialog"></div>`));
  await pp.waitForTimeout(300);
  const zDialog = await pp.evaluate(() => getComputedStyle(document.querySelector("#leverage-hud")).zIndex);
  record("HUD goes under a dialog", Number(zDialog) < Number(z), { z, zDialog });
  await pp.evaluate(() => document.getElementById("lv-test-dialog")?.remove());
} catch (error) {
  record("script ran without exceptions", false, String(error?.stack ?? error));
} finally {
  await playerBrowser?.browser.close().catch(() => {});
  await page.evaluate(async (i) => {
    if (!i) return;
    if (i.created) await game.users.get(i.user)?.delete();
    else await game.users.get(i.user)?.update({ character: null });
    await game.actors.get(i.actor)?.delete();
  }, ids).catch(() => {});
  record("no own console errors", log.own().length === 0, log.own());
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
  await browser.close();
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}
