/**
 * T-504 check: opposition roller and the Fixer card, in the real Foundry. Sets `wanted` (Liberty City, 3 stars) and
 * `activeJob` (one Complication), builds 2d6 + police + Complication in the roller, rolls, checks the card and the
 * flags, then deletes the message and restores both settings. Run after `npm run deploy`.
 * Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const wait = (ms) => page.waitForTimeout(ms);
const app = "#leverage-opposition-roller";
const FLAVOR = "[TEST] Guards at the door";
let saved = null;

try {
  await login(page, env);
  saved = await page.evaluate(async () => {
    const s = { wanted: game.settings.get("leverage-gta", "wanted"), job: game.settings.get("leverage-gta", "activeJob") };
    await game.settings.set("leverage-gta", "wanted", { city: "liberty", level: 3 });
    await game.settings.set("leverage-gta", "activeJob", { name: "[TEST] Job", complications: [{ id: "c1", name: "[TEST] Alarm", die: 8 }] });
    ui.sidebar.expand?.(); ui.sidebar.changeTab?.("chat", "primary");
    const { openOppositionRoller } = await import(foundry.utils.getRoute("systems/leverage-gta/module/dice/opposition.mjs"));
    await openOppositionRoller();
    return s;
  });
  await page.locator(app).waitFor({ timeout: 8000 });
  await wait(500);
  record("roller has the system root class and a title", await page.locator(`${app}.leverage-gta .window-title`).count() === 1);

  await page.locator(`${app} [data-action="step"][data-die="6"][data-delta="1"]`).click();
  await page.locator(`${app} [data-action="step"][data-die="6"][data-delta="1"]`).click();
  await page.locator(`${app} [data-action="togglePolice"]`).click();
  await page.locator(`${app} input[data-key="job.c1"]`).check();
  await page.locator(`${app} input[name="label"]`).fill(FLAVOR);
  await wait(400);
  const preview = await page.locator(`${app} .lv-opp-pool-dice .lv-die`).count();
  record("Pool preview shows 5 dice (2d6 + police 3 stars + Complication)", preview === 5, preview);
  await page.locator(app).screenshot({ path: `${SHOTS}/T-504-roller.png` });
  const overlap = await page.evaluate((sel) => {
    const root = document.querySelector(sel);
    return [...root.querySelectorAll("button, label, input, select")].some((n) => n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflow === "visible" && n.tagName !== "SELECT" && n.tagName !== "INPUT");
  }, app);
  record("nothing overflows its box", !overlap);

  await page.locator(`${app} [data-action="roll"]`).click();
  await wait(2000);
  const r = await page.evaluate((flavor) => {
    const msg = game.messages.contents.filter((m) => m.getFlag("leverage-gta", "roll")?.flavor === flavor).at(-1);
    const el = msg && document.querySelector(`.chat-message[data-message-id="${msg.id}"]`);
    return {
      id: msg?.id, flags: msg?.getFlag("leverage-gta", "roll"), dice: msg?.rolls[0]?.dice.length,
      name: el?.querySelector(".lv-roll-name")?.textContent.trim(),
      mug: el?.querySelectorAll(".lv-roll-mug").length, accent: Boolean(el?.querySelector(".lv-roll-card--opposition")),
      buttons: el?.querySelectorAll(".lv-roll-btn:not(.lv-roll-btn--damage)").length, cardDice: el?.querySelectorAll(".lv-roll-die").length,
      total: el?.querySelector(".lv-roll-total-num")?.textContent.trim(),
      ones: Boolean(el?.querySelector(".lv-roll-ones")), chips: [...(el?.querySelectorAll(".lv-roll-chip") ?? [])].map((c) => c.textContent.trim())
    };
  }, FLAVOR);
  const f = r.flags;
  record("message posted with a Roll of 5 Die terms", r.dice === 5 && f?.entries.length === 5, r);
  record("faces: 2 x d6, police d12 + d6, Complication d8", f?.entries.map((e) => e.faces).sort((a, b) => a - b).join() === "6,6,6,8,12", f?.entries);
  record("flags: opposition, source, no actor", f?.opposition === true && f.source === "manual+police+picked" && f.actorUuid === "", f);
  const eligible = f.entries.filter((e) => !e.one).map((e) => e.result).sort((a, b) => b - a);
  record("total is the two highest non-1 dice", f.total === (eligible[0] ?? 0) + (eligible[1] ?? 0), f);
  record("card headed FIXER, no portrait, red accent", r.name === "FIXER" && r.mug === 0 && r.accent, r);
  record("card has no Plot Point or Complication buttons and no ones warning (APPLY DAMAGE is T-602)", r.buttons === 0 && !r.ones, r);
  record("card shows 5 dice and a total", r.cardDice === 5 && r.total === String(f.total), r);
  record("roller stays open after rolling", await page.locator(app).count() === 1);
  await page.evaluate((id) => document.querySelector(`.chat-message[data-message-id="${id}"]`)?.scrollIntoView(), r.id);
  await wait(500);
  await page.locator(`.chat-message[data-message-id="${r.id}"]`).screenshot({ path: `${SHOTS}/T-504-card.png` });

  // "2d6 (no opposition)" shortcut clears everything else.
  await page.locator(`${app} [data-action="noOpposition"]`).click();
  await wait(300);
  record("no-opposition shortcut: exactly 2 dice", await page.locator(`${app} .lv-opp-pool-dice .lv-die`).count() === 2);
  record("no system errors in console", log.own().length === 0, log.own());
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-504-failure.png` }).catch(() => {});
} finally {
  await page.evaluate(async ([flavor, s]) => {
    const ids = game.messages.filter((m) => m.getFlag("leverage-gta", "roll")?.flavor === flavor).map((m) => m.id);
    if (ids.length) await ChatMessage.deleteDocuments(ids);
    foundry.applications.instances.get("leverage-opposition-roller")?.close();
    if (s) {
      await game.settings.set("leverage-gta", "wanted", s.wanted);
      await game.settings.set("leverage-gta", "activeJob", s.job);
    }
  }, [FLAVOR, saved]).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
