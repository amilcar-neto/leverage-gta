import { LEVERAGE } from "../../config.mjs";

const { ArrayField, BooleanField, HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

/**
 * Job Item, one type with two roles. A world Item (the Fixer's Job: name, status, goal, notes, total payout) and an
 * Item embedded in a Crew sheet (the Record of a finished Job, with the per-character fields below).
 * @property {string} status         `planned`, `active` or `done`. Only meaningful for a world Job; a Record ignores it.
 * @property {{total: number, share: number, crew: {actorUuid: string, name: string, share: number}[]}} payout
 *   Money steps the Job paid the Crew / this character. `crew` (world Job only) is the share of each character, saved when the Job ends.
 * @property {boolean} callbackUsed  Callback used this session (GM resets on "New session").
 * @property {boolean} spent         Spent on advancement: no more callbacks, shown struck through.
 * @property {string} goal           What the Crew wanted from the Job (one line, optional; old Jobs have none).
 * @property {string} notes          Client, target, summary (HTML).
 */
export class JobData extends foundry.abstract.TypeDataModel {
  /** @inheritdoc */
  static LOCALIZATION_PREFIXES = ["LEVERAGE.Item.job"];

  /** @inheritdoc */
  static defineSchema() {
    const steps = () => new NumberField({ required: true, integer: true, min: 0, initial: 0 });
    return {
      status: new StringField({ required: true, blank: false, choices: Object.keys(LEVERAGE.jobStatuses), initial: "planned" }),
      goal: new StringField({ required: true, blank: true, initial: "" }),
      payout: new SchemaField({
        total: steps(),
        share: steps(),
        crew: new ArrayField(new SchemaField({
          actorUuid: new StringField({ required: true, blank: true, initial: "" }),
          name: new StringField({ required: true, blank: true, initial: "" }),
          share: steps()
        }))
      }),
      callbackUsed: new BooleanField({ required: true, initial: false }),
      spent: new BooleanField({ required: true, initial: false }),
      notes: new HTMLField({ required: true, blank: true, initial: "" })
    };
  }
}
