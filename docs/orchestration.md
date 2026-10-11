# Orchestrating parallel porting sessions

One main session (the orchestrator) owns the main checkout, the measurement
baselines, the ledgers, and `docs/porting-status.md`. Side sessions each port
one mechanic in their own git worktree. These rules exist because side
sessions previously had to edit the main checkout: their worktrees lacked
the uncommitted `src/` tree and the ignored corpora.

## Models

Opus usage is the scarce resource. GLM (z.ai coding plan) and Codex are
effectively unlimited, so delegated work goes there.

| Role | Model | Use |
| --- | --- | --- |
| Orchestrator | Opus (main session) | Queue, briefs, merges, conflict resolution, batch verification |
| Well-scoped unit | `glm-5.3[1m]` | One owning C function or mechanic with a clear first difference |
| Hard unit | Codex (`gpt-6.1-sol`) | Broad owners (tty menus), random-call tail, units GLM sent back twice |
| Unit review | Codex `exec review` | Every unit diff, against the C source, before merge |
| Bulk analysis | `glm-5.3-flash` | Clustering divergences, summarizing logs, extracting C bodies; never port code |

Do not delegate to Opus subagents. Implementation that needs no judgment
beyond the brief is still delegated, not done in the main session.

## Before spawning

1. Commit all work and fast-forward local `main` to it. Worktrees branch
   from `main` and receive only tracked files; anything uncommitted is
   invisible to them. Sessions the app creates may branch from the remote
   `main`, which needs a push.
2. Record a baseline at that commit: eval and public `triage-holdout` runs,
   their function tables, and `state-oracle compare`, labelled
   `base-<short-sha>`. Every unit compares against this baseline.
3. Build the queue from the baseline, not from memory: group failing
   sessions by first divergence and owning C file or mechanic. Each unit
   names its example sessions and the first differing call or screen row.
   Units that run together must not share an owning C file.

## Launching a unit

The orchestrator creates the worktree and launches the unit as a background
process. Each unit's brief, log, and final message live in
`.cache/agents/UNIT/` in the main checkout.

```sh
git worktree add .claude/worktrees/UNIT -b daoa/UNIT main
(cd .claude/worktrees/UNIT && node scripts/worktree-setup.mjs)
# GLM unit
zsh -ic "cd .claude/worktrees/UNIT && claude-glm --model 'glm-5.3[1m]' \"\$(cat ../../../.cache/agents/UNIT/brief.md)\"" \
  > .cache/agents/UNIT/log.txt 2>&1
# Codex unit
codex exec -C .claude/worktrees/UNIT --dangerously-bypass-approvals-and-sandbox \
  -o .cache/agents/UNIT/final.md - < .cache/agents/UNIT/brief.md > .cache/agents/UNIT/log.txt 2>&1
```

Both run without permission prompts or a sandbox. Codex's `workspace-write`
sandbox cannot be used: it denies `ps`, which the corpus lock needs, and it
keeps the shared `.git` directory read-only, so the unit cannot commit.
After each unit finishes, confirm the main checkout is still clean.

## Unit brief

Each unit gets one self-contained brief with:

- The owning C/Lua file and functions, and the observable symptom from the
  baseline (session ids, first difference).
- The instruction to read `AGENTS.md` and this file first.
- The acceptance gates below, and the baseline paths under the main
  checkout's `.cache/generalization/`.
- What it must not touch: anything outside its worktree,
  `docs/porting-status.md`, `docs/ledger/`, frozen sources, native patches,
  the scorer, triage, oracle, and guard scripts.

Units commit on their own branch. They never push, merge, rebase `main`, or
record new corpora, and they report open gaps in their final message instead
of editing the handoff.

## Acceptance gates (unit)

1. A behavior test that fails before the change and passes after it.
2. `npm run compile` and the focused tests for the touched mechanics.
3. One public run, checked against the baseline function table and
   `docs/ledger/public-rng.tsv`. Any lost verified call fails the unit.

Corpus runs serialize machine-wide because the corpus lock checks live
processes. Wait for the lock with a polling loop; never kill another
unit's run.

## Orchestrator duties

- Run at most four units at once. More of them would queue on the corpus
  lock rather than go faster.
- Do not edit `src/` files that a running unit is likely to touch.
- Before merging, run a read-only Codex review in the unit's worktree:
  `codex exec -s read-only -o .cache/agents/UNIT/review.md - < .cache/agents/review-prompt.md`.
  (`codex exec review --base` does not accept custom instructions.) Send
  back real findings; do not fix them in the main checkout.
- Merge finished branches one at a time: compile and run the unit's
  focused tests after each merge. Resolve conflicts by reading both sides
  against the C source, not by preferring either branch.
- After a batch of merges, rerun the gates yourself: one full suite, eval
  and public runs, both ledgers, and the state oracle (no new hidden-state
  session, no first state difference earlier). Do not accept a unit's
  reported numbers in place of this rerun.
- Send back units that lose verified calls, add seed- or session-specific
  behavior, or test implementation details. State the reason. A GLM unit
  sent back twice moves to Codex.
- Grow the ledgers with `--write-ledger` only after the batch rerun passes.
  Then update `docs/porting-status.md` once for the batch, and start the
  next baseline from the new commit.
- Work autonomously: this is a contest in agentic engineering. Push the
  integration branch and `main` after each verified batch, refill free unit
  slots from the queue, and keep going without check-ins. Never remove a
  worktree that holds unmerged commits.
- Keep the orchestrator's own context lean: read unit summaries and
  reviews, not unit logs, and delegate any investigation longer than a few
  tool calls to `glm-5.3-flash` or Codex.
