/**
 * "Pay" dialog (docs/02): pick an item of the price list (`prices` setting) or build a free price in dice, see the
 * cost, the current Money and what is left, and pay. The button stays off while the Money is short.
 */
import { LEVERAGE } from "../../config.mjs";
import { payPrice } from "../../money-actions.mjs";
import { MAX_DICE_PER_SIZE, checkPayment, diceFromCounts, describeCost } from "../../rules/money-flow.mjs";
import { stepsToDice } from "../../rules/money.mjs";
import { poolText } from "../../rules/stars.mjs";
import { getPrices } from "../../world-state.mjs";
import { block } from "../chat/money-lines.mjs";
import { escapeHtml } from "../components/die.mjs";
import { t, tn } from "../components/i18n.mjs";

const CUSTOM = "__custom";

/** Display name of a price entry: i18n key for the built-in ones, plain text for the GM's own. */
const priceLabel = (price) => t(price.label);

/** Options of the item select. */
function itemOptions(prices) {
  const rows = prices.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(priceLabel(p))} (${poolText(p.dice)})</option>`);
  rows.push(`<option value="${CUSTOM}">${t("LEVERAGE.Money.Pay.customItem")}</option>`);
  return rows.join("");
}

/** The count inputs of the free price. */
function customInputs() {
  return LEVERAGE.dice.map((die) => `<label class="lv-money-count"><span>d${die}</span>
    <input type="number" name="count-${die}" min="0" max="${MAX_DICE_PER_SIZE}" step="1" value="0"></label>`).join("");
}

/** Dialog body. */
function content(prices) {
  return `<div class="lv-dlg lv-money-dlg">
    <label class="lv-dlg-field"><span>${t("LEVERAGE.Money.Pay.item")}</span>
      <select name="price">${itemOptions(prices)}</select></label>
    <div class="lv-money-custom" data-custom hidden>
      <div class="lv-money-counts">${customInputs()}</div></div>
    <div class="lv-money-row lv-money-summary" data-summary></div>
    <p class="lv-money-warn" data-warn hidden></p></div>`;
}

/** The price chosen in the form: `{id, label, dice}`. */
function chosenPrice(form, prices) {
  if (form.elements.price.value === CUSTOM) {
    const counts = Object.fromEntries(LEVERAGE.dice.map((d) => [d, form.elements[`count-${d}`].value]));
    return { id: CUSTOM, label: t("LEVERAGE.Money.Pay.customName"), dice: diceFromCounts(counts) };
  }
  return prices.find((p) => p.id === form.elements.price.value) ?? { id: CUSTOM, label: "", dice: [] };
}

/** Keeps summary, warning and OK button in step with the form. */
function wire(dialog, actor, prices) {
  const form = dialog.element.querySelector("form");
  const ok = dialog.element.querySelector('button[data-action="ok"]');
  const refresh = () => {
    const price = chosenPrice(form, prices);
    const check = checkPayment(actor.system.money.steps, price.dice);
    form.querySelector("[data-custom]").hidden = form.elements.price.value !== CUSTOM;
    form.querySelector("[data-summary]").innerHTML = block(t("LEVERAGE.Money.cost"), describeCost(price.dice).dice)
      + block(t("LEVERAGE.Money.have"), stepsToDice(actor.system.money.steps)) + block(t("LEVERAGE.Money.left"), stepsToDice(check.after));
    const warn = form.querySelector("[data-warn]");
    warn.hidden = check.ok || check.error !== "short";
    warn.textContent = warn.hidden ? "" : tn("LEVERAGE.Money.Pay.short", check.shortBy);
    ok.disabled = !check.ok;
  };
  form.addEventListener("input", refresh);
  form.addEventListener("change", refresh);
  refresh();
}

/**
 * Opens the Pay dialog for a Crew character and pays when confirmed.
 * @param {Actor} actor Crew actor the user may change.
 * @returns {Promise<{ok: boolean, cost: number}|null>} the payment, or null when cancelled
 */
export async function openPayDialog(actor) {
  const prices = getPrices();
  const pick = await foundry.applications.api.DialogV2.prompt({
    classes: ["leverage-gta", "lv-dialog"],
    window: { title: t("LEVERAGE.Money.Pay.title", { name: actor.name }) },
    position: { width: 400 },
    rejectClose: false,
    content: content(prices),
    render: (_event, dialog) => wire(dialog, actor, prices),
    ok: {
      class: "lv-config-btn lv-config-btn--primary",
      label: t("LEVERAGE.Money.Pay.confirm"),
      callback: (_event, button) => chosenPrice(button.form, prices)
    }
  });
  if (!pick) return null;
  const paid = await payPrice(actor, pick.dice, pick.id === CUSTOM ? pick.label : t(pick.label), pick.id);
  if (paid.error === "full") ui.notifications.warn(t("LEVERAGE.Money.Pay.full"));
  else if (!paid.ok) ui.notifications.warn(tn("LEVERAGE.Money.Pay.short", paid.shortBy));
  return paid;
}
