/**
 * Roll card (docs/08 "O card"): draws a Pool roll message from `flags.leverage-gta.roll` (docs/05) in the chat log.
 * The context builder is pure (testable in node); only the hook registration at the bottom touches Foundry globals.
 */
import { LEVERAGE, SYSTEM_ID, hasRealPortrait } from "../../config.mjs";
import { resolveActor, rollOf } from "../components/common.mjs";
import { renderDie } from "../components/die.mjs";
import { unresolvedOnes } from "../../dice/card-actions.mjs";
import { dieCaption, dieState } from "../../dice/resolve-draft.mjs";
import { normalizeRoll } from "../../dice/roll-core.mjs";
import { cardHandlers, isCharacterOwner, isExpanded, latestRollOf, registerCardSocket } from "./card-handlers.mjs";
import { canResolve } from "../dialogs/resolve-dice-flow.mjs";
import { damageView, registerDamageMessages } from "./damage.mjs";
import { sceneTagOf } from "../scene-panel/scene-panel-logic.mjs";

/** Template of the card. */
export const ROLL_CARD_TEMPLATE = `systems/${SYSTEM_ID}/templates/chat/roll-card.hbs`;

/** Die size shown on the card (docs/08). */
const DIE_SIZE = LEVERAGE.dieGeometry.uses.rollCard;

/** Small die of the EFFECT block (only the size is shown, never a result). */
const EFFECT_DIE_SIZE = LEVERAGE.dieGeometry.uses.ladder;

/**
 * Which layout draws a roll (docs/08 "O card").
 * @param {object} data Normalized roll data (`normalizeRoll`).
 * @returns {"classic"|"pending"|"prime"}
 */
export function layoutOf(data) {
  if (data.opposition) return "classic";
  if (data.status === "pending") return "pending";
  return (data.v ?? 1) >= 2 && data.effectDie != null ? "prime" : "classic";
}

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


/** Indexes of the dice in the total / the effect die, from `selection` (kept flags for cards without one). */
function selectionOf(data) {
  const entries = data.entries ?? [];
  const total = data.selection?.total ?? entries.flatMap((e, i) => (e.kept ? [i] : []));
  return { total, effect: data.selection?.effect ?? [], paid: data.selection?.paid ?? [] };
}

/** CSS state of a card die by the state of `dieState` (the card keeps the classic names). */
const CARD_STATE = { hitch: "one", total: "kept", effect: "effect", free: "dropped" };

/**
 * Template data of one die of a prime card (resolved or pending).
 * @param {object} entry Roll entry (docs/05).
 * @param {number} index Position in `entries`.
 * @param {{total: number[], effect: number[], paid: number[]}|null} selection `null` while pending (no marks).
 * @param {(key: string, data?: object) => string} t
 * @returns {{html: string, caption: string, state: string}}
 */
export function primeDieContext(entry, index, selection, t) {
  const kind = selection ? dieState(entry, index, selection) : "free";
  const state = CARD_STATE[kind];
  const paid = Boolean(selection && (entry.paid || selection.paid.includes(index)));
  const caption = dieCaption(entry, kind, paid, t);
  const marks = selection
    ? { kept: state === "kept", one: state === "one", dropped: state === "dropped", cls: state === "effect" ? "lv-roll-die--effect" : undefined }
    : { kept: false, one: false, dropped: false };
  const title = `${entry.label} · d${entry.faces} · ${entry.result}`;
  const html = renderDie({ die: entry.faces, value: entry.result, size: DIE_SIZE, money: entry.kind === "money", title, ...marks });
  return { html, caption, state };
}

/** The EFFECT block of the summary: a small empty die of the effect size (the size is written beside it, never a result). */
function effectBlock(data, t) {
  const faces = data.effectDie;
  const label = t("LEVERAGE.Roll.effect");
  const html = renderDie({ die: faces, value: "", size: EFFECT_DIE_SIZE, title: `${label} d${faces}`, cls: "lv-roll-die--effect" });
  return { label, faces: `d${faces}`, html };
}

/** Hitch strip text ("2 hitches") and the BOTCH flag; empty when the roll has no hitch. */
function hitchView(data, entries, t) {
  const count = data.hitches ?? entries.filter((e) => e.result === 1).length;
  const botch = Boolean(data.botch);
  return {
    hitchCount: count,
    hitchText: count ? t(`LEVERAGE.Roll.hitches${count === 1 ? "One" : "Many"}`, { count }) : "",
    botch, botchText: botch ? t("LEVERAGE.Roll.botch") : "", showHitches: count > 0 || botch
  };
}

/** Fields only the pending and prime layouts use (see `rollCardContext`). */
function primeFields(data, layout, view) {
  const { t, canChoose, expanded } = view;
  const entries = data.entries ?? [];
  if (layout === "pending") {
    return {
      dice: entries.map((e, i) => primeDieContext(e, i, null, t)),
      pendingText: t("LEVERAGE.Roll.pendingBadge"),
      showChoose: canChoose, chooseLabel: t("LEVERAGE.Roll.chooseButton"), chooseTip: t("LEVERAGE.Roll.chooseTip")
    };
  }
  if (layout !== "prime") return {};
  const selection = selectionOf(data);
  const all = entries.map((e, i) => primeDieContext(e, i, selection, t));
  const values = selection.total.map((i) => entries[i].result);
  return {
    expanded, dice: all,
    summaryDice: selection.total.map((i) => all[i]),
    effect: effectBlock(data, t),
    total: data.total ?? 0,
    countText: "", sumText: values.join(" + "),
    expandLabel: t(expanded ? "LEVERAGE.Roll.collapseTip" : "LEVERAGE.Roll.expandTip"),
    ...hitchView(data, entries, t)
  };
}

/**
 * Template data of the whole card.
 * @param {object} data `flags.leverage-gta.roll`.
 * @param {object} view
 * @param {(key: string, data?: object) => string} view.t Translate function (format).
 * @param {boolean} [view.isOwner] The viewer is the character's player (the Fixer is not).
 * @param {boolean} [view.canChoose] The viewer may choose the dice of a pending card (`canResolve`): shows the Choose dice button.
 * @param {boolean} [view.isLatest] This is the actor's newest Pool roll in the chat (only that card may keep dice).
 * @param {string} [view.lang] Interface language (ordinal numbers).
 * @param {boolean} [view.isGM] The viewer is the Fixer.
 * @param {number} [view.plotPoints] Plot Points the actor has now.
 * @param {{show: boolean, applied: string}} [view.damage] Opposition card: APPLY DAMAGE button and the applied summary.
 * @param {boolean} [view.expanded] The viewer opened the full roll (client state, never saved).
 * @returns {object}
 */
export function rollCardContext(raw, { t, isOwner = false, canChoose = false, isLatest = true, isGM = false, plotPoints = 0, lang = "en", expanded = false, damage = { show: false, applied: "" } }) {
  const data = normalizeRoll(raw);
  const layout = layoutOf(data);
  const resolved = layout !== "pending";
  const entries = data.entries ?? [];
  const keptValues = entries.filter((e) => e.kept).map((e) => e.result).sort((a, b) => b - a);
  const unresolved = data.opposition ? 0 : unresolvedOnes(data).length;
  const spare = entries.some((e) => !e.kept && !e.one);
  const photo = hasRealPortrait(data.actorImg) ? data.actorImg : "";
  const opposition = Boolean(data.opposition);
  const showKeep = !opposition && resolved && layout === "classic" && isOwner && isLatest && spare;
  const keepDisabled = showKeep && plotPoints < 1;
  const showComplication = !opposition && resolved && isGM && unresolved > 0 && layout === "classic";
  const showActivate = !opposition && layout === "prime" && isGM && unresolved > 0;
  const base = {
    layout, pending: layout === "pending", prime: layout === "prime", classic: layout === "classic", opposition,
    name: data.actorName, img: opposition ? "" : photo, flavor: data.flavor,
    chips: entries.map((e) => chipOf(e, t)),
    dice: entries.map((e) => dieContext(e, t)),
    total: data.total,
    countText: keptValues.length ? t(`LEVERAGE.Roll.explain${keptValues.length === 1 ? "One" : "Many"}`, { count: keptValues.length }) : t("LEVERAGE.Roll.noneKept"),
    sumText: keptValues.join(" + "),
    onesCount: layout === "classic" ? unresolved : 0,
    onesText: layout === "classic" && unresolved ? t(`LEVERAGE.Roll.onesWarning${unresolved === 1 ? "One" : "Many"}`, { count: unresolved }) : "",
    ppNotes: !resolved ? [] : [
      data.distinctionPP ? t("LEVERAGE.Roll.distinctionPP", { count: data.distinctionPP }) : "",
      data.ppSpent ? t(`LEVERAGE.Roll.ppSpent${data.ppSpent === 1 ? "One" : "Many"}`, { count: data.ppSpent }) : "",
      data.money ? t("LEVERAGE.Roll.moneyDrop") : "",
      data.hitchPP ? t("LEVERAGE.Roll.hitchPP", { count: data.hitchPP }) : ""
    ].filter(Boolean),
    warnings: layout === "prime" && data.outOfScene?.length ? [t("LEVERAGE.Roll.outOfScene", { names: data.outOfScene.join(", ") })] : [],
    showActivate, activateLabel: t("LEVERAGE.Roll.activateButton"), activateTip: t("LEVERAGE.Roll.activateTip"),
    showKeep, keepDisabled, showComplication, showDamage: resolved && damage.show, damageApplied: resolved ? damage.applied : "",
    damageLabel: t("LEVERAGE.Damage.button"), damageTip: t("LEVERAGE.Damage.buttonTip"),
    keepLabel: t("LEVERAGE.Roll.keepButton", { n: ordinal((data.keptCount ?? 0) + 1, t, lang) }),
    keepTip: t(keepDisabled ? "LEVERAGE.Roll.keepTipNoPlotPoints" : "LEVERAGE.Roll.keepTip"),
    complicationLabel: t("LEVERAGE.Roll.complicationButton"), complicationTip: t("LEVERAGE.Roll.complicationTip")
  };
  const context = { ...base, ...primeFields(data, layout, { t, canChoose, expanded }) };
  context.showActions = Boolean(showKeep || showComplication || showActivate || context.showDamage || context.showChoose);
  return context;
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
    isOwner: isCharacterOwner(actor, game.user), canChoose: canResolve(actor, game.user), isLatest: latestRollOf(data.actorUuid)?.id === message.id,
    isGM: game.user.isGM, plotPoints: actor?.system?.plotPoints?.value ?? 0, damage: damageView(message, data),
    expanded: isExpanded(message)
  });
  const host = html.querySelector(".message-content");
  if (!host) return;
  html.classList.add("lv-roll-message");
  host.innerHTML = template(context);
  if (context.prime) host.querySelector(".lv-roll-card")?.addEventListener("click", (event) => {
    if (!event.target.closest("button, a")) cardHandlers.toggleExpand(message, event);
  });
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
