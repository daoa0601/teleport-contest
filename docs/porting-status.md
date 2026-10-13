# Porting handoff

The pinned NetHack C/Lua sources define the mechanics. Authored TypeScript in
`src/` defines what is implemented. The game port remains incomplete; public
sessions and the native development sample are diagnostics, not specifications.
Existing uncommitted work is preserved. Nothing was committed or published.

## TypeScript and build boundaries

All maintained runtime modules, behavior tests, and JavaScript tools have
TypeScript sources. `src/js/`, `src/test/`, `src/scripts/`, and `src/tools/` emit
to their matching repo-root directories. Root JavaScript remains available to
the unchanged grader. Browser tests and build configuration are checked directly
as TypeScript. Edit authored source and run `npm run compile`; never repair
emitted JavaScript.

The compiler checks every owned module with `strict`, unchecked-index checks,
exact optional properties, complete returns, and unknown caught exceptions.
Library declarations are checked too. Type-aware lint rejects `any`, compiler
suppression comments, unsafe values and narrowing casts, non-null assertions,
floating promises, and incomplete union switches. ESLint suppression comments
cannot disable those rules. A parsed-comment check also rejects native Oxlint
suppression directives before the linter starts; quoted text is not treated as
a directive. Nested lint configs and ignore files cannot exempt owned sources.
Owned code must use `.ts` or `.mts`; other JavaScript and TypeScript extensions
are rejected before linting. This closes the imported `.cts` suppression bypass.
The parsed-source guard also rejects definite-assignment assertions on local
variables and class fields. The recorder now initializes its completion handles
through checked state and resolves child closure directly from the close event.
The guard runs directly from authored TypeScript, so the declared Node range now
matches Vite+: 22.18+ on 22.x, 24.11+ on 24.x, or 26+.
Lint restricts the `assign` property, including
constructor aliases and extracted methods: `Object.assign` does not check
target field compatibility. Lua's typed binding and target operations have
specific names. There are no blanket casts or index-signature game entities.

Compilation checks types and lint before emitting. Tests, development, browser
builds, generators, and scoring invoke it first. CI runs the behavior command
for main pushes and pull requests. The watcher stops its previous process before
compiling changed sources and restarts only after success. It watches browser
test sources too. Metadata-only events on configuration files no longer cause
rebuild loops when npm reads its manifest. Shutdown waits for owned children.

The runtime has concrete hero, monster, object, map, Lua, property, command,
and resumed-input contracts. Initialization phases and meaningful absences
remain explicit. External JSON starts as `unknown` and is validated before use.
Save format is **22**, and bones format is **9**; older formats are rejected.
Restore validates before changing live state and preserves graph identity.
Every `GameState` field must belong to exactly one persistence group. The
transient field table exhaustively checks the keys left out of persistent
state, so new fields cannot silently omit their save policy. This caught the
previously unclassified Cleaver swing-direction flag; it is transient, matching
the native static local. Saving after a Cleaver attack now succeeds.

Saved maps must have the native dimensions, and saved hero, race, monster,
disguise, corpse, statue, and figurine species must index their metadata tables.
Object type indices are checked too. Native absent-species sentinels remain
valid where the field allows them. Loadstone selected counts and mimic fruit or
altar values retain their native meanings. Invalid values are rejected before
installing restored state, including invalid species inside saved monster traits.

## Current batch: measurement oracles and hidden-state fixes

Four instruments now measure the port beyond first differences. See
`docs/oracles.md`:

- `rng-function-table.mjs` attributes verified random calls and blame to
  each C function. The ledgers in `docs/ledger/` record the 49 fully verified
  eval functions and the 81 fully verified public functions. CI checks the
  public ledger.
- `state-oracle.mjs` re-records sessions with a probe recorder
  (`nethack-c/probe/`). The probe adds a game-state digest and clang
  coverage; the official recorder is unchanged. The oracle reports the first
  input whose state differs from C, next to the first random-call and screen
  differences.
- `state-oracle.mjs coverage` lists the C functions the corpus executes and
  flags those never named in `src/js`.
- `check-measurement-guard.mts` now runs in lint. It rejects recorded seeds
  and session identifiers in game sources and hashes the measurement sources
  for a CI secret.

The engine accepts an optional `observeInput` callback. Play ignores it.
`triage-holdout` and `state-oracle` share one corpus lock. `public` triage no
longer needs the local dev sample.

The first state-oracle run found 27 hidden-state sessions: the state differed
before any visible difference. Five of them came from one defect. Native
`sp_lev.c:create_object()` passes every object that is not a container
content through `stackobj()`, then lighting, then burial. The port skipped
the stacking step, so identical corpses that themed rooms place on one square
stayed separate objects. `mklev.ts` now follows the native tail, including
monster-carried objects, which native still stacks against the floor pile.
Two new behavior cases cover it; the stacking case fails without the fix.

### Hidden-state fixes

After the stacking fix, the oracle still found 22 sessions whose state
differed before any visible difference. All 22 are now fixed, each against
its whole native mechanic:

- **Lethal monster hits:** `monmove.ts` clamped the hero's HP at 0. Native
  `mhitu.c:mdamageu()` subtracts the full hit and clamps only down to the
  maximum, so HP stays negative through `done_in_by()`'s pager.
  `monster_attack_death.ts` now commits zero HP and the mortality count
  where `done()` does: after the death announcement, before `done()`'s own
  message window.
- **Pet pickups:** native `dog_invent()` prints "picks up" while the object
  is still on the floor, then extracts it and calls `mpickobj()`. The port
  extracted it during move computation. `commitPetPickup()` now runs after
  the message in the presenter. The split-off piece stays in the floor pile
  beside the original, as native `splitobj()` leaves it.
- **Corpse rot timing:** `moves` is 0 while the first level is built.
  Native `start_corpse_timeout()` ages a corpse from `max(moves, 1)`, but
  `start_timer()` counts from `moves` itself, so corpses made then rot one
  turn earlier. The port used `max(moves, 1)` for both.
- **Demon princes:** native `makemon()` makes a bribe-demanding prince
  peaceful and permanently invisible even under `MM_ANGRY`, unless the hero
  wields Excalibur or Demonbane. A raven is born peaceful to a hero wielding
  a bec de corbin. The port had neither rule.
- **Rolling-boulder traps:** the launch search now follows native
  `find_random_launch_coord()` and `isclearpath()`. Any `ZAP_POS` terrain,
  pools and lava included, may lie on the path; closed or locked doors
  block it; only the launch square must not be pool or lava.

New behavior tests cover each fix. Each fails without its fix. Three
existing tests needed their setup corrected:
- The two Asmodeus ray tests now anger the native-peaceful prince and let
  the hero see invisible.
- The pet ownership test now completes the pickup transaction with
  `commitPetPickup()` and checks that the dagger stays on the floor until
  then.

## Parallel batches 1–7 (`6b76d8c`)

Units ran in worktrees under `docs/orchestration.md` (Codex; each diff reviewed
by Codex against the C source, then merged only if the full suite adds no
failure). Batches 1–2 (`3280bae`): rank-title, levelgen-rng, rng-tail-2/3,
engrave-command, special-level-display, small-messages, end-of-game,
extra-boulder, object-naming, save-luck (`dosave0()` luck undo), suite-fixes.
Batch 3:
- **levelgen-gaps**: `mktrap()` kind rejection order; `create_monster()`
  explicit-alignment roamers through `mk_roamer()`.
- **rng-tail-4**: `distfleeck`, `hitmu` and other batch-1 random-call tails;
  monster contact effects (`mhitm_ad_were`, sleep, polymorph), trapped doors.
- **extcmds**: missing extended commands, bulk take-off. Open review findings
  went to wear-gaps.
- **hero-status**: status-line refresh, HP regeneration and AC timing.
- **messages-2**: booby-trapped doors, `An` articles, Tourist `Aloha`, corpse
  rot naming, rock traps, gnome wake-up.
- **hearing**: heard, smelled, and felt messages with their native conditions.
- **messages-3**: pickup merge feedback, special-damage hits, paranoid
  confirmations, Warning reveals, stealth rings, level-teleport message order.

Batch 4: **tty-menus** (`wintty.c` menus, prompts, choice suffixes, message
suppression; it also fixed the long-failing shapechanger intrinsic-menu test),
**birth-attitude** (`makemon()` species switch: co-aligned unicorns peaceful,
orcs hostile to elves), **wear-gaps** (`do_wear.c` review findings),
**map-memory** (remembered floor and walls, light-source vision refresh).

Batch 5: **tty-regressions** (native message erasure at engulfing, autopickup
menus, terrain exit), **object-gaps** (grapple/whip pickup, kick feedback and
gold scatter, fall killers, `maybe_wail()`, headstones, `#genocided`),
**monster-display** (glyph identity for redraws, `I` markers, cursor),
**rng-tail-5** (`role_init`, `moveloop_core`, `dmgval`, `obj_resists`,
`place_lregion`).

Batch 6: **monster-birth** (`set_malign()` at birth, `AT_HUGS` grabbing and
holding), **display-regressions** (hero and pet redraws suppressed by the new
glyph identity), **rng-mmove** (`m_move()` goal and tie-break rolls),
**rng-levelgen-2** (corridors, mazes, kelp, monster weapons, corpse chance),
**rng-combat** (`hitmu` damage paths, `dochug` gates, mind-flayer blast order).

Batch 7: **messages-4** (message, status and prompt details; status redraw
measures the current load), **map-cells** (native pit, night, x-ray and Rogue
vision; blind touch mapping; redraw suppression during level construction;
death-description fields), **burden-fix** (a merge had restored a `bot()` call
after batch pickup that native `pickup()` lacks, showing "Burdened" a screen
early in nine sessions).

## Verification

`npm test` at `6b76d8c`: **7,949/7,949**. Merges require a fully green suite;
batch runs also compare matched screens per session with the previous batch
(no screen regression in batch 7 after burden-fix).

## Most recent native diagnostics

| Diagnostic | Complete | Matched screens | Matched random calls | Crashes |
| --- | ---: | ---: | ---: | ---: |
| Public | 22/44 | 8,597/11,405 | 620,282/792,838 | 0 |
| Native eval sample | 258/300 | 47,115/50,586 | 3,456,102/3,616,669 | 0 |

Runs: `.cache/generalization/batch7-6b76d8c-{eval,public}` in the verify
worktree (baseline `base-06d7e73`: 143/300; batch 6: 241/300). No verified
random call was lost; the ledgers now hold 175 eval and 120 public functions.
The state oracle finds 275 sessions matching C state throughout; two
hidden-state sessions remain.

## Next work

In flight: rng-monsters-2 (monster-action random-call tails, pet swap with
ball and chain), messages-5 (message and status details), public-msgs and
public-rng (first differences in the public set, which has not moved since
batch 5), rng-singles (corpse timers, ice fumbling, a missing xorn). Coverage
shows that `read.c`, `potion.c`, and `pray.c` are barely exercised; add
scenario recipes there.

`splitObjectStack()` now links the new piece right after the original in
whichever chain owns it (floor pile, hero or monster inventory, container,
buried, migrating, or bill list), like native `splitobj()`. Callers extract it
the way their native counterparts do, and their ad hoc linking is gone.
`rejoinObjectStack()` follows `unsplitobj()`: only carried, monster-carried, and
contained halves that share one chain rejoin. As a result, cancelling a
royal-jelly rub from a stack loses the freed lump, as it does natively.
Floor sacrifices now use `useupf()` (`delobj()`'s `obj_resists()` roll).
Container take-out never splits a loadstone. Eval and public results, both
ledgers, and the state oracle (`split-after`) are unchanged. Open source gaps
nearby:
- Grappling hook and bullwhip snag through a simplified pickup. Native
  `pickup_object()` runs `lift_object()` on the whole stack before splitting.
- Kicked objects lack the "Whee!" slide message and the gold-scatter branch.
- `useupf()` re-hides a hiding hero; the port only unhides.
- Hero gold has its own split (`detachHeroGold()`), outside this helper.

The remaining HP-clamping hero-damage sites now go through `loseHeroHp()`
with native killers and formats: sitting on a spike or in/on lava, falling
rock, magic-trap explosion (now two messages around the damage), rolling
boulder (through the `thitu()` port, with half-physical damage, `nomul` and
`stop_occupation`), bag-of-holding explosion (message printed before the
blast), a coin tossed upward (`toss_up()` damage, `udaminc`, and helmet
messages), and iron-golem rust (polymorphed path, so `mh` may go negative
before rehumanizing). `hero_damage_death.test.ts` covers each death. The
eval and public runs (`losehp-*`) and the state oracle are unchanged and
both ledgers hold: no corpus session reaches these deaths.

The native `wintty.c` menu owner (create/add/end/select/process, about 1,000
lines) still needs a faithful port with its 20 callers moved onto the native
window API. Do it as its own batch.

## Remaining full-port work

Continue from the earliest shared native/JavaScript difference and read the
whole owning C/Lua mechanic. Shared implementations and passing behavior tests
do not establish completeness.

A concrete next source review is inventory-menu placement. Development case
`c069e440-4d93-44de-8339-cb4287ebf85b.session.json` now matches all **3,030**
random calls and **11/12** screens. Its old near-miss difference is gone; the
first remaining difference is input 10. Native places the Weapons heading and
katana inventory line at column 25; TypeScript places them at column 35. Review
the whole shared menu width/origin owner and its caller's item descriptions.
Do not add padding or case-specific positioning to match this recording.
Source review finds that both placement formulas agree at these widths and
that Samurai startup sets the real primary, alternate, and quiver masks.
The next observable check is all six menu rows and each side's longest row,
then that object's knowledge, quantity, mask, and slot identity. The native
position implies a 53-character longest row versus 43 in TypeScript.

Separately, the shared `windows.ts` layout still hardcodes terminal dimensions,
omits `menu_overlay`, and inconsistently handles native half-screen limits,
multiselect page origins, truncation, and pager widths. Review the whole native
`wintty.c` menu owner after identifying the differing row above; these source
gaps alone do not explain that particular offset.

Continue the naming caller/dependency review. Invalid leash references and
missing bills still need native `impossible()` output at an awaited boundary;
the synchronous formatter currently cannot publish those diagnostics. Native
bulk takeoff state is also absent, so dressing annotations cover the implemented
single-object delayed action. Several other callers retain local vowel-only
article checks and need source review. Broader shopkeeper pickup speech and the
deaf list-price path remain incomplete.

The tourist disaster cursor mismatch remains open. Its random stream and
screen cells match, but three cursor positions differ; review the shared prompt
owner before changing it. Do not add case-specific cursor behavior.

The inventory display boundary is implemented; continue reviewing remaining
`getobj()` callers, admission rules, and typed-count handling against their
whole native functions. Ranged slot dispatch, shared pet combat, forced steed
attacks, monster movement permissions, and door/bar actions likewise need
continued caller/dependency review. Passing behavior tests do not establish
completeness. Astral `gain_guardian_angel()` still needs its arrival caller.

The genocide `?` listing still needs the shared native insight/menu owner;
its one-line list is incomplete. Other known gaps include host-system mail,
hardcoded final attribute descriptions, custom starting-pet names, and a caller
review of `keepdogs(TRUE)` for end-game handling and `#wizmakemap`.

Run one full suite or corpus at a time. Keep ownership of yielded sessions until
exit, and terminate owned children if a check is abandoned. Prefer focused
behavior checks while editing. Frozen adapters can be loaded through
`scripts/lib/frozen-adapters.mjs` without overwriting emitted runtime files.
