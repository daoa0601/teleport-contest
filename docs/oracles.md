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

## Static gaps: C behavior absent from the port

```sh
git submodule update --init nethack-c/upstream            # once; plus its Lua headers:
git -C nethack-c/upstream submodule update --init submodules/lua
node scripts/static-gaps.mjs messages [--coverage OUT/c-coverage.json] [--check-ledger L.tsv] [--write-ledger L.tsv]
node scripts/static-gaps.mjs constants [--check-ledger L.tsv] [--write-ledger L.tsv]
node scripts/static-gaps.mjs edges [--function C_NAME] [--check-ledger L.tsv] [--write-ledger L.tsv]
node scripts/static-gaps.mjs screens RUN_DIR
```

The session oracles above only see code that some recorded game reaches.
`static-gaps` reads the C itself, so it also maps branches that no session
has run. It never decides whether ported code is right: sessions, the RNG
ledgers, the state oracle and the equivalence proofs still do that.

`messages` reads every string literal in `src/*.c` and the tty window files
from clang's JSON AST (the patched `nethack-c/recorder` tree when built, else
the pinned submodule). Literals inside `impossible()`, `panic()` and other
developer diagnostics, and inside `debugpline()` guards, are skipped. For
each remaining literal, it takes the longest piece between printf conversions
and looks for it among the port's string, template and folded `+` fragments in
`src/js`. A literal printed or prompted (`pline()`, `You()`, `yn_function()`,
`putstr()` and so on) counts as a message; anything else, such as names or
buffer text, counts as other text. A `~` marks a near match: the piece is
present once a leading or trailing word is dropped, so the port probably
composes the message differently. Check those last. `--coverage` joins
`state-oracle coverage` output, so missing messages in functions that the
corpus never runs can be routed to new scenario recipes.

`constants` takes every exported upper-case constant and enum member in
`src/js` whose name is also a C macro or enum constant, and compiles one
`_Static_assert(NAME == value)` per name against the pinned headers. clang
evaluates the C side. The report lists each differing value, most-used first;
an unused constant can simply be corrected or removed. A differing value that
is used consistently can still be right: an internal re-encoding is harmless
until code compares it with `<` or copies it into saved or displayed state.

`edges` compares the C call graph (clang's `debug.DumpCallGraph`, limited to
functions whose bodies live in a `.c` file) with the port. Each C function's
port counterpart is found by name, ignoring case and underscores, by
`docs/ledger/c-ts-aliases.tsv`, or by a `name()` citation in the comment
above a port function. For each C callee, the edge is:
- **present** when the counterpart, or a port function it calls up to two
  levels deep, names the callee (parameters included, since the port injects
  `random = rn2`);
- **cited** when the callee is only cited in a comment on that path, or its
  words appear in order in a reached port name (`heal_legs` matches
  `healHeroLegs`): probably renamed, so check these last;
- **missing** otherwise.

Missing edges are audit leads, not verdicts. Inlined helpers and renames
show up as missing until an alias is recorded. Add an alias line to
`c-ts-aliases.tsv` whenever an audit confirms a rename. `--function NAME`
prints one function's three lists.

`screens RUN_DIR` reads a finished `triage-holdout` run. It charges each
screen-only first difference to the C function whose literal appears on the
differing row. When only the port's row matches a literal, it is reported as
"port printed". This routes screen failures to owners the way the RNG table
routes random-call failures.

Ledgers: `docs/ledger/c-messages.tsv` (literals present),
`c-constants.tsv` (names whose value matches C) and `c-edges.tsv` (present
edges). The `static-gaps` job in `verify.yml` fails when any entry is lost.
As with the RNG ledgers, add entries with `--write-ledger` only after a
batch passes all its other checks.

## Measurement guard

`npm run lint:types` runs `check-measurement-guard.mts seeds`. It rejects
`src/js` literals equal to any recorded seed of 10000 or more, and strings
that name a recorded session. `check-measurement-guard.mts hash` prints one
SHA-256 over the scorer, triage, oracle, frozen, and native-patch sources.
CI compares it with the `MEASUREMENT_HASH` repository secret when that secret
is set. Approve a new hash out of band, after reviewing the measurement change.
