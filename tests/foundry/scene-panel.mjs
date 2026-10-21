/**
 * Scene strip check in the real Foundry (GM): puts a `[TEST]` Scene Trait on the ACTIVE scene (flag) and a `[TEST]`
 * Complication on the Job, checks the chips, that the strip sits below #scene-navigation without overlapping it, the
 * z-index, the collapse tab, the live update, that the old NPC Trait list is gone, and the migration of Scene Traits
 * from the `activeJob` setting. Takes screenshots. Restores the Job and the flag. Exit codes: 0 pass, 1 fail, 2 n/a.
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

try {
  await login(page, env);
  saved = await page.evaluate(async (s) => {
    const before = {
      job: foundry.utils.deepClone(game.settings.get(s, "activeJob")),
      flag: foundry.utils.deepClone(game.scenes.active?.getFlag(s, "sceneTraits") ?? null),
      sceneId: game.scenes.active?.id, collapsed: game.settings.get(s, "scenePanel.collapsed")
    };
    await game.settings.set(s, "scenePanel.collapsed", false);
    await game.settings.set(s, "activeJob", { name: "[TEST]", goal: "", complications: [{ id: "tcx1", name: "[TEST] Cops on the way", die: 6 }] });
    await game.scenes.active.setFlag(s, "sceneTraits", [{ id: "tst1", name: "[TEST] Dark Corners", die: 8 }]);
    return before;
  }, S);
  await page.waitForTimeout(1200);
  const text = await panel.innerText();
  record("shows Scene Trait", text.includes("[TEST] Dark Corners"), text);
  record("shows Complication", text.includes("[TEST] Cops on the way"), text);
  record("no NPC Trait list", (await panel.locator(".lv-sp-actor").count()) === 0);
  const box = await panel.boundingBox();
  const nav = await page.locator("#scene-navigation-viewed").boundingBox();
  const expand = await page.locator("#scene-navigation-expand").boundingBox();
  record("beside the scene navigation, no overlap", box && nav && expand && box.x >= Math.max(nav.x + nav.width, expand.x + expand.width), { box, nav, expand });
  record("same row as the navigation bar", box && nav && Math.abs(box.y - nav.y) <= 4, { box, nav });
  record("visible (nothing on top of it)", await panel.evaluate((el) => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.x + 12, r.y + 12)); }));
  record("z-index 30", (await panel.evaluate((el) => getComputedStyle(el).zIndex)) === "30");
  record("sceneTraits not in the setting", await page.evaluate((s) => !game.settings.get(s, "activeJob").sceneTraits?.length, S));
  await page.screenshot({ path: `${SHOTS}/scene-panel-open.png` });
  await page.locator("#leverage-scene-panel .lv-sp-toggle").click();
  await page.waitForTimeout(500);
  record("collapses with a summary", /1\D+1/.test(await panel.innerText()), await panel.innerText());
  await page.screenshot({ path: `${SHOTS}/scene-panel-collapsed.png` });
  await page.locator("#leverage-scene-panel .lv-sp-toggle").click();
  await page.waitForTimeout(300);
  // Migration: old-style Job with Scene Traits inside the setting moves to the active scene.
  await page.evaluate(async (s) => {
    await game.scenes.active.unsetFlag(s, "sceneTraits");
    await game.settings.set(s, "activeJob", { name: "[TEST]", goal: "", complications: [], sceneTraits: [{ id: "tmg1", name: "[TEST] Old trait", die: 6 }] });
  }, S);
  await page.reload(); // the ready hook runs the migration
  await page.waitForFunction(() => globalThis.game?.ready, null, { timeout: 60000 });
  await page.waitForFunction((id) => game.settings.get(id, "activeJob").sceneTraits?.length === 0, S, { timeout: 15000 }).catch(() => {});
  const migrated = await page.evaluate((s) => ({ flag: game.scenes.active.getFlag(s, "sceneTraits"), left: game.settings.get(s, "activeJob").sceneTraits }), S);
  record("migration moves Scene Traits to the scene", migrated.flag?.[0]?.name === "[TEST] Old trait" && migrated.left?.length === 0, migrated);
  await page.evaluate(async (s) => {
    await game.scenes.active.unsetFlag(s, "sceneTraits");
    await game.settings.set(s, "activeJob", { name: "", goal: "", complications: [] });
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
      await game.settings.set(s, "activeJob", before.job);
      const scene = game.scenes.get(before.sceneId);
      if (before.flag) await scene?.setFlag(s, "sceneTraits", before.flag);
      else await scene?.unsetFlag(s, "sceneTraits");
      await game.settings.set(s, "scenePanel.collapsed", before.collapsed);
    }, [S, saved]);
  } catch { /* nothing to restore */ }
  await browser.close();
}
const errors = log.own();
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
if (errors.length) console.log(`console errors: ${errors.length}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
