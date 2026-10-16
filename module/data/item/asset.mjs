import { LEVERAGE } from "../../config.mjs";
import { DieField } from "../fields.mjs";

const { BooleanField, StringField } = foundry.data.fields;

/**
 * Asset Item: a piece of gear or resource that adds a die to the Pool.
 * @property {number} die         Die size (Signature: d8 then d6; Job/Scene: d6).
 * @property {string} duration    `signature`, `job` or `scene`.
 * @property {string} note        One-line note.
 * @property {boolean} weapon     Weapons are lost on Wasted/Busted when `duration` is `scene`.
 * @property {boolean} purchased  Bought with Money (for reports).
 */
export class AssetData extends foundry.abstract.TypeDataModel {
  /** @inheritdoc */
  static LOCALIZATION_PREFIXES = ["LEVERAGE.Item.asset"];

  /** @inheritdoc */
  static defineSchema() {
    return {
      die: new DieField({ nullable: false, initial: LEVERAGE.defaultDie }),
      duration: new StringField({
        required: true, blank: false, choices: Object.keys(LEVERAGE.assetDurations), initial: "scene"
      }),
      note: new StringField({ required: true, blank: true, initial: "" }),
      weapon: new BooleanField({ required: true, initial: false }),
      purchased: new BooleanField({ required: true, initial: false })
    };
  }
}
