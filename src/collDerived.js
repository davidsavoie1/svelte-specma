import flexDerived from "./flexDerived";
import { entries, fromEntries, identity, typeOf } from "./util";

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
