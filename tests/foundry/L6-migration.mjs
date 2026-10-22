/* global Scene */
/**
 * L-06 migration check (real Foundry): world migration 0.1.1 moves `activeJob.complications` and `activeJob.sceneTraits`
 * to the table settings, drops the per-Scene Trait flag, and is safe to run twice. Settings and Scene are restored.
 * Exit: 0 pass, 1 fail.
 */
import { requireEnv, openBrowser, collectConsole, login } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const S = "leverage-gta";
let saved = null;

try {
  await login(page, env);
  saved = await page.evaluate(async (s) => {
    const get = (k) => foundry.utils.deepClone(game.settings.get(s, k));
    const before = { job: get("activeJob"), traits: get("globalTraits"), complications: get("complications"), version: get("systemMigrationVersion") };
    const flag = (await import(foundry.utils.getRoute("systems/leverage-gta/module/config.mjs"))).LEVERAGE.legacySceneTraitsFlag;
    const scene = await Scene.create({ name: "[TEST] L6 Migration Scene" });
    await scene.setFlag(s, flag, [{ id: "ot1", name: "[TEST] old scene trait", die: 6 }, { id: "ot2", name: "[TEST] old 2", die: 8 }]);
    await game.settings.set(s, "globalTraits", [{ id: "keepT", name: "[TEST] kept trait", die: 6 }]);
    await game.settings.set(s, "complications", [{ id: "keepC", name: "[TEST] kept comp", die: 6 }]);
    await game.settings.set(s, "activeJob", {
      name: "[TEST] Old Job", goal: "[TEST] goal",
      complications: [{ id: "oc1", name: "[TEST] old comp", die: 8 }, { id: "keepC", name: "[TEST] dup", die: 6 }],
      sceneTraits: [{ id: "ost1", name: "[TEST] old job trait", die: 10 }]
    });
    return { ...before, scene: scene.id, flag };
  }, S);

  const run = () => page.evaluate(async ([s, scene, flag]) => {
    await game.settings.set(s, "systemMigrationVersion", "0.1.0");
    const { migrateWorld } = await import(foundry.utils.getRoute("systems/leverage-gta/module/migration.mjs"));
    const changed = await migrateWorld();
    const get = (k) => foundry.utils.deepClone(game.settings.get(s, k));
    return {
      changed, version: get("systemMigrationVersion"), system: game.system.version, job: get("activeJob"),
      traits: get("globalTraits").map((e) => e.id), complications: get("complications").map((e) => e.id),
      flag: game.scenes.get(scene).getFlag(s, flag) ?? null
    };
  }, [S, saved.scene, saved.flag]);

  const first = await run();
  const second = await run();
  console.log("activeJob after migration:", JSON.stringify(first.job));
  for (const [label, r] of [["first", first], ["second", second]]) {
    record(`${label} run: version is the system version`, r.version === r.system, r);
    record(`${label} run: Traits joined without duplicates`, JSON.stringify(r.traits) === JSON.stringify(["keepT", "ost1"]), r.traits);
    record(`${label} run: Complications joined without duplicates`, JSON.stringify(r.complications) === JSON.stringify(["keepC", "oc1"]), r.complications);
    record(`${label} run: scene flag removed`, r.flag === null, r.flag);
    record(`${label} run: activeJob keeps only name and goal`, JSON.stringify(Object.keys(r.job).sort()) === JSON.stringify(["goal", "name"]), r.job);
  }
  record("no system console errors", log.own().length === 0, log.own());
} catch (error) {
  record("script", false, String(error).slice(0, 600));
} finally {
  try {
    await page.evaluate(async ([s, before]) => {
      if (before) {
        await game.settings.set(s, "activeJob", before.job);
        await game.settings.set(s, "globalTraits", before.traits);
        await game.settings.set(s, "complications", before.complications);
        await game.settings.set(s, "systemMigrationVersion", before.version);
        await game.scenes.get(before.scene)?.delete();
      }
    }, [S, saved]);
  } catch (error) { console.log("cleanup failed", String(error).slice(0, 200)); }
  await browser.close();
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail.slice(0, 500)}` : ""}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
