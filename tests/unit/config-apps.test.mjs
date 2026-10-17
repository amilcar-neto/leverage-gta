import { test } from "node:test";
import assert from "node:assert/strict";
import { LEVERAGE } from "../../module/config.mjs";
import {
  CONFIG_LIMITS, addDie, cleanDice, makeCityId, removeDieAt, resolveCityScales, resolvePrices,
  resolveTrainingCosts, validateCityScales, validatePrices, validateTrainingCosts
} from "../../module/rules/config-data.mjs";
import { getCityScale, policePool, setScalesProvider } from "../../module/rules/stars.mjs";

const clone = (v) => structuredClone(v);

test("dice lists: clean, add, remove", () => {
  assert.deepEqual(cleanDice([4, 20, "8", 12, 3]), [12, 8, 4]);
  assert.deepEqual(cleanDice("x"), []);
  assert.deepEqual(addDie([12, 6], 8), [12, 8, 6]);
  assert.deepEqual(addDie([12], 7), [12]);
  assert.equal(addDie([6, 6, 6, 6], 4, 4).length, 4);
  assert.deepEqual(removeDieAt([12, 8, 6], 1), [12, 6]);
});

test("city id: slug, unique, never empty", () => {
  assert.equal(makeCityId("Vice City", []), "vice-city");
  assert.equal(makeCityId("Vice City", ["vice-city"]), "vice-city-2");
  assert.equal(makeCityId("São Paulo", []), "sao-paulo");
  assert.equal(makeCityId("  !! ", ["city"]), "city-2");
});

test("default city scales validate and keep their rules", () => {
  const { ok, scales } = validateCityScales(LEVERAGE.defaultCityScales);
  assert.equal(ok, true);
  assert.deepEqual(scales.map((s) => s.id), ["carcer", "venturas", "liberty"]);
  assert.equal(scales.filter((s) => s.default).length, 1);
  assert.equal(scales.find((s) => s.default).id, "liberty");
  const liberty = scales.find((s) => s.id === "liberty");
  assert.equal(liberty.silence, null);
  assert.equal(liberty.wait, null);
  assert.equal(liberty.sketchBlocksDisguise, true);
  assert.equal(scales.find((s) => s.id === "carcer").disguise, "clear");
  assert.deepEqual(scales.find((s) => s.id === "venturas").levels[4], [12, 12]);
});

test("validation errors: no cities, empty name, empty pool", () => {
  assert.equal(validateCityScales([]).errors[0].key, "noCities");
  const broken = clone(LEVERAGE.defaultCityScales);
  broken[0].name = "  ";
  broken[1].levels[2] = [];
  const keys = validateCityScales(broken).errors.map((e) => e.key);
  assert.deepEqual(keys.sort(), ["emptyName", "emptyPool"]);
});

test("normalization: bad rule values get safe values; ids stay unique; one default", () => {
  const raw = [
    { id: "a", name: "A", levels: [[6], [6], [6], [6], [6]], wait: "0", disguise: "9", disguiseBoth: "x", silence: [], starsPerSilenceDie: 99, default: true },
    { id: "a", name: "B", levels: [[4], [4], [4], [4], [4]], default: true }
  ];
  const { scales } = validateCityScales(raw);
  assert.deepEqual(scales.map((s) => s.id), ["a", "b"]);
  assert.equal(scales.filter((s) => s.default).length, 1);
  assert.equal(scales[0].wait, null);
  assert.equal(scales[0].disguise, 1);
  assert.equal(scales[0].disguiseBoth, null);
  assert.equal(scales[0].silence, null);
  assert.equal(scales[0].starsPerSilenceDie, LEVERAGE.stars.starsPerSilenceDie);
});

test("resolveCityScales: unusable data falls back to the defaults", () => {
  assert.equal(resolveCityScales(null).length, 3);
  assert.equal(resolveCityScales([{ id: "", name: "" }]).length, 3);
  const mine = resolveCityScales([{ id: "x", name: "X", levels: [[4], [6], [8], [10], [12]] }]);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].default, true);
  assert.equal(resolveCityScales(LEVERAGE.defaultCityScales)[0].name, "Carcer City");
});

test("the rules read the configured scales and the flagged default city", () => {
  const custom = resolveCityScales([
    { id: "a", name: "A", levels: [[4], [6], [8], [10], [12]] },
    { id: "b", name: "B", levels: [[6, 6], [6], [6], [6], [6]], default: true }
  ]);
  setScalesProvider(() => custom);
  try {
    assert.deepEqual(policePool("a", 3), [8]);
    assert.equal(getCityScale("missing").id, "b");
  } finally {
    setScalesProvider(null);
  }
  assert.equal(getCityScale("missing").id, "liberty");
});

test("prices: defaults complete, edits kept, empty price is an error", () => {
  assert.deepEqual(resolvePrices(null).map((p) => p.id), LEVERAGE.defaultPrices.map((p) => p.id));
  const edited = clone(LEVERAGE.defaultPrices);
  edited[1].dice = [12, 6];
  assert.deepEqual(resolvePrices(edited)[1].dice, [12, 6]);
  assert.deepEqual(resolvePrices([{ id: "bail", dice: "zz" }]).find((p) => p.id === "bail").dice, [6]);
  const empty = clone(LEVERAGE.defaultPrices);
  empty[0].dice = [];
  const result = validatePrices(empty);
  assert.equal(result.ok, false);
  assert.deepEqual(result.errors, [{ key: "emptyPrice", data: { item: empty[0].label } }]);
  assert.equal(validatePrices(LEVERAGE.defaultPrices).ok, true);
  assert.equal(CONFIG_LIMITS.priceDice, 4);
});

test("prices: extra stored items are kept", () => {
  const stored = [...LEVERAGE.defaultPrices, { id: "boat", label: "Boat", dice: [10, 4] }];
  assert.deepEqual(resolvePrices(stored).at(-1), { id: "boat", label: "Boat", dice: [10, 4] });
});

test("training costs: whole numbers only", () => {
  assert.deepEqual(resolveTrainingCosts(undefined), LEVERAGE.defaultTrainingCosts);
  assert.equal(resolveTrainingCosts({ role: "3" }).role, 3);
  assert.equal(resolveTrainingCosts({ role: -1 }).role, LEVERAGE.defaultTrainingCosts.role);
  const bad = validateTrainingCosts({ ...LEVERAGE.defaultTrainingCosts, talent: "1.5", role: "" });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.errors.map((e) => e.data.item).sort(), ["role", "talent"]);
  const good = validateTrainingCosts({ ...LEVERAGE.defaultTrainingCosts, attribute: "4" });
  assert.equal(good.ok, true);
  assert.equal(good.costs.attribute, 4);
});
