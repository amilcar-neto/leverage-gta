/**
 * Roll card (docs/08 "O card"): draws a Pool roll message from `flags.leverage-gta.roll` (docs/05) in the chat log.
 * The context builder is pure (testable in node); only the hook registration at the bottom touches Foundry globals.
 */
import { SYSTEM_ID } from "../../config.mjs";
import { renderDie } from "../components/die.mjs";
import { unresolvedOnes } from "../../dice/card-actions.mjs";
import { cardHandlers, registerCardSocket } from "./card-handlers.mjs";

/** Template of the card. */
export const ROLL_CARD_TEMPLATE = `systems/${SYSTEM_ID}/templates/chat/roll-card.hbs`;

/** Image that means "no photo" (same test as the crew sheet). */
const NO_PHOTO = "mystery-man";

/** Die size shown on the card (docs/08). */
const DIE_SIZE = 50;

/** Caption of one die: KEPT, "1 · OUT" or its size. */
function captionOf(entry, t) {
  if (entry.kept) return { text: t("LEVERAGE.Roll.kept"), state: "kept" };
  if (entry.one) return { text: t("LEVERAGE.Roll.out"), state: "one" };
  return { text: `d${entry.faces}`, state: "dropped" };
}

/**
 * Template data of one die.
 * @param {object} entry Roll entry (docs/05).
 * @param {(key: string, data?: object) => string} t
 * @returns {{html: string, caption: string, state: string}}
 */
export function dieContext(entry, t) {
  const caption = captionOf(entry, t);
  const state = { kept: entry.kept, one: entry.one, dropped: caption.state === "dropped" };
  const title = `${entry.label} · d${entry.faces} · ${entry.result}`;
  const html = renderDie({ die: entry.faces, value: entry.result, size: DIE_SIZE, money: entry.kind === "money", title, ...state });
  return { html, caption: caption.text, state: caption.state };
}

/**
 * Template data of the whole card.
 * @param {object} data `flags.leverage-gta.roll`.
 * @param {object} view
 * @param {(key: string, data?: object) => string} view.t Translate function (format).
 * @param {boolean} [view.isOwner] The viewer owns the actor.
 * @param {boolean} [view.isGM] The viewer is the Fixer.
 * @param {number} [view.plotPoints] Plot Points the actor has now.
 * @returns {object}
 */
export function rollCardContext(data, { t, isOwner = false, isGM = false, plotPoints = 0 }) {
  const entries = data.entries ?? [];
  const keptValues = entries.filter((e) => e.kept).map((e) => e.result).sort((a, b) => b - a);
  const unresolved = data.opposition ? 0 : unresolvedOnes(data).length;
  const spare = entries.some((e) => !e.kept && !e.one);
  const photo = data.actorImg && !data.actorImg.includes(NO_PHOTO) ? data.actorImg : "";
  const opposition = Boolean(data.opposition);
  const showKeep = !opposition && isOwner && plotPoints > 0 && spare;
  const showComplication = !opposition && isGM && unresolved > 0;
  return {
    opposition, name: data.actorName, img: opposition ? "" : photo, flavor: data.flavor,
    chips: entries.map((e) => ({ label: e.label, die: `d${e.faces}`, faces: e.faces })),
    dice: entries.map((e) => dieContext(e, t)),
    total: data.total,
    countText: keptValues.length ? t("LEVERAGE.Roll.explain", { count: keptValues.length }) : t("LEVERAGE.Roll.noneKept"),
    sumText: keptValues.join(" + "),
    onesCount: unresolved,
    onesText: unresolved ? t(`LEVERAGE.Roll.onesWarning${unresolved === 1 ? "One" : "Many"}`, { count: unresolved }) : "",
    ppNotes: [
      data.distinctionPP ? t("LEVERAGE.Roll.distinctionPP", { count: data.distinctionPP }) : "",
      data.ppSpent ? t("LEVERAGE.Roll.ppSpent", { count: data.ppSpent }) : "",
      data.money ? t("LEVERAGE.Roll.moneyDrop") : ""
    ].filter(Boolean),
    showKeep, showComplication, showActions: showKeep || showComplication,
    keepLabel: t("LEVERAGE.Roll.keepButton"), keepTip: t("LEVERAGE.Roll.keepTip"),
    complicationLabel: t("LEVERAGE.Roll.complicationButton"), complicationTip: t("LEVERAGE.Roll.complicationTip")
  };
}

/* ------------------------------------------------------------ Foundry half */

let compiled = null;

/** Loads (once) the compiled card template. */
async function ensureTemplate() {
  compiled ??= await foundry.applications.handlebars.getTemplate(ROLL_CARD_TEMPLATE);
  return compiled;
}

/** Draws the card into one rendered message element. */
function paint(message, html, data, template) {
  const actor = data.actorUuid ? fromUuidSync(data.actorUuid) : null;
  const context = rollCardContext(data, {
    t: (key, args) => game.i18n.format(key, args),
    isOwner: Boolean(actor?.isOwner), isGM: game.user.isGM, plotPoints: actor?.system?.plotPoints?.value ?? 0
  });
  const host = html.querySelector(".message-content");
  if (!host) return;
  html.classList.add("lv-roll-message");
  host.innerHTML = template(context);
  host.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", (event) => cardHandlers[button.dataset.action]?.(message, event));
  });
}

/** `renderChatMessageHTML` listener (HTMLElement, no jQuery). */
function onRenderMessage(message, html) {
  const data = message.getFlag(SYSTEM_ID, "roll");
  if (!data) return;
  if (compiled) paint(message, html, data, compiled);
  else ensureTemplate().then((template) => paint(message, html, data, template));
}

/** Registers the card hooks (call once, from `init`). */
export function registerRollCard() {
  Hooks.on("renderChatMessageHTML", onRenderMessage);
  registerCardSocket();
  Hooks.once("ready", ensureTemplate);
}
