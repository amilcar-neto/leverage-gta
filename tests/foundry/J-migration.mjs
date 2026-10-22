/**
 * J-05 check (real Foundry): world migration 0.1.2 turns the `activeJob` setting into an active world Job Item that
 * every player can see (ownership OBSERVER), clears the setting, and is safe to run twice. Also checks a world
 * without an active Job (nothing created) and, with a player browser, that the player reads the Job. Only `[TEST]`
 * data; the setting, the stored version and the Jobs are restored. Exit: 0 pass, 1 fail, 2 n/a.
 */
import { requireEnv, openBrowser, collectConsole, login } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const S = "leverage-gta";
let saved = null;
let playerBrowser = null;
let playerLog = null;

try {
  await login(page, env);
  saved = await page.evaluate((s) => ({
    job: foundry.utils.deepClone(game.settings.get(s, "activeJob")), jobs: lvTestJob.snapshot(), version: game.settings.get(s, "systemMigrationVersion")
  }), S);

  const run = (activeJob) => page.evaluate(async ([s, setting]) => {
    await lvTestJob.set({});
    await game.settings.set(s, "activeJob", setting);
    await game.settings.set(s, "systemMigrationVersion", "0.1.1");
    const { migrateWorld } = await import(foundry.utils.getRoute("systems/leverage-gta/module/migration.mjs"));
    const changed = await migrateWorld();
    const jobs = game.items.filter((i) => i.type === "job" && !i.parent && i.name.startsWith("[TEST]"));
    return {
      changed, version: game.settings.get(s, "systemMigrationVersion"), system: game.system.version,
      setting: foundry.utils.deepClone(game.settings.get(s, "activeJob")), active: lvTestJob.get(),
      count: jobs.length, statuses: jobs.map((j) => j.system.status), goal: jobs[0]?.system.goal ?? null,
      observer: jobs[0]?.ownership.default === CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER
    };
  }, [S, activeJob]);

  const first = await run({ name: "[TEST] Old Job", goal: "[TEST] old goal" });
  record("first run: version is the system version", first.version === first.system && first.changed, first);
  record("first run: one active world Job with the old goal", first.count === 1 && first.statuses[0] === "active" && first.goal === "[TEST] old goal", first);
  record("first run: the Job is visible to players (OBSERVER)", first.observer, first);
  record("first run: the setting is cleared and the API reads the Job", first.setting.name === "" && first.active.name === "[TEST] Old Job", first);

  // second run on the already migrated world: nothing new
  const second = await page.evaluate(async (s) => {
    await game.settings.set(s, "systemMigrationVersion", "0.1.1");
    const { migrateWorld } = await import(foundry.utils.getRoute("systems/leverage-gta/module/migration.mjs"));
    await migrateWorld();
    return game.items.filter((i) => i.type === "job" && !i.parent && i.name.startsWith("[TEST]")).length;
  }, S);
  record("second run creates nothing", second === 1, second);

  // player reads it
  playerBrowser = await openBrowser(env, { secondary: true });
  const pp = playerBrowser.page;
  playerLog = collectConsole(pp);
  const playerUser = await page.evaluate(async () => {
    let user = game.users.find((u) => u.name === "[TEST] Player");
    const created = !user;
    user ??= await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    return { id: user.id, created };
  });
  await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });
  await pp.waitForTimeout(1500);
  const seen = await pp.evaluate(() => ({ job: game.leverage.job.get(), owner: game.items.find((i) => i.name === "[TEST] Old Job")?.isOwner ?? null }));
  record("player reads name and goal through game.leverage.job.get()", seen.job.name === "[TEST] Old Job" && seen.job.goal === "[TEST] old goal", seen);
  record("player does not own the Job", seen.owner === false, seen);
  const panelText = await pp.locator("#leverage-scene-panel").innerText().catch(() => "");
  record("player's scene panel shows the goal", /old goal/i.test(panelText), panelText);
  const live = async () => {
    await page.evaluate(() => game.items.find((i) => i.name === "[TEST] Old Job").update({ "system.goal": "[TEST] new goal" }));
    await pp.waitForTimeout(1200);
    return pp.evaluate(() => game.leverage.job.get().goal);
  };
  record("player sees a goal change live", (await live()) === "[TEST] new goal");
  const edit = await pp.evaluate(async () => {
    try { await game.items.find((i) => i.name === "[TEST] Old Job").update({ "system.goal": "x" }); return "allowed"; } catch { return "refused"; }
  });
  record("player cannot edit the Job", edit === "refused", edit);
  await page.evaluate(async (u) => { if (u.created) await game.users.get(u.id)?.delete(); }, playerUser);

  await page.evaluate(() => Item.deleteDocuments(game.items.filter((i) => i.type === "job" && !i.parent && i.name.startsWith("[TEST]")).map((i) => i.id)));
  const empty = await run({ name: "", goal: "" });
  record("an empty setting creates no Job", empty.count === 0 && empty.setting.name === "", empty);
  record("no system console errors", log.own().length === 0 && playerLog.own().length === 0, [...log.own(), ...playerLog.own()]);
} catch (error) {
  record("script", false, String(error).slice(0, 600));
} finally {
  try {
    await page.evaluate(async ([s, before]) => {
      if (!before) return;
      await game.settings.set(s, "activeJob", before.job);
      await lvTestJob.restore(before.jobs);
      await game.settings.set(s, "systemMigrationVersion", before.version);
    }, [S, saved]);
  } catch (error) { console.log("cleanup failed", String(error).slice(0, 200)); }
  await playerBrowser?.browser.close();
  await browser.close();
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail.slice(0, 500)}` : ""}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
