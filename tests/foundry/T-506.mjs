/**
 * T-506 check: Dice So Nice integration in the real Foundry. Rolls through evaluateDice and checks that every Die term
 * carries the right colorset, that the roll survives serialization, and that the console has no errors (works with or
 * without the Dice So Nice module; when it is active also checks the colorsets exist). Run after `npm run deploy`.
 * Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });

try {
  await login(page, env);
  const out = await page.evaluate(async () => {
    const { evaluateDice } = await import(foundry.utils.getRoute("systems/leverage-gta/module/dice/roll-core.mjs"));
    const { roll } = await evaluateDice([4, 10, 12], ["trait", "trait", "money"]);
    const copy = Roll.fromData(roll.toJSON());
    const dsn = Boolean(game.modules.get("dice-so-nice")?.active);
    return {
      dsn,
      names: roll.dice.map((d) => d.options.appearance?.colorset),
      restored: copy.dice.map((d) => d.options.appearance?.colorset),
      sets: dsn ? Object.keys(game.dice3d?.exports?.COLORSETS ?? {}).filter((k) => k.startsWith("leverage-")) : null
    };
  });
  record("every Die term has its colorset", JSON.stringify(out.names) === JSON.stringify(["leverage-d4", "leverage-d10", "leverage-cash"]), out.names);
  record("colorsets survive serialization", JSON.stringify(out.restored) === JSON.stringify(out.names), out.restored);
  if (out.dsn) record("Dice So Nice has the Leverage colorsets", out.sets.length === 6, out.sets);
  console.log(`Dice So Nice active: ${out.dsn}`);
  record("no console errors", log.own().length === 0, log.own());
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
