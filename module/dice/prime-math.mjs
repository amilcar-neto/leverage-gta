/**
 * Pure Cortex Prime math (docs/08): the player picks any two dice for the total and one for the effect.
 * Works on roll entries (`{faces, result, paid?}`, docs/05); a die is identified by its index in the entries.
 * A selection is `{total: number[], effect: number[], paid?: number[]}`; `paid` (a subset of `total`) are dice
 * bought with Plot Points. No Foundry dependency.
 */
import { LEVERAGE } from "../config.mjs";
import { stepUp } from "./die.mjs";

/**
 * @typedef {object} Selection
 * @property {number[]} total Indexes of the dice added to the total (including paid ones).
 * @property {number[]} effect Indexes of the effect die (at most one).
 * @property {number[]} [paid] Indexes (subset of `total`) bought with Plot Points.
 */

const isHitch = (entry) => entry.result === 1;

/** Higher result first; on a tie the die with fewer faces goes to the total (the bigger one stays free for effect). */
function byTotal(entries) {
  return (a, b) => entries[b].result - entries[a].result || entries[a].faces - entries[b].faces || a - b;
}

/**
 * Splits the dice into hitches (rolled 1) and eligible dice.
 * @param {{result: number}[]} entries
 * @returns {{hitches: number[], eligible: number[], botch: boolean}} `botch` = every die is a 1 (at least one die).
 */
export function classify(entries) {
  const hitches = [];
  const eligible = [];
  entries.forEach((e, i) => (isHitch(e) ? hitches : eligible).push(i));
  return { hitches, eligible, botch: entries.length > 0 && eligible.length === 0 };
}

/**
 * Shortcut selection (never applied on its own). `prefer: "total"` takes the two highest for the total and the
 * biggest die left (by faces) for the effect; `"effect"` reserves the biggest die (by faces, lower result on a tie)
 * for the effect and takes the two highest of the rest for the total.
 * @param {{faces: number, result: number}[]} entries
 * @param {{prefer?: "total"|"effect"}} [options]
 * @returns {Selection}
 */
export function autoSelection(entries, { prefer = "total" } = {}) {
  const { eligible } = classify(entries);
  const slots = LEVERAGE.prime.totalDice;
  let effect = [];
  let pool = eligible;
  if (prefer === "effect" && eligible.length > slots) {
    const best = [...eligible].sort((a, b) => entries[b].faces - entries[a].faces || entries[a].result - entries[b].result || a - b)[0];
    effect = [best];
    pool = eligible.filter((i) => i !== best);
  }
  const total = [...pool].sort(byTotal(entries)).slice(0, slots);
  if (!effect.length) {
    const left = eligible.filter((i) => !total.includes(i)).sort((a, b) => entries[b].faces - entries[a].faces || a - b);
    effect = left.slice(0, LEVERAGE.prime.effectDice);
  }
  return { total: total.sort((a, b) => a - b), effect, paid: [] };
}

/** Dice of `total` that are not paid. */
function unpaidCount(selection) {
  const paid = new Set(selection.paid ?? []);
  return selection.total.filter((i) => !paid.has(i)).length;
}

/**
 * Click on a die: a die already placed is released; a free die goes to `slot`. Pure; a hitch never moves.
 * Slots: `"auto"` (total if it has room, else effect if empty, else nothing), `"total"`, `"effect"` (replaces the
 * current effect die), `"paid"` (the total grows beyond the two free dice; costs a Plot Point). A full slot, or a
 * slot a die may not take, leaves the selection unchanged.
 * @param {{result: number}[]} entries
 * @param {Selection} selection
 * @param {number} index
 * @param {"auto"|"total"|"effect"|"paid"} [slot]
 * @returns {Selection}
 */
export function applyPick(entries, selection, index, slot = "auto") {
  const entry = entries[index];
  const paid = selection.paid ?? [];
  if (!entry || isHitch(entry)) return selection;
  if (selection.total.includes(index) || selection.effect.includes(index)) {
    return {
      total: selection.total.filter((i) => i !== index), effect: selection.effect.filter((i) => i !== index),
      paid: paid.filter((i) => i !== index)
    };
  }
  const roomInTotal = unpaidCount(selection) < LEVERAGE.prime.totalDice;
  const effectFree = selection.effect.length < LEVERAGE.prime.effectDice;
  const target = slot === "auto" ? (roomInTotal ? "total" : effectFree ? "effect" : null) : slot;
  if (target === "total" && roomInTotal) return { ...selection, total: [...selection.total, index], paid };
  if (target === "paid") return { ...selection, total: [...selection.total, index], paid: [...paid, index] };
  if (target === "effect") return { total: selection.total, effect: [index], paid };
  return selection;
}

/**
 * Checks a selection against the rules. `errors` are forbidden things; `missing` is what is still to choose before
 * the roll can be confirmed. `ok` = no errors and nothing missing.
 * @param {{faces: number, result: number}[]} entries
 * @param {Selection} selection
 * @param {{ppAvailable?: number}} [options]
 * @returns {{ok: boolean, errors: string[], missing: string[], ppCost: number}}
 */
export function validate(entries, selection, { ppAvailable = 0 } = {}) {
  const errors = [];
  const missing = [];
  const paid = selection.paid ?? [];
  const { eligible } = classify(entries);
  const all = [...selection.total, ...selection.effect];
  if (all.some((i) => !entries[i])) errors.push("unknown-die");
  if (new Set(all).size !== all.length) errors.push("duplicate-die");
  if (all.some((i) => entries[i] && isHitch(entries[i]))) errors.push("hitch-selected");
  if (paid.some((i) => !selection.total.includes(i))) errors.push("paid-outside-total");
  if (paid.some((i) => selection.effect.includes(i))) errors.push("paid-effect");
  if (unpaidCount(selection) > LEVERAGE.prime.totalDice) errors.push("too-many-total");
  if (selection.effect.length > LEVERAGE.prime.effectDice) errors.push("too-many-effect");
  const ppCost = paid.length * LEVERAGE.prime.paidDiceCost;
  if (ppCost > ppAvailable) errors.push("not-enough-pp");
  if (unpaidCount(selection) < Math.min(LEVERAGE.prime.totalDice, eligible.length)) missing.push("total");
  const spare = eligible.length - selection.total.length - selection.effect.length;
  if (!selection.effect.length && spare > 0) missing.push("effect");
  return { ok: !errors.length && !missing.length, errors, missing, ppCost };
}

/**
 * Result of a selection.
 * @param {{faces: number, result: number, paid?: boolean}[]} entries
 * @param {Selection} selection
 * @returns {{total: number, effectFaces: number, effectDefault: boolean, ppSpent: number, hitches: number, botch: boolean}}
 *   `effectFaces` is the effect die size (d4 when no die is left: `effectDefault`); a botch has total 0.
 */
export function summarize(entries, selection) {
  const { hitches, botch } = classify(entries);
  const paid = selection.paid ?? entries.flatMap((e, i) => (e.paid ? [i] : []));
  const effectDefault = !selection.effect.length;
  return {
    total: selection.total.reduce((sum, i) => sum + entries[i].result, 0),
    effectFaces: effectDefault ? LEVERAGE.prime.defaultEffectDie : Math.max(...selection.effect.map((i) => entries[i].faces)),
    effectDefault,
    ppSpent: paid.length * LEVERAGE.prime.paidDiceCost,
    hitches: hitches.length,
    botch
  };
}

/**
 * Heroic success steps: one per full 5 points of margin (0 below 5).
 * @param {number} margin Total minus difficulty.
 * @returns {number}
 */
export function heroicSteps(margin) {
  return margin >= LEVERAGE.prime.heroicStep ? Math.floor(margin / LEVERAGE.prime.heroicStep) : 0;
}

/**
 * Compares a total against a difficulty. A tie is a failure (the Fixer wins ties).
 * @param {number} total
 * @param {number} difficulty
 * @returns {{margin: number, outcome: "fail"|"success"|"heroic", steps: number}}
 */
export function compare(total, difficulty) {
  const margin = total - difficulty;
  const steps = heroicSteps(margin);
  return { margin, outcome: margin <= 0 ? "fail" : steps > 0 ? "heroic" : "success", steps };
}

/**
 * Raises an effect die by `steps` sizes (a d12 stays a d12).
 * @param {number} faces
 * @param {number} steps
 * @returns {number}
 */
export function stepEffect(faces, steps) {
  return Array.from({ length: Math.max(0, steps) }).reduce(stepUp, faces);
}
