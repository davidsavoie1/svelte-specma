# Svelte-Specma

Svelte-Specma is a Svelte store used to do client-side validation using the very powerful [Specma](https://www.npmjs.com/package/specma) library.

- Collection specs defined with the exact **same shape as the value**!
- Based on **predicate functions** of type `true || "reason"`
- **Composable specs** with intuitive `and`/`or` operators
- Easy **cross-validation** between multiple fields
- User defined **customized invalid reasons**
- **Async validation** out of the box
- Very **small footprint**

# Design considerations

## Spec design

You should first get familiar with the Specma way of [defining a spec](https://davidsavoie1.github.io/specma/#/gettingStarted?id=predicate-spec). All valid Specma specs will work fine with Svelte-Specma, including async validation, spec composition and cross-fields validation with `getFrom` function as second predicate argument. Specs can hence be reused in a variety of contexts without redefining them all the time.

Simple composition with possibily nested `and` and `or` allows adding advanced constraints on a base spec, such as calling a remote endpoint asynchronously to check a value availability.

## Requiredness

By design, as in Specma, the requiredness of certain fields is not defined in the spec itself. It is rather is defined at store creation time by passing in a `required` object of the same shape as the value. This allows reusing the same spec in different forms, where only the required fields change, not the predicates themselves.

Values that are `undefined` won't be validated against their spec unless they are specified as required. Also, because Svelte-Specma is mainly used in forms, `null` and `""` are considered as missing when a value is required.

## Svelte integration

Svelte-Specma uses Svelte stores to manage state and validation. It is not tied to any particular component, although it might make sense for you to eventually design components to reduce boilerplate code (updating store value, activating on input blur, displaying loading or error messages, etc.).

# `configure` - Before using!

Since Specma relies on some Javascript Symbols to define specs, Svelte-Specma must use the same instance of the Spec library. **It must hence be configured once prior to usage**.

```js
import * as specma from "specma";
import { configure } from "svelte-specma";

configure(specma);
```

# `specable`

Main entry point and **preferred way for defining a specable store**. Will dispatch to `collSpecable` or `predSpecable` based on its arguments (based on spec's shape first, then initial value's shape) to eventually produce a deeply nested store.

## Inputs

```js
const store = specable(initialValue, { spec, ...rest });
```

- `initialValue`: Any. The initial value to validate against the spec.

- `spec`: Any. The Specma spec to validate against.

- `...rest`: Object. See `collSpecable` and `predSpecable` details below.

## Output

Either a [`collSpecable`](#collSpecable) or [`predSpecable`](#predSpecable) store (see below).

# `predSpecable`

A Svelte store used to validate a value against the predicate function part of a Specma spec.

```js
/* Will create a `predSpecable` store, since initial value is not a collection */
const store = specable(
  30, // Initial value
  {
    spec: (v) => v === 42 || "is not the answer",
    required: false,
    id: "someId",
  }
);

/* Static properties and methods */
const { id, isRequired, spec, activate, reset, set, subscribe } = store;

/* Subscription state values */
$: ({ value, active, changed, valid, validating, error, promise, id } = $store);
```

## Inputs

- `initialValue`: Any. The initial value to validate, saved in internal state
- `spec`: Any. The Specma spec. Only the predicate function part of the spec is used in a `predSpecable`, so a compound value (object, array, etc.) won't validate its children spec. To do so, use a `collSpecable` instead.
- `required`: Boolean. If a value is required, must be different than `undefined`, `null` or `""`; will return the Specma `isRequired` message otherwise. False by default.
- `id`: Any. Used to uniquely identify the store. Mainly useful for values part of a list.

## Outputs

- `id`: Any. A pass-through of the store's creation `id`.

- `isRequired`: Boolean. Is the store value required? Based on the `required` creation argument.

- `spec`: The predicate function used to derive a validation result.

- `activate`: Async function. `(Boolean = true) => Promise`. Method to de/activate the store validation. If set to true, will immediately trigger validation and return a promise that resolves to the `valid` result property.

- `reset`: Function. `(Any = initialValue) => undefined`. Reset the store to a new initial value (or the initial one if no argument) and deactivate the store.

- `set`: Function. `(Any) => undefined`. Set the store's internal value to a new one. Will trigger validation if store is active.

- `subscribe`: Function. `(fn) => unsubscribe`. The Svelte store's subscribe method. Usually used in Svelte components with a reactive autosubscription declaration (`$: storeState = $store`). The function argument will be called with the updated internal state (see below) each time it changes. Returns an unsubscribe function that can be called when component unmounts to prevent memory leaks.

  - `value`: Any. The internal state value, which can be modified with the store's methods.

  - `active`: Boolean. Is the store currently active? Default to `false`.

  - `changed`: Boolean. Is the value different (value based deep-equality) from the initial value?

  - `valid`: Boolean. Is the value valid when checked against spec? Always `true` when store is not active. `false` if the store is validating asynchronously until a firm result is available.

  - `validating`: Boolean. Is the store currently validating asynchronously?

  - `error`: Any. Description of the error. Usually a string, but any value different than `true` returned from a predicate function validation.

  - `promise`: A promise of the validation result that resolves when asynchronous validation is completed. Property is always set even if result is synchronously available to allow waiting for resolution in any case.

  - `id`: Any. A pass-through of the store's creation `id`.

# `collSpecable`

A Svelte store used to validate a collection value (array, object, Map) against a Specma spec, including its children.

The initial value is only used to generate all initial children specable stores, but the store's value is then derived from the values of those children stores. The `set` method actually sets the values of the underlying children stores.

A `collSpecable` offers methods to modify its children specable stores : `add`, `remove`, `update`.

### Spec definition

```js
import { and, spread } from "specma";

/* The spec could be shared between client and server */
const baseSpec = {
  name: (v = "") => v.length > 5 || "must be longer than 5 characters",
  list: spread({
    x: and(
      (v) => typeof v === "number" || "must be a number",
      (v) => v < 100 || "must be less than 100"
    ),
    y: (v) => ["foo", "bar"].includes(v) || "is not an acceptable choice",
  }),
};
```

### Usage with Svelte-Specma

```js
import { and, spread } from "specma";

/* Client could enhanec the base spec to add further validation (async in this case) */
const enhancedSpec = and({
  name: async (v = "") => await checkNameIsUnique(v),
});

/* Will create a `collSpecable` store, since initial value is a collection */
const store = specable(
  { name: "Foo", list: [{ id: "1234", x: 20, y: "abc", z: null }] }, // initialValue
  {
    spec: enhancedSpec,
    required: { name: 1, list: spread({ x: 1 }) },
    fields: { name: 1, list: spread({ x: 1, y: 1, z: 1 }) },
    getId: { list: ({ id }) => id },
    id: "myColl",
  }
);

/* Store static properties and methods */
const {
  id,
  isRequired,
  spec,
  activate,
  add,
  getChild,
  remove,
  reset,
  set,
  update,
  children,
  stores,
  subscribe,
} = store;

/* Store subscription internal state values */
$: ({
  value,
  active,
  changed,
  valid,
  validating,
  error,
  errors,
  collErrors,
  promise,
  id,
} = $store);
```

## Inputs

- `initialValue`: Collection. The initial value that will generate all initial specable stores.

- `spec`: Collection. The Specma spec.
- `required`: Collection. A deeply nested collection description of the required fields. Requiredness is defined at the root store to keep specs more reusable.
- `fields`: Collection. A deeply nested collection description of which fields to expect, that will ensure that those fields are defined as children specable stores. Undeclared field values will be treated as constant and won't be displayed as children stores.
- `getId`: Collection. A deeply nested collection description of how a subcollection should define the `id` of its children. Can be defined the same way as a spec (with `and`, `spread`, etc.), where the predicate function of a level has the shape `(value, key) => id`. If no function is provided, array items' store will be assigned a unique random id, while objects will use their key as id.
- `id`: Used to uniquely identify the store. Mainly useful for values part of a list.

## Outputs

- `id`: Any. A pass-through of the store's creation `id`.

- `isRequired`: Boolean. Is the store value required? Based on the `required` creation argument.

- `spec`: Any. A pass-through of the store's creation spec.

- `activate`: Async function. `(Boolean = true) => Promise`. Method to de/activate the store validation, including all its children stores. If set to true, will immediately trigger validation and return a promise that resolves to the `valid` result property.

- `add`: Function. `(coll) => store`. Method to add new children specable stores. Argument should be declared as a collection of the same type as the store's value. Returns the store for chaining.

- `getChild`: Function. `(path = []) => store`. Method to retrieve a deeply nested child store from a path of keys (not ids) such as `["students", 0, "name"]`. Returns `null` if no store found.

- `getChildren`: Function. `() => storesCollection`. Method to retrieve the current collection of children stores without having to subscribe to the `children` substore. Unlike the `stores` property, the return value of this method will be current each time it is called.

- `remove`: Function. `(idsToRemove) => store`. Method to remove children specable stores. Will remove stores by their id. Returns the store for chaining.

- `set`: Function. `(coll, partial = false) => store`. Method to recursively set the values of the collection's underlying stores. If `partial = true`, sets only the values that are not `undefined`. Returns the store for chaining.

- `update`: Function. `(fn) => store`. Method to modify the children specable stores collection by applying a function to it that returns a modified children stores collection. Useful for instance to reorder the children based on their id. Returns the store for chaining.

- `children`: Svelte readable store. A store that holds a reactive collection of the children specable stores that compose the collection. Subscribe to it to watch changes to a list of children, where some could be added, removed, reordered, etc.

- `stores`: Collection. Same as `children`, but non-reactive. Useful to destructure children stores that won't change over time, such as the fixed fields in a flat form, without having to subscribe first.

- `subscribe`: Function. Same as `predSpecable`, but with added state properties, listed below.

  - `error`: Any. The collection's own predicate spec error result.

  - `errors`: Array. Array of `[{ error, path, which, isColl }]` containing all error descriptions. Useful to display all errors in a centralized location on a form, for instance.

    - `error`: Any. Description of the error.
    - `path`: Array. List of the complete path from root to error node.
    - `which`: String. Same as `path`, but joined with dots to form a string. Useful to lookup predefined captions in a dictionnary.
    - `isColl`: Boolean. Indicates if the error is on a collection value.

  - `collErrors`: Array. Same as `errors`, but containing only the errors with the `isColl` flag. Useful to display collection errors in a central location, while primitive field errors are displayed near their input in a form, for instance.

# `register`

The `register` function facilitates usage of the [`predSpecable`](#predSpecable) store in conjunction to a form input. It is designed to be used with the `use:register` directive:

```svelte
<input use:register="{predSpecableStore}" />
```

Doing so will:

- update the store's value on input;
- update the input on store value change;
- activate the store on input blur;
- remove all listeners and subscriptions when input is unmounted.

If the expected value's type is not the same as the HTML input's one (if validation expects an number or a JS Date instance, for example), `use:register` can be used with a list of arguments where the second one is an object with keys `{ toInput, toValue }`:

- `toInput`: Function. `(value) => htmlInputValue`;
- `toValue`: Function. `(htmlInputValue) => value`;

For example, if the expected value is a number, it could be used like so:

```svelte
<input
  use:register="{[predSpecableStore, { toValue: (x) => x && +x }]}"
/>
```

In any other case, the store should be used explicitely:

```svelte
<input
  value={$age.value}
  on:input={(e) => age.set(+e.target.value)}
  on:blur={() => age.activate()}
/>
```
