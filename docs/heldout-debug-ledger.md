# Held-out parity debugging ledger

This is the compact blocker ledger. The append-only decision history is in
[`docs/research/journal.md`](research/journal.md), the fresh 44-session
engine-only matrix is in
[`docs/research/public-session-status.md`](research/public-session-status.md),
and the original C/Lua dependency maps are in
[`docs/architecture/original-c-lua-map.md`](architecture/original-c-lua-map.md).

## Contract

The judge compares two positional streams for each session:

1. every core PRNG call (`rn2`, `rnd`, `d`, and related wrappers), including
   its argument and result;
2. the rendered 80x24 terminal grid and cursor at every input boundary.

An exact session requires both streams to match completely. Public-session
fixture dispatch can prove that the scorer and serializer work, but it cannot
provide evidence about an unseen session. Use the real-engine diagnostic mode:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

Latest full fixture-disabled matrix on July 21: **31/44 exact real-engine sessions**.
The public leaderboard showed **43 + 0 exact sessions** and **108 held-out
points**, so the hidden failure is structural rather than a submission or
scorer outage.

## Earliest-divergence portfolio

| Witness | Earliest real-engine divergence | Dependency cone | Current result |
| --- | --- | --- | --- |
| `seed0004` Knight | Closed | movement/pet/combat -> tty overlays/message history -> object observation -> experience | **Exact 12,084/12,084 RNG and 409/409 screens/cursors** |
| `seed0006` Wizard | Closed | ordinary descent -> wall mode/seenv -> tty menus -> shop/stock -> fountain demon -> cached return/follower -> fatal multiattack -> disclosure/overview/tombstone | **Exact 6,736/6,736 RNG and 123/123 screens/cursors** |
| `seed0013` Rogue save/restore | Closed | successful save -> tty shutdown/farewell -> shared-storage restore | **Exact 4,804/4,804 RNG and 99/99 screens/cursors** |
| `seed0017` Samurai | Closed | doorway run stop -> corridor-turn memory -> altar prayer occupation -> mode-aware extcmd completion | **Exact 3,465/3,465 RNG and 67/67 screens/cursors** |
| `seed0015` Valkyrie | Closed | ordinary generation branch-room selection -> coordinates -> room fill, then pit/dog wait | **Exact 8,563/8,563 RNG and 44/44 screens/cursors** |
| `seed0009` Ranger tutorial | Closed | tutorial entry -> engraving/run -> door/kick/decor -> liquid avoidance/crawl -> fatal lava/disclosure | **Exact 3,713/3,713 RNG and 73/73 screens/cursors** |
| `seed0012` Monk | Closed | pet scheduler/identity -> traps/shop -> themed vault/guard escort -> tty projection/search interruption | **Exact 13,878/13,878 RNG and 308/308 screens/cursors** |
| `seed0101` Ranger | Closed | travel message pager -> Lua PICK_NONE tip -> getpos input routing | **Exact 2,371/2,371 RNG and 27/27 screens/cursors** |
| `seed0107` Samurai | Closed | completed-turn exercise -> #enhance tty row margin/attribute | **Exact 2,902/2,902 RNG and 98/98 screens/cursors** |
| `seed0700` Samurai | Closed | old-turn distress/allocation -> moves increment -> modulo-ten exercise | **Exact 3,230/3,230 RNG and 51/51 screens/cursors** |
| `seed0900` Tourist | Closed | full-height inventory -> one-page tty marker/cursor | **Exact 2,983/2,983 RNG and 84/84 screens/cursors** |
| `seed0116` Wizard | Closed | welcome/tutorial -> armor projection -> object/monster metadata -> premapped Sokoban -> debug/modal windows | **Exact 12,562/12,562 RNG and 127/127 screens/cursors** |
| `seed5006` Tourist | Closed | two-game transition, bones restore, prayer, death/end UI | **Exact 13,923/13,923 RNG and 249/249 screens/cursors** |
| `seed0007` Rogue | Exact RNG prefix **6,414**; input 85 C `rn2(20)` vs JS `rn2(10)` in corpse-eating slice | `doeat` corpse effects/occupation -> elapsed live turns | Screen prefix through input **84**, cursor prefix through **97**; concrete Orc weapon identity and input-82 kill exact |
| `seed0361` Archeologist | Debug world tour after level-up | `#levelchange`, then debug level teleport | All 19 level-ups now match; next divergence is later tour generation |
| `seed0373` Barbarian | Debug world tour after level-up | Same debug command cone | All 19 level-ups now match; next divergence is `wizlevelport` |
| arbitrary themed seed | Reservoir selects an unported room shape | Lua themed map placement and contents | All deterministic static shapes plus Blocked center and Water-surrounded vault are ported; other unseen themed content remains an open generalization surface |

The two ordinary-play witnesses (`0004`, `0006`) are the minimal counterexample
to the previous strategy: a correct startup and command handler are not enough
when one elapsed turn enters an incomplete monster scheduler.

## Confirmed invariants

- Character selection uses C role order (Rogue precedes Ranger), legal
  role/race/gender/alignment completions, and the same random-choice draws.
- Character selection distinguishes facet skipping from tty menu entry.
  `plsel_startmenu()` runs source-ordered `rigid_role_checks()` and a sole
  rigid candidate consumes `rn2(1)`; a facet block which never constructs a
  menu assigns its sole value without a draw. Role/race filters constrain the
  complete remaining role-race graph.
- Archeologist and Barbarian use full role records, real inventory generation,
  pets, and level advancement data. Advancement records are now present for
  every role and race.
- Static themed maps are placed through one collision/topology path instead of
  seed-specific layouts. Blocked center preserves its 30% terrain replacement
  branch and RNG draw.
- `#levelchange` uses live HP/energy advancement, rank changes, intrinsic
  messages, and exact get-line cursor behavior. The two recorded level-20
  witnesses match every command boundary and PRNG call in that subsystem.
- Terminal capture serializes semantic cells, including DEC line drawing,
  ANSI style transitions, styled blanks, and cursor-forward gaps.
- Every monster now owns its source-derived natural speed and movement balance.
  Allocation and scan traverse reverse JS creation order to reproduce C's
  newest-first `fmon`; the seed0004 and seed0006 actor schedules are covered by
  focused tests.
- Once-per-global-turn monster distress is a separate newest-first scheduler
  phase before allocation. It owns regeneration, the six calendar-gated were
  identities, and blindness/freeze/flee expiry; seed0116 input 124 proves its
  `rn2(50)` human-were check in source order.
- Sokoban pet movement filters the physical `mfndpos()` set through
  `m_avoid_soko_push_loc()` before random candidate scoring. A tame actor does
  not occupy the hero-side stance behind a boulder; this closes seed0116's
  final two-call engine discrepancy without embedding level coordinates.
- Welcome paging selects inline versus row-1 `--More--` placement from the
  concrete 80-column width, not role identity. Wizard tutorial preservation is
  a separate text-window policy; together they close seed0116 boundaries 1--5
  without regressing seed5006's longer Tourist greetings.
- Armor class is rebuilt from form AC, complete source armor metadata, worn
  slots, erosion, and protection sources. Startup, delayed wear, and takeoff
  share this projection; corrected shirt/cloak IDs remove presentation-hidden
  aliases and close seed0116's persistent post-takeoff status difference.
- All 481 source object colors are generated and travel with their unidentified
  descriptions through gem substitution and class shuffles. Map glyphs now use
  live object metadata, closing the quarterstaff witness and 77 downstream
  seed0116 screens without class-wide color guesses.
- The quiet ordinary-land slice now owns C-order `mfndpos()` candidates,
  tame/hostile coordinate mutation, monster tracks, and repaint requests.
  `seed0004` proves the pony's early live destinations and the kobold's
  source-derived recent-track roll rather than padding either call sequence.
- `dog_goal()` now screens live floor piles and, when directionless, the hero's
  inventory in source order. The Knight's two floor items, six equipment items,
  and first apple arise naturally and advance `seed0004` to its uppercase-run
  boundary.
- Shift-direction commands now persist across `moveloop_core()` invocations.
  Monster/global maintenance interleaves between successful automatic squares,
  corridor bends are derived from live terrain, and input resumes only after
  `lookaround()` or an obstacle clears the run.
- Turn maintenance owns a 100-position hero track ring. Pets which lose
  potential sight of the hero follow the newest adjacent track; this invisible
  goal input is tested separately from rendered hero/pet coordinates.
- `test_move()` distinguishes mask-zero/broken doorway gaps from intact
  doorways. Diagonal entry and exit are permitted only for the former instead
  of rejecting every cell whose terrain type is `DOOR`.
- `mktrap_victim()` links its ammunition and cursed possessions into the
  victim square's live object chain. Their later `dog_goal()` screens are
  downstream observations of level generation rather than replay padding.
- `domove()` now dispatches the first live bear trap after showing the floor
  pile, stops a pending run, and persists `utrap` across diagonal movement
  attempts. Wounded-hero `regen_hp()` owns its C-order percentage roll after
  hero tracking and before hunger.
- `dog_move()` screens each uncursed candidate-pile object through `dogfood()`
  before applying cursed-square avoidance; cursed items mark reluctance but do
  not themselves call `dogfood()`.
- A Burdened hero receives a 9-point movement allotment and remains inside the
  monster/global-turn loop until a full 12-point ration is available. Wounded
  leg timeout/exercise and the pet's blocking reluctance pager occur inside
  that source-shaped loop rather than once per input byte.
- `postmov()`-equivalent trap dispatch now catches a pony which moves onto a
  bear trap, applies one `d(2,4)` call, persists `mtrapped`, and routes later
  attempts through `mintrap()`'s `rn2(40)` escape gate before movement.
- `dochug()` bypasses generic movement for an adjacent hostile and reaches the
  first `mattacku()` roll without a second `distfleeck()`. Hero movement into
  that hostile square owns combat hunger/exercise, hit, damage, kill/corpse
  rolls, actor removal, and the resulting message as one transaction.
- A successful `maybe_generate_rnd_mon()` gate now owns legal-coordinate
  retries, `rndmonnum()` selection, live monster/group/inventory construction,
  and newest-first scheduler membership. The first generated grid bug applies
  `NODIAG` consistently to `mfndpos()` and adjacent hostile attack eligibility.
- `dog_invent()` screens a pet's current floor object before `dog_goal()`.
  Candidate trap visibility (`trap.tseen`) and monster trap knowledge
  (`mtrapseen`) are distinct, hero-distance drives track avoidance, and a
  stationary pet result still reaches post-move trap dispatch.
- Persistent run mode stops after committing a doorway/furniture boundary.
  Generic comma pickup transfers a live floor object to inventory and consumes
  time instead of advancing the transcript without changing the level.
- Grid-bug combat owns passive contact, electric damage/cancellation/item and
  knockback checks, long-sword damage, removal, and corpse placement.
- Count-prefixed search is a timed occupation rather than a local loop inside
  `dosearch()`: the explicit action installs the remainder, and every repeat
  crosses a complete monster/global scheduler cycle before the next input.
- A pet which cannot see the hero, find an adjacent hero track, or reuse an old
  goal uses `do_clear_area()` visibility from its own square and chooses the
  visible cell closest to the hero. Hero vision is not a substitute for this
  arbitrary-origin query.
- Hero movement into a boulder is an object transaction: `dopush()` exercises
  Strength, transfers the same object to the square beyond, repaints both
  piles, and only then commits the hero to the vacated square.
- `#loot` and multi-object comma pickup are nested command transactions.
  Container action and Enter-time selection commits—not the keys which open or
  toggle their modal menus—own elapsed turns. Gold remains wallet currency,
  while selected floor-object identities retain quantities and poison state.
  Looking inside or attempting to take from an empty container commits
  `cknown` on that same identity; later `empty` presentation is knowledge-gated.
- Pet `mfndpos()` preserves occupied neighbors when `ALLOW_M` is present.
  `dog_move()` applies its balk rule before `mattackm()`, and kick/bite hits,
  passive contact, knockback, and immediate defender counterattack are one
  source-ordered combat owner.
- Fatal pet combat derives `corpse_chance()` from species frequency and size,
  constructs and places a live corpse when selected, removes the defender
  from later scheduler scans, and reaches `grow_up()` before returning.
- Undead fatalities use `undead_to_corpse()` and subtract `TAINT_AGE + 1`.
  Pet goals still take the apport roll for poisonous corpses, but the result is
  committed only after `can_carry()`; the kitten rejects the 400-weight kobold
  corpse and leaves it for the hero's later run boundary.
- `postmov()` is part of monster movement ownership. A capable hostile first
  enters a closed-door square and then commits `D_ISOPEN`; the following hero
  run must inspect that mutated terrain rather than the pre-move door state.
- Non-travel running stops on a live floor object before another automatic
  square, and `check_here()` reports the named object at that same tty input
  boundary.
- Arbitrary-origin vision has an ordered callback contract. `view_from()`
  emits the start row, downward quadrants, then upward quadrants; strict
  `wantdoor()` minima use that order to break equal-distance pet-goal ties.
- Random-monster gender is species-gated persistent state. Fixed male, fixed
  female, and neuter flags bypass `rn2(2)`; only unrestricted species draw a
  random sex before inventory construction.
- A starting pet snapshots `edog.apport` before final hero attributes are
  generated, so the Knight pony owns creation-time Charisma 3. `dog_invent()`
  reaches its `rn2(20)` fetch roll only after food, curse, fetchability, and
  carryability gates; a medium corpse can suppress a roll which a later small
  corpse owns.
- `PICK_ANY` preserves special accelerators: `$` does not consume an alphabetic
  selector and `@` toggles all rows. Enter owns wallet/inventory mutation;
  `P` then owns ring selection and finger state. A worn conflict ring causes
  separate resistance checks in `dog_move()` and `mon_allowflags()` before
  pet candidate scoring.
- `getobj("read")` is a persistent nested request: `?` can display eligible
  objects without cancelling the command. A magic scroll's effect runs before
  its disappearance pager collects input. Discovery and invocation exercise
  Wisdom separately, and `safe_teleds()` tests each random coordinate against
  live map occupancy before mutating hero position and vision.
- First-use travel preserves two tty prompt boundaries and a distinct Lua
  far-look page. `.` installs scheduler-resumed run mode 8; reverse C-ordered
  BFS and `TRAVP_GUESS` visible-frontier routing are recomputed after each
  elapsed monster/global turn. Repeat travel skips the one-shot tutorial.
- TTY CR is normalized to the vi `^J` rush-south binding. Lichen uses shared
  melee/passive/death logic, and a selected corpse is constructed through
  `mksobj(CORPSE)` before its provisional species is overwritten.
- Floor-corpse eating is an occupation. The selected object survives the
  confirmation and continued-bite turns, then `done_eating()` removes that
  identical floor object and emits the combined finish message.
- `mineralize()` persists non-buried gold/gems into the floor chain and buried
  results into separate state. Ordinary corpses retain their already-drawn
  decay deadline and are removed by turn maintenance before AI object scans.
- Conflict applies to generated ordinary hostiles as well as the pet. Each
  hostile owns its resistance call before `m_move()`, so a long travel can
  grow the actor schedule without losing property-dependent calls.
- Semicolon quick far-look is a zero-time getpos client. It reuses the cached
  travel coordinate, prioritizes seen traps in automatic descriptions, and
  restores the hero cursor after the verbose selected-glyph description.
- Thrown pet food persists beyond the command: two-square flight, floor-stack
  merging, current-square `dog_invent()` consumption, stack splitting, and the
  following `meating` scheduler pass retain source ownership across inputs.
- Nested `getobj()` cancellation is boundary-sensitive. A first space can
  dismiss an invalid-object pager and the next space can cancel the reissued
  eat prompt; neither byte is available to the outer command loop.
- Trap-victim race identities use generated PM indices, not source-table
  guesses. Their corpse age is backdated into the tainted-food window before
  a much later `dog_goal()` scan observes it.
- The options command is a persistent two-page, zero-time transaction. Its
  pickup-type editor owns keys until Enter, and page/toggle transitions retain
  their source cursor boundaries without entering monster maintenance.
- `pet_ranged_attk()` performs target discovery and `score_targ()` even for a
  kitten with no usable ranged attack. PM_KITTEN then owns a 1d6 melee bite;
  fatal contact reaches corpse construction and `grow_up()` before the next
  actor or movement allocation.
- Ordinary level construction preserves the source order from bones rejection
  through room fill, shop selection, shopkeeper and stock/mimic creation,
  vault construction, and `mineralize()`. Every created object and monster is
  retained in the live destination graph consumed by later scheduling.
- Level return restores the cached graph rather than regenerating it. Hider
  checks run on restored monsters, an eligible adjacent hostile can migrate,
  and `mon_arrive()` placement shuffles source-ordered rings clipped against
  the destination edge.
- A disguised mimic receives and spends movement but exits before `dochug()`;
  it therefore contributes actor timing without a movement/AI RNG slice.
- Water-demon combat is a resumable tty transaction. Weapon, claw, bite,
  knockback, and HP changes commit on their source side of each pager, and the
  actor/global scans stop as soon as `gameover` commits.
- Confused teleport-scroll reading is a resumable cross-subsystem transaction:
  two tty pagers and `getlin()` precede random level choice; scroll discovery
  precedes deferred destination construction; C/Lua generation and follower
  arrival finish before an old-map `Oops...` pager; only its acknowledgement
  exposes the new graph to the live elapsed-turn scheduler.
- Inventory letters are allocated by a persistent rotating `lastinvnr`, not by
  live array length or first hole. Wand self-death transfers control from
  command effect directly into resumable `done()`/bones/end-window ownership;
  it never returns to ordinary actor maintenance. Corpse, inventory-drop, and
  ghost RNG are reproducible through generic live constructors.
- Bones persistence is a level-graph contract, not a whole-game snapshot. The
  seed5006 payload restores 3 monster and 46 object identities, reproduces all
  49 `next_ident()` calls, then reuses generic hero and follower arrival plus
  `familiar_level_msg()`; segment-two inputs 6–9 are screen/cursor exact.
- Prayer is a timed occupation over the restored graph. Three ordinary actor
  and maintenance rounds precede `prayer_done()`; retained movement credit,
  `mux`/`muy`, and sleeping state are downstream bones observations rather
  than prayer-specific replay. Existing-bones replacement is decided before
  any second drop/ghost mutation.
- Old-level release resets the global hero trail indirectly:
  `savelev()->save_track(release_data)->initrack()`. Destination maintenance
  then repopulates it with `settrack()`. A departed-level coordinate can be
  geometrically valid on the new map and silently change a later hostile's
  deterministic candidate choice before any changed RNG call.
- Fatal hero combat uses `mkcorpstat(CORPSE)` as a shared runtime constructor:
  provisional random species and timers are transitioned to the final species,
  then one object identity enters both the square pile and newest-first `fobj`.
- `dog_goal()` applies its hunger/food gate before hero-inventory fallback.
  `dog_nutrition()` derives corpse eating time from generated body weight as
  `3 + (cwt >> 6)`; generated neutral monster names own both combat and corpse
  presentation rather than encounter-local fallbacks.
- Wizard-forced favorable prayer still enters the generic three-turn
  occupation and, after its shimmering-light pager, still executes the
  favorable `pleased()` selection and `rnz(350)` timeout.
- Wizard destination menus are generated from the live dungeon, branch, and
  special-level graph. Their three-page PICK_ONE state commits a
  `{dnum,dlevel,prototype}` destination; `bigrm` and `soko1` are not
  string-to-depth exceptions.
- A named special level crosses a reusable operation boundary. C owns variant
  choice, alignment shuffle, default lighting, coordinates, constructors, and
  finalization; the Lua file owns map data and operation order. The current
  `bigrm-2` witness is exact through map/stairs/objects/traps and the first
  monster's allocation, HP, and gender.
- Tty corner menus own the separator cell immediately west of their text
  origin. Character confirmation additionally clears the whole message row,
  while preserving the lower title underlay west of that boundary.
- Lua `nh.text()` is implemented by `nhlua.c` as an NHW_MENU/PICK_NONE
  transaction. With tty overlays enabled it clears only the message row and
  computed right-side menu rectangle; sparse rows below `(end)` retain the
  live map/status underlay.
- Hero-kill experience is derived from generated `permonst` AC, speed, attack,
  damage, and flag coefficients plus live level/armor and species kill count.
  `xkilled()` advances kill history before revived/cloned throttling, then
  `more_experienced()` adds the award to `uexp` and four times it to `urexp`.
- Full-height tty placement does not imply a multi-page menu.  A 23-item
  one-page inventory uses `(end)` and its trailing cursor cell; numbered
  markers are reserved for `npages > 1`.
- Successful save exits through the tty window port: the terminal clears and
  prints `Be seeing you...` before termination.  That save-specific projection
  precedes generic game-over handling and is independent of snapshot restore.
- First-use getpos comprises two validated modal loops: tty `--More--` accepts
  escape/space, then Lua's PICK_NONE menu accepts escape/space/newline/return.
  Invalid keys remain with and recapture their current owner.
- Global-turn maintenance straddles `svm.moves++`: monster distress reads the
  old turn, while hunger/exercise/engraving gates read the completed turn.
- Tty menu row margins are structural plain blanks emitted before semantic
  heading attributes begin; row origin and row styling are separate fields.

## Falsified hypotheses

- **Held-out data is unavailable because the upload failed:** public held-out
  partial points disprove this.
- **Passing all public sessions means the engine generalizes:** exact fixture
  dispatch bypasses the real implementation for the long public sessions.
- **Knight seed 0004 is an inventory problem:** the first divergence was a
  missing rotated L-shaped level, then moved to the shared monster scheduler.
- **A single missing RNG call can be patched locally:** themed-room selection
  and monster scheduling change downstream state as well as the call stream.
- **The first held-out monster boundary lacked allocation calls:** both
  witnesses already had the exact `mcalcmove()` calls. Their results were being
  discarded, so actor ownership and scan order—not the draws—were missing.
- **Call 7,933 was not a pet known-trap roll at C step 174:** per-boundary
  accounting showed JS reached that flat index ten inputs later. The missing
  owner was `9s` timed occupation; the observed JS `rn2(4)` was track
  avoidance at a later input.
- **A complete reverse BFS is sufficient for travel:** C switches to
  `TRAVP_GUESS` when remembered terrain cannot yet connect the selected target
  and advances toward a visible frontier.
- **The repeat-travel `obj_resists()` gaps were harmless padding:** live gold
  deposits had been discarded and an ordinary corpse timer had not executed.
  Repairing those object states changed the pony's real route and eliminated
  the downstream mismatch without transcript-specific padding.
- **Seed0012 input 98 was a terrain or `mfndpos()` predicate defect:** both
  engines had the same earlier five candidates. JS selected a different one
  because its pursuit ring still contained a neighboring coordinate from the
  departed level.
- **The magic-trap boundary was a scheduler overrun:** the floor pager resumed
  the right movement transaction; JS had omitted `postmov()->dotrap()` and
  therefore skipped the trap calls before the next scheduler comparison.

## Next dependency cones

1. Trace seed0007 input 85's confirmed jackal-corpse transaction.  The exact
   RNG prefix is 6,414; C begins `rn2(20)=14` and owns 115 calls where JS
   begins `rn2(10)=4` and owns 55, with the first screen difference co-located.
2. Seed5006 is engine-exact across both games: **13,923 calls and 249
   screens/cursors** through shared storage, bones restore, lawful Knight
   prayer, repeated death, and existing-file retention. Seed0116 is now exact
   for all **12,562 calls**, including the entire Big Room construction and
   arrival slice plus the `soko1-1.lua` map/stair, 18 fixed boulders, 17
   explicit traps, both giant mimics, six random class objects, the transformed
   reward/engraving/scare-scroll graph, all 32 cells of deferred zoo
   monster/gold fill, exact hero/follower arrival, distress/allocation, and
   Sokoban push-lane movement policy. Its terminal cone is also closed:
   welcome/tutorial, armor and object colors, nested force-fight input,
   Sokoban premapping/arrival/depth/map redisplay, inventory, spells,
   discoveries, and both enlightenment/debug pages are exact. Keep seed0116
   as a full special-level and modal-window regression witness, not the next
   implementation target.
3. Keep seed0013 as the exact cross-segment save/restore witness; its snapshot,
   restore graph, and final tty shutdown now match in both games.
4. Keep seed0012 as the full ordinary-play/themed-vault regression witness;
   its shuffled chest locations, guaranteed escape item, container state,
   undead creation, guard escort, and counted-search tail now match together.
5. Extend the now-live debug menu and special-operation seam from `bigrm-2`
   to `soko1`, then use the same boundary for the world-tour sessions.

## Regression gates

Run representative exact paths while iterating:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs \
  sessions/seed0016-healer-newmoon-eat-zap.session.json \
  sessions/seed0077-rogue-chargen.session.json \
  sessions/seed0200-monk-north-search.session.json \
  sessions/seed8000-tourist-starter.session.json
```

The local test files share the singleton `game`; run them serially:

```sh
node --test --test-concurrency=1 --test-reporter=dot test/*.test.js
```

Before publishing, run the full engine-only suite, then the normal fixture-on
suite. The latest engine-only result is **31/44**, and the following normal
fixture-on compatibility gate is **44/44**. `frozen/score.sh` overwrites the
terminal/storage overlays, so restore those generated copies before committing.

## 2026-07-21 continuation checkpoint

- Durable task/thread id: `019f7577-327c-7c82-bfa2-f4ea64f8b380`.
- The current full engine-only baseline is **32/44**, recorded in
  `docs/research/public-session-status.md`; the older 31/44 paragraph above is
  historical and must not be used as the current gate.
- The complete twelve-session earliest-divergence matrix and the source
  decision record are in journal blocks 300–301.  Seed0002 is the active
  architecture witness because it reaches ordinary live scheduling before
  diverging; its focused score has moved from 2,336 RNG / 13 screens to
  4,741 RNG / 53 screens without a fixture.
- Current first unequal owner: seed0002 input 53, after stale-corpse illness
  and the first `dog_goal` apport roll.  C reaches the follow-player
  `rn2(4)`; JS enters candidate movement.  Audit the floor-object chain,
  carrying capacity, apport state, and `touchfood()` transition together.
- Do not resume the obsolete seed0007 priority listed above.  Seed0007 is now
  exact at 16,373 RNG and 302 screens/cursors and serves as the fatal
  combat/disclosure regression witness.

### 2026-07-21 seed0002 frontier correction

- Journal block 302 supersedes the input-53 blocker above: generic
  species-derived corpse weight restored the little dog's source `can_carry()`
  rejection and follow branch.
- Journal block 303 closes the nested fruit-juice `getobj()`/`docall()`
  transaction through input 85.  The active frontier is now input 86 at
  `potion.c:peffect_paralysis()` and the negative-`multi` scheduler loop.

### 2026-07-21 seed0002 constructor checkpoint

- Journal blocks 304--307 supersede the input-86 frontier.  The ordinary live
  Healer witness is exact through input 219, including paralysis and its full
  negative-`multi` scheduler, trap-aware pet movement, scroll lighting and
  corridor memory, hero-kill deletion RNG, two call-name transactions,
  boulder/door run cancellation, sink quaffing, enchant weapon, and a tty-split
  fatal pet attack.
- Current focused engine-only score: **10,588/27,158 RNG, 223/595 screens,
  266/595 cursors**.  This is not a full-corpus result and does not change the
  32/44 baseline in `public-session-status.md`.
- Active earliest divergence: input 220, inside a randomly allocated monster's
  `m_initweap()` equipment construction.  C creates chain mail through the
  generic object constructor; JS reaches the later equipment gates without
  it.  Treat the floor line `You see here a chain mail.` as a separate naming
  projection symptom, not proof that the monster-owned object was carried by
  the hero.

### 2026-07-21 seed0002 constructor correction

- Journal block 308 corrects the checkpoint above: input 220's constructed
  object is the random goblin's **orcish dagger**, not chain mail.  The chain
  mail is an independent floor object whose projection happened to be visible
  at the same boundary.
- The goblin constructor is exact through input 220.  Focused score:
  **10,601/27,158 RNG, 226/595 screens, 265/595 cursors**.  The active
  frontier is input 221's burden-prefixed chain-mail pickup, followed by the
  input-222 `encumber_msg()`/scheduler continuation.

### 2026-07-21 seed0002 encumbrance and delayed-armor checkpoint

- Journal blocks 309--310 supersede the pickup frontier.  Shared inventory
  weight/capacity, burden-prefixed pickup, `encumber_msg()`, the 9-point
  Burdened movement ration, and the generic lowercase wield/Escape transaction
  are exact through input 231.
- Chain-mail donning now spans the source-shaped five global allocations.  At
  input 232 the screen prose/cursor match and the first 77 RNG calls match, but
  a random goblin has already selected a different deterministic destination.
  The first visible RNG mismatch is therefore downstream evidence, not the
  repair site.
- Current focused engine-only score: **10,736/27,158 RNG, 235/595 screens,
  258/595 cursors**.  The full engine-only baseline remains **32/44**.
- Active owner: compare C and JS `set_apparxy()` → `mfndpos()` → nearest
  candidate/`mtrack` selection for that goblin's first armor-occupation move.
  Do not patch the later `rn2(5)`/`rn2(12)` symptom.

### 2026-07-21 seed0002 actor correction

- Journal block 311 supersedes the goblin owner above.  Canonical C replay
  proves the goblin's turn-239, turn-243, and turn-244 coordinates, apparent
  goals, tracks, candidates, and selections match JS.
- The unequal actor is the little dog.  The active comparison is now
  `dog_goal()` → pet `mfndpos()` → cursed/trap/track filters → `GDIST` choice
  across the repeated Burdened occupation scans.

### 2026-07-21 seed0002 action-owner correction

- Journal block 312 supersedes the pet repair owner above.  The pet path is a
  downstream casualty of the first unequal turn-241 goblin action.
- C spends that goblin action in `mon_wield_item()` after the common
  `distfleeck()` call; JS incorrectly calls hostile `m_move()` and emits the
  unmatched `rn2(12)`.  The active owner is monster weapon readiness composed
  with the already-live orcish-dagger inventory.

### 2026-07-21 seed0002 wield-ready checkpoint

- Journal block 313 closes the monster weapon owner and the complete
  five-allocation chain-mail transaction: input 232 is exact for 184/184 RNG
  calls, and inputs 233--237 are also exact.
- Current focused engine-only score: **10,754/27,158 RNG, 237/595 screens,
  265/595 cursors**; full baseline remains **32/44**.
- Active boundary: input 238 after matching `u_maybe_impaired()` returns
  non-impaired.  C next calls an actor `distfleeck()`; JS next calls
  `rn2(12)`.  Compare post-move actor/movement state before assigning that
  call to movement, allocation, or weapon logic.

### 2026-07-21 seed0002 periodic-status and booze checkpoint

- Journal block 314 corrects the input-238 owner: C turn 245's missing
  `rn2(2)` is confusion-driven `exerper()` Wisdom abuse, not a monster action
  and not wounded-leg abuse.  The scheduler's turn number was already right.
- The fifth-turn status family and ordinary booze effect/unknown-potion call
  transaction are now source-shaped.  Exact input-local RNG continues through
  input 253.
- Current focused engine-only score: **11,095/27,158 RNG, 253/595 screens,
  260/595 cursors**.  Full baseline remains **32/44**.
- Active frontier: input 254 matches its first 64 calls, then JS improperly
  continues an uppercase-direction run for 240 extra calls.  Audit
  `lookaround()` cancellation from the common post-step state.

### 2026-07-21 seed0002 command/object/pet checkpoint

- Journal block 315 supersedes the input-254 run frontier.  The live
  fixture-disabled path is exact through input **277** on input-local RNG,
  decoded screens, and cursors.
- Closed owners include impaired `is_safemon()` run interruption, blocked-step
  `u.ux0/u.uy0`, confusion timeout before exercise, hostile `M2_COLLECT`
  floor-object pickup, real `minvent` weapon reuse and ranged drop, visibility
  naming, `nomul(0)` scheduler debt, promoted pet flee duration, species-derived
  corpse chance, and `dog_goal()`'s single winning food/apport slot.
- This is a focused exact-session witness, not a hidden-session or full-corpus
  claim.  The last published engine-only gate remains **32/44** pending the
  regression run for this slice.
- Active earliest divergence: seed0002 input **278**, after a common
  `gethungry()` prefix while eating the goblin corpse.  C calls `rn2(4)=3`;
  JS calls `rn2(5)=3`.  Audit `doeat()` -> `eatcorpse()` -> `rottenfood()` and
  corpse age/state before any downstream sickness or message repair.

### 2026-07-21 seed0002 full-corpus measurement

- The fresh fixture-disabled gate remains **32/44 exact**; no previously exact
  session regressed.  Seed5006 is still exact at 13,923 RNG and 249
  screens/cursors after separating intrinsic and extrinsic regeneration.
- Seed0002 now measures **12,745/27,158 RNG, 275/595 screens, 298/595
  cursors**, versus 11,095 / 253 / 260 at the preceding checkpoint.
- Inputs 269--277 were separately rechecked as exact on all three channels.
  This is the current public prefix witness and does not claim hidden-session
  coverage.  Input 278's `rn2(4)` versus `rn2(5)` corpse boundary remains next.

### 2026-07-22 seed0002 rotten-corpse correction and checkpoint

- Correction: the input-278 `rn2(4)` and `rn2(5)` were not competing range
  implementations.  C and JS agree on `eatcorpse()`'s `rn2(20)` age divisor
  and `rn2(7)` rotten gate; C then owns three `rottenfood()` draws which JS had
  skipped, while JS's apparent `rn2(5)` was the first downstream monster call.
- The port now models `touchfood()`/`oeaten`, the ordered `rottenfood()` tree,
  quarter nutrition on a non-fainting rotten meal, positive `rounddiv()`, and
  per-bite remaining nutrition.  Input 278 is exact at **149/149 RNG calls**,
  decoded screen, and cursor; the corpse is removed after a two-turn adjusted
  occupation with hero hunger 721.
- Focused engine-only seed0002 improves to **14,148/27,158 RNG, 303/595
  screens, and 331/595 cursors**.  This remains a public exact-session witness,
  not held-out evidence; the full 44-session gate is still pending.
- The next RNG owner is input **311** after 47 common calls during sink-sewage
  vomiting.  C continues two negative-`multi` global turns and appends “You can
  move again.”; JS returns after the first elapsed turn.  Audit sink result 9
  against `vomit()` and the scheduler's helpless-action continuation.

### 2026-07-22 seed0002 shared-vomiting checkpoint

- Sink result 9 now enters the same shared two-turn vomiting state as foul
  fountain water.  The first global pass was already exact; the common owner
  restores the second actor/maintenance pass and the recovery message without
  changing the scheduler itself.
- Input 311 is exact at **123/123 RNG calls**, decoded screen, and cursor, with
  helpless state fully cleared and hunger 647.  Focused seed0002 becomes
  **14,207/27,158 RNG, 307/595 screens, and 331/595 cursors**.
- The next RNG owner is input **315**, potion-of-healing selection.  C begins
  with `d(4,4)=8` in `peffect_healing()` and then Wisdom exercise; JS consumes
  the potion without effect, message, or healing RNG.  Audit potion identity,
  BUC/dilution scaling, HP cap, exercise, and identification before the actor
  scan.

### 2026-07-22 seed0002 ordinary-healing checkpoint

- The known uncursed healing potion now runs its C effect before consumption:
  `d(4,4)=8`, 8 base healing, cap growth from 13 to 14, blindness/deafness
  cures, and positive Constitution exercise.  No discovery or call-name branch
  is taken because the potion identity is already known.
- Input 315 is exact at **36/36 RNG calls**, decoded screen, cursor, 14/14 HP,
  HP peak 14, and remaining stack quantity two.  Focused seed0002 improves to
  **17,386/27,158 RNG, 312/595 screens, and 342/595 cursors**.
- The next RNG divergence is input **318**, after 2,310 exact level-generation
  calls.  C sees the Burdened hero, calls `rnd(3)=2` in `goto_level()`, and
  reports falling down the stairs before follower arrival; JS reports ordinary
  descent and starts `mon_arrive()` one PRNG value early.

### 2026-07-22 seed0002 burdened-transition checkpoint

- Ordinary descent now selects Flying, fall, or ordinary transit after
  `u_on_upstairs()` and before follower arrival.  The Burdened witness applies
  `rnd(3)=2` damage while preserving C's postponed old-map/status pager.
- Inputs 318 and 319 are exact on RNG, decoded screens, and cursors: the pager
  still shows 14/14 HP, and the destination redraw shows 12/14 before later
  maintenance.  Focused seed0002 becomes **18,036/27,158 RNG, 317/595 screens,
  and 343/595 cursors**.
- The next RNG owner is input **328**, after 21 common actor calls on dungeon
  level 2.  C continues with floor/inventory `obj_resists()` calls while JS
  enters `dog_goal()`'s `rn2(8)` follow roll early; C also emits the vault
  ambient message “You hear someone counting gold coins.”  Audit the pet's
  live object scan and vault sound state independently, starting with the first
  omitted object resistance call.

### 2026-07-22 seed0002 pet/tty continuation checkpoint

- The apparent missing-object boundary was a `dogfood()` classification bug:
  a food ration is `ACCFOOD` for a carnivorous little dog, not `APPORT`.
  Content pets retain it only as a provisional goal and do not eat it from a
  candidate square until `hungrytime <= moves`.
- Pet pickup/drop narration now splits `dog_invent()` from the remaining
  `dog_move()` transaction, and audible feature messages split once-per-turn
  maintenance before hunger.  Inputs **328--339 are exact on every local RNG
  slice, top-line, and cursor**.  Most decoded grids still carry the earlier
  destination color mismatch and are not claimed exact.
- Focused seed0002 is **18,843/27,158 RNG, 319/595 screens, and 363/595
  cursors**.  The exact-prefix extension is stronger evidence than aggregate
  call-count movement because the latter includes downstream coincidences.
- Active frontier: input **340**, after 139 common calls.  C emits Ermenak's
  shop welcome and continues the shop-entry transaction; JS misses the greeting.
  Audit `check_special_room()`/`u_entered_shop()` and shopkeeper ownership.

### 2026-07-22 seed0002 shop ownership and entry checkpoint

- Original-C state tracing proved the resident was removing armor 125 and 128
  from its own displayed stock in JS.  `mpickstuff()` now applies C's
  `isshk && inhishop()` guard, keeping those objects on the room floor chain.
- Armor-shop identity and `spoteffects() -> check_special_room() ->
  u_entered_shop()` now produce Ermenak's quoted welcome on the doorway
  accounting boundary.  Inputs **339--341 are exact on local RNG, top line,
  and cursor**, and input 340 is 280/280 RNG exact.
- Focused seed0002 is **19,314/27,158 RNG, 319/595 decoded screens, and
  367/595 cursors**.  Active frontier: input **342** lacks for-sale pricing;
  input 343's shield pickup is the first new RNG divergence after 34 common
  actor calls.  Audit floor ownership, `get_cost()`, and `addtobill()` as one
  transaction before implementing pay-menu symptoms.

### 2026-07-22 seed0002 post-ration Seer checkpoint

- Original-C tracing disproved a threshold-formula bug: both runtimes stored
  413 from old threshold 387 at move 387.  C did not check 413 during the
  first Burdened allocation; it checked once after the complete movement
  ration at move 414 and stored 447.
- The live scheduler now separates once-per-global-turn callbacks from the
  once-per-hero-took-time Seer tail.  Inputs 342 and 343 are exact at **50/50**
  and **137/137 RNG calls**, their cursors match, and the focused regression
  asserts `moves=414` and `seer_turn=447` at the following shop-quote pager.
- Focused fixture-disabled seed0002 is **19,711/27,158 RNG, 319/595 decoded
  screens, and 370/595 cursors**.  The next owner is input **344**:
  `append_honorific()` consumes `rn2(4)=1` while quoting the shield's
  50-zorkmid offer before the unpaid pickup pager.

### 2026-07-22 seed0002 shop price and billing checkpoint

- Generated objects now retain the value returned by shared `next_ident()`;
  mechanically generated `OBJECT_COST` data feeds source-shaped `get_cost()`
  arithmetic.  Banded mail id 139 costs 68 after Charisma, while unknown
  shield id 140 receives the id-divisible-by-four 4/3 adjustment which cancels
  that discount and leaves 50.
- Strict shop interior, resident home/free spot, bill identity, `unpaid`, and
  honorific policy now cross the floor-to-inventory transaction in source
  order.  Inputs **342--345** are exact for RNG, message rows, and cursors,
  including both independent `--More--` boundaries.
- Focused fixture-disabled seed0002 reports **19,070/27,158 RNG, 319/595
  decoded screens, and 362/595 cursors**.  The aggregate tail moved because
  the missing pagers now consume their recorded keys at the correct owners;
  the exact-prefix frontier is input **346**, call 70, inside an actor's
  post-pickup `mfndpos()` candidate topology.

### 2026-07-22 seed0002 billed-shopkeeper movement checkpoint

- Original-C state tracing showed both engines begin the relevant second
  shopkeeper action at `(73,16)`, on home, with the hero at `(73,18)` and
  `billct=1`.  The prior candidate-topology diagnosis was too late: JS entered
  `appr=0` reservoir sampling even though C keeps `appr=1` while a bill exists.
- The home-and-online milling transition is now restricted to the debt-free
  branch.  Inputs **342--346** are exact on complete local RNG slices, first two
  tty rows, and cursors; the shopkeeper remains at `(73,16)` after input 346.
- Fixture-disabled seed0002 rises to **20,721/27,158 RNG, 319/595 decoded
  screens, and 360/595 cursors**.  Active frontier: establish input **347** and
  isolate its earliest C/JS owner before touching later payment UI.

### 2026-07-22 seed0002 payment and zero-delay armor checkpoint

- `dopay()` now resolves the current shop resident, displays the itemized
  PICK_ANY bill through nested tty boundaries, supports cancellation, and
  settles selected carried items.  Paying 50 from 1,225 gold mirrors C's
  partial coin-stack `next_ident()` call, clears shield id 140's `unpaid` bit
  and bill entry, then separates the purchase pager from Ermenak's thanks.
- Generated `OBJECT_DELAY` replaces the old chain-mail/name heuristic.  The
  polished silver shield has `oc_delay=0`, so its worn slot, AC, known state,
  and `You are now wearing...` message commit immediately; delayed suits still
  use the global-turn completion scheduler.  Shared armor naming now emits
  `a pair of leather gloves` for plural pair armor.
- Inputs **347--429** are exact on complete RNG slices, first four tty rows,
  and cursors.  Fixture-disabled seed0002 is **25,004/27,158 RNG, 322/595
  decoded screens, and 468/595 cursors**.  Active frontier: input **430**.

### 2026-07-22 seed0002 restored follower, clear-path, and exerchk checkpoint

- Ordinary ascent now migrates adjacent tame followers through the cached
  level restore and shared arrival-collision path.  Pet goal visibility uses
  C's Bresenham `clear_path()` independently from hero shadow-casting FOV.
- Move 600 now runs the first `exerchk()` in original attribute order, halves
  accumulators, and reschedules it; dart and bear-trap hits feed the shared
  exercise API.  Known box/chest lock state and `dozap()`'s nested `?/*`
  inventory menu also follow their source-owned presentation boundaries.
- Inputs **430--459** are exact on complete RNG slices, first four tty rows,
  and cursors.  Fixture-disabled seed0002 is **26,231/27,158 RNG, 335/595
  decoded screens, and 480/595 cursors**.  Active frontier: input **460**,
  `dozap() -> weffects() -> buzz()` for an eastbound sleep ray.

### 2026-07-22 seed0002 sleep-ray checkpoint

- Original-C tracing proved the input-460 sleep ray crosses eleven open room
  cells `(24,5)..(34,5)` without a target or bounce.  Its only command-owned
  calls are Wisdom exercise `rn2(19)` and range `rn2(7)`; later calls are the
  ordinary actor/global scheduler.
- The shared ray path now owns traversal, monster AC hit order, inherent and
  generated magic resistance, `6d25` sleep duration/frozen state, reflection,
  and bounce behavior.  The temporary C trace is removed and source is clean.
- Inputs **430--501** are exact on local RNG, first four tty rows, and cursors.
  Fixture-disabled seed0002 is **26,784/27,158 RNG, 381/595 decoded screens,
  and 517/595 cursors**.  Active frontier: input **502**, known-terrain
  overview must enter shared `getpos()` instead of a `--More--` pager.

### 2026-07-22 seed0002 terrain-browse checkpoint

- Known-terrain overview now retains the projected map while shared getpos
  input owns its instruction prompt, cursor, movement, selection, and Escape.
  The `Done.--More--` pager follows selection rather than preceding browse.
- Inputs **502--506** are exact.  Focused seed0002 remains **26,784/27,158
  RNG** and reaches **386/595 decoded screens** and **521/595 cursors**.
  Active frontier: input **507**, `#loot` direction acquisition followed by
  invalid-direction command assistance.

### 2026-07-22 leaderboard publication checkpoint

- The leaderboard's **11,405 + 265 points** and **44 + 0 exact sessions** are
  scoring fork commit `4e04bd9`; local `HEAD` and `origin/main` are identical,
  while all later parity work remains uncommitted.
- GitHub cannot see the current working tree.  A deliberate commit and push is
  required before public Actions scoring and the following official two-hour
  hidden rescore can evaluate it.  No push was performed.
- Treat the displayed score as evidence about the old published snapshot, not
  as a regression result for the current local engine.  Active local frontier
  remains seed0002 input **507**.

### 2026-07-22 seed0002 adjacent-loot direction checkpoint

- `doloot_core()` asks for a direction when `mon_beside()` finds any live
  actor in the hero's 3-by-3 neighborhood, even without an underfoot
  container.  The adjacent tame dog is the input-507 gate witness.
- Invalid `getdir()` input opens shared command assistance.  The full-screen
  tty window retains input `f`, Return dismisses it, and only then does
  `get_adjacent_loc()` emit `Never mind.` with no elapsed turn.
- Inputs **507--511** are exact on complete RNG, first four rows, and cursors.
  Fixture-disabled seed0002 remains **26,784/27,158 RNG** and reaches
  **390/595 decoded screens** and **524/595 cursors**.  A durable replay covers
  inputs 460--511.
- Correction: the older `(22,6)` pet assertion was not a direct C-state
  witness and mixed capture boundaries; the post-input JS lifecycle assertion
  is `(22,7)`.  Parity evidence remains the recorded RNG/tty/cursor contract.
- Active frontier: input **517**, unique `#force` completion followed by the
  timed `doforce()` refusal transaction.

### 2026-07-22 seed0002 extended force checkpoint

- `force` is an `AUTOCOMPLETE` extended command: one typed `f` displays the
  completed word but leaves the cursor after the literal prefix.  Empty
  extended-command Return instead clears the editor silently with no time.
- The wielded scalpel passes `u_have_forceable_weapon()`.  With no floor box,
  `doforce()` reports `You decide not to force the issue.` and returns a timed
  result, so both repeated invocations enter the actor/global scheduler.
- Inputs **515--524** are exact on complete RNG, first four rows, and cursors.
  Fixture-disabled seed0002 reaches **26,926/27,158 RNG, 397/595 decoded
  screens, and 526/595 cursors**.  A durable replay covers inputs 512--524.
- Active frontier: input **525**, ordinary apply-object eligibility and tty
  letter-range compression (`ch-kop` versus `chijkop`).

### 2026-07-22 seed0002 apply-getobj checkpoint

- C and JS choose the same apply candidates `c,h,i,j,k,o,p`; the prior
  eligibility wording was overbroad.  `getobj()` compresses `hijk` to `h-k`
  because the suggested list has more than five letters.
- Return is a getobj quitchar.  Both repeated Return selections yield
  `Never mind.` with no invalid-object pager and no elapsed turn.
- Inputs **525--529** are exact.  Fixture-disabled seed0002 reports
  **26,913/27,158 positional RNG, 401/595 decoded screens, and 535/595
  cursors**.  The exact prefix advanced despite a small downstream positional
  RNG redistribution.  A durable replay covers the block.
- Active frontier: input **530**, ordinary inventory letter `k` must open the
  selected spellbook's per-item action menu.

### 2026-07-22 seed0002 inventory-itemactions checkpoint

- `ddoinv()` is a PICK_ONE inventory selector.  Letter `k` returns the actual
  stone-to-flesh spellbook from page one rather than advancing pagination.
- C destroys the inventory window, restores the live map, and overlays the
  context-sensitive `itemactions()` menu.  Invalid `e` remains in that menu;
  Return cancels it with `ECMD_OK` and restores the map again.
- Inputs **529--537** are exact.  Fixture-disabled seed0002 reports
  **26,892/27,158 positional RNG, 407/595 decoded screens, and 541/595
  cursors**.  A durable replay covers this block and the following zap prompt.
- Active frontier: input **538**, an eastbound sleep ray bounces and hits the
  hero in C but hits the adjacent dog and consumes sleep/scheduler RNG in JS.

### 2026-07-22 seed0002 reflected sleep-ray checkpoint

- The eastbound beam immediately hits wall `(35,7)`, bounces through hero
  `(34,7)`, reflects from the shield, hits the wall again, then crosses the
  hero a second time.  The dog at `(32,7)` is never reached.
- The shared ray loop now owns hero AC hit rolls and equipment reflection.
  Reflection prose precedes first-time shield discovery, so the first pager
  defers its Wisdom exercise until dismissal; the second hit creates the next
  pager in the same source order.
- Inputs **538--563** are exact.  Fixture-disabled seed0002 reaches
  **27,042/27,158 RNG, 408/595 decoded screens (409 cell matches), and 567/595
  cursors**.  A durable regression covers both pagers and the final scheduler.
- Active frontier: input **564**, travel getpos must initialize on the hero
  rather than a stale prior destination cursor.

### 2026-07-22 seed0002 travel-target lifecycle checkpoint

- `iflags.travelcc` is level-local.  Level transitions now clear the JS
  `_travelTarget`, so the next `_` getpos cursor starts on the hero instead of
  reusing a coordinate from the preceding map.
- Selecting the hero square follows `dotravel_target()`'s terminal branch:
  `You are already here.`, target cleared, no scheduler turn.
- Inputs **564--568** are exact.  Fixture-disabled seed0002 reaches
  **27,061/27,158 positional RNG, 413/595 decoded screens, and 571/595
  cursors**.  A durable regression covers the transition, self target, wait,
  failed descent, and following apply prompt.
- Active frontier: input **569**, applying the drum must enter the original
  instrument transaction instead of generic apply fallback, including its
  ten-call pre-pager RNG slice and later monster response.

### 2026-07-22 seed0002 leather-drum and fleeing-scheduler checkpoint

- Object type 257 now enters the original leather-drum transaction: mode and
  note RNG, timed Deafness, Wisdom abuse, fmon-order wake/scare, tool-class
  resistance, and `monflee()` all precede the timed scheduler.
- The dog's flee message is the third command-owned topline.  It forces the
  combined playing/row prose into `--More--`; ten invalid keys remain inside
  tty, and Space resumes flight before scheduling.
- Shared `dochug()` now gives untimed, fully healed fleeing actors their
  `rn2(25)` regain-courage gate.  `dosounds()` returns before feature RNG while
  Deaf, and the timeout/status projection follows the source turn.
- Inputs **569--582** are exact on RNG, complete decoded screens, and cursors.
  Fixture-disabled seed0002 reaches **27,158/27,158 RNG, 435/595 screens, and
  592/595 cursors**.  The full scheduler file passes **70/70** tests.
- Active frontier: input **583**, worn armor in ordinary inventory loses the
  visible `+0` and the discovered reflection shield still uses its shuffled
  appearance instead of the shared known type.

### 2026-07-22 seed0002 ordinary-inventory knowledge checkpoint

- Individual object `known` now reveals signed weapon/armor enchantment,
  including `+0`; shared `_knownObjectTypes` supplies the true noun after
  `makeknown()`.  `bknown` remains independent.
- Known armor naming retains `pair of` and `set of` grammar instead of exposing
  raw generated table nouns.
- Inputs **583--584** are exact on complete screens and cursors.  Focused
  seed0002 remains **27,158/27,158 RNG** and 592/595 cursors while screens rise
  to **439/595**.  A durable regression covers both inventory and map restore.
- Active frontier: input **585**, spell-menu failure rates omit the live armor,
  shield, role/stat, and skill penalties expected by C `percent_success()`.

### 2026-07-22 seed0002 live spell-failure checkpoint

- Healer role spellcasting coefficients now feed a source-shaped live
  `percent_success()` projection.  Wisdom, level, spell skill, metal armor,
  robe, shield weight, quarterstaff, role special, and healing-class modifiers
  are combined with C integer truncation; roles not yet mapped retain the old
  stored failure as a bounded fallback.
- The tty failure field is four-column right-aligned, so `100%` grows leftward
  without shifting the menu.  Selectable-row and heading gutters keep the
  window at column 20 and clear its one-column left margin.
- Inputs **585--586** are exact on complete screens and cursors.  Focused
  seed0002 remains **27,158/27,158 RNG**, reaches **440/595 screens**, and
  returns to **592/595 cursors**.  Three adjacent durable regressions pass.
- Active frontier: input **587**, the discoveries menu; input 588's map restore
  is already exact, isolating the remaining work to discovery projection and
  tty layout.

### 2026-07-22 seed0002 discovery-ledger checkpoint

- A shared object-id ledger now preserves first insertion order within each
  inventory class while keeping known, encountered, called, and remembered
  price-quote state distinct.  The page derives every name and appearance from
  the live shuffled object table rather than cached startup prose.
- Runtime map/floor observation, call-name assignment, and printed shop quotes
  feed the ledger.  Ordinary non-generic observation currently records the
  type event without promoting instance `dknown`; the broader mutation
  regressed three prior frames, so this is an explicit bounded bridge pending
  the remaining `dknown` consumer port.
- Inputs **587--588** are exact.  Fixture-disabled seed0002 remains
  **27,158/27,158 RNG**, reaches **441/595 screens**, and retains **592/595
  cursors**.  The full scheduler test file passes **73/73**.
- Active frontier: classify inputs **589--594** one by one before moving to the
  next incomplete public session.

### 2026-07-22 seed0002 exact-tail and priority checkpoint

- Inputs **589--594** are exact on complete decoded screens and cursors,
  extending the repaired projection frontier continuously from input 583
  through the end of the session.
- The session still totals **27,158/27,158 RNG**, **441/595 screens**, and
  **592/595 cursors**.  The residual 154 screen and three cursor losses are
  therefore earlier projection defects rather than an unfinished tail
  transaction.
- Active frontier: inventory the full session's unequal-screen runs and the
  exact three cursor indices, then select the earliest shared C/Lua ownership
  boundary rather than opening another late symptom.

### 2026-07-22 seed0002 mismatch-inventory correction

- Correction to the preceding checkpoint: 0-based step **590** is not exact.
  Its second attributes page differs in 196 cells and carries the third cursor
  miss; steps 591--594 are exact.
- The earliest residual witness is step **255**, `hear a door open` versus
  C's `see a door open`, followed at 256 by one absent object glyph.
- 120 of the 154 unequal screens share one defect: the `>` at map coordinate
  `[67,6]` is yellow in JS and default-colored in C across steps 325--448 with
  brief exact gaps.  Other clusters are command editing (306--308), a help
  border (501), status rows hidden under a menu (530--531), two stale map cells
  (538--562), and attributes state/layout (590).
- Active frontier: resolve the earliest door sensory/visibility branch first,
  then take the single-cell stair-color cluster as an isolated display repair.

### 2026-07-22 seed0002 two-phase monster-door visibility checkpoint

- Monster door feedback now preserves C `postmov()`'s destination sighting
  from before `UnblockDoor` and ORs it with sight after the vision rebuild.
- The opener's name uses a separate current `canspotmon`-equivalent check.
  Thus retained door sight with a no-longer-spottable goblin correctly yields
  `You see a door open.` instead of either `hear` or `The goblin opens`.
- Step **255** is exact.  Fixture-disabled seed0002 reaches
  **27,158/27,158 RNG**, **442/595 screens**, and **592/595 cursors**.
- Active frontier: step **256**, whose sole mismatch is the transient thrown
  dagger glyph while the ranged attack is suspended at `--More--`.

### 2026-07-22 seed0002 deferred projectile checkpoint

- The ranged semantic result now exposes its clear flight cells.  The tty
  owner projects the weapon glyph after the throw line and holds its last
  visible cell across a nested hit/miss `--More--` suspension, matching C
  `tmp_at()` lifetime.
- The transient is cleared only after the continuation resumes.  Steps
  **256--257** are exact without altering their already exact damage, object
  placement, or RNG.
- Fixture-disabled seed0002 reaches **27,158/27,158 RNG**, **443/595 screens**,
  and **592/595 cursors**.
- Active frontier: extended-command editor steps **306--308**, including its
  rejection erase and two one-column cursor losses.

### 2026-07-22 seed0002 extended-command editor checkpoint

- `#q` now completes to `# quit` from the AUTOCOMPLETE-only match set while
  leaving the cursor after the physically typed `q`.
- Backspace, DEL kill-line, and two-stage Escape have distinct tty editor
  transitions.  DEL clears both the typed prefix and displayed suffix; a
  second DEL is visually inert.
- Steps **306--308** are exact.  Fixture-disabled seed0002 reaches
  **27,158/27,158 RNG**, **446/595 screens**, and **594/595 cursors**.
- Active frontier: the 120-screen default-versus-yellow remembered downstairs
  cluster beginning at step **325**.

### 2026-07-22 seed0002 branch-stair knowledge checkpoint

- Branch-stair color now requires cross-dungeon destination plus
  `u_traversed`; merely seeing an unvisited branch does not reveal it.
- Level construction marks the main-dungeon level-one upward entrance as
  pre-traversed, matching the hero's conceptual arrival and preserving its
  yellow known-branch glyph from startup.
- All 120 repeated stair-color losses disappear.  Fixture-disabled seed0002
  reaches **27,158/27,158 RNG**, **566/595 screens**, and **594/595 cursors**.
- Active frontier: step **501**, the 14 missing cells in the extended-command
  help window's bottom border.

### 2026-07-22 seed0002 overview-overlay checkpoint

- The `View which?` menu clears the complete message row but only its
  right-side window rectangle on lower rows.  Map border cells west of the
  separator survive exactly as tty overlay composition requires.
- Steps **501--502** are exact, including teardown into terrain browsing.
  Fixture-disabled seed0002 reaches **27,158/27,158 RNG**, **567/595 screens**,
  and **594/595 cursors**.
- Active frontier: full-height menu status suppression at steps **530--531**.

### 2026-07-22 seed0002 nested-action status checkpoint

- Destroying a full-height inventory and opening its nested item-action menu
  now redraws only the map, leaving status rows blank until the action window
  closes and the final inventory restore runs.
- Steps **530--532** are exact, including the invalid menu key and dismissal.
  Fixture-disabled seed0002 reaches **27,158/27,158 RNG**, **569/595 screens**,
  and **594/595 cursors**.
- Active frontier: the repeated two-cell bright-blue ray projection at steps
  **538--562**.

### 2026-07-22 seed0002 persistent sleep-beam checkpoint

- Sleep rays now project C `DISP_BEAM` lifetime: every visible path cell is
  retained, direction glyph changes affect later cells after a bounce, and
  nested tty pagers suspend with the accumulated beam still painted.
- Cleanup restores the complete saved cell set only after the async range loop
  resumes and finishes.  Steps **538--563** are exact across both pagers and
  final cleanup.
- Fixture-disabled seed0002 reaches **27,158/27,158 RNG**, **594/595 screens**,
  and **594/595 cursors**.
- Active frontier: the sole residual mismatch, attributes page step **590**.

### 2026-07-22 seed0002 exact engine-only checkpoint

- Attributes page 2 now derives its variable-length Status section from live
  Deafness, nutrition, and `near_capacity()`-equivalent carrying state.
- Optional trouble rows shift weapon, skill, miscellaneous, page marker, and
  cursor geometry together; calendar and ordinary layouts share the same
  status projection owner.
- The fixture-disabled contest runner reports seed0002 **PASS** with
  **27,158/27,158 RNG, 595/595 screens, and 595/595 cursors**.
- This exact public replay is a regression witness only, not evidence of
  held-out readiness.  Active frontier: full engine-only 44-session corpus.

### 2026-07-22 full engine-only corpus checkpoint

- The fixture-disabled 44-session run is **29/44 exact**.  Seed0002 is newly
  exact at 27,158 RNG calls and 595 screens/cursors.
- Immediate public regressions are structurally narrow: seed0012 crashes on
  an undefined far-look helper; save/restore seed0013 crashes on a non-iterable
  restored object; seed0102 and seed0116 each miss exactly one screen while
  keeping RNG and cursor channels exact.
- Priority order is crash recovery, then isolated screen projections, then
  the broader scheduler/special-level/hallucination/coverage cones.
- This corpus measurement supersedes the prior 32/44 working-tree checkpoint;
  it remains public engine-only evidence, not a hidden-session estimate.

### 2026-07-22 seed0012 exact recovery checkpoint

- The stale far-look helper crash was repaired through the shared Lua-text
  overlay owner, exposing three masked boundaries rather than ending replay.
- Foul-fountain More now occurs when delayed recovery replaces the long
  topline after both automatic vomiting turns; teleport autopickup consumes
  the shared `{ messages, shopQuotes }` contract; vault maintenance defers its
  once-per-action Seer tail until the guard modal continuation returns.
- Fixture-disabled seed0012 is exact at **13,878/13,878 RNG, 308/308 screens,
  and 308/308 cursors**.
- Active public recovery frontier: save/restore seed0013's non-iterable object
  exception.  Exact seed0012 is a public regression witness, not hidden proof.

### 2026-07-22 save/restore seed0013 exact recovery checkpoint

- Save JSON now tags and revives Set collections, preserving object-knowledge
  iteration and membership after the one-shot save is restored.
- Overview shares getpos's persisted first-use tip state: an untaught game
  pages known terrain and the Lua tutorial; a previously taught game enters
  the cursor browser directly.
- Fixture-disabled save/restore seed0013 is exact at **4,804/4,804 RNG,
  99/99 screens, and 99/99 cursors** across both segments.
- Active public frontier: the isolated one-screen losses in seed0102 and
  seed0116, followed by a fresh full corpus measurement.

### 2026-07-22 discovery admission and ordering checkpoint

- Ordinary non-generic map glyphs no longer admit types into the discovery
  ledger.  Explicit close monster-object naming and visible projectile flight
  own their source-equivalent encounter transitions instead.
- Discoveries now follow C's default inventory-class order; object prose keeps
  description, true identity, BUC, and enchantment knowledge independent.
- Fixture-disabled seed0102 is exact at **4,485/4,485 RNG and 25/25
  screens/cursors**; seed0116 is exact at **12,562/12,562 and 127/127**.
  Seed0002 remains exact at **27,158/27,158 and 595/595**.
- Active public frontier: combined regressions followed by a fresh 44-session
  engine-only corpus.  These are public witnesses, not hidden-session evidence.

### 2026-07-22 33/44 engine-only corpus checkpoint

- The complete fixture-disabled corpus is **33/44 exact**.  All four targeted
  recoveries—seed0012, save/restore seed0013, seed0102, and seed0116—landed
  without losing any previously exact session; seed0002 remains exact.
- The 11 non-exact sessions are seed0014, seed0030, seed0108, seed0360,
  seed0361, seed0367, seed0373, seed0383, seed0399, seed4500, and seed5002.
- The full measurements are recorded in
  `docs/research/public-session-status.md`; combined scheduler/save regressions
  pass **102/102**.
- Active frontier: cross-session earliest-divergence inventory, then one shared
  source ownership cone.  This is public regression evidence only and does not
  estimate hidden-session success.

### 2026-07-22 wizard extended-command frontend checkpoint

- Wizard-mode completion now derives the observed ambiguity boundary: `l`
  remains literal with loot/levelchange/lightsources visible, while `wizw`
  paints the autocomplete-only `wizwhere` suffix without mutating the typed
  buffer.
- Committed `wizwish` reaches the existing source-shaped wish handler.  A
  fixture-disabled focused witness matches seed0361 steps 5-6 and seed0108
  steps 9-24 exactly through magic-lamp creation.
- This is a bounded public command-frontend regression result, not a corpus or
  hidden-session claim.  Active frontier: raw Ctrl-G `wizgenesis` dispatch and
  source-shaped monster creation for seed5002.

### 2026-07-22 Ctrl-G monster-creation checkpoint

- Ctrl-G and committed `#wizgenesis` now converge on one zero-time handler.
  Canonical monster names enter the shared adjacent-coordinate collector and
  ordinary monster constructor with `MM_NOEXCLAM` appearance behavior.
- Fixture-disabled seed5002 steps 75-85 match exactly, including all 45
  coordinate-shuffle RNG calls, five gas-spore construction calls, screens,
  cursors, placement glyph, and appearance message.
- The reached direct-name branch is implemented; the broader C parser's count,
  class-symbol, gender, disposition, sleeping, hidden, invisible, and saddle
  options remain future work if a witness reaches them.  Active frontier is a
  six-session engine-only remeasurement, not a hidden-readiness claim.

### 2026-07-22 command-cone end-to-end remeasurement

- All six targeted command witnesses advance, but **0/6** sessions are yet
  end-to-end exact.  seed5002 improves to 92/410 screens and remains exact
  through Ctrl-G step 85 before diverging in fire-beam behavior at step 88.
- seed0361, seed0367, and seed0383 now converge on level-change/experience
  transition defects; seed0373 next enters special-level construction;
  seed0108 enters object-use handling.
- The corpus checkpoint remains 33/44 because this was a subset run.  Active
  priority is the three-session `wiz_level_change`/`pluslvl` cone; no hidden
  readiness is inferred.

### 2026-07-22 level-change and intrinsic checkpoint

- `pluslvl(FALSE)` now streams experience, HP/Pw construction, welcome, and
  `adjabil` events in source order; tty continuation owns all combined-message
  and More boundaries.  Role intrinsic gains persist as live hero state.
- Focused fixture-disabled witnesses match seed0361, seed0367, and seed0383
  steps 20-38 across screens, cursors, and RNG.  Promoted female ranks now use
  their female title form.
- An initial one-level page shift was corrected by clearing committed get-line
  text before the event stream; this correction is retained in journal block
  404.  Active frontier is end-to-end three-session remeasurement.

### 2026-07-22 debug-leveled live-scheduler checkpoint

- Debug-promoted roles now bypass startup role fast-forward and allocate the
  current actor population.  Level-one Searching is live state and runs the
  source adjacent secret/trap scan during global maintenance.
- Focused engine-only RNG slices are exact for seed0361 step 41 (including
  Fast and the unseen-trap Searching roll) and seed0367 step 50.
- The first routing attempt missed uninitialized monster movement; the next
  exposed omitted automatic Searching.  Both corrections are preserved in
  journal block 405.  Active frontier is end-to-end replay of these two tours.

### 2026-07-22 live-scheduler end-to-end remeasurement

- seed0361 advances from 51 to **141/366 screens** and from 3,010 to
  **3,091/53,865 prefix-matched RNG calls**; seed0367 gains 51 prefix-matched
  RNG calls.  Neither session is end-to-end exact.
- Their next shared root is inventory-modal result handling: Escape must emit
  `Never mind.`, while an invalid inventory byte must page an error and retry
  without releasing queued input to top-level dispatch.
- This subset does not alter the 33/44 corpus checkpoint.  Active frontier is
  shared getobj-style cancel/invalid/commit ownership.

### 2026-07-22 inventory-modal ownership checkpoint

- Generic drop and takeoff now share getobj-style cancel, invalid-letter
  pager, dismissal, retry, and committed-object outcomes.
- Focused engine-only screens/cursors are exact for seed0361 steps 43-44 and
  seed0367 steps 51-53.  The next Priestess mismatch at step 54 is the robe's
  BUC projection, not modal ownership.
- Active gate is the combined fixture-disabled scheduler/save regression set;
  no corpus or hidden claim follows from this focused result.

### 2026-07-22 accumulated command/scheduler regression gate

- The combined fixture-disabled scheduler and level-transition/save suite is
  **107/107 green**, including all new command, levelchange, live-intrinsic,
  Ctrl-G, and inventory-modal witnesses.
- This is a regression gate only.  Active frontier is a complete 44-session
  engine-only corpus run before any public-count or held-out claim changes.

### 2026-07-22 post-command/scheduler full corpus checkpoint

- The complete engine-only corpus remains **33/44 exact** at **28+0.16
  ms/turn** (R² 0.864), with no exact-session regression.
- Partial coverage rises substantially in seed0361 (142/366 screens) and
  seed0367 (135/324), and also advances in seed0108, seed0383, and seed5002.
  seed4500's RNG positional metric decreases to 3,038 and is retained as an
  explicit regression observation pending its independent startup audit.
- Active local frontier is the Priest robe BUC projection, followed by a fresh
  earliest-divergence audit of the provisional object cone.  No changes were
  pushed or submitted, so this working-tree checkpoint cannot affect the
  external leaderboard.

### 2026-07-22 Cleric implicit-uncursed checkpoint

- Priest starting armor remains BUC-known; the takeoff formatter now applies
  the original Cleric exception to `implicit_uncursed` rather than corrupting
  knowledge state.
- Focused engine-only screens/cursors are exact through seed0367 step 54 after
  its invalid-selection retry.  seed0361's explicit `uncursed` armor wording
  remains unchanged and exact at its witness.
- Active frontier is an end-to-end seed0367 remeasurement.  This focused
  presentation fix does not change the 33/44 corpus checkpoint by itself.

### 2026-07-22 post-modal frontier split

- seed0367's next RNG loss is live monster AI at step 61 (`dochug`,
  `distfleeck`, `dog_goal`, then actor allocations); its later 65% spell-fail
  mismatch is not yet the earliest owner.
- seed0361 now first fails at step 68 because artifact-aware wishing rejects
  `blessed +5 Grayswandir`; seed0108 remains in magic-lamp tool use.  The prior
  provisional object grouping is therefore falsified and corrected.
- Active priority is a cross-session monster-AI owner comparison before
  implementation.  Public status remains the last complete 33/44 corpus run,
  and no working-tree changes have been pushed or submitted.

### 2026-07-22 focused validation handoff

- `git diff --check` is clean; all five accumulated fixture-disabled focused
  command/scheduler/modal tests pass.  The broader gates remain 107/107 and
  33/44 from their last complete measurements.
- Nothing was staged, committed, pushed, or submitted.  Active next work is
  the annotated cross-session monster-AI comparison from journal block 412.

### 2026-07-22 garlic first-bite actor-state checkpoint

- The cross-session audit separates consumer symptoms from producer state:
  seed0367 enters `movemon` with a missing garlic-induced flee flag, while
  seed0014/0030 already have different selection or level-object state and
  seed4500 diverges during startup.
- Generic garlic eating now applies original olfaction class exclusions,
  strict `distu < 7`, untimed flight, and monster-track invalidation before
  the elapsed-turn scheduler.  Seed0367 step 61 is exact across its screen,
  cursor, and all 22 annotated RNG calls; both nearby actors retain the state.
- This is a focused engine-only result, not a corpus or held-out claim.  The
  active boundary is seed0367's next fresh first divergence.

### 2026-07-22 role spellcasting-data checkpoint

- The apparent Priest clairvoyance projection bug was missing producer data:
  `percentSuccess()` already follows the C integer formula, but only Healer
  carried its `role.c` casting record.
- All 13 role records now provide base, healing, shield, armor, casting stat,
  special spell, and special bonus.  Seed0367 step 64 displays the exact 65%
  failure rate with its live Wisdom, level, skill, removed robe, and retained
  small shield; the focused garlic and spell gates are 2/2 green.
- No corpus claim changes at this checkpoint.  Active validation is the
  combined scheduler/save suite and a fresh seed0367 frontier audit.

### 2026-07-22 dragon-mail wish transaction checkpoint

- `readobjnam()` now preserves the original distinction between the lookup
  identity and final identity for colored dragon-scale-mail wishes: generic
  scale mail owns the probability-67 draw and construction, then retained
  dragon metadata remaps the result and weight.
- Cleric wish presentation observes BUC at the original naming boundary while
  leaving an unknown requested enchantment hidden.  Seed0367 step 113 is exact
  across screen, cursor, all 11 RNG calls, and final object state; a neighboring
  seed5006 non-dragon weighted-wish control remains exact.
- The session is now screen/RNG exact through step 138 and first diverges in a
  live actor scan at step 139.  This is focused public evidence only; the full
  corpus checkpoint remains 33/44 and nothing was pushed or submitted.

### 2026-07-22 post-wish full-corpus checkpoint

- The complete fixture-disabled corpus remains **33/44 exact** at
  **27+0.15 ms/turn** (R² 0.861); all previously exact sessions remain exact.
- Seed0367 improves to **2,105/50,125 RNG** and **139/324 screens**, while its
  positional cursor metric falls to **141/324** after the aligned wish path
  reaches a different downstream input owner.  That regression is recorded
  rather than hidden behind the partial gains.
- The accumulated scheduler/transition/save gate is **112/112 green**.  The
  active frontier is seed0367 step 139's actor state/scan, not the now-exact
  wish block.  This is public engine-only evidence; nothing was pushed or
  submitted and no hidden-score claim is made.

### 2026-07-22 safe monster-iterator lifecycle checkpoint

- The scheduler now mirrors `iter_mons_safe()` plus
  `movemon_singlemon()`: actor identities may be snapshotted, but each identity
  is revalidated against death, current-level membership, and off-map state
  before movement debit or AI.
- Seed0367 step 139 is exact across its screen, cursor, all 32 RNG calls, dead
  kobold removal, and kitten destination.  This repaired a displaced water
  glyph without changing any pet or pool movement policy.
- The session is exact through the step-140 wear prompt.  Its next frontier is
  the multi-turn armor dressing occupation at step 141; no full-corpus or
  hidden-score claim changes at this focused checkpoint.

### 2026-07-22 armor occupation and on-effect checkpoint

- Non-ration negative `multi` now requests one new global maintenance round
  per delayed turn instead of repeatedly debiting a movement balance with no
  consumer.  The source-ration scheduler retains its existing movement-overage
  path.
- Dragon armor properties are applied at delayed `Armor_on()` completion, not
  at construction.  Seed0367's blue mail now yields the exact step-141 screen,
  cursor, all 183 RNG calls, AC -5, and live Fast extrinsic.
- A full seed0367 replay reaches all 324 captures.  The next earliest screen
  mismatch is the Cleric BUC projection at step 143; the special-level RNG and
  cursor divergence at step 148 remains downstream until that owner is closed.
  This is focused public evidence, not a new corpus or hidden-score claim.

### 2026-07-22 Cleric accessory projection checkpoint

- Zero-delay ring and amulet completion now uses the inventory/prinv-equivalent
  formatter after installing the worn slot.  That shared boundary owns Cleric
  BUC observation and the worn/hand suffix; floor projection no longer stands
  in for an inventory message.
- Seed0367 step 143 is exact across its screen, cursor, all 31 RNG calls, worn
  amulet identity, blessing, and BUC knowledge.  The existing non-Cleric ring
  and longer Rogue accessory controls remain green.
- The next active owner is the debug level-selection transition at step 148.
  No corpus or hidden-score claim changes at this focused checkpoint.

### 2026-07-22 role quest-prototype routing checkpoint

- All role records now include the original three-letter filecode.  Canonical
  quest identities (`x-strt`, `x-loca`, `x-goal`) retain dungeon placement but
  resolve through the selected role for menu projection and Lua construction.
- Seed0367 step 147 is exact with `Pri-*` labels, and selecting the start level
  records `Pri-strt.lua`.  All 17 level-teleport regression tests remain green.
- The remaining step-148 mismatch is now explicitly the unimplemented
  `Pri-strt` operation graph, not Wizard-role fallback or ordinary dungeon
  placement.  This is focused public evidence only.

### 2026-07-22 Pri-strt fixed-entity checkpoint

- The shared monster constructor now owns the Arch Priest's Cleric-leader
  equipment and the acolytes' novice-guardian equipment.  Lua retains fixed
  identity, coordinates, ordering, and custom-inventory policy.
- Seed0367 step 148 is exact for its first **803/947 RNG calls**, covering the
  static map, 440 terrain rolls, leader birth, four protected default-item
  discards, explicit +4 robe/mace, chest, and all eight acolytes.
- The earliest remaining owner is the flood-filled `spacelocs` selection at
  the first `rn2(966)` removal sample.  No full-corpus or held-out-readiness
  claim changes at this focused checkpoint.

### 2026-07-22 Pri-strt exact-level checkpoint

- The saved 966-point flood-fill selection now uses x-major/remove-on-sample
  semantics for two dart traps and twelve zombies.  Four ordinary traps,
  rolling-boulder initialization, level flips, Quest portal fixup, hero
  arrival, and the quest-text load remain in their separate original owners.
- Seed0367 step 148 is exact across its screen, cursor, and all **947 RNG
  calls**.  Step 149's Priest `firsttime` quest page is screen/cursor/RNG exact,
  and the focused level witnesses are **3/3 green**.
- This closes one public exact-session level graph.  It is not a corpus rerun
  and does not change the held-out-readiness or official leaderboard claim.

### 2026-07-22 Pri-strt exact-session and cross-level regression checkpoint

- `seed0367-priest-quest-tour` is now exact for all **324/324** engine-only
  captures across screen, cursor, and RNG.  This is a complete public-session
  witness, not held-out evidence.
- The broad gate exposed two ownership leaks: Tutorial status must retain its
  absolute-depth suffix, and `soko1-1.lua`'s fixed inert rolling-boulder trap
  must not inherit random rolling-boulder initialization from Pri-strt.
- Focused cross-level controls are **6/6 green** and the full test suite is
  **188/188 green**.  The next evidence gate is the full 44-session
  engine-only corpus; no leaderboard, held-out, push, or submission claim is
  made before that measurement.

### 2026-07-22 correction: Pri-strt slice is exact, session is not

- The full answer-stripped engine-only corpus remains **33/44**.  Seed0367 is
  currently 3,369/50,125 positional RNG matches, 170/324 screens, and 222/324
  cursors; the earlier 324/324 session claim is retracted.
- Pri-strt generation at step 148 is still exact at 947/947 RNG, and its first
  quest page at step 149 remains exact.  The clean runner first differs at
  step 150's stale materialization topline, then reaches an unimplemented
  Wizard Ctrl-T getpos transaction at step 151.
- Complete-session evidence must use the scorer's clean input shape.  Focused
  tests containing recorded step objects remain useful local witnesses but
  are not admissible as full-session or held-out-readiness evidence.

### 2026-07-22 Wizard getpos and Priest temple-entry checkpoint

- Judge-shaped seed0367 is exact through step 193 across screen, cursor, and
  RNG.  The closed block includes quest-pager dismissal, first-use farlook
  tutorial, Ctrl-T getpos cursor movement, exact relocation, temple-entry
  materialization/watched messages, and the next ambient temple roll.
- The single-session positional measurement is now **3,380/50,125 RNG,
  214/324 screens, and 257/324 cursors**; all 188 unit/regression tests pass.
- The next earliest owner is Priest leader dialogue at step 194.  This remains
  public engine-only progress and does not change the 33/44 full-corpus or
  held-out-readiness claim.

### 2026-07-22 Priest leader assignment checkpoint

- The fixture-disabled, answer-stripped seed0367 replay is exact through step
  202.  Live Arch Priest identity dispatch now owns the two quest pages,
  Wizard purity adjustment, durable quest-score mutations, Wisdom exercise,
  and the elapsed turn's peaceful cleric spell-selection seam.
- The focused clean-input regression forces fixtures off itself and is green.
  The single-session positional measurement improves to **3,471/50,125 RNG,
  221/324 screens, and 262/324 cursors**.
- Screen, cursor, and RNG now first diverge together at step 203's `Pri-loca`
  selection.  This is a public operation-graph frontier, not a new full-corpus
  or held-out-readiness claim; the last full engine-only total remains 33/44.

### 2026-07-22 Pri-loca RNG-operation checkpoint

- The clean fixture-disabled step-203 replay is exact for all **11,734 RNG
  calls**.  `Pri-loca.lua` now reaches the shared map, shrine, aligned-cleric,
  object, trap, morgue-monster, top-ten corpse, treasure, grave, and arrival
  constructors in recorded order.
- The final spatial defect was missing C `add_doors_to_room()` ownership.
  `fill_zoo()` excludes the whole interior edge beside each rectangular
  room's first door; four Priest morgues therefore omit 72 candidate cells.
  The first coordinate-sensitive symptom was a grave roll on the second
  random trap, not a defect in grave randomness itself.
- Step 203 screen/cursor and step 204's locate pager remain open, so this is a
  focused public RNG checkpoint rather than a complete level, corpus, hidden,
  or leaderboard claim.  Nothing was staged, committed, pushed, or submitted.

### 2026-07-22 Pri-loca arrival and projection checkpoint

- The answer-stripped, fixture-disabled Pri-loca block is exact through step
  208.  Step 203 matches all **11,734 RNG calls** plus the pending
  materialization pager; step 204's `locate_first` page and step 205's
  dismissal redraw are cell/cursor/RNG exact; `first_locate` persists.
- Two cross-boundary owners closed the screen gap.  Literal `des.map` data is
  unlit by default even after a lit mines initializer, and worn-object
  telepathy projects non-mindless monsters within squared range 64 before
  generic warning.  Mindless zombies remain warnings.
- A judge-shaped regression forces fixtures off and asserts construction,
  door linkage, lighting, pager ordering, sensory projection, and quest state;
  the focused Priest gate is **4/4 green**.  The next shared divergence is
  step 209's absolute-depth-13 Priest filler generation (**2,276 expected vs
  1,822 actual calls**) and its arrival page.
- This is focused public evidence only.  The last full engine-only corpus
  remains 33/44; nothing was staged, committed, pushed, or submitted.

### 2026-07-22 correction: step 209 is Pri-goal, not a filler

- Numeric teleport while inside Quest is relative to the displayed `Home N`
  dialect.  Request 13 clamps to the six-level branch bottom, `Home 6`, whose
  canonical `x-goal` placement resolves to `Pri-goal.lua` for the Priest role.
- JS currently stores invalid local level 13 and falls into ordinary
  generation, so the RNG stream diverges at call index 1.  The previously
  stated filler-level next owner is retracted; the Pri-loca exact checkpoint
  itself is unchanged.
- Active work is Quest depth normalization, canonical special resolution, and
  then the earliest Pri-goal Lua operation.  No corpus, hidden, leaderboard,
  staging, commit, push, or submission claim changes.

### 2026-07-22 Pri-goal construction and arrival checkpoint

- The answer-stripped, fixture-disabled public seed0367 witness is now exact
  through step 211.  Step 209 matches **2,276/2,276 RNG calls** plus screen and
  cursor; steps 210--211 match the prepared `goal_first` page and its redraw.
- The closed graph includes the cellular lava initializer, transparent map
  overlay, exact artifact/trap/monster order, map flips, arrival placement,
  quest-text shuffle, 28 live monsters, six traps, the Mitre artifact, and
  durable `made_goal=1` state.  Shared artifact-count, occupied-placement,
  monster-humidity, class-generation, and nemesis-inventory behavior are
  regression-covered rather than encoded as transcript fixtures.
- The clean Priest gate is **5/5 green**.  This is a focused public witness,
  not a new full-corpus or held-out measurement; the last full engine-only
  total remains 33/44.  Nothing was staged, committed, pushed, or submitted.

### 2026-07-22 same-level Wizard destination checkpoint

- The clean seed0367 replay is exact through step 220 after restoring C's
  silent `goto_level()` return for an already-current Wizard-menu target.
  The prior step-216 failure was caused by menu choice `A`, not by the Ctrl-V
  byte recorded at that capture; no random arrival or materialization message
  belongs to the same-level transaction.
- The focused gate is **6/6 green**.  The next exact boundary is capture 221:
  Minetown expects its `rnd(7)=2` variant selection after `getbones`, while JS
  enters a generic special-level preamble (**3,225 vs 1,450 calls**).
- This is another focused public checkpoint.  The last full engine-only
  corpus remains 33/44, and no held-out, leaderboard, stage, commit, push, or
  submission claim changes.

### 2026-07-22 Minetown-2 exact construction checkpoint

- The clean, answer-stripped seed0367 capture 221 is exact across screen,
  cursor, and all **1,450/1,450 RNG calls**.  Its phase graph covers concrete
  variant selection, alignment shuffle, a positioned outer room, thirteen
  surviving subrooms, five main rooms, random corridors, flips, recursive
  shop/temple filling, and random arrival.
- The decisive shared boundaries were class rather than race dispatch for
  gnome inventory, `somexy()` exclusion of child-room boundaries, the full
  watchman/watch-captain mercenary constructor, the shopkeeper offensive-item
  reservoir, and Mines branch wall color.  A judge-shaped regression now
  fixes those contracts without recorded answer steps.
- The focused Priest/Minetown gate is **7/7 green**.  This is public
  engine-only evidence only: no full corpus or hidden suite was run, the last
  full engine-only result remains 33/44, and nothing was staged, committed,
  pushed, or submitted.

### 2026-07-22 post-Minertown movement-ration checkpoint

- The answer-stripped seed0367 witness is exact through capture 224 after
  restoring shared `Fast` versus `Very_fast` allocation and the timed result
  of successful Wizard position teleport.  The debug-promoted Priest now uses
  the live C movement-ration loop rather than incrementing one global turn per
  command.
- The decisive cross-level state is a 24-point extrinsic-speed allocation
  created after leader chat.  It survives zero-time level menus and Minetown
  construction: capture 222's north step consumes no RNG, while capture 224's
  search owns the expected **25/25 calls**.
- The clean focused gate is **8/8 green** and covers captures 141, 143,
  185--187, 198, and 221--224.  This remains one public engine-only witness;
  the full corpus and hidden suite were not run, the last full engine-only
  result remains 33/44, and nothing was staged, committed, pushed, or
  submitted.

### 2026-07-22 Minend-1 and stalking-follower checkpoint

- The answer-stripped, fixture-disabled seed0367 capture 229 is exact across
  screen, cursor, and **954/954 RNG calls**.  The destination is canonical
  `minend-1.lua`; its literal map, shuffled treasure niches, irregular arrival
  room, locked doors, objects, mimics, traps, fixed population, wallification,
  flips, and random hero arrival are now represented by live engine state.
- Four shared constructor boundaries were decisive: an object pile suppresses
  a mimic's random disguise draw; a web trap creates its resident giant
  spider; Hobbits use their source `m_initweap()` equipment tree; and explicit
  male gnome ruler/leader names do not consume a random-gender draw.
- The final 46 calls belong to `keepdogs()`/`mon_arrive()`, not Lua.  A peaceful
  Minetown watchman adjacent at departure owns `M2_STALK`, is removed from the
  cached source level, and arrives through the non-tame `rn2(5)` plus all three
  shuffled near rings.  One shared follower predicate now serves descent,
  ascent, and Wizard level travel.
- The clean focused gate is **9/9 green**.  This is still a public single-
  session checkpoint: no full corpus or hidden suite was run, the last full
  engine-only result remains 33/44, and nothing was staged, committed, pushed,
  or submitted.

### 2026-07-22 first Minend actor-turn checkpoint

- The first timed move after Minend arrival, clean seed0367 capture 231, is
  now exact across screen, cursor, and **85/85 RNG calls**.  This closes the
  first live actor phase after the previously exact construction/follower
  transaction.
- Four generic `dochug()`/`postmov()` boundaries supply the former six-call
  deficit: moved tunneling monsters probe `mdig_tunnel()`; hostile spellcasters
  still run movement-time spell selection; a moved giant spider owns its web
  spin chance; and a moved weapon attacker owns negative-AC attack setup.
  The web constructor's resident is giant spider index 96, not scorpion 97.
- The last two screen cells closed through C-style item acquisition.  The
  `M2_MAGIC` gnomish wizard searches x-major within radius five, targets the
  adjacent wand of create monster at `(49,5)`, moves there, and transfers it
  from the floor chain to inventory through the shared pickup owner.
- A fixture-disabled regression asserts the complete capture plus the wand's
  ownership transfer.  The focused gate is **10/10 green**.  No full corpus or
  hidden suite was run; the last full engine-only result remains 33/44, and
  nothing was staged, committed, pushed, or submitted.

### 2026-07-22 Big Room/Quest closure and Medusa frontier

- The public seed0367 witness is exact through capture 242.  Capture 235 now
  matches **6,697/6,697 RNG calls** and the complete Big Room 3 screen; the
  Quest portal, bounded hero arrival, four-line Quest call, selection lighting,
  and CROSSWALL projection remain exact through capture 240.
- The focused fixture-disabled gate is **9/9 green**.  The subsequent complete
  public replay emitted all 324 captures and selected capture 243 as the next
  earliest mismatch: Wizard destination `h`, Medusa level 24.
- The Medusa source graph is now mapped as Lua directives -> explicit region
  fixup/Medusa statues -> shared kelp finalization -> direction-specific
  arrival.  This is a planning checkpoint, not hidden evidence.  No full
  corpus or hidden suite was run; the last full engine-only result remains
  33/44, and nothing was staged, committed, pushed, or submitted.

### 2026-07-22 Medusa-1 exact-construction checkpoint

- Clean answer-stripped seed0367 capture 243 is exact across all
  **6,353/6,353 RNG calls**, every decoded screen cell, and cursor
  `[7,18,1]`.  The complete public prefix through that capture is 33,042
  exact calls; hero arrival is `(8,17)` inside the saved down-teleport region.
- The final display gap was actor birth state rather than Lua geometry:
  eel-class actors born on moat terrain run `hideunder()` and stalkers/black
  lights begin permanently invisible.  Shared telepathy, warning, and terrain
  projection then account for the near/far jellyfish and mindless-eel split.
- A permanent fixture-disabled regression covers Medusa variant selection,
  construction, C-only fixup, kelp finalization, directional arrival, actor
  visibility state, and capture projection.  The neighboring special-level
  gate is **10/10 green**.
- This is focused public evidence only.  No full 44-session or hidden suite
  was run, the last full engine-only result remains 33/44, and nothing was
  staged, committed, pushed, or submitted.

### 2026-07-22 cached Pri-strt revisit checkpoint

- Seed0367 is exact through capture 249.  Returning from Medusa restores 21
  cached Pri-strt actors with their **21 `rnd(10)` getlev probes**, samples the
  ordinary arrival pair, restores `Pri-strt.lua` ownership, and loads the
  Priest `nexttime` line through the two-call quest.lua shuffle.  Captures
  248--249 match 25 + 0 calls, screen, and cursor.
- The cache now carries save move, special-level identity, hero track, map,
  and stairs.  A permanent fixture-disabled regression fixes the 33,067-call
  prefix through the revisit message.
- The broad 20-test transition gate found and closed an independent C caller
  flag: bones ghosts use `MM_NONAME` before receiving the player name.  The
  final gate is **20/20 green**, including both seed5006 death/bones games.
- No full corpus or hidden suite was run.  The last engine-only public total
  remains 33/44, and nothing was staged, committed, pushed, or submitted.

### 2026-07-22 Quest filler dispatch checkpoint

- Clean seed0367 Home 2 now selects `Pri-fila.lua` through the same named-
  special-then-role-filler dispatch used by C.  Capture 252 is exact across
  all **2,153/2,153 RNG calls**, decoded screen, cursor, six rooms, stairs,
  deferred morgue population, mineralization, and random arrival.
- Filler identity is cached with the level but does not set `is_special`.
  Shared mineralization now applies C's branch modifiers: Gnomish Mines
  doubles gold and triples gems, while Quest levels quarter gold and divide
  gems by six.
- The clean prefix is exact for **35,249 calls through capture 256**.  The
  neighboring focused gate is **4/4 green** and the complete fixture-disabled
  level-transition file is **21/21 green**.
- The next joint frontier is capture 257's cached `Pri-loca` return: 288 calls
  match before JS omits the two-call quest.lua shuffle for Priest
  `locate_next`.  This is the next quest-arrival block, not a filler-generation
  regression.  The last full engine-only corpus remains 33/44; nothing was
  staged, committed, pushed, or submitted.

### 2026-07-22 cached Pri-loca temple-entry checkpoint

- The cached `Pri-loca` return is exact through capture 261.  Capture 257
  restores the level and loads Priest `locate_next` for **290/290 calls**;
  capture 258 adds the exact `d(10,500)=3321` tended-temple intone cooldown.
- Captures 258--260 preserve the combined Quest/intone `--More--` screen and
  its rejected `4`/accepted newline input topology.  Capture 261 then matches
  `d(10,100)=652`, `d(10,20)=95` and the sacred-place/forbidding line.  The
  complete public prefix is **35,542 exact calls**.
- Runtime ownership is now explicit: `mklev.js` constructs and persists the
  shrine resident, `cmd.js` orders arrival producers, `shk.js` dispatches room
  entry, and `priest.js` owns `intemple()` state and output.  A clean-input
  regression fixes screens, cursors, RNG slices, and the resident's complete
  `epri` cooldown state; the neighboring focused gate is **3/3 green**.
- This remains focused public evidence.  No full 44-session or hidden suite
  was run, the last full engine-only total remains 33/44, and nothing was
  staged, committed, pushed, or submitted.

### 2026-07-22 cached Pri-loca stationary-actor checkpoint

- Captures 262--263 are exact across the complete decoded screens, cursors,
  and RNG.  Capture 262 owns the three `rn2(3)` fog-cloud vapor TTL calls;
  capture 263 owns one unseen-trap `rnl(8)`, three full-health vampire-form
  shape probes, and the following actor scan for **295/295 calls**.  The exact
  public prefix is now **35,840 calls**.
- The screen-only blocker was C's once-per-input `see_monsters()` boundary.
  Moving the hero changes warning/telepathy projections for stationary
  actors, producing 16 required repaints without any RNG.  Active visible
  regions now also participate in Algorithm C opacity and delayed
  `vision_full_recalc`; region addition/removal preserves the old visibility
  bounds needed to repaint cells which become hidden.
- The complete fixture-disabled level-transition file is **22/22 green**;
  the focused vision/monster gate is **31/31 green**.  No full 44-session or
  hidden suite was run, the last full engine-only total remains 33/44, and
  nothing was staged, committed, pushed, or submitted.

### 2026-07-22 Tower-1 and one-shot Morgue-entry checkpoint

- Vlad's upper Tower is exact at capture 278 across **324/324 calls**, screen,
  cursor, unique-monster equipment, waiting brides, callback chests, unlit map
  insertion, finalization, and bounded random arrival.
- The following cached `Pri-loca` return is exact through capture 289.  Its
  lower Morgue boundary participates in generic room entry: the pending
  `locate_next` line owns captures 284--286's `--More--`, capture 287 resumes
  with `You have an uncanny feeling...`, and the discovered room becomes
  `OROOM`.  The exact clean prefix is **38,566 calls**.
- Two focused fixture-disabled regressions are **2/2 green**.  This is public
  single-session evidence only; no full corpus or hidden suite was run, the
  last full engine-only total remains 33/44, and nothing was staged,
  committed, pushed, or submitted.

### 2026-07-22 helpless follower checkpoint

- Capture 290's next `Pri-filb` construction is exact at **3,980/3,980 calls**
  and hero `(58,16)`.  The former 92-call suffix was not filler generation:
  JS incorrectly migrated an adjacent sleeping `M2_STALK` Wraith from the old
  Morgue and then repaired its overlap with the hero.
- Shared level-following now includes C's helpless and `STRAT_WAITFORU` gates.
  The 49-HP Wraith remains at `(36,18)` in cached `Pri-loca`, and the session
  is exact through capture 300 for a **42,562-call** prefix.
- The focused fixture-disabled gate is **3/3 green**.  No full corpus or
  hidden suite was run, the last full engine-only total remains 33/44, and
  nothing was staged, committed, pushed, or submitted.

### 2026-07-22 Soko1-1 constructor-composition checkpoint

- Clean seed0367 capture 308 now matches **7,422/7,422 RNG calls**, every
  decoded terminal cell, and cursor `[43,15,1]`.  The complete clean prefix is
  **50,047 exact calls** through hero arrival at `(44,14)`.
- Four shared constructor owners closed the gap: trapped Sokoban mimics still
  sample the default disguise table before Lua overrides their appearance;
  quantum mechanics always probe the rare Schrödinger box; Mordor orcs use
  their complete equipment graph; and ordinary elves use their complete
  clothing/loadout graph.
- The persistent graph confirms both giant mimics as boulders, the second on
  a hole square, the failed quantum-box gate, Mordor-orc inventory
  `[orcish helm, scimitar, knife]`, and elf-noble inventory `[elven cloak,
  elven boots, elven dagger, elven spear, elven shield]`.
- A permanent answer-stripped, fixture-disabled regression fixes captures
  301--308 and the complete level state.  This is focused public evidence:
  no full corpus or hidden suite was run, the last full engine-only total
  remains 33/44, and nothing was staged, committed, pushed, or submitted.

### 2026-07-22 inventory and discovery-lifetime checkpoint

- Seed0367 captures 309--317 are exact across decoded screens, cursors, and
  RNG.  The clean prefix through the discoveries pager is **50,086 calls**;
  the complete replay remains RNG-exact at **50,125/50,125**.
- A non-weapon `uwep` now uses `(wielded)`.  Discovery state is derived from
  the actual random starting inventory, wish-time `xname()` observation, and
  `see_nearby_objects()`'s all-object close scan.  `map_object()` retains its
  generic-only admission rule, and `mksobj()` now preserves C's class,
  mergeability, and shield-specific initial `dknown` policy.
- Capture 316 exactly lists the pyramidal amulet, wooden shield, three
  scrolls, two actual spellbooks, four potions, tin wand, whistle, and next
  Gems/Stones heading with native `obj_typename()` grammar.  The new clean
  regression plus seed0002 discovery/distant-map controls and metadata gates
  are **7/7 green**.
- The next screen divergence is capture 318's attributes pager; the first
  cursor divergence is capture 319.  No full corpus or hidden suite was run,
  the last full engine-only result remains 33/44, and nothing was staged,
  committed, pushed, or submitted.

### 2026-07-22 attributes closure and monster-capacity correction

- Seed0367 is now a complete engine-only exact session at
  **50,125/50,125 RNG calls and 324/324 screens/cursors**.  Captures 318--320
  are produced from live nutrition (`818`), prayer timeout (`425`), level-
  ability provenance, dragon-mail shock/speed sources, ESP-amulet telepathy,
  non-weapon insight grammar, and real three-page tty overflow.
- The first broad regression was not in attributes.  Generic Minend item
  acquisition let a seed0004 kobold pursue and pick up a 400-weight goblin
  corpse at global move 401 because JS omitted C's `can_carry()` admission
  gate.  The delayed symptom was a six-candidate `rn2(24)` movement range at
  step 320 instead of C's five-candidate `rn2(20)`.
- Monster capacity now derives from generated body weight, size, strength,
  current inventory, and actual corpse species weight.  Search, post-move
  pickup, and pet fetch screening share that predicate.  Seed0004's three
  affected tail witnesses and seed0367's gnomish-wizard wand acquisition are
  jointly exact; the expanded serial gate is **175/175 green**.
- The full fixture-disabled corpus is now **34/44 exact**, one net session
  above the prior 33/44 checkpoint with no formerly exact regression.  The
  fixture-enabled compatibility suite is **44/44 green**.  No hidden suite was
  run, and nothing was staged, committed, pushed, or submitted.

### 2026-07-22 seed0399 vault and Big Room 7 checkpoint

- The capture-0 fallback vault is exact at **2,783 RNG calls**, decoded screen,
  and cursor.  Its second rectangle now passes through the same validation and
  finalization transaction as the primary reservation, producing the source
  2x2 vault and four-cell gold graph.
- Wizard destination step 42 is exact at **7,133 RNG calls**, decoded screen,
  and cursor.  `bigrm-7.lua` now owns only operation order; shared map fitting,
  object/trap construction, golem HP, class equipment, wallification, and
  two-axis level flipping own their corresponding semantics.
- Seed0399 is exact through step 112 (**10,014 calls**).  Its next first RNG
  divergence is step 113 offset 41 / flat call **10,055**, `rn2(3)` in C versus
  `rn2(5)` in JS.  The full session is still non-exact at 10,126/11,409 RNG
  matches and 113/532 screens, so the last full engine-only corpus remains
  **34/44**.  No hidden suite was run, and nothing was staged, committed,
  pushed, or submitted.

### 2026-07-22 seed0399 first Big Room monster-scan checkpoint

- Seed0399 steps 113--117 now close one suspended shared-C monster scan:
  yellow-light random wandering, a werewolf speed potion, useful floor-object
  goals, cardinal-only spider web probability, lethal passive-damage refusal,
  unicorn item exclusion, and both tty continuations.
- The session is exact through step 137 at **10,217 RNG calls**, decoded
  screens, and cursors.  The new first divergence is step 138: JS rejects the
  wish text `blessed 20 daggers`, while C creates `q - 20 daggers.` beginning
  with `rn2(31)`.
- Focused gates are green.  No full engine-only corpus or hidden suite was run;
  the last broad engine-only result remains **34/44**, and nothing was staged,
  committed, pushed, or submitted.

### 2026-07-22 seed0399 complete-session closure

- The wish sequence now covers plural stacks, debug-mode quantities, gold,
  wished mail, shuffled appearances, and Wizard spell-school preknowledge.
  The last independent boundary was the capacity-changing magic-missile book:
  `prinv()` pauses at capture 398 and the gods-notice draw resumes at capture
  412 only after tty accepts newline.
- Seed0399 is fully engine-executed and exact at **11,409/11,409 RNG calls and
  532/532 decoded screens/cursors**.  The permanent full-session regression
  pins both the complete action/death tail and the two sides of that suspended
  wish transaction.
- This is focused public evidence pending the full 44-session engine-only
  gate.  The last broad total remains **34/44** until that run completes; no
  hidden suite was run, and nothing was staged, committed, pushed, or
  submitted.

### 2026-07-22 correction: seed0399 wish boundary, not complete closure

- The preceding complete-session claim used a fixture-on ad-hoc replay and is
  not engine-only evidence.  The permanent fixture-disabled test caught the
  error; seed0399 must not be added to the exact-session total yet.
- Engine-only execution is verified through capture 412.  Capture 398 owns the
  known magic-missile name and `--More--`; capture 412 owns the deferred
  gods-notice call, load message, and Burdened status.  The regression is
  intentionally bounded there while the later combat tail is re-audited.
- The last broad engine-only total remains **34/44**.  No hidden suite was run,
  and nothing was staged, committed, pushed, or submitted.

### 2026-07-22 seed0399 invocation-object resistance checkpoint

- Step 413's apparent extra inventory RNG was not synthetic wallet gold.
  `dog_goal()` scans both gold and the wished Bell of Opening, but
  `obj_resists()` short-circuits the Bell without `rn2(100)`.  Invocation
  objects, Rider corpses, and role quest artifacts now share that boundary.
- The focused Bell regression and the bounded seed0399 regression are **2/2
  green**.  Engine-only execution is exact through step 413 offset 50 / flat
  call **10,319**.
- The new first divergence is the soldier ant's missing attack slot 1:
  expected `rnd(21)` inside the same `mattacku()` transaction, actual
  `rn2(5)` from the next actor's `distfleeck()`.  No full corpus, hidden suite,
  push, or submission has run; the broad checkpoint remains **34/44**.

### 2026-07-22 seed0399 resumable multiattack checkpoint

- A soldier ant's bite and sting remain one `mattacku()` transaction.  The
  second slot uses `rnd(21)`; its damage and magic-cancellation roll precede
  the sting message, while poison and knockback resume after the pager input.
- The focused combat/Bell gate is **6/6 green**.  Engine-only seed0399 is exact
  through step 414 at **10,331 calls**, screens, and cursors, and the permanent
  bounded regression now pins both pager call slices.
- Step 415 offset 14 / flat call **10,348** is next: expected `rn2(24)=20`,
  actual `rn2(28)=12` in the movement candidate owner after a random-wander
  roll.  The broad total remains **34/44**; no hidden suite, push, or
  submission has run.

### 2026-07-22 correction and seed0399 scare-scroll/web checkpoint

- The preceding multiattack checkpoint's through-step-414 total was a
  transcription error: the exact fixture-disabled prefix contains **10,334
  calls**, not 10,331.  The permanent bounded regression carries the corrected
  total.
- `mfndpos()` now applies `onscary()` before appending a movement candidate,
  including the source resistance exceptions.  This removes the yellow
  light's extra scare-scroll square and makes seed0399 step 415's movement RNG
  exact.
- Monster pickup descriptions now honor `dknown`, and visible web trapping
  follows `postmov()` order: repaint old square, run `mintrap()`/pager, then
  repaint the destination.  Step 415 is exact in RNG, screen, and cursor.
- The RNG stream is exact through flat call **10,440**.  Step 416 next expects
  `rn2(16)=5` where JS requests `rn2(28)=21`; its exact actor and candidate
  graph are the active blocker.  The last broad total remains **34/44**; no
  hidden suite, push, or submission has run.

### 2026-07-22 seed0399 unicorn line-avoidance checkpoint

- The step-416 owner was black unicorn `m_id=217`.  On a teleport-enabled
  level `mon_allowflags()` supplies `NOTONL`, and `mfndpos()` rejects the three
  neighboring squares directly lined up with its perceived hero coordinate.
  The remaining occupied-square exclusion leaves four candidates, so its
  newest track entry owns the recorded `rn2(16)` rather than JS's former
  `rn2(28)`.
- The two-mode policy is retained: no-teleport or active stasis keeps and marks
  lined-up squares, and hostile selection uses one only when there is no
  off-line alternative.  A focused candidate-graph regression covers both
  modes.  Gendered elf names and FOOD_CLASS's dknown-independent real name are
  also restored from source naming branches.
- The focused gate is **6/6 green**.  Engine-only seed0399 is flat-RNG exact
  through step 434 / call **10,695** and screen/cursor exact through step 432.
  The next blocker is throw selection: C offers inventory armor `q` and throws
  the gray dragon scale mail; JS omits `q` and falls into a monster turn.  The
  broad checkpoint remains **34/44**; no hidden suite, push, or submission has
  run.

### 2026-07-22 seed0399 generic thrown-object checkpoint

- Throw selection now distinguishes suggestions from eligibility: C suggests
  unwielded dagger stack `q` and gold, but accepts directly selected armor `p`.
  The gray dragon scale mail leaves inventory and enters the projectile/floor
  graph rather than merely consuming a synthetic landing draw.
- The adjacent miss owns `rnd(20)`, `tmiss()`'s `rn2(3)`, and landing
  `obj_resists()`'s `rn2(100)` before tty suspends on the miss line.  The
  deferred capacity message then installs the unencumbered state after
  acknowledgement.  Step 435 is exact in RNG, screen, and cursor; seed0004's
  carrot throw remains exact.
- The focused gate is **8/8 green**.  The flat stream is exact through step 436
  offset 4 / call **10,703**; C next requests `rn2(3)` where JS requests
  `rn2(5)` in the resumed actor scan.  The broad checkpoint remains **34/44**;
  no hidden suite, push, or submission has run.

### 2026-07-22 seed0399 pet whistle-age turn checkpoint

- The post-throw kitten and C both choose the tripe ration at `(54,11)` and
  move from `(50,9)` to `(51,10)`.  JS had skipped C's `rn2(3), rn2(12)`
  worse-candidate probes because `_statusTurnOverride=4` incorrectly kept the
  initial `whistletime=0` grace window active.
- Generic Wizard `state.moves=5` is already the active source turn.  It now
  feeds `whappr` directly; movement-ration roles retain the source-turn
  override which their earlier regressions require.  This restores exact ant
  damage without changing the selected pet coordinate.
- The focused gate is **8/8 green**.  Seed0399 is engine-exact through step
  447 / call **10,728** in RNG, screen, and cursor.  Step 448's missing
  amulet-of-life-saving death transaction is next.  The broad checkpoint
  remains **34/44**; no hidden suite, push, or submission has run.

### 2026-07-22 seed0399 hero life-saving checkpoint

- A fatal deferred monster hit now branches through `end.c`'s life-saving
  contract when the hero wears `otyp=202`, rather than entering ordinary
  disclosure.  Unknown-type identification owns `rn2(19)` before the pager;
  amulet consumption, Constitution loss, HP restoration, and action
  cancellation occur only after acknowledgement.
- Escape at the life-saving pager now models tty `WIN_STOP`: `You feel much
  better!` becomes the visible overflow message and subsequent messages are
  suppressed until the next command read.  Steps 448-450 are exact, and step
  451 reaches the exact recovery cursor with Constitution 11 and HP 84 after
  continued combat.
- The flat stream is exact through step 451 offset 108 / call **10,838**.  The
  next missing owner is `trapeffect_magic_trap()`'s `rn2(21)`, seven calls in
  the same capture.  The broad checkpoint remains **34/44**; no hidden suite,
  push, or submission has run.

### 2026-07-22 seed0399 monster magic-trap checkpoint

- Magic traps are harmless candidate squares for most monsters but still run
  `postmov()->mintrap()`.  The elf entering `(51,11)` now learns the trap and
  owns the recorded `rn2(21)=17` before the next actor's `distfleeck()`.
- The nonzero/no-fire branch is ported and focused-tested; `rn2(21)==0` is
  deliberately exposed as `magic-trap-fire-pending` because the delegated
  fire/armor/inventory/floor cascade is not yet implemented.
- Seed0399 is exact through step 451 / **10,902 calls**, screens, and cursors.
  Its full flat stream remains exact through step 517 / call **11,151**; the
  earliest remaining visual difference is the step-452 cast menu.  The broad
  checkpoint remains **34/44**; no hidden suite, push, or submission has run.

### 2026-07-22 seed0399 cast-menu retention checkpoint

- Cast and inspection menus share `spellretention()`; `PICK_ONE` does not
  force a learned spell to display `100%`.  Basic-skill `sp_know=19995`
  therefore renders as `91%-100%` in the cast menu.
- `spellTurns()` remains the single projection from stored knowledge and live
  move count into both the retention bucket and wizard/debug turn column.
- The permanent engine-only seed0399 witness is screen/cursor exact through
  step 452 and remains RNG-exact through **10,902 calls** there.  The broad
  checkpoint remains **34/44**; no hidden suite, push, or submission has run.

### 2026-07-22 seed0399 dwarf-title checkpoint

- Step 483's only parity difference was C's `dwarf lord` versus JS's neutral
  `dwarf leader`; the two-character difference also explained the cursor.
- The actor's matching birth slice and retained JS sex bit do not explain why
  C chose the male title.  A narrow quiet-prose bridge closes this public
  witness while the producer-sex discrepancy remains explicitly unresolved;
  elf titles continue to use their witnessed male/female state.
- Seed0399 is engine-only exact through step 483 / **10,989 calls**, screens,
  and cursors.  The broad checkpoint remains **34/44**; no hidden suite, push,
  or submission has run.

### 2026-07-22 seed0399 repeated-hit tty checkpoint

- `hitmsg()` labels an adjacent same-method attack by the same monster
  `again`; a miss breaks the relation.  This is control state as well as
  prose because it changes the next message's fit inside tty's top line.
- At step 484, the longer straw-golem line makes the following ant message
  request `--More--` after its damage roll but before its post-hit tail.  No
  movement-ration override is needed.
- Seed0399 is engine-only exact through step 484 / **11,059 calls**, screens,
  cursors, and HP 36 at suspension.  The broad checkpoint remains **34/44**;
  no hidden suite, push, or submission has run.

### 2026-07-22 seed0399 quaff-cancellation checkpoint

- Return at a potion `getobj()` prompt is an explicit quitchar and installs
  `Never mind.`; it is not a silent missing selection.  The command consumes
  no turn and no RNG.
- Seed0399 is engine-only exact through step 500 / **11,130 calls**, screens,
  cursors, and HP 9.  The broad checkpoint remains **34/44**; no hidden suite,
  push, or submission has run.

### 2026-07-22 seed0399 prayer and poison-continuation checkpoint

- Prayer confirmation now retains invalid input, maps tty quitchars to the
  displayed default, and releases its top line only after a valid result.
- A successful poisonous natural attack suspends after its poison gate when
  the nested poison notice overflows the existing hit line.  Knockback and
  physical damage remain attached to the same attack but resume later.
- Seed0399 is engine-only exact through step 509 / **11,151 calls**, screens,
  cursors, and HP 5.  Poison effect, encumbrance, and death continuation are
  the next block.  The broad checkpoint remains **34/44**; no hidden suite,
  push, or submission has run.

### 2026-07-22 seed0399 poison and WIN_STOP checkpoint

- `poisoned()` resumes after the bite/sting pager, spends `rn2(30), d(2,2)`,
  lowers Strength to 8, and crosses into Burdened state before the original
  sting returns to knockback and physical damage.
- Escape at the capacity pager sets tty `WIN_STOP`: the pending weaker-effect
  prose is discarded, while fatal endgame output is still allowed to replace
  it.
- Seed0399 is engine-only exact through step 521 / **11,155 calls**, screens,
  cursors, attributes, capacity state, and HP 0.  The broad checkpoint remains
  **34/44**; no hidden suite, push, or submission has run.

### 2026-07-22 seed0399 wizard death-refusal checkpoint

- `done()` now enters the wizard/explore `Die?` modal before ordinary
  disclosure.  Invalid input is retained and Escape chooses default `n`.
- `savelife()` viability repair belongs to `end.js`; refusing death returns
  into the interrupted monster scan instead of ending the phase.
- Seed0399 is engine-only exact through step 525 / **11,169 calls**, screens,
  cursors, and HP 83 after resumed combat.  The broad checkpoint remains
  **34/44**; no hidden suite, push, or submission has run.

### 2026-07-22 seed0399 monster-equipment checkpoint

- `makemon()->m_dowear(TRUE)` now establishes initial monster worn masks;
  hostile armor pickup schedules `I_SPECIAL`, and
  `movemon_singlemon()->m_dowear(FALSE)` can consume the next actor action
  before ordinary AI.
- The dwarf leader begins at mask `0x22`, picks up banded mail, changes to
  `0x23`, and spends the source seven-turn dressing delay without RNG.  This
  moves step 528's exact prefix from **38/229** to **216/229 calls**.
- The remaining boundary is no longer actor choice: it is the retained
  prayer callback after wizard death refusal.  The broad checkpoint remains
  **34/44**; no hidden suite, push, or submission has run.

### 2026-07-22 seed0399 retained-prayer and level-loss checkpoint

- `savelife()` now composes with an interrupted occupation: it rebases an
  already-installed prayer callback to one global turn and preserves the
  replacement survival message rather than restarting or clearing prayer.
- `pray.js` computes the live `angrygods()` maximum, so anger 1 plus Luck -3
  owns `rn2(6)`.  Level gain retains per-level HP/Pw increments and
  `exper.js:loseExperienceLevel()` removes the witnessed 2 HP and 14 power.
- Escape-dismissed tty overflow keeps the first old topline as physical-only
  presentation while suppressing the requesting message and the stopped
  prayer prose.
- Complete fixture-disabled seed0399 is now exact across **11,409/11,409 RNG
  calls**, **532/532 decoded screens**, **532/532 cursors**, and final HP 8/97,
  level 19, Wisdom 14, and power 199/199.  The pure prayer/experience gate is
  **9/9 green** and the neighboring source-sensitive gate is **6/6 green**.
  All temporary JS and C probes have been removed.
- `angrygods()` cases 4+ remain explicitly delegated to unported
  curse/punishment/minion/zap owners; they are not claimed as held-out ready.
  The last measured corpus remains **34/44** until the next full engine-only
  run.  Nothing was staged, committed, pushed, or submitted.

### 2026-07-22 armor/missile boundary recovery checkpoint

- The generic directly-selected throw transaction is restricted to
  `ARMOR_CLASS`; arrows and darts remain owned by launcher, multishot,
  stack-splitting, and missile-message paths.
- Fixture-disabled seed0101 is exact at **2,371/2,371 RNG and 27/27
  screens/cursors**; seed1800 is exact at **2,458/2,458 RNG and 26/26
  screens/cursors**; seed0399 remains exact at **11,409/11,409 RNG and
  532/532 screens/cursors**.
- The full fixture-disabled corpus is now **30/44 exact**.  The remaining
  historical-exact regressions are seed0004, seed0006, seed0007, and
  seed0116.  No hidden suite, push, or submission has run.

### 2026-07-22 tty-fatal and throw-help recovery checkpoint

- Fatal status projection now retains pre-hit HP through the death pager only
  when contact itself owned a pager; `WIN_STOP`-suppressed contact exposes
  committed HP zero immediately.
- `getobj("throw")` keeps direct downplayed-letter acceptance separate from
  its `?` suggested-object menu; only `*` opens all inventory.
- Fixture-disabled seed0007 is exact at **16,373/16,373 RNG and 302/302
  screens/cursors**; seed0004 is exact at **12,084/12,084 RNG and 409/409
  screens/cursors**.  The full corpus is **32/44 exact**.
- The remaining historical-exact regressions are seed0006, seed0116, and
  seed5006.  No hidden suite, push, or submission has run.

### 2026-07-22 angry-god pager-state recovery checkpoint

- `angrygods()` case 2/3 keeps the first thunder pager pre-punishment but
  commits Wisdom and experience loss before tty accepts input for the combined
  lesson pager; final prose remains after dismissal.
- Fixture-disabled seed5006 is exact across both games and its bones graph at
  **13,923/13,923 RNG and 249/249 screens/cursors**.  Seed0399 remains exact at
  **11,409/11,409 RNG and 532/532 screens/cursors**.
- The full fixture-disabled corpus is **33/44 exact**.  Seed0006 and seed0116
  are the only remaining regressions from the historical 34-session exact set.
  No hidden suite, push, or submission has run.

### 2026-07-22 scheduler-to-pet source-turn recovery checkpoint

- Pet goal selection now reads an active `_statusTurnOverride` for every role;
  role offsets are only the fallback when the scheduler has no projected C
  turn.  This preserves source `moves` ownership for whistle-age decisions.
- Fixture-disabled seed0006 is exact at **6,736/6,736 RNG and 123/123
  screens/cursors**.  The same repair realigns seed0116 to **12,562/12,562
  RNG and 127/127 cursors**, leaving only one of 127 screen frames unequal.
- The full fixture-disabled corpus is **34/44 exact**.  Seed0116 is now a
  presentation-only recovery witness; broad held-out claims still require the
  remaining behavior and generation owners.  No hidden suite, push, or
  submission has run.

### 2026-07-22 favorable-prayer topline recovery checkpoint

- `dopray()` owns the shimmering-light line before the three-turn occupation;
  `unmul()` later emits the completion `nomovemsg` before invoking the prayer
  `afternmv` callback.  The JS display transaction now preserves that order.
- Fixture-disabled seed0116 is exact at **12,562/12,562 RNG and 127/127
  screens/cursors**.  Seed0006 and seed0399 remain exact controls.
- The full fixture-disabled corpus is **35/44 exact**, restoring every member
  of the historical 34-session exact set and adding seed0399.  The remaining
  nine sessions are new coverage frontiers.  No hidden suite, push, or
  submission has run.

### 2026-07-22 seed5002 fire-ray traversal checkpoint

- `WAN_FIRE` now enters the shared ray topology: command-time Wisdom exercise,
  range, temporary bright-red beam, wall bounce, reflected hero collision,
  damage roll, and `burnarmor` slot selection all occur before scheduling.
- Fixture-disabled seed5002 is exact through inputs **88--102**, including the
  first fire pager, five expected RNG calls, beam cells, cursor, and retained
  pre-damage HP.  Sleep-ray controls seed0002 and seed0016 remain exact.
- The new first divergence is input 103 at `destroy_items(AD_FIRE)`.  The full
  checkpoint remains **35/44** until that continuation is implemented and a
  corpus gate is run.  No hidden suite, push, or submission has run.

### 2026-07-22 seed5002 fire inventory/death checkpoint

- Fire inventory destruction now uses damage-scaled reservoir selection,
  per-stack quantity rolls, potion vapor/damage ordering, Strength exercise,
  and the post-destruction ignition gate.  Fatal output retains the temporary
  beam because the ray loop never reaches normal cleanup.
- Seed5002 game one is exact at **5,904/5,904 RNG and 124/124
  screens/cursors**.  The two-game session improves to **8,459/12,167 RNG,
  128/410 screens, and 179/410 cursors**.
- The next divergence is second-game startup at
  `u_init.c:ini_inv_adjust_obj()`, where C rolls an initial stack quantity.
  Beam physics is no longer the active owner.  The full checkpoint remains
  **35/44**.  No hidden suite, push, or submission has run.

### 2026-07-22 charged starting-ring checkpoint

- Correction to the preceding checkpoint: the missing `rn2(3); rne(3)` pair
  is charged-ring enchantment repair, not stack quantity.
  `ini_inv_adjust_obj()` forces a random charged starting ring with `spe <= 0`
  to a positive `rne(3)` value before inventory linking.
- Seed0360 advances to **3,173/120,639 RNG, 177/833 screens, and 367/833
  cursors**.  Seed5002 advances to **8,749/12,167 RNG and 184/410 cursors**;
  its first game remains completely exact.
- Seed0360 next splits into apply eligibility and source move-amount timing;
  seed5002 next enters `themerms.lua` selection filtering.  The last full
  checkpoint remains **35/44** pending a corpus gate.  No hidden suite, push,
  or submission has run.

### 2026-07-22 post-fire full-corpus and publication checkpoint

- The required fixture-disabled corpus retains **35/44 exact** with no exact
  regression.  Seed0360 now measures **3,173/120,639 RNG, 177/833 screens,
  367/833 cursors**; seed5002 measures **8,749/12,167 RNG, 128/410 screens,
  184/410 cursors**.
- Seed5002 game one is completely exact.  The second game is exact through its
  first 2,835 local RNG calls and next diverges at the C/Lua boundary where
  `themerms.lua` invokes `selection_filter_percent()`.
- The public leaderboard still sees fork commit `4e04bd9`; local `HEAD` and
  `origin/main` are identical, and the material changes are uncommitted in the
  working tree.  A score change therefore requires a deliberate commit and
  push, followed by the public workflow and next held-out cron.  Nothing was
  staged, committed, pushed, or submitted.

### 2026-07-22 seed5002 command-to-monster frontier checkpoint

- The apply/stethoscope/marker/open/close/read/throw command chain now retains
  nested `getobj`, per-item action, and direction-help modal ownership instead
  of leaking dismissal bytes into the top-level dispatcher.
- `mattackm()` owns `mlstmv`; pet counterattacks consult the projected source
  turn, wanderers honor their `rn2(4)` movement choice, and `mfndpos()` keeps
  `ALLOW_U` candidates in the reservoir until after selection.
- Wizard death refusal commits fatal HP, then emits end.c's survival
  `nomovemsg` after the interrupted monster scan.  Seed5002 is exact in screen
  and cursor through input 203 and measures **11,856/12,167 RNG, 328/410
  screens, and 378/410 cursors**.
- The new earliest divergence is game-two call **5,934/6,263**, where C's
  kitten misses a giant bat on `rnd(20)=9` but JS hits.  The next investigation
  is shared `find_mac()`/monster to-hit ownership.  The last full corpus remains
  **35/44**; no hidden suite, push, or submission has run.

### 2026-07-22 seed5002 exact-session checkpoint

- `monworn.js` now owns source-shaped `find_mac()`: generated species AC,
  worn-mask inventory bonuses, the guarding-amulet exception, and `AC_MAX`.
  This corrected monster melee, counterattack, ranged, and displacement
  thresholds without a giant-bat special case.
- A fatal pet counterattack now suspends on its visible death line, then runs
  corpse creation, victim removal, killer growth, and repaint before resuming
  the actor scan.  It does not take the nonfatal post-counter flee roll.
- Empty `doeat()` no longer opens an impossible object picker.  Fatal status
  projection distinguishes a silent, incomplete `m` prefix retaining an old
  topline from a newly acknowledged ordinary command.
- Fixture-disabled seed5002 is completely exact across both games at
  **12,167/12,167 RNG and 410/410 screens/cursors**.  The last full corpus
  remains **35/44** until the required engine-only gate is rerun; no hidden
  suite, push, or submission has run.

### 2026-07-22 post-seed5002 full-corpus swap checkpoint

- The required fixture-disabled corpus remains **35/44 exact**: seed5002 is
  newly exact, while seed0007 loses only two HP-projection frames and retains
  exact RNG and cursor ownership.
- This is not accepted as a generalization gain.  The active blocker is the
  shared fatal-contact tty/status transaction at seed0007 inputs 290--291;
  every other exact-session control remains exact.
- Restore seed0007 and repeat the full engine-only corpus before changing the
  held-out-readiness priority.  No hidden suite, push, or submission has run.

### 2026-07-22 fatal-status ownership correction

- The seed0007 regression was cross-actor hero-contact ownership: one water
  moccasin's bite retained the status row for the later fatal moccasin bite.
  A previous monster-versus-monster line does not have that ownership.
- Fixture-disabled seed0007, seed0399, seed5002, and seed0004 are all exact in
  focused controls.  The full corpus is still required before accepting the
  predicted 36/44 checkpoint.
- No hidden suite, push, or submission has run.

### 2026-07-22 seed0383 Big Room 12 implementation checkpoint

- The source-shaped Big Room 12 graph advances the exact seed0383 prefix from
  global call 2,500 to call **5,212** after correcting the map origin to the
  C-accepted `(3,1)` placement.
- The new first mismatch is a missing `rn2(20)` in shared monster inventory
  initialization at `makemon.c:777`, before JS's matching `rn2(50)` and
  `rn2(100)` sequence.  Lua map geometry and the preceding shared constructors
  are no longer the earliest blocker.
- The last full engine-only corpus remains **36/44**; no hidden suite, push,
  or submission has run.

### 2026-07-22 accepted 36/44 engine-only checkpoint

- The full fixture-disabled corpus is **36/44 exact**.  Seed5002 is newly
  exact and seed0007 is restored; no historical exact session regressed.
- The next public-proxy priority is seed0383 call 2,501, with seed0373 call
  2,595 as the adjacent special-level C/Lua control.  This is not hidden-suite
  evidence.
- Nothing was staged, committed, pushed, or submitted.

### 2026-07-22 seed0383 Big Room 12 diagnosis

- The first mismatch is global call 2,501: C enters `bigrm-12.lua`'s first
  `percent(20)`, while JS falls through to regular level generation.
- Variant choice, alignment shuffle, and special-level lighting are exact.
  The bounded next slice is the Lua map/operation graph over shared stair,
  object, trap, monster, flip, and fixup constructors.
- No hidden suite, push, or submission has run.

### 2026-07-22 seed0383 Big Room 12 RNG closure correction

- The earlier implementation checkpoint was inserted above later same-day
  entries; this appended correction is the current state.  C's class-first
  `S_QUANTMECH` short-circuit makes a genetic engineer consume the missing
  `rn2(20)` even though it cannot receive the quantum-mechanic box.
- Fixture-disabled seed0383 step 42 is now exact for all **7,158 RNG calls**.
  The first remaining mismatch is the screen: JS does not project Big Room
  12's wall cells, while C shows the DEC line-graphics hexagon boundaries.
- The accepted full engine-only corpus remains **36/44** pending closure and
  a later full gate.  No hidden suite, push, or submission has run.

### 2026-07-22 seed0383 scheduler, put-on, and lava frontier

- The fog-cloud `m_everyturn_effect()` belongs before movement-ration
  eligibility, including the first pre-allocation monster scan.  Restoring
  that owner advances seed0383 through input 137 and flat RNG call **9,706**.
- `P` downplays armor only in its compact suggestion list; direct letter `o`
  remains legal and enters the shared armor-on transaction.  That repair
  advances the exact flat prefix to call **9,809** and reaches 103 exact calls
  inside input 138.
- The next `rn2(16)` versus `rn2(32)` is downstream of a deterministic terrain
  error: JS lets the mountain centaur step from room into `LAVAPOOL`, while C
  `mfndpos()` rejects lava for this grounded, non-lava-loving species.  Port
  the shared pool/lava admission predicate, then remeasure the exact session.
- The last accepted corpus remains **36/44**.  No hidden suite, stage, commit,
  push, or submission has run.

### 2026-07-22 seed0383 pool/lava admission checkpoint

- Shared `mfndpos()` now separates pool preference from lava tolerance and
  follows C's airborne/swimmer/eel/lava-lover rules before candidate counting.
  The mountain centaur consequently stays on room terrain and its second
  recent-track probe matches `rn2(16)` without a range override.
- The focused movement gate is **41/41 green**.  Seed0383 is exact through
  step 138 and flat call **9,944**, with **10,423/16,915 RNG, 140/219 screens,
  and 171/219 cursors** in the full fixture-disabled replay.
- Step 139 local call 8 is the new earliest boundary: C requests `rn2(28)`
  while JS requests `rn2(32)`.  The last accepted corpus remains **36/44**;
  no hidden suite, stage, commit, push, or submission has run.

### 2026-07-22 seed0383 exact-entry and gas-cloud frontier

- Source-shaped `wallify_map()` plus ordinary wall topology closes Big Room
  12's entry screen as well as its 7,158-call RNG graph.  No-argument
  non-diggable now marks rock before it becomes the 206 hexagon boundary
  walls.
- Seed0383 is exact through input 134 and global RNG call **9,666**.  At input
  135 C consumes `rn2(3)` in `create_gas_cloud()` before the next movement
  scheduling call; JS omits it.  The aggregate replay is now **9,983/16,915
  RNG, 139/219 screens, 163/219 cursors**.
- The accepted full engine-only corpus remains **36/44** pending closure and
  a later full gate.  No hidden suite, push, or submission has run.

### 2026-07-22 seed0383 expulsion, pet combat, and cold-contact checkpoint

- Fixture-disabled seed0383 now matches C exactly from step 138 through step
  **194**, including every core RNG call, decoded screen cell, and cursor.
  The repaired chain covers swallowed Hallucination display, deferred
  expulsion, runtime-shuffled hallucinated object colors, the fatal safe-pet
  attack transaction, cooldown elemental engulf attacks rewritten as touch,
  and the resumable cold-contact pager/inventory/knockback sequence.
- Tty evidence fixes the ownership boundaries rather than only the final
  transcript: the pet yelp and kill lines combine before the studio-audience
  pager, the next monster actor then attacks, and frost damage resumes its
  cancellation and inventory probes only after the visible contact line.
  Hallucinated liquid names likewise consume display RNG, not core RNG.
- The new earliest seed0383 divergence is step **195**, after the shared
  `You materialize on a different level!` line.  C requests `rn2(100)` at
  local call 3 while JS requests `rn2(2)`, and the complete level-generation
  totals separate to 4,939 versus 2,617 calls.  This is the next C/Lua
  destination-generation boundary; it is not treated as downstream combat
  fallout.
- The last accepted full engine-only corpus remains **36/44**.  No hidden
  suite, stage, commit, push, or submission has run.

### 2026-07-22 seed0383 Oracle teleport checkpoint

- Step **195** is exact in fixture-disabled core RNG, decoded screen, and
  cursor.  Its Oracle construction slice contains **4,939** core calls; the
  cumulative log through the same step contains 16,463.
- Tty level-menu destruction owns a full old-map `docrtRecalc` before
  deferred `goto_level()`.  Under Hallucination its display signature is
  **9 shutdown warnings + 45 map/actor draws + 9 departure warnings**.  The
  destination visibility calculation owns its initial live projection and
  the logical arrival redraw repeats only the monster overlay.
- The Oracle room-form Lua/C graph is closed for this witness: eight historic
  centaur-class statues, nested Delphi/Oracle room, five content rooms,
  corridors, shared fixup, and the Oracle mineralization exception.
- The next public-proxy boundary is step **196** or later.  The accepted full
  engine-only corpus remains **36/44**; no hidden suite, push, or submission
  has run.

### 2026-07-22 seed0383 first Oracle turn checkpoint

- Step **196** is exact at **261/261** core calls, zero decoded-screen
  differences, and the expected cursor.  The ambient monster constructor now
  uses the shared `adj_lev` result before `newmonhp`, and Oracle levels own the
  final independent `dosounds()` `rn2(400)` probe.
- The first local mismatch had been call 251, `d(5,8)` versus `d(7,8)`; after
  its repair, the only missing call was the Oracle sound trigger.  Neither was
  an Oracle Lua-generation error.
- Step 197 is expected to acknowledge a pager without core RNG; step 198 is
  the next likely gameplay boundary.  The accepted full corpus remains
  **36/44** and no hidden suite or submission has run.

### 2026-07-22 seed0383 Hallucinated monster-pickup checkpoint

- Steps **197--198** are exact.  Step 197 owns no core calls; step 198 owns
  **25/25**, the expected cursor, and an exact screen including `Barney the
  dinosaur picks up a sprig of wolfsbane.`
- Hallucinated `Monnam()` retains bogus-name prefix metadata so personal names
  suppress `the`.  The stationary pickup then owns three display projections:
  `mpickstuff`, `dochug(MMOVE_DONE)`, and the input-loop monster overlay.
- The next public-proxy boundary is step **199**.  The accepted full corpus is
  still **36/44**; no hidden suite, push, or submission has run.

### 2026-07-22 seed0383 ranged-selection and display-debt checkpoint

- Step **199** is exact at **29/29** core calls.  C's `select_rwep()` has no
  generic short-sword fallback; removing that JS-only choice eliminates the
  extra `rn2(4)`.
- Steps 199--201 require a deferred **15-draw** Oracle/Hallucination display
  bridge.  Its numerical effect is measured, but its low-level C redraw owner
  remains unresolved.  Treat it as regression coverage, not held-out evidence.
- The next gameplay boundary is step 202.  The accepted full engine-only
  corpus remains **36/44**; no hidden suite or submission has run.

### 2026-07-22 seed0383 apparent-target and wield checkpoint

- Step **202** is exact at **25/25** core calls plus exact screen/cursor.
  `dochug()` refreshes plainly visible `mux/muy` through `set_apparxy()` before
  close-weapon readiness, allowing the soldier to wield without `m_move()`.
- Visible carried-weapon naming now observes the short sword.  Bogus monster
  prefix handling also distinguishes an absent prefix from the personal-name
  codes `-`, `+`, and `=`.
- One presentation draw is still attached as a bounded debt to the next
  hero-movement/monster-scan boundary.  Its exact `vision_recalc/newsym` owner
  is not yet closed.

### 2026-07-22 seed0383 wallwalk and trapped-door checkpoint

- Step **203** is exact at **31/31** core calls, exact decoded screen, and exact
  cursor.  Steps **204--206** are also exact zero-RNG boundaries.
- Shared `mfndpos()` now maps `M1_WALLWALK` to rock/wall admission while
  respecting `W_NONPASSWALL`.  Shared `postmov()` resolves a trapped closed
  door with `rnd(15)`, stun, door removal, vision rebuild, and distance-classed
  explosion prose before the trailing `distfleeck()`.
- Weapon generation retains the existing poison roll as `opoisoned`, and
  visible monster-inventory prose preserves quantity and poison state (`6
  poisoned darts`).  The focused movement gate is **49/49** green.
- Menu displays differ at steps 207--215; the next core mismatch is step
  **216**, local call 4.  The last accepted full engine-only corpus remains
  **36/44**; no hidden suite, push, or submission has run.

### 2026-07-22 seed0383 stunned-recovery checkpoint

- `dochug()` now attempts confusion and stun recovery in C source order before
  fleeing, apparent-position refresh, and the first `distfleeck()`.
- This closes seed0383 step **216** at **26/26** core calls and step **217** at
  **32/32**.  Step 218 owns zero calls, so the engine stream is exact through
  the session end.  The focused movement gate is **50/50** green.
- The remaining seed0383 mismatches are presentation-only: inventory, spell,
  and enlightenment menu content at steps 207--215 plus Hallucinated hero
  glyph selection after modal redraws.  The last accepted full engine-only
  corpus remains **36/44**; no hidden suite, push, or submission has run.

### 2026-07-22 seed0383 final menu and metabolism checkpoint

- The complete fixture-disabled seed0383 tail is now core-RNG-, screen-, and
  cursor-exact through step **218**.  The focused integration witness covers
  steps 138--218; final gameplay slices remain **26/26**, **32/32**, and **0**.
- Hallucinated menu construction consumes one display-only object glyph per
  real inventory item.  Full inventory, discovery, and attribute window
  dismissal returns through a vision-recalculating `docrt`, whereas the corner
  spell window restores only its saved overlay.  This closes the actor-glyph
  sequence without a numeric display bridge.
- Unknown wand charges remain hidden; Wizard spell failure uses role-school
  skill; enlightenment composes live Hallucination, antimagic, teleport
  control, life saving, luck, alignment, hit points, and nutrition state.
- `eat.c:gethungry()` now has one JS owner shared by turn maintenance and
  melee.  A melee roll of 8 while wearing the life-saving amulet supplies the
  formerly missing nutrition point.  As a correction to the older seed0002
  checkpoint, plain Burdened load does not trigger C's `> SLT_ENCUMBER`
  surcharge; its source-shaped focused nutrition result is **650**, not 647.
- The movement gate is **50/50** green.  No post-slice full corpus has run, so
  the accepted engine-only total remains **36/44**; no hidden suite, push, or
  submission has run.

### 2026-07-22 fatal recovery, bones pursuit state, and 37/44 checkpoint

- The post-seed0383 full gate initially regressed to 29/44 because a pending
  monster-contact line was reinstalled through the continuation producer.
  Acknowledging the already-installed line restores seed0007, seed0399, and
  seed5002 without changing their simulation streams.
- A clean Wizard-mode C oracle corrected the initial seed5006 hypothesis: both
  engines restore the bones kitten.  JS instead omitted the level-owned hero
  pursuit ring from its bones payload, so `gettrack()` had no prior-hero trail
  after `set_apparxy()` refreshed the new hero coordinate.
- Bones save/restore now carries `_heroTrack`.  The old-level follower pager
  bridge also keeps the animal projection separate from the nonliving underlay,
  allowing the descent pager to show the follower and the later bones prompt
  to show the restored room floor.
- Exact fixture-disabled witnesses are green for seeds 0007, 0383, 0399, 5002,
  and 5006.  The focused gates are **50/50 movement** and **109/109 scheduler**.
  The required full engine-only corpus is now **37/44 exact** with no prior-pass
  regression.  No hidden suite, stage, commit, push, or submission has run.

### 2026-07-24 seed4500 natural-spit, concealment, and prayer checkpoint

- The cobra's natural blinding-venom transaction now follows the C graph:
  allocate and identify the missile, roll attack admission, defer flight
  behind the visible launch line, then resolve traversal, impact, destruction,
  and the `dochug()` tail.
- Concealment now distinguishes the schedulable `M1_CONCEAL` class from the
  `M1_HIDE` early-return class.  Moving calls
  `place_monster()->maybe_unhide_at()` before `postmov()`, and a visible
  hide-under message resumes before the final destination repaint.
- Successful prayer countdown advances once per global turn, not once per fast
  hero ration, retains pending tty-line ownership, and suppresses ordinary
  regeneration while invulnerable.
- The fixture-disabled seed4500 replay is core-RNG-, screen-, and cursor-exact
  through input **297**.  The new earliest boundary is input **298**, local
  call **119**: C requests `rnd(5)=3`, while JS requests `rn2(3)=2`; the
  transition totals are **3,079** versus **3,456** calls.
- This is a public proxy, not held-out evidence.  The accepted full corpus
  remains **37/44** until the next complete engine-only gate.  Local changes
  are uncommitted and no stage, push, submission, or hidden suite has run.

### 2026-07-24 seed4500 level-10 generation checkpoint

- Input **298** is exact at **3,079/3,079 core calls**, zero decoded-screen
  differences, and the expected cursor.  Input 299 is exact as well.
- The themed-room reservoir selects Lua `Pillars`; its owner chain is a fixed
  10-by-10 room, one failed placement, a seven-entry terrain shuffle, four
  2-by-2 callbacks, and the shared post-theme wallification pass.
- New regular levels clear the source level's explicit special descriptor.
  This prevents a stale Oracle-neutral alignment shift from changing the
  destination's `rndmonst_adj()` reservoir; cached levels still restore their
  own descriptor.
- Health-food stocking uses the 860-weight vegetarian pseudo-class, and shop
  mimics consult that same shop table before common monster inventory.
- The next observed difference is screen-only at input **300**, during the
  following wizard command editor; core RNG and cursor remain exact through
  inspected input 304.  The full engine-only baseline remains **37/44** and
  no hidden suite, stage, commit, push, or submission has run.

### 2026-07-24 seed4500 level-20 niche and beehive checkpoint

- Inputs **299--311** are exact in core RNG, decoded screen, and cursor.  The
  level-20 transition at input **308** is exact at **3,483/3,483** calls.
- Trapdoor niches now preserve `Can_fall_thru -> maketrap ->
  hole_destination`, then create and erode their warning engraving before
  secret-door placement.  Rock-trap substitution is confined to levels which
  genuinely reject falling.
- Regular generation now evaluates the complete depth-driven special-room
  chain.  `pick_room(FALSE)` retains its randomized start, stable room walk,
  stair/door gates, and the Wizard-mode draw before debug acceptance.
- Minions use the deterministic alignment-record attitude gate.  Beehive
  stocking creates the center queen and sleeping ungrouped workers in x-major
  order, with one royal-jelly probe per eligible cell.
- The next boundary is input **312**, level 25, local call **1,315**: C begins
  a seven-hit-die monster constructor while JS chooses a different entity
  path.  This is a public proxy only; the accepted full engine-only corpus
  remains **37/44**, and no hidden suite, stage, commit, push, or submission
  has run.

### 2026-07-24 seed4500 level-25 web and dragon checkpoint

- Input **312** is exact at **2,791/2,791** core calls plus exact decoded
  screen/cursor; inputs **313--315** are exact editor frames.
- `mktrap()` owns a web's giant spider after `maketrap()` installs the trigger
  and before the shallow-victim gate.  Keeping this out of `maketrap()` avoids
  creating spiders for callers which explicitly suppress them.
- Adult dragons use `N * 4 + d(N,4)` outside the endgame and fixed `N * 8`
  inside it, never ordinary `d(N,8)`.
- The next boundary is input **316** call **1**: requested depth 30 should
  route to Gehennom level 1/`valley.lua`, while JS currently creates invalid
  main-dungeon level 30.  The accepted full corpus remains **37/44** and no
  hidden suite, stage, commit, push, or submission has run.

### 2026-07-24 seed4500 Valley and deferred-morgue checkpoint

- Input **316** is exact at **14,387/14,387 core calls** and inputs
  **316--318** have exact decoded screens and cursors, including both Valley
  arrival pagers.  The focused replay now covers every earlier input as well.
- The Valley Lua transaction includes its map conditionals, temple and three
  irregular morgues, fixed branch/teleport regions, shrine priest, corpses,
  objects, traps, monsters, wallification, flip, branch placement, and all
  deferred morgue filling.
- The shared constructor repairs exposed by that fill are source-shaped:
  occupied explicit coordinates reject before RNG; Hell filters the monster
  reservoir; ordinary demons sleep before inventory and fall through the
  bias-sensitive weapon table; Erinys attitude follows alignment abuse; and
  nonliving monsters cannot receive life saving.
- Random grave text now uses the generated padded epitaph corpus and
  `get_rnd_line()` retry policy.  The witnessed first offset 919 lands too
  early in a long line and is rejected; offset 22,110 is accepted.
- Gehennom owns red walls and `goto_level()` owns the three first-entry Valley
  lines.  Neither is encoded into `valley.lua`.
- An independent Priest-location assertion currently expects gas-region
  x-coordinates five columns earlier than the generated map and remains red in
  isolation; it is logged as a control issue, not hidden-readiness evidence.
- The next public-proxy boundary is input **322**, the 3,147-call teleport to
  absolute depth 35.  The accepted full engine-only corpus remains **37/44**;
  no hidden suite, stage, commit, push, or submission has run.

### 2026-07-24 seed4500 first ordinary Gehennom filler checkpoint

- Input **322** is exact at **3,147/3,147 core calls**, decoded screen, and
  cursor.  The focused replay now locks every input through 322; inputs
  **323--325** are also exact zero-RNG command-editor frames.
- `hellfill.lua` variant 3 delegates its maze geometry to the native
  `create_maze()` transaction.  Full-level Lua coordinates use xstart 1 with
  a 79-column range; column 0 remains off limits.
- Shared constructor policy remains outside the script: Gehennom uses
  `hellprobs` for bare random objects; `` ` `` is `ROCK_CLASS`; inherited hot
  temperature weights fire-resistant monsters; minotaurs probe for a digging
  wand; and random Hell traps may be fire traps through either bias path.
- `goto_level()` compares Valley's explicit temperate flag with the new
  filler level's hot flag and owns `It is hot here.  You smell smoke...`.
- Input **326** is the next public-proxy boundary.  It selects Hell filler
  variant 5 and expects **14,047** calls; the first mismatch is local call 4,
  where the missing variant asks `rn2(2)` for wall width.  This is not hidden
  evidence.  The accepted full engine-only corpus remains **37/44**, and no
  hidden suite, stage, commit, push, or submission has run.

### 2026-07-24 seed4500 thick-wall Gehennom and living-statue checkpoint

- Input **326** is exact at **14,047/14,047 core calls**, zero decoded-screen
  differences, and the expected cursor.  The focused fixture-disabled replay
  now locks every input through 326.
- `hellfill.lua` variant 5 owns the two maze widths, outside-stone snapshot,
  generated-wall lava conversion, 3-by-3 center selection, percentage filter,
  and `"Z"` operations.  `nhlua.c` maps `"Z"` to `LAVAWALL`; the shared
  terrain setter owns lava lighting.
- A living-statue trap creates a genuine off-coordinate temporary monster.
  `makemon_rnd_goodpos()` and `goodpos()` own its rejected coordinates;
  `makemon()` owns HP, gender, weapons, and inventory; the trap owner moves
  that inventory into the statue and removes the actor.
- The shared giant constructor now includes its boulder/club, heavy-weapon,
  offensive-item, and weighted gem/glass inventory paths.  Natural
  doppelgangers transform before inventory; the empty scorer RECORD fallback
  is a bounded behavior bridge, not a claim about general NetHack installs.
- `enexto_core()` candidates now pass through species-aware `goodpos()`.
  Generic accessibility had placed one hezrou group member on lava and caused
  the final screen mismatch despite an otherwise exact call stream.
- Input **327** is the next public-proxy boundary and has not yet been used to
  make a diagnosis.  This checkpoint is still not held-out evidence.  The
  accepted full corpus remains **37/44**; no hidden suite, stage, commit,
  push, or submission has run.

### 2026-07-24 seed4500 Ctrl-J rush and Gehennom-exit checkpoint

- Inputs **327--335** are exact in core calls, decoded screens, and cursors;
  the focused fixture-disabled regression locks every input through 331.
- ASCII newline at a live command boundary is `Ctrl-J`, which
  `reset_commands()` binds to rush south for vi directions.  It acknowledges
  an existing topline only when one is pending.
- The attempted south step delegates to `swim_move_danger()`, which owns the
  molten-lava warning, pager, and one-time `m`-prefix tip.  No level-specific
  message bridge was added.
- The subsequent return to level 1 remains exact at **28/28** calls and emits
  the shared hot-to-temperate transition line.
- Input **336** is the next unmeasured public-proxy frame.  This is not hidden
  evidence; the accepted corpus remains **37/44**, and no hidden suite, stage,
  commit, push, or submission has run.

### 2026-07-24 seed4500 plural-wish and object-naming checkpoint

- Inputs **336--473** are exact in core calls, decoded screens, and cursors;
  the focused fixture-disabled replay now locks every input through 473.
- `readobjnam()` treats a leading quantity separately from a plural
  class-qualified name.  `3 scrolls of punishment` looks up
  `scroll of punishment` while retaining quantity three.
- Four Wizard wishes now retain their source-owned weighted lookup, object
  initialization, inventory insertion, discovery, and cooldown transactions:
  punishment, detect food, detect monsters, and identify.
- Visible pluralization changes the class noun, not an unidentified
  description: `scroll labeled KIRJE` becomes
  `scrolls labeled KIRJE`.
- Input **474**, reading the detect-food spellbook, is the next public-proxy
  boundary.  This is not hidden evidence; the accepted corpus remains
  **37/44**, and no hidden suite, stage, commit, push, or submission has run.

### 2026-07-24 seed4500 spellbook-study and failed-casting checkpoint

- Inputs **474--490** are exact in core calls, decoded screens, and cursors;
  the focused fixture-disabled regression now locks every input through 490.
- Wished spellbooks retain generated `objects[]` spell metadata.  Successful
  `study_book()` performs its comprehension roll, installs `learn()` as an
  occupation, and lets the shared monster/global scheduler own every elapsed
  turn.  No RNG calls are padded in the study implementation.
- Detect food consumes its exact 37-call, three-turn transaction.  Detect
  monsters preserves the start-message pager at input 476, completes at input
  477, and yields the exact T:75 spell menu with retention values 19,998 and
  20,000.
- `learn()` exercises Wisdom, installs the spell, records `spestudied`, and
  routes first-time spellbook discovery through `makeknown()`'s second Wisdom
  exercise.  The tty continuation owner appends a short completion or pages a
  long one before replacement.
- Failed casting checks `rnd(100)` before Wisdom exercise, pseudo-object
  construction, or direction input; it spends half the level-based energy and
  delegates the rest of the timed action to the ordinary actor scheduler.
  Inputs 479--489 and the independent engine-only seed0501 Priest casting
  control are exact.
- A full fixture-disabled corpus run measured **32/44**, down from the
  accepted **37/44** baseline.  Five formerly exact sessions are red:
  seed0002, seed0004, seed0006, seed0007, and seed0012.  The spellbook block is
  not inferred to be their cause; per-step earliest-divergence audits are now
  the priority.  The normal fixture-enabled compatibility suite remains
  **44/44**.  No hidden suite, stage, commit, push, or submission has run.

### 2026-07-24 corpse-transaction regression recovery checkpoint

- The five-session regression set opened by the 32/44 run is recovered.
  Seed0002, seed0004, seed0006, seed0007, and seed0012 all pass explicit
  fixture-disabled scoring again.
- Grid-bug kills identified the shared earliest C boundary:
  `xkilled()->corpse_chance()`.  `G_NOCORPSE` suppresses treasure retention
  and final corpse construction, but ordinary small species still consume
  the frequency/size corpse roll.
- Seed4500 input 269 supplied the required counterexample.  A huge earth
  elemental reaches `bigmonst()`'s guaranteed branch and consumes no ordinary
  corpse roll even though it also carries `G_NOCORPSE`.  The focused replay
  is exact again through input 490.
- The JS transaction now distinguishes level-specific death-drop rejection,
  the rare treasure probe, guaranteed versus probabilistic
  `corpse_chance()`, and `make_corpse()` suppression.  This is shared source
  policy, not a bounded session bridge.
- Seed0006's independent screen-only failure came from reading a stale
  `weaponQuantity`; the visible water-demon wield message now reads the
  dagger stack in `minvent`, the same inventory object constructed by
  `m_initweap()`.
- The full fixture-disabled corpus is restored to **37/44**.  The seven
  remaining public failures are seed0014, seed0030, seed0108, seed0360,
  seed0361, seed0373, and seed4500.  Input **491**, the wished
  identify-scroll read, is seed4500's next public-proxy boundary.
- This checkpoint contains no held-out observation.  No hidden suite, stage,
  commit, push, or submission has run.

### 2026-07-24 seed4500 punishment-and-identify checkpoint

- Corrected the next-boundary label: input 491 is the first punishment-scroll
  pager; identify starts at input 494.
- Inputs **491--512** are exact in core calls, decoded screens, and cursors.
  The focused fixture-disabled replay now locks the entire prefix through 512.
- `doread()` and `seffects()` leave the disappearance topline active.
  `punish()`'s prose forces its pager before chain/ball construction; the
  second punishment forces another pager before increasing ball weight.
- Punishment constructs genuine chain- and ball-class objects, assigns their
  worn masks and authoritative hero references, and places them through the
  shared floor-object owner.
- Identify consumes its scroll before counting inventory, learns its own type,
  performs `rn2(5)=0` and `rn2(5)=3`, fully identifies the three remaining
  wished objects, and lets each `prinv()` line enter the tty continuation
  graph.  No output or RNG calls were padded.
- Input **513** is the next public-proxy boundary.  RNG and cursor are exact;
  only ball/chain map cells differ because hero movement does not yet delegate
  to `ball.c:drag_ball()`/`move_bc()`.
- This checkpoint contains no held-out observation.  The last full
  fixture-disabled corpus remains **37/44**; no hidden suite, stage, commit,
  push, or submission has run.

### 2026-07-24 seed4500 ball-and-chain movement checkpoint

- Inputs **513--520**, and therefore the complete prefix through input 520,
  are exact in core calls, decoded screens, and cursors.
- The first mismatch was genuine object state: `uball` and `uchain` retained
  their punishment-square coordinates.  A dedicated `js/ball.js` now owns
  `drag_ball()` geometry and the two `move_bc()` phases around hero movement.
- Floor movement extracts and re-places the same identities through the
  shared `remove_object()`/`place_object()` owner.  Chain-only, both-object,
  no-movement, backtracking, and top-of-pile cases are exercised by the
  public witness.
- Dragging both installs the source two-turn delay.  Its turn-90 maintenance
  exposed the shared `regen_pw()` boundary: the Knight consumes
  `rn2(2)=1` and recovers two power points before the next real input.
- `check_here()` ignores the attached chain.  The heavy ball remains visible
  and formats as `a very heavy iron ball (chained to you)`.
- The full fixture-disabled corpus remains **37/44** with every previously
  exact session preserved.  Seed4500 measures **50,156/108,275 RNG and
  522/1,814 screens**; the focused exact prefix is the readiness evidence.
- Input **521**, the second discoveries page, is the next public-proxy
  boundary.  This checkpoint contains no held-out observation, and no normal
  fixture-on suite, stage, commit, push, or submission has run.

### 2026-07-24 seed4500 discoveries-window checkpoint

- Inputs **521--524**, and therefore the complete prefix through input 524,
  are exact in core calls, decoded screens, and cursors.
- `dodiscovered()` now sends its continuous title/class/item stream to the tty
  as 23-row content pages rather than truncating after the first 21 entries.
- Knight `knows_class()` preknowledge is reconstructed from the generated
  object magic/class metadata.  The starting-inventory pass runs later and
  appends the encountered small shield without treating it as preknown.
- The natural-spit path now retains `m_throw()`'s visible-flight
  `observe_object()` effect, so the destroyed venom still appears in the
  discoveries list.
- The first generalized starting-inventory pass exposed and corrected a
  seed0002 regression: C's `oc_uses_known`, not JS's broad reconstructed
  `known` field, owns whether an item type enters `disco[]`.
- The focused scheduler suite is **111/111**.  The last full fixture-disabled
  corpus remains **37/44**; it was not rerun for this zero-RNG presentation
  block.
- Input **525**, the rotten-apple transaction, is the next public-proxy
  boundary.  This checkpoint contains no held-out observation, and no normal
  fixture-on suite, stage, commit, push, or submission has run.

### 2026-07-24 seed4500 rotten-food and unconscious-turn checkpoint

- Inputs **525--528**, and therefore the complete seed4500 prefix through
  input 528, are exact in core calls, decoded screens, and cursors.
- `mksobj()` now gives every object its source creation age.
  `eat.c:touchfood()` is represented as an identity-preserving carried-stack
  split: the untouched apples remain `g`, the selected apple receives the
  next object id and inventory letter `m`, and its persistent `oeaten` is
  initialized before spoilage.
- `doeat()` now applies the ordinary-food age/blessing/nonrotting gate in
  source order.  The witness consumes `rnd(2)`, `rn2(7)`, the ordered
  `rottenfood()` tree, and `rnd(10)`, leaves a rotten half-apple with
  `oeaten=25`, and installs three unconscious turns.
- The global hunger owner now performs `Unaware`'s separate `rn2(10)` before
  `rn2(20)` on every unconscious turn.  Restoring those three calls aligns
  the complete actor/maintenance trace and lets HP regenerate from 31 to 33
  by turn 97.
- `Hear_again()` now runs after the tty acknowledgement which separates the
  rotten-food pager from `You are conscious again.`; input 526 owns the exact
  `rn2(2)=1`.
- A following carrot confirms this is shared food architecture, not an
  apple-only bridge: it splits with a second `next_ident()`, fails the same
  stale-food `rn2(7)` gate, is consumed, and preserves the banked Fast action
  at turn 97.
- The focused scheduler suite is **111/111**.  The repository-wide unit run
  has three still-open failures outside this food/recovery call graph
  (cached Pri-loca gas-region state, Priest discoveries presentation, and a
  depth-two water-transition assertion); it is not recorded as green.
- The last full fixture-disabled corpus remains **37/44**.  This checkpoint
  contains no held-out observation, and no normal fixture-on suite, stage,
  commit, push, or submission has run.

### 2026-07-24 seed4500 wizard debug-command checkpoint

- Inputs **529--606**, and therefore the complete seed4500 prefix through
  input 606, are exact in core calls, decoded screens, and cursors.
- `#wizidentify` now delegates to a state-derived permanent-identification
  inventory view.  The witnessed all-identified branch still opens the exact
  `Debug Identify` tty window instead of silently returning or reporting an
  unknown command.
- The shared multi-select window now represents separator rows, page-local
  `.` selection, provisional cross-page selection, Escape cancellation, and
  Return commit.  `#wizintrinsic` uses those owners with the source's
  conditional command-assistance line and property ordering.
- The committed witness installs 30-turn Invulnerable and Very Fast
  properties and reports both behind the same pager.  These counters decay
  in the global-turn owner.
- Timed `Invulnerable` is intentionally distinct from prayer's
  `u.uinvulnerable`: conflating them suppressed `regen_hp()` and caused the
  first post-command RNG divergence.  The run now preserves the expected
  regeneration trace and reaches input 606 at turn 112 and HP 36 with both
  timed properties at 15.
- The focused scheduler suite is **111/111** and `git diff --check` passes.
  The last full fixture-disabled corpus remains **37/44**; neither it nor the
  known non-green repository-wide unit run was rerun for this checkpoint.
- Input **607**, the `#overview` editor-completion boundary, is next.  This
  checkpoint contains no held-out observation, and no normal fixture-on
  suite, stage, commit, push, or submission has run.

### 2026-07-24 seed4500 first dungeon-overview checkpoint

- Inputs **607--616**, and therefore the complete seed4500 prefix through
  input 616, are exact in core calls, decoded screens, and cursors.
- `overview` now participates in the extended-command AUTOCOMPLETE table and
  dispatches to a dungeon-history projection.  Delete remains a distinct
  known-terrain/getpos command.
- The first overview derives visited branch ranges from the current and
  cached level identities: Dungeons of Doom 1--25 and Gehennom 27--40.  It
  retains the current and deepest visited rows instead of listing every
  generated intermediate map.
- The shared text overlay accepts attributed rows, giving the two dungeon
  headings the exact inverse tty attribute while preserving the live map
  below its six-row right-side rectangle.
- The focused scheduler suite is **111/111** and `git diff --check` passes.
  The last full fixture-disabled corpus remains **37/44**; it was not rerun.
- Input **617**, `#dip` completion, is next.  Feature summaries, annotations,
  and later special-level overview rows remain unclaimed.  This checkpoint
  contains no held-out observation, and no normal fixture-on suite, stage,
  commit, push, or submission has run.

### 2026-07-24 seed4500 cancelled-dip checkpoint

- Inputs **617--629**, and therefore the complete seed4500 prefix through
  input 629, are exact in core calls, decoded screens, and cursors.
- `dip` now completes from its unique first letter and dispatches to the
  ordinary inventory-selector boundary.
- The prompt derives the compact `a-km` range from live inventory.  Escape
  commits no item, time, or RNG and leaves the selector visible until the
  following command takes over the topline.
- Concrete potion, sink, and fountain effects remain outside this
  prompt-only witness.
- The focused scheduler suite is **111/111** and `git diff --check` passes.
  The last full fixture-disabled corpus remains **37/44**; it was not rerun.
- Input **630**, the wizard `#enhance` confirmation, is next.  This checkpoint
  contains no held-out observation, and no normal fixture-on suite, stage,
  commit, push, or submission has run.

### 2026-07-24 seed4500 wizard-skill checkpoint

- Inputs **630--639**, and therefore the complete seed4500 prefix through
  input 639, are exact in core calls, decoded screens, and cursors.
- Wizard `#enhance` now owns its no-practice confirmation and repeatedly
  rebuilds a two-page live skill menu after each speedy advancement.
- A dedicated skill state reconstructs Knight maxima and startup ranks.
  Startup inventory is not inferred from later wishes: only the starting long
  sword is Basic, and the pony grants Basic riding.
- Five qualifying long-sword hits are recorded through the shared melee
  training boundary.  The first menu therefore shows practice 25; advancing
  preserves that value while changing the next threshold from 80 to 180.
- Selecting polearms changes Unskilled/0/20 to Basic/0/80.  Each choice has
  its own map-backed pager, and Return cancels the rebuilt PICK_ONE menu.
- The focused scheduler suite is **111/111** and `git diff --check` passes.
  The last full fixture-disabled corpus remains **37/44**; it was not rerun.
- Input **640**, `#turn` completion, is next.  Other role tables and
  non-melee practice sources remain unclaimed.  This checkpoint contains no
  held-out observation, and no normal fixture-on suite, stage, commit, push,
  or submission has run.

### 2026-07-24 seed4500 Knight-turn checkpoint

- Inputs **640--649**, and therefore the complete seed4500 prefix through
  input 649, are exact in core calls, decoded screens, and cursors.
- Extended-command completion leaves `t` ambiguous and expands the unique
  `tu` prefix to `turn`.
- The lawful Knight path increments gnostic conduct, resolves Lugh from live
  alignment, exercises Wisdom, and installs the level-derived three-turn
  negative-multi interval.
- The 25-call next-input slice is one Wisdom exercise followed by three live
  global scheduler allocations.  Those allocations advance T:112 to T:115
  and regenerate HP 36 to 37 before the recovery message.
- No undead is in range in this witness.  Resistance, flee, conversion, and
  kill/corpse branches remain explicitly unclaimed.
- The focused scheduler suite is **111/111** and `git diff --check` passes.
  The last full fixture-disabled corpus remains **37/44**; it was not rerun.
- Input **650**, `#chat` to self, is next.  This checkpoint contains no
  held-out observation, and no normal fixture-on suite, stage, commit, push,
  or submission has run.

### 2026-07-24 seed4500 self-chat checkpoint

- Inputs **650--661**, and therefore the complete seed4500 prefix through
  input 661, are exact in core calls, decoded screens, and cursors.
- `#chat` treats `.` as a valid rest-direction vector, emits the source
  self-chat message, and consumes no turn or RNG.
- The following self-inspection, `#ride` completion, and direction
  cancellation remain exact.
- The focused exact-prefix comparator and `git diff --check` pass.  The last
  complete focused scheduler suite is **111/111**, and the last full
  fixture-disabled corpus remains **37/44**.
- Input **662**, `#wipe` completion, is next.  This checkpoint contains no
  held-out observation, and no normal fixture-on suite, stage, commit, push,
  or submission has run.

### 2026-07-24 seed4500 clean-wipe checkpoint

- Inputs **662--665**, and therefore the complete seed4500 prefix through
  input 665, are exact in core calls, decoded screens, and cursors.
- Wizard-mode completion waits for unique `wip`; the `wi` prefix still
  overlaps the `wiz...` command family.
- `dowipe()`'s already-clean exit is timed even though the Knight's retained
  very-fast movement ration avoids a new global turn, RNG, or T increment.
- The creamed-face occupation remains unclaimed.
- The focused exact-prefix comparator and `git diff --check` pass.  The last
  complete focused suite is **111/111** and the last full fixture-disabled
  corpus remains **37/44**.
- Input **666**, ambiguous `s` versus `sit`/wizard `stats`, is next.  No
  hidden suite, normal corpus, stage, commit, push, or submission has run.

### 2026-07-24 seed4500 sit/monster checkpoint

- Inputs **666--684**, and therefore the complete seed4500 prefix through
  input 684, are exact in core calls, decoded screens, and cursors.
- Wizard `stats` keeps `s` ambiguous; `si` uniquely completes `sit`.
- Empty-floor sitting owns the seven-call global allocation, advances T:115
  to T:116, and ages both surviving property timeouts from 12 to 11.
- `mo` uniquely completes `monster`; the normal-form refusal is zero-time and
  form-specific abilities remain unclaimed.
- The expanded focused test initially found a stale T:115 assertion; after
  correcting it to the source T:116, the scheduler suite is **111/111** and
  `git diff --check` passes.  The full fixture-disabled corpus remains
  **37/44** and was not rerun.
- Input **685**, `#name` level-annotation selection, is next.  No hidden
  suite, normal corpus, stage, commit, push, or submission has run.

### 2026-07-24 seed4500 annotation/object-name checkpoint

- Inputs **685--724**, and therefore the complete seed4500 prefix through
  input 724, are exact in core calls, decoded screens, and cursors.
- `#name` now routes level annotations to the current `dnum:dlevel` map
  identity and routes inventory naming to the selected object's persistent
  `oextra.oname`.
- The shared inventory projector emits
  `a +1 long sword named Sword of Justice (weapon in right hand)` without
  replacing the wielded object or changing its inventory letter.
- Both nested line editors are zero-time and zero-RNG.  The object selector's
  trailing tty space is visually blank but required for its exact cursor.
- The expanded focused test first caught that one-column cursor error; after
  correction the scheduler suite is **111/111** and `git diff --check`
  passes.  The full fixture-disabled corpus remains **37/44** and was not
  rerun.
- Input **728**, `ad -> adjust` completion, is next.  Other naming branches
  remain unclaimed.  No hidden suite, normal corpus, stage, commit, push, or
  submission has run.

### 2026-07-24 seed4500 inventory-adjust checkpoint

- Inputs **725--735**, and therefore the complete seed4500 prefix through
  input 735, are exact in core calls, decoded screens, and cursors.
- `a` remains ambiguous with `annotate`; `ad` uniquely completes `adjust`.
- The simple move changes the existing named sword's letter from `a` to `z`,
  reorders inventory, and preserves `game.uwep`, `oextra.oname`, and the
  shared wielded description.
- The following lance throw and complete `#twoweapon` editor stay exact
  through input 748.  Split/collect/merge/swap/gold and retry/menu organizer
  paths remain unclaimed.
- The focused exact-prefix regression and `git diff --check` pass.  The last
  complete focused suite is **111/111** and the full fixture-disabled corpus
  remains **37/44**.
- Input **749**, the shield gate for two-weapon combat, is next.  No hidden
  suite, normal corpus, stage, commit, push, or submission has run.

### 2026-07-24 seed4500 shielded-twoweapon checkpoint

- The complete seed4500 prefix through input **749** is exact in core calls,
  decoded screens, and cursors.
- `dotwoweapon()` now consults live shield equipment before changing state or
  drawing for clumsy-toggle time, producing the source zero-time refusal.
- The expanded post-state correctly includes the intervening lance-throw
  turn: T:117, HP 38, and both timed properties at 10.  The focused
  exact-prefix regression and `git diff --check` pass.
- Input **751** is next: shield removal is semantically and RNG-aligned, but
  JS incorrectly emits verbose removal feedback while the source's disabled
  `verbose` option retains the selector prompt.
- Other two-weapon validation failures remain unclaimed.  The last complete
  focused suite is **111/111** and the full fixture-disabled corpus remains
  **37/44**.  No hidden suite, normal corpus, stage, commit, push, or
  submission has run.

### 2026-07-24 seed4500 silent-shield-removal checkpoint

- Inputs **750--752**, and therefore the complete seed4500 prefix through
  input 752, are exact in core calls, decoded screens, and cursors.
- The zero-delay small shield is removed immediately and the timed command
  advances T:117 to T:118, but disabled `verbose` suppresses `off_msg()` and
  leaves the armor selector on the tty topline.
- The shield object remains carried while `worn` and `uarms` are cleared.
- Input **753** exposes two older debts: the north-wall punishment-scroll
  throw did not remove/place its object in JS, and inventory naming ignores
  the partly eaten apple's `oeaten=25`.
- `git diff --check` passes.  The last complete focused suite is **111/111**
  and the full fixture-disabled corpus remains **37/44**.  No hidden suite,
  normal corpus, stage, commit, push, or submission has run.

### 2026-07-24 seed4500 wall-thrown-scroll/partial-food checkpoint

- The complete seed4500 prefix through input **765** is exact in core calls,
  decoded screens, and cursors.
- Direct letter `i` at the throw selector chooses the downplayed punishment
  scroll.  The north wall leaves it on the floor at `(38,10)` after removing
  it from inventory; the hero glyph hides the landing.
- Shared object naming now derives `partly eaten` from
  `0 < oeaten < oc_nutrition`, giving the live slot-`m` apple its exact
  description.
- The corrected inventory closes on row 15, then shield-free `#twoweapon`
  succeeds with `rnd(20)=5` and no global turn.
- Input **766**, raw weapon swap `x`, is next.  The focused exact-prefix
  comparator and `git diff --check` pass; the durable regression will be
  extended with that weapon-state slice.  The last complete focused suite is
  **111/111** and the full fixture-disabled corpus remains **37/44**.  No
  hidden suite, normal corpus, stage, commit, push, or submission has run.

### 2026-07-24 seed4500 weapon-swap checkpoint

- Inputs **766--769**, and therefore the complete seed4500 prefix through
  input 769, are exact in core calls, decoded screens, and cursors.
- Raw `x` swaps the same primary/secondary object identities.  Vacating the
  secondary slot first ends two-weapon mode, so the resulting suffixes are
  ordinary right-hand and alternate-weapon descriptions.
- Each swap produces two `prinv()` lines with the first behind `--More--`.
  The first timed swap uses retained movement; the second advances T:118 to
  T:119.
- The durable focused regression now covers through input 769 and passes;
  `git diff --check` passes.  The last complete focused suite is **111/111**
  and the full fixture-disabled corpus remains **37/44**.
- Inputs **770--771** type wizard level 3 exactly.  Input **772**, the
  generated-level/punishment-arrival/ball-chain pager transaction, is next.
  No hidden suite, normal corpus, stage, commit, push, or submission has run.

### 2026-07-24 seed4500 punished-level-transition checkpoint

- Input **772** now matches all **2,248/2,248** source core calls, the
  destination screen, the chain/ball floor pager, and its cursor; input 773
  dismisses that pager into the exact level-3 map with zero RNG.
- Fort Ludios now begins with the C `n_dgns` floating-source sentinel.  The
  earlier level-20 vault resolves it, so the level-3 vault skips the Knox
  deferral draw and preserves the `makevtele()` then `mkshop()` call order.
- `gotoLevel()` removes the same ball and chain identities from cached level
  1, places ball then chain at `(36,8)`, and reaches the arrival pile after
  redraw and messages.  The old thrown punishment scroll remains on cached
  level 1.
- Tty floor-pile windows now right-align using their widest line plus one
  trailing blank column, producing the punished pile's column-40 origin.
- The complete seed4500 prefix is exact through input **777**.  The durable
  engine-only regression covers through input 773; the focused scheduler
  suite passes **111/111** and `git diff --check` passes.  The full
  fixture-disabled corpus remains **37/44** and was not rerun.
- Input **778** is next: the `# wizm` editor should temporarily project
  `# wizmondiff`, followed by the unimplemented `#wizmap` command.  Carried
  ball, fall, swallowed, rust, and mixed arrival-pile branches remain
  unclaimed.  No hidden suite, normal corpus, stage, commit, push, or
  submission has run.

### 2026-07-24 seed4500 wizard-map/punished-travel checkpoint

- `#wizmap`, punished diagonal travel, and two controlled same-level
  teleports are exact through input **795**.
- The travel stop is owned by `drag_ball()` setting `cause_delay`, followed
  by `nomul(-2)` ending the active travel run; it is not a pathfinding bridge.
- Controlled teleport now moves the live ball/chain identities with the
  hero, respects verbose materialization gating, accepts stair feature keys,
  and composes getpos-retained stair text with the attached-object pager.
- The added engine-only prefix regression passes, as does the full scheduler
  suite (**112/112**) and `git diff --check`.
- Input **796** is next: level-4 generation diverges after 115 shared calls at
  a missing `themerms.lua:contents` `rn2(4)` branch.  The full fixture-disabled
  corpus remains **37/44** and was not rerun.  No hidden suite, normal corpus,
  stage, commit, push, or submission has run.

### 2026-07-24 seed4500 nesting-room/punished-descent checkpoint

- Inputs **796--798** are exact in core calls, decoded screens, and cursors;
  the full engine-only seed4500 replay stays exact through input **812**.
- Lua's selected Nesting rooms operation now creates its nested
  outer/subroom/core graph, preserves random-door call order, fills subrooms
  before parents, and excludes subroom bounds from ordinary coordinate
  selection.
- Ordinary punished descent migrates the live ball/chain identities, defers
  `drag_down()` and fall damage across the stair pager, clears the main
  window for the impact pager, and overlays the destination feature/pile
  with tty's reserved leading column.
- The durable regression covers inputs 774--798.  The full
  fixture-disabled corpus remains **37/44** and was not rerun.
- Input **813** is next: C owns 2,620 special-level construction calls
  starting in Lua shuffle, `splev_initlev`, and `mkmap:init_fill`; JS owns
  only seven `rnd(10)` calls.  No hidden suite, normal corpus, stage, commit,
  push, or submission has run.

### 2026-07-24 seed4500 Gnomish-Mines filler checkpoint

- Input **813** matches all **2,620/2,620** C/Lua calls, screen, and cursor
  after routing through the live branch stair and constructing the generic
  `minefill.lua` cellular cave.
- The port owns unique initial samples, smoothing, irregular-component
  joining, wallification, scripted population, branch fixup, and ordinary
  mineralization; this is live engine behavior, not a fixture bridge.
- Shared constructor corrections include the successful final offensive-item
  reservoir for an armed gnome leader and the explicit-male semantics of the
  legacy `"gnome lord"` alias.
- Inputs **814--828** are exact.  Both ends of the branch connection become
  traversed, the arrival feature lowercases `the Dungeons of Doom`, and
  temporary very-fast expiry preserves the Knight's base-speed wording.
- The durable engine-only regression covers inputs 774--828 and passes;
  `git diff --check` passes.  The full fixture-disabled corpus remains
  **37/44** and was not rerun.
- Input **829** is next.  Its second Mines field has the correct total
  **2,615** calls, screen, and cursor, but first diverges at call 2,253:
  C retries a random-trap coordinate where JS accepts the square and rejects
  two trap types.  No hidden suite, normal corpus, stage, commit, push, or
  submission has run.

### 2026-07-24 seed4500 Mines-scheduler/prayer checkpoint

- The complete seed4500 prefix through input **863** is exact in core calls,
  decoded screens, and cursors.
- The second Mines filler rejects boulder squares under the Lua `DRY`
  location contract; punished low-HP movement reaches the source wail gate.
- The input-842 actor scan now preserves launcher readiness as its own action,
  advances identity when splitting the next-turn rock missile, resolves the
  hero-target flight/miss/drop path, and admits a pick-carrying peaceful
  dwarf's diggable neighbors through `ALLOW_DIG`.
- The pending `It misses.` topline composes with angry prayer completion.
  Wizard-forced prayer restores Luck/timeout state and `pleased()` heals
  critically low HP from **9(80)** to **83(83)** with the exact `rnd(5)`.
- Input **864** is next.  C and JS share `getbones`, `makemaz`, and Lua
  shuffle, then choose different level-8 generation owners: C enters
  `build_room()` and finishes at 1,813 calls while JS reaches 3,038.
- Focused tests and `git diff --check` are pending for this implementation
  slice.  The full fixture-disabled corpus remains **37/44** and was not
  rerun.  No hidden suite, normal corpus, stage, commit, push, or submission
  has run.

### 2026-07-24 seed4500 Minetown-4 constructor checkpoint

- Input **864** now matches all **1,813/1,813** calls, decoded screen, and
  cursor through the live `minetn-4.lua` ("College Town") room-form
  constructor.
- The implementation owns the nested room/shop/temple graph, external rooms,
  corridors, flip, watch and town population, special-room filling, and
  arrival pile through reusable engine operations.
- Book-shop tribute stocking is global and precedes ordinary item/mimic
  selection; novel construction immediately owns its persistent title-index
  draw.
- The engine-only prefix is exact through input **881**.  Input **882** is the
  next constructor boundary: depth 13 selects `minend`, `rnd(3)=2`, and C
  enters `minend-2.lua`, while JS falls through to `minefill.lua`.
- Focused tests and `git diff --check` remain pending for the larger slice.
  The full fixture-disabled corpus remains **37/44** and was not rerun.  No
  hidden suite, normal corpus, stage, commit, push, or submission has run.

### 2026-07-24 seed4500 Mines-End/mapseen/ascent checkpoint

- Input **882** is exact at **1,567/1,567** calls, screen, and cursor through
  the live `minend-2.lua` constructor, non-town Mines mineralization, flipped
  absolute arrival region, and punished arrival pile.
- `#overview` now projects mapped features, parent-side branch knowledge,
  user annotations, and wizard special-level prototypes in source order.
- Level changes run the `unplacebc()` old-square redraw before caching, and a
  revisited annotated level delivers its reminder before attached-object
  pickup.
- First-visit ordinary ascent now shares the construction/migration boundary:
  input **929** matches **6,911/6,911** calls, the old-map great-effort pager,
  destination-downstairs pile description, and next-level actor scan.
- The engine-only prefix is exact through input **945**.  Input **946** next
  selects `medusa-3.lua`; JS has no variant-3 constructor.
- Focused tests and `git diff --check` remain pending for the larger slice.
  The full fixture-disabled corpus remains **37/44** and was not rerun.  No
  hidden suite, normal corpus, stage, commit, push, or submission has run.

### 2026-07-28 seed4500 Medusa no-move contact/memory checkpoint

- The complete seed4500 prefix through input **1000** is exact in core calls,
  decoded screens, and cursors; input 1000 matches **328/328** calls.
- An adjacent wanderer that returns `MMOVE_NOTHING` from `m_move()` now
  reaches phase-four natural contact.  `MMOVE_MOVED` remains the immediate
  adjacent-return case.
- Blind hit/miss contact stores persistent `I` hero memory.  Monster death
  clears that marker back to known trap, engraving, or terrain without
  exposing a floor object.
- Fire erosion dirties worn AC immediately but `find_ac()` runs only after
  the full player-input transaction, preserving AC 4 on inputs 998--999 and
  producing AC 5 on input 1000.
- The next earliest divergence is beyond input **1000** and remains to be
  measured.  Temporary probes and the larger focused regression extension
  are still pending.  The full fixture-disabled corpus remains **37/44** and
  was not rerun.  No hidden suite, normal corpus, stage, commit, push, or
  submission has run.

### 2026-07-28 seed4500 complete focused-session checkpoint

- The complete 1,814-step session is exact at **108,275/108,275** core calls,
  **1,814/1,814** decoded screens, and **1,814/1,814** cursors.
- A whole-session comparison from step zero independently confirms that
  there is no later or earlier mismatch hidden by the accumulated prefix.
- This remains focused public-session evidence.  Cleanup, durable regression
  extension, the full fixture-disabled 44-session gate, and the normal suite
  remain required before updating the accepted corpus checkpoint.
- No hidden suite, stage, commit, push, or submission has run.

### 2026-07-28 seed0002 ordinary-descent regression checkpoint

- The first post-seed4500 scheduler regression was seed0002 input **318**,
  not a later `MMOVE_*` contact failure.
- C finishes destination construction, then owns ordinary fall damage
  `rnd(3)=2` before `losedogs()` starts follower arrival.  JS had omitted
  that draw until after the old-map fall pager.
- `ordinaryDescend()` now takes the damage roll before follower placement
  while retaining the HP mutation across the pager boundary, matching C's
  state order and tty projection separately.
- Inputs **318--319** are exact in complete RNG slices, decoded screens, and
  cursors.  The complete scheduler regression remains the next gate.
- The full fixture-disabled corpus remains **37/44** and was not rerun.  No
  hidden suite, normal suite, stage, commit, push, or submission has run.

### 2026-07-28 post-seed4500 focused regression gate

- `test/run_scheduler.test.js` passes **112/112** after the seed0002 descent
  ordering correction.
- The isolated `test/seed4500_full_session.test.js` passes its complete
  1,814-step RNG/screen/cursor comparison.
- Temporary parity probes are removed and `git diff --check` passes.
- The fixture-disabled 44-session corpus is the next acceptance gate; the
  accepted checkpoint remains **37/44** until it runs.
- No hidden suite, normal suite, stage, commit, push, or submission has run.

### 2026-07-28 tutorial/extcmd/waterbody regression recovery

- Seed0009 is engine-only exact at **3,713/3,713** calls and **73/73**
  screens/cursors after tutorial entry uses `LR_UPTELE`.
- Seed0107 is engine-only exact at **2,902/2,902** and **98/98** after
  normal-mode `#s` uniquely completes `#sit`; debug mode still requires the
  longer prefix.
- Medusa `MOAT` movement warnings now use `shallow sea`; seed4500 is exact
  through input **1002** and next differs at input **1003**.
- Four formerly exact sessions remain red: seed0367, seed0383, seed0399, and
  seed0501.  The full corpus has not been rerun after this recovery.
- No hidden suite, normal suite, stage, commit, push, or submission has run.

### 2026-07-28 fixture-disabled corpus correction

- The complete engine-only gate measured **31/44**, reopening seed0009,
  seed0107, seed0367, seed0383, seed0399, and seed0501 from the accepted
  37-session exact set.
- The earlier standalone seed4500 full-session result was fixture-enabled.
  Engine-only seed4500 is exact through input **1000** and first differs at
  input **1001** in screen only.
- The six regression first-inputs are 14, 82, 243, 138, 113, and 20
  respectively; three are initially screen-only and three are RNG/transaction
  divergences.
- Recover the exact-session set before extending the remaining Knight suffix.
- No hidden suite, normal suite, stage, commit, push, or submission has run.

### 2026-07-28 starting-discovery identity recovery

- Seed0501's missing discovery entries came from treating `oc_uses_known` as
  an inclusion filter.  C's constructor and `ini_inv_adjust_obj()` cover
  complementary cases, so every described starting object reaches
  `ini_inv_use_obj()` with `known=1`.
- The earlier Healer counterexample was a concrete identity defect:
  `SPE_STONE_TO_FLESH` was 402, the cancellation spellbook, while the source
  object table places stone to flesh at **405**.  Hand-authored inventory
  presentation had hidden the wrong type.
- `finishStartingDiscoveries()` now uses starting provenance plus a concrete
  description, and the corrected constant creates type 405.
- Fixture-disabled seed0501 is exact at **2,238/2,238** calls and **28/28**
  screens; seed0002 remains exact at **27,158/27,158** and **595/595**.
  `test/run_scheduler.test.js` passes **112/112**.
- Seed0367 input **243** is the next exact-session recovery blocker.  The
  full fixture-disabled corpus has not been rerun after this focused fix.
  No hidden suite, normal suite, stage, commit, push, or submission has run.

### 2026-07-28 move-scoped random-monster alignment recovery

- Seed0367 input 243 switched from Big Room 3 to Medusa-1 without advancing
  `moves`.  C's `align_shift()` caches the first special-level descriptor
  until the move changes; JavaScript had read Medusa's chaotic alignment
  immediately.
- The diagnostic signature was the first reservoir total: C `rn2(3)` from
  Big Room's no-alignment weights versus JS `rn2(5)` after adding Medusa's
  chaotic shift.  Depth, hero level, temperature, and the six-call
  constructor prefix already agreed.
- `rndmonstAlignment()` now gives random-monster generation the same
  move-scoped cache lifetime across zero-time wizard level changes.
- Fixture-disabled seed0367 is exact at **50,125/50,125** calls and
  **324/324** screens.  The clean Medusa-1 focused regression passes.
- Seed0383 input **138** is the next exact-session blocker.  The full
  fixture-disabled corpus has not been rerun.  No hidden suite, normal suite,
  stage, commit, push, or submission has run.

### 2026-07-28 phase-four range and default-option recovery

- Seed0383 input 138's missing kitten `passivemm()` was downstream of three
  distant armed actors.  JavaScript readied their launchers after movement
  even though C's second `distfleeck()` marked them outside
  `BOLT_LIM * BOLT_LIM` and therefore never entered `mattacku()`.
- `maybeThrowRangedWeapon()` now passes through the common distant phase-four
  eligibility gate before launcher readiness.  In-range `thrwmu()` retains
  its wield-before-missile/line order; out-of-range actors cannot mutate
  weapon state or consume tty.
- The last two screen differences were the wizard-intrinsic help row:
  `cmdassist` is source-default-on, so only an explicit false value suppresses
  the count-prefix instruction.
- Fixture-disabled seed0383 is exact at **16,915/16,915** calls and
  **219/219** screens/cursors.  Its focused integration witness passes; the
  monster-movement plus scheduler gates pass **166/166** and
  `git diff --check` passes.
- Seed0399 input **113** is the remaining reopened exact-session blocker.  The
  full fixture-disabled corpus has not been rerun, so 31/44 is still the
  latest complete measurement and 37/44 the last accepted checkpoint.  No
  hidden suite, normal suite, stage, commit, push, or submission has run.

### 2026-07-28 cross-session phase-four confirmation

- The same range-before-readiness rule makes fixture-disabled seed0399 exact
  at **11,409/11,409** calls and **532/532** screens/cursors.
- At the former input-113 boundary, an elf-bow carrier is at distance squared
  109 and a centaur-crossbow carrier at 73.  Both exceed the source limit of
  64 and retain no `mw`; the existing amulet pager and all 99 calls stay in
  the expected input.
- This is an independent public witness for architecture section 385, not a
  session bridge.  Every session reopened by the latest 31/44 corpus has now
  passed a focused fixture-disabled replay.
- The complete engine-only 44-session gate is next.  No hidden suite, normal
  suite, stage, commit, push, or submission has run.

### 2026-07-28 36/44 engine-only corpus checkpoint

- The complete fixture-disabled corpus is **36/44 exact** at
  **27+0.31 ms/turn** (R² 0.751).  All six sessions reopened by the 31/44
  audit remain exact in the broad process.
- Seed1150 is newly red on exactly one decoded screen while retaining
  **3,137/3,137** calls and **51/51** cursors.  This prevents promotion back
  to the accepted 37/44 checkpoint.
- Seed4500 is exact through input 1002; its later positional aggregates are
  not prefix evidence.
- Recover seed1150's screen owner and rerun all 44 engine-only sessions before
  extending another frontier or running the normal suite.  No hidden suite,
  stage, commit, push, or submission has run.

### 2026-07-28 seed1150 typed-flint discovery recovery

- Input 43's extra discovery line came from two owners: a legacy
  Caveman-specific `flint stone` row and the source-shaped typed starting
  inventory discovery for `FLINT`.
- C has only the typed owner.  Removing the legacy row exposed the actual
  shared presentation defect: `objnam.c:GemStone()` renders the base object
  name `flint` as `flint stone`.
- The discovery formatter now owns that C grammar for `FLINT` and
  non-precious gemstone-material objects; role initialization only records
  concrete object identity.
- Fixture-disabled seed1150 is exact at **3,137/3,137** calls and **51/51**
  screens/cursors.  Seed0002 and seed0501 controls remain exact, the scheduler
  suite passes **113/113**, and `git diff --check` passes.
- The complete fixture-disabled 44-session gate is next.  An incidental
  fixture-enabled run reported **44/44**; no hidden suite, stage, commit,
  push, or submission has run.

### 2026-07-28 accepted 37/44 engine-only baseline restored

- The complete fixture-disabled corpus is **37/44 exact** at
  **26+0.31 ms/turn** (R² 0.761); seed1150 is exact in the broad process and
  the accepted exact-session set has no regression.
- The seven non-exact sessions are seed0014, seed0030, seed0108, seed0360,
  seed0361, seed0373, and seed4500.
- The explicitly ordered fixture-enabled public gate passes **44/44**.  It is
  compatibility evidence, not engine-only or held-out evidence.
- Seed4500 remains exact through input **1002** engine-only; input **1003**
  is the next source-port frontier.
- No hidden suite, stage, commit, push, or submission has run.

### 2026-07-28 seed4500 blind-combat and debug-death block

- Blind movement south at input 1003 now follows
  `domove -> attack_checks -> map_invisible/wakeup`: it consumes the action
  without hero-melee RNG and leaves a remembered `I` at `(42,6)`.
- `linedup()` now preserves its primary live-visibility test and separate
  terrain/boulder fallback.  The Medusa gas region therefore owns C's
  zero-boulder `rn2(2)` draw.
- Fatal status projection distinguishes a current command containing fresh
  hero melee from a monster-only saved scan; seed0007, seed0399, and seed5002
  all remain exact focused controls.
- Declining debug death resumes the interrupted monster's remaining attack
  slots.  The survival `nomovemsg` waits until the actor scan and required
  global maintenance finish, matching input 1012's **123/123 calls**, screen,
  cursor, and turn 147.
- Seed4500 is sequentially exact through input **1033**.  Input **1034** is
  the new first mismatch: RNG and cursor are exact, but JavaScript retains the
  minotaur-arrival top line which C has cleared.
- No hidden suite, full corpus, normal suite, stage, commit, push, or
  submission has run.

### 2026-07-28 seed4500 empty invisible-memory and fatal-ray block

- The exact engine-only seed4500 prefix advances from input 1033 through
  input **1051**.  Input 1048 matches all **36/36 core calls**, decoded
  screen, and cursor.
- `hack.c:domove_fight_empty()` owns an ordinary movement attempt into an
  empty remembered `I`: clear the marker, print `You attack thin air.`,
  cancel rush, consume time, and keep the hero at `(42,5)`.
- The same action's red-dragon ray kills an unseen monster at `(43,6)`.
  `monkilled()->mondied()` emits no blind hit line, clears the dead actor's
  `I`, consumes `corpse_chance()`, and only then advances to the hero's
  `zap_hit()`.
- This is a source-owned movement/map/death transaction, not a bounded
  transcript bridge.  Architecture section 388 maps both halves.
- Input **1052** is the new first mismatch: the wield-result screen and
  cursor are exact, but JavaScript assigns 24 monster calls to the selection
  byte while C assigns zero.  The likely owner is the `dowield()` result
  pager/continuation boundary.
- No hidden suite, full corpus, normal suite, stage, commit, push, or
  submission has run.

### 2026-07-28 seed4500 wield, blind-floor, and counted-wait block

- The fixture-disabled seed4500 prefix advances from input 1051 through input
  **1077** with exact RNG slices, decoded screens, and cursors.
- `dowield()` recognizes the selected alternate weapon and routes through
  `doswapweapon()`; `pushweapon` preserves the displaced primary in
  `uswapwep`, and inventory grammar projects the resulting plural alternate
  slot.
- A temporary C trace proved that exact-zero fatal damage commits HP 0 before
  tty, while negative overkill can retain the previous status row.  The trace
  instrumentation was removed and the recorder rebuilt before the JS repair.
- Blind punished-level arrival keeps `look_here()`'s tactile prose and its
  floor-pile menu as two separate tty continuations.
- Positive-`multi` waiting now owns scheduler-separated repetitions.
  `regen_hp()/regen_pw()` reduce an interrupted count to the final
  `timed_occupation()` unwind; adjacent contact emits `You stop waiting.`
  after the first revealing hit and before later attack slots.
- The focused scheduler, monster movement, and vision gates pass.  The
  seed5002/5003 pair is again exact at **12,167/12,167 calls and 410/410
  screens/cursors** after the deferred Wizard-survival `nomovemsg` was given
  both source-ration and generic-live post-scan completion points.
- Input **1078** is next: both sides make 33 calls and render the same screen,
  but the hero's long-sword damage call is JavaScript `rnd(8)` versus C
  `rnd(12)`.  Inspect target-size metadata and `dmgval()` ownership before
  changing combat RNG.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-29 seed4500 ambient-shapechange and silent-drop correction

- This corrects the preceding conduct entry: the brown mold does drop the 11
  apples.  The first divergence was the following one-in-70 ambient birth.
- The source birth is a chameleon identity initialized as a giant eel.  Its
  alternate form uses the PM-index animal list, target-form sex/HP, no target
  inventory, and later enters `minliquid()` plus the eel hide retry on land.
- `OPTIONS=!verbose` suppresses ordinary floor-drop prose but not the drop,
  elapsed action, or floor/inventory mutation.  JavaScript's synthetic line
  had created a false tty pager and truncated the cockatrice transaction.
- Input **1576** now matches all 250 core RNG calls, and inputs
  **1576--1578** are exact in RNG, decoded screen, and cursor.
- Input **1579** is next: C uniquely autocompletes physical extcmd prefix
  `ver` to painted `version`; JavaScript does not yet paint the suffix.
- The leaderboard is unchanged because local `HEAD` and `origin/main` remain
  the same published commit, `4e04bd9`; no push or submission was performed.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-29 seed4500 getpos-control and safe-teleport block

- Correction to the preceding block: `$` is
  `NHKF_GETPOS_SHOWVALID`, not an object-class glyph.  With no getpos
  highlight callback, it changes no map cell but repaints the canonical goal
  prompt.
- Automatic getpos description now distinguishes seen STONE (`stone`) from
  wall terrain (`wall`).
- A controlled destination still passes through `teleok()`.  The invalid
  selected rock at input 1378 queues `Sorry...`; `safe_teleds()` rejects
  random `(27,1)` and accepts `(26,9)` using the exact four-call prefix.
- The destination relocation reuses ball-and-chain placement, vision,
  special-room, and floor-pile owners.  The pending refusal line and
  punishment pile reproduce the two consecutive C pager boundaries.
- The fixture-disabled seed4500 replay is exact through input **1437**.
  Input **1438** is next: C enters `polyself()` after a self-zap with a wand
  of polymorph, while JavaScript advances the ordinary scheduler.
- The forty-failure full-map `safe_teleds()` fallback remains unwitnessed.
  The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-28 seed4500 damage-size, blindness, felt-floor, and prayer block

- The fixture-disabled seed4500 prefix advances from input 1077 through input
  **1201**, exact in per-input RNG, decoded screens, and cursors.
- Long-sword large-target damage starts at `MZ_LARGE`, matching
  `weapon.c:bigmonst()`; the prior `MZ_HUGE` threshold caused input 1078's
  `rnd(8)`/`rnd(12)` split.
- Ordinary raven AD_BLND contact adds the full damage roll.  `nh_timeout()`
  owns one decrement per global turn, `#wizintrinsic` displays and extends the
  live timeout, and prayer's separate `u.uinvulnerable` flag freezes timed
  properties for all three prayer turns.
- Blind `look_here()` records the pile-top glyph before its tactile prose.
  The next object description owns the pager, so movement maintenance resumes
  only after acknowledgement.  Blind `move_bc(control=0)` preserves the felt
  unmoved chain rather than erasing it through sighted remove/re-place.
- `getobj()` cancellation follows the source `quitchars` set and suppresses
  `Never mind.` under `!verbose`.  The final prayer completion pager defers
  the once-per-hero-took-time Seer reschedule until `prayer_done()` returns.
- The extended focused scheduler witness passes through input 1201.  Input
  **1202** is the next blocker, currently a potion-description mismatch with
  no earlier RNG divergence.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-28 seed4500 blind-potion and tty-corner-menu block

- Blind `#wizwish` leaves the new potion visually unknown, so the inventory
  line uses generic `a potion` while preserving the exact object constructor
  RNG.
- Quaffing extra healing now owns its `16 + d(4,8)` recovery, maximum-HP
  adjustment, blindness/deafness and illness cures, discovery XP, and
  attribute exercises.
- A tty corner menu is dismissed with `docorner()`, which restores the
  already-painted map buffer rather than running core `docrt()`.
  `#overview` therefore preserves a `#wizmap` web glyph even when a visible
  giant spider occupies that square.
- The fixture-disabled seed4500 replay is exact through input **1277**.
  Input **1278** is the next blocker: C selects `hellfill.lua` variant 2 and
  enters its mazegrid/mazewalk graph, while the unported JavaScript variant
  falls through to ordinary room generation.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-28 seed4500 hellfill variant-2 selection block

- `hellfill.lua` variant 2 now crosses the Lua/C boundary through
  `mazegrid`, source-shaped non-MICRO `walkfrom`, absolute selections,
  `hell_tweaks`, stairs, and population.
- C `walkfrom()` resumes its remaining direction scan at the recursive child
  coordinate; preserving the apparent local-variable mutation matches all
  341 maze-walker calls.
- Selection storage is absolute, constructors are level-context-relative,
  percentage and `rndcoord` scan x-major, and Lua `selection:iterate()` scans
  y-major.  Absolute `bounds()` values fed to relative `fillrect()` are
  intentionally translated a second time.
- `m_initweap()` explicit class-switch arms bypass the default `rnd(14)`
  weapon table and join its shared `rn2(75)` tail.  The explicit boundary
  fixes the population tail without regressing the input-796 control.
- Input **1278** is exact at **3,908/3,908** calls plus decoded screen and
  cursor.  The fixture-disabled seed4500 replay is exact through input
  **1290**; input **1291** is next at expected `rn2(4)` versus actual
  `rn2(3)`.
- Variant 2's optional prefab path remains separately unported; its percentage
  check is false in this witness.  The last complete engine-only measurement
  remains **37/44**.  No hidden suite, full corpus, normal suite, stage,
  commit, push, or submission has run.

### 2026-07-29 seed4500 named Sanctum block

- Input 1291 is the placed `sanctum` named level at Gehennom local level 22,
  not a Hell filler.  The prior unsupported-special fallthrough began a
  second alignment shuffle after the correct named-level preamble.
- The new constructor preserves the script's pre-map absolute barrier,
  unlit string map, temple/sanctum high cleric, morgue, fire ring, fixed and
  random contents, arrival region, wallification/flip, and deferred room
  fill boundaries.
- Negative `adjalign()` now records alignment abuse as well as record loss;
  the two caitiff penalties raise this Erinys witness from base level 7 to 9.
- High-cleric and Lich-class inventory branches are shared constructors.
  Covetous monsters bypass a natural no-teleport level flag when
  `rnd_defensive_item()` considers teleportation.
- Input **1291** is exact at **5,516/5,516** RNG calls plus decoded screen and
  cursor.  The fixture-disabled seed4500 replay is exact through input
  **1295**; input **1296** is next after 13 matching calls.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-29 seed4500 cached-level restore-order block

- Input **1296** returns to the cached `hellfill.lua` variant-5 level at
  Gehennom local level 14; it does not construct a new filler.
- C restores its saved head-inserted `fmon` chain in the reverse of
  JavaScript construction-array order.  That order puts the undisguised
  lurker above thirteenth, where `hide_monst()->restrap()` owns the observed
  `rn2(3)`, and the minotaur's `rnd(10)` remains last.
- Reverse cache restoration plus the shared hider probe makes input 1296
  exact at **19/19** calls, decoded screen, cursor, and hero coordinate
  `(71,11)`.  The fixture-disabled seed4500 prefix is exact through input
  **1321**.
- Input **1322** is next: teleport-position `getpos()` should interpret `{`
  as a fountain-glyph target/search command, but the JS direction-only path
  reports `Unknown direction`.  This is a zero-RNG tty/getpos boundary.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-29 seed4500 getpos fountain-glyph block

- `getpos()` dungeon-feature keys scan row-major after the current cursor,
  wrap at the map end, and stop on a matching live, remembered, or known
  background cmap glyph.
- Input `{` selects the remembered fountain at map coordinate `(22,3)` and
  tty cursor `[21,4,1]`; it is not an unknown direction.
- Automatic description now paints `fountain`, and controlled teleport passes
  `There is a fountain here.` into the existing floor-pile pager.
- Inputs **1322--1325** are exact in core calls, decoded screens, and cursors.
  Input **1326** is next: fountain outcome `rnd(30)=21` matches, then C asks
  `rn2(4)` while JS asks `rn2(3)`.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-29 seed4500 contaminated-fountain block

- Fountain fate 21 is contaminated water.  Without poison resistance it
  calls `poison_strdmg(rn1(4,3),rnd(10))`, then exercises Constitution before
  the shared dry-up check.
- The witnessed rolls reduce Strength **19 to 14** and HP **69 to 60**.
  `rn2(2)=0` still belongs to `exercise(A_CON,FALSE)` even though its numeric
  accumulator effect is zero.
- Input **1326** is exact at **11/11** calls plus decoded screen, cursor,
  message, and status.  The fixture-disabled seed4500 prefix is exact through
  input **1328**.
- Input **1329** is next: fountain fate 30 should enter
  `dogushforth(TRUE)` at `rn2(7)`, while JS currently falls through to
  `dryup()` at `rn2(3)`.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-29 seed4500 fountain-overflow clear-area block

- Hero-centered `do_clear_area()` is a row-major scan over the radius-seven
  circle clipped by the current `couldsee()` matrix.  Its order differs from
  the non-hero `view_from()` callback graph and is directly observable because
  `gush()` rolls once for each even-parity, non-hero visible cell.
- The exact pre-input level yields 25 probes with the C bounds.  Of five zero
  rolls, four are rejected after RNG by wall or adjacent-door policy; only
  ROOM coordinate `(18,4)` becomes POOL.
- The surviving cell contains an empty, uncursed chest, so the waterproof
  container branch consumes no object RNG and leaves it intact.  The source
  water-damage owner now also carries container leakage, paper, potion, and
  rust state; monster `minliquid()` remains a separate unwitnessed boundary.
- Input **1329** is exact at **38/38** calls plus decoded screen, cursor,
  message, and terrain.  Inputs 1330--1331 remain exact.
- Input **1332** is next and is screen-only: C completes `# of` to
  `# offer`, while JavaScript retains `# of`.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-29 seed4500 extended-command offer/untrap block

- C's extended-command editor completes against registered AUTOCOMPLETE
  entries and later dispatches the same entry; visual suffixes are not
  aliases independent of command identity.
- `o` remains ambiguous with `overview`, while `of` uniquely selects
  `offer`.  `u` selects `untrap`.  The tty cursor remains after the typed
  prefix while the full completion is painted.
- `offer` rejects this non-altar square at zero time.  `untrap` enters its
  direction owner, where Escape cancels before adjacent trap policy.
- Inputs **1330--1346** are exact in RNG slices, decoded screens, and cursors.
- Input **1347** is next: `$` should remain within getpos object-glyph search,
  but JavaScript currently reports an unknown direction.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-29 ledger-order cross-reference

- The getpos-control and safe-teleport block appears earlier in this ledger
  because its append patch matched a non-terminal section boundary.
- Its acceptance witness remains seed4500 exact through input **1437**;
  input **1438** is the wand-of-polymorph self-zap boundary.
- No engine behavior, full-corpus baseline, git state, or publication state
  changed in this bookkeeping correction.

### 2026-07-29 seed4500 random-self-polymorph block

- `WAN_POLYMORPH` self-zap enters `polyself()` and the ordinary legal-monster
  branch; `newman()` remains a separate unimplemented boundary.
- The witnessed result is brown mold: monster 159, duration 506, HP 6/6,
  natural AC 9, speed 0, small, eyeless, and handless.
- `break_armor()`/`drop_weapon()` produce two pager transactions, drop the
  incompatible worn/wielded objects through the floor-object owner, and
  leave the form Overloaded and Blind.
- Form-derived carrying capacity, physical-exercise suppression, HP/HD
  status, intrinsic-Fast scheduling, and the post-polymorph vision rebuild
  are all required for the resumed command boundary.
- Inputs **1438--1443** are exact in core RNG slices, decoded screens, and
  cursors.  Input **1444** is next: C consumes a monster-policy `rn2(25)`
  before JavaScript's shared movement sequence.
- The leaderboard still reflects remote commit `4e04bd9`; all newer parity
  changes remain local and uncommitted.  No push was authorized.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-29 seed4500 polymorphed line-up block

- `m_lined_up()` consumes `rn2(25)` for every hero-target line-up check while
  polymorphed, before testing whether concealment is actually active.
- `m_move()` reaches that owner during hostile floor-item-search policy; it
  is not limited to breath, spit, or thrown-weapon launch code.
- Routing all hostile hero-target checks through the perceived-hero wrapper
  makes inputs **1444--1465** exact in core RNG slices, decoded screens, and
  cursors.
- Input **1466** is next and is screen-only: C selects the cash-register
  chime while JavaScript selects guard-patrol footsteps from `dosounds()`.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-29 seed4500 tty ambient-continuation block

- A long speed-zero wait triggers vault footsteps and then a shop
  cash-register line on successive global turns.
- `tty/topl.c:update_topl()` computes `skip` before `more()`.  Escape sets
  `WIN_STOP`, but the current pline which caused `--More--` is still
  installed; only later plines are suppressed.
- Preserving that order makes inputs **1466--1500** exact in core RNG slices,
  decoded screens, and cursors.
- Input **1501** is next and is screen-only: a newly wished unknown ring is
  generic `a ring` in C but exposed as `an engagement ring` in JavaScript.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-29 seed4500 blind wished-object naming block

- A blind hero can know the wished concrete type without knowing this copy's
  shuffled appearance; individual `dknown` wins over global type knowledge
  in `xname()`.
- Unknown appearances collapse to class nouns for rings, amulets, potions,
  scrolls, spellbooks/books, wands, and gems/stones.
- Inputs **1501--1502** are exact in core RNG slices, decoded screens, and
  cursors.
- Input **1503** is next: C rejects the ring for the handless brown-mold body
  before finger selection, while JavaScript still asks Right or Left.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-29 seed4500 polymorphed ring-eligibility block

- Ring installation checks the current form's composite `M1_NOLIMBS` mask
  before filled slots and before right/left finger selection.
- Brown mold satisfies `M1_NOLIMBS`; the rejected put-on action consumes no
  time or RNG.
- Input **1503** is exact in core RNG, decoded screen, and cursor.
- Input **1504** is next: `doread()` must reject the Overloaded hero through
  shared `check_capacity()` before opening an object prompt.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-29 seed4500 read capacity-preflight block

- `hack.c:check_capacity()` rejects at `EXT_ENCUMBER` before command-specific
  UI; it is distinct from movement-ration encumbrance policy.
- `doread()` now refuses the Overloaded brown mold without opening `getobj()`
  or advancing time.
- Inputs **1504--1540** are exact in core RNG slices, decoded screens, and
  cursors.
- Input **1541** is next: C has reopened the eat-object prompt after an
  invalid-letter pager, while JavaScript remains on `--More--`.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-29 seed4500 getobj Return-acknowledgement block

- The absent-letter `getobj()` pager accepts Escape, Space, Return, or Enter,
  then reopens its filtered prompt and reads a fresh selection byte.
- The eat selector now matches the shared retry contract rather than
  returning the pager acknowledgement to command dispatch.
- Inputs **1541--1551** are exact in core RNG slices, decoded screens, and
  cursors.
- Input **1552** is next: C rejects movement with `You collapse under your
  load.` after the speed-zero wait; JavaScript moves south.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-29 seed4500 overloaded movement-preflight block

- `domove_core()` checks `carrying_too_much()` before swallowed, impairment,
  destination, actor, or display handling.
- Overloaded collapse is stationary but time-consuming; it terminates runs
  and leaves coordinates/glyphs unchanged while the form waits for its next
  movement ration.
- Inputs **1552--1559** are exact in core RNG slices, decoded screens, and
  cursors.
- Input **1560** is next: C applies brown mold's passive cold defense between
  the attacker's first and second attack slots; JavaScript repeats a generic
  bite transaction.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-29 seed4500 polymorph-passive attack-phase block

- Positive monster contact applies to `mh` while polymorphed and retains the
  old form for `passiveum()` even though incoming damage can change form.
- Brown mold cold defense runs between the cockatrice bite and its next
  attack slot: `d(2,6)`, `rn2(3)`, `rn2(2)`, healing, attacker damage, then
  slot-one `rnd(21),d(0,0)`.
- The stoning-touch effect resumes after its visible contact line and owns
  the special `rn2(3)` before the shared knockback `rn2(3),rn2(6)` prefix.
- Source-ration allocation updates the visible source turn before a later
  monster scan; the combat pager therefore shows `T:277`, not the original
  action's `T:270`.
- Inputs **1560--1566** are exact in core RNG slices, decoded screens, and
  cursors.
- Input **1567** is next: tty uniquely completes physical prefix `co` to the
  displayed `conduct`, while JavaScript leaves the literal prefix.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-29 seed4500 conduct-history disclosure block

- `#conduct` is a projection of event-time history, not of surviving actors,
  inventory, or the current dungeon cache.  Wielded hits, reading, food,
  wishes, pets, rank changes, branch entry, and Minetown entry now update
  their own durable owners.
- Ordered rank and location achievements reproduce Esquire, Bachelor,
  Sergeant, Knight, Gehennom, Gnomish Mines, and Minetown in their source
  attainment order.
- The tty corner disclosure uses a one-column right margin, `--More--`, and
  saved-presentation restoration.  Its physical `co` prefix autocompletes to
  conduct without advancing the editor cursor through the painted suffix.
- Inputs **1567--1575**, and therefore the complete fixture-disabled
  seed4500 prefix through input **1575**, are exact in core RNG slices,
  decoded screens, and cursors.
- Input **1576** is next: the brown mold cannot complete the requested drop,
  while JavaScript removes the 11 apples and changes the scheduler state.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-29 seed4500 command-to-live-monster catch-up block

- Source-shaped command, tty, knowledge, teleport, shapechange, birth, and
  monster-runtime repairs make the fixture-disabled seed4500 replay exact in
  core RNG slices, decoded screens, and cursors through input **1741**.
- The repaired boundaries include `#version`, blind object knowledge,
  form/capacity preflights, projected map memory and modal restoration,
  `#wizwhere`, discovery and farlook flows, pile/arrival pickup, controlled
  teleport, vampire form identity, generation filtering, priest movement,
  native bat speed, and stranded-vampire distress.
- Input **1742** was next with only 449 expected RNG calls shared before the
  first diagnosis.

### 2026-07-29 seed4500 post-move offensive-probe block

- C `dochug()` continues after `MMOVE_MOVED` for a distant actor and evaluates
  natural ranged, weapon, then offensive-inventory eligibility in order.
- An intelligent, handed, empty-inventory ghost reaches `find_offensive()` and
  its `lined_up()` probe; concealment makes the probe RNG-visible even though
  the actor has no usable offensive object.
- The source-shaped post-move probe and its unit witness advance the exact
  input-1742 common RNG prefix from **449 to 1,126 calls**.
- The new earliest mismatch is actor 509, an elf mummy: C begins another
  `rn2(5)` actor prefix while JavaScript enters movement candidate/track
  avoidance with `rn2(24)`.  Treat this as retained coordinate, track, or
  topology state until a source witness proves otherwise.

### 2026-07-29 seed4500 composition-witness and regression checkpoint

- Instrumenting and rebuilding the C recorder succeeded, but raw replay of
  the composed seed4500 input stream ended around source turn 117 rather than
  turn 405.  Because the session was created by `sherpa_compose_multi.py`,
  byte replay is not a valid late-state witness; the debug instrumentation
  was removed.
- Temporary JavaScript trace hooks were removed.  Focused monster-movement
  and object-metadata tests pass **59/59**; the named Big Room 12 descriptor
  witness also passes.
- The broader targeted batch is **199/207**, with eight current/long-session
  failures including seed0004 pony HP (`expected 9`, `actual 8`).  Do not
  describe this checkpoint as broadly green.
- The public leaderboard is unchanged because the local port has not been
  pushed to the fork.  No push was requested or performed.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, new full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-29 seed4500 getpos/current-form checkpoint

- Trap knowledge is durable level state; a harmless anti-magic interaction
  does not erase the learned topology.
- Olfaction is a current-form body-class capability, independent of blindness.
- Shared cmap-backed getpos classification now serves teleport, travel, and
  farlook.  The fixture-disabled seed4500 replay is exact through input
  **1754**.

### 2026-07-29 seed4500 covetous/fire-trap checkpoint

- `makemon()` birth strategy, healthy covetous harassment, no-teleport bypass,
  three shuffled `enexto` rings, one-shot appearance prose, and tty-resumable
  relocation now share one actor transaction.
- The destination fire trap owns 2d4 damage, max-HP loss, empty armor-slot
  probes, and the item-destruction limit probe.
- Input **1757** matches core RNG, relocation pager, and cursor.

### 2026-07-29 seed4500 lich contact/spell checkpoint

- `mattacku()` performs the intelligent empty-inventory offensive line-up
  probe before attack slots.
- `getmattk()` weakens the first lich cold touch to physical damage against
  the cold-resistant brown mold; its passive remains between attack slots.
- The same actor continues into `AT_MAGC`: psi-bolt owns `rn2(23)`,
  `rn2(230)`, and `d(12,6)` without a to-hit roll.
- Shared rehumanization restores the generated Knight record, sight,
  attributes, AC, and encumbrance projection after monster-form HP reaches
  zero.
- Inputs **1759**, **1761**, and **1763** match RNG, cursor, and their tty
  pagers.  The only screen debt in this prefix is the erroneous stored-hunger
  label beginning at input 1755.

### 2026-07-29 seed4500 input-1764 track frontier

- Input **1764** is the next core-RNG boundary.  After an exact lich and first
  aligned-cleric prefix, C uses `rn2(32)` where JavaScript's next hostile
  Sanctum cleric uses `rn2(20)` from five candidates and track index zero.
- The source formula `4 * (cnt - j)` is not the bug.  The upstream owner is an
  earlier actor coordinate, `mtrack`, topology/admission, or actor-eligibility
  producer.
- A second instrumented recorder attempt reconfirmed that raw replay of the
  composed session stops near turn 117; it is not a late-state oracle.
  Temporary C and JavaScript probes were removed.
- The last complete engine-only measurement remains **37/44**.  No hidden
  suite, new full corpus, normal suite, stage, commit, push, or submission has
  run.

### 2026-07-29 seed4500 hunger and publication-state checkpoint

- C ordinary metabolism depends on the current form having carnivorous,
  herbivorous, or metallivorous dietary flags.  Brown mold therefore retains
  900 nutrition while accessory-cost probes remain independent.
- The fixture-disabled seed4500 replay is exact in core RNG, decoded screens,
  and cursors through input **1763**.  Input **1764** remains the first RNG
  frontier.
- The local branch and `origin/main` both point at `4e04bd9`; all repairs after
  that commit remain local working-tree changes.
- The official judge scores the latest commit on the fork, not the local
  checkout.  No push or submission was requested or performed, so the current
  local progress cannot yet affect the leaderboard.
- The 2026-07-21 screenshot (`11,405 + 265`) is higher than the earlier
  `11,404 + 108` observation, confirming that the last published slice was
  rescored even though later local work has not been published.

### 2026-07-29 seed4500 Sanctum trap-knowledge falsification

- Clearing hostile Sanctum cleric trap knowledge is contradicted at input
  1757 call 124: an actor enters the fire ring and adds an unrecorded fire-trap
  transaction.
- `sanctum.lua` supplies `align="noalign"` for each hostile cleric.
  `sp_lev.c:create_monster()` therefore calls `priest.c:mk_roamer()`, which
  pre-teaches all trap types.
- Shared `mondata.c:mons_see_trap()` observer propagation is now ported for
  currently implemented monster trap triggers, but it is independent of the
  input-1764 candidate-count mismatch.
- The authoritative replay remains exact through input **1763**.  Input 1764
  still first differs at call 6, C `rn2(32)` versus JavaScript `rn2(20)`.

### 2026-07-29 seed4500 known-trapped item-goal checkpoint

- `monmove.c:m_search_items()` excludes a floor-object square when the actor
  knows its trap type; the object cannot replace the hero pursuit goal.
- The aligned cleric therefore moves from `(20,14)` to `(21,15)`, not toward
  the trapped boomerang at `(16,13)`.  Its next eight-candidate scan plus
  track index zero explains C's `rn2(32)` without weakening trap knowledge.
- Focused trap-observer and aware/unaware collector witnesses pass.  The
  fixture-disabled seed4500 replay is exact through input **1768**.

### 2026-07-29 seed4500 safe-wait command checkpoint

- `do.c:cmd_safety_prevention()` classifies an unsafe ordinary `.` as
  `ECMD_OK`, so no turn or monster phase runs.  `m.` is the explicit
  request-menu override and remains timed.
- Warning counters are command-specific and durable across rejected inputs.
  With `cmdassist` off, only the first warning carries the force-prefix hint;
  `Norep` suppresses later identical lines.
- Shared JavaScript ownership now serves both `donull()` and `dosearch()`.
  The fixture-disabled replay is exact in RNG, decoded screens, and cursors
  through input **1783**.  Input **1784** is the next frontier.

### 2026-07-29 seed4500 summon-nasties checkpoint

- A successful undirected `castmu(FALSE,FALSE)` is an action, not a spell
  selection probe followed by ordinary movement.  It sets spell cooldown,
  owns the fumble roll, bypasses `m_move()`, and resumes the same
  `dochug()` only after the effect and tty messages.
- `MCAST_SUMMON_MONS` now enters the ordinary `wizard.c:nasty()` path:
  source nasty-table selection, alignment and spellcaster filtering, three
  eagerly shuffled `enexto()` rings, ordinary `makemon()` construction, and
  delayed first special attacks.
- Summoned Olog-hai retain the common offensive-item tail after troll weapon
  selection.  Summoned jabberwocks share the nymph-class birth sleep probe.
- Input **1784** matches all **566/566** core calls, decoded screen, message,
  and cursor.  The focused replay is exact through that input; input **1785**
  is the next attack-table frontier.
- The Gehennom demon-summon branch and genocided-species replacement remain
  explicit pending cones.  The last complete engine-only measurement remains
  **37/44**; no hidden suite, full corpus, normal suite, stage, commit, push,
  or submission ran.

### 2026-07-29 seed4500 adjacent attack-table and stopped-death checkpoint

- Adjacent `AT_BREA` and `AT_SPIT` entries are zero-RNG control edges in
  `mattacku()`; the next natural attack retains its real source slot index.
- Hand-to-hand selection now rejects carried polearms such as the summoned
  Olog-hai's glaive.  A failed close-wield attempt consumes no RNG, and the
  bare `AT_WEAP` slot still rolls its declared `3d6`.
- Escape at an earlier actor pager sets `WIN_STOP`.  Suppressed later contact
  cannot force a stale contact pager; the plain fatal line yields directly to
  the debug/explore `Die?` modal at the next capture.
- Fixture-disabled seed4500 is exact in core RNG, decoded screens, and cursors
  through input **1791**.  The focused attack-table witnesses pass.
- A broader movement/metadata batch remains **186/187** because the existing
  seed0004 pony witness has a one-row cursor mismatch even in isolation; it
  is not counted as green.

### 2026-07-29 seed4500 xan leg-effect and Knight-goal frontier

- `AD_LEGS` is a resumable special-contact transaction: declared damage and
  side precede its pline; wound duration, Strength/Dexterity exercise, shared
  knockback, and HP damage follow it.
- The xan witness now consumes the source sequence through `rnd(51)=36`,
  marks the right leg wounded, applies the one-time Dexterity penalty, and
  makes seed4500 exact through input **1797**.
- Input 1798 differs only because the resolved Fort Ludios entry lacks its
  selectable `G` label.  Input 1799 exposes the next real construction block:
  C runs `Kni-goal.lua`, while JavaScript falls into generic maze generation
  at call five and has no Knight `goal_first` quest page.
- The next slice is the complete Knight goal map plus ordered Lua operations,
  Knight quest metadata/text, and Fort Ludios menu reachability.  The last
  complete engine-only measurement remains **37/44**; no hidden suite, full
  corpus, normal suite, stage, commit, push, or submission ran.

### 2026-07-29 seed4500 Knight-goal and terminal-state closure

- Fort Ludios is selectable once its resolved floating branch is projected;
  this is a wizard-menu ownership fix, separate from chosen-level generation.
- `Kni-goal.lua` now owns a complete 76 by 20 map and ordered artifact,
  object, trap, and monster graph.  Its construction matches all **630**
  calls reached by the public witness.
- Knight role metadata and `goal_first` text replace generic entry prose.
- `#attributes` now composes one live, ordered `insight.c`-shaped row stream:
  identity, quest depth, experience, base/peak stats, alignment, wounded
  legs, raw weight, intrinsic sources, mortality, mode, and tty pagination.
- Ordinary kills own `xkilled()`-shaped alignment changes; every fatal event
  owns one mortality increment; partly eaten food weight is based on remaining
  nutrition.
- Explicit multi-object look delegates to the shared floor-pile presenter.
- Seed4500 is exact end to end at **108,275/108,275 RNG calls and 1,814/1,814
  screens/cursors**.

### 2026-07-29 disclosure and stopped-death regression recovery

- Ordinary `PICK_NONE` disclosure overlays reserve 38 columns.
  Non-tutorial dungeon overview reserves 39; tutorial overview retains 38.
- A stopped pager owned by an earlier monster is not equivalent to one owned
  inside the fatal contact.  Earlier-actor suppression lets the special
  death-line override proceed directly to the debug modal; a same-contact
  poison/encumbrance pager still requires `done()`'s explicit death-line
  flush.
- Mortality and partly-eaten food weight were ablated independently and did
  not affect seed0399's input phase, falsifying both as timing causes.
- Seed0006, seed0007, seed0009, seed0399, and seed4500 are jointly exact after
  the shared repair.

### 2026-07-29 accepted 38/44 engine-only checkpoint

- The required full fixture-disabled corpus is **38/44 exact** at
  **37+0.23 ms/turn** (R² 0.826).
- Seed4500 is the net new exact session.  No member of the accepted
  37-session baseline regressed.
- The remaining public portfolio is seed0014, seed0030, seed0108, seed0360,
  seed0361, and seed0373.  Choose the next work block from their earliest
  shared C/Lua divergence.
- No hidden suite, fixture-enabled suite, stage, commit, push, or submission
  ran at this checkpoint.

### 2026-07-29 seed0361 artifact and Archeologist-start checkpoint

- Artifact wishes now resolve through the full artifact registry to an
  ordinary base-object constructor, then commit stable named identity and the
  global existence bit.  Wish delivery and wielding share hero-touch policy;
  Orcrist and Sting retain their source unrestricted exception.
- Intrinsic Searching is suppressed while a delayed action still represents
  negative `multi`.
- The debug menu byte selects `Arc-strt`, not `fakewiz2`; the earlier
  prototype diagnosis is corrected.  The complete `Arc-strt.lua` graph,
  including its transformed Quest portal, matches all **924/924** construction
  calls.

### 2026-07-29 seed0361 quest rejection, expulsion, and court checkpoint

- Conceal-capable monsters born over objects and eels born in water now begin
  with source `mundetected` state, so the hidden snake projects its floor
  object.
- An adjacent waiting leader is a live `dochug()` action.  Quest text windows,
  the debug purity byte, bad-alignment rejection, Wisdom exercise, and deferred
  expulsion retain distinct tty and scheduler owners.
- Portal arrival marks the parent-side portal seen.  The selected ordinary
  `COURT` now constructs its ruler, scans the court before committing throne
  terrain, and creates its royal coffer.
- The expulsion generation slice is exact at **3,474/3,474 RNG** and seed0361
  is exact through input **205**.

### 2026-07-29 seed0361 rolling-boulder checkpoint

- The input-206 live state already held the correct unseen trap, launch
  endpoints, and boulder identity; generation, hero coordinates, and
  presentation-only explanations are falsified.
- Player `spoteffects()` now enters the rolling-trap transaction, discovers
  the trap, extracts and animates the existing boulder, performs
  damage-before-hit RNG, and replaces that same object at the far endpoint.
- Input 206 matches all **7/7** core calls, decoded screen, cursor, and
  **6/6** animation frames.  The fixture-disabled regression is exact across
  inputs **160--212**.  Full-session positional coverage is now
  **12,371/53,865 RNG, 227/366 screens, and 260/366 cursors**.
- Input **213** is the next first divergence, inside level-17 generation.
  The last complete corpus remains **38/44**; no hidden suite, normal suite,
  stage, commit, push, or submission ran.

### 2026-07-29 seed0361 random-temple checkpoint

- The level-17 stream was exact through `pick_room()`; the first mismatch was
  C's `shrine_pos()` draw against JavaScript's premature ordinary-room fill.
- Random `TEMPLE` selection now immediately constructs the center shrine,
  induced alignment, aligned cleric, shrine record, spellbook inventory, and
  robe state before ordinary rooms are filled.
- The fixture-disabled witness is exact in RNG, decoded screens, and cursors
  across inputs **213--219**.  Focused rolling-boulder and temple regressions
  pass **2/2**.
- Seed0361 positional coverage is now **14,864/53,865 RNG, 244/366 screens,
  and 315/366 cursors**.  Input **220** is the next mismatch: explicit look
  omits an existing down staircase.  The last complete corpus remains
  **38/44**; no hidden suite, normal suite, stage, commit, push, or submission
  ran.

### 2026-07-29 seed0361 staircase-look checkpoint

- Input 220 already had the exact `STAIRS` cell and live down-stair record;
  only `look_here()` failed to project it before the no-object fallback.
- Explicit look now resolves the stair chain through a shared
  `stairs_description()`-shaped boundary.  Inputs **213--220** are exact.
- Six engine-only level-one entrance-look sessions remain **6/6 exact**.
  Seed0361 screen coverage is now **245/366**, with **14,864/53,865 RNG** and
  **315/366 cursors**.
- Input **225**, local call 1031, is the next RNG divergence.  The last full
  corpus remains **38/44**; no hidden suite, normal suite, stage, commit,
  push, or submission ran.

### 2026-07-29 seed0361 Soko elf-inventory checkpoint

- Input 225 builds the same level-9 Grey-elf in both engines.  JavaScript
  discarded a winning `rn2(75)=4` at the end of the elf weapon branch instead
  of entering `rnd_offensive_item()`.
- The elf constructor now reaches the shared tail and creates acid potion id
  574.  The complete **7,355/7,355-call** Soko generation slice is exact.
- Focused seed0361 regressions pass **3/3**.  Full-session RNG coverage is
  **22,066/53,865**; screens/cursors remain **245/366** and **315/366**.
- Input **234** is the next core divergence.  The last full corpus remains
  **38/44**; no hidden suite, normal suite, stage, commit, push, or submission
  ran.

### 2026-07-29 duplicate full-suite OOM incident

- A separate Codex task started two equivalent full Contest suites 35.8
  seconds apart, then left both yielded cells running without a wait or
  termination.  The two Node workers later reached approximately 192 GB and
  178 GB before macOS jetsam removed them after roughly 56--57 minutes.
- Process ancestry and launch timing identify the abandoned duplicate suites
  as the operational cause.  MCP-server, unbounded-Postgres-query, and
  literal-jetsam-age explanations are falsified.
- Containment found no implicated PID or matching Contest suite still alive.
  The repository now requires one full suite/corpus at a time and explicit
  ownership of every yielded test session through exit or termination.
- The worker's precise retained object remains unlocalized.  This is separate
  from the established process-lifecycle cause and must be probed with one
  isolated, managed worker if pursued.
- Parity is paused at seed0361 input **234**.  No test or corpus ran during
  containment; the last accepted full engine-only corpus remains **38/44**.

### 2026-07-29 seed0361 Minend distant-magic checkpoint

- The input-234 missing `rnd(4)` belonged to the preceding gnomish wizard,
  not the following gnome leader.  Actor identities, coordinates, fmon order,
  and the first 29 calls were already aligned.
- C retains a moved `AT_MAGC` actor through phase four and computes
  `AC_VALUE()` before the attack-method switch.  JavaScript incorrectly
  restricted that setup to weapon attackers.
- Moved magic, gaze, breath, spit, and weapon paths now share one
  phase-four AC boundary.  Thrown missiles use their canonical base-object
  name, restoring `A dagger misses you.`.
- Input 234 matches **40/40** calls, screen, and cursor; inputs **226--235**
  are jointly exact and the focused fixture-disabled regression passes
  **1/1**.  All bounded processes exited normally.
- Input **236** is the next divergence at C's `muse.c precheck()` /
  `use_defensive()` potion transaction.  The last complete corpus remains
  **38/44**; no normal suite, hidden suite, stage, commit, push, or submission
  ran.

### 2026-07-29 seed0361 Minend no-move healing checkpoint

- The input-236 owner is gnome leader id 739 at `(52,19)`, created at 18/18
  HP with healing potion id 741.  It was neither damaged, blind, peaceful,
  nor previously active.
- A temporary C recorder probe proved the source calls
  `find_defensive(FALSE)` first, rejects healing at full health, then reaches
  zero `mfndpos()` candidates and retries `find_defensive(TRUE)` from
  `m_move()`.  The escape retry deliberately bypasses the HP gate.
- The zero-candidate path now performs the shuffled potion precheck, healing
  roll, one-point overheal, inventory consumption, quaff presentation,
  trailing `distfleeck()`, and `MMOVE_DONE` phase-four suppression.
- Input 236 matches **66/66** calls, decoded screen, and cursor; inputs
  **226--236** are jointly exact.  The focused engine-only tests pass **2/2**
  and the single managed process exited at roughly **151 MB RSS**.
- Successful ghost/djinni occupant creation remains explicitly deferred.
  Input **237** is next at the missing artifact `spec_abon()` `rnd(5)`.
  The last complete corpus remains **38/44**; no normal suite, hidden suite,
  stage, commit, push, or submission ran.

### 2026-07-29 seed0361 Grayswandir attack checkpoint

- Live state at input 237 confirms the hero wields wished artifact id 14,
  `+5 Grayswandir`, against gnome ruler id 738 at `(54,16)` on 36/36 HP.
- C assigns Grayswandir's `PHYS(5,0)` accuracy draw to
  `hitval()` -> `spec_abon()` before the ordinary d20.  On a hit,
  `artifact_hit()` -> `spec_dbon()` adds the six-point `dmgval()` result
  again before Strength/ring adjustment.
- Artifact attack metadata now belongs to artifact identity rather than the
  silver-saber base object.  Input 237 matches its first **49/92** calls and
  the ruler reaches the source-shaped 24/36 HP.
- The focused engine-only regression passes **1/1** at roughly **151 MB peak
  RSS** and the process exited normally.  Inputs 235--236 remain exact.
- Input **237**, call **49**, is next: the missing `rnd(4)` is a separate
  monster-owned `mattacku()` negative-AC evaluation.  The last complete
  corpus remains **38/44**; no normal suite, hidden suite, stage, commit,
  push, or submission ran.

### 2026-07-29 seed0361 stationary phase-four checkpoint

- Input-237 call 49 belongs to healed gnome leader id 739 at `(52,19)`, not
  the adjacent gnome ruler which begins the following actor transaction.
- C maps its zero-candidate stationary result to `MMOVE_NOTHING`.  That status
  still falls through `dochug()` phase four; only `MMOVE_DONE` suppresses the
  attack boundary.
- Distant phase-four setup now accepts both moved and stationary in-range
  actors with distance/weapon attacks.  Input 237 matches its first
  **58/92** calls, including the ruler's complete contact sequence.
- The focused engine-only regression passes **1/1** at roughly **153 MB peak
  RSS** and the process exited normally.
- Call **58** is next: the giant spider has 12 C `mfndpos()` candidates but
  16 in JavaScript.  The last complete corpus remains **38/44**; no normal
  suite, hidden suite, stage, commit, push, or submission ran.

### 2026-07-29 seed0361 tight-diagonal movement checkpoint

- Input-237 call 58 belongs to giant spider id 733 at `(14,9)`.  JavaScript
  admitted diagonal `(15,10)` between rock shoulders `(14,10)` and `(15,9)`;
  C rejects it through `bad_rock()` plus `cant_squeeze_thru()`.
- The extra candidate changed recent-track avoidance from C's `rn2(12)` to
  JavaScript's `rn2(16)`.  This was candidate filtering, not actor order,
  mtrack order, Lua placement, or a spider-specific random branch.
- The shared `mfndpos()` boundary now rejects tight diagonals for Large,
  inflexible, or overburdened monsters while preserving represented flexible
  exceptions.  A unit witness rejects a giant spider and accepts a cave
  spider between identical shoulders.
- Input 237 reached **92/92** RNG calls and exact cursor.  Its sole remaining
  mismatch was gendered monster naming and hit punctuation.  The managed
  replay exited near **143 MB RSS**.
- The last complete corpus remains **38/44**; no normal suite, hidden suite,
  stage, commit, push, or submission ran.

### 2026-07-29 seed0361 gendered combat presentation checkpoint

- The final input-237 screen mismatch was
  `gnome ruler` versus `gnome king` in two independent renderers, plus
  JavaScript's hard-coded period after the twelve-point hero hit.
- NetHack's `NAMS()` table stores male, female, and neutral names;
  `pmname()` selects from the actor's sex.  `exclam(damage)` selects `!` for
  visible damage above four.  Neither boundary consumes gameplay RNG.
- A shared `monsterTypeName()` now covers all source `NAMS()` species and is
  used by hero and monster combat presentation.  The known seed0399
  dwarf-sex discrepancy remains a separately labeled narrow bridge.
- Input 237 is fully exact: **92/92 RNG calls, decoded screen, and cursor**.
  The strengthened engine-only witness and two units pass **3/3** in one
  managed process at **152.2 MB peak RSS**, then exit normally.
- Input **238+** is next.  The last complete corpus remains **38/44**; no
  normal suite, hidden suite, stage, commit, push, or submission ran.

### 2026-07-29 seed0361 Grayswandir weapon-skill correction

- Inputs 237--238 were exact, but JavaScript killed ruler id 738 on input 239
  while C retained it at 6/36 HP and continued the contact exchange.
- A direct C recorder trace falsified periodic monster regeneration: before
  and after `mon_regen()` at moves 31--33, ruler HP was 26, 16, then 6.
- The wished saber is not part of the Archeologist's startup inventory.
  `skill_init()` leaves saber Unskilled despite its Expert role maximum, so
  `weapon_hit_bonus()` contributes -4 and `weapon_dam_bonus()` contributes
  -2.  Grayswandir's twelve-point artifact subtotal therefore lands for ten.
- The shared skill owner now includes Archeologist maximums, the starting
  Basic pick-axe/whip snapshot, and ordinary one-/two-weapon hit and damage
  projections.  Knight-only pony riding promotion no longer leaks to roles
  that merely have a riding maximum.
- Inputs **235--239** match RNG, decoded screen, and cursor; the strengthened
  engine-only witness passes **1/1** at about **149 MB peak RSS**.  The
  temporary C trace was removed and the recorder rebuilt without trace
  strings.  Input **240+** is next; the last complete corpus remains **38/44**.

### 2026-07-29 seed0361 rejected Quest return checkpoint

- Inputs 240--281 were exact.  Input 282 retained all 30 destination calls
  but lacked C's materialization More prompt on a rejected return to
  `Arc-strt`.
- C loads `Arc.nexttime` after `maybe_lvltport_feedback()`; that later quest
  pline forces the pending materialization topline through tty's accepted-key
  loop.  JavaScript lacked the Archeologist line and used a one-shot prompt.
- `Arc.nexttime` now substitutes the role homebase, and quest/familiar arrival
  messages use the shared pending-topline owner.  Ctrl-V and `?` leave the
  More screen intact, Enter dismisses it, and the homebase line follows.
- Inputs **270--285** match RNG, decoded screen, and cursor.  The focused
  engine-only witness passes **1/1** at about **157 MB peak RSS**.  Input
  **286+** is next; the last complete corpus remains **38/44**.

### 2026-07-29 bounded assertion-memory incident

- A single managed four-test cross-check exited, but one unrelated Priest
  test failed while Node rendered a full ~33,000-call `deepEqual` diff.  The
  process reached **10.3 GB RSS** and produced an enormous assertion payload.
- A bounded first-mismatch replay of the same 250-input session stayed near
  **154 MB RSS** and localized an independent pre-existing divergence at
  seed0367 input 185: JavaScript consumes the following `intemple` `rn2(5)`
  before C dismisses the local-teleport materialization pager.
- The three relevant Arc/Grayswandir/numeric-arrival tests passed.  The Priest
  mismatch precedes the changed Quest arrival path and is separate regression
  debt, not evidence against the Arc repair.
- Whole flattened RNG-log assertions are now prohibited for diagnosis.  The
  **40** current `getRngLog()` test references need bounded per-input
  conversion before another failure-heavy broad suite.  No process remained.

### 2026-07-29 seed0361 Tower-1 Vlad armament checkpoint

- Input 301 first differed immediately after Vlad's
  `rnd(8)=2 @ m_initweap`: C constructed a two-handed sword while JavaScript
  discarded the selected case and entered only the offensive-item tail.
- Tower-1 Lua placement, niche shuffle, Vlad identity/HP, and Candelabrum
  construction were already exact.  The missing owner was the ordinary
  bias-sensitive general weapon table, not the level script.
- Vlad now uses the shared `giveGeneralMonsterWeapon()` transaction after his
  fixed Candelabrum.  Inputs **286--301** match per-input RNG, decoded screen,
  and cursor; input 301 is **342/342** calls.
- The focused engine-only witness passes **1/1** at **157,745,152 bytes peak
  RSS** and exits normally.  Input **302+** is next; the last complete corpus
  remains **38/44**.

### 2026-07-29 seed0361 Arc-loca missing-dispatch checkpoint

- Inputs 302--306 are exact.  Input 307 first differs at call 4 after the
  shared special-level preamble: C starts `des.object()` through
  `get_location()` while JavaScript falls into ordinary level generation.
- `Arc-loca` has an active special descriptor but no generator dispatch
  branch.  The missing boundary is the whole Lua operation graph, not a
  random-location compensation.
- The next implementation slice is the fixed map plus its shared constructors,
  beginning with all 15 bare objects.  The diagnostic stayed bounded at
  **149,110,784 bytes peak RSS**.  The last complete corpus remains **38/44**.

### 2026-07-29 seed0361 Arc-loca Quest-monster metadata checkpoint

- The Arc-loca generator advanced input 307's exact prefix from 4 to 156
  calls.  The next class selection is inside a random statue trap's statue
  constructor, not yet the scripted snake list.
- A temporary trace falsified stale destination depth: the shared class owner
  used destination cutoff 8 correctly.  JavaScript instead lacked the
  Archeologist role's snake/mummy Quest-enemy fields and fell back to
  zombie/wraith classes.
- Restore `enemy1sym=S_SNAKE`, `enemy2num=PM_HUMAN_MUMMY`, and
  `enemy2sym=S_MUMMY` in role data; do not patch the trap or Arc-loca script.

### 2026-07-29 seed0361 Arc-loca monster-humidity checkpoint

- Restoring Archeologist quest-enemy role data advanced input 307 from a
  156-call to a **665-call** exact prefix; the temporary trace was removed.
- Arc-loca has no water.  Each selected water-liking snake exhausts C's
  100-attempt WET `get_location()` pass, then succeeds through a second pass
  with DRY enabled.  JavaScript currently stops after the first pass.
- Add the WET-to-DRY retry to the shared unpositioned special-monster owner.
  The C transcript shows 18 approximately 402-call location runs, not a Lua
  placement table.

Correction: `get_location_coord()` retries the failed random coordinate with
the same WET mask before `create_monster()` adds DRY.  The exact shared
transaction is 100 WET attempts, another 100 WET attempts, then the first DRY
attempt: **402 calls**, not a direct two-pass retry.

### 2026-07-29 seed0361 Arc-loca gameplay-RNG checkpoint

- The shared native-humidity, wrapper-retry, then DRY fallback closes every
  scripted snake location transaction.
- Input 307 is now **8,285/8,285 RNG calls** with exact values.  The bounded
  process exited at **147,259,392 bytes peak RSS**.
- Screen and cursor still differ, so generation RNG is closed and the next
  investigation is arrival/map presentation only.

### 2026-07-29 seed0361 Arc-loca presentation checkpoint

- The remaining input-307 diff is the absent materialization More prompt and
  two wall-end corner cells; input 307 gameplay remains **8,285/8,285**.
- `load_special()` wallifies after the Lua script and before flipping.
  Arc-loca currently omits that loader pass.
- The first locate arrival already reaches the quest-arrival owner, but Arc
  lacks its `locate_first` page and `locate_next` line in JavaScript.  The
  missing page should force materialization to More, then open at input 308.

### 2026-07-29 seed0361 Arc-loca accepted checkpoint

- Loader wallification before flip repairs the two wall endpoints; Arc
  `locate_first`/`locate_next` repairs the quest-page collision.
- Inputs **302--311** match per-input RNG, decoded screen, and cursor.  Input
  307 remains **8,285/8,285** calls.
- The focused engine-only regression passes **1/1** at **156,516,352 bytes
  peak RSS** using a bounded first-call comparator.  Input **312+** is next;
  the last complete corpus remains **38/44**.

### 2026-07-29 seed0361 Arc-filb missing-dispatch checkpoint

- Inputs 312--313 are exact.  Input 314 first differs at call 3:
  `Arc-filb.lua` starts room-form `build_room()`, while JavaScript falls into
  regular generation.
- The room-form preamble is already exact.  Add both Archeologist filler
  action tables and route them through the shared six-room/corridor runner.
- The diagnostic exited at **149,061,632 bytes peak RSS**.  Input 314 has
  2,560 expected calls; no broad suite ran.

### 2026-07-29 seed0361 Arc-filb accepted checkpoint

- Both Arc filler variants now share a six-room action-table runner.
- Input 314 matches **2,560/2,560** calls, screen, and cursor; Arc-filb has six
  rooms, seven monsters, and four traps.
- The focused regression passes **1/1** at **159,678,464 bytes peak RSS**.
  Input **315+** is next; the last complete corpus remains **38/44**.

### 2026-07-29 seed0361 Arc-goal missing-dispatch checkpoint

- Inputs 315--316 are exact.  Input 317 first differs at local call 4 after
  the shared Lua preamble: C begins the fixed crystal ball quest-artifact
  constructor and JavaScript begins regular generation.
- `Arc-goal.lua` owns an ordered fixed-map, artifact, traps, nemesis, snake,
  and mummy graph followed by loader wallification and flip.
- Implement that script through shared constructors, then compare input 317
  per call and stop at its first remaining owner.  The diagnostic exited at
  **151,257,088 bytes peak RSS**; no broad suite ran.

### 2026-07-29 seed0361 Arc-goal nemesis-gender checkpoint

- The new Arc-goal graph advances input 317 to a 396-call exact prefix.
- JavaScript spends an extra birth-gender `rn2(2)` inside `makemon()` after
  the Minion's HP.  C reuses `quest_status.nemgend`; the earlier Lua-parser
  gender draw remains source-required and is restored after construction.
- Repair shared Quest leader/nemesis birth-gender ownership, then continue
  with a single bounded input-317 replay.  This run peaked at **148,373,504
  bytes RSS**.

### 2026-07-29 seed0361 Arc-goal gameplay-RNG checkpoint

- Shared Quest-actor gender closes input 317 at **8,448/8,448** calls.
- C remains on the materialization `--More--` at `[45,0,1]`; JavaScript
  returns to the map because `QUEST_TEXT.Arc.goal_first` is absent even though
  the first-goal arrival owner and its quest.lua shuffle calls run.
- Add the four-line source page and validate inputs 317 onward.  The exact-RNG
  run peaked at **150,945,792 bytes RSS**.

### 2026-07-29 seed0361 Arc-goal lighting-selection checkpoint

- `Arc.goal_first` makes inputs 320--322 exact; the entry and post-page map
  still omit the same 42 visible cells while retaining exact RNG and cursors.
- Those cells are already lit in JavaScript but unseen.  C grows every
  `des.region(selection, "lit")` by one cell with `W_ANY`; the shared JS
  lighting helper currently paints only the literal rectangle.
- Add the source-owned eight-direction halo only for lit selections, then
  re-check inputs 315--323.  Do not patch screen memory or the 42 cells.

### 2026-07-29 seed0361 Arc-goal raw-doorway checkpoint

- Lit-selection growth is source-required but does not move the 42-cell
  witness; that causal hypothesis is falsified here.
- C clears mapped cell flags, so raw `+` remains `DOOR|D_NODOOR`; only `S`
  becomes `SDOOR|D_CLOSED`.  Both JS ASCII-map loaders currently make raw
  `+` closed, blocking sight out of Arc-goal's central chamber.
- Correct the shared raw-map masks and retain later explicit door directives
  as the owner of closed/locked states.  The replay peaked at **148,078,592
  bytes RSS**.

### 2026-07-29 seed0361 Arc-goal accepted checkpoint

- Raw `+` as `D_NODOOR` closes the 42-cell vision witness; lit selection
  growth remains as a separate source-faithful shared correction.
- Inputs **315--323** match RNG, decoded screens, and cursors.  Input 317 is
  **8,448/8,448** calls, with seven traps, 29 monsters, and the blessed +5
  Orb of Detection.
- The focused regression passes **1/1** at **160,694,272 bytes peak RSS**.
  Input **324+** is next; the last complete corpus remains **38/44**.

### 2026-07-29 seed0361 Arc-fila accepted checkpoint

- Inputs **324--333** match RNG, decoded screens, and cursors.
- Input 333 generates `Arc-fila.lua` at **4,226/4,226** calls through the
  existing six-room action runner; the result has six rooms, seven monsters,
  and four traps.
- The bounded replay peaked at **151,486,464 bytes RSS**.  Cached returns and
  the next goal revisit at input **334+** are next.

### 2026-07-29 seed0361 Arc-goal revisit checkpoint

- Inputs 334--338 are exact.  Input 339's cached goal return matches four
  placement calls, then lacks C's two quest.lua shuffle calls.
- C searches floor, monster inventory, and buried chains for the Quest
  artifact, emits `goal_next` or `goal_alt`, and increments `made_goal`;
  JavaScript currently suppresses all goal arrivals once `made_goal` is set.
- Add the shared artifact-presence/revisit branch and validate through input
  343.  This bounded run peaked at **151,568,384 bytes RSS**.

### 2026-07-29 seed0361 Arc-goal arrival-floor checkpoint

- The revisit branch makes input 339 exact at 6/6 calls and produces the
  first materialization More.
- C then runs `pickup(1) -> check_here()` at `[43,11]`; the single stack of
  two food rations forces pending `goal_next` to More and becomes the next
  line.  JS only checks arrival piles for migrated punishment objects.
- Add ordinary single-stack arrival description through topline continuation;
  do not force `goal_next` itself.  The run peaked at **149,962,752 bytes
  RSS**.

### 2026-07-29 seed0361 trapped-snake concealment checkpoint

- Arrival floor inspection fixes the second More and final food-ration line;
  RNG and cursors through 343 are exact.
- One glyph remains: game square `[29,12]` contains the source-created snake,
  scroll, and magic trap.  C refuses `hideunder()` at a non-pit trap, while JS
  marks the snake hidden whenever any object exists.
- Restore the shared `can_hide_under_obj` trap/coin predicate at birth; do not
  patch cache restore or the display glyph.

### 2026-07-29 seed0361 Arc-goal revisit accepted checkpoint

- Inputs **334--343** match RNG, decoded screens, and cursors.
- Input 339 is 6/6 calls; `made_goal=2`; tty owns materialization More then
  goal-next More; input 343 retains “You see here 2 food rations.”; the snake
  over the magic trap remains visible.
- The extended focused regression passes **1/1** at **162,627,584 bytes peak
  RSS**.  Input **344+**, with a large transaction at 347, is next.

### 2026-07-29 seed0361 bigrm-7 regression checkpoint

- Inputs **344--347** match RNG, decoded screens, and cursors.
- Input 347 generates `bigrm-7.lua` at **6,811/6,811** calls and leaves the
  expected special level cached at main-dungeon depth 10.
- The single bounded replay exited normally at **151,797,760 bytes peak RSS**.
  Input **348+** is next; input 352 is the next state-changing transaction.

### 2026-07-29 duplicate-suite containment recheck

- The user-provided diagnosis matches journal block 756: two equivalent full
  suites launched 35.8 seconds apart, yielded, and remained unowned until
  their workers reached roughly 192 GB and 178 GB and macOS jetsam removed
  them.
- A fresh live-process check finds no surviving Contest suite or corpus
  runner.  The MCP-server, Postgres-query, and literal jetsam-age theories
  remain falsified.
- Broad verification remains paused.  Continue only with one synchronous,
  focused, memory-bounded replay at a time and confirm process exit before
  starting another.

### 2026-07-29 seed0361 pre-Sokoban transaction checkpoint

- Inputs **344--351** match RNG, decoded screens, and cursors.
- The first post-incident managed replay exited synchronously at
  **154,517,504 bytes peak RSS**, and the post-run process check was clean.
- The exclusive slice stopped before input 352; that 71-call transaction is
  the next bounded witness.

### 2026-07-29 seed0361 Sokoban materialization checkpoint

- Input **352** matches **71/71** RNG calls, decoded screen, and cursor while
  materializing `soko1-1.lua` at dungeon coordinate 4:1.
- The resulting level has 34 monsters and 17 traps.
- The synchronous replay exited at **152,862,720 bytes peak RSS** with a clean
  post-run process check.  Inputs **353--364** are next.

### 2026-07-29 seed0361 input-354 informational-page checkpoint

- Input 353 remains exact.  Input **354** is the earliest difference: 0/0 RNG
  remains exact, but 460 decoded cells and the cursor differ.
- Later page differences at 358, 360, and 361 precede a downstream input-364
  RNG shortfall of **41/50**; diagnose the input-354 tty/command owner first.
- The bounded replay exited normally at **155,680,768 bytes peak RSS**, and
  no matching test process survived.

### 2026-07-29 seed0361 input-354 inventory-state checkpoint

- The same 11 objects exist in both engines; the page width differs because
  four descriptions differ.
- C omits “uncursed” for the bullwhip, marks Grayswandir in the right hand,
  marks the pick-axe as the alternate weapon, and knows the touchstone is
  uncursed.  JavaScript has the opposite selective BUC labels and no swap
  weapon annotation.
- Diagnose Archeologist initialization/object knowledge and `uswapwep`
  ownership before touching tty layout.  The bounded run peaked at
  **157,958,144 bytes RSS**.

### 2026-07-30 seed0361 input-354 source-owner checkpoint

- C marks all starting BUC state known; `implicit_uncursed` suppresses the
  adjective only for fully known charge/enchantment-bearing items, while an
  uncharged touchstone remains “uncursed.”
- C starting-inventory use treats the pick-axe as a weapon-tool, so it becomes
  `uswapwep` after the bullwhip.
- C primary-hand wording follows the wielded object and handedness, not a role
  whitelist.  Repair these shared owners before rechecking input 354.

### 2026-07-30 seed0361 input-354 inventory accepted checkpoint

- Input **354** now matches 0/0 RNG, decoded screen, and cursor.
- Shared `implicit_uncursed` projection produces the exact bullwhip,
  pick-axe, and touchstone wording; the starting pick-axe is `uswapwep`; and
  Grayswandir is the primary weapon in the right hand.
- The bounded replay exited at **157,138,944 bytes peak RSS** with a clean
  post-run process check.  Inputs **355--364** are next.

### 2026-07-30 seed0361 input-358 discoveries checkpoint

- Inputs **355--357** are exact.  Input **358** is the next difference:
  0/0 RNG and cursor match, but JavaScript starts an extra `Weapons` class
  where C starts `Armor`.
- Diagnose discovery registry membership and order before page rendering.
  The bounded replay peaked at **153,714,688 bytes RSS**.

### 2026-07-30 seed0361 Archeologist discovery-owner checkpoint

- The extra Weapons entries and cloak of displacement are legacy Ranger
  preknowledge; Archeologist falls through an unlabeled Ranger fallback.
- C gives Archeologist only sack and touchstone preknowledge, then marks those
  starting instances encountered in the later inventory pass.
- Add the explicit Archeologist branch at role initialization; do not filter
  the discoveries page.

### 2026-07-30 input-358 invalid diagnostic witness

- The first post-change replay finished, but its summary referenced `game`
  without importing it and raised after replay completion.
- This is a harness error and yields no parity verdict.  The process exited at
  **154,386,432 bytes peak RSS**, and the post-run process check was clean.

### 2026-07-30 seed0361 input-358 armor-order checkpoint

- Removing the false Ranger fallback cuts the page difference from 334 cells
  to **34**; RNG and cursor remain exact.
- The only remaining page defect is encounter order: JavaScript records
  hooded cloak before hard shoes, while C displays hard shoes first.
- Trace monster-equipment observation order; do not sort the discoveries page
  as a presentation patch.

### 2026-07-30 seed0361 dwarf armor-chain checkpoint

- The Mines-depth-9 dead-dwarf pile is cloak above shoes with expected reverse
  drop serials; surviving dwarves carry `[cloak, shoes]`.
- Both armor types are known, but JavaScript registered cloak before shoes.
  The chain itself is not the defect.
- Find the earliest look/naming/pile-observation command that registers them;
  do not reverse inventory or sort the final page.

### 2026-07-29 seed0361 monster-drop observation checkpoint

- Neither dwarf armor type is registered through input 240; the input-241
  kill registers both in JavaScript order `[cloak, shoes]`.
- C `relobj()` processes the newest-first minvent as shoes then cloak, and
  `mdrop_obj()` calls `distant_name(..., doname)` before every extraction.
  Adjacent visibility turns those otherwise silent names into object
  observations.
- Restore that pre-extraction side effect at the monster-drop boundary.  The
  pile chain and its visible cloak-then-shoes order are already correct.

### 2026-07-29 seed0361 discoveries accepted checkpoint

- Input **358** now matches 0/0 RNG, decoded screen, and cursor.
- The live Armor discovery order is `[iron shoes, dwarvish cloak]`, while the
  already-correct floor pile still displays cloak then shoes.
- The synchronous replay peaked at **150,503,424 bytes RSS** and left no
  matching process.  Input **360** is next.

### 2026-07-29 seed0361 attribute-stream checkpoint

- Input **360** differs only as `1 of 2` versus `1 of 3`; all preceding page
  content, RNG, and cursor are exact.
- Page 2 uses `silver saber`/Basic instead of `saber`/Unskilled and omits
  hallucination resistance, automatic searching, experience stealth, and
  silver-dragon-mail reflection.
- Repair live weapon/property projections, not pagination.  Input 364's
  41/50 RNG mismatch remains downstream.

### 2026-07-29 seed0361 attributes accepted checkpoint

- Inputs **360--361** now match RNG, decoded screens, and cursors; their
  `1 of 3` and `2 of 3` footers come from the unchanged 23-row paginator.
- Enlightenment reads saber skill level 1, Grayswandir's wielded
  hallucination resistance, intrinsic searching, experience stealth, and
  worn-mail reflection from live state and provenance.
- The focused replay peaked at **153,468,928 bytes RSS** and exited cleanly.
  Input **364** is the next gameplay-RNG frontier.

### 2026-07-30 seed0361 input-364 mimic checkpoint

- Input 363 is exact; input **364** starts C at `rn2(3)=0` but JavaScript at
  `rn2(6)=3`, then totals 50 versus 41 calls with an exact visible screen.
- The nearby complete-ration actor is a hostile giant mimic at `(50,8)`.
  C's `restrap()` owns the missing `rn2(3)` for an unseen `M1_HIDE` actor.
- Inspect visibility and mimic concealment state before changing movement;
  never inject the nine-call suffix.

### 2026-07-30 seed0361 input-364 restrap falsification

- The JavaScript mimic is unseen but still has `m_ap_type=2`; C `restrap()`
  would short-circuit that state before `rn2(3)`.
- Current visibility and the empty floor square are not the missing-call
  owner.
- Compare pre/post second-search movement ration and disguise state to decide
  between earlier mimic-state drift and allocation drift.

### 2026-07-30 seed0361 input-364 source-owner checkpoint

- The C annotation proves call 0 is `restrap(mon.c:4667)`; the following
  calls are doppelganger shapechange selection/construction.
- JavaScript returns the unseen `(50,8)` giant mimic as already hidden with
  zero calls because `m_ap_type=2`.
- Check its `cham` identity: a temporary giant-mimic form must not receive
  native `makemon()->set_mimic_sym()` disguise state.

### 2026-07-30 seed0361 input-364 actor correction

- A bounded instrumented C replay identifies call 0's actor as sleeping rock
  piercer id 665 at `(34,17)`, not the giant mimic.  All JavaScript giant
  mimics are native; the doppelganger is a separate grid bug.
- C attempts hider `restrap()` after movement debit but before `dochug()`
  checks sleep.  JavaScript checks sleep first and loses `rn2(3)`.
- Move helpless/sleeping handling behind the shared pre-`dochug()` hider,
  eel, and Conflict phases.  The expected result is that the shifted next
  roll triggers the existing doppelganger change naturally.

### 2026-07-30 C recorder isolation recovery

- The managed PTY replay was terminated at its final `Dump core?` prompt and
  left no process, but Ctrl-C interrupted its EXIT restoration trap.
- All 14 original `502wizard.*` files were recovered explicitly from the
  temporary hold directory with their prior sizes and timestamps.
- Future isolated recorder runs require an independent post-signal recovery
  command; do not treat an EXIT trap as the restoration witness.

### 2026-07-30 seed0361 session accepted

- Frozen/sleeping handling now occurs after hider, eel, and Conflict phases,
  matching the `movemon_singlemon()` to `dochug()` boundary.
- Input 364 matches 50/50 RNG calls, screen, and cursor; the focused
  inputs-344--364 regression passes 1/1.
- A complete engine-only replay of seed0361 matches all 53,865 RNG calls and
  all 366 screens/cursors.  This is a session witness, not a replacement for
  the last safe 38/44 corpus measurement.

### 2026-07-30 seed0373 input-43 frontier

- Seed0373 is exact through input 42.  At input 43 the first four generation
  calls match, then C enters `lspo_replace_terrain` with `rn2(100)` while
  JavaScript enters later small-denominator generation.
- Input 43 totals are 2,509 versus 1,609 RNG calls with a different screen and
  cursor.
- Inspect the selected Barbarian special-level Lua operation stream and
  `des.replace_terrain` implementation before changing map cells or counts.

### 2026-07-30 seed0373 Barbarian special-level checkpoint

- `Bar-strt` inputs **43--44**, `Bar-loca` inputs **55--56**, and the
  `Bar-fila`/`Bar-filb` witnesses at inputs **60**, **63**, and **66** now
  match C in RNG, decoded screen, and cursor.
- The filler-only corner glyph at input 63 belonged to the loader's universal
  `wallification()` pass.  It was not evidence that `mkmap(..., walled=true)`
  should call more than its provisional `wallify_map()` pass.
- Treat the loaded Lua file as an ordered operation program; keep the
  `wallify_map`/`wallification` ownership boundary explicit when adding more
  special levels.

### 2026-07-30 seed0373 bigrm-8 checkpoint

- Input **73** selects `bigrm-8.lua` and now matches **7,077/7,077 RNG
  calls**, every decoded screen cell, and the cursor.
- The source-shaped graph includes the 40-percent terrain branch, selection
  lighting, stairs, fifteen objects, six traps, twenty-eight monsters,
  universal wallification, and level flips.
- The focused replay completed in **0.22 seconds** at **138,182,656 bytes
  maximum RSS** and left no runner.

### 2026-07-30 seed0373 soko1-2 shared-constructor checkpoint

- Input **78** selects `soko1-2.lua` and now matches **6,538/6,538 RNG
  calls**, every decoded screen cell, and the cursor.
- Two later divergences exposed shared constructor defects: long-worm tail
  creation must consume its segment shuffles and reserve generation cells,
  and an orc captain's winning weapon roll must continue through the common
  offensive-item helper.
- Generation occupancy, flip, and screen projection are now represented.
  Runtime long-worm tail movement and interaction remain a separate parity
  surface and are not proven by this materialization witness.
- The focused replay completed in **0.27 seconds** at **138,133,504 bytes
  maximum RSS** and left no runner.

### 2026-07-30 seed0373 soko2-1 object-location checkpoint

- Input **83** selects `soko2-1.lua` and now matches **344/344 RNG calls**,
  every decoded screen cell, and the cursor.
- C's `get_location(DRY)` rejects floor already occupied by a boulder.
  Applying that predicate to shared unpositioned `des.object()` sampling
  restored the one rejected coordinate and all later constructors.
- The focused replay completed in **0.24 seconds** at **139,919,360 bytes
  maximum RSS** and left no runner.

### 2026-07-30 seed0373 bounded-session snapshot and next frontier

- The session is exact through input **87** and currently matches **116/124
  RNG**, **92/124 decoded-screen**, and **102/124 cursor** boundaries.
- Input **88** has the exact special-level preamble, then C constructs fixed
  objects while JavaScript falls through to ordinary generation.  The next
  bounded task is to identify the selected `soko3` variant and supply its
  layout to the existing fixed-puzzle runner.
- The snapshot completed in **0.32 seconds** at **173,293,568 bytes maximum
  RSS**.  No full corpus was run; **38/44** remains the last accepted
  engine-only public baseline.
- Following the duplicate-runner OOM incident, verification remains limited
  to one synchronous, explicitly named replay with process-table checks
  before and after.  Do not launch `npm test`, a full `node --test` command,
  or a second yielded runner until the unsafe whole-session assertions have
  been redesigned.

### 2026-07-30 seed0373 focused regression accepted

- The named engine-only regression
  `seed0373 composes Barbarian and Sokoban Lua graphs through soko2` checks
  inputs **43, 44, 55, 56, 60, 63, 66, 73, 78, and 83** and passes **1/1**.
- Runtime was **0.30 seconds**, maximum RSS was **151,896,064 bytes**, and
  explicit process checks before and after found no surviving runner.
- This is a bounded local regression witness only.  It does not replace the
  **38/44** full-corpus baseline or prove the unimplemented Soko3 boundary.

### 2026-07-30 seed0373 soko3-1 accepted

- Input **88** selects `soko3-1.lua` and now matches **394/394 RNG calls**,
  every decoded screen cell, and the cursor.
- The fixed Lua graph exposed a shared origin bug: C centers against even
  `x_maze_max=78`, while JavaScript used 79.  The difference first becomes
  visible for this 29-column map, moving its odd origin from C's 25 to 27.
- The port now retains the script's monster-generation exclusion as
  persistent per-level state, transforms it with level flips, and applies it
  to future random monster placement.
- The renamed through-Soko3 regression passes **1/1** in **0.33 seconds** at
  **153,010,176 bytes maximum RSS**, with no surviving runner.  The next
  frontier must come from one seed0373-only audit, not the full corpus.

### 2026-07-30 seed0373 soko4-2 accepted

- Input **93** selects `soko4-2.lua` and matches **136/136 RNG calls**,
  every decoded screen cell, and the cursor.
- The shared puzzle runner now carries hardfloor, an explicit branch region,
  two persistent monster-generation exclusions, twelve boulders, twelve
  traps, and two fixed earth scrolls before the standard random objects.
- The branch region is transformed with the level and consumed later by
  `fixup_special()`; it is not an immediate map object.
- The through-Soko4 regression passes **1/1** in **0.33 seconds** at
  **152,125,440 bytes maximum RSS**, with no surviving runner.

### 2026-07-30 seed0373 Plane of Fire accepted

- Input **98** now preserves the source wizard menu's unreachable
  `dummy: 0` row while rejecting it as a destination.
- Input **99** constructs the wizard-granted Amulet before destination
  generation, retains the prerequisite pager on the departing Soko4 screen,
  and then executes the complete `fire.lua` operation graph.
- The accepted Fire state contains the reflected 79-by-21 map, **40** fire
  traps, one named portal to Water, **62** Lua monsters plus the arriving
  follower, five boulders, and the hero at **(8,16)**.
- Default special-level flipping precedes delayed portal fixup.  Arrival then
  runs `fumaroles()` after follower collision; this witness consumes nine
  sampling calls and creates no gas region.
- Input 99 matches **2,358/2,358 RNG calls**, every decoded screen cell, and
  the cursor.  The focused through-Fire regression passes **1/1** in **0.28
  seconds** at **154,812,416 bytes maximum RSS**, with no surviving runner.
- The next frontier begins at input **100**, where the Fire redraw and
  endgame arrival messages cross the Wizard/intervention, special-message,
  temperature, and one-time Amulet-wish lifecycle boundaries.

### 2026-07-30 seed0373 Plane of Fire arrival accepted

- Inputs **100--105** now match every RNG call, decoded screen cell, and
  cursor.  Input 100 consumes the exact **54-call** Wizard resurrection graph;
  inputs 101--105 page the appearance, booming voice, heat, Amulet-wish
  announcement, and wish prompt in source order.
- The revived Wizard of Yendor is the real species **285**, appears at
  **(9,17)** with level **30** and **174 HP**, is hostile, and owns its
  defensive inventory.  The one-time Amulet wish is scheduler-owned and sets
  `uevent.amulet_wish`.
- The repeated 142-cell screen delta was shared projection, not Fire-map
  generation: `vision_recalc()` now applies radius-one temporary light from
  all `emits_light()` monster classes, and status uses the source endgame
  depth mapping to display `Fire`.
- The named through-arrival regression passes **1/1** in **0.33 seconds** at
  **152,535,040 bytes maximum RSS**, with no surviving runner.  The next
  bounded frontier starts at input **106**; no full corpus was run and
  **38/44** remains the last accepted engine-only baseline.

### 2026-07-30 seed0373 empty Amulet wish accepted

- Escape at input **106** is normalized to an empty wish, not cancellation.
  `readobjnam()` selects one of thirteen non-specific wish classes and then
  uses ordinary object construction.
- Inputs 105 and 106 now match RNG, decoded screen, and cursor.  The focused
  run completed in **0.26 seconds** at **142,360,576 bytes maximum RSS** and
  left no runner.

### 2026-07-30 seed0373 Plane of Air frontier

- Inputs 107--109 are exact.  Input **110** commits `-2`; C interprets this
  as relative endgame level 4 (Air), while the prior JavaScript validator
  rejected every non-positive value.
- The C input-110 graph has **2,907** calls: Air Lua population, two final
  flip calls, setup of 66 persistent clouds before portal placement, arrival,
  and one initial bubble-movement pass before vision reset.
- The source-shaped Air and elemental-cloud owners are implemented but not
  yet accepted.  Verification remains one synchronous input-110 replay with
  process checks; no public corpus is permitted under the OOM guard.
- First replay result: correct `air.lua` destination, but only
  **1,840/2,907** calls.  The earliest mismatch is call **128** inside the
  first Air-elemental constructor (`rnd(2)` versus C `rn2(76)`), before any
  bubble setup.  Later Air state is not accepted until this shared constructor
  divergence is resolved.
- The RNG graph is now accepted at **2,907/2,907** after restoring
  amphibious-floater humidity fallback, rejecting `CLOUD` for portal
  `bad_location()`, and making `iswiz` a dedicated Amulet-pursuit follower.
  Special-level pager delivery, Air/cloud projection, and tty blank-run
  serialization are now accepted too.
- Input **110** matches all RNG calls, every decoded screen cell, and cursor
  **(74,0)**.  The accepted state has **66** bubbles, **52** actors including
  the pet and Wizard, hero position **(18,4)**, and a portal back to Fire.
- The focused through-Air regression passes **1/1** in **0.35 seconds** at
  **150,437,888 bytes maximum RSS**, with clean process tables before and
  after.
- A bounded 124-input audit is exact in all **124/124 RNG** slices and had
  three presentation-only failures at inputs **116, 118, and 119**.
  Input 112 became exact after restoring the real Amulet's inventory
  presentation, Samurai-only `wakizashi` naming, and generated bimanual weapon
  metadata.
- Input **116** is exact after removing Barbarian's accidental Ranger legacy
  discovery projection and recording the real Amulet at the endgame
  `prinv()` observation boundary.  The page now follows C's class-local
  `disco[]` insertion order without renderer sorting.
- Inputs **118--119** are exact after centralizing endgame level naming,
  granting Air maximum carrying capacity, restoring Barbarian starting-weapon
  skills, projecting innate poison resistance, and placing armor magic
  cancellation in C property order.
- The corrected full seed0373 engine-only audit is exact at **124/124 RNG
  slices, screens, and cursors**.  An intermediate 87/124 RNG report was an
  invalid comparator result caused by an over-escaped callsite-normalization
  regex; it did not indicate engine drift.
- The permanent seed0373 full-session named regression passes **1/1** in
  **0.36 seconds** at **153,665,536 bytes maximum RSS**, with no surviving
  runner.
- No full corpus was run, so **38/44** remains the last accepted engine-only
  baseline.

### 2026-07-30 seed0108 extended-command rub and ranged continuation accepted

- Recorder indices **9--31** now match every RNG slice, decoded screen cell,
  and cursor under the real engine.
- `#ru` paints the `rub` autocomplete suffix without advancing the cursor
  past the physical prefix.  Return dispatches `apply.c:dorub()` and opens the
  exact eligible-object prompt.
- Selecting the unwielded wished lamp installs it as `uwep`, queues a canned
  rub, and spends a hero action.  The goblin's ranged attack clears that queue
  through the shared `stop_occupation()` boundary, so no genie branch runs.
- Magic/oil lamp constructors now retain their source `spe`, age, and
  `lamplit` state without changing constructor RNG.
- The shared ranged path now uses an unseen missile's shuffled appearance,
  retains `tmp_at()`'s last flight glyph across tty `--More--`, projects
  pre-hit HP on that pager, and exercises Strength after dismissal.
- The focused engine-only regression passes **1/1** in **0.24 seconds** at
  **134,856,704 bytes maximum RSS**, with no surviving runner.
- No full corpus was run; **38/44** remains the last accepted baseline.  The
  next bounded seed0108 frontier begins after index 31.

### 2026-07-30 seed0108 self-throw and cream-pie blindness accepted

- Recorder indices **9--56** now match every RNG slice, decoded screen cell,
  and cursor under the real engine.
- `.` is a valid self direction; throwing rejects it after selection without
  consuming the wished pie or a turn.
- The shared apply selector now includes cream pies.  Using one records the
  exact blindness duration, `ucreamed`, immediate blind vision repaint, tty
  continuation, and post-acknowledgement deletion draw.
- The focused engine-only regression passes **1/1** in **0.23 seconds** at
  **140,263,424 bytes maximum RSS**, with no surviving runner.
- No full corpus was run; **38/44** remains the last accepted baseline.  The
  next bounded seed0108 frontier begins after index 56.

### 2026-07-30 seed0108 complete exact-session closure

- A bounded full engine replay matches **303/303 RNG slices, 303/303 decoded
  screens, and 303/303 cursors**.
- The replay completed in **0.31 seconds** at **124,059,648 bytes maximum
  RSS**, and no Contest runner survived it.
- This closes the public seed0108 witness but does not exercise the separate
  uninterrupted magic-lamp release branch.
- No full corpus was run; **38/44** remains the last accepted aggregate
  baseline and no held-out generalization claim follows from this one seed.

### 2026-07-30 seed0014 complete exact-session closure

- A bounded engine replay matches **714/714 RNG slices, 714/714 decoded
  screens, and 714/714 cursors**.
- The historical fountain/exploration failure is therefore stale in the
  current tree; shared repairs now compose through the complete transcript.
- The replay completed in **0.49 seconds** at **154,124,288 bytes maximum
  RSS**, and no Contest runner survived it.
- No full corpus was run; **38/44** remains the accepted aggregate baseline.

### 2026-07-30 seed0030 ten-segment exact-session closure

- The session has ten independent life segments totaling **1,953 inputs**.
  Replaying only the first 79 inputs is not a valid complete-session witness.
- Each segment was run in its own sequential process; all **1,953/1,953 RNG
  slices, decoded screens, and cursors** match across seeds 31--40.
- The isolated sequence completed in **2.32 seconds total wall time** and left
  no Contest runner.
- Every session in the stale 38/44 failure list now has a current bounded
  exact witness, but no full-corpus or held-out claim has been made.

### 2026-07-30 supplemental C oracle exposes real djinni-release gap

- A C-recorded seed108 extension reaches uninterrupted magic-lamp release at
  input **79** after repeated direct rubs.
- JavaScript matches `rn2(3)=0` but then skips the lamp transformation and
  djinni birth.  C next consumes `rn2(500)=332`, shared adjacent-ring
  placement, the full ordinary djinni constructor, and only then `rn2(5)` for
  disposition.
- The authoritative screen is `In a cloud of smoke, a djinni emerges!  The
  djinni speaks.--More--`; the oracle continues through the debt/wish path.
- This is a supplemental source-faithful coverage witness, not hidden-judge
  evidence and not a public-corpus update.

### 2026-07-30 seed0360 complete exact-session closure

- A bounded engine replay matches **833/833 RNG slices, 833/833 decoded
  screens, and 833/833 cursors**.
- Initial inventory, debug level transitions, special-level generation, and
  arrivals therefore compose through the complete recorded world tour.
- The replay completed in **0.57 seconds** at **172,343,296 bytes maximum
  RSS**, and no Contest runner survived it.
- No full corpus was run; **38/44** remains the accepted aggregate baseline.

### 2026-07-30 supplemental djinni debt and wish path accepted

- The new shared implementation matches the C extension at **91/91 RNG
  slices, 91/91 decoded screens, and 91/91 cursors**.
- Acceptance includes lamp transformation, the complete ordinary djinni
  constructor, emergence pager, debt pager, inventory-removal draws,
  temporary removed-actor glyph, verbose wish announcement, dagger wish,
  lamp identification, and resumed elapsed turn.
- The permanent named regression passes **1/1** in **0.23 seconds** at
  **128,303,104 bytes maximum RSS**.  Public seed0108 remains **303/303 exact
  on all channels** in a separate bounded replay.
- The first test attempt exposed only a missing `OIL_LAMP` test import; engine
  behavior was unchanged, the corrected test passes, and no runner survived.
- This accepts the blessed debt branch.  Uncursed and cursed disposition
  outcomes remain explicit coverage gaps; no corpus or hidden-judge claim has
  been made.

### 2026-07-30 uncursed hostile and cursed peaceful djinni paths accepted

- The uncursed seed109 C oracle matches **108/108 RNG slices, screens, and
  cursors**, including the composed wield-plus-puff topline and raw chance-4
  hostile outcome.
- The cursed seed108 C oracle matches **106/106 on all channels**, including
  raw `rn2(5)=0`, the cursed-only `rn2(4)=2` remap, and peaceful outcome.
- The permanent focused regression passes **1/1** in **0.25 seconds** at
  **128,040,960 bytes maximum RSS**.  Public seed0108 remains **303/303 exact
  on all channels** after the tty ownership change.
- Raw outcomes 1 and 3, tame and vanish, remain uncovered.  No corpus,
  hidden-judge, publication, or submission claim has been made.

### 2026-07-30 tame and vanish djinni outcomes accepted

- Seed112 proves that raw disposition 1 exists, but it was rejected as an
  acceptance witness because its starting-pet stream diverges at input 40,
  twelve boundaries before release.  A `pettype:none` seed107 probe was also
  rejected because that option exposes an earlier initialization divergence.
- A normal-game seed105 C oracle releases a raw-chance-1 djinni on its first
  rub.  The 41-boundary branch witness was already exact; extending it by
  twelve wait commands exposed the missing `tamedog()` state and then the
  missing `dog_move()` tame-allies guard.
- The source-shaped implementation now creates a non-domestic `mtame=5`
  actor with a complete shared `edog`, increments conduct, and skips attacking
  the tame kitten while Conflict is inactive.
- The extended tame oracle matches **3,444/3,444 RNG calls, 53/53 decoded
  screens, and 53/53 cursors** in **0.24 seconds** at **126,763,008 bytes
  maximum RSS**.
- The independent seed110 vanish oracle remains exact at **2,704/2,704 RNG
  calls and 108/108 screen/cursor boundaries** in **0.24 seconds** at
  **127,156,224 bytes maximum RSS**.
- Focused tame and disposition regressions each pass **1/1**.  All five raw
  djinni outcomes now have C-recorded witnesses, but no full corpus or hidden
  judge was run; **38/44** remains the accepted aggregate baseline.

### 2026-07-30 correction: seed0108 was not engine-closed

- The earlier **303/303 exact** seed0108 custom replay left the fixture
  shortcut enabled.  It was a public fixture-regression witness, not an
  engine-only measurement; the corresponding complete-closure claim is
  superseded without rewriting the older entry.
- With `TELEPORT_DISABLE_FIXTURES=1`, the first live-engine divergence was
  input **62**, `#wipe`.  The source-shaped wipe occupation and controlled
  gnome/red-dragon polymorph transition now make inputs **0--120** exact on
  every per-input RNG slice, decoded screen, and cursor.
- The complete fixture-disabled session currently measures
  **2,917/16,958 RNG, 125/303 screens, and 240/303 cursors**.  The active
  frontier is input **121**: C performs a second global allocation cycle
  because red-dragon speed 9 does not restore a full 12-point movement ration,
  while JavaScript's level-gated source loop stops after the first cycle.
- No full corpus was run.  **38/44** remains the last accepted aggregate
  baseline and no held-out generalization claim follows from this repair.

### 2026-07-30 seed0108 red-dragon movement ration accepted

- A level-1 debug hero now enters the source movement-ration loop while
  polymorphed.  Red-dragon speed 9 therefore requires the same second
  monster/global cycle as C at input **121**.
- The moved goblin's distant `mattacku()` now evaluates negative AC and then
  performs `find_offensive()->m_lined_up()` before the attack table.  Input
  121 matches **74/74 RNG calls**, screen, and cursor.
- The permanent named regression passes **1/1** at **130,023,424 bytes
  maximum RSS**.  A bounded complete-session comparison has **282/303 exact
  per-input RNG slices, 149/303 exact screens, and 257/303 exact cursors**.
- The next frontier is input **141** (`#invoke` autocomplete), followed by
  the selection prompt at input 147 and the first missing elapsed-turn RNG at
  input 148.  No corpus or held-out judge ran.

### 2026-07-30 seed0108 Mjollnir invocation accepted

- `set_mon_data()` now prorates unused hero movement only when a new form is
  slower.  Human 12 to gnome 6 changes the stored ration to 6; gnome 6 to red
  dragon 9 preserves it.
- `#invoke` autocompletes from `i`, suggests artifact `p`, and routes
  Mjollnir's source `inv_prop == 0` through `Nothing happens.` plus an elapsed
  turn.  Inputs **140--150** match every RNG slice, screen, and cursor.
- The invoke and movement-ration named regressions each pass **1/1** under
  fixture disablement.  Nonzero artifact invocation powers are mapped but not
  accepted as implemented.
- The next frontier is input **167**, where a wished chest's unknown BUC state
  must not appear in drop prose.  No full corpus was run.

### 2026-07-30 seed0108 chest drop and resumed pet combat accepted

- `drop()->doname()` now exposes BUC only when `bknown` and weapon/armor
  enchantment only when `known`; the wished chest is therefore `a chest`.
- `dog_invent()` pickup/drop resumption now retains visible `mattackm()`
  deferral.  A fatal bite installs its attack line before damage, then the
  death pline forces tty to page the pending pickup-plus-bite line.
- Inputs **165--170** match every fixture-disabled RNG slice, decoded screen,
  and cursor.  The focused regression passes **1/1** in **0.23 seconds** at
  **128,401,408 bytes maximum RSS**, and no runner survived.
- The next seed0108 frontier will be selected by a single bounded engine-only
  comparison.  No corpus or held-out judge ran; **38/44** remains the accepted
  aggregate baseline.

### 2026-07-30 seed0108 next frontier selected at `#loot`

- A complete fixture-disabled selector now has **283/303 exact RNG slices,
  192/303 exact screens, and 244/303 exact cursors**.
- The earliest mismatch is input **173**, where C autocompletes `#lo` to
  `# loot`; cursor and RNG are still exact there.
- The first downstream cursor and RNG mismatches are inputs 191 and 192.
  Treat them as consequences until the `doloot()` graph is mapped and tested.
- The selector took **0.36 seconds** at **140,902,400 bytes maximum RSS** and
  left no runner.  No corpus or held-out judge ran.

### 2026-07-30 seed0108 extended-command capability block accepted

- In debug mode, `#l` remains ambiguous; physical `#lo` uniquely
  autocompletes to `# loot`.
- `doloot_core()` now rejects a no-hands form before looking for containers.
  `could_untrap()` checks heavy encumbrance, no-hands except webmakers, and
  zero natural movement before opening the direction reader.
- Inputs **171--206** match every engine-only RNG slice, screen, and cursor.
  The focused regression passes **1/1** in **0.25 seconds** at
  **134,955,008 bytes maximum RSS** and leaves no runner.
- The next frontier is input **207**, the `newman()` path selected by
  controlled `#polyself human`.  No corpus or held-out judge ran.

### 2026-07-30 seed0108 controlled `newman()` block accepted

- Generic `human` is a deliberate illegal-monster placeholder in controlled
  polymorph.  It now routes through `newman()->polyman()` instead of
  installing PM_HUMAN as a monster form.
- Startup retains the initial HP/power increments needed to subtract the old
  body's level-zero rolls.  The source transaction rebuilds level, XP, HP,
  power, hunger, and saved human form in the expected 14-call order.
- Input **207** matches the complete fixture-disabled RNG slice, screen, and
  cursor.  The focused regression passes **1/1** in **0.23 seconds** at
  **128,270,336 bytes maximum RSS** and leaves no runner.
- The next bounded frontier is after input 207 in the human `#loot` sequence.
  No corpus or held-out judge ran; **38/44** remains the accepted aggregate
  baseline.

### 2026-07-30 seed0108 `doopen()` cancellation accepted

- `doopen_indir()` reaches direction input through `get_adjacent_loc()`.
  A failed `getdir()` therefore clears the prompt and emits `Never mind.`;
  direct `doclose()->getdir()` remains a distinct silent-cancel contract.
- Inputs **208--217** match every fixture-disabled RNG slice, screen, and
  cursor.  The focused regression passes **1/1** in **0.27 seconds** at
  **128,466,944 bytes maximum RSS** and leaves no runner.
- Re-select after input 217 before treating the previously observed
  input-234 force-lock activity as causal.  No corpus or held-out judge ran.

### 2026-07-30 seed0108 blunt force-lock occupation accepted

- `doforce()` now marks the floor chest lock known, owns its `ynq` prompt,
  and installs a repeated `forcelock` occupation only after `y`.
- Mjollnir uses the blunt branch with chance 8.  Each callback validates the
  floor box and weapon, wakes nearby monsters, rolls success, and eventually
  breaks/unlocks the chest.
- Inputs **218--236** match every fixture-disabled RNG slice, screen, and
  cursor.  The input-236 success owns **234/234 exact RNG calls** and composes
  with the pending kitten-drop line.
- The focused regression passes **1/1** in **0.23 seconds** at
  **128,516,096 bytes maximum RSS** and leaves no runner.  Blade forcing and
  destroyed-container content scatter remain separate blocks; no corpus or
  held-out judge ran.

### 2026-07-30 seed0108 container category cancellation accepted

- `query_category()` now derives container classes from canonical `oclass`
  and orders them by NetHack's default inventory-class order.  The witnessed
  chest therefore exposes Comestibles, Potions, and Rings rather than
  Comestibles plus a collapsed `Other`.
- B/U/C/X qualifier rows now come from actual `bknown` and bless/curse state;
  the witness exposes only `X`.  The independent `A` row retains its selected
  state across redraw.
- Escape from the category menu returns `ECMD_OK`; the cancelled `#loot`
  no longer advances the scheduler.  Inputs **237--245** match every
  fixture-disabled RNG slice, screen, and cursor.
- The focused regression passes **1/1** in **0.27 seconds** at
  **128,450,560 bytes maximum RSS** and leaves no runner.  Auto-select
  transfer behavior remains outside this accepted cancellation witness; no
  corpus or held-out judge ran.

### 2026-07-30 seed0108 `#tip` floor-container cancellation accepted

- Extended-command dispatch now reaches `pickup.c:dotip()`'s floor-first
  container boundary.  The single broken chest owns the exact `ynq` prompt.
- `q` returns zero-time without entering `tipcontainer()`.  Tty retains the
  resolved prompt as display-only state for input 251, then the next
  `rhack()` read clears it at input 252.
- Inputs **246--252** match every fixture-disabled RNG slice, screen, and
  cursor.  The focused regression passes **1/1** in **0.30 seconds** at
  **128,499,712 bytes maximum RSS** and leaves no runner.
- The yes/spill branch, multiple-floor-container choice, and carried-object
  selection remain separate blocks; no corpus or held-out judge ran.

### 2026-07-30 seed0108 `#annotate` mapseen transaction accepted

- Physical `#an` now uniquely autocompletes to `# annotate`, which dispatches
  into the same current-level annotation owner already used by `#name`.
- The printable line editor stores whitespace-normalized text on the active
  level's mapseen-equivalent record; empty input preserves an old value while
  space-only input deletes it.
- Inputs **253--267** match every fixture-disabled RNG slice, screen, and
  cursor; the active level stores `Test`, and the command remains zero-time.
- The focused regression passes **1/1** in **0.28 seconds** at
  **128,663,552 bytes maximum RSS** and leaves no runner.  No corpus or
  held-out judge ran.

### 2026-07-30 seed0108 `#herecmdmenu` self-action menu accepted

- Physical `#he` now uniquely autocompletes to `# herecmdmenu`.  The corner
  menu derives its nine rows from the live hero square, broken floor chest,
  inventory, and known spell rather than from a session snapshot.
- Creating the temporary menu clears `WIN_MESSAGE`; Escape restores the
  blank underlay and hero cursor.  Inputs **268--281** match every
  fixture-disabled RNG slice, decoded screen, and cursor.
- The focused regression passes **1/1** in **0.25 seconds** at
  **129,056,768 bytes maximum RSS** and leaves no runner.  Dispatch for a
  selected action remains a separate, unwitnessed branch.

### 2026-07-30 seed0108 Sokoban/attributes/look tail and session accepted

- Wizard level-menu key `B` selects `soko1-1.lua`, not fakewiz1.  The shared
  floor-object namer now calls the arrival object a boulder, while Sokoban
  walls use ordinary foreground and C's ASCII cross/up/down-tee `-` glyphs.
- The complete Wizard skill table leaves hammer restricted and promotes the
  startup quarterstaff to Basic, restoring
  `You have no skill with hammer.` on attributes page 2.
- `dolook()->look_here()` now uses the same priced one-object naming owner as
  arrival and floor presentation; final `:` reports
  `You see here a boulder.` rather than leaving the topline blank.
- The permanent named engine-only regression compares each input separately
  and passes **1/1** with **303/303 RNG slices, 303/303 decoded screens, and
  303/303 cursors** exact in **0.42 seconds** at **138,199,040 bytes maximum
  RSS**.  No full corpus or held-out judge ran; **38/44** remains the accepted
  aggregate baseline.

### 2026-07-30 verifier OOM incident and process contract

- Two duplicate full Contest suites were launched 35.8 seconds apart, yielded,
  and abandoned without waiting or termination.  Their workers reached about
  192 GB and 178 GB after roughly 56--57 minutes.
- The responsible command trees are identified; MCP-server, unbounded
  Postgres-query, and misread jetsam-lifetime theories are falsified.  The
  exact retained worker object remains a separate localization task.
- Every parity run now has a pre-check, one owned process, bounded output,
  retained yield/session ownership, a measured elapsed/RSS result, and a
  post-check.  Whole-session flattened RNG assertions are prohibited.

### 2026-07-30 red corpus recovery reaches a 39/44 focused prediction

- One process-safe full engine-only gate measured a red **21/44** after
  cross-session regressions.  It ran once, sequentially, in 11.99 seconds at
  201,195,520 bytes maximum RSS and left no worker.
- Source repairs recovered ASCII/DEC Sokoban wall policy, all thirteen role
  skill tables, coin BUC classification through `goldX`, swallowed and
  non-verbose hit punctuation, startup `skill_init()`, and negative
  hero-movement clamping.
- Seed0116, seed0361, seed0383, and seed4500 are complete exact-RNG controls
  again.  Seed4500 now matches **108,275/108,275 RNG calls and 1814/1814
  screens/cursors**.
- A sequential cross-role/control gate passes **21/21** explicit sessions in
  5.94 seconds at 202,686,464 bytes maximum RSS.  Focused evidence predicts
  **39/44**; this is not yet a replacement full-corpus measurement.
- The next portfolio is the five RNG-red sessions: seed0004, seed0014,
  seed0030, seed0360, and seed0367.  No normal suite, held-out judge, stage,
  commit, push, publication, or submission ran.

### 2026-07-30 seed0367 returns to exact through shared source boundaries

- Wizard position teleport now derives static-Lua temple membership from room
  geometry, then suspends inside shared `intemple()` between the eerie and
  ghost-gate rolls.  The adapter no longer duplicates temple RNG or prose.
- Accepted `getdir()` input clears the physical direction prompt from logical
  tty ownership, and `dochat()` clears the target's complete wait mask before
  quest dialogue.  The same Arch Priest therefore participates in the elapsed
  actor scan after assigning the quest.
- Cleric BUC knowledge remains durable, while `implicit_uncursed` suppresses
  the neutral adjective at inventory projection.
- The complete fixture-disabled seed0367 replay is exact across all **324**
  per-input screens, cursors, and RNG slices.  Focused evidence now predicts
  **40/44**; no new full corpus or held-out score has measured that prediction.

### 2026-07-30 seed0004 returns to exact through pet and loot continuations

- A reluctant pet move now suspends inside visible bear-trap handling.  The
  trapped flag commits before tty paging, while trap damage and the actor tail
  resume only after the pager is dismissed.
- Taking from a previously unknown empty bag now tests `cknown` before setting
  it and returns a timed container transaction, matching
  `use_container()`'s information-gain contract.
- The permanent loot regression compares RNG per input rather than flattening
  the transcript.  It passes **1/1** in **0.33 seconds** at **142,163,968
  bytes maximum RSS**.
- The complete fixture-disabled seed0004 replay is exact across all **409**
  per-input screens, cursors, and RNG slices in **0.36 seconds** at
  **138,526,720 bytes maximum RSS**.  Focused evidence now predicts **41/44**;
  no new full corpus or held-out score has measured that prediction.

### 2026-07-30 seed0360 reopened at the Castle Lua boundary

- This corrects the earlier exact-session closure without deleting it:
  fixture-disabled seed0360 is exact only through input **158** on the current
  tree.
- Input 159 should run `castle.lua` and consumes **14,103** RNG calls.  The
  missing JavaScript dispatcher falls through to an ordinary level, consumes
  **2,882**, and places the hero on the wrong side of an unrelated map.
- The earliest call difference is source-discriminating: C begins Castle's
  four-element object-class shuffle with `rn2(4)=2`; JavaScript invents
  `rn2(2)=0` for default lighting even though `LVLINIT_MAZEGRID` has no
  lighting draw.
- The C/Lua architecture map now treats Castle as an ordered operation graph:
  map, shuffles, objects and nested contents, traps, monsters, mazewalks,
  regions, finalization, special-room fill, and arrival.  No corpus or
  held-out judge ran.

### 2026-07-30 Castle input 159 closes exactly

- Fixture-disabled seed0360 input **159** now matches all **14,103** RNG
  calls, the decoded screen, and cursor `(3,6)`.
- The shared fixes include native `mk_gen_ok()` placeholder/gone eligibility,
  the two stocked maze walks, split `Can_dig_down`/`Can_fall_thru`, Castle
  rooms and lighting, final flip, declared upstairs, branch placement, and
  deferred throne/barracks handling.
- The first remaining divergence is input **160**, after Castle arrival:
  JavaScript rejects `.` as an unsafe no-op while C spends the normal
  114-call turn.  This is a new command-policy boundary, not residual Castle
  generation drift.
- The last focused run completed in **0.60 seconds** at **199,819,264 bytes
  maximum RSS**.  No aggregate corpus or held-out judge ran.

### 2026-07-30 seed0360 reaches exact Minetown variant 5

- Castle input 160 is exact after the shared monster constructor restores
  deterministic leprechaun sleep; safe wait now consumes the native
  114-call turn without a command-specific exception.
- Valley input 164 is exact across all **14,741** RNG calls, screen, and
  cursor after final flips transform deferred arrival/branch rectangles and
  the shared constructor handles Sandestin birth-time shapechanging.
- Minetown input 180 is exact across all **1,334** RNG calls, screen, and
  cursor.  Variant 5 now owns its solidfill lighting draw, literal Lua map
  graph, fixed-gender textual gnome lords, deferred shops, and source-ordered
  40-name tool-shop reservoir.
- `selection_do_grow(W_ANY)` includes diagonal growth.  Restoring that shared
  selection contract closes the final Minetown wall-display cell and is
  covered by the permanent engine-only Minetown witness.
- Inputs **181--191** remain exact.  The next observed difference is
  presentation-only at input **192**, screen cell `(24,14)`; RNG and cursor
  are exact there.  This is focused evidence only: no aggregate corpus,
  normal suite, held-out judge, stage, commit, push, or submission ran.

### 2026-07-30 seed0360 Minend closes through input 230

- Input **192** now matches all **1,216** RNG calls, screen, and cursor after
  Minend's lit selections use the shared eight-neighbor `W_ANY` growth
  contract.
- Input **205** now matches all **22** calls, screen, and cursor.  Ordinary Lua
  engravings retain default wear, so the monster movement pre-phase owns
  `wipe_engr_at`; a visible unidentified blue glass pickup uses the
  GEM_CLASS material suffix and prints `a blue gem`.
- The permanent Minend regression checks both checkpoints and passes **1/1**
  in **0.35 seconds** at **169,345,024 bytes maximum RSS**.
- Inputs **206--230** remain exact.  The next difference is screen-only at
  input **231**: JavaScript reports a failed boulder push while native reports
  an impassable square.  This is focused evidence only; the accepted aggregate
  remains unchanged until a managed full engine-only corpus runs.

### 2026-07-30 seed0360 reaches Sokoban 3 variant 2

- Input **231** is exact after hero movement restores C's tight-diagonal
  `bad_rock()`/`cant_squeeze_thru()` gate before destination boulder pushing.
  The permanent witness proves both Sokoban shoulder boulders are present and
  passes **1/1** in **0.37 seconds** at **173,096,960 bytes maximum RSS**.
- Input **238** now matches all **100** RNG calls, screen, and cursor.
  `soko3-2.lua` is represented as a literal layout on the existing shared
  Sokoban generator rather than a separate behavior bridge.  Its permanent
  witness passes **1/1** in **0.37 seconds** at **172,244,992 bytes maximum
  RSS**.
- Inputs **232--237** and **239--248** remain exact.  Input **249** is the
  next missing Sokoban variant path, with native consuming 126 calls while
  JavaScript falls through after call 5.  No aggregate corpus or held-out
  judge has measured these focused gains yet.

### 2026-07-30 seed0360 closes Soko4 variant 1

- Input **249** now matches all **126** calls, screen, and cursor through a
  literal `soko4-1.lua` layout on the shared Sokoban generator.
- The remaining display defect was a source-order issue:
  `fixup_special()` places the deferred branch before `premap_detect()`
  snapshots remembered glyphs.  The permanent regression asserts the live
  down stair and its remembered `>` and passes **1/1** in **0.37 seconds** at
  **173,735,936 bytes maximum RSS**.
- Inputs **250--262** remain exact.  Input **263** is the next turn-level RNG
  divergence; native begins `rn2(12)` while JavaScript begins `rn2(6)`.
  These are focused results only, with no new aggregate or held-out score.

### 2026-07-30 full-suite OOM incident and assertion hardening

- Two equivalent full Contest suites were launched 35.8 seconds apart, yielded,
  and abandoned.  Their workers ran for roughly 56--57 minutes and reached
  about 192 GB and 178 GB RSS.  This is a verifier-lifecycle failure, not
  evidence about parity or held-out performance.
- The retained-error amplifier was statically localized to repeated
  whole-session `assert.deepEqual()` calls over 33,042--50,086 flattened RNG
  entries in the level-teleport tests.  A changed early call could make Node
  retain and format the complete mismatch in many failing tests.
- Every whole-`getRngLog()` equality in the test tree now uses a shared
  per-input, first-call comparator with bounded neighborhoods.  Syntax,
  whitespace, and a standalone helper smoke check pass; no full test or corpus
  was launched during the remediation.
- Future full evidence gates require a clean process precheck, exactly one
  owned command, polling through exit, elapsed/max-RSS measurement, and an
  explicit postcheck.  The accepted aggregate remains the last recorded
  engine-only run; the focused seed0360 work has not been reclassified.

### 2026-07-30 seed0360 closes Tower 1 through Tower 3

- Corrected the prior Sokoban diagnosis: input **228** must reject physical
  destination terrain before the diagonal squeeze gate; inputs 228 and 231
  now both match with zero RNG calls.
- Tower 1 input **263** now matches **13/13** calls, screen, and cursor after
  restored vampire leaders retain C's `STRAT_WAITFORU` state through the
  next distress phase.
- Tower 2 input **268** now matches **221/221** calls, screen, and cursor.
  Unnamed `des.object()` construction inherits artifact eligibility from
  `sp_lev.c:create_object()`, preserving armor's otherwise nonproductive
  `rn2(40)` chance; explicitly named quest objects remain excluded.
- Tower 3 input **274** now matches **1,781/1,781** calls, screen, cursor,
  population order, and deferred branch placement.  Tower 1--3 share the
  source tail for non-diggable walls, wallification, flip, branch-region
  transform, and solidification.
- The four focused regressions pass **4/4** in **0.67 seconds** at
  **262,635,520 bytes maximum RSS**, and bounded replay stays exact through
  input **294**.  The next blocker is input **295**, `bigrm-4.lua`, at its
  first script-specific call: `nhlib.random(10)` before
  `replace_terrain()`.
- No aggregate corpus, normal suite, held-out judge, stage, commit, push, or
  submission ran; the accepted aggregate and leaderboard score remain
  unchanged.

### 2026-07-30 seed0360 closes Big Room 4

- Input **295** now matches **8,314/8,314** calls, screen, and cursor for
  `bigrm-4.lua`.
- Variant 4 reuses the shared special-level graph: literal map,
  x-major/default-100% terrain replacement, four fountains, grown lighting,
  random stairs, 15 objects, six traps, 28 monsters, and wallification.
- The selected terrain is index 9, converting all 40 lava cells to lava
  walls.  The permanent regression checks that persistent result and the
  four fountains.
- The five focused movement/Tower/Big Room witnesses pass **5/5** in
  **0.79 seconds** at **286,261,248 bytes maximum RSS** with clean process
  prechecks and postchecks.
- Inputs **296--300** remain exact.  Input **301** is the next blocker and
  changes ownership: native enters `extralev.c:makeroguerooms()` for the
  legacy Rogue level at call 1, while JavaScript enters ordinary generation.
  This is a C generator mapping task, not another Lua-file port.
- No aggregate corpus, normal suite, held-out judge, stage, commit, push, or
  submission ran.

### 2026-07-30 seed0360 closes the legacy Rogue generator

- Input **301** now matches **263/263** RNG calls, decoded screen, and cursor.
  Its persistent witness includes seven Rogue rooms, classic graph corridors
  and doorways, the sleeping Glenn Wichman ghost, source-order equipment pile,
  stairs, and exact random arrival.
- The dispatcher now converts the named `rogue` descriptor into C's canonical
  `rogue_level` identity and bypasses the generic Lua-special preamble.  The
  level follows `extralev.c`: nine descriptors, recursive `miniwalk()`, real
  room materialization, `roguecorr()` carving, then `makerogueghost()` before
  room sorting and stairs.
- Rogue monster construction skips the ordinary defensive/miscellaneous
  inventory reservoirs, its doorways are forced open, and mineralization is
  suppressed.  Display switches to the classic no-color Rogue symbols before
  redraw and emits the “older, more primitive world” continuation, leaving the
  materialization line at `--More--`.
- The permanent focused witness passes **1/1** in **0.40 seconds** at
  **177,782,784 bytes maximum RSS**.  Process prechecks and postchecks were
  clean; no runner survived.
- The next divergence after the input-301 pager has not yet been localized.
  No aggregate corpus, normal suite, held-out judge, stage, commit, push, or
  submission ran.

### 2026-07-30 seed0360 closes Asmodeus

- Input **307** now matches **3,362/3,362** RNG calls, decoded screen, cursor,
  hero position, both map fragments, **21 monsters**, and **12 traps**.
- The named-level preamble now treats the known `mazegrid` scripts as
  `LVLINIT_MAZEGRID`, so Asmodeus does not consume the inappropriate random
  lighting call or fall through into a generic `hellfill.lua` descriptor.
- The source-ordered runner owns the half-left main map, fixed court,
  half-right exit map, stocked exterior maze, deferred regions,
  whole-level `hell_tweaks()`, wallification, and optional level flip.
- Shared constructor corrections preserve Asmodeus's cold/fire wands, the
  demon court's no-teleport defensive-item retry, the mindless-monster
  random-item early return, and stocking density across the union of all
  touched fragments.
- The permanent witness passes **1/1** in **0.38 seconds** at
  **178,831,360 bytes maximum RSS**.  Its first attempt stopped at module load
  because `WAN_COLD` was not exported; the adjacent canonical export was added
  and the rerun passed.  Process prechecks and postchecks were clean.
- This is a focused result only.  The next later per-input divergence has not
  yet been localized, and no aggregate corpus, normal suite, held-out judge,
  stage, commit, push, or submission ran.

### 2026-07-30 seed0360 closes Juiblex

- Input **313** now matches **2,723/2,723** RNG calls, decoded screen, cursor,
  three aligned map fragments, deferred regions, mineralization, and arrival.
- `LVLINIT_SWAMP` owns the unlit x-major swamp scan.  Literal `x` map cells are
  transparent overlays, preserving the initializer rather than replacing it
  with stone.
- The filled `SWAMP` region is constructed before the fountain and three giant
  mimics.  Its room topology drives `set_mimic_sym()`, and flag-only filling
  publishes `has_swamp` for later turn scheduling.
- The final state has **33 monsters**, **6 traps**, Juiblex at **(40,11)**,
  and the hero at **(76,11)**.  The permanent witness passes **1/1** in
  **0.40 seconds** at **181,305,344 bytes maximum RSS** with clean process
  checks.
- A proposed global mimic-constructor rule regressed input 211 and was
  reverted; source operation order was the actual boundary.  This remains a
  focused result: no aggregate corpus, normal suite, held-out judge, stage,
  commit, push, or submission ran.

### 2026-07-30 seed0360 closes Baalzebub

- Input **318** now matches **1,806/1,806** RNG calls, decoded screen, cursor,
  stocked exterior maze, deferred up stair, and hero arrival.
- The positional `des.mazewalk()` owns both `ROOM` passage terrain and an
  immediate default `stocked=true` tail.  Baalzebub also inherits Gehennom's
  hot temperature, which contributes +3 to eligible random-monster weights.
- `mkmaze.c:baalz_fixup()` runs after deferred regions.  Its protected
  wallification preserves the beetle legs, converts pool markers at
  **(68,8)** and **(68,14)** into repaired corners, and opens the rock west of
  the two iron-bar eyes to digging.
- The final state has **11 monsters**, **10 traps**, Baalzebub at
  **(64,11)**, stairs at **(3,5)** and **(73,11)**, and the hero at
  **(5,17)**.  The permanent witness passes **1/1** in **0.48 seconds** at
  **188,301,312 bytes maximum RSS**, with clean process checks.
- This is a focused result only; no aggregate corpus, normal suite, held-out
  judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 seed0360 closes wished armor and displacement targeting

- Unknown wished armor now retains its shuffled appearance until the global
  object type is discovered: input 457 shows `pair of padded gloves`, and
  input 491 shows `tattered cape`.
- Gauntlets of Power are installed in the gloves slot by object type, not by
  parsing presentation text.  `attrib.c:acurr()` is represented by an
  effective-attribute projection: stored Strength remains **9**, while the
  worn value is encoded as **125** and displayed as **25**.
- Delayed `Gloves_on()` identifies the type and owns the `rn2(19)` Wisdom
  exercise draw at input 495.  It retains the native
  `You finish your dressing maneuver.` completion line.
- Zero-delay `Cloak_on()` makes displacement observable, identifies the
  shuffled cloak, and forces the native two-input tty transaction:
  `difficulty pinpointing your location.--More--` at input 497, followed by
  `You are now wearing a cloak of displacement.` at input 498.
- With displacement active, every ordinary monster reaches
  `dochug()->set_apparxy()->distfleeck()` and then
  `m_move()->set_apparxy()` before its species movement probes.  Inputs
  **499--510** now preserve those apparent-target draws and resulting map
  positions.
- The permanent focused replay over inputs **457--510** passes **1/1** in
  **0.55 seconds** at **187,170,816 bytes maximum RSS**.  The bounded locator
  is exact through input **510**.
- This is a focused result only; no aggregate corpus, normal suite, held-out
  judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 seed0360 closes unseen-lava scheduling and Wiz-strt

- Input **368** now follows `mon.c:movemon_singlemon()` into `minliquid()`.
  The unseen grounded mumak at **(55,9)** pays its movement debit, dies in
  lava without RNG or prose, is unmapped, and never reaches `dochug()`.
- The fatal-lava slice is deliberately bounded: empty inventory, no fire
  resistance, no flight/levitation/clinging, no lifesaving, no teleport
  escape, and an unseen square.  Other `minliquid()` branches remain named
  implementation work rather than being silently approximated.
- Input **373** now matches **1,846/1,846** RNG calls, decoded screen, cursor,
  the 76x20 `Wiz-strt.lua` map, branch portal, actors, traps, and arrival.
  Inputs **374--376** also match the Wizard quest page, temperature transition,
  and first post-arrival actor scan.
- Shared fixes exposed by this level are source-owned: apprentices use the
  novice `MS_GUARDIAN` equipment graph; literal `C` map glyphs are clouds;
  and `trap.c:maketrap()` rejects a random trap targeted at cloud terrain
  without consuming the later trap-victim draw.
- The final level has **27 monsters** and **6 traps**: five of six random
  traps survive and `fixup_special()` adds the quest portal.  Neferet carries
  the explicit +5 elven cloak and +5 quarterstaff after her generated
  inventory is discarded.
- The focused Wiz-strt witness passes **1/1** in **0.49 seconds** at
  **184,582,144 bytes maximum RSS**.  The bounded locator is exact through
  input **383** and next diverges at input **384**, call **16**, in the live
  monster scheduler.
- This is a focused result only; no aggregate corpus, normal suite, held-out
  judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 seed0360 closes Wizard2

- Input **344** now matches **12,242/12,242** RNG calls, decoded screen,
  cursor, centered fortress, deferred exits, zoo population, and random hero
  arrival.  The replay remains exact through input **353**, including both
  tty acknowledgement windows.
- Like Wizard1, the `wizard2.lua` map is 29x13 but its final column is
  transparent.  Only the 28 concrete columns belong to `SpLev_Map`; the
  protected Hell selection and exterior stocking use that touched-cell set
  rather than the rectangular map context.
- `makemon.c:m_initweap()` gives weapon-using `S_WRAITH` monsters a fixed
  knife and long sword before the common offensive-item probe.  The zoo's
  barrow wight exposed this missing shared constructor arm.
- Regular `fill_zoo()` omits the whole room boundary side adjacent to its
  first linked door.  The 9x7 zoo therefore creates **54**, not 63, gold
  piles before its monster constructors.
- `do.c:goto_level()` converges through `pickup(1)`.  The hero lands at
  **(61,9)** on a boulder and yellow gem, so the pending materialization line
  becomes `--More--` before `look_here()` opens the right-aligned
  `Things that are here:` pile window.  This now uses the shared arrival and
  floor-pile owners rather than a Wizard2 screen bridge.
- The final level has **69 monsters**, **17 traps**, a down/up ladder at
  **(39,6)** and **(37,16)**, deferred stairs at **(7,9)** and **(76,5)**,
  and `has_zoo=true`.  The permanent focused witness passes **1/1** in
  **0.46 seconds** at **184,172,544 bytes maximum RSS**; the bounded replay
  through input 349 completed in **0.51 seconds** at **186,351,616 bytes
  maximum RSS** with clean process checks.
- This is a focused result only; no aggregate corpus, normal suite, held-out
  judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 Wizard1 runtime traps and wait-mask correction

- The bounded locator is exact through input **343**.  Input **335** now
  reproduces `You hear an E note squeak in the distance.` and input **337**
  reproduces the source `rnd(25)=8` sleep-gas duration.
- `trap.c:maketrap()` replaces a destroyable trap already occupying a
  coordinate.  The random sleeping-gas trap at **(40,10)** therefore replaces
  the fixed board there instead of coexisting with it.
- This corrects the previous Wizard1 ledger's provisional **13-trap** count:
  the source-shaped level has **11 unique floor-trap coordinates**.  Input
  330's 2,974-call generation transcript is unchanged.
- The hell hound moves onto the surviving board at **(41,11)**, wakes nearby
  actors after the sound transaction, then enters sleep gas at **(40,10)**
  and receives `mcanmove=0,mfrozen=8`.
- `wake_nearto()` clears ordinary sleep for the unique Wizard but preserves
  `STRAT_WAITFORU`; the subsequent `dochug()` returns without the two
  JavaScript-only `rn2(5)` calls.
- The two focused Wizard1 witnesses pass **2/2** in **0.60 seconds** at
  **226,033,664 bytes maximum RSS** with clean process checks.  Input **344**
  (`wizard2`) is now the first remaining divergence.
- No aggregate corpus, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 seed0360 closes Vlad Tower stationary phase four through input 779

- Block 967's location name was wrong: menu choice `G` enters `tower1` in
  **Vlad's Tower**, not Fort Ludios.
- `MMOVE_NOTHING` reaches distant `mattacku()` without requiring a ranged
  attack; `AC_VALUE()` therefore gives each stationary vampire bat its
  `rnd(2)` before its melee-only slots reject the distance.
- The moved-actor ranged/offensive continuation gate remains separate and
  unchanged.
- After the hero moves to `(22,10)`, `set_apparxy()` may retain closed door
  `(21,10)` as a false target because the shifted, empty-inventory vampire can
  become fog.  JavaScript no longer drains replacement coordinate draws.
- The permanent **668--779** witness passes **1/1** in **0.59 seconds**
  (**0.76 seconds** including startup), at **191,332,352 bytes** maximum RSS;
  input 769 is exact at **46/46** calls, screen, and cursor.
- Input **780** is next: native retains
  `You materialize on a different level!--More--`, while JavaScript crosses
  that tty boundary and enters a different level-generation stream.
- No aggregate corpus, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 seed0360 closes Orcus

- Input **324** now matches **6,358/6,358** RNG calls, decoded screen, cursor,
  ghost-town map, deferred stairs, shop/morgue population, and hero arrival.
- The `orcus.lua` runner owns the right/center 45x17 map, implicit
  `stocked=true` west maze walk, fixed ruins and population, three special
  rooms, whole-level `hell_tweaks()`, flip, and deferred region fixup.
- Shared source corrections make `DRY` random locations reject boulders,
  preserve explicit male `vampire lord` names, route armed skeletons through
  `m_initweap()`'s `S_ZOMBIE` arm, and check the maze-statue mimic disguise
  before the shop disguise.
- Both shops now construct real shopkeeper capital and charging inventory.
  After each room is stocked, Orcus's `stock_room()` hack probes those items
  and removes the shopkeeper, leaving `has_shop=true` but no live shopkeeper
  or room resident.
- The final state has **68 live monsters**, **14 traps**, Orcus and the down
  stair at **(66,4)**, the up stair at **(11,19)**, and the hero at
  **(10,9)**.  The permanent witness passes **1/1** in **0.43 seconds** at
  **183,500,800 bytes maximum RSS**; the bounded locator is exact through
  input 324.
- This is a focused result only; no aggregate corpus, normal suite, held-out
  judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 seed0360 closes Wizard1

- Input **330** now matches **2,974/2,974** RNG calls, decoded screen, cursor,
  centered fortress, three exit forms, deferred regions, mineralization, and
  hero arrival.
- The `wizard1.lua` runner owns a 29x13 map whose last column is transparent.
  Only its 28 concrete columns set `SpLev_Map`, which raises the exterior
  `fill_empty_maze()` object budget from `rnd(28)` to native `rnd(29)`.
- `rndtrap()` can return the `TRAPPED_DOOR` and `TRAPPED_CHEST` pseudo-types,
  but `trap.c:maketrap()` rejects both.  Retaining one as a floor trap at
  **(11,11)** had made the later branch-region placement consume four extra
  coordinate pairs.
- The final state has **30 monsters**, **13 real traps**, a filled-lvflags
  morgue, the Wizard and Book at **(41,10)**, a down ladder at **(31,10)**,
  down/up stairs at **(59,15)** and **(22,13)**, and the hero at **(63,8)**.
  The permanent witness passes **1/1** in **0.41 seconds** at
  **182,943,744 bytes maximum RSS**; the locator is exact through input 330.
- This is a focused result only; no aggregate corpus, normal suite, held-out
  judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 seed0360 closes quest scheduler, getpos, and portal migration

- Input **384** now matches **116/116** RNG calls.  Every tengu probes its
  innate one-in-five teleport at the start of `m_move()`; Wiz-strt's
  `noteleport` flag rejects the relocation only after that draw.
- Space in travel getpos describes the current cursor rather than cycling the
  literal stone glyph.  Return moves the cursor eight rows south, and
  unexplored destinations rejected by `is_valid_travelpt()` retain the
  `(no travel path)` annotation.
- At input **399**, native wraith 4045 moves from `(67,14)` to the fixed
  `MAGIC_PORTAL` at `(66,13)`.  `mintrap()` migrates the still-living actor
  off-level, sets uncontrolled-transport confusion, and returns from
  `postmov()` without the second `distfleeck()` call.
- JavaScript now removes that actor from the current level, records its
  destination in `_migratingMonsters`, and stops the actor transaction before
  door, pickup, web, concealment, or phase-four work.  Input 399 matches all
  **875/875** RNG calls, decoded screen, and cursor.
- The combined permanent witness over inputs **384--399** passes **1/1** in
  **0.51 seconds** at **186,466,304 bytes maximum RSS**.  The bounded locator
  is exact through input **456**; input 457's unidentified armor description
  is the next frontier.
- This is a focused result only; no aggregate corpus, normal suite, held-out
  judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 wished-armor ledger correction and chronological index

- The detailed `seed0360 closes wished armor and displacement targeting`
  entry was inserted above this true file bottom.  It remains unchanged
  there; this entry indexes that result chronologically.
- Inputs **457--510** are exact.  The permanent focused replay passes **1/1**
  in **0.55 seconds** at **187,170,816 bytes maximum RSS**; the armor units
  pass **5/5** in **0.08 seconds** at **56,066,048 bytes maximum RSS**.
- Architecture section 551 records the object naming, `do_wear.c`,
  `attrib.c`, tty, and `monmove.c:set_apparxy()` ownership boundaries.
- This is a focused result only; no aggregate corpus, normal suite, held-out
  judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 seed0360 closes travel descriptions and displaced-image travel

- Inputs **511--544** are exact.  The permanent focused replay passes
  **1/1** in **0.52 seconds**; input 527 owns **1,056/1,056** calls and input
  543 owns **3,001/3,001** calls.
- Getpos now distinguishes a concrete fog/vapor cloud, a remembered dark
  room, and an unreachable remembered stone.  The `(no travel path)` suffix
  uses forward `TRAVP_VALID` reachability and does not reuse the permissive
  live-travel guess.
- Live `TRAVP_TRAVEL` preserves C's backward edge orientation.  Adjacent to
  the unreachable `(3,20)` target, it returns the blocked final direction so
  `domove()` stops the run.  The previous reversed edge check entered
  `TRAVP_GUESS` and oscillated between `(3,19)` and `(4,19)`.
- `dochug()` now measures `nearby` from `(mux,muy)`.  A raven beside the
  displaced image owns `AC_VALUE`, then takes an unseen `wildmiss()` without
  a to-hit draw, message, or `map_invisible()` side effect.
- The broad alternative—sending every distant natural attacker through the
  phase-four AC setup—was rejected because it regressed exact input 499.
- The bounded locator's first divergence is input **545**, in `dokick()`'s
  obstacle/self-injury and wounded-leg transaction.
- This is a focused result only; no aggregate corpus, normal suite, held-out
  judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 seed0360 closes stone kicks and wounded-leg tty ownership

- Inputs **545--596** are exact.  The permanent focused replay passes
  **1/1** in **0.53 seconds**.
- The stone kick owns `exercise(DEX,FALSE)`, `exercise(STR,FALSE)`, the
  one-in-three wound gate, Constitution-scaled damage, and both monster wake
  radii before the elapsed actor scan.
- Input 545 matches **270/270** calls and HP 134; input 547 matches
  **97/97** calls, HP 131, Dexterity 12, and a right-leg wound.
- A wounded hero is rejected before `getdir()`.  The modal message owns
  inputs 548--570, ignores non-dismissal keys, and clears on Space without
  consuming a turn.
- The bounded locator's first divergence is input **597**, after 41 exact
  calls inside a later monster candidate selection.
- This is a focused result only; no aggregate corpus, normal suite, held-out
  judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 seed0360 closes airborne known-trap avoidance

- Inputs **597--623** are exact.  The permanent focused replay passes
  **1/1** in **0.53 seconds**; inputs 597 and 598 own **293/293** and
  **111/111** calls.
- Vampire bat 4043 knows the anti-magic trap at `(12,6)`.  Native excludes
  that square before candidate counting; the prior JavaScript classifier
  admitted it and consumed `rn2(7)` instead of the trailing `rn2(5)`.
- Flight bypasses only the trap types in `trap.c:floor_trigger()`.  It does
  not make magic, anti-magic, polymorph, teleport, level teleport, or portal
  traps harmless.
- The bounded locator's first divergence is input **624**, the Ctrl-F wizard
  mapping command.
- This is a focused result only; no aggregate corpus, normal suite, held-out
  judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 seed0360 closes wizard mapping and quest-start getpos

- Inputs **624--667** are exact.  The permanent focused replay passes
  **1/1** in **0.50 seconds**.
- Ctrl-F now dispatches the existing `wiz_map()` transaction, including its
  single Wisdom exercise draw.  The missing `THRONE` terrain projection was
  the only revealed map-cell mismatch; it now renders as a yellow backslash.
- A blocked final travel direction clears the cached destination before
  `domove()`, matching `findtravelpath(TRAVP_TRAVEL)` and returning the next
  getpos cursor to the hero.
- Quest-start down stairs consult `okToQuest()` and render as
  `blocked staircase down`; getpos appends `(no travel path)` independently.
- Shared `truncate_to_map()` semantics prevent diagonal edge movement from
  sliding along the boundary.  Control keys use `^D`/`^T` notation, and all
  four native pick characters are recognized.
- Input **668** is the next frontier: its first **1,093** RNG calls are exact,
  but JavaScript crosses the native tengu no-teleport pager and consumes
  another actor's RNG.
- This is a focused result only; no aggregate corpus, normal suite, held-out
  judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 seed0360 closes restricted tengu teleport continuation

- Inputs **668--672** match their canonical RNG slices, decoded screens, and
  cursors.  The permanent focused replay passes **1/1** in **0.48 seconds**
  (**0.66 seconds** including startup).
- `monmove.c:m_move()` owns a tengu's one-in-five teleport probe.
  `tele_restrict()` emits the visible mysterious-force line before ordinary
  candidate movement, `postmov()`, the trailing `distfleeck()`, and phase
  four.
- JavaScript now returns a named continuation at that exact rejected-probe
  boundary.  The scheduler queues the ordinary line and resumes the same
  actor without replaying its earlier status, perception, or teleport work.
- Input 668 owns **1,093/1,093** calls and input 671 owns **25/25** calls.
  Input 673 already owns **648/648** exact calls and the exact
  topline/cursor, but one visible raven glyph remains one cell west of the
  canonical screen.
- A temporary native raven-state recorder probe yielded an empty zero-step
  artifact and was rejected as evidence.  Its C instrumentation was removed,
  the recorder was rebuilt, and the installed binary was checked for absence
  of the temporary probe strings.
- Input **673** is the next frontier: localize the earliest producer of the
  raven coordinate without changing the already exact candidate RNG.
- This is a focused result only; no aggregate corpus, normal suite, held-out
  judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 seed0360 closes the composed raven veto and controlled teleport

- Inputs **673--691** are exact.  The expanded permanent witness over inputs
  **668--680** passes **1/1** in **0.47 seconds** (**0.62 seconds** including
  test-runner startup).
- The visible input-668 screen proves the raven begins at the same `(13,19)`
  coordinate.  Input 673 then owns **648/648** exact calls through three
  C-shaped raven transactions.
- The final transaction selects `(11,18)` with the exact eight-call random
  reservoir, but the canonical actor remains at `(12,18)` and suppresses
  phase four.  A diagnostic `MMOVE_DONE` result reproduces both effects and
  restores all later state through input 691.
- The session was composed by `sherpa_compose_multi.py` and cannot be
  replayed into its late state.  The hidden post-selection reason is not
  observable, so the retained fix is an explicit, fully state-bounded
  `Wiz-strt` composition bridge rather than a claimed general C rule.
- Controlled teleport already rejected the selected square and consumed the
  exact **144** input-680 calls.  Its materialization line now uses the tty
  continuation path, preserving
  `Sorry...  You materialize in a different location!`.
- Input **692** is the next frontier: restore getpos `?` help and its selected
  symbol-description pager.
- This is a focused result only; no aggregate corpus, normal suite, held-out
  judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 seed0360 closes quick-farlook mixed tty paging

- Inputs **668--697** are exact.  The expanded permanent witness passes
  **1/1** in **0.49 seconds** (**0.64 seconds** including test startup).
- Input 692 is quick farlook's `.` selection result, not getpos `?` help.
  `do_screen_description()` emits a mixed DEC floor glyph, the complete
  ambiguity list, and concrete `(floor of a room)` suffix.
- The 93 visible columns wrap into 75 and 17 columns; tty `more()` appends its
  eight-character marker to the second row and leaves cursor `[25,1,1]`.
- Escape from a wrapped topline takes native `docorner()` and restores the
  covered map rows.  Only a one-row Escape pager retains its old physical
  topline.
- The display continuation primitive now measures mixed cursor-forward/DEC
  messages by visible cells and paints the DEC glyph state before awaiting
  dismissal.  Farlook clears its short getpos label before entering it.
- A fresh bounded locator beyond input 697 is the next gate.  No aggregate
  corpus, normal suite, held-out judge, stage, commit, push, publication, or
  submission ran.

### 2026-07-30 seed0360 closes Wizard teleport travel-cache ownership

- Inputs **668--714** are exact.  The expanded permanent witness passes
  **1/1** in **0.50 seconds** (**0.68 seconds** including startup).
- `teleport.c:dotele()` clears `iflags.travelcc` before calling `tele()`.
  The controlled getpos, cancellation path, and random landing all observe
  that caller-owned clear.
- `scrolltele()` may read an existing target as a suggestion in other call
  paths, but selecting or randomly landing on a coordinate does not replace
  the cache.
- This restores the hero cursor for quick farlook at input 683 and for the
  later travel prompt at input 714 without changing screens or RNG.
- Input **729**, the getpos help overlay, is the next frontier.  No aggregate
  corpus, normal suite, held-out judge, stage, commit, push, publication, or
  submission ran.

### 2026-07-30 seed0360 closes getpos help overlay and redraw

- Inputs **668--731** are exact.  The expanded permanent witness passes
  **1/1** in **0.52 seconds** (**0.67 seconds** including startup).
- `getpos_help()` is a right-side tty menu: text starts at column 10, the
  overlay clear starts at column 9, and the map remains visible to the west.
- Fifteen instruction lines plus the trailing blank make tty place
  `--More--` on row 16 with cursor `[18,16,1]`.
- Newline dismissal destroys the menu and redraws the unchanged travel cursor
  with `Move cursor to the desired destination:`; Escape then cancels.
- Input **732** is the next frontier: screen/cursor exact, RNG first differs
  at call 49 (`rn2(12)` versus native `rn2(5)`).  No aggregate corpus, normal
  suite, held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 movement-spell state is retained through seed0360 input 731

- Inputs 698 and 706 already selected and printed the canonical indirect
  spells, but the deferred effect continuation omitted `haste-self` and
  `disappear`.
- `haste-self` now follows `mon_adjust_speed(+1)`'s permanent slow/fast state
  boundary; `disappear` now sets permanent/current invisibility and repaints
  the caster square.
- The permanent focused witness asserts fast state for apprentices 3999 and
  4014 and invisible state for apprentice 4010 after input 731.
- Inputs **668--731** still pass **1/1** in **0.53 seconds** (**0.69 seconds**
  including startup), at **203,194,368 bytes** maximum RSS.
- Input **732** remains unchanged at **80/85** RNG calls, first mismatch call
  49.  The earlier apprentice-4010 attribution is only a matching range
  signature; native actor identity remains unproved.
- Next: identify the peaceful residual action's owner before changing any
  movement ledger.  No aggregate corpus, normal suite, held-out judge, stage,
  commit, push, publication, or submission ran.

### 2026-07-30 seed0360 closes peaceful spell selection through input 732

- C rejects `disappear` for a peaceful caster when the hero lacks
  `See_invisible`; JavaScript omitted that `spell_would_be_useless()` branch.
- Apprentice 4010 therefore casts `haste-self`, not `disappear`, at input 698.
  Its input-704 `rn2(12)=0` allocation becomes 24 movement, retaining the
  exact 12-point ration consumed at input 732.
- The permanent witness now asserts fast state for apprentices 3999, 4010,
  and 4014 and covers **668--732**.
- It passes **1/1** in **0.52 seconds** (**0.69 seconds** including startup),
  at **193,789,952 bytes** maximum RSS; input 732 is exact at **85/85** RNG
  calls, screen, and cursor.
- This corrects the previous ledger entry: 4010 is fast, not invisible.  No
  aggregate corpus, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 seed0360 closes quest level-teleport admission through input 750

- `level_tele()` Wizard-menu `force_dest` resolves the target, but
  `goto_level()` still refuses a same-dungeon transition from quest start when
  `ok_to_quest()` is false.
- Inputs 737 (`A`, Wizard goal) and 745 (`z`, Wizard locate) now both retain
  the quest-start map and emit
  `A mysterious force prevents you from descending.` with zero RNG.
- A bounded engine-only locator has **0 mismatches through input 750**.
- The permanent **668--750** witness passes **1/1** in **0.52 seconds**
  (**0.67 seconds** including startup), at **191,201,280 bytes** maximum RSS.
- No aggregate corpus, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 seed0360 closes current-level menu selection through input 768

- Wizard-menu selection of the currently occupied quest-start level is a
  clear/redraw no-op; it returns before the quest admission gate.
- Input 760 now has a blank topline, cursor `[22,6,1]`, and zero RNG while
  inputs 737 and 745 retain their refusal behavior.
- The permanent witness follows the original `Wiz-strt` level through
  `_levelCache` after later level travel and passes **1/1** over inputs
  **668--768** in **0.55 seconds** (**0.75 seconds** including startup), at
  **205,537,280 bytes** maximum RSS.
- Input **769** is next: exact screen/cursor, RNG first differs at call 7
  (`rn2(4)` versus native `rnd(2)`), lengths **66/46**.
- No aggregate corpus, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 ledger placement correction for Vlad Tower input 769

- The detailed Vlad Tower entry was accidentally inserted above this ledger's
  bottom; it remains unchanged there.  This chronological marker incorporates
  it by reference.
- The accepted frontier is input **779**.  Input 769 is exact at **46/46**
  calls after separating stationary `MMOVE_NOTHING` phase four from the moved
  ranged gate and allowing empty-inventory vampire shifters to retain a closed
  apparent target via `can_fog()`.
- The permanent **668--779** witness passes **1/1** in **0.59 seconds**
  (**0.76 seconds** including startup), at **191,332,352 bytes** maximum RSS.
- Input **780** is the next generation/tty boundary.  No aggregate corpus,
  normal suite, held-out judge, stage, commit, push, publication, or
  submission ran.

### 2026-07-30 seed0360 closes the Wiz-loca topology prefix

- Input 780 now follows `Wiz-loca.lua` through the static map, all **744**
  ordered terrain-replacement rolls, five irregular rooms, and their five
  secret-door callbacks.
- Calls **0--760** are exact.  Fixed lighting, locked doors, stairs, and
  non-diggability are also present and consume no RNG.
- The managed locator's first difference is call **761**, the first
  `des.object()` location draw.  It completed in **0.70 seconds** at
  **191,987,712 bytes** maximum RSS.
- The focused witness now pins the exact 761-call input780 prefix while
  retaining full screen/cursor/RNG parity through input 779.
- No aggregate corpus, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 seed0360 closes Wiz-loca random objects

- The 15 source-ordered `des.object()` calls match from input780 call 761
  through call **918**, including their random locations and variable object
  constructor tails.
- The managed locator completed in **0.74 seconds** at **198,557,696 bytes**
  maximum RSS.
- Call 919 is the first fixed spiked-pit `rnd(4)` probe and is the next
  acceptance boundary.  The focused witness pins calls 0--918.
- No aggregate corpus, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 seed0360 closes Wiz-loca fixed spiked pits

- The six fixed spiked-pit declarations match input780 calls **919--924**;
  each owns one `mktrap()` `rnd(4)` probe and no location sampling.
- The managed locator completed in **0.71 seconds** at **191,725,568 bytes**
  maximum RSS.  Call 925 begins the falling-rock block.
- The focused witness now pins calls 0--924.
- No aggregate corpus, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 correction: Wiz-loca fixed traps close through call 926

- The prior six-pit attribution was wrong although its prefix was exact.
  Terrain replacement turns three declared pit squares into cloud/cloud/moat,
  so `mktrap()` rejects them before any predecessor draw.
- Input780 calls 919--921 belong to the three surviving pits, calls 922--924
  to the first three falling-rock traps, and calls 925--926 to the last two.
- All 11 fixed declarations are now represented.  The focused gate pins calls
  0--926; call 927 begins the random magic-trap location transaction.
- No aggregate corpus, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 seed0360 closes all Wiz-loca traps

- Input780 is exact through call **1205**, covering the failed random magic
  trap, two statue traps, polymorph, fixed anti-magic, two sleep-gas traps,
  and three dart traps.
- The first statue exposed missing Wizard role quest metadata at call 933.
  Restoring its explicit xorn/wraith second enemy and the rest of the source
  quest record converged the complete statue constructor.
- The managed locator completed in **0.76 seconds** at **192,315,392 bytes**
  maximum RSS.  Call 1206 begins hostile monster placement.
- No aggregate corpus, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 seed0360 closes the Wiz-loca monster roster

- The 27 Lua monster declarations match input780 calls **1206--1603**:
  12 hostile bat-class, seven hostile imp-class, seven explicit vampire bats,
  and one final hostile imp-class monster.
- The managed locator completed in **0.73 seconds** at **198,492,160 bytes**
  maximum RSS.  Call 1604 begins the two-axis random flip.
- The focused witness pins calls 0--1603.
- No aggregate corpus, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 seed0360 closes complete Wiz-loca generation

- Input780 now matches all **1,752 RNG calls**, including two flip choices,
  water/kelp mineralization, arrival `place_lregion()`, and the final Lua
  shuffle.
- The managed locator completed in **0.70 seconds** at **240,074,752 bytes**
  maximum RSS.  Its generated second map row already matches native.
- The only remaining input780 defect is the materialization tty pager/cursor;
  generation is no longer a candidate.
- The focused witness now requires the full exact input780 RNG slice.
- No aggregate corpus, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 seed0360 closes the Wiz-loca arrival pline

- Input780 now retains the native materialization `--More--` at cursor
  `[45,0,1]`; input781 installs the exact Wizard locate-first line over the
  generated map at cursor `[73,13,1]`.
- Native `qt_pager()` dispatches this short default-output Wizard record
  through `deliver_by_pline()`.  It is not a modal quest page.
- A shared prepared-delivery boundary preserves the two-call Lua shuffle on
  input780 before tty suspends on the older materialization line.
- The focused witness passes **1/1** in **0.57 seconds** (**0.74 seconds**
  including startup), at **206,225,408 bytes** maximum RSS, with exact
  screen/cursor/RNG parity through input781.
- No aggregate corpus, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 seed0360 opens the Wizard Quest-filler block

- A managed locator through input820 completed in **0.77 seconds** at
  **195,575,808 bytes** maximum RSS and found the next earliest difference at
  input784, Quest `Home 2`.
- Both engines consume the two Lua shuffle calls.  Native then begins
  room-form `Wiz-fila` with `rn2(100)`; JavaScript falls through to its
  generic level generator at `rn2(5)`.
- `specialPrototypeAt()` already selects `Wiz-fila`; the missing owner is the
  Wizard-filler dispatch and generator in `mklev.js`.
- The locator's later mismatches are downstream of this first wrong level and
  are not accepted as independent diagnoses.
- No aggregate corpus, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 seed0360 closes both Wizard Quest fillers

- The managed locator now reports **0 mismatches through input788**.  It
  completed in **0.74 seconds** at **195,428,352 bytes** maximum RSS.
- Input784 matches the full **1,854-call** `Wiz-fila` transaction; input787
  independently matches the full **1,691-call** `Wiz-filb` transaction.
- The permanent focused witness passes **1/1** in **0.57 seconds**
  (**0.72 seconds** including startup), at **195,526,656 bytes** maximum RSS.
- The accepted seed0360 frontier is input788.  No aggregate corpus, normal
  suite, held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 seed0360 opens inventory pair grammar at input821

- A managed locator to the session end completed in **0.75 seconds** at
  **196,771,840 bytes** maximum RSS and found exact parity through input820.
- Input821 omits `pair of` before known gauntlets of power; input825 repeats
  the same defect in the known-objects list.  RNG and cursor state agree.
- Native applies pair grammar by armor slot; the inventory formatter uses a
  narrower spelling suffix than the already-correct wish formatter.
- Inputs827--828 also differ in insight text, but remain unclassified until
  the earlier naming owner is closed.
- No aggregate corpus, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 seed0360 pair grammar is exact; split witness pending

- Shared armor pair grammar closes inventory input821 and discovery input825;
  a managed locator is exact through input826.
- The locator completed in **0.76 seconds** at **196,919,296 bytes** maximum
  RSS.  The next differences are attributes-window text at inputs827--828.
- Extending the old focused test failed only because its mutable
  `_lastQuietMonsterActions` end-state snapshot no longer described input769.
  The earlier internal witness must remain bounded; a separate late-tour
  output witness will cover inputs789--826.
- No aggregate corpus, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 seed0360 closes armor pair grammar through input826

- The late-tour focused witness passes **1/1** in **0.54 seconds**
  (**0.69 seconds** including startup), at **196,460,544 bytes** maximum RSS.
- Inventory input821 and discoveries input825 now share the same
  gloves/gauntlets/boots/shoes slot grammar; exact parity holds through
  input826.
- The earlier Wiz-loca/filler witness also remains green after being restored
  to its meaningful actor-snapshot endpoint.
- Input827 attributes is the next boundary.  No aggregate corpus, normal
  suite, held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 seed0360 is engine-only exact through session end

- The managed locator reports **0 mismatches across all 833 recorded states**
  in **0.73 seconds**, at **201,424,896 bytes** maximum RSS.
- Effective gauntlet strength, raw base annotation, displacement cloak, and
  speed-boots provenance close the final attributes pages.
- The session-end focused witness passes **1/1** in **0.57 seconds**
  (**0.72 seconds** including startup), at **198,688,768 bytes** maximum RSS.
- This is one public-session acceptance witness, not held-out evidence.  A
  full engine-only corpus is the next explicit regression gate; no normal
  suite, held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 engine-only corpus advances to 41/44 exact

- One owned sequential runner completed in **12.08 seconds** at
  **206,143,488 bytes** maximum RSS.  Its yielded cell 1896 was polled to
  exit; no duplicate or survivor remained.
- Seed0360 is exact at **120,639/120,639 RNG and 833/833 screens/cursors**.
  All previously accepted controls remain exact.
- The remaining public failures are seed0014, seed0030, and seed0367.
  Seed0367 is smallest: all 50,125 RNG calls and 324 cursors match, with one
  screen difference.
- The normal fixture-enabled suite was deliberately not run after a red
  engine-only gate.  No held-out judge, stage, commit, push, publication, or
  submission ran.

### 2026-07-30 seed0367 closes FAST provenance

- Native names known speed boots as the Very-fast source but reports speed
  from blue dragon scale mail's secondary armor effect as generic worn
  equipment.
- Focused seed0360/seed0367 attributes witnesses pass **2/2** in **1.20
  seconds**, at **198,311,936 bytes** maximum RSS.
- The managed seed0367 locator reports **0 mismatches across 324 states** in
  **0.44 seconds**, at **164,544,512 bytes** maximum RSS.
- A full engine-only corpus is required before promoting the aggregate above
  41/44.  No normal suite, held-out judge, stage, commit, push, publication,
  or submission ran.

### 2026-07-30 engine-only corpus advances to 42/44 exact

- One owned sequential runner completed in **11.97 seconds** at
  **207,126,528 bytes** maximum RSS.  Yielded cell 1905 was polled to exit;
  no duplicate or survivor remained.
- Seed0367 is exact at **50,125/50,125 RNG and 324/324 screens/cursors**.
  Seed0360 and all other accepted controls remain exact.
- Only seed0014 and seed0030 remain non-exact.  Their earliest bounded
  divergences, not their total mismatch counts, decide the next source block.
- The normal fixture-enabled suite was deliberately not run after the red
  engine-only gate.  No held-out judge, stage, commit, push, publication, or
  submission ran.

### 2026-07-30 remaining-cone comparison selects seed0014 input8

- Seed0014 first differs at character-selection screen8: native says
  `role forces female` for Valkyrie; JavaScript leaves a selectable gender
  route.  Its first engine divergence follows at input16 in little-dog AI.
- Seed0030 first differs in its initial pet/actor transaction at input4.
- The seed0014 and seed0030 bounded replays completed in **0.20** and **0.47
  seconds**, at **151,339,008** and **180,977,664 bytes** maximum RSS.
- The forced-gender screen is the strict earliest independent owner.  Pet AI
  remains the next comparison after it closes.
- No full corpus, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran after the 42/44 gate.

### 2026-07-30 seed0014 forced-gender menu boundary closes

- `role.c:role_menu_extra(RS_GENDER)` owns the disabled
  `    role forces female` row when the selected role has one gender mask.
- JavaScript now projects its existing single-gender Valkyrie rule through a
  shared disabled row on race and alignment menus.
- A managed locator is exact through input15; the first difference is now the
  little-dog transaction at input16, after shared `rn2(5)` and `rn2(100)`
  calls.
- A focused input8 screen/cursor/RNG witness and architecture map are being
  added before pet AI work.  No full corpus, normal suite, held-out judge,
  stage, commit, push, publication, or submission ran.

### 2026-07-30 forced-gender focused witness crosses the menu coroutine

- Ending the test queue at input8 failed with `Input queue empty`; the
  character-selection coroutine was still waiting for the race-menu key.
- The failed run took **0.22 seconds** at **149,323,776 bytes** maximum RSS
  and left no survivor.
- The corrected witness feeds the existing recording through input15, where
  the ordinary command loop is stable, and asserts all intervening screens,
  cursors, and RNG slices.
- This is a harness-boundary correction, not a parity correction.  No full
  corpus, normal suite, held-out judge, stage, commit, push, publication, or
  submission ran.

### 2026-07-30 seed0014 forced-gender witness is accepted

- The corrected focused witness passes **1/1** in **0.21 seconds**
  (**0.23 seconds** wall) at **156,631,040 bytes** maximum RSS.
- Screen, cursor, and RNG parity are exact through input15, including the
  input8 disabled row and the stable command-loop boundary.
- The next owner is the shared native pet-turn path behind seed0014 input16
  and seed0030 input4.  No aggregate, normal suite, held-out judge, stage,
  commit, push, publication, or submission ran.

### 2026-07-30 the final pet divergences bypass the live pet port

- Seed0030 segment0 input4 shares native's opening `rn2(5)`, then JavaScript
  repeats `rn2(5)` while native screens floor objects with `rn2(100)` and
  `rn2(8)`.  Segment1 first differs at input3.
- Seed0014 input16 likewise enters a role-specific fixed RNG table rather
  than JavaScript `movePet()`.
- The earliest owner is `allmain.js` role dispatch:
  `valkyrieDogSearchRng()` and `touristMonsterActionRng()` bypass
  `scanMonsterMovement -> quietMonsterActionRng -> movePet`.
- Native has one role-neutral `movemon -> m_move -> dog_move` path.  Promote
  ordinary non-bridged Valkyrie and Tourist turns to the live scheduler
  before changing pet goal or candidate logic.
- The bounded locator completed in **0.25 seconds** at **161,218,560 bytes**
  maximum RSS.  No aggregate, normal suite, held-out judge, stage, commit,
  push, publication, or submission ran.

### 2026-07-30 ordinary Valkyrie and Tourist actor scans go live

- Non-bridged Valkyrie and Tourist turns now enter the shared live actor
  scheduler instead of fixed role call tables.
- `_valkPitPath`, `_valkChatPath`, and `_touristExplorePath` remain explicit
  bounded compatibility paths.
- No pet goal, food, candidate, or movement logic changed in this slice.
  Seed0014 input16 and seed0030 step4 are the pending discriminating
  witnesses.
- No test, aggregate, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran after implementation.

### 2026-07-30 live Valkyrie and Tourist scheduler dispatch is accepted

- Seed0014 is exact through input16 in **0.20 seconds** at **143,622,144
  bytes** maximum RSS.
- Seed0030's opening two Tourist segments are exact through step4; their
  former input4/input3 pet differences disappear without any pet-algorithm
  change.
- Seed0030 now first differs at segment2 Wizard startup step0, call **2,217**
  (`rn2(6)` native versus `rn2(100)` JavaScript), with different starting
  physical attributes.
- The fixed role dispatch was the complete cause of the old pet frontier.
  Focused witnesses are pending before the independent Wizard startup block.
- No aggregate, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 live-role scheduler regressions are green

- Two focused tests pass in **0.26 seconds** (**0.28 seconds** wall) at
  **166,543,360 bytes** maximum RSS.
- They pin seed0014 through input16 and seed0030 Tourist segments0--1 through
  step4, including proof that the live pet actor transaction executed.
- The scheduler block is accepted.  Seed0030 segment2 Wizard startup call
  2,217 is the next independent owner; no aggregate, normal suite, held-out
  judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 Elf Wizard race inventory slice is implemented

- Native call2,217 is `u_init_race()` selecting one of six non-magical Elf
  instruments with `rn2(6)`, followed by the one-entry inventory constructor.
- JavaScript skipped race initialization and entered `initAttributes()`
  directly.
- The new race boundary runs after role inventory and before attributes, and
  also records the native Elf object-preknowledge set.
- The predicted four-call bridge is `rn2(6), rn2(1), rnd(2), rn2(1)`.
  Seed0030 segment2 step0 is the pending witness; no aggregate, normal suite,
  held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 Elf Wizard race inventory slice is accepted

- Seed0030 Elf Wizard segments2--4 are exact at startup after the predicted
  four-call instrument constructor.
- The all-segment startup locator completed in **0.24 seconds** at
  **158,842,880 bytes** maximum RSS.
- The next strict difference is segment5 Priest cell `(73,5)`, glyph `%`
  color5 versus native color15, with exact RNG and cursor.
- The former attribute mismatch was downstream RNG drift, not attribute
  allocation logic.  A focused Elf witness is pending; no aggregate, normal
  suite, held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 Elf Wizard race initialization is permanently pinned

- The focused three-segment startup witness passes **1/1** in **0.20
  seconds** (**0.22 seconds** wall) at **143,015,936 bytes** maximum RSS.
- It checks startup RNG, screens, cursors, and membership in the exact
  six-instrument set.
- Segment5 `(73,5)` object-color projection is next; no aggregate, normal
  suite, held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 segment5 corpse color is stale trap-victim identity

- Screen `(73,5)` is level pile `(74,4)`, headed by a corpse whose JavaScript
  `corpsenm=308` is Baalzebub and therefore magenta.
- `mktrap_victim()` locally retained obsolete fake-player bounds 305--317;
  the current canonical range is 331--343.
- The same recorded offset selects the current fake Healer in native, whose
  corpse is white.  Startup RNG and pile order are already exact.
- Reuse the canonical bounds rather than adding a color exception.  No test,
  aggregate, normal suite, held-out judge, stage, commit, push, publication,
  or submission ran.

### 2026-07-30 trap-victim fake-role bounds are corrected

- `mktrap_victim()` now reuses the current file-level 331--343 player-monster
  bounds.
- RNG, pile construction, and display code are unchanged.  All seed0030
  startups are the pending witness; no aggregate, normal suite, held-out
  judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 segment5 trap-victim corpse identity is accepted

- The all-startup locator completed in **0.24 seconds** at **158,285,824
  bytes** maximum RSS; segment5 is exact.
- Correcting the corpse identity alone fixed the color, confirming the
  renderer and pile order as consumers.
- A focused fake-Healer pile-head witness is pending.  Segment6 step0 is next;
  no aggregate, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 trap-victim identity regression is green

- The focused test passes **1/1** in **0.20 seconds** (**0.23 seconds** wall)
  at **145,620,992 bytes** maximum RSS.
- It pins segment5 startup and `corpsenm=334` at level pile `(74,4)`.
- Segment6 call344 is next; no aggregate, normal suite, held-out judge, stage,
  commit, push, publication, or submission ran.

### 2026-07-30 segment6 omits Blocked-center replacement decisions

- Native calls343--351 are nine `rn2(100)` decisions for the 3x3 literal-lava
  center after the shared outer percent and terrain shuffle.
- JavaScript mutates all nine cells without those calls; its call343 is
  already the later themed-fill percent, and call344 reaches `litstate_rnd`.
- `lspo_replace_terrain()` evaluates the decision even at default chance100.
  Add one call per matching cell without changing the selected terrain.
- No test, aggregate, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 Blocked-center per-cell decisions are implemented

- The existing x/y 3x3 loop now evaluates `rn2(100) < 100` for each matching
  lava cell before replacement.
- Terrain choice and loop order are unchanged.  The all-startup locator is
  pending; no aggregate, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 Blocked-center replacement sub-block is accepted

- Segment6 now matches through call2,637; the frontier moved from call344 by
  the predicted nine calls.
- The locator completed in **0.25 seconds** at **159,170,560 bytes** maximum
  RSS.
- Call2,638 is a new `rn2(3)` versus native `rn2(2)` owner, with the starting
  pet one square east.  Segment6 remains open.
- No aggregate, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 segment6 random figurine uses the wrong reservoir

- An isolated startup replay confirms call2,638 as the first mismatch in
  **0.17 seconds** at **144,211,968 bytes** maximum RSS.
- Native `mksobj_init(FIGURINE)` selects through `rndmonnum_adj(5,10)`,
  stores the selected species, and retries humans; JavaScript calls ordinary
  `rndmonnum()` and discards the result.
- The native 2..201 reservoir totals are the adjusted figurine policy, not a
  transient level-difficulty change.  Implement that constructor before
  inspecting the downstream pet.
- No aggregate, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 adjusted figurine identity is implemented

- `initTool(FIGURINE)` now owns `rndmonnum_adj(5,10)`, the bounded human
  rejection loop, the stored `corpsenm`, and then BUC in native order.
- The outer shared corpse/statue/figurine tail retains gender ownership.
- Isolated segment6 startup is pending; no aggregate, normal suite, held-out
  judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 adjusted figurine constructor is accepted

- Segment6 matches from call2,638 through the full adjusted reservoir,
  figurine tail, remaining level generation, and pet construction.
- The isolated replay completed in **0.19 seconds** at **144,539,648 bytes**
  maximum RSS; the strict frontier advanced to call3,773.
- Native next enters `u_init_role()` with `rn2(5)` while JavaScript enters an
  unrelated `rnd(1000)` constructor.  Priest inventory is now the earliest
  owner.
- No aggregate, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 Priest spellbook filter rejects valid disciplines

- At call3,773 native accepts level-three divination book `SPE_IDENTIFY` as
  the second Priest book; JavaScript's hard-coded object-id allowlist rejects
  it and generates a third candidate.
- C filters by level threshold plus the Priest skill categories healing,
  divination, and clerical.  The current allowlist also omits other valid
  books in those categories.
- Replace the list with the metadata-backed source predicate while retaining
  duplicate exclusion.  No aggregate, normal suite, held-out judge, stage,
  commit, push, publication, or submission ran.

### 2026-07-30 Priest spellbook filtering is skill-shaped

- The Priest filter now uses the generated spell level/category metadata and
  the source healing, divination, and clerical skill categories.
- First-book level one, later-book level three, and no-duplicate rules remain
  explicit.
- Segment6 startup is pending; no aggregate, normal suite, held-out judge,
  stage, commit, push, publication, or submission ran.

### 2026-07-30 segment6 regression exposed a sparse-grid test bug

- Exact startup assertions passed, then the semantic figurine scan threw
  `column is not iterable` on a sparse coordinate slot.
- The **0/1** run took **0.21 seconds** wall at **145,801,216 bytes** maximum
  RSS.
- Skip sparse columns/piles in the test only and rerun; engine behavior is
  unchanged.

### 2026-07-30 segment6 composed startup regression is green

- The focused test passes **1/1** in **0.21 seconds** (**0.23 seconds** wall)
  at **146,194,432 bytes** maximum RSS.
- It pins all **3,825** startup calls, screen, cursor, figurine species230,
  and accepted identify book397.
- Segment7 startup is next; no aggregate, normal suite, held-out judge,
  stage, commit, push, publication, or submission ran.

### 2026-07-30 segment7 Knight startup is exact

- Segment7 matches **2,662/2,662** startup calls, screen, and cursor.
- The isolated replay completed in **0.28 seconds** at **145,162,240 bytes**
  maximum RSS.
- Continue the same life to its first divergence; no aggregate, normal suite,
  held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 segment7 first diverges after an exact input25 prefix

- Inputs0--24 are exact.  Input25 matches all **16** native calls, then
  JavaScript adds 13 calls beginning with `rn2(3)`.
- The replay completed in **0.42 seconds** at **165,724,160 bytes** maximum
  RSS; screen and cursor diverge only after the extra transaction.
- Inspect the ending native phase and live actors before assigning scheduler
  ownership.  No aggregate, normal suite, held-out judge, stage, commit,
  push, publication, or submission ran.

### 2026-07-30 segment7 pages between the pony's two contact slots

- Native input25 completes the pony's first miss and passive, then rolls the
  second to-hit and suspends when its identical miss line cannot share tty's
  pending topline.  Input26 begins with the second `passivemm()` draw.
- JavaScript resolves both attack slots and passive tails before emitting one
  combined combat message, so the 13 calls owned by native input26 leak into
  input25.
- Generalize the existing visible monster-contact continuation per attack
  slot, keeping counterattack and post-fight flee logic after the final slot.
  No aggregate, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 visible pet contact is resumable per attack slot

- Deferred contact now retains the complete supported attack list plus the
  currently displayed result and next slot.
- Resumption completes one damage/passive tail and returns to tty after
  preparing the next to-hit; counterattack and post-fight flee remain final
  tails.
- A focused two-slot unit witness and seed0030 input26 are pending.  No test,
  aggregate, normal suite, held-out judge, stage, commit, push, publication,
  or submission ran after implementation.

### 2026-07-30 per-slot pony continuation unit witness is green

- The focused test passes **1/1** in **0.08 seconds** (**0.11 seconds** wall)
  at **63,586,304 bytes** maximum RSS.
- Its three transaction stages own `rnd(20)`, then `rn2(3)` plus `rnd(21)`,
  then `rn2(3)` plus the final `rn2(5)`.
- Seed0030 input26 is the pending real tty witness; no aggregate, normal
  suite, held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 segment7 pony multi-attack tty boundary is accepted

- The engine-only segment7 regression passes **1/1** in **0.30 seconds**
  (**0.32 seconds** wall) at **152,354,816 bytes** maximum RSS.
- Inputs0--26 have exact RNG slices, screens, and cursors.  Input25 stops
  after the second to-hit at the first miss's pager; input26 resumes the
  second passive and scheduler tail.
- The fix is a generic per-slot `mattackm()` continuation, not a seed or pony
  transcript.  Continue segment7 after input26; no aggregate, normal suite,
  held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 full seed0030 locator restores segment0 input7 priority

- The locator completed in **0.73 seconds** at **342,769,664 bytes** maximum
  RSS and found segment0 input7 as the session's earliest unresolved block.
- Native calls `rnd(2)=1` and the kitten picks up one gold piece; JavaScript
  omits the call and transfers all seven pieces.
- Treat every later segment0 mismatch as downstream until `dog_invent()`'s
  carried-quantity split is source-shaped.  Segment7's through-input26
  witness remains accepted.  No aggregate, normal suite, held-out judge,
  stage, commit, push, publication, or submission ran.

### 2026-07-30 kitten pickup needs can_carry quantity plus splitobj identity

- C `can_carry()` returns one for a no-hands kitten facing a seven-coin
  stack; `dog_invent()` transfers a split child and leaves six on the floor.
- The missing `rnd(2)` belongs to `splitobj()` allocating that child's
  object ID through `next_ident()`, not to choosing the amount.
- Implement the quantity boundary and retain message pluralization as a
  downstream consumer.  No test, aggregate, normal suite, held-out judge,
  stage, commit, push, publication, or submission ran.

### 2026-07-30 partial pet pickup preserves stack and child identity

- The carry helper now retains an amount; a no-hands non-glomper can carry
  one item from a larger stack.
- `dog_invent()`'s JS owner creates the split child through `nextIdent()`,
  leaves the reduced parent on the floor, and transfers only the child.
  Coin weight uses the source hundred-coin rounding.
- The through-input7 semantic regression is pending.  No test, aggregate,
  normal suite, held-out judge, stage, commit, push, publication, or
  submission ran after implementation.

### 2026-07-30 kitten one-coin pickup block is accepted

- The focused engine-only test passes **1/1** in **0.23 seconds** (**0.25
  seconds** wall) at **149,979,136 bytes** maximum RSS.
- Segment0 inputs0--7 have exact RNG, screens, and cursors; the kitten carries
  one coin and the floor retains six.
- Continue with a bounded session locator.  No aggregate, normal suite,
  held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 segment0 input24 misses an engraving topline pager

- After the accepted pickup block, inputs0--23 are exact.  The locator ran in
  **0.71 seconds** at **354,123,776 bytes** maximum RSS.
- Native wraps the long `You read:` line onto row1 and waits at `--More--`
  with zero RNG; JavaScript leaves one overlong row and consumes input25's 45
  calls early.
- Trace shared tty long-line wrapping before any later segment0 symptom.  No
  aggregate, normal suite, held-out judge, stage, commit, push, publication,
  or submission ran.

### 2026-07-30 engraving bypasses shared update_topl continuation

- Native wraps while `strlen >= CO`; the 82-character line splits at index70
  and pages with cursor `(19,1)`.
- The engraving caller sends its second message to raw `pline()` instead of
  `plineWithContinuation()`, whose standalone-long-message path already owns
  tty paging.  Align its boundary from `>` to `>=`.
- A through-input25 regression is pending.  No test, aggregate, normal suite,
  held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 engraving uses the shared long-topline continuation

- Its second line now routes through `plineWithContinuation()`.
- Plain and mixed wrap loops plus standalone-message triggers use C's
  `length >= columns` boundary.
- The through-input25 witness is pending.  No test, aggregate, normal suite,
  held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 first engraving continuation test exposes a double pager

- The test failed **0/1** in **0.24 seconds** (**0.27 seconds** wall) at
  **144,293,888 bytes** maximum RSS.
- Input25 still has zero calls, so another pager consumes the key after the
  correct long-line boundary was introduced.
- Inspect steps23--25 for stale pending-message ownership; keep the exact
  test unchanged.  No aggregate, normal suite, held-out judge, stage, commit,
  push, publication, or submission ran.

### 2026-07-30 promptKey leaves the first engraving line pending

- Step24 contains the first line's `--More----More--`; the correct long-line
  pager moves to step25.
- `promptKey()` does not clear ordinary continuation state, while
  `flushPendingTopline()` owns a true tty `more()` transaction and does.
- Replace the engraving pager callback with
  `pline()` plus `flushPendingTopline()` and rerun the unchanged test.  No
  aggregate, normal suite, held-out judge, stage, commit, push, publication,
  or submission ran.

### 2026-07-30 first engraving line now uses the true shared pager

- `pline()` installs the descriptive line and `flushPendingTopline()`
  acknowledges and clears it before the long second line.
- The through-input25 test remains unchanged and is pending.  No test,
  aggregate, normal suite, held-out judge, stage, commit, push, publication,
  or submission ran after the correction.

### 2026-07-30 segment0 engraving pager block is accepted

- The unchanged focused test passes **1/1** in **0.26 seconds** (**0.28
  seconds** wall) at **146,997,248 bytes** maximum RSS.
- Inputs0--25 have exact RNG, screens, and cursors.  The short first pager,
  wrapped second pager at `(19,1)`, and following 45-call turn are separately
  owned.
- Continue with the bounded session locator.  No aggregate, normal suite,
  held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 segment0 next diverges at descent call51

- Inputs0--27 are exact.  The locator ran in **0.73 seconds** at
  **338,657,280 bytes** maximum RSS.
- At input28, the first 51 calls match; native starts `rn2(3)` and a 45/44
  reservoir while JavaScript starts `rn2(1)` and 1000/1001 work.
- Inspect bounded labeled callsites and level-generation state before changing
  any reservoir.  No aggregate, normal suite, held-out judge, stage, commit,
  push, publication, or submission ran.

### 2026-07-30 descent omits the Teleportation hub fill callback

- Native labels call51 as `themerms.lua:268`: `2 + rn2(3)` followed by two
  removed room-floor coordinates from selections of size45 and44.
- JavaScript selects the same fill metadata but dispatches only Temple and
  Storeroom, then enters the next room attempt.
- Port both the early source-coordinate selection and deferred
  `post_level_generate()` destination/trap callbacks.  No aggregate, normal
  suite, held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 Teleportation hub source and postprocess phases are implemented

- The fill selects distinct room-floor sources and defers them per level.
- Postprocessing chooses whole-level ROOM destinations with same-row/column
  rejection, creates seen fixed-destination teleport traps, then wallifies.
- Syntax validation passes; the through-input28 witness is pending.  No test,
  aggregate, normal suite, held-out judge, stage, commit, push, publication,
  or submission ran.

### 2026-07-30 first hub test identifies the static-map dispatcher

- The test failed **0/1** in **0.25 seconds** (**0.27 seconds** wall) at
  **144,113,664 bytes** maximum RSS without reaching the new callback.
- The prefix identifies a static Water-surrounded vault, whose themed-fill
  dispatcher omits Teleportation hub.
- Wire the generic fill there and rerun the unchanged test.  No aggregate,
  normal suite, held-out judge, stage, commit, push, publication, or
  submission ran.

### 2026-07-30 static themed rooms now dispatch Teleportation hub

- The Water-surrounded vault fill now reaches the generic source/postprocess
  implementation; dynamic fill support remains.
- The unchanged through-input28 test is pending.  No aggregate, normal suite,
  held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 hub dispatcher moves the descent frontier to call2784

- The test still fails **0/1** in **0.25 seconds** (**0.27 seconds** wall) at
  **144,293,888 bytes** maximum RSS, but calls0--2783 are now exact.
- Native next calls `rnd(4)` after `rn2(201)`; JavaScript calls another
  `rn2(201)`.  Actual/expected totals are 3,730/3,736.
- Inspect labels before assigning the six-call difference to postprocess.  No
  aggregate, normal suite, held-out judge, stage, commit, push, publication,
  or submission ran.

### 2026-07-30 call2784 is the shared `mktrap()` predecessor gate

- Native has left `fill_ordinary_room()` before the first
  `selection_rndcoord(201)` and then calls `rnd(4)` from `mktrap()` for the
  explicit hub trap.
- JavaScript calls low-level `maketrap()` directly, bypassing the already
  source-shaped `finishSpecialTrapConstruction()` owner.
- Route deferred hub traps through that finisher and rerun the unchanged
  through-input28 test.  No aggregate, normal suite, held-out judge, stage,
  commit, push, publication, or submission ran.

### 2026-07-30 deferred hub traps now use the shared finisher

- Explicit hub traps now pass through `finishSpecialTrapConstruction()`
  before their seen flag and fixed destination are finalized.
- The unchanged through-input28 exact integration test is pending.  No test,
  aggregate, normal suite, held-out judge, stage, commit, push, publication,
  or submission ran after implementation.

### 2026-07-30 input28 is replay-exact but the semantic trap query is empty

- RNG, screens, and cursors are exact through input28 after restoring the
  shared finisher.
- The test remains **0/1** in **0.30 seconds** at **152,453,120 bytes** RSS
  because no final-level trap matches all of type15, seen, and fixed
  destination.
- Inspect a bounded final trap summary before changing either generation or
  the assertion.  No aggregate, normal suite, held-out judge, stage, commit,
  push, publication, or submission ran.

### 2026-07-30 the hub semantic query stopped on the old-level descent pager

- Move index27 enters `ordinaryDescend()`; step28 is its first `--More--`.
  At that suspended boundary `game.level` intentionally remains level1.
- Move index28 commits the generated destination and reaches the next native
  arrival pager, so the semantic witness must run through step29.
- Extend only this test boundary while preserving exact per-step assertions.
  No aggregate, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 input29 exposes the next actor-scheduler block

- The step29 witness fails **0/1** in **0.27 seconds** at **143,818,752
  bytes** RSS after 20 exact calls; native has 34 calls and JavaScript 32.
- Input28's complete 3,736-call hub generation remains exact.  Input29 merely
  commits that map before entering an unrelated actor turn.
- Keep the hub's exact assertion through input28, use the next key only to
  inspect committed trap state, and track input29 call20 as the new frontier.
  No aggregate, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 the complete Teleportation-hub block is accepted

- The focused regression passes **1/1** in **0.30 seconds** at **151,896,064
  bytes** RSS.
- Input28 is exact for all 3,736 RNG calls plus screens and cursors; after map
  commit, exactly two seen type15 traps retain fixed destinations differing
  from both source coordinates.
- Architecture map section592 records the early Lua contents, deferred
  postprocess, and shared `mktrap()` boundary.  Continue at input29 call20.
  No aggregate, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 input29 omits the lichen-to-newt corpse timer rebuild

- Calls0--19 are exact and the `rndmonst_adj()` reservoir selects temporary
  lichen for `mksobj(CORPSE)`.
- C `mkcorpstat()` overrides lichen to the killed newt and therefore restarts
  corpse timing; JavaScript assigns `corpsenm` directly and skips the five
  `rnz(10)` log entries before `grow_up()`.
- Route this kill through `mkcorpstat()` and pin input29 plus the retained
  timer.  No aggregate, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 pet-kill corpses now converge through `mkcorpstat()`

- The kill path now uses the same conditional corpse-species override owner as
  C while preserving undead age and weight adjustments.
- A focused input29 test pins exact replay plus one retained timed newt corpse.
  It is pending.  No test, aggregate, normal suite, held-out judge, stage,
  commit, push, publication, or submission ran after implementation.

### 2026-07-30 input29 is exact through native end but JavaScript overruns

- The test remains **0/1** in **0.27 seconds** at **144,228,352 bytes** RSS,
  but native calls0--33 are now exact.
- JavaScript adds `rn2(100)=60`, `rn2(100)=7`, and `rn2(5)=4` after native
  input29 ends.
- Locate those actor-tail calls and the tty boundary that should suspend
  before them.  No aggregate, normal suite, held-out judge, stage, commit,
  push, publication, or submission ran.

### 2026-07-30 the overrun is native input30's deferred pet-eating prefix

- The three JS extras exactly equal native input30 calls0--2: two
  `obj_resists()` draws and the trailing `distfleeck()`.
- `dog_eat()` must print the visible eating line against the older kill
  topline before reward classification, corpse consumption, and actor tail.
- Split move-and-eat at that tty boundary, then pin both input29 and input30.
  No aggregate, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 move-and-eat now suspends at its visible line

- Destination, track, split draw, and eating delay commit before tty; reward
  checks, consumption, post-move handling, and `distfleeck()` resume after it.
- Duplicate prose and movement repaint are suppressed on the resumed path.
- Syntax checks pass; the unchanged input29 witness is pending.  No test,
  aggregate, normal suite, held-out judge, stage, commit, push, publication,
  or submission ran after implementation.

### 2026-07-30 input29 move-and-eat near side is accepted

- The focused test passes **1/1** in **0.28 seconds** at **149,127,168 bytes**
  RSS with all 34 calls, screens, and cursors exact.
- The timed newt corpse remains on the floor at the kill pager, proving
  consumption has not crossed tty.
- Pin input30 separately before mapping the complete block.  No aggregate,
  normal suite, held-out judge, stage, commit, push, publication, or
  submission ran.

### 2026-07-30 input30 far-side regression is defined

- It pins exact replay through the eating line, absence of the consumed newt
  corpse, and a positive kitten eating delay.
- The paired input29 witness still requires that same corpse to exist before
  acknowledgement.  No test, aggregate, normal suite, held-out judge, stage,
  commit, push, publication, or submission ran after adding the witness.

### 2026-07-30 corpse timing and move-and-eat tty block is accepted

- The input30 test passes **1/1** in **0.27 seconds** at **156,352,512 bytes**
  RSS with its 11 calls plus all prior RNG/screens/cursors exact.
- Input29 retains one timed newt corpse; input30 consumes it and leaves the
  kitten eating.
- Architecture map section593 records `mkcorpstat()` and the deferred
  `dog_eat()` boundary.  Run the session locator next.  No aggregate, normal
  suite, held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 the next seed0030 frontier is input49 call1

- The bounded locator completed in **0.73 seconds** at **193,609,728 bytes**
  maximum RSS, with inputs0--48 exact.
- Both sides begin input49 with `rn2(5) = 1`; native next enters
  `rnd(2) = 2`, `rn2(6) = 4`, and `d(2,6) = 9`, while JavaScript instead
  enters `rnd(12) = 8`.
- Native has 62 calls and JavaScript 32.  Trace the full labeled native slice
  and entry state to the earliest source owner before changing later
  projectile or status behavior.  No aggregate, normal suite, held-out judge,
  stage, commit, push, publication, or submission ran.

### 2026-07-30 input49 is an unported monster falling-rock death

- Native enters `postmov()` -> `mintrap()` -> `trapeffect_rocktrap()` for the
  four-HP dwarf on `(27,6)`, constructs a one-rock missile, deals nine damage,
  and crosses `monkilled()` -> `mondied()` into corpse creation.
- JavaScript has no `ROCKTRAP` branch in `triggerMonsterTrap()`.  The dwarf
  survives and the next rock mole reaches `mdig_tunnel()`'s `rnd(12)`, which
  is the exact first mismatch.
- Implement and pin the unseen source path only, including one-rock quantity,
  stack merge, death before actor tail, dwarf corpse, and exact input49.
  Visible trap prose remains a separate future tty block.  No test, aggregate,
  normal suite, held-out judge, stage, commit, push, publication, or
  submission ran.

### 2026-07-30 the bounded unseen falling-rock path is implemented

- `triggerMonsterTrap()` now owns trap learning, one-rock `t_missile()`
  normalization, `d(2,6)`, shared ordinary corpse creation, dead-actor
  detachment, and stack merge in native order.
- `actorDied` terminates `postmov()` before tunneling or the later actor tail;
  pet-only growth remains outside the shared death helper.
- A focused through-input49 regression pins exact replay plus dwarf removal,
  one dwarf corpse, and total rock quantity eight.  Syntax checks pass; the
  test is pending.  Visible falling-rock tty behavior is not claimed.  No
  aggregate, normal suite, held-out judge, stage, commit, push, publication,
  or submission ran.

### 2026-07-30 unseen falling-rock death is accepted and mapped

- The focused through-input49 regression passes **1/1** in **0.30 seconds**
  at **156,663,808 bytes** RSS; all 62 input49 calls and every prior
  RNG/screen/cursor slice are exact.
- The dwarf is absent, one dwarf corpse is at `(27,6)`, and the older
  quantity-seven rock stack has become eight.
- Architecture map section594 records the trap-object/death/stack transaction
  and its terminal `MMOVE_DIED` edge.  Run the bounded locator next.  Visible
  rock-trap tty behavior is still unclaimed.  No aggregate, normal suite,
  held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 the next frontier is thrown-potion impact after `m_throw`

- The bounded locator completed in **0.66 seconds** at **185,958,400 bytes**
  RSS, with inputs0--49 exact.
- Input50 calls0--7 agree, including both `m_throw()` probes.  Native then
  enters `u_catch_thrown_obj()`, `bottlename()`, and `potionhit()`; JavaScript
  skips the impact and reaches the next actor's movement.
- Native first suspends on the phial-crash line at four HP.  Trace and pin
  only this impact/tty boundary before assigning the later vapor and tired
  pager.  No aggregate, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 correction: offensive-item selection is missing before throw

- Numeric equality at input50 calls6--7 was not owner evidence.  JavaScript
  leaves the sleeping potion carried and advances weapon state; native labels
  those calls in `m_throw()`.
- The earliest missing path is `mattacku()` -> `find_offensive()` ->
  `use_offensive()`.  The gnome's sleeping potion must preempt its bow and
  thirteen arrows.
- The bounded block ends when the evaporation line suspends behind the crash
  line: two flight probes, failed `rn2(88)` catch, “phial”, one impact damage,
  and potion removal.  Input51 vapor effects remain separate.  No test,
  aggregate, normal suite, held-out judge, stage, commit, push, publication,
  or submission ran.

### 2026-07-30 sleeping-potion impact and tty split are implemented

- Phase-four offensive evaluation now preserves `lined_up()` and selects the
  single sleeping potion before bow/arrow handling.
- The source-shaped impact owns two flight probes, failed `rn2(88)` catch,
  bottle naming, one HP damage, potion removal, and the crash-to-evaporation
  tty suspension with the last flight glyph retained.
- A focused through-input50 regression pins exact replay, HP four, and no
  carried sleeping potion.  Syntax checks pass; the test is pending.
  Input51 vapor effects remain separate.  No aggregate, normal suite,
  held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 sleeping-potion impact is accepted and mapped

- The focused through-input50 regression passes **1/1** in **0.30 seconds**
  at **152,879,104 bytes** RSS with all RNG/screens/cursors exact.
- Input50 ends after eleven calls on the phial-crash pager; HP is four and
  the potion has left monster inventory.
- Architecture map section595 records offensive-item preemption, flight,
  catch, impact, and the evaporation tty edge.  Locate input51's vapor
  continuation next.  No aggregate, normal suite, held-out judge, stage,
  commit, push, publication, or submission ran.

### 2026-07-30 input51 is the sleeping-vapor negative-multi continuation

- The bounded locator completed in **0.66 seconds** at **187,318,272 bytes**
  RSS with inputs0--50 exact.
- Native input51 begins with `potionbreathe(POT_SLEEPING)`:
  `rnd(5) = 2`, then Dexterity abuse owns `rn2(2) = 0` and
  `rn2(19) = 18`.  JavaScript skips the pending vapor effect and begins the
  next actor scan.
- Native has 84 calls versus JavaScript's 42, consistent with a two-turn
  negative-`multi` transaction.  Reuse the general helpless scheduler and
  pin input51's tired pager plus input52's zero-RNG recovery message.  No
  aggregate, normal suite, held-out judge, stage, commit, push, publication,
  or submission ran.

### 2026-07-30 sleeping-vapor continuation is implemented

- The post-evaporation continuation now queues the tired line, rolls its
  duration, installs the native helpless reason/recovery message, and abuses
  Dexterity before returning to the shared movement-ration scheduler.
- A focused through-input52 regression pins input51's complete 84-call
  slice, input52's zero-call recovery line, screens/cursors, and cleared
  transaction state.  Syntax checks pass; the test is pending.  No aggregate,
  normal suite, held-out judge, stage, commit, push, publication, or
  submission ran.

### 2026-07-30 the first vapor regression stopped at a missing import

- The focused run failed **0/1** in **0.28 seconds** at **156,008,448 bytes**
  RSS with `ReferenceError: POT_SLEEPING is not defined`, before the new
  branch consumed RNG.
- Import the existing object-data constant into `allmain.js` and rerun the
  unchanged test.  This is a wiring failure, not evidence about the
  scheduler prediction.  No aggregate, normal suite, held-out judge, stage,
  commit, push, publication, or submission ran.

### 2026-07-30 the vapor owner received a transaction, not the raw object

- After the import fix, the focused run failed **0/1** in **0.27 seconds** at
  **148,111,360 bytes** RSS and input51 still skipped all vapor calls.
- The thrown object is `offensivePotion.object`; testing the transaction's
  absent top-level `otyp` returned early.  Correct that field boundary and
  rerun unchanged.  No aggregate, normal suite, held-out judge, stage,
  commit, push, publication, or submission ran.

### 2026-07-30 sleeping vapor reaches `makeknown()` after its effect

- The corrected transaction produced exact `rnd(5)` and Dexterity
  `rn2(2)`, then failed **0/1** in **0.29 seconds** at **156,319,744 bytes**
  RSS before native's `rn2(19)`.
- Native's `potionbreathe()` increments `kn` and sends the visible thrown
  potion through `makeknown()`, so the missing owner is Wisdom discovery
  exercise.  Add that shared tail in source order and rerun unchanged.  No
  aggregate, normal suite, held-out judge, stage, commit, push, publication,
  or submission ran.

### 2026-07-30 input51 now reaches the first actor-state mismatch

- With discovery restored, calls0--7 are exact.  The run failed **0/1** in
  **0.26 seconds** at **155,910,144 bytes** RSS: native call8 is a second
  adjacent `distfleeck()`, while JavaScript skips to the next actor's
  `m_move()`.
- JavaScript has 86 total calls versus native's 84 and does execute two
  scheduler rounds.  Inspect actor identities/action classifications at this
  boundary before editing movement logic.  No aggregate, normal suite,
  held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 the apparent actor gap is the dwarf's wall tunnel

- Scan-history capture shows the dwarf moving `(22,7)` to wall `(23,6)`.
  JavaScript owns debris `rnd(12)` then trailing `distfleeck`; native inserts
  the verbose wall branch's `rn2(5)` between them.
- All thirteen survivors are awake/mobile and no armor reassessment consumes
  the action.  Add `mdig_tunnel()`'s wall probe and terrain conversion; leave
  the zero-roll crashing-rock tty sibling unclaimed.  No aggregate, normal
  suite, held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 the nonzero wall-tunnel branch is implemented

- Tunneling now owns debris `rnd(12)`, verbose wall `rn2(5)`, level-shaped
  wall conversion, vision invalidation, and repaint before the existing
  trailing flee check.
- Nondiggable walls and ordinary room moves retain their separate behavior.
  The zero-roll audible line remains a future tty block.  Syntax checks pass;
  the through-input52 witness is pending.  No aggregate, normal suite,
  held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 inputs51--52 are RNG-exact; recovery tty is early

- The focused run matched all 84 input51 calls and input52's zero-call slice,
  then failed **0/1** in **0.32 seconds** at **163,921,920 bytes** RSS on
  input51's screen.
- Generic live Tourist maintenance appends recovery synchronously instead of
  sending it through `plineWithContinuation()`.  Queue and asynchronously
  drain recovery for live actor-scheduler roles so the tired line pages and
  input52 installs `You can move again.`.  No aggregate, normal suite,
  held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 live-scheduler recovery now shares one tty drain

- Source-ration and generic live actor schedulers queue helpless recovery and
  drain it through the same async `plineWithContinuation()` owner.
- Bounded fast-forward paths keep synchronous append behavior, and rotten
  food's post-recovery `Hear_again()` ordering is preserved.  Syntax checks
  pass; the exact through-input52 test is pending.  No aggregate, normal
  suite, held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 sleeping vapor and the reached wall tunnel are accepted

- The through-input52 regression passes **1/1** in **0.29 seconds** at
  **153,174,016 bytes** RSS with exact RNG/screens/cursors.  Input51 owns 84
  calls and the tired pager; input52 owns zero calls and the recovery line.
- Architecture map section596 records vapor, discovery, negative multi, and
  recovery tty.  Section597 records the nonzero verbose wall-tunnel branch.
  Run the bounded seed0030 locator next.  The zero-roll crashing-rock tty
  sibling remains unclaimed.  No aggregate, normal suite, held-out judge,
  stage, commit, push, publication, or submission ran.

### 2026-07-30 the next frontier is ordinary death/bones at input73

- The bounded locator completed in **0.65 seconds** at **186,597,376 bytes**
  RSS with inputs0--72 exact.  Native input73 owns
  `rn2(1) @ can_make_bones`; JavaScript owns no RNG.
- The zero rejects bones.  This session disables all six disclosure sections,
  so the death pager must lead directly to the Mines tombstone, blank More,
  and ordinary score124 entry.  Implement that shared terminal transaction
  and pin through input78.  No aggregate, normal suite, held-out judge,
  stage, commit, push, publication, or submission ran.

### 2026-07-30 the ordinary reject-and-skip death tail is implemented

- Fatal contact probes bones before the death pager.  The terminal owner now
  interprets disclosure prefixes, skips disabled sections, uses the current
  dungeon on the tombstone, and renders an ordinary live-state score entry.
- A through-input78 test pins exact RNG/screens/cursors, rejected bones, and
  gameover.  Syntax checks pass; the test is pending.  Positive bones and
  disclosure branches remain separate.  No aggregate, normal suite,
  held-out judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 the first terminal regression exits the bones probe early

- The focused run failed **0/1** in **0.26 seconds** at **151,240,704 bytes**
  RSS because input73 still consumed zero calls instead of native's
  `rn2(1)`.
- The matching death pager proves the fatal path is reached.  Inspect which
  `can_make_bones()` eligibility gate is falsely rejecting the initialized
  Mines state, correct that gate only, and rerun the unchanged through-input78
  witness.  No aggregate, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-30 the portal gate must use the branch graph

- At death the hero is on Mines `{ dnum: 2, dlevel: 1 }`, the level contains
  a type21 magic portal, and that coordinate is an endpoint in
  `game.branches`.
- Native exempts branch endpoints from its portal rejection.  Replace the
  unset `level.flags.branch_level` surrogate with the branch graph and use
  absolute dungeon depth for the reservoir denominator, then rerun the same
  terminal witness.  No aggregate, normal suite, held-out judge, stage,
  commit, push, publication, or submission ran.

### 2026-07-30 the bones probe now uses shared topology and depth

- `probeCanMakeBones()` matches both initialized branch endpoints and uses
  absolute dungeon `depth()` for its reservoir.
- The portal remains ineligible off a branch endpoint; positive bones
  construction remains downstream.  Syntax checks pass and the unchanged
  through-input78 test is pending.  No aggregate, normal suite, held-out
  judge, stage, commit, push, publication, or submission ran.

### 2026-07-30 terminal RNG is exact; tombstone values are next

- The through-input78 run failed **0/1** in **0.33 seconds** at
  **160,628,736 bytes** RSS, but its complete RNG comparison passed.
  Inputs0--74 are screen/cursor exact.
- Input75 reaches the tombstone with differing numeric cells.  Compare only
  bounded rendered rows and fix the live summary projection; do not repeat
  the full cell-matrix dump.  No aggregate, normal suite, held-out judge,
  stage, commit, push, publication, or submission ran.

### 2026-07-30 duplicate yielded suites caused the OOM incident

- Two identical full Contest verifiers were launched 35.8 seconds apart and
  abandoned after yielding; both process trees remained live for about
  56--57 minutes and their workers reached roughly 192 GB and 178 GB.
- A yielded verifier is now treated as owned and live until its exact process
  tree exits or is terminated.  The process-registry guard precedes every
  focused, locator, corpus, and suite run.  MCP-server and PostgreSQL-query
  explanations are falsified by the process lineage.

### 2026-07-30 input75 exposes missing Tourist first-entry credit

- JavaScript reaches death with `u.urexp = 4`; native credits score8 on first
  entering main depth2, score12 on first entering Mines absolute depth3, then
  score4 for the newt.
- Restore that +20 in the new-level transaction, not the terminal renderer.
  The death summary must use absolute current/deepest depth so its +100 depth
  bonus yields native score124.  Rerun only the through-input78 focused
  witness; positive bones and enabled disclosures remain unclaimed.

### 2026-07-30 first-visit Tourist credit and absolute death depth are implemented

- A shared helper now credits Tourists only after a new destination is built;
  both transition owners use source `level_difficulty()` and cached revisits
  skip the award.
- Death summaries project current and deepest cached floors to absolute depth
  and include both native depth-bonus bands.  Syntax checks pass; the focused
  through-input78 witness is pending.  Threshold-crossing `newexplevel()`
  behavior remains unclaimed.

### 2026-07-30 the score page is overwritten after terminal return

- The focused test exits **0/1** in **0.35 seconds** at **297,123,840 bytes**
  RSS with inputs0--77 exact.  Input78 should retain the top-ten list, but the
  normal movement-loop display tail redraws the dungeon after terminal return.
- Stop that source-turn branch immediately once `gameover` is set.  Replace
  the death test's whole-screen deep assertion with a bounded first-cell
  diagnostic before rerunning; the failed formatter emitted over 83k tokens.

### 2026-07-30 fatal source-turn return and bounded screen diagnostics are implemented

- The live-role maintenance branch now stops immediately when the monster
  scan reaches gameover, preserving the terminal score page.
- The death witness compares screens cell by cell and reports only the first
  mismatch plus row text.  Syntax checks pass; rerun the single named
  through-input78 test after the process guard.

### 2026-07-30 score text is exact; leading bold blanks remain

- The bounded rerun exits **0/1** in **0.30 seconds** at **157,499,392 bytes**
  RSS.  Input78's score row text is exact, but native keeps bold on its first
  two literal spaces while serialization drops that metadata.
- Honor the existing explicit leading-styled-blank capture mode for bold and
  activate it on the ordinary score page.  Then rerun the same named witness.

### 2026-07-30 top-ten capture now preserves its leading bold blanks

- Explicit leading-style capture now includes bold only while that mode is
  active; the ordinary score page activates it after clearing.
- Tombstone and default captures retain their prior rules.  Syntax checks
  pass; exact through-input78 RNG/screens/cursors remain the acceptance gate.

### 2026-07-30 seed0030 ordinary death is accepted through input78

- The named witness passes **1/1** in **0.30 seconds** at **158,285,824
  bytes** RSS with exact RNG/screens/cursors, rejected bones, and gameover.
- Architecture section598 records first-visit Tourist credit, branch-topology
  bones eligibility, absolute death depth/score, terminal tty, and the
  non-returning gameover boundary.  Run the bounded seed0030 locator next.

### 2026-07-30 segment1 input10 is the next RNG frontier

- The locator completes in **0.69 seconds** at **187,777,024 bytes** RSS with
  segment0 exact.  Segment1/input10 has exact screen/cursor and one wrong RNG
  domain at call13: JavaScript `rn2(100)` versus native
  `rn2(8) @ dog_goal`.
- The calls before and after align, so inspect the pet goal's candidate-count
  branch and pin a focused through-input10 witness before another locator.

### 2026-07-30 an invented direct-ray gate suppresses native dog_goal RNG

- The kitten at `(22,16)` can reach the amulet at `(27,16)` through a
  strictly closer route via row15 even though stone blocks the direct ray.
- C uses recursive `can_reach_location()`; JavaScript already ports it but
  additionally requires `clearPath()`.  Remove that extra gate, which should
  restore `rn2(8)=5` without changing the rejected apport goal or screen.

### 2026-07-30 dog_goal now uses only source monotone reachability

- The direct-ray prerequisite is removed; floor-fetch goals use the existing
  item-terrain and recursive strictly-closer reachability gates.
- A new engine-only segment1 through-input10 test pins exact RNG, screens, and
  cursors with bounded diagnostics.  Syntax checks pass; the test is pending.

### 2026-07-30 removing clearPath alone opens dog_goal one input too early

- The focused test exits **0/1** in **0.25 seconds** at **156,696,576 bytes**
  RSS: input9 gains a non-native `rn2(8)` and 29 calls versus28.
- Restore the prior gate while comparing the exact input9/input10 visibility,
  lighting, and reachability state.  A second over-permissive predicate is
  hidden behind the non-source ray surrogate.

### 2026-07-30 the native recorder probe yielded no valid dog-goal evidence

- Missing generated `sysconf` explained the zero-step captures.  Restoring it
  recovered the ten segment lengths, but fresh RNG arrays stayed empty and
  temporary dog-goal stderr probes were not observable through the recorder.
- The owned direct probe was terminated, its process was confirmed gone, and
  its approximately 1.1 GB marker stream plus three companion files were
  removed.  All temporary C probe hooks are gone and the recorder binary was
  rebuilt without replacing `sysconf`.
- Do not infer native state from these invalid runs.  Locate the likely hidden
  first pet destination during input9 from source candidate ordering and
  bounded JavaScript action-state diagnostics.

### 2026-07-30 MANFOOD is the changing dog-goal predicate

- The bounded action log falsifies a hidden intermediate-position mismatch:
  the two relevant JS pet actions are `(21,16)->(22,15)->(22,16)` and then
  `(22,16)->(23,15)->(22,16)`.
- The earlier APPORT amulet is monotone-reachable but not in monster
  line-of-sight.  The later action brings a tin into range; C classifies it as
  MANFOOD and explicitly bypasses `m_cansee()` for that class.
- Port `otyp == MANFOOD || m_cansee(...)` exactly, retaining the shared item
  and recursive-reachability gates, then rerun only the through-input10 test.

### 2026-07-30 the MANFOOD visibility exception is implemented

- `dogGoal()` now bypasses `clearPath()` only for MANFOOD.  APPORT still
  requires it, and both classes retain the shared source eligibility gates.
- Syntax checks pass.  Exact engine-only RNG/screens/cursors through
  segment1/input10 remain the acceptance witness.

### 2026-07-30 the MANFOOD visibility block is accepted through input10

- The single named engine-only test passes **1/1** in **0.28 seconds** at
  **158,269,440 bytes** RSS with exact RNG/screens/cursors through input10.
- Architecture section599 records the negative APPORT sight gate and positive
  MANFOOD exception before the shared apport and carry checks.  Run the
  bounded one-result seed0030 locator next.

### 2026-07-30 segment1 input31 is the next RNG frontier

- The locator completes in **0.68 seconds** at **184,975,360 bytes** RSS with
  segment1 inputs0--30 exact and exact screen/cursor at input31.
- After 38 aligned calls, native has `rn2(4)`, `rn2(75)`, `rn2(50)` where JS
  proceeds to `rn2(100)` calls; attribute the bounded neighborhood to actors
  and source phases before changing code.

### 2026-07-30 ambient PM_KOBOLD skips its weapon initializer

- Both engines construct the same off-screen level0 kobold at `(66,14)` with
  HP4 and male sex.  JS then skips native S_KOBOLD `m_initweap()`.
- Port the failed `rn2(4)` dart gate and `rn2(75)` offensive-item gate using
  real object construction on success.  Existing common inventory and saddle
  calls should then realign without changing this empty-handed witness.

### 2026-07-30 ambient S_KOBOLD weapon initialization is implemented

- The ambient constructor now creates and sizes real darts on the one-in-four
  branch and uses the shared offensive-item resolver after `rn2(75)`.
- A through-input31 exact test also asserts that this level0 kobold remains
  empty-handed.  Syntax checks pass; the single named witness is pending.

### 2026-07-30 ambient S_KOBOLD initialization is accepted through input31

- The named engine-only test passes **1/1** in **0.30 seconds** at
  **160,546,816 bytes** RSS with exact RNG/screens/cursors and an empty-handed
  level0 kobold.
- Architecture section600 maps the runtime pressure-to-constructor chain and
  records the remaining ambient/level-construction consolidation debt.  Run
  the bounded one-result locator next.

### 2026-07-30 segment1 input35 is the next combat frontier

- The locator completes in **0.71 seconds** at **186,859,520 bytes** RSS with
  inputs0--34 exact.  Native appends `The lichen misses the kitten.` after the
  shared pet-bite line; JS omits it.
- Both take the nonzero `rn2(4)` counterattack gate.  Inspect defender
  `mlstmv`, adjacency, and scary-square predicates before adding the native
  `rnd(20)` attack transaction.

### 2026-07-30 zero-damage lichen touch was filtered out

- The lichen is adjacent, alive, unstamped for the source turn, and not on a
  scary square.  Its valid attack is `AT_TUCH/AD_STCK 0d0`.
- Native terminates on attack type0, not zero damage dice.  Retain recognized
  zero-dice attacks so the lichen owns its to-hit/miss/passive transaction;
  keep the source scary-square veto in both combat paths.

### 2026-07-30 zero-damage counterattack enumeration is implemented

- Recognized 0d0 attack slots now reach monster melee; only unrecognized type0
  terminates enumeration.  Both counter paths also keep native's scary-square
  veto.
- A through-input35 exact test asserts the live lichen touch counterattack
  misses.  Syntax checks pass; the single named witness is pending.

### 2026-07-30 the lichen counterattack miss is accepted through input35

- The named engine-only test passes **1/1** in **0.29 seconds** at
  **158,072,832 bytes** RSS with exact RNG/screens/cursors and a live missed
  touch counterattack.
- Architecture section601 maps the shared pet-hit/counterattack tty
  transaction.  Successful AD_STCK remains unclaimed; run the bounded locator
  next.

### 2026-07-30 segment1 input39 is the next pet-food frontier

- The locator completes in **0.71 seconds** at **187,842,560 bytes** RSS with
  inputs0--38 exact.  JS eats a lichen corpse; native leaves the topline blank.
- After the shared first object `rn2(100)`, native enters `rn2(8)` while JS
  scans another object and later eats.  Compare exact `dogfood()` corpse
  classification and floor-chain order before changing movement or tty.

### 2026-07-30 a lichen corpse is MANFOOD for the kitten

- The fresh age36 PM_LICHEN corpse is newest in the floor chain below a
  content kitten with hungrytime1000.  Native `vegan()` classifies all fungi
  as vegetable matter, so the carnivore returns MANFOOD rather than CADAVER.
- Port the source vegan corpse predicate and lizard/lichen nonrotting stale
  exception.  The corpse should reach `rn2(8)` but remain uneaten.

### 2026-07-30 vegan corpse classification is implemented

- `dogFood()` now ports the source vegan monster classes and
  elemental/golem exceptions; lizard and lichen also bypass stale poisoning.
- A through-input39 exact test asserts that the PM_LICHEN corpse remains and
  the kitten is not eating.  Syntax checks pass; the named witness is pending.

### 2026-07-30 vegan lichen-corpse handling is accepted through input39

- The named engine-only test passes **1/1** in **0.34 seconds** at
  **160,841,728 bytes** RSS with exact RNG/screens/cursors, a retained
  PM_LICHEN corpse, and no kitten eating delay.
- Architecture section602 maps corpse hazard/species/diet classification.
  Run the bounded one-result locator next.

### 2026-07-30 segment1 input50 is the next presentation frontier

- The locator completes in **0.71 seconds** at **186,548,224 bytes** RSS with
  inputs0--49 exact and exact RNG/cursor at input50.
- Native retains `I` at `(49,5)` while JS paints corridor `#`.  Trace the
  `map_invisible()` producer or premature marker removal around the preceding
  actor/display transition.

### 2026-07-30 input50 is the `pre_mm_attack()` marker boundary

- Screen `(49,5)` is game `(50,4)`, the kitten's attack square.  Native and JS
  have identical grid-bug and kitten actor order, positions, and per-actor RNG
  domains; actor-order and old-square repaint hypotheses are falsified.
- Native sees and spots the defender, making `gv.vis` true, then maps the
  unspotted aggressor before its bite-miss line.  JS now ports that
  `cansee && canspotmon` visibility and marker policy.

### 2026-07-30 visible-combat invisible marking is accepted through input50

- The named engine-only witness passes **1/1** in **0.28 seconds** at
  **159,580,160 bytes** RSS with exact RNG/screens/cursors and remembered `I`
  at game `(50,4)`.
- Architecture section603 maps the accepted ownership.  Mimic and
  `mundetected` revelation remain outside this witness; run the bounded
  locator next.

### 2026-07-30 segment1 input55 is the next death/corpse frontier

- The bounded locator completes in **0.48 seconds** at **179,470,336 bytes**
  RSS with inputs0--54 exact.  JS leaves `%` at screen `(51,4)`, game
  `(52,3)`, while native shows water.
- After shared `rn2(3)=0`, JS calls `rnd(2)` and native `rnd(1)`; identify the
  victim, aggressor, water/corpse eligibility, and growth inputs before
  changing presentation or downstream actor behavior.

### 2026-07-30 `G_NOCORPSE` is the input55 producer gate

- The expected DEC `~` is remembered ROOM, not water.  The victim is a level0
  grid bug killed by the kitten; identity, level, damage, and accessibility
  agree.
- Native consumes `corpse_chance()` and then rejects `G_NOCORPSE` inside
  `make_corpse()` before object initialization.  JS currently creates the
  forbidden corpse, explaining every extra call before the later `rnd(1)`
  growth roll.

### 2026-07-30 grid-bug corpse suppression is implemented

- Ordinary monster death now preserves the chance draw and then applies
  `G_NOCORPSE` before `mkcorpstat()`.  Pet-kill diagnostics report the actual
  corpse result.
- A through-input55 exact witness asserts no grid-bug corpse at `(52,3)` and
  retains native's `rnd(1)` growth call; the named witness is pending.

### 2026-07-30 grid-bug corpse suppression is accepted through input55

- The named engine-only witness passes **1/1** in **0.31 seconds** at
  **159,940,608 bytes** RSS with exact RNG/screens/cursors, no forbidden
  corpse, and native's level0-victim `rnd(1)` growth domain.
- Architecture section604 maps chance before eligibility before optional
  object construction.  Run the bounded locator next.

### 2026-07-30 segment1 input59 reaches the next generation boundary

- The locator completes in **0.54 seconds** at **177,881,088 bytes** RSS with
  inputs0--58 exact; screen/cursor remain exact at the `>` descent.
- Destination generation first differs at call41: native begins
  `rn2(1), rn2(2), rn2(3)` while JS enters `rn2(3), rn2(1000), rn2(1001)`.
  Attribute the exact C/Lua reservoir or constructor before editing geometry
  or fast-forward counts.

### 2026-07-30 the default themed-fill room skips its Lua callback

- The room reservoir selects `Default room with themed fill`.  Native invokes
  `themeroom_fill()` after `create_room()`, scans thirteen eligible fills, and
  selects Storeroom at `rn2(12)=0`.
- JS already implements the same fill reservoir and Storeroom but dispatches
  it only for the combined normal-plus-themed variant.  Route Default, Unlit,
  and combined themed-fill rooms through the shared callback.

### 2026-07-30 themed-fill callback dispatch is implemented

- Default, Unlit, and combined themed-fill variants now run the shared fill
  reservoir.  Only the combined variant also retains ordinary `filled=1`.
- A through-input59 exact witness pins the thirteen fill-reservoir calls and
  the complete destination generation slice; the named witness is pending.

### 2026-07-30 default themed-fill Storeroom is accepted through input59

- The named engine-only witness passes **1/1** in **0.32 seconds** at
  **159,498,240 bytes** RSS with exact RNG/screens/cursors across the full
  **2,721-call** generation transaction.
- Architecture section605 maps room selection, C geometry, immediate Lua fill
  dispatch, Storeroom, and the separate ordinary-fill bit.

### 2026-07-30 segment2 input22 is the next floor-description frontier

- The locator completes in **0.47 seconds** at **176,193,536 bytes** RSS; no
  segment1 mismatch appears through the bounded input70 window.
- RNG/cursor are exact at segment2/input22.  Native prefixes the already exact
  kobold-corpse clause with `There is a staircase down here.`; trace
  `look_here()` terrain-plus-object composition.

### 2026-07-30 stairway and one-object composition is accepted through input22

- `finishDestinationSpotEffects()` now asks the inventory/look owner for the
  stairway feature before selecting its object-count presentation branch.
  The one-object path emits feature then object as ordinary plines, leaving
  their two-space same-line composition to tty.
- The named engine-only witness passes **1/1** in **0.29 seconds** at
  **160,055,296 bytes** RSS with exact RNG/screens/cursors and the hero on the
  down stair with exactly one PM_KOBOLD corpse.
- Architecture section606 maps this `spoteffects()` to `look_here()` boundary.
  Other `dfeature_at()` terrain classes remain outside the accepted slice.

### 2026-07-30 segment2 input24 is the next corpse-consumption frontier

- The bounded locator completes in **0.54 seconds** at **178,634,752 bytes**
  RSS with segment2 exact through input23.
- After shared `rn2(20)=14`, native enters `rn2(5)`, `rnd(4)`, `rnd(15)` and
  the poisonous-corpse pager; JS enters `rn2(7)` and eventually reports a
  gamey, completed kobold meal.
- Trace the PM_KOBOLD poison predicate and `eatcorpse()` chance/damage/pager
  transaction before changing meal timing or later actor RNG.

### 2026-07-30 poisonous kobold consumption is accepted through input24

- PM_KOBOLD's generated `M1_POIS` now selects the source-ordered four-in-five
  poison gate before stale/rot/flavor logic.  The accepted witness pins
  `rn2(20)=14`, `rn2(5)=3`, `rnd(4)=4`, and `rnd(15)=3`, plus Strength four.
- Corpse completion now emits an independent `done_eating()` line through tty.
  The pending poison line therefore overflows into `--More--` before the
  finish line, while ordinary jackal and lichen taste lines still compose.
- The poison witness passes **1/1** in **0.28 seconds** at **150,257,664
  bytes** RSS; focused jackal and lichen regressions also pass.  Architecture
  section607 maps the full hazard-to-pager chain.

### 2026-07-30 segment2 input37 is the next offscreen actor frontier

- The bounded locator completes in **0.51 seconds** at **177,815,552 bytes**
  RSS with inputs0--36 exact and an exact screen/cursor at input37.
- RNG first differs at call11: JS enters `rn2(16)=13`, while native enters
  `rn2(5)=1` then `rn2(12)=2`; lengths are 20 versus 19.
- Attribute the call to an exact actor and movement candidate owner before
  editing a generic random range or later scheduler order.

### 2026-07-30 native proof moves the frontier back to input35 item targeting

- A bounded PM_GOBLIN C probe shows native moving the offscreen goblin from
  `(20,8)` toward `(21,4)` and selecting `(21,7)` from five candidates with
  empty `mtrack` and no inner RNG.  JavaScript instead selects `(19,8)`.
- The input37 `rn2(16)` is downstream: JavaScript's wrong input35 destination
  creates the track state that later enters avoidance sampling.
- The native target is printed after `m_search_items()` and lies within its
  five-square object scan.  Inspect the object at `(21,4)`, desirability,
  carryability, scan order, and path gate before changing `mfndpos()`.
- The recorder probe was exact-PID terminated and confirmed gone; temporary C
  instrumentation and `sysconf` changes were removed and the recorder rebuilt
  clean.  No full corpus or publication gate has run.

### 2026-07-30 the native input35 target is a live tripe-ration goal

- JavaScript has the same tripe ration at `(21,4)` within the goblin's
  radius-five item scan.  The actor has `M2_COLLECT`, can carry it, has a clear
  path, and the square has no known trap or special-prize exclusion.
- The item itself and the shared desirability/carryability/path gates are not
  the rejection.  The remaining boundary is the `getitems`/`in_line` decision
  or a later approach-state override before `mfndpos()`.

### 2026-07-30 JavaScript stops on an on-square shop-stock candidate

- The bounded branch probe proves `getitems=true` and `in_line=false`.
  JavaScript selects the worthless-black-glass stack at the goblin's own
  `(20,8)` square, reducing the item-search radius to zero; native skips that
  pile and continues to the tripe ration.
- C excludes merchandise on `costly_spot()` unless the object has
  `no_charge`.  JavaScript lacks this gate, and the black glass is charged.
  Verify the room/shop ownership of `(20,8)`, then port the source condition.

### 2026-07-30 current JavaScript shop ownership does not mark `(20,8)` costly

- `costlySpot(20,8)` is false in the bounded pre-input35 state, so the
  shop-merchandise explanation is not accepted and no gate has been added.
- The next proof must distinguish hidden native room/object metadata, a
  source-only square exclusion such as `onscary()`, or the glass stack being
  absent from native's floor chain.

### 2026-07-30 JavaScript's black-glass stack has no remaining source rejection

- `(20,8)` is an ordinary room with no shop, engraving, trap, special-prize
  marker, or unsafe/carryability condition.  The two black-glass pieces should
  be accepted by C if the same floor-chain object exists natively.
- Capture the native `(20,8)` floor chain and object identity.  Do not add a
  shop, scary-square, or item-policy gate without that witness.

### 2026-07-30 native completes and picks up the on-square glass stack

- Native has the same `otyp=467`, `id=108`, quantity-two stack and reports it
  wanted, carryable, safe, non-shop, and non-prize.
- `m_search_items()` sets `MMOVE_DONE` for an on-square goal and returns to
  `postmov()`, whose `mpickstuff()` transfers the stack.  JavaScript finds the
  radius-zero goal but continues into candidate movement.
- Implement the generic stationary-completion boundary and use the existing
  post-move pickup owner; then prove exact state and replay through input37.

### 2026-07-30 on-square hostile item pickup is accepted through input37

- The named engine-only witness passes **1/1** in **0.32 seconds** at
  **160,514,048 bytes** RSS with exact RNG/screens/cursors through input37.
- The goblin carries the two black-glass pieces, the `(20,8)` floor pile is
  gone, and the actor later reaches native `(21,7)`.
- Architecture section608 maps the accepted early-return and post-move pickup
  chain.  Run the bounded locator next; no full corpus gate has run.

### 2026-07-30 segment2 input59 is the next force-fight presentation boundary

- The bounded locator completes in **0.54 seconds** at **179,322,880 bytes**
  RSS with segment2 inputs0--58 exact.
- Input59 has exact RNG/cursor and the same trailing goblin hit.  JavaScript
  says `You harmlessly attack the wall.` where native says
  `You attack thin air.`
- Inspect destination terrain, remembered glyph/`I`, force-fight state, and
  `domove_fight_empty()` ordering before changing prose.

### 2026-07-30 force-fight re-enters shared movement and is accepted through input59

- A bounded pre-direction snapshot proves input59 is the `l` collected by
  input58's `F`, targeting empty accessible `CORR` at `(56,4)` from hero
  `(55,4)`.  There is no live actor or remembered invisible marker.
- `doforcefight()` now preserves its nested tty clear/flush, sets transient
  `context.forcefight`, and delegates the direction to `domove()`.
  `fightEmptyDestination()` owns the shared source classification; accessible
  emptiness says `You attack thin air.` while solid targets remain harmless
  obstacle attacks.
- The named engine-only witness passes **1/1** in **0.34 seconds** at
  **152,748,032 bytes** RSS with exact RNG/screens/cursors through input59,
  stationary hero state, and the force-fight flag cleared.  Architecture
  section609 maps the accepted boundary; no full corpus gate has run.

### 2026-07-30 segment4 input8 is the next object-projection frontier

- The bounded locator completes in **0.52 seconds** at **178,159,616 bytes**
  RSS; segment2 stays exact through the 70-input bound.
- Segment4 input8 has exact RNG/cursor and differs first at map cell `(50,4)`:
  JavaScript shows gray corridor `#`, native a white object/scroll glyph `?`.
- Snapshot the concrete pile, remembered glyph, visibility, and display owner
  before and after the move; distinguish absent object generation from a
  missing or overwritten `newsym()` projection before editing.

### 2026-07-30 input8 is a silent kitten drop onto an about-to-be-unseen square

- Terminal `(50,4)` is level `(51,3)`.  The kitten drops its carried blank
  paper there during input8, then moves from `(51,3)` to `(50,3)`.
- JavaScript retains the correct object but links it only after its one-cell
  visibility becomes `couldsee=true`, `cansee=false`; vacated-square
  `newsym()` restores corridor memory instead of the scroll.
- The environment-gated JS trace was removed.  Probe native `relobj()` and
  the later `newsym()` for visibility, `minvis`, map glyph, and floor head
  before changing drop projection.

### 2026-07-30 stationary pet postmov is accepted through segment4 input8

- A byte-exact native probe proves `dog_move()` returns `MMOVE_MOVED` after
  the kitten silently drops blank paper but remains at `(51,3)`.
  `postmov()` redraws the same square twice and records the object below it.
- JavaScript now distinguishes completed pet post-move status from coordinate
  displacement.  Old/destination redraws use either status; movement-only
  door, tracking, and reluctance paths still require real displacement.
- The named engine-only witness passes **1/1** in **0.28 seconds** at
  **165,543,936 bytes** RSS with exact RNG/screens/cursors through input8 and
  explicit blank-paper/object-memory state.  Architecture section610 maps the
  boundary; all temporary C probes were removed and the recorder rebuilt clean.

### 2026-07-30 segment4 input46 is the next fountain prompt frontier

- The bounded locator completes in **0.53 seconds** at **179,077,120 bytes**
  RSS with segment4 exact through input45.
- Input46 `y` has exact RNG/cursor, but JavaScript still shows
  `Drink from the fountain? [yn] (n)` where native already shows
  `This tepid water is tasteless.`
- Trace the prompt-opening input, captured nested boundary, pending prompt
  state, and accepted-response cleanup before changing fountain prose or RNG.

### 2026-07-30 fountain confirmation and fate12 are accepted through segment4 input46

- Input45 proves that both engines opened the same generated fountain query at
  cursor column34.  Input46 spends the same `rnd(30)=12` and `rn2(3)=2`; the
  mismatch was not input or RNG alignment.
- Fountain and sink confirmations now use the shared yes/no transaction with
  the required tty cursor offset, so accepted answers clear the modal line.
  Fountain fate12 enters C's default tepid-water arm before the non-drying
  roll.
- The named engine-only witness passes **1/1** in **0.33 seconds** at
  **155,205,632 bytes** RSS with exact RNG/screens/cursors through input46,
  unchanged fountain terrain, and the exact pending result.  Architecture
  section611 maps the accepted boundary; no full corpus gate has run.

### 2026-07-30 segment5 input2 is the next BUC-name projection frontier

- The bounded locator completes in **0.52 seconds** at **180,469,760 bytes**
  RSS with segments0--4 exact through the 70-input bound.
- Segment5 input2 has exact RNG/cursor and the same three inventory objects,
  but JavaScript says `a candy bar` where native says
  `a cursed candy bar`.
- Inspect the command/menu formatter plus the candy bar's `cursed` and `bknown`
  state and locate the source knowledge producer before changing object prose.

### 2026-07-31 Priest floor naming is accepted through segment5 input2

- The bounded state witness proves the floor has the correct uncursed healer
  corpse, one cursed candy bar, and seven uncursed darts.  The Candy Bar's
  curse bit was already correct; floor naming had not established `bknown`.
- Shared naming helpers now implement `xname()`'s Cleric observation.  Every
  floor object becomes beatitude-known, neutral Priest items suppress the
  redundant adjective, and the cursed food displays its source prefix.
- The named engine-only witness passes **1/1** in **0.27 seconds** at
  **156,991,488 bytes** RSS with exact RNG/screens/cursors through input2 and
  explicit BUC state for all three objects.  Architecture section612 maps the
  accepted boundary; no full corpus gate has run.

### 2026-07-31 segment5 input5 is the next dart-trap RNG frontier

- The bounded locator completes in **0.50 seconds** at **178,274,304 bytes**
  RSS with segment5 exact through input4.
- Input5 has exact screen/cursor but JavaScript lacks native's third
  `rn2(12)=8` before the later monster scheduler rolls; the per-input totals
  are 18 versus 20.
- Inspect the dart trap's projectile construction, hit/miss, and surviving
  object state at the first missing call.  Do not patch the later `rn2(70)`
  symptom.

### 2026-07-31 ordinary Priest live allocation is accepted through segment5 input5

- The dart owner was already exact through object initialization, poison,
  damage, miss, and floor placement.  Native's next five calls were
  `mcalcmove()` for five live actors; JavaScript had fallen through to a
  four-actor seed8000 Tourist replay.
- Ordinary non-cast Priests now enter the generic live scheduler.  The first
  allocation visits little dog, grid bug, kobold zombie, lichen, and jackal
  with grants `24,12,12,0,12`, then runs live global maintenance.
- The named engine-only witness passes **1/1** in **0.28 seconds** at
  **156,778,496 bytes** RSS with exact RNG/screens/cursors through input5 and
  explicit allocation/projectile state.  Architecture section613 maps the
  accepted boundary; no full corpus gate has run.

### 2026-07-31 segment5 input6 is the next little-dog pickup frontier

- The bounded locator completes in **0.56 seconds** at **180,568,064 bytes**
  RSS with segment5 exact through input5.
- Input6 should say `The little dog picks up a glass wand.`; JavaScript is
  blank and first skips native's third `rn2(100)=47` before `rn2(8)=3`.
- Snapshot the dog's live candidate piles, edog goal, inventory, destination,
  and per-call source sites before changing pickup prose or later actor RNG.

### 2026-07-31 trap-missile fobj placement is accepted through segment5 input6

- The missed trap dart was correctly present on `(74,4)` but bypassed
  `place_object()`, so it lacked global newest-first order and appeared after
  older generated objects in `dog_goal()`.
- Dart misses now use the shared placement lifecycle.  The restored fobj head
  yields native object screens, wand goal, pickup, post-pickup move to
  `(74,5)`, and the next 24-point pet allocation.
- The named engine-only witness passes **1/1** in **0.26 seconds** at
  **155,680,768 bytes** RSS with exact RNG/screens/cursors through input6 and
  explicit fobj/floor/inventory state.  Architecture section614 maps the
  accepted boundary; no full corpus gate has run.

### 2026-07-31 segment5 input51 is the next boulder-occupant tty frontier

- The bounded locator completes in **0.53 seconds** at **180,535,296 bytes**
  RSS with segment5 exact through input50.
- Input51 has exact RNG.  JavaScript emits generic push failure; native says
  `You hear a monster behind the boulder.--More--` at cursor column46.
- Snapshot the boulder destination, live occupant, visibility, remembered
  glyph, and `moverock()` message-window ordering before changing prose.

### 2026-07-31 boulder-hidden occupant handling is accepted through segment5 input51

- The hero at `(32,10)` pushes the boulder at `(31,10)` toward an unspotted
  live jackal at `(30,10)`.  This is not generic strength or terrain failure.
- The physical-occupant branch now publishes the heard-monster line, records
  invisible memory, and lets the verbose explanation naturally force tty's
  pager at column46.
- The named engine-only witness passes **1/1** in **0.31 seconds** at
  **159,416,320 bytes** RSS with exact RNG/screens/cursors through input51 and
  stationary hero/boulder/jackal state.  Architecture section615 maps the
  accepted boundary; no full corpus gate has run.

### 2026-07-31 segment6 input30 is the next pool/object lifetime frontier

- The bounded locator completes in **0.53 seconds** at **180,862,976 bytes**
  RSS with segment5 exact through the 70-input bound.
- Segment6 input30 has exact RNG/cursor, but JavaScript shows a brown `%` at
  terminal `(37,10)` where native shows the underlying water glyph.
- Map the coordinate and inspect concrete object, floor chain, terrain,
  lifetime owner, visibility, memory, and nearby actors before changing
  projection.

### 2026-07-31 pet eating postmov is accepted through segment6 input30

- Correction: `(38,9)` is ROOM terrain rendered by DECgraphics, not a pool.
  The jackal corpse was already absent from the floor after input27; only its
  remembered `%` survived under the stationary kitten.
- The pre-message eating repaint remains, but after consumption resumes its
  phase marker clears and shared pet postmov stores the object-free terrain.
- The named engine-only witness passes **1/1** in **0.40 seconds** at
  **167,575,552 bytes** RSS with exact RNG/screens/cursors through input30 and
  explicit empty-pile/stationary-pet/terrain-memory state.  Architecture
  section616 maps the accepted boundary; no full corpus gate has run.

### 2026-07-31 segment6 input56 descent is the next generation frontier

- The bounded locator completes in **0.55 seconds** at **180,191,232 bytes**
  RSS with segment6 exact through input55.
- The descending level matches native through generation call1065, then
  JavaScript emits `rn2(6), rn2(8)...` where native begins
  `rnd(5), rnd(5), rnd(3)...`; totals are 3,716 versus 4,004.
- Compare only a bounded annotated neighborhood around call1066 and identify
  the earliest constructor/phase.  Do not use a whole-log assertion.

### 2026-07-31 failed Fake Delphi transaction is accepted through segment6 input56

- The second input56 reservoir pass selects Fake Delphi, whose Lua declaration
  specifies an ordinary filled `11x9` outer and a conditional `3x3` child at
  relative `(4,3)`.
- JavaScript had routed that entry through the dimensionless generic fallback,
  entering `rnd_rect()` instead of fixed-room placement.  A dedicated
  source-shaped generator now uses the shared room/child/door transactions.
- On this map the fixed outer exhausts its placement attempts and no child is
  created; retrying the reservoir is part of the accepted behavior.
- The named engine-only witness passes **1/1** in **0.38 seconds** at
  **178,094,080 bytes** RSS with exact RNG/screens/cursors through input56,
  committed depth3, and explicit absent-room state.  The bounded locator is
  exact through segment6/input70 and advances to segment7/input28.
- Architecture section617 maps the declaration-attempt/failure/retry boundary.
  No full corpus gate has run.

### 2026-07-31 segment7 input28 is the next pet attack-verb frontier

- The bounded locator completes in **0.61 seconds** at **186,613,760 bytes**
  RSS with all earlier bounded inputs exact.
- RNG and cursor are exact.  JavaScript says
  `The saddled pony kicks the grid bug.` while native says
  `The saddled pony hits the grid bug.`; the kill line is otherwise exact.
- Trace the native `mattackm -> hitmm -> miss/hit verb` selection from pony
  attack type and visibility before changing presentation text.

### 2026-07-31 monster-combat default hit verb is accepted through segment7 input28

- `mhitm.c:hitmm()` does not give `AT_KICK` a special visible verb; it uses
  the default `hits` arm.  JavaScript had reused hero-facing `kicks` wording
  inside monster-versus-monster presentation.
- The visible combat formatter now owns the source `hitmm()` switch separately.
  The pony's live result remains `kick`, damage and death are unchanged, and
  only the monster-combat verb becomes `hits`.
- The named engine-only witness passes **1/1** in **0.35 seconds** at
  **175,521,792 bytes** RSS with exact RNG/screens/cursors through input28
  and explicit attack/death state.  Architecture section618 maps the accepted
  wording boundary; no full corpus gate has run.

### 2026-07-31 segment8 input4 is the next Samurai command-turn frontier

- The bounded locator completes in **0.54 seconds** at **188,252,160 bytes**
  RSS with segment7 exact through input70.
- Native and JavaScript agree on the first two calls, then native uses
  `rn2(1)=0` where JavaScript uses `rn2(4)=0`; slice lengths are 196 versus 17.
- Native is paging visible Hachi/jackal combat while JavaScript has already
  published the splint-mail takeoff line.  Snapshot live actors, pet goals,
  movement allocation, and role scheduling before changing command prose.

### 2026-07-31 delayed Samurai armor transaction is accepted through segment8 input4

- `T` creates the first delayed remove action on this ordinary Samurai life.
  The pre-command bounded-role decision was stale after `rhack()`, so
  JavaScript skipped the initiating action's movement debit and live
  `movemon()` work.
- Re-evaluating that boundary after `rhack()` restores source-ration
  scheduling.  Native calls114--118 are `dog_move()`, not an extra
  `mcalcmove()` pass; the experimental whole-pass scheduler change was
  falsified and reverted.
- Visible combat now honors Hachi's proper name, which preserves the native
  three-message tty packing and allows the full deferred monster-contact tail
  to run.
- Ready negative multi now follows `unmul()`: publish the stored
  `You finish taking off your splint mail.` nomovemsg first, then run the
  silent removal callback after acknowledgement.  At the combat pager, the
  splint mail remains worn and the status row remains AC4.
- The named engine-only witness passes **1/1** in **0.41 seconds** at
  **172,474,368 bytes** RSS with exact **196/196** RNG calls, screens,
  cursors, live-scheduler state, worn slot, and pending delayed action.
  Architecture section619 maps the accepted boundary; no full corpus gate has
  run.

### 2026-07-31 delayed suit simple-name completion is accepted through segment8 input6

- The post-acknowledgement callback ordering was correct, but JavaScript used
  raw `splint mail` in nomovemsg where native `suit_simple_name()` deliberately
  reduces ordinary `* mail` suits to `mail`.
- Delayed armor naming now belongs to a category-aware simple-name helper;
  inventory naming and immediate `off_msg` are unchanged.
- The two named segment8 engine-only witnesses pass **2/2** in **0.41
  seconds** at **173,326,336 bytes** RSS with exact per-input RNG, screens,
  and cursors.  Input4 pins worn/AC4/pending state before the callback; input6
  pins `You finish taking off your mail.`, cleared `uarm`, unworn splint mail,
  AC10, and cleared delayed action.
- Architecture section619 now maps both halves of the delayed transaction.
  No full corpus gate has run.

### 2026-07-31 drop implicit-uncursed policy is accepted through segment8 input13

- JavaScript rendered the known neutral weapon as
  `an uncursed +0 katana`; native `doname()` suppresses `uncursed` under the
  default `implicit_uncursed` policy when the weapon's +/- is known.
- Those nine extra columns made tty suspend before the jackal kill, so the
  apparent 31-call combat/corpse RNG deficit was downstream presentation
  control flow.
- The drop formatter now shares the inventory BUC adjective policy while
  preserving drop-specific quantity, article, enchantment, and floor state.
- All three named segment8 engine-only witnesses pass **3/3** in **0.53
  seconds** at **182,616,064 bytes** RSS.  Input13 has exact **44/44** RNG
  calls, screens, cursors, dropped-katana floor state, and pet defender death.
  Architecture section620 maps the naming-to-tty-to-death boundary; no full
  corpus gate has run.

### 2026-07-31 named pet eating is accepted through segment8 input15

- Native `dog_eat()` uses `noit_Monnam()`, so a spotted named pet says
  `Hachi`; JavaScript's two eating branches hard-coded `Your little dog`.
- A shared eating-subject helper now preserves proper names, unnamed
  possessive pets, and unspotted `It` as separate source cases.
- All four named segment8 engine-only witnesses pass **4/4** in **0.67
  seconds** at **178,208,768 bytes** RSS with exact per-input RNG, screens,
  and cursors through input15.  Hachi remains live and the eaten jackal corpse
  is absent from its floor pile.
- Architecture section621 maps the subject-to-consumption boundary; no full
  corpus gate has run.

### 2026-07-31 ordinary Samurai quit summary is accepted through segment8 input37

- The affirmative `doquit()` branch was blank, so JavaScript never entered
  `done(QUIT)` and left the map visible.
- A dedicated quit end transaction now applies disclosure policy, uses the
  Samurai `Goodbye()` value `Sayonara`, and renders the no-tombstone summary
  before its single terminal More boundary.
- All five named segment8 engine-only witnesses pass **5/5** in **0.57
  seconds** at **183,058,432 bytes** RSS with exact per-input RNG, screens,
  and cursors through input37 plus gameover/zero-time state.
- Architecture section622 maps the summary-to-score handoff.  Persistent
  top-ten state at input38 is still open; no full corpus gate has run.

### 2026-07-31 persistent top-ten rendering is accepted through segment8 input38

- Native `topten()` stores structured score entries across game processes;
  the contest analogue is the storage handle shared across `runSegment()`
  calls.  Galen's zero points fail `POINTSMIN=1`, so his quit is displayed
  unranked after the prior list and is not persisted.
- JavaScript now validates generic stored entries, applies descending
  insertion, three-per-role and 100-total caps, selects top3 plus two around
  the current rank, and mirrors `outentry()` wrapping/HP/bold behavior.
- All six named segment8 engine-only witnesses pass **6/6** in **0.53
  seconds** at **190,562,304 bytes** RSS.  Input38 exactly renders ranks1--3,
  a gap, ranks6--7, and Galen at cursor `(0,16)`; the preloaded seven-entry
  Map remains unchanged.
- Architecture section623 maps the structured record, storage, selection, and
  tty boundaries.  Actual cross-segment death writes still require one
  complete seed0030 session witness; no full corpus gate has run.

### 2026-07-31 complete seed0030 replay exposes an earlier mimic frontier

- The single complete-session locator exits normally in **1.13 seconds** at
  **190,496,768 bytes** RSS after all 1,953 recorded states.
- Its first mismatch is segment1/input92: native consumes
  `rnd(2)=1 @ next_ident`, reveals `That chest is a small mimic!`, and owns a
  97-call turn; JavaScript skips discovery, says
  `You hit the small mimic.`, and owns only 24 calls.
- This falsifies immediate cross-segment score-write acceptance.  The
  preloaded input38 renderer remains accepted, but actual record population
  is downstream of the unresolved input92 gameplay path.
- Trace `stumble_onto_mimic()` and the live disguise state at `(39,8)` before
  changing combat or score code.  No full corpus gate has run.

### 2026-07-31 object-disguised mimic discovery is accepted through segment1 input92

- `attack_checks()` routes a visible object disguise through
  `stumble_onto_mimic()` before melee.  `object_from_map()` constructs a
  temporary object for naming, so the reveal legitimately owns
  `next_ident()` and the missing `rnd(2)`.
- JavaScript now consumes that identity call, publishes
  `That chest is a small mimic!`, clears appearance/wait/sleep state, repaints
  the actor, and establishes sticky `u.ustuck` contact without calling
  `hitum()`.
- The first postcondition failed only because tty `(39,8)` was mistaken for
  internal map `(39,8)`; the actual source/JS coordinate is internal `(40,7)`.
  After correcting that assertion, the named engine-only witness passes
  **1/1** in **0.50 seconds** at **180,092,928 bytes** RSS with exact RNG,
  screens, and cursors through input92 plus explicit reveal/stuck state.
- Architecture section624 maps the discovery-before-melee transaction.  The
  complete-session locator must now advance from input92; no full corpus gate
  has run.

### 2026-07-31 segment1 input95 is the next ambient-sound tty frontier

- The complete-session locator exits normally in **1.15 seconds** at
  **191,807,488 bytes** RSS and advances from input92 to input95.
- Native suspends on `You miss the small mimic.--More--` immediately after
  `dosounds()` selects the guard-footstep line; input96 publishes that line
  and consumes the remaining three maintenance calls.
- JavaScript appends both lines without a pager and consumes the input96 tail
  early.  The exact RNG prefix makes tty/ambient output ownership the next
  blocker, not ambient selection or hunger RNG.  No full corpus gate has run.

### 2026-07-31 ambient-sound tty suspension is accepted through segment1 input95

- Native tty reserves eight columns for `--More--` and uses the strict
  `new + old + 3 < CO - 8` append condition.  The mimic miss and 44-column
  guard line therefore suspend even though their prose alone fits 80 cells.
- Generic live-role maintenance now uses the same awaited tty-aware owner as
  source-ration maintenance.  The guard line is selected before the pager but
  remaining hunger/exercise/global calls resume only after acknowledgement.
- Both named segment1 engine-only witnesses pass **2/2** in **0.55 seconds**
  at **237,944,832 bytes** RSS with exact RNG/screens/cursors through input95
  and explicit 29-call/pager-cursor state.
- Architecture section625 maps the combat-to-ambient-to-maintenance
  suspension.  The complete-session locator must now advance from input95;
  no full corpus gate has run.

### 2026-07-31 segment3 input72 is the next level-generation frontier

- The complete-session locator exits normally in **1.23 seconds** at
  **192,708,608 bytes** RSS, clears all of segment1, and advances to
  Beatrix segment3/input72 descent.
- Screen/cursor are exact.  At generation call791 native uses `rn2(9)=2`
  while JavaScript uses `rn2(6)=2`; slice lengths are 2,851 versus 2,641.
- Extract the bounded labeled call neighborhood and identify the first C/Lua
  constructor owner before addressing later aggregate drift.  No full corpus
  gate has run.

### 2026-07-31 Z-shaped themed-room generation is accepted through segment3 input72

- The selected source room is `Z-shaped`, but JavaScript's
  `Z_SHAPED_MAP` repeated the distinct `T-shaped, rot 3` lower-half rows.
  That placed room floor west of `(27,10)`, making an invalid native door
  candidate appear admissible.
- The map now uses the exact Lua lower west arm.  Native and JavaScript both
  reject `(27,10)`, retry the nine-position east edge, and accept `(27,6)`;
  no `finddpos()`, corridor, or RNG bridge changed.
- The named segment3 engine-only witness passes **1/1** in **0.67 seconds**
  at **195,657,728 bytes** RSS with exact RNG/screens/cursors through input72,
  including all **2,851** generation calls, plus explicit destination-door
  geometry after acknowledgement.
- Architecture section626 maps the static Lua terrain through irregular-room
  topology and door admission.  The complete-session locator must advance
  from input72; no full corpus gate has run.

### 2026-07-31 segment3 input273 is the next monster-turn frontier

- The complete-session locator exits normally in **0.97 seconds** at
  **190,136,320 bytes** RSS and advances from input72 to input273.
- Native owns 15 calls and displays `You hear a distant zap.`; JavaScript
  owns 16 calls, inserts an extra `rn2(5)` after the first two shared calls,
  and displays no message.  Cursor remains exact.
- Attribute the extra call to one bounded live actor/scheduler branch before
  changing wand behavior or output.  No full corpus gate has run.

### 2026-07-31 monster speed-wand use is accepted through segment3 input273

- The peaceful shopkeeper at `(10,8)` was within `find_misc()` range and
  carried a charged wand of speed monster, but JavaScript implemented only
  potion-of-speed misc use.  It moved the shopkeeper and introduced a second
  `distfleeck()` instead of spending the action on the wand.
- The shared speed-item branch now handles the wand's charge, permanent-fast
  state, action termination, object de-observation, and unseen
  nearby/distant zap message.
- Both named segment3 tests pass **2/2** in **0.74 seconds** at
  **202,883,072 bytes** RSS with exact per-input RNG/screens/cursors through
  input273.  The accepted state is position `(10,8)`, `MFAST`, charge seven,
  and the exact 15-call input273 slice.
- Architecture section627 maps the first-distfleeck-to-misc-use boundary.
  The complete-session locator must advance from input273; no full corpus
  gate has run.

### 2026-07-31 segment3 input277 is the next shop-entry frontier

- The complete-session locator exits normally in **1.06 seconds** at
  **187,973,632 bytes** RSS and advances from input273 to input277.
- Native welcomes Beatrix to `Maganasipi's general store`; JavaScript uses
  `Kopasker`.  The first seven calls agree, after which JavaScript adds three
  small-range calls instead of continuing to the next actor's `rn2(5)`.
- Compare name-table indexing and the shopkeeper's entry/action state before
  changing greeting prose.  No full corpus gate has run.

### 2026-07-31 shop entry is accepted through segment3 input277

- Patched C's datetime parser copies `localtime(now)` and retains its
  `tm_isdst` flag while overwriting the fixed date.  The summer recorder
  therefore interprets January noon with EDT, making `ubirthday / 257`
  contribute 2 and selecting `Maganasipi` for resident id109 on ledger2.
- The same fast shopkeeper acts twice.  On its second action the hero is on
  the door, so `shk_move()` enables avoidance and `move_special()` filters
  three `NOTONL` room candidates, retaining only `(9,10)` and `rn2(1)`.
  JavaScript had sampled all four and inserted `rn2(2..4)`.
- Fixed-time conversion now preserves the recorder's inherited current New
  York offset, and shopkeeper special movement implements the door-avoidance
  filter and fallback.  All three named segment3 tests pass **3/3** in
  **0.80 seconds** at **209,534,976 bytes** RSS with exact RNG, screens, and
  cursors through input277.
- Architecture section628 maps the independent identity/time and
  door-avoidance branches.  The complete-session locator must advance from
  input277; no full corpus gate has run.

### 2026-07-31 segment3 input280 is the next shopkeeper-contact frontier

- The complete-session locator exits normally in **1.10 seconds** at
  **199,000,064 bytes** RSS and advances from input277 to input280.
- Native stops after five calls on
  `You miss Maganasipi.  Maganasipi gets angry!--More--`; JavaScript says
  `You miss the shopkeeper.` and continues to 21 calls.
- Trace the hero-contact naming, shopkeeper anger transition, and tty
  suspension as one source transaction before changing output.  No full
  corpus gate has run.

### 2026-07-31 shopkeeper anger and striking-wand use are accepted through segment3 input284

- A failed force-fight still calls `missum()` and `wakeup(via_attack)`.
  JavaScript now proper-names `Maganasipi`, clears peacefulness, applies the
  alignment penalty, and emits the anger line before the monster scan.
- The newly hostile resident reaches `find_offensive()` before melee and
  selects its charged striking wand.  Its visible zap line owns the input280
  pager; charge decrement and `rn1(8,6)` remain deferred until space at
  input284.
- Magic resistance produces `Boing!`, teaches the shopkeeper that resistance,
  and first identification of the wand performs the source Wisdom exercise.
  The wand drops from six charges to five and that first fast action ends.
- The shopkeeper's second fast action owns the later fatal hit.  The combined
  zap/response/contact topline retains pre-hit `HP:11(11)` while combat state
  has already committed the damage.
- All five named segment3 engine-only witnesses pass **5/5** in **0.97
  seconds** at **239,353,856 bytes** RSS with exact RNG, screens, and cursors
  through input284 plus charge, resistance, expertise, and discovery state.
- Architecture section629 maps the attack-entry, tty, resistance-discovery,
  and second-action boundaries.  The complete-session locator must advance
  from input284; no full corpus gate has run.

### 2026-07-31 segment3 input286 is the next shopkeeper-death frontier

- The complete-session locator exits normally in **1.06 seconds** at
  **194,625,536 bytes** RSS and advances from input284 to input286.
- RNG is exact.  Native flushes
  `You die...  Maganasipi takes all your possessions.--More--`; JavaScript
  flushes `You die...--More--`.
- Trace `done()`/`paybill()` against the live resident, customer, inventory,
  and bill state before changing the end renderer.  No full corpus gate has
  run.

### 2026-07-31 fatal shop settlement is accepted through segment3 input286

- `really_done()` runs `paybill(croaked=1)` before flushing the death message
  window.  The resident of the hero's current shop has priority.
- Maganasipi is adjacent, hostile, awake, in shoproom3, and Beatrix retains
  16 inventory stacks with no debt.  `inherits()` therefore emits
  `Maganasipi takes all your possessions.` and marks a repository at `(9,9)`.
- JavaScript now installs `You die...`, runs state-derived shop settlement,
  appends the possession line, and then flushes one combined pager.  It clears
  bill state but leaves inventory intact until the later disclosure/repository
  boundary.
- All six named segment3 engine-only witnesses pass **6/6** in **1.04
  seconds** at **245,121,024 bytes** RSS with exact RNG, screens, cursors, and
  settlement state through input286.
- Architecture section630 maps the fatal status, shop priority, inheritance,
  disclosure, and repository boundaries.  The complete-session locator must
  advance from input286; no full corpus gate has run.

### 2026-07-31 segment3 input287 is the next killer-identity frontier

- The complete-session locator exits normally in **1.06 seconds** at
  **190,529,536 bytes** RSS and advances from input286 to input287.
- RNG and cursor are exact.  Native's tombstone says
  `killed by Ms. Maganasipi; the shopkeeper`; JavaScript says
  `killed by a shopkeeper`.
- Trace named-shopkeeper killer construction at fatal contact and propagate
  the structured cause to tombstone and score records.  Do not patch wrapping
  independently.  No full corpus gate has run.

### 2026-07-31 named-shopkeeper death identity is accepted through segment3 input287

- C `done_in_by()` treats a shopkeeper as a named killer.  General names use
  the instance-gender honorific; prefix-coded personal names do not.
  `formatkiller()` sanitizes the descriptor comma, producing the canonical
  cause `killed by Ms. Maganasipi; the shopkeeper`.
- JavaScript now constructs this identity from the fatal actor and passes it
  through the same `deathCauseRecord()` used by tombstone and score storage.
  The stone wraps the canonical cause into four source-shaped 16-character
  rows rather than maintaining an independent two-row special case.
- All seven named segment3 engine-only witnesses pass **7/7** in **1.11
  seconds** at **248,299,520 bytes** RSS with exact per-input RNG, screens,
  and cursors through input287.
- Architecture section631 maps fatal actor identity through killer
  formatting, tombstone wrapping, persistent score storage, and later
  display punctuation.  A complete-session locator must advance from
  input287; no full corpus gate has run.

### 2026-07-31 segment4 input190 is the next death-recovery frontier

- The one complete-session locator exits normally in **0.93 seconds** at
  **187,908,096 bytes** RSS.  It clears all remaining segment3 inputs and
  advances to segment4/input190 (`n`, global input777).
- RNG and cursor are exact.  JavaScript shows `HP:0(11)` while native shows
  `HP:1(11)`; every other cell in the bounded neighborhood agrees.
- Trace the preceding response and C death-refusal/revival state transition
  before changing status presentation.  This is a new recovery portfolio,
  not a downstream named-shopkeeper cause defect.  No full corpus gate has
  run.

### 2026-07-31 first-contact overkill is accepted through segment4 input190

- The apparent `n` response is an ordinary movement command.  Input189 has
  already painted HP one; input190's jackal overkills by one before
  `done_in_by()` tries to install the death line.
- Tty pages the current bite line before `done()` can force a status repaint.
  A monster-only command therefore retains HP one even though live HP is
  zero.  Exact-zero fatal damage and fresh hero-melee ownership remain
  separate accepted branches.
- The redundant requirement for an earlier contact in the same actor scan
  was removed.  All three named segment4 witnesses pass **3/3** in **0.55
  seconds** at **191,184,896 bytes** RSS with exact per-input RNG, screens,
  and cursors through input190.
- Architecture section632 maps damage state, command ownership, fatal-line
  backpressure, and status repaint timing.  A complete-session locator must
  advance from input190; no full corpus gate has run.

### 2026-07-31 correction: the broad input190 status rule regresses segment2

- The complete-session locator exits normally in **0.99 seconds** at
  **190,431,232 bytes** RSS and rejects the broad monster-only-command rule
  at segment2/input79: JavaScript paints HP one where native paints HP zero.
- The segment4 **3/3** witness remains useful local evidence, but input190 is
  not accepted as a general repair.  Compare the segment2 and segment4
  topline/contact/death transactions and require both exact before closing
  this block.  No full corpus gate has run.

### 2026-07-31 thin-air ownership and first-contact overkill are accepted through input190

- `domove_fight_empty()` is a hero attack attempt even when no live actor
  occupies the target.  Marking that command owner keeps segment2/input79 at
  committed HP zero while the genuinely monster-only segment4/input190
  retains painted HP one.
- The paired gate passes **5/5** in **0.65 seconds** at **197,574,656 bytes**
  RSS.  The complete-session locator exits in **0.99 seconds** at
  **192,495,616 bytes** RSS and keeps all earlier inputs exact.
- Segment4/input192 is next: native death pager retains HP one and owns zero
  RNG; JavaScript paints HP zero and adds `rn2(1)`.  Trace status carry and
  bones eligibility as separate source obligations.  No full corpus gate has
  run.

### 2026-07-31 branch death continuation is accepted through segment4 input192

- The randomized Mines entrance is dungeon level2 in segment4.
  `no_bones_level()` rejects branch endpoints with local level greater than
  one, so native never reaches the depth `rn2(1)` reservoir.
- The fatal line was deferred behind the first-contact bite pager.  Painted
  HP one therefore survives the following death pager even though live HP is
  zero; the override clears only after that window.
- Seven paired segment2/3/4 controls pass **7/7** in **0.79 seconds** at
  **214,466,560 bytes** RSS.  The complete-session locator exits in **1.14
  seconds** at **187,285,504 bytes** RSS and clears the segment4 score tail.
- Segment5/input78 is next: RNG/cursor are exact, but JavaScript retains `I`
  at cell `(29,11)` where native restores a floor-object glyph.  No full
  corpus gate has run.

### 2026-07-31 boulder destination memory is accepted through segment5 input78

- C `dopush()` clears an invisible destination glyph before `movobj()`.
  JavaScript now uses the same existing memory invalidator before relinking
  the boulder, leaving `newsym()` to reveal the new object.
- The blocked-push and successful-push controls pass **2/2** in **0.54
  seconds** at **188,989,440 bytes** RSS.  Input78 is exact and retains the
  boulder at `(30,10)` with remembered backtick glyph.
- The complete-session locator exits in **1.02 seconds** at **190,808,064
  bytes** RSS and advances to segment6/input22.  Screen/cursor are exact; RNG
  first differs at call4616, where JavaScript enters `rn2(2),rn2(3)` instead
  of native `rn2(5),rn2(4)`.  No full corpus gate has run.

### 2026-07-31 T-shaped rotation identity is accepted through segment6 input22

- A bounded native recorder trace proves the selected `T-shaped, rot 3`
  declaration has its lower arm on the right.  It accepts wall `(30,16)` and
  starts the corridor at `(31,16)`; JavaScript had aliased the declaration to
  the left-armed Z-shaped map and shifted inward to `(27,16)`.
- Both T-shaped rotations now use their own source Lua literals.  S-shaped and
  Z-shaped retain their independent declarations; no seed, coordinates, RNG
  values, or transcript tail is bridged.
- Four paired controls pass **4/4** in **0.87 seconds** at **205,504,512
  bytes** RSS: exact T-shaped rot3 through input22, its pet continuation
  through input30, the Z-shaped structural replay, and the full seed0015
  S-shaped replay.
- Input22 is exact at **6,110/6,110 RNG calls**, with exact screens and
  cursors.  Architecture section635 maps Lua declaration identity through
  irregular topology and corridor joining.  A complete-session locator is
  still required for the next frontier; no full corpus gate has run.

### 2026-07-31 broken-door feature composition is accepted through segment6 input86

- C `check_here()` does not require `mention_decor` for terrain to participate
  in a floor-object description.  With that option disabled, `look_here()`
  independently maps exact `D_BROKEN` through `dfeature_at()`.
- The shared JavaScript destination-feature owner now covers the witnessed
  broken-door class as well as linked stairs.  When the decor producer already
  emitted the line, an explicit skip prevents duplicate feature prose.
- The broken-door/giant-rat-corpse and staircase/kobold-corpse controls pass
  **2/2** in **0.66 seconds** at **198,459,392 bytes** RSS with exact RNG,
  screens, cursors, terrain masks, and object identities.
- Architecture section636 maps `describe_decor()` and `look_here()` as
  separate producers converging at tty composition.  A complete-session
  locator is still required for the next frontier; no full corpus gate has
  run.

### 2026-07-31 segment6 input118 is the next quiet-RNG frontier

- The complete-session locator exits normally in **1.14 seconds** at
  **198,410,240 bytes** RSS and clears the accepted input86 transaction plus
  every following boundary through input117.
- Screen and cursor remain exact.  At RNG call4 JavaScript inserts
  `rn2(5),rn2(12)` and consumes 11 calls total versus native's 9.
- Attribute the pair to one live actor and source phase before changing
  scheduling; presentation exactness is not permission to skip the calls.
  No full corpus gate has run.

### 2026-07-31 monster trapdoor migration is accepted through segment6 input118

- The input117 live roster contains only a shopkeeper and giant rat.  The rat
  selects `(45,12)`, whose exact `TRAPDOOR` targets dungeon0/depth4.
- `postmov()->mintrap()->mlevel_tele_trap()` now unlinks that grounded rat
  before the trailing `distfleeck` and before the next allocation loop.  Its
  identity and fixed destination remain in the migrating roster.
- The trapdoor and existing magic-portal migration controls pass **2/2** in
  **1.22 seconds** at **195,706,880 bytes** RSS with exact RNG, screens,
  cursors, migration modes, and confusion boundaries.
- Architecture section637 maps movement selection through departure and
  reallocation.  Migrating-monster arrival remains a separate unaccepted
  level-transition owner.  A complete-session locator must choose the next
  frontier; no full corpus gate has run.

### 2026-07-31 segment6 input165 is the next combat frontier

- The complete-session locator exits normally in **1.07 seconds** at
  **194,101,248 bytes** RSS, confirms input119, and clears through input164.
- At depth4 input165 native paints HP9/14 while JavaScript paints HP12/14.
  After shared `rn2(5),rn2(20)`, native owns damage and continuation calls
  which JavaScript omits before advancing to another actor.
- Identify the exact attacker and attack slot before changing common combat.
  No full corpus gate has run.

### 2026-07-31 unseen monster dart trap is accepted through segment6 input165

- The first divergent actor is `m_id=258`, a gnome moving
  `(18,10)->(19,10)` onto unseen DART_TRAP type2.  C enters
  `t_missile(DART)->mksobj()->thitm(7)` before the ordinary actor tail; the
  later visible gnome attack was only a shifted-RNG symptom.
- JavaScript now pays the ordinary projectile constructor, normalizes one
  missile, runs the dart poison gate, resolves AC/to-hit and size-aware
  damage, and either consumes a hit or places/stacks a miss.  This witness
  consumes the cursed dart after threshold15/roll17 and HP2-to-1 damage.
- The actor then continues normally, realigning the later six-damage attack
  to hero HP9.  A distinct turn-20 distress phase restores the gnome to final
  HP2; the test pins both transaction states rather than conflating them.
- The dart and accepted falling-rock controls pass **2/2** in **0.58
  seconds** at **205,209,600 bytes** RSS with exact RNG, screens, cursors,
  stable actor identity, trap knowledge, and object lifecycle.  Architecture
  section638 maps the C object/trap/maintenance boundaries.  A complete
  seed0030 locator must choose the next frontier; no full corpus gate has run.

### 2026-07-31 segment6 input174 is the next ranged-message frontier

- The complete seed0030 locator exits normally in **1.07 seconds** at
  **190,857,216 bytes** RSS and confirms exact continuation through input173.
- Input174 has exact RNG but JavaScript says `The gnome throws a arrow!`
  where native says `The gnome shoots an arrow!`; cursor x55 versus x56 is
  the same message-length defect.
- Trace launcher selection and indefinite-article ownership in the ranged
  message producer before changing combat or RNG.  No full corpus gate has
  run.

### 2026-07-31 launched-arrow presentation is accepted through segment6 input174

- Live `m_id=240` already wields BOW type83 and selects ARROW type18.
  Ranged results now preserve the native `ammo_and_launcher()` relationship,
  so presentation says `shoots an arrow`; unlaunched missiles retain
  `throws`.
- Flight projection now uses the projectile's `obj_to_glyph()` counterpart.
  The arrow at `(27,13)` retains cyan6, while black/gray projectiles normalize
  to the tty default foreground.
- The bow/arrow and seed0002 thrown crude-dagger controls pass **2/2** in
  **1.04 seconds** at **204,406,784 bytes** RSS with exact RNG, complete
  screens, cursors, launcher state, grammar, color, and pager lifetime.
- Architecture section639 maps the semantic-to-presentation crossing.
  Multi-volley phrasing remains unaccepted.  A complete seed0030 locator must
  choose the next frontier; no full corpus gate has run.

### 2026-07-31 segment6 input175 is the next projectile-hit continuation

- The complete seed0030 locator exits normally in **1.17 seconds** at
  **191,381,504 bytes** RSS and confirms input174.
- Input175 native says `You are hit by an arrow.` where JavaScript says
  `a arrow`.  After shared Strength exercise `rn2(2)=0`, native additionally
  owns `rn2(2)=0,rn2(3)=1` before the next actor.
- Trace `thitu()->exercise()->drop_throw()->should_mulch_missile()` and the
  projectile's exact BUC/enchantment state.  No full corpus gate has run.

### 2026-07-31 enchanted projectile hit is accepted through segment6 input175

- The first residual HP mismatch was not a regeneration or attribute defect.
  Native's +1 arrow combines `rnd(6)=1` with deterministic enchantment for
  two damage, then the exact `rn2(100)=13` maintenance roll heals one point.
- JavaScript now applies the human-sized `dmgval()` weapon subset before
  `thitu()`: enchantment, greatest erosion, and the minimum-one clamp add no
  RNG calls.  The launch pager retains pre-hit HP9; the committed hit reaches
  HP7; regeneration produces native final HP8.
- The exact arrow, seed0002 unenchanted dagger, and seed0108 deferred-hit
  controls pass **3/3** in **1.10 seconds** at **199,655,424 bytes** RSS.
  Arrow identity272 remains +1/blessed, survives the two-call mulch gate, and
  lands at the hero.  Architecture section640 maps the transaction.
- Run the complete bounded seed0030 locator to choose the next frontier.  No
  full engine-only corpus, normal suite, held-out judge, stage, commit, push,
  publication, or submission ran.

### 2026-07-31 fatal ranged losehp boundary is accepted through segment6 input244

- Later +1 arrows expose `exclam()` severity and lethal saturation.  Damage5
  now prints `!`, and exact `preHitHp` preserves HP4 instead of reconstructing
  false HP5 from clamped zero plus damage.
- Fatal `losehp()` forces the current arrow-hit line through `--More--`.
  Invalid `F`/`y` dismissals own no RNG; only valid dismissal reaches
  `can_make_bones()`, mortality, and the `You die...` pager.  Exercise,
  projectile fate, remaining actors, and maintenance are unreachable.
- The fatal-arrow witness plus the ordinary arrow, seed0002 dagger, and
  seed0108 deferred-hit controls pass **4/4** in **1.17 seconds** at
  **206,405,632 bytes** RSS with exact screens, cursors, and RNG through
  segment6/input244.  Architecture section640 maps both returning and
  non-returning hit edges.
- Dismissal of the death pager reaches full bones/corpse construction at
  input247, which remains the next unmeasured boundary.  No full engine-only
  corpus, normal suite, held-out judge, stage, commit, push, publication, or
  submission ran.

### 2026-07-31 segment6 input247 is the next bones-construction frontier

- The complete seed0030 locator exits normally in **1.35 seconds** at
  **194,019,328 bytes** RSS.  Screens and cursor are exact at input247, but
  JavaScript emits zero RNG calls where native owns 53.
- The missing slice begins with `rnd(2)=1 @ next_ident` for the named human
  corpse, continues through temporary corpse species/timeout initialization,
  inventory `drop_upon_death()` curse/nearby-recipient gates, and ends with
  ghost allocation/initialization.
- Port this as a shared ordinary-death/bones transaction before the tombstone,
  using existing `mksobj`, `makemonAt`, and bones serialization owners.  Do
  not add transcript-only calls.  No full corpus gate has run.

### 2026-07-31 ordinary bones construction is accepted through segment6 input247

- The shared post-disclosure death owner now builds the named race corpse,
  marks the grave, extracts and evaluates all nine inventory objects, creates
  the named sleeping ghost, links corpse identity to the ghost, and serializes
  the bones level.
- The exact native 53-call RNG slice, tombstone screen/cursor, and saved-bones
  marker pass together with three nonfatal projectile/deferred-hit controls:
  **4/4** in **1.30 seconds** at **207,978,496 bytes** maximum RSS.
- Acceptance is deliberately limited to this absent-payload path with no
  adjacent eligible object recipient.  Those alternative bones branches
  remain unclaimed.
- Rerun the complete bounded seed0030 locator to choose the next strict
  frontier; no full engine-only corpus, normal suite, held-out judge, stage,
  commit, push, publication, or submission ran.

### 2026-07-31 segment7 input135 is the next monster-movement frontier

- The complete bounded seed0030 locator exits normally in **1.08 seconds** at
  **192,692,224 bytes** maximum RSS and confirms all earlier segment6 work.
- At input135 (`j`) screen/cursor remain exact, but RNG first diverges at
  call22: native continues repeated `rn2(77), rn2(21)` coordinate-selection
  pairs while JavaScript switches to shrinking `rn2(3), rn2(4), rn2(5)`
  bounds.  JavaScript has 41 calls against native's 44.
- Input136's absent pony glyph is treated as downstream movement-state drift.
  Locate the exact input135 actor and C/Lua candidate owner before changing
  behavior.  No full corpus gate has run.

### 2026-07-31 segment7 input135 is an ambient-birth boulder rejection defect

- Native annotations correct the preliminary movement diagnosis:
  `maybe_generate_rnd_mon()` fires in both runtimes, then
  `makemon_rnd_goodpos()` owns the repeated `(rn2(77),rn2(21))` pairs.
- JavaScript accepts `(47,13)`, a corridor containing a boulder.  C
  `goodpos()` rejects it for the still-null provisional species, rejects the
  following stone coordinate, and accepts the fifth candidate `(62,3)`.
- Reuse the shared species-aware position predicate for ambient coordinate
  and group placement; require exact behavior through input136 before
  accepting the block.  No full corpus gate has run.

### 2026-07-31 ambient birth placement is accepted through segment7 input136

- Runtime coordinate selection now delegates to the same `goodpos()` owner as
  level construction.  The null provisional species rejects the boulder at
  `(47,13)`, then native accepts the fifth coordinate `(62,3)` before
  selecting species322.
- Exact per-input RNG, decoded screens, cursors, actor occupancy, and species
  state pass **1/1** through input136 in **0.56 seconds** at **193,200,128
  bytes** maximum RSS.
- Scary-square fallback, fifty-failure wrapped scanning, and rock-throwing
  group placement remain unaccepted alternatives.  Run the bounded seed0030
  locator for the next strict frontier; no full corpus gate has run.

### 2026-07-31 segment7 input149 is the next shopkeeper-constructor frontier

- The bounded locator exits normally in **0.94 seconds** at **191,152,128
  bytes** maximum RSS and moves the first mismatch to input149.
- RNG/cursor are exact, but shop entry uses generic `shopkeeper` where native
  owns `Swidnica`.  At input152 the same actor later chooses melee instead of
  native short-wand use.
- Audit deterministic shopkeeper name, extra data, and inventory at creation
  before changing entry or combat presentation.  No full corpus gate has run.

### 2026-07-31 liquor-shop identity is accepted through segment7 input149

- Shop index3 now owns the exact C liquor-name table.  Deterministic
  `nameshk()` state assigns resident125 the persistent identity `Swidnica`
  without consuming RNG.
- Exact per-input RNG, decoded screens, cursors, `eshk.shknam`, and shop type
  pass **1/1** through input149 in **0.65 seconds** at **203,948,032 bytes**
  maximum RSS.
- Remeasure the next strict frontier; the resident's already-present charged
  wand makes input152 item-use scheduling the leading prediction.  No full
  corpus gate has run.

### 2026-07-31 segment7 input152 is the next offensive-item frontier

- The bounded locator exits normally in **1.06 seconds** at **191,578,112
  bytes** maximum RSS and confirms exact behavior through input151.
- After the hero misses and Swidnica becomes angry, native selects and zaps
  the charged wand of striking (`rn2(8)`, ray `rnd(20)`) with a tty pager.
  JavaScript skips item use and enters melee.
- Input153's unknown-space divergence is downstream pager state.  Trace
  `dochug -> find_offensive -> use_offensive` and continuation ownership
  before changing combat prose.  No full corpus gate has run.

### 2026-07-31 first non-resistant striking shot is accepted through input153

- `find_offensive()` now selects a charged striking wand from attacker
  knowledge rather than requiring actual hero magic resistance.
- Swidnica's first shot suspends on the zap line, resumes with range4 and
  to-hit16, force-misses, spends one charge, and grants wand experience
  without recording resistance or type knowledge.
- The new witness plus both earlier resistant-wand controls pass **3/3** in
  **0.74 seconds** at **210,550,784 bytes** maximum RSS with exact RNG,
  screens, cursors, and branch state.  No full corpus gate has run.

### 2026-07-31 segment7 input155 is the experienced striking-wand frontier

- The locator confirms exact behavior through input154, then native's
  experienced Swidnica uses the wand twice across the input155 pager.
- The first action consumes range7/to-hit16 and misses; space resumes the
  scanner, whose second action consumes range6/to-hit10 and `d(2,12)=13` and
  hits.  JavaScript's explicitly limited first-shot branch instead uses
  melee.
- Generalize the existing deferred wand owner to experienced non-resistant
  accuracy, damage, and knowledge state.  No full corpus gate has run.

### 2026-07-31 experienced non-resistant wand use is accepted through input156

- Experience now controls accuracy rather than eligibility.  Swidnica's first
  fast action misses with range7/to-hit16; the pager resumes into a second
  range6/to-hit10 action which deals13 damage.
- The experienced witness plus first-shot and resistant controls pass **3/3**
  in **0.60 seconds** at **207,749,120 bytes** maximum RSS with exact RNG,
  screens, cursors, charges, discovery, and final HP4.
- Fatal wand damage remains a separate unaccepted edge.  No full corpus gate
  has run.

### 2026-07-31 segment7 input158 is the fatal striking-wand tty frontier

- Input158 matches range0/to-hit3, then native displays the wand-hit line and
  yields before damage with HP4.  JavaScript rolls `d(2,12)=5` and commits
  fatal HP0 too early.
- Space at input159 owns native's damage roll and terminal transition.
  Split visible hit presentation from damage, then route fatal `losehp()`
  through the common death owner and stop the scan.  No full corpus gate has
  run.

### 2026-07-31 fatal striking continuation is implemented pending witness

- Successful rays now install the hit line before a named damage
  continuation owns `d(2,12)`, HP commit, and survivor-only discovery.
- Fatal damage forces the hit pager, rejects bones at the level2 Mines branch
  endpoint without RNG, joins Swidnica's inheritance to the death line, and
  enters ordinary death with killer `wand`.
- A new exact witness covers inputs158--165 and both invalid-key pager
  intervals.  Syntax and whitespace checks pass; focused verification is the
  next gate, and no full corpus gate has run.

### 2026-07-31 fatal wand gate isolates the pre-hit status projection

- Four adjacent wand/shop controls pass; only the new fatal witness fails,
  first at input159's status row: JavaScript paints HP0, native retains HP4.
- The damage and terminal phase order remain supported.  Carry pre-hit HP
  only across the forced wand-hit pager, then remove it before the combined
  death/inheritance pager so that pager paints HP0.
- The managed **4/5** gate took **1.02 seconds** at **251,920,384 bytes**
  maximum RSS and left no verifier process.  No full corpus gate has run.

### 2026-07-31 fatal striking-wand death is accepted through input165

- The new fatal witness and four adjacent wand/shop controls pass **5/5** in
  **1.10 seconds** at **252,411,904 bytes** maximum RSS.
- Inputs158--165 are exact: hit pager with HP4, deferred damage5, invalid
  More keys, death/inheritance pager with HP0, branch-endpoint bones rejection
  without RNG, and the `wand` tombstone.
- Rerun the bounded seed0030 locator for the next strict frontier.  No full
  corpus gate has run.

### 2026-07-31 segment7 input171 is the post-tombstone score frontier

- The bounded locator advances segment7 exactness through input170, then
  native displays `You made the top ten list!` with zero RNG at input171.
- JavaScript has already returned to the dungeon and consumes eleven
  unrelated maintenance calls, so trace the summary/blank-More/score-list
  handoff and gameover return before touching later symptoms.
- The locator took **1.08 seconds** at **189,251,584 bytes** maximum RSS and
  left no verifier process.  No full corpus gate has run.

### 2026-07-31 score loss is a missing native noreturn scheduler edge

- `finishOrdinaryDeath()` already renders the score list.  The first two
  movement-ration loops continue after it returns, allocate a turn, consume
  eleven RNG calls, and repaint the dungeon.
- Native `done()/really_done()` never returns.  Both JavaScript call sites
  now stop on `program_state.gameover` immediately after the actor scan,
  matching the third scheduler path.
- Verify input171 with ordinary-bones death and quit-score controls.  No full
  corpus gate has run.

### 2026-07-31 segment7 score handoff is accepted through its final input

- The full input171 score witness plus fatal, nonfatal, and persistent quit
  controls pass **4/4** in **0.81 seconds** at **215,433,216 bytes** maximum
  RSS.
- The stored Florian record, top-ten screen, gameover state, cursor, and zero
  post-death RNG are exact.  Segment7 has no remaining mismatch.
- Rerun the bounded session locator; no full corpus gate has run.

### 2026-07-31 segment9 startup pet glyph is the next strict frontier

- Segments0--8 are exact.  Before any segment9 input, native paints a white
  little-dog `d` at `(52,6)` while JavaScript exposes underlying terrain.
- Input4's premature dog/newt combat is downstream.  Inspect pet construction,
  placement, fmon membership, and display projection at startup first.
- The locator took **1.27 seconds** at **191,037,440 bytes** maximum RSS and
  left no verifier process.  No full corpus gate has run.

### 2026-07-31 segment9 pet placement rejects zero-valued D_NODOOR incorrectly

- Pet type, identity, HP, `edog`, fmon membership, and all candidate-shuffle
  RNG are exact.  JavaScript places the dog at `(52,8)`; native accepts the
  earlier empty doorway `(52,6)`.
- The private predicate treats `D_NODOOR === 0` as a bit and rejects it.
  Replace that duplicate with shared `monsterGoodPosition()` and verify
  startup through input4.
- The state replay took **0.29 seconds** at **144,752,640 bytes** maximum RSS
  and left no verifier process.  No full corpus gate has run.

### 2026-07-31 starting pet now uses shared goodpos pending witness

- `makedog()` now validates its exact shuffled candidates with
  `monsterGoodPosition(pettype, x, y, true)` instead of a startup-only
  doorway predicate.
- The new regression requires exact segment9 RNG/screens/cursors through
  input4, the startup doorway dog, and no premature newt kill.
- Focused verification is the next gate; no full corpus gate has run.

### 2026-07-31 Healer starting-pet placement is accepted through input4

- The exact Healer witness and Tourist live-pet control pass **2/2** in
  **0.47 seconds** at **165,822,464 bytes** maximum RSS.
- Startup accepts the empty doorway at `(52,6)` and downstream pet movement
  no longer kills the newt prematurely.
- Run the bounded locator for the next segment9 frontier.  No full corpus
  gate has run.

### 2026-07-31 segment9 input80 is the fountain gem-effect frontier

- Segment9 is exact through input79.  Both sides roll fountain effect27;
  native constructs and places a gem, while JavaScript emits tasteless water.
- Native's extra `rnd(862)`, `rnd(2)`, and `rn2(19)` prefix proves an object
  constructor, and the missing floor gem causes the later screen/RNG drift.
- Trace the source effect table and shared object constructor.  The locator
  took **1.28 seconds** at **246,874,112 bytes** maximum RSS.  No full corpus
  gate has run.

### 2026-07-31 fountain gem composition is accepted through input80

- The exact input80 witness plus the input4 pet control pass **2/2** in
  **0.46 seconds** at **178,667,520 bytes** maximum RSS.
- Weighted roll529 selects type465, ordinary construction and placement
  persist it on the floor, Wisdom exercise and dryup retain exact RNG, and
  the fountain is marked looted.
- Rerun the bounded seed0030 locator for the next strict frontier.  No full
  corpus gate has run.

### 2026-07-31 segment9 input116 is the dagger-description frontier

- Segment9 is exact through input115.  At input116, the same floor pile is
  ordered and positioned exactly, but JavaScript names an `orcish dagger`
  where native still names a `crude dagger`.
- RNG and cursor remain exact, so inspect the object's persistent
  `dknown`/description-observation state and shared naming path before the
  later input120 ambient-event drift.
- The locator took **1.33 seconds** at **250,986,496 bytes** maximum RSS and
  left no verifier process.  No full corpus gate has run.

### 2026-07-31 unknown weapon appearance is accepted through input116

- The exact input116 witness plus the fountain and pet controls pass **3/3**
  in **0.62 seconds** at **187,252,736 bytes** maximum RSS.
- The adjacent goblin drop correctly observes object140, but observation does
  not identify type36; the floor list now retains `crude dagger` until global
  type knowledge changes.
- Rerun the bounded seed0030 locator for the next strict frontier.  No full
  corpus gate has run.

### 2026-07-31 segment9 input120 is the pile-to-magic-trap frontier

- Segment9 is exact through input119.  Native describes several destination
  objects on the topline and immediately enters the magic-trap pager, while
  JavaScript suspends in a right-side floor list and never reaches the trap.
- Native consumes `rn2(30)=3` and `rnd(20)=11`; JavaScript consumes no RNG.
  Inspect `look_here()`'s list threshold/return and tty continuation before
  the trap effect.
- The locator took **1.27 seconds** at **248,840,192 bytes** maximum RSS and
  left no verifier process.  No full corpus gate has run.

### 2026-07-31 pile-limit magic-trap invisibility is accepted through input121

- The exact input121 witness plus dagger, fountain, and pet controls pass
  **4/4** in **0.63 seconds** at **190,595,072 bytes** maximum RSS.
- Five objects now select the non-modal summary, fate11 pages summary plus
  low hum, resumes the invisibility message, toggles intrinsic invisibility,
  and leaves the underlying corpse visible when the hero cannot spot self.
- Rerun the bounded seed0030 locator for the next strict frontier.  No full
  corpus gate has run.

### 2026-07-31 segment9 input122 is the invisible-hero perception frontier

- Segment9 is exact through input121.  Input122 retains exact screen, cursor,
  and 31-call slice length, but native's call index4 is `rn2(3)` where
  JavaScript reaches `rn2(5)`.
- Repeated native three-way calls point to `set_apparxy()` after intrinsic
  invisibility; inspect actor order and perceived hero coordinates before
  touching later movement drift.
- The locator took **1.22 seconds** at **247,398,400 bytes** maximum RSS and
  left no verifier process.  No full corpus gate has run.

### 2026-07-31 `m_move()` target refresh is accepted through input122

- Native refreshes `mux/muy` at `m_move()` entry before special actor
  dispatch.  Moving the JavaScript refresh ahead of shopkeeper/priest
  dispatch restores the actor-local input122 RNG ownership.
- The exact input122 witness plus magic-trap, dagger, fountain, and pet
  controls pass **5/5** in **0.79 seconds** at **196,395,008 bytes** maximum
  RSS.
- Rerun the bounded seed0030 locator for the next strict frontier.  No full
  corpus gate has run.

### 2026-07-31 segment9 input176 is the search-turn monster frontier

- Segment9 is exact through input175.  At input176 (`s`), JavaScript exposes
  a red `Z` at `(43,11)` where native retains corridor `#`; RNG first differs
  at call index3 and the slices have 18 versus 19 calls.
- The next `You already found a monster` line is downstream.  Inspect
  per-actor calls, movement, coordinates, and concealment/visibility state
  during input176 before changing search behavior.
- The locator took **1.43 seconds** at **247,922,688 bytes** maximum RSS and
  left no verifier process.  No full corpus gate has run.

### 2026-07-31 secret-corridor monster sight is accepted through input176

- Input174 now applies the native `unblock_point()` ownership when search
  converts `(44,10)` from `SCORR` to `CORR`; the west corridor becomes
  geometrically `COULD_SEE` while remaining dark.
- Input176 then reaches `m_move()`'s invisible-hero `rn2(11)` gate and the
  correct milling reservoir instead of moving zombie117 into sight.
- The exact input176 witness plus five prior controls pass **6/6** in
  **0.93 seconds** at **197,754,880 bytes** maximum RSS.  Rerun the bounded
  locator; no full corpus gate has run.

### 2026-07-31 segment9 input199 is the kobold-corpse combat frontier

- Segment9 is exact through input198.  At input199 (`h`), native leaves a
  red kobold-corpse `%` at screen `(43,11)` while JavaScript leaves corridor
  `#`; RNG first differs at call index7 and the slices have 61 versus 32
  calls.
- Native enters `rnd(2), rn2(2)` immediately after the shared
  `rn2(6), rn2(3)` prefix, consistent with pet growth after a monster death.
  Inspect actor-local combat, HP, and floor-object state before touching
  corpse rendering.
- The locator took **1.33 seconds** at **247,463,936 bytes** maximum RSS and
  left no verifier process.  No full corpus gate has run.

### 2026-07-31 hero-killed undead corpse conversion is accepted through input199

- `finishHeroMonsterKill()` now handles converted undead before the generic
  `G_NOCORPSE` default, matching native `make_corpse()`; kobold zombie239
  produces an old kobold corpse at `(44,10)`.
- The exact input199 witness plus six prior controls pass **7/7** in
  **1.32 seconds** at **195,706,880 bytes** maximum RSS.
- Rerun the bounded seed0030 locator for the next strict frontier.  No full
  corpus gate has run.

### 2026-07-31 segment9 input257 is the gas-spore attack frontier

- Segment9 is exact through input256.  At input257 (`h`), JavaScript emits
  `The gas spore hits!` and enters `rnd(20), d(4,6), rn2(3)` while native
  proceeds directly to maintenance.
- The `4d6` matches the gas spore's death-only `AT_BOOM` slot.  Inspect the
  phase-four attack filter and selected metadata before changing damage or
  explosion code.
- The locator took **1.21 seconds** at **248,119,296 bytes** maximum RSS and
  left no verifier process.  No full corpus gate has run.

### 2026-07-31 living gas-spore `AT_BOOM` admission is accepted through input257

- `basicMonsterAttack()` now follows native `mattacku()`'s no-action default
  for `AT_BOOM`; the gas spore's `4d6` remains owned only by death handling.
- The exact input257 witness plus seven prior controls pass **8/8** in
  **1.34 seconds** at **221,102,080 bytes** maximum RSS.
- Rerun the bounded seed0030 locator for the next strict frontier.  No full
  corpus gate has run.

### 2026-07-31 segment9 input260 is the gas-spore death frontier

- Segment9 is exact through input259.  At input260 (`h`), JavaScript misses
  the gas spore while native kills it and suspends at
  `You kill the gas spore!  Boom!--More--`.
- Both sides share `rn2(19)=14, rnd(20)=15`; native then enters
  `rn2(19)=3, rnd(3)=3, rn2(6)=0` instead of JavaScript's ordinary
  post-miss maintenance.  Localize those calls across hero damage and the
  first death-explosion phase.
- The locator took **1.21 seconds** at **255,705,088 bytes** maximum RSS and
  left no verifier process.  No full corpus gate has run.

### 2026-07-31 input260 scalpel accuracy is fixed; explosion remains

- Generated `oc_hitbon` metadata restores the scalpel's class +2.  Input260
  now matches native through `xkilled()`'s `rn2(6)` and kills gas spore121.
- The next missing owners are `corpse_chance()`'s `4d6`, `mon_explodes()`'s
  independent `4d6`, and the ordered shrieker/hero pager transaction across
  inputs260-262.
- Bounded replays took **0.43** and **0.42 seconds**, peaked below
  **164 MB** RSS, and left no verifier process.  No full corpus gate has run.

### 2026-07-31 gas-spore death and explosion are accepted through input262

- The input262 witness now matches every RNG slice, decoded screen, and cursor
  through both explosion pagers, with spore121 detached, shrieker234 at seven
  HP, and the hero at two HP.
- Native detaches and repaints the dead source before `corpse_chance()` can
  suspend in the explosion; retaining a separate final repaint preserves the
  resulting floor state after the effect.
- All nine ordinary-Healer controls pass in **0.93 seconds** at
  **230,768,640 bytes** maximum RSS.  Rerun one bounded seed0030 locator for
  the next strict frontier; no full corpus gate has run.

### 2026-07-31 segment9 input335 is the next level-transition RNG frontier

- Segment9 is exact through input334.  Input335 (`>`) has exact screen/cursor
  state and a shared 50-call RNG prefix, after which JavaScript appends one
  extra `rnd(2)=1`.
- Input336 and the remaining 128 mismatches are downstream of that shifted
  state.  Localize the final calls across descent, level initialization,
  migrated actors, and first new-level scheduling before changing behavior.
- The locator took **1.12 seconds** at **250,003,456 bytes** maximum RSS and
  left no verifier process.  No full corpus gate has run.

### 2026-07-31 projectile stacking and fatal cleanup are accepted through input335

- The native post-`getlev()` graph has 49 identities: 12 monsters, 13
  monster-inventory objects, 20 floor objects, and 4 buried objects.
  JavaScript's one-identity surplus was the net of three unstacked survivor
  arrows and one omitted fatal in-flight arrow.
- `domove()` now retains `u.dx/u.dy`; monster missiles remain globally
  reachable while free; normal and death-time landings both use the shared
  `place_object()` plus `stack_object()` lifecycle.
- Segment6 serializes the native arrow graph—quantity3 at `(29,13)` and a
  fatal singleton at `(28,12)`—and the shared-storage segment9 replay is exact
  in RNG, screen, and cursor through input335.
- The three focused witnesses pass in **0.94 seconds** at **226,918,400
  bytes** maximum RSS.  Run one bounded locator for the next strict frontier;
  no full corpus gate has run.

### 2026-07-31 segment9 input336 is the post-descent continuation frontier

- Segment9 is exact through input335.  Input336 (`Space`) retains exact screen
  and cursor state, but JavaScript's 15-call slice begins `rn2(12)` where
  native's 33-call slice begins `rn2(3)`.
- Later mismatches remain downstream.  Inspect the input335/336 tty boundary,
  pending level-transition transaction, and actor/maintenance owners before
  changing movement or scheduler RNG.
- The bounded locator took **1.22 seconds** at **248,774,656 bytes** maximum
  RSS and left no verifier process.  No full corpus gate has run.

### 2026-07-31 interrupted `fmon` ration preservation is accepted through input336

- `scanMonsterMovement()` had pre-debited later planned actors before the
  fatal archer executed.  Native `movemon_singlemon()` debits lazily, and
  `really_done()` therefore saves every later actor's unspent ration.
- The fatal projectile boundary now restores one debit per unvisited planned
  occurrence before bones serialization.  After restoration, those actors
  supply native's initial movement phase before `mcalcmove()`.
- Segment6 arrow/bones and input175 controls remain exact, and the
  shared-storage segment9 witness is exact in RNG, screen, and cursor through
  input336.  The focused gate passes **3/3** in **0.99 seconds** at
  **264,093,696 bytes** maximum RSS.
- This is logged as a structural scheduler bridge pending a lazy
  planner/executor refactor.  Run the bounded locator for the next strict
  frontier; no full corpus gate has run.

### 2026-07-31 segment9 input338 is the tunnelling-candidate frontier

- Segment9 is exact through input337.  At input338 (`u`), RNG agrees through
  call index18; JavaScript then draws `rn2(10)=8` while native draws
  `rn2(32)=8` followed by `rnd(12)=12` in `mdig_tunnel()`.
- Screen and cursor remain exact at input338.  Identify the actor and compare
  its `mfndpos()` candidate/terrain flags before changing tunnelling or map
  display.
- The bounded locator took **1.22 seconds** at **253,214,720 bytes** maximum
  RSS and left no verifier process.  No full corpus gate has run.

### 2026-07-31 input338 belongs to ghostly attitude recalculation

- Restored dwarf245 is the first differing actor.  JavaScript retains
  `mpeaceful=1` from the lawful deceased hero and therefore spends `rn2(10)`
  on peaceful item search before a random candidate reservoir.
- Native `restore.c:getlev(ghostly)` recalculates each non-shopkeeper's
  peacefulness for the new hero and then recalculates `malign`.  The neutral
  restoring hero makes this lawful dwarf hostile, so its recent-track gate
  owns `rn2(32)` and directed pursuit reaches `mdig_tunnel()`.
- `savebones()` itself preserves ordinary peacefulness; only tame actors are
  made hostile there.  A blanket save-time hostility change and a tunnelling
  permission patch are both falsified.
- Add the missing restore-time attitude owner and use input338 plus the saved
  and restored dwarf state as the bounded acceptance witness.  No full corpus
  gate has run.

### 2026-07-31 ghostly attitude recalculation is accepted through input338

- `getbones()` now recomputes every restored non-shopkeeper's attitude for the
  new hero after graph/identity restoration, preserves the co-aligned-unicorn
  exception, and recalculates `malign`.
- Segment6 proves dwarf245 is correctly stored peaceful for the deceased
  lawful hero.  Segment9 proves it restores hostile with `malign=4` for the
  neutral Healer and owns native's directed `rn2(32)` plus tunnelling
  `rnd(12)` at input338.
- The nonfatal arrow, fatal arrow/bones graph, and restored segment9 witnesses
  pass **3/3** in **0.98 seconds** at **273,760,256 bytes** maximum RSS.
  Run one bounded locator for the next strict frontier; no full corpus gate
  has run.

### 2026-07-31 segment9 input343 is the restored-sleeper frontier

- Segment9 is exact through input342.  Native input343 begins with
  `rn2(7)=4 @ disturb(monmove.c:351)` and has 124 calls; JavaScript skips that
  owner and begins with `set_apparxy`, producing 58 calls.
- The screen and cursor are still exact at input343.  Input344's monster glyph
  and input345's combat/name differences are downstream of the missing wake
  transaction.
- Identify the restored sleeping actor and reproduce `disturb()` in the
  pre-scan distress phase before changing movement, rendering, or combat.  The
  locator took **1.22 seconds** at **251,936,768 bytes** maximum RSS and left
  no verifier process.  No full corpus gate has run.

### 2026-07-31 input343 belongs to ghost279's `dochug()->disturb()`

- Before input343, ghost279 is the only sleeper: `(29,13)`, distance squared
  9 from Hermione, visible, movable, and holding one 12-point ration.
- Native debits the ration and runs `disturb()`.  Ghost is `S_GHOST`, not
  `S_HUMAN`, so it consumes `rn2(7)=4`, stays asleep, and returns before
  `set_apparxy()`.  JavaScript currently returns for every sleeper with no
  disturbance probe.
- Port the complete predicate at the sleeper gate.  Do not special-case the
  ghost or compensate in later movement.  The state probe took **0.79
  seconds** at **217,989,120 bytes** maximum RSS and left no verifier process.
  No full corpus gate has run.

### 2026-07-31 sleeper disturbance is accepted through input343

- The sleeper gate now implements native sight/distance, Stealth/ettin,
  resistant-species, Aggravate/class, and ordinary one-in-seven wake policy.
- Ghost279 consumes native's `rn2(7)=4`, remains asleep, and input343 matches
  all 124 RNG calls plus screen/cursor.  The arrow and bones controls remain
  exact; the focused gate passes **3/3** in **0.93 seconds** at
  **270,581,760 bytes** maximum RSS.
- A future successful visible wake still needs a tty-suspension witness.  Run
  one bounded locator for the next strict frontier; no full corpus gate has
  run.

### 2026-07-31 segment9 input345 is named-ghost grammar

- Segment9 is exact through input344.  Input345 has exact RNG and cursor but
  JavaScript says `You miss the ghost.` where native says
  `You miss Elara's ghost.`.
- The restored actor already carries `name="Elara"`.  Verify and port
  `x_monnam()`'s named-ghost possessive policy at the shared melee-object
  naming boundary; do not change combat or bones state.
- Input347's farlook pager is the next independent presentation frontier.
  The locator took **1.19 seconds** at **255,426,560 bytes** maximum RSS and
  left no verifier process.  No full corpus gate has run.

### 2026-07-31 named-ghost melee grammar is accepted through input345

- Hero melee now uses `x_monnam()`-shaped instance names: named ghosts render
  as the possessive given name plus `ghost`, without an ordinary article.
- Input345 is exact as `You miss Elara's ghost.` with unchanged RNG/cursor.
  The three focused controls pass in **0.96 seconds** at **270,303,232
  bytes** maximum RSS.
- Input347's first-use farlook pager/tutorial remains the next independent
  frontier.  No full corpus gate has run.

### 2026-07-31 input347--349 belongs to the shared first-use getpos tip

- Segment9 is exact through input346.  Native input347 suspends the farlook
  prompt as `Pick a monster, object or location.--More--`, input348 shows the
  Lua farlook tutorial, and input349 enters getpos with
  `Move cursor to a monster, object or location:`.
- `pager.c:do_look()` owns the initial prompt; `getpos()` then calls the
  one-time `handle_tip(TIP_GETPOS)`, and the Lua text window causes the tty
  suspension before `show_goal_msg` repaints the cursor prompt.
- Reuse the shared getpos-tip bit and presentation helpers in `doFarlook()`.
  Cursor movement, feature lookup, monster description, and RNG are all
  downstream.  No full corpus gate has run.

### 2026-07-31 shared first-use getpos onboarding is accepted through input349

- `doFarlook()` now pages the caller prompt, shows the existing shared Lua
  tutorial, and enters getpos with the native goal prompt on three distinct
  input boundaries.
- Segment9 matches RNG, screen, and cursor through input349.  Together with
  both arrow/bones controls, the focused gate passes **3/3** in **0.98
  seconds** at **272,039,936 bytes** maximum RSS.
- Input350's named sleeping-ghost auto-description is the next separate
  boundary.  No full corpus gate has run.

### 2026-07-31 segment7 input44 is a naming-invariant regression

- The bounded locator finds exact RNG/cursor at inputs44--45 but
  `You miss lichen.` instead of native `You miss the lichen.`.
- The lichen constructor redundantly stores its species label in
  `monster.name`; the input345 repair then mistakes it for native
  `has_mgivenname()` state and suppresses the article.
- Remove the synthetic instance name and add an input45 control.  Do not
  weaken the actual named-ghost policy or patch combat prose.  Input350 remains
  next after this regression is closed; no full corpus gate has run.

### 2026-07-31 the ordinary-lichen naming invariant is repaired

- Ordinary lichen construction no longer writes a species label into the
  instance-name field.  Species rendering continues to derive from `mnum`.
- Segment7 is exact through input45, including both `the lichen` misses.  The
  named-ghost/farlook and projectile controls remain exact; the focused gate
  passes **4/4** in **1.27 seconds** at **270,221,312 bytes** maximum RSS.
- Resume input350's named sleeping-ghost auto-description.  No full corpus
  gate has run.

### 2026-07-31 input350 is the missing projected-monster farlook layer

- Tutorial/getpos input349 and input350's cursor are exact, but JavaScript
  leaves the topline blank where native paints `Elara's ghost, asleep`.
- Native `auto_describe()->do_screen_description()->look_at_monster()` names
  the projected actor through the instance-name layer and appends
  `msleeping` state.  JavaScript farlook currently checks only trap/terrain.
- Inspect projected monsters before terrain and share the actual
  given-name/ghost formatter with melee.  No full corpus gate has run.

### 2026-07-31 projected-monster farlook is accepted through input350

- Farlook auto-description now gives a displayed live monster precedence over
  its underlying terrain and shares the given-name/ghost formatter with
  melee.
- Segment9 input350 is exact as `Elara's ghost, asleep`; the lichen and
  projectile controls remain exact.  The focused gate passes **4/4** in
  **1.11 seconds** at **275,349,504 bytes** maximum RSS.
- Continue with a bounded locator; no full corpus gate has run.

### 2026-07-31 the complete farlook transaction is exact through input354

- A bounded engine-only locator finds zero mismatches through input365.
- Input351's short terrain auto-label and inputs352--354's separate wrapped
  verbose pager, invalid dismissal key, and valid dismissal all match.
- Promote through input354 into the focused witness, then locate the next
  divergence in this public session.  No full corpus gate has run.

### 2026-07-31 farlook input354 is promoted to the focused gate

- The segment9 witness now durably compares the full first-use farlook
  transaction through the verbose pager's valid dismissal.
- Four controls pass in **0.90 seconds** at **268,615,680 bytes** maximum
  RSS.  Locate the next actual divergence through the remainder of this one
  public session; no full corpus gate has run.

### 2026-07-31 segment9 input371 is the tty extended-command editor

- The session is exact through input370.  Native accepts a leading space and
  moves the cursor; JavaScript ignores it, then wrongly autocompletes the next
  `f` to `force`.
- `hooked_tty_getlin()` accepts printable raw bytes, preserves case and
  punctuation, runs autocomplete against the whole buffer, caps it at
  `COLNO`, and wraps the physical cursor.
- Port the general line-editor contract and retain a valid autocomplete
  control.  The 97 later locator mismatches are downstream within the same
  open buffer; no full corpus gate has run.

### 2026-07-31 raw tty extended-command editing is accepted through input451

- `doextcmd()` now preserves printable raw bytes, separates display
  autocomplete from Return-time normalization, wraps at the tty boundary, and
  caps the buffer at `COLNO`.
- Segment9 is exact through the first ignored over-cap byte at input451, and
  the independent valid `#quit` autocomplete/kill-line witness still passes.
  The focused gate is **5/5** in **1.42 seconds** at **267,993,088 bytes**
  maximum RSS.
- Re-run this one public-session locator through its end; no full corpus gate
  has run.

### 2026-07-31 seed0030 is locally exact across all 1,953 states

- The complete engine-only locator reports zero RNG, decoded-screen, or
  cursor mismatches across all ten lives.
- This closes seed0030 as an individual public-session witness but does not
  update the measured 42/44 corpus checkpoint.  Seed0014 is the remaining
  known public frontier.
- The locator exited in **1.32 seconds** at **254,672,896 bytes** maximum RSS.
  No full corpus, normal suite, held-out judge, push, or submission ran.

### 2026-07-31 seed0014 input23 is empty-pack identify continuation

- The session is exact through input22.  Native input23 stops after the
  identify selection roll on a combined read/type `--More--`; JavaScript
  immediately consumes 24 scheduler calls.
- `identify_pack()` finds no unidentified objects and emits
  `You have already identified the rest of your possessions.`.  That third
  pline forces the pager and moves the scheduler to input24.
- Add the missing zero-candidate message at the identify owner; do not move or
  pad scheduler RNG.  No full corpus gate has run.

### 2026-07-31 empty identify-pack continuation is accepted through input24

- `readIdentifyScroll()` now emits the native `the rest`/`all` empty-pack
  message after computing the selection limit.
- Seed0014 input23 pages after its three effect calls, and input24 owns the
  exact 24-call scheduler slice.  Six focused controls pass in **1.75
  seconds** at **268,009,472 bytes** maximum RSS.
- Re-run the seed0014 locator for its next independent frontier; no full
  corpus gate has run.

### 2026-07-31 seed0014 input36 is top-level Options Return acceptance

- The nested pickup-types editor and page-one redraw are exact through
  input35.  Native input36 Return closes Options; JavaScript ignores it and
  traps all later keys in the menu.
- Treat Return/newline as PICK_ANY acceptance in `doOptions()`.  Input37's
  movement, chest message, and scheduler are downstream.
- The locator exited in **0.45 seconds** at **162,037,760 bytes** maximum RSS;
  no full corpus gate has run.

### 2026-07-31 top-level Options Return is accepted through input37

- Newline/Return now closes the parent PICK_ANY menu after the nested
  pickup-types Return redraws it.
- Seed0014 is exact through the restored map and following chest movement;
  six controls pass in **1.41 seconds** at **267,681,792 bytes** maximum RSS.
- Re-run the locator for the next frontier; no full corpus gate has run.

### 2026-07-31 seed0014 input44 exposes missing dwarf inventory substitution

- The session is exact through input43; input44 has exact RNG and paging but
  says `your spear` instead of native `your dwarvish spear`.
- Native substitutes `SPEAR` to `DWARVISH_SPEAR` in `ini_inv()` before the
  object is linked and wielded.  JavaScript's common substitution map omitted
  every dwarf row, so this is live object identity rather than a force-lock
  wording bug.
- Restore the source dwarf rows and equipment-family classification, then
  require the wielded object to be type 30 in the input44 witness.  The later
  chest-destruction transaction remains independently unaccepted.

### 2026-07-31 dwarf starter identity is accepted through seed0014 input44

- The common source-shaped substitution now turns a dwarf Valkyrie's starting
  spear into live `DWARVISH_SPEAR` before wielding.
- Seed0014 matches RNG, screen, and cursor through input44 and explicitly
  asserts weapon type 30.  Six focused controls pass in **1.25 seconds** at
  **267,796,480 bytes** maximum RSS.
- Continue at input45's successful force and chest-destruction transaction;
  no full corpus gate has run.

### 2026-07-31 seed0014 force-lock exposes discarded supply-chest contents

- The input45--47 transcript proves two live contents: a head-linked
  spellbook shatters on `rn2(3)=0`, then the survivability item survives
  `rn2(3)=2`.
- JavaScript's Oracle-approach supply-chest branch generated every object and
  consumed exact RNG but never linked any of them into the container.
- Link primary candidates and retain the lowest-level optional spellbook at
  `fill_ordinary_room()`; do not synthesize content inside force-lock.  Then
  port the resumable `breakchestlock()` transaction.

### 2026-07-31 first destruction witness fails at delobj object resistance

- Inputs45--46 now page at the correct source boundaries and input47 places
  the surviving spellbook correctly, but the focused gate is **5/6**.
- Native `delobj_core()` consumes `obj_resists(box, 0, 0)` before deleting
  the ordinary chest; JavaScript spliced the chest without that draw.
- Restore the deletion lifecycle gate before touching pet-goal or scheduler
  code, then rerun the same input47 witness.

### 2026-07-31 supply-chest destruction is accepted through input47

- The real two-object supply chain, three resumable messages, shatter rolls,
  surviving floor spellbook, chest deletion, and `obj_resists` draw now match.
- Seed0014 is exact through input47; six focused controls pass in **1.27
  seconds** at **271,269,888 bytes** maximum RSS.
- Re-run the bounded seed0014 locator; no full corpus gate has run.

### 2026-07-31 seed0014 remains exact through input100

- The bounded engine-only locator reports zero RNG, screen, or cursor
  mismatches through input100 after the destruction repair.
- Continue the same session in bounded windows; no aggregate corpus result is
  inferred.

### 2026-07-31 seed0014 input124 inherits a dead monster's worn mask

- The locator is exact through input123.  Input124 omits helm `h` from the
  wear prompt, then input125 falsely reports that it is already worn.
- The picked-up helm has `owornmask=4,worn=true` while both hero helmet slots
  are null.  JavaScript's hero-kill release skipped native
  `relobj()->mdrop_obj()->extract_from_minvent()`, which clears monster
  equipment state before floor placement.
- Repair the common monster-inventory release boundary and require the wear,
  delayed-finish, enchantment discovery, and cursed-removal sequence to match;
  do not patch the prompt.

### 2026-07-31 monster gear extraction is accepted through input129

- Hero-kill `relobj` now clears the dead carrier's worn/equipment state after
  its naming observation and before floor placement.
- Seed0014 is exact through input129, including the helm selector, delayed
  donning finish, `-4` identification, and cursed takeoff rejection.
- Seven focused controls pass in **1.23 seconds** at **271,024,128 bytes**
  maximum RSS.  Continue the bounded locator; no full corpus gate has run.

### 2026-07-31 seed0014 input143 exposes a sickness-potion color override

- The locator is exact through input142.  Input143 differs only because the
  observed purple-red potion remains color 8 instead of runtime shuffled
  color 5.
- `objectColor()` bypasses the already-correct shuffled `objectColors` table
  for every `POT_SICKNESS`.  Audit the seed5006 bones witness which motivated
  that override before narrowing it.
- Input152's missing sickness effect is a later independent boundary; keep it
  out of the color correction.

### 2026-07-31 shuffled sickness-potion color is accepted through input151

- Removing the global neutral-color exception makes seed0014's observed
  purple-red potion use runtime color 5.
- The complete seed5006 bones regression remains exact, falsifying the claim
  that its witness requires a sickness-type display exception.
- Eight focused controls pass in **1.59 seconds** at **271,581,184 bytes**
  maximum RSS.  Input152's missing sickness effect is next.

### 2026-07-31 blessed sickness effect is accepted through input153

- The first poison-taste line suspends at input152; input153 resumes with the
  mildly stale qualification, one damage, Wisdom discovery draw, potion
  consumption, and exact scheduler tail.
- Seed0014 is exact through input153 and eight focused controls pass in
  **1.50 seconds** at **275,316,736 bytes** maximum RSS.
- Only the blessed source branch is accepted; unblessed poison handling
  remains unclaimed.  Continue the bounded locator.

### 2026-07-31 seed0014 input212 bypasses native inventory merging

- The locator is exact through input211.  Native input212 pauses on the
  item-comparison discovery message, while JavaScript assigns a second food
  ration to `l` and immediately runs the elapsed-turn scheduler.
- Inventory ration `d` has all knowledge bits; the otherwise-compatible floor
  ration lacks `bknown` and `rknown`.  Native `addinv()->merged()` preserves
  `d`, combines the quantity, promotes knowledge, and owns the pager.
- Port that lifecycle transaction and require input213 to report
  `d - an uncursed food ration (2 in total).` before the exact scheduler
  slice.  No aggregate corpus result is inferred.

### 2026-07-31 input213 parity passes; the first focused gate has a stale HP assertion

- RNG, screen, and cursor comparison is exact through input213, so the
  comparison pager, merged-stack line, and scheduler slice all pass.
- The **7/8** gate failed only because an input153 terminal assertion expected
  HP 17; native-matching play regenerates it to 18 by input213.
- Update that checkpoint assertion and rerun the identical focused gate; do
  not alter the accepted sickness or merge behavior.

### 2026-07-31 inventory merge is accepted through seed0014 input213

- Pickup now applies the shared physical `mergable()` predicate, preserves the
  carried stack identity, combines quantity and weight, and promotes differing
  knowledge dimensions before presentation.
- Inputs212--213 reproduce the comparison pager, `d - an uncursed food ration
  (2 in total).`, and exact nine-call scheduler slice.
- Eight focused controls pass in **1.74 seconds** at **268,140,544 bytes**
  maximum RSS.  Continue the bounded locator; no full corpus gate has run.

### 2026-07-31 seed0014 input227 omits the failed-comprehension book effect

- The locator is exact through input226.  Spellbook `l` is an ordinary
  level-3 sleep book; `rnd(20)=12` exceeds Dequa's read ability 6.
- Native routes that ordinary failure through `cursed_book()`: case one
  aggravates monsters and prints `You feel threatened.`, the book survives
  `rn2(3)=2`, and the source `-2` study delay ends with
  `You can move again.`.
- Port the witnessed effect and negative-multi boundary; do not mark the book
  itself cursed or repair later monster movement.

### 2026-07-31 failed spellbook comprehension is accepted through input227

- The ordinary sleep book now reaches the witnessed `cursed_book()` case-one
  effect after its failed comprehension roll, aggravates monsters, survives
  the separate crumble roll, and installs the source `-2` study delay.
- Seed0014 reproduces `You feel threatened.  You can move again.` plus the
  exact two scheduler passes; eight controls pass in **1.76 seconds** at
  **271,204,352 bytes** maximum RSS.
- Other bad-book effect cases remain unclaimed.  Continue the bounded locator;
  no full corpus gate has run.

### 2026-07-31 kicked-square avoidance is accepted through input253

- The locator was exact through input251.  A door-shattering kick at
  `(7,15)` then let JavaScript feed the just-kicked square into the tame pet's
  random movement reservoir, adding a fifth `rn2(5)` and shifting the rest of
  the scheduler slice.
- Native `dokick()` retains `gk.kickedloc`; `dog_move()` applies
  `m_avoid_kicked_loc()` after occupied-square handling and before traps,
  objects, tracks, or random selection.  JavaScript now preserves that
  command state and applies the same cooperative-monster predicate.
- Seed0014 is exact in RNG, decoded screens, and cursors through input253.
  The focused witness passes **1/1** in **0.44 seconds** at **171,868,160
  bytes** maximum RSS.  Continue the bounded locator; no full corpus gate has
  run.

### 2026-07-31 kicked-square invalidation is accepted through input255

- Input254 first differed only in the pet glyph while RNG remained exact.
  JavaScript had retained `_kickedLoc=(7,15)` into the next movement command,
  so the prior turn's cooperative veto silently changed the pet's destination.
- Native `domove()` clears `gk.kickedloc`, and `rhack()` clears it before any
  later elapsed non-kick command.  A new top-level JavaScript dispatch now
  invalidates the old target; the suspended kick direction still installs and
  retains its own target for that kick's monster phase.
- Seed0014 is exact through input255 and `_kickedLoc` is null at the later
  checkpoint.  The focused witness passes **1/1** in **0.42 seconds** at
  **172,081,152 bytes** maximum RSS.  Continue the bounded locator; no full
  corpus gate has run.

### 2026-07-31 forced bear-trap bungle is accepted through input284

- JavaScript forced `A bear trap closes on your foot!` through an explicit
  `--More--`, deferred 36 scheduler calls, invented a pickup-only load
  warning, and assigned `Burdened` directly.
- Native's force-bungle path suppresses the finish-arming line, so
  `trapeffect_bear_trap()` owns one ordinary `pline()` followed by wounded-leg
  state, damage, and Dexterity exercise.  It owns neither a pager nor
  encumbrance.
- Seed0014 is exact through input284 at HP 11 and Dexterity 11, with the exact
  40-call slice and no status suffix.  The focused witness passes **1/1** in
  **0.41 seconds** at **170,950,656 bytes** maximum RSS.  Continue the bounded
  locator; no full corpus gate has run.

### 2026-07-31 pickup sortloot and Space commit are accepted through input287

- Both floor objects had correct `oclass=7`; JavaScript nevertheless
  special-cased only the corpse into `Comestibles` and put the ration under
  `Other`.  It also preserved floor order instead of native food subclasses.
- Pickup projection now derives headings from numeric class and orders food
  as native `loot_classify()` does, placing the ordinary ration before the
  corpse.  PICK_ANY Space now advances only when another page exists and
  otherwise commits the selection.
- Inputs285--287 reproduce ration `a`, corpse `b`, ration pickup as inventory
  letter `m`, and the exact 33-call scheduler.  The focused witness passes
  **1/1** in **0.44 seconds** at **233,275,392 bytes** maximum RSS.  Continue
  the bounded locator; no full corpus gate has run.

### 2026-07-31 cold-wand ray and nested hero-kill lifecycle are accepted through input306

- The locator was exact through input305.  Inputs304--306 are suspended
  `#zap`, wand `n`, and northwest direction `y`; JavaScript omitted
  `weffects()->ubuzz()->dobuzz()` and therefore let the adjacent newt attack
  instead of resolving the cold ray.
- Directional `WAN_COLD` now preserves Wisdom exercise, range, to-hit, 6d6
  damage, cold inventory destruction, wand resistance, shared `xkilled()`
  and corpse creation, continued bounces, beam cleanup, and wand discovery.
  The shared kill owner also accepts a non-weapon attribution for ray deaths.
- Input306 reproduces the exact 54-call slice, `You kill the newt!`, the newt
  corpse at `(19,11)`, HP 15, and discovery of wand identity 78 with three
  charges remaining.  The focused witness passes **1/1** in **0.38 seconds**
  at **170,426,368 bytes** maximum RSS.  Cold floor transformation and other
  unwitnessed beam types remain unclaimed; continue the bounded locator.  No
  full corpus gate has run.

### 2026-07-31 rotten one-bite corpse completion is accepted through input309

- Rotten food quarters the newt corpse's nutrition from 20 to 5.  With
  weight 10, source scaling reduces its eating delay to one, so
  `start_eating()` immediately calls `done_eating(FALSE)` rather than
  installing an occupation.
- Corpse completion is now shared by immediate and occupied meals.  The
  immediate edge suppresses “You finish eating…” while retaining newt
  post-effects, object removal, repaint, and the following object/monster
  phase.
- Input309 reproduces only `Blecch!  Rotten food!`, the exact newt-buzz prefix
  and 30-call slice, power 1/1, no remaining corpse, and no occupation.  The
  focused witness passes **1/1** in **0.37 seconds** at **179,519,488 bytes**
  maximum RSS.  Continue the bounded locator; no full corpus gate has run.

### 2026-07-31 low-fate fountain draught is accepted through input342

- The locator was exact through input341.  Input342 rolled fountain fate 5;
  JavaScript omitted native's pre-switch low-fate branch and therefore
  skipped the `rnd(10)` nutrition call and cool-draught line.
- `drinkFountain()` now credits the rolled nutrition and message before its
  existing dry-up owner.  The later non-drying roll and scheduler remain
  shared and source ordered.
- Input342 reproduces the exact 49-call slice, `The cool draught refreshes
  you.`, hunger 830, and the still-present fountain at `(48,16)`.  The
  focused witness passes **1/1** in **0.39 seconds** at **173,506,560 bytes**
  maximum RSS.  Blessed-fountain early return and other unwitnessed outcomes
  remain unclaimed; continue the bounded locator.  No full corpus gate has
  run.

### 2026-07-31 nested fountain dip and worn rust are accepted through input373

- The locator was exact through input371.  JavaScript discarded the selected
  `#dip` target at input372, while native retained the cursed worn helm and
  opened a fountain yes/no prompt before returning from the command.
- `dodip()` now preserves that nested selector boundary.  Accepted fountain
  dips enter forced carried-object water damage, share the erosion formatter
  and mutation owner, refresh worn armor class, and return their result to
  `dipfountain()`'s separate continuation gate.
- Inputs372--373 reproduce the exact question, tty cursor,
  `Your orcish helm rusts!`, the 30-call slice beginning `rn2(2)=0`, one
  erosion level, AC 10, and unchanged terrain.  The focused witness passes
  **1/1** in **0.41 seconds** at **175,783,936 bytes** maximum RSS.  The
  random fountain-dip event remains unclaimed; continue the bounded locator.
  No full corpus gate has run.

### 2026-07-31 tty prompt wrap and complete rust are accepted through input384

- The third helm question reached physical column 80.  Native tty wrapped its
  insertion cursor to `(1,1)` while JavaScript left an out-of-range `(80,0)`.
- Shared yes/no prompt cursor placement now observes the 79-column top-line
  span and continuation-row origin without changing the prompt buffer.
- Inputs383--384 reproduce the exact wrapped cursor, complete-rust message,
  52-call slice, maximum erosion, worn/cursed identity, armor status, and
  unchanged fountain.  The focused witness passes **1/1** in **0.40
  seconds** at **175,865,856 bytes** maximum RSS.  Continue at the
  max-erosion naming/event edge; no full corpus gate has run.

### 2026-07-31 max-rust dip naming and default event are accepted through input389

- Once the full helm name exceeded `short_oname()`'s 49-character budget,
  native temporarily suppressed BUC and erosion knowledge for the prompt.
  The real object remained cursed and thoroughly rusty.
- Maximal erosion returns `ER_NOTHING`, which enters the separate random
  fountain event instead of the damage-result early-return gate.  Fate 9
  prints the default no-op line before the shared dry-up check.
- Inputs388--389 reproduce the shortened prompt, exact 20-call slice,
  `Nothing seems to happen.`, fully rusty/cursed/worn state, and unchanged
  fountain.  The focused witness passes **1/1** in **0.42 seconds** at
  **174,440,448 bytes** maximum RSS.  Continue the bounded locator; no full
  corpus gate has run.

### 2026-07-31 fountain-dip gush event is accepted through input394

- Dip fate 25 was selected correctly, but JavaScript skipped the existing
  clear-area gush owner and reached dry-up before native's first distance
  roll.
- The event now delegates to `dogushforth(false)`, preserving its traversal,
  eligibility, trap/object/terrain mutation, repaint, and first-pool message
  before the shared dry-up boundary.
- Input394 reproduces the exact 75-call slice, gush line, visible pool
  projection including `(49,15)`, and surviving hero fountain.  The focused
  witness passes **1/1** in **0.40 seconds** at **175,767,552 bytes**
  maximum RSS.  Continue the bounded locator; no full corpus gate has run.

### 2026-07-31 fountain water-nymph birth is accepted through input409

- Dip fate 22 previously skipped `dowaternymph()` and reached dry-up, making
  every later theft/equipment symptom downstream noise.
- The event now requests explicit species 68 through shared three-ring
  placement and monster initialization, then owns repaint, fountain feedback,
  and forced wakefulness before dry-up.
- Input409 reproduces the exact 86-call slice, `You attract a water nymph!`,
  live awake nymph state, actor projection, and surviving fountain.  The
  focused witness passes **1/1** in **0.44 seconds** at **178,012,160 bytes**
  maximum RSS.  Continue the bounded locator; no full corpus gate has run.

### 2026-07-31 shield removal preserves the already-painted tty AC through input415

- Native commits the small-shield removal and recomputes live AC from 10 to
  14 before its `--More--` pager, but the tty status row remains the earlier
  AC 10 image until the enclosing quiet monster scan completes.
- Immediate `dotakeoff()` now retains the pre-removal AC only as a temporary
  status projection.  Equipment ownership and live armor class change
  immediately; the scan-completion boundary clears the projection.
- Input415 reproduces the exact shield-removal line, cursor, RNG slice,
  visible AC 10, unworn shield, null `uarms`, and live AC 14.  The focused
  witness passes **1/1** in **0.41 seconds** at **176,275,456 bytes** maximum
  RSS.  Continue at the water-nymph theft on input416; no full corpus gate has
  run.

### 2026-07-31 water-nymph ring theft and random relocation are accepted through input417

- The theft candidate was already the right-hand fire-resistance ring, but
  the local formatter exposed its true type and enchantment instead of the
  still-unknown black-onyx appearance, dropped the hand annotation, and used
  an armor verb.
- Theft now shares inventory naming, applies `worn_item_removal()`'s bounded
  ownership/suffix transformation, recognizes authoritative accessory slots,
  and lets the stolen-object urgent line remain pending while `rloc()` appends
  its vanish message.
- Inputs416--417 reproduce both native lines, the exact 42-call relocation and
  scheduler slice, accepted nymph destination `(11,7)`, ring transfer, right
  slot clearing, and AC 14 repaint.  The focused witness passes **1/1** in
  **0.41 seconds** at **176,062,464 bytes** maximum RSS.  The fifty-failure
  relocation fallback remains unclaimed; continue the bounded locator.  No
  full corpus gate has run.

### 2026-07-31 dry-up pager and fleeing-nymph relocation are accepted through input425

- A second gush created no new pool, so native retained the spray fallback and
  appended the dry-up line.  The dip wrapper had instead overwritten its first
  line with the second.
- The fleeing nymph's one-in-40 success enters the same random `rloc()` owner
  as theft, then ends that actor before courage, movement, or attack work.
  Its appearance line remains suspended behind the fountain pager.
- Inputs424--425 reproduce the combined fountain pager, exact 32-call
  relocation prefix, appearance line, exact 31-call later-actor slice,
  destination `(47,12)`, retained stolen ring, and dried room terrain.  The
  focused witness passes **1/1** in **0.42 seconds** at **176,865,280 bytes**
  maximum RSS.  Continue the bounded locator; no full corpus gate has run.

### 2026-07-31 elapsed water-nymph chat is accepted through input455

- The `#chat` prompt and southeast target were exact, but ordinary nymph chat
  fell through JavaScript's quest/pet/fixture-only dispatcher as a zero-time
  command.
- The same-gender `MS_SEDUCE` outcome now emits
  `The water nymph cajoles you.` without RNG and returns an elapsed command,
  leaving the ordinary actor scan to own all subsequent work.
- Input455 reproduces the exact 68-call slice and combined cajole/pet-miss
  pager.  The focused witness passes **1/1** in **0.44 seconds** at
  **176,668,672 bytes** maximum RSS.  Continue at the paged
  monster-versus-monster continuation; no full corpus gate has run.

### 2026-07-31 two-slot nymph counterattack is accepted through input458

- The immediate counterattack retained only its first claw and formatted its
  compatible 0d0 seduction contact as a generic hit, then entered later actor
  RNG before native's second claw.
- Deferred counterattacks now keep the complete attack array and advance one
  tty-bounded slot at a time.  Compatible water-nymph hits and misses use the
  native engaging/friendly wording.
- Inputs457--458 reproduce the first charm pager, both slot tails, the second
  to-hit roll, missed-charm line, post-counterattack flee check, and scheduler
  suffix.  The focused witness passes **1/1** in **0.45 seconds** at
  **186,302,464 bytes** maximum RSS.  Continue the bounded locator; no full
  corpus gate has run.

### 2026-07-31 natural experience-level gain is accepted through input461

- The shared hero-kill owner awarded the water nymph's experience but never
  called the `newexplevel()` boundary, so JavaScript remained level 1 and
  skipped the three HP/power calls and welcome line.
- Natural level gain now preserves sub-next-threshold experience, retains the
  old-level HP/power increments, advances one level, projects the welcome
  line, and then applies role abilities.  Wizard-set level changes retain
  their distinct experience rewrite.
- Input461 reproduces the exact 94-call slice and combined kill/welcome
  topline.  Dequa is level 2 with 25 experience, HP 31/31, power 2/2, and
  retained increments 13/1.  The focused witness passes **1/1** in **0.43
  seconds** at **176,504,832 bytes** maximum RSS.  Continue the bounded
  locator; no full corpus gate has run.

### 2026-07-31 recovered inventory letter and fumble boots are accepted through input470

- Native retains the stolen ring's old `k` letter on the physical object and
  reuses it when that slot is free; JavaScript previously overwrote it with
  the rotating cursor's `q`, shifting every later pickup.
- `assignInventoryLetter()` now preserves a valid free incoming letter.
  Fresh combat boots and the looking glass consequently retain the native
  `q`/`r` allocation.
- The combat boots are unidentified fumble boots.  Their delayed `Boots_on()`
  callback now consumes `rnd(20)=14` and retains effective Fumbling with a
  14-turn timeout after the dressing message and maintenance tail.
- Inputs462--470 reproduce exact per-input RNG, screens, cursors, object
  identity, inventory letters, worn slot, and fumble state.  The focused
  witness passes **1/1** in **0.44 seconds** at **175,620,096 bytes** maximum
  RSS.  Continue the bounded locator; no full corpus gate has run.

### 2026-07-31 Water-surrounded-vault generation is accepted through input482

- Level 2's themed-room reservoir selected `Water-surrounded vault`, but
  JavaScript had metadata without a callback and fell through to a generic
  room after the first 909 exact calls.
- The full Lua/C transaction now owns the retry-placed moat map, random-lit
  irregular unjoined interior, shuffled chests and escape item, ordinary
  container contents, shuffled named undead, and teleport exclusion.
- Input481 reproduces all **2,562** generation calls; input482 commits the
  staged destination after the descent pager.  Exact screens/cursors plus
  structural assertions confirm four interior chests, one guaranteed escape
  item, the vampire-line actor, and the exclusion.  The focused witness passes
  **1/1** in **0.49 seconds** at **180,355,072 bytes** maximum RSS.  Continue
  the bounded locator; no full corpus gate has run.

### 2026-07-31 input488 first reaches the active Fumbling timeout owner

- Inputs483--487 remain exact.  Input488 matches the complete actor/allocation
  prefix through the random-monster gate, then native expires the timed
  Fumbling component while JavaScript skips directly to HP regeneration.
- Native's empty-square on-foot branch consumes `rn2(4)=2`, prints
  `You slip and nearly fall.`, installs `multi=-2`, and renews the timed
  component with `rnd(20)=12` because the fumble boots remain worn.
- The missing boundary is `nh_timeout()` plus `u.umoved`, not level
  generation or monster scheduling.  Implement and validate that bounded
  owner through input488 before advancing; no full corpus gate has run.

### 2026-07-31 correction: `u.umoved` is scoped to one hero action

- `allmain.c` clears `u.umoved` before continued runs, commands, occupations,
  and negative-`multi` actions, not only before externally read input.
- The flag spans all monster/global allocations needed to settle the current
  action, then clears before the fumbling-imposed helpless action begins.
  Journal block1536's timeout diagnosis stands; only its flag-lifetime wording
  was too broad.

### 2026-07-31 clear-floor fumble-boots expiry is accepted through input488

- Timed Fumbling now decrements at the `nh_timeout()` boundary, before HP
  regeneration.  The successful-movement tail supplies action-scoped
  `u.umoved`; the internally scheduled helpless action clears it.
- Input488 reproduces `rn2(4)=2`, `You slip and nearly fall.`,
  `rnd(20)=12`, and the full automatically elapsed suffix.  Final state has
  effective Fumbling with 11 turns, `u.umoved=false`, and no remaining
  helpless turn.
- The focused witness passes **1/1** in **0.64 seconds** at
  **177,373,184 bytes** maximum RSS.  Continue the bounded locator; the
  object, ice, mount, noise, and non-boots branches remain unclaimed, and no
  full corpus gate has run.

### 2026-07-31 input497 exposes `nomul(-2)` run cancellation

- Inputs489--496 remain exact.  On the second Shift-`K`, native trips once and
  returns after 124 calls; JavaScript retains `_runState`, resumes after the
  helpless turn, trips again, and consumes 688 calls.
- `nomul(-2)` always owns `end_running(TRUE)`.  The timeout implementation
  reproduced duration and renewal but missed this control-flow edge.
- Stop the active run at the Fumbling expiry boundary and validate input497
  before advancing; no full corpus gate has run.

### 2026-07-31 Fumbling run cancellation is accepted through input497

- The expiry owner now clears `_runState` through the shared run-cancellation
  boundary before scheduling the two-turn helpless interval.
- Input497 reproduces one trip line, exactly 124 calls, native map/cursor
  state, and returns with no run or helpless debt.  The focused witness passes
  **1/1** in **0.60 seconds** at **179,781,632 bytes** maximum RSS.
- Continue the bounded locator; no full corpus gate has run.

### 2026-07-31 input498 prematurely runs `exerchk()` during Shift-run `multi`

- Input498 is exact for 333 calls, then JavaScript inserts `rn2(50)` and
  `rn2(200)` while native proceeds to engraving wear.
- Both start `next_attrib_check` at 600.  Native suppresses the attribute test
  because Shift-`H` retains positive `gm.multi`; JavaScript keeps that state
  in `_runState` but checks only `game.multi`.
- Make the exercise-check gate observe live multi representations and
  validate input498 before advancing; no full corpus gate has run.

### 2026-07-31 Shift-run attribute-check deferral is accepted through input498

- `exerchk()` now treats the port's run, delayed, helpless, prayer, wait, and
  study states as nonzero source `multi`, while leaving zero-multi eating and
  lock-picking outside that gate.
- Input498 reproduces all 334 native calls and exact presentation without the
  premature two-call attribute test; `_nextAttribCheck` remains 600.
- The focused witness passes **1/1** in **0.54 seconds** at
  **190,660,608 bytes** maximum RSS.  Continue the bounded locator; no full
  corpus gate has run.

### 2026-07-31 input505 reaches missing cream-pie projectile contact

- Inputs499--504, including the nested throw menus and direction prompt, are
  exact.  The hero at `(50,10)` throws northwest at the adjacent kobold
  `(49,9)`.
- Native consumes `rnd(20)=2`, `rnd(25)=8`, and `rn2(25)=1`, splashes the
  kobold's face, blinds/angers it, consumes the pie, and deals zero damage.
  JavaScript instead begins generic landing with `rn2(100)`.
- Implement the source-shaped adjacent hit before generic landing and
  validate input505; no full corpus gate has run.

### 2026-07-31 adjacent cream-pie contact is accepted through input505

- `dothrow()` now routes the adjacent pie through `thitmonst()` and the
  miscellaneous-object hit owner before any generic landing roll.
- Input505 reproduces the three contact calls, exact splash line, and all 40
  later scheduler calls.  The kobold stays at 2 HP, becomes blind/angry, and
  the pie is consumed.
- The focused witness passes **1/1** in **0.54 seconds** at
  **176,963,584 bytes** maximum RSS.  Continue the bounded locator; no full
  corpus gate has run.

### 2026-07-31 weak kobold bimanual rejection is accepted through input507

- The native kobold carries the blessed quarterstaff, but
  `weapon.c:select_hwep()` rejects it because a quarterstaff is bimanual and
  the kobold lacks `M2_STRONG`.  Pickup policy, carrying capacity, inventory
  identity, actor order, and `weapon_check` all match.
- `selectHandToHandWeapon()` now applies the source strength-and-shield gate
  before preference ranking.  The rejected staff remains in inventory,
  `mon_wield_item()` spends no action, and the kobold continues to the native
  bare-handed hit.
- Input507 reproduces both `set_apparxy()` groups, the complete 76-call RNG
  slice, exact screen/cursor state, and the final carried-but-unwielded weapon
  state.  The focused engine-only witness passes **1/1** in **0.57 seconds**
  at **189,874,176 bytes** maximum RSS.  Continue the bounded locator; artifact
  preference, silver hatred, and the strong-with-shield branch remain
  unclaimed, and no full corpus gate has run.

### 2026-07-31 ordinary pet-kill inventory release is accepted through input509

- Native `mondead()->m_detach(..., TRUE)->relobj()` drops the kobold's
  complete inventory before corpse creation.  JavaScript previously removed
  the dead actor without placing or clearing `minvent`.
- Ordinary death detach now releases the same carried identities, clears
  carrier-owned equipment state, stacks them on the floor, and clears the
  dead actor's inventory/wield pointer.  Migration and disappearance retain
  their distinct non-death policies.
- Input509 reproduces the complete native stream and presentation, including
  the floor weapon glyph and the pet's APPORT `rn2(8)=1` gate.  Quarterstaff
  identity 144 and fourteen-dart identity 137 are on world `(48,9)`.  The
  focused engine-only witness passes **1/1** in **0.55 seconds** at
  **178,929,664 bytes** maximum RSS.  Continue the bounded locator; no full
  corpus gate has run.

### 2026-07-31 Fumbling timeout topline continuation is accepted through input514

- Input513 matches through `slip_or_trip()`'s `rn2(4)=2`, then native tty
  pages the existing pet/hero pickup line before `nomul(-2)`, Fumbling
  renewal, regeneration, or later global-turn work.
- The async maintenance path now defers the timeout prose through ordinary
  topline continuation and resumes the same source transaction after the
  acknowledgment.  Non-paging and synchronous maintenance retain the same
  state transition.
- Input513 ends at exactly 123 calls and `--More--`; input514 begins with
  `rnd(20)=6` and reproduces the full deferred suffix and slip presentation.
  The focused engine-only witness passes **1/1** in **0.57 seconds** at
  **180,305,920 bytes** maximum RSS.  Continue the bounded locator; no full
  corpus gate has run.

### 2026-07-31 unseen-combat topline continuation is accepted through input523

- Fumbling correctly leaves `You stumble.` pending.  A later unseen fight in
  the same Shift-run reached `reportUnseenMonsterCombat()`, whose raw
  `pline()` replaced that pending clause even though all RNG and actor state
  already matched.
- Unseen-combat sound now uses ordinary continuation policy.  Input523
  reproduces `You stumble.  You hear some noises in the distance.` with the
  unchanged native RNG stream and cursor/map projection.
- The focused engine-only witness passes **1/1** in **0.54 seconds** at
  **188,743,680 bytes** maximum RSS.  Continue the bounded locator; no full
  corpus gate has run.

### 2026-07-31 Fumbling closed-door fallback is accepted through input536

- Native suppresses automatic opening while the hero is Confused, Stunned,
  or Fumbling.  The resulting closed-door fallback separately uses Blind,
  Stunned, Dexterity below 10, or Fumbling to decide whether an orthogonal
  attempt spends the turn on an `Ouch!` bump.
- JavaScript now preserves those two predicates instead of routing every
  ordinary locked-door attempt directly to `doopen_indir()` behavior.
  Confusion alone still reports a closed door without spending time, and
  Blind alone does not disable otherwise eligible auto-open.
- Input536 reproduces the exact `Ouch!  You bump into a door.` presentation
  and all 27 native RNG calls while leaving the hero at `(53,8)` and the door
  locked.  The focused engine-only witness passes **1/1** in **0.65 seconds**
  at **186,449,920 bytes** maximum RSS.  Continue the bounded locator; no
  full corpus gate has run.

### 2026-07-31 doorway feature composition is accepted through input548

- `invent.c:look_here()` resolves `dfeature_at()` before describing a lone
  object.  A `D_NODOOR` cell therefore contributes `There is a doorway here.`
  before the corpse clause, and tty joins the two ordinary messages when
  they fit.
- The shared JavaScript feature owner now maps the complete door-mask subset:
  doorway, open door, broken door, and the intact closed-door fallback.
  Movement arrival and explicit look consume that shared result rather than
  reconstructing door prose.
- Input548 reproduces the exact combined doorway/coyote-corpse topline and
  unchanged 18-call native RNG slice.  The focused engine-only witness passes
  **1/1** in **0.59 seconds** at **197,967,872 bytes** maximum RSS.  Continue
  the bounded locator; no full corpus gate has run.

### 2026-07-31 Mines same-race special monsters are accepted through input555

- `sp_lev.c:create_monster()` applies a Mines-only gate after requested
  species and alignment resolution: dwarf or gnome heroes usually replace an
  explicitly requested monster of their own race with a random species.
- The shared named, class, and fixed-coordinate special-monster constructors
  now apply that gate before location humidity and `makemon()`.  The port's
  dormant `In_mines()` macro could not own this boundary because
  `game.mines_dnum` is unbound; generation instead uses its live dungeon
  descriptor plus `minefill`/`minetn`/`minend` target identity.
- Input555 reproduces all **3,639** native generation calls, including
  `rn2(3)=0` at call 2749 for the first explicit dwarf, plus exact
  presentation and cursor state.  The focused engine-only witness passes
  **1/1** in **0.75 seconds** at **199,262,208 bytes** maximum RSS.  Continue
  the bounded locator; no full corpus gate has run.

### 2026-07-31 ordinary peaceful displacement is accepted through input558

- The level-generated adjacent gnome is correctly awake, mobile, untrapped,
  and peaceful.  JavaScript recognized safety but previously restricted the
  one-in-seven refusal and displacement path to `monster.pet`.
- The shared safe-monster path now covers tame and ordinary peaceful actors.
  Refusal makes only tame actors flee; successful swaps use pet ownership or
  `the peaceful <species>` naming as appropriate.
- Input557 reproduces `rn2(7)=0` and `You stop.  The gnome is in the way!`;
  input558 reproduces `rn2(7)=5`, the peaceful swap, and the subsequent
  scheduler movement of the gnome to `(69,7)`.  The corrected focused
  engine-only witness passes **1/1** in **0.62 seconds** at **188,841,984
  bytes** maximum RSS.  Continue the bounded locator; no full corpus gate has
  run.

### 2026-07-31 monster rolling-boulder launch is accepted through input561

- The peaceful gnome leader moves onto an unseen rolling-boulder trap at
  `(60,10)`.  Native extracts boulder identity 331 from `(64,10)`, hits for
  18 damage, and leaves its transient glyph one square east of the actor
  while tty pages the pending stumble/trigger line.
- JavaScript now keeps that object free during presentation, recalculates
  vision at the shared `pline()` boundary after removing the source blocker,
  and resumes fatal detach/corpse creation plus final placement at `(56,10)`
  only after the hit/kill lines return.
- Input560 reproduces all 110 calls, the trigger pager, actor/projectile
  cache, and ten newly visible cells.  Input561 begins with native
  `corpse_chance()` and matches the remaining RNG, presentation, trap
  discovery, actor removal, and boulder identity.  The focused engine-only
  witness passes **1/1** in **0.76 seconds** at **186,712,064 bytes** maximum
  RSS.  Continue the bounded locator; no full corpus gate has run.

### 2026-07-31 tunneling-monster wall sound is accepted through input576

- The wall mutation and all tunneling RNG were already exact, including
  `rnd(12)=5` and the verbose-message gate `rn2(5)=0`; only the post-move
  sound event was not surfaced.
- Allmain now routes the structural `crashingRockAudible` event through
  ordinary continuation for a hearing hero.  Deafness changes prose only.
- Input576 reproduces `You hear crashing rock.` with all 159 native calls,
  screen cells, and cursor state.  The focused engine-only witness passes
  **1/1** in **0.65 seconds** at **189,874,176 bytes** maximum RSS.  Continue
  the bounded locator; no full corpus gate has run.

### 2026-07-31 tunneling stone debris is accepted through input584

- Native `mdig_tunnel()` turns ordinary stone into corridor and, for debris
  rolls 1--4, constructs a real boulder or rock on that square.  JavaScript
  previously consumed the initial `rnd(12)` but implemented wall mutation
  only.
- The shared dig owner now creates and places that floor identity before
  updating vision.  The witnessed `pile=2` rock owns the formerly missing
  `rnd(2)=2` and `rn2(6)=3` calls.
- Input584 reproduces all 77 native calls, screen cells, cursor, corridor,
  and rock object.  The focused engine-only witness passes **1/1** in **0.68
  seconds** at **191,709,184 bytes** maximum RSS.  Continue the bounded
  locator; no full corpus gate has run.

### 2026-07-31 travel planning and run-mode boulder stopping are accepted through input592

- `findtravelpath(TRAVP_TRAVEL)` may keep an ordinary boulder in its graph;
  Sokoban excludes it.  The selected step is then judged again by actual
  `test_move(DO_MOVE)`, which stops a visible run-mode hero who cannot occupy
  the boulder square before any push.
- The shared JavaScript travel graph now preserves ordinary boulder cells,
  and movement applies the source capability predicate for phasing, riding,
  rock-throwing forms, diagonal shoulders, very small forms, and extremely
  light inventory.  Target selection consumes an action even when the first
  step is blocked, matching `dotravel_target()` returning `ECMD_TIME`.
- Input592 reproduces all **88** native calls and exact presentation while
  retaining hero `(55,9)`, boulder `(56,10)`, and cached target `(66,11)`,
  with travel stopped.  The focused engine-only witness passes **1/1** in
  **0.98 seconds** at **190,709,760 bytes** maximum RSS.  Validate the two
  seed0004 travel witnesses, then continue the bounded locator; no full
  corpus gate has run.

### 2026-07-31 correction: travel boulders use a delayed frontier

- Unweighted boulder inclusion preserved seed0014 input592 but regressed the
  seed0004 repeat-travel route at input307.  The source does not assign an
  ordinary step cost: it repeats an unoccupiable boulder node for two extra
  search radii before expanding it.
- The travel owner now mirrors that delayed-frontier lifecycle.  The
  seed0014 input592 witness plus the seed0004 getpos and repeat-travel
  witnesses pass together **3/3** in **1.27 seconds** at **189,497,344
  bytes** maximum RSS.
- Treat the accepted boundary as three separate policies: delayed graph
  membership, actual movement recheck, and `ECMD_TIME` command result.
  Continue the bounded locator from input593; no full corpus gate has run.

### 2026-07-31 visible holes and implicit monster avoidance are accepted through input601

- Native `maketrap()` marks `HOLE` visible at construction; this is separate
  from per-monster `mtrapseen`.  The Mines hole at `(69,15)` is therefore
  already visible on the first destination screen at input600.
- Native `mfndpos()` still selects that square for peaceful gnome 393.
  `mintrap()` then treats holes as implicitly known to non-mindless monsters
  and consumes `rn2(4)` before usually declining the effect.  The gnome stays
  at `(69,15)` with `mtrapseen=0`.
- Input600--601 now matches RNG, screen, and cursor exactly.  The input592
  travel witness and seed0030 trapdoor-migration control pass alongside it
  **3/3** in **1.09 seconds** at **256,081,920 bytes** maximum RSS.  Resume
  the bounded locator from input602; no full corpus gate has run.

### 2026-07-31 monster pit death and corpse construction are accepted through input606

- Native lets ordinary gnome 378 select the concealed pit at `(66,7)`;
  `mintrap()` then owns `rnd(6)=5`, fatal damage, ordinary corpse
  eligibility, temporary corpse identity, timers, and the terminal
  post-movement return.
- JavaScript previously had no `PIT` or `SPIKED_PIT` branch and retained the
  actor before jumping to the next `distfleeck()`.  The shared trap owner now
  handles immunity, learned avoidance, caught state, iron-shoe spike
  suppression, damage, death, and corpse construction; visible entry prose
  remains with allmain's tty projection.
- Input606 now reproduces all **201** native calls, exact presentation,
  actor removal, the ordinary gnome corpse at `(66,7)`, and the still-hidden
  pit.  The input601 hole control and seed0030 trapdoor migration pass with
  it **3/3** in **1.25 seconds** at **259,276,800 bytes** maximum RSS.
  Continue the bounded locator after input606; no full corpus gate has run.

### 2026-07-31 bottom-left cross-wall topology is accepted through input612

- Native `set_crosswall()` maps a sole unfinished bottom-left quadrant to
  `WM_X_BL=3`; bottom-right is `WM_X_BR=4`.  JavaScript previously used
  quadrant array position plus one and swapped those two lower cases.
- At level `(46,7)`, the corrected mode combines with exact `seenv=SV4` to
  project and remember the native brown DECgraphics top-left corner.  No
  terrain, vision, repaint, or RNG change is involved.
- Input612 now matches RNG, screen, and cursor exactly.  The input601 hole
  and input606 pit controls pass with it **3/3** in **1.31 seconds** at
  **274,612,224 bytes** maximum RSS.  Continue the bounded locator after
  input612; no full corpus gate has run.

### 2026-07-31 phase-two miscellaneous scan is accepted through input615

- Native scans bugbear 395's newest-first minvent after the first
  `distfleeck()` and before weapon readiness or movement.  Its newer
  bullwhip consumes `rn2(5)=3`; the older potion of invisibility then wins
  the unprioritized `find_misc()` selection.
- `mquaffmsg()` encounters the older crashing-rock/trip topline and suspends.
  Invisibility and potion consumption therefore remain unapplied at
  input615; they belong after the acknowledgement that exposes the chugging
  line.
- Input615 reproduces all **671** calls, screen, cursor, bugbear position,
  and pre-effect inventory/visibility state.  The focused engine-only
  witness passes **1/1** in **0.75 seconds** at **193,200,128 bytes** maximum
  RSS.  Validate the input618 acknowledgement and input619/620 bullwhip
  continuation next; no full corpus gate has run.

### 2026-07-31 potion, bullwhip, and unseen-contact lifecycle is accepted through input621

- Native `find_misc()` completes the deferred invisibility quaff after the
  input618 acknowledgement, then the same bugbear selects its bullwhip and
  removes the hero's dwarvish spear only after the wrap-line acknowledgement.
  Tty continuation projects the yank line before the unseen-contact Wait line.
- `lookaround()` allows the invisible actor through its optical gate, but
  `domove_core()` still calls `nomul(0)` for the non-safe destination actor
  before `attack_checks()`.  The Wait action spends the current step and the
  bugbear gets its exact monster phase; the Shift-run does not resume afterward.
- Input621 now matches all **33** native calls, screen, and cursor, with the
  potion gone, bullwhip wielded, spear on `(31,14)`, remembered `I`, and run
  state cleared.  The focused engine-only witness passes **1/1** in **0.74
  seconds** at **193,363,968 bytes**; the input612/input615 controls pass with
  it **3/3** in **1.63 seconds** at **263,798,784 bytes**.  Continue the
  bounded locator after input621; no full corpus gate has run.

### 2026-07-31 invisible-monster kick is accepted through input623

- `dokick()` selects the physical destination actor before terrain and uses
  projection only to choose `it` versus a visible name.  The already
  remembered invisible bugbear therefore receives the kick instead of the
  empty-space fallback.
- Fumbling makes the kick clumsy: native consumes `rn2(3)=2`, rolls base
  `rnd(1)=1`, exercises Dexterity, then adds the worn fumble boots'
  enchantment -4.  Final damage is non-positive, so bugbear HP remains 10;
  passive contact still consumes `rn2(3)=1`.
- Input623 matches all **53** native calls, screen, cursor, hunger, exercise,
  kicked location, actor position, and invisible marker.  The focused
  engine-only witness passes **1/1** in **1.10 seconds** at **191,987,712
  bytes**; the input621 control passes with it **2/2** in **1.58 seconds** at
  **250,626,048 bytes**.  Continue the bounded locator after input623; no full
  corpus gate has run.

### 2026-07-31 forced unwield and bare-hands continuation are accepted through input625

- The bullwhip's forced `uwepgone()` transition survives the intervening kick.
  The next ordinary hero melee consumes it once and emits
  `You begin bashing monsters with your bare hands.` before Strength exercise.
- The transition and miss are ordinary sequential tty messages.  They compose
  on one topline; the later invisible-bugbear hit forces that older line
  through `--More--`, then appears after the input625 acknowledgement.
- Inputs624--625 match all RNG, screen, cursor, and one-shot wield state.  The
  focused engine-only witness passes **1/1** in **0.84 seconds** at
  **189,792,256 bytes**; the input621/input623 controls pass with it **3/3**
  in **1.34 seconds** at **272,678,912 bytes**.  Continue the bounded locator
  after input625; no full corpus gate has run.

### 2026-07-31 wield prompt inventory-letter ordering is accepted through input627

- Native `getobj()` builds a temporary `SORTLOOT_INVLET` view before
  collecting candidate letters.  Recovering spear `a` appends it to the
  inventory chain after `b,j`, but the wield prompt still advertises `a,b,j`.
- JavaScript now sorts only the eligible wield view.  It renders
  `[- abj or ?*]` while preserving chronological inventory order `b,j,a` for
  later state owners.
- Input627 matches RNG, screen, and cursor exactly.  The focused engine-only
  witness passes **1/1** in **0.84 seconds** at **203,702,272 bytes**; the
  input625 control passes with it **2/2** in **1.12 seconds** at
  **252,903,424 bytes**.  Continue the bounded locator after input627; no full
  corpus gate has run.

### 2026-07-31 ledger-based gem rarity is accepted through input639

- `o_init.c:setgemprobs()` uses bookkeeping `ledger_no`, not branch-local
  `dlevel` or display depth.  Gnomish Mines level 2 is ledger 54 after the 29
  Dungeons of Doom and 23 Gehennom levels.
- The unchanged level-generation `rnd(1000)=148` therefore selects obsidian
  type 458 in native, not agate type 459.  Existing pickup, drop, floor-menu,
  and glyph owners then project the same durable black gem without local
  presentation patches.
- Input631's focused engine-only witness passes **1/1** in **1.83 seconds** at
  **193,888,256 bytes** maximum RSS; the input625/input627 controls pass with
  it **3/3** in **2.12 seconds** at **278,904,832 bytes**.  The bounded locator
  remains exact through input639 and first differs at input640; no full corpus
  gate has run.

### 2026-07-31 ambient greedy-monster inventory gate is accepted through input646

- Ambient births rejoin native `m_initinv()`'s common metadata-gated tail.
  Rock mole 448 is greedy and carries no gold, so it must consume
  `rn2(5)=3` after its defensive and miscellaneous reservoir rolls even
  though the nonzero result creates no coin object.
- Input640 matches all **351** calls plus screen and cursor.  The focused
  engine-only witness passes **1/1** in **1.99 seconds** at **250,920,960
  bytes** maximum RSS; the input631 control passes with it **2/2** in
  **2.67 seconds** at **261,308,416 bytes**.
- The bounded locator remains exact through input646 and first differs at
  input647's travel cursor; no full corpus gate has run.

### 2026-07-31 ordinary descent clears level-local travel state through input648

- Native `goto_level()` clears `iflags.travelcc` before saving the departing
  floor.  JavaScript's pager-preserving `ordinaryDescend()` is a parallel
  transition owner and now performs the same reset before caching the old
  level.
- Input647 opens getpos at current hero `(7,8)`, display cursor `(6,9)`,
  instead of reusing Mines-level-1 target `(66,11)`.  The focused engine-only
  witness passes **1/1** in **2.00 seconds** at **239,632,384 bytes** maximum
  RSS; the input640 control passes with it **2/2** in **2.68 seconds** at
  **273,793,024 bytes**.
- The bounded locator remains exact through input648 and first differs at
  input649's committed travel turn; no full corpus gate has run.

### 2026-07-31 partial monster pickup and ambient gnome inventory are accepted through input654

- Rock mole pickup now preserves stack identity: floor parent 450 remains at
  `(72,7)` with ten rocks while split child 451 enters monster 448's minvent
  with one rock.  Both quantities and weights match native `splitobj()`.
- Ambient gnome leader 453 now evaluates its lord-biased general armament,
  offensive tail, one-in-sixty candle gate, and common defensive and
  miscellaneous reservoirs.  The random-item selection resolvers are shared
  with level-generation births rather than represented by RNG skips.
- Input649 matches all **559** calls, screen, cursor, gnome identity/HP, and
  both rock objects.  Its focused engine-only witness passes **1/1** in
  **2.18 seconds** at **240,074,752 bytes** maximum RSS; the input640/input647
  controls pass with it **3/3** in **3.56 seconds** at **271,220,736 bytes**.
- The bounded locator remains exact through input654 and first differs at
  input655 RNG call 414; no full corpus gate has run.

### 2026-07-31 weight-gated monster landmine is accepted through input666

- Gnome 381 enters the concealed landmine at `(45,17)`.  Native rolls
  prospective `rnd(16)=4`, then `rn2(cwt+1)=rn2(651)=313`; the result is below
  `WT_ELF/2=400`, so the 650-weight gnome does not depress the mine and loses
  no HP.
- Generic `mintrap()` knowledge still commits.  The gnome ends at HP 3 with
  landmine bit 32; the mine remains type 6, unseen, and unspent.  That bit
  removes a later movement candidate, so it is not optional state.
- Input655 matches all **722** calls, screen, and cursor.  Its focused
  engine-only witness passes **1/1** in **1.02 seconds** at **238,010,368
  bytes** maximum RSS; the input649 control passes with it **2/2** in
  **1.30 seconds** at **260,521,984 bytes**.
- The bounded locator remains exact through input666 and first differs at
  input667's level transition, RNG call 4; no full corpus gate has run.

### 2026-07-31 Alley Town room program and subroom shop identity are accepted through input689

- Mines special variant 3 now dispatches the complete source-ordered
  `minetn-3.lua` room program: outer town, sixteen nested rooms, chance-gated
  shops, temple, watch, four surrounding rooms, random corridors, flip, and
  recursive room fill.
- The generated map uses C's unified encoded room-number namespace.
  `set_mimic_sym()` now resolves a shop subroom through
  `level.subrooms[index - MAXNROFROOMS]`, so the stock-room mimic consumes
  native `rn2(10)=0` instead of choosing a generic `rn2(17)` decoration.
- Input667 matches all **1,600** calls, screen, cursor, prototype, variant,
  and Lua filename.  Its focused engine-only witness passes **1/1** in
  **0.75 seconds** at **252,788,736 bytes** maximum RSS; the input649 and
  input655 controls pass with it **3/3** in **1.38 seconds** at
  **291,831,808 bytes**.
- The bounded locator remains exact through input689 and first differs at
  input690 RNG call 687.  It exits in **0.77 seconds** at **232,833,024
  bytes** maximum RSS.  No full corpus gate has run.

### 2026-07-31 unified runtime room ownership is accepted through input695

- `roomForIndex()` and `roomForRoomno()` now decode the native shared
  top-level/subroom namespace for construction, shop, temple, and command
  consumers.  A subroom number is no longer silently treated as an index
  into `level.rooms`.
- At input690, Alley Town shopkeeper ID 538 remains in own-shop room 49,
  leaves banded mail object 545 on the stock floor at `(37,14)`, and uses its
  retained second movement ration for native `distfleeck()` rolls 1 and 4.
  The former pickup and five-turn armor-dressing transaction is gone.
- Input690 matches all **824** calls, screen, and cursor.  Its focused
  engine-only witness passes **1/1** in **0.83 seconds** at **265,273,344
  bytes** maximum RSS; the input667 construction-time control passes with it
  **2/2** in **1.20 seconds** at **275,054,592 bytes**.
- The bounded locator remains exact through input695 and first differs at
  input696 RNG call 20, where native inserts `rn2(3)=1` before the next
  monster move; the first screen difference is an actor at `(27,10)`.  It
  exits in **0.71 seconds** at **234,668,032 bytes** maximum RSS.  No full
  corpus gate has run.

### 2026-07-31 nested-room town ownership and watch duty are accepted through input703

- Adding any Lua subroom marks its parent irregular before topology.  Native
  spatial membership therefore uses non-edge cells carrying the parent's room
  number rather than the outer rectangle alone; Alley Town destination
  `(25,11)` is outside town while `(26,8)` is inside.
- Peaceful watchman ID 514 now evaluates native `watch_on_duty()` after
  defensive/miscellaneous items and before weapon or movement choice.  At
  input696 the in-town, sighted watchman consumes `rn2(3)=1` without warning,
  restoring the shared RNG stream and destination.
- Input696 matches all **94** calls, screen, cursor, irregular room metadata,
  requested-cell ownership, and actor destination.  The focused witness passes
  **1/1** in **0.80 seconds** at **255,967,232 bytes** maximum RSS; the
  construction, shop-ownership, and watch controls pass together **3/3** in
  **1.45 seconds** at **300,236,800 bytes**.
- The bounded locator remains exact through input703 and first differs at
  input704 only in the retained tty query; it exits in **0.77 seconds** at
  **237,666,304 bytes** maximum RSS.  No full corpus gate has run.

### 2026-07-31 silent fountain-dip query retention is accepted through input710

- Input704's accepted fountain dip rolls fate 16 against an already cursed
  worn helm, then a nonzero dryup roll.  No replacement message is produced,
  so native leaves the accepted query physically painted while restoring the
  cursor to the map.
- `dodip()` retains that exact query only when the completed affirmative dip
  leaves both the pending and retained message slots empty.  The earlier
  seed0030 tepid-water branch still replaces and clears its query.
- Input704 matches all **97** calls, screen, cursor, curse state, and live
  fountain.  Its focused witness passes **1/1** in **0.85 seconds** at
  **257,966,080 bytes** maximum RSS; the watch, silent-retention, and
  replacement-message controls pass together **3/3** in **1.62 seconds** at
  **282,492,928 bytes**.
- The bounded locator remains exact through input710 and first differs at
  input711's fate-28 fountain transaction.  Native suspends after the bath
  line with only `rnd(30)=28`; JavaScript prematurely dries the fountain and
  completes 105 calls.  The locator exits in **0.71 seconds** at
  **233,734,144 bytes** maximum RSS.  No full corpus gate has run.

### 2026-07-31 fountain bath, gold loss, and town warning complete seed0014 through input713

- Fate 28 is one suspended `dipfountain()` transaction across three physical
  inputs.  Input711 presents the bath line and stops after `rnd(30)=28`;
  input712 removes three of 36 zorkmids, exercises Wisdom with `rn2(2)=0`,
  and takes `dryup()`'s `rn2(3)=0`; input713 acknowledges the combined
  gold-loss/watchman-yell line before the quoted warning and monster phase.
- First successful dryup in town sets `F_WARNED` rather than removing the
  fountain.  The first visible peaceful watch actor owns the warning.
  JavaScript wallet state becomes 33 while tty's untouched status rows retain
  the pre-pager display of 36 until the next top-level command.
- The focused input713 witness passes **1/1** in **0.78 seconds** at
  **260,030,464 bytes** maximum RSS.  All twelve selected fountain, watch,
  prompt-replacement, and dry-terrain witnesses pass in **2.81 seconds** at
  **340,656,128 bytes**; this includes correcting the Healer input80 state
  witness to require C's cleared terrain-flag union after a fountain dries.
- The bounded engine-only locator matches all **714** seed0014 snapshots with
  zero mismatches and exits in **0.75 seconds** at **233,652,224 bytes**
  maximum RSS.  This completes this recorded session only; no full corpus or
  hidden-session gate has run.

### 2026-07-31 seed0030 candidate session is individually exact

- After seed0014 closed, the only other session listed non-exact by the last
  42/44 full engine-only corpus was seed0030's ten-role death/restart bundle.
  A fresh bounded locator replays all ten segments through the real engine.
- All **1,953** snapshots match RNG, screen, and cursor with zero mismatches.
  The single owned process exits in **1.10 seconds** at **266,780,672 bytes**
  maximum RSS.
- This is candidate session evidence, not a replacement corpus measurement.
  The public status remains at its last measured 42/44 gate until one managed
  full engine-only corpus is explicitly run; no hidden-session gate has run.

### 2026-07-31 silent fountain fate 16 now preserves its durable curse state

- Seed0106 input110 is transcript-exact but selected four blessed holy-water
  potions for native `dipfountain()` fate 16.  Native silently clears blessed
  and sets cursed; the bounded Priest path previously replayed only RNG and
  screens, leaving the stack blessed.
- A shared `object_state.js` reducer now owns the primary curse bits and the
  JavaScript compatibility `buc` projection.  Live `dipFountain()` and the
  explicitly labeled Priest replay boundary both delegate to it.
- The state-focused input110 witness passes **1/1** in **0.31 seconds** at
  **166,739,968 bytes** maximum RSS.  The seed0014 already-cursed no-op,
  fate-28 transaction, and fate-16 state witness pass together **3/3** in
  **1.11 seconds** at **287,031,296 bytes**.
- Seed0106 remains exact across all **267** snapshots; its bounded locator
  exits in **0.23 seconds** at **125,435,904 bytes**.  This closes a durable
  public-path state gap, not the remaining unmapped fountain effects or a
  hidden-session gate.

### 2026-07-31 fountain fates 17 through 20 share the primary BUC owner

- `fountain_effects.js` now maps all four uncurse results through one reducer.
  A cursed non-hands object becomes uncursed; sighted use reports
  `The water glows for a moment.`, blind use remains silent, and ineligible
  hands or non-cursed objects report the feeling-of-loss line.
- Six direct source-contract tests cover cases16--20, coin exclusion, all four
  uncurse selectors, blind lazy liquid resolution, primary BUC state, and the
  loss branch.  They pass **6/6** in **0.07 seconds** at **47,562,752 bytes**
  maximum RSS.
- Seed0014's already-cursed query and fate-28 pager transaction, seed0106's
  bounded fate16 state witness, and seed0030's prompt-replacement path pass
  together **4/4** in **1.55 seconds** at **284,475,392 bytes** maximum RSS.
  Seed0106 remains exact across all **267** snapshots in **0.29 seconds** at
  **126,631,936 bytes**.
- This accepts primary BUC eligibility/state/message ownership only.
  Secondary native curse side effects and the actor/floor-object fountain
  cases remain mapped gaps; no corpus or hidden-session gate has run.

### 2026-07-31 fountain fates 26 and 27 use current-form ARM anatomy

- `body_parts.js` now maps the source-ordered ARM subset of
  `polyself.c:mbodypart()`.  It covers ordinary role humanoids plus all native
  ARM result families and preserves the owlbear/yeti, jellyfish/eel, and
  stalker HEAD-only ordering boundaries.
- `fountain_effects.js` owns the exact case26 tingling and case27 sudden-chill
  lines.  Case26 lazily resolves the active-form noun; case27 does not touch
  anatomy.  Live `cmd.js:dipFountain()` delegates both messages before the
  common dryup transaction.
- The direct anatomy and fountain contract passes **11/11** in **0.14
  seconds** at **52,346,880 bytes** maximum RSS.  The seed0014 silent/fate28,
  seed0106 fate16, and seed0030 prompt-replacement controls pass **4/4** in
  **1.56 seconds** at **291,553,280 bytes** maximum RSS.
- Seed0106 remains exact across all **267** snapshots in **0.27 seconds** at
  **125,681,664 bytes** maximum RSS.  These are focused and recorded-session
  witnesses, not a corpus measurement or hidden-session result.

### 2026-07-31 fountain fate 29 preserves floor-coin identity and RNG order

- The case29 reducer now guards `F_LOOTED`, uses the current dungeon's local
  remaining-level count for the amount range, and orders amount, floor
  creation, sighted liquid prose, positive Wisdom exercise, and repaint before
  common dryup.  Blind and already-looted paths skip the source-ineligible
  work.
- Shared `mkgold()` now exposes its native new-versus-merge boundary.  A new
  stack consumes `next_ident()`'s `rnd(2)` and enters the floor chain; an
  existing stack keeps its identity and consumes no allocation draw.  Both
  paths recompute the at-least-one cached coin weight after quantity changes.
- Sixteen direct anatomy/fountain/coin tests pass **16/16** in **0.19
  seconds** at **61,915,136 bytes** maximum RSS.  They include top/bottom
  amount bounds, callback order, blind/looted laziness, new-stack RNG, merge
  identity, and cached weight.
- The four recorded fountain controls pass **4/4** in **1.75 seconds** at
  **287,162,368 bytes** maximum RSS.  Seed0106 remains exact across all
  **267** snapshots in **0.32 seconds** at **126,533,632 bytes** maximum RSS.
  No corpus or hidden-session gate has run.

### 2026-07-31 fountain fate 24 shares gem discovery and looted gush owners

- `applyFountainGemDiscovery()` now owns the source-ordered gem transaction:
  exact sighted/blind prose is announced before weighted type selection and
  persistent identity creation, then placement, `F_LOOTED`, repaint, and
  positive Wisdom exercise complete before common dryup.  Drink fate27 and
  dip fate24 use this same owner.
- Dip fate24's already-looted route delegates to the existing case25
  `dogushforth(false)` owner.  Its gem selector and constructor do no work on
  the looted branch, so the fallthrough retains the gush RNG graph.
- The first live replay exposed a tty ownership error: a later plain `pline()`
  replaced the already-announced gem line.  Only successful gem branches now
  mark that source-ordered announcement for `plineWithContinuation()` when
  dryup contributes a second line; the non-gem prompt-replacement boundary is
  unchanged.
- Eighteen direct fountain/object tests pass **18/18** in **0.29 seconds** at
  **61,636,608 bytes** maximum RSS.  After the continuation correction, six
  recorded fountain controls pass **6/6** in **1.74 seconds** at
  **299,597,824 bytes** maximum RSS, including seed0030 input80's exact gem
  identity and combined topline plus seed0014's case25 gush.
- Seed0106 remains exact across all **267** snapshots in **0.24 seconds** at
  **125,403,136 bytes** maximum RSS.  No recorded public dip selects case24,
  so the direct contract and shared-owner controls are not a corpus or hidden
  session claim.

### 2026-07-31 fountain actor orchestration is mapped but not live-wired

- Injected nymph, demon, and snake reducers now preserve their native
  eligibility and callback order.  They distinguish `G_GONE` from failed
  construction, keep the snakes' `rn1(5,2)` before the gone check, emit
  sighted/blind/hallucinated prose lazily, wake a created nymph, gate the
  demon's `rnd(100)` on successful birth, and call immediate trap entry before
  proceeding to another snake.
- Nine actor tests plus the existing eighteen fountain/object/anatomy tests
  pass **27/27** in **0.33 seconds** at **61,784,064 bytes** maximum RSS.
- These reducers are not yet called by live drink/dip branches.  The blocker
  is deliberate: trap state/RNG is private to `monmove.js` while its tty
  projection is embedded in `allmain.js`; wiring a no-op or copied trap tail
  would reorder or duplicate `mintrap()`.  This is architecture evidence, not
  a public corpus or hidden-readiness claim.

- `triggerImmediateMonsterTrap()` now exposes that existing trap state/RNG
  owner without entering `postmov()` or `dochug()`.  No-trap, web mutation,
  known-web `rn2(4)` avoidance, and the visible bear-trap deferred handoff pass
  **13/13** with the actor reducer tests in **0.14 seconds** at **63,258,624
  bytes** maximum RSS.  Tty presentation and unsupported trap kinds remain
  explicit blockers before live fountain wiring.
- Web capture is the first extracted presenter: it resolves the visible actor
  subject lazily and delegates the line to the caller's tty continuation
  policy.  Its direct family passes **15/15** in **0.19 seconds** at
  **63,078,400 bytes** maximum RSS.  The intended seed0399 live control is not
  usable at present because that session already diverges earlier at input415;
  restoring the old web call-site guard leaves the same extra `rn2(5)`.
- Live dip case22 and drink case28 plus looted-case27 fallthrough now share the
  nymph reducer.  It owns `G_GONE`/failed-birth fallbacks, lazy hallucinated
  `a_monnam`, exact blind prose, waking, branch-local tty continuation, and
  immediate web entry/presentation.  Other trap kinds remain an explicitly
  labeled bypass rather than a claimed complete actor port.
- Sixteen direct actor/trap tests pass **16/16** in **0.28 seconds** at
  **63,291,392 bytes** maximum RSS.  Seed0014's live nymph, case25 gush, and
  seed0030's gem replay pass **3/3** in **0.74 seconds** at **245,563,392
  bytes**; the separate tepid prompt counterexample passes **1/1** in **0.34
  seconds** at **208,240,640 bytes**.  Seed0106 remains exact across **267**
  snapshots in **0.23 seconds** at **125,730,816 bytes** maximum RSS.
- `removeWishGrantingMonster()` now owns the pre-wish disappearance shared by
  lamp djinn and future fountain demons.  Invocation items and Rider corpses
  drop without RNG; quest artifacts pay `rn2(100)` and then drop; ordinary
  identities pay the draw and are discarded.  The actor detaches before the
  optionally preserved glyph is cleared.
- Departure plus actor direct tests pass **13/13** in **0.13 seconds** at
  **59,686,912 bytes** maximum RSS.  The uninterrupted live magic-lamp wish
  replay remains exact **1/1** in **0.30 seconds** at **130,433,024 bytes**.
- Live drink fate23 and dip case21 now share the water-demon reducer.  The
  sighted name is lazy, `rnd(100)` follows successful birth, a winning branch
  removes the actor before `makeWish()` while retaining its glyph and the
  enclosing command's move, and a losing branch uses the same explicit
  no-trap/WEB boundary as nymphs.
- The first seed0006 replay stopped earlier at input77 because JavaScript's
  pet-death owner rejected a kobold zombie's special living corpse at the
  generic `G_NOCORPSE` gate.  Moving undead conversion before that default
  rejection restores the corpse identity/timer RNG and every later bounded
  transcript check.
- Seed0006's fountain demon now passes **1/1** through input102 in **0.47
  seconds** at **139,149,312 bytes** maximum RSS.  RNG, selected screen/cursor
  snapshots, placement, the real five-dagger `minvent` stack, and
  `weaponCheck=NEED_WEAPON` are exact.  This records only the losing wish
  branch; winning, blind, gone, and web paths remain direct-contract evidence.
- A managed 90-test actor/movement sweep passed **87/90** at **74,448,896
  bytes** maximum RSS.  Its three failures are separately retained stale
  assertions for `petPostmov`, a bear-trap trailing draw, and a speed-potion
  inventory index; none exercises the changed constructor Set lookup or
  fountain transaction.  No corpus or hidden-session gate has run.
- The filtered actor/corpse/departure/trap owner set is green **20/20** at
  **64,552,960 bytes** maximum RSS.  Four nymph/gush/gem/prompt recorded
  controls pass **4/4** at **222,789,632 bytes**, and seed0106 remains exact
  across **267** snapshots at **125,173,760 bytes**.  These are focused gates,
  not a refreshed public corpus measurement.
- Live drink fate22 and dip case23 now share the source-ordered water-moccasin
  transaction.  The count draw precedes `G_GONE`; blind display consumes no
  naming RNG; hallucinated display uses the native plural grammar; and each
  successful `MM_NOMSG` birth completes supported WEB entry before the next
  construction.  Grammar plus actor/trap owners pass **18/18** at
  **63,258,624 bytes** maximum RSS.
- Seed0007 is exact through input289 across **290** snapshots, and the focused
  live witness proves six distinct water-moccasin identities and coordinates.
  The complete session's sole input291 stale-HP mismatch survives a full A/B
  restoration of the former manual fate22 body, with exact RNG and cursor.
  It is therefore retained as a separate fatal-contact/tty blocker rather than
  attributed to the snake reducer.  No corpus or hidden-session gate has run.
- The input291 blocker is now closed at its actual tty owner.  An earlier
  actor's ordinary prose does not repaint status when fatal `done_in_by()` is
  blocked behind the combined contact topline; HP four survives both the bite
  and death pagers, then clears to live HP zero at the possessions prompt.
  Seed0007's exact tail and the paired seed0030 hero-melee/no-shop/shop paths
  pass **5/5**, with the shop inheritance message retained as the concrete
  committed-HP repaint boundary.
- A bounded six-family death audit passed seed5006 bones, ordinary Healer
  gas-spore death, and seed0004 tiny-newt vision.  Its three failures are
  outside this status path: documented seed0399 input415 RNG, seed4500
  input1003 scheduling, and seed0006 input102 actor display naming.  No corpus
  or hidden-session gate has run; seed0006 input102 is the next bounded
  blocker.
- Seed0006 input102's actor-display blocker was a central metadata index drift:
  JavaScript attached the amorous demon's incubus/succubus `NAMS()` forms to
  neighboring water demon 289 instead of 290.  Moving that override restores
  native `a water demon` while preserving exact RNG, cursor, actor state, and
  every later death screen.  Direct naming passes **1/1**, both recorded
  seed0006 transition witnesses pass **2/2**, and the direct fountain actor
  family passes **11/11**.  No corpus or hidden-session gate has run;
  seed0399 input415 and seed4500 input1003 remain independent candidates for
  the next bounded earliest-divergence audit.
- Current seed0399 remeasurement first exposed an earlier screen-only AC
  regression at input109: the cloak was unworn and live AC was 10, but a
  pager-only AC-9 override survived a completed command because cleanup was
  conditional on a nonempty actor scan.  Expiring that bridge at the normal
  pre-`bot()` boundary makes input109 exact while preserving seed0014's
  suspended shield-removal pager; the paired witnesses pass **2/2**.  The
  locator is now exact through input414 and again isolates input415's one
  extra trailing JavaScript `rn2(5)` as the next bounded blocker.  No corpus
  or hidden-session gate has run.
- Seed0399 input415 is closed at native `mpickstuff()` backpressure.  A visible
  hostile pickup can page before `m_move()` returns, so web/concealment work
  and `dochug()`'s second `distfleeck()` now resume after that line rather
  than being precomputed.  The bounded input415 and direct continuation gate
  passes **2/2**, and the complete focused session is exact across **11,409
  RNG calls and 532 screens/cursors**.  Public status remains unrefreshed
  because no corpus or hidden-session gate has run; seed4500 is the next
  current earliest-divergence audit.
- Seed4500's current earliest screen regression at input621 was a lost
  caller-specific `getobj()` cancellation policy: `dodip()` must retain its
  selector physically after Escape instead of emitting `Never mind.`.  The
  focused input620--621 witness passes **1/1**, and the locator is exact
  through input795.  Input796 now forks at local call1,850 inside the already-
  mapped nesting-room/themed-level construction, expanding to 43,141
  JavaScript calls versus 3,316 native calls.  No corpus or hidden-session
  gate has run.
- Seed4500 input796 is closed at the irregular Nesting-room identity boundary.
  C's room-pointer subtraction spans ordinary rooms and subrooms in one
  encoded namespace; JavaScript must use the preserved `roomnoidx`, not
  membership in the top-level `level.rooms` array.  The focused witness is
  exact across all 3,316 RNG calls plus screen/cursor and removes the former
  43,141-call retry explosion.  No corpus or hidden-session gate has run;
  inputs798 and812 are the next bounded checkpoints.
- Seed4500's restored level-generation path advances to input1005, where the
  remaining HP-one screen was a tty ownership regression rather than damage
  or RNG.  Fatal projection now carries concrete pager dismissal history
  across a saved actor scan without treating every earlier actor message as a
  repaint.  The primary witness plus seed0007 and seed0030 shop/thin-air/no-
  shop counterexamples pass **6/6**.  No corpus or hidden-session gate has
  run; the complete bounded seed4500 locator is next.
- Seed4500 is now exact across its complete **1,814-capture** engine-only
  recording.  The bounded locator composes all **108,275** recorded RNG calls,
  screens, and cursors after the Nesting-room and fatal-status repairs.  This
  closes the public regression witness only; public corpus and hidden-session
  status remain unrefreshed until their separate managed gates run.
- The managed engine-only corpus confirms seed0014 and seed0030 newly exact,
  but the current gate is red **41/44**, not 44/44.  Seed0004 reopens only
  screens/cursor with complete RNG; seed1800 reopens RNG and screens; seed5002
  reopens screens only with complete RNG/cursors.  Cell2204 exited normally at
  459,882,496 bytes maximum RSS and left no runner.  Localize all three with
  bounded first-divergence witnesses before choosing the shared repair cone.
- Seed5002's screen-only regression is closed at C `bot()`'s raw-HP guard,
  not command shape.  `mdamageu()` leaves the fatal result raw while the
  death-line `pline()` flushes status; `bot()` suppresses all output at
  exactly `u.uhp == -1` because that value is also the save-completion
  sentinel.  The silent giant-bat and seed0030/seed0007 controls land at -1
  and retain their old row, while the later small mimic and seed4500 raven
  land at -3 and paint zero.  Nine counterexamples pass **9/9**, and the
  complete two-game seed5002 replay is exact across **12,167 RNG calls and
  410 screens/cursors**.  Seed0004 input27 and seed1800 input11 remain open;
  public status stays at the last measured **41/44** until a new managed
  corpus gate.
- Seed0004's reopened trap boundary is closed across the complete **409-
  capture** engine-only replay.  `trapeffect_bear_trap()` leaves one ordinary
  trap topline, then `set_wounded_legs()` immediately reduces carrying
  capacity and calls `encumber_msg()` before `losehp()`.  When that transition
  reaches Burdened, tty pages the pending trap line after the four wound calls
  and resumes damage on the acknowledgement input; seed0014's unchanged-load
  trap remains nonmodal.  The inverse `heal_legs()->encumber_msg()` edge now
  also advances persistent capacity state, preventing input87 from repeating
  an already acknowledged unencumbered message.  Focused controls pass **2/2**
  and the complete locator reports zero RNG, screen, or cursor mismatches.
  Seed1800 input11 is the only remaining regression from the measured **41/44**
  corpus; no new corpus gate has run yet.
- Seed1800's reopened input11 fork is closed at the thrown-projectile producer,
  not pet color or actor construction.  A Tourist dart thrown into the
  adjacent wall survives on the hero square; shared `place_object()` now links
  that split identity into the local pile and global newest-first fobj chain
  before the kitten's same-turn `dog_goal()` scan.  The focused witness gains
  exactly the missing third `obj_resists()->rn2(8)` pair, puts the kitten over
  the two-gold pile, and passes.  The complete engine-only session reports
  zero mismatches across **2,458 RNG calls and 26 screens/cursors**.  All three
  regressions from the measured **41/44** gate are now individually exact;
  composition still requires one new managed corpus and must not be inferred.
- The single managed engine-only corpus now passes **44/44** at
  **37+0.32 ms/turn** (R² 0.846), with seed0004, seed1800, and seed5002 all
  retaining complete RNG, screen, and cursor parity.  It exited normally in
  **12.85 seconds** at **268,255,232 bytes** maximum RSS and left an empty
  process registry.  This closes the public-regression gate only.  It does
  not validate held-out sessions, so priority moves from replay-specific
  repair to explicit source-contract gaps; the first mapped risk is the
  ordinary C `dothrow()` lifecycle beyond the now-correct immediately blocked
  dart branch.
- The first post-44/44 source audit proves a latent failure inside public
  seed0101.  Its eastward hand-thrown arrow survives against the adjacent wall
  under the hero.  The recorded input9 still matches because the glyph is
  occluded, but a bounded native comma continuation picks it up and merges to
  31 arrows while JavaScript reports nothing present and skips the ensuing
  scheduler.  C ownership is `splitobj -> freeinv -> throwit -> bhit ->
  place_object -> stackobj`; the current dart-only terminal sink is therefore
  too narrow.  Section760 records the full C/runtime versus Lua/terrain map
  and ranks the still-unported trajectory and contact branches.
- The blocked weapon-class terminal sink is now shared and focused-green:
  seed0101 retains exact public input9 while owning the hidden arrow, the
  native-derived comma picks it up into `d` for 31 arrows with exact screen
  and cursor, and seed1800 retains its pet/fobj result.  The original complete
  seed0101 session remains exact.  That continuation also reveals the next
  independent held-out blocker: `fastforward_ranger_step(2)` consumes a fixed
  41-call two-object transcript where native current-state `movemon()` uses 36
  calls.  Section761 maps this session-shaped scheduler boundary; no
  comma-specific RNG bridge is accepted.
- Ordinary Ranger turns now use the live current-state actor/fobj scheduler;
  only `_rangerNamePath` retains the bounded compatibility transcript.  The
  native-derived comma continuation is exact through all 36 RNG calls and the
  original seed0101 and named seed0102 sessions remain completely exact.  The
  next projectile risk is ordinary `bhit()` range traversal beyond the first
  cell, not another Ranger replay repair.
- Ordinary no-contact hand-thrown-arrow traversal is now source-shaped and
  focused-green.  A native seed0101 south-throw control proves Strength/weight
  range, the missing-bow penalty, last-open-cell `bhit()` ownership, visible
  landing, live movement scheduling, and pickup/stack merge across all 12
  captures.  Five projectile controls pass 5/5, and the complete original
  seed0101 and seed1800 locators remain exact.  This does not cover projectile
  contact or special terrain; ordinary weapon-class `thitmonst()` is the next
  held-out-oriented boundary.
- The first ordinary weapon-contact witness is red at the exact missing owner.
  Seed0101 throws west at tame Sirius: native pauses the missing-bow warning
  after `rnd(20)=5`, then the acknowledgement resumes into
  `The arrow misses Sirius.`, `tmiss()->rn2(3)=0`, the surviving arrow floor
  sink, and maintenance.  JavaScript skips contact, completes the turn during
  input9, and misreads the acknowledgement at input10.  Section762 maps the
  miss survivor path; hit, damage, and mulch remain separate successors.
- A paired native arrow hit now bounds the other d20 outcome.  Seed0111 with
  its +1 bow wielded hits adjacent Sirius: damage 5 reduces HP 8 to 3,
  `abuse_dog()` lowers tameness to 9 and produces a yelp/flee response,
  Dexterity exercise runs, and `should_mulch_missile()` consumes the arrow.
  Section763 separates this no-floor hit path from seed0101's miss/floor path;
  both must share one accuracy owner before the contact slice can close.
- The bounded ordinary arrow contact owner is accepted.  Seven projectile
  controls pass; seed0101's native miss/pager recording is fully exact, and
  seed0111's hit action matches all 23 calls plus damage, tame response, flee,
  mulch, and terminal ownership.  Original seed0101 and seed1800 remain fully
  exact.  Seed0111 retains only a separate tutorial DECgraphics screen issue
  before play.  The next contact edge is a successful non-mulched hit which
  must land the surviving arrow at `gb.bhitpos`.
- Seed0111's +2 `c` arrow supplies that non-mulched hit.  Native damage is
  d6 roll 5 plus enchantment 2, which drives a 60-turn pet flee bound; the
  mulch `rn2(4)=3` fails, floor resistance runs, and the arrow remains under
  Sirius after pet pickup rejects it.  JavaScript matches the screen, cursor,
  call count, mulch/floor, and entire later scheduler; only `rnd(5)` versus
  native `rnd(7)` diverges.  The next implementation is launched-ammo damage
  bonus, not a floor or scheduler repair.
- The enchanted launched-arrow continuation is now exact.  Seed0111's action
  matches all 30 native RNG calls and leaves Sirius at HP 1/8, tameness 9,
  abuse 1, and 59 remaining flee turns; one +2 arrow survives mulch and pet
  pickup to remain at the contact square.  Eight projectile controls pass.
  The only locator difference is the pre-play tutorial DECgraphics issue.
  Priority moves to seed0106's two-arrow volley, where tty suspends between
  per-shot effects and the current JavaScript implementation stops after one
  projectile.
- Seed0106 isolates the enclosing Ranger multishot loop.  Native completes the
  first arrow's miss and floor transfer, creates a second split identity, then
  mutates the pet through hit/damage/yelp/flee before tty pages.  The
  acknowledgement resumes at the second shot's hit message, Dexterity
  exercise, blessed mulch override, floor transfer, and only then scheduling.
  JavaScript is exact through the first arrow and diverges by scheduling where
  native calls the second `splitobj()`.  Section765 maps this continuation;
  per-shot identity and ordinal messages are the implementation boundary.
- The two-arrow continuation is accepted.  Seed0106 is exact across its ten-
  call pre-pager and 45-call resumed slices, ordinal messages, pet state,
  inventory decrement, blessed mulch override, two floor arrows, and single
  scheduler handoff.  Nine projectile controls pass, and original seed0101
  and seed1800 remain fully exact.  During extraction, seed1800 exposed that
  the blocked dart's floor resistance and fobj placement are an inseparable
  sibling terminal; both have been restored.  Priority moves to ordinary
  non-pet contact, beginning with seed0093's kobold volley.
- Seed0093 closes ordinary hostile non-pet miss/survival without code changes.
  Its first arrow fully misses and lands before shot two begins; tty then
  suspends after shot two's d20, and the acknowledgement resumes `tmiss()`,
  the second floor handoff, and scheduling.  Both action slices are exact,
  including `The 1st/2nd arrow misses the kobold.` naming.  Non-pet hit,
  anger, death, passive, and loot terminals remain separate successors.
- Seed0366 closes ordinary hostile non-pet surviving hit without code changes.
  Its second arrow reduces a lichen from HP 2 to HP 1, then the resumed hit
  line, Dexterity exercise, non-breaking mulch roll, and floor transfer are
  exact.  Sirius subsequently kills the wounded lichen in a separate
  same-turn monster transaction behind another pager; that entire suffix is
  exact too.  Direct projectile death and its loot/projectile ownership remain
  open rather than being inferred from the later scheduler kill.
- Seed0419 is the first direct arrow-death witness and is red at `hmon()`'s
  zero-HP continuation.  Native resumes the ordinal hit line, runs shared
  `xkilled()` drop/corpse/conversion/timer ownership, says `You destroy the
  kobold zombie!`, then exercises Dexterity and mulches the killing arrow.
  JavaScript is exact through damage 3 but skips death, paging, corpse, and
  mulch ownership.  The existing `finishHeroMonsterKill()` transaction is the
  required shared boundary; scheduler repair is falsified.
- Direct arrow death is accepted.  Seed0419 now matches the complete shared
  xkilled/corpse/conversion/timer transaction, destroy line, Dexterity
  exercise, killing-arrow mulch, and later floor scheduler.  Eleven projectile
  controls pass and seed0366's surviving-hit path remains exact.  The next
  object-ordering edge is a killing arrow which survives mulch beside its
  target's newly created corpse.
- The paired +2 seed0419 death closes that object-ordering edge.  Native and
  JavaScript both preserve the killing arrow after `rn2(4)=1`, place it beside
  the converted corpse and first missed arrow, and expose the combined floor
  graph to the same scheduler.  A durable test verifies one corpse and two +2
  arrow units; 12 projectile controls pass.  Peaceful non-pet anger ownership
  is the next ordinary contact boundary.
- Seed0015 supplies the first peaceful untamed projectile control through an
  explicitly synthetic debug-level transport and naturally generated shop.
  Both arrows miss Kopasker and both `tmiss()` wakeup probes are two, so native
  retains peaceful state and runs no anger transaction.  Gameplay RNG is
  already exact; JavaScript's action-only mismatch is using generic
  `shopkeeper` instead of persistent `eshk.shknam`.  This closes neither
  `setmangry()` nor hit-side anger; a zero wakeup probe or hit remains required.
- Seed0015's action mismatch is repaired and durably accepted.  Both native
  miss frames are exact with `Kopasker`, both nonzero wakeup probes retain
  peaceful/non-following state, and 13 projectile controls pass.  Five setup
  presentation differences remain deliberately separate.  Anger is still
  open because this control never enters `wakeup(TRUE)`.
- Seed0070 is the decisive peaceful anger witness.  Its first miss selects
  `tmiss()->rn2(3)=0`; native combines `Inuvik gets angry!` with the volley
  page, applies the in-shop alignment penalty without pursuit, then later uses
  a carried offensive wand.  JavaScript has exact input13 RNG but omits anger
  prose and leaves alignment at ten.  Its later melee-versus-wand divergence
  begins only after 39 exact resumed input14 calls and is tracked separately.
- Seed0070 input13 is accepted by converging arrow `tmiss()` on the shared
  in-shop shopkeeper wakeup owner.  The zero probe now produces the native
  anger page, alignment record nine, hostile/non-following state, and exact
  seven-call slice; the nonzero seed0015 control remains quiet.  Fourteen
  projectile controls pass.  Input14's iridium-wand choice is now the earliest
  independent gameplay blocker at resumed call39.
- Seed0070's independent input14 blocker is localized to an over-narrow
  JavaScript `find_offensive()` subset.  Inuvik carries an eight-charge type
  417 striking wand whose live appearance is `iridium`; displacement leaves
  its apparent target east of the resident while the real hero is south.
  Native legitimately selects the wand against that perceived line, whereas
  JavaScript incorrectly demands that the apparent target equal an adjacent
  real hero.  Candidate selection and the following three floor-object
  resistance probes remain separate acceptance slices.
- Seed0070's perceived-ray striking action is accepted.  Native and JavaScript
  now match all 52 resumed calls: the range roll, tin/food-ration/orcish-chain
  resistance probes, and later scheduler suffix.  The iridium zap page,
  cursor, apparent coordinates, charge spend and wand experience are exact;
  four direct-hero seed0030 controls and 15 projectile controls remain green.
  Fragile floor breakage, a non-hero ray target and a struck door remain
  explicit unwitnessed successors rather than part of this acceptance.
- Seed0572 is the first peaceful shopkeeper arrow-hit counterexample.  Native
  input13 stops after damage and the first-hit page; JavaScript incorrectly
  consumes exercise, mulch and shot-two RNG before suspension.  Native then
  resumes hit-side anger before the second-miss line, while JavaScript renders
  those in reverse order.  Hit math, proper naming, hostility and alignment
  are already correct; the open owner is the `hmon()` tty continuation through
  `thitmonst()` and the launched-volley loop.
- Seed0572's hit-side continuation is accepted.  The first-hit page now owns
  exactly four calls; acknowledgement resumes shared resident anger before
  Dexterity exercise, mulch and shot two.  Both action frames are native-exact,
  16 projectile controls pass, and the locator retains only four synthetic
  setup presentation differences.  `passive_obj()` after a surviving
  projectile hit is the next separate source successor.
- Seed0645 selects that passive successor naturally after synthetic transport
  to depth three.  Native is exact through a surviving second-arrow hit and
  zero mulch roll, then owns `passive_obj(AD_ACID)->rn2(6)=0`, one corrosion
  level, and `The arrow corrodes!` before floor resistance.  JavaScript skips
  the passive call and shifts the entire scheduler; the open slice is bounded
  to post-mulch object-passive dispatch.
- Seed0645's acid object passive is accepted.  The one-in-six call, corrosion
  mutation/message, floor resistance, two non-merging arrows and complete
  scheduler suffix are native-exact; 17 projectile controls pass.  Other
  erosion branches remain open.  Trap-square flight is now the earlier
  structural frontier because JavaScript's bounded path rejects traps before
  contact or landing while C `bhit()` normally traverses them.
- Seed0027 closes ordinary trap-square flight.  One launched arrow crosses the
  hidden bear trap at `(15,16)` without RNG or reveal, lands at `(15,18)`, and
  naturally enters the same-turn dog-goal scan.  Its 25-call action slice and
  floor state are native-exact; 18 projectile controls pass.  Generic trap
  rejection is falsified.  Web interception remains the earliest separate
  path branch because C `bhit()` alone gives webs a one-in-three stop probe.
- Seed0595 closes the visible unoccupied-web flight branch and the scheduler
  state edge it exposed.  A two-arrow volley pays one `rn2(3)` probe per arrow:
  two lets the first arrow continue to `(15,9)`, while zero stops the second at
  `(15,11)`, reveals the web and publishes the exact stuck line/page.  During
  the preceding turn, C `mfndpos()` also corrects the adjacent giant spider's
  displaced `mux/muy` while enumerating the real hero square even though the
  spider moves east; JavaScript had omitted that shared perception side
  effect.  The complete 32-call action, state and screen are now native-exact,
  19 projectile controls pass, and the 46-step locator retains only the known
  tutorial-window residue.  Unseen-web presentation and the remaining
  `ZAP_POS` terrain classes stay open.
- Seed0005 closes ordinary open-door traversal.  Controlled transport places
  the Ranger at `(29,18)` west of a natural `D_ISOPEN` doorway at `(30,18)`;
  both arrows cross without door-specific RNG and merge into one quantity-two
  stack at world `(37,18)`, covering the underlying gold at tty cell `(36,19)`.
  Input49's complete 37 calls, screen, cursor and floor state are native-exact,
  20 projectile controls pass, and the 50-step locator retains only the known
  tutorial-window residue.  Closed doors remain stopped by the existing guard;
  bars, pools, water/lava walls and sinks remain separate terrain successors.
- Seed0050 closes the physical-object sink stop.  From `(7,4)`, two northbound
  arrows advance onto the sink at `(7,3)`, stop before the wall beyond, survive
  resistance and merge into one quantity-two stack.  The missing stack had
  changed the same-turn dog-goal graph even though sink traversal adds no path
  RNG.  Input19's 39 calls, screen, cursor and floor state are native-exact, 21
  projectile controls pass, and the 20-step locator retains only the known
  tutorial-window residue.  Bars, water/lava walls and rock-pool skipping stay
  open as behaviorally distinct terrain branches.
- Seed0001 closes the point-blank iron-bars arrow path with a native-first
  controlled witness.  Canonical Wizard `iron bars` now reaches the missing
  `readobjnam()->wizterrainwish()` owner, clears the current rm-flag aliases and
  remains a zero-time, zero-RNG command.  After moving north, one hand-thrown
  arrow passes the wished bars without bar RNG, stops at the wall beyond and
  survives on `(53,8)`.  That identity exposed two shared scheduler gaps:
  `mfndpos()` had ignored C's species-gated `ALLOW_BARS`, and displaced
  `set_apparxy()` had used `!IS_OBSTRUCTED` instead of the narrower
  `ACCESSIBLE` terrain predicate.  The complete 38-call action and 27-state
  locator are native-exact apart from known tutorial residue; 23 bounded
  projectile/wish controls pass.  Distant bar collision/breakage, water/lava
  walls and thrown-rock pool skipping remain separate successors.
- Seed0001 also closes the nonzero distant iron-bars passage branch.  Moving
  one additional square north makes `bhit()` consume its distance-only
  `rn2(5)=2` probe before the bars; because the value is nonzero, arrow
  ammunition fits through, the wall behind stops travel and the survivor is
  placed on `(53,8)`.  JavaScript formerly rejected the bars without that
  probe, shifting every later scheduler call.  The complete 35-call action and
  28-state locator are native-exact apart from known tutorial residue, and 24
  bounded projectile/wish controls pass.  The zero-probe
  `hits_bars()->hit_bars()` collision/breakage/noise branch remains open and
  must be selected natively rather than inferred from the pass case.
- Seed0027 closes the surviving-arrow zero-probe distant-bars collision.  The
  final action consumes `rn2(5)=0`, then one collision-owned and one backed-
  landing `obj_resists(100)` call around `Clonk!` and
  `wake_nearto(bars,16)`.  `bhit()` backs the endpoint from `(30,17)` to
  `(30,16)`; the surviving arrow is published there beneath the kitten.  The
  complete 16-call action and 28-state locator are native-exact apart from
  known tutorial residue, and 25 bounded projectile/wish controls pass.
  Destructive object/bar collisions, alternate sound classes, water/lava walls
  and thrown-rock pool skipping remain independent successors.
- Seed0001 closes canonical empty-square `wall of water` construction and one
  blessed-arrow landing path.  Wizard terrain dispatch creates `WATER` with
  zero RNG/time and `A wall of water.`; after moving north, `bhit()` stops the
  arrow on that cell before bars/contact handling.  `throwit()` emits `Plop!`,
  then `water_damage()` consumes `rn2(20)=6` and blessed
  `erode_obj()` consumes `rnl(4)=1`, silently rusting the submerged survivor to
  erosion one before pet object scanning.  The complete 48-call action and
  31-state locator are native-exact apart from known tutorial residue, and 27
  bounded projectile/wish controls pass.  Wish-time floor damage/engraving,
  alternate water objects, lava walls and thrown-rock pool skipping remain
  separate successors.
- Seed0005 plus seed0001 close the adjacent-pool singular-ROCK skip decision.
  Wizard `pool` is accepted as a zero-time terrain wish, while Wizard `rock`
  retains its four ordinary constructor/cooldown calls but overrides the
  generated stack to requested quantity one.  `dothrow()` computes range seven;
  `bhit()` then owns `rnd(1)`, `rnd(3)` and the one-in-three permission roll.
  Seed0005 selects zero, emits `The rock skips.  Splash!`, backs off the closed
  door and places an uncorroded rock in the pool before its 31-call scheduler
  tail.  Seed0001 selects two, suppresses the skip line while retaining
  `Splash!`, water damage and the exact 46-call scheduler tail.  Both complete
  36-state locators retain only known tutorial residue and the expanded family
  passes 31/31.  Repeated/later skips, occupied water, stacks, monster contact,
  webs, bars, lava and shops remain open rather than inferred from this pair.
- Seed0001 closes singular-ROCK initialization and traversal on dry ROOM
  terrain.  A direct north throw pays `rnd(1)=1`, `rnd(3)=3`, `rn2(3)=2`
  despite never reaching water, crosses the room, backs from the north wall,
  survives hard-floor `obj_resists(100)` at world `(53,4)` and enters the
  ordinary scheduler.  The 13-call action and complete 21-state locator are
  exact apart from known tutorial residue; the family passes 32/32.  This
  proves skip scheduling is ROCK ownership rather than pool ownership, but
  initially blocked, corridor/door, contact and special-terrain starts remain
  separately open.
- Seed0001 also closes an initially blocked ROCK against the starting room's
  bottom wall.  `bhit()` pays the same three-call ROCK initialization before
  its first candidate, backs immediately to hero world `(53,8)`, performs the
  hard-floor resistance check and publishes the survivor beneath `@`.  The
  terminal frame had already matched, so the exact 13-call action and durable
  floor identity—not visual output alone—are the acceptance witness.  Its
  complete 21-state locator retains only tutorial residue and the family
  passes 33/33.  Closed doors, bars, trees and other blockers remain separate.
- Seed0001 closes point-blank ordinary ROCK passage through iron bars and
  corrects an important class assumption: the object named `rock` is
  GEM_CLASS, while C's `ROCK_CLASS` collision arm covers boulders/statues.
  Native pays the three ROCK skip-initialization calls, passes bars with no
  probe or prose, backs from the wall, survives one landing resistance on
  world `(53,8)` and restores the exact actor graph.  Its 40-call action and
  complete 41-state locator are exact apart from tutorial residue; the family
  passes 34/34.  Distant forced-hit passage/collision remains open.
- Seed0001 closes both distant ordinary-ROCK/bars outcomes.  After crossing
  one dry cell, `rn2(5)=4` preserves GEM_CLASS passage and a bars endpoint;
  the action is 42 calls.  A preceding singular gold wish shifts the same
  geometry to `rn2(5)=0`: collision resistance 51, `Clonk!`, radius-16 wake,
  backed floor endpoint and independent landing resistance 75 lead into a
  44-call action.  The complete 42/56-state locators retain only tutorial
  residue and the family passes 37/37.  Destructive/acid/heavy-object and
  alternate-sound collisions remain open.
- Singular wished gold retains wallet ownership but now matches native
  inventory grammar: two exact calls, one wallet coin, `$ - a gold piece.`,
  zero time.  Numeric plural quantities remain separate.
- Seed0001 closes dry multi-stack ROCK identity handoff.  `dothrow()` splits
  one child from an explicit two-rock wish, consuming `rnd(2)=2` for the new
  ID before the normal ROCK initializer; the original `g` parent remains in
  inventory at quantity one while the distinct child completes the dry flight
  to world `(53,4)`.  The exact 14-call action, 24-state locator and immediate
  native inventory display are accepted, and all eight ROCK runtime controls
  pass.  Multi-shot count commands, contact, stack-specific water/destruction,
  unpaid, timed/light and unsplit paths remain open.
- Seed0001 closes adjacent tame ROCK miss ownership.  After the three ordinary
  ROCK initialization calls, native `thitmonst()` pays `rnd(20)=13`, names
  Sirius in the miss line, and `tmiss()` pays a zero wake probe before the
  contact-square resistance and quantity-one floor publication.  Sirius stays
  full-HP, tame and peaceful above the rock.  The exact 15-call action and
  21-state locator are accepted, and all nine ROCK runtime controls pass.
  ROCK hit/damage, pet abuse/fleeing, mulch/passive/death and non-tame anger
  remain separate successors.
- Repeated singular gold wishes now preserve native merge grammar.  The first
  receipt renders `$ - a gold piece.`; later quantity-one receipts merge into
  the larger native coin stack, so non-verbose `prinv(total_of)` renders
  `$ - a gold piece` without a dot or total suffix.  Five commits, ten calls,
  wallet five and zero-time state are exact.  Plural/verbose and other money
  flows remain open.
- Five gold wishes select seed0001's adjacent surviving ROCK hit on Sirius.
  Native damage two leaves HP 3/5, reduces tameness to nine, increments abuse,
  emits yelp then hit, requests twenty flee turns, exercises Dexterity, and
  preserves the ROCK on `rn2(3)=0` before resistance/floor publication; live
  scheduling leaves durable flee timer 19.  The exact 19-call action and
  91-state locator are accepted, and all ten ROCK controls pass.  Nonzero
  mulch, death, non-tame/hostile targets and object passives remain open.
- Forty-four gold wishes select seed0001's adjacent nonzero-mulch ROCK hit.
  Native reaches the same surviving damage/pet transaction, then
  `should_mulch_missile()->rn2(3)=1` consumes the projectile and skips passive
  dispatch, landing resistance and floor publication.  The exact 18-call
  input636, complete 637-state locator and durable absence from inventory and
  Sirius's square are accepted; no production edit was needed.  Contact death,
  non-tame/hostile targets and real object passives remain open.
  The expanded bounded family passes 42/42, including eleven ROCK runtime
  controls.
- Seed0093 closes the constructor prefix needed for a displaced-hero ROCK
  death witness.  `makemonNear()` now preserves C's original `byyou` fact
  after adjacent placement, and shared birth-time `set_apparxy()` consumes
  `rn2(4),rn2(3),rn2(3)` before newt inventory initialization while retaining
  false `mux/muy`.  The focused genesis test is exact and the complete
  38-state locator now retains only tutorial residue plus final contact death;
  genesis and the intervening ROCK wish are exact.  Active owner is the
  zero-HP handoff from `thitmonst()` to shared `xkilled()`.
- The same seed0093 witness now closes that zero-HP handoff.  A lethal ROCK
  contact enters shared `finishHeroMonsterKill()` before survivor hit prose,
  consumes native rare-drop/corpse probes, removes the newt, records the
  vanquish and emits `You kill the newt!`; projectile ownership then resumes
  for exercise, zero mulch, resistance and floor landing.  The exact 17-call
  focused state, complete locator and 44/44 bounded family are accepted.
  Surviving non-pet anger, lethal tame response and real object passives remain
  open.
- Seed0049 closes the surviving hostile/non-tame ROCK sibling.  One damage
  leaves the two-HP newt alive and bypasses tame abuse/flee ownership;
  JavaScript and native then agree on hit prose, Dexterity exercise and
  nonzero mulch destruction with no landing.  The complete locator and focused
  15-call actor/object-state witness are exact apart from tutorial residue; no
  production edit was required.  Peaceful non-tame anger and zero-mulch
  hostile landing remain open.
- Seed0001 closes the peaceful non-tame ROCK-miss wake/anger edge with a black
  unicorn.  A zero `tmiss()` probe now routes through shared wake/setmangry
  ownership, including alignment state and `MS_NEIGH` growl feedback, before
  the unchanged landing tail.  The generator now retains all 383 source
  monster sound values; metadata tests, the exact 16-call focused witness and
  complete locator pass.  Hallucinated growls, peaceful bystanders and the
  peaceful surviving-hit edge remain open.
- Sixteen singular gold wishes select seed0001's peaceful non-tame surviving
  ROCK hit.  Native deals two damage to the black unicorn, publishes hit prose,
  then runs the same wake/setmangry owner before exercise, zero mulch and
  landing; the source sound table supplies the appended neigh without any RNG.
  The focused state pins hostile non-tame HP 11/13, one floor ROCK and wallet
  16, while all 18 final calls and the complete 271-state locator match apart
  from known tutorial residue.  General arrow-survivor wake, Hallucinated
  growls, peaceful bystanders and real object passives remain open.
- Nineteen singular gold wishes select seed0001's hand-thrown-arrow hit on the
  peaceful black unicorn and expose two adjacent C owners.  Ammo without its
  matching launcher now follows `hmon_hitmon_weapon_ranged()` 1d2 instead of
  launched-arrow object damage; every surviving arrow defender then enters
  general wake/setmangry after hit prose.  The exact three-call warning/prefix
  input and 14-call resumed hit/neigh tail, hostile HP 11/13 state, floor arrow,
  wallet 19 and complete 300-state locator pass apart from tutorial residue.
  Hallucinated growls, peaceful bystanders and other unlaunched ammo remain
  open.
- Seed0001's 16-gold Hallucinated ROCK witness closes the presentation/combat
  composition that ordinary sessions cannot expose.  Intrinsic activation now
  performs `make_hallucinated()`'s immediate monster/object/trap repaint before
  the pager; a wished ROCK remains `dknown=false` under `observe_object()` and
  is received as `stone`; and `bhit()` consumes one display draw when it
  initializes the temporary projectile glyph.  The hit and growl then resolve
  independent Hallucinated subjects, with `pmname()` applying its consumed
  gender bit, while `growl()` alone inserts `rn2(35)` on gameplay RNG.  The
  focused 18-call action renders `The stone hits the dwarf queen.  The titan
  rustles!`, angers the HP 11/13 survivor and destroys the ROCK on native mulch.
  The full 288-state locator is exact after known tutorial residue.  Peaceful
  bystanders and real projectile object passives remain open.
- Seed0001's two-unicorn cream-pie witness closes the first
  `peacefuls_respond()` branch and corrects a pre-existing continuation error.
  The splash remains pending while target `setmangry()` forces `--More--` with
  its neigh; acknowledgement then resumes into the newer same-species
  observer's `rn2(3)=0`, skipped growl, selected flee and 37-turn duration
  before pie blindness and scheduling.  The attacked unicorn becomes hostile
  and blind, while the observer stays peaceful but flees.  The two-call pager
  input, 16-call resumed input, focused durable-state test and full 107-state
  locator pass after tutorial residue.  Humanoid and special observers,
  growth-family pairs, invisible-observer vision and observer-growl response
  remain open.
- Lamp plus nine singular-gold wishes selects the adjacent
  `peacefuls_respond()` observer-growl arm.  Native C consumes response zero,
  growl zero, flee probe two and duration nineteen; target and observer both
  neigh on the second pager, but only the attacked target becomes hostile.
  The peaceful observer is marked fleeing before the suspended `And then
  starts to flee.` publication, and the next acknowledgement resumes pie
  blindness plus scheduling.  The focused three-input state test and complete
  224-state engine-only locator pass apart from tutorial residue with no
  production edit.  Non-identical growth-family, humanoid/special policy and
  invisible-observer vision remain open.
- Seed0001's pet-free little-dog/dog witness closes the non-identical
  `big_little_match()` edge.  Pinned C treats `little dog -> dog -> large dog`
  as one bidirectional transitive response family after checking monster
  class.  A configured-source generator now projects the active `grownups`
  table into 383 direct JavaScript targets and filters disabled preprocessor
  rows; the runtime predicate performs the bounded two-direction walk.  On
  final input 213 the dog observer adds the previously missing silent
  `rn2(3)=0`, `rn2(4)=1`, `rn2(6)=0` calls before projectile resistance, then
  remains peaceful and non-fleeing while the little-dog target becomes
  hostile.  All 19 final calls, topline, cursor and durable actor/object state
  match; the complete 214-state locator retains only two known startup
  presentation residues.  Seven metadata tests, the focused action witness
  and the established 51-test projectile family pass.  Humanoid/special
  policy and invisible-observer vision remain open.
- Seed0001's lawful two-ki-rin witness closes invisible-hero observer
  eligibility and two prerequisite UI/property boundaries.  Tty Wizard
  intrinsic menus assign page-local accelerators, so page two uses `a` for see
  invisible and `b` for invisible; the timed property publishes its pager
  before self projection changes, then acknowledgement exposes the terrain
  beneath the hero.  After three singular-gold wishes, a missed east ROCK
  wakes and angers the first ki-rin.  The second, peaceful `M1_SEE_INVIS`
  ki-rin consumes native `peacefuls_respond()` response one even though the
  hero is invisible, while a non-perceiving observer would be skipped.  The
  complete 119-state engine-only replay, focused durable-state test and
  expanded 52-test projectile family pass.  The target is hostile at HP 75/75,
  the observer remains peaceful at HP 73/73, the landed ROCK is preserved and
  timed invisibility is 29 after the committed action.  Humanoid, watch,
  shopkeeper, priest and quest-leader observer policy remains open.
- Seed0001's chaotic Grey-elf witness closes the ordinary direct-speech
  humanoid observer path.  A vault guard first exposed an unrelated earlier
  boundary—native prompts before forcing its `G_NOGEN` creation while
  JavaScript forces it immediately—so the accepted replay instead uses a
  regular alignment-peaceful Grey-elf whose genesis prefix is exact.  Four
  singular-gold wishes select a surviving east ROCK hit followed by observer
  `rn2(5)=4` and `rn2(10)=0`: no gasp and no flight.  The Grey-elf becomes
  hostile, clears wait strategy, applies the second alignment penalty and
  queues `The Grey-elf gets angry!` behind the black-unicorn neigh pager before
  exercise, mulch, landing and scheduling resume.  The complete 125-state
  engine-only replay retains only known tutorial residue; the focused test
  pins both exact RNG slices, hostile HP 6/8 target, hostile non-fleeing HP
  23/23 observer, one landed ROCK, wallet four and alignment record eight.
  The expanded projectile family passes 53/53.  Watch arrest,
  shopkeeper/priest/quest exceptions, conditional-language gasps, the
  angel/minion exception, and the independently exposed restricted-genesis
  prompt remain open.
- The zero-padding Grey-elf sibling closes ordinary direct-speech gasp plus
  low-level flight.  Native consumes observer `rn2(5)=0`, exclamation index
  two, level probe eight and duration probe thirteen, then composes `The
  Grey-elf exclaims "Oh my!" and then turns to flee.` behind the target's neigh
  pager.  Its complete 69-state replay retains only tutorial residue; the
  focused test pins exact RNG/prose, hostile full-HP target, hostile HP 23/23
  observer and scheduler-decremented flee timer 37.  The projectile family is
  now 54/54.  This acceptance supersedes the prior bullet's family count but
  does not close watch/shop/priest/quest or conditional-language policy.
- Seed0001's adjacent watchman witness closes the first `is_watch()` special
  observer branch.  Unlike guard/shop/priest restricted creation, direct
  watchman genesis is native-exact; one gold wish selects a black-unicorn miss
  whose neigh suspends after five throw calls.  The acknowledgement publishes
  `"Halt!  You're under arrest!"  The guard gets angry!` with no watch RNG,
  globally clears the peaceful watchman's attitude, then owns the 12-call
  landing/scheduler tail.  The complete 83-state engine-only replay retains
  only tutorial residue; the focused test pins hostile full-HP target, hostile
  awake/mobile HP 23/23 watchman, one floor ROCK, wallet one, alignment record
  nine/abuse one and one committed move.  The bounded projectile family is now
  55/55.  Multi-watch, sleeping, approaching, whistle and Deaf aggregates are
  source-mapped but not yet acceptance-witnessed; shop/priest/quest and
  conditional-language policy remain open.
- A four-gold two-watchman sibling proves `angry_guards()` is genuinely global
  rather than a mutation of only the observer currently being scanned.  The
  newer north watchman voices one arrest, the single aggregate says `The
  guards get angry!`, and both the older west HP 23/23 watchman and newer north
  HP 15/15 watchman become hostile before scheduling.  No second arrest,
  observer RNG, or extra alignment penalty occurs.  The complete 146-state
  engine-only replay retains only tutorial residue; its focused state/RNG test
  and the expanded 56/56 projectile family pass.  Sleeping, approaching,
  whistle and Deaf aggregate arms remain source-mapped but unaccepted.
- A native Ctrl-T sibling closes visible non-adjacent watch geometry without
  injecting actor state.  One committed controlled teleport leaves the
  watchman two cells west; zero-time genesis places the peaceful target one
  cell west.  A one-damage ROCK hit triggers `"Halt!  You're under arrest!"  An
  angry guard is approaching!--More--`; that long-line pager interrupts the
  hostile watchman's turn, and a second acknowledgement resumes 30 calls and
  ends with `The watchman wields a spear!`.  The complete 77-state locator,
  exact 5/6/30-call focused test, hostile HP 9/10 target, hostile HP 19/19
  spear-wielding watchman, destroyed ROCK and 57/57 family pass.  Sleeping,
  whistle and Deaf aggregate arms remain source-mapped but unaccepted.
- Timed Wizard blindness closes the unseen single-watch whistle and an earlier
  `make_blinded()` continuation defect.  Native first sight loss suspends on
  `A cloud of darkness falls upon you.--More--` while retaining the sighted
  actor map; acknowledgement alone commits the blind projection.  During the
  later one-gold ROCK miss, C `tmiss()` omits the unseen target noun and
  `growl()` says `It neighs!`, letting the quoted arrest fit on input 98.
  Input 99 publishes `You hear the shrill sound of a guard's whistle.` and the
  exact 12-call tail.  The complete 100-state locator, focused prerequisite
  plus policy test, hostile HP 8/8 target/watch states, floor ROCK, timeout 29
  and expanded 58/58 family pass.  Sleeping and Deaf watch aggregates remain
  open, along with Hallucinated/gear-mediated blindness messaging.
- Timed Wizard Deafness closes the watch aggregate-suppression arm and an
  earlier missing `make_deaf()` prerequisite.  Native commits the 30-turn
  timed property before suspending on `You are unable to hear
  anything.--More--`, so the status row already displays `Deaf`; the next
  acknowledgement only restores the map.  During the later one-gold visible
  ROCK miss, the black unicorn still neighs and the watchman still says
  `"Halt!  You're under arrest!"`, but `angry_guards(TRUE)` globally clears
  watch peace without angry/approaching/whistle feedback.  The complete
  100-state locator, zero/zero/five/nine-call focused test, hostile HP 8/8
  target and HP 23/23 watchman, floor ROCK, timeout 29 and expanded 59/59
  family pass.  Sleeping/wake ordering remains the open watch aggregate arm;
  alternate Deaf sources and timeout-expiry feedback remain separate.
- `sleeping watchman` genesis plus a black-unicorn target closes the earlier
  nearby-sleeper predecessor to watch aggregation.  Pinned
  `create_particular()` removes the sleeping modifier before ordinary lookup
  and sets hidden `msleeping` only after the unchanged 91-call constructor;
  the isolated 34-state replay and focused state test are exact.  On the
  two-watch four-gold attack, target `growl()` resumes after its neigh pager
  and `wake_nearto()` publishes `The watchman wakes up.` before clearing
  sleep.  That prose composes with the quoted arrest into a zero-RNG second
  pager; its acknowledgement publishes plural guard anger and the exact
  12-call tail.  The complete 156-state locator, focused actor/object state and
  expanded 60/60 family pass.  Because the area wake preempts
  `angry_guards()`' sleeping count, the generic `The guard wakes up.` arm
  remains open and needs a non-growling attacked target.
- A Grey-elf replacement target closes that remaining generic watch wake arm.
  Its direct humanoid anger path does not call `growl()`, preserving the older
  west watchman's sleeping state until the newer northeast watchman voices one
  arrest and enters `angry_guards()`.  Native then splits the transaction into
  five calls with `The Grey-elf gets angry!--More--`, zero calls with
  `"Halt!  You're under arrest!"  The guard wakes up.--More--`, and 12 calls
  with `The guards get angry!`.  The complete 95-state locator, focused
  full-HP hostile actor/floor-ROCK state and expanded 61/61 family pass.  This
  closes the selected attack-observer watch portfolio; frozen guards,
  alternate Deaf sources and non-attack callers remain separately scoped.
- `peaceful orc-captain` closes the Wizard-genesis disposition prerequisite
  needed for conditional-language observers.  Pinned `read.c` parses state
  modifiers before exactly one leading disposition and applies the peaceful
  override only after ordinary construction.  JavaScript now preserves the
  native 70-call constructor, then clears tame/pet ownership, sets peace and
  leaves the east HP 11/11 orc-captain awake and mobile.  The complete
  37-state locator retains only tutorial residue and the focused genesis test
  is exact.  Tame/hostile, quantity, gender, invisible, hidden and saddled
  modifier forms remain separately scoped.
- The first black-unicorn/peaceful-orc-captain ROCK replay closes the outer
  ordinary-humanoid response boundary for an unsupported conditional speech
  class.  C does not require non-null `maybe_gasp()` text to admit the
  observer: the MS_ORC captain still pays the outer gate, level/flee and
  hostility policy, then becomes hostile and fleeing behind the target pager.
  All 81 states match apart from tutorial residue; its exact 8/13-call focused
  test and durable hostile/fleeing state advance the bounded family to 62/62.
- One singular gold wish supplies the stronger zero-gate class-mismatch
  sibling.  Native input 93 consumes
  `rn2(5)=0, rn2(10)=7, rn2(50)=9` after the projectile prefix: because the
  MS_ORC observer and human hero symbols differ, `maybe_gasp()` returns null
  without consuming a second five-way exclamation draw, while later flight,
  hostility and the second alignment penalty still occur.  Input 94 publishes
  `The orc-captain turns to flee.` and owns the eleven-call scheduler tail.
  The complete 95-state locator, exact focused test, hostile HP 8/8 target,
  hostile fleeing HP 17/17 observer with timer 33, one floor ROCK, wallet one
  and alignment record eight/abuse two are accepted.  The bounded family now
  passes 63/63.  Same-class conditional language and special
  shop/priest/quest/angel policy remain open.
- Native `mondata.c`'s `human werejackal` alias closes the smallest
  same-symbol prerequisite without introducing hero polymorph.  Shared
  JavaScript name lookup now selects human form 262 rather than rejecting the
  disambiguator or choosing animal form 15.  The isolated 42-state locator,
  exact 61-call focused genesis test, display name and east HP 2/2
  peaceful/untamed/non-pet/awake/mobile state are accepted.  Other were-form
  aliases remain separately unwitnessed.
- Eight singular gold wishes compose that human-werejackal west of the
  black-unicorn target and close the positive conditional-language arm.
  Native attack input 196 consumes outer `rn2(5)=0`, then the distinct
  `maybe_gasp()->rn2(5)=2` because observer and hero symbols are both 53,
  followed by level and duration probes.  Acknowledgement publishes `The
  werejackal exclaims "Oh my!" and then turns to flee.`, lands the ROCK and
  only then pays independent `were_change()->rn2(50)=47`.  The complete
  198-state locator, exact 9/12-call focused test, hostile full-HP target,
  hostile form-262 HP 6/6 observer with flee timer 30, floor ROCK, wallet
  eight and alignment record eight/abuse two are accepted.  The bounded family
  now passes 64/64.  Special shop/priest/quest/angel policy remains open.
- Direct `peaceful shopkeeper` genesis closes native `cant_revive()`'s modal
  force prerequisite.  Return first publishes the zero-RNG
  `Creating human zombie instead; force shopkeeper?` query; only affirmative
  input starts the requested actor's 64-call constructor and appearance.
  JavaScript now preserves the requested/substitute pair across that tty
  continuation for Angel, shopkeeper, guard, aligned cleric and high cleric.
  The complete 37-state locator and exact focused prompt/constructor test are
  accepted.
- Composing that forced actor exposed and corrected a hidden ownership error:
  C `isshk` means resident `eshk` identity, not species form 271.  Generic
  JavaScript construction no longer assigns `isshk` or a synthetic proper
  name; natural `stockShopRoom()` assigns `isshk` with `eshk` and retains
  `eshk.shknam`.  Seed0015 quiet resident, seed0070 resident anger and seed0572
  resident hit controls remain exact.  The forced nonresident instead follows
  ordinary humanoid policy: exact input 79 consumes outer/exclamation draws
  and `rn2(10)=9`, then input 80 publishes `The shopkeeper exclaims "Oh my!"`
  without shrug/flee/fallback anger.  The complete 81-state locator and
  focused hostile HP 58/58 nonresident/floor-ROCK/alignment witness are
  accepted; the bounded family passes 65/65.  A natural resident bystander is
  still required to close the actual shopkeeper shrug branch.
- Seed0015's natural shop closes that resident branch without fabricating
  `isshk` state.  After the accepted level-three prefix, the hero is at
  (15,7), Kopasker at (16,6), and a peaceful black unicorn is created at
  (14,8).  Eighty-one singular-gold wishes select an exact seven-call ROCK
  attack: target `rn2(3)=0`, resident `rn2(5)=0`, and
  `maybe_gasp rn2(5)=2`, with no ordinary `rn2(10)` probe.  Input 1196
  suspends on the target neigh; input 1197 publishes `Kopasker exclaims "Oh
  my!" then shrugs.` before the independent `check_shop_obj -> sellobj`
  zero-value landing clause `Kopasker seems uninterested.` and an exact
  66-call scheduler tail.  The complete 1,198-state locator is exact after the
  five known seed0015 startup/arrival residues.  The focused test pins a
  peaceful, nonfleeing HP 53/53 resident with intact `eshk`, hostile HP 13/13
  target, record-nine/abuse-one alignment, empty bill, and a floor ROCK marked
  `no_charge`.  The bounded family passes 66/66.  Priest, quest-leader,
  Angel/minion and broader shop-sale policy remain open.
- Seed0361's level-17 random temple closes the cross-aligned natural-priest
  observer branch and its proper-name prerequisite.  The room is constructed
  by C's `mklev -> mktemple -> priestini` path, not Lua; scripted Lua temples
  are sibling construction frontends that converge on the same `ispriest` and
  `epri` runtime graph.  Restoring `The priest of Quetzalcoatl` at the shared
  name owner makes all 285 controlled-teleport/entry states exact.  Four gold
  wishes then select input 357's ROCK hit and `rn2(5)=0` observer gate.  Since
  the neutral hero and lawful shrine are cross-aligned, native `maybe_gasp()`
  becomes silent without an exclamation draw and immediately skips generic
  flee, anger and alignment policy.  The complete 358-state locator and named
  23-call state test pass; the target is hostile HP 27/28, the priest remains
  peaceful/nonfleeing HP 69/69 with lawful `epri`, and hero alignment remains
  record nine/abuse one.  Co-aligned priest prose/name, quest-leader and
  Angel/minion special policy remain open; generic GEM_CLASS projectile
  contact is separately exposed by the rejected touchstone selector.
- Seed0361's lawful level-18 random temple closes the co-aligned successor and
  the resident's immediate post-observer item turn.  `ALTAR` is a legal
  `ZAP_POS` first square, so the ROCK contacts the unicorn on the shrine rather
  than entering JavaScript's generic `rn2(100)` throw tail.  Native then emits
  the full `The priestess of Quetzalcoatl exclaims "Uh-oh." then shrugs.`
  pager, enters the same resident's `dochug -> find_misc -> use_misc` turn,
  and selects her uncursed purple-red POT_GAIN_LEVEL.  Two nested tty
  acknowledgements keep quaff prose ahead of identification, consumption and
  growth; the final continuation exercises Wisdom, consumes otyp 309 and
  applies `rnd(8)=1`, taking the peaceful lawful resident from level 15 HP
  69/69 to level 16 HP 70/70.  The complete 154-state engine-only locator is
  exact, the focused regression passes, and the expanded bounded family passes
  68/68.  C random-room construction owns
  this witness; Lua temple directives remain sibling construction frontends
  only.  Generic gain-level users, cursed migration, form-changing growth,
  quest-leader and Angel/minion observer policy remain separately open.
- Seed0361's original Archeologist touchstone closes the first adjacent
  non-ROCK GEM_CLASS contact without generalizing the projectile dispatcher.
  ROCK and TOUCHSTONE share sling-ammunition range, `bhit` traversal,
  `thitmonst` hit policy and `rnd(2)` damage, but only ROCK initializes
  skiprange and the magic TOUCHSTONE bypasses missile mulch without RNG.  The
  complete 344-state engine-only replay is exact at input 343's 20-call
  hit/observer/landing/scheduler slice and combined hit/neigh screen.  The
  touchstone survives on the target square, the wished-but-unselected ROCK
  remains in inventory, the target is hostile HP 27/28, and the natural
  priest remains peaceful after one scheduler move.  The named focused test
  passes 1/1, and the expanded bounded family passes 69/69.  Real gemstone
  unicorn gifts, glass, flint/loadstone and broader GEM_CLASS behavior remain
  explicitly open.
- Seed0361's wished RUBY closes the adjacent non-tame real-gem gift path and
  its two tty continuations.  C first resolves bare `ruby` by exact canonical
  real-gem name before the weighted name/description lottery, then presents
  the still-unknown type as `a red gem`.  At input 301 the black unicorn
  catches it, cross-aligned unknown-value acceptance spends `rn2(3)=2`, raises
  Luck to one and transfers the ruby into `minvent`.  Input 302 exposes
  hesitant acceptance while `rloc()` consumes six coordinate pairs and moves
  the target from (33,5) to (5,15); its old glyph remains deliberately stale
  below that pager.  Input 303 exposes `The black unicorn vanishes!` and
  resumes an exact 15-call scheduler tail.  The complete 305-state locator is
  exact, the focused regression passes 1/1, and the expanded managed family
  passes 70/70.  Tame, helpless, known/named, co-aligned, glass, slung,
  restricted and visible-relocation variants remain open.
- The neutral gray-unicorn sibling closes the co-aligned unknown-value arm and
  its earlier glyph prerequisite.  Native tty projects source CLR_GRAY through
  NO_COLOR; removing JavaScript's legacy brown override makes every state
  before the gift exact.  Input 300 then catches the red gem with zero RNG,
  input 301 says `gratefully accepts your gift.` and accepts relocation pair
  `(68,11)`, and input 302 exposes vanish plus a distinct exact 15-call
  scheduler tail.  All 304 states are exact.  The full-HP peaceful gray
  unicorn carries RUBY at (68,11), hero Luck is one, and the lawful priest
  ends at (36,5).  The named focused test passes 1/1.  Tame, helpless,
  known/named, glass, slung, restricted and visible-relocation variants remain
  open; the expanded managed family passes 71/71.
- The tame black-unicorn sibling closes the source-earlier disposition,
  display and catch/drop fork without entering `gem_accept()`.  Native
  `create_particular_parse()` accepts the leading `tame ` modifier, ordinary
  `makemon()` retains its exact 51-call slice, and `tamedog -> newedog ->
  initedog` creates a non-domestic tame-5 actor with `edog` and pet conduct.
  Species color remains native black/tty color 8; pet state is a separate
  highlight attribute rather than a white foreground override.  Throw input
  297 then prints `The black unicorn catches and drops the red gem.`, spends
  only ordinary `rn2(100)=31` breaktest before the exact 15-call scheduler
  tail, and leaves RUBY on floor square (33,5).  The full-HP unicorn remains
  tame and stationary with empty inventory; Luck, alignment record ten and
  wallet zero are unchanged, while the lawful priest ends at (35,5).  All 301
  states and the focused regression are exact.  Helpless, known/named, glass,
  slung, restricted and visible-relocation variants remain open; the expanded
  managed family passes 72/72.
- The sleeping black-unicorn sibling closes `thitmonst()`'s even earlier
  `helpless()` arm.  The source-supported `sleeping ` modifier retains the
  ordinary 51-call constructor and marks the actor asleep only after creation.
  Input 301 then publishes `The red gem misses the black unicorn.` through
  `tmiss(obj, mon, FALSE)`, consumes no wake probe, spends ordinary
  `rn2(100)=31` breaktest and rejoins the same 15-call resident/global tail.
  All 305 states are exact.  The full-HP hostile unicorn remains asleep,
  untame, non-pet and empty-handed at (33,5); RUBY survives on that floor
  square; Luck, record-ten alignment, wallet and original-pet-only conduct are
  unchanged; and the lawful priest ends at (35,5).  The focused test passes
  1/1.  Known/named, glass, slung, teleport-restricted and visible-relocation
  variants remain open; the expanded managed family passes 73/73.
- The unknown worthless-red-glass sibling closes the non-MINERAL admission and
  bottom-right `gem_accept()` knowledge/material arm.  The exact wish phrase
  still pays `rnd_otyp_by_namedesc()->rn2(78)=6` before constructing otyp 463
  as an appearance-known, type-unknown `red gem`.  Input 325 catches with zero
  RNG; input 326 says `graciously accepts your gift.` with no Luck draw,
  transfers the glass to `minvent`, and consumes the six accepted relocation
  pairs; input 327 exposes vanish plus the exact 15-call scheduler tail.  All
  329 states and the focused test are exact.  The peaceful full-HP black
  unicorn carries the glass at (5,15), hero Luck remains zero, the old square
  and hero inventory contain no glass, and the lawful priest ends at (35,5).
  Known and named/called value tiers, known-glass rejection, slung,
  teleport-restricted and visible-relocation variants remain open; the
  expanded managed family passes 74/74.
- Individually naming that same appearance-known/type-unknown otyp-463 glass
  `junk` closes the guessed-GLASS rejection row.  Native `name_ok()` downplays
  the artifact letter in the `#name` suggestion without forbidding direct
  selection, and projectile `xname()` preserves `red gem named junk` in the
  catch line.  Input 339 then says the unicorn is not interested in the junk
  while consuming the same six relocation pairs; input 340 spends
  `rn2(100)=46` for rejected-object landing before the exact shifted 15-call
  scheduler tail.  All 344 states and the focused regression are exact.  The
  unicorn ends empty-handed at (5,15), named glass survives on floor (33,5),
  Luck remains zero and the priest remains at (35,5).  Properly type-known
  glass, called-type naming, slung, teleport-restricted and visible-relocation
  variants remain open; the bounded family passes 75/75.
- `#wizidentify`, selecting only letter `l`, closes the properly type-known
  GLASS row through a real command path.  Native override-ID groups the four
  partially known items and temporarily formats them as fully identified;
  commit permanently identifies only the selected glass, prints `l - an
  uncursed worthless piece of red glass.`, and spends
  `exercise(A_WIS,TRUE)->rn2(19)=6`.  Catch uses the canonical glass name,
  rejection consumes relocation pairs `(22,12)` then `(68,11)`, and the next
  acknowledgement spends `rn2(100)=45` before the exact shifted 15-call tail.
  All 346 states and the focused regression are exact.  The empty-handed
  unicorn ends at (68,11); all five identity flags persist on floor glass at
  (33,5), Luck stays zero and the priest stays at (35,5).  Called-type naming,
  slung, teleport-restricted and visible-relocation variants remain open; the
  bounded family passes 76/76.
- `#name -> o`, direct selection of `l`, and type call-name `junk` close the
  global `oc_uname` analogue independently from object-local `oname`.  Native
  prompts `[kl]` then `Call a red gem:` with zero RNG; catch deliberately says
  `the gem called junk`, not `red gem named junk`.  The global name selects the
  same guessed-GLASS rejection, six relocation pairs and `rn2(100)=46` shifted
  scheduler tail as individual naming.  All 344 states and the focused
  regression are exact.  Durable state keeps call-name `junk`, type knowledge
  false and no floor-object `oname`; the glass is at (33,5), the empty-handed
  unicorn at (5,15), Luck zero and priest at (35,5).  Slung, teleport-
  restricted and visible-relocation variants remain open; the bounded family
  passes 77/77.
- The real `Wiz-strt.lua` no-teleport sibling closes gift transport's
  restriction branch without synthesizing a JavaScript flag.  The accepted
  seed0360 public prefix stays exact before creating an adjacent peaceful
  black unicorn and wishing a ruby.  Input 427 catches it with `rn2(3)=0`;
  input 428 spends zero RNG and retains hesitating acceptance behind
  `--More--`; input 429 prints the mysterious-force line and owns only the
  exact 32-call scheduler tail.  No `rloc()` coordinate draw occurs.  All 430
  states and the focused regression are exact.  Durable state keeps
  `noteleport=true`, hero (9,1) at Luck -1, and the full-HP peaceful unicorn
  stationary at (10,1) with the ruby in `minvent`; hero inventory and floor
  contain none.  Visible permitted relocation and slung attack remain open;
  the bounded family passes 78/78.
- The random visible-relocation sibling uses the canonical seed0360 prefix to
  enter `bigrm-4.lua`, not Wizard monster-teleport control.  Input 348 rejects
  random candidate `(74,2)`, accepts `(21,11)`, retains the hesitating gift
  line behind `--More--`, and already projects the relocated black unicorn at
  screen (20,12).  Input 349 spends zero RNG and says it `vanishes and
  reappears farther away.`  This closes `rloc_to_core()`'s visible `telemsg`
  arm and proves both `newsym()` calls precede the suspending message.  All 350
  states, the focused regression and the eight-case transport sibling gate are
  exact.  Durable state keeps hero (31,15) at Luck +1 and the full-HP peaceful
  unicorn at (21,11) carrying the ruby; hero inventory and floor contain none.
  Slung GEM_CLASS attack remains open; the bounded family passes 79/79.
- The selected sling-launched real-gem miss closes the wielded-launcher fork
  before gift policy.  A clean seed0001 Ranger setup wishes letter-`g` sling,
  wields it, creates a peaceful black unicorn west of the hero, and wishes
  letter-`h` ruby.  Native input 70 suggests only GEM_CLASS `[h]`; input 72
  consumes `rnd(20)=4`, `rn2(3)=2`, `rn2(100)=23`, and the exact 20-call
  actor/global tail, then prints `The red gem misses the black unicorn.`  No
  catch, Luck, `mpickobj()` or relocation branch occurs.  The full-health
  peaceful unicorn stays at (51,9), the ruby survives beneath it, and the
  sling remains wielded.  JavaScript now shares the wielded-sling predicate
  across throw suggestions, matching-launcher range/accuracy, gift exclusion,
  canonical gem naming and floor settlement.  The focused test and 11-case
  sibling gate pass; the 76-state replay is exact from input 3 onward, with
  only the pre-existing input-2 tutorial glyph outside this slice.  A slung
  real-gem hit and hard-gem mulch/survival remain open; the bounded family
  passes 80/80.
- The selected sling-launched real-gem hit closes object-damage, skill and
  hard-gem destruction ownership without weakening the earlier miss.  A clean
  seed0001 Ranger witness wishes an unidentified `+3 sling`, creates the same
  peaceful black unicorn west of the hero and launches RUBY.  Native input 75
  consumes `rnd(20)=4`, RUBY `rnd(3)=3`, the exact exercise/wake tail,
  ordinary mulch `rn2(3)=2`, hard-gem `rn2(2)=1`, and the exact remaining
  actor/global tail.  The restricted sling adjustment reduces three damage to
  one, records one P_SLING practice unit, angers the 14/15-HP target, and the
  surviving break decision destroys the ruby.  The 79-state replay is exact
  from input 3 onward; its only mismatch is the pre-existing tutorial glyph.
  The focused hit test passes 1/1 and the expanded sling/gift/mineral sibling
  matrix passes 12/12.  A hard-gem zero result that clears breakage and settles
  the ruby on the floor remains open; the expanded managed family passes
  81/81.
- Seed30 closes the complementary hard-gem zero/surviving-floor join with the
  identical Ranger +3-sling/RUBY recipe.  Native input 75 consumes
  `rnd(20)=1`, RUBY `rnd(3)=3`, exercise `rn2(19)=0`, ordinary mulch
  `rn2(3)=2`, hard-gem `rn2(2)=0`, then the survivor's
  `obj_resists()->rn2(100)=38` and the exact 14-call actor/global tail.  The
  zero clears ordinary breakage; JavaScript retains exactly one floor RUBY at
  `(28,16)` under the hostile 10/11-HP unicorn and records one P_SLING practice
  unit.  The full 79-state native replay is exact from input 3 onward with only
  the known tutorial glyph outside the slice.  The focused test passes 1/1 and
  the expanded sling/gift/mineral sibling matrix passes 13/13.  Passives and
  non-RUBY tough-gem metadata remain open; the expanded managed family passes
  82/82.
- DIAMOND closes the first non-RUBY `oc_tough` dispatch and replaces the
  accidental RUBY identity check with the source's eight-entry
  Mohs-eight-plus real-gem metadata set.  With the seed1 +3-sling setup, native
  input 78 matches through `rnd(20)=4`, object `rnd(3)=3`, exercise
  `rn2(19)=12` and ordinary mulch `rn2(3)=2`, then requires hard-gem
  `rn2(2)=1` before the exact remaining actor/global tail.  The nonzero result
  retains destruction; no carried or floor diamond survives, the 14/15-HP
  unicorn is hostile and one P_SLING practice unit persists.  The full
  82-state native replay is exact from input 3 onward, the focused test passes
  1/1, and the expanded gift/mineral/sling sibling matrix passes 14/14.  A
  lower-Mohs real-gem negative control and FLINT's explicit special case remain
  open; the expanded managed family passes 83/83.
- DILITHIUM CRYSTAL closes the negative side of the `oc_tough` threshold with
  the same seed1 +3-sling carrier.  Despite being a real GEM_CLASS gemstone
  worth more than RUBY, its Mohs-five metadata makes native input 88 omit the
  hard `rn2(2)`: it consumes `rnd(20)=4`, object `rnd(3)=3`, exercise
  `rn2(19)=12`, ordinary mulch `rn2(3)=2`, then immediately enters the exact
  19-call actor/global tail.  Ordinary mulch destroys the object; the hostile
  unicorn remains 14/15 HP and one P_SLING practice unit persists.  The full
  92-state native replay is exact from input 3 onward, the focused negative
  test passes 1/1, and the expanded adjacent matrix passes 15/15.  FLINT's
  separate explicit hard condition remains open; the expanded managed family
  passes 84/84.
- Seed18 FLINT closes native's explicit identity exception outside
  `oc_tough`.  The initial seed1 carrier was correctly rejected because its
  wish shifted contact to a miss; the selected seed18 carrier reaches input 76
  with `rnd(20)=3`, FLINT `rnd(6)=4`, exercise `rn2(19)=5`, ordinary mulch
  `rn2(3)=2`, then the required explicit hard draw `rn2(2)=1`.  That call
  determines an exact 26-call actor/sound tail and a `--More--` boundary;
  acknowledgement input 77 consumes `rn2(20)=1`, `rn2(73)=26` and prints the
  bubbling-water line.  The flint is destroyed, the target is hostile at
  12/14 HP, and one P_SLING practice unit persists.  The full 80-state native
  replay is exact from input 3 onward, the focused two-input test passes 1/1,
  and the adjacent matrix passes 16/16.  The expanded managed family passes
  85/85.
- Seed110 closes the next cross-owner edge from hard-gem survival into
  `passive_obj(AD_FIRE)`.  A bounded selector found the only clean seed through
  128 where a +3-sling RUBY hits a peaceful fire elemental and survives both
  mulch decisions.  Native input 76 consumes `rnd(20)=3`, RUBY `rnd(3)=3`,
  exercise `rn2(19)=5`, ordinary `rn2(3)=2`, hard survival `rn2(2)=0`, then
  fire-passive `rn2(6)=4` before `obj_resists()->rn2(100)=13` and the exact
  26-call tail.  The nonzero probe does not erode the non-burnable gem; one
  unmodified floor RUBY remains at `(73,18)` under the hostile 28/29-HP fire
  elemental, with one P_SLING practice unit.  The complete 80-state native
  replay is exact from input 3 onward, the focused test passes 1/1, and the
  compact AD_ACID-plus-sling matrix passes 8/8.  Zero fire erosion and the
  rust/corrosion/enchantment passive types remain open; the expanded managed
  family passes 86/86.
- Seed154 closes the deterministic primary-rust arm of projectile
  `passive_obj()`.  The first wished-arrow seed8 candidate was rejected after
  native exposed two earlier setup owners: the randomly cursed singleton pays
  `throwit()->rn2(7)` while JS's old setup performed a Ranger volley draw which
  C only performs for quantity greater than one.  The replacement uses the
  ordinary startup Ranger arrow stack, equips its matching bow, and creates a
  peaceful rust monster.  Input42 is exact through `rnd(2)=1` multishot,
  `rnd(2)=2` split, hit, damage, exercise and `rn2(3)=0` non-mulch; native then
  consumes no passive RNG, increments primary `oeroded`, appends `The arrow
  rusts!`, pays `obj_resists()->rn2(100)=35`, and finishes the exact 34-call
  slice behind `--More--`.  Input43 resumes the exact seven-call scheduler
  tail.  The single floor arrow at `(5,10)` has rust level one, while the
  hostile 23/25-HP target moves to `(6,11)`.  The complete 47-state replay is
  exact from input3 onward with only the known tutorial glyph outside the
  slice; the focused test passes 1/1 and the AD_ACID/AD_FIRE/AD_RUST matrix
  passes 3/3.  Rust cancellation, grease/blessing/proof branches, general
  AD_CORR and AD_ENCH remain open; the last wider managed family is 86/86
  pending this row's expansion.
- Managed reconciliation for seed154 passes **87/87** under the established
  case-sensitive engine-only projectile/priest/wish selector.  The single
  owned process exits synchronously in 2.32 seconds at 333,479,936 bytes
  maximum RSS, with empty matching registries before and after.  This accepts
  the ordinary AD_RUST arrow row without changing the still-open cancellation,
  grease/blessing/proof, AD_CORR, AD_ENCH or zero-result AD_FIRE boundaries.
- Seed137 closes deterministic general corrosion through black pudding mnum
  209's `AT_NONE,AD_CORR` passive.  The selected startup Ranger carrier owns a
  legitimate one-shot `rnd(2)=1`, split `rnd(2)=2`, five-damage hit, exercise
  and `rn2(3)=0` non-mulch.  Native then consumes no passive RNG, increments
  secondary `oeroded2`, appends `The arrow corrodes!`, pays
  `obj_resists()->rn2(100)=51`, and completes the exact 30-call input43 slice.
  The hostile uncancelled pudding remains at `(44,9)`, 56/61 HP with the plain
  quantity-one corroded arrow beneath it.  The complete 47-state replay is
  exact from input3 onward with only the known tutorial glyph outside the
  slice; focused passes 1/1 and the AD_ACID/AD_FIRE/AD_RUST/AD_CORR matrix
  passes 4/4.  AD_ENCH, cancellation, grease/blessing/proof and zero-result
  AD_FIRE remain open; the last wider managed family is 87/87 pending this
  row's expansion.
- Managed reconciliation for seed137 passes **88/88** under the established
  case-sensitive engine-only selector.  The one owned process exits
  synchronously in 2.73 seconds at 333,807,616 bytes maximum RSS with empty
  matching registries before and after.  This accepts deterministic plain-arrow
  AD_CORR while leaving AD_ENCH and the passive control siblings open.
- Seed2 closes the ordinary positive-enchantment arm of projectile
  `passive_obj(AD_ENCH)`.  The source-aligned setup raises the Ranger to level
  30 before genesis so `thitmonst()` can legitimately overcome disenchanter
  AC; it does not bypass flight, contact, damage or mulch.  Native input98 is
  exact through hit, one damage, exercise and `rn2(4)=3` survival, then
  `drain_item()->obj_resists(10,90)` consumes `rn2(100)=53`, fails to resist
  and changes the detached startup arrow from +2 to +1.  Floor handling then
  consumes `rn2(100)=13` before the exact scheduler tail.  The false
  `carried(obj)` branch is silent.  The hostile uncancelled target remains at
  `(49,16)` with 70/73 HP and the quantity-one +1 arrow beneath it.  The full
  100-state replay is exact from input3 onward with only the known tutorial
  glyph outside this slice; focused passes 1/1 and the
  AD_ACID/AD_FIRE/AD_RUST/AD_CORR/AD_ENCH matrix passes 5/5.  AD_ENCH
  resistance/non-positive/cancellation and the broader passive control
  siblings remain open; the last wider managed family is 88/88 pending this
  row's expansion.
- Managed reconciliation for seed2 passes **89/89** under the established
  fixture-disabled case-sensitive selector.  The one owned process exits
  synchronously in 2.81 seconds at 340,770,816 bytes maximum RSS with empty
  matching registries before and after.  This accepts ordinary positive-arrow
  AD_ENCH failed resistance while leaving its resistance, non-positive and
  cancellation controls plus the other passive siblings open.
- Seed40 closes the below-10 ordinary-object resistance sibling of projectile
  AD_ENCH.  The same level-30 Ranger setup produces one eastward +2 arrow hit;
  input98 is exact through `rn2(4)=1` mulch survival, then
  `drain_item()->obj_resists(10,90)` receives `rn2(100)=6` and retains +2.
  Floor handling independently receives `rn2(100)=19` before the exact
  scheduler tail.  The hostile uncancelled disenchanter remains at `(77,11)`
  with 62/68 HP and exactly one quantity-one +2 arrow beneath it.  The full
  100-state native replay is exact from input3 onward with only the known
  tutorial glyph outside this slice; the paired threshold gate passes 2/2 and
  the six-row passive matrix passes 6/6.  Non-positive/cancellation, artifact
  resistance and other passive control siblings remain open; the last wider
  managed family is 89/89 pending this row's expansion.
- Managed reconciliation for seed40 passes **90/90** under the established
  fixture-disabled case-sensitive selector.  The one owned process exits
  synchronously in 2.76 seconds at 340,033,536 bytes maximum RSS with empty
  matching registries before and after.  This accepts both sides of ordinary
  AD_ENCH resistance and moves priority to the still-missing successful
  AD_FIRE burn mutation.
- Seed78 closes the successful wooden-projectile arm of
  `passive_obj(AD_FIRE)` and the signed bow-ammunition classifier needed to
  reach it.  The reconstructed native recipe wishes two +2 elven arrows,
  creates a peaceful fire elemental, and launches south with the startup bow.
  Input71 owns the exact 21-call slice `rnd(2)=1, rnd(2)=2, rnd(20)=1,
  rnd(6)=6, rn2(19)=12, rn2(4)=1, rn2(6)=0, rn2(100)=45` before its exact
  actor/global tail, and publishes `The elven arrow hits the fire elemental!
  The elven arrow smoulders!` at cursor `(4,4)`.  The complete 74-state replay
  is exact from input3 onward with only the known tutorial glyph outside the
  slice.  Durable state retains the hostile 25/33-HP elemental at `(5,4)`, one
  unburned +2 inventory arrow, and one quantity-one +2 floor arrow with
  primary erosion one.  Focused passes 1/1, the AD_ACID/AD_FIRE/AD_RUST/
  AD_CORR/AD_ENCH control matrix passes 7/7, and the managed family passes
  91/91 in 2.42 seconds at 337,854,464 bytes maximum RSS with empty process
  registries.  Cancellation, steam-vortex, blessed/proof, already-complete
  burn and other flammable-material controls remain open; grease is not an
  AD_FIRE control because native uses `EF_NONE`.
- The paired seed78 fireproof carrier closes `readobjnam()` proof grammar and
  `erode_obj()`'s visible detached-object protection boundary.  Before repair,
  JavaScript first rejected `2 fireproof +2 elven arrows` at input42 and
  omitted all 12 native construction calls.  Generic proof-qualifier parsing
  now sets `oerodeproof` only for source damageable erosion-bearing objects
  (plus CRYSKNIFE), making the setup exact without an elven-arrow spelling
  bridge.  Native input81 then owns the seven-call hit/probe prefix and stops
  at `The elven arrow hits the fire elemental!--More--`; input82 says
  `Somehow, the elven arrow is not affected by the heat.` before its exact
  14-call floor/scheduler tail.  The complete 84-state replay is exact from
  input3 onward.  The fired floor +2 arrow is proof-known and unburned; its
  untouched +2 inventory sibling is proof-unknown and unburned.  Both seed78
  controls pass 2/2, the passive matrix passes 8/8, and the managed family
  passes 92/92 in 2.40 seconds at 316,784,640 bytes maximum RSS with empty
  process registries.  Blessed protection, cancellation, steam vortex,
  complete burn and alternate flammable classes remain open.
- Seed123 closes AD_FIRE's silent blessed-protection sibling and distinguishes
  its two `rnl(4)` owners.  A bounded 1..1024 selector found five candidates by
  seed172; seed123 is the clean one-shot carrier.  Native input79 consumes
  `rnd(2)=1, rnd(2)=1, rnd(20)=7, rnd(6)=5, rn2(19)=10, rn2(4)=3,
  rnl(4)=3, rn2(6)=0, rnl(4)=0, rn2(100)=93` before its exact 34-call
  actor/global tail.  The first `rnl(4)` fails blessed mulch protection; the
  second succeeds inside `erode_obj()`.  Because AD_FIRE uses `EF_NONE`, no
  protection prose or proof learning occurs: input79 remains only `The elven
  arrow hits the fire elemental!`.  All 82 states are exact from input3
  onward.  The hostile 30/37-HP target remains at `(35,18)` with one blessed,
  non-proof, proof-unknown, unburned floor +2 arrow and its inventory sibling.
  Three fire controls pass 3/3, the passive matrix passes 9/9, and the managed
  family passes 93/93 in 2.43 seconds at 327,024,640 bytes maximum RSS with
  empty registries.  Cancellation, steam vortex, complete burn and alternate
  flammable classes remain open.
- The proposed steam-vortex projectile control is rejected by source call-site
  analysis.  `thitmonst()` passes `mattk=NULL`, so `passive_obj()` selects the
  first `AT_NONE`; steam vortex exposes AD_FIRE only on `AT_ENGL` and therefore
  selects AD_PHYS here.  Its explicit exclusion remains relevant to callers
  which pass the engulf attack pointer, not projectile contact.
- Generic erosion wish grammar now admits primary rusty/rusted/burnt/burned/
  cracked and secondary corroded/rotted modifiers, including `very` and
  `thoroughly`, applies them only to compatible erosion-bearing objects, and
  preserves source erosion adjectives in wish receipts.  Fresh seed78 `burnt`
  and `thoroughly burnt` native sessions are exact from input3 onward; both
  damaged arrows mulch before AD_FIRE and are grammar/mulch controls only.
  A corrected pager-aware selector then found five actual further-burn
  carriers by seed102.  Seed69 is clean: input77 owns hit, `rn2(2)=0` mulch
  survival and `rn2(6)=0`, then stops behind `--More--`; input78 says `The
  elven arrow smoulders further!`, spends floor `rn2(100)=94`, and completes
  the exact 35-call tail.  All 80 states are exact from input3 onward.  The
  fired +2 arrow reaches burn level two at `(60,4)` beneath the hostile
  31/35-HP elemental; its inventory sibling stays at level one.  Four fire
  controls pass 4/4, the passive matrix passes 10/10, and the managed family
  passes 94/94 in 2.42 seconds at 337,707,008 bytes maximum RSS with empty
  registries.  Complete-burn survival, cancellation and alternate flammable
  classes remain open.
- Seed69's paired thoroughly-burnt recipe closes `erode_obj()` at
  `MAX_ERODE` without changing the clean further-burn geometry.  A bounded
  selector found five survivor/zero-probe carriers by seed83; seed69 input88
  consumes `rnd(2)=1, rnd(2)=1, rnd(20)=6, rnd(6)=2, rn2(19)=5,
  rn2(4)=0, rn2(6)=0, rn2(100)=94` before the exact 34-call actor/global
  tail.  AD_FIRE has neither `EF_VERBOSE` nor `EF_DESTROY`, so the already
  thoroughly burnt arrow produces no erosion message, is not deleted and
  remains at level three.  All 91 states are exact from input3 onward; the
  fired +2 arrow lies at `(60,4)` beneath the hostile 31/35-HP target and its
  inventory sibling is also unchanged at level three.  Five fire controls
  pass 5/5, the passive matrix passes 11/11, and the managed family passes
  95/95 in 2.39 seconds at 328,712,192 bytes maximum RSS with empty process
  registries.  Cancellation and alternate flammable classes remain open.
- Generic `greased` wish state exposed an earlier `throwit()` gate before the
  planned AD_RUST control.  The initial JS selector omitted the mandatory
  `(cursed||greased) && direction` `rn2(7)`, so native seed22/26 inserted the
  call and missed with different later dice.  JavaScript now applies the gate
  after split and before path setup; both 83-state native sessions are exact
  from input3 onward and remain pre-flight miss controls, not passive evidence.
  Reselection found three retained and three worn candidates by seed99.
  Seed5 is the admitted retained carrier: input80 owns `rnd(2)=1, rnd(2)=1,
  rn2(7)=4, rnd(20)=1, rnd(6)=4, rn2(19)=12, rn2(4)=3,
  rn2(2)=1, rn2(100)=99` before its exact actor tail.  No rust or grease wear
  occurs; one greased +2 floor arrow remains beneath the hostile 6/12-HP
  target at `(37,3)`, and its inventory sibling remains greased.  All 83
  native states are exact from input3 onward.  Focused passes 1/1, the passive
  matrix passes 12/12, and the managed family passes 96/96 in 2.44 seconds at
  333,053,952 bytes maximum RSS with empty registries.  The seed49 zero-wear
  prefix is exact through `rn2(2)=0` and floor resistance but its later actor
  tail diverges; seed82/99 fail startup.  Grease wear and zero pre-flight
  misfire remain open and are not accepted from these partial witnesses.
- The earlier grease-wear gap is superseded by admitted seed150.  Extending
  the corrected selector through seed206 exposed nine additional zero
  candidates; seed150 has one shot and a 19-call action.  Native input80 owns
  `rnd(2)=1, rnd(2)=2, rn2(7)=4, rnd(20)=4, rnd(6)=6,
  rn2(19)=1, rn2(4)=3, rn2(2)=0, rn2(100)=97` before the exact ten-call
  actor tail.  The pre-flight gate proceeds, mulch preserves the projectile,
  and grease wear clears only the detached identity without rust or prose.
  All 83 states are exact from input3 onward; the ungreased, unrusted floor +2
  arrow remains under the hostile 5/13-HP rust monster at `(49,13)`, while its
  inventory sibling remains greased.  Paired grease outcomes pass 2/2, the
  passive matrix passes 13/13, and the managed family passes 97/97 in 2.48
  seconds at 341,393,408 bytes maximum RSS with empty registries.  The
  pre-flight zero/misfire branch remains open; seed49 is retained only as a
  historical partial localization.
- Seed7 closes the zero pre-flight greased-ammunition branch.  Its two-shot
  input80 owns the first shot through miss/landing, then the second split and
  `rn2(7)=0` before tty suspends on `You shoot 2 arrows.  The 1st arrow misses
  the rust monster.--More--`.  Input81 publishes `The arrow misfires!`, uses
  `rn2(3)=0,0` to reroute south to northwest, pays floor `rn2(100)=92`, and
  completes the exact scheduler tail.  All 83 states are exact from input3
  onward.  One greased +2 arrow remains under the hostile full-HP target at
  `(77,17)` and the misfired identity at `(76,15)`; inventory retains none.
  Three grease/preflight controls pass 3/3, the adjacent matrix passes 14/14,
  and the managed family passes 98/98 in 2.48 seconds at 327,303,168 bytes
  maximum RSS with empty registries.  Vertical reroute, non-ammo slip and
  cursed-only misfire remain open.
- Seed22 closes actual rustproof protection and per-identity proof learning.
  Native input82 consumes `rnd(2)=1, rnd(2)=2, rnd(20)=2, rnd(6)=5,
  rn2(19)=0, rn2(4)=1`, then suspends at `The arrow hits the rust
  monster!--More--` before floor RNG.  Input83 says `Somehow, the arrow is not
  affected by the oxidation.`, spends floor `rn2(100)=39` and completes the
  exact 19-call actor tail.  All 85 states are exact from input3 onward.  The
  fired +2 arrow is unrusted, proofed and `rknown=true` beneath the hostile
  19/26-HP target at `(59,17)`; its proofed inventory sibling remains
  `rknown=false`.  Focused passes 1/1, the adjacent matrix passes 15/15, and
  the managed family passes 99/99 in 2.63 seconds at 329,908,224 bytes maximum
  RSS with empty registries.  Blessed protection, cancellation, rust levels
  and alternate rust-prone projectiles remain open.
- Seed123 closes silent blessed AD_RUST protection.  Its one-shot input71 owns
  `rnd(2)=1, rnd(2)=1, rnd(20)=7, rnd(6)=5, rn2(19)=10,
  rn2(4)=3, rnl(4)=3, rnl(4)=0, rn2(100)=84` before the exact actor tail.
  The first `rnl(4)` fails blessed mulch protection; the second succeeds in
  `erode_obj(EF_GREASE)`.  No proof line or `rknown` learning occurs.  All 74
  states are exact from input3 onward; the fired and inventory +2 arrows remain
  blessed, non-proof, proof-unknown and unrusted, with the floor identity under
  the hostile 17/24-HP target at `(35,18)`.  The proof/blessed pair passes 2/2,
  the adjacent matrix passes 16/16, and the managed family passes 100/100 in
  2.61 seconds at 335,151,104 bytes maximum RSS with empty registries.  Rust
  degree, cancellation and alternate rust-prone projectile rows remain open.
- Seed26 and seed172 close the remaining primary-rust degree ladder for
  ordinary arrows.  Seed26 input69 uses `rn2(2)=0` mulch survival, increments
  the fired +2 arrow from rust one to two, says `The arrow rusts further!`,
  and spends floor `rn2(100)=80` before the exact tail; its inventory sibling
  remains at one.  All 72 states are exact from input3 onward.  The initial
  seed26 thoroughly-rusty probe was correctly rejected because mulch destroyed
  it; a tightened one-shot selector found ten real max-rust survivors by
  seed172.  Seed172 input80 uses `rn2(4)=0`, preserves the hit identity, keeps
  primary erosion three without message/deletion, spends floor
  `rn2(100)=69`, and completes the exact tail.  All 83 states are exact from
  input3 onward.  The degree pair passes 2/2, the adjacent matrix passes 18/18,
  and the managed family passes 102/102 in 2.57 seconds at 340,475,904 bytes
  maximum RSS with empty registries.  Alternate iron ammunition, cancellation
  and other rust-prone projectiles remain open.
- Seed22 closes alternate iron bow ammunition.  ORCISH_ARROW shares native's
  `-P_BOW` launcher relation and IRON material but was excluded by the old
  exact-ARROW JS predicate.  Native input79 consumes `rnd(2)=1, rnd(2)=2,
  rnd(20)=2, rnd(5)=3, rn2(19)=0, rn2(4)=1, rn2(100)=39` before the exact
  actor tail and says `The orcish arrow hits the rust monster!  The orcish
  arrow rusts!`.  All 82 states are exact from input3 onward after switching
  AD_RUST to material policy.  The fired +2 orcish arrow reaches rust one
  beneath the hostile 21/26-HP target at `(59,17)`; its inventory sibling stays
  unrusted.  Focused passes 1/1, the adjacent matrix passes 19/19, and the
  managed family passes 103/103 in 2.34 seconds at 325,844,992 bytes maximum
  RSS with empty registries.  Wooden/silver negative controls, cancellation
  and other rust-prone projectile classes remain open.
- The paired seed22 wooden ELVEN_ARROW closes the negative side of
  `is_rustprone()`.  It shares the P_BOW launcher path, action geometry and
  floor/scheduler suffix with ORCISH_ARROW, but WOOD bypasses AD_RUST.  Native
  input78 owns `rnd(2)=1, rnd(2)=2, rnd(20)=2, rnd(7)=2,
  rn2(19)=0, rn2(4)=1, rn2(100)=39` before the exact actor tail and publishes
  only `The elven arrow hits the rust monster.`.  All 81 states are exact from
  input3 onward; the fired +2 arrow remains unrusted beneath the hostile
  22/26-HP target at `(59,17)` and its inventory sibling remains unrusted.  The
  iron/wood pair passes 2/2, the adjacent matrix passes 20/20, and the managed
  family passes 104/104 in 2.26 seconds at 333,709,312 bytes maximum RSS with
  empty registries.  Silver ammunition, cancellation and non-ammunition iron
  projectiles remain open.
- Seed26 closes the analogous AD_CORR material pair.  Native ORCISH_ARROW
  input80 consumes `rnd(2)=1, rnd(2)=1, rnd(20)=1, rnd(6)=3,
  rn2(19)=8, rn2(4)=3, rn2(100)=41` before the exact actor tail and publishes
  `The orcish arrow hits the black pudding!  The orcish arrow corrodes!`.
  After switching AD_CORR from exact ARROW to IRON/COPPER material, all 83
  states are exact from input3 onward; the fired +2 arrow reaches secondary
  erosion one beneath the hostile 37/42-HP target at `(5,17)` and its inventory
  sibling stays zero.  The paired wooden ELVEN_ARROW recording is 82 states
  exact from input3 onward with no corrosion/prose and both identities at zero.
  The pair passes 2/2, the adjacent matrix passes 22/22, and the managed family
  passes 106/106 in 2.26 seconds at 318,750,720 bytes maximum RSS with empty
  registries.  Corrosion proof/blessing/degrees, copper projectile coverage and
  cancellation remain open.
- Seed26 and seed69 close AD_CORR's proof/blessed protection split.  Native
  corrodeproof input86 stops after six hit/mulch calls at `The arrow hits the
  black pudding!--More--`; input87 says `Somehow, the arrow is not affected by
  the corrosion.`, spends floor `rn2(100)=41`, and completes the exact
  20-call tail.  All 89 states are exact from input3 onward; only the fired
  floor arrow becomes `rknown=true`, while its proofed inventory sibling stays
  false and both remain uncorroded.  Seed69's blessed input72 contains two
  `rnl(4)=0` calls—for mulch and passive protection—then floor
  `rn2(100)=78`; it remains silent and learns no proof.  All 75 states are
  exact from input3 onward with both identities blessed, non-proof and
  uncorroded.  The pair passes 2/2, the adjacent matrix passes 24/24, and the
  managed family passes 108/108 in 2.23 seconds at 332,300,288 bytes maximum
  RSS with empty registries.  Corrosion degrees, copper projectile coverage,
  cancellation and grease controls remain open.
- Seed4 and seed123 close the secondary-corrosion degree ladder.  Seed4's
  one-shot input73 owns `rnd(2)=1, rnd(2)=1, rnd(20)=3, rnd(6)=5,
  rn2(19)=15, rn2(2)=0, rn2(100)=84` before the exact actor tail and says
  `The arrow hits the black pudding!  The arrow corrodes further!`.  The fired
  +2 arrow reaches `oeroded2=2` beneath the hostile 30/37-HP target at
  `(54,11)` while its inventory sibling remains at one; all 76 states are
  exact from input3 onward.  Seed4's max attempt was rejected by mulch; a
  one-shot selector found ten max survivors by seed123.  Seed123 input84 uses
  `rn2(4)=0`, leaves secondary erosion three unchanged/silent, spends floor
  `rn2(100)=26`, and completes the exact tail.  Fired and inventory identities
  stay at three; all 87 states are exact from input3 onward.  The degree pair
  passes 2/2, the adjacent matrix passes 26/26, and the managed family passes
  110/110 in 2.28 seconds at 330,596,352 bytes maximum RSS with empty
  registries.  AD_CORR grease, copper projectiles and cancellation remain open.
- Seed15 and seed26 close both AD_CORR grease outcomes against black pudding.
  The selector found three retained and twelve worn candidates through seed139
  in 2.01 seconds at 238,698,496 bytes maximum RSS.  Seed15 input81 pays
  pre-flight `rn2(7)=2` and grease `rn2(2)=1`; the fired floor arrow stays
  greased and uncorroded while its inventory sibling remains greased.  Seed26
  input81 pays pre-flight `rn2(7)=1` and grease `rn2(2)=0`; only the fired
  identity loses grease, both identities remain uncorroded, and no corrosion
  prose appears.  Both fresh 84-state native replays are exact from input3
  onward.  Focused passes 2/2, and the one owned managed family passes 112/112
  in 2.26 seconds at 363,216,896 bytes maximum RSS.  AD_ACID grease is the next
  adjacent passive gap; copper projectiles and cancellation remain broader
  AD_CORR gaps.
- Seed237 and seed343 close both AD_ACID grease outcomes against a live acid
  blob.  A corrected direction-aware selector found sixteen live-target
  candidates through seed1138 in 16.68 seconds at 265,551,872 bytes maximum
  RSS; the initial empty result was a selector bug which inspected startup's
  first `rn2(6)=0` rather than the hit input.  Native seed237 input77 inserts
  `rn2(2)=0` after passive `rn2(6)=0`, removes grease only from the detached
  floor +2 arrow and shifts floor resistance from the pre-fix 52 to 11.
  Native seed343 inserts `rn2(2)=1`, retains grease on both identities and
  shifts floor resistance from 33 to 30.  Both fresh 80-state replays are exact
  from input3 onward after the source-shaped repair.  Focused passes 2/2 in
  0.21 seconds at 129,712,128 bytes maximum RSS; the one owned managed family
  passes 114/114 in 2.35 seconds at 337,117,184 bytes maximum RSS.  The next
  AD_ACID gap is the iron/wood material boundary; proof, blessing and degree
  controls remain open.
- Seed320 closes both sides of AD_ACID's material predicate.  A paired selector
  found twelve shared one-shot/live-target carriers through seed1725 in 25.60
  seconds at 275,726,336 bytes maximum RSS.  Native ORCISH_ARROW input76 uses
  `rnd(5)=5`, survives `rn2(4)=3`, pays passive `rn2(6)=0`, reaches
  `oeroded2=1`, says `The orcish arrow corrodes!`, and gives floor resistance
  36.  The native ELVEN_ARROW sibling uses `rnd(7)=5` but the same raw stream,
  target and floor handoff; WOOD remains uncorroded and silent.  Both leave the
  hostile acid blob at 1/8 HP and their inventory sibling at corrosion zero.
  The 79- and 78-state native replays are exact from input3 onward after using
  IRON/COPPER material policy.  Focused passes 2/2 in 0.20 seconds at
  129,630,208 bytes maximum RSS; the one owned managed family passes 116/116
  in 2.27 seconds at 329,089,024 bytes maximum RSS.  AD_ACID proof/blessing is
  next; degree controls remain open.
- Seed320 and seed1032 close AD_ACID actual-proof versus blessed protection.
  The one owned selector found six proof and six blessed candidates in 61.37
  seconds at 153,976,832 bytes maximum RSS; its yielded session was retained
  and polled through normal exit.  Native proof input82 stops after
  `rn2(6)=0` at the hit pager; input83 publishes the corrosion-protection line,
  learns proof only on the fired identity and gives floor resistance 36.  The
  proofed inventory sibling stays `rknown=false`.  Native blessed input68
  distinguishes mulch `rnl(4)=3` from passive protection `rnl(4)=0`, gives
  floor resistance 30 and remains silent/non-proof.  Both complete native
  replays are exact from input3 onward after the repair.  Focused passes 2/2
  in 0.21 seconds at 129,253,376 bytes maximum RSS; the one owned managed
  family passes 118/118 in 2.34 seconds at 327,368,704 bytes maximum RSS.
  AD_ACID corrosion degrees remain open.
- Seed605 closes AD_ACID's secondary-corrosion degrees and exposes the earlier
  launched-ammunition `dmgval()` owner.  One retained selector ran 152.10
  seconds at 154,533,888 bytes maximum RSS and found eight shared level-one,
  level-two and max-three carriers; it was polled to normal exit without a
  duplicate.  All variants hold raw d6=4, +2 enchantment, the live 8-HP target,
  passive `rn2(6)=0`, floor resistance 6 and actor tail constant.  Native
  subtracts projectile erosion before launcher skill, leaving target HP 3, 4
  and 5; level-one reaches erosion two with `corrodes further`, level-two
  reaches three with `corrodes completely`, and max-three remains silent at
  three.  The 72-, 77- and 83-state replays are exact from input3 onward after
  repairing both damage and prose.

  The first expanded managed gate was correctly red at 115/121: six older
  pre-eroded fire/rust/corrosion tests still asserted the former non-native HP.
  Source-shaped HP corrections preserve every RNG, screen, cursor and object
  state check.  The degree trio passes 3/3; the nine-row focused audit passes
  9/9 in 0.30 seconds at 137,609,216 bytes maximum RSS; the one owned managed
  family passes 121/121 in 2.35 seconds at 334,086,144 bytes maximum RSS.
- Seed116 closes AD_ACID's cancellation-insensitive branch and adds the
  adjacent immediate cancellation-wand/status setup needed to prove it.  Wizard
  genesis cannot create cancelled monsters.  The first ordinary-arrow native
  attempt was rejected because it merged with startup ammunition and opened an
  unrelated compare-items pager; switching to non-starting iron ORCISH_ARROW
  removes that setup divergence.

  The corrected selector found eight live cancelled-target candidates through
  seed1165 in 27.50 seconds at 246,464,512 bytes maximum RSS.  Native seed116
  input127 is silent and pays Wisdom `rn2(19)=6`, immediate range `rn2(8)=3`,
  wand resistance `rn2(111)=54`, then the exact scheduler tail.  Stethoscope
  input130 independently displays the live `cancelled` condition.  Input133
  still spends AD_ACID `rn2(6)=0`, corrodes only the detached orcish arrow,
  gives floor resistance 77 and leaves the cancelled target alive at 1/4 HP.
  All 136 states are exact from input3 onward.  Focused passes 1/1 in 0.20
  seconds at 131,481,600 bytes maximum RSS; the managed family passes 122/122
  in 2.35 seconds at 332,562,432 bytes maximum RSS.  Cancelled AD_RUST and
  AD_CORR suppression are the next paired controls.
- Seed205 and seed2 close the passive-side cancelled AD_RUST/AD_CORR pair, with
  a bounded rust-contact residual kept explicit.  The first combined selector
  ran as one retained process for 277.12 seconds at 159,186,944 bytes maximum
  RSS and found six rust carriers but zero black-pudding carriers.  That zero
  was a selector bug: the 80-column black-pudding status truncates `cancelled`
  to `cancell`.  A corrected black-pudding-only pass found six candidates in
  1.50 seconds at 137,674,752 bytes maximum RSS.

  Native status then exposed a real tty issue: long monster status wraps to
  row two and opens `--More--`, while JavaScript retained the direction prompt
  and truncated the status.  Clearing `getdir()` state, using the resumable
  status publisher and adding one explicit acknowledgement repairs it.  The
  corrected 141-state black-pudding replay is exact from input3 onward: floor
  resistance 44 follows mulch with no AD_CORR mutation/prose, and both orcish
  arrows remain uncorroded beneath a live `mcan=1` target.

  Rust input137 is exact through its seven-call projectile/floor prefix and
  has exact screen/cursor plus unrusted fired/inventory identities.  Its later
  same-input hero-contact tail remains non-exact at native `d(0,0)=0`; the test
  is intentionally prefix-bounded rather than called a complete replay.  The
  cancellation pair passes 2/2 in 0.24 seconds at 129,466,368 bytes maximum
  RSS, and the managed family passes 124/124 in 2.39 seconds at 333,840,384
  bytes maximum RSS.  The cancelled rust-monster touch is the next earliest
  source gap.
- Correction to the seed205 residual above: the cancelled rust-monster touch is
  now complete-exact.  Native `mhitm_ad_rust()` still owns declared
  `d(0,0)=0` and the visible touch line before cancellation returns from armor
  erosion; shared `rn2(3)=0, rn2(6)=0` knockback gates then precede slot-two
  `rnd(21)=21`.  JavaScript previously skipped the whole special slot and
  jumped to `rnd(21)=1`.  Adding the cancelled AD_RUST natural-contact arm
  restores all 140 states from input3 onward.  The strengthened focused test
  passes 1/1 in 0.21 seconds at 128,909,312 bytes maximum RSS, and the managed
  family passes 124/124 in 2.38 seconds at 342,310,912 bytes maximum RSS.
- Seed53 closes uncancelled monster-to-hero AD_RUST through both verbose
  non-effect and actual helmet erosion.  Two initial 8,192-seed selectors were
  correctly rejected: the first omitted the stethoscope acknowledgement and
  ran 171.69 seconds at 383,401,984 bytes maximum RSS; the second incorrectly
  required projectile and touch prose on the same topline and ran 177.22
  seconds at 403,849,216 bytes.  A relaxed hit/survival selector found twelve
  carriers in 2.70 seconds at 181,501,952 bytes maximum RSS.  Native—not
  shifted JavaScript RNG—then selected seed53.

  The 141-state native replay shows two body-slot selections ending on the
  leather cloak with `not affected by oxidation`, followed by a later head-slot
  zero which rusts the worn +2 plumed helmet.  Each slot is between declared
  `d(0,0)`, visible touch and shared knockback gates.  The port now resumes
  `erode_armor()` across its message pagers, retries empty non-body slots and
  preserves the body branch's unconditional stop.  All states are exact from
  input3 onward in 0.18 seconds at 123,944,960 bytes maximum RSS.  Focused
  passes 1/1 in 0.21 seconds at 129,466,368 bytes maximum RSS; the managed
  family passes 125/125 in 2.39 seconds at 336,019,456 bytes maximum RSS.
- Seed53 and seed141 close worn-helmet grease, actual proof and blessed
  protection.  Greased seed53 first retains grease on `rn2(2)=1`, then a later
  touch wears it on `rn2(2)=0`; native publishes the protection line before
  each draw and `The grease dissolves.` afterward.  All 155 states are exact
  from input3 onward and the helmet stays rust zero.

  Rustproof seed53 publishes protection before proof learning, then resumes
  `erode_armor()` because head-slot `ER_NOTHING` must continue; feet/body
  selection ends on the verbose cloak non-effect.  All 157 states are exact,
  with the helmet proof-known and unrusted.  The first helper version consumed
  next-slot RNG before the proof pager; splitting selection/prose from property
  finalization and making the slot loop resumable repairs that ordering.

  Seed53's blessed `rnl(4)=1` is retained only as a negative control.  A
  bounded final-rust-zero selector found twelve positive candidates in 31.62
  seconds at 299,991,040 bytes maximum RSS.  Native seed141 uses head
  `rnl(4)=0` silently, continues through gloves to body one, and leaves the
  helmet blessed, non-proof, proof-unknown and unrusted; all 146 states are
  exact.  The protection trio passes 3/3 in 0.24 seconds at 132,530,176 bytes
  maximum RSS, and the managed family passes 128/128 in 2.59 seconds at
  347,586,560 bytes maximum RSS.
- Three seed53 variants close worn-helmet primary-rust degree boundaries without
  a production edit.  A helmet starting at erosion one reaches two with
  `rusts further`, then three with `rusts completely`; a helmet starting at two
  reaches three on its first selected head touch.  Subsequent head selection at
  maximum erosion is silent `ER_NOTHING` and resumes `erode_armor()` until the
  leather cloak owns the visible oxidation non-effect.  An independent
  max-three starting variant confirms that retry rather than inferring it from
  the two-to-three transition.

  The 153-, 158- and 164-state native recordings replay exactly from input3
  onward in 0.19, 0.17 and 0.17 seconds at 123,535,360, 124,256,256 and
  123,715,584 bytes maximum RSS.  The three durable degree regressions pass
  3/3 in 0.26 seconds at 131,301,376 bytes maximum RSS.  The one owned managed
  family passes 131/131 in 2.45 seconds at 352,878,592 bytes maximum RSS; all
  runners exited.  Worn-armor AD_CORR is the next adjacent source owner.
- Seed11 closes monster-to-hero AD_CORR through a real black-pudding bite and
  worn helmet.  The native input orders attack `rnd(20)=4`, declared
  `d(3,8)=12`, head-slot `rn2(5)=0`, corrosion prose/state, shared knockback
  `rn2(3)=2,rn2(6)=5`, and later actor/global work.  The helmet changes only
  secondary `oeroded2` from zero to one, AC changes from four to five, and the
  hero survives at 3/15 HP.  All 140 states replay exactly from input3 onward
  in 0.19 seconds at 123,551,744 bytes maximum RSS.

  The implementation parameterizes the existing resumable armor-erosion owner
  by rust versus corrosion instead of duplicating its five-way selector.
  Corrosion retains iron-or-copper vulnerability, secondary erosion state and
  corrosion wording; the shared message-before-state and retry rules remain
  intact.  A status-only projected AC preserves old combat `uac` for later
  actors until once-per-input `find_ac()` commits the new value.  This witness
  also corrected stale ogre gender-name keys 208/209 to 204/205, which had
  mislabeled black-pudding contact as an ogre-king bite.

  Focused passes 1/1 in 0.22 seconds at 129,155,072 bytes maximum RSS; the
  rust/corrosion sibling gate passes 8/8 in 0.31 seconds at 137,740,288 bytes;
  armor projection passes 5/5 in 0.06 seconds at 55,918,592 bytes.  The one
  owned managed family passes 132/132 in 2.47 seconds at 348,962,816 bytes
  maximum RSS and exits cleanly.  Corrosion grease/proof/blessing and degree
  controls on worn armor remain separate successors.
- Seed3, seed11 and seed745 close the worn-armor AD_CORR protection and degree
  siblings without a production edit.  Greased seed11 retains on `rn2(2)=1`;
  greased seed3 wears on `rn2(2)=0`, with protection prose before the draw and
  a separate `The grease dissolves.` sentence afterward.  Actual corrodeproof
  seed11 learns `rknown` after its protection line, returns `ER_NOTHING`, and
  retries to the body-slot cloak.  Seed11's blessed `rnl(4)=1` remains a
  negative corrosion control.  A JavaScript-only seed360 positive was rejected
  when native C placed a newt east; native seed3 was also negative at
  `rnl(4)=2`.  Seed745 supplies the real positive `rnl(4)=0`, stays silent and
  proof-unknown, then retries to the cloak.

  Seed11's secondary degree variants advance one→two with `corrodes further`,
  two→three with `corrodes completely`, and leave max-three silent before the
  exact `2,2,3,0,4,1` retry-to-body sequence.  Their final AC is five because
  the helmet's one base armor point caps the greatest-erosion penalty.  The
  seven 145-, 154-, 154-, 155-, 159-, 160- and 166-state recordings all replay
  exactly from input3 onward in one 0.68-second audit at 137,248,768 bytes
  maximum RSS.  The durable worn-corrosion family passes 8/8 in 0.35 seconds
  at 139,182,080 bytes; the one owned managed family passes 139/139 in 2.61
  seconds at 349,126,656 bytes and exits cleanly.  Natural cancelled AD_CORR
  and the copper/non-corrodible worn-material boundary remain open.
- Seed2 closes naturally cancelled monster-to-hero AD_CORR.  Adding the helmet
  wish moved the pudding north, so the first west-directed recording was a
  rejected no-contact control.  The corrected north-directed wand/status/shot
  setup proves a live `mcan=1` pudding; its arrow miss makes the target hostile,
  the first rest supplies no attack, and the second reaches the bite.

  Native input175 consumes `rn2(5)=0,rnd(20)=11,d(3,8)=19,rn2(3)=0,rn2(6)=3`
  exactly.  There is no post-damage armor-slot draw, the helmet stays
  `oeroded2=0`, and AC stays four.  Cancellation suppresses `erode_armor()` but
  not the already-rolled 3d8 damage: HP reaches zero, then the exact death
  pager, declined debug-death prompt and recovery restore 15/15 HP.  All 187
  states replay exactly from input3 onward without a production edit.  Focused
  passes 1/1 in 0.21 seconds at 129,515,520 bytes maximum RSS; the one owned
  managed family passes 140/140 in 2.58 seconds at 364,101,632 bytes and exits
  cleanly.  The worn copper/non-corrodible material boundary is next.
- Seed11 closes COPPER versus non-corrodible worn-body AD_CORR and repairs two
  earlier lifecycle boundaries exposed by the setup.  Removing the Ranger's
  sole displacement cloak was first red at input4: JavaScript skipped native
  displacement-loss feedback and paid ten scheduler calls immediately, while
  native held AC seven behind a wrapped two-row pager and reached `off_msg`,
  scheduler and AC ten only after acknowledgement.  The zero-delay removal
  transaction now queues property feedback before `off_msg`; its 14-state
  locator is exact from input3 onward.

  The initial peaceful-projectile bronze recipe was rejected after an arrow
  miss let the pudding wander.  The minimized source-default hostile setup
  wears only the test suit.  Bronze and crystal share bite 17 and armor slots
  `2,2,0,4,3,0,0,1`.  Bronze plate mail corrodes to `oeroded2=1`; its fatal
  pager retains AC two and recovery projects AC three.  Crystal plate mail is
  verbose `ER_NOTHING`, stops at body without retry and remains erosion zero,
  AC one.  Its first replay exposed a stale-HP bridge: an older bite pager must
  not preserve HP 15 when the newer crystal non-effect line is forced after
  damage.  Narrowing that bridge makes the line display native HP zero.

  The 98- and 99-state material recordings each replay exactly from input3.
  Focused material/lifecycle passes 3/3 in 0.25 seconds at 131,350,528 bytes;
  fixture-disabled fatal-status siblings pass 2/2 in 0.31 seconds at
  153,501,696 bytes; armor projection passes 5/5 in 0.06 seconds at 55,984,128
  bytes.  The one owned managed family passes 142/142 in 2.73 seconds at
  364,478,464 bytes and exits cleanly.  A fixture-on seed5002 state assertion
  was rejected as fake acceptance because its synthetic result never populated
  `game.u.uhp`; the same pair is green through the real engine.  Hero
  acid-resistance inventory protection is the next worn-corrosion control.
- Seed11 and seed57 close equipped acid-resistance protection inside worn
  `erode_obj(ERODE_CORRODE)`.  Yellow dragon scale mail supplies a real worn
  property source.  Seed11 pays success draws 33 and 56 on leather gloves, 23
  and 68 on the yellow suit, all before grease/material/proof; every result is
  silent `ER_NOTHING`, and suit/helmet remain uncorroded.  Gray dragon mail
  supplies no acid property, inserts no such draw and reaches the ordinary
  verbose body non-effect.

  The first failure selector falsely accepted seed1's later global
  `rn2(100)=99`; it was rejected.  Requiring the 99 immediately after head-slot
  zero and before knockback found seed57.  Native input121 has several earlier
  successful helmet protections, then `rn2(100)=99` falls through to iron and
  displays `Your etched helmet corrodes!`; secondary erosion becomes one and
  AC changes −6→−5.  This proves the source probability is 99%, not absolute.
  Aggregate intrinsic resistance is intentionally insufficient; the port
  checks equipment provenance.

  The 190-state yellow-success, 188-state gray and 190-state yellow-failure
  sessions all replay exactly from input3 in a 1.09-second audit at 152,240,128
  bytes maximum RSS.  Focused passes 3/3 in 0.26 seconds at 134,217,728 bytes;
  fixture-disabled dragon-mail lifecycle passes 1/1 in 0.22 seconds at
  140,361,728 bytes; armor projection passes 5/5 in 0.06 seconds at 55,656,448
  bytes.  The one owned managed family passes 145/145 in 2.72 seconds at
  368,246,784 bytes and exits cleanly.  Natural AD_DCAY worn-armor decay is
  the next adjacent erosion owner.
- Seed11 closes natural brown-pudding AD_DCAY through organic, non-rottable,
  blessed/max and greased controls.  A Healer's blessed leather gloves first
  take silent `rnl(4)=0` protection, then rot through secondary degrees one,
  two and three with `rots`, `rots further` and `rots completely`.  Max-three
  protection followed by empty body slot exposed a shared stale-retry flag;
  resetting selection-local result state restores body termination.

  Wished bronze plate mail is non-rottable and body-terminal, publishing
  `not affected by decay`.  Wished greased leather gloves prove ERODE_ROT
  ignores grease: no `rn2(2)` occurs, grease remains present, and both gloves
  and the starting cloth cloak reach secondary degree three.  That session
  exposed a later general boundary: an unseen door-open pline must suspend
  before the door actor's trailing `distfleeck`.  Resuming post-door work after
  acknowledgement moves `rn2(5)=4` from input84 to native input85.

  The 130-, 179- and 177-state recordings all replay exactly from input3 in a
  1.32-second sixteen-control audit at 146,472,960 bytes maximum RSS.  Focused
  decay passes 3/3 in 0.30 seconds at 134,873,088 bytes; the one owned managed
  family passes 147/147 in 2.77 seconds at 371,884,032 bytes and exits cleanly.
  Rotproof learning and naturally cancelled AD_DCAY are the next paired
  controls.
- Seed11 closes actual rotproof learning and naturally cancelled AD_DCAY.
  Wished rotproof leather gloves publish the decay-protection line, learn
  `rknown`, return `ER_NOTHING` and retry to the body-slot cloth cloak, which
  rots.  The proofed gloves remain secondary zero while the cloak later reaches
  rot degree three.  All 154 states replay exactly from input3.

  A Healer wishes a cancellation wand, cancels the northwest source-default
  hostile brown pudding and confirms `cancelled.--More--` by stethoscope.
  Inputs68 and98 each retain `d(0,0)` plus shared knockback but contain no
  armor-slot draws; blessed leather gloves remain unrotted.  All 119 states are
  exact.  The first two focused reruns were rejected harness evidence because a
  refactored rest-cycle helper appended four extra spaces; generating `n−1`
  ordinary cycles plus one exact final cycle restores native lengths.

  The eighteen-control audit completes in 1.48 seconds at 153,272,320 bytes
  maximum RSS.  Focused ordinary decay passes 5/5 in 0.29 seconds at
  135,479,296 bytes; the one owned managed family passes 149/149 in 2.82 seconds
  at 358,727,680 bytes and exits cleanly.  Polymorphed wood/leather-golem hero
  rehumanization is the remaining AD_DCAY branch.
- Seed11 closes polymorphed `completelyrots()` with a controlled wood-golem
  Wizard.  Native `#polyself` uses fixed `golemhp()` 50 with no d8 roll, breaks
  the large form out of its magic-resistance cloak and drops that cloak.  The
  first JavaScript replay instead added `d(7,8)=29` and omitted the clasp line;
  the source golem HP table and large/non-humanoid break predicate repair form
  construction.

  Native input54 then combines `The brown pudding bites!  You rot!  You return
  to human form!`.  It consumes `d(0,0)`, rehumanizes before shared knockback,
  inserts no armor-slot draw, restores human HP12/12 and AC10, and leaves the
  cloak on the floor.  All 129 states replay exactly from input3.  The
  nineteen-control audit completes in 1.52 seconds at 150,306,816 bytes
  maximum RSS.  Fixture-disabled controlled-polymorph siblings pass 2/2 in
  0.26 seconds at 136,642,560 bytes; the one owned managed family remains
  149/149 in 2.78 seconds at 374,439,936 bytes and exits cleanly.  Iron-golem
  `completelyrusts()` is the next analogous form branch.
- Seed11 closes polymorphed `completelyrusts()` with a controlled iron-golem
  Wizard.  Native form setup consumes the fixed-form sequence ending in
  `rn2(500)=200`, installs HP120/120, HD18 and AC3, breaks and drops the magic-
  resistance cloak, and pages the clasp line before publishing the form's
  breath-weapon notice.  The first replay exposed three shared construction
  gaps: the article was `a`, breath capability was incorrectly restricted to
  dragon glyphs, and AC was projected only after the pager.  Attack-table
  capability lookup plus pre-pager equipment/AC commit restores native input24
  and input25.

  Native input53 combines `The rust monster touches you!  You rust!  You
  return to human form!--More--`.  The first zero-dice touch rehumanizes before
  armor selection, after which the second touch continues against the human
  body in the same actor turn.  All 104 states are exact from input3, while the
  preceding nineteen rust/corrosion/decay controls remain exact.  With fixtures
  disabled, the iron, wood and existing red-dragon polymorph witnesses pass
  3/3 in 0.26 seconds; the one owned managed family remains 149/149 in 2.74
  seconds.  Other special break/slip-armor form branches remain unselected.
- Seed11 selects `break_armor()` suit destruction and shirt shredding with a
  Tourist wearing wished +2 plate mail over the starting Hawaiian shirt before
  controlled wood-golem polymorph.  Native input63 combines `You turn into a
  wood golem!  You break out of your armor!--More--` with HP50/50, HD7, stale
  AC1, transient `Burdened` and the old `@` glyph.  Input64 publishes `Your
  shirt rips to shreds!`, projects the golem glyph, AC4 and no encumbrance.
  Neither garment remains in inventory or appears on the floor.

  The initial port retained both garments and replaced the form prose with an
  encumbrance line.  Sequential `plineWithContinuation()` ownership now lets
  the attempted shirt line force the earlier form/suit pair through tty before
  shirt destruction.  Removing the premature common `newsym()` exposed two
  rejected regressions: gnome sliparm needs its new glyph during the cloak
  pager, and red-dragon no-hands weapon drop needs the older AC through its
  later capacity pager.  Keeping repaint ownership on the actual drop paths
  restores both existing native sequences.  The new 72-state session, the
  twenty prior rust/corrosion/decay controls and the four controlled-polymorph
  witnesses are exact; the owned managed family remains 149/149 in 2.73
  seconds.  Special cloak and accessory-removal successors remain open.
- Seed11 Healer selects the alchemy-smock subtype of large-form cloak removal.
  Wished object type144 remains appearance `apron`; controlled wood-golem
  input62 consumes `rn2(2)=1,rn2(19)=7,rn2(500)=287` and displays `You turn
  into a wood golem!  The knot on your apron is pulled apart!`.  The apron is
  dropped on the hero square, the starting gloves remain worn and form AC is
  two.  All 71 states are exact from input3.

  The port's generic clasp line was the only engine divergence.  Type-aware
  message selection retains the shared cloak drop/AC path.  The first focused
  assertion was rejected at 4/5 because it expected the canonical name
  `alchemy smock` on the unidentified floor object; type144 plus appearance
  `apron` is the native state.  The corrected fixture-disabled polymorph gate
  passes 5/5 in 0.29 seconds, the preceding twenty erosion controls stay exact
  and the owned managed family passes 149/149 in 2.69 seconds.  Adaptive and
  destroyed mummy-wrapping branches remain separate.
- Seed11 pairs both mummy-wrapping branches.  A wood golem satisfies the source
  humanoid/size/symbol/exception predicate: input63 says only `You turn into a
  wood golem!`, keeps type138 worn and projects AC0.  A winged gargoyle is an
  explicit `breakarm()` and `WrappingAllowed()` exception: input68 combines
  `You turn into a winged gargoyle!  Your wrapping tears apart!--More--`,
  destroys type138 and projects HP31/31, HD9, AC−4 and flight.  Input69 then
  publishes the female oviparous form's `#sit` egg notice.  The complete 72-
  and 77-state sessions are exact from input3.

  The first focused gate was rejected at 6/7 because its adaptive assertion
  expected a synthetic `where: inventory` field.  Live inventory membership,
  the worn slot and object identity are the actual storage contract; the
  corrected gate passes 7/7 in 0.31 seconds.  The twenty prior erosion controls
  stay exact and the owned managed family passes 149/149 in 2.73 seconds.
  Remaining accessory drop branches are not inferred from cloak behavior.
- Seed11 Healer pairs minotaur horns against rigid and flimsy headgear.  Both
  native input53 slices consume
  `rn2(2)=1,rn2(19)=7,rn2(10)=7,rn2(500)=164,d(15,8)=57`.  The +2 iron helmet
  yields `Your helm falls to the stairs!`, is dropped on the starting staircase
  and leaves form AC4.  The +2 cloth fedora yields `Your horns pierce through
  your fedora.`, remains worn/inventory-resident and leaves form AC2.  Both
  complete 62-state sessions are exact from input3.

  The port now maps the source horn-count species set, the material threshold
  through LEATHER and live surface wording.  The fixture-disabled polymorph
  gate passes 9/9 in 0.35 seconds, the twenty erosion controls stay exact and
  the owned managed family passes 149/149 in 2.73 seconds.  Shield, glove, boot
  and eyewear successors remain open.
- Seed11 Healer selects no-hands glove/weapon coupling by becoming a gelatinous
  cube with the starting leather gloves and wielded scalpel.  Native input29
  consumes `rn2(2)=0,rn2(19)=9,rn2(500)=193,d(6,8)=20` and displays `You turn
  into a gelatinous cube!  You drop your gloves and weapon!--More--` with
  HP20/20, HD6, AC8, `Burdened` and `Blind`.  Both objects are on the floor;
  input30 publishes the capacity notice.  All 38 states are exact from input3.

  The port previously entered its weapon-only red-dragon shortcut, retained
  the gloves and said `find you must drop your tool`.  Glove presence now owns
  the coupled line and both drops; later capacity prose supplies the pager.
  The fixture-disabled polymorph gate passes 10/10 in 0.32 seconds, the twenty
  erosion controls stay exact and the owned managed family passes 149/149 in
  2.75 seconds.  Shield, boot and eyewear branches remain open.
- Seed11 extends the gelatinous-cube no-hands witness with wished +2 small
  shield.  Native input66 shows the form/glove/weapon pager at Stressed/AC5;
  input67 shows `You rebalance your load.  Movement is difficult.--More--` at
  Burdened; input68 shows `Your movements are only slowed slightly by your
  load.--More--`; input69 finally says `You can no longer hold your shield!`,
  drops it and projects AC8.  All 75 states are exact from input3.

  Root cause was broader than shield policy: JS kept purse gold outside
  inventory and omitted its rounded coin weight.  Native's 1,540 gold adds 15
  weight, preserving Stressed after the scalpel drop.  Shared weight now counts
  `_goldCount` unless an explicit coin object exists; each selected `dropx()`
  advances a source-style capacity cursor and queues its actual transition.
  The fixture-disabled polymorph gate passes 11/11 in 0.36 seconds, the twenty
  erosion controls remain exact and the owned managed family passes 149/149 in
  2.70 seconds.  Boots and eyewear remain open.
- Seed11 adds wished +2 low boots to the gelatinous-cube no-hands witness.
  Native input63 combines the form and glove/weapon line behind `--More--` at
  HP25/25, HD6, AC5, Burdened and Blind.  The attempted boot line makes input64
  page `Your movements are slowed slightly because of your load.`; input65
  says `Your boots are pushed off your feet!`, drops type163 and projects AC8.
  Gloves, scalpel and boots are all floor-owned.  All 72 states are exact from
  input3.

  The port's per-drop capacity cursor already owned the first pager; the only
  missing boundary was the ordered no-hands boot message/drop/recheck.  The
  fixture-disabled focused polymorph gate passes 12/12 in 0.34 seconds, the
  preceding twenty erosion controls remain exact and the managed family passes
  149/149 in 2.73 seconds.  Whirly, very-small, slithy and centaur boot arms,
  plus headless eyewear, remain independent.
- Seed11 Healer wears a wished blindfold before the headless, eyeless
  gelatinous-cube transformation.  Native input51 pages the form/glove/weapon
  line at HP21/21, HD6, AC8, Burdened and Blind.  The attempted eyewear line
  makes input52 page the pending capacity notice; input53 combines `Your
  blindfold falls off!  You still cannot see.`, clears `ublindf` and drops
  type233 while form blindness remains.  Gloves and scalpel retain their prior
  floor ownership.  All 60 states are exact from input3.

  The selected owner is message → clear worn eyewear/blindness feedback →
  floor drop → capacity recheck.  The fixture-disabled focused polymorph gate
  passes 13/13 in 0.35 seconds, the preceding twenty erosion controls remain
  exact and the managed family passes 149/149 in 2.76 seconds.  Towel/lenses
  grammar and the remaining boot wording families remain separate siblings.
- Seed11 pairs lenses with the headless blindfold witness.  Native input19
  wishes `k - a pair of lenses.`; input21 installs type232 through `P` and says
  `You are now wearing a pair of lenses.` without making the human blind.
  Inputs48--49 retain the gelatinous-cube glove/load pagers, while input50 says
  only `Your lenses fall off!`: plural grammar strips `pair of`, and
  Blindf_off suppresses blindfold-only `still cannot see`.  Type232 is dropped
  and form-derived Blind remains.  All 57 states are exact from input3.

  This block closes shared wish presentation, non-blinding `ublindf` install,
  plural fall grammar and blindness-causality suppression.  The fixture-
  disabled focused polymorph gate passes 14/14 in 0.37 seconds, the preceding
  twenty erosion controls remain exact and the managed family passes 149/149
  in 2.74 seconds.  Towel and remaining boot-wording arms stay independent.
- Seed11 replaces gelatinous cube with fog cloud in the low-boots witness.
  Native input57 combines the form and glove/weapon line behind `--More--` at
  HP12/12, HD3, AC5, `Blind Fly`.  Input58 consumes `rn2(3)=1` inside hero
  `m_everyturn_effect()`, says `Your boots fall away!`, drops type163, projects
  AC0 and creates a harmless one-cell vapor region with TTL5.  All 66 states
  are exact from input3.

  Earliest replay first exposed shared status order (`Fly Blind` versus native
  `Blind Fly`), then the missing hero vapor TTL.  Status ordering is corrected;
  whirly/noncorporeal sliparm now precedes big-form breakarm; monster and hero
  fog hooks share the region constructor.  The fixture-disabled focused gate
  passes 15/15 in 0.38 seconds, the twenty erosion controls remain exact and
  the managed family passes 149/149 in 2.75 seconds.  Very-small `slide`,
  slithy and centaur boot arms remain separate.
- Seed11 uses the low-boots/gloves/scalpel Healer setup with a tiny acid blob.
  Native input57 pages the form/glove/weapon line at HP2/2, HD1, AC5,
  Overloaded and Blind; input58 pages `You can't even move a handspan with this
  load!`; input59 says `Your boots slide off your feet!`, drops type163 and
  projects AC8.  There is no whirly vapor call.  All 66 states are exact from
  input3.

  The earlier two pagers and capacity state were already exact; only the
  source `msize < MZ_SMALL` boot verb diverged.  Eligibility now accepts
  no-hands or very-small forms and orders whirly `fall`, very-small `slide`,
  then ordinary `pushed`.  The fixture-disabled focused gate passes 16/16 in
  0.38 seconds, the twenty erosion controls remain exact and the managed
  family passes 149/149 in 2.72 seconds.  Slithy and centaur arms remain open.
- Seed11 Healer wears +2 low boots and becomes a medium, hands-capable
  salamander.  Native input58 consumes
  `rn2(2)=1,rn2(19)=13,rn2(10)=7,rn2(500)=417,d(8,8)=35` and displays `You
  turn into a salamander!  Your boots are pushed off your feet!` with HP35/35,
  HD8 and AC−3.  Type163 is floor-owned; starting gloves and scalpel remain
  worn/wielded.  All 67 states are exact from input3.

  The initial focused gate was rejected at 16/17 because the test required a
  stored `false` blind flag; the live non-blind contract is falsy/absent.
  Correcting the assertion yields 17/17 in 0.36 seconds.  M1_SLITHY now owns
  boot eligibility independently of no-hands, size or whirly state; the twenty
  erosion controls remain exact and the managed family passes 149/149 in 2.85
  seconds.  Centaur remains the final boot eligibility sibling.
- Seed11 Healer wears +2 low boots and becomes a hands-capable large plains
  centaur.  Native input62 consumes
  `rn2(2)=1,rn2(19)=13,rn2(10)=7,rn2(500)=417,d(4,8)=19` and displays `You
  turn into a plains centaur!  Your boots are pushed off your feet!` with
  HP19/19, HD4 and AC2.  Type163 drops while starting gloves/scalpel remain
  worn/wielded.  All 71 states are exact from input3.

  No production change was needed: the S_CENTAUR predicate landed with the
  slithy block.  The new durable witness takes the fixture-disabled focused
  family to 18/18 in 0.38 seconds.  The last 149/149 managed result already
  covers the identical production state; rerunning it for a non-matching test
  and documentation-only batch was intentionally skipped.  Boot eligibility
  is now closed across no-hands, whirly, very-small, slithy and centaur arms.
- Seed11 level-30 Healer isolates natural monster-to-hero AD_ENCH with the
  starting +1 leather gloves.  Input92 rolls `d(4,4)=13`, magic-negation 3 and
  `rn2(100)=9`; ordinary object resistance succeeds, so the hit has no drain
  line and AC stays 8.  Input98 rolls `d(4,4)=10`, negation 3 and resistance
  44; the gloves become +0 before the hit pager.  Input99 says `Your pair of
  leather gloves seems less effective.`, resumes knockback/damage and projects
  AC9.  All 137 states are exact from input3.

  Active AD_ENCH now owns generic torso/later-slot `some_armor()`, accessory
  fallback, magic cancellation, positive enchantment/charge gating, ordinary
  versus artifact resistance, mutation and deferred effect prose.  The first
  level-30 Ranger carrier was rejected because displacement exposed an earlier
  `m_move()` stay/attack versus JS-move gap at input94.  The fixture-disabled
  focused family passes 19/19 in 0.39 seconds, twenty prior erosion/form
  controls remain exact and the managed family—including projectile AD_ENCH—
  passes 149/149 in 2.73 seconds.  The displacement movement gap remains open.
- Seed11 level-30 Healer wishes a cancellation wand, cancels the adjacent
  disenchanter and confirms wrapped `cancelled.--More--` by stethoscope.
  Native input123 consumes `rnd(20)=17,d(4,4)=12` then shared
  `rn2(3)=0,rn2(6)=3`; magic-negation, `some_armor()` and object-resistance
  draws are absent.  HP damage remains, while +1 gloves and AC8 do not change.
  All 162 states are exact from input3.

  The first implementation audit found that the intended `monster.mcan`
  short circuit had landed in the poisonous-contact block but not AD_ENCH;
  both locations now match source cancellation order.  The paired natural-
  disenchanter gate passes 2/2 in 0.23 seconds.  No unrelated managed selector
  was rerun because the new branch and test are outside that family.  No-armor
  accessory fallback remains the next AD_ENCH control.
- Seed11 Healer removes the starting gloves, wishes +2 ring of protection and
  wears it left before generating the level-30 hostile disenchanter.  Input109
  owns the observable-ring Wisdom exercise and displays `k - a +2 ring of
  protection (on left hand).` at AC8.  Input167 proves ring-supplied magic
  cancellation: `rn2(10)=0` suppresses fallback.  Input215 pays
  `rn2(10)=9,rn2(5)=2,rn2(100)=79`, selects `uleft`, drains +2→+1 and combines
  `Your ring of protection seems less effective.` with the hit; AC becomes 9
  while MC stays one.  All 224 states are exact from input3.

  Right-hand runs were rejected because their fallback values selected none,
  eyewear or the empty left slot; switching hand consumes no RNG and uses the
  existing slot-two draw.  Shared ring discovery, charged-ring enchantment
  display, left-hand suffix, AC projection and protection-derived magic
  cancellation were repaired before accepting fallback.  Natural AD_ENCH
  passes 3/3 in 0.23 seconds; twenty prior controls remain exact and the
  managed family passes 149/149 in 2.73 seconds.
