import { formatFeltMessage, publishHeardMessage } from './hero_speech.js';
import { objectMaterial } from './object_material.js';
import { moveMonsterNextToHero } from './teleport.js';
import { monsterFireDescription } from './monster_fire_description.js';
import { bot } from './display.js';
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
import { M_SEEN_MAGR, M_SEEN_REFL } from './const.js';
import { monstersForgetHeroResistance, seenResistanceForDamage } from './monster_perception.js';
import { watchDigging } from './digging_watch.js';
import { heroDetectsMonsters, heroIsBlind, heroIsHallucinating } from './senses.js';
import { objectDescription } from './object_description.js';
import { ownedObjectAction, observeObjectForNaming } from './objnam.js';
import { senseWithTelepathy } from './display.js';
import { heroHasHalfSpellDamage } from './spell_damage.js';
import { useMonsterMindBlast } from './monster_mind_blast.js';
import { monsterIsMindFlayer } from './monster_data.js';
import { endVoluntaryMultiTurn, heroHasInvoluntaryDelay } from './command_state.js';
import { stopRun } from './runmode.js';
import { d, rn2, rnd, rnl } from './rng.js';
import { game, requireInitializedGame, requireLiveGame } from './gstate.js';
import { performMonsterHeroAttack } from './allmain.js';
import { selectMonsterOffensiveItem } from './monster_offensive_selection.js';
import { useMonsterOffensiveItem } from './monster_offensive_item.js';
import { searchMonsterItems } from './monster_item_search.js';
import { monsterCouldReachItem } from './monster_item_reach.js';
import { isLevelPrize } from './level_prize.js';
import { consumeMonsterFloorObjects } from './monster_floor_consumption.js';
import { digestGelatinousCubeInventory, feedBeeRoyalJelly } from './monster_consumption.js';
import { pickUpMonsterFloorObject } from './monster_pickup.js';
import { digMonsterTunnel } from './monster_tunnel.js';
import { monsterMovementBaseFlags, monsterCanOpenDoor, monsterCanUnlockDoor, monsterCorrodesBars, } from './monster_movement_traits.js';
import { loseGuardianAngel } from './guardian_angel.js';
import { shiftMonsterForDoor, resolveMonsterDoorPassage } from './monster_door_passage.js';
import { heroSpecies } from './hero_species.js';
import { releaseHeroFromMonster, releaseMonsterHold } from './hero_expulsion.js';
import { checkQuestMonsterStatus, talkQuestCharacter } from './quest.js';
import { placeHeroOnLevel } from './hero_location.js';
import { swallowed } from './display.js';
import { Is_rogue_level } from './const.js';
import { hasShopkeeperData } from './shop_types.js';
import { disturbMealMimicry } from './meal_mimic.js';
import { monsterKnowsTrap, monsterLearnsTrap, monstersSeeTrap } from './trap_knowledge.js';
import { woundHeroLegs } from './hero_legs.js';
import { isAccessibleAt } from './terrain_properties.js';
import { insideWizardTower } from './dungeon.js';
import { selectPetRangedTarget } from './dogmove.js';
import { publishMonsterNoise } from './monster_sound.js';
import { monsterLinedUpWithHero } from './monster_ranged_alignment.js';
import { resolveMonsterCombatBreath } from './monster_combat_breath.js';
import { resolveMonsterCombatThrow } from './monster_combat_throw.js';
import { petDroppableObject } from './dog.js';
import { finishMonsterEating } from './monster_eating.js';
import { applyPetHunger } from './pet_hunger.js';
import { beginPetEating, finishPetEating } from './pet_eating.js';
import { DOGFOOD, CADAVER, ACCFOOD, MANFOOD, UNDEF, dogFood } from './pet_food.js';
import { releaseMonsterInventory } from './monster_drop.js';
import { tryMonsterTrapEscape } from './monster_trap_escape.js';
import { attemptMonsterRestrap, beginMonsterHideUnder, canMonsterHideUnderObjectAt, hideMonsterUnder, maybeUnhideAt, } from './monster_hiding.js';
import { finishMonsterWebTrap } from './web_trap.js';
import { resolveMonsterCombatSpit, resolveMonsterSpitAtHero, } from './monster_spit.js';
import { objectTypeName, readyRangedMonsterWeapon, throwMonsterWeaponAtHero, } from './monster_throw.js';
import { monsterWieldedWeapon, selectMonsterRangedWeapon, swingMonsterWeapon, updateMonsterWeaponAfterPolymorph, wieldMonsterWeapon, } from './monster_weapon.js';
import { attackHeroWithPolearm } from './monster_polearm.js';
import { summonMonsterAttackHelp } from './minion.js';
import { releaseMonsterLeash } from './monster_leash.js';
import { ammunitionMatchesLauncher, isPick, isPolearm, returningWeaponRangeSquared, willWeld, } from './weapon_type.js';
import { growMonster } from './monster_growth.js';
import { monsterLocomotion } from './monster_locomotion.js';
import { makePlural, verbForSubject } from './object_grammar.js';
import { drainObjectEnchantment } from './object_state.js';
import { currentAttribute, exerciseAttribute } from './attrib.js';
import { initializeMonsterMovement, mcalcmove, naturalMonsterSpeed } from './monster_speed.js';
import { heroHasDrainResistance, heroHasFreeAction, heroIsDisplaced } from './armor.js';
import { heroHasConflict } from './hero_conflict.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { checkMonsterHeroRange } from './monster_flee.js';
import { chooseCovetousStrategy, pursueCovetousTarget } from './monster_covetous_target.js';
import { retreatCovetousMonster } from './monster_covetous_retreat.js';
import { monsterName as canonicalMonsterName, monsterPossessive, monsterSpellDeathReason, possessiveName, shopkeeperName, } from './monster_name.js';
import { heroEyeCount, heroEyeName, heroHasEyes, heroHeadName, monsterHandName } from './body_parts.js';
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
import { canSeeMonster, canSpotMonster, map_invisible, newsym, plineWithContinuation, } from './display.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME, MONSTER_RESISTS, MONSTER_SIZE, MONSTER_SYMBOL, monsterIsCovetous, monsterIsNoncorporeal, monsterIsUndead, monsterIsVampireShifter, monsterIsWhirly, monsterIsShade, monsterIsUnsolid, monsterIsThickSkinned, monsterTypeName, } from './monster_data.js';
import { AD_ACID, AD_BLND, AD_CLRC, AD_COLD, AD_CURS, AD_HEAL, AD_DRIN, AD_CORR, AD_DCAY, AD_DGST, AD_DREN, AD_DETH, AD_CONF, AD_DRLI, AD_ELEC, AD_ENCH, AD_FIRE, AD_LEGS, AD_PHYS, AD_POLY, AD_TLPT, AD_DISE, AD_PEST, AD_FAMN, AD_MAGM, AD_SPC2, AD_SAMU, AD_SEDU, AD_SGLD, AD_SSEX, AD_SITM, AD_SLIM, AD_SLOW, AD_SPEL, AD_STCK, AD_STON, AD_STUN, AD_WRAP, AD_PLYS, AD_WERE, AD_RUST, AT_BOOM, AT_BREA, AT_CLAW, AT_ENGL, AT_GAZE, AT_HUGS, AT_MAGC, AT_NONE, AT_SPIT, AT_TUCH, AT_WEAP, AT_KICK, AT_BITE, AT_STNG, AT_BUTT, AT_TENT, AT_EXPL, } from './monster_attack_types.js';
import { APPLE, BANANA, BULLWHIP, BOULDER, CARROT, CLOVE_OF_GARLIC, CORPSE, DWARVISH_MATTOCK, EGG, FAKE_AMULET_OF_YENDOR, FLINT, ENORMOUS_MEATBALL, GOLD_PIECE, MEATBALL, MEAT_RING, MEAT_STICK, ARROW, AXE, BATTLE_AXE, DART, IRON_SHOES, OBJECT_BIMANUAL, OBJECT_LARGE_DAMAGE, OBJECT_SMALL_DAMAGE, OBJECT_SUBTYPE, PICK_AXE, ROCK, POT_GAIN_LEVEL, POT_HEALING, POT_INVISIBILITY, SLIME_MOLD, TIN, TRIPE_RATION, WAN_SPEED_MONSTER, } from './object_data.js';
import { placeCreatedObject, placeObjectSynchronously, remove_object, stack_object, } from './floor_object.js';
import { canLetGo } from './hero_inventory.js';
import { useMonsterBullwhip } from './monster_bullwhip.js';
import { canFallThrough, makemonNear, maketrap, mksobj, summonNastyMonsters } from './mklev.js';
import { decideMonsterShapeChange } from './monster_polymorph.js';
import { isZombieMaker, zombieForm } from './corpse_species.js';
import { getTrack, hasTrack } from './track.js';
import { monsterHasMapPosition, monsterAtPosition, placeMonsterAt } from './monster_location.js';
import { dismountHero } from './steed.js';
import { DISMOUNT_THROWN } from './const.js';
import { breakMonsterBoulder, monsterCanBreakBoulder } from './monster_boulder.js';
import { advanceMonsterWormBody, redrawMonsterWormSegments, shrinkStationaryMonsterWorm, wormCrossesBetween, } from './monster_worm.js';
import { displaceMonster, monsterDisplacementFlags } from './monster_displacement.js';
import { retouchEquipment } from './hero_retouch.js';
import { returnHeroToHumanForm, heroHasProtectionFromShapeChangers } from './polyself.js';
import { heroFormSticks } from './hero_species.js';
import { resolvePhysicalHeroHug } from './monster_hug.js';
import { cansee, clearPath, couldsee, visibleCellsFrom, vision_note_blocker_change, } from './vision.js';
import { wipeEngravingAt } from './engrave.js';
import { moveVaultGuard } from './vault.js';
import { afterShopkeeperMove, checkSpecialRoom, shopGreeting, shopkeeperInOwnShop } from './shk.js';
import { shopkeeperIsMuted } from './shop_loss.js';
import { checkMonsterGearNextTurn, findMonsterArmorClass } from './monworn.js';
import { inTown, roomsAt } from './room.js';
import { addShopDamage } from './shop_damage.js';
import { createPoisonGasCloud, GAS_OK, monsterGasTolerance, visibleRegionAt, updateMonsterRegions, } from './regions.js';
import { heroIsBlinded, heroIsDeaf } from './senses.js';
import { makeBlinded } from './sight_change.js';
import { applyMonsterStoningAttack, startHeroPetrificationFromMonster, touchPetrifies, } from './stoning.js';
import { monsterHasAcidResistance, monsterHasColdResistance, monsterHasFireResistance, monsterHasShockResistance, monsterHasStoneResistance, } from './monster_resistance.js';
import { monsterReflectsRay } from './ray.js';
import { clearHeroSliming } from './slime.js';
import { monsterWeaponStrengthBonus, rollPhysicalWeaponDamageAgainstHero, } from './weapon_damage.js';
import { weaponHitBonus } from './weapon_accuracy.js';
import { nurseContactMode } from './monster_nurse_contact.js';
import { selectAttack } from './attack_selection.js';
import { resolveMonsterCombatExplosion } from './monster_combat_explosion.js';
import { resolveMonsterCombatDamage } from './monster_combat_damage.js';
import { resolveMonsterCombatGaze } from './monster_combat_gaze.js';
import { resolveMonsterCombatEngulf } from './monster_combat_engulf.js';
import { tryMonsterPuddingSplit } from './monster_pudding_split.js';
import { erodeAttackingWeapon } from './object_erosion.js';
import { magicNegation, specialAttackNegated } from './magic_negation.js';
import { poisonAttackAttribute, poisonHeroFromMonster, } from './monster_poison.js';
import { isPermanentlyPoisonedObject } from './object_properties.js';
import { canSeeMonsterCombat, revealMonsterCombatDefender, prepareMonsterCombatContact, showMonsterCombatMiss, showMonsterGrabFailure, } from './monster_combat_messages.js';
import { monsterSentenceSubject } from './monster_sound.js';
import { applyMonsterContactPassive } from './monster_contact_passive.js';
import { applyHeroFormPassive } from './hero_form_passive.js';
import { tryKnockback } from './knockback.js';
import { finishEnvironmentalMonsterDeath, finishMonsterKilled, finishMonsterLiquidDeath, } from './monster_death.js';
import { inHeroSanctuary, priestIsInOwnTemple } from './priest.js';
import { addObjectToMonsterInventory, linkObjectToMonsterInventory, } from './monster_inventory.js';
import { currentMonsterLoad, monsterCanCarryObject, monsterCarryAmount } from './monster_carry.js';
export { monsterCanCarryObject } from './monster_carry.js';
import { monsterCanFog, monsterHasLineOfSightToHero, setMonsterApparentHeroPosition, } from './monster_perception.js';
import { adjustMonsterSpeed, monsterSpeedMessage } from './monster_speed.js';
import { setMonsterPermanentInvisibility } from './monster_invisibility.js';
import { msummon } from './minion.js';
import { talkToDemon } from './demon_talk.js';
import { stashLeprechaunGold } from './leprechaun_stash.js';
import { MONSTER_SOUND } from './monster_data.js';
import { MONSTER_DIFFICULTY } from './monster_data.js';
import { depth } from './hacklib.js';
import { artifactById } from './artifacts.js';
import { resolveMonsterWeaponContact } from './monster_weapon_contact.js';
import { monsterHatesBlessings } from './monster_data.js';
import { canHeroRiseUp, levelAtDepth } from './dungeon.js';
import { LEVEL_TELEP } from './const.js';
import { teleportMonsterThroughHole, teleportMonsterThroughPortal, teleportMonsterToRandomLevel } from './teleport.js';
import { learnObjectType } from './object_knowledge.js';
import { changeMonsterForm } from './monster_polymorph.js';
import { rndmonstAdj } from './mklev.js';
import { summonMonsterInsects } from './monster_spell_insects.js';
import { BAG_OF_TRICKS, LUMP_OF_ROYAL_JELLY, POT_POLYMORPH, WAN_MAKE_INVISIBLE, WAN_POLYMORPH } from './object_data.js';
import { lootMonsterContainer } from './monster_container_loot.js';
import { isContainer } from './container.js';
import { isQuantumBox } from './quantum_cat.js';
import { prepareMonsterItemUse, presentMonsterQuaff, presentMonsterWandUse, consumeMonsterItem } from './monster_item_use.js';
import { dragonFormForArmor } from './armor.js';
import { findMonsterDefensiveItem, useMonsterDefensiveItem } from './monster_defensive_item.js';
import { relocateMonsterTo, randomMonsterRelocation, teleportMonsterFromTrap } from './teleport.js';
import { findNearbyMonsterPosition, goodPosition, monsterTeleportRestricted, reportMonsterTeleportRestriction, } from './teleport_rules.js';
import { burnArmorByFire, monsterTrapVisibility, seeTrap } from './trap.js';
import { publishMonsterWake } from './monster_wake.js';
import { wereChange, setHeroLycanthropy } from './were.js';
import { aggravateMonsters, angerMonster, angerWatchGuards, publishMonsterWhimper } from './monster_anger.js';
import { xdir, ydir } from './const.js';
import { stopHeroOccupation } from './occupation.js';
import { rileShopkeeper, shopkeeperRepairsDamage } from './shop_damage.js';
import { diggingTimeToHole } from './hero_digging.js';
import { migrateMonsterOffLevel } from './monster_migration.js';
import { RLOC_MSG, A_CHA, A_DEX, A_STR, A_CON, ALLOW_ALL, ALLOW_BARS, ALLOW_DIG, ALLOW_M, ALLOW_MDISP, ALLOW_ROCK, ALLOW_SANCT, MMOVE_NOTHING, MMOVE_MOVED, MMOVE_DIED, MMOVE_DONE, MMOVE_NOMOVES, MON_FLOOR, ALLOW_SSM, ALLOW_TM, ALLOW_TRAPS, ALLOW_U, ALLOW_WALL, ARROW_TRAP, BEAR_TRAP, BOLT_LIM, COLNO, CORR, DART_TRAP, DOOR, ROWNO, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, D_WARNED, FOUNTAIN, SDOOR, Is_firelevel, Is_waterlevel, IS_DOOR, IS_OBSTRUCTED, IS_ROOM, IS_STWALL, IS_TREE, IS_WALL, IRONBARS, LAVAPOOL, LAVAWALL, BUSTDOOR, MAGIC_PORTAL, OPENDOOR, TELEP_TRAP, ANTI_MAGIC, FIRE_TRAP, HOLE, LANDMINE, MAGIC_TRAP, M_ATTK_AGR_DIED, M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS, M_ATTK_AGR_DONE, M_AP_FURNITURE, M_AP_MONSTER, M_AP_NOTHING, M_AP_OBJECT, M_AP_TYPE, POLY_TRAP, RUST_TRAP, PIT, PL_NSIZ, ROCKTRAP, ROLLING_BOULDER_TRAP, ROOM, SLP_GAS_TRAP, STONE, SPIKED_PIT, SQKY_BOARD, STATUE_TRAP, TRAPDOOR, NEED_AXE, NEED_HTH_WEAPON, NEED_PICK_AXE, NEED_PICK_OR_AXE, NEED_WEAPON, NO_WEAPON_WANTED, MM_NOWAIT, NOGARLIC, NOTONL, SHOPBASE, TEMPLE, TRAPNUM, STRAT_WAITFORU, STRAT_WAITMASK, STRAT_CLOSE, STRAT_ARRIVE, UNLOCKDOOR, VIBRATING_SQUARE, WATER, W_ACCESSORY, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMOR, W_ARMS, W_ARMU, W_NONDIGGABLE, W_NONPASSWALL, Upolyd, isok, WEB, WT_TOOMUCH_DIAGONAL, } from './const.js';
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
const MCF_INDIRECT = 0x01;
const MCF_SIGHT = 0x02;
const MCF_HOSTILE = 0x04;
const MONSTER_CLERIC_SPELLS = [
    { key: 'open-wounds', level: 0, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'cure-self', level: 1, flags: MCF_INDIRECT },
    { key: 'confuse-you', level: 2, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'paralyze', level: 4, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'blind-you', level: 6, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'insects', level: 8, flags: MCF_HOSTILE | MCF_SIGHT | MCF_INDIRECT },
    { key: 'curse-items', level: 10, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'lightning', level: 11, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'fire-pillar', level: 12, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'geyser', level: 13, flags: MCF_HOSTILE | MCF_SIGHT },
];
const MONSTER_WIZARD_SPELLS = [
    { key: 'psi-bolt', level: 0, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'cure-self', level: 1, flags: MCF_INDIRECT },
    { key: 'haste-self', level: 2, flags: MCF_INDIRECT },
    { key: 'stun-you', level: 3, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'disappear', level: 4, flags: MCF_INDIRECT },
    { key: 'weaken-you', level: 6, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'destroy-armor', level: 8, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'curse-items', level: 10, flags: MCF_HOSTILE | MCF_SIGHT },
    { key: 'aggravation', level: 13, flags: MCF_HOSTILE | MCF_SIGHT | MCF_INDIRECT },
    { key: 'summon-monsters', level: 15, flags: MCF_HOSTILE | MCF_SIGHT | MCF_INDIRECT },
    { key: 'clone-wizard', level: 18, flags: MCF_HOSTILE | MCF_SIGHT | MCF_INDIRECT },
    { key: 'death-touch', level: 20, flags: MCF_HOSTILE | MCF_SIGHT },
];
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
function requirePerceivedHero(monster) {
    if (!isFiniteNumber(monster.mux) || !isFiniteNumber(monster.muy))
        throw new Error('An active monster must retain its perceived hero position');
}
function requireMovementCapabilities(movement) {
    if (!movement.postMoveCapabilities)
        throw new Error('A completed monster move must retain its movement capabilities');
    return movement.postMoveCapabilities;
}
function requireDochugContext(action) {
    if (!action.dochugContext)
        throw new Error('A deferred monster movement needs its original turn context');
    return action.dochugContext;
}
function monsterSpellEffectPreview(spell, damage, state) {
    const antimagic = !!state?.u?.antimagic;
    let effectDamage = damage;
    if (antimagic && ['psi-bolt', 'open-wounds'].includes(spell.key))
        effectDamage = Math.trunc((effectDamage + 1) / 2);
    let effectMessage = null;
    if (spell.key === 'psi-bolt') {
        const head = heroHeadName(state);
        effectMessage =
            effectDamage <= 5
                ? `You get a slight ${head}ache.`
                : effectDamage <= 10
                    ? 'Your brain is on fire!'
                    : effectDamage <= 20
                        ? `Your ${head} suddenly aches painfully!`
                        : `Your ${head} suddenly aches very painfully!`;
    }
    else if (spell.key === 'open-wounds') {
        effectMessage =
            effectDamage <= 5
                ? 'Your skin itches badly for a moment.'
                : effectDamage <= 10
                    ? 'Wounds appear on your body!'
                    : effectDamage <= 20
                        ? 'Severe wounds appear on your body!'
                        : 'Your body is covered with painful wounds!';
    }
    else if (spell.key === 'blind-you') {
        const eye = heroEyeName(state);
        effectMessage = `Scales cover your ${heroEyeCount(state) === 1 ? eye : makePlural(eye)}!`;
    }
    else if (spell.key === 'paralyze') {
        const resisted = !!(state?.u?.antimagic || heroHasFreeAction(state));
        if (!heroHasInvoluntaryDelay(state))
            effectMessage = resisted ? 'You stiffen briefly.' : 'You are frozen in place!';
    }
    else if (spell.key === 'confuse-you') {
        if (antimagic) {
            effectMessage = formatFeltMessage('momentarily dizzy.', state);
        }
        else if (heroIsHallucinating(state)) {
            effectMessage =
                formatFeltMessage((state?.u?.confusionTurns ?? 0) > 0 ? 'trippier!' : 'trippy!', state);
        }
        else {
            effectMessage =
                formatFeltMessage((state?.u?.confusionTurns ?? 0) > 0 ? 'more confused!' : 'confused!', state);
        }
    }
    else if (spell.key === 'weaken-you') {
        effectMessage = antimagic ? formatFeltMessage('momentarily weakened.', state) : 'You suddenly feel weaker!';
    }
    else if (spell.key === 'aggravation') {
        effectMessage = formatFeltMessage('that monsters are aware of your presence.', state);
    }
    else if (spell.key === 'stun-you') {
        const resisted = antimagic || heroHasFreeAction(state);
        const alreadyStunned = !!state?.u?.stunned || (state?.u?.stunnedTurns ?? 0) > 0;
        effectMessage = resisted
            ? alreadyStunned
                ? null
                : formatFeltMessage('momentarily disoriented.', state)
            : alreadyStunned
                ? 'You struggle to keep your balance.'
                : 'You reel...';
    }
    else if (spell.key === 'curse-items') {
        effectMessage = formatFeltMessage('as if you need some help.', state);
    }
    else if (spell.key === 'geyser') {
        effectMessage = 'A sudden geyser slams into you from nowhere!';
    }
    else if (spell.key === 'fire-pillar') {
        effectMessage = 'A pillar of fire strikes all around you!';
    }
    else if (spell.key === 'lightning') {
        effectMessage = 'A bolt of lightning strikes down at you from above!';
    }
    return { effectDamage, effectMessage };
}
function speciesHasWeaponAttack(mnum) {
    return (MONSTER_ATTACKS[mnum] || []).some(([attackType]) => attackType === AT_WEAP);
}
// C monmove.c:m_digweapon_check().  A pick-dependent tunneller may select a
// diggable destination while unarmed, but it must spend this action readying
// the appropriate tool before a later turn can enter and excavate the square.
async function readyMonsterDiggingWeapon(monster, state, x, y) {
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
async function heroCanReleaseWeapon(object, state) {
    return !!object && await canLetGo(object, '', state);
}
// C muse.c find_misc()/use_misc().  JavaScript minvent mirrors the C chain
// head-to-tail.  Scan newest-to-oldest and retain each later viable type,
// exactly matching C's "last viable item wins" loop.
async function useMonsterMiscItem(monster, state, random, calls) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    if (flags & (M1_MINDLESS | M1_ANIMAL) ||
        dist2(monster.mx, monster.my, monster.mux ?? state?.u?.ux ?? monster.mx, monster.muy ?? state?.u?.uy ?? monster.my) > 36)
        return null;
    if (state.u.uswallow && state.u.ustuck === monster)
        return null;
    const inventory = monster.minvent || monster.inventory || [];
    const heroWeapon = state?.uwep || state?.u?.uwep || null;
    const heroSwapWeapon = state?.uswapwep || state?.u?.uswapwep || null;
    const apparentX = monster.mux ?? state?.u?.ux ?? monster.mx;
    const apparentY = monster.muy ?? state?.u?.uy ?? monster.my;
    const heroX = state?.u?.ux ?? monster.mx;
    const heroY = state?.u?.uy ?? monster.my;
    const heroSeesInvisible = heroCanSeeInvisible(state);
    const hasGaze = (MONSTER_ATTACKS[monster?.mnum] || []).some(([attackType]) => attackType === AT_GAZE);
    const stuck = state.u.ustuck === monster;
    const weak = (MONSTER_DIFFICULTY[monster.mnum] ?? 0) < 6;
    const naturalForm = (monster.cham ?? -1) < 0;
    if (!stuck && MONSTER_MOVE[monster.mnum] && !monster.mtrapped && naturalForm && weak
        && !inventory.some(object => !!((object.owornmask ?? 0) & W_ARMF)
            && objectMaterial(object.otyp) === IRON)) {
        for (let x = monster.mx - 1; x <= monster.mx + 1; x++) {
            for (let y = monster.my - 1; y <= monster.my + 1; y++) {
                if (!isok(x, y) || x === heroX && y === heroY
                    || MONSTER_NAME[monster.mnum] === 'grid bug' && x !== monster.mx && y !== monster.my
                    || monsterAt(state, x, y, monster))
                    continue;
                const ignoresBoulders = (MONSTER_SIZE[monster.mnum] ?? 0) < 1
                    || !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_ROCKTHROW) || !!(flags & M1_WALLWALK);
                if (!ignoresBoulders && state.level.objects[x]?.[y]?.some(object => object.otyp === BOULDER)
                    || monsterIsScaredAt(monster, state, x, y))
                    continue;
                const trap = trapAt(state, x, y);
                if (trap?.ttyp === POLY_TRAP)
                    return { kind: 'polymorph-trap', trap, deferredEffect: true };
            }
        }
    }
    if (flags & M1_NOHANDS)
        return null;
    let selected = null;
    for (let index = 0; index < inventory.length; index++) {
        const object = inventory[index];
        if (!object)
            continue;
        // muse.c:find_misc() lets a temple priest use an uncursed gain-level
        // potion, but rejects a cursed one so the resident cannot leave the
        // shrine level. Growth remains deferred across both mquaffmsg()
        // toplines.
        if (object.otyp === POT_GAIN_LEVEL &&
            (!object.cursed || (!monster.isgd && !monster.isshk && !monster.ispriest))) {
            selected = {
                kind: 'potion-gain-level',
                object,
                index,
                deferredEffect: true,
            };
        }
        if (selected?.kind === 'bullwhip-disarm')
            continue;
        if (object.otyp === BULLWHIP &&
            !monster.mpeaceful &&
            heroWeapon) {
            // Source ordering is intentional: rn2(5) precedes the wielded,
            // location, adjacency, and canletgo predicates.
            const attempt = recordRandom(random, calls, 5) === 0;
            if (attempt &&
                object === monster.mw &&
                apparentX === heroX &&
                apparentY === heroY &&
                distmin(monster.mx, monster.my, heroX, heroY) <= 1 &&
                !state?.u?.uswallow &&
                (await heroCanReleaseWeapon(heroWeapon, state) ||
                    (state?.u?.twoweap && await heroCanReleaseWeapon(heroSwapWeapon, state)))) {
                selected = {
                    kind: 'bullwhip-disarm',
                    object,
                    index,
                    heroWeapon,
                    heroSwapWeapon,
                };
            }
        }
        if (selected?.kind === 'wand-invisibility')
            continue;
        if (object.otyp === WAN_MAKE_INVISIBLE && object.spe > 0 && !monster.minvis
            && !monster.invis_blkd && (!monster.mpeaceful || heroSeesInvisible)
            && (!hasGaze || monster.mcan))
            selected = { kind: 'wand-invisibility', object, index, deferredEffect: true };
        if (selected?.kind === 'potion-invisibility')
            continue;
        if (object.otyp === POT_INVISIBILITY &&
            !monster.minvis &&
            !monster.invis_blkd &&
            (!monster.mpeaceful || heroSeesInvisible) &&
            (!hasGaze || monster.mcan)) {
            selected = { kind: 'potion-invisibility', object, index };
        }
        if (selected?.kind === 'wand-speed-monster')
            continue;
        if (object.otyp === WAN_SPEED_MONSTER &&
            (object.spe ?? 0) > 0 &&
            monster.mspeed !== MFAST &&
            !monster.isgd) {
            selected = { kind: 'wand-speed-monster', object, index };
        }
        if (selected?.kind === 'potion-speed')
            continue;
        if (object.otyp === POT_SPEED &&
            monster.mspeed !== MFAST &&
            !monster.isgd) {
            selected = { kind: 'potion-speed', object, index };
        }
        if (selected?.kind === 'wand-polymorph')
            continue;
        if (object.otyp === WAN_POLYMORPH && object.spe > 0 && naturalForm && weak)
            selected = { kind: 'wand-polymorph', object, index, deferredEffect: true };
        if (selected?.kind === 'potion-polymorph')
            continue;
        if (object.otyp === POT_POLYMORPH && naturalForm && weak)
            selected = { kind: 'potion-polymorph', object, index, deferredEffect: true };
        if (selected?.kind === 'container')
            continue;
        if (isContainer(object) && object.otyp !== BAG_OF_TRICKS && !recordRandom(random, calls, 5)
            && !isQuantumBox(object) && !selected && object.contents?.length && !object.olocked && !object.otrapped)
            selected = { kind: 'container', object, index, deferredEffect: true };
    }
    if (!selected)
        return null;
    const precheck = await prepareMonsterItemUse(monster, selected.object, { state, random });
    if (precheck)
        return { kind: 'item-result', object: selected.object, index: selected.index, ...precheck };
    if (selected.kind === 'container') {
        const removed = await lootMonsterContainer(monster, selected.object, { state, random });
        return { kind: 'item-result', object: selected.object, index: selected.index, nativeResult: removed ? 2 : 0, heroDied: false };
    }
    if (selected.kind === 'wand-invisibility'
        || selected.kind === 'wand-polymorph' || selected.kind === 'potion-polymorph')
        return selected;
    if (selected.kind === 'potion-gain-level')
        return selected;
    if (selected.kind === 'potion-invisibility') {
        // mquaffmsg() can suspend on an older topline.  allmain applies the
        // state change and consumes the potion only after that await resumes.
        return { ...selected, deferredEffect: true };
    }
    if (selected.kind === 'bullwhip-disarm') {
        // use_misc() chooses the destination before any two-weapon target
        // selection.  Removal itself follows the urgent wrap message.
        const whereTo = recordRandom(random, calls, 4);
        let target = selected.heroWeapon;
        if (!await heroCanReleaseWeapon(target, state) ||
            (state?.u?.twoweap &&
                await heroCanReleaseWeapon(selected.heroSwapWeapon, state) &&
                recordRandom(random, calls, 2))) {
            target = selected.heroSwapWeapon;
        }
        return {
            ...selected,
            target,
            whereTo,
            deferredEffect: true,
        };
    }
    const { object } = selected;
    const wand = object.otyp === WAN_SPEED_MONSTER;
    return {
        ...selected,
        kind: wand ? 'wand-speed-monster' : 'potion-speed',
        deferredEffect: true,
    };
}
export function monsterGainLevelRiseDestination(monster, state) {
    if (!canHeroRiseUp(monster.mx, monster.my, { state }))
        return null;
    const destination = levelAtDepth(depth(state.u.uz, state.dungeons) - 1, { state });
    return sameDungeonLevel(destination, state.u.uz) ? null : destination;
}
// Complete the state half of a miscellaneous action only after its leading
// tty message has returned.  This preserves use_misc() suspension boundaries.
export async function finishDeferredMonsterMiscItem(action, state = requireInitializedGame()) {
    const monster = action?.monster;
    const misc = action?.movement?.usedMisc;
    if (!monster || !misc?.deferredEffect || misc.effectApplied)
        return misc;
    if (misc.kind === 'polymorph-trap') {
        const trapVisible = cansee(misc.trap.tx, misc.trap.ty);
        if (cansee(monster.mx, monster.my) || trapVisible)
            seeTrap(misc.trap, state);
        if (canSeeMonster(monster) || trapVisible) {
            const subject = canonicalMonsterName(monster, { state, capitalized: true, augmentIt: true });
            const verb = verbForSubject(subject, monsterLocomotion(monster.mnum, 'jump'));
            await plineWithContinuation(`${subject} deliberately ${verb} onto a ${misc.trap.tseen ? 'polymorph trap' : 'hidden trap'}!`);
        }
        const oldx = monster.mx, oldy = monster.my;
        placeMonsterAt(monster, misc.trap.tx, misc.trap.ty);
        newsym(oldx, oldy);
        if (monster.wormno)
            advanceMonsterWormBody(monster, { state });
        maybeUnhideAt(monster.mx, monster.my, state);
        newsym(monster.mx, monster.my);
        await changeMonsterForm(monster, null, state, { showMessage: true });
        misc.effectApplied = true;
        return misc;
    }
    if (misc.kind === 'wand-polymorph' || misc.kind === 'potion-polymorph') {
        const seen = canSeeMonster(monster);
        if (misc.kind === 'wand-polymorph')
            await presentMonsterWandUse(monster, misc.object, { state, self: true });
        else {
            await presentMonsterQuaff(monster, misc.object, { state });
            await consumeMonsterItem(monster, misc.object, state);
            if (seen)
                await plineWithContinuation(`${canonicalMonsterName(monster, { state, capitalized: true })} suddenly mutates!`);
        }
        const armor = (monster.minvent || []).find(object => !!((object.owornmask ?? 0) & W_ARM));
        const target = dragonFormForArmor(armor) ?? rndmonstAdj();
        await changeMonsterForm(monster, target, state, { showMessage: true, polyspot: misc.kind === 'wand-polymorph' });
        if (seen)
            learnObjectType(misc.object.otyp, state);
        misc.effectApplied = true;
        return misc;
    }
    if (misc.kind === 'potion-invisibility' || misc.kind === 'wand-invisibility') {
        setMonsterPermanentInvisibility(monster, !misc.object.cursed);
        misc.effectApplied = true;
        return misc;
    }
    if (misc.kind === 'potion-gain-level') {
        await consumeMonsterItem(monster, misc.object, state);
        if (misc.object.cursed) {
            if (misc.riseDestination)
                await migrateMonsterOffLevel(monster, state, { dst: misc.riseDestination });
            misc.effectApplied = true;
            return misc;
        }
        misc.growth = growMonster(monster, {
            state,
            rollOne: rnd,
            random: rn2,
            calls: action.calls,
        });
        if (misc.growth.maxIncrease !== undefined)
            misc.increase = misc.growth.maxIncrease;
        misc.effectApplied = true;
        return misc;
    }
    if (misc.kind === 'wand-speed-monster' || misc.kind === 'potion-speed') {
        const speed = adjustMonsterSpeed(monster, 1);
        misc.oldSpeed = speed.oldSpeed;
        misc.speedChanged = speed.changed && speed.canDescribe && !state.in_mklev;
        misc.speedMuch = speed.much;
        misc.effectApplied = true;
        return misc;
    }
    if (misc.kind === 'bullwhip-disarm') {
        const target = misc.target;
        if (target)
            await useMonsterBullwhip(monster, target, misc.whereTo ?? 0, state);
        misc.effectApplied = true;
    }
    return misc;
}
// JS stores monsters in creation order by appending to level.monsters.
// C's makemon() prepends to fmon, so all scheduler traversals are reversed.
export function monstersInFmonOrder(monsters = []) {
    return Array.from(monsters).reverse();
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
// C ref: mon.c mcalcdistress()/m_calcdistress(). JS appends monsters while C
// prepends them to fmon, so this once-per-global-turn phase traverses the
// reverse of creation order just like movement allocation does. Yielding at
// each transformation lets its messages and consequences finish before the
// next source-ordered random decision.
export async function* monsterDistressEvents(monsters = [], state = requireInitializedGame(), random = rn2, distressTurn = state.moves ?? 1, publish = plineWithContinuation) {
    for (const monster of monstersInFmonOrder(monsters)) {
        if (!monster)
            continue;
        if ((MONSTER_MOVE[monster.mnum] ?? 0) === 0) {
            yield { kind: 'stationary-liquid', monster };
            if (monster.dead || (monster.mhp ?? 1) <= 0)
                continue;
        }
        if ((distressTurn % 20 === 0 || (MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_REGEN) &&
            isFiniteNumber(monster.mhp) &&
            isFiniteNumber(monster.mhpmax)) {
            monster.mhp = Math.min(monster.mhpmax, monster.mhp + 1);
        }
        if (monster.mspec_used !== undefined && monster.mspec_used > 0)
            monster.mspec_used--;
        const changedShape = await decideMonsterShapeChange(monster, state, random, { publish });
        if (changedShape) {
            yield {
                kind: 'shape-change',
                monster,
                change: changedShape,
            };
            if (changedShape.heroDied)
                return;
        }
        const changedWere = await wereChange(monster, state, random, { publish });
        if (changedWere) {
            yield {
                kind: 'were-change',
                monster,
                change: changedWere,
            };
        }
        if (monster.mblinded !== undefined && monster.mblinded > 0 && --monster.mblinded === 0)
            monster.mcansee = 1;
        if (monster.mfrozen !== undefined && monster.mfrozen > 0 && --monster.mfrozen === 0)
            monster.mcanmove = 1;
        if (monster.mfleetim !== undefined && monster.mfleetim > 0 && --monster.mfleetim === 0)
            monster.mflee = 0;
    }
}
export function allocateMonsterMovement(monsters = [], random = rn2, state = requireInitializedGame()) {
    for (const monster of monstersInFmonOrder(monsters)) {
        const amount = mcalcmove(monster, true, random, state);
        monster.movement = (monster.movement ?? 0) + amount;
    }
}
function schedulable(monster) {
    return (monster &&
        (monster.mhp ?? 1) > 0 &&
        (monster.mstate ?? MON_FLOOR) === MON_FLOOR &&
        // x=0 is NetHack's off-map sentinel; y=0 is the valid north row.
        monster.mx !== 0);
}
function dist2(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
}
function distmin(x1, y1, x2, y2) {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
}
function monsterAt(state, x, y, ignore = null) {
    return state?.level?.monsters?.find((monster) => monsterHasMapPosition(monster, state) &&
        monster !== ignore &&
        (monster.mhp ?? 1) > 0 &&
        monster.mx === x &&
        monster.my === y);
}
function speciesIsUnique(mnum) {
    return !!((MONSTER_GENO[mnum] ?? 0) & 0x1000);
}
function zombiePairIsAggressive(attacker, defender, state) {
    const heroInTower = insideWizardTower(state.u.ux, state.u.uy, state);
    if (insideWizardTower(attacker.mx, attacker.my, state) !== heroInTower ||
        insideWizardTower(defender.mx, defender.my, state) !== heroInTower)
        return false;
    if (!isZombieMaker(attacker.mnum, !!attacker.mcan) || zombieForm(defender?.mnum) == null)
        return false;
    if (attacker.mgenmklev && defender.mgenmklev)
        return false;
    if (sameDungeonLevel(state?.stronghold_level, state?.u?.uz))
        return false;
    return !speciesIsUnique(attacker.mnum) && !speciesIsUnique(defender.mnum);
}
function monsterAggressionFlags(attacker, defender, state) {
    if (attacker.mtame && defender.mtame)
        return 0;
    if ([PM_BABY_PURPLE_WORM, PM_PURPLE_WORM].includes(attacker.mnum) &&
        defender.mnum === PM_SHRIEKER)
        return ALLOW_M | ALLOW_TM;
    return zombiePairIsAggressive(attacker, defender, state) ||
        zombiePairIsAggressive(defender, attacker, state)
        ? ALLOW_M | ALLOW_TM
        : 0;
}
function isUnicorn(monster) {
    return monster?.mnum >= 101 && monster?.mnum <= 103;
}
function monAllowFlags(monster, state, rollOne = rnd, calls = DISCARDED_CALL_LOG) {
    const flags = monsterMovementBaseFlags(monster, state);
    return heroHasConflict(state) && !resistConflict(monster, state, rollOne, calls)
        ? flags | ALLOW_U : flags;
}
// C ref: trap.c:m_harmless_trap().  mfndpos() marks only harmful traps in
// candidate info; dog_move() then applies its separate hero-seen 1/40 rule.
function monsterTrapIsHarmless(monster, trap, state) {
    const speciesFlags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[monster.mnum];
    const airborne = speciesFlags & M1_FLY || symbol === S_EYE || symbol === S_LIGHT;
    const sokoban = state.level.flags.sokoban_rules;
    const floorTriggered = trapTriggeredByFloor(trap);
    if (!sokoban && floorTriggered && airborne)
        return true;
    const whirly = symbol === S_VORTEX || monster.mnum === PM_AIR_ELEMENTAL;
    switch (trap.ttyp) {
        case BEAR_TRAP:
            return ((MONSTER_SIZE[monster.mnum] ?? 2) <= 1 ||
                !!(speciesFlags & (M1_AMORPHOUS | M1_UNSOLID)) ||
                whirly);
        case WEB:
            return (!!(speciesFlags & (M1_AMORPHOUS | M1_UNSOLID)) ||
                [94, 96].includes(monster.mnum) ||
                whirly);
        case SLP_GAS_TRAP:
            return monsterResistsSleep(monster);
        case RUST_TRAP:
            return monster.mnum !== PM_IRON_GOLEM;
        case FIRE_TRAP:
            return monsterHasFireResistance(monster);
        case PIT:
        case SPIKED_PIT:
        case HOLE:
        case TRAPDOOR:
            return !!(speciesFlags & M1_CLING) && !sokoban;
        case ANTI_MAGIC:
            return monsterHasMagicResistance(monster);
        case STATUE_TRAP:
        case MAGIC_TRAP:
        case VIBRATING_SQUARE:
            return true;
        default:
            return false;
    }
}
// trap.c:floor_trigger(). These traps require contact with the floor even
// when their eventual effect (a dart or falling rock) could hit a flyer.
export function trapTriggeredByFloor(trap) {
    return [ARROW_TRAP, DART_TRAP, ROCKTRAP, SQKY_BOARD, BEAR_TRAP,
        LANDMINE, ROLLING_BOULDER_TRAP, SLP_GAS_TRAP, RUST_TRAP, FIRE_TRAP,
        PIT, SPIKED_PIT, HOLE, TRAPDOOR].includes(trap.ttyp);
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
function resistConflict(monster, state, rollOne, calls) {
    const charisma = currentAttribute(A_CHA, state);
    const monsterLevel = monster?.m_lev ?? MONSTER_LEVEL[monster?.mnum] ?? 0;
    const heroLevel = state?.u?.ulevel ?? 1;
    const resistChance = Math.min(19, charisma - monsterLevel + heroLevel);
    const roll = rollOne(20);
    calls.push('rnd(20)');
    return roll > resistChance;
}
function monsterDigCapabilities(monster, flags) {
    let rockOk = false;
    let treeOk = false;
    if (!(flags & ALLOW_DIG))
        return { rockOk, treeOk };
    const speciesFlags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    if (!(speciesFlags & M1_NEEDPICK))
        return { rockOk: true, treeOk: true };
    const inventory = monster?.minvent || monster?.inventory || [];
    const wielded = monsterWieldedWeapon(monster);
    if (wielded?.cursed && (monster?.weaponCheck ?? NO_WEAPON_WANTED) === NO_WEAPON_WANTED) {
        return {
            rockOk: [PICK_AXE, DWARVISH_MATTOCK].includes(wielded.otyp),
            treeOk: [AXE, BATTLE_AXE].includes(wielded.otyp),
        };
    }
    const hasShield = inventory.some((object) => ((object?.owornmask ?? 0) & W_ARMS) !== 0);
    rockOk = inventory.some((object) => object?.otyp === PICK_AXE || (object?.otyp === DWARVISH_MATTOCK && !hasShield));
    treeOk = inventory.some((object) => object?.otyp === AXE || (object?.otyp === BATTLE_AXE && !hasShield));
    return { rockOk, treeOk };
}
function monsterMayDigLocation(loc) {
    if (!loc)
        return false;
    return !((IS_STWALL(loc.typ) || IS_TREE(loc.typ)) && (loc.wall_info ?? 0) & W_NONDIGGABLE);
}
// C hack.c:bad_rock().  The orthogonal cells around a diagonal move use the
// species' intrinsic tunnelling/passwall abilities, not the allow flags which
// were computed for the destination itself.
function badRockForMonster(monster, state, x, y) {
    const loc = state?.level?.at?.(x, y);
    if (!loc)
        return true;
    const pile = state?.level?.objects?.[x]?.[y] || [];
    if (state?.level?.flags?.sokoban_rules && pile.some((object) => object.otyp === BOULDER))
        return true;
    if (!IS_OBSTRUCTED(loc.typ))
        return false;
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const mayTunnel = !!(flags & M1_TUNNEL) && !(flags & M1_NEEDPICK) && monsterMayDigLocation(loc);
    const mayPassWall = !!(flags & M1_WALLWALK) && !(IS_STWALL(loc.typ) && (loc.wall_info ?? 0) & W_NONPASSWALL);
    return !mayTunnel && !mayPassWall;
}
function monsterCannotSqueezeThrough(monster, state) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    if (flags & M1_WALLWALK)
        return false;
    const flexible = !!(flags & (M1_AMORPHOUS | M1_SLITHY)) ||
        monsterIsWhirly(monster) ||
        monsterIsNoncorporeal(monster) ||
        monsterCanFog(monster, state);
    if ((MONSTER_SIZE[monster?.mnum] ?? 0) >= 3 && !flexible)
        return true;
    return currentMonsterLoad(monster) > WT_TOOMUCH_DIAGONAL;
}
// C mon.c:mfndpos(). Scan x first, then y; finding the real hero updates
// perception before later squares are classified against the apparent hero.
export function mfndpos(monster, state, flags = monAllowFlags(monster, state)) {
    requirePerceivedHero(monster);
    const positions = [];
    const x = monster.mx, y = monster.my;
    const now = state.level.at(x, y);
    if (!now)
        throw new RangeError('Monster movement started outside the level');
    const speciesFlags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[monster.mnum];
    const levelFlags = state.level.flags;
    const waterLevel = sameDungeonLevel(state.u.uz, state.water_level);
    const rogueLevel = sameDungeonLevel(state.u.uz, state.rogue_level);
    const inAir = monsterInAir(monster, state);
    let wantPool = symbol === S_EEL;
    const poolOk = (!waterLevel && inAir) || (!!(speciesFlags & M1_SWIM) && !wantPool);
    const lavaOk = monster.mnum !== PM_FLOATING_EYE &&
        (inAir || monster.mnum === PM_FIRE_ELEMENTAL || monster.mnum === PM_SALAMANDER);
    const { rockOk, treeOk } = monsterDigCapabilities(monster, flags);
    const throughDoor = !!(flags & (ALLOW_WALL | BUSTDOOR)) || rockOk || treeOk;
    const poisonGasOk = monsterGasTolerance(monster, state) === GAS_OK;
    const currentRegion = visibleRegionAt(state, x, y);
    const inPoisonGas = currentRegion?.kind === 'gas-cloud' && !!currentRegion.damage;
    if (monster.mconf)
        flags = (flags | ALLOW_ALL) & ~NOTONL;
    if (!monster.mcansee)
        flags |= ALLOW_SSM;
    for (;;) {
        positions.length = 0;
        for (let nx = Math.max(1, x - 1); nx <= Math.min(COLNO - 1, x + 1); nx++) {
            for (let ny = Math.max(0, y - 1); ny <= Math.min(ROWNO - 1, y + 1); ny++) {
                if (nx === x && ny === y)
                    continue;
                const loc = state.level.at(nx, ny);
                if (!loc)
                    continue;
                const mayPassWall = !!(flags & ALLOW_WALL) &&
                    !(IS_STWALL(loc.typ) && loc.wall_info & W_NONPASSWALL);
                const mayTunnel = (IS_TREE(loc.typ) ? treeOk : rockOk) && monsterMayDigLocation(loc);
                if (IS_OBSTRUCTED(loc.typ) && !mayPassWall && !mayTunnel)
                    continue;
                if (IS_OBSTRUCTED(loc.typ) &&
                    rockOk &&
                    !(speciesFlags & M1_MINDLESS) &&
                    (monster.mpeaceful || monster.mtame) &&
                    (roomsAt(state.level, nx, ny, TEMPLE).length ||
                        roomsAt(state.level, nx, ny, SHOPBASE).length) &&
                    !(roomsAt(state.level, x, y, TEMPLE).length ||
                        roomsAt(state.level, x, y, SHOPBASE).length))
                    continue;
                if (loc.typ === WATER && !(speciesFlags & M1_SWIM))
                    continue;
                if (loc.typ === IRONBARS &&
                    (!(flags & ALLOW_BARS) ||
                        (loc.wall_info & W_NONDIGGABLE && monsterCorrodesBars(monster))))
                    continue;
                const engulfingHero = state.u.uswallow && state.u.ustuck === monster;
                const slipsUnderDoor = !engulfingHero &&
                    (speciesFlags & M1_AMORPHOUS || monsterCanFog(monster, state));
                if (IS_DOOR(loc.typ) &&
                    !slipsUnderDoor &&
                    ((loc.doormask & D_CLOSED && !(flags & OPENDOOR)) ||
                        (loc.doormask & D_LOCKED && !(flags & UNLOCKDOOR))) &&
                    !throughDoor)
                    continue;
                if (!poisonGasOk && !inPoisonGas) {
                    const region = visibleRegionAt(state, nx, ny);
                    if (region?.kind === 'gas-cloud' && region.damage)
                        continue;
                }
                const diagonal = nx !== x && ny !== y;
                if (diagonal &&
                    (monster.mnum === PM_GRID_BUG ||
                        (IS_DOOR(now.typ) && now.doormask & ~D_BROKEN) ||
                        (IS_DOOR(loc.typ) && loc.doormask & ~D_BROKEN) ||
                        (rogueLevel && (IS_DOOR(now.typ) || IS_DOOR(loc.typ))) ||
                        (wormCrossesBetween(x, y, nx, ny, state) &&
                            !monsterAtPosition(state.level, nx, ny) &&
                            !(nx === state.u.ux && ny === state.u.uy))))
                    continue;
                if (loc.typ === LAVAWALL && (!lavaOk || !(flags & ALLOW_WALL)))
                    continue;
                if (!(poolOk || isPoolAt(nx, ny, state) === wantPool) ||
                    !(lavaOk || !isLavaAt(nx, ny, state)))
                    continue;
                const seesHero = monster.mcansee && (!heroIsInvisible(state) || speciesFlags & M1_SEE_INVIS);
                const displacedScare = heroIsDisplaced(state) && seesHero && nx === monster.mux && ny === monster.muy;
                let info = 0;
                if (monsterIsScaredAt(monster, state, displacedScare ? state.u.ux : nx, displacedScare ? state.u.uy : ny)) {
                    if (!(flags & ALLOW_SSM))
                        continue;
                    info |= ALLOW_SSM;
                }
                const atHero = nx === state.u.ux && ny === state.u.uy;
                if (atHero || (nx === monster.mux && ny === monster.muy)) {
                    if (atHero) {
                        monster.mux = state.u.ux;
                        monster.muy = state.u.uy;
                    }
                    if (!(flags & ALLOW_U))
                        continue;
                    info |= ALLOW_U;
                }
                else {
                    const occupant = monsterAtPosition(state.level, nx, ny);
                    if (occupant) {
                        const attackFlags = flags | monsterAggressionFlags(monster, occupant, state);
                        if (attackFlags & ALLOW_M) {
                            info |= ALLOW_M;
                            if (occupant.mtame) {
                                if (!(attackFlags & ALLOW_TM))
                                    continue;
                                info |= ALLOW_TM;
                            }
                        }
                        else {
                            flags &= ~ALLOW_MDISP;
                            if (!(monsterDisplacementFlags(monster, occupant) & ALLOW_MDISP))
                                continue;
                            info |= ALLOW_MDISP;
                        }
                    }
                    if (levelFlags.has_temple &&
                        roomsAt(state.level, nx, ny, TEMPLE).length &&
                        !roomsAt(state.level, x, y, TEMPLE).length &&
                        inHeroSanctuary(null, nx, ny, state)) {
                        if (!(flags & ALLOW_SANCT))
                            continue;
                        info |= ALLOW_SANCT;
                    }
                }
                const pile = state.level.objects[nx]?.[ny] || [];
                if (pile.some((object) => object.otyp === CLOVE_OF_GARLIC)) {
                    if (flags & NOGARLIC)
                        continue;
                    info |= NOGARLIC;
                }
                if (pile.some((object) => object.otyp === BOULDER)) {
                    if (!(flags & ALLOW_ROCK))
                        continue;
                    info |= ALLOW_ROCK;
                }
                if (seesHero && pointsOnline(nx, ny, monster.mux, monster.muy)) {
                    if (flags & NOTONL)
                        continue;
                    info |= NOTONL;
                }
                if (diagonal &&
                    badRockForMonster(monster, state, x, ny) &&
                    badRockForMonster(monster, state, nx, y) &&
                    monsterCannotSqueezeThrough(monster, state))
                    continue;
                const trap = trapAt(state, nx, ny);
                if (trap) {
                    if (trap.ttyp <= 0 || trap.ttyp >= TRAPNUM)
                        continue;
                    if (trap.ttyp === TELEP_TRAP &&
                        trap.teledest &&
                        isok(trap.teledest.x, trap.teledest.y) &&
                        hasTrack(nx, ny, state)) {
                        info |= ALLOW_TRAPS;
                    }
                    else if (!monsterTrapIsHarmless(monster, trap, state)) {
                        if (!(flags & ALLOW_TRAPS) && monsterKnowsTrap(monster, trap))
                            continue;
                        info |= ALLOW_TRAPS;
                    }
                }
                positions.push({ x: nx, y: ny, info });
            }
        }
        if (positions.length || !wantPool || isPoolAt(x, y, state))
            break;
        wantPool = false;
    }
    return positions;
}
function recordRandom(random, calls, range) {
    calls.push(range);
    return random(range);
}
// Live monster scheduling needs the action object across tty continuations,
// but no gameplay branch reads the diagnostic RNG transcript. Keep the
// append-shaped dependency without allocating or retaining one array per
// actor. The empty iterator preserves the one continuation which merges a
// nested action log; there is deliberately nothing to merge in live mode.
const DISCARDED_CALL_LOG = Object.freeze({
    length: 0,
    push() {
        return 0;
    },
    *[Symbol.iterator]() { },
});
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
    if (heroHasNegativeMulti(state))
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
function applyHeroContactDamage(state, damage) {
    state.context.botl = true;
    if (Upolyd(state.u))
        state.u.mh = Math.min((state.u.mh ?? 1) - damage, state.u.mhmax ?? 1);
    else
        state.u.uhp = Math.min(state.u.uhp - damage, state.u.uhpmax);
}
// Complete body loss before applying the old form's passive response.
async function finishHeroContactDamage(monster, damage, attackType, oldForm, state, { random = rn2, rollDice = d, publish = plineWithContinuation, die } = {}) {
    applyHeroContactDamage(state, damage);
    if (Upolyd(state.u) && state.u.mh < 1) {
        const restored = await returnHeroToHumanForm(state, { publish, ...(die ? { die } : {}) });
        if (restored.died)
            return { heroDied: true, attackerStopped: true };
    }
    if (damage <= 0)
        return { attackerStopped: false };
    return applyHeroFormPassive(monster, oldForm, attackType, { state, random, rollDice, publish });
}
function heroHasNegativeMulti(state) {
    return (!!state?._delayedAction ||
        (state?._helplessTurns ?? 0) > 0);
}
function lineBlockingTerrain(state, x, y) {
    if (!isok(x, y))
        return true;
    const loc = state?.level?.at?.(x, y);
    if (!loc || IS_OBSTRUCTED(loc.typ))
        return true;
    if (IS_DOOR(loc.typ) && (loc.doormask ?? 0) & (D_CLOSED | D_LOCKED))
        return true;
    return loc.typ === WATER || loc.typ === LAVAWALL;
}
function hostileLinedUp(monster, state, random, calls) {
    return monsterLinedUpWithPerceivedHero(monster, state, random, calls);
}
// C mthrowu.c:m_lined_up().  Ranged natural attacks aim at the monster's
// retained apparent hero coordinate, not necessarily the live hero square.
// A polymorphed hero's concealment test precedes the geometric line check.
export function monsterLinedUpWithPerceivedHero(monster, state, random, calls) {
    return monsterLinedUpWithHero(monster, state, range => recordRandom(random, calls, range));
}
function nearbyFloorObjects(monster, state) {
    const objects = [];
    let scanOrder = 0;
    const minX = Math.max(1, monster.mx - 5);
    const maxX = Math.min(79, monster.mx + 5);
    const minY = Math.max(0, monster.my - 5);
    const maxY = Math.min(20, monster.my + 5);
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (const object of state?.level?.objects?.[x]?.[y] || []) {
                objects.push({ object, scanOrder: scanOrder++ });
            }
        }
    }
    // C walks the global fobj chain newest-first, independently of map
    // coordinates.  Explicitly linked runtime drops carry that order; older
    // generated objects retain the established coordinate-order fallback
    // until every construction path shares the same floor-chain owner.
    return objects
        .sort((a, b) => {
        const ao = a.object._fobjOrder;
        const bo = b.object._fobjOrder;
        if (isFiniteNumber(ao) || isFiniteNumber(bo)) {
            if (!isFiniteNumber(ao))
                return 1;
            if (!isFiniteNumber(bo))
                return -1;
            if (ao !== bo)
                return bo - ao;
        }
        return a.scanOrder - b.scanOrder;
    })
        .map((entry) => entry.object);
}
function petCanReachLocation(monster, mx, my, fx, fy, state) {
    if (mx === fx && my === fy)
        return true;
    if (!isok(mx, my))
        return false;
    // dogmove.c does not run a general pathfinder here.  It recursively takes
    // only neighbours which strictly reduce squared distance to the object.
    // That distinction matters for niche/corner objects: a BFS can find a
    // detour which the C anti-stuck check deliberately rejects.
    const distance = dist2(mx, my, fx, fy);
    for (let x = mx - 1; x <= mx + 1; x++) {
        for (let y = my - 1; y <= my + 1; y++) {
            if (!isok(x, y) || dist2(x, y, fx, fy) >= distance)
                continue;
            const loc = state?.level?.at?.(x, y);
            if (!loc)
                continue;
            const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
            if (IS_OBSTRUCTED(loc.typ) && !(flags & M1_WALLWALK)
                && (!monsterMayDigLocation(loc) || !(flags & M1_TUNNEL)
                    || Is_rogue_level(state.u.uz, state)))
                continue;
            if (IS_DOOR(loc.typ) && (loc.doormask ?? 0) & (D_CLOSED | D_LOCKED))
                continue;
            if (!monsterCouldReachItem(monster, x, y, state))
                continue;
            if (petCanReachLocation(monster, x, y, fx, fy, state))
                return true;
        }
    }
    return false;
}
function petCanReachObject(monster, object, state) {
    const targetX = object?.ox;
    const targetY = object?.oy;
    if (!Number.isInteger(targetX) || !Number.isInteger(targetY))
        return false;
    return (monsterCouldReachItem(monster, targetX, targetY, state) &&
        petCanReachLocation(monster, monster.mx, monster.my, targetX, targetY, state));
}
function couldSeeFromHero(state, x, y) {
    // COULD_SEE is bit 0 in vision.c/js/vision.js.  Focused unit states omit
    // the vision buffer and are treated as unobstructed; live games always
    // carry the current buffer produced by domove()/vision_recalc().
    // C gulpmu() runs vision_recalc(2) as soon as swallowing begins.  No
    // external square remains in the master's sight until disgorgement.
    if (state?.u?.uswallow)
        return false;
    if (!state?.viz_array)
        return true;
    return !!((state.viz_array?.[y]?.[x] ?? 0) & 0x1);
}
// C monmove.c:watch_on_duty(). A warning does not consume the watchman's move.
async function watchOnDuty(monster, state, random, calls) {
    if ((monster?.mnum !== PM_WATCHMAN && monster?.mnum !== PM_WATCH_CAPTAIN) || !monster.mpeaceful)
        return false;
    const hero = state?.u || {};
    const requestedX = (hero.ux ?? 0) + (hero.dx ?? 0);
    const requestedY = (hero.uy ?? 0) + (hero.dy ?? 0);
    if (!inTown(state?.level, requestedX, requestedY) || monster.mcansee === 0)
        return false;
    const flags1 = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const heroInvisible = !!(state?.invisible ||
        hero.invisible ||
        hero.invis ||
        (hero.invisibleTurns ?? 0) > 0);
    if ((heroInvisible && !(flags1 & M1_SEE_INVIS)) ||
        state?.underwater ||
        hero.underwater ||
        hero.uinwater ||
        !couldSeeFromHero(state, monster.mx, monster.my))
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
function dogGoal(monster, state, random, calls) {
    if (monster === state.u.usteed)
        return null;
    // Preserve the object-screening side effects before falling back to the
    // hero.  Preferred nearby food owns the goal outright; this is what lets
    // a pony pursue a just-thrown carrot instead of its master's square.
    const ux = state?.u?.ux ?? monster.mx;
    const uy = state?.u?.uy ?? monster.my;
    // dog_move() computes this before dog_goal() and uses it again while
    // scoring movement candidates, including when dog_goal() finds food.
    const whappr = !!monster.edog && state.moves - (monster.edog.whistletime ?? 0) < 5;
    const followsMasterDirectly = !monster.edog || !!monster.mleashed;
    let foodGoal = null;
    let foodType = UNDEF;
    let apportGoal = null;
    const inMastersSight = couldSeeFromHero(state, monster.mx, monster.my);
    const dogHasInventory = !!petDroppableObject(monster);
    const petTile = state?.level?.at?.(monster.mx, monster.my);
    const heroTile = state?.level?.at?.(ux, uy);
    const lightingAllowsFetch = !petTile?.lit || !!heroTile?.lit;
    const nearbyObjects = followsMasterDirectly ? [] : nearbyFloorObjects(monster, state);
    for (const object of nearbyObjects) {
        const type = dogFood(monster, object, random, calls, state);
        const cursedAtLocation = (state?.level?.objects?.[object.ox]?.[object.oy] || []).some((item) => item.cursed);
        const avoidsCursedPile = cursedAtLocation
            && !(monster.edog?.mhpmax_penalty && type < MANFOOD);
        if (avoidsCursedPile || !petCanReachObject(monster, object, state))
            continue;
        if (type < MANFOOD &&
            (type < foodType ||
                (type === foodType &&
                    foodGoal &&
                    dist2(object.ox, object.oy, monster.mx, monster.my) <
                        dist2(foodGoal.ox, foodGoal.oy, monster.mx, monster.my)))) {
            foodGoal = object;
            foodType = type;
        }
        else if (type >= MANFOOD &&
            type < UNDEF &&
            // C stores both food and fetch candidates in gg.gtyp.  Once a
            // preferred food has lowered it below MANFOOD, every later
            // APPORT object is inferior and skips the rn2(8) gate.
            !foodGoal &&
            !apportGoal &&
            inMastersSight &&
            !dogHasInventory &&
            lightingAllowsFetch &&
            // dogmove.c:dog_goal().  MANFOOD is worth evaluating even when
            // the pet cannot see it directly; ordinary APPORT objects still
            // require m_cansee(), whose source macro is clear_path().
            (type === MANFOOD || clearPath(monster.mx, monster.my, object.ox, object.oy)) &&
            (monster.edog?.apport ?? 0) > recordRandom(random, calls, 8) &&
            monsterCanCarryObject(monster, object, state, random)) {
            apportGoal = object;
        }
    }
    let goalX = ux;
    let goalY = uy;
    // C keeps a tempting cadaver as a provisional goal until after the floor
    // scan.  A content pet ignores it and falls back to following its master;
    // only preferred dog food, or food whose hunger time has arrived, wins.
    const hungryTime = monster?.edog?.hungrytime ?? 0;
    let hasObjectGoal = false;
    if (foodGoal) {
        if (foodType === DOGFOOD || state.moves >= hungryTime) {
            goalX = foodGoal.ox;
            goalY = foodGoal.oy;
            hasObjectGoal = true;
        }
        // A superior but currently unappetizing cadaver still overwrites an
        // earlier APPORT candidate in C's single gtyp slot.  The content pet
        // follows its master; it must not fall back to the inferior object.
    }
    else if (apportGoal) {
        goalX = apportGoal.ox;
        goalY = apportGoal.oy;
        hasObjectGoal = true;
    }
    const udist = dist2(monster.mx, monster.my, ux, uy);
    // initedog() starts whistletime at zero. During the opening moves this
    // makes dog_move() treat the pet as recently called even though the hero
    // has not used a whistle yet; that short-lived state is observable in
    // candidate choice and suppresses away-from-goal alternatives.
    const selectsFollowDistance = !followsMasterDirectly && !hasObjectGoal;
    let appr = selectsFollowDistance ? udist >= 9 ? 1 : monster.mflee ? -1 : 0 : 1;
    if (selectsFollowDistance && udist > 1) {
        const heroTile = state?.level?.at?.(ux, uy);
        if (!IS_ROOM(heroTile?.typ ?? 0) ||
            recordRandom(random, calls, 4) === 0 ||
            whappr ||
            (dogHasInventory &&
                recordRandom(random, calls, Math.max(1, monster.edog?.apport ?? 1)) !== 0))
            appr = 1;
    }
    // C dog_goal(): when an otherwise content pet has no approach direction,
    // preferred food in the hero's live inventory makes it follow closely.
    // Inventory order is observable because dogfood() calls obj_resists()
    // before classifying each item and stops at the first DOGFOOD entry.
    if (appr === 0) {
        let onStairs = false;
        for (let stair = state.stairs; stair; stair = stair.next) {
            if (stair.sx === ux && stair.sy === uy) {
                onStairs = true;
                break;
            }
        }
        if (onStairs) {
            appr = 1;
        }
        else {
            const carried = state.inventory;
            for (const object of carried) {
                if (dogFood(monster, object, random, calls, state) === DOGFOOD) {
                    appr = 1;
                    break;
                }
            }
            if (appr === 0) {
                const portal = state?.level?.traps?.find((trap) => trap.ttyp === MAGIC_PORTAL);
                if (portal && dist2(ux, uy, portal.tx, portal.ty) <= 2)
                    appr = 1;
            }
        }
    }
    if (monster.mconf)
        appr = 0;
    // C dog_goal(): a pet which cannot currently see its master follows the
    // newest adjacent hero track instead of targeting the hero through rock.
    // This changes candidate scoring without adding an RNG call, making it a
    // classic screen-equal/stream-different boundary.
    if (goalX === ux && goalY === uy && !inMastersSight) {
        const track = getTrack(monster.mx, monster.my, state);
        if (track) {
            goalX = track.x;
            goalY = track.y;
            if (monster.edog?.ogoal)
                monster.edog.ogoal.x = 0;
        }
        else if (monster.edog?.ogoal?.x &&
            (monster.edog.ogoal.x !== monster.mx || monster.edog.ogoal.y !== monster.my)) {
            goalX = monster.edog.ogoal.x;
            goalY = monster.edog.ogoal.y;
            monster.edog.ogoal.x = 0;
        }
        else {
            // C dog_goal(): if the master and every recent track are out of
            // view, do_clear_area(..., wantdoor) chooses the square visible
            // from the pet which is closest to the hero.
            let bestDistance = (COLNO + 2) * (COLNO + 2);
            let best = null;
            const clearAreaCells = visibleCellsFrom(monster.mx, monster.my, 9);
            for (const cell of clearAreaCells) {
                const distance = dist2(cell.x, cell.y, ux, uy);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    best = cell;
                }
            }
            if (best && (best.x !== monster.mx || best.y !== monster.my)) {
                goalX = best.x;
                goalY = best.y;
                if (monster.edog?.ogoal) {
                    monster.edog.ogoal.x = goalX;
                    monster.edog.ogoal.y = goalY;
                }
            }
        }
    }
    else if (monster.edog?.ogoal) {
        monster.edog.ogoal.x = 0;
    }
    return { x: goalX, y: goalY, appr, whappr };
}
async function petInventoryAction(monster, state, random, calls) {
    if (!monster.edog || monster.meating || monster.mfrozen || monster.msleeping)
        return null;
    const udist = monster === state.u.usteed
        ? 1
        : dist2(monster.mx, monster.my, state?.u?.ux ?? monster.mx, state?.u?.uy ?? monster.my);
    if (petDroppableObject(monster)) {
        const apport = Math.max(1, monster.edog?.apport ?? 1);
        let release = recordRandom(random, calls, udist + 1) === 0;
        if (!release)
            release = recordRandom(random, calls, apport) === 0;
        if (release && recordRandom(random, calls, 10) < apport) {
            const dropped = await releaseMonsterInventory(monster, state, {
                isPet: true,
                show: !!monster.minvis,
                random,
            });
            if (monster.edog && monster.edog.apport > 1)
                monster.edog.apport--;
            if (monster.edog) {
                monster.edog.dropdist = udist;
                monster.edog.droptime = state?.moves ?? 1;
            }
            return { dropped };
        }
        return null;
    }
    const object = state?.level?.objects?.[monster.mx]?.[monster.my]?.[0];
    if (!object)
        return null;
    // dog_invent() rejects the nofetch classes before dogfood().  In
    // particular, a pet standing on a statue must not consume an
    // obj_resists() draw here; dog_goal() will still inspect that same floor
    // object through the global fobj scan.
    const fetchableClass = object.oclass !== BALL_CLASS &&
        object.oclass !== CHAIN_CLASS &&
        object.oclass !== ROCK_CLASS;
    if (!fetchableClass || isLevelPrize(object, state))
        return null;
    const edible = dogFood(monster, object, random, calls, state);
    if ((edible <= CADAVER || monster.edog?.mhpmax_penalty && edible === ACCFOOD)
        && monsterCouldReachItem(monster, monster.mx, monster.my, state)) {
        return { petMeal: beginPetEating(monster, object, { x: monster.mx, y: monster.my }, state) };
    }
    const carryAmount = fetchableClass ? monsterCarryAmount(monster, object, state, random) : 0;
    if (carryAmount > 0 && !object.cursed
        && monsterCouldReachItem(monster, monster.mx, monster.my, state)) {
        // C dog_invent(): a failed pickup leaves the floor pile unchanged.
        const apport = Math.max(1, monster.edog?.apport ?? 1);
        if (recordRandom(random, calls, 20) < apport + 3) {
            const approach = recordRandom(random, calls, Math.max(1, udist));
            if (approach !== 0 || recordRandom(random, calls, apport) === 0) {
                const quantity = object.quan ?? object.quantity ?? 1;
                let pickedUp = object;
                if (carryAmount !== quantity) {
                    const split = splitObjectStack(object, carryAmount, state);
                    if (!split)
                        throw new Error('A positive pet pickup amount must split its stack');
                    pickedUp = split;
                    calls.push('rnd(2)');
                }
                // dogmove.c:dog_invent() splits before its pline, then
                // extracts and carries afterwards: see commitPetPickup().
                return { pickedUp, pickupPending: true };
            }
        }
    }
    return null;
}
// dogmove.c:dog_invent(): after the visible "picks up" line, obj_extract_self()
// and mpickobj() move the chosen object into the pet's inventory.
export async function commitPetPickup(monster, movement, state) {
    const object = movement.pickedUp;
    if (!movement.pickupPending || !object)
        return;
    movement.pickupPending = false;
    remove_object(object, state);
    newsym(monster.mx, monster.my);
    await addObjectToMonsterInventory(monster, object, state);
    if (speciesHasWeaponAttack(monster.mnum) && monster.weaponCheck === NEED_WEAPON) {
        monster.weaponCheck = NEED_HTH_WEAPON;
        await wieldMonsterWeapon(monster, state);
    }
    checkMonsterGearNextTurn(monster);
}
function trapAt(state, x, y) {
    return state?.level?.traps?.find((trap) => trap.tx === x && trap.ty === y);
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
// C mhitm.c:mattackm() handles an AT_WEAP slot before its to-hit roll.
// An unarmed weapon attacker first calls mon_wield_item(); selecting a new
// carried weapon consumes the complete counterattack action.
async function monsterVersusMonsterWieldAction(aggressor, defender, attack, state) {
    if (attack?.attackType !== AT_WEAP)
        return null;
    const currentWeapon = monsterWieldedWeapon(aggressor);
    if (aggressor.weaponCheck !== NEED_WEAPON && currentWeapon)
        return null;
    aggressor.weaponCheck = NEED_HTH_WEAPON;
    return (await wieldMonsterWeapon(aggressor, state))
        ? { kind: 'monster-wield', aggressor, defender }
        : null;
}
// C mhitm.c:mattackm(). Callers establish bhitpos independently of notonhead;
// subsequent slots read the live values left by rays and projectile flight.
export async function attackMonsterWithMonster(aggressor, defender, { state, random = rn2, rollDice = d, rollOne = rnd, calls = DISCARDED_CALL_LOG, target: initialTarget = { x: defender.mx, y: defender.my, notOnHead: false }, }) {
    requireLiveGame(state);
    state.bhitpos = { x: initialTarget.x, y: initialTarget.y };
    state.notonhead = initialTarget.notOnHead;
    if (monsterIsHelpless(aggressor) ||
        (aggressor.mnum === PM_GRID_BUG &&
            aggressor.mx !== defender.mx &&
            aggressor.my !== defender.my)) {
        return { kind: 'monster-attack', aggressor, defender, results: [], struck: false };
    }
    let threshold = findMonsterArmorClass(defender) + (aggressor?.m_lev ?? MONSTER_LEVEL[aggressor?.mnum] ?? 0);
    if (defender.mconf || monsterIsHelpless(defender)) {
        threshold += 4;
        defender.msleeping = 0;
    }
    await revealMonsterCombatDefender(defender, state);
    if (((MONSTER_FLAGS2[aggressor.mnum] ?? 0) & M2_ELF)
        && ((MONSTER_FLAGS2[defender.mnum] ?? 0) & M2_ORC))
        threshold++;
    const visible = canSeeMonsterCombat(aggressor, defender);
    // An out-of-sequence attack counts as this monster's action, but the
    // defender's discovery message completes before the action is stamped.
    aggressor.mlstmv = state.moves;
    const results = [];
    const nativeResults = [];
    let struck = false;
    let death = null;
    let fatalPassive = false;
    let skipBrainDrain = false;
    const report = (nativeResult, heroDied = false) => ({
        kind: 'monster-attack', aggressor, defender, results, nativeResult,
        struck: !!(nativeResult & M_ATTK_HIT), fatalPassive, death,
        aggressorDied: !!aggressor.dead || aggressor.mhp <= 0,
        defenderDied: !!defender.dead || defender.mhp <= 0,
        ...(heroDied ? { heroDied: true } : {}),
    });
    for (let attackIndex = 0; attackIndex < 6; attackIndex++) {
        nativeResults[attackIndex] = M_ATTK_MISS;
        if (aggressor.dead || aggressor.mhp <= 0 || defender.dead || defender.mhp <= 0)
            break;
        if (attackIndex > 0 && monsterAtPosition(state.level, state.bhitpos.x, state.bhitpos.y) !== defender)
            continue;
        const target = { ...state.bhitpos, notOnHead: state.notonhead };
        const damageOptions = { state, visible, random, rollDice, rollOne, calls, target, notOnHead: target.notOnHead };
        const resolveDamage = (attacker, targetMonster, attack) => resolveMonsterCombatDamage(attacker, targetMonster, attack, damageOptions);
        const selected = selectAttack(aggressor, defender, attackIndex, nativeResults, state);
        if (skipBrainDrain && selected[0] === AT_TENT && selected[1] === AD_DRIN)
            continue;
        let slotResult = M_ATTK_MISS;
        let hit = false;
        let weapon = null;
        let attempted = true;
        let slot;
        const distant = distmin(aggressor.mx, aggressor.my, defender.mx, defender.my) > 1;
        if ((selected[0] === AT_WEAP && distant) || selected[0] === AT_BREA || selected[0] === AT_SPIT) {
            if (!distant)
                continue;
            const options = { state, random, rollOne, rollDice };
            const ranged = selected[0] === AT_WEAP
                ? await resolveMonsterCombatThrow(aggressor, defender, options)
                : selected[0] === AT_BREA
                    ? await resolveMonsterCombatBreath(aggressor, defender, selected, options)
                    : await resolveMonsterCombatSpit(aggressor, defender, selected, options);
            hit = ranged.nativeResult !== M_ATTK_MISS;
            slotResult = hit ? M_ATTK_HIT : M_ATTK_MISS;
            if (defender.dead || defender.mhp <= 0)
                slotResult = M_ATTK_DEF_DIED;
            if (aggressor.dead || aggressor.mhp <= 0)
                slotResult |= M_ATTK_AGR_DIED;
            const details = { damageType: selected[1], attackIndex, hit, nativeResult: slotResult };
            slot = selected[0] === AT_WEAP ? { ...details, type: 'ranged-weapon', attackType: AT_WEAP }
                : selected[0] === AT_BREA ? { ...details, type: 'breath', attackType: AT_BREA }
                    : { ...details, type: 'spit', attackType: AT_SPIT };
            if (ranged.heroDied) {
                results.push(slot);
                return report(slotResult, true);
            }
        }
        else if (selected[0] === AT_GAZE) {
            const gaze = await resolveMonsterCombatGaze(aggressor, defender, selected, {
                state, visible, random, rollDice, resolveDamage,
            });
            slotResult = gaze.nativeResult;
            death = gaze.death ?? death;
            skipBrainDrain ||= gaze.skipBrainDrain;
            slot = { type: 'gaze', attackType: AT_GAZE, damageType: selected[1], attackIndex,
                hit: !!(slotResult & M_ATTK_HIT), damage: gaze.damage, nativeResult: slotResult };
            if (gaze.heroDied) {
                results.push(slot);
                return report(slotResult, true);
            }
            // Gaze never makes contact, even when mdamagem reports HIT.
        }
        else if (selected[0] === AT_EXPL) {
            if (distmin(aggressor.mx, aggressor.my, defender.mx, defender.my) > 1)
                continue;
            const explosion = await resolveMonsterCombatExplosion(aggressor, defender, selected, {
                state, visible, random, rollDice, resolveDamage,
            });
            slotResult = explosion.mask;
            hit = slotResult !== M_ATTK_MISS;
            attempted = hit;
            slot = { type: 'explosion', attackType: AT_EXPL, damageType: selected[1], attackIndex,
                hit, damage: explosion.damage, nativeResult: slotResult };
            if (explosion.heroDied) {
                results.push(slot);
                return report(slotResult, true);
            }
        }
        else if (selected[0] === AT_ENGL) {
            let damage = 0;
            if (monsterIsShade(defender)) {
                if (visible)
                    await plineWithContinuation(`${possessiveName(canonicalMonsterName(aggressor, { state, capitalized: true }))} attempt to engulf ${canonicalMonsterName(defender, { state })} is futile.`);
            }
            else if (defender !== state.u.usteed) {
                if (distmin(aggressor.mx, aggressor.my, defender.mx, defender.my) > 1)
                    continue;
                if (!(state.u.uswallow && state.u.ustuck === aggressor)) {
                    const die = 20 + attackIndex;
                    hit = threshold > rollOne(die);
                    calls.push(`rnd(${die})`);
                    if (hit && (monsterIsUnsolid(defender) || target.notOnHead)
                        && [AD_WRAP, AD_STCK, AD_DGST].includes(selected[1])) {
                        await showMonsterGrabFailure(aggressor, defender, { attackType: selected[0], damageType: selected[1] }, target, visible, state);
                        hit = false;
                    }
                    else if (hit) {
                        const engulf = await resolveMonsterCombatEngulf(aggressor, defender, selected, {
                            state, visible, random, rollOne, rollDice, resolveDamage,
                        });
                        slotResult = engulf.nativeResult;
                        damage = engulf.damage;
                        death = engulf.death ?? death;
                        if (engulf.heroDied)
                            return report(slotResult, true);
                    }
                    else
                        await showMonsterCombatMiss(aggressor, defender, selected, { state, visible });
                }
            }
            slot = { type: 'engulf', attackType: AT_ENGL, damageType: selected[1], attackIndex,
                hit, damage, nativeResult: slotResult };
        }
        else {
            const attack = monsterMeleeAttackSlot(selected, attackIndex);
            if (!attack)
                continue;
            if (attack.attackType === AT_KICK && aggressor.mtrapped) {
                const trap = trapAt(state, aggressor.mx, aggressor.my);
                if (trap?.ttyp === PIT || trap?.ttyp === SPIKED_PIT)
                    continue;
            }
            const isHug = attack.attackType === AT_HUGS;
            if (!isHug && distmin(aggressor.mx, aggressor.my, defender.mx, defender.my) > 1)
                continue;
            const wield = await monsterVersusMonsterWieldAction(aggressor, defender, attack, state);
            if (wield)
                return wield;
            if (attack.attackType === AT_WEAP)
                await updateMonsterWeaponAfterPolymorph(aggressor, state);
            weapon = attack.attackType === AT_WEAP ? monsterWieldedWeapon(aggressor) ?? null : null;
            if (weapon) {
                if (visible)
                    await swingMonsterWeapon(aggressor, weapon, state, { defender, random });
                threshold += weaponHitBonus(weapon, defender, { state, random, rollOne });
            }
            const attackThreshold = threshold;
            let roll = 0;
            if (isHug) {
                hit = attackIndex >= 2 && nativeResults[attackIndex - 1] === M_ATTK_HIT
                    && nativeResults[attackIndex - 2] === M_ATTK_HIT;
            }
            else {
                const die = 20 + attackIndex;
                roll = rollOne(die);
                calls.push(`rnd(${die})`);
                hit = threshold > roll;
            }
            // Native hitval is evaluated again, including its artifact rolls.
            if (weapon)
                threshold -= weaponHitBonus(weapon, defender, { state, random, rollOne });
            const unsolid = monsterIsUnsolid(defender);
            const failedGrab = hit && (isHug ? unsolid || target.notOnHead
                : unsolid && [AD_WRAP, AD_STCK, AD_DGST].includes(attack.damageType));
            if (failedGrab) {
                await showMonsterGrabFailure(aggressor, defender, attack, target, visible, state);
                hit = false;
            }
            let damage = 0;
            if (hit) {
                const contact = await prepareMonsterCombatContact(aggressor, defender, selected, weapon, { state, visible, rollOne, rollDice });
                if (contact === 'contact') {
                    const outcome = await resolveMonsterCombatDamage(aggressor, defender, selected, { ...damageOptions, weapon, dieRoll: roll });
                    slotResult = outcome.nativeResult;
                    damage = outcome.damage;
                    death = outcome.death ?? death;
                    skipBrainDrain ||= outcome.skipBrainDrain;
                    if (outcome.heroDied)
                        return report(slotResult, true);
                }
                // Native pudding division follows hitmm, including a native
                // MISS after life saving. Hugs use a separate dispatch branch.
                if (!isHug) {
                    const split = await tryMonsterPuddingSplit(aggressor, defender, weapon, { state, visible, random });
                    if (split.heroDied)
                        return report(slotResult, true);
                    if (split.aggressorDied)
                        slotResult |= M_ATTK_AGR_DIED;
                }
            }
            else if (!failedGrab && !isHug)
                await showMonsterCombatMiss(aggressor, defender, selected, { state, visible });
            slot = { ...attack, roll, threshold: attackThreshold, hit, damage };
        }
        results.push(slot);
        // passivemm replaces the slot mask using the original contact strike.
        // It runs after a gaze too, with strike=false, when still adjacent.
        if (attempted && !(slotResult & M_ATTK_AGR_DIED)
            && distmin(aggressor.mx, aggressor.my, defender.mx, defender.my) <= 1) {
            const passive = await applyMonsterContactPassive(aggressor, defender, { hit, weapon, state, random, rollDice });
            if (passive.heroDied)
                return report(slotResult, true);
            slotResult = (slotResult & M_ATTK_DEF_DIED) | (passive.hit ? M_ATTK_HIT : M_ATTK_MISS);
            fatalPassive = !!passive.fatal;
            if (fatalPassive)
                slotResult |= M_ATTK_AGR_DIED;
        }
        nativeResults[attackIndex] = slotResult;
        if ((slotResult & (M_ATTK_DEF_DIED | M_ATTK_AGR_DIED | M_ATTK_AGR_DONE))
            || monsterIsHelpless(aggressor) || !state.level.monsters.includes(defender))
            return report(slotResult);
        if (slotResult & M_ATTK_HIT)
            struck = true;
    }
    return report(struck ? M_ATTK_HIT : M_ATTK_MISS);
}
// C monmove.c:m_move_aggress(). An empty apparent-hero square still spends
// the action; an actual defender can answer a hit using its movement budget.
async function moveMonsterAggress(monster, x, y, state, random, rollDice, rollOne, calls) {
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
function monsterMeleeAttackSlot(attack, attackIndex) {
    const attackNames = {
        1: 'claw',
        2: 'bite',
        3: 'kick',
        4: 'butt',
        5: 'touch',
        6: 'sting',
        7: 'hug',
        [AT_TENT]: 'tentacle',
        [AT_WEAP]: 'weapon',
    };
    const [attackType, damageType, damn, damd] = attack;
    const type = attackNames[attackType];
    return type ? { type, attackType, damageType, damn, damd, attackIndex } : null;
}
function defenderCanAnswerPetAttack(aggressor, defender, state, random, calls) {
    return (recordRandom(random, calls, 4) !== 0 &&
        defender.mlstmv !== (state.moves ?? 1) &&
        !monsterIsScaredAt(defender, state, aggressor.mx, aggressor.my) &&
        distmin(defender.mx, defender.my, aggressor.mx, aggressor.my) <= 1);
}
function defenderCanAnswerMovementAttack(defender, random, calls) {
    if (recordRandom(random, calls, 4) === 0)
        return false;
    if ((defender.movement ?? 0) <= recordRandom(random, calls, NORMAL_SPEED))
        return false;
    const remaining = defender.movement ?? 0;
    defender.movement = remaining > NORMAL_SPEED ? remaining - NORMAL_SPEED : 0;
    return true;
}
function defenderCanCounterattack(attack, state, random, calls) {
    if (!attack.struck || attack.defenderDied || monsterAttackStopsAggressor(attack))
        return false;
    if (attack.retaliationRule === 'movement') {
        return defenderCanAnswerMovementAttack(attack.defender, random, calls);
    }
    return (attack.retaliationRule === 'pet' &&
        defenderCanAnswerPetAttack(attack.aggressor, attack.defender, state, random, calls));
}
function monsterAttackStopsAggressor(attack) {
    // Native explosion and passive results can stop an attacker which was
    // life-saved. Preserve that result independently of its current health.
    return !!(attack.aggressorDied || attack.fatalPassive
        || (attack.kind === 'monster-attack' && ((attack.nativeResult ?? 0) & M_ATTK_AGR_DIED)));
}
// C dogmove.c:pet_ranged_attk(). Selection precedes one complete mattackm or
// mattacku action; only the original target can answer it with a counterattack.
export async function performPetRangedAttack(pet, state, { forced = false, random = rn2, rollDice = d, rollOne = rnd, calls = DISCARDED_CALL_LOG, } = {}) {
    requireLiveGame(state);
    const selection = selectPetRangedTarget(pet, state, {
        forced, random: range => recordRandom(random, calls, range),
        rollOne: sides => { calls.push(`rnd(${sides})`); return rollOne(sides); },
    });
    const target = selection.target;
    if (!target) {
        if (selection.makeNoise)
            await publishMonsterNoise(pet, state);
        return { status: MMOVE_NOTHING, heroDied: !!state.program_state.gameover };
    }
    if (!('mnum' in target)) {
        const heroAttack = await performMonsterHeroAttack(pet, state, { random, rollDice, rollOne, calls });
        return { status: heroAttack.nativeResult === 1 ? MMOVE_DIED : MMOVE_DONE, heroDied: heroAttack.heroDied };
    }
    const attack = await attackMonsterWithMonster(pet, target, {
        state, random, rollDice, rollOne, calls,
        target: { x: pet.mx, y: pet.my, notOnHead: false },
    });
    const nativeResult = attack.kind === 'monster-attack' ? attack.nativeResult ?? M_ATTK_MISS : M_ATTK_MISS;
    const result = {
        status: nativeResult === M_ATTK_MISS ? MMOVE_NOTHING : MMOVE_DONE,
        heroDied: !!attack.heroDied, attack,
    };
    if (nativeResult & M_ATTK_AGR_DIED)
        result.status = MMOVE_DIED;
    if (result.heroDied || result.status === MMOVE_DIED)
        return result;
    if ((nativeResult & M_ATTK_HIT) && !(nativeResult & M_ATTK_DEF_DIED)
        && recordRandom(random, calls, 4) !== 0 && target.mcansee
        && !((MONSTER_FLAGS1[target.mnum] ?? 0) & M1_NOEYES)) {
        const response = await attackMonsterWithMonster(target, pet, { state, random, rollDice, rollOne, calls });
        result.counterattack = response;
        result.heroDied = !!response.heroDied;
        if (response.kind === 'monster-attack' && ((response.nativeResult ?? 0) & M_ATTK_DEF_DIED))
            result.status = MMOVE_DIED;
    }
    return result;
}
async function beginMonsterMeleeAttack(aggressor, defender, state, random, rollDice, rollOne, calls, retaliationRule, selected = { x: defender.mx, y: defender.my }) {
    const target = {
        x: selected.x,
        y: selected.y,
        notOnHead: selected.x !== defender.mx || selected.y !== defender.my,
    };
    const result = await attackMonsterWithMonster(aggressor, defender, { state, random, rollDice, rollOne, calls, target });
    if (result.heroDied || result.kind !== 'monster-attack')
        return result;
    result.retaliationRule = retaliationRule;
    if (defenderCanCounterattack(result, state, random, calls)) {
        result.counterattack = await attackMonsterWithMonster(defender, aggressor, { state, random, rollDice, rollOne, calls });
        if (result.counterattack.heroDied) {
            result.heroDied = true;
            return result;
        }
        result.aggressorDied = !!aggressor.dead || aggressor.mhp <= 0;
        result.defenderDied = !!defender.dead || defender.mhp <= 0;
    }
    return result;
}
async function stopMonsterHeldByHero(monster, state) {
    if (state.u.ustuck !== monster || state.u.uswallow || !heroFormSticks(state))
        return false;
    await plineWithContinuation(`${canonicalMonsterName(monster, {
        state,
        capitalized: true,
    })} cannot escape from you!`);
    return true;
}
// C mhitm.c:fightm(). A hit replaces dochug; a miss lets the actor continue.
async function fightNearbyMonster(monster, state, random, rollDice, rollOne, calls) {
    if (resistConflict(monster, state, rollOne, calls))
        return null;
    const hero = state.u;
    if (await stopMonsterHeldByHero(monster, state))
        return null;
    const swallowed = !!(hero.uswallow && hero.ustuck === monster);
    for (const target of monstersInFmonOrder(state.level.monsters)) {
        if (target === monster || target.dead || target.mhp <= 0)
            continue;
        const distance = dist2(monster.mx, monster.my, target.mx, target.my);
        if (distance >= 3 || (distance === 2 && monster.mnum === PM_GRID_BUG))
            continue;
        if (!hero.uswallow && hero.ustuck === monster) {
            if (recordRandom(random, calls, 4) !== 0)
                break;
            // set_ustuck(NULL), not unstuck(): no re-hold cooldown or redraw.
            state.context.botl = 1;
            hero.ustuck = null;
            hero.uswallow = 0;
            hero.uswldtim = 0;
            await plineWithContinuation(`${canonicalMonsterName(monster, {
                state,
                capitalized: true,
            })} releases you!`);
        }
        const attack = await beginMonsterMeleeAttack(monster, target, state, random, rollDice, rollOne, calls, swallowed ? null : 'movement');
        if (attack.heroDied)
            return { attack, heroDied: true };
        if (monsterAttackStopsAggressor(attack))
            return { attack, consumed: true };
        return { attack, consumed: !swallowed && !!attack.struck };
    }
    return null;
}
async function petAttacksMonster(pet, target, state, random, rollDice, rollOne, calls, selected) {
    return await beginMonsterMeleeAttack(pet, target, state, random, rollDice, rollOne, calls, 'pet', selected);
}
// C mondata.c:max_passive_dmg().  dog_move() uses the defender's maximum
// passive retaliation, multiplied by the pet's number of contact attacks, as
// a deterministic safety gate before any melee to-hit roll is allowed.
export function maxPassiveMonsterDamage(defender, aggressor) {
    const contactTypes = new Set([
        AT_CLAW, AT_BITE, AT_KICK, AT_BUTT, AT_TUCH, AT_STNG, AT_HUGS,
        AT_ENGL, AT_TENT, AT_WEAP,
    ]);
    const contactCount = (MONSTER_ATTACKS[aggressor?.mnum] || []).filter(([attackType]) => contactTypes.has(attackType)).length;
    if (!contactCount)
        return 0;
    const species = MONSTER_NAME[aggressor.mnum];
    for (const [attackType, damageType, dice, sides] of MONSTER_ATTACKS[defender?.mnum] || []) {
        if (attackType !== AT_NONE && attackType !== AT_BOOM)
            continue;
        // These bodies are destroyed by contact regardless of resistance or HP.
        if (damageType === AD_FIRE && (species === 'paper golem' || species === 'straw golem')
            || damageType === AD_DCAY && (species === 'wood golem' || species === 'leather golem')
            || damageType === AD_RUST && species === 'iron golem')
            return aggressor.mhp * contactCount;
        const resisted = (damageType === AD_FIRE && monsterHasFireResistance(aggressor)) ||
            (damageType === AD_COLD && monsterHasColdResistance(aggressor)) ||
            (damageType === AD_ELEC && monsterHasShockResistance(aggressor)) ||
            (damageType === AD_ACID && monsterHasAcidResistance(aggressor));
        if (resisted)
            return 0;
        if (![AD_PHYS, AD_FIRE, AD_COLD, AD_ELEC, AD_ACID].includes(damageType))
            return 0;
        const count = dice || (MONSTER_LEVEL[defender.mnum] ?? 0) + 1;
        return count * sides * contactCount;
    }
    return 0;
}
async function finishPetMovePlan(monster, state, plan, random, rollDice, rollOne, calls) {
    const { oldx, oldy, selectedInfo, reluctant, inventoryAction } = plan;
    let { nix, niy } = plan;
    if (selectedInfo & ALLOW_U) {
        if (monster.mleashed) {
            const pronoun = (MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_NEUTER
                ? 'its'
                : monster.female
                    ? 'her'
                    : 'his';
            const subject = canSpotMonster(monster) ? monsterSentenceSubject(monster) : 'It';
            await plineWithContinuation(`${subject} breaks loose of ${pronoun} leash!`);
            releaseMonsterLeash(monster, state);
        }
        const attack = await beginMonsterHeroAttack(monster, state, random, rollOne, rollDice, calls);
        return {
            oldx,
            oldy,
            x: oldx,
            y: oldy,
            moved: false,
            ...attack,
            actionCompleted: true,
            postMoveStatus: MMOVE_DONE,
            movementStage: 'postmov',
            deferredAfterPetAttack: true,
            ...inventoryAction,
        };
    }
    if (nix !== oldx || niy !== oldy) {
        updateMonsterRegions(monster, state, { x: nix, y: niy });
        if (await readyMonsterDiggingWeapon(monster, state, nix, niy)) {
            return {
                oldx, oldy, x: oldx, y: oldy, moved: false,
                postMoveStatus: MMOVE_NOTHING, movementStage: 'postmov',
                ...inventoryAction,
            };
        }
    }
    monster.mx = nix;
    monster.my = niy;
    if (nix !== oldx || niy !== oldy) {
        if (!Array.isArray(monster.mtrack))
            monster.mtrack = [];
        monster.mtrack.unshift({ x: oldx, y: oldy });
        monster.mtrack.length = Math.min(monster.mtrack.length, 4);
    }
    else {
        pullLeashedPetCloser(monster, state, random, calls);
        nix = monster.mx;
        niy = monster.my;
    }
    const movement = {
        oldx,
        oldy,
        x: nix,
        y: niy,
        moved: nix !== oldx || niy !== oldy,
        postMoveStatus: MMOVE_MOVED,
        movementStage: 'postmov',
        ...inventoryAction,
    };
    if (movement.moved && reluctant) {
        movement.reluctant = true;
        movement.deferredPetReluctance = true;
    }
    return movement;
}
// C dog_move() keeps a leashed pet close even after an action which left it
// in place. Its fallback probes use dirtocoord's map coordinates as written.
function pullLeashedPetCloser(monster, state, random, calls) {
    if (!monster.mleashed || dist2(monster.mx, monster.my, state.u.ux, state.u.uy) <= 4)
        return;
    const dx = Math.sign(monster.mx - state.u.ux);
    const dy = Math.sign(monster.my - state.u.uy);
    let destination = { x: state.u.ux + dx, y: state.u.uy + dy };
    const reachable = (position) => goodPosition(position.x, position.y, { kind: 'monster', monster }, { state });
    if (!reachable(destination)) {
        const direction = xdir.findIndex((x, i) => i < 8 && x === dx && ydir[i] === dy);
        let found = false;
        for (const spread of [1, 2]) {
            for (let j = (direction + 8 - spread) % 8; j < (direction + spread) % 8; j++) {
                const x = xdir[j], y = ydir[j];
                if (x === undefined || y === undefined)
                    continue;
                const candidate = { x, y };
                if (!reachable(candidate))
                    continue;
                destination = candidate;
                found = true;
                break;
            }
            if (found)
                break;
        }
        if (!found)
            destination = { x: monster.mx, y: monster.my };
    }
    // The native region check precedes placement and uses the unchanged
    // planned square when this is a forced leash move.
    updateMonsterRegions(monster, state);
    monster.mx = destination.x;
    monster.my = destination.y;
    newsym(monster.mx, monster.my);
    setMonsterApparentHeroPosition(monster, state, random, calls);
}
async function movePet(monster, state, random, rollDice, rollOne, calls, resumeAfterInventory = false) {
    const oldx = monster.mx;
    const oldy = monster.my;
    const masterDistance = dist2(oldx, oldy, state.u.ux, state.u.uy);
    if (!resumeAfterInventory && monster.edog && await applyPetHunger(monster, state)) {
        return {
            oldx, oldy, x: monster.mx, y: monster.my, moved: false,
            postMoveStatus: MMOVE_DIED, movementStage: 'postmov',
        };
    }
    if (!resumeAfterInventory && monster === state.u.usteed &&
        heroHasConflict(state) &&
        !resistConflict(monster, state, rollOne, calls)) {
        await dismountHero(DISMOUNT_THROWN, { state });
        return {
            oldx,
            oldy,
            x: monster.mx,
            y: monster.my,
            moved: false,
            postMoveStatus: MMOVE_MOVED,
            movementStage: 'postmov',
        };
    }
    if (!resumeAfterInventory && monster !== state.u.usteed
        && oldx === state.u.ux && oldy === state.u.uy) {
        return {
            oldx, oldy, x: oldx, y: oldy, moved: false,
            postMoveStatus: MMOVE_NOTHING, movementStage: 'postmov',
        };
    }
    const inventoryAction = resumeAfterInventory
        ? null
        : await petInventoryAction(monster, state, random, calls);
    if (inventoryAction?.petMeal) {
        return {
            oldx,
            oldy,
            x: oldx,
            y: oldy,
            moved: false,
            postMoveStatus: MMOVE_MOVED,
            movementStage: 'postmov',
            deferredPetEating: true,
            ...inventoryAction,
        };
    }
    // Pickup narration still resumes through the turn driver. Drops await
    // their messages and floor effects in relobj before dog_goal runs.
    if (inventoryAction?.pickedUp) {
        return {
            oldx,
            oldy,
            x: oldx,
            y: oldy,
            moved: false,
            deferredPetMove: true,
            ...inventoryAction,
        };
    }
    const goal = dogGoal(monster, state, random, calls);
    if (!goal)
        return {
            oldx,
            oldy,
            x: oldx,
            y: oldy,
            moved: false,
            postMoveStatus: MMOVE_NOTHING,
            movementStage: 'postmov',
        };
    if (heroHasConflict(state) && !resistConflict(monster, state, rollOne, calls)
        && !monster.edog) {
        const departure = await loseGuardianAngel(monster, state);
        return {
            oldx, oldy, x: monster.mx, y: monster.my, moved: false,
            actorLeftLevel: true, heroDied: departure.heroDied,
            actionCompleted: true, postMoveStatus: MMOVE_DIED, movementStage: 'postmov',
        };
    }
    const allowFlags = monAllowFlags(monster, state, rollOne, calls);
    const candidates = mfndpos(monster, state, allowFlags);
    const uncursedCount = candidates.filter(({ x, y }) => !(state?.level?.objects?.[x]?.[y] || []).some((object) => object.cursed)).length;
    let nix = oldx;
    let niy = oldy;
    let nidist = dist2(nix, niy, goal.x, goal.y);
    let chcnt = 0;
    let reluctant = false;
    let selectedInfo = 0;
    for (const candidate of candidates) {
        const { x: nx, y: ny } = candidate;
        const nextMasterDistance = dist2(nx, ny, state.u.ux, state.u.uy);
        if (monster.mleashed && nextMasterDistance > 4)
            continue;
        if (!monster.edog && nextMasterDistance > 16 && nextMasterDistance >= masterDistance)
            continue;
        if (candidate.info & ALLOW_M) {
            const target = monsterAtPosition(state.level, nx, ny);
            if (!target)
                continue;
            const petLevel = monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0;
            const balk = petLevel +
                Math.trunc((5 * (monster.mhp ?? 1)) / Math.max(1, monster.mhpmax ?? monster.mhp ?? 1)) -
                2;
            if ((target.m_lev ?? MONSTER_LEVEL[target.mnum] ?? 0) >= balk)
                continue;
            // C dogmove.c:dog_move().  Outside Conflict, two tame monsters
            // are allies even when mfndpos() marks the occupied square with
            // ALLOW_M.  Keep scanning movement candidates rather than
            // manufacturing a zero-hit attack transaction between pets.
            if (target.mtame && monster.mtame && !heroHasConflict(state))
                continue;
            if (maxPassiveMonsterDamage(target, monster) >= (monster.mhp ?? 1))
                continue;
            const targetSound = MONSTER_SOUND[target.mnum];
            if ((monster.mhp * 4 < monster.mhpmax
                || targetSound === MS_GUARDIAN || targetSound === MS_LEADER)
                && target.mpeaceful && !heroHasConflict(state))
                continue;
            // dog_move() usually avoids paralysis and petrifying contact even
            // when the expected passive HP damage would be survivable.
            const avoidsEye = target.mnum === MONSTER_NAME.indexOf('floating eye')
                && recordRandom(random, calls, 10) !== 0
                && !!monster.mcansee
                && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES)
                && !!target.mcansee
                && (!target.minvis || !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS))
                && !monsterReflectsRay(monster, state);
            const avoidsCube = target.mnum === MONSTER_NAME.indexOf('gelatinous cube')
                && recordRandom(random, calls, 10) !== 0;
            const avoidsPetrification = touchPetrifies(target.mnum)
                && !monsterHasStoneResistance(monster);
            if (avoidsEye || avoidsCube || avoidsPetrification)
                continue;
            const attack = await petAttacksMonster(monster, target, state, random, rollDice, rollOne, calls, { x: nx, y: ny });
            return {
                oldx,
                oldy,
                x: oldx,
                y: oldy,
                moved: false,
                attack,
                postMoveStatus: monsterAttackStopsAggressor(attack) ? MMOVE_DIED : MMOVE_DONE,
                movementStage: 'postmov',
                ...inventoryAction,
            };
        }
        if (monsterAvoidsKickedLocation(monster, nx, ny, state))
            continue;
        if (monsterAvoidsSokobanPushLocation(monster, nx, ny, state))
            continue;
        // dog_move() handles traps before inspecting the candidate's object
        // pile.  A pet usually refuses a harmful trap the hero has seen, but
        // an unseen trap remains eligible even when the pet knows its type.
        const trap = trapAt(state, nx, ny);
        if (candidate.info & ALLOW_TRAPS && trap) {
            if (monster.mleashed) {
                if (!heroIsDeaf(state))
                    await publishMonsterWhimper(monster);
            }
            else if (trap.tseen && recordRandom(random, calls, 40) !== 0)
                continue;
        }
        // dogmove.c examines every reachable, uncursed object on a candidate
        // square before applying its cursed-square avoidance roll.  Cursed
        // objects set the reluctance flag without calling dogfood(); ordinary
        // objects still own dogfood()'s obj_resists() draw even when the pet
        // ultimately rejects the square because something cursed is below.
        let cursed = false;
        let edible = null;
        const reachableFood = monsterCouldReachItem(monster, nx, ny, state);
        for (const object of monster.edog ? state.level.objects[nx]?.[ny] ?? [] : []) {
            if (object.cursed)
                cursed = true;
            else if (reachableFood) {
                const foodType = dogFood(monster, object, random, calls, state);
                if (foodType < MANFOOD &&
                    (foodType < ACCFOOD || (monster.edog?.hungrytime ?? 0) <= (state?.moves ?? 1))) {
                    edible = object;
                    break;
                }
            }
        }
        if (edible) {
            updateMonsterRegions(monster, state, { x: nx, y: ny });
            if (await readyMonsterDiggingWeapon(monster, state, nx, ny)) {
                return {
                    oldx, oldy, x: oldx, y: oldy, moved: false,
                    postMoveStatus: MMOVE_NOTHING, movementStage: 'postmov',
                    ...inventoryAction,
                };
            }
            monster.mx = nx;
            monster.my = ny;
            if (!Array.isArray(monster.mtrack))
                monster.mtrack = [];
            monster.mtrack.unshift({ x: oldx, y: oldy });
            monster.mtrack.length = Math.min(monster.mtrack.length, 4);
            const meal = beginPetEating(monster, edible, { x: oldx, y: oldy }, state);
            return {
                oldx,
                oldy,
                x: nx,
                y: ny,
                moved: true,
                petMeal: meal,
                deferredPetEating: true,
                postMoveStatus: MMOVE_MOVED,
                movementStage: 'postmov',
                ...inventoryAction,
            };
        }
        if (cursed && !monster.mleashed && uncursedCount > 0
            && recordRandom(random, calls, 13 * uncursedCount))
            continue;
        // Guardians have no food or fetching state and do not avoid curses.
        // Their backtracking chance therefore counts every candidate square.
        if (!monster.mleashed &&
            distmin(oldx, oldy, state?.u?.ux ?? goal.x, state?.u?.uy ?? goal.y) > 5) {
            const trackSquares = monster.edog ? uncursedCount : candidates.length;
            const trackCount = Math.min(4, Math.max(0, trackSquares - 1));
            let avoid = false;
            for (let j = 0; j < trackCount; j++) {
                const track = monster.mtrack?.[j];
                const trackRange = 4 * (trackSquares - j);
                if (track?.x === nx && track?.y === ny) {
                    if (recordRandom(random, calls, trackRange)) {
                        avoid = true;
                        break;
                    }
                }
            }
            if (avoid)
                continue;
        }
        const ndist = dist2(nx, ny, goal.x, goal.y);
        const direction = (ndist - nidist) * goal.appr;
        let choose = direction < 0;
        if (direction === 0) {
            choose = recordRandom(random, calls, ++chcnt) === 0;
        }
        else if (direction > 0 && !goal.whappr) {
            if (oldx === nix && oldy === niy) {
                choose = recordRandom(random, calls, 3) === 0;
            }
            if (!choose)
                choose = recordRandom(random, calls, 12) === 0;
        }
        if (!choose)
            continue;
        nix = nx;
        niy = ny;
        nidist = ndist;
        selectedInfo = candidate.info;
        reluctant = cursed;
        if (direction < 0)
            chcnt = 0;
    }
    const movePlan = {
        oldx,
        oldy,
        nix,
        niy,
        selectedInfo,
        reluctant,
        inventoryAction,
    };
    const ranged = await performPetRangedAttack(monster, state, { random, rollOne, rollDice, calls });
    if (ranged.status !== MMOVE_NOTHING || ranged.heroDied) {
        return {
            oldx, oldy, x: monster.mx, y: monster.my, moved: false,
            postMoveStatus: ranged.status, movementStage: 'postmov',
            actionCompleted: true, heroDied: ranged.heroDied,
            ...(ranged.attack ? { attack: ranged.attack } : {}),
        };
    }
    return finishPetMovePlan(monster, state, movePlan, random, rollDice, rollOne, calls);
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
        const inLine = hostileLinedUp(monster, state, random, calls)
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
    const candidates = mfndpos(monster, state, allowFlags);
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
        (await stopMonsterHeldByHero(monster, state))) {
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
    if (selected) {
        if (MONSTER_NAME[monster.mnum] === 'hezrou')
            await createPoisonGasCloud(state, oldx, oldy, 1, 8, random);
        else if (MONSTER_NAME[monster.mnum] === 'steam vortex' && !monster.mcan)
            await createPoisonGasCloud(state, oldx, oldy, 1, 0, random);
    }
    monster.mx = nix;
    monster.my = niy;
    if (selected) {
        if (monster.wormno)
            advanceMonsterWormBody(monster, { state, random, rollDice, rollOne });
        if (!Array.isArray(monster.mtrack))
            monster.mtrack = [];
        monster.mtrack.unshift({ x: oldx, y: oldy });
        monster.mtrack.length = Math.min(monster.mtrack.length, 4);
    }
    else {
        if (isUnicorn(monster) && recordRandom(random, calls, 2)
            && !(await reportMonsterTeleportRestriction(monster, { state }))) {
            const relocation = await randomMonsterRelocation(monster, {
                state, calls, random, rollOne, flags: RLOC_MSG,
            });
            // Native m_move() returns MOVED even if rloc() finds no square,
            // and skips postmov() for this fallback.
            return finishMovement(relocation || {
                oldx, oldy, x: oldx, y: oldy, moved: false,
            }, MMOVE_MOVED, 'dochug');
        }
        if (monster.wormno)
            shrinkStationaryMonsterWorm(monster, { rollDice });
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
    if (await disturbMealMimicry(monster, { state }))
        return {};
    const threshold = monsterAttackThreshold(monster, state, rollOne, calls);
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
    }
    sequence.current = null;
    sequence.done = true;
    return null;
}
async function attackHeroWithRangedWeapon(monster, state, random, rollOne, calls, publish) {
    requirePerceivedHero(monster);
    if (await readyRangedMonsterWeapon(monster, state)) {
        return;
    }
    const weapon = selectMonsterRangedWeapon(monster, state)?.weapon;
    if (!weapon)
        return;
    if (isPolearm(weapon)) {
        await attackHeroWithPolearm(monster, weapon, state, { random, rollOne });
        return;
    }
    const returnRange = returningWeaponRangeSquared(weapon);
    const returning = returnRange !== null && !willWeld(weapon);
    if (returning &&
        (dist2(monster.mx, monster.my, monster.mux, monster.muy) > returnRange ||
            !couldsee(monster.mx, monster.my)))
        return;
    if (!hostileLinedUp(monster, state, random, calls))
        return;
    const heroX = state?.u?.ux ?? monster.mx;
    const heroY = state?.u?.uy ?? monster.my;
    const distance = distmin(monster.mx, monster.my, heroX, heroY);
    const previousDistance = distmin(monster.mx, monster.my, state?.u?.ux0 ?? heroX, state?.u?.uy0 ?? heroY);
    if (distance > previousDistance &&
        !returning &&
        recordRandom(random, calls, BOLT_LIM - distmin(monster.mx, monster.my, monster.mux, monster.muy)) !== 0)
        return;
    return await throwMonsterWeaponAtHero(monster, state, weapon, {
        random: (range) => recordRandom(random, calls, range),
        rollOne, publish,
    });
}
function maybeBreatheAtHero(monster, attack, state, random, calls) {
    let damageType = attack[1];
    const dice = attack[2];
    const sides = attack[3];
    if (damageType === AD_RBRE)
        damageType = 1 + recordRandom(random, calls, 8);
    if (!monsterLinedUpWithPerceivedHero(monster, state, random, calls))
        return { launched: false, nativeResult: M_ATTK_HIT };
    if (monster.mcan) {
        return {
            attempted: true,
            launched: false,
            nativeResult: M_ATTK_MISS,
            cough: true,
            damageType,
            dice,
            sides,
        };
    }
    if ((monster.seen_resistance || 0) & (seenResistanceForDamage(damageType) | M_SEEN_REFL))
        return {
            attempted: true,
            launched: false,
            nativeResult: M_ATTK_HIT,
            damageType,
            dice,
            sides,
        };
    if ((monster.mspec_used ?? 0) || recordRandom(random, calls, 3) === 0) {
        return {
            attempted: true,
            launched: false,
            nativeResult: M_ATTK_MISS,
            damageType,
            dice,
            sides,
        };
    }
    const targetX = isFiniteNumber(monster.mux) ? monster.mux : (state?.u?.ux ?? monster.mx);
    const targetY = isFiniteNumber(monster.muy) ? monster.muy : (state?.u?.uy ?? monster.my);
    return {
        attempted: true,
        launched: true,
        nativeResult: M_ATTK_HIT,
        deferredRay: true,
        damageType,
        dice,
        sides,
        targetX,
        targetY,
        x: monster.mx,
        y: monster.my,
        dx: Math.sign(targetX - monster.mx),
        dy: Math.sign(targetY - monster.my),
    };
}
// C ref: mkmaze.c:fumaroles(). Lava vents leave damaging gas even though
// fire striking water leaves harmless steam.
export async function fumaroles(state = requireInitializedGame()) {
    let cloudCount = rn2(3);
    let minimumSize = 5;
    if (Is_firelevel(state.u?.uz)) {
        cloudCount++;
        minimumSize += 5;
    }
    if ((state.level?.flags?.temperature || 0) > 0) {
        cloudCount++;
        minimumSize += 5;
    }
    let heard = false;
    let loud = false;
    for (let count = cloudCount; count > 0; count--) {
        const x = rn2(COLNO - 4) + 3;
        const y = rn2(ROWNO - 4) + 3;
        if (state.level?.at?.(x, y)?.typ !== LAVAPOOL)
            continue;
        const cloud = await createPoisonGasCloud(state, x, y, rn2(10) + minimumSize, rn2(10) + 5);
        if (cloud)
            cloud.heroFault = false;
        heard = true;
        const dx = x - (state.u?.ux ?? 0);
        const dy = y - (state.u?.uy ?? 0);
        if (dx * dx + dy * dy < 15)
            loud = true;
    }
    if (heard && !heroIsDeaf(state))
        await plineWithContinuation(`You hear a ${loud ? 'loud ' : ''}whoosh!`, { noRepeat: true });
    return { heard, loud };
}
// Finish breamm() in the same actor transaction across ray message input.
export async function resolveDeferredMonsterBreath(action, breath, state, emitMessage, random = rn2, rollDice = d, rollOne = rnd) {
    if (!breath?.launched || !breath.deferredRay)
        return breath || null;
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
function pointsOnline(x0, y0, x1, y1) {
    const dx = x0 - x1;
    const dy = y0 - y1;
    return !dx || !dy || dy === dx || dy === -dx;
}
function sameDungeonLevel(a, b) {
    return !!a && !!b && a.dnum === b.dnum && a.dlevel === b.dlevel;
}
// C priest.c:move_special(). Source MOVED also covers breaking a boulder
// or attacking another monster without changing the mover's coordinates.
async function moveSpecial(monster, state, random, rollDice, rollOne, calls, { inHisShop, approach, heroOnDoor, avoid, goalX, goalY, }) {
    const oldx = monster.mx, oldy = monster.my;
    const movement = {
        oldx,
        oldy,
        x: oldx,
        y: oldy,
        moved: false,
        postMoveStatus: MMOVE_NOTHING,
        movementStage: 'postmov',
    };
    if (oldx === goalX && oldy === goalY)
        return movement;
    if (monster.mconf) {
        avoid = false;
        approach = 0;
    }
    const candidates = mfndpos(monster, state, monAllowFlags(monster, state, rollOne, calls));
    if (monster.isshk &&
        avoid &&
        heroOnDoor &&
        !candidates.some((candidate) => !(candidate.info & NOTONL)))
        avoid = false;
    const pickMove = (avoidOnline) => {
        let selected = { x: oldx, y: oldy, info: 0 };
        let choiceCount = 0;
        for (const candidate of candidates) {
            if (!(IS_ROOM(state.level.at(candidate.x, candidate.y)?.typ ?? STONE) ||
                (monster.isshk && (!inHisShop || monster.eshk?.following))))
                continue;
            if (avoidOnline && candidate.info & NOTONL && !(candidate.info & ALLOW_M))
                continue;
            const better = !approach
                ? recordRandom(random, calls, ++choiceCount) === 0
                : dist2(candidate.x, candidate.y, goalX, goalY) <
                    dist2(selected.x, selected.y, goalX, goalY);
            if (better || candidate.info & ALLOW_M)
                selected = candidate;
        }
        return selected;
    };
    let selected = pickMove(avoid);
    if (monster.ispriest &&
        avoid &&
        selected.x === oldx &&
        selected.y === oldy &&
        pointsOnline(oldx, oldy, state.u.ux, state.u.uy))
        selected = pickMove(false);
    if (selected.x === oldx && selected.y === oldy)
        return movement;
    if (selected.info & ALLOW_ROCK) {
        await breakMonsterBoulder(monster, selected.x, selected.y, state, { random });
        movement.postMoveStatus = MMOVE_MOVED;
        return movement;
    }
    if (selected.info & ALLOW_M) {
        const combat = await moveMonsterAggress(monster, selected.x, selected.y, state, random, rollDice, rollOne, calls);
        return {
            ...movement,
            ...combat,
            postMoveStatus: combat.postMoveStatus === MMOVE_DIED ? MMOVE_DIED : MMOVE_MOVED,
        };
    }
    if (monsterAtPosition(state.level, selected.x, selected.y) ||
        (selected.x === state.u.ux && selected.y === state.u.uy))
        return movement;
    placeMonsterAt(monster, selected.x, selected.y);
    if (state === game)
        newsym(selected.x, selected.y);
    if (monster.isshk && !inHisShop && shopkeeperInOwnShop(monster, state))
        await checkSpecialRoom();
    return {
        ...movement,
        x: selected.x,
        y: selected.y,
        moved: true,
        postMoveStatus: MMOVE_MOVED,
    };
}
function specialMoverSeesHero(monster, state) {
    const seesInvisible = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS);
    return (monster.mcansee !== 0 &&
        monster.mcansee !== false &&
        (!heroIsInvisible(state) || seesInvisible) &&
        !state.u.uinwater &&
        couldSeeFromHero(state, monster.mx, monster.my));
}
async function movePriest(monster, state, random, rollDice, rollOne, calls) {
    if (!priestIsInOwnTemple(monster, state))
        return null;
    const epri = monster.epri || monster.mextra?.epri;
    if (!epri)
        throw new Error('A temple priest must retain its temple state');
    let goalX = epri.shrpos.x + recordRandom(random, calls, 3) - 1;
    let goalY = epri.shrpos.y + recordRandom(random, calls, 3) - 1;
    let avoid = true;
    if (!monster.mpeaceful ||
        (heroHasConflict(state) && !resistConflict(monster, state, rollOne, calls))) {
        const dx = monster.mx - state.u.ux;
        const dy = monster.my - state.u.uy;
        if (dx * dx + dy * dy < 3 &&
            (MONSTER_NAME[monster.mnum] !== 'grid bug' || dx === 0 || dy === 0)) {
            if (heroIsDisplaced(state)) {
                await plineWithContinuation(`Your displaced image doesn't fool ${canonicalMonsterName(monster, { state })}!`);
            }
            return {
                oldx: monster.mx,
                oldy: monster.my,
                x: monster.mx,
                y: monster.my,
                moved: false,
                priest: true,
                postMoveStatus: MMOVE_NOTHING,
                movementStage: 'postmov',
                deferredAfterSpecialAttack: true,
                ...(await beginMonsterHeroAttack(monster, state, random, rollOne, rollDice, calls)),
            };
        }
        if (state.u.urooms.includes(epri.shroom)) {
            if (specialMoverSeesHero(monster, state)) {
                goalX = state.u.ux;
                goalY = state.u.uy;
            }
            avoid = false;
        }
    }
    else if (heroIsInvisible(state)) {
        avoid = false;
    }
    const movement = await moveSpecial(monster, state, random, rollDice, rollOne, calls, {
        inHisShop: false,
        approach: 1,
        heroOnDoor: false,
        avoid,
        goalX,
        goalY,
    });
    return { ...movement, priest: true };
}
// C shk.c:shk_move() chooses a goal before move_special() selects a square.
async function moveShopkeeper(monster, state, random, rollDice, rollOne, calls) {
    if (!monster.isshk || !hasShopkeeperData(monster))
        return null;
    const oldx = monster.mx;
    const oldy = monster.my;
    if (shopkeeperInOwnShop(monster, state))
        await shopkeeperRepairsDamage(monster, state);
    const eshk = monster.eshk;
    const heroX = state.u.ux;
    const heroY = state.u.uy;
    const distance = dist2(oldx, oldy, heroX, heroY);
    const home = eshk.shk;
    const atHome = oldx === home.x && oldy === home.y;
    const stopped = {
        oldx,
        oldy,
        x: oldx,
        y: oldy,
        moved: false,
        postMoveStatus: MMOVE_NOTHING,
        movementStage: 'postmov',
        shopkeeper: true,
    };
    if (distance < 3 &&
        (MONSTER_NAME[monster.mnum] !== 'grid bug' || oldx === heroX || oldy === heroY)) {
        if (!monster.mpeaceful ||
            (heroHasConflict(state) && !resistConflict(monster, state, rollOne, calls))) {
            if (heroIsDisplaced(state)) {
                await plineWithContinuation(`Your displaced image doesn't fool ${shopkeeperName(monster, { state })}!`);
            }
            return {
                ...stopped,
                deferredAfterSpecialAttack: true,
                ...(await beginMonsterHeroAttack(monster, state, random, rollOne, rollDice, calls)),
            };
        }
        if (eshk.following) {
            if ((eshk.customer ?? '').slice(0, PL_NSIZ) !== state.plname.slice(0, PL_NSIZ)) {
                if (!heroIsDeaf(state) && !shopkeeperIsMuted(monster)) {
                    await plineWithContinuation(`"${shopGreeting(monster, state)}, ${state.plname}!  I was looking for ${eshk.customer}."`);
                }
                eshk.following = false;
                return stopped;
            }
            if (state.moves > (state._shopFollowMessageTurn ?? 0) + 4) {
                if (!heroIsDeaf(state) && !shopkeeperIsMuted(monster)) {
                    await plineWithContinuation(`"${shopGreeting(monster, state)}, ${state.plname}!  Didn't you forget to pay?"`);
                }
                else {
                    await plineWithContinuation(`${shopkeeperName(monster, { state, capitalized: true })} holds out ${monsterPossessive(monster, { state, random, noIt: true })} upturned ${monsterHandName(monster.mnum)}.`);
                }
                state._shopFollowMessageTurn = state.moves;
                if (!recordRandom(random, calls, 9)) {
                    await plineWithContinuation(`${shopkeeperName(monster, { state, capitalized: true })} doesn't like customers who don't pay.`);
                    rileShopkeeper(monster);
                }
            }
            if (distance < 2)
                return stopped;
        }
    }
    let goalX = home.x;
    let goalY = home.y;
    let approach = 1;
    let heroOnDoor = false;
    let avoid = false;
    const holeTime = eshk.following ? -1 : diggingTimeToHole(state);
    if (eshk.following || (holeTime >= 0 && holeTime * holeTime <= distance)) {
        if (distance > 4 && eshk.following && !eshk.billct)
            return null;
        goalX = heroX;
        goalY = heroY;
    }
    else if (!monster.mpeaceful) {
        if (specialMoverSeesHero(monster, state)) {
            goalX = heroX;
            goalY = heroY;
        }
    }
    else if (!heroIsInvisible(state) && !state.u.usteed) {
        heroOnDoor = heroX === eshk.shd.x && heroY === eshk.shd.y;
        let hasDiggingTool = false;
        if (heroOnDoor) {
            const isPick = (object) => object.otyp === PICK_AXE || object.otyp === DWARVISH_MATTOCK;
            hasDiggingTool =
                state.inventory.some(isPick) ||
                    !!((state.u.fast || state.u.veryFast) &&
                        state.level.objects[heroX]?.[heroY]?.some(isPick));
            if (atHome && hasDiggingTool)
                return stopped;
            avoid = !hasDiggingTool;
        }
        else {
            avoid = state.u.ushops.length > 0 && dist2(heroX, heroY, home.x, home.y) > 8;
        }
        if (((!eshk.robbed && !eshk.billct && !eshk.debit) || avoid) &&
            dist2(oldx, oldy, home.x, home.y) < 3) {
            if (!hasDiggingTool && !pointsOnline(oldx, oldy, heroX, heroY))
                return stopped;
            if (atHome)
                approach = goalX = goalY = 0;
        }
    }
    const movement = await moveSpecial(monster, state, random, rollDice, rollOne, calls, {
        inHisShop: shopkeeperInOwnShop(monster, state),
        approach,
        heroOnDoor,
        avoid,
        goalX,
        goalY,
    });
    return { ...movement, shopkeeper: true };
}
function trapAtMonster(monster, state) {
    return trapAt(state, monster.mx, monster.my);
}
async function placeAndStackTrapMissile(object, state, x, y) {
    // A trap missile is a fresh unbilled projectile with no nested
    // crysknife; the synchronous placement keeps the deferred-resume path
    // free of awaits.
    placeObjectSynchronously(object, x, y, state);
    return await stack_object(object, state);
}
async function triggerMonsterTrap(monster, state, movement, random, rollDice, rollOne, calls, publish = plineWithContinuation) {
    const trap = trapAtMonster(monster, state);
    if (!trap || monster.mtrapped)
        return null;
    const sokobanFall = state.level.flags.sokoban_rules && !trap.madeby_u
        && [PIT, SPIKED_PIT, HOLE, TRAPDOOR].includes(trap.ttyp);
    const fixedTeleport = trap.ttyp === TELEP_TRAP && trap.teledest
        && isok(trap.teledest.x, trap.teledest.y);
    const forced = movement.forcedTrapLanding || fixedTeleport;
    if (monster !== state.u.usteed && !sokobanFall && !forced) {
        if (monsterFliesOrFloats(monster) && trapTriggeredByFloor(trap))
            return null;
        const alreadyKnown = monsterKnowsTrap(monster, trap)
            || trap.ttyp === HOLE && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_MINDLESS);
        if (alreadyKnown && recordRandom(random, calls, 4) !== 0
            && !movement.forcedTrapBungle) {
            const event = { kind: 'known-trap-avoided', trap, damage: 0 };
            movement.trap = event;
            return event;
        }
    }
    monsterLearnsTrap(monster, trap);
    monstersSeeTrap(state, trap);
    if (trap.madeby_u && rnl(5))
        await angerMonster(monster);
    if (trap.ttyp === STATUE_TRAP) {
        // C mintrap() teaches the type before trapeffect_statue_trap()
        // declines to animate statues for monsters.
        return null;
    }
    if (trap.ttyp === MAGIC_PORTAL) {
        const event = await teleportMonsterThroughPortal(monster, trap, {
            state, random, force: !!movement.forcedTrapLanding, publish,
        });
        if (event) {
            movement.trap = event;
            movement.actorLeftLevel = true;
            movement.postMoveStatus = MMOVE_DIED;
            movement.actionCompleted = true;
        }
        return event;
    }
    if (trap.ttyp === LEVEL_TELEP) {
        const event = await teleportMonsterToRandomLevel(monster, trap, {
            state, random, rollOne, force: !!movement.forcedTrapLanding,
        });
        if (event) {
            movement.trap = event;
            movement.actorLeftLevel = true;
            movement.postMoveStatus = MMOVE_DIED;
            movement.actionCompleted = true;
        }
        return event;
    }
    if (trap.ttyp === TELEP_TRAP) {
        const event = await teleportMonsterFromTrap(monster, trap, {
            state,
            calls,
            random,
            rollOne,
            publish,
        });
        movement.trap = event;
        movement.postMoveStatus = MMOVE_DIED;
        movement.actionCompleted = true;
        if (event.relocation) {
            movement.x = event.relocation.x;
            movement.y = event.relocation.y;
            movement.moved = movement.oldx !== movement.x || movement.oldy !== movement.y;
        }
        return event;
    }
    if (trap.ttyp === RUST_TRAP) {
        const event = await beginMonsterRustTrap(monster, trap, state, {
            random: (range) => recordRandom(random, calls, range),
        });
        movement.trap = event;
        movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === PIT || trap.ttyp === SPIKED_PIT) {
        const event = beginMonsterPitTrap(monster, trap, state, {
            forced: !!movement.forcedTrapLanding,
        });
        if (!event)
            return null;
        movement.trap = event;
        movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === HOLE || trap.ttyp === TRAPDOOR) {
        // mintrap() handles avoidance and learning before trapeffect_hole()
        // discovers that this level has nowhere to fall.
        if (!canFallThrough(state.u.uz))
            return null;
        const clinging = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_CLING) && levelHasCeiling(state);
        const airborne = monsterFliesOrFloats(monster) || clinging;
        const tooLarge = (MONSTER_SIZE[monster.mnum] ?? 2) >= 4;
        const longWorm = !!monster.wormno && (monster.wormSegments?.length ?? 0) > 5;
        if (airborne || tooLarge || longWorm) {
            const seen = canSeeMonster(monster) || monster === state.u.usteed;
            if (movement.forcedTrapLanding && !state.level.flags.sokoban_rules) {
                if (seen) {
                    seeTrap(trap, state);
                    await publish(trap.ttyp === TRAPDOOR
                        ? `A trap door opens, but ${canonicalMonsterName(monster, { state })} doesn't fall through.`
                        : `${canonicalMonsterName(monster, { state, capitalized: true })} doesn't fall through the hole.`);
                }
                return null;
            }
            if (!movement.forcedTrapLanding && !sokobanFall)
                return null;
            if (seen) {
                await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} seems to be yanked down!`);
                seeTrap(trap, state);
            }
        }
        const event = await teleportMonsterThroughHole(monster, trap, {
            state, force: !!movement.forcedTrapLanding, publish,
        });
        if (!event)
            return null;
        movement.trap = event;
        movement.actorLeftLevel = true;
        movement.postMoveStatus = MMOVE_DIED;
        movement.actionCompleted = true;
        return event;
    }
    if (trap.ttyp === ROLLING_BOULDER_TRAP) {
        // trap.c:trapeffect_rolling_boulder_trap()->launch_obj().  Airborne
        // actors do not depress the trigger even when forced.
        if (monsterInAir(monster, state))
            return null;
        const inSight = state.u.usteed === monster
            || cansee(monster.mx, monster.my) && canSpotMonster(monster);
        const wasSeen = !!trap.tseen;
        newsym(monster.mx, monster.my);
        if (inSight)
            await publish(`${heroIsDeaf(state) ? '' : 'Click!  '}${canonicalMonsterName(monster, { state, capitalized: true })} triggers ${wasSeen ? 'a rolling boulder trap' : 'something'}.`);
        const launch = trap.launch;
        const endpoint = trap.launch2 ?? launch;
        const released = await launchRollingBoulder(launch, endpoint, {
            state, unseen: !inSight, publish, random, rollOne, rollDice,
        });
        if (released && inSight)
            trap.tseen = true;
        const event = {
            kind: 'rolling-boulder', trap,
            released, killed: !!monster.dead || monster.mhp <= 0,
            heroDied: !!state.program_state.gameover,
        };
        movement.trap = event;
        if (event.killed) {
            movement.actorDied = true;
            movement.postMoveStatus = MMOVE_DIED;
            movement.actionCompleted = true;
        }
        return event;
    }
    if (trap.ttyp === SQKY_BOARD) {
        const event = beginMonsterSqueakyBoard(monster, trap, state);
        if (!event)
            return null;
        movement.trap = event;
        movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === SLP_GAS_TRAP) {
        const event = beginMonsterSleepGasTrap(monster, trap, state, {
            rollOne: (range) => {
                const result = rollOne(range);
                calls.push(`rnd(${range})`);
                return result;
            },
        });
        movement.trap = event;
        if (sleepGasTrapNeedsResume(event))
            movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === ARROW_TRAP || trap.ttyp === DART_TRAP) {
        const event = await beginMonsterProjectileTrap(monster, trap, state, {
            random: (range) => recordRandom(random, calls, range),
            rollOne: (range) => {
                const result = rollOne(range);
                calls.push(`rnd(${range})`);
                return result;
            },
        });
        movement.trap = event;
        if (projectileTrapNeedsResume(event))
            movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === ROCKTRAP) {
        const event = await beginMonsterRockTrap(monster, trap, state, {
            random: (range) => recordRandom(random, calls, range),
            rollDice: (count, sides) => {
                const result = rollDice(count, sides);
                calls.push(`d(${count},${sides})`);
                return result;
            },
        });
        movement.trap = event;
        if (rockTrapNeedsResume(event))
            movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === LANDMINE) {
        const event = beginMonsterLandMine(monster, trap, state, {
            random: (range) => recordRandom(random, calls, range),
            rollOne: (range) => {
                const result = rollOne(range);
                calls.push(`rnd(${range})`);
                return result;
            },
        });
        movement.trap = event;
        if (landMineNeedsResume(event))
            movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === FIRE_TRAP) {
        const event = beginMonsterFireTrap(monster, trap, state, {
            rollDice: (count, sides) => {
                const result = rollDice(count, sides);
                calls.push(`d(${count},${sides})`);
                return result;
            },
        });
        movement.trap = event;
        movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === WEB) {
        // trap.c:mintrap() checks learned-trap avoidance, then projects trap
        // knowledge, before delegating to trapeffect_web().  Only the effect
        // discovers that webmakers cross safely, so they still learn an
        // unknown web and own later avoidance probes.
        if ([94, 96].includes(monster.mnum))
            return null;
        const { inSight } = monsterTrapVisibility(monster, state);
        const event = {
            kind: 'web-trap',
            trap,
            visible: inSight,
            damage: 0,
            killed: false,
        };
        movement.trap = event;
        movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === MAGIC_TRAP) {
        // mintrap() still triggers traps which m_harmless_trap() allowed the
        // monster to enter.  A monster which has learned this trap type gets
        // the ordinary 3-in-4 avoidance check before the effect selector.
        const fire = recordRandom(random, calls, 21) === 0;
        if (fire) {
            const event = beginMonsterFireTrap(monster, trap, state, {
                rollDice: (count, sides) => {
                    const result = rollDice(count, sides);
                    calls.push(`d(${count},${sides})`);
                    return result;
                },
            });
            movement.trap = event;
            movement.deferredAfterMonsterTrap = true;
            return event;
        }
        const event = {
            kind: 'magic-trap',
            trap,
            damage: 0,
            killed: false,
        };
        movement.trap = event;
        return event;
    }
    if (trap.ttyp === ANTI_MAGIC) {
        const effect = applyMonsterAntiMagicTrap(monster, {
            trap, state,
            rollDice: (count, sides) => {
                const result = rollDice(count, sides);
                calls.push(`d(${count},${sides})`);
                return result;
            },
            rollOne: (sides) => {
                const result = rollOne(sides);
                calls.push(`rnd(${sides})`);
                return result;
            },
        });
        const { inSight, seeSquare } = monsterTrapVisibility(monster, state);
        const event = {
            trap,
            ...effect,
            inSight,
            seeSquare,
            visible: inSight,
        };
        if (inSight && effect.energyDrain > 0)
            movement.deferredAfterMonsterTrap = true;
        if (effect.kind === 'anti-magic-damage')
            movement.deferredAfterMonsterTrap = true;
        if (effect.killed) {
            movement.actorDied = true;
            movement.actionCompleted = true;
        }
        movement.trap = event;
        return event;
    }
    if (trap.ttyp === POLY_TRAP) {
        const event = await applyMonsterPolymorphTrap(monster, trap, state, {
            random: (range) => recordRandom(random, calls, range),
        });
        movement.trap = event;
        if (!event.finished)
            movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === VIBRATING_SQUARE) {
        const event = beginMonsterVibratingSquare(monster, trap, state);
        movement.trap = event;
        if (!event.finished)
            movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp !== BEAR_TRAP)
        return null;
    const event = beginMonsterBearTrap(monster, trap, state, {
        forced: !!movement.forcedTrapLanding,
    });
    movement.trap = event;
    if (!event.finished || event.forced)
        movement.deferredAfterMonsterTrap = true;
    return event;
}
// C trap.c:mintrap() entry for actors placed by a source effect rather than
// by m_move()/postmov().  The trap engine remains the single state/RNG owner;
// this boundary intentionally does not run tunneling, pickup, concealment,
// distfleeck(), or an attack tail.  Callers must present and resume any
// deferred trap event before continuing their own source transaction.
export async function triggerImmediateMonsterTrap(monster, state = requireInitializedGame(), { inAir = false, force = false, forceBungle = false, random = rn2, rollDice = d, rollOne = rnd, publish = plineWithContinuation, } = {}) {
    const calls = DISCARDED_CALL_LOG;
    const movement = {
        oldx: monster?.mx,
        oldy: monster?.my,
        x: monster?.mx,
        y: monster?.my,
        moved: false,
        immediateTrap: true,
        forcedTrapLanding: force,
        forcedTrapBungle: forceBungle,
    };
    const trap = trapAtMonster(monster, state);
    if (!trap) {
        monster.mtrapped = 0;
        return { monster, movement, event: null, calls };
    }
    const floorTriggered = trapTriggeredByFloor(trap);
    const sokobanFall = state.level.flags.sokoban_rules &&
        !trap.madeby_u &&
        [PIT, SPIKED_PIT, HOLE, TRAPDOOR].includes(trap.ttyp);
    if (inAir && floorTriggered && !sokobanFall)
        return { monster, movement, event: null, calls };
    if (monster.mtrapped) {
        movement.escapingTrap = true;
        return { monster, movement, event: null, calls };
    }
    const event = await triggerMonsterTrap(monster, state, movement, random, rollDice, rollOne, calls, publish);
    return { monster, movement, event, calls };
}
// Complete mintrap() for a source effect without running a movement tail.
export async function finishImmediateMonsterTrap(action, state = requireInitializedGame(), { publish = plineWithContinuation, random = rn2, rollOne = rnd, rollDice = d, finishDeath, describeMonster } = {}) {
    if (action.movement.escapingTrap)
        return action;
    if (action.event?.kind === 'rolling-boulder')
        return action;
    await resumeDeferredMonsterTrap(action, state, {
        publish, random, rollOne, rollDice,
        ...(finishDeath ? { finishDeath } : {}),
        ...(describeMonster ? { describeMonster } : {}),
    });
    return action;
}
// C steal.c:steal().  Inventory stacks are candidates as objects rather than
// by quantity.  Worn armor and accessories receive five tickets; weapons
// (including the primary and alternate weapon) still receive one.  Keep
// selection after an animal's hit message and before removal prose.
export function selectHeroItemForTheft(state, random, calls) {
    const inventory = state?.inventory || [];
    const wornObjects = new Set([
        state?.uarm,
        state?.uarmc,
        state?.uarmh,
        state?.uarms,
        state?.uarmg,
        state?.uarmf,
        state?.uarmu,
        state?.uleft,
        state?.uright,
        state?.uamul,
        state?.ublindf,
        state?.u?.uleft,
        state?.u?.uright,
    ].filter(Boolean));
    const candidates = [];
    let total = 0;
    for (const object of inventory) {
        if (object === state?.uskin || (object?.oclass ?? object?.class) === COIN_CLASS)
            continue;
        // When body armor is present, steal() omits the cloak from this
        // weighted pass; its later equipment-dependency rewrites remain
        // separate from candidate weighting.
        if (state?.uarm && object === state?.uarmc)
            continue;
        const wornMask = object?.owornmask ?? 0;
        const weighted = wornObjects.has(object) || !!(wornMask & (W_ARMOR | W_ACCESSORY));
        const weight = weighted ? 5 : 1;
        candidates.push({ object, weight });
        total += weight;
    }
    if (!total)
        return null;
    let ticket = recordRandom(random, calls, total);
    for (const candidate of candidates) {
        ticket -= candidate.weight;
        if (ticket < 0) {
            return theftEquipmentTarget(candidate.object, state);
        }
    }
    return null;
}
function theftEquipmentTarget(object, state) {
    if ((object === state.uleft || object === state.uright) && state.uarmg)
        object = state.uarmg;
    if (object === state.uarmg && state.uwep)
        return state.uwep;
    if (object === state.uarm && state.uarmc)
        return state.uarmc;
    if (object === state.uarmu)
        return state.uarmc || state.uarm || object;
    return object;
}
// C do_wear.c:some_armor().  Torso priority is deterministic; each later
// occupied slot gets an independent one-in-four replacement opportunity.
function selectHeroDisenchantmentTarget(state, random, calls) {
    let object = state?.uarmc || state?.uarm || state?.uarmu || null;
    for (const candidate of [state?.uarmh, state?.uarmg, state?.uarmf, state?.uarms]) {
        if (candidate && (!object || recordRandom(random, calls, 4) === 0)) {
            object = candidate;
        }
    }
    if (object)
        return object;
    const fallback = recordRandom(random, calls, 5);
    return ([
        null,
        state?.uright || state?.u?.uright,
        state?.uleft || state?.u?.uleft,
        state?.uamul || state?.u?.uamul,
        state?.ublindf || state?.u?.ublindf,
    ][fallback] || null);
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
    if (attackType !== AT_MAGC && distant)
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
            map_invisible(monster.mx, monster.my);
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
                    what = objectDescription(object, { state });
                }
                const name = canonicalMonsterName(monster, { state, article: 'a', capitalized: true });
                return {
                    kind: 'hero-attack', roll, threshold, hit,
                    attackType, damageType, attackIndex,
                    deferredRevealUnder: true,
                    revealUnderMessage: `${name === 'It' ? 'Something' : name} was hidden under ${what}!`,
                };
            }
            newsym(monster.mx, monster.my);
        }
    }
    // gulpmu() has its own roll; every successful contact enters hitmu()
    // once, including harmless touches and unsupported special effects.
    let damage = 0;
    if (hit) {
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
        state.u.ustuck = monster;
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
        damage = await resolveMonsterWeaponContact(monster, contactWeapon, damage, state, plineWithContinuation, rollOne);
        await erodeAttackingWeapon(state.u, contactWeapon, { state, random });
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
            effect: 'physical-weapon',
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
        const blindfolded = !!(state?.ublindf || state?.u?.ublindf);
        const noEyes = !heroHasEyes(state);
        const helmet = state?.uarmh || state?.u?.uarmh;
        const visored = /visored helmet/i.test(helmet?.description || helmet?.appearance || helmet?.name || '');
        const blindApplicable = !blindfolded && !noEyes && !visored;
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
        attack.fireEffectMessage = `You're ${monsterFireDescription({ mnum: heroSpecies(state) }, attack.attackType)}!`;
        if (state.u.fireResistance) {
            attack.damage = 0;
            attack.fireResistanceMessage = "The fire doesn't feel hot!";
        }
    }
    if (!attack.negated && clearHeroSliming(state)) {
        attack.slimeBurnedMessage = 'The slime that covers you is burned away!';
    }
    attack.deferredFireInventory = !attack.negated;
    if (attack.negated)
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
export function resumeDeferredHeroStun(action, state, random = rn2) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-attack' || !attack.deferredStunGate)
        return action;
    if (!action.monster?.mcan && recordRandom(random, action.calls, 4) === 0) {
        const oldTurns = state.u?.stunnedTurns ?? 0;
        state.u.stunnedTurns = oldTurns + Math.max(0, attack.damage ?? 0);
        state.u.stunned = state.u.stunnedTurns > 0;
        if (!oldTurns && state.u.stunnedTurns)
            state.context.botl = true;
        if (oldTurns === 0)
            attack.stunMessage = 'You stagger...';
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
        (await applyMonsterStoningAttack(action.monster, { state, random, publish }))) {
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
        state.u.ustuck = action.monster;
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
        state._helplessTurns = 1;
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
// Resume castmu() after the casting line.  Damage is pre-rolled before the
// concrete effect line, but not before a casting line which itself pages.
export function rollDeferredHeroSpellDamage(action, state, rollDice = d) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-spell' || !attack.deferredSpellDamage)
        return attack;
    if (attack.spellDice === undefined || attack.spellSides === undefined)
        throw new Error('A deferred spell damage roll needs its selected dice');
    // Undirected spells still produce their effects when aimed at a false
    // position. Native castmu() passes zero damage without rolling dice.
    let damage = 0;
    if (attack.spellDice > 0) {
        damage = rollDice(attack.spellDice, attack.spellSides);
        action.calls.push(`d(${attack.spellDice},${attack.spellSides})`);
    }
    if (heroHasHalfSpellDamage(state))
        damage = Math.trunc((damage + 1) / 2);
    attack.damage = damage;
    attack.deferredSpellDamage = false;
    if (attack.damageType === AD_FIRE || attack.damageType === AD_COLD || attack.damageType === AD_MAGM) {
        attack.spellEffectMessage = attack.damageType === AD_FIRE ? "You're enveloped in flames."
            : attack.damageType === AD_COLD ? "You're covered in frost."
                : 'You are hit by a shower of missiles!';
        return attack;
    }
    const spell = (attack.damageType === AD_CLRC ? MONSTER_CLERIC_SPELLS : MONSTER_WIZARD_SPELLS).find((candidate) => candidate.key === attack.spell);
    if (!spell)
        throw new Error('A deferred spell must retain its selected native spell');
    const preview = monsterSpellEffectPreview(spell, damage, state);
    attack.effectDamage = preview.effectDamage;
    attack.spellEffectMessage = preview.effectMessage;
    return attack;
}
// mdamageu() subtracts from the active body. Keep raw HP for tty's -1
// sentinel; the presenter owns rehumanization and fatal input afterward.
export function applyHeroSpellDamage(attack, damage, state) {
    const hpKey = Upolyd(state.u) ? 'mh' : 'uhp';
    const hpBefore = state.u[hpKey];
    state.context.botl = true;
    const hpMax = hpKey === 'mh' ? state.u.mhmax : state.u.uhpmax;
    state.u[hpKey] = Math.min(hpMax, hpBefore - damage);
    attack.appliedDamage = damage;
    attack.rehumanize = hpKey === 'mh' && state.u.mh < 1;
    attack.heroDied = hpKey === 'uhp' && state.u.uhp < 1;
}
// Resume the selected mcast_spell() effect after its visible message.
export function resumeDeferredHeroSpell(action, state, random = rn2, rollOne = rnd) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-spell' || !attack.deferredSpellEffect)
        return null;
    attack.deferredSpellEffect = false;
    if (attack.spell === 'paralyze') {
        const resisted = !!(state.u?.antimagic || heroHasFreeAction(state));
        const monsterLevel = action.monster?.m_lev ?? MONSTER_LEVEL[action.monster?.mnum] ?? 0;
        let duration = resisted ? 1 : 4 + monsterLevel;
        if (heroHasHalfSpellDamage(state))
            duration = Math.trunc((duration + 1) / 2);
        const existingDelay = Math.max(0, state._helplessTurns ?? 0, -state.multi);
        if (duration >= existingDelay) {
            if (!existingDelay)
                state.context.botl = true;
            state.u.invulnerable = false;
            state.u.usleep = 0;
            state.multi = -duration;
            state._helplessTurns = duration;
            stopRun(state);
            state._cannedCommands = [];
        }
        state._helplessReason = 'paralyzed by a monster';
        state._helplessDoneMessage = null;
        applyHeroSpellDamage(attack, duration, state);
        attack.paralyzed = true;
        if (!resisted)
            monstersForgetHeroResistance(M_SEEN_MAGR, state);
        return attack;
    }
    if (attack.spell === 'confuse-you') {
        const antimagic = !!state.u?.antimagic;
        if (!antimagic) {
            const monsterLevel = action.monster?.m_lev ?? MONSTER_LEVEL[action.monster?.mnum] ?? 0;
            let duration = monsterLevel;
            if (heroHasHalfSpellDamage(state))
                duration = Math.trunc((duration + 1) / 2);
            if (!state.u.confusionTurns && duration)
                state.context.botl = true;
            state.u.confusionTurns = (state.u.confusionTurns ?? 0) + duration;
        }
        attack.appliedDamage = 0;
        attack.confusedHero = !antimagic;
        return attack;
    }
    if (attack.spell === 'cure-self') {
        const healing = d(3, 6);
        action.calls.push('d(3,6)');
        const monster = action.monster;
        monster.mhp = Math.min(monster.mhpmax ?? monster.mhp ?? healing, (monster.mhp ?? 0) + healing);
        attack.appliedDamage = 0;
        attack.healedMonster = healing;
        return attack;
    }
    if (attack.spell === 'disappear') {
        const monster = action.monster;
        setMonsterPermanentInvisibility(monster);
        attack.monsterDisappeared = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'weaken-you') {
        attack.appliedDamage = 0;
        if (state.u?.antimagic)
            return attack;
        const monsterLevel = action.monster?.m_lev ?? MONSTER_LEVEL[action.monster?.mnum] ?? 0;
        let lossSides = Math.max(1, monsterLevel - 6);
        if (heroHasHalfSpellDamage(state))
            lossSides = Math.trunc((lossSides + 1) / 2);
        const amount = rollOne(lossSides);
        action.calls.push(`rnd(${lossSides})`);
        attack.deferredStrengthLoss = {
            amount,
            killer: monsterSpellDeathReason(action.monster, 'strength loss'),
        };
        return attack;
    }
    if (attack.spell === 'summon-monsters') {
        attack.deferredSummonMonsters = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'death-touch') {
        attack.deferredDeathTouch = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'clone-wizard') {
        attack.deferredCloneWizard = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'haste-self') {
        attack.deferredHasteSelf = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'aggravation') {
        attack.deferredAggravation = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'stun-you') {
        const resisted = !!(state.u?.antimagic || heroHasFreeAction(state));
        let duration = 1;
        if (!resisted) {
            const dexterity = currentAttribute(A_DEX, state);
            const dice = dexterity < 12 ? 6 : 4;
            duration = d(dice, 4);
            action.calls.push('d(' + dice + ',4)');
            if (heroHasHalfSpellDamage(state))
                duration = Math.trunc((duration + 1) / 2);
            duration += state.u?.stunnedTurns ?? 0;
        }
        if (!!state.u.stunnedTurns !== !!duration)
            state.context.botl = true;
        state.u.stunnedTurns = duration;
        state.u.stunned = duration > 0;
        attack.stunnedHero = true;
        attack.stunDuration = duration;
        attack.appliedDamage = 0;
        if (!resisted)
            monstersForgetHeroResistance(M_SEEN_MAGR, state);
        return attack;
    }
    if (attack.spell === 'destroy-armor') {
        attack.deferredDestroyArmor = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'fire-pillar') {
        attack.deferredFirePillar = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'lightning') {
        attack.deferredLightningSpell = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'insects') {
        attack.deferredInsectSpell = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'curse-items') {
        attack.deferredCurseItems = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (attack.spell === 'geyser') {
        attack.deferredGeyserSpell = true;
        attack.appliedDamage = 0;
        return attack;
    }
    if (!attack.spell || !['psi-bolt', 'open-wounds'].includes(attack.spell)) {
        attack.unimplementedSpellEffect = true;
        return attack;
    }
    applyHeroSpellDamage(attack, attack.effectDamage ?? attack.damage ?? 0, state);
    return attack;
}
function heroCanSeeInvisible(state) {
    return !!(state?.u?.seeInvisible || (state?.u?.seeInvisibleTurns ?? 0) > 0);
}
function monsterSpellHasAggravatables(caster, state) {
    const inTower = insideWizardTower(caster.mx, caster.my, state);
    if (inTower !== insideWizardTower(state.u.ux, state.u.uy, state))
        return false;
    return state.level.monsters.some((monster) => !monster.dead &&
        (monster.mhp ?? 1) > 0 &&
        insideWizardTower(monster.mx, monster.my, state) === inTower &&
        ((monster.mstrategy ?? 0) & STRAT_WAITFORU ||
            monsterIsHelpless(monster)));
}
function monsterSpellUseless(monster, spell, state, random = rn2, calls = []) {
    if (spell.flags & MCF_HOSTILE && monster.mpeaceful)
        return true;
    if (spell.flags & MCF_SIGHT && !couldsee(monster.mx, monster.my))
        return true;
    if (spell.key === 'cure-self')
        return (monster.mhp ?? 0) >= (monster.mhpmax ?? 0);
    if (spell.key === 'blind-you')
        return heroIsBlinded(state);
    if (spell.key === 'haste-self')
        return monster.permspeed === MFAST;
    if (spell.key === 'disappear') {
        return (!!monster.minvis ||
            !!monster.invis_blkd ||
            // mcastu.c keeps peaceful monsters visible to a hero who lacks
            // See_invisible.  choose_monster_spell() then continues down the
            // same spell table without consuming another selection draw.
            (!!monster.mpeaceful && !heroCanSeeInvisible(state)));
    }
    if (spell.key === 'death-touch') {
        const resisted = !!(state?.u?.antimagic || heroIsHallucinating(state));
        return resisted && recordRandom(random, calls, 2) === 0;
    }
    if (spell.key === 'geyser')
        return recordRandom(random, calls, 5) === 0;
    if (spell.key === 'clone-wizard')
        return !monster.iswiz || (state.context.no_of_wizards ?? 0) > 1;
    if (spell.key === 'aggravation' && !monsterSpellHasAggravatables(monster, state)) {
        return recordRandom(random, calls, 100) !== 0;
    }
    return false;
}
// C mcastu.c:choose_monster_spell().  Selection is observable even when a
// peaceful caster rejects the directed/hostile result and proceeds to move.
function chooseMonsterSpell(monster, damageType, state, random, calls) {
    const list = damageType === AD_CLRC ? MONSTER_CLERIC_SPELLS : MONSTER_WIZARD_SPELLS;
    const lastSpell = list.at(-1);
    if (!lastSpell)
        throw new Error('Native monster spell tables must contain a fallback spell');
    const maxLevel = lastSpell.level;
    let spellValue = recordRandom(random, calls, Math.max(1, monster.m_lev || 1));
    if (spellValue > maxLevel && recordRandom(random, calls, Math.max(1, maxLevel)) !== 0) {
        spellValue = recordRandom(random, calls, Math.max(1, maxLevel));
    }
    for (let index = list.length - 1; index >= 0; index--) {
        const spell = list[index];
        if (spell &&
            spell.level <= spellValue &&
            !monsterSpellUseless(monster, spell, state, random, calls))
            return spell;
    }
    return list[0];
}
function monsterCurseKind(monster, undirected, state, random, calls) {
    if (canSeeMonster(monster) && couldsee(monster.mx, monster.my)) {
        if (undirected)
            return 'visible-undirected';
        const wrongTarget = monster.mux !== state.u.ux || monster.muy !== state.u.uy;
        if (heroIsInvisible(state) && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_SEE_INVIS) && wrongTarget
            || M_AP_TYPE(state.u) === M_AP_OBJECT && state.u.mappearance === 0 || state.u.uundetected)
            return 'visible-general';
        if (heroIsDisplaced(state) && wrongTarget)
            return 'visible-displaced';
        return 'visible-directed';
    }
    if ((!(state.moves % 4) || !recordRandom(random, calls, 4)) && !heroIsDeaf(state))
        return 'audible';
    return null;
}
async function publishMonsterSpellFailure(monster, spell, state, random, calls) {
    const kind = monsterCurseKind(monster, !!(spell.flags & MCF_INDIRECT), state, random, calls);
    if (kind === 'audible')
        await plineWithContinuation('You hear a mumbled curse.', { noRepeat: true });
    else if (kind) {
        const points = kind === 'visible-undirected' ? 'all around, then curses'
            : kind === 'visible-general' ? 'and curses in your general direction'
                : kind === 'visible-displaced' ? 'and curses at your displaced image' : 'at you, then curses';
        await plineWithContinuation(`${canonicalMonsterName(monster, { state, capitalized: true })} points ${points}.`);
    }
}
async function movementSpellSelections(monster, state, random, calls) {
    if (monster.mspec_used ||
        dist2(monster.mx, monster.my, state?.u?.ux ?? monster.mx, state?.u?.uy ?? monster.my) > 49)
        return null;
    for (const [attackType, damageType] of MONSTER_ATTACKS[monster.mnum] || []) {
        if (attackType !== AT_MAGC || (damageType !== AD_CLRC && damageType !== AD_SPEL))
            continue;
        const monsterLevel = monster.m_lev ?? MONSTER_LEVEL[monster.mnum] ?? 0;
        if (!monsterLevel) {
            await publishMonsterSpellFailure(monster, MONSTER_WIZARD_SPELLS[0], state, random, calls);
            continue;
        }
        const spell = chooseMonsterSpell(monster, damageType, state, random, calls);
        if (!spell)
            continue;
        // castmu(FALSE,FALSE) selects once.  Directed or currently-useless
        // spells miss without spending the action; a successful indirect
        // spell bypasses m_move() and owns the whole actor transaction.
        if (!(spell.flags & MCF_INDIRECT) ||
            monsterSpellUseless(monster, spell, state, random, calls))
            continue;
        if (monster.mcan || monster.mspec_used) {
            await publishMonsterSpellFailure(monster, spell, state, random, calls);
            return {
                spell: spell.key,
                cast: false,
                blocked: true,
                damageType,
                directed: false,
            };
        }
        monster.mspec_used = monsterLevel < 8 ? 10 - monsterLevel : 2;
        endVoluntaryMultiTurn(state);
        const fumble = recordRandom(random, calls, Math.max(1, monsterLevel * 10)) <
            (monster.mconf ? 100 : 20);
        if (fumble) {
            if (canSeeMonster(monster) && !heroIsDeaf(state))
                await plineWithContinuation(`The air crackles around ${canonicalMonsterName(monster, { state })}.`);
            return {
                spell: spell.key,
                cast: false,
                fumbled: true,
                damageType,
                directed: false,
            };
        }
        return {
            spell: spell.key,
            cast: true,
            damageType,
            directed: false,
            deferredSpellEffect: true,
        };
    }
    return null;
}
async function monsterSummonSpellEffect(monster, state) {
    let effect = { count: 0, created: [], message: null };
    const summoned = await summonNastyMonsters(monster);
    effect = {
        ...effect,
        // nasty() delegates to msummon(NULL), using the Wizard's demon choices.
        ...(summoned.deferredDemonSummon ? await msummon() : summoned),
    };
    if (effect.count > 0) {
        if (monster?.iswiz) {
            effect.message = `"Destroy the thief, my pet${effect.count === 1 ? '' : 's'}!"`;
        }
        else {
            const one = effect.count === 1;
            const appearance = one ? 'A monster appears' : 'Monsters appear';
            const heroX = state?.u?.ux ?? monster?.mux;
            const heroY = state?.u?.uy ?? monster?.muy;
            const wrongTarget = monster?.mux !== heroX || monster?.muy !== heroY;
            const cannotSeeInvisible = !((MONSTER_FLAGS1[monster?.mnum] ?? 0) & M1_SEE_INVIS);
            if (heroIsInvisible(state) && cannotSeeInvisible && wrongTarget) {
                effect.message = `${appearance} ${one ? 'at' : 'around'} a spot near you!`;
            }
            else if (heroIsDisplaced(state) && wrongTarget) {
                effect.message = `${appearance} ${one ? 'by' : 'around'} your displaced image!`;
            }
            else {
                effect.message = `${appearance} from nowhere!`;
            }
        }
    }
    return effect;
}
export async function resolveDeferredHeroSummonMonsters(action, state) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-spell' || !attack.deferredSummonMonsters)
        return null;
    const effect = await monsterSummonSpellEffect(action.monster, state);
    attack.summonedMonsters = effect.created || [];
    attack.deferredSummonMonsters = false;
    return effect;
}
const WIZARD_CLONE_APPEARANCE_NAMES = [
    'human',
    'water demon',
    'vampire',
    'red dragon',
    'troll',
    'umber hulk',
    'xorn',
    'xan',
    'cockatrice',
    'floating eye',
    'guardian naga',
    'trapper',
];
export async function beginDeferredHeroCloneWizard(action, state) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-spell' || !attack.deferredCloneWizard || attack.cloneWizard)
        return null;
    const clone = await makemonNear(285, state.u.ux, state.u.uy, MM_NOWAIT);
    if (clone)
        attack.cloneWizard = clone;
    else
        attack.deferredCloneWizard = false;
    return clone;
}
export async function finishDeferredHeroCloneWizard(action, state, random = rn2) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-spell' || !attack.deferredCloneWizard)
        return null;
    const clone = attack.cloneWizard;
    if (!clone)
        return null;
    await finishWizardClone(clone, state, random, action.calls);
    attack.deferredCloneWizard = false;
    return clone;
}
async function finishWizardClone(clone, state, random, calls) {
    clone.msleeping = 0;
    clone.mtame = 0;
    clone.mpeaceful = 0;
    if (!state.u?.uhave?.amulet && recordRandom(random, calls, 2) !== 0) {
        const fake = await mksobj(FAKE_AMULET_OF_YENDOR, true, false);
        // wizard.c:clonewiz() uses add_to_minv(), not mpickobj(): a newly
        // minted fake Amulet links directly without carrying effects.
        await linkObjectToMonsterInventory(clone, fake);
    }
    const protectedFromShapechangers = !!state.u?.protectionFromShapeChangers;
    if (!protectedFromShapechangers) {
        const appearanceIndex = recordRandom(random, calls, WIZARD_CLONE_APPEARANCE_NAMES.length);
        clone.m_ap_type = M_AP_MONSTER;
        clone.mappearance = MONSTER_NAME.indexOf(WIZARD_CLONE_APPEARANCE_NAMES[appearanceIndex] ?? '');
    }
    newsym(clone.mx, clone.my);
    return clone;
}
function monsterHasteSelfEffect(monster, state) {
    const speed = adjustMonsterSpeed(monster, 1);
    const message = speed.changed && speed.canDescribe && !state.in_mklev
        && canSeeMonster(monster)
        ? monsterSpeedMessage(speed, canonicalMonsterName(monster, { state, capitalized: true }))
        : null;
    return { message, oldSpeed: speed.oldSpeed, speed: speed.speed };
}
export function resolveDeferredHeroHasteSelf(action, state) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-spell' || !attack.deferredHasteSelf)
        return null;
    const effect = monsterHasteSelfEffect(action.monster, state);
    attack.hasteSelf = effect;
    attack.deferredHasteSelf = false;
    return effect;
}
export function resolveDeferredHeroAggravation(action, state, random = rn2) {
    const attack = action?.movement?.heroAttackSequence?.current;
    if (attack?.kind !== 'hero-spell' || !attack.deferredAggravation)
        return null;
    const affected = aggravateMonsters(state, random);
    attack.aggravatedMonsters = affected;
    attack.deferredAggravation = false;
    return affected;
}
// Resume a successful castmu(FALSE,FALSE) after its casting line has crossed
// the tty boundary.  The source effect can create actors, so it remains async
// and only then returns to dochug() for the second distfleeck/phase-four tail.
export async function resumeDeferredMovementSpell(action, state, random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation) {
    const movement = action?.movement;
    const spellCast = movement?.spellCast;
    if (!movement?.deferredAfterMovementSpell || !spellCast?.deferredSpellEffect)
        return null;
    let effect = { count: 0, created: [], message: null };
    if (spellCast.spell === 'clone-wizard') {
        await publish('Double Trouble...');
        const clone = await makemonNear(285, state.u.ux, state.u.uy, MM_NOWAIT);
        if (clone) {
            await finishWizardClone(clone, state, random, action.calls);
            effect = { count: 1, created: [clone], message: null };
        }
    }
    else if (spellCast.spell === 'cure-self') {
        if (action.monster.mhp < action.monster.mhpmax) {
            if (canSeeMonster(action.monster))
                await publish(`${canonicalMonsterName(action.monster, { state, capitalized: true })} looks better.`);
            action.monster.mhp = Math.min(action.monster.mhpmax, action.monster.mhp + rollDice(3, 6));
        }
    }
    else if (spellCast.spell === 'aggravation') {
        await publish(formatFeltMessage('that monsters are aware of your presence.', state));
        aggravateMonsters(state, random);
    }
    else if (spellCast.spell === 'insects') {
        effect = await summonMonsterInsects(action.monster, state);
    }
    else if (spellCast.spell === 'summon-monsters') {
        effect = await monsterSummonSpellEffect(action.monster, state);
    }
    else if (spellCast.spell === 'haste-self') {
        effect = {
            ...effect,
            ...monsterHasteSelfEffect(action.monster, state),
        };
    }
    else if (spellCast.spell === 'disappear') {
        const monster = action.monster;
        if (canSeeMonster(monster)) {
            const canSeeInvisible = state.u.seeInvisible || (state.u.seeInvisibleTurns ?? 0) > 0;
            await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} suddenly ${canSeeInvisible ? 'becomes transparent' : 'disappears'}!`);
        }
        setMonsterPermanentInvisibility(monster);
        newsym(monster.mx, monster.my);
        if (cansee(monster.mx, monster.my) && !canSpotMonster(monster))
            map_invisible(monster.mx, monster.my);
    }
    else {
        throw new Error(`Directed spell ${spellCast.spell} reached the undirected spell effect`);
    }
    if (effect.message)
        await publish(effect.message);
    spellCast.deferredSpellEffect = false;
    movement.deferredAfterMovementSpell = false;
    movement.spellEffect = effect;
    movement.postMoveStatus = MMOVE_DONE;
    movement.movementStage = 'dochug';
    await finishDochugAfterMovement(action.monster, movement, state, random, rollOne, rollDice, action.calls, requireDochugContext(action));
    return effect;
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
function holdsUpMonsterWeb(x, y, state) {
    const location = state.level.at(x, y);
    if (x < 1 || !location || IS_OBSTRUCTED(location.typ) || location.typ === IRONBARS)
        return true;
    for (let stairs = state.stairs; stairs; stairs = stairs.next)
        if (stairs.sx === x && stairs.sy === y && stairs.up)
            return true;
    return false;
}
function postMoveHideUnder(monster, movement, state, random, calls) {
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
            newsym(monster.mx, monster.my);
    }
    // postmov() redraws even when hideunder() leaves concealment unchanged
    // or the monster skips the attempt. Hallucinations need that refresh.
    newsym(monster.mx, monster.my);
}
// C mon.c:maybe_unhide_at(), called immediately after place_monster().  A
// concealer which leaves its object (or an eel which leaves water) is exposed
// before postmov() decides whether to attempt hiding again.  That ordering is
// RNG-visible because a newly exposed actor reaches postmov's rn2(5).
function revealMonsterAfterLeavingHidingPlace(monster, movement, state) {
    if (!movement?.moved || !monster?.mundetected)
        return;
    maybeUnhideAt(monster.mx, monster.my, state);
}
async function finishDochugAfterMovement(monster, movement, state, random, rollOne, rollDice, calls, dochugContext) {
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
        newsym(monster.mx, monster.my);
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
async function completeMovedMonsterAction(monster, movement, state, random, rollDice, rollOne, calls, dochugContext, { trapAlreadyHandled = false } = {}) {
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
    revealMonsterAfterLeavingHidingPlace(monster, movement, state);
    if (movement.movementStage !== 'postmov') {
        await finishDochugAfterMovement(monster, movement, state, random, rollOne, rollDice, calls, dochugContext);
        return movement;
    }
    if (movement.postMoveStatus === MMOVE_MOVED) {
        if (!trapAlreadyHandled) {
            movement.postMoveWasVisible = cansee(monster.mx, monster.my);
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
                newsym(movement.oldx, movement.oldy);
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
                swallowed(false);
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
                newsym(mx, my);
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
                newsym(monster.mx, monster.my);
                if (monster.wormno)
                    redrawMonsterWormSegments(monster);
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
    postMoveHideUnder(monster, movement, state, random, calls);
    if (movement.deferredAfterHideUnder)
        return;
    if (monster.isshk) {
        if (!hasShopkeeperData(monster))
            throw new Error('A shopkeeper must retain its shop state');
        await afterShopkeeperMove(monster, state);
    }
    await finishDochugAfterMovement(monster, movement, state, random, rollOne, rollDice, calls, dochugContext);
}
async function continueAfterMonsterTrap(action, state, random, rollDice, rollOne, calls) {
    if (action.movement?.immediateTrap)
        return action;
    if (action.movement.postMoveStatus === MMOVE_MOVED)
        requireMovementCapabilities(action.movement).species = action.monster.mnum;
    await completeMovedMonsterAction(action.monster, action.movement, state, random, rollDice, rollOne, calls, action.dochugContext, { trapAlreadyHandled: true });
    return action;
}
export async function resumeDeferredMonsterTrap(action, state, { random = rn2, rollDice = d, rollOne = rnd, publish = plineWithContinuation, describeMonster, finishDeath = (monster, options) => finishEnvironmentalMonsterDeath(monster, state, options), } = {}) {
    const movement = action?.movement;
    if (movement?.escapingTrap) {
        await tryMonsterTrapEscape(action.monster, state, {
            random,
            publish,
            ...(describeMonster ? { describeMonster } : {}),
        });
        delete movement.escapingTrap;
        if (!movement.immediateTrap) {
            const held = action.monster.mtrapped
                ? {
                    ...movement,
                    trapped: true,
                    postMoveStatus: MMOVE_NOTHING,
                    movementStage: 'dochug',
                }
                : null;
            const next = await moveMonsterAfterTrap(action.monster, state, random, rollDice, rollOne, action.calls, action.dochugContext, held);
            action.movement = next.movement;
        }
        return action;
    }
    const event = movement?.trap;
    if (!movement?.deferredAfterMonsterTrap)
        return action;
    delete movement.deferredAfterMonsterTrap;
    const calls = action.calls || DISCARDED_CALL_LOG;
    const recordedRandom = (range) => recordRandom(random, calls, range);
    const recordedRollOne = (range) => {
        const result = rollOne(range);
        calls.push(`rnd(${range})`);
        return result;
    };
    if (!event)
        throw new Error('A deferred monster trap must retain its event');
    switch (event.kind) {
        case 'web-trap':
            await finishMonsterWebTrap(action.monster, event.trap, {
                state,
                publish,
                ...(describeMonster ? { subject: describeMonster } : {}),
            });
            break;
        case 'bear-trap':
            await finishMonsterBearTrap(action.monster, event, state, {
                publish,
                random,
                rollDice,
                ...(describeMonster ? { describeMonster } : {}),
            });
            break;
        case 'rust-trap':
            await finishMonsterRustTrap(action.monster, event, state, {
                publish,
                random,
            });
            break;
        case 'projectile-trap':
        case 'spent-projectile-trap':
            await finishMonsterProjectileTrap(action.monster, event, state, {
                publish,
                random,
                rollOne: recordedRollOne,
                ...(describeMonster ? { describeMonster } : {}),
            });
            break;
        case 'anti-magic-drain':
        case 'anti-magic-damage': {
            const death = await finishMonsterAntiMagicTrap(action.monster, event, state, {
                random,
                publish,
                ...(describeMonster ? { describeMonster } : {}),
            });
            if (death) {
                event.death = death;
                if (death.survived) {
                    event.killed = false;
                    movement.actorDied = false;
                    movement.actionCompleted = false;
                }
            }
            break;
        }
        case 'fire-trap':
            await finishMonsterFireTrap(action.monster, event, state, {
                publish,
                random,
                rollOne,
                ...(describeMonster ? { describeMonster } : {}),
            });
            break;
        case 'land-mine':
            await finishMonsterLandMine(action.monster, event, state, {
                finishDeath,
                publish,
                random: recordedRandom,
                rollOne: recordedRollOne,
                ...(describeMonster ? { describeMonster } : {}),
            });
            break;
        case 'pit-trap':
            await finishMonsterPitTrap(action.monster, event, {
                publish,
                random,
                rollOne: recordedRollOne,
                ...(describeMonster ? { describeMonster } : {}),
                state,
            });
            break;
        case 'falling-rock':
        case 'spent-rock-trap':
            await finishMonsterRockTrap(action.monster, event, state, {
                publish,
                random,
                ...(describeMonster ? { describeMonster } : {}),
            });
            break;
        case 'sleep-gas':
            await finishMonsterSleepGasTrap(action.monster, event, {
                state,
                publish,
                ...(describeMonster ? { describeMonster } : {}),
            });
            break;
        case 'squeaky-board':
            await finishMonsterSqueakyBoard(action.monster, event, state, {
                publish,
            });
            break;
        case 'vibrating-square':
            await finishMonsterVibratingSquare(action.monster, event, {
                state,
                publish,
            });
            break;
        case 'polymorph-trap':
            await finishMonsterPolymorphTrap(event, {
                finishDeath,
                publish,
                state,
            });
            break;
        case 'anti-magic':
        case 'anti-magic-shoes':
        case 'known-trap-avoided':
        case 'level-fall-migration':
        case 'level-migration':
        case 'limbo-migration':
        case 'magic-portal-migration':
        case 'magic-trap':
        case 'rolling-boulder':
        case 'shop-return':
        case 'teleport-trap':
            throw new Error(`Trap ${event.kind} has no ordinary deferred continuation`);
    }
    if (('heroDied' in event && event.heroDied)
        || ('death' in event && event.death?.heroDied)
        || state.program_state.gameover) {
        movement.heroDied = true;
        return action;
    }
    if ('killed' in event && event.killed) {
        movement.actorDied = true;
        movement.postMoveStatus = MMOVE_DIED;
        movement.actionCompleted = true;
        return action;
    }
    await continueAfterMonsterTrap(action, state, random, rollDice, rollOne, calls);
    return action;
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
async function moveMonsterAfterTrap(monster, state, random, rollDice, rollOne, calls, dochugContext, movement) {
    if (!movement && monster.meating !== undefined && monster.meating > 0) {
        if (--monster.meating === 0)
            finishMonsterEating(monster, state);
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
    newsym(action.monster.mx, action.monster.my);
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
        pullLeashedPetCloser(monster, state, random, calls);
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
            newsym(monster.mx, monster.my);
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
            newsym(monster.mx, monster.my);
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
    // movemon_singlemon() has already debited this actor's movement.
    // dochug() gives a movable sleeper one source-ordered disturbance
    // attempt before returning ahead of set_apparxy()/distfleeck().
    if (monster.msleeping) {
        const woke = await disturbSleepingMonster(monster, state, random, calls);
        if (!woke) {
            if (heroIsHallucinating(state))
                newsym(monster.mx, monster.my);
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