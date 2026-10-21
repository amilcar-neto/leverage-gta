/**
 * Scene Panel: a persistent strip under the HUD that always shows the Scene Traits, the active Complications and the
 * Traits of the NPCs and places whose tokens are on the viewed scene. Everyone sees it (players never see hidden
 * tokens, and the Fixer may hide the actor Traits from players with a world setting). Collapsible per client.
 * A frameless `ApplicationV2` appended to `#interface`, like the HUD; it follows the HUD's position.
 */
import { LEVERAGE, SYSTEM_ID } from "../../config.mjs";
import { readSetting } from "../../data/fields.mjs";
import { t, tn } from "../components/i18n.mjs";
import { buildScenePanel } from "./scene-panel-logic.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const RENDER_DEBOUNCE_MS = 50;
const DIE_SIZE = LEVERAGE.dieGeometry.uses.scenePanel;

/** Hooks that keep the panel current. */
const REFRESH_HOOKS = Object.freeze([
  LEVERAGE.hooks.activeJobChanged, LEVERAGE.hooks.hudChanged, LEVERAGE.hooks.scenePanelChanged,
  "canvasReady", "createToken", "updateToken", "deleteToken", "updateActor", "deleteActor", "updateScene"
]);

/** Plain token data of the viewed scene. */
function sceneTokens() {
  const scene = canvas?.scene ?? game.scenes?.viewed;
  return (scene?.tokens ?? []).map((token) => ({
    id: token.id, actorId: token.actorLink ? token.actorId : token.id, name: token.name,
    type: token.actor?.type, hidden: token.hidden, traits: token.actor?.system?.traits
  }));
}

export class ScenePanel extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "leverage-scene-panel",
    tag: "aside",
    classes: ["leverage-gta"],
    window: { frame: false, positioned: false },
    actions: { toggleCollapsed: ScenePanel.#onToggle, openTracker: ScenePanel.#onOpenTracker }
  };

  /** @override */
  static PARTS = { main: { template: `systems/${SYSTEM_ID}/templates/hud/scene-panel.hbs` } };

  static #instance = null;

  /** @returns {ScenePanel} the one panel, created and rendered once. */
  static create() {
    if (ScenePanel.#instance) return ScenePanel.#instance;
    ScenePanel.#instance = new ScenePanel();
    ScenePanel.#instance.render({ force: true });
    return ScenePanel.#instance;
  }

  #hooks = [];
  #observer = null;
  #observed = null;
  #onResize = () => this.updatePosition();

  /** Re-render with a short debounce (many hooks fire together). */
  refresh = foundry.utils.debounce(() => this.render({ force: true }), RENDER_DEBOUNCE_MS);

  /** @override */
  async _prepareContext() {
    const isGM = game.user.isGM;
    const view = buildScenePanel({
      job: readSetting("activeJob", {}), tokens: sceneTokens(), isGM,
      showActorTraits: Boolean(readSetting("scenePanel.showActorTraits", true))
    });
    const collapsed = Boolean(readSetting("scenePanel.collapsed", false));
    const toggle = t(collapsed ? "LEVERAGE.ScenePanel.expand" : "LEVERAGE.ScenePanel.collapse");
    return {
      ...view, isGM, collapsed, dieSize: DIE_SIZE, toggleLabel: toggle,
      show: Boolean(readSetting("scenePanel.show", true)),
      summary: this.#summary(view),
      emptyText: t("LEVERAGE.ScenePanel.empty"),
      actors: view.actors.map((a) => ({
        ...a, icon: a.type === "location" ? "fa-location-dot" : "fa-user", multiple: a.count > 1,
        hiddenTip: a.hidden ? t("LEVERAGE.ScenePanel.hiddenToPlayers") : ""
      }))
    };
  }

  /** Short counts shown in the header when collapsed. */
  #summary({ goal, counts }) {
    return [
      goal,
      counts.traits && tn("LEVERAGE.ScenePanel.traitsCount", counts.traits),
      counts.complications && tn("LEVERAGE.ScenePanel.complicationsCount", counts.complications),
      counts.actors && tn("LEVERAGE.ScenePanel.actorsCount", counts.actors)
    ].filter(Boolean).join(" · ");
  }

  /** @override */
  _insertElement(element) {
    const existing = document.getElementById(element.id);
    if (existing) existing.replaceWith(element);
    else (document.getElementById("interface") ?? document.body).append(element);
    return element;
  }

  /** @override */
  async _onFirstRender() {
    this.#hooks = REFRESH_HOOKS.map((name) => [name, Hooks.on(name, () => this.refresh())]);
    window.addEventListener("resize", this.#onResize);
  }

  /** @override */
  async _onRender() {
    this.#bindHud();
    this.updatePosition();
  }

  /** @override */
  _onClose() {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#observed = null;
    window.removeEventListener("resize", this.#onResize);
    for (const [name, id] of this.#hooks) Hooks.off(name, id);
    this.#hooks = [];
    if (ScenePanel.#instance === this) ScenePanel.#instance = null;
  }

  /** Writes the top of the panel (the HUD's bottom edge plus a gap) to `--lv-scene-panel-top`. */
  updatePosition() {
    const hud = document.getElementById("leverage-hud");
    const bottom = hud ? hud.getBoundingClientRect().bottom : 0;
    const top = Math.round(Math.max(bottom, 0) + LEVERAGE.scenePanel.gapPx);
    document.documentElement.style.setProperty("--lv-scene-panel-top", `${top}px`);
  }

  /** Watches the HUD's size (it grows and shrinks with the minimize button and the settings). */
  #bindHud() {
    const hud = document.getElementById("leverage-hud");
    if (!hud || hud === this.#observed) return;
    this.#observer?.disconnect();
    this.#observed = hud;
    this.#observer = new ResizeObserver(() => this.updatePosition());
    this.#observer.observe(hud);
  }

  static async #onToggle() {
    await game.settings.set(SYSTEM_ID, "scenePanel.collapsed", !readSetting("scenePanel.collapsed", false));
  }

  static async #onOpenTracker() {
    if (game.user.isGM) await game.leverage.jobTracker.open();
  }
}

/** Creates the panel (once) and renders it. Call from the `ready` hook. @returns {ScenePanel} */
export const registerScenePanel = () => ScenePanel.create();
