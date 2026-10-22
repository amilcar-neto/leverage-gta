import { test } from "node:test";
import assert from "node:assert/strict";
import { buildScenePanel, sceneTagOf, withDiePicker } from "../../module/applications/scene-panel/scene-panel-logic.mjs";

test("panel: global Traits, Location Traits and Complications, invalid dice dropped", () => {
  const view = buildScenePanel({
    job: {},
    globalTraits: [{ id: "g", name: "Raining", die: 8 }, { id: "bad", name: "bad", die: 7 }],
    placeTraits: [{ id: "p", name: "Dark", die: 6, place: " Docks " }],
    complications: [{ id: "c", name: "Heat", die: 6 }, { id: "x", name: "bad", die: 7 }]
  });
  assert.deepEqual(view.counts, { traits: 2, complications: 1 });
  assert.deepEqual(view.traits.map((x) => [x.name, x.place]), [["Raining", ""], ["Dark", "Docks"]]);
  assert.equal(view.empty, false);
  assert.equal(buildScenePanel({}).empty, true);
});

test("panel: the Job goal is shown and counts as content", () => {
  const view = buildScenePanel({ job: { goal: "  Get the ledger " } });
  assert.equal(view.goal, "Get the ledger");
  assert.equal(view.empty, false);
});

test("die picker opens on one entry only and marks the current die", () => {
  const entries = [{ id: "a", die: 6 }, { id: "b", die: 8 }];
  const out = withDiePicker(entries, "b", [4, 6, 8, 10, 12]);
  assert.equal(out[0].editing, false);
  assert.equal(out[0].choices, undefined);
  assert.equal(out[1].editing, true);
  assert.deepEqual(out[1].choices.filter((c) => c.pressed).map((c) => c.label), ["d8"]);
  assert.equal(withDiePicker(entries, null, [4]).every((e) => !e.editing), true);
});

test("roll card tag: Scene Trait and Complication dice are told apart", () => {
  assert.equal(sceneTagOf({ kind: "scene", ref: "scene.x" }), "scene");
  assert.equal(sceneTagOf({ kind: "opposition", ref: "job.abc" }), "complication");
  assert.equal(sceneTagOf({ kind: "attribute", ref: "attributes.body" }), null);
});
