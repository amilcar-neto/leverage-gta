/**
 * The five Item sheets. Each one picks its body template (templates/item/<type>.hbs) and prepares the data of
 * that body; everything else (frame, name band, footer, lock, delete) is in LeverageItemSheet.
 */
import { LEVERAGE } from "../../config.mjs";
import { ITEM_TEMPLATES, LeverageItemSheet } from "./item-sheet.mjs";
import { withoutProtectedFields } from "./protected-fields.mjs";

/** PARTS of a type: shared header and footer, own body. */
const partsFor = (type) => ({
  header: { template: `${ITEM_TEMPLATES}/header.hbs` },
  body: { template: `${ITEM_TEMPLATES}/${type}.hbs` },
  footer: { template: `${ITEM_TEMPLATES}/footer.hbs` }
});

/**
 * Mixin for the sheets of Items with Fixer-only fields: tells the template (`canEditProtected`) and drops the fields
 * from a player's form submission, so a console-edited form cannot sneak them in.
 * @param {typeof LeverageItemSheet} Base
 */
const withProtectedFields = (Base) => class extends Base {
  /** @override */
  _prepareTypeContext(context) {
    context.canEditProtected = context.canEdit && game.user.isGM;
    return super._prepareTypeContext(context);
  }

  /** @override */
  _processFormData(event, form, formData) {
    return withoutProtectedFields(this.document.type, super._processFormData(event, form, formData), game.user.isGM);
  }
};

const roleLabel = (key) => game.i18n.localize(`LEVERAGE.Role.${key}`);
const t = (key) => game.i18n.localize(key);

/** Distinction: name, note, rich description. */
export class DistinctionSheet extends LeverageItemSheet {
  /** @override */
  static PARTS = partsFor("distinction");

  /** @override */
  static DEFAULT_OPTIONS = { classes: ["distinction-sheet"], position: { width: 520, height: 440 } };

  /** @override */
  static RICH_FIELDS = ["description"];
}

/** Talent: Role, cost (free / 1 Plot Point), activation, rich effect, optional die. */
export class TalentSheet extends LeverageItemSheet {
  /** @override */
  static PARTS = partsFor("talent");

  /** @override */
  static DEFAULT_OPTIONS = { classes: ["talent-sheet"] };

  /** @override */
  static RICH_FIELDS = ["effect"];

  /** @override */
  _prepareTypeContext(context) {
    const { system } = context;
    context.roleChoices = LeverageItemSheet.choices(LEVERAGE.talentRoles, roleLabel);
    context.costs = LeverageItemSheet.segments(
      [[0, t("LEVERAGE.ItemSheet.free")], [1, t("LEVERAGE.ItemSheet.onePP")]], system.cost
    );
    context.dieChoices = LeverageItemSheet.dieChoices(system.die);
    context.noDie = { selected: system.die === null, label: t("LEVERAGE.ItemSheet.noDie") };
  }
}

/** Specialty: Role and description. */
export class SpecialtySheet extends LeverageItemSheet {
  /** @override */
  static PARTS = partsFor("specialty");

  /** @override */
  static DEFAULT_OPTIONS = { classes: ["specialty-sheet"], position: { width: 520, height: 420 } };

  /** @override */
  static RICH_FIELDS = ["description"];

  /** @override */
  _prepareTypeContext(context) {
    context.roleChoices = LeverageItemSheet.choices(Object.keys(LEVERAGE.roles), roleLabel);
  }
}

/** Asset: die, duration, note, weapon and purchased flags. */
export class AssetSheet extends withProtectedFields(LeverageItemSheet) {
  /** @override */
  static PARTS = partsFor("asset");

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["asset-sheet"], position: { width: 520, height: "auto" },
    // The die and the duration are buttons, not form fields: the base actions are wrapped to refuse a player.
    actions: { setDuration: AssetSheet.#guarded("setDuration"), setDie: AssetSheet.#guarded("setDie") }
  };

  /** Wraps a base action so only the Fixer may run it. */
  static #guarded(name) {
    return function guardedAction(event, target) {
      if (!game.user.isGM) return undefined;
      return LeverageItemSheet.DEFAULT_OPTIONS.actions[name].call(this, event, target);
    };
  }

  /** @override */
  _prepareTypeContext(context) {
    super._prepareTypeContext(context);
    const { system } = context;
    context.dieChoices = LeverageItemSheet.dieChoices(system.die);
    context.durations = LeverageItemSheet.segments(
      Object.entries(LEVERAGE.assetDurations).map(([key, def]) => [key, t(def.label)]), system.duration
    );
  }
}

/**
 * Job. Embedded in a Crew sheet it is the Record (payout, callback and spent flags, rich notes). A world Job, the
 * Fixer's own, shows status, goal, notes and the total payout instead.
 */
export class JobSheet extends withProtectedFields(LeverageItemSheet) {
  /** @override */
  static PARTS = partsFor("job");

  /** @override */
  static DEFAULT_OPTIONS = { classes: ["job-sheet"], position: { width: 520, height: 580 } };

  /** @override */
  static RICH_FIELDS = ["notes"];

  /** @override */
  _prepareTypeContext(context) {
    super._prepareTypeContext(context);
    context.isRecord = this.document.isEmbedded;
    context.statusChoices = LeverageItemSheet.choices(Object.keys(LEVERAGE.jobStatuses), (key) => t(LEVERAGE.jobStatuses[key].label));
  }
}
