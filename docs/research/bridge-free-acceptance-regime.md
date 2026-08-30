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
compatibility paths intentionally fail loudly, and no official measurement was
run for this checkpoint.  Subsequent local slices removed the Samurai, Rogue,
Priest, Valkyrie, and Caveman alternate schedulers in favor of live source-
ration, command, prayer, projectile, level-generation, and current-world actor
paths.  Pre-mklev and all-role inventory startup
now also have one live owner; their pre/post replay exports, exhaustive-role
fallback, and unused mineralize transcript are deleted.  The former all-role
"hero and pet exist" loop is no longer cited as mechanics evidence: it could
pass with an inert scheduler and repeated the same weak assertion across roles.
Role-specific C/command-derived state transitions supply the represented
mechanic evidence instead.  Archeologist and Barbarian no longer fall
through to `fastforward.turn` or `scheduler.default-replay-gap`; they use the
same source movement ration, live actor scan, and global maintenance as the
other represented roles.  Archeologist intrinsic Searching is exercised by a
live adjacent-trap discovery, while Barbarian actor proximity exercises the
source safety refusal that leaves an unsafe wait zero-time.  The remaining
ordered replacements are explicitly classified seeded room-fill and role-turn
compatibility paths.  Future Valkyrie `#chat` text no longer injects a post-
generation boulder, and the pit prefix no longer selects fixed movement,
depth-two room, detection, corpse, or actor replay.  Caveman `f` now reaches
shared fireassist through a scheduler-separated canned weapon-swap
continuation.  Matching-sling
fire now selects the source action-level multishot count before independently
splitting and settling each projectile.  A positive command count survives the
fireassist continuation and caps the matching-sling volley after that source
roll.  Fireassist now also searches the live inventory in source order,
honors known-cursed versus known-safe/unknown launcher precedence, and keeps
the pushweapon swap and wield as scheduler-separated canned actions.  Wield
failure continuations remain partial.  Empty-quiver fire now also uses live
source-ordered autoquiver buckets, or ordinary manual selection when the
option is off or no automatic candidate exists.  Manual selection of a primary
or alternate stack now follows the source split-versus-ready-all transaction:
partial selection creates a new quiver identity while retaining one item in
the weapon slot, and moving the whole primary or active offhand preserves its
turn cost even if direction input is later cancelled.  `Q` and the empty-
quiver `f` fallback now share that same live `doquiver_core` owner instead of
using a Ranger-only arrow picker.  The shared transaction owns explicit
clearing, direct counted splits, the 52-letter implicit-split boundary,
armor/accessory/saddle rejection, cursed-loadstone non-splitting, and the
known-versus-newly-discovered welded-primary time distinction.  Hero gold now
has one top-level `COIN_CLASS` identity rather than an aggregate wallet as its
production authority.  Startup, pickup/merge, floor and bag carrier moves,
partial shop debit, partial-count quiver refusal, whole-purse quivering, and a
one-coin quivered detachment have live state witnesses; `_goldCount` remains
only a synchronized legacy cache inside that owner.  Direct unquivered `t` now
moves the whole purse through source strength/weight range, blockers, iron
bars, webs, vertical/swallowed carriers, and floor or monster ownership.
The represented `ghitm()` state matrix distinguishes ineligible and immobilized
misses, greedy catches, shop robbery/credit, priest alignment, vault guards,
and sufficient, insufficient, or forbidden mercenary bribes.  Full
quivered-coin ownership now splits one live child, preserves or clears the
parent quiver as appropriate, and follows ordinary throwit/bhit/thitmonst state:
strength range, underwater range, blockers, webs, greased slip, hard-surface
resistance probes, vertical self-contact, swallowed transfer, immobilized thaw,
and the one-in-three miss wakeup are represented without reusing ghitm catch
policy.  Air/levitation recoil, special floor/level shipping and shop
settlement, complete shopkeeper mollification, presentation breadth,
menu-supplied counts and exact overflow-letter breadth, non-sling count
families, interruption, and broader fire modes remain explicitly partial.
Ranger's final named-start exception is also deleted.  A fresh generated start
which collides with its former coordinate/sink predicate now uses the current
`fmon`/`fobj` graph and source movement ration in both modes, as do all four
legal Ranger races.  `f` no longer selects a dedicated Ranger pager/RNG path:
the shared `dofire` owner queues the alternate-bow swap, resumes through the
canned-command queue, and detaches live quivered arrows.  Healer's future-`szf`
new-moon exception is now deleted as well.  Future bytes blocked behind a save
prompt cannot select startup or actor scheduling; both
legal Healer races use the live movement ration.  Self-directed sleep wands
now spend a live charge, apply sleep resistance or `rnd(50)` negative multi,
advance current actors and global maintenance, and wake through the shared
helpless-turn owner.  The aggregate sleep/wake/search RNG module, early-turn
table, fixed pet/gold mutation, and apple exception are removed.  Monk's exact
move-prefix classifier is now deleted too, along with its fixed hero/pet/goblin
coordinates, fabricated corpse, forced turn counts, search/kick/pickup/eating
branches, trace-only colors, and seeded RNG module.  All three legal alignments
use live actor scheduling; carried and floor corpse meals share live conduct,
Monk guilt/alignment abuse, timed eating, and object removal.  Explicit
normal-mode compatibility classifiers for Knight, Tourist, Wizard, and other
paths remain.  These later
slices have focused fresh witnesses and selected public regressions, but still
no sealed gate or hidden measurement.

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

## Test independence and lanes

`npm test` is the composite local gate: it runs the structural audits and then
`npm run test:behavior`. A test belongs in that behavioral lane only when its
oracle is independent of the JavaScript implementation: a C/Lua rule, a live
command and observable state transition, a cross-owner invariant, or a fail-
before-mutation boundary. Mock call order, callback argument sequences, private
scheduling logs, same-implementation mode comparisons, self-discovery checks,
and values copied from the implementation are not acceptance contracts.

`npm run test:public-regression` is the explicit compatibility lane for tests
derived from recorded public sessions. Exact RNG, screen, and cursor equality
there can detect drift in a frozen witness, but cannot prove correctness or
generalization. The legacy mixed `run_scheduler` and `pet_inventory_split`
files stay in that lane until any useful source-independent contracts are
extracted into focused behavioral tests. A green compatibility lane must never
be reported as bridge-free acceptance.

`scripts/audit-test-lanes.mjs` enforces the first structural boundary across
all default-lane `.test.js` entrypoints and their shared support modules. They
may not read a recorded `sessions/*.session.json` input, import the public
RNG-parity helpers, use a mock/spy API, or introduce a
named `calls`/`callOrder`/`invocations` transcript collector. It also rejects
the known whole-world normal/bridge-free self-oracle, test self-discovery,
production-source-text checksum, and copied-source checksum patterns. Role
scheduler tests may not use bridge-ledger shape or mere tame-pet existence as
their mechanics oracle. Outside the dedicated `bridge_free.test.js` policy
contract, mechanics tests may not read or reset the bridge ledger at all: an
attempted compatibility boundary already throws in bridge-free mode, while
ledger counters do not prove the named game behavior. Exact bridge-free
replays, character-selection traces,
Priest/Race startup traces, and the
trap-victim trace therefore use `.public-regression.js`; only the fresh
quiet-role runtime and fail-loud policy checks remain in
`bridge_free.test.js`. This audit prevents known traces and the most explicit
mock-order checks from inflating the behavioral count, but it is not a
substitute for semantic review of dependency callbacks, result objects,
renamed collectors, or internal call-order assertions.

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
