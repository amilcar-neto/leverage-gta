/**
 * T-202 gallery: renders every die x state x size with renderDie in the live Foundry page and saves a screenshot.
 * Run after `npm run deploy`. Exit codes: 0 ok, 1 failed, 2 not configured / not reachable.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS, SYSTEM_ID } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);

/** Runs in the page: builds the grid and returns how many dice were drawn. */
async function buildGallery(systemId) {
  const url = (path) => foundry.utils.getRoute(`systems/${systemId}/${path}`);
  const { renderDie } = await import(url("module/applications/components/die.mjs"));
  const { LEVERAGE } = await import(url("module/config.mjs"));
  if (!document.querySelector("link[href$='leverage-gta.css']")) {
    const link = Object.assign(document.createElement("link"), { rel: "stylesheet", href: url("styles/leverage-gta.css") });
    document.head.append(link);
    await new Promise((resolve) => { link.onload = resolve; link.onerror = resolve; });
  }
  const states = [
    ["normal", {}], ["muted", { muted: true }], ["deep", { muted: true, deep: true }],
    ["kept", { kept: true }], ["one", { one: true, value: 1 }], ["money", { money: true }], ["empty", { money: true, empty: true }]
  ];
  const root = document.createElement("div");
  root.className = "leverage-gta";
  root.id = "die-gallery";
  root.style.cssText = "position:fixed;inset:0;z-index:99999;overflow:auto;padding:16px;display:flex;flex-wrap:wrap;gap:24px 40px;align-content:flex-start;background:#1a2326;color:#e9f0ed;font:14px sans-serif";
  let html = "";
  for (const size of LEVERAGE.dieGeometry.sizes) {
    html += `<section><h3 style="margin:0 0 6px">${size}px</h3>`;
    for (const [name, opts] of states) {
      html += `<div style="display:flex;align-items:center;gap:8px;padding:3px 0;height:${size + 6}px"><span style="width:50px">${name}</span>`;
      for (const d of LEVERAGE.dice) html += renderDie({ die: d, value: opts.value ?? d, size, ...opts });
      html += "</div>";
    }
    html += "</section>";
  }
  root.innerHTML = html;
  document.body.append(root);
  return root.querySelectorAll(".lv-die").length;
}

try {
  await login(page, env);
  const count = await page.evaluate(buildGallery, SYSTEM_ID);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/T-202-gallery.png` });
  const own = log.own();
  console.log(`FOUNDRY: ${own.length ? "fail" : "pass"} — ${count} dice drawn`);
  console.log(`CONSOLE: ${own.length ? own.join("\n") : "clean"}`);
  await browser.close();
  process.exit(own.length ? 1 : 0);
} catch (err) {
  await page.screenshot({ path: `${SHOTS}/T-202-failure.png` }).catch(() => {});
  console.log(`FOUNDRY: not available — ${err.message.split("\n")[0]}`);
  await browser.close();
  process.exit(2);
}
