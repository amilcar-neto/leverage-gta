/**
 * Wanted-star actions (docs/02 "Estrelas de procurado"): raise, set, wait out of sight, disguise, buy silence and the
 * city's last resort. The stars belong to the table and only the Fixer moves them, so every action is Fixer only
 * (a player's request would only be a button the Fixer has to confirm, so there is none).
 * The first half is pure (`planStarsAction`, unit tested): it takes the state (city, level, scales, the actor's Money)
 * and says what would change. The second half applies a plan: pays the Money, writes the `wanted` setting and posts
 * the chat line. It is the ONLY way the stars change (`api.stars.*`, the HUD, the controls and the Wasted/Busted card
 * all end here), one action at a time (`createSerialQueue`), so two actions never plan on the same old state.
 * Every action is refused when the `houseRules.stars` switch is off.
 * Buying silence and the disguise are "a quick roll against the police Pool": the Fixer rolls it, and applies the
 * action here after the roll passed.
 */
import { LEVERAGE, SYSTEM_ID } from "../../config.mjs";
import { readSetting } from "../../data/fields.mjs";
import { pay as payMoney, priceToSteps } from "../../rules/money.mjs";
import {
  bribeRule, clampStars, getCityScale, lastResortKind, lowerStars, poolText, raiseStars, starsAfterDisguise, starsAfterWaiting
} from "../../rules/stars.mjs";
import { getCityScales, readWanted } from "../../world-state.mjs";
import { createSerialQueue } from "../../socket.mjs";
import { resolveActor } from "../components/common.mjs";
import { t, tn } from "../components/i18n.mjs";

/** Template of the chat line. */
export const STARS_LINE_TEMPLATE = `systems/${SYSTEM_ID}/templates/chat/stars-line.hbs`;

/** All action names. */
export const STARS_ACTIONS = Object.freeze(["raise", "setLevel", "setCity", "wait", "disguise", "buySilence", "lastResort"]);

/** Disguise kinds. `both` is changing car and clothes. */
export const DISGUISE_KINDS = Object.freeze(["simple", "both"]);

/** Ways out accepted by the last resort where any exit will do (Carcer City). */
export const LAST_RESORT_WAYS = Object.freeze(["disguise", "silence", "wait"]);

/* ------------------------------------------------------------------ pure planning */

/**
 * @typedef {object} StarsState
 * @property {string} city City id.
 * @property {number} level Current stars.
 * @property {object[]} scales City scales in use.
 * @property {boolean} [rulesOn=true] The `houseRules.stars` switch.
 * @property {number} [steps=0] Money steps of the acting character (buy silence).
 */

/**
 * @typedef {object} StarsPlan
 * @property {boolean} ok
 * @property {string} [error] Key under `LEVERAGE.Stars.Error`.
 * @property {object} [data] Values for the error message.
 * @property {number} [from] Stars before.
 * @property {number} [to] Stars after.
 * @property {string} [city] New city id (only the `setCity` action changes the city).
 * @property {number[]} [cost] Money dice to pay.
 * @property {{key: string, data?: object}} [reason] Key under `LEVERAGE.Stars.Reason`.
 */

const refuse = (error, data) => ({ ok: false, error, ...(data ? { data } : {}) });
const done = (from, to, reason, cost) => ({ ok: true, from, to, reason, ...(cost ? { cost } : {}) });
const positiveInt = (n) => (Number.isInteger(Number(n)) && Number(n) > 0 ? Number(n) : 0);

/**
 * Whether a user may start an action: only the Fixer.
 * @param {string} action
 * @param {{isGM: boolean}} who
 * @returns {boolean}
 */
export function mayStart(action, { isGM }) {
  return Boolean(isGM) && STARS_ACTIONS.includes(action);
}

/** Raise by `n` (default 1), for a reason typed by the Fixer. */
function planRaise(state, { n = 1, reason = "" }) {
  const by = positiveInt(n);
  if (!by) return refuse("invalidAmount");
  const from = clampStars(state.level);
  if (from >= LEVERAGE.stars.max) return refuse("atMax", { max: LEVERAGE.stars.max });
  const text = String(reason ?? "").trim();
  return done(from, raiseStars(from, by), text ? { key: "custom", data: { text } } : { key: "raise" });
}

/** The Fixer sets the level directly. */
function planSetLevel(state, { level }) {
  const n = Number(level);
  if (!Number.isInteger(n) || n < LEVERAGE.stars.min || n > LEVERAGE.stars.max) {
    return refuse("invalidLevel", { min: LEVERAGE.stars.min, max: LEVERAGE.stars.max });
  }
  const from = clampStars(state.level);
  return from === n ? refuse("unchanged") : done(from, n, { key: "setLevel" });
}

/** The Crew goes to another city: the stars are zeroed (docs/02 "Zeram quando a Equipe sai da cidade"). */
function planSetCity(state, { city }) {
  const scale = state.scales.find((s) => s.id === city);
  if (!scale) return refuse("unknownCity", { city: String(city) });
  if (city === state.city) return refuse("sameCity");
  return { ...done(clampStars(state.level), LEVERAGE.stars.min, { key: "changeCity", data: { city: scale.name } }), city };
}

/** Waiting out of sight: `scenes` scenes, or the break between sessions where the city only allows that. */
function planWait(state, { scenes = 1, betweenSessions = false }) {
  const from = clampStars(state.level);
  if (!from) return refuse("noStars");
  const scale = getCityScale(state.city, state.scales);
  if (!scale.wait && !betweenSessions) return refuse("waitBetweenSessions");
  const count = scale.wait ? positiveInt(scenes) : 0;
  if (scale.wait && !count) return refuse("invalidAmount");
  const to = starsAfterWaiting(state.city, from, { scenes: count, betweenSessions }, state.scales);
  if (to === from) return refuse("notEnough", { scenes: scale.wait });
  return done(from, to, scale.wait ? { key: "waitScenes", data: { scenes: count } } : { key: "waitSession" });
}

/** A successful disguise roll. */
function planDisguise(state, { kind = "simple", sketched = false }) {
  if (!DISGUISE_KINDS.includes(kind)) return refuse("invalidKind");
  const from = clampStars(state.level);
  if (!from) return refuse("noStars");
  const scale = getCityScale(state.city, state.scales);
  if (sketched && scale.sketchBlocksDisguise) return refuse("sketched");
  const to = starsAfterDisguise(state.city, from, { carAndClothes: kind === "both", sketched }, state.scales);
  return to === from ? refuse("unchanged") : done(from, to, { key: kind === "both" ? "disguiseBoth" : "disguise" });
}

/** Dice and stars of buying silence in a city: one die of the smallest listed size per purchase. */
export function silenceOffer(cityId, scales) {
  const rule = bribeRule(cityId, scales);
  if (!rule) return null;
  const die = Math.min(...rule.dice);
  return { die, starsPerDie: rule.stars };
}

/** Pays `count` dice of silence from the state's Money; the plan result is `{cost}` or a refusal. */
function silenceCost(state, offer, count) {
  const cost = Array(count).fill(offer.die);
  const paid = payMoney(state.steps ?? 0, priceToSteps(cost));
  return paid.ok ? { ok: true, cost } : refuse("short", { shortBy: paid.shortBy });
}

/** Buying silence: pays `count` dice, each removing the city's stars; never pays for more dice than needed. */
function planBribe(state, { count = 1, name = "" }) {
  const offer = silenceOffer(state.city, state.scales);
  if (!offer) return refuse("noSilence");
  const from = clampStars(state.level);
  if (!from) return refuse("noStars");
  const dice = Math.min(positiveInt(count) || 1, Math.ceil(from / offer.starsPerDie));
  const priced = silenceCost(state, offer, dice);
  if (!priced.ok) return priced;
  const text = poolText(priced.cost);
  return done(from, lowerStars(from, dice * offer.starsPerDie), { key: "silence", data: { name, dice: text } }, priced.cost);
}

/** Reason of a last resort that was a single exit (Carcer City). */
const WAY_REASON = Object.freeze({ disguise: "lastResortDisguise", silence: "lastResortSilence", wait: "lastResortWait" });

/** The way out where any exit will do: a disguise or waiting is free, silence pays what clears the stars. */
function lastResortAny(state, from, way, name) {
  if (!LAST_RESORT_WAYS.includes(way)) return refuse("invalidWay");
  const reason = { key: WAY_REASON[way], data: { name } };
  if (way !== "silence") return done(from, LEVERAGE.stars.min, reason);
  const offer = silenceOffer(state.city, state.scales);
  if (!offer) return refuse("noSilence");
  const priced = silenceCost(state, offer, Math.ceil(from / offer.starsPerDie));
  return priced.ok ? done(from, LEVERAGE.stars.min, { key: reason.key, data: { name, dice: poolText(priced.cost) } }, priced.cost) : priced;
}

/** The way out of Las Venturas: change looks, then buy silence for the stars that are left. */
function lastResortBoth(state, from, name) {
  const offer = silenceOffer(state.city, state.scales);
  if (!offer) return refuse("noSilence");
  const left = starsAfterDisguise(state.city, from, {}, state.scales);
  if (!left) return done(from, LEVERAGE.stars.min, { key: "lastResortBothFree", data: { name } });
  const priced = silenceCost(state, offer, Math.ceil(left / offer.starsPerDie));
  return priced.ok ? done(from, LEVERAGE.stars.min, { key: "lastResortBoth", data: { name, dice: poolText(priced.cost) } }, priced.cost) : priced;
}

/**
 * The last resort (docs/02): what it takes depends on the city (`lastResortKind`). The Fixer confirms (`confirmed`)
 * that the Crew did it: any exit (Carcer City), changing looks and buying silence (Las Venturas) or handing over a
 * scapegoat in a mini-heist (Liberty City). The stars go to 0.
 */
function planLastResort(state, { way = "disguise", confirmed = false, name = "" }) {
  const from = clampStars(state.level);
  if (!from) return refuse("noStars");
  if (confirmed !== true) return refuse("needsConfirm");
  const kind = lastResortKind(state.city, state.scales);
  if (kind === "scapegoat") return done(from, LEVERAGE.stars.min, { key: "lastResortScapegoat", data: { name } });
  return kind === "any" ? lastResortAny(state, from, way, name) : lastResortBoth(state, from, name);
}

const PLANNERS = { raise: planRaise, setLevel: planSetLevel, setCity: planSetCity, wait: planWait, disguise: planDisguise, buySilence: planBribe, lastResort: planLastResort };

/**
 * Plans an action without touching anything.
 * @param {string} action One of `STARS_ACTIONS`.
 * @param {object} params Parameters of the action (see the public functions below).
 * @param {StarsState} state
 * @returns {StarsPlan}
 */
export function planStarsAction(action, params, state) {
  if (state.rulesOn === false) return refuse("disabled");
  const planner = PLANNERS[action];
  return planner ? planner(state, params ?? {}) : refuse("unknownAction");
}

/**
 * Context of the chat line template.
 * @param {{from: number, to: number, reasonText: string}} data
 * @returns {{from: number, to: number, direction: "up"|"down", reason: string, stars: {on: boolean}[]}}
 */
export function starsLineContext({ from, to, reasonText }) {
  return {
    from, to, direction: to >= from ? "up" : "down", reason: reasonText,
    stars: Array.from({ length: LEVERAGE.stars.max }, (_, i) => ({ on: i < to }))
  };
}

/* ------------------------------------------------------------------ foundry side */

/** Current state of the stars for planning. @param {Actor} [actor] */
function readState(actor) {
  return {
    ...readWanted(), scales: getCityScales(), rulesOn: Boolean(readSetting("houseRules.stars", true)),
    steps: actor?.system.money?.steps ?? 0
  };
}

/** Messages of `LEVERAGE.Stars` that change with a number: key -> the data field holding it. */
const PLURAL_FIELDS = { notEnough: "scenes", short: "shortBy", waitScenes: "scenes" };

/** Localizes `LEVERAGE.Stars.<group>.<key>`, picking the singular/plural form for the keys in `PLURAL_FIELDS`. */
function starsText(group, key, data) {
  const field = PLURAL_FIELDS[key];
  const path = `LEVERAGE.Stars.${group}.${key}`;
  return field && Number.isFinite(data?.[field]) ? tn(path, data[field], data) : t(path, data);
}

/** Shows the warning of a refused plan to the person who asked. */
function warn(plan) {
  ui.notifications.warn(starsText("Error", plan.error, plan.data));
}

/** Posts the chat line of a change. */
async function postLine(plan, actor) {
  const { key, data } = plan.reason;
  const reasonText = starsText("Reason", key, data);
  const content = await foundry.applications.handlebars.renderTemplate(STARS_LINE_TEMPLATE, {
    ...starsLineContext({ from: plan.from, to: plan.to, reasonText }),
    label: t("LEVERAGE.Stars.Chat.label"),
    change: t("LEVERAGE.Stars.Chat.change", { from: plan.from, to: plan.to })
  });
  const speaker = actor ? ChatMessage.getSpeaker({ actor }) : { alias: t("LEVERAGE.GM.Chat.speaker") };
  return ChatMessage.create({ content, speaker });
}

/** Resolves the actor of a request to a Crew actor. */
function crewFrom(ref) {
  const actor = resolveActor(ref);
  return actor?.type === "crew" ? actor : null;
}

/** Whether an action must name a character: it pays Money (the last resort only where it asks for dice). */
function needsActor(action, params, state) {
  if (action === "buySilence") return true;
  if (action !== "lastResort") return false;
  const kind = lastResortKind(state.city, state.scales);
  return kind === "disguiseAndSilence" || (kind === "any" && params.way === "silence");
}

/** Plans an action on the current state; refuses when the user is not the Fixer or a character is missing. */
function planNow(action, params, actor) {
  const state = readState(actor);
  if (!mayStart(action, { isGM: game.user.isGM })) return refuse("notAllowed");
  if (state.rulesOn !== false && needsActor(action, params, state) && !actor) return refuse("noActor");
  return planStarsAction(action, { ...params, name: actor?.name }, state);
}

/** One action at a time: planning, paying and writing never interleave with another action. */
const serial = createSerialQueue();

/** Pays and writes a plan that was made on the state `readState` returned a moment ago. */
async function apply(plan, actor) {
  if (plan.cost) {
    const paid = await actor.money.pay(plan.cost);
    if (!paid.ok) return refuse("short", { shortBy: paid.shortBy });
  }
  const wanted = readWanted();
  await game.settings.set(SYSTEM_ID, "wanted", { ...readSetting("wanted", {}), city: plan.city ?? wanted.city, level: plan.to });
  if (plan.from !== plan.to) await postLine(plan, actor); // a city change with no stars to clear has nothing to announce
  return plan;
}

/**
 * Plans and applies one action: pays the Money, writes `wanted`, posts the chat line. Fixer only; one at a time.
 * @param {string} action One of `STARS_ACTIONS`.
 * @param {object} [params] Parameters of the action; `actor` (UUID or document) for the ones that pay Money.
 * @returns {Promise<StarsPlan>}
 */
export function performStarsAction(action, params = {}) {
  return serial(async () => {
    const actor = params.actor ? crewFrom(params.actor) : null;
    const plan = planNow(action, params, actor);
    const result = plan.ok ? await apply(plan, actor) : plan;
    if (!result.ok) warn(result);
    return result;
  });
}

/**
 * Raises the wanted level (a crime was seen, a shot in public, a cop hurt...). Fixer only.
 * @param {number} [n=1] Stars to add (the level stops at 5).
 * @param {string} [reason] Free text for the chat line.
 * @returns {Promise<StarsPlan>}
 */
export const raise = (n = 1, reason = "") => performStarsAction("raise", { n, reason });

/**
 * Sets the level directly with a chat line. Fixer only.
 * @param {number} level 0..5
 * @returns {Promise<StarsPlan>}
 */
export const setLevel = (level) => performStarsAction("setLevel", { level });

/**
 * Moves the Crew to another city: the level goes to 0 with a chat line (the one way the city changes). Fixer only.
 * @param {string} city City id of the scales in use.
 * @returns {Promise<StarsPlan>}
 */
export const setCity = (city) => performStarsAction("setCity", { city });

/**
 * Waiting out of sight (free). `scenes` counts toward the city's scenes-per-star; in cities that only allow
 * waiting between sessions pass `{betweenSessions: true}`. Fixer only.
 * @param {number} [scenes=1]
 * @param {{betweenSessions?: boolean}} [options]
 * @returns {Promise<StarsPlan>}
 */
export const lowerByWaiting = (scenes = 1, options = {}) => performStarsAction("wait", { scenes, ...options });

/**
 * A disguise that worked (the quick roll against the police Pool was passed). Fixer only.
 * @param {"simple"|"both"} [kind="simple"] `both` = car and clothes.
 * @param {{sketched?: boolean}} [options] `sketched`: someone has a composite sketch (blocks it in Liberty City).
 * @returns {Promise<StarsPlan>}
 */
export const lowerByDisguise = (kind = "simple", options = {}) => performStarsAction("disguise", { kind, ...options });

/**
 * Buys silence with Money dice from the character, after the quick roll against the police Pool was passed (the
 * city decides the die and the stars; some cities refuse). Fixer only.
 * @param {Actor|string} actor
 * @param {{count?: number}} [options] Number of dice to pay (never more than needed).
 * @returns {Promise<StarsPlan>}
 */
export const buySilence = (actor, options = {}) => performStarsAction("buySilence", { actor, ...options });

/**
 * The last resort of the city (docs/02): the stars go to 0 once the Crew did what the city asks.
 * Carcer City: any way out (`way`: disguise, silence or wait). Las Venturas: change looks and buy silence (paid by
 * `actor`). Liberty City: hand over a scapegoat (a mini-heist). Fixer only, and `confirmed` must be true.
 * @param {Actor|string} [actor] Pays the silence where it is needed.
 * @param {{way?: string, confirmed?: boolean}} [options]
 * @returns {Promise<StarsPlan>}
 */
export const lastResort = (actor, options = {}) => performStarsAction("lastResort", { actor, ...options });
