import test from "node:test";
import assert from "node:assert/strict";
import { clampVital, vestKindUpdate } from "../../module/applications/actor/parts/header.mjs";

test("clampVital keeps the value in 0..max", () => {
  assert.equal(clampVital(5, 10), 5);
  assert.equal(clampVital(-3, 10), 0);
  assert.equal(clampVital(99, 10), 10);
  assert.equal(clampVital(3.9, 10), 3);
  assert.equal(clampVital("abc", 10), 0);
  assert.equal(clampVital(4, 0), 0);
});

test("vestKindUpdate gives a full vest for the kind", () => {
  assert.deepEqual(vestKindUpdate("light"), { "system.vest.kind": "light", "system.vest.value": 4 });
  assert.deepEqual(vestKindUpdate("standard"), { "system.vest.kind": "standard", "system.vest.value": 6 });
  assert.deepEqual(vestKindUpdate("heavy"), { "system.vest.kind": "heavy", "system.vest.value": 10 });
  assert.deepEqual(vestKindUpdate("none"), { "system.vest.kind": "none", "system.vest.value": 0 });
  assert.equal(vestKindUpdate("bogus"), null);
});
