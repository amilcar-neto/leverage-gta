
/**
 * Damage and Wasted/Busted (docs/02 "Vida e Colete", docs/08 "Tiroteio"). Foundry half: the "APPLY DAMAGE" button of the
 * opposition card, the damage round on a character, and what follows when Life reaches 0. The rules are the pure
 * functions of `rules/combat.mjs` (`damageRound`, `planDown`); the texts are built in `damage-lines.mjs`.
 * Everything here is Fixer only, and respects the `houseRules.life`, `.money` and `.stars` switches.
 */
import { LEVERAGE, SYSTEM_ID } from "../../config.mjs";
import { readSetting } from "../../data/fields.mjs";
import { getPriceDice } from "../../world-state.mjs";
import { damageRound, linkedRollIndex, lostBy, oppositionWins, planDown } from "../../rules/combat.mjs";
import { priceToSteps, stepsToDice } from "../../rules/money.mjs";
import { bailAllowed, poolText } from "../../rules/stars.mjs";
import { readWanted } from "../../world-state.mjs";
import { evaluateDice } from "../../dice/roll-core.mjs";
import { escapeHtml } from "../components/die.mjs";
import { t, tn } from "../components/i18n.mjs";
import { requireGM } from "../gm/job-actions.mjs";
import { raise } from "../gm/stars-actions.mjs";
import { damageLines, damageSummary, isPoliceSource, downCardContext, weaponOptions } from "./damage-lines.mjs";

/** Template of the WASTED / BUSTED card. */
export const DOWN_CARD_TEMPLATE = `systems/${SYSTEM_ID}/templates/chat/down-card.hbs`;

const rollOf = (message) => message?.getFlag(SYSTEM_ID, "roll") ?? null;
const dieText = (steps) => poolText(stepsToDice(steps));

/** The three house-rule switches. */
function houseRules() {
  return {
    life: Boolean(readSetting("houseRules.life", true)), money: Boolean(readSetting("houseRules.money", true)),
    stars: Boolean(readSetting("houseRules.stars", true))
  };
}

/** Whether damage may be applied now: Fixer, and the Life rule on. Warns otherwise. */
function allowed() {
  if (!requireGM()) return false;
  if (houseRules().life) return true;
  ui.notifications.warn(t("LEVERAGE.Damage.ruleOff"));
  return false;
}

/** Resolves an Actor, a UUID or an id to a Crew or NPC actor that has Life. */
function targetOf(target) {
  const doc = typeof target === "string" ? (fromUuidSync(target) ?? game.actors.get(target)) : target;
  const actor = doc?.documentName === "Token" ? doc.actor : doc;
  return actor?.documentName === "Actor" && actor.system?.life ? actor : null;
}

/* ------------------------------------------------------------ the card button */

/**
 * The player roll that this opposition card belongs to: the closest earlier Pool roll of a character.
 * @param {ChatMessage} message The opposition card.
 * @returns {{message: ChatMessage, data: object}|null}
 */
export function linkedRoll(message) {
  const all = game.messages.contents;
  const rolls = all.map(rollOf);
  const index = linkedRollIndex(rolls, all.indexOf(message));
  return index < 0 ? null : { message: all[index], data: rolls[index] };
}

/**
 * What the opposition card shows about damage.
 * @param {ChatMessage} message
 * @param {object} data `flags.leverage-gta.roll` of the card.
 * @returns {{show: boolean, applied: string}} `show`: the APPLY DAMAGE button; `applied`: summary once applied.
 */
export function damageView(message, data) {
  if (!data?.opposition) return { show: false, applied: "" };
  if (data.damage) return { show: false, applied: damageSummary(data.damage, t) };
  if (!game.user.isGM || !houseRules().life) return { show: false, applied: "" };
  const linked = linkedRoll(message);
  return { show: !linked || oppositionWins(linked.data.total, data.total), applied: "" };
}

/** `<option>` list. */
const options = (list, selected) => list.map(({ value, label, extra = "" }) =>
  `<option value="${escapeHtml(String(value))}"${String(value) === String(selected) ? " selected" : ""}${extra}>${escapeHtml(label)}</option>`).join("");

/** Dialog body. */
function dialogContent({ targets, attackers, selected, margin, police, hint }) {
  const weapons = weaponOptions(LEVERAGE.dice, LEVERAGE.weaponDice, t);
  const attackerList = [{ value: "", label: t("LEVERAGE.Damage.Dialog.attackerNone") }, ...attackers.map((a) => ({
    value: a.uuid, label: a.name, extra: ` data-weapon="${a.system.weapon?.die ?? 0}" data-police="${a.system.police ? 1 : 0}"`
  }))];
  return `<div class="lv-dlg">
    <label class="lv-dlg-field"><span>${t("LEVERAGE.Damage.Dialog.target")}</span>
      <select name="target">${options(targets.map((a) => ({ value: a.uuid, label: a.name })), selected)}</select></label>
    <label class="lv-dlg-field"><span>${t("LEVERAGE.Damage.Dialog.margin")}</span>
      <input type="number" name="margin" min="0" step="1" value="${margin}"></label>
    <label class="lv-dlg-field"><span>${t("LEVERAGE.Damage.Dialog.attacker")}</span>
      <select name="attacker">${options(attackerList, "")}</select></label>
    <label class="lv-dlg-field"><span>${t("LEVERAGE.Damage.Dialog.weapon")}</span>
      <select name="weapon">${options(weapons, 0)}</select></label>
    <label class="lv-dlg-check"><input type="checkbox" name="cover"><span>${t("LEVERAGE.Damage.Dialog.cover")}</span></label>
    <label class="lv-dlg-check"><input type="checkbox" name="police"${police ? " checked" : ""}><span>${t("LEVERAGE.Damage.Dialog.police")}</span></label>
    <p class="lv-dlg-hint">${escapeHtml(hint)}</p>
  </div>`;
}

/**
 * Asks the Fixer who gets hurt, by how much and with what.
 * @param {object} defaults
 * @returns {Promise<{target: string, margin: number, weaponDie: number, cover: boolean, byPolice: boolean}|null>}
 */
function promptDamage(defaults) {
  return foundry.applications.api.DialogV2.prompt({
    classes: ["leverage-gta", "lv-dialog"],
    window: { title: t("LEVERAGE.Damage.Dialog.title") },
    position: { width: 400 },
    rejectClose: false,
    content: dialogContent(defaults),
    render: (_event, dialog) => {
      const { elements } = dialog.element.querySelector("form");
      elements.attacker.addEventListener("change", () => {
        const chosen = elements.attacker.selectedOptions[0];
        if (!chosen?.value) return;
        elements.weapon.value = chosen.dataset.weapon ?? "0";
        elements.police.checked = chosen.dataset.police === "1";
      });
    },
    ok: {
      label: t("LEVERAGE.Damage.Dialog.confirm"),
      callback: (_event, button) => {
        const form = new foundry.applications.ux.FormDataExtended(button.form).object;
        return {
          target: form.target, margin: Math.max(0, Math.trunc(Number(form.margin) || 0)),
          weaponDie: Number(form.weapon) || 0, cover: Boolean(form.cover), byPolice: Boolean(form.police)
        };
      }
    }
  });
}

/**
 * Click on APPLY DAMAGE: asks, applies, and saves the result on the card.
 * @param {ChatMessage} message The opposition card.
 * @returns {Promise<void>}
 */
export async function damageFromCard(message) {
  const data = rollOf(message);
  if (!data?.opposition || data.damage || !allowed()) return;
  const linked = linkedRoll(message);
  const targets = game.actors.filter((a) => a.system?.life && ["crew", "npc"].includes(a.type));
  const answer = await promptDamage({
    targets, attackers: game.actors.filter((a) => a.type === "npc"),
    selected: linked?.data.actorUuid ?? targets[0]?.uuid,
    margin: linked ? lostBy(linked.data.total, data.total) : 0,
    police: isPoliceSource(data.source),
    hint: t(linked ? "LEVERAGE.Damage.Dialog.hintLinked" : "LEVERAGE.Damage.Dialog.hintFree")
  });
  if (!answer) return;
  const record = await applyDamage({ ...answer });
  if (record) await message.setFlag(SYSTEM_ID, "roll", { ...rollOf(message), damage: record });
}

/* ------------------------------------------------------------ the damage round */

/** Rolls the weapon die. @returns {Promise<{roll: Roll|null, value: number}>} */
async function rollWeapon(die) {
  if (!die) return { roll: null, value: 0 };
  const { roll, values } = await evaluateDice([die]);
  return { roll, value: values[0] };
}

/** Posts the chat line of the round (the weapon roll, when there is one, is the message). */
function postLine(record, roll) {
  const lines = damageLines(record, t).map((line) => `<p>${escapeHtml(line)}</p>`).join("");
  const data = {
    speaker: { alias: t("LEVERAGE.Damage.speaker") }, content: `<div class="leverage-gta lv-damage-line">${lines}</div>`,
    flavor: t("LEVERAGE.Damage.flavor", { name: record.targetName }), flags: { [SYSTEM_ID]: { damage: record } }
  };
  return roll ? roll.toMessage(data) : ChatMessage.create(data);
}

/**
 * Applies one round of damage to a character (docs/02): margin + weapon die, cover halves, then the vest, then Life.
 * Updates the target, posts a chat line and, if Life reaches 0, goes on to `down`. Fixer only.
 * @param {object} p
 * @param {Actor|string} p.target Crew or NPC actor (or its UUID).
 * @param {number} [p.margin=0] Points the target lost by.
 * @param {number} [p.weaponDie=0] Weapon die size (0 = unarmed); it is rolled here.
 * @param {number} [p.weaponRoll] Use this value instead of rolling (macros, tests).
 * @param {boolean} [p.cover=false] The target is in cover.
 * @param {boolean} [p.byPolice=false] The police did it: Busted instead of Wasted.
 * @param {boolean} [p.confirm=true] Ask before removing weapon Assets on Wasted/Busted.
 * @returns {Promise<(import("./damage-lines.mjs").DamageRecord)|null>} null when refused.
 */
export async function applyDamage({ target, margin = 0, weaponDie = 0, weaponRoll, cover = false, byPolice = false, confirm = true } = {}) {
  if (!allowed()) return null;
  const actor = targetOf(target);
  if (!actor) {
    ui.notifications.warn(t("LEVERAGE.Damage.noTarget"));
    return null;
  }
  const weapon = weaponRoll === undefined ? await rollWeapon(weaponDie) : { roll: null, value: Math.max(0, Number(weaponRoll) || 0) };
  const { life, vest } = actor.system;
  const round = damageRound({ margin, weaponRoll: weapon.value, life: life.value, vest: vest.value, cover });
  await actor.update({ "system.life.value": round.life, "system.vest.value": round.vest });
  const record = {
    targetUuid: actor.uuid, targetName: actor.name, margin, weaponDie, weaponRoll: weapon.value, raw: round.raw, cover,
    damage: round.damage, absorbed: round.absorbed, lifeLost: round.lifeLost, life: round.life, vest: round.vest,
    lifeMax: life.max, down: round.down, kind: null
  };
  await postLine(record, weapon.roll);
  if (round.down) record.kind = (await down(actor, { byPolice, confirm }))?.kind ?? null;
  return record;
}

/* ------------------------------------------------------------ Wasted / Busted */

/** Price of a price-list id, in steps. */
const priceSteps = (id) => priceToSteps(getPriceDice(id));

/** Scene weapon Assets of a character (lost on Wasted/Busted). */
const weaponAssets = (actor) => actor.items.filter((i) => i.type === "asset" && i.system.weapon && i.system.duration === "scene");

/** Asks whether to remove the weapon Assets. */
function confirmAssets(actor, names) {
  return foundry.applications.api.DialogV2.confirm({
    classes: ["leverage-gta", "lv-dialog"],
    window: { title: t("LEVERAGE.Damage.Dialog.assetsTitle") },
    rejectClose: false,
    content: `<div class="lv-dlg"><p>${escapeHtml(t("LEVERAGE.Damage.Dialog.assetsBody", { name: actor.name, names: names.join(", ") }))}</p></div>`
  });
}

/** Removes the weapon Assets (after asking, unless told not to). @returns {Promise<{lost: string[], kept: boolean}>} */
async function loseWeapons(actor, confirm) {
  const assets = weaponAssets(actor);
  if (!assets.length) return { lost: [], kept: false };
  const names = assets.map((a) => a.name);
  if (confirm && !(await confirmAssets(actor, names))) return { lost: [], kept: true };
  await actor.deleteEmbeddedDocuments("Item", assets.map((a) => a.id));
  return { lost: names, kept: false };
}

/** Posts the WASTED / BUSTED card. */
async function postDownCard(info, uuid) {
  const context = downCardContext(info, t, tn);
  const content = await foundry.applications.handlebars.renderTemplate(DOWN_CARD_TEMPLATE, context);
  const down = { kind: context.kind, name: info.name, uuid, rescuable: context.rescuable, rescued: false };
  return ChatMessage.create({ content, speaker: { alias: info.name }, flags: { [SYSTEM_ID]: { down } } });
}

/**
 * Life reached 0 (docs/02 "Quando a Vida zera"). Crew: Life back to full, +1 Plot Point, scene weapon Assets lost
 * (the Fixer is asked), Wasted pays the hospital, Busted pays bail where the city allows it. Money that is missing
 * is shown on the card as a debt (paid with what the character has, nothing is tracked). A Busted character that
 * could not buy his way out waits for a rescue: the card has a "Rescued" button for the Fixer, and the stars rise
 * then (`rescued`), not at the arrest. NPCs just fall (Life stays 0). Posts the WASTED / BUSTED card. Fixer only.
 * @param {Actor|string} target
 * @param {object} [options]
 * @param {boolean} [options.byPolice=false] Busted instead of Wasted.
 * @param {boolean} [options.confirm=true] Ask before removing weapon Assets.
 * @returns {Promise<{kind: "wasted"|"busted", plan: object, lostAssets: string[]}|null>}
 */
export async function down(target, { byPolice = false, confirm = true } = {}) {
  if (!allowed()) return null;
  const actor = targetOf(target);
  if (!actor) return null;
  const isCrew = actor.type === "crew";
  const plan = planDown({
    byPolice, isCrew, max: actor.system.life.max, hospitalSteps: priceSteps("hospital"), bailSteps: priceSteps("bail"),
    bailAllowed: bailAllowed(readWanted().city), moneySteps: actor.system.money?.steps ?? 0, rules: houseRules()
  });
  let assets = { lost: [], kept: false };
  if (isCrew) {
    await actor.update({ "system.life.value": plan.restoreLife });
    await actor.addPlotPoints(plan.plotPoints);
    if (plan.paidSteps) await actor.money.pay(plan.paidSteps);
    if (plan.loseWeaponAssets) assets = await loseWeapons(actor, confirm);
  }
  await postDownCard({
    plan, name: actor.name, img: actor.img, isCrew, max: actor.system.life.max, price: dieText(plan.dueSteps),
    debt: dieText(plan.shortBy), lostAssets: assets.lost, assetsKept: assets.kept
  }, actor.uuid);
  return { kind: plan.kind, plan, lostAssets: assets.lost };
}

/** Cards whose "Rescued" click is being handled (a double click must not raise two stars). */
const rescuing = new Set();

/**
 * The Crew broke a Busted character out (docs/02: a jailbreak raises the stars by 1): raises the stars through the
 * one way they change (`raise`, with its chat line, only when the Stars rule is on) and marks the card. Fixer only.
 * @param {ChatMessage} message The BUSTED card.
 * @returns {Promise<boolean>} false when it was not a card waiting for a rescue
 */
export async function rescued(message) {
  const info = message?.getFlag(SYSTEM_ID, "down");
  if (!requireGM() || !info?.rescuable || info.rescued || rescuing.has(message.id)) return false;
  rescuing.add(message.id);
  try {
    if (houseRules().stars) await raise(1, t("LEVERAGE.Damage.Down.rescueReason", { name: info.name }));
    await message.setFlag(SYSTEM_ID, "down", { ...info, rescued: true });
  } finally {
    rescuing.delete(message.id);
  }
  return true;
}

/** The actions box of a down card: the button for the Fixer while the rescue is pending, a note once done. */
function wireDownCard(message, html) {
  const info = message.getFlag(SYSTEM_ID, "down");
  const box = html.querySelector(".lv-down-actions");
  if (!box) return;
  if (info.rescued) {
    const note = document.createElement("p");
    note.className = "lv-down-status";
    note.textContent = t("LEVERAGE.Damage.Down.rescuedDone");
    box.replaceChildren(note);
  } else if (!game.user.isGM || !info.rescuable) {
    box.remove();
  } else {
    box.querySelector('[data-action="rescued"]')?.addEventListener("click", () => rescued(message));
  }
}

/** Adds the card class to the damage and down messages (they draw their own header). Call once. */
export function registerDamageMessages() {
  Hooks.on("renderChatMessageHTML", (message, html) => {
    if (message.getFlag(SYSTEM_ID, "down") || message.getFlag(SYSTEM_ID, "damage")) html.classList.add("lv-roll-message");
    if (message.getFlag(SYSTEM_ID, "down")) wireDownCard(message, html);
  });
}
