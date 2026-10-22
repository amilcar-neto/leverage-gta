/**
 * Pool roll handler (docs/08 "Ao rolar"). Listens to `leverage.rollRequested`, evaluates the dice with Foundry's
 * `Roll` (one Die term per die, so Dice So Nice and the roll history see every die), applies the Pool rules and posts
 * the chat message. The pure half (formula, flags, side effects to apply) has no Foundry dependency and is unit tested
 * with an injected rng; the Foundry half is at the bottom and only touches globals inside functions.
 */
import { SYSTEM_ID } from "../config.mjs";
import { logger } from "../logger.mjs";
import { applyRollEffects, buildRollData, evaluateDice, isRollMode, poolFormula, rollEffects, rollValues } from "./roll-core.mjs";
import { ROLL_REQUESTED_HOOK, poolOf, syncRows } from "../applications/actor/parts/tray.mjs";

/**
 * Pool entries that carry a die (blank Traits are skipped), in Pool order.
 * @param {import("./pool.mjs").PoolEntry[]} entries
 * @returns {import("./pool.mjs").PoolEntry[]}
 */
export function rollableEntries(entries) {
  return entries.filter((e) => !e.blank && e.die);
}

// Re-exported: the pure roll core lives in roll-core.mjs (shared with the opposition roller).
export { buildRollData, poolFormula, rollEffects, rollValues };

/* ------------------------------------------------------------ Foundry half */

/** UUIDs of actors with a roll in flight (a double click must not roll twice). */
const rolling = new Set();

/** Display name of a Pool entry. */
function labelOf(entry) {
  return entry.nameKey ? game.i18n.localize(entry.nameKey) : entry.name;
}

/** The world's roll mode (`rules.rollMode`); an unknown value falls back to `classic`. */
function currentRollMode() {
  const mode = game.settings.get(SYSTEM_ID, "rules.rollMode");
  return isRollMode(mode) ? mode : "classic";
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
  if (!rollable.length || rolling.has(actor.uuid)) return null;
  rolling.add(actor.uuid);
  try {
    const { roll, values } = await evaluateDice(rollable.map((e) => e.die), rollable.map((e) => e.kind));
    const mode = currentRollMode();
    const data = buildRollData({
      entries: rollable, values, actorUuid: actor.uuid, actorName: actor.name, actorImg: actor.img,
      flavor: flavor ?? game.i18n.localize("LEVERAGE.Roll.defaultFlavor"), mode, ppAtRoll: actor.system.plotPoints?.value ?? 0
    });
    // The card first: if posting fails nothing was spent or earned. The effects follow once the card exists.
    const message = await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }), flavor: data.flavor, flags: { [SYSTEM_ID]: { roll: data } }
    });
    // Prime: nothing is earned or spent until the player resolves the card (Plot Points, Money: resolve-dice-flow.mjs).
    if (data.status === "resolved") await applyRollEffects(actor, data);
    await clearPoolAfterRoll(sheet);
    if (data.status === "pending") openWhenDiceStop(message);
    return message;
  } finally {
    rolling.delete(actor.uuid);
  }
}

/** Longest wait for Dice So Nice before the Choose dice window opens anyway (ms). */
const DICE_ANIMATION_FALLBACK = 6000;

/**
 * Opens the Choose dice window on this client once Dice So Nice (when present) has shown the dice, or after a short
 * fallback if the animation never ends. Never throws.
 */
async function openWhenDiceStop(message) {
  try {
    const animation = game.dice3d?.waitFor3DAnimationByMessageID?.(message.id);
    await Promise.race([animation, new Promise((resolve) => setTimeout(resolve, DICE_ANIMATION_FALLBACK))]);
    const { openResolveDice } = await import("../applications/dialogs/resolve-dice.mjs");
    await openResolveDice(message);
  } catch (err) {
    logger.error("Could not open the Choose dice window", err);
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
