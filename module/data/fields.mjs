/**
 * Shared data fields and schema builders for the Leverage data models (docs/05).
 * Requires the Foundry globals (`foundry.data.fields`); not importable from plain node tests.
 */
import { LEVERAGE } from "../config.mjs";

const { NumberField, SchemaField, StringField, ArrayField } = foundry.data.fields;

/**
 * An integer die size taken from `CONFIG.LEVERAGE.dice` (d4-d12), optionally `null` (blank).
 * Blank form input ("") is stored as `null` when nullable.
 */
export class DieField extends NumberField {
  /** @param {object} [options] Standard NumberField options. `nullable` allows a blank die. */
  constructor(options = {}, context = {}) {
    super({
      required: true,
      integer: true,
      choices: [...LEVERAGE.dice],
      nullable: false,
      initial: options.nullable ? null : LEVERAGE.defaultDie,
      ...options
    }, context);
  }

  /** @override */
  _cast(value) {
    if (this.nullable && (value === "" || value === null || value === undefined)) return null;
    return super._cast(value);
  }
}

/** Builds `{ key: { die } }` for every key of `keys`. */
function dieMap(keys, options) {
  return new SchemaField(Object.fromEntries(
    Object.keys(keys).map((key) => [key, new SchemaField({ die: new DieField(options) })])
  ));
}

/**
 * The six Attributes, each `{ die }`.
 * @param {object} [options] DieField options (e.g. `{ nullable: true }`).
 */
export function attributesField(options = {}) {
  return dieMap(LEVERAGE.attributes, options);
}

/** The five Roles, each `{ die }`, always nullable (blank allowed). */
export function rolesField() {
  return dieMap(LEVERAGE.roles, { nullable: true });
}

/** A list of free-form named traits: `[{ name, die }]`. */
export function traitsField() {
  return new ArrayField(new SchemaField({
    name: new StringField({ required: true, blank: true, initial: "" }),
    die: new DieField()
  }));
}

/** Deep copy (`deepClone`) of the model's own properties, for `getRollData` (docs/04 "@-references"). */
export function snapshot(model) {
  return foundry.utils.deepClone({ ...model });
}

/**
 * Reads a world setting, falling back when settings are not ready or the key is unregistered.
 * @param {string} key Setting key in the system namespace.
 * @param {*} fallback Value used when the read fails or is nullish.
 * @returns {*}
 */
export function readSetting(key, fallback) {
  try {
    return game?.settings?.get(LEVERAGE.systemId, key) ?? fallback;
  } catch {
    return fallback;
  }
}
