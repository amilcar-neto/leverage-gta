/* global Scene */
/**
 * T-1101 party check: GM HUD with party Money AND the Plot Points panel both open, 3 `[TEST]` Crews owned by a player.
 * Layout (same width, aligned, no overlap, no unmarked clipped text, stars and side bar uncovered), fast double click on
 * the Mesa +, and `game.leverage.rollPool` with `scene:<id>` of a Location Trait of the viewed Scene.
 * Exit: 0 pass, 1 fail, 2 n/a.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const S = "leverage-gta";
let ids = null;
let saved = null;

try {
  await login(page, env);
  saved = await page.evaluate((s) => ({ table: game.settings.get(s, "tablePlotPoints"), pp: game.settings.get(s, "hud.showPlotPoints"), party: game.settings.get(s, "hud.showPartyMoney"), collapsed: game.settings.get(s, "hud.partyCollapsed"), active: game.scenes.active?.id ?? null }), S);
  ids = await page.evaluate(async (s) => {
    await game.settings.set(s, "hud.showPlotPoints", true);
    await game.settings.set(s, "hud.showPartyMoney", true);
    await game.settings.set(s, "hud.partyCollapsed", false);
    await game.settings.set(s, "tablePlotPoints", 0);
    let user = game.users.find((u) => u.name === "[TEST] Player");
    const created = !user;
    user ??= await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    const names = ["[TEST] Party Alpha", "[TEST] Party Beta with an extremely long character name to force ellipsis", "[TEST] Party Gamma"];
    const crews = [];
    for (const name of names) crews.push(await Actor.create({ name, type: "crew", ownership: { default: 0, [user.id]: 3 }, system: { plotPoints: { value: 2 }, attributes: { agility: { die: 8 } }, roles: { thief: { die: 8 } } } }));
    const scene = await Scene.create({ name: "[TEST] Party Scene" });
    const loc = await Actor.create({ name: "[TEST] Party Place", type: "location", system: { scene: scene.uuid, traits: [{ name: "[TEST] Party Trait", die: 8 }] } });
    await scene.activate();
    return { user: user.id, created, crews: crews.map((c) => c.id), scene: scene.id, loc: loc.id };
  }, S);
  await page.waitForFunction((id) => canvas?.scene?.id === id, ids.scene, { timeout: 30000 });
  await page.waitForSelector("#leverage-hud .lv-hud-gmpp", { timeout: 10000 });
  await page.waitForSelector("#leverage-hud .lv-hud-party", { timeout: 10000 });
  await page.evaluate(async (list) => { for (const id of list) await game.actors.get(id).setFlag("leverage-gta", "tmpTouch", 1); }, ids.crews);
  await page.waitForTimeout(1200);
  await page.mouse.move(960, 600);

  // ---- Layout
  const lay = await page.evaluate(() => {
    const r = (el) => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
    const hud = document.querySelector("#leverage-hud");
    const party = hud.querySelector(".lv-hud-party");
    const gm = hud.querySelector(".lv-hud-gmpp");
    const out = { party: r(party), gm: r(gm), hud: r(hud), win: { w: innerWidth, h: innerHeight } };
    out.partyRows = party.querySelectorAll("li").length;
    out.gmRows = gm.querySelectorAll("li").length;
    // text clipping without ellipsis
    out.clipped = [...hud.querySelectorAll(".lv-hud-party-title, .lv-hud-panel-name, .lv-hud-text")].filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => {
      const cs = getComputedStyle(el);
      return { cls: el.className, text: el.textContent.trim().slice(0, 40), overflow: cs.textOverflow, ws: cs.whiteSpace, sw: el.scrollWidth, cw: el.clientWidth };
    }).filter((x) => !(x.overflow === "ellipsis" && x.ws === "nowrap"));
    // overflow of children beyond their panel
    out.escape = [...party.querySelectorAll("*"), ...gm.querySelectorAll("*")].filter((el) => {
      const p = el.closest(".lv-hud-panel").getBoundingClientRect(); const b = el.getBoundingClientRect();
      return b.width > 0 && (b.right > p.right + 0.5 || b.left < p.left - 0.5);
    }).map((el) => el.className.toString().slice(0, 40));
    // other HUD parts
    const parts = {};
    for (const [k, sel] of Object.entries({ stars: ".lv-hud-stars, [class*='lv-hud-star']", money: ".lv-hud-money", pp: ".lv-hud-pp", partyBtn: ".lv-hud-party-btn" })) {
      const el = hud.querySelector(sel); if (el) parts[k] = r(el);
    }
    out.parts = parts;
    out.sidebar = (() => { const sb = document.querySelector("#sidebar-tabs, #sidebar > .tabs, #sidebar menu"); return sb ? r(sb) : null; })();
    // elementFromPoint at the centre of stars
    out.covered = {};
    for (const k of ["stars", "money"]) {
      const p = parts[k]; if (!p) continue;
      const el = document.elementFromPoint(p.x + p.w / 2, p.y + p.h / 2);
      out.covered[k] = el?.closest(".lv-hud-party, .lv-hud-gmpp") ? "covered" : "ok";
    }
    return out;
  });
  console.log("layout", JSON.stringify(lay));
  record("party panel has 3 test rows", lay.partyRows >= 3, lay.partyRows);
  record("PP panel has 3 test rows", lay.gmRows >= 3, lay.gmRows);
  record("panels have the same width", Math.abs(lay.party.w - lay.gm.w) < 1, { party: lay.party.w, gm: lay.gm.w });
  record("panels are left/right aligned", Math.abs(lay.party.x - lay.gm.x) < 1 && Math.abs(lay.party.r - lay.gm.r) < 1, { party: lay.party, gm: lay.gm });
  record("panels do not overlap (party above/below PP)", lay.party.b <= lay.gm.y + 0.5 || lay.gm.b <= lay.party.y + 0.5, { party: lay.party, gm: lay.gm });
  record("no unmarked clipped text", lay.clipped.length === 0, lay.clipped);
  record("nothing escapes its panel", lay.escape.length === 0, lay.escape);
  record("panels inside the window", lay.gm.b < lay.win.h && lay.party.b < lay.win.h && lay.gm.r <= lay.win.w && lay.party.r <= lay.win.w, lay);
  record("stars/money not covered by the panels", Object.values(lay.covered).every((v) => v === "ok"), lay.covered);
  const hits = (a, b) => !(a.r <= b.x || b.r <= a.x || a.b <= b.y || b.b <= a.y);
  const others = Object.entries(lay.parts).filter(([k]) => k !== "partyBtn");
  record("panels do not intersect stars/money/own PP", others.every(([, p]) => !hits(p, lay.party) && !hits(p, lay.gm)), { parts: lay.parts, party: lay.party, gm: lay.gm });
  record("panels do not touch the right sidebar", !lay.sidebar || (!hits(lay.sidebar, lay.party) && !hits(lay.sidebar, lay.gm)), { sidebar: lay.sidebar });
  await page.screenshot({ path: `${SHOTS}/F10-hud-party-and-pp.png` });

  // ---- Fast double click on Mesa +
  await page.evaluate((s) => game.settings.set(s, "tablePlotPoints", 0), S);
  await page.waitForTimeout(600);
  await page.locator('#leverage-hud [data-action="stepTablePoints"][data-delta="1"]').dblclick({ delay: 0 });
  await page.waitForTimeout(1500);
  const table = await page.evaluate((s) => game.settings.get(s, "tablePlotPoints"), S);
  const shown = (await page.locator("#leverage-hud .lv-hud-gmpp-table .lv-hud-gmpp-value").innerText()).trim();
  record("fast double click on Mesa + adds 2", table === 2 && shown === "2", { setting: table, ui: shown });

  // ---- Macro: rollPool with scene:<id> of a Location Trait of the viewed Scene
  const roll = await page.evaluate(async ([crew, loc]) => {
    const warns = [];
    const orig = ui.notifications.warn.bind(ui.notifications);
    ui.notifications.warn = (m, ...a) => { warns.push(String(m)); return orig(m, ...a); };
    const trait = { id: `${loc}-test-party-trait-0` };
    const fn = game.leverage.rollPool;
    const hasPoolRoll = typeof game.leverage.pool?.roll === "function";
    const before = game.messages.size;
    let msg = null;
    try { msg = await fn({ actor: crew, refs: ["attributes.agility", "roles.thief", `scene:${trait.id}`], flavor: "[TEST] scene trait" }); } catch (e) { warns.push(String(e)); }
    ui.notifications.warn = orig;
    return { id: trait.id, hasPoolRoll, ok: Boolean(msg), added: game.messages.size - before, warns };
  }, [ids.crews[0], ids.loc]);
  record("game.leverage.rollPool accepts scene:<id> of a Location Trait (viewed Scene)", roll.ok && roll.warns.length === 0, roll);
  console.log(`note: game.leverage.pool.roll exists: ${roll.hasPoolRoll}`);
} catch (error) {
  record("script", false, String(error?.stack ?? error));
} finally {
  try {
    await page.evaluate(async ([i, s, before]) => {
      for (const id of i?.crews ?? []) await game.actors.get(id)?.delete();
      await game.actors.get(i?.loc)?.delete();
      if (before) {
        const orig = before.active ? game.scenes.get(before.active) : null;
        if (orig) await orig.activate();
        await game.settings.set(s, "tablePlotPoints", before.table);
        await game.settings.set(s, "hud.showPlotPoints", before.pp);
        await game.settings.set(s, "hud.showPartyMoney", before.party);
        await game.settings.set(s, "hud.partyCollapsed", before.collapsed);
      }
      await game.scenes.get(i?.scene)?.delete();
      if (i?.created) await game.users.get(i.user)?.delete();
    }, [ids, S, saved]);
  } catch (e) { record("cleanup", false, String(e)); }
  await browser.close();
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
console.log(`console errors (system): ${log.own().length}`);
log.own().forEach((e) => console.log(`  ${e.slice(0, 400)}`));
console.log(`console errors (other): ${log.other().length}`);
log.other().slice(0, 8).forEach((e) => console.log(`  ${e.slice(0, 200)}`));
process.exit(results.every((r) => r.ok) ? 0 : 1);
