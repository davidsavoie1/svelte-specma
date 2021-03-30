import { writable } from "svelte/store";
import equals from "fast-deep-equal";

/* Limited version of `writable` store that updates only
 * if the new set value is different by value (deep equality) */
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
