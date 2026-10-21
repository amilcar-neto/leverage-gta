/**
 * Compiles the compendium sources (packs/_source/<name>/*.json|yml) into LevelDB packs (packs/<name>/), the format
 * Foundry v14 reads. The list of packs comes from system.json `packs`, so a pack declared there needs a source folder.
 *   node tools/build-packs.mjs
 *
 * Source files hold ONE document each. The CLI skips files without `_key`, so each needs `_id` (16 chars) and
 * `_key` (`!actors!id`, `!items!id`); embedded Items carry `!actors.items!actorId.itemId` (only the top-level `_key` is validated here).
 */
import { existsSync, readFileSync, rmSync } from "node:fs";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

const COLLECTION = Object.freeze({ Actor: "actors", Item: "items", JournalEntry: "journal", RollTable: "tables", Macro: "macros" });
const SOURCE_DIR = "packs/_source";

/** Compiles one pack declared in system.json. */
async function buildPack(pack) {
  const src = `${SOURCE_DIR}/${pack.name}`;
  if (!existsSync(src)) throw new Error(`Missing source folder ${src} for pack "${pack.name}"`);
  const collection = COLLECTION[pack.type];
  if (!collection) throw new Error(`Unsupported pack type "${pack.type}" (${pack.name})`);
  const dest = pack.path.replace(/^\.?\//, "");
  rmSync(dest, { recursive: true, force: true }); // stale keys would survive a rebuild otherwise
  await compilePack(src, dest, {
    recursive: true,
    log: false,
    transformEntry: (doc) => {
      if (!/^[A-Za-z0-9]{16}$/.test(doc._id ?? "")) throw new Error(`${pack.name}: "${doc.name}" needs a 16-char _id`);
      if (doc._key !== `!${collection}!${doc._id}`) throw new Error(`${pack.name}: "${doc.name}" has a wrong _key ${doc._key}`);
    }
  });
  console.log(`Packed ${pack.name} -> ${dest}`);
}

const { packs = [] } = JSON.parse(readFileSync("system.json", "utf8"));
for (const pack of packs) await buildPack(pack);
console.log(`Built ${packs.length} pack(s)`);
