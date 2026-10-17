import { test } from "node:test";
import assert from "node:assert/strict";
import { withoutProtectedFields } from "../../module/applications/item/protected-fields.mjs";

const job = { system: { payout: { total: 6, share: 2 }, spent: true, callbackUsed: false } };

test("a player's Job form loses payout.share and spent, keeps the rest, and the input is untouched", () => {
  const out = withoutProtectedFields("job", job, false);
  assert.deepEqual(out, { system: { payout: { total: 6 }, callbackUsed: false } });
  assert.equal(job.system.payout.share, 2);
});

test("a player's Asset form loses die and duration", () => {
  const out = withoutProtectedFields("asset", { system: { die: 12, duration: "signature", note: "x" } }, false);
  assert.deepEqual(out, { system: { note: "x" } });
});

test("the Fixer and other types pass through", () => {
  assert.equal(withoutProtectedFields("job", job, true), job);
  const talent = { system: { die: 8 } };
  assert.equal(withoutProtectedFields("talent", talent, false), talent);
});
