import { get as getStoreValue, writable } from "svelte/store";
import collDerived from "./collDerived";
import flexDerived from "./flexDerived";
import predSpecable from "./predSpecable";
import {
  entries,
  fromEntries,
  genRandomId,
  get,
  isColl,
  keys,
  merge,
  typeOf,
  values,
} from "./util";
import { specma, ensureConfigured } from "./configure";

export default function collSpecable(
  initialValue,
  { fields, getId, id, required, spec, onSubmit } = {},
  _extra = {}
) {
  ensureConfigured();
  const { getPred, getSpread, isOpt } = specma;

  let collValue = initialValue; // For static properties

  const { getAncestor } = _extra;
  const collType = isColl(spec) ? typeOf(spec) : typeOf(initialValue);
  const isRequired = required && !isOpt(required);
  const spreadSpec = getSpread(spec);
  const spreadFields = getSpread(fields);
  const spreadRequired = getSpread(required);
  const isSpread = spreadSpec || spreadFields || spreadRequired;

  const valueKeys = isSpread ? keys(initialValue) : [];
  const allKeys = new Set(
    fields
      ? [...keys(fields), ...valueKeys]
      : [...keys(spec), ...keys(required), ...valueKeys]
  );

  const ownGetId = getPred(getId);
  const idGen = (v, k) => {
    if (ownGetId) return ownGetId(v, k);
    if (collType === "array") return genRandomId();
    return k;
  };

  const ownSpecable = predSpecable(initialValue, {
    id,
    required: isRequired,
    spec,
  });

  const createChildEntry = (key, val) => {
    const subVal = val;
    const subSpec = get(key, spec) || spreadSpec;
    const subGetId = get(key, getId);
    const subId = idGen(subVal, key);
    const subFields = get(key, fields) || spreadFields;
    const subRequired = get(key, required) || spreadRequired;

    const subStore = _extra.specable(
      subVal,
      {
        spec: subSpec,
        id: subId,
        getId: subGetId,
        fields: subFields,
        required: subRequired,
      },
      {
        getAncestor: (n) =>
          n <= 1 || !getAncestor ? ownSpecable : getAncestor(n - 1),
      }
    );

    return [key, { ...subStore, id: subId }];
  };

  let childrenStores = fromEntries(
    [...allKeys].map((key) => createChildEntry(key, get(key, initialValue))),
    collType
  );
  const children = writable(childrenStores);
  const submitting = writable(false);

  const derivedValue = collDerived(childrenStores, ($childrenStores) => {
    const $childrenEntries = entries($childrenStores);
    const $childrenValues = $childrenEntries.map(([key, state]) => [
      key,
      state.value,
    ]);
    const childrenValue = fromEntries($childrenValues, collType);
    const value = isSpread ? childrenValue : merge(collValue, childrenValue);
    ownSpecable.set(value);
    return value;
  });

  const aggregateStatusStores = () => [
    derivedValue,
    submitting,
    ownSpecable,
    ...values(childrenStores),
  ];

  const status = flexDerived(aggregateStatusStores(), ($statusStores) => {
    const [, $submitting, $ownSpecable, ...$children] = $statusStores;

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
      submitting: $submitting,
    };
  });

  function setChildrenStores(newChildrenStores) {
    childrenStores = newChildrenStores;
    children.set(newChildrenStores);
    derivedValue.set(newChildrenStores);
    status.set(aggregateStatusStores());
  }

  function addChildren(coll) {
    if (!coll) return;

    const newEntries = keys(coll).map((key) =>
      createChildEntry(key, get(key, coll))
    );
    const updatedStores = fromEntries(
      [...entries(childrenStores), ...newEntries],
      collType
    );
    setChildrenStores(updatedStores);
  }

  function removeChildrenById(idsToRemove = []) {
    if (idsToRemove.length < 1) return;

    const updatedStores = fromEntries(
      entries(childrenStores).filter(
        ([, store]) => !idsToRemove.includes(store.id)
      ),
      collType
    );
    setChildrenStores(updatedStores);
  }

  function setValue(coll, partial = false) {
    collValue = partial && !isSpread ? merge(collValue, coll) : coll;
    ownSpecable.set(collValue);

    const childrenEntries = entries(childrenStores);

    childrenEntries.forEach(([key, store]) => {
      const newValue = get(key, coll);
      if (partial && newValue === undefined) return;
      store.set(newValue, partial);
    });
    if (!isSpread) return;

    /* If collection allows spread children... */

    /* Add `coll` entries that are not yet part of the children stores. */
    const childrenKeys = keys(childrenStores);
    const missingChildren = fromEntries(
      entries(coll).filter(([key]) => !childrenKeys.includes(key)),
      collType
    );
    addChildren(missingChildren);

    if (partial) return;

    /* If update is not partial, remove children stores that do not store
     * a collection value anymore (garbage collection). */
    const collKeys = keys(coll);
    const unusedIds = childrenEntries.reduce((acc, [key, childStore]) => {
      return collKeys.includes(key) ? acc : [...acc, childStore.id];
    }, []);
    removeChildrenById(unusedIds);
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

  async function submit() {
    if (!onSubmit) return;
    submitting.set(true);
    const valid = await activate();
    if (valid) {
      const currValue = getStoreValue(ownSpecable).value;
      await onSubmit(currValue);
    }
    submitting.set(false);
  }

  return {
    id,
    isRequired,
    spec,
    stores: childrenStores,

    activate,

    add(coll) {
      addChildren(coll);
      return this;
    },

    getChild(path = []) {
      return path.reduce((acc, key) => {
        if (!acc) return null;
        const childStore = get(key, acc);
        return childStore ? childStore.getChildren() : null;
      }, childrenStores);
    },

    getChildren() {
      return childrenStores;
    },

    remove(idsToRemove = []) {
      removeChildrenById(idsToRemove);
      return this;
    },

    reset(newInitialValue = initialValue) {
      setValue(newInitialValue, false);
      activate(false);
      return this;
    },

    set(coll, partial = false, shouldActivate = false) {
      setValue(coll, partial);
      if (shouldActivate) activate();
      return this;
    },

    update: (fn) => {
      setChildrenStores(fn(childrenStores));
      return this;
    },

    children: {
      subscribe: children.subscribe,
    },

    submit,

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
