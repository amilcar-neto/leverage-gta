import test from "node:test";
import assert from "node:assert/strict";
import { roleMenuEntries } from "../../module/applications/actor/parts/lists.mjs";
import { LEVERAGE } from "../../module/config.mjs";

test("role menu lists every Role once and marks the current one", () => {
  const keys = Object.keys(LEVERAGE.roles);
  const entries = roleMenuEntries(keys, keys[2]);
  assert.deepEqual(entries.map((e) => e.key), keys);
  assert.deepEqual(entries.filter((e) => e.current).map((e) => e.key), [keys[2]]);
  assert.equal(entries[0].label, LEVERAGE.roles[keys[0]].label);
});

test("role menu marks nothing for an unknown Role", () => {
  assert.equal(roleMenuEntries(Object.keys(LEVERAGE.roles), "open").some((e) => e.current), false);
});
