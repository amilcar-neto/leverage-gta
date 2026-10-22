import { test } from "node:test";
import assert from "node:assert/strict";
import { changedKeys, touchesPartyLists, hudPermissions, moneyView, nextStarLevel, pickFocusActor, plotPointRows, starsView } from "../../module/applications/hud/hud-logic.mjs";
import { clampTablePoints } from "../../module/rules/plot-points.mjs";
import { poolText } from "../../module/rules/stars.mjs";

test("focus actor: player prefers his character, the Fixer the selected token", () => {
  const mine = { id: "mine" };
  const token = { id: "token" };
  assert.equal(pickFocusActor({ isGM: false, character: mine, controlled: token }), mine);
  assert.equal(pickFocusActor({ isGM: false, character: null, controlled: token }), token);
  assert.equal(pickFocusActor({ isGM: true, character: mine, controlled: token }), token);
  assert.equal(pickFocusActor({ isGM: true, character: mine, controlled: null }), mine);
  assert.equal(pickFocusActor({ isGM: false, character: null, controlled: null }), null);
});

test("star click sets the level, clicking the current level lowers it", () => {
  assert.equal(nextStarLevel(3, 0), 3);
  assert.equal(nextStarLevel(3, 5), 3);
  assert.equal(nextStarLevel(3, 3), 2);
  assert.equal(nextStarLevel(1, 1), 0);
});

test("stars view: five stars, on up to the level, main die and tooltip pool of the city", () => {
  const view = starsView({ level: 2, city: "liberty", interactive: true });
  assert.equal(view.length, 5);
  assert.deepEqual(view.map((s) => s.on), [true, true, false, false, false]);
  assert.deepEqual(view.map((s) => s.die), [8, 10, 12, 12, 12]);
  assert.equal(view[2].pool, "d12 + d6");
  assert.equal(view[4].pool, "d12 + d12 + d8");
  assert.equal(poolText([12, 6]), "d12 + d6");
});

test("money view: dice with the biggest on the right, empty at zero", () => {
  assert.deepEqual(moneyView(7), { dice: [6, 12], empty: false });
  assert.deepEqual(moneyView(0), { dice: [], empty: true });
});

test("permissions: Fixer everything, owner his own, others look only", () => {
  assert.deepEqual(hudPermissions({ isGM: true, isOwner: false, hasActor: true }), { money: true, spendPlotPoints: true, gainPlotPoints: true, stars: true });
  assert.deepEqual(hudPermissions({ isGM: false, isOwner: true, hasActor: true }), { money: true, spendPlotPoints: true, gainPlotPoints: false, stars: false });
  assert.deepEqual(hudPermissions({ isGM: false, isOwner: false, hasActor: true }), { money: false, spendPlotPoints: false, gainPlotPoints: false, stars: false });
  assert.deepEqual(hudPermissions({ isGM: false, isOwner: true, hasActor: false }), { money: false, spendPlotPoints: false, gainPlotPoints: false, stars: false });
});

test("plot point rows: sorted by name, value defaults to 0, minus disabled at 0", () => {
  const rows = plotPointRows([
    { id: "b", name: "Vic", system: { plotPoints: { value: 2 } } },
    { id: "a", name: "Claude", system: {} }
  ]);
  assert.deepEqual(rows.map((r) => r.id), ["a", "b"]);
  assert.deepEqual(rows.map((r) => r.value), [0, 2]);
  assert.deepEqual(rows.map((r) => r.canLower), [false, true]);
});

test("table counter: never below 0, no upper limit, bad values count as 0", () => {
  assert.equal(clampTablePoints(0, -1), 0);
  assert.equal(clampTablePoints(3, 1), 4);
  assert.equal(clampTablePoints(500, 1), 501);
  assert.equal(clampTablePoints(undefined, 1), 1);
  assert.equal(clampTablePoints(2.7), 2);
});

test("changed keys: only known keys with a different value pulse", () => {
  assert.deepEqual([...changedKeys({ a: 1, b: 2 }, { a: 1, b: 3, c: 9 })], ["b"]);
});

test("touchesPartyLists: only Plot Points, Money, name and ownership matter", () => {
  assert.equal(touchesPartyLists({ system: { plotPoints: { value: 2 } } }), true);
  assert.equal(touchesPartyLists({ "system.money.steps": 3 }), true);
  assert.equal(touchesPartyLists({ name: "A" }), true);
  assert.equal(touchesPartyLists({ ownership: { x: 3 } }), true);
  assert.equal(touchesPartyLists({ system: { notes: "x" }, img: "a.png" }), false);
  assert.equal(touchesPartyLists(undefined), false);
});
