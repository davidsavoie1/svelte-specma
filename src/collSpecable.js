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
  { changePred, fields, getId, id, required, spec, onSubmit } = {},
  _extra = {}
) {
  ensureConfigured();
  const { getPred, getSpread, isOpt } = specma;

  let collValue = initialValue; // For static properties
  let isUndef = collValue === undefined;

  const { getAncestor } = _extra;
  const collDefiner = [fields, spec, initialValue].find(isColl);
  const collType = typeOf(collDefiner);
  const isRequired = required && !isOpt(required);
  const spreadGetId = getSpread(getId);
  const spreadSpec = getSpread(spec);
  const spreadFields = getSpread(fields);
  const spreadRequired = getSpread(required);
  const isSpread =
    spreadSpec ||
    spreadFields ||
    spreadRequired ||
    spreadGetId ||
    collType === "array";

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

  const ownSpecable = predSpecable(
    initialValue,
    {
      changePred: getPred(changePred),
      id,
      required: isRequired,
      spec,
    },
    _extra
  );

  const createChildEntry = (key, val) => {
    const subChangePred = get(key, changePred) || getSpread(changePred);
    const subVal = val;
    const subSpec = get(key, spec) || spreadSpec;
    const subGetId = get(key, getId) || spreadGetId;
    const subId = idGen(subVal, key);
    const subFields = get(key, fields) || spreadFields;
    const subRequired = get(key, required) || spreadRequired;

    const subStore = _extra.specable(
      subVal,
      {
        spec: subSpec,
        changePred: subChangePred,
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
    if (isUndef) return undefined;

    const $childrenEntries = entries($childrenStores);
    const $childrenValues = $childrenEntries.map(([key, state]) => [
      key,
      state.value,
    ]);
    const childrenValue = fromEntries($childrenValues, collType);
    const value = isSpread ? childrenValue : merge(collValue, childrenValue);
    isUndef = value === undefined;
    return value;
  });

  const aggregateStatusStores = () => [
    submitting,
    ownSpecable,
    ...values(childrenStores),
  ];

  const status = flexDerived(aggregateStatusStores(), ($statusStores) => {
    const [$submitting, $ownSpecable, ...$children] = $statusStores;

    const combined = isUndef
      ? $ownSpecable
      : [$ownSpecable, ...$children].reduce(combineChildren);

    if (combined.active !== false) ownSpecable.activate();

    const { value, error } = $ownSpecable;

    const details = Object.fromEntries([
      ["_", $ownSpecable],
      ...(isUndef ? [] : $children.map((child) => [child.id, child])),
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

  function setValue(coll, { partial = false, reset = false } = {}) {
    const setMethod = reset ? "reset" : "set";
    collValue = !reset && partial && !isSpread ? merge(collValue, coll) : coll;
    isUndef = collValue === undefined;
    ownSpecable[setMethod](collValue);

    const childrenEntries = entries(childrenStores);

    childrenEntries.forEach(([key, store]) => {
      const newValue = get(key, coll);
      if (partial && newValue === undefined) return;
      store[setMethod](newValue, partial);
    });
    if (!isSpread) return;

    /* If collection allows spread children... */

    /* Add `coll` entries that are not yet part of the children stores. */
    const childrenKeys = keys(childrenStores);
    const missingChildrenEntries = entries(coll).filter(
      ([key]) => !childrenKeys.includes(key)
    );
    if (missingChildrenEntries.length > 0) {
      addChildren(fromEntries(missingChildrenEntries, collType));
    }

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
    const storesToActivate = [
      ownSpecable,
      ...(isUndef ? [] : values(childrenStores)),
    ];
    const promises = storesToActivate.map((store) => {
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
      if (coll !== undefined) isUndef = false;
      addChildren(coll);
      return this;
    },

    getChild(path = []) {
      const reduced = path.reduce(
        (acc, key) => {
          const { children } = acc;
          if (!children) return { res: null };
          const childStore = get(key, children);
          if (!childStore) return { res: null };
          return {
            res: childStore,
            children: childStore.getChildren ? childStore.getChildren() : [],
          };
        },
        { children: childrenStores }
      );
      return reduced.res;
    },

    getChildren() {
      return childrenStores;
    },

    remove(idsToRemove = []) {
      removeChildrenById(idsToRemove);
      return this;
    },

    reset(newInitialValue = initialValue) {
      setValue(newInitialValue, { reset: true });
      activate(false);
      return this;
    },

    set(coll, partial = false, shouldActivate = false) {
      setValue(coll, { partial });
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

    subscribe: (fn) => {
      const unsub1 = derivedValue.subscribe((value) => ownSpecable.set(value));
      const unsub2 = status.subscribe(fn);
      return () => {
        unsub1();
        unsub2();
      };
    },
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
