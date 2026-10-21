/**
 * Check: no explanatory text on the crew sheet, HUD and dialogs; HUD labels; compact loose dice in the Pool builder
 * that sits beside the sheet. Creates [TEST] data and deletes it.
 * Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
let id = null;

try {
  await login(page, env);
  id = await page.evaluate(async () => {
    const crew = await Actor.create({ name: "[TEST] Hints", type: "crew", system: { money: { steps: 6 }, plotPoints: { value: 2 } } });
    await crew.createEmbeddedDocuments("Item", [
      { name: "[TEST] Crowbar", type: "asset" }, { name: "[TEST] Lockpicks", type: "specialty" },
      { name: "[TEST] Ex-con", type: "distinction" }, { name: "[TEST] Ghost", type: "talent", system: { die: 6 } },
      { name: "[TEST] Heist", type: "job" }
    ]);
    await crew.sheet.render(true);
    await game.user.update({ character: crew.id });
    return crew.id;
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/NOHINTS-sheet.png` });

  const texts = await page.evaluate(() => [...document.querySelectorAll(".crew-sheet [title], .crew-sheet .lv-panel-hint")]
    .map((e) => e.title || e.textContent));
  const banned = /clique|click|\+d6|Escolha|Choose|Equilíbrio|Balance|Permanente|Spend|Gaste/i;
  record("sheet has no instructional titles/hints", !texts.some((x) => banned.test(x)), texts.filter((x) => banned.test(x)));

  await page.locator(".crew-sheet [data-action=folderTab][data-tab=jobs]").click();
  await page.waitForTimeout(600);
  const summary = await page.locator(".crew-sheet .lv-jobs-summary").innerText();
  record("jobs summary short", !/LIVRES|UNSPENT/i.test(summary), summary);
  await page.screenshot({ path: `${SHOTS}/NOHINTS-jobs.png` });

  // HUD
  const hud = await page.evaluate(() => ({
    cap: document.querySelector("#leverage-hud .lv-hud-cap")?.textContent,
    pp: document.querySelector("#leverage-hud .lv-hud-chip-text")?.textContent,
    minus: document.querySelector("#leverage-hud [data-action=spendPlotPoint] .lv-hud-round-text")?.textContent,
    tip: document.querySelector("#leverage-hud .lv-hud-money")?.dataset.tooltip
  }));
  record("HUD labels", hud.cap && hud.pp && hud.minus && !/clique|click/i.test(hud.tip ?? ""), hud);
  const box = await page.locator("#leverage-hud .lv-hud-body").boundingBox();
  if (box) await page.screenshot({ path: `${SHOTS}/NOHINTS-hud.png`, clip: { x: Math.max(0, box.x - 30), y: Math.max(0, box.y - 10), width: box.width + 60, height: box.height + 30 } });

  // Pool builder
  await page.locator(".crew-sheet [data-action=addDie]").click();
  await page.locator(".lv-pool-builder .lv-pb-chip").first().waitFor({ timeout: 5000 });
  await page.waitForTimeout(600);
  const geo = await page.evaluate(() => {
    const s = document.querySelector(".crew-sheet").getBoundingClientRect();
    const b = document.querySelector(".lv-pool-builder").getBoundingClientRect();
    const dice = [...document.querySelectorAll(".lv-pb-chip--die")].map((e) => e.getBoundingClientRect());
    return { overlap: b.left < s.right && b.right > s.left, sheet: [s.left, s.right], builder: [b.left, b.right], n: dice.length, rows: new Set(dice.map((d) => Math.round(d.top))).size };
  });
  record("builder does not cover the sheet", !geo.overlap, geo);
  record("five loose dice in one compact row, no repeated labels", geo.n === 5 && geo.rows === 1, geo);
  await page.screenshot({ path: `${SHOTS}/NOHINTS-builder.png` });
  await page.locator(".lv-pool-builder [data-action=done]").click();

} catch (error) {
  record("script ran", false, String(error));
} finally {
  if (id) await page.evaluate(async (i) => { await game.actors.get(i)?.delete(); await game.user.update({ character: null }); }, id).catch(() => {});
  await browser.close();
}

const errors = log.own();
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name} ${r.detail}`);
if (errors.length) console.log("console errors:", errors.slice(0, 5));
process.exit(results.every((r) => r.ok) ? 0 : 1);
