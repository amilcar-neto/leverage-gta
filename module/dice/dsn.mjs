/**
 * Dice So Nice integration (docs/research/dice-so-nice.md). Optional: without the module nothing here runs and
 * nothing fails. Colors come only from `config.mjs` (die colors per size, Money color).
 * The pure half (colorsets, appearance) has no Foundry dependency and is unit tested.
 */
import { LEVERAGE } from "../config.mjs";

/** Colorset name prefix. */
const PREFIX = "leverage";
/** Colorset key of the Money die. */
export const CASH_KEY = "cash";
/** Text and outline colors shared by every colorset (the body color comes from the config). */
const FOREGROUND = "#ffffff";
const OUTLINE = "#000000";

/**
 * Colorset name for a die.
 * @param {number} size Die size.
 * @param {string} [kind] Pool entry kind; "money" uses the Money colorset.
 * @returns {string}
 */
export function colorsetName(size, kind) {
  return `${PREFIX}-${kind === "money" ? CASH_KEY : `d${size}`}`;
}

/**
 * `options.appearance` of a die term.
 * @param {number} size
 * @param {string} [kind]
 * @returns {{colorset: string}}
 */
export function appearanceFor(size, kind) {
  return { colorset: colorsetName(size, kind) };
}

/**
 * Colorset definitions (Dice So Nice `addColorset` format), one per die size plus Money.
 * @param {typeof LEVERAGE} [config]
 * @param {(key: string) => string} [localize] Turns an i18n key into text.
 * @returns {object[]}
 */
export function buildColorsets(config = LEVERAGE, localize = (key) => key) {
  const bodies = [
    ...config.dice.map((size) => ({ name: colorsetName(size), color: config.dieStyles[size].color, label: config.dieStyles[size].label })),
    { name: colorsetName(0, "money"), color: config.money.color, label: "LEVERAGE.Roll.dsnMoney" }
  ];
  return bodies.map(({ name, color, label }) => ({
    name, description: localize(label), category: "Leverage: Liberty City",
    foreground: FOREGROUND, background: color, outline: OUTLINE, edge: color, material: "plastic"
  }));
}

/**
 * Registers the colorsets when Dice So Nice is ready. Call once, from `init` (the hook only fires with the module
 * active, so without it nothing runs; registering early avoids missing the hook).
 */
export function registerDiceSoNice() {
  Hooks.once("diceSoNiceReady", (dice3d) => {
    for (const set of buildColorsets(LEVERAGE, (key) => game.i18n.localize(key))) dice3d.addColorset(set);
  });
}
