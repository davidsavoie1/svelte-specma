import { writable } from "svelte/store";
import collDerived from "./collDerived";
import flexDerived from "./flexDerived";
import predSpecable from "./predSpecable";
import writableByValue from "./writableByValue";
import {
  entries,
  fromEntries,
  genRandomId,
  get,
  isColl,
  keys,
  typeOf,
  values,
} from "./util";
import { specma, ensureConfigured } from "./configure";

export default function collSpecable(
  initialValue,
  { fields, getId, id, required, spec } = {},
  _extra = {}
) {
  ensureConfigured();
  const { getPred, getSpread, isOpt, select } = specma;

  const selectedValue = fields ? select(fields, initialValue) : initialValue;

  const { path, rootValueStore = writableByValue(selectedValue) } = _extra;
  const collType = isColl(spec) ? typeOf(spec) : typeOf(initialValue);
  const isRequired = required && !isOpt(required);

  const allKeys = new Set([
    ...keys(selectedValue),
    ...keys(fields ? select(fields, spec) : spec),
    ...keys(fields ? select(fields, required) : required),
    ...keys(fields),
  ]);

  const ownGetId = getPred(getId);
  const idGen = (v, k) => {
    if (ownGetId) return ownGetId(v, k);
    if (collType === "array") return genRandomId();
    return k;
  };

  const createChildEntry = (key, val) => {
    const subVal = val;
    const subSpec = get(key, spec) || getSpread(spec);
    const subGetId = get(key, getId);
    const subId = idGen(subVal, key);
    const subPath = path ? [...path, subId] : [subId];
    const subFields = get(key, fields) || getSpread(fields);
    const subRequired = get(key, required) || getSpread(required);

    const subStore = _extra.specable(
      subVal,
      {
        spec: subSpec,
        id: subId,
        getId: subGetId,
        fields: subFields,
        required: subRequired,
      },
      { path: subPath, rootValueStore }
    );

    return [key, { ...subStore, id: subId }];
  };

  let childrenStores = fromEntries(
    [...allKeys].map((key) => createChildEntry(key, get(key, selectedValue))),
    collType
  );

  const children = writable(childrenStores);
  const ownSpecable = predSpecable(selectedValue, {
    id,
    required: isRequired,
    spec,
  });

  const derivedValue = collDerived(childrenStores, ($childrenStores) => {
    const $childrenEntries = entries($childrenStores);
    const $childrenValues = $childrenEntries.map(([key, state]) => [
      key,
      state.value,
    ]);
    const value = fromEntries($childrenValues, collType);
    ownSpecable.set(value);
    if (!path) rootValueStore.set(value);
    return value;
  });

  const aggregateStatusStores = () => [
    derivedValue,
    ownSpecable,
    ...values(childrenStores),
  ];

  const status = flexDerived(aggregateStatusStores(), ($statusStores) => {
    const [, $ownSpecable, ...$children] = $statusStores;

    const combined = [$ownSpecable, ...$children].reduce(combineChildren);

    if (combined.active !== false) ownSpecable.activate();

    const { value, error } = $ownSpecable;

    const details = Object.fromEntries([
      ["_", $ownSpecable],
      ...$children.map((child) => [child.id, child]),
    ]);

    const errors = detailsToErrors(details, id);
    const collErrors = errors.filter(({ isColl }) => isColl);

    return {
      ...combined,
      id,
      initialValue: $ownSpecable.initialValue,
      value,
      error,
      errors,
      collErrors,
      details,
    };
  });

  function setChildrenStores(newChildrenStores) {
    childrenStores = newChildrenStores;
    children.set(newChildrenStores);
    derivedValue.set(newChildrenStores);
    status.set(aggregateStatusStores());
  }

  function setValue(coll, partial = false) {
    entries(childrenStores).forEach(([key, store]) => {
      const newValue = get(key, coll);
      if (partial && newValue === undefined) return;
      store.set(newValue, partial);
    });
  }

  function activate(bool = true) {
    const promises = [ownSpecable, ...values(childrenStores)].map((store) => {
      const promise = store.activate(bool);
      return promise.then((valid) => {
        if (valid) return valid;
        throw valid;
      });
    });
    return Promise.all(promises)
      .then(() => true)
      .catch(() => false);
  }

  return {
    id,
    isRequired,
    spec,
    stores: childrenStores,

    activate,

    add(coll) {
      if (!coll) return;

      const newEntries = keys(coll).map((key) =>
        createChildEntry(key, get(key, coll))
      );
      const updatedStores = fromEntries(
        [...entries(childrenStores), ...newEntries],
        collType
      );
      setChildrenStores(updatedStores);
      return this;
    },

    remove(idsToRemove = []) {
      const updatedStores = fromEntries(
        entries(childrenStores).filter(
          ([, store]) => !idsToRemove.includes(store.id)
        ),
        collType
      );
      setChildrenStores(updatedStores);
      return this;
    },

    reset(newInitialValue = selectedValue) {
      setValue(newInitialValue, false);
      activate(false);
      return this;
    },

    set(coll, partial = false) {
      setValue(coll, partial);
      return this;
    },

    update: (fn) => {
      setChildrenStores(fn(childrenStores));
      return this;
    },

    children: {
      subscribe: children.subscribe,
    },

    subscribe: status.subscribe,
  };
}

function combineChildren(a, b) {
  const validating = a.validating || b.validating;
  return {
    active: a.active === b.active ? b.active : null,
    changed: a.changed || b.changed,
    valid: validating ? null : a.valid && b.valid,
    validating,
  };
}

const liftError = (parentId) => ({ path, error, ...rest }) => {
  const newPath = parentId === undefined ? path : [parentId, ...path];
  return {
    ...rest,
    path: newPath,
    which: newPath.join("."),
    error,
  };
};

function detailsToErrors(details, parentId) {
  return Object.entries(details)
    .flatMap(([key, status]) => {
      if (!status.details) {
        if (!status.error) return [];
        if (key === "_") {
          return [{ path: [], error: status.error, isColl: true }];
        }
        return [summarizeStatusError(status)];
      }

      const subErrors = detailsToErrors(status.details, details.id);
      return subErrors.map(liftError(status.id));
    })
    .map(liftError(parentId));
}

function summarizeStatusError({ id, error }) {
  return { path: [id], which: id, error };
}
