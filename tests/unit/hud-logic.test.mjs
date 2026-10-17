import { test } from "node:test";
import assert from "node:assert/strict";
import { hudPermissions, moneyView, nextStarLevel, pickFocusActor, poolText, starsView } from "../../module/applications/hud/hud-logic.mjs";

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
  assert.deepEqual(hudPermissions({ isGM: true, isOwner: false, hasActor: true }), { money: true, plotPoints: true, stars: true });
  assert.deepEqual(hudPermissions({ isGM: false, isOwner: true, hasActor: true }), { money: true, plotPoints: true, stars: false });
  assert.deepEqual(hudPermissions({ isGM: false, isOwner: false, hasActor: true }), { money: false, plotPoints: false, stars: false });
  assert.deepEqual(hudPermissions({ isGM: false, isOwner: true, hasActor: false }), { money: false, plotPoints: false, stars: false });
});
