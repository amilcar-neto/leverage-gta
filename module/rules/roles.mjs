/**
 * Role ranking (docs/02): which Role is primary and which is secondary. Pure logic.
 */
import { LEVERAGE } from "../config.mjs";

/**
 * Marks the highest Role die as `primary` and the second highest as `secondary` (derived, not saved).
 * Ties are broken by the fixed Role order of `LEVERAGE.roles`. Blank Roles never rank.
 * @param {Record<string, {die: number|null}>} roles `system.roles`; mutated in place.
 */
export function deriveRoleRanks(roles) {
  const keys = Object.keys(LEVERAGE.roles);
  const ranked = keys
    .map((key, order) => ({ key, order, die: roles[key]?.die }))
    .filter((r) => r.die)
    .sort((a, b) => (b.die - a.die) || (a.order - b.order));
  for (const key of keys) {
    if (!roles[key]) continue;
    roles[key].primary = ranked[0]?.key === key;
    roles[key].secondary = ranked[1]?.key === key;
  }
}
