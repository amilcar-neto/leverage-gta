/**
 * Pure rules of the sheet edit lock (docs/06 "Trava"). Each crew sheet has its own lock, kept in the actor flag
 * `sheetUnlocked` (absent = locked). The owner flips it freely, unless the GM turned off the world setting
 * `playersCanUnlock`, which forces every sheet locked. The GM always edits.
 */

/**
 * Whether a sheet's Traits are locked.
 * @param {object} args
 * @param {boolean} args.playersCanUnlock World setting: each player decides for their own sheet.
 * @param {boolean} args.unlocked The sheet's own flag.
 * @returns {boolean}
 */
export function isSheetLocked({ playersCanUnlock, unlocked }) {
  return !playersCanUnlock || !unlocked;
}

/**
 * What the seal shows and whether it can be clicked.
 * @param {object} args
 * @param {boolean} args.locked Whether the sheet is locked ({@link isSheetLocked}).
 * @param {boolean} args.playersCanUnlock World setting.
 * @param {boolean} args.isGM Whether the viewer is the GM (the GM can always unlock).
 * @returns {{locked: boolean, disabled: boolean, icon: string, label: string}} `label` is an i18n key.
 */
export function sealState({ locked, playersCanUnlock, isGM }) {
  const key = locked ? "locked" : "unlocked";
  const forced = !playersCanUnlock && !isGM;
  return {
    locked,
    disabled: forced,
    icon: locked ? "fa-lock" : "fa-lock-open",
    label: `LEVERAGE.Sheet.Seal.${key}`
  };
}
