/**
 * Foundry half of confirming a Cortex Prime roll (docs/08): who may resolve a pending card, and the writes that
 * resolve it (the card flags, then the Plot Point and Money changes). The rules are the pure functions of
 * `dice/resolve-draft.mjs`. The Fixer does the writes (through the socket queue) and answers the requester.
 */
import { SYSTEM_ID } from "../../config.mjs";
import { logger } from "../../logger.mjs";
import { lowestActiveGM, registerSocketAction, requestAsGM } from "../../socket.mjs";
import { applyConfirm, ppAvailable } from "../../dice/resolve-draft.mjs";
import { applyRollEffects } from "../../dice/roll-core.mjs";
import { fixerCardFor, heroicOn } from "../../dice/versus-cards.mjs";
import { resolveActor, rollOf } from "../components/common.mjs";
import { t } from "../components/i18n.mjs";
import { isCharacterOwner } from "../chat/card-handlers.mjs";

/** Messages this client is confirming right now (a double click must not send two requests). */
const busy = new Set();

const plotPointsOf = (actor) => actor?.system?.plotPoints?.value ?? 0;

/**
 * Whether a user may choose the dice of a card: the character's player; the Fixer only for a card without a
 * character, or a character no player owns (NPC, opposition, a table with no players).
 * @param {Actor|null} actor
 * @param {User} user
 * @returns {boolean}
 */
export function canResolve(actor, user) {
  if (!user) return false;
  if (isCharacterOwner(actor, user)) return true;
  if (!user.isGM) return false;
  return !actor || !game.users.some((u) => !u.isGM && actor.testUserPermission(u, "OWNER"));
}

/**
 * Plot Points the window of a card may spend now.
 * @param {object} data Roll data.
 * @returns {number}
 */
export function plotPointsFor(data) {
  const actor = data?.actorUuid ? resolveActor(data.actorUuid) : null;
  return ppAvailable(data, actor ? plotPointsOf(actor) : null);
}

/**
 * Resolves a pending card with a selection: validates, then writes the card first and the character after, with ONE
 * actor update (Plot Points and Money together). If the actor cannot be updated the card goes back to pending, so a
 * card is never resolved without its Plot Points and Money. On the Fixer this runs inside the socket queue, so two
 * requests for the same card never overlap (docs/04).
 * @param {ChatMessage} message
 * @param {{total: number[], effect: number[], paid?: number[]}} selection Untrusted: it may come from a socket.
 * @param {User} user Who asks.
 * @param {string|null} [versusId] Fixer card the player chose to roll against; used only when it is still the card the window offers (untrusted).
 * @returns {Promise<{ok: boolean, reason?: "forbidden"|"notPending"|"invalid"|"versusStale"|"error"}>}
 */
export async function resolveNow(message, selection, user, versusId = null) {
  const data = rollOf(message);
  if (!data || data.status !== "pending") return { ok: false, reason: "notPending" };
  const actor = data.actorUuid ? resolveActor(data.actorUuid) : null;
  if (!canResolve(actor, user)) return { ok: false, reason: "forbidden" };
  const link = versusFor(message, versusId, user);
  if (link?.stale) return { ok: false, reason: "versusStale" };
  const resolved = applyConfirm(data, selection, { ppAvailable: plotPointsFor(data), versus: link });
  if (!resolved) return { ok: false, reason: "invalid" };
  try {
    await message.setFlag(SYSTEM_ID, "roll", resolved);
  } catch (err) {
    logger.error("Could not resolve the roll card", err);
    return { ok: false, reason: "error" };
  }
  try {
    if (actor) await applyRollEffects(actor, resolved);
  } catch (err) {
    logger.error("Could not apply the roll to the character; putting the card back to pending", err);
    await message.setFlag(SYSTEM_ID, "roll", data).catch((undoErr) => logger.error("Could not put the card back", undoErr));
    return { ok: false, reason: "error" };
  }
  return { ok: true };
}

/**
 * The link to save for a chosen Fixer card. A card that is not the one offered to this user now (the Fixer rolled
 * again, or the id is forged or of a card the user cannot read) answers `{stale: true}`: the confirmation is refused.
 * @returns {{messageId: string, difficulty: number, heroic: boolean}|{stale: true}|null} null when no link was asked
 */
function versusFor(message, versusId, user) {
  if (!versusId) return null;
  const card = fixerCardFor(message, user);
  return card?.id === versusId ? { messageId: card.id, difficulty: card.roll.total, heroic: heroicOn() } : { stale: true };
}

/** Warns about a refused confirmation (only for the client that asked). */
function warn(reason) {
  ui.notifications.warn(t(`LEVERAGE.Resolve.${reason}`));
}

/**
 * Confirms a selection from this client. With a Fixer connected the request always goes to him (even for the Fixer
 * himself, through the same queue) and the answer comes back; with none, a user who can update the card does it here.
 * @param {ChatMessage} message
 * @param {{total: number[], effect: number[], paid?: number[]}} selection
 * @param {string|null} [versusId] Fixer card to roll against (optional link, never automatic).
 * @returns {Promise<boolean>} whether the card was resolved; a refusal warns this user and returns false
 */
export async function confirmRoll(message, selection, versusId = null) {
  if (busy.has(message.id)) return false;
  busy.add(message.id);
  try {
    let result;
    if (lowestActiveGM(game.users)) result = await requestAsGM("resolveRoll", { messageId: message.id, selection, versusId });
    else if (message.canUserModify(game.user, "update")) result = await resolveNow(message, selection, game.user, versusId);
    else {
      ui.notifications.warn(t("LEVERAGE.Socket.noGM"));
      return false;
    }
    if (!result) warn("noAnswer");
    else if (!result.ok) warn(result.reason);
    return Boolean(result?.ok);
  } finally {
    busy.delete(message.id);
  }
}

/** Socket handler (Fixer side). The requester is the user the server authenticated; answers with the result. */
async function onResolveRequest({ messageId, selection, versusId }, userId) {
  const message = game.messages.get(messageId);
  const user = game.users.get(userId);
  if (!message || !user) return { ok: false, reason: "notPending" };
  return resolveNow(message, selection ?? { total: [], effect: [] }, user, versusId ?? null);
}

/** Registers the Fixer-side socket action (call once). */
export function registerResolveSocket() {
  registerSocketAction("resolveRoll", onResolveRequest);
}
