/**
 * Pure helpers of the Job Tracker (docs/09): edits of the `activeJob` value `{ name, goal }`, and the stepper math of
 * the Crew rows. Complications and Traits are table state, see `rules/table-entries.mjs`. Nothing here touches Foundry
 * and nothing mutates its input; every function returns a new job.
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
 * @param {object} job
 * @param {string} name
 * @returns {{name: string, goal: string}} the Job with a new (trimmed) name
 */
export const renameJob = (job, name) => ({ ...normalizeJob(job), name: String(name ?? "").trim() });

/**
 * @param {object} job
 * @param {string} goal
 * @returns {{name: string, goal: string}} the Job with a new (trimmed) goal
 */
export const setJobGoal = (job, goal) => ({ ...normalizeJob(job), goal: String(goal ?? "").trim() });

/**
 * Adds `delta` to a counter and keeps it in `0..max` (`max` omitted: no upper limit).
 * @param {number} value
 * @param {number} delta
 * @param {number} [max]
 * @returns {number}
 */
export function clampedAdd(value, delta, max = Infinity) {
  return Math.min(max, Math.max(0, Math.trunc(Number(value) || 0) + Math.trunc(Number(delta) || 0)));
}
