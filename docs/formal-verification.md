# Formal verification feasibility

## Recommendation

A proof that the whole port is equivalent to C is not feasible: about 250k
lines of C, 17k lines of Lua, and 209k lines of TypeScript with 2,600 async
functions. Machine-checked equivalence of individual functions is feasible and
cheap for the arithmetic and RNG layer. A working prototype in
`verification/equivalence/` proves 10 C/JavaScript function pairs in 19
seconds. Use it as a CI check on leaf functions, add function-level
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

`cd verification/equivalence && uv run prove.py` (clang and uv; about 20 s).

**Claim.** For every input in the domain, every random sequence (the core and
display streams as arbitrary `uint64` sequences), and RNG logging both on and
off: the pinned C function and the emitted JavaScript (`js/*.js`, which the
grader runs) return the same value, consume the same positions of each stream,
and emit the same RNG-log entries (`f(args)=result`). The C side has no
undefined behavior. The JavaScript never throws and stays exact.

| C ↔ JS | Domain (beyond C parameter types) | Paths C×JS | Time |
|---|---|---|---|
| `rn2`, `rnd`, `rn2_on_display_rng` ↔ `rn2`, `rnd`, `rn2Display` | `x >= 1` | 1×1 | <0.3 s |
| `rn1` macro (expanded by clang through `hack.h`, caller-log wrapper included) ↔ `rn1` | `x >= 1`, `y + x - 1 <= INT_MAX` | 1×1 | 0.2 s |
| `rnl` ↔ `rnl` | `1 <= x <= INT_MAX-256`; any `schar` `uluck` and `moreluck` | 13×18 | 1.3 s |
| `d` ↔ `d` | `n >= 0`, `x >= 1` or `n = 0`, `n*x <= INT_MAX`; unbounded `n`, by induction | 1×1 | 0.3 s |
| `rne` ↔ `rne` | `x >= 1`, `0 <= ulevel <= 30` (complete unrolling, checked) | 20×25 | 1.5 s |
| `rnz` ↔ `rnz` | `abs(i) <= 1e8`, `0 <= ulevel <= 30` | 40×50 | 5.3 s |
| `distmin`, `dist2` ↔ `distmin`, `dist2` | coordinates in [-16384, 16383] | 8×1, 1×1 | 0.3 s, 1.9 s |

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

**Non-vacuity.** Every function has negative checks, and all behave as
expected: 13 domain probes and 10 mutants. Each probe weakens the domain and
must fail with a concrete counterexample. Each mutant edits the JavaScript and
must fail. One mutant is genuinely equivalent (`ulevel < 15` →
`ulevel < 16`, since 15/3 = 5), and the tool proves it.

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
- The trust base is the Python executors (~1,600 lines, unverified), clang's
  AST, tree-sitter, and Z3. Mutants and probes reduce the risk; replaying
  counterexamples concretely through compiled C and Node would reduce it more.
- State correspondence is assumed, not proved: JS `game.u.uluck` holds the
  same integer as C `u.uluck`, `game.u` exists, the contexts are
  initialized, and JS numeric arguments are integers equal to the C
  arguments. Negative zero is identified with zero.
- What is verified is the emitted JavaScript, not the TypeScript; `npm run
  compile` keeps them in step.
- Supported subset: integer C with locals, struct reads from globals, calls,
  and `while`; JS with numbers, BigInt, `Math`, calls, and `for`/`while`. Not
  yet: pointers and heap writes, arrays, `switch`, Lua, `async`/`await`,
  exceptions as control flow, and loops that log inside their bodies under
  induction.
- Log comparison uses structured entries. C's `@ caller` annotation and
  number prefix are ignored, as in scoring.

## Staged plan

1. **CI (days).** Build the recorder sources in a GitHub Actions job (as
   `fresh-batches.yml` already does) and run `prove.py`. Fail on any lost claim,
   like the ledger check.
2. **Read-only state and more leaves (1–2 weeks).** Add symbolic reads of
   struct fields and constant tables, `switch`, and bit operations. Target
   `hacklib.c` helpers, attribute and experience formulas, `mcalcmove`, and
   to-hit and damage arithmetic. Choose targets from ledger blame.
3. **ISAAC64 (1–2 weeks).** Prove `isaac64.ts` (BigInt) ≡ `isaac64.c`
   (`uint64_t`) with bit-vectors and a per-round loop invariant. This removes
   the generator from the trust base.
4. **Call-site domains (1 week).** Prove or flag every TS call of `rn2`,
   `rnd`, `rnl`, `d`, and `rnz` whose argument is not provably inside the
   domain. This is the cheapest way to turn the divergences above into
   actionable findings.
5. **Differential fuzzing of stateful functions (2–3 weeks).** Drive single C
   functions in the probe build and their TS ports from serialized state, with
   coverage guidance, for code where a state model is not worth writing.
6. **Optional state relation.** A typed relation between `GameState` and C
   globals for monster, object, and hero records would extend refinement proofs
   to stateful functions. Expect diminishing returns. Whole-game equivalence
   stays empirical.
