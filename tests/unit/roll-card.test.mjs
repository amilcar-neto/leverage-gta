import "./helpers/foundry-stub.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { layoutOf, primeDieContext, rollCardContext } from "../../module/applications/chat/roll-card.mjs";

const t = (key, args) => (args ? `${key}:${JSON.stringify(args)}` : key);
const row = (result, faces = 8, extra = {}) => ({ ref: `r${result}`, label: "x", kind: "attribute", faces, result, kept: false, one: result === 1, effect: false, paid: false, ...extra });
const prime = (entries, over = {}) => ({
  v: 2, status: "resolved", entries, keptCount: 0, effectDie: 8, hitches: entries.filter((e) => e.result === 1).length, botch: false,
  selection: { total: [0, 1], effect: [2] }, total: entries[0].result + entries[1].result, ppSpent: 0, complicationsResolved: [], ...over
});
const dice = () => [row(9, 10), row(6, 8), row(4, 8), row(1, 6)];

test("layout: opposition, v1 and classic cards stay classic; pending and prime are new", () => {
  assert.equal(layoutOf({ v: 1, entries: [] }), "classic");
  assert.equal(layoutOf({ ...prime(dice()), opposition: true }), "classic");
  assert.equal(layoutOf({ v: 2, status: "resolved", effectDie: null, entries: [] }), "classic");
  assert.equal(layoutOf({ ...prime(dice()), status: "pending", effectDie: null }), "pending");
  assert.equal(layoutOf(prime(dice())), "prime");
});

test("summary shows the two total dice, the sum and the effect size only", () => {
  const ctx = rollCardContext(prime(dice()), { t });
  assert.equal(ctx.layout, "prime");
  assert.equal(ctx.summaryDice.length, 2);
  assert.deepEqual(ctx.summaryDice.map((d) => d.caption), ["LEVERAGE.Roll.total", "LEVERAGE.Roll.total"]);
  assert.equal(ctx.total, 15);
  assert.equal(ctx.sumText, "9 + 6");
  assert.equal(ctx.effect.faces, "d8");
  assert.ok(!ctx.effect.html.includes(">4<") && !ctx.effect.html.includes(">8<"), "effect die shows its size beside it, never a number inside");
  assert.ok(ctx.effect.html.includes("lv-roll-die--effect"));
  assert.equal(ctx.expanded, false);
});

test("expanded list captions every die: TOTAL, EFFECT, dX, HITCH, TOTAL +PP", () => {
  const entries = [row(9, 10), row(6, 8, { paid: true }), row(4, 8), row(3, 6), row(1, 6)];
  const data = prime(entries, { selection: { total: [0, 1], effect: [2], paid: [1] } });
  const ctx = rollCardContext(data, { t, expanded: true });
  assert.deepEqual(ctx.dice.map((d) => d.caption), ["LEVERAGE.Roll.total", "LEVERAGE.Roll.totalPaid", "LEVERAGE.Roll.effect", "d6", "LEVERAGE.Roll.hitch"]);
  assert.deepEqual(ctx.dice.map((d) => d.state), ["kept", "kept", "effect", "dropped", "one"]);
  assert.ok(ctx.dice[2].html.includes("lv-roll-die--effect"), "the effect die is marked in the expanded list");
  assert.equal(ctx.expanded, true);
  assert.equal(ctx.chips.length, 5);
});

test("hitch strip counts hitches and flags a botch", () => {
  const some = rollCardContext(prime(dice()), { t });
  assert.equal(some.showHitches, true);
  assert.equal(some.hitchText, 'LEVERAGE.Roll.hitchesOne:{"count":1}');
  const none = rollCardContext(prime([row(9), row(6), row(4)], { hitches: 0 }), { t });
  assert.equal(none.showHitches, false);
  const botch = rollCardContext(prime([row(1), row(1)], { selection: { total: [], effect: [] }, total: 0, effectDie: 4, hitches: 2, botch: true }), { t });
  assert.equal(botch.botch, true);
  assert.equal(botch.summaryDice.length, 0);
  assert.equal(botch.total, 0);
  assert.equal(botch.effect.faces, "d4");
});

test("pending card: dice without marks, no total, Choose button for whoever may resolve it (any roll, not only the newest)", () => {
  const data = { ...prime(dice()), status: "pending", effectDie: null, selection: null, total: null };
  const ctx = rollCardContext(data, { t, isOwner: true, canChoose: true, isLatest: true, isGM: true });
  assert.equal(ctx.pending, true);
  assert.equal(ctx.showChoose, true);
  assert.equal(ctx.showActions, true);
  assert.deepEqual([...new Set(ctx.dice.map((d) => d.state))], ["dropped"]);
  assert.equal(ctx.showComplication, false);
  assert.equal(ctx.showKeep, false);
  assert.equal(ctx.showHitches ?? false, false);
  assert.equal(rollCardContext(data, { t, canChoose: true, isLatest: false }).showChoose, true, "an older pending card keeps the button");
  assert.equal(rollCardContext(data, { t, canChoose: true, isGM: true }).showChoose, true, "the Fixer, when canResolve allows it");
  assert.equal(rollCardContext(data, { t, isOwner: true, isGM: false }).showChoose, false, "canResolve decides, not ownership alone");
});

test("resolved prime card offers Activate hitches (not the one-by-one Complication) to the Fixer; classic keeps its old behavior", () => {
  const gm = rollCardContext(prime(dice()), { t, isGM: true });
  assert.equal(gm.showComplication, false);
  assert.equal(gm.showActivate, true);
  const classic = rollCardContext({ entries: [row(9, 10, { kept: true }), row(5, 8, { kept: true }), row(1, 6)], total: 14, keptCount: 2, complicationsResolved: [] }, { t, isGM: true });
  assert.equal(classic.layout, "classic");
  assert.equal(classic.onesCount, 1);
  assert.equal(classic.summaryDice, undefined);
});

test("primeDieContext without a selection draws no ring", () => {
  const plain = primeDieContext(row(9, 10), 0, null, t);
  assert.equal(plain.caption, "d10");
  assert.ok(!/is-kept|is-one|is-dropped/.test(plain.html));
});

test("hitch strip fades once activated and keeps the BOTCH flag; the out of the scene note names the actor", () => {
  const card = prime([row(1), row(1)], { selection: { total: [], effect: [] }, total: 0, effectDie: 4, hitches: 2, botch: true, complicationsResolved: [0, 1], hitchesActivated: 2, hitchPP: 0, outOfScene: ["Cops"], actorName: "Ann" });
  const ctx = rollCardContext(card, { t });
  assert.equal(ctx.hitchesDone, true);
  assert.match(ctx.hitchText, /hitchesDone/);
  assert.equal(ctx.botch, true);
  assert.deepEqual(ctx.warnings, ['LEVERAGE.Roll.outOfScene:{"actor":"Ann","names":"Cops"}']);
  assert.equal(rollCardContext(prime([row(1), row(9)], { hitches: 1 }), { t }).hitchesDone, false);
});
