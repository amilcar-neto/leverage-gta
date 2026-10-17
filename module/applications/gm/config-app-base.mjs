/**
 * Shared base of the GM configuration apps (docs/09 menus): a `<form>` window with Save / Cancel / Restore defaults.
 * A subclass keeps its edits in a private draft and implements the hooks below; this class owns the GM check, the
 * validation round trip and the error list. Nothing is written to the settings until Save passes validation.
 */
import { SYSTEM_ID } from "../../config.mjs";
import { t } from "../components/i18n.mjs";

/** Template of the footer part (errors and buttons) that every config app lists in its PARTS. */
export const CONFIG_FOOTER = `systems/${SYSTEM_ID}/templates/gm/config-footer.hbs`;

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * @typedef {object} ConfigResult
 * @property {boolean} ok
 * @property {{key: string, data?: object}[]} errors keys under `LEVERAGE.Config.Error`
 */

/**
 * Base class. Subclasses implement `_captureDraft()`, `_validateDraft()`, `_persist()`, `_resetDraft()`
 * and extend `_prepareContext()`.
 */
export class ConfigAppBase extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    tag: "form",
    classes: ["leverage-gta", "lv-config"],
    window: { resizable: false, contentClasses: ["lv-config-window"] },
    position: { width: 560, height: "auto" },
    form: { handler: ConfigAppBase.#onSubmit, submitOnChange: false, closeOnSubmit: false },
    actions: { restore: ConfigAppBase.#onRestore, cancel: ConfigAppBase.#onCancel }
  };

  /** Errors of the last failed Save, shown above the buttons. @type {{key: string, data?: object}[]} */
  #errors = [];

  /* ------------------------------------------------------------ subclass hooks */

  /** Copies what is typed in the form (text, numbers, checkboxes) into the draft. */
  _captureDraft() {}

  /** @returns {ConfigResult} the strict validation of the draft (plus the data to save). */
  _validateDraft() {
    throw new Error("_validateDraft not implemented");
  }

  /**
   * Writes the validated result to the settings.
   * @param {ConfigResult} _result
   */
  async _persist(_result) {
    throw new Error("_persist not implemented");
  }

  /** Replaces the draft with the system defaults (nothing is saved yet). */
  _resetDraft() {}

  /**
   * Human label of an item named in an error (`data.item`); override to localize ids.
   * @param {string} item
   * @returns {string}
   */
  _itemLabel(item) {
    return item;
  }

  /* ------------------------------------------------------------------ lifecycle */

  /** @override Only the GM edits the configuration. */
  async render(options, _options) {
    if (!game.user.isGM) {
      ui.notifications.warn(t("LEVERAGE.Config.gmOnly"));
      return this;
    }
    return super.render(options, _options);
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.errors = this.#errors.map(({ key, data }) => t(`LEVERAGE.Config.Error.${key}`,
      data?.item ? { ...data, item: this._itemLabel(data.item) } : data));
    return context;
  }

  /* -------------------------------------------------------------------- actions */

  /** Validates the draft and saves it, or shows the errors. */
  async #save() {
    this._captureDraft();
    const result = this._validateDraft();
    this.#errors = result.ok ? [] : result.errors;
    if (!result.ok) return this.render();
    await this._persist(result);
    ui.notifications.info(t("LEVERAGE.Config.saved"));
    return this.close();
  }

  static async #onSubmit() {
    await this.#save();
  }

  static #onRestore() {
    this.#errors = [];
    this._resetDraft();
    return this.render();
  }

  static #onCancel() {
    return this.close();
  }
}
