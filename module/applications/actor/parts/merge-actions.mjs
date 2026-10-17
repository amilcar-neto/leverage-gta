/**
 * Merges the `data-action` handler tables of the sheet parts into one. Action names are global to a sheet, so a
 * name used by two parts is a bug: it throws instead of letting the last part win silently.
 * @param {Record<string, Function>[]} tables One table per part.
 * @returns {Record<string, Function>}
 */
export function mergeActions(tables) {
  const merged = {};
  for (const table of tables) {
    for (const [name, handler] of Object.entries(table)) {
      if (name in merged) throw new Error(`Duplicate crew sheet action "${name}"`);
      merged[name] = handler;
    }
  }
  return merged;
}
