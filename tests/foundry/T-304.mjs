/**
 * T-304 check: Distinctions, Talents and Specialties lists of the crew sheet in the real Foundry.
 * Creates only `[TEST]` actors. Run after `npm run deploy`. Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });

/** Runs in the page: fills a crew actor with items and measures the three lists. */
async function inspectLists() {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const actor = await Actor.create({ name: "[TEST] Lists", type: "crew" });
  await actor.createEmbeddedDocuments("Item", [
    { name: "Old Docks Loyalty", type: "distinction", system: { note: "Helps when calling in favors. Hurts when the plan calls for patience and a very long note." } },
    { name: "Ghost In The Hallway", type: "talent", system: { role: "thief", cost: 1, activation: "You sneak past a Supporting Character who has not noticed you at all." } },
    { name: "Safecracking", type: "specialty", system: { role: "thief" } }
  ]);
  await actor.sheet.render({ force: true });
  await wait(1500);
  const el = actor.sheet.element;
  const q = (s) => el.querySelectorAll(s);
  const out = {
    counter: el.querySelector(".lv-distinctions .lv-panel-hint").textContent.trim(),
    poolRefs: [...q(".lv-distinctions [data-pool-ref]")].map((b) => b.dataset.poolRef),
    addButtons: q(".lv-add-btn").length,
    xButtons: q(".lv-distinctions .lv-xbtn, .lv-talents .lv-xbtn, .lv-specialties .lv-xbtn").length,
    tags: [...q(".lv-talents .lv-tag")].map((t) => t.textContent.trim()),
    overflow: [...q(".lv-panel")].filter((n) => n.scrollWidth > n.clientWidth + 1).map((n) => n.className)
  };
  return { id: actor.id, out };
}

/** Runs in the page: clicks "+ ADD" on Specialties and uses the Role tag menu. */
async function interact(id) {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const actor = game.actors.get(id);
  const el = actor.sheet.element;
  const before = actor.itemTypes.specialty.length;
  el.querySelector('.lv-specialties [data-action="addTraitItem"]').click();
  await wait(1200);
  const added = actor.itemTypes.specialty.length - before;
  for (const app of foundry.applications.instances.values()) if (app.document?.documentName === "Item") await app.close();
  el.querySelector('.lv-specialties [data-action="pickSpecialtyRole"]').click();
  await wait(300);
  const items = [...el.querySelectorAll(".lv-role-menu-item")];
  items.find((b) => !b.classList.contains("is-current"))?.click();
  await wait(800);
  return {
    added, menuItems: items.length, menuClosed: el.querySelectorAll(".lv-role-menu").length === 0,
    roles: actor.itemTypes.specialty.map((i) => i.system.role)
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
  const { id, out: m } = await page.evaluate(inspectLists);
  console.log(JSON.stringify(m));
  record("distinction counter", m.counter === "1 / 3", m.counter);
  record("distinction pool refs d8/d4", m.poolRefs.length === 2 && m.poolRefs[0].endsWith(":d8") && m.poolRefs[1].endsWith(":d4"), m.poolRefs);
  record("three + ADD buttons for the GM", m.addButtons >= 3, m.addButtons);
  record("one X per item", m.xButtons === 3, m.xButtons);
  record("talent shows cost and role tags", m.tags.length === 2, m.tags);
  record("no horizontal overflow", m.overflow.length === 0, m.overflow);
  await page.screenshot({ path: `${SHOTS}/T-304-lists.png` });
  const i = await page.evaluate(interact, id);
  record("+ ADD creates a specialty", i.added === 1, i);
  record("role menu opens, changes role and closes", i.menuItems === 5 && i.menuClosed && i.roles.some((r) => r !== "thief"), i);
  record("no system errors in console", log.own().length === 0, log.own());
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-304-failure.png` }).catch(() => {});
} finally {
  await page.evaluate(async () => {
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) { await a.sheet.close(); await a.delete(); }
  }).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
