/**
 * Money ladder (docs/02). Money is a number of steps (0..25). A full d12 is 5 steps; the leftmost die holds the
 * remainder (d4=1, d6=2, d8=3, d10=4). Dice lists are ascending: largest die on the right. Pure logic.
 */
import { LEVERAGE } from "../config.mjs";
import { assertDie } from "../dice/die.mjs";

const { stepsPerDie, maxSteps } = LEVERAGE.money;
const FULL_DIE = 12;
const FULL_STEPS = stepsPerDie[FULL_DIE];

/** Die size whose step value is `n` (1..4), or undefined. */
function dieForSteps(n) {
  return LEVERAGE.dice.find((d) => stepsPerDie[d] === n);
}

/**
 * Clamps to an integer in 0..maxSteps (non-numbers become 0).
 * @param {number} steps
 * @returns {number}
 */
export function clampSteps(steps) {
  const n = Math.trunc(Number(steps));
  return Number.isFinite(n) ? Math.min(maxSteps, Math.max(0, n)) : 0;
}

/**
 * Steps -> dice shown, ascending (remainder die first, then the full d12s). 0 -> [].
 * @param {number} steps
 * @returns {number[]}
 */
export function stepsToDice(steps) {
  const s = clampSteps(steps);
  const full = Math.floor(s / FULL_STEPS);
  const rest = s % FULL_STEPS;
  const dice = rest ? [dieForSteps(rest)] : [];
  return dice.concat(Array(full).fill(FULL_DIE));
}

/**
 * Dice -> steps (sum of each die's step value). Throws on an invalid die. Not clamped.
 * @param {number[]} dice
 * @returns {number}
 */
export function diceToSteps(dice) {
  return dice.reduce((sum, d) => sum + stepsPerDie[assertDie(d)], 0);
}

/**
 * Price in steps for a price expressed in dice (d12 + d6 = 7).
 * @param {number[]} priceDice
 * @returns {number}
 */
export function priceToSteps(priceDice) {
  return diceToSteps(priceDice);
}

/**
 * Whether `steps` covers `price` (in steps).
 * @param {number} steps
 * @param {number} price
 * @returns {boolean}
 */
export function canAfford(steps, price) {
  return clampSteps(steps) >= price;
}

/**
 * Pays a price. Never goes negative: when funds are short nothing is spent and `ok` is false.
 * @param {number} steps current money
 * @param {number} price price in steps
 * @returns {{ok: boolean, steps: number, shortBy: number}}
 */
export function pay(steps, price) {
  const have = clampSteps(steps);
  const cost = Math.max(0, Math.trunc(price));
  if (have < cost) return { ok: false, steps: have, shortBy: cost - have };
  return { ok: true, steps: have - cost, shortBy: 0 };
}

/**
 * Cheap things (taxi, snack, ammo) are free as long as the character has any money.
 * @param {number} steps
 * @returns {boolean}
 */
export function cheapIsFree(steps) {
  return clampSteps(steps) > 0;
}

/**
 * Adds steps (job payout, odd job +1), capped at the maximum.
 * @param {number} steps
 * @param {number} amount
 * @returns {{steps: number, gained: number}} `gained` is what actually fit.
 */
export function earn(steps, amount) {
  const have = clampSteps(steps);
  const next = clampSteps(have + Math.max(0, Math.trunc(amount)));
  return { steps: next, gained: next - have };
}

/**
 * Lends steps between characters. Moves at most what the lender has and what the receiver can hold.
 * @param {number} from lender's steps
 * @param {number} to receiver's steps
 * @param {number} amount requested steps
 * @returns {{from: number, to: number, moved: number}}
 */
export function lend(from, to, amount) {
  const a = clampSteps(from);
  const b = clampSteps(to);
  const moved = Math.max(0, Math.min(Math.trunc(amount), a, maxSteps - b));
  return { from: a - moved, to: b + moved, moved };
}

/**
 * The money die that enters a Pool: the largest die of the ladder, or null when broke.
 * @param {number} steps
 * @returns {number|null}
 */
export function moneyRollDie(steps) {
  const dice = stepsToDice(steps);
  return dice.length ? dice[dice.length - 1] : null;
}

/**
 * Money after a roll that used the money die: drops 1 step (pass or fail). Broke stays broke.
 * @param {number} steps
 * @returns {number}
 */
export function afterMoneyRoll(steps) {
  return Math.max(0, clampSteps(steps) - 1);
}
