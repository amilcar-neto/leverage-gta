/**
 * Foundry half of the roll card buttons (docs/08 "O card"): "+1 PP · Keep 3rd die" (owner) and "GM · Complication".
 * The rules live in `dice/card-actions.mjs`; this file reads and writes documents. The card is updated by editing the
 * message flags; a user that cannot update the message asks the Fixer through the socket.
 */
import { SYSTEM_ID } from "../../config.mjs";
import { logger } from "../../logger.mjs";
import { executeAsGM, registerSocketAction } from "../../socket.mjs";
import { applyComplication, keepNextDie, resolveNextOne } from "../../dice/card-actions.mjs";
import { promptComplication } from "./complication-dialog.mjs";
import { damageFromCard } from "./damage.mjs";

/** Messages with an action in flight (a double click must not spend two Plot Points). */
const busy = new Set();

/** How long a player's "+1 PP" button stays disabled while it waits for the Fixer to update the card (ms). */
const WAIT_FOR_FIXER = 4000;

const rollOf = (message) => message?.getFlag(SYSTEM_ID, "roll") ?? null;
const actorOf = (data) => (data?.actorUuid ? fromUuidSync(data.actorUuid) : null);
const plotPointsOf = (actor) => actor?.system?.plotPoints?.value ?? 0;

/** Runs `task` unless an action on this message is already running. */
async function exclusive(message, task) {
  if (busy.has(message.id)) return;
  busy.add(message.id);
  try { await task(); } catch (err) { logger.error("Roll card action failed", err); } finally { busy.delete(message.id); }
}

/**
 * Whether a user is the player of the character: an explicit Owner. The Fixer owns every document, so he does not
 * count as the character's owner here (docs/08: "+1 PP" is for the owner; the Fixer uses `plotPoints.add`).
 * @param {Actor|null} actor
 * @param {User} user
 * @returns {boolean}
 */
export function isCharacterOwner(actor, user) {
  return Boolean(actor && user && !user.isGM && actor.testUserPermission(user, "OWNER"));
}

/**
 * The newest Pool roll card of an actor in the chat log (opposition cards do not count). Only that card may keep dice.
 * @param {string} actorUuid
 * @returns {ChatMessage|null}
 */
export function latestRollOf(actorUuid) {
  const list = game.messages.contents;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const data = rollOf(list[i]);
    if (data && !data.opposition && data.actorUuid === actorUuid) return list[i];
  }
  return null;
}

/**
 * Spends 1 Plot Point of the actor and keeps the next die. Validates against fresh data after every await, so a stale
 * card, a card that is no longer the actor's latest roll, or a user that does not own the character does nothing.
 * Warns the user (when it is this client) if the actor has no Plot Point.
 * @param {ChatMessage} message
 * @param {User} user Who asked (must own the actor; the Fixer is not an owner here).
 * @returns {Promise<boolean>} whether a die was kept
 */
export async function keepDieNow(message, user) {
  const ready = () => {
    const data = rollOf(message);
    const actor = actorOf(data);
    const next = data && !data.opposition && keepNextDie(data);
    const allowed = next && isCharacterOwner(actor, user) && latestRollOf(data.actorUuid)?.id === message.id;
    return allowed ? { actor, next } : null;
  };
  const first = ready();
  if (!first) return false;
  if (plotPointsOf(first.actor) < 1) {
    if (user.id === game.user.id) ui.notifications.warn(game.i18n.localize("LEVERAGE.Roll.noPlotPoints"));
    return false;
  }
  await first.actor.addPlotPoints(-1);
  // Everything may have changed while the Plot Point was written: check again before touching the card.
  const again = ready();
  if (!again) {
    await first.actor.addPlotPoints(1);
    return false;
  }
  try {
    await message.setFlag(SYSTEM_ID, "roll", again.next);
  } catch (err) {
    await first.actor.addPlotPoints(1);
    throw err;
  }
  return true;
}

/** Socket handler (Fixer side). `userId` comes from the server (docs/04), the busy lock is per message. */
async function onKeepDieRequest({ messageId }, userId) {
  const message = game.messages.get(messageId);
  const user = game.users.get(userId);
  if (message && user) await exclusive(message, () => keepDieNow(message, user));
}

/** Disables a button; it comes back after `ms` unless the card was redrawn (then the button is a new element). */
function lockButton(button, ms) {
  if (!button) return;
  button.disabled = true;
  setTimeout(() => { button.disabled = false; }, ms);
}

/** Button "+1 PP · KEEP 3RD DIE". */
function keepDie(message, event) {
  const button = event?.currentTarget ?? null;
  if (busy.has(message.id) || button?.disabled) return undefined;
  if (button) button.disabled = true;
  return exclusive(message, async () => {
    if (message.canUserModify(game.user, "update")) {
      await keepDieNow(message, game.user);
      if (button) button.disabled = false;
    } else {
      // The Fixer applies it; keep the button off until the card is redrawn with the new flags.
      const sent = await executeAsGM("keepDie", { messageId: message.id });
      if (!sent && button) button.disabled = false;
      else lockButton(button, WAIT_FOR_FIXER);
    }
  });
}

/** Writes the Complication, hands the player 1 Plot Point and marks the 1 as resolved. */
async function writeComplication(message, choice) {
  const data = rollOf(message);
  const resolved = data && resolveNextOne(data);
  const job = foundry.utils.deepClone(game.settings.get(SYSTEM_ID, "activeJob"));
  const result = resolved && applyComplication(job, choice, foundry.utils.randomID);
  if (!result) return;
  await game.settings.set(SYSTEM_ID, "activeJob", result.job);
  await actorOf(data)?.addPlotPoints(1);
  await message.setFlag(SYSTEM_ID, "roll", resolved);
}

/** Button "GM · COMPLICATION". */
function complication(message) {
  if (!game.user.isGM) return undefined;
  return exclusive(message, async () => {
    const job = game.settings.get(SYSTEM_ID, "activeJob");
    const choice = await promptComplication(job?.complications ?? []);
    if (choice) await writeComplication(message, choice);
  });
}

/** Button "APPLY DAMAGE" (opposition card, Fixer only). */
function applyDamage(message) {
  if (!game.user.isGM) return undefined;
  return exclusive(message, () => damageFromCard(message));
}

/**
 * Click handlers by `data-action`.
 * @type {Record<string, (message: ChatMessage, event: Event) => Promise<void>|void>}
 */
export const cardHandlers = { keepDie, complication, applyDamage };

/** Registers the Fixer-side socket action (call once). */
export function registerCardSocket() {
  registerSocketAction("keepDie", onKeepDieRequest);
}
