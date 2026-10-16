import test from "node:test";
import assert from "node:assert/strict";
import { deriveRoleRanks } from "../../module/rules/roles.mjs";
import { LEVERAGE } from "../../module/config.mjs";

const blank = () => Object.fromEntries(Object.keys(LEVERAGE.roles).map((k) => [k, { die: null }]));
const ranks = (roles) => Object.fromEntries(Object.entries(roles).map(([k, r]) => [k, r.primary ? "P" : r.secondary ? "S" : ""]));

test("highest die is primary, second highest secondary", () => {
  const [a, b, c] = Object.keys(LEVERAGE.roles);
  const roles = blank();
  Object.assign(roles[a], { die: 6 });
  Object.assign(roles[b], { die: 10 });
  Object.assign(roles[c], { die: 8 });
  deriveRoleRanks(roles);
  assert.equal(ranks(roles)[b], "P");
  assert.equal(ranks(roles)[c], "S");
  assert.equal(ranks(roles)[a], "");
});

test("ties break by the fixed role order", () => {
  const keys = Object.keys(LEVERAGE.roles);
  const roles = blank();
  roles[keys[1]].die = 8;
  roles[keys[3]].die = 8;
  deriveRoleRanks(roles);
  assert.equal(ranks(roles)[keys[1]], "P");
  assert.equal(ranks(roles)[keys[3]], "S");
});

test("blank roles never rank", () => {
  const roles = blank();
  deriveRoleRanks(roles);
  assert.ok(Object.values(roles).every((r) => !r.primary && !r.secondary));
  roles[Object.keys(roles)[0]].die = 4;
  deriveRoleRanks(roles);
  assert.equal(Object.values(roles).filter((r) => r.primary).length, 1);
  assert.equal(Object.values(roles).filter((r) => r.secondary).length, 0);
});
