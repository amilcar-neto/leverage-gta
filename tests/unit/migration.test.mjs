import { test } from "node:test";
import assert from "node:assert/strict";
import { compareVersions, pendingMigrations, MIGRATIONS } from "../../module/migration.mjs";

test("compareVersions orders numerically, not lexically", () => {
  assert.ok(compareVersions("0.10.0", "0.9.9") > 0);
  assert.equal(compareVersions("0.1", "0.1.0"), 0);
  assert.ok(compareVersions("0.0.1", "0.1.0") < 0);
});

test("pendingMigrations skips fresh worlds and already-applied steps", () => {
  const list = [{ version: "0.3.0" }, { version: "0.2.0" }, { version: "0.1.0" }, { version: "0.4.0" }];
  assert.deepEqual(pendingMigrations("", "0.3.0", list), []);
  assert.deepEqual(pendingMigrations("0.1.0", "0.3.0", list).map((m) => m.version), ["0.2.0", "0.3.0"]);
  assert.deepEqual(pendingMigrations("0.3.0", "0.3.0", list), []);
});

test("release 0.1.0 ships with no pending migrations", () => {
  assert.deepEqual(pendingMigrations("0.0.1", "0.1.0"), []);
  assert.ok(Array.isArray(MIGRATIONS));
});
