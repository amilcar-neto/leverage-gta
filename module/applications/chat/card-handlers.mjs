/**
 * Foundry half of the roll card buttons (docs/08 "O card"): "+1 PP · Keep 3rd die" (owner) and "GM · Complication".
 * The rules live in `dice/card-actions.mjs`; this file reads and writes documents. The card is updated by editing the
 * message flags; a user that cannot update the message asks the Fixer through the socket.
 */
import { SYSTEM_ID } from "../../config.mjs";
import { logger } from "../../logger.mjs";
import { executeAsGM, registerSocketAction } from "../../socket.mjs";
import { activateHitches as applyHitches, applyComplication, keepNextDie, resolveNextOne, unresolvedOnes } from "../../dice/card-actions.mjs";
import { resolveActor, rollOf } from "../components/common.mjs";
import { editTableList, readComplications } from "../../table-state.mjs";
import { promptComplication, promptHitches } from "./complication-dialog.mjs";
import { damageFromCard } from "./damage.mjs";

/** Messages with an action in flight (a double click must not spend two Plot Points). */
const busy = new Set();

/** How long a player's "+1 PP" button stays disabled while it waits for the Fixer to update the card (ms). */
const WAIT_FOR_FIXER = 4000;

const actorOf = (data) => (data?.actorUuid ? resolveActor(data.actorUuid) : null);
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
  if (!resolved) return;
  let created = null;
  await editTableList("complications", (list) => {
    const result = applyComplication(list, choice, foundry.utils.randomID);
    created = result?.complication ?? null;
    return result?.list ?? list;
  });
  if (!created) return;
  await actorOf(data)?.addPlotPoints(1);
  await message.setFlag(SYSTEM_ID, "roll", resolved);
}

/** Button "GM · COMPLICATION". */
function complication(message) {
  if (!game.user.isGM) return undefined;
  return exclusive(message, async () => {
    const choice = await promptComplication(readComplications());
    if (choice) await writeComplication(message, choice);
  });
}

/**
 * Writes the activation of every open hitch: the Complications (through the table queue), the card (hitches resolved,
 * Plot Points noted) and the player's Plot Points, in that order. The card is read inside the queue, so a second
 * activation of the same card finds no hitch left and does nothing.
 * @returns {Promise<{ppGain: number, outOfScene: string[]}|null>} null when nothing was written
 */
async function writeHitches(message, choice) {
  let result = null;
  await editTableList("complications", (list) => {
    const data = rollOf(message);
    result = data ? applyHitches(data, list, choice, foundry.utils.randomID) : null;
    return result?.list ?? list;
  });
  if (!result) return null;
  await message.setFlag(SYSTEM_ID, "roll", result.data);
  if (result.ppGain > 0) await actorOf(result.data)?.addPlotPoints(result.ppGain);
  return result;
}

/** Button "ACTIVATE HITCHES" (Cortex Prime card, Fixer only): one dialog for all the open hitches. */
function activateHitches(message) {
  if (!game.user.isGM) return undefined;
  return exclusive(message, async () => {
    const data = rollOf(message);
    const count = data ? unresolvedOnes(data).length : 0;
    if (!count) return;
    const choice = await promptHitches(readComplications(), { count, free: Boolean(data.botch) });
    if (!choice) return;
    const done = await writeHitches(message, choice);
    if (done?.outOfScene.length) ui.notifications.warn(game.i18n.format("LEVERAGE.Roll.outOfScene", { names: done.outOfScene.join(", ") }));
  });
}

/** Button "APPLY DAMAGE" (opposition card, Fixer only). */
function applyDamage(message) {
  if (!game.user.isGM) return undefined;
  return exclusive(message, () => damageFromCard(message));
}

/** Messages whose card the viewer opened (client state only; never saved, lost on reload). */
const expandedCards = new Set();

/** Whether the viewer opened this card to see the whole roll. */
export const isExpanded = (message) => expandedCards.has(message.id);

/** Card click or chevron: shows or hides the whole roll (docs/08). Toggles the class in place, no redraw. */
function toggleExpand(message, event) {
  const card = event?.currentTarget?.closest?.(".lv-roll-card") ?? event?.target?.closest?.(".lv-roll-card");
  const open = !expandedCards.has(message.id);
  if (open) expandedCards.add(message.id); else expandedCards.delete(message.id);
  card?.classList.toggle("is-expanded", open);
  card?.querySelector("[data-action='toggleExpand']")?.setAttribute("aria-expanded", String(open));
}

/** Button "Choose dice": opens the choose-dice window (loaded on demand; it is built apart from this card). */
async function chooseDice(message) {
  try {
    const { openResolveDice } = await import("../dialogs/resolve-dice.mjs");
    await openResolveDice(message);
  } catch (err) {
    logger.error("Choose dice window failed", err);
    ui.notifications.warn(game.i18n.localize("LEVERAGE.Roll.chooseUnavailable"));
  }
}

/**
 * Click handlers by `data-action`.
 * @type {Record<string, (message: ChatMessage, event: Event) => Promise<void>|void>}
 */
export const cardHandlers = { keepDie, complication, activateHitches, applyDamage, chooseDice, toggleExpand };

/** Registers the Fixer-side socket action (call once). */
export function registerCardSocket() {
  registerSocketAction("keepDie", onKeepDieRequest);
}
