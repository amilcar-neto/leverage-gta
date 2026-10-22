/**
 * Card parts of T-1011/T-1012 (pure, no Foundry): the result band of a versus roll (SUCCESS / FAIL / HEROIC with the
 * final effect) and the buttons that use a won effect (an Asset) or the Fixer's (a Complication against the loser).
 */
import { effectUsable, finalEffectDie, stepsBetween, versusWon } from "../../dice/versus.mjs";

/**
 * Result band of a roll linked to a Fixer card.
 * @param {object} data Normalized roll data.
 * @param {(key: string, data?: object) => string} t
 * @returns {{outcome: string, title: string, detail: string, effect: string, steps: string, tip: string}|null} null without a link
 */
export function versusBand(data, t) {
  const v = data.versus;
  if (!v || typeof v.margin !== "number") return null;
  const won = versusWon(v);
  const detail = t(won ? "LEVERAGE.Roll.versus.beat" : "LEVERAGE.Roll.versus.miss", { n: Math.abs(v.margin) });
  // The steps really taken: a d12 effect cannot rise, so a heroic success on it shows no step.
  const taken = data.effectDie && v.effectDie ? stepsBetween(data.effectDie, v.effectDie) : v.steps;
  const steps = taken ? t(`LEVERAGE.Roll.versus.steps${taken === 1 ? "One" : "Many"}`, { n: taken }) : "";
  const effect = won && v.effectDie ? `${t("LEVERAGE.Roll.effect")} d${v.effectDie}` : "";
  const title = t(`LEVERAGE.Roll.versus.${v.outcome}`);
  return { outcome: v.outcome, title, detail, effect, steps, tip: [title, steps, detail, effect].filter(Boolean).join(" · ") };
}

/**
 * Buttons that use the effect (docs/08). The character's player may create an Asset of the effect die of a resolved
 * roll that won (or has no versus link) and whose effect is not used yet: one effect die is one action. The Fixer's own
 * card gets the "Complication = winner's effect" button for the first player roll that lost against it.
 * @param {object} data Normalized roll data.
 * @param {object} view
 * @param {(key: string, data?: object) => string} view.t
 * @param {boolean} view.prime The card uses the prime layout (resolved, with an effect die).
 * @param {boolean} view.isOwner The viewer is the character's player.
 * @param {boolean} view.isGM The viewer is the Fixer.
 * @param {{actor: string, die: number}|null} [view.lost] Opposition card: the player who lost against it and the Complication die.
 * @returns {object} template fields (`showEffectAsset`, `showFixerComplication` and their labels)
 */
export function effectActions(data, { t, prime, isOwner, isGM, lost = null }) {
  const die = `d${finalEffectDie(data)}`;
  const showEffectAsset = prime && isOwner && effectUsable(data);
  const showFixerComplication = Boolean(data.opposition && isGM && lost);
  const lostDie = lost ? `d${lost.die}` : "";
  return {
    showEffectAsset, showFixerComplication,
    effectAssetLabel: t("LEVERAGE.Roll.effectAsset", { die }), effectAssetTip: t("LEVERAGE.Roll.effectAssetTip", { die }),
    fixerComplicationLabel: lost ? t("LEVERAGE.Roll.fixerComplication", { die: lostDie, actor: lost.actor }) : "",
    fixerComplicationTip: lost ? t("LEVERAGE.Roll.fixerComplicationTip", { actor: lost.actor, die: lostDie }) : ""
  };
}
