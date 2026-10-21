import "./helpers/foundry-stub.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { resolvePoolRef } from "../../module/dice/pool.mjs";

// api.mjs pulls in the Fixer tools, whose modules extend ApplicationV2 at import time.
const { ApplicationV2 = class {}, HandlebarsApplicationMixin = (base) => base } = globalThis.foundry.applications?.api ?? {};
globalThis.foundry.applications ??= { api: { ApplicationV2, HandlebarsApplicationMixin } };
const { normalizeRef, checkPoolRefs, checkAmount, checkPrice, checkStars } = await import("../../module/api.mjs");

const actor = {
  system: {
    attributes: { agility: { die: 8 }, vitality: { die: null } },
    roles: { thief: { die: 10 }, hacker: { die: null } },
    money: { steps: 4 }
  },
  items: new Map([
    ["d1", { type: "distinction", name: "Cocky" }],
    ["d2", { type: "distinction", name: "Loyal" }]
  ])
};
const resolve = (ref) => resolvePoolRef(actor, ref);
const check = (refs) => checkPoolRefs(refs, resolve);

test("normalizeRef accepts numbers and upper-case dice", () => {
  assert.equal(normalizeRef(6), "d6");
  assert.equal(normalizeRef(" D8 "), "d8");
  assert.equal(normalizeRef("attributes.agility"), "attributes.agility");
  assert.equal(normalizeRef(null), "");
});

test("a valid Pool has entries in tray order", () => {
  const r = check(["d6", "roles.thief", "attributes.agility"]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.entries.map((e) => e.ref), ["attributes.agility", "roles.thief", "d6"]);
});

test("a Pool needs one rated Attribute and one rated Role", () => {
  assert.equal(check(["roles.thief"]).error, "Pool.noAttribute");
  assert.equal(check(["attributes.agility"]).error, "Pool.noRole");
  assert.equal(check(["attributes.vitality", "roles.thief"]).error, "Pool.blankAttribute");
  assert.equal(check(["attributes.agility", "roles.hacker"]).error, "Pool.blankRole");
  assert.equal(check([]).error, "Pool.empty");
  assert.equal(check("d6").error, "Pool.empty");
});

test("unknown refs and duplicated slots are refused", () => {
  assert.deepEqual(check(["attributes.agility", "roles.thief", "item:zzz"]), { ok: false, error: "Pool.unknownRef", data: { ref: "item:zzz" } });
  assert.equal(check(["attributes.agility", "roles.thief", "d7"]).error, "Pool.unknownRef");
  assert.equal(check(["attributes.agility", "attributes.agility", "roles.thief"]).error, "Pool.tooMany");
  assert.equal(check(["attributes.agility", "roles.thief", "item:d1", "item:d2:d4"]).error, "Pool.tooMany");
});

test("loose dice may repeat and the money die enters the Pool", () => {
  const r = check(["attributes.agility", "roles.thief", 6, 6, "money"]);
  assert.equal(r.ok, true);
  assert.equal(r.entries.filter((e) => e.kind === "die").length, 2);
  assert.equal(r.entries.some((e) => e.kind === "money"), true);
});

test("checkAmount takes whole numbers from zero", () => {
  assert.deepEqual(checkAmount(3), { ok: true, value: 3 });
  assert.deepEqual(checkAmount("2"), { ok: true, value: 2 });
  for (const bad of [-1, 1.5, "x", NaN, undefined]) assert.equal(checkAmount(bad).ok, false);
});

test("checkPrice takes steps or a list of dice", () => {
  assert.deepEqual(checkPrice(2), { ok: true, steps: 2 });
  assert.equal(checkPrice([12, 6]).ok, true);
  assert.equal(checkPrice([12, 6]).steps > 0, true);
  for (const bad of [[], [7], "a", -3]) assert.equal(checkPrice(bad).error, "invalidPrice");
});

test("checkStars validates level 0-5 and the city", () => {
  const scales = [{ id: "liberty" }, { id: "vice" }];
  assert.deepEqual(checkStars(3, "vice", scales), { ok: true, level: 3, city: "vice" });
  assert.equal(checkStars(0, undefined, scales).ok, true);
  assert.equal(checkStars(6, undefined, scales).error, "Stars.invalidLevel");
  assert.equal(checkStars(-1, undefined, scales).error, "Stars.invalidLevel");
  assert.equal(checkStars(2.5, undefined, scales).error, "Stars.invalidLevel");
  assert.equal(checkStars(2, "nowhere", scales).error, "Stars.unknownCity");
});
