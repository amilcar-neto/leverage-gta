import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Files of a folder tree with one of the given extensions. */
function walk(dir, exts) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path, exts);
    return exts.some((ext) => name.endsWith(ext)) ? [path] : [];
  });
}

const flatten = (o, p = "") =>
  Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flatten(v, `${p}${k}.`) : [`${p}${k}`]));

/** Config identifiers (`LEVERAGE.dice`) start in lower case and have no second segment; i18n keys start in upper case. */

/** A key counts as present when it is a leaf, or the base of plural forms (`<key>.one`, `<key>.other`). */
const hasKey = (keys, key) => keys.has(key) || [...keys].some((k) => k.startsWith(`${key}.`));

test("every literal LEVERAGE.* i18n key used in module/, templates/ and the entry file exists in en.json", () => {
  const keys = new Set(flatten(JSON.parse(readFileSync("lang/en.json", "utf8"))));
  const files = [...walk("module", [".mjs"]), ...walk("templates", [".hbs"]), "leverage-gta.mjs"];
  const used = new Map();
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    for (const [, key] of text.matchAll(/["'`](LEVERAGE\.[A-Z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+)["'`]/g)) {
      if (!used.has(key)) used.set(key, file);
    }
  }
  assert.ok(used.size > 100, "the scan should find the keys");
  const missing = [...used].filter(([key]) => !hasKey(keys, key)).map(([key, file]) => `${key} (${file})`);
  assert.deepEqual(missing, []);
});
