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

| File | Role |
|---|---|
| `cfront.py` | clang's typed JSON AST of the real C sources (macros, `#if`, conversions resolved by clang) |
| `csym.py` | C symbolic executor: typed integers, UB obligations |
| `jssym.py` | JavaScript symbolic executor (tree-sitter): exact-integer number model, BigInt |
| `core.py` | paths, the abstract random streams, unrolling and invariant loop rules |
| `specs.py` | function pairs, input domains, probes, mutants, the one loop invariant |
| `prove.py` | builds the Z3 queries and reports |
| `harness/rn1.c` | wrapper so clang expands the `rn1()` macro from `hack.h` |

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
