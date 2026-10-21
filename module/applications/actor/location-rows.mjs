/** Pure helpers of the Location sheet (no Foundry globals; unit tested). */
import { LEVERAGE } from "../../config.mjs";

/**
 * Moves one entry of a list to another index (pure).
 * @param {any[]} list
 * @param {number} from
 * @param {number} to
 * @returns {any[]} a new list; the same content when an index is out of range
 */
export function moveEntry(list, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from === to) return [...list];
  if (from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

/**
 * The Trait rows of the template: each with its ladder of dice (the unselected ones are muted).
 * @param {{name: string, die: number}[]} traits
 * @returns {{index: number, name: string, die: number, ladder: {die: number, selected: boolean, muted: boolean, label: string}[]}[]}
 */
export function traitRows(traits) {
  return (traits ?? []).map((t, index) => ({
    index, name: t.name, die: t.die,
    ladder: LEVERAGE.dice.map((die) => ({ die, selected: die === t.die, muted: die !== t.die, label: `d${die}` }))
  }));
}

/**
 * Class suffix that steps the Location name down for long names (the header has room for about 14 big letters).
 * @param {string} name
 * @returns {string} `""`, `" is-long"` or `" is-longer"` (leading space, ready to append to a class list)
 */
export function nameSizeClass(name) {
  const length = String(name ?? "").length;
  if (length > 24) return " is-longer";
  return length > 14 ? " is-long" : "";
}
