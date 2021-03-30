import { readable, writable } from "svelte/store";

const identity = (x) => x;
const noop = () => {};

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
