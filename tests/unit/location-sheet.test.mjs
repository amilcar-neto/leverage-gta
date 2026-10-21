import test from "node:test";
import assert from "node:assert/strict";

import { moveEntry, nameSizeClass, presentNpcs, traitRows } from "../../module/applications/actor/location-rows.mjs";

test("moveEntry moves an entry and ignores bad indexes", () => {
  assert.deepEqual(moveEntry(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
  assert.deepEqual(moveEntry(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  assert.deepEqual(moveEntry(["a", "b"], 0, 5), ["a", "b"]);
  assert.deepEqual(moveEntry(["a", "b"], 1, 1), ["a", "b"]);
});

test("traitRows builds one selected rung per Trait", () => {
  const rows = traitRows([{ name: "DARK", die: 8 }]);
  assert.equal(rows[0].ladder.length, 5);
  assert.deepEqual(rows[0].ladder.filter((r) => r.selected).map((r) => r.die), [8]);
  assert.equal(rows[0].ladder.find((r) => r.die === 4).muted, true);
  assert.deepEqual(traitRows(undefined), []);
});

test("nameSizeClass steps long names down", () => {
  assert.equal(nameSizeClass("Warehouse"), "");
  assert.equal(nameSizeClass("Old Harbor Warehouse"), " is-long");
  assert.equal(nameSizeClass("The Old Harbor Warehouse Annex"), " is-longer");
  assert.equal(nameSizeClass(undefined), "");
});

test("presentNpcs lists distinct NPCs of the tokens, skipping the linked and non-NPC ones", () => {
  const npc = (uuid) => ({ baseActor: { uuid, type: "npc" } });
  const tokens = [npc("A.1"), npc("A.1"), npc("A.2"), { baseActor: { uuid: "A.3", type: "crew" } }, { baseActor: null }, npc("A.4")];
  assert.deepEqual(presentNpcs(tokens, ["A.2"]).map((a) => a.uuid), ["A.1", "A.4"]);
  assert.deepEqual(presentNpcs(undefined, undefined), []);
});
