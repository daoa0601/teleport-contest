# Generate fresh C sessions

The generator records new ground truth from the pinned native NetHack recorder.
It does not run the JavaScript game or choose sessions based on its score.
Generated sessions stay outside `sessions/` and game code.

The commands below run emitted JavaScript. Before running them, and again after
editing any TypeScript source, compile from the repository root:

```sh
npm run compile
```

Continue only after compilation succeeds. This checks the maintained generator,
inspection tools, and game before replacing their emitted files.

## Generate a batch

From the repository root, with the native recorder already built:

```sh
node scripts/generate-holdout.mjs --out .cache/holdout-dev/mixed --count 500 --jobs 2
```

`--count` is the target number of accepted sessions, not attempts. The runner
uses at most four workers. Each worker has its own copied native install,
saves, bones, locks, and score files. The original native install is not used
as writable game state. A session preserves state between its own segments.

To extend or resume a batch:

```sh
node scripts/generate-holdout.mjs --out .cache/holdout-dev/mixed --count 1000 --jobs 2 --resume
```

The runner rejects a second active writer to the same output directory.
It checks existing recordings before resuming. Keep the same `--kinds` when
resuming. Use `--kinds fuzz,explore`, `--kinds recipe`, or `--kinds deep` for
separate development batches. Failed recordings
count against `--max-attempts`, which defaults to three times `--count`.

## Extend the existing development pool

Each directory has its own manifest and resume state:

- `.cache/holdout-dev/adaptive`: 1,000 sessions, `--kinds fuzz,explore`.
- `.cache/holdout-dev/deep`: 1,000 sessions, `--kinds deep`.
- `.cache/holdout-dev/scenarios`: 500 sessions, `--kinds recipe`.

For example, add another 1,000 adaptive sessions:

```sh
node scripts/generate-holdout.mjs --out .cache/holdout-dev/adaptive --kinds fuzz,explore --count 2000 --jobs 2 --resume
```

Then rerun the combined audit below to refresh the aggregate. The current
`.cache/holdout-dev/summary.json` describes all three completed batches.
The pool occupies about 1.5 GiB, including plans and rejected-attempt evidence.
Back it up separately if it must survive clearing `.cache/`.

## Files

- `sessions/`: accepted judge-format version-5 recordings.
- `plans/`: native recording plans, including fresh seeds and policy settings.
- `manifest.json`: accepted sessions, rejected attempts, and their measured coverage.
- `summary.json`: aggregate coverage, actual lengths, depth, and input totals.
- `rejected/`: bounded local diagnostics for attempts that did not pass validation.

All of these files are development data. Do not commit them or import them
from `js/`. `.cache/` is already ignored by Git.

## What varies

The default schedule requests 25% scenario recipes, 40% prompt-aware random
play, and 35% exploration. Acceptance rates can change the final proportions.
The summary reports the actual result. Character choices cycle through legal
role, race, gender, and alignment combinations. Dates use the pinned C moon,
Friday-the-thirteenth, and night rules rather than an astronomical calendar.
Fresh random seeds exclude public seeds and earlier seeds in the batch.

The policies inspect only the native game's screens. They answer prompts,
handle menus and messages, and stop at command boundaries. Scenario actions
dismiss native message pages without consuming their next planned command.
Save/quit and death actions request an actual native process exit. Native death is
an outcome, not a reason to replace a session based on JS performance. Scenario
recipes add targeted inputs and multi-segment state transitions.

The `deep` batch uses native debug commands to raise the character to level
20, then level-teleports to depths from 3 through 45 and explores for 80–400
inputs. It checks the observed experience level and dungeon depth. Crossing
from the Dungeons of Doom to Gehennom first lands in the Valley, so deeper
requests use a second native teleport. No JavaScript state is injected.

Keep these targeted batches separate when reporting scores. They deliberately
over-sample deep levels and particular mechanics. The combined development
pool is not a statistically matched sample of the judge's sessions.

A long requested input budget does not prove a deep game. Read the actual depth
and length distributions in `summary.json`. Likewise, issuing a command does
not prove that its intended subsystem was reached. Recipe verification and
native screen observations provide the narrower evidence.

## Validate and score

The generator rejects missing input observations, unused planned keys,
nonzero native exits, sessions that never enter gameplay, and adaptive runs
that stop inside an unanswered prompt. A clean native exit is also a valid
ending, including the terminal save/quit and death screens. Scenario checks
require the requested effects, including native save and bones state where
applicable. Failed attempts remain in the manifest with bounded diagnostics.

Audit completed batches from their actual recordings, including cross-batch
seed uniqueness and public-seed exclusion:

```sh
node scripts/inspect-holdout.mjs .cache/holdout-dev/adaptive .cache/holdout-dev/deep .cache/holdout-dev/scenarios > .cache/holdout-dev/summary.json
```

The audit refuses an active generation directory. It does not run the JS port
or change which sessions are accepted.

Score only after generation has finished, with no other full suite or corpus
runner active. Freeze the eval sample before the first JS measurement:

```sh
node scripts/triage-holdout.mjs freeze
node scripts/triage-holdout.mjs triage .cache/generalization/baseline-pool
node scripts/triage-holdout.mjs public .cache/generalization/baseline-public
```

`freeze` selects 120 adaptive, 120 deep, and 60 scenario sessions by ascending
SHA-256 of the decimal initial seed. It preserves an existing sample and never
uses JS results. `triage` runs the whole pool, records bounded first differences,
and ranks blockers. Its summary includes the frozen eval subset, so the initial
baseline does not require a second eval run.

After each coherent mechanic batch, run the fixed eval sample and public suite:

```sh
node scripts/triage-holdout.mjs eval .cache/generalization/BATCH-eval
node scripts/triage-holdout.mjs public .cache/generalization/BATCH-public
```

To rank work by C function rather than by first difference alone, post-process
a completed run (no replay; it reads `results.jsonl` and the recordings):

```sh
node scripts/rng-function-table.mjs .cache/generalization/BATCH-eval --baseline .cache/generalization/PREV-eval/functions.json
```

It writes `functions.json` beside the results. A recorded call is verified when
it precedes its session's first random-call divergence; later calls are
unverified, not wrong. The function whose expected call failed is blamed with
the calls its divergence hid. With a baseline from the same corpus, any lost
verified calls are regressions. Screen-only differences do not affect this table.
See `docs/oracles.md` for the ledgers, the game-state oracle, and C coverage.

Use a new output directory for each run. Each session gets a separate process,
a 512 MiB V8 heap limit, a 45-second timeout, and bounded diagnostics. The runner
keeps errors in the expected screen and RNG denominators. An interrupted run
retains partial JSONL results but does not write a completed summary. Only one
corpus may run at a time. Check the process registry before starting it.

These commands invoke the current JavaScript game with the judge's frozen
ISAAC64, terminal, and storage modules. A Node load hook substitutes their source
without overwriting `js/`. Node 22.15 or newer is required for this hook.
The timeout and heap limit can be set with `SESSION_REPLAY_TIMEOUT_MS` and
`SESSION_REPLAY_HEAP_MB`; each summary records the limits used. A resource-limit
failure is a measurement limitation, not proof of a game-mechanic defect.
Do not use JS scores to accept,
reject, replace, or resample generated sessions. Keep measurements and first
differences outside `js/` and `test/`. Report the eval and public results in
`docs/porting-status.md`; run the full pool only to choose the next blocker.

## Make a truly sealed set

This local batch is **dev-private, not sealed**. The agent can read it. Moving
it later to a private repository does not undo that exposure.

Run these generators again with fresh draws on a separate account or machine
whose credentials and files are unavailable to the coding agent. Keep complete
save/restore and bones chains in one tier. A private repository alone does not
isolate an evaluator from untrusted candidate code. Restrict network access,
secrets, logs, and exported artifacts. Keep expected results outside the
candidate process where practical. Export only reviewed aggregate results.

Use a separate, rarely evaluated final pool. Frequent aggregate feedback can
still influence development. If a case leaks, move its entire chain to the
development pool and generate a replacement.
