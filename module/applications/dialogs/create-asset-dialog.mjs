/**
 * "New Asset" dialog: name, duration (Signature / Job / Scene with its Plot Point cost) and die.
 * Only collects the choices; the caller checks the Plot Points and creates the Item (parts/assets.mjs).
 */
import { LEVERAGE } from "../../config.mjs";
import { escapeHtml } from "../components/die.mjs";
import { t } from "../components/i18n.mjs";

/** Plot Point cost of an Asset duration (Signature has no PP cost: it is paid in Jobs). */
export function assetCostOf(duration) {
  return LEVERAGE.assetPlotPointCost[duration] ?? 0;
}

/** `<option>` list for the duration select, with the cost in the label. */
function durationOptions(selected) {
  return Object.entries(LEVERAGE.assetDurations).map(([key, def]) => {
    const cost = assetCostOf(key);
    const label = cost ? t("LEVERAGE.Dialog.Asset.durationCost", { name: t(def.label), cost }) : t(def.label);
    return `<option value="${key}"${key === selected ? " selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

/** `<option>` list for the die select. */
function dieOptions(selected) {
  return LEVERAGE.dice.map((d) => `<option value="${d}"${d === selected ? " selected" : ""}>d${d}</option>`).join("");
}

/** Builds the dialog body. */
function buildContent({ plotPoints, duration, die, chooseDie }) {
  const dieField = chooseDie ? `
    <label class="lv-dlg-field"><span>${t("LEVERAGE.Dialog.Asset.die")}</span>
      <select name="die">${dieOptions(die)}</select></label>` : "";
  return `<div class="lv-dlg">
    <label class="lv-dlg-field"><span>${t("LEVERAGE.Dialog.Asset.name")}</span>
      <input type="text" name="name" required autofocus maxlength="80" placeholder="${escapeHtml(t("LEVERAGE.Dialog.Asset.namePlaceholder"))}"></label>
    <label class="lv-dlg-field"><span>${t("LEVERAGE.Dialog.Asset.duration")}</span>
      <select name="duration">${durationOptions(duration)}</select></label>
    ${dieField}
    <p class="lv-dlg-hint">${t("LEVERAGE.Dialog.Asset.plotPoints", { value: plotPoints })}</p>
  </div>`;
}

/**
 * Opens the dialog.
 * @param {object} options
 * @param {number} options.plotPoints Plot Points the actor has now (shown as information).
 * @param {(duration: string) => number} options.suggestDie Die suggested for a duration.
 * @param {boolean} [options.chooseDie] Show the die selector (Fixer only); otherwise the suggested die is used.
 * @returns {Promise<{name: string, duration: string, die: number}|null>} the choices, or null when cancelled
 */
export async function promptCreateAsset({ plotPoints, suggestDie, chooseDie = false }) {
  const duration = "scene";
  const { DialogV2 } = foundry.applications.api;
  return DialogV2.prompt({
    classes: ["leverage-gta", "lv-dialog"],
    window: { title: t("LEVERAGE.Dialog.Asset.title") },
    position: { width: 380 },
    rejectClose: false,
    content: buildContent({ plotPoints, duration, die: suggestDie(duration), chooseDie }),
    render: (_event, dialog) => {
      const form = dialog.element.querySelector("form");
      form.elements.duration.addEventListener("change", () => {
        if (form.elements.die) form.elements.die.value = String(suggestDie(form.elements.duration.value));
      });
    },
    ok: {
      label: t("LEVERAGE.Dialog.Asset.confirm"),
      callback: (_event, button) => {
        const { name, duration: chosen, die } = new foundry.applications.ux.FormDataExtended(button.form).object;
        const trimmed = String(name ?? "").trim();
        if (!trimmed) return null;
        const picked = chooseDie ? Number(die) : suggestDie(chosen);
        return { name: trimmed, duration: chosen, die: picked };
      }
    }
  });
}
