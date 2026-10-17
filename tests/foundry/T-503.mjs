/**
 * T-503 check: roll card buttons in the real Foundry. A [TEST] Player (second browser) uses "+1 PP · Keep 3rd die"
 * (own message, and a GM-authored message through the socket); the GM adds Complications. Creates only `[TEST]`
 * documents, deletes them and restores `activeJob`. Run after `npm run deploy`. Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const wait = (ms) => page.waitForTimeout(ms);
let playerBrowser = null;
let savedJob = null;

/** Rolled dice: 9 and 8 kept, 5 and 3 spare, one 1. */
const ROLL = {
  actorUuid: "", actorName: "[TEST] Rosa", actorImg: "", flavor: "T-503",
  entries: [[10, 9, true], [10, 8, true], [6, 5, false], [4, 3, false], [8, 1, false]].map(([faces, result, kept], i) => ({
    ref: `r${i}`, label: `Die ${i}`, kind: "attribute", faces, result, kept, one: result === 1
  })),
  keptCount: 2, total: 17, ppSpent: 0, distinctionPP: 0, complicationsResolved: [], money: false
};

/** GM page: state of one message, its card and the actor. */
const snapshot = (arg) => {
  const msg = game.messages.get(arg.messageId);
  const el = document.querySelector(`.chat-message[data-message-id="${arg.messageId}"]`);
  const roll = msg.getFlag("leverage-gta", "roll");
  return {
    roll, pp: game.actors.get(arg.actorId).system.plotPoints.value, job: game.settings.get("leverage-gta", "activeJob"),
    total: el?.querySelector(".lv-roll-total-num")?.textContent.trim(),
    notes: [...(el?.querySelectorAll(".lv-roll-note") ?? [])].map((n) => n.textContent.trim()),
    ones: Boolean(el?.querySelector(".lv-roll-ones")),
    buttons: [...(el?.querySelectorAll(".lv-roll-btn") ?? [])].map((b) => b.dataset.action)
  };
};

try {
  await login(page, env);
  const ids = await page.evaluate(async (template) => {
    const player = await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    const actor = await Actor.create({
      name: "[TEST] Rosa", type: "crew", system: { plotPoints: { value: 3 } },
      ownership: { default: 0, [player.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER }
    });
    const data = { ...template, actorUuid: actor.uuid };
    const make = (author) => ChatMessage.create({ author, content: "<p>T-503</p>", flags: { "leverage-gta": { roll: data } } });
    const own = await make(player.id);
    const viaGM = await make(game.user.id);
    const saved = game.settings.get("leverage-gta", "activeJob");
    await game.settings.set("leverage-gta", "activeJob", { name: "[TEST] Job", complications: [] });
    ui.sidebar.changeTab?.("chat", "primary");
    return { actorId: actor.id, own: own.id, viaGM: viaGM.id, saved };
  }, ROLL);
  savedJob = ids.saved;
  await wait(1500);

  // Player browser (no lock: it is another user than the GM test user).
  const { chromium } = await import("playwright");
  const httpCredentials = env.FOUNDRY_HTTP_USER ? { username: env.FOUNDRY_HTTP_USER, password: env.FOUNDRY_HTTP_PASSWORD ?? "" } : undefined;
  playerBrowser = await chromium.launch();
  const pp = await playerBrowser.newPage({ viewport: { width: 1920, height: 1080 }, httpCredentials });
  const playerLog = collectConsole(pp);
  await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });
  await pp.evaluate(() => ui.sidebar.changeTab?.("chat", "primary"));
  await pp.waitForTimeout(1000);
  const cardOf = (p, id) => p.locator(`.chat-message[data-message-id="${id}"]`);
  const playerButtons = (id) => pp.evaluate((i) => [...document.querySelectorAll(`.chat-message[data-message-id="${i}"] .lv-roll-btn`)].map((b) => b.dataset.action), id);
  // DOM click: the chat log keeps the card moving, which makes Playwright wait for a stable element forever.
  const clickCard = (p, id, action) => p.evaluate(([i, a]) => document.querySelector(`.chat-message[data-message-id="${i}"] [data-action="${a}"]`).click(), [id, action]);
  const arg = (messageId) => ({ messageId, actorId: ids.actorId });

  record("player sees only the KEEP button", (await playerButtons(ids.own)).join() === "keepDie", await playerButtons(ids.own));

  // Own message: a double click spends only one Plot Point.
  await pp.evaluate((i) => {
    const b = document.querySelector(`.chat-message[data-message-id="${i}"] [data-action="keepDie"]`);
    b.click(); b.click();
  }, ids.own);
  await wait(1500);
  let s = await page.evaluate(snapshot, arg(ids.own));
  record("double click: one die kept, one PP spent", s.roll.ppSpent === 1 && s.pp === 2 && s.roll.keptCount === 3 && s.roll.total === 22, s);
  record("card on GM side: total 22 and PP spent note", s.total === "22" && s.notes.some((n) => n.includes("+1")), s);
  await clickCard(pp, ids.own, "keepDie");
  await wait(1500);
  s = await page.evaluate(snapshot, arg(ids.own));
  record("repeat: 4th die, total 25, PP 1", s.roll.ppSpent === 2 && s.roll.total === 25 && s.pp === 1 && s.roll.entries.filter((e) => e.kept).length === 4, s);
  record("no spare die: KEEP button gone for the player", (await playerButtons(ids.own)).length === 0, await playerButtons(ids.own));

  // GM-authored message: the player cannot update it, so the socket carries the request.
  await clickCard(pp, ids.viaGM, "keepDie");
  await wait(2000);
  s = await page.evaluate(snapshot, arg(ids.viaGM));
  record("socket path: GM applied it (die kept, PP 0)", s.roll.ppSpent === 1 && s.roll.total === 22 && s.pp === 0, s);
  record("player with 0 PP has no KEEP button", (await playerButtons(ids.viaGM)).length === 0, await playerButtons(ids.viaGM));

  // GM: Complication on the own message (new), then on the other one (raise the same Complication).
  const complicate = async (id, fillName) => {
    await clickCard(page, id, "complication");
    const dlg = page.locator(".application.lv-dialog");
    await dlg.waitFor({ timeout: 5000 });
    if (fillName) await dlg.locator('input[name="name"]').fill(fillName);
    else await dlg.locator('select[name="target"]').selectOption({ index: 1 });
    await dlg.locator('button[data-action="ok"]').click();
    await wait(1500);
  };
  s = await page.evaluate(snapshot, arg(ids.own));
  const ppBefore = s.pp;
  record("GM sees the COMPLICATION button", s.buttons.includes("complication"), s);
  await complicate(ids.own, "[TEST] Alarm");
  s = await page.evaluate(snapshot, arg(ids.own));
  record("new Complication: d6 in activeJob", s.job.complications.length === 1 && s.job.complications[0].name === "[TEST] Alarm" && s.job.complications[0].die === 6, s.job);
  record("player got 1 PP, the 1 is resolved, warning and button gone",
    s.pp === ppBefore + 1 && s.roll.complicationsResolved.join() === "4" && !s.ones && !s.buttons.includes("complication"), s);
  await page.evaluate(() => { document.querySelector("#chat .chat-scroll, #chat-log")?.scrollTo(0, 1e6); });
  await wait(600);
  const box = await cardOf(page, ids.own).boundingBox();
  await page.screenshot({ path: `${SHOTS}/T-503-card.png`, clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
  await complicate(ids.viaGM, "");
  s = await page.evaluate(snapshot, arg(ids.viaGM));
  record("existing Complication raised d6 to d8, no new one", s.job.complications.length === 1 && s.job.complications[0].die === 8, s.job);

  record("no system errors in console", log.own().length === 0 && playerLog.own().length === 0, [...log.own(), ...playerLog.own()]);
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-503-failure.png` }).catch(() => {});
} finally {
  await playerBrowser?.close().catch(() => {});
  await page.evaluate(async (saved) => {
    const test = game.actors.filter((x) => x.name.startsWith("[TEST]"));
    const uuids = new Set(test.map((a) => a.uuid));
    const msgs = game.messages.filter((m) => uuids.has(m.getFlag("leverage-gta", "roll")?.actorUuid)).map((m) => m.id);
    if (msgs.length) await ChatMessage.deleteDocuments(msgs);
    for (const a of test) await a.delete();
    await game.users.getName("[TEST] Player")?.delete();
    if (saved) await game.settings.set("leverage-gta", "activeJob", saved);
  }, savedJob).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
