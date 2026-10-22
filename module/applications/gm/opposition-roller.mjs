/**
 * Opposition roller (docs/08 "Oposição", docs/09): the Fixer picks the opposition dice and rolls them. Sources: loose
 * dice (d4..d12 counters), a test difficulty (2d4..2d12; Easy = "no opposition"), "no opposition" (the default pool), the police Pool for the current stars, a gang, the selected NPC,
 * the Traits of a location and the Complications of the active Job. The roll itself is `rollOpposition`
 * (dice/opposition.mjs), which posts the "FIXER" card. State lives here (client only) and is never saved.
 */
import { LEVERAGE, SYSTEM_ID } from "../../config.mjs";
import {
  BASELINE_DIFFICULTY, complicationSources, difficultyDice, emptyCounts, gangDice, looseDice, npcSources, pickedDice, policeCity, policeDice, rollOpposition, stepCount
} from "../../dice/opposition.mjs";
import { currentViewedLocations, locationTraitEntries } from "../../scene-location.mjs";
import { isValidDie } from "../../dice/die.mjs";
import { readSetting } from "../../data/fields.mjs";
import { readJob } from "../../job-store.mjs";
import { freePlayerCard, linkPlayerCard, playerCardForFixer } from "../../dice/versus-cards.mjs";
import { poolText } from "../../rules/stars.mjs";
import { readComplications } from "../../table-state.mjs";
import { getCityScales, readWanted } from "../../world-state.mjs";
import { renderDie } from "../components/die.mjs";
import { t } from "../components/i18n.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Size of a die in the counters and in the Pool preview. */
const COUNTER_DIE = LEVERAGE.dieGeometry.uses.oppositionCounter;
const PREVIEW_DIE = LEVERAGE.dieGeometry.uses.oppositionPreview;

/** Settings that change what the roller shows. */
const WATCHED_SETTINGS = new Set(["wanted", "cityScales", "houseRules.stars"].map((key) => `${SYSTEM_ID}.${key}`));

/** First selected token actor of the type, or null. */
function selectedActor(type) {
  return canvas?.tokens?.controlled.map((token) => token.actor).find((actor) => actor?.type === type) ?? null;
}

/** The NPC the Fixer points at: the selected NPC token, else the first targeted one. */
function tokenNpc() {
  return selectedActor("npc") ?? [...(game.user?.targets ?? [])].map((token) => token.actor).find((actor) => actor?.type === "npc") ?? null;
}

/** Locations of the moment: the selected one, else those of the viewed Scene (field `scene` or a token on it). */
function sceneLocations() {
  const selected = selectedActor("location");
  return selected ? [selected] : currentViewedLocations();
}

/** Identity of the offered player card: its id and total (the button says both). */
const cardKey = (card) => (card ? `${card.id}:${card.roll.total}` : "");

/** Selectable dice of a Location. The key holds the stable Trait id, so a pick survives reordering and never crosses Traits. */
const locationPickables = (actor) => locationTraitEntries([actor], isValidDie).map((e) => ({ key: `loc.${e.id}`, label: e.name, die: e.die }));

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
      toggleVersus: OppositionRoller.#onToggleVersus, step: OppositionRoller.#onStep, noOpposition: OppositionRoller.#onNoOpposition, togglePolice: OppositionRoller.#onTogglePolice,
      toggleGang: OppositionRoller.#onToggleGang, useNpcGang: OppositionRoller.#onUseNpcGang, toggle: OppositionRoller.#onToggle, difficulty: OppositionRoller.#onDifficulty,
      clear: OppositionRoller.#onClear, roll: OppositionRoller.#onRoll
    }
  };

  /** @override */
  static PARTS = { body: { template: `systems/${SYSTEM_ID}/templates/gm/opposition-roller.hbs` } };

  /** The one open instance. */
  static #instance = null;

  /**
   * Opens the roller, or brings the open one to the front.
   * @param {object} [options]
   * @param {Actor} [options.npc] NPC to load (wins over the NPC of a selected token until another NPC token is selected).
   * @param {boolean} [options.all] With `npc`: pick all of its dice and switch its gang on.
   * @param {string} [options.toggle] With `npc`: source key of one die to pick or unpick.
   */
  static async open({ npc = null, all = false, toggle = null } = {}) {
    OppositionRoller.#instance ??= new OppositionRoller();
    const app = OppositionRoller.#instance;
    const pointed = npc ? null : tokenNpc();
    if (npc?.type === "npc") app.#useNpc(npc, { all, toggle });
    else if (pointed && pointed.id !== app.#npcId) app.#useNpc(pointed, { all: true });
    await app.render({ force: true });
    app.bringToFront();
  }

  #counts = emptyCounts();
  #police = false;
  #gang = { on: false, size: 3, die: 6 };
  #picked = new Set();
  #difficulty = BASELINE_DIFFICULTY;
  #label = "";
  /** The Fixer chose to read the player roll shown on the button as the contest (explicit, never on by itself). */
  #versus = false;
  /** Id of the player card the button shows now: what ROLL links, only if it is still free (never a newer card). */
  #shownCardId = null;
  /** `cardKey` of the card shown, to see when the chat changed what is offered. */
  #shownKey = "";
  /** A roll is in flight (a double click or Enter + click must not post two cards). */
  #rolling = false;
  #hooks = [];
  #npcId = null;
  /** NPC sent by an NPC sheet; a selected NPC token takes over. */
  #loadedNpc = null;

  /* ---------------------------------------------------------- state -> data */

  /** Stars and scales from the settings; the city is `wanted.city`, the one source (a Location's `city` is informative only). */
  #wanted() {
    const wanted = readWanted();
    const scales = getCityScales();
    return { city: policeCity(wanted.city, sceneLocations(), scales), stars: wanted.level, scales };
  }

  /** Whether the Stars house rule is on (the police shortcut is hidden otherwise). */
  #starsOn() {
    return Boolean(readSetting("houseRules.stars", true));
  }

  /** The NPC the roller works with: the selected or targeted token's, else the one an NPC sheet loaded. */
  #npcActor() {
    return tokenNpc() ?? this.#loadedNpc;
  }

  /** Display names of the NPC sources. */
  #names() {
    return {
      attribute: (key) => t(LEVERAGE.attributes[key]?.label ?? key), role: (key) => t(LEVERAGE.roles[key]?.label ?? key),
      trait: t("LEVERAGE.Opposition.traitFallback"), weapon: t("LEVERAGE.NpcSheet.weapon")
    };
  }

  /** Selectable dice of the NPC, its gang and the location / Job groups. */
  #sources() {
    const npc = this.#npcActor();
    const names = this.#names();
    const locations = sceneLocations().map((actor) => ({ name: actor.name, sources: locationPickables(actor) }));
    return {
      npc, npcSources: npc ? npcSources(npc.system, names) : [], locations,
      complications: complicationSources(readComplications())
    };
  }

  /** The player card to offer now; a different card than before turns the choice off (it is explicit, per card). */
  #shownCard() {
    const player = playerCardForFixer();
    if (player?.id !== this.#shownCardId) this.#versus = false;
    this.#shownCardId = player?.id ?? null;
    this.#shownKey = cardKey(player);
    return player;
  }

  /** Every die currently chosen, with the sources that fed them. */
  #chosen(sources) {
    const { city, stars, scales } = this.#wanted();
    const label = (key) => t(`LEVERAGE.Opposition.${key}`);
    const groups = [sources.npcSources, ...sources.locations.map((l) => l.sources), sources.complications];
    const parts = [
      ["difficulty", difficultyDice(this.#difficulty, label("difficulty"))],
      ["manual", looseDice(this.#counts, label("dieLabel"))],
      ["police", this.#police && this.#starsOn() ? policeDice(city, stars, label("police"), scales) : []],
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
    const player = this.#shownCard();
    return {
      versus: player && { on: this.#versus, label: t("LEVERAGE.Opposition.versusPlayer", { name: player.roll.actorName, total: player.roll.total }) },
      difficulties: LEVERAGE.difficulties.map((d) => ({
        key: d.key, label: t(`LEVERAGE.Difficulty.${d.key}`), dice: `${d.dice}d${d.size}`, on: d.key === this.#difficulty
      })),
      counters: LEVERAGE.dice.map((die) => ({
        die, count: this.#counts[die],
        html: renderDie({ die, value: die, size: COUNTER_DIE, muted: this.#counts[die] === 0 })
      })),
      police: { hidden: !this.#starsOn(), on: this.#police, disabled: !police.length, stars, dice: poolText(police.map((d) => d.die)), city },
      gang: { ...this.#gang, options: dieOptions, max: LEVERAGE.gangMax },
      npc: sources.npc && {
        name: sources.npc.name, sources: withState(sources.npcSources, this.#picked),
        gang: npcGang?.size > 0 && npcGang.die ? { size: npcGang.size, die: npcGang.die } : null
      },
      locations: sources.locations.map((l) => ({ name: l.name, sources: withState(l.sources, this.#picked) })),
      complications: withState(sources.complications, this.#picked),
      job: readJob().name,
      pool: {
        count: dice.length, empty: !dice.length,
        dice: dice.map((d) => renderDie({ die: d.die, value: d.die, size: PREVIEW_DIE, title: `${d.label} · d${d.die}` })),
        text: t(dice.length ? "LEVERAGE.Opposition.poolCount" : "LEVERAGE.Opposition.poolEmpty", { count: dice.length, keep: LEVERAGE.keepDefault })
      },
      label: this.#label
    };
  }

  /* -------------------------------------------------------------- lifecycle */

  /** @override */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    const refresh = () => this.rendered && this.render();
    // Only a change of the offered player roll redraws (a redraw while the Fixer types a label would drop the focus).
    const onChat = () => this.rendered && this.#shownKey !== cardKey(playerCardForFixer()) && this.render();
    this.#hooks = [
      ["createChatMessage", Hooks.on("createChatMessage", onChat)],
      ["updateChatMessage", Hooks.on("updateChatMessage", onChat)],
      ["deleteChatMessage", Hooks.on("deleteChatMessage", onChat)],
      ["controlToken", Hooks.on("controlToken", () => this.#onSelectionChanged())],
      ["targetToken", Hooks.on("targetToken", () => this.#onSelectionChanged())],
      ["canvasReady", Hooks.on("canvasReady", refresh)],
      [LEVERAGE.hooks.activeJobChanged, Hooks.on(LEVERAGE.hooks.activeJobChanged, refresh)],
      [LEVERAGE.hooks.tableStateChanged, Hooks.on(LEVERAGE.hooks.tableStateChanged, refresh)],
      ["updateSetting", Hooks.on("updateSetting", (setting) => WATCHED_SETTINGS.has(setting.key) && refresh())],
      ["updateActor", Hooks.on("updateActor", (actor) => actor.id === this.#npcId && refresh())]
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

  /** Re-renders when another NPC is selected or targeted: its dice and gang are picked, those of the previous one dropped. */
  #onSelectionChanged() {
    const npc = tokenNpc();
    if (npc && npc.id !== this.#npcId) this.#useNpc(npc, { all: true });
    else this.#switchNpc(this.#npcActor()?.id ?? null);
    if (this.rendered) this.render();
  }

  /** Remembers the NPC in use and drops the dice picked from the previous one. */
  #switchNpc(npcId) {
    if (npcId === this.#npcId) return;
    this.#npcId = npcId;
    for (const key of [...this.#picked]) if (key.startsWith("npc.")) this.#picked.delete(key);
  }

  /** Loads an NPC sent by its sheet: all its dice and gang (`all`), or one die (`toggle`). */
  #useNpc(npc, { all, toggle }) {
    this.#loadedNpc = npc;
    this.#switchNpc(npc.id);
    const keys = npcSources(npc.system, this.#names()).map((source) => source.key);
    if (all) {
      keys.forEach((key) => this.#picked.add(key));
      const { size, die } = npc.system.gang;
      if (size > 0 && die) this.#gang = { on: true, size: Math.min(LEVERAGE.gangMax, size), die };
    } else if (toggle && keys.includes(toggle) && !this.#picked.delete(toggle)) {
      this.#picked.add(toggle);
    }
  }

  /** The NPC whose dice are in the roll (a picked die or its gang), so the damage dialog can start from it. */
  #rolledNpc(sources) {
    const npc = sources.npc;
    if (!npc) return null;
    const gang = npc.system.gang;
    const usesGang = this.#gang.on && gang?.size > 0 && gang.die === this.#gang.die && gang.size === this.#gang.size;
    return [...this.#picked].some((key) => key.startsWith("npc.")) || usesGang ? npc : null;
  }

  /** Updates the gang inputs without losing the focus. */
  #setGang(patch) {
    const size = Math.min(LEVERAGE.gangMax, Math.max(0, Math.trunc(patch.size ?? this.#gang.size) || 0));
    this.#gang = { ...this.#gang, ...patch, size };
    this.render();
  }

  /* ---------------------------------------------------------------- actions */

  static #onStep(event, target) {
    this.#counts = stepCount(this.#counts, Number(target.dataset.die), Number(target.dataset.delta));
    this.render();
  }

  static #onToggleVersus() {
    this.#versus = !this.#versus;
    this.render();
  }

  static #onDifficulty(event, target) {
    this.#difficulty = target.dataset.key;
    this.render();
  }

  /** "No opposition": the Pool is exactly `LEVERAGE.defaultOppositionDice` (docs/02). */
  static #onNoOpposition() {
    this.#counts = LEVERAGE.defaultOppositionDice.reduce((counts, die) => stepCount(counts, die, 1), emptyCounts());
    this.#police = false;
    this.#gang = { ...this.#gang, on: false };
    this.#picked.clear();
    this.#difficulty = BASELINE_DIFFICULTY;
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
    const gang = this.#npcActor()?.system.gang;
    if (gang?.size > 0 && gang.die) this.#gang = { on: true, size: Math.min(LEVERAGE.gangMax, gang.size), die: gang.die };
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
    this.#difficulty = BASELINE_DIFFICULTY;
    this.render();
  }

  static async #onRoll() {
    if (this.#rolling) return;
    this.#rolling = true;
    try {
      const sources = this.#sources();
      const { dice, source } = this.#chosen(sources);
      const player = this.#versus ? freePlayerCard(this.#shownCardId) : null;
      const message = await rollOpposition({
        dice: dice.map(({ die, label, ref }) => ({ die, label, ref })), label: this.#label, source: source || "none",
        npcUuid: this.#rolledNpc(sources)?.uuid
      });
      if (message && player) await linkPlayerCard(player.id, message);
      this.#versus = false;
    } finally {
      this.#rolling = false;
    }
  }
}
