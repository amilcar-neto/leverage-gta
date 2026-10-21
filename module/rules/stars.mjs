/**
 * Wanted stars (docs/02): 0..5 per city, police Pool per level, how stars go down. Pure logic.
 */
import { LEVERAGE } from "../config.mjs";

/** Source of the city scales used when a caller passes none. settings.mjs plugs in `getCityScales`. */
let scalesProvider = () => LEVERAGE.defaultCityScales;

/**
 * Sets where the rules read the city scales from (the world setting, with fallback to the defaults).
 * @param {() => object[]} provider
 */
export function setScalesProvider(provider) {
  scalesProvider = typeof provider === "function" ? provider : () => LEVERAGE.defaultCityScales;
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
 * `[12, 6]` -> `d12 + d6`: how a Pool (or a price) of dice is written in the UI and in chat.
 * @param {number[]} dice
 * @returns {string}
 */
export const poolText = (dice) => dice.map((d) => `d${d}`).join(" + ");

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
 * @param {object[]} [scales] defaults to the configured scales (see `setScalesProvider`).
 * @returns {{id: string, name: string, levels: number[][], silence?: number[]|null, bail?: boolean,
 *   wait?: number|null, disguise?: number|"clear", disguiseBoth?: number|null, starsPerSilenceDie?: number,
 *   sketchBlocksDisguise?: boolean}} the scale object itself (not a copy).
 */
export function getCityScale(cityId, scales = scalesProvider()) {
  return scales.find((c) => c.id === cityId)
    ?? scales.find((c) => c.default)
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
 * Stars after waiting out of sight, from the scale's `wait` (scenes per star; null = only between sessions, -1).
 * @param {string} cityId
 * @param {number} stars
 * @param {{scenes?: number, betweenSessions?: boolean}} [wait]
 * @param {object[]} [scales]
 * @returns {number}
 */
export function starsAfterWaiting(cityId, stars, { scenes = 0, betweenSessions = false } = {}, scales) {
  const perStar = getCityScale(cityId, scales).wait;
  if (!perStar) return lowerStars(stars, betweenSessions ? 1 : 0);
  return lowerStars(stars, Math.floor(Math.max(0, scenes) / perStar));
}

/**
 * Stars after a successful disguise roll, from the scale: `disguise` ("clear" or a number), `disguiseBoth`
 * (changing car and clothes) and `sketchBlocksDisguise` (a composite sketch -> no change).
 * @param {string} cityId
 * @param {number} stars
 * @param {{carAndClothes?: boolean, sketched?: boolean}} [opts]
 * @param {object[]} [scales]
 * @returns {number}
 */
export function starsAfterDisguise(cityId, stars, { carAndClothes = false, sketched = false } = {}, scales) {
  const scale = getCityScale(cityId, scales);
  const { disguise = 1, disguiseBoth = null } = scale;
  if (disguise === "clear") return LEVERAGE.stars.min;
  if (sketched && scale.sketchBlocksDisguise) return clampStars(stars);
  return lowerStars(stars, carAndClothes && disguiseBoth != null ? disguiseBoth : disguise);
}

/**
 * Buying silence, read from the city scale's `silence` field (absent or null = not available).
 * Each money die of one of the listed sizes removes `stars` stars.
 * @param {string} cityId
 * @param {object[]} [scales]
 * @returns {{stars: number, dice: number[]}|null}
 */
export function bribeRule(cityId, scales) {
  const scale = getCityScale(cityId, scales);
  const dice = scale.silence;
  return Array.isArray(dice) && dice.length ? { stars: scale.starsPerSilenceDie ?? LEVERAGE.stars.starsPerSilenceDie, dice: [...dice] } : null;
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

/** Ways out of the "last resort" (docs/02 "Como baixar estrelas"). */
export const LAST_RESORT_KINDS = Object.freeze(["any", "disguiseAndSilence", "scapegoat"]);

/**
 * What the last resort asks for in a city, read from its scale (docs/02): where a disguise clears the stars, any way
 * out is enough (`any`); where silence can be bought, a disguise and silence together (`disguiseAndSilence`); where
 * silence does not work, a scapegoat handed over in a mini-heist (`scapegoat`).
 * @param {string} cityId
 * @param {object[]} [scales]
 * @returns {"any"|"disguiseAndSilence"|"scapegoat"}
 */
export function lastResortKind(cityId, scales) {
  if (getCityScale(cityId, scales).disguise === "clear") return "any";
  return bribeRule(cityId, scales) ? "disguiseAndSilence" : "scapegoat";
}
