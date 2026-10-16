import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVERAGE } from "../../module/config.mjs";

test("every die size has color, shape and label", () => {
  assert.deepEqual([...LEVERAGE.dice], [4, 6, 8, 10, 12]);
  for (const d of LEVERAGE.dice) {
    const s = LEVERAGE.dieStyles[d];
    assert.match(s.color, /^#[0-9a-f]{6}$/i);
    assert.ok(s.shape.split(" ").every((p) => /^\d+,\d+$/.test(p)));
    assert.equal(s.label, `LEVERAGE.Die.d${d}`);
  }
});

test("attribute and role keys", () => {
  assert.equal(Object.keys(LEVERAGE.attributes).length, 6);
  assert.deepEqual(Object.keys(LEVERAGE.roles), ["grifter", "hacker", "hitter", "mastermind", "thief"]);
  assert.equal(LEVERAGE.roles.thief.label, "LEVERAGE.Role.thief");
});

test("money ladder is consistent", () => {
  for (const d of LEVERAGE.dice) assert.ok(LEVERAGE.money.stepsPerDie[d] >= 1);
  assert.deepEqual({ ...LEVERAGE.money.stepsPerDie }, { 4: 1, 6: 2, 8: 3, 10: 4, 12: 5 });
  assert.equal(LEVERAGE.money.maxSteps, LEVERAGE.money.maxDice * LEVERAGE.money.stepsPerDie[12]);
});

test("city scales have 5 levels of valid dice", () => {
  assert.equal(LEVERAGE.defaultCityScales.length, 3);
  for (const city of LEVERAGE.defaultCityScales) {
    assert.equal(city.levels.length, 5);
    for (const pool of city.levels) for (const d of pool) assert.ok(LEVERAGE.dice.includes(d));
  }
  const liberty = LEVERAGE.defaultCityScales.find((c) => c.id === "liberty");
  assert.deepEqual(liberty.levels[4], [12, 12, 8]);
  assert.equal(liberty.silence, null);
  assert.equal(liberty.bail, false);
  const byId = (id) => LEVERAGE.defaultCityScales.find((c) => c.id === id);
  assert.deepEqual([...byId("carcer").silence], [6]);
  assert.deepEqual([...byId("venturas").silence], [10]);
});

test("prices, vests and training costs", () => {
  for (const p of LEVERAGE.defaultPrices) for (const d of p.dice) assert.ok(LEVERAGE.dice.includes(d));
  assert.deepEqual(Object.values(LEVERAGE.vestKinds).map((v) => v.points), [0, 4, 6, 10]);
  const priceIds = LEVERAGE.defaultPrices.map((p) => p.id);
  for (const v of Object.values(LEVERAGE.vestKinds)) {
    if (v.priceId !== null) assert.ok(priceIds.includes(v.priceId));
  }
  assert.deepEqual(LEVERAGE.defaultPrices.find((p) => p.id === "signatureAsset").dice, [8]);
  assert.equal(Object.keys(LEVERAGE.defaultTrainingCosts).length, 5);
});

test("config is frozen, including nested defaults", () => {
  assert.throws(() => { LEVERAGE.lifeBase = 1; }, TypeError);
  assert.throws(() => { LEVERAGE.defaultCityScales[0].levels[0].push(4); }, TypeError);
});
