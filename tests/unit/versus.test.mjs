import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addEffectComplication, buildVersus, complicationFromEffect, effectSpent, effectUsable, finalEffectDie, isFixerCard, latestFixerCard, latestPlayerCard, lostAgainst,
  markComplicationMade, markEffectUsed, nextLostCard, stepsBetween, versusWon, visibleTo
} from "../../module/dice/versus.mjs";
import { applyConfirm, draftSummary } from "../../module/dice/resolve-draft.mjs";
import { effectActions, versusBand } from "../../module/applications/chat/versus-view.mjs";

const fixer = (id, timestamp, total = 10, extra = {}) => ({ id, timestamp, byGM: true, roll: { opposition: true, status: "resolved", total, effectDie: 8, ...extra } });
const player = (id, timestamp, extra = {}) => ({ id, timestamp, roll: { status: "resolved", total: 12, effectDie: 6, v: 2, ...extra } });
const t = (key, data) => `${key}${data ? JSON.stringify(data) : ""}`;

test("buildVersus: margin, tie is a failure, 5+ is heroic with steps on the effect", () => {
  assert.deepEqual(buildVersus({ messageId: "f", difficulty: 10, total: 12, effectDie: 6 }), { messageId: "f", difficulty: 10, margin: 2, outcome: "success", steps: 0, effectDie: 6 });
  assert.equal(buildVersus({ messageId: "f", difficulty: 10, total: 10, effectDie: 6 }).outcome, "fail");
  const heroic = buildVersus({ messageId: "f", difficulty: 5, total: 15, effectDie: 6 });
  assert.equal(heroic.outcome, "heroic");
  assert.equal(heroic.steps, 2);
  assert.equal(heroic.effectDie, 10);
  assert.equal(buildVersus({ messageId: "f", difficulty: 5, total: 25, effectDie: 12 }).effectDie, 12);
});

test("buildVersus: heroic rule off gives a plain success and keeps the effect", () => {
  const v = buildVersus({ messageId: "f", difficulty: 2, total: 20, effectDie: 6, heroic: false });
  assert.deepEqual([v.outcome, v.steps, v.effectDie], ["success", 0, 6]);
  assert.equal(versusWon(v), true);
  assert.equal(versusWon({ outcome: "fail" }), false);
});

test("latestFixerCard: newest Fixer card before the player's, same scene only", () => {
  const cards = [fixer("a", 1), fixer("b", 5), fixer("c", 20), player("p0", 3)];
  assert.equal(latestFixerCard(cards, { id: "p", timestamp: 10 }).id, "b");
  assert.equal(latestFixerCard(cards, { id: "p", timestamp: 0 }), null);
  const scenes = [{ ...fixer("s", 1), sceneId: "x" }];
  assert.equal(latestFixerCard(scenes, { id: "p", timestamp: 9, sceneId: "y" }), null);
  assert.equal(latestFixerCard(scenes, { id: "p", timestamp: 9, sceneId: "x" }).id, "s");
  assert.equal(latestFixerCard([fixer("pend", 1, 5, { status: "pending" })], { id: "p", timestamp: 9 }), null);
});

test("a card of a player (forged opposition roll) is never a Fixer card", () => {
  const forged = { ...fixer("x", 5, 0), byGM: false };
  assert.equal(isFixerCard(forged), false);
  assert.equal(isFixerCard({ ...forged, byGM: undefined }), false);
  assert.equal(isFixerCard(fixer("ok", 5)), true);
  assert.equal(isFixerCard({ ...fixer("ok", 5), visible: false }), false);
  assert.equal(latestFixerCard([forged, fixer("real", 1)], { id: "p", timestamp: 10 }).id, "real");
  assert.equal(latestFixerCard([forged], { id: "p", timestamp: 10 }), null);
});

test("latestFixerCard: a card the viewer cannot read (blind or private roll) is not offered", () => {
  const hidden = { ...fixer("h", 8, 3), visible: false };
  assert.equal(latestFixerCard([hidden, fixer("a", 2)], { id: "p", timestamp: 10 }).id, "a");
});

test("latestFixerCard: a pending player card also accepts a newer Fixer card", () => {
  const cards = [fixer("a", 1), fixer("n", 20)];
  assert.equal(latestFixerCard(cards, { id: "p", timestamp: 10, roll: { status: "pending" } }).id, "n");
  assert.equal(latestFixerCard(cards, { id: "p", timestamp: 10, roll: { status: "resolved" } }).id, "a");
});

test("visibleTo: public, sent to the user, or his own and not blind", () => {
  const me = { id: "u1" };
  assert.equal(visibleTo({ whisper: [] }, me), true);
  assert.equal(visibleTo({ whisper: ["u2"], author: { id: "u2" } }, me), false);
  assert.equal(visibleTo({ whisper: ["u1"], author: { id: "u2" } }, me), true);
  assert.equal(visibleTo({ whisper: ["u2"], author: { id: "u1" } }, me), true);
  assert.equal(visibleTo({ whisper: ["u2"], author: { id: "u1" }, blind: true }, me), false);
});

test("latestPlayerCard: newest resolved card without a link", () => {
  const cards = [player("a", 1), player("b", 5), player("c", 9, { versus: { outcome: "fail" } }), player("d", 12, { status: "pending" }), fixer("f", 14)];
  assert.equal(latestPlayerCard(cards).id, "b");
  assert.equal(latestPlayerCard([]), null);
});

test("latestPlayerCard: skips a card whose effect was already used", () => {
  const cards = [player("a", 1), player("b", 5, { effectUsed: { asset: true } })];
  assert.equal(latestPlayerCard(cards).id, "a");
});

test("complicationFromEffect: winner's die, one step lower when the loser's effect is the same or bigger", () => {
  assert.equal(complicationFromEffect(8, 6), 8);
  assert.equal(complicationFromEffect(8, 8), 6);
  assert.equal(complicationFromEffect(8, 12), 6);
  assert.equal(complicationFromEffect(4, 4), null);
  assert.equal(complicationFromEffect(null, 4), null);
});

test("lostAgainst: only failed links to that card, not yet used, oldest first", () => {
  const cards = [
    player("a", 5, { versus: { messageId: "f", outcome: "fail" } }),
    player("b", 2, { versus: { messageId: "f", outcome: "fail" } }),
    player("c", 3, { versus: { messageId: "f", outcome: "success" } }),
    player("d", 4, { versus: { messageId: "g", outcome: "fail" } }),
    player("e", 6, { versus: { messageId: "f", outcome: "fail", complicationMade: true } })
  ];
  assert.deepEqual(lostAgainst(cards, "f").map((c) => c.id), ["b", "a"]);
  assert.equal(markComplicationMade(cards[0].roll).versus.complicationMade, true);
});

test("nextLostCard: the next loser for a Fixer card written by a Fixer", () => {
  const cards = [
    player("b", 2, { versus: { messageId: "f", outcome: "fail" }, effectDie: 8 }),
    player("a", 5, { versus: { messageId: "f", outcome: "fail" }, effectDie: 4 })
  ];
  const next = nextLostCard(cards, fixer("f", 1));
  assert.deepEqual([next.card.id, next.die], ["b", 6]);
  assert.equal(nextLostCard(cards, { ...fixer("f", 1), byGM: false }), null);
  assert.equal(nextLostCard(cards, null), null);
  assert.equal(nextLostCard(cards, fixer("f", 1, 10, { effectDie: null })), null);
  assert.equal(nextLostCard([], fixer("f", 1)), null);
});

test("stepsBetween counts the sizes really climbed (a d12 cannot rise)", () => {
  assert.equal(stepsBetween(6, 10), 2);
  assert.equal(stepsBetween(12, 12), 0);
  assert.equal(stepsBetween(10, 12), 1);
});

test("finalEffectDie: the versus raises it, else the rolled die", () => {
  assert.equal(finalEffectDie({ effectDie: 6, versus: { effectDie: 10 } }), 10);
  assert.equal(finalEffectDie({ effectDie: 6 }), 6);
  assert.equal(finalEffectDie(null), null);
});

test("one effect die is one action: any mark spends it", () => {
  const used = markEffectUsed(player("a", 1).roll, "asset");
  assert.equal(effectSpent(used), true);
  assert.equal(effectUsable(used), false);
  assert.equal(effectUsable({ ...used, effectUsed: { complication: true } }), false);
  assert.equal(effectSpent({ effectUsed: {} }), false);
  assert.equal(effectSpent(player("a", 1).roll), false);
});

test("effectUsable and markEffectUsed", () => {
  assert.equal(effectUsable(player("a", 1).roll), true);
  assert.equal(effectUsable(player("a", 1, { versus: { outcome: "fail" } }).roll), false);
  assert.equal(effectUsable(player("a", 1, { status: "pending" }).roll), false);
  assert.equal(effectUsable(fixer("f", 1).roll), false);
  assert.equal(effectUsable(player("a", 1, { v: 1, effectDie: null }).roll), false);
  assert.equal(markEffectUsed({ effectUsed: {} }, "asset").effectUsed.asset, true);
});

test("addEffectComplication needs a name and a die", () => {
  let n = 0;
  const id = () => `id${(n += 1)}`;
  const made = addEffectComplication([{ id: "x", name: "A", die: 6 }], { name: " Sirens ", die: 8 }, id);
  assert.deepEqual(made.created, { id: "id1", name: "Sirens", die: 8 });
  assert.equal(made.list.length, 2);
  assert.equal(addEffectComplication([], { name: " ", die: 8 }, id), null);
  assert.equal(addEffectComplication([], { name: "A", die: null }, id), null);
});

test("applyConfirm saves the versus with the result; draftSummary reads a chosen difficulty", () => {
  const entries = [8, 6, 4].map((faces, i) => ({ ref: `r${i}`, label: "d", kind: "die", faces, result: [7, 5, 3][i], kept: false, one: false, effect: false, paid: false }));
  const data = { v: 2, status: "pending", entries, ppAtRoll: 0 };
  const draft = { total: [0, 1], effect: [2], paid: [] };
  const done = applyConfirm(data, draft, { versus: { messageId: "f", difficulty: 2, heroic: true } });
  assert.deepEqual([done.total, done.versus.margin, done.versus.outcome, done.versus.steps, done.versus.effectDie], [12, 10, "heroic", 2, 8]);
  assert.equal(applyConfirm(data, draft).versus, undefined);
  assert.equal(draftSummary(data, draft, { versusDifficulty: 20 }).versus.outcome, "fail");
  assert.equal(draftSummary(data, draft).versus, null);
});

test("versusBand: title, margin, steps and the final effect only when it won", () => {
  const win = versusBand({ versus: { outcome: "heroic", margin: 10, steps: 2, effectDie: 10 } }, t);
  assert.equal(win.title, "LEVERAGE.Roll.versus.heroic");
  assert.match(win.steps, /stepsMany/);
  assert.match(win.effect, /d10$/);
  const lose = versusBand({ versus: { outcome: "fail", margin: -3, steps: 0, effectDie: 6 } }, t);
  assert.equal(lose.effect, "");
  assert.match(lose.detail, /miss/);
  assert.equal(versusBand({}, t), null);
  // heroic on a d12 effect: no step really taken, none shown
  const capped = versusBand({ effectDie: 12, versus: { outcome: "heroic", margin: 6, steps: 1, effectDie: 12 } }, t);
  assert.equal(capped.steps, "");
  const real = versusBand({ effectDie: 6, versus: { outcome: "heroic", margin: 12, steps: 2, effectDie: 10 } }, t);
  assert.match(real.steps, /stepsMany.*"n":2/);
});

test("effectActions: Asset for the owner only (no Complication on the player's card), Fixer button only with a lost roll", () => {
  const data = player("a", 1).roll;
  const owner = effectActions(data, { t, prime: true, isOwner: true, isGM: false });
  assert.equal(owner.showEffectAsset, true);
  assert.equal("showEffectComplication" in owner, false);
  const gm = effectActions(data, { t, prime: true, isOwner: false, isGM: true });
  assert.equal(gm.showEffectAsset, false);
  const used = effectActions({ ...data, effectUsed: { asset: true } }, { t, prime: true, isOwner: true, isGM: true });
  assert.equal(used.showEffectAsset, false);
  const lost = effectActions(fixer("f", 1).roll, { t, prime: false, isOwner: false, isGM: true, lost: { actor: "Carl", die: 6 } });
  assert.equal(lost.showFixerComplication, true);
  assert.match(lost.fixerComplicationLabel, /"actor":"Carl"/);
  assert.equal(effectActions(fixer("f", 1).roll, { t, prime: false, isOwner: false, isGM: false, lost: { actor: "Carl", die: 6 } }).showFixerComplication, false);
});
