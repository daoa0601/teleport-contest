# Verification prototypes

Formal-verification experiments for the C-to-TypeScript port. Nothing here is
part of the game, the grader, or `npm run check`. See
`docs/formal-verification.md` for the assessment and plan.

## `difftest/`: concrete calls with serialized heap and hero state

This prototype calls real linked recorder functions and their emitted-JavaScript
ports. It is empirical testing, with no new equivalence theorem and no CI job.
It currently covers these six entry points:

| Recorder function | Emitted JavaScript |
|---|---|
| `mkobj.c:weight` | `weight.js:objectWeight` |
| `hack.c:inv_weight` | `weight.js:invWeight` |
| `hack.c:calc_capacity` | `weight.js:calcCapacity` |
| `hack.c:near_capacity` | `weight.js:nearCapacity` |
| `weapon.c:dmgval` | `weapon.js:rollPhysicalWeaponDamage` |
| `uhitm.c:find_roll_to_hit` | `hero_attack_accuracy.js:findHeroMeleeHitThreshold` |

Run from the worktree root (tested on macOS; requires clang, make, Node and uv):

```sh
npm run compile
export NETHACK_RECORDER=/Users/anhdao/project/contest/nethack-c/recorder
uv run verification/difftest/build.py
uv run verification/difftest/test_harness.py -v
uv run verification/difftest/run.py --count 6000 --self-test
```

`build.py` asks the configured recorder Makefile for its link objects, then
recompiles all 140 linked objects with clang and undefined-behavior sanitization.
It reads the existing configured headers and Lua archive. All outputs go under
this worktree's `.cache/fv-difftest/`; it never builds in or writes to the recorder
tree. The recorder must already have been configured by `build-recorder.sh`.
Rerun `build.py` after native source/header or harness changes; there is no
automatic source freshness check. `run.py --build` also performs this build.

The Python entry point validates and fills the input schema in `model.py` before
sending it to either child. A minimal custom case can be written as one JSON
object, or cases can be supplied as JSONL:

```json
{"target":"dmgval","seed":42,"position":255,"object":{"otyp":"TWO_HANDED_SWORD"},"monster":{"mnum":"giant"}}
```

```sh
uv run verification/difftest/run.py --input .cache/my-case.json
```

Each call compares the returned value, armor penalty, selected hero fields,
alignment, ordered inventory and recursive contents, object
quantity/weight/food/enchantment/erosion fields, ownership and worn masks, and
the supplied monster flags. It also compares consumed core/display word counts
and RNG operation/arguments/result entries. C source annotations and sequence
numbers are omitted from log entries; these have no JS counterpart. Differences
are reported one field at a time, without expanding an entire log assertion.

Every mismatch is written to `.cache/fv-difftest/mismatches.jsonl`, with the case
index, both observations and a reproducing input. The reducer deletes list
elements and resets scalars to domain defaults, preserving object/species types
and the first differing field. Its result is one-minimal under those operations,
not globally smallest. `--no-minimize` retains original inputs instead. A replay
can use the report's `input` object. Exit status 1 means a difference; native UB,
constructor failures, timeouts, malformed results and empty inputs fail the run.
Constructor errors retain the input in `.cache/fv-difftest/harness-error.json`.

**Correspondence and assumed invariants.** The shared JSON and the two loaders
are the state relation; neither is proved. JS uses the emitted test-support
constructors. C calls `decl_globals_init`, the object/monster table initializers,
and `set_uasmon` so form intrinsics and movement blocks exist. Outside flying and
levitation sources are added to the form's sources; the input bits are not an
override of innate flight. Accuracy rings are real inventory objects worn through
C `Ring_on` and JS `wearHeroAccessory`, before the target's RNG measurement starts.
An armed accuracy call aliases its object with the wielded inventory object.
The supplied form index goes directly to JS `setHeroSpecies`, matching C's
`u.umonnum` and `set_uasmon`. The animal and human were forms in
`include/monsters.h` share display names, so the index must survive initialization.
Input `attacks` selects the port's `firstAttack` argument. C increments its attack
counter in `uhitm.c:find_roll_to_hit`, but the port entry point has no numeric
counter output. That update is outside the compared projection and omitted from
both outputs.

| Input restriction or assumed fact | Native source |
|---|---|
| Matching numeric object/species IDs and initial metadata tables | `objects.c:objects_globals_init`, `monst.c:monst_globals_init`; emitted data modules; no table-equivalence proof |
| Positive quantities, singleton non-mergeable types and globs; at most 100 objects and four containment edges | `obj.h` ownership and `Is_container`; `objects.h:oc_merge`; `mkobj.c:weight` |
| `oeaten` is zero or no greater than full food nutrition | `eat.c:obj_nutrition`, `eaten_stat` |
| Heavy-ball extra weight is a whole `WT_IRON_BALL_INCR`; candelabrum candles 0..7 | `weapon.c:dmgval`, `read.c` heavy-ball growth; `apply.c` candelabrum handling |
| Strength 3..125, Dexterity/Constitution 3..25, level 1..30, Luck -13..13 plus moreluck -3..3 | `attrib.h`, `attrib.c:acurr`; `global.h:MAXULEV`; `you.h:Luck` |
| Human archeologist/monk accuracy; basic weapon skills; no artifact, armor, steed, monster equipment or shapechanger state | `uhitm.c:find_roll_to_hit`; `weapon.c:hitval`, `weapon_hit_bonus` |
| Input `hitinc` is the bonus before the supplied accuracy rings; -21 means no ring and -20..20 is an enchantment | `do_wear.c:Ring_on`; -21 is a harness sentinel |
| Quantities/cached weights fit the conservative 100,000,000 weight budget | `mkobj.c:weight`, `hack.c:inv_weight`, `calc_capacity`; avoids C int overflow in tested calls |
| Cached inventory weights already correspond to the intended object state | C `inv_weight` reads `owt`; JS reconstructs most ordinary weights. Reachability of a stale cache is not established here. |

The tree shape excludes cycles, shared container contents and multiple owners.
The JSON boundary requires integers; all tested totals fit exact JS arithmetic.
The RNG is the actual seeded ISAAC64 stream, advanced by `position` before the
call. C includes the unmodified recorder `rnd.c` and counts calls to its real
ISAAC next-word function; JS loads the frozen scoring adapters without rewriting
`js/`. This tests sampled seeds/positions, not arbitrary draw streams. Setup draws
are excluded. Display consumption is counted, but these targets do not exercise
display draws. No C function bodies are extracted or translated by this tool;
clang compiles the real translation units, rather than a textual C model.

**Measured acceptance (fv-difftest).** The native build took 14.98 s. The eight
harness tests passed in 2.340 s. New regressions failed before the review fixes
on the claimed attack-counter output and the three human were forms. Both forms
of wererat, werejackal and werewolf now retain their requested indices.
A batch of 6,083 cases (6,000 random plus 83 boundary inputs) took 7.01 s,
including five rejected domain probes and seven killed emitted-JS mutants.
Mutants independently cover weight, inventory capacity,
damage and accuracy results, an object mutation, extra RNG consumption, and a
log-only change with unchanged result and stream position.

| Target | Cases | Mismatches |
|---|---:|---:|
| `weight` | 1,031 | 0 |
| `inv_weight` | 1,019 | 0 |
| `calc_capacity` | 1,006 | 0 |
| `near_capacity` | 1,006 | 0 |
| `dmgval` | 1,009 | 0 |
| `find_roll_to_hit` | 1,012 | 0 |

No game-code bug or reachable counterexample was established. Initial fog-cloud
differences came from omitting C's form initialization and disappeared after the
loader called `set_uasmon`; a focused harness test now exercises that behavior.
A generated mismatch alone cannot establish play reachability. Inspect the
owning C callers and initialization before reporting an in-play port defect.

**Limits.** This compares a declared projection, not all of C memory or all of
`GameState`. It omits messages/screens, most hero fields, arbitrary equipment,
artifact-specific damage, monster ownership graphs, floor piles and map changes,
Lua, asynchronous suspension, and save/restore. The temporary C `gw.wc` capacity
cache has no stored JS counterpart and is not compared. Accuracy's chivalry/giri
effects and polymorphed accuracy are outside the current role/form domain.
The numeric attack-counter update is also outside the projection, because the
port takes a first-attack boolean rather than a mutable counter.
Generated inputs are random plus explicit boundaries, not coverage-guided.
Some accepted states need not be reachable in play. UB sanitization only checks
executed paths and does not prove UB freedom.

The requested public replay completed 44 sessions with 43 full passes, zero
errors, 11,396/11,405 matched screens and 792,838/792,838 matched RNG calls.
`rng-function-table.mjs --check-ledger docs/ledger/public-rng.tsv` passed:
all 363 listed functions retained every verified call. The screen-only miss
was `seed2200-wizard-quaff-zap-read` at step 158. No full game behavior suite,
pool/eval corpus or new recording was run; game code, measurement ledgers and
CI workflows were unchanged.

The separate required `equivalence/prove.py` run exited 0 with all 28 previous
claims still PROVED, including their probes and mutants. Its complete per-claim
times from this unit's run are below (these exclude each claim's negative checks):

| Claim | Result | Time | Claim | Result | Time |
|---|---|---:|---|---|---:|
| `rn2` | PROVED | 0.2 s | `rnd` | PROVED | 0.1 s |
| `rn1` | PROVED | 0.4 s | `rnl` | PROVED | 0.9 s |
| `d` | PROVED | 0.3 s | `rne` | PROVED | 1.1 s |
| `rnz` | PROVED | 4.2 s | `rn2_on_display_rng` | PROVED | 0.1 s |
| `distmin` | PROVED | 0.3 s | `dist2` | PROVED | 1.3 s |
| `enermod` | PROVED | 4.6 s | `newuexp` | PROVED | 1.1 s |
| `xlev_to_rank` | PROVED | 0.3 s | `rounddiv` | PROVED | 0.6 s |
| `Align2amask` | PROVED | 0.5 s | `Amask2align` | PROVED | 1.2 s |
| `acurr:StrDex` | PROVED | 1.2 s | `acurrstr` | PROVED | 0.5 s |
| `dbon:human` | PROVED | 0.8 s | `abon:human` | PROVED | 15.0 s |
| `lower_bits` | PROVED | 0.1 s | `upper_bits` | PROVED | 0.0 s |
| `isaac64_mix` | PROVED | 0.1 s | `isaac64_update` | PROVED | 0.3 s |
| `isaac64_reseed` | PROVED | 3.2 s | `isaac64_init` | PROVED | 0.1 s |
| `isaac64_next_uint64` | PROVED | 0.0 s | `isaac64_seed_packing` | PROVED | 0.1 s |

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

There are 41 scoped claims: the original 20 plus all-attribute `acurr`,
human/polymorphed `dbon` and `abon`, initial-table monster experience,
initialized monster movement, eight geometry/species predicates, and eight
ISAAC64/seed-packing claims. The monster claims check all 383 valid native
species with symbolic state where applicable; movement uses
arbitrary random streams. Every declared partition must have a satisfiable
entry domain in both logging modes, including state-constructor restrictions.
An empty partition fails the claim and reports its label. The regression
failed before the fix when either the precondition or constructor excluded
one species, and passes after it.
`abon:forms` assumes an equal, pure dungeon-difficulty result. Experience
covers monsters with no inventory. Live table mutations and preservation of
entry relations by initialization/equipment updates remain unproved.

`specs.py`, `state_specs.py` and `state_world.py` declare the domains and
correspondences; `docs/formal-verification.md` gives their native sources.
The new claims require both a concrete failing domain probe and a concrete
killed mutant. No game code or corpora were changed.

The added geometry claims pair `cmd.c:isok` with `hacklib.js:isok` and
`hacklib.c:online2` with `hacklib.js:pointsOnline`, over every signed-16-bit
coordinate. The species claims cover `mindless`, `nohands`, `humanoid`,
`ceiling_hider`, `sliparm` and `breakarm` for every valid initial species.
Four harness functions expand the real `mondata.h` macros. The entry relation
requires a non-null pointer to `mons[species]`; native/emitted fields retain
their initial values. The simple flag claims keep the index symbolic; the
three branch-heavy claims exhaust all 383 species in both logging modes.
Live table mutations and caller establishment of this relation remain outside
the claims. Probes demonstrate coordinate narrowing or native null-pointer
unsafety; each claim also kills a mutant with a concrete return difference.

The leaf runner relates JS Boolean results to native 0/1, while preserving a
difference between native 2 and JS true. The JS executor reads shorthand
object fields such as `{ mnum }` from the current binding, as required by the
existing armor helpers. Four added executor tests cover these behaviors;
three failed before the corresponding verifier extensions. See
`docs/formal-verification.md` for per-claim domains, paths and measured times.

The `rnl` claim splits its domain exhaustively by the magnitude of the luck
sum (`u.uluck + u.moreluck`, both `schar`, so 257 magnitude partitions).
Fixing the magnitude fixes the `rn2(37 + abs(adjustment))` modulus within
each branch for small or large `x`. The initial `RND(x)` draw still uses
symbolic `x` over `1..INT_MAX-256`, so the partition queries remain nonlinear.
The split removes one symbolic divisor; it does not guarantee that z3 will
decide every query. The unsplit query coupled the two symbolic divisors,
and z3 proved or gave up on it depending on the random seed, term-construction
order, or process memory layout: Linux CI
timed it out at 120 seconds three times, including once through a two-stage
solver retry. A regression test sweeps seeds 0 through 20 over seven of the
257 partitions (magnitudes 0, 1, 2, 3, 4, 5 and 13) and requires each sampled
query to prove. Passing this sweep is evidence of stability for those
partitions and seeds, not a guarantee for all partitions or solver seeds.

The complete 41-claim run passed in 704.66 s, including all 45 domain probes
and 49 mutant checks. It wrote the 41-row equivalence ledger only after the
complete run succeeded. All 62 executor/query/selection tests passed in
8.594 s, all 37 ledger CLI tests passed in 129.197 s, and `npm run compile`
passed. The ledger tests include a complete fast-claim run against the new
ledger. The eight added claims remain `fast`; the two existing slow claims
retain their domains and negative checks. After the `rnl` luck split the
complete run passed again in 875.76 s (the split claim alone is 168.2 s) with
the final suite of 63 executor/query/selection tests passing in 123.0 s and
the same 37 ledger CLI tests in 285.8 s.

Run the language, solver-isolation and command-selection tests
(63 tests; no game sessions):

```sh
cd verification/equivalence
NETHACK_RECORDER=/path/to/nethack-c/recorder uv run python -m unittest -v \
  test_executors test_queries test_proof_selection
```

The round-2 review run passed all 58 tests in 10.064 s. They check table reads and
bounds, nested global state and attribute arrays,
switch fallthrough/break/return behavior, C signed and unsigned bit operations,
JS 32-bit coercion, imports, defaults, scopes, libc assertions, signed division safety and rejected constructs. C table
values come from clang initializers. JS constant arrays are read from emitted
modules; this assumes the fields read still have their initial values. The
game-table claims include native record and attack fields. Writable heap state
is not modeled; movement's initializer performs no writes in its entry domain.

Pointer member reads from global state require a pointer declared through
`references` or a `CPtr` in `c_globals`; declaring only a flattened pointee
field does not establish a non-null pointer. The new rejection test failed
before the guard was restored for both global and nested pointers, and passes
after it.

Selection tests use real C/JS snippets and assert exit status only: selected
body mismatches, probes that incorrectly prove and surviving mutants fail the
command; excluded runtime classes do not run those checks. Report text is
used only for failure diagnostics.

CI checks the complete ledger metadata, then proves the selected runtime class:

```sh
cd verification/equivalence
uv run --locked prove.py --skip-slow --check-ledger ../../docs/ledger/equivalence.tsv
# Nightly and workflow_dispatch slow job:
uv run --locked prove.py --slow-only --check-ledger ../../docs/ledger/equivalence.tsv
# Complete local check:
uv run --locked prove.py --check-ledger ../../docs/ledger/equivalence.tsv
```

The ledger records each spec name, its C function and JS function/file, and
its domain (parameter and state types,
state correspondence, role mappings, null-pointer assumptions, and
preconditions), supplied JS arguments (kind, value, and order), loop
annotations (facts, invariant, variant, and streams), probe/mutant counts, and
a `runtime` value of `fast` or `slow`. Stateful rows also record item aliases,
state/argument/partition constructor identities, and explicit native assumptions. Preconditions and loop formulas use complete SMT expressions rather
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
| `specs.py` | common spec declarations, original function pairs, probes, mutants and the loop invariant/variant |
| `state_specs.py`, `state_world.py` | stateful leaf domains, pointer/API correspondences and the explicit difficulty contract |
| `queries.py` | incremental per-domain solvers with isolated path conditions, and bounded reuse of complete UNSAT queries |
| `prove.py` | builds the Z3 queries and reports |
| `harness/rn1.c` | wrapper so clang expands the `rn1()` macro from `hack.h` |
| `harness/alignment.c` | wrappers so clang expands the two real `align.h` macros |
| `harness/hero_properties.c` | expands the actual `Amphibious` property for the experience API relation |
| `rounddiv_witness.py` | checks the native/emitted expressions in the wizard-glob counterexample |
| `test_executors.py` | language behavior and rejection checks, run through both AST front ends |
| `test_queries.py`, `test_proof_selection.py` | path/domain isolation and fast-command selection behavior |
| `bv.py` | typed C wraparound, unbounded BigInt intermediates with checked widths, bit-vector arrays and safety obligations |
| `isaac_c.py`, `isaac_js.py` | separate AST executors for the ISAAC64 array/state subset |
| `isaac_specs.py` | seven generator claims, explicit state relation, loop invariants and variants, proved-call summaries, probes and mutants |
| `isaac_seed.py` | proof of the eight-byte packing loops in `rnd.c` and emitted `rng.js` |
| `isaac_ledger.py` | ledger domains from the ISAAC64 runners' symbolic inputs and loop plans |

`experience:tables` and `mcalcmove:tables` are marked `slow` in their specs.
The default command includes them, all probes and all mutants. Use
`uv run prove.py --skip-slow` for pull-request checks: it reports each excluded
claim and checks the other 39. The separate scheduled job uses `--slow-only --check-ledger`.
Run just the slow claims with:

```sh
uv run prove.py --slow-only --check-ledger ../../docs/ledger/equivalence.tsv
```

Both claims remain in the ledger with `runtime=slow`. Both proof selectors
check every recorded row and the complete current claim inventory before
proving their selection. Missing fast claims and changes to runtime markers
fail even with `--skip-slow`. A partial run cannot write a ledger. Skipping a
claim does not establish it; its domains and negative checks are unchanged.
See `docs/formal-verification.md` for measured times and profiling limits.

The earlier full command exited 0 with all 33 claims, 37 domain probes and 41
mutant checks in 688.98 s. The final `--skip-slow` run exited 0 with 31 claims,
34 probes and 39 mutant checks in 97.92 s. Table proof times were 415.6 s for
experience and 175.5 s for movement; both remain above the 120-second target.
The separate `--slow-only --check-ledger` job command passed both claims, three
probes and two mutants in 593.84 s. The 33-row ledger was generated only after
a complete `--write-ledger` run succeeded.

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
after it (two tests in 6.448 s on this review-fix run):

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

The current inventory has 2,483 sites: 2,090 constant, 106 guarded, 50 invariant,
237 unproved; 339 upper domains remain unproved. The final integration tip
adds two constant sites to the earlier 2,481-site audit; its checked ledger
still has zero regressions. Thirty-six previously
unproved sites classify successfully. Fifty-three old classifications were
withdrawn, and 133 additional emitted calls are now included. Extraction took
115.52 s and both classifier passes with ledger enforcement took 5.28 s on
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
emitted-only mutants. The source-wide gate killed 2,245 classified-site mutants
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

The 37 ledger CLI behavior tests assert exit status, with reports used only
for failure diagnostics. They run with:

```sh
cd verification/equivalence && uv run --locked ../test_ledgers.py
```

`.github/workflows/equivalence.yml` runs the fast job on every pull request,
on pushes to `daoa/recovery-architecture` and `main`, nightly at 02:17 UTC, and
on `workflow_dispatch`. The separate `slow-equivalence` job runs after it only
on schedule or manual dispatch, using `--slow-only` with the same ledger.
Both jobs use `ubuntu-latest`, install clang and prepare the recorder-patched
C sources and Lua headers with `linux-minimal` / `LUA_USE_POSIX`. Each job
compiles the TypeScript before proving emitted JavaScript. The fast job also
runs executor, target-selection, analyzer and ledger tests, the generator
cross-check and both call-site gates. The slow job retains a separate proof
report and runtime. Hosted Actions results have not been observed for this
change.

Clang reads system headers through `hack.h`; those headers remain part of the
C input. A local Ubuntu 24.04 arm64 container using glibc headers proved
`acurr:all` in 6.1 s and `abon:forms` in 49.5 s, including their probes and
mutants. This checks Linux header handling; it is not a hosted Ubuntu x86-64
measurement. The assertions are also exercised in explicit libc-form tests.

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

## `rounddiv` caller audit and reachable debug-mode gap

From the repo root:

```sh
NETHACK_RECORDER=/path/to/recorder node verification/callsites/rounddiv.mjs
cd verification/equivalence
NETHACK_RECORDER=/path/to/recorder uv run rounddiv_witness.py
```

The audit resolves all six native calls through clang and rejects escaping
function references that would require indirect-call analysis. It lists the
six corresponding emitted calculations. `doeat` can receive a negative
`rounddiv` denominator after a wizard overrides the glob weight limit:
`107374336` small globs produce weight/nutrition `2147486720`, narrowed to
`-2147480576`. The AST witness also finds an earlier delay difference:
C `33554483`, JS `-33554381`, from the emitted signed right shift.
The witness discharges native arithmetic obligations; the wish/meal path is
a source audit, not a session replay. Game code is unchanged. See the full
caller table and limitations in `docs/formal-verification.md`.
