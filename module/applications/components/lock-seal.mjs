/**
 * Sheet-lock seal in the window title bar (docs/06 "Janela"). It is a button: the owner of the sheet clicks it to lock
 * or unlock their own sheet (actor flag `sheetUnlocked`). When the GM turned off `playersCanUnlock`, the seal of a
 * player is disabled and its tooltip says why. The GM sees the state too and can click it as well.
 * Used by the actor sheets and by the Item sheet (which shows the lock of the Actor that owns the Item).
 */
import { LEVERAGE, LOCK_HOOK, SHEET_UNLOCK_FLAG } from "../../config.mjs";
import { isActorLocked } from "../../documents/guards.mjs";
import { sealState } from "../../rules/sheet-lock.mjs";
import { t } from "./i18n.mjs";

export { sealState };

/** The seal button plus the lock-change subscriptions of one window. */
export class LockSeal {
  #el = null;

  #hooks = [];

  #getActor;

  #onChange;

  /**
   * @param {() => Actor|null} getActor The Actor whose lock the seal shows and flips.
   * @param {() => void} [onChange] Called after the seal refreshed itself when the lock changes (e.g. re-render).
   */
  constructor(getActor, onChange = () => {}) {
    this.#getActor = getActor;
    this.#onChange = onChange;
  }

  /**
   * Builds the seal and puts it right after the window title.
   * @param {HTMLElement} frame The window frame returned by `_renderFrame`.
   */
  mount(frame) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "lv-lock-seal";
    el.append(Object.assign(document.createElement("i"), { className: "lv-lock-seal-icon" }));
    el.append(Object.assign(document.createElement("span"), { className: "lv-lock-seal-label" }));
    el.addEventListener("click", () => this.#toggle());
    frame.querySelector(".window-title")?.after(el);
    this.#el = el;
    this.sync();
  }

  /** Flips the sheet's own lock flag (owner or GM only, and only while the policy allows it). */
  async #toggle() {
    const actor = this.#getActor();
    if (!actor || this.#el.disabled) return;
    await actor.setFlag(LEVERAGE.systemId, SHEET_UNLOCK_FLAG, isActorLocked(actor));
  }

  /** Refreshes icon, label, tooltip, disabled and state classes. No-op when not mounted. */
  sync() {
    const actor = this.#getActor();
    if (!this.#el || !actor) return;
    const playersCanUnlock = Boolean(game.settings.get(LEVERAGE.systemId, "playersCanUnlock"));
    const state = sealState({ locked: isActorLocked(actor), playersCanUnlock, isGM: game.user.isGM });
    this.#el.classList.toggle("is-locked", state.locked);
    this.#el.classList.toggle("is-unlocked", !state.locked);
    this.#el.disabled = state.disabled || !actor.isOwner;
    this.#el.title = state.hint ? t(state.hint) : "";
    this.#el.setAttribute("aria-pressed", String(!state.locked));
    this.#el.querySelector(".lv-lock-seal-icon").className = `lv-lock-seal-icon fa-solid ${state.icon}`;
    this.#el.querySelector(".lv-lock-seal-label").textContent = t(state.label);
  }

  /** Starts listening to the policy hook and to flag changes of the Actor (call once, from `_onFirstRender`). */
  watch() {
    if (this.#hooks.length) return;
    const refresh = () => {
      this.sync();
      this.#onChange();
    };
    this.#hooks.push(["leverage-lock", Hooks.on(LOCK_HOOK, refresh)]);
    this.#hooks.push(["updateActor", Hooks.on("updateActor", (actor, changes) => {
      const flags = changes?.flags?.[LEVERAGE.systemId];
      if (actor.id === this.#getActor()?.id && flags && SHEET_UNLOCK_FLAG in flags) refresh();
    })]);
  }

  /** Stops listening (call from `_onClose`). */
  unwatch() {
    for (const [name, id] of this.#hooks) Hooks.off(name === "leverage-lock" ? LOCK_HOOK : name, id);
    this.#hooks = [];
  }
}
