import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stepsToDice, diceToSteps, clampSteps, priceToSteps, pay, canAfford, earn, lend,
  moneyRollDie, afterMoneyRoll
} from "../../module/rules/money.mjs";
import { LEVERAGE } from "../../module/config.mjs";

test("docs/02 ladder table", () => {
  const table = {
    0: [], 1: [4], 2: [6], 3: [8], 4: [10], 5: [12], 6: [4, 12], 7: [6, 12], 10: [12, 12],
    12: [6, 12, 12], 25: [12, 12, 12, 12, 12]
  };
  for (const [steps, dice] of Object.entries(table)) assert.deepEqual(stepsToDice(Number(steps)), dice, steps);
});

test("round trip for every step count; at most 5 dice", () => {
  for (let s = 0; s <= LEVERAGE.money.maxSteps; s++) {
    const dice = stepsToDice(s);
    assert.equal(diceToSteps(dice), s);
    assert.ok(dice.length <= LEVERAGE.money.maxDice);
    assert.deepEqual(dice, [...dice].sort((a, b) => a - b));
  }
});

test("clamping", () => {
  assert.deepEqual(stepsToDice(-3), []);
  assert.equal(clampSteps(99), 25);
  assert.equal(clampSteps(NaN), 0);
  assert.equal(clampSteps("7"), 7);
  assert.equal(clampSteps(3.9), 3);
  assert.throws(() => diceToSteps([7]), RangeError);
});

test("prices are sums", () => {
  assert.equal(priceToSteps([12, 6]), 7);
  assert.equal(priceToSteps([]), 0);
});

test("pay", () => {
  assert.deepEqual(pay(3, 3), { ok: true, steps: 0, shortBy: 0 });
  assert.deepEqual(pay(2, 3), { ok: false, steps: 2, shortBy: 1 });
  assert.deepEqual(pay(7, 0), { ok: true, steps: 7, shortBy: 0 });
  assert.ok(canAfford(5, 5));
  assert.ok(!canAfford(4, 5));
});

test("earn caps at 25", () => {
  assert.deepEqual(earn(2, 4), { steps: 6, gained: 4 });
  assert.deepEqual(earn(24, 12), { steps: 25, gained: 1 });
  assert.deepEqual(earn(5, -2), { steps: 5, gained: 0 });
});

test("lend is limited by lender funds and receiver room", () => {
  assert.deepEqual(lend(5, 1, 2), { from: 3, to: 3, moved: 2 });
  assert.deepEqual(lend(2, 1, 9), { from: 0, to: 3, moved: 2 });
  assert.deepEqual(lend(10, 24, 5), { from: 9, to: 25, moved: 1 });
  assert.deepEqual(lend(4, 0, -3), { from: 4, to: 0, moved: 0 });
});

test("money die in a roll and the step it costs", () => {
  assert.equal(moneyRollDie(0), null);
  assert.equal(moneyRollDie(2), 6);
  assert.equal(moneyRollDie(6), 12);
  assert.equal(afterMoneyRoll(6), 5);
  assert.equal(afterMoneyRoll(0), 0);
});
