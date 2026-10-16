/**
 * LeverageActor: Actor document with Plot Point and Money helpers, the Trait lock on `system` dice and the
 * Distinction cap for batch creation (docs/04 "Trava", docs/03). Per-Item vetoes live in LeverageItem
 * (`_preCreate`/`_preUpdate`/`_preDelete` returning `false`), because the Actor's descendant hooks cannot cancel.
 */
import { LEVERAGE } from "../config.mjs";
import { readSetting } from "../data/fields.mjs";
import { maxLife } from "../rules/combat.mjs";
import * as money from "../rules/money.mjs";
import { canEditTraits, checkItemBatch, warnBatchFailure, warnUser } from "./guards.mjs";

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
