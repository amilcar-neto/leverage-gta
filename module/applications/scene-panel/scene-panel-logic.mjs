/**
 * Pure logic of the scene strip (a compact public band under the Foundry scene navigation): the Scene Traits of the
 * active Scene and the Complications shared by every scene. No Foundry globals, so node tests can load it.
 */
import { isValidDie } from "../../dice/die.mjs";

/** @returns {{id: string, name: string, die: number}[]} the valid entries of a die list. */
function cleanList(list) {
  return (Array.isArray(list) ? list : [])
    .filter((e) => e && isValidDie(Number(e.die)))
    .map((e) => ({ id: String(e.id ?? e.name), name: String(e.name ?? "").trim(), die: Number(e.die) }));
}

/**
 * Everything the strip draws.
 * @param {object} input
 * @param {object} input.job `activeJob` setting value (Complications and goal).
 * @param {object[]} input.sceneTraits Scene Traits of the active Scene.
 * @returns {{goal: string, sceneTraits: object[], complications: object[], counts: {traits: number, complications: number}, empty: boolean}}
 */
export function buildScenePanel({ job, sceneTraits }) {
  const traits = cleanList(sceneTraits);
  const complications = cleanList(job?.complications);
  const counts = { traits: traits.length, complications: complications.length };
  const goal = String(job?.goal ?? "").trim();
  return { goal, sceneTraits: traits, complications, counts, empty: !(goal || counts.traits || counts.complications) };
}

/** Prefix of the `ref` of a Complication die in the Fixer's opposition roll (see `complicationSources`). */
const COMPLICATION_REF = "job.";

/**
 * Where a Pool die comes from on the scene, for the roll card: a Scene Trait (`scene`) or a Complication
 * (`complication`, a die of the Job added to the Fixer's opposition).
 * @param {{kind?: string, ref?: string}} entry Roll entry (docs/05).
 * @returns {"scene"|"complication"|null}
 */
export function sceneTagOf(entry) {
  if (entry?.kind === "scene") return "scene";
  return String(entry?.ref ?? "").startsWith(COMPLICATION_REF) ? "complication" : null;
}
