/**
 * Fields of an Item that only the Fixer changes once the Item exists (pure, no Foundry dependency; the list is
 * `LEVERAGE.protectedItemFields`).
 */
import { LEVERAGE } from "../../config.mjs";

/**
 * Removes from an expanded form object the fields only the Fixer may change (`LEVERAGE.protectedItemFields`).
 * @param {string} type Item type.
 * @param {object} data Expanded object, e.g. `{system: {payout: {share: 3}}}`. Not modified.
 * @param {boolean} isGM
 * @returns {object} `data` itself for the Fixer, otherwise a copy without the protected fields.
 */
export function withoutProtectedFields(type, data, isGM) {
  const paths = LEVERAGE.protectedItemFields[type] ?? [];
  if (isGM || !paths.length) return data;
  const copy = structuredClone(data);
  for (const path of paths) {
    const keys = path.split(".");
    const last = keys.pop();
    const parent = keys.reduce((node, key) => node?.[key], copy);
    if (parent && typeof parent === "object") delete parent[last];
  }
  return copy;
}
