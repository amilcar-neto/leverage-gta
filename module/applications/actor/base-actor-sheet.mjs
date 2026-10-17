/**
 * Base class of every Leverage actor sheet: shared window options, the common context flags
 * (`canEdit`, `canEditTraits`, `isGM`, `locked`) and the Trait-lock seal in the window title bar (docs/06 "Janela").
 */
import { LEVERAGE } from "../../config.mjs";
import { LeverageActor } from "../../documents/actor.mjs";
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

  /** Seal in the title bar; the lock hook re-renders the sheet because every part's permissions depend on it. */
  #seal = new LockSeal(() => {
    if (this.rendered) this.render();
  });

  /** Whether the Trait lock lets the current user add, remove or re-rate Traits (and the sheet is editable). */
  get canEditTraits() {
    return this.isEditable && LeverageActor.canEditTraits(game.user);
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return Object.assign(context, {
      actor: this.actor,
      system: this.actor.system,
      config: LEVERAGE,
      isGM: game.user.isGM,
      locked: LeverageActor.traitsLocked,
      isOwner: this.actor.isOwner,
      canEdit: this.isEditable,
      canEditTraits: this.canEditTraits
    });
  }

  /** @override */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options);
    this.#seal.mount(frame);
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
}
