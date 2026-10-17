/**
 * Pure rules of the Pay and Lend dialogs (docs/02 "Grana em escada"): a price is a list of dice, its cost is
 * the sum of the dice in steps, nothing is spent when funds are short, and a loan moves whole steps between two
 * different characters. No Foundry globals here, so it is unit tested.
 */
import { LEVERAGE } from "../config.mjs";
import { clampSteps, diceToSteps, stepsToDice } from "./money.mjs";

const { maxSteps } = LEVERAGE.money;

/** Most dice of one size a free price can hold (a d12 is 5 steps, so 5 d12 already fill the ladder). */
export const MAX_DICE_PER_SIZE = 5;

/**
 * Builds a sorted dice list (ascending) from counts per die size, e.g. `{12: 1, 6: 1}` -> `[6, 12]`.
 * Unknown sizes and bad counts are ignored.
 * @param {Record<string, number|string>} counts
 * @returns {number[]}
 */
export function diceFromCounts(counts) {
  const dice = [];
  for (const die of LEVERAGE.dice) {
    const n = Math.min(MAX_DICE_PER_SIZE, Math.max(0, Math.trunc(Number(counts?.[die]) || 0)));
    dice.push(...Array(n).fill(die));
  }
  return dice;
}

/**
 * Cost of a price given in dice.
 * @param {number[]} dice
 * @returns {{dice: number[], steps: number}} dice sorted ascending, cost in steps
 */
export function describeCost(dice) {
  const sorted = [...dice].map(Number).sort((a, b) => a - b);
  return { dice: sorted, steps: diceToSteps(sorted) };
}

/**
 * Whether a payment can go through.
 * @param {number} have Current Money steps.
 * @param {number[]} priceDice
 * @returns {{ok: boolean, error?: "emptyPrice"|"short", cost: number, after: number, shortBy: number}}
 */
export function checkPayment(have, priceDice) {
  const money = clampSteps(have);
  const { steps: cost } = describeCost(priceDice);
  if (!cost) return { ok: false, error: "emptyPrice", cost, after: money, shortBy: 0 };
  if (money < cost) return { ok: false, error: "short", cost, after: money, shortBy: cost - money };
  return { ok: true, cost, after: money - cost, shortBy: 0 };
}

/**
 * Whether a loan can go through (strict: nothing is clamped, the dialog tells the user what is wrong).
 * @param {object} loan
 * @param {number} loan.fromSteps Lender's Money.
 * @param {number} loan.toSteps Receiver's Money.
 * @param {number} loan.amount Steps to lend.
 * @param {boolean} [loan.sameActor] Lender and receiver are the same character.
 * @returns {{ok: boolean, error?: "sameActor"|"invalidAmount"|"noFunds"|"full", from: number, to: number}}
 */
export function checkLend({ fromSteps, toSteps, amount, sameActor = false }) {
  const from = clampSteps(fromSteps);
  const to = clampSteps(toSteps);
  const n = Number(amount);
  const fail = (error) => ({ ok: false, error, from, to });
  if (sameActor) return fail("sameActor");
  if (!Number.isInteger(n) || n < 1) return fail("invalidAmount");
  if (n > from) return fail("noFunds");
  if (to + n > maxSteps) return fail("full");
  return { ok: true, from: from - n, to: to + n };
}

/**
 * Dice a character holds after the change, for the chat line ("Money: d12 d6").
 * @param {number} steps
 * @returns {number[]}
 */
export const diceOf = (steps) => stepsToDice(steps);
