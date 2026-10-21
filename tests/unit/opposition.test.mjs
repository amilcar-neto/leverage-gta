import "./helpers/foundry-stub.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildOppositionData, complicationSources, emptyCounts, gangDice, locationSources, looseDice, normalizeDice, npcSources,
  pickedDice, policeDice, stepCount
} from "../../module/dice/opposition.mjs";
import { rollCardContext } from "../../module/applications/chat/roll-card.mjs";

const t = (key) => key;

test("counters step within 0..12 and ignore invalid dice", () => {
  let c = stepCount(emptyCounts(), 8, 2);
  assert.equal(c[8], 2);
  assert.equal(stepCount(c, 8, -5)[8], 0);
  assert.equal(stepCount(c, 8, 99)[8], 12);
  assert.deepEqual(stepCount(c, 20, 1), c);
  assert.equal(c[8], 2, "input is not mutated");
});

test("loose dice come smallest die first", () => {
  const dice = looseDice({ ...emptyCounts(), 12: 1, 6: 2 }, "Opp");
  assert.deepEqual(dice.map((d) => d.die), [6, 6, 12]);
  assert.equal(new Set(dice.map((d) => d.ref)).size, 3);
  assert.ok(dice.every((d) => d.kind === "opposition"));
});

test("police Pool follows the city scale and the stars", () => {
  assert.deepEqual(policeDice("liberty", 3, "Police").map((d) => d.die), [12, 6]);
  assert.deepEqual(policeDice("liberty", 5, "Police").map((d) => d.die), [12, 12, 8]);
  assert.deepEqual(policeDice("liberty", 0, "Police"), []);
  const custom = [{ id: "x", name: "X", levels: [[4], [4, 4], [6], [6], [8]] }];
  assert.deepEqual(policeDice("x", 2, "Police", custom).map((d) => d.die), [4, 4]);
});

test("gang: N dice of one size", () => {
  assert.deepEqual(gangDice(4, 8, "Gang").map((d) => d.die), [8, 8, 8, 8]);
  assert.deepEqual(gangDice(0, 8, "Gang"), []);
  assert.deepEqual(gangDice(3, null, "Gang"), []);
  assert.deepEqual(gangDice("x", 8, "Gang"), []);
});

test("NPC sources: traits, attributes and roles with a die; blank names fall back", () => {
  const system = {
    traits: [{ name: "Brutal", die: 8 }, { name: " ", die: 6 }],
    attributes: { agility: { die: 10 }, vigor: { die: null } },
    roles: { hitter: { die: 8 }, thief: { die: null } }
  };
  const names = { attribute: (k) => `A:${k}`, role: (k) => `R:${k}`, trait: "Trait" };
  const sources = npcSources(system, names);
  assert.deepEqual(sources.map((s) => [s.label, s.die]), [["Brutal", 8], ["Trait", 6], ["A:agility", 10], ["R:hitter", 8]]);
  assert.deepEqual(npcSources({}, names), []);
});

test("location and Complication sources", () => {
  assert.deepEqual(locationSources([{ name: "Dark Corners", die: 8 }, { name: "", die: 6 }], "Trait").map((s) => s.label), ["Dark Corners", "Trait"]);
  const job = { complications: [{ id: "a", name: "Alarm", die: 6 }, { id: "b", name: "Bad", die: 99 }] };
  assert.deepEqual(complicationSources(job), [{ key: "job.a", label: "Alarm", die: 6 }]);
  assert.deepEqual(complicationSources(undefined), []);
});

test("picked dice follow the list order, not the pick order", () => {
  const groups = [[{ key: "a", label: "A", die: 8 }], [{ key: "b", label: "B", die: 6 }, { key: "c", label: "C", die: 4 }]];
  assert.deepEqual(pickedDice(groups, new Set(["c", "a"])).map((d) => d.ref), ["a", "c"]);
});

test("normalizeDice: sizes or objects, invalid dropped, empty is 2d6", () => {
  const ok = normalizeDice([8, { die: 6, label: "Cop", ref: "police.0" }, 7, "x"], "Opp");
  assert.equal(ok.fallback, false);
  assert.deepEqual(ok.dice.map((d) => [d.ref, d.label, d.die]), [["opp.0", "Opp", 8], ["police.0", "Cop", 6]]);
  const none = normalizeDice([], "Opp");
  assert.equal(none.fallback, true);
  assert.deepEqual(none.dice.map((d) => d.die), [6, 6]);
  assert.equal(normalizeDice(undefined, "Opp").fallback, true);
});

test("opposition roll data: Pool rules, no actor, opposition flag", () => {
  const { dice } = normalizeDice([8, 6, 6, 4], "Opp");
  const data = buildOppositionData({ dice, values: [7, 1, 5, 3], name: "FIXER", flavor: "Guards", source: "manual" });
  assert.equal(data.opposition, true);
  assert.equal(data.source, "manual");
  assert.equal(data.actorUuid, "");
  assert.equal(data.total, 12);
  assert.deepEqual(data.entries.map((e) => e.kept), [true, false, true, false]);
  assert.equal(data.entries[1].one, true);
  assert.equal(data.distinctionPP, 0);
  assert.equal(data.money, false);
});

test("opposition card: no portrait, no Plot Point buttons, no ones warning", () => {
  const { dice } = normalizeDice([8, 6, 6], "Opp");
  const data = buildOppositionData({ dice, values: [7, 1, 5], name: "FIXER", flavor: "Guards" });
  data.actorImg = "icons/x.png";
  const ctx = rollCardContext(data, { t, isOwner: true, isGM: true, plotPoints: 3 });
  assert.equal(ctx.opposition, true);
  assert.equal(ctx.name, "FIXER");
  assert.equal(ctx.img, "");
  assert.equal(ctx.showActions, false);
  assert.equal(ctx.onesCount, 0);
  assert.deepEqual(ctx.ppNotes, []);
});
