import fastEquals from "fast-deep-equal";

export const identity = (x) => x;
export const isColl = (x) => ["array", "map", "object"].includes(typeOf(x));
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

/* Merge multiple collections of identical type with right to left arguments precedence. */
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

export function countPathAncestors(str = "") {
  return (str.match(/\.\.\/|\.\.$/g) || []).length;
}

export function keepForwardPath(str = "") {
  return str.split("/").reduce((acc, node) => {
    if (!node || node.startsWith(".")) return acc;
    const index = parseInt(node, 10);
    return [...acc, isNaN(index) ? node : index];
  }, []);
}

export function equals(a, b, eqBy = defaultEqBy) {
  const [_a, _b] = [a, b].map(eqBy);
  return _a === _b || fastEquals(_a, _b);
}

function defaultEqBy(x) {
  if (x instanceof Date) return x.valueOf();
  if (isColl(x)) return removeUndefined(x);
  return x;
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
