/**
 * Smoke test against the real Foundry server.
 * Logs in to the running world as the test user, waits for game.ready, records console errors from this system,
 * and saves a screenshot. Exit codes: 0 ok, 1 failed, 2 not configured / not reachable.
 *
 * Starter version: the join-page selectors below match Foundry v13. Verify them on v14 (task T-004) and keep
 * shared steps in tests/foundry/lib.mjs once more tests exist.
 */
import { mkdirSync } from "node:fs";
import { loadEnv, missing } from "../../tools/env.mjs";

const env = loadEnv();
const need = missing(env, ["FOUNDRY_URL", "FOUNDRY_USER", "FOUNDRY_PASSWORD"]);
if (need.length) {
  console.log(`FOUNDRY: not configured (missing ${need.join(", ")})`);
  process.exit(2);
}

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.log("FOUNDRY: playwright not installed (npm i -D playwright && npx playwright install chromium)");
  process.exit(2);
}

const shots = "tests/foundry/screenshots";
mkdirSync(shots, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await page.goto(`${env.FOUNDRY_URL.replace(/\/$/, "")}/join`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.selectOption('select[name="userid"]', { label: env.FOUNDRY_USER });
  await page.fill('input[name="password"]', env.FOUNDRY_PASSWORD);
  await page.click('button[name="join"]');
  await page.waitForFunction(() => window.game?.ready === true, null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => ({ system: game.system.id, version: game.system.version, world: game.world.id }));
  await page.screenshot({ path: `${shots}/smoke-world.png` });
  const own = errors.filter((e) => /leverage/i.test(e));
  console.log(`FOUNDRY: ${own.length ? "fail" : "pass"} — ${info.world} on ${info.system} ${info.version}`);
  console.log(`CONSOLE: ${own.length ? own.join("\n") : "clean"}${errors.length > own.length ? ` (+${errors.length - own.length} from other sources)` : ""}`);
  await browser.close();
  process.exit(own.length ? 1 : 0);
} catch (err) {
  await page.screenshot({ path: `${shots}/smoke-failure.png` }).catch(() => {});
  console.log(`FOUNDRY: not available — ${err.message.split("\n")[0]}`);
  await browser.close();
  process.exit(2);
}
