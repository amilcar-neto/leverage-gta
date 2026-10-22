/**
 * Versus (Cortex Prime, T-1011/T-1012): an optional link between a player's roll card and a Fixer's opposition card,
 * and what the link says (success, failure, heroic success and the final effect die). Pure functions on plain card
 * data (`{id, timestamp, roll}`), no Foundry dependency; the link is never made by proximity, only on request.
 */
import { compare, stepEffect } from "./prime-math.mjs";
import { stepDown } from "./die.mjs";

/** Whether a card is a resolved opposition card of the Fixer (the one a player can roll against). */
const isFixerCard = (card) => Boolean(card?.roll?.opposition) && card.roll.status !== "pending" && Number.isFinite(card.roll.total);

/** Whether a card is a resolved player roll that is not linked yet. */
const isFreePlayerCard = (card) => Boolean(card?.roll) && !card.roll.opposition && card.roll.status === "resolved" && !card.roll.versus && Number.isFinite(card.roll.total);

/** Two cards of different known scenes are not the same moment. */
const sameScene = (a, b) => !a || !b || a === b;

/**
 * The newest Fixer card rolled before a player's card, in the same scene: the one the player's window offers.
 * @param {{id: string, timestamp: number, sceneId?: string, roll: object}[]} cards Chat cards with roll data (`sceneId`: scene of the speaker), any order.
 * @param {{id?: string, timestamp: number, sceneId?: string}} player The player's card.
 * @returns {{id: string, timestamp: number, roll: object}|null}
 */
export function latestFixerCard(cards, player) {
  const older = cards.filter((c) => c.id !== player.id && isFixerCard(c) && c.timestamp <= player.timestamp && sameScene(c.sceneId, player.sceneId));
  return older.reduce((best, c) => (!best || c.timestamp >= best.timestamp ? c : best), null);
}

/**
 * The newest player card still without a link, in the scene of a Fixer's roll: what the opposition roller can read.
 * @param {{id: string, timestamp: number, roll: object}[]} cards
 * @param {{sceneId?: string}} [fixer]
 * @returns {{id: string, timestamp: number, roll: object}|null}
 */
export function latestPlayerCard(cards, { sceneId } = {}) {
  const free = cards.filter((c) => isFreePlayerCard(c) && sameScene(c.sceneId, sceneId));
  return free.reduce((best, c) => (!best || c.timestamp >= best.timestamp ? c : best), null);
}

/**
 * What a link says. Margin = player total minus the Fixer's total; above 0 is a success, a tie is a failure (the Fixer
 * wins ties); 5 or more is heroic (when the rule is on): the effect die goes up 1 step per full 5 points.
 * @param {object} input
 * @param {string} input.messageId The Fixer card.
 * @param {number} input.difficulty The Fixer's total.
 * @param {number} input.total The player's total.
 * @param {number|null} input.effectDie The player's effect die size.
 * @param {boolean} [input.heroic] Rule `rules.heroicSuccess` (default true).
 * @returns {{messageId: string, difficulty: number, margin: number, outcome: "success"|"fail"|"heroic", steps: number, effectDie: number|null}}
 */
export function buildVersus({ messageId, difficulty, total, effectDie, heroic = true }) {
  const result = compare(total, difficulty);
  const steps = heroic ? result.steps : 0;
  const outcome = result.outcome === "heroic" && !heroic ? "success" : result.outcome;
  const final = effectDie && steps ? stepEffect(effectDie, steps) : effectDie;
  return { messageId, difficulty, margin: result.margin, outcome, steps, effectDie: final ?? null };
}

/** Whether the player's roll won the contest. */
export const versusWon = (versus) => Boolean(versus) && versus.outcome !== "fail";

/**
 * Whether the effect of a roll may be used now (Asset or Complication): a resolved prime roll with an effect die that
 * won its versus link (a roll without a link is narrative, so it may).
 * @param {object} roll Normalized roll data.
 * @returns {boolean}
 */
export const effectUsable = (roll) => Boolean(roll) && !roll.opposition && roll.status === "resolved" && (roll.v ?? 1) >= 2 && Boolean(roll.effectDie) && (!roll.versus || versusWon(roll.versus));

/**
 * Effect die the roll can use: the one raised by heroic success when the roll has a versus link, else the rolled one.
 * @param {object} roll Normalized roll data.
 * @returns {number|null}
 */
export const finalEffectDie = (roll) => roll?.versus?.effectDie || roll?.effectDie || null;

/**
 * Marks one use of the effect on the card (`effectUsed.asset` / `effectUsed.complication`).
 * @param {object} roll
 * @param {"asset"|"complication"} kind
 * @returns {object} new roll data
 */
export const markEffectUsed = (roll, kind) => ({ ...roll, effectUsed: { ...roll.effectUsed, [kind]: true } });

/**
 * Die of a Complication born from the winner's effect: the winner's size, one step lower when the loser's effect is the
 * same or bigger (book: Effect in opposition). A d4 that steps down is gone.
 * @param {number} winnerEffect
 * @param {number} loserEffect
 * @returns {number|null} die size, or null when nothing is left
 */
export function complicationFromEffect(winnerEffect, loserEffect) {
  if (!winnerEffect) return null;
  return loserEffect && loserEffect >= winnerEffect ? stepDown(winnerEffect) : winnerEffect;
}

/**
 * Player cards that lost against a Fixer card and still have no Complication from the winner's effect.
 * @param {{id: string, timestamp: number, roll: object}[]} cards
 * @param {string} fixerId
 * @returns {{id: string, timestamp: number, roll: object}[]} oldest first
 */
export function lostAgainst(cards, fixerId) {
  return cards
    .filter((c) => !c.roll?.opposition && c.roll?.versus?.messageId === fixerId && c.roll.versus.outcome === "fail" && !c.roll.versus.complicationMade)
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Marks a link as used by the Complication of the winner's effect (or of the action's effect).
 * @param {object} roll Roll data of the player card.
 * @returns {object} new roll data
 */
export const markComplicationMade = (roll) => ({ ...roll, versus: { ...roll.versus, complicationMade: true } });

/**
 * Adds a Complication from an effect (name + die), id from the generator.
 * @param {{id: string, name: string, die: number}[]} list
 * @param {{name: string, die: number}} entry
 * @param {() => string} newId
 * @returns {{list: object[], created: object}|null} null for an empty name or a die out of range
 */
export function addEffectComplication(list, { name, die }, newId) {
  const clean = String(name ?? "").trim();
  if (!clean || !die) return null;
  const created = { id: newId(), name: clean, die };
  return { list: [...list, created], created };
}
