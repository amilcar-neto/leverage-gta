import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LEVERAGE } from "../../module/config.mjs";

const css = readFileSync(new URL("../../styles/tokens.css", import.meta.url), "utf8");

/** Reads a `--name: #rrggbb;` declaration from tokens.css. */
function token(name) {
  const line = css.split("\n").find((l) => l.trim().startsWith(`--${name}:`));
  return line?.split(":")[1]?.replace(";", "").trim().toLowerCase();
}

test("die colors in tokens.css match config", () => {
  for (const d of LEVERAGE.dice) assert.equal(token(`lv-d${d}`), LEVERAGE.dieStyles[d].color.toLowerCase(), `d${d}`);
});

test("money die color in tokens.css matches config", () => {
  assert.equal(token("lv-money-die"), LEVERAGE.money.color.toLowerCase());
});
