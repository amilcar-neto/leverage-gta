/**
 * T-603 check: Money flows in the real Foundry. GM: Pay dialog (price list item, short funds), Money in the Pool
 * (drops one step; refused with the house rule off). Player [TEST] (second browser): Lend dialog through the
 * Fixer socket, and a refused over-sized request. Creates `[TEST]` documents only, restores the settings it
 * changes and deletes everything it made. Run after `npm run deploy`. Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const wait = (ms) => page.waitForTimeout(ms);
const S = "leverage-gta";
const steps = (id) => page.evaluate((i) => game.actors.get(i).system.money.steps, id);
const setSteps = (id, n) => page.evaluate(([i, v]) => game.actors.get(i).update({ "system.money.steps": v }), [id, n]);
let ids = null;
let playerBrowser = null;
let savedRule = true;

try {
  await login(page, env);
  ids = await page.evaluate(async (s) => {
    const saved = game.settings.get(s, "houseRules.money");
    const data = (name, money) => ({ name, type: "crew", system: { money: { steps: money }, attributes: { agility: { die: 8 } }, roles: { thief: { die: 8 } } } });
    const [a, b] = await Actor.create([data("[TEST] Money A", 8), data("[TEST] Money B", 2)]);
    let user = game.users.find((u) => u.name === "[TEST] Player");
    const created = !user;
    user ??= await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    await a.update({ ownership: { [user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER } });
    return { a: a.id, b: b.id, user: user.id, created, saved };
  }, S);
  savedRule = ids.saved;
  await wait(800);

  // ---- Pay dialog (GM) ----
  const dialog = page.locator(".application.lv-dialog");
  await page.evaluate((id) => { game.leverage.money.payDialog(game.actors.get(id)); }, ids.a);
  await dialog.waitFor({ timeout: 8000 });
  await dialog.locator('select[name="price"]').selectOption("buyRich");
  await wait(300);
  record("pay: OK enabled when affordable", !(await dialog.locator('button[data-action="ok"]').isDisabled()));
  await dialog.screenshot({ path: `${SHOTS}/T-603-pay.png` });
  await dialog.locator('button[data-action="ok"]').click();
  await wait(1200);
  record("pay: price list item paid (8 - 7 = 1)", (await steps(ids.a)) === 1, await steps(ids.a));
  const lines = await page.evaluate(() => game.messages.filter((m) => m.content.includes("lv-money-line--pay") && m.content.includes("Money A")).length);
  record("pay: chat line posted", lines === 1, lines);

  // Short funds: disabled button and a warning, nothing spent.
  await page.evaluate((id) => { game.leverage.money.payDialog(game.actors.get(id)); }, ids.a);
  await dialog.waitFor({ timeout: 8000 });
  await dialog.locator('select[name="price"]').selectOption("buyMiddle");
  await wait(300);
  record("pay: OK disabled when short", await dialog.locator('button[data-action="ok"]').isDisabled());
  record("pay: warning visible", await dialog.locator("[data-warn]").isVisible());
  await dialog.locator('select[name="price"]').selectOption("__custom");
  await dialog.locator('input[name="count-4"]').fill("1");
  await wait(300);
  record("pay: free price of one d4 is affordable", !(await dialog.locator('button[data-action="ok"]').isDisabled()));
  await dialog.locator('input[name="count-4"]').fill("2");
  await wait(300);
  record("pay: free price of two d4 is not", await dialog.locator('button[data-action="ok"]').isDisabled());
  await page.evaluate(() => { for (const app of foundry.applications.instances.values()) if (app.options.classes?.includes("lv-dialog")) app.close(); });
  await wait(500);
  record("pay: nothing spent when short", (await steps(ids.a)) === 1, await steps(ids.a));

  // ---- Money in the Pool ----
  await setSteps(ids.a, 8);
  const roll = () => page.evaluate(async (id) => {
    const actor = game.actors.get(id);
    const msg = await game.leverage.rollPool({ actor, refs: ["attributes.agility", "roles.thief", "money"] });
    return { posted: Boolean(msg), steps: actor.system.money.steps };
  }, ids.a);
  const rolled = await roll();
  record("pool: Money roll posts and drops one step", rolled.posted && rolled.steps === 7, rolled);
  await page.evaluate((s) => game.settings.set(s, "houseRules.money", false), S);
  await wait(500);
  const off = await roll();
  record("pool: Money refused with the house rule off", !off.posted && off.steps === 7, off);
  await page.evaluate(([s, v]) => game.settings.set(s, "houseRules.money", v), [S, savedRule]);
  await setSteps(ids.a, 8);

  // ---- Lend dialog (Player, through the Fixer) ----
  playerBrowser = await openBrowser(env, { secondary: true });
  const pp = playerBrowser.page;
  collectConsole(pp);
  await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });
  const pd = pp.locator(".application.lv-dialog");
  await pp.evaluate((id) => { game.leverage.money.lendDialog(game.actors.get(id)); }, ids.a);
  await pd.waitFor({ timeout: 8000 });
  await pd.locator('select[name="to"]').selectOption(ids.b);
  await pd.locator('input[name="amount"]').fill("99");
  await pp.waitForTimeout(300);
  record("lend: too much is refused in the dialog", await pd.locator('button[data-action="ok"]').isDisabled());
  await pd.locator('input[name="amount"]').fill("3");
  await pp.waitForTimeout(300);
  record("lend: valid loan enables OK", !(await pd.locator('button[data-action="ok"]').isDisabled()));
  await pd.screenshot({ path: `${SHOTS}/T-603-lend.png` });
  await pd.locator('button[data-action="ok"]').click();
  await wait(2000);
  record("lend: A 8 -> 5 and B 2 -> 5 through the Fixer", (await steps(ids.a)) === 5 && (await steps(ids.b)) === 5, [await steps(ids.a), await steps(ids.b)]);
  const lent = await page.evaluate(() => game.messages.filter((m) => m.content.includes("lv-money-line--lend") && m.content.includes("Money A")).length);
  record("lend: chat line posted once", lent === 1, lent);

  // The Fixer refuses an oversized request sent around the dialog; a non-owned lender is refused on the client.
  await pp.evaluate(async (id) => { await game.leverage.money.transfer(game.actors.get(id.a), game.actors.get(id.b), 99); }, ids);
  await wait(1500);
  record("lend: oversized socket request changes nothing", (await steps(ids.a)) === 5 && (await steps(ids.b)) === 5, [await steps(ids.a), await steps(ids.b)]);
  const denied = await pp.evaluate(async (id) => game.leverage.money.transfer(game.actors.get(id.b), game.actors.get(id.a), 1), ids);
  await wait(1000);
  record("lend: player cannot lend someone else's Money", denied === null && (await steps(ids.b)) === 5, [denied, await steps(ids.b)]);
} catch (err) {
  record("run", false, err.message.split("\n")[0]);
  await page.screenshot({ path: `${SHOTS}/T-603-failure.png` }).catch(() => {});
} finally {
  await playerBrowser?.browser.close().catch(() => {});
  await page.evaluate(async ([s, rule, i]) => {
    await game.settings.set(s, "houseRules.money", rule);
    const msgs = game.messages.filter((m) => m.content.includes("Money A") || m.content.includes("Money B")).map((m) => m.id);
    if (msgs.length) await ChatMessage.deleteDocuments(msgs);
    if (i?.created) await game.users.get(i.user)?.delete();
    await Actor.deleteDocuments(game.actors.filter((a) => a.name.startsWith("[TEST] Money")).map((a) => a.id));
  }, [S, savedRule, ids]).catch(() => {});
  record("no own console errors", log.own().length === 0, log.own());
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
  await browser.close();
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}
