import { LEVERAGE } from "../../config.mjs";
import { effectiveDie } from "../../dice/opportunity.mjs";
import { DieField } from "../fields.mjs";

const { BooleanField, NumberField, StringField } = foundry.data.fields;

/**
 * Asset Item: a piece of gear or resource that adds a die to the Pool.
 * @property {number} die         Die size (Signature: d8 then d6; Job/Scene: d6).
 * @property {string} duration    `signature`, `job` or `scene`.
 * @property {string} note        One-line note.
 * @property {boolean} weapon     Weapons are lost on Wasted/Busted when `duration` is `scene`.
 * @property {boolean} purchased  Bought with Money (for reports).
 * @property {number} boost       Temporary steps up from Opportunities (docs/08); cleared at the end of the scene.
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
      purchased: new BooleanField({ required: true, initial: false }),
      boost: new NumberField({ required: true, nullable: false, integer: true, min: 0, max: LEVERAGE.dice.length - 1, initial: 0 })
    };
  }

  /** The die the Asset rolls now: `die` stepped up by `boost` (never past d12). @returns {number} */
  get effectiveDie() {
    return effectiveDie(this.die, this.boost);
  }
}
