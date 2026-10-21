/**
 * Base class of every Leverage actor sheet: shared window options, the common context flags
 * (`canEdit`, `canEditTraits`, `isGM`, `locked`) and the Trait-lock seal in the window title bar (docs/06 "Janela").
 */
import { LEVERAGE } from "../../config.mjs";
import { LockSeal } from "../components/lock-seal.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

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

  /** Whether this sheet wears the Trait-lock seal (NPCs and Locations are not governed by the lock). */
  static HAS_LOCK_SEAL = true;

  /** Seal in the title bar; the lock hook re-renders the sheet because every part's permissions depend on it. */
  #seal = new LockSeal(() => this.actor, () => {
    if (this.rendered) this.render();
  });

  /** Whether the Trait lock lets the current user add, remove or re-rate Traits (and the sheet is editable). */
  get canEditTraits() {
    return this.isEditable && this.actor.canEditTraits(game.user);
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return Object.assign(context, {
      actor: this.actor,
      system: this.actor.system,
      config: LEVERAGE,
      isGM: game.user.isGM,
      locked: this.actor.sheetLocked,
      isOwner: this.actor.isOwner,
      canEdit: this.isEditable,
      canEditTraits: this.canEditTraits
    });
  }

  /** @override */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    if (this.constructor.HAS_LOCK_SEAL) this.#seal.mount(frame);
    return frame;
  }

  /** @override */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    if (this.constructor.HAS_LOCK_SEAL) this.#seal.watch();
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);
    if (this.constructor.HAS_LOCK_SEAL) this.#seal.unwatch();
  }
}
