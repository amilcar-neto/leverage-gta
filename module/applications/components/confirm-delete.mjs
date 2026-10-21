/**
 * Delete with confirmation. docs/03: only Jobs and Signature Assets ask first; every other Item goes away at once.
 * One dialog (`LEVERAGE.Dialog.Delete.*`) for the sheet X buttons and the Item sheet footer.
 */
import { escapeHtml } from "./die.mjs";
import { t } from "./i18n.mjs";

/**
 * Whether deleting `item` must be confirmed.
 * @param {{type: string, system?: {duration?: string}}} item
 * @returns {boolean}
 */
export function needsDeleteConfirm(item) {
  return item.type === "job" || (item.type === "asset" && item.system?.duration === "signature");
}

/**
 * Deletes `item`, asking first when {@link needsDeleteConfirm}.
 * @param {Item} item
 * @returns {Promise<boolean>} true when the Item was deleted.
 */
export async function deleteWithConfirm(item) {
  if (needsDeleteConfirm(item)) {
    const yes = await foundry.applications.api.DialogV2.confirm({
      classes: ["leverage-gta", "lv-dialog"],
      window: { title: t("LEVERAGE.Dialog.Delete.title") },
      content: `<p>${t("LEVERAGE.Dialog.Delete.body", { name: escapeHtml(item.name) })}</p>`,
      rejectClose: false
    });
    if (!yes) return false;
  }
  await item.delete();
  return true;
}
