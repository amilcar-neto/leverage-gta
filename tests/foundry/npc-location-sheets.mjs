/**
 * NPC and Location sheets check in the real Foundry (GM): creates `[TEST]` actors (extra with a gang, police
 * foil, mark, empty location, full location), opens each sheet, screenshots it and deletes everything.
 * Usage: node tests/foundry/npc-location-sheets.mjs [before|after]
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const tag = process.argv[2] ?? "after";
const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const ids = [];
try {
  await login(page, env);
  const made = await page.evaluate(async () => {
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST] "))) await a.delete();
    const mk = (data) => Actor.create(data);
    const list = [];
    list.push(await mk({ name: "[TEST] Capangas do Moretti", type: "npc", system: { tier: "extra", gang: { size: 4, die: 8 }, weapon: { die: 8 }, traits: [{ name: "Armed to the teeth", die: 10 }, { name: "Loyal", die: 8 }] } }));
    list.push(await mk({ name: "[TEST] Detetive Reyes", type: "npc", system: { tier: "foil", police: true, weapon: { die: 6 }, attributes: { agility: { die: 8 }, alertness: { die: 10 }, vitality: { die: 8 } }, roles: { hitter: { die: 8 } }, traits: [{ name: "Friends in the Precinct", die: 10 }], notes: "<p>Detetive corrupto.</p>" } }));
    list.push(await mk({ name: "[TEST] Moretti", type: "npc", system: { tier: "mark" } }));
    list.push(await mk({ name: "[TEST] Beco vazio", type: "location" }));
    list.push(await mk({ name: "[TEST] Cassino do Moretti", type: "location", system: { traits: [{ name: "Dark Corners", die: 8 }, { name: "Security Cameras", die: 10 }], notes: "<p>Cassino no porto.</p>" } }));
    return list.map((a) => a.id);
  });
  ids.push(...made);
  const names = ["extra", "foil-police", "mark", "loc-empty", "loc-full"];
  for (let i = 0; i < made.length; i++) {
    await page.evaluate(async (id) => { await game.actors.get(id).sheet.render(true); }, made[i]);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/npcloc-${tag}-${names[i]}.png` });
    await page.evaluate(async (id) => { await game.actors.get(id).sheet.close(); }, made[i]);
  }
} finally {
  await page.evaluate(async () => { for (const a of game.actors.filter((x) => x.name.startsWith("[TEST] "))) await a.delete(); }).catch(() => {});
  await browser.close();
}
console.log("own errors:", log.own().length, log.own().slice(0, 3));
