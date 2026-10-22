/* global Scene */
/**
 * T-1016: REFERENCE screenshots of the Cortex Prime flow (pt-BR, 1920x1080) -> tests/foundry/screenshots/ref-prime-*.png.
 * GM browser + a [TEST] Player who owns a [TEST] Crew. Cards are posted through the system's own builders (no dice luck);
 * the Choose dice window is the real one. Everything it creates is `[TEST]` and is removed; settings are restored.
 * Also runs an overlap / cut text / overflow audit on each captured element and prints the result.
 * Exit codes: 0 ok, 1 audit problem or error, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const wait = (ms) => page.waitForTimeout(ms);
const out = (name) => `${SHOTS}/ref-prime-${name}.png`;
const problems = [];
let playerBrowser = null;
let pp = null;
let playerLog = null;
let saved = null;

/** Overlap, cut text and overflow audit inside `selector` of page `p`. */
const audit = (p, selector) => p.evaluate((sel) => {
  const root = document.querySelector(sel);
  if (!root) return { missing: true };
  const box = root.getBoundingClientRect();
  const leaves = [...root.querySelectorAll("*")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden" && !el.closest("svg")
      && (el.matches("input, select, button") || (!el.children.length && el.textContent.trim()));
  });
  const overlaps = [];
  for (let i = 0; i < leaves.length; i += 1) {
    for (let j = i + 1; j < leaves.length; j += 1) {
      const a = leaves[i]; const b = leaves[j];
      if (a.contains(b) || b.contains(a)) continue;
      const x = a.getBoundingClientRect(); const y = b.getBoundingClientRect();
      const w = Math.min(x.right, y.right) - Math.max(x.left, y.left); const h = Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top);
      if (w > 2 && h > 2) overlaps.push(`${a.className}|${a.textContent.trim().slice(0, 14)} x ${b.className}|${b.textContent.trim().slice(0, 14)}`);
    }
  }
  const cut = leaves.filter((el) => !el.matches("input, select") && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow !== "ellipsis").map((el) => el.textContent.trim().slice(0, 30));
  const outside = leaves.filter((el) => { const r = el.getBoundingClientRect(); return r.right > box.right + 1 || r.left < box.left - 1 || r.bottom > box.bottom + 1; }).map((el) => `${el.className}|${el.textContent.trim().slice(0, 14)}`);
  return { overlaps, cut, outside, w: Math.round(box.width), h: Math.round(box.height) };
}, selector);

/** Removes the core notifications (e.g. "no hardware acceleration" of the headless browser) that cover the HUD and strip. */
const clearNotes = (p) => p.evaluate(() => { try { ui.notifications?.clear?.(); } catch { /* ignore */ } document.querySelectorAll("#notifications .notification, #notifications li").forEach((n) => n.remove()); });

/** Screenshots a selector and audits it; problems are collected for the final report. */
async function snap(p, selector, name, { audited = true } = {}) {
  const loc = p.locator(selector).first();
  await clearNotes(p);
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await p.waitForTimeout(600);
  await loc.screenshot({ path: out(name) });
  if (!audited) return;
  const a = await audit(p, selector);
  const bad = a.missing || a.overlaps?.length || a.cut?.length || a.outside?.length;
  console.log(`${bad ? "AUDIT-PROBLEM" : "audit ok"} ${name} ${a.w ?? ""}x${a.h ?? ""}${bad ? ` ${JSON.stringify(a)}` : ""}`);
  if (bad) problems.push(name);
}
const snapPage = async (p, name, clip) => { await clearNotes(p); await p.screenshot({ path: out(name), ...(clip ? { clip } : {}) }); console.log(`shot ${name}`); };
const domClick = (p, selector) => p.evaluate((s) => document.querySelector(s)?.click(), selector);
const card = (id) => `.chat-message[data-message-id="${id}"]`;

/** Posts a pending Prime card of the [TEST] Crew (entries = sizes), faces = values. */
const postPending = (values, sizes) => page.evaluate(async ([vals, dice]) => {
  const { buildRollData } = await import(foundry.utils.getRoute("systems/leverage-gta/module/dice/roll-core.mjs"));
  const actor = game.actors.getName("[TEST] Crew");
  const labels = ["Agility", "Thief", "Safecracking", "Old Docks Loyalty", "d10", "d6"];
  const kinds = ["attribute", "role", "specialty", "distinction", "die", "die"];
  const entries = dice.map((die, i) => ({ ref: `e${i}`, label: labels[i] ?? `d${die}`, kind: kinds[i] ?? "die", die }));
  const data = buildRollData({ entries, values: vals, actorUuid: actor.uuid, actorName: actor.name, actorImg: actor.img, flavor: "rola a Pool", mode: "prime", ppAtRoll: 3 });
  const author = game.users.getName("[TEST] Player").id;
  return (await ChatMessage.create({ author, speaker: ChatMessage.getSpeaker({ actor }), content: "<p>t</p>", flavor: data.flavor, flags: { "leverage-gta": { roll: data } } })).id;
}, [values, sizes]);

/** Posts a resolved card (best two for the total, the next as the effect die). */
const postResolved = (values, sizes) => page.evaluate(async ([vals, dice]) => {
  const root = (f) => import(foundry.utils.getRoute(`systems/leverage-gta/module/dice/${f}.mjs`));
  const { buildRollData } = await root("roll-core");
  const { autoSelection, summarize } = await root("prime-math");
  const actor = game.actors.getName("[TEST] Crew");
  const entries = dice.map((die, i) => ({ ref: `e${i}`, label: `Dado ${i + 1}`, kind: "attribute", die }));
  let data = buildRollData({ entries, values: vals, actorUuid: actor.uuid, actorName: actor.name, actorImg: actor.img, flavor: "rola a Pool", mode: "prime", ppAtRoll: 3 });
  const selection = autoSelection(data.entries);
  const s = summarize(data.entries, selection);
  data = { ...data, status: "resolved", selection, total: s.total, effectDie: s.effectFaces, hitches: s.hitches, botch: s.botch };
  const author = game.users.getName("[TEST] Player").id;
  return (await ChatMessage.create({ author, speaker: ChatMessage.getSpeaker({ actor }), content: "<p>t</p>", flavor: data.flavor, flags: { "leverage-gta": { roll: data } } })).id;
}, [values, sizes]);

/** Posts the Fixer's resolved card. */
const postFixer = (values) => page.evaluate(async (vals) => {
  const { buildOppositionData } = await import(foundry.utils.getRoute("systems/leverage-gta/module/dice/opposition.mjs"));
  const dice = vals.map((_, i) => ({ ref: `opp.${i}`, label: "Oposição", kind: "die", die: 8 }));
  const data = buildOppositionData({ dice, values: vals, name: "GM", flavor: "Guardas do armazém" });
  return (await ChatMessage.create({ content: "<p>t</p>", flavor: data.flavor, flags: { "leverage-gta": { roll: data } } })).id;
}, values);

const winState = (id) => pp.evaluate((mid) => {
  const w = document.getElementById(`lv-resolve-${mid}`);
  return w ? { tiles: w.querySelectorAll(".lv-rd-tile").length, confirmDisabled: w.querySelector('[data-action="confirm"]')?.disabled } : null;
}, id);

try {
  await login(page, env);
  saved = await page.evaluate(async () => {
    const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    const player = await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    const dice = { attributes: {}, roles: {} };
    for (const k of Object.keys(CONFIG.LEVERAGE.attributes)) dice.attributes[k] = { die: 8 };
    for (const k of Object.keys(CONFIG.LEVERAGE.roles)) dice.roles[k] = { die: 8 };
    const crew = await Actor.create({
      name: "[TEST] Crew", type: "crew", system: { ...dice, plotPoints: { value: 3 }, money: { steps: 4 } },
      ownership: { default: 0, [player.id]: OWNER }
    });
    await crew.createEmbeddedDocuments("Item", [
      { name: "Safecracking", type: "specialty", system: { role: "thief" } },
      { name: "Old Docks Loyalty", type: "distinction" },
      { name: "Burner Phone", type: "asset", system: { die: 6 } }
    ]);
    const s = "leverage-gta";
    const before = {
      mode: game.settings.get(s, "rules.rollMode"), list: foundry.utils.deepClone(game.settings.get(s, "complications")),
      traits: foundry.utils.deepClone(game.settings.get(s, "globalTraits")), job: lvTestJob.snapshot(), collapsed: game.settings.get(s, "scenePanel.collapsed"),
      active: game.scenes.active?.id ?? null
    };
    await game.settings.set(s, "rules.rollMode", "prime");
    await game.settings.set(s, "scenePanel.collapsed", false);
    await game.settings.set(s, "complications", [{ id: "tstA", name: "[TEST] Alarme silencioso", die: 6 }, { id: "tstB", name: "[TEST] Cachorro de guarda", die: 4 }]);
    await game.settings.set(s, "globalTraits", [{ id: "tstT", name: "[TEST] Chuva forte", die: 8 }, { id: "tstU", name: "[TEST] Cantos escuros", die: 6 }]);
    ui.sidebar.expand?.(); ui.sidebar.changeTab?.("chat", "primary");
    return before;
  });

  playerBrowser = await openBrowser(env, { secondary: true });
  pp = playerBrowser.page;
  playerLog = collectConsole(pp);
  await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });
  await pp.evaluate(() => { ui.sidebar.expand?.(); ui.sidebar.changeTab?.("chat", "primary"); });
  await wait(1500);

  /* 1-2: pending card and the Choose dice window with 6 dice */
  const A = await postPending([7, 5, 6, 2, 9, 4], [8, 8, 6, 4, 10, 6]);
  await pp.evaluate(async (mid) => {
    const { openResolveDice } = await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/dialogs/resolve-dice.mjs"));
    await openResolveDice(game.messages.get(mid));
  }, A);
  await pp.waitForSelector(`#lv-resolve-${A} .lv-rd-tile`, { timeout: 10000 });
  await wait(800);
  console.log("window", JSON.stringify(await winState(A)));
  await snap(pp, card(A), "01-card-pendente");
  await snap(pp, `#lv-resolve-${A}`, "02-escolher-dados-6-dados");
  await snapPage(pp, "02b-escolher-dados-tela");
  // Choose: total = dice 0 and 4 (7 + 9), effect = die 2 (d6), then confirm.
  for (const i of [0, 4, 2]) { await pp.locator(`#lv-resolve-${A} .lv-rd-pick[data-index="${i}"]`).click({ timeout: 5000 }); await wait(400); }
  await snap(pp, `#lv-resolve-${A}`, "02c-escolher-dados-escolhido");
  await domClick(pp, `#lv-resolve-${A} [data-action="confirm"]`);
  await pp.waitForSelector(`#lv-resolve-${A}`, { state: "detached", timeout: 8000 }).catch(() => {});
  await wait(1500);
  await snap(pp, card(A), "03-card-resumido");
  await pp.evaluate((s) => document.querySelector(`${s} .lv-roll-expand`)?.click(), card(A));
  await wait(800);
  await snap(pp, card(A), "04-card-expandido");

  /* 5: heroic card with versus */
  await postFixer([6, 5, 4]);
  await wait(1200);
  const H = await postPending([9, 8, 3], [10, 8, 6]);
  await pp.evaluate(async (mid) => {
    const { openResolveDice } = await import(foundry.utils.getRoute("systems/leverage-gta/module/applications/dialogs/resolve-dice.mjs"));
    await openResolveDice(game.messages.get(mid));
  }, H);
  await pp.waitForSelector(`#lv-resolve-${H} [data-action="autoTotal"]`, { timeout: 8000 });
  await domClick(pp, `#lv-resolve-${H} [data-action="autoTotal"]`);
  await wait(400);
  await domClick(pp, `#lv-resolve-${H} [data-action="toggleVersus"]`);
  await wait(600);
  await snap(pp, `#lv-resolve-${H}`, "05a-janela-versus");
  await domClick(pp, `#lv-resolve-${H} [data-action="confirm"]`);
  await wait(2500);
  await snap(pp, card(H), "05-card-heroico-versus");

  /* 6: botch strip (three 1s) */
  const X = await postResolved([1, 1, 1], [8, 8, 8]);
  await wait(1500);
  await snap(page, card(X), "06-faixa-botch");

  /* 7: Fixer card with opportunities, seen by the player */
  const F = await postFixer([1, 6, 1, 7]);
  await wait(1500);
  await snap(pp, card(F), "07-card-fixer-oportunidades");
  await snap(page, card(F), "07b-card-fixer-oportunidades-mestre");

  /* 8: scene strip with Traits and Complications (GM) */
  await page.evaluate(() => { for (const app of foundry.applications.instances.values()) if (/resolve/.test(app.id)) app.close(); });
  await wait(500);
  await snapPage(page, "08-faixa-da-cena", { x: 0, y: 0, width: 1400, height: 260 });
  await snap(page, "#leverage-scene-panel", "08b-faixa-da-cena-recorte");

  /* 9: GM HUD with Plot Points and Mesa */
  await snap(page, "#leverage-hud", "09-hud-mestre");
  await snapPage(page, "09b-hud-mestre-tela", { x: 0, y: 0, width: 1920, height: 200 });

  /* 10: Location sheet with a Scene */
  const ids = await page.evaluate(async () => {
    const scene = await Scene.create({ name: "[TEST] Armazém do porto" });
    const loc = await Actor.create({ name: "[TEST] Armazém do Porto Velho", type: "location", system: { scene: scene.uuid, traits: [{ name: "[TEST] Passarelas enferrujadas", die: 8 }, { name: "[TEST] Caixotes empilhados", die: 6 }] } });
    await loc.sheet.render(true);
    await lvTestJob.set({ name: "[TEST] O Cofre do Moretti", goal: "Pegar o livro-caixa do cofre do segundo andar" });
    return { loc: loc.id, scene: scene.id };
  });
  await page.waitForSelector(".location-sheet, .application[class*='location']", { timeout: 10000 });
  await wait(1500);
  await snapPage(page, "10-ficha-do-lugar-com-cena");
  await page.evaluate((id) => game.actors.get(id).sheet.close(), ids.loc);

  /* 11: world Job sheet */
  await page.evaluate(async () => {
    const job = game.items.find((i) => i.type === "job" && !i.parent && i.name === "[TEST] O Cofre do Moretti");
    await job.sheet.render(true);
  });
  await wait(1800);
  await snapPage(page, "11-ficha-do-job-de-mundo");
  await page.evaluate(() => game.items.find((i) => i.type === "job" && !i.parent && i.name === "[TEST] O Cofre do Moretti")?.sheet.close());

  /* 12: Tracker */
  await page.locator('[data-tool="tracker"]').first().click({ timeout: 8000 }).catch(() => {});
  await page.waitForSelector(".lv-trk", { timeout: 8000 }).catch(() => {});
  await wait(1000);
  await snapPage(page, "12-rastreador");
  await snap(page, ".lv-trk", "12b-rastreador-janela");
} catch (err) {
  console.log(`ERROR ${err.message.split("\n").slice(0, 3).join(" | ")}`);
  problems.push("script error");
  await page.screenshot({ path: out("failure-gm") }).catch(() => {});
  await pp?.screenshot({ path: out("failure-player") }).catch(() => {});
} finally {
  await playerBrowser?.browser.close().catch(() => {});
  await page.evaluate(async (before) => {
    const s = "leverage-gta";
    const mine = (n) => typeof n === "string" && n.startsWith("[TEST]");
    const msgs = game.messages.filter((m) => {
      const r = m.getFlag(s, "roll");
      return r && (mine(r.actorName) || r.flavor === "Guardas do armazém" || mine(r.flavor));
    }).map((m) => m.id);
    if (msgs.length) await ChatMessage.deleteDocuments(msgs);
    for (const a of game.actors.filter((x) => mine(x.name))) { await a.sheet?.close(); await a.delete(); }
    await Scene.deleteDocuments(game.scenes.filter((x) => mine(x.name)).map((x) => x.id));
    if (before) {
      await lvTestJob.restore(before.job);
      await game.settings.set(s, "rules.rollMode", before.mode);
      await game.settings.set(s, "complications", before.list);
      await game.settings.set(s, "globalTraits", before.traits);
      await game.settings.set(s, "scenePanel.collapsed", before.collapsed);
    }
    await game.users.getName("[TEST] Player")?.delete();
  }, saved).catch((e) => console.log("cleanup failed", e.message.split("\n")[0]));
  console.log(`CONSOLE own: ${log.own().length ? log.own().join(" | ").slice(0, 600) : "clean"}; player own: ${playerLog?.own().length ? playerLog.own().join(" | ").slice(0, 600) : "clean"}`);
  console.log(`PROBLEMS: ${problems.length ? problems.join(", ") : "none"}`);
  await browser.close();
  process.exit(problems.length ? 1 : 0);
}
