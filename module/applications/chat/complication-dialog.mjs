/**
 * "Complication" mini dialog of the roll card: name a new Complication or raise one that the active Job already
 * has. Only collects the choice; the caller writes it (card-handlers.mjs).
 */
import { escapeHtml } from "../components/die.mjs";
import { LEVERAGE } from "../../config.mjs";
import { stepUp } from "../../dice/die.mjs";
import { t } from "../components/i18n.mjs";
import { isAnswer, requireTextField } from "../components/dialog-guard.mjs";

/** `<option>` list: a new Complication first, then each existing one with the die it would become. */
function targetOptions(complications) {
  // A Complication already at the top die cannot go higher: it is not offered.
  const existing = complications.filter((c) => stepUp(c.die) !== c.die).map((c) => {
    const label = t("LEVERAGE.Dialog.Complication.raise", { name: c.name, from: c.die, to: stepUp(c.die) });
    return `<option value="${escapeHtml(c.id)}">${escapeHtml(label)}</option>`;
  });
  return [`<option value="">${escapeHtml(t("LEVERAGE.Dialog.Complication.createNew", { die: LEVERAGE.complicationDie }))}</option>`, ...existing].join("");
}

/** Dialog body. */
function buildContent(complications) {
  const picker = complications.length
    ? `<label class="lv-dlg-field"><span>${t("LEVERAGE.Dialog.Complication.target")}</span>
        <select name="target">${targetOptions(complications)}</select></label>` : "";
  return `<div class="lv-dlg">${picker}
    <label class="lv-dlg-field"><span>${t("LEVERAGE.Dialog.Complication.name")}</span>
      <input type="text" name="name" autofocus maxlength="80" placeholder="${escapeHtml(t("LEVERAGE.Dialog.Complication.namePlaceholder"))}"></label>
  </div>`;
}

/**
 * Opens the dialog.
 * @param {{id: string, name: string, die: number}[]} complications Complications of the table.
 * @returns {Promise<{id: string|null, name: string}|null>} the choice, or null when cancelled / nothing valid chosen
 */
export async function promptComplication(complications) {
  const answer = await foundry.applications.api.DialogV2.prompt({
    classes: ["leverage-gta", "lv-dialog"],
    window: { title: t("LEVERAGE.Dialog.Complication.title") },
    position: { width: 380 },
    rejectClose: false,
    content: buildContent(complications),
    render: (_event, dialog) => {
      const { elements } = dialog.element.querySelector("form");
      const sync = () => { if (elements.target) elements.name.disabled = Boolean(elements.target.value); };
      elements.target?.addEventListener("change", sync);
      requireTextField(dialog, "name", "LEVERAGE.Dialog.Complication.nameRequired");
    },
    ok: {
      class: "lv-config-btn lv-config-btn--primary",
      label: t("LEVERAGE.Dialog.Complication.confirm"),
      callback: (_event, button) => {
        const { target, name } = new foundry.applications.ux.FormDataExtended(button.form).object;
        if (target) return { id: target, name: "" };
        const trimmed = String(name ?? "").trim();
        return trimmed ? { id: null, name: trimmed } : null;
      }
    }
  });
  return isAnswer(answer) ? answer : null;
}
