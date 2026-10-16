/**
 * Crew sheet — lists part: Distinctions, Talents and Specialties (docs/06).
 * Handles add / open / delete / change-Role clicks. Pool toggling (`togglePool`) belongs to T-501.
 * The Trait lock and the 3-Distinction cap are validated server-side (documents/actor.mjs, item.mjs); the
 * warning is shown by those guards, so nothing here repeats the rule.
 */
import { LEVERAGE } from "../../../config.mjs";

/** CSS class of the floating Role menu. */
const MENU_CLASS = "lv-role-menu";

/**
 * Entries of the "change Role" menu for a Specialty.
 * @param {string[]} roleKeys Role keys, in sheet order.
 * @param {string} current Role the Specialty has now.
 * @returns {{key: string, label: string, current: boolean}[]} `label` is the i18n key.
 */
export function roleMenuEntries(roleKeys, current) {
  return roleKeys.map((key) => ({ key, label: LEVERAGE.roles[key].label, current: key === current }));
}

/** The item a click happened on (rows carry `data-item-id`). */
function itemOf(sheet, target) {
  const id = target.closest("[data-item-id]")?.dataset.itemId;
  return id ? sheet.actor.items.get(id) : null;
}

/** Closes any open Role menu of this sheet. */
function closeRoleMenu(sheet) {
  sheet.element?.querySelectorAll(`.${MENU_CLASS}`).forEach((menu) => menu.remove());
}

/** Builds the floating menu element for `item`, placed under `anchor` inside the sheet frame. */
function buildRoleMenu(sheet, item, anchor) {
  const menu = Object.assign(document.createElement("div"), { className: MENU_CLASS });
  menu.setAttribute("role", "menu");
  for (const entry of roleMenuEntries(Object.keys(LEVERAGE.roles), item.system.role)) {
    const button = Object.assign(document.createElement("button"), {
      type: "button", className: "lv-role-menu-item", textContent: game.i18n.localize(entry.label)
    });
    button.setAttribute("role", "menuitemradio");
    button.setAttribute("aria-checked", String(entry.current));
    button.classList.toggle("is-current", entry.current);
    button.addEventListener("click", async () => {
      closeRoleMenu(sheet);
      if (!entry.current) await item.update({ "system.role": entry.key });
    });
    menu.append(button);
  }
  const frame = sheet.element.getBoundingClientRect();
  const box = anchor.getBoundingClientRect();
  menu.style.left = `${Math.round(box.left - frame.left)}px`;
  menu.style.top = `${Math.round(box.bottom - frame.top + 2)}px`;
  return menu;
}

/** Closes the menu on the next outside click or Escape (listeners remove themselves). */
function dismissOnOutside(sheet, menu) {
  const off = () => {
    closeRoleMenu(sheet);
    document.removeEventListener("pointerdown", onDown, true);
    document.removeEventListener("keydown", onKey, true);
  };
  const onDown = (event) => { if (!menu.contains(event.target)) off(); };
  const onKey = (event) => { if (event.key === "Escape") off(); };
  document.addEventListener("pointerdown", onDown, true);
  document.addEventListener("keydown", onKey, true);
}

/** @type {Record<string, Function>} ApplicationV2 `data-action` handlers (called with `this` = the sheet). */
export const actions = {
  /** "+ ADD": creates the item with a default name (`data-type`) and opens its sheet. */
  async addTraitItem(_event, target) {
    const type = target.dataset.type;
    const name = game.i18n.localize(`LEVERAGE.Sheet.New.${type}`);
    const [item] = await this.actor.createEmbeddedDocuments("Item", [{ name, type }]);
    item?.sheet.render(true);
  },

  /** Name / note / card: opens the item window. */
  openTraitItem(_event, target) {
    itemOf(this, target)?.sheet.render(true);
  },

  /** X: asks for confirmation, then deletes the item. */
  async deleteTraitItem(_event, target) {
    const item = itemOf(this, target);
    if (!item) return;
    const name = foundry.utils.escapeHTML(item.name);
    const yes = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("LEVERAGE.Dialog.deleteTrait.title") },
      content: `<p>${game.i18n.format("LEVERAGE.Dialog.deleteTrait.content", { name })}</p>`,
      rejectClose: false
    });
    if (yes) await item.delete();
  },

  /** Role tag of a Specialty: opens a small menu to pick another Role. */
  pickSpecialtyRole(_event, target) {
    const item = itemOf(this, target);
    if (!item) return;
    closeRoleMenu(this);
    const menu = buildRoleMenu(this, item, target);
    this.element.append(menu);
    dismissOnOutside(this, menu);
  }
};

/**
 * Adds the labels the three list templates need.
 * @param {object} context the context being built
 */
export async function prepare(context) {
  context.roleLabels = Object.fromEntries(LEVERAGE.talentRoles.map((key) => [key, `LEVERAGE.Role.${key}`]));
}
