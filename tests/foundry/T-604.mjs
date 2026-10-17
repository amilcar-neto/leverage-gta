/**
 * T-604 check: wanted stars in the real Foundry. GM: raise, wait, disguise, buy silence (city where it works and
 * where it does not), give in, the wanted window and the police shortcut of the opposition roller (with the
 * Stars house rule on and off). Player [TEST] (second browser): buys silence and gives in through the Fixer, and is
 * refused the Fixer-only actions. Creates `[TEST]` documents only, restores `wanted` and the rule, deletes everything.
 * Run after `npm run deploy`. Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const wait = (ms) => page.waitForTimeout(ms);
const S = "leverage-gta";
const MODULE = "systems/leverage-gta/module/applications/gm/stars-actions.mjs";
let ids = null;
let playerBrowser = null;
let saved = null;

/** Runs a stars action on a page: `name` is an export of stars-actions.mjs. */
const act = (p, name, ...args) => p.evaluate(async ([m, fn, a]) => {
  const mod = await import(foundry.utils.getRoute(m));
  const arg = a.map((x) => (x && x.__actor ? game.actors.get(x.__actor) : x));
  const r = await mod[fn](...arg);
  return { ok: r.ok, error: r.error, from: r.from, to: r.to, pending: r.pending };
}, [MODULE, name, args]);
const wanted = () => page.evaluate((s) => game.settings.get(s, "wanted"), S);
const level = async () => (await wanted()).level;
const steps = () => page.evaluate((id) => game.actors.get(id).system.money.steps, ids.a);
const setWanted = (city, lvl) => page.evaluate(([s, c, l]) => game.settings.set(s, "wanted", { city: c, level: l }), [S, city, lvl]);
const lines = () => page.evaluate(() => game.messages.filter((m) => m.content.includes("lv-stars-line")).length);

try {
  await login(page, env);
  ids = await page.evaluate(async (s) => {
    const saved = { wanted: game.settings.get(s, "wanted"), rule: game.settings.get(s, "houseRules.stars") };
    await game.settings.set(s, "houseRules.stars", true);
    const [a] = await Actor.create([{ name: "[TEST] Stars A", type: "crew", system: { money: { steps: 8 } } }]);
    let user = game.users.find((u) => u.name === "[TEST] Player");
    const created = !user;
    user ??= await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    await a.update({ ownership: { [user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER } });
    return { a: a.id, user: user.id, created, saved };
  }, S);
  saved = ids.saved;
  await wait(800);
  const A = { __actor: ids.a };

  // ---- GM: Carcer City ----
  await setWanted("carcer", 0);
  let r = await act(page, "raise", 2, "test crime");
  await wait(500);
  record("raise 0 -> 2", r.ok && (await level()) === 2, r);
  record("raise posts the chat line", (await lines()) === 1, await lines());
  r = await act(page, "raise", 9);
  record("raise caps at 5", r.to === 5 && (await level()) === 5, r);
  r = await act(page, "raise", 1);
  record("raise at 5 is refused", !r.ok && r.error === "atMax", r);
  await setWanted("carcer", 4);
  r = await act(page, "lowerByWaiting", 2);
  record("carcer: wait 2 scenes -> -2", r.to === 2 && (await level()) === 2, r);

  // ---- GM: Las Venturas ----
  await setWanted("venturas", 3);
  r = await act(page, "lowerByWaiting", 1);
  record("venturas: 1 scene is not enough", !r.ok && (await level()) === 3, r);
  r = await act(page, "lowerByDisguise", "both");
  record("venturas: car and clothes -2", r.to === 1 && (await level()) === 1, r);
  await setWanted("venturas", 3);
  r = await act(page, "buySilence", A);
  await wait(500);
  record("venturas: silence pays a d10 (4 steps) and -2", r.to === 1 && (await steps()) === 4, [r, await steps()]);

  // ---- GM: Liberty City (silence does not work, sketch blocks, give in) ----
  await setWanted("liberty", 3);
  const before = await lines();
  r = await act(page, "buySilence", A);
  record("liberty: silence refused, nothing paid", !r.ok && r.error === "noSilence" && (await steps()) === 4 && (await level()) === 3, r);
  r = await act(page, "lowerByWaiting", 3);
  record("liberty: wait per scene refused", !r.ok && r.error === "waitBetweenSessions", r);
  r = await act(page, "lowerByDisguise", "simple", { sketched: true });
  record("liberty: composite sketch blocks the disguise", !r.ok && r.error === "sketched", r);
  record("refusals post no chat line", (await lines()) === before, [before, await lines()]);
  r = await act(page, "giveIn", A);
  await wait(500);
  record("liberty: give in -> 0 stars", r.to === 0 && (await level()) === 0, r);

  // ---- Wanted window (GM) ----
  await setWanted("carcer", 2);
  await page.evaluate(async () => { (await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/gm/controls.mjs"))).openWantedDialog(); });
  const win = page.locator("#leverage-wanted-dialog");
  await win.waitFor({ timeout: 8000 });
  await wait(500);
  record("window: 6 level buttons, level 2 on", (await win.locator(".lv-wanted-level").count()) === 6 && (await win.locator(".lv-wanted-level.is-on .lv-wanted-n").innerText()) === "2");
  record("window: tooltips carry the rules", (await win.locator('[data-action="buySilence"]').getAttribute("title")).includes("d6"));
  await win.screenshot({ path: `${SHOTS}/T-604-dialog.png` });
  await win.locator('[data-action="setLevel"][data-level="4"]').click();
  await wait(800);
  record("window: clicking a level sets it", (await level()) === 4, await level());
  await win.locator('select[name="city"]').selectOption("liberty");
  await wait(800);
  record("window: city select changes the city", (await wanted()).city === "liberty", await wanted());
  record("window: silence disabled in Liberty City", await win.locator('[data-action="buySilence"]').isDisabled());
  record("window: sketch checkbox shown in Liberty City", (await win.locator('input[name="sketched"]').count()) === 1);
  await win.locator('select[name="city"]').selectOption("carcer");
  await wait(800);

  // ---- Police Pool in the opposition roller follows level and city ----
  await page.evaluate(() => game.leverage.openOppositionRoller());
  const opp = page.locator("#leverage-opposition-roller");
  await opp.waitFor({ timeout: 8000 });
  const chip = opp.locator('[data-action="togglePolice"] .lv-opp-chip-dice');
  await setWanted("carcer", 2);
  await wait(800);
  const carcer2 = await chip.innerText();
  await setWanted("liberty", 5);
  await wait(800);
  const liberty5 = await chip.innerText();
  record("opposition: police Pool follows city and level", carcer2 === "d6 + d6" && liberty5 === "d12 + d12 + d8", [carcer2, liberty5]);

  // ---- Rule off hides the shortcut and the actions ----
  await page.evaluate((s) => game.settings.set(s, "houseRules.stars", false), S);
  await wait(900);
  record("rule off: police shortcut hidden", (await opp.locator('[data-action="togglePolice"]').count()) === 0);
  record("rule off: window actions hidden", (await win.locator('[data-action="raise"]').count()) === 0);
  r = await act(page, "raise", 1);
  record("rule off: raise refused", !r.ok && r.error === "disabled", r);
  await page.evaluate((s) => game.settings.set(s, "houseRules.stars", true), S);
  await wait(900);
  record("rule on again: shortcut and actions back", (await opp.locator('[data-action="togglePolice"]').count()) === 1 && (await win.locator('[data-action="raise"]').count()) === 1);
  await page.evaluate(() => { for (const app of foundry.applications.instances.values()) if (["leverage-wanted-dialog", "leverage-opposition-roller"].includes(app.id)) app.close(); });

  // ---- Player: through the Fixer ----
  await setWanted("carcer", 3);
  await page.evaluate((id) => game.actors.get(id).update({ "system.money.steps": 8 }), ids.a);
  playerBrowser = await openBrowser(env, { secondary: true });
  const pp = playerBrowser.page;
  collectConsole(pp);
  await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });
  r = await act(pp, "buySilence", A);
  await wait(4000);
  record("player: silence goes through the Fixer (3 -> 1, 8 -> 6)", r.pending && (await level()) === 1 && (await steps()) === 6, [r, await level(), await steps()]);
  const own = await pp.evaluate(() => game.messages.contents.at(-1).content.includes("lv-stars-line"));
  record("player: the line is posted", own);
  r = await act(pp, "raise", 1);
  await wait(1000);
  record("player: raise is refused", !r.ok && (await level()) === 1, r);
  r = await act(pp, "lowerByWaiting", 1);
  record("player: wait is refused", !r.ok && (await level()) === 1, r);
  await setWanted("liberty", 3);
  r = await act(pp, "buySilence", A);
  await wait(1000);
  record("player: silence refused where it does not work", !r.ok && (await level()) === 3 && (await steps()) === 6, r);
  r = await act(pp, "giveIn", A);
  await wait(4000);
  record("player: give in -> 0", (await level()) === 0, [r, await level()]);

  // ---- Chat screenshot ----
  await page.evaluate(() => { ui.sidebar?.expand?.(); ui.sidebar?.changeTab?.("chat", "primary"); });
  await wait(800);
  const msg = page.locator("#chat .lv-stars-line").last();
  await msg.waitFor({ timeout: 5000 });
  await msg.screenshot({ path: `${SHOTS}/T-604-chat.png` });
  record("chat line text: STARS from N to M", (await msg.locator(".lv-stars-change").innerText()).includes("0"));
} catch (err) {
  record("run", false, err.message.split("\n")[0]);
  await page.screenshot({ path: `${SHOTS}/T-604-failure.png` }).catch(() => {});
} finally {
  await playerBrowser?.browser.close().catch(() => {});
  await page.evaluate(async ([s, i]) => {
    if (i?.saved) {
      await game.settings.set(s, "wanted", i.saved.wanted);
      await game.settings.set(s, "houseRules.stars", i.saved.rule);
    }
    const msgs = game.messages.filter((m) => m.content.includes("lv-stars-line")).map((m) => m.id);
    if (msgs.length) await ChatMessage.deleteDocuments(msgs);
    if (i?.created) await game.users.get(i.user)?.delete();
    await Actor.deleteDocuments(game.actors.filter((a) => a.name.startsWith("[TEST] Stars")).map((a) => a.id));
  }, [S, ids]).catch(() => {});
  record("no own console errors", log.own().length === 0, log.own());
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
  await browser.close();
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}
