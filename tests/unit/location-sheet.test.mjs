import test from "node:test";
import assert from "node:assert/strict";

import { moveEntry, traitRows } from "../../module/applications/actor/location-rows.mjs";

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
