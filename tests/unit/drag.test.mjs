import test from "node:test";
import assert from "node:assert/strict";
import { dropMode, itemPoolRef, macroCommand } from "../../module/applications/actor/parts/drag.mjs";

test("a Distinction drags as its d8 unless the d4 button started the drag", () => {
  const item = { id: "abc", type: "distinction", system: {} };
  assert.equal(itemPoolRef(item), "item:abc:d8");
  assert.equal(itemPoolRef(item, "item:abc:d4"), "item:abc:d4");
  assert.equal(itemPoolRef(item, "item:zzz:d4"), "item:abc:d8");
});

test("only Items with a die give a Pool reference", () => {
  assert.equal(itemPoolRef({ id: "a", type: "asset", system: {} }), "item:a");
  assert.equal(itemPoolRef({ id: "a", type: "specialty", system: {} }), "item:a");
  assert.equal(itemPoolRef({ id: "a", type: "talent", system: { die: 6 } }), "item:a");
  assert.equal(itemPoolRef({ id: "a", type: "talent", system: { die: 0 } }), null);
  assert.equal(itemPoolRef({ id: "a", type: "job", system: {} }), null);
});

test("drop mode: sort, move an owned Job, copy everything else", () => {
  const base = { sameActor: false, type: "job", hasSource: true, ownsSource: true };
  assert.equal(dropMode({ ...base, sameActor: true }), "sort");
  assert.equal(dropMode(base), "move");
  assert.equal(dropMode({ ...base, ownsSource: false }), "copy");
  assert.equal(dropMode({ ...base, hasSource: false, ownsSource: false }), "copy");
  assert.equal(dropMode({ ...base, type: "talent" }), "copy");
});

test("macro command is guarded while game.leverage does not exist", () => {
  const cmd = macroCommand("Actor.x", ["attributes.agility"]);
  assert.match(cmd, /^game\.leverage\?\.rollPool \?/);
  assert.match(cmd, /fromUuidSync\("Actor\.x"\)/);
  assert.match(cmd, /refs: \["attributes\.agility"\]/);
  assert.match(cmd, /ui\.notifications\.warn/);
});
