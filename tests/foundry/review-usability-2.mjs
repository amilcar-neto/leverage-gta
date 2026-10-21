/** Usability review part 2: GM dialogs, rolls, cards, NPC opposition, party money, player views. Screenshots rev2-NN-*.png. */
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
  await page.screenshot({ path: `${SHOTS}/rev2-${String(n).padStart(2, "0")}-${name}.png` });
};
const wait = (p, ms = 900) => p.waitForTimeout(ms);
const closeAll = (p) => p.evaluate(() => { for (const a of foundry.applications.instances.values()) if (a.hasFrame && a.options?.window?.frame !== false && !/Sidebar|Hotbar|Navigation|Controls|Players|Hud|Panel/i.test(a.constructor.name)) a.close?.(); });
const text = (p, sel = ".application", len = 600) =>
  p.evaluate(([s, l]) => [...document.querySelectorAll(s)].map((a) => a.innerText.replace(/\s+/g, " ").slice(0, l)), [sel, len]);
const tool = async (name) => {
  await gm.evaluate(() => ui.controls.activate?.({ control: "leverage" }));
  await wait(gm, 500);
  await gm.locator(`[data-tool="${name}"]`).first().click({ timeout: 8000 });
  await wait(gm, 1200);
};

await gm.evaluate(() => ui.sidebar.expand?.());
await rosa.evaluate(() => ui.sidebar.expand?.());
await wait(gm, 1500);
await gm.evaluate(() => ui.controls.activate?.({ control: "leverage" }));
await wait(gm, 1500);

for (const t of ["wanted", "opposition", "newJob", "endJob", "givePlotPoint", "endScene"]) {
  await step(`tool ${t}`, async () => {
    await tool(t);
    await shot(gm, `gm-${t}`);
    return text(gm, ".application", 600);
  }, gm);
  await closeAll(gm);
  await wait(gm, 500);
}

await step("Rosa rolls via clicks", async () => {
  await rosa.evaluate(() => game.user.character.sheet.render(true));
  await rosa.waitForSelector(".crew-sheet");
  await wait(rosa, 1200);
  const sheet = rosa.locator(".crew-sheet");
  const btns = sheet.locator(".lv-name-btn");
  const cnt = await btns.count();
  await btns.nth(1).click();
  await btns.nth(cnt - 2).click();
  await wait(rosa, 600);
  await shot(rosa, "rosa-pool-clicked");
  await sheet.locator("[data-action=roll]").click();
  await wait(rosa, 2500);
  await shot(rosa, "rosa-rolled");
  return { cnt };
}, rosa);

await step("GM sees card", async () => {
  await gm.evaluate(() => ui.sidebar.changeTab?.("chat", "primary"));
  await wait(gm, 800);
  await shot(gm, "gm-chat-after-roll");
  return gm.evaluate(() => [...document.querySelectorAll(".chat-message")].slice(-1).map((m) => m.innerText.replace(/\s+/g, " ").slice(0, 400)));
}, gm);

await step("Rosa chat card crop", async () => {
  const el = rosa.locator(".chat-message").last();
  await el.scrollIntoViewIfNeeded();
  const box = await el.boundingBox();
  n += 1;
  if (box) await rosa.screenshot({ path: `${SHOTS}/rev2-${String(n).padStart(2, "0")}-rosa-card.png`, clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 } });
  return rosa.evaluate(() => [...document.querySelectorAll(".chat-message")].slice(-1).map((m) => m.innerText.replace(/\s+/g, " ").slice(0, 400)));
}, rosa);
await closeAll(rosa);

await step("NPC roll as opposition", async () => {
  await gm.evaluate(() => game.actors.getName("Capangas do Moretti").sheet.render(true));
  await wait(gm, 1500);
  await gm.getByRole("button", { name: /oposi/i }).first().click();
  await wait(gm, 2000);
  await shot(gm, "gm-npc-opposition-roll");
  return gm.evaluate(() => [...document.querySelectorAll(".chat-message")].slice(-1).map((m) => m.innerText.replace(/\s+/g, " ").slice(0, 500)));
}, gm);
await closeAll(gm);

await step("GM damage button in last card", async () => {
  const btns = await gm.evaluate(() => [...document.querySelectorAll(".chat-message:last-child button")].map((b) => b.innerText.trim()));
  const el = gm.locator(".chat-message").last();
  await el.scrollIntoViewIfNeeded();
  const box = await el.boundingBox();
  n += 1;
  if (box) await gm.screenshot({ path: `${SHOTS}/rev2-${String(n).padStart(2, "0")}-gm-opp-card.png`, clip: { x: Math.max(0, box.x - 10), y: Math.max(0, box.y - 10), width: box.width + 20, height: box.height + 20 } });
  return btns;
}, gm);

await step("party money on for GM", async () => {
  await gm.evaluate(() => game.settings.set("leverage-gta", "hud.showPartyMoney", true));
  await wait(gm, 1200);
  await shot(gm, "gm-hud-party-money");
  const box = await gm.locator("#leverage-hud, .leverage-hud").first().boundingBox();
  n += 1;
  await gm.screenshot({ path: `${SHOTS}/rev2-${String(n).padStart(2, "0")}-gm-hud-party-crop.png`, clip: { x: box.x - 40, y: Math.max(0, box.y - 10), width: box.width + 60, height: box.height + 20 } });
  return text(gm, "#leverage-hud, .leverage-hud", 300);
}, gm);
await gm.evaluate(() => game.settings.set("leverage-gta", "hud.showPartyMoney", false));

await step("Marco views", async () => {
  await marco.evaluate(() => game.user.character.sheet.render(true));
  await marco.waitForSelector(".crew-sheet");
  await wait(marco, 1200);
  await shot(marco, "marco-sheet");
  return "ok";
}, marco);
await closeAll(marco);

await step("player opens Location and NPC (observer?)", async () => {
  const info = await rosa.evaluate(() => game.actors.filter((a) => a.type !== "crew").map((a) => `${a.name}:${a.testUserPermission(game.user, "OBSERVER")}:${a.testUserPermission(game.user, "LIMITED")}`));
  await rosa.evaluate(() => game.actors.find((a) => a.type === "location" && a.name.startsWith("Arma"))?.sheet.render(true));
  await wait(rosa, 1500);
  await shot(rosa, "rosa-location");
  return info;
}, rosa);
await closeAll(rosa);

await step("Rastreador after scene", async () => {
  await tool("tracker");
  await gm.locator('[data-action="addComplication"], .job-tracker button').first().waitFor({ timeout: 3000 }).catch(() => {});
  return text(gm, ".application", 200);
}, gm);
await closeAll(gm);

await step("scene strip chips click (GM)", async () => {
  const sizes = await gm.evaluate(() => [...document.querySelectorAll(".lv-sp button, .lv-sp .lv-sp-chip")].map((b) => `${b.className.split(" ").slice(0, 2).join(".")}:${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`));
  await gm.locator(".lv-sp-chip--trait").first().click({ timeout: 4000 });
  await wait(gm, 1200);
  await shot(gm, "gm-strip-chip-click");
  return { sizes, win: await text(gm, ".application", 120) };
}, gm);
await closeAll(gm);

await step("relock Rosa sheet", async () => {
  await rosa.evaluate(() => game.user.character.unsetFlag("leverage-gta", "sheetUnlocked"));
  return rosa.evaluate(() => String(game.user.character.getFlag("leverage-gta", "sheetUnlocked")));
}, rosa);

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
