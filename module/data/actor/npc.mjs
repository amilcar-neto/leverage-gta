import { LEVERAGE } from "../../config.mjs";
import { DieField, attributesField, rolesField, traitsField, deriveRoleRanks, snapshot } from "../fields.mjs";

const { NumberField, SchemaField, StringField, BooleanField, HTMLField } = foundry.data.fields;

/**
 * Data model of the `npc` Actor (GM people: extras, foils, marks, agents; docs/05).
 * Extras use only `traits`; foils/agents may fill attributes and roles (all nullable).
 */
export class NpcData extends foundry.abstract.TypeDataModel {
  /** @override */
  static LOCALIZATION_PREFIXES = ["LEVERAGE.Npc"];

  /** @override */
  static defineSchema() {
    return {
      tier: new StringField({
        required: true, blank: false, initial: "extra", choices: Object.keys(LEVERAGE.npcTiers)
      }),
      traits: traitsField(),
      attributes: attributesField({ nullable: true }),
      roles: rolesField(),
      gang: new SchemaField({
        size: new NumberField({ required: true, integer: true, min: 0, initial: 0 }),
        die: new DieField({ nullable: true })
      }),
      weapon: new SchemaField({ die: new DieField({ nullable: true }) }),
      police: new BooleanField({ required: true, initial: false }),
      notes: new HTMLField({ required: true, blank: true, initial: "" })
    };
  }

  /** @override */
  prepareDerivedData() {
    deriveRoleRanks(this.roles);
  }

  /** @override */
  getRollData() {
    return snapshot(this);
  }
}
