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

## Parallel batches 1–31 (`62713ef`)

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

Batch 8: **rng-monsters-2** (monster-action random-call tails; pet swap refusal
while punished), **public-msgs** (public-set messages: bear trap, alternate
weapon, sitting, `#whatis`), **public-rng** (steed speed and combat, bones
ancestors, Lua doors, endgame arrival), **rng-singles** (corpse timers, ice
fumbling, buried zombie timers), **messages-5** (repeat-hit and knockback
messages, encyclopedia lookup, `#adjust`, unread prose paging before prompts),
**batch7-leftovers** (first-turn death feedback before bones creation, which
removed an extra `next_ident()` call in 46 pool sessions; undead rise before the
bones prompt; trap admission; repeated-hit adjacency; hallucinated liquid names).
Units now also target first differences in the 2,500-session holdout-dev pool
outside the eval sample, keeping the sample as the clean check.

Batch 9: **end-plural** (end-of-game summary counts use `plur()`: "1 move",
"1 point"; about 45 pool sessions), **public-msgs-2** (farlook mimic suffixes,
wizard quit prompts, `#whatis` help text, container gold category prompts,
projectile trap reveal), **pool-map** (trap, feature and monster glyphs in the
pool's first map differences).

Batch 10: **pool-events** (vault guard timing, special-room entry, missing
event messages), **pool-rng** (`obj_resists`, `mintrap`, `gethungry`,
`dog_move`, `hitmu` random-call tails), **pool-naming** (pet, terrain, armor
and monster names in messages and farlook). **pool-rng-2** merged after the
batch run (`cba63f7`).

Batch 11: **leftovers-9** (full-stack names in the item-action prompt; earlier
review leftovers), **status-timing** (status conditions and HP shown at C's
`bot()` points; +8 eval sessions), **review-debt** (gold excluded from
`#adjust` and naming, custom fruit encyclopedia entry, DECgraphics altar search,
perceived priest names), **hitmu-special** (special monster attacks),
**pool-msgs-3** (getlin echo width, fire hugs, armor theft by animals and
nymphs, simple wield names, corpse ownership prefixes), **pool-map-2** (poison
death tombstones and killer text, item-action menu entries, hero redraw timing,
monster glyphs).

Batch 12: **pool-rng-3** (pool random-call tails: `obj_resists`,
`collect_coords`, `dog_move`), **review-debt-2** (native payment groups for
contained shop goods, poison-cloud membership across movement and knockback),
**pager-timing** (missing `--More--` pagers before monster turns, delayed armor
removal over level-teleport traps), **public-3** (self-farlook, dip prompt
without gold, saddled steed names; +3 public sessions), **audit-read** (a C
source audit of `read.c`, which the corpus barely runs: scroll light and
darkness on carried lights, charging feedback, genocide choices, wizard
monster creation), **pool-rng-4** (monster-turn random-call tails).

Batch 13: **pool-msgs-4** (armor theft by animals and nymphs with native
`stealarm()` timing, sticking fire hugs, wizard-mode death prompt),
**pool-turns** and **pool-turns-2** (monster turns C takes where JS did
something else: door mimics, covetous artifact tactics, hurtle delays; the
pool's message and `distfleeck` clusters are gone), and C-source audits of
files the corpus barely runs: **audit-pray** (`pray.c`), **audit-potion**
(`potion.c`), **audit-zap** (`zap.c`), **audit-apply** (`apply.c`).

Batch 14: **pool-tail** and **pool-tail-2** (the scattered remaining pool
first differences: killer formats, monster form changes, map and status
rows), **audit-shk** (`shk.c`: payment refusals, damage repair, selling and
credit, hallucinated keepers) and **audit-wear** (`do_wear.c`: every slot's
on/off effects, multi-turn removal, ring-hand prompts).

Batch 15: **public-4** (pager-forcing messages, farlook of unexplored and
underwater squares, typed look symbols; +4 public sessions) and C-source
audits of **audit-uhitm** (`uhitm.c`: polymorphed-hero attacks, passive
responses), **audit-eat** (`eat.c`: corpse and food effects, tins, choking,
hunger), **audit-artifact** (`artifact.c`: invoke powers, special attacks,
touch blasts) and **audit-pickup** (`pickup.c`: refusals, #loot, #tip,
container menus, bag of holding).

Batch 16: C-source audits of **audit-trap** (`trap.c`), **audit-objnam**
(`objnam.c`: naming and the `readobjnam()` wish order), **audit-mon**
(`mon.c`), **audit-invent** (`invent.c`: stacking rules, menus, #adjust) and
**audit-mkobj** (`mkobj.c`). A stacking change dropped native `mergable()`'s
`otrapped` test for poisoned weapons; C stores `opoisoned`, `odiluted` and
`norevive` in shared fields (`obj.h`), so merges now compare each alias.

Batch 17: **pool-tail-3** and **pool-tail-4** (the remaining pool random-call
and screen tails: AC after draining rings, Ludios walls, sensed monsters on
relocation, pet pickup memory, hallucinated projections), C-source audits of
**audit-wizcmds** (`wizcmds.c`), **audit-botl** (`botl.c` and tty status
shortening) and **audit-pager** (`pager.c`: look, whatis, help), and
**review-debt-4** (accepted review findings). The eval sample now matches
every random call.

Batch 18: C-source audits of **audit-cmd** (`cmd.c`: prefixes, counts,
command recall, extended commands, travel menus) and **audit-lock**
(`lock.c`: door strength rolls, lock picking, forcing, wand effects),
**public-5** (hallucinated projections, floor-pile windows, getpos
messages), **pool-tail-5** (the last pool tails), and **review-debt-5**.
public-5's floor-pile change exposed that `lift_object()` never cleared its
burden question (`pickup.c`); that is fixed. The eval sample and the pool now
complete every session.

Batch 19: C-source audits of **audit-hack** (`hack.c`: movement, running,
boulders, arrival effects), **audit-kick** (`dokick.c`), **audit-mhitu**
(`mhitu.c`: monster attacks on the hero) and **audit-dig** (`dig.c`:
digging, holes, burial), and **review-debt-6** (accepted review findings).

Batch 20: C-source audits of **audit-monmove** (`monmove.c`), **audit-mhitm**
(`mhitm.c`: monster-versus-monster combat), **audit-muse** (`muse.c`:
monster item use) and **audit-dog** (`dog.c`, `dogmove.c`), **public-6**
(option help, a hidden-monster attack order) and **review-debt-7**. Two
Mitre tests read the host clock through `night()`/`midnight()`; they now pin
noon, and test-clock is making every fresh test game use a fixed date.
seed2200-wizard-quaff-zap-read matches every random call but differs at
the option-help screen, which prints the recording host's configuration
file path; that path is not part of the session input.

Batch 21: C-source audits of **audit-timeout** (`timeout.c`: countdown
dialogues, light sources, egg hatching, timers), **audit-polyself**
(`polyself.c`: polymorph, form abilities) and **audit-do** (`do.c`:
dropping, stairs, level changes), and **test-clock** (every fresh test game
uses a fixed date; the suite passes with the host clock at midnight and
noon).

Batch 22: C-source audits of **audit-spell** (`spell.c`), **audit-sounds**
(`sounds.c`: ambient sounds, #chat), **audit-splev** (`sp_lev.c` and the
level scripts) and **audit-steal** (`steal.c`), and **review-debt-8**. One
review-debt-8 commit routed sense messages through the `You_hear()` helper
but dropped the callers' own `!Deaf` checks; a deaf, unconscious hero then
dreamt of door sounds and 7 pool sessions diverged. It was reverted
(`8ec7722`) and is being redone with every native caller guard kept.

Batch 23: **sensory-helpers** (the redone `You_hear()`/`You_see()`/
`You_feel()` routing with every native caller guard kept), C-source audits
of **audit-quest** (`quest.c`, `questpgr.c`, Oracle consultations) and
**audit-priest** (`priest.c`, `vault.c`), and **review-debt-9**.

Batch 24: C-source audits of **audit-makemon** (`makemon.c`),
**audit-mkmaze** (`mkmaze.c`, fumaroles), **audit-fountain**
(`fountain.c`/`sit.c`), **audit-music** (`music.c`), **audit-weapon**
(`weapon.c`/`wield.c`) and **audit-ball** (`ball.c`).

Batch 25: C-source audits of **audit-engrave** (`engrave.c`),
**audit-detect** (`detect.c` detection, searching and mapping) and
**audit-teleport** (`teleport.c`), and **review-debt-10** (underlay-aware
terrain predicates in place of raw `IS_POOL()`-style type tests).

Batch 26: C-source audits of **audit-region** (`region.c` gas clouds and
`explode.c`), **audit-mcastu** (`mcastu.c` monster spells and `wizard.c`),
**audit-steed** (`steed.c` and `were.c`) and **audit-attrib** (`attrib.c`
and `exper.c`).

Batch 27: C-source audits of **audit-throw** (`dothrow.c`/`mthrowu.c`),
**audit-mkroom** (`mkroom.c` special rooms) and **audit-worn** (`worn.c`
and `do_name.c`), and **review-debt-11** (the accepted review queue; most
items were already fixed by later audits).

Batch 28: **throw-return** (native `boomhit()` boomerang flight and the
aklys/Mjollnir return and catch rolls) and C-source audits of
**audit-write** (`write.c`, `rumors.c`), **audit-end** (`end.c` death,
life saving and disclosure), **audit-light** (`light.c`) and
**audit-dungeon** (`dungeon.c` level bookkeeping and the overview).

Batch 29: C-source audits of **audit-minion** (`minion.c`, `mplayer.c`),
**audit-mklev** (`mklev.c` niches, graves, vaults and trap choice),
**audit-rip** (`rip.c`/`topten.c` end-of-game screens) and **audit-vision**
(`vision.c`).

Batch 30: C-source audits of **audit-dogmove** (`dogmove.c`) and
**audit-shknam** (`shknam.c`), plus fixes found by scoring 1,250 freshly
recorded native sessions (**opus-1**, **opus-2**, **fresh-a**): per-turn
teleportitis, Strained overexertion, drowning while riding, look_here shared by
autopickup and `:`, monster fire-blast death causes, trap missile naming,
newman message joining, bear-trap and land-mine display.

Batch 31: fixes found by scoring 1,250 more fresh native sessions
(fresh5–8, recipe1) and **recipe-expansion** recipes: per-turn slippery-hands
item loss (`glibr()`), the "; slippery)" glove suffix, full-screen piles with
`!menu_overlay`, one-page "(end)" enlightenment footers, cursed invisibility
redraw order, `makewish()`'s verbose offer, interrupting an engulfed hero
from outside (`mattacku()`'s `nomul(0)`), `scores:` option parsing
(**audit-options**), trap reveal display (**trap-reveal**), and warning versus
remembered-monster glyphs (**fresh-b**).

Batch 32–33: fixes found by scoring 7,200 fresh native sessions
(fresh32–55; 54 failures, all fixed except step-0 DST artifacts): falling
rock names, unseen hurtle bumps and iron bars stopping hurtles
(`goodpos()`), passive paralysis wake messages, glove removal clearing
slippery hands, CLR_BLACK as dark gray, see-invisible self display,
knockback releasing a held hero, hallucinated trap names, polymorph clothing
at birth, the starting pet tracked only by `startingpet_mid` (dead pets no
longer break saving), fatal hits ending the game before `stop_occupation()`,
every `Norep()` comparing pline's previous message rather than the joined top
line, coin weight in `carry_count()`, and the starting pet avoiding scary
squares through `makemon()`'s placement. The menu-audit and moverock units
landed alongside.

Batch 34: fixes from fresh56–89 (10,200 sessions; remaining failures are
long-worm tail attacks, owned by the worm-tail unit, and step-0 moon-phase
artifacts from the recorder's time zone): boulder-push effort messages and
the starting pet's identity as unsaved state, shuffled object materials (a
glass wand shatters "into a thousand pieces"), a seen monster's armor burning
in a fire ray before the possessions roll, the slime countdown leaving the
status line alone, `set_utrap()`'s status refresh (InLava at once) and lava
teaching onlookers fire resistance, `fire_damage()` naming with `Yname2()`,
the starting pet's hit points through `newmonhp()`, and `mon_nam()` for spent
rock traps and land-mine triggers. The encumber-owner and halluc-display
units landed alongside.

Batch 35: **worm-tail** (`wormhitu()`: every tail segment next to the hero
makes its own `mattacku()`, with range still measured from the head) and
**naming-sweep** (corpse-revival messages with native `The()`/`upstart()`
casing, and remaining callers moved onto the shared object and monster
namers).

Batch 36: **persist-audit**. Every persistent `GameState` field was checked
against `savegamestate()`, `savelev()` and the saved/instance globals; 48 that
model unsaved C state (helplessness and its callbacks, prayer and
digestion callbacks, noise and push throttles, `oldcap`, `lastinvnr`,
`hero_seq`, special-level caches, startup guards) are now transient, so a
restored game recomputes them as native does. `SAVE_VERSION` is 34.

Batch 37: fixes from fresh101–110: a rust trap names the struck head with
`mbodypart(HEAD)` (a lichen's cap area), and a snapping aklys tether is erased
by `tmp_at(DISP_END, 0)` before "You hear a loud snap!".

Batch 38: fresh121-140 fixes and units. Gem probabilities follow
`setgemprobs()` for the current depth on new levels, cached-level returns and
restored games; a drowning hero's status is drawn before `done()` zeroes hit
points; a monster-thrown acid potion kills through `monkilled(AD_ACID)` ("is
destroyed!") and holy water through `killed()`, as `POTHIT_OTHER_THROW`
requires; **fountain-quaff** (blessed wished fountains, off-map watchmen in
`dryup()`); **wizcast** (`#wizcast` casting without energy, learning, hunger or
practice).

Batch 39: **menu-callers** (native menu heading styles, `tty_end_menu()`
prompts, wizard identify class shortcuts); **displace-move** (displacing a pet
or peaceful runs `domove_core()`'s shared `DO_MOVE` checks, so a boulder under
the displaced monster is pushed before the swap); `goto_level()`'s early
`obj_delivery(FALSE)` lands trap-door objects that fell with the hero before
followers arrive and its late `obj_delivery(TRUE)` handles the rest (C's
`!near_hero ^ MIGR_WITH_HERO` test).

Batches 40-41: **status-refresh** (`carrying_too_much()`'s `nomul(0)` requests the
full status redraw); **expel-turn**; **halluc-display-rng**,
**halluc-display-2** and **halluc-display-3** (display-stream draws: glob and
trap-death redraws, `mintrap()` redraws left to `dochug()`/`flooreffects()`,
and target names that `dobuzz()`/`hit()` never print); **shop-entry-block**
(`u_entered_shop()` warnings, mattock identification, the keeper's extra
`dochug()`); **nomul-owner** (one `setMulti()` owner, so combat waking a
sleeper lets a knockback's `nomul(-range)` wake the hero); **displace-followup**
(teleport traps during a pet swap count as abuse); **fire-slime-order**
(`mhitm_ad_fire()` destroys and ignites items before curing slime);
**artifact-hit-hero** (`artifact_hit()` with the hero as defender, for monster
weapons); **firetrap-turn** (`catch_lit()` identifies oil and exercises
Wisdom); and monster hurtles now end with `mintrap(FORCEBUNGLE)`, which keeps
the known-trap avoidance roll and leaves fliers above floor traps.

## Verification

Merges require a fully green suite (12,446/12,446 on the latest unit branch);
batch runs also compare matched screens per session with the previous batch
(no screen regression in batches 35-40, eval, public or pool).

## Most recent native diagnostics

| Diagnostic | Complete | Matched screens | Matched random calls | Crashes |
| --- | ---: | ---: | ---: | ---: |
| Public | 43/44 | 11,396/11,405 | 792,838/792,838 | 0 |
| Native eval sample | 300/300 | 50,586/50,586 | 3,616,669/3,616,669 | 0 |
| Holdout-dev pool | 2,500/2,500 | | | 0 |

Runs: `.cache/generalization/batch43-cd7f764-{eval,public}` and
`triage-cd7f764` (pool) in the verify worktree (baseline `base-06d7e73`:
143/300; batch 30: 300/300, pool 2,500/2,500). No verified random call was
lost; the ledgers now hold 350 eval and 363 public functions. The
state oracle finds all 300 sessions matching C state throughout.

## Next work

Every eval-sample and pool session completes and public matches every random
call; the one public miss (`seed2200-wizard-quaff-zap-read`) prints the
recorder host's own `.nethackrc` path. New work comes from freshly recorded
native sessions: fresh86-220 (40,500 sessions) fail only on step-0 moon-phase
artifacts plus the cases below. The moon-phase misses are a recorder
artifact: it runs with `TZ=America/New_York`, and
`time_from_yyyymmddhhmmss()` copies `tm_isdst` from the current clock, so a
midnight start date in standard time lands on the previous day. In flight:
**trad-pickup** (the `pickup()` old-style branch and `query_classes()` for
`menustyle:traditional`; JS always opens the pickup menu). Round-2 recipe sessions are recorded in `.cache/holdout-dev/recipe2`.

`splitObjectStack()` now links the new piece right after the original in
whichever chain owns it (floor pile, hero or monster inventory, container,
buried, migrating, or bill list), like native `splitobj()`. Callers extract it
the way their native counterparts do, and their ad hoc linking is gone.
`rejoinObjectStack()` follows `unsplitobj()`: only carried, monster-carried, and
contained halves that share one chain rejoin. As a result, cancelling a
royal-jelly rub from a stack loses the freed lump, as it does natively.
Floor sacrifices now use `useupf()` (`delobj()`'s `obj_resists()` roll).
Container take-out never splits a loadstone. Eval and public results, both
ledgers, and the state oracle (`split-after`) are unchanged. Open source gap
nearby: hero gold has its own split (`detachHeroGold()`), outside this helper.

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

`tty_menu.ts` ports the native `wintty.c` menu window functions
(create/clear/start/add/end/select) and every menu caller (`windows.ts`,
`getpos.ts`, `terrain_view.ts`, `extended_commands.ts`, `naming_categories.ts`,
`o_init.ts`, `wish.ts`, `spell_menu.ts`, `wizard_teleport.ts`) goes through
`tty_select_menu()`; only `tty_menu.ts` lays out pages.

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
