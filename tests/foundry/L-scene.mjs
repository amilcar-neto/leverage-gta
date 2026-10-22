/* global Scene */
/**
 * L check: a Location picks a Scene (`system.scene`); its Traits show in the scene strip (GM and player), the Pool
 * builder (Scene tab) and the Opposition roller only while that Scene is viewed. Creates `[TEST]` Scenes, Location,
 * Crew and a temporary player user; restores the active Scene and deletes everything. Exit: 0 pass, 1 fail, 2 n/a.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const T1 = "[TEST] LS Trait Alpha";
const T2 = "[TEST] LS Trait Beta";
let ids = null;
let playerBrowser = null;
let playerLog = null;

/** Activates a Scene and waits for it to be the viewed one in this page. */
const view = async (p, sceneId) => {
  if (sceneId) await page.evaluate((id) => game.scenes.get(id).activate(), sceneId);
  await p.waitForFunction((id) => !id || canvas?.scene?.id === id, sceneId, { timeout: 30000 });
  await p.waitForTimeout(1200);
};
const stripText = (p) => p.locator("#leverage-scene-panel").innerText().catch(() => "");

try {
  await login(page, env);
  ids = await page.evaluate(async () => {
    const original = game.scenes.active?.id ?? null;
    const s1 = await Scene.create({ name: "[TEST] LS Scene One with a very long name to test the selector width" });
    const s2 = await Scene.create({ name: "[TEST] LS Scene Two" });
    const loc = await Actor.create({ name: "[TEST] LS Place", type: "location", system: { traits: [{ name: "[TEST] LS Trait Alpha", die: 8 }, { name: "[TEST] LS Trait Beta", die: 6 }] } });
    const crew = await Actor.create({ name: "[TEST] LS Crew", type: "crew" });
    let user = game.users.find((u) => u.name === "[TEST] Player");
    const created = !user;
    user ??= await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    return { original, s1: s1.id, s2: s2.id, s1uuid: s1.uuid, loc: loc.id, crew: crew.id, user: user.id, created, ownership: loc.ownership.default, scene: loc.system.scene };
  });
  record("new Location does not get OBSERVER (default NONE)", ids.ownership === 0, ids.ownership);
  record("new Location scene field is empty", ids.scene === "", ids.scene);

  playerBrowser = await openBrowser(env, { secondary: true });
  const pp = playerBrowser.page;
  playerLog = collectConsole(pp);
  await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });

  // ---- The sheet
  await page.evaluate((id) => game.actors.get(id).sheet.render(true), ids.loc);
  await page.locator(".application.location-sheet, .application[class*='location']").first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(1500);
  const sel = page.locator('select[name="system.scene"]');
  record("Scene selector is on the Location sheet", (await sel.count()) === 1);
  const options = await sel.locator("option").allInnerTexts();
  record("selector lists none + the 2 test Scenes", options.length >= 3 && options.some((o) => o.includes("LS Scene One")) && options.some((o) => o.includes("LS Scene Two")), options);
  await page.screenshot({ path: `${SHOTS}/L-scene-sheet.png` });
  const layout = await page.evaluate(() => {
    const box = (s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom, sw: el.scrollWidth, cw: el.clientWidth }; };
    return {
      header: box(".lv-loc-header"), name: box(".lv-loc-name"), kind: box(".lv-loc-kind"), pick: box(".lv-loc-pick"),
      city: box("select[name='system.city']"), scene: box("select[name='system.scene']"), sceneLabel: box(".lv-loc-scene"), identity: box(".lv-loc-identity"),
      overflowCss: getComputedStyle(document.querySelector("select[name='system.scene']")).textOverflow
    };
  });
  const hit = (a, b) => a && b && a.x < b.r && a.r > b.x && a.y < b.b && a.b > b.y;
  record("scene selector does not overlap name", !hit(layout.scene, layout.name), layout);
  record("scene selector does not overlap LOCAL label", !hit(layout.scene, layout.kind), layout);
  record("scene selector does not overlap image button", !hit(layout.scene, layout.pick), layout);
  record("scene selector does not overlap city selector", !hit(layout.scene, layout.city), layout);
  record("scene selector inside the header", layout.scene && layout.header && layout.scene.r <= layout.header.r + 0.5 && layout.scene.b <= layout.header.b + 0.5, layout);

  // Choose Scene 1 through the UI.
  await sel.selectOption(ids.s1uuid);
  await page.waitForFunction(([id, uuid]) => game.actors.get(id).system.scene === uuid, [ids.loc, ids.s1uuid], { timeout: 8000 });
  await page.waitForTimeout(800);
  record("choosing Scene 1 saves its UUID", true);
  await page.screenshot({ path: `${SHOTS}/L-scene-sheet-chosen.png` });
  const chosenLayout = await page.evaluate(() => { const s = document.querySelector(".lv-loc-scene select"); const r = s.getBoundingClientRect(); const h = document.querySelector(".lv-loc-header").getBoundingClientRect(); return { selR: r.right, hdrR: h.right, truncated: s.scrollWidth > s.clientWidth, selectedText: s.selectedOptions[0].text }; });
  record("long Scene name stays inside the header", chosenLayout.selR <= chosenLayout.hdrR + 0.5, chosenLayout);

  // ---- Viewing Scene 1: traits show everywhere
  await view(page, ids.s1);
  await view(pp, ids.s1);
  let g = await stripText(page);
  record("GM strip shows Location Traits on Scene 1", g.includes(T1) && g.includes(T2), g);
  await page.screenshot({ path: `${SHOTS}/L-scene-gm-strip-on.png` });
  let p = await stripText(pp);
  record("player strip shows Location Traits on Scene 1", p.includes(T1) && p.includes(T2), p);
  await pp.screenshot({ path: `${SHOTS}/L-scene-player-strip-on.png` });
  record("no tokens on Scene 1", await page.evaluate((id) => game.scenes.get(id).tokens.size === 0, ids.s1));

  // Pool builder (Scene tab) of the test Crew.
  await page.evaluate((id) => game.actors.get(id).sheet.render(true), ids.crew);
  await page.locator(".application.crew-sheet").waitFor({ timeout: 10000 });
  await page.waitForTimeout(1200);
  const builderRefs = async () => {
    await page.locator(".crew-sheet [data-action=addDie]").click();
    const builder = page.locator(".lv-pool-builder");
    await builder.waitFor({ timeout: 8000 });
    const tab = builder.locator('.lv-pb-tab[data-tab="scene"]');
    const hasTab = (await tab.count()) > 0;
    if (hasTab) { await tab.click(); await page.waitForTimeout(500); }
    const names = await builder.locator('.lv-pb-chip[data-ref^="scene:"]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? e.textContent));
    if (names.length) await page.screenshot({ path: `${SHOTS}/L-scene-pool-builder.png` });
    await page.evaluate(() => Object.values(foundry.applications.instances).filter((a) => a.id?.startsWith("leverage-pool-builder")).forEach((a) => a.close()));
    await page.waitForTimeout(500);
    return { hasTab, names };
  };
  let pool = await builderRefs();
  record("Pool builder offers the Location Traits as scene Traits on Scene 1", pool.names.join("|").includes("LS Trait Alpha") && pool.names.join("|").includes("LS Trait Beta"), pool);

  // Opposition roller.
  const oppText = async () => {
    await page.evaluate(() => game.leverage.openOppositionRoller());
    await page.locator(".application.lv-opposition").waitFor({ timeout: 8000 });
    await page.waitForTimeout(800);
    const text = await page.locator(".application.lv-opposition").innerText();
    return text;
  };
  let opp = await oppText();
  record("Opposition roller shows the Location and its Traits on Scene 1", opp.toUpperCase().includes("LS PLACE") && opp.includes("LS Trait Alpha"), opp);
  await page.screenshot({ path: `${SHOTS}/L-scene-opposition-on.png` });
  await page.evaluate(() => foundry.applications.instances.get("leverage-opposition-roller")?.close());

  // ---- Viewing Scene 2: traits gone
  await view(page, ids.s2);
  await view(pp, ids.s2);
  g = await stripText(page);
  p = await stripText(pp);
  record("GM strip hides Location Traits on Scene 2", !g.includes(T1) && !g.includes(T2), g);
  record("player strip hides Location Traits on Scene 2", !p.includes(T1) && !p.includes(T2), p);
  await page.screenshot({ path: `${SHOTS}/L-scene-gm-strip-off.png` });
  pool = await builderRefs();
  record("Pool builder has no Location Traits on Scene 2", !pool.names.join("|").includes("LS Trait"), pool);
  opp = await oppText();
  record("Opposition roller has no Location Traits on Scene 2", !opp.includes("LS Trait Alpha"), opp);
  await page.evaluate(() => foundry.applications.instances.get("leverage-opposition-roller")?.close());

  // ---- Back to Scene 1 then set the Location to "none"
  await view(page, ids.s1);
  await view(pp, ids.s1);
  record("back on Scene 1 the Traits return", (await stripText(page)).includes(T1));
  await page.locator('select[name="system.scene"]').selectOption("");
  await page.waitForFunction((id) => game.actors.get(id).system.scene === "", ids.loc, { timeout: 8000 });
  await page.waitForTimeout(1200);
  record("'none' clears the field", true);
  g = await stripText(page);
  p = await stripText(pp);
  record("with 'none' GM strip hides the Traits on Scene 1", !g.includes(T1), g);
  record("with 'none' player strip hides the Traits on Scene 1", !p.includes(T1), p);
  pool = await builderRefs();
  record("with 'none' Pool builder hides them", !pool.names.join("|").includes("LS Trait"), pool);
  opp = await oppText();
  record("with 'none' Opposition roller hides them", !opp.includes("LS Trait Alpha"), opp);
  await page.evaluate(() => foundry.applications.instances.get("leverage-opposition-roller")?.close());
  await page.screenshot({ path: `${SHOTS}/L-scene-none.png` });

  // Player has no permission on the Location (NONE) yet still reads its Traits through game.actors; Notes stay private.
  await page.evaluate(([id, uuid]) => game.actors.get(id).update({ "system.scene": uuid, "system.notes": "[TEST] secret note" }), [ids.loc, ids.s1uuid]);
  await pp.waitForTimeout(1500);
  const seen = await pp.evaluate((id) => {
    const a = game.actors.get(id);
    return { level: a?.ownership?.default, hasPerm: a?.testUserPermission(game.user, "OBSERVER") ?? null };
  }, ids.loc);
  record("player has no OBSERVER on the Location", seen.hasPerm === false, seen);
} catch (error) {
  record("script", false, String(error?.stack ?? error));
} finally {
  try {
    await page.evaluate(async (i) => {
      if (!i) return;
      await game.actors.get(i.loc)?.delete();
      await game.actors.get(i.crew)?.delete();
      if (i.created) await game.users.get(i.user)?.delete();
      if (i.original) await game.scenes.get(i.original)?.activate();
      await game.scenes.get(i.s1)?.delete();
      await game.scenes.get(i.s2)?.delete();
    }, ids);
  } catch (e) { record("cleanup", false, String(e)); }
  await playerBrowser?.browser.close();
  await browser.close();
}
const own = [...log.own(), ...(playerLog?.own() ?? [])];
const other = [...log.other(), ...(playerLog?.other() ?? [])];
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
console.log(`console errors (system): ${own.length}`);
own.forEach((e) => console.log(`  ${e.slice(0, 400)}`));
console.log(`console errors (other): ${other.length}`);
other.slice(0, 8).forEach((e) => console.log(`  ${e.slice(0, 200)}`));
process.exit(results.every((r) => r.ok) ? 0 : 1);
