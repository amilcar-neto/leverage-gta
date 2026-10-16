/**
 * LeverageActor: Actor document with Plot Point and Money helpers, the Distinction cap and the Trait lock
 * (docs/04 "Trava", docs/03). The lock is enforced here, not only in the UI.
 */
import { LEVERAGE, SYSTEM_ID } from "../config.mjs";
import * as money from "../rules/money.mjs";

/** Item types that are Traits (locked by `traitsLocked`). Assets and Jobs are always free. */
export const TRAIT_ITEM_TYPES = Object.freeze(["distinction", "talent", "specialty"]);

/** Top-level `system` keys that are Traits (die values edited on the sheet). */
const TRAIT_SYSTEM_KEYS = Object.freeze(["attributes", "roles"]);

/** Shows a localized warning, if the UI exists. */
function warn(key, data) {
  const i18n = game.i18n;
  ui.notifications?.warn(data ? i18n.format(key, data) : i18n.localize(key));
}

export class LeverageActor extends Actor {
  /** Whether the world setting currently locks Traits. */
  static get traitsLocked() {
    return game.settings.get(SYSTEM_ID, "traitsLocked");
  }

  /**
   * Whether `user` may create/remove/change Traits (GM always; others only when unlocked).
   * @param {User} [user]
   * @returns {boolean}
   */
  static canEditTraits(user = game.user) {
    return Boolean(user?.isGM) || !LeverageActor.traitsLocked;
  }

  /** @override */
  getRollData() {
    return this.system.getRollData?.() ?? super.getRollData();
  }

  /**
   * Adds (or removes, when negative) Plot Points; never below 0.
   * @param {number} n
   * @returns {Promise<LeverageActor>}
   */
  async addPlotPoints(n) {
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
    return {
      steps: steps(),
      dice: money.stepsToDice(steps()),
      canAfford: (price) => money.canAfford(steps(), price),
      /** Adds steps (capped); resolves to the steps that actually fit. */
      add: async (amount) => {
        const { steps: next, gained } = money.earn(steps(), amount);
        await save(next);
        return gained;
      },
      /** Pays a price in steps; resolves to `{ok, steps, shortBy}`. Nothing is spent when short. */
      pay: async (price) => {
        const result = money.pay(steps(), price);
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
  async _preUpdate(changes, options, user) {
    const allowed = await super._preUpdate(changes, options, user);
    if (allowed === false) return false;
    const touchesTraits = TRAIT_SYSTEM_KEYS.some((key) => foundry.utils.hasProperty(changes, `system.${key}`));
    if (touchesTraits && !LeverageActor.canEditTraits(user)) {
      warn("LEVERAGE.Warn.traitsLocked");
      return false;
    }
  }

  /** @override */
  async _preCreateDescendantDocuments(parent, collection, data, options, userId) {
    const allowed = await super._preCreateDescendantDocuments(parent, collection, data, options, userId);
    if (allowed === false || collection !== "items" || parent !== this) return allowed;
    const traits = data.filter((d) => TRAIT_ITEM_TYPES.includes(d.type));
    if (traits.length && !LeverageActor.canEditTraits(game.users.get(userId))) {
      warn("LEVERAGE.Warn.traitsLocked");
      return false;
    }
    const incoming = data.filter((d) => d.type === "distinction").length;
    const existing = this.items.filter((i) => i.type === "distinction").length;
    if (incoming && existing + incoming > LEVERAGE.maxDistinctions) {
      warn("LEVERAGE.Warn.maxDistinctions", { max: LEVERAGE.maxDistinctions });
      return false;
    }
  }

  /** @override */
  async _preUpdateDescendantDocuments(parent, collection, changes, options, userId) {
    const allowed = await super._preUpdateDescendantDocuments(parent, collection, changes, options, userId);
    if (allowed === false || collection !== "items" || parent !== this) return allowed;
    const ids = changes.map((c) => c._id);
    const touched = ids.some((id) => TRAIT_ITEM_TYPES.includes(this.items.get(id)?.type));
    if (touched && !LeverageActor.canEditTraits(game.users.get(userId))) {
      warn("LEVERAGE.Warn.traitsLocked");
      return false;
    }
  }

  /** @override */
  async _preDeleteDescendantDocuments(parent, collection, ids, options, userId) {
    const allowed = await super._preDeleteDescendantDocuments(parent, collection, ids, options, userId);
    if (allowed === false || collection !== "items" || parent !== this) return allowed;
    const touched = ids.some((id) => TRAIT_ITEM_TYPES.includes(this.items.get(id)?.type));
    if (touched && !LeverageActor.canEditTraits(game.users.get(userId))) {
      warn("LEVERAGE.Warn.traitsLocked");
      return false;
    }
  }
}
