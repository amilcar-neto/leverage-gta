/**
 * Small helpers shared by the dialogs, the Fixer actions and the chat code: HTML escaping, the Fixer-only check, the
 * roll flag of a chat message and actor lookup. Nothing here touches a Foundry global at import time.
 */
import { SYSTEM_ID } from "../../config.mjs";
import { t } from "./i18n.mjs";

const ESCAPES = Object.freeze({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" });

/**
 * Escapes a value for use in HTML text or a quoted attribute.
 * @param {*} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/**
 * Whether the current user is the Fixer (GM); shows the "Fixer only" warning otherwise.
 * @returns {boolean}
 */
export function requireGM() {
  if (game.user.isGM) return true;
  ui.notifications.warn(t("LEVERAGE.GM.Warn.gmOnly"));
  return false;
}

/**
 * The roll data of a chat message (`flags.leverage-gta.roll`).
 * @param {ChatMessage|null|undefined} message
 * @returns {object|null}
 */
export const rollOf = (message) => message?.getFlag(SYSTEM_ID, "roll") ?? null;

/**
 * Resolves an Actor from a document, a UUID, a world Actor id or a Token (its Actor). Never throws.
 * @param {Actor|TokenDocument|string|null|undefined} ref
 * @returns {Actor|null}
 */
export function resolveActor(ref) {
  let doc = ref;
  if (typeof ref === "string") {
    doc = game.actors.get(ref);
    if (!doc) {
      try { doc = fromUuidSync(ref); } catch { doc = null; }
    }
  }
  if (doc?.documentName === "Token") doc = doc.actor;
  return doc?.documentName === "Actor" ? doc : null;
}
