/**
 * Pure logic of the roll card buttons (docs/08 "O card"): keep another die for a Plot Point, and turn a 1 into a
 * Complication of the active Job. Functions never mutate their input; they return the new value or null when the
 * action is not possible. No Foundry dependency (unit tested).
 */
import { LEVERAGE } from "../config.mjs";
import { stepUp } from "./die.mjs";

/**
 * Index of the die a Plot Point would keep next: the highest die that is neither kept nor a 1 (earlier die on ties).
 * @param {{result: number, kept: boolean, one: boolean}[]} entries
 * @returns {number} -1 when there is none
 */
export function nextSpareIndex(entries) {
  let best = -1;
  entries.forEach((e, index) => {
    if (e.kept || e.one) return;
    if (best < 0 || e.result > entries[best].result) best = index;
  });
  return best;
}

/**
 * Keeps the next highest die. Raises the total, `keptCount` and `ppSpent`.
 * @param {object} data `flags.leverage-gta.roll`
 * @returns {object|null} new roll data, or null when no die can be kept  (also null for a Cortex Prime card: its extra dice are bought in the Choose dice window)
 */
export function keepNextDie(data) {
  if (data.mode === "prime" || data.status === "pending") return null;
  const entries = data.entries ?? [];
  const index = nextSpareIndex(entries);
  if (index < 0) return null;
  return {
    ...data,
    entries: entries.map((e, i) => (i === index ? { ...e, kept: true } : e)),
    keptCount: (data.keptCount ?? 0) + 1,
    total: (data.total ?? 0) + entries[index].result,
    ppSpent: (data.ppSpent ?? 0) + 1
  };
}

/**
 * Indexes (into `entries`) of the 1s that no Complication was created for yet.
 * @param {object} data
 * @returns {number[]}
 */
export function unresolvedOnes(data) {
  const done = new Set(data.complicationsResolved ?? []);
  return (data.entries ?? []).flatMap((e, i) => (e.one && !done.has(i) ? [i] : []));
}

/**
 * Marks the first unresolved 1 as resolved.
 * @param {object} data
 * @returns {object|null} new roll data, or null when every 1 is resolved
 */
export function resolveNextOne(data) {
  const [index] = unresolvedOnes(data);
  if (index === undefined) return null;
  return { ...data, complicationsResolved: [...(data.complicationsResolved ?? []), index] };
}

/**
 * Creates a Complication (a d6) or raises an existing one by one step (d6, d8, d10, d12; a d12 stays).
 * @param {{id: string, name: string, die: number}[]} complications The table's Complications (`complications` setting).
 * @param {{id?: string|null, name?: string}} choice `id` of an existing Complication to raise, else a new one by `name`.
 * @param {() => string} newId Id generator for a new Complication.
 * @returns {{list: {id: string, name: string, die: number}[], complication: {id: string, name: string, die: number}}|null} the new list; null for an empty name or unknown id
 */
export function applyComplication(complications, choice, newId) {
  const list = complications ?? [];
  if (choice.id) {
    const found = list.find((c) => c.id === choice.id);
    if (!found) return null;
    const complication = { ...found, die: stepUp(found.die) };
    return { list: list.map((c) => (c.id === found.id ? complication : c)), complication };
  }
  const name = String(choice.name ?? "").trim();
  if (!name) return null;
  const complication = { id: newId(), name, die: LEVERAGE.complicationDie };
  return { list: [...list, complication], complication };
}

/**
 * Steps a die up `steps` times. Steps past the top die (d12) are not lost: they are counted as overflow, which
 * means "out of the scene" (docs/02, Wasted / Busted).
 * @param {number} die
 * @param {number} steps
 * @returns {{die: number, overflow: number}}
 */
export function raiseDie(die, steps) {
  let current = die;
  let overflow = 0;
  for (let i = 0; i < steps; i += 1) {
    const next = stepUp(current);
    if (next === current) overflow += 1;
    current = next;
  }
  return { die: current, overflow };
}

/**
 * Activates every hitch not yet resolved in one go (Cortex Prime, docs/08). The GM picks one of three ways, n = hitches:
 * - `new`: one new Complication (d6) stepped up n - 1 times; 1 Plot Point for the player.
 * - `raise`: one existing Complication stepped up n times; 1 Plot Point.
 * - `separate`: n new Complications (d6), one name each; 1 Plot Point each.
 * A botch (every die is a 1) is free: the same Complications, no Plot Point. A step past d12 puts the character out
 * of the scene: it is reported in `outOfScene` (names) and the card shows a warning; nothing else is automated.
 * @param {object} data `flags.leverage-gta.roll` of a resolved Cortex Prime card.
 * @param {{id: string, name: string, die: number}[]} complications The table's Complications.
 * @param {{mode: "new"|"raise"|"separate", name?: string, id?: string, names?: string[]}} choice
 * @param {() => string} newId Id generator for new Complications.
 * @returns {{data: object, list: object[], complications: object[], ppGain: number, outOfScene: string[]}|null}
 *   null when no hitch is left, the choice is not valid (empty name, unknown id, wrong name count) or the card is not resolved
 */
export function activateHitches(data, complications, choice, newId) {
  const pending = unresolvedOnes(data);
  const n = pending.length;
  if (!n || data.opposition || data.status === "pending" || !choice) return null;
  const made = buildHitchComplications(complications ?? [], choice, n, newId);
  if (!made) return null;
  const ppGain = data.botch ? 0 : made.pp;
  const outOfScene = [...(data.outOfScene ?? []), ...made.outOfScene];
  const next = {
    ...data,
    complicationsResolved: [...(data.complicationsResolved ?? []), ...pending],
    hitchPP: (data.hitchPP ?? 0) + ppGain,
    hitchesActivated: (data.hitchesActivated ?? 0) + n,
    outOfScene
  };
  return { data: next, list: made.list, complications: made.created, ppGain, outOfScene: made.outOfScene };
}

/** The Complications `activateHitches` writes for `n` hitches: `{list, created, pp, outOfScene}` or null for a bad choice. */
function buildHitchComplications(list, choice, n, newId) {
  if (choice.mode === "raise") {
    const found = list.find((c) => c.id === choice.id);
    if (!found) return null;
    const { die, overflow } = raiseDie(found.die, n);
    const created = { ...found, die };
    return { list: list.map((c) => (c.id === found.id ? created : c)), created: [created], pp: 1, outOfScene: overflow ? [found.name] : [] };
  }
  const names = choice.mode === "separate" ? (choice.names ?? []) : [choice.name];
  const clean = names.map((name) => String(name ?? "").trim());
  const expected = choice.mode === "separate" ? n : choice.mode === "new" ? 1 : 0;
  if (clean.length !== expected || clean.some((name) => !name)) return null;
  const steps = choice.mode === "new" ? n - 1 : 0;
  const created = clean.map((name) => ({ id: newId(), name, die: raiseDie(LEVERAGE.complicationDie, steps).die }));
  const overflow = raiseDie(LEVERAGE.complicationDie, steps).overflow > 0;
  return { list: [...list, ...created], created, pp: choice.mode === "new" ? 1 : n, outOfScene: overflow ? clean : [] };
}
