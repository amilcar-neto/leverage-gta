/**
 * J-03/J-04/J-06/J-07 check (real Foundry): the Job as a world Item. Sheet (world Job vs Record), one active Job at a
 * time, the Tracker header (no Job, Start list, open sheet), New Job / End Job (done Job kept, Record linked by flag,
 * chat link) and the player's view. Only `[TEST]` data; Jobs, settings, Crew and chat are restored. Exit: 0 pass, 1 fail.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const wait = (ms) => page.waitForTimeout(ms);
const app = "#leverage-job-tracker";
let saved = null;
let playerBrowser = null;
let playerLog = null;
let made = null;

try {
  await login(page, env);
  made = await page.evaluate(async () => {
    const before = { jobs: lvTestJob.snapshot(), msgs: game.messages.map((m) => m.id), complications: foundry.utils.deepClone(game.settings.get("leverage-gta", "complications")) };
    await lvTestJob.set({});
    const crew = await Actor.create({ name: "[TEST] J Crew", type: "crew", ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER } });
    let user = game.users.find((u) => u.name === "[TEST] Player");
    const created = !user;
    user ??= await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    await user.update({ character: crew.id });
    const { JobTracker } = await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/gm/job-tracker.mjs"));
    await new JobTracker().render({ force: true });
    return { before, crew: crew.id, user: user.id, created };
  });
  saved = made.before;
  await wait(1200);

  // ---- Tracker without a Job
  const noJob = await page.evaluate((a) => ({
    text: document.querySelector(`${a} .lv-trk-job`)?.innerText, start: document.querySelector(`${a} [data-action="startJob"]`)?.disabled,
    hasName: Boolean(document.querySelector(`${a} .lv-trk-jobname`))
  }), app);
  record("no Job: the header says so, no name button, Start disabled (nothing planned)", /Nenhum Job ativo|No active Job/i.test(noJob.text) && !noJob.hasName && noJob.start === true, noJob);
  await page.screenshot({ path: `${SHOTS}/J-tracker-nojob.png` });

  // ---- planned Jobs enable Start
  const planned = await page.evaluate(async () => {
    const a = await Item.create({ name: "[TEST] Plan A", type: "job", system: { status: "planned", goal: "[TEST] goal A" } });
    const b = await Item.create({ name: "[TEST] Plan B", type: "job" });
    return { a: a.id, b: b.id, observer: a.ownership.default, status: b.system.status };
  });
  record("a Job created in the directory is planned and hidden from players (NONE)", planned.status === "planned" && planned.observer === 0, planned);
  await wait(800);

  // ---- the player is logged in before the Job starts: it must not see the planned Job, then receive it live
  playerBrowser = await openBrowser(env, { secondary: true });
  const pp = playerBrowser.page;
  playerLog = collectConsole(pp);
  await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });
  await pp.waitForTimeout(1500);
  const hiddenBefore = await pp.evaluate((id) => { const i = game.items.get(id); return { level: i?.ownership?.default, canSee: Boolean(i?.testUserPermission(game.user, "LIMITED")) }; }, planned.a);
  record("a planned Job is not visible to the player", !hiddenBefore.canSee, hiddenBefore);
  record("Start enables when a Job is planned", (await page.locator(`${app} [data-action="startJob"]`).isDisabled()) === false);

  // ---- start a planned Job through the same action as the button
  const started = await page.evaluate(async (ids) => {
    const ja = await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/gm/job-actions.mjs"));
    await ja.startPlannedJob(game.items.get(ids.a));
    return { active: lvTestJob.get(), statuses: [ids.a, ids.b].map((id) => game.items.get(id).system.status) };
  }, planned);
  record("Start makes Plan A active", started.active.name === "[TEST] Plan A" && started.statuses[0] === "active", started);
  await wait(1200);
  const liveSeen = await pp.evaluate((id) => ({ canSee: Boolean(game.items.get(id)?.testUserPermission(game.user, "OBSERVER")), job: game.leverage.job.get().name }), planned.a);
  record("starting the Job makes it visible live to the player (OBSERVER)", liveSeen.canSee && liveSeen.job === "[TEST] Plan A", liveSeen);
  record("Tracker shows the active Job name and goal", (await page.locator(`${app} .lv-trk-jobname-text`).textContent()).trim() === "[TEST] Plan A" && (await page.locator(`${app} [name="jobGoal"]`).inputValue()) === "[TEST] goal A");
  await page.screenshot({ path: `${SHOTS}/J-tracker-active.png` });

  // one active at a time: starting B demotes A; setting A active by hand demotes B
  const swap = await page.evaluate(async (ids) => {
    const ja = await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/gm/job-actions.mjs"));
    await ja.startPlannedJob(game.items.get(ids.b));
    const afterStart = [ids.a, ids.b].map((id) => game.items.get(id).system.status);
    await game.items.get(ids.a).update({ "system.status": "active" });
    await new Promise((r) => setTimeout(r, 800));
    return { afterStart, afterEdit: [ids.a, ids.b].map((id) => game.items.get(id).system.status) };
  }, planned);
  record("starting Plan B puts Plan A back to planned", swap.afterStart.join() === "planned,active", swap);
  record("editing a status to active by hand demotes the other", swap.afterEdit.join() === "active,planned", swap);
  const demoted = await page.evaluate((ids) => [ids.a, ids.b].map((id) => game.items.get(id).ownership.default), planned);
  record("after the swap Plan B (demoted) is hidden again (NONE), Plan A is OBSERVER", demoted.join() === "2,0", demoted);

  // ---- sheets
  await page.evaluate(async (id) => { await game.items.get(id).sheet.render({ force: true }); }, planned.a);
  await wait(1200);
  const sheet = await page.evaluate(() => {
    const el = document.querySelector(".lv-item-sheet.job-sheet");
    return {
      status: el?.querySelector('[name="system.status"]')?.value, goal: el?.querySelector('[name="system.goal"]')?.value,
      total: Boolean(el?.querySelector('[name="system.payout.total"]')), share: Boolean(el?.querySelector('[name="system.payout.share"]')),
      callback: Boolean(el?.querySelector('[name="system.callbackUsed"]')), spent: Boolean(el?.querySelector('[name="system.spent"]')), notes: Boolean(el?.querySelector(".lv-item-rich"))
    };
  });
  record("world Job sheet: status, goal, total payout, notes; no share, Callback or spent", sheet.status === "active" && sheet.goal === "[TEST] goal A" && sheet.total && sheet.notes && !sheet.share && !sheet.callback && !sheet.spent, sheet);
  await page.screenshot({ path: `${SHOTS}/J-sheet-world.png` });
  await page.locator(".lv-item-sheet.job-sheet [name=\"system.status\"]").selectOption("done");
  await wait(800);
  const done = await page.evaluate((id) => game.items.get(id).system.status, planned.a);
  record("the status select saves", done === "done", done);
  const visDone = await page.evaluate((id) => game.items.get(id).ownership.default, planned.a);
  record("done keeps OBSERVER", visDone === 2, visDone);
  await page.evaluate((id) => game.items.get(id).sheet.close(), planned.a);
  await page.evaluate(async (id) => game.items.get(id).update({ "system.status": "planned" }), planned.a);
  await wait(700);
  const visPlanned = await page.evaluate((id) => game.items.get(id).ownership.default, planned.a);
  record("back to planned by hand hides it again", visPlanned === 0, visPlanned);

  // ---- end the active Job (Plan B)
  const end = await page.evaluate(async ([ids, crewId]) => {
    const ja = await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/gm/job-actions.mjs"));
    await ja.startPlannedJob(game.items.get(ids.b));
    const crew = game.actors.get(crewId);
    const paid = await ja.endJob({ name: "[TEST] Plan B done", total: 3, shares: { [crewId]: 2 } });
    const job = game.items.get(ids.b);
    const rec = crew.items.find((i) => i.type === "job" && i.name === "[TEST] Plan B done");
    const linked = rec && fromUuidSync(rec.getFlag("leverage-gta", "jobUuid") ?? "");
    const msg = game.messages.contents.at(-1)?.content ?? "";
    return {
      paid, status: job.system.status, name: job.name, total: job.system.payout.total, active: lvTestJob.get().name,
      share: rec?.system.payout.share, linked: linked?.id === ids.b, msg, recordId: rec?.id,
      crewList: job.system.payout.crew.find((c) => c.actorUuid === crew.uuid)
    };
  }, [planned, made.crew]);
  record("End Job: world Job kept as done with the name and total", end.status === "done" && end.name === "[TEST] Plan B done" && end.total === 3 && end.active === "", end);
  record("End Job: the Record has the share and links to the world Job", end.paid >= 1 && end.share === 2 && end.linked, end);
  record("End Job: the world Job keeps the share of each Crew (payout.crew)", end.crewList?.share === 2 && end.crewList?.name === "[TEST] J Crew", end.crewList);
  record("End Job: the chat line carries an @UUID link", /@UUID\[Item\./.test(end.msg), end.msg);
  await wait(500);

  // ---- the done world Job sheet lists the shares (read only)
  await page.evaluate((id) => game.items.get(id).sheet.render({ force: true }), planned.b);
  await wait(1200);
  const doneSheet = await page.evaluate(() => [...document.querySelectorAll(".lv-item-sheet.job-sheet .lv-item-share")].map((li) => li.innerText.replace(/\s+/g, " ").trim()));
  record("the done Job sheet lists the share of each character", doneSheet.some((row) => /\[TEST\] J Crew\s*2/.test(row)), doneSheet);
  await page.screenshot({ path: `${SHOTS}/J-sheet-done.png` });
  await page.evaluate((id) => game.items.get(id).sheet.close(), planned.b);

  // ---- End Job through the dialog (the real flow of the button)
  const viaDialog = await page.evaluate(async () => {
    const ja = await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/gm/job-actions.mjs"));
    const c = await Item.create({ name: "[TEST] Plan C", type: "job" });
    await ja.startPlannedJob(c);
    window.lvEnd = ja.endJobDialog();
    return { id: c.id };
  });
  await page.locator('.lv-dialog input[name="total"]').waitFor({ timeout: 8000 });
  await page.locator('.lv-dialog input[name="total"]').fill("4");
  for (const input of await page.locator(".lv-dialog .lv-dlg-share").all()) await input.fill("0");
  await page.locator(`.lv-dialog input[name="share-${made.crew}"]`).fill("3");
  await page.locator('.lv-dialog button[data-action="ok"]').click();
  const dlg = await page.evaluate(async ([id, crewId]) => {
    const paid = await window.lvEnd;
    const job = game.items.get(id);
    const rec = game.actors.get(crewId).items.find((i) => i.type === "job" && i.name === "[TEST] Plan C");
    return { paid, status: job.system.status, total: job.system.payout.total, share: rec?.system.payout.share, linked: rec?.getFlag("leverage-gta", "jobUuid") === job.uuid };
  }, [viaDialog.id, made.crew]);
  record("endJobDialog: world Job done with total, Record with share and jobUuid", dlg.paid >= 1 && dlg.status === "done" && dlg.total === 4 && dlg.share === 3 && dlg.linked, dlg);

  // ---- Start with an active Job: one dialog on a double click, then a confirmation before replacing
  const replace = await page.evaluate(async (ids) => {
    const ja = await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/gm/job-actions.mjs"));
    await ja.startPlannedJob(game.items.get(ids.a));
    const d = game.items.get(ids.b);
    await d.update({ "system.status": "planned" });
    window.lvStart = [ja.startJobDialog([d]), ja.startJobDialog([d])];
    await new Promise((r) => setTimeout(r, 700));
    return { dialogs: document.querySelectorAll(".lv-dialog").length };
  }, planned);
  record("double click on Start opens one dialog only", replace.dialogs === 1, replace);
  await page.locator('.lv-dialog button[data-action="ok"]').click();
  await wait(900);
  const asked = await page.evaluate(() => document.querySelector(".lv-dialog")?.innerText ?? "");
  record("starting over an active Job asks for confirmation", /Plan A/.test(asked), asked);
  await page.locator('.lv-dialog button[data-action="yes"]').click();
  const replaced = await page.evaluate(async (ids) => {
    await Promise.all(window.lvStart);
    return [ids.a, ids.b].map((id) => game.items.get(id).system.status);
  }, planned);
  record("confirming replaces the active Job", replaced.join() === "planned,active", replaced);
  await page.evaluate(async (ids) => game.items.get(ids.a).update({ "system.status": "active" }), planned);
  await wait(700);

  // ---- drag: a world Job dropped on a sheet becomes a Record; a Record copied to the directory becomes a clean planned Job
  const drag = await page.evaluate(async ([crewId, ids]) => {
    const { dropItem } = await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/actor/parts/drag.mjs"));
    const crew = game.actors.get(crewId);
    const world = game.items.get(ids.b);
    await dropItem(crew, { target: document.body }, { type: "Item", uuid: world.uuid });
    const rec = crew.items.find((i) => i.type === "job" && i.name === world.name && i.system.payout.share === 0 && i.getFlag("leverage-gta", "jobUuid") === world.uuid);
    const full = crew.items.find((i) => i.type === "job" && i.system.payout.share === 3);
    const copy = await Item.create(full.toObject());
    const out = {
      rec: Boolean(rec), recStatus: rec?.system.status, copyStatus: copy.system.status, copyOwner: copy.ownership.default,
      copyShare: copy.system.payout.share, copyFlag: copy.getFlag("leverage-gta", "jobUuid") ?? null, copyCrew: copy.system.payout.crew.length
    };
    await copy.delete();
    return out;
  }, [made.crew, planned]);
  record("dropping a world Job on a sheet builds a Record with the link and no share", drag.rec, drag);
  record("a Record copied to the Items directory becomes a clean planned Job (NONE, no share, no link)",
    drag.copyStatus === "planned" && drag.copyOwner === 0 && drag.copyShare === 0 && drag.copyFlag === null && drag.copyCrew === 0, drag);

  // ---- Record sheet unchanged
  await page.evaluate(async ([crewId, id]) => { await game.actors.get(crewId).items.get(id).sheet.render({ force: true }); }, [made.crew, end.recordId]);
  await wait(1200);
  const rec = await page.evaluate(() => {
    const el = document.querySelector(".lv-item-sheet.job-sheet");
    return { status: Boolean(el?.querySelector('[name="system.status"]')), share: Boolean(el?.querySelector('[name="system.payout.share"]')), callback: Boolean(el?.querySelector('[name="system.callbackUsed"]')), spent: Boolean(el?.querySelector('[name="system.spent"]')) };
  });
  record("Record sheet: share, Callback, spent; no status", !rec.status && rec.share && rec.callback && rec.spent, rec);
  await page.screenshot({ path: `${SHOTS}/J-sheet-record.png` });
  await page.evaluate(([crewId, id]) => game.actors.get(crewId).items.get(id).sheet.close(), [made.crew, end.recordId]);

  // ---- player view (Plan A is active again)
  await page.evaluate(async (id) => game.items.get(id).update({ "system.status": "active" }), planned.a);
  await wait(500);
  await pp.waitForTimeout(1000);
  const seen = await pp.evaluate(() => ({ job: game.leverage.job.get(), jobs: game.items.filter((i) => i.type === "job" && !i.parent).length }));
  record("player reads the active Job", seen.job.name === "[TEST] Plan A" && seen.jobs >= 2, seen);
  const sheetP = await pp.evaluate(async (id) => {
    await game.items.get(id).sheet.render({ force: true });
    await new Promise((r) => setTimeout(r, 1000));
    const el = document.querySelector(".lv-item-sheet.job-sheet");
    return { open: Boolean(el), editable: [...(el?.querySelectorAll("input, select") ?? [])].some((i) => !i.disabled) };
  }, planned.a);
  record("player opens the Job sheet read-only", sheetP.open && !sheetP.editable, sheetP);
  await pp.screenshot({ path: `${SHOTS}/J-sheet-player.png` });
  record("no system console errors", log.own().length === 0 && playerLog.own().length === 0, [...log.own(), ...playerLog.own()]);
} catch (error) {
  record("script", false, String(error).slice(0, 600));
  await page.screenshot({ path: `${SHOTS}/J-failure.png` }).catch(() => {});
} finally {
  try {
    await page.evaluate(async ([before, m]) => {
      for (const a of game.actors.filter((x) => x.name.startsWith("[TEST] J"))) await a.delete();
      for (const open of foundry.applications.instances.values()) if (open.id === "leverage-job-tracker") await open.close();
      if (before) {
        await lvTestJob.restore(before.jobs);
        await game.settings.set("leverage-gta", "complications", before.complications);
        const junk = game.messages.filter((x) => !before.msgs.includes(x.id)).map((x) => x.id);
        if (junk.length) await ChatMessage.deleteDocuments(junk);
      }
      if (m?.created) await game.users.get(m.user)?.delete();
    }, [saved, made]);
  } catch (error) { console.log("cleanup failed", String(error).slice(0, 200)); }
  await playerBrowser?.browser.close();
  await browser.close();
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail.slice(0, 500)}` : ""}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
