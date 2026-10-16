/**
 * Phase 1 check against the real Foundry: data models, derived values, rules enforced in documents,
 * settings and GM config menus. Creates only `[TEST]` documents and deletes them at the end.
 * Exit codes: 0 pass, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const results = [];
const shot = (name) => page.screenshot({ path: `${SHOTS}/F1-${name}.png` });

/** Runs `fn` in the page; records pass/fail with the exact error. */
async function check(name, fn, arg) {
  try {
    const out = await page.evaluate(fn, arg);
    const ok = out === true || out?.ok === true;
    results.push({ name, ok, detail: ok ? "" : JSON.stringify(out) });
  } catch (err) {
    results.push({ name, ok: false, detail: err.message.split("\n").slice(0, 6).join(" | ") });
  }
}

try {
  await login(page, env);
} catch (err) {
  await page.screenshot({ path: `${SHOTS}/F1-login-failure.png` }).catch(() => {});
  console.log(`FOUNDRY: not available - ${err.message.split("\n")[0]}`);
  await browser.close();
  process.exit(2);
}

try {
  await check("system exposes the expected document types", () => {
    const want = { Actor: ["crew", "npc", "location"], Item: ["distinction", "talent", "specialty", "asset", "job"] };
    const ok = want.Actor.every((t) => game.documentTypes.Actor.includes(t))
      && want.Item.every((t) => game.documentTypes.Item.includes(t));
    return { ok, actor: game.documentTypes.Actor, item: game.documentTypes.Item };
  });

  await check("create [TEST] actors (crew, npc, location)", async () => {
    await Actor.create([
      { name: "[TEST] Crew", type: "crew" },
      { name: "[TEST] NPC", type: "npc" },
      { name: "[TEST] Location", type: "location" }
    ]);
    const types = game.actors.filter((a) => a.name.startsWith("[TEST]")).map((a) => a.type).sort();
    return { ok: types.join() === "crew,location,npc", types };
  });

  await check("Life max = lifeBase + Vitality die; life.value clamped", async () => {
    const crew = game.actors.getName("[TEST] Crew");
    const out = [];
    for (const die of [4, 8, 12]) {
      await crew.update({ "system.attributes.vitality.die": die });
      out.push({ die, max: crew.system.life.max, want: CONFIG.LEVERAGE.lifeBase + die });
    }
    await crew.update({ "system.attributes.vitality.die": 6, "system.life.value": 99 });
    const clamped = crew.system.life.value === crew.system.life.max;
    return { ok: out.every((o) => o.max === o.want) && clamped, out, value: crew.system.life.value, max: crew.system.life.max };
  });

  await check("Roles primary/secondary (and tie by fixed order)", async () => {
    const crew = game.actors.getName("[TEST] Crew");
    await crew.update({ "system.roles.hitter.die": 10, "system.roles.thief.die": 8, "system.roles.grifter.die": 6 });
    const r = crew.system.roles;
    const first = r.hitter.primary && r.thief.secondary && !r.grifter.primary && !r.grifter.secondary && !r.hacker.primary;
    await crew.update({ "system.roles.thief.die": 10 });
    const order = Object.keys(CONFIG.LEVERAGE.roles);
    const winner = order.indexOf("hitter") < order.indexOf("thief") ? "hitter" : "thief";
    const loser = winner === "hitter" ? "thief" : "hitter";
    const tie = crew.system.roles[winner].primary && crew.system.roles[loser].secondary;
    await crew.update({ "system.roles": { hitter: { die: null }, thief: { die: null }, grifter: { die: null } } });
    const none = Object.values(crew.system.roles).every((x) => !x.primary && !x.secondary);
    return { ok: Boolean(first && tie && none), first, tie, none };
  });

  await check("money.dice derived from steps", async () => {
    const crew = game.actors.getName("[TEST] Crew");
    const table = { 0: [], 1: [4], 2: [6], 3: [8], 4: [10], 5: [12], 7: [6, 12], 10: [12, 12], 25: [12, 12, 12, 12, 12] };
    const bad = [];
    for (const [steps, want] of Object.entries(table)) {
      await crew.update({ "system.money.steps": Number(steps) });
      const got = [...crew.system.money.dice];
      if (JSON.stringify(got) !== JSON.stringify(want)) bad.push({ steps, got, want });
    }
    await crew.update({ "system.money.steps": 7 });
    const helper = JSON.stringify(crew.money.dice) === "[6,12]" && crew.money.canAfford(7) && !crew.money.canAfford(8);
    return { ok: !bad.length && helper, bad, helper };
  });

  await check("getRollData exposes attributes, roles, life, money", () => {
    const crew = game.actors.getName("[TEST] Crew");
    const d = crew.getRollData();
    const ok = d.attributes?.vitality?.die === 6 && "roles" in d && d.life?.max === crew.system.life.max
      && JSON.stringify(d.money?.dice) === "[6,12]" && d.plotPoints?.value >= 0;
    return { ok, keys: Object.keys(d) };
  });

  await check("npc and location data load", () => {
    const npc = game.actors.getName("[TEST] NPC");
    const loc = game.actors.getName("[TEST] Location");
    return { ok: Boolean(npc.system && loc.system), npc: Object.keys(npc.system), loc: Object.keys(loc.system) };
  });

  await check("create items (distinction/talent/specialty/asset/job) on the crew", async () => {
    const crew = game.actors.getName("[TEST] Crew");
    await crew.createEmbeddedDocuments("Item", [
      { name: "[TEST] Distinction 1", type: "distinction" },
      { name: "[TEST] Talent", type: "talent" },
      { name: "[TEST] Specialty", type: "specialty" },
      { name: "[TEST] Asset", type: "asset" },
      { name: "[TEST] Job", type: "job" }
    ]);
    const types = crew.items.map((i) => i.type).sort();
    return { ok: types.join() === "asset,distinction,job,specialty,talent", types };
  });

  await check("standalone world items of every type", async () => {
    await Item.create(["distinction", "talent", "specialty", "asset", "job"].map((type) => ({ name: `[TEST] World ${type}`, type })));
    return { ok: game.items.filter((i) => i.name.startsWith("[TEST] World")).length === 5 };
  });

  // ---- Distinction cap and Trait lock: enforced for non-GM users, so act as a second ([TEST]) Player in another browser.
  await check("GM bypasses the Distinction cap and the lock (by design)", async () => {
    const crew = game.actors.getName("[TEST] Crew");
    const before = crew.items.filter((i) => i.type === "distinction").length;
    await crew.createEmbeddedDocuments("Item", [{ name: "[TEST] Distinction GM", type: "distinction" }]);
    const after = crew.items.filter((i) => i.type === "distinction").length;
    await crew.items.getName("[TEST] Distinction GM")?.delete();
    return { ok: after === before + 1, before, after };
  });

  await page.evaluate(async () => {
    const player = await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    const crew = game.actors.getName("[TEST] Crew");
    await crew.update({ ownership: { [player.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER } });
    // clean slate: remove Distinctions created earlier; traits unlocked for the first part
    await crew.deleteEmbeddedDocuments("Item", crew.items.filter((i) => i.type === "distinction").map((i) => i.id));
    await game.settings.set("leverage-gta", "traitsLocked", false);
  });
  const playerBrowser = await openBrowser(env);
  const pp = playerBrowser.page;
  const playerLog = collectConsole(pp);
  const checkPlayer = async (name, fn, arg) => {
    try {
      const out = await pp.evaluate(fn, arg);
      results.push({ name, ok: out?.ok === true, detail: out?.ok === true ? "" : JSON.stringify(out) });
    } catch (err) {
      results.push({ name, ok: false, detail: err.message.split("\n").slice(0, 6).join(" | ") });
    }
  };
  let playerReady = false;
  try {
    await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });
    playerReady = true;
  } catch (err) {
    results.push({ name: "log in as [TEST] Player (second browser)", ok: false, detail: err.message.split("\n")[0] });
  }
  if (playerReady) {
    await pp.evaluate(() => {
      window.__warns = [];
      const o = ui.notifications.warn;
      ui.notifications.warn = (...a) => { window.__warns.push(String(a[0])); return o.apply(ui.notifications, a); };
    });

    await checkPlayer("player: batch of 3 Distinctions is allowed (unlocked)", async () => {
      const crew = game.actors.getName("[TEST] Crew");
      await crew.createEmbeddedDocuments("Item", ["1", "2", "3"].map((n) => ({ name: `[TEST] D${n}`, type: "distinction" })));
      const n = crew.items.filter((i) => i.type === "distinction").length;
      return { ok: n === 3 && window.__warns.length === 0, n, warns: window.__warns };
    });
    await checkPlayer("player: 4th Distinction (single) is refused with one warning, no exception", async () => {
      const crew = game.actors.getName("[TEST] Crew");
      window.__warns.length = 0;
      let threw = null;
      let res;
      try { res = await crew.createEmbeddedDocuments("Item", [{ name: "[TEST] D4", type: "distinction" }]); } catch (e) { threw = String(e); }
      const n = crew.items.filter((i) => i.type === "distinction").length;
      return { ok: !threw && n === 3 && window.__warns.length === 1 && !window.__warns[0].startsWith("LEVERAGE."), threw, n, created: res?.length, warns: window.__warns };
    });
    await checkPlayer("player: batch that would exceed the cap is refused as a whole", async () => {
      const crew = game.actors.getName("[TEST] Crew");
      await crew.items.getName("[TEST] D3").delete();
      window.__warns.length = 0;
      let threw = null;
      try {
        await crew.createEmbeddedDocuments("Item", [{ name: "[TEST] D5", type: "distinction" }, { name: "[TEST] D6", type: "distinction" }]);
      } catch (e) { threw = String(e); }
      const n = crew.items.filter((i) => i.type === "distinction").length;
      return { ok: !threw && n === 2 && window.__warns.length === 1, threw, n, warns: window.__warns };
    });
    await pp.screenshot({ path: `${SHOTS}/F1-player-cap.png` });

    await page.evaluate(() => game.settings.set("leverage-gta", "traitsLocked", true));
    await pp.waitForFunction(() => game.settings.get("leverage-gta", "traitsLocked") === true, null, { timeout: 10000 }).catch(() => {});
    await checkPlayer("player: lock on - cannot edit Attribute dice (one warning, value unchanged)", async () => {
      const crew = game.actors.getName("[TEST] Crew");
      window.__warns.length = 0;
      const before = crew.system.attributes.agility.die;
      let threw = null;
      try { await crew.update({ "system.attributes.agility.die": before === 12 ? 8 : 12 }); } catch (e) { threw = String(e); }
      return { ok: !threw && crew.system.attributes.agility.die === before && window.__warns.length === 1, threw, warns: window.__warns };
    });
    await checkPlayer("player: lock on - Traits cannot be created/edited/deleted, Assets and Plot Points stay free", async () => {
      const crew = game.actors.getName("[TEST] Crew");
      const out = {};
      window.__warns.length = 0;
      await crew.createEmbeddedDocuments("Item", [{ name: "[TEST] T-locked", type: "talent" }]);
      out.talentCreated = Boolean(crew.items.getName("[TEST] T-locked"));
      const spec = crew.items.find((i) => i.type === "specialty");
      if (spec) { await spec.update({ name: "[TEST] Specialty renamed" }); out.specRenamed = spec.name === "[TEST] Specialty renamed"; }
      const dist = crew.items.find((i) => i.type === "distinction");
      await dist.delete();
      out.distDeleted = !crew.items.get(dist.id);
      out.warnsAfterTraits = window.__warns.length;
      window.__warns.length = 0;
      await crew.createEmbeddedDocuments("Item", [{ name: "[TEST] Asset-free", type: "asset" }]);
      out.assetCreated = Boolean(crew.items.getName("[TEST] Asset-free"));
      await crew.update({ "system.plotPoints.value": 3 });
      out.ppUpdated = crew.system.plotPoints.value === 3;
      out.warnsAfterFree = window.__warns.length;
      return {
        ok: !out.talentCreated && !out.specRenamed && !out.distDeleted && out.warnsAfterTraits >= 2
          && out.assetCreated && out.ppUpdated && out.warnsAfterFree === 0,
        ...out
      };
    });
    await pp.screenshot({ path: `${SHOTS}/F1-player-locked.png` });

    await page.evaluate(() => game.settings.set("leverage-gta", "traitsLocked", false));
    await pp.waitForFunction(() => game.settings.get("leverage-gta", "traitsLocked") === false, null, { timeout: 10000 }).catch(() => {});
    await checkPlayer("player: lock off - Attribute edit allowed again", async () => {
      const crew = game.actors.getName("[TEST] Crew");
      await crew.update({ "system.attributes.agility.die": 10 });
      return { ok: crew.system.attributes.agility.die === 10 };
    });
    log.errors.push(...playerLog.own());
  }
  await playerBrowser.browser.close();
  await page.evaluate(async () => {
    await game.users.getName("[TEST] Player")?.delete();
    await game.settings.set("leverage-gta", "traitsLocked", true);
  });

  await check("settings: main keys readable with expected types/defaults", () => {
    const want = {
      "houseRules.stars": "boolean", "houseRules.life": "boolean", "houseRules.money": "boolean",
      lifeBase: "number", moneyStart: "number", jobStartPlotPoints: "number", traitsLocked: "boolean",
      wanted: "object", cityScales: "array", prices: "array", trainingCosts: "object", activeJob: "object",
      "hud.showStars": "boolean", "hud.showMoney": "boolean", "hud.showPlotPoints": "boolean",
      "hud.minimized": "boolean", "pool.keepAfterRoll": "boolean", debug: "boolean", systemMigrationVersion: "string"
    };
    const bad = [];
    const values = {};
    for (const [key, type] of Object.entries(want)) {
      try {
        const v = game.settings.get("leverage-gta", key);
        values[key] = typeof v === "object" ? "<obj>" : v;
        const t = Array.isArray(v) ? "array" : typeof v;
        if (t !== type) bad.push(`${key}: ${t} != ${type}`);
      } catch (e) { bad.push(`${key}: ${e.message}`); }
    }
    const L = CONFIG.LEVERAGE;
    const d = (k) => game.settings.settings.get(`leverage-gta.${k}`)?.default;
    if (d("lifeBase") !== L.lifeBase) bad.push("lifeBase default");
    if (d("moneyStart") !== L.money.startSteps) bad.push("moneyStart default");
    if (d("jobStartPlotPoints") !== L.jobStartPlotPoints) bad.push("jobStartPlotPoints default");
    const wanted = game.settings.get("leverage-gta", "wanted");
    if (typeof wanted.level !== "number" || !wanted.city) bad.push("wanted shape");
    return { ok: !bad.length, bad, values };
  });

  // Settings window: screenshot on the system tab, check the 3 menu buttons exist.
  await check("settings window opens and shows the 3 menu buttons", async () => {
    await game.settings.sheet.render({ force: true });
    await new Promise((r) => setTimeout(r, 1500));
    const buttons = [...document.querySelectorAll('button[data-key^="leverage-gta."]')].map((b) => b.dataset.key);
    return { ok: ["cityScalesMenu", "pricesMenu", "trainingCostsMenu"].every((k) => buttons.includes(`leverage-gta.${k}`)), buttons };
  });
  const tab = page.locator('[data-action="tab"][data-tab="system"], nav [data-tab="system"]').first();
  if (await tab.isVisible().catch(() => false)) await tab.click().catch(() => {});
  await page.waitForTimeout(500);
  await shot("settings");

  for (const key of ["cityScalesMenu", "pricesMenu", "trainingCostsMenu"]) {
    // Real click path: the menu button in the settings window.
    await check(`menu ${key}: click opens`, async (k) => {
      const btn = document.querySelector(`button[data-key="leverage-gta.${k}"]`);
      if (!btn) return { ok: false, reason: "button not found" };
      btn.click();
      await new Promise((r) => setTimeout(r, 1000));
      const Menu = game.settings.menus.get(`leverage-gta.${k}`).type;
      const app = [...foundry.applications.instances.values()].find((a) => a instanceof Menu);
      return { ok: Boolean(app?.element?.isConnected) };
    }, key);
    await shot(`menu-${key}`);
    await check(`menu ${key}: closes`, async (k) => {
      const Menu = game.settings.menus.get(`leverage-gta.${k}`).type;
      const app = [...foundry.applications.instances.values()].find((a) => a instanceof Menu);
      await app.close();
      return { ok: ![...foundry.applications.instances.values()].some((a) => a instanceof Menu) };
    }, key);
  }
  await page.evaluate(() => game.settings.sheet.close());
} finally {
  await check("cleanup [TEST] documents", async () => {
    await Promise.all(game.users.filter((u) => u.name.startsWith("[TEST]")).map((u) => u.delete()));
    await Actor.deleteDocuments(game.actors.filter((a) => a.name.startsWith("[TEST]")).map((a) => a.id));
    await Item.deleteDocuments(game.items.filter((i) => i.name.startsWith("[TEST]")).map((i) => i.id));
    const left = game.actors.filter((a) => a.name.startsWith("[TEST]")).length
      + game.items.filter((i) => i.name.startsWith("[TEST]")).length;
    return { ok: left === 0, left };
  });
}

await shot("final");
const own = log.own();
const ownWarn = log.warnings.filter((t) => /leverage/i.test(t));
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `\n      ${r.detail}` : ""}`);
console.log(`CONSOLE (system errors): ${own.length ? own.join("\n") : "clean"}`);
if (ownWarn.length) console.log(`CONSOLE (system warnings): ${ownWarn.join("\n")}`);
console.log(`CONSOLE (other sources): ${log.other().length} errors, ${log.warnings.length - ownWarn.length} warnings`);
const failed = results.filter((r) => !r.ok).length;
console.log(`FOUNDRY: ${failed || own.length ? "fail" : "pass"} (${results.length - failed}/${results.length} checks)`);
await browser.close();
process.exit(failed || own.length ? 1 : 0);
