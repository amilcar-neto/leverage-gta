/**
 * Crew sheet — assets and folder parts (docs/06): the Assets list, and the BACKGROUND / JOBS case folder.
 * Pure helpers (costs, die suggestion, which Jobs to spend) are exported for unit tests; the rest is sheet glue.
 */
import { LEVERAGE } from "../../../config.mjs";
import { getTrainingCosts } from "../../../world-state.mjs";
import { deleteWithConfirm } from "../../components/confirm-delete.mjs";
import { escapeHtml } from "../../components/die.mjs";
import { t } from "../../components/i18n.mjs";
import { assetCostOf, promptCreateAsset } from "../../dialogs/create-asset-dialog.mjs";
import { promptTrainUp } from "../../dialogs/train-up-dialog.mjs";
import { itemOf, openItem } from "./shared.mjs";

export { assetCostOf };

const TABS = ["background", "jobs"];
const DEFAULT_TAB = "background";

/* ---------------------------------------------------------------- pure helpers */

/**
 * Die suggested for a new Asset: the first Signature is d8, later Signatures and Job/Scene Assets are d6.
 * @param {string} duration `signature`, `job` or `scene`.
 * @param {{system: {duration: string}}[]} assets Assets the actor already owns.
 * @returns {number}
 */
export function suggestAssetDie(duration, assets) {
  const { first, next } = LEVERAGE.signatureAssetDice;
  if (duration !== "signature") return LEVERAGE.defaultDie;
  return assets.some((a) => a.system.duration === "signature") ? next : first;
}

/**
 * Ids of the Jobs to mark as spent: the first `count` unspent ones in sheet order.
 * @param {{id: string, sort: number, system: {spent: boolean}}[]} jobs
 * @param {number} count
 * @returns {string[]} empty when there are not enough unspent Jobs
 */
export function pickJobsToSpend(jobs, count) {
  const open = jobs.filter((j) => !j.system.spent).sort((a, b) => a.sort - b.sort);
  return open.length >= count ? open.slice(0, count).map((j) => j.id) : [];
}

/* ---------------------------------------------------------------- folder state */

/**
 * BACKGROUND editing per sheet: present while the editor is on, holding the text typed so far. The text is
 * copied from the live editor before every render (see `captureDraft`), so a re-render of any part (an update
 * from another window, the lock changing, a tab switch) never throws away what was typed. Not persisted.
 */
const drafts = new WeakMap();

const EDITOR = "prose-mirror.lv-bg-editor";

/** Copies the text of the live editor (if it is on screen) into the draft. */
function captureDraft(sheet) {
  if (!drafts.has(sheet)) return;
  const field = sheet.element?.querySelector(EDITOR);
  if (field) drafts.set(sheet, field.value);
}

/** Starts editing the BACKGROUND in place (the editor takes the focus after the render). */
async function startBackgroundEdit(sheet) {
  if (!sheet.isEditable || drafts.has(sheet)) return;
  drafts.set(sheet, sheet.actor.system.background);
  await sheet.render({ parts: ["folder"] });
}

/** Saves the typed BACKGROUND text (once, even when blur and a click both ask) and shows it again. */
async function saveBackground(sheet) {
  if (!drafts.has(sheet) || saving.has(sheet)) return;
  saving.add(sheet);
  try {
    captureDraft(sheet);
    const text = drafts.get(sheet);
    drafts.delete(sheet);
    if (text !== sheet.actor.system.background) await sheet.actor.update({ "system.background": text });
    await sheet.render({ parts: ["folder"] });
  } finally {
    saving.delete(sheet);
  }
}

/** Forgets the typed text and shows the saved one. */
function cancelBackground(sheet) {
  if (!drafts.delete(sheet)) return;
  return sheet.render({ parts: ["folder"] });
}

const saving = new WeakSet();

const tabKey = (sheet) => `${LEVERAGE.systemId}.folderTab.${game.user.id}.${sheet.actor.id}`;

/** Remembered folder tab of this actor and user; localStorage may be unavailable. */
function readTab(sheet) {
  try {
    const tab = localStorage.getItem(tabKey(sheet));
    return TABS.includes(tab) ? tab : DEFAULT_TAB;
  } catch {
    return DEFAULT_TAB;
  }
}

function writeTab(sheet, tab) {
  try {
    localStorage.setItem(tabKey(sheet), tab);
  } catch {
    // storage blocked: the tab is just not remembered
  }
}

/* ---------------------------------------------------------------- helpers with Foundry */

/** Posts a short line in the chat as the actor (`data` values must already be escaped). */
function say(sheet, key, data) {
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: sheet.actor }),
    content: `<p>${t(key, data)}</p>`
  });
}

/**
 * Creates an Asset after taking its Plot Point cost; the cost goes back if the Asset could not be created.
 * @param {Actor} actor
 * @param {object} data Item creation data (`type: "asset"`).
 * @param {number} cost Plot Points to pay (0 for a Signature Asset).
 */
async function createAssetPaying(actor, data, cost) {
  if (cost) await actor.addPlotPoints(-cost);
  let created = [];
  try {
    created = await actor.createEmbeddedDocuments("Item", [data]);
  } finally {
    if (cost && !created.length) await actor.addPlotPoints(cost);
  }
}

/**
 * The one way a sheet adds an Asset ("+ ADD" and drops alike): the Plot Point cost is checked and paid, and a
 * player never picks the die (the suggested one is always used; only the Fixer may set another).
 * @param {Actor} actor
 * @param {object} data Item creation data (`type: "asset"`, `system.duration`; `system.die` honoured for the Fixer only).
 * @returns {Promise<boolean>} true when the Asset was created
 */
export async function buyAsset(actor, data) {
  const duration = data.system?.duration;
  const die = game.user.isGM && data.system?.die ? data.system.die : suggestAssetDie(duration, actor.itemTypes.asset);
  const cost = assetCostOf(duration);
  const have = actor.system.plotPoints?.value ?? 0;
  if (cost > have) {
    ui.notifications.warn(t("LEVERAGE.Warn.notEnoughPlotPoints", { cost, have }));
    return false;
  }
  await createAssetPaying(actor, { ...data, type: "asset", system: { ...data.system, die } }, cost);
  return true;
}

/* ---------------------------------------------------------------- actions */

/** @type {Record<string, Function>} ApplicationV2 `data-action` handlers (called with `this` = the sheet). */
export const actions = {
  /** Opens the New Asset dialog, then pays the Plot Points and creates the Asset. */
  async addAsset() {
    if (!this.isEditable) return;
    const actor = this.actor;
    const assets = actor.itemTypes.asset;
    const choice = await promptCreateAsset({
      plotPoints: actor.system.plotPoints?.value ?? 0,
      suggestDie: (duration) => suggestAssetDie(duration, assets),
      chooseDie: game.user.isGM
    });
    if (!choice) return;
    await buyAsset(actor, {
      name: choice.name, type: "asset", system: { duration: choice.duration, die: choice.die }
    });
  },

  /** Opens an Asset (the button; a double click on the row does the same). */
  openAsset(_event, target) {
    openItem(itemOf(this, target));
  },

  /** Deletes an Asset (asks first only for a Signature Asset). */
  async deleteAsset(_event, target) {
    if (!this.isEditable) return;
    const item = itemOf(this, target);
    if (item) await deleteWithConfirm(item);
  },

  /** Switches the folder tab and remembers it. */
  folderTab(_event, target) {
    const tab = target.dataset.tab;
    if (!TABS.includes(tab)) return;
    writeTab(this, tab);
    return this.render({ parts: ["folder"] });
  },

  /** Pencil: edits the BACKGROUND text in place. */
  editBackground() {
    return startBackgroundEdit(this);
  },

  /** Check icon: saves the BACKGROUND text. */
  saveBackground() {
    return saveBackground(this);
  },

  /** X icon: drops what was typed. */
  cancelBackground() {
    return cancelBackground(this);
  },

  /** Opens Train Up and marks the Jobs it costs as spent. */
  async trainUp() {
    if (!this.isEditable) return;
    const jobs = this.actor.itemTypes.job;
    const unspent = jobs.filter((j) => !j.system.spent).length;
    if (!unspent) {
      ui.notifications.warn(t("LEVERAGE.Warn.noUnspentJobs"));
      return;
    }
    const costs = getTrainingCosts();
    const pick = await promptTrainUp({ unspent, costs });
    if (!pick) return;
    const ids = pickJobsToSpend(jobs, pick.cost);
    if (!ids.length && pick.cost > 0) {
      ui.notifications.warn(t("LEVERAGE.Warn.noUnspentJobs"));
      return;
    }
    await this.actor.updateEmbeddedDocuments("Item", ids.map((_id) => ({ _id, "system.spent": true })));
    await say(this, "LEVERAGE.Chat.trainedUp", {
      name: escapeHtml(this.actor.name),
      option: t(`LEVERAGE.Dialog.TrainUp.Option.${pick.option}`),
      cost: pick.cost
    });
  },

  /** Creates a Job item and opens it. */
  async logJob() {
    if (!this.isEditable) return;
    const [job] = await this.actor.createEmbeddedDocuments("Item", [{ name: t("LEVERAGE.Sheet.Jobs.newJob"), type: "job" }]);
    openItem(job);
  },

  /** Opens a Job item. */
  openJob(_event, target) {
    openItem(itemOf(this, target));
  },

  /** Marks / unmarks the callback of a Job; marking announces it in the chat. */
  async toggleCallback(_event, target) {
    if (!this.isEditable) return;
    const job = itemOf(this, target);
    if (!job || job.system.spent) return;
    const used = !job.system.callbackUsed;
    await job.update({ "system.callbackUsed": used });
    if (used) await say(this, "LEVERAGE.Chat.callbackUsed", { name: escapeHtml(this.actor.name), job: escapeHtml(job.name) });
  },

  /** Deletes a Job after confirming. */
  async deleteJob(_event, target) {
    if (!this.isEditable) return;
    const item = itemOf(this, target);
    if (item) await deleteWithConfirm(item);
  }
};

/* ---------------------------------------------------------------- context */

const assetRow = (item) => ({
  id: item.id,
  name: item.name,
  note: item.system.note,
  die: item.system.effectiveDie,
  duration: item.system.duration,
  // A raised Asset (Opportunity, until the end of the scene) shows how many steps it went up, on the tag and on the die.
  boosted: item.system.boost > 0,
  boostTip: item.system.boost ? t("LEVERAGE.Sheet.Assets.boostTip", { boost: item.system.boost }) : "",
  durationLabel: t(LEVERAGE.assetDurations[item.system.duration]?.label ?? "")
    + (item.system.boost ? ` ${t("LEVERAGE.Sheet.Assets.boostTag", { boost: item.system.boost })}` : "")
});

const jobRow = (item) => ({
  id: item.id,
  name: item.name,
  spent: item.system.spent,
  share: item.system.payout.share,
  callbackUsed: item.system.callbackUsed
});

/**
 * Adds data this part's templates need to the sheet context.
 * @param {object} context the context being built
 * @param {object} sheet the CrewSheet
 */
export async function prepare(context, sheet) {
  const jobs = context.jobs.map(jobRow);
  const tab = readTab(sheet);
  captureDraft(sheet);
  const bgEditing = drafts.has(sheet) && sheet.isEditable;
  Object.assign(context, {
    assetRows: context.assets.map(assetRow),
    tabBackground: tab === "background",
    tabJobs: tab === "jobs",
    bgEditing,
    bgRaw: bgEditing ? drafts.get(sheet) : context.system.background,
    jobRows: jobs,
    jobsSummary: t("LEVERAGE.Sheet.Jobs.summary", { jobs: jobs.length, unspent: context.jobsUnspent })
  });
}

/* ---------------------------------------------------------------- listeners */

/** Editing in place: leaving the editor or Ctrl+Enter saves, Escape cancels, a double click on the text starts. */
function attachBackgroundEditor(sheet, signal) {
  const el = sheet.element;
  el.addEventListener("focusout", (event) => {
    const field = event.target.closest?.(EDITOR);
    if (!field || field.contains(event.relatedTarget)) return;
    // A field removed by a re-render also loses focus: that is not the player leaving it, so keep the draft.
    setTimeout(() => { if (field.isConnected && !field.contains(document.activeElement)) saveBackground(sheet); }, 0);
  }, { signal });
  el.addEventListener("keydown", (event) => {
    if (!event.target.closest?.(EDITOR)) return;
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) saveBackground(sheet);
    else if (event.key === "Escape") cancelBackground(sheet);
    else return;
    event.preventDefault();
    event.stopPropagation();
  }, { signal });
  el.addEventListener("dblclick", (event) => {
    if (event.target.closest(".lv-bg-text")) startBackgroundEdit(sheet);
  }, { signal });
  // Icon buttons must not take the focus from the editor, or the blur would save before the click lands.
  el.addEventListener("mousedown", (event) => {
    if (event.target.closest(".lv-folder-tools .lv-icon-btn")) event.preventDefault();
  }, { signal });
}

/** After every render: puts the cursor in the BACKGROUND editor when it has just opened. */
export function afterRender(sheet) {
  if (!drafts.has(sheet)) return;
  const field = sheet.element.querySelector(EDITOR);
  if (!field || field.dataset.focused) return;
  field.dataset.focused = "1";
  requestAnimationFrame(() => (field.querySelector(".ProseMirror") ?? field).focus());
}

/**
 * Listeners of the part, registered once per sheet: a double click on an Asset row opens the Asset
 * (`data-action` only reacts to single clicks). The draft is forgotten when the sheet closes.
 * @param {ApplicationV2} sheet The crew sheet.
 * @param {AbortSignal} signal Aborted when the sheet closes.
 */
export function attach(sheet, signal) {
  sheet.element.addEventListener("dblclick", (event) => {
    const row = event.target.closest(".lv-asset[data-item-id]");
    if (row) openItem(sheet.actor.items.get(row.dataset.itemId));
  }, { signal });
  attachBackgroundEditor(sheet, signal);
  signal.addEventListener("abort", () => drafts.delete(sheet));
}
