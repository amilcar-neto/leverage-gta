/**
 * Pool roll handler (docs/08 "Ao rolar"). Listens to `leverage.rollRequested`, evaluates the dice with Foundry's
 * `Roll` (one Die term per die, so Dice So Nice and the roll history see every die), applies the Pool rules and posts
 * the chat message. The pure half (formula, flags, side effects to apply) has no Foundry dependency and is unit tested
 * with an injected rng; the Foundry half is at the bottom and only touches globals inside functions.
 */
import { SYSTEM_ID } from "../config.mjs";
import { logger } from "../logger.mjs";
import { evaluatePool, rollPool } from "./pool-roll.mjs";
import { afterMoneyRoll } from "../rules/money.mjs";
import { ROLL_REQUESTED_HOOK, poolOf, syncRows } from "../applications/actor/parts/tray.mjs";

/**
 * Pool entries that carry a die (blank Traits are skipped), in Pool order.
 * @param {import("./pool.mjs").PoolEntry[]} entries
 * @returns {import("./pool.mjs").PoolEntry[]}
 */
export function rollableEntries(entries) {
  return entries.filter((e) => !e.blank && e.die);
}

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

/**
 * Builds the roll data stored in `flags.leverage-gta.roll` (docs/05).
 * @param {object} input
 * @param {{ref: string, label: string, kind: string, die: number, hinders?: boolean}[]} input.entries Rollable entries, Pool order.
 * @param {number[]} input.values Face rolled by each entry.
 * @param {string} [input.actorUuid]
 * @param {string} [input.actorName]
 * @param {string} [input.actorImg]
 * @param {string} [input.flavor]
 * @returns {object}
 */
export function buildRollData({ entries, values, actorUuid = "", actorName = "", actorImg = "", flavor = "" }) {
  const results = entries.map((e, index) => ({ index, size: e.die, value: values[index] }));
  const outcome = evaluatePool(results);
  const kept = new Set(outcome.kept);
  return {
    actorUuid, actorName, actorImg, flavor,
    entries: entries.map((e, index) => ({
      ref: e.ref, label: e.label, kind: e.kind, faces: e.die, result: values[index],
      kept: kept.has(index), one: values[index] === 1
    })),
    keptCount: outcome.kept.length,
    total: outcome.total,
    ppSpent: 0,
    distinctionPP: entries.some((e) => e.kind === "distinction" && e.hinders) ? 1 : 0,
    complicationsResolved: [],
    money: entries.some((e) => e.kind === "money")
  };
}

/**
 * What a roll changes on the character, derived from the roll data.
 * @param {object} data Result of `buildRollData`.
 * @param {number} moneySteps Current Money steps of the actor.
 * @returns {{plotPoints: number, moneySteps: number|null}} `moneySteps` is the new value, or null when untouched.
 */
export function rollEffects(data, moneySteps) {
  return {
    plotPoints: data.distinctionPP,
    moneySteps: data.money ? afterMoneyRoll(moneySteps) : null
  };
}

/* ------------------------------------------------------------ Foundry half */

/** Actors with a roll in flight (a double click must not roll twice). */
const rolling = new Set();

/** Display name of a Pool entry. */
function labelOf(entry) {
  return entry.nameKey ? game.i18n.localize(entry.nameKey) : entry.name;
}

/** Evaluates the dice with Foundry's `Roll`; returns the evaluated roll and the face of each die. */
async function evaluateDice(sizes) {
  const roll = await new Roll(poolFormula(sizes)).evaluate();
  return { roll, values: roll.dice.map((term) => term.results[0].result) };
}

/** Applies Plot Point and Money changes. */
async function applyEffects(actor, data) {
  const effects = rollEffects(data, actor.system.money?.steps ?? 0);
  if (effects.plotPoints) await actor.addPlotPoints(effects.plotPoints);
  if (effects.moneySteps !== null) await actor.money.set(effects.moneySteps);
}

/** Empties the sheet's Pool unless the client setting keeps it. */
async function clearPoolAfterRoll(sheet) {
  if (!sheet || game.settings.get(SYSTEM_ID, "pool.keepAfterRoll")) return;
  poolOf(sheet).clear();
  if (sheet.element) syncRows(sheet.element, poolOf(sheet));
  await sheet.render({ parts: ["tray"] });
}

/**
 * Rolls a Pool for an actor and posts the card.
 * @param {object} request
 * @param {Actor} request.actor
 * @param {ApplicationV2} [request.sheet] Sheet whose Pool is cleared afterwards.
 * @param {import("./pool.mjs").PoolEntry[]} request.entries
 * @param {string} [request.flavor] Action description shown on the card.
 * @returns {Promise<ChatMessage|null>}
 */
export async function rollPoolFor({ actor, sheet, entries, flavor }) {
  const rollable = rollableEntries(entries).map((e) => ({ ...e, label: labelOf(e) }));
  if (!rollable.length || rolling.has(actor.id)) return null;
  rolling.add(actor.id);
  try {
    const { roll, values } = await evaluateDice(rollable.map((e) => e.die));
    const data = buildRollData({
      entries: rollable, values, actorUuid: actor.uuid, actorName: actor.name, actorImg: actor.img,
      flavor: flavor ?? game.i18n.localize("LEVERAGE.Roll.defaultFlavor")
    });
    await applyEffects(actor, data);
    const message = await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }), flavor: data.flavor, flags: { [SYSTEM_ID]: { roll: data } }
    });
    await clearPoolAfterRoll(sheet);
    return message;
  } finally {
    rolling.delete(actor.id);
  }
}

/** Hook listener. */
function onRollRequested({ actor, sheet, entries, flavor }) {
  rollPoolFor({ actor, sheet, entries, flavor }).catch((err) => logger.error("Pool roll failed", err));
}

/** Registers the roll listener (call once, from `init`). */
export function registerRollHandler() {
  Hooks.on(ROLL_REQUESTED_HOOK, onRollRequested);
}
