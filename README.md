# svelte-specma

Svele-Specma is a Svelte store used to do client-side validation using the very powerful Specma library.

# `specable`

Main entry point for defining a specable store.

## Output

A Svelte store with these properties:

-

# `predSpecable`

A Svelte store used to validate a value against the predicate function part of a Specma spec.

## Inputs

```js
const store = predSpecable(initialValue, {
  spec,
  required: false,
  id: "someId",
});
```

- `initialValue`: The initial value to validate, saved in internal state
- `spec`: The Specma spec. Only the predicate function part of the spec is used in a `predSpecable`, so a compound value (object, array, etc.) won't validate its children spec. To do so, use a `collSpecable` instead.
- `required`: False by default. By design in Specma, specs are usually not prescribing the requiredness of values by themselves. The validation call typically specifies which selection is required. In Svelte-Specma, the requiredness is defined at store creation time, so the spec still isn't tied to a specific requiredness.
- `id`: Used to uniquely identify the store. Mainly useful for values part of a list.

## Outputs

```js
/* Store static properties and methods */
const { id, isRequired, spec, activate, reset, set, subscribe } = store;

/* Store subscription internal state values */
$: ({ value, active, changed, valid, validating, error, promise, id } = $store);
```

- `subscribe`: Function. `(fn) => unsubscribe`. The Svelte store's subscribe method. Usually used in Svelte components with a reactive autosubscription declaration (`$: storeState = $store`). The function argument will be called with the updated internal state (see below) each time it changes. Returns an unsubscribe function that can be called when component unmounts to prevent memory leaks.

  - `value`: Any. The internal state value, which can be modified with the store's methods.

  - `active`: Boolean. Is the store currently active? Default to `false`.

  - `changed`: Boolean. Is the value different (value based deep-equality) from the initial value?

  - `valid`: Boolean. Is the value valid when checked against spec? Always `true` when store is not active. `false` if the store is validating asynchronously until a firm result is available.

  - `validating`: Boolean. Is the store currently validating asynchronously?

  - `error`: Any. If value is invalid, validation should have returned any value different than `true` with a short-circuit evaluation. Typically a string representing the error description.

  - `promise`: A promise of the validation result that resolves when asynchronous validation is completed. Property is always set even if result is synchronously available to allow waiting for resolution in any case.

  - `id`: Any. A pass-through of the store's creation `id`.

- `set`: Function. `(Any) => undefined`. Set the store's internal value to a new one. Will trigger validation if store is active.

- `activate`: Function. `(Boolean = true) => Promise`. Method to de/activate the store validation. If set to true, will immediately trigger validation and return the promised result.

- `reset`: Function. `(Any = initialValue) => undefined`. Reset the store to a new initial value (or the initial one if no argument) and deactivate the store.

- `id`: Any. A pass-through of the store's creation `id`.

- `isRequired`: Boolean. Is the store value required? Based on the `required` creation argument.

- `spec`: The predicate function used to derive a validation result.
