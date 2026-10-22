/**
 * Scene strip check in the real Foundry (GM): puts a `[TEST]` global Trait and a `[TEST]` Complication in the table
 * state, checks the chips, that the strip sits beside #scene-navigation without overlapping it, the z-index, the
 * collapse tab, the live update, and the Fixer's editing right in the strip (add a Trait with +, change the die with
 * the picker, remove with X). Takes screenshots. Restores the table state. Exit codes: 0 pass, 1 fail, 2 n/a.
 * (The 0.1.1 migration of the Job's lists is covered by tests/unit/migration.test.mjs.)
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const S = "leverage-gta";
let saved = null;
const panel = page.locator("#leverage-scene-panel");
const state = () => page.evaluate((s) => ({ traits: game.settings.get(s, "globalTraits"), complications: game.settings.get(s, "complications") }), S);

try {
  await login(page, env);
  saved = await page.evaluate(async (s) => {
    const before = {
      job: lvTestJob.snapshot(),
      traits: foundry.utils.deepClone(game.settings.get(s, "globalTraits")),
      complications: foundry.utils.deepClone(game.settings.get(s, "complications")),
      collapsed: game.settings.get(s, "scenePanel.collapsed")
    };
    await game.settings.set(s, "scenePanel.collapsed", false);
    await lvTestJob.set({ name: "[TEST]", goal: "" });
    await game.settings.set(s, "complications", [{ id: "tcx1", name: "[TEST] Cops on the way", die: 6 }]);
    await game.settings.set(s, "globalTraits", [{ id: "tst1", name: "[TEST] Dark Corners", die: 8 }]);
    return before;
  }, S);
  await page.waitForTimeout(1200);
  const text = await panel.innerText();
  record("shows the global Trait", text.includes("[TEST] Dark Corners"), text);
  record("shows the Complication", text.includes("[TEST] Cops on the way"), text);
  const box = await panel.boundingBox();
  const nav = await page.locator("#scene-navigation-viewed").boundingBox();
  const expand = await page.locator("#scene-navigation-expand").boundingBox();
  record("beside the scene navigation, no overlap", box && nav && expand && box.x >= Math.max(nav.x + nav.width, expand.x + expand.width), { box, nav, expand });
  record("same row as the navigation bar", box && nav && Math.abs(box.y - nav.y) <= 4, { box, nav });
  record("visible (nothing on top of it)", await panel.evaluate((el) => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + 12, r.y + 12)); }));
  record("z-index 30", (await panel.evaluate((el) => getComputedStyle(el).zIndex)) === "30");
  await page.screenshot({ path: `${SHOTS}/scene-panel-open.png` });

  // Fixer editing in the strip
  await panel.locator('[data-action="startAdd"][data-list="globalTraits"]').click();
  await panel.locator(".lv-sp-add-input").fill("[TEST] Fog");
  await panel.locator(".lv-sp-add-input").press("Enter");
  await page.waitForTimeout(600);
  let s = await state();
  record("+ adds a global Trait (d6)", s.traits.length === 2 && s.traits[1].name === "[TEST] Fog" && s.traits[1].die === 6, s);
  await panel.locator('[data-entry][data-id="tcx1"] [data-action="editDie"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/scene-panel-picker.png` });
  await panel.locator('[data-entry][data-id="tcx1"] [data-action="setDie"][data-die="12"]').click();
  await page.waitForTimeout(600);
  s = await state();
  record("the die picker sets the Complication to d12", s.complications[0].die === 12, s);
  await panel.locator('[data-entry][data-id="tst1"] [data-action="removeEntry"]').click();
  await page.waitForTimeout(600);
  s = await state();
  record("X removes the Trait", s.traits.length === 1 && s.traits[0].name === "[TEST] Fog", s);
  record("no chip is cut without an ellipsis", await panel.evaluate((el) => [...el.querySelectorAll(".lv-sp-name")].every((n) => getComputedStyle(n).textOverflow === "ellipsis")));

  await panel.locator(".lv-sp-toggle").click();
  await page.waitForTimeout(500);
  record("collapses with a summary", /1\D+1/.test(await panel.innerText()), await panel.innerText());
  await page.screenshot({ path: `${SHOTS}/scene-panel-collapsed.png` });
  await panel.locator(".lv-sp-toggle").click();
  await page.waitForTimeout(300);
  await page.evaluate(async (s) => {
    await game.settings.set(s, "globalTraits", []);
    await game.settings.set(s, "complications", []);
    await lvTestJob.set({ name: "", goal: "" });
  }, S);
  await page.waitForTimeout(800);
  record("empty state updates live", await panel.locator(".lv-sp.is-empty").count() === 1, await panel.innerText());
  await page.screenshot({ path: `${SHOTS}/scene-panel-empty.png` });
} catch (error) {
  record("script", false, String(error));
} finally {
  try {
    await page.evaluate(async ([s, before]) => {
      if (!before) return;
      await lvTestJob.restore(before.job);
      await game.settings.set(s, "globalTraits", before.traits);
      await game.settings.set(s, "complications", before.complications);
      await game.settings.set(s, "scenePanel.collapsed", before.collapsed);
    }, [S, saved]);
  } catch { /* nothing to restore */ }
  await browser.close();
}
const errors = log.own();
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
if (errors.length) console.log(`console errors: ${errors.length}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
