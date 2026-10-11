# Orchestrating parallel porting sessions

One main session (the orchestrator) owns the main checkout, the measurement
baselines, the ledgers, and `docs/porting-status.md`. Side sessions each port
one mechanic in their own git worktree. These rules exist because side
sessions previously had to edit the main checkout: their worktrees lacked
the uncommitted `src/` tree and the ignored corpora.

## Before spawning

1. Commit all work and fast-forward `main` to it. Worktrees branch from
   `main` and receive only tracked files; anything uncommitted is invisible
   to them.
2. Record a baseline at that commit: eval and public `triage-holdout` runs,
   their function tables, and `state-oracle compare`, labelled
   `base-<short-sha>`. Every side session compares against this baseline.
3. Build the queue from the baseline, not from memory: group failing
   sessions by first divergence and owning C file or mechanic. Each unit
   names its example sessions and the first differing call or screen row.

## Unit brief

Each side session gets one self-contained prompt with:

- The owning C/Lua file and functions, and the observable symptom from the
  baseline (session ids, first difference).
- The setup step: `node scripts/worktree-setup.mjs` in the worktree. It links
  `node_modules`, the holdout pool, the probe recorder, and state-oracle
  records from the main checkout.
- The acceptance gates below, and the baseline paths under the main
  checkout's `.cache/generalization/`.
- What it must not touch: the main checkout, `docs/porting-status.md`,
  `docs/ledger/`, frozen sources, native patches, the scorer, triage, oracle,
  and guard scripts.

Side sessions commit on their own branch. They never push, merge, rebase
`main`, or record new corpora, and they report open gaps in their final
message instead of editing the handoff.

## Acceptance gates (side session)

1. A behavior test that fails before the change and passes after it.
2. `npm run compile` and the focused tests for the touched mechanics.
3. One eval and one public run, each checked against the baseline function
   table and both ledgers. Any lost verified call fails the unit.
4. `state-oracle compare` with the unit's label: no new hidden-state
   session, and no first state difference moves earlier.

Corpus runs serialize machine-wide because the corpus lock checks live
processes. Wait for the lock with a polling loop; never kill another
session's run.

## Orchestrator duties

- Run at most three side sessions at once. Corpus serialization makes more
  of them wait rather than go faster, and each one costs a full context.
  Launching more needs the user's approval.
- Do not edit `src/` files that a running unit is likely to touch.
- Merge finished branches one at a time: compile and run the unit's
  focused tests after each merge. Resolve conflicts by reading both sides
  against the C source, not by preferring either branch.
- After a batch of merges, rerun the gates yourself: one full suite, eval
  and public runs, both ledgers, and the state oracle. Do not accept a side
  session's reported numbers in place of this rerun.
- Send back units that lose verified calls, add seed- or session-specific
  behavior, or test implementation details. State the reason; do not patch
  over the unit in the main checkout.
- Grow the ledgers with `--write-ledger` only after the batch rerun passes.
  Then update `docs/porting-status.md` once for the batch, and start the
  next baseline from the new commit.
- Ask the user before pushing, updating the remote `main`, or removing a
  worktree that holds unmerged commits.
