/** T-1016: after relaunch, the 0.2.0 migration notifies the GM once; reopening does not repeat; rollMode default is prime. */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";
const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
try {
  const count = () => page.evaluate(() => [...document.querySelectorAll("#notifications li, .notification")].filter((n) => /Cortex|Prime/i.test(n.textContent)).length);
  await login(page, env);
  await page.waitForTimeout(2500);
  const first = await count();
  await page.screenshot({ path: `${SHOTS}/T-1016-migration-first.png` });
  const info = await page.evaluate(() => ({ v: game.settings.get("leverage-gta", "systemMigrationVersion"), sys: game.system.version, mode: game.settings.get("leverage-gta", "rules.rollMode"), defaultMode: game.settings.settings.get("leverage-gta.rules.rollMode")?.default }));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.game?.ready === true, null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  const second = await count();
  console.log(JSON.stringify({ first, second, ...info }));
  console.log("own errors:", log.own().length ? log.own().join("\n") : "clean");
  await browser.close();
} catch (e) { console.log("ERR", e.message.split("\n")[0]); await browser.close(); process.exit(1); }
