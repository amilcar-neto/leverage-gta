/**
 * "Build Pool" window (docs/08): the picker behind the tray's "+ DIE" button. One window per crew sheet, with a tab
 * per kind of die (Attributes, Roles, Distinctions, Specialties, Assets, Talents, Wallet, Scene Traits, loose
 * dice), a search box, one clickable chip per option (name + die, marked when it is already in the Pool) and a
 * live preview of the Pool. It owns no rules: everything the Pool does goes through the `source` the sheet gives.
 */
import { SYSTEM_ID, LEVERAGE } from "../../config.mjs";
import { t } from "../components/i18n.mjs";
import { HEIGHT, WIDTH, placeBeside } from "./pool-builder-layout.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Tab that shows every group. */
const ALL = "all";

/** Open window per sheet. */
const open = new WeakMap();

/**
 * @typedef {object} PoolBuilderSource What the window needs from the sheet (all calls are cheap and synchronous).
 * @property {() => {key: string, entries: import("../../dice/pool.mjs").PoolMenuEntry[]}[]} groups Options, pooled ones marked.
 * @property {() => object} tray Tray context (`trayContext`): `optional`, `attribute`, `role`, `count`, `keep`, `canRoll`, `rollTitle`.
 * @property {(ref: string) => void} pick Puts the option in the Pool, or takes it out.
 * @property {(ref: string) => void} remove Takes a preview chip out of the Pool.
 * @property {() => void} clear Empties the Pool.
 * @property {() => void} roll Announces the Pool.
 */

/**
 * Template data of one option chip.
 * @param {import("../../dice/pool.mjs").PoolMenuEntry} entry
 * @returns {object}
 */
export function optionOf(entry) {
  const name = entry.kind === "die" ? t("LEVERAGE.Sheet.Tray.kind.die") : entry.labelKey ? t(entry.label) : entry.label;
  return {
    ref: entry.ref, name, die: entry.die, kind: entry.kind, pooled: Boolean(entry.pooled), money: entry.kind === "money",
    search: name.toLocaleLowerCase(), title: `${name} (d${entry.die})`
  };
}

/**
 * Sections and tabs of the window.
 * @param {{key: string, entries: object[]}[]} groups
 * @param {string} tab Active tab key.
 * @returns {{tabs: object[], sections: object[], tab: string}}
 */
export function buildSections(groups, tab) {
  const sections = groups.map(({ key, entries }) => ({
    key, label: t(`LEVERAGE.Sheet.Tray.menuGroup.${key}`), options: entries.map(optionOf),
    count: entries.length, inPool: entries.filter((e) => e.pooled).length
  }));
  const active = tab === ALL || sections.some((s) => s.key === tab) ? tab : ALL;
  const tabs = [{ key: ALL, label: t("LEVERAGE.Sheet.Tray.builder.all"), count: sections.reduce((n, s) => n + s.count, 0), active: active === ALL }]
    .concat(sections.map((s) => ({ key: s.key, label: s.label, count: s.count, inPool: s.inPool, active: active === s.key })));
  return { tabs, tab: active, sections: sections.filter((s) => active === ALL || s.key === active) };
}

/** The Pool builder window. */
export class PoolBuilder extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["leverage-gta", "lv-config", "lv-pool-builder"],
    tag: "div",
    window: { title: "LEVERAGE.Sheet.Tray.builder.title", icon: "fa-solid fa-dice", resizable: true, contentClasses: ["lv-config-window"] },
    position: { width: WIDTH, height: HEIGHT },
    actions: {
      pick: PoolBuilder.#onPick, setTab: PoolBuilder.#onSetTab, unpick: PoolBuilder.#onUnpick,
      clear: PoolBuilder.#onClear, roll: PoolBuilder.#onRoll, done: PoolBuilder.#onDone
    }
  };

  /** @override */
  static PARTS = { body: { template: `systems/${SYSTEM_ID}/templates/dialogs/pool-builder.hbs` } };

  /** @type {PoolBuilderSource} */
  #source;
  #tab = ALL;
  #query = "";

  /**
   * @param {PoolBuilderSource} source
   * @param {object} [options] ApplicationV2 options.
   */
  constructor(source, options = {}) {
    super(options);
    this.#source = source;
  }

  /** @override */
  async _prepareContext() {
    const { tabs, sections, tab } = buildSections(this.#source.groups(), this.#tab);
    this.#tab = tab;
    const tray = this.#source.tray();
    const preview = [tray.attribute, tray.role, ...tray.optional].filter(Boolean);
    return {
      tabs, sections, query: this.#query, preview, previewDie: LEVERAGE.dieGeometry.uses.poolBuilderPreview,
      chipDie: LEVERAGE.dieGeometry.uses.poolBuilderChip, canRoll: tray.canRoll, rollTitle: tray.rollTitle,
      countText: t("LEVERAGE.Sheet.Tray.count", { count: tray.count, keep: tray.keep })
    };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const search = this.element.querySelector(".lv-pb-search");
    search.addEventListener("input", () => {
      this.#query = search.value;
      this.#applyFilter();
    });
    this.#applyFilter();
  }

  /** Hides the options that do not match the search, and the sections left empty. No render, so typing keeps focus. */
  #applyFilter() {
    const needle = this.#query.trim().toLocaleLowerCase();
    let shown = 0;
    for (const section of this.element.querySelectorAll(".lv-pb-section")) {
      let visible = 0;
      for (const chip of section.querySelectorAll(".lv-pb-chip")) {
        const hit = !needle || chip.dataset.search.includes(needle) || section.dataset.label.toLocaleLowerCase().includes(needle);
        chip.hidden = !hit;
        if (hit) visible += 1;
      }
      section.hidden = visible === 0;
      shown += visible;
    }
    this.element.querySelector(".lv-pb-none").hidden = shown > 0;
  }

  static #onPick(_event, target) {
    this.#source.pick(target.dataset.ref);
  }

  static #onSetTab(_event, target) {
    this.#tab = target.dataset.tab;
    return this.render();
  }

  static #onUnpick(_event, target) {
    this.#source.remove(target.dataset.ref);
  }

  static #onClear() {
    this.#source.clear();
  }

  static #onRoll() {
    this.#source.roll();
  }

  static #onDone() {
    return this.close();
  }
}

/**
 * Opens the window of a sheet (or brings the open one to the front), next to the sheet.
 * @param {ApplicationV2} sheet The crew sheet.
 * @param {PoolBuilderSource} source
 * @returns {Promise<PoolBuilder>}
 */
export async function openPoolBuilder(sheet, source) {
  const existing = open.get(sheet);
  if (existing?.rendered) {
    existing.bringToFront();
    return existing;
  }
  const box = sheet.element.getBoundingClientRect();
  const position = placeBeside(box, { width: window.innerWidth, height: window.innerHeight });
  const app = new PoolBuilder(source, { id: `leverage-pool-builder-${sheet.actor.id}`, position });
  open.set(sheet, app);
  const closed = app.close.bind(app);
  app.close = async (options) => {
    if (open.get(sheet) === app) open.delete(sheet);
    return closed(options);
  };
  await app.render({ force: true });
  return app;
}

/** Re-renders the window of `sheet` after the Pool changed (no-op when none is open). */
export function refreshPoolBuilder(sheet) {
  const app = open.get(sheet);
  return app?.rendered ? app.render() : undefined;
}

/** Closes the window of `sheet` (no-op when none is open). */
export function closePoolBuilder(sheet) {
  const app = open.get(sheet);
  open.delete(sheet);
  return app?.rendered ? app.close() : undefined;
}
