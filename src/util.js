import fastEquals from "fast-deep-equal";

export const identity = (x) => x;
export const isColl = (x) => x && typeof x === "object";
export const isFunc = (x) => typeof x === "function";
export const isStore = (x) => x && x.subscribe && isFunc(x.subscribe);

export const typeOf = (obj) =>
  ({}.toString.call(obj).split(" ")[1].slice(0, -1).toLowerCase());

export function entries(coll) {
  const fn = {
    array: () => coll.map((v, i) => [i, v]),
    map: () => [...coll.entries()],
    object: () => Object.entries(coll),
  }[typeOf(coll)];

  return fn ? fn(coll) : [];
}

export function fromEntries(entries, toType) {
  const fn = {
    array: () => entries.map(([, val]) => val),
    map: () => new Map(entries),
    object: () => Object.fromEntries(entries),
  }[toType];
  return fn ? fn() : fromEntries(entries, "map");
}

export function values(coll) {
  const fn = {
    array: () => [...coll],
    map: () => [...coll.values()],
    object: () => Object.values(coll),
  }[typeOf(coll)];

  return fn ? fn(coll) : [];
}

export function keys(coll) {
  const fn = {
    array: () => coll.map((v, i) => i),
    map: () => [...coll.keys()],
    object: () => Object.keys(coll),
  }[typeOf(coll)];

  return fn ? fn(coll) : [];
}

export function genRandomId() {
  return (Math.random() * 1e9).toFixed(0);
}

export function get(key, coll) {
  const fn = {
    array: () => coll[key],
    map: () => coll.get(key),
    object: () => coll[key],
  }[typeOf(coll)];

  return fn ? fn(key, coll) : undefined;
}

export function getPath(path = [], value) {
  return path.reduce((parent, key) => get(key, parent), value);
}

export /* Given a value and a current path, return the sub value
 * at a path relative to current one. */
function getFromValue(relPath, currPath = [], value) {
  if (!value) return undefined;
  const newPath = relPath.split("/").reduce((acc, move) => {
    if ([null, undefined, "", "."].includes(move)) return acc;

    if (move.startsWith("..")) return acc.slice(0, -1);

    const index = parseInt(move, 10);
    return [...acc, isNaN(index) ? move : index];
  }, currPath);
  return getPath(newPath, value);
}

export function equals(a, b) {
  return fastEquals.apply(fastEquals, [a, b].map(removeUndefined));
}

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
