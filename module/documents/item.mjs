/**
 * LeverageItem: Item document. Suggests the die of a new Signature Asset (docs/02: first d8, next ones d6) and
 * vetoes Trait changes while Traits are locked and a 4th Distinction (docs/03). Returning `false` from the
 * `_pre*` methods cancels the operation (Foundry v14 contract). The GM always passes.
 */
import { LEVERAGE } from "../config.mjs";
import { canEditTraits, checkItemBatch, isTraitType, protectedFieldsChanged, warnBatchFailure, warnUser } from "./guards.mjs";

export class LeverageItem extends Item {
  /** @override */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;
    // Single-item check only; batches are checked up front by LeverageActor#createEmbeddedDocuments.
    if (this.parent instanceof Actor) {
      const check = checkItemBatch(this.parent, [{ type: this.type }], user);
      if (!check.ok) {
        warnBatchFailure(user, check.reason);
        return false;
      }
    }
    this.#suggestSignatureDie(data);
  }

  /** @override */
  async _preUpdate(changes, options, user) {
    const allowed = await super._preUpdate(changes, options, user);
    if (allowed === false) return false;
    if (this.#lockedFor(user)) {
      warnUser(user, "LEVERAGE.Warn.traitsLocked");
      return false;
    }
    if (protectedFieldsChanged(this, changes, user).length) {
      warnUser(user, "LEVERAGE.Warn.fixerOnlyField");
      return false;
    }
  }

  /** @override */
  async _preDelete(options, user) {
    const allowed = await super._preDelete(options, user);
    if (allowed === false) return false;
    if (this.#lockedFor(user)) {
      warnUser(user, "LEVERAGE.Warn.traitsLocked");
      return false;
    }
  }

  /** Whether this owned Trait item is locked against `user`. */
  #lockedFor(user) {
    return this.parent instanceof Actor && isTraitType(this.type) && !canEditTraits(user, this.parent);
  }

  /**
   * Sets the suggested die on an owned Signature Asset, unless the creator already chose one.
   * Limitation: `hasProperty(data, "system.die")` cannot tell a deliberate d6 from a schema default that
   * was already merged into `data`; only creation data that omits `system.die` gets the suggestion.
   */
  #suggestSignatureDie(data) {
    const isSignature = this.type === "asset" && this.system.duration === "signature";
    if (!isSignature || !this.parent || foundry.utils.hasProperty(data, "system.die")) return;
    const owned = this.parent.items.filter((i) => i.type === "asset" && i.system.duration === "signature").length;
    const { first, next } = LEVERAGE.signatureAssetDice;
    this.updateSource({ "system.die": owned === 0 ? first : next });
  }
}
