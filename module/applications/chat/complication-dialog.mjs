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

/* ------------------------------------------------------------ hitches (Cortex Prime) */

/** Ways to spend the open hitches: `new` (one Complication stepped up), `raise` (one existing), `separate` (one each). */
const HITCH_MODES = ["new", "raise", "separate"];

/** `<option>` list of the modes that make sense for `count` hitches and these Complications. */
function modeOptions(complications, count, free) {
  const raisable = complications.some((c) => stepUp(c.die) !== c.die);
  const pp = (n) => (free ? 0 : n);
  return HITCH_MODES.filter((m) => (m !== "raise" || raisable) && (m !== "separate" || count > 1)).map((m) => {
    const gain = pp(m === "separate" ? count : 1);
    const label = t(`LEVERAGE.Dialog.Hitches.mode.${m}`, { count, steps: Math.max(count - 1, 0) }) + (gain ? t("LEVERAGE.Dialog.Hitches.plotPoints", { pp: gain }) : "");
    return `<option value="${m}">${escapeHtml(label)}</option>`;
  }).join("");
}

/** Dialog body of the hitch dialog. */
function buildHitchContent(complications, count, free) {
  const targets = complications.filter((c) => stepUp(c.die) !== c.die).map((c) => {
    const label = t("LEVERAGE.Dialog.Hitches.raise", { name: c.name, from: c.die, steps: count });
    return `<option value="${escapeHtml(c.id)}">${escapeHtml(label)}</option>`;
  }).join("");
  const placeholder = escapeHtml(t("LEVERAGE.Dialog.Complication.namePlaceholder"));
  const names = Array.from({ length: count }, (_, i) => `<input type="text" name="names" maxlength="80" placeholder="${placeholder}" aria-label="${i + 1}">`).join("");
  return `<div class="lv-dlg">
    <label class="lv-dlg-field"><span>${t("LEVERAGE.Dialog.Hitches.title", { count })}</span><select name="mode">${modeOptions(complications, count, free)}</select></label>
    <label class="lv-dlg-field" data-for="raise" hidden><span>${t("LEVERAGE.Dialog.Complication.target")}</span><select name="target">${targets}</select></label>
    <label class="lv-dlg-field" data-for="new"><span>${t("LEVERAGE.Dialog.Complication.name")}</span><input type="text" name="name" autofocus maxlength="80" placeholder="${placeholder}"></label>
    <div class="lv-dlg-field" data-for="separate" hidden><span>${t("LEVERAGE.Dialog.Complication.name")}</span>${names}</div>
  </div>`;
}

/** Shows only the fields of the chosen mode; hidden inputs are disabled so they are neither validated nor sent. */
function syncHitchFields(form) {
  const mode = form.elements.mode.value;
  form.querySelectorAll("[data-for]").forEach((box) => {
    const show = box.dataset.for === mode;
    box.hidden = !show;
    box.querySelectorAll("input, select").forEach((el) => { el.disabled = !show; });
  });
}

/** Stops the confirm click while a visible name field is blank. */
function guardHitchNames(dialog) {
  const form = dialog.element.querySelector("form");
  const button = dialog.element.querySelector('button[data-action="ok"]');
  button?.addEventListener("click", (event) => {
    const blank = [...form.querySelectorAll("input[type=text]")].find((el) => !el.disabled && !el.value.trim());
    if (!blank) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    ui.notifications.warn(t("LEVERAGE.Dialog.Complication.nameRequired"));
    blank.focus();
  }, true);
}

/** Reads the choice out of the form. */
function readHitchChoice(form) {
  const { mode, target, name } = new foundry.applications.ux.FormDataExtended(form).object;
  if (mode === "raise") return target ? { mode, id: target } : null;
  if (mode === "separate") return { mode, names: [...form.querySelectorAll("input[name=names]")].map((el) => el.value.trim()) };
  return { mode: "new", name: String(name ?? "").trim() };
}

/**
 * Opens the "Activate hitches" dialog: how to spend all the open hitches of a card at once.
 * @param {{id: string, name: string, die: number}[]} complications Complications of the table.
 * @param {{count: number, free?: boolean}} options `count` open hitches; `free` for a botch (no Plot Point is shown).
 * @returns {Promise<{mode: string, name?: string, id?: string, names?: string[]}|null>} the choice, or null when cancelled
 */
export async function promptHitches(complications, { count, free = false }) {
  const answer = await foundry.applications.api.DialogV2.prompt({
    classes: ["leverage-gta", "lv-dialog"],
    window: { title: t("LEVERAGE.Dialog.Hitches.window") },
    position: { width: 400 },
    rejectClose: false,
    content: buildHitchContent(complications, count, free),
    render: (_event, dialog) => {
      const form = dialog.element.querySelector("form");
      form.elements.mode.addEventListener("change", () => syncHitchFields(form));
      syncHitchFields(form);
      guardHitchNames(dialog);
    },
    ok: {
      class: "lv-config-btn lv-config-btn--primary",
      label: t("LEVERAGE.Dialog.Hitches.confirm"),
      callback: (_event, button) => readHitchChoice(button.form)
    }
  });
  return isAnswer(answer) ? answer : null;
}
