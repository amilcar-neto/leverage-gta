/**
 * Versus and effect actions (T-1011/T-1012) in the real Foundry. GM browser + a [TEST] Player who owns a [TEST] Crew.
 * Checks: the Choose dice window offers "vs last GM roll" only when a resolved Fixer card is older, never on by itself;
 * confirming with the link saves `versus` (margin, heroic steps, final effect); the card shows the band; the player's
 * "Create Asset dX" (free, scene, name required) and the GM's "Complication dX"; the Fixer card's "Complication =
 * effect" after a loss; the opposition roller reads the newest player roll (inverted order). Everything is `[TEST]` and
 * removed; the `complications` setting is restored. Client language pt-BR (keys must be in lang/).
 *
 * Screenshots: tests/foundry/screenshots/F10-versus-*.png. Exit codes: 0 pass, 1 fail. Run after `npm run deploy`.
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
const clean = (r) => r?.overlaps?.length === 0 && r?.cut?.length === 0 && r?.outside?.length === 0;
const domClick = (p, selector) => p.evaluate((s) => document.querySelector(s)?.click(), selector);
const shotCard = async (p, id, name) => {
  const loc = p.locator(`.chat-message[data-message-id="${id}"]`);
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await wait(500);
  await loc.screenshot({ path: `${SHOTS}/F10-versus-${name}.png` }).catch(() => {});
};

/** Posts a Fixer card (resolved by the rules, d8 dice). */
const postFixer = (values) => page.evaluate(async (vals) => {
  const { buildOppositionData } = await import(foundry.utils.getRoute("systems/leverage-gta/module/dice/opposition.mjs"));
  const dice = vals.map((_, i) => ({ ref: `opp.${i}`, label: "Opposition", kind: "opposition", die: 8 }));
  const data = buildOppositionData({ dice, values: vals, name: "GM", flavor: "[TEST] Versus" });
  return (await ChatMessage.create({ content: "<p>t</p>", flavor: data.flavor, flags: { "leverage-gta": { roll: data } } })).id;
}, values);

/** Posts a pending prime card of the test Crew (d10, d8, d6). */
const postPlayer = (values, dice = [10, 8, 6]) => page.evaluate(async ([vals, sizes]) => {
  const { buildRollData } = await import(foundry.utils.getRoute("systems/leverage-gta/module/dice/roll-core.mjs"));
  const actor = game.actors.getName("[TEST] Crew");
  const entries = sizes.map((die, i) => ({ ref: `e${i}`, label: `d${die}`, kind: "die", die }));
  const data = buildRollData({ entries, values: vals, actorUuid: actor.uuid, actorName: actor.name, actorImg: actor.img, flavor: "[TEST] Player roll", mode: "prime", ppAtRoll: 5 });
  return (await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: "<p>t</p>", flavor: data.flavor, flags: { "leverage-gta": { roll: data } } })).id;
}, [values, dice]);

const rollOf = (id) => page.evaluate((mid) => game.messages.get(mid)?.getFlag("leverage-gta", "roll") ?? null, id);
const complications = () => page.evaluate(() => game.settings.get("leverage-gta", "complications"));
const buttons = (p, id) => p.evaluate((mid) => [...document.querySelectorAll(`.chat-message[data-message-id="${mid}"] .lv-roll-actions button`)].map((b) => b.dataset.action), id);

/** Opens the window on the player's browser, picks the automatic total and, with `link`, turns the versus on. */
async function resolveAs(id, { link }) {
  await pp.evaluate(async (mid) => {
    const { openResolveDice } = await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/dialogs/resolve-dice.mjs"));
    await openResolveDice(game.messages.get(mid));
  }, id);
  await pp.waitForSelector(`#lv-resolve-${id} [data-action="autoTotal"]`, { timeout: 8000 });
  await domClick(pp, `#lv-resolve-${id} [data-action="autoTotal"]`);
  await wait(400);
  if (link) {
    await domClick(pp, `#lv-resolve-${id} [data-action="toggleVersus"]`);
    await wait(500);
  }
}

try {
  await login(page, env);
  saved = await page.evaluate(async () => {
    const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    const player = await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    await Actor.create({ name: "[TEST] Crew", type: "crew", system: { plotPoints: { value: 5 } }, ownership: { default: 0, [player.id]: OWNER } });
    window.__before = new Set(game.messages.map((m) => m.id));
    const before = { list: game.settings.get("leverage-gta", "complications") };
    await game.settings.set("leverage-gta", "complications", []);
    ui.sidebar.expand?.(); ui.sidebar.changeTab?.("chat", "primary");
    return before;
  });
  playerBrowser = await openBrowser(env, { secondary: true });
  pp = playerBrowser.page;
  playerLog = collectConsole(pp);
  await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });
  await pp.evaluate(() => { ui.sidebar.expand?.(); ui.sidebar.changeTab?.("chat", "primary"); });
  await wait(1000);

  /* ---- Fixer card A (total 11), then the player's roll: heroic win ---- */
  const A = await postFixer([6, 5, 4]);
  await wait(1200);
  const P1 = await postPlayer([9, 8, 3]);
  await wait(1200);
  await resolveAs(P1, { link: false });
  const label = await pp.evaluate((id) => document.querySelector(`#lv-resolve-${id} [data-action="toggleVersus"]`)?.textContent.trim(), P1);
  record("window: offers 'vs último do Mestre (total 11)'", /11/.test(label ?? "") && /Mestre/.test(label ?? ""), label);
  const off = await pp.evaluate((id) => ({ pressed: document.querySelector(`#lv-resolve-${id} [data-action="toggleVersus"]`).getAttribute("aria-pressed"), note: Boolean(document.querySelector(`#lv-resolve-${id} .lv-rd-versus`)) }), P1);
  record("window: the link is off by default (no note in the footer)", off.pressed === "false" && !off.note, off);
  await domClick(pp, `#lv-resolve-${P1} [data-action="toggleVersus"]`);
  await wait(500);
  const on = await pp.evaluate((id) => document.querySelector(`#lv-resolve-${id} .lv-rd-versus`)?.textContent.trim(), P1);
  record("window: with the link on the footer says 'Supera por 6'", /Supera por 6/.test(on ?? ""), on);
  await pp.locator(`#lv-resolve-${P1}`).screenshot({ path: `${SHOTS}/F10-versus-01-window.png` }).catch(() => {});
  record("window: no overlap, cut text or overflow", clean(await audit(pp, `#lv-resolve-${P1}`)), await audit(pp, `#lv-resolve-${P1}`));
  await domClick(pp, `#lv-resolve-${P1} [data-action="confirm"]`);
  await wait(2500);
  let r = await rollOf(P1);
  record("heroic: versus saved with margin 6, heroic, 1 step, effect d6 -> d8", r?.versus?.messageId === A && r.versus.margin === 6 && r.versus.outcome === "heroic" && r.versus.steps === 1 && r.versus.effectDie === 8, r?.versus);
  await shotCard(pp, P1, "02-card-heroic");
  const band = await pp.evaluate((id) => document.querySelector(`.chat-message[data-message-id="${id}"] .lv-roll-versus`)?.textContent.replace(/\s+/g, " ").trim(), P1);
  record("heroic: the card shows HEROICO +1 passo and EFEITO d8", /Heroico/i.test(band ?? "") && /\+1 passo/.test(band ?? "") && /d8/.test(band ?? ""), band);
  record("heroic: band: no overlap, cut text or overflow", clean(await audit(pp, `.chat-message[data-message-id="${P1}"] .lv-roll-card`)), await audit(pp, `.chat-message[data-message-id="${P1}"] .lv-roll-card`));

  /* ---- effect actions on the won card ---- */
  const gmBtns = await buttons(page, P1);
  const plBtns = await buttons(pp, P1);
  record("actions: GM gets Complication, player gets Create Asset (and not the other's)", gmBtns.includes("effectComplication") && !gmBtns.includes("effectAsset") && plBtns.includes("effectAsset") && !plBtns.includes("effectComplication"), { gmBtns, plBtns });
  await domClick(pp, `.chat-message[data-message-id="${P1}"] [data-action="effectAsset"]`);
  await pp.waitForSelector(".lv-dialog form input[name=name]", { timeout: 8000 });
  const dlg = await pp.evaluate(() => ({ text: document.querySelector(".lv-dialog")?.textContent.replace(/\s+/g, " "), hasDuration: Boolean(document.querySelector('.lv-dialog select[name="duration"]')), hasDie: Boolean(document.querySelector('.lv-dialog select[name="die"]')) }));
  record("asset dialog: name only, effect die d8 and 'não custa Plot Points' shown", /d8/.test(dlg.text) && /Plot Points/.test(dlg.text) && !dlg.hasDuration && !dlg.hasDie, dlg);
  await pp.screenshot({ path: `${SHOTS}/F10-versus-03-asset-dialog.png` });
  record("asset dialog: nothing overlaps or is cut", clean(await audit(pp, ".lv-dialog")), await audit(pp, ".lv-dialog"));
  await domClick(pp, '.lv-dialog button[data-action="ok"]');
  await wait(800);
  record("asset dialog: a name is required (dialog stays open when empty)", await pp.evaluate(() => Boolean(document.querySelector(".lv-dialog form input[name=name]"))));
  await pp.evaluate(() => { const i = document.querySelector(".lv-dialog form input[name=name]"); i.value = "[TEST] Smoke screen"; i.dispatchEvent(new Event("input", { bubbles: true })); });
  await domClick(pp, '.lv-dialog button[data-action="ok"]');
  await wait(2500);
  const asset = await page.evaluate(() => { const a = game.actors.getName("[TEST] Crew"); const i = a.items.getName("[TEST] Smoke screen"); return { die: i?.system.die, duration: i?.system.duration, pp: a.system.plotPoints.value }; });
  record("asset: created as a Scene Asset d8, Plot Points untouched (5)", asset.die === 8 && asset.duration === "scene" && asset.pp === 5, asset);
  record("asset: the button is gone after use", !(await buttons(pp, P1)).includes("effectAsset"), await buttons(pp, P1));
  await domClick(page, `.chat-message[data-message-id="${P1}"] [data-action="effectComplication"]`);
  await wait(2000);
  const list1 = await complications();
  record("complication: d8 Complication written to the table, button gone", list1.length === 1 && list1[0].die === 8 && !(await buttons(page, P1)).includes("effectComplication"), list1);
  await shotCard(page, P1, "04-card-used");

  /* ---- a loss, then the Fixer's Complication ---- */
  const A2 = await postFixer([7, 6, 4]);
  await wait(1200);
  const P2 = await postPlayer([4, 3, 2]);
  await wait(1200);
  await resolveAs(P2, { link: true });
  const fail = await pp.evaluate((id) => document.querySelector(`#lv-resolve-${id} .lv-rd-versus`)?.textContent.trim(), P2);
  record("loss: the footer says 'Falha por 6'", /Falha por 6/.test(fail ?? ""), fail);
  await domClick(pp, `#lv-resolve-${P2} [data-action="confirm"]`);
  await wait(2500);
  r = await rollOf(P2);
  record("loss: versus saved as fail, margin -6, effect unchanged (d6)", r?.versus?.messageId === A2 && r.versus.outcome === "fail" && r.versus.margin === -6 && r.versus.effectDie === 6, r?.versus);
  await shotCard(pp, P2, "05-card-fail");
  const failBtns = await buttons(page, P2);
  record("loss: no effect buttons on a failed roll", !failBtns.includes("effectComplication") && !(await buttons(pp, P2)).includes("effectAsset"), failBtns);
  const fixerBtns = await buttons(page, A2);
  record("loss: the Fixer card offers 'Complication = efeito d8'", fixerBtns.includes("fixerComplication"), fixerBtns);
  await shotCard(page, A2, "06-fixer-card");
  record("loss: Fixer card: no overlap, cut text or overflow", clean(await audit(page, `.chat-message[data-message-id="${A2}"] .lv-roll-card`)), await audit(page, `.chat-message[data-message-id="${A2}"] .lv-roll-card`));
  await domClick(page, `.chat-message[data-message-id="${A2}"] [data-action="fixerComplication"]`);
  await wait(2500);
  const list2 = await complications();
  r = await rollOf(P2);
  record("loss: Complication d8 added (loser's d6 < d8), player's link marked, button gone", list2.length === 2 && list2[1].die === 8 && r.versus.complicationMade === true && !(await buttons(page, A2)).includes("fixerComplication"), { list2, v: r?.versus });

  /* ---- link not made without asking ---- */
  const P3 = await postPlayer([7, 6, 3]);
  await wait(1200);
  await resolveAs(P3, { link: false });
  await domClick(pp, `#lv-resolve-${P3} [data-action="confirm"]`);
  await wait(2500);
  r = await rollOf(P3);
  record("opt-in: confirming without the link saves no versus", r?.status === "resolved" && r.versus === undefined, r?.versus);

  /* ---- inverted order: the opposition roller reads the player's roll ---- */
  const P4 = await postPlayer([9, 8, 3]);
  await wait(1200);
  await resolveAs(P4, { link: false });
  await domClick(pp, `#lv-resolve-${P4} [data-action="confirm"]`);
  await wait(2500);
  await page.evaluate(async () => { const { openOppositionRoller } = await import(foundry.utils.getRoute("systems/leverage-gta/module/dice/opposition.mjs")); await openOppositionRoller(); });
  await page.waitForSelector('#leverage-opposition-roller [data-action="roll"]', { timeout: 8000 });
  const chip = await page.evaluate(() => { const b = document.querySelector('#leverage-opposition-roller [data-action="toggleVersus"]'); return { text: b?.textContent.trim(), pressed: b?.getAttribute("aria-pressed") }; });
  record("roller: offers the newest player roll (17), off by default", /17/.test(chip.text ?? "") && chip.pressed === "false", chip);
  await domClick(page, '#leverage-opposition-roller [data-action="toggleVersus"]');
  await wait(400);
  await page.locator("#leverage-opposition-roller").screenshot({ path: `${SHOTS}/F10-versus-07-roller.png` }).catch(() => {});
  record("roller: no overlap, cut text or overflow", clean(await audit(page, "#leverage-opposition-roller")), await audit(page, "#leverage-opposition-roller"));
  await domClick(page, '#leverage-opposition-roller [data-action="roll"]');
  await wait(2500);
  const linked = await page.evaluate((mid) => {
    const roll = game.messages.get(mid).getFlag("leverage-gta", "roll");
    const fixer = game.messages.get(roll.versus?.messageId);
    return { versus: roll.versus, fixerTotal: fixer?.getFlag("leverage-gta", "roll")?.total, opposition: Boolean(fixer?.getFlag("leverage-gta", "roll")?.opposition) };
  }, P4);
  record("roller: the player's card got a versus against the new Fixer card (difficulty = its total)", linked.opposition && linked.versus?.difficulty === linked.fixerTotal && linked.versus.margin === 17 - linked.fixerTotal, linked);
  await page.evaluate(() => foundry.applications.instances.get("leverage-opposition-roller")?.close());

  record("console: no system errors (GM)", log.own().length === 0, log.own());
  record("console: no system errors (player)", playerLog.own().length === 0, playerLog.own());
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 8).join(" | "));
  await pp?.screenshot({ path: `${SHOTS}/F10-versus-failure-player.png` }).catch(() => {});
  await page.screenshot({ path: `${SHOTS}/F10-versus-failure-gm.png` }).catch(() => {});
} finally {
  await playerBrowser?.browser.close().catch(() => {});
  await page.evaluate(async (prev) => {
    const made = game.messages.filter((m) => !window.__before?.has(m.id)).map((m) => m.id);
    if (made.length) await ChatMessage.deleteDocuments(made);
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) await a.delete();
    await game.users.getName("[TEST] Player")?.delete();
    if (prev) await game.settings.set("leverage-gta", "complications", prev.list);
  }, saved).catch(() => {});
  const left = await page.evaluate(() => game.messages.filter((m) => m.flavor?.includes("[TEST]")).length).catch(() => "?");
  record("cleanup: no [TEST] message left", left === 0, left);
}
for (const x of results) console.log(`${x.ok ? "PASS" : "FAIL"} ${x.name}${x.detail ? ` ${x.detail}` : ""}`);
const own = [...log.own(), ...(playerLog?.own() ?? [])];
console.log(`CONSOLE (system errors): ${own.length ? own.join(" || ") : "clean"}`);
await browser.close();
process.exit(results.every((x) => x.ok) ? 0 : 1);
