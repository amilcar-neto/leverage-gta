/**
 * Wanted level window of the Fixer (docs/09 "Nivel de procurado", docs/02 "Estrelas"): the level 0-5, the city, the
 * police Pool, and the actions that move the stars (raise, wait, disguise, buy silence, last resort) with the rules of
 * the current city in tooltips. The actions live in `stars-actions.mjs`; this window only collects the inputs.
 * It reuses the look of the opposition roller window (`lv-opposition`).
 */
import { LEVERAGE, SYSTEM_ID } from "../../config.mjs";
import { readSetting } from "../../data/fields.mjs";
import { bailAllowed, getCityScale, lastResortKind, mainDie, policePool, poolText } from "../../rules/stars.mjs";
import { getCityScales, readWanted } from "../../world-state.mjs";
import { escapeHtml } from "../components/die.mjs";
import { t } from "../components/i18n.mjs";
import { setWanted } from "./controls.mjs";
import * as starsActions from "./stars-actions.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const WATCHED_SETTINGS = new Set(["wanted", "cityScales", "houseRules.stars"].map((key) => `${SYSTEM_ID}.${key}`));

/**
 * Tooltips with the rules of a city, read from its scale.
 * @param {object} scale City scale.
 * @returns {{wait: string, disguise: string, silence: string, silenceOn: boolean, perScene: boolean, sketch: boolean}}
 */
export function cityRuleTips(scale) {
  const perScene = Boolean(scale.wait);
  const wait = perScene ? t("LEVERAGE.Stars.Dialog.waitTipScene", { scenes: scale.wait }) : t("LEVERAGE.Stars.Dialog.waitTipSession");
  const sketch = Boolean(scale.sketchBlocksDisguise);
  const disguise = scale.disguise === "clear"
    ? t("LEVERAGE.Stars.Dialog.disguiseTipClear")
    : t("LEVERAGE.Stars.Dialog.disguiseTipLower", { one: scale.disguise ?? 1, both: scale.disguiseBoth ?? scale.disguise ?? 1 })
      + (sketch ? t("LEVERAGE.Stars.Dialog.disguiseTipSketch") : "");
  const offer = starsActions.silenceOffer(scale.id, [scale]);
  const silence = offer
    ? t("LEVERAGE.Stars.Dialog.silenceTip", { die: `d${offer.die}`, stars: offer.starsPerDie })
    : t("LEVERAGE.Stars.Dialog.silenceNone");
  return { wait, disguise, silence, silenceOn: Boolean(offer), perScene, sketch };
}

/** Wanted level window. One instance at a time. */
export class WantedDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: "leverage-wanted-dialog",
    classes: ["leverage-gta", "lv-opposition", "lv-wanted"],
    tag: "div",
    window: { title: "LEVERAGE.Stars.Dialog.title", icon: "fa-solid fa-star", resizable: false },
    position: { width: 420, height: "auto", left: 90, top: 120 },
    actions: {
      setLevel: WantedDialog.#onSetLevel, raise: WantedDialog.#onRaise, wait: WantedDialog.#onWait,
      disguise: WantedDialog.#onDisguise, buySilence: WantedDialog.#onBuySilence, lastResort: WantedDialog.#onLastResort
    }
  };

  /** @override */
  static PARTS = { body: { template: `systems/${SYSTEM_ID}/templates/gm/wanted-dialog.hbs` } };

  /** The one open instance. */
  static #instance = null;

  /** Character picked for buy silence / the last resort. */
  #actorId = "";

  /** @type {[string, number][]} */
  #hooks = [];

  /** Opens the window, or brings the open one to the front. @returns {Promise<WantedDialog>} */
  static async open() {
    WantedDialog.#instance ??= new WantedDialog();
    await WantedDialog.#instance.render({ force: true });
    WantedDialog.#instance.bringToFront();
    return WantedDialog.#instance;
  }

  /** @override */
  async _prepareContext() {
    const wanted = readWanted();
    const scales = getCityScales();
    const scale = getCityScale(wanted.city, scales);
    const { level } = wanted;
    const crew = game.actors.filter((a) => a.type === "crew").map((a) => ({ id: a.uuid, name: a.name, selected: a.uuid === this.#actorId }));
    return {
      level, rulesOn: Boolean(readSetting("houseRules.stars", true)),
      stars: Array.from({ length: LEVERAGE.stars.max + 1 }, (_, n) => {
        const die = mainDie(scale.id, n, scales);
        return { n, on: n === level, die: die ? `d${die}` : "", tip: poolText(policePool(scale.id, n, scales)) || t("LEVERAGE.Stars.Dialog.none") };
      }),
      cities: scales.map((c) => ({ id: c.id, name: c.name, selected: c.id === scale.id })),
      pool: poolText(policePool(scale.id, level, scales)) || t("LEVERAGE.Stars.Dialog.none"), bail: bailAllowed(scale.id, scales),
      tips: cityRuleTips(scale), crew, hasCrew: crew.length > 0, raiseTip: t("LEVERAGE.Stars.Dialog.raiseTip"),
      lastResort: this.#lastResortContext(scale, crew.length > 0)
    };
  }

  /** The last resort button of the city: its tooltip and whether it can be used (it needs a character where it pays). */
  #lastResortContext(scale, hasCrew) {
    const kind = lastResortKind(scale.id, getCityScales());
    return { kind, tip: t(`LEVERAGE.Stars.LastResort.${kind}.tip`), disabled: kind !== "scapegoat" && !hasCrew };
  }

  /** @override */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    const refresh = () => this.rendered && this.render();
    this.#hooks = [["updateSetting", Hooks.on("updateSetting", (setting) => WATCHED_SETTINGS.has(setting.key) && refresh())]];
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector('[name="city"]')?.addEventListener("change", (event) => this.#onCity(event.target.value));
    this.element.querySelector('[name="actor"]')?.addEventListener("change", (event) => { this.#actorId = event.target.value; });
    this.#actorId ||= this.element.querySelector('[name="actor"]')?.value ?? "";
  }

  /** @override */
  _onClose(options) {
    for (const [name, id] of this.#hooks) Hooks.off(name, id);
    this.#hooks = [];
    WantedDialog.#instance = null;
    super._onClose(options);
  }

  /** A form control of the window. */
  #field(name) {
    return this.element.querySelector(`[name="${name}"]`);
  }

  /** Changes the city, keeping the level. */
  #onCity(city) {
    return setWanted(readWanted().level, city);
  }

  /* ------------------------------------------------------------ actions */

  static #onSetLevel(event, target) {
    return starsActions.setLevel(Number(target.dataset.level));
  }

  static async #onRaise() {
    const reason = this.#field("reason");
    const result = await starsActions.raise(1, reason?.value ?? "");
    if (result.ok && reason) reason.value = "";
  }

  static #onWait() {
    const scenes = this.#field("scenes");
    return starsActions.lowerByWaiting(scenes ? Number(scenes.value) : 1, { betweenSessions: !scenes });
  }

  static #onDisguise(event, target) {
    return starsActions.lowerByDisguise(target.dataset.kind, { sketched: Boolean(this.#field("sketched")?.checked) });
  }

  static #onBuySilence() {
    return starsActions.buySilence(this.#field("actor")?.value);
  }

  /** Asks the Fixer to confirm what the city's last resort needs, then applies it. */
  static async #onLastResort() {
    const { city } = readWanted();
    const kind = lastResortKind(city, getCityScales());
    const answer = await confirmLastResort(kind);
    if (answer) await starsActions.lastResort(this.#field("actor")?.value, { ...answer, confirmed: true });
  }
}

/** Ways out of Carcer City's last resort as `<option>`s. */
const wayOptions = () => starsActions.LAST_RESORT_WAYS
  .map((way) => `<option value="${way}">${escapeHtml(t(`LEVERAGE.Stars.LastResort.way.${way}`))}</option>`).join("");

/**
 * Asks the Fixer whether the Crew did what the city's last resort needs (docs/02).
 * @param {"any"|"disguiseAndSilence"|"scapegoat"} kind
 * @returns {Promise<{way?: string}|null>} the way chosen where any exit will do; null when cancelled
 */
function confirmLastResort(kind) {
  const chooser = kind === "any"
    ? `<label class="lv-dlg-field"><span>${escapeHtml(t("LEVERAGE.Stars.LastResort.wayLabel"))}</span><select name="way">${wayOptions()}</select></label>` : "";
  return foundry.applications.api.DialogV2.prompt({
    classes: ["leverage-gta", "lv-dialog"],
    window: { title: t("LEVERAGE.Stars.LastResort.title") },
    position: { width: 400 },
    rejectClose: false,
    content: `<div class="lv-dlg"><p>${escapeHtml(t(`LEVERAGE.Stars.LastResort.${kind}.body`))}</p>${chooser}</div>`,
    ok: {
      label: t("LEVERAGE.Stars.LastResort.confirm"),
      callback: (_event, button) => (kind === "any" ? { way: button.form.elements.way.value } : {})
    }
  });
}

/** Opens the wanted level window (Fixer only). */
export const openWantedDialog = () => WantedDialog.open();
