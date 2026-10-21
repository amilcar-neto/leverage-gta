/**
 * Public API of the system, available to macros as `game.leverage` (docs/04 "Referencias (@) e API para macros",
 * docs/macros.md). Everything here is a thin layer over code that already exists: the Pool rules (`dice/pool.mjs`),
 * the roll core and card (`dice/roll-handler.mjs`, `dice/opposition.mjs`), the Actor helpers (`money`, `addPlotPoints`)
 * and the Fixer actions (`applications/gm/*`). Nothing is implemented twice.
 *
 * Permissions: the Fixer (GM) can do everything. A player can roll, and earn and spend Money and spend Plot Points
 * for the characters he owns (Foundry already lets an owner update his own actor, so those calls write directly);
 * only the Fixer gives Plot Points. Everything else (stars, the Trait lock, Jobs, opposition, other people's
 * characters) is Fixer only and warns the caller.
 * The one action that crosses characters, `money.transfer`, goes to the Fixer through the socket when the caller
 * does not own both sides.
 *
 * Validation problems never throw: they show a localised warning (as the roll tray does) and return `null` or `false`.
 * The pure checks are exported and unit tested; the Foundry half only touches globals inside functions.
 */
import { LEVERAGE, SYSTEM_ID } from "./config.mjs";
import { DicePool, parseRef, resolvePoolRef } from "./dice/pool.mjs";
import { isValidDie } from "./dice/die.mjs";
import { priceToSteps } from "./rules/money.mjs";
import { clampStars, policePool } from "./rules/stars.mjs";
import { rollPoolFor } from "./dice/roll-handler.mjs";
import { openOppositionRoller, rollOpposition } from "./dice/opposition.mjs";
import { getCityScales, readWanted } from "./world-state.mjs";
import { executeAsGM, registerSocketAction } from "./socket.mjs";
import { onTransferRequest, transferNow } from "./money-actions.mjs";
import { openLendDialog } from "./applications/dialogs/lend-dialog.mjs";
import { openPayDialog } from "./applications/dialogs/pay-dialog.mjs";
import { addToSheetPool } from "./applications/actor/parts/tray.mjs";
import * as controls from "./applications/gm/controls.mjs";
import * as damage from "./applications/chat/damage.mjs";
import * as jobActions from "./applications/gm/job-actions.mjs";
import * as starsActions from "./applications/gm/stars-actions.mjs";

/* ------------------------------------------------------------------ pure checks */

/**
 * @typedef {object} Check
 * @property {boolean} ok
 * @property {string} [error] i18n key (under `LEVERAGE.Api`) of the problem.
 * @property {object} [data] Values for the message.
 */

/**
 * Normalises a Pool reference: loose dice may be given as a number (`6`) or any case (`"D6"`).
 * @param {string|number} ref
 * @returns {string}
 */
export function normalizeRef(ref) {
  if (typeof ref === "number") return `d${ref}`;
  return typeof ref === "string" ? ref.trim().replace(/^D(\d+)$/, "d$1") : "";
}

/**
 * Checks a list of Pool references for an actor with the same rules as the roll tray: every reference must mean a
 * die, there is exactly one Attribute and one Role (both rated) and at most one Distinction.
 * @param {string[]} refs
 * @param {(ref: string) => import("./dice/pool.mjs").ResolvedTrait|null} resolve
 * @returns {Check & {entries?: import("./dice/pool.mjs").PoolEntry[]}} `entries` are in Pool order when `ok`.
 */
export function checkPoolRefs(refs, resolve) {
  if (!Array.isArray(refs) || !refs.length) return { ok: false, error: "Pool.empty" };
  const list = refs.map(normalizeRef);
  const kinds = {};
  for (const ref of list) {
    const resolved = parseRef(ref) ? resolve(ref) : null;
    if (!resolved) return { ok: false, error: "Pool.unknownRef", data: { ref: String(ref) } };
    kinds[resolved.kind] = (kinds[resolved.kind] ?? 0) + 1;
  }
  for (const kind of ["attribute", "role", "distinction"]) {
    if (kinds[kind] > 1) return { ok: false, error: "Pool.tooMany", data: { kind } };
  }
  const pool = new DicePool(resolve);
  list.forEach((ref) => pool.add(ref));
  const [problem] = pool.problems;
  if (problem) return { ok: false, error: `Pool.${problem}` };
  return { ok: true, entries: pool.entries() };
}

/**
 * A whole number of steps/Plot Points, zero or more.
 * @param {*} n
 * @returns {Check & {value?: number}}
 */
export function checkAmount(n) {
  const value = Number(n);
  return Number.isInteger(value) && value >= 0 ? { ok: true, value } : { ok: false, error: "invalidAmount" };
}

/**
 * A change of Plot Points: a whole number; a positive one (giving) is only for the Fixer.
 * @param {*} n
 * @param {boolean} isGM
 * @returns {Check & {value?: number}}
 */
export function checkPlotPointChange(n, isGM) {
  const value = Number(n);
  if (!Number.isInteger(value)) return { ok: false, error: "invalidAmount" };
  if (value > 0 && !isGM) return { ok: false, error: "fixerOnly" };
  return { ok: true, value };
}

/**
 * A price: steps (whole number) or a list of dice (`[12, 6]`) priced with the Money ladder.
 * @param {number|number[]} price
 * @returns {Check & {steps?: number}}
 */
export function checkPrice(price) {
  if (Array.isArray(price)) {
    if (!price.length || !price.every((d) => isValidDie(Number(d)))) return { ok: false, error: "invalidPrice" };
    return { ok: true, steps: priceToSteps(price.map(Number)) };
  }
  const amount = checkAmount(price);
  return amount.ok ? { ok: true, steps: amount.value } : { ok: false, error: "invalidPrice" };
}

/**
 * Checks a star level (whole number 0..5) and a city id.
 * @param {number} level
 * @param {string|undefined} city `undefined` keeps the current city.
 * @param {{id: string}[]} scales The city scales in use.
 * @returns {Check & {level?: number, city?: string}}
 */
export function checkStars(level, city, scales) {
  const n = Number(level);
  if (!Number.isInteger(n) || n < LEVERAGE.stars.min || n > LEVERAGE.stars.max) {
    return { ok: false, error: "Stars.invalidLevel", data: { min: LEVERAGE.stars.min, max: LEVERAGE.stars.max } };
  }
  if (city !== undefined && !scales.some((s) => s.id === city)) return { ok: false, error: "Stars.unknownCity", data: { city: String(city) } };
  return { ok: true, level: n, city };
}

/* ------------------------------------------------------------------ foundry helpers */

const t = (key, data) => (data ? game.i18n.format(`LEVERAGE.Api.${key}`, data) : game.i18n.localize(`LEVERAGE.Api.${key}`));

/** Shows the warning of a failed check. */
function warn(check) {
  const data = check.data?.kind ? { ...check.data, kind: t(`Pool.kind.${check.data.kind}`) } : check.data;
  ui.notifications.warn(t(check.error, data));
}

/** Resolves an Actor, a UUID or an id to a Crew actor. Warns and returns null otherwise. */
function crewOf(actor) {
  const doc = typeof actor === "string" ? (fromUuidSync(actor) ?? game.actors.get(actor)) : actor;
  if (doc?.documentName === "Actor" && doc.type === "crew") return doc;
  ui.notifications.warn(t("noCrew"));
  return null;
}

/** Crew actor the caller may change (the Fixer, or an owner). Warns otherwise. */
function ownedCrew(actor) {
  const doc = crewOf(actor);
  if (!doc) return null;
  if (game.user.isGM || doc.isOwner) return doc;
  ui.notifications.warn(t("notOwner", { name: doc.name }));
  return null;
}

/** Whether the caller is the Fixer; warns otherwise. */
const fixerOnly = () => jobActions.requireGM();

/** City scales in use (world setting, falling back to the built-in ones). */
const cityScales = () => getCityScales();

/* ------------------------------------------------------------------ rolls */

/**
 * Rolls a Pool for a character without opening the sheet. Same rules as the roll tray (one Attribute, one Role, at
 * most one Distinction, any number of other Traits and loose dice), same dice, same chat card, same effects (Money
 * die costs a step, a d4 Distinction gives a Plot Point).
 * @param {object} request
 * @param {Actor|string} request.actor A Crew actor, its UUID or its id. Players may roll only their own.
 * @param {(string|number)[]} request.refs References: `attributes.agility`, `roles.thief`, `item:<id>`,
 *   `item:<id>:d8|d4` (Distinction), `money`, `scene:<id>` (Scene Trait of the active Job), `d6` or just `6` (loose die).
 * @param {string} [request.flavor] Action description on the card.
 * @returns {Promise<ChatMessage|null>} the card, or null when the Pool is not valid (a warning says why)
 */
async function rollPool({ actor, refs, flavor } = {}) {
  const doc = ownedCrew(actor);
  if (!doc) return null;
  const moneyEnabled = Boolean(game.settings.get(SYSTEM_ID, "houseRules.money"));
  const sceneTraits = jobActions.readJob().sceneTraits;
  const check = checkPoolRefs(refs, (ref) => resolvePoolRef(doc, ref, { moneyEnabled, sceneTraits }));
  if (!check.ok) return warn(check) ?? null;
  return rollPoolFor({ actor: doc, entries: check.entries, flavor });
}

const pool = {
  /**
   * Puts a Trait in the Pool of the character's sheet (opening the sheet when closed), with the tray rules: a new
   * Attribute/Role/Distinction replaces the old one. Only the owner or the Fixer.
   * @param {Actor|string} actor A Crew actor, its UUID or its id.
   * @param {string} ref Reference: `attributes.agility`, `item:<id>`, `money`, `scene:<id>`, `d6`...
   * @returns {Promise<boolean>} false when the reference means nothing for this character.
   */
  async add(actor, ref) {
    const doc = ownedCrew(actor);
    if (!doc) return false;
    const added = await addToSheetPool(doc, ref);
    if (!added) ui.notifications.warn(t("badRef", { ref: String(ref) }));
    return added;
  }
};

/**
 * Rolls the Fixer's opposition and posts the "FIXER" card. Fixer only.
 * @param {object} [request]
 * @param {(number|{die: number, label?: string})[]} [request.dice] Die sizes; empty means the default "no opposition" dice.
 * @param {string} [request.label] Card subtitle.
 * @returns {Promise<ChatMessage|null>}
 */
const opposition = ({ dice, label } = {}) => rollOpposition({ dice, label, source: "macro" });

/* ------------------------------------------------------------------ money */

/** Runs a Money write after checking permission and the number. */
async function withMoney(actor, amount, run) {
  const doc = ownedCrew(actor);
  if (!doc) return null;
  const check = checkAmount(amount);
  if (!check.ok) return warn(check) ?? null;
  return run(doc, check.value);
}

const money = {
  /**
   * Current Money of a character.
   * @param {Actor|string} actor
   * @returns {{steps: number, dice: number[]}|null}
   */
  get(actor) {
    const doc = crewOf(actor);
    return doc ? { steps: doc.money.steps, dice: doc.money.dice } : null;
  },
  /**
   * Adds steps to the Money ladder (capped at the top).
   * @param {Actor|string} actor
   * @param {number} steps
   * @returns {Promise<number|null>} steps that actually fit
   */
  add: (actor, steps) => withMoney(actor, steps, (doc, n) => doc.money.add(n)),
  /**
   * Pays a price in steps or as a list of dice (`[12, 6]`). Nothing is spent when short.
   * @param {Actor|string} actor
   * @param {number|number[]} price
   * @returns {Promise<{ok: boolean, steps: number, shortBy: number}|null>}
   */
  async pay(actor, price) {
    const doc = ownedCrew(actor);
    if (!doc) return null;
    const check = checkPrice(price);
    return check.ok ? doc.money.pay(check.steps) : warn(check) ?? null;
  },
  /**
   * Sets the Money steps (clamped to the ladder).
   * @param {Actor|string} actor
   * @param {number} steps
   * @returns {Promise<number|null>} the new steps
   */
  set: (actor, steps) => withMoney(actor, steps, (doc, n) => doc.money.set(n)),
  /**
   * Lends steps from one character to another (at most what the lender has and the receiver can hold). A player
   * who owns only the lender asks the Fixer through the socket, so it resolves with `null` in that case.
   * @param {Actor|string} from
   * @param {Actor|string} to
   * @param {number} steps
   * @returns {Promise<number|null>} steps moved, or null when the Fixer was asked / the call was refused
   */
  async transfer(from, to, steps) {
    const source = ownedCrew(from);
    const target = crewOf(to);
    const check = checkAmount(steps);
    if (!source || !target) return null;
    if (!check.ok) return warn(check) ?? null;
    if (game.user.isGM || target.isOwner) return transferNow(source, target, check.value);
    await executeAsGM("moneyTransfer", { from: source.uuid, to: target.uuid, amount: check.value });
    return null;
  },
  /**
   * Opens the Pay dialog (price list or free price in dice) and pays with a chat line. Owner or Fixer.
   * @param {Actor|string} actor
   * @returns {Promise<{ok: boolean, cost: number}|null>} null when cancelled or not allowed
   */
  payDialog(actor) {
    const doc = ownedCrew(actor);
    return doc ? openPayDialog(doc) : Promise.resolve(null);
  },
  /**
   * Opens the Lend dialog (to another Crew character; goes through the Fixer when needed). Owner or Fixer.
   * @param {Actor|string} actor The lender.
   * @returns {Promise<{to: string, amount: number}|null>} null when cancelled or not allowed
   */
  lendDialog(actor) {
    const doc = ownedCrew(actor);
    return doc ? openLendDialog(doc) : Promise.resolve(null);
  }
};

/* ------------------------------------------------------------------ stars */

const stars = {
  /** @returns {number} Current wanted level, 0 to 5. */
  get: () => readWanted().level,
  /** @returns {string} Current city id. */
  city: () => readWanted().city,
  /** @returns {{id: string, name: string}[]} The cities that have a star scale. */
  cities: () => cityScales().map(({ id, name }) => ({ id, name })),
  /** @returns {{city: string, level: number, pool: number[]}} Level, city and the police Pool they give. */
  state() {
    const { city, level } = readWanted();
    return { city, level, pool: policePool(city, level, cityScales()) };
  },
  /**
   * Sets the wanted level (and city). Fixer only. Level must be a whole number 0 to 5; the city must exist.
   * @param {number} level
   * @param {string} [city] Keeps the current city when omitted.
   * @returns {Promise<boolean>}
   */
  async set(level, city) {
    if (!fixerOnly()) return false;
    const check = checkStars(level, city, cityScales());
    if (!check.ok) return warn(check) ?? false;
    return controls.setWanted(check.level, check.city);
  },
  /** Raises the level by `by` (default 1), capped at 5, with a chat line. Fixer only. @param {number} [by=1] @param {string} [reason] @returns {Promise<boolean>} */
  raise: async (by = 1, reason = "") => (await starsActions.raise(Math.trunc(Number(by)), reason)).ok,
  /** Lowers the level by `by` (default 1), floor 0. Fixer only. @param {number} [by=1] @returns {Promise<boolean>} */
  lower: (by = 1) => stars.set(clampStars(stars.get() - Math.max(0, Math.trunc(by) || 0))),
  /** Clears the stars (level 0). Fixer only. @returns {Promise<boolean>} */
  clear: () => stars.set(0),

  /* Stars actions (docs/02): each one posts a chat line "STARS: from N to M, reason". */
  /**
   * Waiting out of sight (free): lowers stars by the city's scenes-per-star. Fixer only.
   * @param {number} [scenes=1] Scenes spent out of sight.
   * @param {{betweenSessions?: boolean}} [options] `betweenSessions` for cities where waiting only works between sessions.
   * @returns {Promise<object>} The plan: `{ok, from, to, error}`.
   */
  wait: (scenes = 1, options = {}) => starsActions.lowerByWaiting(scenes, options),
  /**
   * A disguise that worked. Fixer only.
   * @param {"simple"|"both"} [kind="simple"] `both` = car and clothes.
   * @param {{sketched?: boolean}} [options] `sketched`: a composite sketch exists.
   * @returns {Promise<object>}
   */
  disguise: (kind = "simple", options = {}) => starsActions.lowerByDisguise(kind, options),
  /**
   * Buys silence with the character's Money, after the quick roll against the police Pool was passed (the city
   * sets the die and the stars; some cities refuse). Fixer only.
   * @param {Actor|string} actor
   * @param {{count?: number}} [options]
   * @returns {Promise<object>}
   */
  buySilence: (actor, options = {}) => starsActions.buySilence(actor, options),
  /**
   * The last resort of the city (docs/02): the stars go to 0 once the Crew did what the city asks. Carcer City: any
   * way out (`way`: "disguise", "silence" or "wait"); Las Venturas: change looks and buy silence (paid by `actor`);
   * Liberty City: hand over a scapegoat in a mini-heist. `confirmed: true` says the Crew did it. Fixer only.
   * @param {Actor|string} [actor] Pays the silence where it is needed.
   * @param {{way?: string, confirmed?: boolean}} [options]
   * @returns {Promise<object>}
   */
  lastResort: (actor, options = {}) => starsActions.lastResort(actor, options)
};

/* ------------------------------------------------------------------ plot points */

const plotPoints = {
  /**
   * Plot Points of a character.
   * @param {Actor|string} actor
   * @returns {number|null}
   */
  get: (actor) => crewOf(actor)?.system.plotPoints?.value ?? null,
  /**
   * Changes the Plot Points quietly (no chat line). Giving (a positive number) is the Fixer's; a player may only
   * take away from his own characters (a negative number), the same as `spend`.
   * @param {Actor|string} actor
   * @param {number} [n=1] Plot Points to add; negative removes (never below 0).
   * @returns {Promise<number|null>} the new total
   */
  async add(actor, n = 1) {
    const doc = ownedCrew(actor);
    if (!doc) return null;
    const check = checkPlotPointChange(n, game.user.isGM);
    if (!check.ok) {
      if (check.error === "fixerOnly") fixerOnly();
      else warn(check);
      return null;
    }
    await doc.addPlotPoints(check.value);
    return doc.system.plotPoints.value;
  },
  /**
   * Spends Plot Points. Nothing happens (and a warning shows) when the character has fewer.
   * @param {Actor|string} actor
   * @param {number} [n=1]
   * @returns {Promise<boolean>}
   */
  async spend(actor, n = 1) {
    const doc = ownedCrew(actor);
    const check = checkAmount(n);
    if (!doc) return false;
    if (!check.ok) return warn(check) ?? false;
    const have = doc.system.plotPoints?.value ?? 0;
    if (have < check.value) {
      ui.notifications.warn(game.i18n.format("LEVERAGE.Warn.notEnoughPlotPoints", { cost: check.value, have }));
      return false;
    }
    await doc.addPlotPoints(-check.value);
    return true;
  },
  /**
   * Gives Plot Points to several characters with the chat line of the Fixer tools. Fixer only.
   * @param {(Actor|string)[]} actors Defaults to every Crew character.
   * @param {number} [n=1]
   * @returns {Promise<Actor[]>}
   */
  give: (actors = jobActions.crewActors(), n = 1) => jobActions.givePlotPoint(actors, n)
};

/* ------------------------------------------------------------------ traits lock, jobs */

const traits = {
  /** Locks the Traits for players (Fixer only). @returns {Promise<boolean>} */
  lock: () => controls.setTraitsLocked(true),
  /** Unlocks the Traits for players (Fixer only). @returns {Promise<boolean>} */
  unlock: () => controls.setTraitsLocked(false),
  /** @returns {boolean} Whether the Traits are locked. */
  isLocked: () => Boolean(game.settings.get(SYSTEM_ID, "traitsLocked"))
};

const job = {
  /** @returns {{name: string, complications: object[], sceneTraits?: object[]}} The active Job (a copy). */
  get: () => jobActions.readJob(),
  /**
   * Starts a Job: new active Job, each character gets the starting Plot Points. Fixer only.
   * @param {string} name
   * @returns {Promise<boolean>}
   */
  new: (name) => jobActions.newJob(name),
  /**
   * Ends the Job: pays the Crew, leaves a Job Item on each character, clears the active Job. Fixer only.
   * @param {object} result
   * @param {string} result.name
   * @param {number} result.total Total payout in steps.
   * @param {Record<string, number>} [result.shares] Steps by Crew actor id; defaults to an even split.
   * @returns {Promise<number>} characters paid
   */
  end({ name, total, shares } = {}) {
    const crew = jobActions.crewActors();
    const split = jobActions.evenSplit(total, crew.length);
    return jobActions.endJob({ name, total, shares: shares ?? Object.fromEntries(crew.map((a, i) => [a.id, split[i]])) });
  },
  /** New session: gives every Job its Callback back. Fixer only. @returns {Promise<number>} Jobs reset */
  newSession: () => jobActions.newSession(),
  /**
   * End of scene: removes scene Assets from the Crew. Fixer only.
   * @param {{confirm?: boolean}} [options] `confirm: true` asks first (default false in macros).
   * @returns {Promise<number|null>} Assets removed
   */
  endScene: ({ confirm = false } = {}) => jobActions.endScene({ confirm })
};

const jobTracker = {
  /** Opens the Job Tracker (Fixer only). @returns {Promise<void>} */
  open: () => controls.openTracker()
};

/* ------------------------------------------------------------------ combat */

const combat = {
  /**
   * Applies one round of damage to a character: margin + weapon die, cover halves, then vest, then Life. At 0 Life it
   * goes on to `down`. Fixer only; refused when the Life house rule is off.
   * @param {object} options `{target, margin, weaponDie, weaponRoll, cover, byPolice, confirm}` (see `damage.applyDamage`).
   * @returns {Promise<object|null>} The result record, or null when refused.
   */
  applyDamage: (options) => damage.applyDamage(options),
  /**
   * Wasted (or Busted with `byPolice`): full Life, +1 Plot Point, weapon Assets lost, hospital or bail paid, stars
   * after a rescue; posts the WASTED / BUSTED card. Fixer only.
   * @param {Actor|string} actor
   * @param {{byPolice?: boolean, confirm?: boolean}} [options]
   * @returns {Promise<object|null>}
   */
  down: (actor, options) => damage.down(actor, options)
};

/* ------------------------------------------------------------------ export */

/**
 * The object behind `game.leverage`.
 * @type {{rollPool: Function, pool: object, opposition: Function, openOppositionRoller: Function, money: object, stars: object,
 *   plotPoints: object, traits: object, job: object, jobTracker: object, combat: object}}
 */
export const api = Object.freeze({
  rollPool, pool, opposition, openOppositionRoller, money, stars, plotPoints, traits, job, jobTracker, combat
});

/** Publishes `game.leverage` and the socket action of `money.transfer` (call from the `setup` hook). */
export function registerApi() {
  game.leverage = api;
  registerSocketAction("moneyTransfer", onTransferRequest);
}
