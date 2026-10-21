/**
 * Check: "+ DIE" opens the Build Pool window (tabs, search, chips marked when pooled, preview), and the BACKGROUND
 * field edits in place (pencil, autosave on blur, Ctrl+Enter, Escape). Deletes what it creates.
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
    const crew = await Actor.create({ name: "[TEST] Builder", type: "crew", system: { money: { steps: 6 }, background: "<p>Grew up in Portland.</p>" } });
    await crew.createEmbeddedDocuments("Item", [
      { name: "[TEST] Crowbar", type: "asset" }, { name: "[TEST] Lockpicks", type: "specialty" },
      { name: "[TEST] Ex-con with a very long name that must be cut", type: "distinction" }, { name: "[TEST] Ghost", type: "talent", system: { die: 6 } }
    ]);
    await crew.sheet.render(true);
    return crew.id;
  });
  await page.waitForTimeout(1800);

  // ---- Background in place
  const tabs = page.locator(".crew-sheet .lv-folder-tabs");
  await page.screenshot({ path: `${SHOTS}/BG-idle.png` });
  const before = await page.locator(".crew-sheet .lv-folder-page").boundingBox();
  await page.locator(".crew-sheet [data-action=editBackground]").click();
  await page.locator(".crew-sheet prose-mirror.lv-bg-editor .ProseMirror").waitFor({ timeout: 5000 });
  await page.waitForTimeout(500);
  const after = await page.locator(".crew-sheet .lv-folder-page").boundingBox();
  record("editing keeps the page height", Math.abs(before.height - after.height) < 2, { before, after });
  record("editor has the focus", await page.evaluate(() => document.activeElement?.closest("prose-mirror.lv-bg-editor") !== null));
  record("toolbar is hidden", !(await page.locator(".crew-sheet .lv-bg-editor .editor-menu").isVisible().catch(() => false)));
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" Typed one.");
  await page.screenshot({ path: `${SHOTS}/BG-editing.png` });
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(1200);
  record("Ctrl+Enter saves", (await page.evaluate((i) => game.actors.get(i).system.background, id)).includes("Typed one."));
  record("editor closed after save", await page.locator(".crew-sheet prose-mirror.lv-bg-editor").count() === 0);

  await page.locator(".crew-sheet .lv-bg-text").dblclick();
  await page.locator(".crew-sheet prose-mirror.lv-bg-editor .ProseMirror").waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" Blur two.");
  await page.locator(".crew-sheet .lv-tray-title").click();
  await page.waitForTimeout(1200);
  record("leaving the field saves", (await page.evaluate((i) => game.actors.get(i).system.background, id)).includes("Blur two."));

  await page.locator(".crew-sheet [data-action=editBackground]").click();
  await page.locator(".crew-sheet prose-mirror.lv-bg-editor .ProseMirror").waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);
  await page.keyboard.type("DISCARD");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  record("Escape cancels", !(await page.evaluate((i) => game.actors.get(i).system.background, id)).includes("DISCARD")
    && await page.locator(".crew-sheet prose-mirror.lv-bg-editor").count() === 0);
  void tabs;

  // ---- Pool builder
  await page.locator(".crew-sheet [data-action=addDie]").click();
  await page.locator(".lv-pool-builder .lv-pb-chip").first().waitFor({ timeout: 5000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/POOLBUILDER.png` });
  const info = await page.evaluate(() => {
    const w = document.querySelector(".lv-pool-builder");
    const body = w.querySelector(".lv-pb-body");
    return {
      tabs: [...w.querySelectorAll(".lv-pb-tab-name")].map((n) => n.textContent),
      names: [...w.querySelectorAll(".lv-pb-chip-name")].map((n) => n.textContent),
      overflowX: body.scrollWidth > body.clientWidth + 1,
      clipped: [...w.querySelectorAll(".lv-pb-chip")].some((c) => c.scrollWidth > c.clientWidth + 1)
    };
  });
  record("tabs per kind", info.tabs.length >= 8, info.tabs);
  for (const n of ["[TEST] Crowbar", "[TEST] Lockpicks", "[TEST] Ghost"]) record(`offers ${n}`, info.names.includes(n), info.names);
  record("no sideways scroll", !info.overflowX);
  await page.locator(".lv-pb-chip", { hasText: "[TEST] Crowbar" }).click();
  await page.waitForTimeout(600);
  record("picked chip is marked", await page.locator(".lv-pb-chip.is-on", { hasText: "[TEST] Crowbar" }).count() === 1);
  record("preview shows it", await page.locator(".lv-pb-pchip", { hasText: "[TEST] Crowbar" }).count() === 1);
  record("sheet tray shows it", await page.locator(".lv-tray [data-pool-ref]", { hasText: "[TEST] Crowbar" }).count() > 0);
  await page.locator(".lv-pb-search").fill("ghost");
  await page.waitForTimeout(300);
  const visible = await page.evaluate(() => [...document.querySelectorAll(".lv-pb-chip:not([hidden]) .lv-pb-chip-name")].map((n) => n.textContent));
  record("search filters", visible.length === 1 && visible[0] === "[TEST] Ghost", visible);
  await page.locator(".lv-pb-search").fill("");
  await page.locator(".lv-pb-tab", { hasText: "Distinctions" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/POOLBUILDER-tab.png` });
  await page.locator(".lv-pb-pchip", { hasText: "[TEST] Crowbar" }).click();
  await page.waitForTimeout(500);
  record("preview chip takes it out", await page.locator(".lv-tray [data-pool-ref]", { hasText: "[TEST] Crowbar" }).count() === 0);
  void info.clipped;
} catch (error) {
  record("script ran without exceptions", false, String(error?.stack ?? error));
} finally {
  await page.evaluate(async (i) => { await game.actors.get(i)?.delete(); }, id).catch(() => {});
  record("no own console errors", log.own().length === 0, log.own());
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
  await browser.close();
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}
