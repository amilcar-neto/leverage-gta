/**
 * Pure logic of the "Choose dice" window and of confirming a Cortex Prime roll (docs/08). The draft is a
 * `prime-math` selection (`{total, effect, paid}`, dice by index); nothing here touches Foundry.
 */
import { LEVERAGE } from "../config.mjs";
import { applyPick, compare, summarize, validate } from "./prime-math.mjs";

/** @returns {{total: number[], effect: number[], paid: number[]}} A draft with nothing chosen. */
export const emptyDraft = () => ({ total: [], effect: [], paid: [] });

/** Whether a die is placed (in the total or as the effect). */
const placed = (draft, index) => draft.total.includes(index) || draft.effect.includes(index);

/**
 * State of one die: `hitch` (rolled 1, cannot be chosen), `total`, `effect` or `free`.
 * @param {{result: number}} entry
 * @param {number} index Position of the die in the roll.
 * @param {{total: number[], effect: number[]}} draft
 * @returns {"hitch"|"total"|"effect"|"free"}
 */
export function dieState(entry, index, draft) {
  if (entry.result === 1) return "hitch";
  return draft.total.includes(index) ? "total" : draft.effect.includes(index) ? "effect" : "free";
}

/**
 * State of each die for the window.
 * @param {{result: number}[]} entries
 * @param {{total: number[], effect: number[], paid: number[]}} draft
 * @returns {{index: number, state: "hitch"|"total"|"effect"|"free", paid: boolean}[]}
 */
export function dieStates(entries, draft) {
  return entries.map((entry, index) => ({ index, state: dieState(entry, index, draft), paid: draft.paid.includes(index) }));
}

/**
 * Caption under a die, for the window and for the card: HITCH, TOTAL (+PP when bought), EFFECT or its size.
 * @param {{faces: number}} entry
 * @param {"hitch"|"total"|"effect"|"free"} state
 * @param {boolean} paid
 * @param {(key: string) => string} t Translate function.
 * @returns {string}
 */
export function dieCaption(entry, state, paid, t) {
  if (state === "hitch") return t("LEVERAGE.Roll.hitch");
  if (state === "total") return t(paid ? "LEVERAGE.Roll.totalPaid" : "LEVERAGE.Roll.total");
  if (state === "effect") return t("LEVERAGE.Roll.effect");
  return `d${entry.faces}`;
}

/**
 * Click on a die. A placed die is released; a free die goes to the total if it has room, else to the effect.
 * With both full it changes nothing and asks for the paid offer (`offer`) when a Plot Point is available.
 * @param {{result: number}[]} entries
 * @param {{total: number[], effect: number[], paid: number[]}} draft
 * @param {number} index
 * @param {{ppLeft?: number}} [options] Plot Points still free to spend.
 * @returns {{draft: object, offer: boolean}}
 */
export function clickDie(entries, draft, index, { ppLeft = 0 } = {}) {
  const next = applyPick(entries, draft, index, "auto");
  const stuck = next === draft && !placed(draft, index) && entries[index]?.result !== 1;
  return { draft: normalize(next), offer: stuck && ppLeft >= LEVERAGE.prime.paidDiceCost };
}

/**
 * Forces a die to be the effect die (right click, EFFECT button); on the effect die it releases it.
 * A die in the total moves out of it (a paid die goes back to free: it cannot be the effect).
 * @returns {object} the new draft
 */
export function forceEffect(entries, draft, index) {
  if (!entries[index] || entries[index].result === 1) return draft;
  const released = draft.effect.includes(index) || draft.total.includes(index) ? applyPick(entries, draft, index) : draft;
  if (draft.effect.includes(index) || draft.paid.includes(index)) return normalize(released);
  return normalize(applyPick(entries, released, index, "effect"));
}

/**
 * Buys a free die for the total with Plot Points (it does not count against the two free dice).
 * @param {{ppLeft?: number}} [options]
 * @returns {object} the new draft
 */
export function buyDie(entries, draft, index, { ppLeft = 0 } = {}) {
  const entry = entries[index];
  if (!entry || entry.result === 1 || placed(draft, index) || ppLeft < LEVERAGE.prime.paidDiceCost) return draft;
  return normalize(applyPick(entries, draft, index, "paid"));
}

/** Draft with `paid` always an array. */
const normalize = (selection) => ({ total: [...selection.total], effect: [...selection.effect], paid: [...(selection.paid ?? [])] });

/** Draft from a shortcut selection (`autoSelection`). */
export const draftFrom = (selection) => normalize(selection);

/**
 * Plot Points the window may spend: what the character had when it rolled, never more than it has now.
 * @param {object} data Roll data.
 * @param {number|null} current Plot Points of the actor now (null = no character).
 * @returns {number}
 */
export function ppAvailable(data, current) {
  if (current === null) return 0;
  return Math.max(0, Math.min(data.ppAtRoll ?? current, current));
}

/**
 * Everything the footer shows, from the draft.
 * @param {object} data Roll data (pending).
 * @param {{total: number[], effect: number[], paid: number[]}} draft
 * @param {{ppAvailable?: number}} [options]
 * @returns {object} `total`, `effectFaces`, `effectDefault`, `ppSpent`, `ppLeft`, `ppAvailable`, `ok`, `missing`, `errors`, `versus`
 */
export function draftSummary(data, draft, { ppAvailable: available = 0 } = {}) {
  const checked = validate(data.entries, draft, { ppAvailable: available });
  const sum = summarize(data.entries, draft);
  const difficulty = data.versus?.difficulty;
  return {
    total: sum.total, effectFaces: sum.effectFaces, effectDefault: sum.effectDefault, ppSpent: sum.ppSpent,
    ppLeft: Math.max(0, available - sum.ppSpent), ppAvailable: available, ok: checked.ok,
    missing: checked.missing, errors: checked.errors, hitches: sum.hitches, botch: sum.botch,
    versus: typeof difficulty === "number" ? compare(sum.total, difficulty) : null
  };
}

/**
 * Applies a confirmed draft to a pending roll. Pure; returns null when the roll is not pending or the draft is invalid
 * (including indexes that are not whole numbers inside the roll).
 * @param {object} data Roll data (v2, pending).
 * @param {{total: number[], effect: number[], paid?: number[]}} draft
 * @param {{ppAvailable?: number}} [options]
 * @returns {object|null} the resolved roll data
 */
export function applyConfirm(data, draft, { ppAvailable: available = 0 } = {}) {
  if (!data || data.status !== "pending") return null;
  // Validate the raw selection first (it may come from a socket): only whole die indexes are accepted.
  if (!validate(data.entries, draft, { ppAvailable: available }).ok) return null;
  const picked = normalize(draft);
  const sum = summarize(data.entries, picked);
  return {
    ...data,
    status: "resolved",
    entries: data.entries.map((e, i) => ({ ...e, kept: picked.total.includes(i), effect: picked.effect.includes(i), paid: picked.paid.includes(i) })),
    selection: picked,
    keptCount: picked.total.length,
    total: sum.total,
    effectDie: sum.effectFaces,
    ppSpent: sum.ppSpent
  };
}
