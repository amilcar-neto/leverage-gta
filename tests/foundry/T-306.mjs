/**
 * T-306 check: drag and drop on the crew sheet, in the real Foundry. Creates only `[TEST]` documents.
 * Run after `npm run deploy`. Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const wait = (ms) => page.waitForTimeout(ms);

/** Runs in the page: builds two actors with items and returns their ids. */
async function setup() {
  const a = await Actor.create({ name: "[TEST] Drag A", type: "crew" });
  const b = await Actor.create({ name: "[TEST] Drag B", type: "crew" });
  await a.createEmbeddedDocuments("Item", [
    { name: "Alpha", type: "specialty", sort: 100 }, { name: "Beta", type: "specialty", sort: 200 },
    { name: "Gamma", type: "specialty", sort: 300 },
    { name: "Dockside Job", type: "job" },
    { name: "Lone Wolf", type: "distinction" }
  ]);
  await b.createEmbeddedDocuments("Item", [{ name: "B1", type: "distinction" }, { name: "B2", type: "distinction" }, { name: "B3", type: "distinction" }]);
  await a.sheet.render({ force: true });
  await new Promise((r) => setTimeout(r, 1500));
  return { a: a.id, b: b.id };
}

/** Runs in the page: dispatches drag events with a real DataTransfer on the open crew sheet. */
async function dragDrop({ fromSel, toSel, payload }) {
  const scope = document.querySelector(".crew-sheet");
  const dt = new DataTransfer();
  const fire = (target, type) => target.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
  const to = scope.querySelector(toSel);
  if (fromSel) fire(scope.querySelector(fromSel), "dragstart");
  else dt.setData("text/plain", JSON.stringify(payload));
  fire(to, "dragenter");
  fire(to, "dragover");
  const marks = { sheet: scope.classList.contains("lv-drop-active"), row: Boolean(scope.querySelector(".lv-drop-target")) };
  fire(to, "drop");
  fire(to, "dragend");
  return { marks };
}

try {
  await login(page, env);
} catch (err) {
  console.log(`FOUNDRY: not available - ${err.message.split("\n")[0]}`);
  await browser.close();
  process.exit(2);
}

try {
  const ids = await page.evaluate(setup);
  const names = (aid, type) => page.evaluate(([i, t]) => game.actors.get(i).itemTypes[t].sort((x, y) => x.sort - y.sort).map((n) => n.name), [aid, type]);
  const idOf = (aid, name) => page.evaluate(([i, n]) => game.actors.get(i).items.find((x) => x.name === n).id, [aid, name]);

  const title = await page.evaluate(() => ({
    text: document.querySelector(".crew-sheet .window-title").textContent.trim(),
    icon: Boolean(document.querySelector(".crew-sheet .window-header i.fa-hexagon"))
  }));
  record("title is only the name in capitals", title.text === "[TEST] DRAG A", title);
  record("title has the hexagon icon", title.icon, title);

  const draggable = await page.evaluate(() => ({
    items: document.querySelectorAll(".crew-sheet [data-item-id][draggable=true]").length,
    traits: document.querySelectorAll(".crew-sheet [data-trait-ref][draggable=true]").length
  }));
  record("rows are draggable", draggable.items >= 4 && draggable.traits >= 4, draggable);

  // reorder: drag Gamma onto Alpha
  const row = (id) => `.lv-specialties [data-item-id="${id}"]`;
  const gamma = await idOf(ids.a, "Gamma");
  const alpha = await idOf(ids.a, "Alpha");
  const r1 = await page.evaluate(dragDrop, { fromSel: row(gamma), toSel: row(alpha) });
  await wait(800);
  record("row highlight while reordering", r1.marks.row && !r1.marks.sheet, r1.marks);
  record("reorder updates sort", (await names(ids.a, "specialty")).join() === "Gamma,Alpha,Beta", await names(ids.a, "specialty"));

  // external drop: a world Item is copied
  const world = await page.evaluate(async () => (await Item.create({ name: "[TEST] World Talent", type: "talent" })).uuid);
  const r2 = await page.evaluate(dragDrop, { toSel: ".lv-talents", payload: { type: "Item", uuid: world } });
  await wait(900);
  record("sheet highlight on external drag", r2.marks.sheet, r2.marks);
  record("external Item is copied", (await names(ids.a, "talent")).join() === "[TEST] World Talent", await names(ids.a, "talent"));
  await page.screenshot({ path: `${SHOTS}/T-306-sheet.png` });

  // Job between two crews: the GM owns both, so it moves
  await page.evaluate((bid) => game.actors.get(bid).sheet.render({ force: true }), ids.b);
  await wait(1200);
  const job = await idOf(ids.a, "Dockside Job");
  const jobUuid = await page.evaluate(([i, j]) => game.actors.get(i).items.get(j).uuid, [ids.a, job]);
  await page.evaluate(([i, uuid]) => {
    const dt = new DataTransfer();
    dt.setData("text/plain", JSON.stringify({ type: "Item", uuid }));
    game.actors.get(i).sheet.element.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
  }, [ids.b, jobUuid]);
  await wait(1000);
  const moved = await page.evaluate(([a, b]) => ({ a: game.actors.get(a).itemTypes.job.length, b: game.actors.get(b).itemTypes.job.length }), [ids.a, ids.b]);
  record("Job moves between two owned crews", moved.a === 0 && moved.b === 1, moved);

  // dragstart payloads (sheet A has the focus again)
  await page.evaluate((i) => game.actors.get(i).sheet.render({ force: true }), ids.a);
  await wait(1000);
  const attr = await page.evaluate(() => {
    const dt = new DataTransfer();
    document.querySelector(".crew-sheet [data-trait-ref]").dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    return JSON.parse(dt.getData("text/plain"));
  });
  record("Attribute drag payload", attr.type === "LeverageTrait" && /^attributes\./.test(attr.ref) && attr.label, attr);
  const dist = await page.evaluate(() => {
    const dt = new DataTransfer();
    const el = document.querySelector(".crew-sheet .lv-row--dist");
    el.querySelector("[data-pool-ref$=':d4']").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    el.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
    return JSON.parse(dt.getData("text/plain"));
  });
  record("Distinction d4 drag payload", dist.type === "Item" && /:d4$/.test(dist.leverageRef), dist);

  // hotbar: macro creation and the friendly warning
  const macro = await page.evaluate(async (payload) => {
    const slot = 9;
    Hooks.call("hotbarDrop", ui.hotbar, payload, slot);
    await new Promise((r) => setTimeout(r, 1200));
    const m = game.macros.find((x) => x.command.includes(payload.ref));
    return m ? { name: m.name, command: m.command, assigned: game.user.hotbar[slot] === m.id, id: m.id } : null;
  }, attr);
  record("hotbarDrop creates a guarded pool.add macro", macro?.assigned && /game\.leverage\?\.pool/.test(macro.command), macro);
  const warned = await page.evaluate(async (cmd) => {
    let msg = null;
    const orig = ui.notifications.warn;
    ui.notifications.warn = (m) => { msg = m; };
    const api = game.leverage;
    game.leverage = undefined;
    try { await new Function(cmd)(); } finally { ui.notifications.warn = orig; game.leverage = api; }
    return msg;
  }, macro?.command ?? "");
  record("macro warns while game.leverage is missing", Boolean(warned) && !/^LEVERAGE\./.test(warned), warned);
  await page.evaluate(async (id) => { await game.user.assignHotbarMacro(null, 9); await game.macros.get(id)?.delete(); }, macro?.id).catch(() => {});

  record("no system errors in console", log.own().length === 0, log.own());
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-306-failure.png` }).catch(() => {});
} finally {
  await page.evaluate(async () => {
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) { await a.sheet.close(); await a.delete(); }
    for (const i of game.items.filter((x) => x.name.startsWith("[TEST]"))) await i.delete();
  }).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
