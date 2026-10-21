/**
 * Pure helpers of the NPC sheet (no Foundry globals, unit tested): Trait list edits, die steps, gang size and
 * which tiers show Attributes and Roles (docs/05 `npc`, docs/06 "Fichas de NPC e Local").
 */
import { LEVERAGE } from "../../config.mjs";
import { npcSources } from "../../dice/opposition.mjs";

/** Tiers that may fill Attributes and Roles (extras and marks use Traits only). */
export const LADDER_TIERS = Object.freeze(["foil", "agent"]);

/** Largest gang the sheet writes (the opposition roller caps its gang row at the same number). */
export const GANG_MAX = LEVERAGE.gangMax;

/** @param {string} tier @returns {boolean} whether the tier shows the Attributes / Roles panels. */
export const showsLadders = (tier) => LADDER_TIERS.includes(tier);

/**
 * Whether Life and Vest apply to the tier: extras are a gang of dice (the book), so they have none.
 * @param {string} tier
 * @returns {boolean}
 */
export const showsVitalsFor = (tier) => tier !== "extra";

/**
 * Whether the gang panel is shown: always for extras; for the other tiers only when they have a gang.
 * @param {string} tier
 * @param {number} size Gang size.
 * @returns {boolean}
 */
export const showsGang = (tier, size) => tier === "extra" || Number(size) > 0;

/**
 * Die written by a click on a ladder die of the NPC: clicking the current die clears it (every NPC die may be blank).
 * @param {number|null} current
 * @param {number} clicked
 * @returns {number|null|undefined} `undefined` when the click is not a valid die
 */
export function nextNpcDie(current, clicked) {
  if (!LEVERAGE.dice.includes(clicked)) return undefined;
  return clicked === current ? null : clicked;
}

/**
 * One step up or down the die ladder, stopping at the ends.
 * @param {number} die Current die size.
 * @param {number} delta +1 or -1.
 * @returns {number}
 */
export function stepDie(die, delta) {
  const index = LEVERAGE.dice.indexOf(die);
  const from = index < 0 ? LEVERAGE.dice.indexOf(LEVERAGE.defaultDie) : index;
  return LEVERAGE.dice[Math.min(LEVERAGE.dice.length - 1, Math.max(0, from + Math.sign(delta)))];
}

/**
 * Gang size kept between 0 and {@link GANG_MAX}.
 * @param {*} value
 * @returns {number}
 */
export function clampGang(value) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? Math.min(GANG_MAX, Math.max(0, n)) : 0;
}

/** Plain copy of the Trait list. */
const copy = (traits) => (traits ?? []).map((t) => ({ name: t.name, die: t.die }));

/** @returns {{name: string, die: number}[]} the list plus a blank Trait with the default die. */
export function addTrait(traits, name = "") {
  return [...copy(traits), { name, die: LEVERAGE.defaultDie }];
}

/** @returns {{name: string, die: number}[]} the list without the Trait at `index` (same list when out of range). */
export function removeTrait(traits, index) {
  return copy(traits).filter((_, i) => i !== index);
}

/**
 * Changes one field of one Trait.
 * @param {{name: string, die: number}[]} traits
 * @param {number} index
 * @param {{name?: string, die?: number}} patch
 * @returns {{name: string, die: number}[]} a new list (same content when the index is out of range)
 */
export function patchTrait(traits, index, patch) {
  return copy(traits).map((t, i) => (i === index ? { ...t, ...patch } : t));
}

/**
 * Template rows of the Trait list.
 * @param {{name: string, die: number}[]} traits
 * @param {(index: number) => string} keyOf Opposition-roller source key of a Trait.
 * @returns {{index: number, name: string, die: number, sourceKey: string, canDown: boolean, canUp: boolean}[]}
 */
export function traitRows(traits, keyOf) {
  const first = LEVERAGE.dice[0];
  const last = LEVERAGE.dice[LEVERAGE.dice.length - 1];
  return (traits ?? []).map((t, index) => ({
    index, name: t.name, die: t.die, sourceKey: keyOf(index), canDown: t.die > first, canUp: t.die < last
  }));
}

/**
 * The rows of a one-line die ladder (gang die, weapon die).
 * @param {number|null} current
 * @param {boolean} canEdit
 * @param {(die: number) => string} label Accessible label of a die button.
 * @returns {{die: number, muted: boolean, pressed: boolean, action: string|undefined, label: string}[]}
 */
export function dieLadder(current, canEdit, label) {
  return LEVERAGE.dice.map((die) => ({ die, muted: die !== current, pressed: die === current, label: label(die), action: canEdit ? "setDie" : undefined }));
}

/** Data paths a ladder die may write (the sheet checks `data-die-path` against this before updating). */
const DIE_PATH = /^system\.(?:gang|weapon|attributes\.[a-z]+|roles\.[a-z]+)\.die$/;

/** @param {string} path @returns {boolean} whether `path` is a die the NPC sheet edits. */
export const isDiePath = (path) => typeof path === "string" && DIE_PATH.test(path);

/**
 * How many dice ROLL AS OPPOSITION loads into the roller: every die of the NPC plus its gang.
 * @param {object} system NPC `system` data.
 * @param {Parameters<typeof npcSources>[1]} names Display names of the sources.
 * @returns {number}
 */
export function opposeDiceCount(system, names) {
  const gang = system.gang?.die ? system.gang.size : 0;
  return npcSources(system, names).length + gang;
}
