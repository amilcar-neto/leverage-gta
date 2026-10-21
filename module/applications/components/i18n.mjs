/**
 * The one translate helper of the UI code: `t(key)` localizes, `t(key, data)` formats `{placeholders}`.
 * Needs the global `game.i18n` at call time (not at import time), so modules that use it stay importable in node.
 * @param {string} key i18n key.
 * @param {object} [data] Format data.
 * @returns {string}
 */
export const t = (key, data) => (data ? game.i18n.format(key, data) : game.i18n.localize(key));

/**
 * Key of the plural form of a message: `<key>.one`, `<key>.other`... by the plural rules of the language.
 * @param {string} key Base key; the lang file holds an object with one entry per plural category.
 * @param {number} count
 * @param {string} lang Language code (`game.i18n.lang`).
 * @returns {string}
 */
export const pluralKey = (key, count, lang) => `${key}.${new Intl.PluralRules(lang).select(count)}`;

/**
 * Formats a message that changes with a number ("1 star" / "3 stars"). `{count}` is available in the message next to
 * `data`. Falls back to the `other` form when the language lacks the category.
 * @param {string} key Base key (an object in the lang file with `one` and `other`).
 * @param {number} count
 * @param {object} [data] More placeholders.
 * @returns {string}
 */
export function tn(key, count, data = {}) {
  const exact = pluralKey(key, count, game.i18n.lang);
  return game.i18n.format(game.i18n.has(exact) ? exact : `${key}.other`, { count, ...data });
}
