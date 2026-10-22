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
 * Creates a Complication (a d6) or raises an existing one by one step (d6, d8, d10, d12; a d12 stays). It is the
 * one-hitch case of `resolveHitches`: both use `buildHitchComplications`.
 * @param {{id: string, name: string, die: number}[]} complications The table's Complications (`complications` setting).
 * @param {{id?: string|null, name?: string}} choice `id` of an existing Complication to raise, else a new one by `name`.
 * @param {() => string} newId Id generator for a new Complication.
 * @returns {{list: {id: string, name: string, die: number}[], complication: {id: string, name: string, die: number}}|null} the new list; null for an empty name or unknown id
 */
export function applyComplication(complications, choice, newId) {
  const how = choice.id ? { mode: "raise", id: choice.id } : { mode: "new", name: choice.name };
  const made = buildHitchComplications(complications ?? [], how, 1, newId);
  return made ? { list: made.list, complication: made.created[0] } : null;
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
 * Resolves every hitch not yet resolved in one go (Cortex Prime, docs/08). The GM picks one of three ways, n = hitches:
 * - `new`: one new Complication (d6) stepped up n - 1 times; 1 Plot Point for the player.
 * - `raise`: one existing Complication stepped up n times (a d12 too: the steps past it are "out of the scene"); 1 Plot Point.
 * - `separate`: n new Complications (d6, never stepped up), one name each; 1 Plot Point each.
 * A botch (every die is a 1) is ONE free Complication stepped up one step per hitch past the first (book): only `new`
 * and `raise`, no Plot Point. A character that is not a Crew (`gainsPP` false) gets no Plot Point either. A step past
 * d12 puts the character out of the scene: it is reported in `outOfScene` (names); nothing else is automated.
 * @param {object} data `flags.leverage-gta.roll` of a resolved Cortex Prime card.
 * @param {{id: string, name: string, die: number}[]} complications The table's Complications.
 * @param {{mode: "new"|"raise"|"separate", name?: string, id?: string, names?: string[]}} choice
 * @param {() => string} newId Id generator for new Complications.
 * @param {{gainsPP?: boolean}} [options] `gainsPP` false when nobody receives the Plot Points (default true).
 * @returns {{data: object, list: object[], complications: object[], previous: object|null, ppGain: number, outOfScene: string[]}|null}
 *   null when no hitch is left, the choice is not valid (empty name, unknown id, wrong name count, `separate` on a botch)
 *   or the card is not resolved. `previous` is the Complication as it was before a `raise` (for `undoHitchList`).
 */
export function resolveHitches(data, complications, choice, newId, { gainsPP = true } = {}) {
  const pending = unresolvedOnes(data);
  const n = pending.length;
  if (!n || data.opposition || data.status === "pending" || !choice) return null;
  if (data.botch && choice.mode === "separate") return null;
  const made = buildHitchComplications(complications ?? [], choice, n, newId);
  if (!made) return null;
  const ppGain = data.botch || !gainsPP ? 0 : made.pp;
  const next = {
    ...data,
    complicationsResolved: [...(data.complicationsResolved ?? []), ...pending],
    hitchPP: (data.hitchPP ?? 0) + ppGain,
    hitchesActivated: (data.hitchesActivated ?? 0) + n,
    outOfScene: [...new Set([...(data.outOfScene ?? []), ...made.outOfScene])]
  };
  return { data: next, list: made.list, complications: made.created, previous: made.previous, ppGain, outOfScene: made.outOfScene };
}

/**
 * Takes back the Complication list change of `resolveHitches` (used when a later write fails): removes what it created,
 * or puts the raised Complication back to its old die. Other entries are left as they are now.
 * @param {{id: string, name: string, die: number}[]} list The table's Complications now.
 * @param {{complications: {id: string}[], previous: {id: string}|null}} result What `resolveHitches` returned.
 * @returns {{id: string, name: string, die: number}[]}
 */
export function undoHitchList(list, { complications, previous }) {
  if (previous) return list.map((c) => (c.id === previous.id ? previous : c));
  const made = new Set(complications.map((c) => c.id));
  return list.filter((c) => !made.has(c.id));
}

/** The Complications for `n` hitches: `{list, created, previous, pp, outOfScene}` or null for a bad choice. */
function buildHitchComplications(list, choice, n, newId) {
  if (choice.mode === "raise") {
    const found = list.find((c) => c.id === choice.id);
    if (!found) return null;
    const { die, overflow } = raiseDie(found.die, n);
    const created = { ...found, die };
    return { list: list.map((c) => (c.id === found.id ? created : c)), created: [created], previous: found, pp: 1, outOfScene: overflow ? [found.name] : [] };
  }
  const separate = choice.mode === "separate";
  if (!separate && choice.mode !== "new") return null;
  const names = separate ? (Array.isArray(choice.names) ? choice.names : []) : [choice.name];
  const clean = names.map((name) => String(name ?? "").trim());
  if (clean.length !== (separate ? n : 1) || clean.some((name) => !name)) return null;
  const { die, overflow } = raiseDie(LEVERAGE.complicationDie, separate ? 0 : n - 1);
  const created = clean.map((name) => ({ id: newId(), name, die }));
  return { list: [...list, ...created], created, previous: null, pp: separate ? n : 1, outOfScene: overflow ? clean : [] };
}
