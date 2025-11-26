# Svelte-Specma

Svelte-Specma connects Specma predicate specs to Svelte stores to provide small, composable, and predictable client-side validation for forms and arbitrary state. It supports nested/collection shapes, synchronous and asynchronous predicates, custom error messages and easy binding to HTML inputs.

Goals

- Minimal API that maps Specma specs to reactive Svelte stores
- Compose nested validators for objects, arrays and Maps
- Allow cross-field and async validation via Specma
- Small, framework-friendly building blocks (stores + a Svelte action)
- **Share validation specs between client and server** — define once, use everywhere

## Table of Contents

- [Svelte-Specma](#svelte-specma)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Quick setup](#quick-setup)
  - [Concepts in two lines](#concepts-in-two-lines)
  - [Create a store (convenience)](#create-a-store-convenience)
    - [Primitive example (single field)](#primitive-example-single-field)
    - [Collection example (form with nested list)](#collection-example-form-with-nested-list)
  - [Svelte input binding (register)](#svelte-input-binding-register)
  - [Shared Specs (Client \& Server)](#shared-specs-client--server)
    - [Basic Pattern](#basic-pattern)
    - [Client-Side Usage (Svelte)](#client-side-usage-svelte)
    - [Server-Side Usage (Node.js/SvelteKit)](#server-side-usage-nodejssveltekit)
    - [Complex Nested Specs](#complex-nested-specs)
    - [Benefits of Shared Specs](#benefits-of-shared-specs)
  - [API summary](#api-summary)
  - [Real-world patterns](#real-world-patterns)
  - [Tips \& best practices](#tips--best-practices)
  - [Comprehensive Examples](#comprehensive-examples)
    - [Example 1: Simple Login Form with Email and Password Validation](#example-1-simple-login-form-with-email-and-password-validation)
    - [Example 2: User Profile Form with Nested Validation](#example-2-user-profile-form-with-nested-validation)
    - [Example 3: Dynamic List Management (Shopping Cart)](#example-3-dynamic-list-management-shopping-cart)
    - [Example 4: Async Validation (Username Availability Check)](#example-4-async-validation-username-availability-check)
    - [Example 5: Shared Validation (Full Stack)](#example-5-shared-validation-full-stack)

## Installation

```bash
npm install svelte-specma
# or
yarn add svelte-specma
```

## Quick setup

Svelte-Specma delegates predicate operations to a Specma-compatible implementation. Configure the library once at app startup:

```js
import * as specma from "specma"; // or another Specma-compatible lib
import { configure } from "svelte-specma";

configure(specma);
```

This must run before creating any specable stores.

## Concepts in two lines

- `predSpecable`: single-value store that validates a primitive/non-collection value.
- `collSpecable`: collection-aware store (object / array / Map) that composes child specable stores.

## Create a store (convenience)

Use `specable()` — it chooses `predSpecable` or `collSpecable` automatically.

### Primitive example (single field)

```js
import { specable } from "svelte-specma";

const age = specable(0, {
  id: "age",
  required: true,
  spec: (v) =>
    typeof v === "number" && v >= 0 ? true : "must be a non-negative number",
});

// subscribe for UI binding:
age.subscribe((s) => {
  // s.value, s.valid, s.validating, s.error, s.changed, s.active, s.promise, ...
  console.log(s);
});
```

### Collection example (form with nested list)

```js
import { specable } from "svelte-specma";
import { spread } from "specma"; // example usage of Specma helpers

const productSpec = {
  name: (v = "") => (v.length ? true : "required"),
  price: (v) => (typeof v === "number" && v >= 0 ? true : "invalid price"),
};

const catalog = specable(
  { title: "My shop", items: [{ id: "1", name: "Pen", price: 1.5 }] },
  {
    spec: { title: (v) => true, items: spread(productSpec) },
    getId: { items: (item) => item.id }, // id strategy for collection children
    required: { title: 1, items: spread({ name: 1 }) },
  }
);

// add an item programmatically:
catalog.add([{ id: "2", name: "", price: null }]);
```

## Svelte input binding (register)

Use the `register` action to bind a `predSpecable` to an input with optional converters:

Basic usage:

```svelte
<script>
  import { specable, register } from "svelte-specma";
  const name = specable("", { id: "name", spec: (v) => v ? true : "required" });
</script>

<input use:register="{name}" />
```

With converters (e.g. numeric input):

```svelte
<script>
  const age = specable(0, { id: "age", spec: v => typeof v === 'number' || "must be a number" });
  const conv = { toInput: (v) => v == null ? "" : String(v), toValue: (s) => s === "" ? undefined : Number(s) };
</script>

<input use:register="{[age, conv]}" inputmode="numeric" />
```

## Shared Specs (Client & Server)

One of the key advantages of using Specma with Svelte-Specma is the ability to **define validation specs once and reuse them across both client and server**. This ensures consistency, reduces duplication, and makes your codebase more maintainable.

### Basic Pattern

Define your specs in a shared module that can be imported by both client and server code:

```js
// filepath: shared/specs/userSpecs.js
// Shared validation specs - works in both browser and Node.js

export const emailSpec = (v) => {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(v) || "Invalid email address";
};

export const passwordSpec = (v) =>
  v.length >= 8 ? true : "Password must be at least 8 characters";

export const usernameSpec = (v) =>
  v && v.length >= 3 ? true : "Username must be at least 3 characters";

export const ageSpec = (v) =>
  typeof v === "number" && v >= 18 && v <= 120
    ? true
    : "Age must be between 18 and 120";

export const phoneSpec = (v) => /^\d{10}$/.test(v) || "Phone must be 10 digits";
```

### Client-Side Usage (Svelte)

```svelte
<!-- filepath: src/routes/register/+page.svelte -->
<script>
  import { specable, register } from "svelte-specma";
  import { emailSpec, passwordSpec, usernameSpec } from "$lib/shared/specs/userSpecs";

  const email = specable("", { id: "email", required: true, spec: emailSpec });
  const password = specable("", { id: "password", required: true, spec: passwordSpec });
  const username = specable("", { id: "username", required: true, spec: usernameSpec });

  async function handleSubmit() {
    // Activate all fields
    email.activate();
    password.activate();
    username.activate();

    if ($email.valid && $password.valid && $username.valid) {
      // Submit to server
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: $email.value,
          password: $password.value,
          username: $username.value
        })
      });

      if (response.ok) {
        console.log("Registration successful!");
      }
    }
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <input use:register={username} placeholder="Username" />
  {#if $username.active && $username.error}<p class="error">{$username.error}</p>{/if}

  <input use:register={email} type="email" placeholder="Email" />
  {#if $email.active && $email.error}<p class="error">{$email.error}</p>{/if}

  <input use:register={password} type="password" placeholder="Password" />
  {#if $password.active && $password.error}<p class="error">{$password.error}</p>{/if}

  <button type="submit">Register</button>
</form>
```

### Server-Side Usage (Node.js/SvelteKit)

```js
// filepath: src/routes/api/register/+server.js
import { json } from "@sveltejs/kit";
import { conform } from "specma";
import {
  emailSpec,
  passwordSpec,
  usernameSpec,
} from "$lib/shared/specs/userSpecs";

const registrationSpec = {
  email: emailSpec,
  password: passwordSpec,
  username: usernameSpec,
};

export async function POST({ request }) {
  const data = await request.json();

  // Validate using the same specs as the client
  const result = conform(data, registrationSpec);

  if (!result.valid) {
    return json(
      {
        success: false,
        errors: result.problems,
      },
      { status: 400 }
    );
  }

  // Proceed with registration (save to database, etc.)
  // ...

  return json({ success: true });
}
```

### Complex Nested Specs

For more complex scenarios with nested objects and arrays:

```js
// filepath: shared/specs/orderSpecs.js
import { spread } from "specma";

export const orderItemSpec = {
  name: (v) => (v && v.length > 0) || "Product name is required",
  quantity: (v) =>
    (typeof v === "number" && v > 0) || "Quantity must be positive",
  price: (v) => (typeof v === "number" && v >= 0) || "Invalid price",
};

export const shippingAddressSpec = {
  street: (v) => (v && v.length > 0) || "Street is required",
  city: (v) => (v && v.length > 0) || "City is required",
  zipCode: (v) => /^\d{5}$/.test(v) || "Invalid ZIP code",
  country: (v) => (v && v.length > 0) || "Country is required",
};

export const orderSpec = {
  customerEmail: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "Invalid email",
  items: spread(orderItemSpec),
  shippingAddress: shippingAddressSpec,
};
```

**Client usage:**

```svelte
<script>
  import { specable } from "svelte-specma";
  import { orderSpec } from "$lib/shared/specs/orderSpecs";

  const order = specable(
    {
      customerEmail: "",
      items: [],
      shippingAddress: { street: "", city: "", zipCode: "", country: "" }
    },
    {
      spec: orderSpec,
      getId: { items: (item) => item.id },
      required: {
        customerEmail: true,
        items: spread({ name: true, quantity: true, price: true }),
        shippingAddress: { street: true, city: true, zipCode: true, country: true }
      }
    }
  );

  const priceConverter = {
    toInput: (v) => v == null ? "" : String(v),
    toValue: (s) => s === "" ? null : Number(s)
  };

  async function handleSubmit() {
    await order.submit();

    if ($order.valid) {
      console.log("Order submitted:", $order.value);
      // Perform API call here
    } else {
      console.log("Validation errors:", $order.errors);
    }
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <div>
    <label for="customerEmail">Email:</label>
    <input id="customerEmail" type="email" use:register={order.getChild(["customerEmail"])} />
    {#if $order.errors.customerEmail}
      <p class="error">{$order.errors.customerEmail}</p>
    {/if}
  </div>

  <div>
    <label>Items:</label>
    {#each $order.children as itemStore, index}
      {@const item = $order.value[index]}
      <div>
        <input
          placeholder="Product name"
          bind:value={item.name}
          on:blur={() => itemStore.activate()}
        />

        <input
          type="number"
          placeholder="Qty"
          bind:value={item.quantity}
          on:blur={() => itemStore.activate()}
        />

        <input
          type="number"
          step="0.01"
          placeholder="Price"
          bind:value={item.price}
          on:blur={() => itemStore.activate()}
        />

        <button type="button" on:click={() => order.remove([index])}>Remove</button>

        {#if $order.errors[index]}
          <p class="error">{Object.values($order.errors[index]).join(", ")}</p>
        {/if}
      </div>
    {/each}

    <button type="button" on:click={() => order.add([{ id: Date.now(), name: "", quantity: 1, price: 0 }])}>
      Add Item
    </button>
  </div>

  <div>
    <label>Shipping Address:</label>
    <input
      placeholder="Street"
      use:register={order.getChild(["shippingAddress", "street"])}
    />
    {#if $order.errors["shippingAddress.street"]}
      <p class="error">{$order.errors["shippingAddress.street"]}</p>
    {/if}

    <input
      placeholder="City"
      use:register={order.getChild(["shippingAddress", "city"])}
    />
    {#if $order.errors["shippingAddress.city"]}
      <p class="error">{$order.errors["shippingAddress.city"]}</p>
    {/if}

    <input
      placeholder="ZIP Code"
      use:register={order.getChild(["shippingAddress", "zipCode"])}
    />
    {#if $order.errors["shippingAddress.zipCode"]}
      <p class="error">{$order.errors["shippingAddress.zipCode"]}</p>
    {/if}

    <input
      placeholder="Country"
      use:register={order.getChild(["shippingAddress", "country"])}
    />
    {#if $order.errors["shippingAddress.country"]}
      <p class="error">{$order.errors["shippingAddress.country"]}</p>
    {/if}
  </div>

  <button type="submit" disabled={$order.submitting}>
    {$order.submitting ? "Submitting..." : "Submit Order"}
  </button>
</form>
```

**Server usage:**

```js
// filepath: src/routes/api/orders/+server.js
import { conform } from "specma";
import { orderSpec } from "$lib/shared/specs/orderSpecs";

export async function POST({ request }) {
  const data = await request.json();
  const result = conform(data, orderSpec);

  if (!result.valid) {
    return json({ success: false, errors: result.problems }, { status: 400 });
  }

  // Process order...
  return json({ success: true, orderId: "12345" });
}
```

### Benefits of Shared Specs

1. **Single Source of Truth**: Define validation rules once, use everywhere
2. **Consistency**: Client and server always validate the same way
3. **Maintainability**: Changes to validation rules only need to be made in one place
4. **Type Safety**: When using TypeScript, spec definitions can be typed once
5. **Testing**: Write tests for specs once, applicable to both environments
6. **Composability**: Build complex specs from smaller, reusable spec functions

## API summary

- `configure(specma)`: set the Specma implementation (required).
- `specable(initialValue, options)`: factory — returns `predSpecable` or `collSpecable`.
- `predSpecable`: single-value store exposing: `{ subscribe, set, reset, activate, submit, id, isRequired, spec }`.
  - status fields in subscribe payload: `value`, `active`, `changed`, `valid`, `validating`, `submitting`, `error`, `promise`, `id`.
- `collSpecable`: collection-aware store exposing collection helpers:
  - `add`, `remove`, `getChild`, `getChildren`, `update`, `set` (partial/complete), `reset`, `activate`, `submit`.
  - `children`: readable store of child specable stores.
  - subscribe payload contains aggregated status plus `errors` and flattened `errors` list.
- `register`: Svelte action: `use:register` on input elements (or pass `[store, {toInput,toValue}]`).

## Real-world patterns

- **Lazy validation**: create stores inactive by default and call `activate()` on blur or submit.
- **Centralized form submit**: call `submit()` on a `collSpecable` which will activate children and run configured `onSubmit` handlers.
- **Reuse specs between server and client**: define Specma specs once and share them in server validation and Svelte forms.
- **Composable validation**: build complex specs from smaller, reusable spec functions.

## Tips & best practices

- Call `configure(specma)` only once (e.g. in your app entry).
- Use `required` and `fields` options to avoid creating child stores for unneeded fields.
- For lists, supply `getId` so children retain identity across updates.
- Treat `predSpecable.submit` as the place to perform side effects (server calls); it can return a Promise.
- Use `register` for simple inputs — it reduces boilerplate for common cases.
- **Extract specs into shared modules** for reuse across client and server.
- **Use Specma helpers** like `spread()` for working with collections.

## Comprehensive Examples

### Example 1: Simple Login Form with Email and Password Validation

This example demonstrates a basic login form with synchronous validation for email and password fields.

```svelte
<!-- LoginForm.svelte -->
<script>
  import { specable, register } from "svelte-specma";

  const email = specable("", {
    id: "email",
    required: true,
    spec: (v) => {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailPattern.test(v) || "Invalid email address";
    }
  });

  const password = specable("", {
    id: "password",
    required: true,
    spec: (v) => (v.length >= 8 ? true : "Password must be at least 8 characters")
  });

  function handleSubmit() {
    email.activate();
    password.activate();

    if ($email.valid && $password.valid) {
      console.log("Form submitted:", { email: $email.value, password: $password.value });
    }
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <div>
    <label for="email">Email:</label>
    <input id="email" type="email" use:register={email} />
    {#if $email.active && $email.error}
      <p class="error">{$email.error}</p>
    {/if}
  </div>

  <div>
    <label for="password">Password:</label>
    <input id="password" type="password" use:register={password} />
    {#if $password.active && $password.error}
      <p class="error">{$password.error}</p>
    {/if}
  </div>

  <button type="submit">Login</button>
</form>

<style>
  .error { color: red; font-size: 0.875rem; }
</style>
```

### Example 2: User Profile Form with Nested Validation

This example shows a more complex form with nested object validation including cross-field validation.

```svelte
<!-- UserProfileForm.svelte -->
<script>
  import { specable, register } from "svelte-specma";

  const profile = specable(
    {
      username: "",
      age: null,
      contact: {
        email: "",
        phone: ""
      }
    },
    {
      spec: {
        username: (v) => (v && v.length >= 3 ? true : "Username must be at least 3 characters"),
        age: (v) => (typeof v === "number" && v >= 18 && v <= 120 ? true : "Age must be between 18 and 120"),
        contact: {
          email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || "Invalid email",
          phone: (v) => /^\d{10}$/.test(v) || "Phone must be 10 digits"
        }
      },
      required: {
        username: true,
        age: true,
        contact: { email: true }
      }
    }
  );

  const ageConverter = {
    toInput: (v) => v == null ? "" : String(v),
    toValue: (s) => s === "" ? null : Number(s)
  };

  async function handleSubmit() {
    await profile.submit();

    if ($profile.valid) {
      console.log("Profile submitted:", $profile.value);
      // Perform API call here
    } else {
      console.log("Validation errors:", $profile.errors);
    }
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <div>
    <label for="username">Username:</label>
    <input id="username" use:register={profile.getChild(["username"])} />
    {#if $profile.errors.username}
      <p class="error">{$profile.errors.username}</p>
    {/if}
  </div>

  <div>
    <label for="age">Age:</label>
    <input id="age" type="number" use:register={[profile.getChild(["age"]), ageConverter]} />
    {#if $profile.errors.age}
      <p class="error">{$profile.errors.age}</p>
    {/if}
  </div>

  <div>
    <label for="email">Email:</label>
    <input id="email" type="email" use:register={profile.getChild(["contact", "email"])} />
    {#if $profile.errors["contact.email"]}
      <p class="error">{$profile.errors["contact.email"]}</p>
    {/if}
  </div>

  <div>
    <label for="phone">Phone (optional):</label>
    <input id="phone" type="tel" use:register={profile.getChild(["contact", "phone"])} />
    {#if $profile.errors["contact.phone"]}
      <p class="error">{$profile.errors["contact.phone"]}</p>
    {/if}
  </div>

  <button type="submit" disabled={$profile.submitting}>
    {$profile.submitting ? "Submitting..." : "Save Profile"}
  </button>
</form>
```

### Example 3: Dynamic List Management (Shopping Cart)

This example demonstrates managing a dynamic list with add/remove operations and per-item validation.

```svelte
<!-- ShoppingCart.svelte -->
<script>
  import { specable } from "svelte-specma";
  import { spread } from "specma";

  const itemSpec = {
    name: (v) => (v && v.length > 0 ? true : "Product name is required"),
    quantity: (v) => (typeof v === "number" && v > 0 ? true : "Quantity must be positive"),
    price: (v) => (typeof v === "number" && v >= 0 ? true : "Invalid price")
  };

  const cart = specable(
    [],
    {
      spec: spread(itemSpec),
      getId: (item) => item.id,
      required: spread({ name: true, quantity: true, price: true })
    }
  );

  let nextId = 1;

  function addItem() {
    cart.add([{
      id: String(nextId++),
      name: "",
      quantity: 1,
      price: 0
    }]);
  }

  function removeItem(id) {
    const index = $cart.value.findIndex(item => item.id === id);
    if (index !== -1) {
      cart.remove([index]);
    }
  }

  function calculateTotal() {
    return $cart.value.reduce((sum, item) => sum + (item.quantity || 0) * (item.price || 0), 0);
  }

  async function checkout() {
    await cart.submit();

    if ($cart.valid) {
      console.log("Checkout:", $cart.value);
      console.log("Total:", calculateTotal());
      // Perform checkout API call
    }
  }
</script>

<div>
  <h2>Shopping Cart</h2>

  {#each $cart.children as itemStore, index}
    {@const item = $cart.value[index]}
    <div class="cart-item">
      <input
        placeholder="Product name"
        bind:value={item.name}
        on:blur={() => itemStore.activate()}
      />

      <input
        type="number"
        placeholder="Qty"
        bind:value={item.quantity}
        on:blur={() => itemStore.activate()}
      />

      <input
        type="number"
        step="0.01"
        placeholder="Price"
        bind:value={item.price}
        on:blur={() => itemStore.activate()}
      />

      <button type="button" on:click={() => removeItem(item.id)}>Remove</button>

      {#if $cart.errors[index]}
        <p class="error">{Object.values($cart.errors[index]).join(", ")}</p>
      {/if}
    </div>
  {/each}

  <button type="button" on:click={addItem}>Add Item</button>

  {#if $cart.value.length > 0}
    <div class="total">
      <strong>Total: ${calculateTotal().toFixed(2)}</strong>
    </div>
    <button on:click={checkout} disabled={$cart.submitting}>
      {$cart.submitting ? "Processing..." : "Checkout"}
    </button>
  {/if}
</div>

<style>
  .cart-item { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
  .error { color: red; font-size: 0.875rem; }
  .total { margin-top: 1rem; font-size: 1.25rem; }
</style>
```

### Example 4: Async Validation (Username Availability Check)

This example shows how to use asynchronous validation to check if a username is available.

```svelte
<!-- UsernameCheckForm.svelte -->
<script>
  import { specable, register } from "svelte-specma";

  const username = specable("", {
    id: "username",
    required: true,
    spec: (v) => (v.length >= 3 ? true : "Username must be at least 3 characters")
  });

  let checking = false;
  let available = false;

  async function checkAvailability() {
    checking = true;
    available = false;

    // Simulate an API call to check username availability
    const isAvailable = await new Promise((resolve) => {
      setTimeout(() => {
        resolve(Math.random() > 0.5);
      }, 1000);
    });

    checking = false;
    available = isAvailable;

    if (!isAvailable) {
      username.setError("Username is already taken");
    } else {
      username.clearError();
    }
  }

  function handleSubmit() {
    username.activate();

    if ($username.valid && available) {
      console.log("Form submitted:", { username: $username.value });
    }
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <div>
    <label for="username">Username:</label>
    <input id="username" use:register={username} />
    {#if $username.active && $username.error}
      <p class="error">{$username.error}</p>
    {/if}
    <button type="button" on:click={checkAvailability} disabled={checking}>
      {#if checking}Checking...{#else}Check Availability{/if}
    </button>
    {#if available}
      <p class="available">Username is available!</p>
    {:else if $username.active && !$username.valid}
      <p class="error">Username must be at least 3 characters</p>
    {/if}
  </div>

  <button type="submit">Submit</button>
</form>

<style>
  .error { color: red; font-size: 0.875rem; }
  .available { color: green; font-size: 0.875rem; }
</style>
```

### Example 5: Shared Validation (Full Stack)

This example demonstrates the full power of reusable specs across client and server.

**Shared specs:**

```js
// filepath: lib/shared/specs/productSpecs.js
import { spread } from "specma";

export const productNameSpec = (v) =>
  v && v.length >= 3 && v.length <= 100
    ? true
    : "Product name must be 3-100 characters";

export const productPriceSpec = (v) =>
  typeof v === "number" && v >= 0 && v <= 1000000
    ? true
    : "Price must be between 0 and 1,000,000";

export const productDescriptionSpec = (v) =>
  v && v.length >= 10 && v.length <= 500
    ? true
    : "Description must be 10-500 characters";

export const productCategorySpec = (v) =>
  ["electronics", "clothing", "food", "books", "other"].includes(v)
    ? true
    : "Invalid category";

export const productSpec = {
  name: productNameSpec,
  price: productPriceSpec,
  description: productDescriptionSpec,
  category: productCategorySpec,
};

export const productRequired = {
  name: true,
  price: true,
  description: true,
  category: true,
};
```

**Client-side form:**

```svelte
<!-- filepath: src/routes/products/new/+page.svelte -->
<script>
  import { specable, register } from "svelte-specma";
  import { productSpec, productRequired } from "$lib/shared/specs/productSpecs";

  const product = specable(
    { name: "", price: null, description: "", category: "" },
    { spec: productSpec, required: productRequired }
  );

  const priceConverter = {
    toInput: (v) => v == null ? "" : String(v),
    toValue: (s) => s === "" ? null : Number(s)
  };

  async function handleSubmit() {
    await product.submit();

    if ($product.valid) {
      const response = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify($product.value)
      });

      if (response.ok) {
        alert("Product created successfully!");
      } else {
        const error = await response.json();
        alert(`Server error: ${JSON.stringify(error.errors)}`);
      }
    }
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <input use:register={product.getChild(["name"])} placeholder="Product name" />
  {#if $product.errors.name}<p class="error">{$product.errors.name}</p>{/if}

  <input use:register={[product.getChild(["price"]), priceConverter]}
         type="number" step="0.01" placeholder="Price" />
  {#if $product.errors.price}<p class="error">{$product.errors.price}</p>{/if}

  <textarea use:register={product.getChild(["description"])}
            placeholder="Description"></textarea>
  {#if $product.errors.description}<p class="error">{$product.errors.description}</p>{/if}

  <select use:register={product.getChild(["category"])}>
    <option value="">Select category</option>
    <option value="electronics">Electronics</option>
    <option value="clothing">Clothing</option>
    <option value="food">Food</option>
    <option value="books">Books</option>
    <option value="other">Other</option>
  </select>
  {#if $product.errors.category}<p class="error">{$product.errors.category}</p>{/if}

  <button type="submit" disabled={$product.submitting}>
    {$product.submitting ? "Creating..." : "Create Product"}
  </button>
</form>
```

**Server-side validation:**

```js
// filepath: src/routes/api/products/+server.js
import { json } from "@sveltejs/kit";
import { conform } from "specma";
import { productSpec } from "$lib/shared/specs/productSpecs";

export async function POST({ request }) {
  const data = await request.json();

  // Validate using the exact same specs as the client
  const result = conform(data, productSpec);

  if (!result.valid) {
    return json(
      {
        success: false,
        errors: result.problems,
      },
      { status: 400 }
    );
  }

  // Save to database
  // const productId = await db.products.create(result.value);

  return json({
    success: true,
    productId: "mock-id-12345",
  });
}
```

This example demonstrates:

- **Spec extraction** into a shared module
- **Client-side** reactive validation with Svelte stores
- **Server-side** validation using the same specs
- **Consistent validation** across the full stack
- **Type safety** and maintainability improvements
