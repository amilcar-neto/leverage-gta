/**
 * Pure logic of the HUD (docs/07): which character it shows, what each star says and which clicks are allowed.
 * No Foundry globals here, so it is unit tested; `leverage-hud.mjs` is the thin Foundry half.
 */
import { LEVERAGE } from "../../config.mjs";
import { stepsToDice } from "../../rules/money.mjs";
import { clampStars, mainDie, poolText, policePool } from "../../rules/stars.mjs";

/**
 * The character the HUD shows (docs/07 "Personagem mostrado"): the user's own character, then the controlled
 * token's. The Fixer sees the selected token first (his own character is rarely the one in play).
 * @param {{isGM: boolean, character: ?object, controlled: ?object}} who `controlled` is the first controlled Crew actor.
 * @returns {?object}
 */
export function pickFocusActor({ isGM, character, controlled }) {
  return isGM ? (controlled ?? character ?? null) : (character ?? controlled ?? null);
}

/**
 * New wanted level after a click on star `n`: that level, or one less when it already is the level (so the
 * first star clears the stars).
 * @param {number} n Star clicked, 1 to 5.
 * @param {number} current Current level.
 * @returns {number}
 */
export function nextStarLevel(n, current) {
  return clampStars(n === clampStars(current) ? n - 1 : n);
}

/**
 * One entry per star for the template.
 * @param {{level: number, city: string, scales?: object[], interactive: boolean}} state
 * @returns {{n: number, on: boolean, die: number, pool: string, interactive: boolean}[]}
 */
export function starsView({ level, city, scales, interactive }) {
  const lvl = clampStars(level);
  return Array.from({ length: LEVERAGE.stars.max }, (_, i) => {
    const n = i + 1;
    return {
      n, on: n <= lvl, interactive,
      die: mainDie(city, n, scales) ?? LEVERAGE.defaultDie,
      pool: poolText(policePool(city, n, scales))
    };
  });
}

/**
 * Money dice for the template, the biggest on the right; none gives the dashed d4 with a 0.
 * @param {number} steps
 * @returns {{dice: number[], empty: boolean}}
 */
export function moneyView(steps) {
  const dice = stepsToDice(steps);
  return { dice, empty: dice.length === 0 };
}

/**
 * What the user may do with the focused character. The Fixer: everything. A player (owner): Money and spending his
 * Plot Points. Giving Plot Points is the Fixer's (the "+" and the number click), and so are the stars.
 * @param {{isGM: boolean, isOwner: boolean, hasActor: boolean}} who
 * @returns {{money: boolean, spendPlotPoints: boolean, gainPlotPoints: boolean, stars: boolean}}
 */
export function hudPermissions({ isGM, isOwner, hasActor }) {
  const mine = hasActor && (isGM || isOwner);
  return { money: mine, spendPlotPoints: mine, gainPlotPoints: hasActor && isGM, stars: isGM };
}

/**
 * Compact Money lines of the player characters, for the Fixer's party list under the main Money (docs/07).
 * Sorted by name; each line carries the dice (biggest last, like the main Money) or `empty`.
 * @param {{id: string, name: string, system?: {money?: {steps?: number}}}[]} actors Player characters.
 * @returns {{id: string, name: string, steps: number, dice: number[], empty: boolean}[]}
 */
export function partyRows(actors) {
  return actors
    .map((actor) => {
      const steps = actor.system?.money?.steps ?? 0;
      return { id: actor.id, name: actor.name, steps, ...moneyView(steps) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Whether the party list is drawn: only for the Fixer, only when the option is on, and never in the minimized HUD.
 * @param {{isGM: boolean, enabled: boolean, minimized: boolean, moneyRule: boolean}} state
 * @returns {boolean}
 */
export function showParty({ isGM, enabled, minimized, moneyRule }) {
  return Boolean(isGM && enabled && !minimized && moneyRule);
}
