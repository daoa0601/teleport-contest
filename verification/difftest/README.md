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

## Run

From the worktree root, with the configured recorder available read-only:

```sh
export NETHACK_RECORDER=/Users/anhdao/project/contest/nethack-c/recorder
uv run verification/difftest/build.py
uv run python -m unittest discover -s verification/difftest -p 'test_*.py' -v
uv run verification/difftest/run.py --creation --count 6000 --self-test
uv run verification/difftest/run.py --count 6000
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
computed difficulty, core/display word counts and RNG operation/argument/result
entries are also compared. Missing optional JS scalar storage maps to its native
zero default. Species absence maps to `-1`. No whole-memory comparison is made.

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

Controls must match completely before a probe or mutant is accepted. The six
creation schema probes reject an invalid object type, object class, range
endpoint, depth, monster class and species respectively. The original five
invalid-domain probes and seven mutants remain active, including independent
state, extra-word and log-only changes.

Differences are reduced by deleting list entries and resetting scalar fields to
domain defaults while retaining the target and object/species identities. The
reducer preserves the first differing projection path and validates every
candidate. This is one-minimal under those operations, not a globally smallest
seed or integer input. New tests exercise reduction of species-history entries.

## Measured results

The final native build compiled 140 objects in 15.21 s. All 20 focused harness
tests passed in 7.756 s; the creation batch, including negative checks, took
20.62 s and exited 0. No game suite, session
replay, public/pool/eval/fresh corpus, new recording or CI job was run or added.
Game code, generated runtime files, shared documentation and ledgers are unchanged.

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
4.66 s. The focused tests cover the original eight behaviors plus twelve creation
and loader behaviors. Creation negative checks found all seven deliberately broken
correspondences and killed all seven new mutants; all eleven input-domain probes
and all fourteen mutants across both sets behaved as expected.

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
all six reduced inputs then matched (6/6, 0.36 s). The focused regression was
also run with that loader write removed: it failed on that inventory difference
(exit 1, 0.636 s), and passes after restoration. No game source was changed.

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
| `rn2` | PROVED | 0.6 s | `rnd` | PROVED | 0.2 s |
| `rn1` | PROVED | 0.5 s | `rnl` | PROVED | 1.0 s |
| `d` | PROVED | 0.3 s | `rne` | PROVED | 1.2 s |
| `rnz` | PROVED | 4.4 s | `rn2_on_display_rng` | PROVED | 0.1 s |
| `distmin` | PROVED | 0.3 s | `dist2` | PROVED | 1.3 s |
| `enermod` | PROVED | 4.6 s | `newuexp` | PROVED | 1.4 s |
| `xlev_to_rank` | PROVED | 0.3 s | `rounddiv` | PROVED | 0.6 s |
| `Align2amask` | PROVED | 0.5 s | `Amask2align` | PROVED | 1.3 s |
| `acurr:StrDex` | PROVED | 1.2 s | `acurrstr` | PROVED | 0.5 s |
| `dbon:human` | PROVED | 0.9 s | `abon:human` | PROVED | 16.4 s |
| `lower_bits` | PROVED | 0.1 s | `upper_bits` | PROVED | 0.0 s |
| `isaac64_mix` | PROVED | 0.1 s | `isaac64_update` | PROVED | 0.3 s |
| `isaac64_reseed` | PROVED | 3.6 s | `isaac64_init` | PROVED | 0.1 s |
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
