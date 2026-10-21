import "./helpers/foundry-stub.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { isSheetLocked, sealState } from "../../module/rules/sheet-lock.mjs";
import { partyRows, showParty } from "../../module/applications/hud/hud-logic.mjs";

test("a sheet is locked unless the owner unlocked it and the GM allows unlocking", () => {
  assert.equal(isSheetLocked({ playersCanUnlock: true, unlocked: false }), true);
  assert.equal(isSheetLocked({ playersCanUnlock: true, unlocked: true }), false);
  assert.equal(isSheetLocked({ playersCanUnlock: false, unlocked: true }), true);
  assert.equal(isSheetLocked({ playersCanUnlock: false, unlocked: false }), true);
});

test("the seal is disabled for a player when the GM forbids unlocking, never for the GM", () => {
  const forced = sealState({ locked: true, playersCanUnlock: false, isGM: false });
  assert.equal(forced.disabled, true);
  assert.equal(forced.hint, "LEVERAGE.Sheet.Seal.forcedHint");
  assert.equal(sealState({ locked: true, playersCanUnlock: false, isGM: true }).disabled, false);
  const own = sealState({ locked: false, playersCanUnlock: true, isGM: false });
  assert.deepEqual([own.disabled, own.icon, own.hint], [false, "fa-lock-open", "LEVERAGE.Sheet.Seal.unlockedHint"]);
  assert.equal(sealState({ locked: true, playersCanUnlock: true, isGM: false }).hint, "LEVERAGE.Sheet.Seal.lockedHint");
  assert.equal(sealState({ locked: true, playersCanUnlock: true, isGM: true }).hint, "LEVERAGE.Sheet.Seal.lockedGmHint");
});

test("party Money lines are sorted by name and carry dice", () => {
  const rows = partyRows([
    { id: "b", name: "Zed", system: { money: { steps: 0 } } },
    { id: "a", name: "Ana", system: { money: { steps: 3 } } }
  ]);
  assert.deepEqual(rows.map((r) => r.name), ["Ana", "Zed"]);
  assert.equal(rows[0].empty, false);
  assert.equal(rows[1].empty, true);
});

test("the party list is the Fixer's, optional, and hidden when minimized or without the Money rule", () => {
  const on = { isGM: true, enabled: true, minimized: false, moneyRule: true };
  assert.equal(showParty(on), true);
  assert.equal(showParty({ ...on, isGM: false }), false);
  assert.equal(showParty({ ...on, enabled: false }), false);
  assert.equal(showParty({ ...on, minimized: true }), false);
  assert.equal(showParty({ ...on, moneyRule: false }), false);
});
