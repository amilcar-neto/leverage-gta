import { test } from "node:test";
import assert from "node:assert/strict";
import { locationTraitEntries, mergeSceneTraits, viewedLocations } from "../../module/scene-location.mjs";

const loc = (id, scene = "") => ({ id, type: "location", system: { scene, traits: [] } });
const scene = { uuid: "Scene.a" };

test("viewedLocations: linked by scene field, joined with token Locations, no repeats", () => {
  const a = loc("a", "Scene.a");
  const b = loc("b", "Scene.other");
  const c = loc("c");
  const result = viewedLocations(scene, [a, b, c, { id: "n", type: "npc", system: { scene: "Scene.a" } }], [{ actor: a }, { actor: c }, { actor: null }, { actor: { id: "n", type: "npc" } }]);
  assert.deepEqual(result.map((x) => x.id), ["a", "c"]);
});

test("viewedLocations: no scene gives nothing", () => {
  assert.deepEqual(viewedLocations(null, [loc("a", "Scene.a")], []), []);
});

const ok = (d) => [4, 6, 8].includes(d);
const withTraits = (traits) => ({ id: "x", system: { traits } });
const ids = (traits) => locationTraitEntries([withTraits(traits)], ok).map((e) => `${e.name}=${e.id}`);

test("locationTraitEntries: blanks and bad dice skipped, id from actor + slug + order", () => {
  const l = withTraits([{ name: " Dark Alley ", die: 8 }, { name: "", die: 6 }, { name: "Bad", die: 7 }]);
  assert.deepEqual(locationTraitEntries([l], ok), [{ id: "x-dark-alley-0", name: "Dark Alley", die: 8 }]);
});

test("locationTraitEntries: reordering keeps ids", () => {
  const a = { name: "Rain", die: 6 };
  const b = { name: "Fog", die: 8 };
  const before = Object.fromEntries(locationTraitEntries([withTraits([a, b])], ok).map((e) => [e.name, e.id]));
  const after = Object.fromEntries(locationTraitEntries([withTraits([b, a])], ok).map((e) => [e.name, e.id]));
  assert.deepEqual(before, after);
});

test("locationTraitEntries: deleting or renaming makes the id vanish", () => {
  const all = ids([{ name: "Rain", die: 6 }, { name: "Fog", die: 8 }]);
  assert.ok(all.includes("Fog=x-fog-0"));
  assert.ok(!ids([{ name: "Rain", die: 6 }]).some((x) => x.includes("x-fog-0")));
  assert.ok(!ids([{ name: "Rain", die: 6 }, { name: "Mist", die: 8 }]).some((x) => x.includes("x-fog-0")));
});

test("locationTraitEntries: repeated names get distinct ids; same name on two Locations does too", () => {
  assert.deepEqual(ids([{ name: "Dark", die: 4 }, { name: "dark", die: 6 }]), ["Dark=x-dark-0", "dark=x-dark-1"]);
  const all = locationTraitEntries([withTraits([{ name: "Dark", die: 4 }]), { id: "y", system: { traits: [{ name: "Dark", die: 4 }] } }], ok);
  assert.equal(new Set(all.map((e) => e.id)).size, 2);
});

test("mergeSceneTraits: flag Traits first, then Location Traits", () => {
  const merged = mergeSceneTraits([{ id: "f", name: "Flag", die: 6 }], [withTraits([{ name: "Loc", die: 8 }])], ok);
  assert.deepEqual(merged.map((e) => e.name), ["Flag", "Loc"]);
});
