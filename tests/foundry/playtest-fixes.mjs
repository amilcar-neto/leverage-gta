/**
 * Check of the playtest fixes: blank Asset name keeps the dialog open with a warning; a minimized Crew sheet shows
 * the character name; End Job names do not overlap the number boxes; the Job goal shows in the Tracker, the Scene
 * Panel and the Job sheet; the singular "kept" text exists. Restores the active Job. Exit: 0 pass, 1 fail.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
let ids = null;
let oldJob = null;

try {
  await login(page, env);
  ids = await page.evaluate(async () => {
    const crew = await Actor.create({ name: "[TEST] Marco \"Bruto\" Silva da Costa Albuquerque Junior", type: "crew" });
    return { crew: crew.id };
  });
  oldJob = await page.evaluate(() => foundry.utils.deepClone(game.settings.get("leverage-gta", "activeJob")));

  // 1. Blank Asset name
  await page.evaluate((id) => game.actors.get(id).sheet.render(true), ids.crew);
  await page.waitForTimeout(1500);
  const before = await page.evaluate((id) => game.actors.get(id).items.size, ids.crew);
  await page.locator(".crew-sheet [data-action=addAsset]").click();
  await page.locator(".lv-dialog form").waitFor({ timeout: 5000 });
  await page.locator('.lv-dialog button[data-action="ok"]').click();
  await page.waitForTimeout(800);
  record("blank Asset name: dialog stays open", await page.locator(".lv-dialog form").count() === 1);
  record("blank Asset name: warning shown", await page.locator("#notifications .notification.warning, .notification.warning").count() > 0);
  await page.screenshot({ path: `${SHOTS}/FIX-asset-blank.png` });
  await page.locator('.lv-dialog input[name="name"]').fill("[TEST] Crowbar");
  await page.locator('.lv-dialog button[data-action="ok"]').click();
  await page.waitForTimeout(1200);
  record("named Asset is created", await page.evaluate((id) => game.actors.get(id).items.size, ids.crew) === before + 1);
  await page.evaluate((id) => game.actors.get(id).items.contents.forEach((i) => i.delete()), ids.crew);

  // 2. Minimized title
  await page.evaluate((id) => game.actors.get(id).sheet.minimize(), ids.crew);
  await page.waitForTimeout(1500);
  const title = await page.evaluate((id) => {
    const el = game.actors.get(id).sheet.element.querySelector(".window-title");
    const r = el.getBoundingClientRect();
    return { w: r.width, text: el.textContent, visible: el.scrollWidth > 0 };
  }, ids.crew);
  record("minimized title has room and the name", title.w >= 50 && title.text.includes("MARCO"), title);
  await page.screenshot({ path: `${SHOTS}/FIX-minimized.png`, clip: { x: 0, y: 0, width: 1000, height: 300 } });
  await page.evaluate((id) => game.actors.get(id).sheet.maximize(), ids.crew);
  await page.evaluate((id) => game.actors.get(id).sheet.close(), ids.crew);

  // Goal + End Job dialog
  await page.evaluate(() => game.settings.set("leverage-gta", "activeJob", { name: "[TEST] Job", goal: "[TEST] Get the ledger" }));
  await page.waitForTimeout(800);
  await page.evaluate(() => { ui.controls.controls.leverage.tools.endJob.onChange(); });
  await page.locator(".lv-dialog form").waitFor({ timeout: 5000 });
  await page.waitForTimeout(500);
  const rows = await page.evaluate(() => [...document.querySelectorAll(".lv-dlg-share-row")].map((row) => {
    const n = row.querySelector(".lv-dlg-option-name").getBoundingClientRect();
    const i = row.querySelector(".lv-dlg-share").getBoundingClientRect();
    return { nameRight: n.right, inputLeft: i.left, nameH: n.height, rowH: row.getBoundingClientRect().height };
  }));
  record("End Job: name does not overlap the box, one line", rows.length > 0 && rows.every((r) => r.nameRight <= r.inputLeft + 0.5 && r.nameH < 30), rows);
  await page.screenshot({ path: `${SHOTS}/FIX-end-job.png` });
  await page.locator('.lv-dialog input[name="name"]').fill("");
  await page.locator('.lv-dialog button[data-action="ok"]').click();
  await page.waitForTimeout(600);
  record("End Job blank name: dialog stays open and nothing changed", await page.locator(".lv-dialog form").count() === 1
    && await page.evaluate(() => game.settings.get("leverage-gta", "activeJob").name === "[TEST] Job"));
  await page.locator(".lv-dialog .header-control[data-action=close]").click();
  await page.waitForTimeout(500);

  // Goal in Tracker, Scene Panel and Job sheet
  await page.evaluate(() => game.leverage.jobTracker.open());
  await page.locator("[name=jobGoal]").waitFor({ timeout: 5000 });
  record("Tracker shows the goal", await page.locator("[name=jobGoal]").inputValue() === "[TEST] Get the ledger");
  await page.screenshot({ path: `${SHOTS}/FIX-tracker-goal.png` });
  const panel = await page.evaluate(() => document.querySelector("#leverage-scene-panel")?.textContent ?? "");
  record("Scene Panel shows the goal", panel.includes("[TEST] Get the ledger"), panel.slice(0, 200));
  const sheetOk = await page.evaluate(async (id) => {
    const [item] = await game.actors.get(id).createEmbeddedDocuments("Item", [{ name: "[TEST] Old Job", type: "job", system: { goal: "[TEST] Goal here" } }]);
    await item.sheet.render(true);
    await new Promise((r) => setTimeout(r, 1200));
    return item.sheet.element.querySelector("[name='system.goal']")?.value;
  }, ids.crew);
  record("Job sheet shows the goal field", sheetOk === "[TEST] Goal here", sheetOk);
  await page.screenshot({ path: `${SHOTS}/FIX-job-sheet.png` });
  record("singular kept text exists", await page.evaluate(() => game.i18n.localize("LEVERAGE.Roll.explainOne") !== "LEVERAGE.Roll.explainOne"));
} catch (error) {
  record("script ran without exceptions", false, String(error?.stack ?? error));
} finally {
  await page.evaluate(async (args) => {
    if (args.oldJob) await game.settings.set("leverage-gta", "activeJob", args.oldJob);
    for (const app of foundry.applications.instances.values()) if (app.id?.includes("tracker") || app.document?.name?.startsWith("[TEST]")) await app.close();
    await game.actors.get(args.ids?.crew)?.delete();
  }, { oldJob, ids }).catch(() => {});
  record("no own console errors", log.own().length === 0, log.own());
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
  await browser.close();
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}
