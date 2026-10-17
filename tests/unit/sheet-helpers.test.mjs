import "./helpers/foundry-stub.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeActions } from "../../module/applications/actor/parts/merge-actions.mjs";
import { sealState } from "../../module/applications/components/lock-seal.mjs";
import { needsDeleteConfirm } from "../../module/applications/components/confirm-delete.mjs";
import { menuPosition } from "../../module/applications/components/float-menu.mjs";
import { chipOf, trayContext } from "../../module/applications/actor/parts/tray.mjs";
import { renderDie } from "../../module/applications/components/die.mjs";
import { LOCK_HOOK } from "../../module/config.mjs";

test("mergeActions joins the tables and throws on a repeated name", () => {
  const a = () => {};
  const b = () => {};
  assert.deepEqual(Object.keys(mergeActions([{ a }, { b }])), ["a", "b"]);
  assert.throws(() => mergeActions([{ a }, { a: b }]), /Duplicate crew sheet action "a"/);
});

test("the real crew sheet parts share no action name", async () => {
  const { partActions } = await import("../../module/applications/actor/parts/_module.mjs");
  assert.ok(Object.keys(partActions).includes("setDie"));
});

test("seal mirrors the setting; the GM gets a different hint when locked", () => {
  assert.equal(sealState(true, false).hint, "LEVERAGE.Sheet.Seal.lockedHint");
  assert.equal(sealState(true, true).hint, "LEVERAGE.Sheet.Seal.lockedGmHint");
  assert.equal(sealState(false, true).hint, "LEVERAGE.Sheet.Seal.unlockedHint");
  assert.equal(sealState(false, false).icon, "fa-lock-open");
  assert.equal(sealState(true, true).icon, "fa-lock");
  assert.equal(sealState(true, true).label, "LEVERAGE.Sheet.Seal.locked");
  assert.equal(LOCK_HOOK, "leverage.traitsLockedChanged");
});

test("only Jobs and Signature Assets ask before deleting", () => {
  assert.equal(needsDeleteConfirm({ type: "job" }), true);
  assert.equal(needsDeleteConfirm({ type: "asset", system: { duration: "signature" } }), true);
  assert.equal(needsDeleteConfirm({ type: "asset", system: { duration: "scene" } }), false);
  assert.equal(needsDeleteConfirm({ type: "asset", system: { duration: "job" } }), false);
  for (const type of ["distinction", "talent", "specialty"]) assert.equal(needsDeleteConfirm({ type }), false, type);
});

test("float menu position is relative to the frame", () => {
  const frame = { left: 100, top: 50, bottom: 1000 };
  const box = { left: 140, top: 300, bottom: 320 };
  assert.deepEqual(menuPosition(frame, box, "below"), { left: "40px", top: "272px" });
  assert.deepEqual(menuPosition(frame, box, "above"), { left: "40px", bottom: "704px" });
});

/** Fake Pool that counts how often the entries are resolved. */
function fakePool(entries, problems = []) {
  const pool = { reads: 0, keep: 2, problems, entries() { pool.reads += 1; return entries; } };
  return pool;
}

test("tray context reads the entries once and counts only rated dice", () => {
  const t = (key) => key;
  const entry = (ref, kind, die, extra = {}) => ({ ref, kind, die, name: ref, optional: kind !== "attribute" && kind !== "role", blank: die === null, warn: null, ...extra });
  const pool = fakePool([entry("attributes.agility", "attribute", 8), entry("roles.thief", "role", null), entry("d6", "die", 6)], ["blankRole"]);
  const ctx = trayContext(pool, t);
  assert.equal(pool.reads, 1);
  assert.equal(ctx.count, 2);
  assert.equal(ctx.canRoll, false);
  assert.equal(ctx.optional.length, 1);
  assert.equal(chipOf(entry("d6", "die", 6), t).ref, "d6");
});

test("die buttons carry data-die", () => {
  assert.ok(renderDie({ die: 10, action: "setDie" }).includes('data-die="10"'));
  assert.ok(!renderDie({ die: 10 }).includes("data-die"));
});
