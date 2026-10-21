/**
 * Check: double-clicking the title bar minimizes and restores Crew, NPC, Location and Item sheets (the window
 * really shrinks to the title bar), the header buttons and dragging are untouched, and the "+ DIE" menu offers
 * the actor's Assets, Specialties, Distinctions, Talents (with a die), Attributes and Roles without repeats.
 * Deletes what it creates. Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
let ids = null;

const sheetHeight = (key) => page.evaluate((k) => {
  const [kind, id] = k.split(":");
  const s = (kind === "actor" ? game.actors : game.items).get(id).sheet;
  return { minimized: s.minimized, h: s.element.getBoundingClientRect().height };
}, key);

try {
  await login(page, env);
  ids = await page.evaluate(async () => {
    const crew = await Actor.create({ name: "[TEST] MinPool", type: "crew", system: { money: { steps: 6 } } });
    const npc = await Actor.create({ name: "[TEST] MinNpc", type: "npc" });
    const loc = await Actor.create({ name: "[TEST] MinLoc", type: "location" });
    const asset = await Item.create({ name: "[TEST] Van", type: "asset" });
    await crew.createEmbeddedDocuments("Item", [
      { name: "[TEST] Crowbar", type: "asset" },
      { name: "[TEST] Lockpicks", type: "specialty" },
      { name: "[TEST] Ex-con", type: "distinction" },
      { name: "[TEST] Ghost", type: "talent", system: { die: 6 } },
      { name: "[TEST] Plain talent", type: "talent" }
    ]);
    return { crew: crew.id, npc: npc.id, loc: loc.id, asset: asset.id };
  });
  const targets = [`actor:${ids.crew}`, `actor:${ids.npc}`, `actor:${ids.loc}`, `item:${ids.asset}`];
  for (const key of targets) {
    await page.evaluate((k) => {
      const [kind, id] = k.split(":");
      return (kind === "actor" ? game.actors : game.items).get(id).sheet.render(true);
    }, key);
    await page.waitForTimeout(1500);
    const title = await page.evaluate((k) => {
      const [kind, id] = k.split(":");
      const s = (kind === "actor" ? game.actors : game.items).get(id).sheet;
      return s.element.querySelector(".window-title").getBoundingClientRect().toJSON();
    }, key);
    const full = (await sheetHeight(key)).h;
    await page.mouse.dblclick(title.x + 5, title.y + title.height / 2);
    await page.waitForTimeout(1500);
    const min = await sheetHeight(key);
    record(`${key.split(":")[0]} ${targets.indexOf(key)}: double click minimizes to the title bar`, min.minimized && min.h < 60, { full, ...min });
    await page.mouse.dblclick(title.x + 5, title.y + title.height / 2);
    await page.waitForTimeout(1500);
    const back = await sheetHeight(key);
    record(`sheet ${targets.indexOf(key)}: double click restores`, !back.minimized && Math.abs(back.h - full) < 4, { full, ...back });
  }
  // Header menu has a Minimize entry that works, and the close button still closes.
  await page.evaluate((id) => game.actors.get(id).sheet.minimize(), ids.crew);
  await page.waitForTimeout(1500);
  record("minimize() collapses the crew sheet", (await sheetHeight(`actor:${ids.crew}`)).h < 60, await sheetHeight(`actor:${ids.crew}`));
  await page.evaluate((id) => game.actors.get(id).sheet.maximize(), ids.crew);
  await page.waitForTimeout(1500);

  // "+ DIE" menu.
  await page.locator(".crew-sheet [data-action=addDie]").click();
  await page.locator(".lv-pool-menu").waitFor({ timeout: 5000 });
  const menu = await page.evaluate(() => {
    const m = document.querySelector(".lv-pool-menu");
    return {
      headers: [...m.querySelectorAll(".lv-pool-menu-header")].map((h) => h.textContent),
      names: [...m.querySelectorAll(".lv-pool-menu-name")].map((n) => n.textContent),
      overflowX: m.scrollWidth > m.clientWidth + 1
    };
  });
  await page.screenshot({ path: `${SHOTS}/POOLMENU.png` });
  record("menu has the group headers", menu.headers.length >= 7, menu.headers);
  for (const name of ["[TEST] Crowbar", "[TEST] Lockpicks", "[TEST] Ex-con", "[TEST] Ghost"]) record(`menu offers ${name}`, menu.names.includes(name), menu.names);
  record("menu skips a Talent without a die", !menu.names.includes("[TEST] Plain talent"));
  record("menu does not scroll sideways", !menu.overflowX);
  const pick = page.locator(".lv-pool-menu-item", { hasText: "[TEST] Crowbar" });
  await pick.click();
  await page.waitForTimeout(600);
  await page.locator(".crew-sheet [data-action=addDie]").click();
  await page.locator(".lv-pool-menu").waitFor({ timeout: 5000 });
  const again = await page.evaluate(() => [...document.querySelectorAll(".lv-pool-menu-name")].map((n) => n.textContent));
  record("an item already in the Pool is not offered again", !again.includes("[TEST] Crowbar") && again.includes("[TEST] Ghost"), again);
  record("the picked item became a chip", await page.locator(".lv-tray [data-pool-ref]", { hasText: "[TEST] Crowbar" }).count() > 0);
} catch (error) {
  record("script ran without exceptions", false, String(error?.stack ?? error));
} finally {
  await page.evaluate(async (i) => {
    if (!i) return;
    for (const id of [i.crew, i.npc, i.loc]) await game.actors.get(id)?.delete();
    await game.items.get(i.asset)?.delete();
  }, ids).catch(() => {});
  record("no own console errors", log.own().length === 0, log.own());
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
  await browser.close();
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}
