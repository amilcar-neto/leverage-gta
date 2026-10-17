/**
 * Chat lines for Money (docs/02): "X paid Y" and "X lent Z to W". Small styled messages, not roll cards.
 * The HTML builders are pure (unit tested); posting needs the Foundry globals.
 */
import { LEVERAGE } from "../../config.mjs";
import { escapeHtml, renderDie } from "../components/die.mjs";
import { t } from "../components/i18n.mjs";
import { stepsToDice } from "../../rules/money.mjs";

const DIE_SIZE = LEVERAGE.dieGeometry.uses.moneyLine;

/** A row of Money dice (green), or a dash when there are none. */
function diceHtml(dice) {
  if (!dice.length) return `<span class="lv-money-none">0</span>`;
  return dice.map((die) => renderDie({ die, size: DIE_SIZE, money: true })).join("");
}

/**
 * One labelled block of Money dice (also used by the dialogs).
 * @param {string} label
 * @param {number[]} dice
 * @returns {string}
 */
export function block(label, dice) {
  return `<span class="lv-money-block"><span class="lv-money-label">${escapeHtml(label)}</span>
    <span class="lv-money-dice">${diceHtml(dice)}</span></span>`;
}

/**
 * HTML of the "paid" line.
 * @param {object} data
 * @param {string} data.name Character name.
 * @param {string} data.item What was bought (already translated).
 * @param {number[]} data.cost Price dice.
 * @param {number} data.after Money steps left.
 * @returns {string}
 */
export function payLineHtml({ name, item, cost, after }) {
  const text = t("LEVERAGE.Money.Chat.paid", { name: escapeHtml(name), item: escapeHtml(item) });
  return `<div class="leverage-gta lv-money-line lv-money-line--pay"><p class="lv-money-text">${text}</p>
    <div class="lv-money-row">${block(t("LEVERAGE.Money.cost"), cost)}${block(t("LEVERAGE.Money.left"), stepsToDice(after))}</div></div>`;
}

/**
 * HTML of the "lent" line.
 * @param {object} data
 * @param {string} data.from Lender name.
 * @param {string} data.to Receiver name.
 * @param {number} data.moved Steps moved.
 * @returns {string}
 */
export function lendLineHtml({ from, to, moved }) {
  const text = t("LEVERAGE.Money.Chat.lent", { from: escapeHtml(from), to: escapeHtml(to) });
  return `<div class="leverage-gta lv-money-line lv-money-line--lend"><p class="lv-money-text">${text}</p>
    <div class="lv-money-row">${block(t("LEVERAGE.Money.amount"), stepsToDice(moved))}</div></div>`;
}

/** Posts a public line spoken by the character. */
function post(actor, content) {
  return ChatMessage.create({ content, speaker: ChatMessage.getSpeaker({ actor }) });
}

/** Posts the "paid" line. @param {Actor} actor @param {{item: string, cost: number[], after: number}} data */
export const postPayLine = (actor, { item, cost, after }) => post(actor, payLineHtml({ name: actor.name, item, cost, after }));

/** Posts the "lent" line, spoken by the lender. @param {Actor} from @param {Actor} to @param {number} moved */
export const postLendLine = (from, to, moved) => post(from, lendLineHtml({ from: from.name, to: to.name, moved }));
