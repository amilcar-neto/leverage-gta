/**
 * Console logger with the `Leverage |` prefix. Debug output is gated by the client setting `debug`,
 * read defensively because settings are not registered before `init` finishes.
 */

import { SYSTEM_ID } from "./config.mjs";

const PREFIX = "Leverage |";

/**
 * Whether the client `debug` setting is on. Returns false when settings are not available yet.
 * @returns {boolean}
 */
export function isDebug() {
  try {
    return Boolean(globalThis.game?.settings?.get(SYSTEM_ID, "debug"));
  } catch {
    return false;
  }
}

export const logger = Object.freeze({
  info: (...args) => console.log(PREFIX, ...args),
  warn: (...args) => console.warn(PREFIX, ...args),
  error: (...args) => console.error(PREFIX, ...args),
  /** Only prints when the `debug` client setting is on. */
  debug: (...args) => {
    if (isDebug()) console.debug(PREFIX, ...args);
  }
});
