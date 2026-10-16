/**
 * Sends dist/leverage-gta to the Foundry server over SSH and replaces the system folder there.
 * Run `npm run deploy` (it builds first). Uses the `tar`, `scp` and `ssh` that ship with Windows 10+, macOS and Linux.
 *
 * Needs in .env: VPS_SSH (user@host), VPS_SYSTEM_DIR (must end with /systems/leverage-gta),
 * optional VPS_SSH_PORT and VPS_SSH_KEY. The key's passphrase must already be loaded in ssh-agent;
 * BatchMode makes ssh fail fast instead of waiting for a password nobody will type.
 */
import { existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { loadEnv, missing } from "./env.mjs";

const env = loadEnv();
const need = missing(env, ["VPS_SSH", "VPS_SYSTEM_DIR"]);
if (need.length) {
  console.error(`Deploy skipped: missing ${need.join(", ")} in .env`);
  process.exit(2);
}
const dir = env.VPS_SYSTEM_DIR.replace(/\/+$/, "");
if (!/\/systems\/leverage-gta$/.test(dir)) {
  console.error(`Refusing to deploy: VPS_SYSTEM_DIR must end with /systems/leverage-gta (got ${dir})`);
  process.exit(2);
}
if (!existsSync("dist/leverage-gta/system.json")) {
  console.error("Nothing to deploy: run `node tools/release.mjs --dev` first.");
  process.exit(2);
}

// Windows: use the OpenSSH that talks to the Windows ssh-agent (Git Bash ssh cannot see it).
const winBin = (n) => (process.platform === "win32" ? `${process.env.SystemRoot}/System32/OpenSSH/${n}.exe` : n);
const sshOpts = ["-o", "BatchMode=yes", "-o", "ConnectTimeout=20"];
if (env.VPS_SSH_KEY) sshOpts.push("-i", env.VPS_SSH_KEY);
const port = env.VPS_SSH_PORT || "22";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`Deploy failed at: ${cmd} ${args.filter((a) => a !== env.VPS_SSH_KEY).join(" ")}`);
    process.exit(1);
  }
}

const archive = "dist/leverage-gta.tgz";
const remoteTmp = "/tmp/leverage-gta-deploy.tgz";
run("tar", ["-czf", archive, "-C", "dist", "leverage-gta"]);
run(winBin("scp"), [...sshOpts, "-P", port, archive, `${env.VPS_SSH}:${remoteTmp}`]);
const remote = [
  `mkdir -p '${dir}'`,
  `find '${dir}' -mindepth 1 -delete`,
  `tar -xzf ${remoteTmp} -C '${dir}' --strip-components=1`,
  `rm -f ${remoteTmp}`,
  `chown -R foundry:foundry '${dir}'`,
  "echo deployed"
].join(" && ");
run(winBin("ssh"), [...sshOpts, "-p", port, env.VPS_SSH, remote]);
rmSync(archive, { force: true });
console.log(`Deployed to ${env.VPS_SSH}:${dir}. Reload the Foundry page (relaunch the world if system.json changed).`);
