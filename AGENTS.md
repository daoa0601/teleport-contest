# Teleport contest working agreement

## Current acceptance priority

Read `docs/research/bridge-free-acceptance-regime.md` before planning new port
work.  Public-session exactness and supplemental animation are frozen as
regression witnesses; do not choose work because it improves either metric.
In particular, do not finish the remaining public animation frames while they
are owned by trace-specific compatibility bridges.

The next acceptance target is a genuinely bridge-free execution mode: no
top-level fixtures, `fastforward`, seeded replay helpers, or production control
flow based on `replayMoves`.  Generalization claims require that mode plus a
scheduled sealed-corpus gate.  Do not inspect individual sealed traces between
gates.  Replace bridges by coherent source-owned subsystem slices, maintain the
mechanical C/Lua ownership registry, and publish only after the regime's audit
gate authorizes one measurement.

## Parity journal

Before changing parity-sensitive code, read `docs/research/journal.md`,
`docs/research/public-session-status.md`, and
`docs/heldout-debug-ledger.md`.

Append a timestamped entry to `docs/research/journal.md` after every material
diagnosis, implementation slice, regression result, leaderboard observation,
or priority change. Keep entries newest-at-bottom and use the journal's
template. Record the witness, earliest divergence, prediction, evidence,
decision, measured effect, falsified hypotheses, and next blocker. Never erase
or rewrite an older conclusion; append a correction that links back to it.

Update `docs/research/public-session-status.md` after each full engine-only
corpus run. Update `docs/architecture/original-c-lua-map.md` whenever the
understood ownership or call boundary changes.

## Test process safety

Run at most one full Contest suite or corpus at a time. Before starting one,
inspect the live process/session registry and confirm that no matching
`npm test`, `node --test`, or `ps_test_runner.mjs sessions` process tree is
already running. A yielded command is still running; never launch a duplicate
command as a retry.

When a test command yields a session or cell identifier, retain ownership of
it and poll it until it exits. If the verification is abandoned, interrupted,
or superseded, explicitly terminate that exact session and its child process
tree, then confirm that the processes are gone. Do not treat partial output or
a yielded command as a completed test result.

Prefer focused witnesses while iterating. Reserve a full corpus for an
explicit evidence gate, run it as one managed process, and stop to investigate
sustained abnormal memory growth rather than starting another verifier.

Do not diagnose large RNG transcripts with one `assert.deepEqual()` over the
complete flattened log. Node's assertion formatter can retain and render the
entire mismatch; a 33,000-call failure has already reached 10.3 GB RSS.
Compare per-input slices, stop at the first differing call, and print only a
small bounded neighborhood plus the two slice lengths. Treat any existing
whole-log assertion as an unsafe acceptance check until it is converted.

## Evidence gates

Fixture-on scoring is a public-regression gate, not evidence of
generalization.  The existing fixture-disabled command below disables only
top-level fixtures; it is still allowed to execute `fastforward`, replay
helpers, and `replayMoves` branches, so it is also not bridge-free evidence:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

Before publishing, run the full engine-only suite and then the normal public
suite. `frozen/score.sh` overlays `frozen/terminal.js` and `frozen/storage.js`
onto `js/`; restore those generated copies before committing.

Prefer the earliest shared C/Lua divergence over later transcript symptoms.
Use exact-session replays only as regression witnesses, and label any bounded
behavior bridge explicitly in the journal.
