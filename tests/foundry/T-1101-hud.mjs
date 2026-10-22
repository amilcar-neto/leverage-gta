/**
 * T-1101 check: the Fixer's Plot Points panel in the HUD ("Mesa" + one line per player Crew, docs/07). GM: rows, - and +,
 * minimum 0, live update from another path (including the player's own browser), pulse, 2 and 6 test players with scroll.
 * Player: no panel, own PP row unchanged. Creates `[TEST]` Crews (owned by a temporary player user) and removes them.
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
let ids = null;
let playerBrowser = null;
let playerLog = null;
let saved = null;

const panel = "#leverage-hud .lv-hud-gmpp";
const rowOf = (id) => page.locator(`${panel} li:has([data-actor-id="${id}"])`);
const valueOf = async (id) => Number((await rowOf(id).locator(".lv-hud-gmpp-value").innerText()).trim());
const tableValue = async () => Number((await page.locator(`${panel} .lv-hud-gmpp-table .lv-hud-gmpp-value`).innerText()).trim());
const actorPP = (id) => page.evaluate((i) => game.actors.get(i).system.plotPoints.value, id);
const tablePP = () => page.evaluate((s) => game.settings.get(s, "tablePlotPoints"), S);

try {
  await login(page, env);
  saved = await page.evaluate((s) => ({ table: game.settings.get(s, "tablePlotPoints"), show: game.settings.get(s, "hud.showPlotPoints") }), S);
  ids = await page.evaluate(async (s) => {
    await game.settings.set(s, "hud.showPlotPoints", true);
    await game.settings.set(s, "tablePlotPoints", 0);
    let user = game.users.find((u) => u.name === "[TEST] Player");
    const created = !user;
    user ??= await foundry.documents.User.create({ name: "[TEST] Player", role: CONST.USER_ROLES.PLAYER });
    const names = ["[TEST] HUD Alpha", "[TEST] HUD Beta with an extremely long character name to force ellipsis"];
    const crews = [];
    for (const name of names) crews.push(await Actor.create({ name, type: "crew", ownership: { default: 0, [user.id]: 3 }, system: { plotPoints: { value: 1 } } }));
    await user.update({ character: crews[0].id });
    canvas.tokens?.releaseAll();
    return { user: user.id, created, crews: crews.map((c) => c.id), extra: [] };
  }, S);
  playerBrowser = await openBrowser(env, { secondary: true });
  const pp = playerBrowser.page;
  playerLog = collectConsole(pp);
  await login(pp, { ...env, FOUNDRY_USER: "[TEST] Player", FOUNDRY_PASSWORD: "" });
  await page.waitForSelector(panel, { timeout: 10000 });
  await wait(1000);
  const [a, b] = ids.crews;

  // ---- Structure
  record("new Crews appear in the panel without any other refresh (no createActor hook?)", (await rowOf(a).count()) === 1 && (await rowOf(b).count()) === 1, "rows missing until another update");
  await page.evaluate(async ([x, y]) => { for (const id of [x, y]) await game.actors.get(id).setFlag("leverage-gta", "tmpTouch", 1); }, [a, b]);
  await wait(800);
  record("GM panel is there", (await page.locator(panel).count()) === 1);
  record("Mesa row present", (await page.locator(`${panel} .lv-hud-gmpp-table`).count()) === 1);
  record("a row for each [TEST] player Crew", (await rowOf(a).count()) === 1 && (await rowOf(b).count()) === 1);
  record("rows show the starting 1 PP", (await valueOf(a)) === 1 && (await valueOf(b)) === 1);
  await page.screenshot({ path: `${SHOTS}/F10-hud-gm-2players.png` });
  await page.screenshot({ path: `${SHOTS}/F10-hud-gm-2players-crop.png`, clip: { x: 1500, y: 0, width: 420, height: 420 } });

  // ---- Player buttons
  await rowOf(a).locator('[data-delta="1"]').click();
  await page.waitForFunction(([id]) => game.actors.get(id).system.plotPoints.value === 2, [a], { timeout: 5000 });
  record("+ raises the player's system.plotPoints", (await actorPP(a)) === 2, await actorPP(a));
  await wait(500);
  record("row shows 2 after +", (await valueOf(a)) === 2, await valueOf(a));
  await rowOf(a).locator('[data-delta="-1"]').click();
  await rowOf(a).locator('[data-delta="-1"]').click();
  await page.waitForFunction(([id]) => game.actors.get(id).system.plotPoints.value === 0, [a], { timeout: 5000 });
  await wait(500);
  record("- lowers to 0", (await actorPP(a)) === 0 && (await valueOf(a)) === 0);
  record("- is disabled at 0", await rowOf(a).locator('[data-delta="-1"]').isDisabled());
  await rowOf(a).locator('[data-delta="-1"]').click({ force: true }).catch(() => {});
  await wait(600);
  record("- at 0 stays 0 (minimum)", (await actorPP(a)) === 0, await actorPP(a));
  await page.screenshot({ path: `${SHOTS}/F10-hud-gm-minus-at-zero.png`, clip: { x: 1500, y: 0, width: 420, height: 420 } });

  // ---- Mesa
  record("Mesa - disabled at 0", await page.locator(`${panel} .lv-hud-gmpp-table [data-delta="-1"]`).isDisabled());
  await page.locator(`${panel} [data-action="stepTablePoints"][data-delta="1"]`).click();
  await page.locator(`${panel} [data-action="stepTablePoints"][data-delta="1"]`).click();
  await page.waitForFunction((s) => game.settings.get(s, "tablePlotPoints") === 2, S, { timeout: 5000 });
  await wait(500);
  record("Mesa + twice sets tablePlotPoints 2", (await tablePP()) === 2 && (await tableValue()) === 2, { setting: await tablePP(), ui: await tableValue() });
  await page.locator(`${panel} [data-action="stepTablePoints"][data-delta="-1"]`).click();
  await page.waitForFunction((s) => game.settings.get(s, "tablePlotPoints") === 1, S, { timeout: 5000 });
  await wait(500);
  record("Mesa - lowers to 1", (await tableValue()) === 1);
  await page.locator(`${panel} [data-action="stepTablePoints"][data-delta="-1"]`).click();
  await wait(600);
  record("Mesa reaches 0 and - disables", (await tablePP()) === 0 && (await page.locator(`${panel} .lv-hud-gmpp-table [data-delta="-1"]`).isDisabled()));

  // ---- Live update by other paths (GM API, then the player's own client)
  await page.evaluate(([id]) => game.actors.get(id).update({ "system.plotPoints.value": 3 }), [b]);
  await page.waitForFunction(([sel]) => document.querySelector(sel)?.textContent.trim() === "3", [`${panel} li:has([data-actor-id="${b}"]) .lv-hud-gmpp-value`], { timeout: 5000 }).catch(() => {});
  record("GM client updates live on actor.update", (await valueOf(b)) === 3, await valueOf(b));
  record("changed value carries the pulse class", await rowOf(b).locator(".lv-hud-gmpp-value.is-pulse").count() === 1);
  await pp.evaluate(([id]) => game.actors.get(id).update({ "system.plotPoints.value": 5 }), [b]);
  await page.waitForFunction(([sel]) => document.querySelector(sel)?.textContent.trim() === "5", [`${panel} li:has([data-actor-id="${b}"]) .lv-hud-gmpp-value`], { timeout: 6000 }).catch(() => {});
  record("GM client updates live when the player changes PP", (await valueOf(b)) === 5, await valueOf(b));
  await page.evaluate((s) => game.settings.set(s, "tablePlotPoints", 4), S);
  await wait(700);
  record("Mesa updates live when the setting changes", (await tableValue()) === 4, await tableValue());
  await page.evaluate((s) => game.settings.set(s, "tablePlotPoints", 0), S);

  // ---- Names / ellipsis
  const nameInfo = await page.evaluate((id) => {
    const el = document.querySelector(`#leverage-hud .lv-hud-gmpp li:has([data-actor-id="${id}"]) .lv-hud-panel-name`);
    const cs = getComputedStyle(el);
    return { overflow: cs.textOverflow, ws: cs.whiteSpace, clipped: el.scrollWidth > el.clientWidth, text: el.textContent };
  }, b);
  record("long name is clipped with an ellipsis (CSS)", nameInfo.overflow === "ellipsis" && nameInfo.ws === "nowrap", nameInfo);

  // ---- Player client
  await pp.waitForSelector("#leverage-hud", { timeout: 10000 });
  await pp.waitForTimeout(800);
  record("player has no Plot Points panel", (await pp.locator("#leverage-hud .lv-hud-gmpp").count()) === 0);
  record("player keeps the own PP row", (await pp.locator("#leverage-hud .lv-hud-pp").count()) === 1);
  record("player own PP value correct", (await pp.locator("#leverage-hud .lv-hud-pp-value").innerText()).trim() === "0", await pp.locator("#leverage-hud .lv-hud-pp-value").innerText());
  await pp.screenshot({ path: `${SHOTS}/F10-hud-player.png` });

  // ---- HUD does not swallow clicks over the canvas
  const cover = await page.evaluate(() => {
    const hud = document.querySelector("#leverage-hud");
    const r = hud.getBoundingClientRect();
    const probes = [[r.left + 4, r.bottom - 4], [r.left + 4, r.top + r.height / 2], [r.right - 4, r.bottom - 4]];
    return { rect: { x: r.x, y: r.y, w: r.width, h: r.height }, hits: probes.map(([x, y]) => document.elementFromPoint(x, y)?.closest("#leverage-hud") ? "hud" : (document.elementFromPoint(x, y)?.id || document.elementFromPoint(x, y)?.tagName)) };
  });
  record("empty HUD area lets clicks through to the scene", cover.hits.every((h) => h !== "hud"), cover);

  // ---- Toggle setting
  await page.evaluate((s) => game.settings.set(s, "hud.showPlotPoints", false), S);
  await wait(800);
  record("hud.showPlotPoints off hides the panel", (await page.locator(panel).count()) === 0);
  await page.evaluate((s) => game.settings.set(s, "hud.showPlotPoints", true), S);
  await page.waitForSelector(panel, { timeout: 5000 });

  // ---- Six test players
  const more = await page.evaluate(async ([user]) => {
    const out = [];
    for (let i = 3; i <= 6; i++) out.push((await Actor.create({ name: `[TEST] HUD Player ${i}`, type: "crew", ownership: { default: 0, [user]: 3 }, system: { plotPoints: { value: i } } })).id);
    return out;
  }, [ids.user]);
  ids.extra = more;
  await wait(800);
  record("4 more Crews appear without another refresh", (await page.locator(panel + " li").count()) >= 6, await page.locator(panel + " li").count());
  await page.evaluate(async (list) => { for (const id of list) await game.actors.get(id).setFlag("leverage-gta", "tmpTouch", 1); }, more);
  await wait(1000);
  const six = await page.evaluate(() => {
    const list = document.querySelector("#leverage-hud .lv-hud-gmpp .lv-hud-panel-list");
    const rows = [...list.querySelectorAll("li")];
    const hud = document.querySelector("#leverage-hud").getBoundingClientRect();
    const pnl = document.querySelector("#leverage-hud .lv-hud-gmpp").getBoundingClientRect();
    return { rows: rows.length, scrolls: list.scrollHeight > list.clientHeight, listH: list.clientHeight, scrollH: list.scrollHeight, overflowY: getComputedStyle(list).overflowY, gutter: getComputedStyle(list).scrollbarGutter, pnlBottom: pnl.bottom, win: innerHeight, hudBottom: hud.bottom };
  });
  record("6 [TEST] players: list has 6+ rows and scrolls", six.rows >= 6 && six.scrolls, six);
  record("panel stays inside the window", six.pnlBottom < six.win, six);
  await page.screenshot({ path: `${SHOTS}/F10-hud-gm-6players.png` });
  await page.screenshot({ path: `${SHOTS}/F10-hud-gm-6players-crop.png`, clip: { x: 1500, y: 0, width: 420, height: 420 } });
  await page.evaluate(() => { const l = document.querySelector("#leverage-hud .lv-hud-gmpp .lv-hud-panel-list"); l.scrollTop = l.scrollHeight; });
  await wait(300);
  await page.screenshot({ path: `${SHOTS}/F10-hud-gm-6players-scrolled.png`, clip: { x: 1500, y: 0, width: 420, height: 420 } });
  const lastId = more[more.length - 1];
  const lastBtn = rowOf(lastId).locator('[data-delta="1"]');
  const btnBox = await lastBtn.boundingBox();
  const listBox = await page.locator(`${panel} .lv-hud-panel-list`).boundingBox();
  const sb = await page.evaluate(() => { const l = document.querySelector("#leverage-hud .lv-hud-gmpp .lv-hud-panel-list"); return l.offsetWidth - l.clientWidth; });
  record("scrollbar does not sit on top of the + buttons", btnBox && listBox && btnBox.x + btnBox.width <= listBox.x + listBox.width - sb + 0.5, { btnBox, listBox, scrollbar: sb });
  await lastBtn.click();
  await page.waitForFunction(([id]) => game.actors.get(id).system.plotPoints.value === 7, [lastId], { timeout: 5000 });
  record("+ works on the last (scrolled) row", true);
} catch (error) {
  record("script", false, String(error?.stack ?? error));
} finally {
  try {
    await page.evaluate(async ([i, s, before]) => {
      for (const id of [...(i?.crews ?? []), ...(i?.extra ?? [])]) await game.actors.get(id)?.delete();
      if (i?.created) await game.users.get(i.user)?.delete();
      if (before) { await game.settings.set(s, "tablePlotPoints", before.table); await game.settings.set(s, "hud.showPlotPoints", before.show); }
    }, [ids, S, saved]);
  } catch (e) { record("cleanup", false, String(e)); }
  await playerBrowser?.browser.close();
  await browser.close();
}
const own = [...log.own(), ...(playerLog?.own() ?? [])];
const other = [...log.other(), ...(playerLog?.other() ?? [])];
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}${r.detail ? ` ${r.detail}` : ""}`);
console.log(`console errors (system): ${own.length}`);
own.forEach((e) => console.log(`  ${e.slice(0, 400)}`));
console.log(`console errors (other): ${other.length}`);
other.slice(0, 8).forEach((e) => console.log(`  ${e.slice(0, 200)}`));
process.exit(results.every((r) => r.ok) ? 0 : 1);
