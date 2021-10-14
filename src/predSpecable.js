import { tick } from "svelte";
import { derived, get as getStoreValue, writable } from "svelte/store";
import { ALWAYS_VALID } from "./constants";
import { countPathAncestors, equals, getPath, keepForwardPath } from "./util";
import collDerived from "./collDerived";
import { specma, ensureConfigured } from "./configure";

const alwaysTrue = () => true;
const isMissing = (x) => [undefined, null, ""].includes(x);
const defaultChangePred = (a, b) => !equals(a, b);

const reqSpec = (x) => !isMissing(x) || specma.getMessage("isRequired");

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
        changePred,
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

  async function activate(bool = true) {
    active.set(bool);
    await tick();
    const res = await currPromise;
    return res.valid;
  }

  async function submit() {
    if (!onSubmit) return;
    submitting.set(true);
    const valid = await activate();
    if (valid) {
      const currValue = getStoreValue(value);
      await onSubmit(currValue);
    }
    submitting.set(false);
  }

  return {
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
    valid: !!result.valid,
    validating: result.valid === null,
    value: changed ? value : initialValue,
  };
}
