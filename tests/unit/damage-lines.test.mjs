import { test } from "node:test";
import assert from "node:assert/strict";
import { damageLines, damageSummary, downCardContext, downLines, weaponOptions } from "../../module/applications/chat/damage-lines.mjs";
import { planDown } from "../../module/rules/combat.mjs";

const t = (key, args) => (args ? `${key}${JSON.stringify(args)}` : key);
const record = { targetName: "Ana", margin: 3, weaponDie: 6, weaponRoll: 4, raw: 7, cover: true, damage: 3, absorbed: 2, lifeLost: 1, life: 17, vest: 4, lifeMax: 18, down: false, kind: null };

test("damage lines: cover and vest lines only when they matter", () => {
  const lines = damageLines(record, t);
  assert.equal(lines.length, 4);
  assert.match(lines[2], /Line\.vest/);
  const plain = damageLines({ ...record, cover: false, absorbed: 0, weaponDie: 0 }, t);
  assert.equal(plain.length, 2);
  assert.match(plain[0], /Line\.unarmed/);
});

test("damage summary adds the down kind", () => {
  assert.doesNotMatch(damageSummary(record, t), /Down/);
  assert.match(damageSummary({ ...record, down: true, kind: "busted" }, t), /Down\.busted/);
});

const base = { max: 18, hospitalSteps: 1, bailSteps: 2, bailAllowed: false, moneySteps: 3, rules: { money: true, stars: true } };
const info = (over, extra = {}) => ({
  plan: planDown({ ...base, isCrew: true, ...over }), name: "Ana", isCrew: true, max: 18, price: "d4", lostAssets: [], assetsKept: false, stars: null, ...extra
});

test("down lines: Wasted pays the hospital and gets a Plot Point", () => {
  const lines = downLines(info({ byPolice: false }, { lostAssets: ["Pistol"] }), t);
  assert.ok(lines.some((l) => l.includes("Down.payHospital")));
  assert.ok(lines.some((l) => l.includes("Down.plotPoint")));
  assert.ok(lines.some((l) => l.includes("Down.assetsLost")));
});

test("down lines: Busted in Liberty City says rescue and shows the stars", () => {
  const lines = downLines(info({ byPolice: true }, { stars: { from: 1, to: 2 } }), t);
  assert.ok(lines.some((l) => l.includes("Down.rescue")));
  assert.ok(lines.some((l) => l.includes("Down.stars")));
  assert.ok(!lines.some((l) => l.includes("payBail")));
  assert.equal(downCardContext(info({ byPolice: true }), t).kind, "busted");
});

test("down lines: an NPC only falls", () => {
  const plan = planDown({ ...base, byPolice: false, isCrew: false });
  assert.deepEqual(downLines({ plan, name: "Thug", isCrew: false }, t), ['LEVERAGE.Damage.Down.npc{"name":"Thug"}']);
});

test("weapon options list the presets next to their die", () => {
  const options = weaponOptions([4, 6, 8], { pistol: 6, shotgun: 8, rifle: 8 }, t);
  assert.equal(options[0].value, 0);
  assert.equal(options.find((o) => o.value === 6).label, "d6 · LEVERAGE.Damage.Weapon.pistol");
  assert.equal(options.find((o) => o.value === 8).label, "d8 · LEVERAGE.Damage.Weapon.shotgun · LEVERAGE.Damage.Weapon.rifle");
  assert.equal(options.find((o) => o.value === 4).label, "d4");
});
