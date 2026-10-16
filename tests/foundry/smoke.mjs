/**
 * Smoke test against the real Foundry server.
 * Logs in to the running world as the test user, waits for game.ready, records console errors from this system,
 * and saves a screenshot. Exit codes: 0 ok, 1 failed, 2 not configured / not reachable.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);

try {
  await login(page, env);
  const info = await page.evaluate(() => ({ system: game.system.id, version: game.system.version, world: game.world.id }));
  await page.screenshot({ path: `${SHOTS}/smoke-world.png` });
  const own = log.own();
  console.log(`FOUNDRY: ${own.length ? "fail" : "pass"} — ${info.world} on ${info.system} ${info.version}`);
  console.log(`CONSOLE: ${own.length ? own.join("\n") : "clean"}${log.errors.length > own.length ? ` (+${log.errors.length - own.length} from other sources)` : ""}`);
  await browser.close();
  process.exit(own.length ? 1 : 0);
} catch (err) {
  await page.screenshot({ path: `${SHOTS}/smoke-failure.png` }).catch(() => {});
  console.log(`FOUNDRY: not available — ${err.message.split("\n")[0]}`);
  await browser.close();
  process.exit(2);
}
