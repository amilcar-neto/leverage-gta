/**
 * T-301 check: opens the crew sheet in the real Foundry and verifies size, columns, parts, the lock seal,
 * the console and that our `system` cascade layer beats the core styles. Creates only `[TEST]` actors.
 * Run after `npm run deploy` (nobody may be logged in as the test user). Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });

/** Runs in the page: opens the sheet and measures everything. */
async function inspectSheet() {
  const actor = await Actor.create({ name: "[TEST] Crew", type: "crew" }); // new sheets start locked (no `sheetUnlocked` flag)
  await actor.sheet.render({ force: true });
  await new Promise((r) => setTimeout(r, 1500));
  await document.fonts.ready;
  const el = actor.sheet.element;
  const box = el.getBoundingClientRect();
  const cols = [...el.querySelectorAll(".lv-col")].map((c) => Math.round(c.getBoundingClientRect().width));
  const parts = [...el.querySelectorAll("[data-application-part]")].map((p) => p.dataset.applicationPart);
  const head = el.querySelector(".lv-panel-head");
  const probe = Object.assign(document.createElement("button"), { className: "lv-xbtn", textContent: "x" });
  el.querySelector(".lv-panel-body").append(probe);
  const hs = getComputedStyle(head);
  const xs = getComputedStyle(probe);
  const title = el.querySelector(".window-title");
  const seal = el.querySelector(".lv-lock-seal");
  const overflowing = [...el.querySelectorAll(".lv-panel, .lv-folder, .lv-tray, .lv-header")]
    .filter((n) => n.scrollWidth > n.clientWidth + 1).map((n) => n.className);
  const out = {
    size: [Math.round(box.width), Math.round(box.height)], cols, parts,
    rootClasses: el.className, titleTransform: getComputedStyle(title).textTransform,
    seal: seal?.textContent.trim(), sealClass: seal?.className, overflowing,
    head: { bg: hs.backgroundColor, font: hs.fontFamily, color: hs.color },
    xbtn: { w: xs.width, h: xs.height, border: xs.borderTopWidth, bg: xs.backgroundColor },
    layers: [...document.styleSheets].flatMap((s) => { try { return [...s.cssRules].filter((r) => r.constructor.name === "CSSLayerStatementRule").map((r) => r.nameList.join()); } catch { return []; } })
  };
  probe.remove();
  return out;
}

/** Runs in the page: flips the sheet's own lock flag and reads the seal back. */
async function toggleLock() {
  const actor = game.actors.getName("[TEST] Crew");
  const flag = "sheetUnlocked";
  const before = !actor.getFlag("leverage-gta", flag); // true = locked
  await actor.setFlag("leverage-gta", flag, before);
  await new Promise((r) => setTimeout(r, 800));
  const seal = actor.sheet.element.querySelector(".lv-lock-seal");
  const res = { before, text: seal.textContent.trim(), cls: seal.className, parts: actor.sheet.element.querySelectorAll("[data-application-part]").length };
  await actor.setFlag("leverage-gta", flag, !before);
  await new Promise((r) => setTimeout(r, 800));
  res.back = actor.sheet.element.querySelector(".lv-lock-seal").textContent.trim();
  return res;
}

try {
  await login(page, env);
} catch (err) {
  console.log(`FOUNDRY: not available - ${err.message.split("\n")[0]}`);
  await browser.close();
  process.exit(2);
}

try {
  const m = await page.evaluate(inspectSheet);
  console.log(JSON.stringify(m));
  await page.evaluate(() => { ui.notifications.clear?.(); document.querySelector("#notifications")?.replaceChildren(); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SHOTS}/T-301-sheet.png` });
  record("size 1180x950", m.size[0] === 1180 && m.size[1] === 950, m.size);
  record("three columns 376/400/316", m.cols.join() === "376,400,316", m.cols);
  const want = ["header", "attributes", "roles", "distinctions", "talents", "specialties", "assets", "folder", "tray"];
  record("all parts present", want.every((p) => m.parts.includes(p)), m.parts);
  record("root classes", /leverage-gta/.test(m.rootClasses) && /crew-sheet/.test(m.rootClasses), m.rootClasses);
  record("title uppercase", m.titleTransform === "uppercase", m.titleTransform);
  record("seal shows locked state", /is-locked/.test(m.sealClass ?? ""), m.seal);
  record("no horizontal overflow", m.overflowing.length === 0, m.overflowing);
  record("layer: .lv-panel-head is ours (yellow, Anton)", m.head.bg === "rgb(216, 194, 74)" && /Anton/.test(m.head.font), m.head);
  record("layer: button.lv-xbtn is ours (20px, no border)", m.xbtn.w === "20px" && m.xbtn.border === "0px" && m.xbtn.bg === "rgba(0, 0, 0, 0)", m.xbtn);
  const t = await page.evaluate(toggleLock);
  record("seal follows the sheet lock flag", t.cls.includes("is-unlocked") === t.before && t.text !== t.back && t.parts === 9, t);
  record("no system errors in console", log.own().length === 0, log.own());
  console.log(`LAYERS: ${m.layers.join(" | ")}`);
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-301-failure.png` }).catch(() => {});
} finally {
  await page.evaluate(async () => {
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) { await a.sheet.close(); await a.delete(); }
  }).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
