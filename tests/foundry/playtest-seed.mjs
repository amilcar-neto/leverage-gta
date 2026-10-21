/**
 * Playtest seed: creates (idempotent) two Player users with complete Crew sheets, a Location, enemy NPCs, an active
 * Job with Complications and Scene Traits, stars and Plot Points. Data stays in the world on purpose (no [TEST] prefix).
 * Exit codes: 0 ok, 1 fail, 2 not available.
 */
import { requireEnv, openBrowser, collectConsole, login, SHOTS } from "./lib.mjs";

const env = requireEnv();
const { browser, page } = await openBrowser(env);
const log = collectConsole(page);
let ok = true;
try {
  await login(page, env);
  const out = await page.evaluate(async () => {
    const S = "leverage-gta";
    const dist = (name, note) => ({ name, type: "distinction", system: { note } });
    const talent = (name, role, cost, activation, effect, die = null) => ({ name, type: "talent", system: { role, cost, activation, effect: `<p>${effect}</p>`, die } });
    const spec = (name, role) => ({ name, type: "specialty", system: { role } });
    const asset = (name, die, duration, note, weapon = false) => ({ name, type: "asset", system: { die, duration, note, weapon } });
    const jobs = (list) => list.map(([name, total, share, spent = false]) => ({ name, type: "job", system: { payout: { total, share }, spent, callbackUsed: false } }));

    const crews = [
      {
        user: "Jogadora Rosa",
        actor: {
          name: "Marisol \"Sol\" Quintero", type: "crew",
          system: {
            alias: "Sol",
            attributes: { agility: { die: 10 }, alertness: { die: 8 }, intelligence: { die: 8 }, strength: { die: 6 }, vitality: { die: 8 }, willpower: { die: 6 } },
            roles: { grifter: { die: 10 }, hacker: { die: null }, hitter: { die: 6 }, mastermind: { die: 8 }, thief: { die: 6 } },
            money: { steps: 4 }, plotPoints: { value: 2 },
            vest: { kind: "light", value: 4 },
            booking: { number: "0612-MQ", height: "5'8\"", weight: "135 lb", age: "29", eyes: "Hazel", hair: "Auburn", build: "Athletic", marks: "Scar over the left eyebrow. Silver ring, right thumb." },
            background: "<p><strong>RAISED:</strong> Portland Docks, Liberty City. Mother ran a pawnshop; Sol learned to read people across the counter.</p><p><strong>SCHOOLING:</strong> Dropped out of law school in the second year.</p><p><strong>PRIORS:</strong> Two counts of fraud, both <span class=\"redacted\"></span>.</p><p><strong>NOW:</strong> The crew's face. Talks her way past anything with a badge or a velvet rope.</p>"
          }
        },
        items: [
          dist("Law School Dropout", "Helps when bluffing with legal talk. Hurts when real lawyers are in the room."),
          dist("Pawnshop Eyes", "Helps when sizing up a mark or an item's price. Hurts when she can't resist a bargain."),
          dist("Can't Say No to a Dare", "Helps when pushing her luck. Hurts when the crew needs patience."),
          talent("Silver Tongue", "grifter", 0, "You talk to a Supporting Character who is not yet suspicious.", "Add a d8 to the Pool while lying to someone who has no reason to doubt you.", 8),
          talent("Plan on a Napkin", "mastermind", 1, "A scene starts and the crew has not made a plan. Spend a Plot Point.", "Spend a Plot Point to create a Scene Asset d8 describing the plan the crew drew up."),
          talent("Face Like a Stranger", "open", 0, "You change look quickly with what is at hand.", "Step up your Grifter die by one when shaking a witness or cop who saw you."),
          spec("Forgery", "grifter"), spec("Fast Talk", "grifter"), spec("Reading People", "mastermind"),
          asset("Signature Blazer", 8, "signature", "Tailored, with three hidden pockets."),
          asset("Burner Phones", 6, "signature", "A shoebox of them, all labeled."),
          asset("Forged Press Pass", 6, "job", "Expires at midnight."),
          asset("Snub-nose Revolver", 6, "scene", "Borrowed from the pawnshop drawer.", true),
          ...jobs([["The Pier 9 Shuffle", 4, 2], ["The Auction House Job", 6, 3, true], ["The Hotel Swap", 4, 2], ["The Parking Garage Job", 2, 1]])
        ]
      },
      {
        user: "Jogador Marco",
        actor: {
          name: "Marco \"Bruto\" Silva", type: "crew",
          system: {
            alias: "Bruto",
            attributes: { agility: { die: 6 }, alertness: { die: 6 }, intelligence: { die: 6 }, strength: { die: 10 }, vitality: { die: 12 }, willpower: { die: 8 } },
            roles: { grifter: { die: null }, hacker: { die: null }, hitter: { die: 10 }, mastermind: { die: 4 }, thief: { die: 8 } },
            money: { steps: 3 }, plotPoints: { value: 2 },
            vest: { kind: "standard", value: 6 },
            booking: { number: "0388-MS", height: "6'3\"", weight: "240 lb", age: "36", eyes: "Brown", hair: "Shaved", build: "Heavy", marks: "Dragon tattoo on the right forearm. Broken nose, set twice." },
            background: "<p><strong>RAISED:</strong> Little Havana, Liberty City. Father drove a tow truck; Marco rode along from age seven.</p><p><strong>SCHOOLING:</strong> Trade school, auto mechanics. Finished top of class.</p><p><strong>PRIORS:</strong> Assault, grand theft auto, <span class=\"redacted\"></span>. Served 14 months.</p><p><strong>NOW:</strong> The crew's muscle and wheelman. Gentle with friends and animals.</p>"
          }
        },
        items: [
          dist("Gentle Giant", "Helps when calming people down or protecting someone. Hurts when anyone expects him to scare them."),
          dist("Born Behind the Wheel", "Helps in any chase or when fixing an engine. Hurts when he is a passenger."),
          dist("Owes the Wrong People", "Helps when he knows who is who in the underworld. Hurts when old debts show up."),
          talent("Heavy Hitter", "hitter", 0, "You hit someone with your fists or a blunt object.", "Add a d8 to the Pool when you take down a Supporting Character in one blow.", 8),
          talent("Roll With It", "open", 1, "You take damage and want to shrug it off. Spend a Plot Point.", "Spend a Plot Point to halve the damage you would take this round (rounded down)."),
          talent("Hot Wire", "thief", 0, "You start a car without keys.", "Your Specialty die for vehicles counts twice when stealing a car.", 6),
          spec("Getaway Driving", "hitter"), spec("Brawling", "hitter"), spec("Hot-wiring", "thief"),
          asset("Rebuilt Muscle Car", 8, "signature", "Matte black, runs on prayer and premium."),
          asset("Tool Roll", 6, "signature", "Every wrench he ever stole."),
          asset("Borrowed Tow Truck", 6, "job", "Still has the other company's logo."),
          asset("Tire Iron", 6, "scene", "Grabbed from the trunk.", true),
          ...jobs([["The Tow-Yard Job", 4, 2], ["The Impound Lot Job", 6, 3], ["The Chop Shop Job", 2, 1, true], ["The Armored Truck Job", 8, 4]])
        ]
      }
    ];

    const created = [];
    for (const c of crews) {
      let user = game.users.find((u) => u.name === c.user);
      if (!user) user = await foundry.documents.User.create({ name: c.user, role: CONST.USER_ROLES.PLAYER });
      let actor = game.actors.find((a) => a.name === c.actor.name);
      if (!actor) {
        actor = await Actor.create({ ...c.actor, ownership: { default: 0, [user.id]: 3 } });
        await actor.createEmbeddedDocuments("Item", c.items);
        await actor.update({ "system.life.value": actor.system.life.max });
      }
      await user.update({ character: actor.id });
      created.push({ user: user.name, actor: actor.name, items: actor.items.size, life: actor.system.life.value, lifeMax: actor.system.life.max });
    }

    // Enemies.
    const npcDefs = [
      { name: "Vincenzo \"Vinnie\" Moretti", type: "npc", system: { tier: "mark", traits: [{ name: "Runs the Docks", die: 10 }, { name: "Paranoid", die: 8 }, { name: "Friends in the Precinct", die: 8 }], attributes: { agility: { die: 6 }, alertness: { die: 10 }, intelligence: { die: 8 }, strength: { die: 8 }, vitality: { die: 10 }, willpower: { die: 10 } }, roles: { mastermind: { die: 10 }, hitter: { die: 8 } }, weapon: { die: 8 }, vest: { kind: "standard", value: 6 }, notes: "<p>Boss of the Moretti crew. Owns the warehouse and the ledger the crew wants.</p>" } },
      { name: "Capangas do Moretti", type: "npc", system: { tier: "extra", traits: [{ name: "Loyal Muscle", die: 6 }, { name: "Know the Warehouse", die: 8 }], gang: { size: 4, die: 8 }, weapon: { die: 6 }, notes: "<p>Four armed guards in leather jackets.</p>" } },
      { name: "Tenente Ines Calder", type: "npc", system: { tier: "foil", police: true, traits: [{ name: "By the Book", die: 8 }, { name: "Long Memory", die: 6 }], attributes: { agility: { die: 6 }, alertness: { die: 10 }, intelligence: { die: 8 }, strength: { die: 6 }, vitality: { die: 8 }, willpower: { die: 10 } }, roles: { hitter: { die: 8 }, mastermind: { die: 6 } }, weapon: { die: 6 }, vest: { kind: "light", value: 4 }, notes: "<p>Patient detective circling the crew.</p>" } },
      { name: "Patrulha da Polícia", type: "npc", system: { tier: "extra", police: true, traits: [{ name: "Radio for Backup", die: 8 }, { name: "Sirens and Lights", die: 6 }], gang: { size: 3, die: 8 }, weapon: { die: 6 }, notes: "<p>Three patrol officers. They call for backup at the first shot.</p>" } }
    ];
    const npcs = [];
    for (const d of npcDefs) {
      let n = game.actors.find((a) => a.name === d.name);
      if (!n) n = await Actor.create(d);
      npcs.push(n.name);
    }
    let loc = game.actors.find((a) => a.name === "Armazém do Porto Velho");
    if (!loc) {
      loc = await Actor.create({ name: "Armazém do Porto Velho", type: "location", system: { city: "liberty", traits: [{ name: "Dark Corners", die: 8 }, { name: "Rusted Catwalks", die: 6 }, { name: "Only One Exit", die: 8 }, { name: "Stacked Crates", die: 6 }], notes: "<p>Antigo armazém do porto, agora quartel do Moretti. Uma luz de holofote funcionando. Pombos. Cofre no escritório do segundo andar.</p>" } });
    }

    // Stars, Job and Plot Points (set up by the playtest script itself afterwards; here only the first state).
    return { created, npcs, loc: loc.name, keys: Object.keys(game.leverage), job: Object.keys(game.leverage.job), settings: [...game.settings.settings.keys()].filter((k) => k.startsWith(S)) };
  });
  console.log(JSON.stringify(out, null, 1));
  await page.screenshot({ path: `${SHOTS}/playtest-00-seed.png` });
} catch (e) {
  ok = false;
  console.log("FAIL", String(e?.stack ?? e));
} finally {
  console.log("own console errors:", JSON.stringify(log.own()));
  await browser.close();
}
process.exit(ok ? 0 : 1);
