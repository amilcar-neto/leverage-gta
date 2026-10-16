import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const flatten = (o, p = "") =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flatten(v, `${p}${k}.`) : [`${p}${k}`]));
const load = (l) => flatten(JSON.parse(readFileSync(`lang/${l}.json`, "utf8"))).sort();

test("en.json and pt-BR.json have the same keys", () => {
  const en = load("en");
  const pt = load("pt-BR");
  assert.deepEqual(en.filter((k) => !pt.includes(k)), [], "missing in pt-BR");
  assert.deepEqual(pt.filter((k) => !en.includes(k)), [], "missing in en");
});
