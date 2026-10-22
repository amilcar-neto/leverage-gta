/**
 * The only place that knows where the Jobs live (docs/05, docs/09). A Job is an Item of type `job` that belongs to the
 * world (not embedded in an Actor: that one is a Record, a copy given to each Crew sheet when the Job ends). Its
 * `system.status` says which one is active (at most one) and which are planned or done.
 *
 * Players read the Job through the Items collection, which only sends them documents they can see. A `planned` Job is
 * the Fixer's secret (`ownership.default = NONE`); starting it raises it to OBSERVER, ending it keeps OBSERVER and
 * putting it back to `planned` hides it again (`jobVisibility`). A visible Job carries no secrets: name, goal, notes
 * and payout are read by every player.
 *
 * `readJob()` keeps the `{name, goal}` shape the macros and screens already used. Screens refresh on the hook
 * `leverage.activeJobChanged`, which is fired when a world Job is created, changed or deleted.
 */
import { LEVERAGE, SYSTEM_ID } from "./config.mjs";
import { logger } from "./logger.mjs";
import { cleanWorldJobFields, isWorldJob, jobVisibility, normalizeJob, pickActiveJob, plannedJobsOf, worldJobsOf } from "./rules/jobs.mjs";

const allItems = () => game.items?.contents ?? [];

/** Ids of the extra active Jobs already reported, so the console warning is not repeated on every read. */
let reported = "";

/** @returns {Item[]} Every world Job, in directory order. */
export const worldJobs = () => worldJobsOf(allItems());

/** @returns {Item[]} The world Jobs that are still planned. */
export const plannedJobs = () => plannedJobsOf(allItems());

/**
 * The active Job. When more than one is active (edited by hand) the first by `sort` wins and the console says so.
 * @returns {?Item}
 */
export function activeJobItem() {
  const { active, extra } = pickActiveJob(allItems());
  const key = extra.map((j) => j.id).join(",");
  if (key !== reported) {
    reported = key;
    if (extra.length) logger.warn(`More than one active Job; using "${active.name}". Also active: ${extra.map((j) => j.name).join(", ")}.`);
  }
  return active;
}

/**
 * Reads the active Job (a normalised copy: name and goal; empty when none is active).
 * @returns {{name: string, goal: string}}
 */
export function readJob() {
  const item = activeJobItem();
  return normalizeJob(item && { name: item.name, goal: item.system.goal });
}

/**
 * Saves the name and/or the goal of the active Job. GM only; does nothing when no Job is active. An empty name is ignored.
 * @param {{name?: string, goal?: string}} job
 * @returns {Promise<boolean>} whether a Job was updated
 */
export async function saveJob(job) {
  const item = activeJobItem();
  if (!item || !game.user.isGM) return false;
  const next = normalizeJob({ name: item.name, goal: item.system.goal, ...job });
  await item.update({ name: next.name.trim() || item.name, "system.goal": next.goal });
  return true;
}

/** Default ownership level of a world Job in the given status. */
const visibilityLevel = (status) => CONST.DOCUMENT_OWNERSHIP_LEVELS[jobVisibility(status)];

/**
 * Creates a world Job. A planned Job is hidden from the players; an active or done one is visible to them.
 * @param {{name: string, goal?: string, status?: "planned"|"active"|"done"}} data
 * @returns {Promise<Item>}
 */
export function createJob({ name, goal = "", status = "planned" }) {
  return Item.create({ name, type: "job", system: { status, goal }, ownership: { default: visibilityLevel(status) } }, { lvWorldJob: true });
}

/** Puts every other active world Job back to `planned` (and hides it again). GM only. */
async function demoteOthers(keep) {
  const others = worldJobs().filter((j) => j.id !== keep.id && j.system.status === "active");
  if (!others.length) return;
  await Item.updateDocuments(others.map((j) => ({ _id: j.id, "system.status": "planned", "ownership.default": visibilityLevel("planned") })));
}

/**
 * Makes a world Job the active one (visible to the players): the others go back to `planned`. GM only.
 * @param {Item} item
 * @returns {Promise<Item>}
 */
export async function startJob(item) {
  await demoteOthers(item);
  await item.update({ "system.status": "active", "ownership.default": visibilityLevel("active") });
  return item;
}

/** Whether this client made the change and is the GM (only that client fixes ownership and demotes). */
const isMyGmChange = (userId) => userId === game.user.id && game.user.isGM;

/** Keeps `ownership.default` in step with the status after an edit (the Item sheet's status select). */
async function syncVisibility(item) {
  const level = visibilityLevel(item.system.status);
  if (item.ownership?.default !== level) await item.update({ "ownership.default": level });
}

/**
 * A Record (or any Job) that lands in the Items directory becomes a clean planned Job: no payout, no Callback or spent
 * mark, no link to another Job, hidden from the players. Jobs made by `createJob` are left as they are.
 */
function normalizeNewJob(item, options) {
  if (!isWorldJob(item) || options?.lvWorldJob) return;
  item.updateSource({ ...cleanWorldJobFields(), "ownership.default": visibilityLevel("planned"), [`flags.${SYSTEM_ID}.${LEVERAGE.jobUuidFlag}`]: new foundry.data.operators.ForcedDeletion() });
}

/** Registers the Item hooks of the Jobs. Call once in `init`. */
export function registerJobHooks() {
  const changed = (item) => isWorldJob(item) && Hooks.callAll(LEVERAGE.hooks.activeJobChanged);
  const fail = (err) => logger.error("Job hook failed", err);
  Hooks.on("preCreateItem", (item, _data, options) => normalizeNewJob(item, options));
  Hooks.on("createItem", (item, _options, userId) => {
    changed(item);
    if (isWorldJob(item) && isMyGmChange(userId) && item.system.status === "active") demoteOthers(item).catch(fail);
  });
  Hooks.on("updateItem", (item, change, _options, userId) => {
    changed(item);
    if (!isWorldJob(item) || !isMyGmChange(userId)) return;
    if (change.system?.status === "active") demoteOthers(item).catch(fail);
    if (change.system?.status !== undefined) syncVisibility(item).catch(fail);
  });
  Hooks.on("deleteItem", changed);
}
