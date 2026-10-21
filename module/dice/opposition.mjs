/**
 * Opposition roll of the Fixer (docs/08 "Oposição"). The pure half builds the dice from the roller's sources (loose
 * dice, police by stars, gang, NPC, location and Job Traits) and the roll data of the card; it has no Foundry
 * dependency and is unit tested. The Foundry half rolls and posts the same card as a Pool roll, headed "FIXER".
 * `openOppositionRoller` and `rollOpposition` are the entry points for scene controls and `game.leverage.opposition`.
 */
import { LEVERAGE, SYSTEM_ID } from "../config.mjs";
import { isValidDie } from "./die.mjs";
import { policePool } from "../rules/stars.mjs";
import { t } from "../applications/components/i18n.mjs";
import { buildRollData, evaluateDice } from "./roll-core.mjs";

/** `kind` of the entries of an opposition roll. */
export const OPPOSITION_KIND = "opposition";

/** Dice rolled when nothing is chosen: "no opposition" (docs/02). */
export const NO_OPPOSITION_POOL = LEVERAGE.defaultOppositionDice;

/**
 * @typedef {object} OppositionDie
 * @property {string} ref Stable id inside the roll (`opp.d8.0`, `police.1`...).
 * @property {string} label Name shown on the card chip.
 * @property {number} die Die size.
 * @property {string} kind Always `"opposition"` (so the card does not treat it as an Attribute, Money, etc.).
 */

/** @returns {OppositionDie} */
function entry(ref, label, die) {
  return { ref, label, die, kind: OPPOSITION_KIND };
}

/**
 * Empty loose-dice counters, one per die size.
 * @returns {Record<number, number>}
 */
export function emptyCounts() {
  return Object.fromEntries(LEVERAGE.dice.map((size) => [size, 0]));
}

/**
 * Changes one counter, keeping it between 0 and the maximum.
 * @param {Record<number, number>} counts
 * @param {number} die
 * @param {number} delta
 * @param {number} [max] Defaults to `LEVERAGE.looseDiceMax`.
 * @returns {Record<number, number>} a new object
 */
export function stepCount(counts, die, delta, max = LEVERAGE.looseDiceMax) {
  if (!isValidDie(die)) return { ...counts };
  return { ...counts, [die]: Math.min(max, Math.max(0, (counts[die] ?? 0) + delta)) };
}

/**
 * Loose dice from the counters, smallest die first.
 * @param {Record<number, number>} counts
 * @param {string} label Chip name of loose dice.
 * @returns {OppositionDie[]}
 */
export function looseDice(counts, label) {
  return LEVERAGE.dice.flatMap((size) => Array.from({ length: counts[size] ?? 0 }, (_, i) => entry(`opp.d${size}.${i}`, label, size)));
}

/**
 * Police Pool of the city at a star level (docs/02).
 * @param {string} cityId
 * @param {number} stars
 * @param {string} label
 * @param {object[]} [scales] City scales (settings); defaults to the built-in ones.
 * @returns {OppositionDie[]}
 */
export function policeDice(cityId, stars, label, scales) {
  return policePool(cityId, stars, scales).map((size, i) => entry(`police.${i}`, label, size));
}

/**
 * City whose scale gives the police Pool (docs/02, docs/06): the first Location that names a city the scales know
 * (the Location is where the Crew is, and each city has its own police), else the city of the wanted state.
 * @param {string} wantedCity City id of the `wanted` setting.
 * @param {{system?: {city?: string}}[]} locations Locations in play (selected one first).
 * @param {{id: string}[]} scales City scales in use.
 * @returns {string}
 */
export function policeCity(wantedCity, locations, scales) {
  const known = new Set(scales.map((scale) => scale.id));
  return locations.map((location) => location?.system?.city).find((city) => city && known.has(city)) ?? wantedCity;
}

/**
 * A gang: `size` dice of one size.
 * @param {number} size How many.
 * @param {number|null} die Die size (null or invalid gives an empty list).
 * @param {string} label
 * @returns {OppositionDie[]}
 */
export function gangDice(size, die, label) {
  const count = Math.max(0, Math.trunc(Number(size)) || 0);
  return isValidDie(die) ? Array.from({ length: count }, (_, i) => entry(`gang.${i}`, label, die)) : [];
}

/**
 * Source key of the Trait at `index` in the NPC list (the NPC sheet uses it to put one Trait in the roller).
 * @param {number} index
 * @returns {string}
 */
export const npcTraitKey = (index) => `npc.trait.${index}`;

/**
 * Selectable dice of an NPC: Traits, Attributes, Roles and the weapon that have a die (docs/05). A blank Trait name
 * falls back to `names.trait`. The weapon is listed only when `names.weapon` is given.
 * @param {{traits?: {name: string, die: number}[], attributes?: object, roles?: object, weapon?: {die: number|null}}} system NPC `system` data.
 * @param {{attribute: (key: string) => string, role: (key: string) => string, trait: string, weapon?: string}} names Display names.
 * @returns {{key: string, label: string, die: number}[]}
 */
export function npcSources(system, names) {
  const traits = (system?.traits ?? []).map((t, i) => ({ key: npcTraitKey(i), label: t.name?.trim() || names.trait, die: t.die }));
  const attributes = Object.entries(system?.attributes ?? {}).map(([k, v]) => ({ key: `npc.attr.${k}`, label: names.attribute(k), die: v?.die }));
  const roles = Object.entries(system?.roles ?? {}).map(([k, v]) => ({ key: `npc.role.${k}`, label: names.role(k), die: v?.die }));
  const weapon = names.weapon ? [{ key: "npc.weapon", label: names.weapon, die: system?.weapon?.die }] : [];
  return [...traits, ...attributes, ...roles, ...weapon].filter((s) => isValidDie(s.die));
}

/**
 * Selectable Traits of a location (a list of `{name, die}`).
 * @param {{name: string, die: number}[]} traits
 * @param {string} fallback Name for a blank Trait.
 * @returns {{key: string, label: string, die: number}[]}
 */
export function locationSources(traits, fallback) {
  return (traits ?? []).map((t, i) => ({ key: `loc.${i}`, label: t.name?.trim() || fallback, die: t.die })).filter((s) => isValidDie(s.die));
}

/**
 * Selectable Complications of the active Job.
 * @param {{complications?: {id: string, name: string, die: number}[]}} job
 * @returns {{key: string, label: string, die: number}[]}
 */
export function complicationSources(job) {
  return (job?.complications ?? []).map((c) => ({ key: `job.${c.id}`, label: c.name, die: c.die })).filter((s) => isValidDie(s.die));
}

/**
 * Dice of the picked sources, in the order of the lists.
 * @param {{key: string, label: string, die: number}[][]} groups
 * @param {Set<string>} picked
 * @returns {OppositionDie[]}
 */
export function pickedDice(groups, picked) {
  return groups.flat().filter((s) => picked.has(s.key)).map((s) => entry(s.key, s.label, s.die));
}

/**
 * Normalises what `rollOpposition` receives: die sizes or `{die, label}` objects. Invalid dice are dropped; an empty
 * result is "no opposition" (2d6).
 * @param {(number|{die: number, label?: string, ref?: string})[]} [dice]
 * @param {string} defaultLabel Chip name for plain sizes.
 * @returns {{dice: OppositionDie[], fallback: boolean}} `fallback` is true when 2d6 replaced an empty list
 */
export function normalizeDice(dice, defaultLabel) {
  const given = (dice ?? []).map((d) => (typeof d === "object" && d ? d : { die: d })).filter((d) => isValidDie(Number(d.die)));
  const list = given.length ? given : NO_OPPOSITION_POOL.map((die) => ({ die }));
  return {
    dice: list.map((d, i) => entry(d.ref || `opp.${i}`, d.label || defaultLabel, Number(d.die))),
    fallback: !given.length
  };
}

/**
 * Roll data of an opposition card: a Pool roll without an actor, plus `opposition: true` and the `source` (which
 * shortcuts built the Pool; free text, for the card and macros).
 * @param {object} input
 * @param {OppositionDie[]} input.dice
 * @param {number[]} input.values Face of each die.
 * @param {string} input.name Name on the card header (FIXER).
 * @param {string} input.flavor
 * @param {string} [input.source]
 * @returns {object}
 */
export function buildOppositionData({ dice, values, name, flavor, source = "" }) {
  return { ...buildRollData({ entries: dice, values, actorName: name, flavor }), opposition: true, source };
}

/* ------------------------------------------------------------ Foundry half */

/**
 * Rolls the Fixer's opposition and posts the card (header "FIXER", no portrait, no Plot Point buttons). Only the Fixer.
 * @param {object} [request]
 * @param {(number|{die: number, label?: string})[]} [request.dice] Die sizes or `{die, label}`; empty means 2d6.
 * @param {string} [request.label] Description of the opposition (card subtitle).
 * @param {string} [request.source] Which shortcut built it (`"police"`, `"gang"`, `"manual"`...).
 * @returns {Promise<ChatMessage|null>}
 */
export async function rollOpposition({ dice, label, source = "manual" } = {}) {
  if (!game.user.isGM) {
    ui.notifications.warn(t("LEVERAGE.Opposition.gmOnly"));
    return null;
  }
  const { dice: entries, fallback } = normalizeDice(dice, t("LEVERAGE.Opposition.dieLabel"));
  const { roll, values } = await evaluateDice(entries.map((e) => e.die));
  const flavor = label?.trim() || t(fallback ? "LEVERAGE.Opposition.noneLabel" : "LEVERAGE.Opposition.defaultFlavor");
  const data = buildOppositionData({ dice: entries, values, name: t("LEVERAGE.Opposition.fixer"), flavor, source: fallback ? "none" : source });
  return roll.toMessage({ speaker: { alias: data.actorName }, flavor, flags: { [SYSTEM_ID]: { roll: data } } });
}

/**
 * Opens (or brings to the front) the opposition roller. Only the Fixer.
 * @param {object} [options]
 * @param {Actor} [options.npc] NPC to load into the roller (takes the place of the selected token's NPC).
 * @param {boolean} [options.all] With `npc`: also pick all its dice and switch its gang on.
 * @param {string} [options.toggle] With `npc`: source key of one die to pick or unpick (see `npcSources`).
 * @returns {Promise<void>}
 */
export async function openOppositionRoller(options = {}) {
  if (!game.user.isGM) {
    ui.notifications.warn(t("LEVERAGE.Opposition.gmOnly"));
    return;
  }
  const { OppositionRoller } = await import("../applications/gm/opposition-roller.mjs");
  await OppositionRoller.open(options);
}
