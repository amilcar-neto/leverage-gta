import "./helpers/foundry-stub.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  BOOSTABLE_DURATIONS, canBoostAsset, checkOpportunityRequest, effectiveDie, expireOpportunities, latestOppositionId, opportunitiesLeft, undoLower, useOpportunity
} from "../../module/dice/opportunity.mjs";
import { boostedAssetIds } from "../../module/applications/gm/job-actions.mjs";
import { rollCardContext } from "../../module/applications/chat/roll-card.mjs";

const card = (extra = {}) => ({ opposition: true, status: "resolved", v: 2, opportunities: 2, opportunitiesUsed: 0, entries: [], ...extra });
const comps = [{ id: "a", name: "Alarm", die: 6 }, { id: "b", name: "Dog", die: 4 }];
const assets = [
  { id: "x", name: "Van", die: 6, boost: 0, duration: "scene" },
  { id: "y", name: "Crowbar", die: 12, boost: 0, duration: "job" },
  { id: "z", name: "Gun", die: 8, boost: 0, duration: "signature" }
];

test("effectiveDie steps the die up and stops at d12", () => {
  assert.equal(effectiveDie(6, 0), 6);
  assert.equal(effectiveDie(6, 2), 10);
  assert.equal(effectiveDie(10, 5), 12);
  assert.equal(effectiveDie(6), 6);
});

test("opportunitiesLeft: only a resolved opposition card, never below 0", () => {
  assert.equal(opportunitiesLeft(card()), 2);
  assert.equal(opportunitiesLeft(card({ opportunitiesUsed: 5 })), 0);
  assert.equal(opportunitiesLeft(card({ status: "pending" })), 0);
  assert.equal(opportunitiesLeft(card({ opposition: false })), 0);
  assert.equal(opportunitiesLeft(null), 0);
});

test("canBoostAsset: scene and job Assets below d12 only", () => {
  assert.deepEqual(BOOSTABLE_DURATIONS, ["scene", "job"]);
  assert.equal(canBoostAsset(assets[0]), true);
  assert.equal(canBoostAsset(assets[1]), false);
  assert.equal(canBoostAsset(assets[2]), false);
  assert.equal(canBoostAsset({ die: 10, boost: 1, duration: "scene" }), false);
});

test("useOpportunity lower: steps the Complication down, a d4 is removed", () => {
  const r = useOpportunity(card(), { kind: "lower", id: "a" }, { complications: comps, by: "Ann" });
  assert.deepEqual(r.list, [{ id: "a", name: "Alarm", die: 4 }, comps[1]]);
  assert.equal(r.data.opportunitiesUsed, 1);
  assert.deepEqual(r.data.opportunityLog, [{ kind: "lower", name: "Alarm", from: 6, to: 4, by: "Ann" }]);
  const gone = useOpportunity(card(), { kind: "lower", id: "b" }, { complications: comps });
  assert.deepEqual(gone.list, [comps[0]]);
  assert.equal(gone.to, null);
  assert.deepEqual(undoLower(gone.list, gone), comps);
  assert.deepEqual(undoLower(r.list, r), comps);
});

test("useOpportunity raise: adds one boost step, up to d12", () => {
  const r = useOpportunity(card(), { kind: "raise", assetId: "x" }, { assets });
  assert.equal(r.boost, 1);
  assert.equal(r.previousBoost, 0);
  assert.equal(r.from, 6);
  assert.equal(r.to, 8);
  assert.equal(r.data.opportunitiesUsed, 1);
  assert.equal(useOpportunity(card(), { kind: "raise", assetId: "y" }, { assets }), null, "already d12");
  assert.equal(useOpportunity(card(), { kind: "raise", assetId: "z" }, { assets }), null, "signature");
});

test("useOpportunity refuses a bad choice, an empty card and does not mutate", () => {
  const data = card();
  const frozen = JSON.stringify(data);
  assert.equal(useOpportunity(data, { kind: "lower", id: "nope" }, { complications: comps }), null);
  assert.equal(useOpportunity(data, { kind: "raise", assetId: "nope" }, { assets }), null);
  assert.equal(useOpportunity(data, { kind: "other" }, { assets }), null);
  assert.equal(useOpportunity(data, null), null);
  assert.equal(useOpportunity(card({ opportunitiesUsed: 2 }), { kind: "lower", id: "a" }, { complications: comps }), null);
  assert.equal(JSON.stringify(data), frozen);
});

test("two uses spend two Opportunities", () => {
  const first = useOpportunity(card(), { kind: "lower", id: "a" }, { complications: comps });
  const second = useOpportunity(first.data, { kind: "lower", id: "a" }, { complications: first.list });
  assert.equal(second.data.opportunitiesUsed, 2);
  assert.equal(opportunitiesLeft(second.data), 0);
});

test("boostedAssetIds lists the raised Assets only", () => {
  const items = [{ id: "1", type: "asset", system: { boost: 1 } }, { id: "2", type: "asset", system: { boost: 0 } }, { id: "3", type: "job", system: { boost: 2 } }];
  assert.deepEqual(boostedAssetIds(items), ["1"]);
});

test("roll card: strip, button and notes of the Fixer's card", () => {
  const t = (key, args) => `${key}${args ? JSON.stringify(args) : ""}`;
  const base = { t, lang: "en" };
  const owner = rollCardContext(card(), { ...base, opportunity: { canUse: true, plotPoints: 2 } });
  assert.equal(owner.showOpportunities, true);
  assert.match(owner.opportunityText, /Opposition\.opportunities/);
  assert.equal(owner.showOpportunity, true);
  assert.equal(owner.opportunityDisabled, false);
  assert.equal(owner.showActions, true);
  assert.equal(rollCardContext(card(), { ...base, opportunity: { canUse: true, plotPoints: 0 } }).opportunityDisabled, true);
  const watcher = rollCardContext(card(), base);
  assert.equal(watcher.showOpportunities, true);
  assert.equal(watcher.showOpportunity, false);
  assert.match(rollCardContext(card({ opportunities: 1 }), base).opportunityText, /opportunityOne/);
  const spent = rollCardContext(card({ opportunitiesUsed: 2, opportunityLog: [{ kind: "raise", name: "Van", from: 6, to: 8, by: "Ann" }] }), { ...base, opportunity: { canUse: true, plotPoints: 2 } });
  assert.equal(spent.showOpportunities, false);
  assert.equal(spent.showOpportunity, false);
  assert.equal(spent.ppNotes.length, 1);
  assert.match(spent.ppNotes[0], /opportunityNote\.raise/);
});

test("expired cards have no Opportunity left", () => {
  assert.equal(opportunitiesLeft(expireOpportunities(card())), 0);
});

test("latestOppositionId: newest opposition card of the scene only", () => {
  const cards = [
    { id: "a", timestamp: 1, sceneId: "s1", roll: { opposition: true } },
    { id: "b", timestamp: 5, sceneId: "s2", roll: { opposition: true } },
    { id: "c", timestamp: 9, sceneId: "s1", roll: { opposition: false } },
    { id: "d", timestamp: 3, sceneId: "s1", roll: { opposition: true } }
  ];
  assert.equal(latestOppositionId(cards, "s1"), "d");
  assert.equal(latestOppositionId(cards, "s2"), "b");
  assert.equal(latestOppositionId([], "s1"), null);
});

test("checkOpportunityRequest: a forged card, a foreign character and an old card are refused", () => {
  const ok = { data: card(), authorIsGM: true, ownActorId: "me", actorId: "me", latestId: "m1", messageId: "m1" };
  assert.deepEqual(checkOpportunityRequest(ok), { ok: true });
  // a player forged the message: opposition flags written by a non-GM author
  assert.equal(checkOpportunityRequest({ ...ok, authorIsGM: false, data: card({ opportunities: 99 }) }).reason, "invalid");
  assert.equal(checkOpportunityRequest({ ...ok, actorId: "other" }).reason, "invalid");
  assert.equal(checkOpportunityRequest({ ...ok, ownActorId: null }).reason, "invalid");
  assert.equal(checkOpportunityRequest({ ...ok, data: card({ opposition: false }) }).reason, "invalid");
  assert.equal(checkOpportunityRequest({ ...ok, data: card({ opportunitiesUsed: 2 }) }).reason, "taken");
  assert.equal(checkOpportunityRequest({ ...ok, latestId: "m2" }).reason, "expired");
  assert.deepEqual(checkOpportunityRequest({ ...ok, actorId: undefined }), { ok: true });
});
