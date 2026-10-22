/**
 * Narrator usability fixes in the real Foundry (GM): tools visible on load, Job Tracker without a Job, Location
 * sheet with scene NPCs, Extra NPC without Life/Vest, pointed NPC in the opposition roller, APPLY DAMAGE defaults.
 * Everything created is `[TEST]` and deleted; the active Job is saved and restored.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const shot = (name) => page.screenshot({ path: `${SHOTS}/narrator-${name}.png` });
const results = [];
const check = (name, ok, extra = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", name, extra); };
let savedJob;
let prevSceneId;
try {
  await login(page, env);
  await page.waitForTimeout(1500);
  const tools = await page.evaluate(() => [...document.querySelectorAll("#scene-controls-tools button")].map((b) => b.dataset.tool));
  check("Leverage tools visible on load", tools.includes("wanted") && tools.includes("tracker"), tools.join(","));
  console.log("active layer:", await page.evaluate(() => canvas.activeLayer?.constructor?.name));
  await shot("01-controls");

  savedJob = await page.evaluate(() => lvTestJob.snapshot());
  await page.evaluate(async () => { await lvTestJob.set({ name: "", goal: "" }); });
  await page.evaluate(async () => { await game.leverage.jobTracker.open(); });
  await page.waitForTimeout(1200);
  check("Tracker shows New Job button without a Job", (await page.locator("#leverage-job-tracker [data-action=newJob]").count()) === 1);
  await shot("02-tracker-nojob");
  await page.evaluate(() => foundry.applications.instances.get("leverage-job-tracker")?.close());

  prevSceneId = await page.evaluate(() => canvas.scene?.id ?? null);
  const ids = await page.evaluate(async () => {
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST] "))) await a.delete();
    for (const s of game.scenes.filter((x) => x.name.startsWith("[TEST] "))) await s.delete();
    const extra = await Actor.create({ name: "[TEST] Capangas", type: "npc", system: { tier: "extra", gang: { size: 4, die: 8 }, weapon: { die: 8 }, traits: [{ name: "Armed", die: 10 }] } });
    const foil = await Actor.create({ name: "[TEST] Tenente", type: "npc", system: { tier: "foil", police: true, weapon: { die: 6 }, traits: [{ name: "Badge", die: 8 }] } });
    const loc = await Actor.create({ name: "[TEST] Cassino", type: "location", system: { traits: [{ name: "Dark", die: 8 }] } });
    const crew = await Actor.create({ name: "[TEST] Rosa", type: "crew" });
    const scene = await foundry.documents.Scene.create({ name: "[TEST] Cena", width: 1000, height: 1000, grid: { size: 100 } });
    const toks = [];
    let x = 100;
    for (const a of [loc, extra, foil]) { toks.push((await a.getTokenDocument({ x, y: 100 })).toObject()); x += 200; }
    await scene.createEmbeddedDocuments("Token", toks);
    await scene.view();
    return { extra: extra.id, foil: foil.id, loc: loc.id, crew: crew.id, scene: scene.id };
  });
  await page.waitForTimeout(2500);

  await page.evaluate(async (id) => { await game.actors.get(id).sheet.render(true); }, ids.loc);
  await page.waitForTimeout(1500);
  const present = await page.locator(".location-sheet .lv-loc-person.is-present").count();
  check("Location lists scene NPCs", present === 2, `present=${present}`);
  await shot("03-location");
  await page.locator(".location-sheet .lv-loc-person.is-present [data-action=linkNpc]").first().click();
  await page.waitForTimeout(1000);
  check("Link button links an NPC", (await page.evaluate((id) => game.actors.get(id).system.npcs.length, ids.loc)) === 1);
  await shot("03b-location-linked");
  await page.evaluate(async (id) => { await game.actors.get(id).sheet.close(); }, ids.loc);

  await page.evaluate(async (id) => { await game.actors.get(id).sheet.render(true); }, ids.extra);
  await page.waitForTimeout(1500);
  check("Extra NPC has no Life/Vest", (await page.locator(".npc-sheet .lv-npc-vitals").count()) === 0);
  await shot("04-npc-extra");
  await page.evaluate(async (id) => { await game.actors.get(id).sheet.close(); }, ids.extra);
  await page.evaluate(async (id) => { await game.actors.get(id).sheet.render(true); }, ids.foil);
  await page.waitForTimeout(1500);
  check("Foil without a gang hides the gang panel", (await page.locator(".npc-sheet .lv-npc-gang").isHidden()));
  await shot("05-npc-foil");
  await page.evaluate(async (id) => { await game.actors.get(id).sheet.close(); }, ids.foil);

  await page.evaluate(async (npcId) => {
    canvas.tokens.activate();
    canvas.tokens.placeables.find((t) => t.actor?.id === npcId)?.control({ releaseOthers: true });
    await game.leverage.openOppositionRoller();
  }, ids.extra);
  await page.waitForTimeout(1500);
  await shot("06-opposition-prefilled");
  await page.locator("#leverage-opposition-roller [data-action=roll]").click();
  await page.waitForTimeout(1500);
  const card = await page.evaluate(() => game.messages.contents.at(-1)?.flags?.["leverage-gta"]?.roll?.npcUuid ?? null);
  check("Opposition card keeps the NPC (dice came pre-picked)", Boolean(card), String(card));

  await page.evaluate(() => ui.sidebar.changeTab?.("chat", "primary"));
  await page.waitForTimeout(800);
  await page.evaluate(() => [...document.querySelectorAll(".lv-roll-btn--damage")].at(-1).click());
  await page.waitForTimeout(1200);
  const form = await page.evaluate(() => {
    const f = document.querySelector(".lv-dialog form");
    return f ? { attacker: f.elements.attacker.selectedOptions[0]?.text, weapon: f.elements.weapon.value } : null;
  });
  check("Damage dialog starts from the NPC", form?.attacker === "[TEST] Capangas" && form.weapon === "8", JSON.stringify(form));
  await shot("07-damage-dialog");
  await page.keyboard.press("Escape");
} finally {
  await page.evaluate(async ({ job, scene }) => {
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST] "))) await a.delete();
    for (const s of game.scenes.filter((x) => x.name.startsWith("[TEST] "))) await s.delete();
    if (job) await lvTestJob.restore(job);
    for (const m of game.messages.filter((x) => x.flags?.["leverage-gta"]?.roll?.opposition && Date.now() - x.timestamp < 300000)) await m.delete();
    if (scene) await game.scenes.get(scene)?.view();
  }, { job: savedJob, scene: prevSceneId }).catch((e) => console.log("cleanup", e.message));
  await browser.close();
}
console.log("own errors:", log.own().length, log.own().slice(0, 3));
process.exit(results.every(Boolean) ? 0 : 1);
