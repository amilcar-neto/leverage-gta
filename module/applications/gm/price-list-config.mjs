/**
 * PriceListConfig - GM editor of the `prices` setting (docs/02, docs/09): the price of each item as a list of dice.
 * Edits live in a draft; Save validates (every item needs a die) and writes the setting.
 */
import { LEVERAGE, SYSTEM_ID } from "../../config.mjs";
import { CONFIG_LIMITS, addDie, removeDieAt, validatePrices } from "../../rules/config-data.mjs";
import { getPrices } from "../../settings.mjs";
import { t } from "../components/i18n.mjs";
import { CONFIG_FOOTER, ConfigAppBase } from "./config-app-base.mjs";

/** Price list editor (GM only). */
export class PriceListConfig extends ConfigAppBase {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "leverage-price-list-config",
    classes: ["lv-config--prices"],
    window: { title: "LEVERAGE.Settings.pricesMenu.Name", icon: "fa-solid fa-tags" },
    position: { width: 560 },
    actions: { addDie: PriceListConfig.#onAddDie, removeDie: PriceListConfig.#onRemoveDie }
  };

  /** @override */
  static PARTS = {
    form: { template: `systems/${SYSTEM_ID}/templates/gm/price-list.hbs` },
    footer: { template: CONFIG_FOOTER }
  };

  /** Working copy of the price list. */
  #draft = getPrices();

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.prices = this.#draft.map((price) => ({
      id: price.id, label: t(price.label), dice: price.dice, full: price.dice.length >= CONFIG_LIMITS.priceDice,
      summary: price.dice.length ? price.dice.map((d) => `d${d}`).join(" + ") : t("LEVERAGE.Config.CityScales.noDice")
    }));
    context.adders = LEVERAGE.dice.map((die) => ({ die, label: t("LEVERAGE.Config.addDie", { die: `d${die}` }) }));
    return context;
  }

  /** @override */
  _validateDraft() {
    return validatePrices(this.#draft);
  }

  /** @override */
  async _persist({ prices }) {
    await game.settings.set(SYSTEM_ID, "prices", prices);
  }

  /** @override */
  _resetDraft() {
    this.#draft = validatePrices(LEVERAGE.defaultPrices).prices;
  }

  /** @override */
  _itemLabel(item) {
    return t(item);
  }

  /** Applies `change(price)` to the item of a clicked control and re-renders. */
  #edit(target, change) {
    const price = this.#draft.find((p) => p.id === target.closest("[data-price]")?.dataset.price);
    if (price) change(price);
    return this.render();
  }

  static #onAddDie(event, target) {
    return this.#edit(target, (price) => { price.dice = addDie(price.dice, target.dataset.die, CONFIG_LIMITS.priceDice); });
  }

  static #onRemoveDie(event, target) {
    return this.#edit(target, (price) => { price.dice = removeDieAt(price.dice, target.dataset.index); });
  }
}
