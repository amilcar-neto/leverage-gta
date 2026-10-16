import { traitsField, snapshot } from "../fields.mjs";

const { StringField, HTMLField } = foundry.data.fields;

/** Data model of the `location` Actor (named places with trait dice such as DARK CORNERS; docs/05). */
export class LocationData extends foundry.abstract.TypeDataModel {
  /** @override */
  static LOCALIZATION_PREFIXES = ["LEVERAGE.Location"];

  /** @override */
  static defineSchema() {
    return {
      traits: traitsField(),
      city: new StringField({ required: true, blank: true, initial: "" }),
      notes: new HTMLField({ required: true, blank: true, initial: "" })
    };
  }

  /** @override */
  getRollData() {
    return snapshot(this);
  }
}
