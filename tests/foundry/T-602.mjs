/**
 * T-602 check: APPLY DAMAGE on the opposition card, vest/cover/Life, Wasted and Busted (hospital, bail, rescue stars,
 * Plot Point, weapon Assets), house-rule switches. Creates only `[TEST]` documents, restores the settings and deletes
 * everything it made. Run after `npm run deploy`.
 * Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const S = "leverage-gta";
let saved = null;
let created = { actors: [], messages: [] };

try {
  await login(page, env);
  saved = await page.evaluate((S) => ({
    wanted: game.settings.get(S, "wanted"), life: game.settings.get(S, "houseRules.life"),
    money: game.settings.get(S, "houseRules.money"), stars: game.settings.get(S, "houseRules.stars")
  }), S);
  await page.evaluate(async (S) => {
    await game.settings.set(S, "wanted", { city: "liberty", level: 1 });
    for (const k of ["life", "money", "stars"]) await game.settings.set(S, `houseRules.${k}`, true);
    ui.sidebar.expand?.(); ui.sidebar.changeTab?.("chat", "primary");
  }, S);

  // A crew member with a vest, money, a scene weapon Asset and a Job weapon Asset.
  const ids = await page.evaluate(async () => {
    const crew = await Actor.create({ name: "[TEST] Target", type: "crew" });
    await crew.update({ "system.vest.kind": "standard", "system.vest.value": 6, "system.money.steps": 4, "system.plotPoints.value": 0 });
    await crew.createEmbeddedDocuments("Item", [
      { name: "[TEST] Scene gun", type: "asset", system: { die: 6, duration: "scene", weapon: true } },
      { name: "[TEST] Job rifle", type: "asset", system: { die: 8, duration: "job", weapon: true } }
    ]);
    const npc = await Actor.create({ name: "[TEST] Goon", type: "npc" });
    await npc.update({ "system.weapon.die": 8 });
    return { crew: crew.id, npc: npc.id, max: crew.system.life.max };
  });
  created.actors.push(ids.crew, ids.npc);
  const state = (id = ids.crew) => page.evaluate((id) => {
    const a = game.actors.get(id);
    return { life: a.system.life.value, vest: a.system.vest.value, money: a.system.money?.steps, pp: a.system.plotPoints?.value,
      items: a.items.map((i) => i.name) };
  }, id);
  const stars = () => page.evaluate((S) => game.settings.get(S, "wanted").level, S);

  // 1. Button on the card, dialog, cover.
  // A separator card (an opposition card) so that leftover Pool rolls in the chat are not taken as the linked roll.
  const fakeRoll = (flags) => ({ flavor: "[TEST] fake", entries: [], total: 0, ...flags });
  await page.evaluate((fake) => ChatMessage.create({ content: "x", flags: { "leverage-gta": { roll: fake } } }), fakeRoll({ opposition: true }));
  const oppId = await page.evaluate(async () => (await game.leverage.opposition({ dice: [12, 12], label: "[TEST] Shootout" })).id);
  created.messages.push(oppId);
  const card = page.locator(`.chat-message[data-message-id="${oppId}"]`);
  await card.locator(".lv-roll-btn--damage").waitFor({ timeout: 8000 });
  record("APPLY DAMAGE button shows on a free opposition card", true);
  await card.locator(".lv-roll-btn--damage").click();
  await page.waitForSelector(".lv-dialog select[name=target]");
  await page.selectOption(".lv-dialog select[name=target]", { label: "[TEST] Target" });
  await page.fill(".lv-dialog input[name=margin]", "4");
  await page.selectOption(".lv-dialog select[name=weapon]", "6");
  await page.check(".lv-dialog input[name=cover]");
  await page.screenshot({ path: `${SHOTS}/T-602-dialog.png` });
  await page.click(".lv-dialog button[data-action=ok]");
  await page.waitForFunction((id) => game.messages.get(id)?.getFlag("leverage-gta", "roll")?.damage, oppId, { timeout: 8000 });
  const dmg = await page.evaluate((id) => game.messages.get(id).getFlag("leverage-gta", "roll").damage, oppId);
  const half = Math.floor((4 + dmg.weaponRoll) / 2);
  const afterCover = await state();
  record("cover halves margin + weapon roll", dmg.cover && dmg.raw === 4 + dmg.weaponRoll && dmg.damage === half, dmg);
  record("vest absorbs first, Life takes the rest", afterCover.vest === 6 - Math.min(6, half) && afterCover.life === ids.max - Math.max(0, half - 6), { afterCover, half });
  await page.waitForTimeout(600);
  record("button gone and summary shown on the card", (await card.locator(".lv-roll-btn--damage").count()) === 0 && (await card.locator(".lv-roll-note--damage").count()) === 1);
  record("a damage line is in the chat", await page.evaluate(() => game.messages.contents.some((m) => m.getFlag("leverage-gta", "damage")?.targetName === "[TEST] Target")));

  // 1b. Linked roll: a player roll that beat the opposition hides the button; one that lost shows it.
  for (const [total, shows] of [[100, false], [0, true]]) {
    const linkId = await page.evaluate(async ({ crew, fake }) => {
      await ChatMessage.create({ content: "x", flags: { "leverage-gta": { roll: { ...fake, opposition: true } } } });
      await ChatMessage.create({ content: "x", flags: { "leverage-gta": { roll: { ...fake, actorUuid: game.actors.get(crew).uuid } } } });
      return (await game.leverage.opposition({ dice: [12, 12], label: "[TEST] Linked" })).id;
    }, { crew: ids.crew, fake: fakeRoll({ total }) });
    created.messages.push(linkId);
    await page.waitForTimeout(1000);
    const count = await page.locator(`.chat-message[data-message-id="${linkId}"] .lv-roll-btn--damage`).count();
    record(`linked player roll of ${total}: button ${shows ? "shown" : "hidden"}`, (count === 1) === shows, count);
  }

  // 2. Open field, no vest left to speak of: reset and hit with fixed numbers.
  await page.evaluate((id) => game.actors.get(id).update({ "system.vest.value": 6, "system.life.value": game.actors.get(id).system.life.max }), ids.crew);
  const open = await page.evaluate((id) => game.leverage.combat.applyDamage({ target: id, margin: 5, weaponDie: 6, weaponRoll: 4 }).then((r) => r), ids.crew);
  const s2 = await state();
  record("open field: 9 damage, vest 6 absorbed, Life -3", open.damage === 9 && open.absorbed === 6 && s2.vest === 0 && s2.life === ids.max - 3, { open, s2 });

  // 3. NPC target.
  const n = await page.evaluate((id) => game.leverage.combat.applyDamage({ target: id, margin: 2, weaponRoll: 1 }).then(() => game.actors.get(id).system.life.value), ids.npc);
  record("NPC takes damage too", n === 16 - 3 || n === 18 - 3, n);

  // 4. Wasted.
  await page.evaluate((id) => game.actors.get(id).update({ "system.life.value": 3 }), ids.crew);
  const before = await state();
  const w = await page.evaluate((id) => game.leverage.combat.applyDamage({ target: id, margin: 20, weaponRoll: 2, confirm: false }), ids.crew);
  const after = await state();
  record("Life 0 gives Wasted", w.down && w.kind === "wasted", w);
  record("Wasted: full Life, +1 PP, hospital d4 (1 step)", after.life === ids.max && after.pp === before.pp + 1 && after.money === before.money - 1, { before, after });
  record("Wasted: scene weapon lost, Job weapon kept", !after.items.includes("[TEST] Scene gun") && after.items.includes("[TEST] Job rifle"), after.items);
  record("Wasted does not raise stars", (await stars()) === 1);
  const wastedId = await page.evaluate(() => game.messages.contents.filter((m) => m.getFlag("leverage-gta", "down")?.kind === "wasted").at(-1)?.id);
  created.messages.push(wastedId);
  await page.waitForSelector(`.chat-message[data-message-id="${wastedId}"] .lv-down-title`);
  record("WASTED card text", (await page.locator(`.chat-message[data-message-id="${wastedId}"] .lv-down-title`).innerText()).trim() === "WASTED");
  await page.evaluate((id) => document.querySelector(`.chat-message[data-message-id="${id}"]`)?.scrollIntoView(), wastedId);
  await page.locator(`.chat-message[data-message-id="${wastedId}"]`).screenshot({ path: `${SHOTS}/T-602-wasted.png` });

  // 5. Busted in Liberty City: no bail, rescue, +1 star, +1 PP, no money.
  const b0 = await state();
  await page.evaluate((id) => game.leverage.combat.down(id, { byPolice: true, confirm: false }), ids.crew);
  const b1 = await state();
  record("Busted (Liberty): PP +1, no bail paid, stars +1", b1.pp === b0.pp + 1 && b1.money === b0.money && (await stars()) === 2, { b0, b1 });
  const bustedId = await page.evaluate(() => game.messages.contents.filter((m) => m.getFlag("leverage-gta", "down")?.kind === "busted").at(-1)?.id);
  created.messages.push(bustedId);
  await page.waitForSelector(`.chat-message[data-message-id="${bustedId}"] .lv-down-title`);
  await page.evaluate((id) => document.querySelector(`.chat-message[data-message-id="${id}"]`)?.scrollIntoView(), bustedId);
  await page.locator(`.chat-message[data-message-id="${bustedId}"]`).screenshot({ path: `${SHOTS}/T-602-busted.png` });

  // 6. Busted where bail exists (Carcer): pays d6 (2 steps), stars unchanged.
  await page.evaluate((S) => game.settings.set(S, "wanted", { city: "carcer", level: 1 }), S);
  const c0 = await state();
  await page.evaluate((id) => game.leverage.combat.down(id, { byPolice: true, confirm: false }), ids.crew);
  const c1 = await state();
  record("Busted (Carcer): bail d6 paid, stars unchanged", c1.money === c0.money - 2 && (await stars()) === 1, { c0, c1 });

  // 7. House rules off.
  await page.evaluate((S) => game.settings.set(S, "houseRules.money", false), S);
  const m0 = await state();
  await page.evaluate((id) => game.leverage.combat.down(id, { confirm: false }), ids.crew);
  record("houseRules.money off: Wasted pays nothing", (await state()).money === m0.money);
  await page.evaluate((S) => game.settings.set(S, "wanted", { city: "liberty", level: 1 }), S);
  await page.evaluate((S) => game.settings.set(S, "houseRules.stars", false), S);
  await page.evaluate((id) => game.leverage.combat.down(id, { byPolice: true, confirm: false }), ids.crew);
  record("houseRules.stars off: rescue raises nothing", (await stars()) === 1);
  await page.evaluate((S) => game.settings.set(S, "houseRules.life", false), S);
  const off = await page.evaluate((id) => game.leverage.combat.applyDamage({ target: id, margin: 9, weaponRoll: 9 }), ids.crew);
  record("houseRules.life off: damage refused", off === null);
  const own = log.own().filter((e) => !e.includes("npc.css"));
  record("no system errors in console", own.length === 0, own);
} catch (err) {
  record("run", false, err.message.split("\n").slice(0, 6).join(" | "));
  await page.screenshot({ path: `${SHOTS}/T-602-failure.png` }).catch(() => {});
} finally {
  await page.evaluate(async ({ saved, created, S }) => {
    if (saved) {
      await game.settings.set(S, "wanted", saved.wanted);
      await game.settings.set(S, "houseRules.life", saved.life);
      await game.settings.set(S, "houseRules.money", saved.money);
      await game.settings.set(S, "houseRules.stars", saved.stars);
    }
    const tagged = game.messages.contents.filter((m) => created.messages.includes(m.id) || m.getFlag(S, "damage") || m.getFlag(S, "down")
      || m.speaker?.alias === "[TEST] Target" || m.getFlag(S, "roll")?.flavor?.startsWith("[TEST]"));
    if (tagged.length) await ChatMessage.deleteDocuments(tagged.map((m) => m.id));
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) await a.delete();
  }, { saved, created, S }).catch(() => {});
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);
