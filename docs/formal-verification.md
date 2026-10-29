# Formal verification feasibility

## Recommendation

A proof that the whole port is equivalent to C is not feasible: about 250k
lines of C, 17k lines of Lua, and 209k lines of TypeScript with 2,600 async
functions. Machine-checked equivalence of individual functions is feasible and
cheap for the arithmetic and RNG layer. A working prototype in
`verification/equivalence/` now proves 20 scoped C/JavaScript claims,
including read-only hero state and role-dependent formulas. Use it as a CI check on leaf functions, add function-level
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

**Claim.** For every input in the domain, every random sequence (the core and
display streams as arbitrary `uint64` sequences), and RNG logging both on and
off: the pinned C function and the emitted JavaScript (`js/*.js`, which the
grader runs) return the same value, consume the same positions of each stream,
and emit the same RNG-log entries (`f(args)=result`). The C side has no
undefined behavior. The JavaScript never throws and stays exact.

| C ↔ JS | Domain (beyond C parameter types) | Paths C×JS | Time |
|---|---|---|---|
| `rn2`, `rnd`, `rn2_on_display_rng` ↔ `rn2`, `rnd`, `rn2Display` | `x >= 1` | 1×1 | <0.3 s |
| `rn1` macro (expanded by clang through `hack.h`, caller-log wrapper included) ↔ `rn1` | `x >= 1`, `y + x - 1 <= INT_MAX` | 1×1 | 0.5 s |
| `rnl` ↔ `rnl` | `1 <= x <= INT_MAX-256`; any `schar` `uluck` and `moreluck` | 13×18 | 1.0 s |
| `d` ↔ `d` | `n >= 0`, `x >= 1` or `n = 0`, `n*x <= INT_MAX`; unbounded `n`, by induction | 1×1 | 0.3 s |
| `rne` ↔ `rne` | `x >= 1`, `0 <= ulevel <= 30` (complete unrolling, checked) | 20×25 | 1.2 s |
| `rnz` ↔ `rnz` | `abs(i) <= 1e8`, `0 <= ulevel <= 30` | 40×50 | 4.4 s |
| `distmin`, `dist2` ↔ `distmin`, `dist2` | coordinates in [-16384, 16383] | 8×1, 1×1 | 0.3 s, 1.0 s |
| `exper.c:enermod` ↔ `exper.js:energyModifier` | `abs(en) <= 715827882`; one of the 13 playable roles, with its corresponding JS role key | 7×13 | 5.1 s |
| `exper.c:newuexp` ↔ `newExperienceThreshold` | `0 <= lev <= 30` | 4×4 | 1.6 s |
| `botl.c:xlev_to_rank` ↔ `experienceRankIndex` | every C `int` | 3×3 | 0.3 s |
| `hack.c:rounddiv` ↔ `polyself.js:roundDiv` | `abs(x) <= 100000000`, `1 <= y <= 1000000` | 4×1 | 0.6 s |
| `align.h:Align2amask` ↔ `Align2amask` | alignment in `{-128, -1, 0, 1}` | 3×3 | 0.5 s |
| `align.h:Amask2align` ↔ `Amask2align` | every C `int` mask | 3×3 | 1.3 s |
| `attrib.c:acurr` ↔ `currentAttribute` | Strength or Dexterity; corresponding six-element `schar` attribute arrays; no gauntlets | 6×2 | 1.3 s |
| `attrib.c:acurrstr` ↔ `currentStrength` | corresponding attribute arrays; no gauntlets | 5×3 | 0.5 s |
| `weapon.c:dbon` ↔ `heroStrengthDamageBonus` | corresponding attribute arrays; no gauntlets; original human form | 10×8 | 0.8 s |
| `weapon.c:abon` ↔ `heroAttributeHitBonus` | same, with corresponding level in 1..30 | 96×60 | 18.0 s |

The fv-leaves run used `NETHACK_RECORDER` pointing at the main checkout's pinned
recorder and exited 0 with all 20 claims and negative checks passing. The
separate 24 executor tests passed in 17.0 seconds. No game source, game test
suite, or session corpus was changed or run for this unit.

These are isolated function claims, including private emitted JS functions.
The two alignment wrappers only include `hack.h` and invoke its actual macros;
they do not copy their definitions. There is no claim about all callers or
about equipment effects, polymorphed attack bonuses, or other attributes.

**How it works.** Clang's typed JSON AST supplies the C side, so macros,
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
only manual proof step, about 30 lines in `specs.py`).

**Non-vacuity.** The run includes 23 domain probes and 24 mutant checks.
Every new claim has both a failing domain probe with a concrete model and a
killed JavaScript mutant. Numeric probes leave the arithmetic or interface
domain; attribute probes remove one equality from the assumed state relation.
Such a probe tests the need for the relation, not a game bug. One existing
mutant is genuinely equivalent (`ulevel < 15` →
`ulevel < 16`, since 15/3 = 5), and the tool proves it.

| New claim | Domain probe | Killed mutant |
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

- ISAAC64 is abstracted. The proof holds for every random sequence, so it is
  sound for any generator, but `isaac64.ts` ≡ `isaac64.c` is unproved.
- The trust base is the Python executors (unverified), clang's
  AST, tree-sitter, and Z3. Mutants and probes reduce the risk; replaying
  counterexamples concretely through compiled C and Node would reduce it more.
- State correspondence is assumed, not proved: JS `game.u.uluck` holds the
  same integer as C `u.uluck`, `game.u` exists, the contexts are
  initialized, and JS numeric arguments are integers equal to the C
  arguments. Negative zero is identified with zero.
- What is verified is the emitted JavaScript, not the TypeScript; `npm run
  compile` keeps them in step.
- Supported subset: integer C with locals, nested declared global-field reads,
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
- Bitwise `&`, `|`, `^`, `~`, `<<`, and `>>` use C's typed widths and JS's
  32-bit coercions; JS `>>>` is unsigned and shift counts are masked modulo
  32. C shift counts must fit the promoted left operand's width; signed left
  shifts require a nonnegative representable result. Negative signed right
  shifts use clang's arithmetic shift on the recorder target. Unsigned
  operations wrap. JS powers of two are supported only for exponents 0..53.
- Not yet: pointers and heap writes, general C `for`, Lua, `async`/`await`,
  escaped JS string literals, exceptions as control flow, loops that log inside their bodies under
  induction, and JS declarations that shadow an outer binding (rejected, not
  modeled). An induction loop needs a variant as well as an invariant, so
  equivalence includes termination. `sizeof` is evaluated for the LP64
  target, and other type traits are rejected.
- Log comparison uses structured entries. C's `@ caller` annotation and
  number prefix are ignored, as in scoring.

## Call-site domains

`verification/callsites/` checks whether every caller stays inside the proved
domains. `extract.mjs` uses the TypeScript checker to find every call whose
signature resolves to an `rng.ts` draw function. That includes aliases and
injected `random: typeof rn2` fields, which account for 430 sites. For each
call it records the argument terms and the conditions that dominate the call
in its function. `check.py` asks Z3 whether the lower bound holds (`x >= 1`;
for `d`, `n >= 0` and `x >= 1` unless `n = 0`) and whether the argument is an
integer, since a fraction reaches `BigInt()` and throws.

```sh
node verification/callsites/extract.mjs > .cache/rng-callsites.json   # ~12 s
cd verification/equivalence && uv run ../callsites/check.py ../../.cache/rng-callsites.json   # ~7 s
```

| Class | Sites | Meaning |
|---|---|---|
| constant | 1,985 | The argument alone is in the domain: literals, folded constants (including imported ones), lengths of readonly tables, draw results |
| guarded | 115 | In the domain given dominating guards, helper return bounds, or the bounds of every direct caller of a non-escaping function |
| invariant | 51 | In the domain only given a listed C invariant (below) or an in-bounds read of a readonly data table |
| unproved | 202 | Depends on state the analysis cannot see |

The invariants are C facts the checker assumes, not ones it proves:

| Invariant | C source |
|---|---|
| attributes 3..125 | `attrib.h` ATTRMIN..ATTRMAX (STR encodes 18/xx up to 125) |
| `ulevel` 1..30 | `global.h` MAXULEV |
| `level_difficulty() >= 1` | `dungeon.c` |
| monster level 0..49 | `monst.c`; `grow_up()` caps at 49 |
| attack dice 0..255 | `monst.c` dice are `uchar` |
| `nroom` 0..40 | `mkroom.h` MAXNROFROOMS |
| live room: `0 <= lx <= hx <= 79`, `0 <= ly <= hy <= 20` | `struct mkroom`, built by `create_room()` from `lowx <= hix` |
| table element in [min, max] of its entries | literal arrays typed readonly (lint forbids the casts that could write them) or never written, such as `MONSTER_LEVEL` |

Room facts apply only to fields whose owner has the TypeScript type `Room`, or
a parameter that every direct caller passes a `Room` (`somex()` is declared
over `Rectangle`). The sentinel after the last room is typed `RoomSentinel`,
so it gets none. Lua exclusion areas and level regions share the field names
but not the invariant. Moving from the first run (239 unproved) to this one
closed 37 sites: 22 became constant once imported constants and readonly table
lengths resolved (`A_MAX`, `MONSTER_COLOR.length`), and 15 rest on the new
invariants. The twelve unproved sites still touching rooms or `nroom`
(`mkswamp`, `makeniche`, the chest check, `create_subroom`, `rnd_rect`
placement, vault gold, the endgame portal region, `get_location`) all use the
same expression as their C counterparts (`mkroom.c:538`, `mklev.c:749`,
`mklev.c:1137`, `sp_lev.c:1560`, `:1690`, `:1213`, `:2763`, `dog.c:548`).
They rely on C's own unstated preconditions, such as `nroom >= 1` once
rooms exist. Of the rest, the largest groups are collections that may be
empty, counts and weights, dice from data, `spe` charges, and hit points. Nine
sites are in the browser fuzzer harness, not the game. One site may receive a fraction: `write.ts`
`rn1(basecost / 2, basecost / 2)`, where C divides integers. It is safe only
because every ink cost in `writingCost()` is even.

Triage so far finds no divergence. Each unproved site inspected (`zap.c`
`rn2(elig_stacks)`, `pray.c` `rn2((Luck + 6) >> 1)`, the `engrave` and
`hunger` formulas) passes C's own expression under C's own guard. These sites
therefore inherit C's unstated invariants rather than adding risk. Across the
15,010 sessions of the native development corpus, the C RNG log contains no
call with a non-positive argument to `rn2`, `rnd`, `rnl`, or `rne`, and no `d`
with a negative count or zero sides. A violation would desynchronize the
stream: C draws, while JavaScript returns 0 without drawing.

Guards are matched by source text, so a "guarded" proof assumes the guarded
value does not change between the guard and the call. Interprocedural facts go
three calls deep. Upper bounds (`n*x <= INT_MAX`, `abs(i) <= 1e8` for `rnz`) are
reported in the summary line only; 300 sites are not proved bounded above,
nearly all because their inputs have no stated maximum.

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
3. **ISAAC64 (1–2 weeks).** Prove `isaac64.ts` (BigInt) ≡ `isaac64.c`
   (`uint64_t`) with bit-vectors and a per-round loop invariant. This removes
   the generator from the trust base.
4. **Call-site domains (prototype done; see above).** Room, `nroom`, and
   data-table invariants are in. Next: a CI check that new call sites land in
   the proved classes, and the residual "may be empty" collections, which need
   a non-emptiness fact from the caller.
5. **Differential fuzzing of stateful functions (2–3 weeks).** Drive single C
   functions in the probe build and their TS ports from serialized state, with
   coverage guidance, for code where a state model is not worth writing.
6. **Optional state relation.** A typed relation between `GameState` and C
   globals for monster, object, and hero records would extend refinement proofs
   to stateful functions. Expect diminishing returns. Whole-game equivalence
   stays empirical.
