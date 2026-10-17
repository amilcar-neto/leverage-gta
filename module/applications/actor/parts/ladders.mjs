/**
 * Crew sheet — ladders part (Attributes and Roles): rows of five clickable dice, d4..d12.
 * The pure helpers (`nextDie`, `buildRows`) take no Foundry globals so they can be unit tested.
 */
import { LEVERAGE } from "../../../config.mjs";
import { t } from "../../components/i18n.mjs";

/** Which groups may be blank (docs/05: Roles yes, Attributes never). */
const BLANKABLE = Object.freeze({ attributes: false, roles: true });

/**
 * The value a click on a ladder die should write.
 * @param {"attributes"|"roles"} group
 * @param {number|null} current the trait's current die (null = blank Role)
 * @param {number} clicked the die that was clicked
 * @returns {number|null|undefined} new die, `null` to clear a Role, `undefined` when nothing changes
 */
export function nextDie(group, current, clicked) {
  if (!LEVERAGE.dice.includes(clicked)) return undefined;
  if (clicked === current) return BLANKABLE[group] ? null : undefined;
  return clicked;
}

/**
 * Builds the template rows of one group.
 * @param {object} args
 * @param {"attributes"|"roles"} args.group
 * @param {Record<string, {die: number|null}>} args.values the actor's `system[group]`
 * @param {boolean} args.canEdit whether the dice are clickable
 * @param {boolean} args.locked whether the Trait lock is on (changes the tooltip)
 * @param {(key: string, data?: object) => string} args.t translate function (i18n key, format data)
 * @returns {object[]} rows: key, label, desc, die, blank, poolRef, nameTitle, ladder[]
 */
export function buildRows({ group, values, canEdit, locked, t }) {
  const defs = LEVERAGE[group];
  const kind = group === "attributes" ? "Attributes" : "Roles";
  return Object.keys(defs).map((key) => {
    const die = values[key]?.die ?? null;
    const label = t(defs[key].label);
    const desc = t(`LEVERAGE.Sheet.${kind}.${key}`);
    const lockTip = locked ? t("LEVERAGE.Sheet.Ladders.locked") : "";
    const blankTip = die === null ? `${desc}\n${t("LEVERAGE.Sheet.Ladders.blankHint")}` : desc;
    const ladder = LEVERAGE.dice.map((d) => ({
      die: d,
      muted: d !== die,
      action: canEdit ? "setDie" : undefined,
      pressed: d === die,
      label: t("LEVERAGE.Sheet.Ladders.dieLabel", { trait: label, die: d }),
      title: lockTip || `d${d}`
    }));
    return {
      key, group, label, die, blank: die === null, ladder, nameTitle: blankTip,
      poolRef: `${group}.${key}`
    };
  });
}

/** @type {Record<string, Function>} ApplicationV2 `data-action` handlers (called with `this` = the sheet). */
export const actions = {
  /** Click on a ladder die: writes the new value (or clears a Role) through actor.update. */
  async setDie(_event, target) {
    if (!this.canEditTraits) return;
    const row = target.closest("[data-key]");
    const group = row?.dataset.group;
    if (!(group in BLANKABLE)) return;
    const key = row.dataset.key;
    const clicked = Number(target.dataset.die);
    const next = nextDie(group, this.document.system[group][key]?.die ?? null, clicked);
    if (next === undefined) return;
    await this.document.update({ [`system.${group}.${key}.die`]: next });
  }
};

/**
 * Replaces the context's `attributes` and `roles` rows with the ladder rows used by the templates.
 * @param {object} context the context being built
 * @param {object} sheet the CrewSheet
 */
export async function prepare(context, sheet) {
  const { canEditTraits, locked } = context;
  for (const group of ["attributes", "roles"]) {
    context[group] = buildRows({ group, values: sheet.document.system[group], canEdit: canEditTraits, locked, t });
  }
}
