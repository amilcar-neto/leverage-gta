/**
 * NPC sheet (docs/06 "Fichas de NPC e Local"): header (portrait, name, tier, police, Life/Vest), Trait list, optional
 * Attributes and Roles (Foil and Agent), gang, weapon, notes and the ROLL AS OPPOSITION button. Same visual language as
 * the crew sheet, simpler. The Trait lock does not apply: whoever can edit the NPC (the GM) edits freely, everyone else
 * only reads. Dice written here are plain actor updates; the pure list/die logic is in `npc-logic.mjs`.
 */
import { LEVERAGE, hasRealPortrait } from "../../config.mjs";
import { npcTraitKey, openOppositionRoller } from "../../dice/opposition.mjs";
import { LeverageActorSheet } from "./base-actor-sheet.mjs";
import { buildRows } from "./parts/ladders.mjs";
import { vestKindUpdate, vitalsEnabled } from "./parts/header.mjs";
import { t } from "../components/i18n.mjs";
import {
  GANG_MAX, addTrait, clampGang, dieLadder, isDiePath, nextNpcDie, opposeDiceCount, patchTrait, removeTrait, showsLadders, stepDie,
  traitRows
} from "./npc-logic.mjs";

const TEMPLATES = `systems/${LEVERAGE.systemId}/templates/actor/npc`;

/** A part definition for the template `<name>.hbs`. */
const part = (name, extra = {}) => ({ template: `${TEMPLATES}/${name}.hbs`, ...extra });

/** Hook fired when a house-rule setting changes (Life/Vest on or off). */
const HOUSE_RULES_HOOK = "leverage.houseRulesChanged";

/** Which parts live in which body column, top to bottom (`#groupColumns` wraps them; Foundry v14 has no PART containers). */
const COLUMNS = Object.freeze({
  main: ["traits", "gang", "weapon", "notes"],
  side: ["ladders"]
});

/** Panels of the Attributes / Roles part, in order: `[group, title key]`. */
const LADDER_GROUPS = Object.freeze([["attributes", "LEVERAGE.Sheet.Panel.attributes"], ["roles", "LEVERAGE.Sheet.Panel.roles"]]);

/** Display names the opposition sources need. */
const sourceNames = () => ({
  attribute: (key) => t(LEVERAGE.attributes[key]?.label ?? key),
  role: (key) => t(LEVERAGE.roles[key]?.label ?? key),
  trait: t("LEVERAGE.Opposition.traitFallback"),
  weapon: t("LEVERAGE.NpcSheet.weapon")
});

export class NpcSheet extends LeverageActorSheet {
  /** The Trait lock does not govern this sheet: no seal in the title bar. */
  static HAS_LOCK_SEAL = false;

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["npc-sheet"],
    position: { width: 760, height: 820 },
    window: { icon: "fa-solid fa-user-secret" },
    actions: {
      pickPhoto: NpcSheet.#onPickPhoto,
      togglePolice: NpcSheet.#onTogglePolice,
      addTrait: NpcSheet.#onAddTrait,
      deleteTrait: NpcSheet.#onDeleteTrait,
      stepTraitDie: NpcSheet.#onStepTraitDie,
      pickTraitDie: NpcSheet.#onPickTraitDie,
      setDie: NpcSheet.#onSetDie,
      stepGang: NpcSheet.#onStepGang,
      rollAsOpposition: NpcSheet.#onRollAsOpposition
    }
  };

  /** @override */
  static PARTS = {
    header: part("header"),
    traits: part("traits"),
    ladders: part("attributes-roles"),
    gang: part("gang"),
    weapon: part("weapon"),
    notes: part("notes"),
    footer: part("footer")
  };

  /** Window title: only the name, in capitals (like the crew sheet). */
  get title() {
    return this.actor.name.toLocaleUpperCase(game.i18n.lang);
  }

  /** Aborted when the sheet closes: removes the listeners and the hook of `_onFirstRender`. */
  #abort = null;

  /** @override */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.#abort = new AbortController();
    const { signal } = this.#abort;
    this.element.addEventListener("change", (event) => this.#onFieldChange(event), { signal });
    const hookId = Hooks.on(HOUSE_RULES_HOOK, () => {
      if (this.rendered) this.render({ parts: ["header"] });
    });
    signal.addEventListener("abort", () => Hooks.off(HOUSE_RULES_HOOK, hookId));
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);
    this.#abort?.abort();
    this.#abort = null;
  }

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#groupColumns();
  }

  /** Wraps the body parts in their two column elements (idempotent; runs after every render). */
  #groupColumns() {
    const content = this.element.querySelector(".window-content");
    const footer = content.querySelector('[data-application-part="footer"]');
    for (const [name, ids] of Object.entries(COLUMNS)) {
      let column = content.querySelector(`:scope > .lv-npc-col--${name}`);
      if (!column) {
        column = Object.assign(document.createElement("div"), { className: `lv-npc-col lv-npc-col--${name}` });
        footer.before(column);
      }
      for (const id of ids) {
        const el = content.querySelector(`[data-application-part="${id}"]`);
        if (el && el.parentElement !== column) column.append(el);
      }
    }
  }

  /* ---------------------------------------------------------------- context */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const { actor, system, canEdit } = context;
    const hasPhoto = hasRealPortrait(actor.img);
    const showLadders = showsLadders(system.tier);
    Object.assign(context, {
      hasPhoto,
      tiers: Object.fromEntries(Object.entries(LEVERAGE.npcTiers).map(([key, def]) => [key, def.label])),
      tierLabel: LEVERAGE.npcTiers[system.tier]?.label,
      showVitals: vitalsEnabled(),
      lifeMaxEditable: canEdit && !system.attributes?.vitality?.die,
      vestKinds: Object.fromEntries(Object.entries(LEVERAGE.vestKinds).map(([key, def]) => [key, def.label])),
      vestLabel: LEVERAGE.vestKinds[system.vest.kind]?.label,
      traits: traitRows(system.traits, npcTraitKey),
      showLadders,
      ladderGroups: showLadders ? LADDER_GROUPS.map(([group, title]) => ({
        group, title, rows: buildRows({ group, values: system[group], canEdit, locked: false, t })
      })) : [],
      gangMax: GANG_MAX,
      gangCanDown: system.gang.size > 0,
      gangCanUp: system.gang.size < GANG_MAX,
      gangLadder: dieLadder(system.gang.die, canEdit, (die) => t("LEVERAGE.NpcSheet.dieLabel", { what: t("LEVERAGE.NpcSheet.gang"), die })),
      weaponLadder: dieLadder(system.weapon.die, canEdit, (die) => t("LEVERAGE.NpcSheet.dieLabel", { what: t("LEVERAGE.NpcSheet.weapon"), die })),
      poolText: t("LEVERAGE.Opposition.poolCount", { count: opposeDiceCount(system, sourceNames()), keep: LEVERAGE.keepDefault }),
      notes: await foundry.applications.ux.TextEditor.implementation.enrichHTML(system.notes, {
        relativeTo: actor, secrets: actor.isOwner
      })
    });
    return context;
  }

  /* ---------------------------------------------------------------- fields */

  /** Fields without a `name` (the form does not send them): Trait names and the vest kind. */
  #onFieldChange(event) {
    if (!this.isEditable) return;
    const input = event.target;
    if (input.matches?.("[data-trait-name]")) {
      const index = Number(input.closest("[data-index]")?.dataset.index);
      return this.actor.update({ "system.traits": patchTrait(this.actor.system.traits, index, { name: input.value.trim() }) });
    }
    if (input.matches?.("[data-vest-kind]")) {
      const data = vestKindUpdate(input.value);
      if (data && input.value !== this.actor.system.vest.kind) return this.actor.update(data);
    }
  }

  /* ---------------------------------------------------------------- actions */

  /** Portrait click: Foundry file picker, stores the image on the actor. */
  static #onPickPhoto() {
    if (!this.isEditable) return;
    const picker = new foundry.applications.apps.FilePicker.implementation({
      type: "image", current: this.actor.img, callback: (path) => this.actor.update({ img: path })
    });
    return picker.render({ force: true });
  }

  /** POLICE tag: toggles the police flag. */
  static #onTogglePolice() {
    if (!this.isEditable) return;
    return this.actor.update({ "system.police": !this.actor.system.police });
  }

  /** "+ ADD": a new Trait with the default die. */
  static #onAddTrait() {
    if (!this.isEditable) return;
    return this.actor.update({ "system.traits": addTrait(this.actor.system.traits) });
  }

  /** X on a Trait row. */
  static #onDeleteTrait(_event, target) {
    if (!this.isEditable) return;
    const index = Number(target.closest("[data-index]")?.dataset.index);
    return this.actor.update({ "system.traits": removeTrait(this.actor.system.traits, index) });
  }

  /** The small arrows around a Trait die. */
  static #onStepTraitDie(_event, target) {
    if (!this.isEditable) return;
    const index = Number(target.closest("[data-index]")?.dataset.index);
    const trait = this.actor.system.traits[index];
    if (!trait) return;
    const die = stepDie(trait.die, Number(target.dataset.delta));
    if (die !== trait.die) return this.actor.update({ "system.traits": patchTrait(this.actor.system.traits, index, { die }) });
  }

  /** Click on a Trait die: puts it in the opposition roller (GM only; the roller opens if needed). */
  static #onPickTraitDie(_event, target) {
    return openOppositionRoller({ npc: this.actor, toggle: target.dataset.sourceKey });
  }

  /** Click on a ladder die (Attributes, Roles, gang, weapon): sets it, or clears it when it is the current one. */
  static #onSetDie(_event, target) {
    if (!this.isEditable) return;
    const path = target.closest("[data-die-path]")?.dataset.diePath;
    if (!isDiePath(path)) return;
    const next = nextNpcDie(foundry.utils.getProperty(this.actor, path), Number(target.dataset.die));
    if (next !== undefined) return this.actor.update({ [path]: next });
  }

  /** The − / + around the gang size. */
  static #onStepGang(_event, target) {
    if (!this.isEditable) return;
    const size = clampGang(this.actor.system.gang.size + Number(target.dataset.delta));
    if (size !== this.actor.system.gang.size) return this.actor.update({ "system.gang.size": size });
  }

  /** ROLL AS OPPOSITION: opens the opposition roller with every die of this NPC picked. */
  static #onRollAsOpposition() {
    return openOppositionRoller({ npc: this.actor, all: true });
  }
}
