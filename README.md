# svelte-specma

Svelte form stores with Specma validation.

This guide focuses on real Svelte component usage, especially `$form` and `$children`.

## Install

```bash
npm install svelte-specma
```

Peer dependency: `svelte >=3 <6`

## 1) Configure once

Create one setup module and call `configure(...)` once at app startup.

```js
// src/lib/specma-setup.js
import * as specma from "specma";
import { configure } from "svelte-specma";

configure(specma);
```

Import this file once (for example in root layout or main entrypoint).

## 2) Most common: use a `specable` store in a Svelte component

`specable(...)` returns a Svelte store. Use `$form` in markup.

```svelte
<script>
  import "./specma-setup";
  import { specable, register } from "svelte-specma";

  const form = specable("", {
    required: true,
    spec: (v) => /.+@.+/.test(v) || "Invalid email",
    onSubmit: async (value, form) => {
      const saved = await fakeApiSave(value);
      form.reset(saved);
    }
  });

  async function submit() {
    try {
      await form.submit();
    } catch (e) {
      console.error(e);
    }
  }

  function fakeApiSave(v) {
    return new Promise((resolve) => setTimeout(() => resolve(v), 300));
  }
</script>

<form on:submit|preventDefault={submit}>
  <input use:register={form} />

  {#if $form.active && $form.error}
    <p>{$form.error}</p>
  {/if}

  <button disabled={$form.submitting || $form.validating}>
    {$form.submitting ? "Saving..." : "Save"}
  </button>
</form>
```

## 3) Object form with `$form.value`

For object initial values, `specable(...)` creates a collection store.

```svelte
<script>
  import "./specma-setup";
  import { specable } from "svelte-specma";

  const form = specable(
    { name: "", age: 0 },
    {
      spec: {
        name: (v) => !!v || "Name is required",
        age: (v) => v >= 18 || "Must be 18+"
      },
      onSubmit: async (value, form) => {
        const saved = await fakeApiSave(value);
        form.reset(saved);
      }
    }
  );

  function onNameInput(e) {
    form.set({ name: e.target.value }, true);
  }

  function onAgeInput(e) {
    form.set({ age: Number(e.target.value) }, true);
  }

  async function save() {
    await form.submit();
  }

  function fakeApiSave(v) {
    return new Promise((resolve) => setTimeout(() => resolve(v), 300));
  }
</script>

<input value={$form.value?.name || ""} on:input={onNameInput} />
<input value={$form.value?.age || 0} on:input={onAgeInput} />

{#if $form.active && $form.errors.length}
  <ul>
    {#each $form.errors as err}
      <li>{err.which}: {err.error}</li>
    {/each}
  </ul>
{/if}

<button on:click={save} disabled={$form.submitting}>Save</button>
```

## 4) `$children` usage with Specma `spread` fields

Most `$children` usage happens on a declared `spread` field (for example `presets`).

```svelte
<script>
  import "./specma-setup";
  import { spread } from "specma";
  import { specable } from "svelte-specma";
  import { assocPresetsIds } from "./assocPresetsIds";

  const form = specable(
    assocPresetsIds(consumable),
    {
      fields: {
        allowInput: 1,
        groupId: 1,
        key: 1,
        name: 1,
        presets: spread({ name: 1, quantity: 1 })
      },
      required,
      spec,
      onSubmit(values) {
        // ...someAction
      }
    }
  );

  const presetsForm = form.getChild(["presets"]);
  const children = presetsForm ? presetsForm.children : null;

  function addPreset() {
    const next = [...($form.value?.presets || []), { name: "", quantity: 1 }];
    form.set({ ...$form.value, presets: next });
  }

  function updatePreset(index, patch) {
    const next = [...($form.value?.presets || [])];
    next[index] = { ...next[index], ...patch };
    form.set({ ...$form.value, presets: next }, true);
  }

  function removePreset(index) {
    const next = ($form.value?.presets || []).filter((_, i) => i !== index);
    form.set({ ...$form.value, presets: next });
  }
</script>

{#if children && Array.isArray($children)}
  {#each $children as presetChild, index}
    <div>
      <input
        value={$form.value?.presets?.[index]?.name || ""}
        on:input={(e) => updatePreset(index, { name: e.target.value })}
      />
      <input
        type="number"
        value={$form.value?.presets?.[index]?.quantity || 1}
        on:input={(e) => updatePreset(index, { quantity: Number(e.target.value) })}
      />

      {#if presetChild.active && presetChild.error}
        <small>{presetChild.error}</small>
      {/if}

      <button on:click={() => removePreset(index)}>Remove</button>
    </div>
  {/each}
{/if}

<button on:click={addPreset}>Add preset</button>
```

Notes:

- Use `form.getChild(["presets"])` to access the nested collection store for the spread field.
- Then subscribe to its `children` store (`const children = presetsForm.children`) and iterate `$children`.
- For spread arrays, child `id`s are random unless `getId` is configured.

## 5) Submission and validation flow (important)

`submit()` behavior:

- if `onSubmit` is missing: resolves `undefined`
- validates first
- if invalid: resolves `false`, `onSubmit` is not called
- if valid and `onSubmit` succeeds: resolves `true`
- if `onSubmit` throws: error propagates
- `submitting` always returns to `false` after completion

You can also validate manually:

```js
const valid = await form.activate();
if (!valid) return;
```

## 6) Quick API you use most in Svelte

- `form.set(value, shouldActivate = false)`
- `form.reset(newInitialValue?)`
- `await form.activate(bool = true)`
- `await form.submit()`
- `form.children` (store of child stores)
- `$form.value`, `$form.error`, `$form.errors`, `$form.valid`, `$form.submitting`

## 7) `register` action

For single-field binding:

```svelte
<script>
  import { register } from "svelte-specma";
  export let form;
</script>

<input use:register={form} />
```

With transforms:

```svelte
<input
  use:register={[
    form,
    {
      toInput: (v) => String(v ?? ""),
      toValue: (raw) => Number(raw)
    }
  ]}
/>
```

## 8) Troubleshooting

- `TypeError: SvelteSpecma must be configured...`
  - `configure(specma)` was not called before creating forms.
- Validation not showing:
  - call `form.activate()` or `form.submit()`, or pass `true` as second arg in `set(...)`.
- Need reset after remote save:
  - do it in `onSubmit(value, form)` with `form.reset(savedValue)`.
