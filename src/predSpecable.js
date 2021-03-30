import { derived, get, writable } from "svelte/store";
import { and, getMessage, getPred, validatePred } from "specma";
import { ALWAYS_VALID } from "./constants";
import { equals, getFromValue } from "./util";
import collDerived from "./collDerived";

const reqSpec = (x) =>
  ![undefined, null, ""].includes(x) || getMessage("isRequired");

export default function predSpecable(
  initialValue,
  { id, required, spec } = {},
  _extra = {}
) {
  const { path, rootValueStore = writable(undefined) } = _extra;
  const pred = getPred(spec);
  const isRequired = !!required;
  const ownSpec = isRequired ? and(reqSpec, pred) : pred;

  const contextStores = {};
  const context = collDerived(contextStores);

  function addContext(relPath) {
    /* If `getFrom` has already been called once,
     * context store is already tracking the value. */
    if (contextStores[relPath]) return;

    contextStores[relPath] = derived(rootValueStore, (root, set) => {
      const curr = contextStores[relPath].value;
      const next = getFromValue(relPath, path, root);
      if (!equals(curr, next)) {
        contextStores[relPath].value = next;
        set(next);
      }
    });
    context.set(contextStores);

    /* If context has just been created, it won't be accessible
     * in the derived store at first.
     * In that case, return the static store value. */
    return getFromValue(relPath, path, get(rootValueStore));
  }

  let currPromise;
  let _initialValue = initialValue;

  const active = writable(false);
  const value = writable(_initialValue);

  const store = derived(
    [active, value, context],
    ([$active, $value, $context], set) => {
      currPromise = undefined;

      function getFrom(relPath) {
        if (!contextStores[relPath]) {
          return addContext(relPath);
        }
        return $context[relPath];
      }

      const result = $active
        ? enhanceResult(validatePred(ownSpec, $value, getFrom))
        : ALWAYS_VALID;

      const baseArgs = {
        active: $active,
        initialValue: _initialValue,
        id,
        result,
        value: $value,
      };

      currPromise = result.promise;

      set(interpretState(baseArgs));

      if (result.valid === null) {
        result.promise.then((resolvedResult) => {
          /* Promise might be outdated */
          if (result.promise !== currPromise) return;

          set(interpretState({ ...baseArgs, result: resolvedResult }));
        });
      }
    }
  );

  return {
    id,
    isRequired,
    spec: pred,

    activate(bool = true) {
      active.set(bool);
      return currPromise && currPromise.then((res) => res.valid);
    },

    reset(newValue = _initialValue) {
      _initialValue = newValue;
      this.activate(false);
      this.set(newValue);
    },

    set: value.set,

    subscribe: store.subscribe,
  };
}

function enhanceResult(res, { path, value } = {}) {
  const enhanced =
    res.valid === false
      ? {
          ...res,
          failedPath: res.failedPath || path,
          failedValue: res.failedValue || value,
          value,
        }
      : res;

  const promise = res.promise
    ? res.promise.then((promised) => enhanceResult(promised, { value }))
    : Promise.resolve(enhanced);

  return { ...enhanced, promise };
}

function interpretState({ active, id, initialValue, result, value }) {
  return {
    active,
    changed: !equals(value, initialValue),
    error: result.valid === false && result.reason,
    id,
    promise: result.promise || Promise.resolve(result),
    valid: !!result.valid,
    validating: result.valid === null,
    value: value,
  };
}
