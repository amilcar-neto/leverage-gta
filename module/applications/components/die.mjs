/**
 * Die component: renders one die (SVG shape + number on top) as a safe HTML string.
 * `renderDie` is pure (no Foundry globals) so it can be unit tested; `registerDieHelper` wires the
 * `{{lvDie}}` Handlebars helper. Colors and states live in styles/die.css; shapes and geometry in module/config.mjs.
 */
import { LEVERAGE } from "../../config.mjs";

const ESCAPES = Object.freeze({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" });

/**
 * Escapes a value for use in HTML text or a quoted attribute.
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/** Number displayed inside the die: finite numbers become integers, other values are escaped text. */
function displayValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(Math.trunc(value)) : "";
  return escapeHtml(value);
}

/** Rounds to one decimal so the generated CSS stays short (12.5px, not 12.4999px). */
const toPx = (n) => `${Math.round(n * 10) / 10}px`;

/**
 * Renders a die.
 * @param {object} options
 * @param {number} [options.die=LEVERAGE.defaultDie] Die size (4, 6, 8, 10 or 12); picks shape and color.
 * @param {number|string|null} [options.value] Number shown inside (a roll result or the die's own size).
 * @param {number} [options.size=32] Pixel size; one of LEVERAGE.dieGeometry.sizes (others fall back to the default).
 * @param {boolean} [options.muted] Unselected rung of a ladder: darker, desaturated, 0.55 opacity.
 * @param {boolean} [options.deep] Unselected die of a row in the Pool: looks muted and dimmer (0.28).
 * @param {boolean} [options.kept] White ring: the die was kept in a roll.
 * @param {boolean} [options.one] Red ring: the die rolled a 1.
 * @param {boolean} [options.dropped] Die outside the count of a roll card: full color, 0.45 opacity, own-color ring.
 * @param {boolean} [options.money] Money die: fixed green, black outline (die size still picks the shape).
 * @param {boolean} [options.empty] Money placeholder: dashed outline with no fill (value defaults to 0).
 * @param {string} [options.action] `data-action` name; makes the die a `<button type="button">` that carries `data-die`.
 * @param {boolean} [options.pressed] `aria-pressed` of the button (only with `action`).
 * @param {string} [options.label] `aria-label` of the button (only with `action`).
 * @param {string} [options.title] Tooltip text (already translated).
 * @param {string} [options.cls] Extra CSS classes.
 * @returns {string} HTML with every input escaped.
 */
export function renderDie({ die, value, size, muted, deep, kept, one, dropped, money, empty, action, pressed, label, title, cls } = {}) {
  const sides = LEVERAGE.dice.includes(Number(die)) ? Number(die) : LEVERAGE.defaultDie;
  const geo = LEVERAGE.dieGeometry;
  const dim = geo.sizes.includes(Number(size)) ? Number(size) : geo.defaultSize;
  const g = geo.perDie[sides];
  const fallback = empty ? 0 : sides;
  const shown = displayValue(value === undefined || (empty && value === null) ? fallback : value);
  const classes = ["lv-die", `lv-die--d${sides}`];
  const flags = { muted, deep, kept, one, dropped, money, empty };
  for (const [name, on] of Object.entries(flags)) if (on) classes.push(`lv-die--${name}`);
  if (cls) classes.push(escapeHtml(cls));
  const vars = `--lv-die-size:${dim}px;--lv-die-top:${toPx(dim * g.top)};--lv-die-fs:${toPx(dim * g.font)};--lv-die-hue:${g.hue}`;
  const tip = title ? ` title="${escapeHtml(title)}"` : "";
  const shape = LEVERAGE.dieStyles[sides].shape;
  const inner = `<svg class="lv-die-shape" viewBox="0 0 100 100" aria-hidden="true"><polygon points="${shape}" stroke-linejoin="round"></polygon></svg>`
    + `<span class="lv-die-num">${shown}</span>`;
  const attrs = `class="${classes.join(" ")}" style="${vars}"${tip}`;
  if (!action) return `<span ${attrs}>${inner}</span>`;
  const aria = ` aria-pressed="${pressed ? "true" : "false"}"${label ? ` aria-label="${escapeHtml(label)}"` : ""}`;
  return `<button type="button" ${attrs} data-action="${escapeHtml(action)}" data-die="${sides}"${aria}>${inner}</button>`;
}

/**
 * Registers the `{{lvDie}}` helper. Usage: `{{lvDie value die=8 size=36 muted=true title=label}}`; add `action="setDie" pressed=on label=text` for a button.
 * Uses the global Handlebars, which Foundry v14 still exposes (docs/research/dnd5e-patterns.md).
 */
export function registerDieHelper() {
  const hb = globalThis.Handlebars;
  hb.registerHelper("lvDie", function lvDie(...args) {
    const options = args.pop();
    const hash = options?.hash ?? {};
    return new hb.SafeString(renderDie({ ...hash, value: hash.value ?? args[0] }));
  });
}
