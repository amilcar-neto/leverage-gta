/**
 * T-703 check: Job Tracker in the real Foundry. Opens it as GM, edits the Job name, adds / raises / removes a
 * Complication and a scene Trait, edits PP and Life of a [TEST] crew actor, takes a screenshot, then restores
 * `activeJob` and deletes the [TEST] actor. Run after `npm run deploy`. Exit codes: 0 pass, 1 fail.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const wait = (ms) => page.waitForTimeout(ms);
const app = "#leverage-job-tracker";
const job = () => page.evaluate(() => game.settings.get("leverage-gta", "activeJob"));
const complications = () => page.evaluate(() => game.settings.get("leverage-gta", "complications"));
let saved = null;
let actorId = null;

try {
  await login(page, env);
  const setup = await page.evaluate(async () => {
    const s = { job: foundry.utils.deepClone(game.settings.get("leverage-gta", "activeJob")), complications: foundry.utils.deepClone(game.settings.get("leverage-gta", "complications")) };
    await game.settings.set("leverage-gta", "activeJob", { name: "[TEST] Job", goal: "" });
    await game.settings.set("leverage-gta", "complications", []);
    const actor = await Actor.create({ name: "[TEST] Crew", type: "crew", ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER } });
    const { JobTracker } = await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/gm/job-tracker.mjs"));
    await new JobTracker().render({ force: true });
    return { s, id: actor.id };
  });
  saved = setup.s;
  actorId = setup.id;
  await page.locator(app).waitFor({ timeout: 8000 });
  await wait(500);
  record("window has the system root class", await page.locator(`${app}.leverage-gta .window-title`).count() === 1);
  record("Job name shown", await page.locator(`${app} [name="jobName"]`).inputValue() === "[TEST] Job");

  await page.locator(`${app} [name="jobName"]`).fill("[TEST] Renamed");
  await page.locator(`${app} [name="jobName"]`).blur();
  await wait(500);
  record("Job name saved", (await job()).name === "[TEST] Renamed", await job());

  await page.locator(`${app} [data-new-name]`).fill("[TEST] Alarm");
  await page.locator(`${app} [data-action="add"]`).click();
  await wait(500);
  let j = await complications();
  record("Complication added as d6", j.length === 1 && j[0].die === 6, j);
  await page.locator(`${app} [data-action="step"][data-delta="1"]`).click();
  await wait(500);
  record("Complication raised to d8", (await complications())[0].die === 8, await complications());
  await page.locator(`${app} [data-action="step"][data-delta="-1"]`).click();
  await wait(500);
  record("Complication lowered to d6", (await complications())[0].die === 6, await complications());

  await page.locator(`${app} [data-new-name]`).fill("[TEST] Fog");
  await page.locator(`${app} [data-new-name]`).press("Enter");
  await wait(500);
  j = await complications();
  record("second Complication added with Enter", j.length === 2 && j[1].name === "[TEST] Fog", j);

  const row = `${app} [data-actor-id="${actorId}"]`;
  const pp0 = await page.evaluate((id) => game.actors.get(id).system.plotPoints.value, actorId);
  await page.locator(`${row} [data-action="adjust"][data-field="pp"][data-delta="1"]`).click();
  await wait(500);
  record("PP +1 on the actor", await page.evaluate((id) => game.actors.get(id).system.plotPoints.value, actorId) === pp0 + 1);
  record("PP shown in the tracker (re-rendered)", (await page.locator(`${row} .lv-trk-value--pp`).textContent()).trim() === String(pp0 + 1));
  await page.locator(`${row} [data-action="adjust"][data-field="life"][data-delta="-1"]`).click();
  await wait(500);
  const life = await page.evaluate((id) => {
    const l = game.actors.get(id).system.life;
    return [l.value, l.max];
  }, actorId);
  record("Life -1 on the actor", life[0] === life[1] - 1, life);
  await page.locator(`${row} [data-action="adjust"][data-field="money"][data-delta="1"]`).click();
  await wait(500);

  await page.locator(app).screenshot({ path: `${SHOTS}/T-703-tracker.png` });
  const overflow = await page.evaluate((sel) => {
    const root = document.querySelector(sel);
    return [...root.querySelectorAll("button")].some((n) => n.scrollWidth > n.clientWidth + 1);
  }, app);
  record("no button overflows", !overflow);

  await page.locator(`${app} [data-action="remove"]`).first().click();
  await wait(300);
  await page.locator(`${app} [data-action="remove"]`).first().click();
  await wait(500);
  j = await complications();
  record("Complications removed", j.length === 0, j);
  record("no system errors in console", log.own().length === 0, log.own());
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-703-failure.png` }).catch(() => {});
} finally {
  await page.evaluate(async ([s, id]) => {
    foundry.applications.instances.get("leverage-job-tracker")?.close();
    if (s) {
      await game.settings.set("leverage-gta", "activeJob", s.job);
      await game.settings.set("leverage-gta", "complications", s.complications);
    }
    if (id) await game.actors.get(id)?.delete();
  }, [saved, actorId]).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
