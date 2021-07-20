import { tick } from "svelte";
import { derived, get, writable } from "svelte/store";
import { ALWAYS_VALID } from "./constants";
import { equals, getFromValue } from "./util";
import collDerived from "./collDerived";
import { specma, ensureConfigured } from "./configure";

const alwaysTrue = () => true;
const isMissing = (x) => [undefined, null, ""].includes(x);

const reqSpec = (x) => !isMissing(x) || specma.getMessage("isRequired");

export default function predSpecable(
  initialValue,
  { id, required, spec } = {},
  _extra = {}
) {
  ensureConfigured();
  const { and, getPred, validatePred } = specma;

  const { path, rootValueStore = writable(undefined) } = _extra;
  const pred = getPred(spec) || alwaysTrue;
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

      const shouldValidate = $active && ($value !== undefined || required);

      const result = enhanceResult(
        shouldValidate ? validatePred(ownSpec, $value, getFrom) : ALWAYS_VALID
      );
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

    async activate(bool = true) {
      active.set(bool);
      await tick();
      const res = await currPromise;
      return res.valid;
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

function enhanceResult(res) {
  return {
    ...res,
    promise: res.promise
      ? res.promise.then((promised) => enhanceResult(promised))
      : Promise.resolve(res),
  };
}

function interpretState({ active, id, initialValue, result, value }) {
  return {
    active,
    changed: !equals(value, initialValue),
    error: result.valid === false && result.reason,
    id,
    initialValue,
    promise: result.promise || Promise.resolve(result),
    valid: !!result.valid,
    validating: result.valid === null,
    value: value,
  };
}
