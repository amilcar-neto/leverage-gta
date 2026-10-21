import "./helpers/foundry-stub.mjs";
import test from "node:test";
import assert from "node:assert/strict";

// stars-actions.mjs imports settings.mjs and the socket, which extend Foundry classes at import time.
const { ApplicationV2 = class {}, HandlebarsApplicationMixin = (base) => base } = globalThis.foundry.applications?.api ?? {};
globalThis.foundry.applications ??= { api: { ApplicationV2, HandlebarsApplicationMixin } };
const { planStarsAction, mayStart, silenceOffer, starsLineContext } = await import("../../module/applications/gm/stars-actions.mjs");
const { LEVERAGE } = await import("../../module/config.mjs");

const scales = LEVERAGE.defaultCityScales;
const state = (city, level, extra = {}) => ({ city, level, scales, rulesOn: true, steps: 0, ...extra });
const plan = (action, params, st) => planStarsAction(action, params, st);

test("raise stops at 5 and refuses bad amounts", () => {
  assert.deepEqual(plan("raise", { n: 2 }, state("liberty", 1)).to, 3);
  assert.equal(plan("raise", { n: 9 }, state("liberty", 3)).to, 5);
  assert.equal(plan("raise", {}, state("liberty", 5)).error, "atMax");
  assert.equal(plan("raise", { n: 0 }, state("liberty", 1)).error, "invalidAmount");
  assert.deepEqual(plan("raise", { reason: " shots " }, state("liberty", 0)).reason, { key: "custom", data: { text: "shots" } });
});

test("setLevel validates 0..5 and refuses no-ops", () => {
  assert.equal(plan("setLevel", { level: 4 }, state("liberty", 1)).to, 4);
  assert.equal(plan("setLevel", { level: 6 }, state("liberty", 1)).error, "invalidLevel");
  assert.equal(plan("setLevel", { level: 1.5 }, state("liberty", 1)).error, "invalidLevel");
  assert.equal(plan("setLevel", { level: 1 }, state("liberty", 1)).error, "unchanged");
});

test("setCity zeroes the stars, names the new city and refuses unknown or same cities", () => {
  const moved = plan("setCity", { city: "carcer" }, state("liberty", 3));
  assert.deepEqual([moved.ok, moved.from, moved.to, moved.city, moved.reason.key], [true, 3, 0, "carcer", "changeCity"]);
  assert.equal(plan("setCity", { city: "carcer" }, state("liberty", 0)).to, 0);
  assert.equal(plan("setCity", { city: "nowhere" }, state("liberty", 3)).error, "unknownCity");
  assert.equal(plan("setCity", { city: "liberty" }, state("liberty", 3)).error, "sameCity");
  assert.equal(plan("setCity", { city: "carcer" }, state("liberty", 3, { rulesOn: false })).error, "disabled");
  assert.equal(mayStart("setCity", { isGM: true }), true);
  assert.equal(mayStart("setCity", { isGM: false }), false);
});

test("waiting follows the city scale", () => {
  assert.equal(plan("wait", { scenes: 2 }, state("carcer", 4)).to, 2);
  assert.equal(plan("wait", { scenes: 1 }, state("venturas", 3)).error, "notEnough");
  assert.equal(plan("wait", { scenes: 4 }, state("venturas", 3)).to, 1);
  assert.equal(plan("wait", { scenes: 3 }, state("liberty", 3)).error, "waitBetweenSessions");
  assert.equal(plan("wait", { betweenSessions: true }, state("liberty", 3)).to, 2);
  assert.equal(plan("wait", { scenes: 1 }, state("carcer", 0)).error, "noStars");
});

test("disguise: clear, minus one, minus two, sketch blocks in Liberty", () => {
  assert.equal(plan("disguise", { kind: "simple" }, state("carcer", 5)).to, 0);
  assert.equal(plan("disguise", { kind: "simple" }, state("venturas", 4)).to, 3);
  assert.equal(plan("disguise", { kind: "both" }, state("venturas", 4)).to, 2);
  assert.equal(plan("disguise", { kind: "simple" }, state("liberty", 4)).to, 3);
  assert.equal(plan("disguise", { kind: "simple", sketched: true }, state("liberty", 4)).error, "sketched");
  assert.equal(plan("disguise", { kind: "simple", sketched: true }, state("venturas", 4)).to, 3);
  assert.equal(plan("disguise", { kind: "bad" }, state("venturas", 4)).error, "invalidKind");
});

test("buy silence pays the city die and removes 2 stars per die", () => {
  const ok = plan("buySilence", { name: "Ana" }, state("carcer", 3, { steps: 4 }));
  assert.deepEqual([ok.ok, ok.from, ok.to, ok.cost], [true, 3, 1, [6]]);
  assert.equal(plan("buySilence", {}, state("venturas", 2, { steps: 4 })).cost[0], 10);
  assert.equal(plan("buySilence", {}, state("carcer", 1, { steps: 4 })).to, 0);
  assert.equal(plan("buySilence", { count: 5 }, state("carcer", 3, { steps: 20 })).cost.length, 2);
  const short = plan("buySilence", {}, state("venturas", 3, { steps: 2 }));
  assert.deepEqual([short.ok, short.error, short.data.shortBy], [false, "short", 2]);
  assert.equal(plan("buySilence", {}, state("liberty", 3, { steps: 25 })).error, "noSilence");
  assert.equal(plan("buySilence", {}, state("carcer", 0, { steps: 25 })).error, "noStars");
});

test("last resort needs the Fixer's confirmation and depends on the city", () => {
  assert.equal(plan("lastResort", {}, state("liberty", 4)).error, "needsConfirm");
  assert.equal(plan("lastResort", { confirmed: true }, state("liberty", 0)).error, "noStars");
  const scapegoat = plan("lastResort", { confirmed: true, name: "Ana" }, state("liberty", 4));
  assert.deepEqual([scapegoat.ok, scapegoat.to, scapegoat.reason.key], [true, 0, "lastResortScapegoat"]);
  const free = plan("lastResort", { confirmed: true, way: "disguise" }, state("carcer", 4));
  assert.deepEqual([free.ok, free.to, free.cost], [true, 0, undefined]);
  assert.equal(plan("lastResort", { confirmed: true, way: "fly" }, state("carcer", 4)).error, "invalidWay");
  const paid = plan("lastResort", { confirmed: true, way: "silence" }, state("carcer", 4, { steps: 20 }));
  assert.deepEqual([paid.ok, paid.to, paid.cost.length > 0], [true, 0, true]);
  assert.equal(plan("lastResort", { confirmed: true, way: "silence" }, state("carcer", 4, { steps: 0 })).error, "short");
});

test("rule off and unknown actions are refused", () => {
  assert.equal(plan("raise", {}, state("liberty", 1, { rulesOn: false })).error, "disabled");
  assert.equal(plan("fly", {}, state("liberty", 1)).error, "unknownAction");
});

test("only the Fixer starts any stars action (a player buys silence through him)", () => {
  assert.equal(mayStart("raise", { isGM: true }), true);
  assert.equal(mayStart("raise", { isGM: false }), false);
  assert.equal(mayStart("buySilence", { isGM: false }), false);
  assert.equal(mayStart("lastResort", { isGM: false }), false);
  assert.equal(mayStart("giveIn", { isGM: true }), false);
});

test("silenceOffer and chat context", () => {
  assert.deepEqual(silenceOffer("venturas", scales), { die: 10, starsPerDie: 2 });
  assert.equal(silenceOffer("liberty", scales), null);
  const ctx = starsLineContext({ from: 3, to: 1, reasonText: "x" });
  assert.equal(ctx.direction, "down");
  assert.deepEqual(ctx.stars.map((s) => s.on), [true, false, false, false, false]);
});
