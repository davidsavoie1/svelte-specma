/**
 * util.js
 *
 * Small utility helpers used throughout the library.
 * - Type/shape inspectors: typeOf, isColl, isFunc, isStore
 * - Collection helpers: entries, fromEntries, values, keys, merge
 * - Generic helpers: identity, genRandomId, get, getPath, keepForwardPath
 * - Equality: equals (uses fast-deep-equal) with normalization for Dates and collections
 *
 * Functions include JSDoc for in-editor hints and to clarify expected inputs/outputs.
 */

import fastEquals from "fast-deep-equal";

/**
 * Identity function.
 * @template T
 * @param {T} x
 * @returns {T}
 */
export const identity = (x) => x;

/**
 * Check whether a value is a collection (array, map or plain object).
 * @param {any} x
 * @returns {boolean}
 */
export const isColl = (x) => ["array", "map", "object"].includes(typeOf(x));

/**
 * Check whether a value is a function.
 * @param {any} x
 * @returns {boolean}
 */
export const isFunc = (x) => typeof x === "function";

/**
 * Heuristic to detect Svelte stores (object with a subscribe function).
 * @param {any} x
 * @returns {boolean}
 */
export const isStore = (x) => x && x.subscribe && isFunc(x.subscribe);

/**
 * Return a normalized low-level type string for common JS types.
 * Examples: [], {} and new Map() => "array", "object", "map"
 * @param {any} obj
 * @returns {string}
 */
export const typeOf = (obj) =>
  ({}.toString.call(obj).split(" ")[1].slice(0, -1).toLowerCase());

/**
 * Get entries from a collection in a uniform [key, value] format.
 * Supports arrays, maps and objects.
 * @param {Array|Map|Object} coll
 * @returns {Array<[any, any]>}
 */
export function entries(coll) {
  const fn = {
    array: () => coll.map((v, i) => [i, v]),
    map: () => Array.from(coll.entries()),
    object: () => Object.entries(coll),
  }[typeOf(coll)];

  return fn ? fn(coll) : [];
}

/**
 * Build a collection of the requested target type from an entries array.
 * - array: returns values array (index ignored)
 * - map: returns new Map(entries)
 * - object: returns Object.fromEntries(entries)
 * If unknown toType is provided, falls back to building a Map.
 *
 * @param {Array<[any, any]>} entriesArr
 * @param {'array'|'map'|'object'} toType
 * @returns {Array|Map|Object}
 */
export function fromEntries(entriesArr, toType) {
  const fn = {
    array: () => entriesArr.map(([, val]) => val),
    map: () => new Map(entriesArr),
    object: () => Object.fromEntries(entriesArr),
  }[toType];
  return fn ? fn() : fromEntries(entriesArr, "map");
}

/**
 * Extract values from a collection.
 * @param {Array|Map|Object} coll
 * @returns {Array<any>}
 */
export function values(coll) {
  const fn = {
    array: () => [...coll],
    map: () => Array.from(coll.values()),
    object: () => Object.values(coll),
  }[typeOf(coll)];

  return fn ? fn(coll) : [];
}

/**
 * Extract keys/indices from a collection.
 * @param {Array|Map|Object} coll
 * @returns {Array<any>}
 */
export function keys(coll) {
  const fn = {
    array: () => coll.map((v, i) => i),
    map: () => Array.from(coll.keys()),
    object: () => Object.keys(coll),
  }[typeOf(coll)];

  return fn ? fn(coll) : [];
}

/**
 * Merge multiple collections of the same type (rightmost arguments take precedence).
 * - array: preserve longest array, fill missing entries from previous arrays
 * - map: new Map of provided entries (later maps override)
 * - object: Object.assign({}, ...colls)
 *
 * @param {...(Array|Map|Object)} args
 * @returns {Array|Map|Object}
 * @throws {TypeError} if collections are of mixed types
 */
export function merge(...args) {
  const colls = args.filter(isColl);
  const type = typeOf(colls[0]);
  if (!colls.every((coll) => typeOf(coll) === type)) {
    const collTypes = colls.map(typeOf).join(", ");
    throw new TypeError(
      `Collections must be of same type. Received '${collTypes}'.`
    );
  }

  const fn = {
    array: () =>
      colls.reduce((acc, coll) => {
        if (coll.length >= acc.length) return coll;
        return [...coll, ...acc.slice(coll.length)];
      }, []),
    map: () => new Map(colls.map((coll) => coll.entries())),
    object: () => Object.assign({}, ...colls),
  }[type];

  if (!fn) throw new Error(`'merge' not implemented yet for ${type}`);

  return fn();
}

/**
 * Generate a short numeric random id (string).
 * @returns {string}
 */
export function genRandomId() {
  return (Math.random() * 1e9).toFixed(0);
}

/**
 * Safely get a value by key from a collection (array, map, object).
 * @param {string|number} key
 * @param {Array|Map|Object} coll
 * @returns {any|undefined}
 */
export function get(key, coll) {
  const fn = {
    array: () => coll[key],
    map: () => coll.get(key),
    object: () => coll[key],
  }[typeOf(coll)];

  return fn ? fn(key, coll) : undefined;
}

/**
 * Resolve a nested value given a path (array of keys/indices).
 * @param {Array<string|number>} [path=[]]
 * @param {any} value
 * @returns {any}
 */
export function getPath(path = [], value) {
  return path.reduce((parent, key) => get(key, parent), value);
}

/**
 * Count occurrences of "../" or terminal ".." segments in a path-like string.
 * Used to detect ancestor references.
 * @param {string} [str=""]
 * @returns {number}
 */
export function countPathAncestors(str = "") {
  return (str.match(/\.\.\/|\.\.$/g) || []).length;
}

/**
 * Convert a forward-slash separated path string into an array of path segments,
 * ignoring empty segments and segments that start with '.' (relative/ancestor tokens).
 * Numeric segments are converted to numbers for array access.
 *
 * Example: "items/0/name" -> ["items", 0, "name"]
 *
 * @param {string} [str=""]
 * @returns {Array<string|number>}
 */
export function keepForwardPath(str = "") {
  return str.split("/").reduce((acc, node) => {
    if (!node || node.startsWith(".")) return acc;
    const index = parseInt(node, 10);
    return [...acc, isNaN(index) ? node : index];
  }, []);
}

/**
 * Equality check that normalizes inputs before using deep equality.
 * - Dates are compared by valueOf()
 * - Collections have undefined values removed before comparison
 *
 * @param {any} a
 * @param {any} b
 * @param {Function} [eqBy=defaultEqBy] - optional normalizer function
 * @returns {boolean}
 */
export function equals(a, b, eqBy = defaultEqBy) {
  const [_a, _b] = [a, b].map(eqBy);
  return _a === _b || fastEquals(_a, _b);
}

/**
 * Default normalizer used by equals.
 * - Dates -> numeric value
 * - Collections -> remove undefined entries recursively
 *
 * @param {any} x
 * @returns {any}
 */
function defaultEqBy(x) {
  if (x instanceof Date) return x.valueOf();
  if (isColl(x)) return removeUndefined(x);
  return x;
}

/**
 * Recursively remove undefined values from collections to avoid false differences
 * when comparing shapes where undefined properties/entries should be ignored.
 *
 * @param {Array|Map|Object} x
 * @returns {Array|Map|Object}
 */
function removeUndefined(x) {
  if (!isColl(x)) return x;
  return fromEntries(
    entries(x).reduce(
      (acc, [key, val]) =>
        val === undefined ? acc : [...acc, [key, removeUndefined(val)]],
      []
    ),
    typeOf(x)
  );
}
