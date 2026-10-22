/**
 * Pure logic of the scene strip (a compact public band under the Foundry scene navigation): the global Traits and
 * Complications the Fixer keeps for the table, and the Traits of the Locations of the viewed Scene. No Foundry
 * globals, so node tests can load it.
 */
import { isValidDie } from "../../dice/die.mjs";

/** @returns {{id: string, name: string, die: number}[]} the valid entries of a die list. */
function cleanList(list) {
  return (Array.isArray(list) ? list : [])
    .filter((e) => e && isValidDie(Number(e.die)))
    .map((e) => ({ id: String(e.id ?? e.name), name: String(e.name ?? "").trim(), die: Number(e.die) }));
}

/**
 * Everything the strip draws. A global Trait has `place: ""` (the Fixer edits it in the strip); a Trait of a Location
 * carries the Location's name in `place` (read only here: it is edited on the Location sheet).
 * @param {object} input
 * @param {object} input.job active Job `{name, goal}` (only the goal is used).
 * @param {object[]} input.globalTraits Traits that count in any scene.
 * @param {object[]} input.placeTraits Traits of the Locations of the viewed Scene (`{id, name, die, place}`).
 * @param {object[]} input.complications Complications of the table.
 * @returns {{goal: string, traits: object[], complications: object[], counts: {traits: number, complications: number}, empty: boolean}}
 */
export function buildScenePanel({ job, globalTraits, placeTraits, complications }) {
  const global = cleanList(globalTraits).map((e) => ({ ...e, place: "" }));
  const place = (Array.isArray(placeTraits) ? placeTraits : [])
    .filter((e) => e && isValidDie(Number(e.die)))
    .map((e) => ({ ...cleanList([e])[0], place: String(e.place ?? "").trim() }));
  const traits = [...global, ...place];
  const list = cleanList(complications);
  const counts = { traits: traits.length, complications: list.length };
  const goal = String(job?.goal ?? "").trim();
  return { goal, traits, complications: list, counts, empty: !(goal || counts.traits || counts.complications) };
}

/**
 * Marks the entry being edited and gives it the die choices of the picker.
 * @param {{id: string, die: number}[]} entries
 * @param {string|null} editingId id of the entry whose die picker is open
 * @param {number[]} dice every legal die size
 * @returns {object[]} entries with `editing` and, for the open one, `choices: [{die, label, pressed}]`
 */
export function withDiePicker(entries, editingId, dice) {
  return entries.map((e) => (e.id === editingId
    ? { ...e, editing: true, choices: dice.map((die) => ({ die, label: `d${die}`, pressed: die === e.die })) }
    : { ...e, editing: false }));
}

/** Prefix of the `ref` of a Complication die in the Fixer's opposition roll (see `complicationSources`). */
const COMPLICATION_REF = "job.";

/**
 * Where a Pool die comes from on the scene, for the roll card: a Scene Trait (`scene`) or a Complication
 * (`complication`, a die of the table added to the Fixer's opposition).
 * @param {{kind?: string, ref?: string}} entry Roll entry (docs/05).
 * @returns {"scene"|"complication"|null}
 */
export function sceneTagOf(entry) {
  if (entry?.kind === "scene") return "scene";
  return String(entry?.ref ?? "").startsWith(COMPLICATION_REF) ? "complication" : null;
}
