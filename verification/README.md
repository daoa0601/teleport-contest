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

Run the executor's language tests separately (31 tests; no game sessions):

```sh
cd verification/equivalence
NETHACK_RECORDER=/path/to/nethack-c/recorder uv run python -m unittest -v test_executors
```

They check table reads and bounds, nested global state and attribute arrays,
switch fallthrough/break/return behavior, C signed and unsigned bit operations,
JS 32-bit coercion, imports, defaults, scopes, assertions, and rejected
constructs. C table values come from clang initializers. JS constant arrays
are read from emitted modules; this assumes their initial values have not been
mutated. No new game-table pair or writable heap state is claimed.

CI runs the complete check against `docs/ledger/equivalence.tsv`:

```sh
cd verification/equivalence
uv run --locked prove.py --check-ledger ../../docs/ledger/equivalence.tsv
```

The ledger records each spec name, its C function and JS function/file, and
its domain (parameter and state types,
state correspondence, role mappings, null-pointer assumptions, and
preconditions), supplied JS arguments (kind, value, and order), loop
annotations (facts, invariant, variant, and streams), and probe and mutant
counts. Preconditions and loop formulas use complete SMT expressions rather
than Z3's display strings, which can truncate long terms. Loop formulas use
independent symbols for current locals, entry locals, and RNG positions. The
ledger records the complete formula rather than a few concrete iterations. Annotation locals must be read by name.
A missing or unrecorded spec, changed domain summary, changed check count, or
failed claim, probe, or mutant fails the job. The recorded and current claim
names must match, so adding a claim requires a reviewed ledger entry. Domain
summaries are compared as text: even a logically equivalent rewrite requires
review and a ledger refresh. Domain and count failures show the recorded and
current values before starting any proofs.
Recording loop facts does not prove that they are valid definitions; they
remain part of the reviewed, hand-written loop argument.
ISAAC64 rows also record the actual modeled argument types, ranges, memory
sizes, initialization flags, state correspondence, case preconditions, and
loop plans. The probe and mutant counts come from the runners' declarations.

Ledger commands reject `--only`,
`--no-probes`, and `--no-mutants`. To record a reviewed set of claims, use
`--write-ledger ../../docs/ledger/equivalence.tsv`; it writes only after the
complete run succeeds. To accept reviewed changes, run `--write-ledger` alone;
combining it with `--check-ledger` preserves the existing baseline on a mismatch.

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
| `isaac_ledger.py` | ledger domains from the ISAAC64 runners' symbolic inputs and loop plans |

The latest ledger check passed all 28 claims in 47.8 s,
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
after it (two tests in 4.9 s on the latest run):

```sh
cd verification/equivalence
NETHACK_RECORDER=/path/to/nethack-c/recorder uv run python ../isaac64/test_scoring_target.py
```

## `callsites/`: do callers stay inside the proved domains?

`extract.mjs` reads the emitted JavaScript. Authored types identify injected
`random: typeof rn2` fields and collection/record shapes; emitted bindings
also identify RNG calls, including callback defaults missed by the authored
signature scan. Runtime call inventories pair the modules, while argument
expressions, guards, writes and table contents come from emitted code.

`check.py` classifies lower-domain evidence as constant, guarded, invariant,
or unproved. It checks guard lifetimes/binding identities, inductive local
bounds and explicit division integrality. Upper domains are reported
separately. Unknown numeric leaves still assume integer C/JS correspondence;
readonly table ranges assume valid indices and their declared initial-state
relation. These labels do not prove all reachable callers safe.

```sh
node verification/callsites/extract.mjs > .cache/rng-callsites.json
cd verification/equivalence
uv run ../callsites/check.py ../../.cache/rng-callsites.json \
  --json ../../.cache/rng-callsites-report.json
```

The current inventory has 2,481 sites: 2,088 constant, 106 guarded, 50 invariant,
237 unproved; 339 upper domains remain unproved. Thirty-six previously
unproved sites classify successfully. Fifty-three old classifications were
withdrawn, and 133 additional emitted calls are now included. Extraction took
108.90 s and both classifier passes with ledger enforcement took 3.35 s on
the shared machine.
[`callsites/review.md`](callsites/review.md) records counts by group, native
sources, limits and all 28 equivalence timings;
[`callsites/review.tsv`](callsites/review.tsv) lists every residual site.

Negative checks use actual JavaScript mutants held in memory. Widths become
zero, dice counts negative, and `rnz` receives an out-of-bound upper argument.
Nested calls remain in the inventory; game files are never rewritten.

```sh
# From the repository root:
node verification/callsites/extract.mjs --mutate-domains > .cache/rng-mutants.json
cd verification/equivalence
uv run python ../callsites/test_callsites.py
uv run python ../callsites/test_domains.py \
  ../../.cache/rng-callsites.json ../../.cache/rng-mutants.json

# Optional native audit aid (requires NETHACK_RECORDER in a worktree):
uv run ../callsites/native_calls.py eat.c:bounded_increase
```

The ten analyzer tests passed, including domain probes and nine independent
emitted-only mutants. The source-wide gate killed 2,243 classified-site mutants
with zero failures. No reachable out-of-domain game divergence was established.
Native auditing uses clang's typed JSON AST; its printed expressions and
nested `if` conditions aid manual review and are never solver premises.

Add `--check-ledger ../../docs/ledger/rng-callsites.tsv` to enforce the current
lower-bound and integer classifications. Each row identifies a call by file,
enclosing function, callee text, and the JSON array of argument texts. Line
numbers appear only in diagnostics, so moving a call does not change its key.
Callback scopes include enclosing functions and assigned callback names (or
call argument positions), so distinct callbacks do not share a file-wide
anonymous key. Repeated identical calls in the same scope retain separate
rows: an extra unproved copy fails.

Classes run from strongest to weakest: constant, guarded, invariant, unproved.
Losing a class fails with the site and reason. A new site must be constant,
guarded, or invariant; existing unproved calls are grandfathered. Deleting a
call or strengthening its class is allowed. Upper bounds remain a separate
summary, outside this ledger. Use `--write-ledger` with the same path to record
a reviewed baseline; combining it with `--check-ledger` writes only on success.

The 28 ledger CLI behavior tests assert exit status, with reports used only
for failure diagnostics. They run with:

```sh
cd verification/equivalence && uv run --locked ../test_ledgers.py
```

`.github/workflows/equivalence.yml` runs on every pull request and on pushes to
`daoa/recovery-architecture` and `main`. It uses `macos-latest` and Apple clang,
matching the native recorder job in `fresh-batches.yml`. Clang reads system
headers through `hack.h`, including `assert.h`, `stdint.h`, `limits.h`, and
`ctype.h`; the SDK is therefore part of the C input. The job selects Apple
clang and its SDK with `xcrun`. It prepares the pinned upstream C tree with the
recorder patches and generates `nhlua.h` using the recorder's Lua build rules.
Those patches change the RNG functions, logging macros, and `hacklib.c`, so
using upstream alone would check different code. It installs uv, compiles the
TypeScript, runs the executor, target-selection, analyzer, and ledger tests,
cross-checks the C and scoring generators, and reruns both analyses and the
source-wide call-site mutant gate. The job summary and retained reports
include wall-clock times.

Assertions are proof obligations. The executor recognizes Apple's conditional
`__assert_rtn` expansion and glibc's `__assert_fail` statement expression from
clang's typed AST. A reachable failing condition produces a counterexample.
The condition runs once; only successful paths continue. Disabled `NDEBUG`
assertions evaluate nothing. Other GNU statement expressions remain
unsupported. The tests compile both libc forms explicitly, so the glibc case
also runs on macOS.

Only the prepared C tree and uv's package cache are cached, using an exact key
including the C submodule revision, recorder patches, prover and extractor
files, dependency lock, and workflow. Proof results, classifications, emitted
JavaScript, and Node dependencies are rebuilt on every run.
