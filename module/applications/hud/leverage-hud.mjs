/**
 * The HUD (docs/07-ui-hud.md): wanted stars, Money and Plot Points at the top right of the screen, 16px from the
 * sidebar. A frameless `ApplicationV2` (the pf2e effects panel pattern) appended to Foundry's `#interface`.
 * It re-renders (debounced) when the wanted level, the focused character, the control of a token, the user's
 * character, the house rules or the client settings change. All rules live in `hud-logic.mjs` and the public API.
 * There is one instance; the hooks and listeners it adds are removed when it closes.
 */
import { LEVERAGE, SYSTEM_ID } from "../../config.mjs";
import { readSetting } from "../../data/fields.mjs";
import { getCityScales, readTablePlotPoints, readWanted, stepTablePlotPoints } from "../../world-state.mjs";
import { setLevel } from "../gm/stars-actions.mjs";
import { t, tn } from "../components/i18n.mjs";
import {
  changedKeys, hudPermissions, moneyView, nextStarLevel, partyRows, pickFocusActor, plotPointRows, showParty, starsView, touchesPartyLists
} from "./hud-logic.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Pause after the sidebar starts to move before measuring it (its slide takes about 200 ms). */
const SIDEBAR_SETTLE_MS = 250;
const RENDER_DEBOUNCE_MS = 50;

/** Hooks that keep the HUD current (`leverage.` ones are the system's own). */
const REFRESH_HOOKS = Object.freeze([
  "controlToken", "canvasReady", LEVERAGE.hooks.starsChanged, LEVERAGE.hooks.hudChanged, LEVERAGE.hooks.houseRulesChanged
]);

/** Size of the Money dice. */
const DIE_SIZE = LEVERAGE.dieGeometry.uses.hud;

/** The Crew character of the first controlled token, if any. */
function controlledCrew() {
  const token = canvas?.tokens?.controlled?.find((tk) => tk.actor?.type === "crew");
  return token?.actor ?? null;
}

export class LeverageHud extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "leverage-hud",
    tag: "aside",
    classes: ["leverage-gta"],
    window: { frame: false, positioned: false },
    actions: {
      setStars: LeverageHud.#onSetStars,
      payMoney: LeverageHud.#onPay,
      spendPlotPoint: LeverageHud.#onSpendPlotPoint,
      gainPlotPoint: LeverageHud.#onGainPlotPoint,
      stepPlayerPoints: LeverageHud.#onStepPlayerPoints,
      stepTablePoints: LeverageHud.#onStepTablePoints,
      toggleMinimized: LeverageHud.#onToggleMinimized,
      toggleParty: LeverageHud.#onToggleParty,
      collapseParty: LeverageHud.#onCollapseParty
    }
  };

  /** @override */
  static PARTS = { main: { template: `systems/${SYSTEM_ID}/templates/hud/hud.hbs` } };

  /** The one instance (see `LeverageHud.create`). */
  static #instance = null;

  /**
   * The HUD, created and rendered once; later calls return the same one while it is open.
   * @returns {LeverageHud}
   */
  static create() {
    if (LeverageHud.#instance) return LeverageHud.#instance;
    LeverageHud.#instance = new LeverageHud();
    LeverageHud.#instance.render({ force: true });
    return LeverageHud.#instance;
  }

  /** Plot Points shown at the last render, per character (a change pulses the number). */
  #lastPp = { id: null, value: null };

  /** Plot Points of the Fixer's list at the last render, by key (`table` or an actor id). */
  #lastGmPp = {};

  /** @type {[string, number][]} Hooks added by this instance, removed on close. */
  #hooks = [];

  /** Window resize listener, removed on close. */
  #onResize = () => this.updatePosition();

  /** A window may have just come to the front: raise the HUD after the core has bumped its counter. */

  /** @type {ResizeObserver|null} */
  #observer = null;

  #settleTimer = null;

  /** Sidebar element the observer watches. */
  #observed = null;

  /** Re-render with a short debounce (many hooks fire together). */
  refresh = foundry.utils.debounce(() => this.render({ force: true }), RENDER_DEBOUNCE_MS);

  /** Character the HUD shows now. @returns {?Actor} */
  get focusActor() {
    return pickFocusActor({ isGM: game.user.isGM, character: game.user.character, controlled: controlledCrew() });
  }

  /* ---------------------------------------------------------------- context */

  /** @override */
  async _prepareContext() {
    const actor = this.focusActor;
    const isGM = game.user.isGM;
    const can = hudPermissions({ isGM, isOwner: Boolean(actor?.isOwner), hasActor: Boolean(actor) });
    const minimized = Boolean(readSetting("hud.minimized", false));
    return {
      dieSize: DIE_SIZE,
      minimized,
      stars: this.#starsContext(can.stars),
      money: this.#moneyContext(actor, can, minimized, isGM),
      plotPoints: this.#plotPointsContext(actor, can, minimized, isGM),
      party: this.#partyContext(minimized, isGM),
      gmPoints: this.#gmPointsContext(minimized, isGM),
      minimizeLabel: t(minimized ? "LEVERAGE.HUD.expand" : "LEVERAGE.HUD.minimize")
    };
  }

  #starsContext(interactive) {
    const { level, city } = readWanted();
    const show = Boolean(readSetting("hud.showStars", true) && readSetting("houseRules.stars", true));
    const items = starsView({ level, city, scales: getCityScales(), interactive }).map((s) => ({
      ...s, tip: tn("LEVERAGE.HUD.starTip", s.n, { pool: s.pool })
    }));
    return { show, items, level, label: t("LEVERAGE.HUD.stars") };
  }

  #moneyContext(actor, can, minimized, isGM) {
    const show = Boolean(readSetting("hud.showMoney", true) && readSetting("houseRules.money", true) && !minimized && (actor || !isGM));
    const steps = actor?.system.money?.steps ?? 0;
    const tip = actor
      ? t(can.money ? "LEVERAGE.HUD.moneyTip" : "LEVERAGE.HUD.moneyTipReadOnly", { steps })
      : t("LEVERAGE.HUD.noCharacter");
    return { show, ...moneyView(steps), interactive: can.money, hasActor: Boolean(actor), tip };
  }

  /** Player characters of the table: each player's assigned character plus Crew actors a player owns explicitly. */
  #partyActors() {
    const players = game.users.filter((u) => !u.isGM);
    const found = new Map();
    for (const user of players) if (user.character?.type === "crew") found.set(user.character.id, user.character);
    for (const actor of game.actors) {
      if (actor.type === "crew" && players.some((u) => actor.ownership?.[u.id] === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) found.set(actor.id, actor);
    }
    return [...found.values()];
  }

  /** The Fixer's optional list of every player's Money (docs/07 "Grana dos jogadores"). */
  #partyContext(minimized, isGM) {
    const enabled = Boolean(readSetting("hud.showPartyMoney", false));
    const show = showParty({ isGM, enabled, minimized, moneyRule: Boolean(readSetting("houseRules.money", true)) });
    const collapsed = Boolean(readSetting("hud.partyCollapsed", false));
    const rows = show ? partyRows(this.#partyActors()) : [];
    const toggleLabel = t(enabled ? "LEVERAGE.HUD.partyHide" : "LEVERAGE.HUD.partyShow");
    return {
      show, collapsed, rows, count: rows.length, dieSize: LEVERAGE.dieGeometry.uses.moneyLine,
      canToggle: isGM && !minimized, toggleLabel, enabled,
      title: t("LEVERAGE.HUD.party"), collapseLabel: t(collapsed ? "LEVERAGE.HUD.partyExpand" : "LEVERAGE.HUD.partyCollapse"),
      empty: t("LEVERAGE.HUD.partyEmpty")
    };
  }

  #plotPointsContext(actor, can, minimized, isGM) {
    const show = Boolean(readSetting("hud.showPlotPoints", true) && !minimized && (actor || !isGM));
    const value = actor?.system.plotPoints?.value ?? 0;
    const changed = this.#lastPp.id === actor?.id && this.#lastPp.value !== null && this.#lastPp.value !== value;
    this.#lastPp = { id: actor?.id ?? null, value: actor ? value : null };
    return {
      show, value, pulse: Boolean(actor) && changed, hasActor: Boolean(actor),
      canSpend: can.spendPlotPoints, canGain: can.gainPlotPoints,
      tip: actor ? t("LEVERAGE.HUD.plotPointsTip", { value }) : t("LEVERAGE.HUD.noCharacter"),
      spendLabel: t("LEVERAGE.HUD.spendPlotPoint"), gainLabel: t("LEVERAGE.HUD.gainPlotPoint")
    };
  }

  /** The Fixer's list of every player's Plot Points plus the table counter "Mesa" (docs/07). */
  #gmPointsContext(minimized, isGM) {
    const show = Boolean(isGM && !minimized && readSetting("hud.showPlotPoints", true));
    if (!show) {
      this.#lastGmPp = {};
      return { show };
    }
    const rows = plotPointRows(this.#partyActors());
    const table = readTablePlotPoints();
    const current = { table, ...Object.fromEntries(rows.map((r) => [r.id, r.value])) };
    const pulsing = changedKeys(this.#lastGmPp, current);
    this.#lastGmPp = current;
    return {
      show, table: {
        value: table, pulse: pulsing.has("table"), canLower: table > 0, label: t("LEVERAGE.HUD.table"),
        lowerLabel: t("LEVERAGE.HUD.tableLower"), raiseLabel: t("LEVERAGE.HUD.tableRaise")
      },
      rows: rows.map((r) => ({
        ...r, pulse: pulsing.has(r.id),
        lowerLabel: t("LEVERAGE.HUD.playerLower", { name: r.name }), raiseLabel: t("LEVERAGE.HUD.playerRaise", { name: r.name })
      })),
      title: t("LEVERAGE.HUD.playersPoints")
    };
  }

  /* ---------------------------------------------------------------- rendering */

  /** The frame goes inside `#interface` so the HUD sits in the UI layer, under windows. @override */
  _insertElement(element) {
    const existing = document.getElementById(element.id);
    if (existing) existing.replaceWith(element);
    else (document.getElementById("interface") ?? document.body).append(element);
    return element;
  }

  /** @override */
  async _onFirstRender() {
    this.element.addEventListener("contextmenu", (event) => this.#onContextMenu(event));
    this.element.addEventListener("keydown", (event) => {
      const value = event.target.closest?.(".lv-hud-pp-value[role='button']");
      if (!value || !["Enter", " "].includes(event.key)) return;
      event.preventDefault();
      value.click();
    });
    this.#watchSidebar();
    this.#watchWorld();
  }

  /** @override */
  async _onRender() {
    this.updatePosition();
  }

  /** Removes every hook and listener this instance added. @override */
  _onClose() {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#observed = null;
    clearTimeout(this.#settleTimer);
    window.removeEventListener("resize", this.#onResize);
    for (const [name, id] of this.#hooks) Hooks.off(name, id);
    this.#hooks = [];
    if (LeverageHud.#instance === this) LeverageHud.#instance = null;
  }

  /* ---------------------------------------------------------------- position */

  /** Writes the space the sidebar takes (its left edge to the window's right edge) to `--lv-sidebar-w`. */
  updatePosition() {
    const left = this.#sidebarElement()?.getBoundingClientRect().left;
    const width = Number.isFinite(left) ? Math.max(0, window.innerWidth - left) : 0;
    document.documentElement.style.setProperty("--lv-sidebar-w", `${Math.round(width)}px`);
  }

  /** The current sidebar element (Foundry replaces it when it re-renders). */
  #sidebarElement() {
    return ui.sidebar?.element ?? document.getElementById("sidebar");
  }

  /** Observes the sidebar element that exists now (again after every render of the sidebar). */
  #bindSidebar() {
    const sidebar = this.#sidebarElement();
    if (!sidebar || sidebar === this.#observed) return;
    this.#observer?.disconnect();
    this.#observed = sidebar;
    this.#observer = new ResizeObserver(() => this.updatePosition());
    this.#observer.observe(sidebar);
  }

  /** Follows the sidebar: size changes, the collapse/render hooks (after the slide ends) and window resizes. */
  #watchSidebar() {
    const settle = () => {
      this.#bindSidebar();
      this.updatePosition();
      clearTimeout(this.#settleTimer);
      this.#settleTimer = setTimeout(() => this.updatePosition(), SIDEBAR_SETTLE_MS);
    };
    this.#bindSidebar();
    window.addEventListener("resize", this.#onResize);
    this.#hooks.push(["collapseSidebar", Hooks.on("collapseSidebar", settle)], ["renderSidebar", Hooks.on("renderSidebar", settle)]);
  }

  /** Re-renders when the focused character, the controlled token, the user's character or a setting changes. */
  #watchWorld() {
    const isFocus = (actor) => Boolean(actor?.id && actor.id === this.focusActor?.id);
    const isListed = (actor) => game.user.isGM && actor?.type === "crew";
    const ifFocus = (actor) => { if (isFocus(actor) || isListed(actor)) this.refresh(); };
    const onActorUpdate = (actor, changes) => {
      if (isFocus(actor) || (isListed(actor) && touchesPartyLists(changes))) this.refresh();
    };
    const onUser = (user, changes) => {
      if (!("character" in changes)) return;
      if (user.id === game.user.id || (game.user.isGM && !user.isGM)) this.refresh();
    };
    this.#hooks.push(
      ["updateActor", Hooks.on("updateActor", onActorUpdate)],
      ["createActor", Hooks.on("createActor", ifFocus)],
      ["deleteActor", Hooks.on("deleteActor", ifFocus)],
      ["updateUser", Hooks.on("updateUser", onUser)],
      ...REFRESH_HOOKS.map((name) => [name, Hooks.on(name, () => this.refresh())])
    );
  }

  /* ---------------------------------------------------------------- actions */

  /** Fixer: sets the level; a click on the current level lowers it by one. */
  static async #onSetStars(event, target) {
    if (!game.user.isGM) return;
    await setLevel(nextStarLevel(Number(target.dataset.level), readWanted().level));
  }

  /** Shift-click: minimize. Click: Pay dialog. */
  static async #onPay(event) {
    if (event.shiftKey) return LeverageHud.#onToggleMinimized();
    const actor = this.focusActor;
    if (actor) await game.leverage.money.payDialog(actor);
  }

  /** Right click: Lend dialog on Money, minus one on the Plot Points number (the owner or the Fixer). */
  async #onContextMenu(event) {
    const actor = this.focusActor;
    if (!actor || !(game.user.isGM || actor.isOwner)) return;
    if (event.target.closest(".lv-hud-money")) {
      event.preventDefault();
      await game.leverage.money.lendDialog(actor);
    } else if (event.target.closest(".lv-hud-pp-value")) {
      event.preventDefault();
      await game.leverage.plotPoints.spend(actor, 1);
    }
  }

  static async #onSpendPlotPoint() {
    const actor = this.focusActor;
    if (actor) await game.leverage.plotPoints.spend(actor, 1);
  }

  /** Fixer only: gives the character 1 Plot Point (the "+" and the number click are not drawn for players). */
  static async #onGainPlotPoint() {
    const actor = this.focusActor;
    if (actor && game.user.isGM) await game.leverage.plotPoints.add(actor, 1);
  }

  /** Fixer: gives or takes 1 Plot Point of a player's character (the "-" and "+" of his list). */
  static async #onStepPlayerPoints(event, target) {
    const actor = game.actors.get(target.dataset.actorId);
    if (!game.user.isGM || !actor) return;
    await game.leverage.plotPoints.add(actor, Number(target.dataset.delta) < 0 ? -1 : 1);
  }

  /** Fixer: steps the table counter. */
  static async #onStepTablePoints(event, target) {
    if (game.user.isGM) await stepTablePlotPoints(Number(target.dataset.delta) < 0 ? -1 : 1);
  }

  /** Fixer: shows or hides the party Money list. */
  static async #onToggleParty() {
    if (game.user.isGM) await game.settings.set(SYSTEM_ID, "hud.showPartyMoney", !readSetting("hud.showPartyMoney", false));
  }

  /** Fixer: folds or unfolds the party Money list. */
  static async #onCollapseParty() {
    await game.settings.set(SYSTEM_ID, "hud.partyCollapsed", !readSetting("hud.partyCollapsed", false));
  }

  static async #onToggleMinimized() {
    await game.settings.set(SYSTEM_ID, "hud.minimized", !readSetting("hud.minimized", false));
  }
}

/**
 * Creates the HUD (once) and renders it. Call from the `ready` hook.
 * @returns {LeverageHud}
 */
export const registerHud = () => LeverageHud.create();
