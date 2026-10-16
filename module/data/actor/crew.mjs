import { LEVERAGE } from "../../config.mjs";
import { maxLife } from "../../rules/combat.mjs";
import { stepsToDice } from "../../rules/money.mjs";
import { deriveRoleRanks } from "../../rules/roles.mjs";
import { attributesField, rolesField, readSetting, snapshot } from "../fields.mjs";

const { NumberField, SchemaField, StringField, HTMLField } = foundry.data.fields;

/** A non-negative integer field. */
const count = (initial = 0, extra = {}) => new NumberField({ required: true, integer: true, min: 0, initial, ...extra });

/**
 * Data model of the `crew` Actor (player character, docs/05).
 * Derived (recomputed on every prepare, never trust the saved value): `life.max`, `vest.max`,
 * `roles.*.primary/secondary`, `money.dice`.
 * Limitation: `life.value` and `vest.value` are clamped to their maximum only in memory (derived); the saved value
 * is untouched, so lowering Vitality or the vest kind does not rewrite the stored current value.
 */
export class CrewData extends foundry.abstract.TypeDataModel {
  /** @override */
  static LOCALIZATION_PREFIXES = ["LEVERAGE.Crew"];

  /** @override */
  static defineSchema() {
    const booking = Object.fromEntries(
      LEVERAGE.bookingFields
        .map((key) => [key, new StringField({ required: true, blank: true, initial: "" })])
    );
    const startLife = maxLife(LEVERAGE.defaultDie);
    return {
      alias: new StringField({ required: true, blank: true, initial: "" }),
      attributes: attributesField(),
      roles: rolesField(),
      // `max` is in the schema only so token bars can track life; prepareDerivedData overwrites it.
      life: new SchemaField({ value: count(startLife), max: count(startLife) }),
      vest: new SchemaField({
        value: count(),
        max: count(),
        kind: new StringField({
          required: true, blank: false, initial: "none", choices: Object.keys(LEVERAGE.vestKinds)
        })
      }),
      plotPoints: new SchemaField({ value: count(LEVERAGE.plotPointsStart) }),
      money: new SchemaField({
        steps: count(LEVERAGE.money.startSteps, { max: LEVERAGE.money.maxSteps })
      }),
      booking: new SchemaField(booking),
      background: new HTMLField({ required: true, blank: true, initial: "" })
    };
  }

  /** @override */
  prepareDerivedData() {
    const base = readSetting("lifeBase", LEVERAGE.lifeBase);
    this.life.max = maxLife(this.attributes.vitality.die, base);
    this.life.value = Math.min(this.life.value, this.life.max);
    // Vest capacity comes from the kind; `max` stays in the schema so token bars can track it.
    this.vest.max = LEVERAGE.vestKinds[this.vest.kind]?.points ?? 0;
    this.vest.value = Math.min(this.vest.value, this.vest.max);
    deriveRoleRanks(this.roles);
    this.money.dice = stepsToDice(this.money.steps);
  }

  /** @override */
  getRollData() {
    return snapshot(this);
  }
}
