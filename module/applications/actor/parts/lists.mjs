/**
 * Crew sheet — lists part: Distinctions, Talents and Specialties (docs/06).
 * Handles add / open / delete / change-Role clicks. Pool toggling (`togglePool`) belongs to the tray part.
 * The Trait lock and the 3-Distinction cap are validated server-side (documents/actor.mjs, item.mjs); the
 * warning is shown by those guards. The buttons are also hidden by the templates when the lock applies, and the
 * actions here check it again so a stale button can never write.
 */
import { LEVERAGE } from "../../../config.mjs";
import { deleteWithConfirm } from "../../components/confirm-delete.mjs";
import { openFloatMenu } from "../../components/float-menu.mjs";
import { t } from "../../components/i18n.mjs";
import { itemOf, openItem } from "./shared.mjs";

/**
 * Entries of the "change Role" menu for a Specialty.
 * @param {string[]} roleKeys Role keys, in sheet order.
 * @param {string} current Role the Specialty has now.
 * @returns {{key: string, label: string, current: boolean}[]} `label` is the i18n key.
 */
export function roleMenuEntries(roleKeys, current) {
  return roleKeys.map((key) => ({ key, label: LEVERAGE.roles[key].label, current: key === current }));
}

/** @type {Record<string, Function>} ApplicationV2 `data-action` handlers (called with `this` = the sheet). */
export const actions = {
  /** "+ ADD": creates the item with a default name (`data-type`) and opens its sheet. */
  async addTraitItem(_event, target) {
    if (!this.canEditTraits) return;
    const type = target.dataset.type;
    const [item] = await this.actor.createEmbeddedDocuments("Item", [{ name: t(`LEVERAGE.Sheet.New.${type}`), type }]);
    openItem(item);
  },

  /** Name / note / card: opens the item window. */
  openTraitItem(_event, target) {
    openItem(itemOf(this, target));
  },

  /** X: deletes the item at once (docs/03: only Jobs and Signature Assets ask first). */
  async deleteTraitItem(_event, target) {
    if (!this.canEditTraits) return;
    const item = itemOf(this, target);
    if (item) await deleteWithConfirm(item);
  },

  /** Role tag of a Specialty: opens a small menu to pick another Role. */
  pickSpecialtyRole(_event, target) {
    if (!this.canEditTraits) return;
    const item = itemOf(this, target);
    if (!item) return;
    openFloatMenu(this, {
      anchor: target,
      className: "lv-role-menu",
      itemClass: "lv-role-menu-item",
      items: roleMenuEntries(Object.keys(LEVERAGE.roles), item.system.role).map((entry) => ({
        text: t(entry.label),
        current: entry.current,
        onSelect: async () => {
          if (!entry.current) await item.update({ "system.role": entry.key });
        }
      }))
    });
  }
};

/**
 * Adds the labels and dice the three list templates need.
 * @param {object} context the context being built
 */
export async function prepare(context) {
  context.roleLabels = Object.fromEntries(LEVERAGE.talentRoles.map((key) => [key, `LEVERAGE.Role.${key}`]));
  context.distinctionDice = LEVERAGE.distinctionDice;
}
