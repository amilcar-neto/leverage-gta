/**
 * Crew sheet - drag and drop (T-306). Three jobs:
 *  1. dropping an Item on the sheet copies it to the actor (or, for a Job from another Crew, moves it when the user
 *     owns both actors) - the Trait lock and the 3-Distinction cap are enforced by the documents, which warn;
 *  2. dropping an Item on a row of the same list reorders it (`sort`);
 *  3. dragging a Trait (Attribute, Role, Item die) to the hotbar makes a macro that puts it in the Pool (`hotbarDrop`).
 * The pure decisions are exported for unit tests; the rest is thin glue on the sheet.
 */
import { LEVERAGE } from "../../../config.mjs";

/** Mime prefix that tells `dragover` (which cannot read the payload) the type of the Item being dragged. */
export const ITEM_MIME = "application/x-leverage-item-";

/** `type` of the drag payload of an Attribute/Role (Items use the core `Item` payload plus `leverageRef`). */
export const TRAIT_DRAG_TYPE = "LeverageTrait";

/** Flag that marks the macros created here. */
const MACRO_FLAG = "traitMacro";

/**
 * The Pool reference an Item gives when dragged to the hotbar, or null when it has no die.
 * @param {{id: string, type: string, system?: {die?: number}}} item
 * @param {string|null} [origin] Reference of the die button the drag started on (wins when it belongs to the item).
 * @returns {string|null}
 */
export function itemPoolRef(item, origin = null) {
  const base = `item:${item.id}`;
  if (origin?.startsWith(base)) return origin;
  if (item.type === "distinction") return `${base}:d${LEVERAGE.distinctionDice.helps}`;
  if (["specialty", "asset"].includes(item.type)) return base;
  if (item.type === "talent" && item.system?.die) return base;
  return null;
}

/**
 * What a drop of an Item on a sheet must do.
 * @param {object} p
 * @param {boolean} p.sameActor The item already belongs to the sheet's actor.
 * @param {string} p.type Item type.
 * @param {boolean} p.hasSource The item belongs to another actor.
 * @param {boolean} p.ownsSource The user owns that actor and the item.
 * @returns {"sort"|"move"|"copy"}
 */
export function dropMode({ sameActor, type, hasSource, ownsSource }) {
  if (sameActor) return "sort";
  return type === "job" && hasSource && ownsSource ? "move" : "copy";
}

/**
 * Source of the hotbar macro for one Pool reference: it opens the sheet and puts the Trait in its Pool
 * (`game.leverage.pool.add`), so a single Attribute or Role works too. Warns instead of failing without the API.
 * @param {string} actorUuid
 * @param {string} ref
 * @returns {string}
 */
export function macroCommand(actorUuid, ref) {
  const call = `game.leverage.pool.add(fromUuidSync(${JSON.stringify(actorUuid)}), ${JSON.stringify(ref)})`;
  return `game.leverage?.pool ? ${call} : ui.notifications.warn(game.i18n.localize("LEVERAGE.Warn.apiNotReady"));`;
}

/* ---------------------------------------------------------------- drag start */

/**
 * Fills the drag event for the row being dragged.
 * @param {DragEvent} event
 * @param {Actor} actor The sheet's actor.
 * @param {HTMLElement} row The draggable row.
 * @param {string|null} origin `data-pool-ref` of the element the pointer went down on, if any.
 */
export function startDrag(event, actor, row, origin) {
  let payload;
  if (row.dataset.itemId) {
    const item = actor.items.get(row.dataset.itemId);
    if (!item) return;
    payload = { ...item.toDragData(), leverageRef: itemPoolRef(item, origin) };
    event.dataTransfer.setData(`${ITEM_MIME}${item.type}`, item.id);
  } else {
    const ref = origin?.startsWith(row.dataset.traitRef) ? origin : row.dataset.traitRef;
    const label = row.querySelector(".lv-row-name")?.textContent.trim() ?? ref;
    payload = { type: TRAIT_DRAG_TYPE, actorUuid: actor.uuid, ref, label, img: actor.img };
  }
  event.dataTransfer.setData("text/plain", JSON.stringify(payload));
  event.dataTransfer.effectAllowed = "copyMove";
}

/* ---------------------------------------------------------------- drop on the sheet */

/** Type of the Item being dragged inside a Leverage sheet (from the mime marker), or null. */
export function internalDragType(event) {
  const mime = [...(event.dataTransfer?.types ?? [])].find((t) => t.startsWith(ITEM_MIME));
  return mime ? mime.slice(ITEM_MIME.length) : null;
}

/**
 * Moves `item` before the row under the drop, among the rows of the same list.
 * @param {Actor} actor
 * @param {Item} item
 * @param {EventTarget} target
 */
async function sortBefore(actor, item, target) {
  const row = target.closest?.("[data-item-id]");
  const targetItem = row ? actor.items.get(row.dataset.itemId) : null;
  if (!targetItem || targetItem.id === item.id || targetItem.type !== item.type) return;
  const siblings = [...row.parentElement.children]
    .map((el) => actor.items.get(el.dataset.itemId))
    .filter((sibling) => sibling && sibling.id !== item.id && sibling.type === item.type);
  const updates = foundry.utils.performIntegerSort(item, { target: targetItem, siblings });
  await actor.updateEmbeddedDocuments("Item", updates.map(({ target: t, update }) => ({ _id: t.id, ...update })));
}

/** Creation data for a copy of `item`, placed at the end of its list on `actor`. */
function copyData(actor, item) {
  const data = item.toObject();
  delete data._id;
  delete data.folder;
  delete data.ownership;
  const sorts = actor.items.filter((i) => i.type === item.type).map((i) => i.sort);
  data.sort = (sorts.length ? Math.max(...sorts) : 0) + CONST.SORT_INTEGER_DENSITY;
  return data;
}

/**
 * Copies `item` to `actor`; with `move` also deletes the original, but only when the copy was really created.
 * @returns {Promise<Item|null>} the new item
 */
async function copyItem(actor, item, move) {
  const [created] = await actor.createEmbeddedDocuments("Item", [copyData(actor, item)]);
  if (created && move) await item.delete();
  return created ?? null;
}

/**
 * Handles an `Item` drop on a crew sheet.
 * @param {Actor} actor The sheet's actor.
 * @param {DragEvent} event
 * @param {object} data Parsed drag payload.
 */
export async function dropItem(actor, event, data) {
  if (!actor.isOwner) return;
  const item = await Item.implementation.fromDropData(data);
  if (!item) return;
  const source = item.parent instanceof Actor ? item.parent : null;
  const mode = dropMode({
    sameActor: source?.uuid === actor.uuid,
    type: item.type,
    hasSource: Boolean(source),
    ownsSource: Boolean(source?.isOwner && item.isOwner)
  });
  if (mode === "sort") await sortBefore(actor, item, event.target);
  else await copyItem(actor, item, mode === "move");
}

/* ---------------------------------------------------------------- hotbar */

/** Actor, ref, name and image of the macro for a drag payload (Item payloads are resolved from the item). */
async function describeTrait(data) {
  if (data.type === TRAIT_DRAG_TYPE) return { actorUuid: data.actorUuid, ref: data.ref, name: data.label, img: data.img };
  const item = await fromUuid(data.uuid);
  const { hinders } = LEVERAGE.distinctionDice;
  const tag = data.leverageRef?.endsWith(`:d${hinders}`) ? ` d${hinders}` : "";
  return { actorUuid: item?.parent?.uuid, ref: data.leverageRef, name: item ? `${item.name}${tag}` : "", img: item?.img };
}

/** Creates (or reuses) the macro and puts it on the hotbar. */
async function createTraitMacro(data, slot) {
  const { actorUuid, ref, name, img } = await describeTrait(data);
  if (!actorUuid || !ref) return;
  const command = macroCommand(actorUuid, ref);
  const macro = game.macros.find((m) => m.command === command && m.isAuthor)
    ?? await CONFIG.Macro.documentClass.create({ name, img, type: "script", command, flags: { [LEVERAGE.systemId]: { [MACRO_FLAG]: true } } });
  await game.user.assignHotbarMacro(macro, slot);
}

/**
 * `hotbarDrop` hook: turns a dragged Trait into a roll macro. Returns false (stops the core) only for our payloads.
 * @param {Hotbar} _bar
 * @param {object} data Drag payload.
 * @param {number} slot Hotbar slot.
 * @returns {boolean|void}
 */
export function onHotbarDrop(_bar, data, slot) {
  const ours = data?.type === TRAIT_DRAG_TYPE || (data?.type === "Item" && data.leverageRef);
  if (!ours) return;
  createTraitMacro(data, slot);
  return false;
}

/* ---------------------------------------------------------------- drop feedback */

/** CSS classes used for the feedback (see styles/sheets/drag.css). */
export const DROP_CLASS = Object.freeze({ sheet: "lv-drop-active", row: "lv-drop-target" });

/** Removes every drop highlight from the sheet element. */
export function clearDropMarks(element) {
  element?.classList.remove(DROP_CLASS.sheet);
  element?.querySelectorAll(`.${DROP_CLASS.row}`).forEach((el) => el.classList.remove(DROP_CLASS.row));
}

/**
 * Highlights while dragging: the row under the pointer for a same-list reorder, the whole sheet for anything else.
 * @param {HTMLElement} element The sheet element.
 * @param {DragEvent} event
 * @param {Actor} actor
 */
export function markDrop(element, event, actor) {
  clearDropMarks(element);
  const type = internalDragType(event);
  const row = event.target.closest?.("[data-item-id]");
  if (type && row && actor.items.get(row.dataset.itemId)?.type === type) row.classList.add(DROP_CLASS.row);
  else if (!type) element.classList.add(DROP_CLASS.sheet);
}
