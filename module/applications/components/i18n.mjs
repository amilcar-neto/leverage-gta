/**
 * The one translate helper of the UI code: `t(key)` localizes, `t(key, data)` formats `{placeholders}`.
 * Needs the global `game.i18n` at call time (not at import time), so modules that use it stay importable in node.
 * @param {string} key i18n key.
 * @param {object} [data] Format data.
 * @returns {string}
 */
export const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));
