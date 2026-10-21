import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clampStars, raiseStars, lowerStars, getCityScale, policePool, mainDie,
  starsAfterWaiting, starsAfterDisguise, bribeRule, bailAllowed
} from "../../module/rules/stars.mjs";

test("stars clamp 0..5", () => {
  assert.equal(raiseStars(5), 5);
  assert.equal(raiseStars(4, 3), 5);
  assert.equal(lowerStars(0), 0);
  assert.equal(lowerStars(2, 9), 0);
  assert.equal(clampStars("x"), 0);
});

test("police Pool per docs/02 table", () => {
  assert.deepEqual(policePool("carcer", 1), [4, 6]);
  assert.deepEqual(policePool("venturas", 5), [12, 12]);
  assert.deepEqual(policePool("liberty", 5), [12, 12, 8]);
  assert.deepEqual(policePool("liberty", 0), []);
  assert.deepEqual(policePool("liberty", 9), [12, 12, 8]);
});

test("unknown city falls back to default; custom scales honored", () => {
  assert.equal(getCityScale("nowhere").id, "liberty");
  const custom = [{ id: "x", name: "X", levels: [[4], [6], [8], [10], [12]] }];
  assert.deepEqual(policePool("x", 2, custom), [6]);
  assert.equal(getCityScale("zzz", custom).id, "x");
});

test("main die is the largest of the level", () => {
  assert.equal(mainDie("carcer", 1), 6);
  assert.equal(mainDie("liberty", 1), 8);
  assert.equal(mainDie("liberty", 0), null);
});

test("policePool returns a copy", () => {
  policePool("liberty", 1).push(4);
  assert.deepEqual(policePool("liberty", 1), [8, 6]);
});

test("waiting out of sight", () => {
  assert.equal(starsAfterWaiting("carcer", 4, { scenes: 2 }), 2);
  assert.equal(starsAfterWaiting("venturas", 4, { scenes: 3 }), 3);
  assert.equal(starsAfterWaiting("liberty", 4, { scenes: 5 }), 4);
  assert.equal(starsAfterWaiting("liberty", 4, { betweenSessions: true }), 3);
  assert.equal(starsAfterWaiting("carcer", 1, { scenes: 5 }), 0);
});

test("changing looks", () => {
  assert.equal(starsAfterDisguise("carcer", 5), 0);
  assert.equal(starsAfterDisguise("venturas", 4), 3);
  assert.equal(starsAfterDisguise("venturas", 4, { carAndClothes: true }), 2);
  assert.equal(starsAfterDisguise("liberty", 4), 3);
  assert.equal(starsAfterDisguise("liberty", 4, { sketched: true }), 4);
});

test("buying silence reads the scale", () => {
  assert.deepEqual(bribeRule("carcer"), { stars: 2, dice: [6] });
  assert.deepEqual(bribeRule("venturas"), { stars: 2, dice: [10] });
  assert.equal(bribeRule("liberty"), null);
  const custom = [{ id: "x", name: "X", levels: [[4]], silence: [8, 12], bail: true }];
  assert.deepEqual(bribeRule("x", custom), { stars: 2, dice: [8, 12] });
  assert.equal(bribeRule("x", [{ id: "x", levels: [[4]] }]), null);
});

test("bail reads the scale", () => {
  assert.equal(bailAllowed("carcer"), true);
  assert.equal(bailAllowed("liberty"), false);
  assert.equal(bailAllowed("x", [{ id: "x", levels: [[4]], bail: true }]), true);
  assert.equal(bailAllowed("x", [{ id: "x", levels: [[4]] }]), false);
});

test("custom cities use their own waiting, disguise and silence values", () => {
  const custom = [{
    id: "x", name: "X", levels: [[4]], wait: 3, disguise: 2, disguiseBoth: 3, starsPerSilenceDie: 1,
    sketchBlocksDisguise: true, silence: [6]
  }];
  assert.equal(starsAfterWaiting("x", 5, { scenes: 7 }, custom), 3);
  assert.equal(starsAfterDisguise("x", 5, {}, custom), 3);
  assert.equal(starsAfterDisguise("x", 5, { carAndClothes: true }, custom), 2);
  assert.equal(starsAfterDisguise("x", 5, { sketched: true }, custom), 5);
  assert.deepEqual(bribeRule("x", custom), { stars: 1, dice: [6] });
});
