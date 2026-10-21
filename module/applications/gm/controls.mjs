/**
 * "Leverage" group in the scene controls (docs/09 "Controles do mestre"), GM only. Foundry v14 shape: the
 * `getSceneControlButtons` hook receives an object of controls; a control has `tools` keyed by name; a tool with
 * `button: true` acts on click, `toggle: true` flips `active` (docs/research/foundry-v14-essentials.md 2.6).
 * The actions themselves live in `job-actions.mjs` and the setters below, which the API (T-505) re-exports.
 */
import { LOCK_HOOK, SYSTEM_ID } from "../../config.mjs";
import { logger } from "../../logger.mjs";
import { clampStars } from "../../rules/stars.mjs";
import { readWanted } from "../../world-state.mjs";
import { t } from "../components/i18n.mjs";
import * as actions from "./job-actions.mjs";
import { setCity, setLevel } from "./stars-actions.mjs";

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
 * Sets the wanted city and level. Both are stars actions in the serial queue, each with its chat line: leaving for
 * another city (`setCity`) zeroes the level (docs/02), then the level is set in the new city.
 * @param {number} level 0..5
 * @param {string} [city] City id; keeps the current city when omitted.
 * @returns {Promise<boolean>} false when the user is not the GM or the change was refused
 */
export async function setWanted(level, city) {
  if (!actions.requireGM()) return false;
  if (city && city !== readWanted().city && !(await setCity(city)).ok) return false;
  const target = clampStars(level);
  if (target === readWanted().level) return true;
  return (await setLevel(target)).ok;
}

/** Opens the wanted level window (`wanted-dialog.mjs`): level, city and the star actions. */
export async function openWantedDialog() {
  if (!actions.requireGM()) return;
  const mod = await import("./wanted-dialog.mjs");
  return mod.openWantedDialog();
}

/** Runs a window opener; a real error is logged and shown to the Fixer, never swallowed. */
async function openWindow(open) {
  try {
    return await open();
  } catch (err) {
    logger.error("Could not open a Fixer window", err);
    ui.notifications.error(t("LEVERAGE.GM.Warn.openFailed"));
  }
}

/** Opens the opposition roller (loaded on demand). */
export async function openOpposition() {
  if (!actions.requireGM()) return;
  return openWindow(async () => (await import("../../dice/opposition.mjs")).openOppositionRoller());
}

/** Opens the Job Tracker (loaded on demand). */
export async function openTracker() {
  if (!actions.requireGM()) return;
  return openWindow(async () => new (await import("./job-tracker.mjs")).JobTracker().render({ force: true }));
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
    name: CONTROL_NAME, title: "LEVERAGE.GM.Controls.title", icon: "lv-control-logo", order: 100,
    visible: game.user.isGM, activeTool: null, tools: Object.fromEntries(tools.map((tool) => [tool.name, tool]))
  };
}

/** Registers the control group and keeps the lock toggle in step with its setting. Call once from `init`. */
export function registerSceneControls() {
  Hooks.on("getSceneControlButtons", (controls) => {
    if (game.user.isGM) controls[CONTROL_NAME] = buildControl();
  });
  Hooks.on(LOCK_HOOK, () => { if (game.user.isGM) ui.controls?.render(); });
}
