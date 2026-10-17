import * as header from "./header.mjs";
import * as ladders from "./ladders.mjs";
import * as lists from "./lists.mjs";
import * as assets from "./assets.mjs";

/** Part modules in render order. Each exports `actions` and `prepare(context, sheet)`. */
const MODULES = [header, ladders, lists, assets];

/** All `data-action` handlers of the crew sheet, merged. */
export const partActions = Object.assign({}, ...MODULES.map((m) => m.actions));

/** Runs every part's `prepare` on the sheet context. */
export async function preparePartContexts(context, sheet) {
  for (const m of MODULES) await m.prepare(context, sheet);
}

export * as drag from "./drag.mjs";
