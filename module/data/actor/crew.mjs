import { LEVERAGE } from "../../config.mjs";
import { stepsToDice } from "../../rules/money.mjs";
import { attributesField, rolesField, deriveRoleRanks, snapshot } from "../fields.mjs";

const { NumberField, SchemaField, StringField, HTMLField } = foundry.data.fields;

/** A non-negative integer field. */
const count = (initial = 0, extra = {}) => new NumberField({ required: true, integer: true, min: 0, initial, ...extra });

/**
 * Data model of the `crew` Actor (player character, docs/05).
 * Derived (not meaningfully saved): `life.max`, `roles.*.primary/secondary`, `money.dice`.
 */
export class CrewData extends foundry.abstract.TypeDataModel {
  /** @override */
  static LOCALIZATION_PREFIXES = ["LEVERAGE.Crew"];

  /** @override */
  static defineSchema() {
    const booking = Object.fromEntries(
      ["number", "height", "weight", "age", "eyes", "hair", "build", "marks"]
        .map((key) => [key, new StringField({ required: true, blank: true, initial: "" })])
    );
    const startLife = LEVERAGE.lifeBase + 6;
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
    const vitality = this.attributes.vitality.die ?? 0;
    this.life.max = LEVERAGE.lifeBase + vitality;
    this.life.value = Math.min(this.life.value, this.life.max);
    this.vest.value = Math.min(this.vest.value, this.vest.max);
    deriveRoleRanks(this.roles);
    this.money.dice = stepsToDice(this.money.steps);
  }

  /** @override */
  getRollData() {
    return snapshot(this);
  }
}
