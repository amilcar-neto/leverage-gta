/**
 * Crew (player character) sheet: one page, nine PARTS laid out in three columns (docs/06).
 * T-301 builds the structure only; the interactions come from T-302..T-306.
 */
import { LEVERAGE } from "../../config.mjs";
import { LeverageActorSheet } from "./base-actor-sheet.mjs";
import { drag, partActions, preparePartContexts } from "./parts/_module.mjs";

const TEMPLATES = `systems/${LEVERAGE.systemId}/templates/actor/crew`;

/** A part definition for the template `<name>.hbs`. */
const part = (name, extra = {}) => ({ template: `${TEMPLATES}/${name}.hbs`, ...extra });

/**
 * Which parts live in which body column, top to bottom. Foundry v14 has no `PARTS[].container` (that is a dnd5e
 * extension), so `#groupColumns` wraps the rendered parts itself.
 */
const COLUMNS = Object.freeze({
  left: ["attributes", "roles"],
  middle: ["distinctions", "talents", "specialties"],
  right: ["assets", "folder"]
});

/** Simple item list for a part, sorted like the sidebar. */
const itemsOf = (actor, type) => actor.itemTypes[type].slice().sort((a, b) => a.sort - b.sort);

export class CrewSheet extends LeverageActorSheet {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["crew-sheet"],
    actions: partActions,
    position: { width: 1180, height: 950 },
    window: { icon: "fa-solid fa-hexagon" }
  };

  /** @override */
  static PARTS = {
    header: part("header"),
    attributes: part("attributes"),
    roles: part("roles"),
    distinctions: part("distinctions"),
    talents: part("talents", { scrollable: [".lv-scroll"] }),
    specialties: part("specialties"),
    assets: part("assets", { scrollable: [".lv-scroll"] }),
    folder: part("folder", { scrollable: [".lv-scroll"] }),
    tray: part("tray")
  };

  /** Window title: only the character name, in capitals (docs/06 "Janela"). */
  get title() {
    return this.actor.name.toLocaleUpperCase(game.i18n.lang);
  }

  /** `data-pool-ref` of the element the pointer last went down on (tells which die of a row is being dragged). */
  #dragOrigin = null;

  /** @override */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.element.addEventListener("pointerdown", (event) => {
      this.#dragOrigin = event.target.closest?.("[data-pool-ref]")?.dataset.poolRef ?? null;
    });
    const clear = () => drag.clearDropMarks(this.element);
    this.element.addEventListener("dragleave", (event) => {
      if (!this.element.contains(event.relatedTarget)) clear();
    });
    this.element.addEventListener("dragend", clear);
  }

  /** Anyone who can see the sheet may drag a Trait to the hotbar; dropping needs edit permission (core default). */
  _canDragStart() {
    return true;
  }

  /** @override */
  _onDragStart(event) {
    drag.startDrag(event, this.actor, event.currentTarget, this.#dragOrigin);
  }

  /** @override */
  _onDragOver(event) {
    if (this.isEditable) drag.markDrop(this.element, event, this.actor);
  }

  /** @override */
  async _onDrop(event) {
    drag.clearDropMarks(this.element);
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    if (data?.type !== "Item") return super._onDrop(event);
    return drag.dropItem(this.actor, event, data);
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#groupColumns();
  }

  /** Wraps the body parts in their three column elements (idempotent; runs after every render). */
  #groupColumns() {
    const content = this.element.querySelector(".window-content");
    const tray = content.querySelector('[data-application-part="tray"]');
    for (const [name, partIds] of Object.entries(COLUMNS)) {
      let column = content.querySelector(`:scope > .lv-col--${name}`);
      if (!column) {
        column = Object.assign(document.createElement("div"), { className: `lv-col lv-col--${name}` });
        if (tray) tray.before(column);
        else content.append(column);
      }
      for (const id of partIds) {
        const el = content.querySelector(`[data-application-part="${id}"]`);
        if (el && el.parentElement !== column) column.append(el);
      }
    }
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const { actor, system } = context;
    const jobs = itemsOf(actor, "job");
    const hasPhoto = Boolean(actor.img) && !actor.img.includes("mystery-man");
    Object.assign(context, {
      hasPhoto,
      distinctions: itemsOf(actor, "distinction"),
      maxDistinctions: LEVERAGE.maxDistinctions,
      talents: itemsOf(actor, "talent"),
      specialties: itemsOf(actor, "specialty"),
      assets: itemsOf(actor, "asset"),
      jobs,
      jobsUnspent: jobs.filter((job) => !job.system.spent).length,
      booking: LEVERAGE.bookingFields.map((key) => ({
        key, label: `LEVERAGE.Crew.FIELDS.booking.${key}.label`, value: system.booking[key]
      })),
      vestLabel: LEVERAGE.vestKinds[system.vest.kind]?.label,
      background: await foundry.applications.ux.TextEditor.implementation.enrichHTML(system.background, {
        relativeTo: actor, secrets: actor.isOwner
      }),
      pool: { count: 0, keep: LEVERAGE.keepDefault }
    });
    await preparePartContexts(context, this);
    return context;
  }
}
