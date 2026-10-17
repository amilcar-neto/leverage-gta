/**
 * Crew sheet - Pool tray part (docs/06, docs/08). Owns the `DicePool` of each open sheet (client state, one per
 * sheet in a WeakMap), the tray context, and the click actions. The real roll is T-502: ROLL only announces the
 * Pool with the `leverage.rollRequested` hook.
 *
 * Feedback without a full re-render: a click re-renders only the `tray` part and a `renderCrewSheet` hook then
 * toggles `.is-pooled` on the rows (matched by `data-pool-ref`) of every part.
 */
import { LEVERAGE } from "../../../config.mjs";
import { DicePool, resolvePoolRef } from "../../../dice/pool.mjs";
import { renderDie } from "../../components/die.mjs";

/** Hook announcing a Pool the player wants to roll. Payload: `{ actor, sheet, refs, entries }`. */
export const ROLL_REQUESTED_HOOK = "leverage.rollRequested";

/** CSS class of the floating "+ DIE" menu. */
const MENU_CLASS = "lv-pool-menu";

/** Pool of each open sheet. */
const pools = new WeakMap();

/** Whether the page-wide hooks were registered. */
let hooked = false;

/** Whether the Money house rule is on (safe before settings are ready). */
function moneyEnabled() {
  try {
    return Boolean(game.settings.get(LEVERAGE.systemId, "houseRules.money") ?? true);
  } catch {
    return true;
  }
}

/**
 * The Pool of a sheet, created on first use. Other tasks (roll, macros) read it through this.
 * @param {ApplicationV2} sheet A crew sheet.
 * @returns {DicePool}
 */
export function poolOf(sheet) {
  let pool = pools.get(sheet);
  if (!pool) {
    pool = new DicePool((ref) => resolvePoolRef(sheet.actor, ref, { moneyEnabled: moneyEnabled() }));
    pools.set(sheet, pool);
  }
  return pool;
}

/* ------------------------------------------------------------------ context */

/**
 * Template data of one chip.
 * @param {import("../../../dice/pool.mjs").PoolEntry} entry
 * @param {(key: string, data?: object) => string} t translate function
 * @returns {object}
 */
export function chipOf(entry, t) {
  const name = entry.nameKey ? t(entry.nameKey) : entry.name;
  const title = [name, entry.warn && t(`LEVERAGE.Sheet.Tray.warn.${entry.warn}`),
    entry.blank && t("LEVERAGE.Sheet.Tray.problem.blank"), t("LEVERAGE.Sheet.Tray.remove")].filter(Boolean).join("\n");
  return {
    ref: entry.ref, name, title, die: entry.die, kind: entry.kind, optional: entry.optional,
    kindLabel: t(`LEVERAGE.Sheet.Tray.kind.${entry.kind}`), money: entry.kind === "money",
    problem: entry.blank, warn: Boolean(entry.warn)
  };
}

/**
 * Template data of the tray: count, the two required chips, the optional chips and the ROLL state.
 * @param {DicePool} pool
 * @param {(key: string, data?: object) => string} t translate function
 * @returns {object}
 */
export function trayContext(pool, t) {
  const chips = pool.entries().map((entry) => chipOf(entry, t));
  const problems = pool.problems;
  return {
    count: pool.count,
    keep: pool.keep,
    empty: chips.length === 0,
    attribute: chips.find((c) => c.kind === "attribute") ?? null,
    role: chips.find((c) => c.kind === "role") ?? null,
    optional: chips.filter((c) => c.optional),
    canRoll: problems.length === 0,
    rollTitle: problems.length ? problems.map((p) => t(`LEVERAGE.Sheet.Tray.problem.${p}`)).join("\n") : "",
    required: {
      attribute: { kindLabel: t("LEVERAGE.Sheet.Tray.kind.attribute") },
      role: { kindLabel: t("LEVERAGE.Sheet.Tray.kind.role") }
    }
  };
}

/** Adds the Pool to the sheet context (`context.pool`) and makes sure the page hooks exist. */
export async function prepare(context, sheet) {
  registerHooks();
  context.pool = trayContext(poolOf(sheet), (key, data) => game.i18n.format(key, data));
}

/* -------------------------------------------------------------------- rows */

/**
 * Lights the rows of the Pool and presses the buttons that match `data-pool-ref`, without rendering.
 * @param {HTMLElement} root The sheet element.
 * @param {DicePool} pool
 */
export function syncRows(root, pool) {
  const rows = new Map();
  for (const el of root.querySelectorAll("[data-pool-ref]")) {
    if (el.closest(".lv-tray")) continue;
    const on = pool.has(el.dataset.poolRef);
    if (el.hasAttribute("aria-pressed")) el.setAttribute("aria-pressed", String(on));
    const row = el.closest(".lv-row");
    if (row) rows.set(row, rows.get(row) || on);
  }
  for (const [row, on] of rows) {
    row.classList.toggle("is-pooled", on);
    const buttons = row.querySelectorAll(".lv-pool-btn[data-pool-ref]");
    if (buttons.length < 2) continue;
    for (const button of buttons) {
      button.querySelector(".lv-die")?.classList.toggle("lv-die--deep", on && !pool.has(button.dataset.poolRef));
    }
  }
}

/** Re-renders the tray only and updates the rows right away. */
function refresh(sheet) {
  syncRows(sheet.element, poolOf(sheet));
  return sheet.render({ parts: ["tray"] });
}

/* ------------------------------------------------------------------- hooks */

/** Enter on a sheet that is not on a button or field rolls the Pool. */
function onEnter(sheet, event) {
  if (event.key !== "Enter" || event.target.closest("button, input, textarea, select, a, prose-mirror, [contenteditable]")) return;
  actions.roll.call(sheet);
}

/** Registers (once) the hooks that keep rows in sync after any render and drop the Pool when the sheet closes. */
function registerHooks() {
  if (hooked) return;
  hooked = true;
  Hooks.on("renderCrewSheet", (sheet, element) => {
    const pool = pools.get(sheet);
    if (!pool) return;
    syncRows(element, pool);
    if (element.dataset.poolKeys) return;
    element.dataset.poolKeys = "1";
    element.addEventListener("keydown", (event) => onEnter(sheet, event));
  });
  Hooks.on("closeCrewSheet", (sheet) => pools.delete(sheet));
}

/* -------------------------------------------------------------- + DIE menu */

/** Closes the "+ DIE" menu of this sheet. */
function closeMenu(sheet) {
  sheet.element?.querySelectorAll(`.${MENU_CLASS}`).forEach((menu) => menu.remove());
}

/**
 * Entries of the "+ DIE" menu: the loose dice, plus Money when the actor can add it.
 * @param {object} actor
 * @param {boolean} withMoney The Money house rule is on.
 * @returns {{ref: string, die: number, label: string, money: boolean}[]} `label` is an i18n key or a plain `dN`.
 */
export function dieMenuEntries(actor, withMoney) {
  const dice = LEVERAGE.dice.map((die) => ({ ref: `d${die}`, die, label: `d${die}`, money: false }));
  const money = withMoney ? resolvePoolRef(actor, "money") : null;
  if (money) dice.push({ ref: "money", die: money.die, label: money.nameKey, money: true });
  return dice;
}

/** Builds the floating menu above `anchor`. */
function buildMenu(sheet, anchor) {
  const menu = Object.assign(document.createElement("div"), { className: MENU_CLASS });
  menu.setAttribute("role", "menu");
  for (const entry of dieMenuEntries(sheet.actor, moneyEnabled())) {
    const button = Object.assign(document.createElement("button"), { type: "button", className: "lv-pool-menu-item" });
    button.setAttribute("role", "menuitem");
    const label = entry.label.startsWith("LEVERAGE.") ? game.i18n.localize(entry.label) : entry.label;
    button.innerHTML = `${renderDie({ die: entry.die, size: 28, money: entry.money })}<span>${foundry.utils.escapeHTML(label)}</span>`;
    button.addEventListener("click", () => {
      closeMenu(sheet);
      poolOf(sheet).add(entry.ref);
      refresh(sheet);
    });
    menu.append(button);
  }
  const frame = sheet.element.getBoundingClientRect();
  const box = anchor.getBoundingClientRect();
  menu.style.left = `${Math.round(box.left - frame.left)}px`;
  menu.style.bottom = `${Math.round(frame.bottom - box.top + 4)}px`;
  return menu;
}

/** Closes the menu on the next outside click or Escape. */
function dismissOnOutside(sheet, menu) {
  const off = () => {
    closeMenu(sheet);
    document.removeEventListener("pointerdown", onDown, true);
    document.removeEventListener("keydown", onKey, true);
  };
  const onDown = (event) => { if (!menu.contains(event.target)) off(); };
  const onKey = (event) => { if (event.key === "Escape") off(); };
  document.addEventListener("pointerdown", onDown, true);
  document.addEventListener("keydown", onKey, true);
}

/* ----------------------------------------------------------------- actions */

/** @type {Record<string, Function>} ApplicationV2 `data-action` handlers (called with `this` = the sheet). */
export const actions = {
  /** A Trait name or die on the sheet: in the Pool, or out when it was already there. */
  togglePool(_event, target) {
    const ref = target.closest("[data-pool-ref]")?.dataset.poolRef;
    if (!ref || !this.actor.isOwner) return;
    poolOf(this).toggle(ref);
    refresh(this);
  },

  /** A chip in the tray: takes it out. */
  removeFromPool(_event, target) {
    const ref = target.closest("[data-pool-ref]")?.dataset.poolRef;
    if (!ref) return;
    poolOf(this).remove(ref);
    refresh(this);
  },

  /** "+ DIE": opens the menu of loose dice (and Money). */
  addDie(_event, target) {
    if (!this.actor.isOwner) return;
    closeMenu(this);
    const menu = buildMenu(this, target);
    this.element.append(menu);
    dismissOnOutside(this, menu);
  },

  /** Empties the Pool. */
  clearPool() {
    poolOf(this).clear();
    refresh(this);
  },

  /** ROLL: announces the Pool when it is legal (the roll itself is T-502). */
  roll() {
    const pool = poolOf(this);
    if (!this.actor.isOwner || !pool.canRoll) return;
    Hooks.callAll(ROLL_REQUESTED_HOOK, { actor: this.actor, sheet: this, refs: pool.refs, entries: pool.entries() });
  }
};
