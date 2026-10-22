/**
 * Opportunities (Cortex Prime, docs/08): every hitch (1) on the Fixer's opposition card is an Opportunity. A player
 * spends 1 Plot Point per use to either step a Complication of the table DOWN (a d4 goes away) or step one of his
 * Assets UP (scene or Job Assets, never past d12; the raise lasts until the end of the scene: the Asset keeps a
 * temporary `boost` in steps). Pure logic, no Foundry dependency (unit tested).
 */
import { LEVERAGE } from "../config.mjs";
import { stepDown, stepUp } from "./die.mjs";

/** Asset durations that an Opportunity can raise (a Signature Asset is permanent gear: not touched). */
export const BOOSTABLE_DURATIONS = Object.freeze(["scene", "job"]);

/**
 * Die an Asset rolls: its own die stepped up `boost` times (never past the top die).
 * @param {number} die
 * @param {number} [boost] Temporary steps from Opportunities.
 * @returns {number}
 */
export function effectiveDie(die, boost = 0) {
  let current = die;
  for (let i = 0; i < Math.max(0, Math.trunc(Number(boost) || 0)); i += 1) current = stepUp(current);
  return current;
}

/**
 * Opportunities of a card that nobody spent yet. Only a resolved opposition card has them.
 * @param {object|null} data `flags.leverage-gta.roll`
 * @returns {number}
 */
export function opportunitiesLeft(data) {
  if (!data?.opposition || data.status === "pending") return 0;
  return Math.max(0, Math.trunc(Number(data.opportunities) || 0) - Math.trunc(Number(data.opportunitiesUsed) || 0));
}

/**
 * Whether an Opportunity can still raise this Asset: scene or Job Asset whose rolled die is below d12.
 * @param {{die: number, boost?: number, duration: string}} asset
 * @returns {boolean}
 */
export function canBoostAsset(asset) {
  const top = LEVERAGE.dice[LEVERAGE.dice.length - 1];
  return BOOSTABLE_DURATIONS.includes(asset?.duration) && effectiveDie(asset.die, asset.boost) < top;
}

/**
 * Spends one Opportunity of a card.
 * @param {object} data `flags.leverage-gta.roll` of a resolved opposition card.
 * @param {{kind: "lower", id: string}|{kind: "raise", assetId: string}} choice `lower`: a Complication id; `raise`: an Asset id.
 * @param {object} [pool]
 * @param {{id: string, name: string, die: number}[]} [pool.complications] The table's Complications.
 * @param {{id: string, name: string, die: number, boost?: number, duration: string}[]} [pool.assets] Assets the player may raise.
 * @param {string} [pool.by] Name of the character that pays (saved in the card's `opportunityLog` for the card to show).
 * @returns {{data: object, kind: "lower"|"raise", name: string, from: number, to: number|null, list?: object[], previous?: object, index?: number, assetId?: string, boost?: number, previousBoost?: number}|null}
 *   `from` and `to` are the die sizes before and after (`to` null: the Complication is gone). `list` is the new Complication
 *   list (`lower`); `boost` the new boost (`raise`). null when no Opportunity is left or the choice is not valid.
 */
export function useOpportunity(data, choice, { complications = [], assets = [], by = "" } = {}) {
  if (!choice || opportunitiesLeft(data) < 1) return null;
  const spent = (kind, name, from, to) => ({
    ...data,
    opportunitiesUsed: (data.opportunitiesUsed ?? 0) + 1,
    opportunityLog: [...(data.opportunityLog ?? []), { kind, name, from, to, by }]
  });
  if (choice.kind === "lower") {
    const index = complications.findIndex((c) => c.id === choice.id);
    if (index < 0) return null;
    const previous = complications[index];
    const to = stepDown(previous.die);
    const list = to === null
      ? complications.filter((c) => c.id !== previous.id)
      : complications.map((c) => (c.id === previous.id ? { ...c, die: to } : c));
    return { data: spent("lower", previous.name, previous.die, to), kind: "lower", name: previous.name, from: previous.die, to, list, previous, index };
  }
  if (choice.kind === "raise") {
    const asset = assets.find((a) => a.id === choice.assetId);
    if (!asset || !canBoostAsset(asset)) return null;
    const previousBoost = Math.max(0, Math.trunc(Number(asset.boost) || 0));
    const from = effectiveDie(asset.die, previousBoost);
    const to = effectiveDie(asset.die, previousBoost + 1);
    return { data: spent("raise", asset.name, from, to), kind: "raise", name: asset.name, from, to, assetId: asset.id, boost: previousBoost + 1, previousBoost };
  }
  return null;
}

/**
 * Takes back the Complication change of a `lower` use (when a later write fails): puts the Complication back to its old
 * die (or back in its old place if the d4 was removed). Other entries stay as they are now.
 * @param {{id: string, name: string, die: number}[]} list The table's Complications now.
 * @param {{previous: {id: string}, index: number}} result What `useOpportunity` returned.
 * @returns {{id: string, name: string, die: number}[]}
 */
export function undoLower(list, { previous, index }) {
  if (list.some((c) => c.id === previous.id)) return list.map((c) => (c.id === previous.id ? previous : c));
  const copy = [...list];
  copy.splice(Math.min(index, copy.length), 0, previous);
  return copy;
}
