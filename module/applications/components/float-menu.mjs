/**
 * Floating menu used by the crew sheet (change-Role menu, "+ DIE" menu). One menu per sheet at a time; it closes on
 * an outside click, on Escape, when an entry is picked and when the sheet closes (`closeFloatMenu`).
 * The look comes from the caller's CSS classes (`className`, `itemClass`).
 */

/** Open menu per sheet: the element plus the controller that removes its listeners. */
const open = new WeakMap();

/**
 * Where the menu goes, relative to the sheet frame.
 * @param {{left: number, top: number, bottom: number}} frame Frame rectangle.
 * @param {{left: number, top: number, bottom: number}} box Anchor rectangle.
 * @param {"below"|"above"} placement
 * @returns {{left: string, top?: string, bottom?: string}} CSS values in px.
 */
export function menuPosition(frame, box, placement) {
  const left = `${Math.round(box.left - frame.left)}px`;
  if (placement === "above") return { left, bottom: `${Math.round(frame.bottom - box.top + 4)}px` };
  return { left, top: `${Math.round(box.bottom - frame.top + 2)}px` };
}

/**
 * Closes the open menu of `sheet` (safe to call when there is none).
 * @param {ApplicationV2} sheet
 */
export function closeFloatMenu(sheet) {
  const state = open.get(sheet);
  if (!state) return;
  open.delete(sheet);
  state.abort.abort();
  state.menu.remove();
}

/** One menu entry button. */
function buildItem(entry, { itemClass, itemRole }, pick) {
  const button = Object.assign(document.createElement("button"), { type: "button", className: itemClass });
  if (entry.html !== undefined) button.innerHTML = entry.html;
  else button.textContent = entry.text;
  if (entry.title) button.title = entry.title;
  const checkable = entry.current !== undefined;
  button.setAttribute("role", checkable ? "menuitemradio" : itemRole);
  if (checkable) {
    button.setAttribute("aria-checked", String(entry.current));
    button.classList.toggle("is-current", entry.current);
  }
  button.addEventListener("click", () => pick(entry));
  return button;
}

/** A non-clickable section title between entries. */
function buildHeader(text, headerClass) {
  const header = Object.assign(document.createElement("div"), { className: headerClass, textContent: text });
  header.setAttribute("role", "presentation");
  return header;
}

/**
 * Opens a floating menu next to `anchor`, inside the sheet frame.
 * @param {ApplicationV2} sheet The sheet that owns the menu.
 * @param {object} options
 * @param {HTMLElement} options.anchor Element the menu hangs from.
 * @param {string} options.className CSS class of the menu.
 * @param {string} options.itemClass CSS class of every entry.
 * @param {string} [options.itemRole="menuitem"] ARIA role of an entry (checkable entries become menuitemradio).
 * @param {"below"|"above"} [options.placement="below"]
 * @param {string} [options.headerClass] CSS class of section titles (items of the form `{header}`).
 * @param {({header: string}|{text?: string, html?: string, title?: string, current?: boolean, onSelect: () => (void|Promise<void>)})[]} options.items
 *   `html` must already be escaped. `current` marks the checked entry of a radio-like menu.
 */
export function openFloatMenu(sheet, { anchor, className, itemClass, itemRole = "menuitem", placement = "below", headerClass = "", items }) {
  closeFloatMenu(sheet);
  const abort = new AbortController();
  const menu = Object.assign(document.createElement("div"), { className });
  menu.setAttribute("role", "menu");
  const pick = async (entry) => {
    closeFloatMenu(sheet);
    await entry.onSelect();
  };
  for (const entry of items) menu.append("header" in entry ? buildHeader(entry.header, headerClass) : buildItem(entry, { itemClass, itemRole }, pick));
  Object.assign(menu.style, menuPosition(sheet.element.getBoundingClientRect(), anchor.getBoundingClientRect(), placement));
  sheet.element.append(menu);
  open.set(sheet, { menu, abort });
  const { signal } = abort;
  document.addEventListener("pointerdown", (event) => {
    if (!menu.contains(event.target)) closeFloatMenu(sheet);
  }, { capture: true, signal });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.stopPropagation();
    closeFloatMenu(sheet);
    anchor.focus?.();
  }, { capture: true, signal });
  menu.querySelector("button")?.focus();
}
