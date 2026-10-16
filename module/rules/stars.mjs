/**
 * Wanted stars (docs/02): 0..5 per city, police Pool per level, how stars go down. Pure logic.
 */
import { LEVERAGE } from "../config.mjs";

/** Heat removed by each money die spent on silence (docs/02). */
const STARS_PER_SILENCE_DIE = 2;

/**
 * Waiting/disguise rules (not stored on the scale; silence and bail are). Cities without an entry
 * behave like Liberty City.
 */
const LOWERING = Object.freeze({
  carcer: { waitScenes: 1, disguise: "clear" },
  venturas: { waitScenes: 2, disguise: 1, disguiseBoth: 2 },
  liberty: { waitScenes: null, disguise: 1 }
});

/** Lowering rule for a city id (falls back to Liberty City). */
function loweringFor(cityId) {
  return LOWERING[cityId] ?? LOWERING.liberty;
}

/**
 * Clamps to an integer in the star range.
 * @param {number} n
 * @returns {number}
 */
export function clampStars(n) {
  const v = Math.trunc(Number(n));
  if (!Number.isFinite(v)) return LEVERAGE.stars.min;
  return Math.min(LEVERAGE.stars.max, Math.max(LEVERAGE.stars.min, v));
}

/**
 * @param {number} stars
 * @param {number} [by=1]
 * @returns {number} stars after raising (capped at max).
 */
export function raiseStars(stars, by = 1) {
  return clampStars(clampStars(stars) + Math.max(0, by));
}

/**
 * @param {number} stars
 * @param {number} [by=1]
 * @returns {number} stars after lowering (floor at min).
 */
export function lowerStars(stars, by = 1) {
  return clampStars(clampStars(stars) - Math.max(0, by));
}

/**
 * Finds a city scale by id; unknown ids fall back to the default city.
 * @param {string} cityId
 * @param {object[]} [scales] defaults to `LEVERAGE.defaultCityScales` (settings may override).
 * @returns {{id: string, name: string, levels: number[][]}}
 */
export function getCityScale(cityId, scales = LEVERAGE.defaultCityScales) {
  return scales.find((c) => c.id === cityId)
    ?? scales.find((c) => c.id === LEVERAGE.stars.defaultCity)
    ?? scales[0];
}

/**
 * Police Pool (die sizes) for the current star level. 0 stars -> [] (no police pressure).
 * @param {string} cityId
 * @param {number} stars
 * @param {object[]} [scales]
 * @returns {number[]}
 */
export function policePool(cityId, stars, scales) {
  const s = clampStars(stars);
  if (s === 0) return [];
  return [...getCityScale(cityId, scales).levels[s - 1]];
}

/**
 * The main (largest) die shown on a star of the HUD, or null for 0 stars.
 * @param {string} cityId
 * @param {number} stars
 * @param {object[]} [scales]
 * @returns {number|null}
 */
export function mainDie(cityId, stars, scales) {
  const pool = policePool(cityId, stars, scales);
  return pool.length ? Math.max(...pool) : null;
}

/**
 * Stars after waiting out of sight. Carcer: -1 per scene; Las Venturas: -1 per 2 scenes;
 * Liberty City: only between sessions (-1).
 * @param {string} cityId
 * @param {number} stars
 * @param {{scenes?: number, betweenSessions?: boolean}} [wait]
 * @returns {number}
 */
export function starsAfterWaiting(cityId, stars, { scenes = 0, betweenSessions = false } = {}) {
  const rule = loweringFor(cityId);
  if (rule.waitScenes === null) return lowerStars(stars, betweenSessions ? 1 : 0);
  return lowerStars(stars, Math.floor(Math.max(0, scenes) / rule.waitScenes));
}

/**
 * Stars after a successful disguise roll. Carcer clears; Las Venturas -1 (-2 changing car and clothes);
 * Liberty -1, and only if nobody has a composite sketch (`sketched` true -> no change).
 * @param {string} cityId
 * @param {number} stars
 * @param {{carAndClothes?: boolean, sketched?: boolean}} [opts]
 * @returns {number}
 */
export function starsAfterDisguise(cityId, stars, { carAndClothes = false, sketched = false } = {}) {
  const rule = loweringFor(cityId);
  if (rule.disguise === "clear") return LEVERAGE.stars.min;
  if (cityId === "venturas") return lowerStars(stars, carAndClothes ? rule.disguiseBoth : rule.disguise);
  return sketched ? clampStars(stars) : lowerStars(stars, rule.disguise);
}

/**
 * Buying silence, read from the city scale's `silence` field (absent or null = not available).
 * Each money die of one of the listed sizes removes `stars` stars.
 * @param {string} cityId
 * @param {object[]} [scales]
 * @returns {{stars: number, dice: number[]}|null}
 */
export function bribeRule(cityId, scales) {
  const dice = getCityScale(cityId, scales).silence;
  return Array.isArray(dice) && dice.length ? { stars: STARS_PER_SILENCE_DIE, dice: [...dice] } : null;
}

/**
 * Whether Busted can be settled with bail in this city (scale's `bail` field; absent = no).
 * @param {string} cityId
 * @param {object[]} [scales]
 * @returns {boolean}
 */
export function bailAllowed(cityId, scales) {
  return getCityScale(cityId, scales).bail === true;
}
