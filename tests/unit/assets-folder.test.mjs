import "./helpers/foundry-stub.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestAssetDie, resolveTrainingCosts, pickJobsToSpend, assetCostOf } from "../../module/applications/actor/parts/assets.mjs";
import { LEVERAGE } from "../../module/config.mjs";

const asset = (duration) => ({ system: { duration } });
const job = (id, sort, spent = false) => ({ id, sort, system: { spent } });

test("first Signature is d8, later ones d6, Job/Scene d6", () => {
  assert.equal(suggestAssetDie("signature", []), 8);
  assert.equal(suggestAssetDie("signature", [asset("scene")]), 8);
  assert.equal(suggestAssetDie("signature", [asset("signature")]), 6);
  assert.equal(suggestAssetDie("job", []), 6);
  assert.equal(suggestAssetDie("scene", [asset("signature")]), 6);
});

test("Plot Point cost: Job 2, Scene 1, Signature 0", () => {
  assert.equal(assetCostOf("job"), 2);
  assert.equal(assetCostOf("scene"), 1);
  assert.equal(assetCostOf("signature"), 0);
});

test("training costs: defaults, overrides and bad values", () => {
  assert.deepEqual(resolveTrainingCosts(), { ...LEVERAGE.defaultTrainingCosts });
  const costs = resolveTrainingCosts({ talent: 3, role: -1, attribute: "x", specialty: 0 });
  assert.equal(costs.talent, 3);
  assert.equal(costs.specialty, 0);
  assert.equal(costs.role, LEVERAGE.defaultTrainingCosts.role);
  assert.equal(costs.attribute, LEVERAGE.defaultTrainingCosts.attribute);
});

test("jobs to spend: oldest unspent first, none if too few", () => {
  const jobs = [job("c", 3), job("a", 1, true), job("b", 2), job("d", 4)];
  assert.deepEqual(pickJobsToSpend(jobs, 2), ["b", "c"]);
  assert.deepEqual(pickJobsToSpend(jobs, 3), ["b", "c", "d"]);
  assert.deepEqual(pickJobsToSpend(jobs, 4), []);
  assert.deepEqual(pickJobsToSpend(jobs, 0), []);
});
