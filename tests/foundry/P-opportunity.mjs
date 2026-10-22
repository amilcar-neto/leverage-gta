/**
 * Cortex Prime Opportunities (T-1010) in the real Foundry: the Fixer's opposition card shows "N opportunities"; the
 * character's player (not the GM) gets the USE OPPORTUNITY (1 PP) button; the dialog lowers a Complication (d4 goes away)
 * or raises a scene/Job Asset (boost until the end of the scene); each use costs 1 PP and is ONE card write; End scene
 * clears the boost. Two browsers: the GM test user and a [TEST] Player who owns a [TEST] Crew. Everything created is
 * `[TEST]` and removed at the end; the `complications` and `globalTraits` settings are restored. Run in the client language
 * of the test world (pt-BR); the keys must be in lang/.
 *
 * Screenshots: tests/foundry/screenshots/F10-opp-*.png. Exit codes: 0 pass, 1 fail, 2 not available.
 * Run after `npm run deploy`.
 */
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

/** Posts the Fixer's resolved opposition card with these dice values (hitches = the 1s). */
const post = (values) => page.evaluate(async (vals) => {
  const { buildOppositionData } = await import(foundry.utils.getRoute("systems/leverage-gta/module/dice/opposition.mjs"));
  const dice = vals.map((_, i) => ({ ref: `opp.${i}`, label: "Opposition", kind: "die", die: 8 }));
  const data = buildOppositionData({ dice, values: vals, name: "GM", flavor: "[TEST] Opportunities" });
  const msg = await ChatMessage.create({ content: "<p>t</p>", flavor: data.flavor, flags: { "leverage-gta": { roll: data } } });
  return msg.id;
}, values);

/** Card facts in page `p`. */
const cardOf = (p, id) => p.evaluate((mid) => {
  const el = document.querySelector(`.chat-message[data-message-id="${mid}"]`);
  if (!el) return null;
  const q = (s) => el.querySelector(s);
  const btn = q('[data-action="useOpportunity"]');
  return {
    strip: q(".lv-roll-opps")?.textContent.trim() ?? null, button: Boolean(btn), disabled: Boolean(btn?.disabled), label: btn?.textContent.trim() ?? null,
    notes: [...el.querySelectorAll(".lv-roll-note")].map((n) => n.textContent.trim())
  };
}, id);

/** State the checks read (GM side). */
const peek = (id) => page.evaluate((mid) => {
  const actor = game.actors.getName("[TEST] Crew");
  const roll = game.messages.get(mid)?.getFlag("leverage-gta", "roll") ?? null;
  return {
    roll, pp: actor.system.plotPoints.value, list: game.settings.get("leverage-gta", "complications"),
    boost: Object.fromEntries(actor.items.filter((i) => i.type === "asset").map((i) => [i.name, i.system.boost])),
    updates: window.__updates?.[mid] ?? 0
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
  await loc.screenshot({ path: `${SHOTS}/F10-opp-${name}.png` }).catch(() => {});
};
const domClick = (p, selector) => p.evaluate((s) => document.querySelector(s)?.click(), selector);
const cardBtn = (id) => `.chat-message[data-message-id="${id}"] [data-action="useOpportunity"]`;
const dialogCount = (p) => p.evaluate(() => document.querySelectorAll(".lv-dialog form select[name=choice]").length);
const clean = (r) => r?.overlaps?.length === 0 && r?.cut?.length === 0 && r?.outside?.length === 0;
const optionsOf = (p) => p.evaluate(() => [...document.querySelectorAll(".lv-dialog select[name=choice] option")].map((o) => ({ value: o.value, text: o.textContent.trim() })));
const closeDialog = async () => {
  await pp.evaluate(() => document.querySelector('.lv-dialog button[data-action="cancel"], .lv-dialog button[data-action="close"], .lv-dialog .header-control.close')?.click());
  await wait(500);
};

/** The player picks `value` in the open dialog and confirms. */
async function choose(value) {
  await pp.waitForSelector(".lv-dialog form select[name=choice]", { timeout: 8000 });
  await pp.evaluate((v) => {
    const select = document.querySelector(".lv-dialog form select[name=choice]");
    select.value = v; select.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await domClick(pp, '.lv-dialog button[data-action="ok"]');
}

try {
  await login(page, env);
  saved = await page.evaluate(async () => {
    const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    const player = await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    const crew = await Actor.create({ name: "[TEST] Crew", type: "crew", system: { plotPoints: { value: 5 } }, ownership: { default: 0, [player.id]: OWNER } });
    await crew.createEmbeddedDocuments("Item", [
      { name: "[TEST] Van", type: "asset", system: { die: 6, duration: "scene" } },
      { name: "[TEST] Lockpick", type: "asset", system: { die: 6, duration: "job" } },
      { name: "[TEST] Crowbar", type: "asset", system: { die: 12, duration: "job" } },
      { name: "[TEST] Gun", type: "asset", system: { die: 8, duration: "signature" } }
    ]);
    window.__updates = {};
    window.__before = new Set(game.messages.map((m) => m.id));
    Hooks.on("updateChatMessage", (m) => { window.__updates[m.id] = (window.__updates[m.id] ?? 0) + 1; });
    const before = { list: game.settings.get("leverage-gta", "complications"), traits: game.settings.get("leverage-gta", "globalTraits") };
    await game.settings.set("leverage-gta", "complications", [{ id: "tstA", name: "[TEST] Alarm", die: 6 }, { id: "tstB", name: "[TEST] Dog", die: 4 }]);
    ui.sidebar.expand?.(); ui.sidebar.changeTab?.("chat", "primary");
    return before;
  });
  playerBrowser = await openBrowser(env, { secondary: true });
  pp = playerBrowser.page;
  playerLog = collectConsole(pp);
  await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });
  await pp.evaluate(() => { ui.sidebar.expand?.(); ui.sidebar.changeTab?.("chat", "primary"); });
  await wait(1000);

  /* ---- the card: strip for everybody, button for the player only ---- */
  const A = await post([1, 6, 1, 7]);
  await wait(1500);
  let gc = await cardOf(page, A);
  let pc = await cardOf(pp, A);
  record("card: GM sees the strip with 2 opportunities and no button", gc && /2/.test(gc.strip ?? "") && !gc.button, gc);
  record("card: the player sees the strip and the USE OPPORTUNITY button, enabled", pc && /2/.test(pc.strip ?? "") && pc.button && !pc.disabled && /1 PP/.test(pc.label ?? ""), pc);
  await shotCard(page, A, "01-card-gm");
  await shotCard(pp, A, "02-card-player");
  record("card: no overlap, cut text or overflow", clean(await audit(pp, `.chat-message[data-message-id="${A}"] .lv-roll-card`)), await audit(pp, `.chat-message[data-message-id="${A}"] .lv-roll-card`));

  /* ---- dialog: only what exists and can change ---- */
  await domClick(pp, cardBtn(A));
  await pp.waitForSelector(".lv-dialog form select[name=choice]", { timeout: 8000 });
  const opts = await optionsOf(pp);
  record("dialog: lists both Complications and the Van + Lockpick (no d12 Crowbar, no signature Gun)",
    opts.map((o) => `${o.value.replace(/:.*/, "")}:${o.text.split(":")[0]}`).sort().join("|").replace(/\[TEST\] /g, "") === "lower:Alarm|lower:Dog|raise:Lockpick|raise:Van", opts);
  record("dialog: the d4 option says it goes away", opts.length > 1 && /d4/.test(opts[1].text) && !/d4 (para|to) d/.test(opts[1].text), opts[1]);
  await pp.screenshot({ path: `${SHOTS}/F10-opp-03-dialog.png` });
  record("dialog: nothing overlaps, no cut text, nothing outside", clean(await audit(pp, ".lv-dialog")), await audit(pp, ".lv-dialog"));
  await closeDialog();
  const afterCancel = await peek(A);
  record("dialog: cancel writes nothing", afterCancel.roll.opportunitiesUsed === 0 && afterCancel.pp === 5, afterCancel.pp);

  /* ---- use 1: lower Alarm d6 -> d4 ---- */
  await domClick(pp, cardBtn(A));
  const u0 = (await peek(A)).updates;
  await choose("lower:tstA");
  await wait(2500);
  let g = await peek(A);
  record("use 1: Alarm d6 -> d4, still two Complications", g.list.length === 2 && g.list.find((c) => c.id === "tstA").die === 4, g.list);
  record("use 1: 1 PP spent (5 -> 4), opportunitiesUsed 1, one card write", g.pp === 4 && g.roll.opportunitiesUsed === 1 && g.updates - u0 === 1, { pp: g.pp, used: g.roll.opportunitiesUsed, writes: g.updates - u0 });
  pc = await cardOf(pp, A);
  record("use 1: the player's card now says 1 opportunity (singular) and lists what was done", pc && /^1\b/.test(pc.strip ?? "") && pc.notes.some((n) => /Alarm/.test(n)), pc);
  gc = await cardOf(page, A);
  record("use 1: the GM's card is updated too", gc && /^1\b/.test(gc.strip ?? "") && gc.notes.some((n) => /Alarm/.test(n)), gc);
  await shotCard(pp, A, "04-card-after-one");

  /* ---- use 2: lower Dog d4 -> gone ---- */
  await domClick(pp, cardBtn(A));
  await choose("lower:tstB");
  await wait(2500);
  g = await peek(A);
  record("use 2: the d4 Dog is gone, Alarm stays", g.list.length === 1 && g.list[0].id === "tstA", g.list);
  record("use 2: PP 3, both used", g.pp === 3 && g.roll.opportunitiesUsed === 2, { pp: g.pp, roll: g.roll.opportunitiesUsed });
  pc = await cardOf(pp, A);
  record("use 2: strip and button are gone, two notes remain", pc && !pc.strip && !pc.button && pc.notes.filter((n) => /Alarm|Dog/.test(n)).length === 2, pc);
  await shotCard(pp, A, "05-card-all-used");
  record("use 2: card: no overlap, cut text or overflow", clean(await audit(pp, `.chat-message[data-message-id="${A}"] .lv-roll-card`)));

  /* ---- raise an Asset ---- */
  const B = await post([1, 5, 1, 1]);
  await wait(1500);
  await domClick(pp, cardBtn(B));
  await choose(await pp.evaluate(() => `raise:${game.actors.getName("[TEST] Crew").items.getName("[TEST] Van").id}`));
  await wait(2500);
  g = await peek(B);
  record("raise: Van boost 1, PP 3 -> 2, 1 of 3 used", g.boost["[TEST] Van"] === 1 && g.pp === 2 && g.roll.opportunitiesUsed === 1, { boost: g.boost, pp: g.pp });
  const rolled = await pp.evaluate(async () => {
    const { resolvePoolRef } = await import(foundry.utils.getRoute("systems/leverage-gta/module/dice/pool.mjs"));
    const actor = game.actors.getName("[TEST] Crew");
    const van = actor.items.getName("[TEST] Van");
    return { pool: resolvePoolRef(actor, `item:${van.id}`).die, base: van.system.die, effective: van.system.effectiveDie };
  });
  record("raise: the Pool rolls the Van as d8 (base d6 stays)", rolled.pool === 8 && rolled.base === 6 && rolled.effective === 8, rolled);
  await pp.evaluate(() => game.actors.getName("[TEST] Crew").sheet.render(true));
  await pp.waitForSelector(".lv-assets .lv-asset", { timeout: 8000 });
  await wait(800);
  const row = await pp.evaluate(() => {
    const el = [...document.querySelectorAll(".lv-assets .lv-asset")].find((r) => /Van/.test(r.textContent));
    return { text: el?.textContent.replace(/\s+/g, " ").trim(), die: el?.querySelector(".lv-die-btn")?.textContent.trim() };
  });
  record("raise: the sheet shows the raised Van (marker on the tag)", /▲1/.test(row.text ?? ""), row);
  await pp.locator(".lv-assets").first().screenshot({ path: `${SHOTS}/F10-opp-06-sheet-assets.png` }).catch(() => {});
  record("raise: sheet assets panel: no overlap, cut text or overflow", clean(await audit(pp, ".lv-assets")), await audit(pp, ".lv-assets"));
  await pp.evaluate(() => game.actors.getName("[TEST] Crew").sheet.close());

  /* ---- raise caps at d12: Lockpick d6 -> d8 -> d10 -> d12, then not offered ---- */
  const lock = await pp.evaluate(() => `raise:${game.actors.getName("[TEST] Crew").items.getName("[TEST] Lockpick").id}`);
  await page.evaluate(() => game.actors.getName("[TEST] Crew").update({ "system.plotPoints.value": 6 }));
  for (let i = 0; i < 3; i += 1) {
    const c = await post([1, 5, 2]);
    await wait(1200);
    await domClick(pp, cardBtn(c));
    await choose(lock);
    await wait(2000);
  }
  g = await peek(B);
  record("cap: Lockpick boosted 3 steps (d6 -> d12), PP 6 -> 3", g.boost["[TEST] Lockpick"] === 3 && g.pp === 3, { boost: g.boost, pp: g.pp });
  const D = await post([1, 5, 2]);
  await wait(1200);
  await domClick(pp, cardBtn(D));
  await pp.waitForSelector(".lv-dialog form select[name=choice]", { timeout: 8000 });
  const capped = await optionsOf(pp);
  record("cap: at d12 the Lockpick is no longer offered", !capped.some((o) => o.value === lock), capped);
  await closeDialog();

  /* ---- double click: one dialog ---- */
  await pp.evaluate((s) => { const b = document.querySelector(s); b.click(); b.click(); }, cardBtn(D));
  await wait(1200);
  record("concurrency: a double click opens one dialog", (await dialogCount(pp)) === 1);
  await closeDialog();

  /* ---- no Plot Point: disabled ---- */
  await page.evaluate(() => game.actors.getName("[TEST] Crew").update({ "system.plotPoints.value": 0 }));
  await wait(1500);
  pc = await cardOf(pp, D);
  record("no Plot Point: the button stays but is disabled", pc.button && pc.disabled, pc);
  await shotCard(pp, D, "07-card-no-pp");
  await page.evaluate(() => game.actors.getName("[TEST] Crew").update({ "system.plotPoints.value": 3 }));
  await wait(1200);

  /* ---- the Fixer cannot open the dialog ---- */
  const forged = await page.evaluate(async (mid) => {
    const { cardHandlers } = await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/chat/card-handlers.mjs"));
    await cardHandlers.useOpportunity(game.messages.get(mid));
    return document.querySelectorAll(".lv-dialog form select[name=choice]").length;
  }, D);
  record("permission: the Fixer cannot open the dialog", forged === 0, forged);

  /* ---- a card forged by the player is refused (author must be the Fixer) ---- */
  const beforeForged = (await peek(B)).list.find((c) => c.id === "tstA")?.die;
  const forgedReply = await pp.evaluate(async () => {
    const { requestAsGM } = await import(foundry.utils.getRoute("systems/leverage-gta/module/socket.mjs"));
    const actor = game.actors.getName("[TEST] Crew");
    const roll = { opposition: true, status: "resolved", v: 2, opportunities: 99, opportunitiesUsed: 0, entries: [] };
    const msg = await ChatMessage.create({ content: "<p>forged</p>", flavor: "[TEST] forged", flags: { "leverage-gta": { roll } } });
    const reply = await requestAsGM("useOpportunity", { messageId: msg.id, choice: { kind: "lower", id: "tstA" }, actorId: actor.id });
    return { reply, id: msg.id };
  });
  g = await peek(B);
  record("forged: a player-made opposition card is refused by the Fixer, nothing spent or lowered",
    forgedReply.reply?.ok === false && forgedReply.reply?.reason === "invalid" && g.pp === 3 && g.list.find((c) => c.id === "tstA")?.die === beforeForged, { forgedReply, pp: g.pp, list: g.list });

  /* ---- an old card expired: only the newest opposition card of the scene counts ---- */
  const oldCard = await post([1, 5, 2]);
  const newer = await post([1, 5, 3]);
  await wait(1200);
  const stale = await pp.evaluate(async (mid) => {
    const { requestAsGM } = await import(foundry.utils.getRoute("systems/leverage-gta/module/socket.mjs"));
    return requestAsGM("useOpportunity", { messageId: mid, choice: { kind: "lower", id: "tstA" } });
  }, oldCard);
  g = await peek(B);
  record("expiry: an older opposition card is refused (expired), PP unchanged", stale?.ok === false && stale?.reason === "expired" && g.pp === 3, { stale, pp: g.pp });

  /* ---- end of scene clears the boost (Van is a scene Asset: deleted; Lockpick is a Job Asset: boost 0) ---- */
  const ended = await page.evaluate(async (newerId) => {
    const { endScene } = await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/gm/job-actions.mjs"));
    await endScene({ confirm: false });
    const actor = game.actors.getName("[TEST] Crew");
    return {
      lockpick: actor.items.getName("[TEST] Lockpick")?.system.boost, van: Boolean(actor.items.getName("[TEST] Van")),
      expired: game.messages.get(newerId)?.getFlag("leverage-gta", "roll")?.opportunitiesExpired === true
    };
  }, newer);
  record("end of scene: Lockpick boost back to 0, scene Van removed, open Opportunities expired", ended.lockpick === 0 && !ended.van && ended.expired, ended);

  /* ---- a player cannot set the boost by hand; a copy of a boosted Asset starts at 0 ---- */
  const hand = await pp.evaluate(async () => {
    const actor = game.actors.getName("[TEST] Crew");
    const lock = actor.items.getName("[TEST] Lockpick");
    await lock.update({ "system.boost": 4 }).catch(() => {});
    const copy = await actor.createEmbeddedDocuments("Item", [{ ...lock.toObject(), name: "[TEST] Copy", system: { ...lock.toObject().system, boost: 3 } }]).catch(() => []);
    return { boost: lock.system.boost, copy: copy[0]?.system.boost ?? null };
  });
  record("guard: a player cannot set an Asset's boost; a created Asset starts at 0", hand.boost === 0 && (hand.copy === null || hand.copy === 0), hand);

  record("console: no system errors (GM)", log.own().length === 0, log.own());
  record("console: no system errors (player)", playerLog.own().length === 0, playerLog.own());
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 8).join(" | "));
  await pp?.screenshot({ path: `${SHOTS}/F10-opp-failure-player.png` }).catch(() => {});
  await page.screenshot({ path: `${SHOTS}/F10-opp-failure-gm.png` }).catch(() => {});
} finally {
  await playerBrowser?.browser.close().catch(() => {});
  await page.evaluate(async (prev) => {
    const made = game.messages.filter((m) => !window.__before?.has(m.id)).map((m) => m.id);
    if (made.length) await ChatMessage.deleteDocuments(made);
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) await a.delete();
    await game.users.getName("[TEST] Player")?.delete();
    if (prev) {
      await game.settings.set("leverage-gta", "complications", prev.list);
      await game.settings.set("leverage-gta", "globalTraits", prev.traits);
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
