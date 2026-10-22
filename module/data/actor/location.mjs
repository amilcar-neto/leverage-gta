import { traitsField, snapshot } from "../fields.mjs";

const { StringField, HTMLField, ArrayField, DocumentUUIDField } = foundry.data.fields;

/** Data model of the `location` Actor (named places with trait dice such as DARK CORNERS; docs/05). */
export class LocationData extends foundry.abstract.TypeDataModel {
  /** @override */
  static LOCALIZATION_PREFIXES = ["LEVERAGE.Location"];

  /** @override */
  static defineSchema() {
    return {
      traits: traitsField(),
      city: new StringField({ required: true, blank: true, initial: "" }),
      /** UUIDs of the NPCs linked to this place (GM bookkeeping). */
      npcs: new ArrayField(new StringField({ required: true, blank: false })),
      /** UUID of the Scene this place belongs to (empty: none). Its Traits join the scene strip while that Scene is viewed. */
      scene: new DocumentUUIDField({ type: "Scene", required: true, nullable: false, blank: true, initial: "" }),
      notes: new HTMLField({ required: true, blank: true, initial: "" })
    };
  }

  /** @override */
  getRollData() {
    return snapshot(this);
  }
}
