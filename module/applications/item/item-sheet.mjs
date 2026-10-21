/**
 * Base class of every Leverage Item sheet (docs/06 "linguagem visual", reference talent-item-window.png).
 * One small window: yellow name band, a type-specific body and a footer with the delete button.
 * Subclasses (type-sheets.mjs) only choose the body template and add their own context.
 * Trait items that belong to an Actor obey the Trait lock; observers only read.
 */
import { LEVERAGE } from "../../config.mjs";
import { canEditTraits, isTraitType } from "../../documents/guards.mjs";
import { deleteWithConfirm } from "../components/confirm-delete.mjs";
import { LockSeal } from "../components/lock-seal.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/** Folder of the Item part templates. */
export const ITEM_TEMPLATES = `systems/${LEVERAGE.systemId}/templates/item`;

/**
 * Whether the Trait lock lets `user` change `item` (the sheet also checks the document permission).
 * Only Traits owned by an Actor are locked.
 * @param {Item} item
 * @param {User} [user]
 * @returns {boolean}
 */
export function passesTraitLock(item, user = game.user) {
  return !(item.parent && isTraitType(item.type)) || canEditTraits(user, item.parent);
}

/** Enriches an HTML field for display. */
function enrich(html, item) {
  return foundry.applications.ux.TextEditor.implementation.enrichHTML(html, { relativeTo: item, secrets: item.isOwner });
}

/**
 * @abstract
 * Shared Item sheet. Each subclass sets `PARTS.body.template` and may override `_prepareTypeContext`.
 */
export class LeverageItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["leverage-gta", "lv-item-sheet"],
    position: { width: 520, height: 520 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      setCost: LeverageItemSheet.#onSetValue("cost", Number),
      setDuration: LeverageItemSheet.#onSetValue("duration", String),
      setDie: LeverageItemSheet.#onSetDie,
      deleteItem: LeverageItemSheet.#onDelete
    }
  };

  /** @override */
  static PARTS = {
    header: { template: `${ITEM_TEMPLATES}/header.hbs` },
    body: { template: `${ITEM_TEMPLATES}/talent.hbs` },
    footer: { template: `${ITEM_TEMPLATES}/footer.hbs` }
  };

  /** Rich-text fields (system keys) that the body shows enriched when read-only. */
  static RICH_FIELDS = [];

  /** Seal in the title bar (mounted only for owned Traits); the lock hook re-renders the fields. */
  #seal = new LockSeal(() => this.document.parent, () => {
    if (this.rendered) this.render();
  });

  /** @override */
  get title() {
    const type = game.i18n.localize(`TYPES.Item.${this.document.type}`);
    const owner = this.document.parent?.name;
    return owner ? game.i18n.format("LEVERAGE.ItemSheet.windowTitle", { type, owner }) : type;
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#styleTitle();
  }

  /** Splits the title into the type (muted capitals) and the owner (lighter, normal case), as in the mockup. */
  #styleTitle() {
    const el = this.element?.querySelector(".window-title");
    const owner = this.document.parent?.name;
    if (!el) return;
    const type = game.i18n.localize(`TYPES.Item.${this.document.type}`);
    const full = this.title;
    const typeEl = Object.assign(document.createElement("span"), { className: "lv-title-type", textContent: type });
    const nodes = [typeEl];
    if (owner) nodes.push(" · ", Object.assign(document.createElement("span"), { className: "lv-title-owner", textContent: owner }));
    el.replaceChildren(...nodes);
    el.title = full;
  }

  /** Whether the current user can edit the fields (permission plus the Trait lock). */
  get canEdit() {
    return this.isEditable && passesTraitLock(this.document);
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.document;
    const canEdit = this.canEdit;
    const type = game.i18n.localize(`TYPES.Item.${item.type}`);
    Object.assign(context, {
      item, system: item.system, source: item.system._source, config: LEVERAGE,
      canEdit, readonly: !canEdit, canDelete: canEdit && item.isOwner,
      deleteLabel: game.i18n.format("LEVERAGE.ItemSheet.delete", { type }),
      enriched: {}
    });
    for (const key of this.constructor.RICH_FIELDS) context.enriched[key] = await enrich(item.system[key], item);
    await this._prepareTypeContext(context);
    return context;
  }

  /**
   * Hook for subclasses: add the data of their body template.
   * @param {object} context
   * @returns {Promise<void>|void}
   */
  _prepareTypeContext(context) { void context; }

  /**
   * Builds the die buttons for a template.
   * @param {number|null} selected Current die.
   * @returns {{faces: number, selected: boolean, muted: boolean, label: string}[]}
   */
  static dieChoices(selected) {
    return LEVERAGE.dice.map((faces) => ({
      faces, selected: faces === selected, muted: faces !== selected,
      label: game.i18n.localize(LEVERAGE.dieStyles[faces].label)
    }));
  }

  /**
   * Builds `selectOptions` choices `{key: label}`.
   * @param {string[]} keys
   * @param {(key: string) => string} labelOf
   * @returns {Record<string, string>}
   */
  static choices(keys, labelOf) {
    return Object.fromEntries(keys.map((key) => [key, labelOf(key)]));
  }

  /**
   * Builds segmented-button entries.
   * @param {[*, string][]} entries `[value, label]` pairs.
   * @param {*} current Current value.
   * @returns {{value: *, label: string, pressed: boolean}[]}
   */
  static segments(entries, current) {
    return entries.map(([value, label]) => ({ value, label, pressed: value === current }));
  }

  /** @override */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    if (this.document.parent && isTraitType(this.document.type)) this.#seal.mount(frame);
    return frame;
  }

  /** @override */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.#seal.watch();
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);
    this.#seal.unwatch();
  }

  /** Builds an action handler that writes `data-value` (converted) to `system.<path>`. */
  static #onSetValue(path, convert) {
    return async function setValue(_event, target) {
      if (!this.canEdit) return;
      const value = convert(target.dataset.value);
      if (this.document.system[path] !== value) await this.document.update({ [`system.${path}`]: value });
    };
  }

  /** Die button: `data-die` on the button or its wrapper; empty clears a nullable die. */
  static async #onSetDie(_event, target) {
    if (!this.canEdit) return;
    const raw = target.closest("[data-die]")?.dataset.die;
    const die = raw ? Number(raw) : null;
    if (this.document.system.die !== die) await this.document.update({ "system.die": die });
  }

  /** Footer button: deletes the Item (asks first for a Job or Signature Asset); the window closes with it. */
  static async #onDelete() {
    if (!this.canEdit || !this.document.isOwner) return;
    await deleteWithConfirm(this.document);
  }
}
