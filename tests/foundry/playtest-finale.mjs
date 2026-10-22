/**
 * Playtest stage 3: scene Asset, Complication from a card, Wasted and Busted, stars going down, end of scene and
 * end of Job. Runs on the state left by playtest-setup.mjs + playtest-play.mjs. Data stays in the world.
 */
import { requireEnv } from "./lib.mjs";
import { setCounter, openTable, shot, step, report, S, itemId, addDie, pressRoll, rollFlag, closeApps } from "./playtest-lib.mjs";

const env = requireEnv();
const ROSA = "Jogadora Rosa";
const MARCO = "Jogador Marco";
const SOL = "Marisol \"Sol\" Quintero";
const BRUTO = "Marco \"Bruto\" Silva";
setCounter(50);
const table = await openTable(env, [ROSA, MARCO]);
const gm = table.gm.page;
const rosa = table.players[ROSA].page;
const marco = table.players[MARCO].page;

const state = (page, name) => page.evaluate((n) => {
  const a = game.actors.getName(n);
  return { life: a.system.life.value, vest: a.system.vest.value, money: a.system.money.steps, pp: a.system.plotPoints.value, items: a.items.size, scene: a.items.filter((i) => i.system.duration === "scene").map((i) => i.name) };
}, name);
const ensureChat = async (page) => { await page.evaluate(() => { ui.sidebar.expand?.(); ui.sidebar.changeTab?.("chat", "primary"); }); await page.waitForTimeout(700); };
const ensureSheet = async (page) => {
  if (!(await page.locator(".crew-sheet").count())) {
    await page.evaluate(() => game.user.character.sheet.render(true));
    await page.waitForSelector(".crew-sheet");
    await page.waitForTimeout(1200);
  }
  await page.evaluate(() => game.user.character.sheet.setPosition({ left: 200, top: 40 }));
};
const cardShot = async (page, id, name) => {
  await ensureChat(page);
  await page.evaluate((i) => document.querySelector(`#chat .chat-message[data-message-id="${i}"]`)?.scrollIntoView(), id);
  await page.waitForTimeout(400);
  const loc = page.locator(`#chat .chat-message[data-message-id="${id}"]`);
  if (await loc.count()) await loc.screenshot({ path: `tests/foundry/screenshots/playtest-card-${name}.png` });
};
const jobState = () => gm.evaluate((S) => ({ ...game.settings.get(S, "activeJob"), complications: game.settings.get(S, "complications"), sceneTraits: game.settings.get(S, "globalTraits") }), S);

await step("Sol creates a scene Asset (1 PP) with + Adicionar", async () => {
  await ensureSheet(rosa);
  const before = await state(rosa, SOL);
  // Bug probe: confirm with the Nome field blank.
  const errs0 = table.players[ROSA].log.errors.length;
  await rosa.locator(".crew-sheet [data-action=addAsset]").click();
  await rosa.waitForSelector(".lv-dialog input[name=name]");
  await rosa.locator('.lv-dialog button[data-action="ok"]').first().click();
  await rosa.waitForTimeout(1500);
  const blankErrors = table.players[ROSA].log.errors.slice(errs0).map((e) => e.slice(0, 160));
  const blank = await state(rosa, SOL);
  await shot(rosa, "sol-asset-blank-name-bug");
  await rosa.locator(".crew-sheet [data-action=addAsset]").click();
  await rosa.waitForSelector(".lv-dialog input[name=name]");
  await rosa.fill('.lv-dialog input[name=name]', "Escada de Incendio Destrancada");
  await rosa.selectOption('.lv-dialog select[name=duration]', "scene");
  await shot(rosa, "sol-new-asset-filled");
  await rosa.locator('.lv-dialog button[data-action="ok"]').first().click();
  await rosa.waitForTimeout(1500);
  const after = await state(rosa, SOL);
  await shot(rosa, "sol-asset-created");
  return { blankErrors, ppAfterBlank: blank.pp, ppBefore: before.pp, ppAfter: after.pp, scene: after.scene };
}, rosa);

await step("Sol uses the new scene Asset in a roll; GM sees 1s and adds a Complication from the card", async () => {
  await rosa.locator(".crew-sheet [data-action=clearPool]").click().catch(() => {});
  let got = null;
  for (let i = 0; i < 8 && !got; i++) {
    await rosa.locator(".crew-sheet [data-action=clearPool]").click().catch(() => {});
    await rosa.locator('.crew-sheet [data-pool-ref="attributes.agility"]').first().click();
    await rosa.locator('.crew-sheet [data-pool-ref="roles.thief"]').first().click();
    const asset = await itemId(rosa, SOL, "Escada de Incendio Destrancada");
    await rosa.locator(`.crew-sheet [data-pool-ref="item:${asset}"]`).first().click();
    for (let k = 0; k < 3; k++) await addDie(rosa, "d4");
    const id = await pressRoll(rosa);
    if ((await rollFlag(rosa, id)).entries.some((e) => e.includes("(1)"))) got = id;
  }
  if (!got) throw new Error("no 1 in 8 rolls");
  await ensureChat(gm);
  const ppBefore = (await state(rosa, SOL)).pp;
  const jobBefore = (await jobState()).complications.map((c) => `${c.name} d${c.die}`);
  await gm.locator(`#chat .chat-message[data-message-id="${got}"] [data-action=complication]`).click();
  await gm.waitForSelector('.application input[name=name]');
  await gm.fill('.application input[name=name]', "Vizinho Chamou a Policia");
  await shot(gm, "gm-complication-new");
  await gm.locator('.application button[data-action="ok"]').first().click();
  await gm.waitForTimeout(1500);
  const jobAfter = (await jobState()).complications.map((c) => `${c.name} d${c.die}`);
  const ppAfter = (await state(rosa, SOL)).pp;
  await cardShot(rosa, got, "sol-roll-after-complication");
  await shot(rosa, "sol-sees-new-complication");
  return { jobBefore, jobAfter, ppBefore, ppAfter };
}, gm);

await step("GM raises an existing Complication from a second card (Subir ...)", async () => {
  // Reuse the logic through the dialog: use the latest card with a 1 and pick the first 'Subir' option.
  const id = await gm.evaluate(() => game.messages.contents.filter((m) => m.getFlag("leverage-gta", "roll")?.entries?.some((e) => e.one) && m.getFlag("leverage-gta", "roll")?.actorUuid).at(-1)?.id);
  await ensureChat(gm);
  await gm.locator(`#chat .chat-message[data-message-id="${id}"] [data-action=complication]`).click();
  await gm.waitForSelector('.application select');
  const options = await gm.evaluate(() => [...document.querySelectorAll(".application select option")].map((o) => o.textContent));
  await gm.selectOption('.application select', { index: 1 });
  await gm.locator('.application button[data-action="ok"]').first().click();
  await gm.waitForTimeout(1500);
  return { options, job: (await jobState()).complications.map((c) => `${c.name} d${c.die}`) };
}, gm);

await step("Busted: Sol caught by police (Liberty City: no bail, rescue only)", async () => {
  const before = await state(rosa, SOL);
  const stars0 = await gm.evaluate(() => game.leverage.stars.get());
  await gm.evaluate((n) => game.leverage.combat.down(game.actors.getName(n), { byPolice: true, confirm: false }), SOL);
  await gm.waitForTimeout(1500);
  const id = await gm.evaluate(() => game.messages.contents.filter((m) => m.getFlag("leverage-gta", "down")?.kind === "busted").at(-1)?.id);
  await cardShot(gm, id, "busted-card");
  await shot(rosa, "sol-busted-view");
  const after = await state(rosa, SOL);
  // Rescue.
  await gm.locator(`#chat .chat-message[data-message-id="${id}"] [data-action=rescued]`).click();
  await gm.waitForTimeout(1500);
  const stars1 = await gm.evaluate(() => game.leverage.stars.get());
  await shot(gm, "gm-after-rescue");
  return { before, after, stars0, stars1 };
}, gm);

await step("Wasted: Bruto takes a big hit from Vinnie (applyDamage via API)", async () => {
  await gm.evaluate((n) => game.actors.getName(n).update({ "system.life.value": 2, "system.vest.value": 0 }), BRUTO);
  const before = await state(marco, BRUTO);
  await gm.evaluate((n) => game.leverage.combat.applyDamage({ target: game.actors.getName(n), margin: 6, weaponDie: 8, cover: false, confirm: false }), BRUTO);
  await gm.waitForTimeout(1500);
  const id = await gm.evaluate(() => game.messages.contents.filter((m) => m.getFlag("leverage-gta", "down")?.kind === "wasted").at(-1)?.id);
  await cardShot(marco, id, "wasted-card");
  await shot(marco, "bruto-wasted-view");
  const after = await state(marco, BRUTO);
  return { before, after };
}, gm);

await step("GM lowers stars: wait (Wanted dialog)", async () => {
  await gm.evaluate(() => ui.controls.activate?.({ control: "leverage" }));
  await gm.locator('[data-tool="wanted"]').first().click();
  await gm.waitForTimeout(1200);
  const lvl0 = await gm.evaluate(() => game.leverage.stars.get());
  await gm.locator('.application [data-action=wait]').first().click();
  await gm.waitForTimeout(1200);
  const lvl1 = await gm.evaluate(() => game.leverage.stars.get());
  await shot(gm, "gm-stars-wait");
  await closeApps(gm, /wanted/i);
  return { lvl0, lvl1 };
}, gm);

await step("Scene panel for players before ending the scene", async () => {
  await shot(marco, "marco-panel-before-end-scene");
  return (await marco.locator("#leverage-scene-panel").innerText()).replace(/\s+/g, " ").slice(0, 200);
}, marco);

await step("GM ends the scene (tool): scene Assets and Scene Traits disappear", async () => {
  const before = { sol: (await state(rosa, SOL)).scene, traits: (await jobState()).sceneTraits.length };
  await gm.evaluate(() => ui.controls.activate?.({ control: "leverage" }));
  await gm.locator('[data-tool="endScene"]').first().click();
  await gm.waitForTimeout(1200);
  await shot(gm, "gm-end-scene-confirm");
  const text = await gm.evaluate(() => [...document.querySelectorAll(".application.dialog, dialog")].map((d) => d.innerText.replace(/\s+/g, " ").slice(0, 300)));
  await gm.locator('.application.dialog button[data-action="yes"], dialog button[data-action="yes"], .application button[data-action="ok"]').first().click();
  await gm.waitForTimeout(1500);
  const after = { sol: (await state(rosa, SOL)).scene, traits: (await jobState()).sceneTraits.length };
  await shot(gm, "gm-after-end-scene");
  await shot(marco, "marco-panel-after-end-scene");
  return { text, before, after };
}, gm);

await step("GM ends the Job (tool dialog)", async () => {
  await gm.locator('[data-tool="endJob"]').first().click();
  await gm.waitForTimeout(1500);
  await shot(gm, "gm-end-job-dialog");
  const info = await gm.evaluate(() => [...document.querySelectorAll(".application.dialog input, .application.dialog select, .application.dialog button, dialog input, dialog button")].map((e) => `${e.tagName}:${e.name || e.dataset.action || ""}=${e.value ?? ""}`));
  return info;
}, gm);

console.log(JSON.stringify({ own: { gm: table.gm.log.own(), rosa: table.players[ROSA].log.own(), marco: table.players[MARCO].log.own() }, other: { gm: table.gm.log.other().slice(0, 5) } }));
await table.close();
process.exit(report.every((r) => r.ok) ? 0 : 1);
