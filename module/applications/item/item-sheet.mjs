/**
 * Base class of every Leverage Item sheet (docs/06 "linguagem visual", reference talent-item-window.png).
 * One small window: yellow name band, a type-specific body and a footer with the delete button.
 * Subclasses (type-sheets.mjs) only choose the body template and add their own context.
 * Trait items that belong to an Actor obey the Trait lock; observers only read.
 */
import { LEVERAGE } from "../../config.mjs";
import { canEditTraits, isTraitType } from "../../documents/guards.mjs";

const { HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

/** Hook fired by the `traitsLocked` setting (see module/settings.mjs). */
const LOCK_HOOK = "leverage.traitsLockedChanged";

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
  return !(item.parent && isTraitType(item.type)) || canEditTraits(user);
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

  /** Hook id of the lock listener. */
  #lockHookId = null;

  /** Seal element in the title bar (only for owned Traits). */
  #seal = null;

  /** @override */
  get title() {
    const type = game.i18n.localize(`TYPES.Item.${this.document.type}`);
    const owner = this.document.parent?.name;
    return owner ? game.i18n.format("LEVERAGE.ItemSheet.windowTitle", { type, owner }) : type;
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
    if (this.document.parent && isTraitType(this.document.type)) {
      this.#seal = this.#buildSeal();
      frame.querySelector(".window-title")?.after(this.#seal);
      this.#syncSeal();
    }
    return frame;
  }

  /** @override */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.#lockHookId = Hooks.on(LOCK_HOOK, () => this.#onLockChanged());
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);
    if (this.#lockHookId !== null) Hooks.off(LOCK_HOOK, this.#lockHookId);
    this.#lockHookId = null;
  }

  /** Creates the empty seal: lock icon + label (filled by `#syncSeal`). */
  #buildSeal() {
    const seal = document.createElement("span");
    seal.className = "lv-lock-seal";
    seal.append(Object.assign(document.createElement("i"), { className: "lv-lock-seal-icon" }));
    seal.append(Object.assign(document.createElement("span"), { className: "lv-lock-seal-label" }));
    return seal;
  }

  /** Updates the seal from the current lock state. */
  #syncSeal() {
    if (!this.#seal) return;
    const locked = !canEditTraits(game.user);
    const key = locked ? "locked" : "unlocked";
    this.#seal.classList.toggle("is-locked", locked);
    this.#seal.classList.toggle("is-unlocked", !locked);
    this.#seal.title = game.i18n.localize(`LEVERAGE.Sheet.Seal.${key}Hint`);
    this.#seal.querySelector(".lv-lock-seal-icon").className = `lv-lock-seal-icon fa-solid ${locked ? "fa-lock" : "fa-lock-open"}`;
    this.#seal.querySelector(".lv-lock-seal-label").textContent = game.i18n.localize(`LEVERAGE.Sheet.Seal.${key}`);
  }

  /** The Trait lock changed: refresh seal and fields. */
  #onLockChanged() {
    this.#syncSeal();
    if (this.rendered) this.render();
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

  /** Footer button: confirms, then deletes the Item (the window closes with it). */
  static async #onDelete() {
    if (!this.canEdit || !this.document.isOwner) return;
    const name = foundry.utils.escapeHTML(this.document.name);
    const yes = await DialogV2.confirm({
      window: { title: game.i18n.localize("LEVERAGE.Dialog.deleteTrait.title") },
      content: `<p>${game.i18n.format("LEVERAGE.Dialog.deleteTrait.content", { name })}</p>`,
      rejectClose: false
    });
    if (yes) await this.document.delete();
  }
}
