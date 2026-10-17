/**
 * T-505 check: runs every example of docs/macros.md in the real Foundry, as the Fixer (GM) and, where the marker says
 * so, as a [TEST] Player, and checks the effects. A block is marked `<!-- teste: gm|jogador|ambos id=... -->` right
 * before its ```js fence; "Nome da Personagem" is replaced by a [TEST] actor. Everything it creates is [TEST]; it
 * restores the settings, the Crew data (Plot Points, Money, Items) and deletes the chat messages it caused.
 * Run after `npm run deploy`. Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { readFileSync } from "node:fs";
import { requireEnv, openBrowser, collectConsole, login } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const wait = (ms) => page.waitForTimeout(ms);
let playerBrowser = null;
let saved = null;

/* ------------------------------------------------------------ the examples of the docs */

const doc = readFileSync("docs/macros.md", "utf8").replace(/\r\n/g, "\n");
const blocks = {};
for (const m of doc.matchAll(/<!-- teste: (gm|jogador|ambos) id=([\w-]+) -->\n```js\n([\s\S]*?)```/g)) {
  blocks[m[2]] = {
    who: m[1],
    code: m[3].replaceAll("Nome de Outra Personagem", "[TEST] Other").replaceAll("Nome da Personagem", "[TEST] Macro")
  };
}
const fences = [...doc.matchAll(/^```js$/gm)].length;
record("every js block of docs/macros.md has a test marker", fences === Object.keys(blocks).length && fences > 0, { fences, marked: Object.keys(blocks).length });

/* ------------------------------------------------------------ page-side helpers */

/** Runs one example; returns the warnings shown and the console.log lines (as JSON). */
async function runBlock(p, code) {
  return p.evaluate(async (source) => {
    const warns = [];
    const logs = [];
    const realWarn = ui.notifications.warn;
    const realLog = console.log;
    ui.notifications.warn = (m) => { warns.push(String(m)); };
    console.log = (...args) => { logs.push(JSON.stringify(args)); };
    let error = null;
    try {
      const AsyncFunction = Object.getPrototypeOf(async function noop() {}).constructor;
      await new AsyncFunction(source)();
    } catch (err) {
      error = String(err?.message ?? err);
    } finally {
      ui.notifications.warn = realWarn;
      console.log = realLog;
    }
    return { warns, logs, error };
  }, code);
}

/** GM page: the state the checks read. */
const peek = () => page.evaluate(() => {
  const a = game.actors.getName("[TEST] Macro");
  const o = game.actors.getName("[TEST] Other");
  return { pp: a.system.plotPoints.value, steps: a.system.money.steps, otherSteps: o.system.money.steps };
});

/** GM page: chat messages not seen before `known`, with their roll flags. */
const newRolls = (known) => page.evaluate((ids) => game.messages.contents.filter((m) => !ids.includes(m.id)).map((m) => ({
  id: m.id, flags: m.getFlag("leverage-gta", "roll") ?? null, dice: m.rolls[0]?.dice.length ?? 0
})), known);
const messageIds = () => page.evaluate(() => game.messages.contents.map((m) => m.id));

/** GM page: puts the test actors in a known state. */
const reset = (steps = 4, pp = 1, other = 0) => page.evaluate(async ([s, p, o]) => {
  await game.actors.getName("[TEST] Macro").update({ "system.money.steps": s, "system.plotPoints.value": p });
  await game.actors.getName("[TEST] Other").update({ "system.money.steps": o });
}, [steps, pp, other]);

async function prepare() {
  const player = game.users.getName("[TEST] Player")
    ?? await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
  const dice = { attributes: {}, roles: {} };
  for (const k of Object.keys(CONFIG.LEVERAGE.attributes)) dice.attributes[k] = { die: 8 };
  for (const k of Object.keys(CONFIG.LEVERAGE.roles)) dice.roles[k] = { die: 8 };
  const owner = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  const actor = await Actor.create({
    name: "[TEST] Macro", type: "crew", system: { ...dice, plotPoints: { value: 1 }, money: { steps: 4 } },
    ownership: { default: 0, [player.id]: owner }
  });
  await Actor.create({
    name: "[TEST] Other", type: "crew", system: { money: { steps: 0 } },
    ownership: { default: 0, [player.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER }
  });
  await actor.createEmbeddedDocuments("Item", [
    { name: "[TEST] Spec", type: "specialty", system: { role: "thief" } },
    { name: "[TEST] Dist", type: "distinction" },
    { name: "[TEST] Scene asset", type: "asset", system: { duration: "scene" } }
  ]);
}

/** Snapshot of what the Fixer tools touch on every real Crew character, the settings and the chat. */
const snapshot = () => page.evaluate(() => ({
  settings: Object.fromEntries(["wanted", "activeJob", "traitsLocked"].map((k) => [k, foundry.utils.deepClone(game.settings.get("leverage-gta", k))])),
  crew: game.actors.filter((a) => a.type === "crew" && !a.name.startsWith("[TEST]")).map((a) => ({
    id: a.id, pp: a.system.plotPoints.value, steps: a.system.money.steps, items: a.items.map((i) => i.toObject())
  })),
  messages: game.messages.contents.map((m) => m.id)
}));

/** Puts the snapshot back and deletes every [TEST] document and the messages created since. */
async function restore(snap) {
  await page.evaluate(async (s) => {
    for (const [k, v] of Object.entries(s.settings)) await game.settings.set("leverage-gta", k, v);
    for (const c of s.crew) {
      const actor = game.actors.get(c.id);
      if (!actor) continue;
      const keep = new Set(c.items.map((i) => i._id));
      const extra = actor.items.filter((i) => !keep.has(i.id)).map((i) => i.id);
      if (extra.length) await actor.deleteEmbeddedDocuments("Item", extra);
      const missing = c.items.filter((i) => !actor.items.has(i._id));
      if (missing.length) await actor.createEmbeddedDocuments("Item", missing, { keepId: true });
      const changed = c.items.filter((i) => actor.items.get(i._id)?.system.callbackUsed !== i.system.callbackUsed)
        .map((i) => ({ _id: i._id, "system.callbackUsed": i.system.callbackUsed }));
      if (changed.length) await actor.updateEmbeddedDocuments("Item", changed);
      await actor.update({ "system.plotPoints.value": c.pp, "system.money.steps": c.steps });
    }
    const ids = game.messages.contents.map((m) => m.id).filter((id) => !s.messages.includes(id));
    if (ids.length) await ChatMessage.deleteDocuments(ids);
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) { await a.sheet?.close(); await a.delete(); }
    for (const u of game.users.filter((x) => x.name.startsWith("[TEST]"))) await u.delete();
    for (const m of game.macros.filter((x) => x.name.startsWith("[TEST]"))) await m.delete();
    foundry.applications.instances.get("leverage-opposition-roller")?.close();
  }, snap);
}

/* ------------------------------------------------------------ run */

try {
  await login(page, env);
} catch (err) {
  console.log(`FOUNDRY: not available - ${err.message.split("\n")[0]}`);
  await browser.close();
  process.exit(2);
}

try {
  saved = await snapshot();
  await page.evaluate(prepare);
  await wait(500);
  const keys = await page.evaluate(() => Object.keys(game.leverage ?? {}).sort());
  record("game.leverage exists with every group", keys.join() === "job,jobTracker,money,openOppositionRoller,opposition,plotPoints,rollPool,stars,traits", keys);

  /* ---- GM ---- */
  const gm = async (id) => {
    const out = await runBlock(page, blocks[id].code);
    record(`[gm] ${id}: runs without error`, !out.error, out);
    return out;
  };
  let known = await messageIds();
  let out = await gm("roll");
  let [msg] = await newRolls(known);
  record("[gm] roll: card with 3 Die terms in the order of the refs", msg?.dice === 3 && msg.flags.entries.map((e) => e.ref).join() === "attributes.agility,roles.thief,d6", msg);
  record("[gm] roll: flavor and actor on the card", msg?.flags.flavor === "Arromba o cofre" && msg.flags.actorName === "[TEST] Macro", msg?.flags);

  known = await messageIds();
  out = await gm("roll-ref");
  const inPool = (p) => p.evaluate(async () => {
    const { poolOf } = await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/actor/parts/tray.mjs"));
    return poolOf(game.actors.getName("[TEST] Macro").sheet).refs;
  });
  record("[gm] roll-ref: pool.add opens the sheet, fills the Pool and rolls nothing",
    out.warns.length === 0 && !out.error && (await newRolls(known)).length === 0 && (await inPool(page)).includes("attributes.agility"), out);

  await reset();
  known = await messageIds();
  await gm("roll-items");
  [msg] = await newRolls(known);
  record("[gm] roll-items: Specialty and Distinction d4 in the Pool, d4 gives a Plot Point",
    msg?.flags.entries.length === 4 && msg.flags.entries.some((e) => e.kind === "specialty") && msg.flags.entries.some((e) => e.kind === "distinction" && e.faces === 4) && (await peek()).pp === 2, msg?.flags.entries);

  await reset();
  known = await messageIds();
  await gm("roll-money");
  [msg] = await newRolls(known);
  record("[gm] roll-money: money die in the Pool and Money drops a step", msg?.flags.money === true && (await peek()).steps === 3, { msg: msg?.flags.entries, peek: await peek() });

  known = await messageIds();
  await gm("opposition");
  [msg] = await newRolls(known);
  record("[gm] opposition: FIXER card with d10 + d6 and the label",
    msg?.flags.opposition === true && msg.flags.flavor === "Guardas na porta" && msg.flags.entries.map((e) => e.faces).join() === "10,6", msg?.flags);

  await gm("opposition-open");
  await wait(600);
  record("[gm] opposition-open: the roller is open", await page.locator("#leverage-opposition-roller").count() === 1);
  await page.evaluate(() => foundry.applications.instances.get("leverage-opposition-roller")?.close());

  await reset(0);
  out = await gm("money");
  record("[gm] money: set 4, add 2, pay [d8,d6] and 1 step ends at 0", (await peek()).steps === 0 && out.logs[0].includes('"ok":true'), { out, peek: await peek() });

  await reset(3, 1, 0);
  await gm("money-transfer");
  let state = await peek();
  record("[gm] money-transfer: 1 step moved", state.steps === 2 && state.otherSteps === 1, state);

  out = await gm("stars");
  record("[gm] stars: 3 -> lower 2 -> raise 2 = 4 in Liberty City, then cleared",
    out.logs[0] === '[4,"liberty",{"city":"liberty","level":4,"pool":[12,12]}]' && (await page.evaluate(() => game.leverage.stars.get())) === 0, out);
  const bad = await page.evaluate(async () => {
    const warns = [];
    const real = ui.notifications.warn;
    ui.notifications.warn = (m) => warns.push(m);
    const r = [await game.leverage.stars.set(6), await game.leverage.stars.set(2, "nowhere"), await game.leverage.stars.set(1.5)];
    ui.notifications.warn = real;
    return { r, warns, level: game.leverage.stars.get() };
  });
  record("[gm] stars: out-of-range level and unknown city are refused with a warning", bad.r.every((v) => v === false) && bad.warns.length === 3 && bad.level === 0, bad);

  await reset(4, 1);
  out = await gm("plot-points");
  record("[gm] plot-points: add 2, spend 1 -> 2", out.logs[0] === "[3,true,2]" && (await peek()).pp === 2, out);
  known = await messageIds();
  await gm("plot-points-give");
  record("[gm] plot-points-give: +1 and a chat line", (await peek()).pp === 3 && (await newRolls(known)).length === 1, await peek());

  out = await gm("lock");
  record("[gm] lock: true then false", out.logs.join() === "[true],[false]", out);

  await gm("job-new");
  const jobName = await page.evaluate(() => game.leverage.job.get().name);
  record("[gm] job-new: active Job set and the Crew got the starting Plot Points", jobName === "Assalto ao banco" && (await peek()).pp > 3, { jobName, peek: await peek() });
  await gm("job-end");
  const ended = await page.evaluate(() => ({
    name: game.leverage.job.get().name,
    jobs: game.actors.getName("[TEST] Macro").items.filter((i) => i.type === "job").length
  }));
  record("[gm] job-end: Job Item left on the character and the active Job cleared", ended.name === "" && ended.jobs === 1, ended);

  await page.evaluate(async () => {
    const a = game.actors.getName("[TEST] Macro");
    const job = a.items.find((i) => i.type === "job");
    await job.update({ "system.callbackUsed": true });
  });
  await gm("scene-session");
  const after = await page.evaluate(() => {
    const a = game.actors.getName("[TEST] Macro");
    return { scene: a.items.filter((i) => i.type === "asset" && i.system.duration === "scene").length, used: a.items.find((i) => i.type === "job").system.callbackUsed };
  });
  record("[gm] scene-session: scene Asset removed and Callback returned", after.scene === 0 && after.used === false, after);

  const hookOut = await runBlock(page, blocks.hook.code);
  const fired = await page.evaluate(async () => {
    const lines = [];
    const real = console.log;
    console.log = (...a) => lines.push(a.join(" "));
    Hooks.callAll("leverage.ready", game.leverage);
    console.log = real;
    return lines;
  });
  record("[gm] hook: leverage.ready reaches a macro listener", !hookOut.error && fired.some((l) => l.includes("API pronta")), { hookOut, fired });

  // The macro that dragging a Trait to the hotbar creates.
  known = await messageIds();
  const hotbar = await page.evaluate(async () => {
    const { macroCommand } = await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/actor/parts/drag.mjs"));
    const actor = game.actors.getName("[TEST] Macro");
    const macro = await foundry.documents.Macro.create({ name: "[TEST] hotbar", type: "script", command: macroCommand(actor.uuid, "roles.thief") });
    await macro.execute();
    return true;
  });
  await wait(1500);
  record("[gm] hotbar macro made by dragging puts the Trait in the Pool", hotbar && (await inPool(page)).includes("roles.thief")
    && (await newRolls(known)).length === 0, await inPool(page));

  /* ---- Player ---- */
  playerBrowser = await openBrowser(env, { secondary: true });
  const pp = playerBrowser.page;
  const playerLog = collectConsole(pp);
  await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });
  const player = async (id) => {
    const res = await runBlock(pp, blocks[id].code);
    record(`[player] ${id}: runs without error`, !res.error, res);
    return res;
  };
  const eventually = async (fn, ms = 8000) => {
    for (let t = 0; t < ms; t += 250) { const v = await fn(); if (v) return v; await wait(250); }
    return null;
  };

  await reset(4, 1);
  known = await messageIds();
  await player("roll");
  msg = await eventually(async () => (await newRolls(known)).find((m) => m.flags?.flavor === "Arromba o cofre"));
  record("[player] roll: the card is posted for his own character", msg?.dice === 3, msg);

  known = await messageIds();
  out = await player("roll-ref");
  record("[player] roll-ref: Pool filled on his sheet, no card", out.warns.length === 0 && (await newRolls(known)).length === 0
    && (await inPool(pp)).includes("attributes.agility"), out);

  await player("roll-items");
  record("[player] roll-items: the d4 Distinction gave his own character a Plot Point", await eventually(async () => (await peek()).pp === 2), await peek());

  await reset(4, 1);
  await player("roll-money");
  record("[player] roll-money: Money dropped a step", await eventually(async () => (await peek()).steps === 3), await peek());

  await reset(0);
  await player("money");
  record("[player] money: ends at 0", await eventually(async () => (await peek()).steps === 0), await peek());

  await reset(1);
  await player("plot-points");
  record("[player] plot-points: 1 + 2 - 1 = 2", await eventually(async () => (await peek()).pp === 2), await peek());

  await reset(3, 1, 0);
  await player("money-transfer");
  state = await eventually(async () => { const s = await peek(); return s.otherSteps === 1 ? s : null; });
  record("[player] money-transfer: goes through the Fixer's socket and moves 1 step", state?.steps === 2, state);

  out = await player("stars-player");
  record("[player] stars: refused (false) with a warning, level untouched", out.logs[0].startsWith("[false") && out.warns.length === 1, out);

  const denied = await pp.evaluate(async () => {
    const warns = [];
    const real = ui.notifications.warn;
    ui.notifications.warn = (m) => warns.push(m);
    const other = game.actors.getName("[TEST] Other");
    const r = [await game.leverage.traits.lock(), await game.leverage.opposition({ dice: [6] }), await game.leverage.plotPoints.add(other, 1),
      await game.leverage.rollPool({ actor: other, refs: ["attributes.agility", "roles.thief"] })];
    ui.notifications.warn = real;
    return { r, warns: warns.length };
  });
  record("[player] Fixer-only calls and other people's characters are refused", denied.r[0] === false && denied.r[1] === null && denied.r[2] === null && denied.r[3] === null && denied.warns === 4, denied);
  record("no system errors in the GM console", log.own().length === 0, log.own());
  record("no system errors in the player console", playerLog.own().length === 0, playerLog.own());
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
} finally {
  await playerBrowser?.browser.close().catch(() => {});
  if (saved) await restore(saved).catch((err) => record("restore", false, err.message));
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
