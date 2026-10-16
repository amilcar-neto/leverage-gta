/**
 * Builds dist/leverage-gta/ with only what Foundry needs.
 *   node tools/release.mjs --dev    folder only (used by deploy)
 *   node tools/release.mjs --zip    folder + dist/leverage-gta-<version>.zip (needs `tar` that supports zip, or extend)
 *
 * The whitelist is the single place that decides what ships. Add new top-level folders here.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SHIP = ["system.json", "leverage-gta.mjs", "module", "templates", "styles", "lang", "fonts", "assets", "packs",
  "LICENSE", "README-SYSTEM.md", "CHANGELOG.md"];
const OUT = "dist/leverage-gta";

rmSync("dist/leverage-gta", { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const entry of SHIP) {
  if (!existsSync(entry)) continue;
  cpSync(entry, `${OUT}/${entry}`, {
    recursive: true,
    filter: (src) => !src.endsWith(".gitkeep") && !src.includes("_source")
  });
}
console.log(`Built ${OUT}`);

if (process.argv.includes("--zip")) {
  const { version } = JSON.parse(readFileSync("system.json", "utf8"));
  const zip = `dist/leverage-gta-${version}.zip`;
  // bsdtar (Windows 10+, macOS) writes zip with -a; GNU tar users can swap in `zip -r`.
  const r = spawnSync("tar", ["-a", "-c", "-f", zip, "-C", "dist", "leverage-gta"], { stdio: "inherit" });
  if (r.status !== 0) { console.error("Zip failed; see tools/release.mjs"); process.exit(1); }
  console.log(`Wrote ${zip}`);
}
