import test from "node:test";
import assert from "node:assert/strict";
import { clampedAdd, setJobGoal } from "../../module/applications/gm/job-tracker-logic.mjs";
import { cleanWorldJobFields, isWorldJob, jobLink, jobVisibility, legacyJobData, normalizeJob, payoutCrew, pickActiveJob, plannedJobsOf } from "../../module/rules/jobs.mjs";

test("normalizeJob keeps only a string name and goal (old worlds kept lists in the Job)", () => {
  assert.deepEqual(normalizeJob({ name: 5, complications: [{ id: "a", name: "x", die: 8 }], sceneTraits: [] }), { name: "5", goal: "" });
  assert.deepEqual(normalizeJob(undefined), { name: "", goal: "" });
});

test("setJobGoal trims, keeps the name and does not mutate", () => {
  const src = { name: "J", goal: "G" };
  assert.deepEqual(setJobGoal(src, "  Ledger "), { name: "J", goal: "Ledger" });
  assert.deepEqual(src, { name: "J", goal: "G" });
});

test("clampedAdd keeps counters in range", () => {
  assert.equal(clampedAdd(3, 1, 3), 3);
  assert.equal(clampedAdd(0, -1), 0);
  assert.equal(clampedAdd(2, 5), 7);
  assert.equal(clampedAdd("x", 1), 1);
});

const job = (id, status, extra = {}) => ({ id, type: "job", name: id, sort: 0, system: { status }, ...extra });

test("isWorldJob: only a `job` Item outside any Actor and compendium", () => {
  assert.equal(isWorldJob(job("a", "planned")), true);
  assert.equal(isWorldJob(job("a", "planned", { parent: { id: "actor" } })), false);
  assert.equal(isWorldJob(job("a", "planned", { pack: "x.y" })), false);
  assert.equal(isWorldJob({ id: "t", type: "talent", system: {} }), false);
});

test("pickActiveJob takes the first active world Job by sort and reports the others", () => {
  const items = [job("c", "active", { sort: 20 }), job("b", "active", { sort: 10 }), job("a", "planned"), job("r", "active", { parent: {} })];
  const { active, extra } = pickActiveJob(items);
  assert.equal(active.id, "b");
  assert.deepEqual(extra.map((j) => j.id), ["c"]);
  assert.deepEqual(pickActiveJob([job("a", "done")]), { active: null, extra: [] });
});

test("plannedJobsOf lists only planned world Jobs in directory order", () => {
  const items = [job("z", "planned", { sort: 2 }), job("y", "planned", { sort: 1 }), job("x", "done"), job("w", "active")];
  assert.deepEqual(plannedJobsOf(items).map((j) => j.id), ["y", "z"]);
});

test("legacyJobData turns the old setting into an active Job and ignores an empty one", () => {
  assert.deepEqual(legacyJobData({ name: " Bank ", goal: " Ledger ", complications: [] }, "Unnamed"),
    { name: "Bank", goal: "Ledger" });
  assert.equal(legacyJobData({ name: "", goal: "Only a goal" }, "Unnamed").name, "Unnamed");
  assert.equal(legacyJobData({ name: " ", goal: "" }, "Unnamed"), null);
  assert.equal(legacyJobData(undefined, "Unnamed"), null);
});

test("jobLink builds an @UUID link and strips what would break it", () => {
  assert.equal(jobLink("Item.abc", "[TEST] Bank {job} <b>"), "@UUID[Item.abc]{[TEST] Bank job &lt;b&gt;}");
});

test("jobVisibility hides a planned Job and shows an active or done one", () => {
  assert.equal(jobVisibility("planned"), "NONE");
  assert.equal(jobVisibility("active"), "OBSERVER");
  assert.equal(jobVisibility("done"), "OBSERVER");
});

test("payoutCrew lists every character with a non-negative integer share", () => {
  const crew = [{ id: "a", uuid: "Actor.a", name: "Ana" }, { id: "b", uuid: "Actor.b", name: "Bo" }, { id: "c", uuid: "Actor.c", name: "Cy" }];
  assert.deepEqual(payoutCrew(crew, { a: 2, b: -3, c: "x" }), [
    { actorUuid: "Actor.a", name: "Ana", share: 2 }, { actorUuid: "Actor.b", name: "Bo", share: 0 }, { actorUuid: "Actor.c", name: "Cy", share: 0 }
  ]);
  assert.deepEqual(payoutCrew([], {}), []);
  assert.equal(payoutCrew(crew.slice(0, 1), undefined)[0].share, 0);
});

test("cleanWorldJobFields resets everything a Record carries", () => {
  const fields = cleanWorldJobFields();
  assert.equal(fields["system.status"], "planned");
  assert.equal(fields["system.payout.share"], 0);
  assert.deepEqual(fields["system.payout.crew"], []);
  assert.equal(fields["system.spent"], false);
});
