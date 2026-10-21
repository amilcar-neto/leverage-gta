/**
 * Playtest stage 1: puts the table in a ready-to-play state (scene with tokens, active Job with Complications and
 * Scene Traits, stars, Plot Points, Grana, Life) and checks what GM and both players see (HUD, scene panel,
 * sheets, minimize by double click, HUD under windows). Data stays in the world.
 */
import { requireEnv } from "./lib.mjs";
import { openTable, shot, step, report, S, sleep } from "./playtest-lib.mjs";

const env = requireEnv();
const ROSA = "Jogadora Rosa";
const MARCO = "Jogador Marco";
const table = await openTable(env, [ROSA, MARCO]);
const gm = table.gm.page;
const rosa = table.players[ROSA].page;
const marco = table.players[MARCO].page;

await step("GM builds scene, tokens, Job, stars, PP", async () => {
  return gm.evaluate(async (S) => {
    // Reset the crew to the start of a Job.
    for (const [name, steps, pp] of [["Marisol \"Sol\" Quintero", 4, 2], ["Marco \"Bruto\" Silva", 3, 2]]) {
      const a = game.actors.getName(name);
      await a.update({ "system.life.value": a.system.life.max, "system.money.steps": steps, "system.plotPoints.value": pp });
    }
    // Scene.
    let scene = game.scenes.getName("Armazém do Porto Velho");
    if (scene) await scene.delete();
    scene = await foundry.documents.Scene.create({ name: "Armazém do Porto Velho", width: 2400, height: 1600, grid: { size: 100 }, padding: 0, backgroundColor: "#1b1b22", tokenVision: false, fog: { exploration: false } });
    const tokenOf = async (name, x, y, extra = {}) => {
      const a = game.actors.getName(name);
      const data = a.prototypeToken.toObject();
      return { ...data, name: a.name, actorId: a.id, actorLink: true, x, y, displayBars: CONST.TOKEN_DISPLAY_MODES.ALWAYS, ...extra };
    };
    const tokens = [];
    tokens.push(await tokenOf("Marisol \"Sol\" Quintero", 300, 1000));
    tokens.push(await tokenOf("Marco \"Bruto\" Silva", 500, 1000));
    tokens.push(await tokenOf("Vincenzo \"Vinnie\" Moretti", 1500, 400));
    tokens.push(await tokenOf("Capangas do Moretti", 1300, 600));
    tokens.push(await tokenOf("Patrulha da Polícia", 1900, 1200));
    tokens.push(await tokenOf("Armazém do Porto Velho", 1000, 200));
    await scene.createEmbeddedDocuments("Token", tokens);
    await scene.activate();
    await scene.view();
    // Job.
    await game.leverage.job.new("O Cofre do Moretti");
    const job = game.settings.get(S, "activeJob");
    await game.settings.set(S, "activeJob", {
      ...job, name: "O Cofre do Moretti: pegar o livro-caixa do cofre do segundo andar",
      complications: [{ id: "cx1", name: "Alarme Silencioso", die: 6 }, { id: "cx2", name: "Polícia a Caminho", die: 6 }],
      sceneTraits: [{ id: "st1", name: "Holofote Quebrado", die: 8 }, { id: "st2", name: "Chuva Forte", die: 6 }]
    });
    await game.leverage.stars.set(1, "liberty");
    for (const name of ["Marisol \"Sol\" Quintero", "Marco \"Bruto\" Silva"]) {
      const a = game.actors.getName(name);
      await a.update({ "system.plotPoints.value": 2 });
    }
    return { scene: scene.id, job: game.settings.get(S, "activeJob").name, stars: game.leverage.stars.get() };
  }, S);
}, gm);

await sleep(3500);
for (const p of [gm, rosa, marco]) await p.waitForTimeout(500);

await step("shots: GM, Rosa, Marco table", async () => {
  await shot(gm, "gm-table-start");
  await shot(rosa, "rosa-table-start");
  await shot(marco, "marco-table-start");
});

await step("scene panel visible to players", async () => {
  const out = {};
  for (const [n, p] of [["rosa", rosa], ["marco", marco], ["gm", gm]]) {
    const panel = p.locator("#leverage-scene-panel");
    out[n] = (await panel.innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
  }
  return out;
});

await step("HUD of each player shows PP/Grana of the own character", async () => {
  const read = (p) => p.evaluate(() => document.querySelector("#leverage-hud")?.innerText.replace(/\s+/g, " "));
  return { rosa: await read(rosa), marco: await read(marco), gm: await read(gm) };
});

await step("open sheets and minimize by double click (Rosa)", async () => {
  await rosa.evaluate(() => game.user.character.sheet.render(true));
  await rosa.waitForSelector(".crew-sheet", { timeout: 10000 });
  await rosa.waitForTimeout(1500);
  await shot(rosa, "rosa-sheet-open");
  const t = await rosa.locator(".crew-sheet .window-title").boundingBox();
  await rosa.mouse.dblclick(t.x + 10, t.y + t.height / 2);
  await rosa.waitForTimeout(1200);
  const min = await rosa.evaluate(() => ({ m: game.user.character.sheet.minimized, h: game.user.character.sheet.element.getBoundingClientRect().height }));
  await shot(rosa, "rosa-sheet-minimized");
  await rosa.mouse.dblclick(t.x + 10, t.y + t.height / 2);
  await rosa.waitForTimeout(1200);
  const back = await rosa.evaluate(() => ({ m: game.user.character.sheet.minimized, h: game.user.character.sheet.element.getBoundingClientRect().height }));
  return { min, back };
}, rosa);

await step("HUD stays below windows (sheet moved over the HUD)", async () => {
  const hud = await rosa.locator("#leverage-hud").boundingBox();
  await rosa.evaluate((h) => game.user.character.sheet.setPosition({ left: Math.max(0, h.x - 600), top: Math.max(0, h.y - 20) }), hud);
  await rosa.waitForTimeout(600);
  const probe = await rosa.evaluate((h) => {
    const el = document.elementFromPoint(h.x + h.width / 2, h.y + h.height / 2);
    return { onSheet: Boolean(el?.closest(".crew-sheet")), onHud: Boolean(el?.closest("#leverage-hud")), tag: el?.className?.toString().slice(0, 40) };
  }, hud);
  await shot(rosa, "rosa-sheet-over-hud");
  await rosa.evaluate(() => game.user.character.sheet.setPosition({ left: 200, top: 40 }));
  return probe;
}, rosa);

await step("Marco sheet open", async () => {
  await marco.evaluate(() => game.user.character.sheet.render(true));
  await marco.waitForSelector(".crew-sheet", { timeout: 10000 });
  await marco.waitForTimeout(1500);
  await shot(marco, "marco-sheet-open");
});

console.log(JSON.stringify({ own: Object.fromEntries([["gm", table.gm.log.own()], ["rosa", table.players[ROSA].log.own()], ["marco", table.players[MARCO].log.own()]]) }));
await table.close();
process.exit(report.every((r) => r.ok) ? 0 : 1);
