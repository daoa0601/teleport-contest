# Formal verification feasibility

## Recommendation

A proof that the whole port is equivalent to C is not feasible: about 250k
lines of C, 17k lines of Lua, and 209k lines of TypeScript with 2,600 async
functions. Machine-checked equivalence of individual functions is feasible and
cheap for the arithmetic and RNG layer. A working prototype in
`verification/equivalence/` now proves 265 scoped C/JavaScript
claims. Use it as a CI check on leaf functions, add function-level
differential fuzzing for stateful code, and keep whole-game equivalence
empirical: session replay, ledgers, and the state oracle.

## What "verified" can mean

| Notion | Statement | Realistic? |
|---|---|---|
| Whole-game observational equivalence | For every seed, option set, and input sequence: same RNG trace, screens, and cursors | No. This needs a relational invariant between all of C's globals, heap lists, and Lua VM state and `GameState`, held at every input boundary, across synchronous C and async TypeScript. Replay already measures it. |
| Per-function refinement under a state relation | If C and JS states correspond and inputs are equal, both return the same value, consume the same RNG positions, emit the same log entries, and preserve the correspondence | Yes for leaf and read-only-state functions. Cost grows with the state a function touches: heap shapes, object chains, Lua. |
| RNG-trace equality per function | The refinement above, observing only the RNG calls | It is a weaker case of per-function refinement. The ledger in `docs/ledger/` measures it empirically. |
| JS-only safety | No exception, all arithmetic exact | Cheap. The same tool proves it as a side effect. |

Every claim needs an explicit input domain. C has undefined and
implementation-defined behavior, and JavaScript has doubles and BigInt. The
prototype found the boundaries mechanically (see below).

## Approaches, ranked by value/effort

| Rank | Approach | Tooling | Proves | Effort | Plausible coverage |
|---|---|---|---|---|---|
| 1 | SMT translation validation of both real sources (this prototype) | clang JSON AST, tree-sitter, Z3 | Per-function refinement over a stated domain, for all RNG sequences | Minutes per straight-line function. About an hour for a loop that needs an invariant. Days for one that touches heap state, until a state model exists. | Pure, arithmetic, table, and read-only-state helpers: RNG wrappers, geometry, formulas, attribute and experience math |
| 2 | Function-level differential fuzzing | The C function built with clang (the probe build already has coverage), a Node harness, coverage-guided inputs | Nothing, but it scales to stateful functions without models | Days for the harness, then hours per function, mostly state marshalling | Most functions whose state can be serialized |
| 3 | Call-site domain checks | The same executor run on callers, or a typed static check | Callers stay inside the proved domains (for example, that `rn2` never receives `x <= 0`) | Low per caller | Every caller of a proved function |
| 4 | Bounded model checking of the C side | CBMC or ESBMC | C undefined-behavior freedom. It can cross-check the prototype's C semantics. | Low | The C side only. Comparing with TypeScript needs a hand-written C model of the TS function. |
| 5 | State-machine models | TLA+ or Alloy, for turn order, movement points, and occupation interruption | Properties of a model, not of either implementation | Weeks | Design-level. Our defects are fidelity defects against C, and a model detects them only when conformance-tested against both sides. |
| 6 | Deductive proof | Dafny, Lean 4, F*, or Why3/Frama-C WP | Strong functional properties | Very high. TypeScript has no usable formal semantics, so the TS would be hand-translated, which reintroduces the gap. Frama-C WP proves C contracts, not the port. | Small lemmas, such as the `Math.trunc` rounding lemma below |
| 7 | Proof-carrying translation (generate TS from a verified spec) | F*/Low*-style extraction, or a Lean-to-JS backend | Correct by construction | It would rewrite the port. It does not fit async I/O or the existing 209k lines. | None in practice |

KLEE only executes C (LLVM). Without a JavaScript-to-LLVM path it adds nothing
over rank 4.

## The proof of concept

`cd verification/equivalence && uv run prove.py` (clang and uv).
`--skip-slow` excludes claims marked slow and their negative checks, with
an explicit `SKIPPED` line for each. The default includes every claim in the ledger.
In a worktree, set `NETHACK_RECORDER` to the main checkout's pinned recorder.

**Claim.** For every input in the domain, every random sequence (core and
display streams as arbitrary uint64 sequences), and RNG logging both on and
off: each leaf pair returns the same value, consumes the same stream
positions, and emits the same RNG-log entries. Leaf functions use the emitted
JavaScript modules listed in `specs.py`. C undefined behavior and JS
exceptions or inexact arithmetic are proof failures.

ISAAC64 compares return values and all in-bounds array cells and context
fields after each call. Generator claims read **`frozen/isaac64.js`**:
`frozen/score.sh` installs it over `js/isaac64.js` before scoring. The emitted
ISAAC64 copy is outside these claims. Wrapper seed packing reads emitted
`js/rng.js`. Times exclude probes and mutants unless explicitly labeled total. Path counts are C×JS for
each logging setting; ISAAC64 rows state their loop proof instead. Existing
rows retain the earlier measurements; the eight geometry/species rows and the
split `rnl` row use this batch's complete runs.

| Claim | C ↔ JavaScript | Domain | Paths / loop proof | Time |
|---|---|---|---|---|
| `rn2` | `rnd.c:rn2` ↔ `rng.js:rn2` | `x >= 1` | 1×1 | 0.4 s |
| `rnd` | `rnd.c:rnd` ↔ `rng.js:rnd` | `x >= 1` | 1×1 | 0.1 s |
| `rn1` | `hack.h:rn1` macro ↔ `rng.js:rn1` | `x >= 1`, `y + x - 1 <= INT_MAX` | 1×1 | 0.9 s |
| `rnl` | `rnd.c:rnl` ↔ `rng.js:rnl` | `1 <= x <= INT_MAX-256`; any `schar` Luck fields; exhaustive luck-sum-magnitude intervals | 17 intervals of ≤13×18 | 15.3 s |
| `d` | `rnd.c:d` ↔ `rng.js:d` | `n >= 0`, `x >= 0`, `x >= 1` or `n = 0`, `n*x <= INT_MAX` | 1×1; induction for unbounded n | 0.4 s |
| `rne` | `rnd.c:rne` ↔ `rng.js:rne` | `x >= 1`, `0 <= ulevel <= 30` | 20×25 | 0.7 s |
| `rnz` | `rnd.c:rnz` ↔ `rng.js:rnz` | `abs(i) <= 1e8`, `0 <= ulevel <= 30` | 40×50 | 2.5 s |
| `rn2_on_display_rng` | `rnd.c:rn2_on_display_rng` ↔ `rng.js:rn2Display` | `x >= 1` | 1×1 | 0.1 s |
| `distmin` | `hacklib.c:distmin` ↔ `hacklib.js:distmin` | Coordinates in [-16384, 16383] | 4×1 | 0.1 s |
| `dist2` | `hacklib.c:dist2` ↔ `hacklib.js:dist2` | Coordinates in [-16384, 16383] | 1×1 | 0.5 s |
| `isok` | `cmd.c:isok` ↔ `hacklib.js:isok` | Both coordinates in [-32768, 32767] | 2×4 | 0.4 s |
| `online2` | `hacklib.c:online2` ↔ `hacklib.js:pointsOnline` | All four coordinates in [-32768, 32767] | 2×4 | 0.1 s |
| `mindless:tables` | `mondata.h:mindless` ↔ `mondata.js:monsterIsMindless` | Valid species; non-null native species pointer; initial native/emitted flags | 1×1 | 1.2 s |
| `nohands:tables` | `mondata.h:nohands` ↔ `mondata.js:monsterHasNoHands` | Same initial-species domain | 1×1 | 1.3 s |
| `humanoid:tables` | `mondata.h:humanoid` ↔ `mondata.js:monsterIsHumanoid` | Same initial-species domain | 1×1 | 1.2 s |
| `ceiling_hider:tables` | `mondata.h:ceiling_hider` ↔ `mondata.js:monsterSpeciesHidesOnCeiling` | Same domain; initial flags and monster classes | 383×(1×1) | 3.3 s |
| `sliparm:tables` | `mondata.c:sliparm` ↔ `mondata.js:monsterSlipsArmor` | Same domain; initial sizes, classes and species identities | 383×(1×1) | 4.0 s |
| `breakarm:tables` | `mondata.c:breakarm` ↔ `mondata.js:monsterBreaksArmor` | Same domain; initial flags, sizes, classes and species identities | 383×(1×1) | 8.7 s |
| `attacktype:engulfs` | `mondata.c:attacktype` ↔ `mondata.js:monsterCanEngulf` | Six symbolic attack records; `AT_ENGL` query | 1×1 | 1.4 s |
| `attacktype:armed` | `mondata.c:attacktype` ↔ `mondata.js:speciesHasWeaponAttack` | Same array domain; `AT_WEAP` query | 1×1 | <0.1 s |
| `dmgtype_fromattack:digests` | `mondata.h:digests` via native scan ↔ `mondata.js:monsterDigests` | Same array domain; `AD_DGST`, `AT_ENGL`; presence only | 1×1 | 4.3 s |
| `dmgtype_fromattack:enfolds` | `mondata.h:enfolds` via native scan ↔ `mondata.js:monsterEnfolds` | Same array domain; `AD_WRAP`, `AT_ENGL`; presence only | 1×1 | 3.6 s |
| `attacktype_fordmg:digests` | `mondata.c:attacktype_fordmg` ↔ `mondata.js:monsterDigests` | Same array domain; `AT_ENGL`, `AD_DGST`; presence only | 1×1 | 3.4 s |
| `dmgtype:sticks` | `mondata.c:sticks`, including `dmgtype` ↔ `mondata.js:monsterSpeciesSticks` | Same array domain; complete sticking predicate | 1×1 | 1.6 s |
| `weight_cap:state` (slow) | `hack.c:weight_cap` ↔ `weight.js:weightCapacity` | Related hero state, representative property masks, initial species; restored properties | 1×1 | 27.8 s |
| `inv_weight:chain4` (slow) | `hack.c:inv_weight` ↔ `weight.js:invWeight` | Related inventory length 0..4; four object types; fresh cache; weights/quantities 0..100000 | 5×(1×1) | 8.6 s |
| `calc_capacity:chain4` (slow) | `hack.c:calc_capacity` ↔ `weight.js:calcCapacity` | Same chain domain; extra weight in [-1000000,1000000] | 5×(1×1) | 12.9 s |
| `near_capacity:chain4` (slow) | `hack.c:near_capacity` ↔ `weight.js:nearCapacity` | Same chain domain; extra weight zero | 5×(1×1) | 9.6 s |
| `sgn:inline` | `hacklib.c:sgn` ↔ emitted `muse.js:aimedDirection` dx initializer | Any C int delta; explicit local inputs; enclosing caller excluded | 2×1 | <0.1 s |
| `enermod` | `exper.c:enermod` ↔ `exper.js:energyModifier` | `abs(en) <= 715827882`; corresponding one of 13 playable roles | 4×4 | 3.1 s |
| `newuexp` | `exper.c:newuexp` ↔ `exper.js:newExperienceThreshold` | `0 <= lev <= 30` | 4×4 | 0.9 s |
| `xlev_to_rank` | `botl.c:xlev_to_rank` ↔ `exper.js:experienceRankIndex` | Every C int level | 3×3 | 0.2 s |
| `rounddiv` | `hack.c:rounddiv` ↔ `polyself.js:roundDiv` | `abs(x) <= 100000000`, `1 <= y <= 1000000` | 4×1 | 0.4 s |
| `Align2amask` | `align.h:Align2amask` ↔ `const.js:Align2amask` | Alignment in {-128, -1, 0, 1} | 3×3 | 0.8 s |
| `Amask2align` | `align.h:Amask2align` ↔ `const.js:Amask2align` | Every C int mask | 3×3 | 0.9 s |
| `acurr:StrDex` | `attrib.c:acurr` ↔ `attrib.js:currentAttribute` | Strength or Dexterity; corresponding six-element schar arrays; no gauntlets | 4×2 | 1.0 s |
| `acurrstr` | `attrib.c:acurrstr` ↔ `attrib.js:currentStrength` | Corresponding attribute arrays; no gauntlets | 5×3 | 0.3 s |
| `dbon:human` | `weapon.c:dbon` ↔ `weapon.js:heroStrengthDamageBonus` | Corresponding attribute arrays; no gauntlets; original human form | 8×8 | 0.5 s |
| `abon:human` | `weapon.c:abon` ↔ `uhitm.js:heroAttributeHitBonus` | Corresponding attribute arrays and level in 1..30; no gauntlets; original human form | 24×17 | 1.9 s |
| `acurr:all` | `attrib.c:acurr` ↔ `attrib.js:currentAttribute` | all six attributes; corresponding arrays, worn items, artifact identities and current body | 6×6 | 5.6 s |
| `dbon:all` | `weapon.c:dbon` ↔ `weapon.js:heroStrengthDamageBonus` | corresponding arrays/items; human and polymorphed forms | 8×8 | 0.3 s |
| `abon:forms` (slow) | `weapon.c:abon` ↔ `uhitm.js:heroAttributeHitBonus` | same; level 1..30; initial species data; corresponding Wizard deaths; **assumed** equal, pure dungeon difficulty in 1..32767 | 32×23 | 43.6 s |
| `experience:tables` (slow) | `exper.c:experience` ↔ `exper.js:monsterExperience` | initial tables; no monster inventory; any `uchar` monster level; `nk` 0..255; corresponding Amphibious option | 383 species domains, both log settings | 415.6 s |
| `mcalcmove:tables` (slow) | `mon.c:mcalcmove` ↔ `mon.js:mcalcmove` | initial tables; initialized fields; corresponding speed/mount/context; gallop 0..2^53; both moving modes | 383 species domains, both log settings | 175.5 s |
| `xytodir` | `cmd.c:xytodir` ↔ `cmd.js:xyToDirection` | Deltas inside C int; decl.c and const.js direction tables | 9×9 via `findIndex` | 0.8 s |
| `weapon_hit_bonus:state` | `weapon.c:weapon_hit_bonus` ↔ `skills.js:weaponSkillHitBonus` | Weapon null/uwep/uswapwep/unrelated; corresponding skills, role, twoweap, steed; objects[] tables | 1×1 joined | 10.3 s |
| `weapon_dam_bonus:state` (slow) | `weapon.c:weapon_dam_bonus` ↔ `skills.js:weaponSkillDamageBonus` | Same relation | 1×1 joined | 4.7 s |
| `is_animal:tables` | `mondata.h:is_animal` ↔ `mondata.js:monsterIsAnimal` | Same initial-species domain | 1×1 | 1.9 s |
| `noncorporeal:tables` | `mondata.h:noncorporeal` ↔ `mondata.js:monsterIsNoncorporeal` | Same domain; initial symbols | 1×1 | 3.6 s |
| `breathless:tables` | `mondata.h:breathless` ↔ `mondata.js:monsterIsBreathless` | Same domain; initial flags | 1×1 | 1.2 s |
| `passes_bars:tables` (slow) | `mondata.c:passes_bars` ↔ `mondata.js:monsterPassesBars` | Same domain; flags, sizes, symbols and attack table | 383×(1×1) | 15.1 s |
| `armor_to_dragon` (slow) | `polyself.c:armor_to_dragon` ↔ `polyself.js:dragonFormForArmor` | The 20 dragon scale/scale-mail otyps (101..120) | 1×1 | 4.3 s |
| `weight:stack` (slow) | `mkobj.c:weight` ↔ `mkobj.js:objectWeight` | Coins, dagger, food ration, globs and corpses (symbolic valid species); quan 1..100000, full unsigned owt, oeaten 0 | 12 partitions | 16.4 s |
| `verysmall:tables` | `mondata.h:verysmall` ↔ `mondata.js:monsterIsVerySmall` | Valid initial species; native/emitted size tables | 1×1 | 2.3 s |
| `haseyes:tables` | `mondata.h:haseyes` ↔ `mondata.js:monsterHasEyes` | Valid initial species; native/emitted flag tables | 1×1 | 1.5 s |
| `hates_silver:tables` | `mondata.c:hates_silver` ↔ `mondata.js:monsterSpeciesHatesSilver` | Valid initial species; pointer identity vs mons[PM_SHADE]/mons[PM_TENGU]; flags and symbols | 3×5 | 5.1 s |
| `mon_hates_blessings:state` | `mondata.c:mon_hates_blessings` ↔ `mondata.js:monsterHatesBlessings` | Valid species and shifter species cham 0..NUMMONS-1; mons[] pointer; native/emitted tables | 2×2 | 2.6 s |
| `mon_resistancebits:state` | `monst.h:mon_resistancebits` ↔ `mondata.js:monsterResistanceBits` | Valid species; ushort extrinsic/intrinsic masks 0..65535; native/emitted resists table | 1×1 | 1.3 s |
| `erosion_matters:tables` | `objnam.c:erosion_matters` ↔ `objnam.js:erosionMatters` | Every otyp 0..NUM_OBJECTS-1 and any oclass; native/emitted class and skill columns | 1×1 | 1.8 s |
| `is_damageable:tables` | `objclass.h:is_damageable` ↔ `object_properties.js:is_damageable` | Every initial otyp 0..480, including generic rows; any stored oclass | 1×1 | 11.66 s total |
| `primary_erosion:tables` | `objnam.c:readobjnam` primary test ↔ `objnam.js:objectAcceptsPrimaryErosion` | Erosion-mattering objects with matching oclass; material >= LIQUID | 1×1 | 4.8 s |
| `secondary_erosion:tables` | `objnam.c:readobjnam` secondary test ↔ `objnam.js:objectAcceptsSecondaryErosion` | Same guarded domain | 1×1 | 3.1 s |
| `weapon_type:tables` | `weapon.c:weapon_type` ↔ `skills.js:weaponSkillType` | Null or held object; any oclass; every otyp 0..NUM_OBJECTS-1 | 1×1 | 0.2 s |
| `bigmonst:tables` | `mondata.h:bigmonst` ↔ `mondata.js:monsterIsBig` | Valid initial species; native/emitted size tables | 1×1 | 2.1 s |
| `is_flyer:tables` | `mondata.h:is_flyer` ↔ `mondata.js:monsterIsFlyer` | Valid initial species; native/emitted flag1 tables | 1×1 | 2.1 s |
| `is_floater:tables` | `mondata.h:is_floater` ↔ `mondata.js:monsterIsFloater` | Valid initial species; native/emitted symbol tables | 2×2 | 3.7 s |
| `is_clinger:tables` | `mondata.h:is_clinger` ↔ `mondata.js:monsterIsClinger` | Valid initial species; native/emitted flag1 tables | 1×1 | 1.2 s |
| `is_swimmer:tables` | `mondata.h:is_swimmer` ↔ `mondata.js:monsterIsSwimmer` | Valid initial species; native/emitted flag1 tables | 1×1 | 1.3 s |
| `amphibious:tables` | `mondata.h:amphibious` ↔ `mondata.js:monsterIsAmphibious` | Valid initial species; native/emitted flag1 tables | 1×1 | 1.2 s |
| `passes_walls:tables` | `mondata.h:passes_walls` ↔ `mondata.js:monsterPassesWalls` | Valid initial species; native/emitted flag1 tables | 1×1 | 1.2 s |
| `can_teleport:tables` | `mondata.h:can_teleport` ↔ `mondata.js:monsterCanTeleport` | Valid initial species; native/emitted flag1 tables | 1×1 | 1.2 s |
| `control_teleport:tables` | `mondata.h:control_teleport` ↔ `mondata.js:monsterControlsTeleport` | Valid initial species; native/emitted flag1 tables | 1×1 | 1.2 s |
| `perceives:tables` | `mondata.h:perceives` ↔ `mondata.js:monsterPerceives` | Valid initial species; native/emitted flag1 tables | 1×1 | 1.3 s |
| `hides_under:tables` | `mondata.h:hides_under` ↔ `mondata.js:monsterHidesUnder` | Valid initial species; native/emitted flag1 tables | 1×1 | 1.2 s |
| `is_hider:tables` | `mondata.h:is_hider` ↔ `mondata.js:monsterIsHider` | Valid initial species; native/emitted flag1 tables | 1×1 | 1.2 s |
| `is_demon:tables` | `mondata.h:is_demon` ↔ `mondata.js:monsterIsDemon` | Valid initial species; native/emitted flag2 tables | 1×1 | 2.1 s |
| `is_golem:tables` | `mondata.h:is_golem` ↔ `mondata.js:monsterIsGolem` | Valid initial species; native/emitted symbol tables | 1×1 | 3.6 s |
| `is_giant:tables` | `mondata.h:is_giant` ↔ `mondata.js:monsterIsGiant` | Valid initial species; native/emitted flag2 tables | 1×1 | 1.3 s |
| `is_female:tables` | `mondata.h:is_female` ↔ `mondata.js:monsterIsFemale` | Valid initial species; native/emitted flag2 tables | 1×1 | 1.3 s |
| `throws_rocks:tables` | `mondata.h:throws_rocks` ↔ `mondata.js:monsterThrowsRocks` | Valid initial species; native/emitted flag2 tables | 1×1 | 1.3 s |
| `type_is_pname:tables` | `mondata.h:type_is_pname` ↔ `mondata.js:monsterHasProperName` | Valid initial species; native/emitted flag2 tables | 1×1 | 1.3 s |
| `is_silent:tables` | `mondata.h:is_silent` ↔ `mondata.js:monsterIsSilent` | Valid initial species; native/emitted sound tables | 1×1 | 3.3 s |
| `can_track:state` | `mondata.c:can_track` ↔ `mondata.js:canTrack` | Valid species; uwep null or one weapon with any signed-char oartifact; initial mons and artifact identity/name tables | 2×2 | 3.4 s |
| `is_weptool:tables` | `obj.h:is_weptool` ↔ `object_properties.js:isWeaponTool` | Held object; otyp 0..NUM_OBJECTS-1; oclass equals the row's oc_class; initial skill column | 1×1 | 4.4 s |
| `bimanual:tables` | `obj.h:bimanual` ↔ `object_properties.js:isBimanualObject` | Same relation; initial oc_big/oc_bimanual column | 1×1 | 1.8 s |
| `is_missile:tables` | `obj.h:is_missile` ↔ `object_properties.js:isMissileObject` | Same relation | 1×1 | 1.8 s |
| `is_ammo:tables` | `obj.h:is_ammo` ↔ `object_properties.js:isLauncherAmmunition` | Same relation | 1×1 | 1.9 s |
| `ammo_and_launcher:tables` | `obj.h:ammo_and_launcher` ↔ `object_properties.js:launcherMatchesAmmo` | Non-null ammo with the class relation; launcher null or any otyp 0..NUM_OBJECTS-1 | 1×1 | 2.3 s |
| `is_poisonable:tables` | `obj.h:is_poisonable` ↔ `object_properties.js:isPoisonableObject` | Held object, free oclass, otyp 0..NUM_OBJECTS-1; any signed-char oartifact; emitted ARTIFACT_DATA map | 1×1 | 2.8 s |
| `permapoisoned:tables` | `artifact.c:permapoisoned` ↔ `object_properties.js:isPermanentlyPoisonedObject` | Object present or null; any signed-char oartifact; emitted ARTIFACT_DATA map; otyp/oclass unread | 2×2 | <0.1 s |
| `is_blunt_weapon:tables` | `obj.h:is_blunt_weapon` ↔ `object_properties.js:isBluntWeapon` | Held object with the class relation; initial dir column | 1×1 | 1.9 s |
| `is_flimsy:tables` | `obj.h:is_flimsy` ↔ `object_properties.js:isFlimsyObject` | Held object, free oclass, otyp 0..NUM_OBJECTS-1; initial material map and name table | 1×1 | 2.3 s |
| `is_pick:tables` | `obj.h:is_pick` ↔ `object_properties.js:isPick` | Held object, free oclass, otyp 0..NUM_OBJECTS-1; initial skill column | 1×1 | 1.5 s |
| `is_axe:tables` | `obj.h:is_axe` ↔ `object_properties.js:isAxe` | Same relation | 1×1 | 1.5 s |
| `is_blade:tables` | `obj.h:is_blade` ↔ `object_properties.js:isBlade` | Same relation | 1×1 | 1.6 s |
| `is_wet_towel:state` | `obj.h:is_wet_towel` ↔ `object_properties.js:isWetTowel` | Any short otyp and signed-char spe; no table read | 2×2 | 1.3 s |
| `is_pole:tables` | `obj.h:is_pole` ↔ `object_properties.js:isPolearm` | Held object, free oclass, otyp 0..NUM_OBJECTS-1; any signed-char oartifact; emitted ARTIFACT_DATA map | 1×1 | 2.0 s |
| `is_sword:tables` | `obj.h:is_sword` ↔ `object_properties.js:isSword` | Held object, free oclass, otyp 0..NUM_OBJECTS-1; initial skill column | 1×1 | 1.4 s |
| `is_graystone:tables` | `obj.h:is_graystone` ↔ `object_properties.js:isGrayStone` | Any short otyp; four constants, no table read | 2×1 | 1.5 s |
| `throwing_weapon:tables` | `dothrow.c:throwing_weapon` ↔ `object_properties.js:isThrowingWeapon` | Held object with the class relation; initial skill and dir columns | 1×1 | 3.0 s |
| `is_multigen:tables` | `obj.h:is_multigen` ↔ `object_properties.js:isMultiGeneratedWeapon` | Held object, free oclass, otyp 0..NUM_OBJECTS-1; initial skill column | 1×1 | 1.5 s |
| `is_organic:tables` | `objclass.h:is_organic` ↔ `object_properties.js:objectIsOrganic` | Held object, free oclass, otyp 0..NUM_OBJECTS-1; initial material column | 1×1 | 2.0 s |
| `is_metallic:tables` | `objclass.h:is_metallic` ↔ `object_properties.js:objectIsMetallic` | Same relation and material column | 1×1 | 2.2 s |
| `is_rustprone:tables` | `objclass.h:is_rustprone` ↔ `object_properties.js:objectIsRustprone` | Same relation and material column | 1×1 | 2.0 s |
| `is_corrodeable:tables` | `objclass.h:is_corrodeable` ↔ `object_properties.js:objectIsCorrodeable` | Same relation and material column | 1×1 | 2.2 s |
| `is_crackable:tables` | `objclass.h:is_crackable` ↔ `object_properties.js:objectIsCrackable` | Held object reading its own oclass, otyp 0..NUM_OBJECTS-1; initial material column | 1×1 | 2.0 s |
| `is_flammable:tables` | `mkobj.c:is_flammable` ↔ `mkobj.js:objectIsFlammable` | Held object, otyp 0..NUM_OBJECTS-1; initial material and oprop columns; OBJECT_PROPERTY fireResistance rows | 1×1 | 0.5 s |
| `is_rottable:tables` | `mkobj.c:is_rottable` ↔ `mkobj.js:objectIsRottable` | Held object, otyp 0..NUM_OBJECTS-1; initial material column | 1×1 | 0.5 s |
| `lower_bits` | `isaac64.c:lower_bits` ↔ frozen `lower_bits` | Any uint64 input represented as BigInt | Straight line | 0.1 s |
| `upper_bits` | `isaac64.c:upper_bits` ↔ frozen `upper_bits` | Any uint64 input represented as BigInt | Straight line | <0.1 s |
| `isaac64_mix` | `isaac64.c:isaac64_mix` ↔ frozen same name | Eight initialized uint64 words | Complete unrolling; checked bound | 0.1 s |
| `isaac64_update` | `isaac64.c:isaac64_update` ↔ frozen same name | 256 initialized words in m/r; arbitrary uint64 a/b/c | Two loop invariants cover all 256 updates | 0.3 s |
| `isaac64_reseed` | `isaac64.c:isaac64_reseed` ↔ frozen same name | Initialized r and a/b/c; byte seed length 0..INT_MAX capped at 2048; m/n initially unconstrained | Loop invariants; all eight residues and over-cap case | 4.1 s |
| `isaac64_init` | `isaac64.c:isaac64_init` ↔ frozen same name | Byte seed length 0..INT_MAX capped at 2048; no initial context values assumed | Proved reseed summary | 0.1 s |
| `isaac64_next_uint64` | `isaac64.c:isaac64_next_uint64` ↔ frozen same name | Corresponding initialized context, `0 <= n <= 256` | Refill and nonempty cases | 0.1 s |
| `isaac64_seed_packing` | Packing loops in `rnd.c:init_isaac64` ↔ `rng.js:initRng` | LP64 unsigned long; any uint64 seed via BigInt, or equal integer Number in 0..2^53-1 | Complete unrolling; checked bound | 0.1 s |
| `cantvomit:tables` | `mondata.c:cantvomit` ↔ `mondata.js:speciesCannotVomit` | Valid initial species; pointer identity tests (rock mole, woodchuck, horses) vs species indices | 2×4 | 4.9 s |
| `noattacks:tables` | `mondata.c:noattacks` ↔ `mondata.js:monsterHasNoAttacks` | Valid initial species; corresponding six-record attack rows; AT_BOOM skipped on both sides | 2×2 | 4.7 s |
| `num_horns:tables` (slow) | `mondata.c:num_horns` ↔ `mondata.js:monsterHornCount` | Valid initial species; `monsndx(ptr)` pmidx switch vs emitted PM_* case labels | 3×3 | 39.3 s |
| `little_to_big:tables` (slow) | `mondata.c:little_to_big` ↔ `mondata.js:monsterOlderForm` | `0 <= montype < NUMMONS`; grownups[] scan vs growth vector read | 1×1 | 17.4 s |
| `big_to_little:tables` (slow) | `mondata.c:big_to_little` ↔ `mondata.js:monsterYoungerForm` | Same domain; first reverse edge of the ordered grownups[] table | 1×1 | 15.8 s |
| `big_little_match:tables` (slow) | `mondata.c:big_little_match` ↔ `mondata.js:monsterGrowthFamilyMatch` | Both indices valid species; `mons[].mlet` letter test then both growth directions | 1×1 | 85.5 s |
| `same_race:tables` (slow) | `mondata.c:same_race` ↔ `mondata.js:sameMonsterRace` | Both species valid; the is_* race macros and pointer identities vs flags/symbol reads and module constants | 1×1 | 243.5 s |
| `can_blow:tables` | `mondata.c:can_blow` ↔ `mondata.js:speciesCanBlow` | Valid species; monster distinct from `&gy.youmonst`, so the hero Strangled re-check stays dead | 2×4 | 9.7 s |
| `mbirth_limit:tables` | `makemon.c:mbirth_limit` ↔ `makemon.js:monsterBirthLimit` | Any C int species index; PM_NAZGUL/PM_ERINYS and MAXMONNO=120 agree | 3×3 | 1.1 s |
| `max_passive_dmg:state` (slow) | `mondata.c:max_passive_dmg` ↔ `mondata.js:maxPassiveMonsterDamage` | Valid species pair; `|mhp| <= 10^6`; Resists_Elem/monsterHas*Resistance enter as equal 0/1 call contracts (mon_resistancebits covers the masks) | 1×1 | 57.3 s |
| `warning_to_glyph` | `display.h:warning_to_glyph` ↔ `glyph_numbers.js:warningToGlyph` | `|mwarnlev| <= 2^30` | 1×1 | 2.1 s |
| `monnum_to_glyph` | `display.h:monnum_to_glyph` ↔ `glyph_numbers.js:monnumToGlyph` | `|mnum| <= 2^30`, any int32 gender | 2×2 | 1.8 s |
| `petnum_to_glyph` | `display.h:petnum_to_glyph` ↔ `glyph_numbers.js:petnumToGlyph` | Same domain | 2×2 | 1.6 s |
| `detected_monnum_to_glyph` | `display.h:detected_monnum_to_glyph` ↔ `glyph_numbers.js:detectedMonnumToGlyph` | Same domain | 2×2 | 1.7 s |
| `ridden_monnum_to_glyph` | `display.h:ridden_monnum_to_glyph` ↔ `glyph_numbers.js:riddenMonnumToGlyph` | Same domain | 2×2 | 1.6 s |
| `objnum_to_glyph` | `display.h:objnum_to_glyph` ↔ `glyph_numbers.js:objnumToGlyph` | `|onum| <= 2^30` | 1×1 | 1.4 s |
| `explosion_to_glyph` | `display.h:explosion_to_glyph` ↔ `glyph_numbers.js:explosionToGlyph` | expltyp int32; `|idx| <= 2^30` | 6×6 | 3.1 s |
| `altar_to_glyph` | `display.h:altar_to_glyph` ↔ `glyph_numbers.js:altarToGlyph` | Any int32 altar mask | 5×5 | 3.6 s |
| `cmap_to_glyph` | `display.h:cmap_to_glyph` ↔ `glyph_numbers.js:cmapToGlyph` | `|cmap_idx| <= 2^30`; modeled u.uz/dungeon_topology branch state; In_mines/on_level real, In_hell an equal 0/1 contract; port wallOffset = the selected base | 10×7 | 5.4 s |
| `zapdir_to_glyph` | `display.c:zapdir_to_glyph` ↔ `glyph_numbers.js:zapdirToGlyph` | dx/dy int32; beam_type 0..NUM_ZAP-1 (callers pass sgn() deltas and zap colors) | 1×1 | 4.6 s |
| `swallow_to_glyph` | `display.c:swallow_to_glyph` ↔ `display.js:swallowToGlyph` | mnum 0..2^27, loc S_sw_tl..S_sw_br; HHallucination clear (what_mon's sober arm) | 1×1 | 2.8 s |
| `glyph_is_monster` (slow) | `display.h:glyph_is_monster` ↔ `glyph_numbers.js:glyphIsMonster` | Every int32 glyph | 3×9 | 9.2 s |
| `glyph_is_pet` | `display.h:glyph_is_pet` ↔ `glyph_numbers.js:glyphIsPet` | Same domain | 3×3 | 2.4 s |
| `glyph_is_invisible` | `display.h:glyph_is_invisible` ↔ `glyph_numbers.js:glyphIsInvisible` | Same domain | 1×1 | 1.4 s |
| `glyph_is_detected_monster` | `display.h:glyph_is_detected_monster` ↔ `glyph_numbers.js:glyphIsDetectedMonster` | Same domain | 3×3 | 2.4 s |
| `glyph_is_ridden_monster` | `display.h:glyph_is_ridden_monster` ↔ `glyph_numbers.js:glyphIsRiddenMonster` | Same domain | 3×3 | 3.3 s |
| `glyph_is_body` | `display.h:glyph_is_body` ↔ `glyph_numbers.js:glyphIsBody` | Same domain | 3×3 | 2.8 s |
| `glyph_is_statue` | `display.h:glyph_is_statue` ↔ `glyph_numbers.js:glyphIsStatue` | Same domain | 3×5 | 5.4 s |
| `glyph_is_object` (slow) | `display.h:glyph_is_object` ↔ `glyph_numbers.js:glyphIsObject` | Same domain | 3×13 | 19.9 s |
| `glyph_is_trap` | `display.h:glyph_is_trap` ↔ `glyph_numbers.js:glyphIsTrap` | Same domain | 2×2 | 1.7 s |
| `glyph_is_cmap` | `display.h:glyph_is_cmap` ↔ `glyph_numbers.js:glyphIsCmap` | Same domain | 2×2 | 2.0 s |
| `glyph_is_swallow` | `display.h:glyph_is_swallow` ↔ `glyph_numbers.js:glyphIsSwallow` | Same domain | 2×2 | 1.9 s |
| `glyph_is_warning` | `display.h:glyph_is_warning` ↔ `glyph_numbers.js:glyphIsWarning` | Same domain | 2×2 | 1.9 s |
| `glyph_is_explosion` | `display.h:glyph_is_explosion` ↔ `glyph_numbers.js:glyphIsExplosion` | Same domain | 2×2 | 1.9 s |
| `glyph_is_cmap_zap` | `display.h:glyph_is_cmap_zap` ↔ `glyph_numbers.js:glyphIsCmapZap` | Same domain | 2×2 | 2.2 s |
| `glyph_to_mon` (slow) | `display.h:glyph_to_mon` ↔ `glyph_numbers.js:glyphToMon` | Every int32 glyph | 9×9 | 12.7 s |
| `glyph_to_obj` (slow) | `display.h:glyph_to_obj` ↔ `glyph_numbers.js:glyphToObj` | Same domain | 5×5 | 26.3 s |
| `glyph_to_swallow` (slow) | `display.h:glyph_to_swallow` ↔ `glyph_numbers.js:glyphToSwallow` | Same domain | 2×2 | 2.5 s |
| `glyph_to_warning` | `display.h:glyph_to_warning` ↔ `glyph_numbers.js:glyphToWarning` | Same domain | 2×2 | 2.4 s |
| `glyph_to_explosion` | `display.h:glyph_to_explosion` ↔ `glyph_numbers.js:glyphToExplosion` | Same domain | 2×2 | 2.5 s |
| `glyph_to_trap` | `display.h:glyph_to_trap` ↔ `glyph_numbers.js:glyphToTrap` | Same domain | 2×2 | 2.8 s |
| `glyph_to_cmap` | `glyphs.c:glyph_to_cmap` ↔ `getpos.js:glyphToCmapSymbol` | Terrain span GLYPH_CMAP_STONE_OFF..GLYPH_SWALLOW_OFF; port is null outside it | 10×7 | 8.0 s |

| `object_class:tables` | `objects.h:oc_class` ↔ `object_data.js:objectClassForType` | Every initial otyp 0..NUM_OBJECTS-1 (481 rows) | 1×1 | 1.4 s |
| `object_material:tables` (slow) | `objects.h:oc_material` ↔ `object_data.js:objectBaseMaterial` | Every initial otyp 0..NUM_OBJECTS-1 (481 rows) | 1×1 | 1.4 s |
| `object_weight:tables` (slow) | `objects.h:oc_weight` ↔ `object_data.js:objectBaseWeight` | Every initial otyp 0..NUM_OBJECTS-1 (481 rows) | 1×1 | 1.4 s |
| `object_cost:tables` (slow) | `objects.h:oc_cost` ↔ `object_data.js:objectBaseCost` | Every initial otyp 0..NUM_OBJECTS-1 (481 rows) | 1×1 | 1.4 s |
| `object_delay:tables` (slow) | `objects.h:oc_delay` ↔ `object_data.js:objectDelay` | Every initial otyp 0..NUM_OBJECTS-1 (481 rows) | 1×1 | 1.4 s |
| `object_property:tables` (slow) | `objects.h:oc_oprop` ↔ `object_data.js:objectPropertyId` | Every initial otyp 0..NUM_OBJECTS-1 (481 rows) | 1×1 | 1.4 s |
| `object_direction:tables` (slow) | `objects.h:oc_dir` ↔ `object_data.js:objectBaseDirection` | Every initial otyp 0..NUM_OBJECTS-1 (481 rows) | 1×1 | 1.3 s |
| `object_skill:tables` (slow) | `objects.h:oc_skill` ↔ `object_data.js:objectSkill` | Every initial otyp 0..NUM_OBJECTS-1 (481 rows) | 1×1 | 1.4 s |
| `object_bimanual:tables` (slow) | `objects.h:oc_bimanual` ↔ `object_data.js:objectBimanual` | Every initial otyp 0..NUM_OBJECTS-1 (481 rows) | 1×1 | 1.4 s |
| `object_merge:tables` (slow) | `objects.h:oc_merge` ↔ `object_data.js:objectMerge` | Every initial otyp 0..NUM_OBJECTS-1 (481 rows) | 1×1 | 1.7 s |
| `object_uses_known:tables` (slow) | `objects.h:oc_uses_known` ↔ `object_data.js:objectUsesKnown` | Every initial otyp 0..NUM_OBJECTS-1 (481 rows) | 1×1 | 1.4 s |
| `object_unique:tables` (slow) | `objects.h:oc_unique` ↔ `object_data.js:objectUnique` | Every initial otyp 0..NUM_OBJECTS-1 (481 rows) | 1×1 | 1.4 s |
| `object_magic:tables` (slow) | `objects.h:oc_magic` ↔ `object_data.js:objectMagic` | Every initial otyp 0..NUM_OBJECTS-1 (481 rows) | 1×1 | 1.4 s |
| `object_charged:tables` (slow) | `objects.h:oc_charged` ↔ `object_data.js:objectCharged` | Every initial otyp 0..NUM_OBJECTS-1 (481 rows) | 1×1 | 1.4 s |
| `object_class:outside` | Explicit port-only guarded C harness ↔ `object_data.js:objectClassForType` | Every int32 index outside 0..NUM_OBJECTS-1; result 0 | 1×1 | 1.4 s |
| `slithy:tables` | `mondata.h:slithy` ↔ `mondata.js:monsterIsSlithy` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.30 s total |
| `nolimbs:tables` | `mondata.h:nolimbs` ↔ `mondata.js:monsterHasNoLimbs` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.25 s total |
| `is_orc:tables` | `mondata.h:is_orc` ↔ `mondata.js:is_orc` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.22 s total |
| `is_elf:tables` | `mondata.h:is_elf` ↔ `mondata.js:is_elf` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.23 s total |
| `unsolid:tables` (slow) | `mondata.h:unsolid` ↔ `mondata.js:monsterIsUnsolid` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.24 s total |
| `is_neuter:tables` (slow) | `mondata.h:is_neuter` ↔ `mondata.js:is_neuter` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.19 s total |
| `amorphous:tables` (slow) | `mondata.h:amorphous` ↔ `mondata.js:monsterIsAmorphous` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.20 s total |
| `strongmonst:tables` (slow) | `mondata.h:strongmonst` ↔ `mondata.js:strongmonst` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.45 s total |
| `tunnels:tables` (slow) | `mondata.h:tunnels` ↔ `mondata.js:tunnels` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.26 s total |
| `needspick:tables` (slow) | `mondata.h:needspick` ↔ `mondata.js:needspick` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.26 s total |
| `notake:tables` (slow) | `mondata.h:notake` ↔ `mondata.js:notake` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.23 s total |
| `has_head:tables` (slow) | `mondata.h:has_head` ↔ `mondata.js:monsterHasHead` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.22 s total |
| `is_undead:tables` (slow) | `mondata.h:is_undead` ↔ `mondata.js:monsterIsUndead` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.20 s total |
| `is_human:tables` (slow) | `mondata.h:is_human` ↔ `mondata.js:monsterIsHuman` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.41 s total |
| `is_were:tables` (slow) | `mondata.h:is_were` ↔ `mondata.js:is_were` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.27 s total |
| `is_dwarf:tables` (slow) | `mondata.h:is_dwarf` ↔ `mondata.js:is_dwarf` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.20 s total |
| `is_gnome:tables` (slow) | `mondata.h:is_gnome` ↔ `mondata.js:is_gnome` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.19 s total |
| `is_domestic:tables` (slow) | `mondata.h:is_domestic` ↔ `mondata.js:is_domestic` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.16 s total |
| `is_mercenary:tables` (slow) | `mondata.h:is_mercenary` ↔ `mondata.js:is_mercenary` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.23 s total |
| `is_male:tables` (slow) | `mondata.h:is_male` ↔ `mondata.js:is_male` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.25 s total |
| `is_wanderer:tables` (slow) | `mondata.h:is_wanderer` ↔ `mondata.js:is_wanderer` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.21 s total |
| `is_lord:tables` (slow) | `mondata.h:is_lord` ↔ `mondata.js:is_lord` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.23 s total |
| `is_prince:tables` (slow) | `mondata.h:is_prince` ↔ `mondata.js:is_prince` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.33 s total |
| `is_minion:tables` (slow) | `mondata.h:is_minion` ↔ `mondata.js:is_minion` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.29 s total |
| `lays_eggs:tables` (slow) | `mondata.h:lays_eggs` ↔ `mondata.js:lays_eggs` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.30 s total |
| `regenerates:tables` (slow) | `mondata.h:regenerates` ↔ `mondata.js:regenerates` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.30 s total |
| `acidic:tables` (slow) | `mondata.h:acidic` ↔ `mondata.js:acidic` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.32 s total |
| `poisonous:tables` (slow) | `mondata.h:poisonous` ↔ `mondata.js:poisonous` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.61 s total |
| `carnivorous:tables` (slow) | `mondata.h:carnivorous` ↔ `mondata.js:carnivorous` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.74 s total |
| `herbivorous:tables` (slow) | `mondata.h:herbivorous` ↔ `mondata.js:herbivorous` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.56 s total |
| `metallivorous:tables` (slow) | `mondata.h:metallivorous` ↔ `mondata.js:metallivorous` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.27 s total |
| `polyok:tables` (slow) | `mondata.h:polyok` ↔ `mondata.js:polyok` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.32 s total |
| `is_shapeshifter:tables` (slow) | `mondata.h:is_shapeshifter` ↔ `mondata.js:is_shapeshifter` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.29 s total |
| `likes_gold:tables` (slow) | `mondata.h:likes_gold` ↔ `mondata.js:likes_gold` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.31 s total |
| `likes_gems:tables` (slow) | `mondata.h:likes_gems` ↔ `mondata.js:likes_gems` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.32 s total |
| `likes_magic:tables` (slow) | `mondata.h:likes_magic` ↔ `mondata.js:likes_magic` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.59 s total |
| `thick_skinned:tables` (slow) | `mondata.h:thick_skinned` ↔ `mondata.js:monsterIsThickSkinned` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.35 s total |
| `is_displacer:tables` (slow) | `mondata.h:is_displacer` ↔ `mondata.js:monsterIsDisplacer` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.08 s total |
| `is_armed:tables` (slow) | `mondata.h:is_armed` ↔ `mondata.js:speciesHasWeaponAttack` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 2×2 | 4.32 s total |
| `infravision:tables` (slow) | `mondata.h:infravision` ↔ `mondata.js:infravision` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.07 s total |
| `infravisible:tables` (slow) | `mondata.h:infravisible` ↔ `mondata.js:infravisible` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 2.24 s total |
| `cant_drown:tables` (slow) | `mondata.h:cant_drown` ↔ `mondata.js:cant_drown` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 2×3 | 3.23 s total |
| `cantwield:tables` (slow) | `mondata.h:cantwield` ↔ `mondata.js:cantwield` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 2×2 | 2.50 s total |
| `cantweararm:tables` (slow) | `mondata.h:cantweararm` ↔ `mondata.js:cantweararm` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 383×(1×1) | 10.38 s total |
| `could_twoweap:tables` (slow) | `mondata.h:could_twoweap` ↔ `mondata.js:could_twoweap` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 1×1 | 3.97 s total |
| `eggs_in_water:tables` (slow) | `mondata.h:eggs_in_water` ↔ `mondata.js:eggs_in_water` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 2×3 | 2.84 s total |
| `likes_objs:tables` (slow) | `mondata.h:likes_objs` ↔ `mondata.js:likes_objs` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 2×3 | 5.75 s total |
| `is_ndemon:tables` (slow) | `mondata.h:is_ndemon` ↔ `mondata.js:is_ndemon` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 2×3 | 2.60 s total |
| `is_dlord:tables` (slow) | `mondata.h:is_dlord` ↔ `mondata.js:is_dlord` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 2×2 | 2.50 s total |
| `is_dprince:tables` (slow) | `mondata.h:is_dprince` ↔ `mondata.js:is_dprince` | All species 0..NUMMONS-1 (383); native pointer `&mons[species]`; initial tables | 2×2 | 2.50 s total |



| `is_launcher:tables` (slow) | `obj.h:is_launcher` ↔ `object_properties.js:is_launcher` | Every object type 0..480; any signed-char stored oclass; initial columns | 1×1 | 2.44 s total |
| `is_spear:tables` (slow) | `obj.h:is_spear` ↔ `object_properties.js:is_spear` | Every object type 0..480; any signed-char stored oclass; initial columns | 1×1 | 2.30 s total |
| `is_shield:tables` (slow) | `obj.h:is_shield` ↔ `object_properties.js:is_shield` | Every object type 0..480; any signed-char stored oclass; initial columns | 1×1 | 2.41 s total |
| `is_helmet:tables` (slow) | `obj.h:is_helmet` ↔ `object_properties.js:is_helmet` | Every object type 0..480; any signed-char stored oclass; initial columns | 1×1 | 2.35 s total |
| `is_boots:tables` (slow) | `obj.h:is_boots` ↔ `object_properties.js:is_boots` | Every object type 0..480; any signed-char stored oclass; initial columns | 1×1 | 2.33 s total |
| `is_gloves:tables` (slow) | `obj.h:is_gloves` ↔ `object_properties.js:is_gloves` | Every object type 0..480; any signed-char stored oclass; initial columns | 1×1 | 2.28 s total |
| `is_cloak:tables` (slow) | `obj.h:is_cloak` ↔ `object_properties.js:is_cloak` | Every object type 0..480; any signed-char stored oclass; initial columns | 1×1 | 2.31 s total |
| `is_shirt:tables` (slow) | `obj.h:is_shirt` ↔ `object_properties.js:is_shirt` | Every object type 0..480; any signed-char stored oclass; initial columns | 1×1 | 2.27 s total |
| `is_suit:tables` (slow) | `obj.h:is_suit` ↔ `object_properties.js:is_suit` | Every object type 0..480; any signed-char stored oclass; initial columns | 1×1 | 2.28 s total |
| `is_elven_armor:tables` (slow) | `obj.h:is_elven_armor` ↔ `object_properties.js:is_elven_armor` | Every object type 0..480; fixed type sets, oclass unread | 2×5 | 2.59 s total |
| `is_elven_weapon:tables` (slow) | `obj.h:is_elven_weapon` ↔ `object_properties.js:is_elven_weapon` | Every object type 0..480; fixed type sets, oclass unread | 2×6 | 2.80 s total |
| `pair_of:tables` (slow) | `obj.h:pair_of` ↔ `object_properties.js:pair_of` | Every object type 0..480; any signed-char stored oclass; initial columns | 1×1 | 2.74 s total |
| `matching_launcher:tables` (slow) | `obj.h:matching_launcher` ↔ `object_properties.js:matching_launcher` | Every ammo/launcher type pair in 0..480; non-null ammo, nullable launcher | 1×1 | 2.54 s total |
| `object_armcat:tables` (slow) | `objclass.h:oc_armcat` ↔ `object_data.js:oc_armcat` | Every initial object type 0..480, including generic rows; independent initializers | 1×1 | 1.80 s total |
| `object_armor_ac:tables` (slow) | `objclass.h:a_ac` ↔ `object_data.js:a_ac` | Every initial object type 0..480, including generic rows; independent initializers | 1×1 | 1.85 s total |
| `object_armor_can:tables` (slow) | `objclass.h:a_can` ↔ `object_data.js:a_can` | Every initial object type 0..480, including generic rows; independent initializers | 1×1 | 1.81 s total |
| `object_level:tables` (slow) | `objclass.h:oc_level` ↔ `object_data.js:oc_level` | Every initial object type 0..480, including generic rows; independent initializers | 1×1 | 1.82 s total |
| `object_nutrition:tables` (slow) | `objclass.h:oc_nutrition` ↔ `object_data.js:oc_nutrition` | Every initial object type 0..480, including generic rows; independent initializers | 1×1 | 1.80 s total |
| `object_color:tables` (slow) | `objclass.h:oc_color` ↔ `object_data.js:oc_color` | Every initial object type 0..480, including generic rows; independent initializers | 1×1 | 1.87 s total |
| `object_prob:tables` (slow) | `objclass.h:oc_prob` ↔ `object_data.js:oc_prob` | Every initial object type 0..480, including generic rows; independent initializers | 1×1 | 1.91 s total |
| `object_nowish:tables` (slow) | `objclass.h:oc_nowish` ↔ `object_data.js:oc_nowish` | Every initial object type 0..480, including generic rows; independent initializers | 1×1 | 1.96 s total |
| `object_hitbon:tables` (slow) | `objclass.h:oc_hitbon` ↔ `object_data.js:oc_hitbon` | Every initial object type 0..480, including generic rows; independent initializers | 1×1 | 1.78 s total |
| `object_wsdam:tables` (slow) | `objclass.h:oc_wsdam` ↔ `object_data.js:oc_wsdam` | Every initial object type 0..480, including generic rows; independent initializers | 1×1 | 1.91 s total |
| `object_wldam:tables` (slow) | `objclass.h:oc_wldam` ↔ `object_data.js:oc_wldam` | Every initial object type 0..480, including generic rows; independent initializers | 1×1 | 1.91 s total |
| `OBJ_NAME:indices` (slow) | `objclass.h:OBJ_NAME` ↔ `object_data.js:OBJ_NAME` | Initial index = otyp, 0..480, before description shuffling; nullable contents | 1×2 | 9.04 s total |
| `OBJ_DESCR:indices` (slow) | `objclass.h:OBJ_DESCR` ↔ `o_init.js:OBJ_DESCR` | Initial index = otyp, 0..480, before description shuffling; nullable contents | 1×2 | 10.42 s total |

**Flag-owner batch.** The 50 added claims execute the real `mondata.h`
macros and the canonical `mondata.js` owners over every species index
`0 <= species < NUMMONS` (383). The native pointer is `&mons[species]`.
Each side evaluates its own initial species and attack tables; table equality
is not assumed. Runtime quest retargeting, Erinys changes and seduction attack
replacement remain outside this initial-table relation. `cantweararm` splits
all 383 species into exhaustive partitions; the other new claims keep the
index symbolic. Both RNG logging modes are checked.

Every new claim rejects a null native pointer at species 0 and kills one
emitted-JavaScript mutant. Mutants pin species 0, except weapon attacks use
hobbit (43) and the second two-weapon attack uses ettin (174). These negative
checks stay on one concrete row. The `Number(boolean)` executor extension
models exactly 0 or 1 and has a failing-before regression test.

The new claims cost **132.28 s** locally including proofs, probes and
mutants; the table above reports each full total. Only `slithy`, `nolimbs`,
`is_orc` and `is_elf` are fast, totaling **9.00 s** locally. The other
46 claims are slow, including every addition above 5 seconds.
`passes_bars:tables` is now slow: its canonical helper calls cost
**12.68 s** in this complete run. The complete
ledger-writing run passed **223 claims, 231 domain probes and 242
mutant checks**. Hosted CI times are not measured locally.

The runtime migration keeps 56 existing macro-owner names and adds 48 owners
named after C. All 104 have a first-line `mondata.h` citation in `mondata.ts`.
The requested flag-token inventory falls from **1,195 to 235**; direct
`MONSTER_FLAGS1/2/3[...]` reads fall from **312 to 75**, with only **10** outside
`mondata.ts` and `monster_data.ts`. C's raw mask copies, warning intersections,
food-collection bit, migration matching and wants/waiting masks remain cited.
The copied armed-species set is gone; `is_armed` scans the real attack row.
The corrected `nolimbs` owner requires all of `M1_NOLIMBS` (`0x6000`). Behavior
regressions preserve jackals' walking and staggering verbs and jaguars'
claw-swing miss messages without changing species data. Executor regressions
cover every 32-bit flag word, rejection of the old mask, and the high
metallivore bit.

The serial base/branch session comparison has **0 changed outcomes or first
differences** across 344 sessions: public **43/44**, first 300 holdout **300/300**.
Seed2200 retains its pre-existing screen difference at global step 158 and has
no RNG difference. No full game suite, pool, eval or fresh corpus was run.
The branch's 3,000 fresh-session CI gate remains for the orchestrator.

The serial CI-mode ledger checks passed: base **139 fast claims in 440.59 s**,
branch **142 in 444.59 s**. The measured increase is **4.00 s** locally (28.00
s at 7× that increase). The branch check validates all 223 ledger rows and
explicitly skips 81 slow claims, which passed in the complete run.

Direct claims now target 80 of the 104 macro owners. Direct claims remain
deferred for `always_hostile`, `is_mplayer`, `is_covetous`, `slimeproof`,
`corpse_eater`, `is_whirly`, `is_unicorn`, `is_bat`, `is_vampire`,
`is_mind_flayer`, `telepathic`, `is_wooden`, `hates_light`, `is_rider`,
`nonliving`, `weirdnonliving`, `always_peaceful`, `extra_nasty`,
`passes_rocks`, `eyecount`, `your_race`, `race_hostile`, `race_peaceful`,
`grounded`. These owners are included in the runtime migration.

**Bounded-state batch.** The complete 52-claim run passed in **772.20 s**,
including **56 domain probes** and **60 mutant checks**, and wrote the ledger
only after success. The bounded-state path counts above are after deterministic
joining; their branch conditions and obligations remain in the proof terms.
Eleven additional claims execute the pinned C
bodies and emitted callbacks. Six scan a symbolic `permonst.mattk[6]`:
all four `uchar` fields in every slot range independently over 0..255.
The related JS row has the same six records. No initial species table is
assumed by these six claims. Query types are the constants used by the real
helpers: engulfing, weapon attacks, digesting, wrapping and sticking.
`attacktype_fordmg` and `dmgtype_fromattack` are observed for presence;
which matching pointer they return is outside the projection. `dmgtype`
is exercised through the complete `sticks` predicate. Null-pointer probes
produce native safety counterexamples, and each claim kills a result mutant.

The capacity claims cover original and polymorphed forms across every valid
initial species index, both wounded-leg bits, air-level identity, a nullable
mount with any valid initial species, and pending boots. Property sources use
explicit representative masks: intrinsic/timed sources are zero or `TIMEOUT`,
boot levitation uses `W_ARMF`, other levitation uses `W_RING`, flying uses
`W_ARMC`, and terrain/trap blocks use `FROMOUTSIDE`/`I_SPECIAL`. The JS records
represent those same source-presence flags. Their projected movement fields
and trap/stealth blocks satisfy `float_vs_flight`/`steed_vs_stealth` at entry.
The air-level pair is initialized and nonzero; native `disp.botl` is already
true. These are declared entry restrictions, not a theorem about every raw
property mask or caller initialization.

`weight_cap` executes both property helpers and proves restoration of
ELevitation, BLevitation, BFlying and BStealth. Its result is proved in
1..1000. It uses the previously proved `acurr:all` summary, now also checked
for a 3..125 result range; the Strength condensation still executes on both
sides. The inventory claims use this proved, pure capacity summary. Selecting
a composed claim also selects its prerequisites; a failed prerequisite fails
the composition. The existing assumed dungeon-difficulty contract is unchanged.

Inventory is an acyclic, unshared `nobj` chain of length 0..4, related to a JS
array in the same order. Each slot independently chooses gold, boulders,
daggers or food rations. Quantities and cached weights are 0..100000, classes
correspond, and partly eaten food is excluded. Non-coin, non-skipped cached
weights equal initial metadata weight times quantity at entry. `calc_capacity`
allows extra weight in [-1000000,1000000], keeping C arithmetic defined.
The native `gw.wc` cache is tracked for subsequent reads but has no JS exit
counterpart. The scalar loop-invariant interface cannot havoc linked pointers;
these claims explicitly stop at four objects and make no unbounded-chain claim.

`sgn:inline` compares every C int with the actual `dx` initializer in emitted
`muse.js:aimedDirection`. The supplied locals encode that int as `target.x`
with `monster.mx = 0`. The enclosing function and the earlier assignments
establishing those locals are excluded. No game helper was invented.

The executors now model fixed-array pointer provenance and one-past bounds,
callback destructuring and short-circuiting, ordered array reduction, and
per-path writes to declared C fields. Every modeled C write must restore its
entry value unless explicitly recorded as native-only exit state. Optional
deterministic joining retains branch guards, values, stream positions and
pre-join safety obligations; it avoids enumerating the same property branches
repeatedly. General heap allocation, cyclic/shared lists, arbitrary property
masks, other object types, containers, partial meals, live species-table
mutations and caller establishment of these relations remain unproved.

**Geometry and species batch.** The eight added claims execute the real
emitted functions. Four C harness functions expand the actual `mondata.h`
macros; `isok`, `online2`, `sliparm` and `breakarm` execute the native function
bodies. Boolean JS returns correspond exactly to native 0/1; native 2 does
not correspond to JS true. The language executor also accepts object
shorthand, which the armor helpers already use. Three new language tests
failed before these extensions; a fourth checks that non-Boolean native
integers remain distinguishable.

The geometry inputs span every `coordxy` value, including off-map squares.
Their probes leave that representation domain: x=65537 narrows to 1 in
`isok`, and x0=65536 narrows to 0 in `online2`. Each produces a concrete
return difference. Each of the six species claims assumes a non-null
`&mons[species]` and `0 <= species < NUMMONS`, with NUMMONS read through
clang. Native fields retain `mons_init` values and emitted table fields
retain their initial values. The two tables are read independently, without
assuming equal field values. These claims exclude live table changes and do
not prove that initialization or callers establish the entry relation.
Their probes remove pointer validity and produce concrete null-dereference
obligations. Those are safety failures, not defined return differences.
All eight claims also kill an emitted-JS mutant with a concrete return
difference. Unsupported syntax and solver timeouts cannot satisfy these checks.

Three simple flag predicates keep the species symbolic over all valid indices.
Ceiling hiding and armor fit check every one of the 383 species as a separate,
satisfiable domain in both logging modes. The initial combined ceiling-hider
query was stopped without a result; exhaustive partitions preserve the whole
domain and finish promptly. The batch changes no game source or behavior.

The selection follows common movement and body checks: `isok` and `online2`
are used by `hack`, `mon` and pet movement; minds and hands affect monster
actions; ceiling hiding and armor fit affect movement and polymorphs. The RNG
ledgers record 226,931 eval and 28,208 public random calls under `m_move`,
which uses the mind/hand predicates; these are random-call counts, not counts
of predicate invocations. That batch deferred carrying capacity because
`weight_cap` temporarily changes property state and `calc_capacity` reaches
inventory chains. `dmgtype` needs attack-pointer traversal and JS callbacks;
`sgn` had no standalone emitted counterpart; the bounded-state batch below checks an actual inline initializer. No port fidelity bug was found
within the eight stated domains.

**Gameplay-leaf batch (fv-equivalence-batch-3).** Nine more claims cover the
direction, weapon-skill, species-table and object-weight layer. `xytodir`
pairs cmd.c's scan over decl.c's `xdir`/`ydir` with the port's
`Array.findIndex` (the executor now models `findIndex` with the same
short-circuit element scan as `some`). The two weapon-skill claims execute
the real `weapon_hit_bonus`/`weapon_dam_bonus` switches over a symbolic
`u.weapon_skills[]` array; a fixed state array of aggregates can now be
selected symbolically and read member by member (the skill member's
declared width comes from the spec's state entry, since no clang node
reaches that read). `const char[]` locals initialized by string literals
(`weapon_hit_bonus`'s `bad_skill`) are accepted as opaque buffers. The
weapon identity relation covers null, uwep, uswapwep and an unrelated
object, with `u.twoweap` implying both slots wielded (wield.c) and every
skill entry at or below expert except martial arts (u_init.c grants
grand master only there; the switches would call `impossible()` above
expert). `passes_bars` executes the mondata.c body including its `dmgtype`
scan; `armor_to_dragon` checks the 20 dragon otyps (C returns `NON_PM`
where the port returns null and callers test truthiness).

`weight:stack` found a wizard-mode divergence: C's glob and heavy-iron-ball
branches return `(int) obj->owt`, so the readobjnam wizard override that
creates one glob weighing 107374336 x 20 = 2147486720 makes C return the
negative int32 wrap while the port returns the unsigned value. The port is
left unchanged: C stores weight() back into the unsigned owt at ~90 sites,
and wrapping only the return would leave negative cached weights in the port
(the glob shrink timer rejects them). The claim's domain therefore bounds
owt at INT_MAX. The
claim also documents two orderings the entry domain keeps consistent:
C tests the CORPSE type before the coin class while the port tests the
class first (oclass always equals the type's metadata class), and the glob
branch precedes the coin branch on both sides because globs only exist as
food. Partly eaten food stays with the difftest: eaten_stat's nutrition
divisor is table-selected and the unsplit query times out. Corpses keep a
symbolic but always-valid species (mkobj assigns one), chunked into
48-wide intervals so the mons[] weight select stays decidable; the
initial-table correspondence (`objects[].oc_weight` = `OBJECT_WEIGHT`,
`mons[].cwt` = `MONSTER_BODY_META[][0]`) is the same assumption the
inventory chain claims make for cached owt.

**Species/monster/object predicate batch (fv-equivalence-batch-4).** Ten
more claims extend the table layer to heavily used one-function
predicates. Five species/monster rows execute the real mondata.c bodies
(`hates_silver`, `mon_hates_blessings`) or macro-expansion harnesses
(`verysmall`, `haseyes`, `mon_resistancebits`): `hates_silver` compares
the native `ptr == &mons[PM_SHADE]`/`PM_TENGU` pointer identities with
the emitted species-index tests; `mon_hates_blessings` adds the
`monst.cham` shifter field (monst.h `is_vampshifter` names three
species; the emitted `MONSTER_SYMBOL[cham] === S_VAMPIRE` select agrees
over the whole initial symbol table, and the executor models only
in-bounds reads, so `cham == NON_PM` and an absent `cham` field — both
runtime-false through an undefined read — stay outside the symbolic
domain); `mon_resistancebits` ORs the native `uchar mresists` column
with the two `unsigned short` monst masks, which fit the emitted int32
`|` exactly. Five object rows pair objnam.c:erosion_matters and the
objclass.h erosion macros (through `mkobj.c:is_flammable`/`is_rottable`,
executed for real) with the emitted wish-path predicates, and
weapon.c:weapon_type with `skills.js:weaponSkillType` (the `Math.abs`
of the signed `objects[].oc_skill` column, including the negative
launcher and ammo entries). The executor now models `typeof` (with its
BigInt and `typeof null === 'object'` cases) because
`o_init.js:objectMaterial` branches on it; a language test pins the
classification and a mutant of it.

The object claims document three domain facts. First, otyp rows 0..17
(the illegal object and the class markers) carry material 0, where C's
`omat <= WOOD && omat != LIQUID` is true but the port's `material > 1`
is false. Those rows do reach a `struct obj`: pager.c:object_from_map
builds a temporary naming object with the generic otyp when a remembered
or hallucinated class glyph has no object at that spot, and doname's
add_erosion_words runs is_damageable on it. The divergence is
unobservable there and unreachable elsewhere: the fake object comes from
mksobj(glyphotyp, FALSE, FALSE), which copies cg.zeroobj (oeroded,
oeroded2 and oerodeproof zero, rknown false; mkobj_erosions runs only
under init), so add_erosion_words prints nothing either way, and the
caller deallocates the object at once (pager.c:376); the generic rows
are oc_nowish, so readobjnam's other is_damageable call cannot name one,
and neither mkobj nor mksobj places them. `is_damageable` therefore
keeps only rows with a real material (>= LIQUID), while
`erosion_matters`/`weapon_type`, which agree on every row, keep the
whole 0..NUM_OBJECTS-1 range. Second, C's
`is_flammable` excludes candles, `WAN_FIRE` and fire-resistance-oprop
objects while the port's inline material test does not; inside the
`erosion_matters` guard (weapon/armor/ball/chain or a weapon-tool, with
oclass equal to `objects[otyp].oc_class` as mkobj keeps it) no surviving
row disagrees, which is exactly the domain of readobjnam's two erosion
tests and of not_fully_identified's `is_damageable` call. The
fire-resistance oprop rows (two dragon-scale armors and one ring) all
have non-flammable materials. Third, `objectMaterial` reads the per-game
material map, which o_init.c:shuffle reorders identically on both sides;
the claims relate the initial emitted table and leave that shuffle
correspondence to future work. No port fidelity bug was found: the
native `oc_material`, `oc_class` and `oc_skill` columns equal the emitted
`OBJECT_MATERIAL`, class and `OBJECT_SUBTYPE` entries at every otyp
(checked concretely over the whole table before proving).

**Named mondata predicate batch (fv-equivalence-batch-5).** Twenty more
claims cover the predicates PR 610 named as C-shaped port functions, one
claim per predicate over all 383 valid initial species in the
verysmall/haseyes shape. Nineteen pair one mondata.h macro — expanded by a
new harness wrapper each — with its `monster_data.js` function: the flag1
bit predicates (`is_flyer`, `is_clinger`, `is_swimmer`, `amphibious`,
`passes_walls`, `can_teleport`, `control_teleport`, `perceives`,
`hides_under`, `is_hider`), the flag2 bit predicates (`is_demon`,
`is_giant`, `is_female`, `throws_rocks`, `type_is_pname`), the size
comparison `bigmonst`, and the symbol/sound comparisons `is_floater`,
`is_golem`, `is_silent`. Every M1/M2 mask tested is below 2^31, so the
emitted int32 `&` is exact even where a `MONSTER_FLAGS2` entry exceeds
INT_MAX: ToInt32 wraps the stored word but preserves the tested low bits.

`can_track:state` executes the real `mondata.c:can_track` body, including
`artifact.c:is_art` through obj.h's `u_wield_art(ART_EXCALIBUR)`. The
entry relation adds the wielded weapon to the species relation: the
native `uwep` pointer is null exactly when both `game.uwep` and
`game.u.uwep` are null (wield.c keeps one wielded slot), the weapon
artifact index is a symbolic obj.h `char`, and `artifact.js:artifactById`
executes for real against the emitted `ARTIFACT_DATA` identity/name map
that `initializeArtifacts` copies — the same runtime-map relation the
`acurr:all` family assumes. `haseyes(ptr)` and `monsterHasEyes(mnum)`
then agree by the `haseyes:tables` tables. No executor extension was
needed; a new language test pins the composed cross-module
Map-lookup/optional-member-chain shape `canTrack` uses. No port fidelity
bug was found in the twenty stated domains.

**Object-class predicate batch (fv-equivalence-batch-6).** Eighteen more
claims pair the obj.h/objclass.h object-class macros — and the one real
function among them, dothrow.c:throwing_weapon and artifact.c:permapoisoned —
with `object_properties.js` over the initial objects[] table. Sixteen
macro-expansion harness wrappers were added to
`verification/equivalence/harness/object_predicates.c`; dothrow.c joined the
translated C files so `throwing_weapon`'s real body executes.

The entry relations come in three shapes. The class-guarded macros
(is_weptool, bimanual, is_missile, is_ammo, ammo_and_launcher,
is_blunt_weapon, throwing_weapon) read `otmp->oclass`, which the port routes
through `objectClass()`'s `oclass || objectClassForType(otyp)` fallback; the
claims assume the mkobj invariant that oclass equals
`objects[otyp].oc_class` (and no initial row carries class 0), so the
fallback never fires and its OBJECT_BASES loop stays outside the entry
domains — dropping that equality is each claim's pinned probe. The
direct-oclass macros (is_pick, is_axe, is_blade, is_sword, is_multigen,
is_poisonable) and the class-free ones (is_flimsy, is_graystone,
is_wet_towel) keep oclass (where read) symbolic and free. `permapoisoned`
accepts a null object on both sides, so its claim includes the null case.
The artifact-backed predicates (is_poisonable, permapoisoned, is_pole)
relate a signed-char oartifact and the emitted ARTIFACT_DATA runtime map
exactly as `can_track:state` does: only id ART_GRIMTOOTH carries
invokePower "fling-poison" and only id ART_SNICKERSNEE is named
"Snickersnee".

The native oc_skill, oc_class, oc_dir, oc_bimanual (the oc_big alias),
oc_charged and oc_material columns and the OBJ_NAME strings were checked
equal to the emitted OBJECT_SUBTYPE, class, OBJECT_DIR, OBJECT_BIMANUAL,
OBJECT_CHARGED, OBJECT_MATERIAL and OBJECT_NAMES tables at every otyp in
0..NUM_OBJECTS-1 before proving (OBJECT_NAMES names only RUBBER_HOSE
"rubber hose"). is_flimsy covers the zero-material generic rows 0..17 too:
C's `oc_material <= LEATHER` and the port's `objectMaterial(...) <= LEATHER`
both read material 0 there and agree, unlike is_damageable's port test.
`is_ammo`/`ammo_and_launcher` each had two port functions; the claims prove
`isLauncherAmmunition`/`launcherMatchesAmmo`, and the unclaimed duplicates
(`isAmmunition`, `ammunitionMatchesLauncher`) were deleted once every caller
moved to the proved pair (the two forms agree because every engine object
carries the nonzero oclass that C mksobj() assigns). `objectUsesCharges` has
no single C counterpart — it summarizes objnam.c:doname's `is_weptool`-routed
switch, whose WAND/tool charge display also depends on `known`, lamplit
candles and the candelabrum — and is not claimed.

One executor extension was needed: a symbolic index into a string array
(`OBJECT_NAMES[otyp] === 'rubber hose'`) now builds one z3 String term, with
null entries encoded as the empty string; `===`/`!==` (including against
null, undefined and the empty-string literal), `??` and truthiness stay
exact — an in-bounds element read is never undefined, the empty encoding is
exactly the null case, and `value === ''` is false on every row because the
table excludes empty strings — while `typeof` and coercive `==` on such a
term are rejected, as is a symbolic read of a mixed-kind array, a record
lookup whose keys collide with the null coercion, and a record lookup whose
key can name an inherited `Object.prototype` member (`REC['constructor']`
is a function, not undefined) that the record does not own. Object
literals with a `__proto__` key (a prototype, not a field) and string
arrays whose elements are already symbolic table reads are rejected too. Branch joins merge only
two table terms; a literal string keeps its own path so a real empty string
cannot become the null encoding. Equality also distinguishes a literal
empty string from a table term simplified to the null encoding. Thirteen language
tests pin the selection, the null distinctions, the empty-string comparison,
the record lookup, branch joins, and the rejections. The focused
executor/query/selection suite is now 99 passing tests. No port fidelity bug
was found in the eighteen stated domains.

The complete review round 3 run proved all 109 claims in **1041.57 s**, including
**116 domain probes** and **122 mutant checks**, and checked the existing
109-row ledger. The eighteen object claims each have one domain probe and
one killed mutant. The prior CI-parity
`--skip-slow --check-ledger` run passed in **456.3 s**; every new claim is
fast, so the `equivalence` job keeps its slot and the two slow table claims
are unchanged. The focused executor/query/selection suite is now **96
passing tests** (the review rounds added the nullish-comparison,
empty-string, record-lookup, mixed-array and branch-join tests), and the
**36 ledger CLI tests** passed. `npm run compile` and `npm run check` passed.
No game source, session corpus, or frozen file
was changed beyond the citation comments.

**Material predicate batch (fv-equivalence-batch-7).** Seven more claims
give each objclass.h material macro and mkobj.c's two real erosion
predicates exactly one named port function and move every inline copy to
call its owner. objclass.h `is_organic`, `is_metallic`, `is_rustprone`,
`is_crackable` and `is_corrodeable` live in `object_properties.js`
(`objectIsOrganic`, `objectIsMetallic`, `objectIsRustprone`,
`objectIsCrackable`, `objectIsCorrodeable`); mkobj.c `is_flammable()` and
`is_rottable()` live in `mkobj.js` (`objectIsFlammable`, `objectIsRottable`)
beside `weight()`. Five macro-expansion wrappers were added to the
object-predicates harness; the two mkobj.c functions are real C bodies and
execute directly, including `is_flammable`'s candle (obj.h `Is_candle`),
`WAN_FIRE` and `oc_oprop == FIRE_RES` exclusions, which the port reads
through the emitted `OBJECT_PROPERTY` string column (its fireResistance
rows are exactly the native FIRE_RES rows, checked concretely).

The migrated call sites are the C callers that name the macro: trap.c
`erode_obj` (trap.js `objectIsVulnerableToErosion` now dispatches each
erosion kind to its owner and the local `objectCanBurn` duplicate is
deleted, as is the folded food-selection module's private `objectIsFlammable`),
`lava_effects`' organic screening, hack.js's lava boots and rust-trap
immunity (trap.c `immune_to_trap`), dig.c rot-on-burial, mon.c
`meatmetal`/`meatobj`, monmove.c `gelcube_digests`, eat.c `rottenfood`
and the rust-monster smell/admission branches, dog.c `dogfood`
(pet_food.js), eat.c `edible` (eat.js), do_wear.c
`hard_helmet` and `obj_erode_type`, dothrow.c `breakobj`'s crack branch,
insight.c's spell-casting suit, spell.c's per-slot `metallic()` helper
(deleted), steed.c's stiff armor, zap.c's ring-shock gloves, mthrowu.c's
lava splash, and objnam.c's `is_damageable` and readobjnam erosion tests
(whose three helpers now expand through the owners; their claim mutants
were updated). Callers whose C body writes the material comparison itself
rather than the macro keep their inline mirror: dothrow.c `breaktest`'s
glass-armor chance, trap.c `wearing_iron_shoes`, and `lava_damage`'s
`oc_material < DRAGON_HIDE` screening.

Every claim keeps the whole initial table in its domain: the
zero-material generic rows carry material 0 on both sides and the
C-faithful owners agree with the macros there, so unlike `is_damageable`'s
old inline port test no real-material restriction is needed (that claim's
domain is unchanged). Each claim's probe drops the otyp correspondence —
oclass for `is_crackable` — pinned to one concrete row, and each mutant is
killed by a concrete return difference. No port fidelity bug was found:
every migrated site already matched its C caller (insight.c's suit test
already carried both is_metallic bounds), so the rename is
behavior-preserving; all 44 public sessions and the first 300 holdout deep
sessions replay identically, with seed2200's known screen-only miss
unchanged. A behavior test pins insight.c:1820's suit semantics for glass
armor (crystal plate mail does not impair spell casting; iron plate mail
does).

The complete 116-claim run exited 0 (including the two slow table claims)
and wrote the ledger only after success; every new claim is fast, so the
`equivalence` CI job's `--skip-slow` selection is unchanged. The rewritten
ledger adds the seven material rows; `is_damageable`, `primary_erosion`
and `secondary_erosion` keep their domains and now carry their rewritten
mutants (13.0 s, 6.0 s, 3.9 s). The CI-parity
`--skip-slow --check-ledger` run passes against the rewritten ledger.
`npm run compile` and `npm run check` passed, the focused
executor/query/selection suite is 99 passing tests, and the 36 ledger CLI
tests passed.

**Species-table function batch (fv-equivalence-batch-8).** Ten more claims
give the remaining pure `mons[]`-table functions of mondata.c (plus
makemon.c's birth limit) exactly one exported port owner each and execute
the real C bodies. cantvomit lives in `mondata.js:speciesCannotVomit`
(the hero wrapper `heroCannotVomit` delegates to it), noattacks/num_horns/
little_to_big/big_to_little/big_little_match live in
`mondata.js:monsterHasNoAttacks/monsterHornCount/monsterOlderForm/
monsterYoungerForm/monsterGrowthFamilyMatch`, same_race and the
can_blow table half live in `mondata.js:sameMonsterRace/speciesCanBlow`,
and max_passive_dmg moved from dogmove.js to
`mondata.js:maxPassiveMonsterDamage`, beside its C file's owner module.
The scattered inline reads of the growth vector (egg.js egg hatching,
egg_species.js can_be_hatched, timeout.js learnEggType, makemon.js
grow_up's targetSpecies) now call `monsterOlderForm`; mon.js and
invent.js keep direct reads because concurrent fold units own those
files.

The growth claims read the real static `grownups[][2]` table through the
C executor (enum pm types map to int; the member-array decay
`struct attack *mattk = ptr->mattk` and its `mattk[i].aatyp` subscript
are modeled for noattacks; C and JavaScript `continue` jump to the
for-update, and `for (;;)` fixed-point walks are modeled), while the JS
side reads the emitted `MONSTER_GROWTH_TARGET` vector — the claims prove
the two tables agree on every species. `num_horns` executes the C switch
over `monsndx(ptr)` against the emitted PM_* switch labels (identifier
case labels naming immutable module constants are accepted).
`max_passive_dmg:state` relates two monsters (`data -> &mons[species]`,
`|mhp| <= 10^6`) and takes the four element resistance helpers
(`Resists_Elem` / `monsterHasFire/Cold/Shock/AcidResistance`) as equal
0/1 call contracts, since their shared mask arithmetic is already proved
by `mon_resistancebits:state`; its probe drops the fire contract pinned
to a fire-vortex defender. `can_blow` proves the species-table half with
a monster distinct from `&gy.youmonst` (the hero Strangled re-check is
ported in polyself.js heroCanBlow and stays outside), and
`mbirth_limit` covers every C int with a narrowing probe at
`2^32 + PM_NAZGUL`. levl_follower stays unproved (it reads the monster's
inventory through mon_has_amulet), mstrength and its static
mstrength_ranged_attk are compiled out under `NH_STATUS_RELEASED`, and
ranged_attk has no caller in the pinned C and deliberately no port
(PR 610 dropped an unused port for it in review).

Four of the ten claims stay in the fast job. The two two-species growth
claims `big_little_match:tables` (85.5 s) and `same_race:tables`
(243.5 s) are marked slow, and so are `max_passive_dmg:state`,
`num_horns:tables`, `big_to_little:tables` and `little_to_big:tables`:
with their probes and mutants they took 312 s, 77 s, 45 s and 41 s on a
hosted runner, which pushed the fast `equivalence` job past its 30-minute
timeout. All six join `experience:tables`/`mcalcmove:tables` in the
nightly `--slow-only` job. Every claim has a concrete failing
probe and two killed mutants with concrete counterexamples. No port-vs-C
fidelity bug was found: each rewritten owner was also checked
exhaustively over all 383 species against its previous implementation,
and all 44 public sessions plus the first 300 holdout deep sessions
replay identically base vs branch (seed2200's known screen-only miss
unchanged).

The complete 91-claim run exited 0 in **1015.6 s**, including **90 domain
probes** and **103 mutant checks** (20 claims, 21 probes and 20 mutants
new), and wrote the reviewed 91-row ledger only after every claim, probe
and mutant passed. Every new claim is fast (worst 4.0 s for
`is_silent`), so the `equivalence` job keeps its fast slot; the
CI-parity `--skip-slow --check-ledger` run passed in **412 s**. One
earlier complete attempt reported `mon_resistancebits:state`'s probe and
mutant as "solver gave up"; that claim had passed unchanged in every
previous batch and passes alone and in the final run — the give-up was
contention with a concurrent local `npm run compile`/`check`, not a
domain change. The focused executor/query/selection suite is now
**86 passing tests**, and the **36 ledger CLI tests** passed. `npm run
compile` and `npm run check` passed. No game source, session corpus, or
frozen file was changed.

**Glyph-number encoding batch (fv-equivalence-batch-9).** Thirty-two more
claims give the display.h glyph-number encoding exactly one proved owner per
C definition. `glyph_numbers.ts` is the encoding's owner module: its
`GlyphOffset`/`CmapSymbol` enumerations became `as const` object literals
whose members chain exactly as `enum glyph_offsets` does, so clang and the
emitted module each evaluate the whole offset table from their own sources
(NUMMONS, NUM_OBJECTS, the defsym.h indices, WARNCOUNT, MAXEXPCHARS,
MAXTCHARS) and no claim re-types an offset. The encoders
(`warning_to_glyph`, `monnum`/`petnum`/`detected_monnum`/
`ridden_monnum_to_glyph`, `objnum_to_glyph`, `explosion_to_glyph`,
`altar_to_glyph`) expand through a new `harness/glyph_encoding.c`; display.c's
real `zapdir_to_glyph` and `swallow_to_glyph` bodies execute for real over
every int in their caller domains. The fourteen `glyph_is_*` predicates and
the six display.h decoders (`glyph_to_mon/obj/swallow/warning/explosion/
trap`) are proved over the whole int32 glyph axis, and glyphs.c's real
`glyph_to_cmap` pairs with `getpos.js:glyphToCmapSymbol` over the terrain
span only: the port decodes terrain into `null` where C returns MAXPCHARS or
a swallow/explosion symbol, and the claim's probe pins that boundary.

`cmap_to_glyph` needed the branch state behind `cmap_walls_to_glyph`:
dungeon.c's `In_mines` and `on_level` execute for real over the modeled
`u.uz` and `svd.dungeon_topology` state, dungeon.h's `In_sokoban`/`Lcheck`
expand inline over the same keys, and dungeon.c:1942 `In_hell` — which reads
`svd.dungeons[u.uz.dnum].flags.hellish`, an array the executor cannot model
— enters as an equal 0/1 call contract. The port's `wallOffset` argument is
related to exactly the base that selector picks, mirroring how
`display.ts:currentWallGlyphOffset` supplies it at runtime.
`swallow_to_glyph` pins `HHallucination` clear through the same property
array model the experience claim uses, so display.h:what_mon returns its
monster unchanged and the macro's indirect display-RNG call stays on the
dead arm; the hallucinating path is the separately proved
`rn2_on_display_rng` draw, and its per-call species choice through the
function pointer remains outside the claims. The scattered inline
re-derivations at call sites now call their owners: `display.ts`'s private
`glyphIsMonster`, its duplicated `glyph_to_cmap` terrain decode, the
`monnum_to_glyph`-shaped hero-glyph arithmetic, the zap/explosion/swallow
glyph-number packing, and `objnum_to_glyph(BOULDER)` checks in `cmd.ts`,
plus the swallow-range test in `do_name.ts` and the zap/warning decodes in
`pager.ts`.

Five glyph claims are slow and join the nightly job: `glyph_is_object`
(19.6 s local) and `glyph_to_obj` (25.9 s), plus `glyph_to_mon`,
`glyph_is_monster` and `glyph_to_swallow`, which took 39 s, 30 s and 30 s
with their probes and mutants on a hosted runner. With this batch the fast
`equivalence` job's proving step reached 1559 s and hit the 30-minute job
timeout, so the eight older claims costing more than about 25 s on CI moved
too: `abon:forms` (101 s), `weight_cap:state` (84 s), the three
`*:chain4` capacity claims (51, 42 and 29 s), `weapon_dam_bonus:state`
(33 s), `weight:stack` (31 s) and `armor_to_dragon` (26 s). The port fidelity bug found — a fresh
`glyphToTrap` owner that subtracted `S_arrow_trap` twice — was caught by the
module's own round-trip smoke before proving and fixed; no pre-existing
port behavior changed.

The complete 158-claim run exited 0 in **2421.7 s**, including **166 domain
probes** and **175 mutant checks** (32 claims, 32 probes and 32 mutants
new), and wrote the reviewed 158-row ledger only after every claim, probe
and mutant passed. The CI-parity `--skip-slow --check-ledger` run passes
against the rewritten ledger.

The focused verifier suites pass unchanged with the new claims loaded:
**95 executor**, **4 query** and **9 selection tests**, plus the **36
ledger CLI tests**. `npm run compile` and `npm run check` passed.

**Object-field lookup batch (fv-equivalence-batch-10).** Fifteen claims pair
fourteen field readers in `object_data.ts` with real reads of the pinned
`objects.c:obj_init` initializer through `harness/object_fields.c`. No table
equality is assumed: clang interprets objects.h and the JS executor reads each
emitted column independently, with a symbolic index spanning every one of the
481 object types. This includes the strange object and all generic class
markers. `oc_skill` retains the signed `oc_subtyp` values, and `oc_bimanual`
retains `oc_big` on armor as well as weapons. Material and direction claims
cover the base columns; per-game shuffling and the wand-of-nothing direction
remain with `o_init.ts:objectMaterial` and `object_data.ts:objectDirection`.
Discovery state is outside these claims.

`objectClassForType` now owns the class lookup for initialization, display,
detection, naming and Lua. The former four standalone copies and the class
range loop in `getObjectDefinition` are gone. The class column comes from the
same objects.h initializer as the other metadata, rather than from class
ranges. C assigns class 1 to type 0 and each generic row its own class. The Lua
name lookup previously rejected a class-filtered generic potion; the added
behavior test failed before the consolidation and passes afterward. The type-0
class and missing/invalid input behavior also have focused tests. Callers that
accept absent objects continue to receive class 0 for null or undefined.

The Lua metadata report also read the initial wand-of-nothing direction after
`o_init.c:init_objects` had selected its direction for the current game. It now
uses the existing `objectDirection` owner, as `nhlobj.c:l_obj_objects_to_table`
reads the live `oc_dir` field. A second failing-first Lua behavior test covers
both direction choices. The table proof continues to describe the initial
column, without claiming to prove startup's RNG draw or state initialization.

The outside-domain claim proves the port's explicit zero result for all int32
indices outside its table. Its C harness deliberately adds a guard; this is a
port contract, not a claim about native out-of-bounds reads. Non-integers, NaN,
infinities, null and undefined are covered by behavior tests, outside the
integer executor. Each table probe drops only index correspondence and pins
both sides to concrete valid rows; each result mutant uses one concrete row.
The outside-domain probe pins a C-int narrowing case and its mutant pins -1.

Only the class and outside-domain claims are fast. The other thirteen claims
are slow to reserve the existing CI budget even though each is below 5 seconds
in the local pilot. The runner reports per-claim totals including probes and
mutants so the CI split can be reviewed against total cost. Local totals are
recorded below for the successful complete run, including both logging
modes, probes and mutants. These are local measurements, not hosted-runner times.
The fifteen new claims cost **25.73 s** in total; the two fast claims cost
**3.36 s**, leaving margin under the two-minute allowance even at 7× that cost.
The complete run passed **173 claims, 181 probes and 192 mutant checks** and
wrote the ledger after success. The subsequent fast ledger check passed all
139 fast claims and checked the complete ledger metadata, with 34 slow claims
explicitly skipped. Compilation, 208 focused behavior tests,
110 verifier tests, 36 ledger tests and the static ledgers pass. Large game
corpora remain for CI; the requested fresh12041–fresh12050 directories were
absent locally.

| Claim | Local total | Runtime |
|---|---:|---|
| `object_class:tables` | 1.76 s | fast |
| `object_material:tables` | 1.75 s | slow |
| `object_weight:tables` | 1.74 s | slow |
| `object_cost:tables` | 1.74 s | slow |
| `object_delay:tables` | 1.69 s | slow |
| `object_property:tables` | 1.70 s | slow |
| `object_direction:tables` | 1.65 s | slow |
| `object_skill:tables` | 1.67 s | slow |
| `object_bimanual:tables` | 1.68 s | slow |
| `object_merge:tables` | 1.96 s | slow |
| `object_uses_known:tables` | 1.71 s | slow |
| `object_unique:tables` | 1.69 s | slow |
| `object_magic:tables` | 1.69 s | slow |
| `object_charged:tables` | 1.70 s | slow |
| `object_class:outside` | 1.60 s | fast |

**Object-macro owner batch (fv-equivalence-batch-12).** Twenty-six added
claims cover thirteen obj.h predicates, eleven initial objects[] fields, and
OBJ_NAME/OBJ_DESCR index mapping. Every new predicate keeps its C macro name;
existing exported owners keep their names. Armor categories use oc_armcat
with the ARMOR_CLASS guard. The generic armor marker consequently has a
suit slot, matching is_suit; a behavior test fails on the previous range
classification. The shared is_damageable owner now lives in
object_properties.ts and its existing claim includes all 481 object types.

The field factory executes each native objects.c:obj_init column and emitted
object_data.js column independently. The name claims execute the real macros
and objects.c:obj_descr_init against the emitted strings, with
oc_name_idx/oc_descr_idx == otyp as established by init_objects. They compare
string contents and null separately; pointer identity and preservation by
later shuffling remain outside the claims. The live OBJ_DESCR reader uses
the game's description array, covered separately by behavior tests.

All 26 new claims are slow, preserving the fast CI job's claim count. Their
local totals include proofs, probes and mutants: **71.52 s** combined,
with one pinned probe and one killed mutant per claim. The complete run
passed **249 claims, 257 probes and 268 mutant checks** and wrote the
249-row ledger after success. The table above records each new local total.
The CI-style fast check passed all **142 fast claims**, explicitly skipped
107 slow proofs, and validated every ledger row. The **36 ledger CLI tests**
also pass.

The stored-class regression is covered by three failing-first tests:
weapon-tools, ammunition and bimanual weapons reject oclass 0 instead of
inferring a class from otyp. The existing capacity claim also needed its
redraw-state relation made explicit: disp.botl and game.context.botl are true
at entry. A modeled assignment must prove it preserves its entry value;
changed values and unmodeled writes remain rejected. Six executor tests cover
nullable string returns and this read-only state contract.

The behavior suite passed **17,407 tests, with 0 failures and 2 existing
TODOs**. All **344 before/after session pairs are identical**: public remains
43/44 with the existing seed2200 screen difference at step 158; all public
RNG calls match. Deep is 300/300, matching 5,275,312 RNG calls and 58,002
screens. Compilation, strict checks, 549 focused tests, 120 verifier tests,
683 native differential cases, 37 differential harness tests and the static
owner/message/edge ledgers pass. The RNG callsite ledger has zero regressions.

**Defense-owner batch (fv-equivalence-batch-13).** Sixteen added claims
prove the single-owner defense and helper ports of PRs 758-768 against C:
`artifact.c:defends`/`defends_when_carried` over the artilist table and the
dragon-armor switch, `mondata.c:resists_magm` over one modeled monster,
hacklib.c's `highc`/`lowc`/`ordin`, and ten `H<Prop> || E<Prop>` resistance
macros of youprop.h. `defended()` itself and `Resists_Elem()` stay outside:
both declare `struct obj *o, otemp;`, a struct-typed local the C executor
cannot type; `resists_drli`/`resists_blnd` call `defended()` and follow it.

| Claim | C ↔ JavaScript | Domain | Paths / loop proof | Time |
|---|---|---|---|---|
| `highc` | `hacklib.c:highc` ↔ `hacklib.js:uppercase` | Any C char input in −128..127; probe leaves it | 2×2 | 4.8 s |
| `lowc` | `hacklib.c:lowc` ↔ `hacklib.js:asciiLower` | Same domain | 2×2 | 3.3 s |
| `ordin` | `hacklib.c:ordin` ↔ `hacklib.js:ordinalSuffix` | Every int32 n; returns text | 6×6 | 0.6 s |
| `<prop>_resistance:state` ×9, `antimagic:state` | youprop.h `Fire_resistance` … `Stone_resistance`, `Antimagic` macro harnesses ↔ `properties.js:propertyIsActive` | One lumpled any-source boolean per bit family (permanent intrinsic, timed, worn, invoked W_ARTI, carried W_ART); representative mask bits on the C side | 2×2 | 2.1 s each |
| `defends:tables` | `artifact.c:defends` ↔ `artifact.js:defends` | 16 damage-type partitions (AD_MAGM..AD_STON with query spellings); object null or present; otyp 0..NUM_OBJECTS-1; any signed-char oartifact; the real `get_artifact` over artilist[] and the port's `_artifactRuntime` map | 1×1 per partition | 15.7 s |
| `defends_when_carried:tables` | `artifact.c:defends_when_carried` ↔ `artifact.js:defendsWhenCarried` | Same partitions; otyp/oclass unread | 1×1 per partition | 3.3 s |
| `resists_magm:tables` (slow) | `mondata.c:resists_magm` ↔ `mondata.js:monsterHasMagicResistance` | Monster (not youmonst) with valid species, a bounded 0..2 minvent nobj chain with otyp/owornmask/oartifact and a modeled wielded index into it; `dmgtype` over mons[] executes for real; masks stay inside int32 | 1×1 per chain partition | 177.1 s |

The artifact claims execute the real `get_artifact()` over the static
NEARDATA `artilist[]` initializer and `dragonFormForArmor()` on the port
side, so the defn/cary adtyp ↔ defense/carriedDefense string table
correspondence is verified row for row rather than assumed. The
resists_magm claim models `mw` as the chain item whose owornmask carries
W_WEP (the invariant weapon.c's `mwepgone` maintains) and verifies that
`ANTIMAGIC_ARMOR` is exactly the set of otyps whose `objects[].oc_oprop`
is ANTIMAGIC, over every otyp in the table. Worn masks are bounded to a
signed int32: the port reads owornmask with a JS 32-bit `&`.

Two JS executor extensions carry the batch, each with a failing-before
test: a module-level `export const f = (x) => …` binding is now callable
(expression and block bodies), and `Array.prototype.some` accepts a
block-bodied callback whose per-element return is reset before the next
element. The batch found no port difference: the one open-search mismatch
(an owornmask above int32, where C's 64-bit `&` and the port's 32-bit `&`
disagree) is unreachable worn state and became the documented domain bound.

**Predicate-owner batch (fv-equivalence-batch-14).** Twenty-one added claims
prove more cited single-owner ports: thirteen further mondata.h species
macros over one `&mons[species]` row, mondata.c's `poly_when_stoned()` over
the stone-golem mvitals entry and `cvt_adtyp_to_mseenres()` over the
damage-type code, the five rm.h/trap.h terrain macros over one terrain or
trap type, and worn.c's `find_mac()` over one modeled monster.

| Claim | C ↔ JavaScript | Domain | Paths | Time |
|---|---|---|---|---|
| `touch_petrifies:tables` | `mondata.h:touch_petrifies` ↔ `mondata.js:touchPetrifies` | Valid species; native pointer `&mons[species]`; initial tables | 1×1 | 2.7 s |
| `flesh_petrifies:tables` | `mondata.h:flesh_petrifies` ↔ `mondata.js:fleshPetrifies` | Same domain | 2×3 | 2.8 s |
| `is_whirly:tables` | `mondata.h:is_whirly` ↔ `mondata.js:monsterIsWhirly` | Same domain; record argument | 2×2 | 5.2 s |
| `is_rider:tables` | `mondata.h:is_rider` ↔ `mondata.js:monsterIsRider` | Same domain; record argument; RIDER_SPECIES index set | 2×1 | 2.1 s |
| `nonliving:tables` | `mondata.h:nonliving` ↔ `mondata.js:monsterIsNonliving` | Same domain; is_undead/golem compositions execute for real | 2×4 | 2.9 s |
| `is_vampire:tables` | `mondata.h:is_vampire` ↔ `mondata.js:monsterIsVampire` | Same domain; symbol read | 1×1 | 2.0 s |
| `passes_rocks:tables` | `mondata.h:passes_rocks` ↔ `mondata.js:passes_rocks` | Same domain; passes_walls/unsolid execute for real | 2×2 | 2.9 s |
| `is_mplayer:tables` | `mondata.h:is_mplayer` ↔ `mondata.js:monsterIsPlayerMonster` | Same domain; ordered element-pointer comparison; no null probe (C UB) | 2×2 | 2.8 s |
| `is_unicorn:tables` | `mondata.h:is_unicorn` ↔ `mondata.js:monsterIsUnicorn` | Same domain; likes_gems executes for real | 2×2 | 2.6 s |
| `eyecount:tables` | `mondata.h:eyecount` ↔ `mondata.js:eyecount` | Same domain; int 0/1/2 return | 3×3 | 2.6 s |
| `emits_light:tables` | `mondata.h:emits_light` ↔ `vision.js:monsterEmitsLight` | Same domain; LIGHT_EMITTING_MONSTERS index set | 2×2 | 6.3 s |
| `vegan:tables` | `mondata.h:vegan` ↔ `food_traits.js:veganCorpse` | Same domain; symbol and index identities | 2×5 | 4.2 s |
| `vegetarian:tables` | `mondata.h:vegetarian` ↔ `food_traits.js:vegetarianCorpse` | Same domain; vegan() executes for real | 3×5 | 5.0 s |
| `poly_when_stoned:state` | `mondata.c:poly_when_stoned` ↔ `mondata.js:formCanBecomeStoneGolem` | Valid species; symbolic uchar stone-golem mvflags; every other mvitals entry all-clear | 2×3 | 3.0 s |
| `cvt_adtyp_to_mseenres:tables` | `mondata.c:cvt_adtyp_to_mseenres` ↔ `mondata.js:seenResistanceForDamage` | Every uchar adtyp; verifies the AD_MAGM..AD_ACID code order against the M_SEEN_* bit order | 9×2 | 3.3 s |
| `IS_WALL:terrain` | `rm.h:IS_WALL` ↔ `const.js:IS_WALL` | Every non-negative schar terrain code (negative probe differs: C's truthiness test) | 2×2 | 1.8 s |
| `IS_OBSTRUCTED:terrain` | `rm.h:IS_OBSTRUCTED` ↔ `const.js:IS_OBSTRUCTED` | Every schar | 1×1 | 1.7 s |
| `IS_DOOR:terrain` | `rm.h:IS_DOOR` ↔ `const.js:IS_DOOR` | Every schar | 1×1 | 1.8 s |
| `is_pit:terrain` | `trap.h:is_pit` ↔ `const.js:is_pit` | Every int32 ttyp | 2×2 | 1.8 s |
| `is_hole:terrain` | `trap.h:is_hole` ↔ `const.js:is_hole` | Every int32 ttyp | 2×2 | 1.8 s |
| `find_mac:state` (slow) | `worn.c:find_mac` ↔ `worn.js:findMonsterArmorClass` | Modeled monster: valid species base AC, symbolic misc_worn_check, 0..2 item chains with otyp/owornmask/spe/erosion; counted items outside the armor interval are exactly the rows with a zero a_ac | 1×1 per chain partition | 20.6 s |

The species claims follow the flag-owner batch's entry relation; each kills
one emitted-JavaScript mutant pinned to a species where the predicate is
decided and rejects a null native pointer (except `is_mplayer`, whose
ordered pointer comparison against null is C undefined behavior). The two
index-set claims (`is_rider`, `emits_light`) verify the emitted
`indexOf`/literal sets against the native `&mons[PM_*]` identities over the
whole table rather than assuming them. The terrain macro claims pair the
real rm.h/trap.h macros (expanded in `harness/terrain_macros.c`) with the
const.js owners over the stored schar codes.

`find_mac` needed the modeled-monster inventory relation of
`resists_magm` plus the hero-side erosion fields. An earlier unrestricted
domain produced a counterexample (a wielded grappling hook: C subtracts its
oc_oc1 4, the port's `armorBaseBonus` armor-interval guard returns 0), but
that state is unreachable in C: monster wielding is `mon->mw = obj` with no
worn bit (weapon.c), `setmnotwielded` clears W_WEP, and `m_dowear_type`
only puts armor-class rows and amulets into the worn bits, all of which
have a zero a_ac outside the armor interval. The domain restriction states
this and the port was left unchanged. Three executor extensions carry the
batch, each with a failing-before test: ordered comparison of two
table-element pointers, `for...of` over arrays (binding, continue, break),
and comments inside array literals.

**Earlier proof runs.**

The complete 71-claim run exited 0 in **985.15 s** (the ledger-writing run
that followed took 1037.68 s), including **77 domain probes** and **83
mutant checks** (12 probes and 12 mutants new), and wrote the reviewed
71-row ledger only after every claim, probe and mutant passed. Every new
claim is fast (worst single-claim time 11.0 s for `is_damageable`), so
the `equivalence` job keeps its fast slot; the two slow table claims are
unchanged. The CI-parity `--skip-slow --check-ledger` run passed in
**437.35 s**, and the focused executor/query/selection suite is now
**85 passing tests**. No game source, session corpus, or frozen file was
changed.

The complete 61-claim run exited 0 in **980.32 s**, including **65 domain
probes** and **71 mutant checks**, and wrote the reviewed 61-row ledger only
after every claim, probe and mutant passed. The CI-parity
`--skip-slow --check-ledger` command passed in 339.28 s; the two slow
table claims keep their nightly slot and `weight:stack` is fast (16.4 s)
after the species chunking. The focused executor/query/selection suite is
now **84 passing tests**, and the **36 ledger CLI tests** passed. The one
public-session screen miss (`seed2200-wizard-quaff-zap-read`, step 158) is
the previously documented recorder-options artifact and fails identically
without this batch; all 300 first `.cache/holdout-dev/deep/sessions`
replays pass.

The complete 41-claim run exited 0 in **704.66 s**, including **45 domain
probes** and **49 mutant checks**, and wrote the reviewed equivalence ledger
only after all checks passed. The eight new claims each have one concrete
probe and one killed mutant. The four new executor tests bring the focused
executor/query/selection suite to **62 passing tests** (8.594 s). All **37
ledger CLI tests** passed in 129.197 s, including a complete fast-claim run
against the new ledger. `npm run compile` passed. No game source or session
corpus was changed.

**Runtime and CI split.** A `cProfile` run of species 0 found 552
feasibility checks plus 266 arithmetic implication checks for experience;
movement added 376 feasibility checks. The sampled experience proof changed
from 5.36 to 4.67 s, and movement from 2.50 to 2.05 s, including first-use
clang reads. These profiles do not establish a sub-120-second table claim.

The leaf executors now share an incremental solver for one entry domain and
use push/pop for temporary path conditions. Changing any domain constraint
rebuilds that context. The bounded UNSAT cache still keys complete propositions;
SAT and unknown results are not cached. Tests check that temporary path facts
do not escape, cached contradictions do not cross domains, and changing an
entry constraint changes feasibility. No proof domain, logging mode, safety
obligation, probe or mutant was removed.

**Solver robustness.** `rnl`'s per-path-pair output-equality obligations
coupled two symbolic divisors -- `RND(x)` drawn through `mod (R_core 0) x`
and the luck-dependent `rn2(37 + abs(adjustment))` modulus -- and z3 proved
or gave up on that nonlinear query depending only on the random seed,
accumulated AST state, or process memory layout. Linux CI hit the 120-second
timeout three times: twice under the plain solver and once at seed 10 through
a two-configuration retry, while macOS proved the byte-identical propositions
in about a second (a query dump confirmed the branch and the integration
base construct identical `rnl` queries, so the port edits were not the
cause). Retrying between incomplete configurations only moved the failing
seed around, so `specs.luck_partitions` instead reduces the query complexity
by splitting the domain exhaustively into luck-sum magnitude intervals. Both
fields are `schar`, so `u.uluck + u.moreluck` lies in [-256, 254] and every
value belongs to exactly one of 17 intervals `[0,15], [16,31], ..., {256}`.
Each interval keeps the `rn2(37 + abs(adjustment))` divisor within a
16-value window and, for `x <= 15`, the `(abs(luck) + 1) / 3` adjustment
within six values; the initial `RND(x)` draw keeps its symbolic modulus `x`,
so the queries remain nonlinear but small, and every seed tried decides them
quickly. One magnitude per partition (257 partitions) is equally decisive
but took 168.2 s locally and 319.7 s on the CI runner, timing out the
30-minute job; the interval split proves the claim in 15.3 s locally. The
domain, outputs, stream positions and log entries are unchanged, and every
partition must be satisfiable. Probes and mutants still short-circuit on the
first failing interval with concrete witnesses. A regression test sweeps
seeds 0 through 20 over selected intervals (0-15, 16-31, 128-143 and 256);
all 21 seeds proved, with a worst whole-scheme time of 18.8 s per seed when
all 17 intervals run. These runs are stability evidence for the tested seeds,
not a guarantee for every solver seed. `queries.py` is back to a single
default solver configuration.

An initial full run exited 1 because experience's grouped mutant query timed
out without a model. That was a failed negative check, not a killed mutant.
Counterexample searches now check the same output conditions separately for
each path pair; the experience mutant then produced a concrete C 135 / JS 136
witness in 3.25 s. Equivalence proofs retain the grouped table query. A
regression test covers both branches and a mismatch in a later partition.

The earlier 33-claim full command exited 0 in **688.98 s**, with all **33 claims**, **37
domain probes**, and **41 mutant checks** behaving as specified. Of the mutant
checks, 39 have concrete counterexamples, one is the retained unsupported
shadowing-language rejection, and one is proved equivalent. The original rows
above retain that run's per-claim times, excluding probes and mutants.
Experience took **415.6 s** (previously 1212.9 s); movement took **175.5 s**
(previously 341.8 s). Neither met the approximately 120-second target, so both
remain `slow`. The final fast command exited 0 in **97.92 s**, proving 31 claims
with 34 domain probes and 39 mutant checks, while explicitly skipping both
slow claims. `npm run compile` passed. No game tests or corpora were run; no game source
was changed. The separate `--slow-only --check-ledger` command passed both
slow claims, three domain probes and two mutants in **593.84 s** (experience
415.8 s; movement 177.0 s). The ledger was generated with `--write-ledger` after
a complete 33-claim run, then checked in all three selection modes.

The byte-seed relation comes from `isaac64.h`: C reads unsigned bytes and
the supplied length equals the JS array length. Both arrays contain at least
the first `min(length, 2048)` bytes. The JS state words are BigInts in
0..2^64-1. These representation facts and corresponding input state are
assumptions; they are not inferred from arbitrary callers or saved games.
`isaac64.h` gives C disjoint `m` and `r` fields; the corresponding JS arrays
must also be distinct.

`bv.py` keeps Z3 bit-vector arrays for memory. C operations use clang's
resolved integer types and wrap only at unsigned conversions; signed overflow,
invalid shifts, uninitialized reads, and array bounds are obligations. JS
BigInt intermediates get enough signed bits for their entire mathematical
range, including negative subtraction results and left shifts above 64 bits.
Only a mask actually present in the JS source may narrow a word; every array
store must prove that the stored word fits its modeled width. Number index
arithmetic must remain exact, and Number bit operations must fit int32.

For `update`, the invariant equates `m`, `r`, `a`, `b`, `c`, and the working
accumulators at an arbitrary aligned loop index in each 128-word half. One
four-word body preserves it and advances the index by four. Reseeding uses
analogous array invariants; during its first memory pass, only the written
prefix of `m` corresponds and is initialized. Each loop proves initialization,
guard agreement, preservation, and a bounded decreasing variant. Untracked
locals and arrays must remain unchanged; scratch locals must be assigned
before use. Inner loops and `mix` are fully unrolled with an unwinding check.
Eight seed-length residue classes and an over-cap case cover every stated
seed length, without enumerating seeds.

Calls to `mix`, `update`, and `reseed` use shared uninterpreted summaries only
after their source proofs succeed in the same run. Summary inputs include all
read-before-write state; their contracts check array shape, initialization,
seed allocation, and the postcondition `n = 256`. Reseeding is proved with
unrelated initial `m` and `n`, which justifies initialization's use of the
summary before those fields have values.

These are isolated function claims, including private emitted JS functions.
The original 20 scoped claims remain present. The alignment wrappers invoke
the real `hack.h` macros; the Amphibious wrapper invokes the real property
macro. There is no all-callers claim. The `abon:forms` dungeon-difficulty
contract and the monster-table/initialization limits are explicit below.

Signed division/remainder safety is checked through its premises: both
operands fit the promoted signed type, the divisor is nonzero, and the pair is
not minimum/-1. These conditions imply that the quotient or remainder fits
that type. A proved divisor != -1 discharges only the exceptional-pair check.
This avoids a redundant nested-division range query that timed out in a fast
run. Tests retain the reachable `/` and `%` failures and overflow before a
subsequent division, as well as correct truncation with a positive composite
divisor. No domain or undefined-behavior case was removed.

**Leaf proof method.** Clang's typed JSON AST supplies the C side, so macros,
`#if`, typedefs, and implicit conversions come from the compiler. tree-sitter
parses the emitted JavaScript. Two path-forking symbolic executors produce Z3
terms over mathematical integers. C signed overflow, division by zero, and
`abs(INT_MIN)` are obligations; narrowing conversions wrap. JavaScript
arithmetic must stay within ±2^53, so IEEE operations are exact.
`Math.trunc(a / b)` requires `b != 0` and `abs(a) <= 2^52`, where the double
quotient's rounding error is below 1/(2|b|) and cannot cross an integer. BigInt
is exact. Random draws read an uninterpreted `R_stream(position)`, shared by
both sides. Loops are unrolled with an unwinding check, or, for `d`, proved
by a hand-written relational invariant over a recursively defined sum (the
leaf executor's manual proof step, about 30 lines in `specs.py`).

The broad legacy `rnz` probe returned solver unknown during the first ledger
write. Its main equivalence domain was proved. The negative check now uses the
excluded `INT_MAX` boundary with a symbolic random stream and requires a concrete
counterexample: native `(int)x` returns `-2145336166`, while emitted JavaScript
returns `2149631130`. The positive `abs(i) <= 1e8` domain is unchanged. A language
test also checks the long-to-int return conversion directly.

**Non-vacuity.** The 33 leaf specs have 37 domain probes and 39 mutant
checks: 37 concrete mutant counterexamples, one retained language-rejection
check (the shadowing declaration mutant), and one equivalent mutant.
Every fv-leaves2 claim has both a failing domain probe with a concrete model
and a killed JavaScript mutant; rejection or timeout cannot satisfy those
gates. Numeric probes leave the arithmetic or interface
domain; attribute probes remove one equality from the assumed state relation.
Such a probe tests the need for the relation, not a game bug. The ISAAC64
claims add eight domain probes and ten killed mutants, including
shift, mask and memory-index changes. They also require solver counterexamples.
One existing mutant is genuinely equivalent (`ulevel < 15` →
`ulevel < 16`, since 15/3 = 5), and the tool proves it.
The existing prototype lacks dedicated mutants for `rn2` and `rn1`, and
dedicated domain probes for `d` and `rne`. This batch leaves those gaps open.
New claims still require both a counterexample probe and
a killed mutant; the current CLI runs every check supplied by the specs.

| New leaf claim | Domain probe | Killed mutant |
|---|---|---|
| `enermod` | `en = INT_MAX` overflows C's multiplication | wizard/priest multiplier 2 → 3 |
| `newuexp` | arbitrary `int` level can leave the JS exact-integer range | first multiplier 10 → 11 |
| `xlev_to_rank` | input 4294967297 narrows to C `int` 1: C 0, JS 8 | rank numerator `level + 2` → `level + 1` |
| `rounddiv` | `(2, -3)`: C -1, JS 0 | denominator half → third |
| `Align2amask` | alignment -3: C 4294967295, JS 255 | alignment offset 2 → 1 |
| `Amask2align` | input 9007199254740993 violates the exact JS input obligation | normal alignment mask → shrine bit |
| `acurr:StrDex` | remove base Strength correspondence: returned attributes differ | add 1 to the attribute sum |
| `acurrstr` | remove base Strength correspondence: condensed Strength differs | Strength divisor 50 → 51 |
| `dbon:human` | remove base Strength correspondence: damage bonuses differ | 18/75 endpoint inclusive → exclusive |
| `abon:human` | remove base Dexterity correspondence: hit bonuses differ | Dexterity offset 14 → 13 |

| fv-leaves2 claim | Domain probe | Killed mutant |
|---|---|---|
| `acurr:all` | remove base Strength correspondence | dunce-cap value 6 → 7; power-gauntlet floor 125 → 124 |
| `dbon:all` | remove base Strength correspondence | polymorph damage bonus 0 → 1 |
| `abon:forms` | remove base Dexterity correspondence | form bonus offset -3 → -2; Wizard counter reads next species |
| `experience:tables` | remove monster-level correspondence | initial award 1 → 2 |
| `mcalcmove:tables` | remove speed correspondence; allow gallop -1 | rounding threshold `<` → `<=` |

| Geometry/species claim | Domain probe | Killed mutant |
|---|---|---|
| `isok` | x=65537 narrows to coordxy 1 | allow column zero |
| `online2` | x0=65536 narrows to coordxy 0 | remove the opposite diagonal |
| `mindless:tables` | null native species pointer | mindless mask → animal mask |
| `nohands:tables` | null native species pointer | hand mask → head mask |
| `humanoid:tables` | null native species pointer | humanoid mask → animal mask |
| `ceiling_hider:tables` | null native species pointer | include mimics instead of excluding them |
| `sliparm:tables` | null native species pointer | small-size endpoint inclusive → exclusive |
| `breakarm:tables` | null native species pointer | invert the sliding-body exclusion |

The mask probe is a counterexample to the numeric input obligation, not an
observed C/JS result difference. The model accepts only exact integer Numbers;
it does not pretend that 9007199254740993 is a representable JS Number.

For the retained earlier attribute claims, the state assumptions in `specs.py` are: `attrib.h` declares
`u.acurr.a`, `u.abon.a`, and `u.atemp.a` as six signed-char fields; each
corresponds to the matching `game.u` element. C `uarmg` and both JS gauntlet
slot aliases are null. `you.h:Upolyd` supplies the human-form assumption
`u.umonnum == u.umonster`, with both fields corresponding to JS. `you.h`'s
`Role_switch` reads `gu.urole.mnum`; the 13 role enumerators are read through
clang and related to the role keys used by `exper.js`. These are assumed
relations at entry, not proofs of character initialization or restoration.

The new numeric counterexamples are outside ordinary caller inputs:
`exper.c` and `botl.c` call `newuexp` with levels 0..30;
`xlev_to_rank` receives native `int` levels; `polyself.c:newman` calls
`rounddiv` with denominator 10, positive maximum HP, or energy maximum
clamped to at least 1. Its JS counterpart also clamps those maxima.
`dungeon.c:induced_align`, `mklev.c:mkaltar`, and the mimic altar branch of
`makemon.c:set_mimic_sym` generate alignment -1, 0, or 1; hero alignment
fields use the named alignment constants in `align.h`. This caller inspection
does not discharge the upper bounds on `rounddiv` inputs or all alignment
callers. `enermod` is called with a small level-energy increment from
`newpw`; the INT_MAX probe does not describe that path.

**Concrete generator cross-check.** With `NETHACK_RECORDER` set, run
`cd verification/equivalence && uv run ../isaac64/crosscheck.py`. A tiny
harness compiles the real `isaac64.c`; Node imports `frozen/isaac64.js` directly.
The run passed 17 cases and 17,000 draws in 2.34 s: seven uint64 seeds,
seven byte lengths including zero, partial words, 2048, and over-cap, plus
three midstream reseeds. Each case checks 1,000 numeric outputs and stops at
the first mismatch. This is a concrete cross-check, not the universal proof.
Two target-selection regression tests exercise both verification entry points
with intentionally disagreeing frozen/emitted copies. A healthy frozen copy
must pass even when the emitted copy differs; a divergent frozen copy must
fail even when the emitted copy is healthy. Both tests failed before the
target correction and pass after it, including the review-fix rerun
(two tests in 6.448 s). The 58 language, solver and selection tests also
passed after the round-2 review fix in 10.064 s. Run them with
`uv run python ../isaac64/test_scoring_target.py` from `verification/equivalence`.

**Divergences found outside the earlier numeric domains.** These boundaries
are not discharged at every caller. The wizard-glob path below demonstrates
that a negative `rounddiv` denominator can be reached through a debug option:

- In the recorder build, `NH_DEVEL_STATUS` is `RELEASED`, so `rnd.c`'s
  `impossible()` guards are compiled out. `rn2(0)`, `rnd(0)`, `rnl(0)`, and
  `rn2_on_display_rng(0)` are C undefined behavior (`% 0`). With `x < 0`,
  C consumes a draw, and `rnd`/`rnl` can overflow. JavaScript returns 0
  without drawing, so any such call would desynchronize the RNG stream.
- `rnl` with `x` within 256 of `INT_MAX` and large negative Luck overflows
  in C (`i -= adjustment`).
- `rnz` with `abs(i)` above about 1.07e8: C truncates the `long` result to
  `int` (for example, it returns 2147483647 where JS returns -2147483649).
- `rn1` with large `y`; `d` with `n < 0`, where C loops about 2^32 times
  and overflows.
- `distmin`/`dist2` with coordinates outside ±16384: `coordxy` (`int16_t`)
  wraps in C, and `dist2` overflows `int`.

**Trust base and limits.**

- The leaf proofs still use arbitrary random streams. The separate proofs of
  `frozen/isaac64.js` now establish equal generator outputs and successor states on their
  stated domains; the algorithm itself is no longer assumed equivalent.
- The trust base is the Python executors and loop annotations (unverified), clang's
  AST, tree-sitter, and Z3, plus the explicit pure dungeon-difficulty call
  contract. That helper's bodies are not executed by `abon:forms`. Mutants and
  probes reduce the risk; replaying
  counterexamples concretely through compiled C and Node would reduce it more.
- Loop annotation facts are trusted. For `d`, they state the recursive sum
  for `rnd.c:d`'s `while (n--) tmp += RND(x)` and the uint64 range of each
  abstract draw (`isaac64.h:isaac64_next_uint64`). The executor checks the
  invariant and decreasing variant, but does not establish that arbitrary
  supplied facts are valid definitions.
  The ledger records those formulas so changes require review.
- State correspondence is assumed, not proved: JS `game.u.uluck` holds the
  same integer as C `u.uluck`, `game.u` exists, the contexts are
  initialized, and JS numeric arguments are integers equal to the C
  arguments. Negative zero is identified with zero.
- What is verified is the emitted leaf JavaScript and the frozen scoring
  generator, not the TypeScript. `npm run compile` keeps emitted leaves in
  step with their sources; it does not produce the frozen adapter.
- Leaf executor subset: integer C with locals, nested declared global-field reads,
  fixed state arrays, constant integer tables from clang initializers, calls,
  `switch` and `while`; JS with numbers, BigInt, `Math`, constant arrays,
  default parameters, simple array bindings, optional state reads, calls,
  literal-label `switch`, and `for`/`while`. Switches preserve fallthrough,
  default placement, breaks, and early returns. Both sides support ternaries.
  Out-of-bounds array reads are obligations; partially initialized C arrays
  and JS array holes are rejected. Imported constants and functions resolve
  in their defining module. Module table reads assume their initial values
  have not been mutated. The two new game-table claims assume the native and
  emitted fields still have their initial values, including Erinys.
  The 52 language tests cover these operations and rejection boundaries using
  small C and JS programs, rather than copies of game functions.
- C pointer access in global state requires an explicit `references` entry
  or `CPtr` in `c_globals`. A flattened state field such as `worn.value` models
  only the pointee field; it cannot establish a non-null `worn`. The executor
  rejects `->` on such a state aggregate. Both global and nested pointer
  regression cases incorrectly proved before this review fix and reject
  after it. Modeled nullable pointers retain null-dereference obligations.
- Proof-selection tests assert exit status, with report text used only for
  failure diagnostics. Real C/JS snippets check that selected body mismatches,
  probes that incorrectly prove and surviving mutants fail, while
  excluded runtime classes skip their bodies and negative checks.
- Leaf and ISAAC64 executors use `core.bit_operation` for bit-vector operations. The
  leaf executor keeps C's promoted widths and JS Number coercions; the ISAAC64
  executor chooses widths large enough for exact BigInt intermediates before
  applying source masks. There is one bit-operation implementation; width
  selection and language-specific safety obligations remain at each caller.
- `assert` is a proof obligation, independent of its libc expansion. The
  typed AST recognizer accepts Apple's `__assert_rtn` conditional (including
  its `__builtin_expect` hint) and glibc's single-if `__assert_fail` statement
  expression. The condition is evaluated once; failure yields a counterexample
  and only successful paths continue. These failure routines have the aborting
  contract declared by `<assert.h>`. With `NDEBUG`, `(void)0` evaluates nothing.
  Other GNU statement expressions are rejected.
- Bitwise `&`, `|`, `^`, `~`, `<<`, and `>>` use C's typed widths and JS's
  32-bit coercions; JS `>>>` is unsigned and shift counts are masked modulo
  32. C shift counts must fit the promoted left operand's width; signed left
  shifts require a nonnegative representable result. Negative signed right
  shifts use clang's arithmetic shift on the recorder target. Unsigned
  operations wrap. JS powers of two are supported only for exponents 0..53.
- Read-only nullable item pointers, equality of monster pointers, record
  fields and nested record/attack arrays are supported. Finite Map reads,
  literal object options, array defaults and `Number.isFinite` cover the
  corresponding initialized JS paths. C `for` loops require an initializer,
  condition and update, and use the same checked unrolling rule as `while`.
- Not yet: general heap writes or pointer arithmetic outside a fixed array, general sparse JS arrays, Lua, `async`/`await`,
  escaped JS string literals, exceptions as control flow, loops that log inside their bodies under
  induction, and JS declarations that shadow an outer binding (rejected, not
  modeled). An induction loop needs a variant as well as an invariant, so
  equivalence includes termination. `sizeof` is evaluated for the LP64
  target, and other type traits are rejected.
- The separate ISAAC64 executor supports its fixed arrays, context writes,
  non-rebound aliases, full zero `memset`, whole-word `memcpy`, and explicit
  relational loops. It is not a general C heap or JavaScript engine model.
  Negative C seed lengths, malformed JS states, optional absent JS seed
  arguments, the unused bounded-draw `isaac64_next_uint`, and JS-only peek
  are outside the claims. The wrapper claim covers the packing loops only;
  context routing, wrapper global writes, and correspondence at arbitrary
  callers remain assumed. Compilation, JS runtime semantics, clang, and Z3
  remain in the trust base. No whole-game equivalence is claimed.
- Log comparison uses structured entries. C's `@ caller` annotation and
  number prefix are ignored, as in scoring.

## Stateful leaf entry relations

`state_specs.py` and `state_world.py` state the new entry relations. These
relations are assumptions at function entry; initialization, equipment changes,
restoration and later table mutations are not proved to preserve them.

- The six elements of each attribute array correspond, including every signed
  `u.abon` value. `do_wear.c:Ring_on` and `Ring_gone` apply gain-strength,
  gain-constitution and adornment rings through `adjust_attrib`. Their effects
  are therefore included in the assumed array correspondence. Accuracy and
  damage rings update `u.uhitinc`/`u.udaminc`; native `abon`/`dbon` do not read
  those fields, and their callers add those bonuses separately.
- Each of `uarmg`, `uarmh` and `uwep` is either null or a corresponding live
  item. Each active JS slot alias refers to that item; at least one alias is
  active when the C pointer is non-null. Root-only, hero-only and shared slots
  are included.
  `otyp` is a native `short`; `oartifact` is a signed `char` (`obj.h`). The
  artifact runtime map has the IDs and names from emitted `ARTIFACT_DATA`, as
  copied by `artifact.js:initializeArtifacts`. The claim executes the real
  `artifactById` Map lookup and native `artifact.c:is_art`.
- `gy.youmonst.data` points to `mons[u.umonnum]`, as installed by
  `polyself.c:set_uasmon`; the species index is in `0..NUMMONS-1`. The table
  fields read here retain `monst.c:mons_init` values, copied at startup by
  `monst_globals_init`. Emitted module data likewise retains its initial
  values. Live Erinys upgrades (`mon.c:adj_erinys` / `adjustErinys`), quest
  retargeting and seduction attack replacement are excluded.
- `abon:forms` executes native `makemon.c:adj_lev` and emitted
  `adjustedMonsterLevel`, including the Wizard death counter (an `uchar`) and
  special levels above 49. Other species death counters remain independent. It **assumes** that the two nullary,
  read-only `level_difficulty` calls return the same value in `1..32767`
  (`dungeon.c`, native return type `xint16`). The dungeon traversal and property
  calculations behind that call are not proved here. This is a conditional
  claim, not a proof of all polymorphed attack accuracy.
- `experience:tables` covers monsters with no inventory and a zero worn mask.
  It executes `worn.c:find_mac`, including base AC and its cap. The monster
  level spans the whole `uchar` range, revived/cloned flags span both values,
  and `nk` spans `0..255` (`mvitals.died` in `monst.h`). The JS `amphibious`
  option equals C's effective `Amphibious` property. Its input expression is
  built by executing the actual macro through `harness/hero_properties.c`,
  with arbitrary native breathing intrinsics/extrinsics and form flags.
  Attack types, damage types, dice, speed and `M2_NASTY` are read from the real
  native initializer; the JS side reads `MONSTER_EXPERIENCE_META` and
  `MONSTER_MOVE`. `experience` does not itself read `permonst.mresists`.
  Equipped monster AC and the JS fallback for a missing monster level remain
  outside this claim.
- `mcalcmove:tables` assumes initialized numeric `movement`, `mmove` and
  `mspeed` fields. The cached JS `mmove` is the emitted `MONSTER_MOVE` entry;
  C independently reads the native species entry. The initializer executes
  without writes under this relation. Speed spans the whole two-bit native
  field; both moving modes, mount identity, galloping and context movement
  flags are covered, with a missing mount, this monster as mount, or another
  monster as mount. Gallop is in `0..2^53`: `steed.c:kick_steed` increments
  it, dismounting resets it, and `timeout.c:nh_timeout` decrements it only
  when nonzero. Nonnegativity is assumed, not proved; the upper bound is the
  JS exact-integer domain, not a native invariant. A negative timer probe
  demonstrates its necessity. Every rounding and gallop draw is symbolic;
  the claim covers all random sequences, including the draw when the speed
  remainder is zero. Missing-field initialization and later cache updates
  remain unproved.

The two monster claims partition the complete valid index range using clang's
`NUMMONS`. Each species retains symbolic state and, for movement, arbitrary
random streams; these are not enumerated example game states. Every declared
partition must have a satisfiable entry domain in both logging modes, after
the precondition and state constructor run. An empty partition fails the
claim with its label; it cannot silently reduce species coverage. A regression
failed before the fix for contradictions in either the precondition or
state constructor and passes after it. Clang supplies
record field order, field types and nested attack initializers. All new
negative checks require a concrete counterexample: unsupported syntax, empty
domains and solver timeouts do not count as successful probes or killed
mutants. Identical read-only return paths can be joined by disjoining their
conditions. Obligation queries at one source location are grouped, and a
bounded cache reuses only UNSAT results for identical complete Z3 propositions,
including their entry conditions.

## All rounddiv callers and the negative-denominator gap

`verification/callsites/rounddiv.mjs` uses clang's typed AST to list resolved
native calls. `rg` selects candidate translation units; it does not interpret
C. The script also lists emitted named calls and the inline volley expression.
There are six C calls and six corresponding port calculations:

| Native call | Port calculation | Denominator |
|---|---|---|
| `polyself.c:newman:390` | `polyself.js:renewHumanForm:1034`, `roundDiv` | 10 |
| `polyself.c:newman:396` | `polyself.js:renewHumanForm:1041`, `roundDiv` | native `u.uhpmax`; JS clamps it to at least 1 |
| `polyself.c:newman:404` | `polyself.js:renewHumanForm:1048`, `roundDiv` | 10 |
| `polyself.c:newman:409` | `polyself.js:renewHumanForm:1055`, `roundDiv` | maximum of native energy maximum and 1; JS also clamps |
| `mthrowu.c:monmulti:236` | `mthrowu.js:monsterVolleyCount:214`, inline `Math.trunc((spe + 1) / 3)` | 3; the call is guarded by launcher `spe > 1` |
| `eat.c:doeat:3058` | `eat.js:doeat:101`, `roundNutritionTime` | `(int) obj_nutrition(otmp)`; zero is guarded |

**A negative denominator has a source-derived game path in wizard mode.**
`objnam.c:readobjnam:5042-5067` permits a wizard to override the glob weight
limit. Requesting `107374336 small globs of brown pudding`, and accepting
that override, gives one glob weighing `107374336 * 20 = 2147486720`.
The count fits `int` and the multiplication fits `unsigned`. Fresh, unrotted
food can reach `doeat`'s rounding call with that nutrition. The cast to `int`
at `eat.c:3050` gives `-2147480576`, which is then the denominator at line
3058. This is not the `INT_MIN` negation case.

`uv run rounddiv_witness.py` evaluates the actual clang and emitted JS AST
expressions at that state, and discharges the native arithmetic obligations:

- Native `eatcorpse` delay: `33554483`; emitted `prepareCorpseMeal` delay:
  `-33554381`. The emitted `>> 6` coerces the unsigned weight to signed 32 bits.
- The native call then has numerator `72057806638965760`, denominator
  `-2147480576`, and returns `-33554579`.

The expression witness is checked; the wish/meal path is a source audit, not
an end-to-end replay. No game code was changed. Ordinary-play food weights
still need an upper-bound invariant; absorbing globs uses signed intermediate
weights in `mkobj.c:obj_absorb`, so it is not a proof that arbitrarily large
ordinary globs are reachable without earlier UB. The four native `newman`
calls rely on a positive live maximum HP or an explicit positive denominator;
this inspection does not prove their numerator bounds. The existing
`rounddiv(2, -3)` counterexample remains outside the positive-denominator claim.

## Call-site domains

`verification/callsites/` checks emitted `js/*.js` arguments against the RNG
leaf domains. Authored types identify injected callbacks and record/array
shapes; arguments, guards, initializers, writes and table contents come from
the emitted JavaScript. Runtime call inventories pair the two modules; a
missing or reordered callee stops extraction. Both the emitted checker and
authored signatures identify RNG bindings. This finds 133 calls that the
previous authored-signature-only scan missed, including callback defaults.

The classifications below concern **lower bounds and explicit division
integrality**, under the numeric/state correspondence assumptions below.
They do not establish the full caller domain: upper bounds are reported
separately. For `d`, the lower domain matches `specs.py`: `n >= 0`, `x >= 0`,
and `x >= 1` unless `n = 0`. Zero dice with zero sides is allowed; negative
sides remain outside the stated leaf proof even when the count is zero.

```sh
node verification/callsites/extract.mjs > .cache/rng-callsites.json
cd verification/equivalence
uv run ../callsites/check.py ../../.cache/rng-callsites.json \
  --json ../../.cache/rng-callsites-report.json
```

The final fv-leaves2 integration check contains 2,483 sites: 2,090 constant,
106 guarded, 50 invariant and 237 unproved. The two additions are constant
sites. Checking this inventory against the 2,481-site ledger reported zero
regressions; new proved sites are allowed by that ledger contract. Extraction
took 115.52 s and ledger checking took 5.28 s. The historical comparison below
is the fv-callsites audit baseline.

The post-rebase extraction took 108.90 s; both lower and upper checks with
ledger enforcement took 3.35 s. The class counts match the strengthened
analyzer's baseline below.

| Class | Before (2,348 sites) | After, original inventory | Additional emitted sites | After (2,481 sites) |
|---|---:|---:|---:|---:|
| constant | 1,981 | 1,985 | 103 | 2,088 |
| guarded | 115 | 98 | 8 | 106 |
| invariant | 51 | 47 | 3 | 50 |
| unproved | 201 | 218 | 19 | 237 |

`constant` needs no caller guard. `guarded` may use stable dominating guards,
helper return bounds, every direct caller of a non-escaping helper, or an
inductive local bound. For a local bound, the initializer establishes it and
every syntactic write preserves it; unsupported writes discard the summary.
An initializer can also be used before its first write when its declaration
dominates the read and no loop back edge carries a write past it.

Guard identities include bindings, including array-index bindings. Writes,
unknown calls, captured mutable scalars, `await`, and loop back edges can
invalidate a guard. A stored value is distinguished from a later live field
read. Entire `++count` arguments use a distinct pre-increment value; compound
side-effecting expressions and incremented loop conditions stay unproved.
No new guarded classification rests on matching text alone.

The run closes 36 of the original 201 unproved sites and withdraws 53 old
classifications. The withdrawals reflect unavailable emitted-only facts or
unjustified guard lifetimes/identities. They are not game-code regressions.
The successful sites and their C sources are listed in
[`verification/callsites/review.md`](../verification/callsites/review.md).

| Residual group | Before | After |
|---|---:|---:|
| possibly-empty collection | 25 | 37 |
| count or weight | 27 | 25 |
| dice from data | 21 | 23 |
| spe charges | 11 | 19 |
| hit points | 4 | 6 |
| other | 113 | 127 |

Groups use argument terms and recovered local origins, with charge/HP/dice
cases taking precedence over collection/count names. They are triage labels,
never proof premises. Better origin recovery can move a site between groups.
Every residual site has a native owner and a remaining obligation in
[`review.tsv`](../verification/callsites/review.tsv). The review distinguishes
matching formulas, C-to-array representations, unchanged callback forwarding,
and the input fuzzer. No reachable out-of-domain divergence was established;
this manual comparison is not a proof of state correspondence.

The `invariant` class additionally assumes the following C facts. It does
not prove that initialization, restoration, every caller, or a suspended
continuation establishes them.

| Assumed fact | C source |
|---|---|
| attributes 3..125 | `attrib.h` ATTRMIN..ATTRMAX; `attrib.c:acurr` (Strength encodes 18/xx up to 125) |
| non-Strength attributes 3..25 | `attrib.c:1199 acurr`, including all equipment/form branches; only calls resolving to emitted `attrib.js:currentAttribute` with a folded non-Strength index get this narrower fact |
| `ulevel` 1..30 | `global.h` MAXULEV; `you.h` level field; this also supplies the state domain of `rne`/`rnz` |
| `level_difficulty() >= 1` | `dungeon.c:level_difficulty` |
| monster level 0..255 | `monst.h:104 m_lev`, resolved by clang to 8-bit unsigned char; this replaces the invalid general cap of 49 (special creation can exceed it) |
| attack dice 0..255 | `monattk.h` attack dice are `uchar`; this does **not** imply positive sides when a positive count reaches a draw |
| `nroom` 0..40 | `mkroom.h` MAXNROFROOMS |
| live room: `0 <= lx <= hx <= 79`, `0 <= ly <= hy <= 20` | `struct mkroom`, `sp_lev.c:create_room`, `mklev.c:add_room` |
| in-bounds table element lies in the min/max of its initial entries | declared readonly or non-escaping emitted literal arrays, with the corresponding C data-table relation assumed |

Room facts apply only to `Room` owners, or a non-escaping parameter for which
all direct callers supply a `Room`. `RoomSentinel`, Lua rectangles and level
regions do not acquire them. Readonly array contents are assumed to remain in
the stated range. Literal string-name lookups use the emitted table entries;
no C/JS table-equivalence theorem is added.

**Non-vacuity.** Each successful solver query has a satisfiable modeled input.
Nested RNG result bounds are conditional on that draw's own domain; an invalid
nested draw cannot create contradictory facts and prove an enclosing call.
Nonzero divisors are obligations, not assumptions. Ten analyzer tests passed
in 1.457 s, including concrete invalid-domain probes, stale snapshots,
mutating callbacks, shadowed bindings, destructuring, builtin shadowing,
ordered increment reads, and nine independent emitted-JS mutants.

A second pass mutates emitted RNG arguments in memory, preserving nested
calls. Widths become zero; dice counts become negative; `rnz` receives an
out-of-bound upper argument. It changes no game files. The gate must reject
every previously classified site. The review-fix mutant extraction took
123.51 s; its gate killed 2,245 mutants with zero failures in 7.19 s. Both
passes still operate on emitted JavaScript.

```sh
node verification/callsites/extract.mjs --mutate-domains > .cache/rng-mutants.json
cd verification/equivalence
uv run python ../callsites/test_callsites.py
uv run python ../callsites/test_domains.py \
  ../../.cache/rng-callsites.json ../../.cache/rng-mutants.json
```

**Limits.** This is conditional caller evidence, not a theorem about all
reachable game states. Unknown numeric leaves are modeled as integers equal
to corresponding C values. The checker does not establish their integrality
or rule out arbitrary `undefined`, NaN, proxies or effectful getters at game
boundaries. Record/collection shapes come from the authored type contract.
Raw table-index validity and the initial readonly-table relation remain
assumptions. RNG-typed callbacks assume the corresponding leaf contract.
Caller summaries use a closed inventory of emitted game modules; external
JavaScript consumers are outside this scope. Helper summaries stop after
three calls; callback invokers,
relational attack-table facts, late scalar clamps and general side-effecting
expression order are not modeled. Unknown calls can therefore leave a safe
site unproved.

There are 339 sites with unproved upper bounds. Native caller overflow and
exact Number arithmetic are not established by a lower-bound label. The
`write.ts` division remains unproved: C divides integers, while the emitted
code divides Numbers; current ink costs are even, but that parity relation is
not modeled. Zero-width C modulo is undefined behavior in the released
recorder, rather than an ordinary draw with a well-defined result. Negative
widths consume a C draw while the JS wrapper returns zero without drawing.
No corpus was run by this unit; earlier corpus observations do not discharge
any of these proof obligations.

The CI ledger records the 2,481-site baseline from this audit. Its four-part
key uses file, enclosing function, callee, and argument text, without line numbers,
and preserves repeated occurrences. CI rejects a weaker class or a new
unproved occurrence and prints the site and reason. The 237 existing unproved
sites are grandfathered. Removed calls and stronger classes are allowed.
Callback scopes include enclosing functions and assigned names or call
argument positions. The key audit found 2,008 distinct keys: 238 keys repeat,
accounting for 473 additional occurrences. Every repeated key belongs to one
actual enclosing function; none combines distinct callbacks. A regression
test swaps valid and invalid widths between callbacks in different functions.
The lost claim passed before scoped names and is rejected afterward.
The ledger covers the lower-bound/integer classification above; upper bounds
remain reported separately. The proof ledger records 41 claim names, the
C function and JS function/file being compared, their domain summaries
(including state correspondence, role mappings, nullable item aliases,
state/argument/partition constructor identities, and explicit native assumptions), supplied JS argument kinds and values in order, their probe/mutant counts, and a `fast`/`slow` runtime marker. It also records each annotated loop's key, streams, facts,
invariant, and variant. Preconditions and loop formulas use complete SMT
expressions rather than Z3's truncated display strings. The loop formulas use
independent symbolic current and entry locals and RNG positions, with named
local reads. Full expressions include recurrence definitions and draw bounds;
this does not validate those definitions. ISAAC64 rows derive their argument
types, ranges, array sizes, initialization, state correspondence, case
preconditions, and loop plans from the runners' symbolic inputs. Probe and
mutant counts use the same declarations as the proof runners. The current
and recorded claim names must match: new leaf, generator, and seed-packing
claims require a reviewed ledger entry. A missing or unrecorded spec, changed
domain summary, changed check count, or failed proof, probe, or mutant fails
CI. The metadata comparison runs before the proofs and prints both recorded
and current values. Comparing domain summaries as text is conservative: even
a logically equivalent rewrite requires a reviewed `--write-ledger` refresh.

## Staged plan

1. **CI (parallel fast-proof and call-site jobs; separate slow proofs).** The
   Ubuntu `equivalence` and `equivalence-callsites` jobs run in parallel on pull
   requests, branch pushes, schedule and manual dispatch. `equivalence` runs
   with `--skip-slow --check-ledger`. A separate slow job runs nightly at
   02:17 UTC or on `workflow_dispatch`, after the fast job, with
   `--slow-only --check-ledger`. Both validate all ledger metadata, including
   runtime markers, before proving their selected claims. Missing fast claims
   cannot be hidden by the selector. Partial runs cannot write the ledger.
   All three jobs compile the port. The proof jobs also prepare recorder-patched
   C/Lua headers using Linux build rules. `equivalence` runs executor,
   target-selection and ledger tests plus the generator cross-check.
   `equivalence-callsites` runs analyzer
   tests, the caller-domain ledger check and invalid-domain mutants. Each job
   keeps its 30-minute timeout, runtime summary and separate artifact.
   Local Ubuntu 24.04 arm64/glibc proofs passed for `acurr:all` (6.1 s) and
   `abon:forms` (49.5 s), including probes and mutants. This exercises Linux
   headers and assertion expansion; hosted runners may have different clang
   and header versions. The native scoring recorder still uses macOS.
   The empty-partition regression also passed there (one test, 0.062 s).
   Local gates passed: 58 executor/query/selection tests (10.064 s), 37 ledger
   CLI tests (100.981 s), two target tests (6.448 s), ten analyzer tests
   (1.457 s), and all 17,000 generator cross-check draws (2.34 s). Healthy
   extraction took 115.52 s and its ledger check took 5.28 s with zero
   regressions. Mutant extraction took 123.51 s; all 2,245 classified-site
   mutants were killed with zero failures in 7.19 s. The full, fast and
   slow-only proof commands all checked the generated 33-row ledger. Ledger
   tests assert exit status; reports are failure diagnostics only.
2. **Read-only state and more leaves (scoped claims done).** All six
   attributes, equipment and form branches now have claims under the entry
   relations above. Monster experience is the first game-table pair; movement
   covers all random sequences under initialized field/cache correspondence.
   Remaining work: discharge `abon`'s dungeon-difficulty contract, equipped
   monster AC, live table mutations, missing-field initialization and preservation
   of those relations by state-changing callers. `online2` now pairs with
   `hacklib.js:pointsOnline`; `sgn` now has an inline-expression claim; `isqrt` and `rank_to_xlev`
   still have no matching standalone emitted function in the inspected modules.
   No game function was invented for a claim.
3. **ISAAC64 (done for the stated domains).** The frozen BigInt generator
   and C uint64 generator have equal outputs and successor states for init,
   reseed, mix, update, and next; wrapper seed packing also proves. The full
   command includes thirty-three leaf claims and eight ISAAC64 claims, with domain probes,
   shift/mask/index mutants, and a compiled-C/Node cross-check. Caller state
   correspondence and context routing remain outside these proofs.
4. **Call-site domains (strengthened analyzer and CI implemented).** Stable
   guards, inductive scalar bounds, constant table/name arithmetic, per-site
   JS mutants and the native residual audit are in. CI runs analyzer behavior
   and source-wide mutant checks, and checks `rng-callsites.tsv` for weaker
   classes and new unproved occurrences. Next: collection ownership and
   non-emptiness, relational data facts, callback invoker bounds, and upper
   arithmetic obligations. The 237 residual sites remain unproved.
5. **Differential fuzzing of stateful functions (concrete prototype).**
   `verification/difftest/` links the real patched recorder and imports the
   emitted ports through the scoring adapters. Six entry points now run from
   shared serialized hero, inventory/container and defender state:
   `mkobj.c:weight`, `hack.c:inv_weight`/`calc_capacity`/`near_capacity`,
   `weapon.c:dmgval`, and human-form `uhitm.c:find_roll_to_hit` (archeologist
   and monk, basic skills, accuracy rings). It compares returns, a declared
   successor-state projection, consumed core/display words and RNG entries.
   The numeric C attack-counter update is outside that projection: the port's
   entry point takes a first-attack boolean and exposes no counter result.
   The acceptance batch ran 6,083 cases with zero differences, five rejected
   domain probes and seven killed emitted-JS mutants; eight harness tests passed.
   Native compilation took 14.98 s and the batch took 7.01 s on this macOS host.
   The separate required proof run kept all 28 previous claims PROVED; the
   full table and times are in `verification/README.md`.

   This adds empirical evidence, not a new proved claim. The correspondence
   is the shared JSON plus unproved loaders and table-ID relation. The native
   loader calls `set_uasmon` to establish form properties; omitting it caused
   false fog-cloud differences during development. JS preserves the supplied
   form index through `setHeroSpecies`, including the six animal/human were
   entries whose display names repeat. No reachable port defect
   was established. Input reduction retains each mismatch as a reproducing
   state; callers still need to establish whether it can arise in play.
   Messages, full heap/global state, arbitrary equipment/artifacts, polymorphed
   accuracy and resumed input remain outside the comparison. The requested
   public replay matched all 792,838 RNG calls and kept every verified call for
   all 363 ledger functions; 43/44 sessions passed fully, with one screen-only
   miss. No CI job, full game suite or new recording was added. Coverage
   guidance is still future work. See `verification/README.md` for domains,
   source assumptions, exact commands, projection limits and runtime details.

   Two later rounds extend the same runner. Creation adds
   `mkobj.c:mksobj`/`mkobj`, `objnam.c:rnd_class`, `makemon.c:rndmonst`/
   `mkclass_aligned` and the whole `makemon` constructor with
   `m_initweap`/`m_initinv`: 13,885 cases, zero differences, 16 killed
   mutants. Naming adds `objnam.c:makeplural`/`makesingular`,
   `xname`/`doname` with the `an`/`the`/`aobjnam` wrappers, and
   `do_name.c:x_monnam` across its article and suppression flags: 11,548
   cases, zero differences, 17 rejected probes and 10 killed mutants. God
   minions' `x_monnam` names were excluded while a game fix for them
   landed separately. Neither round found a reachable port defect.
   `verification/difftest/README.md` lists the entry points, input domains and
   correspondence assumptions.
6. **Optional state relation.** A typed relation between `GameState` and C
   globals for monster, object, and hero records would extend refinement proofs
   to stateful functions. Expect diminishing returns. Whole-game equivalence
   stays empirical.
