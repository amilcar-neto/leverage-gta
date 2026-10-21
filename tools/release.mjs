/**
 * Builds dist/leverage-gta/ with only what Foundry needs.
 *   node tools/release.mjs --dev    folder only (used by deploy)
 *   node tools/release.mjs --zip    folder + dist/leverage-gta.zip (system.json at the zip root, as Foundry expects)
 *
 * The whitelist is the single place that decides what ships. Add new top-level folders here.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { deflateRawSync, crc32 } from "node:zlib";
import { spawnSync } from "node:child_process";

const SHIP = ["system.json", "leverage-gta.mjs", "module", "templates", "styles", "lang", "fonts", "assets", "packs",
  "LICENSE", "README-SYSTEM.md", "CHANGELOG.md"];
const OUT = "dist/leverage-gta";

// Compile the compendium sources first so packs/<name>/ is current (packs/_source never ships).
const packs = spawnSync(process.execPath, ["tools/build-packs.mjs"], { stdio: "inherit" });
if (packs.status !== 0) { console.error("Pack build failed"); process.exit(1); }

rmSync("dist/leverage-gta", { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const entry of SHIP) {
  if (!existsSync(entry)) continue;
  cpSync(entry, `${OUT}/${entry}`, {
    recursive: true,
    filter: (src) => !src.endsWith(".gitkeep") && !src.includes("_source") && !src.split(/[/\\]/).pop().startsWith(".env")
  });
}
console.log(`Built ${OUT}`);

/** Lists files under `dir` as paths relative to it, with forward slashes. */
function listFiles(dir, base = dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = `${dir}/${name}`;
    return statSync(full).isDirectory() ? listFiles(full, base) : [full.slice(base.length + 1)];
  });
}

/**
 * Writes a zip (deflate) of `dir` to `zipPath` with entries relative to `dir`.
 * Pure Node, so it behaves the same on Windows, macOS and Linux.
 */
function writeZip(dir, zipPath) {
  const parts = [];
  const central = [];
  let offset = 0;
  for (const rel of listFiles(dir).sort()) {
    const data = readFileSync(`${dir}/${rel}`);
    const packed = deflateRawSync(data);
    const name = Buffer.from(rel, "utf8");
    const crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6);
    head.writeUInt16LE(8, 8); head.writeUInt16LE(0, 10); head.writeUInt16LE(0x21, 12);
    head.writeUInt32LE(crc, 14); head.writeUInt32LE(packed.length, 18); head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(name.length, 26);
    const dirEntry = Buffer.alloc(46);
    dirEntry.writeUInt32LE(0x02014b50, 0); dirEntry.writeUInt16LE(20, 4); dirEntry.writeUInt16LE(20, 6);
    head.copy(dirEntry, 8, 6, 30);
    dirEntry.writeUInt32LE(offset, 42);
    parts.push(head, name, packed);
    central.push(dirEntry, name);
    offset += head.length + name.length + packed.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8);
  end.writeUInt16LE(central.length / 2, 10); end.writeUInt32LE(centralBuf.length, 12); end.writeUInt32LE(offset, 16);
  writeFileSync(zipPath, Buffer.concat([...parts, centralBuf, end]));
}

if (process.argv.includes("--zip")) {
  const zip = "dist/leverage-gta.zip";
  rmSync(zip, { force: true });
  writeZip(OUT, zip);
  console.log(`Wrote ${zip}`);
}
