/**
 * T-401 check: the five Item sheets in the real Foundry. Creates only `[TEST]` actors and items (owned and loose).
 * Run after `npm run deploy`. Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const wait = (ms) => page.waitForTimeout(ms);
const win = (type) => `.application.lv-item-sheet.${type}-sheet`;

/** Runs in the page: creates a [TEST] crew with one item per type, plus a loose Talent; returns their ids. */
async function setup() {
  const actor = await Actor.create({ name: "[TEST] Rosa Delgado", type: "crew" });
  const data = [
    { name: "[TEST] Street Cred", type: "distinction", system: { note: "Helps in the neighborhood." } },
    { name: "[TEST] Wheelman’s Nerve", type: "talent", system: { role: "open", cost: 1, activation: "You are behind the wheel during a chase. Spend a Plot Point.", effect: "<p>Reroll any of your dice that came up 1. Keep the new results, even if they are lower. If a reroll comes up 1 again, it still counts for Complications.</p>" } },
    { name: "[TEST] Getaway", type: "specialty", system: { role: "thief" } },
    { name: "[TEST] Stolen Sedan", type: "asset", system: { die: 8, duration: "signature", note: "Fast and untraceable." } },
    { name: "[TEST] Dockside", type: "job", system: { payout: { total: 8, share: 2 } } }
  ];
  const items = await actor.createEmbeddedDocuments("Item", data);
  const loose = await Item.create({ name: "[TEST] Loose Talent", type: "talent" });
  return { actorId: actor.id, ids: Object.fromEntries(items.map((i) => [i.type, i.id])), looseId: loose.id };
}

/** Runs in the page: opens the sheet of an owned item and returns basic layout facts. */
async function openSheet({ actorId, id }) {
  const item = game.actors.get(actorId).items.get(id);
  await item.sheet.render({ force: true });
  await new Promise((r) => setTimeout(r, 1200));
  const el = item.sheet.element;
  const box = el.getBoundingClientRect();
  const sc = [...el.querySelectorAll(".window-content *")].filter((n) => n.scrollWidth > n.clientWidth + 1
    && getComputedStyle(n).overflowX === "visible" && n.children.length === 0 && n.clientWidth > 0);
  return { title: el.querySelector(".window-title")?.textContent.trim(), w: box.width, h: box.height, overflow: sc.map((n) => n.className) };
}

/** Closes every item window, then opens the one of `type` alone (stacked windows hide each other). */
async function show(state, type) {
  await page.evaluate(async ({ actorId, id }) => {
    for (const app of [...foundry.applications.instances.values()]) if (app.document?.documentName === "Item") await app.close();
    await game.actors.get(actorId).items.get(id).sheet.render({ force: true });
  }, { actorId: state.actorId, id: state.ids[type] });
  await wait(1000);
}

const owned = (state, type) => page.evaluate((a) => {
  const i = game.actors.get(a.actorId).items.get(a.id);
  return { name: i.name, system: i.system.toObject(), img: i.img };
}, { actorId: state.actorId, id: state.ids[type] });

try {
  await login(page, env);
  const state = await page.evaluate(setup);

  for (const type of ["distinction", "talent", "specialty", "asset", "job"]) {
    const facts = await page.evaluate(openSheet, { actorId: state.actorId, id: state.ids[type] });
    record(`${type}: opens with type and owner in the title`, /Rosa/.test(facts.title ?? ""), facts);
    record(`${type}: no clipped text`, facts.overflow.length === 0, facts.overflow);
    const it = await owned(state, type);
    record(`${type}: default icon`, it.img.endsWith(`/assets/items/${type}.svg`), it.img);
    await page.screenshot({ path: `${SHOTS}/T-401-${type}.png`, clip: await page.evaluate((t) => {
      const r = document.querySelector(`.application.lv-item-sheet.${t}-sheet`).getBoundingClientRect();
      return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: r.width + 8, height: r.height + 8 };
    }, type) });
  }

  // Talent: edit every field
  await show(state, "talent");
  const t = win("talent");
  await page.fill(`${t} input[name=name]`, "[TEST] Nerve Renamed");
  await page.locator(`${t} input[name=name]`).blur();
  await wait(500);
  await page.selectOption(`${t} select[name="system.role"]`, "thief");
  await wait(500);
  await page.click(`${t} [data-action=setCost][data-value="0"]`);
  await wait(500);
  await page.fill(`${t} textarea[name="system.activation"]`, "When the lights go out.");
  await page.locator(`${t} textarea[name="system.activation"]`).blur();
  await wait(500);
  await page.click(`${t} .lv-item-die[data-die="10"] button`);
  await wait(500);
  let s = await owned(state, "talent");
  record("talent: name, role, cost, activation and die persist",
    s.name === "[TEST] Nerve Renamed" && s.system.role === "thief" && s.system.cost === 0
    && s.system.activation === "When the lights go out." && s.system.die === 10, s);
  await page.click(`${t} .lv-item-none`);
  await wait(500);
  s = await owned(state, "talent");
  record("talent: No die clears the die", s.system.die === null, s.system.die);

  // Talent: rich effect (ProseMirror) edit
  await page.locator(`${t} prose-mirror button.toggle`).dispatchEvent("click");
  await wait(600);
  const pm = page.locator(`${t} prose-mirror .ProseMirror`);
  if (await pm.count()) {
    await pm.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("Rich effect text.");
    await page.locator(`${t} prose-mirror button.toggle`).dispatchEvent("click");
    await wait(900);
    s = await owned(state, "talent");
    record("talent: rich effect saved", /Rich effect text/.test(s.system.effect), s.system.effect);
  } else {
    record("talent: rich editor opens", false, "no .ProseMirror");
  }

  // Distinction
  await show(state, "distinction");
  const d = win("distinction");
  await page.fill(`${d} input[name="system.note"]`, "Hurts when cops know your face.");
  await page.locator(`${d} input[name="system.note"]`).blur();
  await wait(500);
  s = await owned(state, "distinction");
  record("distinction: note persists", s.system.note === "Hurts when cops know your face.", s.system.note);

  // Specialty
  await show(state, "specialty");
  const sp = win("specialty");
  await page.selectOption(`${sp} select[name="system.role"]`, "hacker");
  await wait(500);
  s = await owned(state, "specialty");
  record("specialty: role persists", s.system.role === "hacker", s.system.role);

  // Asset
  await show(state, "asset");
  const a = win("asset");
  await page.click(`${a} .lv-item-die[data-die="12"] button`);
  await page.click(`${a} [data-action=setDuration][data-value="scene"]`);
  await page.fill(`${a} input[name="system.note"]`, "Burns fast.");
  await page.locator(`${a} input[name="system.note"]`).blur();
  await page.check(`${a} input[name="system.weapon"]`);
  await wait(800);
  s = await owned(state, "asset");
  record("asset: die, duration, note and weapon persist",
    s.system.die === 12 && s.system.duration === "scene" && s.system.note === "Burns fast." && s.system.weapon === true, s.system);

  // Job
  await show(state, "job");
  const j = win("job");
  await page.fill(`${j} input[name="system.payout.total"]`, "12");
  await page.locator(`${j} input[name="system.payout.total"]`).blur();
  await page.fill(`${j} input[name="system.payout.share"]`, "3");
  await page.locator(`${j} input[name="system.payout.share"]`).blur();
  await page.check(`${j} input[name="system.callbackUsed"]`);
  await page.check(`${j} input[name="system.spent"]`);
  await wait(800);
  s = await owned(state, "job");
  record("job: payout, callback and spent persist",
    s.system.payout.total === 12 && s.system.payout.share === 3 && s.system.callbackUsed && s.system.spent, s.system);

  // Layout facts of the Talent window against the mockup (520x520, 56px band, 32px title bar)
  await show(state, "talent");
  const m = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const r = (q) => el.querySelector(q).getBoundingClientRect();
    return { w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height, band: r(".lv-item-band").height, head: r(".window-header").height,
      delBtn: r(".lv-item-delete").bottom <= el.getBoundingClientRect().bottom, seal: Boolean(el.querySelector(".lv-lock-seal")) };
  }, t);
  record("talent: 520x520, band 56, title bar 32, delete inside", m.w === 520 && m.h === 520 && m.band === 56 && m.head === 32 && m.delBtn, m);
  record("owned trait shows the lock seal", m.seal, m);
  await page.screenshot({ path: `${SHOTS}/T-401-talent-edited.png` });

  // Lock: as a non-GM with Traits locked the sheet is read-only (no delete button, fields disabled); unlocked it is editable
  const readOnly = await page.evaluate(async ({ actorId, id }) => {
    const item = game.actors.get(actorId).items.get(id);
    const frame = async () => {
      await item.sheet.close();
      await item.sheet.render({ force: true });
      await new Promise((r) => setTimeout(r, 1000));
      const el = item.sheet.element;
      return { disabled: [...el.querySelectorAll("input, select, textarea")].filter((n) => !n.disabled).length, del: Boolean(el.querySelector("[data-action=deleteItem]")), seal: el.querySelector(".lv-lock-seal")?.classList.contains("is-locked") };
    };
    await game.settings.set("leverage-gta", "traitsLocked", true);
    Object.defineProperty(game.user, "isGM", { value: false, configurable: true });
    const locked = await frame();
    await item.sheet.close();
    delete game.user.isGM;
    await game.settings.set("leverage-gta", "traitsLocked", false);
    return { locked };
  }, { actorId: state.actorId, id: state.ids.talent });
  record("locked + non-GM: fields disabled, no delete, seal locked",
    readOnly.locked.disabled === 0 && !readOnly.locked.del && readOnly.locked.seal === true, readOnly);

  // Loose (world) item: opens, no owner in the title, edits persist
  await page.evaluate((id) => game.items.get(id).sheet.render({ force: true }), state.looseId);
  await wait(1200);
  const lw = `.application.lv-item-sheet[id$="${state.looseId}"]`;
  const loose = await page.evaluate((id) => {
    const el = document.querySelector(`.application.lv-item-sheet[id$="${id}"]`);
    return { title: el?.querySelector(".window-title")?.textContent.trim(), seal: Boolean(el?.querySelector(".lv-lock-seal")) };
  }, state.looseId);
  record("loose talent: title is the type only, no seal", loose.title === "Talent" && !loose.seal, loose);
  await page.fill(`${lw} input[name=name]`, "[TEST] Loose Renamed");
  await page.locator(`${lw} input[name=name]`).blur();
  await wait(500);
  const looseName = await page.evaluate((id) => game.items.get(id).name, state.looseId);
  record("loose talent: rename persists", looseName === "[TEST] Loose Renamed", looseName);

  // Delete from the footer: cancel keeps it, confirm deletes
  await page.click(`${lw} [data-action=deleteItem]`);
  await page.waitForSelector("dialog.application, .application.dialog-v2, .application.dialog", { timeout: 5000 });
  await page.click('.application button[data-action="no"]');
  await wait(600);
  let exists = await page.evaluate((id) => Boolean(game.items.get(id)), state.looseId);
  record("delete: cancel keeps the item", exists);
  await page.click(`${lw} [data-action=deleteItem]`);
  await page.waitForSelector('.application button[data-action="yes"]', { timeout: 5000 });
  await page.click('.application button[data-action="yes"]');
  await wait(900);
  exists = await page.evaluate((id) => Boolean(game.items.get(id)), state.looseId);
  record("delete: confirm removes the item", !exists);

  record("no system errors in console", log.own().length === 0, log.own());
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-401-failure.png` }).catch(() => {});
} finally {
  await page.evaluate(async () => {
    for (const app of foundry.applications.instances.values()) if (app.document?.name?.startsWith("[TEST]")) await app.close();
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) await a.delete();
    for (const i of game.items.filter((x) => x.name.startsWith("[TEST]"))) await i.delete();
  }).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
