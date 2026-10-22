/**
 * Pure helpers of the Job Tracker (docs/09): goal editing and the stepper math of the Crew rows. World Job rules are in
 * `rules/jobs.mjs`; Complications and Traits are table state, see `rules/table-entries.mjs`. Nothing here touches Foundry
 * and nothing mutates its input.
 */
import { normalizeJob } from "../../rules/jobs.mjs";

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
