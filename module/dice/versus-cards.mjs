/**
 * Foundry half of the versus link (T-1011): reads the chat log as plain cards for the pure functions of `versus.mjs`
 * and tells which Fixer card a player's window may offer. The one write is `linkPlayerCard` (the Fixer's roller).
 * A card is trusted as the Fixer's only when its message was authored by a Fixer (`byGM`), like the Opportunities.
 */
import { SYSTEM_ID } from "../config.mjs";
import { readSetting } from "../data/fields.mjs";
import { normalizeRoll } from "./roll-core.mjs";
import { buildVersus, isFixerCard, isFreePlayerCard, latestFixerCard, latestPlayerCard, visibleTo } from "./versus.mjs";

/** @returns {boolean} the rule `rules.heroicSuccess` (default on) */
export const heroicOn = () => Boolean(readSetting("rules.heroicSuccess", true));

/**
 * One chat message as a plain card.
 * @param {ChatMessage} message
 * @param {User} [user] Whose eyes: a blind or private roll this user cannot read is `visible: false`.
 * @returns {{id: string, timestamp: number, sceneId: string|undefined, byGM: boolean, visible: boolean, roll: object}|null} null when it has no roll
 */
export function cardOf(message, user = game.user) {
  const roll = normalizeRoll(message?.getFlag(SYSTEM_ID, "roll") ?? null);
  if (!roll) return null;
  return {
    id: message.id, timestamp: message.timestamp ?? 0, sceneId: message.speaker?.scene ?? undefined,
    byGM: Boolean(message.author?.isGM), visible: visibleTo(message, user), roll
  };
}

/**
 * @param {User} [user] Whose eyes (the processing Fixer passes the user who asks).
 * @returns {object[]} every roll card of the chat log
 */
export const chatCards = (user = game.user) => game.messages.contents.map((m) => cardOf(m, user)).filter(Boolean);

/**
 * The cards whose roll is linked to one Fixer card (reads only the flag of each message, so a busy log is not normalized).
 * @param {string} fixerId
 * @returns {object[]}
 */
export function cardsLinkedTo(fixerId) {
  return game.messages.contents.filter((m) => m.flags?.[SYSTEM_ID]?.roll?.versus?.messageId === fixerId).map((m) => cardOf(m)).filter(Boolean);
}

/**
 * The Fixer card a player's pending card may be rolled against (the newest one for it, same scene, written by a Fixer
 * and readable by the user).
 * @param {ChatMessage} message The player's card.
 * @param {User} [user] Who is choosing (default this client's user).
 * @returns {{id: string, timestamp: number, roll: object}|null}
 */
export function fixerCardFor(message, user = game.user) {
  const mine = cardOf(message, user);
  return mine && !mine.roll.opposition ? latestFixerCard(chatCards(user), mine) : null;
}

/**
 * The player card the opposition roller may read (newest resolved roll without a link or effect use, same scene as the Fixer's now).
 * @returns {{id: string, timestamp: number, roll: object}|null}
 */
export const playerCardForFixer = () => latestPlayerCard(chatCards(), { sceneId: canvas?.scene?.id });

/**
 * A player card by id, only while it is still free to link (no link, no effect used, resolved).
 * @param {string|null} id
 * @returns {{id: string, timestamp: number, roll: object}|null}
 */
export function freePlayerCard(id) {
  const card = id ? cardOf(game.messages.get(id)) : null;
  return isFreePlayerCard(card) ? card : null;
}

/**
 * Fixer only: links a player's resolved card to the Fixer card just rolled (inverted order of the versus). Rereads the
 * card first; a card that got a link or an effect use meanwhile is left alone, and so is a Fixer card that was not
 * written by a Fixer. Only adds `versus`: the rest of the saved roll (an old card included) is not rewritten.
 * @param {string} playerId Message id of the player's card.
 * @param {ChatMessage} fixerMessage The Fixer's opposition card.
 * @returns {Promise<boolean>} whether the link was written
 */
export async function linkPlayerCard(playerId, fixerMessage) {
  const player = game.messages.get(playerId);
  const mine = freePlayerCard(playerId);
  const fixer = cardOf(fixerMessage);
  if (!mine || !isFixerCard(fixer) || !game.user.isGM) return false;
  const versus = buildVersus({ messageId: fixer.id, difficulty: fixer.roll.total, total: mine.roll.total, effectDie: mine.roll.effectDie, heroic: heroicOn() });
  await player.setFlag(SYSTEM_ID, "roll", { ...player.getFlag(SYSTEM_ID, "roll"), versus });
  return true;
}
