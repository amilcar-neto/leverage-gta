/**
 * Shared guard helpers for the Trait lock and the Distinction cap (docs/04 "Trava", docs/03).
 * Used by LeverageActor and LeverageItem. The GM always passes.
 */
import { LEVERAGE } from "../config.mjs";
import { readSetting } from "../data/fields.mjs";

/**
 * Whether `user` may create/remove/change Traits (GM always; others only when `traitsLocked` is off).
 * @param {User} [user]
 * @returns {boolean}
 */
export function canEditTraits(user = game.user) {
  return Boolean(user?.isGM) || !readSetting("traitsLocked", false);
}

/**
 * Shows a localized warning, only to the user who performed the action.
 * @param {User} user The acting user.
 * @param {string} key i18n key.
 * @param {object} [data] Format data.
 */
export function warnUser(user, key, data) {
  if (game.user?.id !== user?.id) return;
  const i18n = game.i18n;
  ui.notifications?.warn(data ? i18n.format(key, data) : i18n.localize(key));
}

/** Whether an item type is a Trait (locked by `traitsLocked`). */
export function isTraitType(type) {
  return LEVERAGE.traitItemTypes.includes(type);
}

/**
 * Checks a batch of Items about to be created on `actor` against the lock and the Distinction cap.
 * The GM bypasses everything. Counts the whole batch plus the Distinctions already owned.
 * @param {Actor} actor
 * @param {object[]} dataList Item creation data.
 * @param {User} [user]
 * @returns {{ok: boolean, reason?: "locked"|"maxDistinctions"}}
 */
export function checkItemBatch(actor, dataList, user = game.user) {
  if (user?.isGM) return { ok: true };
  if (dataList.some((d) => isTraitType(d.type)) && !canEditTraits(user)) return { ok: false, reason: "locked" };
  const incoming = dataList.filter((d) => d.type === "distinction").length;
  const existing = actor.items.filter((i) => i.type === "distinction").length;
  if (incoming && existing + incoming > LEVERAGE.maxDistinctions) return { ok: false, reason: "maxDistinctions" };
  return { ok: true };
}

/**
 * Warns the acting user about a failed check from {@link checkItemBatch}.
 * @param {User} user
 * @param {"locked"|"maxDistinctions"} reason
 */
export function warnBatchFailure(user, reason) {
  if (reason === "locked") warnUser(user, "LEVERAGE.Warn.traitsLocked");
  else warnUser(user, "LEVERAGE.Warn.maxDistinctions", { max: LEVERAGE.maxDistinctions });
}
