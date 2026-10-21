import { test } from "node:test";
import assert from "node:assert/strict";
import { buildScenePanel, sceneTagOf } from "../../module/applications/scene-panel/scene-panel-logic.mjs";

test("panel: Scene Traits come from the scene, Complications from the Job, invalid dice dropped", () => {
  const job = { complications: [{ id: "c", name: "Heat", die: 6 }, { id: "x", name: "bad", die: 7 }], sceneTraits: [{ id: "old", name: "Stale", die: 4 }] };
  const view = buildScenePanel({ job, sceneTraits: [{ id: "s", name: "Dark", die: 8 }] });
  assert.deepEqual(view.counts, { traits: 1, complications: 1 });
  assert.deepEqual(view.sceneTraits.map((x) => x.name), ["Dark"]);
  assert.equal(view.empty, false);
  assert.equal(buildScenePanel({ job: undefined, sceneTraits: undefined }).empty, true);
});

test("roll card tag: Scene Trait and Complication dice are told apart", () => {
  assert.equal(sceneTagOf({ kind: "scene", ref: "scene.x" }), "scene");
  assert.equal(sceneTagOf({ kind: "opposition", ref: "job.abc" }), "complication");
  assert.equal(sceneTagOf({ kind: "attribute", ref: "attributes.body" }), null);
});

test("panel: the Job goal is shown and counts as content", () => {
  const view = buildScenePanel({ job: { goal: "  Get the ledger ", sceneTraits: [], complications: [] }, sceneTraits: [] });
  assert.equal(view.goal, "Get the ledger");
  assert.equal(view.empty, false);
});
