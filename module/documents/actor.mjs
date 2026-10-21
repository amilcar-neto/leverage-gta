/**
 * LeverageActor: Actor document with Plot Point and Money helpers, the Trait lock on `system` dice and the
 * Distinction cap for batch creation (docs/04 "Trava", docs/03). Per-Item vetoes live in LeverageItem
 * (`_preCreate`/`_preUpdate`/`_preDelete` returning `false`), because the Actor's descendant hooks cannot cancel.
 */
import { LEVERAGE } from "../config.mjs";
import { readSetting } from "../data/fields.mjs";
import { maxLife, restScene } from "../rules/combat.mjs";
import * as money from "../rules/money.mjs";
import { getPriceDice } from "../world-state.mjs";
import { canEditTraits, checkItemBatch, warnBatchFailure, warnUser } from "./guards.mjs";

/** Hook fired by the house-rule settings (the sheet header uses the same one). */
const HOUSE_RULES_HOOK = LEVERAGE.hooks.houseRulesChanged;

/** True when the Life/Vest house rule is on (safe before settings are ready). */
const lifeRuleOn = () => Boolean(readSetting("houseRules.life", true));

/**
 * Whether Foundry itself would show the bars of `token` (display mode and who may see them). Computed again here
 * so the bars come back when the rule is switched on: the core only sets the flag during its own refresh.
 */
function barsShown(token) {
  const mode = token.document?.displayBars;
  if (mode === CONST.TOKEN_DISPLAY_MODES.NONE) return false;
  return token._canViewMode?.(mode) ?? true;
}

/**
 * Token bars follow `houseRules.life`: with the rule off the Life and Vest bars are hidden (data is kept).
 * Registered once at load; tokens are asked to redraw their bars when the rule changes.
 */
globalThis.Hooks?.on("refreshToken", (token) => {
  if (!token.actor?.system?.life || !token.bars) return;
  token.bars.visible = lifeRuleOn() && barsShown(token);
});
globalThis.Hooks?.on(HOUSE_RULES_HOOK, () => {
  for (const token of globalThis.canvas?.tokens?.placeables ?? []) token.renderFlags?.set({ refreshBars: true });
});

export class LeverageActor extends Actor {
  /** Whether the world setting currently locks Traits. */
  static get traitsLocked() {
    return Boolean(readSetting("traitsLocked", false));
  }

  /**
   * Whether `user` may create/remove/change Traits (GM always; others only when unlocked).
   * @param {User} [user]
   * @returns {boolean}
   */
  static canEditTraits(user = game.user) {
    return canEditTraits(user);
  }

  /** @override */
  getRollData() {
    return this.system.getRollData?.() ?? super.getRollData();
  }

  /**
   * Adds (or removes, when negative) Plot Points; never below 0. Crew only; other types are left untouched.
   * @param {number} n
   * @returns {Promise<LeverageActor>}
   */
  async addPlotPoints(n) {
    if (this.type !== "crew") return this;
    const current = this.system.plotPoints?.value ?? 0;
    const next = Math.max(0, current + Math.trunc(Number(n) || 0));
    return this.update({ "system.plotPoints.value": next });
  }

  /**
   * Money helpers backed by `rules/money.mjs`. Money is stored as steps (`system.money.steps`).
   * @returns {{steps: number, dice: number[], canAfford: Function, add: Function, pay: Function, set: Function}}
   */
  get money() {
    const steps = () => this.system.money?.steps ?? 0;
    const save = (value) => this.update({ "system.money.steps": value });
    /** A price is steps (number) or a list of dice such as `[12, 6]`. */
    const toSteps = (price) => (Array.isArray(price) ? money.priceToSteps(price) : price);
    return {
      steps: steps(),
      dice: money.stepsToDice(steps()),
      canAfford: (price) => money.canAfford(steps(), toSteps(price)),
      /** Adds steps (capped); resolves to the steps that actually fit. */
      add: async (amount) => {
        const { steps: next, gained } = money.earn(steps(), amount);
        await save(next);
        return gained;
      },
      /**
       * Pays a price given in steps (number) or as a dice list (e.g. `[12, 6]`, converted with
       * `priceToSteps`). Resolves to `{ok, steps, shortBy}`. Nothing is spent when short.
       */
      pay: async (price) => {
        const result = money.pay(steps(), toSteps(price));
        if (result.ok) await save(result.steps);
        return result;
      },
      /** Sets steps directly (clamped to the ladder). */
      set: async (value) => {
        await save(money.clampSteps(value));
        return steps();
      }
    };
  }

  /**
   * Heals Life by `n` (never above max, never below 0). Works for crew and npc.
   * @param {number} n
   * @returns {Promise<LeverageActor>}
   */
  async heal(n) {
    const life = this.system.life;
    if (!life) return this;
    const next = Math.min(life.max, Math.max(0, life.value + Math.trunc(Number(n) || 0)));
    return next === life.value ? this : this.update({ "system.life.value": next });
  }

  /**
   * Rest scene (docs/02): recovers half of the max Life, rounded down.
   * @returns {Promise<LeverageActor>}
   */
  async restScene() {
    const life = this.system.life;
    if (!life) return this;
    return this.heal(restScene(life.value, life.max) - life.value);
  }

  /**
   * A day between Jobs (docs/02): full Life, and the vest is refilled too (free, same kind).
   * @returns {Promise<LeverageActor>}
   */
  async restDay() {
    const { life, vest } = this.system;
    if (!life) return this;
    return this.update({ "system.life.value": life.max, "system.vest.value": vest.max });
  }

  /**
   * Medical treatment (docs/02): pays the `hospital` price (d4 by default) and restores all Life. Crew only.
   * @returns {Promise<{ok: boolean, shortBy: number}>} `ok` false when Money is short (nothing changes).
   */
  async medicalTreatment() {
    if (this.type !== "crew") return { ok: false, shortBy: 0 };
    const paid = await this.money.pay(getPriceDice("hospital"));
    if (paid.ok) await this.update({ "system.life.value": this.system.life.max });
    return { ok: paid.ok, shortBy: paid.shortBy ?? 0 };
  }

  /**
   * Buys a vest of `kind` (price list: light d4, standard d6, heavy d8) and puts it on, full. Crew only.
   * @param {string} kind Key of `LEVERAGE.vestKinds` other than `none`.
   * @returns {Promise<{ok: boolean, shortBy: number}>} Nothing changes when Money is short.
   */
  async buyVest(kind) {
    const def = LEVERAGE.vestKinds[kind];
    if (this.type !== "crew" || !def?.priceId) return { ok: false, shortBy: 0 };
    const paid = await this.money.pay(getPriceDice(def.priceId));
    if (paid.ok) await this.update({ "system.vest.kind": kind, "system.vest.value": def.points });
    return { ok: paid.ok, shortBy: paid.shortBy ?? 0 };
  }

  /**
   * Replaces the current vest with a new one of the same kind (pays its price). No-op without a vest.
   * @returns {Promise<{ok: boolean, shortBy: number}>}
   */
  restoreVest() {
    return this.buyVest(this.system.vest?.kind);
  }

  /** @override */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;
    if (this.type === "crew") this.#seedCrewStart(data);
  }

  /** Fills starting Money and Life from the world settings when the creation data does not set them. */
  #seedCrewStart(data) {
    const update = {};
    if (!foundry.utils.hasProperty(data, "system.money.steps")) {
      update["system.money.steps"] = money.clampSteps(readSetting("moneyStart", LEVERAGE.money.startSteps));
    }
    if (!foundry.utils.hasProperty(data, "system.life.value")) {
      const base = readSetting("lifeBase", LEVERAGE.lifeBase);
      update["system.life.value"] = maxLife(this.system.attributes.vitality.die, base);
    }
    if (Object.keys(update).length) this.updateSource(update);
  }

  /** @override */
  async _preUpdate(changes, options, user) {
    const allowed = await super._preUpdate(changes, options, user);
    if (allowed === false) return false;
    const touchesTraits = LEVERAGE.traitSystemKeys.some((key) => foundry.utils.hasProperty(changes, `system.${key}`));
    if (touchesTraits && !canEditTraits(user)) {
      warnUser(user, "LEVERAGE.Warn.traitsLocked");
      return false;
    }
  }

  /**
   * Batch creation of embedded Items: checks the lock and counts the whole batch against the Distinction cap
   * before anything is sent (LeverageItem#_preCreate only sees one item at a time). The GM always passes.
   * @override
   */
  async createEmbeddedDocuments(embeddedName, data = [], operation = {}) {
    if (embeddedName === "Item" && data.length > 1) {
      const check = checkItemBatch(this, data, game.user);
      if (!check.ok) {
        warnBatchFailure(game.user, check.reason);
        return [];
      }
    }
    return super.createEmbeddedDocuments(embeddedName, data, operation);
  }
}
