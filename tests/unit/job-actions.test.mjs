import "./helpers/foundry-stub.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { checkJobResult, freshJob, evenSplit, toSteps, jobItemData, assetIdsOf, usedCallbackIds } from "../../module/applications/gm/job-actions.mjs";

test("freshJob has only a name and a goal, and trims the name", () => {
  assert.deepEqual(freshJob("  Bank  "), { name: "Bank", goal: "" });
  assert.equal(freshJob(null).name, "");
});

test("checkJobResult: a name is required and the shares cannot exceed the total", () => {
  assert.deepEqual(checkJobResult({ name: "  ", total: 4, shares: { a: 2 } }, ["a"]), { ok: false, error: "jobNameRequired" });
  assert.equal(checkJobResult({ name: "Heist", total: 4, shares: { a: 3, b: 2 } }, ["a", "b"]).error, "sharesExceedTotal");
  assert.equal(checkJobResult({ name: "Heist", total: 5, shares: { a: 3, b: 2 } }, ["a", "b"]).ok, true);
  assert.equal(checkJobResult({ name: "Heist", total: 0, shares: {} }, ["a"]).ok, true);
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
  assert.deepEqual(jobItemData("Heist", 6, "2"), { name: "Heist", type: "job", system: { goal: "", payout: { total: 6, share: 2 } } });
  assert.equal(jobItemData("Heist", 6, 2, "  Get the ledger ").system.goal, "Get the ledger");
  assert.equal(freshJob("Bank", " Ledger ").goal, "Ledger");
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

test("jobItemData links the Record to its world Job by a flag", () => {
  const data = jobItemData("Heist", 6, 2, "", "Item.abc");
  assert.deepEqual(data.flags, { "leverage-gta": { jobUuid: "Item.abc" } });
});
