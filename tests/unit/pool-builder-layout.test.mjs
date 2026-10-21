import test from "node:test";
import assert from "node:assert/strict";
import { placeBeside, WIDTH, MIN_WIDTH, GAP } from "../../module/applications/dialogs/pool-builder-layout.mjs";

const view = { width: 1920, height: 1080 };

test("goes to the right of the sheet when the full width fits", () => {
  const p = placeBeside({ left: 100, right: 800, top: 50 }, view);
  assert.deepEqual([p.left, p.width], [800 + GAP, WIDTH]);
});

test("goes to the left when the right side is too narrow and the left has more room", () => {
  const p = placeBeside({ left: 900, right: 1700, top: 50 }, view);
  assert.equal(p.left + p.width + GAP, 900);
  assert.equal(p.width, WIDTH);
});

test("narrows (never below the minimum) when neither side fits full width, and stays inside the viewport", () => {
  const p = placeBeside({ left: 370, right: 1550, top: 50 }, { width: 1920, height: 500 });
  assert.ok(p.width >= MIN_WIDTH && p.width < WIDTH);
  assert.ok(p.left >= 1550 || p.left + p.width <= 370);
  assert.ok(p.left >= GAP && p.left + p.width <= 1920 - GAP);
  assert.ok(p.top + p.height <= 500 - GAP);
});
