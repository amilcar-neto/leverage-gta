/**
 * Scene Panel check in the real Foundry (GM): sets an active Job with a Scene Trait and a Complication, puts a
 * `[TEST]` NPC token with Traits on the viewed scene, checks the panel text, the collapse button, the live update and
 * that it does not overlap the HUD; takes screenshots. Restores the Job and deletes the `[TEST]` documents.
 * Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const S = "leverage-gta";
let saved = null;
let created = null;
const panel = page.locator("#leverage-scene-panel");

try {
  await login(page, env);
  created = await page.evaluate(async (s) => {
    const saved = foundry.utils.deepClone(game.settings.get(s, "activeJob"));
    for (const sc of game.scenes) await sc.deleteEmbeddedDocuments("Token", sc.tokens.filter((t) => t.name === "[TEST] Thug").map((t) => t.id));
    for (const old of game.actors.filter((a) => a.name === "[TEST] Thug")) await old.delete(); // left by a crashed run
    await game.settings.set(s, "scenePanel.collapsed", false);
    await game.settings.set(s, "activeJob", {
      name: "[TEST]", sceneTraits: [{ id: "tst1", name: "[TEST] Dark Corners", die: 8 }],
      complications: [{ id: "tcx1", name: "[TEST] Cops on the way", die: 6 }]
    });
    const scene = game.scenes.viewed ?? game.scenes.contents[0];
    if (!scene.active && !game.scenes.viewed) await scene.view();
    const npc = await Actor.create({ name: "[TEST] Thug", type: "npc", system: { traits: [{ name: "Armed to the teeth", die: 10 }] } });
    const [token] = await scene.createEmbeddedDocuments("Token", [{ name: "[TEST] Thug", actorId: npc.id, x: 200, y: 200 }]);
    return { saved, actorId: npc.id, tokenId: token.id, sceneId: scene.id };
  }, S);
  saved = created.saved;
  await page.waitForTimeout(1200);
  const text = await panel.innerText();
  record("shows Scene Trait", text.includes("[TEST] Dark Corners"), text);
  record("shows Complication", text.includes("[TEST] Cops on the way"), text);
  record("shows NPC Trait", text.includes("Armed to the teeth"), text);
  const box = await panel.boundingBox();
  const hud = await page.locator("#leverage-hud").boundingBox();
  record("below the HUD, no overlap", box && hud && box.y >= hud.y + hud.height, { box, hud });
  record("z-index 30", (await panel.evaluate((el) => getComputedStyle(el).zIndex)) === "30");
  await page.screenshot({ path: `${SHOTS}/scene-panel-open.png` });
  await page.locator("#leverage-scene-panel .lv-sp-toggle").click();
  await page.waitForTimeout(500);
  record("collapses with a summary", /1\D+1\D+1/.test(await panel.innerText()), await panel.innerText());
  await page.screenshot({ path: `${SHOTS}/scene-panel-collapsed.png` });
  await page.locator("#leverage-scene-panel .lv-sp-toggle").click();
  await page.waitForTimeout(300);
  await page.evaluate(async (s) => {
    await game.settings.set(s, "activeJob", { name: "", sceneTraits: [], complications: [] });
    await game.actors.get(game.actors.contents.find((a) => a.name === "[TEST] Thug").id).update({ "system.traits": [] });
  }, S);
  await page.waitForTimeout(800);
  record("empty state updates live", await panel.locator(".lv-sp.is-empty").count() === 1, await panel.innerText());
  await page.screenshot({ path: `${SHOTS}/scene-panel-empty.png` });
} catch (error) {
  record("script", false, String(error));
} finally {
  try {
    await page.evaluate(async ([s, saved, c]) => {
      if (saved) await game.settings.set(s, "activeJob", saved);
      if (c) {
        await game.scenes.get(c.sceneId)?.deleteEmbeddedDocuments("Token", [c.tokenId]);
        await game.actors.get(c.actorId)?.delete();
        await game.settings.set(s, "scenePanel.collapsed", false);
      }
    }, [S, saved, created]);
  } catch { /* nothing to restore */ }
  await browser.close();
}
const errors = log.own();
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
if (errors.length) console.log(`console errors: ${errors.length}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
