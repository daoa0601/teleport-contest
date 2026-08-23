# Public session status

## Current working-tree checkpoint: 44/44 engine-only, 1,435/1,483 animation frames

Measured 2026-08-24 01:14 EEST from commit `6bb6b5b`, after routing the bounded
Caveman sling volley through shared hero-projectile flight:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The engine-only gate is **44/44 exact** at **36+0.32 ms/turn** (R² 0.829).
One owned process completed in **12.29 seconds** at **530,907,136 bytes maximum
RSS**.  Every public RNG, boundary-screen, and cursor channel remains exact.
Supplemental animation is now **1,435/1,483** exact frames.  Seventeen sessions
are complete on that channel: seed0004 **47/47**, seed0006 **8/8**, seed0012
**49/49**, seed0014 **995/995**, seed0002 **128/128**, seed0016 **4/4**,
seed0030 **40/40**,
seed0104 **2/2**,
seed0108 **4/4**, seed0116 **8/8**, seed0360 **12/12**, seed0361 **10/10**,
seed0383 **1/1**, seed0900 **3/3**, seed1150 **6/6**, seed4500 **37/37**, and
seed5002 **8/8**.
Seed0900 remains a
bounded replay carrier, not a generalized Tourist actor/occupation
implementation.  Seed0014 is no longer partial; the largest remaining reached
partials include seed0017 **20/33** and seed0007 **53/58**.  These counts are
supplemental and do not alter the contest pass result.  Seed0014's cold-ray,
rolling-boulder, delayed-armor and six selected-travel regressions prove exact
native-to-JavaScript frame counts and cursors; this matters because the
supplemental scorer neither compares cursors nor penalizes extra contestant
frames.

The remaining **48** native frames are fully accounted for: seed0017 has13,
the two seed0013 sessions have10 each, seed0106 has6, seed0007 has5, and
seed0060 has4.  This inventory is the next prioritization boundary; seed1150
and seed4500 are no longer residual carriers.

Seed0017's33 frame slots and cursors now all exist, but13 screens still differ
only in interleaved pet state inside its aggregate compatibility replay.  It is
therefore not listed as animation-complete and is not evidence of generalized
Samurai pet scheduling.

The normal frozen-overlay gate was not rerun after this animation-only block;
its latest completed result remains the **44/44** commit-`0dc1776` checkpoint
below.  Nothing was pushed, no workflow or hidden judge ran, and no matching
test process remains.

## Historical supplemental-animation regression: 42/44 engine-only

Measured 2026-08-23 22:21 EEST from commit `f240c68`, immediately after the
first projectile/runmode animation implementation:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The red gate was **42/44 exact** at **34+0.31 ms/turn** in **11.79 seconds** at
**271,777,792 bytes maximum RSS**.  Seed0030 retained exact
**105,529/105,529 RNG and 1,953/1,953 cursors** but fell to **1,943/1,953
screens**; seed0108 retained exact **16,958/16,958 RNG and 303/303 cursors**
but fell to **302/303 screens**.  No other session regressed.

Bounded comparison falsified the initial stale-topline theory.  Both failures
were temporary projectile placement: JavaScript moved the glyph onto the hero
before `thitu()` had discharged the pending launch/hit/death pagers, while C
retains the last pre-hero flight cell until that transaction returns.  The
checkpoint is preserved here as negative evidence, not acceptance.

## Previous verified checkpoint: 44/44 engine-only and normal

Measured 2026-08-23 22:05 EEST from commit `0dc1776`, after removing duplicate
monster speed-potion discovery credit:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
bash frozen/score.sh
```

The engine-only gate is **44/44 exact** at **34+0.30 ms/turn** (R² 0.841).
One owned process completed in **11.73 seconds** at **265,519,104 bytes maximum
RSS**.  All public RNG, screen, and cursor channels are exact.

The normal frozen-overlay compatibility gate subsequently passes **44/44** at
**29+-0.00 ms/turn**, completing in **8.26 seconds** at **203,554,816 bytes
maximum RSS**.  It ran only after the engine process exited.  The generated
`js/terminal.js` and `js/storage.js` overlays were restored from their verified
clean `HEAD` versions; `js/isaac64.js` was already identical.  No scorer or
test process remains.

This is the current local working-tree checkpoint, not a published commit or
official held-out result.  Nothing was pushed, no GitHub workflow was
dispatched, and the official hidden judge was not invoked.  Custom seed52 and
seed211 carriers remain separately exact at793/793 screens/cursors with40/40
and4/4 native animation frames.

## Current working-tree engine-only gate: 43/44 exact

Measured 2026-08-23 21:54 EEST from commit `b0d723f`, after completing
underfoot monster pickup through postmov:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The result is **43/44 exact** at **36+0.31 ms/turn** (R² 0.845).  One owned
process completed in **12.11 seconds** at **266,518,528 bytes maximum RSS**
and left no matching process.  Seed0030 is newly exact at
**105,529/105,529 RNG and 1,953/1,953 screens/cursors**; no accepted session
regressed.

The sole non-exact session is:

| Session | RNG | Screens | Cursors | Current earliest interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0399` | 10,224/11,409 | 117/532 | 454/532 | input117 missing opening `distfleeck/m_move` block and `C` glyph |

Seed0399 is now the only public engine-only recovery target.  The normal
fixture-enabled corpus remains deferred until engine-only reaches44/44.
Nothing was pushed, submitted, or run against the official held-out judge.

## Current working-tree engine-only gate: 42/44 exact

Measured 2026-08-23 21:47 EEST from commit `852238b`, after closing
seed4500's intrinsic, silent-takeoff, and random-polymorph presentation blocks:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The result is **42/44 exact** at **40+0.34 ms/turn** (R² 0.844).  The one
owned process completed in **13.60 seconds** at **266,616,832 bytes maximum
RSS** and left no matching process.  Seed4500 is newly exact at
**108,275/108,275 RNG and 1,814/1,814 screens/cursors**; no accepted session
regressed.

The two remaining non-exact sessions are:

| Session | RNG | Screens | Cursors | Current earliest interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0030` | 29,810/105,529 | 1,911/1,953 | 1,945/1,953 | segment2/input47 missing `rn2(20) @ m_move` |
| `seed0399` | 10,224/11,409 | 117/532 | 454/532 | input117 missing opening actor block and `C` glyph |

Seed0030's bounded m_move branch is the next recovery target.  The normal
fixture-enabled corpus remains deferred while engine-only is red.  Nothing was
pushed, submitted, or run against the official held-out judge.

## Current working-tree engine-only gate: 41/44 exact

Measured 2026-08-23 21:30 EEST from commit `b4042ac`, after restoring
`MMOVE_DONE`'s trailing `distfleeck` and weapon-tool enchantment naming:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The result is **41/44 exact** at **41+0.34 ms/turn** (R² 0.840).  The single
owned process completed in **13.74 seconds** at **264,978,432 bytes maximum
RSS** and left no matching process.  Seed0360 and seed0361 are newly exact;
no previously accepted session regressed.

| Recovered session | RNG | Screens | Cursors |
| --- | ---: | ---: | ---: |
| `seed0360` | 120,639/120,639 | 833/833 | 833/833 |
| `seed0361` | 53,865/53,865 | 366/366 | 366/366 |

The three current non-exact sessions are:

| Session | RNG | Screens | Cursors | Current earliest interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0030` | 29,810/105,529 | 1,911/1,953 | 1,945/1,953 | segment2/input47 missing `rn2(20) @ m_move` |
| `seed0399` | 10,224/11,409 | 117/532 | 454/532 | input117 missing opening actor block |
| `seed4500` | 50,318/108,275 | 594/1,814 | 1,293/1,814 | input577 missing second debug-intrinsic timeout line |

The next recovery target is seed4500's bounded intrinsic-timeout continuation.
The normal fixture-enabled corpus remains deferred while engine-only is red.
Nothing was pushed, submitted, or run against the official held-out judge.

## Current working-tree engine-only gate: 39/44 exact

Measured 2026-08-23 21:16 EEST from commit `c379dde`, after recovering
seed0002's pickup-status boundary and inactive-only monster everyturn visits:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The result is **39/44 exact** at **49+0.29 ms/turn** (R² 0.710).  One owned
process completed in **13.32 seconds** at **268,861,440 bytes maximum RSS**;
the post-run registry is empty.  No previously green session regressed.

Recovered since the 36/44 gate:

| Session | RNG | Screens | Cursors |
| --- | ---: | ---: | ---: |
| `seed0002` | 27,158/27,158 | 595/595 | 595/595 |
| `seed0367` | 50,125/50,125 | 324/324 | 324/324 |
| `seed0383` | 16,915/16,915 | 219/219 | 219/219 |

The five current non-exact sessions are:

| Session | RNG | Screens | Cursors | Current earliest interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0030` | 29,718/105,529 | 1,903/1,953 | 1,936/1,953 | segment2/input35 missing `distfleeck` |
| `seed0360` | 110,869/120,639 | 695/833 | 745/833 | input673 missing `distfleeck` after m_move |
| `seed0361` | 22,205/53,865 | 243/366 | 279/366 | input236 missing `distfleeck` |
| `seed0399` | 10,224/11,409 | 117/532 | 454/532 | input117 missing actor `distfleeck/m_move` block |
| `seed4500` | 50,272/108,275 | 581/1,814 | 905/1,814 | input577 debug-intrinsic continuation |

The normal fixture-enabled corpus was not run because engine-only remains red.
The next recovery block is the shared actor-admission/`distfleeck` family in
the first four sessions; seed4500 remains a separate presentation/scheduler
transaction.  Nothing was pushed, submitted, or run against the official
held-out judge.

## Current working-tree engine-only regression: 36/44 exact

Measured 2026-08-23 20:56 EEST from commit `b229ec0`, after closing the
seed52/seed211 animation and tutorial-window blocks:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The result is a red **36/44 exact** gate at **42+0.25 ms/turn**
(R² 0.751).  It completed as one owned process in **11.52 seconds** at
**266,305,536 bytes maximum RSS** and left no matching scorer or test process.
The normal fixture-enabled gate was not run.

| Session | RNG | Screens | Cursors | Animation | Current interpretation |
| --- | ---: | ---: | ---: | ---: | --- |
| `seed0002` | 27,158/27,158 | 594/595 | 595/595 | 0/128 | one screen-only regression; first recovery target |
| `seed0030` | 29,718/105,529 | 1,903/1,953 | 1,936/1,953 | 0/40 | multi-segment RNG/presentation regression |
| `seed0360` | 37,861/120,639 | 218/833 | 411/833 | 0/12 | world-tour RNG/presentation regression |
| `seed0361` | 22,205/53,865 | 243/366 | 279/366 | 6/10 | Archeologist-tour RNG/presentation regression |
| `seed0367` | 35,869/50,125 | 272/324 | 297/324 | 0/0 | Priest-tour RNG/presentation regression |
| `seed0383` | 10,470/16,915 | 141/219 | 162/219 | 0/1 | hallucinated Wizard RNG/presentation regression |
| `seed0399` | 10,224/11,409 | 117/532 | 454/532 | 0/0 | hallucinated-actions RNG/presentation regression |
| `seed4500` | 50,272/108,275 | 581/1,814 | 905/1,814 | 0/37 | Knight coverage RNG/presentation regression |

This gate contradicts the older accepted/public checkpoints below and is not
publishable.  The seed52 and seed211 custom carriers remain independently
exact, but they do not substitute for public regression recovery.  Work must
proceed from each session's earliest divergence, starting with seed0002's
single screen.  Nothing was pushed, submitted, or run against the official
held-out judge.

### Focused recovery after the gate: seed0002 exact

Commit `d1109b1` repairs seed0002's sole input221 status cell by committing the
new encumbrance label only after the capacity message returns across tty's
pickup pager.  The complete focused scorer is now **27,158/27,158 RNG and
595/595 screens/cursors**.  Four neighboring pickup/encumbrance controls pass
**4/4**.

This focused result proves seed0002 recovery but does not replace the measured
36/44 corpus or justify reporting37/44.  The other seven red sessions remain
open, and another full engine-only gate is deferred until additional focused
recovery warrants it.

## Current publish checkpoint: 43/44 engine-only, 44/44 normal

Measured 2026-08-01 17:22 EEST from checkpoint branch commit `81f84f3`,
after restoring the shared nearby-wake calls and preventing the generic live
role scheduler from preempting the tutorial scheduler:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
bash frozen/score.sh
```

The engine-only result is **43/44 exact** at **47+0.37 ms/turn** (R2 0.824).
All gameplay RNG streams are exact.  The sole residual is
`seed0383-wizard-hallucinate`: **16,915/16,915 RNG calls** and **218/219
screens/cursors**, with input 173 rendering hallucinated `ogre king` where C
renders `black pudding` after expulsion.  This is a one-screen display-stream
regression and remains open; it is not hidden-readiness evidence.

The normal fixture-enabled scorer is **44/44 exact** at **35+0.00 ms/turn**.
It masks that engine-only residual and therefore remains only the public
compatibility gate.  The two complete gates ran serially as separately owned
processes and both exited normally; no duplicate or abandoned suite remained.
`frozen/score.sh`'s generated `js/terminal.js` and `js/storage.js` copies were
restored from the checkpoint before publication.

Checkpoint `81f84f3` was pushed to `daoa0601/teleport-contest` `main`.  The
active Score workflow did not enqueue from the push event, so run
`30703718684` was dispatched manually against the same commit.  It completed
successfully in 30 seconds and independently reported **44/44**, **100.0% RNG**
and **77+0.01 ms/turn**.  The official held-out judge remains asynchronous and
is not represented by this public Actions result.

## Latest engine-only regression gate: 44/44 exact

Measured 2026-07-31 20:49 EEST from the current working tree based on
`4e04bd9`, after closing the seed0004 bear-trap/capacity lifecycle,
seed1800 blocked-dart/fobj ownership, and seed5002 raw-fatal-status
regressions:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The result is **44/44 exact** at **37+0.32 ms/turn** (R² 0.846).  The three
sessions reopened by the preceding 41/44 corpus are exact again:

| Session | RNG | Screens | Cursors |
| --- | ---: | ---: | ---: |
| `seed0004` | 12,084/12,084 | 409/409 | 409/409 |
| `seed1800` | 2,458/2,458 | 26/26 | 26/26 |
| `seed5002` | 12,167/12,167 | 410/410 | 410/410 |

The gate ran as one owned process, was retained and polled through normal
exit, and completed in **12.85 seconds** at **268,255,232 bytes maximum
RSS**.  The pre- and post-run registries were empty; no duplicate verifier
was launched or abandoned.

This is a complete public engine-only regression gate, not evidence of
held-out generalization.  The normal fixture-enabled suite was not run because
nothing is being published at this checkpoint.  Nothing was staged,
committed, pushed, submitted, or run against held-out sessions.

## Latest engine-only regression gate: 41/44 exact

Measured 2026-07-31 20:14 EEST from the current working tree based on
`4e04bd9`, after the seed0014/seed0030 focused closures and the seed0006,
seed0399, and seed4500 regression repairs:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The result is a red **41/44 exact** gate at **37+0.31 ms/turn** (R² 0.845).
Seed0014 is newly exact at **59,178/59,178 RNG calls and 714/714
screens/cursors**.  Seed0030 is newly exact at **105,529/105,529 RNG calls and
1,953/1,953 screens/cursors**.  Seed0006, seed0399, and seed4500 retain their
complete exactness.

Three previously accepted sessions reopened:

| Session | RNG | Screens | Cursors | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0004` | 12,084/12,084 | 384/409 | 408/409 | screen/cursor regression; earliest boundary pending |
| `seed1800` | 2,386/2,458 | 12/26 | 26/26 | RNG/screen regression; earliest boundary pending |
| `seed5002` | 12,167/12,167 | 396/410 | 410/410 | screen-only regression; earliest boundary pending |

The gate ran as one owned cell with sequential per-session subprocesses and
exited normally in **12.83 seconds** at **459,882,496 bytes maximum RSS**.
Cell2204 was polled to completion, the post-run registry was empty, and no
duplicate verifier was launched.  The normal fixture-enabled suite was not
run after this red result.  Nothing was staged, committed, pushed, submitted,
or run against held-out sessions.

## Latest engine-only regression gate: 42/44 exact

Measured 2026-07-30 17:30 EEST from the current working tree based on
`4e04bd9`, after closing seed0367's single FAST-provenance screen:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The result is **42/44 exact** at **40+0.26 ms/turn** (R² 0.740), superseding
the 41/44 checkpoint immediately below.  Seed0367 is exact at
**50,125/50,125 RNG calls and 324/324 screens/cursors**.  Seed0360 remains
exact, and every other accepted public session stays green.

The two current non-exact sessions are:

| Session | RNG | Screens | Cursors | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0014` | 2,970/59,178 | 26/714 | 107/714 | fountain/exploration frontier |
| `seed0030` | 6,560/105,529 | 52/1,953 | 469/1,953 | multi-role death/restart frontier |

The gate ran as one owned cell with sequential per-session subprocesses and
exited normally in **11.97 seconds** at **207,126,528 bytes maximum RSS**.
The yielded cell was polled to completion; no duplicate runner was launched
and no process survived.  The normal fixture-enabled suite was deliberately
not run after this red engine-only result.  Nothing was staged, committed,
pushed, submitted, or run against held-out sessions.

## Latest engine-only regression gate: 41/44 exact

Measured 2026-07-30 17:26 EEST from the current working tree based on
`4e04bd9`, after closing seed0360 through all 833 states:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The result is **41/44 exact** at **41+0.26 ms/turn** (R² 0.725), superseding
both the red 21/44 checkpoint below and the older accepted 38/44 baseline.
Seed0360 is exact at **120,639/120,639 RNG calls and 833/833
screens/cursors**.  Every other previously accepted public session remains
exact.

The three current non-exact sessions are:

| Session | RNG | Screens | Cursors | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0014` | 2,970/59,178 | 26/714 | 107/714 | fountain/exploration frontier |
| `seed0030` | 6,560/105,529 | 52/1,953 | 469/1,953 | multi-role death/restart frontier |
| `seed0367` | 50,125/50,125 | 323/324 | 324/324 | one screen-only Priest-tour residual |

The gate ran as one owned cell with sequential per-session subprocesses and
exited normally in **12.08 seconds** at **206,143,488 bytes maximum RSS**.
The yielded cell was polled to completion; no duplicate runner was launched
and no process survived.  The normal fixture-enabled suite was deliberately
not run after this red engine-only result.  Nothing was staged, committed,
pushed, submitted, or run against held-out sessions.

## Latest engine-only regression gate: 21/44 exact

Measured 2026-07-30 06:18 EEST from the current working tree based on
`4e04bd9`, after closing seed0108 with a complete per-input engine-only
regression:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The result is a red **21/44** regression gate at **40+0.25 ms/turn**
(R² 0.795), not a replacement for the accepted **38/44** baseline.
Seed0108 is exact at **16,958/16,958 RNG calls and 303/303 screens**, but
eighteen formerly accepted sessions are screen-only red and two formerly
accepted sessions have reopened RNG divergence.  The three older non-exact
sessions seed0014, seed0030, and seed0360 remain non-exact.

| Session | RNG | Screens | Current interpretation |
| --- | ---: | ---: | --- |
| `seed0002` | 27,158/27,158 | 594/595 | newly reopened; one screen |
| `seed0004` | 9,859/12,084 | 290/409 | newly reopened RNG and presentation |
| `seed0007` | 16,373/16,373 | 300/302 | newly reopened; two screens |
| `seed0014` | 2,970/59,178 | 26/714 | existing fountain/exploration frontier |
| `seed0015` | 8,563/8,563 | 43/44 | newly reopened; one screen |
| `seed0016` | 3,656/3,656 | 35/36 | newly reopened; one screen |
| `seed0017` | 3,465/3,465 | 66/67 | newly reopened; one screen |
| `seed0030` | 6,550/105,529 | 52/1,953 | existing multi-life frontier |
| `seed0060` | 3,626/3,626 | 40/41 | newly reopened; one screen |
| `seed0077` | 3,242/3,242 | 32/33 | newly reopened; one screen |
| `seed0101` | 2,371/2,371 | 26/27 | newly reopened; one screen |
| `seed0102` | 4,485/4,485 | 24/25 | newly reopened; one screen |
| `seed0116` | 12,562/12,562 | 117/127 | newly reopened; screen-only |
| `seed0360` | 3,103/120,639 | 163/833 | existing world-tour frontier |
| `seed0361` | 53,865/53,865 | 350/366 | newly reopened; screen-only |
| `seed0367` | 3,514/50,125 | 192/324 | newly reopened RNG and presentation |
| `seed0373` | 35,386/35,386 | 111/124 | newly reopened; screen-only |
| `seed0383` | 16,915/16,915 | 216/219 | newly reopened; screen-only |
| `seed0501` | 2,238/2,238 | 27/28 | newly reopened; one screen |
| `seed0700` | 3,230/3,230 | 50/51 | newly reopened; one screen |
| `seed1150` | 3,137/3,137 | 50/51 | newly reopened; one screen |
| `seed1500` | 2,768/2,768 | 39/40 | newly reopened; one screen |
| `seed4500` | 108,275/108,275 | 1,784/1,814 | newly reopened; screen-only |

The gate ran as one owned cell with sequential per-session subprocesses,
iterative RNG comparison, and a 45-second worker timeout.  It exited zero in
**11.99 seconds** at **201,195,520 bytes maximum RSS** and left no surviving
runner.  The normal fixture-enabled suite was deliberately not run after this
red result.  Nothing was staged, committed, pushed, submitted, or run against
held-out sessions.

## Current measured engine-only gate: 38/44 exact

Measured 2026-07-29 06:18 EEST from the current working tree based on
`4e04bd9`, after closing seed4500's remaining Knight goal, attributes, and
floor-look blocks and repairing the resulting shared tty regressions:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The result is **38/44 exact** at **37+0.23 ms/turn** (R² 0.826).
Seed4500 is newly exact at **108,275/108,275 RNG calls and 1,814/1,814
screens/cursors**.  Every session in the accepted 37-session baseline remains
exact.

The 6 current non-exact sessions are:

| Session | RNG | Screens | Cursors | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0014` | 2,970/59,178 | 26/714 | 108/714 | fountain/exploration frontier |
| `seed0030` | 6,550/105,529 | 52/1,953 | 469/1,953 | multi-role death/restart frontier |
| `seed0108` | 2,795/16,958 | 30/303 | 158/303 | extended-command/object-use frontier |
| `seed0360` | 3,222/120,639 | 177/833 | 369/833 | world-tour generation/inventory frontier |
| `seed0361` | 3,073/53,865 | 147/366 | 192/366 | Archeologist tour wish/object frontier |
| `seed0373` | 2,595/35,386 | 58/124 | 88/124 | Barbarian special-level frontier |

The first post-seed4500 audit was a red **34/44** result: seed0006,
seed0007, and seed0009 had one-column disclosure geometry regressions, while
seed0399 skipped a same-contact death pager after `WIN_STOP`.  Shared
38/39-column tty disclosure ownership and the earlier-actor versus
same-contact death split restore all four without reopening seed4500.

This is public engine-only evidence, not held-out evidence.  The
fixture-enabled suite has not yet been rerun at this checkpoint.  Nothing was
staged, committed, pushed, submitted, or run against held-out sessions, so
the leaderboard cannot reflect this working tree.

## Current measured engine-only gate: 37/44 exact, accepted baseline restored

Measured 2026-07-28 21:40 EEST from the current working tree based on
`4e04bd9`, after replacing seed1150's duplicate legacy/typed starting-flint
discovery with one typed source owner and rerunning the complete
fixture-disabled gate:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The result is **37/44 exact** at **26+0.31 ms/turn** (R² 0.761).  Seed1150
is restored to exact at **3,137/3,137 RNG calls and 51/51
screens/cursors**, so there are no exact-session regressions relative to the
accepted baseline.  Seed4500 remains engine-only exact through input
**1002**; input **1003** is the next verified frontier.

The 7 current non-exact sessions are:

| Session | RNG | Screens | Cursors | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0014` | 2,970/59,178 | 26/714 | 108/714 | fountain/exploration frontier |
| `seed0030` | 6,550/105,529 | 52/1,953 | 396/1,953 | multi-role death/restart frontier |
| `seed0108` | 2,797/16,958 | 32/303 | 184/303 | extended-command/object-use frontier |
| `seed0360` | 3,095/120,639 | 164/833 | 345/833 | world-tour frontier |
| `seed0361` | 3,077/53,865 | 145/366 | 190/366 | tour wish/object frontier |
| `seed0373` | 2,594/35,386 | 58/124 | 88/124 | Barbarian special-level frontier |
| `seed4500` | 87,536/108,275 | 1,003/1,814 | 1,287/1,814 | exact through input 1002; input 1003 next |

The explicitly ordered normal public gate subsequently passes **44/44**:

```sh
node frozen/ps_test_runner.mjs sessions
```

That compatibility result includes fixtures and is not evidence of
engine-only generalization.  The engine-only 37/44 measurement remains the
acceptance witness.  Nothing was staged, committed, pushed, submitted, or
run against held-out sessions, so the leaderboard cannot reflect this
working tree.

## Current measured engine-only gate: 36/44 exact, one regression open

Measured 2026-07-28 21:32 EEST from the current working tree based on
`4e04bd9`, after recovering the six exact sessions reopened by the 31/44
audit and running the required complete fixture-disabled gate:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The result is **36/44 exact** at **27+0.31 ms/turn** (R² 0.751).  All six
sessions reopened by the prior audit are exact again:
`seed0009`, `seed0107`, `seed0367`, `seed0383`, `seed0399`, and `seed0501`.
However, this remains a red regression result rather than a replacement for
the accepted **37/44** checkpoint: seed1150 retains complete RNG and cursor
parity but differs on one decoded screen.  Seed4500 is exact through input
**1002** engine-only; input **1003** is the next known divergence.

The 8 current non-exact sessions are:

| Session | RNG | Screens | Cursors | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0014` | 2,970/59,178 | 26/714 | 108/714 | existing fountain/exploration frontier |
| `seed0030` | 6,550/105,529 | 52/1,953 | 396/1,953 | existing multi-role death/restart frontier |
| `seed0108` | 2,797/16,958 | 32/303 | 184/303 | existing extended-command/object-use frontier |
| `seed0360` | 3,095/120,639 | 164/833 | 345/833 | existing world-tour frontier |
| `seed0361` | 3,077/53,865 | 145/366 | 190/366 | existing tour wish/object frontier |
| `seed0373` | 2,594/35,386 | 58/124 | 88/124 | existing Barbarian special-level frontier |
| `seed1150` | 3,137/3,137 | 50/51 | 51/51 | newly reopened; one screen-only mismatch |
| `seed4500` | 87,536/108,275 | 1,003/1,814 | 1,287/1,814 | exact through input 1002; input 1003 next |

The phase-four range correction recovered both seed0383 and seed0399 in the
broad run, while the tutorial arrival, extended-command completion,
move-scoped random-monster alignment, starting-object identity/discovery, and
waterbody naming corrections recovered the other four.  The next priority is
the single seed1150 screen before extending seed4500 beyond input 1002 or
opening another non-exact session.

This is public engine-only evidence, not held-out evidence.  The normal
fixture-enabled suite has not yet been rerun after this gate.  Nothing was
staged, committed, pushed, or submitted, so the leaderboard cannot reflect
this working tree.

## Current engine-only checkpoint: 37/44 exact, ball/chain movement mapped

Measured 2026-07-24 04:26 EEST from the working tree based on `4e04bd9` after
closing seed4500's punishment movement transaction through input 520 and
rerunning the complete fixture-disabled gate:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The result remains **37/44 exact** at **42+0.16 ms/turn** (R² 0.718), with no
exact-session regression.  Seed4500's authoritative focused prefix now
matches every RNG slice, decoded screen, and cursor through input **520**.
Its full-session positional aggregate is **50,156/108,275 RNG,
522/1,814 screens, and 825/1,814 cursors**.  The lower downstream cursor
aggregate is not treated as a regression claim: after the first mismatch,
later positional matches are not prefix evidence.

The 7 remaining non-exact sessions are:

| Session | RNG | Screens | Cursors | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0014` | 2,970/59,178 | 26/714 | 108/714 | fountain/exploration frontier |
| `seed0030` | 6,562/105,529 | 48/1,953 | 395/1,953 | multi-role death/restart frontier |
| `seed0108` | 2,792/16,958 | 28/303 | 182/303 | extended-command/object-use frontier |
| `seed0360` | 3,205/120,639 | 177/833 | 373/833 | world-tour frontier |
| `seed0361` | 3,060/53,865 | 147/366 | 194/366 | tour wish/object frontier |
| `seed0373` | 2,594/35,386 | 58/124 | 88/124 | Barbarian special-level frontier |
| `seed4500` | 50,156/108,275 | 522/1,814 | 825/1,814 | exact through input 520; discoveries pager input 521 next |

`js/ball.js` now owns `drag_ball()` geometry and the two-phase
`move_bc(before/after)` floor transaction.  `mklev.js` supplies the shared
identity-preserving `remove_object()`/`place_object()` pair; `cmd.js` brackets
the hero coordinate and vision commit with those calls.  Dragging both
objects installs the source two-turn negative-multi delay, whose turn-90
maintenance exposed and now uses shared `allmain.c:regen_pw()` logic.  The
attached chain is excluded from `check_here()` counts, while the ball retains
its source `very heavy iron ball (chained to you)` description.

The focused scheduler suite passes **111/111**.  This is public engine-only
evidence, not held-out evidence.  The normal fixture-enabled suite was not
rerun at this checkpoint.  Nothing was staged, committed, pushed, or
submitted, so the leaderboard still cannot reflect this working tree.

## Current engine-only checkpoint: 37/44 exact, regression set recovered

Measured 2026-07-24 04:02 EEST from the working tree based on `4e04bd9` after
auditing the five regressions opened by the spellbook checkpoint, repairing
their shared death-transaction owners, and rerunning the complete
fixture-disabled gate:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The result is **37/44 exact** at **38+0.19 ms/turn** (R² 0.807).  Seed0002,
seed0004, seed0006, seed0007, and seed0012 are restored to exact engine-only
scores.  The seed4500 focused replay is again exact through input 490, and its
full-session aggregate remains **50,034/108,275 RNG, 493/1,814 screens, and
1,166/1,814 cursors**.

The 7 remaining non-exact sessions are:

| Session | RNG | Screens | Cursors | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0014` | 2,970/59,178 | 26/714 | 111/714 | fountain/exploration frontier |
| `seed0030` | 6,562/105,529 | 48/1,953 | 395/1,953 | multi-role death/restart frontier |
| `seed0108` | 2,792/16,958 | 28/303 | 182/303 | extended-command/object-use frontier |
| `seed0360` | 3,205/120,639 | 177/833 | 373/833 | world-tour frontier |
| `seed0361` | 3,060/53,865 | 147/366 | 194/366 | tour wish/object frontier |
| `seed0373` | 2,594/35,386 | 58/124 | 88/124 | Barbarian special-level frontier |
| `seed4500` | 50,034/108,275 | 493/1,814 | 1,166/1,814 | exact through input 490; identify-scroll input 491 next |

The four RNG regressions shared one source boundary:
`xkilled()->corpse_chance()`.  Species `G_NOCORPSE` suppresses
`make_corpse()` but does not suppress the ordinary corpse-probability call.
Conversely, `bigmonst()` and the other guaranteed corpse classes return before
that roll.  The seed0006 screen-only regression was independent: the
water-demon attack message read a stale scalar instead of the dagger stack in
`minvent`.

This restores the accepted public engine-only baseline; it does not establish
held-out readiness.  The normal public compatibility suite was not rerun
after this correction.  Nothing was staged, committed, pushed, or submitted,
so the public leaderboard still cannot reflect this working tree.

## Current engine-only checkpoint: 32/44 exact, regression audit opened

Measured 2026-07-24 03:51 EEST from the working tree based on `4e04bd9` after
closing seed4500 inputs 474--490 (wished-spellbook study and failed casting),
then running the complete fixture-disabled gate:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The result is **32/44 exact** at **37+0.18 ms/turn** (R² 0.795).  The focused
seed4500 replay is exact through input 490, and the independent
`seed0501-priest-cast-read-turn` control remains exact at **2,238/2,238 RNG
and 28/28 screens/cursors**.  However, this corpus result is not accepted as a
replacement for the prior 37/44 baseline: five formerly exact sessions are
red and must be recovered before new broad readiness claims.

The 12 non-exact sessions are:

| Session | RNG | Screens | Cursors | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0002` | 4,696/27,158 | 35/595 | 139/595 | exact-session regression; earliest divergence audit required |
| `seed0004` | 6,552/12,084 | 192/409 | 245/409 | exact-session regression; earliest divergence audit required |
| `seed0006` | 6,736/6,736 | 122/123 | 123/123 | one screen-only regression |
| `seed0007` | 15,665/16,373 | 278/302 | 290/302 | exact-session regression; earliest divergence audit required |
| `seed0012` | 11,289/13,878 | 210/308 | 237/308 | exact-session regression; earliest divergence audit required |
| `seed0014` | 2,970/59,178 | 26/714 | 111/714 | existing fountain/exploration frontier |
| `seed0030` | 6,562/105,529 | 48/1,953 | 395/1,953 | existing multi-role death/restart frontier |
| `seed0108` | 2,792/16,958 | 28/303 | 182/303 | existing extended-command/object-use frontier |
| `seed0360` | 3,205/120,639 | 177/833 | 373/833 | existing world-tour frontier |
| `seed0361` | 3,060/53,865 | 147/366 | 194/366 | existing tour wish/object frontier |
| `seed0373` | 2,594/35,386 | 58/124 | 88/124 | existing Barbarian special-level frontier |
| `seed4500` | 50,034/108,275 | 493/1,814 | 1,166/1,814 | advanced exact prefix through input 490; next input 491 |

The regression set is `seed0002`, `seed0004`, `seed0006`, `seed0007`, and
`seed0012`.  The spellbook block is not yet implicated: the first four do not
exercise the newly added study transaction, and its separate Priest casting
control remains exact.  Nevertheless, attribution requires per-step earliest
divergence measurements rather than subsystem inference.  Recover this set
before treating the seed4500 frontier advance as an accepted corpus gain.
These are public engine-only diagnostics, not held-out evidence.  Nothing was
staged, committed, pushed, or submitted.

## Current engine-only checkpoint: 37/44 exact, seed0383 accepted

Measured 2026-07-22 23:23 EEST from the working tree based on `4e04bd9` after
closing seed0383, repairing the fatal-line regressions, and restoring bones
hero-track plus follower-display layering, then running the required full
fixture-disabled gate:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The result is **37/44 exact** at **40+0.18 ms/turn** (R² 0.764).  Seed0383
joins the exact set at **16,915/16,915 RNG and 219/219 screens/cursors**.
Seed5006 is restored at **13,923/13,923 and 249/249**, and every session in
the preceding 36-session exact set remains exact.

The 7 remaining non-exact sessions are:

| Session | RNG | Screens | Cursors | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0014` | 2,970/59,178 | 26/714 | 111/714 | fountain/exploration scheduler breadth |
| `seed0030` | 6,562/105,529 | 48/1,953 | 395/1,953 | multi-role death/restart breadth |
| `seed0108` | 2,792/16,958 | 28/303 | 182/303 | extended-command/object-use frontier |
| `seed0360` | 3,175/120,639 | 177/833 | 365/833 | apply/source move-amount frontier |
| `seed0361` | 3,079/53,865 | 147/366 | 194/366 | tour wish/object frontier |
| `seed0373` | 2,595/35,386 | 58/124 | 88/124 | Barbarian special-level generation |
| `seed4500` | 6,501/108,275 | 4/1,814 | 876/1,814 | Knight startup/coverage breadth |

The next priority is the earliest first-divergence boundary across these seven,
measured from exact per-step replay rather than aggregate positional matches.
These are public engine-only diagnostics, not held-out evidence.  The working
tree has not been staged, committed, pushed, or submitted, so the public
leaderboard still cannot reflect this checkpoint.

## Current engine-only checkpoint: 36/44 exact, seed5002 accepted

Measured 2026-07-22 18:08 EEST from the working tree based on `4e04bd9` after
closing seed5002 and repairing cross-actor fatal-status ownership, then
running the required full fixture-disabled gate:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The result is **36/44 exact** at **42+0.15 ms/turn** (R² 0.664).  Seed5002
joins the exact set at **12,167/12,167 RNG and 410/410 screens/cursors**;
seed0007 is restored at **16,373/16,373 and 302/302**.  Every previously exact
session remains exact.

The 8 remaining non-exact sessions are:

| Session | RNG | Screens | Cursors | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0014` | 2,970/59,178 | 26/714 | 111/714 | fountain/exploration scheduler breadth |
| `seed0030` | 6,562/105,529 | 48/1,953 | 395/1,953 | multi-role death/restart breadth |
| `seed0108` | 2,792/16,958 | 28/303 | 182/303 | extended-command/object-use frontier |
| `seed0360` | 3,122/120,639 | 177/833 | 362/833 | apply/source move-amount frontier |
| `seed0361` | 3,079/53,865 | 147/366 | 194/366 | tour wish/object frontier |
| `seed0373` | 2,595/35,386 | 58/124 | 88/124 | Barbarian special-level generation |
| `seed0383` | 2,501/16,915 | 44/219 | 151/219 | hallucination/special-level generation |
| `seed4500` | 2,987/108,275 | 4/1,814 | 538/1,814 | Knight startup/coverage breadth |

The next priority is the earliest remaining shared boundary, seed0383 call
2,501, with seed0373 call 2,595 as the adjacent C/Lua generation control.
These are public engine-only diagnostics, not held-out evidence.  The working
tree has not been staged, committed, pushed, or submitted, so the public
leaderboard still cannot reflect this checkpoint.

## Current engine-only checkpoint: 35/44 exact, one-session swap under repair

Measured 2026-07-22 18:00 EEST from the working tree based on `4e04bd9` after
the `find_mac()`, fatal monster-counterattack, empty-`doeat()`, and fatal-status
transaction work, then running the required full fixture-disabled gate:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The full result remains **35/44 exact**.  `seed5002` is newly exact at
**12,167/12,167 RNG and 410/410 screens/cursors**, but `seed0007` lost two
HP-only frames while retaining **16,373/16,373 RNG and 302/302 cursors**.
The exact-session set therefore swaps `seed5002` in and `seed0007` out; this
is not yet an accepted net gain.

The 9 non-exact sessions and their measured positions are:

| Session | RNG | Screens | Cursors | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0007` | 16,373/16,373 | 300/302 | 302/302 | fatal-contact status projection only |
| `seed0014` | 2,970/59,178 | 26/714 | 140/714 | fountain/exploration scheduler breadth |
| `seed0030` | 6,562/105,529 | 48/1,953 | 394/1,953 | multi-role death/restart breadth |
| `seed0108` | 2,792/16,958 | 28/303 | 182/303 | extended-command/object-use frontier |
| `seed0360` | 3,122/120,639 | 177/833 | 367/833 | apply/source move-amount frontier |
| `seed0361` | 3,079/53,865 | 147/366 | 194/366 | tour wish/object frontier |
| `seed0373` | 2,595/35,386 | 58/124 | 89/124 | Barbarian special-level generation |
| `seed0383` | 2,501/16,915 | 44/219 | 151/219 | hallucination/special-level generation |
| `seed4500` | 2,987/108,275 | 4/1,814 | 536/1,814 | Knight startup/coverage breadth |

All other historical exact controls remain exact.  The immediate priority is
to recover `seed0007` from the earliest shared C tty transaction, rerun the
focused death controls, and repeat this full gate.  These are public
engine-only diagnostics, not held-out evidence.  Nothing was staged,
committed, pushed, or submitted.

## Current engine-only checkpoint: 35/44 exact, two frontiers advanced

Measured 2026-07-22 16:54 EEST from the working tree based on `4e04bd9` after
porting the fire-ray traversal/inventory/death transaction and charged
starting-ring adjustment, then running the required full fixture-disabled
gate:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The full result remains **35/44 exact** at **45+0.16 ms/turn** (R² 0.67), with
no exact-session regression.  These sessions are exact:

`seed0002`, `seed0004`, `seed0006`, `seed0007`, `seed0009`, `seed0012`, both
`seed0013` sessions, `seed0015`--`seed0017`, `seed0060`, `seed0077`,
`seed0101`--`seed0107`, `seed0116`, `seed0200`, `seed0367`, `seed0398`,
`seed0399`, `seed0501`, `seed0700`, `seed0900`, `seed1150`, `seed1500`,
`seed1800`, `seed2200`, `seed2600`, `seed5006`, and `seed8000`.

The 9 non-exact sessions and their measured positions are:

| Session | RNG | Screens | Cursors | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0014` | 2,970/59,178 | 26/714 | 140/714 | fountain/exploration scheduler breadth |
| `seed0030` | 6,574/105,529 | 48/1,953 | 394/1,953 | multi-role death/restart breadth |
| `seed0108` | 2,792/16,958 | 28/303 | 182/303 | extended-command/object-use frontier |
| `seed0360` | 3,173/120,639 | 177/833 | 367/833 | apply eligibility, then source move-amount timing |
| `seed0361` | 3,079/53,865 | 147/366 | 194/366 | tour wish/object frontier |
| `seed0373` | 2,600/35,386 | 58/124 | 89/124 | Barbarian special-level generation |
| `seed0383` | 2,501/16,915 | 44/219 | 151/219 | hallucination/special-level generation |
| `seed4500` | 2,984/108,275 | 4/1,814 | 536/1,814 | Knight startup/coverage breadth |
| `seed5002` | 8,749/12,167 | 128/410 | 184/410 | second-game themed-room Lua generation |

The exact-session count is unchanged, but seed0360 advances by 295 RNG calls
and 150 screens, while seed5002 advances by 2,833 RNG calls and 36 screens
from the preceding full checkpoint.  Seed5002's first game is now completely
exact; its next divergence is in second-game `themerms.lua` selection
filtering.  These are public engine-only diagnostics, not held-out evidence.
The leaderboard still evaluates pushed commit `4e04bd9`; the working tree has
not been staged, committed, pushed, or submitted.

## Historical engine-only checkpoint: 35/44 exact

Measured 2026-07-22 16:40 EEST from the working tree based on `4e04bd9` after
restoring favorable-prayer topline/completion ordering and running the required
full fixture-disabled gate:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The full result is **35/44 exact** at **41+0.15 ms/turn** (R² 0.699).  These
sessions are exact:

`seed0002`, `seed0004`, `seed0006`, `seed0007`, `seed0009`, `seed0012`, both
`seed0013` sessions, `seed0015`--`seed0017`, `seed0060`, `seed0077`,
`seed0101`--`seed0107`, `seed0116`, `seed0200`, `seed0367`, `seed0398`,
`seed0399`, `seed0501`, `seed0700`, `seed0900`, `seed1150`, `seed1500`,
`seed1800`, `seed2200`, `seed2600`, `seed5006`, and `seed8000`.

The 9 non-exact sessions and their measured positions are:

| Session | RNG | Screens | Cursors | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0014` | 2,970/59,178 | 26/714 | 140/714 | fountain/exploration scheduler breadth |
| `seed0030` | 6,574/105,529 | 48/1,953 | 394/1,953 | multi-role death/restart breadth |
| `seed0108` | 2,792/16,958 | 28/303 | 182/303 | extended-command/object-use frontier |
| `seed0360` | 2,878/120,639 | 27/833 | 328/833 | world-tour generation/inventory frontier |
| `seed0361` | 3,079/53,865 | 147/366 | 194/366 | tour wish/object frontier |
| `seed0373` | 2,600/35,386 | 58/124 | 89/124 | Barbarian special-level generation |
| `seed0383` | 2,501/16,915 | 44/219 | 151/219 | hallucination/special-level generation |
| `seed4500` | 2,984/108,275 | 4/1,814 | 536/1,814 | Knight startup/coverage breadth |
| `seed5002` | 5,916/12,167 | 92/410 | 147/410 | beam/zap physics frontier |

Seed0116 is recovered without weakening any of the other 34 exact sessions.
All historically exact public sessions are now restored; the remaining nine
are new subsystem/generation coverage rather than known regressions.  Their
positional match counts are diagnostic only and can shift after an earlier
branch changes.  No hidden suite, push, or submission has run.

## Historical engine-only checkpoint: 34/44 exact

Measured 2026-07-22 16:36 EEST from the working tree based on `4e04bd9` after
repairing the scheduler-to-pet source-turn projection and running the required
full fixture-disabled gate:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The full result is **34/44 exact** at **39+0.16 ms/turn** (R² 0.789).  These
sessions are exact:

`seed0002`, `seed0004`, `seed0006`, `seed0007`, `seed0009`, `seed0012`, both
`seed0013` sessions, `seed0015`--`seed0017`, `seed0060`, `seed0077`,
`seed0101`--`seed0107`, `seed0200`, `seed0367`, `seed0398`, `seed0399`,
`seed0501`, `seed0700`, `seed0900`, `seed1150`, `seed1500`, `seed1800`,
`seed2200`, `seed2600`, `seed5006`, and `seed8000`.

The 10 non-exact sessions and their measured positions are:

| Session | RNG | Screens | Cursors | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0014` | 2,970/59,178 | 26/714 | 140/714 | fountain/exploration scheduler breadth |
| `seed0030` | 6,574/105,529 | 48/1,953 | 394/1,953 | multi-role death/restart breadth |
| `seed0108` | 2,792/16,958 | 28/303 | 182/303 | extended-command/object-use frontier |
| `seed0116` | 12,562/12,562 | 126/127 | 127/127 | exact simulation; one presentation frame remains |
| `seed0360` | 2,878/120,639 | 27/833 | 328/833 | world-tour generation/inventory frontier |
| `seed0361` | 3,079/53,865 | 147/366 | 194/366 | tour wish/object frontier |
| `seed0373` | 2,600/35,386 | 58/124 | 89/124 | Barbarian special-level generation |
| `seed0383` | 2,501/16,915 | 44/219 | 151/219 | hallucination/special-level generation |
| `seed4500` | 3,030/108,275 | 4/1,814 | 844/1,814 | Knight startup/coverage breadth |
| `seed5002` | 5,916/12,167 | 92/410 | 147/410 | beam/zap physics frontier |

Seed0006 is recovered without weakening any exact session.  The same source-
turn repair also realigned all remaining seed0116 RNG calls and cursors; its
sole remaining defect is one deterministic screen frame.  Isolate that frame
before opening a new broad behavior owner.  No hidden suite, push, or
submission has run.

## Historical engine-only checkpoint: 33/44 exact

Measured 2026-07-22 16:27 EEST from the working tree based on `4e04bd9` after
repairing angry-god state projection at the second deity pager and running the
required full fixture-disabled gate:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The full result is **33/44 exact** at **41+0.18 ms/turn** (R² 0.798).  These
sessions are exact:

`seed0002`, `seed0004`, `seed0007`, `seed0009`, `seed0012`, both `seed0013`
sessions, `seed0015`--`seed0017`, `seed0060`, `seed0077`,
`seed0101`--`seed0107`, `seed0200`, `seed0367`, `seed0398`, `seed0399`,
`seed0501`, `seed0700`, `seed0900`, `seed1150`, `seed1500`, `seed1800`,
`seed2200`, `seed2600`, `seed5006`, and `seed8000`.

The 11 non-exact sessions and their measured positions are:

| Session | RNG | Screens | Cursors | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0006` | 2,657/6,736 | 67/123 | 76/123 | formerly exact; live monster divergence, equipment falsified |
| `seed0014` | 2,970/59,178 | 26/714 | 140/714 | fountain/exploration scheduler breadth |
| `seed0030` | 6,554/105,529 | 48/1,953 | 395/1,953 | multi-role death/restart breadth |
| `seed0108` | 2,792/16,958 | 28/303 | 182/303 | extended-command/object-use frontier |
| `seed0116` | 5,763/12,562 | 22/127 | 118/127 | formerly exact; candle exception fixed, residual RNG divergence |
| `seed0360` | 2,878/120,639 | 27/833 | 328/833 | world-tour generation/inventory frontier |
| `seed0361` | 3,079/53,865 | 147/366 | 194/366 | tour wish/object frontier |
| `seed0373` | 2,600/35,386 | 58/124 | 89/124 | Barbarian special-level generation |
| `seed0383` | 2,501/16,915 | 44/219 | 151/219 | hallucination/special-level generation |
| `seed4500` | 3,030/108,275 | 4/1,814 | 844/1,814 | Knight startup/coverage breadth |
| `seed5002` | 5,934/12,167 | 92/410 | 142/410 | beam/zap physics frontier |

Seed5006 is recovered without weakening seed0399.  Only seed0006 and seed0116
remain regressed from the historical 34-session exact set; both now require
source-tagged RNG diagnosis rather than a presentation repair.  No hidden
suite, push, or submission has run.

## Historical engine-only checkpoint: 32/44 exact

Measured 2026-07-22 16:23 EEST from the working tree based on `4e04bd9` after
recovering the conditional fatal-status projection and compact throw-help
candidate set, then running the required full fixture-disabled gate:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The full result is **32/44 exact** at **37+0.16 ms/turn** (R² 0.803).  These
sessions are exact:

`seed0002`, `seed0004`, `seed0007`, `seed0009`, `seed0012`, both `seed0013`
sessions, `seed0015`--`seed0017`, `seed0060`, `seed0077`,
`seed0101`--`seed0107`, `seed0200`, `seed0367`, `seed0398`, `seed0399`,
`seed0501`, `seed0700`, `seed0900`, `seed1150`, `seed1500`, `seed1800`,
`seed2200`, `seed2600`, and `seed8000`.

The 12 non-exact sessions and their measured positions are:

| Session | RNG | Screens | Cursors | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0006` | 2,657/6,736 | 67/123 | 76/123 | formerly exact; live monster divergence, equipment falsified |
| `seed0014` | 2,970/59,178 | 26/714 | 140/714 | fountain/exploration scheduler breadth |
| `seed0030` | 6,554/105,529 | 48/1,953 | 395/1,953 | multi-role death/restart breadth |
| `seed0108` | 2,792/16,958 | 28/303 | 182/303 | extended-command/object-use frontier |
| `seed0116` | 5,763/12,562 | 22/127 | 118/127 | formerly exact; candle exception fixed, residual RNG divergence |
| `seed0360` | 2,878/120,639 | 27/833 | 328/833 | world-tour generation/inventory frontier |
| `seed0361` | 3,079/53,865 | 147/366 | 194/366 | tour wish/object frontier |
| `seed0373` | 2,600/35,386 | 58/124 | 89/124 | Barbarian special-level generation |
| `seed0383` | 2,501/16,915 | 44/219 | 151/219 | hallucination/special-level generation |
| `seed4500` | 3,030/108,275 | 4/1,814 | 844/1,814 | Knight startup/coverage breadth |
| `seed5002` | 5,934/12,167 | 92/410 | 142/410 | beam/zap physics frontier |
| `seed5006` | 13,923/13,923 | 246/249 | 249/249 | formerly exact; late Wisdom/death presentation state |

Seed0004 and seed0007 are recovered without weakening seed0399.  Three
members of the historical 34-session exact set remain regressed: seed0006,
seed0116, and seed5006.  Recovering those witnesses remains the active
priority before publishing.  No hidden suite, push, or submission has run.

## Historical engine-only checkpoint: 30/44 exact

Measured 2026-07-22 16:18 EEST from the working tree based on `4e04bd9` after
class-bounding the generic armor-throw bridge and running the required full
fixture-disabled gate:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The full result is **30/44 exact** at **40+0.18 ms/turn** (R² 0.794).  These
sessions are exact:

`seed0002`, `seed0009`, `seed0012`, both `seed0013` sessions,
`seed0015`--`seed0017`, `seed0060`, `seed0077`, `seed0101`--`seed0107`,
`seed0200`, `seed0367`, `seed0398`, `seed0399`, `seed0501`, `seed0700`,
`seed0900`, `seed1150`, `seed1500`, `seed1800`, `seed2200`, `seed2600`, and
`seed8000`.

The 14 non-exact sessions and their measured positions are:

| Session | RNG | Screens | Cursors | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0004` | 12,084/12,084 | 407/409 | 407/409 | formerly exact; tail Coins-menu layout regression |
| `seed0006` | 2,657/6,736 | 67/123 | 76/123 | formerly exact; live monster divergence, equipment falsified |
| `seed0007` | 16,373/16,373 | 301/302 | 302/302 | formerly exact; fatal-status projection regression |
| `seed0014` | 2,970/59,178 | 26/714 | 140/714 | fountain/exploration scheduler breadth |
| `seed0030` | 6,554/105,529 | 48/1,953 | 395/1,953 | multi-role death/restart breadth |
| `seed0108` | 2,792/16,958 | 28/303 | 182/303 | extended-command/object-use frontier |
| `seed0116` | 5,763/12,562 | 22/127 | 118/127 | formerly exact; candle exception fixed, residual RNG divergence |
| `seed0360` | 2,878/120,639 | 27/833 | 328/833 | world-tour generation/inventory frontier |
| `seed0361` | 3,079/53,865 | 147/366 | 194/366 | tour wish/object frontier |
| `seed0373` | 2,600/35,386 | 58/124 | 89/124 | Barbarian special-level generation |
| `seed0383` | 2,501/16,915 | 44/219 | 151/219 | hallucination/special-level generation |
| `seed4500` | 3,030/108,275 | 4/1,814 | 844/1,814 | Knight startup/coverage breadth |
| `seed5002` | 5,934/12,167 | 92/410 | 142/410 | beam/zap physics frontier |
| `seed5006` | 13,923/13,923 | 246/249 | 249/249 | late screen-only bones/death presentation |

Seed0101 and seed1800 are recovered without weakening seed0399.  Four members
of the historical 34-session exact set remain regressed: seed0004, seed0006,
seed0007, and seed0116.  Recovering those witnesses remains the active
priority before publishing.  No hidden suite, push, or submission has run.

## Historical negative checkpoint: 28/44 exact

Measured 2026-07-22 16:12 EEST from the working tree based on `4e04bd9` after
closing seed0399 locally and running the required full fixture-disabled gate:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The full result is **28/44 exact** at **-90+1.07 ms/turn** (R² 0.432).  These
sessions are exact:

`seed0002`, `seed0009`, `seed0012`, both `seed0013` sessions,
`seed0015`--`seed0017`, `seed0060`, `seed0077`, `seed0102`--`seed0107`,
`seed0200`, `seed0367`, `seed0398`, `seed0399`, `seed0501`, `seed0700`,
`seed0900`, `seed1150`, `seed1500`, `seed2200`, `seed2600`, and `seed8000`.

The 16 non-exact sessions and their measured positions are:

| Session | RNG | Screens | Cursors | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0004` | 12,084/12,084 | 407/409 | 407/409 | formerly exact; tail presentation regression |
| `seed0006` | 2,657/6,736 | 67/123 | 76/123 | formerly exact; live monster/equipment divergence |
| `seed0007` | 16,373/16,373 | 301/302 | 302/302 | formerly exact; fatal-status projection regression |
| `seed0014` | 2,970/59,178 | 26/714 | 140/714 | fountain/exploration scheduler breadth |
| `seed0030` | 6,554/105,529 | 48/1,953 | 395/1,953 | multi-role death/restart breadth |
| `seed0101` | 2,371/2,371 | 15/27 | 27/27 | formerly exact; message presentation regression |
| `seed0108` | 2,792/16,958 | 28/303 | 182/303 | extended-command/object-use frontier |
| `seed0116` | 0/12,562 | 0/127 | 0/127 | formerly exact; runtime error reading index 32 |
| `seed0360` | 2,878/120,639 | 27/833 | 328/833 | world-tour generation/inventory frontier |
| `seed0361` | 3,079/53,865 | 147/366 | 194/366 | tour wish/object frontier |
| `seed0373` | 2,600/35,386 | 58/124 | 89/124 | Barbarian special-level generation |
| `seed0383` | 2,501/16,915 | 44/219 | 151/219 | hallucination/special-level generation |
| `seed1800` | 2,458/2,458 | 11/26 | 26/26 | formerly exact; message presentation regression |
| `seed4500` | 3,410/108,275 | 4/1,814 | 731/1,814 | Knight startup/coverage breadth |
| `seed5002` | 5,938/12,167 | 92/410 | 144/410 | beam/zap physics frontier |
| `seed5006` | 13,923/13,923 | 246/249 | 249/249 | late screen-only bones/death presentation |

This is a negative regression checkpoint, not a readiness claim.  Seed0399
is newly exact, but six sessions from the prior 34/44 exact set regressed.
Recovering those witnesses is the active priority before advancing another
frontier or publishing.  No hidden suite, push, or submission has run.

## Historical engine-only checkpoint: 34/44 exact

Measured 2026-07-22 12:39 EEST from the working tree based on `4e04bd9` after
closing seed0367's complete Priest Quest/world-tour graph, attributes and
property lifetimes, and the shared monster carrying-capacity correction:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

The full fixture-disabled result is **34/44 exact** at
**37+0.17 ms/turn** (R² 0.777).  These sessions are exact:

`seed0002`, `seed0004`, `seed0006`, `seed0007`, `seed0009`, `seed0012`,
both `seed0013` sessions, `seed0015`--`seed0017`, `seed0060`, `seed0077`,
`seed0101`--`seed0107`, `seed0116`, `seed0200`, `seed0398`, `seed0501`,
`seed0700`, `seed0900`, `seed1150`, `seed1500`, `seed1800`, `seed2200`,
`seed2600`, `seed0367`, `seed5006`, and `seed8000`.

The 10 non-exact sessions and their current positional measurements are:

| Session | RNG | Screens | Cursors | Current interpretation |
| --- | ---: | ---: | ---: | --- |
| `seed0014` | 2,970/59,178 | 26/714 | 140/714 | fountain/exploration scheduler breadth |
| `seed0030` | 6,558/105,529 | 48/1,953 | 395/1,953 | multi-role death and restart breadth; positional screen regression recorded |
| `seed0108` | 2,792/16,958 | 28/303 | 182/303 | extcmd now enters object-use handling |
| `seed0360` | 2,965/120,639 | 43/833 | 367/833 | world-tour initial generation/inventory |
| `seed0361` | 3,068/53,865 | 147/366 | 194/366 | live scheduler fixed; next wish/object projection |
| `seed0373` | 2,604/35,386 | 58/124 | 89/124 | barbarian special-level generation |
| `seed0383` | 2,499/16,915 | 44/219 | 151/219 | levelchange fixed; special-level generation |
| `seed0399` | 1,208/11,409 | 1/532 | 384/532 | independent early generation audit |
| `seed4500` | 3,026/108,275 | 4/1,814 | 835/1,814 | independent startup identity/coverage breadth |
| `seed5002` | 5,945/12,167 | 92/410 | 143/410 | Ctrl-G fixed; next beam/zap physics |

This supersedes the 33/44 checkpoint.  Seed0367 is now exact at
**50,125/50,125 RNG and 324/324 screens/cursors**; all 33 previously exact
sessions remain exact.  The capacity correction also preserves seed0004's
complete **12,084/12,084** stream while retaining seed0367's Minend wand
acquisition.  The expanded focused serial gate passes **175/175**.

The full corpus confirms one net exact-session gain with no public exactness
regression.  The subsequent fixture-enabled compatibility suite is **44/44
green**.  Engine-only public exactness remains the regression gate, not
evidence of held-out readiness or a prediction of leaderboard points.

## Historical movement-ration checkpoint

Measured 2026-07-19 15:37 EEST from the working tree based on `a783285` with:

```sh
TELEPORT_DISABLE_FIXTURES=1 node frozen/ps_test_runner.mjs sessions
```

Top-level exact-session fixtures are disabled. Some passing paths still use
older bounded, state-derived bridges; `Exact` therefore means “current
engine-only regression passes,” not “the corresponding subsystem is complete
for unseen inputs.” At this historical checkpoint the result was **25/44
exact**. It is superseded by the July 19 deep-transition checkpoint recorded in
the held-out ledger and journal block 46: **18/44** fixture-disabled and
**37/44** fixture-enabled/hybrid. The table below is retained as a dependency
snapshot, not relabeled as current evidence.

| Public session | Engine-only result | Current interpretation / next cone |
| --- | ---: | --- |
| `seed0002-healer-reflection-drummer` | 2,336/27,158 RNG; 8/595 screens | Broad elapsed-turn combat, reflection/drumming, and animation; start with shared monster scheduler |
| `seed0004-feeding-pony` | 3,718/12,084; 10/409 | Movement allocation and first quiet actor schedule now align; next exact-prefix blocker is pet-object handling inside `dog_move` |
| `seed0006-wizard-water-demon` | 2,525/6,736; 38/123 | First kitten/zombie/rat actor schedule now aligns; next exact-prefix blocker is command/elapsed-turn ordering before combat |
| `seed0007-rogue-snake-swamp` | 69/16,373; 8/302 | Early random chargen/level branch, then swamp and monster behavior; re-audit earliest call |
| `seed0009-swimmer-mforce` | 3,337/3,713; 12/73 | Startup mostly aligned; swimmer/mysterious-force command and transition tail |
| `seed0012-monk-vault-escort` | 0/13,878; 0/308; input queue error | Water-surrounded vault content plus nested input/escort behavior |
| `seed0013-friday13-save-then-fullmoon-restore` | **Exact** 4,804; 99 screens | Save/restore regression witness |
| `seed0013-rogue-friday13-combat` | **Exact** 4,838; 59 | Themed-room/calendar/combat regression witness |
| `seed0014-dequa-fountain-explore` | 2,963/59,178; 10/714 | Fountain events and long monster/turn scheduler |
| `seed0015-valk-level2-pit-dog-wait` | **Exact** 8,563; 44 | Level-two/pit/dog bounded regression witness |
| `seed0016-healer-newmoon-eat-zap` | **Exact** 3,656; 36 | Healer startup/sleep-wake regression witness |
| `seed0017-samurai-altar-pray` | **Exact** 3,465; 67 | Samurai/prayer regression witness |
| `seed0030-ten-diverse-deaths` | 6,413/105,529; 11/1,953 | Multi-role death/endgame breadth; defer until shared scheduler/transition/death cones exist |
| `seed0060-orc-rogue-kick-search` | **Exact** 3,626; 41 | Orc Rogue/startup/kick regression witness |
| `seed0077-rogue-chargen` | **Exact** 3,242; 33 | Manual chargen regression witness |
| `seed0101-ranger-quiver-throw-travel-engrave` | **Exact** 2,371; 27 | Ranger command regression witness |
| `seed0102-ranger-name-cancel` | **Exact** 4,485; 25 | Ranger generation/name/fire regression witness |
| `seed0103-knight-ride-pony` | **Exact** 2,640; 60 | Knight riding regression witness |
| `seed0104-knight-ride-combat` | **Exact** 3,223; 43 | Mounted combat regression witness |
| `seed0105-valk-chat-lamp-ration` | **Exact** 2,499; 30 | Valkyrie startup/chat regression witness |
| `seed0106-priest-extcmd-sweep` | **Exact** 4,194; 267 | Priest extended-command regression witness |
| `seed0107-samurai-twoweapon-enhance` | **Exact** 2,902; 98 | Samurai two-weapon regression witness |
| `seed0108-wizard-extcmd-wishlist` | 2,678/16,958; 0/303 | Extended command breadth plus later turn/transition behavior |
| `seed0116-wizard-wear-shop` | 2,980/12,562; 3/127 | First ordinary level transition; `goto_level` → `getbones` ordering |
| `seed0200-monk-north-search` | **Exact** 3,822; 40 | Monk/static-map/search regression witness |
| `seed0360-wizard-world-tour` | 2,815/120,639; 0/833 | Debug level teleport, special-level generation, arrivals |
| `seed0361-archeologist-tour` | 2,979/53,865; 40/366 | `#levelchange` exact; next debug level teleport/special generation |
| `seed0367-priest-quest-tour` | 1,909/50,125; 1/324 | Quest generation/transition and world-tour breadth; re-audit earliest call |
| `seed0373-barbarian-quest-tour` | 2,549/35,386; 1/124 | `#levelchange` exact; next `#wizlevelport` |
| `seed0383-wizard-hallucinate` | 2,491/16,915; 31/219 | Hallucination state plus ordinary turn/monster behavior |
| `seed0398-wizard-wandpoly-pile` | **Exact** 3,026; 87 | Wish/polymorph regression witness |
| `seed0399-wizard-hallu-actions` | 1,204/11,409; 0/532 | Early startup/generation audit, then hallucination action breadth |
| `seed0501-priest-cast-read-turn` | **Exact** 2,238; 28 | Priest spell regression witness |
| `seed0700-samurai-explore-descend` | **Exact** 3,230; 51 | Samurai exploration/descent regression witness |
| `seed0900-tourist-explore-actions` | **Exact** 2,983; 84 | Tourist actions regression witness |
| `seed1150-caveman-explore-move` | **Exact** 3,137; 51 | Caveman startup/commands regression witness |
| `seed1500-rogue-explore-move` | **Exact** 2,768; 40 | Rogue exploration regression witness |
| `seed1800-tourist-eat-throw` | **Exact** 2,458; 26 | Tourist eat/throw regression witness |
| `seed2200-wizard-quaff-zap-read` | **Exact** 3,018; 230 | Wizard item-command regression witness |
| `seed2600-wizard-custom-binds` | **Exact** 11,647; 38 | Custom binding/debug regression witness |
| `seed4500-knight-coverage` | 2,809/108,275; 3/1,814 | Broad ordinary turn/monster/command coverage; downstream of scheduler |
| `seed5002-wizard-coverage-pair` | 2,493/12,167; 2/410 | Broad Wizard commands, turns, and transitions |
| `seed5006-tourist-stress-disaster` | 4,190/13,923; 2/249 | First ordinary level transition; `goto_level`/bones, then disaster behavior |
| `seed8000-tourist-starter` | **Exact** 3,130; 23 | Startup/tty baseline regression witness |

## Priority clusters

1. **Monster movement and tame AI:** `0002`, `0004`, `0006`, `0014`,
   `0383`, `4500`, and later parts of `5002`.
2. **Ordinary level transitions and bones:** `0116`, `5006`, and likely the
   tail of `0009`.
3. **Themed content:** `0012` Water-surrounded vault.
4. **Debug/special/quest levels:** `0360`, `0361`, `0367`, `0373`.
5. **Independent early audits:** `0007`, `0399`; do not assign them to a
   downstream cone until their first exact RNG mismatch is re-measured.
6. **Breadth regressions:** `0030`, `0108`, `4500`, `5002`; use after shared
   dependency cones land, not as the first implementation targets.
