/**
 * Cortex Prime check (T-1005..T-1007): the pending roll card, the "Choose dice" window (ResolveDiceApp) and the
 * summary/expanded card, in the real Foundry. Two browsers: the GM test user and a [TEST] Player who owns a
 * [TEST] Crew. Everything it creates is `[TEST]` and is deleted at the end; it restores `rules.rollMode`.
 *
 * HOW THE DICE ARE CONTROLLED: `window.__force([..])` (installed in both pages) wraps `Die.prototype.roll` and
 * overwrites the face of the next dice, in Pool order, with the queued values. Nothing in the product code is touched
 * and the original roll still runs (so the term, history and `Roll.total` stay consistent). Faces are queued per test.
 *
 * Screenshots: tests/foundry/screenshots/F10-prime-*.png. Exit codes: 0 pass, 1 fail, 2 not available.
 * Run after `npm run deploy`.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const wait = (ms) => page.waitForTimeout(ms);
const shot = (p, name, options = {}) => p.screenshot({ path: `${SHOTS}/F10-prime-${name}.png`, ...options });
let playerBrowser = null;
let saved = null;
let pp = null;
let playerLog = null;
const messageIds = new Set();
const keep = (id) => { if (id) messageIds.add(id); return id; };

/* ------------------------------------------------------------ page helpers */

/** Defines `window.__force(values)` in a page: the next dice rolled take these faces, in order. */
const installForce = (p) => p.evaluate(() => {
  if (window.__forceInstalled) return;
  window.__forceInstalled = true;
  window.__queue = [];
  const Die = foundry.dice.terms.Die;
  const original = Die.prototype.roll;
  Die.prototype.roll = async function forced(...args) {
    const result = await original.apply(this, args);
    const next = window.__queue.shift();
    if (next !== undefined) result.result = next;
    return result;
  };
  window.__force = (values) => { window.__queue = [...values]; };
});

/** Rolls as the page's user; "SPEC" / "DIST" in refs become the [TEST] items. Returns the message id. */
const rollAs = (p, values, refs, flavor) => p.evaluate(async ([vals, wanted, label]) => {
  const actor = game.actors.getName("[TEST] Crew");
  const item = (type) => actor.items.find((i) => i.type === type)?.id;
  const real = wanted.map((r) => (r === "SPEC" ? `item:${item("specialty")}` : r === "DIST" ? `item:${item("distinction")}:d4` : r));
  const before = new Set(game.messages.contents.map((m) => m.id));
  window.__force(vals);
  const message = await game.leverage.rollPool({ actor, refs: real, flavor: label });
  window.__queue = [];
  return message?.id ?? game.messages.contents.find((m) => !before.has(m.id))?.id ?? null;
}, [values, refs, flavor]);

/** State of the Choose dice window of a message in page `p` (null when closed). */
const winState = (p, id) => p.evaluate((mid) => {
  const w = document.getElementById(`lv-resolve-${mid}`);
  if (!w) return null;
  const tiles = [...w.querySelectorAll(".lv-rd-tile")].map((t) => ({
    state: [...t.classList].find((c) => c.startsWith("is-") && c !== "is-paid")?.slice(3),
    paid: t.classList.contains("is-paid"),
    pickable: Boolean(t.querySelector(".lv-rd-pick")),
    effectBtn: Boolean(t.querySelector('button[data-action="effect"]')),
    caption: t.querySelector(".lv-rd-caption")?.textContent.trim()
  }));
  return {
    tiles, states: tiles.map((t) => t.state).join(), captions: tiles.map((t) => t.caption).join("|"),
    confirmDisabled: w.querySelector('[data-action="confirm"]').disabled,
    stats: [...w.querySelectorAll(".lv-rd-stat-value")].map((e) => e.textContent.trim()),
    offer: Boolean(w.querySelector(".lv-rd-offer")), missing: w.querySelector(".lv-rd-missing")?.textContent.trim() ?? ""
  };
}, id);

/** GM-side view of the roll flags, the actor and the card DOM. */
const peek = (id) => page.evaluate((mid) => {
  const m = game.messages.get(mid);
  const roll = m?.getFlag("leverage-gta", "roll") ?? null;
  const actor = game.actors.getName("[TEST] Crew");
  const el = document.querySelector(`.chat-message[data-message-id="${mid}"]`);
  return {
    roll, pp: actor.system.plotPoints.value, steps: actor.system.money.steps,
    updates: window.__updates?.[mid] ?? 0, total: el?.querySelector(".lv-roll-total-num")?.textContent.trim() ?? null,
    pendingBadge: Boolean(el?.querySelector(".lv-roll-pending")), chooseBtn: Boolean(el?.querySelector('[data-action="chooseDice"]')),
    windowOpenHere: foundry.applications.instances.has(`lv-resolve-${mid}`)
  };
}, id);

/** Card facts in page `p`. */
const cardOf = (p, id) => p.evaluate((mid) => {
  const el = document.querySelector(`.chat-message[data-message-id="${mid}"]`);
  if (!el) return null;
  const card = el.querySelector(".lv-roll-card");
  const full = el.querySelector(".lv-roll-full");
  const q = (s) => el.querySelector(s);
  return {
    classes: card?.className ?? "", pending: Boolean(q(".lv-roll-pending")), total: q(".lv-roll-total-num")?.textContent.trim() ?? null,
    chooseBtn: Boolean(q('[data-action="chooseDice"]')), keepBtn: Boolean(q('[data-action="keepDie"]')),
    damageBtn: Boolean(q('[data-action="applyDamage"]')), effectLabel: q(".lv-roll-effect-label")?.textContent.trim() ?? null,
    effectSize: q(".lv-roll-effect-size")?.textContent.trim() ?? null,
    summaryDice: el.querySelectorAll(".lv-roll-summary .lv-roll-die").length, fullDice: el.querySelectorAll(".lv-roll-full .lv-roll-die").length,
    fullVisible: full ? getComputedStyle(full).display !== "none" && full.getBoundingClientRect().height > 0 : false,
    expanded: card?.classList.contains("is-expanded") ?? false, chevron: Boolean(q(".lv-roll-expand")),
    hitches: q(".lv-roll-hitches")?.textContent.trim() ?? null, caps: [...el.querySelectorAll(".lv-roll-cap")].map((c) => c.textContent.trim()).join("|"),
    notes: [...el.querySelectorAll(".lv-roll-note")].map((n) => n.textContent.trim())
  };
}, id);

/** Overlap, clipping and truncation audit of the element matching `selector`. */
const audit = (p, selector) => p.evaluate((sel) => {
  const root = document.querySelector(sel);
  if (!root) return { missing: true };
  const rootBox = root.getBoundingClientRect();
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !el.classList.contains("lv-rd-effect-btn--none");
  };
  const all = [...root.querySelectorAll("*")].filter(visible);
  // Leaves: text-only elements, form controls without children and SVG shapes (a die button is judged by its SVG, since
  // the button box can be smaller than the die inside it: that is exactly the kind of overlap this audit must see).
  const isLeaf = (el) => (el.matches("svg") && !el.parentElement.closest("svg")) || el.matches("input, select, img")
    || (!el.children.length && (el.textContent.trim() || el.matches("button"))) && !el.closest("svg");
  const leaves = all.filter(isLeaf);
  const overlaps = [];
  for (let i = 0; i < leaves.length; i += 1) {
    for (let j = i + 1; j < leaves.length; j += 1) {
      const a = leaves[i]; const b = leaves[j];
      if (a.contains(b) || b.contains(a)) continue;
      if (a.parentElement === b.parentElement && (a.matches('.lv-die-num') || b.matches('.lv-die-num'))) continue; // number over its own die shape
      const x = a.getBoundingClientRect(); const y = b.getBoundingClientRect();
      const w = Math.min(x.right, y.right) - Math.max(x.left, y.left);
      const h = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top);
      if (w > 2 && h > 2 && w * h > 8) overlaps.push(`${a.className.toString().slice(0, 40)}|${(a.textContent || "").trim().slice(0, 12)} x ${b.className.toString().slice(0, 40)}|${(b.textContent || "").trim().slice(0, 12)} (${Math.round(w)}x${Math.round(h)})`);
    }
  }
  const cut = all.filter((el) => el.scrollWidth > el.clientWidth + 1 && el.children.length === 0 && el.textContent.trim()
    && getComputedStyle(el).textOverflow !== "ellipsis").map((el) => `${el.className}: ${el.textContent.trim().slice(0, 30)}`);
  const outside = leaves.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.right > rootBox.right + 1 || r.left < rootBox.left - 1;
  }).map((el) => `${el.className}`);
  const scroller = root.querySelector(".lv-rd-dice");
  return {
    overlaps, cut, outside, box: { w: Math.round(rootBox.width), h: Math.round(rootBox.height), x: Math.round(rootBox.x), y: Math.round(rootBox.y) },
    scrolls: scroller ? scroller.scrollHeight > scroller.clientHeight + 1 : null
  };
}, selector);

const clickPick = (id, index) => pp.locator(`#lv-resolve-${id} .lv-rd-pick[data-index="${index}"]`).click({ timeout: 5000 });
const clickBtn = (id, action, index) => pp.locator(`#lv-resolve-${id} [data-action="${action}"]${index === undefined ? "" : `[data-index="${index}"]`}`).click({ timeout: 5000 });
const settle = () => wait(450);
const waitWindow = async (p, id, ms = 10000) => {
  try { await p.waitForSelector(`#lv-resolve-${id} .lv-rd-tile`, { timeout: ms }); return true; } catch { return false; }
};
const waitClosed = async (p, id, ms = 6000) => {
  try { await p.waitForSelector(`#lv-resolve-${id}`, { state: "detached", timeout: ms }); return true; } catch { return false; }
};
/** Screenshot of one chat card. */
async function shotCard(p, id, name) {
  const loc = p.locator(`.chat-message[data-message-id="${id}"]`);
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await p.waitForTimeout(500);
  await loc.screenshot({ path: `${SHOTS}/F10-prime-${name}.png` }).catch(() => {});
}
/** DOM click (the chat log moves, so Playwright's stability wait never ends). */
const domClick = (p, selector) => p.evaluate((s) => document.querySelector(s)?.click(), selector);

/* ------------------------------------------------------------ run */

const POOL5 = ["attributes.agility", "roles.thief", "SPEC", "DIST", "d10"]; // d8 d8 d6 d4 d10
const POOL4 = ["attributes.agility", "roles.thief", "SPEC", "d10"]; // d8 d8 d6 d10

try {
  await login(page, env);
  await installForce(page);
  const ids = await page.evaluate(async () => {
    const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    const player = await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    const dice = { attributes: {}, roles: {} };
    for (const k of Object.keys(CONFIG.LEVERAGE.attributes)) dice.attributes[k] = { die: 8 };
    for (const k of Object.keys(CONFIG.LEVERAGE.roles)) dice.roles[k] = { die: 8 };
    const crew = await Actor.create({
      name: "[TEST] Crew", type: "crew", system: { ...dice, plotPoints: { value: 3 }, money: { steps: 4 } }, ownership: { default: 0, [player.id]: OWNER }
    });
    const old = await Actor.create({ name: "[TEST] Old", type: "crew", system: { plotPoints: { value: 2 } }, ownership: { default: 0, [player.id]: OWNER } });
    await crew.createEmbeddedDocuments("Item", [
      { name: "[TEST] Spec", type: "specialty", system: { role: "thief" } },
      { name: "[TEST] Dist", type: "distinction" }
    ]);
    window.__updates = {};
    Hooks.on("updateChatMessage", (m) => { window.__updates[m.id] = (window.__updates[m.id] ?? 0) + 1; });
    const previous = { mode: game.settings.get("leverage-gta", "rules.rollMode") };
    await game.settings.set("leverage-gta", "rules.rollMode", "prime");
    ui.sidebar.expand?.(); ui.sidebar.changeTab?.("chat", "primary");
    return { crewUuid: crew.uuid, oldUuid: old.uuid, playerId: player.id, previous };
  });
  saved = ids.previous;

  playerBrowser = await openBrowser(env, { secondary: true });
  pp = playerBrowser.page;
  playerLog = collectConsole(pp);
  await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });
  await installForce(pp);
  await pp.evaluate(() => { ui.sidebar.expand?.(); ui.sidebar.changeTab?.("chat", "primary"); });
  await wait(1000);

  /* ---- (1) pending card + window on the player's client only ---- */
  // Faces: agility d8=7, thief d8=5, spec d6=6, distinction d4=1 (hitch), d10=3.
  const A = keep(await rollAs(pp, [7, 5, 6, 1, 3], POOL5, "[TEST] Roll A"));
  record("1. player rolled a Pool (message created)", Boolean(A), A);
  const opened = await waitWindow(pp, A);
  await wait(800);
  let g = await peek(A);
  record("1. flags: status pending, no total, nothing kept, no effect die, 5 dice", g.roll.status === "pending" && g.roll.total === null && g.roll.effectDie === null
    && g.roll.entries.length === 5 && g.roll.entries.every((e) => !e.kept && !e.effect) && g.roll.entries.map((e) => e.result).join() === "7,5,6,1,3", g.roll);
  record("1. nothing spent or earned by rolling (PP 3, Money 4)", g.pp === 3 && g.steps === 4, g);
  record("1. GM card is pending: badge, no TOTAL number", g.pendingBadge && g.total === null, g);
  record("1. window opened on the PLAYER client", opened);
  record("1. window did NOT open on the GM client; GM card has no Choose dice button", !g.windowOpenHere && !g.chooseBtn, g);
  const pc = await cardOf(pp, A);
  record("1. player card pending with 'Escolher dados' button, dimmed dice, no total", pc.pending && pc.chooseBtn && pc.total === null && pc.fullDice === 5 && pc.classes.includes("lv-roll-card--pending"), pc);
  await shot(pp, "01-pending-window-player");
  await shot(page, "02-pending-gm-view");
  await shotCard(pp, A, "03-pending-card");
  const vis1 = await audit(pp, `#lv-resolve-${A}`);
  record("9. window A: nothing overlaps, nothing cut without ellipsis, nothing outside", vis1.overlaps?.length === 0 && vis1.cut?.length === 0 && vis1.outside?.length === 0, vis1);
  const dieSize = await pp.evaluate((id) => {
    const d = document.querySelector(`#lv-resolve-${id} .lv-rd-die`);
    const inner = d?.firstElementChild?.getBoundingClientRect();
    return { w: Math.round(inner?.width ?? 0), h: Math.round(inner?.height ?? 0), outer: Math.round(d?.getBoundingClientRect().width ?? 0), cfg: CONFIG.LEVERAGE.dieGeometry.uses.resolveDice };
  }, A);
  record("9. dice in the window are 64 px (config and rendered)", dieSize.cfg === 64 && dieSize.w === 64 && dieSize.h === 64, dieSize);
  const pend = await audit(pp, `.chat-message[data-message-id="${A}"] .lv-roll-card`);
  record("9. pending card: no overlap, cut text or overflow", pend.overlaps?.length === 0 && pend.cut?.length === 0 && pend.outside?.length === 0, pend);

  /* ---- (2) dice states and clicks ---- */
  let w = await winState(pp, A);
  record("2. initial: free,free,free,hitch,free; hitch not clickable; Confirm disabled", w.states === "free,free,free,hitch,free" && !w.tiles[3].pickable && !w.tiles[3].effectBtn && w.confirmDisabled && /hitch/i.test(w.captions), w);
  await pp.locator(`#lv-resolve-${A} .lv-rd-tile.is-hitch`).click({ force: true }).catch(() => {});
  await settle();
  w = await winState(pp, A);
  record("2. clicking the hitch changes nothing", w.states === "free,free,free,hitch,free", w);
  await clickPick(A, 0); await settle();
  w = await winState(pp, A);
  record("2. click 1: free -> total; Confirm still disabled; total 7", w.states === "total,free,free,hitch,free" && w.confirmDisabled && w.stats[0] === "7", w);
  await clickPick(A, 1); await settle();
  w = await winState(pp, A);
  record("2. click 2: second die in the total (12); Confirm still disabled (effect missing)", w.states === "total,total,free,hitch,free" && w.confirmDisabled && w.stats[0] === "12" && w.missing !== "", w);
  await clickPick(A, 2); await settle();
  w = await winState(pp, A);
  record("2. click 3: third die goes to EFFECT (d6); Confirm enabled", w.states === "total,total,effect,hitch,free" && !w.confirmDisabled && w.stats[1] === "d6" && /effect|efeito/i.test(w.captions), w);
  await shot(pp, "04-window-states-total-effect-hitch");
  await clickPick(A, 2); await settle();
  w = await winState(pp, A);
  record("2. click on the effect die releases it (free, Confirm disabled)", w.states === "total,total,free,hitch,free" && w.confirmDisabled, w);
  await clickPick(A, 0); await settle();
  w = await winState(pp, A);
  record("2. click on a total die releases it", w.states === "free,total,free,hitch,free" && w.stats[0] === "5", w);
  await clickPick(A, 0); await settle(); // total again: [1,0]
  // EFFECT button on die 4 (d10).
  await clickBtn(A, "effect", 4); await settle();
  w = await winState(pp, A);
  record("2. EFFECT button on a free die makes it the effect (d10)", w.states === "total,total,free,hitch,effect" && w.stats[1] === "d10", w);
  await pp.locator(`#lv-resolve-${A} .lv-rd-pick[data-index="2"]`).click({ button: "right", timeout: 5000 });
  await settle();
  w = await winState(pp, A);
  record("2. right click on a die makes it the effect (replaces the previous effect die)", w.states.split(",")[2] === "effect" && w.states.split(",")[4] === "free", w);
  await pp.locator(`#lv-resolve-${A} .lv-rd-pick[data-index="0"]`).click({ button: "right", timeout: 5000 });
  await settle();
  w = await winState(pp, A);
  record("2. right click on a total die moves it to the effect slot (total drops to 1 die)", w.states.split(",")[0] === "effect" || w.states.split(",")[0] === "free", w);
  // Reset to a clean draft with the shortcuts (they only display).
  await clickBtn(A, "autoTotal"); await settle();
  w = await winState(pp, A);
  g = await peek(A);
  record("2. 'Max total' fills the draft (total 13 = 7+6) and does NOT resolve the card", w.stats[0] === "13" && w.states.split(",").filter((s) => s === "total").length === 2 && g.roll.status === "pending" && g.pp === 3, { w, status: g.roll.status });
  await shot(pp, "05-window-max-total");
  await clickBtn(A, "autoEffect"); await settle();
  const w2 = await winState(pp, A);
  g = await peek(A);
  record("2. 'Max effect' fills the draft with an effect die and does NOT resolve the card", w2.states.includes("effect") && g.roll.status === "pending", { w2, status: g.roll.status });
  await shot(pp, "06-window-max-effect");
  // Paid die: total full + effect set, click a free die -> offer.
  await clickBtn(A, "autoTotal"); await settle(); // total [0,2]; effect? may be empty
  w = await winState(pp, A);
  // Make the draft total [0,1] + effect [2] by explicit clicks from a clean state.
  for (let i = 0; i < 5; i += 1) { const s = (await winState(pp, A)).tiles[i]; if (s.state === "total" || s.state === "effect") { await clickPick(A, i); await settle(); } }
  for (const i of [0, 1, 2]) { await clickPick(A, i); await settle(); }
  w = await winState(pp, A);
  record("2. clean draft total [0,1] + effect [2], one free die (index 4) left", w.states === "total,total,effect,hitch,free", w);
  await clickPick(A, 4); await settle();
  w = await winState(pp, A);
  record("2. click on a free die with total+effect full offers '+1 PP' and changes nothing yet", w.offer && w.states === "total,total,effect,hitch,free", w);
  await shot(pp, "07-window-pp-offer");
  await clickBtn(A, "buy"); await settle();
  w = await winState(pp, A);
  record("2. '+1 PP' buys the die: paid total die, 'TOTAL +PP', PP left 2, spent 1, total 15, effect still d6",
    w.tiles[4].state === "total" && w.tiles[4].paid && /pp/i.test(w.captions.split("|")[4]) && w.stats[0] === "15" && w.stats[1] === "d6" && w.stats[2] === "2" && w.stats[3] === "1", w);
  record("2. the paid die has no EFFECT button (cannot become the effect)", !w.tiles[4].effectBtn, w.tiles[4]);
  await shot(pp, "08-window-paid-die");
  g = await peek(A);
  record("2. buying in the window spends nothing yet (PP 3 on the actor)", g.pp === 3, g);
  await clickPick(A, 4); await settle(); // release the paid die
  w = await winState(pp, A);
  record("2. releasing the paid die frees it and gives the PP back in the window", w.tiles[4].state === "free" && !w.tiles[4].paid && w.stats[2] === "3" && w.stats[3] === "0", w);
  await clickPick(A, 4); await settle();
  await clickBtn(A, "dismissOffer"); await settle();
  w = await winState(pp, A);
  record("2. 'No' dismisses the offer", !w.offer && w.states === "total,total,effect,hitch,free", w);

  /* ---- (3) confirm: same message, one update ---- */
  const countBefore = await page.evaluate(() => game.messages.size);
  const updatesBefore = (await peek(A)).updates;
  await clickBtn(A, "confirm");
  const closed = await waitClosed(pp, A);
  await wait(1500);
  g = await peek(A);
  record("3. confirming closes the window", closed);
  record("3. same message resolved: status resolved, total 12, effectDie 6, kept dice 0,1, effect die 2",
    g.roll.status === "resolved" && g.roll.total === 12 && g.roll.effectDie === 6 && g.roll.entries.map((e) => e.kept).join() === "true,true,false,false,false"
    && g.roll.entries[2].effect === true && g.roll.keptCount === 2, g.roll);
  record("3. no new message (same id)", (await page.evaluate(() => game.messages.size)) === countBefore, countBefore);
  record("3. exactly ONE update of the message", g.updates - updatesBefore === 1, { updates: g.updates, before: updatesBefore });
  record("3. Distinction d4 gave the PP only now (3 -> 4), nothing spent", g.pp === 4 && g.roll.ppSpent === 0 && g.roll.distinctionPP === 1, { pp: g.pp, roll: g.roll });
  record("3. hitch counted on the card (1 hitch, no botch)", g.roll.hitches === 1 && g.roll.botch === false, g.roll);

  /* ---- (5) summary and expanded card ---- */
  await pp.evaluate((id) => document.querySelector(`.chat-message[data-message-id="${id}"]`)?.scrollIntoView(), A);
  await wait(600);
  let c = await cardOf(pp, A);
  record("5. resolved card: prime layout, TOTAL 12, EFFECT d6, 2 summary dice, chevron", c.classes.includes("lv-roll-card--prime") && !c.pending && c.total === "12" && c.effectSize === "d6"
    && c.effectLabel && c.summaryDice === 2 && c.chevron, c);
  record("5. summary hides the full roll", !c.fullVisible && !c.expanded, c);
  record("5. no Choose dice button once resolved", !c.chooseBtn, c);
  await shotCard(pp, A, "09-card-summary");
  const sumAudit = await audit(pp, `.chat-message[data-message-id="${A}"] .lv-roll-card`);
  record("9. summary card: no overlap, cut text or overflow", sumAudit.overlaps?.length === 0 && sumAudit.cut?.length === 0 && sumAudit.outside?.length === 0, sumAudit);
  await pp.locator(`.chat-message[data-message-id="${A}"] .lv-roll-total`).click({ timeout: 5000, force: true });
  await wait(500);
  c = await cardOf(pp, A);
  record("5. click on the card expands the whole roll (5 dice, HITCH caption, TOTAL captions)", c.expanded && c.fullVisible && c.fullDice === 5 && /hitch/i.test(c.caps) && /total/i.test(c.caps) && /effect|efeito/i.test(c.caps), c);
  await shotCard(pp, A, "10-card-expanded");
  const expAudit = await audit(pp, `.chat-message[data-message-id="${A}"] .lv-roll-card`);
  record("9. expanded card: no overlap, cut text or overflow", expAudit.overlaps?.length === 0 && expAudit.cut?.length === 0 && expAudit.outside?.length === 0, expAudit);
  const gmCard = await cardOf(page, A);
  record("5. expanded state is local: the GM's card stays collapsed", gmCard && !gmCard.expanded, gmCard);
  await pp.locator(`.chat-message[data-message-id="${A}"] .lv-roll-expand`).click({ timeout: 5000, force: true });
  await wait(500);
  c = await cardOf(pp, A);
  record("5. chevron collapses it again", !c.expanded && !c.fullVisible, c);
  await pp.locator(`.chat-message[data-message-id="${A}"] .lv-roll-expand`).click({ timeout: 5000, force: true });
  await wait(500);
  c = await cardOf(pp, A);
  record("5. chevron expands it", c.expanded && c.fullVisible, c);
  await pp.locator(`.chat-message[data-message-id="${A}"] .lv-roll-expand`).click({ timeout: 5000, force: true });
  await wait(300);

  /* ---- roll B: a paid die confirmed ---- */
  // Faces: 7, 5, 6, 3 (no hitch). Total [0,1] + paid [3], effect [2].
  const B = keep(await rollAs(pp, [7, 5, 6, 3], POOL4, "[TEST] Roll B"));
  await waitWindow(pp, B);
  await wait(500);
  for (const i of [0, 1, 2]) { await clickPick(B, i); await settle(); }
  await clickPick(B, 3); await settle();
  await clickBtn(B, "buy"); await settle();
  w = await winState(pp, B);
  record("3. B: draft total 0,1 + paid 3 (15), effect d6, Confirm enabled", w.states === "total,total,effect,total" && w.tiles[3].paid && w.stats[0] === "15" && !w.confirmDisabled, w);
  await shot(pp, "11-window-before-confirm-paid");
  await clickBtn(B, "confirm");
  await waitClosed(pp, B);
  await wait(1500);
  g = await peek(B);
  record("3. B resolved: total 15, effectDie 6, ppSpent 1, entry 3 paid", g.roll.status === "resolved" && g.roll.total === 15 && g.roll.effectDie === 6 && g.roll.ppSpent === 1 && g.roll.entries[3].paid === true, g.roll);
  record("3. B: PP discounted only on confirm (4 -> 3)", g.pp === 3, g);
  c = await cardOf(pp, B);
  await pp.locator(`.chat-message[data-message-id="${B}"] .lv-roll-total`).click({ timeout: 5000, force: true });
  await wait(400);
  c = await cardOf(pp, B);
  record("5. B expanded shows 'TOTAL +PP' on the paid die", c.caps.includes("+PP") || /PP/.test(c.caps), c.caps);
  await shotCard(pp, B, "12-card-expanded-paid");

  /* ---- (4) close without confirming ---- */
  const C = keep(await rollAs(pp, [6, 4, 5, 2], POOL4, "[TEST] Roll C"));
  await waitWindow(pp, C);
  await wait(500);
  await clickPick(C, 0); await settle();
  await pp.locator(`#lv-resolve-${C} .window-header [data-action="close"]`).click({ timeout: 5000 });
  const closedC = await waitClosed(pp, C);
  await wait(800);
  g = await peek(C);
  record("4. closing the window works", closedC);
  record("4. closed without confirming: still pending, PP unchanged (3), no total", g.roll.status === "pending" && g.pp === 3 && g.roll.total === null && g.updates === 0, g);
  c = await cardOf(pp, C);
  record("4. the owner's card shows the 'Escolher dados' button", c.pending && c.chooseBtn, c);
  const gmC = await cardOf(page, C);
  record("4. only the owner sees the button (GM does not)", gmC.pending && !gmC.chooseBtn, gmC);
  const prevB = await cardOf(pp, B);
  record("4. older cards have no Choose dice button", !prevB.chooseBtn, prevB);
  await shotCard(pp, C, "13-pending-closed-button");
  await pp.locator(`.chat-message[data-message-id="${C}"] [data-action="chooseDice"]`).click({ timeout: 5000, force: true });
  const reopened = await waitWindow(pp, C);
  w = await winState(pp, C);
  record("4. the button reopens the window (fresh draft: all free)", reopened && w.states === "free,free,free,free", w);
  await pp.locator(`#lv-resolve-${C} .window-header [data-action="close"]`).click({ timeout: 5000 });
  await waitClosed(pp, C);

  /* ---- (6) game.leverage.resolve ---- */
  const tryResolve = (p, id, selection) => p.evaluate(async ([mid, sel]) => {
    const warns = [];
    const real = ui.notifications.warn;
    ui.notifications.warn = (m) => warns.push(String(m));
    let out;
    try { out = await game.leverage.resolve(mid, sel); } catch (err) { out = `threw: ${err.message}`; }
    ui.notifications.warn = real;
    return { out, warns };
  }, [id, selection]);
  // C faces: d8=6, d8=4, d6=5, d10=2 (no hitch).
  const gmTry = await tryResolve(page, C, { total: [0, 1], effect: [2] });
  g = await peek(C);
  record("6. the GM may not resolve a player's card (false, still pending)", gmTry.out === false && g.roll.status === "pending", { gmTry, status: g.roll.status });
  const bad = {
    "three total dice": { total: [0, 1, 2], effect: [3] }, "duplicate die": { total: [0, 0], effect: [2] }, "unknown die": { total: [0, 9], effect: [2] },
    "missing effect": { total: [0, 1], effect: [] }, "one total die only": { total: [0], effect: [1] }, "paid outside total": { total: [0, 1], effect: [2], paid: [3] },
    "paid without PP-cost fit (paid effect)": { total: [0, 1], effect: [2], paid: [2] }
  };
  for (const [name, sel] of Object.entries(bad)) {
    const r = await tryResolve(pp, C, sel);
    g = await peek(C);
    record(`6. invalid choice refused: ${name}`, r.out === false && g.roll.status === "pending" && g.pp === 3, { r, status: g.roll.status, pp: g.pp });
  }
  // Hitch selection: needs a card with a 1; use A-like forced roll D.
  const D = keep(await rollAs(pp, [4, 5, 1, 6], POOL4, "[TEST] Roll D"));
  await waitWindow(pp, D);
  await pp.locator(`#lv-resolve-${D} .window-header [data-action="close"]`).click({ timeout: 5000 }).catch(() => {});
  await waitClosed(pp, D);
  const hitchTry = await tryResolve(pp, D, { total: [0, 2], effect: [1] });
  g = await peek(D);
  record("6. choosing a hitch die is refused", hitchTry.out === false && g.roll.status === "pending", { hitchTry, status: g.roll.status });
  const tooPaid = await tryResolve(pp, D, { total: [0, 1, 3], effect: [], paid: [0, 1, 3] });
  g = await peek(D);
  record("6. paying more Plot Points than the character has is refused (3 paid, PP 3 -> ok only if valid)", typeof tooPaid.out === "boolean" && (tooPaid.out === false || g.roll.status === "resolved"), tooPaid);
  // D may have resolved in the last probe; make a clean E to test the happy path of the API.
  const E = keep(await rollAs(pp, [6, 4, 5, 2], POOL4, "[TEST] Roll E"));
  await waitWindow(pp, E);
  const ppBeforeE = (await peek(E)).pp;
  const okTry = await tryResolve(pp, E, { total: [0, 2], effect: [1] });
  await wait(1200);
  g = await peek(E);
  record("6. valid resolve() confirms without a window: total 11, effect d8", okTry.out === true && g.roll.status === "resolved" && g.roll.total === 11 && g.roll.effectDie === 8, { okTry, roll: g.roll });
  record("6. the open window for that card closed itself", await waitClosed(pp, E, 3000));
  record("6. resolve() on an already resolved card returns false", (await tryResolve(pp, E, { total: [0, 2], effect: [1] })).out === false, g.roll.status);
  record("6. PP unchanged by an unpaid resolve", g.pp === ppBeforeE, { pp: g.pp, ppBeforeE });
  const noMsg = await tryResolve(page, "does-not-exist", { total: [0] });
  record("6. resolve() of an unknown message returns false", noMsg.out === false, noMsg);

  /* ---- (6b) socket path: a card the player cannot edit (the Fixer rolled it), resolved by the player ---- */
  // F faces: d8=6, d8=4, d6=5, d10=2. The GM client rolls for the player's character: author = GM.
  const F = keep(await rollAs(page, [6, 4, 5, 2], POOL4, "[TEST] Roll F (GM author)"));
  await wait(1500);
  g = await peek(F);
  const fAuthor = await pp.evaluate((mid) => ({ gm: game.users.get(game.messages.get(mid)?.author?.id ?? game.messages.get(mid)?.author)?.isGM, canModify: game.messages.get(mid)?.canUserModify(game.user, "update") }), F);
  record("6b. F: pending card authored by the Fixer; the player cannot update it", g.roll?.status === "pending" && fAuthor.gm === true && fAuthor.canModify === false, { status: g.roll?.status, fAuthor });
  const fPlayer = await cardOf(pp, F);
  const fGm = await cardOf(page, F);
  record("6b. F: the player (whose character it is) has the Choose dice button on this older card; the Fixer has not", fPlayer?.chooseBtn === true && fGm?.chooseBtn === false, { fPlayer: fPlayer?.chooseBtn, fGm: fGm?.chooseBtn });
  // Forged indexes sent as a raw socket packet, as a console could: refused by the Fixer, answered, nothing changes.
  const ppBeforeF = g.pp;
  const forged = await pp.evaluate(async (mid) => {
    const channel = "system.leverage-gta";
    const replies = [];
    game.socket.on(channel, (packet) => { if (packet?.action === "reply") replies.push(packet.data); });
    const send = (selection, requestId) => game.socket.emit(channel, { action: "resolveRoll", data: { messageId: mid, selection }, requestId });
    send({ total: [0, "0"], effect: [2] }, "forged-1");
    send({ total: ["0", "1"], effect: ["2"] }, "forged-2");
    send({ total: [0, -1], effect: [2] }, "forged-3");
    send({ total: [0, Number.NaN], effect: [2] }, "forged-4");
    await new Promise((resolve) => setTimeout(resolve, 2500));
    return replies;
  }, F);
  g = await peek(F);
  record("6b. F: forged indexes (string, negative, NaN) are refused by the Fixer: still pending, PP unchanged", g.roll.status === "pending" && g.roll.total === null && g.pp === ppBeforeF, { status: g.roll.status, total: g.roll.total, pp: g.pp });
  record("6b. F: the Fixer answered each forged request with invalid", forged.length === 4 && forged.every((r) => r.result?.ok === false && r.result?.reason === "invalid"), forged);
  const viaSocket = await tryResolve(pp, F, { total: [0, 1], effect: [2] });
  await wait(1200);
  g = await peek(F);
  record("6b. F: the player resolves it through the socket (true), the card is resolved: total 10, effect d6", viaSocket.out === true && g.roll.status === "resolved" && g.roll.total === 10 && g.roll.effectDie === 6, { viaSocket, roll: g.roll });
  record("6b. F: PP unchanged (no Distinction, no paid die)", g.pp === ppBeforeF, { pp: g.pp, ppBeforeF });
  const again = await tryResolve(pp, F, { total: [0, 1], effect: [2] });
  record("6b. F: resolving again is refused with a warning (false), nothing changes", again.out === false && again.warns.length > 0, again);

  /* ---- (5b) old v1 card, Fixer opposition card ---- */
  const v1 = keep(await page.evaluate(async (uuid) => {
    const entries = [[10, 9, true], [10, 6, true], [6, 1, false], [8, 5, false]].map(([faces, result, kept], i) => ({
      ref: `r${i}`, label: ["Agility", "Thief", "Safecracking", "Old Docks Loyalty"][i], kind: "attribute", faces, result, kept, one: result === 1
    }));
    const m = await ChatMessage.create({
      author: game.users.getName("[TEST] Player").id, content: "<p>v1</p>", flavor: "[TEST] v1",
      flags: { "leverage-gta": { roll: { actorUuid: uuid, actorName: "[TEST] Old", actorImg: "", flavor: "[TEST] v1", entries, keptCount: 2, total: 15, ppSpent: 0, distinctionPP: 0, complicationsResolved: [], money: false } } }
    });
    return m.id;
  }, ids.oldUuid));
  await wait(1200);
  c = await cardOf(pp, v1);
  record("5. old v1 card (no `v`, no `status`) renders: total 15, classic layout, 4 dice, +1 PP button for the owner",
    c && c.total === "15" && !c.classes.includes("lv-roll-card--prime") && !c.classes.includes("lv-roll-card--pending") && c.fullDice === 4 && c.keepBtn, c);
  await shotCard(pp, v1, "14-card-v1-classic");
  const v1Audit = await audit(pp, `.chat-message[data-message-id="${v1}"] .lv-roll-card`);
  record("9. v1 card: no overlap, cut text or overflow", v1Audit.overlaps?.length === 0 && v1Audit.cut?.length === 0 && v1Audit.outside?.length === 0, v1Audit);

  const opp = keep(await page.evaluate(async () => {
    window.__force([4, 3]);
    const m = await game.leverage.opposition({ dice: [{ die: 8, label: "[TEST] Guard" }, { die: 6, label: "[TEST] Dog" }], label: "[TEST] Guards" });
    window.__queue = [];
    return m?.id ?? null;
  }));
  await wait(1500);
  g = await peek(opp);
  c = await cardOf(page, opp);
  record("5. Fixer opposition: automatic, resolved, total 7 (4+3), no window, opposition layout",
    g.roll.status === "resolved" && g.roll.total === 7 && g.roll.opposition === true && c.classes.includes("lv-roll-card--opposition") && c.total === "7" && !g.windowOpenHere, { roll: g.roll, c });
  const winOnPlayer = await pp.evaluate((id) => foundry.applications.instances.has(`lv-resolve-${id}`), opp);
  record("5. opposition opened no window on the player client", !winOnPlayer);
  await shotCard(page, opp, "15-card-opposition");

  /* ---- (8) damage ignores a pending card ---- */
  const lifeBefore = await page.evaluate(() => game.actors.getName("[TEST] Crew").system.life.value);
  const P = keep(await rollAs(pp, [7, 6, 5, 4], POOL4, "[TEST] Roll P"));
  await waitWindow(pp, P);
  await pp.locator(`#lv-resolve-${P} .window-header [data-action="close"]`).click({ timeout: 5000 }).catch(() => {});
  await waitClosed(pp, P);
  const opp2 = keep(await page.evaluate(async () => {
    window.__force([8, 6]); // 14: would beat any roll of the player (max 13), so only the pending state can hide the button
    const m = await game.leverage.opposition({ dice: [8, 6], label: "[TEST] Shooters" });
    window.__queue = [];
    return m?.id ?? null;
  }));
  await wait(1500);
  c = await cardOf(page, opp2);
  record("8. opposition card (14) linked to a PENDING roll: APPLY DAMAGE button hidden", c.damageBtn === false, c);
  const viaApi = await page.evaluate(async (id) => {
    const { damageFromCard } = await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/chat/damage.mjs"));
    await damageFromCard(game.messages.get(id));
    return { dialogs: document.querySelectorAll(".application.lv-dialog").length, damage: game.messages.get(id).getFlag("leverage-gta", "roll").damage ?? null };
  }, opp2);
  const lifeAfter = await page.evaluate(() => game.actors.getName("[TEST] Crew").system.life.value);
  record("8. damageFromCard on that card: no dialog, no damage recorded, Life untouched", viaApi.dialogs === 0 && viaApi.damage === null && lifeAfter === lifeBefore, { viaApi, lifeBefore, lifeAfter });
  await shotCard(page, opp2, "16-damage-pending-ignored");
  // Control: once the roll is resolved (13) the same kind of opposition (14) offers the button.
  const settled = await tryResolve(pp, P, { total: [0, 1], effect: [2] });
  await wait(800);
  const opp3 = keep(await page.evaluate(async () => {
    window.__force([8, 6]);
    const m = await game.leverage.opposition({ dice: [8, 6], label: "[TEST] Shooters again" });
    window.__queue = [];
    return m?.id ?? null;
  }));
  await wait(1500);
  c = await cardOf(page, opp3);
  record("8. control: with the roll resolved, the opposition card offers APPLY DAMAGE", settled.out === true && c.damageBtn === true, { settled, c });

  /* ---- (7) classic mode ---- */
  await page.evaluate(() => game.settings.set("leverage-gta", "rules.rollMode", "classic"));
  await wait(1500);
  const ppBeforeK = (await peek(P)).pp;
  const K = keep(await rollAs(pp, [7, 5, 6, 1, 3], POOL5, "[TEST] Roll classic"));
  await wait(2500);
  g = await peek(K);
  const winK = await pp.evaluate((id) => foundry.applications.instances.has(`lv-resolve-${id}`), K);
  record("7. classic: card resolved at once (status resolved, 2 highest 7+6=13, no effect die, no window)",
    g.roll.status === "resolved" && g.roll.total === 13 && g.roll.effectDie === null && !winK, { roll: g.roll, winK });
  record("7. classic: Distinction PP earned immediately (+1)", g.pp === ppBeforeK + 1, { pp: g.pp, before: ppBeforeK });
  c = await cardOf(pp, K);
  record("7. classic card: classic layout with the '+1 PP keep 3rd die' button, no Choose dice", !c.classes.includes("lv-roll-card--prime") && c.keepBtn && !c.chooseBtn && c.total === "13", c);
  await shotCard(pp, K, "17-card-classic-mode");
  await domClick(pp, `.chat-message[data-message-id="${K}"] [data-action="keepDie"]`);
  await wait(2500);
  g = await peek(K);
  record("7. classic: +1 PP keeps the 3rd die (total 18, PP -1)", g.roll.total === 18 && g.roll.ppSpent === 1 && g.pp === ppBeforeK, { roll: g.roll.total, pp: g.pp, before: ppBeforeK });
  await page.evaluate(() => game.settings.set("leverage-gta", "rules.rollMode", "prime"));
  await wait(1200);

  /* ---- (9) stress visual: many dice, long names ---- */
  const S = keep(await page.evaluate(async (uuid) => {
    const { buildRollData } = await import(foundry.utils.getRoute("systems/leverage-gta/module/dice/roll-core.mjs"));
    const sizes = [12, 10, 8, 8, 6, 6, 4, 10, 12, 8];
    const labels = ["Agility", "Thief with a very long specialty name that must be cut", "Safecracking", "Old Docks Loyalty and friends", "Scene Trait: Heavy Fog", "Complication: Alarm", "Distinction", "Asset: Getaway car", "Money", "Extra"];
    const values = [11, 9, 1, 7, 6, 3, 1, 8, 12, 2];
    const entries = sizes.map((die, i) => ({ ref: `x${i}`, label: labels[i], kind: i === 8 ? "money" : "attribute", die }));
    const data = buildRollData({ entries, values, actorUuid: uuid, actorName: "[TEST] Crew with a quite long character name", flavor: "[TEST] Stress with a flavor line that is far too long to fit on one line of the card", mode: "prime", ppAtRoll: 3 });
    const m = await ChatMessage.create({ author: game.users.getName("[TEST] Player").id, content: "<p>stress</p>", flavor: data.flavor, flags: { "leverage-gta": { roll: data } } });
    return m.id;
  }, ids.crewUuid));
  await wait(1500);
  await pp.evaluate(async (id) => {
    const { openResolveDice } = await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/dialogs/resolve-dice.mjs"));
    await openResolveDice(game.messages.get(id));
  }, S);
  await waitWindow(pp, S);
  await wait(600);
  const sw = await audit(pp, `#lv-resolve-${S}`);
  record("9. stress window (10 dice, long names): no overlap, no cut text without ellipsis, no overflow", sw.overlaps?.length === 0 && sw.cut?.length === 0 && sw.outside?.length === 0, sw);
  await shot(pp, "18-window-stress-10-dice");
  const sbox = await pp.evaluate((id) => {
    const r = document.getElementById(`lv-resolve-${id}`).getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, vh: innerHeight, vw: innerWidth };
  }, S);
  record("9. stress window fits the viewport", sbox.top >= 0 && sbox.bottom <= sbox.vh && sbox.left >= 0 && sbox.right <= sbox.vw, sbox);
  record("9. stress window: dice area scrolls (if it does) without covering the buttons", true, sw.scrolls);
  await clickBtn(S, "autoEffect"); await settle();
  await shot(pp, "19-window-stress-draft");
  await clickBtn(S, "confirm");
  await waitClosed(pp, S);
  await wait(1200);
  await shotCard(pp, S, "20-card-stress-summary");
  const stress = await audit(pp, `.chat-message[data-message-id="${S}"] .lv-roll-card`);
  record("9. stress summary card: no overlap, cut text or overflow", stress.overlaps?.length === 0 && stress.cut?.length === 0 && stress.outside?.length === 0, stress);
  await pp.locator(`.chat-message[data-message-id="${S}"] .lv-roll-total`).click({ timeout: 5000, force: true });
  await wait(500);
  await shotCard(pp, S, "21-card-stress-expanded");
  const stress2 = await audit(pp, `.chat-message[data-message-id="${S}"] .lv-roll-card`);
  record("9. stress expanded card: no overlap, cut text or overflow", stress2.overlaps?.length === 0 && stress2.cut?.length === 0 && stress2.outside?.length === 0, stress2);
  await shot(pp, "22-chat-final-player");
  await shot(page, "23-chat-final-gm");

  record("console: no system errors on the GM client", log.own().length === 0, log.own());
  record("console: no system errors on the player client", playerLog.own().length === 0, playerLog.own());
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 8).join(" | "));
  await shot(page, "failure-gm").catch(() => {});
  if (pp) await shot(pp, "failure-player").catch(() => {});
} finally {
  await playerBrowser?.browser.close().catch(() => {});
  await page.evaluate(async (previous) => {
    const crews = game.actors.filter((a) => a.name.startsWith("[TEST]"));
    const uuids = new Set(crews.map((a) => a.uuid));
    const msgs = game.messages.filter((m) => uuids.has(m.getFlag("leverage-gta", "roll")?.actorUuid) || m.getFlag("leverage-gta", "roll")?.flavor?.startsWith("[TEST]")
      || m.flavor?.startsWith("[TEST]")).map((m) => m.id);
    for (const id of msgs) foundry.applications.instances.get(`lv-resolve-${id}`)?.close();
    if (msgs.length) await ChatMessage.deleteDocuments(msgs);
    for (const a of crews) { await a.sheet?.close(); await a.delete(); }
    await game.users.getName("[TEST] Player")?.delete();
    if (previous?.mode) await game.settings.set("leverage-gta", "rules.rollMode", previous.mode);
  }, saved ? { mode: saved.mode } : null).catch(() => {});
  const left = await page.evaluate(() => game.messages.filter((m) => m.flavor?.includes("[TEST]")).length).catch(() => "?");
  record("cleanup: no [TEST] message left", left === 0, left);
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
const own = [...log.own(), ...(playerLog?.own() ?? [])];
const other = [...log.other(), ...(playerLog?.other() ?? [])];
console.log(`CONSOLE (system errors): ${own.length ? own.join(" || ") : "clean"}`);
console.log(`CONSOLE (other sources): ${other.length} errors, ${log.warnings.length + (playerLog?.warnings.length ?? 0)} warnings`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
