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
  assert.ok(!html.includes("lv-die--s50"));
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
  assert.ok(html.includes("lv-die--d6") && html.includes("--lv-die-size:32px"));
  assert.equal(escapeHtml("a&b"), "a&amp;b");
  assert.ok(renderDie({ die: 6, value: NaN }).includes('lv-die-num"></span>'));
});

test("dropped is a state class", () => {
  assert.ok(renderDie({ die: 8, value: 3, dropped: true }).includes("lv-die--dropped"));
});

test("action makes a button with aria", () => {
  const html = renderDie({ die: 8, action: "setDie", pressed: true, label: "Set to d8" });
  assert.ok(html.startsWith('<button type="button" class="lv-die lv-die--d8'));
  assert.ok(html.includes('data-action="setDie"') && html.includes('aria-pressed="true"') && html.includes('aria-label="Set to d8"'));
  assert.ok(html.endsWith("</button>"));
  assert.ok(renderDie({ die: 8, action: "x" }).includes('aria-pressed="false"'));
  assert.ok(renderDie({ die: 8 }).startsWith("<span "));
  assert.ok(!renderDie({ die: 8, pressed: true }).includes("aria-pressed"));
});

test("action is escaped", () => {
  assert.ok(!renderDie({ action: '"><b>', label: '"><i>' }).includes("<b>"));
});

test("value defaults to the die size, except empty", () => {
  assert.ok(renderDie({ die: 10 }).includes('lv-die-num">10<'));
  assert.ok(renderDie({ die: 10, value: null }).includes('lv-die-num"></span>'));
  assert.ok(renderDie({ die: 10, money: true, empty: true }).includes('lv-die-num">0<'));
});

test("hue is derived from the color", () => {
  const hues = LEVERAGE.dice.map((d) => LEVERAGE.dieGeometry.perDie[d].hue);
  assert.deepEqual(hues, [0, 33, 135, 209, 267]);
});
