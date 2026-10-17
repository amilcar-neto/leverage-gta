/**
 * Trait-lock seal in the window title bar (docs/06 "Janela"). One rule for every sheet that shows it:
 * the seal mirrors the `traitsLocked` world setting. The GM sees the real state too, but its tooltip says the GM
 * can always edit. Used by the actor sheets and by the Item sheet.
 */
import { LOCK_HOOK } from "../../config.mjs";
import { LeverageActor } from "../../documents/actor.mjs";
import { t } from "./i18n.mjs";

/**
 * What the seal shows.
 * @param {boolean} locked Whether the `traitsLocked` setting is on.
 * @param {boolean} isGM Whether the viewer is a GM.
 * @returns {{locked: boolean, icon: string, label: string, hint: string}} `label` and `hint` are i18n keys.
 */
export function sealState(locked, isGM) {
  const key = locked ? "locked" : "unlocked";
  const hint = locked && isGM ? "lockedGmHint" : `${key}Hint`;
  return {
    locked,
    icon: locked ? "fa-lock" : "fa-lock-open",
    label: `LEVERAGE.Sheet.Seal.${key}`,
    hint: `LEVERAGE.Sheet.Seal.${hint}`
  };
}

/** The seal element plus the lock-change subscription of one window. */
export class LockSeal {
  #el = null;

  #hookId = null;

  #onChange;

  /** @param {() => void} [onChange] Called after the seal refreshed itself when the lock changes (e.g. re-render). */
  constructor(onChange = () => {}) {
    this.#onChange = onChange;
  }

  /**
   * Builds the seal and puts it right after the window title.
   * @param {HTMLElement} frame The window frame returned by `_renderFrame`.
   */
  mount(frame) {
    const el = document.createElement("span");
    el.className = "lv-lock-seal";
    el.append(Object.assign(document.createElement("i"), { className: "lv-lock-seal-icon" }));
    el.append(Object.assign(document.createElement("span"), { className: "lv-lock-seal-label" }));
    frame.querySelector(".window-title")?.after(el);
    this.#el = el;
    this.sync();
  }

  /** Refreshes icon, label, tooltip and state classes from the setting. No-op when not mounted. */
  sync() {
    if (!this.#el) return;
    const state = sealState(LeverageActor.traitsLocked, game.user.isGM);
    this.#el.classList.toggle("is-locked", state.locked);
    this.#el.classList.toggle("is-unlocked", !state.locked);
    this.#el.title = t(state.hint);
    this.#el.querySelector(".lv-lock-seal-icon").className = `lv-lock-seal-icon fa-solid ${state.icon}`;
    this.#el.querySelector(".lv-lock-seal-label").textContent = t(state.label);
  }

  /** Starts listening to the lock hook (call once, from `_onFirstRender`). */
  watch() {
    if (this.#hookId !== null) return;
    this.#hookId = Hooks.on(LOCK_HOOK, () => {
      this.sync();
      this.#onChange();
    });
  }

  /** Stops listening (call from `_onClose`). */
  unwatch() {
    if (this.#hookId !== null) Hooks.off(LOCK_HOOK, this.#hookId);
    this.#hookId = null;
  }
}
