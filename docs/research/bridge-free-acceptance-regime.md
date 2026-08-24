# Bridge-free acceptance regime

Status: adopted 2026-08-24; enforcement slice 1 implemented locally, sealed
evaluation not started.

This regime supersedes public-session and supplemental-animation optimization
as the development acceptance target.  The current public checkpoint remains a
regression baseline, not a coverage claim.  The reason is structural: Phase 2
changes the target and divides parity by a penalty proportional to the `js/`
diff from the Phase 1 freeze.  Trace-specific compatibility code therefore
reduces maintainability and increases future retargeting cost.  See
`docs/PHASES.md` and the official contest site:
https://mazesofmenace.ai/leaderboard/

## Objective

Build a maintainable C/Lua-to-JavaScript port whose acceptance evidence remains
valid when public traces, seeds, roles, options, commands, and target source
change.  Replace aggregate replay with live source-turn scheduling and keep
module ownership explicit enough that a Phase 2 target can be absorbed with a
small, coherent `js/` diff.

The frozen regression baseline at adoption is:

- 44/44 fixture-disabled public sessions;
- 1,435/1,483 supplemental animation frames;
- code checkpoint `6bb6b5b`, documented by `a78a5e3`;
- 48 remaining public animation misses, all crossing named compatibility
  bridges.

Do not optimize those 48 frames for their own sake.

### Enforcement checkpoint 1

The first local slice adds `TELEPORT_BRIDGE_FREE=1` as an enforced runtime
contract:

- top-level fixtures are behind a legacy-only dynamic router, so bridge-free
  startup neither imports their modules nor decodes their trace payloads;
- `replayMoves` is installed as a poisoned property and the one legacy
  classifier reads it only outside bridge-free mode;
- fast-forward, seeded replay, and snapshot-painter boundaries record a
  bounded bridge ID/call site and throw if reached;
- `getBridgeUsageLedger()` exposes per-segment runtime evidence;
- `scripts/audit-bridge-free.mjs` mechanically audits the centralized fixture
  entry and discovered replay exporters;
- the pre-mklev live operations moved to `js/startup.js`, allowing a quiet
  one-command Tourist witness to execute with zero bridge hits;
- `docs/architecture/c-lua-ownership.json` is the validated four-state
  ownership source, with a generated graph and summary.

This is not a generalization result.  No sealed corpus exists yet, actor-rich
compatibility paths intentionally fail loudly, and no public/full corpus or
official measurement was run for this checkpoint.  The next bridge replacement
remains Samurai pet turns and altar-run/prayer scheduling.

## 1. Genuinely bridge-free mode

Add one explicit execution mode (provisional interface:
`TELEPORT_BRIDGE_FREE=1`) whose contract is stronger than
`TELEPORT_DISABLE_FIXTURES=1`.

In bridge-free mode:

- top-level session fixtures and fixture-return paths are disabled;
- `js/fastforward.js` and every fast-forward call are unreachable;
- seeded RNG replay tables/helpers are unreachable;
- screen-snapshot painters and boundary replay helpers are unreachable;
- production behavior may not branch on `replayMoves`, session identity,
  fixed seed identity, or a trace-derived path flag;
- encountering a forbidden bridge fails loudly with the bridge identifier and
  call site rather than silently falling back.

Acceptance requires both a runtime bridge-usage ledger with zero forbidden
hits and a mechanical production-code audit.  Renaming a helper, hiding a
trace table in another module, or preserving a path flag under a different
name is not bridge-free.

## 2. Sealed, stratified C-recorder corpus

Create a deterministic corpus generator separate from the evaluator.  It must
sample fresh combinations across at least:

- seeds and fixed datetimes;
- all roles, legal races, genders, and alignments;
- relevant option families and runmodes;
- dungeon branches, depths, special levels, and save/restore chains;
- movement, inventory, combat, spell, prayer, trap, projectile, travel,
  transition, and debug-command families.

Before execution, write a manifest containing only strata, generation recipe,
tool/source revisions, and cryptographic commitments.  Seal raw C traces and
their per-session identities.  Development code must not read them.

Individual traces remain embargoed until a scheduled evaluation gate.  The
gate reports aggregate and stratified metrics first.  Trace inspection is
allowed only for the predeclared failing sample after the result is frozen and
logged; no repeated peeking or resampling is allowed between implementation
slices.

## 3. Bridge replacement order

Replace aggregate bridges with live source-turn scheduling in dependency order:

1. Samurai pet turns and the altar run/prayer replay;
2. Rogue runs and Rogue/Rogue-Orc actor scheduling;
3. Priest passive projectiles and extended-command replay;
4. startup, role inventory, object initialization, and room-fill replay;
5. remaining fixture painters and seed/session-specific compatibility paths.

Each slice must remove or make unreachable more bridge code than it adds.  A
slice is coherent when its state, RNG, scheduler, display, and continuation
owners are live together; replacing only its final screen is not completion.

## 4. Mechanical C/Lua ownership registry

Create a machine-readable ownership registry for source subsystems and call
boundaries.  Every entry must have exactly one status:

- `implemented`: live, source-owned behavior with a bridge-free witness;
- `partial`: live implementation with a named missing branch/invariant;
- `stubbed`: callable placeholder or compatibility behavior without source
  completeness;
- `absent`: no production owner.

Each entry also records C/Lua symbols/files, JavaScript owner, dependencies,
bridge identifiers, acceptance witnesses, last sealed gate, and exact open
gap.  Generate human-readable maps and coverage summaries from this registry;
do not infer coverage from public-session exactness or prose volume.

## 5. Coherent-slice audit and one publication

For each implementation slice, use focused source witnesses and bridge-free
tests during development.  Do not open the sealed corpus.  At the scheduled
gate:

1. verify the dirty-tree and process-safety guards;
2. run the bridge-free static/runtime audit;
3. run the sealed stratified corpus once;
4. freeze aggregate results and only then inspect the predeclared failing
   sample if the gate allows it;
5. run public engine-only and normal/browser gates as regressions;
6. audit the ownership registry and the removed-versus-added bridge surface;
7. publish the branch once and request one official hidden measurement.

No push, workflow dispatch, or official measurement is authorized before this
gate.  A coherent subsystem slice—not a score fluctuation—is the unit of
publication.

## Evidence hierarchy

From strongest to weakest:

1. sealed bridge-free stratified result;
2. independent bridge-free source witness;
3. public fixture-disabled regression;
4. normal fixture-on regression;
5. supplemental animation, replay-carrier, or screen-only match.

Evidence lower in the hierarchy cannot establish a claim from a higher level.

## Explicit non-results

The following do not satisfy this regime:

- 44/44 public sessions;
- more matched supplemental animation frames;
- a passing mode that merely disables top-level fixtures;
- a fresh seed routed through the same replay/fast-forward machinery;
- an ownership map maintained only as prose;
- a sealed corpus whose traces were inspected during development;
- a bridge removed from one module but recreated under another name;
- a publication made before the one-shot audit gate.

## Stop rules

- Stop immediately if a proposed fix depends on trace identity or expected
  output unavailable to a fresh source-owned execution.
- Stop and redesign if bridge-free mode needs a special case for the current
  witness.
- Stop the gate if another corpus/test process is live or memory growth is
  abnormal; never start a duplicate.
- Stop bridge replacement if the slice expands replay surface or lacks a
  source-level ownership boundary.
- Keep the old public checkpoint intact as a regression witness, but do not
  spend work solely to recover supplemental metrics during the migration.
