import { test } from "node:test";
import assert from "node:assert/strict";
import { buildScenePanel, groupSceneActors, sceneTagOf } from "../../module/applications/scene-panel/scene-panel-logic.mjs";

const traits = [{ name: "Armed", die: 8 }, { name: "no die", die: null }];
const tokens = [
  { id: "t1", actorId: "a1", name: "Thug", type: "npc", traits },
  { id: "t2", actorId: "a1", name: "Thug", type: "npc", traits },
  { id: "t3", actorId: "a2", name: "Boss", type: "npc", hidden: true, traits },
  { id: "t4", actorId: "a3", name: "Crew", type: "crew", traits },
  { id: "t5", actorId: "a4", name: "Docks", type: "location", traits: [] }
];

test("actors: one row per actor with a count, only NPCs and places with valid Trait dice", () => {
  const rows = groupSceneActors(tokens, { isGM: true, showActorTraits: true });
  assert.deepEqual(rows.map((r) => [r.name, r.count, r.hidden]), [["Thug", 2, false], ["Boss", 1, true]]);
  assert.deepEqual(rows[0].traits, [{ name: "Armed", die: 8 }]);
});

test("actors: players do not see hidden tokens, or anything when the Fixer turned it off", () => {
  assert.deepEqual(groupSceneActors(tokens, { isGM: false, showActorTraits: true }).map((r) => r.name), ["Thug"]);
  assert.deepEqual(groupSceneActors(tokens, { isGM: false, showActorTraits: false }), []);
  assert.equal(groupSceneActors(tokens, { isGM: true, showActorTraits: false }).length, 2);
});

test("panel: counts, invalid dice dropped, empty flag", () => {
  const job = { complications: [{ id: "c", name: "Heat", die: 6 }, { id: "x", name: "bad", die: 7 }], sceneTraits: [{ id: "s", name: "Dark", die: 8 }] };
  const view = buildScenePanel({ job, tokens: [], isGM: false });
  assert.deepEqual(view.counts, { traits: 1, complications: 1, actors: 0 });
  assert.equal(view.empty, false);
  assert.equal(buildScenePanel({ job: undefined, tokens: undefined, isGM: false }).empty, true);
});

test("roll card tag: Scene Trait and Complication dice are told apart", () => {
  assert.equal(sceneTagOf({ kind: "scene", ref: "scene.x" }), "scene");
  assert.equal(sceneTagOf({ kind: "opposition", ref: "job.abc" }), "complication");
  assert.equal(sceneTagOf({ kind: "attribute", ref: "attributes.body" }), null);
});
