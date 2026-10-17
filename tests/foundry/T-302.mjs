/**
 * T-302 check: crew sheet header. Inline name/alias/booking edits, Life/Vest popover limits, vest kind,
 * houseRules.life hiding. Creates only `[TEST]` actors. Run after `npm run deploy`.
 * Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });

try {
  await login(page, env);
} catch (err) {
  console.log(`FOUNDRY: not available - ${err.message.split("\n")[0]}`);
  await browser.close();
  process.exit(2);
}

/** Runs in the page: creates the actor, opens its sheet and returns the id. */
const open = () => page.evaluate(async () => {
  const actor = await Actor.create({ name: "[TEST] Header", type: "crew" });
  await actor.sheet.render({ force: true });
  await new Promise((r) => setTimeout(r, 1200));
  return actor.id;
});

try {
  const id = await open();
  const root = ".crew-sheet .lv-header";
  await page.fill(`${root} input[name="name"]`, "[TEST] Rosa");
  await page.press(`${root} input[name="name"]`, "Enter");
  await page.waitForTimeout(800); // each save re-renders the sheet: let it settle before the next field
  await page.fill(`${root} input[name="system.alias"]`, "La Zorra");
  await page.locator(`${root} input[name="system.alias"]`).blur();
  await page.waitForTimeout(800);
  await page.fill(`${root} input[name="system.booking.height"]`, "5'6\"");
  await page.locator(`${root} input[name="system.booking.height"]`).blur();
  await page.waitForTimeout(600);
  const saved = await page.evaluate((i) => {
    const a = game.actors.get(i);
    return { name: a.name, alias: a.system.alias, height: a.system.booking.height };
  }, id);
  record("inline edits saved", saved.name === "[TEST] Rosa" && saved.alias === "La Zorra" && saved.height === "5'6\"", saved);

  await page.click(`${root} .lv-vital--life .lv-vital-btn`);
  await page.waitForSelector(`${root} .lv-pop`);
  const max = await page.evaluate((i) => game.actors.get(i).system.life.max, id);
  await page.fill(`${root} [data-vital-input="life"]`, "999");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(500);
  const afterBig = await page.evaluate((i) => game.actors.get(i).system.life.value, id);
  record("life clamps to max", afterBig === max, { afterBig, max });
  for (let n = 0; n < 3; n++) await page.click(`${root} [data-action="adjustVital"][data-delta="-1"]`);
  await page.waitForTimeout(400);
  const afterMinus = await page.evaluate((i) => game.actors.get(i).system.life.value, id);
  record("minus lowers life", afterMinus === max - 3, { afterMinus, max });

  await page.click(`${root} .lv-vital--vest .lv-vital-btn`);
  await page.click(`${root} [data-action="setVestKind"][data-kind="standard"]`);
  await page.waitForTimeout(500);
  const vest = await page.evaluate((i) => ({ ...game.actors.get(i).system.vest }), id);
  record("vest kind sets max and value 6", vest.kind === "standard" && vest.max === 6 && vest.value === 6, vest);
  await page.screenshot({ path: `${SHOTS}/T-302-popover.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  record("Escape closes popover", (await page.locator(`${root} .lv-pop`).count()) === 0);

  await page.evaluate(() => game.settings.set("leverage-gta", "houseRules.life", false));
  await page.waitForTimeout(600);
  record("houseRules.life off hides vitals", (await page.locator(`${root} .lv-vitals`).count()) === 0);
  await page.evaluate(() => game.settings.set("leverage-gta", "houseRules.life", true));
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/T-302-header.png` });
  record("no system errors in console", log.own().length === 0, log.own());
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-302-failure.png` }).catch(() => {});
} finally {
  await page.evaluate(async () => {
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) { await a.sheet.close(); await a.delete(); }
  }).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
