/**
 * Leverage: Liberty City - static configuration (exposed as `CONFIG.LEVERAGE`).
 *
 * Pure data: no dependency on `game`, `CONFIG` or any Foundry global, so node tests can import it.
 * Every label is an i18n key (`LEVERAGE.…`); nothing here is user-facing text.
 * Single source of truth for die sizes/colors/shapes, trait keys, defaults (docs/04 principle 2).
 */

export const SYSTEM_ID = "leverage-gta";

/** Allowed die sizes, smallest first. There is no d20. */
const DICE = Object.freeze([4, 6, 8, 10, 12]);

/**
 * Per-size look. `color` is the fixed die color (docs/03); `shape` is a polygon in a 100x100 viewBox
 * (from reference/mockups/source/Main.dc.html, constant GEOM).
 */
const DIE_STYLES = Object.freeze({
  4: Object.freeze({ color: "#ee5a5a", shape: "50,10 92,86 8,86", label: "LEVERAGE.Die.d4" }),
  6: Object.freeze({ color: "#f2a03d", shape: "14,14 86,14 86,86 14,86", label: "LEVERAGE.Die.d6" }),
  8: Object.freeze({ color: "#4fbf6b", shape: "50,8 92,50 50,92 8,50", label: "LEVERAGE.Die.d8" }),
  10: Object.freeze({ color: "#4ba3f5", shape: "50,8 92,38 77,92 23,92 8,38", label: "LEVERAGE.Die.d10" }),
  12: Object.freeze({ color: "#b07cf0", shape: "50,8 89,30 89,70 50,92 11,70 11,30", label: "LEVERAGE.Die.d12" })
});

/** Builds a frozen map of `{ key: { label } }` using `${prefix}.${key}` as the i18n key. */
function labelled(prefix, keys) {
  return Object.freeze(Object.fromEntries(keys.map((k) => [k, Object.freeze({ label: `${prefix}.${k}` })])));
}

/** Attribute keys, in sheet order. */
const ATTRIBUTES = labelled("LEVERAGE.Attribute",
  ["agility", "alertness", "intelligence", "strength", "vitality", "willpower"]);

/** Role keys, in sheet order (also the tie-break order for primary/secondary Role). */
const ROLES = labelled("LEVERAGE.Role", ["grifter", "hacker", "hitter", "mastermind", "thief"]);

/** Asset durations. */
const ASSET_DURATIONS = labelled("LEVERAGE.Asset", ["signature", "job", "scene"]);

/** NPC tiers. */
const NPC_TIERS = labelled("LEVERAGE.Npc", ["extra", "foil", "mark", "agent"]);

/** Vest kinds with their points; `priceId` references an id in DEFAULT_PRICES (docs/02). `none` has no points. */
const VEST_KINDS = Object.freeze({
  none: Object.freeze({ points: 0, priceId: null, label: "LEVERAGE.Vest.none" }),
  light: Object.freeze({ points: 4, priceId: "vestLight", label: "LEVERAGE.Vest.light" }),
  standard: Object.freeze({ points: 6, priceId: "vestStandard", label: "LEVERAGE.Vest.standard" }),
  heavy: Object.freeze({ points: 10, priceId: "vestHeavy", label: "LEVERAGE.Vest.heavy" })
});

/** Deep-freezes a plain structure of arrays/objects. */
function deepFreeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/**
 * Default police Pool per star level (index 0 = 1 star) for each city (docs/02).
 * Each level is a list of die sizes. `silence` is the list of Money die sizes that buy -2 of heat per die
 * (`null` = buying silence does not work). `bail` tells whether Busted can be settled with bail.
 */
const DEFAULT_CITY_SCALES = deepFreeze([
  { id: "carcer", name: "Carcer City", levels: [[4, 6], [6, 6], [8, 6], [10, 6], [12, 6]], silence: [6], bail: true },
  { id: "venturas", name: "Las Venturas", levels: [[6, 6], [8, 6], [10, 6], [12, 6], [12, 12]], silence: [10], bail: true },
  { id: "liberty", name: "Liberty City", levels: [[8, 6], [10, 6], [12, 6], [12, 12], [12, 12, 8]], silence: null, bail: false }
]);

/**
 * Default price list in dice (docs/02 reference table). `label` is an i18n key.
 * `signatureAsset` is d8; an extra d4 may apply depending on the item (not modelled here).
 */
const DEFAULT_PRICES = deepFreeze([
  { id: "hospital", label: "LEVERAGE.Price.hospital", dice: [4] },
  { id: "bail", label: "LEVERAGE.Price.bail", dice: [6] },
  { id: "vestLight", label: "LEVERAGE.Price.vestLight", dice: [4] },
  { id: "vestStandard", label: "LEVERAGE.Price.vestStandard", dice: [6] },
  { id: "vestHeavy", label: "LEVERAGE.Price.vestHeavy", dice: [8] },
  { id: "weaponHard", label: "LEVERAGE.Price.weaponHard", dice: [4] },
  { id: "rentPoor", label: "LEVERAGE.Price.rentPoor", dice: [4] },
  { id: "rentMiddle", label: "LEVERAGE.Price.rentMiddle", dice: [6] },
  { id: "rentRich", label: "LEVERAGE.Price.rentRich", dice: [12] },
  { id: "buyPoor", label: "LEVERAGE.Price.buyPoor", dice: [6] },
  { id: "buyMiddle", label: "LEVERAGE.Price.buyMiddle", dice: [10] },
  { id: "buyRich", label: "LEVERAGE.Price.buyRich", dice: [6, 12] },
  { id: "signatureAsset", label: "LEVERAGE.Price.signatureAsset", dice: [8] }
]);

/**
 * Default Training Up cost in Jobs (docs/01). `signatureAsset` is confirmed in the book (1 Job);
 * the others are provisional (the book table was unreadable in the OCR) until checked against the PDF.
 */
const DEFAULT_TRAINING_COSTS = Object.freeze({
  signatureAsset: 1,
  specialty: 1,
  talent: 1,
  attribute: 2,
  role: 2
});

const MONEY_STEPS_PER_DIE = Object.freeze({ 4: 1, 6: 2, 8: 3, 10: 4, 12: 5 });
const MONEY_MAX_DICE = 5;

export const LEVERAGE = Object.freeze({
  systemId: SYSTEM_ID,
  dice: DICE,
  dieStyles: DIE_STYLES,
  attributes: ATTRIBUTES,
  roles: ROLES,
  assetDurations: ASSET_DURATIONS,
  npcTiers: NPC_TIERS,
  vestKinds: VEST_KINDS,
  /** Fixed die sizes used by rules. */
  specialtyDie: 6,
  distinctionDice: Object.freeze({ helps: 8, hinders: 4 }),
  maxDistinctions: 3,
  /** Opposition fallback when the GM has no dice (docs/02: 2d6). */
  defaultOppositionDice: Object.freeze([6, 6]),
  /** Money ladder (docs/02): a full d12 is 5 steps; the leftmost die holds the remainder. */
  money: Object.freeze({
    stepsPerDie: MONEY_STEPS_PER_DIE,
    maxSteps: MONEY_MAX_DICE * MONEY_STEPS_PER_DIE[12],
    maxDice: MONEY_MAX_DICE,
    startSteps: 2,
    color: "#2f7a34"
  }),
  /** Life rule: max = lifeBase + Vitality die. */
  lifeBase: 10,
  stars: Object.freeze({ min: 0, max: 5, defaultCity: "liberty" }),
  /** Plot Points each player receives when a Job starts (world setting `jobStartPlotPoints`). */
  jobStartPlotPoints: 1,
  /** Plot Points a brand-new Crew actor is created with (differs from the per-Job grant above). */
  plotPointsStart: 1,
  /** Plot Points paid to create an Asset, by duration (docs/02). */
  assetPlotPointCost: Object.freeze({ job: 2, scene: 1 }),
  /** Signature Asset dice: the first is d8, further ones d6; Job/Scene Assets are d6. */
  signatureAssetDice: Object.freeze({ first: 8, next: 6 }),
  /** Die used when the character lacks a trait for the roll (d4 floor is not applied; docs/01). */
  missingTraitDie: 6,
  /** Reference Job payouts in money steps: small, medium, big (docs/02). */
  jobPayoutReference: Object.freeze([4, 8, 12]),
  /** Steps earned by a quick side job in the city (docs/02). */
  sideJobBonusSteps: 1,
  /** House-rule weapon damage dice (docs/02). */
  weaponDice: Object.freeze({ pistol: 6, shotgun: 8, rifle: 8 }),
  defaultCityScales: DEFAULT_CITY_SCALES,
  defaultPrices: DEFAULT_PRICES,
  defaultTrainingCosts: DEFAULT_TRAINING_COSTS
});
