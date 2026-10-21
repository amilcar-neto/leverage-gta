/**
 * System settings registration (docs/09). Call `registerSettings()` once during `init`.
 * Text lives in lang files under `LEVERAGE.Settings.<key>.Name/Hint`; defaults come from `LEVERAGE` (config.mjs).
 */
import { LEVERAGE, SYSTEM_ID } from "./config.mjs";
import { emptyJob } from "./applications/gm/job-actions.mjs";
import { CityScalesConfig } from "./applications/gm/city-scales-config.mjs";
import { PriceListConfig } from "./applications/gm/price-list-config.mjs";
import { TrainingCostsConfig } from "./applications/gm/training-costs-config.mjs";
import { setScalesProvider } from "./rules/stars.mjs";
import { getCityScales } from "./world-state.mjs";

const fields = () => foundry.data.fields;

/** Builds the common `name`/`hint` pair for a setting key. */
function labels(key) {
  return { name: `LEVERAGE.Settings.${key}.Name`, hint: `LEVERAGE.Settings.${key}.Hint` };
}

/** Registers a visible world Boolean (house-rule toggles). */
function worldBoolean(key, fallback, onChange) {
  game.settings.register(SYSTEM_ID, key, {
    ...labels(key), scope: "world", config: true, type: Boolean, default: fallback, onChange
  });
}

/** Registers a visible world Number. */
function worldNumber(key, fallback) {
  game.settings.register(SYSTEM_ID, key, {
    ...labels(key), scope: "world", config: true, default: fallback,
    type: new (fields().NumberField)({ integer: true, min: 0, nullable: false, initial: fallback })
  });
}

/** Registers a hidden world setting holding structured data. */
function hiddenWorld(key, type, fallback, onChange) {
  game.settings.register(SYSTEM_ID, key, {
    scope: "world", config: false, type, default: fallback, onChange
  });
}

/** Registers a client Boolean. */
function clientBoolean(key, fallback, onChange) {
  game.settings.register(SYSTEM_ID, key, {
    ...labels(key), scope: "client", config: true, type: Boolean, default: fallback, onChange
  });
}

/** Registers a GM menu button that opens an ApplicationV2. */
function menu(key, type, icon) {
  game.settings.registerMenu(SYSTEM_ID, key, {
    name: `LEVERAGE.Settings.${key}.Name`,
    label: `LEVERAGE.Settings.${key}.Label`,
    hint: `LEVERAGE.Settings.${key}.Hint`,
    icon, type, restricted: true
  });
}

/** Re-renders interested UI when a setting changes. */
const notify = (name) => () => Hooks.callAll(LEVERAGE.hooks[name] ?? `leverage.${name}`);

function registerWorldSettings() {
  worldBoolean("houseRules.stars", true, notify("houseRulesChanged"));
  worldBoolean("houseRules.life", true, notify("houseRulesChanged"));
  worldBoolean("houseRules.money", true, notify("houseRulesChanged"));
  worldNumber("lifeBase", LEVERAGE.lifeBase);
  worldNumber("moneyStart", LEVERAGE.money.startSteps);
  worldNumber("jobStartPlotPoints", LEVERAGE.jobStartPlotPoints);
  worldBoolean("traitsLocked", true, notify("traitsLockedChanged"));
  worldBoolean("scenePanel.showActorTraits", true, notify("hudChanged"));
  hiddenWorld("wanted", new (fields().ObjectField)(), { city: LEVERAGE.stars.defaultCity, level: LEVERAGE.stars.min },
    notify("starsChanged"));
  hiddenWorld("cityScales", new (fields().ArrayField)(new (fields().ObjectField)()),
    foundry.utils.deepClone(LEVERAGE.defaultCityScales), notify("starsChanged"));
  hiddenWorld("prices", new (fields().ArrayField)(new (fields().ObjectField)()),
    foundry.utils.deepClone(LEVERAGE.defaultPrices), notify("pricesChanged"));
  hiddenWorld("trainingCosts", new (fields().ObjectField)(), { ...LEVERAGE.defaultTrainingCosts },
    notify("trainingCostsChanged"));
  hiddenWorld("activeJob", new (fields().ObjectField)(), emptyJob(), notify("activeJobChanged"));
  game.settings.register(SYSTEM_ID, "systemMigrationVersion", {
    scope: "world", config: false, type: String, default: ""
  });
}

function registerClientSettings() {
  clientBoolean("hud.showStars", true, notify("hudChanged"));
  clientBoolean("hud.showMoney", true, notify("hudChanged"));
  clientBoolean("hud.showPlotPoints", true, notify("hudChanged"));
  game.settings.register(SYSTEM_ID, "hud.minimized", {
    scope: "client", config: false, type: Boolean, default: false, onChange: notify("hudChanged")
  });
  clientBoolean("scenePanel.show", true, notify("hudChanged"));
  game.settings.register(SYSTEM_ID, "scenePanel.collapsed", {
    scope: "client", config: false, type: Boolean, default: false, onChange: notify("hudChanged")
  });
  clientBoolean("pool.keepAfterRoll", false);
  clientBoolean("debug", false);
}

function registerMenus() {
  menu("cityScalesMenu", CityScalesConfig, "fa-solid fa-city");
  menu("pricesMenu", PriceListConfig, "fa-solid fa-tags");
  menu("trainingCostsMenu", TrainingCostsConfig, "fa-solid fa-graduation-cap");
}

/** Registers every system setting and menu. Call from the `init` hook. */
export function registerSettings() {
  registerWorldSettings();
  registerClientSettings();
  registerMenus();
  setScalesProvider(getCityScales);
}
