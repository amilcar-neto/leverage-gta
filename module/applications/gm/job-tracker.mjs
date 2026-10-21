/**
 * Job Tracker (docs/09 "Rastreador do Job"), Fixer only: Job name, Complications, scene Traits and a Crew overview
 * (Life, Vest, Money, Plot Points with +/-). The Job lives in the world setting `activeJob`; only the GM writes it.
 * Re-renders on `leverage.activeJobChanged` and when a Crew actor changes.
 */
import { LEVERAGE, SYSTEM_ID } from "../../config.mjs";
import { readSetting } from "../../data/fields.mjs";
import { clampSteps } from "../../rules/money.mjs";
import { renderDie } from "../components/die.mjs";
import { t } from "../components/i18n.mjs";
import { crewActors, readJob } from "./job-actions.mjs";
import { addEntry, clampedAdd, removeEntry, renameJob, stepEntry } from "./job-tracker-logic.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Die size in the lists and in the Money cell. */
const DIE_SIZE = LEVERAGE.dieGeometry.uses.tracker;

/** Settings that decide which cells the Crew rows show. */
const RULES_HOOK = "leverage.houseRulesChanged";

/** Template data of one Complication / scene Trait row. */
const entryRow = (list) => (e) => ({
  id: e.id, list, name: e.name, die: e.die,
  html: renderDie({ die: e.die, value: e.die, size: DIE_SIZE, title: `d${e.die}` }),
  canUp: e.die < 12, canDown: e.die > 4
});

/** Template data of one Crew row. */
function crewRow(actor) {
  const { life, vest, plotPoints } = actor.system;
  const { steps, dice } = actor.money;
  return {
    id: actor.id, name: actor.name, life, vest, pp: plotPoints.value, steps,
    moneyHtml: dice.map((d) => renderDie({ die: d, value: d, size: DIE_SIZE, money: true })).join("")
  };
}

/** Job Tracker window. */
export class JobTracker extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "leverage-job-tracker",
    classes: ["leverage-gta", "lv-tracker"],
    tag: "div",
    window: { title: "LEVERAGE.Tracker.title", icon: "fa-solid fa-clipboard-list", resizable: true },
    position: { width: 600, height: "auto" },
    actions: { add: JobTracker.#onAdd, remove: JobTracker.#onRemove, step: JobTracker.#onStep, adjust: JobTracker.#onAdjust }
  };

  /** @override */
  static PARTS = { body: { template: `systems/${SYSTEM_ID}/templates/gm/job-tracker.hbs`, scrollable: [".lv-trk-crew"] } };

  #hooks = [];

  /** @override */
  async _prepareContext() {
    const job = readJob();
    return {
      name: job.name,
      complications: job.complications.map(entryRow("complications")),
      sceneTraits: job.sceneTraits.map(entryRow("sceneTraits")),
      crew: crewActors().map(crewRow),
      rules: { life: Boolean(readSetting("houseRules.life", true)), money: Boolean(readSetting("houseRules.money", true)) }
    };
  }

  /** @override */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    const refresh = () => this.rendered && this.render();
    const onActor = (actor) => actor?.type === "crew" && refresh();
    this.#hooks = [
      ["leverage.activeJobChanged", Hooks.on("leverage.activeJobChanged", refresh)],
      [RULES_HOOK, Hooks.on(RULES_HOOK, refresh)],
      ["updateActor", Hooks.on("updateActor", onActor)],
      ["createActor", Hooks.on("createActor", onActor)],
      ["deleteActor", Hooks.on("deleteActor", onActor)]
    ];
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const el = this.element;
    el.querySelector('[name="jobName"]')?.addEventListener("change", (event) => this.#save(renameJob(readJob(), event.target.value)));
    for (const input of el.querySelectorAll("[data-new-name]")) {
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        this.#addFrom(input.dataset.newName);
      });
    }
  }

  /** @override */
  _onClose(options) {
    for (const [name, id] of this.#hooks) Hooks.off(name, id);
    this.#hooks = [];
    super._onClose(options);
  }

  /** Writes the Job (GM only). */
  async #save(job) {
    if (!game.user.isGM) return ui.notifications.warn(t("LEVERAGE.GM.Warn.gmOnly"));
    await game.settings.set(SYSTEM_ID, "activeJob", job);
  }

  /** Adds the entry typed in the input of `list`. */
  async #addFrom(list) {
    const input = this.element.querySelector(`[data-new-name="${list}"]`);
    const next = addEntry(readJob(), list, input?.value, () => foundry.utils.randomID());
    if (input) input.value = "";
    await this.#save(next);
  }

  /* ---------------------------------------------------------------- actions */

  static #onAdd(event, target) {
    return this.#addFrom(target.dataset.list);
  }

  static #onRemove(event, target) {
    return this.#save(removeEntry(readJob(), target.dataset.list, target.dataset.id));
  }

  static #onStep(event, target) {
    return this.#save(stepEntry(readJob(), target.dataset.list, target.dataset.id, Number(target.dataset.delta)));
  }

  /** Crew +/- buttons: `data-field` is life, vest, money or pp. */
  static async #onAdjust(event, target) {
    const actor = game.actors.get(target.dataset.id);
    if (!actor) return;
    const delta = Number(target.dataset.delta);
    const { life, vest } = actor.system;
    switch (target.dataset.field) {
      case "life": await actor.update({ "system.life.value": clampedAdd(life.value, delta, life.max) }); break;
      case "vest": await actor.update({ "system.vest.value": clampedAdd(vest.value, delta, vest.max) }); break;
      case "money": await actor.money.set(clampSteps(actor.money.steps + delta)); break;
      case "pp": await actor.addPlotPoints(delta); break;
      default:
    }
  }
}
