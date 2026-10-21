/** Playtest stage 5: GM gives a Plot Point (tool), Nova sessão, Callback by a player. */
import { requireEnv } from "./lib.mjs";
import { setCounter, openTable, shot, step, report } from "./playtest-lib.mjs";
const env = requireEnv();
const ROSA = "Jogadora Rosa";
const MARCO = "Jogador Marco";
setCounter(80);
const table = await openTable(env, [ROSA, MARCO]);
const gm = table.gm.page;
const rosa = table.players[ROSA].page;
const pp = (p) => p.evaluate(() => game.user.character.system.plotPoints.value);

await step("GM gives 1 Plot Point to the crew (tool dialog)", async () => {
  const before = await pp(rosa);
  await gm.evaluate(() => ui.controls.activate?.({ control: "leverage" }));
  await gm.locator('[data-tool="givePlotPoint"]').first().click();
  await gm.waitForSelector('.application input[name="actor"]');
  await shot(gm, "gm-give-pp-dialog");
  const info = await gm.evaluate(() => [...document.querySelectorAll('.application input[name="actor"]')].map((i) => `${i.type}:${i.checked}`));
  await gm.locator('.application button[data-action="ok"]').first().click();
  await gm.waitForTimeout(1500);
  return { info, before, after: await pp(rosa) };
}, gm);

await step("GM new session, Sol quotes Callback on a Job", async () => {
  await gm.evaluate(() => ui.controls.activate?.({ control: "leverage" }));
  await gm.locator('[data-tool="newSession"]').first().click();
  await gm.waitForTimeout(1500);
  const dlg = await gm.evaluate(() => [...document.querySelectorAll(".application.dialog")].map((d) => d.innerText.replace(/\s+/g, " ").slice(0, 200)));
  if (dlg.length) await gm.locator('.application.dialog button[data-action="yes"], .application.dialog button[data-action="ok"]').first().click().catch(() => {});
  await gm.waitForTimeout(1000);
  await rosa.evaluate(() => game.user.character.sheet.render(true));
  await rosa.waitForSelector(".crew-sheet");
  await rosa.waitForTimeout(1000);
  await rosa.locator(".crew-sheet [data-action=folderTab]").nth(1).click();
  await rosa.waitForTimeout(500);
  await rosa.locator(".crew-sheet [data-action=toggleCallback]").first().click();
  await rosa.waitForTimeout(1200);
  await shot(rosa, "sol-callback");
  return { dlg };
}, rosa);

console.log(JSON.stringify({ own: { gm: table.gm.log.own(), rosa: table.players[ROSA].log.own().map((e) => e.slice(0, 120)) } }));
await table.close();
process.exit(report.every((r) => r.ok) ? 0 : 1);
