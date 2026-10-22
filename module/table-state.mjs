/**
 * The table state the Fixer keeps for everybody (docs/09): Traits that count in any scene (`globalTraits`) and the
 * Job's Complications (`complications`). Two hidden world settings of `{id, name, die}` lists; this is the only place
 * that reads or writes them. Every change fires `LEVERAGE.hooks.tableStateChanged` through the settings' `onChange`.
 * Only the Fixer writes (a player's call does nothing). Writes are queued, so quick clicks each apply their own step.
 */
import { SYSTEM_ID } from "./config.mjs";
import { readSetting } from "./data/fields.mjs";
import { TABLE_LISTS, addToList, cleanEntries, removeFromList, setDieInList, stepInList } from "./rules/table-entries.mjs";

/** @returns {{id: string, name: string, die: number}[]} the Traits that count in any scene */
export const readGlobalTraits = () => cleanEntries(readSetting("globalTraits", []));

/** @returns {{id: string, name: string, die: number}[]} the Complications of the Job */
export const readComplications = () => cleanEntries(readSetting("complications", []));

/** Reader of each table list by setting key. */
const READERS = Object.freeze({ globalTraits: readGlobalTraits, complications: readComplications });

/** Tail of the queued writes. */
let writes = Promise.resolve();

/**
 * Runs `edit` on the current list and saves the result when it changed (Fixer only), after the earlier writes.
 * @param {"globalTraits"|"complications"} key
 * @param {(list: object[]) => object[]} edit
 * @returns {Promise<boolean>} true when something was saved
 */
export function editTableList(key, edit) {
  if (!(key in TABLE_LISTS) || !game.user.isGM) return Promise.resolve(false);
  const run = async () => {
    const before = READERS[key]();
    const next = cleanEntries(edit(before));
    if (JSON.stringify(next) === JSON.stringify(before)) return false;
    await game.settings.set(SYSTEM_ID, key, next);
    return true;
  };
  const result = writes.then(run, run);
  writes = result.catch(() => {});
  return result;
}

/**
 * Adds a Trait or a Complication (both start at d6) at the end.
 * @param {"globalTraits"|"complications"} key
 * @param {string} name Empty names are ignored.
 * @returns {Promise<boolean>}
 */
export const addTableEntry = (key, name) =>
  editTableList(key, (list) => addToList(list, name, TABLE_LISTS[key], () => foundry.utils.randomID()));

/** @returns {Promise<boolean>} Removes an entry by id. */
export const removeTableEntry = (key, id) => editTableList(key, (list) => removeFromList(list, id));

/** @returns {Promise<boolean>} Sets the die of an entry. */
export const setTableEntryDie = (key, id, die) => editTableList(key, (list) => setDieInList(list, id, die));

/** @returns {Promise<boolean>} Raises (direction above 0) or lowers the die of an entry one step. */
export const stepTableEntry = (key, id, direction) => editTableList(key, (list) => stepInList(list, id, direction));

/** End of scene: no Traits are left over for the next one. @returns {Promise<boolean>} */
export const clearGlobalTraits = () => editTableList("globalTraits", () => []);

/** End of the Job: its Complications are gone. @returns {Promise<boolean>} */
export const clearComplications = () => editTableList("complications", () => []);
