Round 3 finding fixed. Verification tooling only; no game mechanic was changed.
The authored game sources, emitted runtime/tests, native trees, shared status,
and ledgers are untouched.

The previous revision still compared complete self-test responses, including
`rng.log`, and required two mutants to fail specifically on log records.
All three negative-check suites now compare only the field each check exercises:
return value, created objects, teleport eligibility, successor state, or core
stream position. Their controls and broken-entry probes use the same field.
The differential batch keeps its existing full comparison for diagnostics.

The `log` and `creation_log` mutants were deleted because their injected calls
have unused results and change only diagnostic logs. Native `rnd.c:d()` does
not draw when its dice count is zero; its logging block runs separately.
In the port, `rng.ts:rn2(0)` returns before a draw, so the discarded `rne(0)`
result likewise has no game-state or stream-position effect. Keeping these
mutants would require the log-only assertions rejected by this review.
No other mutant fault or replacement text changed in round 3.

The original stale targets and the resulting table are below. The module-fold
history is `1c09c50b4` (object creation) and `671eea50d` (monster creation).
The seven retained stale mutants preserve their original faults.

| Mutant | Original target | Current target or disposition |
|---|---|---|
| create_object | mklev.js | mkobj.js |
| creation_log | mklev.js, repointed to mkobj.js earlier | Deleted: log-only fault |
| create_class | mklev.js | mkobj.js |
| random_range | mklev.js | objnam.js |
| random_monster | mklev.js | makemon.js |
| monster_class | mklev.js | makemon.js |
| monster_weapons | mklev.js | makemon.js |
| monster_inventory | mklev.js | makemon.js |
| stasis | teleport.js | teleport.js |
| weight | mkobj.js | mkobj.js |
| capacity | hack.js | hack.js |
| damage | weapon.js | weapon.js |
| accuracy | uhitm.js | uhitm.js |
| state | weapon.js | weapon.js |
| rng | weapon.js | weapon.js |
| log | weapon.js | Deleted: log-only fault |
| naming_plural | objnam.js | objnam.js |
| naming_singular | objnam.js | objnam.js |
| naming_an | objnam.js | objnam.js |
| naming_the | objnam.js | objnam.js |
| naming_bogus_titles | rumors.js | rumors.js |
| naming_xname | objnam.js | objnam.js |
| naming_doname | objnam.js | objnam.js |
| naming_monnam | do_name.js | do_name.js |
| naming_string_draw | objnam.js | objnam.js |
| naming_observe | objnam.js | objnam.js |

CI now runs the standalone `port.mjs --check-mutants` guard immediately after
compilation. It reads every target file independently of module imports and
fails with each stale mutant's name. The native build command is again
`uv run --locked run.py --build`, without relocating assertions into a workflow
`--self-test` step. The following pytest step runs all three negative-check
suites against real C/JS workers through the updated `test_mutants.py`.
All 24 remaining mutants are killed there: six base, eight creation, ten naming.

The regression test
`test_negative_checks_accept_observations_without_rng_logs` removes only the
native worker's diagnostic log and asserts the subprocess exit status.
The real native values and stream positions are retained, as is the JS worker's
ordinary response. Before the fix it failed with exit 1 and
`Mutant control already diverges: weight` (1 failed in 0.44 s).
After the fix it passed (1 passed in 6.90 s), killing every retained mutant.
This makes a renewed dependency on complete log-bearing responses fail CI.

Local gate results:

| Gate | Result | Local time |
|---|---|---|
| npm run compile | Exit 0; no generated changes | Passed |
| port.mjs --check-mutants | 24/24 apply, exit 0 | 0.03 s |
| uv run --locked run.py --build | 140 objects; 683 cases, 0 mismatches | 16.12 s total, 14.93 s build |
| uv run --locked python -m pytest -q | 38 passed | 23.42 s |
| run.py --creation --self-test | 6 base + 8 creation mutants killed; 2402 cases, 0 mismatches | 8.28 s total |
| run.py --naming --self-test | 10 naming mutants killed; 6148 cases, 0 mismatches | 9.51 s total |
| verification/test_ledgers.py | 36 passed | 5.276 s |
| Public RNG ledger and prior-run baseline | 363 functions retain every verified call; no regressions | Exit 0 |

Measured CI additions are the 0.03 s applicability guard and the approximately
6.9 s mutant regression test. The whole local difftest pytest step took 23.42 s;
these are local measurements, not observed GitHub Actions timings. The two
explicit self-test commands above were additional local checks.

The native build used read-only recorder sources at
`/Users/anhdao/project/contest/nethack-c/recorder`; both `NETHACK_RECORDER` and
`NETHACK_SOURCE=/Users/anhdao/project/contest/nethack-c/upstream` were set.
The current builder reads `NETHACK_RECORDER`; it does not read `NETHACK_SOURCE`.
All native outputs stayed in this worktree's `.cache/fv-difftest`.

No individual example sessions were listed for this tooling unit. The explicitly
requested public rerun used one worker and took 24.35 s. Before and after:
44 sessions, 43 full passes, zero errors, 792838/792838 RNG calls and
11396/11405 screens. The sole screen miss remains
`seed2200-wizard-quaff-zap-read`, step 158, row 3 column 36, from the recorded
configuration path; its first RNG difference remains absent. Diagnostics are
`.cache/fv-stale-mutants-r3-public/` and
`.cache/fv-stale-mutants-r3-ledger.log`.

Open limits: the existing public configuration-path screen mismatch remains.
Full game tests and pool/eval/fresh corpora were left to CI. The mutant table and
negative-check cases remain separately enumerated; the new guard checks every
table entry for applicability, while this run establishes 24/24 kills for the
current table. No live CI run was claimed, and nothing was pushed or merged.
