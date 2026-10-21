import { test } from "node:test";
import assert from "node:assert/strict";
import {
  maxLife, contestResult, baseDamage, applyDamage, restScene, resolveDown, giveIn, thugsDown,
  oppositionWins, lostBy, damageRound, planDown, linkedRollIndex
} from "../../module/rules/combat.mjs";

test("max life is 10 + Vitality die", () => {
  assert.equal(maxLife(4), 14);
  assert.equal(maxLife(8), 18);
  assert.equal(maxLife(12), 22);
  assert.equal(maxLife(8, 12), 20);
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

test("Wasted when not taken down by the police; hospital price comes from the caller", () => {
  const r = resolveDown({ byPolice: false, max: 18, hospitalSteps: 1, bailSteps: 2 });
  assert.equal(r.kind, "wasted");
  assert.equal(r.costSteps, 1);
  assert.equal(r.life, 18);
  assert.equal(r.plotPoints, 1);
  assert.ok(r.loseWeaponAssets);
  assert.equal(r.bailCostSteps, null);
});

test("Busted for police; bail not allowed in Liberty City", () => {
  const r = resolveDown({ byPolice: true, max: 16, hospitalSteps: 1, bailSteps: 2 });
  assert.equal(r.kind, "busted");
  assert.equal(r.bailCostSteps, 2);
  assert.equal(r.rescueRaisesStars, 1);
  assert.equal(resolveDown({ byPolice: true, max: 16, hospitalSteps: 1, bailSteps: 2, bailAllowed: false }).bailCostSteps, null);
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

test("opposition wins ties; margin is never negative", () => {
  assert.equal(oppositionWins(9, 9), true);
  assert.equal(oppositionWins(10, 9), false);
  assert.equal(lostBy(9, 14), 5);
  assert.equal(lostBy(9, 9), 0);
  assert.equal(lostBy(12, 9), 0);
});

test("damage round: margin + weapon, cover halves, vest then Life", () => {
  const open = damageRound({ margin: 3, weaponRoll: 4, life: 18, vest: 0 });
  assert.deepEqual([open.raw, open.damage, open.life], [7, 7, 11]);
  const covered = damageRound({ margin: 3, weaponRoll: 4, life: 18, vest: 0, cover: true });
  assert.deepEqual([covered.raw, covered.damage, covered.life], [7, 3, 15]);
  const vested = damageRound({ margin: 5, weaponRoll: 5, life: 18, vest: 6 });
  assert.deepEqual([vested.absorbed, vested.vest, vested.life, vested.lifeLost], [6, 0, 14, 4]);
  const tie = damageRound({ margin: 0, weaponRoll: 0, life: 18, vest: 6 });
  assert.equal(tie.damage, 0);
  const dead = damageRound({ margin: 10, weaponRoll: 8, life: 5, vest: 2 });
  assert.deepEqual([dead.life, dead.down, dead.lifeLost], [0, true, 5]);
});

const down = { max: 18, hospitalSteps: 1, bailSteps: 2, bailAllowed: true, moneySteps: 5, rules: { money: true, stars: true } };

test("planDown: Wasted pays the hospital, +1 PP, loses weapon Assets", () => {
  const plan = planDown({ ...down, byPolice: false, isCrew: true });
  assert.equal(plan.kind, "wasted");
  assert.deepEqual([plan.priceKind, plan.dueSteps, plan.paidSteps, plan.shortBy], ["hospital", 1, 1, 0]);
  assert.deepEqual([plan.restoreLife, plan.plotPoints, plan.loseWeaponAssets, plan.rescuable], [18, 1, true, false]);
});

test("planDown: short on Money pays what there is", () => {
  const plan = planDown({ ...down, byPolice: true, isCrew: true, moneySteps: 1 });
  assert.deepEqual([plan.priceKind, plan.dueSteps, plan.paidSteps, plan.shortBy, plan.rescuable], ["bail", 2, 1, 1, true]);
});

test("planDown: Busted without bail waits for rescue (the Fixer raises the star)", () => {
  const plan = planDown({ ...down, byPolice: true, isCrew: true, bailAllowed: false });
  assert.equal(plan.kind, "busted");
  assert.deepEqual([plan.rescue, plan.priceKind, plan.dueSteps, plan.rescuable], [true, null, 0, true]);
});

test("planDown: house rules off and NPCs", () => {
  const off = planDown({ ...down, byPolice: true, isCrew: true, bailAllowed: false, rules: { money: false, stars: false } });
  assert.deepEqual([off.rescuable, off.dueSteps, off.plotPoints], [true, 0, 1]);
  const wastedOff = planDown({ ...down, byPolice: false, isCrew: true, rules: { money: false, stars: true } });
  assert.deepEqual([wastedOff.priceKind, wastedOff.dueSteps], [null, 0]);
  const npc = planDown({ ...down, byPolice: false, isCrew: false });
  assert.deepEqual([npc.restoreLife, npc.plotPoints, npc.loseWeaponAssets, npc.priceKind], [null, 0, false, null]);
});

test("linkedRollIndex finds the closest earlier Pool roll", () => {
  const roll = { actorUuid: "Actor.a" };
  const opp = { opposition: true };
  assert.equal(linkedRollIndex([roll, null, opp], 2), 0);
  assert.equal(linkedRollIndex([roll, opp, null, opp], 3), -1);
  assert.equal(linkedRollIndex([opp], 0), -1);
  assert.equal(linkedRollIndex([roll, null, null, null, null, null, null, opp], 7), -1);
});
