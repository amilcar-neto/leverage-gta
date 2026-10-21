import { test } from "node:test";
import assert from "node:assert/strict";
import { DicePool, parseRef, poolMenuGroups, resolvePoolRef } from "../../module/dice/pool.mjs";

const item = (id, type, name, system = {}) => [id, { id, type, name, system }];
const actor = {
  system: {
    attributes: { agility: { die: 10 }, strength: { die: 6 } },
    roles: { thief: { die: 10 }, hitter: { die: 6 }, hacker: { die: null } },
    money: { steps: 8 }
  },
  items: new Map([
    item("sp1", "specialty", "Safecracking", { role: "thief", die: 6 }),
    item("sp2", "specialty", "Getaway Driving", { role: "hitter", die: 6 }),
    item("di1", "distinction", "Old Docks Loyalty"),
    item("di2", "distinction", "Adrenaline Junkie"),
    item("as1", "asset", "Hatchback", { die: 8 }),
    item("ta1", "talent", "Nerve", { die: 6 }),
    item("ta2", "talent", "Ghost", { die: null }),
    item("jb1", "job", "Dockside")
  ])
};

const make = (opts) => new DicePool((ref) => resolvePoolRef(actor, ref, opts));
const kinds = (pool) => pool.entries().map((e) => e.kind);

test("parseRef reads every reference shape and rejects the rest", () => {
  assert.deepEqual(parseRef("attributes.agility"), { type: "attributes", key: "agility" });
  assert.deepEqual(parseRef("item:abc:d4"), { type: "item", id: "abc", size: 4 });
  assert.deepEqual(parseRef("item:abc"), { type: "item", id: "abc", size: undefined });
  assert.deepEqual(parseRef("d6"), { type: "die", size: 6 });
  assert.deepEqual(parseRef("money"), { type: "money" });
  for (const bad of ["d20", "d5", "", "item:", "foo", null, 5]) assert.equal(parseRef(bad), null, String(bad));
});

test("the mockup Pool: Agility + Thief + Safecracking + Old Docks d8 is 4 dice, keep 2", () => {
  const pool = make();
  for (const ref of ["roles.thief", "attributes.agility", "item:sp1", "item:di1:d8"]) pool.toggle(ref);
  assert.equal(pool.count, 4);
  assert.equal(pool.keep, 2);
  assert.deepEqual(kinds(pool), ["attribute", "role", "specialty", "distinction"]);
  assert.deepEqual(pool.entries().map((e) => e.die), [10, 10, 6, 8]);
  assert.equal(pool.canRoll, true);
});

test("an empty Pool lacks an Attribute and a Role", () => {
  const pool = make();
  assert.deepEqual(pool.problems, ["noAttribute", "noRole"]);
  assert.equal(pool.canRoll, false);
  pool.toggle("attributes.agility");
  assert.deepEqual(pool.problems, ["noRole"]);
});

test("a new Attribute or Role replaces the old one", () => {
  const pool = make();
  pool.toggle("attributes.agility");
  pool.toggle("attributes.strength");
  pool.toggle("roles.thief");
  pool.toggle("roles.hitter");
  assert.deepEqual(pool.refs, ["attributes.strength", "roles.hitter"]);
});

test("clicking again takes a Trait out", () => {
  const pool = make();
  assert.equal(pool.toggle("item:as1"), "added");
  assert.equal(pool.toggle("item:as1"), "removed");
  assert.equal(pool.count, 0);
  assert.equal(pool.toggle("item:di1:d4"), "added");
  assert.equal(pool.toggle("item:di1:d4"), "removed");
});

test("only one Distinction per roll: another one, or the other die, replaces it", () => {
  const pool = make();
  pool.toggle("item:di1:d8");
  pool.toggle("item:di2:d8");
  assert.deepEqual(pool.refs, ["item:di2:d8"]);
  pool.toggle("item:di2:d4");
  assert.deepEqual(pool.refs, ["item:di2:d4"]);
  assert.equal(pool.entries()[0].hinders, true);
});

test("a tray chip click: Distinction goes d8, d4, out; others go out", () => {
  const pool = make();
  pool.toggle("attributes.agility");
  pool.toggle("item:di1:d8");
  assert.equal(pool.cycle("item:di1:d8"), "stepped");
  assert.deepEqual(pool.refs, ["attributes.agility", "item:di1:d4"]);
  assert.equal(pool.entries()[1].hinders, true);
  assert.equal(pool.cycle("item:di1:d4"), "removed");
  assert.equal(pool.cycle("item:di1:d4"), "ignored");
  assert.equal(pool.cycle("attributes.agility"), "removed");
  assert.deepEqual(pool.refs, []);
});

test("Scene Traits of the active Job resolve by id and vanish when the Job changes", () => {
  const traits = [{ id: "s1", name: "Dark alley", die: 8 }];
  assert.deepEqual(parseRef("scene:s1"), { type: "scene", id: "s1" });
  assert.deepEqual(resolvePoolRef(actor, "scene:s1", { sceneTraits: traits }), { kind: "scene", name: "Dark alley", die: 8 });
  const pool = new DicePool((ref) => resolvePoolRef(actor, ref, { sceneTraits: traits }));
  pool.add("scene:s1");
  assert.equal(pool.entries()[0].optional, true);
  traits.length = 0;
  assert.deepEqual(pool.entries(), []);
  assert.equal(resolvePoolRef(actor, "scene:s1"), null);
});

test("a blank Role blocks the roll and does not count as a die", () => {
  const pool = make();
  pool.toggle("attributes.agility");
  pool.toggle("roles.hacker");
  assert.deepEqual(pool.problems, ["blankRole"]);
  assert.equal(pool.count, 1);
  assert.equal(pool.entries()[1].blank, true);
  pool.toggle("roles.thief");
  assert.equal(pool.canRoll, true);
});

test("a Specialty of another Role is flagged, not blocked", () => {
  const pool = make();
  pool.toggle("roles.thief");
  pool.toggle("item:sp2");
  const spec = pool.entries().find((e) => e.kind === "specialty");
  assert.equal(spec.warn, "specialtyRole");
  assert.equal(pool.count, 2);
  pool.toggle("item:sp2");
  pool.toggle("item:sp1");
  assert.equal(pool.entries().find((e) => e.kind === "specialty").warn, null);
});

test("loose dice may repeat, and remove takes one copy at a time", () => {
  const pool = make();
  pool.addDie(6);
  pool.addDie(6);
  pool.addDie(12);
  assert.equal(pool.count, 3);
  assert.equal(pool.remove("d6"), true);
  assert.equal(pool.count, 2);
  assert.equal(pool.addDie(20), false);
  assert.equal(pool.addDie(7), false);
});

test("Money adds the largest die, only with the rule on and some money", () => {
  const pool = make();
  assert.equal(pool.add("money"), true);
  assert.equal(pool.entries()[0].die, 12, "8 steps = d8 + d12");
});

test("Money with the rule off or no money is refused", () => {
  assert.equal(make({ moneyEnabled: false }).add("money"), false);
  const broke = new DicePool((ref) => resolvePoolRef({ ...actor, system: { ...actor.system, money: { steps: 0 } } }, ref));
  assert.equal(broke.add("money"), false);
});

test("Talents only give dice when they have one; Jobs never do", () => {
  const pool = make();
  assert.equal(pool.add("item:ta1"), true);
  assert.equal(pool.add("item:ta2"), false);
  assert.equal(pool.add("item:jb1"), false);
  assert.equal(pool.add("item:missing"), false);
  assert.equal(pool.count, 1);
});

test("entries drop references that stopped resolving (a deleted Item)", () => {
  const items = new Map(actor.items);
  const pool = new DicePool((ref) => resolvePoolRef({ ...actor, items }, ref));
  pool.toggle("item:as1");
  items.delete("as1");
  assert.equal(pool.count, 0);
  assert.deepEqual(pool.refs, []);
});

test("clear empties the Pool", () => {
  const pool = make();
  pool.toggle("roles.thief");
  pool.clear();
  assert.deepEqual(pool.refs, []);
});

const menuSuite = () => {
  const items = [
    { id: "a1", type: "asset", name: "Van", system: { die: 8 } },
    { id: "s1", type: "specialty", name: "Lockpicks", system: { die: 6, role: "thief" } },
    { id: "d1", type: "distinction", name: "Ex-con", system: {} },
    { id: "t1", type: "talent", name: "Ghost", system: { die: 6 } },
    { id: "t2", type: "talent", name: "No die", system: { die: null } },
    { id: "j1", type: "job", name: "Job", system: {} }
  ];
  const actor = {
    items: { get: (id) => items.find((i) => i.id === id), [Symbol.iterator]: () => items[Symbol.iterator]() },
    system: { attributes: { agility: { die: 8 }, vitality: { die: null } }, roles: { thief: { die: 10 } }, money: { steps: 4 } }
  };
  const keys = (groups) => groups.map((g) => g.key);

  test("offers every rollable thing, grouped in config order", () => {
    const groups = poolMenuGroups(actor, () => false);
    assert.deepEqual(keys(groups), ["die", "money", "asset", "specialty", "distinction", "talent", "attribute", "role"]);
    const get = (key) => groups.find((g) => g.key === key).entries;
    assert.deepEqual(get("talent").map((e) => e.label), ["Ghost"]);
    assert.deepEqual(get("attribute").map((e) => e.ref), ["attributes.agility"]);
    assert.equal(get("distinction")[0].die, 8);
  });

  test("leaves out what is in the Pool, except loose dice, and hides Money when the rule is off", () => {
    const inPool = (ref) => ["item:a1", "money"].includes(ref);
    const groups = poolMenuGroups(actor, inPool, { moneyEnabled: false });
    assert.ok(!keys(groups).includes("asset"));
    assert.ok(!keys(groups).includes("money"));
    assert.ok(keys(groups).includes("die"));
  });

  test("includePooled keeps what is in the Pool and marks it", () => {
    const inPool = (ref) => ["item:a1", "money", "roles.thief"].includes(ref);
    const groups = poolMenuGroups(actor, inPool, { includePooled: true });
    const get = (key) => groups.find((g) => g.key === key).entries;
    assert.equal(get("asset")[0].pooled, true);
    assert.equal(get("money")[0].pooled, true);
    assert.equal(get("role")[0].pooled, true);
    assert.equal(get("attribute")[0].pooled, false);
  });

  test("lists Scene Traits of the active Job", () => {
    const groups = poolMenuGroups(actor, () => false, { sceneTraits: [{ id: "x", name: "Rain", die: 6 }] });
    assert.equal(groups.find((g) => g.key === "scene").entries[0].ref, "scene:x");
  });
};
menuSuite();
