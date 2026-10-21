import "./helpers/foundry-stub.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { emptyJob, freshJob, jobAfterScene, evenSplit, toSteps, jobItemData, assetIdsOf, usedCallbackIds } from "../../module/applications/gm/job-actions.mjs";

test("freshJob drops Complications and scene Traits and trims the name", () => {
  assert.deepEqual(freshJob("  Bank  "), { name: "Bank", complications: [], sceneTraits: [] });
  assert.equal(freshJob(null).name, "");
});

test("jobAfterScene clears scene Traits only when the field exists", () => {
  const job = { name: "A", complications: [{ id: "1", name: "x", die: 6 }], sceneTraits: [{ name: "Dark" }] };
  assert.deepEqual(jobAfterScene(job).sceneTraits, []);
  assert.equal(jobAfterScene(job).complications.length, 1);
  assert.equal("sceneTraits" in jobAfterScene({ name: "B", complications: [] }), false);
  assert.deepEqual(jobAfterScene(undefined), emptyJob());
});

test("evenSplit shares the total and gives the remainder to the first characters", () => {
  assert.deepEqual(evenSplit(7, 3), [3, 2, 2]);
  assert.deepEqual(evenSplit(6, 3), [2, 2, 2]);
  assert.deepEqual(evenSplit(5, 0), []);
  assert.deepEqual(evenSplit(-4, 2), [0, 0]);
  assert.equal(evenSplit(11, 4).reduce((a, b) => a + b, 0), 11);
});

test("toSteps and jobItemData sanitise numbers", () => {
  assert.equal(toSteps("3.9"), 3);
  assert.equal(toSteps(-2), 0);
  assert.equal(toSteps("x"), 0);
  assert.deepEqual(jobItemData("Heist", 6, "2"), { name: "Heist", type: "job", system: { payout: { total: 6, share: 2 } } });
});

test("assetIdsOf and usedCallbackIds pick the right Items", () => {
  const items = [
    { id: "a", type: "asset", system: { duration: "scene" } },
    { id: "b", type: "asset", system: { duration: "job" } },
    { id: "c", type: "asset", system: { duration: "signature" } },
    { id: "d", type: "job", system: { callbackUsed: true } },
    { id: "e", type: "job", system: { callbackUsed: false } }
  ];
  assert.deepEqual(assetIdsOf(items, "scene"), ["a"]);
  assert.deepEqual(assetIdsOf(items, "job"), ["b"]);
  assert.deepEqual(usedCallbackIds(items), ["d"]);
});
