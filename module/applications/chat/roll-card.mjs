/**
 * Roll card (docs/08 "O card"): draws a Pool roll message from `flags.leverage-gta.roll` (docs/05) in the chat log.
 * The context builder is pure (testable in node); only the hook registration at the bottom touches Foundry globals.
 */
import { LEVERAGE, SYSTEM_ID, hasRealPortrait } from "../../config.mjs";
import { resolveActor, rollOf } from "../components/common.mjs";
import { renderDie } from "../components/die.mjs";
import { unresolvedOnes } from "../../dice/card-actions.mjs";
import { cardHandlers, isCharacterOwner, latestRollOf, registerCardSocket } from "./card-handlers.mjs";
import { damageView, registerDamageMessages } from "./damage.mjs";
import { sceneTagOf } from "../scene-panel/scene-panel-logic.mjs";

/** Template of the card. */
export const ROLL_CARD_TEMPLATE = `systems/${SYSTEM_ID}/templates/chat/roll-card.hbs`;

/** Die size shown on the card (docs/08). */
const DIE_SIZE = LEVERAGE.dieGeometry.uses.rollCard;

/** Ordinal number ("3rd" / "3º") for the Plot Point button, by the plural rules of the interface language. */
function ordinal(n, t, lang) {
  const rule = new Intl.PluralRules(lang, { type: "ordinal" }).select(n);
  const key = { one: "one", two: "two", few: "few" }[rule] ?? "other";
  return t(`LEVERAGE.Roll.Ordinal.${key}`, { n });
}

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

/** Template data of one chip; a die from the scene (Scene Trait, Complication) carries a tag saying so. */
function chipOf(entry, t) {
  const tag = sceneTagOf(entry);
  const tagText = tag ? t(`LEVERAGE.Roll.tag.${tag}`) : "";
  const label = entry.label;
  return {
    label, die: `d${entry.faces}`, faces: entry.faces, money: entry.kind === "money", tag, tagText,
    tip: tag ? `${tagText}: ${label} d${entry.faces}` : `${label} d${entry.faces}`
  };
}

/**
 * Template data of the whole card.
 * @param {object} data `flags.leverage-gta.roll`.
 * @param {object} view
 * @param {(key: string, data?: object) => string} view.t Translate function (format).
 * @param {boolean} [view.isOwner] The viewer is the character's player (the Fixer is not).
 * @param {boolean} [view.isLatest] This is the actor's newest Pool roll in the chat (only that card may keep dice).
 * @param {string} [view.lang] Interface language (ordinal numbers).
 * @param {boolean} [view.isGM] The viewer is the Fixer.
 * @param {number} [view.plotPoints] Plot Points the actor has now.
 * @param {{show: boolean, applied: string}} [view.damage] Opposition card: APPLY DAMAGE button and the applied summary.
 * @returns {object}
 */
export function rollCardContext(data, { t, isOwner = false, isLatest = true, isGM = false, plotPoints = 0, lang = "en", damage = { show: false, applied: "" } }) {
  const entries = data.entries ?? [];
  const keptValues = entries.filter((e) => e.kept).map((e) => e.result).sort((a, b) => b - a);
  const unresolved = data.opposition ? 0 : unresolvedOnes(data).length;
  const spare = entries.some((e) => !e.kept && !e.one);
  const photo = hasRealPortrait(data.actorImg) ? data.actorImg : "";
  const opposition = Boolean(data.opposition);
  const showKeep = !opposition && isOwner && isLatest && spare;
  const keepDisabled = showKeep && plotPoints < 1;
  const showComplication = !opposition && isGM && unresolved > 0;
  return {
    opposition, name: data.actorName, img: opposition ? "" : photo, flavor: data.flavor,
    chips: entries.map((e) => chipOf(e, t)),
    dice: entries.map((e) => dieContext(e, t)),
    total: data.total,
    countText: keptValues.length ? t(`LEVERAGE.Roll.explain${keptValues.length === 1 ? "One" : "Many"}`, { count: keptValues.length }) : t("LEVERAGE.Roll.noneKept"),
    sumText: keptValues.join(" + "),
    onesCount: unresolved,
    onesText: unresolved ? t(`LEVERAGE.Roll.onesWarning${unresolved === 1 ? "One" : "Many"}`, { count: unresolved }) : "",
    ppNotes: [
      data.distinctionPP ? t("LEVERAGE.Roll.distinctionPP", { count: data.distinctionPP }) : "",
      data.ppSpent ? t(`LEVERAGE.Roll.ppSpent${data.ppSpent === 1 ? "One" : "Many"}`, { count: data.ppSpent }) : "",
      data.money ? t("LEVERAGE.Roll.moneyDrop") : ""
    ].filter(Boolean),
    showKeep, keepDisabled, showComplication, showDamage: damage.show, damageApplied: damage.applied,
    showActions: showKeep || showComplication || damage.show,
    damageLabel: t("LEVERAGE.Damage.button"), damageTip: t("LEVERAGE.Damage.buttonTip"),
    keepLabel: t("LEVERAGE.Roll.keepButton", { n: ordinal((data.keptCount ?? 0) + 1, t, lang) }),
    keepTip: t(keepDisabled ? "LEVERAGE.Roll.keepTipNoPlotPoints" : "LEVERAGE.Roll.keepTip"),
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

/** Draws the card into one rendered message element. Nothing is drawn for a message the viewer may not read. */
function paint(message, html, data, template) {
  if (!message.isContentVisible) return;
  const actor = resolveActor(data.actorUuid);
  const context = rollCardContext(data, {
    t: (key, args) => game.i18n.format(key, args), lang: game.i18n.lang,
    isOwner: isCharacterOwner(actor, game.user), isLatest: latestRollOf(data.actorUuid)?.id === message.id,
    isGM: game.user.isGM, plotPoints: actor?.system?.plotPoints?.value ?? 0, damage: damageView(message, data)
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

/** Draws again the newest roll card of an actor (its "+1 PP" button depends on Plot Points and on being the newest). */
function refreshLatest(actorUuid, except) {
  const message = actorUuid ? latestRollOf(actorUuid) : null;
  if (message && message.id !== except) ui.chat?.updateMessage(message);
}

/** A Plot Point change redraws the actor's newest card; a new roll redraws the card that stopped being the newest. */
function registerRefreshHooks() {
  Hooks.on("updateActor", (actor, changes) => {
    if (changes.system?.plotPoints !== undefined) refreshLatest(actor.uuid);
  });
  Hooks.on("createChatMessage", (message) => {
    const data = message.getFlag(SYSTEM_ID, "roll");
    if (!data || data.opposition) return;
    const list = game.messages.contents;
    const previous = list.slice(0, list.indexOf(message)).reverse().find((m) => rollOf(m)?.actorUuid === data.actorUuid && !rollOf(m).opposition);
    if (previous) ui.chat?.updateMessage(previous);
  });
}

/** Registers the card hooks (call once, from `init`). */
export function registerRollCard() {
  Hooks.on("renderChatMessageHTML", onRenderMessage);
  registerCardSocket();
  registerRefreshHooks();
  registerDamageMessages();
  Hooks.once("ready", ensureTemplate);
}
