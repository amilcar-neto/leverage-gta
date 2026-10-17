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
 * @returns {object|null} new roll data, or null when no die can be kept
 */
export function keepNextDie(data) {
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
 * @param {{name?: string, complications?: {id: string, name: string, die: number}[]}} job `activeJob` setting value.
 * @param {{id?: string|null, name?: string}} choice `id` of an existing Complication to raise, else a new one by `name`.
 * @param {() => string} newId Id generator for a new Complication.
 * @returns {{job: object, complication: {id: string, name: string, die: number}}|null} null for an empty name or unknown id
 */
export function applyComplication(job, choice, newId) {
  const list = job?.complications ?? [];
  if (choice.id) {
    const found = list.find((c) => c.id === choice.id);
    if (!found) return null;
    const complication = { ...found, die: stepUp(found.die) };
    return { job: { ...job, complications: list.map((c) => (c.id === found.id ? complication : c)) }, complication };
  }
  const name = String(choice.name ?? "").trim();
  if (!name) return null;
  const complication = { id: newId(), name, die: LEVERAGE.complicationDie };
  return { job: { ...job, name: job?.name ?? "", complications: [...list, complication] }, complication };
}
