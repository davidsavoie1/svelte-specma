# Changelog

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
