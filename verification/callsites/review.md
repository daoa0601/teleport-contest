# RNG call-site review

This unit changes verification tools and documentation. It changes no game
mechanics, TypeScript, emitted runtime files, scorer, corpora or ledgers.

The fresh baseline was 2,348 sites: 1,981 constant, 115 guarded, 51 invariant,
201 unproved. The final emitted-source inventory is 2,481 sites: 2,088 constant,
106 guarded, 50 invariant, 237 unproved. It contains 133 previously missed
emitted callback/default calls. Of the original inventory, 36 unproved sites
now classify successfully and 53 old classifications were withdrawn. The latter
reflect guard identity/lifetime checks or unavailable emitted-only facts.

| Class | Before | After, original sites | Additional sites | Final |
|---|---:|---:|---:|---:|
| constant | 1,981 | 1,985 | 103 | 2,088 |
| guarded | 115 | 98 | 8 | 106 |
| invariant | 51 | 47 | 3 | 50 |
| unproved | 201 | 218 | 19 | 237 |

The class table is for lower bounds and explicit division integrality under
the stated numeric/state relation. Upper bounds remain unproved at 339 sites.
It is not a count of universally safe game callers.

| Residual group | Before | After |
|---|---:|---:|
| possibly-empty collection | 25 | 37 |
| count or weight | 27 | 25 |
| dice from data | 21 | 23 |
| spe charges | 11 | 19 |
| hit points | 4 | 6 |
| other | 113 | 127 |

Grouping follows argument terms and available local origins. Groups supply no
solver facts and can change as more origins become visible.

The new reasoning covers inductive nonnegative counters, finite positive
assignments, initializers before their first write, stable nonempty guards,
constant map arithmetic, readonly literal name lookups and string lengths.
The one stronger C-state assumption is the non-Strength attribute range 3..25
from `attrib.c:1199 acurr`, including its equipment/form branches. The previous
monster-level cap of 49 was also corrected: clang resolves `monst.h:104 m_lev`
to an 8-bit unsigned field, so its assumed storage bound is 0..255. Special
creation can exceed level 49. No new legal-attack-table relation is assumed.

`check.py` requires a satisfiable modeled input before calling a site proved.
Nested draw summaries require their own domains. Divisor validity is an
obligation. Bindings distinguish shadowed variables and index variables;
unknown calls invalidate heap reads and mutable captured scalars. Stored
snapshots, later live reads, loop back edges, destructuring writes and
increment evaluation order are handled conservatively. Complex increment
conditions stay unproved rather than being replaced by ordinary algebra.

## Residual native comparison

[`review.tsv`](review.tsv) contains all 237 residual sites, their C owners,
comparison category and remaining obligation. Native function/call locations
were inspected through clang's typed JSON AST with `native_calls.py`;
`dat/nhlib.lua:17 shuffle` supplies the special-level alignment shuffle.
This is manual triage under state/representation correspondence, not a proof
that every native guard or saved continuation establishes that relation.

Candidate list: **no concrete reachable out-of-domain port divergence was
established**. Residual formulas retain the native input preconditions, or
forward arguments unchanged through a port callback. Examples include wand
charge admission, spell/attack-table provenance, live HP, room/region bounds,
weighted populations, callback invokers and loop/carried scalar state. The
counterexamples printed by the checker assign abstract leaves; they are not
claims that those states can occur during play.

`write.ts:112` still needs the parity of `writingCost`: C integer division and
JS division coincide only because current costs are even. `zap.ts:301` uses
the same `while (++delay <= 2000)` and width as C; the residual model value
2050 is a missing sequencing fact, not a demonstrated game state.

## Acceptance

- Complete equivalence command: exit 0, all 28 previous claims PROVED in
  52.59 s, including 31 outside-domain probes and 34 mutants (33 killed,
  one intentionally equivalent). The full timing table is below.
- Analyzer behavior tests: 10 passed in 1.330 s. They include invalid-domain
  probes, a zero-dice boundary, nine independent emitted-only mutants,
  mutation/alias lifetime checks, shadowing, builtin identity, captured state,
  and ordered increment reads.
- Source-wide invalid-domain mutants: 2,243 killed, zero failures. The gate
  checks lower bounds, except `rnz`, where it checks the upper domain. One
  `rnz` upper bound is already unproved and is not counted as a killed claim.
- No Contest test suite or session/corpus run was performed, as instructed.
  No `src/` files changed, so compilation was not required. No call-site ledger
  exists in this worktree; ledger changes remain with `fv-ci`.

| Command | Wall seconds |
|---|---:|
| healthy emitted extraction | 110.70 |
| lower + upper classifier | 3.57 |
| in-memory JS mutant extraction | 117.90 |
| source-wide mutant gate | 6.67 |
| analyzer behavior tests | 1.330 |
| complete equivalence proof, probes and mutants | 52.59 |

The machine was shared with other units; these are observed wall times.
All generated diagnostics are under `.cache/fv-callsites-*`.

| Claim | Result | Seconds |
|---|---|---:|
| `rn2` | PROVED | 0.3 |
| `rnd` | PROVED | 0.1 |
| `rn1` | PROVED | 0.5 |
| `rnl` | PROVED | 0.9 |
| `d` | PROVED | 0.3 |
| `rne` | PROVED | 1.1 |
| `rnz` | PROVED | 4.1 |
| `rn2_on_display_rng` | PROVED | 0.1 |
| `distmin` | PROVED | 0.3 |
| `dist2` | PROVED | 1.3 |
| `enermod` | PROVED | 4.4 |
| `newuexp` | PROVED | 1.3 |
| `xlev_to_rank` | PROVED | 0.3 |
| `rounddiv` | PROVED | 0.6 |
| `Align2amask` | PROVED | 0.5 |
| `Amask2align` | PROVED | 1.2 |
| `acurr:StrDex` | PROVED | 1.1 |
| `acurrstr` | PROVED | 0.5 |
| `dbon:human` | PROVED | 0.8 |
| `abon:human` | PROVED | 15.2 |
| `lower_bits` | PROVED | 0.1 |
| `upper_bits` | PROVED | 0.0 |
| `isaac64_mix` | PROVED | 0.1 |
| `isaac64_update` | PROVED | 0.3 |
| `isaac64_reseed` | PROVED | 3.5 |
| `isaac64_init` | PROVED | 0.1 |
| `isaac64_next_uint64` | PROVED | 0.1 |
| `isaac64_seed_packing` | PROVED | 0.1 |

## Newly classified original sites

| Port site | New class | Native source |
|---|---|---|
| `src/js/allmain.ts:1057` finishInitialTurnMaintenanceAfterRegions | invariant | `allmain.c:176 moveloop_core` |
| `src/js/anti_magic_trap.ts:127` triggerHeroAntiMagicTrap | constant | `trap.c:2322 trapeffect_anti_magic` |
| `src/js/corpse_intrinsics.ts:81` chooseCorpseIntrinsic | guarded | `eat.c:1338 corpse_intrinsic` |
| `src/js/corpse_intrinsics.ts:102` shouldGiveIntrinsic | guarded | `eat.c:960 should_givit` |
| `src/js/corpse_intrinsics.ts:108` shouldGiveTemporaryResistance | guarded | `eat.c:991 temp_givit` |
| `src/js/dungeon.ts:602` placeLevels | guarded | `dungeon.c:665 place_level` |
| `src/js/engrave.ts:164` wipeoutText | guarded | `engrave.c:119 wipeout_text` |
| `src/js/hero_form_combat.ts:331` performHeroEngulf | guarded | `uhitm.c:5423 hmonas` |
| `src/js/hole.ts:42` liquidForHole | guarded | `dig.c:605 fillholetyp` |
| `src/js/minion.ts:138` demonLord | constant | `minion.c:404 dlord` |
| `src/js/minion.ts:147` demonPrince | constant | `minion.c:390 dprince` |
| `src/js/mklev.ts:1248` attachEggHatchTimer | guarded | `timeout.c:980 attach_egg_hatch_timeout` |
| `src/js/mklev.ts:1427` mkclassAligned | guarded | `makemon.c:1879 mkclass_aligned` |
| `src/js/mklev.ts:4293` specialMazeStockPoint | constant | `sp_lev.c:2899 maze1xy` |
| `src/js/mklev.ts:4294` specialMazeStockPoint | constant | `sp_lev.c:2899 maze1xy` |
| `src/js/mklev.ts:5748` createToptenObject | constant | `mkobj.c:2226 mk_tt_object` |
| `src/js/mklev.ts:7910` mazeFloorPoint | constant | `mkmaze.c:1315 mazexy` |
| `src/js/mklev.ts:7911` mazeFloorPoint | constant | `mkmaze.c:1315 mazexy` |
| `src/js/mklev.ts:7931` vibratingSquarePoint | constant | `mkmaze.c:1041 pick_vibrasquare_location` |
| `src/js/mklev.ts:7932` vibratingSquarePoint | constant | `mkmaze.c:1041 pick_vibrasquare_location` |
| `src/js/monmove.ts:6748` resumeDeferredHeroLegs | invariant | `uhitm.c:4424 mhitm_ad_legs` |
| `src/js/mon.ts:3548` selectDoppelgangerFormOnce | constant | `mon.c:5156 select_newcham_form` |
| `src/js/monster_ranged_alignment.ts:64` linedUp | guarded | `mthrowu.c:1329 linedup` |
| `src/js/monster_throw.ts:525` catchThrownObject | invariant | `mthrowu.c:532 u_catch_thrown_obj` |
| `src/js/mplayer.ts:50` createPlayerMonsters | constant | `mplayer.c:326 create_mplayers` |
| `src/js/music.ts:129` improvisedNotes | constant | `music.c:732 improvised_notes` |
| `src/js/options.ts:1164` chooseRandomPart | guarded | `cfgfiles.c:463 choose_random_part` |
| `src/js/orc_raid.ts:69` createOrcRaid | constant | `mkmaze.c:798 stolen_booty` |
| `src/js/polyself.ts:1417` pickFormFromClass | guarded | `makemon.c:1982 mkclass_poly` |
| `src/js/potion.ts:2276` mixPotions | guarded | `potion.c:2441 potion_dip` |
| `src/js/scroll_armor_effects.ts:86` enchantArmor | guarded | `read.c:1114 seffect_enchant_armor` |
| `src/js/selvar.ts:266` selection_rndcoord | guarded | `selvar.c:283 selection_rndcoord` |
| `src/js/shk.ts` payForShopDamage | guarded | `shk.c:5173 pay_for_damage` |
| `src/js/sink_drinking.ts:98` drinkSink | invariant | `fountain.c:594 drinksink` |
| `src/js/teleport.ts:822` teleportHeroToRandomPet | guarded | `teleport.c:813 tele_to_rnd_pet` |
| `src/js/write.ts:197` findWritingType | guarded | `write.c:73 dowrite` |
