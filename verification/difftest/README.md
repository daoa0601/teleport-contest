# Concrete creation checks

This extension executes the linked recorder C and the emitted JavaScript from
shared serialized entry state. It adds empirical evidence, not a new equivalence
proof. The six original targets remain available through the same runner.

## Entry points

| Input target | Recorder entry | Emitted JavaScript entry |
|---|---|---|
| `mksobj` | `mkobj.c:mksobj` | `mklev.js:mksobj` |
| `mkobj` | `mkobj.c:mkobj` | `mklev.js:mkobj` |
| `rnd_class` | `objnam.c:rnd_class` | `mklev.js:rndClass` |
| `rndmonst` | `makemon.c:rndmonst` | `mklev.js:rndmonstAdj(0, 0)` |
| `mkclass` | `makemon.c:mkclass_aligned` | `mklev.js:mkclassAligned` |
| `makemon_inventory` | `makemon.c:makemon`, including `m_initweap` and `m_initinv` | `mklev.js:makemonAt` |

`mkclass` with alignment `-128` exercises ordinary `mkclass` semantics; the
other three alignments exercise `mkclass_aligned`. The port folds weapons and
inventory initialization into its constructor. The inventory target therefore
compares **the complete constructor call**, including HP/gender draws, fixed
possessions, armor wearing and the saddle probe. It does not isolate the RNG
or successor state of `m_initweap` and `m_initinv` individually. Native
`makemon` calls `m_initweap` only for armed species; this caller guard remains.
The inventory projection also calls `teleport.c:noteleport_level` and emitted
`teleport_rules.js:monsterTeleportRestricted` to report the created monster's
current teleport restriction directly.

## Run

From the worktree root, with the configured recorder available read-only:

```sh
export NETHACK_RECORDER=/Users/anhdao/project/contest/nethack-c/recorder
uv run verification/difftest/build.py
uv run python -m unittest discover -s verification/difftest -p 'test_*.py' -v
uv run verification/difftest/run.py --creation --count 6000 --self-test
uv run verification/difftest/run.py --naming --count 6000 --self-test
cd verification/equivalence && uv run prove.py
```

Build outputs, stderr and default mismatch reports go into
`.cache/fv-difftest/`. Workers also run there so a native diagnostic cannot
leave a `paniclog` in the checkout root. A creation call forks the native
worker before initializing globals, which gives private C caches and heap
allocations a fresh lifetime. The parent waits for that exact child. Timeout
cleanup signals the worker's process group, including its native child.

Clang compiles the real recorder translation units with undefined-behavior
sanitization; this extension introduces no C text parser or replacement
implementation. The existing symbolic prover separately uses clang's typed
AST. JavaScript imports the emitted modules through the scoring overlays,
including frozen ISAAC64. Mutants change module source in memory through a
loader hook. Neither recorder sources nor game sources are rewritten.

A custom input uses `--input PATH`, accepting one JSON object or JSONL. Only
arguments belonging to the selected creation target are accepted. For example:

```json
{"target":"mksobj","otyp":"CHEST","init":1,"artif":0,"seed":42,"position":255,"level":{"depth":12,"inMklev":1}}
```

Returns from object constructors are represented by their object projection;
the numeric `result` for those two targets is a constant zero. Selection returns
are type/species indices, with `-1` for a missing monster. The inventory target
returns the created species index or `-1` when creation was refused.

## Input domain and correspondence

The JSON schema and the two loaders are an assumed state relation. They are
reviewed executable setup, not a proved correspondence between arbitrary saved
games. The following native sources justify the fields and restrictions:

| Entry-state restriction or assumption | Source |
|---|---|
| Matching object/species numeric IDs and metadata tables | `objects.c:objects_globals_init`, `monst.c:monst_globals_init`; emitted data modules; table equivalence is assumed |
| Named real object types 18..480; generic types and unnamed appearances excluded | `objclass.h:MAXOCLASSES`, `objects.h`, `mkobj.c:mksobj_init` |
| Object class 0 or 2..17, plus `SPBOOK_no_NOVEL = -10` | `objclass.h`; `mkobj.c:mkobj`; class 1 has no creation reservoir |
| Inclusive real-type ranges for `rnd_class`, including singleton and reversed ranges | `objnam.c:rnd_class`; a reversed range returns `STRANGE_OBJECT` |
| Monster classes must contain a candidate before `SPECIAL_PM` | `makemon.c:mkclass_aligned`; the tail-only class has no such candidate |
| `spc` may override `G_NOGEN`, `G_HELL`, `G_NOHELL`, `G_UNIQ`, or `G_IGNORE` | `monflag.h`; `makemon.c:mkclass_aligned` |
| Generation flags add only `G_EXTINCT`/`G_GENOD`; birth counts 0..255; no duplicate species entries | `hack.h:struct mvitals`, `monflag.h`; initial `G_NOCORPSE` comes from each species' `geno` as in `allmain.c:newgame` |
| Depth/Sanctum depth 1..50; hero level 1..30; no Amulet or upward-branch difficulty adjustment | `dungeon.c:level_difficulty`, `global.h:MAXULEV`; explicit bounded test domain |
| Ordinary, Gehennom, Rogue, Mines, Earth, Air, Fire, Water or Astral location | `dungeon.h` predicates; `makemon.c:wrong_elem_type`, `uncommon`, `align_shift`, `temperature_shift` |
| Alignment `-128` (none), -1, 0 or 1; temperature -1..1; no special-level alignment descriptor | `align.h`, `rm.h`; `makemon.c:align_shift`, `temperature_shift` |
| Moves 0..100000; explicit generation, lighting, no-teleport and stasis fields; stasis expiry 0..100100 | `rm.h`, `mklev.c:clear_level_structures`, `teleport.c:noteleport_level`; bounded harness domain |
| Human archeologist, neutral alignment, attributes 12, hero at (10,10), empty hero inventory | `role.c`, `you.h`; fixed correspondence, not every role/equipment branch |
| Protection from shape changers active on both sides | `makemon.c:makemon` caller guard; `prop.h:FROMOUTSIDE`; excludes spontaneous newborn shape changes |
| Monster created at (11,10), with `MM_NOGRP`, `MM_ANGRY`, `MM_NOMSG`, `MM_NONAME`, `MM_NOTAIL` | `makemon.c:makemon`; no pre-existing monster, floor object, trap or occupation |
| Fresh artifacts, fruit ID 1 and identity counter 2 | `artifact.c:init_artifacts`, `allmain.c:newgame`, `mkobj.c:next_ident`; JS setup explicitly establishes the same values |
| Same setup seed 999, real object initialization and level gem probabilities before measurement | `o_init.c:init_objects`, `oinit`; emitted `init_objects`, `oinit` |
| Gameplay seed 0..2147483647 and core-stream skip 0..4096; initialized independent display stream | `rnd.c:init_isaac64`; actual seeded ISAAC64, not arbitrary symbolic draw streams |

`level.place` numbers 0..8 follow the location order in the table. Ordinary
branch depth is the supplied depth. Endgame difficulty is computed by both real
helpers from the supplied Sanctum depth plus half the hero level. A seven-branch
synthetic topology supplies distinct identities and matching ledger numbers.
Not every combination of depth, move, location and population flags is reachable
in play. In particular, sampling all 383 monster indices includes the tail and
quest/player placeholders; it does not establish that ordinary creation callers
request every index. Any actual mismatch still needs C-caller analysis.

## Observations and negative checks

The creation projection compares ordered objects and recursive contents:
identity/type/class, quantity, cached weight, applicable corpse species,
enchantment/charges, age, BUC, erosion, proofing, poison, grease, knowledge,
lock/trap state, recharge count, lighting, glob/eaten state, artifact ID,
worn mask, novel index, ownership, container type and carrier species. Object
timers compare kind and absolute deadline. `obj.h` aliases are projected
separately: rotten/diluted state, no-revival, on-ice, degraded horn, leash owner,
sink origin, boulder link and spellbook study count. Inapplicable C shared-field
interpretations are normalized to zero or the absent-species sentinel; poisoned
weapons are not treated as trapped containers.

The successor identity counter, all species' birth counts and generation flags,
computed difficulty, the created monster's teleport restriction (null when absent),
core/display word counts and RNG operation/argument/result
entries are also compared. Missing optional JS scalar storage maps to its native
zero default. Species absence maps to `-1`. No whole-memory comparison is made.

This full comparison belongs to the differential runner, as required by the unit
brief. The ten tests in `test_creation.py` instead run C and JS independently
and assert only their named game rules: charges, fuel, contents, species choice,
inventory ownership and teleport eligibility. They do not compare complete
observations or RNG logs. The reducer self-test was removed from that behavior
file, and schema validation moved into the runner's explicit negative checks.

Every new target has a concrete counterexample probe that deliberately breaks
one entry-state correspondence, and an independently killed emitted-JS mutant:

| Target | Broken correspondence | Killed mutant |
|---|---|---|
| `mksobj` | `init=0` vs 1: enchantment differs | initial enchantment becomes 100 |
| `mkobj` | ring vs weapon class: type differs | force weapon class |
| `rnd_class` | unequal singleton range endpoints: return differs | singleton returns its successor |
| `rndmonst` | unequal hero levels: selected species differs | selected index increases by one |
| `mkclass` | unequal monster classes: selected species differs | selected index increases by one |
| inventory, weapons | hobbit vs soldier: created species differs | skip weapon initialization |
| inventory, other gear | leprechaun vs soldier: created species differs | skip its gold initialization |
| teleport restriction | stasis expiry 40 vs 39 on turn 40: teleport eligibility differs | inclusive expiry `>=` becomes `>` |

Controls must match completely before a probe or mutant is accepted. The ten
creation schema probes reject invalid object types, object classes, range
endpoints, depths, monster classes, species, override bits, population flags and
duplicate species histories. The original five invalid-domain probes and seven
mutants remain active, including independent state, extra-word and log-only
changes. A new `creation_log` mutant adds `d(0, 1)` during object construction.
Both `rnd.c:d` and emitted `rng.js:d` consume no words for zero dice; the JS call
adds only a log entry. The differential runner rejects it at `rng.log`.

All ten creation behavior tests pass with `creation_log` enabled (10.663 s).
Before removing the full-result assertion from their helper, the same calibration
reported 26 failures across those ten tests (10.378 s). The independent behavior
assertions still reject the strict-expiry `stasis` mutant at both equality
boundaries, `(0,0)` and `(40,40)` (two JS failures, 1.920 s).

Differences are reduced by deleting list entries and resetting scalar fields to
domain defaults while retaining the target and object/species identities. The
reducer preserves the first differing projection path and validates every
candidate. This is one-minimal under those operations, not a globally smallest
seed or integer input.

## Measured results

The review rerun compiled all 140 native objects in 15.57 s. `npm run compile`
exited 0. All 18 focused tests passed in 12.196 s; the creation batch, including
negative checks, took 19.20 s and exited 0. No full game behavior suite,
pool/eval/fresh corpus, new recording or CI job was run or added. Game code,
generated runtime files, shared documentation and ledgers are unchanged.

The explicitly requested public run used one worker and completed all 44
sessions in 30.61 s: 43 full passes, zero errors, 11,396/11,405 matched screens
and 792,838/792,838 matched RNG calls. The screen-only miss was
`seed2200-wizard-quaff-zap-read` at step 158, the same session and position
reported before this change. The public ledger check exited 0: all 363 functions
retained every verified call. The exact commands were:

```sh
TRIAGE_JOBS=1 node scripts/triage-holdout.mjs public .cache/fv-difftest2-review2-public
node scripts/rng-function-table.mjs .cache/fv-difftest2-review2-public \
  --check-ledger docs/ledger/public-rng.tsv
```

| Target | Cases | Differences |
|---|---:|---:|
| `mksobj` | 1,880 | 0 |
| `mkobj` | 1,162 | 0 |
| `rnd_class` | 1,005 | 0 |
| `rndmonst` | 1,144 | 0 |
| `mkclass` | 1,228 | 0 |
| `makemon_inventory` | 1,383 | 0 |
| **Creation total** | **7,802** | **0** |

There are 1,802 boundary cases plus 6,000 generated cases. Boundaries include all
440 named real object types, each with `init=0` and `init=1`, every one of the 383
monster indices, 57 monster classes with four alignment filters, all nine
locations, and every allowed object class including random and no-novel books.
Generation additionally varies seeds, stream positions across refill boundaries,
BUC/artifact initialization, depth, hero level, temperature, teleport restrictions,
lighting, generation phase and species history. Inputs are sampled, not coverage
guided; this is not a claim that every switch arm or rare branch executed.

The original 6,083 cases also still matched: weight 1,031; inventory weight 1,019;
capacity 1,006; near-capacity 1,006; damage 1,009; accuracy 1,012. That run took
4.34 s. The focused run includes the eight unchanged base harness tests and ten
creation behavior tests. Creation negative checks found all eight deliberately
broken correspondences and killed all eight mutants. Together with the base
checks and the additional creation-log calibration, all fifteen input-domain
probes and all sixteen mutants behaved as expected.

### Reduced differences during development

The first 7,802-case run returned **six differences** in combined inventory
creation. All were reduced, then traced to a missing loader field, not reported
as game bugs. At move zero, native `stasis_until == 0` satisfies
`teleport.c:noteleport_level`'s `stasis_until >= moves` test. The test-room fixture
left the JS field undefined, changing the reroll in
`muse.c:rnd_defensive_item` / `muse.js:randomDefensiveMonsterItem`.

One reduced reproducer was:

```json
{"target":"makemon_inventory","mnum":"baby gray dragon","seed":1473357231,"position":255,"level":{"depth":43,"moves":0}}
```

With the incomplete loader, `objects[1].otyp` was C 329 (`SCR_CREATE_MONSTER`)
and JS 424 (`WAN_TELEPORTATION`). The game initializers already agree:
`mklev.c:clear_level_structures` and emitted `mklev.js:clear_level_structures`
set stasis expiry to zero. Loading that field explicitly restored correspondence;
all six reduced inputs then matched (6/6, 0.36 s). No game source was changed.

Review replaced the seed/position-specific stasis regression with direct
teleport-eligibility assertions at `(moves, expiry)` pairs `(0,0)`, `(1,0)`,
`(40,39)`, `(40,40)` and `(40,41)`. They assert the native
`stasis_until >= moves` rule regardless of whether inventory generation reaches
its defensive-item reroll. Removing the JS loader's stasis write made three
boundary cases fail on `teleportRestricted` (exit 1, 1.960 s); restoring it passes.
The emitted-only `>=` to `>` mutant is also rejected on `teleportRestricted`.

The singleton-range and exhausted-reservoir tests now assert their return
values without separate random-word-count assertions. The ice-box test checks
16 seeds, permits empty contents, enforces the native maximum of 20 corpses,
and checks age, ownership and removed rot/revival/glob timers for each corpse.
These are the rules in `objnam.c:rnd_class`, `makemon.c:rndmonst_adj` and
`mkobj.c:mkbox_cnts`.

A separate invalid class input was removed from the schema: class 59 contains
only the worm-tail placeholder at/after `SPECIAL_PM`, so C's `mkclass_aligned`
reports that it has no candidate. Native display initialization was also added
after a null vision-array harness error. These failed runs are not counted as
successful evidence. No reachable game-code divergence or candidate bug remains.

### Existing equivalence claims

`NETHACK_RECORDER=... uv run prove.py` exited 0: all 28 previous claims remain
PROVED, with their supplied probes and mutants. Times are the command's reported
per-claim times; they exclude the negative checks following each claim.

| Claim | Result | Time | Claim | Result | Time |
|---|---|---:|---|---|---:|
| `rn2` | PROVED | 0.2 s | `rnd` | PROVED | 0.1 s |
| `rn1` | PROVED | 0.4 s | `rnl` | PROVED | 1.0 s |
| `d` | PROVED | 0.3 s | `rne` | PROVED | 1.2 s |
| `rnz` | PROVED | 4.7 s | `rn2_on_display_rng` | PROVED | 0.1 s |
| `distmin` | PROVED | 0.3 s | `dist2` | PROVED | 1.0 s |
| `enermod` | PROVED | 5.1 s | `newuexp` | PROVED | 1.4 s |
| `xlev_to_rank` | PROVED | 0.3 s | `rounddiv` | PROVED | 0.6 s |
| `Align2amask` | PROVED | 0.5 s | `Amask2align` | PROVED | 1.3 s |
| `acurr:StrDex` | PROVED | 1.3 s | `acurrstr` | PROVED | 0.5 s |
| `dbon:human` | PROVED | 0.8 s | `abon:human` | PROVED | 19.6 s |
| `lower_bits` | PROVED | 0.1 s | `upper_bits` | PROVED | 0.0 s |
| `isaac64_mix` | PROVED | 0.1 s | `isaac64_update` | PROVED | 0.4 s |
| `isaac64_reseed` | PROVED | 3.7 s | `isaac64_init` | PROVED | 0.1 s |
| `isaac64_next_uint64` | PROVED | 0.0 s | `isaac64_seed_packing` | PROVED | 0.1 s |

## Remaining limits

Weapons and inventory initialization have combined-constructor coverage only.
The domain fixes the hero role, prevents newborn shape changes and groups, starts
with empty floor/monster inventories, and omits quest generation. Arbitrary
existing artifacts, worn hero equipment, role-specific quest gear and arbitrary
caller/global states are outside it. Creature creation on the supplied room does
not test placement survival rules for arbitrary terrain.

The projection omits monster HP/attitude/strategy, full artifact registries,
object names other than novel index, discovery tables, light-source state,
absolute timer insertion order, floor objects created as constructor side effects,
Lua, messages/screens, suspension and save/restore. A matching inventory can
therefore coexist with an unobserved state difference. The real compiler, native
libraries, unproved loaders, initial table relation, Node and comparison code
remain in the trust base. Executed UBSan checks do not prove absence of undefined
behavior on untested paths, and sampled equality is not universal equivalence.

# Concrete naming checks

`--naming` extends the same runner to the naming layer: the pure string
plurals/articles and the object/monster name formatters over serialized state.
Every case still runs the linked recorder C against the emitted JavaScript with
the shared RNG stream and log comparison.

## Naming entry points

| Input target | Recorder entry | Emitted JavaScript entry |
|---|---|---|
| `makeplural` | `objnam.c:makeplural` | `object_grammar.js:makePlural` |
| `makesingular` | `objnam.c:makesingular` | `object_grammar.js:makeSingular` |
| `articles` | `objnam.c:an()` and `objnam.c:the()` | `object_grammar.js:withIndefiniteArticle`, `objnam.js:definiteName` |
| `xname` | `objnam.c:xname_flags` (CXN_NORMAL) plus `an()`/`the()`/`aobjnam(obj, NULL)` wrappers | `objnam.js:objectCombatName`/`objectAction` (corpse species suppressed for the `xname` field, kept for `aobjnam`) |
| `doname` | `objnam.c:doname_base(obj, 0)` | `object_description.js:objectDescription` |
| `x_monnam` | `do_name.c:x_monnam` | `monster_name.js:monsterName`, or `namelessMonsterName` for `SUPPRESS_NAME` |

String targets compare only the returned strings and the (empty) RNG
consumption. `xname`/`doname` also compare the observed object projection
(`known`, `dknown`, `bknown`, `corpsenm`), which `observe_object()` and the
port's `observeObjectForNaming()` mutate. `xname` covers every object type at
or after `FIRST_OBJECT`, all knowledge-flag combinations over representative
types of every class, corpses/statues/figurines/tins/eggs with species and
gender/historic bits, fruits, globs, worn masks, containers with contents,
poisoned weapons, wet towels, candelabra, diluted potions, holy/unholy water,
`next boulder`, and the samurai/priest/archeologist/monk role name effects,
including `implicit_uncursed` and `partly_eaten_hack`. `makeplural`/
`makesingular` run over every object and monster name plus the C special-case
tables (`as_is[]`, `one_off[]`, `special_subjs[]`, `Japanese_items[]`) and
generated compounds. `x_monnam` runs over every monster species with articles,
adjectives, suppression bits, tame/peaceful/named/shopkeeper/priest/invisible
states, mplayer ranks and ghosts.

Unknown tin variety (`spe` 0, not spinach, not cursed) legitimately draws
`rn2(TTSZ-1)` in `eat.c:tin_variety` through `tin_details`; those cases are
compared with their RNG consumption and log like every other case.

## Naming run

```sh
export NETHACK_RECORDER=/Users/anhdao/project/contest/nethack-c/recorder
uv run verification/difftest/build.py
uv run verification/difftest/run.py --naming --count 6000 --self-test
```

## Naming correspondence and assumed facts

The naming state relation extends the creation relation. Facts beyond it:

| Input restriction or assumed fact | Native source |
|---|---|
| Text inputs are printable ASCII without quote or backslash and contain a non-space character; `impossible()` needs windowprocs the harness cannot supply | `objnam.c:makeplural`, `makesingular`, `an`, `the` |
| `oeroded`/`odiluted` and `otrapped`/`opoisoned` alias one C field; each pair is exclusive and potions use the shared field only as `odiluted` 0/1 | `obj.h` field aliases |
| Generic class rows before `FIRST_OBJECT` and `SPE_NOVEL` (named at construction) are excluded | `mkobj.c:mksobj`, `o_init.c` |
| Worn masks are 0 or one supported slot bit; `uarm*`/`uwep` slot owners stay null so `donning()`/`doffing()` stay false | `do_wear.c:donning`, `doffing` |
| `leashmon` (corpsenm alias) must be 0; the harness has no live leashed monster | `objnam.c:doname_base` leash branch |
| `slime mold spe` must index a registered input fruit (`fruit_from_indx`) | `objnam.c:xname_flags` |
| Visible monsters require hero monster detection: C's `cansee` depends on uncomputed vision in this harness, detection short-circuits `canspotmon` on both sides | `display.h:canspotmon` |
| Hallucination is off; hallucinated names draw display RNG | `do_name.c:x_monnam` |
| Minions of a god (emin/isminion) are excluded: unit fix-wide-misc31 owns that path; `ispriest` temple priests are covered | `do_name.c:x_monnam`, `priest.c:priestname` |
| `SUPPRESS_MAPPEARANCE` alone, and `SUPPRESS_NAME` with an adjective or `called=TRUE`, have no C caller and no emitted entry point | `do_name.c:noname_monnam`, `l_monnam` |
| Artifacts (`oartifact`) are not covered; `obj_is_pname` needs artifact discovery state | `objnam.c:obj_is_pname`, `find_artifact` |
| Price quotes keep both defaults (`pricequotes` off on both sides) with an empty quote table | `options.c` optlist defaults, `shk.c:append_price_quote` |
| Shapeshifter species (vampire, doppelganger, sandestin, chameleon) are restored to the requested species after construction; naming describes `mons[mnum]` | `makemon.c` shapeshifter creation |
| The case `discovery` applies to the root object's type only; contained types keep their table knowledge on both sides | `objnam.c:xname_flags` reads `objects[otyp]`; `o_init.c:docall` writes one type |

## Naming measured results

Round-3 review rerun: native build, 140 objects in 15.30 s.
`--naming --count 6000 --self-test`:
17 domain probes rejected, 9 emitted-JS mutants killed (`makeplural` default
suffix, an extra `rnd(1)` draw inside `makePlural`, `makesingular` ies→y,
`an` single-letter x-rule, `the` insertion, lenses `pair of`, `greased`
prefix, `invisible` adjective, and removal of `objectCombatName`'s own
observation), 11,160 cases in 15.88 s with 0 mismatches. String targets
measure the real stream position and RNG log on both sides; the extra-draw
mutant is killed through `rng.core`, not a constant zero. The `xname`
pairing relies on `objectCombatName`'s internal observation (C `xname()`
observes itself); only the `doname` path, whose formatter delegates
observation to its caller, observes explicitly.

| Target | Cases | Mismatches |
|---|---:|---:|
| `makeplural` | 2,519 | 0 |
| `makesingular` | 2,136 | 0 |
| `articles` | 1,026 | 0 |
| `xname` | 1,717 | 0 |
| `doname` | 1,705 | 0 |
| `x_monnam` | 2,057 | 0 |

The naming batch includes 5,160 boundary and full type/species sweep cases.
Hand-authored cases default to their type's initial knowledge, and only the
documented domain exclusions are dropped. The round-3 run passed all 25
harness tests in 14.624 s; the original six targets matched all 683 cases in
3.84 s (5 rejected probes, 8 killed mutants).
The creation rerun matched all 2,402 cases in 9.50 s, including 8
correspondence counterexamples, 8 killed creation mutants and 10 rejected
creation-domain probes.

### Round-3 self-test findings

The quantity probe now uses `MACE` with `quan=2` and `nameKnown=1`.
`include/objects.h:WEAPON` gives the mace `oc_merge=0` and initial
`oc_name_known=1`; `invent.c:mergable` rejects a type with `oc_merge=0`.
The former `POTION_OF_BOOZE` input failed type lookup before quantity was
checked. The actual `POT_BOOZE` has `oc_merge=1` through the `POTION` macro.
The new domain test accepts a singleton mace and two booze potions, and
rejects two maces specifically because the type does not stack.

A second test changes only the mace's metadata merge flag to 1 and requires
the naming self-test to reject that erroneous domain. It failed with the
old probe (`RuntimeError not raised`) and passes with the corrected probe.
The explicit discovery flag matters: without it, even a singleton mace
fails the unrelated initial-knowledge restriction.

The child-default test was removed. Canonicalization makes deletion and
resetting to zero observationally equivalent for those fields, so it did not
establish its stated distinction. Its replacement minimizes a real emitted
`doname` mutant: quantity, erosion, blindness and RNG position simplify, the
necessary grease remains, and the native/port result difference still
reproduces. Disabling reduction in memory makes this test fail (`5 != 1`);
the normal reducer passes. No new game behavior or equivalence claim is
introduced by either self-test change.

`npm run compile` exited 0. The requested public replay used one worker and
finished all 44 sessions in 30.264 s: 43 full matches, 11,396/11,405 screens,
792,838/792,838 random calls and zero crashes. The public ledger check exited
0, retaining every verified call for all 363 functions. The remaining
screen difference is `seed2200-wizard-quaff-zap-read`, step 158: native option
help prints the recorder host's configuration path. There is no RNG
difference in that session. No full game suite, pool/eval run or new
recording was run.

### Candidate bugs

None. Every difference observed during development reduced to a harness
correspondence gap, not a port defect:

| Difference | Cause | Resolution |
|---|---|---|
| JS `doname` showed no appearance ("ring", "potion") where C did | C `xname()` observes the object internally; the port splits observation into `observeObjectForNaming` | Harness calls `observeObjectForNaming` before `objectDescription` |
| JS `xname` included corpse species ("the Oracle's corpse" vs C "corpse") | C `xname()` omits species; `cxname()` adds it | Harness passes `includeCorpseSpecies: false` for the `xname` field; `aobjnam` keeps it |
| C dropped `oeroded`/`opoisoned` words | `obj.h` field aliases were loaded as separate C fields, later writes clobbering earlier ones | C loader folds aliased pairs; domain keeps them exclusive |
| JS named priest/minion/ghost/shopkeeper monsters by constructor state | `createMonsterAt` sets `ispriest`/`isminion`, ghost names and shop data; the C struct only carries the input flags | Harness owns these flags: overrides after construction, epri/eshk/mgivenname from input |
| C "generic iron chain" vs JS "iron chain" | generic rows before `FIRST_OBJECT` are never created by `mkobj` | Excluded from the domain |

The `the air elemental of Ishtar` screen divergence that motivated this unit
is the excluded minion path (emin/isminion) owned by fix-wide-misc31; it
remains outside this comparison.

### Naming existing equivalence claims

The round-3 `NETHACK_RECORDER=... uv run prove.py` run exited 0: all 33
existing claims remain PROVED, including the two slow table claims and all
configured domain probes and mutants. No proof claim was added or changed.
Per-claim times exclude their negative checks:

| Claim | Result | Time |
|---|---|---:|
| `rn2` | PROVED | 0.2 s |
| `rnd` | PROVED | 0.1 s |
| `rn1` | PROVED | 0.6 s |
| `rnl` | PROVED | 1.5 s |
| `d` | PROVED | 0.3 s |
| `rne` | PROVED | 0.7 s |
| `rnz` | PROVED | 2.4 s |
| `rn2_on_display_rng` | PROVED | 0.1 s |
| `distmin` | PROVED | 0.1 s |
| `dist2` | PROVED | 0.3 s |
| `enermod` | PROVED | 2.1 s |
| `newuexp` | PROVED | 0.6 s |
| `xlev_to_rank` | PROVED | 0.2 s |
| `rounddiv` | PROVED | 0.4 s |
| `Align2amask` | PROVED | 0.7 s |
| `Amask2align` | PROVED | 0.9 s |
| `acurr:StrDex` | PROVED | 1.0 s |
| `acurrstr` | PROVED | 0.3 s |
| `dbon:human` | PROVED | 0.6 s |
| `abon:human` | PROVED | 2.3 s |
| `acurr:all` | PROVED | 5.9 s |
| `dbon:all` | PROVED | 0.3 s |
| `abon:forms` | PROVED | 45.1 s |
| `experience:tables` | PROVED | 409.1 s |
| `mcalcmove:tables` | PROVED | 186.7 s |
| `lower_bits` | PROVED | 0.0 s |
| `upper_bits` | PROVED | 0.0 s |
| `isaac64_mix` | PROVED | 0.1 s |
| `isaac64_update` | PROVED | 0.4 s |
| `isaac64_reseed` | PROVED | 4.8 s |
| `isaac64_init` | PROVED | 0.1 s |
| `isaac64_next_uint64` | PROVED | 0.1 s |
| `isaac64_seed_packing` | PROVED | 0.1 s |

## Naming remaining limits

Hallucinated names, mimic `mappearance` monsters, minions of a god, artifacts
with personal names, novel titles, price-quote suffixes, shop billing,
`mshot_xname` ordinals, `distant_name` distance rules, end-of-game shirt and
apron text, wizard-mode weight/gender suffixes, leash attachment text and the
`override_ID` identification path are all outside the domain. Monster names
cover the species table but not worm tails, steeds or swallowed states.
Equality is sampled over the generated corpus, not proved for all states.
