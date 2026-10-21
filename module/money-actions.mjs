/**
 * Foundry side of the Money flows (docs/02): paying a price and lending between characters, each with its chat
 * line. Used by the Pay/Lend dialogs and by `game.leverage.money.transfer`. Lending crosses characters, so a
 * player who does not own the receiver asks the Fixer through the socket (`moneyTransfer`); the Fixer validates
 * ownership of the lender and the balance again before moving anything.
 */
import { postLendLine, postPayLine } from "./applications/chat/money-lines.mjs";
import { LEVERAGE } from "./config.mjs";
import { logger } from "./logger.mjs";
import { checkLend, checkPayment, describeCost } from "./rules/money-flow.mjs";
import { lend } from "./rules/money.mjs";

/**
 * Price-list ids that do more than take Money: the hospital also restores all Life and a vest also puts that vest on,
 * full (docs/02). The effect pays the price itself (the `hospital` / `vest*` entries of the price list).
 * @type {Record<string, (actor: Actor) => Promise<{ok: boolean, shortBy: number}>>}
 */
const PRICE_EFFECTS = Object.freeze({
  hospital: (actor) => actor.medicalTreatment(),
  ...Object.fromEntries(Object.entries(LEVERAGE.vestKinds)
    .filter(([, def]) => def.priceId)
    .map(([kind, def]) => [def.priceId, (actor) => actor.buyVest(kind)]))
});

/**
 * Whether the effect of a price-list entry would change nothing: treatment with full Life, or the vest the character
 * already wears, full. Such a purchase is refused instead of charged (docs/02).
 * @param {Actor} actor
 * @param {string} [id] Id of the price-list entry.
 * @returns {boolean}
 */
export function effectIsUseless(actor, id) {
  const { life, vest } = actor.system;
  if (id === "hospital") return Boolean(life) && life.value >= life.max;
  const kind = Object.keys(LEVERAGE.vestKinds).find((k) => LEVERAGE.vestKinds[k].priceId === id);
  return Boolean(kind) && vest?.kind === kind && vest.value >= vest.max;
}

/**
 * Pays a price in dice from a character's Money and posts the chat line. Nothing is spent when short. A price-list
 * `id` with an effect (hospital, vests) runs that effect instead of a plain payment: Life back to full, or the vest on.
 * @param {Actor} actor Crew actor the caller may change.
 * @param {number[]} dice Price dice.
 * @param {string} item What is being bought (translated).
 * @param {string} [id] Id of the price-list entry (`hospital`, `vestLight`...).
 * @returns {Promise<{ok: boolean, error?: string, cost: number, shortBy: number}>} `error` is `"full"` (nothing to
 *   restore, nothing charged) or `"short"`.
 */
export async function payPrice(actor, dice, item, id) {
  if (effectIsUseless(actor, id)) return { ok: false, error: "full", cost: 0, shortBy: 0 };
  const price = describeCost(dice);
  const check = checkPayment(actor.system.money.steps, price.dice);
  if (!check.ok) return check;
  const effect = PRICE_EFFECTS[id];
  const paid = effect ? await effect(actor) : await actor.money.pay(price.dice);
  const after = actor.system.money.steps;
  if (!paid.ok) return { ok: false, error: "short", cost: check.cost, after, shortBy: paid.shortBy };
  await postPayLine(actor, { item, cost: price.dice, after });
  return { ...check, after };
}

/**
 * Moves Money between two characters (at most what the lender has and the receiver can hold) and posts the line.
 * Runs with the permissions of the caller: use it as the Fixer or when the caller owns both sides.
 * Each step reads the balance again after the previous await (`money.pay` / `money.add` do), so two loans from the
 * same wallet can never take more than it holds: the lender is charged first, the receiver is credited what fits, and
 * what did not fit goes back to the lender.
 * @param {Actor} from
 * @param {Actor} to
 * @param {number} amount Steps.
 * @returns {Promise<number>} steps moved
 */
export async function transferNow(from, to, amount) {
  const plan = lend(from.system.money.steps, to.system.money.steps, amount);
  if (!plan.moved) return 0;
  const charged = await from.money.pay(plan.moved);
  if (!charged.ok) return 0;
  const received = await to.money.add(plan.moved);
  if (received < plan.moved) await from.money.add(plan.moved - received);
  if (!received) return 0;
  await postLendLine(from, to, received);
  return received;
}

/**
 * Fixer side of the `moneyTransfer` socket action. Needs two different Crew actors, a requester who owns the
 * lender, and a loan that passes `checkLend` (whole steps, enough Money, room in the receiver's ladder).
 * @param {{from: string, to: string, amount: number}} request UUIDs and steps.
 * @param {string} userId Requesting user.
 */
export async function onTransferRequest({ from, to, amount }, userId) {
  const source = fromUuidSync(from);
  const target = fromUuidSync(to);
  const user = game.users.get(userId);
  const crew = source?.type === "crew" && target?.type === "crew";
  if (!crew || !user || !source.testUserPermission(user, "OWNER")) return logger.warn("Money transfer refused: not allowed");
  const check = checkLend({
    fromSteps: source.system.money.steps, toSteps: target.system.money.steps, amount, sameActor: source === target
  });
  if (!check.ok) return logger.warn(`Money transfer refused: ${check.error}`);
  await transferNow(source, target, Number(amount));
}
