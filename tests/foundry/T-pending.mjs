/**
 * Check of the "+ DIE" menu with the Scene Traits of the active Job, in the real Foundry. Creates only `[TEST]`
 * documents and restores `activeJob`. Run after `npm run deploy`. Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const wait = (ms) => page.waitForTimeout(ms);
const sheet = ".application.crew-sheet";
const SYSTEM = "leverage-gta";

try {
  await login(page, env);
} catch (err) {
  console.log(`FOUNDRY: not available - ${err.message.split("\n")[0]}`);
  await browser.close();
  process.exit(2);
}

let saved;
try {
  saved = await page.evaluate(() => game.settings.get("leverage-gta", "activeJob"));
  const id = await page.evaluate(async () => {
    const actor = await Actor.create({
      name: "[TEST] Scene", type: "crew",
      system: { attributes: { agility: { die: 10 } }, roles: { thief: { die: 10 } } }
    });
    await game.settings.set("leverage-gta", "activeJob", {
      name: "[TEST] Job", complications: [], sceneTraits: [{ id: "st1", name: "[TEST] Dark alley", die: 8 }]
    });
    await actor.sheet.render({ force: true });
    await new Promise((r) => setTimeout(r, 1500));
    return actor.id;
  });
  const items = () => page.evaluate((s) => [...document.querySelectorAll(`${s} .lv-pool-menu-item`)].map((el) => ({
    text: el.textContent.trim(), die: el.querySelector(".lv-die-num")?.textContent.trim(),
    color: getComputedStyle(el.querySelector(".lv-die")).getPropertyValue("--lv-die-color") || getComputedStyle(el.querySelector(".lv-die")).color
  })), sheet);
  const open = async () => { await page.click(`${sheet} [data-action="addDie"]`); await wait(300); };

  await open();
  let list = await items();
  record("menu lists the Scene Trait with name and die", list.some((i) => /Dark alley/.test(i.text) && i.die === "8"), list);
  const d8 = list.find((i) => i.text.endsWith("d8") && !/Dark/.test(i.text));
  const scene = list.find((i) => /Dark alley/.test(i.text));
  record("Scene Trait die has the colour of its die size", d8 && scene && d8.color === scene.color, { d8, scene });
  await page.screenshot({ path: `${SHOTS}/T-pending-menu.png` });

  // the Job changes while the sheet is open: the menu follows
  await page.keyboard.press("Escape");
  await page.evaluate(() => game.settings.set("leverage-gta", "activeJob", {
    name: "[TEST] Job", complications: [], sceneTraits: [{ id: "st2", name: "[TEST] Rooftop", die: 6 }]
  }));
  await wait(600);
  await open();
  list = await items();
  record("menu follows the active Job", list.some((i) => /Rooftop/.test(i.text) && i.die === "6") && !list.some((i) => /Dark alley/.test(i.text)), list);

  // picking it puts a chip in the Pool; a Job change drops it
  await page.locator(`${sheet} .lv-pool-menu-item`).filter({ hasText: /Rooftop/ }).click();
  await wait(400);
  const chip = () => page.locator(`${sheet} .lv-tray-chips .lv-chip[data-pool-ref="scene:st2"]`).count();
  record("Scene Trait chip is in the Pool", (await chip()) === 1);
  await page.evaluate(() => game.settings.set("leverage-gta", "activeJob", { name: "[TEST] Job", complications: [], sceneTraits: [] }));
  await wait(600);
  record("chip leaves the Pool when the Job drops the Trait", (await chip()) === 0);

  // roll with a Scene Trait through the sheet
  record("no system errors in console", log.own().length === 0, log.own());
  void id;
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-pending-failure.png` }).catch(() => {});
} finally {
  await page.evaluate(async ([saved, system]) => {
    if (saved) await game.settings.set(system, "activeJob", saved);
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) { await a.sheet.close(); await a.delete(); }
  }, [saved, SYSTEM]).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
