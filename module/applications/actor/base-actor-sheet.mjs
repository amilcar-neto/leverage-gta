/**
 * Base class of every Leverage actor sheet: shared window options, the common context flags
 * (`canEdit`, `isGM`, `locked`) and the Trait-lock seal in the window title bar (docs/06 "Janela").
 */
import { LEVERAGE } from "../../config.mjs";
import { LeverageActor } from "../../documents/actor.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/** Name of the hook fired by the `traitsLocked` setting (see module/settings.mjs). */
const LOCK_HOOK = "leverage.traitsLockedChanged";

/**
 * @abstract
 * Shared base for the crew, NPC and location sheets.
 */
export class LeverageActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["leverage-gta"],
    window: { resizable: true },
    form: { submitOnChange: true }
  };

  /** Handler registered on the lock hook; kept so it can be removed on close. */
  #lockHookId = null;

  /** Seal element in the title bar (created in `_renderFrame`). */
  #seal = null;

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const user = game.user;
    return Object.assign(context, {
      actor: this.actor,
      system: this.actor.system,
      config: LEVERAGE,
      isGM: user.isGM,
      locked: LeverageActor.traitsLocked,
      isOwner: this.actor.isOwner,
      canEdit: this.isEditable && LeverageActor.canEditTraits(user)
    });
  }

  /** @override */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    this.#seal = this.#buildSeal();
    frame.querySelector(".window-title")?.after(this.#seal);
    this.#syncSeal();
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

  /** Updates icon, label, tooltip and state class from the current setting. */
  #syncSeal() {
    if (!this.#seal) return;
    const locked = LeverageActor.traitsLocked;
    const key = locked ? "locked" : "unlocked";
    this.#seal.classList.toggle("is-locked", locked);
    this.#seal.classList.toggle("is-unlocked", !locked);
    this.#seal.title = game.i18n.localize(`LEVERAGE.Sheet.Seal.${key}Hint`);
    this.#seal.querySelector(".lv-lock-seal-icon").className =
      `lv-lock-seal-icon fa-solid ${locked ? "fa-lock" : "fa-lock-open"}`;
    this.#seal.querySelector(".lv-lock-seal-label").textContent = game.i18n.localize(`LEVERAGE.Sheet.Seal.${key}`);
  }

  /** The Trait lock changed: refresh the seal and redraw (permissions of every part depend on it). */
  #onLockChanged() {
    this.#syncSeal();
    if (this.rendered) this.render();
  }
}
