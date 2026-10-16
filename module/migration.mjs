/**
 * World migration scaffold. Nothing to migrate yet; it only records the system version.
 */
import { SYSTEM_ID } from "./config.mjs";

/**
 * Runs pending data migrations (GM only, once per version). Currently a no-op that stores
 * `systemMigrationVersion`. Call from the `ready` hook: `await migrateWorld();`.
 * Requires the world setting `systemMigrationVersion` (String, config: false, default "") to be registered.
 * @returns {Promise<boolean>} true when a migration pass ran.
 */
export async function migrateWorld() {
  if (!game.user?.isGM) return false;
  const current = game.system.version;
  let stored = "";
  try {
    stored = game.settings.get(SYSTEM_ID, "systemMigrationVersion") ?? "";
  } catch {
    return false;
  }
  if (stored === current) return false;
  // Future migrations go here, guarded by version comparisons against `stored`.
  await game.settings.set(SYSTEM_ID, "systemMigrationVersion", current);
  return true;
}
