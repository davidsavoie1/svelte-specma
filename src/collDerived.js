import flexDerived from "./flexDerived";
import { entries, fromEntries, identity, typeOf } from "./util";

/**
 * Build a small snapshot of the collection of stores.
 *
 * @param {Object|Array|Map} coll - collection mapping keys -> store
 * @returns {{
 *   coll: (Object|Array|Map),
 *   collType: string,
 *   storesEntries: Array<[any, any]>,
 *   keys: Array<any>,
 *   stores: Array<any>
 * }}
 */
function deriveState(coll) {
  const storesEntries = entries(coll);
  return {
    coll,
    collType: typeOf(coll),
    storesEntries,
    keys: storesEntries.map(([key]) => key),
    stores: storesEntries.map(([, store]) => store),
  };
}

/**
 * collDerived
 *
 * A helper that adapts a dynamic collection of Svelte stores into a single
 * derived store. The key feature is that the collection shape can change
 * over time (stores added/removed); calling `.set(newColl)` updates the
 * internal state so subsequent derived updates subscribe to the new stores.
 *
 * Parameters:
 * - initialColl: a collection (object/array/Map) whose values are Svelte stores
 * - fn: a mapping function => receives an indexed view of the current stores
 *       (object with { coll, collType, storesEntries, keys, stores }) and
 *       should return the derived value. If fn.length >= 2 it is treated as
 *       asynchronous and receives a second `set` callback to update the result.
 * - initialValue: optional initial value for the derived store
 *
 * Returns an object with:
 * - subscribe(fn): subscribe to derived values
 * - set(newColl): replace the tracked collection so derived subscriptions
 *                  will follow the new set of stores
 */
function collDerived(initialColl, fn = identity, initialValue) {
  let state = deriveState(initialColl);

  /* The callback passed to `flexDerived` can have arity 1 or 2.
   * The arity should match the one of the provided function.
   * When using arity 2, a set function is provided so that
   * result can be used asynchronously */
  const auto = fn.length < 2;
  const index$stores = ($stores) =>
    fromEntries(
      $stores.map((store, idx) => [state.keys[idx], store]),
      state.collType
    );

  const values = flexDerived(
    state.stores,
    auto
      ? ($stores) => fn(index$stores($stores))
      : ($stores, _set) => fn(index$stores($stores), _set),
    initialValue
  );

  function set(newColl) {
    state = deriveState(newColl);
    values.set(state.stores);
  }

  return {
    set,
    subscribe: values.subscribe,
  };
}

export default collDerived;
