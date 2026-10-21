
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
 * Whether the opposition card was built with the police shortcut (`source` joins the shortcuts with "+").
 * @param {string|undefined} source e.g. `"manual+police+gang"`
 * @returns {boolean}
 */
export const isPoliceSource = (source) => String(source ?? "").split("+").includes("police");

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

/** A plural formatter over `t` that splits like English (`<key>.one` for 1, `<key>.other` otherwise). */
const englishPlural = (t) => (key, count, data = {}) => t(`${key}.${count === 1 ? "one" : "other"}`, { count, ...data });

/**
 * Lines of the WASTED / BUSTED card, from what `planDown` decided and what was actually done.
 * @param {object} info
 * @param {ReturnType<typeof import("../../rules/combat.mjs").planDown>} info.plan
 * @param {string} info.name
 * @param {boolean} info.isCrew
 * @param {number} info.max Life the character came back with.
 * @param {string} info.price Price as dice text (`d4`), empty if none.
 * @param {string} [info.debt] What the character could not pay, as dice text (`d4`), empty if nothing.
 * @param {string[]} info.lostAssets Names of the weapon Assets removed.
 * @param {boolean} info.assetsKept The Fixer chose to keep the weapon Assets.
 * @param {(key: string, data?: object) => string} t
 * @param {(key: string, count: number, data?: object) => string} [tn] Plural messages (`components/i18n.mjs`); defaults
 *   to English's one/other split over `t`.
 * @returns {string[]}
 */
export function downLines({ plan, name, isCrew, max, price, debt = "", lostAssets, assetsKept }, t, tn = englishPlural(t)) {
  if (!isCrew) return [t("LEVERAGE.Damage.Down.npc", { name })];
  const busted = plan.kind === "busted";
  const lines = [t(busted ? "LEVERAGE.Damage.Down.arrested" : "LEVERAGE.Damage.Down.hospital", { name })];
  if (plan.priceKind === "hospital") lines.push(t("LEVERAGE.Damage.Down.payHospital", { price, steps: plan.paidSteps }));
  if (plan.priceKind === "bail") lines.push(t("LEVERAGE.Damage.Down.payBail", { price, steps: plan.paidSteps }));
  if (plan.shortBy > 0) lines.push(t("LEVERAGE.Damage.Down.short", { steps: plan.shortBy, debt }));
  if (plan.rescuable) lines.push(t(plan.rescue ? "LEVERAGE.Damage.Down.rescue" : "LEVERAGE.Damage.Down.rescueUnpaid", { name }));
  lines.push(t("LEVERAGE.Damage.Down.fullLife", { max }));
  if (plan.plotPoints) lines.push(tn("LEVERAGE.Damage.Down.plotPoint", plan.plotPoints));
  if (lostAssets.length) lines.push(t("LEVERAGE.Damage.Down.assetsLost", { names: lostAssets.join(", ") }));
  else if (assetsKept) lines.push(t("LEVERAGE.Damage.Down.assetsKept"));
  return lines;
}

/**
 * Template data of the WASTED / BUSTED card.
 * @param {object} info Same as `downLines`, plus `img`.
 * @param {(key: string, data?: object) => string} t
 * @param {(key: string, count: number, data?: object) => string} [tn]
 * @returns {{kind: string, title: string, name: string, img: string, lines: string[], rescuable: boolean,
 *   rescueLabel: string, rescueTip: string}} `rescuable`: show the "Rescued" button (the Fixer sees it).
 */
export function downCardContext(info, t, tn) {
  const { kind, rescuable } = info.plan;
  return {
    kind, title: t(`LEVERAGE.Damage.Down.${kind}`), name: info.name, img: info.img ?? "", lines: downLines(info, t, tn),
    rescuable, rescueLabel: t("LEVERAGE.Damage.Down.rescuedButton"), rescueTip: t("LEVERAGE.Damage.Down.rescuedTip")
  };
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
