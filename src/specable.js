import collSpecable from "./collSpecable";
import predSpecable from "./predSpecable";
import { isColl, isStore } from "./util";

/**
 * specable
 *
 * Convenience factory that returns a spec-aware Svelte store for the given
 * initial value. It chooses between a collection-aware store (collSpecable)
 * and a predicate/value store (predSpecable) based on the inputs.
 *
 * Behaviour:
 * - If `initialValue` is already a Svelte store, it is returned unchanged.
 * - If `options.fields` or `options.spec` (or the `initialValue` itself)
 *   look like a collection, `collSpecable` is used.
 * - Otherwise `predSpecable` is used for single-value (primitive/non-collection)
 *   validation.
 *
 * Parameters:
 * - initialValue: any initial value for the store (can be undefined)
 * - options: configuration object forwarded to the chosen factory
 * - _extra: internal helpers (used for recursion when collSpecable needs to
 *           create nested specable stores)
 *
 * Returns:
 * - a Svelte store implementing the specable API (either collSpecable or predSpecable)
 *
 * Example:
 * import { specable } from "svelte-specma";
 * const s1 = specable({ a: 1 }, { spec: { a: v => !v && "err" } });
 * const s2 = specable(42, { spec: v => v === 42 || "must be 42" });
 */
export default function specable(initialValue, options = {}, _extra) {
  if (isStore(initialValue)) return initialValue;

  const collCandidate = options.fields || options.spec || initialValue;

  if (isColl(collCandidate)) {
    return collSpecable(initialValue, options, { ..._extra, specable });
  }

  return predSpecable(initialValue, options, _extra);
}
