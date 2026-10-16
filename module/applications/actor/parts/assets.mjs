/**
 * Crew sheet — assets part: click handlers and extra template context.
 * Filled by its own task (docs/10-backlog.md); the registry in _module.mjs already wires it in.
 */

/** @type {Record<string, Function>} ApplicationV2 `data-action` handlers (called with `this` = the sheet). */
export const actions = {};

/**
 * Adds data this part's templates need to the sheet context.
 * @param {object} _context the context being built
 * @param {object} _sheet the CrewSheet
 */
export async function prepare(_context, _sheet) {}
