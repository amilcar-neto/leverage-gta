import { test } from "node:test";
import assert from "node:assert/strict";
import {
  maxLife, contestResult, baseDamage, applyDamage, restScene, resolveDown, giveIn, thugsDown
} from "../../module/rules/combat.mjs";

test("max life is 10 + Vitality die", () => {
  assert.equal(maxLife(4), 14);
  assert.equal(maxLife(8), 18);
  assert.equal(maxLife(12), 22);
  assert.throws(() => maxLife(7), RangeError);
});

test("ties are losses; 5+ is extraordinary", () => {
  assert.deepEqual(contestResult(9, 9), { margin: 0, passed: false, extraordinary: false });
  assert.equal(contestResult(10, 5).extraordinary, true);
  assert.equal(contestResult(9, 5).extraordinary, false);
  assert.equal(contestResult(5, 9).margin, -4);
});

test("damage is margin lost plus weapon roll", () => {
  assert.equal(baseDamage(3, 5), 8);
  assert.equal(baseDamage(0, 4), 4);
  assert.equal(baseDamage(-2, 4), 4);
  assert.equal(baseDamage(2), 2);
});

test("cover halves (floor) before the vest", () => {
  const r = applyDamage({ life: 18, vest: 6, damage: 15, cover: true });
  assert.equal(r.damage, 7);
  assert.equal(r.absorbed, 6);
  assert.equal(r.vest, 0);
  assert.equal(r.life, 17);
  assert.ok(!r.down);
});

test("no cover, no vest", () => {
  const r = applyDamage({ life: 10, vest: 0, damage: 4 });
  assert.deepEqual([r.life, r.vest, r.lifeLost, r.down], [6, 0, 4, false]);
});

test("vest absorbs everything when big enough", () => {
  const r = applyDamage({ life: 10, vest: 10, damage: 7 });
  assert.deepEqual([r.life, r.vest, r.absorbed, r.lifeLost], [10, 3, 7, 0]);
});

test("life never goes below zero and flags down", () => {
  const r = applyDamage({ life: 3, vest: 1, damage: 20 });
  assert.equal(r.life, 0);
  assert.equal(r.lifeLost, 3);
  assert.ok(r.down);
  assert.equal(applyDamage({ life: 5, vest: 0, damage: 1, cover: true }).damage, 0);
  assert.equal(applyDamage({ life: 5, vest: 0, damage: -4 }).life, 5);
});

test("rest scene heals half max, capped", () => {
  assert.equal(restScene(2, 18), 11);
  assert.equal(restScene(15, 18), 18);
  assert.equal(restScene(1, 15), 8);
});

test("Wasted for non-police", () => {
  const r = resolveDown({ police: false, max: 18 });
  assert.equal(r.kind, "wasted");
  assert.equal(r.costSteps, 1);
  assert.equal(r.life, 18);
  assert.equal(r.plotPoints, 1);
  assert.ok(r.loseWeaponAssets);
  assert.equal(r.bailCostSteps, null);
});

test("Busted for police; bail not allowed in Liberty City", () => {
  const r = resolveDown({ police: true, max: 16 });
  assert.equal(r.kind, "busted");
  assert.equal(r.bailCostSteps, 2);
  assert.equal(r.rescueRaisesStars, 1);
  assert.equal(resolveDown({ police: true, max: 16, bailAllowed: false }).bailCostSteps, null);
});

test("give in", () => {
  assert.deepEqual(giveIn(), { complicationDie: 6, plotPoints: 1 });
});

test("ganging up takedowns", () => {
  assert.equal(thugsDown(0, 4), 0);
  assert.equal(thugsDown(-3, 4), 0);
  assert.equal(thugsDown(2, 4), 1);
  assert.equal(thugsDown(5, 4), 2);
  assert.equal(thugsDown(7, 1), 1);
  assert.equal(thugsDown(4, 1), 0);
  assert.equal(thugsDown(9, 2), 2);
  assert.equal(thugsDown(9, 0), 0);
});
