# Teleport contest working agreement

## Goal

Port the complete game mechanics from the pinned NetHack C and Lua sources.
The JavaScript implementation is the source of truth for what has been ported.
Do not add session fixtures, recorded-answer playback, seed-specific behavior,
screen snapshots, fast-forward tables, or control flow based on a known trace.

Work from the earliest shared C/JavaScript difference and implement the whole
owning mechanic: state changes, random calls, turn order, display, and resumed
input. Public sessions are examples, not specifications.

## Tests

Tests must describe observable game behavior from the C/Lua rules. Do not test
mock call order, private callback sequences, source text, generated reports,
recorded RNG transcripts, or exact copies of implementation data. Delete a
test if changing a correct implementation would break it without changing
game behavior.

Prefer a small test for the mechanic being changed. Run the full test command
once only when a coherent implementation batch is ready.

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

Prefer focused tests while iterating. Stop to investigate sustained abnormal
memory growth rather than starting another verifier.

Do not diagnose large RNG transcripts with one `assert.deepEqual()` over the
complete flattened log. Node's assertion formatter can retain and render the
entire mismatch; a 33,000-call failure has already reached 10.3 GB RSS.
Compare per-input slices, stop at the first differing call, and print only a
small bounded neighborhood plus the two slice lengths. Treat any existing
whole-log assertion as an unsafe acceptance check until it is converted.

## Publishing

Before publishing, run the behavior tests once. If `frozen/score.sh` is used,
remember that it copies `frozen/terminal.js` and `frozen/storage.js` into
`js/`; restore those generated copies before committing.
