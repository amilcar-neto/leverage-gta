/**
 * T-705 check: the three GM config apps in the real Foundry (GM). Opens each menu from Configure Settings, edits,
 * saves, checks the setting, tests validation and "Restore defaults", then restores the original settings.
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
let saved = null;
const setting = (key) => page.evaluate(([s, k]) => game.settings.get(s, k), [S, key]);
const gone = (id) => page.waitForFunction((i) => !document.getElementById(i), id, { timeout: 8000 }).catch(() => {});

/** Opens a menu through Configure Settings (falls back to the registered class if the button is not found). */
async function openMenu(menuKey, appId) {
  await page.evaluate(() => { for (const a of foundry.applications.instances.values()) if (a.id?.endsWith("-config")) a.close(); });
  await page.evaluate(() => new foundry.applications.settings.SettingsConfig().render({ force: true }));
  await wait(1200);
  await page.locator('button[data-action="tab"][data-group="categories"][data-tab="system"]').click().catch(() => {});
  await wait(300);
  const btn = page.locator(`button[data-key="${S}.${menuKey}"]`);
  let via = "button";
  if (await btn.count()) {
    await btn.first().scrollIntoViewIfNeeded().catch(() => {});
    await btn.first().click({ force: true });
  } else {
    via = "class";
    await page.evaluate(([s, k]) => new (game.settings.menus.get(`${s}.${k}`).type)().render({ force: true }), [S, menuKey]);
  }
  const app = page.locator(`#${appId}`);
  await app.waitFor({ timeout: 8000 });
  await wait(500);
  return { app, via };
}

/** Horizontal overflow of the scroll body and of the window. */
const overflow = (appId) => page.evaluate((id) => {
  const win = document.getElementById(id);
  const body = win.querySelector(".lv-config-body");
  return { body: body.scrollWidth - body.clientWidth, win: win.scrollWidth - win.clientWidth };
}, appId);

const submit = (app) => app.locator('button[type="submit"]').click();

try {
  await login(page, env);
  saved = await page.evaluate((s) => Object.fromEntries(["cityScales", "prices", "trainingCosts", "wanted"].map((k) => [k, foundry.utils.deepClone(game.settings.get(s, k))])), S);
  await page.evaluate(() => { window.__starsHook = 0; Hooks.on("leverage.starsChanged", () => { window.__starsHook += 1; }); });

  /* ------------------------------------------------------------ city scales */
  let { app, via } = await openMenu("cityScalesMenu", "leverage-city-scales-config");
  record(`city scales menu opens (${via})`, await app.isVisible());
  record("3 default cities listed", (await app.locator(".lv-city").count()) === 3);
  record("5 star rows per city", (await app.locator(".lv-city").first().locator(".lv-pool").count()) === 5);
  await page.screenshot({ path: `${SHOTS}/T-705-cities.png` });
  const ov = await overflow("leverage-city-scales-config");
  record("no sideways overflow", ov.body <= 0 && ov.win <= 0, ov);

  await app.locator('[data-action="addCity"]').click();
  await wait(400);
  record("add city -> 4 cards", (await app.locator(".lv-city").count()) === 4);
  const card = app.locator(".lv-city").last();
  await card.locator('input[name="name"]').fill("[TEST] Vice");
  await card.locator('input[name="defaultCity"]').check();
  await card.locator('input[name="wait"]').fill("3");
  await card.locator('select[name="disguise"]').selectOption("2");
  await card.locator('input[name="bail"]').check();
  await card.locator('.lv-pool[data-level="1"] .lv-pool-die').first().click();
  await wait(300);
  await app.locator(".lv-city").last().locator('.lv-pool[data-level="1"] [data-action="addDie"][data-die="10"]').click();
  await wait(300);
  await app.locator(".lv-city").last().locator('[data-action="toggleSilence"][data-die="8"]').click();
  await wait(300);
  record("typed values survive re-render", (await app.locator(".lv-city").last().locator('input[name="name"]').inputValue()) === "[TEST] Vice");
  await page.screenshot({ path: `${SHOTS}/T-705-cities-edited.png` });
  const hooks0 = await page.evaluate(() => window.__starsHook);
  await submit(app);
  await gone("leverage-city-scales-config");
  await wait(500);
  let scales = await setting("cityScales");
  const vice = scales.find((c) => c.name === "[TEST] Vice");
  record("saved: 4 cities, id stable (slug of the first name)", scales.length === 4 && ["new-city", "nova-cidade"].includes(vice?.id), scales.map((c) => c.id));
  record("saved: rules and Pool", vice && vice.default === true && vice.wait === 3 && vice.disguise === 2 && vice.bail === true
    && vice.silence?.includes(8) && vice.levels[0].includes(10) && vice.levels[0].length === 2, vice);
  record("only one default city", scales.filter((c) => c.default).length === 1, scales.map((c) => [c.id, c.default]));
  record("leverage.starsChanged fired", (await page.evaluate(() => window.__starsHook)) > hooks0);

  ({ app } = await openMenu("cityScalesMenu", "leverage-city-scales-config"));
  record("reopen shows saved data", (await app.locator(".lv-city").count()) === 4
    && (await app.locator(".lv-city").last().locator('input[name="name"]').inputValue()) === "[TEST] Vice");
  const first = app.locator(".lv-city").first();
  for (let i = 0; i < 4; i += 1) {
    if (await first.locator('.lv-pool[data-level="1"] .lv-pool-die').count()) await first.locator('.lv-pool[data-level="1"] .lv-pool-die').first().click();
    await wait(150);
  }
  await submit(app);
  await wait(500);
  record("empty Pool blocks Save and shows an error", (await app.locator(".lv-config-error").count()) === 1 && (await app.isVisible()), await app.locator(".lv-config-error").allTextContents());
  record("setting unchanged after failed Save", (await setting("cityScales")).length === 4 && (await setting("cityScales"))[0].levels[0].length === 2);
  await page.screenshot({ path: `${SHOTS}/T-705-cities-error.png` });
  await app.locator('[data-action="restore"]').click();
  await wait(400);
  record("restore defaults -> 3 cities", (await app.locator(".lv-city").count()) === 3);
  await submit(app);
  await gone("leverage-city-scales-config");
  scales = await setting("cityScales");
  record("restored scales saved", scales.map((c) => c.id).join() === "carcer,venturas,liberty" && scales.find((c) => c.default)?.id === "liberty", scales.map((c) => c.id));
  const wanted = await setting("wanted");
  record("wanted city still valid", scales.some((c) => c.id === wanted.city), wanted);

  /* ------------------------------------------------------------------ prices */
  ({ app, via } = await openMenu("pricesMenu", "leverage-price-list-config"));
  record(`price list menu opens (${via})`, await app.isVisible());
  const rows = await app.locator(".lv-price").count();
  record("13 default items", rows === 13, rows);
  await page.screenshot({ path: `${SHOTS}/T-705-prices.png` });
  const ov2 = await overflow("leverage-price-list-config");
  record("prices: no sideways overflow", ov2.body <= 0 && ov2.win <= 0, ov2);
  await app.locator('.lv-price[data-price="bail"] [data-action="addDie"][data-die="12"]').click();
  await wait(300);
  await submit(app);
  await gone("leverage-price-list-config");
  let prices = await setting("prices");
  record("price saved (bail = d12 + d6)", JSON.stringify(prices.find((p) => p.id === "bail").dice) === "[12,6]", prices.find((p) => p.id === "bail"));
  ({ app } = await openMenu("pricesMenu", "leverage-price-list-config"));
  await app.locator('.lv-price[data-price="hospital"] .lv-pool-die').first().click();
  await wait(300);
  await submit(app);
  await wait(500);
  record("empty price blocks Save", (await app.locator(".lv-config-error").count()) === 1, await app.locator(".lv-config-error").allTextContents());
  await app.locator('[data-action="restore"]').click();
  await wait(300);
  await submit(app);
  await gone("leverage-price-list-config");
  prices = await setting("prices");
  record("prices restored", JSON.stringify(prices.find((p) => p.id === "bail").dice) === "[6]");

  /* ---------------------------------------------------------- training costs */
  ({ app, via } = await openMenu("trainingCostsMenu", "leverage-training-costs-config"));
  record(`training costs menu opens (${via})`, await app.isVisible());
  record("5 options", (await app.locator(".lv-cost").count()) === 5);
  await page.screenshot({ path: `${SHOTS}/T-705-training.png` });
  await app.locator('input[name="attribute"]').fill("4");
  await app.locator('input[name="role"]').fill("");
  await submit(app);
  await wait(500);
  record("invalid cost blocks Save", (await app.locator(".lv-config-error").count()) === 1 && (await app.isVisible()), await app.locator(".lv-config-error").allTextContents());
  record("typed cost kept after the error", (await app.locator('input[name="attribute"]').inputValue()) === "4");
  await app.locator('input[name="role"]').fill("3");
  await submit(app);
  await gone("leverage-training-costs-config");
  let costs = await setting("trainingCosts");
  record("costs saved", costs.attribute === 4 && costs.role === 3, costs);
  ({ app } = await openMenu("trainingCostsMenu", "leverage-training-costs-config"));
  await app.locator('[data-action="restore"]').click();
  await wait(300);
  await submit(app);
  await gone("leverage-training-costs-config");
  costs = await setting("trainingCosts");
  record("costs restored", costs.attribute === 2 && costs.role === 2, costs);

  const mine = log.own();
  record("no system errors in console", mine.length === 0, mine);
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-705-failure.png` }).catch(() => {});
} finally {
  await page.evaluate(async ([s, saved]) => {
    for (const a of foundry.applications.instances.values()) if (a.id?.endsWith("-config")) await a.close();
    if (saved) for (const [k, v] of Object.entries(saved)) await game.settings.set(s, k, v);
  }, [S, saved]).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
