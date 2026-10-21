/**
 * T-701 check: the HUD (stars, Money, Plot Points) in the real Foundry, as GM and as a `[TEST]` Player.
 * Creates one `[TEST]` crew character with Money and Plot Points, clicks stars, Money and Plot Points, collapses the
 * sidebar, measures the position, takes T-701-open / -collapsed / -empty screenshots, restores the settings it
 * touched and deletes every `[TEST]` document. Run after `npm run deploy`. Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const S = "leverage-gta";
let playerBrowser = null;
let saved = null;
let oldCharacter;

const hudState = (p) => p.evaluate(() => {
  const el = document.getElementById("leverage-hud");
  if (!el) return null;
  const box = (e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) }; };
  const sidebar = (ui.sidebar?.element ?? document.getElementById("sidebar")).getBoundingClientRect();
  const kids = [...el.querySelectorAll(".lv-hud-stars, .lv-hud-money, .lv-hud-pp")].map(box);
  const right = kids.length ? Math.max(...kids.map((k) => k.r)) : 0;
  return {
    parent: el.parentElement?.id, stars: el.querySelectorAll(".lv-hud-star").length, on: el.querySelectorAll(".lv-hud-star.is-on").length,
    disabledStars: el.querySelectorAll(".lv-hud-star:disabled").length,
    dice: el.querySelectorAll(".lv-hud-money .lv-die").length, hasMoney: Boolean(el.querySelector(".lv-hud-money")),
    hasPp: Boolean(el.querySelector(".lv-hud-pp")), hasStars: Boolean(el.querySelector(".lv-hud-stars")),
    pp: el.querySelector(".lv-hud-pp-value")?.textContent.trim(), gap: Math.round(sidebar.left - right), sidebarLeft: Math.round(sidebar.left),
    boxes: kids, moneyTip: el.querySelector(".lv-hud-money")?.dataset.tooltip, ppTip: el.querySelector(".lv-hud-pp")?.dataset.tooltip,
    dim: Boolean(el.querySelector(".is-dim")), z: getComputedStyle(el).zIndex
  };
});
const clearNotes = (p) => p.evaluate(() => ui.notifications?.clear?.());
const wait = async (p, ms) => { await clearNotes(p); await p.waitForTimeout(ms); };
const setting = (p, key) => p.evaluate(([s, k]) => game.settings.get(s, k), [S, key]);
const setSetting = (p, key, value) => p.evaluate(([s, k, v]) => game.settings.set(s, k, v), [S, key, value]);
const closeDialogs = (p) => p.evaluate(() => { for (const a of foundry.applications.instances.values()) if (a.element?.classList.contains("lv-dialog")) a.close(); });
const clip = { x: 1100, y: 0, width: 820, height: 260 };

try {
  await login(page, env);
} catch (err) {
  console.log(`FOUNDRY: not available - ${err.message.split("\n")[0]}`);
  await browser.close();
  process.exit(2);
}

try {
  const setup = await page.evaluate(async (s) => {
    const keys = ["wanted", "hud.showStars", "hud.showMoney", "hud.showPlotPoints", "hud.minimized", "houseRules.stars", "houseRules.money"];
    const saved = Object.fromEntries(keys.map((k) => [k, foundry.utils.deepClone(game.settings.get(s, k))]));
    const player = game.users.getName("[TEST] Player") ?? await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    const actor = await Actor.create({
      name: "[TEST] Hud", type: "crew", system: { plotPoints: { value: 3 }, money: { steps: 7 } },
      ownership: { default: 0, [player.id]: 3 }
    });
    await player.update({ character: actor.id });
    const old = game.user.character?.id ?? null;
    await game.user.update({ character: actor.id });
    await game.settings.set(s, "wanted", { city: "liberty", level: 2 });
    for (const k of keys.slice(1)) await game.settings.set(s, k, k !== "hud.minimized");
    return { saved, id: actor.id, playerId: player.id, old };
  }, S);
  saved = setup.saved;
  oldCharacter = setup.old;
  await page.evaluate(() => ui.sidebar.expand());
  await wait(page, 1500);

  // GM, sidebar open.
  let st = await hudState(page);
  record("HUD exists inside #interface", st?.parent === "interface", st?.parent);
  record("five stars, two on", st?.stars === 5 && st?.on === 2, st);
  record("Money shows 2 dice for 7 steps", st?.dice === 2, st?.dice);
  record("Plot Points show 3", st?.pp === "3", st?.pp);
  record("gap to the sidebar is 16px", Math.abs(st?.gap - 16) <= 1, st);
  record("above sheet windows (z follows the core counter, min 500)", Number(st?.z) >= 500, st?.z);
  const overlap = await page.evaluate(() => {
    const h = document.getElementById("leverage-hud").getBoundingClientRect();
    const hit = (sel) => [...document.querySelectorAll(sel)].some((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.left < h.right && r.right > h.left && r.top < h.bottom && r.bottom > h.top;
    });
    return { sidebar: hit("#sidebar"), hotbar: hit("#hotbar"), chat: hit("#chat-notifications .chat-message"), chatBox: JSON.stringify((({ position, top, right }) => ({ position, top, right }))(getComputedStyle(document.getElementById("chat-notifications")))) };
  });
  record("HUD does not overlap sidebar, hotbar or chat popups", !overlap.sidebar && !overlap.hotbar && !overlap.chat, overlap);
  await page.screenshot({ path: `${SHOTS}/T-701-open.png`, clip });

  // Stars (GM).
  const star = (n) => page.locator(`#leverage-hud .lv-hud-star[data-level="${n}"]`);
  await star(4).click(); await wait(page, 900);
  record("GM click on star 4 sets level 4", (await setting(page, "wanted")).level === 4, await setting(page, "wanted"));
  await star(4).click(); await wait(page, 900);
  record("click on the current star lowers by one", (await setting(page, "wanted")).level === 3, await setting(page, "wanted"));
  await setSetting(page, "wanted", { city: "liberty", level: 1 }); await wait(page, 600);
  await star(1).click(); await wait(page, 900);
  record("first star clears the stars", (await setting(page, "wanted")).level === 0);
  record("stars update on the HUD", (await hudState(page)).on === 0);
  await setSetting(page, "wanted", { city: "liberty", level: 2 }); await wait(page, 600);

  // Plot Points.
  const ppOf = () => page.evaluate((id) => game.actors.get(id).system.plotPoints.value, setup.id);
  await clearNotes(page); await page.locator('#leverage-hud button[data-action="gainPlotPoint"]').click(); await wait(page, 700);
  record("+ gains a Plot Point", (await ppOf()) === 4 && (await hudState(page)).pp === "4", await ppOf());
  await clearNotes(page); await page.locator('#leverage-hud button[data-action="spendPlotPoint"]').click(); await wait(page, 700);
  record("- spends a Plot Point", (await ppOf()) === 3);
  await clearNotes(page); await page.locator("#leverage-hud .lv-hud-pp-value").click({ button: "right" }); await wait(page, 700);
  record("right click on the number spends one", (await ppOf()) === 2);
  await clearNotes(page); await page.locator("#leverage-hud .lv-hud-pp-value").click(); await wait(page, 700);
  record("left click on the number gains one", (await ppOf()) === 3);

  // Money dialogs.
  const dialogs = () => page.locator(".application.lv-dialog");
  await clearNotes(page); await page.locator("#leverage-hud .lv-hud-money").click(); await wait(page, 900);
  record("left click on Money opens the Pay dialog", (await dialogs().count()) > 0);
  await closeDialogs(page); await wait(page, 500);
  await clearNotes(page); await page.locator("#leverage-hud .lv-hud-money").click({ button: "right" }); await wait(page, 900);
  const lendOpen = (await dialogs().count()) > 0;
  const lendWarned = await page.locator("#notifications .notification").count();
  record("right click on Money opens the Lend dialog (or warns without a second character)", lendOpen || lendWarned > 0, { lendOpen, lendWarned });
  await closeDialogs(page); await wait(page, 500);

  // Sidebar collapse.
  const before = (await hudState(page)).sidebarLeft;
  await page.evaluate(() => ui.sidebar.collapse()); await wait(page, 1200);
  st = await hudState(page);
  record("sidebar moved on collapse", st.sidebarLeft !== before, { before, after: st.sidebarLeft });
  record("gap stays 16px after collapse", Math.abs(st.gap - 16) <= 1, st.gap);
  await page.screenshot({ path: `${SHOTS}/T-701-collapsed.png`, clip });
  await page.evaluate(() => ui.sidebar.expand()); await wait(page, 1200);
  st = await hudState(page);
  record("gap stays 16px after expand", Math.abs(st.gap - 16) <= 1 && st.sidebarLeft === before, { gap: st.gap, left: st.sidebarLeft, before });

  // A narrower window (like a bigger UI scale).
  await page.setViewportSize({ width: 1400, height: 900 }); await wait(page, 1000);
  st = await hudState(page);
  record("gap stays 16px after resizing the window", Math.abs(st.gap - 16) <= 1, st.gap);
  await page.setViewportSize({ width: 1920, height: 1080 }); await wait(page, 800);

  // Minimized and hidden parts.
  await setSetting(page, "hud.minimized", true); await wait(page, 700);
  st = await hudState(page);
  record("minimized: only stars", st.hasStars && !st.hasMoney && !st.hasPp, st);
  await setSetting(page, "hud.minimized", false);
  await setSetting(page, "hud.showStars", false); await wait(page, 700);
  record("showStars off hides stars", !(await hudState(page)).hasStars);
  await setSetting(page, "hud.showStars", true);
  await setSetting(page, "houseRules.money", false); await wait(page, 700);
  record("houseRules.money off hides Money", !(await hudState(page)).hasMoney);
  await setSetting(page, "houseRules.money", true);
  await setSetting(page, "houseRules.stars", false); await wait(page, 700);
  record("houseRules.stars off hides stars", !(await hudState(page)).hasStars);
  await setSetting(page, "houseRules.stars", true); await wait(page, 700);

  // GM without a character: stars only.
  await page.evaluate(() => game.user.update({ character: null })); await wait(page, 900);
  st = await hudState(page);
  record("GM without character: only stars", st.hasStars && !st.hasMoney && !st.hasPp, st);
  await page.evaluate((id) => game.user.update({ character: id }), setup.id);

  // Player.
  playerBrowser = await openBrowser(env, { secondary: true });
  const pp = playerBrowser.page;
  const playerLog = collectConsole(pp);
  await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });
  await pp.evaluate(() => ui.sidebar.expand());
  await pp.waitForSelector("#leverage-hud .lv-hud-star", { timeout: 10000 }).catch(() => {});
  await wait(pp, 1000);
  st = await hudState(pp);
  record("player sees stars, Money and Plot Points", st?.hasStars && st?.hasMoney && st?.hasPp, st);
  record("player: stars are read only", st?.disabledStars === 5, st?.disabledStars);
  record("player: gap 16px", Math.abs(st?.gap - 16) <= 1, st?.gap);
  record("player has no gain Plot Point button (GM only)", (await pp.locator('#leverage-hud button[data-action="gainPlotPoint"]').count()) === 0);
  await clearNotes(pp); await pp.locator('#leverage-hud button[data-action="spendPlotPoint"]').click(); await wait(pp, 800);
  await clearNotes(pp); await pp.locator("#leverage-hud .lv-hud-money").click(); await wait(pp, 900);
  record("player: click on Money opens the Pay dialog", (await pp.locator(".application.lv-dialog").count()) > 0);
  await closeDialogs(pp);
  await pp.locator('#leverage-hud .lv-hud-star[data-level="5"]').click({ force: true }).catch(() => {}); await wait(pp, 700);
  record("player click on a star changes nothing", (await setting(pp, "wanted")).level === 2, await setting(pp, "wanted"));
  await page.evaluate((id) => game.actors.get(id).update({ "system.plotPoints.value": 5 }), setup.id);
  await wait(pp, 900);
  record("Plot Points live-update for the owner", (await hudState(pp)).pp === "5", await hudState(pp));
  await setSetting(page, "wanted", { city: "liberty", level: 4 });
  await wait(pp, 900);
  record("player sees the wanted level the GM sets", (await hudState(pp)).on === 4);

  // Empty state: player without a character.
  await page.evaluate((id) => game.users.get(id).update({ character: null }), setup.playerId);
  await wait(pp, 1200);
  st = await hudState(pp);
  record("empty state: Money and Plot Points dimmed with the hint", st.hasMoney && st.hasPp && st.dim && /character|personagem/i.test(st.moneyTip ?? ""), { dim: st.dim, tip: st.moneyTip });
  await pp.mouse.move(400, 400); await wait(pp, 600);
  await pp.screenshot({ path: `${SHOTS}/T-701-empty.png`, clip });
  record("no system errors in the GM console", log.own().length === 0, log.own());
  record("no system errors in the player console", playerLog.own().length === 0, playerLog.own());
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-701-failure.png` }).catch(() => {});
} finally {
  await playerBrowser?.browser.close().catch(() => {});
  await page.evaluate(async ({ s, saved, old }) => {
    if (saved) for (const [k, v] of Object.entries(saved)) await game.settings.set(s, k, v);
    await game.user.update({ character: old ?? null });
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) { await a.sheet.close(); await a.delete(); }
    for (const u of game.users.filter((x) => x.name.startsWith("[TEST]"))) await u.delete();
  }, { s: S, saved, old: oldCharacter }).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
