/** Usability review part 3: scene strip measurements, Wanted dialog, Tracker edits, empty-job state. Screenshots rev3-NN-*.png. */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
await login(page, env);
let n = 0;
const shot = async (name, clip) => {
  n += 1;
  await page.screenshot({ path: `${SHOTS}/rev3-${String(n).padStart(2, "0")}-${name}.png`, ...(clip ? { clip } : {}) });
};
const wait = (ms = 900) => page.waitForTimeout(ms);

const strip = await page.evaluate(() => {
  const sp = document.querySelector(".lv-sp");
  return {
    found: Boolean(sp), html: sp?.outerHTML.slice(0, 200),
    sizes: [...document.querySelectorAll(".lv-sp button, .lv-sp .lv-sp-chip")].map((b) => `${b.className.split(" ").slice(0, 2).join(".")}:${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`)
  };
});
console.log("STRIP", JSON.stringify(strip));
const sp = page.locator(".lv-sp").first();
const box = await sp.boundingBox().catch(() => null);
if (box) await shot("strip-crop", { x: Math.max(0, box.x - 120), y: 0, width: box.width + 240, height: box.height + 40 });

const toolBtn = await page.evaluate(() => [...document.querySelectorAll("#scene-controls-tools [data-tool]")].map((b) => b.dataset.tool));
console.log("TOOLS", JSON.stringify(toolBtn));
await page.evaluate(() => ui.controls.activate?.({ control: "leverage" }));
await wait(1500);
console.log("TOOLS2", JSON.stringify(await page.evaluate(() => [...document.querySelectorAll("#scene-controls-tools [data-tool]")].map((b) => b.dataset.tool))));
await page.locator('[data-tool="wanted"]').first().click({ timeout: 8000 }).catch((e) => console.log("wanted click failed", String(e).slice(0, 80)));
await wait(1500);
await shot("wanted");
console.log("WANTED", JSON.stringify(await page.evaluate(() => [...document.querySelectorAll(".application")].map((a) => a.innerText.replace(/\s+/g, " ").slice(0, 700)))));
await page.evaluate(() => { for (const a of foundry.applications.instances.values()) if (/Wanted/i.test(a.constructor.name)) a.close(); });

// chip click opens the tracker
await page.locator(".lv-sp-chip--trait").first().click({ timeout: 5000 }).catch((e) => console.log("chip click failed", String(e).slice(0, 80)));
await wait(1200);
await shot("chip-click");
console.log("CHIP", JSON.stringify(await page.evaluate(() => [...document.querySelectorAll(".application")].map((a) => a.innerText.replace(/\s+/g, " ").slice(0, 100)))));

// full-page scan of every visible text with a hint look (sheet hint texts)
await page.evaluate(() => game.actors.getName("Marisol \"Sol\" Quintero").sheet.render(true));
await wait(1500);
console.log("HINTS", JSON.stringify(await page.evaluate(() => [...document.querySelectorAll(".crew-sheet .lv-panel-hint, .crew-sheet [title]")].map((e) => (e.className.includes("hint") ? "HINT:" : "title:") + (e.title || e.innerText).slice(0, 80)).filter((v, i, a) => a.indexOf(v) === i))));
console.log("TRAYTEXT", JSON.stringify(await page.evaluate(() => document.querySelector(".crew-sheet .lv-tray")?.innerText.replace(/\s+/g, " "))));
console.log(JSON.stringify({ own: log.own().map((e) => e.slice(0, 200)), other: log.other().length }));
await browser.close();
