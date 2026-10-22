/**
 * Cortex Prime hitches (T-1008) in the real Foundry: the GM's ACTIVATE HITCHES dialog on a resolved prime card, its three
 * ways (new stepped Complication, raise an existing one, separate ones), BOTCH (free), Plot Points only to the player,
 * permissions, double click, the classic card and the pending card. Two browsers: the GM test user and a [TEST] Player
 * who owns a [TEST] Crew. Everything created is `[TEST]` and removed at the end; the `complications` setting and
 * `rules.rollMode` are restored. Cards are posted resolved straight from `buildRollData` + `autoSelection` (the Choose
 * dice window has its own check, P-prime.mjs). Not-yet-merged i18n keys are loaded from docs/log/tmp-i18n-P6.json.
 *
 * Screenshots: tests/foundry/screenshots/F10-hitch-*.png. Exit codes: 0 pass, 1 fail, 2 not available.
 * Run after `npm run deploy`.
 */
import { readFileSync } from "node:fs";
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const wait = (ms) => page.waitForTimeout(ms);
let playerBrowser = null;
let pp = null;
let playerLog = null;
let saved = null;
const extraKeys = JSON.parse(readFileSync("docs/log/tmp-i18n-P6.json", "utf8")).en;

/** Posts a card for the [TEST] Crew. `kind`: "resolved" (prime, 2 best dice for the total) or "pending". */
const post = (values, kind = "resolved", mode = "prime") => page.evaluate(async ([vals, k, m]) => {
  const root = (f) => import(foundry.utils.getRoute(`systems/leverage-gta/module/dice/${f}.mjs`));
  const { buildRollData } = await root("roll-core");
  const { autoSelection, summarize } = await root("prime-math");
  const actor = game.actors.getName("[TEST] Crew");
  const entries = vals.map((_, i) => ({ ref: `x${i}`, label: `Die ${i + 1}`, kind: "attribute", die: 8 }));
  let data = buildRollData({ entries, values: vals, actorUuid: actor.uuid, actorName: actor.name, flavor: "[TEST] Hitches", mode: m, ppAtRoll: 3 });
  if (k === "resolved" && m === "prime") {
    const selection = autoSelection(data.entries);
    const s = summarize(data.entries, selection);
    data = { ...data, status: "resolved", selection, total: s.total, effectDie: s.effectFaces, hitches: s.hitches, botch: s.botch };
  }
  const msg = await ChatMessage.create({ author: game.users.getName("[TEST] Player").id, content: "<p>t</p>", flavor: data.flavor, flags: { "leverage-gta": { roll: data } } });
  return msg.id;
}, [values, kind, mode]);

/** Card facts in page `p`. */
const cardOf = (p, id) => p.evaluate((mid) => {
  const el = document.querySelector(`.chat-message[data-message-id="${mid}"]`);
  if (!el) return null;
  const q = (s) => el.querySelector(s);
  return {
    activate: Boolean(q('[data-action="activateHitches"]')), complication: Boolean(q('[data-action="complication"]')),
    strip: q(".lv-roll-hitches")?.textContent.trim() ?? null, botch: Boolean(q(".lv-roll-hitches--botch")),
    total: q(".lv-roll-total-num")?.textContent.trim() ?? null,
    notes: [...el.querySelectorAll(".lv-roll-note")].map((n) => n.textContent.trim()), warn: q(".lv-roll-note--warn")?.textContent.trim() ?? null
  };
}, id);

/** Flags, PP of the actor, the table's Complications and the update count of a message (GM side). */
const peek = (id) => page.evaluate((mid) => {
  const roll = game.messages.get(mid)?.getFlag("leverage-gta", "roll") ?? null;
  return {
    roll, pp: game.actors.getName("[TEST] Crew").system.plotPoints.value,
    list: game.settings.get("leverage-gta", "complications"), updates: window.__updates?.[mid] ?? 0
  };
}, id);

/** Audit: overlaps, cut text and overflow inside a selector. */
const audit = (p, selector) => p.evaluate((sel) => {
  const root = document.querySelector(sel);
  if (!root) return { missing: true };
  const box = root.getBoundingClientRect();
  const leaves = [...root.querySelectorAll("*")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== "none" && !el.closest("svg")
      && (el.matches("input, select, button") || (!el.children.length && el.textContent.trim()));
  });
  const overlaps = [];
  for (let i = 0; i < leaves.length; i += 1) {
    for (let j = i + 1; j < leaves.length; j += 1) {
      const a = leaves[i]; const b = leaves[j];
      if (a.contains(b) || b.contains(a)) continue;
      const x = a.getBoundingClientRect(); const y = b.getBoundingClientRect();
      const w = Math.min(x.right, y.right) - Math.max(x.left, y.left); const h = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top);
      if (w > 2 && h > 2) overlaps.push(`${a.className}|${a.textContent.trim().slice(0, 12)} x ${b.className}|${b.textContent.trim().slice(0, 12)}`);
    }
  }
  const cut = leaves.filter((el) => !el.matches("input, select") && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow !== "ellipsis").map((el) => el.textContent.trim().slice(0, 30));
  const outside = leaves.filter((el) => { const r = el.getBoundingClientRect(); return r.right > box.right + 1 || r.left < box.left - 1; }).map((el) => el.className);
  return { overlaps, cut, outside };
}, selector);

const shotCard = async (p, id, name) => {
  const loc = p.locator(`.chat-message[data-message-id="${id}"]`);
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await wait(500);
  await loc.screenshot({ path: `${SHOTS}/F10-hitch-${name}.png` }).catch(() => {});
};
const domClick = (p, selector) => p.evaluate((s) => document.querySelector(s)?.click(), selector);
const cardBtn = (id) => `.chat-message[data-message-id="${id}"] [data-action="activateHitches"]`;
const dialogCount = () => page.evaluate(() => document.querySelectorAll(".lv-dialog form select[name=mode]").length);
const modesOf = () => page.evaluate(() => [...document.querySelectorAll(".lv-dialog select[name=mode] option")].map((o) => o.value));

/** Fills the open dialog. `fields`: {mode, target?, name?, names?}. */
async function fillDialog(fields) {
  await page.waitForSelector(".lv-dialog form select[name=mode]", { timeout: 8000 });
  await page.evaluate((f) => {
    const form = document.querySelector(".lv-dialog form");
    const set = (el, v) => { el.value = v; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); };
    set(form.elements.mode, f.mode);
    if (f.target) set(form.elements.target, f.target);
    if (f.name !== undefined) set(form.elements.name, f.name);
    if (f.names) form.querySelectorAll("input[name=names]").forEach((el, i) => set(el, f.names[i] ?? ""));
  }, fields);
}
const confirmDialog = () => domClick(page, '.lv-dialog button[data-action="ok"]');
const clean = (r) => r?.overlaps?.length === 0 && r?.cut?.length === 0 && r?.outside?.length === 0;

try {
  await login(page, env);
  const previous = await page.evaluate(async (keys) => {
    const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    foundry.utils.mergeObject(game.i18n.translations, foundry.utils.expandObject(keys));
    const player = await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    await Actor.create({ name: "[TEST] Crew", type: "crew", system: { plotPoints: { value: 3 } }, ownership: { default: 0, [player.id]: OWNER } });
    window.__updates = {};
    Hooks.on("updateChatMessage", (m) => { window.__updates[m.id] = (window.__updates[m.id] ?? 0) + 1; });
    const before = { mode: game.settings.get("leverage-gta", "rules.rollMode"), list: game.settings.get("leverage-gta", "complications") };
    await game.settings.set("leverage-gta", "rules.rollMode", "prime");
    await game.settings.set("leverage-gta", "complications", []);
    ui.sidebar.expand?.(); ui.sidebar.changeTab?.("chat", "primary");
    return before;
  }, extraKeys);
  saved = previous;
  playerBrowser = await openBrowser(env, { secondary: true });
  pp = playerBrowser.page;
  playerLog = collectConsole(pp);
  await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });
  await pp.evaluate((keys) => { foundry.utils.mergeObject(game.i18n.translations, foundry.utils.expandObject(keys)); ui.sidebar.expand?.(); ui.sidebar.changeTab?.("chat", "primary"); }, extraKeys);
  await wait(1000);

  /* ---- pending card: no ACTIVATE ---- */
  const pend = await post([1, 5, 1], "pending");
  await wait(1200);
  let c = await cardOf(page, pend);
  record("pending card: no ACTIVATE button (GM)", c && !c.activate && !c.complication, c);

  /* ---- (a) new Complication, 3 hitches ---- */
  const A = await post([1, 6, 1, 7, 1]);
  await wait(1500);
  c = await cardOf(page, A);
  record("a. GM sees ACTIVATE on a resolved card with hitches; strip says 3 hitches; no old Complication button", c.activate && !c.complication && /3/.test(c.strip), c);
  const pc = await cardOf(pp, A);
  record("permission: the player does NOT see the button (nor the old one)", pc && !pc.activate && !pc.complication, pc);
  await shotCard(page, A, "01-card-resolved-gm");
  await domClick(page, cardBtn(A));
  await page.waitForSelector(".lv-dialog form select[name=mode]", { timeout: 8000 });
  const modes = await modesOf();
  record("a. with no Complication the dialog offers new + separate (no raise)", modes.join() === "new,separate", modes);
  await page.screenshot({ path: `${SHOTS}/F10-hitch-02-dialog-new.png` });
  record("a. dialog: nothing overlaps, nothing cut without ellipsis, nothing outside", clean(await audit(page, ".lv-dialog")), await audit(page, ".lv-dialog"));
  await confirmDialog();
  await wait(600);
  record("a. blank name keeps the dialog open and nothing is written", (await dialogCount()) === 1 && (await peek(A)).list.length === 0);
  await fillDialog({ mode: "new", name: "Alarm" });
  const u0 = (await peek(A)).updates;
  await confirmDialog();
  await wait(2000);
  let g = await peek(A);
  record("a. one Complication d10 (d6 + 2 steps), named Alarm", g.list.length === 1 && g.list[0].name === "Alarm" && g.list[0].die === 10, g.list);
  record("a. hitches resolved at once (indexes 0,2,4), hitchPP 1", g.roll.complicationsResolved.join() === "0,2,4" && g.roll.hitchPP === 1, g.roll);
  record("a. player got exactly 1 PP (3 -> 4)", g.pp === 4, g.pp);
  record("a. card written in a single update", g.updates - u0 === 1, g.updates - u0);
  c = await cardOf(page, A);
  record("a. GM: button gone, note about the Plot Point shown", !c.activate && c.notes.some((n) => /Plot Point/i.test(n)), c);
  await shotCard(page, A, "03-card-after-new");
  const pc2 = await cardOf(pp, A);
  record("a. player card updated too and still has no button", pc2 && !pc2.activate && pc2.notes.some((n) => /Plot Point/i.test(n)), pc2);
  record("a. card: no overlap, cut text or overflow", clean(await audit(page, `.chat-message[data-message-id="${A}"] .lv-roll-card`)));

  /* ---- (b) raise existing, 2 hitches ---- */
  const B = await post([1, 6, 7, 1]);
  await wait(1500);
  await domClick(page, cardBtn(B));
  await fillDialog({ mode: "raise" });
  const modesB = await modesOf();
  const targetsB = await page.evaluate(() => [...document.querySelectorAll(".lv-dialog select[name=target] option")].map((o) => o.textContent.trim()));
  record("b. with a Complication the dialog offers new, raise, separate", modesB.join() === "new,raise,separate", modesB);
  await page.screenshot({ path: `${SHOTS}/F10-hitch-04-dialog-raise.png` });
  await confirmDialog();
  await wait(2000);
  g = await peek(B);
  record("b. Alarm raised 2 steps (d10 -> d12), still one Complication, 1 PP (4 -> 5)", g.list.length === 1 && g.list[0].die === 12 && g.pp === 5, { list: g.list, pp: g.pp, targetsB });
  record("b. 2 hitches resolved", g.roll.complicationsResolved.join() === "0,3", g.roll);

  /* ---- (c) separate Complications, 2 hitches ---- */
  const C = await post([1, 6, 7, 1]);
  await wait(1500);
  await domClick(page, cardBtn(C));
  await fillDialog({ mode: "separate", names: ["Witness", "Flat tire"] });
  await page.screenshot({ path: `${SHOTS}/F10-hitch-05-dialog-separate.png` });
  await confirmDialog();
  await wait(2000);
  g = await peek(C);
  record("c. two new d6 Complications, one per name", g.list.length === 3 && g.list.slice(1).map((e) => `${e.name}:${e.die}`).join() === "Witness:6,Flat tire:6", g.list);
  record("c. 2 PP to the player (5 -> 7)", g.pp === 7, g.pp);

  /* ---- double click: one dialog, one write ---- */
  const D = await post([1, 6, 7, 1, 1]);
  await wait(1500);
  const before = (await peek(D)).list.length;
  await page.evaluate((s) => { const b = document.querySelector(s); b.click(); b.click(); }, cardBtn(D));
  await wait(1200);
  record("concurrency: a double click opens one dialog", (await dialogCount()) === 1);
  await fillDialog({ mode: "new", name: "Once" });
  await confirmDialog();
  await wait(2500);
  g = await peek(D);
  record("concurrency: written once (one new Complication, PP +1, hitches resolved once)", g.list.length === before + 1 && g.pp === 8 && g.roll.complicationsResolved.length === 3, { n: g.list.length, pp: g.pp, roll: g.roll });

  /* ---- past d12: out of the scene warning ---- */
  const witnessId = g.list.find((e) => e.name === "Witness").id;
  const O = await post([1, 6, 7, 1]);
  await wait(1500);
  await domClick(page, cardBtn(O));
  await fillDialog({ mode: "raise", target: witnessId });
  await confirmDialog();
  await wait(2000);
  const go = await peek(O);
  record("d12: Witness d6 -> d10 (no overflow yet)", go.list.find((e) => e.id === witnessId).die === 10 && !go.roll.outOfScene?.length, go);
  const O2 = await post([1, 6, 7, 1, 1]);
  await wait(1500);
  await domClick(page, cardBtn(O2));
  await fillDialog({ mode: "raise", target: witnessId });
  await confirmDialog();
  await wait(2000);
  const go2 = await peek(O2);
  c = await cardOf(page, O2);
  record("d12: past d12 the card warns the character is out of the scene (Witness stays d12)", go2.list.find((e) => e.id === witnessId).die === 12 && go2.roll.outOfScene?.join() === "Witness" && /Wasted/i.test(c.warn ?? ""), { outOfScene: go2.roll.outOfScene, warn: c.warn });
  await shotCard(page, O2, "06-card-out-of-scene");
  record("d12: warning card: no overlap, cut text or overflow", clean(await audit(page, `.chat-message[data-message-id="${O2}"] .lv-roll-card`)));

  /* ---- botch ---- */
  const X = await post([1, 1, 1]);
  await wait(1500);
  c = await cardOf(page, X);
  record("botch: red BOTCH strip, total 0, ACTIVATE offered", c.botch && /botch/i.test(c.strip) && c.total === "0" && c.activate, c);
  await shotCard(page, X, "07-card-botch");
  const ppBefore = (await peek(X)).pp;
  await domClick(page, cardBtn(X));
  await fillDialog({ mode: "new", name: "Disaster" });
  await page.screenshot({ path: `${SHOTS}/F10-hitch-08-dialog-botch.png` });
  await confirmDialog();
  await wait(2000);
  g = await peek(X);
  const dis = g.list.find((e) => e.name === "Disaster");
  record("botch: free Complication, 3 hitches = d6 + 2 steps = d10, NO Plot Point", dis?.die === 10 && g.pp === ppBefore && g.roll.hitchPP === 0 && g.roll.complicationsResolved.length === 3, { dis, pp: g.pp, ppBefore, roll: g.roll });
  await shotCard(page, X, "09-card-botch-done");
  record("botch: card: no overlap, cut text or overflow", clean(await audit(page, `.chat-message[data-message-id="${X}"] .lv-roll-card`)));

  /* ---- classic card keeps the old one-by-one behavior ---- */
  await page.evaluate(() => game.settings.set("leverage-gta", "rules.rollMode", "classic"));
  const K = await post([9, 6, 1, 1], "resolved", "classic");
  await wait(1500);
  c = await cardOf(page, K);
  record("classic: old GM Complication button, no ACTIVATE", c.complication && !c.activate, c);
  const nBefore = (await peek(K)).list.length;
  await domClick(page, `.chat-message[data-message-id="${K}"] [data-action="complication"]`);
  await page.waitForSelector(".lv-dialog form input[name=name]", { timeout: 8000 });
  await page.evaluate(() => { document.querySelector(".lv-dialog form input[name=name]").value = "Classic one"; });
  await confirmDialog();
  await wait(2000);
  g = await peek(K);
  record("classic: one 1 resolved (not all), one Complication", g.roll.complicationsResolved.length === 1 && g.list.length === nBefore + 1, g);

  record("console: no system errors (GM)", log.own().length === 0, log.own());
  record("console: no system errors (player)", playerLog.own().length === 0, playerLog.own());
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 8).join(" | "));
  await page.screenshot({ path: `${SHOTS}/F10-hitch-failure-gm.png` }).catch(() => {});
} finally {
  await playerBrowser?.browser.close().catch(() => {});
  await page.evaluate(async (prev) => {
    const crews = game.actors.filter((a) => a.name.startsWith("[TEST]"));
    const msgs = game.messages.filter((m) => m.flavor?.startsWith("[TEST]")).map((m) => m.id);
    if (msgs.length) await ChatMessage.deleteDocuments(msgs);
    for (const a of crews) await a.delete();
    await game.users.getName("[TEST] Player")?.delete();
    if (prev) {
      await game.settings.set("leverage-gta", "rules.rollMode", prev.mode);
      await game.settings.set("leverage-gta", "complications", prev.list);
    }
  }, saved).catch(() => {});
  const left = await page.evaluate(() => game.messages.filter((m) => m.flavor?.includes("[TEST]")).length).catch(() => "?");
  record("cleanup: no [TEST] message left", left === 0, left);
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
const own = [...log.own(), ...(playerLog?.own() ?? [])];
console.log(`CONSOLE (system errors): ${own.length ? own.join(" || ") : "clean"}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
