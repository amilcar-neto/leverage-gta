/**
 * PriceListConfig - GM configuration menu (stub). Opens and closes cleanly; the real editor comes in a later task.
 */

const { ApplicationV2 } = foundry.applications.api;

export class PriceListConfig extends ApplicationV2 {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "leverage-price-list-config",
    classes: ["leverage", "leverage-gm-config"],
    tag: "div",
    window: { title: "LEVERAGE.Settings.prices.Name", resizable: true },
    position: { width: 480, height: "auto" }
  };

  /** @override */
  async _renderHTML() {
    return document.createElement("div");
  }

  /** @override */
  _replaceHTML(result, content) {
    content.replaceChildren(result);
  }
}
