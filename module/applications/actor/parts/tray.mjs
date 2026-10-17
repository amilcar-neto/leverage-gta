/**
 * Crew sheet - Pool tray part (docs/06, docs/08). Owns the `DicePool` of each open sheet (client state, one per
 * sheet in a WeakMap), the tray context, and the click actions. The real roll is T-502: ROLL only announces the
 * Pool with the `leverage.rollRequested` hook.
 *
 * Feedback without a full re-render: a click re-renders only the `tray` part and `afterRender` (called by the
 * sheet after every render) toggles `.is-pooled` on the rows (matched by `data-pool-ref`) of every part.
 */
import { LEVERAGE } from "../../../config.mjs";
import { DicePool, resolvePoolRef } from "../../../dice/pool.mjs";
import { isValidDie } from "../../../dice/die.mjs";
import { readSetting } from "../../../data/fields.mjs";
import { renderDie, escapeHtml } from "../../components/die.mjs";
import { closeFloatMenu, openFloatMenu } from "../../components/float-menu.mjs";
import { t } from "../../components/i18n.mjs";

/** Elements where Enter keeps its own meaning (so it does not roll the Pool). */
const INTERACTIVE = "button, input, textarea, select, a, prose-mirror, [contenteditable], [role='button'], [role='menu']";

/** Hook announcing a Pool the player wants to roll. Payload: `{ actor, sheet, refs, entries }`. */
export const ROLL_REQUESTED_HOOK = "leverage.rollRequested";

/** Hook fired when the active Job changes (its Scene Traits feed the "+ DIE" menu). */
const ACTIVE_JOB_HOOK = "leverage.activeJobChanged";

/** Pool of each open sheet. */
const pools = new WeakMap();

/** Whether the Money house rule is on (safe before settings are ready). */
const moneyEnabled = () => Boolean(readSetting("houseRules.money", true));

/** Scene Traits of the active Job (`{id, name, die}`), empty when there is no Job. */
const sceneTraits = () => {
  const list = readSetting("activeJob", null)?.sceneTraits;
  return Array.isArray(list) ? list.filter((x) => x?.id && isValidDie(x.die)) : [];
};

/**
 * The Pool of a sheet, created on first use. Other tasks (roll, macros) read it through this.
 * @param {ApplicationV2} sheet A crew sheet.
 * @returns {DicePool}
 */
export function poolOf(sheet) {
  let pool = pools.get(sheet);
  if (!pool) {
    pool = new DicePool((ref) => resolvePoolRef(sheet.actor, ref, { moneyEnabled: moneyEnabled(), sceneTraits: sceneTraits() }));
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
  const cycles = entry.kind === "distinction" && !entry.hinders;
  const title = [name, entry.warn && t(`LEVERAGE.Sheet.Tray.warn.${entry.warn}`),
    entry.blank && t("LEVERAGE.Sheet.Tray.problem.blank"), t(`LEVERAGE.Sheet.Tray.${cycles ? "cycleDistinction" : "remove"}`)].filter(Boolean).join("\n");
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
  const entries = pool.entries();
  const chips = entries.map((entry) => chipOf(entry, t));
  const problems = pool.problems;
  return {
    count: entries.filter((entry) => !entry.blank).length,
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

/** Adds the Pool to the sheet context (`context.pool`); the Pool is read once per render. */
export async function prepare(context, sheet) {
  context.pool = trayContext(poolOf(sheet), t);
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

/* --------------------------------------------------------------- listeners */

/** Enter on a sheet that is not on a button or field rolls the Pool. */
function onEnter(sheet, event) {
  if (event.key !== "Enter" || event.target.closest(INTERACTIVE)) return;
  actions.roll.call(sheet);
}

/**
 * Listeners of the tray, registered once per sheet: Enter rolls. The Pool is forgotten when the sheet closes.
 * @param {ApplicationV2} sheet The crew sheet.
 * @param {AbortSignal} signal Aborted when the sheet closes.
 */
export function attach(sheet, signal) {
  sheet.element.addEventListener("keydown", (event) => onEnter(sheet, event), { signal });
  const hookId = Hooks.on(ACTIVE_JOB_HOOK, () => {
    closeFloatMenu(sheet);
    if (sheet.rendered) refresh(sheet);
  });
  signal.addEventListener("abort", () => {
    Hooks.off(ACTIVE_JOB_HOOK, hookId);
    pools.delete(sheet);
  });
}

/** After every render: lights the rows and presses the buttons of the Pool. */
export function afterRender(sheet) {
  const pool = pools.get(sheet);
  if (pool) syncRows(sheet.element, pool);
}

/**
 * Puts a reference in the Pool of the actor's sheet, opening the sheet first when it is closed (`game.leverage.pool.add`).
 * @param {Actor} actor A Crew actor the user owns.
 * @param {string} ref Pool reference (docs/04).
 * @returns {Promise<boolean>} false when the reference means nothing for this actor.
 */
export async function addToSheetPool(actor, ref) {
  const sheet = actor.sheet;
  if (!sheet.rendered) await sheet.render({ force: true });
  const added = poolOf(sheet).add(ref);
  if (added) await refresh(sheet);
  return added;
}

/* -------------------------------------------------------------- + DIE menu */

/**
 * Entries of the "+ DIE" menu: the loose dice, Money when the actor can add it, then the Scene Traits of the active Job.
 * @param {object} actor
 * @param {boolean} withMoney The Money house rule is on.
 * @param {{id: string, name: string, die: number}[]} [scene] Scene Traits of the active Job.
 * @returns {{ref: string, die: number, label: string, money: boolean, scene?: boolean}[]} `label` is an i18n key
 *   (Money), a plain `dN` or the Scene Trait name.
 */
export function dieMenuEntries(actor, withMoney, scene = []) {
  const dice = LEVERAGE.dice.map((die) => ({ ref: `d${die}`, die, label: `d${die}`, money: false }));
  const money = withMoney ? resolvePoolRef(actor, "money") : null;
  if (money) dice.push({ ref: "money", die: money.die, label: money.nameKey, money: true });
  for (const trait of scene) dice.push({ ref: `scene:${trait.id}`, die: trait.die, label: trait.name, money: false, scene: true });
  return dice;
}

/** Opens the "+ DIE" menu above `anchor`. */
function openDieMenu(sheet, anchor) {
  openFloatMenu(sheet, {
    anchor,
    className: "lv-pool-menu",
    itemClass: "lv-pool-menu-item",
    placement: "above",
    items: dieMenuEntries(sheet.actor, moneyEnabled(), sceneTraits()).map((entry) => {
      const label = entry.money ? t(entry.label) : entry.label;
      return {
        html: `${renderDie({ die: entry.die, size: 28, money: entry.money })}<span class="lv-pool-menu-name" title="${escapeHtml(label)}">${escapeHtml(label)}</span>`,
        onSelect: () => {
          poolOf(sheet).add(entry.ref);
          refresh(sheet);
        }
      };
    })
  });
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

  /** A chip in the tray: takes it out (a Distinction d8 goes to d4 first). */
  removeFromPool(_event, target) {
    const ref = target.closest("[data-pool-ref]")?.dataset.poolRef;
    if (!ref) return;
    poolOf(this).cycle(ref);
    refresh(this);
  },

  /** "+ DIE": opens the menu of loose dice (and Money). */
  addDie(_event, target) {
    if (!this.actor.isOwner) return;
    openDieMenu(this, target);
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
