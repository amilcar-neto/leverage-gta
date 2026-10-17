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

const rollOf = (message) => message?.getFlag(SYSTEM_ID, "roll") ?? null;
const actorOf = (data) => (data?.actorUuid ? fromUuidSync(data.actorUuid) : null);

/** Runs `task` unless an action on this message is already running. */
async function exclusive(message, task) {
  if (busy.has(message.id)) return;
  busy.add(message.id);
  try { await task(); } catch (err) { logger.error("Roll card action failed", err); } finally { busy.delete(message.id); }
}

/**
 * Spends 1 Plot Point of the actor and keeps the next die. Validates against fresh data, so a stale card does nothing.
 * @param {ChatMessage} message
 * @param {User} user Who asked (must own the actor).
 * @returns {Promise<boolean>} whether a die was kept
 */
export async function keepDieNow(message, user) {
  const data = rollOf(message);
  const actor = actorOf(data);
  const next = data && keepNextDie(data);
  if (!actor || !next || !actor.testUserPermission(user, "OWNER") || (actor.system.plotPoints?.value ?? 0) < 1) return false;
  await actor.addPlotPoints(-1);
  try {
    await message.setFlag(SYSTEM_ID, "roll", next);
  } catch (err) {
    await actor.addPlotPoints(1);
    throw err;
  }
  return true;
}

/** Socket handler (Fixer side). */
async function onKeepDieRequest({ messageId }, userId) {
  const message = game.messages.get(messageId);
  const user = game.users.get(userId);
  if (message && user) await keepDieNow(message, user);
}

/** Button "+1 PP · KEEP 3RD DIE". */
function keepDie(message) {
  return exclusive(message, async () => {
    if (message.canUserModify(game.user, "update")) await keepDieNow(message, game.user);
    else await executeAsGM("keepDie", { messageId: message.id });
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
