/**
 * Die-size helpers. Pure logic, no Foundry dependency (importable in node).
 * Sizes come from `LEVERAGE.dice` (d4..d12); there is no d20.
 */
import { LEVERAGE } from "../config.mjs";

/**
 * @param {*} size
 * @returns {boolean} true when `size` is one of the allowed die sizes.
 */
export function isValidDie(size) {
  return LEVERAGE.dice.includes(size);
}

/**
 * Throws a RangeError when `size` is not an allowed die size.
 * @param {*} size
 * @returns {number} the same size, for chaining.
 */
export function assertDie(size) {
  if (!isValidDie(size)) throw new RangeError(`Invalid die size: ${size}`);
  return size;
}

/**
 * Steps a die up one size. A d12 stays a d12 (cannot go higher).
 * @param {number} size
 * @returns {number}
 */
export function stepUp(size) {
  const i = LEVERAGE.dice.indexOf(assertDie(size));
  return LEVERAGE.dice[Math.min(i + 1, LEVERAGE.dice.length - 1)];
}

/**
 * Steps a die down one size. A d4 steps down to nothing (`null`, the die is eliminated).
 * @param {number} size
 * @returns {number|null}
 */
export function stepDown(size) {
  const i = LEVERAGE.dice.indexOf(assertDie(size));
  return i === 0 ? null : LEVERAGE.dice[i - 1];
}

/**
 * Largest valid die size in a list, or null for an empty list.
 * @param {number[]} sizes
 * @returns {number|null}
 */
export function largestDie(sizes) {
  return sizes.length ? Math.max(...sizes.map(assertDie)) : null;
}
