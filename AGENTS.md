# Teleport contest working agreement

## Goal

Port the complete game mechanics from the pinned NetHack C and Lua sources.
The authored implementation lives in `src/` as strict TypeScript. The files in
`js/`, `test/` (except `test/browser/`), `scripts/`, and `tools/` are emitted
JavaScript for the unchanged grader and runtime entry points. Edit TypeScript
sources, then run `npm run compile`; never repair emitted JavaScript directly.
Do not add session fixtures, recorded-answer playback, seed-specific behavior,
screen snapshots, fast-forward tables, or control flow based on a known trace.

Work from the earliest shared C/JavaScript difference and implement the whole
owning mechanic: state changes, random calls, turn order, display, and resumed
input. Public sessions are examples, not specifications.

## Session context

Start with this file and `docs/porting-status.md`. Read detailed reference
and build docs only for the task at hand. `docs/oracles.md` describes the
per-function, game-state, and coverage measurements; use them to choose and
verify mechanic batches. `docs/orchestration.md` governs parallel sessions in
worktrees: run `node scripts/worktree-setup.mjs` first in a worktree, and
stay inside it. Keep one current handoff in that
status file; do not accumulate per-run reports. Put temporary output in
`.cache/`, retain only useful final diagnostics, and remove temporary source
copies after verification. Do not load logs, generated data, session corpora,
or native build trees wholesale into an agent session.

## Type safety

`npm run check` checks every owned runtime, test, and tool module.
`npm run compile` refuses to emit on a type or type-safety lint error.
Do not weaken compiler settings, exclude modules, use `any`, suppress type
errors, or add index signatures to game entities to make a build pass.
Validate unknown values at file, storage, and browser boundaries. Model real
initialization phases, missing map cells, object ownership, and action results.
A type assertion is not validation. Unsafe narrowing casts and non-null
assertions are rejected by lint; narrow values with checked control flow.
Definite-assignment assertions are rejected too; initialize the value or model
its absence explicitly.
Lint checks parsed comments before running, rejecting native suppression
directives. Nested lint configuration and ignore files cannot exclude owned
sources from the type-safety rules.
Owned source files must use `.ts` or `.mts`; the guard rejects JavaScript,
`.cts`, and `.tsx` files in source directories so they cannot bypass those checks.
Do not use `Object.assign`; it does not
check target field compatibility. Use checked field writes or typed construction.
The `assign` property is restricted to catch aliased constructors and extracted
methods too; give typed domain operations specific names.
Preserve existing object identity when ownership links retain it. Saved-state
and trait restoration must copy only their declared, validated domain fields.
Every `GameState` field must be classified as persistent or transient; the
schema checks this exhaustively at compile time. Validate metadata indices
and fixed map dimensions before accepting saved state.
Keep frozen grader sources unchanged.

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

Before publishing, run the behavior tests once, and check both
verified-function ledgers in `docs/ledger/` against fresh eval and public
runs. A lost verified call is a regression. If `frozen/score.sh` is used,
remember that it copies `frozen/terminal.js` and `frozen/storage.js` into
`js/`; restore those generated copies before committing.
