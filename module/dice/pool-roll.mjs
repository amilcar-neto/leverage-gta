/**
 * Pure Pool math (docs/01, docs/08): roll with an injectable rng, drop 1s, keep the two highest,
 * keep extra dice by spending Plot Points. No Foundry dependency.
 */
import { LEVERAGE } from "../config.mjs";
import { assertDie } from "./die.mjs";

/**
 * @typedef {object} DieResult
 * @property {number} index Position in the Pool (stable ordering).
 * @property {number} size Die size.
 * @property {number} value Face rolled (1..size).
 */

/**
 * @typedef {object} PoolOutcome
 * @property {number[]} kept Indexes (into the Pool) of kept dice, highest first.
 * @property {number[]} ones Indexes of dice that rolled 1 (never counted).
 * @property {number[]} rest Indexes of dice neither kept nor 1, highest first.
 * @property {number} total Sum of kept values.
 */

/**
 * Rolls one die. `rng` returns a float in [0, 1) (default `Math.random`).
 * @param {number} size
 * @param {() => number} [rng]
 * @returns {number} 1..size
 */
export function rollDie(size, rng = Math.random) {
  assertDie(size);
  return Math.min(size, Math.floor(rng() * size) + 1);
}

/**
 * Rolls every die of a Pool, in order.
 * @param {number[]} sizes
 * @param {() => number} [rng]
 * @returns {DieResult[]}
 */
export function rollPool(sizes, rng = Math.random) {
  return sizes.map((size, index) => ({ index, size, value: rollDie(size, rng) }));
}

/** Orders candidates: higher value first, then earlier in the Pool. */
function byValueDesc(a, b) {
  return b.value - a.value || a.index - b.index;
}

/**
 * Evaluates a rolled Pool. `extraKept` is how many dice beyond the default two were kept by spending Plot Points.
 * Ties keep the earlier die. With fewer eligible dice than slots, keeps what exists (none -> total 0).
 * @param {DieResult[]} results
 * @param {number} [extraKept=0]
 * @param {number} [keep=2]
 * @returns {PoolOutcome}
 */
export function evaluatePool(results, extraKept = 0, keep = LEVERAGE.keepDefault) {
  const ones = results.filter((r) => r.value === 1).map((r) => r.index);
  const eligible = results.filter((r) => r.value !== 1).sort(byValueDesc);
  const slots = Math.max(0, keep + Math.max(0, extraKept));
  const keptRes = eligible.slice(0, slots);
  return {
    kept: keptRes.map((r) => r.index),
    ones,
    rest: eligible.slice(slots).map((r) => r.index),
    total: keptRes.reduce((sum, r) => sum + r.value, 0)
  };
}
