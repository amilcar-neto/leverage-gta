const { BooleanField, HTMLField, NumberField, SchemaField, StringField } = foundry.data.fields;

/**
 * Job Item: a completed or ongoing Job in the Crew's history.
 * @property {{total: number, share: number}} payout  Money steps the Job paid the Crew / this character.
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
      goal: new StringField({ required: true, blank: true, initial: "" }),
      payout: new SchemaField({ total: steps(), share: steps() }),
      callbackUsed: new BooleanField({ required: true, initial: false }),
      spent: new BooleanField({ required: true, initial: false }),
      notes: new HTMLField({ required: true, blank: true, initial: "" })
    };
  }
}
