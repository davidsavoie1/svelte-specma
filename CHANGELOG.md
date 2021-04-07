# Changelog

## [NEXT] -

### Add

- `set` method on `collSpecable`;
- Associate a random id on array items stores by default, instead of using indexes (which varies too much when dealing with reordering, deletions, etc.);

### Fix

- Ensure promise is always returned from `activate` method;
- Array store values not properly saved after removal;

---

## [0.0.1] - 2021-03-30

Initial working code.
