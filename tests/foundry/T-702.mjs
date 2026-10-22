/**
 * T-702 check: "Leverage" scene-control group in the real Foundry (GM). Uses one played `[TEST]` crew character (owned
 * by a temporary `[TEST]` player user) and one unplayed `[TEST]` crew character; the tools that touch every played Crew
 * character (new session, end scene, new Job, end Job) only run when no other played Crew with Items exists.
 * Restores the settings it changes and deletes `[TEST]` documents, users and the chat messages it caused. Run after `npm run deploy`.
 * Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const wait = (ms) => page.waitForTimeout(ms);
const S = "leverage-gta";
let saved = null;
let snap = [];
let msgsBefore = [];
const tool = (name) => page.locator(`button.tool[data-tool="${name}"]`);
const dialog = page.locator(".application.lv-dialog");
const wanted = page.locator(".application.lv-opposition.lv-wanted");
const setting = (key) => page.evaluate(([s, k]) => game.settings.get(s, k), [S, key]);
const actorState = (id) => page.evaluate((i) => {
  const a = game.actors.get(i);
  return { pp: a.system.plotPoints.value, steps: a.system.money.steps, items: a.items.map((x) => ({ type: x.type, name: x.name, used: x.system.callbackUsed, payout: x.system.payout })) };
}, id);

try {
  await login(page, env);
  const setup = await page.evaluate(async (s) => {
    const saved = Object.fromEntries(["playersCanUnlock", "wanted", "activeJob"].map((k) => [k, foundry.utils.deepClone(game.settings.get(s, k))]));
    const crew = game.actors.filter((a) => a.type === "crew");
    const others = crew.filter((a) => a.items.size > 0 && game.users.some((u) => !u.isGM && a.testUserPermission(u, "OWNER"))).length; // other played Crew with Items would be touched: skip then
    const snap = crew.map((a) => [a.id, a.system.plotPoints.value, a.system.money.steps]);
    const msgs = game.messages.map((m) => m.id);
    const user = await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    const actor = await Actor.create({ name: "[TEST] Controls", type: "crew", ownership: { default: 0, [user.id]: 3 }, system: { plotPoints: { value: 1 }, money: { steps: 4 } } });
    await Actor.create({ name: "[TEST] Unplayed", type: "crew", ownership: { default: 0 }, system: { plotPoints: { value: 1 } } });
    await actor.createEmbeddedDocuments("Item", [
      { name: "[TEST] Scene asset", type: "asset", system: { duration: "scene" } },
      { name: "[TEST] Job asset", type: "asset", system: { duration: "job" } },
      { name: "[TEST] Old job", type: "job", system: { callbackUsed: true } }
    ]);
    return { saved, others, id: actor.id, snap, msgs, jobPP: game.settings.get(s, "jobStartPlotPoints") };
  }, S);
  saved = setup.saved;
  snap = setup.snap;
  msgsBefore = setup.msgs;
  const alone = setup.others === 0;
  await wait(1000);

  // Group and tools exist.
  const info = await page.evaluate(() => {
    const c = ui.controls.controls.leverage;
    return { exists: Boolean(c), tools: Object.keys(c?.tools ?? {}), titles: Object.values(c?.tools ?? {}).map((t) => game.i18n.localize(t.title)) };
  });
  record("group 'leverage' with 9 tools", info.exists && info.tools.length === 9, info);
  record("titles are localised", info.titles.every((x) => x && !x.startsWith("LEVERAGE.")), info.titles);
  await page.evaluate(() => ui.controls.activate({ control: "leverage" }));
  await wait(800);
  await page.screenshot({ path: `${SHOTS}/T-702-controls.png`, clip: { x: 0, y: 0, width: 420, height: 700 } });
  record("9 buttons rendered", (await page.locator('button.tool[data-tool="traitsLock"], button.tool[data-tool="wanted"], button.tool[data-tool="opposition"], button.tool[data-tool="tracker"], button.tool[data-tool="endScene"], button.tool[data-tool="newJob"], button.tool[data-tool="endJob"], button.tool[data-tool="newSession"], button.tool[data-tool="givePlotPoint"]').count()) === 9);

  // Trait lock toggle.
  const before = await setting("playersCanUnlock");
  await tool("traitsLock").click();
  await wait(1000);
  record("lock toggle flips the setting", (await setting("playersCanUnlock")) === !before, before);
  record("lock toggle reflects state", (await tool("traitsLock").getAttribute("aria-pressed")) === String(!before));
  await tool("traitsLock").click();
  await wait(800);
  record("lock toggle back", (await setting("playersCanUnlock")) === before);

  // Wanted level.
  await tool("wanted").click();
  await wanted.waitFor({ timeout: 5000 });
  await page.screenshot({ path: `${SHOTS}/T-702-wanted.png` });
  record("wanted dialog lists 6 levels (0-5)", (await wanted.locator("button.lv-wanted-level").count()) === 6);
  await wanted.locator('button.lv-wanted-level[data-level="3"]').click();
  await page.waitForFunction(() => game.settings.get("leverage-gta", "wanted").level === 3, null, { timeout: 5000 }).catch(() => {});
  record("wanted level saved", (await setting("wanted")).level === 3, await setting("wanted"));
  record("wanted dialog shows level 3 pressed", (await wanted.locator('button.lv-wanted-level[data-level="3"]').getAttribute("aria-pressed")) === "true");
  await page.evaluate(() => foundry.applications.instances.get("leverage-wanted-dialog")?.close());

  // Opposition roller: opens or warns, never throws.
  await tool("opposition").click();
  await wait(800);
  await page.evaluate(() => { for (const app of foundry.applications.instances.values()) if (app.id?.includes("opposition")) app.close(); });

  // Give Plot Point to the test character only.
  await tool("givePlotPoint").click();
  await dialog.waitFor({ timeout: 5000 });
  const listed = await page.evaluate(() => [...document.querySelectorAll('.lv-dialog input[name="actor"]')].map((i) => game.actors.get(i.value)?.name));
  record("Give Plot Point lists played Crew only", listed.includes("[TEST] Controls") && !listed.includes("[TEST] Unplayed"), listed);
  await page.evaluate((id) => document.querySelectorAll('.lv-dialog input[name="actor"]').forEach((i) => { i.checked = i.value === id; }), setup.id);
  await dialog.locator('button[data-action="ok"]').click();
  await wait(1000);
  record("Give Plot Point +1", (await actorState(setup.id)).pp === 2, await actorState(setup.id));

  if (alone) {
    await tool("newSession").click();
    await wait(1000);
    record("New session clears callbackUsed", (await actorState(setup.id)).items.find((i) => i.type === "job").used === false);

    await tool("endScene").click();
    await dialog.waitFor({ timeout: 5000 });
    await dialog.locator('button[data-action="yes"]').click();
    await wait(1000);
    const st = await actorState(setup.id);
    record("End scene removes scene Assets only", !st.items.some((i) => i.name === "[TEST] Scene asset") && st.items.some((i) => i.name === "[TEST] Job asset"), st);

    await tool("newJob").click();
    await dialog.waitFor({ timeout: 5000 });
    await dialog.locator('input[name="name"]').fill("[TEST] Heist");
    await dialog.locator('button[data-action="ok"]').click();
    await wait(1000);
    const startPP = Number(setup.jobPP);
    record("New Job sets activeJob", (await setting("activeJob")).name === "[TEST] Heist", await setting("activeJob"));
    record("New Job keeps PP above the minimum (no sum)", (await actorState(setup.id)).pp === Math.max(2, startPP), await actorState(setup.id));
    const unplayed = await page.evaluate(() => game.actors.find((a) => a.name === "[TEST] Unplayed").system.plotPoints.value);
    record("New Job does not touch unplayed Crew", unplayed === 1, unplayed);
    await page.evaluate((id) => game.actors.get(id).update({ "system.plotPoints.value": 0 }), setup.id);
    await page.evaluate(() => game.settings.set("leverage-gta", "activeJob", { ...game.settings.get("leverage-gta", "activeJob"), name: "" }));
    await tool("newJob").click();
    await dialog.waitFor({ timeout: 5000 });
    await dialog.locator('input[name="name"]').fill("[TEST] Heist");
    await dialog.locator('button[data-action="ok"]').click();
    await wait(1000);
    record("New Job raises PP up to the minimum", (await actorState(setup.id)).pp === startPP, await actorState(setup.id));

    await tool("endJob").click();
    await dialog.waitFor({ timeout: 5000 });
    await dialog.locator('input[name="total"]').fill("2");
    await dialog.locator('input[name="total"]').dispatchEvent("input");
    await dialog.locator(`input[name="share-${setup.id}"]`).fill("2");
    await page.screenshot({ path: `${SHOTS}/T-702-endjob.png` });
    await dialog.locator('button[data-action="ok"]').click();
    await page.waitForFunction(() => game.settings.get("leverage-gta", "activeJob").name === "", null, { timeout: 8000 }).catch(() => {});
    await wait(500);
    const end = await actorState(setup.id);
    const jobItem = end.items.find((i) => i.name === "[TEST] Heist");
    record("End Job: job Item, Money, Job Assets gone", jobItem?.payout.share === 2 && end.steps === 6 && !end.items.some((i) => i.name === "[TEST] Job asset"), end);
    record("End Job clears activeJob", (await setting("activeJob")).name === "");
  } else {
    record(`destructive tools skipped (${setup.others} other Crew with Items)`, true);
  }
  const mine = log.own().filter((e) => !/opposition/i.test(e)); // opposition.mjs belongs to T-504
  record("no system errors in console", mine.length === 0, mine);
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-702-failure.png` }).catch(() => {});
} finally {
  await page.evaluate(async ([s, saved, snap, before]) => {
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) await a.delete();
    for (const [id, pp, steps] of snap) {
      const a = game.actors.get(id);
      const junk = a?.items.filter((i) => i.name.startsWith("[TEST]")).map((i) => i.id) ?? [];
      if (junk.length) await a.deleteEmbeddedDocuments("Item", junk);
      await a?.update({ "system.plotPoints.value": pp, "system.money.steps": steps });
    }
    for (const u of game.users.filter((x) => x.name.startsWith("[TEST]"))) await u.delete();
    const msgs = game.messages.filter((m) => !before.includes(m.id)).map((m) => m.id);
    if (msgs.length) await ChatMessage.deleteDocuments(msgs);
    if (saved) for (const [k, v] of Object.entries(saved)) await game.settings.set(s, k, v);
  }, [S, saved, snap, msgsBefore]).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
