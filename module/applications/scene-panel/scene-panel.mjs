/**
 * Scene strip: a compact public band right under Foundry's scene navigation. It lists the table's global Traits and
 * Complications (state the Fixer keeps, `table-state.mjs`), the Traits of the Locations of the viewed Scene (read
 * only, marked with the Location's name) and the Job goal. Everyone sees it; the Fixer adds, removes and changes the
 * die of global Traits and Complications right in the strip. Collapsible per client. A frameless `ApplicationV2`
 * appended to `#interface` at the HUD's z-index (over the scene, under windows).
 */
import { LEVERAGE, SYSTEM_ID } from "../../config.mjs";
import { readSetting } from "../../data/fields.mjs";
import { readJob } from "../../job-store.mjs";
import { currentLocationTraits } from "../../scene-location.mjs";
import { TABLE_LISTS } from "../../rules/table-entries.mjs";
import { addTableEntry, readComplications, readGlobalTraits, removeTableEntry, setTableEntryDie } from "../../table-state.mjs";
import { t, tn } from "../components/i18n.mjs";
import { buildScenePanel, withDiePicker } from "./scene-panel-logic.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const RENDER_DEBOUNCE_MS = 50;
/** Foundry's scene navigation: the viewed-scene bar and its expand button. The strip sits to the right of both. */
const NAV_IDS = Object.freeze(["scene-navigation-viewed", "scene-navigation-expand"]);
const DIE_SIZE = LEVERAGE.dieGeometry.uses.scenePanel;

/** Hooks that keep the panel current. */
const REFRESH_HOOKS = Object.freeze([LEVERAGE.hooks.activeJobChanged, LEVERAGE.hooks.tableStateChanged, LEVERAGE.hooks.hudChanged, "canvasReady"]);

/** Lists the Fixer can add to from the strip, with the i18n key of the input placeholder. */
const ADD_PLACEHOLDER = Object.freeze({ globalTraits: "LEVERAGE.ScenePanel.newTrait", complications: "LEVERAGE.ScenePanel.newComplication" });

export class ScenePanel extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "leverage-scene-panel",
    tag: "aside",
    classes: ["leverage-gta"],
    window: { frame: false, positioned: false },
    actions: {
      toggleCollapsed: ScenePanel.#onToggle, openTracker: ScenePanel.#onOpenTracker,
      startAdd: ScenePanel.#onStartAdd, confirmAdd: ScenePanel.#onConfirmAdd, cancelAdd: ScenePanel.#onCancelAdd,
      removeEntry: ScenePanel.#onRemove, editDie: ScenePanel.#onEditDie, setDie: ScenePanel.#onSetDie
    }
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
  /** List being added to (`globalTraits` / `complications`) or null. */
  #adding = null;
  /** Id of the entry whose die picker is open, or null. */
  #editing = null;
  /** What the Fixer has typed in the open add row, kept across re-renders. */
  #draft = "";
  /** Whether the add input must take focus after the next render (it just opened, or it had focus before). */
  #focusInput = false;
  #observer = null;
  #observed = null;
  #onResize = () => this.updatePosition();

  /** Re-render with a short debounce (many hooks fire together). */
  refresh = foundry.utils.debounce(() => this.render({ force: true }), RENDER_DEBOUNCE_MS);

  /** @override */
  async _prepareContext() {
    const isGM = game.user.isGM;
    const input = this.element?.querySelector(".lv-sp-add-input");
    if (input) {
      this.#draft = input.value;
      this.#focusInput ||= document.activeElement === input;
    }
    const view = buildScenePanel({
      job: readJob(), globalTraits: readGlobalTraits(), placeTraits: currentLocationTraits(), complications: readComplications()
    });
    view.traits = withDiePicker(view.traits, this.#editing, LEVERAGE.dice);
    view.complications = withDiePicker(view.complications, this.#editing, LEVERAGE.dice);
    const collapsed = Boolean(readSetting("scenePanel.collapsed", false));
    const toggle = t(collapsed ? "LEVERAGE.ScenePanel.expand" : "LEVERAGE.ScenePanel.collapse");
    return {
      ...view, isGM, collapsed, dieSize: DIE_SIZE, toggleLabel: toggle,
      show: Boolean(readSetting("scenePanel.show", true)),
      adding: this.#adding && { list: this.#adding, placeholder: t(ADD_PLACEHOLDER[this.#adding]), draft: this.#draft, isTrait: this.#adding === "globalTraits" },
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
    document.addEventListener("pointerdown", this.#onOutside, true);
  }

  /** @override */
  async _onRender() {
    this.#bindHud();
    this.updatePosition();
    const input = this.element.querySelector(".lv-sp-add-input");
    input?.addEventListener("keydown", (event) => this.#onAddKey(event));
    if (input && this.#focusInput) {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }
    this.#focusInput = false;
  }

  /** Enter confirms the new entry, Escape drops it. */
  #onAddKey(event) {
    if (event.key === "Enter") { event.preventDefault(); this.#confirmAdd(); }
    else if (event.key === "Escape") { event.stopPropagation(); this.#closeAdd(); }
  }

  /** A press outside the open die picker closes it. */
  #onOutside = (event) => {
    if (this.#editing && !event.target.closest?.(".lv-sp-chip.is-editing")) {
      this.#editing = null;
      this.refresh();
    }
  };

  async #confirmAdd() {
    const list = this.#adding;
    const name = this.element.querySelector(".lv-sp-add-input")?.value;
    this.#closeAdd();
    if (list) await addTableEntry(list, name);
  }

  #closeAdd() {
    this.#adding = null;
    this.#draft = "";
    this.#focusInput = false;
    this.render({ force: true });
  }

  /** @override */
  _onClose() {
    this.#observer?.disconnect();
    this.#observer = null;
    this.#observed = null;
    window.removeEventListener("resize", this.#onResize);
    document.removeEventListener("pointerdown", this.#onOutside, true);
    for (const [name, id] of this.#hooks) Hooks.off(name, id);
    this.#hooks = [];
    if (ScenePanel.#instance === this) ScenePanel.#instance = null;
  }

  /** Writes the strip's corner (beside Foundry's scene navigation bar, on its row) to CSS variables. */
  updatePosition() {
    const rects = NAV_IDS.map((id) => document.getElementById(id)?.getBoundingClientRect()).filter((r) => r?.width);
    const bar = rects[0];
    const left = Math.round(Math.max(0, ...rects.map((r) => r.right)) + LEVERAGE.scenePanel.gapPx);
    const root = document.documentElement.style;
    root.setProperty("--lv-scene-panel-top", `${Math.round(bar?.top ?? 16)}px`);
    root.setProperty("--lv-scene-panel-left", `${bar ? left : 16}px`);
  }

  /** Watches the navigation bar and its expand button (they change with the scene name and the number of scenes). */
  #bindHud() {
    const nav = document.getElementById(NAV_IDS[0]);
    if (!nav || nav === this.#observed) return;
    this.#observer?.disconnect();
    this.#observed = nav;
    this.#observer = new ResizeObserver(() => this.updatePosition());
    for (const id of NAV_IDS) { const el = document.getElementById(id); if (el) this.#observer.observe(el); }
  }

  static async #onToggle() {
    await game.settings.set(SYSTEM_ID, "scenePanel.collapsed", !readSetting("scenePanel.collapsed", false));
  }

  static #onStartAdd(event, target) {
    if (!game.user.isGM || !(target.dataset.list in TABLE_LISTS)) return;
    this.#adding = target.dataset.list;
    this.#draft = "";
    this.#focusInput = true;
    this.#editing = null;
    this.render({ force: true });
  }

  static #onConfirmAdd() {
    return this.#confirmAdd();
  }

  static #onCancelAdd() {
    this.#closeAdd();
  }

  /** The list and id of the chip a control sits in. */
  static #entryOf(target) {
    const { list, id } = target.closest("[data-entry]")?.dataset ?? {};
    return list in TABLE_LISTS ? { list, id } : null;
  }

  static #onRemove(event, target) {
    const entry = ScenePanel.#entryOf(target);
    return entry && removeTableEntry(entry.list, entry.id);
  }

  static #onEditDie(event, target) {
    const entry = ScenePanel.#entryOf(target);
    if (!entry || !game.user.isGM) return;
    this.#editing = this.#editing === entry.id ? null : entry.id;
    this.render({ force: true });
  }

  static async #onSetDie(event, target) {
    const entry = ScenePanel.#entryOf(target);
    this.#editing = null;
    if (entry) await setTableEntryDie(entry.list, entry.id, Number(target.dataset.die));
    this.render({ force: true });
  }

  static async #onOpenTracker() {
    if (game.user.isGM) await game.leverage.jobTracker.open();
  }
}

/** Creates the panel (once) and renders it. Call from the `ready` hook. @returns {ScenePanel} */
export const registerScenePanel = () => ScenePanel.create();
