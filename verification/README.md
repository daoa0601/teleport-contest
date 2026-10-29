# Verification prototypes

Formal-verification experiments for the C-to-TypeScript port. Nothing here is
part of the game, the grader, or `npm run check`. See
`docs/formal-verification.md` for the assessment and plan.

## `equivalence/`: C ≡ JavaScript translation validation

Proves that pinned NetHack C functions and the JavaScript used for scoring
return the same value, consume the same random-stream
positions, and write the same RNG-log entries, for every input in a stated
domain and every random sequence. C undefined behavior and JavaScript
exceptions or inexact arithmetic are proof failures.

Leaf functions use the emitted modules listed in `specs.py`; wrapper seed
packing uses emitted `js/rng.js`. Generator claims read
**`frozen/isaac64.js`**, the adapter that `frozen/score.sh` installs over
`js/isaac64.js` before scoring. The emitted ISAAC64 copy is outside these claims.

Rerun (needs `clang` and `uv`; reads the pinned sources from
`nethack-c/recorder`, or from the main checkout when run in a worktree, or from
`$NETHACK_RECORDER`):

```sh
cd verification/equivalence && uv run prove.py
```

`--only NAME` limits the run; `--no-probes` and `--no-mutants` skip the
negative checks. The exit status is nonzero if any claim fails.
`--only isaac64` selects all eight generator/seed-packing claims; selecting
one composed generator claim also proves its dependencies first.

There are 20 scoped leaf claims: the original ten RNG/geometry claims plus
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

The post-rebase run passed all 24 tests in 14.644 s. They check table reads and
bounds, nested global state and attribute arrays,
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
| `core.py` | paths, abstract random streams, loop rules, and the shared bit-vector operations used by both executors |
| `specs.py` | function pairs, input domains, probes, mutants, the one loop invariant and variant |
| `prove.py` | builds the Z3 queries and reports |
| `harness/rn1.c` | wrapper so clang expands the `rn1()` macro from `hack.h` |
| `harness/alignment.c` | wrappers so clang expands the two real `align.h` macros |
| `test_executors.py` | language behavior and rejection checks, run through both AST front ends |
| `bv.py` | typed C wraparound, unbounded BigInt intermediates with checked widths, bit-vector arrays and safety obligations |
| `isaac_c.py`, `isaac_js.py` | separate AST executors for the ISAAC64 array/state subset |
| `isaac_specs.py` | seven generator claims, explicit state relation, loop invariants and variants, proved-call summaries, probes and mutants |
| `isaac_seed.py` | proof of the eight-byte packing loops in `rnd.c` and emitted `rng.js` |

The combined command passed all 28 claims after the rebase in 51.83 s,
with 31 domain probes and 34 mutants (33 rejected, one intentionally
equivalent). Eight claims cover ISAAC64 and seed packing, with eight
counterexample probes and ten killed mutants.
Both executor families use `core.bit_operation`; their C-width, JS Number
coercion, and BigInt bounds remain explicit at the callers.
`isaac64_reseed` covers all byte seeds with lengths 0..INT_MAX, capping at
2048; `next_uint64` covers counts 0..256. The relation assumes initialized
uint64/BigInt state arrays and equal input bytes. It does not prove that every
game caller or saved context establishes that relation. See the claims and
limits in `docs/formal-verification.md`.

The separate concrete check compiles only the actual generator C file and
imports `frozen/isaac64.js` directly; it does not run game tests or session corpora:

```sh
cd verification/equivalence
NETHACK_RECORDER=/path/to/nethack-c/recorder uv run ../isaac64/crosscheck.py
```

It passed 17 cases, 1,000 outputs each (17,000 draws), including partial and
over-cap byte seeds and midstream reseeding. Temporary binaries go in
`.cache/fv-isaac64/`. The proof command checks both sources in memory and
never rewrites game code.

The two target-selection regression tests give the frozen and emitted copies
different behavior. Both entry points must accept the healthy frozen adapter
when the emitted copy differs, and reject a divergent frozen adapter when the
emitted copy is healthy. They failed before the target correction and pass
after it (two tests in 6.255 s on the post-rebase run):

```sh
cd verification/equivalence
NETHACK_RECORDER=/path/to/nethack-c/recorder uv run python ../isaac64/test_scoring_target.py
```

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
