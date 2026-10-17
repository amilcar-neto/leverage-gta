/**
 * Wanted-star actions (docs/02 "Estrelas de procurado"): raise, wait out of sight, disguise, buy silence, give in.
 * The first half is pure (`planStarsAction`, unit tested): it takes the state (city, level, scales, the actor's Money)
 * and says what would change. The second half applies a plan: pays the Money, writes the `wanted` setting and posts
 * the chat line. Only the Fixer writes `wanted`; a player who owns the character may buy silence or give in, and then
 * the request goes to the Fixer through the socket (`starsAction`), which plans again from its own state.
 * Every action is refused when the `houseRules.stars` switch is off.
 */
import { LEVERAGE, SYSTEM_ID } from "../../config.mjs";
import { logger } from "../../logger.mjs";
import { pay as payMoney, priceToSteps } from "../../rules/money.mjs";
import {
  bribeRule, clampStars, getCityScale, lowerStars, raiseStars, starsAfterDisguise, starsAfterWaiting
} from "../../rules/stars.mjs";
import { getCityScales } from "../../settings.mjs";
import { executeAsGM, registerSocketAction } from "../../socket.mjs";
import { t } from "../components/i18n.mjs";

/** Template of the chat line. */
export const STARS_LINE_TEMPLATE = `systems/${SYSTEM_ID}/templates/chat/stars-line.hbs`;

/** Socket action that carries a player's request to the Fixer. */
export const STARS_SOCKET_ACTION = "starsAction";

/** Actions an owner of the character may start without being the Fixer. */
export const PLAYER_ACTIONS = Object.freeze(["buySilence", "giveIn"]);

/** All action names. */
export const STARS_ACTIONS = Object.freeze(["raise", "setLevel", "wait", "disguise", "buySilence", "giveIn"]);

/** Disguise kinds. `both` is changing car and clothes. */
export const DISGUISE_KINDS = Object.freeze(["simple", "both"]);

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
 * @property {number[]} [cost] Money dice to pay.
 * @property {{key: string, data?: object}} [reason] Key under `LEVERAGE.Stars.Reason`.
 */

const refuse = (error, data) => ({ ok: false, error, ...(data ? { data } : {}) });
const done = (from, to, reason, cost) => ({ ok: true, from, to, reason, ...(cost ? { cost } : {}) });
const positiveInt = (n) => (Number.isInteger(Number(n)) && Number(n) > 0 ? Number(n) : 0);

/**
 * Whether a user may start an action.
 * @param {string} action
 * @param {{isGM: boolean, ownsActor?: boolean}} who
 * @returns {boolean}
 */
export function mayStart(action, { isGM, ownsActor = false }) {
  if (isGM) return true;
  return PLAYER_ACTIONS.includes(action) && ownsActor;
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
  return to === from ? refuse("notEnough") : done(from, to, { key: kind === "both" ? "disguiseBoth" : "disguise" });
}

/** Dice and stars of buying silence in a city: one die of the smallest listed size per purchase. */
export function silenceOffer(cityId, scales) {
  const rule = bribeRule(cityId, scales);
  if (!rule) return null;
  const die = Math.min(...rule.dice);
  return { die, starsPerDie: rule.stars };
}

/** Buying silence: pays `count` dice, each removing the city's stars; never pays for more dice than needed. */
function planBribe(state, { count = 1, name = "" }) {
  const offer = silenceOffer(state.city, state.scales);
  if (!offer) return refuse("noSilence");
  const from = clampStars(state.level);
  if (!from) return refuse("noStars");
  const dice = Math.min(positiveInt(count) || 1, Math.ceil(from / offer.starsPerDie));
  const cost = Array(dice).fill(offer.die);
  const paid = payMoney(state.steps ?? 0, priceToSteps(cost));
  if (!paid.ok) return refuse("short", { shortBy: paid.shortBy });
  const text = cost.map((d) => `d${d}`).join(" + ");
  return done(from, lowerStars(from, dice * offer.starsPerDie), { key: "silence", data: { name, dice: text } }, cost);
}

/** Giving in: the last way out, the stars go to 0. */
function planGiveIn(state, { name = "" }) {
  const from = clampStars(state.level);
  return from ? done(from, LEVERAGE.stars.min, { key: "giveIn", data: { name } }) : refuse("noStars");
}

const PLANNERS = { raise: planRaise, setLevel: planSetLevel, wait: planWait, disguise: planDisguise, buySilence: planBribe, giveIn: planGiveIn };

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

const setting = (key, fallback) => game.settings.get(SYSTEM_ID, key) ?? fallback;

/** Current state of the stars for planning. @param {Actor} [actor] */
function readState(actor) {
  const wanted = setting("wanted", {});
  return {
    city: wanted.city ?? LEVERAGE.stars.defaultCity, level: clampStars(wanted.level ?? 0), scales: getCityScales(),
    rulesOn: Boolean(setting("houseRules.stars", true)), steps: actor?.system.money?.steps ?? 0
  };
}

/** Shows the warning of a refused plan to the person who asked. */
function warn(plan, userId) {
  const message = t(`LEVERAGE.Stars.Error.${plan.error}`, plan.data);
  if (userId === game.user.id) ui.notifications.warn(message);
  else logger.warn(`Stars action refused for ${userId}: ${plan.error}`);
}

/** Posts the chat line of a change. */
async function postLine(plan, actor) {
  const { key, data } = plan.reason;
  const reasonText = t(`LEVERAGE.Stars.Reason.${key}`, data);
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
  const doc = typeof ref === "string" ? (fromUuidSync(ref) ?? game.actors.get(ref)) : ref;
  return doc?.documentName === "Actor" && doc.type === "crew" ? doc : null;
}

/**
 * Plans and applies one action with the Fixer's rights: pays the Money, writes `wanted`, posts the line.
 * @param {string} action
 * @param {object} [params] `actor` (UUID or document) for buySilence and giveIn.
 * @param {string} [userId] Who asked (a player must own the character).
 * @returns {Promise<StarsPlan>}
 */
export async function performStarsAction(action, params = {}, userId = game.user.id) {
  const user = game.users.get(userId);
  const actor = params.actor ? crewFrom(params.actor) : null;
  const needsActor = PLAYER_ACTIONS.includes(action);
  let plan;
  if (!user || (needsActor && !actor)) plan = refuse("noActor");
  else if (!mayStart(action, { isGM: user.isGM, ownsActor: Boolean(actor?.testUserPermission(user, "OWNER")) })) plan = refuse("notAllowed");
  else plan = planStarsAction(action, { ...params, name: actor?.name }, readState(actor));
  if (!plan.ok) {
    warn(plan, userId);
    return plan;
  }
  if (plan.cost) {
    const paid = await actor.money.pay(plan.cost);
    if (!paid.ok) {
      const failed = refuse("short", { shortBy: paid.shortBy });
      warn(failed, userId);
      return failed;
    }
  }
  const wanted = setting("wanted", {});
  await game.settings.set(SYSTEM_ID, "wanted", { ...wanted, city: wanted.city ?? LEVERAGE.stars.defaultCity, level: plan.to });
  await postLine(plan, PLAYER_ACTIONS.includes(action) ? actor : null);
  return plan;
}

/** Runs an action: here when the user is the Fixer, through the socket when a player starts it. */
async function dispatch(action, params) {
  const actor = params.actor ? crewFrom(params.actor) : null;
  if (game.user.isGM) return performStarsAction(action, { ...params, actor: actor?.uuid }, game.user.id);
  const allowed = mayStart(action, { isGM: false, ownsActor: Boolean(actor?.isOwner) });
  const plan = allowed ? planStarsAction(action, { ...params, name: actor?.name }, readState(actor)) : refuse("notAllowed");
  if (!plan.ok) {
    warn(plan, game.user.id);
    return plan;
  }
  const sent = await executeAsGM(STARS_SOCKET_ACTION, { action, params: { ...params, actor: actor.uuid } });
  return sent ? { ...plan, pending: true } : refuse("noGM");
}

/**
 * Raises the wanted level (a crime was seen, a shot in public, a cop hurt...). Fixer only.
 * @param {number} [n=1] Stars to add (the level stops at 5).
 * @param {string} [reason] Free text for the chat line.
 * @returns {Promise<StarsPlan>}
 */
export const raise = (n = 1, reason = "") => dispatch("raise", { n, reason });

/**
 * Sets the level directly with a chat line. Fixer only.
 * @param {number} level 0..5
 * @returns {Promise<StarsPlan>}
 */
export const setLevel = (level) => dispatch("setLevel", { level });

/**
 * Waiting out of sight (free). `scenes` counts toward the city's scenes-per-star; in cities that only allow
 * waiting between sessions pass `{betweenSessions: true}`. Fixer only.
 * @param {number} [scenes=1]
 * @param {{betweenSessions?: boolean}} [options]
 * @returns {Promise<StarsPlan>}
 */
export const lowerByWaiting = (scenes = 1, options = {}) => dispatch("wait", { scenes, ...options });

/**
 * A disguise that worked (the quick roll against the police Pool was passed). Fixer only.
 * @param {"simple"|"both"} [kind="simple"] `both` = car and clothes.
 * @param {{sketched?: boolean}} [options] `sketched`: someone has a composite sketch (blocks it in Liberty City).
 * @returns {Promise<StarsPlan>}
 */
export const lowerByDisguise = (kind = "simple", options = {}) => dispatch("disguise", { kind, ...options });

/**
 * Buys silence with Money dice from the character (the city decides the die and the stars; some cities refuse).
 * The Fixer, or a player for his own character.
 * @param {Actor|string} actor
 * @param {{count?: number}} [options] Number of dice to pay (never more than needed).
 * @returns {Promise<StarsPlan>}
 */
export const buySilence = (actor, options = {}) => dispatch("buySilence", { actor, ...options });

/**
 * The last way out: the character gives in (or hands over a scapegoat) and the stars go to 0.
 * The Fixer, or a player for his own character.
 * @param {Actor|string} actor
 * @returns {Promise<StarsPlan>}
 */
export const giveIn = (actor) => dispatch("giveIn", { actor });

/**
 * Fixer side of the socket request of a player.
 * @param {{action: string, params: object}} request
 * @param {string} userId
 */
export async function onStarsRequest({ action, params }, userId) {
  if (!PLAYER_ACTIONS.includes(action)) return logger.warn("Stars request refused: not a player action");
  await performStarsAction(action, params, userId);
}

/** Registers the socket action (call from `setup`, with the API). */
export function registerStarsActions() {
  registerSocketAction(STARS_SOCKET_ACTION, onStarsRequest);
}
