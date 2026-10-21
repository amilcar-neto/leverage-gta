/**
 * World migration runner. Each entry in {@link MIGRATIONS} upgrades world data up to its `version`.
 * 0.1.0 is the first release, so the list is empty: the runner only records the system version.
 */
import { SYSTEM_ID } from "./config.mjs";
import { logger } from "./logger.mjs";

/**
 * Ordered migrations. Add `{ version: "0.2.0", run: async () => {...} }` to upgrade data from an older world.
 * Schema-level fixes of a single document belong in that DataModel's static `migrateData` instead.
 * @type {{version: string, run: () => Promise<void>}[]}
 */
export const MIGRATIONS = [];

/**
 * Compares two dotted numeric versions ("0.1.0" vs "0.10.2"). Missing parts count as 0.
 * @param {string} a
 * @param {string} b
 * @returns {number} negative if a < b, 0 if equal, positive if a > b
 */
export function compareVersions(a, b) {
  const pa = String(a ?? "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b ?? "").split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Migrations that still have to run for a world last migrated at `stored`.
 * An empty `stored` (fresh world) runs none: new worlds are created with current data.
 * @param {string} stored Version recorded in the world, "" if none.
 * @param {string} current Installed system version.
 * @param {{version: string, run: Function}[]} [list]
 * @returns {{version: string, run: Function}[]} Sorted oldest first.
 */
export function pendingMigrations(stored, current, list = MIGRATIONS) {
  if (!stored) return [];
  return list
    .filter((m) => compareVersions(m.version, stored) > 0 && compareVersions(m.version, current) <= 0)
    .sort((x, y) => compareVersions(x.version, y.version));
}

/**
 * Runs pending data migrations (GM only, once per version) and stores `systemMigrationVersion`.
 * Call from the `ready` hook: `await migrateWorld();`. Never throws: on failure it logs, notifies the GM and
 * leaves the stored version at the last step that succeeded, so the next load retries the failed step.
 * A downgrade (stored version newer than the installed one) keeps the newer stored version untouched.
 * Requires the world setting `systemMigrationVersion` (String, config: false, default "").
 * @returns {Promise<boolean>} true when the stored version changed.
 */
export async function migrateWorld() {
  if (!game.user?.isGM) return false;
  const current = game.system.version;
  let stored = "";
  try {
    stored = game.settings.get(SYSTEM_ID, "systemMigrationVersion") ?? "";
  } catch (err) {
    logger.warn("Could not read systemMigrationVersion; skipping migration.", err);
    return false;
  }
  if (stored === current) return false;
  if (stored && compareVersions(stored, current) > 0) {
    logger.warn(`World was last migrated by a newer system version (${stored} > ${current}); leaving it as is.`);
    return false;
  }
  try {
    for (const migration of pendingMigrations(stored, current)) {
      await migration.run();
      await game.settings.set(SYSTEM_ID, "systemMigrationVersion", migration.version);
    }
    await game.settings.set(SYSTEM_ID, "systemMigrationVersion", current);
    return true;
  } catch (err) {
    logger.error("World migration failed", err);
    ui.notifications.error(game.i18n.localize("LEVERAGE.Migration.failed"), { permanent: true });
    return false;
  }
}
