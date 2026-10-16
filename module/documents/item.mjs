/**
 * LeverageItem: Item document. Suggests the die of a new Signature Asset (docs/02: first d8, next ones d6).
 */
import { LEVERAGE } from "../config.mjs";

export class LeverageItem extends Item {
  /** @override */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;
    this.#suggestSignatureDie(data);
  }

  /** Sets the suggested die on an owned Signature Asset, unless the creator already chose one. */
  #suggestSignatureDie(data) {
    const isSignature = this.type === "asset" && this.system.duration === "signature";
    if (!isSignature || !this.parent || foundry.utils.hasProperty(data, "system.die")) return;
    const owned = this.parent.items.filter((i) => i.type === "asset" && i.system.duration === "signature").length;
    const { first, next } = LEVERAGE.signatureAssetDice;
    this.updateSource({ "system.die": owned === 0 ? first : next });
  }
}
