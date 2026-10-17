import "./helpers/foundry-stub.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { diceFromCounts, describeCost, checkPayment, checkLend, MAX_DICE_PER_SIZE } from "../../module/rules/money-flow.mjs";
import { earn, afterMoneyRoll, moneyRollDie, stepsToDice } from "../../module/rules/money.mjs";
import { DicePool, resolvePoolRef } from "../../module/dice/pool.mjs";
import { resolvePrices } from "../../module/rules/config-data.mjs";
import { jobItemData } from "../../module/applications/gm/job-actions.mjs";

// The chat-line builders only need game.i18n at call time.
globalThis.game = { i18n: { localize: (k) => k, format: (k, d) => `${k}:${JSON.stringify(d)}` } };
const { payLineHtml, lendLineHtml } = await import("../../module/applications/chat/money-lines.mjs");

test("diceFromCounts builds an ascending dice list and ignores junk", () => {
  assert.deepEqual(diceFromCounts({ 12: 1, 6: 1 }), [6, 12]);
  assert.deepEqual(diceFromCounts({ 4: "2", 8: -3, 20: 4, 10: "x" }), [4, 4]);
  assert.equal(diceFromCounts({ 12: 99 }).length, MAX_DICE_PER_SIZE);
  assert.deepEqual(diceFromCounts(null), []);
});

test("describeCost sums dice into steps (d12 + d6 = 7)", () => {
  assert.deepEqual(describeCost([12, 6]), { dice: [6, 12], steps: 7 });
  assert.equal(describeCost([]).steps, 0);
});

test("checkPayment: affordable, short and empty prices", () => {
  assert.deepEqual(checkPayment(8, [12, 6]), { ok: true, cost: 7, after: 1, shortBy: 0 });
  assert.equal(checkPayment(7, [6, 12]).after, 0);
  const short = checkPayment(3, [8, 6]);
  assert.equal(short.ok, false);
  assert.equal(short.error, "short");
  assert.equal(short.shortBy, 2);
  assert.equal(short.after, 3);
  assert.equal(checkPayment(5, []).error, "emptyPrice");
});

test("every default price can be paid with enough Money and prices follow the setting", () => {
  const prices = resolvePrices([{ id: "hospital", dice: [12] }]);
  const hospital = prices.find((p) => p.id === "hospital");
  assert.equal(checkPayment(4, hospital.dice).ok, false);
  assert.equal(checkPayment(5, hospital.dice).ok, true);
  const rich = prices.find((p) => p.id === "buyRich");
  assert.equal(describeCost(rich.dice).steps, 7);
});

test("checkLend validates owner-independent rules strictly", () => {
  assert.deepEqual(checkLend({ fromSteps: 6, toSteps: 2, amount: 3 }), { ok: true, from: 3, to: 5 });
  assert.equal(checkLend({ fromSteps: 6, toSteps: 2, amount: 7 }).error, "noFunds");
  assert.equal(checkLend({ fromSteps: 6, toSteps: 24, amount: 2 }).error, "full");
  assert.equal(checkLend({ fromSteps: 6, toSteps: 24, amount: 1 }).ok, true);
  assert.equal(checkLend({ fromSteps: 6, toSteps: 2, amount: 0 }).error, "invalidAmount");
  assert.equal(checkLend({ fromSteps: 6, toSteps: 2, amount: 1.5 }).error, "invalidAmount");
  assert.equal(checkLend({ fromSteps: 6, toSteps: 2, amount: "x" }).error, "invalidAmount");
  assert.equal(checkLend({ fromSteps: 6, toSteps: 2, amount: 1, sameActor: true }).error, "sameActor");
  assert.equal(checkLend({ fromSteps: 0, toSteps: 2, amount: 1 }).error, "noFunds");
});

test("Money in the Pool: largest die enters, one step drops after the roll", () => {
  const actor = { system: { money: { steps: 8 }, attributes: {}, roles: {} }, items: new Map() };
  const resolved = resolvePoolRef(actor, "money");
  assert.equal(resolved.kind, "money");
  assert.equal(resolved.die, moneyRollDie(8));
  assert.equal(moneyRollDie(8), 12);
  assert.deepEqual(stepsToDice(8), [8, 12]);
  assert.equal(afterMoneyRoll(8), 7);
  assert.equal(moneyRollDie(afterMoneyRoll(5)), 10);
  assert.deepEqual(stepsToDice(afterMoneyRoll(5)), [10]);
  assert.equal(afterMoneyRoll(0), 0);
});

test("Money in the Pool is refused with the house rule off or when broke", () => {
  const actor = { system: { money: { steps: 8 } }, items: new Map() };
  assert.equal(resolvePoolRef(actor, "money", { moneyEnabled: false }), null);
  assert.equal(new DicePool((r) => resolvePoolRef(actor, r, { moneyEnabled: false })).add("money"), false);
  assert.equal(resolvePoolRef({ ...actor, system: { money: { steps: 0 } } }, "money"), null);
});

test("job payout adds steps with the ladder cap and the Job Item records total and share", () => {
  assert.deepEqual(earn(22, 5), { steps: 25, gained: 3 });
  assert.deepEqual(earn(0, 7), { steps: 7, gained: 7 });
  assert.equal(earn(5, -3).steps, 5);
  assert.deepEqual(jobItemData("Bank", 9, 3).system.payout, { total: 9, share: 3 });
  assert.deepEqual(jobItemData("Bank", "x", -2).system.payout, { total: 0, share: 0 });
});

test("chat lines escape names and show the cost dice", () => {
  const pay = payLineHtml({ name: "<b>Tommy</b>", item: "Vest & more", cost: [6], after: 2 });
  assert.ok(!pay.includes("<b>Tommy"));
  assert.ok(pay.includes("&lt;b&gt;Tommy"));
  assert.ok(pay.includes("lv-die--d6") && pay.includes("lv-die--money"));
  const lend = lendLineHtml({ from: "A", to: "B", moved: 3 });
  assert.ok(lend.includes("lv-money-line--lend") && lend.includes("lv-die--d8"));
});
