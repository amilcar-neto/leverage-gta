
/**
 * Texts of the damage flow (docs/08 "Tiroteio"): the chat line of one damage round and the context of the
 * WASTED / BUSTED card. Pure functions over plain data; the Foundry half is `damage.mjs`.
 */

/**
 * @typedef {object} DamageRecord Result of one damage round, saved in `flags.leverage-gta.roll.damage`.
 * @property {string} targetUuid
 * @property {string} targetName
 * @property {number} margin Points the target lost by.
 * @property {number} weaponDie Size of the weapon die (0 = none).
 * @property {number} weaponRoll Value rolled on it.
 * @property {number} raw Damage before cover.
 * @property {boolean} cover
 * @property {number} damage Damage after cover.
 * @property {number} absorbed Taken by the vest.
 * @property {number} lifeLost Taken from Life.
 * @property {number} life Life after.
 * @property {number} vest Vest after.
 * @property {number} lifeMax
 * @property {boolean} down Life reached 0.
 * @property {"wasted"|"busted"|null} kind Set when `down`.
 */

/**
 * Lines that describe one damage round.
 * @param {DamageRecord} r
 * @param {(key: string, data?: object) => string} t
 * @returns {string[]}
 */
export function damageLines(r, t) {
  const weapon = r.weaponDie ? t("LEVERAGE.Damage.Line.weapon", { die: r.weaponDie, roll: r.weaponRoll }) : t("LEVERAGE.Damage.Line.unarmed");
  const lines = [t("LEVERAGE.Damage.Line.base", { name: r.targetName, margin: r.margin, weapon, raw: r.raw })];
  if (r.cover) lines.push(t("LEVERAGE.Damage.Line.cover", { damage: r.damage }));
  if (r.absorbed) lines.push(t("LEVERAGE.Damage.Line.vest", { absorbed: r.absorbed, vest: r.vest }));
  lines.push(t("LEVERAGE.Damage.Line.life", { lost: r.lifeLost, life: r.life, max: r.lifeMax }));
  return lines;
}

/**
 * Short summary shown on the opposition card after the damage was applied.
 * @param {DamageRecord} r
 * @param {(key: string, data?: object) => string} t
 * @returns {string}
 */
export function damageSummary(r, t) {
  const base = t("LEVERAGE.Damage.applied", { name: r.targetName, damage: r.damage, life: r.life, max: r.lifeMax });
  return r.down ? `${base} ${t(`LEVERAGE.Damage.Down.${r.kind}`)}` : base;
}

/**
 * Lines of the WASTED / BUSTED card, from what `planDown` decided and what was actually done.
 * @param {object} info
 * @param {ReturnType<typeof import("../../rules/combat.mjs").planDown>} info.plan
 * @param {string} info.name
 * @param {boolean} info.isCrew
 * @param {number} info.max Life the character came back with.
 * @param {string} info.price Price as dice text (`d4`), empty if none.
 * @param {string[]} info.lostAssets Names of the weapon Assets removed.
 * @param {boolean} info.assetsKept The Fixer chose to keep the weapon Assets.
 * @param {{from: number, to: number}|null} info.stars Wanted level change.
 * @param {(key: string, data?: object) => string} t
 * @returns {string[]}
 */
export function downLines({ plan, name, isCrew, max, price, lostAssets, assetsKept, stars }, t) {
  if (!isCrew) return [t("LEVERAGE.Damage.Down.npc", { name })];
  const busted = plan.kind === "busted";
  const lines = [t(busted ? "LEVERAGE.Damage.Down.arrested" : "LEVERAGE.Damage.Down.hospital", { name })];
  if (plan.priceKind === "hospital") lines.push(t("LEVERAGE.Damage.Down.payHospital", { price, steps: plan.paidSteps }));
  if (plan.priceKind === "bail") lines.push(t("LEVERAGE.Damage.Down.payBail", { price, steps: plan.paidSteps }));
  if (plan.shortBy > 0) lines.push(t("LEVERAGE.Damage.Down.short", { steps: plan.shortBy }));
  if (plan.rescue) lines.push(t("LEVERAGE.Damage.Down.rescue", { name }));
  if (stars) lines.push(t("LEVERAGE.Damage.Down.stars", stars));
  lines.push(t("LEVERAGE.Damage.Down.fullLife", { max }));
  if (plan.plotPoints) lines.push(t("LEVERAGE.Damage.Down.plotPoint", { count: plan.plotPoints }));
  if (lostAssets.length) lines.push(t("LEVERAGE.Damage.Down.assetsLost", { names: lostAssets.join(", ") }));
  else if (assetsKept) lines.push(t("LEVERAGE.Damage.Down.assetsKept"));
  return lines;
}

/**
 * Template data of the WASTED / BUSTED card.
 * @param {object} info Same as `downLines`, plus `img`.
 * @param {(key: string, data?: object) => string} t
 * @returns {{kind: string, title: string, name: string, img: string, lines: string[]}}
 */
export function downCardContext(info, t) {
  const { kind } = info.plan;
  return { kind, title: t(`LEVERAGE.Damage.Down.${kind}`), name: info.name, img: info.img ?? "", lines: downLines(info, t) };
}

/**
 * Options of the weapon die select: no weapon, then each die with the preset weapons that use it.
 * @param {number[]} dice Die sizes.
 * @param {Record<string, number>} presets Weapon key -> die size (`LEVERAGE.weaponDice`).
 * @param {(key: string, data?: object) => string} t
 * @returns {{value: number, label: string}[]}
 */
export function weaponOptions(dice, presets, t) {
  const named = (die) => Object.entries(presets).filter(([, size]) => size === die).map(([key]) => t(`LEVERAGE.Damage.Weapon.${key}`));
  return [
    { value: 0, label: t("LEVERAGE.Damage.Dialog.weaponNone") },
    ...dice.map((die) => ({ value: die, label: [`d${die}`, ...named(die)].join(" · ") }))
  ];
}
