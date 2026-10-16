import { LEVERAGE } from "../../config.mjs";

const { HTMLField, StringField } = foundry.data.fields;

/**
 * Distinction Item: a character trait that helps (d8) or hinders (d4, earns a Plot Point).
 * @property {string} note         One-line "when it helps / when it hinders".
 * @property {string} description  Optional long text (HTML).
 */
export class DistinctionData extends foundry.abstract.TypeDataModel {
  /** @inheritdoc */
  static LOCALIZATION_PREFIXES = ["LEVERAGE.Item.distinction"];

  /** @inheritdoc */
  static defineSchema() {
    return {
      note: new StringField({ required: true, blank: true, initial: "" }),
      description: new HTMLField({ required: true, blank: true, initial: "" })
    };
  }

  /** Dice a Distinction can add to a Pool (docs/01). */
  static get dice() {
    return LEVERAGE.distinctionDice;
  }
}
