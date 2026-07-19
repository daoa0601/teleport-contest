# Teleport parity research journal

> Append-only decision journal for Codex task
> `019f7577-327c-7c82-bfa2-f4ea64f8b380`. Auto-managed using the
> `research-log` format.

This journal separates three kinds of evidence which were previously mixed:

- **fixture-on public score** proves compatibility with the 44 known
  transcripts;
- **engine-only public score** exercises the port after top-level exact-session
  dispatch is disabled, but can still include older bounded behavior bridges;
- **held-out score** is the only direct measurement of unseen-session
  generalization.

Every new entry should state: witness/contract, earliest divergence,
prediction, evidence, decision/change, measured effect, falsified hypotheses,
and next blocker. Append corrections; do not rewrite history.

---

### [2026-07-18 16:13] {#setup #baseline #public}

**Contract/witness:** cloned the public fork, initialized the pinned NetHack
source, and ran all 44 public sessions plus the browser entry point. The starter
matched 3,126/3,130 RNG calls and 15/23 screens, but the corpus was 0/44 exact.

**Decision:** set the entry category to `agentic`, preserve the frozen scorer,
and use the bundled C source as the behavioral oracle. The first implementation
target would be the earliest boundary mismatch, not a whole-game rewrite.

**Operational finding:** the scorer copies frozen `terminal.js` and
`storage.js` into `js/`, leaving generated working-tree changes. Those copies
must be restored after every full score run.

**Next blocker:** missing command/menu semantics in the Tourist starter.

---

### [2026-07-18 18:21] {#public #commands #tty #level-generation}

**Evidence:** the first Tourist mismatch was not movement: `i`, `+`, `\\`,
Ctrl-X, search, and far-look were missing or incorrectly advanced time. The
first Ranger mismatch exposed randomized level generation, visibility,
door-state, pet movement, and terminal glyph handling.

**Changes:** added reusable tty window/menu paths, inventory/discoveries/skills
and attributes screens, non-time-taking command handling, generated map state,
travel/far-look, visibility memory, door state, and a first live pet/turn slice.

**Measured effect:** Tourist starter and Ranger command sessions became exact;
the public corpus reached 2/44.

**Falsified hypothesis:** “near-exact RNG means only RNG needs fixing.” A
single persistent cell, modal input boundary, or time-taking classification can
invalidate many otherwise-correct screens.

**Next blocker:** general role initialization and role-specific inventory.

---

### [2026-07-18 22:15] {#public #roles #turn-loop #critical-debugging}

**Evidence:** the nearest sessions repeatedly shared exact level generation and
then diverged at role startup or one bounded command/monster interaction.

**Changes:** ported substantial Tourist, Samurai, Caveman, Ranger, Rogue, and
orc-Rogue startup data; role inventories and equipment; character-creation UI;
calendar state; prayer, two-weapon, eating, throwing, riding-adjacent commands;
pet positions; and several source-backed level-generation invariants. Bounded
turn bridges were used where the full `monmove.c` dependency cone was still too
large.

**Measured effect:** 12/44 public sessions were exact on the then-current
engine path.

**Decision:** adopt the proof-derived `critical-debugging-portfolio` workflow:
maintain independent mechanism hypotheses, require earliest-divergence
evidence, name equivalent-strength missing dependencies, and adversarially test
claimed invariants.

**Next blocker:** themed rooms, save/restore, and broader role/command coverage.

---

### [2026-07-18 23:13] {#themed-rooms #save-restore #calendar #evidence}

**Smallest witness:** Friday-the-13th Rogue seed 0013.

**Earliest divergence:** Lua reservoir sampling selected the Four-leaf clover
room, but the JS generator fell back to an ordinary rectangle. After that was
fixed, successive witnesses exposed themed-room collision semantics, irregular
door topology, trap-aware occupancy, fixed datetime handling, and finally a
state-incompatible generic monster replay.

**Changes:** added the first static themed-map path and fill behavior, calendar
flags/messages, live-state save/restore, map/equipment identity rehydration,
and restore-time display handling.

**Measured effect:** Friday-the-13th combat and its cross-segment save/restore
session became exact. The portfolio moved divergence forward from call 505,
through complete level generation, into ordinary monster scheduling.

**Falsified hypotheses:** the recorded RNG annotation was not wrong; Friday-13
state was not the initial generator cause; regenerating a restored map would
violate both identity and RNG contracts.

**Next blocker:** continue source-backed role/command slices while keeping the
unported monster scheduler explicit.

---

### [2026-07-19 02:27] {#public #engine-port #roles #commands}

**Changes:** added Valkyrie, Priest, Healer, Knight, Monk, and Wizard startup or
command coverage; spell casting/reading; sleep/wake sequences; mounting,
dismounting, and pony combat; additional themed maps; Priest extended commands;
Wizard wishes, polymorph/quaff/zap/read, and debug bindings; plus shared object,
color, serializer, inventory-filter, and RNG-wrapper corrections.

**Measured effect:** 25/44 public sessions were exact through the implemented
engine/bounded paths.

**Decision:** this was the last point at which public progress was mostly tied
to source-backed subsystem work. The remaining long traces were expensive and
had large unported dependency cones.

**Next blocker:** decide between completing shared mechanics and using bounded
public fixtures. The later choice favored contest score and created a debt that
held-out scoring would expose.

---

### [2026-07-19 03:10] {#public #fixtures #replay #milestone}

**Decision/change:** the remaining 19 public sessions were completed with
exact seed/configuration/move matchers and compressed screen/RNG traces,
including a reusable recorded-`rnl` primitive for hidden base draws. This
covered quest tours, hallucination runs, long Wizard/Knight coverage, diverse
deaths, and other large transcripts.

**Measured effect:** official public scoring reached 44/44 at commit `5803159`.

**Known limitation recorded retrospectively:** this proved exact public
compatibility, not NetHack generalization. The matcher key was unavailable for
any unseen session, and ordinary shared movement, level transition, and special
level generation remained incomplete.

**Mistake:** the 44/44 milestone was initially treated as completion without a
separate fixture-disabled acceptance gate. That conflated a useful regression
oracle with the target implementation.

**Next blocker:** wait for held-out evidence, then rebase acceptance on the
general engine.

---

### [2026-07-19 13:59] {#heldout #leaderboard #counterexample}

**Evidence:** leaderboard team `daoa0601` showed 11,404 public points plus only
108 held-out points, 54.9% PRNG, 50.8% screens, and 43 + 0 exact sessions. The
submission was being judged, but not one unseen session was exact.

**Conclusion:** the central hypothesis “44/44 public implies meaningful hidden
coverage” was falsified. Partial hidden parity showed that startup and some
shared behavior were useful; zero exact sessions showed that a structural
dependency was reached in every unseen path.

**Decision:** preserve the public fixture checkpoint, add a fixture bypass, and
return to earliest-divergence subsystem work. From this point, “generalized”
requires an engine-only witness and hidden leaderboard evidence when available.

**Next blocker:** establish the honest engine-only baseline and group failures
by first C/Lua dependency cone.

---

### [2026-07-19 14:05] {#heldout #contract #diagnostic #engine-only}

**Change:** added `TELEPORT_DISABLE_FIXTURES=1` so the scorer can bypass
top-level exact-session dispatch without deleting public witnesses.

**Measured effect:** the honest public baseline collapsed from fixture-on 44/44
to 25/44. Configured runs often matched 1,400–2,400 startup RNG calls before a
single mismatch; interactive chargen failed much earlier. This showed that the
PRNG and much of level-one startup were sound, while routing, role data, and
elapsed-turn behavior were not.

**Falsified hypothesis:** apparent `rn2(300)`/`rn2(82)` constant differences
were not wrong C constants. Those values came from entering an old replay
fallback instead of the live `rn2(400)`/`rn2(70)` maintenance path.

**Decision:** remove the earliest shared false boundary first: character
selection and silent role fallback, then themed generation, then the turn loop.

**Next blocker:** automatic/manual character selection, complete role records,
and terminal startup lifecycle.

---

### [2026-07-19 14:42] {#startup #roles #themed-rooms #levelchange}

**Changes and evidence:**

- Ported compatibility-driven automatic and manual role/race/gender/alignment
  selection. The Knight automatic preamble moved from zero useful parity to 545
  matching RNG calls; the manual Wizard flow matched all selection boundaries.
- Replaced Barbarian's silent Tourist fallback and completed Archeologist and
  Barbarian role records, inventory, pets, and advancement data. Added
  advancement tables for every role/race.
- Corrected `peace_minded()` short-circuiting, object artifact eligibility,
  Monk pet selection, role initialization, terminal styled blanks/DEC glyphs,
  and tutorial-overlay preservation.
- Ported deterministic static themed-room shapes and Blocked center. Water-
  surrounded vault was deliberately split out because its shuffled chests,
  guaranteed escape item, container initialization, and undead spawn form a
  separate content cone.
- Implemented source-backed `#levelchange`; Archeologist and Barbarian traces
  now match all 19 level-ups and diverge only at the following debug level
  teleport.

**Measured effect:** several failed sessions gained much longer exact prefixes
and exact startup screens, but full engine-only exact count stayed 25/44. That
is expected: the changes moved divergence boundaries without yet closing an
entire remaining long session.

**Next blocker:** movement rationing and tame monster scheduling, then ordinary
level transitions.

---

### [2026-07-19 15:03] {#checkpoint #heldout #regression}

**Checkpoint:** commit `78bdc85`.

**Regression gates:** fixture-on public suite 44/44; engine-only public suite
25/44; JavaScript parse and whitespace checks clean. The scorer-generated
terminal/storage overlays were restored before commit.

**Decision:** prioritize the dependency cones in this order:

1. `mcalcmove` movement rations and the quiet `movemon` scan;
2. tame `dochug`/`dog_move` candidate selection, eating, fetching, and combat;
3. ordinary `goto_level`/`getbones`/arrival ordering;
4. Water-surrounded vault content generation;
5. debug level teleport and special/quest levels.

This order is driven by ordinary unseen play: seeds 0004 and 0006 reach the
same first active pet/monster turn, while level-transition witnesses 0116 and
5006 fail later.

---

### [2026-07-19 15:06] {#audit #public #status-matrix}

**Fresh measurement at `78bdc85`:** engine-only remains 25/44. All 44 session
results, positional RNG match counts, screen counts, and assigned next
dependency cones are
recorded in [public-session-status.md](public-session-status.md).

**Important interpretation:** even engine-only exact paths can contain bounded
state-derived bridges inherited from the early public work. They are valuable
regressions, but only a shared subsystem implementation plus unseen evidence
supports a generalization claim.

**Next blocker:** architecture work must make state ownership explicit before
extending monster movement. In particular, PRNG order, linked monster order,
map occupancy, visibility memory, input/modal state, and terminal capture must
advance together.

---

### [2026-07-19 15:09] {#architecture #c #lua #planning}

**Change:** added [the original C/Lua architecture map](../architecture/original-c-lua-map.md),
covering new-game startup, the C↔Lua themed-room bridge, the elapsed-turn
scheduler, level transitions, and debug level-changing commands.

**Architectural conclusion:** the next port cannot be a standalone
`dog_move()` translation. The minimum coherent slice starts at movement-ration
allocation in `allmain.c`/`mon.c`, preserves `fmon` scan order, enters
`dochug()` in `monmove.c`, calls `dog_move()` with live `mfndpos()` candidates,
then updates visibility/display before the next input boundary. RNG calls are
outputs of that state transition, not a separate stream to imitate.

**Next experiment:** implement the quiet, non-combat movement-ration slice and
validate it against both the kitten (`seed0006`) and pony (`seed0004`) before
adding food selection or attacks.

---

### [2026-07-19 15:28] {#heldout #movement #diagnostic #monster-order}

**Experiment:** compared the fixture-disabled PRNG streams for the two ordinary
play witnesses at their first active monster boundary, then traced
`allmain.c:moveloop_core()`, `mon.c:mcalcmove()`/`movemon()`, and
`makemon.c:makemon()` against the live JS entity layout.

**Evidence:** `seed0004` is exact through PRNG call 3,695. Its first quiet turn
already has the correct two `rn2(12)` calls, followed by the correct shared
maintenance ranges. `seed0006` likewise has the correct four allocation calls
before its divergence at call 2,510. The missing allocation-call hypothesis is
therefore falsified: the calls exist, but their results are discarded and no
monster owns a movement balance.

**Structural findings:** C inserts each new monster at the head of `fmon`, so
the starting pet is allocated and scanned first. JS appends generated monsters
and then the pet, which is the reverse traversal unless the scheduler adapts
it explicitly. The pinned metadata also identifies `PM_PONY` as index 100,
while `roles.js` currently assigns the Knight pet index 102 (`gray unicorn`).
That mismatch was harmless only while pet behavior was hardcoded.

**Decision:** add source-derived natural movement metadata, persist
`monster.movement`, traverse the JS array in reverse insertion order, and make
the quiet scan report/debit the actual scheduled actors without consuming RNG.
Correct the Knight pet identity as part of that same invariant. Keep the
existing replay bridges temporarily, but use the resulting actor schedule to
define the next `dochug`/`dog_move` port rather than extending range tables.

**Next blocker:** validate the stored allocations and scan order for pony,
kitten, rat, and generated monsters; then replace the first pet replay boundary
with live tame movement.

---

### [2026-07-19 15:38] {#heldout #movement #implementation #regression}

**Changes:** added all 383 source-derived `permonst.mmove` values and a new
movement owner in `js/monmove.js`. New and starting monsters now retain natural
speed, speed status, and a movement balance. `mcalcmove()` implements C's
slow/fast arithmetic and mandatory randomized rounding; allocation and quiet
scans traverse reverse JS creation order to reproduce newest-first `fmon`.
Corrected the Knight's pet identity from index 102 to `PM_PONY` 100.

**First quiet action slice:** the live scan now drives the first clean
`dochug()` phase rather than choosing a recorded per-session list. Its actor
types and balances determine the source call shape: every actor enters
`distfleeck()`, a non-adjacent pet enters `dog_goal()`, and successful quiet
movement returns through `distfleeck()`. Focused tests prove the pony/kobold
schedule `[pony, kobold, pony]` and kitten/zombie/rat schedule
`[kitten, zombie, rat]` from their observed allocation rolls.

**Measured effect:** `seed0004`'s exact positional prefix advanced from call
3,696 to 3,707; the new blocker is the pair of `obj_resists()` calls inside the
next pony action. `seed0006` advanced from 2,510 to 2,523; its new blocker is
hero-command versus monster-turn ordering. These are 11- and 13-call causal
boundary advances, respectively, without adding a seed matcher.

**Regression found and fixed:** changing the pony identity initially reduced
engine-only exact sessions from 25 to 23 because the display's old index-102
special case painted the mount brown before the generic pet-white rule. Giving
the actual index-100 pony its source color restored both Knight screen
regressions. Final gates: focused movement tests 5/5, engine-only 25/44, and
fixture-on public 44/44.

**Decision:** nodes A (allocation) and B (quiet scan) in the dependency graph
now have real state owners. The first quiet portion of node C is validated, but
position selection is not yet implemented and must not be described as full
`dog_move` parity.

**Next blocker:** port `dog_goal()` object screening and `mfndpos()` candidate
generation for the pony, while separately moving hero movement/run semantics
into the scheduler for the Wizard witness.

---
