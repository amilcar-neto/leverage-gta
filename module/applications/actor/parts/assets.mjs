/**
 * Crew sheet — assets and folder parts (docs/06): the Assets list, and the BACKGROUND / JOBS case folder.
 * Pure helpers (costs, die suggestion, which Jobs to spend) are exported for unit tests; the rest is sheet glue.
 */
import { LEVERAGE } from "../../../config.mjs";
import { escapeHtml } from "../../components/die.mjs";
import { assetCostOf, promptCreateAsset } from "../../dialogs/create-asset-dialog.mjs";
import { promptTrainUp } from "../../dialogs/train-up-dialog.mjs";

export { assetCostOf };

const TABS = ["background", "jobs"];
const DEFAULT_TAB = "background";

/** @param {string} key @param {object} [data] */
const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

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
 * Training Up costs: the `trainingCosts` setting over the defaults; bad values fall back to the default.
 * @param {object} [stored] Setting value.
 * @returns {Record<string, number>}
 */
export function resolveTrainingCosts(stored = {}) {
  const defaults = LEVERAGE.defaultTrainingCosts;
  return Object.fromEntries(Object.entries(defaults).map(([key, base]) => {
    const value = Number(stored?.[key]);
    return [key, Number.isInteger(value) && value >= 0 ? value : base];
  }));
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

/** Background edit mode per sheet (not persisted). */
const editing = new WeakMap();

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

/** Item of this actor under `target` (the element carrying `data-item-id`). */
const itemOf = (sheet, target) => sheet.actor.items.get(target.closest("[data-item-id]")?.dataset.itemId);

/** Asks to delete an Item, then deletes it. */
async function confirmDelete(item) {
  const yes = await foundry.applications.api.DialogV2.confirm({
    window: { title: t("LEVERAGE.Dialog.Delete.title") },
    content: `<p>${t("LEVERAGE.Dialog.Delete.body", { name: escapeHtml(item.name) })}</p>`,
    rejectClose: false
  });
  if (yes) await item.delete();
}

/** Posts a short line in the chat as the actor (`data` values must already be escaped). */
function say(sheet, key, data) {
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: sheet.actor }),
    content: `<p>${t(key, data)}</p>`
  });
}

/** Opens an Item sheet, if the item exists. */
const openItem = (item) => item?.sheet.render({ force: true });

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
      suggestDie: (duration) => suggestAssetDie(duration, assets)
    });
    if (!choice) return;
    const cost = assetCostOf(choice.duration);
    const have = actor.system.plotPoints?.value ?? 0;
    if (cost > have) {
      ui.notifications.warn(t("LEVERAGE.Warn.notEnoughPlotPoints", { cost, have }));
      return;
    }
    await actor.createEmbeddedDocuments("Item", [{
      name: choice.name, type: "asset", system: { duration: choice.duration, die: choice.die }
    }]);
    if (cost) await actor.addPlotPoints(-cost);
  },

  /** Deletes an Asset after confirming. */
  async deleteAsset(_event, target) {
    if (!this.isEditable) return;
    const item = itemOf(this, target);
    if (item) await confirmDelete(item);
  },

  /** Switches the folder tab and remembers it. */
  folderTab(_event, target) {
    const tab = target.dataset.tab;
    if (!TABS.includes(tab)) return;
    writeTab(this, tab);
    return this.render({ parts: ["folder"] });
  },

  /** EDIT / SAVE of the BACKGROUND text. */
  async editBackground() {
    if (!this.isEditable) return;
    if (editing.get(this)) {
      const field = this.element.querySelector("prose-mirror.lv-bg-editor");
      if (field) await this.actor.update({ "system.background": field.value });
      editing.delete(this);
    } else {
      editing.set(this, true);
    }
    return this.render({ parts: ["folder"] });
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
    const costs = resolveTrainingCosts(game.settings.get(LEVERAGE.systemId, "trainingCosts"));
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
    if (item) await confirmDelete(item);
  }
};

/* ---------------------------------------------------------------- context */

const assetRow = (item) => ({
  id: item.id,
  name: item.name,
  note: item.system.note,
  die: item.system.die,
  duration: item.system.duration,
  durationLabel: t(LEVERAGE.assetDurations[item.system.duration]?.label ?? ""),
  durationTip: t(`LEVERAGE.Sheet.Assets.tip.${item.system.duration}`)
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
  Object.assign(context, {
    assetRows: context.assets.map(assetRow),
    assetsEditable: sheet.isEditable,
    tabBackground: tab === "background",
    tabJobs: tab === "jobs",
    bgEditing: Boolean(editing.get(sheet)) && sheet.isEditable,
    bgRaw: context.system.background,
    jobRows: jobs,
    jobsSummary: t("LEVERAGE.Sheet.Jobs.summary", { jobs: jobs.length, unspent: context.jobsUnspent })
  });
}

/* ---------------------------------------------------------------- double click opens an Asset */

/** Delegated double click on an Asset row (ApplicationV2 `data-action` only reacts to single clicks). */
function onAssetDoubleClick(event) {
  const row = event.target.closest(".lv-asset[data-item-id]");
  if (!row) return;
  const sheet = foundry.applications.instances.get(row.closest(".application")?.id);
  openItem(sheet?.actor.items.get(row.dataset.itemId));
}

const wired = new WeakSet();
globalThis.Hooks?.on("renderCrewSheet", (_sheet, element) => {
  if (wired.has(element)) return;
  wired.add(element);
  element.addEventListener("dblclick", onAssetDoubleClick);
});
