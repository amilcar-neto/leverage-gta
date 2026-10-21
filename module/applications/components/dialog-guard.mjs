/**
 * Keeps a DialogV2 open while its form is not valid. `DialogV2.prompt` turns a `null` callback result into the
 * action name ("ok"), so a callback cannot refuse: the check has to stop the click before the dialog submits.
 */
import { t } from "./i18n.mjs";

/**
 * Stops the confirm button (click or Enter) while a required text field is blank, and warns the user.
 * Call it from the dialog's `render` hook.
 * @param {foundry.applications.api.DialogV2} dialog
 * @param {string} fieldName `name` of the required text input.
 * @param {string} warnKey i18n key of the warning notification.
 */
export function requireTextField(dialog, fieldName, warnKey) {
  const form = dialog.element.querySelector("form");
  const button = dialog.element.querySelector('button[data-action="ok"]');
  if (!form || !button) return;
  button.addEventListener("click", (event) => {
    const input = form.elements[fieldName];
    if (!input || input.disabled || input.value.trim()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    ui.notifications.warn(t(warnKey));
    input.focus();
  }, true);
}

/** True when a dialog result is a real answer (an object), not the "ok" string DialogV2 puts in for `null`. */
export const isAnswer = (value) => Boolean(value) && typeof value === "object";
