/**
 * TrainingCostsConfig - GM editor of the `trainingCosts` setting (docs/01, docs/09): the cost in Jobs of each
 * Train Up option. Save validates (whole numbers) and writes the setting.
 */
import { LEVERAGE, SYSTEM_ID } from "../../config.mjs";
import { CONFIG_LIMITS, validateTrainingCosts } from "../../rules/config-data.mjs";
import { getTrainingCosts } from "../../world-state.mjs";
import { t } from "../components/i18n.mjs";
import { CONFIG_FOOTER, ConfigAppBase } from "./config-app-base.mjs";

/** i18n key of a Train Up option. */
const optionLabel = (key) => t(`LEVERAGE.Dialog.TrainUp.Option.${key}`);

/** Training costs editor (GM only). */
export class TrainingCostsConfig extends ConfigAppBase {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "leverage-training-costs-config",
    classes: ["lv-config--costs"],
    window: { title: "LEVERAGE.Settings.trainingCostsMenu.Name", icon: "fa-solid fa-graduation-cap" },
    position: { width: 420 }
  };

  /** @override */
  static PARTS = {
    form: { template: `systems/${SYSTEM_ID}/templates/gm/training-costs.hbs` },
    footer: { template: CONFIG_FOOTER }
  };

  /** Working copy: option key -> cost (kept as typed, validated on Save). */
  /** Working copy; read from the setting when the window first renders (not when the object is built). */
  #draft = null;

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    this.#draft ??= getTrainingCosts();
    context.costs = Object.keys(LEVERAGE.defaultTrainingCosts)
      .map((key) => ({ key, label: optionLabel(key), value: this.#draft[key], max: CONFIG_LIMITS.trainingCost }));
    return context;
  }

  /** @override */
  _captureDraft() {
    for (const key of Object.keys(LEVERAGE.defaultTrainingCosts)) {
      const input = this.element.querySelector(`input[name="${key}"]`);
      if (input) this.#draft[key] = input.value;
    }
  }

  /** @override */
  _validateDraft() {
    return validateTrainingCosts(this.#draft);
  }

  /** @override */
  async _persist({ costs }) {
    await game.settings.set(SYSTEM_ID, "trainingCosts", costs);
  }

  /** @override */
  _resetDraft() {
    this.#draft = { ...LEVERAGE.defaultTrainingCosts };
  }

  /** @override */
  _itemLabel(item) {
    return optionLabel(item);
  }
}
