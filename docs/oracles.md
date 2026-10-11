# Measurement oracles

Session scores report only the first difference, which hides later defects.
These tools add per-function, per-state, and coverage measurements on top of
the native recordings. All of them write diagnostics under `.cache/`; nothing
they produce belongs in `js/` or `test/`. Run one corpus at a time: `record`
and `compare` share the triage corpus lock.

## Random calls by C function

```sh
node scripts/rng-function-table.mjs RUN_DIR [--baseline OLD/functions.json] [--check-ledger L.tsv] [--write-ledger L.tsv]
```

Post-processes a finished `triage-holdout` run without replaying it. A
recorded call counts as verified when it comes before its session's first
random-call difference. Later calls are unverified, not wrong. The function
whose expected call failed gets the blame, along with the calls that its
divergence hid. If the port made an extra call, the C call just before it is
blamed instead, because the port's log has no callers.

`docs/ledger/eval-rng.tsv` (frozen eval sample) and `docs/ledger/public-rng.tsv`
list every function that is fully verified, with its verified and total call
counts. A fully verified function cannot be blamed without also losing a
verified call, so the ledger check is exact. On the same corpus, any lost
verified call is a regression. CI checks the public ledger. Check the eval
ledger after each batch. Add entries with `--write-ledger` only after that
check passes.

## Game-state oracle

```sh
bash nethack-c/probe/build-probe.sh                         # once per recorder build
node scripts/state-oracle.mjs record .cache/state-oracle/NAME [--public]
node scripts/state-oracle.mjs compare .cache/state-oracle/NAME LABEL
node scripts/state-oracle.mjs coverage .cache/state-oracle/NAME
```

The probe is the recorder plus `nethack-c/probe/state-digest.patch`, built
with clang coverage. The official recorder is never modified. `record`
re-records the sessions and keeps a state log only when random calls,
screens, and cursors all reproduce exactly. At every input boundary, the
digest records the turn, level, hero vitals, attributes, inventory, live
monsters, and floor objects. Each list is sorted.
`src/scripts/lib/state-digest.mts` emits the same format from `GameState`
through the engine's `observeInput` hook.

`compare` reports, for each session, the first input whose state differs,
next to the first random-call and screen differences. A state difference
that comes before both is a hidden defect: the port's state is already wrong
while everything visible still matches.

`coverage` merges the C counters and lists which `src/*.c` functions the
corpus executed. It flags executed functions whose names, or camelCase forms,
never appear in `src/js`. Each flagged function is either unported or ported
under a name with no traceable reference. Infrastructure files (storage,
options, Lua bindings, glyph caches) are excluded from that ranking. Use the
never-executed list to aim new scenario recipes.

## Measurement guard

`npm run lint:types` runs `check-measurement-guard.mts seeds`. It rejects
`src/js` literals equal to any recorded seed of 10000 or more, and strings
that name a recorded session. `check-measurement-guard.mts hash` prints one
SHA-256 over the scorer, triage, oracle, frozen, and native-patch sources.
CI compares it with the `MEASUREMENT_HASH` repository secret when that secret
is set. Approve a new hash out of band, after reviewing the measurement change.
