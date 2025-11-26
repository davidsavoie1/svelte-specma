import { readable, writable } from "svelte/store";

/**
 * Minimal helpers
 * @private
 */
const identity = (x) => x;
const noop = () => {};

/**
 * flexDerived
 *
 * Create a derived-like Svelte store from a dynamic list of input stores.
 * Unlike Svelte's built-in derived, this helper allows the set of source
 * stores to change over time (stores can be added/removed). It exposes
 * control methods to update the tracked stores and keeps a readable store
 * for subscribers that publishes the combined result.
 *
 * Behaviour:
 * - `fn` receives an array of source values in the order of the tracked stores.
 * - If `fn.length < 2` (arity 1) its return value is published directly.
 * - If `fn.length >= 2` (arity 2) `fn` is called with (values, publish) and may
 *   call `publish` asynchronously; its return value may be a cleanup function.
 *
 * Parameters:
 * - initialStores: Array of Svelte stores to subscribe to initially.
 * - fn: mapping function (values) => result OR (values, publish) => (cleanup|void)
 * - initialValue: optional initial published value
 *
 * Return value (object):
 * - subscribe(fn): subscribe to derived values (Svelte readable contract)
 * - include(...stores): add stores to the tracked set
 * - exclude(...stores): remove stores from the tracked set
 * - set(newStoresArray): replace the tracked set of stores
 * - update(fn): update the tracked set using fn(prev) => next
 * - stores: internal writable store holding the current list of tracked stores
 *
 * Example:
 * const derived = flexDerived([storeA, storeB], (values) => values.join("-"), "");
 * derived.subscribe(v => console.log(v));
 * derived.include(storeC);
 *
 * Notes:
 * - The implementation ensures ordering of values matches the tracked store order.
 * - When no subscribers remain the helper unsubscribes from all source stores.
 */
function flexDerived(initialStores = [], fn = identity, initialValue) {
  /* Used for ordering values */
  let _stores = initialStores;
  /* Store of stores. When last subscriber unsubscribes,
   * will stop all stores subs. */
  const $stores = writable(initialStores);

  /* Callback function can use a second argument, a `publish` function to set result asynchronously.
   * If not used, the return value of the function is the actual result to publish.
   * Otherwise, the return value might be a function to call before each execution
   * and when store is unsubscribed. */
  const auto = fn.length < 2;

  /* Use a readable store to manage subscribers. */
  const mainStore = readable(initialValue, (publish) => {
    let initialized = false;

    let cleanup = noop;
    let pending = 0;
    let unsubs = new Map();
    let values = new Map();

    /* Unsubscribe saved stores not included in a new list of stores
     * and create a new Map of unsub by store, reusing old ones when they exist. */
    function updateUnsubs(stores = []) {
      stopUnusedSubs(stores);
      unsubs = new Map(stores.map((store) => [store, unsubs.get(store)]));
    }

    function stopUnusedSubs(usedStores = []) {
      unsubs.forEach((unsub, store) => {
        if (!usedStores.includes(store) && unsub) unsub();
      });
    }

    function stopSubscriptions() {
      unsubs.forEach((unsub) => unsub && unsub());
    }

    /* Create a new map of values by store, reusing old ones when they exist. */
    function updateValues(stores = []) {
      values = new Map(stores.map((store) => [store, values.get(store)]));
    }

    /* Recompute and publish the combined result on values,
     * using `_stores` to ensure values order consistency. */
    function sync() {
      if (pending) return;
      cleanup();
      const vals = _stores.reduce(
        (acc, store) => (values.has(store) ? [...acc, values.get(store)] : acc),
        []
      );
      const result = fn(vals, publish);

      if (auto) {
        publish(result);
      } else {
        cleanup = typeof result === "function" ? result : noop;
      }
    }

    const unsubscribe = $stores.subscribe((stores) => {
      updateUnsubs(stores);
      updateValues(stores);

      /* Subscribe to each store if not alreay done.
       * When a any store value changes,
       * combined result will be updated and published. */
      _stores = [];
      stores.forEach((store, i) => {
        _stores[i] = store;

        if (!unsubs.get(store)) {
          unsubs.set(
            store,
            store.subscribe(
              (value) => {
                values.set(store, value);
                pending &= ~(1 << i);
                if (initialized) sync();
              },
              () => {
                pending |= 1 << i;
              }
            )
          );
        }
      });
      if (initialized) sync();
    });

    initialized = true;
    sync();

    return function stop() {
      unsubscribe();
      stopSubscriptions();
      cleanup();
    };
  });

  /* Exclude one or mode stores from the list. */
  function exclude(...stores) {
    $stores.update((prev) => prev.filter((store) => !stores.includes(store)));
  }

  /* Include one or more stores into the list. */
  function include(...stores) {
    $stores.update((prev) => [...prev, ...stores]);
  }

  return {
    exclude,
    include,
    set: $stores.set,
    stores: $stores,
    subscribe: mainStore.subscribe,
    update: $stores.update,
  };
}

export default flexDerived;
