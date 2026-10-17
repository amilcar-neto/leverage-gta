/**
 * T-305 check: Assets list and the BACKGROUND / JOBS folder on the crew sheet, in the real Foundry.
 * Creates only `[TEST]` actors. Run after `npm run deploy`. Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const wait = (ms) => page.waitForTimeout(ms);

/** Runs in the page: builds the actor and items, then measures the Assets list. */
async function setup() {
  const actor = await Actor.create({ name: "[TEST] Folder", type: "crew", system: { plotPoints: { value: 1 } } });
  await actor.createEmbeddedDocuments("Item", [
    { name: "Borrowed Hatchback With A Very Long Name To Force An Ellipsis", type: "asset", system: { duration: "signature", die: 8, note: "Rusty, loud, and it never stalls." } },
    { name: "Lockpick Roll", type: "asset", system: { duration: "scene", die: 6 } },
    { name: "Dockside Job", type: "job", system: { payout: { total: 8, share: 2 } } },
    { name: "Tow-Truck Job", type: "job", system: { spent: true, payout: { total: 4, share: 1 } } }
  ]);
  await actor.sheet.render({ force: true });
  await new Promise((r) => setTimeout(r, 1500));
  const el = actor.sheet.element;
  const list = el.querySelector(".lv-assets .lv-scroll");
  const die = el.querySelector(".lv-asset .lv-die-btn").getBoundingClientRect();
  const x = el.querySelector(".lv-asset .lv-xbtn").getBoundingClientRect();
  const name = el.querySelector(".lv-asset .lv-row-name");
  return {
    id: actor.id,
    rows: el.querySelectorAll(".lv-asset").length,
    poolRefs: [...el.querySelectorAll(".lv-asset [data-pool-ref]")].map((n) => n.dataset.poolRef),
    tags: [...el.querySelectorAll(".lv-asset .lv-tag")].map((n) => n.textContent.trim()),
    gutter: getComputedStyle(list).scrollbarGutter,
    dieXOverlap: die.right > x.left,
    ellipsis: name.scrollWidth > name.clientWidth && getComputedStyle(name).textOverflow === "ellipsis"
  };
}

/** Runs in the page: the actor state the checks compare against. */
async function readState(id) {
  const actor = game.actors.get(id);
  return {
    pp: actor.system.plotPoints.value,
    assets: actor.itemTypes.asset.map((a) => [a.name, a.system.duration, a.system.die]),
    spent: actor.itemTypes.job.map((j) => [j.name, j.system.spent, j.system.callbackUsed]),
    background: actor.system.background
  };
}

try {
  await login(page, env);
} catch (err) {
  console.log(`FOUNDRY: not available - ${err.message.split("\n")[0]}`);
  await browser.close();
  process.exit(2);
}

try {
  const m = await page.evaluate(setup);
  const id = m.id;
  const sheet = ".application.crew-sheet";
  record("two asset rows", m.rows === 2, m);
  record("pool refs item:<id>", m.poolRefs.length === 4 && m.poolRefs.every((r) => r.startsWith("item:")), m.poolRefs);
  record("duration tags", /^Signature,(Scene|Cena)$/.test(m.tags.join()), m.tags);
  record("scroll gutter reserved", m.gutter.includes("stable"), m.gutter);
  record("die never under the X", !m.dieXOverlap, m);
  record("long name gets an ellipsis", m.ellipsis, m);

  // + ADD: a Job asset costs 2 PP and the actor has 1, so it is refused
  await page.click(`${sheet} [data-action="addAsset"]`);
  await page.fill(".lv-dialog input[name=name]", "Safehouse");
  await page.selectOption(".lv-dialog select[name=duration]", "job");
  await page.click(".lv-dialog button[data-action=ok]");
  await wait(600);
  let s = await page.evaluate(readState, id);
  record("not enough PP: nothing created, PP intact", s.assets.length === 2 && s.pp === 1, s);

  // A Scene asset costs 1 PP
  await page.click(`${sheet} [data-action="addAsset"]`);
  await page.fill(".lv-dialog input[name=name]", "Fake Badge");
  await page.click(".lv-dialog button[data-action=ok]");
  await wait(800);
  s = await page.evaluate(readState, id);
  record("scene asset created and 1 PP paid", s.assets.length === 3 && s.pp === 0, s);

  // A second Signature suggests d6
  await page.click(`${sheet} [data-action="addAsset"]`);
  await page.selectOption(".lv-dialog select[name=duration]", "signature");
  const die = await page.inputValue(".lv-dialog select[name=die]");
  record("second Signature suggests d6", die === "6", die);
  await page.click(".lv-dialog [data-action=close]");
  await wait(300);

  // Folder tab is remembered across a re-open
  await page.click(`${sheet} [data-action="folderTab"][data-tab="jobs"]`);
  await wait(600);
  const summary = await page.textContent(`${sheet} .lv-jobs-summary`);
  record("jobs header", /2\D+1/.test(summary.replace(/\s+/g, " ")), summary);
  await page.evaluate((i) => game.actors.get(i).sheet.close(), id);
  await page.evaluate((i) => game.actors.get(i).sheet.render({ force: true }), id);
  await wait(1200);
  const remembered = await page.evaluate(() => Boolean(document.querySelector(".crew-sheet .lv-jobs-list")));
  record("open tab is remembered", remembered);

  // Callback toggles and tells the chat; a spent Job has no checkbox
  const before = await page.evaluate(() => game.messages.size);
  await page.click(`${sheet} .lv-job:not(.is-spent) [data-action="toggleCallback"]`);
  await wait(800);
  s = await page.evaluate(readState, id);
  const after = await page.evaluate(() => game.messages.size);
  record("callback marked + chat message", s.spent[0][2] === true && after === before + 1, { s, before, after });
  const boxes = await page.locator(`${sheet} .lv-job.is-spent [data-action="toggleCallback"]`).count();
  record("spent job has no callback box", boxes === 0, boxes);
  await page.screenshot({ path: `${SHOTS}/T-305-jobs.png` });

  // Train Up: a Signature Asset costs 1 Job, so the one unspent Job becomes spent
  await page.click(`${sheet} [data-action="trainUp"]`);
  await page.check(".lv-dialog input[value=signatureAsset]");
  await page.click(".lv-dialog button[data-action=ok]");
  await wait(800);
  s = await page.evaluate(readState, id);
  record("train up spends a job", s.spent.every((j) => j[1] === true), s.spent);

  // Background: edit and save
  await page.click(`${sheet} [data-action="folderTab"][data-tab="background"]`);
  await wait(500);
  await page.click(`${sheet} [data-action="editBackground"]`);
  await wait(800);
  const editor = await page.locator(`${sheet} prose-mirror.lv-bg-editor`).count();
  record("prose-mirror editor opens", editor === 1, editor);
  await page.click(".crew-sheet prose-mirror.lv-bg-editor .ProseMirror");
  await page.keyboard.press("Control+A");
  await page.keyboard.type("RAISED: Dock Row");
  await wait(300);
  await page.click(`${sheet} [data-action="editBackground"]`);
  await wait(900);
  s = await page.evaluate(readState, id);
  record("background saved", /Dock Row/.test(s.background), s.background);
  await page.screenshot({ path: `${SHOTS}/T-305-background.png` });

  record("no system errors in console", log.own().length === 0, log.own());
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-305-failure.png` }).catch(() => {});
} finally {
  await page.evaluate(async () => {
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) { await a.sheet.close(); await a.delete(); }
  }).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
