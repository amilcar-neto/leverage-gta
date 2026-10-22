/**
 * Pure helpers of the table state (docs/09): the two lists the Fixer keeps for the whole table, independent of the Job
 * and of the Scene. `globalTraits` are Traits that count in any scene until removed; `complications` are the Job's
 * troubles. Both are lists of `{ id, name, die }`. Nothing here touches Foundry and nothing mutates its input.
 */
import { LEVERAGE } from "../config.mjs";
import { isValidDie, stepDown, stepUp } from "../dice/die.mjs";

/** The two lists (also the names of their world settings) and the die a new entry starts with. */
export const TABLE_LISTS = Object.freeze({ globalTraits: LEVERAGE.defaultDie, complications: LEVERAGE.complicationDie });

/**
 * Keeps the valid entries of a die list (an id and a legal die), with a string name and a numeric die.
 * @param {*} list
 * @returns {{id: string, name: string, die: number}[]}
 */
export function cleanEntries(list) {
  return (Array.isArray(list) ? list : [])
    .filter((e) => e && e.id && isValidDie(Number(e.die)))
    .map((e) => ({ ...e, name: String(e.name ?? ""), die: Number(e.die) }));
}

/**
 * Adds an entry at the end.
 * @param {object[]} list
 * @param {string} name Empty names are ignored.
 * @param {number} die Starting die.
 * @param {() => string} newId
 * @returns {{id: string, name: string, die: number}[]} a new list
 */
export function addToList(list, name, die, newId) {
  const base = cleanEntries(list);
  const label = String(name ?? "").trim();
  return label && isValidDie(die) ? [...base, { id: newId(), name: label, die }] : base;
}

/**
 * @param {object[]} list
 * @param {string} id
 * @returns {{id: string, name: string, die: number}[]} the list without that entry
 */
export const removeFromList = (list, id) => cleanEntries(list).filter((e) => e.id !== id);

/**
 * Sets the die of an entry; an illegal die changes nothing.
 * @param {object[]} list
 * @param {string} id
 * @param {number} die
 * @returns {{id: string, name: string, die: number}[]}
 */
export function setDieInList(list, id, die) {
  const base = cleanEntries(list);
  return isValidDie(Number(die)) ? base.map((e) => (e.id === id ? { ...e, die: Number(die) } : e)) : base;
}

/**
 * Moves an entry's die one step. A d12 stays a d12 going up and a d4 stays a d4 going down.
 * @param {object[]} list
 * @param {string} id
 * @param {number} direction positive raises, negative lowers
 * @returns {{id: string, name: string, die: number}[]}
 */
export function stepInList(list, id, direction) {
  const next = (die) => (direction > 0 ? stepUp(die) : (stepDown(die) ?? die));
  return cleanEntries(list).map((e) => (e.id === id ? { ...e, die: next(e.die) } : e));
}

/**
 * Appends the entries of `extra` whose id is not in `base` yet (so a migration can run twice).
 * @param {object[]} base
 * @param {object[]} extra
 * @returns {{id: string, name: string, die: number}[]}
 */
export function mergeLists(base, extra) {
  const kept = cleanEntries(base);
  const known = new Set(kept.map((e) => e.id));
  return [...kept, ...cleanEntries(extra).filter((e) => !known.has(e.id))];
}

/**
 * Migration 0.1.1: the Job no longer carries Complications or scene Traits. Moves them to the table lists.
 * @param {{activeJob?: object, globalTraits?: object[], complications?: object[]}} state current setting values
 * @returns {{changed: boolean, activeJob: object, globalTraits: object[], complications: object[]}} `changed` is false when the Job holds no entry
 */
export function migrateTableState({ activeJob, globalTraits, complications }) {
  const { complications: oldComplications, sceneTraits: oldTraits, ...job } = activeJob ?? {};
  const changed = Boolean(oldComplications?.length || oldTraits?.length);
  return {
    changed,
    activeJob: job,
    globalTraits: mergeLists(globalTraits, oldTraits),
    complications: mergeLists(complications, oldComplications)
  };
}
