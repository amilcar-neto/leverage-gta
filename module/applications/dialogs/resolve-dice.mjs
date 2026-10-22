/**
 * "Choose dice" window (docs/08, Cortex Prime): the player picks two dice for the total and one for the effect, then
 * "Roll to card" resolves the pending card. One window per message (`lv-resolve-<message id>`). The draft lives in the
 * window; closing it spends nothing and the card stays pending. The rules are the pure functions of
 * `dice/resolve-draft.mjs` and `dice/prime-math.mjs`; confirming goes through `resolve-dice-flow.mjs`.
 */
import { LEVERAGE, SYSTEM_ID } from "../../config.mjs";
import { autoSelection } from "../../dice/prime-math.mjs";
import { buyDie, clickDie, dieCaption, dieStates, draftFrom, draftSummary, emptyDraft, forceEffect } from "../../dice/resolve-draft.mjs";
import { resolveActor, rollOf } from "../components/common.mjs";
import { renderDie } from "../components/die.mjs";
import { t } from "../components/i18n.mjs";
import { canResolve, confirmRoll, plotPointsFor, registerResolveSocket } from "./resolve-dice-flow.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Open windows by message id. */
const open = new Map();

/**
 * Template data of one die tile.
 * @param {object} entry Roll entry.
 * @param {{index: number, state: string, paid: boolean}} info From `dieStates`.
 * @returns {object}
 */
export function tileOf(entry, info) {
  const { state, paid, index } = info;
  const title = `${entry.label} · d${entry.faces} · ${entry.result}`;
  // A plain die is named "d10": the caption already says so, do not write it twice.
  const name = entry.label.toLowerCase() === `d${entry.faces}` ? "" : entry.label;
  const html = renderDie({
    die: entry.faces, value: entry.result, size: LEVERAGE.dieGeometry.uses.resolveDice, money: entry.kind === "money",
    kept: state === "total", one: state === "hitch", cls: `lv-rd-die--${state}`
  });
  return {
    index, state, paid, name, title, html, caption: dieCaption(entry, state, paid, t),
    clickable: state !== "hitch", canEffect: state !== "hitch" && state !== "effect" && !paid
  };
}

/** The Choose dice window. */
export class ResolveDiceApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["leverage-gta", "lv-config", "lv-resolve"],
    tag: "div",
    window: { title: "LEVERAGE.Resolve.title", icon: "fa-solid fa-dice", contentClasses: ["lv-config-window"] },
    position: { width: 560, height: "auto" },
    actions: {
      pick: ResolveDiceApp.#onPick, effect: ResolveDiceApp.#onEffect, autoTotal: ResolveDiceApp.#onAutoTotal,
      autoEffect: ResolveDiceApp.#onAutoEffect, buy: ResolveDiceApp.#onBuy, dismissOffer: ResolveDiceApp.#onDismissOffer,
      confirm: ResolveDiceApp.#onConfirm, cancel: ResolveDiceApp.#onCancel
    }
  };

  /** @override */
  static PARTS = { body: { template: `systems/${SYSTEM_ID}/templates/dialogs/resolve-dice.hbs` } };

  /** @type {ChatMessage} */
  message;
  #draft = emptyDraft();
  /** Index of the die the player is offered to buy with a Plot Point. */
  #offer = null;

  /** @param {ChatMessage} message The pending roll card. */
  constructor(message, options = {}) {
    super({ id: `lv-resolve-${message.id}`, ...options });
    this.message = message;
  }

  /** @override */
  async _prepareContext() {
    const data = rollOf(this.message);
    const entries = data?.entries ?? [];
    const available = data ? plotPointsFor(data) : 0;
    const summary = data ? draftSummary(data, this.#draft, { ppAvailable: available }) : null;
    const allowed = Boolean(data) && canResolve(data.actorUuid ? resolveActor(data.actorUuid) : null, game.user);
    const states = dieStates(entries, this.#draft);
    const offer = this.#offer !== null && summary?.ppLeft >= LEVERAGE.prime.paidDiceCost ? tileOf(entries[this.#offer], states[this.#offer]) : null;
    return {
      who: data?.actorName ?? "", flavor: data?.flavor ?? "",
      tiles: entries.map((e, i) => tileOf(e, states[i])), offer,
      summary: summary && this.#summaryView(summary),
      canConfirm: allowed && Boolean(summary?.ok)
    };
  }

  /** Footer texts from the summary. */
  #summaryView(s) {
    const beat = s.versus?.outcome !== "fail";
    const versus = s.versus ? t(beat ? "LEVERAGE.Resolve.versusBeat" : "LEVERAGE.Resolve.versusFail", { n: Math.abs(s.versus.margin) }) : "";
    const missing = s.missing.map((key) => t(`LEVERAGE.Resolve.missing.${key}`)).join(", ");
    return {
      hasNotes: Boolean(versus || s.botch || missing),
      total: s.botch ? 0 : s.total, effect: `d${s.effectFaces}`, effectDefault: s.effectDefault, ppLeft: s.ppLeft, ppSpent: s.ppSpent,
      versus, versusFail: !beat, missing: missing ? t("LEVERAGE.Resolve.missing.label", { what: missing }) : "", botch: s.botch
    };
  }

  /** @override */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.element.addEventListener("contextmenu", (event) => {
      const tile = event.target.closest(".lv-rd-pick[data-index]");
      if (!tile) return;
      event.preventDefault();
      this.#setEffect(Number(tile.dataset.index));
    });
  }

  /** @override */
  async _onClose(options) {
    if (open.get(this.message.id) === this) open.delete(this.message.id);
    return super._onClose(options);
  }

  /** @returns {object[]} entries of the card. */
  get #entries() {
    return rollOf(this.message)?.entries ?? [];
  }

  /** Plot Points the draft may still spend. */
  get #ppLeft() {
    const data = rollOf(this.message);
    return data ? Math.max(0, plotPointsFor(data) - this.#draft.paid.length * LEVERAGE.prime.paidDiceCost) : 0;
  }

  #setEffect(index) {
    this.#draft = forceEffect(this.#entries, this.#draft, index);
    this.#offer = null;
    return this.render();
  }

  static #onPick(_event, target) {
    const index = Number(target.dataset.index);
    const result = clickDie(this.#entries, this.#draft, index, { ppLeft: this.#ppLeft });
    this.#draft = result.draft;
    this.#offer = result.offer ? index : null;
    return this.render();
  }

  static #onEffect(_event, target) {
    return this.#setEffect(Number(target.dataset.index));
  }

  static #onAutoTotal() {
    this.#draft = draftFrom(autoSelection(this.#entries, { prefer: "total" }));
    this.#offer = null;
    return this.render();
  }

  static #onAutoEffect() {
    this.#draft = draftFrom(autoSelection(this.#entries, { prefer: "effect" }));
    this.#offer = null;
    return this.render();
  }

  static #onBuy() {
    if (this.#offer !== null) this.#draft = buyDie(this.#entries, this.#draft, this.#offer, { ppLeft: this.#ppLeft });
    this.#offer = null;
    return this.render();
  }

  static #onDismissOffer() {
    this.#offer = null;
    return this.render();
  }

  static async #onConfirm() {
    if (!(await confirmRoll(this.message, this.#draft))) return;
    await this.close();
  }

  static #onCancel() {
    return this.close();
  }
}

/**
 * Opens the Choose dice window of a pending card (or brings the open one to the front). Only a user who may resolve
 * the card gets it; the others see nothing.
 * @param {ChatMessage} message
 * @returns {Promise<ResolveDiceApp|null>}
 */
export async function openResolveDice(message) {
  const data = rollOf(message);
  if (!data || data.status !== "pending") return null;
  if (!canResolve(data.actorUuid ? resolveActor(data.actorUuid) : null, game.user)) return null;
  const existing = open.get(message.id);
  if (existing?.rendered) {
    existing.bringToFront();
    return existing;
  }
  const app = new ResolveDiceApp(message);
  open.set(message.id, app);
  await app.render({ force: true });
  return app;
}

/** A card update redraws its open window, or closes it when the card was resolved elsewhere. */
function onUpdateMessage(message) {
  const app = open.get(message.id);
  if (!app) return;
  if (rollOf(message)?.status === "pending") app.render();
  else app.close();
}

/** A Plot Point change redraws the windows of the actor's cards. */
function onUpdateActor(actor, changes) {
  if (changes.system?.plotPoints === undefined) return;
  for (const app of open.values()) if (rollOf(app.message)?.actorUuid === actor.uuid) app.render();
}

/** Registers the window hooks and the Fixer-side socket action (call once, from `init`). */
export function registerResolveDice() {
  registerResolveSocket();
  Hooks.on("updateChatMessage", onUpdateMessage);
  Hooks.on("updateActor", onUpdateActor);
  Hooks.on("deleteChatMessage", (message) => open.get(message.id)?.close());
}
