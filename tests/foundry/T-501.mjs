/**
 * T-501 check: Pool tray on the crew sheet, in the real Foundry. Creates only `[TEST]` actors.
 * Run after `npm run deploy`. Exit codes: 0 pass, 1 fail, 2 not available.
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
    system: { attributes: { agility: { die: 10 } }, roles: { thief: { die: 10 }, hitter: { die: 6 } } }
  });
  await actor.createEmbeddedDocuments("Item", [
    { name: "Safecracking", type: "specialty", system: { role: "thief" } },
    { name: "Getaway Driving", type: "specialty", system: { role: "hitter" } },
    { name: "Old Docks Loyalty", type: "distinction" },
    { name: "Adrenaline Junkie", type: "distinction" },
    { name: "Hatchback", type: "asset", system: { die: 8, duration: "signature" } }
  ]);
  await actor.sheet.render({ force: true });
  await new Promise((r) => setTimeout(r, 1500));
  window.__events = [];
  Hooks.on("leverage.rollRequested", (p) => window.__events.push(p.refs));
  return actor.id;
}

/** Runs in the page: reads the tray and the lit rows. */
function readTray() {
  const el = document.querySelector(".crew-sheet");
  const chips = [...el.querySelectorAll(".lv-tray-chips .lv-chip[data-pool-ref]")].map((c) => ({
    kind: c.dataset.kind,
    name: c.querySelector(".lv-chip-name").textContent.trim(),
    die: c.querySelector(".lv-die-num")?.textContent.trim(),
    optional: c.classList.contains("is-optional")
  }));
  const roll = el.querySelector(".lv-roll-btn");
  return {
    chips,
    count: el.querySelector(".lv-tray-count").textContent.replace(/\s+/g, " ").trim(),
    rollDisabled: roll.disabled,
    rollTitle: roll.title,
    lit: [...el.querySelectorAll(".lv-row.is-pooled")].map((r) => r.querySelector("[data-pool-ref]")?.dataset.poolRef),
    overflow: el.querySelector(".lv-tray-chips").scrollWidth > el.querySelector(".lv-tray-chips").clientWidth
  };
}

const click = async (text) => {
  await page.locator(`${sheet} [data-pool-ref]:not(.lv-chip)`).filter({ hasText: text }).first().click();
  await wait(400);
};
const clickRef = async (ref) => {
  await page.locator(`${sheet} .lv-row [data-pool-ref="${ref}"]`).first().click();
  await wait(400);
};
const tray = () => page.evaluate(readTray);

try {
  await login(page, env);
  const id = await page.evaluate(setup);
  const ids = await page.evaluate((i) => Object.fromEntries(game.actors.get(i).items.map((x) => [x.name, x.id])), id);

  let t = await tray();
  record("empty pool: ROLL disabled with a tooltip", t.rollDisabled && t.rollTitle.length > 0 && t.chips.length === 0, t);

  await click("Agility");
  t = await tray();
  record("attribute only: still blocked, tooltip asks for a Role", t.rollDisabled && /Role/.test(t.rollTitle), t);

  await click("Thief");
  await clickRef(`item:${ids.Safecracking}`);
  await clickRef(`item:${ids["Old Docks Loyalty"]}:d8`);
  t = await tray();
  record("mockup pool: 4 dice (Prime: no keep 2)", /^4 (dice|dados)( · (keep|mantém) 2)?$/.test(t.count), t.count);
  record("chips in order with dice", JSON.stringify(t.chips.map((c) => [c.kind, c.name.toUpperCase(), c.die]))
    === JSON.stringify([["attribute", "AGILITY", "10"], ["role", "THIEF", "10"], ["specialty", "SAFECRACKING", "6"], ["distinction", "OLD DOCKS LOYALTY", "8"]]), t.chips);
  record("optional chips are dashed, required solid", t.chips.map((c) => c.optional).join() === "false,false,true,true", t.chips);
  record("ROLL enabled", !t.rollDisabled, t);
  record("rows lit", ["attributes.agility", "roles.thief", `item:${ids.Safecracking}`, `item:${ids["Old Docks Loyalty"]}:d8`].every((r) => t.lit.includes(r)), t.lit);
  await page.screenshot({ path: `${SHOTS}/T-501-tray.png` });

  // second Distinction replaces the first (one per roll)
  await clickRef(`item:${ids["Adrenaline Junkie"]}:d4`);
  t = await tray();
  record("another Distinction replaces the first", t.chips.filter((c) => c.kind === "distinction").length === 1 && /Adrenaline/i.test(t.chips[3].name), t.chips);
  await clickRef(`item:${ids["Adrenaline Junkie"]}:d4`);
  t = await tray();
  record("clicking the row die again takes it out", t.chips.length === 3, t.chips);

  // Distinction chip in the tray: d8 -> d4 -> out
  await clickRef(`item:${ids["Old Docks Loyalty"]}:d8`);
  const distChip = () => page.locator(`${sheet} .lv-tray-chips .lv-chip[data-kind="distinction"]`);
  t = await tray();
  record("Distinction enters as d8", t.chips.find((c) => c.kind === "distinction")?.die === "8", t.chips);
  await distChip().click();
  await wait(400);
  t = await tray();
  record("Distinction chip click: d8 becomes d4", t.chips.find((c) => c.kind === "distinction")?.die === "4", t.chips);
  await distChip().click();
  await wait(400);
  t = await tray();
  record("Distinction chip click again: out of the Pool", !t.chips.some((c) => c.kind === "distinction"), t.chips);

  // + DIE opens the Pool builder window (the old menu is gone in Prime)
  await page.click(`${sheet} [data-action="addDie"]`);
  await page.locator(".lv-pool-builder .lv-pb-chip").first().waitFor({ timeout: 5000 });
  const dieChips = await page.locator(".lv-pool-builder .lv-pb-chip--die").count();
  record("+ DIE builder offers loose dice d4..d12", dieChips >= 5, dieChips);
  await page.locator('.lv-pool-builder .lv-pb-chip--die[data-ref="d6"]').click();
  await wait(400);
  await page.locator('.lv-pool-builder [data-action="done"]').click();
  await wait(400);
  t = await tray();
  record("loose d6 added", /^4 /.test(t.count), t.count);

  // chip click removes
  await page.locator(`${sheet} .lv-tray-chips .lv-chip[data-pool-ref="item:${ids.Safecracking}"]`).click();
  await wait(400);
  t = await tray();
  record("chip click removes and unlights the row", !t.lit.includes(`item:${ids.Safecracking}`) && /^3 /.test(t.count), t);

  // Specialty of another Role: warning, not blocked
  await clickRef(`item:${ids["Getaway Driving"]}`);
  const warn = await page.locator(`${sheet} .lv-chip.has-warning`).count();
  t = await tray();
  record("specialty of another Role warns but does not block", warn === 1 && !t.rollDisabled, { warn, t });

  // ROLL announces the pool
  await page.click(`${sheet} .lv-roll-btn`);
  await wait(300);
  const events = await page.evaluate(() => window.__events);
  record("ROLL fires leverage.rollRequested with refs", events.length === 1 && events[0].includes("roles.thief"), events);

  // blank role blocks
  await page.evaluate(async (i) => game.actors.get(i).update({ "system.roles.hacker.die": 6 }), id);
  await wait(800);
  await clickRef("roles.hacker");
  await page.evaluate(async (i) => game.actors.get(i).update({ "system.roles.hacker.die": null }), id);
  await wait(800);
  t = await tray();
  record("blank Role blocks ROLL", t.rollDisabled && t.rollTitle.length > 0, t);
  record("blank Role chip marked", (await page.locator(`${sheet} .lv-chip.is-problem`).count()) === 1);

  // clear
  await page.click(`${sheet} [data-action="clearPool"]`);
  await wait(400);
  t = await tray();
  record("clear empties pool and rows", t.chips.length === 0 && t.lit.length === 0 && /^0 /.test(t.count), t);

  // survives an actor update (full re-render)
  await click("Agility");
  await page.evaluate(async (i) => game.actors.get(i).update({ name: "[TEST] Rosa D." }), id);
  await wait(1000);
  t = await tray();
  record("pool and lit rows survive a full re-render", t.chips.length === 1 && t.lit.includes("attributes.agility"), t);

  record("no system errors in console", log.own().length === 0, log.own());
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-501-failure.png` }).catch(() => {});
} finally {
  await page.evaluate(async () => {
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) { await a.sheet.close(); await a.delete(); }
  }).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
