import test from "node:test";
import assert from "node:assert/strict";
import {
  GANG_MAX, addTrait, clampGang, dieLadder, isDiePath, nextNpcDie, opposeDiceCount, patchTrait, removeTrait, showsGang, showsLadders,
  showsVitalsFor, stepDie, traitRows
} from "../../module/applications/actor/npc-logic.mjs";
import { npcSources, npcTraitKey } from "../../module/dice/opposition.mjs";

const names = { attribute: (k) => k, role: (k) => k, trait: "Trait", weapon: "Weapon" };

test("only Foil and Agent show Attributes and Roles", () => {
  assert.deepEqual(["extra", "foil", "mark", "agent"].map(showsLadders), [false, true, false, true]);
});

test("a ladder click sets the die, or clears it when it is the current one", () => {
  assert.equal(nextNpcDie(null, 8), 8);
  assert.equal(nextNpcDie(6, 8), 8);
  assert.equal(nextNpcDie(8, 8), null);
  assert.equal(nextNpcDie(6, 7), undefined);
});

test("stepDie moves one rung and stops at the ends", () => {
  assert.equal(stepDie(6, 1), 8);
  assert.equal(stepDie(6, -1), 4);
  assert.equal(stepDie(4, -1), 4);
  assert.equal(stepDie(12, 1), 12);
  assert.equal(stepDie(99, 1), 8, "an unknown die starts from the default die");
});

test("gang size is a whole number from 0 to the maximum", () => {
  assert.equal(clampGang(3.9), 3);
  assert.equal(clampGang(-2), 0);
  assert.equal(clampGang(99), GANG_MAX);
  assert.equal(clampGang("abc"), 0);
});

test("Trait list edits return new lists and never touch the input", () => {
  const list = [{ name: "Cop", die: 8 }, { name: "Dog", die: 6 }];
  const added = addTrait(list);
  assert.equal(added.length, 3);
  assert.equal(added[2].name, "");
  assert.equal(list.length, 2);
  assert.deepEqual(removeTrait(list, 0), [{ name: "Dog", die: 6 }]);
  assert.deepEqual(removeTrait(list, 5), list);
  assert.deepEqual(patchTrait(list, 1, { die: 10 }), [{ name: "Cop", die: 8 }, { name: "Dog", die: 10 }]);
  assert.deepEqual(patchTrait(list, 9, { die: 10 }), list);
  assert.equal(list[1].die, 6);
});

test("trait rows carry the roller key and whether the arrows can move", () => {
  const rows = traitRows([{ name: "A", die: 4 }, { name: "B", die: 12 }, { name: "C", die: 8 }], npcTraitKey);
  assert.deepEqual(rows.map((r) => r.sourceKey), ["npc.trait.0", "npc.trait.1", "npc.trait.2"]);
  assert.deepEqual(rows.map((r) => [r.canDown, r.canUp]), [[false, true], [true, false], [true, true]]);
  assert.deepEqual(traitRows(undefined, npcTraitKey), []);
});

test("one-line die ladder marks the current die and drops the action when read-only", () => {
  const edit = dieLadder(8, true, (d) => `d${d}`);
  assert.equal(edit.length, 5);
  assert.deepEqual(edit.filter((d) => d.pressed).map((d) => d.die), [8]);
  assert.ok(edit.every((d) => d.action === "setDie"));
  assert.ok(dieLadder(null, false, String).every((d) => d.muted && !d.action));
});

test("only known die paths may be written by a ladder click", () => {
  for (const ok of ["system.gang.die", "system.weapon.die", "system.attributes.agility.die", "system.roles.hitter.die"]) assert.ok(isDiePath(ok), ok);
  for (const bad of ["system.life.value", "system.gang.size", "system.attributes.die", "name", undefined]) assert.ok(!isDiePath(bad), String(bad));
});

test("ROLL AS OPPOSITION counts every die plus the gang", () => {
  const system = {
    traits: [{ name: "Boss", die: 10 }], attributes: { agility: { die: 6 }, vitality: { die: null } }, roles: { hitter: { die: 8 } },
    weapon: { die: 8 }, gang: { size: 3, die: 6 }
  };
  assert.equal(npcSources(system, names).length, 4, "trait, attribute, role and weapon");
  assert.equal(opposeDiceCount(system, names), 7);
  assert.equal(opposeDiceCount({ ...system, gang: { size: 3, die: null } }, names), 4, "a gang without a die adds nothing");
});

test("the weapon is a roller source only when the caller names it", () => {
  const system = { traits: [], attributes: {}, roles: {}, weapon: { die: 6 } };
  assert.deepEqual(npcSources(system, { ...names, weapon: undefined }), []);
  assert.deepEqual(npcSources(system, names), [{ key: "npc.weapon", label: "Weapon", die: 6 }]);
});

test("extras have no Life or Vest; the gang panel shows for extras or any gang", () => {
  assert.deepEqual(["extra", "foil", "mark", "agent"].map(showsVitalsFor), [false, true, true, true]);
  assert.equal(showsGang("extra", 0), true);
  assert.equal(showsGang("foil", 0), false);
  assert.equal(showsGang("mark", 3), true);
});
