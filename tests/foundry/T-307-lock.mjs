/**
 * T-307 check: the Trait lock on the crew sheet, seen by a PLAYER in the real Foundry.
 * The GM browser prepares a [TEST] crew actor and a [TEST] Player user; a second browser logs in as that player,
 * opens the sheet and checks that, with the sheet locked (actor flag `sheetUnlocked` absent), the Trait lists have no "+ ADD" / X, the dice ladders do
 * not change, and the seal is visible; and that with the lock off the controls appear and work.
 * Creates only [TEST] documents and deletes them at the end; nothing else to restore. Run after `npm run deploy`.
 * Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
let playerBrowser = null;

/** GM page: creates the actor, its Trait items and the player user; returns the actor id. */
async function prepare() {
  const player = game.users.getName("[TEST] Player")
    ?? await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
  const actor = await Actor.create({
    name: "[TEST] Lock", type: "crew", ownership: { default: 0, [player.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER }
  });
  await actor.createEmbeddedDocuments("Item", [
    { name: "[TEST] Dist", type: "distinction" },
    { name: "[TEST] Talent", type: "talent" },
    { name: "[TEST] Spec", type: "specialty" },
    { name: "[TEST] Asset", type: "asset" }
  ]);
  return actor.id;
}

/** Either page: opens the sheet of `[TEST] Lock` and measures the lock-related controls. */
async function measure(opts = {}) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const actor = game.actors.getName("[TEST] Lock");
  if (!actor.sheet.rendered) await actor.sheet.render({ force: true });
  await wait(opts.settle ?? 1200);
  const el = actor.sheet.element;
  const q = (s) => el.querySelectorAll(s);
  const visible = (n) => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const seal = el.querySelector(".lv-lock-seal");
  return {
    addButtons: ["distinctions", "talents", "specialties"].map((p) => q(`.lv-${p} .lv-add-btn`).length),
    xButtons: q(".lv-distinctions .lv-xbtn, .lv-talents .lv-xbtn, .lv-specialties .lv-xbtn").length,
    assetAdd: q(".lv-assets .lv-add-btn").length,
    ladderButtons: q(".lv-attributes .lv-ladder button, .lv-roles .lv-ladder button").length,
    seal: seal ? { visible: visible(seal), cls: seal.className, label: seal.textContent.trim(), title: seal.title } : null,
    agility: actor.system.attributes.agility.die
  };
}

/** Player page: clicks every ladder die of the Agility row and reports the stored value. */
async function clickLadder() {
  const actor = game.actors.getName("[TEST] Lock");
  const before = actor.system.attributes.agility.die;
  const row = actor.sheet.element.querySelector('.lv-attributes [data-key="agility"]');
  for (const die of row.querySelectorAll(".lv-ladder .lv-die")) die.click();
  await new Promise((r) => setTimeout(r, 800));
  return { before, after: actor.system.attributes.agility.die };
}

/** Player page: clicks the die that differs from the current one and reports the stored value. */
async function clickOtherDie() {
  const actor = game.actors.getName("[TEST] Lock");
  const before = actor.system.attributes.agility.die;
  const want = before === 12 ? 10 : 12;
  actor.sheet.element.querySelector(`.lv-attributes [data-key="agility"] [data-die="${want}"]`).click();
  await new Promise((r) => setTimeout(r, 1000));
  return { before, want, after: actor.system.attributes.agility.die };
}

try {
  await login(page, env);
} catch (err) {
  console.log(`FOUNDRY: not available - ${err.message.split("\n")[0]}`);
  await browser.close();
  process.exit(2);
}

try {
  await page.evaluate(prepare);
  await page.evaluate(() => game.settings.set("leverage-gta", "playersCanUnlock", true)); // the lock is per sheet; absent flag = locked

  playerBrowser = await openBrowser(env, { secondary: true });
  const pp = playerBrowser.page;
  const playerLog = collectConsole(pp);
  await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });
  await pp.waitForFunction(() => game.actors.getName("[TEST] Lock")?.getFlag("leverage-gta", "sheetUnlocked") !== true, null, { timeout: 10000 });

  const locked = await pp.evaluate(measure);
  console.log(JSON.stringify(locked));
  record("locked: no + ADD in Distinctions, Talents, Specialties", locked.addButtons.join() === "0,0,0", locked.addButtons);
  record("locked: no X in the Trait lists", locked.xButtons === 0, locked.xButtons);
  record("locked: Assets stay free (+ ADD present)", locked.assetAdd === 1, locked.assetAdd);
  record("locked: ladder dice are not buttons", locked.ladderButtons === 0, locked.ladderButtons);
  record("locked: seal visible and says locked", locked.seal?.visible && /is-locked/.test(locked.seal.cls) && locked.seal.label.length > 0, locked.seal);
  const clicked = await pp.evaluate(clickLadder);
  record("locked: clicking the ladder does not change the die", clicked.before === clicked.after, clicked);
  await pp.screenshot({ path: `${SHOTS}/T-307-locked.png` });

  const gm = await page.evaluate(measure, { settle: 500 });
  record("GM sees the real lock state in the seal (no tooltip since the seal became a button)", /is-locked/.test(gm.seal?.cls ?? ""), { gm: gm.seal, player: locked.seal });
  record("GM keeps every control while locked", gm.addButtons.join() === "1,1,1" && gm.xButtons === 3 && gm.ladderButtons > 0, gm);

  await page.evaluate(() => game.actors.getName("[TEST] Lock").setFlag("leverage-gta", "sheetUnlocked", true));
  await pp.waitForFunction(() => game.actors.getName("[TEST] Lock")?.getFlag("leverage-gta", "sheetUnlocked") === true, null, { timeout: 10000 });
  const open = await pp.evaluate(measure);
  record("unlocked: + ADD in all three Trait lists", open.addButtons.join() === "1,1,1", open.addButtons);
  record("unlocked: X on each Trait row", open.xButtons === 3, open.xButtons);
  record("unlocked: ladder dice are buttons (6 Attributes + 5 Roles, 5 dice each)", open.ladderButtons === 55, open.ladderButtons);
  record("unlocked: seal updated without reopening", open.seal?.visible && /is-unlocked/.test(open.seal.cls), open.seal);
  const changed = await pp.evaluate(clickOtherDie);
  record("unlocked: clicking a die changes the Attribute", changed.after === changed.want, changed);
  await pp.screenshot({ path: `${SHOTS}/T-307-unlocked.png` });

  record("no system errors in the GM console", log.own().length === 0, log.own());
  record("no system errors in the player console", playerLog.own().length === 0, playerLog.own());
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-307-failure.png` }).catch(() => {});
} finally {
  await playerBrowser?.browser.close().catch(() => {});
  await page.evaluate(async () => {
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) { await a.sheet.close(); await a.delete(); }
    for (const u of game.users.filter((x) => x.name.startsWith("[TEST]"))) await u.delete();
  }).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
