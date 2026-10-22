/**
 * "Complication" mini dialog of the roll card: name a new Complication or raise one that the active Job already
 * has. Only collects the choice; the caller writes it (card-handlers.mjs).
 */
import { escapeHtml } from "../components/die.mjs";
import { LEVERAGE } from "../../config.mjs";
import { stepUp } from "../../dice/die.mjs";
import { raiseDie } from "../../dice/card-actions.mjs";
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

/** How many steps each mode adds for `count` hitches (`separate` makes plain d6s). */
const stepsOf = (mode, count) => (mode === "new" ? count - 1 : mode === "raise" ? count : 0);

/** The modes that make sense: `raise` needs a Complication, `separate` needs 2+ hitches and is not for a botch (ONE free Complication). */
function availableModes(complications, count, botch) {
  return HITCH_MODES.filter((m) => (m !== "raise" || complications.length) && (m !== "separate" || (count > 1 && !botch)));
}

/** Label of a mode: its name, the steps it adds (none for 0) and the Plot Points it pays (none when free). */
function modeLabel(mode, count, showPP) {
  const steps = stepsOf(mode, count);
  const stepText = steps ? " " + t(`LEVERAGE.Dialog.Hitches.steps${steps === 1 ? "One" : "Many"}`, { steps }) : "";
  const gain = showPP ? (mode === "separate" ? count : 1) : 0;
  return t(`LEVERAGE.Dialog.Hitches.mode.${mode}`, { count }) + stepText + (gain ? t("LEVERAGE.Dialog.Hitches.plotPoints", { pp: gain }) : "");
}

/** `<option>` list of the modes that make sense for `count` hitches and these Complications. */
function modeOptions(complications, count, { botch, showPP }) {
  return availableModes(complications, count, botch).map((m) => `<option value="${m}">${escapeHtml(modeLabel(m, count, showPP))}</option>`).join("");
}

/** `<option>` of an existing Complication with the die it would become (a d12 stays d12 and goes out of the scene). */
function raiseOption(c, count) {
  const { die, overflow } = raiseDie(c.die, count);
  const label = t(overflow ? "LEVERAGE.Dialog.Hitches.raiseOut" : "LEVERAGE.Dialog.Hitches.raise", { name: c.name, from: c.die, to: die });
  return `<option value="${escapeHtml(c.id)}">${escapeHtml(label)}</option>`;
}

/** Dialog body of the hitch dialog. */
function buildHitchContent(complications, count, flags) {
  const targets = complications.map((c) => raiseOption(c, count)).join("");
  const placeholder = escapeHtml(t("LEVERAGE.Dialog.Complication.namePlaceholder"));
  const names = Array.from({ length: count }, (_, i) => `<input type="text" name="names" maxlength="80" placeholder="${placeholder}" aria-label="${escapeHtml(t("LEVERAGE.Dialog.Hitches.nameN", { n: i + 1 }))}">`).join("");
  const title = t(`LEVERAGE.Dialog.Hitches.title${count === 1 ? "One" : "Many"}`, { count });
  return `<div class="lv-dlg">
    <label class="lv-dlg-field"><span>${title}</span><select name="mode">${modeOptions(complications, count, flags)}</select></label>
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
 * @param {{count: number, botch?: boolean, gainsPP?: boolean}} options `count` open hitches; `botch` offers only `new` and `raise`
 *   (one free Complication) and shows no Plot Points; `gainsPP` false (not a Crew) shows no Plot Points either.
 * @returns {Promise<{mode: string, name?: string, id?: string, names?: string[]}|null>} the choice, or null when cancelled
 */
export async function promptHitches(complications, { count, botch = false, gainsPP = true }) {
  const answer = await foundry.applications.api.DialogV2.prompt({
    classes: ["leverage-gta", "lv-dialog"],
    window: { title: t("LEVERAGE.Dialog.Hitches.window") },
    position: { width: 400 },
    rejectClose: false,
    content: buildHitchContent(complications, count, { botch, showPP: gainsPP && !botch }),
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
