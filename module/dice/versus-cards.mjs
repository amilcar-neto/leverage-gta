/**
 * Foundry half of the versus link (T-1011): reads the chat log as plain cards for the pure functions of `versus.mjs`
 * and tells which Fixer card a player's window may offer. The one write is `linkPlayerCard` (the Fixer's roller).
 */
import { SYSTEM_ID } from "../config.mjs";
import { readSetting } from "../data/fields.mjs";
import { normalizeRoll } from "./roll-core.mjs";
import { buildVersus, latestFixerCard, latestPlayerCard } from "./versus.mjs";

/** @returns {boolean} the rule `rules.heroicSuccess` (default on) */
export const heroicOn = () => Boolean(readSetting("rules.heroicSuccess", true));

/**
 * One chat message as a plain card.
 * @param {ChatMessage} message
 * @returns {{id: string, timestamp: number, sceneId: string|undefined, roll: object}|null} null when it has no roll
 */
export function cardOf(message) {
  const roll = normalizeRoll(message?.getFlag(SYSTEM_ID, "roll") ?? null);
  return roll ? { id: message.id, timestamp: message.timestamp ?? 0, sceneId: message.speaker?.scene ?? undefined, roll } : null;
}

/** @returns {{id: string, timestamp: number, sceneId: string|undefined, roll: object}[]} every roll card of the chat log */
export const chatCards = () => game.messages.contents.map(cardOf).filter(Boolean);

/**
 * The Fixer card a player's pending card may be rolled against (the newest one before it, same scene).
 * @param {ChatMessage} message The player's card.
 * @returns {{id: string, timestamp: number, roll: object}|null}
 */
export function fixerCardFor(message) {
  const mine = cardOf(message);
  return mine && !mine.roll.opposition ? latestFixerCard(chatCards(), mine) : null;
}

/**
 * The player card the opposition roller may read (newest resolved roll without a link, same scene as the Fixer's now).
 * @returns {{id: string, timestamp: number, roll: object}|null}
 */
export const playerCardForFixer = () => latestPlayerCard(chatCards(), { sceneId: canvas?.scene?.id });

/**
 * Fixer only: links a player's resolved card to the Fixer card just rolled (inverted order of the versus). Rereads the
 * card first; a card that got a link meanwhile is left alone.
 * @param {string} playerId Message id of the player's card.
 * @param {ChatMessage} fixerMessage The Fixer's opposition card.
 * @returns {Promise<boolean>} whether the link was written
 */
export async function linkPlayerCard(playerId, fixerMessage) {
  const player = game.messages.get(playerId);
  const mine = cardOf(player);
  const fixer = cardOf(fixerMessage);
  if (!mine || !fixer || !game.user.isGM || mine.roll.versus || mine.roll.status !== "resolved") return false;
  const versus = buildVersus({ messageId: fixer.id, difficulty: fixer.roll.total, total: mine.roll.total, effectDie: mine.roll.effectDie, heroic: heroicOn() });
  await player.setFlag(SYSTEM_ID, "roll", { ...mine.roll, versus });
  return true;
}
