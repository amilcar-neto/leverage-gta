/**
 * Location sheet: name, image, city (for the stars), a list of Trait dice that feeds the opposition roller
 * (`locationSources`) and notes. Only the GM edits; everyone else with access reads (docs/06 "Fichas de NPC e Local").
 */
import { LEVERAGE } from "../../config.mjs";
import { getCityScales } from "../../settings.mjs";
import { LeverageActorSheet } from "./base-actor-sheet.mjs";
import { moveEntry, traitRows } from "./location-rows.mjs";

const TEMPLATES = `systems/${LEVERAGE.systemId}/templates/actor/location`;
const part = (name, extra = {}) => ({ template: `${TEMPLATES}/${name}.hbs`, ...extra });

export class LocationSheet extends LeverageActorSheet {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["location-sheet"],
    position: { width: 640, height: 640 },
    window: { icon: "fa-solid fa-location-dot" },
    actions: {
      pickImage: LocationSheet.#pickImage,
      addTrait: LocationSheet.#addTrait,
      deleteTrait: LocationSheet.#deleteTrait,
      setTraitDie: LocationSheet.#setTraitDie
    }
  };

  /** @override */
  static PARTS = {
    header: part("header"),
    traits: part("traits"),
    notes: part("notes")
  };

  /** Index of the Trait being dragged. */
  #dragIndex = null;

  /** Focus the last name input after the next render (set by "+ ADD"). */
  #focusLast = false;

  /** Aborted when the sheet closes. */
  #abort = null;

  /** Only the GM edits a Location. */
  get canManage() {
    return this.isEditable && game.user.isGM;
  }

  /** @override */
  get title() {
    return this.actor.name.toLocaleUpperCase(game.i18n.lang);
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const { actor, system } = context;
    const scales = getCityScales();
    const cities = scales.map((c) => ({ id: c.id, name: game.i18n.localize(c.name), selected: c.id === system.city }));
    const current = cities.find((c) => c.selected);
    const TextEditor = foundry.applications.ux.TextEditor.implementation;
    return Object.assign(context, {
      canManage: this.canManage,
      hasImage: Boolean(actor.img) && !actor.img.includes("mystery-man"),
      cities,
      cityName: current?.name ?? "",
      noCitySelected: !current,
      traits: traitRows(system.traits),
      notesField: system.schema.fields.notes,
      notesHtml: await TextEditor.enrichHTML(system.notes, { relativeTo: actor, secrets: actor.isOwner })
    });
  }

  /** @override */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.#abort = new AbortController();
    const { signal } = this.#abort;
    const el = this.element;
    el.addEventListener("change", (event) => this.#onChange(event), { signal });
    el.addEventListener("dragstart", (event) => this.#onDragStart(event), { signal });
    el.addEventListener("dragover", (event) => this.#onDragOver(event), { signal });
    el.addEventListener("dragleave", () => this.#clearMarks(), { signal });
    el.addEventListener("dragend", () => this.#clearMarks(), { signal });
    el.addEventListener("drop", (event) => this.#onDropRow(event), { signal });
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);
    this.#abort?.abort();
    this.#abort = null;
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    if (!this.#focusLast) return;
    this.#focusLast = false;
    const inputs = this.element.querySelectorAll("input[data-trait-name]");
    inputs[inputs.length - 1]?.focus();
  }

  /** Writes the whole Trait list (the array is replaced, so order and removals are exact). */
  #writeTraits(traits) {
    return this.actor.update({ "system.traits": traits });
  }

  /** A copy of the stored Traits as plain objects. */
  #traits() {
    return this.actor.system.traits.map((t) => ({ name: t.name, die: t.die }));
  }

  /** Name edits of a Trait row (the inputs have no `name`, so the form does not submit them). */
  #onChange(event) {
    const input = event.target.closest?.("input[data-trait-name]");
    if (!input || !this.canManage) return;
    const traits = this.#traits();
    const index = Number(input.dataset.index);
    if (!traits[index] || traits[index].name === input.value) return;
    traits[index].name = input.value;
    return this.#writeTraits(traits);
  }

  /** Starts dragging a Trait row. */
  #onDragStart(event) {
    const row = event.target.closest?.(".lv-loc-trait");
    if (!row || !this.canManage) return;
    this.#dragIndex = Number(row.dataset.index);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(this.#dragIndex));
  }

  #onDragOver(event) {
    const row = event.target.closest?.(".lv-loc-trait");
    if (!row || this.#dragIndex === null) return;
    event.preventDefault();
    this.#clearMarks();
    row.classList.add("is-drop");
  }

  #clearMarks() {
    this.element.querySelectorAll(".lv-loc-trait.is-drop").forEach((row) => row.classList.remove("is-drop"));
  }

  /** Drops a Trait row on another row: it takes that position. */
  #onDropRow(event) {
    const row = event.target.closest?.(".lv-loc-trait");
    const from = this.#dragIndex;
    this.#dragIndex = null;
    this.#clearMarks();
    if (!row || from === null || !this.canManage) return;
    event.preventDefault();
    const to = Number(row.dataset.index);
    if (from !== to) return this.#writeTraits(moveEntry(this.#traits(), from, to));
  }

  /** Image click: Foundry FilePicker. */
  static #pickImage() {
    if (!this.canManage) return;
    const picker = new foundry.applications.apps.FilePicker.implementation({
      type: "image", current: this.actor.img, callback: (path) => this.actor.update({ img: path })
    });
    return picker.render({ force: true });
  }

  /** "+ ADD": a blank Trait at the default die. */
  static #addTrait() {
    if (!this.canManage) return;
    this.#focusLast = true;
    return this.#writeTraits([...this.#traits(), { name: "", die: LEVERAGE.defaultDie }]);
  }

  /** X on a row. */
  static #deleteTrait(event, target) {
    if (!this.canManage) return;
    const index = Number(target.closest("[data-index]")?.dataset.index);
    return this.#writeTraits(this.#traits().filter((_, i) => i !== index));
  }

  /** A die of the row ladder. */
  static #setTraitDie(event, target) {
    if (!this.canManage) return;
    const index = Number(target.closest("[data-index]")?.dataset.index);
    const die = Number(target.dataset.die);
    const traits = this.#traits();
    if (!traits[index] || !LEVERAGE.dice.includes(die) || traits[index].die === die) return;
    traits[index].die = die;
    return this.#writeTraits(traits);
  }
}
