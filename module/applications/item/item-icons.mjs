/**
 * Default icon per Item type (assets/items/<type>.svg). A new Item created without an image gets its type's icon.
 */
import { LEVERAGE } from "../../config.mjs";

/**
 * Icon path of an Item type.
 * @param {string} type
 * @returns {string}
 */
export const itemIcon = (type) => `systems/${LEVERAGE.systemId}/assets/items/${type}.svg`;

/** Registers the `preCreateItem` hook that applies the default icon. Call once from `init`. */
export function registerItemIcons() {
  Hooks.on("preCreateItem", (item, data) => {
    if (data.img || !CONFIG.Item.dataModels[item.type]) return;
    item.updateSource({ img: itemIcon(item.type) });
  });
}
