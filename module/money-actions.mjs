/**
 * Foundry side of the Money flows (docs/02): paying a price and lending between characters, each with its chat
 * line. Used by the Pay/Lend dialogs and by `game.leverage.money.transfer`. Lending crosses characters, so a
 * player who does not own the receiver asks the Fixer through the socket (`moneyTransfer`); the Fixer validates
 * ownership of the lender and the balance again before moving anything.
 */
import { postLendLine, postPayLine } from "./applications/chat/money-lines.mjs";
import { logger } from "./logger.mjs";
import { checkLend, checkPayment, describeCost } from "./rules/money-flow.mjs";
import { lend } from "./rules/money.mjs";

/**
 * Pays a price in dice from a character's Money and posts the chat line. Nothing is spent when short.
 * @param {Actor} actor Crew actor the caller may change.
 * @param {number[]} dice Price dice.
 * @param {string} item What is being bought (translated).
 * @returns {Promise<{ok: boolean, error?: string, cost: number, shortBy: number}>}
 */
export async function payPrice(actor, dice, item) {
  const price = describeCost(dice);
  const check = checkPayment(actor.system.money.steps, price.dice);
  if (!check.ok) return check;
  const paid = await actor.money.pay(price.dice);
  if (!paid.ok) return { ok: false, error: "short", cost: check.cost, after: paid.steps, shortBy: paid.shortBy };
  await postPayLine(actor, { item, cost: price.dice, after: paid.steps });
  return { ...check, after: paid.steps };
}

/**
 * Moves Money between two characters (at most what the lender has and the receiver can hold) and posts the line.
 * Runs with the permissions of the caller: use it as the Fixer or when the caller owns both sides.
 * @param {Actor} from
 * @param {Actor} to
 * @param {number} amount Steps.
 * @returns {Promise<number>} steps moved
 */
export async function transferNow(from, to, amount) {
  const moved = lend(from.system.money.steps, to.system.money.steps, amount);
  if (!moved.moved) return 0;
  await from.update({ "system.money.steps": moved.from });
  await to.update({ "system.money.steps": moved.to });
  await postLendLine(from, to, moved.moved);
  return moved.moved;
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
