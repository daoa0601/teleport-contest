# Verification prototypes

Formal-verification experiments for the C-to-TypeScript port. Nothing here is
part of the game, the grader, or `npm run check`. See
`docs/formal-verification.md` for the assessment and plan.

## `equivalence/`: C ≡ JavaScript translation validation

Proves that pinned NetHack C functions and the emitted JavaScript that the
grader runs (`js/*.js`) return the same value, consume the same random-stream
positions, and write the same RNG-log entries, for every input in a stated
domain and every random sequence. C undefined behavior and JavaScript
exceptions or inexact arithmetic are proof failures.

Rerun (needs `clang` and `uv`; reads the pinned sources from
`nethack-c/recorder`, or from the main checkout when run in a worktree, or from
`$NETHACK_RECORDER`):

```sh
cd verification/equivalence && uv run prove.py
```

`--only NAME` limits the run; `--no-probes` and `--no-mutants` skip the
negative checks. The exit status is nonzero if any claim fails.

There are 20 scoped claims: the original ten RNG/geometry claims plus
`enermod`, `newuexp`, `xlev_to_rank`, `rounddiv`, both alignment-mask macros,
Strength/Dexterity `acurr`, `acurrstr`, and human-form `abon`/`dbon`.
The exact domains, assumed state correspondence, probes and mutants live in
`specs.py` and are described in `docs/formal-verification.md`. The attribute
claims assume no gauntlets; equipment effects and other attribute cases are
not covered. `enermod` relates C's role enumerator to each of the 13 JS role
keys. Every new claim has a concrete failing probe and a killed mutant.

Run the executor's language tests separately (24 tests; no game sessions):

```sh
cd verification/equivalence
NETHACK_RECORDER=/path/to/nethack-c/recorder uv run python -m unittest -v test_executors
```

They check table reads and bounds, nested global state and attribute arrays,
switch fallthrough/break/return behavior, C signed and unsigned bit operations,
JS 32-bit coercion, imports, defaults, scopes, and rejected constructs. C table
values come from clang initializers. JS constant arrays are read from emitted
modules; this assumes their initial values have not been mutated. No new
game-table pair or writable heap state is claimed.

| File | Role |
|---|---|
| `cfront.py` | clang's typed JSON AST of the real C sources (macros, `#if`, conversions resolved by clang) |
| `csym.py` | C symbolic executor: typed integers, UB obligations |
| `jssym.py` | JavaScript symbolic executor (tree-sitter): exact-integer number model, BigInt |
| `core.py` | paths, the abstract random streams, unrolling and invariant-plus-variant loop rules |
| `specs.py` | function pairs, input domains, probes, mutants, the one loop invariant and variant |
| `prove.py` | builds the Z3 queries and reports |
| `harness/rn1.c` | wrapper so clang expands the `rn1()` macro from `hack.h` |
| `harness/alignment.c` | wrappers so clang expands the two real `align.h` macros |
| `test_executors.py` | language behavior and rejection checks, run through both AST front ends |

## `callsites/`: do callers stay inside the proved domains?

`extract.mjs` finds every call that resolves to an `rng.ts` draw function
through the TypeScript checker, including aliases and injected
`random: typeof rn2` fields. `check.py` classifies each site as constant,
guarded, invariant, or unproved, and prints each unproved site with a
counterexample.

```sh
node verification/callsites/extract.mjs > .cache/rng-callsites.json
cd verification/equivalence && uv run ../callsites/check.py ../../.cache/rng-callsites.json
```
