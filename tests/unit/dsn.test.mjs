import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVERAGE } from "../../module/config.mjs";
import { appearanceFor, buildColorsets, colorsetName } from "../../module/dice/dsn.mjs";

test("one colorset per die size plus Money, colored from the config", () => {
  const sets = buildColorsets();
  assert.equal(sets.length, LEVERAGE.dice.length + 1);
  for (const size of LEVERAGE.dice) {
    const set = sets.find((s) => s.name === colorsetName(size));
    assert.equal(set.background, LEVERAGE.dieStyles[size].color);
  }
  assert.equal(sets.at(-1).name, "leverage-cash");
  assert.equal(sets.at(-1).background, LEVERAGE.money.color);
  assert.equal(new Set(sets.map((s) => s.name)).size, sets.length);
});

test("appearance picks the colorset by size or Money kind", () => {
  assert.deepEqual(appearanceFor(8, "trait"), { colorset: "leverage-d8" });
  assert.deepEqual(appearanceFor(10, "money"), { colorset: "leverage-cash" });
  assert.ok(buildColorsets().some((s) => s.name === appearanceFor(12).colorset));
});
