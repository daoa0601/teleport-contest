// Monster movement-ration state, movement, and combat.
// C refs: allmain.c moveloop_core(), mon.c mcalcmove()/movemon()/mfndpos(),
// monmove.c m_move()/dochug(), and dogmove.c dog_goal()/dog_move().
import { stack_object } from './invent.js';
import { WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, AMULET_CLASS, FOOD_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS, WAND_CLASS, COIN_CLASS, GEM_CLASS, ROCK_CLASS, BALL_CLASS, VENOM_CLASS, } from './objclass.js';
import { OBJ_NAME, objectSkill, SCR_SCARE_MONSTER, SKELETON_KEY, LOCK_PICK, CREDIT_CARD, APPLE, BANANA, BULLWHIP, BOULDER, CARROT, CLOVE_OF_GARLIC, CORPSE, DWARVISH_MATTOCK, EGG, FLINT, ENORMOUS_MEATBALL, GOLD_PIECE, MEATBALL, MEAT_RING, MEAT_STICK, ARROW, BAG_OF_HOLDING, BLINDFOLD, BOOMERANG, CANDY_BAR, CRYSKNIFE, DAGGER, FEDORA, FORTUNE_COOKIE, LEMBAS_WAFER, LEATHER_JACKET, LEASH, MAGIC_MARKER, MAGIC_WHISTLE, OILSKIN_SACK, PANCAKE, SACK, SLING, STETHOSCOPE, TALLOW_CANDLE, TIN_OPENER, TIN_WHISTLE, TOWEL, WAX_CANDLE, AXE, BATTLE_AXE, DART, IRON_SHOES, PICK_AXE, ROCK, POT_GAIN_LEVEL, POT_HEALING, POT_INVISIBILITY, SLIME_MOLD, TIN, TRIPE_RATION, WAN_SPEED_MONSTER, BAG_OF_TRICKS, LUMP_OF_ROYAL_JELLY, POT_POLYMORPH, WAN_MAKE_INVISIBLE, WAN_POLYMORPH, } from './object_data.js';
import { objectMaterial, learnObjectType } from './o_init.js';
import { relocateMonsterTo, randomMonsterRelocation, teleportMonsterFromTrap, enexto, monsterTeleportRestricted, reportMonsterTeleportRestriction, } from './teleport.js';
import { moveMonsterNextToHero, monsterCanTouchObject, currentMonsterLoad, maxMonsterLoad, monsterCanCarryObject, angerMonster, angerWatchGuards, attemptMonsterRestrap, beginMonsterHideUnder, changeMonsterForm, consumeMonsterFloorObjects, consumeMonsterObject, decideMonsterShapeChange, finishEnvironmentalMonsterDeath, finishMonsterHideUnder, finishMonsterKilled, finishMonsterLiquidDeath, growAfterFood, hideMonsterUnder, initializeMonsterMovement, maybeUnhideAt, mcalcmove, mfndpos, monAllowFlags, monsterCanOpenDoor, monsterCanUnlockDoor, monsterDisplacementFlags, monstersInFmonOrder, naturalMonsterSpeed, pickUpMonsterFloorObject, respondToImmediateMagic, schedulable, wakeMonster, monsterInAir, monsterFliesOrFloats, wakeMonstersNearWithMessages, publishMonsterWake, releaseHeroFromMonster, isZombieMaker, zombieForm, } from './mon.js';
import { noticeMonster, disturbBuriedZombies, loseHeroHp, heroGoldAmount, inTown, roomsAt, mayDig, switchHeroTerrain } from './hack.js';
import { panic } from './end.js';
import { DISCARDED_CALL_LOG, recordRandom } from './monster_action_types.js';
import { veganCorpse } from './food_traits.js';
import { AD_RBRE, AD_ACID, AD_BLND, AD_CLRC, AD_COLD, AD_CURS, AD_HEAL, AD_DRIN, AD_CORR, AD_DCAY, AD_DGST, AD_DREN, AD_DETH, AD_CONF, AD_DRLI, AD_ELEC, AD_ENCH, AD_FIRE, AD_LEGS, AD_PHYS, AD_POLY, AD_TLPT, AD_DISE, AD_PEST, AD_FAMN, AD_MAGM, AD_SPC2, AD_SAMU, AD_SEDU, AD_SGLD, AD_SSEX, AD_SITM, AD_SLIM, AD_SLOW, AD_SPEL, AD_STCK, AD_STON, AD_STUN, AD_WRAP, AD_PLYS, AD_WERE, AD_RUST, AT_BOOM, AT_BREA, AT_CLAW, AT_ENGL, AT_GAZE, AT_HUGS, AT_MAGC, AT_SPIT, AT_TUCH, AT_WEAP, AT_KICK, AT_BITE, AT_STNG, AT_BUTT, AT_TENT, AT_EXPL } from './monster_attack_types.js';
import { M_SEEN_REFL, A_LAWFUL, ALTAR, G_GENOD, M_AP_MONSTER, TRAPPED_DOOR, is_pit, Is_rogue_level, DISMOUNT_THROWN, LEVEL_TELEP, RLOC_MSG, A_CHA, A_DEX, A_STR, A_CON, ALLOW_ALL, ALLOW_BARS, ALLOW_DIG, ALLOW_M, ALLOW_MDISP, ALLOW_ROCK, ALLOW_SANCT, MMOVE_NOTHING, MMOVE_MOVED, MMOVE_DIED, MMOVE_DONE, MMOVE_NOMOVES, MON_FLOOR, ALLOW_SSM, ALLOW_TM, ALLOW_TRAPS, ALLOW_U, ALLOW_WALL, ARROW_TRAP, BEAR_TRAP, BOLT_LIM, COLNO, CORR, DART_TRAP, DOOR, ROWNO, D_BROKEN, D_CLOSED, D_ISOPEN, D_LOCKED, D_NODOOR, D_TRAPPED, D_WARNED, FOUNTAIN, SDOOR, Is_firelevel, Is_waterlevel, IS_DOOR, IS_OBSTRUCTED, IS_ROOM, IS_STWALL, IS_TREE, IS_WALL, IRONBARS, LADDER, STAIRS, LAVAPOOL, LAVAWALL, BUSTDOOR, MAGIC_PORTAL, OPENDOOR, TELEP_TRAP, ANTI_MAGIC, FIRE_TRAP, HOLE, LANDMINE, ACCESSIBLE, DRAWBRIDGE_UP, MAGIC_TRAP, M_ATTK_AGR_DIED, M_ATTK_DEF_DIED, M_ATTK_HIT, M_ATTK_MISS, M_ATTK_AGR_DONE, M_AP_FURNITURE, M_AP_NOTHING, M_AP_OBJECT, M_AP_TYPE, POLY_TRAP, RUST_TRAP, PIT, PL_NSIZ, ROCKTRAP, ROLLING_BOULDER_TRAP, ROOM, SLP_GAS_TRAP, STONE, SPIKED_PIT, SQKY_BOARD, STATUE_TRAP, TRAPDOOR, NEED_AXE, NEED_HTH_WEAPON, NEED_PICK_AXE, NEED_PICK_OR_AXE, NEED_WEAPON, NO_WEAPON_WANTED, NOGARLIC, NOTONL, SHOPBASE, TEMPLE, TRAPNUM, STRAT_WAITFORU, STRAT_WAITMASK, STRAT_CLOSE, STRAT_ARRIVE, UNLOCKDOOR, VIBRATING_SQUARE, WATER, W_ACCESSORY, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMOR, W_ARMS, W_ARMU, W_NONDIGGABLE, W_NONPASSWALL, Upolyd, WEB, WT_TOOMUCH_DIAGONAL } from './const.js';
import { isok } from './cmd.js';
import { watchDigging, digMonsterTunnel, diggingTimeToHole, buryObject } from './dig.js';
import { heroIsHallucinating, heroIsDeaf, heroIsUnaware } from './senses.js';
import { propertyIsActive } from './properties.js';
import { heroHasHalfSpellDamage } from './zap.js';
import { MONSTER_ATTACKS, MONSTER_DIFFICULTY, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME, MONSTER_RESISTS, MONSTER_SIZE, MONSTER_SOUND, MONSTER_SYMBOL } from './monster_data.js';
import { canSenseMonster, swallowed, canSeeMonster, canSpotMonster, newsym } from './display.js';
import { d, rn2, rnd, rnl } from './rng.js';
import { game, requireInitializedGame, requireLiveGame, requireGameLevel } from './gstate.js';
import { searches_for_item, find_offensive, use_offensive, find_defensive, use_defensive, find_misc, use_misc } from './muse.js';
import { hasMagicKey, artifactEmitsLight, artifactById, retouchEquipment } from './artifact.js';
import { isLevelPrize } from './level_prize.js';
import { ACCFOOD, MANFOOD, dogFood } from './dog.js';
import { canTrack, monsterCorrodesBars, speciesHasWeaponAttack, monsterLocomotion, seenResistanceForDamage, monsterHasFireResistance, monsterKnowsTrap, monsterLearnsTrap, monstersSeeTrap, monsterPossessive, monsterIsHelpless, monsterResistsSleep, is_mercenary, is_minion, is_wanderer, likes_gems, likes_gold, likes_magic, likes_objs, metallivorous, monsterIsClinger, monsterPassesWalls, needspick, tunnels, monsterCanTeleport, monsterHasNoLimbs, monsterHidesUnder, monsterIsAmorphous, monsterIsAnimal, monsterIsCovetous, monsterIsDemon, monsterIsEel, monsterIsHider, monsterIsMindFlayer, monsterIsMindless, monsterIsNoncorporeal, monsterIsRider, monsterIsSlithy, monsterIsTelepathic, monsterIsThickSkinned, monsterIsUndead, monsterIsUnicorn, monsterIsUnsolid, monsterIsVampireShifter, monsterIsVerySmall, monsterIsWhirly, monsterPerceives, monsterThrowsRocks, speciesEatsCorpses, monsterHasNoAttacks, touchPetrifies, resistConflict, } from './mondata.js';
import { questMonsterSound } from './role_monsters.js';
import { fractureRock } from './zap.js';
import { drawbridgeUnderlyingType, isLavaAt, isPoolAt } from './dbridge.js';
import { costlySpot, afterShopkeeperMove, moveShopkeeper, shopkeeperInOwnShop, shopkeeperIsMuted, addShopDamage, rileShopkeeper, shopkeeperRepairsDamage } from './shk.js';
import { monsterAlignmentType, inHeroSanctuary, priestIsInOwnTemple, movePriest } from './priest.js';
import { engravingAt, hasCompletedEngraving, wipeEngravingAt } from './engrave.js';
import { ownedObjectName, simpleObjectNameWithArticle, observeDistantObjectForNaming, makePlural, verbForSubject } from './objnam.js';
import { displayMessageWindow } from './topl.js';
import { billDummyObject, splitObjectStack, mksobj, placeCreatedObject, placeObjectSynchronously, isContainer } from './mkobj.js';
import { dropMonsterObject } from './steal.js';
import { removeObjectFromMonsterInventory, findMonsterArmorClass } from './worn.js';
import { vision_recalc, cansee, clearPath, couldSeeFromHero, couldsee, monsterHasLineOfSightToHero, vision_note_blocker_change } from './vision.js';
import { formatHeardMessage, formatSeenMessage, plineWithContinuation, publishHeardMessage, impossible, } from './pline.js';
import { heroSpecies, heroFormSticks, dragonFormForArmor, heroHasProtectionFromShapeChangers } from './polyself.js';
import { checkQuestMonsterStatus, talkQuestCharacter, performQuestExpulsion } from './quest.js';
import { hasShopkeeperData } from './shop_types.js';
import { mintrap, trapAt, maketrap, count_traps } from './trap.js';
import { levelHasCeiling, insideWizardTower, sameDungeonLevel, canHeroRiseUp, levelAtDepth, placeHeroOnLevel, depth, specialLevelAt, } from './dungeon.js';
import { movePet, monsterCouldReachItem, finishMonsterEating } from './dogmove.js';
import { attackMonsterWithMonster, beginMonsterMeleeAttack, displaceMonster, fightNearbyMonster, monsterAttackStopsAggressor } from './mhitm.js';
import { heroCanSeeInvisible, mcastSpell, movementSpellContext, movementSpellSelections } from './mcastu.js';
import { attackHeroWithPolearm, monsterHasLauncherAndAmmo, monsterLinedUpWithHero, monsterLinedUpWithPerceivedHero, readyRangedMonsterWeapon, throwMonsterWeaponAtHero } from './mthrowu.js';
import { monsterWieldedWeapon, selectMonsterRangedWeapon, wieldMonsterWeapon, returningWeaponRangeSquared, rollPhysicalWeaponDamageAgainstHero } from './weapon.js';
import { advanceHeroAttackSequence, mattacku, monsterAttackMessagePublisher, presentMonsterAttackEffects, expelHero, monsterHasAvailableDistanceAttack } from './mhitu.js';
import { swingMonsterWeapon } from './mhitm.js';
import { isPick, isPolearm, is_cloak, is_gloves, is_shirt, is_launcher, launcherMatchesAmmo, objectIsOrganic } from './object_properties.js';
import { willWeld } from './wield.js';
import { currentAttribute } from './attrib.js';
import { heroIsDisplaced } from './do_wear.js';
import { heroHasConflict } from './hero_conflict.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { monsterName as canonicalMonsterName, monsterName, visibleMonsterSubject, monsterTypeName } from './do_name.js';
import { dist2, distmin } from './hacklib.js';
import { shopkeeperName } from './shknam.js';
import { heroGoldObject } from './sit.js';
import { canLetGo } from './do.js';
import { canFallThrough } from './dungeon.js';
import { getTrack, hasTrack } from './track.js';
import { monsterAt, monsterAtPosition, monsterHasMapPosition, placeMonsterOnMap, removeMonsterFromMapAt, dismountHero } from './steed.js';
import { advanceMonsterWormBody, redrawMonsterWormSegments, shrinkStationaryMonsterWorm, wormCrossesBetween } from './worm.js';
import { moveVaultGuard } from './vault.js';
import { createPoisonGasCloud, GAS_OK, monsterGasTolerance, visibleRegionAt, updateMonsterRegions } from './region.js';
import { demandDemonBribe } from './minion.js';
import { setMonsterMalign } from './makemon.js';
import { isQuantumBox } from './quantum_cat.js';
import { inventoryItemDescription, delobj } from './invent.js';
import { wereChange, setHeroLycanthropy } from './were.js';
import { stopHeroOccupation } from './allmain.js';
import { chooseCovetousStrategy, pursueCovetousTarget, retreatCovetousMonster, publishMonsterCuss } from './wizard.js';
import { migrateMonsterOffLevel } from './dog.js';
export const NORMAL_SPEED = 12;
export const MSLOW = 1;
export const MFAST = 2;
const MS_LEADER = 36;
const S_DOG = 4;
const S_HUMAN = 53;
const S_LEPRECHAUN = 12;
const S_NYMPH = 14;
const S_LIGHT = 25;
const PM_ETTIN = 174;
const PM_JABBERWOCK = 178;
const PM_FOG_CLOUD = 106;
const PM_XORN = MONSTER_NAME.indexOf('xorn');
const PM_TENGU = 55;
const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');
const PM_STALKER = 153;
const PM_IRON_GOLEM = MONSTER_NAME.indexOf('iron golem');
const PM_LIZARD = 326;
const PM_WATCHMAN = 282;
const PM_WATCH_CAPTAIN = 283;
const S_GOLEM = 55;
const POT_SPEED = 302;
const LOW_BOOTS = 163;
const IRON = 11;
const GEMSTONE = 20, MINERAL = 21;
const PM_GELATINOUS_CUBE = MONSTER_NAME.indexOf('gelatinous cube');
// Port only: finite-number type guard for decoded movement inputs.
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
// Port only: checked access to a completed move's capabilities.
export function requireMovementCapabilities(movement) {
    if (!movement.postMoveCapabilities)
        throw new Error('A completed monster move must retain its movement capabilities');
    return movement.postMoveCapabilities;
}
// Port only: checked access to a deferred move's dochug context.
export function requireDochugContext(action) {
    if (!action.dochugContext)
        throw new Error('A deferred monster movement needs its original turn context');
    return action.dochugContext;
}
// Part of C monmove.c:dochugw(): the squared BOLT_LIM+1 threat radius.
const THREAT_DISTANCE = (BOLT_LIM + 1) * (BOLT_LIM + 1);
const S_VAMPIRE = 48;
const G_UNIQ = 0x1000;
const PM_ANGEL = MONSTER_NAME.indexOf('Angel');
const PM_MINOTAUR = 177;
const PM_DEATH = 311;
const PM_PESTILENCE = 312;
const PM_FAMINE = 313;
const SEARCH_RADIUS = 5;
const PM_GREMLIN = MONSTER_NAME.indexOf('gremlin');
const PM_VROCK = MONSTER_NAME.indexOf('vrock');
const PM_QUEEN_BEE = MONSTER_NAME.indexOf('queen bee');
// C monmove.c:closed_door(). IS_DOOR() is exactly `typ === DOOR`; the
// shared form keeps the native (x, y) signature with the owning level.
export function closedDoor(state, x, y) {
    const location = state.level?.at?.(x, y);
    return location?.typ === DOOR
        && !!((location.doormask ?? 0) & (D_CLOSED | D_LOCKED));
}
// C monmove.c:mb_trapped(). A remotely struck door has the same effect as
// a door opened by its occupant; the explosion precedes damage and death.
export async function triggerMonsterDoorTrap(monster, visible, { state = game, publish = plineWithContinuation, rollOne = rnd, random = rn2, } = {}) {
    requireLiveGame(state);
    if (state.flags.verbose) {
        const dx = monster.mx - state.u.ux, dy = monster.my - state.u.uy;
        const seen = visible && !heroIsUnaware(state);
        const message = seen
            ? 'KABOOM!!  You see a door explode.'
            : !heroIsDeaf(state)
                ? formatHeardMessage(`a ${dx * dx + dy * dy > 49 ? 'distant' : 'nearby'} explosion.`, state)
                : null;
        if (message)
            await publish(message, seen ? { position: { x: monster.mx, y: monster.my } } : {});
    }
    await wakeMonstersNearWithMessages(monster.mx, monster.my, 49, state, publish);
    monster.mstun = 1;
    const damage = rollOne(15);
    monster.mhp -= damage;
    if (monster.mhp <= 0) {
        const death = await finishEnvironmentalMonsterDeath(monster, state, { publish, random });
        if (!death.survived || death.heroDied)
            return { killed: !death.survived, heroDied: !!death.heroDied, damage, death };
    }
    monsterLearnsTrap(monster, { ttyp: TRAPPED_DOOR });
    return { killed: false, heroDied: !!state.program_state.gameover, damage, death: null };
}
// C monmove.c:monhaskey().
export function monsterHasKey(monster, forUnlocking) {
    return (monster.minvent ?? []).some(object => object.otyp === SKELETON_KEY
        || object.otyp === LOCK_PICK || forUnlocking && object.otyp === CREDIT_CARD);
}
// C monmove.c:m_can_break_boulder() and m_break_boulder().
export function monsterCanBreakBoulder(monster) {
    return !!(monsterIsRider(monster)
        || !monster.mspec_used && (monster.isshk || monster.ispriest
            || questMonsterSound(monster.mnum) === MS_LEADER));
}
// C monmove.c:m_break_boulder(): a rider or spellcaster breaks a boulder.
export async function breakMonsterBoulder(monster, x, y, state = game, { random = rn2, publish = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    if (!monsterCanBreakBoulder(monster))
        return;
    const boulder = requireGameLevel(state).objects[x]?.[y]
        ?.find(object => object.otyp === BOULDER);
    if (!boulder)
        return;
    if (!monsterIsRider(monster)) {
        const distance = (monster.mx - state.u.ux) ** 2
            + (monster.my - state.u.uy) ** 2;
        if (!heroIsDeaf(state) && distance < 16) {
            await publish(`${monsterName(monster, { capitalized: true, state })} mutters ${monster.ispriest ? 'a prayer' : 'an incantation'}.`);
        }
        monster.mspec_used = (monster.mspec_used ?? 0) + 10 + random(20);
    }
    if (cansee(x, y))
        await publish('The boulder falls apart.');
    if (boulder.unpaid)
        await billDummyObject(boulder, state);
    await fractureRock(boulder, x, y, { state, random, publish });
}
// Part of C monmove.c:dochugw(): the remembered pre-move sighting.
// C dochugw() skips canspotmon() when the hero has no occupation.
export function monsterSightingBeforeAction(monster, state) {
    return { seen: !!state._occupation && canSpotMonster(monster), x: monster.mx, y: monster.my };
}
// C monmove.c:dochugw(): the stop-occupation threat check — hostile or
// attack-capable, within the squared BOLT_LIM+1 radius, unseen or too far
// before the move, spotted now, and neither paralyzed nor scared.  The
// pre-move sighting (movemon()) and the arrivals without one (makemon(),
// rloc_to_core()) supply the first half's already_saw_mon capture through
// monsterSightingBeforeAction() above.
export async function interruptOccupationForMonster(monster, state, before = null) {
    if (!state._occupation)
        return;
    // Hallucination distorts what the hero knows about peacefulness and attacks.
    if (!heroIsHallucinating(state)
        && (monster.mpeaceful || monsterHasNoAttacks(monster.mnum)))
        return;
    const heroDistance = (x, y) => (x - state.u.ux) ** 2 + (y - state.u.uy) ** 2;
    if (heroDistance(monster.mx, monster.my) > THREAT_DISTANCE)
        return;
    if (before?.seen && couldsee(before.x, before.y)
        && heroDistance(before.x, before.y) <= THREAT_DISTANCE)
        return;
    if (!canSpotMonster(monster) || !couldsee(monster.mx, monster.my)
        || !monster.mcanmove
        || monsterIsScaredAt(monster, state, state.u.ux, state.u.uy))
        return;
    await stopHeroOccupation(state);
}
// C monmove.c:onscary(): would this actor be scared at (x, y)?
export function monsterIsScaredAt(monster, state, x, y) {
    const auditoryScare = x === 0 && y === 0;
    if (monster?.iswiz || monster?.mnum === PM_ANGEL
        || [PM_DEATH, PM_PESTILENCE, PM_FAMINE].includes(monster?.mnum)
        || (is_minion(monster.mnum)
            && monsterAlignmentType(monster) === A_LAWFUL))
        return false;
    const symbol = MONSTER_SYMBOL[monster?.mnum];
    if (!auditoryScare && (symbol === S_HUMAN
        || ((MONSTER_GENO[monster?.mnum] ?? 0) & G_UNIQ)))
        return false;
    if ((monster.isshk && shopkeeperInOwnShop(monster, state))
        || (monster.ispriest && priestIsInOwnTemple(monster, state)))
        return false;
    if (auditoryScare)
        return true;
    if (state?.level?.at?.(x, y)?.typ === ALTAR
        && (symbol === S_VAMPIRE || monsterIsVampireShifter(monster)))
        return true;
    const pile = state?.level?.objects?.[x]?.[y] || [];
    if (pile.some(object => object.otyp === SCR_SCARE_MONSTER))
        return true;
    const engraving = engravingAt(x, y, state?.level);
    if (!engraving || !hasCompletedEngraving('Elbereth', x, y, state))
        return false;
    const protectsSquare = state?.u?.ux === x && state?.u?.uy === y
        || (heroIsDisplaced(state)
            && monster?.mux === x && monster?.muy === y)
        || (engraving.guardobjects && pile.length > 0);
    if (!protectsSquare)
        return false;
    const inHell = !!state?.dungeons?.[state?.u?.uz?.dnum ?? -1]
        ?.flags?.hellish;
    const endgame = !!state?.u?.uz && !!state?.astral_level
        && state.u.uz.dnum === state.astral_level.dnum;
    return !(monster?.isshk || monster?.isgd
        || monster?.mcansee === false || monster?.mcansee === 0
        || monster?.mpeaceful || monster?.mnum === PM_MINOTAUR
        || inHell || endgame);
}
// C monmove.c:release_hero(). A monster can end its own hold, but cannot
// release a sticky hero's grip. Expulsion also settles the hero's landing.
export async function releaseMonsterHold(monster, { state = game, publish = plineWithContinuation, random = rn2, rollOne = rnd, } = {}) {
    if (state.u.ustuck !== monster)
        return false;
    if (state.u.uswallow) {
        const result = await expelHero(monster, { state, publish, random, rollOne });
        return !!result.died;
    }
    if (!heroFormSticks(state)) {
        await releaseHeroFromMonster(monster, { state, publish, rollOne });
        await publish('You get released!');
    }
    return false;
}
// C monmove.c:bee_eat_jelly(). A living queen leaves the meal untouched.
// Also C monmove.c:find_pmmonst(): inlined here for the queen bee search.
export async function feedBeeRoyalJelly(monster, object, state) {
    const queensGenocided = !!((state.mvitals?.[PM_QUEEN_BEE]?.mvflags ?? 0) & G_GENOD);
    if (!queensGenocided && state.level?.monsters.some(candidate => candidate.mnum === PM_QUEEN_BEE && !candidate.dead && candidate.mhp > 0))
        return false;
    const delay = object.blessed ? 3 : object.cursed ? 7 : 5;
    if (object.quan > 1) {
        const portion = splitObjectStack(object, 1, state);
        if (!portion)
            throw new Error('A bee could not split one lump of royal jelly');
        object = portion;
    }
    if (canSeeMonster(monster))
        await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} eats ${simpleObjectNameWithArticle(object, state)}.`);
    await delobj(object, state);
    monster.m_lev = Math.max(monster.m_lev ?? 0, (MONSTER_LEVEL[PM_QUEEN_BEE] ?? 0) - 1);
    await growAfterFood(monster, state);
    if (!monster.dead && monster.mhp > 0) {
        monster.mfrozen = delay;
        monster.mcanmove = 0;
    }
    return true;
}
// C monmove.c:gelcube_digests(). Engulfed organic inventory costs a later
// action to digest, even when the cube resisted eating it off the floor.
export async function digestGelatinousCubeInventory(monster, state, options = {}) {
    if (monster.meating)
        return false;
    const object = monster.minvent?.find(candidate => objectIsOrganic(candidate, state)
        && !candidate.oartifact && !isLevelPrize(candidate, state));
    if (!object)
        return false;
    // eaten_stat(0, object) always returns at least one turn.
    monster.meating = 1;
    if (!await removeObjectFromMonsterInventory(monster, object, state, { publish: options.publish ?? plineWithContinuation }))
        throw new Error(`Cube could not release its meal ${object.o_id}`);
    await consumeMonsterObject(monster, object, state, options);
    return true;
}
// C monmove.c:flees_light() (macro). Gremlins flee from lit artifacts.
function fleesLight(monster, state) {
    const weapon = state.uwep || state.u.uwep;
    const armor = state.uarm || state.u.uarm;
    return !!(monster.mnum === PM_GREMLIN
        && ((weapon?.lamplit && artifactEmitsLight(weapon))
            || (armor?.lamplit && artifactEmitsLight(armor)))
        && monster.mcansee && couldsee(monster.mx, monster.my));
}
// C monmove.c:monflee(): make a monster start or extend fleeing.
// A monster beginning to flee.
// C ref: monmove.c monflee(), release_hero(), and flees_light().
export async function makeMonsterFlee(monster, { state = game, turns = 0, first = false, announce = true, publish = plineWithContinuation, random = rn2, rollOne = rnd, } = {}) {
    requireLiveGame(state);
    if (monster.mhp <= 0)
        return { heroDied: false };
    if (await releaseMonsterHold(monster, { state, publish, random, rollOne }))
        return { heroDied: true };
    const canStart = !first || !monster.mflee;
    if (canStart) {
        if (turns === 0) {
            monster.mfleetim = 0;
        }
        else if (!monster.mflee || monster.mfleetim) {
            const total = turns + (monster.mfleetim ?? 0);
            monster.mfleetim = Math.min(total === 1 ? 2 : total, 127);
        }
        if (!monster.mflee && announce
            && canSeeMonster(monster)
            && M_AP_TYPE(monster) !== M_AP_FURNITURE
            && M_AP_TYPE(monster) !== M_AP_OBJECT) {
            await announceFlight(monster, state, publish, random);
        }
        if (monster.mnum === PM_VROCK && !monster.mspec_used) {
            monster.mspec_used = 75 + random(25);
            await createPoisonGasCloud(state, monster.mx, monster.my, 5, 8, random, publish);
        }
        monster.mflee = 1;
    }
    monster.mtrack = [];
    return { heroDied: false };
}
// Part of C monmove.c:monflee(): the flight announcement and vrock cloud.
async function announceFlight(monster, state, publish, random) {
    if (!monster.mcanmove || !MONSTER_MOVE[monster.mnum]) {
        const name = monsterName(monster, {
            adjective: 'immobile', capitalized: true, state,
        });
        await publish(`${name} seems to flinch.`);
    }
    else if (fleesLight(monster, state)) {
        if (heroIsUnaware(state)) {
            await publish(`${monsterName(monster, { capitalized: true, state })} is frightened.`);
        }
        else if (random(10) || heroIsDeaf(state)) {
            const weapon = state.uwep || state.u.uwep;
            const armor = state.uarm || state.u.uarm;
            let source;
            if (weapon && artifactEmitsLight(weapon)) {
                const artifact = artifactById(weapon.oartifact, state);
                if (!artifact)
                    throw new Error('A glowing artifact weapon has no artifact definition');
                source = artifact.name.replace(/^The /, 'the ');
            }
            else {
                if (!armor)
                    throw new Error('A monster fled equipment light without its source');
                source = ownedObjectName(armor, state, { capitalized: false });
            }
            const name = monsterName(monster, { capitalized: true, state });
            await publish(`${name} flees from the painful light of ${source}.`);
        }
        else {
            await publish('"Bright light!"');
        }
    }
    else {
        await publish(`${monsterName(monster, { capitalized: true, state })} turns to flee.`);
    }
}
// C monmove.c:distfleeck(). The range is measured before fleeing can release
// or expel the hero, and remains the caller's range for this attack phase.
export async function checkMonsterHeroRange(monster, { state = game, random = rn2, rollOne = rnd, } = {}) {
    const braveGremlin = random(5) === 0;
    const targetX = monster.mux ?? state.u.ux;
    const targetY = monster.muy ?? state.u.uy;
    const dx = monster.mx - targetX, dy = monster.my - targetY;
    const inRange = dx * dx + dy * dy <= BOLT_LIM * BOLT_LIM;
    const nearby = inRange && Math.abs(dx) <= 1 && Math.abs(dy) <= 1
        && !(monster.mnum === PM_GRID_BUG && dx && dy);
    const seesHero = monster.mcansee
        && (!heroIsInvisible(state)
            || (monsterPerceives(monster.mnum)));
    const scary = monsterIsScaredAt(monster, state, seesHero ? state.u.ux : targetX, seesHero ? state.u.uy : targetY);
    const scared = nearby && (scary
        || (fleesLight(monster, state) && !braveGremlin)
        || (!monster.mpeaceful && inHeroSanctuary(monster, 0, 0, state)));
    let heroDied = false;
    if (scared) {
        const turns = rollOne(random(7) ? 10 : 100);
        ({ heroDied } = await makeMonsterFlee(monster, {
            state, turns, first: true, random, rollOne,
        }));
    }
    return { inRange, nearby, scared, heroDied };
}
// C monmove.c:mind_blast(). Psychic attacks precede ordinary movement.
export async function useMonsterMindBlast(monster, state, { resistsConflict, random = rn2, rollOne = rnd, publish = plineWithContinuation, }) {
    if (canSeeMonster(monster))
        await publish(`${monsterName(monster, { state, capitalized: true })} concentrates.`);
    if (dist2(monster.mx, monster.my, state.u.ux, state.u.uy) > BOLT_LIM * BOLT_LIM) {
        await publish('You sense a faint wave of psychic energy.');
        return false;
    }
    await publish('A wave of psychic energy pours over you!');
    if (monster.mpeaceful && (!heroHasConflict(state) || resistsConflict())) {
        await publish('It feels quite soothing.');
    }
    else if (!state.u.invulnerable) {
        const sensed = canSenseMonster(monster);
        const telepathic = !!state.u.telepathy || propertyIsActive('telepathy', state);
        if (sensed || (telepathic && random(2) !== 0) || random(10) === 0) {
            await revealHeroToPsychicBlast(state);
            await publish(`It locks on to your ${sensed ? 'telepathy' : telepathic ? 'latent telepathy' : 'mind'}!`);
            let damage = rollOne(15);
            if (heroHasHalfSpellDamage(state))
                damage = Math.trunc((damage + 1) / 2);
            if (await loseHeroHp(damage, 'psychic blast', { state, publish }))
                return true;
        }
    }
    // makemon() prepends to fmon; level.monsters appends new monsters.
    for (const target of Array.from(state.level.monsters).reverse()) {
        if (target.dead || target.mhp <= 0 || target === monster
            || !!target.mpeaceful === !!monster.mpeaceful || monsterIsMindless(target.mnum))
            continue;
        if (!((monsterIsTelepathic(target.mnum) && (random(2) !== 0 || target.mblinded))
            || random(10) === 0))
            continue;
        await wakeMonster(target);
        if (cansee(target.mx, target.my))
            await publish(`It locks on to ${monsterName(target, { state })}.`);
        target.mhp -= rollOne(15);
        if (target.mhp <= 0) {
            const death = await finishMonsterKilled(target, state, { damageType: AD_DRIN, publish, random });
            if (death.heroDied)
                return true;
        }
    }
    return false;
}
// Part of C monmove.c:mind_blast(): the blast revealing a hiding
// polymorphed hero.
async function revealHeroToPsychicBlast(state) {
    if (state.u.uundetected) {
        state.u.uundetected = false;
        await newsym(state.u.ux, state.u.uy);
    }
    else if (state.u.m_ap_type && state.u.m_ap_type !== M_AP_MONSTER) {
        state.u.m_ap_type = M_AP_NOTHING;
        state.u.mappearance = 0;
        await newsym(state.u.ux, state.u.uy);
    }
}
// C monmove.c:m_search_items().
export function searchMonsterItems(monster, state, { goal: initialGoal, approach: initialApproach, random, calls = [], }) {
    requireLiveGame(state);
    const { mx, my, mux, muy } = monster;
    if (typeof mux !== 'number' || typeof muy !== 'number'
        || !Number.isFinite(mux) || !Number.isFinite(muy))
        throw new Error('An item search requires the monster perceived hero position');
    const heroGoal = { x: mux, y: muy };
    let goal = { ...initialGoal };
    let approach = initialApproach;
    let radius = SEARCH_RADIUS;
    if (!monster.mpeaceful && distmin(mx, my, mux, muy) < SEARCH_RADIUS)
        radius--;
    if (!monster.mpeaceful && is_mercenary(monster.mnum))
        radius = 1;
    let skipSearch = false;
    if (roomsAt(state.level, mx, my, SHOPBASE).length) {
        const shopRoll = random(25);
        calls.push('rn2(25)');
        skipSearch = shopRoll !== 0 || !!monster.isshk;
    }
    if (!skipSearch) {
        const maxX = Math.min(COLNO - 1, mx + radius);
        const maxY = Math.min(ROWNO - 1, my + radius);
        const minX = Math.max(1, mx - radius);
        const minY = Math.max(0, my - radius);
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const pile = state.level.objects[x]?.[y];
                if (!pile?.length || radius < distmin(mx, my, x, y)
                    || !monsterCouldReachItem(monster, x, y, state))
                    continue;
                if ((monsterHidesUnder(monster.mnum)) && cansee(x, y))
                    continue;
                const occupant = monsterAtPosition(state.level, x, y);
                if (occupant && (occupant.msleeping || !occupant.mcanmove || occupant.mundetected
                    || (occupant.mappearance && !occupant.iswiz) || !MONSTER_MOVE[occupant.mnum]))
                    continue;
                if (monsterIsScaredAt(monster, state, x, y))
                    continue;
                const trap = state.level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
                if (trap && monsterKnowsTrap(monster, trap)) {
                    if (goal.x === x && goal.y === y)
                        goal = heroGoal;
                    continue;
                }
                if (!clearPath(mx, my, x, y))
                    continue;
                const costly = costlySpot(x, y, state) !== null;
                for (const object of pile) {
                    if (object.otyp === ROCK || isLevelPrize(object, state) || (costly && !object.no_charge))
                        continue;
                    if (((monsterWantsFloorObject(monster, object, state)
                        && monsterCanCarryObject(monster, object, state, random))
                        || monsterWouldConsumeItem(monster, object, state, random, calls))
                        && monsterCanTouchObject(monster, object, state)) {
                        radius = distmin(mx, my, x, y);
                        goal = { x: object.ox, y: object.oy };
                        if (goal.x === mx && goal.y === my)
                            return { goal, approach, underfoot: object };
                        break;
                    }
                }
            }
        }
    }
    if (radius < SEARCH_RADIUS && approach === -1) {
        if (distmin(mx, my, mux, muy) <= 3)
            goal = heroGoal;
        else
            approach = 1;
    }
    return { goal, approach, underfoot: null };
}
// C monmove.c:vamp_shift() as the closed-door branch reaches it: a vampire
// becomes a fog cloud to pass a closed door, seen or sensed.
export async function shiftMonsterForDoor(monster, state, { previousPosition, wasSeen, wasSpotted, publish = plineWithContinuation, }) {
    requireLiveGame(state);
    const destination = { x: monster.mx, y: monster.my };
    const door = state.level.requireAt(destination.x, destination.y);
    if (monsterIsAmorphous(monster) || door.typ !== DOOR
        || !(door.doormask & (D_CLOSED | D_LOCKED)) || !monsterCanFog(monster, state))
        return { died: false, heroDied: false };
    if (wasSeen || wasSpotted) {
        await placeMonsterOnMap(monster, previousPosition.x, previousPosition.y);
        await newsym(destination.x, destination.y);
        await newsym(previousPosition.x, previousPosition.y);
    }
    const change = await changeMonsterForm(monster, PM_FOG_CLOUD, state, {
        showMessage: wasSeen, publish, creditHero: false,
    });
    await displayMessageWindow();
    const died = !!monster.dead || monster.mhp <= 0;
    const heroDied = !!change?.heroDied || !!state.program_state.gameover;
    if (!died && (wasSeen || wasSpotted)) {
        await placeMonsterOnMap(monster, destination.x, destination.y);
        await newsym(previousPosition.x, previousPosition.y);
        await newsym(destination.x, destination.y);
    }
    return { died, heroDied };
}
// Part of C monmove.c:postmov(): the door-smashing and iron-bars passage.
export async function resolveMonsterDoorPassage(monster, state, { canOpen, canUnlock, canTunnel, wasDoorVisible, random = rn2, rollOne = rnd, publish = plineWithContinuation, }) {
    requireLiveGame(state);
    const { mx: x, my: y } = monster;
    const location = state.level.requireAt(x, y);
    if (location.typ === IRONBARS) {
        if (!(location.wall_info & W_NONDIGGABLE)
            && (monsterCorrodesBars(monster) || metallivorous(monster.mnum))) {
            if (canSeeMonster(monster))
                await publish(`${monsterName(monster, { state, capitalized: true })} eats through the iron bars.`);
            await dissolveBars(x, y, state);
            return { status: 'done', heroDied: !!state.program_state.gameover };
        }
        if (state.flags.verbose && canSeeMonster(monster)) {
            const verb = makePlural(monsterLocomotion(monster.mnum, 'pass'));
            const passage = monsterPassesWalls(monster.mnum) ? 'through' : 'between';
            await publish(`${monsterName(monster, { state, capitalized: true })} ${verb} ${passage} the iron bars.`, { noRepeat: true });
        }
        return { status: 'continue', heroDied: false };
    }
    if (location.typ !== DOOR || monsterPassesWalls(monster.mnum) || canTunnel)
        return { status: 'continue', heroDied: false };
    let trapped = !!(location.doormask & D_TRAPPED);
    if (trapped && hasMagicKey({ monster }, state)) {
        location.doormask &= ~D_TRAPPED;
        trapped = false;
    }
    const closed = !!(location.doormask & (D_LOCKED | D_CLOSED));
    if (closed && monsterIsAmorphous(monster)) {
        if (state.flags.verbose && canSeeMonster(monster)) {
            const verb = monster.mnum === PM_FOG_CLOUD || MONSTER_SYMBOL[monster.mnum] === S_LIGHT
                ? 'flows' : 'oozes';
            await publish(`${monsterName(monster, { state, capitalized: true, article: 'your' })} ${verb} under the door.`);
        }
        return { status: 'continue', heroDied: false };
    }
    let action;
    let mask;
    if (location.doormask & D_LOCKED && canUnlock) {
        action = 'unlock';
        mask = trapped ? D_NODOOR : D_ISOPEN;
    }
    else if (location.doormask === D_CLOSED && canOpen) {
        action = 'open';
        mask = D_ISOPEN;
    }
    else if (closed) {
        action = 'break';
        mask = trapped || (location.doormask & D_LOCKED && random(2) === 0)
            ? D_NODOOR : D_BROKEN;
    }
    else
        return { status: 'continue', heroDied: false };
    location.doormask = mask;
    await newsym(x, y);
    vision_note_blocker_change(x, y);
    await vision_recalc(0);
    const seesDoor = wasDoorVisible || cansee(x, y);
    if (trapped) {
        const trap = await triggerMonsterDoorTrap(monster, seesDoor, { state, random, rollOne, publish });
        if (trap.killed || trap.heroDied)
            return { status: trap.killed ? 'died' : 'continue', heroDied: trap.heroDied };
    }
    else if (state.flags.verbose) {
        const actorAction = action === 'unlock' ? 'unlocks and opens'
            : action === 'open' ? 'opens' : 'smashes down';
        const doorAction = action === 'unlock' ? 'unlock and open'
            : action === 'open' ? 'open' : 'crash open';
        const message = seesDoor && canSpotMonster(monster)
            ? `${monsterName(monster, { state, capitalized: true })} ${actorAction} a door.`
            : seesDoor ? formatSeenMessage(`a door ${doorAction}.`, state)
                : !heroIsDeaf(state) ? formatHeardMessage(`a door ${doorAction}.`, state) : null;
        if (message)
            await publish(message);
    }
    if (action === 'break' && roomsAt(state.level, x, y, SHOPBASE).length)
        addShopDamage(x, y, 0, state);
    return { status: 'continue', heroDied: false };
}
// C monmove.c:can_hide_under_obj().
export function canMonsterHideUnderObjectAt(state, x, y) {
    const pile = state.level?.objects[x]?.[y] ?? [];
    if (pile[0]?.where !== 'floor')
        return false;
    const trap = state.level?.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (trap && !is_pit(trap.ttyp))
        return false;
    let coins = 0;
    for (const object of pile) {
        if (object.oclass !== COIN_CLASS)
            return true;
        coins += object.quan;
        if (coins >= 10)
            return true;
    }
    return false;
}
// C monmove.c:dissolve_bars(). Bars already transmit light; callers which
// also remove opaque terrain or objects own any blocker recalculation.
export async function dissolveBars(x, y, state = game) {
    const level = requireGameLevel(state);
    const location = level.requireAt(x, y);
    location.typ = location.edge === true || location.edge === 1 ? DOOR
        : specialLevelAt(state.u.uz, state) || roomsAt(level, x, y).length ? ROOM : CORR;
    location.flags = location.doormask = location.wall_info = 0;
    await newsym(x, y);
    if (state.u.ux === x && state.u.uy === y)
        await switchHeroTerrain(state);
}
// C monmove.c:m_digweapon_check().  A pick-dependent tunneller may select a
// diggable destination while unarmed, but it must spend this action readying
// the appropriate tool before a later turn can enter and excavate the square.
export async function readyMonsterDiggingWeapon(monster, state, x, y) {
    const loc = state.level.at(x, y);
    if (!loc)
        return null;
    if (!tunnels(monster.mnum) ||
        !needspick(monster.mnum) ||
        sameDungeonLevel(state.u.uz, state.rogue_level))
        return null;
    const closedDoor = IS_DOOR(loc.typ) && !!((loc.doormask ?? 0) & (D_CLOSED | D_LOCKED));
    const tree = IS_TREE(loc.typ);
    const rock = IS_STWALL(loc.typ) && !tree;
    if (!closedDoor && (!(tree || rock) || !mayDig(x, y, state)))
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
// Part of C monmove.c:m_everyturn_effect(): the fog cloud's gas region.
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
// Part of C mon.c:movemon(): the schedulable pass that runs each monster's
// every-turn effect.
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
// Part of C allmain.c:moveloop_core(): the youmonst every-turn effect
// between status projection and the next command.
// C allmain.c invokes the same species hook for `youmonst` after status
// projection and before accepting the next command.  The region persists on
// the level and suppresses another TTL draw while it covers the hero square.
export async function heroEveryturnEffect(state = requireInitializedGame(), random = rn2) {
    if ((state.u?.mtimedone ?? 0) <= 0 || state.u?.umonnum !== PM_FOG_CLOUD)
        return null;
    return await createFogEveryturnRegion(state, state.u.ux, state.u.uy, random);
}
const PM_STEAM_VORTEX = 110;
const PM_HEZROU = 296;
// C monmove.c:m_postmove_effect(), shared by monsters and the polymorphed
// hero: the cloud is left on the square the mover has just departed.
export async function leaveMovementCloud(state, species, cancelled, x, y, random = rn2) {
    if (species === PM_HEZROU)
        await createPoisonGasCloud(state, x, y, 1, 8, random);
    else if (species === PM_STEAM_VORTEX && !cancelled)
        await createPoisonGasCloud(state, x, y, 1, 0, random);
}
// C monmove.c:m_avoid_kicked_loc(): keep clear of the square the hero just
// kicked.
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
// C monmove.c:m_avoid_soko_push_loc(): keep the Sokoban push stance clear.
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
// C monmove.c:watch_on_duty(). A warning does not consume the watchman's move.
// Also C lock.c:picking_lock(): inlined as the pick-lock occupation test
// that targets the hero's facing square.
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
// C monmove.c:disturb(): wake a sleeping monster near the hero.
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
// Part of C monmove.c:mon_would_take_item(): the unicorn test.
function isUnicorn(monster) {
    return monster?.mnum >= 101 && monster?.mnum <= 103;
}
// C monmove.c:mon_would_take_item(): would this monster want a floor
// object?
// Monster mtmp would love to take object otmp? C monmove.c:mon_would_take_item().
export function monsterWantsFloorObject(monster, object, state) {
    const loadPercent = Math.trunc(currentMonsterLoad(monster) * 100 / maxMonsterLoad(monster));
    if (object === state.uball || object === state.uchain)
        return false;
    if (monster.mtame && object.cursed)
        return false;
    const material = objectMaterial(object, state);
    if (monsterIsUnicorn(monster.mnum) && material !== GEMSTONE)
        return false;
    if (!monsterIsMindless(monster.mnum) && !monsterIsAnimal(monster)
        && loadPercent < 75 && searches_for_item(monster, object, state))
        return true;
    if (likes_gold(monster.mnum) && object.otyp === GOLD_PIECE && loadPercent < 95)
        return true;
    if (likes_gems(monster.mnum) && object.oclass === GEM_CLASS
        && material !== MINERAL && loadPercent < 85)
        return true;
    if (likes_objs(monster.mnum)
        && [WEAPON_CLASS, ARMOR_CLASS, GEM_CLASS, FOOD_CLASS].includes(object.oclass)
        && loadPercent < 75)
        return true;
    if (likes_magic(monster.mnum)
        && [AMULET_CLASS, POTION_CLASS, SCROLL_CLASS, WAND_CLASS, RING_CLASS, SPBOOK_CLASS].includes(object.oclass)
        && loadPercent < 85)
        return true;
    if (monsterThrowsRocks(monster.mnum) && object.otyp === BOULDER
        && loadPercent < 50 && !state.level.flags.sokoban_rules)
        return true;
    return monster.mnum === PM_GELATINOUS_CUBE && object.oclass !== ROCK_CLASS
        && object.oclass !== BALL_CLASS
        && !(object.otyp === CORPSE && touchPetrifies(object.corpsenm));
}
// C monmove.c:mon_would_consume_item(): consume without picking up.
// Monster mtmp would love to consume object otmp, without picking it up.
// C monmove.c:mon_would_consume_item().
export function monsterWouldConsumeItem(monster, object, state, random, calls = []) {
    if (object.otyp === CORPSE && !touchPetrifies(object.corpsenm)
        && speciesEatsCorpses(monster.mnum))
        return true;
    const pet = monster.edog ?? monster.mextra?.edog;
    if (!monster.mtame || !pet)
        return false;
    const food = dogFood(monster, object, random, calls, state);
    return food < MANFOOD && (food < ACCFOOD || pet.hungrytime <= state.moves);
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
        heroDied: !!attack.heroDied,
        postMoveStatus: monsterAttackStopsAggressor(attack) || monster.dead || monster.mhp <= 0 ? MMOVE_DIED : MMOVE_DONE,
    };
}
// C monmove.c:itsstuck(): a sticky hero keeps the monster in place.
export async function stopMonsterHeldByHero(monster, state) {
    if (state.u.ustuck !== monster || state.u.uswallow || !heroFormSticks(state))
        return false;
    await plineWithContinuation(`${canonicalMonsterName(monster, {
        state,
        capitalized: true,
    })} cannot escape from you!`);
    return true;
}
// C monmove.c:leppie_stash(), after a successful fleeing teleport.
export async function stashLeprechaunGold(monster, state = game, random = rn2) {
    const level = requireGameLevel(state);
    if (monster.mnum !== MONSTER_NAME.indexOf('leprechaun') || monster.dead || monster.mhp <= 0
        || monsterHasLineOfSightToHero(monster, state)
        || roomsAt(level, monster.mx, monster.my, SHOPBASE).length
        || level.at(monster.mx, monster.my)?.typ !== ROOM
        || level.traps.some(trap => trap.tx === monster.mx && trap.ty === monster.my)
        || !random(4))
        return;
    const gold = monster.minvent?.find(object => object.otyp === GOLD_PIECE);
    if (!gold)
        return;
    await dropMonsterObject(monster, gold, state, { random });
    const dropped = level.objects[monster.mx]?.[monster.my]?.find(object => object.otyp === GOLD_PIECE);
    if (dropped)
        await buryObject(dropped, state);
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
    const wieldedName = OBJ_NAME(wielded?.otyp);
    if (isPolearm(wielded) && distance <= 5)
        return { policy: -1, min: 0, max: 0 };
    if (wieldedName === 'aklys')
        return { policy: -2, min: 4, max: 16 };
    const badlyHurt = (monster.mhp ?? 0) < Math.trunc(((monster.mhpmax ?? 0) + 1) / 3);
    if (monsterHasAvailableDistanceAttack(monster, random) && (badlyHurt || !(monster.mspec_used ?? 0)))
        return { policy: -1, min: 0, max: 0 };
    return { policy: oldPolicy, min: 0, max: 0 };
}
// Port only: assert the remembered apparent-hero coordinate.
// Movement and ranged-attack code asserts the remembered apparent-hero
// coordinate before using it; makemon() and dochug() establish it first.
export function requirePerceivedHero(monster) {
    if (typeof monster.mux !== 'number' || !Number.isFinite(monster.mux)
        || typeof monster.muy !== 'number' || !Number.isFinite(monster.muy))
        throw new Error('An active monster must retain its perceived hero position');
}
// Port only: record one perception RNG draw for the diagnostic transcript.
function recordPerceptionRandom(random, calls, range) {
    const value = random(range);
    if (calls)
        calls.push({ range, value });
    return value;
}
// C monmove.c:can_fog()/can_ooze(). Small carried objects fit under a door;
// bulky inventory disqualifies these predicates. Native mfndpos() separately
// admits an amorphous body without calling can_ooze(); set_apparxy() calls it.
export function monsterCanFog(monster, state) {
    return monsterIsVampireShifter(monster)
        && !((state?.mvitals?.[PM_FOG_CLOUD]?.mvflags ?? 0) & G_GENOD)
        && !state.u.protectionFromShapeChangers
        && !state.protectionFromShapeChangers
        && !inventoryBlocksDoorPassage(monster.minvent || []);
}
// C monmove.c:can_ooze(): an amorphous body with small inventory fits
// under a door.
export function monsterCanOoze(monster) {
    return monsterIsAmorphous(monster)
        && !inventoryBlocksDoorPassage(monster.minvent || []);
}
// Part of C monmove.c:can_ooze(): the youmonst form reads the hero's
// inventory.
// C can_ooze() uses the hero's inventory for youmonst, not minvent.
export function heroCanOoze(state) {
    return monsterIsAmorphous({ mnum: heroSpecies(state) })
        && !inventoryBlocksDoorPassage(state.inventory);
}
// C monmove.c:stuff_prevents_passage(): inventory prevents passage under a
// door. Used by can_ooze() and can_fog(); hack.c cant_squeeze_thru() keeps
// its own worn-armor test.
function inventoryBlocksDoorPassage(inventory) {
    for (const object of inventory) {
        const type = object.otyp;
        // The pinned source compares otyp, not oclass, for this first test.
        if (type === COIN_CLASS && object.quan > 100)
            return true;
        // C monmove.c:stuff_prevents_passage() tests is_cloak/is_gloves/
        // is_shirt; each macro carries the armor-class guard.
        const flexibleArmor = is_cloak(object) || is_gloves(object) || is_shirt(object);
        const tinyCorpse = type === CORPSE && object.corpsenm !== undefined
            && monsterIsVerySmall(object.corpsenm);
        if (![RING_CLASS, AMULET_CLASS, GEM_CLASS, VENOM_CLASS].includes(object.oclass)
            && !(type >= ARROW && type <= BOOMERANG)
            && !(type >= DAGGER && type <= CRYSKNIFE)
            && !flexibleArmor && !tinyCorpse && !SMALL_PASSAGE_OBJECTS.has(type))
            return true;
        if ((isContainer(object) || type === BAG_OF_TRICKS) && object.contents?.length)
            return true;
    }
    return false;
}
const SMALL_PASSAGE_OBJECTS = new Set([
    SLING, FEDORA, LEATHER_JACKET, CREDIT_CARD, FORTUNE_COOKIE, CANDY_BAR,
    PANCAKE, LEMBAS_WAFER, LUMP_OF_ROYAL_JELLY, SACK, BAG_OF_HOLDING,
    BAG_OF_TRICKS, TALLOW_CANDLE, WAX_CANDLE, OILSKIN_SACK, LEASH,
    STETHOSCOPE, BLINDFOLD, TOWEL, TIN_WHISTLE, MAGIC_WHISTLE, MAGIC_MARKER,
    TIN_OPENER, SKELETON_KEY, LOCK_PICK,
]);
// C monmove.c:set_apparxy(): remember the monster's apparent hero
// coordinate.
// makemon() initializes this state once when its requested coordinate was the
// hero's square.  dochug() refreshes it before each movement decision.  Keep
// both owners on this one implementation: displacement makes the RNG and the
// remembered false position observable at either boundary.
export function setMonsterApparentHeroPosition(monster, state, random, calls = null) {
    const heroX = state?.u?.ux;
    const heroY = state?.u?.uy;
    if (!Number.isFinite(heroX) || !Number.isFinite(heroY))
        return false;
    const rememberedX = monster.mux;
    const rememberedY = monster.muy;
    if (monster.mtame || monster === state?.u?.ustuck
        || (rememberedX === heroX && rememberedY === heroY)) {
        monster.mux = heroX;
        monster.muy = heroY;
        return true;
    }
    const notSeen = !monster.mcansee
        || (heroIsInvisible(state) && !monsterPerceives(monster.mnum));
    const notThere = heroIsDisplaced(state) && monster.mnum !== 39;
    let displacement = 0;
    if (state?.underwater || state?.u?.uinwater)
        displacement = 1;
    else if (notSeen)
        displacement = monster.mnum === PM_XORN && heroGoldAmount(state) ? 0 : 1;
    else if (notThere) {
        displacement = rememberedX !== undefined && Number.isFinite(rememberedX)
            && rememberedY !== undefined && Number.isFinite(rememberedY)
            && couldsee(rememberedX, rememberedY) ? 2 : 1;
    }
    if (!displacement) {
        monster.mux = heroX;
        monster.muy = heroY;
        return true;
    }
    const foundHero = notSeen
        ? recordPerceptionRandom(random, calls, 3) === 0
        : notThere ? recordPerceptionRandom(random, calls, 4) === 0 : false;
    if (foundHero) {
        monster.mux = heroX;
        monster.muy = heroY;
        return true;
    }
    const passesWalls = monsterPassesWalls(monster.mnum);
    for (let attempt = 0; attempt < 200; attempt++) {
        const x = heroX - displacement
            + recordPerceptionRandom(random, calls, 2 * displacement + 1);
        const y = heroY - displacement
            + recordPerceptionRandom(random, calls, 2 * displacement + 1);
        if (!isok(x, y))
            continue;
        if (displacement !== 2 && x === monster.mx && y === monster.my)
            continue;
        const location = state?.level?.at?.(x, y);
        const closedDoor = !!location && IS_DOOR(location.typ)
            && !!(location.doormask & (D_CLOSED | D_LOCKED));
        const canUseClosedDoor = closedDoor
            && (monsterCanOoze(monster)
                || monsterCanFog(monster, state));
        if ((x !== heroX || y !== heroY)
            && !passesWalls && !isAccessibleAt(x, y, state) && !canUseClosedDoor)
            continue;
        if (!couldsee(x, y))
            continue;
        monster.mux = x;
        monster.muy = y;
        return true;
    }
    monster.mux = heroX;
    monster.muy = heroY;
    return true;
}
// Part of C monmove.c:dochug(): the hostile-move item and target
// selection.
// Also C monmove.c:leppie_avoidance(): inlined here.
async function moveHostile(monster, state, random, rollDice, rollOne, calls, capabilities) {
    let oldx = monster.mx;
    let oldy = monster.my;
    // monmove.c:m_move() refreshes the apparent target exactly once
    // (monmove.c:1761), before every actor specialization including
    // shk_move(), pri_move(), and gd_move().  This refresh is
    // RNG-visible for an invisible or displaced hero and survives the
    // special actor's return: a gd_move() fall-through keeps the mux/muy
    // its own mnexto() -> rloc_to() refresh established.
    setMonsterApparentHeroPosition(monster, state, random, calls);
    requirePerceivedHero(monster);
    if (!monster.wormno && monsterIsCovetous(monster)
        && monster.mgoal && isok(monster.mgoal.x, monster.mgoal.y)) {
        const intruder = monsterAtPosition(state.level, monster.mgoal.x, monster.mgoal.y);
        if (intruder && intruder !== monster
            && dist2(monster.mx, monster.my, monster.mgoal.x, monster.mgoal.y) <= 2) {
            const attack = await beginMonsterMeleeAttack(monster, intruder, state, random, rollDice, rollOne, calls, null, monster.mgoal);
            return {
                oldx, oldy, x: monster.mx, y: monster.my, moved: false,
                heroDied: !!attack.heroDied,
                postMoveStatus: monsterAttackStopsAggressor(attack) ? MMOVE_DIED : MMOVE_MOVED,
                movementStage: 'postmov',
            };
        }
    }
    // monmove.c:m_move() dispatches shopkeeper, guard, and priest movement
    // after this one refresh.  gd_move() returning -1 (vault.ts returns
    // null) falls through to ordinary movement below with no further
    // set_apparxy(), keeping the mux/muy its own mnexto() -> rloc_to()
    // refresh established (teleport.c:1702).
    if (!monster.wormno) {
        const priestMovement = await movePriest(monster, state, random, rollDice, rollOne, calls);
        if (priestMovement)
            return priestMovement;
        const shopMovement = await moveShopkeeper(monster, state, random, rollDice, rollOne, calls);
        if (shopMovement)
            return shopMovement;
        if (monster.isgd && monster._egd) {
            const guardMovement = await moveVaultGuard(monster, state, random, calls);
            if (guardMovement)
                return guardMovement;
        }
    }
    // monmove.c:m_move() not_special: omx/omy are re-read here, so a guard
    // that gd_move() relocated and then fell through (-1) moves on from its
    // new square.
    oldx = monster.mx;
    oldy = monster.my;
    const finishMovement = (movement, postMoveStatus, movementStage) => ({
        ...movement,
        postMoveStatus,
        movementStage,
    });
    // monmove.c:m_move() gives every tengu its innate one-in-five teleport
    // probe before swallowed-state and ordinary candidate movement.  A
    // noteleport level rejects the relocation only after that draw;
    // tele_restrict() emits its refusal line, then m_move() continues into
    // ordinary destination selection below.
    if (!monster.wormno && monster.mnum === PM_TENGU) {
        const wantsTeleport = recordRandom(random, calls, 5) === 0;
        if (wantsTeleport && !monster.mcan
            && !await reportMonsterTeleportRestriction(monster, { state })) {
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
                const destination = enexto(monster.mnum, state.u.ux, state.u.uy, {
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
            || (shouldSee && heroIsInvisible(state) && !monsterPerceives(monster?.mnum)
                && recordRandom(random, calls, 11) !== 0)
            || heroObjectAppearance === 0 || state.u.uundetected
            || (heroObjectAppearance === GOLD_PIECE
                && !likes_gold(monster.mnum))
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
        const trackable = canTrack(monster.mnum, state);
        if (!shouldSee && trackable) {
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
        const throwsRocks = monsterThrowsRocks(heroSpecies(state));
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
    if (capabilities.canTunnel && needspick(monster?.mnum)
        && (!monster.mpeaceful || heroHasConflict(state))
        && dist2(oldx, oldy, monster.mux, monster.muy) <= 8)
        capabilities.canTunnel = false;
    const allowFlags = monAllowFlags(monster, state, rollOne, calls);
    const candidates = await mfndpos(monster, state, allowFlags);
    if (!candidates.length && !isUnicorn(monster)) {
        const defense = find_defensive(monster, state, { tryEscape: true, random });
        if (defense && (await use_defensive(monster, defense, { state, random, rollDice, rollOne })).nativeResult) {
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
// Part of C monmove.c:dochug(): resume the selected offensive item use
// after movement.
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
        const result = await use_offensive(action.monster, offensive.choice, {
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
// Part of C wizard.c:tactics(): the STRAT_HEAL fall-through and STRAT_NONE
// harassment beside the hero.
// wizard.c:tactics(), STRAT_HEAL fall-through and STRAT_NONE: an occasional
// mnexto() beside the hero; dochug() continues after the arrival line.
async function runCovetousHarassTactics(monster, state, random, calls) {
    if (monsterTeleportRestricted(monster, state) ||
        recordRandom(random, calls, monster.mflee ? 33 : 5) !== 0) {
        return;
    }
    await moveMonsterNextToHero(monster, state, { flags: RLOC_MSG, random });
}
// C monmove.c:maybe_spin_web(). Webmakers spin in place, walls permitting.
// Also C monmove.c:soko_allow_web(): inlined here.
// Also C monmove.c:count_webbing_walls(): inlined here.
async function maybeSpinMonsterWeb(monster, movement, state, random, rollDice, calls) {
    if (![94, 96].includes(monster?.mnum) ||
        monster.mcanmove === 0 ||
        monster.msleeping ||
        monster.mspec_used ||
        trapAt(state, monster.mx, monster.my))
        return null;
    // C monmove.c:soko_allow_web(): in unsolved Sokoban, only when the
    // spinner sees the up stairs.
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
    // C trap.c:count_traps(WEB).
    const existingWebs = count_traps(WEB, state);
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
// Part of C monmove.c:postmov(): its awaited mon.c hideunder call site.
// mon.c:hideunder(), awaited at its monmove.c:postmov() call site: the
// "You see ..." line pages before the square is repainted, and postmov()
// continues into after_shk_move() and the dochug() tail afterwards.
async function postMoveHideUnder(monster, movement, state, random, calls) {
    const originalSpecies = requireMovementCapabilities(movement).species;
    const hidesUnder = monsterHidesUnder(originalSpecies);
    const eel = monsterIsEel(originalSpecies);
    if (!hidesUnder && !eel)
        return;
    const helpless = !monster.mcanmove || monster.msleeping || (monster.mfrozen ?? 0) > 0;
    if (monster.mundetected || (!helpless && recordRandom(random, calls, 5) !== 0))
        await finishMonsterHideUnder(monster, beginMonsterHideUnder(monster, state), state);
    // postmov() redraws even when hideunder() leaves concealment unchanged
    // or the monster skips the attempt. Hallucinations need that refresh.
    await newsym(monster.mx, monster.my);
}
// Part of C monmove.c:dochug(): the post-movement tail (range recheck,
// engulf digest, attack continuation).
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
        if (!monsterFliesOrFloats({ mnum: dochugContext.entryMnum })
            && (!monsterIsClinger(dochugContext.entryMnum) || !levelHasCeiling(state)))
            disturbBuriedZombies(monster.mx, monster.my, state);
        if (monsterIsHelpless(monster))
            return;
        const canContinue = !range.nearby &&
            (monsterHasAvailableDistanceAttack(monster, limit => recordRandom(random, calls, limit)) ||
                speciesHasWeaponAttack(dochugContext.entryMnum) ||
                find_offensive(monster, state, {
                    random: limit => recordRandom(random, calls, limit),
                }));
        if (!canContinue) {
            // An engulfing monster may digest the hero after moving even
            // though an ordinary adjacent monster must wait another turn.
            if (state.u.uswallow && state.u.ustuck === monster) {
                const attack = await mattacku(monster, state, random, rollOne, rollDice, calls);
                attachMonsterAttack(movement, attack);
            }
            return;
        }
    }
    await beginStandardMonsterAttack(monster, movement, state, random, rollOne, rollDice, calls, dochugContext);
}
// Part of C monmove.c:dochug(): phase four — the final standard-attack
// decision.
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
    const attack = await mattacku(monster, state, random, rollOne, rollDice, calls);
    attachMonsterAttack(movement, attack);
    if (attack.heroAttackSequence?.offensive)
        movement.actionCompleted = true;
}
// Port only: attach an initiated monster attack to its movement record.
function attachMonsterAttack(movement, attack) {
    if (attack.heroAttackSequence !== undefined)
        movement.heroAttackSequence = attack.heroAttackSequence;
    if (attack.heroAttackResult !== undefined)
        movement.heroAttackResult = attack.heroAttackResult;
}
// Part of C monmove.c:postmov(): the early-out when the actor's move
// already ended.
// C postmov() has separate gates for movement effects and the floor tail.
// Whether the coordinates changed does not select either gate.
function movementHasEnded(movement) {
    return !!(movement.actorLeftLevel ||
        movement.actorDied ||
        movement.postMoveStatus === MMOVE_DIED);
}
// C monmove.c:postmov().  The door, trap, tunneling, and hiding feedback
// belongs here, awaited inline in C order after the actor's move.
// C monmove.c:postmov(): the awaited post-move effects (door, trap,
// tunneling, hiding).
export async function completeMovedMonsterAction(monster, movement, state, random, rollDice, rollOne, calls, dochugContext) {
    if (movement.deferredAfterSpecialAttack)
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
        // trap.c mintrap(): the trap's message, escape roll, and effect
        // completions run inline here, before postmov() continues with the
        // door, tunneling, and floor tails.
        const outcome = (await mintrap(monster, state, {
            movement, random, rollDice, rollOne, calls,
            describeMonster: visibleMonsterSubject,
        })).movement.trapOutcome;
        if (outcome === 'hero-died')
            return movement;
        if (outcome === 'killed') {
            // C postmov() repaints the destination before returning
            // MMOVE_DIED for a trap that killed the actor (monmove.c:1512);
            // the presenter must not paint this return's cell a second
            // time, which would consume an extra display-RNG draw.
            await newsym(movement.x, movement.y);
            movement.postMoveDestinationPainted = true;
            return movement;
        }
        if (movementHasEnded(movement) || state.program_state.gameover)
            return movement;
        requireMovementCapabilities(movement).species = monster.mnum;
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
            && mayDig(monster.mx, monster.my, state)) {
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
            // monmove.c:1656-1659: only call newsym() when this is not a
            // vault guard parked off the map at <0,0>; other off-map
            // coordinates still reach newsym() and its diagnostic.
            const { mx, my } = monster;
            if (mx !== 0) {
                if (!state.in_mklev && !state.program_state.saving && !isok(mx, my)) {
                    const reason = `newsym: attempting screen update for <${mx},${my}>`;
                    if (mx < 0 || my < 0 || mx >= COLNO || my >= ROWNO)
                        await panic(reason, { state });
                    await impossible(reason, { state });
                }
                else
                    await newsym(mx, my);
            }
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
// Part of C monmove.c:postmov(): the web, hiding, and shopkeeper floor
// tail.
async function finishMonsterFloorTail(monster, movement, state, random, rollDice, rollOne, calls, dochugContext) {
    await maybeSpinMonsterWeb(monster, movement, state, random, rollDice, calls);
    await postMoveHideUnder(monster, movement, state, random, calls);
    if (monster.isshk) {
        if (!hasShopkeeperData(monster))
            throw new Error('A shopkeeper must retain its shop state');
        await afterShopkeeperMove(monster, state);
    }
    await finishDochugAfterMovement(monster, movement, state, random, rollOne, rollDice, calls, dochugContext);
}
// Part of C monmove.c:m_move(): the direct m_move(monster, 0) entry.
// Native m_move(monster, 0), including its leading mintrap() escape attempt
// for an already-trapped actor.  A direct caller owns no dochug prelude or
// post-move attack continuation beyond the m_move tail itself.
export async function beginMonsterMove(monster, state = requireInitializedGame(), random = rn2, rollDice = d, rollOne = rnd) {
    const turn = await moveMonsterAfterTrap(monster, state, random, rollDice, rollOne, DISCARDED_CALL_LOG, undefined, null);
    return { monster, ...turn };
}
// Part of C monmove.c:dochug(): the "Demonic Blackmail!" phase-two block
// (whispers at thin air, angering, or the bribe), which ends by calling C
// minion.c:demon_talk() (demandDemonBribe in minion.ts).
export async function talkToDemon(monster, state, random = rn2, rollOne = rnd) {
    if (monster.mux !== state.u.ux || monster.muy !== state.u.uy) {
        await plineWithContinuation(`${cansee(monster.mux ?? 0, monster.muy ?? 0)
            ? monsterName(monster, { state, capitalized: true }) : 'It'} whispers at thin air.`);
        if (monsterIsDemon(heroSpecies(state))) {
            if (!await reportMonsterTeleportRestriction(monster, { state }))
                await randomMonsterRelocation(monster, { state, flags: RLOC_MSG, random, rollOne });
        }
        else {
            monster.minvis = monster.perminvis = false;
            await plineWithContinuation(`${monsterName(monster, { state, capitalized: true, article: 'a' })} gets angry!`);
            monster.mpeaceful = 0;
            setMonsterMalign(monster, state);
        }
        return false;
    }
    return demandDemonBribe(monster, state, random, rollOne);
}
// Part of C monmove.c:dochug(), m_move(), dogmove.c:dog_move(): the shared
// per-turn movement phases.
// Part of monmove.c:dochug()'s phases two and three — distfleeck, defensive
// and misc items, demon blackmail, watch duty, mind blast, weapon readying,
// movement and its status switch — shared with m_move() and dog_move().
// distfleeck() always draws the brave-gremlin roll; ordinary starting actors
// then choose and own a live adjacent destination before the post-move draw.
export async function takeMonsterTurn(monster, state, random = rn2, rollDice = d, rollOne = rnd) {
    const calls = DISCARDED_CALL_LOG;
    const dochugContext = {
        entryMnum: monster.mnum,
        range: null,
        reachesFinalActions: false,
    };
    // monmove.c:dochug() erodes text beneath every awake, mobile actor
    // before confusion/fleeing checks and the first set_apparxy().
    wipeEngravingAt(monster.mx, monster.my, 1, false, state?.level);
    // Status recovery and fleeing checks happen before movement.
    if (monster.mconf && recordRandom(random, calls, 50) === 0)
        monster.mconf = 0;
    if (monster.mstun && recordRandom(random, calls, 10) === 0)
        monster.mstun = 0;
    if (monster.mflee) {
        const teleports = recordRandom(random, calls, 40) === 0 &&
            !!(monsterCanTeleport(monster.mnum)) &&
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
    setMonsterApparentHeroPosition(monster, state, random, calls);
    // wizard.c:tactics().  A covetous relocation has already awaited its
    // arrival line; dochug() continues from the new position.
    if (monsterIsCovetous(monster)) {
        const strategy = chooseCovetousStrategy(monster, state);
        if (strategy.kind === 'heal') {
            const retreat = await retreatCovetousMonster(monster, state, random, rollOne);
            if (retreat === 'harass')
                await runCovetousHarassTactics(monster, state, random, calls);
        }
        else if (strategy.kind === 'target') {
            const result = await pursueCovetousTarget(monster, strategy.target, state);
            if (result === 'blocked-ground' && recordRandom(random, calls, 5) === 0
                && !monsterTeleportRestricted(monster, state)) {
                await moveMonsterNextToHero(monster, state, { flags: RLOC_MSG, random });
            }
        }
        else {
            await runCovetousHarassTactics(monster, state, random, calls);
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
    // dochug() refreshes perception after tactics, before it checks the
    // hero's distance and scariness.
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
    const defense = find_defensive(monster, state, { random });
    if (defense) {
        const result = await use_defensive(monster, defense, { state, random, rollDice, rollOne });
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
    const miscChoice = defense ? null : await find_misc(monster, state, random, calls);
    if (miscChoice) {
        const result = await use_misc(monster, miscChoice, state, random, calls);
        if (result.nativeResult)
            return {
                calls, dochugContext,
                movement: {
                    oldx: monster.mx, oldy: monster.my, x: monster.mx, y: monster.my,
                    moved: false, usedMisc: result, heroDied: result.heroDied,
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
    // If monster is nearby you, and has to wield a weapon, do so. This
    // costs the monster a move (C monmove.c:dochug() phase two). The scared
    // check keeps a fleeing pick-carrier from toggling between pick-axe and
    // weapon; a monster stuck in a trap prefers its ranged weapon (wielding
    // happens in thrwmu). The transition is deliberately RNG-free but
    // changes every later actor's stream.
    let readiedCloseWeapon = false;
    if (!(monster.mpeaceful && !heroHasConflict(state)) && range.inRange
        && speciesHasWeaponAttack(monster.mnum)
        && monster.weaponCheck === NEED_WEAPON) {
        const apparentX = isFiniteNumber(monster.mux) ? monster.mux : state?.u?.ux;
        const apparentY = isFiniteNumber(monster.muy) ? monster.muy : state?.u?.uy;
        if (isFiniteNumber(apparentX) && isFiniteNumber(apparentY)
            && dist2(monster.mx, monster.my, apparentX, apparentY) <= 8) {
            const weapon = monsterWieldedWeapon(monster);
            if (!((range.scared && weapon && isPick(weapon))
                || (monster.mtrapped && !range.nearby
                    && selectMonsterRangedWeapon(monster, state)))) {
                monster.weaponCheck = NEED_HTH_WEAPON;
                readiedCloseWeapon = !!await wieldMonsterWeapon(monster, state);
            }
        }
    }
    if (readiedCloseWeapon) {
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
        (is_wanderer(entryMnum) && recordRandom(random, calls, 4) === 0) ||
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
        }
        : null;
    const moved = await moveMonsterAfterTrap(monster, state, random, rollDice, rollOne, calls, dochugContext, movement);
    return { ...moved, dochugContext };
}
// C monmove.c:m_move(): a monster's move, from its trapped escape attempt
// to its post-move effects.
export async function moveMonsterAfterTrap(monster, state, random, rollDice, rollOne, calls, dochugContext, movement) {
    // monmove.c:m_move(): an already-trapped actor gets one mintrap()
    // escape attempt, with its pull-free line awaited inline, before any
    // eating, hiding, or destination work.
    if (!movement && monster.mtrapped) {
        const oldx = monster.mx;
        const oldy = monster.my;
        await mintrap(monster, state, {
            random,
            publish: plineWithContinuation,
            describeMonster: visibleMonsterSubject,
            calls,
        });
        if (monster.mtrapped) {
            // Trap_Caught_Mon: m_move() returns MMOVE_NOTHING without
            // postmov(); dochug() still owns the trailing distfleeck()
            // and a possible attack from inside the trap.
            const held = {
                oldx, oldy,
                x: monster.mx, y: monster.my,
                moved: false,
                trapped: true,
                postMoveStatus: MMOVE_NOTHING,
                movementStage: 'dochug',
            };
            await finishDochugAfterMovement(monster, held, state, random, rollOne, rollDice, calls, dochugContext);
            return { calls, movement: held, ...(dochugContext ? { dochugContext } : {}) };
        }
    }
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
        monsterHidesUnder(monster?.mnum) &&
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
        const postMoveCapabilities = {
            species: monster.mnum,
            canOpen: monsterCanOpenDoor(monster),
            canUnlock: monsterCanUnlockDoor(monster),
            canTunnel: tunnels(monster.mnum) && !Is_rogue_level(state.u.uz, state),
            wasSeen: canSeeMonster(monster),
            wasSpotted: canSpotMonster(monster),
        };
        if (!monster.wormno && (monster.pet || monster.mtame)) {
            setMonsterApparentHeroPosition(monster, state, random, calls);
            movement = await movePet(monster, state, random, rollDice, rollOne, calls);
        }
        else {
            // Hostile actors (including gd_move() fall-through) refresh the
            // apparent hero position once inside moveHostile(), matching
            // monmove.c:m_move()'s single set_apparxy() before its actor
            // specializations.
            movement = await moveHostile(monster, state, random, rollDice, rollOne, calls, postMoveCapabilities);
        }
        movement.postMoveCapabilities = postMoveCapabilities;
        await completeMovedMonsterAction(monster, movement, state, random, rollDice, rollOne, calls, dochugContext);
        return { calls, movement, ...(dochugContext ? { dochugContext } : {}) };
    }
    if (!movement.spellCast?.cast)
        await finishDochugAfterMovement(monster, movement, state, random, rollOne, rollDice, calls, dochugContext);
    return { calls, movement, ...(dochugContext ? { dochugContext } : {}) };
}
// C monmove.c:dochug(): the phase-one entry (arrival, wait masks, quest
// status, frozen and sleeping rejection), then the phase-two/three
// continuation in takeMonsterTurn() below. This is the port of the whole C
// function without movemon_singlemon()'s hiding and Conflict checks, so
// direct callers such as shop entry do not spend a scheduled movement
// ration. m_arrival() is inlined (C monmove.c:m_arrival()).
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
// Part of C monmove.c:postmov(): repaint the squares postmov left
// unpainted.
// Trap, door, tunneling, and hiding feedback belongs to postmov(), which the
// movement owners await inline.  This repaints the squares postmov() left
// unpainted when an earlier phase returned before its redraw, for callers
// that resolve a movement transaction outside the ordinary turn driver.
export async function presentMonsterPostMove(action, game) {
    const movement = action.movement;
    if (movement?.moved || movement?.postMoveOldSquarePainted) {
        if (!movement.postMoveOldSquarePainted)
            await newsym(movement.oldx, movement.oldy);
        // C postmov() repaints the moved actor only while it still has a
        // map position: after a trap that carried it elsewhere, the redraw
        // is `if (mtmp->mx) newsym(mtmp->mx, mtmp->my); return MMOVE_DIED;`
        // (monmove.c:1510-1513).  A trap that migrated it off the level
        // zeroes mx (dog.c migrate_to_level "mx==0 implies migrating"), so
        // neither square is repainted for it here.
        if (!movement.postMoveDestinationPainted && action.monster.mx)
            await newsym(movement.x, movement.y);
    }
    return !!game.program_state.gameover || !!movement.heroDied;
}
// Port only: publish a movement's deferred message.
export async function presentMonsterMoveMessage(action, game) {
    const movement = action.movement;
    if (movement?.message)
        await plineWithContinuation(movement.message);
}
// Part of C monmove.c:dochug(): the message and continuation order after
// a scheduled turn.
// Complete the same action and message phases for scheduled turns and
// direct dochug() calls. The caller owns movement rations and dochugw().
export async function presentMonsterAction(action, game) {
    if (game.program_state?.gameover)
        return 'stop';
    if (game._questExpulsionPending) {
        await performQuestExpulsion(game);
        return 'stop';
    }
    if (action.conflictFight)
        return 'next-monster';
    // C dochug() returns after gelcube_digests(), before attacks or cursing.
    if (action.movement.digestedInventory)
        return 'next-monster';
    // C dochug() returns immediately when item use spends the turn.
    if (action.movement?.usedDefense)
        return 'next-monster';
    if (action.movement.usedMisc)
        return action.movement.usedMisc.checkOccupation ? 'check-occupation' : 'next-monster';
    let { monster, movement } = action;
    // A fleeing teleport spends this actor's turn, even if no destination was found.
    if (movement?.fleeingRelocation || movement?.fleeingTeleportFailed)
        return 'next-monster';
    if (movement?.spellCast?.cast) {
        // dochug() chooses the movement spell after covetous tactics,
        // so a resumed relocation can still produce this casting phase.
        if (canSpotMonster(monster)) {
            await plineWithContinuation(`${visibleMonsterSubject(monster)} casts a spell!`);
        }
        // C mcastu.c:castmu(FALSE,FALSE) passes zero damage, so
        // mcast_spell() runs the undirected effect as one awaited
        // transaction, then dochug() resumes at its second distfleeck()
        // and the phase-four tail.
        await mcastSpell(monster, movement.spellCast.spell, 0, movementSpellContext(monster, game, action.calls));
        movement.postMoveStatus = MMOVE_DONE;
        movement.movementStage = 'dochug';
        await finishDochugAfterMovement(monster, movement, game, rn2, rnd, d, action.calls, requireDochugContext(action));
        movement = action.movement;
    }
    if (await presentMonsterPostMove(action, game))
        return 'stop';
    const attackEffects = await presentMonsterAttackEffects(action, game);
    if (attackEffects.heroDied)
        return 'stop';
    movement = action.movement;
    // monmove.c:dochug() performs the vile-monster emotional attack only
    // after the complete standard attack set. Item use returns earlier,
    // including items whose effects await their messages below.
    const offensive = movement.heroAttackSequence?.offensive;
    const attackReturnedDeath = movement.heroAttackResult === 1
        || (offensive?.status === 'completed' && offensive.result.nativeResult === 1);
    if (action.dochugContext?.reachesFinalActions && !movement.usedMisc
        && !attackReturnedDeath && !monster.dead && monster.mhp > 0
        && monster.mcanmove && !monster.msleeping
        && action.dochugContext.range?.nearby)
        await talkQuestCharacter(monster, game);
    if (game._questExpulsionPending) {
        await performQuestExpulsion(game);
        return 'stop';
    }
    if (action.dochugContext?.reachesFinalActions
        && !movement.usedMisc && !attackReturnedDeath && action.dochugContext.range?.inRange
        && !monster.dead && monster.mhp > 0 && monster.mx !== 0
        && MONSTER_SOUND[monster.mnum] === 34 && !monster.mpeaceful
        && couldsee(monster.mx, monster.my) && !monster.minvis) {
        const cussGate = rn2(5);
        action.calls.push('rn2(5)');
        if (cussGate === 0)
            movement.deferredCuss = true;
    }
    if (movement?.deferredCuss) {
        movement.deferredCuss = false;
        await presentMonsterCuss(action);
    }
    movement = action.movement;
    await presentMonsterMoveMessage(action, game);
    return 'check-occupation';
}
// Part of C monmove.c:dochug(): the direct-call composition. Shop entry
// (C shk.c:914 calls dochug(shkp) synchronously) gives its keeper an
// immediate action, including resumed messages and attacks, without
// movemon()'s per-turn work.
export async function performMonsterTurn(monster, state = requireInitializedGame()) {
    const previousDeferral = state._deferVisibleMonsterContact;
    try {
        state._deferVisibleMonsterContact = true;
        const action = await beginMonsterDochug(monster, state);
        state._deferVisibleMonsterContact = false;
        await presentMonsterAction(action, state);
    }
    finally {
        state._deferVisibleMonsterContact = previousDeferral;
    }
}
// Part of C monmove.c:dochug(): the vile monster's cuss.
async function presentMonsterCuss(action) {
    await publishMonsterCuss(action.monster, requireInitializedGame(), sides => {
        action.calls.push(`rn2(${sides})`);
        return rn2(sides);
    });
}
// C monmove.c:accessible(), including SURFACE_AT() at a raised drawbridge.
// C monmove.c:accessible(), including SURFACE_AT() at a raised drawbridge.
export function isAccessibleAt(x, y, state = game) {
    const location = state.level?.at(x, y);
    if (!location)
        return false;
    const surface = location.typ === DRAWBRIDGE_UP
        ? drawbridgeUnderlyingType(location.drawbridgemask ?? 0) : location.typ;
    const closedDoor = location.typ === DOOR
        && ((location.doormask ?? 0) & (D_CLOSED | D_LOCKED));
    return ACCESSIBLE(surface) && !closedDoor;
}
//# sourceMappingURL=monmove.js.map