/**
 * Scene Traits live on the ACTIVE Scene, in the flag `flags.leverage-gta.sceneTraits` (a list of `{id, name, die}`).
 * Everybody can read it (public); only the Fixer writes it. Complications are not here: they belong to the Job and are
 * shared by every scene. This file also migrates the Scene Traits older worlds kept inside the `activeJob` setting.
 */
import { LEVERAGE, SYSTEM_ID } from "../../config.mjs";
import { readSetting } from "../../data/fields.mjs";
import { cleanEntries } from "./job-tracker-logic.mjs";

/** @returns {Scene|null} the active Scene (the one every player is on). */
export const activeScene = () => game.scenes?.active ?? null;

/**
 * Scene Traits of a Scene.
 * @param {Scene|null} [scene] defaults to the active Scene
 * @returns {{id: string, name: string, die: number}[]} valid entries only; empty when there is no Scene
 */
export function readSceneTraits(scene = activeScene()) {
  return cleanEntries(scene?.getFlag(SYSTEM_ID, LEVERAGE.sceneTraitsFlag));
}

/**
 * Replaces the Scene Traits of a Scene (GM only; a player's call does nothing).
 * @param {object[]} list
 * @param {Scene|null} [scene] defaults to the active Scene
 * @returns {Promise<boolean>} false when nothing was written
 */
export async function writeSceneTraits(list, scene = activeScene()) {
  if (!scene || !game.user.isGM) return false;
  const next = cleanEntries(list);
  if (JSON.stringify(next) === JSON.stringify(readSceneTraits(scene))) return false;
  await (next.length ? scene.setFlag(SYSTEM_ID, LEVERAGE.sceneTraitsFlag, next) : scene.unsetFlag(SYSTEM_ID, LEVERAGE.sceneTraitsFlag));
  return true;
}

/**
 * Old worlds stored Scene Traits in `activeJob.sceneTraits`. Moves them to the active Scene (when it has none yet) and
 * removes them from the setting. GM only, safe to run on every start.
 * @returns {Promise<boolean>} true when something was migrated
 */
export async function migrateSceneTraits() {
  if (!game.user.isGM) return false;
  const job = readSetting("activeJob", null);
  const old = cleanEntries(job?.sceneTraits);
  if (!job || !Array.isArray(job.sceneTraits)) return false;
  const scene = activeScene();
  if (old.length && !scene) return false;
  if (old.length && !readSceneTraits(scene).length) await writeSceneTraits(old, scene);
  const rest = foundry.utils.deepClone(job);
  delete rest.sceneTraits;
  await game.settings.set(SYSTEM_ID, "activeJob", rest);
  return true;
}

/**
 * Tells the open windows (pool menu, tracker, scene strip) that the Scene Traits changed: when a Scene is activated or
 * its flag changes, the `activeJobChanged` hook fires on every client.
 */
export function registerSceneTraitHooks() {
  Hooks.on("updateScene", (scene, change) => {
    const flagChanged = foundry.utils.hasProperty(change, `flags.${SYSTEM_ID}.${LEVERAGE.sceneTraitsFlag}`)
      || foundry.utils.hasProperty(change, `flags.${SYSTEM_ID}.-=${LEVERAGE.sceneTraitsFlag}`);
    if (flagChanged || "active" in change) Hooks.callAll(LEVERAGE.hooks.activeJobChanged);
  });
  Hooks.on("deleteScene", () => Hooks.callAll(LEVERAGE.hooks.activeJobChanged));
}
