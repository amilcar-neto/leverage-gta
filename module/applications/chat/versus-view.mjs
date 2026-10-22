/**
 * Card parts of T-1011/T-1012 (pure, no Foundry): the result band of a versus roll (SUCCESS / FAIL / HEROIC with the
 * final effect) and the buttons that turn a won effect into an Asset or a Complication.
 */
import { effectUsable, finalEffectDie, versusWon } from "../../dice/versus.mjs";

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
  const steps = v.steps ? t(`LEVERAGE.Roll.versus.steps${v.steps === 1 ? "One" : "Many"}`, { n: v.steps }) : "";
  const effect = won && v.effectDie ? `${t("LEVERAGE.Roll.effect")} d${v.effectDie}` : "";
  const title = t(`LEVERAGE.Roll.versus.${v.outcome}`);
  return { outcome: v.outcome, title, detail, effect, steps, tip: [title, steps, detail, effect].filter(Boolean).join(" · ") };
}

/**
 * Buttons that use the effect of a resolved roll (docs/08): the character's player may create an Asset of the effect
 * die, the Fixer a Complication of it. Only on a prime card, when the roll won (or has no versus link) and the action
 * was not used yet; the Fixer's own card gets the "Complication = winner's effect" button of the first lost roll.
 * @param {object} data Normalized roll data.
 * @param {object} view
 * @param {(key: string, data?: object) => string} view.t
 * @param {boolean} view.prime The card uses the prime layout (resolved, with an effect die).
 * @param {boolean} view.isOwner The viewer is the character's player.
 * @param {boolean} view.isGM The viewer is the Fixer.
 * @param {{actor: string, die: number}|null} [view.lost] Opposition card: the player who lost against it and the Complication die.
 * @returns {object} template fields (`showEffectAsset`, `showEffectComplication`, `showFixerComplication` and their labels)
 */
export function effectActions(data, { t, prime, isOwner, isGM, lost = null }) {
  const usable = prime && effectUsable(data);
  const used = data.effectUsed ?? {};
  const die = `d${finalEffectDie(data)}`;
  const showEffectAsset = usable && isOwner && !used.asset;
  const showEffectComplication = usable && isGM && !used.complication;
  const showFixerComplication = Boolean(data.opposition && isGM && lost);
  return {
    showEffectAsset, showEffectComplication, showFixerComplication,
    effectAssetLabel: t("LEVERAGE.Roll.effectAsset", { die }), effectAssetTip: t("LEVERAGE.Roll.effectAssetTip", { die }),
    effectComplicationLabel: t("LEVERAGE.Roll.effectComplication", { die }), effectComplicationTip: t("LEVERAGE.Roll.effectComplicationTip", { die }),
    fixerComplicationLabel: lost ? t("LEVERAGE.Roll.fixerComplication", { die: `d${lost.die}` }) : "",
    fixerComplicationTip: lost ? t("LEVERAGE.Roll.fixerComplicationTip", { actor: lost.actor, die: `d${lost.die}` }) : ""
  };
}
