/**
 * Check: the HUD sits above the scene but under open windows (a crew sheet over it wins the click, like the macro bar).
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
  const hudTop = (selector) => pp.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return "missing";
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return top?.closest("#leverage-hud") ? "hud" : (top?.closest(".application")?.className ?? top?.className ?? "none");
  }, selector);
  const hudZ = () => pp.evaluate(() => Number(getComputedStyle(document.querySelector("#leverage-hud")).zIndex));
  await pp.waitForSelector("#leverage-hud button", { timeout: 10000 });
  record("HUD button clickable over the bare scene", (await hudTop("#leverage-hud button")) === "hud", await hudTop("#leverage-hud button"));
  await pp.evaluate((id) => game.actors.get(id).sheet.render(true), ids.actor);
  await pp.locator(".application.crew-sheet").waitFor({ timeout: 10000 });
  await pp.waitForTimeout(1500);
  // Move the sheet under the HUD to force the overlap.
  await pp.evaluate(() => {
    const hud = document.querySelector("#leverage-hud").getBoundingClientRect();
    const sheet = game.actors.contents.find((a) => a.name === "[TEST] Hud Layer").sheet;
    sheet.setPosition({ left: Math.max(0, hud.left - 400), top: 0, width: 900 });
  });
  await pp.waitForTimeout(500);
  await pp.screenshot({ path: `${SHOTS}/HUDLAYER-under-sheet.png` });
  const overlap = await pp.evaluate(() => {
    const hud = document.querySelector("#leverage-hud button").getBoundingClientRect();
    const win = document.querySelector(".application.crew-sheet").getBoundingClientRect();
    return hud.right > win.left && hud.left < win.right && hud.bottom > win.top && hud.top < win.bottom;
  });
  record("sheet overlaps the HUD", overlap);
  const sheetZ = await pp.evaluate(() => Number(getComputedStyle(document.querySelector(".application.crew-sheet")).zIndex));
  record("HUD sits under the overlapping sheet", (await hudTop("#leverage-hud button")).includes("crew-sheet") && (await hudZ()) < sheetZ, { hud: await hudZ(), sheetZ });
  record("HUD stays above the scene canvas", (await hudZ()) > 0, await hudZ());
  // After a long session the core window counter is far above the HUD: the sheet still wins.
  await pp.evaluate(() => {
    foundry.applications.api.ApplicationV2._maxZ = 2000;
    game.actors.contents.find((x) => x.name === "[TEST] Hud Layer").sheet.bringToFront();
  });
  await pp.waitForTimeout(300);
  record("HUD under the sheet in a long session", (await hudTop("#leverage-hud button")).includes("crew-sheet"), await hudTop("#leverage-hud button"));
  // Close the sheet: the HUD is clickable again.
  await pp.evaluate(() => game.actors.contents.find((x) => x.name === "[TEST] Hud Layer").sheet.close());
  await pp.waitForTimeout(500);
  record("HUD clickable again after the sheet closes", (await hudTop("#leverage-hud button")) === "hud", await hudTop("#leverage-hud button"));
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
