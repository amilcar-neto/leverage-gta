/**
 * "Train Up" dialog: lists what unspent Jobs can buy and its cost (docs/01, `trainingCosts` setting).
 * Only returns the choice; parts/assets.mjs marks the Jobs as spent.
 */
import { escapeHtml } from "../components/die.mjs";
import { t } from "../components/i18n.mjs";

const OPTIONS = ["signatureAsset", "specialty", "talent", "attribute", "role"];

/** One radio row; disabled when the actor has too few unspent Jobs. */
function optionRow(key, cost, unspent) {
  const off = cost > unspent;
  const jobs = t(cost === 1 ? "LEVERAGE.Dialog.TrainUp.job" : "LEVERAGE.Dialog.TrainUp.jobs");
  return `<label class="lv-dlg-option${off ? " is-disabled" : ""}">
    <input type="radio" name="option" value="${escapeHtml(key)}"${off ? " disabled" : ""}>
    <span class="lv-dlg-option-name">${t(`LEVERAGE.Dialog.TrainUp.Option.${key}`)}</span>
    <span class="lv-dlg-option-cost">${cost} ${jobs}</span></label>`;
}

/**
 * Opens the dialog.
 * @param {object} options
 * @param {number} options.unspent Unspent Jobs.
 * @param {Record<string, number>} options.costs Cost in Jobs per option key.
 * @returns {Promise<{option: string, cost: number}|null>} the pick, or null when cancelled
 */
export async function promptTrainUp({ unspent, costs }) {
  const rows = OPTIONS.map((key) => optionRow(key, costs[key], unspent)).join("");
  const content = `<div class="lv-dlg"><p class="lv-dlg-hint">${t("LEVERAGE.Dialog.TrainUp.unspent", { n: unspent })}</p>${rows}</div>`;
  return foundry.applications.api.DialogV2.prompt({
    classes: ["leverage-gta", "lv-dialog"],
    window: { title: t("LEVERAGE.Dialog.TrainUp.title") },
    position: { width: 380 },
    rejectClose: false,
    content,
    ok: {
      label: t("LEVERAGE.Dialog.TrainUp.confirm"),
      callback: (_event, button) => {
        const { option } = new foundry.applications.ux.FormDataExtended(button.form).object;
        return option && OPTIONS.includes(option) ? { option, cost: costs[option] } : null;
      }
    }
  });
}
