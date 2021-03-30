import { getPred, getSpread, isOpt } from "specma";
import { writable } from "svelte/store";
import collDerived from "./collDerived";
import flexDerived from "./flexDerived";
import predSpecable from "./predSpecable";
import writableByValue from "./writableByValue";
import {
  entries,
  fromEntries,
  get,
  isColl,
  keys,
  typeOf,
  values,
} from "./util";

export default function collSpecable(
  initialValue,
  { fields, getId, id, required, spec } = {},
  _extra = {}
) {
  const { path, rootValueStore = writableByValue(initialValue) } = _extra;
  const collType = isColl(spec) ? typeOf(spec) : typeOf(initialValue);
  const isRequired = required && !isOpt(required);

  const allKeys = new Set([
    ...keys(initialValue),
    ...keys(spec),
    ...keys(required),
    ...keys(fields),
  ]);

  const idGen = getPred(getId);

  const keyToChildEntry = (key, coll, keyModifier = (x) => x) => {
    const subVal = get(key, coll);
    const subSpec = get(key, spec) || getSpread(spec);
    const subGetId = get(key, getId);
    const subId = idGen ? idGen(subVal) : keyModifier(key);
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

    return [keyModifier(key), { ...subStore, id: subId }];
  };

  let childrenStores = fromEntries(
    [...allKeys].map((key) => keyToChildEntry(key, initialValue)),
    collType
  );

  const children = writable(childrenStores);
  const ownSpecable = predSpecable(initialValue, {
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

  return {
    id,
    isRequired,
    spec,
    stores: childrenStores,

    activate(bool = true) {
      const promises = [ownSpecable, ...values(childrenStores)].map((store) =>
        store.activate(bool).then((valid) => {
          if (valid) return valid;
          throw valid;
        })
      );
      return Promise.all(promises)
        .then(() => true)
        .catch(() => false);
    },

    add(coll) {
      if (!coll) return;

      const newEntries = keys(coll).map((key) => {
        const keyModifier =
          collType === "array"
            ? (idx) => idx + childrenStores.length
            : undefined;
        return keyToChildEntry(key, coll, keyModifier);
      });
      const updatedStores = fromEntries(
        [...entries(childrenStores), ...newEntries],
        collType
      );
      setChildrenStores(updatedStores);
    },

    remove(idsToRemove = []) {
      const updatedStores = fromEntries(
        entries(childrenStores).filter(
          ([, store]) => !idsToRemove.includes(store.id)
        ),
        collType
      );
      setChildrenStores(updatedStores);
    },

    update: (fn) => setChildrenStores(fn(childrenStores)),

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
    validating: a.validating || b.validating,
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
