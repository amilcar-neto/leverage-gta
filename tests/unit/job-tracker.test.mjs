import test from "node:test";
import assert from "node:assert/strict";
import { addEntry, clampedAdd, normalizeJob, removeEntry, renameJob, stepEntry } from "../../module/applications/gm/job-tracker-logic.mjs";

let n = 0;
const id = () => `id${++n}`;

test("normalizeJob fills lists and drops invalid entries", () => {
  const job = normalizeJob({ name: 5, complications: [{ id: "a", name: "x", die: 8 }, { id: "b", die: 7 }, null] });
  assert.equal(job.name, "5");
  assert.deepEqual(job.complications, [{ id: "a", name: "x", die: 8 }]);
  assert.deepEqual(job.sceneTraits, []);
  assert.deepEqual(normalizeJob(undefined), { name: "", complications: [], sceneTraits: [] });
});

test("addEntry starts Complications at d6 and ignores empty names", () => {
  const job = addEntry({}, "complications", "  Alarm ", id);
  assert.equal(job.complications[0].name, "Alarm");
  assert.equal(job.complications[0].die, 6);
  assert.equal(addEntry(job, "complications", "  ", id).complications.length, 1);
  assert.equal(addEntry(job, "bogus", "x", id).complications.length, 1);
  assert.equal(addEntry(job, "sceneTraits", "Fog", id).sceneTraits.length, 1);
});

test("stepEntry raises and lowers within d4..d12", () => {
  let job = addEntry({}, "complications", "A", id);
  const cid = job.complications[0].id;
  job = stepEntry(job, "complications", cid, 1);
  assert.equal(job.complications[0].die, 8);
  job = stepEntry(stepEntry(stepEntry(job, "complications", cid, 1), "complications", cid, 1), "complications", cid, 1);
  assert.equal(job.complications[0].die, 12);
  job = stepEntry(job, "complications", cid, -1);
  assert.equal(job.complications[0].die, 10);
  const low = stepEntry({ complications: [{ id: "z", name: "", die: 4 }] }, "complications", "z", -1);
  assert.equal(low.complications[0].die, 4);
});

test("removeEntry and renameJob do not mutate", () => {
  const src = { name: "J", complications: [{ id: "a", name: "x", die: 6 }], sceneTraits: [] };
  assert.deepEqual(removeEntry(src, "complications", "a").complications, []);
  assert.equal(src.complications.length, 1);
  assert.equal(renameJob(src, "  New ").name, "New");
});

test("clampedAdd keeps counters in range", () => {
  assert.equal(clampedAdd(3, 1, 3), 3);
  assert.equal(clampedAdd(0, -1), 0);
  assert.equal(clampedAdd(2, 5), 7);
  assert.equal(clampedAdd("x", 1), 1);
});
