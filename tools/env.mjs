/**
 * Minimal .env reader (no dependency). Returns process.env merged with KEY=VALUE lines from .env.
 * Lines starting with # are ignored. Values are not unquoted beyond trimming surrounding quotes.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * @param {string} [file] path to the .env file, relative to the project root
 * @returns {Record<string, string>}
 */
export function loadEnv(file = ".env") {
  const env = { ...process.env };
  const path = resolve(file);
  if (!existsSync(path)) return env;
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    if (!(key in process.env)) env[key] = value;
  }
  return env;
}

/**
 * @param {Record<string, string>} env
 * @param {string[]} keys
 * @returns {string[]} the keys that are missing or empty
 */
export function missing(env, keys) {
  return keys.filter((k) => !env[k]);
}
