/**
 * F3 visual states of the crew sheet (mockups sheet-background-tab / sheet-jobs-tab / sheet-unlocked-gm-allows-edits).
 * Builds `[TEST] Rosa Delgado`, saves 1920x1080 screenshots and deletes every `[TEST]` actor at the end.
 * Exit codes: 0 ok, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
const wait = (ms) => page.waitForTimeout(ms);
const sheet = ".application.crew-sheet";
/** Saves the sheet window only (1180x950), the same frame as the mockup PNGs. */
const shot = (name) => page.locator(sheet).screenshot({ path: `${SHOTS}/F3-${name}.png` });

async function build() {
  const job = (name, share, extra = {}) => ({ name, type: "job", system: { payout: { total: share * 2, share }, ...extra } });
  const dist = (name, note) => ({ name, type: "distinction", system: { note } });
  const actor = await Actor.create({
    name: "[TEST] Rosa Delgado", type: "crew",
    system: {
      alias: "La Zorra", life: { value: 14 }, vest: { kind: "standard", value: 4 }, plotPoints: { value: 2 },
      attributes: { agility: { die: 10 }, alertness: { die: 8 }, intelligence: { die: 6 }, strength: { die: 6 }, vitality: { die: 8 }, willpower: { die: 10 } },
      roles: { grifter: { die: 8 }, hacker: { die: 8 }, hitter: { die: 6 }, mastermind: { die: 4 }, thief: { die: 10 } },
      booking: { number: "0471-RD", height: "5'6\"", weight: "128 lb", age: "31", eyes: "Brown", hair: "Black", build: "Wiry", marks: "Fox tattoo, left wrist. Chipped front tooth." },
      background: "<p><b>RAISED:</b> Dock Row, port district. Father, longshoreman. Mother ran the corner bakery.</p><p><b>SCHOOLING:</b> School of Hard Knocks. Two semesters of night classes.</p><p><b>PRIORS:</b> 14 counts petty theft. 2 counts grand theft. Wanted in three states.</p>"
    }
  });
  const items = [
    dist("Old Docks Loyalty", "Helps when calling in favors from the old neighborhood. Hurts when the plan means betraying a friend."),
    dist("Adrenaline Junkie", "Helps on any dangerous stunt. Hurts when the plan calls for patience."),
    dist("Wanted in Three States", "Helps with street cred. Hurts every time a cop looks twice."),
    { name: "Ghost in the Hallway", type: "talent", system: { role: "thief", cost: 0, activation: "You sneak past a Supporting Character who has not noticed you." } },
    { name: "Wheelman's Nerve", type: "talent", system: { role: "open", cost: 1, activation: "You are behind the wheel during a chase. Spend a Plot Point." } },
    { name: "Soft Hands", type: "talent", system: { role: "thief", cost: 0, activation: "You lift something small from someone within arm's reach." } },
    { name: "Safecracking", type: "specialty", system: { role: "thief" } },
    { name: "Getaway Driving", type: "specialty", system: { role: "hitter" } },
    { name: "Pickpocketing", type: "specialty", system: { role: "thief" } },
    { name: "Borrowed Hatchback", type: "asset", system: { duration: "signature", die: 8, note: "Rusty, loud, and it never stalls." } },
    { name: "Lockpick Roll", type: "asset", system: { duration: "signature", die: 6, note: "Her father's old set, leather case." } },
    { name: "Fake Inspector Badge", type: "asset", system: { duration: "job", die: 6, note: "Good for one walk through the front door." } },
    { name: "Crowbar", type: "asset", system: { duration: "scene", die: 6, note: "Picked up behind the loading dock." } },
    { name: "Unlocked Service Door", type: "asset", system: { duration: "scene", die: 6, note: "The night guard propped it open for his smoke break." } },
    job("The Dockside Job", 2, { callbackUsed: true }),
    job("The Charity Gala Job", 3),
    job("The Tow-Truck Job", 1, { spent: true }),
    job("The Museum Night Job", 2, { spent: true }),
    job("The Pawnshop Job", 1),
    job("The Ferry Terminal Job", 2),
    job("The Casino Count Job", 4, { spent: true }),
    job("The Radio Tower Job", 1),
    job("The Harbor Master Job", 2)
  ];
  // Explicit sort keeps the list order stable (items created together would otherwise tie).
  await actor.createEmbeddedDocuments("Item", items.map((it, i) => ({ ...it, sort: (i + 1) * 100000 })));
  await actor.sheet.render({ force: true });
  return actor.id;
}

try { await login(page, env); } catch (err) {
  console.log(`FOUNDRY: not available - ${err.message.split("\n")[0]}`);
  await browser.close();
  process.exit(2);
}

const failures = [];
let original = true;
try {
  original = await page.evaluate(() => game.settings.get("leverage-gta", "traitsLocked"));
  await page.evaluate(() => game.settings.set("leverage-gta", "traitsLocked", true));
  await page.evaluate(build);
  await wait(1800);
  // Pool as in the mockup: Agility + Thief + Safecracking + Old Docks Loyalty (d8).
  const refs = await page.evaluate(() => {
    const a = game.actors.getName("[TEST] Rosa Delgado");
    const id = (n) => a.items.getName(n).id;
    return ["attributes.agility", "roles.thief", `item:${id("Safecracking")}`, `item:${id("Old Docks Loyalty")}:d8`];
  });
  for (const ref of refs) {
    await page.locator(`${sheet} [data-pool-ref="${ref}"]`).first().click().catch((e) => failures.push(`pool ${ref}: ${e.message.split("\n")[0]}`));
    await wait(250);
  }
  await page.evaluate(() => { ui.notifications.clear?.(); document.querySelector("#notifications")?.replaceChildren(); });
  await wait(500);
  await shot("background");

  await page.click(`${sheet} [data-action="folderTab"][data-tab="jobs"]`);
  await wait(700);
  await shot("jobs");

  await page.click(`${sheet} [data-action="folderTab"][data-tab="background"]`);
  await page.evaluate(() => game.settings.set("leverage-gta", "traitsLocked", false));
  await wait(1000);
  await shot("unlocked");
} catch (err) {
  failures.push(err.message.split("\n").slice(0, 4).join(" | "));
  await page.screenshot({ path: `${SHOTS}/F3-failure.png` }).catch(() => {});
} finally {
  await page.evaluate(async (orig) => {
    await game.settings.set("leverage-gta", "traitsLocked", orig);
    for (const a of game.actors.filter((x) => x.name.startsWith("[TEST]"))) { await a.sheet.close(); await a.delete(); }
  }, original).catch(() => {});
}
console.log(failures.length ? `FAIL ${failures.join(" ; ")}` : "PASS screenshots saved");
console.log(`CONSOLE own: ${JSON.stringify(log.own())}`);
console.log(`CONSOLE other: ${JSON.stringify(log.other().slice(0, 5))}`);
await browser.close();
process.exit(failures.length ? 1 : 0);
