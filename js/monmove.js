import { setHeroGrip } from './hero_grip.js';
import { formatFeltMessage, publishHeardMessage } from './hero_speech.js';
import { objectMaterial } from './object_material.js';
import { moveMonsterNextToHero } from './teleport.js';
import { monsterFireDescription } from './monster_fire_description.js';
import { bot, flush_screen } from './display.js';
import { noticeMonster } from './monster_notices.js';
import { launchRollingBoulder } from './rolling_boulder.js';
import { recorderLocalHour } from './calendar.js';
import { impossible, panic } from './diagnostics.js';
// Monster movement-ration state, movement, and combat.
// C refs: allmain.c moveloop_core(), mon.c mcalcmove()/movemon()/mfndpos(),
// monmove.c m_move()/dochug(), and dogmove.c dog_goal()/dog_move().
import { veganCorpse } from './food_traits.js';
import { displayRayName } from './ray_name.js';
import { castNativeRay } from './ray_attack.js';
import { breathWeaponName } from './breath_ray.js';
import { AD_RBRE, AD_SLEE } from './monster_attack_types.js';
import { M_SEEN_REFL } from './const.js';
import { seenResistanceForDamage } from './monster_perception.js';
import { watchDigging } from './digging_watch.js';
import { heroDetectsMonsters, heroIsBlind, heroIsHallucinating } from './senses.js';
import { objectDescription } from './object_description.js';
import { ownedObjectAction, observeObjectForNaming } from './objnam.js';
import { senseWithTelepathy } from './display.js';
import { useMonsterMindBlast } from './monster_mind_blast.js';
import { monsterIsMindFlayer } from './monster_data.js';
import { endVoluntaryMultiTurn, heroHasInvoluntaryDelay, setMulti } from './command_state.js';
import { d, rn2, rnd, rnl } from './rng.js';
import { DISCARDED_CALL_LOG, recordRandom } from './monster_action_types.js';
import { game, requireInitializedGame, requireLiveGame } from './gstate.js';
import { selectMonsterOffensiveItem } from './monster_offensive_selection.js';
import { useMonsterOffensiveItem } from './monster_offensive_item.js';
import { searchMonsterItems } from './monster_item_search.js';
import { consumeMonsterFloorObjects } from './monster_floor_consumption.js';
import { digestGelatinousCubeInventory, feedBeeRoyalJelly } from './monster_consumption.js';
import { pickUpMonsterFloorObject } from './monster_pickup.js';
import { digMonsterTunnel } from './monster_tunnel.js';
import { monsterMovementBaseFlags, monsterCanOpenDoor, monsterCanUnlockDoor, monsterCorrodesBars, } from './monster_movement_traits.js';
import { shiftMonsterForDoor, resolveMonsterDoorPassage } from './monster_door_passage.js';
import { heroSpecies } from './hero_species.js';
import { releaseHeroFromMonster, releaseMonsterHold } from './hero_expulsion.js';
import { checkQuestMonsterStatus, talkQuestCharacter } from './quest.js';
import { placeHeroOnLevel } from './hero_location.js';
import { swallowed } from './display.js';
import { Is_rogue_level } from './const.js';
import { hasShopkeeperData } from './shop_types.js';
import { disturbMealMimicry } from './meal_mimic.js';
import { revealConcealedHeroToAttacker } from './hero_hider_reveal.js';
import { monsterKnowsTrap, monsterLearnsTrap, monstersSeeTrap } from './trap_knowledge.js';
import { woundHeroLegs } from './hero_legs.js';
import { isAccessibleAt } from './terrain_properties.js';
import { insideWizardTower, sameDungeonLevel } from './dungeon.js';
import { movePet, pullLeashedPetCloser, } from './dogmove.js';
import { attackMonsterWithMonster, beginMonsterMeleeAttack, fightNearbyMonster, monsterAttackStopsAggressor, } from './mhitm.js';
import { chooseMonsterSpell, heroCanSeeInvisible, MCF_INDIRECT, MONSTER_WIZARD_SPELLS, monsterCurseKind, monsterSpellUseless, movementSpellSelections, } from './mcastu.js';
import { monsterLinedUpWithHero, monsterLinedUpWithPerceivedHero } from './monster_ranged_alignment.js';
import { finishMonsterEating } from './monster_eating.js';
import { finishPetEating } from './pet_eating.js';
import { tryMonsterTrapEscape } from './monster_trap_escape.js';
import { attemptMonsterRestrap, beginMonsterHideUnder, canMonsterHideUnderObjectAt, hideMonsterUnder, maybeUnhideAt, } from './monster_hiding.js';
import { finishMonsterWebTrap } from './web_trap.js';
import { resolveMonsterSpitAtHero } from './monster_spit.js';
import { objectTypeName, readyRangedMonsterWeapon, throwMonsterWeaponAtHero, } from './monster_throw.js';
import { monsterWieldedWeapon, selectMonsterRangedWeapon, swingMonsterWeapon, wieldMonsterWeapon, } from './monster_weapon.js';
import { attackHeroWithPolearm } from './monster_polearm.js';
import { summonMonsterAttackHelp } from './minion.js';
import { ammunitionMatchesLauncher, isPick, isPolearm, returningWeaponRangeSquared, willWeld, } from './weapon_type.js';
import { growMonster } from './monster_growth.js';
import { monsterLocomotion } from './monster_locomotion.js';
import { trapName } from './trap_name.js';
import { verbForSubject } from './object_grammar.js';
import { drainObjectEnchantment } from './object_state.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { initializeMonsterMovement, mcalcmove, naturalMonsterSpeed } from './monster_speed.js';
import { heroHasDrainResistance, heroIsDisplaced } from './armor.js';
import { heroHasConflict } from './hero_conflict.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { checkMonsterHeroRange } from './monster_flee.js';
import { chooseCovetousStrategy, pursueCovetousTarget } from './monster_covetous_target.js';
import { retreatCovetousMonster } from './monster_covetous_retreat.js';
import { monsterName as canonicalMonsterName, monsterPossessive, shopkeeperName, } from './monster_name.js';
import { heroHasEyes, monsterHandName } from './body_parts.js';
import { heroCanBeBlindedByContact } from './blinding_attack.js';
import { monsterIsHelpless, monsterResistsSleep } from './monster_sleep.js';
import { applyMonsterAntiMagicTrap, finishMonsterAntiMagicTrap, monsterHasMagicResistance, } from './anti_magic_trap.js';
import { beginMonsterBearTrap, finishMonsterBearTrap } from './bear_trap.js';
import { beginMonsterFireTrap, finishMonsterFireTrap } from './fire_trap.js';
import { beginMonsterLandMine, finishMonsterLandMine, landMineNeedsResume, } from './landmine_trap.js';
import { beginMonsterPitTrap, finishMonsterPitTrap } from './monster_pit_trap.js';
import { beginMonsterRockTrap, finishMonsterRockTrap, rockTrapNeedsResume } from './rock_trap.js';
import { beginMonsterProjectileTrap, finishMonsterProjectileTrap, projectileTrapNeedsResume, } from './projectile_trap.js';
import { beginMonsterSleepGasTrap, finishMonsterSleepGasTrap, sleepGasTrapNeedsResume, } from './sleep_gas_trap.js';
import { beginMonsterSqueakyBoard, finishMonsterSqueakyBoard } from './squeaky_board_trap.js';
import { beginMonsterVibratingSquare, finishMonsterVibratingSquare, } from './vibrating_square_trap.js';
import { applyMonsterPolymorphTrap, finishMonsterPolymorphTrap } from './polymorph_trap.js';
import { beginMonsterRustTrap, finishMonsterRustTrap } from './rust_trap.js';
import { heroGoldAmount, heroGoldObject } from './hero_gold.js';
import { unplaceBallAndChain } from './ball.js';
import { beginHeroEngulf, monsterCanEngulfHero, resolveHeroEngulf, } from './hero_engulf.js';
import { splitObjectStack } from './object_stack.js';
import { respondToImmediateMagic } from './monster_magic_response.js';
import { canSeeMonster, canSpotMonster, map_invisible, newsym } from './display.js';
import { plineWithContinuation } from './pline.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME, MONSTER_RESISTS, MONSTER_SIZE, MONSTER_SYMBOL, monsterIsCovetous, monsterIsNoncorporeal, monsterIsUndead, monsterIsVampireShifter, monsterIsWhirly, monsterIsUnsolid, monsterIsThickSkinned, monsterTypeName, } from './monster_data.js';
import { AD_ACID, AD_BLND, AD_CLRC, AD_COLD, AD_CURS, AD_HEAL, AD_DRIN, AD_CORR, AD_DCAY, AD_DGST, AD_DREN, AD_DETH, AD_CONF, AD_DRLI, AD_ELEC, AD_ENCH, AD_FIRE, AD_LEGS, AD_PHYS, AD_POLY, AD_TLPT, AD_DISE, AD_PEST, AD_FAMN, AD_MAGM, AD_SPC2, AD_SAMU, AD_SEDU, AD_SGLD, AD_SSEX, AD_SITM, AD_SLIM, AD_SLOW, AD_SPEL, AD_STCK, AD_STON, AD_STUN, AD_WRAP, AD_PLYS, AD_WERE, AD_RUST, AT_BOOM, AT_BREA, AT_CLAW, AT_ENGL, AT_GAZE, AT_HUGS, AT_MAGC, AT_SPIT, AT_TUCH, AT_WEAP, AT_KICK, AT_BITE, AT_STNG, AT_BUTT, AT_TENT, AT_EXPL, } from './monster_attack_types.js';
import { APPLE, BANANA, BULLWHIP, BOULDER, CARROT, CLOVE_OF_GARLIC, CORPSE, DWARVISH_MATTOCK, EGG, FLINT, ENORMOUS_MEATBALL, GOLD_PIECE, MEATBALL, MEAT_RING, MEAT_STICK, ARROW, AXE, BATTLE_AXE, DART, IRON_SHOES, OBJECT_BIMANUAL, OBJECT_LARGE_DAMAGE, OBJECT_SMALL_DAMAGE, OBJECT_SUBTYPE, PICK_AXE, ROCK, POT_GAIN_LEVEL, POT_HEALING, POT_INVISIBILITY, SLIME_MOLD, TIN, TRIPE_RATION, WAN_SPEED_MONSTER, } from './object_data.js';
import { placeCreatedObject, placeObjectSynchronously, stack_object, } from './floor_object.js';
import { canLetGo } from './hero_inventory.js';
import { useMonsterBullwhip } from './monster_bullwhip.js';
import { canFallThrough, maketrap } from './mklev.js';
import { mksobj } from './mkobj.js';
import { decideMonsterShapeChange } from './monster_polymorph.js';
import { isZombieMaker, zombieForm } from './corpse_species.js';
import { getTrack, hasTrack } from './track.js';
import { monsterAt, monsterAtPosition, monsterHasMapPosition, placeMonsterOnMap, removeMonsterFromMapAt } from './monster_location.js';
import { dismountHero } from './steed.js';
import { DISMOUNT_THROWN } from './const.js';
import { breakMonsterBoulder, monsterCanBreakBoulder } from './monster_boulder.js';
import { advanceMonsterWormBody, redrawMonsterWormSegments, shrinkStationaryMonsterWorm, wormCrossesBetween, } from './monster_worm.js';
import { displaceMonster, monsterDisplacementFlags } from './monster_displacement.js';
import { retouchEquipment } from './hero_retouch.js';
import { returnHeroToHumanForm, heroHasProtectionFromShapeChangers } from './polyself.js';
import { heroFormSticks } from './hero_species.js';
import { resolvePhysicalHeroHug } from './monster_hug.js';
import { cansee, clearPath, couldSeeFromHero, couldsee, vision_note_blocker_change, } from './vision.js';
import { wipeEngravingAt } from './engrave.js';
import { moveVaultGuard } from './vault.js';
import { afterShopkeeperMove, moveShopkeeper, shopkeeperInOwnShop } from './shk.js';
import { shopkeeperIsMuted } from './shop_loss.js';
import { findMonsterArmorClass } from './monworn.js';
import { inTown, roomsAt } from './room.js';
import { addShopDamage } from './shop_damage.js';
import { createPoisonGasCloud, leaveMovementCloud, GAS_OK, monsterGasTolerance, visibleRegionAt, updateMonsterRegions, } from './regions.js';
import { heroIsDeaf } from './senses.js';
import { makeBlinded } from './sight_change.js';
import { applyMonsterStoningAttack, startHeroPetrificationFromMonster, touchPetrifies, } from './stoning.js';
import { monsterHasFireResistance, } from './monster_resistance.js';
import { monsterReflectsRay } from './ray.js';
import { burnAwayHeroSlime } from './slime.js';
import { monsterWeaponStrengthBonus, rollPhysicalWeaponDamageAgainstHero, } from './weapon_damage.js';
import { weaponHitBonus } from './weapon_accuracy.js';
import { nurseContactMode } from './monster_nurse_contact.js';
import { selectAttack } from './attack_selection.js';
import { erodeAttackingWeapon } from './object_erosion.js';
import { magicNegation, specialAttackNegated } from './magic_negation.js';
import { poisonAttackAttribute, poisonHeroFromMonster, } from './monster_poison.js';
import { isPermanentlyPoisonedObject } from './object_properties.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { applyHeroFormPassive } from './hero_form_passive.js';
import { tryKnockback } from './knockback.js';
import { finishEnvironmentalMonsterDeath, finishMonsterKilled, finishMonsterLiquidDeath, } from './monster_death.js';
import { movePriest } from './priest.js';
import { currentMonsterLoad, monsterCanCarryObject } from './monster_carry.js';
export { monsterCanCarryObject } from './monster_carry.js';
import { monsterCanFog, monsterHasLineOfSightToHero, setMonsterApparentHeroPosition, } from './monster_perception.js';
import { adjustMonsterSpeed } from './monster_speed.js';
import { setMonsterPermanentInvisibility } from './monster_invisibility.js';
import { talkToDemon } from './demon_talk.js';
import { stashLeprechaunGold } from './leprechaun_stash.js';
import { MONSTER_SOUND } from './monster_data.js';
import { MONSTER_DIFFICULTY } from './monster_data.js';
import { depth, dist2, distmin } from './hacklib.js';
import { artifactById } from './artifacts.js';
import { resolveMonsterWeaponContact } from './monster_weapon_contact.js';
import { applyArtifactHit } from './artifact_hit.js';
import { monsterHatesBlessings } from './monster_data.js';
import { canHeroRiseUp, levelAtDepth } from './dungeon.js';
import { LEVEL_TELEP } from './const.js';
import { teleportMonsterThroughHole, teleportMonsterThroughPortal, teleportMonsterToRandomLevel } from './teleport.js';
import { learnObjectType } from './object_knowledge.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { rndmonstAdj } from './makemon.js';
import { BAG_OF_TRICKS, LUMP_OF_ROYAL_JELLY, POT_POLYMORPH, WAN_MAKE_INVISIBLE, WAN_POLYMORPH } from './object_data.js';
import { lootMonsterContainer } from './monster_container_loot.js';
import { isContainer } from './container.js';
import { isQuantumBox } from './quantum_cat.js';
import { prepareMonsterItemUse, presentMonsterQuaff, presentMonsterWandUse, consumeMonsterItem } from './monster_item_use.js';
import { dragonFormForArmor } from './armor.js';
import { findMonsterDefensiveItem, useMonsterDefensiveItem } from './monster_defensive_item.js';
import { relocateMonsterTo, randomMonsterRelocation, teleportMonsterFromTrap } from './teleport.js';
import { findNearbyMonsterPosition, monsterTeleportRestricted, reportMonsterTeleportRestriction, } from './teleport_rules.js';
import { burnArmorByFire, monsterTrapVisibility, seeTrap, trapAt, triggerMonsterTrap } from './trap.js';
import { attackHeroWithRangedWeapon, maybeBreatheAtHero } from './mthrowu.js';
import { selectHeroDisenchantmentTarget } from './do_wear.js';
import { useMonsterMiscItem } from './muse.js';
import { mfndpos, monAllowFlags, monsterMayDigLocation, monstersInFmonOrder, resistConflict, schedulable } from './mon.js';
import { publishMonsterWake } from './monster_wake.js';
import { wereChange, setHeroLycanthropy } from './were.js';
import { angerMonster, angerWatchGuards } from './monster_anger.js';
import { stopHeroOccupation } from './occupation.js';
import { rileShopkeeper, shopkeeperRepairsDamage } from './shop_damage.js';
import { diggingTimeToHole } from './hero_digging.js';
import { migrateMonsterOffLevel } from './monster_migration.js';
import { RLOC_MSG, A_CHA, A_DEX, A_STR, A_CON, ALLOW_ALL, ALLOW_BARS, ALLOW_DIG, ALLOW_M, ALLOW_MDISP, ALLOW_ROCK, ALLOW_SANCT, MMOVE_NOTHING, MMOVE_MOVED, MMOVE_DIED, MMOVE_DONE, MMOVE_NOMOVES, MON_FLOOR, ALLOW_SSM, ALLOW_TM, ALLOW_TRAPS, ALLOW_U, ALLOW_WALL, ARROW_TRAP, BEAR_TRAP, BOLT_LIM, COLNO, CORR, DART_TRAP, DOOR, ROWNO, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, D_WARNED, FOUNTAIN, SDOOR, Is_firelevel, Is_waterlevel, IS_DOOR, IS_OBSTRUCTED, IS_ROOM, IS_STWALL, IS_TREE, IS_WALL, IRONBARS, LADDER, STAIRS, LAVAPOOL, LAVAWALL, BUSTDOOR, MAGIC_PORTAL, OPENDOOR, TELEP_TRAP, ANTI_MAGIC, FIRE_TRAP, HOLE, LANDMINE, MAGIC_TRAP, M_ATTK_AGR_DIED, M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS, M_ATTK_AGR_DONE, M_AP_FURNITURE, M_AP_NOTHING, M_AP_OBJECT, M_AP_TYPE, POLY_TRAP, RUST_TRAP, PIT, PL_NSIZ, ROCKTRAP, ROLLING_BOULDER_TRAP, ROOM, SLP_GAS_TRAP, STONE, SPIKED_PIT, SQKY_BOARD, STATUE_TRAP, TRAPDOOR, NEED_AXE, NEED_HTH_WEAPON, NEED_PICK_AXE, NEED_PICK_OR_AXE, NEED_WEAPON, NO_WEAPON_WANTED, NOGARLIC, NOTONL, SHOPBASE, TEMPLE, TRAPNUM, STRAT_WAITFORU, STRAT_WAITMASK, STRAT_CLOSE, STRAT_ARRIVE, UNLOCKDOOR, VIBRATING_SQUARE, WATER, W_ACCESSORY, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMOR, W_ARMS, W_ARMU, W_NONDIGGABLE, W_NONPASSWALL, Upolyd, isok, WEB, WT_TOOMUCH_DIAGONAL, } from './const.js';
import { monsterIsScaredAt } from './monster_fear.js';
import { monsterInAir, monsterFliesOrFloats, levelHasCeiling, isLavaAt, isPoolAt } from './terrain_properties.js';
import { disturbBuriedZombies } from './object_impact.js';
export const NORMAL_SPEED = 12;
export const MSLOW = 1;
export const MFAST = 2;
const M1_FLY = 0x00000001;
const MS_LEADER = 36;
const MS_GUARDIAN = 38;
const M1_SWIM = 0x00000002;
const M1_AMORPHOUS = 0x00000004;
const M1_CLING = 0x00000010;
const M1_WALLWALK = 0x00000008;
const M1_TUNNEL = 0x00000020;
const M1_NEEDPICK = 0x00000040;
const M1_CONCEAL = 0x00000080;
const M1_HIDE = 0x00000100;
const M1_NOEYES = 0x00001000;
const M1_NOHANDS = 0x00002000;
const M1_MINDLESS = 0x00010000;
const M1_ANIMAL = 0x00040000;
const M1_SLITHY = 0x00080000;
const M1_UNSOLID = 0x00100000;
const M1_SEE_INVIS = 0x01000000;
const M1_TPORT = 0x02000000;
const M1_ACID = 0x08000000;
const M1_CARNIVORE = 0x20000000;
const M1_HERBIVORE = 0x40000000;
const M1_REGEN = 0x00800000;
const M2_ELF = 0x00000010;
const M2_ORC = 0x00000080;
const M2_NEUTER = 0x00040000;
const M2_WANDER = 0x00800000;
const M2_ROCKTHROW = 0x08000000;
const M2_GREEDY = 0x10000000;
const M2_JEWELS = 0x20000000;
const S_EYE = 5;
const S_DOG = 4;
const S_HUMAN = 53;
const S_LEPRECHAUN = 12;
const S_NYMPH = 14;
const S_LIGHT = 25;
const S_VORTEX = 22;
const S_BLOB = 2;
const S_JELLY = 10;
const S_FUNGUS = 32;
const S_ELEMENTAL = 31;
const S_GHOST = 54;
const S_SNAKE = 45;
const S_EEL = 57;
const PM_ETTIN = 174;
const PM_JABBERWOCK = 178;
const PM_FIRE_ELEMENTAL = 155;
const PM_AIR_ELEMENTAL = 154;
const PM_SALAMANDER = 329;
const M2_COLLECT = 0x40000000;
const M2_MAGIC = 0x80000000;
const PM_FOG_CLOUD = 106;
const PM_TENGU = 55;
const PM_BABY_PURPLE_WORM = 113;
const PM_PURPLE_WORM = 115;
const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');
const PM_FLOATING_EYE = MONSTER_NAME.indexOf('floating eye');
const PM_SHRIEKER = 163;
const PM_STALKER = 153;
const PM_LICHEN = 158;
const PM_LEATHER_GOLEM = 253;
const PM_FLESH_GOLEM = 255;
const PM_IRON_GOLEM = MONSTER_NAME.indexOf('iron golem');
const PM_LIZARD = 326;
const PM_WATCHMAN = 282;
const PM_WATCH_CAPTAIN = 283;
const S_GOLEM = 55;
const POT_SPEED = 302;
const LOW_BOOTS = 163;
const IRON = 11;
const RING_CLASS = 4;
const TOOL_CLASS = 6;
const COIN_CLASS = 12;
const ROCK_CLASS = 14;
const BALL_CLASS = 15;
const CHAIN_CLASS = 16;
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function requirePerceivedHero(monster) {
    if (!isFiniteNumber(monster.mux) || !isFiniteNumber(monster.muy))
        throw new Error('An active monster must retain its perceived hero position');
}
export function requireMovementCapabilities(movement) {
    if (!movement.postMoveCapabilities)
        throw new Error('A completed monster move must retain its movement capabilities');
    return movement.postMoveCapabilities;
}
export function requireDochugContext(action) {
    if (!action.dochugContext)
        throw new Error('A deferred monster movement needs its original turn context');
    return action.dochugContext;
}
export function speciesHasWeaponAttack(mnum) {
    return (MONSTER_ATTACKS[mnum] || []).some(([attackType]) => attackType === AT_WEAP);
}
// C monmove.c:m_digweapon_check().  A pick-dependent tunneller may select a
// diggable destination while unarmed, but it must spend this action readying
// the appropriate tool before a later turn can enter and excavate the square.
export async function readyMonsterDiggingWeapon(monster, state, x, y) {
    const loc = state.level.at(x, y);
    if (!loc)
        return null;
    const speciesFlags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    if (!(speciesFlags & M1_TUNNEL) ||
        !(speciesFlags & M1_NEEDPICK) ||
        sameDungeonLevel(state.u.uz, state.rogue_level))
        return null;
    const closedDoor = IS_DOOR(loc.typ) && !!((loc.doormask ?? 0) & (D_CLOSED | D_LOCKED));
    const tree = IS_TREE(loc.typ);
    const rock = IS_STWALL(loc.typ) && !tree;
    if (!closedDoor && (!(tree || rock) || !monsterMayDigLocation(loc)))
        return null;
    const current = monsterWieldedWeapon(monster);
    if (willWeld(current))
        return false;
    // C reconsiders the tool for a closed door even when a pick is held.
    if (closedDoor)
        monster.weaponCheck = NEED_PICK_OR_AXE;
    else if (tree && !(current && [AXE, BATTLE_AXE].includes(current.otyp)))
        monster.weaponCheck = NEED_AXE;
    else if (rock && !(current && [PICK_AXE, DWARVISH_MATTOCK].includes(current.otyp)))
        monster.weaponCheck = NEED_PICK_AXE;
    return (monster.weaponCheck ?? NEED_WEAPON) >= NEED_PICK_AXE
        ? wieldMonsterWeapon(monster, state)
        : false;
}
function monsterHasLauncherAndAmmo(monster) {
    const launcher = monsterWieldedWeapon(monster);
    if (!launcher)
        return false;
    const inventory = monster.minvent || monster.inventory || [];
    return inventory.some(ammo => ammunitionMatchesLauncher(ammo, launcher));
}
// mhitu.c:ranged_attk_available() excludes effects the hero has resisted.
function monsterHasAvailableDistanceAttack(monster, random) {
    for (const [method, damage] of MONSTER_ATTACKS[monster.mnum] ?? []) {
        if (![AT_SPIT, AT_BREA, AT_MAGC, AT_GAZE].includes(method))
            continue;
        const damageType = damage === AD_RBRE ? AD_MAGM + random(8) : damage;
        if (damageType >= 0 && !((monster.seen_resistance ?? 0) & seenResistanceForDamage(damageType)))
            return true;
    }
    return false;
}
// C monmove.c:dochug() phase two.  A close weapon attacker may spend its
// whole action readying carried equipment before phase-three movement.  This
// transition is deliberately RNG-free but changes every later actor's stream.
async function readyCloseMonsterWeapon(monster, state, range) {
    if ((monster.mpeaceful && !heroHasConflict(state)) ||
        !range.inRange ||
        !speciesHasWeaponAttack(monster.mnum) ||
        monster.weaponCheck !== NEED_WEAPON)
        return null;
    const apparentX = isFiniteNumber(monster.mux) ? monster.mux : state?.u?.ux;
    const apparentY = isFiniteNumber(monster.muy) ? monster.muy : state?.u?.uy;
    if (!isFiniteNumber(apparentX) ||
        !isFiniteNumber(apparentY) ||
        dist2(monster.mx, monster.my, apparentX, apparentY) > 8)
        return null;
    const weapon = monsterWieldedWeapon(monster);
    if ((range.scared && weapon && isPick(weapon))
        || (monster.mtrapped && !range.nearby && selectMonsterRangedWeapon(monster, state)))
        return null;
    monster.weaponCheck = NEED_HTH_WEAPON;
    return wieldMonsterWeapon(monster, state);
}
async function createFogEveryturnRegion(state, x, y, random = rn2) {
    const cell = state.level.at(x, y);
    if (!cell || (IS_DOOR(cell.typ) && cell.doormask & (D_CLOSED | D_LOCKED))
        || visibleRegionAt(state, x, y))
        return null;
    return await createPoisonGasCloud(state, x, y, 1, 0, random);
}
// C monmove.c:m_everyturn_effect().  movemon_singlemon() runs this before its
// movement-ration check, so an otherwise stationary fog cloud still leaves a
// one-cell harmless vapor region.  A size-one create_gas_cloud() owns only the
// rn1(3,4) TTL draw; the region then suppresses another cloud at that square.
async function monsterEveryturnEffect(monster, state, random = rn2) {
    if (!state?.level ||
        monster?.mnum !== PM_FOG_CLOUD ||
        visibleRegionAt(state, monster.mx, monster.my))
        return null;
    return await createFogEveryturnRegion(state, monster.mx, monster.my, random);
}
export async function runMonsterEveryturnEffects(monsters, state, random = rn2, { fmonOrdered = false } = {}) {
    const effects = [];
    const visits = fmonOrdered ? Array.from(monsters || []) : monstersInFmonOrder(monsters || []);
    for (const monster of visits) {
        initializeMonsterMovement(monster);
        if (!schedulable(monster))
            continue;
        const effect = await monsterEveryturnEffect(monster, state, random);
        if (effect)
            effects.push({ monster, effect });
    }
    return effects;
}
// C allmain.c invokes the same species hook for `youmonst` after status
// projection and before accepting the next command.  The region persists on
// the level and suppresses another TTL draw while it covers the hero square.
export async function heroEveryturnEffect(state = requireInitializedGame(), random = rn2) {
    if ((state.u?.mtimedone ?? 0) <= 0 || state.u?.umonnum !== PM_FOG_CLOUD)
        return null;
    return await createFogEveryturnRegion(state, state.u.ux, state.u.uy, random);
}
// C ref: monmove.c:m_avoid_kicked_loc().  dokick() retains its directed
// target through the elapsed monster turn, so a cooperative monster which
// can see does not immediately occupy the square the hero just kicked.
export function monsterAvoidsKickedLocation(monster, x, y, state = requireInitializedGame()) {
    const kicked = state?._kickedLoc;
    const heroX = state?.u?.ux;
    const heroY = state?.u?.uy;
    return !!(kicked &&
        (monster?.mpeaceful || monster?.mtame || monster?.pet) &&
        monster?.mcansee !== false &&
        monster?.mcansee !== 0 &&
        !monster?.mconf &&
        !monster?.mstun &&
        !heroHasConflict(state) &&
        kicked.x === x &&
        kicked.y === y &&
        isFiniteNumber(heroX) &&
        isFiniteNumber(heroY) &&
        distmin(x, y, heroX, heroY) <= 1);
}
// C ref: monmove.c m_avoid_soko_push_loc(). A peaceful monster must not
// occupy the square two steps from the hero when the intervening square holds
// a boulder: that is the stance the hero needs for a legal Sokoban push.
export function monsterAvoidsSokobanPushLocation(monster, x, y, state = requireInitializedGame()) {
    if (!state.level?.flags?.sokoban_rules ||
        !(monster?.mpeaceful || monster?.mtame || monster?.pet) ||
        monster?.mconf ||
        monster?.mstun ||
        heroHasConflict(state) ||
        dist2(x, y, state.u?.ux ?? x, state.u?.uy ?? y) !== 4) {
        return false;
    }
    const bx = x + Math.sign((state.u?.ux ?? x) - x);
    const by = y + Math.sign((state.u?.uy ?? y) - y);
    return (state.level?.objects?.[bx]?.[by] || []).some((object) => object.otyp === BOULDER);
}
// C hack.h:AC_VALUE().  Hero AC below zero is deliberately randomized each
// time an attack transaction evaluates it; callers must retain the returned
// threshold across later slots of that same mattacku() invocation.
function sourceHeroArmorClass(state, rollOne, calls) {
    const armorClass = state?.u?.uac ?? 10;
    if (armorClass >= 0)
        return armorClass;
    const effective = -rollOne(-armorClass);
    calls.push(`rnd(${-armorClass})`);
    return effective;
}
function monsterAttackThreshold(monster, state, rollOne, calls) {
    let threshold = sourceHeroArmorClass(state, rollOne, calls) +
        10 +
        (monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0);
    if (heroHasInvoluntaryDelay(state))
        threshold += 4;
    const perceivesInvisible = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS);
    if ((heroIsInvisible(state) && !perceivesInvisible) || !monster.mcansee)
        threshold -= 2;
    if (monster.mtrapped)
        threshold -= 2;
    return Math.max(1, threshold);
}
// C mhitu.c:hitmu().  Negative AC has a second, independent role after a
// hit: once attack effects and knockback finish, it reduces positive damage
// by rnd(-uac), with a floor of one.  This is not the AC_VALUE to-hit draw.
function reduceHeroContactDamage(monster, damage, state, rollOne, calls) {
    const armorClass = state?.u?.uac ?? 10;
    let appliedDamage = damage;
    if (appliedDamage > 0 && armorClass < 0) {
        const reduction = rollOne(-armorClass);
        calls.push(`rnd(${-armorClass})`);
        appliedDamage = Math.max(1, appliedDamage - reduction);
    }
    // mhitu.c:hitmu() applies Half_physical_damage only after negative-AC
    // reduction and rounds odd positive damage upward.
    const mitreProtects = state.urole.key === 'priest'
        && artifactById(state.uarmh?.oartifact, state)?.questArtifact
        && monsterHatesBlessings(monster);
    if (appliedDamage > 0 && (state.u.halfPhysicalDamage || mitreProtects)) {
        appliedDamage = Math.trunc((appliedDamage + 1) / 2);
    }
    return appliedDamage;
}
// mhitu.c mdamageu(): subtract from the active body and clamp only down to
// its maximum. Lethal HP stays negative until done() commits zero, after
// done_in_by() has announced the death.
async function applyHeroContactDamage(state, damage, publish = plineWithContinuation) {
    state.context.botl = true;
    // C mdamageu(): showdamage() prints the post-subtraction, pre-clamp HP.
    if (Upolyd(state.u)) {
        state.u.mh = (state.u.mh ?? 1) - damage;
        if (state.flags.showdamage && damage)
            await publish(`[HP ${-damage}, ${state.u.mh} left]`);
        state.u.mh = Math.min(state.u.mh, state.u.mhmax ?? 1);
    }
    else {
        state.u.uhp -= damage;
        if (state.flags.showdamage && damage)
            await publish(`[HP ${-damage}, ${state.u.uhp} left]`);
        state.u.uhp = Math.min(state.u.uhp, state.u.uhpmax);
    }
}
// Complete body loss before applying the old form's passive response.
async function finishHeroContactDamage(monster, damage, attackType, oldForm, state, { random = rn2, rollDice = d, publish = plineWithContinuation, die } = {}) {
    await applyHeroContactDamage(state, damage, publish);
    if (Upolyd(state.u) && state.u.mh < 1) {
        const restored = await returnHeroToHumanForm(state, { publish, ...(die ? { die } : {}) });
        if (restored.died)
            return { heroDied: true, attackerStopped: true };
    }
    if (damage <= 0)
        return { attackerStopped: false };
    return applyHeroFormPassive(monster, oldForm, attackType, { state, random, rollDice, publish });
}
// C monmove.c:watch_on_duty(). A warning does not consume the watchman's move.
async function watchOnDuty(monster, state, random, calls) {
    if ((monster?.mnum !== PM_WATCHMAN && monster?.mnum !== PM_WATCH_CAPTAIN) || !monster.mpeaceful)
        return false;
    const hero = state?.u || {};
    const requestedX = (hero.ux ?? 0) + (hero.dx ?? 0);
    const requestedY = (hero.uy ?? 0) + (hero.dy ?? 0);
    if (!inTown(state.level, requestedX, requestedY) || !monster.mcansee
        || !monsterHasLineOfSightToHero(monster, state))
        return false;
    if (recordRandom(random, calls, 3) !== 0)
        return false;
    const occupation = state._occupation;
    if (occupation?.key === 'pick-lock' && !occupation.container) {
        const location = state.level.at(occupation.x, occupation.y);
        if (location && IS_DOOR(location.typ) && location.doormask & D_LOCKED) {
            const warned = !!((location.looted ?? 0) & D_WARNED);
            const deaf = !!(state.deaf || hero.deaf || (hero.deafTurns ?? 0) > 0);
            const seen = canSpotMonster(monster);
            const name = seen ? canonicalMonsterName(monster, { state, article: 'a', capitalized: true }) : '';
            if (deaf) {
                if (seen)
                    await plineWithContinuation(`${name} angrily waves ${monsterPossessive(monster, { state })} arms!`);
            }
            else {
                if (seen)
                    await plineWithContinuation(`${name} yells:`);
                else
                    await publishHeardMessage('someone yell:', plineWithContinuation, state);
                await plineWithContinuation(warned
                    ? '"Halt, thief!  You\'re under arrest!"'
                    : '"Hey, stop picking that lock!"');
            }
            if (warned)
                await angerWatchGuards(deaf);
            else
                location.looted = (location.looted || 0) | D_WARNED;
            await stopHeroOccupation(state);
            return true;
        }
    }
    if (occupation?.key !== 'dig' || !state.context.digging)
        return false;
    const { x, y } = state.context.digging.pos;
    return watchDigging(x, y, { state, monster, magic: false });
}
// C ref: monmove.c:disturb().  Sleep is checked inside dochug(), after the
// scheduler has debited this actor's movement.  A failed wake roll therefore
// remains part of the actor's observable RNG slice even though no state or
// screen changes.
export async function disturbSleepingMonster(monster, state, random = rn2, calls = []) {
    if (!monster?.msleeping ||
        !couldSeeFromHero(state, monster.mx, monster.my) ||
        dist2(monster.mx, monster.my, state?.u?.ux ?? monster.mx, state?.u?.uy ?? monster.my) > 100)
        return false;
    const stealth = !!(state?.u?.stealth ||
        state?.u?.stealthIntrinsic ||
        state?.u?.stealthExtrinsic);
    if (stealth && (monster.mnum !== PM_ETTIN || recordRandom(random, calls, 10) === 0))
        return false;
    const symbol = MONSTER_SYMBOL[monster.mnum];
    const hardToWake = symbol === S_NYMPH || monster.mnum === PM_JABBERWOCK || symbol === S_LEPRECHAUN;
    if (hardToWake && recordRandom(random, calls, 50) !== 0)
        return false;
    const aggravates = !!(state?.u?.aggravateMonster ||
        state?.aggravateMonster ||
        state?.aggravate_monster);
    const classWakesReadily = symbol === S_DOG || symbol === S_HUMAN;
    if (!aggravates && !classWakesReadily) {
        if (recordRandom(random, calls, 7) !== 0)
            return false;
        // The source evaluates rn2(7) before excluding furniture/object
        // mimics, so keep this check after the draw.
        if (M_AP_TYPE(monster) === M_AP_FURNITURE || M_AP_TYPE(monster) === M_AP_OBJECT)
            return false;
    }
    await publishMonsterWake(monster, !monster.mpeaceful, state);
    monster.msleeping = 0;
    return true;
}
function isUnicorn(monster) {
    return monster?.mnum >= 101 && monster?.mnum <= 103;
}
// C monmove.c:undesirable_disp(). Trap rolls precede remembered-type checks.
function undesirableDisplacement(monster, x, y, state, random, calls) {
    const trap = trapAt(state, x, y);
    if (monster.mtame && !monster.isminion) {
        if (trap?.tseen && recordRandom(random, calls, 40))
            return true;
        if ((state.level.objects[x]?.[y] || []).some((object) => object.cursed))
            return true;
    }
    else if (trap && recordRandom(random, calls, 40) && monsterKnowsTrap(monster, trap)) {
        return true;
    }
    return (!isAccessibleAt(x, y, state) &&
        !(isPoolAt(x, y, state) && isPoolAt(monster.mx, monster.my, state)));
}
// C monmove.c:should_displace(). Every candidate participates, including an
// undesirable occupied square in the non-displacement distance comparison.
function shouldDisplace(monster, candidates, gx, gy, state, random, calls) {
    let nearestWithDisplacement = Infinity;
    let nearestWithoutDisplacement = Infinity;
    for (const { x, y, info } of candidates) {
        const distance = dist2(x, y, gx, gy);
        if (monsterAt(state, x, y) &&
            info & ALLOW_MDISP &&
            !(info & ALLOW_M) &&
            !undesirableDisplacement(monster, x, y, state, random, calls)) {
            nearestWithDisplacement = Math.min(nearestWithDisplacement, distance);
        }
        else {
            nearestWithoutDisplacement = Math.min(nearestWithoutDisplacement, distance);
        }
    }
    return nearestWithDisplacement < nearestWithoutDisplacement;
}
// C monmove.c:m_move_aggress(). An empty apparent-hero square still spends
// the action; an actual defender can answer a hit using its movement budget.
export async function moveMonsterAggress(monster, x, y, state, random, rollDice, rollOne, calls) {
    const defender = monsterAtPosition(state.level, x, y);
    if (!defender)
        return { postMoveStatus: MMOVE_DONE };
    const attack = await beginMonsterMeleeAttack(monster, defender, state, random, rollDice, rollOne, calls, 'movement', { x, y });
    return {
        attack,
        heroDied: !!attack.heroDied,
        postMoveStatus: monsterAttackStopsAggressor(attack) || monster.dead || monster.mhp <= 0 ? MMOVE_DIED : MMOVE_DONE,
    };
}
export async function stopMonsterHeldByHero(monster, state) {
    if (state.u.ustuck !== monster || state.u.uswallow || !heroFormSticks(state))
        return false;
    await plineWithContinuation(`${canonicalMonsterName(monster, {
        state,
        capitalized: true,
    })} cannot escape from you!`);
    return true;
}
// C monmove.c:m_balks_at_approaching().  A nearby monster which can still
// use a ranged attack does not blindly close to melee range.  Ordinary
// launchers, polearms, breath/spit/gaze, and spells back away; an aklys tries
// to stay inside its squared-distance return band.
function monsterApproachPolicy(monster, state, oldPolicy, targetX, targetY, random) {
    const distance = dist2(monster.mx, monster.my, targetX, targetY);
    if (monster.mpeaceful || distance >= 25 || !monsterHasLineOfSightToHero(monster, state))
        return { policy: oldPolicy, min: 0, max: 0 };
    if (monsterHasLauncherAndAmmo(monster))
        return { policy: -1, min: 0, max: 0 };
    const wielded = monsterWieldedWeapon(monster);
    const wieldedName = objectTypeName(wielded);
    if (isPolearm(wielded) && distance <= 5)
        return { policy: -1, min: 0, max: 0 };
    if (wieldedName === 'aklys')
        return { policy: -2, min: 4, max: 16 };
    const badlyHurt = (monster.mhp ?? 0) < Math.trunc(((monster.mhpmax ?? 0) + 1) / 3);
    if (monsterHasAvailableDistanceAttack(monster, random) && (badlyHurt || !(monster.mspec_used ?? 0)))
        return { policy: -1, min: 0, max: 0 };
    return { policy: oldPolicy, min: 0, max: 0 };
}
async function moveHostile(monster, state, random, rollDice, rollOne, calls, capabilities, options = {}) {
    const oldx = monster.mx;
    const oldy = monster.my;
    // monmove.c:m_move() refreshes the apparent target before every actor
    // specialization, including shk_move(), pri_move(), and gd_move().  This
    // second refresh is RNG-visible for an invisible or displaced hero and
    // can update retained mux/muy before the special actor returns.
    if (!options.afterRestrictedTenguTeleport)
        setMonsterApparentHeroPosition(monster, state, random, calls);
    requirePerceivedHero(monster);
    if (!monster.wormno && !options.afterRestrictedTenguTeleport && monsterIsCovetous(monster)
        && monster.mgoal && isok(monster.mgoal.x, monster.mgoal.y)) {
        const intruder = monsterAtPosition(state.level, monster.mgoal.x, monster.mgoal.y);
        if (intruder && intruder !== monster
            && dist2(monster.mx, monster.my, monster.mgoal.x, monster.mgoal.y) <= 2) {
            const attack = await beginMonsterMeleeAttack(monster, intruder, state, random, rollDice, rollOne, calls, null, monster.mgoal);
            return {
                oldx, oldy, x: monster.mx, y: monster.my, moved: false, attack,
                heroDied: !!attack.heroDied,
                postMoveStatus: monsterAttackStopsAggressor(attack) ? MMOVE_DIED : MMOVE_MOVED,
                movementStage: 'postmov',
            };
        }
    }
    if (!monster.wormno && !options.afterRestrictedTenguTeleport) {
        const priestMovement = await movePriest(monster, state, random, rollDice, rollOne, calls);
        if (priestMovement)
            return priestMovement;
        const shopMovement = await moveShopkeeper(monster, state, random, rollDice, rollOne, calls);
        if (shopMovement)
            return shopMovement;
    }
    const finishMovement = (movement, postMoveStatus, movementStage) => ({
        ...movement,
        postMoveStatus,
        movementStage,
    });
    // monmove.c:m_move() gives every tengu its innate one-in-five teleport
    // probe before swallowed-state and ordinary candidate movement.  A
    // noteleport level rejects the relocation only after that draw.
    // Relocation feedback completes before the ordinary postmov() tail.
    if (!monster.wormno && !options.afterRestrictedTenguTeleport && monster.mnum === PM_TENGU) {
        const wantsTeleport = recordRandom(random, calls, 5) === 0;
        if (wantsTeleport && !monster.mcan) {
            if (monsterTeleportRestricted(monster, state)) {
                // tele_restrict() emits its line before m_move() chooses an
                // ordinary destination or dochug() performs the trailing
                // distfleeck().  Return a continuation so tty can suspend at
                // that precise source boundary.
                return {
                    oldx,
                    oldy,
                    x: oldx,
                    y: oldy,
                    moved: false,
                    deferredAfterRestrictedTenguTeleport: true,
                };
            }
            else {
                const randomRelocation = (monster.mhp ?? 0) < 7 ||
                    !!monster.mpeaceful ||
                    recordRandom(random, calls, 2) !== 0;
                let relocation;
                if (randomRelocation) {
                    relocation = await randomMonsterRelocation(monster, {
                        state,
                        calls,
                        random,
                        rollOne,
                        flags: RLOC_MSG,
                    });
                }
                else {
                    const destination = findNearbyMonsterPosition(monster.mnum, state.u.ux, state.u.uy, {
                        state,
                        random,
                        calls,
                    });
                    if (destination) {
                        relocation = await relocateMonsterTo(monster, destination.x, destination.y, {
                            state,
                            calls,
                            random,
                            rollOne,
                            flags: RLOC_MSG,
                        });
                    }
                }
                return finishMovement(relocation || {
                    oldx,
                    oldy,
                    x: oldx,
                    y: oldy,
                    moved: false,
                    tenguTeleportFailed: true,
                }, MMOVE_MOVED, 'postmov');
            }
        }
    }
    if (state?.u?.uswallow && state.u.ustuck !== monster && !monster?.mflee) {
        // monmove.c:m_move() returns MMOVE_MOVED immediately while a
        // different monster has swallowed the hero.  It neither changes
        // coordinates nor enters candidate selection/postmov hooks.
        return finishMovement({
            oldx,
            oldy,
            x: oldx,
            y: oldy,
            moved: false,
            swallowedHold: true,
        }, MMOVE_MOVED, 'dochug');
    }
    const heroX = state?.u?.ux ?? oldx;
    const heroY = state?.u?.uy ?? oldy;
    let gx = isFiniteNumber(monster.mux) ? monster.mux : heroX;
    let gy = isFiniteNumber(monster.muy) ? monster.muy : heroY;
    const speciesFlags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    let appr = monster.mflee ? -1 : 1;
    let preferredRange = { min: 0, max: 0 };
    // Confused monsters and engulfers skip all deliberate pursuit decisions.
    if (monster.mconf || state.u.uswallow && state.u.ustuck === monster)
        appr = 0;
    else {
        const monsterTile = state.level.at(oldx, oldy);
        const apparentTargetTile = state.level.at(gx, gy);
        const shouldSee = couldSeeFromHero(state, oldx, oldy)
            && (apparentTargetTile?.lit || !monsterTile?.lit)
            && dist2(oldx, oldy, gx, gy) <= 36;
        const heroObjectAppearance = M_AP_TYPE(state.u) === M_AP_OBJECT ? state.u.mappearance : null;
        const symbol = MONSTER_SYMBOL[monster.mnum];
        if (!monster.mcansee
            || (shouldSee && heroIsInvisible(state) && !(speciesFlags & M1_SEE_INVIS)
                && recordRandom(random, calls, 11) !== 0)
            || heroObjectAppearance === 0 || state.u.uundetected
            || (heroObjectAppearance === GOLD_PIECE
                && !((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_GREEDY))
            || (monster.mpeaceful && !monster.isshk)
            || ((monster.mnum === PM_STALKER || symbol === 28 || symbol === S_LIGHT)
                && recordRandom(random, calls, 3) === 0))
            appr = 0;
        if (appr === 1 && monster.mnum === MONSTER_NAME.indexOf('leprechaun')) {
            const carriedGold = monster.minvent?.find(object => object.otyp === GOLD_PIECE);
            const heroGold = state.inventory.find(object => object.otyp === GOLD_PIECE);
            if (carriedGold && carriedGold.quan > (heroGold?.quan ?? 0))
                appr = -1;
        }
        const approach = monsterApproachPolicy(monster, state, appr, monster.mux, monster.muy, limit => recordRandom(random, calls, limit));
        appr = approach.policy;
        preferredRange = { min: approach.min, max: approach.max };
        // C can_track(): Excalibur lets even eyeless monsters follow tracks.
        const heroWeapon = state.uwep || state.u.uwep;
        const canTrack = !(speciesFlags & M1_NOEYES)
            || artifactById(heroWeapon?.oartifact, state)?.name === 'Excalibur';
        if (!shouldSee && canTrack) {
            const track = getTrack(oldx, oldy, state);
            if (track) {
                gx = track.x;
                gy = track.y;
            }
        }
    }
    let nix = oldx;
    let niy = oldy;
    let nidist = dist2(nix, niy, gx, gy);
    let selected = false;
    let selectedInfo = 0;
    // Native lined_up() is evaluated for every admitted search, including
    // peaceful actors, before approach determines whether combat forbids it.
    if ((!monster.mpeaceful || recordRandom(random, calls, 10) === 0)
        && !Is_rogue_level(state.u.uz, state)) {
        const throwsRocks = !!((MONSTER_FLAGS2[heroSpecies(state)] ?? 0) & M2_ROCKTHROW);
        const inLine = monsterLinedUpWithPerceivedHero(monster, state, random, calls)
            && distmin(oldx, oldy, monster.mux, monster.muy)
                <= (throwsRocks ? 20 : Math.trunc(currentAttribute(A_STR, state) / 2) + 1);
        if (appr !== 1 || !inLine) {
            const search = searchMonsterItems(monster, state, {
                goal: { x: gx, y: gy }, approach: appr, random, calls,
            });
            gx = search.goal.x;
            gy = search.goal.y;
            appr = search.approach;
            if (search.underfoot) {
                return finishMovement({
                    oldx, oldy, x: oldx, y: oldy, moved: false, actionCompleted: true,
                }, MMOVE_DONE, 'postmov');
            }
        }
    }
    // C computes nidist only after m_search_items() has had a chance to
    // replace the pursuit square.  Retaining the pre-search distance makes a
    // shortsighted monster abandon a nearby item goal based on the much more
    // distant remembered hero square.
    nidist = dist2(nix, niy, gx, gy);
    if (capabilities.canTunnel && (speciesFlags & M1_NEEDPICK)
        && (!monster.mpeaceful || heroHasConflict(state))
        && dist2(oldx, oldy, monster.mux, monster.muy) <= 8)
        capabilities.canTunnel = false;
    const allowFlags = monAllowFlags(monster, state, rollOne, calls);
    const candidates = await mfndpos(monster, state, allowFlags);
    if (!candidates.length && !isUnicorn(monster)) {
        const defense = findMonsterDefensiveItem(monster, state, { tryEscape: true, random });
        if (defense && (await useMonsterDefensiveItem(monster, defense, { state, random, rollDice, rollOne })).nativeResult) {
            return finishMovement({
                oldx,
                oldy,
                x: oldx,
                y: oldy,
                moved: false,
                actionCompleted: true,
            }, MMOVE_DONE, 'dochug');
        }
        return finishMovement({
            oldx,
            oldy,
            x: oldx,
            y: oldy,
            moved: false,
        }, MMOVE_NOMOVES, 'dochug');
    }
    // C monmove.c:m_move() deliberately disables directed pursuit for a
    // sufficiently distant hostile on Lua levels marked `shortsighted`.
    // `couldsee()` selects the 12-square visible threshold; otherwise the
    // monster starts milling beyond six squares.  This adjustment happens
    // after mfndpos() and before its random candidate reservoir.
    if (!monster.mpeaceful &&
        state?.level?.flags?.shortsighted &&
        nidist > (couldSeeFromHero(state, oldx, oldy) ? 144 : 36) &&
        appr === 1) {
        appr = 0;
    }
    const trackCount = Math.min(4, Math.max(0, candidates.length - 1));
    const avoidHeroLine = isUnicorn(monster) &&
        monsterTeleportRestricted(monster, state) &&
        candidates.some((candidate) => !(candidate.info & NOTONL));
    const betterWithDisplacement = shouldDisplace(monster, candidates, gx, gy, state, random, calls);
    let choiceCount = 0;
    candidateLoop: for (const candidate of candidates) {
        if (avoidHeroLine && candidate.info & NOTONL)
            continue;
        if (monsterAvoidsKickedLocation(monster, candidate.x, candidate.y, state))
            continue;
        if (monsterAtPosition(state.level, candidate.x, candidate.y) &&
            candidate.info & ALLOW_MDISP &&
            !(candidate.info & ALLOW_M) &&
            !betterWithDisplacement)
            continue;
        // C m_move(): an approaching monster probabilistically avoids recent
        // track squares before comparing distance.  The range depends on both
        // candidate count and track age, so this is observable even when the
        // rejected square would not ultimately win.
        if (appr !== 0) {
            for (let j = 0; j < trackCount; j++) {
                const track = monster.mtrack?.[j];
                if (track?.x === candidate.x && track?.y === candidate.y) {
                    const trackRange = 4 * (candidates.length - j);
                    if (recordRandom(random, calls, trackRange)) {
                        continue candidateLoop;
                    }
                }
            }
        }
        const ndist = dist2(candidate.x, candidate.y, gx, gy);
        // monmove.c starts m_move() with MMOVE_NOTHING.  Its final selection
        // clause therefore accepts the first surviving candidate even when it
        // is not closer than the monster's current square.  Later candidates
        // can replace that fallback only by improving on the selected square.
        if (appr === 0) {
            if (recordRandom(random, calls, ++choiceCount) !== 0 && selected)
                continue;
        }
        else if (appr === 1) {
            if (selected && ndist >= nidist)
                continue;
        }
        else if (appr === -1) {
            if (selected && ndist < nidist)
                continue;
        }
        else if (appr === -2) {
            const nearer = ndist < nidist;
            const inRetreatBand = ndist <= preferredRange.min && !nearer;
            const inAdvanceBand = ndist >= preferredRange.max && nearer;
            if (selected && !inRetreatBand && !inAdvanceBand)
                continue;
        }
        nix = candidate.x;
        niy = candidate.y;
        nidist = ndist;
        selectedInfo = candidate.info;
        selected = true;
    }
    if (selected &&
        !(nix === heroX && niy === heroY) &&
        await stopMonsterHeldByHero(monster, state)) {
        return finishMovement({
            oldx,
            oldy,
            x: oldx,
            y: oldy,
            moved: false,
            actionCompleted: true,
        }, MMOVE_DONE, 'dochug');
    }
    const spentDigging = selected
        ? await readyMonsterDiggingWeapon(monster, state, nix, niy)
        : null;
    if (spentDigging) {
        return finishMovement({
            oldx,
            oldy,
            x: oldx,
            y: oldy,
            moved: false,
            actionCompleted: true,
        }, MMOVE_DONE, 'dochug');
    }
    if (selectedInfo & ALLOW_U) {
        nix = monster.mux;
        niy = monster.muy;
    }
    if (selected && nix === heroX && niy === heroY) {
        monster.mux = heroX;
        monster.muy = heroY;
        return finishMovement({
            oldx,
            oldy,
            x: oldx,
            y: oldy,
            moved: false,
            attemptedHero: true,
        }, MMOVE_NOTHING, 'dochug');
    }
    if (selected && (selectedInfo & ALLOW_M || (nix === monster.mux && niy === monster.muy))) {
        const combat = await moveMonsterAggress(monster, nix, niy, state, random, rollDice, rollOne, calls);
        return finishMovement({
            oldx,
            oldy,
            x: oldx,
            y: oldy,
            moved: false,
            actionCompleted: true,
            ...combat,
        }, combat.postMoveStatus, 'dochug');
    }
    if (selectedInfo & ALLOW_MDISP) {
        const defender = monsterAtPosition(state.level, nix, niy);
        const result = await displaceMonster(monster, defender, state, { random });
        const status = result & (M_ATTK_AGR_DIED | M_ATTK_DEF_DIED)
            ? MMOVE_DIED
            : result & M_ATTK_HIT
                ? MMOVE_MOVED
                : MMOVE_DONE;
        return finishMovement({
            oldx,
            oldy,
            x: monster.mx,
            y: monster.my,
            moved: monster.mx !== oldx || monster.my !== oldy,
            actionCompleted: status !== MMOVE_MOVED,
            heroDied: !!state.program_state.gameover,
            // m_move() returns without postmov(); mdisplacem() already
            // redrew both squares.
            postMoveOldSquarePainted: true,
            postMoveDestinationPainted: true,
        }, status, 'dochug');
    }
    if (selected)
        updateMonsterRegions(monster, state, { x: nix, y: niy });
    if (selectedInfo & ALLOW_ROCK && monsterCanBreakBoulder(monster)) {
        await breakMonsterBoulder(monster, nix, niy, state, { random });
        return finishMovement({
            oldx,
            oldy,
            x: oldx,
            y: oldy,
            moved: false,
            actionCompleted: true,
        }, MMOVE_DONE, 'dochug');
    }
    if (selected)
        await leaveMovementCloud(state, monster.mnum, !!monster.mcan, oldx, oldy, random);
    if (selected) {
        removeMonsterFromMapAt(oldx, oldy, state);
        await placeMonsterOnMap(monster, nix, niy, state);
        if (monster.wormno)
            await advanceMonsterWormBody(monster, { state, random, rollDice, rollOne });
        // C m_move() exposes a concealer which left its cover right after
        // place_monster(), before postmov() decides whether to hide again.
        // dog_move() has no such call, so a pet stays hidden through its move.
        await maybeUnhideAt(monster.mx, monster.my, state);
        if (!Array.isArray(monster.mtrack))
            monster.mtrack = [];
        monster.mtrack.unshift({ x: oldx, y: oldy });
        monster.mtrack.length = Math.min(monster.mtrack.length, 4);
    }
    else {
        if (isUnicorn(monster) && recordRandom(random, calls, 2)
            && !await reportMonsterTeleportRestriction(monster, { state })) {
            const relocation = await randomMonsterRelocation(monster, {
                state, calls, random, rollOne, flags: RLOC_MSG,
            });
            // Native m_move() returns MOVED even if rloc() finds no square,
            // and skips postmov() for this fallback; rloc() already redrew
            // both squares.
            return finishMovement({
                ...(relocation || { oldx, oldy, x: oldx, y: oldy, moved: false }),
                postMoveOldSquarePainted: true,
                postMoveDestinationPainted: true,
            }, MMOVE_MOVED, 'dochug');
        }
        if (monster.wormno)
            await shrinkStationaryMonsterWorm(monster, { rollDice });
    }
    return finishMovement({
        oldx,
        oldy,
        x: nix,
        y: niy,
        moved: nix !== oldx || niy !== oldy,
    }, selected ? MMOVE_MOVED : MMOVE_NOTHING, 'postmov');
}
export async function beginMonsterHeroAttack(monster, state, random, rollOne, rollDice, calls) {
    // calc_mattacku_vars() also resets targeting left by an earlier ray/throw.
    state.bhitpos = { x: state.u.ux, y: state.u.uy };
    state.notonhead = false;
    if (dist2(monster.mx, monster.my, state.u.ux, state.u.uy) <= 3)
        endVoluntaryMultiTurn(state);
    if (monster.dead || monster.mhp <= 0)
        return { heroAttackResult: 1 };
    if ((state.underwater || state.u.uinwater)
        && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SWIM))
        return {};
    if (state.u.uswallow) {
        if (state.u.ustuck !== monster)
            return {};
        monster.mux = state.u.ux;
        monster.muy = state.u.uy;
        if (state.u.invulnerable)
            return {};
    }
    if (monster === state.u.usteed)
        return {};
    if (!state.u.uswallow && state.u.usteed) {
        const steed = state.u.usteed;
        const orc = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_ORC);
        // mattacku() chooses the steed before testing adjacency. Orcs
        // choose it half the time; other monsters choose it one in four.
        if (recordRandom(random, calls, orc ? 2 : 4) === 0
            && dist2(monster.mx, monster.my, state.u.ux, state.u.uy) <= 2) {
            const attack = await attackMonsterWithMonster(monster, steed, {
                state, random, rollDice, rollOne, calls,
            });
            if (monsterAttackStopsAggressor(attack))
                return { heroAttackResult: 1 };
            if (attack.heroDied || monster.dead || monster.mhp <= 0
                || steed.dead || steed.mhp <= 0 || !state.u.usteed
                || dist2(monster.mx, monster.my, state.u.ux, state.u.uy) > 2)
                return {};
            // A surviving steed retaliates immediately, including after a
            // miss, without spending a movement ration or a chance roll.
            const retaliation = await attackMonsterWithMonster(state.u.usteed, monster, {
                state, random, rollDice, rollOne, calls,
            });
            const attackerDied = retaliation.kind === 'monster-attack'
                && !!((retaliation.nativeResult ?? 0) & M_ATTK_DEF_DIED);
            return { heroAttackResult: attackerDied ? 1 : 0 };
        }
    }
    // C mattacku(): a concealed hero (hiding or mimicking) is revealed
    // instead of attacked, before the armor-class differential.
    if (await revealConcealedHeroToAttacker(monster, {
        state, random, rollOne, rollDice, calls,
    }))
        return {};
    if (await disturbMealMimicry(monster, { state }))
        return {};
    const threshold = monsterAttackThreshold(monster, state, rollOne, calls);
    // C mhitu.c:721-724 — make eels visible the moment they hit or miss us.
    if (MONSTER_SYMBOL[monster.mnum] === S_EEL && monster.minvis
        && cansee(monster.mx, monster.my)) {
        monster.minvis = 0;
        await newsym(monster.mx, monster.my);
    }
    const alreadyFleeing = !!monster.mflee;
    await summonMonsterAttackHelp(monster, state, random);
    if (monster.mflee && !alreadyFleeing)
        return {};
    if (state.u.invulnerable) {
        const apparentDistance = dist2(monster.mx, monster.my, monster.mux ?? 0, monster.muy ?? 0);
        const appearsAdjacent = apparentDistance < 3
            && !(apparentDistance === 2 && monster.mnum === PM_GRID_BUG);
        if (state.u.ustuck === monster) {
            await plineWithContinuation(`${canonicalMonsterName(monster, { state, capitalized: true })} loosens its grip slightly.`);
        }
        else if (appearsAdjacent) {
            await plineWithContinuation(canSpotMonster(monster)
                ? `${canonicalMonsterName(monster, { state, capitalized: true })} starts to attack you, but pulls back.`
                : formatFeltMessage('something move nearby.', state));
        }
        return {};
    }
    const offensive = selectMonsterOffensiveItem(monster, state, {
        random: limit => recordRandom(random, calls, limit),
    });
    const sequence = {
        monster,
        cachedMnum: monster.mnum,
        threshold,
        nextSlot: 0,
        current: null,
        results: [],
        lastAttackRoll: 0,
        firstFoundYou: monster.mux === state.u.ux && monster.muy === state.u.uy,
        paging: { pagerOwned: false },
        offensive: offensive ? { status: 'selected', choice: offensive } : null,
        skipNonMagic: false,
        skipBrainDrain: false,
        done: false,
    };
    if (!offensive)
        await advanceHeroAttackSequence(sequence, state, random, rollOne, rollDice, calls);
    return { heroAttackSequence: sequence };
}
// The movement presenter reaches this after postmov feedback. Item use keeps
// its native async stack across messages; only a zero result starts the normal
// attacks, using the threshold already calculated by this mattacku call.
export async function completeMonsterOffensiveAction(action, state, random = rn2, rollDice = d, rollOne = rnd) {
    const sequence = action.movement.heroAttackSequence;
    const offensive = sequence?.offensive;
    if (!sequence || offensive?.status !== 'selected')
        return;
    const previousDeferral = state._deferVisibleMonsterContact;
    state._deferVisibleMonsterContact = true;
    try {
        const result = await useMonsterOffensiveItem(action.monster, offensive.choice, {
            state, random, rollDice, rollOne,
            publish: monsterAttackMessagePublisher(sequence.paging),
        });
        sequence.offensive = { status: 'completed', result };
        action.movement.heroDied = result.heroDied;
        if (action.monster.dead || action.monster.mhp <= 0) {
            action.movement.actorDied = true;
            action.movement.postMoveStatus = MMOVE_DIED;
        }
        if (result.heroDied || result.nativeResult !== 0) {
            sequence.done = true;
            action.movement.actionCompleted = true;
        }
        else {
            await advanceHeroAttackSequence(sequence, state, random, rollOne, rollDice, action.calls);
        }
    }
    finally {
        state._deferVisibleMonsterContact = previousDeferral;
    }
}
async function advanceHeroAttackSequence(sequence, state, random, rollOne, rollDice, calls) {
    const monster = sequence.monster;
    while (!sequence.done && sequence.nextSlot < 6) {
        if (state.program_state.gameover || monster.dead || monster.mhp <= 0 || monster.mx === 0)
            break;
        const attackIndex = sequence.nextSlot++;
        sequence.results[attackIndex] = M_ATTK_MISS;
        const foundHero = monster.mux === state.u.ux && monster.muy === state.u.uy;
        if (attackIndex > 0) {
            state.bhitpos = { x: state.u.ux, y: state.u.uy };
            state.notonhead = false;
            if (sequence.firstFoundYou && !foundHero)
                continue;
        }
        const effectiveAttack = selectAttack(monster, state.u, attackIndex, sequence.results, state);
        if (sequence.skipBrainDrain && effectiveAttack[0] === AT_TENT && effectiveAttack[1] === AD_DRIN)
            continue;
        const slot = {
            attackIndex,
            effectiveAttack,
            oldFormMnum: state.u.umonnum,
        };
        const attack = await beginHeroAttackSlot(sequence, slot, state, random, rollOne, rollDice, calls);
        if (attack) {
            sequence.current = { ...slot, ...attack };
            return sequence.current;
        }
        sequence.current = null;
        // A slot that reaches the end of mattacku()'s switch without an
        // attack still commits pending status; its continue paths do not.
        if (!attackSlotContinues(sequence, effectiveAttack[0], state)
            && state === game && state.context.botl)
            await bot();
    }
    sequence.current = null;
    sequence.done = true;
    return null;
}
// C mattacku() loop entries that `continue` before reaching bot().
function attackSlotContinues(sequence, attackType, state) {
    const monster = sequence.monster;
    if (state.u.uswallow && attackType !== AT_ENGL)
        return true;
    if (sequence.skipNonMagic && attackType !== AT_MAGC)
        return true;
    if (attackType !== AT_KICK || !monster.mtrapped)
        return false;
    const trap = trapAt(state, monster.mx, monster.my);
    return trap?.ttyp === PIT || trap?.ttyp === SPIKED_PIT;
}
// Finish breamm() in the same actor transaction across ray message input.
export async function resolveDeferredMonsterBreath(action, breath, state, emitMessage, random = rn2, rollDice = d, rollOne = rnd) {
    if (!breath?.launched || !breath.deferredRay)
        return breath || null;
    if (breath.damageType < AD_MAGM || breath.damageType > AD_SPC2) {
        await impossible(`Breath weapon ${breath.damageType - 1} used`, { state });
        breath.deferredRay = false;
        breath.finished = true;
        return breath;
    }
    const monster = action.monster;
    const publish = emitMessage || plineWithContinuation;
    if (canSeeMonster(monster)) {
        const weapon = heroIsHallucinating(state)
            ? displayRayName(breath.damageType, 'breath', { state, random }).replace(/^blast of /, '')
            : breathWeaponName(breath.damageType);
        await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} breathes ${weapon}!`);
    }
    const direction = [
        ['y', 'k', 'u'],
        ['h', null, 'l'],
        ['b', 'j', 'n'],
    ][breath.dy + 1]?.[breath.dx + 1];
    if (!direction)
        throw new Error('A launched breath needs a nonzero unit direction');
    const result = await castNativeRay(-(20 + breath.damageType - 1), breath.dice, direction, {
        state,
        sourceMonster: monster,
        originX: monster.mx,
        originY: monster.my,
        publish,
        random,
        rollDice,
        rollOne,
        sayHit: true,
        sayMiss: true,
    });
    breath.heroDied = result.heroDied;
    if (result.heroDied)
        return breath;
    endVoluntaryMultiTurn(state);
    if (!random(3))
        monster.mspec_used = 8 + random(18);
    if (breath.damageType === AD_SLEE && !state.u.sleepResistance)
        monster.mspec_used = (monster.mspec_used || 0) + rollOne(20);
    if (monster.mtame && !monster.isminion && monster.edog && monster.edog.hungrytime >= 10)
        monster.edog.hungrytime -= 10;
    breath.deferredRay = false;
    breath.finished = true;
    return breath;
}
// Ranged effects finish before returning their slot. Their real message
// continuations update the same sequence context used by contact effects.
function monsterAttackMessagePublisher(paging) {
    return async (message, options) => {
        const dismissal = await plineWithContinuation(message, options);
        if (dismissal != null)
            paging.pagerOwned = true;
        return dismissal;
    };
}
async function beginHeroAttackSlot(sequence, slot, state, random, rollOne, rollDice, calls, retainedAttackRoll = null, deferVisibleContact = !!state?._deferVisibleMonsterContact) {
    const monster = sequence.monster;
    requirePerceivedHero(monster);
    const { attackIndex, effectiveAttack, oldFormMnum } = slot;
    const [attackType, damageType, dice, sides] = effectiveAttack;
    const naturalContact = [AT_CLAW, AT_KICK, AT_BITE, AT_STNG, AT_TUCH, AT_BUTT, AT_TENT]
        .includes(attackType);
    const threshold = sequence.threshold;
    const alreadyEngulfing = attackType === AT_ENGL && state.u.uswallow && state.u.ustuck === monster;
    if ((state.u.uswallow && attackType !== AT_ENGL) ||
        (sequence.skipNonMagic && attackType !== AT_MAGC))
        return null;
    const foundHero = monster.mux === state.u.ux && monster.muy === state.u.uy;
    const dx = monster.mx - monster.mux;
    const dy = monster.my - monster.muy;
    const distant = dx * dx + dy * dy >= 3 ||
        (MONSTER_NAME[monster.mnum] === 'grid bug' && dx !== 0 && dy !== 0);
    if (attackType === AT_BREA) {
        if (!distant)
            return null;
        const breath = maybeBreatheAtHero(monster, effectiveAttack, state, random, calls);
        return { kind: 'hero-breath', breath, nativeResult: breath.nativeResult };
    }
    if (attackType === AT_SPIT) {
        if (!distant)
            return null;
        const publish = monsterAttackMessagePublisher(sequence.paging);
        const spit = await resolveMonsterSpitAtHero(monster, effectiveAttack, {
            state, random: range => recordRandom(random, calls, range), rollOne, publish,
        });
        return { kind: 'hero-spit', spit, nativeResult: spit.nativeResult };
    }
    if (attackType === AT_WEAP && distant) {
        if (state.level.flags?.rogue_level)
            return null;
        const publish = monsterAttackMessagePublisher(sequence.paging);
        const projectile = await attackHeroWithRangedWeapon(monster, state, random, rollOne, calls, publish);
        return projectile
            ? { kind: 'hero-projectile', projectile, nativeResult: M_ATTK_MISS }
            : null;
    }
    if (attackType === AT_GAZE) {
        if (MONSTER_NAME[sequence.cachedMnum] === 'Medusa')
            return null;
        return {
            kind: 'hero-gaze',
            attackType,
            damageType,
            dice,
            sides,
            nativeResult: M_ATTK_MISS,
        };
    }
    if (attackType === AT_EXPL) {
        return distant
            ? null
            : {
                kind: 'hero-explosion',
                attackType,
                damageType,
                dice,
                sides,
                foundHero,
                nativeResult: M_ATTK_MISS,
            };
    }
    if (attackType === AT_MAGC && distant) {
        if (damageType < AD_MAGM || damageType > AD_SPC2)
            return null;
        return {
            kind: 'hero-magic-ray',
            attackType,
            damageType,
            dice,
            sides,
            nativeResult: M_ATTK_MISS,
        };
    }
    // C mattacku() lets a monster that is holding the hero (u.ustuck) use
    // its hug attack even when it is not beside the hero's apparent spot.
    if (attackType !== AT_MAGC && distant
        && !(attackType === AT_HUGS && state.u.ustuck === monster))
        return null;
    if (naturalContact) {
        if (attackType === AT_KICK && monster.mtrapped) {
            const trap = trapAt(state, monster.mx, monster.my);
            if (trap?.ttyp === PIT || trap?.ttyp === SPIKED_PIT)
                return null;
        }
        if (monsterWieldedWeapon(monster) && !monster.mconf && !heroHasConflict(state)
            && touchPetrifies(heroSpecies(state)))
            return null;
    }
    // Native AT_WEAP prepares a melee weapon even at the wrong location.
    // Wielding spends this slot; the next attack slot may still proceed.
    if (attackType === AT_WEAP) {
        const currentWeapon = monsterWieldedWeapon(monster);
        if (monster.weaponCheck === NEED_WEAPON || !currentWeapon) {
            monster.weaponCheck = NEED_HTH_WEAPON;
            if (await wieldMonsterWeapon(monster, state))
                return null;
        }
    }
    if (attackType === AT_ENGL && !foundHero) {
        return {
            kind: 'hero-attack',
            attackType,
            damageType,
            hit: false,
            effect: 'engulf-unfound',
            nativeResult: M_ATTK_MISS,
        };
    }
    if ((naturalContact || attackType === AT_WEAP) &&
        !foundHero) {
        sequence.skipNonMagic = true;
        return {
            kind: 'hero-attack',
            threshold,
            hit: false,
            roll: null,
            attackType,
            damageType,
            attackIndex,
            effect: 'wild-miss',
        };
    }
    if (attackType === AT_HUGS &&
        state.u.ustuck !== monster &&
        !(attackIndex >= 2 &&
            sequence.results[attackIndex - 1] &&
            sequence.results[attackIndex - 2]))
        return null;
    if (![
        AT_CLAW,
        AT_KICK,
        AT_BITE,
        AT_STNG,
        AT_TUCH,
        AT_BUTT,
        AT_TENT,
        AT_HUGS,
        AT_WEAP,
        AT_MAGC,
        AT_ENGL,
    ].includes(attackType))
        return null;
    if (attackType === AT_MAGC) {
        // mhitu.c:mattacku() enters castmu() without a to-hit die.  Spell
        // choice and fumble precede the casting line.  Base spell damage is
        // rolled only after that line returns from tty; a long actor name can
        // therefore move d() to the acknowledgement input.
        const monsterLevel = monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0;
        const choosesSpell = damageType === AD_SPEL || damageType === AD_CLRC;
        let spell = choosesSpell
            ? monsterLevel ? chooseMonsterSpell(monster, damageType, state, random, calls)
                : MONSTER_WIZARD_SPELLS[0]
            : undefined;
        if (choosesSpell && !spell)
            return {
                kind: 'hero-spell',
                threshold,
                attackType,
                damageType,
                attackIndex,
                cast: false,
            };
        if (!monsterLevel)
            return {
                kind: 'hero-spell', threshold, attackType, damageType, attackIndex,
                cast: false, blocked: true,
                curseKind: monsterCurseKind(monster, !!(spell && (spell.flags & MCF_INDIRECT)), state, random, calls),
            };
        // C castmu() starts cnt at 40.  choose_monster_spell() already tests
        // usefulness while walking the spell table; the do/while condition
        // tests the returned spell once more, but there is no third probe
        // after the loop.  Stateful usefulness checks such as geyser's
        // rn2(5) make that exact call count observable.
        let attempts = 39;
        while (spell && (damageType === AD_SPEL || damageType === AD_CLRC)
            && attempts-- > 0 && monsterSpellUseless(monster, spell, state, random, calls)) {
            spell = chooseMonsterSpell(monster, damageType, state, random, calls);
        }
        if (attempts < 0) {
            return {
                kind: 'hero-spell',
                threshold,
                attackType,
                damageType,
                attackIndex,
                ...(spell ? { spell: spell.key } : {}),
                cast: false,
            };
        }
        if (monster.mcan ||
            monster.mspec_used ||
            ((monster.seen_resistance ?? 0) & seenResistanceForDamage(damageType))) {
            const curseKind = monsterCurseKind(monster, !!(spell && (spell.flags & MCF_INDIRECT)), state, random, calls);
            return {
                kind: 'hero-spell',
                threshold,
                attackType,
                damageType,
                attackIndex,
                ...(spell ? { spell: spell.key } : {}),
                cast: false,
                blocked: true,
                curseKind,
            };
        }
        if (choosesSpell)
            monster.mspec_used = monsterLevel < 8 ? 10 - monsterLevel : 2;
        const directed = !(spell && (spell.flags & MCF_INDIRECT));
        if (!foundHero && directed)
            return {
                kind: 'hero-spell', threshold, attackType, damageType, attackIndex,
                ...(spell ? { spell: spell.key } : {}), cast: false, misdirected: true,
            };
        endVoluntaryMultiTurn(state);
        const fumble = recordRandom(random, calls, Math.max(1, monsterLevel * 10)) <
            (monster.mconf ? 100 : 20);
        if (fumble) {
            return {
                kind: 'hero-spell',
                threshold,
                attackType,
                damageType,
                attackIndex,
                ...(spell ? { spell: spell.key } : {}),
                cast: false,
                fumbled: true,
            };
        }
        const spellDice = sides
            ? Math.trunc(monsterLevel / 2) + dice
            : Math.trunc(monsterLevel / 2) + 1;
        const spellSides = sides || 6;
        return {
            kind: 'hero-spell',
            threshold,
            attackType,
            damageType,
            attackIndex,
            ...(spell ? { spell: spell.key } : {}),
            cast: true,
            spellDice: foundHero ? spellDice : 0,
            spellSides,
            deferredSpellDamage: true,
            directed,
            deferredSpellEffect: true,
        };
    }
    if (attackType === AT_ENGL && monster.mspec_used && !alreadyEngulfing) {
        return {
            kind: 'hero-attack',
            threshold,
            hit: false,
            roll: sequence.lastAttackRoll,
            nearMiss: threshold === sequence.lastAttackRoll,
            attackType,
            damageType,
            attackIndex,
            effect: 'engulf-cooldown-miss',
        };
    }
    let weaponAccuracy = 0;
    if (attackType === AT_WEAP) {
        const wieldedWeapon = monsterWieldedWeapon(monster);
        if (wieldedWeapon && !retainedAttackRoll) {
            weaponAccuracy = weaponHitBonus(wieldedWeapon, state.u, {
                state,
                random,
                rollOne,
            });
            await swingMonsterWeapon(monster, wieldedWeapon, state, { random });
        }
    }
    const toHitSides = 20 + attackIndex;
    let roll = null;
    let hit = true;
    if (retainedAttackRoll) {
        roll = retainedAttackRoll.roll;
        hit = retainedAttackRoll.hit;
    }
    else if (!alreadyEngulfing && attackType !== AT_HUGS) {
        roll = sequence.lastAttackRoll = rollOne(toHitSides);
        calls.push(`rnd(${toHitSides})`);
        hit = threshold + weaponAccuracy > roll;
    }
    if (hit && (naturalContact || attackType === AT_HUGS)) {
        if (monsterGrabPassesThroughHero(effectiveAttack, state)) {
            return {
                kind: 'hero-attack',
                roll,
                threshold,
                hit: false,
                damage: 0,
                attackType,
                damageType,
                effect: 'failed-grab',
                nativeResult: M_ATTK_MISS,
            };
        }
        // A failed kick still reports a miss; a successful kick cannot
        // penetrate thick skin and never enters hitmu().
        if (attackType === AT_KICK && monsterIsThickSkinned({ mnum: heroSpecies(state) }))
            return null;
    }
    // C hitmu() reveals a concealed attacker before rolling base damage.
    // That pline can suspend behind an older tty topline, so preserve the
    // already-consumed attack die and resume this same slot afterward.
    const hiddenUnder = hit &&
        !retainedAttackRoll &&
        monster.mundetected &&
        ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_CONCEAL ||
            MONSTER_SYMBOL[monster.mnum] === S_EEL);
    if (hiddenUnder) {
        if (!canSpotMonster(monster))
            await map_invisible(monster.mx, monster.my);
        slot.attackerMapped = true;
        monster.mundetected = 0;
        if (!senseWithTelepathy(monster) && !heroDetectsMonsters(state)) {
            const object = state.level?.objects[monster.mx]?.[monster.my]?.[0];
            if (object) {
                let what;
                if (heroIsBlind(state) && !object.dknown) {
                    what = 'something';
                }
                else if (isPoolAt(monster.mx, monster.my, state)
                    && !state.u.underwater) {
                    what = 'the water';
                }
                else {
                    observeObjectForNaming(object, { state });
                    what = await objectDescription(object, { state });
                }
                const name = canonicalMonsterName(monster, { state, article: 'a', capitalized: true });
                return {
                    kind: 'hero-attack', roll, threshold, hit,
                    attackType, damageType, attackIndex,
                    deferredRevealUnder: true,
                    revealUnderMessage: `${name === 'It' ? 'Something' : name} was hidden under ${what}!`,
                };
            }
            await newsym(monster.mx, monster.my);
        }
    }
    // gulpmu() has its own roll; every successful contact enters hitmu()
    // once, including harmless touches and unsupported special effects.
    let damage = 0;
    if (hit) {
        // C mattacku() displays pending movement before gulpmu(), even
        // when admission later fails silently (for example, at iron bars).
        if (attackType === AT_ENGL && state === game)
            await flush_screen(1);
        damage = rollDice(dice, sides);
        calls.push(`d(${dice},${sides})`);
        if (attackType !== AT_ENGL
            && (monsterIsUndead(monster.mnum) || monsterIsVampireShifter(monster))
            && recorderLocalHour(state.datetime) === 0) {
            damage += rollDice(dice, sides);
            calls.push(`d(${dice},${sides})`);
        }
    }
    const poisonAttribute = poisonAttackAttribute(damageType);
    // mhitu.c:hitmu() rolls the AT_WEAP slot's declared base damage, then
    // weapon.c:dmgval() rolls the wielded weapon's small-target die.  The
    // visible hit line precedes knockback and HP subtraction.
    const contactWeapon = attackType === AT_WEAP ? monsterWieldedWeapon(monster) : null;
    if (hit && attackType === AT_ENGL) {
        // gulpmu() rolls before silent admission and failed-grab checks.
        if (alreadyEngulfing) {
            return {
                kind: 'hero-attack',
                roll,
                threshold,
                hit: true,
                damage: 0,
                attackType,
                damageType,
                effect: 'engulf-tick',
                engulfDamage: damage,
                deferredEngulf: 'effect',
            };
        }
        if (!monsterCanEngulfHero(monster, state)) {
            return {
                kind: 'hero-attack',
                roll,
                threshold,
                hit: false,
                damage: 0,
                attackType,
                damageType,
                effect: 'engulf-refused',
            };
        }
        if (monsterGrabPassesThroughHero(effectiveAttack, state)) {
            return {
                kind: 'hero-attack',
                roll,
                threshold,
                hit: false,
                damage: 0,
                attackType,
                damageType,
                effect: 'failed-grab',
            };
        }
        const engulfOldX = monster.mx;
        const engulfOldY = monster.my;
        await unplaceBallAndChain(state);
        monster.mtrapped = 0;
        monster.mx = state.u.ux;
        monster.my = state.u.uy;
        setHeroGrip(monster, state);
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage: 0,
            attackType,
            damageType,
            attackIndex,
            effect: 'engulf',
            engulfDamage: damage,
            deferredEngulf: 'capture',
            engulfOldX,
            engulfOldY,
        };
    }
    else if (hit && contactWeapon && damageType === AD_PHYS) {
        const poison = (roll ?? 0) <= 5 &&
            (contactWeapon.opoisoned || isPermanentlyPoisonedObject(contactWeapon))
            ? { attribute: A_STR, fatal: 10 }
            : null;
        if (contactWeapon.otyp === CORPSE && touchPetrifies(contactWeapon.corpsenm)) {
            const subject = canSpotMonster(monster) ? monsterSentenceSubject(monster) : 'It';
            await plineWithContinuation(`${subject} hits you with the ${MONSTER_NAME[contactWeapon.corpsenm ?? -1]} corpse.`);
            if (await startHeroPetrificationFromMonster(monster, state)) {
                await knockHeroFromMonster(monster, { attackType, damageType, hit }, state, random);
                return {
                    kind: 'hero-attack',
                    roll,
                    threshold,
                    hit,
                    damage: 0,
                    attackType,
                    damageType,
                    effect: 'petrifying-corpse',
                };
            }
            damage = 1;
        }
        const weaponDamage = rollPhysicalWeaponDamageAgainstHero(contactWeapon, state, {
            rollOne: (range) => {
                calls.push(`rnd(${range})`);
                return rollOne(range);
            },
            rollDice: (count, sides) => {
                calls.push(`d(${count},${sides})`);
                return rollDice(count, sides);
            },
        });
        damage = Math.max(1, damage + weaponDamage + monsterWeaponStrengthBonus(monster, random));
        if (deferVisibleContact) {
            return {
                kind: 'hero-attack',
                roll,
                threshold,
                hit,
                damage,
                attackType,
                damageType,
                effect: 'physical-weapon',
                oldFormMnum,
                poison,
                deferredPostHit: true,
            };
        }
        const artifact = await applyArtifactHit(contactWeapon, 'hero', damage, {
            state, attacker: monster, dieRoll: roll ?? 0,
            publish: plineWithContinuation, random, rollOne,
        });
        if (artifact.heroDied)
            return {
                kind: 'hero-attack', hit, damage: 0, heroDied: true, attackType, damageType,
            };
        damage = artifact.damage;
        if (damage) {
            damage = await resolveMonsterWeaponContact(monster, contactWeapon, damage, state, plineWithContinuation, rollOne);
            await erodeAttackingWeapon(state.u, contactWeapon, { state, random });
        }
        if (artifact.damage && poison) {
            const effect = await poisonHeroFromMonster(monster, attackType, {
                ...poison,
                state,
                random,
                rollOne,
                rollDice,
            });
            if (effect.died)
                return {
                    kind: 'hero-attack',
                    roll,
                    threshold,
                    hit,
                    damage: 0,
                    heroDied: true,
                    attackType,
                    damageType,
                };
        }
        const knockback = await knockHeroFromMonster(monster, { attackType, damageType, hit }, state, random);
        if (knockback.defenderDied)
            return { kind: 'hero-attack', hit, damage: 0, heroDied: true, attackType, damageType };
        damage = reduceHeroContactDamage(monster, damage, state, rollOne, calls);
        const passive = await finishHeroContactDamage(monster, damage, attackType, oldFormMnum, state, {
            random,
            rollDice,
        });
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'physical-weapon',
            specialMessage: artifact.specialMessage,
            passive,
            heroDied: !!passive.heroDied,
        };
    }
    else if (hit && monster.mnum === 116 && !deferVisibleContact) {
        // PM_GRID_BUG: AT_BITE AD_ELEC 1d1.  The electric special checks
        // magic cancellation, optionally checks inventory destruction, then
        // the shared post-hit knockback path consumes its distance/chance
        // draws even though an electric bite cannot knock the hero back.
        const armorProtection = magicNegation(state.u, state);
        const negated = recordRandom(random, calls, 10) < 3 * armorProtection;
        if (!negated) {
            recordRandom(random, calls, 20);
        }
        else {
            damage = 0;
        }
        const knockback = await knockHeroFromMonster(monster, { attackType, damageType, hit }, state, random);
        if (knockback.defenderDied)
            return { kind: 'hero-attack', hit, damage: 0, heroDied: true, attackType, damageType };
        damage = reduceHeroContactDamage(monster, damage, state, rollOne, calls);
        const passive = await finishHeroContactDamage(monster, damage, attackType, oldFormMnum, state, {
            random,
            rollDice,
        });
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            passive,
            heroDied: !!passive.heroDied,
            effect: negated ? 'electric-avoided' : 'electric-zap',
        };
    }
    else if (hit && poisonAttribute !== null) {
        // uhitm.c:mhitm_ad_drst() family.  Poisonous natural attacks roll
        // their physical damage first, then magic cancellation; only a
        // non-negated attack reaches the one-in-eight attribute-poison gate.
        const negated = specialAttackNegated(monster, state.u, { state, random });
        const poison = negated ? null : { attribute: poisonAttribute, chance: 8 };
        if (deferVisibleContact) {
            return {
                kind: 'hero-attack',
                roll,
                threshold,
                hit,
                damage,
                attackType,
                damageType,
                effect: 'poisonous-natural',
                poison,
                deferredPostHit: true,
            };
        }
        if (poison) {
            const effect = await poisonHeroFromMonster(monster, attackType, {
                ...poison,
                state,
                random,
                rollOne,
                rollDice,
            });
            if (effect.died)
                return {
                    kind: 'hero-attack',
                    roll,
                    threshold,
                    hit,
                    damage: 0,
                    heroDied: true,
                    attackType,
                    damageType,
                };
        }
        const knockback = await knockHeroFromMonster(monster, { attackType, damageType, hit }, state, random);
        if (knockback.defenderDied)
            return { kind: 'hero-attack', hit, damage: 0, heroDied: true, attackType, damageType };
        damage = reduceHeroContactDamage(monster, damage, state, rollOne, calls);
        const passive = await finishHeroContactDamage(monster, damage, attackType, oldFormMnum, state, {
            random,
            rollDice,
        });
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'poisonous-natural',
            passive,
            heroDied: !!passive.heroDied,
        };
    }
    else if (hit && (damageType === AD_WERE || damageType === AD_SLEE
        || damageType === AD_POLY || damageType === AD_TLPT || damageType === AD_PLYS
        || damageType === AD_WRAP || damageType === AD_DRIN || damageType === AD_CURS
        || damageType === AD_HEAL || damageType === AD_ACID || damageType === AD_SLOW
        || damageType === AD_SGLD || damageType === AD_SSEX || damageType === AD_DISE
        || damageType === AD_CONF || damageType === AD_PEST || damageType === AD_FAMN
        || damageType === AD_DETH || damageType === AD_SAMU)) {
        const negated = damageType === AD_SLOW
            ? specialAttackNegated(monster, state.u, { state, random })
            : damageType === AD_POLY
                && (specialAttackNegated(monster, state.u, { state, random }) || !!monster.mspec_used);
        return {
            kind: 'hero-attack', roll, threshold, hit, damage, attackType, damageType,
            oldFormMnum, negated, deferredSpecialContact: true,
            ...(damageType === AD_WRAP ? { effect: 'wrapping-natural' } : {}),
            ...(damageType === AD_HEAL ? { effect: `nurse-${nurseContactMode(monster, state)}` } : {}),
            ...(damageType === AD_SSEX ? { effect: 'seduction-contact' } : {}),
            ...(damageType === AD_PEST ? { effect: 'pestilence-contact' } : {}),
            ...(damageType === AD_FAMN ? { effect: 'famine-contact' } : {}),
            ...(damageType === AD_DETH ? { effect: 'death-contact' } : {}),
        };
    }
    else if (hit && damageType === AD_STCK) {
        const armorProtection = magicNegation(state.u, state);
        const negated = !!monster.mcan || recordRandom(random, calls, 10) < 3 * armorProtection;
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'sticking-natural',
            negated,
            deferredStickingAfterHit: true,
            oldFormMnum,
        };
    }
    else if (hit &&
        !alreadyEngulfing &&
        attackType !== AT_ENGL &&
        damageType === AD_FIRE &&
        dice > 0 &&
        sides > 0) {
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'fire-natural',
            deferredFireNegation: true,
            oldFormMnum,
        };
    }
    else if (hit && attackType !== AT_ENGL && damageType === AD_COLD) {
        // hitmu() rolls base damage before mhitm_ad_cold(), but the latter
        // projects hitmsg() before checking magic cancellation.  Leave that
        // check deferred so an already-full tty topline can suspend between
        // d() and rn2(10).
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'cold-natural',
            deferredColdNegation: true,
        };
    }
    else if (hit &&
        !alreadyEngulfing &&
        attackType !== AT_ENGL &&
        damageType === AD_ELEC &&
        dice > 0 &&
        sides > 0) {
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'electric-natural',
            deferredElectricNegation: true,
        };
    }
    else if (hit && (damageType === AD_SITM || damageType === AD_SEDU)) {
        // hitmu() records the attack's declared zero dice before dispatching
        // both theft claws through mhitm_ad_sedu(). A successful theft ends the
        // aggressor's attack sequence, so do not retain its second claw slot.
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'item-theft',
            deferredItemTheft: true,
        };
    }
    else if (hit && damageType === AD_LEGS) {
        // uhitm.c:mhitm_ad_legs().  The declared sting damage and chosen
        // side precede the special contact line.  Wound duration, attribute
        // exercise, knockback, and HP damage all remain after that pline, so
        // a tty pager can suspend one xan slot at the same source boundary.
        const legSide = recordRandom(random, calls, 2) ? 'right' : 'left';
        const boots = state?.uarmf || state?.u?.uarmf;
        const airborneHero = !!(state?.u?.usteed ||
            state?.u?.levitating ||
            state?.u?.levitation ||
            state?.u?.flying);
        const attackerFlies = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_FLY);
        let legContact = 'prick';
        let deferredLegEffect = true;
        if (airborneHero && !attackerFlies) {
            legContact = 'reach';
            damage = 0;
            deferredLegEffect = false;
        }
        else if (monster.mcan) {
            legContact = 'nuzzle';
            damage = 0;
            deferredLegEffect = false;
        }
        else if (boots) {
            const exposed = recordRandom(random, calls, 2) !== 0 &&
                [LOW_BOOTS, IRON_SHOES].includes(boots.otyp);
            if (exposed) {
                legContact = 'exposed-prick';
            }
            else if (recordRandom(random, calls, 5) === 0) {
                legContact = 'boot-prick';
            }
            else {
                legContact = 'boot-scratch';
                damage = 0;
                deferredLegEffect = false;
            }
        }
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'leg-natural',
            legSide,
            legContact,
            deferredLegEffect,
            deferredPostHit: !deferredLegEffect,
            oldFormMnum,
        };
    }
    else if (hit && damageType === AD_BLND && dice > 0 && sides > 0) {
        // hitmu() rolls the declared damage before mhitm_ad_blnd().  A raven
        // claw converts that amount into blindness duration, prints its
        // special line before toggling sight, then still enters the shared
        // knockback tail with zero HP damage.
        const blindIncrement = damage;
        const blindApplicable = heroCanBeBlindedByContact(monster, attackType, state);
        const heroWasBlind = !!state?.blind || (state?.u?.blindTurns ?? 0) > 0;
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage: 0,
            attackType,
            damageType,
            effect: 'blind-natural',
            blindIncrement,
            blindApplicable,
            blindMessage: blindApplicable && !heroWasBlind,
            deferredBlindEffect: true,
        };
    }
    else if (hit && damageType === AD_STUN) {
        // uhitm.c:mhitm_ad_stun().  The kick's declared damage and hitmsg
        // precede cancellation and the one-in-four stun gate.  A selected
        // effect adds the full damage to HStun, then halves only the HP
        // damage before entering the common knockback/contact tail.
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'stun-natural',
            deferredStunGate: true,
            oldFormMnum,
        };
    }
    else if (hit && damageType === AD_SLIM) {
        const armorProtection = magicNegation(state.u, state);
        const cancelled = !!monster.mcan;
        const negated = cancelled || recordRandom(random, calls, 10) < 3 * armorProtection;
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'slime-natural',
            slimeNegated: negated,
            slimeCancelled: cancelled,
            deferredSlimeEffect: true,
            oldFormMnum,
        };
    }
    else if (hit && damageType === AD_WERE) {
        return {
            kind: 'hero-attack', roll, threshold, hit, damage, attackType, damageType,
            deferredPostHit: true, oldFormMnum,
        };
    }
    else if (hit && damageType === AD_STON) {
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'stoning-natural',
            deferredPostHit: true,
        };
    }
    else if (hit && damageType === AD_RUST) {
        // uhitm.c:mhitm_ad_rust() still receives hitmu()'s declared 0d0
        // damage and publishes hitmsg() before cancellation or erode_armor().
        // Armor erosion is a separately resumable message owner; shared
        // knockback gates follow it before mattacku() advances attack slots.
        const completelyRustableForm = Upolyd(state?.u) && state.u.umonnum === 259;
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: monster.mcan ? 'cancelled-rust-natural' : 'rust-natural',
            oldFormMnum,
            deferredRustRehumanize: !monster.mcan && completelyRustableForm,
            deferredRustArmor: !monster.mcan && !completelyRustableForm,
            deferredPostHit: !!monster.mcan,
        };
    }
    else if (hit && damageType === AD_CORR) {
        // uhitm.c:mhitm_ad_corr() keeps the bite's declared 3d8 damage, but
        // hitmsg() and erode_armor(ERODE_CORRODE) both precede the common
        // knockback and HP-damage tail.  Keep armor erosion resumable across
        // tty exactly as for rust without conflating primary/secondary state.
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: monster.mcan ? 'cancelled-corrosion-natural' : 'corrosion-natural',
            oldFormMnum,
            deferredCorrosionArmor: !monster.mcan,
            deferredPostHit: !!monster.mcan,
        };
    }
    else if (hit && damageType === AD_DCAY) {
        // uhitm.c:mhitm_ad_dcay() follows the same hitmsg/cancellation/armor
        // continuation shape as rust, but erodes secondary rot state and
        // deliberately disables grease protection.
        const completelyRottableForm = Upolyd(state?.u) && [PM_LEATHER_GOLEM, 254].includes(state.u.umonnum);
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: monster.mcan ? 'cancelled-decay-natural' : 'decay-natural',
            oldFormMnum,
            deferredDecayRehumanize: !monster.mcan && completelyRottableForm,
            deferredDecayArmor: !monster.mcan && !completelyRottableForm,
            deferredPostHit: !!monster.mcan,
        };
    }
    else if (hit && damageType === AD_ENCH) {
        // uhitm.c:mhitm_ad_ench().  Base damage and magic negation precede
        // hitmsg(); some_armor(), drain resistance, and the state mutation
        // precede the optional "less effective" pline which can force the
        // earlier hit line through tty.
        const armorProtection = magicNegation(state.u, state);
        const negated = !!monster.mcan || recordRandom(random, calls, 10) < 3 * armorProtection;
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: negated ? 'cancelled-enchantment-natural' : 'enchantment-natural',
            deferredEnchantment: !negated,
            deferredPostHit: true,
            oldFormMnum,
        };
    }
    else if (hit && damageType === AD_DRLI) {
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: 'life-drain-natural',
            deferredLifeDrainGate: true,
            oldFormMnum,
        };
    }
    else if (hit &&
        (attackType !== AT_WEAP || !monsterWieldedWeapon(monster)) &&
        damageType === AD_PHYS) {
        const physicalHug = attackType === AT_HUGS && !heroFormSticks(state);
        if (physicalHug) {
            damage = await resolvePhysicalHeroHug(monster, damage, state, range => recordRandom(random, calls, range), monsterAttackMessagePublisher(sequence.paging));
        }
        const physicalEffect = physicalHug ? 'physical-hug'
            : attackType === AT_TUCH && damage === 0 && state.u.ustuck === monster
                ? 'silent-physical-touch'
                : attackType === AT_WEAP ? 'physical-unarmed-weapon' : 'physical-natural';
        // hitmu() rolls ordinary physical damage before pline() announces the
        // hit, but knockback and HP subtraction happen after that message.
        // The tty can suspend inside pline() for --More--, so the live actor
        // driver must be able to resume this same contact after input.
        if (deferVisibleContact) {
            return {
                kind: 'hero-attack',
                roll,
                threshold,
                hit,
                damage,
                attackType,
                damageType,
                effect: physicalEffect,
                oldFormMnum,
                deferredPostHit: true,
            };
        }
        // hitmu() enters mhitm_knockback() after ordinary physical damage.
        // Attack eligibility is tested only after both chance gates.
        const knockback = await knockHeroFromMonster(monster, { attackType, damageType, hit }, state, random);
        if (knockback.defenderDied)
            return { kind: 'hero-attack', hit, damage: 0, heroDied: true, attackType, damageType };
        damage = reduceHeroContactDamage(monster, damage, state, rollOne, calls);
        const passive = await finishHeroContactDamage(monster, damage, attackType, oldFormMnum, state, {
            random,
            rollDice,
        });
        return {
            kind: 'hero-attack',
            roll,
            threshold,
            hit,
            damage,
            attackType,
            damageType,
            effect: physicalEffect,
            passive,
            heroDied: !!passive.heroDied,
        };
    }
    return {
        kind: 'hero-attack',
        roll,
        threshold,
        hit,
        damage,
        attackType,
        damageType,
        nearMiss: !hit && roll === threshold + weaponAccuracy,
    };
}
// Native failed_grab(): the hero has no hittable worm tail, so only an
// unsolid body can defeat these holds without entering the hit transaction.
function monsterGrabPassesThroughHero(attack, state) {
    return monsterIsUnsolid({ mnum: heroSpecies(state) })
        && (attack[0] === AT_HUGS || [AD_DGST, AD_STCK, AD_WRAP].includes(attack[1]));
}
// Initial capture and every subsequent slot resume into the same gulpmu body.
export async function resumeDeferredHeroEngulf(action, state, { random = rn2, rollOne = rnd, publish = plineWithContinuation, flushMessages, die, } = {}) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-attack' || !attack.deferredEngulf)
        return null;
    if (attack.engulfDamage === undefined)
        throw new Error('A deferred engulf must retain its rolled damage');
    const monster = action.monster;
    const calls = action.calls;
    const options = {
        state,
        publish,
        ...(flushMessages ? { flushMessages } : {}),
        ...(die ? { die } : {}),
        random: (sides) => recordRandom(random, calls, sides),
        rollOne: (sides) => {
            const value = rollOne(sides);
            calls.push(`rnd(${sides})`);
            return value;
        },
    };
    if (attack.deferredEngulf === 'capture') {
        const capture = await beginHeroEngulf(monster, attack, options);
        if (!capture.captured) {
            attack.hit = false;
            attack.damage = attack.appliedDamage = 0;
            attack.deferredEngulf = false;
            attack.engulfResolved = true;
            delete attack.engulfDamage;
            return { died: capture.died };
        }
    }
    const result = await resolveHeroEngulf(monster, attack.damageType, attack.engulfDamage, options);
    attack.hit = result.hit;
    attack.damage = attack.appliedDamage = result.damage;
    attack.deferredEngulf = false;
    attack.engulfResolved = true;
    delete attack.engulfDamage;
    return result;
}
// Continue mhitm_ad_cold() after its hit message.
export function resumeDeferredHeroColdSpecial(action, state, random = rn2) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-attack' || !attack.deferredColdNegation)
        return action;
    const armorProtection = magicNegation(state.u, state);
    const cancelled = !!action.monster?.mcan;
    attack.coldOriginalDamage = attack.damage ?? 0;
    attack.negated = cancelled || recordRandom(random, action.calls, 10) < 3 * armorProtection;
    if (cancelled) {
        attack.damage = 0;
        attack.coldEffectMessage = null;
    }
    else if (attack.negated) {
        attack.damage = 0;
        attack.coldEffectMessage = 'You avoid harm.';
    }
    else {
        attack.coldEffectMessage = "You're covered in frost!";
        if (state.u.coldResistance) {
            attack.damage = 0;
            attack.coldResistanceMessage = "The frost doesn't seem cold!";
        }
    }
    attack.deferredColdInventory = !attack.negated;
    if (attack.negated)
        delete attack.coldOriginalDamage;
    attack.deferredPostHit = true;
    attack.deferredColdNegation = false;
    return action;
}
// Continue mhitm_ad_fire() after its hit message. Fire can burn slime and
// carried objects before the ordinary contact damage is applied.
export function resumeDeferredHeroFireSpecial(action, state, random = rn2) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-attack' || !attack.deferredFireNegation)
        return action;
    const armorProtection = magicNegation(state.u, state);
    const cancelled = !!action.monster?.mcan;
    attack.fireOriginalDamage = attack.damage ?? 0;
    attack.negated = cancelled || recordRandom(random, action.calls, 10) < 3 * armorProtection;
    if (cancelled) {
        attack.damage = 0;
        attack.fireEffectMessage = null;
    }
    else if (attack.negated) {
        attack.damage = 0;
        attack.fireEffectMessage = 'You avoid harm.';
    }
    else {
        const species = heroSpecies(state);
        const form = MONSTER_NAME[species];
        attack.fireEffectMessage = `You're ${monsterFireDescription({ mnum: species }, attack.attackType)}!`;
        if (form === 'paper golem' || form === 'straw golem') {
            // mhitm_ad_fire() burns these bodies before checking resistance.
            attack.deferredFireRehumanize = true;
        }
        else if (state.u.fireResistance) {
            attack.damage = 0;
            attack.fireResistanceMessage = "The fire doesn't feel hot!";
        }
    }
    const continuesFireEffects = !attack.negated && !attack.deferredFireRehumanize;
    attack.deferredFireInventory = continuesFireEffects;
    attack.deferredFireSlimeCure = continuesFireEffects;
    if (!continuesFireEffects)
        delete attack.fireOriginalDamage;
    attack.deferredPostHit = true;
    attack.deferredFireNegation = false;
    return action;
}
// Continue mhitm_ad_elec() after its hit message.
export function resumeDeferredHeroElectricSpecial(action, state, random = rn2) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-attack' || !attack.deferredElectricNegation)
        return action;
    const armorProtection = magicNegation(state.u, state);
    const cancelled = !!action.monster?.mcan;
    attack.electricOriginalDamage = attack.damage ?? 0;
    attack.negated = cancelled || recordRandom(random, action.calls, 10) < 3 * armorProtection;
    if (cancelled) {
        attack.damage = 0;
        attack.electricEffectMessage = null;
    }
    else if (attack.negated) {
        attack.damage = 0;
        attack.electricEffectMessage = 'You avoid harm.';
    }
    else if (state.u.shockResistance) {
        attack.damage = 0;
        attack.electricEffectMessage = 'You get zapped!';
        attack.electricResistanceMessage = "The zap doesn't shock you!";
    }
    else {
        attack.electricEffectMessage = 'You get zapped!';
    }
    attack.deferredElectricInventory = !attack.negated;
    if (attack.negated)
        delete attack.electricOriginalDamage;
    attack.deferredPostHit = true;
    attack.deferredElectricNegation = false;
    return action;
}
// C mhitm_ad_ench(): hitmsg() completes before armor selection and draining.
export async function resumeDeferredHeroEnchantment(action, state, random = rn2) {
    const attack = action.movement.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-attack' || !attack.deferredEnchantment)
        return;
    attack.deferredEnchantment = false;
    const target = selectHeroDisenchantmentTarget(state, random, action.calls);
    if (!await drainObjectEnchantment(target, { state,
        random: range => recordRandom(random, action.calls, range),
    }) || !target)
        return;
    attack.drainedObject = target;
    attack.drainMessage = `${ownedObjectAction(target, 'seem', state)} less effective.`;
}
// Resume mhitm_ad_drli() after hitmsg().  A selected level loss and its
// message precede shared knockback and the touch's ordinary HP damage.
export async function resumeDeferredHeroLifeDrain(action, state, random = rn2, publish = plineWithContinuation) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-attack' || !attack.deferredLifeDrainGate)
        return action;
    const selected = recordRandom(random, action.calls, 3) === 0;
    const drainResistant = heroHasDrainResistance(state);
    if (selected && !drainResistant) {
        const negated = specialAttackNegated(action.monster, state.u, {
            state, random: limit => recordRandom(random, action.calls, limit),
        });
        if (negated && !action.monster.mcan)
            await publish('You avoid harm.');
        attack.deferredLifeDrain = !negated;
    }
    attack.deferredLifeDrainGate = false;
    attack.deferredPostHit = true;
    return action;
}
// Resume mhitm_ad_stun() after hitmsg().  make_stunned() receives the full
// pre-halving damage; only the ordinary HP tail is reduced on selection.
// The caller applies make_stunned(), whose message precedes the timeout.
export function resumeDeferredHeroStun(action, random = rn2) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-attack' || !attack.deferredStunGate)
        return action;
    if (!action.monster?.mcan && recordRandom(random, action.calls, 4) === 0) {
        attack.stunIncrement = Math.max(0, attack.damage ?? 0);
        attack.damage = Math.trunc((attack.damage ?? 0) / 2);
        attack.stunSelected = true;
    }
    attack.deferredStunGate = false;
    attack.deferredPostHit = true;
    return action;
}
async function runCovetousHarassTactics(monster, state, random, calls) {
    if (monsterTeleportRestricted(monster, state) ||
        recordRandom(random, calls, monster.mflee ? 33 : 5) !== 0) {
        return null;
    }
    const relocation = await moveMonsterNextToHero(monster, state, { flags: RLOC_MSG, random });
    return relocation ? { ...relocation, deferredCovetousRelocation: true } : null;
}
async function knockHeroFromMonster(monster, attack, state, random, publish = plineWithContinuation) {
    const finishDeath = (target, options = {}) => finishEnvironmentalMonsterDeath(target, state, { ...options, publish });
    return tryKnockback(monster, state.u, attack, {
        state,
        random,
        publish,
        hit: attack.hit,
        weaponUsed: !!monsterWieldedWeapon(monster),
        finishMonsterDeath: finishDeath,
        finishLiquidDeath: (target, liquid) => finishDeath(target, {
            noCorpse: !liquid.leaveCorpse, random: liquid.random,
            sadFeeling: liquid.sadFeeling,
        }),
    });
}
// Continue an ordinary natural hit after its visible hit message has been
// accepted.  C ref: mhitu.c:hitmu() -> mhitm_knockback(), then losehp().
export async function resumeDeferredHeroContact(action, state, { random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation, die, } = {}) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-attack' || !attack.deferredPostHit)
        return action;
    const calls = action.calls;
    if (attack.damageType === AD_STON &&
        await applyMonsterStoningAttack(action.monster, { state, random, publish })) {
        await knockHeroFromMonster(action.monster, attack, state, random, publish);
        attack.deferredPostHit = false;
        return action;
    }
    if (attack.poison) {
        const poison = await poisonHeroFromMonster(action.monster, attack.attackType, {
            ...attack.poison,
            state,
            random,
            rollOne,
            rollDice,
            publish,
            ...(die ? { die } : {}),
        });
        attack.poison = null;
        if (poison.died) {
            attack.heroDied = true;
            attack.deferredPostHit = false;
            return action;
        }
    }
    if (attack.deferredColdInventory) {
        const destructionGate = recordRandom(random, calls, 20);
        const attackerLevel = action.monster?.m_lev ?? MONSTER_LEVEL[action.monster?.mnum] ?? 0;
        if (attackerLevel > destructionGate) {
            attack.deferredElementalInventory = {
                damageType: 'cold',
                sourceDamage: attack.coldOriginalDamage ?? 0,
            };
            attack.deferredColdInventory = false;
            return action;
        }
        attack.deferredColdInventory = false;
        delete attack.coldOriginalDamage;
    }
    if (attack.deferredFireInventory) {
        const destructionGate = recordRandom(random, calls, 20);
        const attackerLevel = action.monster?.m_lev ?? MONSTER_LEVEL[action.monster?.mnum] ?? 0;
        if (attackerLevel > destructionGate) {
            attack.deferredElementalInventory = {
                damageType: 'fire',
                sourceDamage: attack.fireOriginalDamage ?? 0,
            };
            attack.deferredFireInventory = false;
            return action;
        }
        attack.deferredFireInventory = false;
        delete attack.fireOriginalDamage;
    }
    if (attack.deferredElectricInventory) {
        const destructionGate = recordRandom(random, calls, 20);
        const attackerLevel = action.monster?.m_lev ?? MONSTER_LEVEL[action.monster?.mnum] ?? 0;
        if (attackerLevel > destructionGate) {
            attack.deferredElementalInventory = {
                damageType: 'electric',
                sourceDamage: attack.electricOriginalDamage ?? 0,
            };
            attack.deferredElectricInventory = false;
            return action;
        }
        attack.deferredElectricInventory = false;
        delete attack.electricOriginalDamage;
    }
    // mhitm_ad_fire() cures slime after destroying and igniting inventory,
    // including when the level check skips inventory damage altogether.
    if (attack.deferredFireSlimeCure) {
        attack.deferredFireSlimeCure = false;
        await burnAwayHeroSlime({ state, publish });
    }
    const knockback = await knockHeroFromMonster(action.monster, attack, state, random, publish);
    if (knockback.defenderLeftLevel)
        attack.attackerDone = true;
    if (knockback.defenderDied) {
        attack.heroDied = true;
        attack.deferredPostHit = false;
        return action;
    }
    if (attack.contactDone) {
        attack.nativeResult ??= M_ATTK_HIT;
        attack.deferredPostHit = false;
        return action;
    }
    attack.appliedDamage = reduceHeroContactDamage(action.monster, attack.damage ?? 0, state, rollOne, calls);
    if (attack.permanentDamage && attack.appliedDamage > 0) {
        const damage = attack.appliedDamage;
        let drain = recordRandom(random, calls, Math.trunc(damage / 2) + 1);
        const hero = state.u;
        const polymorphed = Upolyd(hero);
        if (polymorphed || hero.uhpmax > 25 * hero.ulevel)
            drain = damage;
        else if (hero.uhpmax > 10 * hero.ulevel)
            drain += Math.trunc(damage / 2);
        else if (hero.uhpmax > 5 * hero.ulevel)
            drain += Math.trunc(damage / 4);
        const maximum = polymorphed ? 'mhmax' : 'uhpmax';
        const lowerLimit = polymorphed
            ? Math.min(MONSTER_LEVEL[hero.umonnum] ?? 0, hero.ulevel) : Math.max(hero.ulevel, 1);
        if (hero[maximum] > lowerLimit)
            hero[maximum] = Math.max(lowerLimit, hero[maximum] - drain);
        state.context.botl = true;
    }
    attack.passive = await finishHeroContactDamage(action.monster, attack.appliedDamage, attack.attackType, attack.oldFormMnum ?? state.u.umonnum, state, { random, rollDice, publish, ...(die ? { die } : {}) });
    if (attack.passive.heroDied)
        attack.heroDied = true;
    attack.deferredPostHit = false;
    return action;
}
export function resumeDeferredHeroSticking(action, state) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-attack' || !attack.deferredStickingAfterHit)
        return action;
    if (!attack.negated && !state.u?.ustuck && !heroFormSticks(state)) {
        setHeroGrip(action.monster, state);
        attack.stuckHero = true;
        if (action.monster?.mnum === 293)
            attack.stickingMessage = 'The barbs stick to you!';
    }
    attack.deferredStickingAfterHit = false;
    attack.deferredPostHit = true;
    return action;
}
// Resume hitmu() after its concealed-attacker line has crossed tty.  The
// mattacku() to-hit die belongs before that line; base damage and every later
// contact effect belong after it.
export async function resumeDeferredHeroReveal(action, state, random = rn2, rollDice = d, rollOne = rnd) {
    const sequence = action.movement?.heroAttackSequence;
    if (!sequence)
        return null;
    const attack = sequence.current;
    if (attack?.kind !== 'hero-attack')
        return null;
    if (!attack.deferredRevealUnder)
        return attack;
    const resumed = await beginHeroAttackSlot(sequence, attack, state, random, rollOne, rollDice, action.calls, { roll: attack.roll ?? null, hit: attack.hit }, true);
    delete attack.deferredRevealUnder;
    if (resumed?.kind !== 'hero-attack')
        throw new Error('A revealed contact attack must resume the same attack slot');
    const resumedContact = { ...attack, ...resumed };
    sequence.current = resumedContact;
    return resumedContact;
}
// Resume mhitm_ad_legs() after the xan's special contact line has crossed
// tty.  set_wounded_legs() owns the duration and one-time Dexterity penalty;
// its two exercise() calls precede hitmu()'s shared knockback/damage tail.
export async function resumeDeferredHeroLegs(action, state, { publish } = {}) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-attack' || !attack.deferredLegEffect)
        return action;
    if (!attack.legSide)
        throw new Error('A deferred leg wound needs the selected leg');
    const durationSides = 60 - currentAttribute(A_DEX, state);
    const duration = rnd(durationSides);
    action.calls.push(`rnd(${durationSides})`);
    await woundHeroLegs(attack.legSide, duration, state, publish ? { publish } : {});
    await exerciseAttribute(A_STR, false, state);
    await exerciseAttribute(A_DEX, false, state);
    attack.deferredLegEffect = false;
    attack.deferredPostHit = true;
    return action;
}
// Resume mhitm_ad_blnd() after its special contact line has crossed tty.
// make_blinded() precedes hitmu()'s shared knockback probes and contributes no
// HP damage; keeping those phases together preserves the next attack/actor
// boundary when the blindness line itself requires acknowledgement.
export async function resumeDeferredHeroBlindness(action, state, random = rn2) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-attack' || !attack.deferredBlindEffect)
        return;
    if (attack.blindApplicable) {
        const oldTurns = state?.u?.blindTurns ?? 0;
        // uhitm.c:mhitm_ad_blnd() passes the full declared damage to
        // make_blinded(), which adds it to the current timeout even when the
        // hero is already blind.  The one-turn repeated-blindness behavior in
        // mhitu.c belongs to engulfing attacks, not ordinary raven contact.
        const increment = attack.blindIncrement ?? 0;
        await makeBlinded(oldTurns + increment, { state, talk: false });
    }
    recordRandom(random, action.calls, 3);
    recordRandom(random, action.calls, 6);
    attack.deferredBlindEffect = false;
    attack.blindResolved = true;
}
export async function completeHeroAttackSlot(action, state, random = rn2, rollDice = d, rollOne = rnd) {
    const sequence = action.movement?.heroAttackSequence;
    if (!sequence)
        return null;
    const attack = sequence.current;
    if (!attack)
        return null;
    let result = attack.nativeResult;
    if (result === undefined) {
        result =
            attack.hit || (attack.kind === 'hero-spell' && attack.cast) ? M_ATTK_HIT : M_ATTK_MISS;
        if (action.monster.dead || action.monster.mhp <= 0)
            result |= M_ATTK_AGR_DIED;
        if ((attack.kind === 'hero-attack' && attack.passive?.attackerStopped) ||
            attack.attackerDone)
            result |= M_ATTK_AGR_DONE;
    }
    sequence.results[attack.attackIndex] = result;
    // C mattacku() commits pending status before the next attack slot.
    if (state === game && state.context.botl)
        await bot();
    if (attack.kind === 'hero-attack' && attack.skipBrainDrain)
        sequence.skipBrainDrain = true;
    if (result === M_ATTK_HIT &&
        state.u.usleep &&
        state.u.usleep < state.moves &&
        recordRandom(random, action.calls, 10) === 0) {
        setMulti(-1, state);
        state._helplessDoneMessage = 'The combat suddenly awakens you.';
    }
    sequence.current = null;
    if (state.program_state.gameover ||
        action.monster.dead ||
        action.monster.mhp <= 0 ||
        result & (M_ATTK_AGR_DIED | M_ATTK_AGR_DONE)) {
        sequence.done = true;
        return null;
    }
    const previousDeferral = state._deferVisibleMonsterContact;
    state._deferVisibleMonsterContact = true;
    try {
        return await advanceHeroAttackSequence(sequence, state, random, rollOne, rollDice, action.calls);
    }
    finally {
        state._deferVisibleMonsterContact = previousDeferral;
    }
}
async function maybeSpinMonsterWeb(monster, movement, state, random, rollDice, calls) {
    if (![94, 96].includes(monster?.mnum) ||
        monster.mcanmove === 0 ||
        monster.msleeping ||
        monster.mspec_used ||
        trapAt(state, monster.mx, monster.my))
        return null;
    if (state.level.flags.sokoban_rules) {
        let stairs = state.stairs;
        while (stairs && !stairs.up)
            stairs = stairs.next;
        if (!stairs || !clearPath(monster.mx, monster.my, stairs.sx, stairs.sy))
            return null;
    }
    // count_webbing_walls() deliberately checks only the four cardinal
    // anchors.  Diagonal rock can visually surround a spider without being
    // able to hold a web, and must not inflate the creation probability.
    const webbingAnchors = [
        [monster.mx, monster.my - 1],
        [monster.mx + 1, monster.my],
        [monster.mx, monster.my + 1],
        [monster.mx - 1, monster.my],
    ];
    const webbingWalls = webbingAnchors.reduce((count, [x, y]) => count + Number(holdsUpMonsterWeb(x, y, state)), 0);
    const existingWebs = (state?.level?.traps || []).filter((trap) => trap.ttyp === WEB).length;
    const probability = (monster.mnum === 96 ? 15 : 5) * (webbingWalls + 1) - 3 * existingWebs;
    const roll = recordRandom(random, calls, 1000);
    if (roll >= probability)
        return { roll, probability, created: false };
    const trap = await maketrap(monster.mx, monster.my, WEB);
    if (!trap)
        return { roll, probability, created: false };
    monster.mspec_used = rollDice(4, 4);
    calls.push('d(4,4)');
    if (cansee(monster.mx, monster.my)) {
        const name = canSpotMonster(monster)
            ? canonicalMonsterName(monster, { state, article: 'your', capitalized: true })
            : 'Something';
        await plineWithContinuation(`${name} spins a web.`);
        trap.tseen = true;
    }
    if (roomsAt(state.level, monster.mx, monster.my, SHOPBASE).length)
        addShopDamage(monster.mx, monster.my, 0, state);
    return { roll, probability, created: true, trap };
}
// C monmove.c:holds_up_web().
function holdsUpMonsterWeb(x, y, state) {
    const location = state.level.at(x, y);
    if (x < 1 || !location || IS_OBSTRUCTED(location.typ) || location.typ === IRONBARS)
        return true;
    if (location.typ !== STAIRS && location.typ !== LADDER)
        return false;
    for (let stairs = state.stairs; stairs; stairs = stairs.next)
        if (stairs.sx === x && stairs.sy === y)
            return stairs.up;
    return false;
}
async function postMoveHideUnder(monster, movement, state, random, calls) {
    const originalSpecies = requireMovementCapabilities(movement).species;
    const hidesUnder = !!((MONSTER_FLAGS1[originalSpecies] ?? 0) & M1_CONCEAL);
    const eel = MONSTER_SYMBOL[originalSpecies] === S_EEL;
    if (!hidesUnder && !eel)
        return;
    const helpless = !monster.mcanmove || monster.msleeping || (monster.mfrozen ?? 0) > 0;
    if (monster.mundetected || (!helpless && recordRandom(random, calls, 5) !== 0)) {
        const concealment = beginMonsterHideUnder(monster, state);
        if (concealment.message) {
            movement.hideUnder = concealment;
            movement.deferredAfterHideUnder = true;
            return;
        }
        if (concealment.undetected !== concealment.oldUndetected)
            await newsym(monster.mx, monster.my);
    }
    // postmov() redraws even when hideunder() leaves concealment unchanged
    // or the monster skips the attempt. Hallucinations need that refresh.
    await newsym(monster.mx, monster.my);
}
export async function finishDochugAfterMovement(monster, movement, state, random, rollOne, rollDice, calls, dochugContext) {
    // A direct m_move() caller has no dochug() phase to resume.
    if (!dochugContext)
        return;
    if (monster.dead ||
        monster.mhp <= 0 ||
        (monster.mstate ?? MON_FLOOR) !== MON_FLOOR ||
        movement.postMoveStatus === MMOVE_DIED)
        return;
    const range = await checkMonsterHeroRange(monster, { state, random, rollOne });
    dochugContext.range = range;
    if (range.heroDied) {
        movement.heroDied = true;
        return;
    }
    if (heroIsHallucinating(state) && (movement.postMoveStatus === MMOVE_NOTHING
        || movement.postMoveStatus === MMOVE_DONE || movement.postMoveStatus === MMOVE_NOMOVES))
        await newsym(monster.mx, monster.my);
    if (movement.postMoveStatus === MMOVE_MOVED) {
        const dx = Math.abs(monster.mx - state.u.ux);
        const dy = Math.abs(monster.my - state.u.uy);
        const nextToHero = dx <= 1 && dy <= 1 && !(monster.mnum === PM_GRID_BUG && dx && dy);
        if (state.u.ustuck === monster && !nextToHero)
            await releaseHeroFromMonster(monster, { state, rollOne });
        const flags = MONSTER_FLAGS1[dochugContext.entryMnum] ?? 0;
        if (!monsterFliesOrFloats({ mnum: dochugContext.entryMnum })
            && (!(flags & M1_CLING) || !levelHasCeiling(state)))
            disturbBuriedZombies(monster.mx, monster.my, state);
        if (monsterIsHelpless(monster))
            return;
        const canContinue = !range.nearby &&
            (monsterHasAvailableDistanceAttack(monster, limit => recordRandom(random, calls, limit)) ||
                speciesHasWeaponAttack(dochugContext.entryMnum) ||
                selectMonsterOffensiveItem(monster, state, {
                    random: limit => recordRandom(random, calls, limit),
                }));
        if (!canContinue) {
            // An engulfing monster may digest the hero after moving even
            // though an ordinary adjacent monster must wait another turn.
            if (state.u.uswallow && state.u.ustuck === monster) {
                const attack = await beginMonsterHeroAttack(monster, state, random, rollOne, rollDice, calls);
                attachMonsterAttack(movement, attack);
            }
            return;
        }
    }
    await beginStandardMonsterAttack(monster, movement, state, random, rollOne, rollDice, calls, dochugContext);
}
// C dochug() phase four. The entry form and last distfleeck() result survive
// movement, polymorph, expulsion, and input pauses; attitude is checked now.
async function beginStandardMonsterAttack(monster, movement, state, random, rollOne, rollDice, calls, dochugContext) {
    dochugContext.reachesFinalActions = true;
    if (movement.postMoveStatus === MMOVE_DONE)
        return;
    if (monster.mpeaceful &&
        (!heroHasConflict(state) || resistConflict(monster, state, rollOne, calls)))
        return;
    // wormhitu() follows the head's complete attack, even if range or fear
    // prevents that attack. Presentation must settle each passive first.
    movement.deferredWormTailAttacks = true;
    const { entryMnum, range } = dochugContext;
    if (!range)
        throw new Error('A monster attack needs its checked hero range');
    const panicAttack = movement.postMoveStatus === MMOVE_NOMOVES && range.scared;
    const hasAttacks = (MONSTER_ATTACKS[entryMnum] || []).some(([type]) => type !== 0 && type !== AT_BOOM);
    if (!((range.inRange && !range.scared) || panicAttack) ||
        !hasAttacks ||
        (Upolyd(state.u) ? state.u.mh : state.u.uhp) <= 0)
        return;
    // mattacku() interrupts the hero before refusing a monster other than
    // the engulfer.
    const attack = await beginMonsterHeroAttack(monster, state, random, rollOne, rollDice, calls);
    attachMonsterAttack(movement, attack);
    if (attack.heroAttackSequence?.offensive)
        movement.actionCompleted = true;
}
function attachMonsterAttack(movement, attack) {
    if (attack.heroAttackSequence !== undefined)
        movement.heroAttackSequence = attack.heroAttackSequence;
    if (attack.heroAttackResult !== undefined)
        movement.heroAttackResult = attack.heroAttackResult;
}
// C postmov() has separate gates for movement effects and the floor tail.
// Whether the coordinates changed does not select either gate.
function movementHasEnded(movement) {
    return !!(movement.actorLeftLevel ||
        movement.actorDied ||
        movement.postMoveStatus === MMOVE_DIED);
}
export async function completeMovedMonsterAction(monster, movement, state, random, rollDice, rollOne, calls, dochugContext, { trapAlreadyHandled = false } = {}) {
    if (movement.deferredAfterPetAttack ||
        movement.deferredPetEating ||
        movement.deferredPetMove ||
        movement.deferredPetReluctance ||
        movement.deferredAfterSpecialAttack)
        return movement;
    if (monster.dead ||
        monster.mhp <= 0 ||
        movement.actorLeftLevel ||
        movement.actorDied ||
        movement.postMoveStatus === MMOVE_DIED ||
        state.program_state.gameover)
        return movement;
    if (movement.movementStage !== 'postmov') {
        await finishDochugAfterMovement(monster, movement, state, random, rollOne, rollDice, calls, dochugContext);
        return movement;
    }
    // C postmov() notices the monster before a door shift, trap, or floor
    // effect can change its form or kill it. Resumed traps re-enter here.
    if (!movement.postMoveNoticed) {
        // Cache canseeit before the notice's message can flush vision.
        movement.postMoveWasVisible = cansee(monster.mx, monster.my);
        movement.postMoveNoticed = true;
        await noticeMonster(monster, state);
    }
    if (movement.postMoveStatus === MMOVE_MOVED) {
        if (!trapAlreadyHandled) {
            const capabilities = requireMovementCapabilities(movement);
            const shift = await shiftMonsterForDoor(monster, state, {
                previousPosition: { x: movement.oldx, y: movement.oldy },
                wasSeen: capabilities.wasSeen, wasSpotted: capabilities.wasSpotted,
            });
            if (shift.died || shift.heroDied) {
                movement.actorDied = shift.died;
                movement.heroDied = shift.heroDied;
                movement.postMoveStatus = MMOVE_DIED;
                movement.actionCompleted = true;
                return movement;
            }
            if (state === game)
                await newsym(movement.oldx, movement.oldy);
            movement.postMoveOldSquarePainted = true;
            await triggerMonsterTrap(monster, state, movement, random, rollDice, rollOne, calls);
        }
        if (movement.deferredAfterMonsterTrap)
            return movement;
        if (movementHasEnded(movement) || state.program_state.gameover)
            return movement;
        if (!trapAlreadyHandled)
            requireMovementCapabilities(movement).species = monster.mnum;
        const capabilities = requireMovementCapabilities(movement);
        if (movement.postMoveWasVisible === undefined)
            throw new Error('Door handling requires the pre-trap destination visibility');
        const passage = await resolveMonsterDoorPassage(monster, state, {
            canOpen: capabilities.canOpen, canUnlock: capabilities.canUnlock,
            canTunnel: capabilities.canTunnel, wasDoorVisible: movement.postMoveWasVisible,
            random: range => recordRandom(random, calls, range),
            rollOne: sides => { calls.push(`rnd(${sides})`); return rollOne(sides); },
        });
        if (passage.status !== 'continue' || passage.heroDied) {
            movement.actorDied = passage.status === 'died';
            movement.heroDied = passage.heroDied;
            movement.postMoveStatus = passage.status === 'died' || passage.heroDied
                ? MMOVE_DIED : MMOVE_DONE;
            movement.actionCompleted = true;
            // postmov() returns here after dissolving bars or a fatal door
            // trap. The passage handled display; the presenter must not
            // add the destination redraw that this return skips in C.
            movement.postMoveDestinationPainted = true;
            await finishDochugAfterMovement(monster, movement, state, random, rollOne, rollDice, calls, dochugContext);
            return movement;
        }
        if (requireMovementCapabilities(movement).canTunnel
            && monsterMayDigLocation(state.level.at(monster.mx, monster.my))) {
            const tunnel = await digMonsterTunnel(monster, state, {
                random: range => recordRandom(random, calls, range),
                rollOne: sides => { calls.push(`rnd(${sides})`); return rollOne(sides); },
            });
            if (tunnel.died || tunnel.heroDied) {
                movement.actorDied = tunnel.died;
                movement.heroDied = tunnel.heroDied;
                movement.postMoveStatus = MMOVE_DIED;
                movement.actionCompleted = true;
                return movement;
            }
        }
        if (state.u.uswallow && state.u.ustuck === monster
            && (monster.mx !== movement.oldx || monster.my !== movement.oldy)) {
            state.u.ux0 = state.u.ux;
            state.u.uy0 = state.u.uy;
            await placeHeroOnLevel(monster.mx, monster.my, state);
            if (state === game)
                await swallowed(false);
        }
        else if (state === game) {
            const { mx, my } = monster;
            if (!state.in_mklev && !state.program_state.saving && !isok(mx, my)) {
                // C newsym() diagnoses column zero even when a live guard
                // is legitimately parked there until its corridor clears.
                const reason = `newsym: attempting screen update for <${mx},${my}>`;
                if (mx < 0 || my < 0 || mx >= COLNO || my >= ROWNO)
                    await panic(reason, { state });
                await impossible(reason, { state });
            }
            else
                await newsym(mx, my);
        }
        movement.postMoveDestinationPainted = true;
    }
    if (movement.postMoveStatus === MMOVE_MOVED || movement.postMoveStatus === MMOVE_DONE) {
        if (monster.mcanmove && state.level.objects[monster.mx]?.[monster.my]?.length) {
            const meal = await consumeMonsterFloorObjects(monster, state, {
                originalSpecies: requireMovementCapabilities(movement).species,
                random, rollOne, rollDice,
            });
            if (meal.died || meal.leftLevel || meal.heroDied) {
                movement.actorDied = meal.died;
                movement.actorLeftLevel = meal.leftLevel;
                movement.heroDied = meal.heroDied;
                movement.postMoveStatus = meal.nativeResult;
                movement.actionCompleted = true;
                return movement;
            }
            if (await pickUpMonsterFloorObject(monster, state, random))
                movement.postMoveStatus = MMOVE_DONE;
            if (state.program_state.gameover) {
                movement.heroDied = true;
                return movement;
            }
            if (monster.minvis) {
                await newsym(monster.mx, monster.my);
                if (monster.wormno)
                    await redrawMonsterWormSegments(monster);
            }
        }
        await finishMonsterFloorTail(monster, movement, state, random, rollDice, rollOne, calls, dochugContext);
    }
    else {
        await finishDochugAfterMovement(monster, movement, state, random, rollOne, rollDice, calls, dochugContext);
    }
    return movement;
}
async function finishMonsterFloorTail(monster, movement, state, random, rollDice, rollOne, calls, dochugContext) {
    await maybeSpinMonsterWeb(monster, movement, state, random, rollDice, calls);
    await postMoveHideUnder(monster, movement, state, random, calls);
    if (movement.deferredAfterHideUnder)
        return;
    if (monster.isshk) {
        if (!hasShopkeeperData(monster))
            throw new Error('A shopkeeper must retain its shop state');
        await afterShopkeeperMove(monster, state);
    }
    await finishDochugAfterMovement(monster, movement, state, random, rollOne, rollDice, calls, dochugContext);
}
// Native m_move(monster, 0), before any deferred movement presentation.
// A direct caller owns no dochug prelude or post-move attack continuation.
export async function beginMonsterMove(monster, state = requireInitializedGame(), random = rn2, rollDice = d, rollOne = rnd) {
    const calls = DISCARDED_CALL_LOG;
    if (monster.mtrapped) {
        return {
            monster, calls,
            movement: {
                oldx: monster.mx, oldy: monster.my,
                x: monster.mx, y: monster.my, moved: false,
                escapingTrap: true,
            },
        };
    }
    const turn = await moveMonsterAfterTrap(monster, state, random, rollDice, rollOne, calls, undefined, null);
    return { monster, ...turn };
}
// First non-combat slice of monmove.c:dochug(), m_move(), and dog_move().
// distfleeck() always draws the brave-gremlin roll; ordinary starting actors
// then choose and own a live adjacent destination before the post-move draw.
export async function takeMonsterTurn(monster, state, random = rn2, rollDice = d, rollOne = rnd, options = {}) {
    const calls = DISCARDED_CALL_LOG;
    const dochugContext = options.dochugContext ?? {
        entryMnum: monster.mnum,
        range: null,
        reachesFinalActions: false,
    };
    if (!options.afterCovetousRelocation) {
        // monmove.c:dochug() erodes text beneath every awake, mobile actor
        // before confusion/fleeing checks and the first set_apparxy().
        wipeEngravingAt(monster.mx, monster.my, 1, false, state?.level);
        // Status recovery and fleeing checks happen before movement. Do not
        // repeat them when a message pauses a later covetous relocation.
        if (monster.mconf && recordRandom(random, calls, 50) === 0)
            monster.mconf = 0;
        if (monster.mstun && recordRandom(random, calls, 10) === 0)
            monster.mstun = 0;
        if (monster.mflee) {
            const teleports = recordRandom(random, calls, 40) === 0 &&
                !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_TPORT) &&
                !monster.iswiz &&
                !monsterTeleportRestricted(monster, state);
            if (teleports) {
                const relocation = await randomMonsterRelocation(monster, {
                    state,
                    calls,
                    random,
                    rollOne,
                    flags: RLOC_MSG,
                });
                if (relocation)
                    await stashLeprechaunGold(monster, state, limit => recordRandom(random, calls, limit));
                return {
                    calls,
                    dochugContext,
                    movement: relocation
                        ? {
                            ...relocation,
                            fleeingRelocation: true,
                        }
                        : {
                            oldx: monster.mx,
                            oldy: monster.my,
                            x: monster.mx,
                            y: monster.my,
                            moved: false,
                            fleeingTeleportFailed: true,
                        },
                };
            }
        }
        const response = await respondToImmediateMagic(monster, state, { random, rollDice, rollOne, calls });
        if (response?.heroDied || monster.dead || monster.mhp <= 0) {
            return {
                calls,
                dochugContext,
                movement: {
                    oldx: monster.mx,
                    oldy: monster.my,
                    x: monster.mx,
                    y: monster.my,
                    moved: false,
                    actorDied: !!monster.dead || monster.mhp <= 0,
                    heroDied: !!response?.heroDied,
                    postMoveStatus: MMOVE_DIED,
                },
            };
        }
        if (monster.mflee &&
            !(monster.mfleetim ?? 0) &&
            (monster.mhp ?? 0) === (monster.mhpmax ?? 0) &&
            recordRandom(random, calls, 25) === 0) {
            monster.mflee = 0;
        }
        if (state.u.ustuck === monster && monster.mpeaceful && !monster.mconf
            && !heroHasConflict(state)) {
            const heroDied = await releaseMonsterHold(monster, { state, random, rollOne });
            return {
                calls, dochugContext,
                movement: {
                    oldx: monster.mx, oldy: monster.my, x: monster.mx, y: monster.my,
                    moved: false, actionCompleted: true, heroDied,
                },
            };
        }
    }
    if (!options.afterCovetousRelocation) {
        setMonsterApparentHeroPosition(monster, state, random, calls);
        let tacticsMovement = null;
        if (monsterIsCovetous(monster)) {
            const strategy = chooseCovetousStrategy(monster, state);
            if (strategy.kind === 'heal') {
                const retreat = await retreatCovetousMonster(monster, state, random, rollOne);
                if (retreat === 'harass')
                    tacticsMovement = await runCovetousHarassTactics(monster, state, random, calls);
            }
            else if (strategy.kind === 'target') {
                const result = await pursueCovetousTarget(monster, strategy.target, state);
                if (result === 'blocked-ground' && recordRandom(random, calls, 5) === 0
                    && !monsterTeleportRestricted(monster, state)) {
                    const relocation = await moveMonsterNextToHero(monster, state, { flags: RLOC_MSG, random });
                    if (relocation)
                        tacticsMovement = { ...relocation, deferredCovetousRelocation: true };
                }
            }
            else {
                tacticsMovement = await runCovetousHarassTactics(monster, state, random, calls);
            }
        }
        if (state.program_state.gameover) {
            return {
                calls, dochugContext,
                movement: {
                    oldx: monster.mx, oldy: monster.my, x: monster.mx, y: monster.my,
                    moved: false, heroDied: true,
                },
            };
        }
        if (monsterIsCovetous(monster) && (monster.mstate ?? MON_FLOOR) !== MON_FLOOR)
            return {
                calls, dochugContext,
                movement: {
                    oldx: monster.mx, oldy: monster.my, x: monster.mx, y: monster.my,
                    moved: false, actorLeftLevel: true,
                },
            };
        if (tacticsMovement)
            return { calls, dochugContext, movement: tacticsMovement };
    }
    // dochug() refreshes perception after tactics, including when relocation
    // feedback pauses the turn before it checks distance and attacks.
    if (monsterIsCovetous(monster))
        setMonsterApparentHeroPosition(monster, state, random, calls);
    let range = await checkMonsterHeroRange(monster, { state, random, rollOne });
    dochugContext.range = range;
    if (range.heroDied)
        return {
            calls,
            dochugContext,
            movement: {
                oldx: monster.mx,
                oldy: monster.my,
                x: monster.mx,
                y: monster.my,
                moved: false,
                heroDied: true,
            },
        };
    const defense = findMonsterDefensiveItem(monster, state, { random });
    if (defense) {
        const result = await useMonsterDefensiveItem(monster, defense, { state, random, rollDice, rollOne });
        if (result.nativeResult)
            return {
                calls, dochugContext,
                movement: {
                    oldx: monster.mx, oldy: monster.my, x: monster.mx, y: monster.my,
                    moved: false,
                    actionCompleted: true,
                    usedDefense: result,
                    heroDied: result.heroDied,
                    actorLeftLevel: !monsterHasMapPosition(monster, state),
                    actorDied: monster.dead || monster.mhp <= 0,
                },
            };
    }
    const miscItem = defense ? null : await useMonsterMiscItem(monster, state, random, calls);
    if (miscItem && !(miscItem.kind === 'item-result' && !miscItem.nativeResult)) {
        return {
            calls,
            dochugContext,
            movement: {
                oldx: monster.mx,
                oldy: monster.my,
                x: monster.mx,
                y: monster.my,
                moved: false,
                usedMisc: miscItem,
            },
        };
    }
    if (range.nearby && MONSTER_SOUND[dochugContext.entryMnum] === 33
        && monster.mpeaceful && !monster.mtame && !state.u.uswallow
        && await talkToDemon(monster, state, limit => recordRandom(random, calls, limit), sides => { calls.push(`rnd(${sides})`); return rollOne(sides); })) {
        return { calls, dochugContext, movement: {
                oldx: monster.mx, oldy: monster.my, x: monster.mx, y: monster.my,
                moved: false, actionCompleted: true, postMoveStatus: MMOVE_DONE,
                actorLeftLevel: !monsterHasMapPosition(monster, state),
            } };
    }
    await watchOnDuty(monster, state, random, calls);
    if (monsterIsMindFlayer(dochugContext.entryMnum) && recordRandom(random, calls, 20) === 0) {
        const heroDied = await useMonsterMindBlast(monster, state, {
            random: limit => recordRandom(random, calls, limit),
            rollOne: sides => {
                calls.push(`rnd(${sides})`);
                return rollOne(sides);
            },
            resistsConflict: () => resistConflict(monster, state, rollOne, calls),
        });
        if (heroDied)
            return {
                calls, dochugContext,
                movement: {
                    oldx: monster.mx, oldy: monster.my, x: monster.mx, y: monster.my,
                    moved: false, heroDied: true,
                },
            };
        setMonsterApparentHeroPosition(monster, state, random, calls);
        range = await checkMonsterHeroRange(monster, { state, random, rollOne });
        dochugContext.range = range;
    }
    if (await readyCloseMonsterWeapon(monster, state, range)) {
        return {
            calls,
            dochugContext,
            movement: {
                oldx: monster.mx,
                oldy: monster.my,
                x: monster.mx,
                y: monster.my,
                moved: false,
                actionCompleted: true,
            },
        };
    }
    const entryMnum = dochugContext.entryMnum;
    // dochug() gives royal jelly priority over movement and attacks.
    const royalJelly = entryMnum === MONSTER_NAME.indexOf('killer bee')
        ? state.level.objects[monster.mx]?.[monster.my]?.find(object => object.otyp === LUMP_OF_ROYAL_JELLY)
        : null;
    if (royalJelly && await feedBeeRoyalJelly(monster, royalJelly, state)) {
        return {
            calls, dochugContext,
            movement: {
                oldx: monster.mx, oldy: monster.my, x: monster.mx, y: monster.my,
                moved: false, actionCompleted: true,
                actorDied: !!monster.dead || monster.mhp <= 0,
                heroDied: !!state.program_state.gameover,
            },
        };
    }
    if (entryMnum === MONSTER_NAME.indexOf('gelatinous cube')
        && await digestGelatinousCubeInventory(monster, state, { random, rollOne, rollDice })) {
        return {
            calls, dochugContext,
            movement: {
                oldx: monster.mx, oldy: monster.my, x: monster.mx, y: monster.my,
                moved: false, actionCompleted: true, digestedInventory: true,
                postMoveStatus: MMOVE_NOTHING,
                actorDied: !!monster.dead || monster.mhp <= 0,
                heroDied: !!state.program_state.gameover,
            },
        };
    }
    const entersMovement = !range.nearby ||
        monster.mflee ||
        range.scared ||
        monster.mconf ||
        monster.mstun ||
        (monster.minvis && recordRandom(random, calls, 3) === 0) ||
        (MONSTER_SYMBOL[entryMnum] === S_LEPRECHAUN &&
            !(state.inventory || []).some((object) => object.otyp === GOLD_PIECE) &&
            ((monster.minvent || monster.inventory || []).some((object) => object.otyp === GOLD_PIECE) ||
                recordRandom(random, calls, 2) !== 0)) ||
        ((MONSTER_FLAGS2[entryMnum] ?? 0) & M2_WANDER && recordRandom(random, calls, 4) === 0) ||
        (heroHasConflict(state) && !monster.iswiz) ||
        (monster.mcansee === 0 && recordRandom(random, calls, 4) === 0) ||
        monster.mpeaceful;
    if (!entersMovement) {
        const movement = {
            oldx: monster.mx,
            oldy: monster.my,
            x: monster.mx,
            y: monster.my,
            moved: false,
            postMoveStatus: MMOVE_NOTHING,
        };
        await beginStandardMonsterAttack(monster, movement, state, random, rollOne, rollDice, calls, dochugContext);
        return { calls, movement, dochugContext };
    }
    // Peaceful actors always enter dochug()'s movement branch.  Before
    // m_move(), every clerical/wizard magic attack gets one opportunity to
    // choose an undirected spell. A rejected or failed spell leaves the
    // actor free to move; a successful spell spends the movement action.
    const movementSpell = await movementSpellSelections(monster, state, random, calls);
    const movement = movementSpell?.cast
        ? {
            oldx: monster.mx,
            oldy: monster.my,
            x: monster.mx,
            y: monster.my,
            moved: false,
            spellCast: movementSpell,
            deferredAfterMovementSpell: true,
        }
        : null;
    if (!movement && monster.mtrapped) {
        return {
            calls,
            dochugContext,
            movement: {
                oldx: monster.mx,
                oldy: monster.my,
                x: monster.mx,
                y: monster.my,
                moved: false,
                escapingTrap: true,
            },
        };
    }
    const moved = await moveMonsterAfterTrap(monster, state, random, rollDice, rollOne, calls, dochugContext, movement);
    return { ...moved, dochugContext };
}
export async function moveMonsterAfterTrap(monster, state, random, rollDice, rollOne, calls, dochugContext, movement) {
    if (!movement && monster.meating !== undefined && monster.meating > 0) {
        if (--monster.meating === 0)
            await finishMonsterEating(monster, state);
        movement = {
            oldx: monster.mx,
            oldy: monster.my,
            x: monster.mx,
            y: monster.my,
            moved: false,
            eating: true,
            postMoveStatus: MMOVE_DONE,
            movementStage: 'dochug',
            actionCompleted: true,
        };
    }
    // monmove.c:m_move() lets a conceal-capable actor retain a valid
    // floor-object hiding place before visibility setup or destination
    // selection.  MMOVE_NOTHING still returns to dochug(), which performs
    // its trailing distfleeck() and may subsequently attack.
    if (!movement &&
        (MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_CONCEAL &&
        canMonsterHideUnderObjectAt(state, monster.mx, monster.my) &&
        recordRandom(random, calls, 10) !== 0) {
        movement = {
            oldx: monster.mx,
            oldy: monster.my,
            x: monster.mx,
            y: monster.my,
            moved: false,
            retainedHidingPlace: true,
            postMoveStatus: MMOVE_NOTHING,
            movementStage: 'dochug',
        };
    }
    if (!movement) {
        const formFlags = MONSTER_FLAGS1[monster.mnum] ?? 0;
        const postMoveCapabilities = {
            species: monster.mnum,
            canOpen: monsterCanOpenDoor(monster),
            canUnlock: monsterCanUnlockDoor(monster),
            canTunnel: !!(formFlags & M1_TUNNEL) && !Is_rogue_level(state.u.uz, state),
            wasSeen: canSeeMonster(monster),
            wasSpotted: canSpotMonster(monster),
        };
        if (!monster.wormno && (monster.pet || monster.mtame)) {
            setMonsterApparentHeroPosition(monster, state, random, calls);
            movement = await movePet(monster, state, random, rollDice, rollOne, calls);
        }
        else {
            if (!monster.wormno && monster.isgd && monster._egd) {
                setMonsterApparentHeroPosition(monster, state, random, calls);
                movement = await moveVaultGuard(monster, state, random, calls);
            }
            if (!movement)
                movement = await moveHostile(monster, state, random, rollDice, rollOne, calls, postMoveCapabilities);
        }
        movement.postMoveCapabilities = postMoveCapabilities;
        if (movement.deferredPetMove ||
            movement.deferredPetEating ||
            movement.deferredAfterRestrictedTenguTeleport)
            return { calls, movement, ...(dochugContext ? { dochugContext } : {}) };
        await completeMovedMonsterAction(monster, movement, state, random, rollDice, rollOne, calls, dochugContext);
        return { calls, movement, ...(dochugContext ? { dochugContext } : {}) };
    }
    if (!movement.deferredAfterMovementSpell)
        await finishDochugAfterMovement(monster, movement, state, random, rollOne, rollDice, calls, dochugContext);
    return { calls, movement, ...(dochugContext ? { dochugContext } : {}) };
}
// shk_move()/pri_move() discard the first mattacku() result and return zero.
// Resume that same movement only after the complete attack has been presented.
export async function resumeDeferredSpecialAttack(action, state, random = rn2, rollDice = d, rollOne = rnd) {
    const movement = action.movement;
    if (!movement?.deferredAfterSpecialAttack)
        return action;
    delete movement.deferredAfterSpecialAttack;
    delete movement.heroAttackSequence;
    if (state.program_state.gameover)
        return action;
    const previousDeferral = state._deferVisibleMonsterContact;
    state._deferVisibleMonsterContact = true;
    try {
        await completeMovedMonsterAction(action.monster, movement, state, random, rollDice, rollOne, action.calls, action.dochugContext);
    }
    finally {
        state._deferVisibleMonsterContact = previousDeferral;
    }
    return action;
}
// Resume m_move() immediately after tele_restrict() has emitted the visible
// failed-teleport line.  The same actor still owns ordinary destination
// selection, postmov(), the second distfleeck(), and any phase-four attack.
export async function resumeDeferredRestrictedTenguTeleport(action, state, random = rn2, rollDice = d, rollOne = rnd) {
    const deferred = action?.movement;
    if (!deferred?.deferredAfterRestrictedTenguTeleport)
        return action;
    const movement = await moveHostile(action.monster, state, random, rollDice, rollOne, action.calls, requireMovementCapabilities(deferred), { afterRestrictedTenguTeleport: true });
    if (deferred.postMoveCapabilities)
        movement.postMoveCapabilities = deferred.postMoveCapabilities;
    action.movement = movement;
    await completeMovedMonsterAction(action.monster, movement, state, random, rollDice, rollOne, action.calls, action.dochugContext);
    return action;
}
// Resume dochug() after rloc_to_core() has tried to emit the covetous
// monster's arrival line.  pline() can suspend there on an older topline, so
// the second set_apparxy(), distfleeck(), and contact attack must remain
// unconsumed until the tty pager is dismissed.
export async function resumeDeferredCovetousRelocation(action, state, random = rn2, rollDice = d, rollOne = rnd) {
    if (!action?.movement?.deferredCovetousRelocation)
        return action;
    const continuation = await takeMonsterTurn(action.monster, state, random, rollDice, rollOne, {
        afterCovetousRelocation: true,
        dochugContext: requireDochugContext(action),
    });
    action.calls.push(...continuation.calls);
    action.movement = continuation.movement;
    return action;
}
export async function resumeDeferredMonsterHideUnder(action, state, random = rn2, rollOne = rnd, rollDice = d) {
    const movement = action?.movement;
    if (!movement?.deferredAfterHideUnder)
        return action;
    delete movement.deferredAfterHideUnder;
    await newsym(action.monster.mx, action.monster.my);
    if (action.monster.isshk) {
        if (!hasShopkeeperData(action.monster))
            throw new Error('A shopkeeper must retain its shop state');
        await afterShopkeeperMove(action.monster, state);
    }
    await finishDochugAfterMovement(action.monster, movement, state, random, rollOne, rollDice, action.calls, action.dochugContext);
    return action;
}
export async function resumeDeferredPetReluctance(action, state, random = rn2, rollDice = d, rollOne = rnd) {
    const movement = action.movement;
    if (!movement.deferredPetReluctance)
        return action;
    delete movement.deferredPetReluctance;
    await completeMovedMonsterAction(action.monster, movement, state, random, rollDice, rollOne, action.calls, action.dochugContext);
    return action;
}
export async function resumeDeferredPetAttack(action, state, random = rn2, rollDice = d, rollOne = rnd) {
    const movement = action.movement;
    if (!movement.deferredAfterPetAttack)
        return action;
    delete movement.deferredAfterPetAttack;
    if (action.monster.dead || action.monster.mhp <= 0) {
        movement.postMoveStatus = MMOVE_DIED;
        return action;
    }
    await completeMovedMonsterAction(action.monster, movement, state, random, rollDice, rollOne, action.calls, action.dochugContext);
    return action;
}
// Resume dog_move() after dog_invent() has committed and tty has had the
// chance to acknowledge its pickup/drop message.  C remains inside the same
// actor transaction here: dog_goal(), destination choice, postmov(), the
// second distfleeck(), and any ranged action all occur after that boundary.
export async function resumeDeferredPetMove(action, state, random = rn2, rollDice = d, rollOne = rnd) {
    if (!action?.movement?.deferredPetMove)
        return action;
    const monster = action.monster;
    const calls = action.calls;
    const movement = await movePet(monster, state, random, rollDice, rollOne, calls, true);
    if (action.movement.postMoveCapabilities)
        movement.postMoveCapabilities = action.movement.postMoveCapabilities;
    action.movement = movement;
    await completeMovedMonsterAction(monster, movement, state, random, rollDice, rollOne, calls, action.dochugContext);
    return action;
}
// Resume dog_eat() after its visible line has crossed tty.  The object is
// still on the destination square while the older topline owns --More--.
export async function resumeDeferredPetEating(action, state, random = rn2, rollDice = d, rollOne = rnd) {
    const movement = action?.movement;
    if (!movement?.deferredPetEating)
        return action;
    const monster = action.monster;
    const meal = movement.petMeal;
    if (!meal)
        throw new Error('A deferred pet meal must retain its food');
    const calls = action.calls;
    await finishPetEating(monster, meal, state, random, calls);
    delete movement.deferredPetEating;
    delete movement.petMeal;
    if (monster.dead || monster.mhp <= 0)
        movement.postMoveStatus = MMOVE_DIED;
    else if (!movement.moved && monsterHasMapPosition(monster, state)) {
        await pullLeashedPetCloser(monster, state, random, calls);
        movement.x = monster.mx;
        movement.y = monster.my;
        movement.moved = movement.x !== movement.oldx || movement.y !== movement.oldy;
    }
    await completeMovedMonsterAction(monster, movement, state, random, rollDice, rollOne, calls, action.dochugContext);
    return action;
}
export async function runMonsterAction(monster, state, random = rn2, rollDice = d, rollOne = rnd) {
    const calls = DISCARDED_CALL_LOG;
    // C mon.c:movemon_singlemon() debits movement before restrap().
    // These early returns belong only to is_hider() (M1_HIDE): a cobra
    // with M1_CONCEAL remains active after hiding beneath an object and
    // can spend another movement ration in this same movemon() pass.
    const restrapped = await attemptMonsterRestrap(monster, state, { random, calls });
    const isHider = !!((MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_HIDE);
    if (isHider &&
        (restrapped ||
            M_AP_TYPE(monster) === M_AP_FURNITURE ||
            M_AP_TYPE(monster) === M_AP_OBJECT ||
            monster.mundetected)) {
        return {
            monster,
            calls,
            movement: {
                oldx: monster.mx,
                oldy: monster.my,
                x: monster.mx,
                y: monster.my,
                moved: false,
                hidden: true,
            },
        };
    }
    // Eels get one pre-dochug opportunity to hide again.  A stranded eel
    // still owns the 1-in-4 probe, but hideunder() fails on dry terrain.
    const eel = MONSTER_SYMBOL[monster.mnum] === S_EEL;
    const nextToHero = distmin(monster.mx, monster.my, state?.u?.ux ?? monster.mx, state?.u?.uy ?? monster.my) <=
        1;
    if (eel &&
        !monster.mundetected &&
        (monster.mflee || !nextToHero) &&
        !canSeeMonster(monster) &&
        recordRandom(random, calls, 4) === 0 &&
        await hideMonsterUnder(monster, state)) {
        return {
            monster,
            calls,
            movement: {
                oldx: monster.mx,
                oldy: monster.my,
                x: monster.mx,
                y: monster.my,
                moved: false,
                hidden: true,
            },
        };
    }
    // C movemon_singlemon(): a successful fightm bypasses dochug entirely.
    // m_canseeu uses hero invisibility and underwater state, not monster eyes.
    const inSight = !state?.viz_array || !!((state.viz_array?.[monster.my]?.[monster.mx] ?? 0) & 0x2);
    const heroInvisible = heroIsInvisible(state);
    const perceivesInvisible = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS);
    if (heroHasConflict(state) &&
        !monster.iswiz &&
        (!heroInvisible || perceivesInvisible) &&
        !state.u.uinwater &&
        couldSeeFromHero(state, monster.mx, monster.my) &&
        inSight &&
        dist2(monster.mx, monster.my, state.u.ux, state.u.uy) <= BOLT_LIM * BOLT_LIM) {
        const conflictFight = await fightNearbyMonster(monster, state, random, rollDice, rollOne, calls);
        if (conflictFight?.heroDied || conflictFight?.consumed)
            return { monster, calls, conflictFight };
    }
    return beginMonsterDochug(monster, state, random, rollDice, rollOne);
}
// C monmove.c:dochug(), without movemon_singlemon()'s hiding and Conflict checks.
// Direct callers such as shop entry do not spend a scheduled movement ration.
// C monmove.c:m_arrival().
export async function beginMonsterDochug(monster, state, random = rn2, rollDice = d, rollOne = rnd) {
    const calls = DISCARDED_CALL_LOG;
    const nextToHero = distmin(monster.mx, monster.my, state.u.ux, state.u.uy) <= 1;
    // C m_arrival() always clears arrival, even for an inactive monster.
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_ARRIVE;
    // monmove.c:dochug() checks the strategy wait mask before ordinary
    // sleep disturbance.  A squeaky board wakes indeterminate sleep, but
    // wake_nearto() deliberately preserves meditation for unique
    // monsters such as the Wizard.  WAITFORU is released only once the
    // actor can see the hero or has been hurt.
    if ((monster.mstrategy ?? 0) & STRAT_WAITFORU &&
        ((monster.mhp ?? 0) < (monster.mhpmax ?? monster.mhp ?? 0) ||
            monsterHasLineOfSightToHero(monster, state))) {
        monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITFORU;
    }
    checkQuestMonsterStatus(monster, state);
    if ((monster.mstrategy ?? 0) & STRAT_WAITMASK) {
        if (heroIsHallucinating(state))
            await newsym(monster.mx, monster.my);
        if (monster.mcanmove && (monster.mstrategy ?? 0) & STRAT_CLOSE
            && !monster.msleeping && nextToHero)
            await talkQuestCharacter(monster, state);
        return {
            monster,
            calls,
            movement: {
                oldx: monster.mx,
                oldy: monster.my,
                x: monster.mx,
                y: monster.my,
                moved: false,
                waiting: true,
            },
        };
    }
    // Frozen and sleeping actors are rejected by dochug(), after the
    // shared hider, eel, and Conflict phases above.  In particular, a
    // sleeping piercer still owns restrap()'s one-in-three probe.
    if (monster.mcanmove === 0 || (monster.mfrozen ?? 0) > 0) {
        if (heroIsHallucinating(state))
            await newsym(monster.mx, monster.my);
        return {
            monster,
            calls,
            movement: {
                oldx: monster.mx,
                oldy: monster.my,
                x: monster.mx,
                y: monster.my,
                moved: false,
                immobile: true,
            },
        };
    }
    // dochug() gives a movable sleeper one source-ordered disturbance
    // attempt before returning ahead of set_apparxy()/distfleeck().
    if (monster.msleeping) {
        const woke = await disturbSleepingMonster(monster, state, random, calls);
        if (!woke) {
            if (heroIsHallucinating(state))
                await newsym(monster.mx, monster.my);
            return {
                monster,
                calls,
                movement: {
                    oldx: monster.mx,
                    oldy: monster.my,
                    x: monster.mx,
                    y: monster.my,
                    moved: false,
                    sleeping: true,
                },
            };
        }
    }
    const { calls: actionCalls, movement, dochugContext, } = await takeMonsterTurn(monster, state, random, rollDice, rollOne);
    calls.push(...actionCalls);
    return { monster, calls, movement, dochugContext };
}
//# sourceMappingURL=monmove.js.map