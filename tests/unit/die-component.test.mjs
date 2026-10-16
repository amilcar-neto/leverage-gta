import { test } from "node:test";
import assert from "node:assert/strict";
import { renderDie, escapeHtml } from "../../module/applications/components/die.mjs";
import { LEVERAGE } from "../../module/config.mjs";

test("shape and class come from the die size", () => {
  for (const d of LEVERAGE.dice) {
    const html = renderDie({ die: d, value: d });
    assert.ok(html.includes(`lv-die--d${d}`));
    assert.ok(html.includes(`points="${LEVERAGE.dieStyles[d].shape}"`));
  }
});

test("number offsets scale with size", () => {
  const html = renderDie({ die: 6, value: 5, size: 50 });
  assert.ok(html.includes("--lv-die-top:12.5px"));
  assert.ok(html.includes("--lv-die-fs:23.5px"));
  assert.ok(html.includes("lv-die--s50"));
});

test("states add modifier classes", () => {
  const html = renderDie({ die: 8, value: 3, muted: true, deep: true, kept: true, one: true, money: true });
  for (const s of ["muted", "deep", "kept", "one", "money"]) assert.ok(html.includes(`lv-die--${s}`), s);
  assert.ok(!renderDie({ die: 8, value: 3 }).includes("lv-die--muted"));
});

test("empty money die shows 0", () => {
  const html = renderDie({ die: 4, money: true, empty: true, size: 38 });
  assert.ok(html.includes("lv-die--empty"));
  assert.ok(html.includes('lv-die-num">0<'));
});

test("inputs are escaped and bad ones fall back", () => {
  const html = renderDie({ die: 99, value: "<img onerror=x>", title: '"><script>', cls: 'a"b', size: 13 });
  assert.ok(!html.includes("<img") && !html.includes("<script"));
  assert.ok(html.includes("lv-die--d6") && html.includes("lv-die--s32"));
  assert.equal(escapeHtml("a&b"), "a&amp;b");
  assert.ok(renderDie({ die: 6, value: NaN }).includes('lv-die-num"></span>'));
});
