/**
 * "Lend" dialog (docs/02): the character lends Money steps to another Crew character. A player who does not own
 * the receiver goes through the Fixer (socket); the Fixer checks everything again. The button stays off until the
 * loan is valid.
 */
import { transferNow } from "../../money-actions.mjs";
import { executeAsGM } from "../../socket.mjs";
import { checkLend } from "../../rules/money-flow.mjs";
import { stepsToDice } from "../../rules/money.mjs";
import { block } from "../chat/money-lines.mjs";
import { escapeHtml } from "../components/die.mjs";
import { t } from "../components/i18n.mjs";

/** Other Crew characters that can receive Money. */
const receivers = (actor) => game.actors.filter((a) => a.type === "crew" && a.id !== actor.id);

/** Dialog body. */
function content(actor, others) {
  const options = others.map((a) => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join("");
  return `<div class="lv-dlg lv-money-dlg">
    <label class="lv-dlg-field"><span>${t("LEVERAGE.Money.Lend.to")}</span><select name="to">${options}</select></label>
    <label class="lv-dlg-field"><span>${t("LEVERAGE.Money.Lend.amount")}</span>
      <input type="number" name="amount" min="1" max="${actor.system.money.steps}" step="1" value="1"></label>
    <p class="lv-dlg-hint">${t("LEVERAGE.Money.Lend.hint")}</p>
    <div class="lv-money-row lv-money-summary" data-summary></div>
    <p class="lv-money-warn" data-warn hidden></p></div>`;
}

/** Keeps summary, warning and OK button in step with the form. */
function wire(dialog, actor) {
  const form = dialog.element.querySelector("form");
  const ok = dialog.element.querySelector('button[data-action="ok"]');
  const refresh = () => {
    const target = game.actors.get(form.elements.to.value);
    const amount = Number(form.elements.amount.value);
    const check = checkLend({ fromSteps: actor.system.money.steps, toSteps: target?.system.money.steps ?? 0, amount, sameActor: !target });
    form.querySelector("[data-summary]").innerHTML = block(t("LEVERAGE.Money.Lend.you"), stepsToDice(check.from))
      + block(t("LEVERAGE.Money.amount"), stepsToDice(check.ok ? amount : 0)) + block(t("LEVERAGE.Money.Lend.them"), stepsToDice(check.to));
    const warn = form.querySelector("[data-warn]");
    warn.hidden = check.ok;
    warn.textContent = check.ok ? "" : t(`LEVERAGE.Money.Lend.Error.${check.error}`);
    ok.disabled = !check.ok;
  };
  form.addEventListener("input", refresh);
  form.addEventListener("change", refresh);
  refresh();
}

/**
 * Lends steps: directly when the caller is the Fixer or owns both sides, otherwise by asking the Fixer.
 * @param {Actor} from
 * @param {Actor} to
 * @param {number} amount
 * @returns {Promise<boolean>} false when nothing could be requested or moved
 */
export async function lendMoney(from, to, amount) {
  if (game.user.isGM || to.isOwner) return Boolean(await transferNow(from, to, amount));
  return executeAsGM("moneyTransfer", { from: from.uuid, to: to.uuid, amount });
}

/**
 * Opens the Lend dialog for a Crew character and lends when confirmed.
 * @param {Actor} actor Lender (a Crew actor the user may change).
 * @returns {Promise<{to: string, amount: number}|null>} the loan asked for, or null when cancelled
 */
export async function openLendDialog(actor) {
  const others = receivers(actor);
  if (!others.length) return ui.notifications.info(t("LEVERAGE.Money.Lend.nobody")) ?? null;
  const loan = await foundry.applications.api.DialogV2.prompt({
    classes: ["leverage-gta", "lv-dialog"],
    window: { title: t("LEVERAGE.Money.Lend.title", { name: actor.name }) },
    position: { width: 400 },
    rejectClose: false,
    content: content(actor, others),
    render: (_event, dialog) => wire(dialog, actor),
    ok: {
      label: t("LEVERAGE.Money.Lend.confirm"),
      callback: (_event, button) => ({ to: button.form.elements.to.value, amount: Number(button.form.elements.amount.value) })
    }
  });
  const target = loan && game.actors.get(loan.to);
  if (!target) return null;
  await lendMoney(actor, target, loan.amount);
  return loan;
}
