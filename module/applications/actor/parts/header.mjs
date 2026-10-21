/**
 * Crew sheet — header part: mugshot picker, Life/Vest popovers and the extra template context.
 * Name, alias and Booking Card fields are plain named inputs: the sheet form submits them on change (blur/Enter).
 */
import { LEVERAGE } from "../../../config.mjs";
import { readSetting } from "../../../data/fields.mjs";

/** Vitals that have a popover. */
const VITALS = Object.freeze(["life", "vest"]);

/** Open popover per sheet: `"life"` or `"vest"` (absent when closed). */
const openState = new WeakMap();

/** Hook fired by the house-rule settings. */
const HOUSE_RULES_HOOK = LEVERAGE.hooks.houseRulesChanged;

/**
 * Keeps a vital value inside 0..max (whole numbers only).
 * @param {number} value Wanted value.
 * @param {number} max Maximum allowed.
 * @returns {number}
 */
export function clampVital(value, max) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.min(Math.max(n, 0), Math.max(Number(max) || 0, 0));
}

/**
 * Update data for changing the vest kind: a new kind comes with a full vest, "none" empties it.
 * @param {string} kind Key of `LEVERAGE.vestKinds`.
 * @returns {object|null} Flat update data, or null when the kind is unknown.
 */
export function vestKindUpdate(kind) {
  const def = LEVERAGE.vestKinds[kind];
  return def ? { "system.vest.kind": kind, "system.vest.value": def.points } : null;
}

/** True when the Life/Vest house rule is on (safe before settings are ready). */
export function vitalsEnabled() {
  return Boolean(readSetting("houseRules.life", true));
}

/** Re-renders only the header part. */
const refresh = (sheet) => sheet.render({ parts: ["header"] });

/** Closes the popover. */
function closePopover(sheet) {
  openState.delete(sheet);
  if (sheet.rendered) refresh(sheet);
}

/**
 * Writes a new value of a vital. An update re-renders the whole sheet by itself; the header is only redrawn here
 * when nothing changed (so a typed, clamped number goes back to the real value).
 */
async function setVital(sheet, key, wanted) {
  const { value, max } = sheet.actor.system[key];
  const next = clampVital(wanted, max);
  if (next === value) return refresh(sheet);
  await sheet.actor.update({ [`system.${key}.value`]: next });
}

/** Applies a typed value from a popover input. */
function onVitalInput(sheet, event) {
  const input = event.target.closest?.("[data-vital-input]");
  if (!input || !sheet.isEditable) return;
  return setVital(sheet, input.dataset.vitalInput, input.value);
}

/**
 * Listeners of the header, registered once per sheet: outside click and Escape close the popover, typed values
 * are applied, and the house-rule hook redraws the header.
 * @param {ApplicationV2} sheet The crew sheet.
 * @param {AbortSignal} signal Aborted when the sheet closes.
 */
export function attach(sheet, signal) {
  document.addEventListener("pointerdown", (event) => {
    if (openState.has(sheet) && !event.target.closest?.(".lv-vital")) closePopover(sheet);
  }, { signal });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openState.has(sheet)) closePopover(sheet);
  }, { signal });
  sheet.element.addEventListener("change", (event) => onVitalInput(sheet, event), { signal });
  const hookId = Hooks.on(HOUSE_RULES_HOOK, () => {
    if (sheet.rendered) refresh(sheet);
  });
  signal.addEventListener("abort", () => {
    Hooks.off(HOUSE_RULES_HOOK, hookId);
    openState.delete(sheet);
  });
}

/** ApplicationV2 `data-action` handlers (called with `this` = the sheet). */
export const actions = {
  /** Mugshot click: opens the Foundry FilePicker and stores the chosen image on the actor. */
  pickPhoto() {
    if (!this.isEditable) return;
    const picker = new foundry.applications.apps.FilePicker.implementation({
      type: "image",
      current: this.actor.img,
      callback: (path) => this.actor.update({ img: path })
    });
    return picker.render({ force: true });
  },

  /** Opens or closes the Life/Vest popover. */
  toggleVital(event, target) {
    const key = target.dataset.vital;
    if (!VITALS.includes(key) || !this.isEditable) return;
    if (openState.get(this) === key) return closePopover(this);
    openState.set(this, key);
    return refresh(this);
  },

  /** The − / + buttons in a popover. */
  adjustVital(event, target) {
    const key = target.dataset.vital;
    if (!VITALS.includes(key) || !this.isEditable) return;
    return setVital(this, key, this.actor.system[key].value + Number(target.dataset.delta));
  },

  /** A vest kind button in the Vest popover. The Fixer sets it for free; a player buys it with Money. */
  async setVestKind(event, target) {
    if (!this.isEditable) return;
    const kind = target.dataset.kind;
    const vest = this.actor.system.vest;
    if (game.user.isGM) {
      const data = vestKindUpdate(kind);
      if (data && kind !== vest.kind) await this.actor.update(data);
      return;
    }
    if (!vestKindUpdate(kind) || (kind === vest.kind && vest.value >= vest.max)) return;
    const paid = await this.actor.buyVest(kind);
    if (!paid.ok) ui.notifications.warn(game.i18n.format("LEVERAGE.Money.Pay.short", { n: paid.shortBy }));
  }
};

/**
 * Adds data the header template needs to the sheet context.
 * @param {object} context The context being built.
 * @param {object} sheet The CrewSheet.
 */
export async function prepare(context, sheet) {
  const open = openState.get(sheet);
  const current = context.system.vest.kind;
  Object.assign(context, {
    showVitals: vitalsEnabled(),
    openLife: open === "life",
    openVest: open === "vest",
    vestKinds: Object.entries(LEVERAGE.vestKinds).filter(([, def]) => def.points > 0)
      .map(([key, def]) => ({ key, label: def.label, points: def.points, active: key === current })),
    bookingNumber: context.booking.find((f) => f.key === "number") ?? { key: "number", value: "" },
    bookingFields: context.booking.filter((f) => f.key !== "number")
  });
}
