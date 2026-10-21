import "./helpers/foundry-stub.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyComplication, keepNextDie, nextSpareIndex, resolveNextOne, unresolvedOnes } from "../../module/dice/card-actions.mjs";
import { lowestActiveGM, routePacket } from "../../module/socket.mjs";
import { rollCardContext } from "../../module/applications/chat/roll-card.mjs";

const entry = (result, kept = false, faces = 10) => ({ ref: `r${result}`, label: "x", faces, result, kept, one: result === 1 });
const roll = (entries) => ({
  entries, keptCount: entries.filter((e) => e.kept).length, ppSpent: 0, complicationsResolved: [],
  total: entries.filter((e) => e.kept).reduce((s, e) => s + e.result, 0)
});
const t = (key, args) => (args ? `${key}:${JSON.stringify(args)}` : key);

test("next spare die is the highest unkept non-1, earlier on ties", () => {
  assert.equal(nextSpareIndex([entry(9, true), entry(8, true), entry(5), entry(5), entry(1)]), 2);
  assert.equal(nextSpareIndex([entry(9, true), entry(1), entry(1)]), -1);
});

test("keeping a die raises total, kept count and ppSpent without mutating the input", () => {
  const data = roll([entry(9, true), entry(8, true), entry(5), entry(3), entry(1)]);
  const copy = structuredClone(data);
  const a = keepNextDie(data);
  assert.deepEqual(data, copy);
  assert.equal(a.total, 22);
  assert.equal(a.keptCount, 3);
  assert.equal(a.ppSpent, 1);
  const b = keepNextDie(a);
  assert.equal(b.total, 25);
  assert.equal(b.ppSpent, 2);
  assert.equal(keepNextDie(b), null);
});

test("ones: resolving marks them one at a time", () => {
  const data = roll([entry(9, true), entry(1), entry(1), entry(4)]);
  assert.deepEqual(unresolvedOnes(data), [1, 2]);
  const a = resolveNextOne(data);
  assert.deepEqual(a.complicationsResolved, [1]);
  const b = resolveNextOne(a);
  assert.deepEqual(unresolvedOnes(b), []);
  assert.equal(resolveNextOne(b), null);
});

test("new Complication is a d6; raising goes d6 d8 d10 d12 and stops", () => {
  const made = applyComplication({ name: "Heist", complications: [] }, { name: "  Alarm  " }, () => "abc");
  assert.deepEqual(made.complication, { id: "abc", name: "Alarm", die: 6 });
  assert.equal(made.job.name, "Heist");
  let job = made.job;
  const dice = [];
  for (let i = 0; i < 5; i++) {
    const r = applyComplication(job, { id: "abc" }, () => "x");
    job = r.job;
    dice.push(r.complication.die);
  }
  assert.deepEqual(dice, [8, 10, 12, 12, 12]);
  assert.equal(job.complications.length, 1);
});

test("Complication rejects an empty name and an unknown id", () => {
  assert.equal(applyComplication({ complications: [] }, { name: "  " }, () => "a"), null);
  assert.equal(applyComplication({ complications: [] }, { id: "nope" }, () => "a"), null);
});

test("card context: PP spent note shown, warning gone once every 1 is resolved", () => {
  const data = { ...roll([entry(9, true), entry(1)]), ppSpent: 2, complicationsResolved: [1] };
  const ctx = rollCardContext(data, { t, isGM: true });
  assert.equal(ctx.onesCount, 0);
  assert.equal(ctx.showComplication, false);
  assert.ok(ctx.ppNotes.some((n) => n.startsWith("LEVERAGE.Roll.ppSpent")));
});

test("socket: lowest active GM id processes; routing needs the processor and a known action", async () => {
  const users = [
    { id: "b", active: true, isGM: true }, { id: "a", active: false, isGM: true },
    { id: "c", active: true, isGM: false }, { id: "d", active: true, isGM: true }
  ];
  assert.equal(lowestActiveGM(users), "b");
  assert.equal(lowestActiveGM([{ id: "c", active: true, isGM: false }]), null);
  const seen = [];
  const handlers = new Map([["ping", (data, userId) => seen.push([data, userId])]]);
  assert.equal(await routePacket({ action: "ping", data: { x: 1 } }, { isProcessor: false, userId: "u", handlers }), false);
  assert.equal(await routePacket({ action: "nope" }, { isProcessor: true, userId: "u", handlers }), false);
  assert.equal(await routePacket({ action: "ping", data: { x: 1 } }, { isProcessor: true, userId: "u", handlers }), true);
  assert.deepEqual(seen, [[{ x: 1 }, "u"]]);
});

test("socket: the requester is the server's id; a userId inside the packet is ignored", async () => {
  const seen = [];
  const handlers = new Map([["ping", (data, userId) => seen.push(userId)]]);
  await routePacket({ action: "ping", data: {}, userId: "forged-gm" }, { isProcessor: true, userId: "real-player", handlers });
  assert.deepEqual(seen, ["real-player"]);
});

test("card context: PP button only for the newest roll of the player; disabled without Plot Points", () => {
  const data = roll([entry(9, true), entry(8, true), entry(5)]);
  const base = { t, isOwner: true, plotPoints: 2 };
  assert.equal(rollCardContext(data, { ...base }).showKeep, true);
  assert.equal(rollCardContext(data, { ...base, isLatest: false }).showKeep, false);
  assert.equal(rollCardContext(data, { ...base, isOwner: false, isGM: true }).showKeep, false);
  const broke = rollCardContext(data, { ...base, plotPoints: 0 });
  assert.equal(broke.showKeep, true);
  assert.equal(broke.keepDisabled, true);
  assert.equal(broke.keepTip, "LEVERAGE.Roll.keepTipNoPlotPoints");
});

test("card context: PP spent uses the singular and plural keys; keep button names the next die", () => {
  const one = rollCardContext({ ...roll([entry(9, true), entry(5)]), ppSpent: 1 }, { t });
  assert.ok(one.ppNotes.some((n) => n.startsWith("LEVERAGE.Roll.ppSpentOne")));
  const many = rollCardContext({ ...roll([entry(9, true), entry(5)]), ppSpent: 2 }, { t });
  assert.ok(many.ppNotes.some((n) => n.startsWith("LEVERAGE.Roll.ppSpentMany")));
  assert.equal(rollCardContext(roll([entry(9, true), entry(8, true), entry(5)]), { t, isOwner: true, plotPoints: 1 }).keepLabel.startsWith("LEVERAGE.Roll.keepButton"), true);
});
