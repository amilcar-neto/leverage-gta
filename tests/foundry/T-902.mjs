/**
 * T-902 check: example compendiums in the real Foundry. Relaunches the world (system.json changed), checks the four
 * packs, imports Rosa Delgado into the world, opens her sheet, checks the numbers, rolls a Pool and deletes the
 * imported actor. Run after `npm run deploy`.
 * Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, relaunchWorld, SHOTS } from "./lib.mjs";

const env = requireEnv(["FOUNDRY_URL", "FOUNDRY_USER", "FOUNDRY_ADMIN_PASSWORD"]);
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });

try {
  await relaunchWorld(page, env);
  await login(page, env);
} catch (err) {
  console.log(`FOUNDRY: not available - ${err.message.split("\n")[0]}`);
  await browser.close();
  process.exit(2);
}

try {
  const packs = await page.evaluate(async () => {
    const out = {};
    for (const p of game.packs.filter((x) => x.metadata.packageName === "leverage-gta")) {
      const index = await p.getIndex();
      out[p.collection] = { type: p.documentName, count: index.size, title: p.title, names: index.map((i) => i.name) };
    }
    return out;
  });
  const sizes = Object.fromEntries(Object.entries(packs).map(([k, v]) => [k, v.count]));
  record("four packs registered", Object.keys(packs).length === 4, sizes);
  record("crew-exemplo has Rosa", packs["leverage-gta.crew-exemplo"]?.names.includes("Rosa Delgado"), packs);
  record("pack titles are localized", Object.values(packs).every((p) => p.title && !p.title.startsWith("LEVERAGE.")), Object.values(packs).map((p) => p.title));
  record("npcs has 5 NPCs", packs["leverage-gta.npcs"]?.count === 5, sizes);
  record("locais has 1 location", packs["leverage-gta.locais"]?.count === 1, sizes);
  record("talents-assets has items", packs["leverage-gta.talents-assets"]?.count >= 8, sizes);

  // Compendium sidebar screenshot.
  await page.evaluate(() => ui.sidebar.changeTab?.("compendium", "primary") ?? ui.sidebar.activateTab?.("compendium"));
  await page.waitForTimeout(800);
  await page.evaluate(() => game.packs.get("leverage-gta.crew-exemplo").render(true));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/T-902-compendium.png` });

  // Import Rosa.
  const info = await page.evaluate(async () => {
    const pack = game.packs.get("leverage-gta.crew-exemplo");
    const entry = (await pack.getIndex()).find((i) => i.name === "Rosa Delgado");
    const actor = await game.actors.importFromCompendium(pack, entry._id);
    const s = actor.system;
    const count = (t) => actor.items.filter((i) => i.type === t).length;
    return {
      id: actor.id, life: [s.life.value, s.life.max], vest: [s.vest.value, s.vest.max], alias: s.alias, booking: s.booking.number,
      items: { distinction: count("distinction"), talent: count("talent"), specialty: count("specialty"), asset: count("asset"), job: count("job") },
      spent: actor.items.filter((i) => i.type === "job" && i.system.spent).length,
      agility: s.attributes.agility.die, thief: s.roles.thief.die, primary: s.roles.thief.primary, hacker: s.roles.hacker.die,
      bg: s.background.includes("RAISED")
    };
  });
  record("life 14/18 and vest 4/6", info.life.join() === "14,18" && info.vest.join() === "4,6", info);
  record("alias and booking number", info.alias === "La Zorra" && info.booking === "0471-RD", info);
  record("3 distinctions, 3 talents, 3 specialties, 5 assets, 9 jobs", JSON.stringify(info.items) === JSON.stringify({ distinction: 3, talent: 3, specialty: 3, asset: 5, job: 9 }), info);
  record("3 jobs SPENT", info.spent === 3, info);
  record("Agility d10, Thief d10 primary, Hacker blank, background", info.agility === 10 && info.thief === 10 && info.primary === true && info.hacker === null && info.bg, info);

  await page.evaluate((id) => game.actors.get(id).sheet.render({ force: true }), info.id);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/T-902-rosa.png` });

  const rolled = await page.evaluate(async (id) => {
    const msg = await game.leverage.rollPool({ actor: id, refs: ["attributes.agility", "roles.thief"], flavor: "[TEST] T-902" });
    return msg ? { id: msg.id, entries: msg.flags["leverage-gta"]?.roll?.entries?.length } : null;
  }, info.id);
  record("Pool rolls and posts a card", rolled?.entries === 2, rolled);
  record("no system errors in the console", log.own().length === 0, log.own());
  if (rolled?.id) await page.evaluate((id) => game.messages.get(id)?.delete(), rolled.id);
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-902-failure.png` }).catch(() => {});
} finally {
  await page.evaluate(async () => {
    for (const app of foundry.applications.instances.values()) await app.close().catch(() => {});
    for (const a of game.actors.filter((x) => x.name === "Rosa Delgado")) await a.delete();
  }).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
