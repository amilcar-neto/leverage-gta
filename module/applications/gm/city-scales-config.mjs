/**
 * CityScalesConfig - GM editor of the `cityScales` setting (docs/02, docs/09): cities (add / remove / rename, ids stay
 * stable), the police Pool of each star, the rules of each city and the default city. Edits live in a draft;
 * Save validates and writes the setting, which fires `leverage.starsChanged` through its `onChange`.
 */
import { LEVERAGE, SYSTEM_ID } from "../../config.mjs";
import { CONFIG_LIMITS, addDie, makeCityId, removeDieAt, validateCityScales } from "../../rules/config-data.mjs";
import { poolText } from "../../rules/stars.mjs";
import { getCityScales } from "../../world-state.mjs";
import { t } from "../components/i18n.mjs";
import { ConfigAppBase, CONFIG_FOOTER as FOOTER } from "./config-app-base.mjs";

const STAR_VALUES = Array.from({ length: CONFIG_LIMITS.stars }, (_, i) => i + 1);

/** `<option>` data for a select of whole numbers, with an optional leading special choice. */
function numberOptions(selected, first) {
  const options = STAR_VALUES.map((n) => ({ value: n, label: String(n), selected: selected === n }));
  return first ? [{ ...first, selected: selected === first.value }, ...options] : options;
}

/** Blank input -> null, otherwise the number. */
const optionalNumber = (value) => (value === "" ? null : Number(value));

/** City scales editor (GM only). */
export class CityScalesConfig extends ConfigAppBase {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "leverage-city-scales-config",
    classes: ["lv-config--cities"],
    window: { title: "LEVERAGE.Settings.cityScalesMenu.Name", icon: "fa-solid fa-city" },
    position: { width: 640 },
    actions: {
      addCity: CityScalesConfig.#onAddCity, removeCity: CityScalesConfig.#onRemoveCity,
      addDie: CityScalesConfig.#onAddDie, removeDie: CityScalesConfig.#onRemoveDie,
      toggleSilence: CityScalesConfig.#onToggleSilence
    }
  };

  /** @override */
  static PARTS = {
    form: { template: `systems/${SYSTEM_ID}/templates/gm/city-scales.hbs` },
    footer: { template: FOOTER }
  };

  /** Working copy of the scales (full shape, `default: true` on one). */
  /** Working copy; read from the setting when the window first renders (not when the object is built). */
  #draft = null;

  /* ----------------------------------------------------------------- context */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    this.#draft ??= getCityScales();
    context.dieSize = LEVERAGE.dieGeometry.uses.ladder;
    context.cities = this.#draft.map((city) => this.#cityData(city));
    context.adders = LEVERAGE.dice.map((die) => ({ die, label: t("LEVERAGE.Config.addDie", { die: `d${die}` }) }));
    return context;
  }

  /** Template data of one city card. */
  #cityData(city) {
    const maxDice = CONFIG_LIMITS.poolDice;
    return {
      id: city.id, name: city.name, isDefault: city.default === true, canRemove: this.#draft.length > 1,
      levels: city.levels.map((dice, i) => ({
        n: i + 1, dice, full: dice.length >= maxDice,
        summary: dice.length ? poolText(dice) : t("LEVERAGE.Config.CityScales.noDice")
      })),
      silence: LEVERAGE.dice.map((die) => ({
        die, on: city.silence?.includes(die) ?? false, off: !city.silence?.includes(die),
        label: t("LEVERAGE.Config.CityScales.silenceDie", { die: `d${die}` })
      })),
      bail: city.bail, wait: city.wait ?? "", starsPerSilenceDie: city.starsPerSilenceDie,
      sketch: city.sketchBlocksDisguise,
      disguise: numberOptions(city.disguise, { value: "clear", label: t("LEVERAGE.Config.CityScales.disguiseAll") }),
      disguiseBoth: numberOptions(city.disguiseBoth, { value: "", label: t("LEVERAGE.Config.CityScales.sameAsDisguise") })
    };
  }

  /* ------------------------------------------------------------------- hooks */

  /** @override */
  _captureDraft() {
    for (const card of this.element.querySelectorAll("[data-city]")) {
      const city = this.#draft.find((c) => c.id === card.dataset.city);
      if (!city) continue;
      const field = (name) => card.querySelector(`[name="${name}"]`);
      city.name = field("name").value;
      city.bail = field("bail").checked;
      city.wait = optionalNumber(field("wait").value);
      city.disguise = field("disguise").value === "clear" ? "clear" : Number(field("disguise").value);
      city.disguiseBoth = optionalNumber(field("disguiseBoth").value);
      city.starsPerSilenceDie = Number(field("starsPerSilenceDie").value);
      city.sketchBlocksDisguise = field("sketchBlocksDisguise").checked;
    }
    const chosen = this.element.querySelector('input[name="defaultCity"]:checked')?.value;
    for (const city of this.#draft) city.default = city.id === chosen;
  }

  /** @override */
  _validateDraft() {
    return validateCityScales(this.#draft);
  }

  /** @override */
  async _persist({ scales }) {
    await game.settings.set(SYSTEM_ID, "cityScales", scales);
    await this.#keepWantedCityValid(scales);
  }

  /** If the city on the Wanted level was removed, moves the level to the default city. */
  async #keepWantedCityValid(scales) {
    const wanted = game.settings.get(SYSTEM_ID, "wanted");
    if (scales.some((s) => s.id === wanted?.city)) return;
    const fallback = scales.find((s) => s.default) ?? scales[0];
    await game.settings.set(SYSTEM_ID, "wanted", { ...wanted, city: fallback.id });
  }

  /** @override */
  _resetDraft() {
    this.#draft = validateCityScales(LEVERAGE.defaultCityScales).scales;
  }

  /* ----------------------------------------------------------------- actions */

  /** The draft city a clicked control belongs to. */
  #cityOf(target) {
    return this.#draft.find((c) => c.id === target.closest("[data-city]")?.dataset.city);
  }

  /** Runs `change(city)` after saving what is typed, then re-renders. */
  #edit(target, change) {
    this._captureDraft();
    const city = this.#cityOf(target);
    if (city) change(city);
    return this.render();
  }

  static #onAddCity() {
    this._captureDraft();
    const base = this.#draft.find((c) => c.default) ?? this.#draft[0];
    const name = t("LEVERAGE.Config.CityScales.newCity");
    const copy = base ? foundry.utils.deepClone(base) : { levels: [] };
    delete copy.default;
    this.#draft.push({ ...copy, name, id: makeCityId(name, this.#draft.map((c) => c.id)) });
    return this.render();
  }

  static #onRemoveCity(event, target) {
    return this.#edit(target, (city) => {
      if (this.#draft.length < 2) return;
      this.#draft = this.#draft.filter((c) => c !== city);
      if (!this.#draft.some((c) => c.default)) this.#draft[0].default = true;
    });
  }

  static #onAddDie(event, target) {
    const level = Number(target.closest("[data-level]").dataset.level) - 1;
    return this.#edit(target, (city) => { city.levels[level] = addDie(city.levels[level], target.dataset.die); });
  }

  static #onRemoveDie(event, target) {
    const level = Number(target.closest("[data-level]").dataset.level) - 1;
    return this.#edit(target, (city) => { city.levels[level] = removeDieAt(city.levels[level], target.dataset.index); });
  }

  static #onToggleSilence(event, target) {
    const die = Number(target.dataset.die);
    return this.#edit(target, (city) => {
      const set = new Set(city.silence ?? []);
      if (!set.delete(die)) set.add(die);
      city.silence = set.size ? [...set].sort((a, b) => b - a) : null;
    });
  }
}
