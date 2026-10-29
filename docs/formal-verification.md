# Formal verification feasibility

## Recommendation

A proof that the whole port is equivalent to C is not feasible: about 250k
lines of C, 17k lines of Lua, and 209k lines of TypeScript with 2,600 async
functions. Machine-checked equivalence of individual functions is feasible and
cheap for the arithmetic and RNG layer. A working prototype in
`verification/equivalence/` now proves 33 scoped C/JavaScript claims,
including hero equipment, forms, initial monster tables, and eight ISAAC64
claims. Use it as a CI check on leaf functions, add function-level
differential fuzzing for stateful code, and keep whole-game equivalence
empirical: session replay, ledgers, and the state oracle.

## What "verified" can mean

| Notion | Statement | Realistic? |
|---|---|---|
| Whole-game observational equivalence | For every seed, option set, and input sequence: same RNG trace, screens, and cursors | No. This needs a relational invariant between all of C's globals, heap lists, and Lua VM state and `GameState`, held at every input boundary, across synchronous C and async TypeScript. Replay already measures it. |
| Per-function refinement under a state relation | If C and JS states correspond and inputs are equal, both return the same value, consume the same RNG positions, emit the same log entries, and preserve the correspondence | Yes for leaf and read-only-state functions. Cost grows with the state a function touches: heap shapes, object chains, Lua. |
| RNG-trace equality per function | The refinement above, observing only the RNG calls | It is a weaker case of per-function refinement. The ledger in `docs/ledger/` measures it empirically. |
| JS-only safety | No exception, all arithmetic exact | Cheap. The same tool proves it as a side effect. |

Every claim needs an explicit input domain. C has undefined and
implementation-defined behavior, and JavaScript has doubles and BigInt. The
prototype found the boundaries mechanically (see below).

## Approaches, ranked by value/effort

| Rank | Approach | Tooling | Proves | Effort | Plausible coverage |
|---|---|---|---|---|---|
| 1 | SMT translation validation of both real sources (this prototype) | clang JSON AST, tree-sitter, Z3 | Per-function refinement over a stated domain, for all RNG sequences | Minutes per straight-line function. About an hour for a loop that needs an invariant. Days for one that touches heap state, until a state model exists. | Pure, arithmetic, table, and read-only-state helpers: RNG wrappers, geometry, formulas, attribute and experience math |
| 2 | Function-level differential fuzzing | The C function built with clang (the probe build already has coverage), a Node harness, coverage-guided inputs | Nothing, but it scales to stateful functions without models | Days for the harness, then hours per function, mostly state marshalling | Most functions whose state can be serialized |
| 3 | Call-site domain checks | The same executor run on callers, or a typed static check | Callers stay inside the proved domains (for example, that `rn2` never receives `x <= 0`) | Low per caller | Every caller of a proved function |
| 4 | Bounded model checking of the C side | CBMC or ESBMC | C undefined-behavior freedom. It can cross-check the prototype's C semantics. | Low | The C side only. Comparing with TypeScript needs a hand-written C model of the TS function. |
| 5 | State-machine models | TLA+ or Alloy, for turn order, movement points, and occupation interruption | Properties of a model, not of either implementation | Weeks | Design-level. Our defects are fidelity defects against C, and a model detects them only when conformance-tested against both sides. |
| 6 | Deductive proof | Dafny, Lean 4, F*, or Why3/Frama-C WP | Strong functional properties | Very high. TypeScript has no usable formal semantics, so the TS would be hand-translated, which reintroduces the gap. Frama-C WP proves C contracts, not the port. | Small lemmas, such as the `Math.trunc` rounding lemma below |
| 7 | Proof-carrying translation (generate TS from a verified spec) | F*/Low*-style extraction, or a Lean-to-JS backend | Correct by construction | It would rewrite the port. It does not fit async I/O or the existing 209k lines. | None in practice |

KLEE only executes C (LLVM). Without a JavaScript-to-LLVM path it adds nothing
over rank 4.

## The proof of concept

`cd verification/equivalence && uv run prove.py` (clang and uv).
`--skip-slow` excludes the two table claims and their negative checks, with
an explicit `SKIPPED` line for each. The default includes all 33 claims.
In a worktree, set `NETHACK_RECORDER` to the main checkout's pinned recorder.

**Claim.** For every input in the domain, every random sequence (core and
display streams as arbitrary uint64 sequences), and RNG logging both on and
off: each leaf pair returns the same value, consumes the same stream
positions, and emits the same RNG-log entries. Leaf functions use the emitted
JavaScript modules listed in `specs.py`. C undefined behavior and JS
exceptions or inexact arithmetic are proof failures.

ISAAC64 compares return values and all in-bounds array cells and context
fields after each call. Generator claims read **`frozen/isaac64.js`**:
`frozen/score.sh` installs it over `js/isaac64.js` before scoring. The emitted
ISAAC64 copy is outside these claims. Wrapper seed packing reads emitted
`js/rng.js`. Times below exclude probes and mutants. Path counts are C×JS for
each logging setting; ISAAC64 rows state their loop proof instead.

| Claim | C ↔ JavaScript | Domain | Paths / loop proof | Time |
|---|---|---|---|---|
| `rn2` | `rnd.c:rn2` ↔ `rng.js:rn2` | `x >= 1` | 1×1 | 0.2 s |
| `rnd` | `rnd.c:rnd` ↔ `rng.js:rnd` | `x >= 1` | 1×1 | 0.1 s |
| `rn1` | `hack.h:rn1` macro ↔ `rng.js:rn1` | `x >= 1`, `y + x - 1 <= INT_MAX` | 1×1 | 0.7 s |
| `rnl` | `rnd.c:rnl` ↔ `rng.js:rnl` | `1 <= x <= INT_MAX-256`; any `schar` Luck fields | 13×18 | 1.6 s |
| `d` | `rnd.c:d` ↔ `rng.js:d` | `n >= 0`, `x >= 0`, `x >= 1` or `n = 0`, `n*x <= INT_MAX` | 1×1; induction for unbounded n | 0.4 s |
| `rne` | `rnd.c:rne` ↔ `rng.js:rne` | `x >= 1`, `0 <= ulevel <= 30` | 20×25 | 0.7 s |
| `rnz` | `rnd.c:rnz` ↔ `rng.js:rnz` | `abs(i) <= 1e8`, `0 <= ulevel <= 30` | 40×50 | 2.5 s |
| `rn2_on_display_rng` | `rnd.c:rn2_on_display_rng` ↔ `rng.js:rn2Display` | `x >= 1` | 1×1 | 0.1 s |
| `distmin` | `hacklib.c:distmin` ↔ `hacklib.js:distmin` | Coordinates in [-16384, 16383] | 4×1 | 0.1 s |
| `dist2` | `hacklib.c:dist2` ↔ `hacklib.js:dist2` | Coordinates in [-16384, 16383] | 1×1 | 0.4 s |
| `enermod` | `exper.c:enermod` ↔ `exper.js:energyModifier` | `abs(en) <= 715827882`; corresponding one of 13 playable roles | 4×4 | 2.3 s |
| `newuexp` | `exper.c:newuexp` ↔ `exper.js:newExperienceThreshold` | `0 <= lev <= 30` | 4×4 | 0.8 s |
| `xlev_to_rank` | `botl.c:xlev_to_rank` ↔ `exper.js:experienceRankIndex` | Every C int level | 3×3 | 0.2 s |
| `rounddiv` | `hack.c:rounddiv` ↔ `polyself.js:roundDiv` | `abs(x) <= 100000000`, `1 <= y <= 1000000` | 4×1 | 0.5 s |
| `Align2amask` | `align.h:Align2amask` ↔ `const.js:Align2amask` | Alignment in {-128, -1, 0, 1} | 3×3 | 0.8 s |
| `Amask2align` | `align.h:Amask2align` ↔ `const.js:Amask2align` | Every C int mask | 3×3 | 1.1 s |
| `acurr:StrDex` | `attrib.c:acurr` ↔ `attrib.js:currentAttribute` | Strength or Dexterity; corresponding six-element schar arrays; no gauntlets | 4×2 | 1.1 s |
| `acurrstr` | `attrib.c:acurrstr` ↔ `attrib.js:currentStrength` | Corresponding attribute arrays; no gauntlets | 5×3 | 0.4 s |
| `dbon:human` | `weapon.c:dbon` ↔ `weapon_damage.js:heroStrengthDamageBonus` | Corresponding attribute arrays; no gauntlets; original human form | 8×8 | 0.6 s |
| `abon:human` | `weapon.c:abon` ↔ `hero_attack_accuracy.js:heroAttributeHitBonus` | Corresponding attribute arrays and level in 1..30; no gauntlets; original human form | 24×17 | 2.1 s |
| `acurr:all` | `attrib.c:acurr` ↔ `attrib.js:currentAttribute` | all six attributes; corresponding arrays, worn items, artifact identities and current body | 6×6 | 5.7 s |
| `dbon:all` | `weapon.c:dbon` ↔ `weapon_damage.js:heroStrengthDamageBonus` | corresponding arrays/items; human and polymorphed forms | 8×8 | 0.3 s |
| `abon:forms` | `weapon.c:abon` ↔ `hero_attack_accuracy.js:heroAttributeHitBonus` | same; level 1..30; initial species data; corresponding Wizard deaths; **assumed** equal, pure dungeon difficulty in 1..32767 | 32×23 | 42.8 s |
| `experience:tables` (slow) | `exper.c:experience` ↔ `exper.js:monsterExperience` | initial tables; no monster inventory; any `uchar` monster level; `nk` 0..255; corresponding Amphibious option | 383 species domains, both log settings | 429.3 s |
| `mcalcmove:tables` (slow) | `mon.c:mcalcmove` ↔ `monster_speed.js:mcalcmove` | initial tables; initialized fields; corresponding speed/mount/context; gallop 0..2^53; both moving modes | 383 species domains, both log settings | 178.3 s |
| `lower_bits` | `isaac64.c:lower_bits` ↔ frozen `lower_bits` | Any uint64 input represented as BigInt | Straight line | 0.1 s |
| `upper_bits` | `isaac64.c:upper_bits` ↔ frozen `upper_bits` | Any uint64 input represented as BigInt | Straight line | <0.1 s |
| `isaac64_mix` | `isaac64.c:isaac64_mix` ↔ frozen same name | Eight initialized uint64 words | Complete unrolling; checked bound | 0.1 s |
| `isaac64_update` | `isaac64.c:isaac64_update` ↔ frozen same name | 256 initialized words in m/r; arbitrary uint64 a/b/c | Two loop invariants cover all 256 updates | 0.4 s |
| `isaac64_reseed` | `isaac64.c:isaac64_reseed` ↔ frozen same name | Initialized r and a/b/c; byte seed length 0..INT_MAX capped at 2048; m/n initially unconstrained | Loop invariants; all eight residues and over-cap case | 4.1 s |
| `isaac64_init` | `isaac64.c:isaac64_init` ↔ frozen same name | Byte seed length 0..INT_MAX capped at 2048; no initial context values assumed | Proved reseed summary | 0.1 s |
| `isaac64_next_uint64` | `isaac64.c:isaac64_next_uint64` ↔ frozen same name | Corresponding initialized context, `0 <= n <= 256` | Refill and nonempty cases | 0.1 s |
| `isaac64_seed_packing` | Packing loops in `rnd.c:init_isaac64` ↔ `rng.js:initRng` | LP64 unsigned long; any uint64 seed via BigInt, or equal integer Number in 0..2^53-1 | Complete unrolling; checked bound | 0.1 s |

**Runtime and CI split.** A `cProfile` run of species 0 found 552
feasibility checks plus 266 arithmetic implication checks for experience;
movement added 376 feasibility checks. The sampled experience proof changed
from 5.36 to 4.67 s, and movement from 2.50 to 2.05 s, including first-use
clang reads. These profiles do not establish a sub-120-second table claim.

The leaf executors now share an incremental solver for one entry domain and
use push/pop for temporary path conditions. Changing any domain constraint
rebuilds that context. The bounded UNSAT cache still keys complete propositions;
SAT and unknown results are not cached. Tests check that temporary path facts
do not escape, cached contradictions do not cross domains, and changing an
entry constraint changes feasibility. No proof domain, logging mode, safety
obligation, probe or mutant was removed.

An initial full run exited 1 because experience's grouped mutant query timed
out without a model. That was a failed negative check, not a killed mutant.
Counterexample searches now check the same output conditions separately for
each path pair; the experience mutant then produced a concrete C 135 / JS 136
witness in 3.25 s. Equivalence proofs retain the grouped table query. A
regression test covers both branches and a mismatch in a later partition.

The final full command exited 0 in **704.00 s**, with all **33 claims**, **37
domain probes**, and **41 mutant checks** behaving as specified. Of the mutant
checks, 39 have concrete counterexamples, one is the retained unsupported
shadowing-language rejection, and one is proved equivalent. The full table
above reports that run's per-claim times, excluding probes and mutants.
Experience took **429.3 s** (previously 1212.9 s); movement took **178.3 s**
(previously 341.8 s). Neither met the approximately 120-second target, so both
remain `slow`. The final fast command exited 0 in **95.36 s**, proving 31 claims
with 34 domain probes and 39 mutant checks, while explicitly skipping both
slow claims. `npm run compile` passed. No game tests or corpora were run; no game source
was changed. The separate `--slow-only --check-ledger` command passed both
slow claims, three domain probes and two mutants in **582.70 s** (experience
403.1 s; movement 178.5 s). The ledger was generated with `--write-ledger` after
a complete 33-claim run, then checked in all three selection modes.

The byte-seed relation comes from `isaac64.h`: C reads unsigned bytes and
the supplied length equals the JS array length. Both arrays contain at least
the first `min(length, 2048)` bytes. The JS state words are BigInts in
0..2^64-1. These representation facts and corresponding input state are
assumptions; they are not inferred from arbitrary callers or saved games.
`isaac64.h` gives C disjoint `m` and `r` fields; the corresponding JS arrays
must also be distinct.

`bv.py` keeps Z3 bit-vector arrays for memory. C operations use clang's
resolved integer types and wrap only at unsigned conversions; signed overflow,
invalid shifts, uninitialized reads, and array bounds are obligations. JS
BigInt intermediates get enough signed bits for their entire mathematical
range, including negative subtraction results and left shifts above 64 bits.
Only a mask actually present in the JS source may narrow a word; every array
store must prove that the stored word fits its modeled width. Number index
arithmetic must remain exact, and Number bit operations must fit int32.

For `update`, the invariant equates `m`, `r`, `a`, `b`, `c`, and the working
accumulators at an arbitrary aligned loop index in each 128-word half. One
four-word body preserves it and advances the index by four. Reseeding uses
analogous array invariants; during its first memory pass, only the written
prefix of `m` corresponds and is initialized. Each loop proves initialization,
guard agreement, preservation, and a bounded decreasing variant. Untracked
locals and arrays must remain unchanged; scratch locals must be assigned
before use. Inner loops and `mix` are fully unrolled with an unwinding check.
Eight seed-length residue classes and an over-cap case cover every stated
seed length, without enumerating seeds.

Calls to `mix`, `update`, and `reseed` use shared uninterpreted summaries only
after their source proofs succeed in the same run. Summary inputs include all
read-before-write state; their contracts check array shape, initialization,
seed allocation, and the postcondition `n = 256`. Reseeding is proved with
unrelated initial `m` and `n`, which justifies initialization's use of the
summary before those fields have values.

These are isolated function claims, including private emitted JS functions.
The original 20 scoped claims remain present. The alignment wrappers invoke
the real `hack.h` macros; the Amphibious wrapper invokes the real property
macro. There is no all-callers claim. The `abon:forms` dungeon-difficulty
contract and the monster-table/initialization limits are explicit below.

Signed division/remainder safety is checked through its premises: both
operands fit the promoted signed type, the divisor is nonzero, and the pair is
not minimum/-1. These conditions imply that the quotient or remainder fits
that type. A proved divisor != -1 discharges only the exceptional-pair check.
This avoids a redundant nested-division range query that timed out in a fast
run. Tests retain the reachable `/` and `%` failures and overflow before a
subsequent division, as well as correct truncation with a positive composite
divisor. No domain or undefined-behavior case was removed.

**Leaf proof method.** Clang's typed JSON AST supplies the C side, so macros,
`#if`, typedefs, and implicit conversions come from the compiler. tree-sitter
parses the emitted JavaScript. Two path-forking symbolic executors produce Z3
terms over mathematical integers. C signed overflow, division by zero, and
`abs(INT_MIN)` are obligations; narrowing conversions wrap. JavaScript
arithmetic must stay within ±2^53, so IEEE operations are exact.
`Math.trunc(a / b)` requires `b != 0` and `abs(a) <= 2^52`, where the double
quotient's rounding error is below 1/(2|b|) and cannot cross an integer. BigInt
is exact. Random draws read an uninterpreted `R_stream(position)`, shared by
both sides. Loops are unrolled with an unwinding check, or, for `d`, proved
by a hand-written relational invariant over a recursively defined sum (the
leaf executor's manual proof step, about 30 lines in `specs.py`).

The broad legacy `rnz` probe returned solver unknown during the first ledger
write. Its main equivalence domain was proved. The negative check now uses the
excluded `INT_MAX` boundary with a symbolic random stream and requires a concrete
counterexample: native `(int)x` returns `-2145336166`, while emitted JavaScript
returns `2149631130`. The positive `abs(i) <= 1e8` domain is unchanged. A language
test also checks the long-to-int return conversion directly.

**Non-vacuity.** The 25 leaf specs have 29 domain probes and 31 mutant
checks: 29 concrete mutant counterexamples, one retained language-rejection
check (the shadowing declaration mutant), and one equivalent mutant.
Every fv-leaves2 claim has both a failing domain probe with a concrete model
and a killed JavaScript mutant; rejection or timeout cannot satisfy those
gates. Numeric probes leave the arithmetic or interface
domain; attribute probes remove one equality from the assumed state relation.
Such a probe tests the need for the relation, not a game bug. The ISAAC64
claims add eight domain probes and ten killed mutants, including
shift, mask and memory-index changes. They also require solver counterexamples.
One existing mutant is genuinely equivalent (`ulevel < 15` →
`ulevel < 16`, since 15/3 = 5), and the tool proves it.
The existing prototype lacks dedicated mutants for `rn2` and `rn1`, and
dedicated domain probes for `d` and `rne`. This CI work adds no claims and does
not fill those gaps. New claims still require both a counterexample probe and
a killed mutant; the current CLI runs every check supplied by the specs.

| New leaf claim | Domain probe | Killed mutant |
|---|---|---|
| `enermod` | `en = INT_MAX` overflows C's multiplication | wizard/priest multiplier 2 → 3 |
| `newuexp` | arbitrary `int` level can leave the JS exact-integer range | first multiplier 10 → 11 |
| `xlev_to_rank` | input 4294967297 narrows to C `int` 1: C 0, JS 8 | rank numerator `level + 2` → `level + 1` |
| `rounddiv` | `(2, -3)`: C -1, JS 0 | denominator half → third |
| `Align2amask` | alignment -3: C 4294967295, JS 255 | alignment offset 2 → 1 |
| `Amask2align` | input 9007199254740993 violates the exact JS input obligation | normal alignment mask → shrine bit |
| `acurr:StrDex` | remove base Strength correspondence: returned attributes differ | add 1 to the attribute sum |
| `acurrstr` | remove base Strength correspondence: condensed Strength differs | Strength divisor 50 → 51 |
| `dbon:human` | remove base Strength correspondence: damage bonuses differ | 18/75 endpoint inclusive → exclusive |
| `abon:human` | remove base Dexterity correspondence: hit bonuses differ | Dexterity offset 14 → 13 |

| fv-leaves2 claim | Domain probe | Killed mutant |
|---|---|---|
| `acurr:all` | remove base Strength correspondence | dunce-cap value 6 → 7; power-gauntlet floor 125 → 124 |
| `dbon:all` | remove base Strength correspondence | polymorph damage bonus 0 → 1 |
| `abon:forms` | remove base Dexterity correspondence | form bonus offset -3 → -2; Wizard counter reads next species |
| `experience:tables` | remove monster-level correspondence | initial award 1 → 2 |
| `mcalcmove:tables` | remove speed correspondence; allow gallop -1 | rounding threshold `<` → `<=` |

The mask probe is a counterexample to the numeric input obligation, not an
observed C/JS result difference. The model accepts only exact integer Numbers;
it does not pretend that 9007199254740993 is a representable JS Number.

For the retained earlier attribute claims, the state assumptions in `specs.py` are: `attrib.h` declares
`u.acurr.a`, `u.abon.a`, and `u.atemp.a` as six signed-char fields; each
corresponds to the matching `game.u` element. C `uarmg` and both JS gauntlet
slot aliases are null. `you.h:Upolyd` supplies the human-form assumption
`u.umonnum == u.umonster`, with both fields corresponding to JS. `you.h`'s
`Role_switch` reads `gu.urole.mnum`; the 13 role enumerators are read through
clang and related to the role keys used by `exper.js`. These are assumed
relations at entry, not proofs of character initialization or restoration.

The new numeric counterexamples are outside ordinary caller inputs:
`exper.c` and `botl.c` call `newuexp` with levels 0..30;
`xlev_to_rank` receives native `int` levels; `polyself.c:newman` calls
`rounddiv` with denominator 10, positive maximum HP, or energy maximum
clamped to at least 1. Its JS counterpart also clamps those maxima.
`dungeon.c:induced_align`, `mklev.c:mkaltar`, and the mimic altar branch of
`makemon.c:set_mimic_sym` generate alignment -1, 0, or 1; hero alignment
fields use the named alignment constants in `align.h`. This caller inspection
does not discharge the upper bounds on `rounddiv` inputs or all alignment
callers. `enermod` is called with a small level-energy increment from
`newpw`; the INT_MAX probe does not describe that path.

**Concrete generator cross-check.** With `NETHACK_RECORDER` set, run
`cd verification/equivalence && uv run ../isaac64/crosscheck.py`. A tiny
harness compiles the real `isaac64.c`; Node imports `frozen/isaac64.js` directly.
The run passed 17 cases and 17,000 draws in 1.89 s: seven uint64 seeds,
seven byte lengths including zero, partial words, 2048, and over-cap, plus
three midstream reseeds. Each case checks 1,000 numeric outputs and stops at
the first mismatch. This is a concrete cross-check, not the universal proof.
Two target-selection regression tests exercise both verification entry points
with intentionally disagreeing frozen/emitted copies. A healthy frozen copy
must pass even when the emitted copy differs; a divergent frozen copy must
fail even when the emitted copy is healthy. Both tests failed before the
target correction and pass after it, including the rerun after this rebase
(two tests in 6.267 s). The 51 language, solver and selection tests also
passed after the rebase in 11.050 s. Run them with
`uv run python ../isaac64/test_scoring_target.py` from `verification/equivalence`.

**Divergences found outside the earlier numeric domains.** These boundaries
are not discharged at every caller. The wizard-glob path below demonstrates
that a negative `rounddiv` denominator can be reached through a debug option:

- In the recorder build, `NH_DEVEL_STATUS` is `RELEASED`, so `rnd.c`'s
  `impossible()` guards are compiled out. `rn2(0)`, `rnd(0)`, `rnl(0)`, and
  `rn2_on_display_rng(0)` are C undefined behavior (`% 0`). With `x < 0`,
  C consumes a draw, and `rnd`/`rnl` can overflow. JavaScript returns 0
  without drawing, so any such call would desynchronize the RNG stream.
- `rnl` with `x` within 256 of `INT_MAX` and large negative Luck overflows
  in C (`i -= adjustment`).
- `rnz` with `abs(i)` above about 1.07e8: C truncates the `long` result to
  `int` (for example, it returns 2147483647 where JS returns -2147483649).
- `rn1` with large `y`; `d` with `n < 0`, where C loops about 2^32 times
  and overflows.
- `distmin`/`dist2` with coordinates outside ±16384: `coordxy` (`int16_t`)
  wraps in C, and `dist2` overflows `int`.

**Trust base and limits.**

- The leaf proofs still use arbitrary random streams. The separate proofs of
  `frozen/isaac64.js` now establish equal generator outputs and successor states on their
  stated domains; the algorithm itself is no longer assumed equivalent.
- The trust base is the Python executors and loop annotations (unverified), clang's
  AST, tree-sitter, and Z3, plus the explicit pure dungeon-difficulty call
  contract. That helper's bodies are not executed by `abon:forms`. Mutants and
  probes reduce the risk; replaying
  counterexamples concretely through compiled C and Node would reduce it more.
- Loop annotation facts are trusted. For `d`, they state the recursive sum
  for `rnd.c:d`'s `while (n--) tmp += RND(x)` and the uint64 range of each
  abstract draw (`isaac64.h:isaac64_next_uint64`). The executor checks the
  invariant and decreasing variant, but does not establish that arbitrary
  supplied facts are valid definitions.
  The ledger records those formulas so changes require review.
- State correspondence is assumed, not proved: JS `game.u.uluck` holds the
  same integer as C `u.uluck`, `game.u` exists, the contexts are
  initialized, and JS numeric arguments are integers equal to the C
  arguments. Negative zero is identified with zero.
- What is verified is the emitted leaf JavaScript and the frozen scoring
  generator, not the TypeScript. `npm run compile` keeps emitted leaves in
  step with their sources; it does not produce the frozen adapter.
- Leaf executor subset: integer C with locals, nested declared global-field reads,
  fixed state arrays, constant integer tables from clang initializers, calls,
  `switch` and `while`; JS with numbers, BigInt, `Math`, constant arrays,
  default parameters, simple array bindings, optional state reads, calls,
  literal-label `switch`, and `for`/`while`. Switches preserve fallthrough,
  default placement, breaks, and early returns. Both sides support ternaries.
  Out-of-bounds array reads are obligations; partially initialized C arrays
  and JS array holes are rejected. Imported constants and functions resolve
  in their defining module. Module table reads assume their initial values
  have not been mutated. The two new game-table claims assume the native and
  emitted fields still have their initial values, including Erinys.
  The 46 language tests cover these operations and rejection boundaries using
  small C and JS programs, rather than copies of game functions.
- Leaf and ISAAC64 executors use `core.bit_operation` for bit-vector operations. The
  leaf executor keeps C's promoted widths and JS Number coercions; the ISAAC64
  executor chooses widths large enough for exact BigInt intermediates before
  applying source masks. There is one bit-operation implementation; width
  selection and language-specific safety obligations remain at each caller.
- `assert` is a proof obligation, independent of its libc expansion. The
  typed AST recognizer accepts Apple's `__assert_rtn` conditional (including
  its `__builtin_expect` hint) and glibc's single-if `__assert_fail` statement
  expression. The condition is evaluated once; failure yields a counterexample
  and only successful paths continue. These failure routines have the aborting
  contract declared by `<assert.h>`. With `NDEBUG`, `(void)0` evaluates nothing.
  Other GNU statement expressions are rejected.
- Bitwise `&`, `|`, `^`, `~`, `<<`, and `>>` use C's typed widths and JS's
  32-bit coercions; JS `>>>` is unsigned and shift counts are masked modulo
  32. C shift counts must fit the promoted left operand's width; signed left
  shifts require a nonnegative representable result. Negative signed right
  shifts use clang's arithmetic shift on the recorder target. Unsigned
  operations wrap. JS powers of two are supported only for exponents 0..53.
- Read-only nullable item pointers, equality of monster pointers, record
  fields and nested record/attack arrays are supported. Finite Map reads,
  literal object options, array defaults and `Number.isFinite` cover the
  corresponding initialized JS paths. C `for` loops require an initializer,
  condition and update, and use the same checked unrolling rule as `while`.
- Not yet: heap writes, pointer arithmetic, general sparse JS arrays, Lua, `async`/`await`,
  escaped JS string literals, exceptions as control flow, loops that log inside their bodies under
  induction, and JS declarations that shadow an outer binding (rejected, not
  modeled). An induction loop needs a variant as well as an invariant, so
  equivalence includes termination. `sizeof` is evaluated for the LP64
  target, and other type traits are rejected.
- The separate ISAAC64 executor supports its fixed arrays, context writes,
  non-rebound aliases, full zero `memset`, whole-word `memcpy`, and explicit
  relational loops. It is not a general C heap or JavaScript engine model.
  Negative C seed lengths, malformed JS states, optional absent JS seed
  arguments, the unused bounded-draw `isaac64_next_uint`, and JS-only peek
  are outside the claims. The wrapper claim covers the packing loops only;
  context routing, wrapper global writes, and correspondence at arbitrary
  callers remain assumed. Compilation, JS runtime semantics, clang, and Z3
  remain in the trust base. No whole-game equivalence is claimed.
- Log comparison uses structured entries. C's `@ caller` annotation and
  number prefix are ignored, as in scoring.

## Stateful leaf entry relations

`state_specs.py` and `state_world.py` state the new entry relations. These
relations are assumptions at function entry; initialization, equipment changes,
restoration and later table mutations are not proved to preserve them.

- The six elements of each attribute array correspond, including every signed
  `u.abon` value. `do_wear.c:Ring_on` and `Ring_gone` apply gain-strength,
  gain-constitution and adornment rings through `adjust_attrib`. Their effects
  are therefore included in the assumed array correspondence. Accuracy and
  damage rings update `u.uhitinc`/`u.udaminc`; native `abon`/`dbon` do not read
  those fields, and their callers add those bonuses separately.
- Each of `uarmg`, `uarmh` and `uwep` is either null or a corresponding live
  item. Each active JS slot alias refers to that item; at least one alias is
  active when the C pointer is non-null. Root-only, hero-only and shared slots
  are included.
  `otyp` is a native `short`; `oartifact` is a signed `char` (`obj.h`). The
  artifact runtime map has the IDs and names from emitted `ARTIFACT_DATA`, as
  copied by `artifacts.js:initializeArtifacts`. The claim executes the real
  `artifactById` Map lookup and native `artifact.c:is_art`.
- `gy.youmonst.data` points to `mons[u.umonnum]`, as installed by
  `polyself.c:set_uasmon`; the species index is in `0..NUMMONS-1`. The table
  fields read here retain `monst.c:mons_init` values, copied at startup by
  `monst_globals_init`. Emitted module data likewise retains its initial
  values. Live Erinys upgrades (`mon.c:adj_erinys` / `adjustErinys`), quest
  retargeting and seduction attack replacement are excluded.
- `abon:forms` executes native `makemon.c:adj_lev` and emitted
  `adjustedMonsterLevel`, including the Wizard death counter (an `uchar`) and
  special levels above 49. Other species death counters remain independent. It **assumes** that the two nullary,
  read-only `level_difficulty` calls return the same value in `1..32767`
  (`dungeon.c`, native return type `xint16`). The dungeon traversal and property
  calculations behind that call are not proved here. This is a conditional
  claim, not a proof of all polymorphed attack accuracy.
- `experience:tables` covers monsters with no inventory and a zero worn mask.
  It executes `worn.c:find_mac`, including base AC and its cap. The monster
  level spans the whole `uchar` range, revived/cloned flags span both values,
  and `nk` spans `0..255` (`mvitals.died` in `monst.h`). The JS `amphibious`
  option equals C's effective `Amphibious` property. Its input expression is
  built by executing the actual macro through `harness/hero_properties.c`,
  with arbitrary native breathing intrinsics/extrinsics and form flags.
  Attack types, damage types, dice, speed and `M2_NASTY` are read from the real
  native initializer; the JS side reads `MONSTER_EXPERIENCE_META` and
  `MONSTER_MOVE`. `experience` does not itself read `permonst.mresists`.
  Equipped monster AC and the JS fallback for a missing monster level remain
  outside this claim.
- `mcalcmove:tables` assumes initialized numeric `movement`, `mmove` and
  `mspeed` fields. The cached JS `mmove` is the emitted `MONSTER_MOVE` entry;
  C independently reads the native species entry. The initializer executes
  without writes under this relation. Speed spans the whole two-bit native
  field; both moving modes, mount identity, galloping and context movement
  flags are covered, with a missing mount, this monster as mount, or another
  monster as mount. Gallop is in `0..2^53`: `steed.c:kick_steed` increments
  it, dismounting resets it, and `timeout.c:nh_timeout` decrements it only
  when nonzero. Nonnegativity is assumed, not proved; the upper bound is the
  JS exact-integer domain, not a native invariant. A negative timer probe
  demonstrates its necessity. Every rounding and gallop draw is symbolic;
  the claim covers all random sequences, including the draw when the speed
  remainder is zero. Missing-field initialization and later cache updates
  remain unproved.

The two monster claims partition the complete valid index range using clang's
`NUMMONS`. Each species retains symbolic state and, for movement, arbitrary
random streams; these are not enumerated example game states. Clang supplies
record field order, field types and nested attack initializers. All new
negative checks require a concrete counterexample: unsupported syntax, empty
domains and solver timeouts do not count as successful probes or killed
mutants. Identical read-only return paths can be joined by disjoining their
conditions. Obligation queries at one source location are grouped, and a
bounded cache reuses only UNSAT results for identical complete Z3 propositions,
including their entry conditions.

## All rounddiv callers and the negative-denominator gap

`verification/callsites/rounddiv.mjs` uses clang's typed AST to list resolved
native calls. `rg` selects candidate translation units; it does not interpret
C. The script also lists emitted named calls and the inline volley expression.
There are six C calls and six corresponding port calculations:

| Native call | Port calculation | Denominator |
|---|---|---|
| `polyself.c:newman:390` | `polyself.js:renewHumanForm:1034`, `roundDiv` | 10 |
| `polyself.c:newman:396` | `polyself.js:renewHumanForm:1041`, `roundDiv` | native `u.uhpmax`; JS clamps it to at least 1 |
| `polyself.c:newman:404` | `polyself.js:renewHumanForm:1048`, `roundDiv` | 10 |
| `polyself.c:newman:409` | `polyself.js:renewHumanForm:1055`, `roundDiv` | maximum of native energy maximum and 1; JS also clamps |
| `mthrowu.c:monmulti:236` | `monster_throw.js:monsterVolleyCount:269`, inline `Math.trunc((spe + 1) / 3)` | 3; the call is guarded by launcher `spe > 1` |
| `eat.c:doeat:3058` | `eat.js:doeat:101`, `roundNutritionTime` | `(int) obj_nutrition(otmp)`; zero is guarded |

**A negative denominator has a source-derived game path in wizard mode.**
`objnam.c:readobjnam:5042-5067` permits a wizard to override the glob weight
limit. Requesting `107374336 small globs of brown pudding`, and accepting
that override, gives one glob weighing `107374336 * 20 = 2147486720`.
The count fits `int` and the multiplication fits `unsigned`. Fresh, unrotted
food can reach `doeat`'s rounding call with that nutrition. The cast to `int`
at `eat.c:3050` gives `-2147480576`, which is then the denominator at line
3058. This is not the `INT_MIN` negation case.

`uv run rounddiv_witness.py` evaluates the actual clang and emitted JS AST
expressions at that state, and discharges the native arithmetic obligations:

- Native `eatcorpse` delay: `33554483`; emitted `prepareCorpseMeal` delay:
  `-33554381`. The emitted `>> 6` coerces the unsigned weight to signed 32 bits.
- The native call then has numerator `72057806638965760`, denominator
  `-2147480576`, and returns `-33554579`.

The expression witness is checked; the wish/meal path is a source audit, not
an end-to-end replay. No game code was changed. Ordinary-play food weights
still need an upper-bound invariant; absorbing globs uses signed intermediate
weights in `mkobj.c:obj_absorb`, so it is not a proof that arbitrarily large
ordinary globs are reachable without earlier UB. The four native `newman`
calls rely on a positive live maximum HP or an explicit positive denominator;
this inspection does not prove their numerator bounds. The existing
`rounddiv(2, -3)` counterexample remains outside the positive-denominator claim.

## Call-site domains

`verification/callsites/` checks emitted `js/*.js` arguments against the RNG
leaf domains. Authored types identify injected callbacks and record/array
shapes; arguments, guards, initializers, writes and table contents come from
the emitted JavaScript. Runtime call inventories pair the two modules; a
missing or reordered callee stops extraction. Both the emitted checker and
authored signatures identify RNG bindings. This finds 133 calls that the
previous authored-signature-only scan missed, including callback defaults.

The classifications below concern **lower bounds and explicit division
integrality**, under the numeric/state correspondence assumptions below.
They do not establish the full caller domain: upper bounds are reported
separately. For `d`, the lower domain matches `specs.py`: `n >= 0`, `x >= 0`,
and `x >= 1` unless `n = 0`. Zero dice with zero sides is allowed; negative
sides remain outside the stated leaf proof even when the count is zero.

```sh
node verification/callsites/extract.mjs > .cache/rng-callsites.json
cd verification/equivalence
uv run ../callsites/check.py ../../.cache/rng-callsites.json \
  --json ../../.cache/rng-callsites-report.json
```

The final fv-leaves2 integration check contains 2,483 sites: 2,090 constant,
106 guarded, 50 invariant and 237 unproved. The two additions are constant
sites. Checking this inventory against the 2,481-site ledger reported zero
regressions; new proved sites are allowed by that ledger contract. Extraction
took 115.05 s and ledger checking took 3.89 s. The historical comparison below
is the fv-callsites audit baseline.

The post-rebase extraction took 108.90 s; both lower and upper checks with
ledger enforcement took 3.35 s. The class counts match the strengthened
analyzer's baseline below.

| Class | Before (2,348 sites) | After, original inventory | Additional emitted sites | After (2,481 sites) |
|---|---:|---:|---:|---:|
| constant | 1,981 | 1,985 | 103 | 2,088 |
| guarded | 115 | 98 | 8 | 106 |
| invariant | 51 | 47 | 3 | 50 |
| unproved | 201 | 218 | 19 | 237 |

`constant` needs no caller guard. `guarded` may use stable dominating guards,
helper return bounds, every direct caller of a non-escaping helper, or an
inductive local bound. For a local bound, the initializer establishes it and
every syntactic write preserves it; unsupported writes discard the summary.
An initializer can also be used before its first write when its declaration
dominates the read and no loop back edge carries a write past it.

Guard identities include bindings, including array-index bindings. Writes,
unknown calls, captured mutable scalars, `await`, and loop back edges can
invalidate a guard. A stored value is distinguished from a later live field
read. Entire `++count` arguments use a distinct pre-increment value; compound
side-effecting expressions and incremented loop conditions stay unproved.
No new guarded classification rests on matching text alone.

The run closes 36 of the original 201 unproved sites and withdraws 53 old
classifications. The withdrawals reflect unavailable emitted-only facts or
unjustified guard lifetimes/identities. They are not game-code regressions.
The successful sites and their C sources are listed in
[`verification/callsites/review.md`](../verification/callsites/review.md).

| Residual group | Before | After |
|---|---:|---:|
| possibly-empty collection | 25 | 37 |
| count or weight | 27 | 25 |
| dice from data | 21 | 23 |
| spe charges | 11 | 19 |
| hit points | 4 | 6 |
| other | 113 | 127 |

Groups use argument terms and recovered local origins, with charge/HP/dice
cases taking precedence over collection/count names. They are triage labels,
never proof premises. Better origin recovery can move a site between groups.
Every residual site has a native owner and a remaining obligation in
[`review.tsv`](../verification/callsites/review.tsv). The review distinguishes
matching formulas, C-to-array representations, unchanged callback forwarding,
and the input fuzzer. No reachable out-of-domain divergence was established;
this manual comparison is not a proof of state correspondence.

The `invariant` class additionally assumes the following C facts. It does
not prove that initialization, restoration, every caller, or a suspended
continuation establishes them.

| Assumed fact | C source |
|---|---|
| attributes 3..125 | `attrib.h` ATTRMIN..ATTRMAX; `attrib.c:acurr` (Strength encodes 18/xx up to 125) |
| non-Strength attributes 3..25 | `attrib.c:1199 acurr`, including all equipment/form branches; only calls resolving to emitted `attrib.js:currentAttribute` with a folded non-Strength index get this narrower fact |
| `ulevel` 1..30 | `global.h` MAXULEV; `you.h` level field; this also supplies the state domain of `rne`/`rnz` |
| `level_difficulty() >= 1` | `dungeon.c:level_difficulty` |
| monster level 0..255 | `monst.h:104 m_lev`, resolved by clang to 8-bit unsigned char; this replaces the invalid general cap of 49 (special creation can exceed it) |
| attack dice 0..255 | `monattk.h` attack dice are `uchar`; this does **not** imply positive sides when a positive count reaches a draw |
| `nroom` 0..40 | `mkroom.h` MAXNROFROOMS |
| live room: `0 <= lx <= hx <= 79`, `0 <= ly <= hy <= 20` | `struct mkroom`, `sp_lev.c:create_room`, `mklev.c:add_room` |
| in-bounds table element lies in the min/max of its initial entries | declared readonly or non-escaping emitted literal arrays, with the corresponding C data-table relation assumed |

Room facts apply only to `Room` owners, or a non-escaping parameter for which
all direct callers supply a `Room`. `RoomSentinel`, Lua rectangles and level
regions do not acquire them. Readonly array contents are assumed to remain in
the stated range. Literal string-name lookups use the emitted table entries;
no C/JS table-equivalence theorem is added.

**Non-vacuity.** Each successful solver query has a satisfiable modeled input.
Nested RNG result bounds are conditional on that draw's own domain; an invalid
nested draw cannot create contradictory facts and prove an enclosing call.
Nonzero divisors are obligations, not assumptions. Ten analyzer tests passed
in 1.369 s, including concrete invalid-domain probes, stale snapshots,
mutating callbacks, shadowed bindings, destructuring, builtin shadowing,
ordered increment reads, and nine independent emitted-JS mutants.

A second pass mutates emitted RNG arguments in memory, preserving nested
calls. Widths become zero; dice counts become negative; `rnz` receives an
out-of-bound upper argument. It changes no game files. The gate must reject
every previously classified site. The post-rebase mutant extraction took
117.29 s; its gate killed 2,245 mutants with zero failures in 7.14 s. Both
passes still operate on emitted JavaScript.

```sh
node verification/callsites/extract.mjs --mutate-domains > .cache/rng-mutants.json
cd verification/equivalence
uv run python ../callsites/test_callsites.py
uv run python ../callsites/test_domains.py \
  ../../.cache/rng-callsites.json ../../.cache/rng-mutants.json
```

**Limits.** This is conditional caller evidence, not a theorem about all
reachable game states. Unknown numeric leaves are modeled as integers equal
to corresponding C values. The checker does not establish their integrality
or rule out arbitrary `undefined`, NaN, proxies or effectful getters at game
boundaries. Record/collection shapes come from the authored type contract.
Raw table-index validity and the initial readonly-table relation remain
assumptions. RNG-typed callbacks assume the corresponding leaf contract.
Caller summaries use a closed inventory of emitted game modules; external
JavaScript consumers are outside this scope. Helper summaries stop after
three calls; callback invokers,
relational attack-table facts, late scalar clamps and general side-effecting
expression order are not modeled. Unknown calls can therefore leave a safe
site unproved.

There are 339 sites with unproved upper bounds. Native caller overflow and
exact Number arithmetic are not established by a lower-bound label. The
`write.ts` division remains unproved: C divides integers, while the emitted
code divides Numbers; current ink costs are even, but that parity relation is
not modeled. Zero-width C modulo is undefined behavior in the released
recorder, rather than an ordinary draw with a well-defined result. Negative
widths consume a C draw while the JS wrapper returns zero without drawing.
No corpus was run by this unit; earlier corpus observations do not discharge
any of these proof obligations.

The CI ledger records the 2,481-site baseline from this audit. Its four-part
key uses file, enclosing function, callee, and argument text, without line numbers,
and preserves repeated occurrences. CI rejects a weaker class or a new
unproved occurrence and prints the site and reason. The 237 existing unproved
sites are grandfathered. Removed calls and stronger classes are allowed.
Callback scopes include enclosing functions and assigned names or call
argument positions. The key audit found 2,008 distinct keys: 238 keys repeat,
accounting for 473 additional occurrences. Every repeated key belongs to one
actual enclosing function; none combines distinct callbacks. A regression
test swaps valid and invalid widths between callbacks in different functions.
The lost claim passed before scoped names and is rejected afterward.
The ledger covers the lower-bound/integer classification above; upper bounds
remain reported separately. The proof ledger records 33 claim names, the
C function and JS function/file being compared, their domain summaries
(including state correspondence, role mappings, nullable item aliases,
state/argument/partition constructor identities, and explicit native assumptions), supplied JS argument kinds and values in order, their probe/mutant counts, and a `fast`/`slow` runtime marker. It also records each annotated loop's key, streams, facts,
invariant, and variant. Preconditions and loop formulas use complete SMT
expressions rather than Z3's truncated display strings. The loop formulas use
independent symbolic current and entry locals and RNG positions, with named
local reads. Full expressions include recurrence definitions and draw bounds;
this does not validate those definitions. ISAAC64 rows derive their argument
types, ranges, array sizes, initialization, state correspondence, case
preconditions, and loop plans from the runners' symbolic inputs. Probe and
mutant counts use the same declarations as the proof runners. The current
and recorded claim names must match: new leaf, generator, and seed-packing
claims require a reviewed ledger entry. A missing or unrecorded spec, changed
domain summary, changed check count, or failed proof, probe, or mutant fails
CI. The metadata comparison runs before the proofs and prints both recorded
and current values. Comparing domain summaries as text is conservative: even
a logically equivalent rewrite requires a reviewed `--write-ledger` refresh.

## Staged plan

1. **CI (fast/slow jobs implemented; local commands passed).** The Ubuntu
   fast job runs on pull requests, branch pushes, schedule and manual dispatch
   with `--skip-slow --check-ledger`. A separate slow job runs nightly at
   02:17 UTC or on `workflow_dispatch`, after the fast job, with
   `--slow-only --check-ledger`. Both validate all ledger metadata, including
   runtime markers, before proving their selected claims. Missing fast claims
   cannot be hidden by the selector. Partial runs cannot write the ledger.
   Both jobs prepare recorder-patched C/Lua headers using Linux build rules and
   compile the port. The fast job runs all verification test commands and
   call-site gates. Hosted results are not yet observed for this change.
   Local Ubuntu 24.04 arm64/glibc proofs passed for `acurr:all` (5.7 s) and
   `abon:forms` (48.9 s), including probes and mutants. This exercises Linux
   headers and assertion expansion; hosted runners may have different clang
   and header versions. The native scoring recorder still uses macOS.
   Local gates passed: 51 executor/query/selection tests (11.050 s), 37 ledger
   CLI tests (100.248 s), two target tests (6.267 s), ten analyzer tests
   (1.369 s), and all 17,000 generator cross-check draws (1.89 s). Healthy
   extraction took 115.05 s and its ledger check took 3.89 s with zero
   regressions. Mutant extraction took 117.29 s; all 2,245 classified-site
   mutants were killed with zero failures in 7.14 s. The full, fast and
   slow-only proof commands all checked the generated 33-row ledger. Ledger
   tests assert exit status; reports are failure diagnostics only.
2. **Read-only state and more leaves (scoped claims done).** All six
   attributes, equipment and form branches now have claims under the entry
   relations above. Monster experience is the first game-table pair; movement
   covers all random sequences under initialized field/cache correspondence.
   Remaining work: discharge `abon`'s dungeon-difficulty contract, equipped
   monster AC, live table mutations, missing-field initialization and preservation
   of those relations by state-changing callers. `sgn`, `isqrt`, `online2`,
   and `rank_to_xlev` still have no matching standalone emitted function in the
   inspected modules; no function was invented for a claim.
3. **ISAAC64 (done for the stated domains).** The frozen BigInt generator
   and C uint64 generator have equal outputs and successor states for init,
   reseed, mix, update, and next; wrapper seed packing also proves. The full
   command includes twenty-five leaf claims and eight ISAAC64 claims, with domain probes,
   shift/mask/index mutants, and a compiled-C/Node cross-check. Caller state
   correspondence and context routing remain outside these proofs.
4. **Call-site domains (strengthened analyzer and CI implemented).** Stable
   guards, inductive scalar bounds, constant table/name arithmetic, per-site
   JS mutants and the native residual audit are in. CI runs analyzer behavior
   and source-wide mutant checks, and checks `rng-callsites.tsv` for weaker
   classes and new unproved occurrences. Next: collection ownership and
   non-emptiness, relational data facts, callback invoker bounds, and upper
   arithmetic obligations. The 237 residual sites remain unproved.
5. **Differential fuzzing of stateful functions (concrete prototype).**
   `verification/difftest/` links the real patched recorder and imports the
   emitted ports through the scoring adapters. Six entry points now run from
   shared serialized hero, inventory/container and defender state:
   `mkobj.c:weight`, `hack.c:inv_weight`/`calc_capacity`/`near_capacity`,
   `weapon.c:dmgval`, and human-form `uhitm.c:find_roll_to_hit` (archeologist
   and monk, basic skills, accuracy rings). It compares returns, a declared
   successor-state projection, consumed core/display words and RNG entries.
   The numeric C attack-counter update is outside that projection: the port's
   entry point takes a first-attack boolean and exposes no counter result.
   The acceptance batch ran 6,083 cases with zero differences, five rejected
   domain probes and seven killed emitted-JS mutants; eight harness tests passed.
   Native compilation took 14.98 s and the batch took 7.01 s on this macOS host.
   The separate required proof run kept all 28 previous claims PROVED; the
   full table and times are in `verification/README.md`.

   This adds empirical evidence, not a new proved claim. The correspondence
   is the shared JSON plus unproved loaders and table-ID relation. The native
   loader calls `set_uasmon` to establish form properties; omitting it caused
   false fog-cloud differences during development. JS preserves the supplied
   form index through `setHeroSpecies`, including the six animal/human were
   entries whose display names repeat. No reachable port defect
   was established. Input reduction retains each mismatch as a reproducing
   state; callers still need to establish whether it can arise in play.
   Messages, full heap/global state, arbitrary equipment/artifacts, polymorphed
   accuracy and resumed input remain outside the comparison. The requested
   public replay matched all 792,838 RNG calls and kept every verified call for
   all 363 ledger functions; 43/44 sessions passed fully, with one screen-only
   miss. No CI job, full game suite or new recording was added. Coverage
   guidance is still future work. See `verification/README.md` for domains,
   source assumptions, exact commands, projection limits and runtime details.
6. **Optional state relation.** A typed relation between `GameState` and C
   globals for monster, object, and hero records would extend refinement proofs
   to stateful functions. Expect diminishing returns. Whole-game equivalence
   stays empirical.
