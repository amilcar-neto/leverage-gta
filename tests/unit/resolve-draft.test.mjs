import "./helpers/foundry-stub.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyConfirm, buyDie, clickDie, dieCaption, dieState, dieStates, draftSummary, emptyDraft, forceEffect, ppAvailable } from "../../module/dice/resolve-draft.mjs";
import { buildRollData } from "../../module/dice/roll-core.mjs";
import { keepNextDie } from "../../module/dice/card-actions.mjs";

const e = (ref, kind, die, extra = {}) => ({ ref, label: ref, kind, die, ...extra });
const pool = [e("a", "attribute", 10), e("r", "role", 10), e("s", "specialty", 8), e("d", "distinction", 6), e("x", "die", 6)];
/** Pending prime card: d10=9, d10=7, d8=6, d6=1, d6=4. */
const pending = (extra = {}) => ({ ...buildRollData({ entries: pool, values: [9, 7, 6, 1, 4], mode: "prime", ppAtRoll: 2 }), ...extra });

test("a prime card is pending: nothing kept, no total, no effect die", () => {
  const data = pending();
  assert.equal(data.status, "pending");
  assert.equal(data.total, null);
  assert.equal(data.effectDie, null);
  assert.equal(data.entries.some((x) => x.kept), false);
  assert.equal(data.ppAtRoll, 2);
  assert.equal(data.mode, "prime");
});

test("dieStates: hitch is never selectable", () => {
  const states = dieStates(pending().entries, { total: [0], effect: [2], paid: [] }).map((s) => s.state);
  assert.deepEqual(states, ["total", "free", "effect", "hitch", "free"]);
});

test("clicks fill total (2) then effect (1), then offer a paid die", () => {
  const { entries } = pending();
  let draft = emptyDraft();
  for (const i of [0, 1, 2]) draft = clickDie(entries, draft, i, { ppLeft: 1 }).draft;
  assert.deepEqual([draft.total, draft.effect], [[0, 1], [2]]);
  const last = clickDie(entries, draft, 4, { ppLeft: 1 });
  assert.equal(last.offer, true);
  assert.deepEqual(last.draft, draft);
  assert.equal(clickDie(entries, draft, 4, { ppLeft: 0 }).offer, false);
  assert.equal(clickDie(entries, draft, 3, { ppLeft: 1 }).offer, false);
});

test("a click on a placed die releases it", () => {
  const { entries } = pending();
  const draft = clickDie(entries, { total: [0], effect: [], paid: [] }, 0).draft;
  assert.deepEqual(draft.total, []);
});

test("forceEffect moves a total die to effect, replaces the old one, and releases the effect die", () => {
  const { entries } = pending();
  let draft = forceEffect(entries, { total: [0, 1], effect: [], paid: [] }, 0);
  assert.deepEqual([draft.total, draft.effect], [[1], [0]]);
  draft = forceEffect(entries, draft, 2);
  assert.deepEqual([draft.total, draft.effect], [[1], [2]]);
  assert.deepEqual(forceEffect(entries, draft, 2).effect, []);
  assert.deepEqual(forceEffect(entries, draft, 3), draft);
});

test("buyDie adds a paid die beyond the two free ones; needs a Plot Point", () => {
  const { entries } = pending();
  const full = { total: [0, 1], effect: [2], paid: [] };
  assert.deepEqual(buyDie(entries, full, 4, { ppLeft: 0 }), full);
  const bought = buyDie(entries, full, 4, { ppLeft: 1 });
  assert.deepEqual([bought.total, bought.paid], [[0, 1, 4], [4]]);
  assert.deepEqual(forceEffect(entries, bought, 4).paid, [], "releasing a paid die frees it");
});

test("draftSummary: total, effect die, PP and what is missing", () => {
  const data = pending();
  const empty = draftSummary(data, emptyDraft(), { ppAvailable: 2 });
  assert.equal(empty.ok, false);
  assert.deepEqual(empty.missing, ["total", "effect"]);
  const full = draftSummary(data, { total: [0, 1], effect: [2], paid: [] }, { ppAvailable: 2 });
  assert.deepEqual([full.ok, full.total, full.effectFaces, full.effectDefault, full.ppLeft], [true, 16, 8, false, 2]);
  const paid = draftSummary(data, { total: [0, 1, 4], effect: [2], paid: [4] }, { ppAvailable: 2 });
  assert.deepEqual([paid.total, paid.ppSpent, paid.ppLeft], [20, 1, 1]);
  assert.equal(draftSummary(data, { total: [0, 1, 4], effect: [2], paid: [4] }, { ppAvailable: 0 }).ok, false);
});

test("draftSummary: versus only with a difficulty", () => {
  const data = pending({ versus: { difficulty: 20 } });
  const s = draftSummary(data, { total: [0, 1], effect: [2], paid: [] });
  assert.deepEqual([s.versus.outcome, s.versus.margin], ["fail", -4]);
  assert.equal(draftSummary(pending(), emptyDraft()).versus, null);
});

test("effect die is d4 (default) when nothing is left", () => {
  const data = buildRollData({ entries: pool.slice(0, 2), values: [5, 6], mode: "prime" });
  const s = draftSummary(data, { total: [0, 1], effect: [], paid: [] });
  assert.deepEqual([s.ok, s.effectFaces, s.effectDefault], [true, 4, true]);
});

test("applyConfirm resolves the card in one object", () => {
  const out = applyConfirm(pending(), { total: [0, 1, 4], effect: [2], paid: [4] }, { ppAvailable: 2 });
  assert.equal(out.status, "resolved");
  assert.deepEqual([out.total, out.effectDie, out.ppSpent, out.keptCount], [20, 8, 1, 3]);
  assert.deepEqual(out.entries.map((x) => [x.kept, x.effect, x.paid]), [
    [true, false, false], [true, false, false], [false, true, false], [false, false, false], [true, false, true]
  ]);
  assert.deepEqual(out.selection, { total: [0, 1, 4], effect: [2], paid: [4] });
});

test("applyConfirm refuses: not pending, missing choice, hitch, too many PP", () => {
  const data = pending();
  assert.equal(applyConfirm({ ...data, status: "resolved" }, { total: [0, 1], effect: [2] }), null);
  assert.equal(applyConfirm(data, { total: [0], effect: [] }, { ppAvailable: 2 }), null);
  assert.equal(applyConfirm(data, { total: [0, 3], effect: [2] }, { ppAvailable: 2 }), null);
  assert.equal(applyConfirm(data, { total: [0, 1, 4], effect: [2], paid: [4] }, { ppAvailable: 0 }), null);
  assert.equal(applyConfirm(data, { total: [0, 1], effect: [2] }) !== null, true);
});

test("PP available: ppAtRoll capped by what the character has now", () => {
  assert.equal(ppAvailable({ ppAtRoll: 2 }, 5), 2);
  assert.equal(ppAvailable({ ppAtRoll: 2 }, 1), 1);
  assert.equal(ppAvailable({}, 3), 3);
  assert.equal(ppAvailable({ ppAtRoll: 2 }, null), 0);
});

test("applyConfirm refuses forged indexes (strings, negatives, out of range, NaN, fractions, duplicates)", () => {
  const data = pending();
  const forged = [
    { total: [0, "0"], effect: [2] }, { total: ["0", "1"], effect: ["2"] }, { total: [0, -1], effect: [2] },
    { total: [0, 9], effect: [2] }, { total: [0, Number.NaN], effect: [2] }, { total: [0, 1.5], effect: [2] },
    { total: [0, 0], effect: [2] }, { total: [0, 1], effect: [0] }, { total: [0, 1], effect: [2], paid: ["4"] },
    { total: [0, 1], effect: [2], paid: [1, 1] }, { total: [0, 1], effect: 2 }, { total: null, effect: [] }, null
  ];
  for (const selection of forged) assert.equal(applyConfirm(data, selection, { ppAvailable: 5 }), null, JSON.stringify(selection));
  assert.notEqual(applyConfirm(data, { total: [0, 1], effect: [2], paid: [] }, { ppAvailable: 5 }), null);
});

test("dieState and dieCaption are the one source of the window and of the card", () => {
  const { entries } = pending();
  const draft = { total: [0, 4], effect: [2], paid: [4] };
  assert.deepEqual(entries.map((x, i) => dieState(x, i, draft)), ["total", "free", "effect", "hitch", "total"]);
  const t = (key) => key;
  assert.equal(dieCaption(entries[0], "total", false, t), "LEVERAGE.Roll.total");
  assert.equal(dieCaption(entries[4], "total", true, t), "LEVERAGE.Roll.totalPaid");
  assert.equal(dieCaption(entries[2], "effect", false, t), "LEVERAGE.Roll.effect");
  assert.equal(dieCaption(entries[3], "hitch", false, t), "LEVERAGE.Roll.hitch");
  assert.equal(dieCaption(entries[1], "free", false, t), "d10");
});

test("a prime or pending card cannot use the old keep-3rd-die button", () => {
  assert.equal(keepNextDie(pending()), null);
  assert.equal(keepNextDie(applyConfirm(pending(), { total: [0, 1], effect: [2] })), null);
});
