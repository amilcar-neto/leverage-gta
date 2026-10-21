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
 * 1 star when they do, set by the Fixer). Both: full Life, +1 Plot Point, weapon Assets of the scene lost.
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
 * Whether the opposition took the round: it wins when it makes at least as much as the player (ties are the Fixer's).
 * @param {number} playerTotal
 * @param {number} oppositionTotal
 * @returns {boolean}
 */
export function oppositionWins(playerTotal, oppositionTotal) {
  return oppositionTotal >= playerTotal;
}

/**
 * Margin by which the opposition won, never below 0 (a tie is 0).
 * @param {number} playerTotal
 * @param {number} oppositionTotal
 * @returns {number}
 */
export function lostBy(playerTotal, oppositionTotal) {
  return Math.max(0, oppositionTotal - playerTotal);
}

/**
 * One damage round: margin + weapon die, then cover (half, rounded down), then vest, then Life (docs/02).
 * @param {object} p
 * @param {number} p.margin points the target lost by
 * @param {number} [p.weaponRoll=0] value rolled on the weapon die
 * @param {number} p.life current Life
 * @param {number} p.vest current vest points
 * @param {boolean} [p.cover=false]
 * @returns {ReturnType<typeof applyDamage> & {raw: number}} `raw` is the damage before cover
 */
export function damageRound({ margin, weaponRoll = 0, life, vest, cover = false }) {
  const raw = baseDamage(margin, weaponRoll);
  return { ...applyDamage({ life, vest, damage: raw, cover }), raw };
}

/**
 * Everything that follows Life reaching 0, with the house rules and the character's means applied
 * (docs/02 "Quando a Vida zera"). Pure: the caller performs the writes.
 * - Wasted: the hospital is the only price that accepts a partial payment: it is paid now, with what the character
 *   has; what is missing is a debt (`shortBy`), shown on the card and not tracked: the Fixer settles it at the next payout.
 * - Busted with bail (the city allows it): bail is all or nothing, paid now (the book says "end of the scene"; this is
 *   a simplification). A character who cannot pay it all pays nothing (`paidSteps` 0) and stays in jail. Without bail
 *   (Liberty City), or with bail not paid, the character waits for a rescue (`rescuable`); the stars rise 1 when the
 *   Fixer marks the rescue, not when the arrest happens.
 * - NPCs only fall: no Plot Point, money or full Life.
 * @param {object} p
 * @param {boolean} p.byPolice
 * @param {boolean} p.isCrew whether the target is a Crew character (NPCs have no Plot Points or Money)
 * @param {number} p.max max Life
 * @param {number} p.hospitalSteps
 * @param {number} p.bailSteps
 * @param {boolean} p.bailAllowed
 * @param {number} p.moneySteps Money the character has now
 * @param {{money: boolean}} p.rules the `houseRules.money` switch
 * @returns {{kind: "wasted"|"busted", restoreLife: number|null, plotPoints: number, loseWeaponAssets: boolean,
 *   priceKind: "hospital"|"bail"|null, dueSteps: number, paidSteps: number, shortBy: number, rescue: boolean,
 *   rescuable: boolean}} `rescue`: no bail in this city; `rescuable`: a Crew character still waiting to be broken out.
 */
export function planDown({ byPolice, isCrew, max, hospitalSteps, bailSteps, bailAllowed, moneySteps, rules }) {
  const down = resolveDown({ byPolice, max, hospitalSteps, bailSteps, bailAllowed });
  const busted = down.kind === "busted";
  const rescue = busted && down.bailCostSteps === null;
  const priceKind = !isCrew || !rules.money ? null : (busted ? (rescue ? null : "bail") : "hospital");
  const dueSteps = priceKind === "bail" ? down.bailCostSteps : (priceKind === "hospital" ? down.costSteps : 0);
  const have = Math.max(0, moneySteps);
  const paidSteps = priceKind === "bail" ? (have >= dueSteps ? dueSteps : 0) : Math.min(dueSteps, have);
  const shortBy = dueSteps - paidSteps;
  return {
    kind: down.kind,
    restoreLife: isCrew ? down.life : null,
    plotPoints: isCrew ? down.plotPoints : 0,
    loseWeaponAssets: isCrew && down.loseWeaponAssets,
    priceKind, dueSteps, paidSteps, shortBy,
    rescue,
    rescuable: isCrew && busted && (rescue || (priceKind === "bail" && shortBy > 0))
  };
}

/**
 * The closest Pool roll of a character before the opposition card at `index`: the roll that opposition belongs to.
 * It stops at another opposition card (that one owns the rolls before it).
 * @param {(object|null)[]} rolls `flags.leverage-gta.roll` of each chat message, oldest first (null if none)
 * @param {number} index position of the opposition card
 * @param {number} [window=6] how many messages back to look
 * @returns {number} index of the linked roll, or -1
 */
export function linkedRollIndex(rolls, index, window = 6) {
  for (let i = index - 1; i >= Math.max(0, index - window); i--) {
    const roll = rolls[i];
    if (!roll) continue;
    if (roll.opposition) return -1;
    if (roll.actorUuid) return i;
  }
  return -1;
}
