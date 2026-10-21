/** Usability review part 4: NPC "Rolar como oposicao" -> roller -> card -> damage dialog. Screenshots rev4-NN-*.png. */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
await login(page, env);
let n = 0;
const shot = async (name) => {
  n += 1;
  await page.screenshot({ path: `${SHOTS}/rev4-${String(n).padStart(2, "0")}-${name}.png` });
};
const wait = (ms = 900) => page.waitForTimeout(ms);
const apps = () => page.evaluate(() => [...document.querySelectorAll(".application")].map((a) => a.innerText.replace(/\s+/g, " ").slice(0, 500)));
const frames = () => page.evaluate(() => { for (const a of foundry.applications.instances.values()) if (a.hasFrame && !/Sidebar|Hotbar|Navigation|Controls|Players|Hud|Panel/i.test(a.constructor.name)) a.close(); });

await page.evaluate(() => ui.sidebar.expand?.());
await wait(1500);
await page.evaluate(() => game.actors.getName("Capangas do Moretti").sheet.render(true));
await wait(1500);
const btn = page.locator("[data-action=rollAsOpposition]").first();
console.log("opp button found", await btn.count());
await btn.click();
await wait(1500);
await shot("opp-roller-from-npc");
console.log("ROLLER", JSON.stringify(await apps()));
await page.locator(".application button", { hasText: /^\s*Rolar\s*$/i }).last().click().catch((e) => console.log("roll click failed", String(e).slice(0, 80)));
await wait(2000);
await shot("opp-card");
console.log("CARD buttons", JSON.stringify(await page.evaluate(() => [...document.querySelectorAll(".chat-message:last-child button")].map((b) => b.innerText.trim()))));
console.log("CARD text", JSON.stringify(await page.evaluate(() => document.querySelector(".chat-message:last-child")?.innerText.replace(/\s+/g, " ").slice(0, 400))));
const dmg = page.locator(".chat-message:last-child button", { hasText: /dano/i }).first();
if (await dmg.count()) {
  await dmg.click();
  await wait(1500);
  await shot("apply-damage-dialog");
  console.log("DAMAGE dialog", JSON.stringify(await apps()));
}
await frames();
// Rastreador: scenes without job -> Novo Job flow state
console.log(JSON.stringify({ own: log.own().map((e) => e.slice(0, 200)), other: log.other().length }));
await browser.close();
