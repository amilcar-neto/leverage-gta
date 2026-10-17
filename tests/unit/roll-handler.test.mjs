import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRollData, poolFormula, rollEffects, rollableEntries, rollValues } from "../../module/dice/roll-handler.mjs";
import { dieContext, rollCardContext } from "../../module/applications/chat/roll-card.mjs";

const e = (ref, kind, die, extra = {}) => ({ ref, label: ref, kind, die, ...extra });
const pool = [e("attributes.agility", "attribute", 10), e("roles.thief", "role", 10), e("item:s", "specialty", 6), e("item:d", "distinction", 8)];
const t = (key, args) => (args ? `${key}:${JSON.stringify(args)}` : key);

/** rng that yields faces in order for the given sizes. */
const rngFor = (sizes, faces) => {
  let i = 0;
  return () => (faces[i++] - 0.5) / sizes[i - 1];
};

test("formula has one Die term per die", () => {
  assert.equal(poolFormula([10, 10, 6]), "1d10 + 1d10 + 1d6");
});

test("rollValues is deterministic with an injected rng", () => {
  const sizes = pool.map((p) => p.die);
  assert.deepEqual(rollValues(sizes, rngFor(sizes, [9, 6, 1, 5])), [9, 6, 1, 5]);
});

test("blank entries are not rolled", () => {
  assert.equal(rollableEntries([{ ...pool[0], blank: true }, { ...pool[1], blank: false }]).length, 1);
});

test("two highest kept, 1 is out, flags follow docs/05", () => {
  const data = buildRollData({ entries: pool, values: [9, 6, 1, 5], actorUuid: "Actor.a", flavor: "x" });
  assert.equal(data.total, 15);
  assert.equal(data.keptCount, 2);
  assert.deepEqual(data.entries.map((x) => [x.kept, x.one]), [[true, false], [true, false], [false, true], [false, false]]);
  assert.deepEqual([data.ppSpent, data.distinctionPP, data.complicationsResolved, data.money], [0, 0, [], false]);
  assert.equal(data.entries[0].faces, 10);
});

test("only one eligible die, or none", () => {
  assert.equal(buildRollData({ entries: pool, values: [1, 7, 1, 1] }).total, 7);
  const none = buildRollData({ entries: pool, values: [1, 1, 1, 1] });
  assert.equal(none.total, 0);
  assert.equal(none.keptCount, 0);
});

test("d4 Distinction earns 1 PP; d8 does not; Money flags the roll", () => {
  const d4 = e("item:d", "distinction", 4, { hinders: true });
  assert.equal(buildRollData({ entries: [pool[0], pool[1], d4], values: [5, 5, 3] }).distinctionPP, 1);
  const money = buildRollData({ entries: [pool[0], pool[1], e("money", "money", 12)], values: [5, 5, 3] });
  assert.equal(money.money, true);
  assert.deepEqual(rollEffects(money, 8), { plotPoints: 0, moneySteps: 7 });
  assert.deepEqual(rollEffects(buildRollData({ entries: [pool[0], pool[1], d4], values: [5, 5, 3] }), 8), { plotPoints: 1, moneySteps: null });
  assert.equal(rollEffects(money, 0).moneySteps, 0);
});

test("card context: dice states, captions, explanation and 1s warning", () => {
  const data = buildRollData({ entries: pool, values: [9, 6, 1, 5] });
  const ctx = rollCardContext(data, { t, isOwner: true, isGM: false, plotPoints: 2 });
  assert.deepEqual(ctx.dice.map((d) => d.state), ["kept", "kept", "one", "dropped"]);
  assert.equal(ctx.dice[3].caption, "d8");
  assert.match(ctx.dice[0].html, /lv-die--kept/);
  assert.match(ctx.dice[2].html, /lv-die--one/);
  assert.equal(ctx.sumText, "9 + 6");
  assert.equal(ctx.onesCount, 1);
  assert.equal(ctx.showKeep, true);
  assert.equal(ctx.showComplication, false);
});

test("card buttons follow permission and state", () => {
  const data = buildRollData({ entries: pool, values: [9, 6, 1, 5] });
  assert.equal(rollCardContext(data, { t, isOwner: true, plotPoints: 0 }).showKeep, false);
  assert.equal(rollCardContext(data, { t, isOwner: false, plotPoints: 3 }).showKeep, false);
  assert.equal(rollCardContext(data, { t, isGM: true }).showComplication, true);
  const resolved = { ...data, complicationsResolved: [2] };
  assert.equal(rollCardContext(resolved, { t, isGM: true }).showComplication, false);
  const nothingSpare = buildRollData({ entries: pool.slice(0, 2), values: [9, 6] });
  assert.equal(rollCardContext(nothingSpare, { t, isOwner: true, plotPoints: 3 }).showKeep, false);
});

test("die with a Money entry renders as money", () => {
  const html = dieContext({ ref: "money", label: "Money", kind: "money", faces: 12, result: 7, kept: true, one: false }, t).html;
  assert.match(html, /lv-die--money/);
});
