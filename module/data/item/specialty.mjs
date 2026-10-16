import { LEVERAGE } from "../../config.mjs";

const { HTMLField, StringField } = foundry.data.fields;

/**
 * Specialty Item: a focus under a Role. Adds a d6 (`CONFIG.LEVERAGE.specialtyDie`) to the Pool.
 * @property {string} role         Role key.
 * @property {string} description  Optional text (HTML).
 */
export class SpecialtyData extends foundry.abstract.TypeDataModel {
  /** @inheritdoc */
  static LOCALIZATION_PREFIXES = ["LEVERAGE.Item.specialty"];

  /** @inheritdoc */
  static defineSchema() {
    const roles = Object.keys(LEVERAGE.roles);
    return {
      role: new StringField({ required: true, blank: false, choices: roles, initial: roles[0] }),
      description: new HTMLField({ required: true, blank: true, initial: "" })
    };
  }

  /** Die size this Specialty adds to a Pool. */
  get die() {
    return LEVERAGE.specialtyDie;
  }
}
