import * as header from "./header.mjs";
import * as ladders from "./ladders.mjs";
import * as lists from "./lists.mjs";
import * as assets from "./assets.mjs";
import * as tray from "./tray.mjs";
import { mergeActions } from "./merge-actions.mjs";

/**
 * Part modules in render order. Each exports `actions` and `prepare(context, sheet)`, and may export
 * `attach(sheet, signal)` (listeners and hooks, registered once per sheet; undone when `signal` aborts) and
 * `afterRender(sheet)` (runs after every render).
 */
const MODULES = [header, ladders, lists, assets, tray];

/** All `data-action` handlers of the crew sheet, merged (a repeated name throws). */
export const partActions = mergeActions(MODULES.map((m) => m.actions));

/** Runs every part's `prepare` on the sheet context. */
export async function preparePartContexts(context, sheet) {
  for (const m of MODULES) await m.prepare(context, sheet);
}

/**
 * Registers the page-level and sheet-level listeners of every part. Call once, from `_onFirstRender`.
 * @param {ApplicationV2} sheet The crew sheet (its element exists).
 * @param {AbortSignal} signal Aborted when the sheet closes; everything attached must go away then.
 */
export function attachParts(sheet, signal) {
  for (const m of MODULES) m.attach?.(sheet, signal);
}

/** Lets every part touch the DOM after a render. */
export function afterRenderParts(sheet) {
  for (const m of MODULES) m.afterRender?.(sheet);
}

export * as drag from "./drag.mjs";
