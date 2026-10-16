/**
 * Crew sheet — header part: mugshot picker, Life/Vest popovers and the extra template context.
 * Name, alias and Booking Card fields are plain named inputs: the sheet form submits them on change (blur/Enter).
 */
import { LEVERAGE } from "../../../config.mjs";

/** Vitals that have a popover. */
const VITALS = Object.freeze(["life", "vest"]);

/** Open popover per sheet (`"life"`, `"vest"` or absent), plus the listeners that close it. */
const openState = new WeakMap();

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
  try {
    return Boolean(game?.settings?.get(LEVERAGE.systemId, "houseRules.life") ?? true);
  } catch {
    return true;
  }
}

/** Re-renders only the header part. */
const refresh = (sheet) => sheet.render({ parts: ["header"] });

/** Closes the popover and removes the listeners tied to it. */
function closePopover(sheet) {
  const state = openState.get(sheet);
  state?.abort?.abort();
  openState.delete(sheet);
  if (sheet.rendered) refresh(sheet);
}

/** Applies a typed value from a popover input. */
async function onVitalInput(sheet, event) {
  const input = event.target.closest?.("[data-vital-input]");
  if (!input || !sheet.isEditable) return;
  const key = input.dataset.vitalInput;
  const max = sheet.actor.system[key].max;
  await sheet.actor.update({ [`system.${key}.value`]: clampVital(input.value, max) });
  refresh(sheet);
}

/** Starts the listeners that close the popover (outside click, Escape) and handle typed values. */
function openPopover(sheet, key) {
  const abort = new AbortController();
  const { signal } = abort;
  openState.get(sheet)?.abort?.abort();
  openState.set(sheet, { key, abort });
  document.addEventListener("pointerdown", (event) => {
    if (!sheet.rendered) return abort.abort();
    if (!event.target.closest?.(".lv-vital")) closePopover(sheet);
  }, { signal });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closePopover(sheet); }, { signal });
  sheet.element.addEventListener("change", (event) => onVitalInput(sheet, event), { signal });
  refresh(sheet);
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
    if (openState.get(this)?.key === key) return closePopover(this);
    return openPopover(this, key);
  },

  /** The − / + buttons in a popover. */
  async adjustVital(event, target) {
    const key = target.dataset.vital;
    if (!VITALS.includes(key) || !this.isEditable) return;
    const { value, max } = this.actor.system[key];
    const next = clampVital(value + Number(target.dataset.delta), max);
    if (next !== value) await this.actor.update({ [`system.${key}.value`]: next });
    return refresh(this);
  },

  /** A vest kind button in the Vest popover. */
  async setVestKind(event, target) {
    if (!this.isEditable) return;
    const data = vestKindUpdate(target.dataset.kind);
    if (data && target.dataset.kind !== this.actor.system.vest.kind) await this.actor.update(data);
    return refresh(this);
  }
};

/**
 * Adds data the header template needs to the sheet context.
 * @param {object} context The context being built.
 * @param {object} sheet The CrewSheet.
 */
export async function prepare(context, sheet) {
  const open = openState.get(sheet)?.key;
  const current = context.system.vest.kind;
  Object.assign(context, {
    canEditHeader: sheet.isEditable,
    showVitals: vitalsEnabled(),
    openLife: open === "life",
    openVest: open === "vest",
    vestKinds: Object.entries(LEVERAGE.vestKinds).filter(([, def]) => def.points > 0)
      .map(([key, def]) => ({ key, label: def.label, points: def.points, active: key === current })),
    bookingNumber: context.booking.find((f) => f.key === "number") ?? { key: "number", value: "" },
    bookingFields: context.booking.filter((f) => f.key !== "number")
  });
}

/** Houserule toggled: redraw the header of every open crew sheet. */
if (typeof Hooks !== "undefined") {
  Hooks.on("leverage.houseRulesChanged", () => {
    for (const app of foundry.applications.instances.values()) {
      if (app.rendered && app.options.classes?.includes("crew-sheet")) app.render({ parts: ["header"] });
    }
  });
}
