/**
 * DicePool: the dice a player is assembling on an open sheet (docs/08). Client state, never saved on the actor.
 * Pure logic: references (docs/04) are turned into dice by an injected `resolve` function, so this file has no
 * Foundry dependency and runs in node tests.
 *
 * Reference forms: `attributes.agility`, `roles.thief`, `item:<id>`, `item:<id>:d8|d4`, `money`, `scene:<id>` (Scene Trait: a global Trait or a Trait of a Location of the viewed Scene), `d6`.
 */
import { LEVERAGE } from "../config.mjs";
import { isValidDie } from "./die.mjs";
import { moneyRollDie } from "../rules/money.mjs";

/** Kinds that fill a required slot (exactly one each), in display order. */
export const REQUIRED_KINDS = Object.freeze(["attribute", "role"]);

/** Most Distinctions allowed in one Pool (docs/08: one per roll). */
export const MAX_POOL_DISTINCTIONS = 1;

/**
 * @typedef {object} ResolvedTrait What a reference means for one actor right now.
 * @property {"attribute"|"role"|"specialty"|"distinction"|"asset"|"talent"|"money"|"scene"|"die"} kind
 * @property {string} [name] Literal name (items).
 * @property {string} [nameKey] i18n key of the name (Attributes, Roles, Money).
 * @property {number|null} die Die size; null for a Trait left blank (a blank Role).
 * @property {string} [role] Role key a Specialty belongs to.
 * @property {boolean} [hinders] A Distinction used as d4 (earns a Plot Point).
 */

/**
 * @typedef {ResolvedTrait & {ref: string, optional: boolean, blank: boolean, warn: string|null}} PoolEntry
 */

/**
 * Splits a reference into its parts, or null when it is not a valid shape.
 * @param {string} ref
 * @returns {{type: "attributes"|"roles"|"item"|"scene"|"money"|"die", key?: string, id?: string, size?: number}|null}
 */
export function parseRef(ref) {
  if (typeof ref !== "string") return null;
  if (ref === "money") return { type: "money" };
  const die = /^d(\d+)$/.exec(ref);
  if (die) return isValidDie(Number(die[1])) ? { type: "die", size: Number(die[1]) } : null;
  const trait = /^(attributes|roles)\.([a-z]+)$/.exec(ref);
  if (trait) return { type: trait[1], key: trait[2] };
  const scene = /^scene:([^:]+)$/.exec(ref);
  if (scene) return { type: "scene", id: scene[1] };
  const item = /^item:([^:]+)(?::d(\d+))?$/.exec(ref);
  if (item) return { type: "item", id: item[1], size: item[2] ? Number(item[2]) : undefined };
  return null;
}

/** Resolves an Item reference. Items without a die (Talents, Jobs...) resolve to null. */
function resolveItem(actor, { id, size }) {
  const item = actor.items?.get(id);
  if (!item) return null;
  const { helps, hinders } = LEVERAGE.distinctionDice;
  switch (item.type) {
    case "distinction": {
      const die = size ?? helps;
      return [helps, hinders].includes(die) ? { kind: "distinction", name: item.name, die, hinders: die === hinders } : null;
    }
    case "specialty":
      return { kind: "specialty", name: item.name, die: item.system?.die ?? LEVERAGE.specialtyDie, role: item.system?.role };
    case "asset":
      return { kind: "asset", name: item.name, die: item.system?.die ?? LEVERAGE.defaultDie };
    case "talent":
      return item.system?.die ? { kind: "talent", name: item.name, die: item.system.die } : null;
    default:
      return null;
  }
}

/**
 * Turns a reference into a die for `actor` (duck-typed: `system.attributes|roles|money` and `items.get`).
 * @param {object} actor
 * @param {string} ref
 * @param {{moneyEnabled?: boolean, sceneTraits?: {id: string, name: string, die: number}[], includePooled?: boolean}} [options]
 *   `moneyEnabled` is the house rule switch (default on); `sceneTraits` are the Scene Traits in play (the global Traits plus those of the Locations of the viewed Scene).
 * @returns {ResolvedTrait|null} null when the reference means nothing (deleted item, no money, bad shape).
 */
export function resolvePoolRef(actor, ref, { moneyEnabled = true, sceneTraits = [] } = {}) {
  const parsed = parseRef(ref);
  if (!parsed) return null;
  switch (parsed.type) {
    case "attributes":
    case "roles": {
      const def = LEVERAGE[parsed.type][parsed.key];
      if (!def) return null;
      const kind = parsed.type === "attributes" ? "attribute" : "role";
      return { kind, nameKey: def.label, die: actor.system?.[parsed.type]?.[parsed.key]?.die ?? null };
    }
    case "item":
      return resolveItem(actor, parsed);
    case "scene": {
      const trait = sceneTraits.find((x) => x.id === parsed.id);
      return trait && isValidDie(trait.die) ? { kind: "scene", name: trait.name, die: trait.die } : null;
    }
    case "money": {
      const die = moneyEnabled ? moneyRollDie(actor.system?.money?.steps ?? 0) : null;
      return die ? { kind: "money", nameKey: "LEVERAGE.Sheet.Tray.moneyName", die } : null;
    }
    default:
      return { kind: "die", name: `d${parsed.size}`, die: parsed.size };
  }
}

/** Builds the pool entry of one reference. */
function toEntry(ref, resolved, roleInPool) {
  const optional = !REQUIRED_KINDS.includes(resolved.kind);
  const mismatch = resolved.kind === "specialty" && roleInPool && resolved.role && resolved.role !== roleInPool;
  return { ref, ...resolved, optional, blank: resolved.die === null, warn: mismatch ? "specialtyRole" : null };
}

/** Pool state: an ordered list of references plus the rules that keep it legal. */
export class DicePool {
  /** @type {string[]} */
  #refs = [];

  /** @type {(ref: string) => ResolvedTrait|null} */
  #resolve;

  /**
   * @param {(ref: string) => ResolvedTrait|null} resolve Turns a reference into a die (see `resolvePoolRef`).
   */
  constructor(resolve) {
    this.#resolve = resolve;
  }

  /** The references in insertion order (copy). */
  get refs() {
    return [...this.#refs];
  }

  /** @param {string} ref @returns {boolean} true when the reference is in the Pool. */
  has(ref) {
    return this.#refs.includes(ref);
  }

  /**
   * Entries in display order: Attribute, Role, then the optional ones as they were added.
   * References that no longer resolve (deleted Item, no money left) are dropped from the Pool here.
   * @returns {PoolEntry[]}
   */
  entries() {
    const resolved = [];
    for (const ref of [...this.#refs]) {
      const r = this.#resolve(ref);
      if (r) resolved.push([ref, r]);
      else this.#refs.splice(this.#refs.lastIndexOf(ref), 1);
    }
    const roleRef = resolved.find(([, r]) => r.kind === "role")?.[0];
    const roleKey = roleRef ? parseRef(roleRef)?.key ?? null : null;
    const all = resolved.map(([ref, r]) => toEntry(ref, r, roleKey));
    const rank = (e) => (e.optional ? REQUIRED_KINDS.length : REQUIRED_KINDS.indexOf(e.kind));
    return all.map((e, i) => [e, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([e]) => e);
  }

  /** Dice that count (blank Traits do not). */
  get count() {
    return this.entries().filter((e) => !e.blank).length;
  }

  /** How many dice are kept. */
  get keep() {
    return LEVERAGE.keepDefault;
  }

  /**
   * Why the Pool cannot be rolled: `noAttribute`, `noRole`, `blankAttribute`, `blankRole`. Empty list = ready.
   * @returns {string[]}
   */
  get problems() {
    const entries = this.entries();
    const out = [];
    for (const kind of REQUIRED_KINDS) {
      const entry = entries.find((e) => e.kind === kind);
      const name = kind[0].toUpperCase() + kind.slice(1);
      if (!entry) out.push(`no${name}`);
      else if (entry.blank) out.push(`blank${name}`);
    }
    return out;
  }

  /** @returns {boolean} true when the Pool has 1 Attribute and 1 Role, both rated. */
  get canRoll() {
    return this.problems.length === 0;
  }

  /**
   * Clicking a Trait: puts it in the Pool, or takes it out when it is already there.
   * @param {string} ref
   * @returns {"added"|"removed"|"ignored"}
   */
  toggle(ref) {
    if (parseRef(ref)?.type !== "die" && this.has(ref)) return this.remove(ref) ? "removed" : "ignored";
    return this.add(ref) ? "added" : "ignored";
  }

  /**
   * Clicking a chip in the tray: takes it out; a Distinction used as d8 goes to d4 first (docs/08).
   * @param {string} ref
   * @returns {"stepped"|"removed"|"ignored"}
   */
  cycle(ref) {
    const i = this.#refs.lastIndexOf(ref);
    if (i < 0) return "ignored";
    const resolved = this.#resolve(ref);
    if (resolved?.kind === "distinction" && !resolved.hinders) {
      this.#refs[i] = `item:${parseRef(ref).id}:d${LEVERAGE.distinctionDice.hinders}`;
      return "stepped";
    }
    this.#refs.splice(i, 1);
    return "removed";
  }

  /**
   * Adds a reference applying the slot rules: a new Attribute/Role replaces the old one, a new Distinction
   * replaces the old one (one per roll), a repeated Trait is not added twice. Loose dice may repeat.
   * @param {string} ref
   * @returns {boolean} false when the reference means nothing for this actor.
   */
  add(ref) {
    const resolved = this.#resolve(ref);
    if (!resolved) return false;
    if (resolved.kind !== "die" && this.has(ref)) return true;
    const limit = this.#limitOf(resolved.kind);
    if (limit !== Infinity) this.#evictKind(resolved.kind, limit - 1);
    this.#refs.push(ref);
    return true;
  }

  /** How many entries of a kind may be in the Pool. */
  #limitOf(kind) {
    if (REQUIRED_KINDS.includes(kind)) return 1;
    return kind === "distinction" ? MAX_POOL_DISTINCTIONS : Infinity;
  }

  /** Drops the oldest entries of `kind` until at most `keep` remain. */
  #evictKind(kind, keep) {
    const same = this.#refs.filter((r) => this.#resolve(r)?.kind === kind);
    for (const ref of same.slice(0, Math.max(0, same.length - keep))) this.remove(ref);
  }

  /**
   * Removes a reference (the last copy, for loose dice).
   * @param {string} ref
   * @returns {boolean} true when something was removed.
   */
  remove(ref) {
    const i = this.#refs.lastIndexOf(ref);
    if (i < 0) return false;
    this.#refs.splice(i, 1);
    return true;
  }

  /**
   * Adds a loose die (the "+ DIE" button).
   * @param {number} size One of `LEVERAGE.dice`.
   * @returns {boolean} false for an invalid size.
   */
  addDie(size) {
    return isValidDie(size) && this.add(`d${size}`);
  }

  /** Empties the Pool. */
  clear() {
    this.#refs = [];
  }
}

/**
 * @typedef {object} PoolMenuEntry One thing the "+ DIE" menu offers.
 * @property {string} ref Pool reference to add.
 * @property {number} die Die it adds.
 * @property {string} label Literal name (`dN`, Item or Scene Trait name) or, with `labelKey`, an i18n key.
 * @property {boolean} [labelKey] `label` is an i18n key.
 * @property {string} kind Resolved kind (`die`, `money`, `scene`, `asset`...).
 * @property {boolean} [pooled] Already in the Pool (only offered with `includePooled`).
 */

/** Rollable Items of one type, as menu entries (Talents only with a die; Distinctions offered as d8, the helping die). */
function itemMenuEntries(actor, type, inPool, includePooled) {
  const out = [];
  for (const item of actor.items ?? []) {
    if (item.type !== type) continue;
    const ref = `item:${item.id}`;
    const pooled = inPool(ref);
    const resolved = pooled && !includePooled ? null : resolvePoolRef(actor, ref);
    if (resolved) out.push({ ref, die: resolved.die, label: resolved.name, kind: resolved.kind, pooled });
  }
  return out;
}

/** Attributes or Roles of the actor that have a die and are not in the Pool yet. */
function traitMenuEntries(actor, group, inPool, includePooled) {
  const out = [];
  for (const key of Object.keys(LEVERAGE[`${group}s`])) {
    const ref = `${group}s.${key}`;
    const pooled = inPool(ref);
    const resolved = pooled && !includePooled ? null : resolvePoolRef(actor, ref);
    if (resolved?.die) out.push({ ref, die: resolved.die, label: resolved.nameKey, labelKey: true, kind: resolved.kind, pooled });
  }
  return out;
}

/**
 * Everything the "+ DIE" button can add, grouped by kind in `LEVERAGE.poolMenuGroups` order, empty groups left out:
 * loose dice (always, they may repeat), Money (rule on, wallet not empty), Scene Traits (global and of the viewed Scene's Locations), then the
 * actor's Assets, Specialties, Distinctions, Talents that carry a die, Attributes and Roles. What is already in the
 * Pool is not offered again, unless `includePooled` is set (the Pool builder window shows them marked `pooled`).
 * @param {object} actor Duck-typed (`system`, `items` iterable).
 * @param {(ref: string) => boolean} inPool Whether a reference is in the Pool (`DicePool#has`).
 * @param {{moneyEnabled?: boolean, sceneTraits?: {id: string, name: string, die: number}[]}} [options]
 * @returns {{key: string, entries: PoolMenuEntry[]}[]}
 */
export function poolMenuGroups(actor, inPool, { moneyEnabled = true, sceneTraits = [], includePooled = false } = {}) {
  const money = moneyEnabled && (includePooled || !inPool("money")) ? resolvePoolRef(actor, "money") : null;
  const byGroup = {
    die: LEVERAGE.dice.map((die) => ({ ref: `d${die}`, die, label: `d${die}`, kind: "die" })),
    money: money ? [{ ref: "money", die: money.die, label: money.nameKey, labelKey: true, kind: "money", pooled: inPool("money") }] : [],
    scene: sceneTraits.filter((x) => includePooled || !inPool(`scene:${x.id}`))
      .map((x) => ({ ref: `scene:${x.id}`, die: x.die, label: x.name, kind: "scene", pooled: inPool(`scene:${x.id}`) })),
    attribute: traitMenuEntries(actor, "attribute", inPool, includePooled),
    role: traitMenuEntries(actor, "role", inPool, includePooled)
  };
  for (const type of ["asset", "specialty", "distinction", "talent"]) byGroup[type] = itemMenuEntries(actor, type, inPool, includePooled);
  return LEVERAGE.poolMenuGroups.map((key) => ({ key, entries: byGroup[key] })).filter((g) => g.entries.length);
}
