/**
 * Locations of the Scene being viewed. A Location points at a Scene through `system.scene` (UUID); a Location with a
 * token on the Scene also counts. Pure functions plus two small readers of the Foundry globals (read lazily, so node
 * tests can import this file).
 */
import { LEVERAGE, SYSTEM_ID } from "./config.mjs";
import { isValidDie } from "./dice/die.mjs";
import { cleanEntries } from "./applications/gm/job-tracker-logic.mjs";

/**
 * The Locations of a Scene: those whose `system.scene` is the Scene's UUID, then those with a token on it, no repeats.
 * @param {{uuid: string}|null} scene The Scene being viewed.
 * @param {Iterable<{id: string, type: string, system?: {scene?: string}}>} actors Every Actor of the world.
 * @param {Iterable<{actor?: object|null}>} tokens Tokens of the Scene.
 * @returns {object[]} Location Actors
 */
export function viewedLocations(scene, actors, tokens) {
  if (!scene) return [];
  const linked = [...actors].filter((a) => a?.type === "location" && a.system?.scene === scene.uuid);
  const placed = [...tokens].map((token) => token.actor).filter((a) => a?.type === "location");
  return [...new Map([...linked, ...placed].map((a) => [a.id, a])).values()];
}

/** Lower-case ASCII slug of a name (`Dark Alley!` gives `dark-alley`); never empty. */
export const traitSlug = (name) => String(name ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "trait";

/**
 * Trait dice of Locations as Scene Traits (`{id, name, die}`), as the Pool and the scene strip use them.
 * Blank names and invalid dice are skipped. The id is `<actorId>-<slug of name>-<n>`, `n` being the order among the
 * Location's Traits with the same slug: reordering keeps ids; deleting or renaming a Trait makes its id vanish, so a
 * stale Pool reference resolves to nothing (and is reported as unknown) instead of pointing at another Trait.
 * @param {object[]} locations
 * @param {(die: number) => boolean} isValid Die validator.
 * @returns {{id: string, name: string, die: number}[]}
 */
export function locationTraitEntries(locations, isValid) {
  return locations.flatMap((loc) => {
    const seen = new Map();
    return (loc.system?.traits ?? []).flatMap((t) => {
      const name = String(t.name ?? "").trim();
      if (!name) return [];
      const slug = traitSlug(name);
      const n = seen.get(slug) ?? 0;
      seen.set(slug, n + 1);
      const die = Number(t.die);
      return isValid(die) ? [{ id: `${loc.id}-${slug}-${n}`, name, die }] : [];
    });
  });
}

/**
 * Scene Traits in play: those of the ACTIVE Scene (flag) plus those of the Locations of the VIEWED Scene.
 * (Transitional: the flag Traits go away with task L-06.)
 * @param {object[]} [flagTraits] Traits stored on a Scene flag
 * @param {object[]} locations
 * @param {(die: number) => boolean} isValid
 * @returns {{id: string, name: string, die: number}[]}
 */
export const mergeSceneTraits = (flagTraits, locations, isValid) => [...cleanEntries(flagTraits), ...locationTraitEntries(locations, isValid)];

/** The Scene being viewed by this client. */
export const viewedScene = () => globalThis.canvas?.scene ?? globalThis.game?.scenes?.current ?? null;

/** @returns {object[]} Locations of the viewed Scene (field `scene` plus tokens). */
export function currentViewedLocations() {
  const scene = viewedScene();
  return viewedLocations(scene, globalThis.game?.actors?.contents ?? [], scene?.tokens ?? []);
}

/** @returns {{id: string, name: string, die: number}[]} Every Scene Trait in play now (see `mergeSceneTraits`). */
export function currentSceneTraits() {
  const flag = globalThis.game?.scenes?.active?.getFlag(SYSTEM_ID, LEVERAGE.sceneTraitsFlag);
  return mergeSceneTraits(flag, currentViewedLocations(), isValidDie);
}

/**
 * Tells the open windows (scene strip, Pool menu, opposition roller) that the Locations in view may have changed:
 * a Location was edited, a Location token came or went, or a Scene changed (those hooks are in `gm/scene-traits.mjs`; `canvasReady` is heard by each window). Call once from `ready`.
 */
export function registerSceneLocationHooks() {
  const notify = () => Hooks.callAll(LEVERAGE.hooks.activeJobChanged);
  const isLocation = (actor) => actor?.type === "location";
  const viewedUuid = () => viewedScene()?.uuid ?? null;
  /** True when the Location points at (or has a token on) the viewed Scene. */
  const touchesViewed = (actor) => {
    const uuid = viewedUuid();
    return Boolean(uuid) && (actor.system?.scene === uuid || Boolean(viewedScene()?.tokens?.some((token) => token.actorId === actor.id)));
  };
  // Only the editing client sees the old value in a pre-hook, so a change of the `scene` link always notifies (it is rare).
  Hooks.on("updateActor", (actor, changes) => {
    if (!isLocation(actor)) return;
    const has = (path) => foundry.utils.hasProperty(changes, path);
    if (has("system.scene") || (has("system.traits") && touchesViewed(actor))) notify();
  });
  Hooks.on("createActor", (actor) => isLocation(actor) && actor.system?.scene && touchesViewed(actor) && notify());
  Hooks.on("deleteActor", (actor) => isLocation(actor) && notify());
  Hooks.on("createToken", (token) => isLocation(token.actor) && notify());
  Hooks.on("deleteToken", (token) => isLocation(token.actor) && notify());
}
