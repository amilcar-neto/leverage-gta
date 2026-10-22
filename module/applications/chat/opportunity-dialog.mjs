/**
 * "Use an Opportunity" dialog of the Fixer's roll card: the player picks ONE effect, either to step a Complication of
 * the table down or to step one of his Assets up (until the end of the scene). Only collects the choice; the caller
 * sends it to the Fixer (card-handlers.mjs).
 */
import { escapeHtml } from "../components/die.mjs";
import { stepDown } from "../../dice/die.mjs";
import { canBoostAsset, effectiveDie } from "../../dice/opportunity.mjs";
import { t } from "../components/i18n.mjs";
import { isAnswer } from "../components/dialog-guard.mjs";

/**
 * The effects a player can pick now, in dialog order: every Complication to lower, then every Asset to raise.
 * @param {{id: string, name: string, die: number}[]} complications The table's Complications.
 * @param {{id: string, name: string, die: number, boost?: number, duration: string}[]} assets The player's Assets.
 * @returns {{value: string, group: "lower"|"raise", label: string}[]} `value` is `lower:<id>` or `raise:<id>`
 */
export function opportunityOptions(complications, assets) {
  const lower = complications.map((c) => {
    const to = stepDown(c.die);
    const label = t(to === null ? "LEVERAGE.Dialog.Opportunity.lowerGone" : "LEVERAGE.Dialog.Opportunity.lower", { name: c.name, from: c.die, to });
    return { value: `lower:${c.id}`, group: "lower", label };
  });
  const raise = assets.filter(canBoostAsset).map((a) => {
    const from = effectiveDie(a.die, a.boost);
    const label = t("LEVERAGE.Dialog.Opportunity.raise", { name: a.name, from, to: effectiveDie(a.die, (a.boost ?? 0) + 1) });
    return { value: `raise:${a.id}`, group: "raise", label };
  });
  return [...lower, ...raise];
}

/** `<optgroup>` of one kind; nothing when the kind has no option. */
function groupHtml(options, group) {
  const mine = options.filter((o) => o.group === group);
  if (!mine.length) return "";
  const items = mine.map((o) => `<option value="${escapeHtml(o.value)}">${escapeHtml(o.label)}</option>`).join("");
  return `<optgroup label="${escapeHtml(t(`LEVERAGE.Dialog.Opportunity.group.${group}`))}">${items}</optgroup>`;
}

/**
 * Turns the dialog's `<select>` value into a choice.
 * @param {string} value `lower:<id>` or `raise:<id>`
 * @returns {{kind: "lower", id: string}|{kind: "raise", assetId: string}|null}
 */
export function parseChoice(value) {
  const [kind, ...rest] = String(value ?? "").split(":");
  const id = rest.join(":");
  if (!id) return null;
  if (kind === "lower") return { kind, id };
  if (kind === "raise") return { kind, assetId: id };
  return null;
}

/**
 * Opens the dialog.
 * @param {{value: string, group: string, label: string}[]} options From `opportunityOptions` (not empty).
 * @returns {Promise<{kind: "lower", id: string}|{kind: "raise", assetId: string}|null>} the choice, or null when cancelled
 */
export async function promptOpportunity(options) {
  const content = `<div class="lv-dlg"><label class="lv-dlg-field"><span>${escapeHtml(t("LEVERAGE.Dialog.Opportunity.field"))}</span>
    <select name="choice" autofocus>${groupHtml(options, "lower")}${groupHtml(options, "raise")}</select></label></div>`;
  const answer = await foundry.applications.api.DialogV2.prompt({
    classes: ["leverage-gta", "lv-dialog"],
    window: { title: t("LEVERAGE.Dialog.Opportunity.window") },
    position: { width: 420 },
    rejectClose: false,
    content,
    ok: {
      class: "lv-config-btn lv-config-btn--primary",
      label: t("LEVERAGE.Dialog.Opportunity.confirm"),
      callback: (_event, button) => parseChoice(new foundry.applications.ux.FormDataExtended(button.form).object.choice)
    }
  });
  return isAnswer(answer) ? answer : null;
}
