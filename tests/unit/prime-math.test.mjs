import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyPick, autoSelection, classify, compare, heroicSteps, stepEffect, summarize, validate
} from "../../module/dice/prime-math.mjs";
import { LEVERAGE } from "../../module/config.mjs";

/** Entries from [faces, result] pairs. */
const dice = (...pairs) => pairs.map(([faces, result]) => ({ faces, result }));
const empty = () => ({ total: [], effect: [], paid: [] });

test("classify separates hitches and flags a botch", () => {
  assert.deepEqual(classify(dice([8, 1], [6, 4], [4, 1])), { hitches: [0, 2], eligible: [1], botch: false });
  assert.equal(classify(dice([8, 1], [6, 1])).botch, true);
  assert.equal(classify([]).botch, false);
});

test("autoSelection (total): two highest, biggest die left is the effect", () => {
  const e = dice([8, 5], [10, 9], [6, 6], [12, 2]);
  assert.deepEqual(autoSelection(e), { total: [1, 2], effect: [3], paid: [] });
});

test("autoSelection ties keep the bigger die free for the effect", () => {
  const e = dice([10, 6], [6, 6], [8, 6]);
  assert.deepEqual(autoSelection(e), { total: [1, 2], effect: [0], paid: [] });
});

test("autoSelection (effect): biggest die by faces is the effect, two highest of the rest the total", () => {
  const e = dice([12, 3], [8, 9], [6, 7], [4, 5]);
  assert.deepEqual(autoSelection(e, { prefer: "effect" }), { total: [1, 2], effect: [0], paid: [] });
});

test("autoSelection skips hitches; one die and only 1s", () => {
  assert.deepEqual(autoSelection(dice([8, 1], [6, 4])), { total: [1], effect: [], paid: [] });
  assert.deepEqual(autoSelection(dice([8, 1], [6, 1])), { total: [], effect: [], paid: [] });
});

test("applyPick: auto fills total, then effect, then does nothing; clicking again releases", () => {
  const e = dice([8, 5], [10, 9], [6, 6], [12, 2], [4, 1]);
  let s = empty();
  s = applyPick(e, s, 0);
  s = applyPick(e, s, 1);
  assert.deepEqual(s.total, [0, 1]);
  s = applyPick(e, s, 2);
  assert.deepEqual(s.effect, [2]);
  assert.equal(applyPick(e, s, 3), s);
  assert.deepEqual(applyPick(e, s, 0).total, [1]);
  assert.equal(applyPick(e, s, 4), s);
});

test("applyPick: effect slot replaces, a full total refuses, paid grows the total", () => {
  const e = dice([8, 5], [10, 9], [6, 6], [12, 4]);
  let s = applyPick(e, applyPick(e, empty(), 0), 1);
  assert.equal(applyPick(e, s, 2, "total"), s);
  s = applyPick(e, s, 2, "effect");
  s = applyPick(e, s, 3, "effect");
  assert.deepEqual(s.effect, [3]);
  s = applyPick(e, s, 2, "paid");
  assert.deepEqual([s.total, s.paid], [[0, 1, 2], [2]]);
  assert.deepEqual(applyPick(e, s, 2).paid, []);
});

test("validate: a complete selection is ok; rules are enforced", () => {
  const e = dice([8, 5], [10, 9], [6, 6], [12, 1]);
  assert.equal(validate(e, { total: [0, 1], effect: [2] }).ok, true);
  assert.deepEqual(validate(e, { total: [0], effect: [] }).missing, ["total", "effect"]);
  assert.ok(validate(e, { total: [0, 1], effect: [3] }).errors.includes("hitch-selected"));
  assert.ok(validate(e, { total: [0, 1, 2], effect: [] }).errors.includes("too-many-total"));
  assert.ok(validate(e, { total: [0, 1], effect: [2, 3] }).errors.includes("too-many-effect"));
  assert.ok(validate(e, { total: [0, 0], effect: [] }).errors.includes("duplicate-die"));
});

test("validate: paid dice cost Plot Points and cannot be the effect", () => {
  const e = dice([8, 5], [10, 9], [6, 6], [12, 7]);
  const sel = { total: [0, 1, 2], effect: [3], paid: [2] };
  assert.deepEqual(validate(e, sel, { ppAvailable: 1 }), { ok: true, errors: [], missing: [], ppCost: 1 });
  assert.ok(validate(e, sel, { ppAvailable: 0 }).errors.includes("not-enough-pp"));
  assert.ok(validate(e, { total: [0, 1], effect: [2], paid: [2] }, { ppAvailable: 1 }).errors.includes("paid-effect"));
  assert.ok(validate(e, { total: [0, 1], effect: [], paid: [2] }, { ppAvailable: 1 }).errors.includes("paid-outside-total"));
});

test("validate: one eligible die is the total, no effect needed; only 1s is a botch", () => {
  assert.equal(validate(dice([8, 1], [6, 4]), { total: [1], effect: [] }).ok, true);
  assert.equal(validate(dice([8, 1], [6, 1]), { total: [], effect: [] }).ok, true);
});

test("summarize: total, effect size, d4 default, PP and botch", () => {
  const e = dice([8, 5], [10, 9], [6, 6], [12, 1]);
  assert.deepEqual(summarize(e, { total: [0, 1], effect: [2] }),
    { total: 14, effectFaces: 6, effectDefault: false, ppSpent: 0, hitches: 1, botch: false });
  const one = summarize(dice([8, 1], [6, 4]), { total: [1], effect: [] });
  assert.deepEqual([one.total, one.effectFaces, one.effectDefault], [4, LEVERAGE.prime.defaultEffectDie, true]);
  assert.equal(summarize(e, { total: [0, 1, 2], effect: [], paid: [2] }).ppSpent, 1);
  const botch = summarize(dice([8, 1], [6, 1]), { total: [], effect: [] });
  assert.deepEqual([botch.total, botch.botch, botch.hitches], [0, true, 2]);
});

test("heroicSteps, compare (tie fails) and stepEffect", () => {
  assert.deepEqual([4, 5, 9, 10, 14].map(heroicSteps), [0, 1, 1, 2, 2]);
  assert.deepEqual(compare(8, 8), { margin: 0, outcome: "fail", steps: 0 });
  assert.deepEqual(compare(10, 8), { margin: 2, outcome: "success", steps: 0 });
  assert.deepEqual(compare(13, 8), { margin: 5, outcome: "heroic", steps: 1 });
  assert.equal(stepEffect(6, 2), 10);
  assert.equal(stepEffect(10, 3), 12);
  assert.equal(stepEffect(8, 0), 8);
});

test("config: difficulties are 2d4..2d12 in order", () => {
  assert.deepEqual(LEVERAGE.difficulties.map((d) => [d.dice, d.size]), [[2, 4], [2, 6], [2, 8], [2, 10], [2, 12]]);
});
