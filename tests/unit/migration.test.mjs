import { test } from "node:test";
import assert from "node:assert/strict";
import { compareVersions, pendingMigrations, migrateWorld, MIGRATIONS } from "../../module/migration.mjs";

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

/** Installs minimal Foundry globals for migrateWorld and returns the recorded calls. */
function fakeFoundry({ stored, current = "0.3.0", failSet = false }) {
  const calls = { sets: [], errors: [] };
  globalThis.game = {
    user: { isGM: true },
    system: { version: current },
    i18n: { localize: (k) => k },
    settings: {
      get: () => stored,
      set: async (_s, _k, v) => {
        if (failSet) throw new Error("set failed");
        calls.sets.push(v);
      }
    }
  };
  globalThis.ui = { notifications: { error: (m) => calls.errors.push(m) } };
  return calls;
}

test("migrateWorld saves each step, then the current version", async () => {
  const calls = fakeFoundry({ stored: "0.1.0" });
  MIGRATIONS.push({ version: "0.2.0", run: async () => {} });
  try {
    assert.equal(await migrateWorld(), true);
  } finally {
    MIGRATIONS.length = 0;
  }
  assert.deepEqual(calls.sets, ["0.2.0", "0.3.0"]);
});

test("migrateWorld on failure notifies, keeps the last good version and does not throw", async () => {
  const calls = fakeFoundry({ stored: "0.1.0" });
  MIGRATIONS.push({ version: "0.2.0", run: async () => {} }, {
    version: "0.3.0", run: async () => { throw new Error("boom"); }
  });
  const origError = console.error;
  console.error = () => {};
  try {
    assert.equal(await migrateWorld(), false);
  } finally {
    console.error = origError;
    MIGRATIONS.length = 0;
  }
  assert.deepEqual(calls.sets, ["0.2.0"]);
  assert.deepEqual(calls.errors, ["LEVERAGE.Migration.failed"]);
});

test("migrateWorld never overwrites a newer stored version (downgrade)", async () => {
  const calls = fakeFoundry({ stored: "0.5.0", current: "0.3.0" });
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await migrateWorld(), false);
  } finally {
    console.warn = origWarn;
  }
  assert.deepEqual(calls.sets, []);
});
