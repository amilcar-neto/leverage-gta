import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidDie, assertDie, stepUp, stepDown, largestDie } from "../../module/dice/die.mjs";
import {
  rollDie, rollPool, evaluatePool, canKeepExtra, extraKeepCost, rollAndEvaluate
} from "../../module/dice/pool-roll.mjs";

/** rng that replays the given faces for the given sizes. */
const rngFor = (sizes, faces) => {
  let i = 0;
  return () => (faces[i] - 1) / sizes[i++] + 1e-9;
};
const pool = (sizes, faces) => rollPool(sizes, rngFor(sizes, faces));

test("die validation and stepping", () => {
  assert.ok(isValidDie(8));
  assert.ok(!isValidDie(20));
  assert.ok(!isValidDie("8"));
  assert.throws(() => assertDie(7), RangeError);
  assert.equal(stepUp(4), 6);
  assert.equal(stepUp(12), 12);
  assert.equal(stepDown(12), 10);
  assert.equal(stepDown(4), null);
  assert.equal(largestDie([6, 12, 4]), 12);
  assert.equal(largestDie([]), null);
});

test("rollDie covers the full range and stays in bounds", () => {
  assert.equal(rollDie(6, () => 0), 1);
  assert.equal(rollDie(6, () => 0.999999), 6);
  assert.equal(rollDie(12, () => 1), 12);
  assert.throws(() => rollDie(20), RangeError);
});

test("keeps the two highest", () => {
  const out = evaluatePool(pool([8, 10, 6], [3, 9, 5]));
  assert.deepEqual(out.kept, [1, 2]);
  assert.equal(out.total, 14);
  assert.deepEqual(out.rest, [0]);
  assert.ok(canKeepExtra(out));
});

test("ones never count", () => {
  const out = evaluatePool(pool([8, 10, 6], [1, 1, 4]));
  assert.deepEqual(out.kept, [2]);
  assert.deepEqual(out.ones, [0, 1]);
  assert.equal(out.total, 4);
  assert.ok(!canKeepExtra(out));
});

test("all ones gives total 0; empty pool too", () => {
  assert.equal(evaluatePool(pool([6, 6], [1, 1])).total, 0);
  assert.equal(evaluatePool([]).total, 0);
});

test("ties keep the earlier die", () => {
  const out = evaluatePool(pool([6, 6, 6], [4, 4, 4]));
  assert.deepEqual(out.kept, [0, 1]);
  assert.deepEqual(out.rest, [2]);
});

test("extra kept dice from Plot Points", () => {
  const results = pool([8, 8, 8, 8], [7, 6, 5, 1]);
  assert.equal(evaluatePool(results, 1).total, 18);
  assert.deepEqual(evaluatePool(results, 1).rest, []);
  assert.equal(evaluatePool(results, 5).total, 18);
  assert.equal(evaluatePool(results, -3).total, 13);
  assert.equal(extraKeepCost(evaluatePool(results), 3), 1);
  assert.equal(extraKeepCost(evaluatePool(results), -1), 0);
});

test("rollAndEvaluate uses the injected rng", () => {
  const { results, outcome } = rollAndEvaluate([4, 12], () => 0.999);
  assert.deepEqual(results.map((r) => r.value), [4, 12]);
  assert.equal(outcome.total, 16);
});
