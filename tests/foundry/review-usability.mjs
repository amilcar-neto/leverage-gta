/** Usability review (novice GM + novice player): walks each screen and saves screenshots rev-NN-*.png. Read-only on game data. */
import { requireEnv, SHOTS } from "./lib.mjs";
import { openTable, step, report } from "./playtest-lib.mjs";

const env = requireEnv();
const ROSA = "Jogadora Rosa";
const MARCO = "Jogador Marco";
const table = await openTable(env, [ROSA, MARCO]);
const gm = table.gm.page;
const rosa = table.players[ROSA].page;
const marco = table.players[MARCO].page;
let n = 0;
const shot = async (page, name) => {
  n += 1;
  await page.screenshot({ path: `${SHOTS}/rev-${String(n).padStart(2, "0")}-${name}.png` });
};
const wait = (p, ms = 900) => p.waitForTimeout(ms);
const closeAll = (p) => p.evaluate(() => { for (const a of foundry.applications.instances.values()) if (a.hasFrame && a.options?.window?.frame !== false && !/Sidebar|Hotbar|Navigation|Controls|Players|Hud|Panel/i.test(a.constructor.name)) a.close?.(); });
const text = (p, sel = ".application", len = 600) =>
  p.evaluate(([s, l]) => [...document.querySelectorAll(s)].map((a) => a.innerText.replace(/\s+/g, " ").slice(0, l)), [sel, len]);

await step("world overview", async () => {
  const info = await gm.evaluate(() => ({
    actors: game.actors.map((a) => `${a.type}:${a.name}`),
    scene: game.scenes.active?.name,
    job: lvTestJob.get(),
    users: game.users.map((u) => `${u.name}:${u.role}:${u.character?.name}`)
  }));
  await shot(gm, "gm-table");
  await shot(rosa, "rosa-table");
  await shot(marco, "marco-table");
  return info;
}, gm);

await step("HUD crops", async () => {
  for (const [p, nm] of [[gm, "gm"], [rosa, "rosa"]]) {
    const box = await p.locator("#leverage-hud, .leverage-hud").first().boundingBox().catch(() => null);
    if (box) {
      n += 1;
      await p.screenshot({
        path: `${SHOTS}/rev-${String(n).padStart(2, "0")}-hud-${nm}.png`,
        clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 20), width: box.width + 40, height: box.height + 40 }
      });
    }
  }
  return "ok";
}, gm);

await step("GM control tools", async () => {
  await gm.evaluate(() => ui.controls.activate?.({ control: "leverage" }));
  await wait(gm);
  await shot(gm, "gm-controls");
  return gm.evaluate(() => [...document.querySelectorAll("#scene-controls-tools button")].map((b) => b.getAttribute("aria-label") || b.dataset.tooltip || b.title));
}, gm);

await step("GM tooltips", async () => {
  const tools = ["traitsLock", "wanted", "opposition", "tracker", "endScene", "newJob", "endJob", "newSession", "givePlotPoint"];
  const out = [];
  for (const t of tools) {
    await gm.locator(`[data-tool="${t}"]`).first().hover();
    await wait(gm, 500);
    out.push(`${t}: ${(await gm.locator("#tooltip, .locked-tooltip").first().innerText().catch(() => "")).replace(/\s+/g, " ")}`);
  }
  return out;
}, gm);

await step("Tracker", async () => {
  await gm.locator('[data-tool="tracker"]').first().click();
  await wait(gm, 1500);
  await shot(gm, "gm-tracker");
  return text(gm, ".application", 500);
}, gm);
await closeAll(gm);

await step("Wanted dialog", async () => {
  await gm.locator('[data-tool="wanted"]').first().click();
  await wait(gm, 1200);
  await shot(gm, "gm-wanted");
  return text(gm, ".application", 700);
}, gm);
await closeAll(gm);

await step("Opposition roller", async () => {
  await gm.locator('[data-tool="opposition"]').first().click();
  await wait(gm, 1200);
  await shot(gm, "gm-opposition");
  return text(gm, ".application", 800);
}, gm);
await closeAll(gm);

for (const t of ["newJob", "endJob", "givePlotPoint", "endScene"]) {
  await step(`dialog ${t}`, async () => {
    await gm.locator(`[data-tool="${t}"]`).first().click();
    await wait(gm, 1200);
    await shot(gm, `gm-${t}`);
    return text(gm, ".application", 500);
  }, gm);
  await closeAll(gm);
  await wait(gm, 400);
}

for (const [p, nm] of [[rosa, "rosa"], [gm, "gm"]]) {
  await step(`crew sheet (${nm})`, async () => {
    await p.evaluate(() => (game.user.character ?? game.actors.find((a) => a.type === "crew" && a.name.includes("Quintero"))).sheet.render(true));
    await p.waitForSelector(".crew-sheet", { timeout: 10000 });
    await wait(p, 1500);
    await shot(p, `${nm}-crew-sheet`);
    const tabs = await p.locator(".crew-sheet [data-action=folderTab]").count();
    for (let i = 0; i < tabs; i++) {
      await p.locator(".crew-sheet [data-action=folderTab]").nth(i).click();
      await wait(p, 500);
      await shot(p, `${nm}-crew-tab${i}`);
    }
    return { tabs };
  }, p);
}

await step("Rosa: unlock", async () => {
  await rosa.locator(".crew-sheet .lv-lock-seal, .crew-sheet [data-action=toggleLock], .crew-sheet [data-action=toggleSheetLock]").first().click().catch(() => {});
  await wait(rosa, 800);
  await shot(rosa, "rosa-unlock-attempt");
  return text(rosa, ".crew-sheet .window-header", 300);
}, rosa);

await step("Rosa: pool builder", async () => {
  await rosa.locator(".crew-sheet [data-action=addDie]").click();
  await wait(rosa, 1200);
  await shot(rosa, "rosa-pool-builder");
  const tabs = rosa.locator("[role=tab]:not(.lv-folder-tab)");
  const c = await tabs.count();
  if (c > 2) { await tabs.nth(2).click(); await wait(rosa, 500); await shot(rosa, "rosa-pool-builder-tab"); }
  return { c };
}, rosa);
await rosa.keyboard.press("Escape");
await wait(rosa, 500);

await step("Rosa: build pool and roll", async () => {
  const sheet = rosa.locator(".crew-sheet");
  const names = sheet.locator(".lv-name-btn");
  await names.nth(0).click();
  await names.nth(6).click();
  await wait(rosa, 600);
  await shot(rosa, "rosa-pool-partial");
  const cnt = await sheet.locator(".lv-chip[data-pool-ref]").count();
  await sheet.locator("[data-action=roll]").click();
  await wait(rosa, 2500);
  await shot(rosa, "rosa-after-roll");
  return { chips: cnt };
}, rosa);

await step("chat card", async () => {
  await rosa.evaluate(() => ui.sidebar?.changeTab?.("chat", "primary"));
  await gm.evaluate(() => ui.sidebar?.changeTab?.("chat", "primary"));
  await wait(rosa, 800);
  await shot(rosa, "rosa-chat");
  await shot(gm, "gm-chat-card");
  return "ok";
}, rosa);

await closeAll(rosa);
await closeAll(gm);

for (const type of ["npc", "location"]) {
  await step(`${type} sheet (gm)`, async () => {
    const names = await gm.evaluate((t) => game.actors.filter((a) => a.type === t).map((a) => a.name), type);
    const target = names.find((x) => /Moretti|Armaz|Cofre|Porto/i.test(x)) ?? names[0];
    await gm.evaluate(([t, nme]) => game.actors.find((a) => a.type === t && a.name === nme).sheet.render(true), [type, target]);
    await wait(gm, 1800);
    await shot(gm, `gm-${type}-sheet`);
    return { names, target };
  }, gm);
  await closeAll(gm);
}

await step("npc sheets", async () => {
  const names = await gm.evaluate(() => game.actors.filter((a) => a.type === "npc").map((a) => a.name));
  for (const nme of names.slice(0, 4)) {
    await gm.evaluate((x) => game.actors.getName(x).sheet.render(true), nme);
    await wait(gm, 1500);
    await shot(gm, `gm-npc-${nme.replace(/\W+/g, "").slice(0, 12)}`);
    await closeAll(gm);
  }
  return names;
}, gm);

console.log(JSON.stringify({
  own: {
    gm: table.gm.log.own().map((e) => e.slice(0, 200)),
    rosa: table.players[ROSA].log.own().map((e) => e.slice(0, 200)),
    marco: table.players[MARCO].log.own().map((e) => e.slice(0, 200))
  },
  other: table.gm.log.other().map((e) => e.slice(0, 120)).slice(0, 5)
}));
await table.close();
process.exit(report.every((r) => r.ok) ? 0 : 1);
