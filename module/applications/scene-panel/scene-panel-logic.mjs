/**
 * Pure logic of the Scene Panel (a persistent strip with the Scene Traits, the Complications and the Traits of the
 * NPCs and places on the scene). No Foundry globals, so node tests can load it.
 */
import { LEVERAGE } from "../../config.mjs";
import { isValidDie } from "../../dice/die.mjs";

/** Actor types whose Traits are shown. */
export const PANEL_ACTOR_TYPES = LEVERAGE.scenePanel.actorTypes;

/** @returns {{id: string, name: string, die: number}[]} the valid entries of a Job list. */
function cleanList(list) {
  return (Array.isArray(list) ? list : [])
    .filter((e) => e && isValidDie(Number(e.die)))
    .map((e) => ({ id: String(e.id ?? e.name), name: String(e.name ?? "").trim(), die: Number(e.die) }));
}

/** @returns {{name: string, die: number}[]} the Traits that have a die, with their names. */
function cleanTraits(traits) {
  return (Array.isArray(traits) ? traits : [])
    .filter((x) => x && isValidDie(Number(x.die)))
    .map((x) => ({ name: String(x.name ?? "").trim(), die: Number(x.die) }));
}

/**
 * Groups the tokens of the scene by actor: one row per actor with a count (a gang of the same NPC is one row).
 * Players never see hidden tokens, nor any actor Traits when the Fixer turned that off.
 * @param {{id: string, actorId?: string, name: string, type: string, hidden?: boolean, traits?: object[]}[]} tokens
 * @param {{isGM: boolean, showActorTraits: boolean}} view
 * @returns {{key: string, name: string, type: string, count: number, hidden: boolean, traits: {name: string, die: number}[]}[]}
 */
export function groupSceneActors(tokens, { isGM, showActorTraits }) {
  if (!isGM && !showActorTraits) return [];
  const rows = new Map();
  for (const token of tokens ?? []) {
    if (!PANEL_ACTOR_TYPES.includes(token.type) || (token.hidden && !isGM)) continue;
    const traits = cleanTraits(token.traits);
    if (!traits.length) continue;
    const key = token.actorId || token.id;
    const row = rows.get(key) ?? { key, name: token.name, type: token.type, count: 0, hidden: true, traits };
    row.count += 1;
    row.hidden = row.hidden && Boolean(token.hidden);
    rows.set(key, row);
  }
  return [...rows.values()];
}

/**
 * Everything the panel draws.
 * @param {object} input
 * @param {object} input.job `activeJob` setting value.
 * @param {object[]} input.tokens See {@link groupSceneActors}.
 * @param {boolean} input.isGM
 * @param {boolean} [input.showActorTraits=true]
 * @returns {{goal: string, sceneTraits: object[], complications: object[], actors: object[], counts: {traits: number, complications: number, actors: number}, empty: boolean}}
 */
export function buildScenePanel({ job, tokens, isGM, showActorTraits = true }) {
  const sceneTraits = cleanList(job?.sceneTraits);
  const complications = cleanList(job?.complications);
  const actors = groupSceneActors(tokens, { isGM, showActorTraits });
  const counts = { traits: sceneTraits.length, complications: complications.length, actors: actors.length };
  const goal = String(job?.goal ?? "").trim();
  return { goal, sceneTraits, complications, actors, counts, empty: !(goal || counts.traits || counts.complications || counts.actors) };
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
