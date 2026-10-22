/* global Scene */
/**
 * L-06 check (real Foundry): global Traits and Complications on the scene strip (GM and player), Location Traits of
 * the viewed Scene (pin + Location name, no X), rolls with `scene:<id>`, the opposition roller, the Job Tracker
 * (Complications without a Job), End scene and End Job. Only `[TEST]` data; settings and Scene restored.
 * Exit: 0 pass, 1 fail, 2 n/a.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const record = (name, ok, detail = "") => results.push({ name, ok: Boolean(ok), detail: ok ? "" : JSON.stringify(detail) });
const S = "leverage-gta";
const wait = (ms) => page.waitForTimeout(ms);
const panel = page.locator("#leverage-scene-panel");
const state = () => page.evaluate((s) => ({ traits: game.settings.get(s, "globalTraits"), complications: game.settings.get(s, "complications"), job: game.settings.get(s, "activeJob") }), S);
let ids = null;
let saved = null;
let playerBrowser = null;
let playerLog = null;

try {
  await login(page, env);
  const setup = await page.evaluate(async (s) => {
    const before = {
      job: foundry.utils.deepClone(game.settings.get(s, "activeJob")),
      traits: foundry.utils.deepClone(game.settings.get(s, "globalTraits")),
      complications: foundry.utils.deepClone(game.settings.get(s, "complications")),
      collapsed: game.settings.get(s, "scenePanel.collapsed"),
      activeScene: game.scenes.active?.id ?? null
    };
    await game.settings.set(s, "scenePanel.collapsed", false);
    await game.settings.set(s, "activeJob", { name: "", goal: "" });
    await game.settings.set(s, "globalTraits", []);
    await game.settings.set(s, "complications", []);
    const scene = await Scene.create({ name: "[TEST] L6 Scene" });
    const place = await Actor.create({ name: "[TEST] L6 Place", type: "location", system: { scene: scene.uuid, traits: [{ name: "[TEST] L6 Dock Lights", die: 8 }] } });
    const crew = await Actor.create({
      name: "[TEST] L6 Crew", type: "crew", ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
      system: { attributes: { agility: { die: 10 } }, roles: { thief: { die: 10 } } }
    });
    let user = game.users.find((u) => u.name === "[TEST] Player");
    const created = !user;
    user ??= await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    await scene.activate();
    return { before, scene: scene.id, place: place.id, crew: crew.id, user: user.id, created };
  }, S);
  saved = setup.before;
  ids = setup;
  await page.waitForFunction((id) => canvas?.scene?.id === id, ids.scene, { timeout: 30000 });
  await wait(1500);

  // ---- (1) the strip as GM
  const plusT = panel.locator(".lv-sp-plus--trait");
  const plusC = panel.locator(".lv-sp-plus--complication");
  const border = async (loc) => { for (let i = 0; i < 10; i++) { const c = await loc.first().evaluate((el) => getComputedStyle(el).borderLeftColor); if (c) return c; await wait(300); } return ""; };
  await wait(800);
  const bt = await border(plusT);
  const bc = await border(plusC);
  record("+ Trait and + Complication have different borders", bt && bc && bt !== bc, { bt, bc });
  await plusT.click();
  const addBorder = await border(panel.locator(".lv-sp-add"));
  record("adding a Trait uses the Trait border", addBorder === bt, { addBorder, bt });
  await panel.locator(".lv-sp-add-input").fill("[TEST] L6 Fog");
  await panel.locator(".lv-sp-add-input").press("Enter");
  await wait(700);
  let s = await state();
  record("+ Trait then Enter creates a global Trait (d6)", s.traits.length === 1 && s.traits[0].name === "[TEST] L6 Fog" && s.traits[0].die === 6, s);
  await plusC.click();
  record("adding a Complication uses the Complication border", (await border(panel.locator(".lv-sp-add"))) === bc);
  await panel.locator(".lv-sp-add-input").fill("[TEST] L6 Cancelled");
  await panel.locator(".lv-sp-add-input").press("Escape");
  await wait(500);
  s = await state();
  record("Esc cancels without creating", s.complications.length === 0 && (await panel.locator(".lv-sp-add").count()) === 0, s);
  await plusC.click();
  await panel.locator(".lv-sp-add-input").fill("[TEST] L6 Sirens");
  await panel.locator(".lv-sp-add-input").press("Enter");
  await wait(700);
  s = await state();
  record("+ Complication then Enter creates it (d6)", s.complications.length === 1 && s.complications[0].name === "[TEST] L6 Sirens" && s.complications[0].die === 6, s);
  const tid = s.traits[0].id;
  const cid = s.complications[0].id;
  await panel.locator(`[data-entry][data-id="${tid}"] [data-action="editDie"]`).click();
  await wait(300);
  await page.screenshot({ path: `${SHOTS}/L6-picker.png` });
  const choices = await panel.locator(`[data-entry][data-id="${tid}"] [data-action="setDie"]`).evaluateAll((els) => els.map((e) => e.dataset.die));
  record("picker offers d4..d12", ["4", "6", "8", "10", "12"].every((d) => choices.includes(d)), choices);
  await panel.locator(`[data-entry][data-id="${tid}"] [data-action="setDie"][data-die="10"]`).click();
  await wait(600);
  s = await state();
  record("picker changes the Trait to d10", s.traits[0].die === 10, s);

  // add row keeps the typed text and focus across a re-render
  await plusT.click();
  await panel.locator(".lv-sp-add-input").fill("[TEST] L6 half typed");
  await page.evaluate(() => Hooks.callAll("leverage.tableStateChanged"));
  await wait(500);
  const kept = await panel.locator(".lv-sp-add-input").evaluate((el) => ({ value: el.value, focused: document.activeElement === el }));
  record("add row keeps text and focus after a re-render", kept.value === "[TEST] L6 half typed" && kept.focused, kept);
  await panel.locator(".lv-sp-add-input").press("Escape");
  await wait(300);

  // picker: current die ringed, chip name visible
  await panel.locator(`[data-entry][data-id="${tid}"] [data-action="editDie"]`).click();
  await wait(300);
  const picking = await panel.locator(`[data-entry][data-id="${tid}"]`).evaluate((el) => ({
    pressed: el.querySelector('[aria-pressed="true"]')?.dataset.die, name: el.querySelector(".lv-sp-name")?.textContent
  }));
  record("picker marks the current die and shows the name", picking.pressed === "10" && /L6 Fog/.test(picking.name), picking);
  await page.mouse.click(900, 700);
  await wait(300);

  // long names: three chips, the controls stay together on one row
  await page.evaluate(async (k) => game.settings.set(k, "complications", [
    ...game.settings.get(k, "complications"),
    { id: "long1", name: "[TEST] L6 A very long complication name that must be cut", die: 6 },
    { id: "long2", name: "[TEST] L6 Another quite long complication name", die: 8 }
  ]), S);
  await wait(700);
  const ctrl = await panel.evaluate((el) => {
    const r = [...el.querySelectorAll(".lv-sp-plus, .lv-sp-edit")].map((b) => b.getBoundingClientRect().top);
    return { tops: r, group: el.querySelectorAll(".lv-sp-controls").length };
  });
  record("controls stay together in one group on one row", ctrl.group === 1 && ctrl.tops.every((t) => Math.abs(t - ctrl.tops[0]) < 1), ctrl);
  await page.mouse.move(900, 700);
  await page.screenshot({ path: `${SHOTS}/L6-strip-long.png` });
  await page.evaluate(async (k) => game.settings.set(k, "complications", game.settings.get(k, "complications").filter((c) => !c.id.startsWith("long"))), S);
  await wait(500);

  // Location Trait of the viewed Scene
  const place = panel.locator(".lv-sp-chip--place");
  const placeText = await place.innerText().catch(() => "");
  record("GM: Location Trait shows pin and Location name, no X", (await place.count()) === 1 && /Dock Lights/i.test(placeText) && /L6 Place/i.test(placeText)
    && (await place.locator(".fa-location-dot").count()) === 1 && (await place.locator(".lv-sp-x").count()) === 0, placeText);
  record("no chip cut without an ellipsis", await panel.evaluate((el) => [...el.querySelectorAll(".lv-sp-name, .lv-sp-place")].every((n) => getComputedStyle(n).textOverflow === "ellipsis")));
  record("nothing overlaps inside the strip", await panel.evaluate((el) => {
    const chips = [...el.querySelectorAll(".lv-sp-chip, .lv-sp-plus, .lv-sp-edit, .lv-sp-toggle")].map((c) => c.getBoundingClientRect());
    return chips.every((a, i) => chips.every((b, j) => i === j || a.right <= b.left + 0.5 || b.right <= a.left + 0.5 || a.bottom <= b.top + 0.5 || b.bottom <= a.top + 0.5));
  }));
  await page.mouse.move(900, 700);
  await wait(500);
  await page.screenshot({ path: `${SHOTS}/L6-strip-gm.png` });

  // ---- player
  playerBrowser = await openBrowser(env, { secondary: true });
  const pp = playerBrowser.page;
  playerLog = collectConsole(pp);
  await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });
  await pp.waitForTimeout(1500);
  const pPanel = pp.locator("#leverage-scene-panel");
  const pText = await pPanel.innerText().catch(() => "");
  record("player sees the Trait, the Complication and the Location Trait", /L6 Fog/i.test(pText) && /L6 Sirens/i.test(pText) && /Dock Lights/i.test(pText), pText);
  record("player has no controls (+, X, pen, die editing)", (await pPanel.locator(".lv-sp-plus, .lv-sp-x, .lv-sp-edit, [data-action='editDie']").count()) === 0);
  record("player's Location Trait has pin and place name", (await pPanel.locator(".lv-sp-chip--place .fa-location-dot").count()) === 1 && /L6 Place/i.test(await pPanel.locator(".lv-sp-chip--place").innerText()));
  await pp.screenshot({ path: `${SHOTS}/L6-strip-player.png` });
  await page.evaluate(async (k) => game.settings.set(k, "globalTraits", [...game.settings.get(k, "globalTraits"), { id: "livex", name: "[TEST] L6 Live", die: 4 }]), S);
  await pp.waitForTimeout(1000);
  record("player's strip updates live", /L6 Live/i.test(await pPanel.innerText()));
  await page.evaluate(async (k) => game.settings.set(k, "globalTraits", game.settings.get(k, "globalTraits").filter((t) => t.id !== "livex")), S);

  // ---- (2) rolls with scene:<id>
  const roll = (refs, flavor) => page.evaluate(async ([crew, r, f]) => {
    const msg = await game.leverage.rollPool({ actor: crew, refs: r, flavor: f });
    return msg ? { id: msg.id } : null;
  }, [ids.crew, refs, flavor]);
  const refsInfo = await page.evaluate(async () => {
    const mod = await import(foundry.utils.getRoute("systems/leverage-gta/module/scene-location.mjs"));
    return mod.currentSceneTraits();
  });
  const globalRef = refsInfo.find((t) => /L6 Fog/.test(t.name));
  const placeRef = refsInfo.find((t) => /Dock Lights/.test(t.name));
  record("currentSceneTraits has the global and the Location Trait", Boolean(globalRef && placeRef), refsInfo);
  const m1 = await roll(["attributes.agility", "roles.thief", `scene:${globalRef?.id}`], "[TEST] L6 global");
  record("rollPool with a global scene:<id> works", Boolean(m1), m1);
  const m2 = await roll(["attributes.agility", "roles.thief", `scene:${placeRef?.id}`], "[TEST] L6 place");
  record("rollPool with a Location scene:<id> works", Boolean(m2), m2);
  const bad = await roll(["attributes.agility", "roles.thief", "scene:does-not-exist"], "[TEST] L6 bad");
  record("rollPool with an unknown scene:<id> is refused", bad === null, bad);

  // Pool builder window offers both
  await page.evaluate((id) => game.actors.get(id).sheet.render(true), ids.crew);
  await page.locator(".application.crew-sheet [data-action='addDie']").waitFor({ timeout: 10000 });
  await page.locator(".application.crew-sheet [data-action='addDie']").click();
  await page.locator(".lv-pool-builder .lv-pb-chip").first().waitFor({ timeout: 5000 });
  const sceneRefs = await page.locator('.lv-pool-builder .lv-pb-chip[data-ref^="scene:"]').evaluateAll((els) => els.map((e) => e.dataset.ref));
  record("Pool builder offers the global and the Location Trait", sceneRefs.includes(`scene:${globalRef?.id}`) && sceneRefs.includes(`scene:${placeRef?.id}`), sceneRefs);
  await page.screenshot({ path: `${SHOTS}/L6-pool-builder.png` });
  await page.evaluate((id) => game.actors.get(id).sheet.close(), ids.crew);
  await wait(500);

  // Opposition roller: Complications (and the Location's Traits)
  await page.evaluate(async () => {
    const { openOppositionRoller } = await import(foundry.utils.getRoute("systems/leverage-gta/module/dice/opposition.mjs"));
    await openOppositionRoller();
  });
  await page.locator(".lv-opp").waitFor({ timeout: 8000 });
  await wait(600);
  const oppText = await page.locator(".lv-opp").innerText();
  record("Opposition roller lists the Complication", (await page.locator(`.lv-opp [data-key="job.${cid}"]`).count()) === 1, oppText);
  record("Opposition roller lists the Location Traits", /Dock Lights/i.test(oppText), oppText);
  await page.screenshot({ path: `${SHOTS}/L6-opposition.png` });
  await page.evaluate(() => { for (const a of foundry.applications.instances.values()) if (a.element?.querySelector?.(".lv-opp")) a.close(); });

  // ---- (4) Job Tracker without an active Job
  await page.evaluate(async () => {
    const { JobTracker } = await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/gm/job-tracker.mjs"));
    await new JobTracker().render({ force: true });
  });
  await page.locator("#leverage-job-tracker").waitFor({ timeout: 8000 });
  await wait(600);
  const trk = await page.locator("#leverage-job-tracker").innerText();
  record("Tracker lists Complications with no active Job", /L6 Sirens/i.test(trk) && (await state()).job.name === "", trk);
  await page.screenshot({ path: `${SHOTS}/L6-tracker.png` });
  await page.evaluate(() => { for (const a of foundry.applications.instances.values()) if (a.id === "leverage-job-tracker") a.close(); });

  // ---- (5) End scene clears global Traits only. Only the [TEST] crew counts as "played" while it runs.
  const endScene = await page.evaluate(async () => {
    const { endScene } = await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/gm/job-actions.mjs"));
    const fake = [{ isGM: false, id: "fake", character: game.actors.getName("[TEST] L6 Crew") }];
    Object.defineProperty(game.users, "contents", { configurable: true, get: () => fake });
    try { return await endScene({ confirm: false }); } finally { delete game.users.contents; }
  });
  s = await state();
  record("End scene clears global Traits, keeps Complications", s.traits.length === 0 && s.complications.length === 1, { endScene, s });
  await wait(800);
  const afterScene = await panel.innerText();
  record("strip drops the Trait, keeps the Location Trait and the Complication", !/L6 Fog/.test(afterScene) && /Dock Lights/i.test(afterScene) && /L6 Sirens/i.test(afterScene), afterScene);

  // ---- (5) End Job clears Complications, pays, creates Records
  const end = await page.evaluate(async ([crewId]) => {
    const ja = await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/gm/job-actions.mjs"));
    await game.settings.set("leverage-gta", "activeJob", { name: "[TEST] L6 Job", goal: "" });
    const crew = game.actors.get(crewId);
    const fake = [{ isGM: false, id: "fake", character: crew }];
    Object.defineProperty(game.users, "contents", { configurable: true, get: () => fake });
    let paid;
    try { paid = await ja.endJob({ name: "[TEST] L6 Record", total: 0, shares: { [crewId]: 0 } }); } finally { delete game.users.contents; }
    return {
      paid, complications: game.settings.get("leverage-gta", "complications"), job: game.settings.get("leverage-gta", "activeJob"),
      records: crew.items.filter((i) => /L6 Record/.test(i.name)).length
    };
  }, [ids.crew]);
  record("End Job pays, creates the Record and clears Complications and the Job", end.paid >= 1 && end.records === 1 && end.complications.length === 0 && end.job.name === "", end);
  await wait(800);
  await page.screenshot({ path: `${SHOTS}/L6-after-end.png` });

  record("no system console errors (GM)", log.own().length === 0, log.own());
  record("no system console errors (player)", playerLog.own().length === 0, playerLog.own());
} catch (error) {
  record("script", false, String(error).slice(0, 600));
  await page.screenshot({ path: `${SHOTS}/L6-failure.png` }).catch(() => {});
} finally {
  try {
    await page.evaluate(async ([s, before, made]) => {
      try { delete game.users.contents; } catch { /* not patched */ }
      if (before) {
        await game.settings.set(s, "activeJob", before.job);
        await game.settings.set(s, "globalTraits", before.traits);
        await game.settings.set(s, "complications", before.complications);
        await game.settings.set(s, "scenePanel.collapsed", before.collapsed);
        if (before.activeScene) await game.scenes.get(before.activeScene)?.activate();
      }
      for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) { await a.sheet?.close(); await a.delete(); }
      for (const sc of game.scenes.filter((x) => x.name.startsWith("[TEST]"))) await sc.delete();
      for (const m of game.messages.filter((x) => /\[TEST\]/.test(x.flavor ?? "") || /L6 Record/.test(x.content ?? ""))) await m.delete();
      if (made?.created) await game.users.get(made.user)?.delete();
    }, [S, saved, ids]);
  } catch (error) { console.log("cleanup failed", String(error).slice(0, 200)); }
  await playerBrowser?.browser.close();
  await browser.close();
}
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail.slice(0, 500)}` : ""}`);
console.log(`console errors (system): ${log.own().length + (playerLog?.own().length ?? 0)}; other: ${log.other().length + (playerLog?.other().length ?? 0)}`);
for (const e of [...log.other(), ...(playerLog?.other() ?? [])].slice(0, 5)) console.log("other:", e.slice(0, 160));
process.exit(results.every((r) => r.ok) ? 0 : 1);
