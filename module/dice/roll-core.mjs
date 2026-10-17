/**
 * Shared core of every roll that posts a card (Pool rolls of the players, opposition rolls of the Fixer): the formula
 * (one Die term per die), the rng-injectable rolling, the roll data stored in `flags.leverage-gta.roll` (docs/05)
 * and the Foundry evaluation. The pure functions have no Foundry dependency; `evaluateDice` touches `Roll` only
 * when called.
 */
import { evaluatePool, rollPool } from "./pool-roll.mjs";
import { appearanceFor } from "./dsn.mjs";

/**
 * Roll formula with one Die term per die: `1d10 + 1d10 + 1d6`.
 * @param {number[]} sizes
 * @returns {string}
 */
export function poolFormula(sizes) {
  return sizes.map((size) => `1d${size}`).join(" + ");
}

/**
 * Rolls dice with an injectable rng (tests, macros). Returns the face of each die, in order.
 * @param {number[]} sizes
 * @param {() => number} [rng]
 * @returns {number[]}
 */
export function rollValues(sizes, rng = Math.random) {
  return rollPool(sizes, rng).map((r) => r.value);
}

/**
 * Builds the roll data stored in `flags.leverage-gta.roll` (docs/05).
 * @param {object} input
 * @param {{ref: string, label: string, kind: string, die: number, hinders?: boolean}[]} input.entries Rollable entries, Pool order.
 * @param {number[]} input.values Face rolled by each entry.
 * @param {string} [input.actorUuid]
 * @param {string} [input.actorName]
 * @param {string} [input.actorImg]
 * @param {string} [input.flavor]
 * @returns {object}
 */
export function buildRollData({ entries, values, actorUuid = "", actorName = "", actorImg = "", flavor = "" }) {
  const results = entries.map((e, index) => ({ index, size: e.die, value: values[index] }));
  const outcome = evaluatePool(results);
  const kept = new Set(outcome.kept);
  return {
    actorUuid, actorName, actorImg, flavor,
    entries: entries.map((e, index) => ({
      ref: e.ref, label: e.label, kind: e.kind, faces: e.die, result: values[index],
      kept: kept.has(index), one: values[index] === 1
    })),
    keptCount: outcome.kept.length,
    total: outcome.total,
    ppSpent: 0,
    distinctionPP: entries.some((e) => e.kind === "distinction" && e.hinders) ? 1 : 0,
    complicationsResolved: [],
    money: entries.some((e) => e.kind === "money")
  };
}

/**
 * Evaluates the dice with Foundry's `Roll` (one Die term per die, so Dice So Nice and the history see every die).
 * Each term gets its Dice So Nice colorset (`options.appearance`; harmless without the module).
 * @param {number[]} sizes
 * @param {string[]} [kinds] Pool entry kind of each die ("money" gets the Money color).
 * @returns {Promise<{roll: Roll, values: number[]}>} the evaluated roll and the face of each die
 */
export async function evaluateDice(sizes, kinds = []) {
  const roll = await new Roll(poolFormula(sizes)).evaluate();
  roll.dice.forEach((term, i) => { term.options.appearance = appearanceFor(sizes[i], kinds[i]); });
  return { roll, values: roll.dice.map((term) => term.results[0].result) };
}
