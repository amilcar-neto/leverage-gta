/**
 * T-801 check: NPC sheet in the real Foundry. Creates one `[TEST]` NPC of each tier, edits fields, adds and removes a
 * Trait, loads the opposition roller from ROLL AS OPPOSITION and from a Trait die, and checks that an observer sees no
 * controls. Deletes every `[TEST]` document it made. Run after `npm run deploy`.
 * Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const wait = (ms) => page.waitForTimeout(ms);
let playerBrowser = null;

const npcState = (name) => page.evaluate((n) => {
  const a = game.actors.getName(n);
  return { tier: a.system.tier, traits: a.system.traits.map((t) => [t.name, t.die]), gang: [a.system.gang.size, a.system.gang.die], weapon: a.system.weapon.die, police: a.system.police, vest: [a.system.vest.kind, a.system.vest.value], life: a.system.life.value };
}, name);

/** Measures the open sheet of `name` (either page). */
async function measure(name) {
  const actor = game.actors.getName(name);
  if (!actor.sheet.rendered) await actor.sheet.render({ force: true });
  await new Promise((r) => setTimeout(r, 1200));
  const el = actor.sheet.element;
  const count = (s) => el.querySelectorAll(s).length;
  const box = (s) => { const r = el.querySelector(s)?.getBoundingClientRect(); return r ? { w: Math.round(r.width), h: Math.round(r.height) } : null; };
  return {
    inputs: count(".window-content :is(input:not([disabled]), select, button[data-action]:not([disabled]), prose-mirror, .lv-add-btn, .lv-xbtn)"),
    addButtons: count(".lv-add-btn"), xButtons: count(".lv-xbtn"), ladderButtons: count(".lv-ladder button"),
    roll: count('[data-action="rollAsOpposition"]'), ladders: count(".lv-npc-ladders:not(.is-empty)"),
    traits: count(".lv-npc-trait"), size: box(".window-content"), names: [...el.querySelectorAll(".lv-npc-trait-name")].map((n) => n.value ?? n.textContent.trim())
  };
}

try {
  await login(page, env);
} catch (err) {
  console.log(`FOUNDRY: not available - ${err.message.split("\n")[0]}`);
  await browser.close();
  process.exit(2);
}

try {
  const ids = await page.evaluate(async () => {
    const player = game.users.getName("[TEST] Player")
      ?? await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    const out = {};
    for (const tier of ["extra", "foil", "mark", "agent"]) {
      const a = await Actor.create({
        name: `[TEST] ${tier}`, type: "npc",
        ownership: { default: 0, [player.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
        system: { tier, traits: [{ name: "Tough", die: 8 }, { name: "Armed", die: 6 }], gang: { size: 3, die: 6 }, weapon: { die: 10 }, notes: "<p>Careful.</p>" }
      });
      out[tier] = a.id;
    }
    await game.actors.getName("[TEST] foil").update({ "system.attributes.agility.die": 8, "system.roles.hitter.die": 10 });
    return out;
  });

  // Sheet class and layout per tier.
  const layouts = {};
  for (const tier of ["extra", "foil", "mark", "agent"]) {
    layouts[tier] = await page.evaluate(measure, `[TEST] ${tier}`);
    await page.evaluate((t) => game.actors.getName(`[TEST] ${t}`).sheet.close(), tier);
  }
  const sheetClass = await page.evaluate(() => game.actors.getName("[TEST] extra").sheet.constructor.name);
  record("NpcSheet is the default sheet of npc", sheetClass === "NpcSheet", sheetClass);
  record("every tier opens with 2 Traits", Object.values(layouts).every((l) => l.traits === 2), layouts);
  record("Attributes/Roles only for Foil and Agent", layouts.extra.ladders === 0 && layouts.mark.ladders === 0 && layouts.foil.ladders === 1 && layouts.agent.ladders === 1, layouts);
  record("GM sees ROLL AS OPPOSITION", layouts.extra.roll === 1, layouts.extra);

  // Edit fields on the Foil.
  await page.evaluate(() => game.actors.getName("[TEST] foil").sheet.render({ force: true }));
  await wait(1000);
  const sheet = page.locator(".npc-sheet").first();
  await page.screenshot({ path: `${SHOTS}/T-801-npc.png` });

  await sheet.locator('input[name="system.gang.size"]').fill("5");
  await sheet.locator('input[name="system.gang.size"]').dispatchEvent("change");
  await wait(700);
  await sheet.locator('.lv-npc-gang [data-die="12"]').click();
  await wait(700);
  await sheet.locator('.lv-npc-weapon [data-die="10"]').click(); // current die: clears it
  await wait(700);
  await sheet.locator('[data-action="togglePolice"]').click();
  await wait(700);
  await sheet.locator('select[name="system.tier"]').selectOption("agent");
  await wait(900);
  await sheet.locator('select[data-vest-kind]').selectOption("light");
  await wait(900);
  await sheet.locator('.lv-npc-ladders [data-key="strength"] [data-die="6"]').click();
  await wait(700);
  const edited = await npcState("[TEST] foil");
  record("gang size and die saved", edited.gang[0] === 5 && edited.gang[1] === 12, edited);
  record("clicking the current weapon die clears it", edited.weapon === null, edited);
  record("police toggle and tier saved", edited.police === true && edited.tier === "agent", edited);
  record("vest kind gives a full vest", edited.vest[0] === "light" && edited.vest[1] === 4, edited);
  const str = await page.evaluate(() => game.actors.getName("[TEST] foil").system.attributes.strength.die);
  record("Attribute ladder writes the die", str === 6, str);

  // Traits: rename, step, add, remove.
  const first = sheet.locator('.lv-npc-trait[data-index="0"]');
  await first.locator("[data-trait-name]").fill("Bodyguard");
  await first.locator("[data-trait-name]").dispatchEvent("change");
  await wait(800);
  await sheet.locator('.lv-npc-trait[data-index="0"] [data-delta="1"]').click();
  await wait(800);
  await sheet.locator('.lv-npc-traits [data-action="addTrait"]').click();
  await wait(800);
  let state = await npcState("[TEST] foil");
  record("Trait renamed, die stepped up, Trait added", state.traits.length === 3 && state.traits[0][0] === "Bodyguard" && state.traits[0][1] === 10, state);
  await sheet.locator('.lv-npc-trait[data-index="2"] .lv-xbtn').click();
  await wait(800);
  state = await npcState("[TEST] foil");
  record("X removes the Trait", state.traits.length === 2 && state.traits[1][0] === "Armed", state);

  // Life and Vest numbers.
  await sheet.locator('input[name="system.life.value"]').fill("3");
  await sheet.locator('input[name="system.life.value"]').dispatchEvent("change");
  await wait(800);
  record("life value saved", (await npcState("[TEST] foil")).life === 3);

  // Opposition roller.
  await sheet.locator('.lv-npc-trait[data-index="1"] [data-action="pickTraitDie"]').click();
  await page.waitForSelector("#leverage-opposition-roller", { timeout: 5000 });
  await wait(700);
  const oneDie = await page.evaluate(() => ({
    npc: document.querySelector("#leverage-opposition-roller .lv-opp-npc, #leverage-opposition-roller")?.textContent.includes("[TEST] foil"),
    checked: document.querySelectorAll('#leverage-opposition-roller input[type="checkbox"][data-action="toggle"]:checked').length
  }));
  record("a Trait die goes to the roller (only that one picked)", oneDie.npc && oneDie.checked === 1, oneDie);
  await page.evaluate(() => { for (const app of foundry.applications.instances.values()) if (app.id?.includes("opposition")) app.close(); });
  await wait(500);
  await sheet.locator('[data-action="rollAsOpposition"]').click();
  await page.waitForSelector("#leverage-opposition-roller", { timeout: 5000 });
  await wait(900);
  const loaded = await page.evaluate(() => {
    const root = document.querySelector("#leverage-opposition-roller");
    return {
      npc: root.textContent.includes("[TEST] foil"),
      checked: root.querySelectorAll('input[type="checkbox"][data-action="toggle"]:checked').length,
      pool: root.querySelector(".lv-opp-pool, [class*='pool']")?.textContent.replace(/\s+/g, " ").trim()
    };
  });
  record("ROLL AS OPPOSITION loads the NPC dice and gang", loaded.npc && loaded.checked >= 4, loaded);
  await page.screenshot({ path: `${SHOTS}/T-801-roller.png` });
  await page.evaluate(() => { for (const app of foundry.applications.instances.values()) if (app.id?.includes("opposition")) app.close(); });

  // Observer sees no controls.
  playerBrowser = await openBrowser(env, { secondary: true });
  const pp = playerBrowser.page;
  const playerLog = collectConsole(pp);
  await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });
  const seen = await pp.evaluate(measure, "[TEST] foil");
  record("observer sees the sheet with Traits", seen.traits === 2, seen);
  record("observer: no + ADD, X, ladder buttons or ROLL", seen.addButtons === 0 && seen.xButtons === 0 && seen.ladderButtons === 0 && seen.roll === 0, seen);
  record("observer: no editable fields", seen.inputs === 0, seen);
  await pp.screenshot({ path: `${SHOTS}/T-801-observer.png` });
  record("no system errors in the player console", playerLog.own().length === 0, playerLog.own());
  record("no system errors in the GM console", log.own().length === 0, log.own());
  void ids;
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-801-failure.png` }).catch(() => {});
} finally {
  await playerBrowser?.browser.close().catch(() => {});
  await page.evaluate(async () => {
    for (const app of foundry.applications.instances.values()) if (app.id?.includes("opposition")) await app.close();
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) { await a.sheet.close(); await a.delete(); }
    for (const u of game.users.filter((x) => x.name.startsWith("[TEST]"))) await u.delete();
  }).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
