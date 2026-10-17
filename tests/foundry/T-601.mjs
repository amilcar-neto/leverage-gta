/**
 * T-601 check: Life/Vest token bars, heal/buyVest on the actor, houseRules.life hiding bars, NPC model.
 * Creates only `[TEST]` documents and deletes them. Run after `npm run deploy`.
 * Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });

try {
  await login(page, env);
} catch (err) {
  console.log(`FOUNDRY: not available - ${err.message.split("\n")[0]}`);
  await browser.close();
  process.exit(2);
}

try {
  const setup = await page.evaluate(async () => {
    const actor = await Actor.create({ name: "[TEST] Bars", type: "crew" });
    await actor.update({ "system.vest.kind": "standard", "system.vest.value": 6, "system.money.steps": 6 });
    const scene = await CONFIG.Scene.documentClass.create({ name: "[TEST] Scene", width: 1000, height: 800, grid: { size: 100 } });
    await scene.view();
    const data = actor.prototypeToken.toObject();
    data.x = 300; data.y = 300; data.displayBars = CONST.TOKEN_DISPLAY_MODES.ALWAYS;
    const [token] = await scene.createEmbeddedDocuments("Token", [{ ...data, actorId: actor.id, actorLink: true }]);
    await new Promise((r) => setTimeout(r, 1500));
    return { actorId: actor.id, tokenId: token.id, sceneId: scene.id,
      bar1: token.bar1.attribute, bar2: token.bar2.attribute, b1: token.getBarAttribute("bar1"), b2: token.getBarAttribute("bar2") };
  });
  record("prototype token bars are life and vest", setup.bar1 === "life" && setup.bar2 === "vest", setup);
  record("bar values have value and max", setup.b1?.max === 16 && setup.b2?.max === 6, setup);

  const edit = await page.evaluate(async ({ actorId }) => {
    const actor = game.actors.get(actorId);
    
    await actor.modifyTokenAttribute("life", -5, true, true);
    const down = actor.system.life.value;
    await actor.modifyTokenAttribute("life", -100, true, true);
    const floor = actor.system.life.value;
    await actor.modifyTokenAttribute("vest", -2, true, true);
    const vest = actor.system.vest.value;
    await actor.modifyTokenAttribute("life", 100, true, true);
    const ceil = actor.system.life.value;
    return { down, floor, vest, ceil };
  }, setup);
  record("editing the bar changes life/vest within 0..max", edit.down === 11 && edit.floor === 0 && edit.vest === 4 && edit.ceil === 16, edit);

  const bars = (visible) => page.evaluate(({ tokenId }) => canvas.tokens.get(tokenId)?.bars?.visible, { tokenId: setup.tokenId }).then((v) => v === visible);
  record("bars visible with the rule on", await bars(true));
  await page.screenshot({ path: `${SHOTS}/T-601-token.png` });
  await page.evaluate(() => game.settings.set("leverage-gta", "houseRules.life", false));
  await page.waitForTimeout(800);
  record("bars hidden with houseRules.life off", await bars(false));
  await page.evaluate(() => game.settings.set("leverage-gta", "houseRules.life", true));
  await page.waitForTimeout(800);

  const rec = await page.evaluate(async ({ actorId }) => {
    const actor = game.actors.get(actorId);
    await actor.update({ "system.life.value": 4, "system.vest.value": 0 });
    await actor.restScene();
    const afterRest = actor.system.life.value; // 4 + 8
    await actor.heal(100);
    const healed = actor.system.life.value;
    const money0 = actor.system.money.steps;
    const buy = await actor.restoreVest();
    const spent = money0 - actor.system.money.steps;
    const vest = actor.system.vest.value;
    await actor.update({ "system.money.steps": 0 });
    const poor = await actor.buyVest("heavy");
    return { afterRest, healed, buy, spent, vest, poor, kind: actor.system.vest.kind };
  }, setup);
  record("restScene gives half max", rec.afterRest === 12, rec);
  record("heal caps at max", rec.healed === 16, rec);
  record("restoreVest pays d6 (2 steps) and refills", rec.buy.ok && rec.spent === 2 && rec.vest === 6, rec);
  record("buyVest refuses when poor", !rec.poor.ok && rec.kind === "standard", rec);

  const npc = await page.evaluate(async () => {
    const n = await Actor.create({ name: "[TEST] Goon", type: "npc" });
    const out = { life: n.system.life.toObject?.() ?? n.system.life, vest: n.system.vest.max };
    await n.update({ "system.vest.kind": "light", "system.vest.value": 4 });
    out.vestMax = n.system.vest.max;
    await n.delete();
    return out;
  });
  record("npc has life and vest", npc.life?.max > 0 && npc.vestMax === 4, npc);

  await page.evaluate(({ actorId }) => game.actors.get(actorId).sheet.render({ force: true }), setup);
  await page.waitForTimeout(1000);
  await page.click(".crew-sheet .lv-vital--vest .lv-vital-btn");
  await page.waitForSelector(".crew-sheet .lv-pop");
  await page.screenshot({ path: `${SHOTS}/T-601-popover.png` });
  record("no system errors in console", log.own().length === 0, log.own());
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-601-failure.png` }).catch(() => {});
} finally {
  await page.evaluate(async () => {
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) { await a.sheet.close(); await a.delete(); }
    for (const s of game.scenes.filter((x) => x.name.startsWith("[TEST]"))) await s.delete();
  }).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
