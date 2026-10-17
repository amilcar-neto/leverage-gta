/**
 * T-802 check: the Location sheet in the real Foundry. Creates a [TEST] Location with Traits, edits the city and the
 * Traits through the sheet, checks the opposition roller lists the Traits (a [TEST] Scene with a token), and that a
 * [TEST] Player (observer) sees no controls. Deletes every [TEST] document. Run after `npm run deploy`.
 * Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const wait = (ms) => page.waitForTimeout(ms);
const sheet = ".location-sheet.leverage-gta";
let playerBrowser = null;
let priorScene = null;

try {
  await login(page, env);
} catch (err) {
  console.log(`FOUNDRY: not available - ${err.message.split("\n")[0]}`);
  await browser.close();
  process.exit(2);
}

try {
  const id = await page.evaluate(async () => {
    const player = game.users.getName("[TEST] Player")
      ?? await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    const actor = await Actor.create({
      name: "[TEST] Docks", type: "location", ownership: { default: 0, [player.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
      system: { city: "liberty", traits: [{ name: "DARK CORNERS", die: 8 }, { name: "CROWDED", die: 6 }], notes: "<p>Smells of fish.</p>" }
    });
    await actor.sheet.render({ force: true });
    return actor.id;
  });
  const stored = (fn) => page.evaluate(fn, id);
  await page.locator(sheet).waitFor({ timeout: 8000 });
  await wait(600);
  record("two Trait rows", (await page.locator(`${sheet} .lv-loc-trait`).count()) === 2);
  record("each row has a 5-die ladder", (await page.locator(`${sheet} .lv-loc-trait:first-child .lv-loc-ladder .lv-die`).count()) === 5);
  record("city select has a blank plus the cities", (await page.locator(`${sheet} select[name="system.city"] option`).count()) >= 2);
  await page.screenshot({ path: `${SHOTS}/T-802-location.png` });

  await page.locator(`${sheet} select[name="system.city"]`).selectOption({ index: 0 });
  await wait(700);
  record("city can be cleared", await stored((i) => game.actors.get(i).system.city === ""));
  await page.locator(`${sheet} select[name="system.city"]`).selectOption({ index: 1 });
  await wait(700);
  record("city can be chosen", await stored((i) => game.actors.get(i).system.city !== ""));
  await page.locator(`${sheet} .lv-loc-trait:first-child [data-die="12"]`).click();
  await wait(700);
  record("clicking a die re-rates the Trait", await stored((i) => game.actors.get(i).system.traits[0].die === 12));
  await page.locator(`${sheet} [data-action="addTrait"]`).click();
  await wait(700);
  await page.keyboard.type("LOOSE BOARDS");
  await page.keyboard.press("Tab");
  await wait(700);
  record("+ ADD creates a focused row; typing names it", await stored((i) => game.actors.get(i).system.traits.at(-1)?.name === "LOOSE BOARDS"));
  await page.locator(`${sheet} .lv-loc-trait:nth-child(3) .lv-xbtn`).click();
  await wait(700);
  record("X removes a Trait", await stored((i) => game.actors.get(i).system.traits.length === 2));
  await stored((i) => game.actors.get(i).update({ "system.traits": [{ name: "CROWDED", die: 6 }, { name: "DARK CORNERS", die: 12 }] }));
  await wait(600);

  priorScene = await page.evaluate(() => game.scenes.current?.id ?? null);
  const roller = await page.evaluate(async (i) => {
    const scene = await foundry.documents.Scene.create({ name: "[TEST] Scene", width: 800, height: 600, grid: { size: 100 } });
    await scene.view();
    await scene.createEmbeddedDocuments("Token", [{ name: "[TEST] Docks", actorId: i, x: 100, y: 100 }]);
    const { openOppositionRoller } = await import(foundry.utils.getRoute("systems/leverage-gta/module/dice/opposition.mjs"));
    await openOppositionRoller();
    await new Promise((r) => setTimeout(r, 1200));
    const el = document.querySelector("#leverage-opposition-roller");
    return { keys: [...(el?.querySelectorAll('input[data-key^="loc."]') ?? [])].map((n) => n.dataset.key), text: el?.textContent ?? "" };
  }, id);
  record("opposition roller lists the Location Traits", roller.keys.length === 2 && roller.text.includes("DARK CORNERS"), roller);
  await page.evaluate(() => foundry.applications.instances.get("leverage-opposition-roller")?.close());

  playerBrowser = await openBrowser(env, { secondary: true });
  const pp = playerBrowser.page;
  const playerLog = collectConsole(pp);
  await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });
  await pp.evaluate(async () => game.actors.getName("[TEST] Docks").sheet.render({ force: true }));
  await pp.locator(sheet).waitFor({ timeout: 8000 });
  await pp.waitForTimeout(800);
  const view = await pp.evaluate((s) => {
    const el = document.querySelector(s);
    return {
      controls: el.querySelectorAll("input, select, button.lv-die, .lv-add-btn, .lv-xbtn, button.lv-loc-img, prose-mirror").length,
      rows: el.querySelectorAll(".lv-loc-trait").length, text: el.textContent.includes("DARK CORNERS")
    };
  }, sheet);
  record("observer sees the Traits but no controls", view.rows === 2 && view.controls === 0 && view.text, view);
  await pp.screenshot({ path: `${SHOTS}/T-802-location-observer.png` });
  record("no system errors in the player console", playerLog.own().length === 0, playerLog.own());
  record("no system errors in the GM console", log.own().length === 0, log.own());
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-802-failure.png` }).catch(() => {});
} finally {
  await playerBrowser?.browser.close().catch(() => {});
  await page.evaluate(async (prior) => {
    for (const app of foundry.applications.instances.values()) if (app.id?.includes("opposition")) await app.close();
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) { await a.sheet.close(); await a.delete(); }
    if (prior) await game.scenes.get(prior)?.view();
    for (const s of game.scenes.filter((x) => x.name.startsWith("[TEST]"))) await s.delete();
    for (const u of game.users.filter((x) => x.name.startsWith("[TEST]"))) await u.delete();
  }, priorScene).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
