/**
 * Pure helpers of the Job Tracker (docs/09): edits of the `activeJob` value
 * `{ name, complications: [{id, name, die}], sceneTraits: [{id, name, die}] }`. Nothing here touches Foundry and
 * nothing mutates its input; every function returns a new job (or an equal one when the edit does not apply).
 */
import { LEVERAGE } from "../../config.mjs";
import { isValidDie, stepDown, stepUp } from "../../dice/die.mjs";

/** The two die lists of a Job and the die a new entry starts with. */
export const LISTS = Object.freeze({ complications: LEVERAGE.complicationDie, sceneTraits: LEVERAGE.defaultDie });

/**
 * Keeps the valid entries of a die list (an id and a legal die) with a string name and a numeric die.
 * @param {*} list
 * @returns {{id: string, name: string, die: number}[]}
 */
export function cleanEntries(list) {
  return (Array.isArray(list) ? list : [])
    .filter((e) => e && e.id && isValidDie(Number(e.die)))
    .map((e) => ({ ...e, name: String(e.name ?? ""), die: Number(e.die) }));
}

/**
 * Normalises a Job so every list exists and every entry is valid.
 * @param {object} [job]
 * @returns {{name: string, complications: object[], sceneTraits: object[]}}
 */
export function normalizeJob(job) {
  return { ...job, name: String(job?.name ?? ""), goal: String(job?.goal ?? ""), complications: cleanEntries(job?.complications), sceneTraits: cleanEntries(job?.sceneTraits) };
}

/**
 * @param {object} job
 * @param {string} name
 * @returns {object} the Job with a new (trimmed) name
 */
export const renameJob = (job, name) => ({ ...normalizeJob(job), name: String(name ?? "").trim() });

/**
 * @param {object} job
 * @param {string} goal
 * @returns {object} the Job with a new (trimmed) goal
 */
export const setJobGoal = (job, goal) => ({ ...normalizeJob(job), goal: String(goal ?? "").trim() });

/**
 * Adds an entry to a list.

 * @param {object} job
 * @param {"complications"|"sceneTraits"} list
 * @param {string} name Empty names are ignored.
 * @param {() => string} newId
 * @returns {object}
 */
export function addEntry(job, list, name, newId) {
  const base = normalizeJob(job);
  const label = String(name ?? "").trim();
  if (!(list in LISTS) || !label) return base;
  return { ...base, [list]: [...base[list], { id: newId(), name: label, die: LISTS[list] }] };
}

/**
 * Removes an entry by id.
 * @param {object} job
 * @param {"complications"|"sceneTraits"} list
 * @param {string} id
 * @returns {object}
 */
export function removeEntry(job, list, id) {
  const base = normalizeJob(job);
  return list in LISTS ? { ...base, [list]: base[list].filter((e) => e.id !== id) } : base;
}

/**
 * Moves an entry's die one step. A d12 stays a d12 going up and a d4 stays a d4 going down.
 * @param {object} job
 * @param {"complications"|"sceneTraits"} list
 * @param {string} id
 * @param {number} direction positive raises, negative lowers
 * @returns {object}
 */
export function stepEntry(job, list, id, direction) {
  const base = normalizeJob(job);
  if (!(list in LISTS)) return base;
  const next = (die) => (direction > 0 ? stepUp(die) : (stepDown(die) ?? die));
  return { ...base, [list]: base[list].map((e) => (e.id === id ? { ...e, die: next(e.die) } : e)) };
}

/**
 * Adds `delta` to a counter and keeps it in `0..max` (`max` omitted: no upper limit).
 * @param {number} value
 * @param {number} delta
 * @param {number} [max]
 * @returns {number}
 */
export function clampedAdd(value, delta, max = Infinity) {
  return Math.min(max, Math.max(0, Math.trunc(Number(value) || 0) + Math.trunc(Number(delta) || 0)));
}
