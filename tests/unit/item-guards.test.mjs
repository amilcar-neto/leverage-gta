import "./helpers/foundry-stub.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { protectedFieldsChanged } from "../../module/documents/guards.mjs";

const player = { isGM: false };
const gm = { isGM: true };
const asset = { type: "asset", system: { die: 6, duration: "scene" } };
const job = (spent) => ({ type: "job", system: { spent } });

test("a player cannot change an Asset's die or duration; the Fixer can", () => {
  assert.deepEqual(protectedFieldsChanged(asset, { system: { die: 12 } }, player), ["system.die"]);
  assert.deepEqual(protectedFieldsChanged(asset, { "system.duration": "signature" }, player), ["system.duration"]);
  assert.deepEqual(protectedFieldsChanged(asset, { system: { die: 12 } }, gm), []);
});

test("other fields stay free for players", () => {
  assert.deepEqual(protectedFieldsChanged(asset, { name: "x", system: { note: "y" } }, player), []);
  assert.deepEqual(protectedFieldsChanged(job(false), { system: { callbackUsed: true } }, player), []);
});

test("a Job's payout share is protected", () => {
  assert.deepEqual(protectedFieldsChanged(job(false), { system: { payout: { share: 9 } } }, player), ["system.payout.share"]);
});

test("spent may go false to true (Train Up) but never back", () => {
  assert.deepEqual(protectedFieldsChanged(job(false), { "system.spent": true }, player), []);
  assert.deepEqual(protectedFieldsChanged(job(false), { system: { spent: true } }, player), []);
  assert.deepEqual(protectedFieldsChanged(job(true), { system: { spent: false } }, player), ["system.spent"]);
  assert.deepEqual(protectedFieldsChanged(job(true), { system: { spent: true } }, player), ["system.spent"]);
  assert.deepEqual(protectedFieldsChanged(job(false), { system: { spent: false } }, player), ["system.spent"]);
});

test("an Asset's boost is Fixer-only (the Fixer's Opportunity write still passes)", () => {
  assert.deepEqual(protectedFieldsChanged(asset, { system: { boost: 4 } }, player), ["system.boost"]);
  assert.deepEqual(protectedFieldsChanged(asset, { "system.boost": 4 }, player), ["system.boost"]);
  assert.deepEqual(protectedFieldsChanged(asset, { "system.boost": 1 }, gm), []);
});
