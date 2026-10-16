import { LEVERAGE } from "../../config.mjs";
import { DieField } from "../fields.mjs";

const { HTMLField, NumberField, StringField } = foundry.data.fields;

/** Valid `role` values for a Talent: every Role key plus `open`. */
export const TALENT_ROLES = Object.freeze([...Object.keys(LEVERAGE.roles), "open"]);

/**
 * Talent Item: a Role ability. Costs 0 (free) or 1 Plot Point to activate.
 * @property {string} role        Role key or `open`.
 * @property {number} cost        0 or 1.
 * @property {string} activation  One-line "When..." trigger.
 * @property {string} effect      Effect text (HTML).
 * @property {number|null} die    Optional die the effect adds to the Pool.
 */
export class TalentData extends foundry.abstract.TypeDataModel {
  /** @inheritdoc */
  static LOCALIZATION_PREFIXES = ["LEVERAGE.Item.talent"];

  /** @inheritdoc */
  static defineSchema() {
    return {
      role: new StringField({ required: true, blank: false, choices: [...TALENT_ROLES], initial: "open" }),
      cost: new NumberField({ required: true, integer: true, min: 0, max: 1, initial: 0 }),
      activation: new StringField({ required: true, blank: true, initial: "" }),
      effect: new HTMLField({ required: true, blank: true, initial: "" }),
      die: new DieField({ nullable: true, initial: null })
    };
  }
}
