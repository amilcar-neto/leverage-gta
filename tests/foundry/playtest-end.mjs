/** Playtest stage 4: end the Job (tool dialog), Jobs tab, panel after the Job, NPC sheet minimize, final shots. */
import { requireEnv } from "./lib.mjs";
import { setCounter, openTable, shot, step, report } from "./playtest-lib.mjs";

const env = requireEnv();
const ROSA = "Jogadora Rosa";
const MARCO = "Jogador Marco";
const SOL = "Marisol \"Sol\" Quintero";
const BRUTO = "Marco \"Bruto\" Silva";
setCounter(70);
const table = await openTable(env, [ROSA, MARCO]);
const gm = table.gm.page;
const rosa = table.players[ROSA].page;
const marco = table.players[MARCO].page;
const state = (page, name) => page.evaluate((n) => {
  const a = game.actors.getName(n);
  return { money: a.system.money.steps, pp: a.system.plotPoints.value, jobs: a.items.filter((i) => i.type === "job").length, jobAssets: a.items.filter((i) => i.system.duration === "job").map((i) => i.name) };
}, name);

await step("GM ends the Job: name, total 8, shares 4 and 4", async () => {
  const before = { sol: await state(rosa, SOL), bruto: await state(marco, BRUTO) };
  await gm.evaluate(() => ui.controls.activate?.({ control: "leverage" }));
  await gm.locator('[data-tool="endJob"]').first().click();
  await gm.waitForSelector('.application input[name="total"]');
  await gm.fill('.application input[name="total"]', "8");
  const shares = await gm.evaluate(() => [...document.querySelectorAll('.application input[name^="share-"]')].map((i) => i.name));
  for (const n of shares) await gm.fill(`.application input[name="${n}"]`, "4");
  await shot(gm, "gm-end-job-filled");
  await gm.locator('.application button[data-action="ok"]').first().click();
  await gm.waitForTimeout(2000);
  const after = { sol: await state(rosa, SOL), bruto: await state(marco, BRUTO) };
  await shot(gm, "gm-after-end-job");
  return { before, after };
}, gm);

await step("Players see Jobs tab with the new Job", async () => {
  for (const [p, n] of [[rosa, "sol"], [marco, "bruto"]]) {
    if (!(await p.locator(".crew-sheet").count())) {
      await p.evaluate(() => game.user.character.sheet.render(true));
      await p.waitForSelector(".crew-sheet");
    }
    await p.evaluate(() => game.user.character.sheet.setPosition({ left: 200, top: 40 }));
    await p.waitForTimeout(800);
    await p.locator(".crew-sheet [data-action=folderTab][data-tab=jobs], .crew-sheet [data-action=folderTab]").nth(1).click();
    await p.waitForTimeout(800);
    await shot(p, `${n}-jobs-tab`);
  }
  return await rosa.locator(".crew-sheet").innerText().then((t) => /Cofre do Moretti/i.test(t));
}, rosa);

await step("Scene panel at the end for a player", async () => {
  await shot(marco, "marco-panel-end");
  return (await marco.locator("#leverage-scene-panel").innerText()).replace(/\s+/g, " ").slice(0, 160);
}, marco);

await step("GM NPC sheets open and minimize by double click", async () => {
  await gm.evaluate(() => game.actors.getName("Capangas do Moretti").sheet.render(true));
  await gm.waitForTimeout(1500);
  await shot(gm, "gm-npc-gang-sheet");
  const t = await gm.locator(".npc-sheet .window-title, .application.sheet .window-title").first().boundingBox();
  await gm.mouse.dblclick(t.x + 8, t.y + t.height / 2);
  await gm.waitForTimeout(1000);
  const h = await gm.evaluate(() => game.actors.getName("Capangas do Moretti").sheet.element.getBoundingClientRect().height);
  await shot(gm, "gm-npc-minimized");
  await gm.evaluate(() => game.actors.getName("Capangas do Moretti").sheet.close());
  return { minimizedHeight: h };
}, gm);

await step("Final chat log of the session (GM view)", async () => {
  await gm.evaluate(() => { ui.sidebar.expand?.(); ui.sidebar.changeTab?.("chat", "primary"); });
  await gm.waitForTimeout(800);
  await shot(gm, "gm-final-table");
  return await gm.evaluate(() => game.messages.size);
}, gm);

console.log(JSON.stringify({ own: { gm: table.gm.log.own(), rosa: table.players[ROSA].log.own().map((e) => e.slice(0, 120)), marco: table.players[MARCO].log.own() } }));
await table.close();
process.exit(report.every((r) => r.ok) ? 0 : 1);
