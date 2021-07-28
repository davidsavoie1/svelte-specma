# Changelog

## [0.3.1] - 2021-07-27

### Add

- `getChild` and `getChildren` methods on `collSpecable` to retrieve a child at a specified path;
- Improve documentation in README;

### Fix

- Fix documentation inconsistencies;

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
