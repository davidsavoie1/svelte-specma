import { writable } from "svelte/store";
import equals from "fast-deep-equal";

/**
 * Writable store that avoids updates when new value is deep-equal to current.
 *
 * This is a limited version of Svelte's `writable` that performs a deep value
 * equality check before calling the underlying store `set`, preventing
 * unnecessary subscriber notifications and derived recomputations.
 *
 * @param {any} initialValue - initial store value
 * @param {...any} rest - additional args forwarded to `writable`
 * @returns {{ set: (newValue:any) => void, subscribe: import('svelte/store').Subscriber }}
 */
export default function wriableByValue(initialValue, ...rest) {
  let _value = initialValue;
  const store = writable(initialValue, ...rest);
  return {
    set(newValue) {
      if (equals(newValue, _value)) return;
      _value = newValue;
      store.set(_value);
    },
    subscribe: store.subscribe,
  };
}
