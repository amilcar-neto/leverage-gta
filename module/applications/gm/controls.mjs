/**
 * "Leverage" group in the scene controls (docs/09 "Controles do mestre"), GM only. Foundry v14 shape: the
 * `getSceneControlButtons` hook receives an object of controls; a control has `tools` keyed by name; a tool with
 * `button: true` acts on click, `toggle: true` flips `active` (docs/research/foundry-v14-essentials.md 2.6).
 * The actions themselves live in `job-actions.mjs` and the setters below, which the API (T-505) re-exports.
 */
import { LEVERAGE, SYSTEM_ID } from "../../config.mjs";
import { clampStars } from "../../rules/stars.mjs";
import { escapeHtml } from "../components/die.mjs";
import * as actions from "./job-actions.mjs";

/** @param {string} key @param {object} [data] */
const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

/** Control group name. */
export const CONTROL_NAME = "leverage";

/**
 * Locks or unlocks the Traits for players and tells the table in chat.
 * @param {boolean} locked
 * @returns {Promise<boolean>} false when the user is not the GM
 */
export async function setTraitsLocked(locked) {
  if (!actions.requireGM()) return false;
  await game.settings.set(SYSTEM_ID, "traitsLocked", Boolean(locked));
  await ChatMessage.create({
    content: `<p class="lv-gm-note">${t(locked ? "LEVERAGE.GM.Chat.traitsLocked" : "LEVERAGE.GM.Chat.traitsUnlocked")}</p>`,
    speaker: { alias: t("LEVERAGE.GM.Chat.speaker") }
  });
  return true;
}

/**
 * Sets the wanted level and city.
 * @param {number} level 0..5
 * @param {string} [city] City id; keeps the current city when omitted.
 * @returns {Promise<boolean>} false when the user is not the GM
 */
export async function setWanted(level, city) {
  if (!actions.requireGM()) return false;
  const current = game.settings.get(SYSTEM_ID, "wanted") ?? {};
  await game.settings.set(SYSTEM_ID, "wanted", { ...current, city: city || current.city || LEVERAGE.stars.defaultCity, level: clampStars(level) });
  return true;
}

/** Body of the wanted dialog: star buttons 0..max plus the city select. */
function wantedContent(wanted, scales) {
  const stars = Array.from({ length: LEVERAGE.stars.max + 1 }, (_, n) => `<label class="lv-gm-star">
    <input type="radio" name="level" value="${n}"${n === clampStars(wanted.level) ? " checked" : ""}><span>${n}</span></label>`).join("");
  const cities = scales.map((c) => `<option value="${escapeHtml(c.id)}"${c.id === wanted.city ? " selected" : ""}>${escapeHtml(c.name)}</option>`).join("");
  return `<div class="lv-dlg"><div class="lv-gm-stars" role="radiogroup" aria-label="${escapeHtml(t("LEVERAGE.GM.Dialog.Wanted.level"))}">${stars}</div>
    <label class="lv-dlg-field"><span>${t("LEVERAGE.GM.Dialog.Wanted.city")}</span><select name="city">${cities}</select></label></div>`;
}

/** Popover-like dialog (docked next to the controls) with 0-5 stars and the city. */
export async function openWantedDialog() {
  if (!actions.requireGM()) return;
  const wanted = game.settings.get(SYSTEM_ID, "wanted") ?? {};
  const scales = game.settings.get(SYSTEM_ID, "cityScales") ?? LEVERAGE.defaultCityScales;
  const choice = await foundry.applications.api.DialogV2.prompt({
    classes: ["leverage-gta", "lv-dialog", "lv-gm-wanted"],
    window: { title: t("LEVERAGE.GM.Dialog.Wanted.title") },
    position: { width: 340, left: 90, top: 120 },
    rejectClose: false,
    content: wantedContent(wanted, scales),
    ok: {
      label: t("LEVERAGE.GM.Dialog.Wanted.confirm"),
      callback: (_event, button) => ({ level: Number(button.form.elements.level.value), city: button.form.elements.city.value })
    }
  });
  if (choice) await setWanted(choice.level, choice.city);
}

/** Opens the opposition roller (T-504), or warns when it is not installed yet. */
export async function openOpposition() {
  if (!actions.requireGM()) return;
  try {
    const mod = await import("../../dice/opposition.mjs");
    if (typeof mod.openOppositionRoller === "function") return mod.openOppositionRoller();
  } catch { /* module missing: fall through to the warning */ }
  ui.notifications.warn(t("LEVERAGE.GM.Warn.soon"));
}

/** Opens the Job Tracker (T-703), or warns when it is not installed yet. */
export async function openTracker() {
  if (!actions.requireGM()) return;
  try {
    const mod = await import("./job-tracker.mjs");
    if (mod.JobTracker) return new mod.JobTracker().render({ force: true });
  } catch { /* module missing: fall through to the warning */ }
  ui.notifications.warn(t("LEVERAGE.GM.Warn.soon"));
}

/** Builds a button tool. */
const button = (name, icon, order, onChange) => ({
  name, title: `LEVERAGE.GM.Tool.${name}`, icon, order, button: true, visible: game.user.isGM, onChange: () => onChange()
});

/**
 * Builds the control group (exported for tests).
 * @returns {object} a SceneControl
 */
export function buildControl() {
  const tools = [
    {
      name: "traitsLock", title: "LEVERAGE.GM.Tool.traitsLock", icon: "fa-solid fa-lock", order: 1, toggle: true,
      visible: game.user.isGM, active: Boolean(game.settings.get(SYSTEM_ID, "traitsLocked")),
      onChange: (_event, active) => setTraitsLocked(active)
    },
    button("wanted", "fa-solid fa-star", 2, openWantedDialog),
    button("opposition", "fa-solid fa-dice", 3, openOpposition),
    button("tracker", "fa-solid fa-clipboard-list", 4, openTracker),
    button("endScene", "fa-solid fa-flag-checkered", 5, () => actions.endScene()),
    button("newJob", "fa-solid fa-briefcase", 6, actions.newJobDialog),
    button("endJob", "fa-solid fa-sack-dollar", 7, actions.endJobDialog),
    button("newSession", "fa-solid fa-calendar-plus", 8, () => actions.newSession()),
    button("givePlotPoint", "fa-solid fa-circle-plus", 9, actions.giveEachPlotPointDialog)
  ];
  return {
    name: CONTROL_NAME, title: "LEVERAGE.GM.Controls.title", icon: "fa-solid fa-shield-halved", order: 100,
    visible: game.user.isGM, activeTool: null, tools: Object.fromEntries(tools.map((tool) => [tool.name, tool]))
  };
}

/** Registers the control group and keeps the lock toggle in step with its setting. Call once from `init`. */
export function registerSceneControls() {
  Hooks.on("getSceneControlButtons", (controls) => {
    if (game.user.isGM) controls[CONTROL_NAME] = buildControl();
  });
  Hooks.on("leverage.traitsLockedChanged", () => { if (game.user.isGM) ui.controls?.render(); });
}
