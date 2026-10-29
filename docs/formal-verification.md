# Formal verification feasibility

## Recommendation

A proof that the whole port is equivalent to C is not feasible: about 250k
lines of C, 17k lines of Lua, and 209k lines of TypeScript with 2,600 async
functions. Machine-checked equivalence of individual functions is feasible and
cheap for the arithmetic and RNG layer. A working prototype in
`verification/equivalence/` proves 28 scoped claims: 20 arithmetic/read-only
state claims plus eight ISAAC64 and seed-packing claims. The combined run,
including all probes and mutants, took 52.59 seconds in the call-site unit
acceptance run. Use it as a CI check on leaf functions, add function-level differential fuzzing for
stateful code, and keep whole-game equivalence empirical: session replay,
ledgers, and the state oracle.

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

`cd verification/equivalence && uv run prove.py` (clang and uv; about 52 s).
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
| `rn2` | `rnd.c:rn2` ↔ `rng.js:rn2` | `x >= 1` | 1×1 | 0.3 s |
| `rnd` | `rnd.c:rnd` ↔ `rng.js:rnd` | `x >= 1` | 1×1 | 0.1 s |
| `rn1` | `hack.h:rn1` macro ↔ `rng.js:rn1` | `x >= 1`, `y + x - 1 <= INT_MAX` | 1×1 | 0.5 s |
| `rnl` | `rnd.c:rnl` ↔ `rng.js:rnl` | `1 <= x <= INT_MAX-256`; any `schar` Luck fields | 13×18 | 0.9 s |
| `d` | `rnd.c:d` ↔ `rng.js:d` | `n >= 0`, `x >= 0`, `x >= 1` or `n = 0`, `n*x <= INT_MAX` | 1×1; induction for unbounded n | 0.3 s |
| `rne` | `rnd.c:rne` ↔ `rng.js:rne` | `x >= 1`, `0 <= ulevel <= 30` | 20×25 | 1.1 s |
| `rnz` | `rnd.c:rnz` ↔ `rng.js:rnz` | `abs(i) <= 1e8`, `0 <= ulevel <= 30` | 40×50 | 4.1 s |
| `rn2_on_display_rng` | `rnd.c:rn2_on_display_rng` ↔ `rng.js:rn2Display` | `x >= 1` | 1×1 | 0.1 s |
| `distmin` | `hacklib.c:distmin` ↔ `hacklib.js:distmin` | Coordinates in [-16384, 16383] | 8×1 | 0.3 s |
| `dist2` | `hacklib.c:dist2` ↔ `hacklib.js:dist2` | Coordinates in [-16384, 16383] | 1×1 | 1.3 s |
| `enermod` | `exper.c:enermod` ↔ `exper.js:energyModifier` | `abs(en) <= 715827882`; corresponding one of 13 playable roles | 7×13 | 4.4 s |
| `newuexp` | `exper.c:newuexp` ↔ `exper.js:newExperienceThreshold` | `0 <= lev <= 30` | 4×4 | 1.3 s |
| `xlev_to_rank` | `botl.c:xlev_to_rank` ↔ `exper.js:experienceRankIndex` | Every C int level | 3×3 | 0.3 s |
| `rounddiv` | `hack.c:rounddiv` ↔ `polyself.js:roundDiv` | `abs(x) <= 100000000`, `1 <= y <= 1000000` | 4×1 | 0.6 s |
| `Align2amask` | `align.h:Align2amask` ↔ `const.js:Align2amask` | Alignment in {-128, -1, 0, 1} | 3×3 | 0.5 s |
| `Amask2align` | `align.h:Amask2align` ↔ `const.js:Amask2align` | Every C int mask | 3×3 | 1.2 s |
| `acurr:StrDex` | `attrib.c:acurr` ↔ `attrib.js:currentAttribute` | Strength or Dexterity; corresponding six-element schar arrays; no gauntlets | 6×2 | 1.1 s |
| `acurrstr` | `attrib.c:acurrstr` ↔ `attrib.js:currentStrength` | Corresponding attribute arrays; no gauntlets | 5×3 | 0.5 s |
| `dbon:human` | `weapon.c:dbon` ↔ `weapon_damage.js:heroStrengthDamageBonus` | Corresponding attribute arrays; no gauntlets; original human form | 10×8 | 0.8 s |
| `abon:human` | `weapon.c:abon` ↔ `hero_attack_accuracy.js:heroAttributeHitBonus` | Corresponding attribute arrays and level in 1..30; no gauntlets; original human form | 96×60 | 15.2 s |
| `lower_bits` | `isaac64.c:lower_bits` ↔ frozen `lower_bits` | Any uint64 input represented as BigInt | Straight line | 0.1 s |
| `upper_bits` | `isaac64.c:upper_bits` ↔ frozen `upper_bits` | Any uint64 input represented as BigInt | Straight line | 0.0 s |
| `isaac64_mix` | `isaac64.c:isaac64_mix` ↔ frozen same name | Eight initialized uint64 words | Complete unrolling; checked bound | 0.1 s |
| `isaac64_update` | `isaac64.c:isaac64_update` ↔ frozen same name | 256 initialized words in m/r; arbitrary uint64 a/b/c | Two loop invariants cover all 256 updates | 0.3 s |
| `isaac64_reseed` | `isaac64.c:isaac64_reseed` ↔ frozen same name | Initialized r and a/b/c; byte seed length 0..INT_MAX capped at 2048; m/n initially unconstrained | Loop invariants; all eight residues and over-cap case | 3.5 s |
| `isaac64_init` | `isaac64.c:isaac64_init` ↔ frozen same name | Byte seed length 0..INT_MAX capped at 2048; no initial context values assumed | Proved reseed summary | 0.1 s |
| `isaac64_next_uint64` | `isaac64.c:isaac64_next_uint64` ↔ frozen same name | Corresponding initialized context, `0 <= n <= 256` | Refill and nonempty cases | 0.1 s |
| `isaac64_seed_packing` | Packing loops in `rnd.c:init_isaac64` ↔ `rng.js:initRng` | LP64 unsigned long; any uint64 seed via BigInt, or equal integer Number in 0..2^53-1 | Complete unrolling; checked bound | 0.1 s |

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
The two alignment wrappers only include `hack.h` and invoke its actual macros;
they do not copy their definitions. There is no claim about all callers or
about equipment effects, polymorphed attack bonuses, or other attributes.

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

**Non-vacuity.** Every function has negative checks, and all behave as
expected: the 23 leaf domain probes and 24 leaf mutants, plus eight ISAAC64
domain probes and ten ISAAC64 mutants. The new probes violate input types,
array allocation, seed allocation, or the available-count bound, and must
produce a solver counterexample; unsupported translation and solver unknown
do not count. All ten new mutants are killed, including shift `21 → 20`, mask
`0xffffffffffffffff → 0x7fffffffffffffff`, and a memory index changed by one.
For example, the mask mutant gives working `b = 9223372036854775808` in C and
`b = 0` in JS when initial `b = 9223372036854775807` and `c = 0`.
One original mutant is genuinely equivalent (`ulevel < 15` →
`ulevel < 16`, since 15/3 = 5), and the tool proves it.

| New leaf claim | Domain probe | Killed mutant |
|---|---|---|
| `enermod` | `en = INT_MAX` overflows C's multiplication | 4.4 s |
| `newuexp` | arbitrary `int` level can leave the JS exact-integer range | 1.3 s |
| `xlev_to_rank` | input 4294967297 narrows to C `int` 1: C 0, JS 8 | 0.3 s |
| `rounddiv` | `(2, -3)`: C -1, JS 0 | 0.6 s |
| `Align2amask` | alignment -3: C 4294967295, JS 255 | 0.5 s |
| `Amask2align` | input 9007199254740993 violates the exact JS input obligation | 1.2 s |
| `acurr:StrDex` | remove base Strength correspondence: returned attributes differ | 1.1 s |
| `acurrstr` | remove base Strength correspondence: condensed Strength differs | 0.5 s |
| `dbon:human` | remove base Strength correspondence: damage bonuses differ | 0.8 s |
| `abon:human` | remove base Dexterity correspondence: hit bonuses differ | 15.2 s |

The mask probe is a counterexample to the numeric input obligation, not an
observed C/JS result difference. The model accepts only exact integer Numbers;
it does not pretend that 9007199254740993 is a representable JS Number.

The new state assumptions are explicit in `specs.py`: `attrib.h` declares
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
The run passed 17 cases and 17,000 draws in 1.81 s: seven uint64 seeds,
seven byte lengths including zero, partial words, 2048, and over-cap, plus
three midstream reseeds. Each case checks 1,000 numeric outputs and stops at
the first mismatch. This is a concrete cross-check, not the universal proof.
Two target-selection regression tests exercise both verification entry points
with intentionally disagreeing frozen/emitted copies. A healthy frozen copy
must pass even when the emitted copy differs; a divergent frozen copy must
fail even when the emitted copy is healthy. Both tests failed before the
target correction and pass after it, including the rerun after this rebase
(two tests in 6.255 s). The 24 leaf-executor tests also passed after the rebase
in 14.644 s. Run them with
`uv run python ../isaac64/test_scoring_target.py` from `verification/equivalence`.

**Divergences found outside the domains.** The game should never reach these,
but none is checked yet:

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
  AST, tree-sitter, and Z3. Mutants and probes reduce the risk; replaying
  counterexamples concretely through compiled C and Node would reduce it more.
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
  have not been mutated; no new game-table equivalence claim is made yet.
  The 24 executor tests cover these operations and rejection boundaries using
  small C and JS programs, rather than copies of game functions.
- Leaf and ISAAC64 executors use `core.bit_operation` for bit-vector operations. The
  leaf executor keeps C's promoted widths and JS Number coercions; the ISAAC64
  executor chooses widths large enough for exact BigInt intermediates before
  applying source masks. There is one bit-operation implementation; width
  selection and language-specific safety obligations remain at each caller.
- Bitwise `&`, `|`, `^`, `~`, `<<`, and `>>` use C's typed widths and JS's
  32-bit coercions; JS `>>>` is unsigned and shift counts are masked modulo
  32. C shift counts must fit the promoted left operand's width; signed left
  shifts require a nonnegative representable result. Negative signed right
  shifts use clang's arithmetic shift on the recorder target. Unsigned
  operations wrap. JS powers of two are supported only for exponents 0..53.
- Outside the leaf executor: pointers and heap writes, general C `for`, Lua, `async`/`await`,
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

Extraction took 110.70 s; both lower and upper checks took 3.57 s. The baseline
here was rerun on this branch, rather than copied from the older 2,353-site
measurement.

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
in 1.330 s, including concrete invalid-domain probes, stale snapshots,
mutating callbacks, shadowed bindings, destructuring, builtin shadowing,
ordered increment reads, and nine independent emitted-JS mutants.

A second pass mutates emitted RNG arguments in memory, preserving nested
calls. Widths become zero; dice counts become negative; `rnz` receives an
out-of-bound upper argument. It changes no game files. The gate must reject
every previously classified site; see `review.md` for the measured result and
timings. Both passes still operate on emitted JavaScript.

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

## Staged plan

1. **CI (days).** Build the recorder sources in a GitHub Actions job (as
   `fresh-batches.yml` already does) and run `prove.py`. Fail on any lost claim,
   like the ledger check.
2. **Read-only state and more leaves (partly done).** Nested declared state
   reads, bounded arrays, constant tables, switches and bit operations are in;
   ten new claims above pass with probes and mutants. Next: equipment and form
   branches of `acurr`/`abon`/`dbon`, monster experience's permonst reads, and
   `mcalcmove`. The latter is hot in both RNG ledgers, but its JS entry also
   initializes mutable monster fields, outside the read-only model. `sgn`,
   `isqrt`, `online2`, and `rank_to_xlev` have no matching standalone emitted
   JS function in the inspected modules, so none was invented for a claim.
   Constant-table support is tested, but a game-table pair remains future work.
3. **ISAAC64 (done for the stated domains).** The frozen BigInt generator
   and C uint64 generator have equal outputs and successor states for init,
   reseed, mix, update, and next; wrapper seed packing also proves. The full
   command includes twenty leaf claims and eight ISAAC64 claims, with domain probes,
   shift/mask/index mutants, and a compiled-C/Node cross-check. Caller state
   correspondence and context routing remain outside these proofs.
4. **Call-site domains (emitted-source prototype strengthened).** Stable
   guards, inductive scalar bounds, constant table/name arithmetic, per-site
   JS mutants and a native residual audit are in. CI/ledger integration belongs
   to the separate `fv-ci` unit. Next: collection ownership/non-emptiness,
   relational permonst/object data facts, callback invoker bounds, and upper
   arithmetic obligations. The 237 residual sites remain unproved.
5. **Differential fuzzing of stateful functions (2–3 weeks).** Drive single C
   functions in the probe build and their TS ports from serialized state, with
   coverage guidance, for code where a state model is not worth writing.
6. **Optional state relation.** A typed relation between `GameState` and C
   globals for monster, object, and hero records would extend refinement proofs
   to stateful functions. Expect diminishing returns. Whole-game equivalence
   stays empirical.
