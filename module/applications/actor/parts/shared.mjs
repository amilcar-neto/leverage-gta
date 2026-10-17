/**
 * Small helpers shared by the crew sheet parts.
 */

/**
 * The embedded Item a click happened on (rows carry `data-item-id`).
 * @param {ApplicationV2} sheet A crew sheet.
 * @param {HTMLElement} target Element inside the row.
 * @returns {Item|undefined}
 */
export function itemOf(sheet, target) {
  const id = target.closest("[data-item-id]")?.dataset.itemId;
  return id ? sheet.actor.items.get(id) : undefined;
}

/**
 * Opens an Item window (does nothing for a missing Item).
 * @param {Item|undefined} item
 */
export function openItem(item) {
  item?.sheet.render({ force: true });
}

/**
 * Keyboard support for non-button controls marked `role="button"` with a `data-action`: Enter or Space clicks them.
 * @param {KeyboardEvent} event
 * @returns {boolean} true when the key was used.
 */
export function activateOnKey(event) {
  if (event.key !== "Enter" && event.key !== " ") return false;
  const el = event.target;
  if (!el.matches?.('[role="button"][data-action]')) return false;
  event.preventDefault();
  el.click();
  return true;
}
