/**
 * Fixer actions on the Crew and the Job (docs/09 "Controles do mestre"): give Plot Points, new session, end scene,
 * new Job, end Job. Pure helpers come first (unit tested); the Foundry parts follow. Every action checks that the
 * user is the GM, and everything here is also exported for the API (`game.leverage.*`, T-505).
 */
import { LEVERAGE, SYSTEM_ID } from "../../config.mjs";
import { readSetting } from "../../data/fields.mjs";
import { escapeHtml, requireGM, resolveActor } from "../components/common.mjs";
import { t, tn } from "../components/i18n.mjs";
import { normalizeJob } from "./job-tracker-logic.mjs";

/* -------------------------------------------- */
/*  Pure helpers                                */
/* -------------------------------------------- */

/** An empty active Job (no name, no Complications, no scene Traits). */
export const emptyJob = () => ({ name: "", complications: [], sceneTraits: [] });

/**
 * State of a freshly started Job: the old Complications and scene Traits are gone.
 * @param {string} name
 * @returns {{name: string, complications: [], sceneTraits: []}}
 */
export function freshJob(name) {
  return { ...emptyJob(), name: String(name ?? "").trim() };
}

/**
 * Active Job after a scene ends: scene Traits are cleared when the field exists; the rest is kept.
 * @param {object} job `activeJob` setting value
 * @returns {object}
 */
export function jobAfterScene(job) {
  const next = { ...(job ?? emptyJob()) };
  if (Array.isArray(next.sceneTraits)) next.sceneTraits = [];
  return next;
}

/**
 * Splits `total` steps among `count` characters as evenly as possible (the remainder goes to the first ones).
 * @param {number} total
 * @param {number} count
 * @returns {number[]}
 */
export function evenSplit(total, count) {
  const n = Math.max(0, Math.trunc(count));
  const sum = Math.max(0, Math.trunc(Number(total) || 0));
  if (!n) return [];
  const base = Math.floor(sum / n);
  const extra = sum - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

/**
 * Normalises a share to a non-negative integer.
 * @param {*} value
 * @returns {number}
 */
export const toSteps = (value) => Math.max(0, Math.trunc(Number(value) || 0));

/**
 * Item data of the `job` Item created on a sheet when the Job ends.
 * @param {string} name
 * @param {number} total Steps the whole Crew was paid.
 * @param {number} share Steps for this character.
 * @returns {{name: string, type: "job", system: {payout: {total: number, share: number}}}}
 */
export function jobItemData(name, total, share) {
  return { name, type: "job", system: { payout: { total: toSteps(total), share: toSteps(share) } } };
}

/**
 * Ids of the embedded Items of a given kind, e.g. Assets of one duration.
 * @param {{id: string, type: string, system?: {duration?: string}}[]} items
 * @param {string} duration `scene` or `job`
 * @returns {string[]}
 */
export function assetIdsOf(items, duration) {
  return [...items].filter((i) => i.type === "asset" && i.system?.duration === duration).map((i) => i.id);
}

/**
 * Ids of Job Items that have `callbackUsed` set.
 * @param {{id: string, type: string, system?: {callbackUsed?: boolean}}[]} items
 * @returns {string[]}
 */
export function usedCallbackIds(items) {
  return [...items].filter((i) => i.type === "job" && i.system?.callbackUsed).map((i) => i.id);
}

/**
 * Whether a Crew character is played: some player (not the Fixer) owns it or has it as his character. Pre-made
 * characters nobody plays are left out of the bulk Fixer actions (Plot Points, new session, end of scene, Jobs).
 * @param {{id: string, testUserPermission?: Function}} actor
 * @param {{isGM: boolean, character?: ?{id: string}}[]} users
 * @returns {boolean}
 */
export function isPlayedCrew(actor, users) {
  return [...users].some((u) => !u.isGM && (u.character?.id === actor.id || Boolean(actor.testUserPermission?.(u, "OWNER"))));
}

/* -------------------------------------------- */
/*  Foundry helpers                             */
/* -------------------------------------------- */

/** The Crew characters that bulk Fixer actions reach: those a player owns or plays (see `isPlayedCrew`). */
export const crewActors = () => game.actors.filter((a) => a.type === "crew" && isPlayedCrew(a, game.users.contents));

export { requireGM };

/** Posts a plain public chat line. */
function say(html) {
  return ChatMessage.create({ content: `<p class="lv-gm-note">${html}</p>`, speaker: { alias: t("LEVERAGE.GM.Chat.speaker") } });
}

/** Reads the active Job (a normalised copy: every list exists, every entry is valid). */
export const readJob = () => normalizeJob(foundry.utils.deepClone(readSetting("activeJob", emptyJob())));

/** Whether the Money house rule is on. */
const moneyRuleOn = () => Boolean(readSetting("houseRules.money", true));

/** Resolves actor ids / documents to Crew documents. */
function resolveCrew(actors) {
  return [...actors].map(resolveActor).filter((a) => a?.type === "crew");
}

/* -------------------------------------------- */
/*  Actions                                     */
/* -------------------------------------------- */

/**
 * Gives Plot Points to the given characters.
 * @param {(Actor|string)[]} actors Crew documents or ids.
 * @param {number} [n=1]
 * @returns {Promise<Actor[]>} the characters that received them
 */
export async function givePlotPoint(actors, n = 1) {
  if (!requireGM()) return [];
  const crew = resolveCrew(actors);
  if (!crew.length) return [];
  await Promise.all(crew.map((a) => a.addPlotPoints(n)));
  await say(tn("LEVERAGE.GM.Chat.plotPoints", crew.length, { names: crew.map((a) => escapeHtml(a.name)).join(", "), count: n }));
  return crew;
}

/**
 * Gives Plot Points to every Crew character.
 * @param {number} [n=1]
 * @returns {Promise<Actor[]>}
 */
export const giveAllPlotPoints = (n = 1) => givePlotPoint(crewActors(), n);

/**
 * Dialog that picks the characters who get 1 Plot Point, then gives it.
 * @returns {Promise<Actor[]>}
 */
export async function giveEachPlotPointDialog() {
  if (!requireGM()) return [];
  const crew = crewActors();
  if (!crew.length) return ui.notifications.info(t("LEVERAGE.GM.Warn.noCrew")) ?? [];
  const rows = crew.map((a) => `<label class="lv-dlg-option"><input type="checkbox" name="actor" value="${a.id}" checked>
    <span class="lv-dlg-option-name" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</span>
    <span class="lv-dlg-option-cost">${a.system.plotPoints.value} PP</span></label>`).join("");
  const ids = await foundry.applications.api.DialogV2.prompt({
    classes: ["leverage-gta", "lv-dialog"],
    window: { title: t("LEVERAGE.GM.Dialog.PlotPoint.title") },
    position: { width: 360 },
    rejectClose: false,
    content: `<div class="lv-dlg"><p class="lv-dlg-hint">${t("LEVERAGE.GM.Dialog.PlotPoint.hint")}</p>${rows}</div>`,
    ok: {
      label: t("LEVERAGE.GM.Dialog.PlotPoint.confirm"),
      callback: (_event, button) => [...button.form.querySelectorAll('input[name="actor"]:checked')].map((i) => i.value)
    }
  });
  return ids?.length ? givePlotPoint(ids, 1) : [];
}

/**
 * New session: clears `callbackUsed` on every Job Item of every Crew character.
 * @returns {Promise<number>} how many Jobs were reset
 */
export async function newSession() {
  if (!requireGM()) return 0;
  let count = 0;
  for (const actor of crewActors()) {
    const ids = usedCallbackIds(actor.items);
    if (!ids.length) continue;
    await actor.updateEmbeddedDocuments("Item", ids.map((_id) => ({ _id, "system.callbackUsed": false })));
    count += ids.length;
  }
  await say(t("LEVERAGE.GM.Chat.newSession", { count }));
  return count;
}

/**
 * End of scene: deletes every `scene` Asset of the Crew (after a confirmation) and clears the scene Traits of the
 * active Job when that field exists.
 * @param {{confirm?: boolean}} [options] `confirm: false` skips the dialog (macros).
 * @returns {Promise<number|null>} Assets removed, or null when cancelled
 */
export async function endScene({ confirm = true } = {}) {
  if (!requireGM()) return null;
  const targets = crewActors().map((actor) => ({ actor, ids: assetIdsOf(actor.items, "scene") }));
  const total = targets.reduce((sum, x) => sum + x.ids.length, 0);
  if (confirm) {
    const yes = await foundry.applications.api.DialogV2.confirm({
      classes: ["leverage-gta", "lv-dialog"],
      window: { title: t("LEVERAGE.GM.Dialog.EndScene.title") },
      content: `<p>${t("LEVERAGE.GM.Dialog.EndScene.body", { count: total })}</p>`,
      rejectClose: false
    });
    if (!yes) return null;
  }
  for (const { actor, ids } of targets) if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
  const job = readJob();
  if (job.sceneTraits.length) {
    await game.settings.set(SYSTEM_ID, "activeJob", jobAfterScene(job));
  }
  const detail = targets.filter((x) => x.ids.length).map((x) => `${escapeHtml(x.actor.name)} (${x.ids.length})`).join(", ");
  await say(t("LEVERAGE.GM.Chat.endScene", { count: total }) + (detail ? ` ${detail}` : ""));
  return total;
}

/**
 * Starts a Job: sets the active Job (no old Complications) and raises each character to at least `jobStartPlotPoints`
 * Plot Points (the book: everybody has 1 to start the Job; Plot Points left over are kept, never added on top).
 * @param {string} name
 * @returns {Promise<boolean>} false when the name is empty or the user is not the GM
 */
export async function newJob(name) {
  if (!requireGM()) return false;
  const job = freshJob(name);
  if (!job.name) return false;
  await game.settings.set(SYSTEM_ID, "activeJob", job);
  const each = toSteps(readSetting("jobStartPlotPoints", LEVERAGE.jobStartPlotPoints));
  if (each) await Promise.all(crewActors().map((a) => a.addPlotPoints(Math.max(0, each - (a.system.plotPoints?.value ?? 0)))));
  await say(t("LEVERAGE.GM.Chat.newJob", { name: escapeHtml(job.name), count: each }));
  return true;
}

/** Dialog asking the name of a new Job, then starts it. */
export async function newJobDialog() {
  if (!requireGM()) return false;
  const current = readJob().name;
  const crew = crewActors();
  const who = crew.map((a) => a.name).join(", ") || t("LEVERAGE.GM.Dialog.NewJob.nobody");
  const name = await foundry.applications.api.DialogV2.prompt({
    classes: ["leverage-gta", "lv-dialog"],
    window: { title: t("LEVERAGE.GM.Dialog.NewJob.title") },
    position: { width: 380 },
    rejectClose: false,
    content: `<div class="lv-dlg"><label class="lv-dlg-field"><span>${t("LEVERAGE.GM.Dialog.NewJob.name")}</span>
      <input type="text" name="name" autofocus maxlength="80" value="${escapeHtml(current)}"></label>
      <p class="lv-dlg-hint">${t("LEVERAGE.GM.Dialog.NewJob.hint")}</p>
      <p class="lv-dlg-hint" title="${escapeHtml(who)}">${escapeHtml(t("LEVERAGE.GM.Dialog.NewJob.who", { count: crew.length, names: who }))}</p></div>`,
    ok: {
      label: t("LEVERAGE.GM.Dialog.NewJob.confirm"),
      callback: (_event, button) => {
        const value = button.form.elements.name.value.trim();
        if (!value) ui.notifications.warn(t("LEVERAGE.GM.Warn.jobNameRequired"));
        return value;
      }
    }
  });
  return name ? newJob(name) : false;
}

/**
 * Checks the result of a Job before anything is changed: a name, and shares that do not add up to more than the total.
 * @param {{name: string, total: number, shares: Record<string, number>}} result
 * @param {string[]} ids Crew actor ids that get a share.
 * @returns {{ok: boolean, error?: "jobNameRequired"|"sharesExceedTotal", data?: object}} `error` is a key under `LEVERAGE.GM.Warn`.
 */
export function checkJobResult({ name, total, shares }, ids) {
  if (!String(name ?? "").trim()) return { ok: false, error: "jobNameRequired" };
  const sum = ids.reduce((s, id) => s + toSteps(shares?.[id]), 0);
  return sum > toSteps(total) ? { ok: false, error: "sharesExceedTotal", data: { sum, total: toSteps(total) } } : { ok: true };
}

/**
 * Ends the Job: creates a `job` Item with the payout on each character, adds the share to their Money, deletes
 * their `job` Assets and clears the active Job. Nothing changes when the name is empty or the shares add up to more
 * than the total. A share that does not fit in a character's Money ladder is reported in a warning.
 * @param {{name: string, total: number, shares: Record<string, number>}} result `shares` by Crew actor id.
 * @returns {Promise<number>} characters paid (0 when refused)
 */
export async function endJob({ name, total, shares }) {
  if (!requireGM()) return 0;
  const crew = crewActors();
  const check = checkJobResult({ name, total, shares }, crew.map((a) => a.id));
  if (!check.ok) {
    ui.notifications.warn(t(`LEVERAGE.GM.Warn.${check.error}`, check.data));
    return 0;
  }
  name = name.trim();
  let paid = 0;
  for (const actor of crew) {
    const share = toSteps(shares?.[actor.id]);
    await actor.createEmbeddedDocuments("Item", [jobItemData(name, total, share)]);
    if (share && moneyRuleOn()) {
      const added = await actor.money.add(share);
      if (added < share) ui.notifications.warn(t("LEVERAGE.GM.Warn.shareDidNotFit", { name: actor.name, lost: share - added }));
    }
    const ids = assetIdsOf(actor.items, "job");
    if (ids.length) await actor.deleteEmbeddedDocuments("Item", ids);
    paid += 1;
  }
  await game.settings.set(SYSTEM_ID, "activeJob", emptyJob());
  await say(t("LEVERAGE.GM.Chat.endJob", { name: escapeHtml(name), total: toSteps(total) }));
  return paid;
}

/** One share row of the End Job dialog. */
function shareRow(actor, share) {
  return `<label class="lv-dlg-option"><span class="lv-dlg-option-name" title="${escapeHtml(actor.name)}">${escapeHtml(actor.name)}</span>
    <input type="number" class="lv-dlg-share" name="share-${actor.id}" min="0" step="1" value="${share}"></label>`;
}

/** Keeps the share inputs in step with the total until the Fixer edits a share by hand. */
function wireShares(dialog, crew) {
  const form = dialog.element.querySelector("form");
  let manual = false;
  const sync = () => {
    const sum = crew.reduce((s, a) => s + toSteps(form.elements[`share-${a.id}`].value), 0);
    form.querySelector("[data-sum]").textContent = t("LEVERAGE.GM.Dialog.EndJob.divided", { sum, total: toSteps(form.elements.total.value) });
  };
  form.elements.total.addEventListener("input", () => {
    if (!manual) evenSplit(form.elements.total.value, crew.length).forEach((v, i) => { form.elements[`share-${crew[i].id}`].value = v; });
    sync();
  });
  for (const a of crew) form.elements[`share-${a.id}`].addEventListener("input", () => { manual = true; sync(); });
  sync();
}

/** Dialog for ending the Job (name, total payout, share per character), then applies it. */
export async function endJobDialog() {
  if (!requireGM()) return 0;
  const crew = crewActors();
  if (!crew.length) return ui.notifications.info(t("LEVERAGE.GM.Warn.noCrew")) ?? 0;
  const split = evenSplit(0, crew.length);
  const result = await foundry.applications.api.DialogV2.prompt({
    classes: ["leverage-gta", "lv-dialog"],
    window: { title: t("LEVERAGE.GM.Dialog.EndJob.title") },
    position: { width: 420 },
    rejectClose: false,
    content: `<div class="lv-dlg">
      <label class="lv-dlg-field"><span>${t("LEVERAGE.GM.Dialog.EndJob.name")}</span>
        <input type="text" name="name" maxlength="80" value="${escapeHtml(readJob().name)}"></label>
      <label class="lv-dlg-field"><span>${t("LEVERAGE.GM.Dialog.EndJob.total")}</span>
        <input type="number" name="total" min="0" step="1" value="0"></label>
      <p class="lv-dlg-hint">${t("LEVERAGE.GM.Dialog.EndJob.hint")}</p>
      ${crew.map((a, i) => shareRow(a, split[i])).join("")}
      <p class="lv-dlg-hint" data-sum></p></div>`,
    render: (_event, dialog) => wireShares(dialog, crew),
    ok: {
      label: t("LEVERAGE.GM.Dialog.EndJob.confirm"),
      callback: (_event, button) => {
        const f = button.form.elements;
        const name = f.name.value.trim();
        if (!name) {
          ui.notifications.warn(t("LEVERAGE.GM.Warn.jobNameRequired"));
          return null;
        }
        return { name, total: toSteps(f.total.value), shares: Object.fromEntries(crew.map((a) => [a.id, toSteps(f[`share-${a.id}`].value)])) };
      }
    }
  });
  return result ? endJob(result) : 0;
}
