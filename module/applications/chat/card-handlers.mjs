/**
 * Foundry half of the roll card buttons (docs/08 "O card"): "+1 PP · Keep 3rd die" (owner) and "GM · Complication".
 * The rules live in `dice/card-actions.mjs`; this file reads and writes documents. The card is updated by editing the
 * message flags; a user that cannot update the message asks the Fixer through the socket.
 */
import { SYSTEM_ID } from "../../config.mjs";
import { logger } from "../../logger.mjs";
import { executeAsGM, registerSocketAction, requestAsGM } from "../../socket.mjs";
import { applyComplication, keepNextDie, resolveHitches, resolveNextOne, undoHitchList, unresolvedOnes } from "../../dice/card-actions.mjs";
import { checkOpportunityRequest, latestOppositionId, opportunitiesLeft, undoLower, useOpportunity } from "../../dice/opportunity.mjs";
import { resolveActor, rollOf } from "../components/common.mjs";
import { editTableList, readComplications } from "../../table-state.mjs";
import { promptComplication, promptHitches } from "./complication-dialog.mjs";
import { opportunityOptions, promptOpportunity } from "./opportunity-dialog.mjs";
import { damageFromCard } from "./damage.mjs";
import { promptCreateAsset } from "../dialogs/create-asset-dialog.mjs";
import { chatCards } from "../../dice/versus-cards.mjs";
import { addEffectComplication, complicationFromEffect, effectUsable, finalEffectDie, lostAgainst, markComplicationMade, markEffectUsed } from "../../dice/versus.mjs";

/** Messages with an action in flight (a double click must not spend two Plot Points). */
const busy = new Set();

/** How long a player's "+1 PP" button stays disabled while it waits for the Fixer to update the card (ms). */
const WAIT_FOR_FIXER = 4000;

const actorOf = (data) => (data?.actorUuid ? resolveActor(data.actorUuid) : null);
const plotPointsOf = (actor) => actor?.system?.plotPoints?.value ?? 0;

/** Runs `task` unless an action on this message is already running. */
async function exclusive(message, task) {
  if (busy.has(message.id)) return;
  busy.add(message.id);
  try { await task(); } catch (err) { logger.error("Roll card action failed", err); } finally { busy.delete(message.id); }
}

/**
 * Whether a user is the player of the character: an explicit Owner. The Fixer owns every document, so he does not
 * count as the character's owner here (docs/08: "+1 PP" is for the owner; the Fixer uses `plotPoints.add`).
 * @param {Actor|null} actor
 * @param {User} user
 * @returns {boolean}
 */
export function isCharacterOwner(actor, user) {
  return Boolean(actor && user && !user.isGM && actor.testUserPermission(user, "OWNER"));
}

/**
 * The newest Pool roll card of an actor in the chat log (opposition cards do not count). Only that card may keep dice.
 * @param {string} actorUuid
 * @returns {ChatMessage|null}
 */
export function latestRollOf(actorUuid) {
  const list = game.messages.contents;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const data = rollOf(list[i]);
    if (data && !data.opposition && data.actorUuid === actorUuid) return list[i];
  }
  return null;
}

/**
 * Spends 1 Plot Point of the actor and keeps the next die. Validates against fresh data after every await, so a stale
 * card, a card that is no longer the actor's latest roll, or a user that does not own the character does nothing.
 * Warns the user (when it is this client) if the actor has no Plot Point.
 * @param {ChatMessage} message
 * @param {User} user Who asked (must own the actor; the Fixer is not an owner here).
 * @returns {Promise<boolean>} whether a die was kept
 */
export async function keepDieNow(message, user) {
  const ready = () => {
    const data = rollOf(message);
    const actor = actorOf(data);
    const next = data && !data.opposition && keepNextDie(data);
    const allowed = next && isCharacterOwner(actor, user) && latestRollOf(data.actorUuid)?.id === message.id;
    return allowed ? { actor, next } : null;
  };
  const first = ready();
  if (!first) return false;
  if (plotPointsOf(first.actor) < 1) {
    if (user.id === game.user.id) ui.notifications.warn(game.i18n.localize("LEVERAGE.Roll.noPlotPoints"));
    return false;
  }
  await first.actor.addPlotPoints(-1);
  // Everything may have changed while the Plot Point was written: check again before touching the card.
  const again = ready();
  if (!again) {
    await first.actor.addPlotPoints(1);
    return false;
  }
  try {
    await message.setFlag(SYSTEM_ID, "roll", again.next);
  } catch (err) {
    await first.actor.addPlotPoints(1);
    throw err;
  }
  return true;
}

/** Socket handler (Fixer side). `userId` comes from the server (docs/04), the busy lock is per message. */
async function onKeepDieRequest({ messageId }, userId) {
  const message = game.messages.get(messageId);
  const user = game.users.get(userId);
  if (message && user) await exclusive(message, () => keepDieNow(message, user));
}

/** Disables a button; it comes back after `ms` unless the card was redrawn (then the button is a new element). */
function lockButton(button, ms) {
  if (!button) return;
  button.disabled = true;
  setTimeout(() => { button.disabled = false; }, ms);
}

/** Button "+1 PP · KEEP 3RD DIE". */
function keepDie(message, event) {
  const button = event?.currentTarget ?? null;
  if (busy.has(message.id) || button?.disabled) return undefined;
  if (button) button.disabled = true;
  return exclusive(message, async () => {
    if (message.canUserModify(game.user, "update")) {
      await keepDieNow(message, game.user);
      if (button) button.disabled = false;
    } else {
      // The Fixer applies it; keep the button off until the card is redrawn with the new flags.
      const sent = await executeAsGM("keepDie", { messageId: message.id });
      if (!sent && button) button.disabled = false;
      else lockButton(button, WAIT_FOR_FIXER);
    }
  });
}

/** Writes the Complication, hands the player 1 Plot Point and marks the 1 as resolved. */
async function writeComplication(message, choice) {
  const data = rollOf(message);
  const resolved = data && resolveNextOne(data);
  if (!resolved) return;
  let created = null;
  await editTableList("complications", (list) => {
    const result = applyComplication(list, choice, foundry.utils.randomID);
    created = result?.complication ?? null;
    return result?.list ?? list;
  });
  if (!created) return;
  await actorOf(data)?.addPlotPoints(1);
  await message.setFlag(SYSTEM_ID, "roll", resolved);
}

/** Button "GM · COMPLICATION". */
function complication(message) {
  if (!game.user.isGM) return undefined;
  return exclusive(message, async () => {
    const choice = await promptComplication(readComplications());
    if (choice) await writeComplication(message, choice);
  });
}

/**
 * Puts the card back as it was (best effort: a failure is only logged). The `flags` object is replaced whole
 * (`recursive: false`), not merged, so a field the later write added (such as `opportunityLog`) does not survive.
 */
const restoreCard = (message, data) => {
  const flags = { ...foundry.utils.deepClone(message.flags ?? {}), [SYSTEM_ID]: { ...(message.flags?.[SYSTEM_ID] ?? {}), roll: data } };
  return message.update({ flags }, { recursive: false }).catch((err) => logger.error("Could not put the card back", err));
};

/**
 * Writes the activation of every open hitch. Runs on the processing Fixer inside the socket `packetQueue`, so two
 * activations of the same card (from two Fixers) never overlap: the card is read fresh inside this one serial task, then
 * the Complications, the card and the player's Plot Points are written, in that order. A failed step takes back the
 * earlier ones (the Plot Points are the last write and are never taken away from the player).
 * @param {ChatMessage} message
 * @param {object} choice The Fixer's choice (validated by `resolveHitches`).
 * @returns {Promise<{ok: boolean, reason?: "taken"|"invalid"|"error", outOfScene?: string[], actorName?: string}>}
 */
async function writeHitches(message, choice) {
  const data = rollOf(message);
  if (!data) return { ok: false, reason: "invalid" };
  const actor = actorOf(data);
  let result = null;
  try {
    await editTableList("complications", (list) => {
      result = resolveHitches(data, list, choice, foundry.utils.randomID, { gainsPP: actor?.type === "crew" });
      return result?.list ?? list;
    });
  } catch (err) {
    logger.error("Could not write the Complications", err);
    return { ok: false, reason: "error" };
  }
  if (!result) return { ok: false, reason: unresolvedOnes(data).length ? "invalid" : "taken" };
  const undoList = () => editTableList("complications", (list) => undoHitchList(list, result)).catch((err) => logger.error("Could not undo the Complications", err));
  try {
    await message.setFlag(SYSTEM_ID, "roll", result.data);
  } catch (err) {
    logger.error("Could not write the card", err);
    await undoList();
    return { ok: false, reason: "error" };
  }
  try {
    if (result.ppGain > 0) await actor.addPlotPoints(result.ppGain);
  } catch (err) {
    logger.error("Could not give the Plot Points", err);
    await restoreCard(message, data);
    await undoList();
    return { ok: false, reason: "error" };
  }
  return { ok: true, outOfScene: result.outOfScene, actorName: data.actorName ?? "" };
}

/** Socket handler (Fixer side): only a Fixer may ask. The answer goes back to the asker. */
async function onActivateHitchesRequest({ messageId, choice }, userId) {
  const message = game.messages.get(messageId);
  if (!message || !game.users.get(userId)?.isGM) return { ok: false, reason: "invalid" };
  return writeHitches(message, choice);
}

/** Tells the Fixer who asked how the activation went. */
function reportHitches(result) {
  if (!result) ui.notifications.error(game.i18n.localize("LEVERAGE.Roll.hitchFailed"));
  else if (!result.ok) ui.notifications[result.reason === "taken" ? "warn" : "error"](game.i18n.localize(result.reason === "taken" ? "LEVERAGE.Roll.hitchTaken" : "LEVERAGE.Roll.hitchFailed"));
  else if (result.outOfScene?.length) ui.notifications.warn(game.i18n.format("LEVERAGE.Roll.outOfScene", { actor: result.actorName, names: result.outOfScene.join(", ") }));
}

/** Button "ACTIVATE HITCHES" (Cortex Prime card, Fixer only): one dialog for all the open hitches. */
function activateHitches(message) {
  if (!game.user.isGM) return undefined;
  return exclusive(message, async () => {
    const data = rollOf(message);
    const count = data ? unresolvedOnes(data).length : 0;
    if (!count) return;
    const crew = actorOf(data)?.type === "crew";
    const choice = await promptHitches(readComplications(), { count, botch: Boolean(data.botch), gainsPP: crew });
    if (!choice) return;
    reportHitches(await requestAsGM("activateHitches", { messageId: message.id, choice }));
  });
}

/* ------------------------------------------------------------ Opportunities (Fixer's card) */

/**
 * The character a player spends Opportunities with: his assigned character, else the first Crew he owns.
 * @param {User} user
 * @returns {Actor|null} null for the Fixer (he is not a character's owner here) or a player without a Crew
 */
export function opportunityActorOf(user) {
  if (!user || user.isGM) return null;
  const mine = (a) => a?.type === "crew" && isCharacterOwner(a, user);
  return [user.character, ...game.actors.filter(mine)].find(mine) ?? null;
}

/** Plain data of the Assets of an actor (what `useOpportunity` reads). */
const assetsOf = (actor) => actor.items.filter((i) => i.type === "asset").map((i) => ({
  id: i.id, name: i.name, die: i.system.die, boost: i.system.boost ?? 0, duration: i.system.duration
}));

/**
 * Spends one Opportunity of an opposition card. Runs on the processing Fixer inside the socket `packetQueue`, so two
 * uses never overlap: the card, the Plot Points and the target are read fresh in this one serial task. Writes the
 * Complication (or the Asset boost), then the card, then takes the Plot Point; a failed step takes back the earlier ones.
 * @param {ChatMessage} message
 * @param {{kind: string, id?: string, assetId?: string}} choice
 * @param {string} [actorId] The character the client says it plays: only checked, the character is always the asker's own (`opportunityActorOf`).
 * @param {User} user Who asked (the server's word, not the client's).
 * @returns {Promise<{ok: boolean, reason?: "taken"|"expired"|"invalid"|"noPlotPoints"|"error"}>}
 */
async function writeOpportunity(message, choice, actorId, user) {
  const data = rollOf(message);
  const actor = opportunityActorOf(user);
  const check = checkOpportunityRequest({
    data, authorIsGM: Boolean(message.author?.isGM), ownActorId: actor?.id ?? null, actorId,
    latestId: latestOppositionId(chatCards(), canvas?.scene?.id), messageId: message.id
  });
  if (!check.ok) return check;
  if (plotPointsOf(actor) < 1) return { ok: false, reason: "noPlotPoints" };
  const raising = choice?.kind === "raise";
  let result = null;
  try {
    if (raising) {
      result = useOpportunity(data, choice, { assets: assetsOf(actor), by: actor.name });
      if (result) await actor.items.get(result.assetId).update({ "system.boost": result.boost });
    } else {
      await editTableList("complications", (list) => {
        result = useOpportunity(data, choice, { complications: list, by: actor.name });
        return result?.list ?? list;
      });
    }
  } catch (err) {
    logger.error("Could not write the Opportunity", err);
    return { ok: false, reason: "error" };
  }
  if (!result) return { ok: false, reason: "invalid" };
  const undo = async () => {
    try {
      if (raising) await actor.items.get(result.assetId)?.update({ "system.boost": result.previousBoost });
      else await editTableList("complications", (list) => undoLower(list, result));
    } catch (err) {
      logger.error("Could not undo the Opportunity", err);
    }
  };
  try {
    await message.setFlag(SYSTEM_ID, "roll", result.data);
  } catch (err) {
    logger.error("Could not write the card", err);
    await undo();
    return { ok: false, reason: "error" };
  }
  try {
    await actor.addPlotPoints(-1);
  } catch (err) {
    logger.error("Could not take the Plot Point", err);
    await restoreCard(message, data);
    await undo();
    return { ok: false, reason: "error" };
  }
  return { ok: true };
}

/** Socket handler (Fixer side): the asker is the user the server authenticated. */
async function onUseOpportunityRequest({ messageId, choice, actorId }, userId) {
  const message = game.messages.get(messageId);
  const user = game.users.get(userId);
  if (!message || !user) return { ok: false, reason: "invalid" };
  return writeOpportunity(message, choice, actorId, user);
}

/** Tells the player how it went (nothing when it worked: the card redraws). */
function reportOpportunity(result) {
  if (result?.ok) return;
  const key = { taken: "LEVERAGE.Opportunity.taken", expired: "LEVERAGE.Opportunity.expired", noPlotPoints: "LEVERAGE.Roll.noPlotPoints" }[result?.reason] ?? "LEVERAGE.Opportunity.failed";
  ui.notifications[result?.reason === "error" || !result ? "error" : "warn"](game.i18n.localize(key));
}

/** Button "USE OPPORTUNITY (1 PP)" (Fixer's card, the character's player): pick an effect, the Fixer writes it. */
function useOpportunityButton(message) {
  const actor = opportunityActorOf(game.user);
  if (!actor) return undefined;
  return exclusive(message, async () => {
    if (!opportunitiesLeft(rollOf(message))) return;
    if (plotPointsOf(actor) < 1) return reportOpportunity({ ok: false, reason: "noPlotPoints" });
    const options = opportunityOptions(readComplications(), assetsOf(actor));
    if (!options.length) return ui.notifications.warn(game.i18n.localize("LEVERAGE.Opportunity.nothing"));
    const choice = await promptOpportunity(options);
    if (choice) reportOpportunity(await requestAsGM("useOpportunity", { messageId: message.id, choice, actorId: actor.id }));
  });
}

/* ------------------------------------------------------------ Effect of a roll (T-1012) */

/** Adds a Complication to the table's list, then writes the card; a failed card write takes the Complication back. */
async function writeEffectComplication(message, entry, nextData) {
  let made = null;
  try {
    await editTableList("complications", (list) => {
      made = addEffectComplication(list, entry, foundry.utils.randomID);
      return made?.list ?? list;
    });
  } catch (err) {
    logger.error("Could not write the Complication", err);
    return { ok: false, reason: "error" };
  }
  if (!made) return { ok: false, reason: "invalid" };
  try {
    await message.setFlag(SYSTEM_ID, "roll", nextData);
  } catch (err) {
    logger.error("Could not write the card", err);
    await editTableList("complications", (list) => list.filter((c) => c.id !== made.created.id)).catch((e) => logger.error("Could not undo the Complication", e));
    return { ok: false, reason: "error" };
  }
  return { ok: true };
}

/** Name of a Complication born from an effect. */
const effectName = (data) => game.i18n.format("LEVERAGE.Roll.effectComplicationName", { name: data.flavor || data.actorName || "" });

/**
 * "Complication dX" of a roll that won: the card's effect die as a Complication of the table. Runs on the processing
 * Fixer (inside the socket queue): the card is read fresh, the Complication written, then the card marked.
 */
async function writeActionComplication(message) {
  const data = rollOf(message);
  if (!effectUsable(data) || data.effectUsed?.complication) return { ok: false, reason: "invalid" };
  return writeEffectComplication(message, { name: effectName(data), die: finalEffectDie(data) }, markEffectUsed(data, "complication"));
}

/**
 * "Complication = winner's effect" on the Fixer's card: the first player roll that lost against it and has none yet gets
 * a Complication of the Fixer's effect (one step lower when the player's effect is the same or bigger). The player's card
 * is marked, so the button goes to the next one.
 */
async function writeFixerComplication(message) {
  const data = rollOf(message);
  if (!data?.opposition) return { ok: false, reason: "invalid" };
  for (const card of lostAgainst(chatCards(), message.id)) {
    const die = complicationFromEffect(data.effectDie, card.roll.effectDie);
    if (!die) continue;
    const player = game.messages.get(card.id);
    const name = game.i18n.format("LEVERAGE.Roll.fixerComplicationName", { name: data.flavor || data.actorName || "", actor: card.roll.actorName });
    return writeEffectComplication(player, { name, die }, markComplicationMade(card.roll));
  }
  return { ok: false, reason: "invalid" };
}

/** Marks the Asset use on the card after the player created it (checked: the character's owner, effect still usable). */
async function markAssetUsed(message, userId) {
  const data = rollOf(message);
  const user = game.users.get(userId);
  if (!effectUsable(data) || data.effectUsed?.asset || !isCharacterOwner(actorOf(data), user)) return { ok: false, reason: "invalid" };
  await message.setFlag(SYSTEM_ID, "roll", markEffectUsed(data, "asset"));
  return { ok: true };
}

/** Socket handler (Fixer side): `kind` is `asset` (mark), `complication` or `fixer`. */
async function onEffectRequest({ messageId, kind }, userId) {
  const message = game.messages.get(messageId);
  const user = game.users.get(userId);
  if (!message || !user) return { ok: false, reason: "invalid" };
  try {
    if (kind === "asset") return await markAssetUsed(message, userId);
    if (!user.isGM) return { ok: false, reason: "invalid" };
    return await (kind === "fixer" ? writeFixerComplication(message) : writeActionComplication(message));
  } catch (err) {
    logger.error("Effect action failed", err);
    return { ok: false, reason: "error" };
  }
}

/** Tells the asker when an effect action failed (nothing when it worked: the card redraws). */
function reportEffect(result) {
  if (!result?.ok) ui.notifications.error(game.i18n.localize("LEVERAGE.Roll.effectFailed"));
}

/** Button "Create Asset dX" (the character's player): a Scene Asset of the effect die, no Plot Points, name required. */
function effectAsset(message) {
  const data = rollOf(message);
  const actor = actorOf(data);
  if (!effectUsable(data) || !isCharacterOwner(actor, game.user)) return undefined;
  return exclusive(message, async () => {
    const choice = await promptCreateAsset({ plotPoints: plotPointsOf(actor), suggestDie: () => finalEffectDie(data), effectDie: finalEffectDie(data) });
    if (!choice) return;
    await actor.createEmbeddedDocuments("Item", [{ name: choice.name, type: "asset", system: { duration: "scene", die: finalEffectDie(data) } }]);
    reportEffect(await requestAsGM("effectAction", { messageId: message.id, kind: "asset" }));
  });
}

/** Button "Complication dX" (Fixer): the effect die of a won roll as a Complication of the table. */
function effectComplication(message) {
  if (!game.user.isGM) return undefined;
  return exclusive(message, async () => reportEffect(await requestAsGM("effectAction", { messageId: message.id, kind: "complication" })));
}

/** Button "Complication = effect dX" (Fixer's card): the Fixer's effect against a player who lost. */
function fixerComplication(message) {
  if (!game.user.isGM) return undefined;
  return exclusive(message, async () => reportEffect(await requestAsGM("effectAction", { messageId: message.id, kind: "fixer" })));
}

/** Button "APPLY DAMAGE" (opposition card, Fixer only). */
function applyDamage(message) {
  if (!game.user.isGM) return undefined;
  return exclusive(message, () => damageFromCard(message));
}

/** Messages whose card the viewer opened (client state only; never saved, lost on reload). */
const expandedCards = new Set();

/** Whether the viewer opened this card to see the whole roll. */
export const isExpanded = (message) => expandedCards.has(message.id);

/** Card click or chevron: shows or hides the whole roll (docs/08). Toggles the class in place, no redraw. */
function toggleExpand(message, event) {
  const card = event?.currentTarget?.closest?.(".lv-roll-card") ?? event?.target?.closest?.(".lv-roll-card");
  const open = !expandedCards.has(message.id);
  if (open) expandedCards.add(message.id); else expandedCards.delete(message.id);
  card?.classList.toggle("is-expanded", open);
  card?.querySelector("[data-action='toggleExpand']")?.setAttribute("aria-expanded", String(open));
}

/** Button "Choose dice": opens the choose-dice window (loaded on demand; it is built apart from this card). */
async function chooseDice(message) {
  try {
    const { openResolveDice } = await import("../dialogs/resolve-dice.mjs");
    await openResolveDice(message);
  } catch (err) {
    logger.error("Choose dice window failed", err);
    ui.notifications.warn(game.i18n.localize("LEVERAGE.Roll.chooseUnavailable"));
  }
}

/**
 * Click handlers by `data-action`.
 * @type {Record<string, (message: ChatMessage, event: Event) => Promise<void>|void>}
 */
export const cardHandlers = {
  keepDie, complication, activateHitches, useOpportunity: useOpportunityButton, applyDamage, chooseDice, toggleExpand,
  effectAsset, effectComplication, fixerComplication
};

/** Registers the Fixer-side socket action (call once). */
export function registerCardSocket() {
  registerSocketAction("keepDie", onKeepDieRequest);
  registerSocketAction("activateHitches", onActivateHitchesRequest);
  registerSocketAction("useOpportunity", onUseOpportunityRequest);
  registerSocketAction("effectAction", onEffectRequest);
}
