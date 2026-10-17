/**
 * T-502 check: Pool roll and chat card, in the real Foundry. Creates only `[TEST]` actors and deletes them (and their
 * chat messages) at the end. Run after `npm run deploy`. Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const wait = (ms) => page.waitForTimeout(ms);
const sheet = ".application.crew-sheet";

/** Runs in the page: Rosa Delgado with the Traits of the mockup. */
async function setup() {
  const actor = await Actor.create({
    name: "[TEST] Rosa Delgado", type: "crew",
    system: { attributes: { agility: { die: 10 } }, roles: { thief: { die: 10 } }, money: { steps: 8 }, plotPoints: { value: 1 } }
  });
  await actor.createEmbeddedDocuments("Item", [
    { name: "Safecracking", type: "specialty", system: { role: "thief" } },
    { name: "Old Docks Loyalty", type: "distinction" }
  ]);
  await actor.sheet.render({ force: true });
  await new Promise((r) => setTimeout(r, 1500));
  return actor.id;
}

/** Runs in the page: the latest roll message of the actor. */
function lastRoll(actorId) {
  const msg = game.messages.contents.filter((m) => m.getFlag("leverage-gta", "roll")?.actorUuid === `Actor.${actorId}`).at(-1);
  const el = msg && document.querySelector(`.chat-message[data-message-id="${msg.id}"]`);
  const actor = game.actors.get(actorId);
  return {
    flags: msg?.getFlag("leverage-gta", "roll") ?? null,
    rolls: msg?.rolls.length, dice: msg?.rolls[0]?.dice.length, flavor: msg?.flavor,
    card: el && {
      dice: el.querySelectorAll(".lv-roll-die").length,
      kept: el.querySelectorAll(".lv-die--kept").length,
      chips: el.querySelectorAll(".lv-roll-chip").length,
      total: el.querySelector(".lv-roll-total-num")?.textContent.trim(),
      explain: el.querySelector(".lv-roll-explain")?.innerText.replace(/\s+/g, " ").trim(),
      buttons: [...el.querySelectorAll(".lv-roll-btn")].map((b) => b.dataset.action),
      ones: Boolean(el.querySelector(".lv-roll-ones")),
      overflow: [...el.querySelectorAll(".lv-roll-card *")].some((n) => n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflow === "visible"),
      cardWidth: el.querySelector(".lv-roll-card").getBoundingClientRect().width,
      headerHidden: getComputedStyle(el.querySelector(".message-header")).display === "none"
    },
    pp: actor.system.plotPoints.value, money: actor.system.money.steps
  };
}

const clickRow = async (text) => {
  await page.locator(`${sheet} [data-pool-ref]:not(.lv-chip)`).filter({ hasText: text }).first().click();
  await wait(400);
};
const clickRef = async (ref) => {
  await page.locator(`${sheet} .lv-row [data-pool-ref="${ref}"]`).first().click();
  await wait(400);
};
const roll = async () => {
  await page.click(`${sheet} .lv-roll-btn`);
  await wait(2500);
};

try {
  await login(page, env);
  const id = await page.evaluate(setup);
  const ids = await page.evaluate((i) => Object.fromEntries(game.actors.get(i).items.map((x) => [x.name, x.id])), id);

  await page.evaluate(() => { ui.sidebar.expand?.(); ui.sidebar.changeTab?.("chat", "primary"); });
  await wait(600);
  await clickRow("Agility");
  await clickRow("Thief");
  await clickRef(`item:${ids.Safecracking}`);
  await clickRef(`item:${ids["Old Docks Loyalty"]}:d4`);
  await roll();
  let r = await page.evaluate(lastRoll, id);
  const f = r.flags;
  record("message created with a Roll of 4 Die terms", r.rolls === 1 && r.dice === 4, r);
  record("flags: 4 entries in Pool order with faces", f?.entries.map((e) => e.faces).join() === "10,10,6,4", f);
  const eligible = f.entries.filter((e) => !e.one).map((e) => e.result).sort((a, b) => b - a);
  record("total is the two highest non-1 dice", f.total === (eligible[0] ?? 0) + (eligible[1] ?? 0) && f.keptCount === Math.min(2, eligible.length), f);
  record("d4 Distinction gave +1 PP", f.distinctionPP === 1 && r.pp === 2, { pp: r.pp, f: f.distinctionPP });
  record("money untouched without a money die", f.money === false && r.money === 8, r);
  record("card drawn: dice, chips, total", r.card?.dice === 4 && r.card.chips === 4 && r.card.total === String(f.total) && r.card.headerHidden, r.card);
  record("card has KEEP button when a spare die and PP exist",
    r.card.buttons.includes("keepDie") === (f.entries.some((e) => !e.kept && !e.one)), r.card);
  record("card is 330-ish px wide, nothing overflows", r.card.cardWidth > 250 && !r.card.overflow, r.card);
  record("pool cleared after rolling", (await page.locator(`${sheet} .lv-tray-chips .lv-chip[data-pool-ref]`).count()) === 0);

  // Money in the pool
  await clickRow("Agility");
  await clickRow("Thief");
  await page.click(`${sheet} [data-action="addDie"]`);
  await page.locator(".lv-pool-menu-item").last().click();
  await wait(400);
  await roll();
  r = await page.evaluate(lastRoll, id);
  record("Money die in the Pool: money flag and one step down", r.flags.money === true && r.money === 7 && r.flags.entries.some((e) => e.kind === "money"), r);

  // Visual: scroll chat to the latest and capture the card.
  await page.evaluate(() => { const log = document.querySelector("#chat .chat-scroll, #chat-log"); log?.scrollTo(0, 1e6); });
  await wait(500);
  const el = page.locator(".chat-message.lv-roll-message").last();
  await el.screenshot({ path: `${SHOTS}/T-502-card.png` });
  record("no system errors in console", log.own().length === 0, log.own());
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-502-failure.png` }).catch(() => {});
} finally {
  await page.evaluate(async () => {
    const test = game.actors.filter((x) => x.name.startsWith("[TEST]"));
    const uuids = new Set(test.map((a) => a.uuid));
    const msgs = game.messages.filter((m) => uuids.has(m.getFlag("leverage-gta", "roll")?.actorUuid)).map((m) => m.id);
    if (msgs.length) await ChatMessage.deleteDocuments(msgs);
    for (const a of test) { await a.sheet.close(); await a.delete(); }
  }).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
