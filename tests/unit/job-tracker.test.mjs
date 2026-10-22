import test from "node:test";
import assert from "node:assert/strict";
import { clampedAdd, normalizeJob, renameJob, setJobGoal } from "../../module/applications/gm/job-tracker-logic.mjs";

test("normalizeJob keeps only a string name and goal (old worlds kept lists in the Job)", () => {
  assert.deepEqual(normalizeJob({ name: 5, complications: [{ id: "a", name: "x", die: 8 }], sceneTraits: [] }), { name: "5", goal: "" });
  assert.deepEqual(normalizeJob(undefined), { name: "", goal: "" });
});

test("renameJob and setJobGoal trim, keep the other field and do not mutate", () => {
  const src = { name: "J", goal: "G" };
  assert.deepEqual(renameJob(src, "  New "), { name: "New", goal: "G" });
  assert.deepEqual(setJobGoal(src, "  Ledger "), { name: "J", goal: "Ledger" });
  assert.deepEqual(src, { name: "J", goal: "G" });
});

test("clampedAdd keeps counters in range", () => {
  assert.equal(clampedAdd(3, 1, 3), 3);
  assert.equal(clampedAdd(0, -1), 0);
  assert.equal(clampedAdd(2, 5), 7);
  assert.equal(clampedAdd("x", 1), 1);
});
