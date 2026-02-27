# Changelog

## [NEXT]

- Pass `form` as second argument to `onSubmit`
- Add `index.d.ts` types file

---

## [2.0.0] - 2025-11-26

- BREAK : Move Svelte from dependencies to peer-dependencies
- Add more documentation (AI generated);

---

## [1.1.7] - 2023-02-20

- Bettter manage reset method;
- Compare collection values by value before setting its store;

---

## [1.1.6] - 2022-03-20

### Fix

- Add `submitting` to `predSpecable` status

---

## [1.1.5] - 2022-01-31

### Fix

- Allow adding to `collSpecable` when its value is `undefined`;
- Consider `fields` when choosing if `collSpecable`;

---

## [1.1.4] - 2021-12-21

### Fix

- Consider spread in `getId`;

---

## [1.1.3] - 2021-11-05

### Fix

- Undefined `getChildren` throws in `getChild`;

---

## [1.1.2] - 2021-11-02

### Fix

- `getChild` now properly returns an actuel store;

---

## [1.1.1] - 2021-10-28

### Fix

- Prevent tracking of sub errors when collection is `undefined`;
- Ensure `validate` doesn't validate sub stores when collection is `undefined`;

---

## [1.1.0] - 2021-10-28

### Fix

- Allow setting a collection to `undefined`;

---

## [1.0.2] - 2021-10-22

### Fix

- Wrong usage of regex to determine number of ancestors;

---

## [1.0.1] - 2021-10-21

### Fix

- `getAncestor` is undefined on `ownSpecable`;

### Add

- Treat trailing ".." as "../" in ancestors path;

---

## [1.0.0] - 2021-10-21

Feels like this package is ready for 1.0.0!

### Fix

- Treat only `array`, `map` and `object` as collections;

---

## [0.3.4] - 2021-10-13

### Fix

- Check equality of dates differently than objects;

### Add

- Allow defining a `changePred` function to evaluate if value has changed from initial value, with strong default. If value has not changed according to this pred, use initial value;

---

## [0.3.3] - 2021-09-02

### Add

- Possibility to activate a specable store directly with the `set` method;

---

## [0.3.2] - 2021-08-27

### Add

- `submit` method on `collSpecable` and `predSpecable` to activate then submit value while updating state to `submitting`;

---

## [0.3.1] - 2021-07-27

### Add

- `getChild` and `getChildren` methods on `collSpecable` to retrieve a child at a specified path;
- Improve documentation in README;

### Fix

- Fix documentation inconsistencies;

---

## [0.3.0] - 2021-07-21

### Fix

- When `collSpecable` allows spread children, add missing entries and remove deprecated children stores when using the `set` method;
- Properly define a `getFrom` function independant of child position;

### Break

- Do not validate `undefined` values if they are not required;
- Allow setting non validated static values on collections;

---

## [0.2.0] - 2021-07-09

### Add

- Return store initial value in subscription result.

### Break

- When `fields` is passed to `collSpecable`, use it to select fields on initial value with `specma.select`. This way of doing things ensure proper change detection between store value and initial value.

### Fix

- Add missing `reset` method on `collSpecable`, advertised in the README.

---

## [0.1.2] - 2021-05-26

### Add

### Fix

- Fix dependencies issues with `npm audit fix`;
- Cannot read property `spec` of `undefined`;

---

# Changelog

## [0.1.1] - 2021-05-04

### Add

### Fix

- Treat non-required values as valid if `undefined`, `null` or `""`;

---

## [0.1.0] - 2021-04-16

### Add

- `set` method on `collSpecable`;
- Associate a random id on array items stores by default, instead of using indexes (which varies too much when dealing with reordering, deletions, etc.);
- Allow passing `toValue` and `toInput` as additional arguments to `register`;

### Fix

- Ensure promise is always returned from `activate` method;
- Array store values not properly saved after removal;

---

## [0.0.1] - 2021-03-30

Initial working code.
