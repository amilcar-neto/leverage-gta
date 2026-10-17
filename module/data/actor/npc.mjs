import { LEVERAGE } from "../../config.mjs";
import { deriveRoleRanks } from "../../rules/roles.mjs";
import { maxLife } from "../../rules/combat.mjs";
import { DieField, readSetting, attributesField, rolesField, traitsField, snapshot } from "../fields.mjs";

const { NumberField, SchemaField, StringField, BooleanField, HTMLField } = foundry.data.fields;

/** A non-negative integer field. */
const count = (initial = 0) => new NumberField({ required: true, integer: true, min: 0, initial });

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
      // Life/Vest for token bars (docs/02). `life.max` is derived from Vitality when the NPC has one; otherwise
      // the saved max is used (the GM sets it). `vest.max` always comes from the kind.
      life: new SchemaField({ value: count(maxLife(LEVERAGE.defaultDie)), max: count(maxLife(LEVERAGE.defaultDie)) }),
      vest: new SchemaField({
        value: count(),
        max: count(),
        kind: new StringField({
          required: true, blank: false, initial: "none", choices: Object.keys(LEVERAGE.vestKinds)
        })
      }),
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
    const vitality = this.attributes?.vitality?.die;
    if (vitality) this.life.max = maxLife(vitality, readSetting("lifeBase", LEVERAGE.lifeBase));
    this.life.value = Math.min(this.life.value, this.life.max);
    this.vest.max = LEVERAGE.vestKinds[this.vest.kind]?.points ?? 0;
    this.vest.value = Math.min(this.vest.value, this.vest.max);
  }

  /** @override */
  getRollData() {
    return snapshot(this);
  }
}
