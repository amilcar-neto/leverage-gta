/**
 * Pure rules of the Jobs (docs/05, docs/09): which Items are world Jobs, which one is active, who may see a Job, the
 * Crew payout list and the 0.1.2 migration data. Nothing here touches Foundry and nothing mutates its input.
 */

/**
 * Normalises a Job so its name and goal are strings. Other keys (old worlds kept lists here) are dropped.
 * @param {object} [job]
 * @returns {{name: string, goal: string}}
 */
export function normalizeJob(job) {
  return { name: String(job?.name ?? ""), goal: String(job?.goal ?? "") };
}

/**
 * Whether an Item is a world Job: type `job`, not embedded in an Actor (that one is a Record) and not in a compendium.
 * @param {{type?: string, parent?: ?object, pack?: ?string}} item
 * @returns {boolean}
 */
export const isWorldJob = (item) => item?.type === "job" && !item.parent && !item.pack;

/**
 * World Jobs in directory order (`sort`, then id).
 * @param {{type?: string, parent?: ?object, pack?: ?string, sort?: number, id?: string}[]} items
 * @returns {object[]}
 */
export function worldJobsOf(items) {
  return [...items].filter(isWorldJob).sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || String(a.id).localeCompare(String(b.id)));
}

/**
 * The active Job: the first world Job whose status is `active`. More than one is a manual edit; the rest are reported.
 * @param {object[]} items Any Items (non-Jobs are ignored).
 * @returns {{active: ?object, extra: object[]}}
 */
export function pickActiveJob(items) {
  const [active = null, ...extra] = worldJobsOf(items).filter((j) => j.system?.status === "active");
  return { active, extra };
}

/**
 * The Jobs that "Start" can pick: world Jobs still `planned`.
 * @param {object[]} items
 * @returns {object[]}
 */
export const plannedJobsOf = (items) => worldJobsOf(items).filter((j) => j.system?.status === "planned");

/**
 * Who sees a world Job by default: a `planned` Job is the Fixer's secret (NONE); once it is started (or done) the
 * players read it (OBSERVER). The key is a name of `CONST.DOCUMENT_OWNERSHIP_LEVELS`.
 * @param {string} status `planned`, `active` or `done`.
 * @returns {"NONE"|"OBSERVER"}
 */
export const jobVisibility = (status) => (status === "planned" ? "NONE" : "OBSERVER");

/**
 * The share of each Crew character, as stored on the world Job when it ends (`payout.crew`).
 * @param {{id: string, uuid: string, name: string}[]} crew
 * @param {Record<string, number>} shares Steps by actor id (missing or invalid counts as 0).
 * @returns {{actorUuid: string, name: string, share: number}[]}
 */
export const payoutCrew = (crew, shares) =>
  crew.map((a) => ({ actorUuid: a.uuid, name: a.name, share: Math.max(0, Math.trunc(Number(shares?.[a.id]) || 0)) }));

/**
 * Fields that turn a Record (or any Job copied into the Items directory) into a clean planned world Job: status
 * `planned`, no payout, no Callback or spent mark, and no link to another Job.
 * @returns {Record<string, *>} Update data (dotted keys).
 */
export const cleanWorldJobFields = () => ({
  "system.status": "planned", "system.payout.total": 0, "system.payout.share": 0, "system.payout.crew": [],
  "system.callbackUsed": false, "system.spent": false
});

/**
 * Item data of the world Job that replaces the old `activeJob` setting (migration 0.1.2).
 * @param {object} [legacy] Old setting value `{name, goal}`.
 * @param {string} unnamed Name used when only a goal was saved.
 * @returns {?{name: string, goal: string}} null when the setting holds nothing
 */
export function legacyJobData(legacy, unnamed) {
  const { name, goal } = normalizeJob(legacy);
  if (!name.trim() && !goal.trim()) return null;
  return { name: name.trim() || unnamed, goal: goal.trim() };
}

/**
 * Enrichable link to a Job for a chat line: `@UUID[Item.x]{name}`. Braces would break the link syntax (they are
 * removed; brackets are fine inside a label) and `<`, `>` and `&` are escaped, so the result is safe inside HTML.
 * @param {string} uuid
 * @param {string} name
 * @returns {string}
 */
export function jobLink(uuid, name) {
  const label = String(name ?? "").replace(/[{}]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `@UUID[${uuid}]{${label}}`;
}
