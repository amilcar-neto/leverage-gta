/**
 * Readers of the world configuration (the settings the rules depend on), with their fallbacks: the city scales, the
 * price list, the Training Up costs and the wanted state. Imports no application classes, so rules, documents and
 * chat code can use it and node tests can load it (with the Foundry field stub).
 */
import { LEVERAGE, SYSTEM_ID } from "./config.mjs";
import { readSetting } from "./data/fields.mjs";
import { resolveCityScales, resolvePrices, resolveTrainingCosts } from "./rules/config-data.mjs";
import { clampTablePoints } from "./rules/plot-points.mjs";
import { clampStars } from "./rules/stars.mjs";

/**
 * City scales from the `cityScales` setting; unusable data falls back to the defaults (docs/02).
 * @returns {object[]} fresh normalized copies (safe to mutate)
 */
export function getCityScales() {
  return resolveCityScales(readSetting("cityScales", null));
}

/**
 * Price list in dice from the `prices` setting; missing or invalid items fall back to the defaults.
 * @returns {{id: string, label: string, dice: number[]}[]}
 */
export function getPrices() {
  return resolvePrices(readSetting("prices", null));
}

/**
 * Price of a price-list id in dice (empty when the id is unknown).
 * @param {string} id e.g. `hospital`, `bail`, `vestLight`
 * @returns {number[]}
 */
export function getPriceDice(id) {
  return getPrices().find((p) => p.id === id)?.dice ?? [];
}

/**
 * Training Up cost in Jobs per option from the `trainingCosts` setting, with fallback to the defaults.
 * @returns {Record<string, number>}
 */
export function getTrainingCosts() {
  return resolveTrainingCosts(readSetting("trainingCosts", null));
}

/**
 * The wanted state (`wanted` setting) with defaults: the city id and the level, clamped to 0..5.
 * @returns {{city: string, level: number}}
 */
export function readWanted() {
  const wanted = readSetting("wanted", {});
  return { city: wanted.city || LEVERAGE.stars.defaultCity, level: clampStars(wanted.level ?? 0) };
}

/**
 * The Fixer's table Plot Point counter ("Mesa", `tablePlotPoints` world setting): a marker, not a pool with a limit.
 * @returns {number} whole number, 0 or more
 */
export function readTablePlotPoints() {
  return clampTablePoints(readSetting("tablePlotPoints", 0));
}

/** Tail of the queued table counter writes, so quick clicks each apply their own step. */
let tableWrites = Promise.resolve();

/**
 * Steps the table Plot Point counter (Fixer only; the setting is world scoped). Never below 0. Writes are queued: each
 * step reads the value the previous one saved.
 * @param {number} delta e.g. 1 or -1
 * @returns {Promise<number>} the new value (the current one when the user is not the Fixer)
 */
export function stepTablePlotPoints(delta) {
  if (!game.user.isGM) return Promise.resolve(readTablePlotPoints());
  const run = async () => {
    const value = clampTablePoints(readTablePlotPoints(), delta);
    await game.settings.set(SYSTEM_ID, "tablePlotPoints", value);
    return value;
  };
  const result = tableWrites.then(run, run);
  tableWrites = result.catch(() => {});
  return result;
}
