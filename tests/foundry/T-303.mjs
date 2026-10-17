/**
 * T-303 check: Attributes and Roles ladders in the real Foundry. Creates only `[TEST]` actors.
 * Run after `npm run deploy`. Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });

/** Runs in the page: clicks dice and reads the sheet back. */
async function exercise() {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const actor = await Actor.create({ name: "[TEST] Ladders", type: "crew" });
  await actor.sheet.render({ force: true });
  await wait(1500);
  const el = () => actor.sheet.element;
  const dice = (group, key) => [...el().querySelectorAll(`.lv-${group} [data-key="${key}"] .lv-die`)];
  const out = {};
  out.attrDice = dice("attributes", "agility").length;
  out.roleDice = dice("roles", "thief").length;
  out.sizes = [...new Set(dice("attributes", "agility").map((d) => d.getBoundingClientRect().width))];
  out.blankRole = el().querySelector('.lv-roles [data-key="thief"]').classList.contains("is-blank");
  out.blankHasPoolAction = Boolean(el().querySelector('.lv-roles [data-key="thief"] [data-action="togglePool"]'));
  out.litBlank = dice("roles", "thief").filter((d) => !d.classList.contains("lv-die--muted")).length;
  out.attrPoolAction = el().querySelector('.lv-attributes [data-key="agility"] [data-action="togglePool"]')?.dataset.poolRef;
  await game.settings.set("leverage-gta", "traitsLocked", false);
  await wait(500);
  dice("attributes", "agility")[3].click(); // d10
  await wait(600);
  out.agility = actor.system.attributes.agility.die;
  dice("attributes", "agility")[3].click(); // same die: no change
  await wait(400);
  out.agilityAfterSame = actor.system.attributes.agility.die;
  dice("roles", "thief")[2].click(); // d8
  await wait(600);
  out.thief = actor.system.roles.thief.die;
  dice("roles", "thief")[2].click(); // clears
  await wait(600);
  out.thiefCleared = actor.system.roles.thief.die;
  const rows = [...el().querySelectorAll(".lv-attributes .lv-ladder-row, .lv-roles .lv-ladder-row")];
  const heights = rows.map((r) => Math.round(r.getBoundingClientRect().height));
  out.rowHeights = heights;
  const body = el().querySelector(".lv-roles .lv-panel-body");
  out.rolesScrolls = body.scrollHeight > body.clientHeight + 1;
  const col = el().querySelector(".lv-col--left").getBoundingClientRect();
  const last = el().querySelector(".lv-roles").getBoundingClientRect();
  out.bottomGap = Math.round(col.bottom - last.bottom);
  await game.settings.set("leverage-gta", "traitsLocked", true);
  await wait(800);
  out.lockedButtons = el().querySelectorAll(".lv-ladder button.lv-die").length;
  out.lockedTitle = dice("attributes", "agility")[0]?.title;
  out.lockedCursor = getComputedStyle(dice("attributes", "agility")[0]).cursor;
  await game.settings.set("leverage-gta", "traitsLocked", false);
  return out;
}

try {
  await login(page, env);
} catch (err) {
  console.log(`FOUNDRY: not available - ${err.message.split("\n")[0]}`);
  await browser.close();
  process.exit(2);
}

try {
  const m = await page.evaluate(exercise);
  console.log(JSON.stringify(m));
  await page.screenshot({ path: `${SHOTS}/T-303-ladders.png` });
  record("five dice per row, 32px", m.attrDice === 5 && m.roleDice === 5 && m.sizes.join() === "32", m);
  record("blank Role: no lit die, not in Pool", m.blankRole && m.litBlank === 0 && !m.blankHasPoolAction, m);
  record("name emits togglePool ref", m.attrPoolAction === "attributes.agility", m.attrPoolAction);
  record("click sets Attribute, same die keeps it", m.agility === 10 && m.agilityAfterSame === 10, m);
  record("Role set then cleared by clicking current", m.thief === 8 && m.thiefCleared === null, m);
  record("no scrollbar, no dead space", !m.rolesScrolls && m.bottomGap <= 48, m);
  // The test user is a GM, who always passes the lock (docs/06: only non-GM users are blocked), so dice stay buttons; the tooltip must still say locked.
  record("locked (as GM): dice still editable, tooltip says locked", m.lockedButtons > 0 && /trav|lock/i.test(m.lockedTitle ?? ""), m);
  record("no system errors in console", log.own().length === 0, log.own());
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
} finally {
  await page.evaluate(async () => {
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) { await a.sheet.close(); await a.delete(); }
  }).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
