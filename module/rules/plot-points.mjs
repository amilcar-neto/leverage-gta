/**
 * Plot Point counters (docs/02, docs/07). Pure logic.
 */

/**
 * The table counter ("Mesa") after a step: a whole number, never below 0, with no upper limit.
 * @param {number} value Current value (unusable values count as 0).
 * @param {number} [delta=0] Step, e.g. 1 or -1.
 * @returns {number}
 */
export function clampTablePoints(value, delta = 0) {
  const base = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;
  const step = Number.isFinite(Number(delta)) ? Math.trunc(Number(delta)) : 0;
  return Math.max(0, base + step);
}
