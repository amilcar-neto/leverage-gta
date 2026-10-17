/**
 * Validation and normalization of the GM-editable configuration (city scales, prices, training costs; docs/09).
 * Pure logic: no Foundry globals, so node tests can import it. Two flavours:
 * - `validate*` is strict and returns i18n-ready errors (used by the config apps before saving);
 * - `resolve*` is lenient and always returns usable data (used when reading the settings).
 */
import { LEVERAGE } from "../config.mjs";

/** Limits of the editors. */
export const CONFIG_LIMITS = Object.freeze({
  poolDice: 8, priceDice: 4, silenceStars: 5, trainingCost: 20, waitScenes: 20, stars: 5
});

const clone = (value) => structuredClone(value);
const isDie = (n) => LEVERAGE.dice.includes(n);

/** @returns {number|null} the whole number inside [min, max], or null. */
function wholeIn(value, min, max) {
  if (value === null || value === "" || value === undefined) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/**
 * Keeps valid die sizes only, largest first, at most `max` dice.
 * @param {*} list
 * @param {number} [max]
 * @returns {number[]}
 */
export function cleanDice(list, max = CONFIG_LIMITS.poolDice) {
  if (!Array.isArray(list)) return [];
  return list.map(Number).filter(isDie).sort((a, b) => b - a).slice(0, max);
}

/**
 * Adds one die to a list (ignored at the limit or for an invalid size).
 * @param {number[]} dice
 * @param {number} die
 * @param {number} [max]
 * @returns {number[]} a new list
 */
export function addDie(dice, die, max = CONFIG_LIMITS.poolDice) {
  const size = Number(die);
  return isDie(size) && dice.length < max ? cleanDice([...dice, size], max) : [...dice];
}

/**
 * Removes the die at an index.
 * @param {number[]} dice
 * @param {number} index
 * @returns {number[]} a new list
 */
export function removeDieAt(dice, index) {
  return dice.filter((_, i) => i !== Number(index));
}

/**
 * Stable id for a new city: a slug of the name, made unique among `taken`. Renaming never changes an id.
 * @param {string} name
 * @param {Iterable<string>} taken
 * @returns {string}
 */
export function makeCityId(name, taken) {
  const used = new Set(taken);
  const base = String(name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "city";
  let id = base;
  for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
  return id;
}

/* ---------------------------------------------------------------- city scales */

/** @returns {number[][]} exactly one (cleaned) dice list per star. */
function cleanLevels(levels) {
  return Array.from({ length: CONFIG_LIMITS.stars }, (_, i) => cleanDice(levels?.[i]));
}

/**
 * Normalizes one city scale to the full shape of `LEVERAGE.defaultCityScales` (bad fields get safe values).
 * @param {object} raw
 * @returns {object}
 */
export function normalizeScale(raw) {
  const silence = cleanDice(raw?.silence, LEVERAGE.dice.length);
  const disguise = raw?.disguise === "clear" ? "clear" : (wholeIn(raw?.disguise, 1, CONFIG_LIMITS.stars) ?? 1);
  const scale = {
    id: String(raw?.id ?? "").trim(),
    name: String(raw?.name ?? "").trim(),
    levels: cleanLevels(raw?.levels),
    silence: silence.length ? [...new Set(silence)] : null,
    bail: raw?.bail === true,
    wait: wholeIn(raw?.wait, 1, CONFIG_LIMITS.waitScenes),
    disguise,
    disguiseBoth: wholeIn(raw?.disguiseBoth, 1, CONFIG_LIMITS.stars),
    starsPerSilenceDie: wholeIn(raw?.starsPerSilenceDie, 1, CONFIG_LIMITS.silenceStars) ?? LEVERAGE.stars.starsPerSilenceDie,
    sketchBlocksDisguise: raw?.sketchBlocksDisguise === true
  };
  if (raw?.default === true) scale.default = true;
  return scale;
}

/** Gives every scale an id (unique) and makes exactly one the default city. */
function settleIdsAndDefault(scales) {
  const taken = [];
  const out = scales.map((scale) => {
    const id = scale.id && !taken.includes(scale.id) ? scale.id : makeCityId(scale.name, taken);
    taken.push(id);
    return { ...scale, id };
  });
  const flagged = out.find((s) => s.default) ?? out.find((s) => s.id === LEVERAGE.stars.defaultCity) ?? out[0];
  return out.map((scale) => {
    const rest = { ...scale };
    delete rest.default;
    return scale === flagged ? { ...rest, default: true } : rest;
  });
}

/**
 * Strict validation for saving. Errors are `{ key, data }` with `key` under `LEVERAGE.Config.Error`.
 * @param {object[]} list
 * @returns {{ok: boolean, scales: object[], errors: {key: string, data?: object}[]}}
 */
export function validateCityScales(list) {
  const scales = settleIdsAndDefault((Array.isArray(list) ? list : []).map(normalizeScale));
  const errors = [];
  if (!scales.length) errors.push({ key: "noCities" });
  for (const scale of scales) {
    if (!scale.name) errors.push({ key: "emptyName", data: { id: scale.id } });
    scale.levels.forEach((dice, i) => {
      if (!dice.length) errors.push({ key: "emptyPool", data: { city: scale.name || scale.id, n: i + 1 } });
    });
  }
  return { ok: !errors.length, scales, errors };
}

/**
 * Lenient read of the `cityScales` setting: unusable entries are dropped; nothing usable -> the defaults.
 * @param {*} stored
 * @returns {object[]}
 */
export function resolveCityScales(stored) {
  const usable = (Array.isArray(stored) ? stored : []).map(normalizeScale).filter((s) => s.id && s.name);
  return usable.length ? settleIdsAndDefault(usable) : clone(LEVERAGE.defaultCityScales);
}

/* --------------------------------------------------------------------- prices */

/**
 * Strict validation of the price list: every item needs 1..priceDice dice.
 * @param {object[]} list items `{id, label, dice}`
 * @returns {{ok: boolean, prices: object[], errors: {key: string, data?: object}[]}}
 */
export function validatePrices(list) {
  const prices = (Array.isArray(list) ? list : []).filter((p) => p && typeof p.id === "string")
    .map((p) => ({ id: p.id, label: String(p.label ?? p.id), dice: cleanDice(p.dice, CONFIG_LIMITS.priceDice) }));
  const errors = prices.filter((p) => !p.dice.length).map((p) => ({ key: "emptyPrice", data: { item: p.label } }));
  return { ok: !errors.length, prices, errors };
}

/**
 * Lenient read of the `prices` setting: every default item is present (its dice replaced by the stored ones when
 * valid); extra valid stored items are kept after them.
 * @param {*} stored
 * @returns {{id: string, label: string, dice: number[]}[]}
 */
export function resolvePrices(stored) {
  const list = Array.isArray(stored) ? stored : [];
  const byId = new Map(list.filter((p) => p && typeof p.id === "string").map((p) => [p.id, p]));
  const known = LEVERAGE.defaultPrices.map((base) => {
    const dice = cleanDice(byId.get(base.id)?.dice, CONFIG_LIMITS.priceDice);
    return { id: base.id, label: base.label, dice: dice.length ? dice : [...base.dice] };
  });
  const extras = list.filter((p) => p && typeof p.id === "string" && p.label && !LEVERAGE.defaultPrices.some((b) => b.id === p.id))
    .map((p) => ({ id: p.id, label: String(p.label), dice: cleanDice(p.dice, CONFIG_LIMITS.priceDice) }))
    .filter((p) => p.dice.length);
  return [...known, ...extras];
}

/* ------------------------------------------------------------- training costs */

/**
 * Strict validation of the Train Up costs (whole numbers 0..trainingCost).
 * @param {object} raw `{ key: value }` (values may be strings from a form)
 * @returns {{ok: boolean, costs: Record<string, number>, errors: {key: string, data?: object}[]}}
 */
export function validateTrainingCosts(raw) {
  const costs = {};
  const errors = [];
  for (const [key, base] of Object.entries(LEVERAGE.defaultTrainingCosts)) {
    const value = wholeIn(raw?.[key], 0, CONFIG_LIMITS.trainingCost);
    costs[key] = value ?? base;
    if (value === null) errors.push({ key: "invalidCost", data: { item: key, max: CONFIG_LIMITS.trainingCost } });
  }
  return { ok: !errors.length, costs, errors };
}

/**
 * Lenient read of the `trainingCosts` setting: bad values fall back to the default for that option.
 * @param {*} stored
 * @returns {Record<string, number>}
 */
export function resolveTrainingCosts(stored) {
  return Object.fromEntries(Object.entries(LEVERAGE.defaultTrainingCosts)
    .map(([key, base]) => [key, wholeIn(stored?.[key], 0, CONFIG_LIMITS.trainingCost) ?? base]));
}
