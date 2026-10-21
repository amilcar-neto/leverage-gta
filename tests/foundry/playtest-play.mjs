/**
 * Playtest stage 2: plays the Job "O Cofre do Moretti" with the GM and two players in separate browsers.
 * Run playtest-setup.mjs first (it resets the table). Data stays in the world.
 * Usage: node tests/foundry/playtest-play.mjs [fromAct]  (acts 1..6; default 1)
 */
import { requireEnv } from "./lib.mjs";
import { setCounter, openTable, shot, step, report, S, itemId, addDie, chips, pressRoll, rollFlag, closeApps } from "./playtest-lib.mjs";

const env = requireEnv();
const ROSA = "Jogadora Rosa";
const MARCO = "Jogador Marco";
const SOL = "Marisol \"Sol\" Quintero";
const BRUTO = "Marco \"Bruto\" Silva";
setCounter(20);
const from = Number(process.argv[2] ?? 1);
const table = await openTable(env, [ROSA, MARCO]);
const gm = table.gm.page;
const rosa = table.players[ROSA].page;
const marco = table.players[MARCO].page;

const chatCardShot = async (page, id, name) => {
  await page.evaluate((i) => { ui.sidebar.changeTab?.("chat", "primary"); document.querySelector(`#chat .chat-message[data-message-id="${i}"]`)?.scrollIntoView(); }, id);
  await page.waitForTimeout(500);
  const loc = page.locator(`#chat .chat-message[data-message-id="${id}"]`);
  if (await loc.count()) await loc.screenshot({ path: `tests/foundry/screenshots/playtest-card-${name}.png` });
};
const state = (page, name) => page.evaluate((n) => {
  const a = game.actors.getName(n);
  return { life: a.system.life.value, vest: a.system.vest.value, money: a.system.money.steps, pp: a.system.plotPoints.value, items: a.items.size };
}, name);
const ensureSheet = async (page) => {
  if (!(await page.locator(".crew-sheet").count())) {
    await page.evaluate(() => game.user.character.sheet.render(true));
    await page.waitForSelector(".crew-sheet");
    await page.waitForTimeout(1200);
  }
  await page.evaluate(() => game.user.character.sheet.setPosition({ left: 200, top: 40 }));
};
const ensureChat = async (page) => { await page.evaluate(() => { ui.sidebar.expand?.(); ui.sidebar.changeTab?.("chat", "primary"); }); await page.waitForTimeout(700); };

// ACT 1: Sol talks her way past the guards.
if (from <= 1) {
  await step("Act1 Sol builds the Pool with clicks and + DIE", async () => {
    await ensureSheet(rosa);
    await rosa.locator('.crew-sheet [data-action=togglePool][data-pool-ref="attributes.alertness"]').click();
    await rosa.locator('.crew-sheet [data-action=togglePool][data-pool-ref="roles.grifter"]').click();
    const dist = await itemId(rosa, SOL, "Pawnshop Eyes");
    await rosa.locator(`.crew-sheet [data-pool-ref="item:${dist}:d8"]`).click();
    const spec = await itemId(rosa, SOL, "Fast Talk");
    await rosa.locator(`.crew-sheet [data-pool-ref="item:${spec}"]`).first().click();
    await addDie(rosa, "Silver Tongue");
    await addDie(rosa, "Signature Blazer");
    await shot(rosa, "sol-pool-built");
    return await chips(rosa);
  }, rosa);

  await step("Act1 Sol + DIE menu screenshot", async () => {
    await rosa.locator(".crew-sheet [data-action=addDie]").click();
    await rosa.locator(".lv-pool-menu").waitFor();
    await shot(rosa, "sol-plus-die-menu");
    const names = await rosa.evaluate(() => ({ headers: [...document.querySelectorAll(".lv-pool-menu-header")].map((h) => h.textContent), names: [...document.querySelectorAll(".lv-pool-menu-name")].map((n) => n.textContent) }));
    await rosa.keyboard.press("Escape");
    await rosa.waitForTimeout(300);
    return names;
  }, rosa);

  let solRoll = null;
  await step("Act1 Sol rolls", async () => {
    await ensureChat(rosa);
    solRoll = await pressRoll(rosa);
    await shot(rosa, "sol-rolled");
    return await rollFlag(rosa, solRoll);
  }, rosa);

  await step("Act1 GM rolls Gang opposition through the roller UI", async () => {
    await gm.evaluate(() => game.leverage.openOppositionRoller());
    await gm.waitForSelector(".lv-opp", { timeout: 8000 });
    await gm.waitForTimeout(800);
    await gm.locator(".lv-opp [data-action=toggleGang]").click();
    await gm.fill(".lv-opp input[name=label]", "Capangas na porta do armazem");
    await shot(gm, "gm-opposition-roller-gang");
    const before = await gm.evaluate(() => game.messages.contents.at(-1)?.id);
    await gm.locator(".lv-opp [data-action=roll]").click();
    await gm.waitForFunction((b) => game.messages.contents.at(-1)?.id !== b, before, { timeout: 8000 });
    await gm.waitForTimeout(800);
    const id = await gm.evaluate(() => game.messages.contents.at(-1).id);
    await chatCardShot(gm, id, "gm-opposition-gang");
    const mine = solRoll ? await rollFlag(rosa, solRoll) : null;
    const theirs = await rollFlag(gm, id);
    await shot(rosa, "sol-sees-opposition");
    return { sol: mine?.total, gm: theirs.total, outcome: mine && mine.total > theirs.total ? "Sol passes" : "Sol loses/ties" };
  }, gm);
  await closeApps(gm, /opposition/i);
}

// ACT 2: Bruto kicks the door with Grana in the Pool; GM rolls police at stars.
if (from <= 2) {
  await step("Act2 Bruto builds Pool: Strength+Hitter+Brawling+Tire Iron+Grana", async () => {
    await ensureSheet(marco);
    await marco.locator('.crew-sheet [data-pool-ref="attributes.strength"]').first().click();
    await marco.locator('.crew-sheet [data-pool-ref="roles.hitter"]').first().click();
    const spec = await itemId(marco, BRUTO, "Brawling");
    await marco.locator(`.crew-sheet [data-pool-ref="item:${spec}"]`).first().click();
    await addDie(marco, "Tire Iron");
    await addDie(marco, "Heavy Hitter");
    await marco.locator(".crew-sheet [data-action=addDie]").click();
    await marco.locator(".lv-pool-menu").waitFor();
    const menu = await marco.evaluate(() => [...document.querySelectorAll(".lv-pool-menu-name")].map((n) => n.textContent));
    await marco.locator(".lv-pool-menu-item", { hasText: /Grana|Money/i }).first().click().catch(() => marco.keyboard.press("Escape"));
    await marco.waitForTimeout(400);
    await shot(marco, "bruto-pool-built");
    return { chips: await chips(marco), menuHadMoney: menu.some((m) => /grana|money|\$/i.test(m)) };
  }, marco);
  let brutoRoll = null;
  const money0 = await state(marco, BRUTO).catch(() => null);
  await step("Act2 Bruto rolls (Grana die drops 1 step)", async () => {
    brutoRoll = await pressRoll(marco);
    await shot(marco, "bruto-rolled");
    const after = await state(marco, BRUTO);
    await chatCardShot(marco, brutoRoll, "bruto-roll");
    return { flag: await rollFlag(marco, brutoRoll), money0: money0?.money, money1: after.money };
  }, marco);
  await step("Act2 GM rolls Police (1 star) + gang vs Bruto", async () => {
    await gm.evaluate(() => game.leverage.openOppositionRoller());
    await gm.waitForSelector(".lv-opp", { timeout: 8000 });
    await gm.waitForTimeout(800);
    await gm.locator(".lv-opp [data-action=togglePolice]").click();
    await gm.fill(".lv-opp input[name=label]", "Policia chega");
    await shot(gm, "gm-opposition-roller-police");
    const before = await gm.evaluate(() => game.messages.contents.at(-1)?.id);
    await gm.locator(".lv-opp [data-action=roll]").click();
    await gm.waitForFunction((b) => game.messages.contents.at(-1)?.id !== b, before, { timeout: 8000 });
    await gm.waitForTimeout(800);
    const id = await gm.evaluate(() => game.messages.contents.at(-1).id);
    await chatCardShot(gm, id, "gm-opposition-police");
    return { bruto: (await rollFlag(marco, brutoRoll)).total, gm: (await rollFlag(gm, id)).total, id };
  }, gm);
  await closeApps(gm, /opposition/i);
}

// ACT 3: Damage, stars, Grana payment.
if (from <= 3) {
  await step("Act3 Bruto fails: weak Pool (Intelligence + Mastermind) vs gang d8s", async () => {
    await ensureSheet(marco);
    await marco.locator(".crew-sheet [data-action=clearPool]").click().catch(() => {});
    await marco.locator('.crew-sheet [data-pool-ref="attributes.intelligence"]').first().click();
    await marco.locator('.crew-sheet [data-pool-ref="roles.mastermind"]').first().click();
    const mine = await pressRoll(marco);
    const opp = await gm.evaluate(async () => (await game.leverage.opposition({ dice: [8, 8, 8, 8], label: "Capangas atiram" })).id);
    await gm.waitForTimeout(800);
    await ensureChat(gm);
    return { bruto: (await rollFlag(marco, mine)).total, gm: (await rollFlag(gm, opp)).total };
  }, marco);

  await step("Act3 GM applies damage to Bruto from the opposition card (button)", async () => {
    await ensureChat(gm);
    const id = await gm.evaluate(() => game.messages.contents.filter((m) => m.getFlag("leverage-gta", "roll")?.opposition).at(-1)?.id);
    const card = gm.locator(`#chat .chat-message[data-message-id="${id}"]`);
    await card.scrollIntoViewIfNeeded();
    const btn = card.locator(".lv-roll-btn--damage");
    if (!(await btn.count())) throw new Error("no APPLY DAMAGE button on the latest opposition card");
    const before = await state(gm, BRUTO);
    await btn.click();
    await gm.waitForSelector(".lv-dialog select[name=target]");
    await gm.selectOption(".lv-dialog select[name=target]", { label: BRUTO });
    await gm.fill(".lv-dialog input[name=margin]", "3");
    await shot(gm, "gm-damage-dialog");
    await gm.click(".lv-dialog button[data-action=ok]");
    await gm.waitForFunction((i) => game.messages.get(i)?.getFlag("leverage-gta", "roll")?.damage, id, { timeout: 8000 });
    await gm.waitForTimeout(800);
    const after = await state(gm, BRUTO);
    await chatCardShot(gm, id, "gm-damage-applied");
    await shot(marco, "bruto-after-damage");
    return { before, after, damage: await gm.evaluate((i) => game.messages.get(i).getFlag("leverage-gta", "roll").damage, id) };
  }, gm);

  await step("Act3 GM raises stars by clicking the HUD (star 3)", async () => {
    await gm.locator('#leverage-hud [data-action=setStars][data-level="3"]').click();
    await gm.waitForTimeout(1000);
    const lvl = await gm.evaluate(() => game.leverage.stars.get());
    await shot(gm, "gm-stars-3");
    await shot(marco, "marco-sees-stars-3");
    const hudMarco = await marco.evaluate(() => document.querySelectorAll("#leverage-hud .lv-hud-star.is-on").length);
    return { lvl, starsOnForMarco: hudMarco };
  }, gm);

  await step("Act3 Wanted dialog (GM tool)", async () => {
    await gm.evaluate(() => ui.controls.activate?.({ control: "leverage" }));
    await gm.waitForTimeout(500);
    await gm.locator('[data-tool="wanted"]').first().click();
    await gm.waitForTimeout(1200);
    await shot(gm, "gm-wanted-dialog");
    const buttons = await gm.evaluate(() => [...document.querySelectorAll(".application button, .application [data-action]")].map((b) => b.dataset.action).filter(Boolean));
    return buttons;
  }, gm);

  await step("Act3 Bruto pays Grana via HUD $", async () => {
    await closeApps(gm, /wanted/i);
    const before = await state(marco, BRUTO);
    await marco.locator("#leverage-hud [data-action=payMoney]").click();
    await marco.waitForSelector(".lv-money-dlg", { timeout: 8000 });
    const options = await marco.evaluate(() => [...document.querySelectorAll(".lv-money-dlg select[name=price] option")].map((o) => o.textContent.trim()));
    await shot(marco, "bruto-pay-dialog");
    return { before, options };
  }, marco);

  await step("Act3 Bruto confirms the payment (light vest d4)", async () => {
    const before = await state(marco, BRUTO);
    await marco.selectOption(".lv-money-dlg select[name=price]", { label: "Colete leve (d4)" });
    await marco.waitForTimeout(400);
    await shot(marco, "bruto-pay-light-vest");
    await marco.locator('.lv-dialog button[data-action="ok"], .application button[data-action="ok"]').first().click();
    await marco.waitForTimeout(1200);
    const after = await state(marco, BRUTO);
    await shot(marco, "bruto-paid");
    return { before, after };
  }, marco);
}

// ACT 4: Plot Points.
if (from <= 4) {
  await step("Act4 Sol keeps a third die for 1 PP (card button)", async () => {
    await ensureChat(rosa);
    const id = await rosa.evaluate(() => game.messages.contents.filter((m) => m.getFlag("leverage-gta", "roll")?.actorName?.includes("Sol")).at(-1)?.id);
    const before = await state(rosa, SOL);
    const old = await rollFlag(rosa, id);
    const btn = rosa.locator(`#chat .chat-message[data-message-id="${id}"] [data-action=keepDie]`);
    if (!(await btn.count())) throw new Error("keep button missing on Sol's latest card");
    await btn.click();
    await rosa.waitForTimeout(1500);
    const after = await state(rosa, SOL);
    await chatCardShot(rosa, id, "sol-kept-third");
    return { before: before.pp, after: after.pp, old: old.total, now: (await rollFlag(rosa, id)).total };
  }, rosa);

  await step("Act4 Bruto spends 1 PP with the HUD minus", async () => {
    const before = await state(marco, BRUTO);
    await marco.locator("#leverage-hud [data-action=spendPlotPoint]").click();
    await marco.waitForTimeout(1000);
    const after = await state(marco, BRUTO);
    await shot(marco, "bruto-spent-pp");
    return { before: before.pp, after: after.pp };
  }, marco);

  await step("Act4 Bruto uses Distinction as d4 (hurts) and gains 1 PP", async () => {
    await marco.locator(".crew-sheet [data-action=clearPool]").click().catch(() => {});
    await marco.locator('.crew-sheet [data-pool-ref="attributes.vitality"]').first().click();
    await marco.locator('.crew-sheet [data-pool-ref="roles.thief"]').first().click();
    const dist = await itemId(marco, BRUTO, "Owes the Wrong People");
    await marco.locator(`.crew-sheet [data-pool-ref="item:${dist}:d4"]`).click();
    const before = await state(marco, BRUTO);
    const id = await pressRoll(marco);
    const after = await state(marco, BRUTO);
    await chatCardShot(marco, id, "bruto-distinction-d4");
    return { before: before.pp, after: after.pp, flag: await rollFlag(marco, id) };
  }, marco);

  await step("Act4 GM gives a Plot Point (tool dialog)", async () => {
    await gm.locator('[data-tool="givePlotPoint"]').first().click();
    await gm.waitForTimeout(1200);
    await shot(gm, "gm-give-pp-dialog");
    const info = await gm.evaluate(() => [...document.querySelectorAll(".application.dialog button, .application.dialog input, .application.dialog select")].map((e) => `${e.tagName}:${e.name || e.dataset.action || ""}`));
    return info;
  }, gm);
}

// ACT 5: Complications.
if (from <= 5) {
  await step("Act5 Sol rolls many d4 to get a 1", async () => {
    await closeApps(gm, /dialog|give/i);
    await ensureSheet(rosa);
    let got = null;
    for (let i = 0; i < 6 && !got; i++) {
      await rosa.locator(".crew-sheet [data-action=clearPool]").click().catch(() => {});
      await rosa.locator('.crew-sheet [data-pool-ref="attributes.agility"]').first().click();
      await rosa.locator('.crew-sheet [data-pool-ref="roles.thief"]').first().click();
      for (let k = 0; k < 4; k++) await addDie(rosa, "d4");
      const id = await pressRoll(rosa);
      const f = await rollFlag(rosa, id);
      if (f.entries.some((e) => e.includes("(1)"))) got = id;
    }
    if (!got) throw new Error("no 1 in 6 rolls of many d4 (extremely unlikely)");
    await chatCardShot(rosa, got, "sol-roll-with-ones");
    await ensureChat(gm);
    const btn = gm.locator(`#chat .chat-message[data-message-id="${got}"] [data-action=complication]`);
    if (!(await btn.count())) throw new Error("GM has no Complication button on a card with 1s");
    const ppBefore = (await state(rosa, SOL)).pp;
    const jobBefore = await gm.evaluate((S) => game.settings.get(S, "activeJob").complications.map((c) => `${c.name} d${c.die}`), S);
    await btn.click();
    await gm.waitForTimeout(1500);
    const dialog = await gm.evaluate(() => [...document.querySelectorAll(".application.dialog, dialog")].map((d) => d.innerText.slice(0, 200)));
    await shot(gm, "gm-complication-clicked");
    return { jobBefore, dialog, ppBefore };
  }, gm);
}

// ACT 6: tracker, scene Asset, end scene, end Job.
if (from <= 6) {
  await step("Act6 GM opens the Job tracker, raises and removes a Complication", async () => {
    await gm.locator('[data-tool="tracker"]').first().click();
    await gm.waitForSelector(".lv-trk", { timeout: 8000 });
    await gm.waitForTimeout(800);
    await shot(gm, "gm-tracker-before");
    const rows = () => gm.evaluate(() => [...document.querySelectorAll(".lv-trk-sec")].slice(1, 3).map((s) => [...s.querySelectorAll(".lv-trk-row .lv-trk-name")].map((n) => n.textContent)));
    const before = await rows();
    await gm.locator('.lv-trk [data-action=step][data-list=complications][data-delta="1"]').first().click();
    await gm.waitForTimeout(600);
    await gm.locator('.lv-trk [data-action=remove][data-list=complications]').last().click();
    await gm.waitForTimeout(800);
    await shot(gm, "gm-tracker-after");
    await shot(rosa, "sol-sees-updated-panel");
    const panel = await rosa.locator("#leverage-scene-panel").innerText();
    return { before, after: await rows(), panelHasComplications: panel.includes("COMPLICATIONS") || panel.includes("Complications") };
  }, gm);

  await step("Act6 Sol creates a scene Asset with 1 PP (+ Adicionar)", async () => {
    await closeApps(gm, /tracker/i);
    await ensureSheet(rosa);
    const before = await state(rosa, SOL);
    await rosa.locator(".crew-sheet [data-action=addAsset]").click();
    await rosa.waitForTimeout(1200);
    await shot(rosa, "sol-new-asset-dialog");
    const dlg = await rosa.evaluate(() => [...document.querySelectorAll(".application.dialog, .lv-dialog")].map((d) => d.innerText.replace(/\\s+/g, " ").slice(0, 300)));
    const fields = await rosa.evaluate(() => [...document.querySelectorAll(".lv-dialog input, .lv-dialog select, .lv-dialog button")].map((e) => `${e.tagName}:${e.name || e.dataset.action || ""}`));
    return { before: before.pp, dlg, fields };
  }, rosa);
}

console.log(JSON.stringify({ own: { gm: table.gm.log.own(), rosa: table.players[ROSA].log.own(), marco: table.players[MARCO].log.own() }, other: { gm: table.gm.log.other().slice(0, 5) } }));
await table.close();
process.exit(report.every((r) => r.ok) ? 0 : 1);
