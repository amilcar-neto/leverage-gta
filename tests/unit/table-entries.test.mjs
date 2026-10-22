import test from "node:test";
import assert from "node:assert/strict";
import {
  TABLE_LISTS, addToList, cleanEntries, mergeLists, migrateTableState, removeFromList, setDieInList, stepInList
} from "../../module/rules/table-entries.mjs";

let n = 0;
const id = () => `id${++n}`;

test("cleanEntries keeps only entries with an id and a legal die", () => {
  assert.deepEqual(cleanEntries([{ id: "a", name: "x", die: "8" }, { name: "no id", die: 6 }, { id: "b", die: 7 }, null]), [{ id: "a", name: "x", die: 8 }]);
  assert.deepEqual(cleanEntries(undefined), []);
});

test("a new Trait and a new Complication both start at d6; empty names are ignored", () => {
  assert.equal(TABLE_LISTS.globalTraits, 6);
  assert.equal(TABLE_LISTS.complications, 6);
  const list = addToList([], "  Fog ", TABLE_LISTS.globalTraits, id);
  assert.deepEqual(list.map((e) => [e.name, e.die]), [["Fog", 6]]);
  assert.equal(addToList(list, "  ", 6, id).length, 1);
  assert.equal(addToList(list, "x", 7, id).length, 1);
});

test("removeFromList and setDieInList do not mutate and ignore unknown ids and illegal dice", () => {
  const src = [{ id: "a", name: "x", die: 6 }, { id: "b", name: "y", die: 8 }];
  assert.deepEqual(removeFromList(src, "a").map((e) => e.id), ["b"]);
  assert.equal(removeFromList(src, "zzz").length, 2);
  assert.equal(setDieInList(src, "a", 12)[0].die, 12);
  assert.equal(setDieInList(src, "a", 7)[0].die, 6);
  assert.equal(src.length, 2);
  assert.equal(src[0].die, 6);
});

test("stepInList raises and lowers within d4..d12", () => {
  let list = [{ id: "z", name: "A", die: 6 }];
  list = stepInList(list, "z", 1);
  assert.equal(list[0].die, 8);
  list = stepInList(stepInList(stepInList(list, "z", 1), "z", 1), "z", 1);
  assert.equal(list[0].die, 12);
  assert.equal(stepInList(list, "z", -1)[0].die, 10);
  assert.equal(stepInList([{ id: "z", name: "", die: 4 }], "z", -1)[0].die, 4);
});

test("mergeLists appends only the ids it does not have", () => {
  const merged = mergeLists([{ id: "a", name: "x", die: 6 }], [{ id: "a", name: "dup", die: 8 }, { id: "b", name: "y", die: 8 }, { id: "c", die: 3 }]);
  assert.deepEqual(merged.map((e) => [e.id, e.name]), [["a", "x"], ["b", "y"]]);
});

test("migrateTableState moves the Job's lists out of the Job", () => {
  const out = migrateTableState({
    activeJob: { name: "Heist", goal: "G", complications: [{ id: "c", name: "Alarm", die: 8 }], sceneTraits: [{ id: "t", name: "Fog", die: 6 }] },
    globalTraits: [], complications: [{ id: "old", name: "Heat", die: 6 }]
  });
  assert.equal(out.changed, true);
  assert.deepEqual(out.activeJob, { name: "Heist", goal: "G" });
  assert.deepEqual(out.complications.map((e) => e.id), ["old", "c"]);
  assert.deepEqual(out.globalTraits.map((e) => e.id), ["t"]);
});

test("migrateTableState is idempotent and reports nothing to do for a clean Job", () => {
  const first = migrateTableState({ activeJob: { name: "J", complications: [{ id: "c", name: "A", die: 6 }] }, globalTraits: [], complications: [] });
  const again = migrateTableState({ activeJob: first.activeJob, globalTraits: first.globalTraits, complications: first.complications });
  assert.equal(again.changed, false);
  assert.deepEqual(again.complications, first.complications);
  assert.equal(migrateTableState({}).changed, false);
});
