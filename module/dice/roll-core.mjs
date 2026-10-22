/**
 * Shared core of every roll that posts a card (Pool rolls of the players, opposition rolls of the Fixer): the formula
 * (one Die term per die), the rng-injectable rolling, the roll data stored in `flags.leverage-gta.roll` (docs/05)
 * and the Foundry evaluation. The pure functions have no Foundry dependency; `evaluateDice` touches `Roll` only
 * when called.
 */
import { LEVERAGE } from "../config.mjs";
import { evaluatePool, rollPool } from "./pool-roll.mjs";
import { classify } from "./prime-math.mjs";
import { appearanceFor } from "./dsn.mjs";
import { afterMoneyRoll, clampSteps } from "../rules/money.mjs";

/**
 * Roll formula with one Die term per die: `1d10 + 1d10 + 1d6`.
 * @param {number[]} sizes
 * @returns {string}
 */
export function poolFormula(sizes) {
  return sizes.map((size) => `1d${size}`).join(" + ");
}

/**
 * Rolls dice with an injectable rng (tests, macros). Returns the face of each die, in order.
 * @param {number[]} sizes
 * @param {() => number} [rng]
 * @returns {number[]}
 */
export function rollValues(sizes, rng = Math.random) {
  return rollPool(sizes, rng).map((r) => r.value);
}

/** Version of the roll data written by `buildRollData` (docs/05). */
export const ROLL_DATA_VERSION = 2;

/**
 * Builds the roll data stored in `flags.leverage-gta.roll` (docs/05, v2).
 * `mode: "classic"` resolves at once (two highest kept, no effect die). `mode: "prime"` makes a pending card: no
 * kept dice, no total and no effect die until the player chooses and confirms (`status: "resolved"`).
 * @param {object} input
 * @param {{ref: string, label: string, kind: string, die: number, hinders?: boolean}[]} input.entries Rollable entries, Pool order.
 * @param {number[]} input.values Face rolled by each entry.
 * @param {string} [input.actorUuid]
 * @param {string} [input.actorName]
 * @param {string} [input.actorImg]
 * @param {string} [input.flavor]
 * @param {"classic"|"prime"} [input.mode] Roll mode (setting `rules.rollMode`); defaults to `classic`.
 * @param {number} [input.ppAtRoll] Plot Points the character had when rolling (prime: the window may spend at most this many).
 * @returns {object}
 */
export function buildRollData({ entries, values, actorUuid = "", actorName = "", actorImg = "", flavor = "", mode = "classic", ppAtRoll = 0 }) {
  const prime = mode === "prime";
  const results = entries.map((e, index) => ({ index, size: e.die, value: values[index] }));
  const outcome = evaluatePool(results);
  const kept = new Set(prime ? [] : outcome.kept);
  const rows = entries.map((e, index) => ({
    ref: e.ref, label: e.label, kind: e.kind, faces: e.die, result: values[index],
    kept: kept.has(index), one: values[index] === 1, effect: false, paid: false
  }));
  const { hitches, botch } = classify(rows);
  return {
    v: ROLL_DATA_VERSION,
    status: prime ? "pending" : "resolved",
    mode,
    ppAtRoll: prime ? ppAtRoll : 0,
    actorUuid, actorName, actorImg, flavor,
    entries: rows,
    keptCount: kept.size,
    total: prime ? null : outcome.total,
    effectDie: null,
    selection: prime ? null : { total: [...outcome.kept], effect: [] },
    hitches: hitches.length,
    botch,
    ppSpent: 0,
    distinctionPP: entries.some((e) => e.kind === "distinction" && e.hinders) ? 1 : 0,
    complicationsResolved: [],
    money: entries.some((e) => e.kind === "money")
  };
}

/**
 * Reads roll data of any version as v2 (never mutates). Cards made before Cortex Prime (no `v`) are `v: 1`,
 * resolved, with no effect die and hitches counted from the 1s; a v2 card is returned unchanged.
 * @param {object|null} data `flags.leverage-gta.roll`
 * @returns {object|null}
 */
export function normalizeRoll(data) {
  if (!data || (data.v ?? 1) >= ROLL_DATA_VERSION) return data ?? null;
  const entries = (data.entries ?? []).map((e) => ({ ...e, effect: e.effect ?? false, paid: e.paid ?? false }));
  const { hitches, botch } = classify(entries);
  return {
    ...data,
    v: 1,
    status: data.status ?? "resolved",
    entries,
    effectDie: data.effectDie ?? null,
    selection: data.selection ?? { total: entries.flatMap((e, i) => (e.kept ? [i] : [])), effect: [] },
    hitches: data.hitches ?? hitches.length,
    botch: data.botch ?? botch
  };
}

/** True when the roll mode setting value is known (`LEVERAGE.rollModes`). */
export const isRollMode = (mode) => LEVERAGE.rollModes.includes(mode);

/**
 * Evaluates the dice with Foundry's `Roll` (one Die term per die, so Dice So Nice and the history see every die).
 * Each term gets its Dice So Nice colorset (`options.appearance`; harmless without the module).
 * @param {number[]} sizes
 * @param {string[]} [kinds] Pool entry kind of each die ("money" gets the Money color).
 * @returns {Promise<{roll: Roll, values: number[]}>} the evaluated roll and the face of each die
 */
export async function evaluateDice(sizes, kinds = []) {
  const roll = await new Roll(poolFormula(sizes)).evaluate();
  roll.dice.forEach((term, i) => { term.options.appearance = appearanceFor(sizes[i], kinds[i]); });
  return { roll, values: roll.dice.map((term) => term.results[0].result) };
}

/**
 * What a roll changes on the character, derived from the roll data: the Plot Points gained (Distinction d4) minus the
 * ones spent on paid dice, and the new Money steps (a Money die rolled drops the wallet).
 * @param {object} data Roll data.
 * @param {number} moneySteps Current Money steps of the actor.
 * @returns {{plotPoints: number, moneySteps: number|null}} `moneySteps` is the new value, or null when untouched.
 */
export function rollEffects(data, moneySteps) {
  return {
    plotPoints: (data.distinctionPP ?? 0) - (data.ppSpent ?? 0),
    moneySteps: data.money ? afterMoneyRoll(moneySteps) : null
  };
}

/**
 * The single actor update that applies the effects of a roll (Plot Points never below 0, Money inside the ladder).
 * @param {{plotPoints: number, steps: number}} current Plot Points and Money steps of the actor now.
 * @param {{plotPoints: number, moneySteps: number|null}} effects From `rollEffects`.
 * @returns {object} update data (empty when nothing changes)
 */
export function effectsUpdate(current, effects) {
  const update = {};
  if (effects.plotPoints) update["system.plotPoints.value"] = Math.max(0, current.plotPoints + effects.plotPoints);
  if (effects.moneySteps !== null) update["system.money.steps"] = clampSteps(effects.moneySteps);
  return update;
}

/**
 * Applies the effects of a roll to its actor in one update (Foundry half). Plot Points only exist on Crew.
 * @param {Actor} actor
 * @param {object} data Roll data.
 * @returns {Promise<void>}
 */
export async function applyRollEffects(actor, data) {
  const steps = actor.system.money?.steps ?? 0;
  const effects = rollEffects(data, steps);
  const update = effectsUpdate({ plotPoints: actor.system.plotPoints?.value ?? 0, steps }, actor.type === "crew" ? effects : { ...effects, plotPoints: 0 });
  if (Object.keys(update).length) await actor.update(update);
}
