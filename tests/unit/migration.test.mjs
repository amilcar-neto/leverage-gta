import { test } from "node:test";
import assert from "node:assert/strict";
import { compareVersions, pendingMigrations, migrateWorld, migrateTableStateWorld, migrateActiveJobWorld, MIGRATIONS } from "../../module/migration.mjs";

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
  const real = MIGRATIONS.splice(0);
  MIGRATIONS.push({ version: "0.2.0", run: async () => {} });
  try {
    assert.equal(await migrateWorld(), true);
  } finally {
    MIGRATIONS.splice(0, MIGRATIONS.length, ...real);
  }
  assert.deepEqual(calls.sets, ["0.2.0", "0.3.0"]);
});

test("migrateWorld on failure notifies, keeps the last good version and does not throw", async () => {
  const calls = fakeFoundry({ stored: "0.1.0" });
  const real = MIGRATIONS.splice(0);
  MIGRATIONS.push({ version: "0.2.0", run: async () => {} }, {
    version: "0.3.0", run: async () => { throw new Error("boom"); }
  });
  const origError = console.error;
  console.error = () => {};
  try {
    assert.equal(await migrateWorld(), false);
  } finally {
    console.error = origError;
    MIGRATIONS.splice(0, MIGRATIONS.length, ...real);
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

test("0.1.1 is registered: it runs for a world saved at 0.1.0 and not for a fresh one", () => {
  assert.deepEqual(pendingMigrations("0.1.0", "0.1.1").map((m) => m.version), ["0.1.1"]);
  assert.deepEqual(pendingMigrations("", "0.1.1"), []);
  assert.deepEqual(pendingMigrations("0.1.1", "0.1.1"), []);
});

/** Fake world with settings and Scenes for the 0.1.1 migration. */
function tableWorld({ activeJob, globalTraits = [], complications = [], flagged = [] }) {
  const store = { activeJob, globalTraits, complications };
  const unset = [];
  globalThis.game = {
    user: { isGM: true },
    settings: { get: (_s, k) => store[k], set: async (_s, k, v) => { store[k] = v; } },
    scenes: flagged.map((id) => ({ id, getFlag: () => [{ id: "x" }], unsetFlag: async (_s, k) => { unset.push([id, k]); } }))
  };
  return { store, unset };
}

test("0.1.1 moves the Job's Complications and scene Traits to the table lists and drops the Scene flags", async () => {
  const { store, unset } = tableWorld({
    activeJob: { name: "Heist", goal: "Ledger", complications: [{ id: "c1", name: "Alarm", die: 8 }], sceneTraits: [{ id: "t1", name: "Fog", die: 6 }] },
    complications: [{ id: "c0", name: "Heat", die: 6 }], flagged: ["s1", "s2"]
  });
  await migrateTableStateWorld();
  assert.deepEqual(store.activeJob, { name: "Heist", goal: "Ledger" });
  assert.deepEqual(store.complications.map((c) => c.id), ["c0", "c1"]);
  assert.deepEqual(store.globalTraits.map((c) => c.id), ["t1"]);
  assert.deepEqual(unset, [["s1", "sceneTraits"], ["s2", "sceneTraits"]]);
});

test("0.1.1 can run twice without duplicating entries", async () => {
  const job = { name: "J", complications: [{ id: "c1", name: "Alarm", die: 8 }], sceneTraits: [] };
  const { store } = tableWorld({ activeJob: job });
  await migrateTableStateWorld();
  store.activeJob = job;
  await migrateTableStateWorld();
  assert.equal(store.complications.length, 1);
});

test("0.1.1 leaves a clean world alone", async () => {
  const { store } = tableWorld({ activeJob: { name: "J", goal: "" } });
  let writes = 0;
  globalThis.game.settings.set = async () => { writes += 1; };
  await migrateTableStateWorld();
  assert.equal(writes, 0);
  assert.deepEqual(store.complications, []);
});

test("0.1.2 is registered after 0.1.1", () => {
  assert.deepEqual(pendingMigrations("0.1.0", "0.1.2").map((m) => m.version), ["0.1.1", "0.1.2"]);
  assert.deepEqual(pendingMigrations("0.1.1", "0.1.2").map((m) => m.version), ["0.1.2"]);
  assert.deepEqual(pendingMigrations("", "0.1.2"), []);
});

/** Fake world for 0.1.2: the `activeJob` setting and the world Items. */
function jobWorld(activeJob, items = []) {
  const store = { activeJob };
  const created = [];
  globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { NONE: 0, OBSERVER: 2 } };
  globalThis.Item = { create: async (data) => { created.push(data); items.push({ type: "job", name: data.name, system: data.system }); } };
  globalThis.game = {
    user: { isGM: true }, i18n: { localize: (k) => k },
    settings: { get: (_s, k) => store[k], set: async (_s, k, v) => { store[k] = v; } },
    items: Object.assign(items, { contents: items })
  };
  return { store, created };
}

test("0.1.2 turns the saved active Job into an active world Job and clears the setting", async () => {
  const { store, created } = jobWorld({ name: "Heist", goal: "Ledger" });
  await migrateActiveJobWorld();
  assert.equal(created.length, 1);
  assert.deepEqual(created[0].system, { status: "active", goal: "Ledger" });
  assert.equal(created[0].ownership.default, 2);
  assert.deepEqual(store.activeJob, { name: "", goal: "" });
});

test("0.1.2 is idempotent and leaves a world without an active Job alone", async () => {
  const { created, store } = jobWorld({ name: "Heist", goal: "" });
  await migrateActiveJobWorld();
  await migrateActiveJobWorld();
  assert.equal(created.length, 1);
  const empty = jobWorld({ name: "", goal: "" });
  await migrateActiveJobWorld();
  assert.equal(empty.created.length, 0);
  assert.equal(store.activeJob.name, "");
});

test("0.1.2 does not duplicate an active Job with the same name that already exists", async () => {
  const { created, store } = jobWorld({ name: "Heist", goal: "" }, [{ type: "job", name: "Heist", system: { status: "active" } }]);
  await migrateActiveJobWorld();
  assert.equal(created.length, 0);
  assert.equal(store.activeJob.name, "");
});
