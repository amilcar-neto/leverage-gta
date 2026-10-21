import { test } from "node:test";
import assert from "node:assert/strict";
import { nextDie, buildRows } from "../../module/applications/actor/parts/ladders.mjs";

const t = (key, data) => (data ? `${key}:${data.trait}:${data.die}` : key);

test("nextDie: a new die is written", () => {
  assert.equal(nextDie("attributes", 6, 10), 10);
  assert.equal(nextDie("roles", null, 8), 8);
});

test("nextDie: clicking the current Role die clears it, an Attribute never goes blank", () => {
  assert.equal(nextDie("roles", 8, 8), null);
  assert.equal(nextDie("attributes", 8, 8), undefined);
});

test("nextDie: rejects invalid dice", () => {
  assert.equal(nextDie("roles", 6, 7), undefined);
  assert.equal(nextDie("roles", 6, NaN), undefined);
});

test("buildRows: blank Role has no pressed die and everything muted", () => {
  const [grifter] = buildRows({ group: "roles", values: { grifter: { die: null } }, canEdit: true, locked: false, t });
  assert.equal(grifter.blank, true);
  assert.ok(grifter.ladder.every((d) => d.muted && !d.pressed));
});

test("buildRows: locked rows have no action and a lock tooltip", () => {
  const rows = buildRows({ group: "attributes", values: { agility: { die: 8 } }, canEdit: false, locked: true, t });
  const lad = rows[0].ladder;
  assert.equal(lad.length, 5);
  assert.ok(lad.every((d) => d.action === undefined && d.title.startsWith("d")));
  assert.equal(lad.find((d) => d.die === 8).muted, false);
  assert.equal(rows[0].poolRef, "attributes.agility");
});
