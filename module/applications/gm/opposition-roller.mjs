/**
 * Opposition roller (docs/08 "Oposição", docs/09): the Fixer picks the opposition dice and rolls them. Sources: loose
 * dice (d4..d12 counters), "no opposition" (2d6), the police Pool for the current stars, a gang, the selected NPC,
 * the Traits of a location and the Complications of the active Job. The roll itself is `rollOpposition`
 * (dice/opposition.mjs), which posts the "FIXER" card. State lives here (client only) and is never saved.
 */
import { LEVERAGE, SYSTEM_ID } from "../../config.mjs";
import {
  complicationSources, emptyCounts, gangDice, locationSources, looseDice, npcSources, pickedDice, policeDice, rollOpposition, stepCount
} from "../../dice/opposition.mjs";
import { readSetting } from "../../data/fields.mjs";
import { renderDie } from "../components/die.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Size of a die in the counters and in the Pool preview. */
const COUNTER_DIE = 36;
const PREVIEW_DIE = 28;

/** Settings that change what the roller shows. */
const WATCHED_SETTINGS = new Set(["wanted", "cityScales", "activeJob"].map((key) => `${SYSTEM_ID}.${key}`));

/** @param {string} key @param {object} [data] */
const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

/** First selected token actor of the type, or null. */
function selectedActor(type) {
  return canvas?.tokens?.controlled.map((token) => token.actor).find((actor) => actor?.type === type) ?? null;
}

/** Locations of the moment: the selected one, else those with a token on the current scene. */
function sceneLocations() {
  const selected = selectedActor("location");
  if (selected) return [selected];
  const actors = (canvas?.scene?.tokens ?? []).map((token) => token.actor).filter((actor) => actor?.type === "location");
  return [...new Map(actors.map((actor) => [actor.id, actor])).values()];
}

/** Template data of one selectable source. */
const withState = (sources, picked) => sources.map((s) => ({
  ...s, on: picked.has(s.key), dieText: `d${s.die}`, tip: `${s.label} · d${s.die}`, cls: `d${s.die}`
}));

/** Opposition roller window (Fixer only). */
export class OppositionRoller extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "leverage-opposition-roller",
    classes: ["leverage-gta", "lv-opposition"],
    tag: "div",
    window: { title: "LEVERAGE.Opposition.title", icon: "fa-solid fa-user-secret", resizable: false },
    position: { width: 460, height: "auto" },
    actions: {
      step: OppositionRoller.#onStep, noOpposition: OppositionRoller.#onNoOpposition, togglePolice: OppositionRoller.#onTogglePolice,
      toggleGang: OppositionRoller.#onToggleGang, useNpcGang: OppositionRoller.#onUseNpcGang, toggle: OppositionRoller.#onToggle,
      clear: OppositionRoller.#onClear, roll: OppositionRoller.#onRoll
    }
  };

  /** @override */
  static PARTS = { body: { template: `systems/${SYSTEM_ID}/templates/gm/opposition-roller.hbs` } };

  /** The one open instance. */
  static #instance = null;

  /** Opens the roller, or brings the open one to the front. */
  static async open() {
    OppositionRoller.#instance ??= new OppositionRoller();
    await OppositionRoller.#instance.render({ force: true });
    OppositionRoller.#instance.bringToFront();
  }

  #counts = emptyCounts();
  #police = false;
  #gang = { on: false, size: 3, die: 6 };
  #picked = new Set();
  #label = "";
  #hooks = [];
  #npcId = null;

  /* ---------------------------------------------------------- state -> data */

  /** City, stars and scales from the settings. */
  #wanted() {
    const wanted = readSetting("wanted", { city: LEVERAGE.stars.defaultCity, level: LEVERAGE.stars.min });
    const scales = readSetting("cityScales", []);
    return { city: wanted.city, stars: wanted.level ?? 0, scales: scales.length ? scales : undefined };
  }

  /** Selectable dice of the selected NPC, its gang and the location / Job groups. */
  #sources() {
    const npc = selectedActor("npc");
    const names = {
      attribute: (key) => t(LEVERAGE.attributes[key]?.label ?? key), role: (key) => t(LEVERAGE.roles[key]?.label ?? key),
      trait: t("LEVERAGE.Opposition.traitFallback")
    };
    const locations = sceneLocations().map((actor) => ({ name: actor.name, sources: locationSources(actor.system.traits, names.trait) }));
    return {
      npc, npcSources: npc ? npcSources(npc.system, names) : [], locations,
      complications: complicationSources(readSetting("activeJob", { complications: [] }))
    };
  }

  /** Every die currently chosen, with the sources that fed them. */
  #chosen(sources) {
    const { city, stars, scales } = this.#wanted();
    const label = (key) => t(`LEVERAGE.Opposition.${key}`);
    const groups = [sources.npcSources, ...sources.locations.map((l) => l.sources), sources.complications];
    const parts = [
      ["manual", looseDice(this.#counts, label("dieLabel"))],
      ["police", this.#police ? policeDice(city, stars, label("police"), scales) : []],
      ["gang", this.#gang.on ? gangDice(this.#gang.size, this.#gang.die, label("gang")) : []],
      ["picked", pickedDice(groups, this.#picked)]
    ].filter(([, dice]) => dice.length);
    return { dice: parts.flatMap(([, dice]) => dice), source: parts.map(([name]) => name).join("+") };
  }

  /** @override */
  async _prepareContext() {
    const sources = this.#sources();
    const { stars, city, scales } = this.#wanted();
    const { dice } = this.#chosen(sources);
    const police = policeDice(city, stars, "", scales);
    const dieOptions = LEVERAGE.dice.map((value) => ({ value, selected: value === this.#gang.die }));
    const npcGang = sources.npc?.system.gang;
    return {
      counters: LEVERAGE.dice.map((die) => ({
        die, count: this.#counts[die],
        html: renderDie({ die, value: die, size: COUNTER_DIE, muted: this.#counts[die] === 0 })
      })),
      police: { on: this.#police, disabled: !police.length, stars, dice: police.map((d) => `d${d.die}`).join(" + "), city },
      gang: { ...this.#gang, options: dieOptions },
      npc: sources.npc && {
        name: sources.npc.name, sources: withState(sources.npcSources, this.#picked),
        gang: npcGang?.size > 0 && npcGang.die ? { size: npcGang.size, die: npcGang.die } : null
      },
      locations: sources.locations.map((l) => ({ name: l.name, sources: withState(l.sources, this.#picked) })),
      complications: withState(sources.complications, this.#picked),
      job: readSetting("activeJob", { name: "" }).name,
      pool: {
        count: dice.length, empty: !dice.length,
        dice: dice.map((d) => renderDie({ die: d.die, value: d.die, size: PREVIEW_DIE, title: `${d.label} · d${d.die}` })),
        text: t(dice.length ? "LEVERAGE.Opposition.poolCount" : "LEVERAGE.Opposition.poolEmpty", { count: dice.length })
      },
      label: this.#label
    };
  }

  /* -------------------------------------------------------------- lifecycle */

  /** @override */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    const refresh = () => this.rendered && this.render();
    this.#hooks = [
      ["controlToken", Hooks.on("controlToken", () => this.#onSelectionChanged())],
      ["canvasReady", Hooks.on("canvasReady", refresh)],
      ["updateSetting", Hooks.on("updateSetting", (setting) => WATCHED_SETTINGS.has(setting.key) && refresh())]
    ];
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const el = this.element;
    el.querySelector('[name="label"]')?.addEventListener("input", (event) => { this.#label = event.target.value; });
    el.querySelector('[name="label"]')?.addEventListener("keydown", (event) => { if (event.key === "Enter") OppositionRoller.#onRoll.call(this); });
    el.querySelector('[name="gangSize"]')?.addEventListener("change", (event) => this.#setGang({ size: Number(event.target.value) }));
    el.querySelector('[name="gangDie"]')?.addEventListener("change", (event) => this.#setGang({ die: Number(event.target.value) }));
  }

  /** @override */
  _onClose(options) {
    for (const [name, id] of this.#hooks) Hooks.off(name, id);
    this.#hooks = [];
    super._onClose(options);
  }

  /** Re-renders when another NPC is selected; dice picked from the previous one are dropped. */
  #onSelectionChanged() {
    const npcId = selectedActor("npc")?.id ?? null;
    if (npcId !== this.#npcId) {
      this.#npcId = npcId;
      for (const key of [...this.#picked]) if (key.startsWith("npc.")) this.#picked.delete(key);
    }
    if (this.rendered) this.render();
  }

  /** Updates the gang inputs without losing the focus. */
  #setGang(patch) {
    const size = Math.min(12, Math.max(0, Math.trunc(patch.size ?? this.#gang.size) || 0));
    this.#gang = { ...this.#gang, ...patch, size };
    this.render();
  }

  /* ---------------------------------------------------------------- actions */

  static #onStep(event, target) {
    this.#counts = stepCount(this.#counts, Number(target.dataset.die), Number(target.dataset.delta));
    this.render();
  }

  /** "2d6 (no opposition)": the Pool is exactly 2d6. */
  static #onNoOpposition() {
    this.#counts = { ...emptyCounts(), 6: 2 };
    this.#police = false;
    this.#gang = { ...this.#gang, on: false };
    this.#picked.clear();
    this.render();
  }

  static #onTogglePolice() {
    this.#police = !this.#police;
    this.render();
  }

  static #onToggleGang() {
    this.#gang = { ...this.#gang, on: !this.#gang.on };
    this.render();
  }

  /** Copies the size and die of the selected NPC's gang into the gang row and switches it on. */
  static #onUseNpcGang() {
    const gang = selectedActor("npc")?.system.gang;
    if (gang?.size > 0 && gang.die) this.#gang = { on: true, size: Math.min(12, gang.size), die: gang.die };
    this.render();
  }

  static #onToggle(event, target) {
    const { key } = target.dataset;
    if (!this.#picked.delete(key)) this.#picked.add(key);
    this.render();
  }

  static #onClear() {
    this.#counts = emptyCounts();
    this.#police = false;
    this.#gang = { ...this.#gang, on: false };
    this.#picked.clear();
    this.render();
  }

  static async #onRoll() {
    const { dice, source } = this.#chosen(this.#sources());
    await rollOpposition({ dice: dice.map(({ die, label, ref }) => ({ die, label, ref })), label: this.#label, source: source || "none" });
  }
}
