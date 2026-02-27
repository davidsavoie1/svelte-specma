import { derived, get as getStoreValue, writable } from "svelte/store";
import { ALWAYS_VALID } from "./constants";
import { countPathAncestors, equals, getPath, keepForwardPath } from "./util";
import collDerived from "./collDerived";
import { specma, ensureConfigured } from "./configure";
import writableByValue from "./writableByValue";

const alwaysTrue = () => true;
const isMissing = (x) => [undefined, null, ""].includes(x);
const defaultChangePred = (a, b) => !equals(a, b);

const reqSpec = (x) => !isMissing(x) || specma.getMessage("isRequired");

/**
 * Create a predicate spec-aware Svelte store for a single value.
 *
 * The store validates a primitive or non-collection value against a Specma
 * predicate spec and exposes helper methods like `.activate()`, `.set()`,
 * `.reset()` and `.submit()`.
 *
 * @param {any} initialValue - initial value to validate
 * @param {Object} [options]
 * @param {Function} [options.changePred] - (a,b)=>boolean, determines changed state
 * @param {any} [options.id] - optional identifier
 * @param {boolean} [options.required] - is value required
 * @param {any} [options.spec] - Specma spec (predicate)
 * @param {Function} [options.onSubmit] - optional submit handler
 * @param {Object} [_extra] - internal helpers (e.g. getAncestor)
 * @returns {import('svelte/store').Readable}
 */
export default function predSpecable(
  initialValue,
  { changePred = defaultChangePred, id, required, spec, onSubmit } = {},
  _extra = {}
) {
  ensureConfigured();
  const { and, getPred, validatePred } = specma;

  const { getAncestor } = _extra;
  const pred = getPred(spec) || alwaysTrue;
  const isRequired = !!required;
  const ownSpec = isRequired ? and(reqSpec, pred) : pred;

  const contextStores = {};
  const context = collDerived(contextStores);

  function addContext(relPath) {
    /* If `getFrom` has already been called once,
     * context store is already tracking the value. */
    if (contextStores[relPath]) return;

    const ancestor = getAncestor(countPathAncestors(relPath));
    if (!ancestor) return;

    const pathSinceAncestor = keepForwardPath(relPath);

    contextStores[relPath] = derived(ancestor, ($ancestor, set) => {
      const ancestorValue = $ancestor.value;
      if (!ancestorValue) return;

      const curr = contextStores[relPath].value;
      const next = getPath(pathSinceAncestor, ancestorValue);
      if (!equals(curr, next)) {
        contextStores[relPath].value = next;
        set(next);
      }
    });
    context.set(contextStores);

    /* If context has just been created, it won't be accessible
     * in the derived store at first.
     * In that case, return the static store value. */
    return getPath(pathSinceAncestor, getStoreValue(ancestor).value);
  }

  let currPromise;
  let _initialValue = initialValue;

  const active = writable(false);
  const submitting = writable(false);
  const value = writableByValue(_initialValue);

  const store = derived(
    [active, value, context, submitting],
    ([$active, $value, $context, $submitting], set) => {
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
        changePred,
        initialValue: _initialValue,
        id,
        result,
        submitting: $submitting,
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

  async function activate(bool = true) {
    active.set(bool);
    // Let derived subscribers run before reading currPromise
    await Promise.resolve();
    const res = await currPromise;
    return res.valid;
  }

  async function submit() {
    if (!onSubmit) return;
    submitting.set(true);
    try {
      const valid = await activate();
      if (!valid) return false;

      const currValue = getStoreValue(value);
      await onSubmit(currValue, mainStore);
      return true;
    } finally {
      submitting.set(false);
    }
  }

  const mainStore = {
    id,
    isRequired,
    spec: pred,

    activate,

    reset(newValue = _initialValue) {
      _initialValue = newValue;
      this.activate(false);
      this.set(newValue);
    },

    set: (newValue, shouldActivate = false) => {
      value.set(newValue);
      if (shouldActivate) activate();
    },

    submit,

    subscribe: store.subscribe,
  };

  return mainStore;
}

function enhanceResult(res) {
  return {
    ...res,
    promise: res.promise
      ? res.promise.then((promised) => enhanceResult(promised))
      : Promise.resolve(res),
  };
}

function interpretState({
  active,
  changePred,
  id,
  initialValue,
  result,
  submitting,
  value,
}) {
  const changed = changePred(value, initialValue);
  return {
    active,
    changed,
    error: result.valid === false && result.reason,
    id,
    initialValue,
    promise: result.promise || Promise.resolve(result),
    submitting,
    valid: !!result.valid,
    validating: result.valid === null,
    value: changed ? value : initialValue,
  };
}
