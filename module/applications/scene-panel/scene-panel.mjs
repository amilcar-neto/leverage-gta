/**
 * Scene strip: a compact public band right under Foundry's scene navigation. It lists the Scene Traits of the ACTIVE
 * Scene (a flag on the Scene) and the Complications of the Job (shared by every scene), plus the Job goal. Everyone
 * sees it; chips open the Job Tracker for the Fixer. Collapsible per client. A frameless `ApplicationV2` appended to
 * `#interface` at the HUD's z-index (over the scene, under windows).
 */
import { LEVERAGE, SYSTEM_ID } from "../../config.mjs";
import { readSetting } from "../../data/fields.mjs";
import { readSceneTraits } from "../gm/scene-traits.mjs";
import { t, tn } from "../components/i18n.mjs";
import { buildScenePanel } from "./scene-panel-logic.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const RENDER_DEBOUNCE_MS = 50;
/** Foundry's scene navigation, which the strip hangs under. */
const NAV_ID = "scene-navigation";
const DIE_SIZE = LEVERAGE.dieGeometry.uses.scenePanel;

/** Hooks that keep the panel current. */
const REFRESH_HOOKS = Object.freeze([LEVERAGE.hooks.activeJobChanged, LEVERAGE.hooks.hudChanged, "canvasReady"]);

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
    const view = buildScenePanel({ job: readSetting("activeJob", {}), sceneTraits: readSceneTraits() });
    const collapsed = Boolean(readSetting("scenePanel.collapsed", false));
    const toggle = t(collapsed ? "LEVERAGE.ScenePanel.expand" : "LEVERAGE.ScenePanel.collapse");
    return {
      ...view, isGM, collapsed, dieSize: DIE_SIZE, toggleLabel: toggle, chipTag: isGM ? "button" : "span",
      show: Boolean(readSetting("scenePanel.show", true)),
      summary: this.#summary(view)
    };
  }

  /** Short counts shown on the collapsed tab. */
  #summary({ counts }) {
    return [
      counts.traits && tn("LEVERAGE.ScenePanel.traitsCount", counts.traits),
      counts.complications && tn("LEVERAGE.ScenePanel.complicationsCount", counts.complications)
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

  /** Writes the strip's corner (under the Foundry scene navigation, same left edge) to CSS variables. */
  updatePosition() {
    const nav = document.getElementById(NAV_ID);
    const rect = nav?.getBoundingClientRect();
    const top = Math.round((rect?.bottom ?? 0) + LEVERAGE.scenePanel.gapPx);
    const left = Math.round(rect?.left ?? 0);
    const root = document.documentElement.style;
    root.setProperty("--lv-scene-panel-top", `${top}px`);
    root.setProperty("--lv-scene-panel-left", `${left}px`);
  }

  /** Watches the scene navigation's size (it grows with the number of scenes and when it expands). */
  #bindHud() {
    const nav = document.getElementById(NAV_ID);
    if (!nav || nav === this.#observed) return;
    this.#observer?.disconnect();
    this.#observed = nav;
    this.#observer = new ResizeObserver(() => this.updatePosition());
    this.#observer.observe(nav);
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
