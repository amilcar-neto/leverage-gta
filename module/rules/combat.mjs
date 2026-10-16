/**
 * Shootout rules (docs/02 "Vida e Colete"): damage, cover, vest, Wasted/Busted, recovery, gang takedowns.
 * Pure logic, no Foundry dependency.
 */
import { LEVERAGE } from "../config.mjs";
import { assertDie } from "../dice/die.mjs";

/**
 * Max Life = base + Vitality die size.
 * @param {number} vitalityDie
 * @param {number} [base] defaults to `LEVERAGE.lifeBase` (the world setting may override).
 * @returns {number}
 */
export function maxLife(vitalityDie, base = LEVERAGE.lifeBase) {
  return base + assertDie(vitalityDie);
}

/**
 * Contest result from the player's view: margin > 0 passed; a tie is a loss (the GM wins ties).
 * @param {number} playerTotal
 * @param {number} opposedTotal
 * @returns {{margin: number, passed: boolean, extraordinary: boolean}}
 */
export function contestResult(playerTotal, opposedTotal) {
  const margin = playerTotal - opposedTotal;
  return { margin, passed: margin > 0, extraordinary: margin >= LEVERAGE.extraordinaryMargin };
}

/**
 * Damage taken when the player loses or ties: how much they lost by + the rolled weapon die.
 * @param {number} lostBy points lost by (0 on a tie; negatives treated as 0)
 * @param {number} [weaponRoll=0] value rolled on the enemy weapon die (0 if unarmed)
 * @returns {number}
 */
export function baseDamage(lostBy, weaponRoll = 0) {
  return Math.max(0, lostBy) + Math.max(0, weaponRoll);
}

/**
 * Applies cover (halves, rounded down) and then the vest to a damage amount.
 * @param {object} p
 * @param {number} p.life current Life
 * @param {number} p.vest current vest points
 * @param {number} p.damage raw damage
 * @param {boolean} [p.cover=false]
 * @returns {{life: number, vest: number, damage: number, absorbed: number, lifeLost: number, down: boolean}}
 *   `damage` is after cover; `down` is true when Life reached 0.
 */
export function applyDamage({ life, vest, damage, cover = false }) {
  const raw = Math.max(0, damage);
  const dealt = cover ? Math.floor(raw / 2) : raw;
  const absorbed = Math.min(Math.max(0, vest), dealt);
  const lifeLost = Math.min(Math.max(0, life), dealt - absorbed);
  const nextLife = life - lifeLost;
  return {
    life: nextLife,
    vest: vest - absorbed,
    damage: dealt,
    absorbed,
    lifeLost,
    down: nextLife <= 0
  };
}

/**
 * Life after a rest scene (+half of max, rounded down), capped at max.
 * @param {number} life
 * @param {number} max
 * @returns {number}
 */
export function restScene(life, max) {
  return Math.min(max, life + Math.floor(max / 2));
}

/**
 * What happens when Life hits 0. Taken down by anyone but the police: Wasted (pays the hospital). Taken down by
 * the police: Busted (pays bail at the end of the scene unless the city has no bail, or rescue, which raises
 * 1 star). Both: full Life, +1 Plot Point, weapon Assets of the scene lost.
 * @param {object} p
 * @param {boolean} p.byPolice whether the police took the character down (Busted instead of Wasted)
 * @param {number} p.max max Life
 * @param {number} p.hospitalSteps hospital price in money steps (from the price list)
 * @param {number} p.bailSteps bail price in money steps (from the price list)
 * @param {boolean} [p.bailAllowed=true] the city scale's `bail` flag (see `bailAllowed` in stars.mjs)
 * @returns {{kind: "wasted"|"busted", life: number, plotPoints: number, loseWeaponAssets: boolean,
 *   costSteps: number, bailCostSteps: number|null, rescueRaisesStars: number}}
 */
export function resolveDown({ byPolice, max, hospitalSteps, bailSteps, bailAllowed = true }) {
  const base = { life: max, plotPoints: LEVERAGE.policeBustPlotPoints, loseWeaponAssets: true };
  if (!byPolice) {
    return { ...base, kind: "wasted", costSteps: hospitalSteps, bailCostSteps: null, rescueRaisesStars: 0 };
  }
  return {
    ...base,
    kind: "busted",
    costSteps: 0,
    bailCostSteps: bailAllowed ? bailSteps : null,
    rescueRaisesStars: 1
  };
}

/**
 * Give In before rolling: leaves with a light Bloodied d6 Complication and +1 Plot Point.
 * @returns {{complicationDie: number, plotPoints: number}}
 */
export function giveIn() {
  return { complicationDie: LEVERAGE.complicationDie, plotPoints: LEVERAGE.policeBustPlotPoints };
}

/**
 * Enemies knocked out when the player passes (Ganging Up): 1, or 2 with Extraordinary Success.
 * Against a single remaining enemy, only an Extraordinary Success takes them down (all of it).
 * @param {number} margin player's margin (> 0 passed)
 * @param {number} remaining enemies still standing
 * @returns {number}
 */
export function thugsDown(margin, remaining) {
  if (margin <= 0 || remaining <= 0) return 0;
  const extraordinary = margin >= LEVERAGE.extraordinaryMargin;
  if (remaining === 1) return extraordinary ? 1 : 0;
  return Math.min(remaining, extraordinary ? 2 : 1);
}
