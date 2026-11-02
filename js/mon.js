import { game, requireInitializedGame, requirePlayingGame, requireGameLevel, requireLiveGame } from './gstate.js';
import { adjustMonsterSpeed, monsterSpeedMessage, setMonsterPermanentInvisibility, bypassObject, clearBypasses } from './worn.js';
import { isAccessibleAt, isLavaAt, isPoolAt, levelIsWaterLevel, monsterFliesOrFloats, monsterInAir, levelHasCeiling, } from './terrain_properties.js';
import { canMonsterHideUnderObjectAt, interruptOccupationForMonster, makeMonsterFlee, monsterCanBreakBoulder, monsterHasKey, monsterIsScaredAt, monsterSightingBeforeAction, monsterCanFog, requirePerceivedHero, presentMonsterAction, runMonsterAction, runMonsterEveryturnEffects, monsterWantsFloorObject, setMonsterApparentHeroPosition, } from './monmove.js';
import { ALLOW_ALL, ALLOW_BARS, ALLOW_DIG, ALLOW_M, ALLOW_MDISP, ALLOW_ROCK, ALLOW_SANCT, ALLOW_SSM, ALLOW_TM, ALLOW_TRAPS, ALLOW_U, ALLOW_WALL, A_CHA, BUSTDOOR, COLNO, D_BROKEN, D_CLOSED, D_LOCKED, IRONBARS, IS_DOOR, IS_OBSTRUCTED, IS_STWALL, IS_TREE, LAVAWALL, NOGARLIC, NOTONL, NO_WEAPON_WANTED, OPENDOOR, RLOC_MSG, RLOC_NOMSG, ROWNO, SHOPBASE, TELEP_TRAP, TEMPLE, TRAPNUM, UNLOCKDOOR, W_ARMS, W_NONDIGGABLE, W_NONPASSWALL, WT_TOOMUCH_DIAGONAL, FOUNTAIN, G_GENOD, MON_FLOOR, MSLOW, STRAT_WAITFORU, WATER, isok, COULD_SEE, IN_SIGHT, M_AP_MONSTER, M_AP_NOTHING, MGIVENNAME, M_AP_TYPE, MIGR_APPROX_XY, MIGR_RANDOM, MON_LIMBO, PLNMSG_HIDE_UNDER, M_AP_FURNITURE, M_AP_OBJECT, IS_WALL, SDOOR, TREE, LARGEST_INT, MAX_CARR_CAP, WT_HUMAN, ROOM, STRAT_WAITMASK, Is_rogue_level, is_pit, NORMAL_SPEED, ACH_MEDU, BOLT_LIM, CORPSTAT_FEMALE, CORPSTAT_HISTORIC, CORPSTAT_INIT, CORPSTAT_MALE, DISMOUNT_GENERIC, DOOR, G_NOCORPSE, GPCOORDS_MAP, GPCOORDS_NONE, In_endgame, MFAST, MON_DETACH, NON_PM, W_ARM, W_ARMC, W_ARMG, W_ARMU, engulfing_u, ismnum, thats_enough_tries, MON_OFFMAP, OBJECT_TIMER_KIND } from './const.js';
import { dryFountainAt } from './fountain.js';
import { canSeeMonster, canSpotMonster, displayLiquidName, newsym, canSenseMonster, monsterKillLineVisible, unmap_invisible, swallowed, } from './display.js';
import { plineWithContinuation, plineWithContinuation as pline } from './pline.js';
import { splitMonster } from './potion.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL, monsterGrowthFamilyMatch, monsterHasNoHands, monsterIsHuman, monsterIsVampireShifter, monsterIsVerySmall, monsterIsWhirly, monsterTypeName, monsterYoungerForm, monsterIsNoncorporeal, monsterIsRider, monsterSpeciesSticks, monsterIsUndead, monsterIsUnicorn, monsterIsUnsolid, MONSTER_COLOR, MONSTER_DIFFICULTY, MONSTER_RESISTS, MONSTER_SOUND, SPECIAL_PM, monsterCanEngulf, monsterClassSymbol, monsterDigests, monsterHasHead, monsterIsAmorphous, monsterIsDisplacer, MONSTER_BODY_META, MONSTER_HAS_WEAPON_ATTACK, monsterHatesSilver, monsterIsCovetous, monsterIsKop, monsterIsNonliving, monsterIsPlayerMonster, monsterIsSlimeproof, requireMonsterData, speciesEatsCorpses, } from './monster_data.js';
import { monsterName, namelessMonsterName, setMonsterGivenName, formatMonsterName } from './do_name.js';
import { possessiveName, dist2, ordinalSuffix, pointsOnline } from './hacklib.js';
import { monsterHasFireResistance, monsterHasSeductionAttack, monsterHasStoneResistance, monsterCorrodesBars, monsterPassesBars, monsterLocomotion, monsterFireDescription, monsterPolymorphsWhenStoned, nameToMonster, resolveMonsterClass, monsterHasPoisonResistance, setMonsterSpecies, } from './mondata.js';
import { AXE, BATTLE_AXE, BOULDER, CARROT, CLOVE_OF_GARLIC, CORPSE, DWARVISH_MATTOCK, EGG, GLOB_OF_GRAY_OOZE, GLOB_OF_GREEN_SLIME, ICE_BOX, OBJECT_WEIGHT, PICK_AXE, TIN, AMULET_OF_STRANGULATION, BOOMERANG, BULLWHIP, CLUB, ELVEN_SPEAR, GRAPPLING_HOOK, GRAY_DRAGON_SCALES, IRON_CHAIN, LEASH, LEATHER_ARMOR, LEATHER_CLOAK, BELL_OF_OPENING, OBJECT_DESCRIPTIONS, QUARTERSTAFF, RIN_SLOW_DIGESTION, ROCK, SADDLE, SCR_BLANK_PAPER, SCR_SCARE_MONSTER, SMALL_SHIELD, STATUE, UNICORN_HORN, WORM_TOOTH, WORTHLESS_PIECE_OF_VIOLET_GLASS, WORTHLESS_PIECE_OF_WHITE_GLASS, } from './object_data.js';
import { objectsInTimerGraph, stopObjectTimer } from './timeout.js';
import { d, rn2, rnd, rn1, rnl } from './rng.js';
import { DISCARDED_CALL_LOG } from './monster_action_types.js';
import { dealWithMonsterOvercrowding, randomMonsterRelocation, relocateMonsterTo } from './teleport.js';
import { reportMonsterTeleportRestriction, monsterTeleportRestricted, findNearbyMonsterPosition, goodPosition } from './teleport_rules.js';
import { fireDamageChain } from './fire_damage.js';
import { monsterTrapIsHarmless, trapAt, waterDamageChain, monsterSelfTouch, monsterWearsGloves } from './trap.js';
import { formatFeltMessage, formatHeardMessage, formatSeenMessage } from './hero_speech.js';
import { setMimicAppearance, growMonster, finishMonsterGrowth, makemonAt, newMonsterHitPoints } from './makemon.js';
import { objectName, observeDistantObjectForNaming, simpleObjectNameWithArticle, corpseName } from './objnam.js';
import { monsterHasMapPosition, monsterAtPosition, adjustRiderAfterSteedPolymorph, dismountHero, placeMonsterOnMap, } from './steed.js';
import { heroResistsStoning, touchPetrifies, fleshPetrifies } from './stoning.js';
import { thawObject } from './container.js';
import { applyFloorEffects, landFloorObject } from './floor_effects.js';
import { placeObject, placeCreatedObject, stack_object } from './floor_object.js';
import { AD_POLY, AD_COLD, AD_ELEC, AD_FIRE, AT_NONE, AD_DCAY, AD_DGST, AD_RUST, AT_BOOM, AT_ENGL, AT_GAZE, } from './monster_attack_types.js';
import { removeObjectFromMonsterInventory, reassessMonsterArmor, adjustMonsterClothingAfterPolymorph, checkMonsterGearNextTurn, findMonsterArmorClass, applyMonsterEquipmentProperties, clearMonsterCarriedObjectState, } from './monworn.js';
import { addObjectToMonsterInventory, dropSpecialMonsterObjects, releaseMonsterInventory } from './steal.js';
import { isLevelPrize } from './level_prize.js';
import { objectMaterial } from './o_init.js';
import { beginMonsterMealMimicry, finishMonsterEating, monsterCouldReachItem } from './dogmove.js';
import { splitObjectStack } from './mkobj.js';
import { makePlural } from './objnam.js';
import { unpunishHero } from './punishment.js';
import { capitalizedDefiniteName } from './ray_hit_message.js';
import { surfaceName } from './terrain_name.js';
import { heroSpecies, heroFormSticks, heroIsAmphibious } from './hero_species.js';
import { cansee, couldsee, hasLightSources, monsterHasLineOfSightToHero, vision_recalc, monsterEmitsLight, vision_note_blocker_change, } from './vision.js';
import { monsterSentenceSubject, publishMonsterGrowl } from './ambient_sounds.js';
import { currentAttribute } from './attrib.js';
import { heroHasConflict } from './hero_conflict.js';
import { isReviver, isZombieMaker, zombieForm, isRider } from './corpse_species.js';
import { insideWizardTower, sameDungeonLevel, level_difficulty } from './dungeon.js';
import { monsterWieldedWeapon, unwieldMonsterWeapon, updateMonsterWeaponAfterPolymorph } from './weapon.js';
import { wormCrossesBetween, clearMonsterWormFromMap, initializeMonsterWormBody, redrawMonsterWormSegments, removeMonsterWormBody, } from './worm.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { heroIsDisplaced, dragonFormForArmor } from './armor.js';
import { GAS_OK, monsterGasTolerance, visibleRegionAt, createPoisonGasCloud } from './regions.js';
import { monsterKnowsTrap } from './mondata.js';
import { hasTrack } from './track.js';
import { inHeroSanctuary, ghodHitsu, priestIsCoaligned, templeRoomAt } from './priest.js';
import { roomsAt } from './room.js';
import { impossible } from './diagnostics.js';
import { wereChange, isHumanWereMonster, isWereMonster, transformWereMonster } from './were.js';
import { badRockForMonster, disturbBuriedZombies } from './hack.js';
import { adjustHeroAlignment } from './alignment.js';
import { deleteEngravingAt, hasCompletedEngraving } from './engrave.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { questMonsterSound } from './role_monsters.js';
import { releaseHeroFromMonster, expelHero } from './hero_expulsion.js';
import { currentDungeonLevel, migrateMonsterOffLevel } from './dog.js';
import { finishScheduledLevelChange } from './level_change.js';
import { moveVaultGuard } from './vault.js';
import { LL_ACHIEVE, LL_UMONST, recordGameLogEvent } from './gamelog.js';
import { recordAchievement } from './achievements.js';
import { SHOP_TYPES } from './shknam.js';
import { buryObject } from './dig.js';
import { displayMessageWindow } from './tty_topline.js';
import { meldNearbyFloorGlobs } from './glob.js';
import { mkcorpstat, mkgold, mksobj, discardMonsterInventory, unlinkMonsterObject, unlinkObject, addObjectToContainer } from './mkobj.js';
import { preventMonsterDeath, lifeSaveMonster, wornMonsterLifeSaver } from './mondeath.js';
import { markQuestLeaderDead, markQuestNemesisDead } from './quest.js';
import { objectWeight } from './weight.js';
import { aggravateMonsters, monsterCarriesSpecialObject, pickNastyShape, wizardDeadOrGone } from './wizard.js';
import { veganCorpse } from './food_traits.js';
import { heroStomachName } from './body_parts.js';
import { loseHeroHp } from './hero_damage.js';
import { prepareVaultGuardDeath } from './vault_guard.js';
import { armorThiefGone } from './steal.js';
import { hasShopkeeperData } from './shop_types.js';
import { objectResistsDestruction } from './zap.js';
import { endObjectBurn } from './light.js';
import { chooseCorpseIntrinsic, shouldGiveIntrinsic } from './corpse_intrinsics.js';
import { monsterCanTouchArtifact } from './artifacts.js';
import { reviveCorpseImmediately } from './corpse_revival.js';
import { inventoryItemDescription, delobj } from './invent.js';
import { shopkeeperInOwnShop, hotPursuitShopkeeper, finishShopkeeperDeparture } from './shk.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { addExperience, checkExperienceLevel, monsterExperience } from './exper.js';
import { heroHasOlfaction, heroMonsterForm, pickFormFromClass } from './polyself.js';
import { getLine } from './query.js';
import { coordinateDescription } from './pager.js';
import { toptenMonsterForm } from './topten.js';
import { recordHeroKillConduct } from './end.js';
import { heroLocomotion } from './hero_locomotion.js';
import { createPhysicalMonsterExplosion } from './explosion.js';
import { stopHeroOccupation } from './occupation.js';
import { resolveMonsterGaze } from './mhitu.js';
import { monsterCanBeLeashed, releaseMonsterLeash, releaseMonsterLeashWithFeedback } from './apply.js';
const M1_SWIM = 0x00000002;
const M1_AMORPHOUS = 0x00000004;
const M1_WALLWALK = 0x00000008;
const M1_CLING = 0x00000010;
const M1_NEEDPICK = 0x00000040;
const M1_MINDLESS = 0x00010000;
const M1_SLITHY = 0x00080000;
const M1_SEE_INVIS = 0x01000000;
const M1_REGEN = 0x00800000;
const M1_AMPHIBIOUS = 0x00000200;
const M1_BREATHLESS = 0x00000400;
const M1_TPORT = 0x02000000;
const PM_GREMLIN = 40;
const PM_IRON_GOLEM = 259;
const PM_FIRE_ELEMENTAL = 155;
const PM_SALAMANDER = 329;
const PM_BABY_PURPLE_WORM = 113;
const PM_PURPLE_WORM = 115;
const PM_SHRIEKER = 163;
const PM_FLOATING_EYE = MONSTER_NAME.indexOf('floating eye');
const PM_GRID_BUG = MONSTER_NAME.indexOf('grid bug');
const S_EEL = 57;
// C mhitm.c:paralyze_monst(). Paralysis also interrupts eating and waiting.
export function paralyzeMonster(monster, turns) {
    monster.mcanmove = 0;
    monster.mfrozen = Math.min(127, turns);
    monster.meating = 0;
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITFORU;
}
// C healmon(). Overhealing can increase the monster's maximum health.
export function healMonster(monster, amount, overheal = 0) {
    const before = monster.mhp;
    monster.mhp = Math.min(monster.mhp + amount, monster.mhpmax + overheal);
    monster.mhpmax = Math.max(monster.mhpmax, monster.mhp);
    return monster.mhp - before;
}
export async function applyMonsterGolemEffects(monster, damageType, damage, { state = game, publish = plineWithContinuation, } = {}) {
    const species = MONSTER_NAME[monster.mnum];
    let healing = 0;
    let slow = false;
    if (species === 'flesh golem') {
        if (damageType === AD_ELEC)
            healing = Math.trunc((damage + 5) / 6);
        else
            slow = damageType === AD_FIRE || damageType === AD_COLD;
    }
    else if (species === 'iron golem') {
        slow = damageType === AD_ELEC;
        if (damageType === AD_FIRE)
            healing = damage;
    }
    else
        return;
    if (slow && monster.mspeed !== MSLOW) {
        const change = adjustMonsterSpeed(monster, -1);
        if (!state.in_mklev && change.changed && change.canDescribe && canSeeMonster(monster)) {
            const message = monsterSpeedMessage(change, monsterSentenceSubject(monster), state);
            if (message)
                await publish(message);
        }
    }
    if (healing && healMonster(monster, healing) && cansee(monster.mx, monster.my))
        await publish(`${monsterSentenceSubject(monster)} seems healthier.`);
}
export function speciesWasGenocided(mnum, state) {
    return !!((state.mvitals?.[mnum]?.mvflags ?? 0) & G_GENOD);
}
function eggSpeciesWasGenocided(egg, state) {
    const mnum = egg?.corpsenm;
    if (mnum === undefined || !Number.isInteger(mnum) || mnum < 0)
        return true;
    return speciesWasGenocided(mnum, state)
        || speciesWasGenocided(monsterYoungerForm(mnum), state);
}
export function killGenocidedMonster(monster, state) {
    return finishEnvironmentalMonsterDeath(monster, state, { noCorpse: true });
}
// C mon.c:kill_genocided_monsters().  Genocide is not a hero kill: it drops
// carried objects, creates no corpse or experience, and sterilizes eggs.
export async function killGenocidedMonsters(state = game) {
    if (state !== game)
        throw new Error('genocide removal requires the live game state');
    const killed = [];
    const reshaped = [];
    for (const monster of [...(state.level?.monsters || [])].reverse()) {
        if (monster.dead || (monster.mhp ?? 1) <= 0)
            continue;
        const baseWasGenocided = monster.cham !== undefined && Number.isInteger(monster.cham)
            && monster.cham >= 0
            && speciesWasGenocided(monster.cham, state);
        if (!speciesWasGenocided(monster.mnum, state)
            && !baseWasGenocided)
            continue;
        if (monster.cham !== undefined && Number.isInteger(monster.cham) && monster.cham >= 0
            && !baseWasGenocided) {
            const change = await changeMonsterForm(monster, null, state, { showMessage: true });
            if (change?.heroDied)
                return { killed, reshaped, heroDied: true };
            if (change)
                reshaped.push(monster);
            continue;
        }
        const death = await killGenocidedMonster(monster, state);
        killed.push(death);
        if (death.heroDied)
            return { killed, reshaped, heroDied: true };
    }
    const sterileEggs = [];
    for (const object of objectsInTimerGraph(state)) {
        if (object.otyp !== EGG || !eggSpeciesWasGenocided(object, state))
            continue;
        stopObjectTimer(object, OBJECT_TIMER_KIND.HATCH_EGG);
        sterileEggs.push(object);
    }
    return { killed, reshaped, sterileEggs };
}
export function monsterSurvivesPool(monster, { waterWall = false } = {}) {
    const flags = MONSTER_FLAGS1[monster?.mnum] ?? 0;
    const safeFlags = M1_SWIM | M1_AMPHIBIOUS | M1_BREATHLESS
        | (waterWall ? 0 : M1_CLING);
    return !!(flags & safeFlags);
}
function heroKeepsSteedAboveLiquid(monster, state, waterWall) {
    if (waterWall || state.u?.usteed !== monster)
        return false;
    return !!(state.u?.flying || state.flying
        || state.u?.levitating || state.u?.levitation || state.levitating);
}
export function rollMonsterPoolReaction(monster, state = game, { random = rn2, rollDice = d } = {}) {
    const location = state.level?.at?.(monster?.mx, monster?.my);
    const waterWall = location?.typ === WATER;
    const waterLevel = levelIsWaterLevel(state);
    const safelyAirborne = !waterWall && !waterLevel
        && monsterFliesOrFloats(monster);
    if (heroKeepsSteedAboveLiquid(monster, state, waterWall)
        || safelyAirborne) {
        return { kind: 'safe' };
    }
    // Breathlessness prevents drowning, but does not protect an iron body
    // from rust. C checks this reaction before the drowning predicates.
    if (monster.mnum === PM_IRON_GOLEM && random(5) === 0) {
        const damage = rollDice(2, 6);
        return {
            kind: 'rust',
            damage,
        };
    }
    if (monsterSurvivesPool(monster, { waterWall }))
        return { kind: 'safe' };
    return { kind: 'drown' };
}
function monsterLikesLava(monster) {
    return monster?.mnum === PM_FIRE_ELEMENTAL
        || monster?.mnum === PM_SALAMANDER;
}
export function monsterLavaReaction(monster, state = game) {
    const location = state.level?.at?.(monster?.mx, monster?.my);
    if (!location || !isLavaAt(monster.mx, monster.my, state))
        return null;
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const likesLava = monsterLikesLava(monster);
    if (monsterInAir(monster, state) || (flags & M1_CLING) || likesLava)
        return { kind: 'safe' };
    const fireResistant = monsterHasFireResistance(monster);
    return { kind: fireResistant ? 'scorch' : 'burn' };
}
export async function resolveMonsterLiquid(monster, state = game, { announce = async () => { }, finishDeath, monsterMoving = true, random = rn2, rollDice = d, rollOne = rnd, } = {}) {
    if (!monster)
        return null;
    const calls = [];
    const x = monster.mx;
    const y = monster.my;
    const location = state.level?.at?.(x, y);
    if (!monster || monster.dead || (monster.mhp ?? 1) <= 0 || !location)
        return null;
    if (typeof finishDeath !== 'function') {
        throw new TypeError('minliquid requires the monster death handler');
    }
    const sadFeeling = !!monster.mtame && !canSeeMonster(monster);
    const finishFatalLiquid = async (cause, leaveCorpse) => {
        // mondead()/xkilled() own recovery. In particular, xkilled records
        // conduct and pet responsibility before an amulet can save the victim.
        return finishDeath(monster, { state, random, rollOne, leaveCorpse, cause, sadFeeling, publish: announce });
    };
    const waterLevel = levelIsWaterLevel(state);
    const waterWall = location.typ === WATER;
    if (heroKeepsSteedAboveLiquid(monster, state, waterWall))
        return { survived: true };
    const inPool = isPoolAt(x, y, state)
        && (!monsterFliesOrFloats(monster) || waterLevel);
    const inLava = isLavaAt(x, y, state) && !monsterFliesOrFloats(monster);
    const inFountain = location.typ === FOUNTAIN;
    if (monster.mnum === PM_GREMLIN && (inPool || inFountain)
        && random(3) !== 0) {
        const clone = await splitMonster(monster, state, {
            monsterMoving,
            random,
            publish: announce,
        });
        let fountainDried = false;
        if (clone && inFountain) {
            fountainDried = await dryFountainAt(x, y, {
                causedByHero: false, random, state, publish: announce,
            });
        }
        if (inPool) {
            await waterDamageChain(monster.minvent || monster.inventory || [], [], state, { publish: announce });
        }
        return { kind: 'split', survived: true, clone, fountainDried };
    }
    if (inPool || waterWall) {
        const reaction = rollMonsterPoolReaction(monster, state, {
            random, rollDice,
        });
        if (reaction.kind === 'rust') {
            if (state === game && cansee(x, y))
                await announce(`${monsterName(monster, { state, capitalized: true })} rusts.`);
            monster.mhp = (monster.mhp ?? 1) - reaction.damage;
            if (monster.mhpmax > reaction.damage)
                monster.mhpmax -= reaction.damage;
            if (monster.mhp <= 0) {
                const death = await finishFatalLiquid('rust', true);
                if (state.program_state.gameover || monster.dead || monster.mhp <= 0)
                    return death;
            }
            await waterDamageChain(monster.minvent || monster.inventory || [], [], state, { publish: announce });
        }
        else if (reaction.kind === 'drown') {
            const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
            if ((flags & M1_TPORT)
                // tele_restrict() reports the blocked escape.
                && !await reportMonsterTeleportRestriction(monster, { state, publish: announce })) {
                const relocation = await randomMonsterRelocation(monster, {
                    state, calls, random, rollOne, flags: RLOC_MSG,
                });
                if (relocation)
                    return { survived: true, relocation };
            }
            if (state === game && cansee(x, y))
                await announce(monsterMoving
                    ? `${monsterName(monster, { state, capitalized: true })} drowns.`
                    : `You drown ${monsterName(monster, { state })}.`);
            if (state.u.uswallow && state.u.ustuck === monster) {
                const name = monsterName(monster, { state, capitalized: true });
                await announce(`${name} sinks as ${displayLiquidName('water', state)} rushes in and flushes you out.`);
            }
            monster.mhp = 0;
            const death = await finishFatalLiquid('drowning', true);
            if (state.program_state.gameover || monster.dead || monster.mhp <= 0)
                return death;
            if (monsterInAir(monster, state))
                return { survived: true };
            await waterDamageChain(monster.minvent || monster.inventory || [], [], state, { publish: announce });
            const relocation = await randomMonsterRelocation(monster, {
                state, calls, random, rollOne, flags: RLOC_NOMSG,
            });
            // C rloc() repaints both squares; minliquid() adds no redraw.
            if (!relocation)
                await dealWithMonsterOvercrowding(monster, state);
            if (state.program_state.gameover)
                return { heroDied: true };
            return { survived: true, relocation };
        }
    }
    else {
        const lava = monsterLavaReaction(monster, state);
        if (lava && lava.kind !== 'safe') {
            const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
            if ((flags & M1_TPORT)
                // tele_restrict() reports the blocked escape.
                && !await reportMonsterTeleportRestriction(monster, { state, publish: announce })) {
                const relocation = await randomMonsterRelocation(monster, {
                    state, calls, random, rollOne, flags: RLOC_MSG,
                });
                if (relocation)
                    return { survived: true, relocation };
            }
            if (lava.kind === 'scorch') {
                monster.mhp = (monster.mhp ?? 1) - 1;
                if (state === game && cansee(x, y)) {
                    const verb = monster.mhp <= 0
                        ? 'surrenders to the fire' : 'burns slightly';
                    await announce(`${monsterName(monster, { state, capitalized: true })} ${verb}.`);
                }
            }
            else {
                monster.mhp = 0;
                if (state === game && cansee(x, y)) {
                    const heat = monsterFireDescription(monster, AT_NONE);
                    const verb = heat === 'boiling' ? 'boils away'
                        : heat === 'melting' ? 'melts away' : 'burns to a crisp';
                    await announce(`${monsterName(monster, { state, capitalized: true })} ${verb}.`);
                }
            }
            if (monster.mhp <= 0) {
                const death = await finishFatalLiquid(lava.kind === 'scorch'
                    ? 'lava-scorch' : 'lava-burning', false);
                if (state.program_state.gameover || monster.dead || monster.mhp <= 0)
                    return death;
            }
            if (monsterInAir(monster, state) || monsterLikesLava(monster))
                return { survived: true };
            await fireDamageChain(monster.minvent || monster.inventory || [], {
                carrier: monster,
                publish: announce,
                random,
                state,
            });
            const relocation = await randomMonsterRelocation(monster, {
                state, calls, random, rollOne, flags: RLOC_MSG,
            });
            // C rloc() repaints both squares; minliquid() adds no redraw.
            if (!relocation)
                await dealWithMonsterOvercrowding(monster, state);
            if (state.program_state.gameover)
                return { heroDied: true };
            return { survived: true, relocation };
        }
    }
    if (!inPool && !inLava && MONSTER_SYMBOL[monster.mnum] === S_EEL && !waterLevel
        && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_BREATHLESS)) {
        if (monster.mhp > 1 && random(monster.mhp) > random(8))
            monster.mhp--;
        const flight = await makeMonsterFlee(monster, {
            state, turns: 2, announce: false, publish: announce, random, rollOne,
        });
        if (flight.heroDied)
            return { heroDied: true };
    }
    return null;
}
const UNDEAD_CORPSE_TYPES = new Map([
    [239, 59], [187, 59], // kobold zombie/mummy -> kobold
    [242, 44], [190, 44], // dwarf zombie/mummy -> dwarf
    [240, 165], [188, 165], // gnome zombie/mummy -> gnome
    [241, 72], [189, 72], // orc zombie/mummy -> orc
    [243, 264], [191, 264], // elf zombie/mummy -> elf
    [226, 260], [227, 260], [244, 260], [192, 260],
    [247, 169], [194, 169], // giant zombie/mummy -> giant
    [245, 174], [193, 174], // ettin zombie/mummy -> ettin
]);
// C mon.c:undead_to_corpse().
export function undeadToCorpse(mndx) {
    return UNDEAD_CORPSE_TYPES.get(mndx) ?? mndx;
}
// ---------------------------------------------------------------------------
// C mon.c:movemon()/mcalcdistress()/mon_allowflags()/mfndpos() and the
// mon.c parts of monster scheduling those functions share.
// ---------------------------------------------------------------------------
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}
// JS stores monsters in creation order by appending to level.monsters.
// C's makemon() prepends to fmon, so all scheduler traversals are reversed.
export function monstersInFmonOrder(monsters = []) {
    return Array.from(monsters).reverse();
}
// C mon.c:movemon() schedules a monster when it is alive, on the map, and
// not held in a non-floor state. x=0 is NetHack's off-map sentinel; y=0 is
// the valid north row.
export function schedulable(monster) {
    return (monster &&
        (monster.mhp ?? 1) > 0 &&
        (monster.mstate ?? MON_FLOOR) === MON_FLOOR &&
        monster.mx !== 0);
}
// C ref: mon.c mcalcdistress()/m_calcdistress(). JS appends monsters while C
// prepends them to fmon, so this once-per-global-turn phase traverses the
// reverse of creation order just like movement allocation does. Yielding at
// each transformation lets its messages and consequences finish before the
// next source-ordered random decision.
export async function* monsterDistressEvents(monsters = [], state = requireInitializedGame(), random = rn2, distressTurn = state.moves ?? 1, publish = plineWithContinuation) {
    for (const monster of monstersInFmonOrder(monsters)) {
        if (!schedulable(monster))
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
// C mon.c:movemon() movement allocation: every schedulable monster earns
// this turn's movement points before any of them acts.
export function allocateMonsterMovement(monsters = [], random = rn2, state = requireInitializedGame()) {
    for (const monster of monstersInFmonOrder(monsters)) {
        const amount = mcalcmove(monster, true, random, state);
        monster.movement = (monster.movement ?? 0) + amount;
    }
}
function speciesIsUnique(mnum) {
    return !!((MONSTER_GENO[mnum] ?? 0) & 0x1000);
}
// C mon.c:mm_2way_aggression().
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
// C mon.c:mm_aggression().
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
// C mondata.c:resist_conflict(). High-charisma heroes convince monsters
// bound by the ring of conflict's charm more easily; there is always a
// small chance at 19.
export function resistConflict(monster, state, rollOne, calls) {
    const charisma = currentAttribute(A_CHA, state);
    const monsterLevel = monster?.m_lev ?? MONSTER_LEVEL[monster?.mnum] ?? 0;
    const heroLevel = state?.u?.ulevel ?? 1;
    const resistChance = Math.min(19, charisma - monsterLevel + heroLevel);
    const roll = rollOne(20);
    calls.push('rnd(20)');
    return roll > resistChance;
}
// Native mon.c:mon_allowflags(). Conflict resistance belongs to the moving
// caller (monAllowFlags below); these helpers compute the body-based bits.
const M1_TUNNEL = 0x00000020;
const M1_UNSOLID = 0x00100000;
const M1_METALLIVORE = 0x80000000;
const M2_MINION = 0x00001000;
const M2_GIANT = 0x00002000;
const M2_ROCKTHROW = 0x08000000;
const S_GHOST = 54;
const MZ_LARGE = 3;
const PM_MINOTAUR = MONSTER_NAME.indexOf('minotaur');
export function monsterMovementBaseFlags(monster, state = game) {
    let flags = monster.mtame
        ? ALLOW_M | ALLOW_TRAPS | ALLOW_SANCT | ALLOW_SSM
        : monster.mpeaceful ? ALLOW_SANCT | ALLOW_SSM : ALLOW_U;
    const body = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const kind = MONSTER_FLAGS2[monster.mnum] ?? 0;
    if (monster.isshk)
        flags |= ALLOW_SSM;
    if (monster.ispriest)
        flags |= ALLOW_SSM | ALLOW_SANCT;
    if (body & M1_WALLWALK)
        flags |= ALLOW_ROCK | ALLOW_WALL;
    if (kind & M2_ROCKTHROW || monsterCanBreakBoulder(monster))
        flags |= ALLOW_ROCK;
    if (monsterCanTunnel(monster, state))
        flags |= ALLOW_DIG;
    if (kind & M2_GIANT)
        flags |= BUSTDOOR;
    if (monsterCanOpenDoor(monster))
        flags |= OPENDOOR;
    if (monsterCanUnlockDoor(monster))
        flags |= UNLOCKDOOR;
    if (monsterPassesBars(monster)
        && (monster !== state.u.ustuck || carriedHeroPassesBars(state)))
        flags |= ALLOW_BARS;
    if (kind & M2_MINION || monsterIsRider(monster))
        flags |= ALLOW_SANCT;
    if (monsterIsUnicorn(monster.mnum) && !monsterTeleportRestricted(monster, state))
        flags |= NOTONL;
    if (monsterIsHuman(monster.mnum) || monster.mnum === PM_MINOTAUR)
        flags |= ALLOW_SSM;
    if (monsterIsUndead(monster.mnum) && MONSTER_SYMBOL[monster.mnum] !== S_GHOST
        || monsterIsVampireShifter(monster))
        flags |= NOGARLIC;
    return flags;
}
export function monsterCanOpenDoor(monster) {
    return !monsterHasNoHands(monster.mnum) && !monsterIsVerySmall(monster.mnum);
}
export function monsterCanUnlockDoor(monster) {
    return monsterCanOpenDoor(monster) && monsterHasKey(monster, true)
        || !!monster.iswiz || monsterIsRider(monster);
}
export function monsterCanTunnel(monster, state = game) {
    const body = MONSTER_FLAGS1[monster.mnum] ?? 0;
    if (!(body & M1_TUNNEL) || Is_rogue_level(state.u.uz, state))
        return false;
    if (!(body & M1_NEEDPICK) || monster.mpeaceful && !heroHasConflict(state))
        return true;
    const { mux: targetX, muy: targetY } = monster;
    if (targetX === undefined || targetY === undefined)
        throw new Error('A tunneling monster needs its perceived hero position.');
    return dist2(monster.mx, monster.my, targetX, targetY) > 8;
}
function carriedHeroPassesBars(state) {
    const species = heroSpecies(state);
    return monsterIsUnsolid({ mnum: species }) || monsterIsVerySmall(species);
}
// Effects of a monster consuming an object. C refs: mon.c m_consume_obj()
// and meatbox().
const PM_GELATINOUS_CUBE = MONSTER_NAME.indexOf('gelatinous cube');
const PM_QUEEN_BEE = MONSTER_NAME.indexOf('queen bee');
const PM_GREEN_SLIME = MONSTER_NAME.indexOf('green slime');
const PM_NURSE = MONSTER_NAME.indexOf('nurse');
const PM_WRAITH = MONSTER_NAME.indexOf('wraith');
const M1_NOEYES = 0x00001000;
const M2_SHAPESHIFTER = 0x00004000;
const MIMIC_SPECIES = new Set(['small mimic', 'large mimic', 'giant mimic'].map(name => MONSTER_NAME.indexOf(name)));
function polymorphFood(object) {
    if (![CORPSE, EGG, TIN].includes(object.otyp)
        || object.corpsenm === undefined || object.corpsenm < 0)
        return false;
    return !!((MONSTER_FLAGS2[object.corpsenm] ?? 0) & M2_SHAPESHIFTER)
        || !!MONSTER_ATTACKS[object.corpsenm]?.some(([, damage]) => damage === AD_POLY);
}
async function emptyEatenContainer(monster, object, state, publish, random) {
    const x = monster.mx, y = monster.my;
    if (!object.contents?.length || !isok(x, y))
        return;
    const cube = monster.mnum === PM_GELATINOUS_CUBE;
    if (!cube && cansee(x, y)) {
        observeDistantObjectForNaming(object, state);
        const container = possessiveName(capitalizedDefiniteName(objectName(object, state), state));
        await publish(`${container} contents spill out onto the ${surfaceName(x, y, state)}.`);
    }
    for (const content of [...object.contents]) {
        unlinkObject(content, state);
        if (object.otyp === ICE_BOX)
            thawObject(content, state);
        if (cube)
            await addObjectToMonsterInventory(monster, content, state);
        else {
            const landing = await applyFloorEffects(content, x, y, { state, publish, random });
            if (landing.heroDied)
                return;
            if (!landing.finished)
                await placeObject(content, x, y, state);
        }
        if (state.program_state.gameover)
            return;
    }
}
export async function growAfterFood(monster, state, { publish = plineWithContinuation, random = rn2, rollOne = rnd, } = {}) {
    const growth = growMonster(monster, { state, random, rollOne });
    if (!growth.changedSpecies)
        return;
    if (canSpotMonster(monster))
        await publish(growth.message);
    finishMonsterGrowth(monster, growth);
    await newsym(monster.mx, monster.my);
    if (growth.genocided)
        await finishEnvironmentalMonsterDeath(monster, state, { publish, random });
}
function foodSpecies(object) {
    return [CORPSE, EGG, TIN].includes(object.otyp)
        && object.corpsenm !== undefined && object.corpsenm >= 0
        ? object.corpsenm : null;
}
export async function consumeMonsterObject(monster, object, state = game, { publish = plineWithContinuation, random = rn2, rollOne = rnd, rollDice = d } = {}) {
    const level = state.level;
    const isPet = !!monster.mtame;
    if (!isPet && monster.mhp < monster.mhpmax)
        healMonster(monster, OBJECT_WEIGHT[object.otyp] ?? 0, 0);
    await emptyEatenContainer(monster, object, state, publish, random);
    if (state.program_state.gameover || monster.migrating || state.level !== level)
        return;
    if (object === (state.uball || state.u.uball)) {
        await unpunishHero(state);
        await delobj(object, state);
        return;
    }
    if (object === (state.uchain || state.u.uchain)) {
        await unpunishHero(state);
        return;
    }
    const species = foodSpecies(object);
    const corpse = object.otyp === CORPSE ? species : null;
    const slime = object.otyp === GLOB_OF_GREEN_SLIME;
    const poly = polymorphFood(object);
    const grows = species === PM_WRAITH;
    const heals = species === PM_NURSE;
    const curesEyes = object.otyp === CARROT;
    const petrifies = species !== null && fleshPetrifies(species);
    const mimic = corpse !== null && MIMIC_SPECIES.has(corpse);
    const visible = canSeeMonster(monster);
    await delobj(object, state);
    if (state.program_state.gameover)
        return;
    if (poly || slime) {
        const change = await changeMonsterForm(monster, slime ? PM_GREEN_SLIME : null, state, { showMessage: visible, publish });
        if (change?.heroDied || state.program_state.gameover || monster.migrating || state.level !== level)
            return;
    }
    if (grows && (!isPet || (monster.m_lev ?? 0) < (MONSTER_LEVEL[monster.mnum] ?? 0) + 15))
        await growAfterFood(monster, state, { publish, random, rollOne });
    if (state.program_state.gameover || monster.migrating || state.level !== level)
        return;
    if (petrifies) {
        const stoneForm = await turnGolemToStone(monster, publish);
        if (stoneForm?.heroDied)
            return;
        if (!stoneForm && !monsterHasStoneResistance(monster)) {
            if (visible)
                await publish(`${monsterName(monster, { state, capitalized: true })} turns to stone!`);
            const stoning = await prepareMonsterPetrification(monster, { publish });
            if (stoning.heroDied)
                return;
            if (!stoning.survived)
                await finishEnvironmentalMonsterDeath(monster, state, {
                    noCorpse: true, stoneRemains: stoning.remains ?? null, publish, random, rollDice,
                });
        }
    }
    if (state.program_state.gameover || monster.migrating || state.level !== level)
        return;
    if (heals)
        healMonster(monster, monster.mhpmax, 0);
    if ((curesEyes || heals) && !monster.mcansee) {
        monster.mcansee = 1;
        monster.mblinded = 0;
        if (canSeeMonster(monster) && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_NOEYES))
            await publish(`${monsterName(monster, { state, capitalized: true })} can see again.`);
    }
    if (isPet && mimic)
        await beginMonsterMealMimicry(monster, state);
    if (corpse !== null)
        await grantMonsterCorpseIntrinsic(monster, corpse, state);
}
// C mon.c:mon_allowflags().
export function monAllowFlags(monster, state, rollOne = rnd, calls = DISCARDED_CALL_LOG) {
    const flags = monsterMovementBaseFlags(monster, state);
    return heroHasConflict(state) && !resistConflict(monster, state, rollOne, calls)
        ? flags | ALLOW_U : flags;
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
export function monsterMayDigLocation(loc) {
    if (!loc)
        return false;
    return !((IS_STWALL(loc.typ) || IS_TREE(loc.typ)) && (loc.wall_info ?? 0) & W_NONDIGGABLE);
}
// ---------------------------------------------------------------------------
// C mon.c:can_touch_safely(), curr_mon_load(), max_mon_load() and can_carry().
// ---------------------------------------------------------------------------
const COIN_CLASS = 12, GEM_CLASS = 13;
const M1_NOHANDS = 0x00002000;
const M2_STRONG = 0x04000000;
const M2_GREEDY = 0x10000000;
const M2_JEWELS = 0x20000000;
const M2_COLLECT = 0x40000000;
const M2_MAGIC = 0x80000000;
const MZ_HUMAN = 2;
const SILVER = 14;
const RIDERS = new Set(['Death', 'Pestilence', 'Famine']
    .map(name => MONSTER_NAME.indexOf(name)));
export function monsterCanTouchObject(monster, object, state = game) {
    if (object.otyp === CORPSE && object.corpsenm !== undefined) {
        if (touchPetrifies(object.corpsenm)
            && !((monster.misc_worn_check ?? 0) & W_ARMG)
            && !monsterHasStoneResistance(monster))
            return false;
        if (RIDERS.has(object.corpsenm))
            return false;
    }
    if (objectMaterial(object, state) === SILVER && monsterHatesSilver(monster)
        && (object.otyp !== BELL_OF_OPENING || !monsterIsCovetous(monster)))
        return false;
    return monsterCanTouchArtifact(monster, object, state);
}
export function currentMonsterLoad(monster) {
    const flags = MONSTER_FLAGS2[monster.mnum] ?? 0;
    return (monster.minvent ?? []).reduce((total, object) => {
        if (object.otyp === BOULDER && (flags & M2_ROCKTHROW))
            return total;
        return total + object.owt;
    }, 0);
}
export function maxMonsterLoad(monster) {
    const bodyWeight = MONSTER_BODY_META[monster?.mnum]?.[0] ?? 0;
    const size = MONSTER_SIZE[monster?.mnum] ?? 0;
    const strong = !!((MONSTER_FLAGS2[monster?.mnum] ?? 0) & M2_STRONG);
    let capacity;
    if (!bodyWeight)
        capacity = Math.trunc(MAX_CARR_CAP * size / MZ_HUMAN);
    else if (!strong || bodyWeight > WT_HUMAN)
        capacity = Math.trunc(MAX_CARR_CAP * bodyWeight / WT_HUMAN);
    else
        capacity = MAX_CARR_CAP;
    if (!strong)
        capacity = Math.trunc(capacity / 2);
    return Math.max(1, capacity);
}
export function monsterCarryAmount(monster, object, state = game, random = rn2) {
    if (!monster || !object)
        return 0;
    const flags1 = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const flags2 = MONSTER_FLAGS2[monster.mnum] ?? 0;
    if ((flags1 & M1_NOTAKE) || !monsterCanTouchObject(monster, object, state))
        return 0;
    const quantity = object.quan > LARGEST_INT
        ? 20000 + random(LARGEST_INT - 20000 + 1) : object.quan;
    if (quantity > 1) {
        const canTakeWholeStack = MONSTER_SYMBOL[monster.mnum] === S_DRAGON
            && (object.oclass === COIN_CLASS || object.oclass === GEM_CLASS)
            || (MONSTER_ATTACKS[monster.mnum] || [])
                .some(([attackType]) => attackType === AT_ENGL);
        if ((flags1 & M1_NOHANDS) && !canTakeWholeStack)
            return 1;
    }
    if (monster === state.u.usteed)
        return 0;
    if (monster.isshk)
        return quantity;
    if (monster.mpeaceful && !monster.mtame)
        return 0;
    if ((flags2 & M2_ROCKTHROW) && object.otyp === BOULDER)
        return quantity;
    if (MONSTER_SYMBOL[monster.mnum] === S_NYMPH)
        return object.oclass === ROCK_CLASS ? 0 : quantity;
    return currentMonsterLoad(monster) + object.owt
        <= maxMonsterLoad(monster) ? quantity : 0;
}
export function monsterCanCarryObject(monster, object, state = game, random = rn2) {
    return monsterCarryAmount(monster, object, state, random) > 0;
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
export async function mfndpos(monster, state, flags = monAllowFlags(monster, state)) {
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
                    if (trap.ttyp <= 0 || trap.ttyp >= TRAPNUM) {
                        await impossible(`A monster looked at a very strange trap of type ${trap.ttyp}.`, { state });
                        continue;
                    }
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
// Shared hiding decisions. C refs: mon.c restrap(), hideunder(), and
// maybe_unhide_at(); monmove.c can_hide_under_obj() lives in monmove.ts.
const M1_FLY = 0x1;
const M1_CONCEAL = 0x80, M1_HIDE = 0x100, M1_NOLIMBS = 0x6000;
const S_EYE = 5, S_MIMIC = 13, S_LIGHT = 25;
export async function attemptMonsterRestrap(monster, state = game, { random = rn2, calls } = {}) {
    requireLiveGame(state);
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    if (!(flags & M1_HIDE) || monster.mcan || M_AP_TYPE(monster)
        || ((state.viz_array?.[monster.my]?.[monster.mx] ?? 0) & IN_SIGHT))
        return false;
    calls?.push(3);
    if (random(3) !== 0 || state.u.ustuck === monster)
        return false;
    const level = requireGameLevel(state);
    const trap = level.traps.find(candidate => candidate.tx === monster.mx && candidate.ty === monster.my);
    if (monster.mtrapped && trap && !is_pit(trap.ttyp))
        return false;
    const mimic = MONSTER_SYMBOL[monster.mnum] === S_MIMIC;
    const ceilingHider = !!((flags & M1_CLING) && !mimic) || !!(flags & M1_FLY);
    if (ceilingHider && !levelHasCeiling(state))
        return false;
    const adjacent = Math.max(Math.abs(monster.mx - state.u.ux), Math.abs(monster.my - state.u.uy)) <= 1;
    if (canSenseMonster(monster) && adjacent)
        return false;
    if (mimic) {
        if (monster.msleeping || monster.mfrozen)
            return false;
        await setMimicAppearance(monster);
        return true;
    }
    if (level.at(monster.mx, monster.my)?.typ !== ROOM)
        return false;
    monster.mundetected = 1;
    return true;
}
// Capture names while the creature is visible, then change its hidden state.
// The caller publishes this message before repainting, so a pending More keeps
// the pre-concealment screen until the player acknowledges the earlier line.
export function beginMonsterHideUnder(monster, state = game) {
    requireLiveGame(state);
    const seen = !state.in_mklev && canSeeMonster(monster);
    const place = hidingPlace(monsterHidingActor(monster, state), state);
    let message = null;
    if (seen) {
        const cover = place.water ? 'the water'
            : place.cover ? simpleObjectNameWithArticle(place.cover, state) : null;
        const subject = monsterName(monster, {
            state, article: monster.mtame ? 'your' : 'the',
            suppressSaddle: !!MGIVENNAME(monster) || monster === state.u.usteed,
        });
        if (place.undetected && cover) {
            const verb = place.water ? 'dive' : monsterLocomotion(monster.mnum, 'hide');
            message = formatSeenMessage(`${subject} ${verb} under ${cover}.`, state);
        }
    }
    const oldUndetected = !!monster.mundetected;
    monster.mundetected = place.undetected ? 1 : 0;
    return { undetected: place.undetected, oldUndetected, message };
}
export async function finishMonsterHideUnder(monster, concealment, state = game) {
    if (concealment.message) {
        await plineWithContinuation(concealment.message);
        state._lastPlineKind = PLNMSG_HIDE_UNDER;
        state.last_hider = monster.m_id;
    }
    if (concealment.undetected !== concealment.oldUndetected)
        await newsym(monster.mx, monster.my);
}
export async function hideMonsterUnder(monster, state = game) {
    const concealment = beginMonsterHideUnder(monster, state);
    await finishMonsterHideUnder(monster, concealment, state);
    return concealment.undetected;
}
// C mon.c:hideunder(&youmonst) reassesses cover without announcing hero hiding.
export async function hideHeroUnder(state = game) {
    requireLiveGame(state);
    const oldUndetected = !!state.u.uundetected;
    const { undetected } = hidingPlace(heroHidingActor(state), state);
    state.u.uundetected = undetected ? 1 : 0;
    if (undetected !== oldUndetected)
        await newsym(state.u.ux, state.u.uy);
    return undetected;
}
export async function maybeUnhideAt(x, y, state = game) {
    const monster = state.level?.monsters.find(candidate => monsterHasMapPosition(candidate, state)
        && !candidate.dead && candidate.mx === x && candidate.my === y);
    const isHero = !monster && state.u.ux === x && state.u.uy === y;
    if (!monster && !isHero)
        return;
    if (!(monster ? monster.mundetected : state.u.uundetected))
        return;
    const actor = monster ? monsterHidingActor(monster, state) : heroHidingActor(state);
    const hidesUnder = !!((MONSTER_FLAGS1[actor.species] ?? 0) & M1_CONCEAL);
    const eel = MONSTER_SYMBOL[actor.species] === S_EEL;
    const exposed = hidesUnder && (actor.trapped || !canMonsterHideUnderObjectAt(state, x, y))
        || eel && !isPoolAt(x, y, state);
    if (!exposed)
        return;
    const hidden = hidingPlace(actor, state).undetected;
    if (monster)
        monster.mundetected = hidden ? 1 : 0;
    else
        state.u.uundetected = hidden ? 1 : 0;
    if (!hidden)
        await newsym(x, y);
}
function heroHidingActor(state) {
    return {
        species: heroSpecies(state), x: state.u.ux, y: state.u.uy,
        held: false, trapped: !!state.u.utrap, tame: false,
        stoneResistant: heroResistsStoning(state),
    };
}
function monsterHidingActor(monster, state) {
    return {
        species: monster.mnum, x: monster.mx, y: monster.my,
        held: state.u.ustuck === monster, trapped: !!monster.mtrapped,
        tame: !!monster.mtame, stoneResistant: monsterHasStoneResistance(monster),
    };
}
function hidingPlace(actor, state) {
    const { x, y } = actor;
    const nowhere = { undetected: false, cover: null, water: false };
    if (actor.held || actor.trapped)
        return nowhere;
    const level = requireGameLevel(state);
    const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (trap && !is_pit(trap.ttyp))
        return nowhere;
    if (MONSTER_SYMBOL[actor.species] === S_EEL) {
        const heroUnderwater = !!(state.underwater || state.u.uinwater);
        const inLineOfSight = !!((state.viz_array?.[y]?.[x] ?? 0) & COULD_SEE);
        const hidden = isPoolAt(x, y, state) && !levelIsWaterLevel(state)
            && (!heroUnderwater || !inLineOfSight);
        return { undetected: hidden, cover: null, water: true };
    }
    if (!((MONSTER_FLAGS1[actor.species] ?? 0) & M1_CONCEAL)
        || !canMonsterHideUnderObjectAt(state, x, y)
        || isPoolAt(x, y, state) || isLavaAt(x, y, state))
        return nowhere;
    const pile = level.objects[x]?.[y] ?? [];
    if (actor.tame && pile.some(object => object.cursed))
        return nowhere;
    const petrifyingOnly = !actor.stoneResistant
        && pile.every(object => object.otyp === CORPSE && touchPetrifies(object.corpsenm));
    return { undetected: !petrifyingOnly, cover: pile[0] ?? null, water: false };
}
export async function presentMonsterGrowth(monster, growth) {
    const game = requireInitializedGame();
    if (!growth?.changedSpecies || growth.applied)
        return;
    if (canSpotMonster(monster))
        await plineWithContinuation(growth.message);
    finishMonsterGrowth(monster, growth);
    await newsym(monster.mx, monster.my);
    if (growth.genocided)
        await finishEnvironmentalMonsterDeath(monster, game);
}
async function executeMonsterTurns() {
    const game = requireInitializedGame();
    const level = game.level;
    let somebodyCanMove = false;
    // C iter_mons_safe() snapshots identities, not their remaining movement.
    for (const actor of monstersInFmonOrder(level.monsters)) {
        if (game.level !== level || game.program_state?.gameover)
            return false;
        if (game.u.utotype) {
            somebodyCanMove = false;
            break;
        }
        if (!level.monsters.includes(actor))
            continue;
        // C movemon_singlemon(): parked guards keep removing their corridor
        // once per world turn, even after death or completion of the escort.
        if (actor.isgd && !actor.mx && (actor.mstate ?? MON_FLOOR) === MON_FLOOR) {
            if (game.moves > (actor.mlstmv ?? 0)) {
                await moveVaultGuard(actor, game, rn2);
                actor.mlstmv = game.moves;
            }
            continue;
        }
        if ((actor.mhp ?? 1) <= 0 || actor.mx === 0
            || (actor.mstate ?? MON_FLOOR) !== MON_FLOOR)
            continue;
        await runMonsterEveryturnEffects([actor], game, rn2, { fmonOrdered: true });
        if (actor.movement === undefined)
            throw new Error(`Monster ${actor.m_id} entered a turn before movement initialization.`);
        if (actor.movement < NORMAL_SPEED)
            continue;
        actor.movement -= NORMAL_SPEED;
        if (actor.movement >= NORMAL_SPEED)
            somebodyCanMove = true;
        // C mon.c:movemon_singlemon() settles deferred visibility before the
        // actor's liquid checks, equipment changes, and movement decisions.
        if (game.vision_full_recalc) {
            await vision_recalc(0);
        }
        if (game.context.bypasses)
            clearBypasses(game);
        const liquid = await resolveMonsterLiquid(actor, game, {
            announce: plineWithContinuation,
            finishDeath: finishMonsterLiquidDeath,
        });
        if (liquid?.dead)
            continue;
        const equipment = await reassessMonsterArmor(actor, game, { publish: plineWithContinuation });
        const sightingBefore = monsterSightingBeforeAction(actor, game);
        game._deferVisibleMonsterContact = true;
        let action;
        try {
            action = equipment?.consumed ? {
                monster: actor, calls: [],
                movement: {
                    oldx: actor.mx, oldy: actor.my, x: actor.mx, y: actor.my,
                    moved: false, equipment,
                },
            } : await runMonsterAction(actor, game);
        }
        finally {
            game._deferVisibleMonsterContact = false;
        }
        const presented = await presentMonsterAction(action, game);
        if (presented === 'stop')
            return false;
        if (presented === 'next-monster')
            continue;
        if (action.conflictFight)
            continue;
        const { monster, movement } = action;
        const offensive = movement.heroAttackSequence?.offensive;
        const attackReturnedDeath = movement.heroAttackResult === 1
            || (offensive?.status === 'completed' && offensive.result.nativeResult === 1);
        // C monmove.c:dochugw() checks the actor after dochug(), before the
        // adjacent monster_nearby() check at the occupation boundary.
        if (!attackReturnedDeath && (monster.mhp ?? 1) > 0)
            await interruptOccupationForMonster(monster, game, sightingBefore);
        if (!movement?.moved)
            continue;
    }
    return game.level === level && somebodyCanMove;
}
export async function moveMonsters() {
    const game = requireInitializedGame();
    const level = game.level;
    const previousMonsterMoving = game.context.mon_moving;
    game.context.mon_moving = true;
    try {
        const somebodyCanMove = await executeMonsterTurns();
        // C mon.c:movemon() refreshes moving light sources after the pass.
        if (hasLightSources())
            game.vision_full_recalc = 1;
        if (game.context.bypasses)
            clearBypasses(game);
        purgeDeadMonsters(level);
        // A monster's action can schedule travel, including removal of
        // levitation gear above a trap. Finish it before world maintenance
        // or command input; the departure monsters are now dormant.
        if (game._scheduledLevelChange) {
            await finishScheduledLevelChange();
            return false;
        }
        return somebodyCanMove;
    }
    finally {
        game.context.mon_moving = previousMonsterMoving;
    }
}
// C mon.c:copy_mextra() deep-copies pet and shopkeeper history when monster
// traits are saved with a corpse or restored from one.
export function copyPetData(value) {
    return { ...value, ogoal: { ...value.ogoal } };
}
export function copyShopkeeperData(value) {
    const copy = { ...value };
    if (value.bill)
        copy.bill = value.bill.map(item => ({ ...item }));
    return copy;
}
// C mon.c:KEEPTRAITS(). Corpses keep their monster's traits when it was a
// shopkeeper or pet, a unique or reviver, the quest leader, or a seducer.
const G_UNIQ = 0x1000;
export function corpseKeepsMonsterTraits(monster, questLeaderId = 0) {
    if (!monster)
        return false;
    return !!monster.isshk
        || (monster.mtame ?? 0) > 0
        || !!((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ)
        || isReviver(monster.mnum)
        || (!!questLeaderId && monster.m_id === questLeaderId)
        || monsterHasSeductionAttack(monster.mnum);
}
// Monster anger, alarm sounds, and peaceful bystander reactions.
// C refs: mon.c setmangry(), wakeup(), peacefuls_respond(), angry_guards(),
// qst_guardians_respond(), and the quest-leader branch of mondied().
const M1_HUMANOID = 0x00020000;
const MS_CUSS = 34;
const MS_HUMANOID = 25;
const MS_GUARDIAN = 38;
const MS_PRIEST = 41;
const HUMANOID_GASP_SOUNDS = new Set([
    22, // MS_IMITATE
    25, // MS_HUMANOID
    26, // MS_ARREST
    27, // MS_SOLDIER
    28, // MS_GUARD
    30, // MS_NURSE
    31, // MS_SEDUCE
    36, // MS_LEADER
    38, // MS_GUARDIAN
    39, // MS_SELL
    40, // MS_ORACLE
    41, // MS_PRIEST
    43, // MS_BOAST
]);
const CONDITIONAL_GASP_SOUNDS = new Set([
    3, // MS_ROAR
    4, // MS_BELLOW
    11, // MS_GRUNT
    20, // MS_LAUGH
    23, // MS_WERE
    24, // MS_ORC
    29, // MS_DJINNI
    32, // MS_VAMPIRE
    42, // MS_SPELL
]);
const HUMANOID_GASP_EXCLAMATIONS = [
    'Gasp!', 'Uh-oh.', 'Oh my!', 'What?', 'Why?',
];
const WATCH_NAMES = new Set(['watchman', 'watch captain']);
export function isWatch(monster) {
    return WATCH_NAMES.has(MONSTER_NAME[monster?.mnum] || '');
}
function maybeHumanoidGasp(observer) {
    requirePlayingGame(game);
    let sound = questMonsterSound(observer.mnum);
    if ((sound === MS_GUARDIAN && observer.mnum !== game.urole.guardnum)
        || (sound === MS_PRIEST && !priestIsCoaligned(observer)))
        return null;
    const minion = observer.emin || observer.mextra?.emin;
    if (sound === MS_CUSS && minion
        && (priestIsCoaligned(observer) ? !minion.renegade : minion.renegade)) {
        sound = MS_HUMANOID;
    }
    if (CONDITIONAL_GASP_SOUNDS.has(sound)) {
        if (MONSTER_SYMBOL[observer.mnum] !== MONSTER_SYMBOL[game.u.umonnum])
            return null;
    }
    else if (!HUMANOID_GASP_SOUNDS.has(sound)) {
        return null;
    }
    const exclamation = HUMANOID_GASP_EXCLAMATIONS[rn2(HUMANOID_GASP_EXCLAMATIONS.length)];
    const name = monsterName(observer, { capitalized: true });
    return exclamation === 'Gasp!'
        ? { text: `${name} gasps`, needsPeriod: true }
        : { text: `${name} exclaims "${exclamation}"`, needsPeriod: false };
}
async function reactHumanoidBystander(observer, attackedSpecies) {
    requirePlayingGame(game);
    if (isWatch(observer)) {
        await plineWithContinuation('"Halt!  You\'re under arrest!"');
        await angerWatchGuards(heroIsDeaf(game));
        return;
    }
    let exclaimed = false;
    let message = '';
    let needsPeriod = false;
    if (!heroIsDeaf(game) && rn2(5) === 0) {
        const gasp = maybeHumanoidGasp(observer);
        if (gasp) {
            message = gasp.text;
            needsPeriod = gasp.needsPeriod;
            exclaimed = true;
        }
    }
    if (observer.isshk || observer.ispriest
        || (observer.mnum === game.urole.ldrnum
            && attackedSpecies !== game.urole.guardnum)) {
        if (exclaimed)
            await plineWithContinuation(`${message} then shrugs.`);
        return;
    }
    if ((MONSTER_LEVEL[observer.mnum] ?? 0) < rn2(10)
        && observer.mnum !== game.urole.guardnum) {
        const alreadyFleeing = !!(observer.mflee || observer.mfleetim);
        await makeMonsterFlee(observer, {
            turns: rn2(50) + 25, first: true, announce: !exclaimed,
        });
        if (exclaimed && game.flags?.verbose !== false && !alreadyFleeing) {
            message += ' and then turns to flee.';
            needsPeriod = false;
        }
        else if (!exclaimed) {
            exclaimed = true;
        }
    }
    if (message) {
        await plineWithContinuation(`${message}${needsPeriod ? '.' : ''}`);
    }
    if ((observer.mtame ?? 0) > 0)
        return;
    observer.mpeaceful = 0;
    observer.mstrategy = (observer.mstrategy ?? 0) & ~STRAT_WAITMASK;
    adjustHeroAlignment(-1);
    if (!exclaimed) {
        await plineWithContinuation(`${monsterName(observer, { capitalized: true })} gets angry!`);
    }
}
// C mon.c:angry_guards().
export async function angerWatchGuards(silent, { state = game, publish = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    let count = 0;
    let adjacentCount = 0;
    let seenCount = 0;
    let sleepingCount = 0;
    for (const guard of Array.from(state.level?.monsters || []).reverse()) {
        if (!guard || guard.dead || (guard.mhp ?? 1) <= 0
            || !guard.mpeaceful || !isWatch(guard))
            continue;
        count++;
        if (canSpotMonster(guard) && guard.mcanmove !== 0) {
            const dx = Math.abs((guard.mx ?? 0) - (state.u?.ux ?? 0));
            const dy = Math.abs((guard.my ?? 0) - (state.u?.uy ?? 0));
            if (dx <= 1 && dy <= 1 && (dx !== 0 || dy !== 0))
                adjacentCount++;
            else
                seenCount++;
        }
        if (guard.msleeping || (guard.mfrozen ?? 0) > 0) {
            sleepingCount++;
            guard.msleeping = 0;
            guard.mfrozen = 0;
        }
        guard.mpeaceful = 0;
    }
    if (!count || silent)
        return count > 0;
    if (sleepingCount) {
        await publish(sleepingCount === 1
            ? 'The guard wakes up.' : 'The guards wake up.');
    }
    if (adjacentCount) {
        await publish(adjacentCount === 1
            ? 'The guard gets angry!' : 'The guards get angry!');
    }
    else if (seenCount) {
        await publish(seenCount === 1
            ? 'An angry guard is approaching!'
            : 'Angry guards are approaching!');
    }
    else {
        const message = formatHeardMessage(count === 1
            ? "the shrill sound of a guard's whistle."
            : "the shrill sound of guards' whistles.", state);
        if (message)
            await publish(message);
    }
    return true;
}
// C mon.c:peacefuls_respond().
async function reactPeacefulBystanders(attackedMonster) {
    if (!attackedMonster || game.context?.mon_moving
        || game.underwater || game.u?.uinwater)
        return;
    const heroInvisible = heroIsInvisible(game);
    const attackedSpecies = attackedMonster.mnum;
    const monsters = Array.from(game.level?.monsters || []).reverse();
    for (const observer of monsters) {
        const flags = MONSTER_FLAGS1[observer?.mnum] ?? 0;
        if (!observer || observer === attackedMonster || observer.dead
            || (observer.mhp ?? 1) <= 0 || !observer.mpeaceful
            || observer.msleeping
            || observer.mcansee === 0 || observer.mcansee === false
            || (flags & M1_MINDLESS)
            || !couldsee(observer.mx, observer.my))
            continue;
        if (heroInvisible && !(flags & M1_SEE_INVIS))
            continue;
        if ((flags & M1_HUMANOID) || observer.isshk || observer.ispriest) {
            await reactHumanoidBystander(observer, attackedSpecies);
            continue;
        }
        if (!monsterGrowthFamilyMatch(attackedMonster.mnum, observer.mnum))
            continue;
        if (rn2(3) !== 0)
            continue;
        let exclaimed = false;
        if (rn2(4) === 0)
            exclaimed = await publishMonsterGrowl(observer);
        if (rn2(6) === 0)
            continue;
        const alreadyFleeing = !!(observer.mflee || observer.mfleetim);
        await makeMonsterFlee(observer, {
            turns: rn2(25) + 15, first: true, announce: !exclaimed,
        });
        if (exclaimed && !alreadyFleeing)
            await plineWithContinuation('And then starts to flee.');
    }
}
// C mon.c:qst_guardians_respond().
async function angerQuestGuardiansAfterAttack(monster) {
    requirePlayingGame(game);
    if (monster.mnum !== game.urole?.ldrnum)
        return;
    const guardians = (game.level?.monsters || []).filter(candidate => !candidate.dead && (candidate.mhp ?? 1) > 0
        && candidate.mnum === game.urole?.guardnum
        && candidate.mpeaceful);
    for (const guardian of guardians)
        guardian.mpeaceful = 0;
    const visibleCount = guardians.filter(guardian => canSeeMonster(guardian)).length;
    if (!visibleCount || heroIsHallucinating())
        return;
    let name = monsterTypeName(game.urole.guardnum);
    if (visibleCount > 1)
        name = makePlural(name);
    const verb = visibleCount > 1 ? 'appear' : 'appears';
    await plineWithContinuation(`The ${name} ${verb} to be angry too...`);
}
// C mon.c:anger_quest_guardians(), the per-monster callback that xkilled
// iterates when the hero kills the quest leader.
export async function angerQuestGuardiansAfterLeaderDeath() {
    for (const guardian of Array.from(game.level?.monsters || []).reverse()) {
        if (!guardian.dead && (guardian.mhp ?? 1) > 0
            && guardian.mnum === game.urole?.guardnum
            && guardian.mpeaceful) {
            await angerMonster(guardian, { attacked: true });
        }
    }
}
// C mon.c:setmangry().
export async function angerMonster(monster, { attacked = false } = {}) {
    if (!monster)
        return;
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    if (attacked && hasCompletedEngraving('Elbereth', ux, uy)
        && (monsterIsScaredAt(monster, game, ux, uy) || monster.mpeaceful)) {
        await plineWithContinuation(formatFeltMessage('like a hypocrite.'));
        adjustHeroAlignment(game.u.ualign.record > 5 ? -5 : -rnd(5));
        if (!heroIsBlind())
            await plineWithContinuation('The engraving beneath you fades.');
        deleteEngravingAt(ux, uy);
    }
    monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    if (!monster.mpeaceful || (monster.mtame ?? 0) > 0)
        return;
    monster.mpeaceful = 0;
    adjustHeroAlignment(monster.ispriest
        ? (priestIsCoaligned(monster, game) ? -5 : 2)
        : -1);
    const humanoid = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_HUMANOID)
        || monster.isshk || monster.isgd;
    if (humanoid) {
        if (couldsee(monster.mx, monster.my)) {
            await plineWithContinuation(`${monsterName(monster, { capitalized: true })} gets angry!`);
        }
    }
    else {
        await publishMonsterGrowl(monster);
    }
    await angerQuestGuardiansAfterAttack(monster);
    await reactPeacefulBystanders(monster);
}
export function angerAttackedMonster(monster) {
    return angerMonster(monster, { attacked: true });
}
// ---------------------------------------------------------------------------
// C mon.c:seemimic(). Reveal a monster that is imitating another monster,
// furniture, or an object.
// ---------------------------------------------------------------------------
function appearanceBlocksLight(type, appearance) {
    if (type === M_AP_OBJECT)
        return appearance === BOULDER;
    if (type !== M_AP_FURNITURE)
        return false;
    return (appearance >= 0 && appearance < 12)
        || appearance === 15 || appearance === 16 || appearance === 18
        || appearance === TREE || appearance === SDOOR
        || appearance === DOOR || IS_WALL(appearance);
}
export async function revealMonsterAppearance(monster, { includeMonsterDisguise = true, } = {}) {
    const type = M_AP_TYPE(monster);
    const appearance = monster?.mappearance ?? 0;
    if (type === 0 || type === M_AP_MONSTER && !includeMonsterDisguise) {
        return {
            revealed: false, type, appearance, lightBlocker: false,
        };
    }
    const lightBlocker = appearanceBlocksLight(type, appearance);
    const corpsenm = monster.mcorpsenm
        ?? monster.mextra?.mcorpsenm ?? null;
    monster.m_ap_type = 0;
    monster.mappearance = 0;
    delete monster.mcorpsenm;
    if (monster.mextra)
        delete monster.mextra.mcorpsenm;
    if (lightBlocker)
        vision_note_blocker_change(monster.mx, monster.my);
    await newsym(monster.mx, monster.my);
    return {
        revealed: true, type, appearance, corpsenm, lightBlocker,
    };
}
// ---------------------------------------------------------------------------
// C mon.c:wake_msg() and wake_nearto_core(). Waking monsters near a noise or
// disturbance.
// ---------------------------------------------------------------------------
const PM_FLESH_GOLEM = MONSTER_NAME.indexOf('flesh golem');
function monstersNear(x, y, distance, state) {
    return (state.level?.monsters || []).slice().reverse().filter(monster => {
        if (!monster || (monster.mhp ?? 1) <= 0)
            return false;
        const dx = (monster.mx ?? 0) - x;
        const dy = (monster.my ?? 0) - y;
        return !distance || dx * dx + dy * dy < distance;
    });
}
// wake_nearto_core() wakes each sleeper inline; this is that per-monster half.
function wakeIndeterminateSleep(monster) {
    monster.msleeping = 0;
    if (!((MONSTER_GENO[monster.mnum] || 0) & G_UNIQ))
        monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
}
export async function publishMonsterWake(monster, interesting = false, state = game, publish = plineWithContinuation) {
    requireLiveGame(state);
    if (!monster.msleeping || !canSeeMonster(monster))
        return;
    const punctuation = interesting ? '!' : '.';
    const alive = monster.mnum === PM_FLESH_GOLEM ? " It's alive!" : '';
    await publish(`${monsterName(monster, { capitalized: true, state })} wakes up${punctuation}${alive}`);
}
// C mon.c:wake_nearto_core() (wake_nearto() is this with petCall false):
// the distance filter (monstersNear), the wake message, indeterminate-sleep
// clearing, petcall whistles, and the closing disturb_buried_zombies() all
// live here.
export async function wakeMonstersNearWithMessages(x, y, distance, state = game, publish = plineWithContinuation, { petCall = false } = {}) {
    requireLiveGame(state);
    for (const monster of monstersNear(x, y, distance, state)) {
        await publishMonsterWake(monster, false, state, publish);
        wakeIndeterminateSleep(monster);
        if (petCall && !state.context.mon_moving && monster.mtame) {
            if (!monster.isminion) {
                if (!monster.edog)
                    throw new Error(`Pet ${monster.m_id} has no pet state`);
                monster.edog.whistletime = state.moves;
            }
            monster.mtrack = [];
        }
    }
    disturbBuriedZombies(x, y, state);
}
// C mon.c:wakeup().
export async function wakeMonster(monster, { attacked = false } = {}) {
    if (!monster)
        return { heroDied: false };
    const wasSleeping = !!monster.msleeping;
    await publishMonsterWake(monster, attacked);
    monster.msleeping = 0;
    const appearance = M_AP_TYPE(monster);
    if (appearance !== M_AP_NOTHING) {
        if (appearance !== M_AP_MONSTER)
            await revealMonsterAppearance(monster);
    }
    else if (game.context.forcefight && !game.context.mon_moving
        && monster.mundetected) {
        monster.mundetected = 0;
        await newsym(monster.mx, monster.my);
    }
    await finishMonsterEating(monster);
    if (!attacked)
        return { heroDied: false };
    requirePlayingGame(game);
    const wasPeaceful = !!monster.mpeaceful;
    if (wasSleeping)
        await publishMonsterGrowl(monster);
    await angerMonster(monster, { attacked: true });
    if (wasPeaceful && monster.ispriest
        && templeRoomAt(game, monster.mx, monster.my)) {
        const retaliation = await ghodHitsu(monster);
        if (retaliation.heroDied)
            return retaliation;
    }
    if (wasPeaceful && monster.isshk && !game.u.ushops.length)
        hotPursuitShopkeeper(monster);
    return { heroDied: false };
}
export function wakeAttackedMonster(monster) {
    return wakeMonster(monster, { attacked: true });
}
// C mon.c:m_into_limbo(). The Wizard's failed resurrection returns here.
export async function sendMonsterToLimbo(monster, state = game) {
    monster.mstate = (monster.mstate ?? 0) | MON_LIMBO;
    return await migrateMonsterToLevel(monster, { ...currentDungeonLevel(state) }, state, {
        kind: 'limbo-migration', mode: MIGR_APPROX_XY,
    });
}
// C mon.c:migrate_mon(): release holds and protected items before the
// ordinary migrate_to_level() transaction loses the old map position.
export async function migrateMonsterToLevel(monster, destination, state = game, { kind = 'level-migration', mode = MIGR_RANDOM, } = {}) {
    if (monster.mx) {
        await releaseHeroFromMonster(monster, { state });
        await dropSpecialMonsterObjects(monster, state);
    }
    return await migrateMonsterOffLevel(monster, state, { dst: destination }, { kind, mode });
}
// ── C mon.c:mcalcmove(). Monster movement rates. moving=false leaves the
// adjusted speed unrounded.
export function mcalcmove(monster, moving = true, random = rn2, state = game) {
    initializeMonsterMovement(monster);
    let mmove = naturalMonsterSpeed(monster);
    if (monster.mspeed === MSLOW) {
        mmove = mmove < NORMAL_SPEED
            ? Math.trunc((2 * mmove + 1) / 3)
            : 4 + Math.trunc(mmove / 3);
    }
    else if (monster.mspeed === MFAST) {
        mmove = Math.trunc((4 * mmove + 2) / 3);
    }
    if (monster === state.u?.usteed
        && (state.u?.ugallop ?? 0) > 0
        && state.context?.mv) {
        mmove = Math.trunc((random(2) ? 4 : 5) * mmove / 3);
    }
    if (moving) {
        const adjustment = mmove % NORMAL_SPEED;
        mmove -= adjustment;
        // NetHack performs this draw even when adjustment is zero.
        if (random(NORMAL_SPEED) < adjustment)
            mmove += NORMAL_SPEED;
    }
    return mmove;
}
export function naturalMonsterSpeed(monster) {
    return monster.mmove !== undefined && Number.isFinite(monster.mmove)
        ? monster.mmove : MONSTER_MOVE[monster.mnum] ?? 0;
}
export function initializeMonsterMovement(monster) {
    if (!monster)
        return monster;
    if (!Number.isFinite(monster.movement))
        monster.movement = 0;
    if (!Number.isFinite(monster.mmove))
        monster.mmove = naturalMonsterSpeed(monster);
    if (!Number.isFinite(monster.mspeed))
        monster.mspeed = 0;
    return monster;
}
// ── C mon.c:meatmetal(), meatobj(), and meatcorpse(). Non-pet meals
// during post-move item handling.
const WOOD = 8, IRON = 11, MITHRIL = 17;
const SCROLL_CLASS = 9, ROCK_CLASS = 14;
const PM_RUST_MONSTER = MONSTER_NAME.indexOf('rust monster');
export async function consumeMonsterFloorObjects(monster, state, { originalSpecies, random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation, }) {
    requireLiveGame(state);
    const context = { state, level: requireGameLevel(state), random, rollOne, rollDice, publish };
    let status = 0;
    if (!monster.mtame && !mealInterrupted(monster, context)) {
        if ((MONSTER_FLAGS1[originalSpecies] ?? 0) & M1_METALLIVORE)
            status = await eatMetal(monster, context);
        if (!mealInterrupted(monster, context) && originalSpecies === PM_GELATINOUS_CUBE)
            status = await eatOrEngulfPile(monster, context) || status;
        if (!mealInterrupted(monster, context) && speciesEatsCorpses(originalSpecies))
            status = await eatCorpse(monster, context) || status;
    }
    const died = !!monster.dead || monster.mhp <= 0;
    const leftLevel = !died && leftMealLevel(monster, context);
    return {
        nativeResult: died ? 2 : leftLevel ? 3 : status,
        died, leftLevel, heroDied: !!state.program_state.gameover,
    };
}
function leftMealLevel(monster, { state, level }) {
    return !!monster.migrating || state.level !== level || !level.monsters.includes(monster);
}
function mealInterrupted(monster, context) {
    return !!context.state.program_state.gameover || !!monster.dead || monster.mhp <= 0
        || leftMealLevel(monster, context);
}
async function eatMetal(monster, context) {
    const { state, level, random, rollOne, publish } = context;
    const visible = canSeeMonster(monster);
    for (const object of [...(level.objects[monster.mx]?.[monster.my] ?? [])]) {
        const material = objectMaterial(object, state);
        if ((monster.mnum === PM_RUST_MONSTER && material !== IRON)
            || chokingObject(object) || poisonousObject(object, monster))
            continue;
        if (material < IRON || material > MITHRIL
            || objectResistsDestruction(object, 5, 95, random)
            || !monsterCanTouchArtifact(monster, object, state))
            continue;
        if (monster.mnum === PM_RUST_MONSTER && object.oerodeproof) {
            if (visible)
                await describeEating(monster, object, context);
            object.oerodeproof = false;
            monster.mstun = 1;
            if (visible) {
                const name = await distantMealName(object, state);
                if (state.flags.verbose)
                    await publish(`${monsterName(monster, { state, capitalized: true })} spits ${name} out in disgust!`);
            }
            continue;
        }
        if (cansee(monster.mx, monster.my))
            await describeEating(monster, object, context);
        else
            await describeSound('a crunching sound.', context);
        monster.meating = Math.trunc(object.owt / 2) + 1;
        await consumeMonsterObject(monster, object, state, context);
        if (mealInterrupted(monster, context))
            return 1;
        if (rollOne(25) < 3)
            placeCreatedObject(await mksobj(ROCK, true, false), monster.mx, monster.my, state);
        await newsym(monster.mx, monster.my);
        return 1;
    }
    return 0;
}
async function eatOrEngulfPile(monster, context) {
    const { state, level, random, publish } = context;
    const originalSpecies = monster.mnum;
    let eaten = 0, engulfed = 0, engulfMessage = '';
    for (const object of [...(level.objects[monster.mx]?.[monster.my] ?? [])]) {
        if (isLevelPrize(object, state))
            continue;
        if (object.otyp === CORPSE && isRider(object.corpsenm)) {
            if (await reviveMeal(object, context) || mealInterrupted(monster, context))
                break;
            continue;
        }
        if ((object.otyp === CORPSE && touchPetrifies(object.corpsenm)
            && !monsterHasStoneResistance(monster))
            || object.oclass === ROCK_CLASS || object === (state.uball || state.u.uball)
            || object === (state.uchain || state.u.uchain) || object.otyp === SCR_SCARE_MONSTER)
            continue;
        if (objectMaterial(object, state) > WOOD || objectResistsDestruction(object, 5, 95, random)
            || !monsterCanTouchArtifact(monster, object, state)
            || chokingObject(object) || poisonousObject(object, monster)
            || (petrifyingFood(object) && !monsterHasStoneResistance(monster))
            || (object.otyp === GLOB_OF_GREEN_SLIME && !monsterIsSlimeproof(monster))) {
            engulfed++;
            const name = await distantMealName(object, state);
            if (engulfed === 1)
                engulfMessage = `${monsterName(monster, { state, capitalized: true })} engulfs ${name}.`;
            else if (engulfed === 2)
                engulfMessage = `${monsterName(monster, { state, capitalized: true })} engulfs several objects.`;
            unlinkObject(object, state);
            await addObjectToMonsterInventory(monster, object, state);
        }
        else {
            eaten++;
            if (cansee(monster.mx, monster.my)) {
                await describeEating(monster, object, context);
                const description = state.objectDescriptions?.[object.otyp] ?? OBJECT_DESCRIPTIONS[object.otyp];
                if (object.oclass === SCROLL_CLASS && description === 'YUM YUM')
                    await publish(object.blessed ? 'Yum!' : 'Yum.');
            }
            else
                await describeSound('a slurping sound.', context);
            await consumeMonsterObject(monster, object, state, context);
            if (mealInterrupted(monster, context) || monster.mnum !== originalSpecies)
                return 1;
        }
        if (mealInterrupted(monster, context))
            return 1;
        if (monster.minvis)
            await newsym(monster.mx, monster.my);
    }
    if (!mealInterrupted(monster, context) && engulfed > 0) {
        if (cansee(monster.mx, monster.my) && state.flags.verbose)
            await publish(engulfMessage);
        else
            await describeSound(engulfed === 1 ? 'a slurping sound.' : 'several slurping sounds.', context);
    }
    return eaten > 0 || engulfed > 0 ? 1 : 0;
}
async function eatCorpse(monster, context) {
    const { state, level } = context;
    const originalSpecies = monster.mnum;
    const x = monster.mx, y = monster.my;
    const pile = level.objects[x]?.[y] ?? [];
    for (const corpse of [...pile]) {
        if (corpse.otyp !== CORPSE || veganCorpse(corpse.corpsenm)
            || (fleshPetrifies(corpse.corpsenm) && !monsterHasStoneResistance(monster)))
            continue;
        if (isRider(corpse.corpsenm)) {
            if (await reviveMeal(corpse, context) || mealInterrupted(monster, context))
                break;
            continue;
        }
        const meal = splitCorpseMeal(corpse, state);
        if (cansee(x, y) && canSeeMonster(monster))
            await describeEating(monster, meal, context);
        else
            await describeSound('a masticating sound.', context);
        await consumeMonsterObject(monster, meal, state, context);
        if (!mealInterrupted(monster, context) && monster.mnum === originalSpecies && monster.minvis)
            await newsym(x, y);
        return 1;
    }
    return 0;
}
function splitCorpseMeal(corpse, state) {
    if (corpse.quan <= 1)
        return corpse;
    const meal = splitObjectStack(corpse, 1, state);
    if (!meal)
        throw new Error(`Corpse ${corpse.o_id} could not split one meal`);
    return meal;
}
async function reviveMeal(object, { state, publish }) {
    const x = object.ox, y = object.oy;
    const revival = await reviveCorpseImmediately(object, state);
    if (revival)
        for (const message of revival.messages)
            await publish(message);
    await newsym(x, y);
    return !!revival?.monster;
}
function chokingObject(object) {
    return object.otyp === AMULET_OF_STRANGULATION || object.otyp === RIN_SLOW_DIGESTION;
}
function poisonousObject(object, monster) {
    // Native stores trapped-container and poisoned-weapon state in one bit.
    return !!(object.opoisoned || object.otrapped) && !monsterHasPoisonResistance(monster);
}
function petrifyingFood(object) {
    return [CORPSE, EGG, TIN].includes(object.otyp) && fleshPetrifies(object.corpsenm);
}
async function distantMealName(object, state) {
    observeDistantObjectForNaming(object, state);
    return await inventoryItemDescription(object);
}
async function describeEating(monster, object, { state, publish }) {
    // Naming can identify an object even when verbose prose is disabled.
    const name = await distantMealName(object, state);
    if (state.flags.verbose)
        await publish(`${monsterName(monster, { state, capitalized: true })} eats ${name}!`);
}
async function describeSound(sound, { state, publish }) {
    if (!state.flags.verbose)
        return;
    const message = formatHeardMessage(sound, state);
    if (message)
        await publish(message);
}
// ── C mon.c:mon_give_prop() and mon_givit(). Properties conveyed to
// monsters by corpses; monsters retain only the six resistance bits.
const STALKER = MONSTER_NAME.indexOf('stalker');
export async function grantMonsterCorpseIntrinsic(monster, species, state = game) {
    requireLiveGame(state);
    const property = chooseCorpseIntrinsic(species);
    const visible = canSeeMonster(monster);
    if (monster.mhp <= 0)
        return;
    if (species === STALKER) {
        if (!monster.perminvis || monster.invis_blkd) {
            const name = monsterName(monster, { state, capitalized: true });
            setMonsterPermanentInvisibility(monster);
            if (!monster.invis_blkd) {
                await newsym(monster.mx, monster.my);
                if (monster.wormno)
                    await redrawMonsterWormSegments(monster);
            }
            if (visible) {
                const change = !canSpotMonster(monster) ? 'vanishes'
                    : monster.invis_blkd ? 'seems to flicker' : 'becomes invisible';
                await plineWithContinuation(`${name} ${change}.`);
            }
        }
        monster.mstun = 1;
        return;
    }
    // Native still makes the chance roll for properties that monsters cannot
    // retain, such as strength, telepathy, teleportation, acid, or petrification.
    if (!property || !shouldGiveIntrinsic(property, species))
        return;
    await grantMonsterIntrinsic(monster, property, state);
}
// C mon.c:mon_give_prop(). Monsters retain only the six resistance bits.
export async function grantMonsterIntrinsic(monster, property, state = game, publish = plineWithContinuation) {
    const effect = monsterIntrinsic(property);
    if (!effect)
        return;
    const alreadyInnate = !!((requireMonsterData(MONSTER_RESISTS, monster.mnum)
        | (monster.mintrinsics ?? 0)) & effect.bit);
    monster.mintrinsics = (monster.mintrinsics ?? 0) | effect.bit;
    if (canSeeMonster(monster) && !alreadyInnate)
        await publish(`${monsterName(monster, { state, capitalized: true })} ${effect.message}`);
}
function monsterIntrinsic(property) {
    if (property !== 'fireResistance' && property !== 'coldResistance'
        && property !== 'sleepResistance' && property !== 'disintegrationResistance'
        && property !== 'shockResistance' && property !== 'poisonResistance')
        return null;
    switch (property) {
        case 'fireResistance': return { bit: 0x01, message: 'shivers slightly.' };
        case 'coldResistance': return { bit: 0x02, message: 'looks quite warm.' };
        case 'sleepResistance': return { bit: 0x04, message: 'looks wide awake.' };
        case 'disintegrationResistance': return { bit: 0x08, message: 'looks very firm.' };
        case 'shockResistance': return { bit: 0x10, message: 'crackles with static electricity.' };
        case 'poisonResistance': return { bit: 0x20, message: 'looks healthy.' };
    }
}
// ── C mon.c:mpickstuff(). Selection, visible naming, and transfer are one
// action.
const S_NYMPH = 14;
const M1_ACID = 0x08000000;
const PM_LIZARD = MONSTER_NAME.indexOf('lizard');
export async function pickUpMonsterFloorObject(monster, state, random = rn2) {
    if (shopkeeperInOwnShop(monster, state))
        return false;
    if (!monster.mtame && roomsAt(state.level, monster.mx, monster.my, SHOPBASE).length
        && random(25))
        return false;
    if (!monsterCouldReachItem(monster, monster.mx, monster.my, state))
        return false;
    const pile = state.level.objects[monster.mx]?.[monster.my] ?? [];
    for (const object of pile) {
        if (isLevelPrize(object, state) || !monsterWantsFloorObject(monster, object, state)
            || rejectsOrdinaryCorpse(monster, object) || !monsterCanTouchObject(monster, object, state))
            continue;
        const amount = monsterCarryAmount(monster, object, state, random);
        if (!amount)
            continue;
        const carried = amount === object.quan ? object : splitObjectStack(object, amount, state);
        if (!carried)
            throw new Error(`Monster pickup could not split ${amount} objects from stack ${object.o_id}`);
        if (cansee(monster.mx, monster.my)) {
            // Native distant_name names the original stack after splitting,
            // and observes it even when verbose messages are disabled.
            observeDistantObjectForNaming(object, state);
            const name = await inventoryItemDescription(object);
            if (state.flags.verbose)
                await plineWithContinuation(`${monsterName(monster, { state, capitalized: true })} picks up ${name}.`);
        }
        unlinkObject(carried, state);
        await addObjectToMonsterInventory(monster, carried, state);
        checkMonsterGearNextTurn(monster);
        await newsym(monster.mx, monster.my);
        return true;
    }
    return false;
}
function rejectsOrdinaryCorpse(monster, object) {
    if (object.otyp !== CORPSE || MONSTER_SYMBOL[monster.mnum] === S_NYMPH)
        return false;
    const species = object.corpsenm ?? -1;
    return !touchPetrifies(species) && species !== PM_LIZARD
        && !((MONSTER_FLAGS1[species] ?? 0) & M1_ACID);
}
// ── C mon.c:mm_displacement().
export function monsterDisplacementFlags(aggressor, defender) {
    if (!monsterIsDisplacer(aggressor.mnum)
        || monsterIsDisplacer(defender.mnum)
            && aggressor.m_lev <= defender.m_lev
        || defender.mnum === PM_GRID_BUG
            && aggressor.mx !== defender.mx && aggressor.my !== defender.my
        || defender.mtrapped
        || defender.wormno && defender.wormSegments?.length
        || !monsterIsRider(aggressor)
            && requireMonsterData(MONSTER_SIZE, aggressor.mnum)
                < requireMonsterData(MONSTER_SIZE, defender.mnum)) {
        return 0;
    }
    return ALLOW_MDISP;
}
// ── C mon.c:relmon(), mon_leaving_level(), and dmonsfree(). Departures
// retain their coordinates; death removes map occupancy before unlinking
// the chain.
export async function detachMonsterFromLevel(monster, state = game, { dueToDeath = false, stayLinked = false } = {}) {
    requireLiveGame(state);
    const level = requireGameLevel(state);
    const { mx: x, my: y } = monster;
    const onMap = isok(x, y) && monsterAtPosition(level, x, y) === monster;
    const parkedAtOrigin = monsterAtPosition(level, 0, 0) === monster;
    // A settling boulder must not damage the departing actor recursively.
    monster.mtrapped = 0;
    await releaseHeroFromMonster(monster, { state });
    if ((onMap || parkedAtOrigin) && monster.wormno)
        await clearMonsterWormFromMap(monster);
    // Native m_detach removes map occupancy immediately but leaves the
    // identity in fmon until movemon's dmonsfree. A death during distress
    // still participates in this turn's movement allocation.
    if (dueToDeath)
        monster.mstate = (monster.mstate ?? MON_FLOOR) | MON_DETACH;
    else if (!stayLinked)
        level.monsters = level.monsters.filter(candidate => candidate !== monster);
    if (onMap) {
        monster.mundetected = 0;
        await revealMonsterAppearance(monster, { includeMonsterDisguise: false });
    }
    // mnearto() keeps a displaced monster in fmon, zeroing its coordinates
    // after mon_leaving_level() has unhidden it at the vacated square.
    if (stayLinked) {
        monster.mx = 0;
        monster.my = 0;
    }
    if (onMap) {
        await fillPitWithBoulderAt(x, y, state);
        await newsym(x, y);
    }
    if (state.context.polearm?.hitmonId === monster.m_id)
        state.context.polearm.hitmonId = null;
}
// C mon.c mnearto(): bring the monster to <x,y>; shove any resident of the
// destination aside when moveOther is set. A resident without room uses
// the endgame's overcrowding rules or waits in limbo elsewhere.
export async function mnearto(monster, x, y, state, { moveOther = false, flags = RLOC_NOMSG } = {}) {
    if (monster.mx === x && monster.my === y
        && monsterAtPosition(state.level, x, y) === monster)
        return 1;
    let othermon = null;
    if (moveOther) {
        const candidate = monsterAtPosition(state.level, x, y);
        if (candidate && candidate !== monster) {
            othermon = candidate;
            // C mon_leaving_level() keeps a worm's body nodes for the nested
            // relocation and redraws the vacated square.
            await detachMonsterFromLevel(othermon, state, { stayLinked: true });
            othermon.mstate = (othermon.mstate ?? 0) | MON_OFFMAP;
        }
    }
    let newx = x;
    let newy = y;
    if (!goodPosition(newx, newy, { kind: 'monster', monster }, { state })) {
        const near = findNearbyMonsterPosition(monster.mnum, newx, newy, { state });
        if (!near) {
            if (othermon)
                await dealWithMonsterOvercrowding(othermon, state);
            return 0;
        }
        newx = near.x;
        newy = near.y;
    }
    await relocateMonsterTo(monster, newx, newy, { state, flags });
    if (moveOther && othermon) {
        const replaced = await mnearto(othermon, x, y, state, { moveOther: false, flags });
        if (!replaced)
            await dealWithMonsterOvercrowding(othermon, state);
        return 2;
    }
    return 1;
}
// ---------------------------------------------------------- shk anger state
// C mon.c:dmonsfree(), called after movement and before saving a level.
// A dead guard stays linked while its temporary corridor needs cleanup.
export function purgeDeadMonsters(level) {
    level.monsters = level.monsters.filter(monster => monster.mhp > 0 || !!monster.isgd);
}
export async function removeMonsterFromGame(monster) {
    requireLiveGame(game);
    if (!monster) {
        return { removed: false, dropped: [], discarded: [] };
    }
    const gameWasOver = game.program_state.gameover;
    const x = monster.mx, y = monster.my;
    monster.mhp = 0;
    if (monster.isgd && !await prepareVaultGuardDeath(monster))
        return { removed: false, dropped: [], discarded: [], x, y };
    await releaseHeroFromMonster(monster);
    const dropped = await dropSpecialMonsterObjects(monster);
    const discarded = await discardMonsterInventory(monster, false);
    if (monster.mleashed)
        releaseMonsterLeash(monster);
    if (x > 0 && monsterEmitsLight(monster.mnum))
        game.vision_full_recalc = 1;
    await detachMonsterFromLevel(monster);
    // End-game settlement starts removals after gameover is already set.
    // Only a new death during this removal interrupts the remaining cleanup.
    if (!gameWasOver && game.program_state.gameover)
        return { removed: true, dropped, discarded, x, y };
    if (monster.iswiz)
        wizardDeadOrGone();
    armorThiefGone(monster);
    if (monster.isshk) {
        if (!hasShopkeeperData(monster))
            throw new Error('shopkeeper lacks shop history');
        finishShopkeeperDeparture(monster);
    }
    if (monster.wormno)
        await removeMonsterWormBody(monster);
    monster.dead = true;
    if (game.u.usteed === monster)
        await dismountHero(DISMOUNT_GENERIC);
    return { removed: true, dropped, discarded, x, y };
}
export async function removeWishGrantingMonster(monster) {
    return await removeMonsterFromGame(monster);
}
// ── C mon.c:corpse_chance() AT_BOOM checks and the contained
// explosion; the map blast itself is explode.c:mon_explodes().
function rollAttackDamage(monster, attack, rollDice) {
    const [, , dice = 0, sides = 0] = attack;
    if (dice > 0)
        return rollDice(dice, sides);
    if (sides > 0) {
        const level = monster.m_lev
            ?? MONSTER_LEVEL[monster.mnum]
            ?? 0;
        return rollDice(level + 1, sides);
    }
    return 0;
}
export function monsterHasDeathExplosion(monster) {
    return (MONSTER_ATTACKS[monster?.mnum] || [])
        .some(attack => attack[0] === AT_BOOM);
}
export function monsterDeathSwallower(state = game) {
    const swallower = state._monsterSwallower;
    if (swallower && 'kind' in swallower)
        return swallower;
    return swallower && monsterCanEngulf(swallower) ? swallower : null;
}
export function rollMonsterDeathExplosion(monster, { state = game, rollDice = d, } = {}) {
    const attack = (MONSTER_ATTACKS[monster.mnum] || [])
        .find(candidate => candidate[0] === AT_BOOM);
    if (!attack)
        return null;
    const swallower = monsterDeathSwallower(state);
    const damage = rollAttackDamage(monster, attack, rollDice);
    // A map explosion rolls again in mon_explodes(); a contained one uses
    // corpse_chance()'s first roll and never visits the map blast owner.
    return { swallower, damage: swallower
            ? damage : rollAttackDamage(monster, attack, rollDice) };
}
export async function resolveMonsterDeathExplosion(monster, x, y, explosion, { state = game, publish = plineWithContinuation, random = rn2, rollDice = d, heroCaused = !state.context.mon_moving, } = {}) {
    const { swallower, damage } = explosion;
    if (!swallower) {
        return createPhysicalMonsterExplosion(monster, x, y, damage, {
            state, publish, random, heroCaused,
        });
    }
    if ('kind' in swallower) {
        await publish(`There is an explosion in your ${heroStomachName(state)}!`);
        const physicalDamage = state.u.halfPhysicalDamage
            ? Math.trunc((damage + 1) / 2) : damage;
        const killer = `${possessiveName(monsterTypeName(monster.mnum, !!monster.female))} explosion`;
        return { heroDied: await loseHeroHp(physicalDamage, killer, { state, publish }) };
    }
    const heard = formatHeardMessage('an explosion.', state);
    if (heard)
        await publish(heard);
    swallower.mhp -= damage;
    if (swallower.mhp <= 0) {
        const death = await finishEnvironmentalMonsterDeath(swallower, state, {
            publish, random, rollDice,
        });
        if (death.heroDied || state.program_state.gameover)
            return { heroDied: true };
    }
    if (swallower.mhp <= 0) {
        if (canSpotMonster(swallower))
            await publish(`${monsterName(swallower, { state, capitalized: true })} rips open!`);
    }
    else if (canSeeMonster(swallower)) {
        await publish(`${monsterName(swallower, { state, capitalized: true })} seems to have indigestion.`);
    }
    return { heroDied: false };
}
const PM_PAPER_GOLEM = 250;
const PM_STRAW_GOLEM = MONSTER_NAME.indexOf('straw golem');
const PM_ROPE_GOLEM = 251;
const PM_GOLD_GOLEM = 252;
const PM_LEATHER_GOLEM = 253;
const PM_WOOD_GOLEM = 254;
const PM_CLAY_GOLEM = 256;
const PM_STONE_GOLEM = 257;
const PM_GLASS_GOLEM = 258;
const PM_WHITE_UNICORN = 101;
const PM_BLACK_UNICORN = 103;
const PM_LONG_WORM = 114;
const PM_GRAY_DRAGON = 143;
const PM_YELLOW_DRAGON = 152;
const PM_GRAY_OOZE = 206;
const PM_BLACK_PUDDING = 209;
const PM_VLAD_THE_IMPALER = 228;
const PM_DEATH = 311;
const PM_PESTILENCE = 312;
const PM_FAMINE = 313;
const PM_MEDUSA = MONSTER_NAME.indexOf('Medusa');
const PM_HIGH_CLERIC = MONSTER_NAME.indexOf('high cleric');
const S_GOLEM = 55;
const S_LICH = 38;
const M2_UNDEAD = 0x00000002;
const M2_NEUTER = 0x00040000;
const SPECIAL_GOLEM_REMAINS = new Set([
    PM_PAPER_GOLEM, PM_ROPE_GOLEM, PM_GOLD_GOLEM, PM_LEATHER_GOLEM,
    PM_WOOD_GOLEM, PM_CLAY_GOLEM, PM_STONE_GOLEM, PM_GLASS_GOLEM,
    PM_IRON_GOLEM,
]);
export function levelAllowsMonsterDeathDrops(monster, state = game, random = rn2) {
    if (Is_rogue_level(state.u?.uz)
        || state.level?.flags?.deathdrops === false)
        return false;
    const undead = !!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_UNDEAD);
    return !(state.level?.flags?.graveyard && undead && random(3));
}
export function monsterDeathSquareAllowsObjects(x, y, state = game) {
    return isAccessibleAt(x, y, state) || isPoolAt(x, y, state);
}
export function monsterBodyCrumbles(monster) {
    return monster.mnum === PM_VLAD_THE_IMPALER
        || MONSTER_SYMBOL[monster.mnum] === S_LICH;
}
export function monsterBodyCrumblesMessage(monster, state = game) {
    const name = monsterName(monster, { state, capitalized: true });
    return `${possessiveName(name)} body crumbles into dust.`;
}
export function monsterLeavesCorpse(monster, random = rn2) {
    if (monsterBodyCrumbles(monster)
        || monsterHasDeathExplosion(monster))
        return false;
    const mnum = monster.mnum;
    const guaranteed = (((MONSTER_SIZE[mnum] ?? 2) >= 3
        || mnum === PM_LIZARD) && !monster.mcloned)
        || MONSTER_SYMBOL[mnum] === S_GOLEM
        || monsterIsPlayerMonster(mnum)
        || (mnum >= PM_DEATH && mnum <= PM_FAMINE)
        || !!monster.isshk;
    if (guaranteed)
        return true;
    const frequency = (MONSTER_GENO[mnum] ?? 0) & 0x7;
    const corpseDenominator = 2 + Number(frequency < 2)
        + Number((MONSTER_SIZE[mnum] ?? 0) === 0);
    return random(corpseDenominator) === 0;
}
function ordinaryMonsterDeathResult(monster, state, random, rollDice) {
    if (monsterBodyCrumbles(monster)) {
        return { crumbles: true, explosion: null, leavesRemains: false };
    }
    const explosion = rollMonsterDeathExplosion(monster, { state, rollDice });
    if (explosion !== null) {
        return { crumbles: false, explosion, leavesRemains: false };
    }
    const leavesRemains = levelAllowsMonsterDeathDrops(monster, state, random) && monsterLeavesCorpse(monster, random);
    return { crumbles: false, explosion: null, leavesRemains };
}
// C corpse_chance(): effects and eligibility are separate from placing a body.
// Digestion uses this after xkilled, including an explosion inside the eater.
export async function resolveMonsterCorpseChance(monster, { state = game, random = rn2, rollDice = d, publish = plineWithContinuation, } = {}) {
    const death = ordinaryMonsterDeathResult(monster, state, random, rollDice);
    if (death.crumbles && cansee(monster.mx, monster.my) && !monsterDeathSwallower(state))
        await publish(monsterBodyCrumblesMessage(monster, state));
    if (death.explosion) {
        if (state === game)
            await newsym(monster.mx, monster.my);
        const explosion = await resolveMonsterDeathExplosion(monster, monster.mx, monster.my, death.explosion, { state, publish, random, rollDice });
        if (explosion.heroDied)
            return { leavesRemains: false, heroDied: true };
    }
    return { leavesRemains: death.leavesRemains, heroDied: false };
}
function corpseFlags(monster, initialize = true) {
    let flags = initialize ? CORPSTAT_INIT : 0;
    if (monster.female)
        flags |= CORPSTAT_FEMALE;
    else if (!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_NEUTER))
        flags |= CORPSTAT_MALE;
    return flags;
}
function woodGolemMaterial() {
    if (rn2(2))
        return QUARTERSTAFF;
    if (rn2(3))
        return SMALL_SHIELD;
    if (rn2(3))
        return CLUB;
    if (rn2(3))
        return ELVEN_SPEAR;
    return BOOMERANG;
}
function ropeGolemMaterial() {
    if (rn2(2))
        return LEASH;
    return rn2(3) ? BULLWHIP : GRAPPLING_HOOK;
}
function leatherGolemMaterial() {
    if (rn2(4))
        return LEATHER_ARMOR;
    return rn2(3) ? LEATHER_CLOAK : SADDLE;
}
async function createGolemRemains(monster, state) {
    const x = monster.mx;
    const y = monster.my;
    let remains = null;
    const placeNewObject = async (type, initialize = true) => {
        remains = await mksobj(type, initialize, false);
        placeCreatedObject(remains, x, y, state);
        return remains;
    };
    switch (monster.mnum) {
        case PM_IRON_GOLEM:
            for (let count = d(2, 6); count > 0; count--)
                await placeNewObject(IRON_CHAIN);
            break;
        case PM_GLASS_GOLEM:
            for (let count = d(2, 4); count > 0; count--) {
                const glassType = WORTHLESS_PIECE_OF_WHITE_GLASS
                    + rn2(WORTHLESS_PIECE_OF_VIOLET_GLASS
                        - WORTHLESS_PIECE_OF_WHITE_GLASS + 1);
                await placeNewObject(glassType);
            }
            break;
        case PM_CLAY_GOLEM: {
            const rocks = await placeNewObject(ROCK, false);
            rocks.quan = rocks.quantity = rn2(20) + 50;
            rocks.owt = objectWeight(rocks);
            break;
        }
        case PM_STONE_GOLEM:
            remains = await mkcorpstat(STATUE, null, monster.mnum, x, y, corpseFlags(monster, false), { state });
            break;
        case PM_WOOD_GOLEM:
            for (let count = d(2, 4); count > 0; count--)
                await placeNewObject(woodGolemMaterial());
            break;
        case PM_ROPE_GOLEM:
            for (let count = rn2(3); count > 0; count--)
                await placeNewObject(ropeGolemMaterial());
            break;
        case PM_LEATHER_GOLEM:
            for (let count = d(2, 4); count > 0; count--)
                await placeNewObject(leatherGolemMaterial());
            break;
        case PM_GOLD_GOLEM:
            remains = await mkgold(200 - rnl(101), x, y, state);
            break;
        case PM_PAPER_GOLEM:
            for (let count = rnd(4); count > 0; count--)
                await placeNewObject(SCR_BLANK_PAPER);
            break;
        default:
            break;
    }
    if (monster.mnum !== PM_STONE_GOLEM)
        setMonsterGivenName(monster, null);
    return remains;
}
async function placeMonsterPart(type, monster, state, initialize = true) {
    const part = await mksobj(type, initialize, false);
    placeCreatedObject(part, monster.mx, monster.my, state);
    return part;
}
async function createMonsterPart(monster, state, seen, publish) {
    const mnum = monster.mnum;
    if (mnum >= PM_GRAY_DRAGON && mnum <= PM_YELLOW_DRAGON) {
        const chance = monster.mrevived ? 20 : 3;
        if (rn2(chance) !== 0)
            return null;
        const scales = await placeMonsterPart(GRAY_DRAGON_SCALES + mnum - PM_GRAY_DRAGON, monster, state, false);
        scales.spe = 0;
        scales.cursed = false;
        scales.blessed = false;
        return scales;
    }
    if (mnum >= PM_WHITE_UNICORN && mnum <= PM_BLACK_UNICORN) {
        if (monster.mrevived && rn2(2)) {
            if (seen) {
                const owner = possessiveName(monsterName(monster, { state, capitalized: true }));
                await publish(`${owner} recently regrown horn `
                    + 'crumbles to dust.');
            }
            return null;
        }
        const horn = await placeMonsterPart(UNICORN_HORN, monster, state);
        if (monster.mrevived)
            horn.degraded_horn = 1;
        return horn;
    }
    if (mnum === PM_LONG_WORM)
        return await placeMonsterPart(WORM_TOOTH, monster, state);
    return null;
}
async function createPuddingGlob(monster, state, publish) {
    if (monster.mnum < PM_GRAY_OOZE
        || monster.mnum > PM_BLACK_PUDDING)
        return null;
    const glob = await placeMonsterPart(GLOB_OF_GRAY_OOZE + monster.mnum - PM_GRAY_OOZE, monster, state);
    const remains = await meldNearbyFloorGlobs(glob, { state, publish });
    setMonsterGivenName(monster, null);
    await newsym(monster.mx, monster.my);
    return remains;
}
export async function createMonsterRemains(monster, state = game, { buried = false, zombify = false, noRevive = false, seen = false, publish = plineWithContinuation, } = {}) {
    const x = monster.mx;
    const y = monster.my;
    if (SPECIAL_GOLEM_REMAINS.has(monster.mnum)) {
        const remains = await createGolemRemains(monster, state);
        return remains ? await finishMonsterRemains(remains, monster, state) : null;
    }
    if (monster.mnum >= PM_GRAY_OOZE && monster.mnum <= PM_BLACK_PUDDING)
        return createPuddingGlob(monster, state, publish);
    await createMonsterPart(monster, state, seen, publish);
    const corpseForm = undeadToCorpse(monster.mnum);
    const vitalFlags = state.mvitals?.[monster.mnum]?.mvflags
        ?? MONSTER_GENO[monster.mnum] ?? 0;
    if (corpseForm === monster.mnum
        && (vitalFlags & G_NOCORPSE)) {
        return null;
    }
    const leaderId = state.quest_status?.leader_m_id;
    const savedMonster = corpseForm !== monster.mnum
        || corpseKeepsMonsterTraits(monster, leaderId)
        ? monster : null;
    const corpse = await mkcorpstat(CORPSE, savedMonster, corpseForm, x, y, corpseFlags(monster), {
        state, zombify, noRevive,
    });
    corpse.name = `${MONSTER_NAME[corpseForm] || 'monster'} corpse`;
    if (corpseForm !== monster.mnum)
        corpse.age = (corpse.age ?? state.moves ?? 1) - 51;
    if (buried && corpseForm === monster.mnum) {
        const result = await buryObject(corpse, state);
        if (result.outcome === 'absorbed')
            return null;
        if (result.outcome === 'buried')
            return corpse;
    }
    return await finishMonsterRemains(corpse, monster, state);
}
// Special golem objects share make_corpse's tail with ordinary corpses.
// In particular, the beam which killed a monster must skip its new remains.
async function finishMonsterRemains(remains, monster, state) {
    if (state.context.bypasses)
        bypassObject(remains, state);
    if (monster.name)
        remains.oname = monster.name;
    const stacked = await stack_object(remains, state);
    await newsym(monster.mx, monster.my);
    if (stacked.ox !== monster.mx || stacked.oy !== monster.my)
        await newsym(stacked.ox, stacked.oy);
    return stacked;
}
// ---------------------------------------------------------------------------
// Per-species birth and death state: decl.h mvitals[] and the mondead() tail.
// ---------------------------------------------------------------------------
const PM_MAIL_DAEMON = MONSTER_NAME.indexOf('mail daemon');
export function monsterDeathCount(mnum, state = game) {
    return state.mvitals?.[mnum]?.died ?? 0;
}
export function recordMonsterDeath(monster, state = game) {
    if (!Array.isArray(state.mvitals))
        state.mvitals = [];
    const mnum = monster.mnum;
    const vital = state.mvitals[mnum]
        || (state.mvitals[mnum] = { mvflags: 0, born: 0, died: 0 });
    vital.died = Math.min(255, (vital.died ?? 0) + 1);
    if (mnum === PM_MAIL_DAEMON)
        vital.mvflags = (vital.mvflags ?? 0) | G_GENOD;
    return vital.died;
}
export function hasRecordedMonsterDeaths(state = game) {
    return (state.mvitals || []).some(vital => (vital?.died ?? 0) > 0);
}
// C mondead(): a dying steam vortex leaves a cloud of steam behind.
const PM_STEAM_VORTEX = MONSTER_NAME.indexOf('steam vortex');
export async function createSteamVortexDeathCloud(monster, state = game, random = rn2, publish = plineWithContinuation) {
    if (monster.mnum !== PM_STEAM_VORTEX)
        return null;
    return await createPoisonGasCloud(state, monster.mx, monster.my, random(10) + 5, 0, random, publish);
}
// C mondead(): dead Keystone Kops may be replaced.
function downstairs(state) {
    for (let stair = state.stairs; stair; stair = stair.next) {
        if (!stair.isladder && !stair.up)
            return stair;
    }
    return null;
}
export async function returnDeadKop(monster, state = game, rollOne = rnd) {
    if (!monsterIsKop(monster.mnum))
        return null;
    // mondead(): switch (rnd(5)) -- 1 near the down stairs, 2 anywhere.
    const returnRoll = rollOne(5);
    if (returnRoll > 2)
        return null;
    if (returnRoll === 1) {
        const stair = downstairs(state);
        if (stair)
            return makemonAt(monster.mnum, stair.sx, stair.sy, 0);
    }
    return makemonAt(monster.mnum, 0, 0, 0);
}
// Native mondead() after recovery has failed. Kill credit and remains belong
// to the caller; map, inventory, and population cleanup share this owner.
export async function detachDeadMonster(monster, state, random, publish, rollOne = rnd) {
    const x = monster.mx;
    const y = monster.my;
    monster.mhp = 0;
    await createSteamVortexDeathCloud(monster, state, random, publish);
    if (monster.isgd && !await prepareVaultGuardDeath(monster, state))
        return false;
    const emittedLight = monsterEmitsLight(monster.mnum);
    restoreMonsterTrueSpecies(monster);
    recordMonsterDeath(monster, state);
    markQuestLeaderDead(monster, state);
    await returnDeadKop(monster, state, rollOne);
    logDeadMonster(monster, state);
    if (state === game)
        await unmap_invisible(x, y, false);
    if (monster.mleashed)
        releaseMonsterLeash(monster, state);
    // m_detach removes the light of the form which died, before its true
    // species and empty map square are projected by mon_leaving_level.
    monster.lightRemoved = true;
    if (x > 0 && emittedLight)
        state.vision_full_recalc = 1;
    await detachMonsterFromLevel(monster, state, { dueToDeath: true });
    if (state.program_state.gameover)
        return true;
    if (monster.iswiz)
        wizardDeadOrGone(state, random);
    await markQuestNemesisDead(monster, state, x, y);
    await releaseMonsterInventory(monster, state, { publish, random });
    if (state.program_state.gameover)
        return true;
    armorThiefGone(monster, state);
    if (monster.isshk) {
        if (!hasShopkeeperData(monster))
            throw new Error('shopkeeper lacks shop history');
        finishShopkeeperDeparture(monster, state);
    }
    if (monster.wormno)
        await removeMonsterWormBody(monster);
    monster.dead = true;
    if (state.u.usteed === monster) {
        const result = await dismountHero(DISMOUNT_GENERIC, {
            state, random, announce: publish,
        });
        return !!result.died;
    }
    return false;
}
// mon.c:logdeadmon().  Chronicle line for the death of a unique monster
// (first death of a High Cleric, first death of each shopkeeper), plus the
// Medusa achievement.  Called after mvitals.died was incremented.
function logDeadMonster(monster, state) {
    const species = monster.mnum;
    let howmany = state.mvitals?.[species]?.died ?? 0;
    if (species === PM_MEDUSA && howmany === 1) {
        recordAchievement(state, ACH_MEDU); /* also generates a livelog event */
        return;
    }
    const uniqueCorpstat = ((MONSTER_GENO[species] ?? 0) & G_UNIQ) !== 0;
    if (!((uniqueCorpstat && (species !== PM_HIGH_CLERIC || !monster.mrevived))
        || (monster.isshk && !monster.mrevived)))
        return;
    const herodidit = !state.context.mon_moving;
    let shkdetail = '';
    if (monster.isshk) {
        // only the first death per shopkeeper: their shared kill counter
        // would not work for this (nor account for polymorphed shopkeepers)
        howmany = 1;
        // ", the <shoptype> proprietor" needs a trailing comma for the
        // alternate "<shk>, <details>, has been killed" phrasing when the
        // hero isn't directly responsible
        // C reads ESHK(mtmp)->shoptype directly; an isshk monster without
        // shop data is an invalid state, not a general store.
        if (!hasShopkeeperData(monster))
            throw new Error(`Shopkeeper ${monster.m_id} lacks shop history`);
        const shop = SHOP_TYPES[monster.eshk.shoptype - SHOPBASE];
        if (!shop)
            throw new Error(`Shopkeeper ${monster.m_id} has invalid shop type`);
        shkdetail = `, the ${shop.name} ${monster.female ? 'proprietrix' : 'proprietor'}${herodidit ? '' : ','}`;
    }
    else if (species === PM_HIGH_CLERIC) {
        howmany = 1;
    }
    // killing a unique more than once isn't logged every time
    if (!(howmany <= 3 || howmany === 5 || howmany === 10 || howmany === 25
        || howmany % 50 === 0))
        return;
    const rider = species === PM_DEATH || species === PM_PESTILENCE
        || species === PM_FAMINE;
    const flags = LL_UMONST
        | (howmany === 1 || monster.iswiz || rider ? LL_ACHIEVE : 0);
    const xtra = howmany > 1 ? ` (${howmany}${ordinalSuffix(howmany)} time)` : '';
    const mkilled = monsterIsNonliving(species) ? 'destroyed' : 'killed';
    const name = monsterName(monster, { state, article: 'the', exact: true });
    recordGameLogEvent(herodidit ? `${mkilled} ${name}${shkdetail}${xtra}`
        : `${name}${shkdetail} has been ${mkilled}${xtra}`, { state, flags });
}
export async function finishMonsterLiquidDeath(monster, { state = game, random = rn2, rollOne = rnd, rollDice = d, leaveCorpse = false, sadFeeling = false, publish = plineWithContinuation, } = {}) {
    const x = monster.mx;
    const y = monster.my;
    const recovery = await preventMonsterDeath(monster, { state, random, rollOne, publish });
    if (recovery.survived || recovery.heroDied || recovery.completedDeath) {
        return {
            oldx: x, oldy: y, x, y, moved: false,
            dead: !recovery.survived, actionCompleted: !recovery.survived,
            corpse: recovery.completedDeath?.corpse ?? null,
            ...(recovery.heroDied ? { heroDied: true } : {}),
        };
    }
    if (sadFeeling)
        await publish('You have a sad feeling for a moment, then it passes.');
    if (await detachDeadMonster(monster, state, random, publish, rollOne)) {
        return {
            oldx: x, oldy: y, x, y,
            moved: false, dead: true, actionCompleted: true,
            corpse: null, heroDied: true,
        };
    }
    const death = leaveCorpse
        ? await resolveMonsterCorpseChance(monster, { state, random, rollDice, publish })
        : { leavesRemains: false, heroDied: false };
    if (death.heroDied)
        return {
            oldx: x, oldy: y, x, y,
            moved: false, dead: true, actionCompleted: true,
            corpse: null, heroDied: true,
        };
    const corpse = death.leavesRemains
        && monsterDeathSquareAllowsObjects(monster.mx, monster.my, state)
        ? await createMonsterRemains(monster, state, {
            seen: state === game && canSeeMonster(monster),
            publish,
        })
        : null;
    if (state === game) {
        await unmap_invisible(x, y, false);
        await newsym(x, y);
    }
    return {
        oldx: x, oldy: y, x, y,
        moved: false, dead: true,
        actionCompleted: true,
        corpse,
    };
}
// C monkilled(): the death line precedes recovery, but pet grief follows it.
// A null cause suppresses the line even when the monster's square is visible.
export async function finishMonsterKilled(monster, state, { damageType, cause = '', publish = plineWithContinuation, ...options }) {
    const species = monster.mnum;
    const visible = cause !== null && monsterKillLineVisible(monster);
    const deathMessage = visible
        ? `${monsterName(monster, { state, capitalized: true })} is ${monsterIsNonliving(species) ? 'destroyed' : 'killed'}${cause ? ` by the ${cause}` : ''}!`
        : null;
    const burns = damageType === AD_FIRE
        && (species === PM_PAPER_GOLEM || species === PM_STRAW_GOLEM);
    const disintegrated = damageType === 'disintegration' || damageType === AD_DGST || burns;
    const death = await resolveMonsterDeath(monster, state, {
        ...options, publish, deathMessage, noCorpse: disintegrated,
        sadFeeling: !visible && !!monster.mtame,
    }, { disintegrated });
    if (death.survived || death.heroDied)
        return death;
    if (monster.mtame) {
        const epitaph = burns ? 'roast'
            : damageType === AD_RUST && species === PM_IRON_GOLEM ? 'rust'
                : damageType === AD_DCAY && (species === PM_WOOD_GOLEM || species === PM_LEATHER_GOLEM)
                    ? 'rot' : null;
        if (epitaph)
            await publish(`May ${monsterName(monster, { state, suppressIt: true })} ${epitaph} in peace.`);
    }
    return death;
}
export function finishEnvironmentalMonsterDeath(monster, state, options = {}) {
    return resolveMonsterDeath(monster, state, options);
}
async function resolveMonsterDeath(monster, state, { deathMessage = null, sadFeeling = false, noCorpse = false, noRevive = false, zombifyCorpse = false, stoneRemains = null, random = rn2, rollOne = rnd, rollDice = d, publish = plineWithContinuation, }, { disintegrated = false } = {}) {
    requireLiveGame(state);
    const wasInside = !!state.u.uswallow && state.u.ustuck === monster;
    const recovery = await preventMonsterDeath(monster, {
        creditedKill: deathMessage,
        disintegrated,
        state,
        publish,
        random,
    });
    if (recovery.survived || recovery.heroDied)
        return { monster, survived: recovery.survived, corpse: recovery.completedDeath?.corpse ?? null,
            ...(recovery.heroDied ? { heroDied: true } : {}) };
    if (!recovery.completedDeath) {
        if (sadFeeling)
            await publish('You have a sad feeling for a moment, then it passes.');
        if (await detachDeadMonster(monster, state, random, publish, rollOne))
            return { monster, survived: false, corpse: null, heroDied: true };
    }
    if (wasInside)
        await describeStoneEngulferEscape(monster, stoneRemains, state, publish);
    // C vamprises returns true even when its door already ran mondied.
    // An outer mondied still tries to leave remains; mondead does not.
    const death = noCorpse
        ? { leavesRemains: false, heroDied: false }
        : await resolveMonsterCorpseChance(monster, { state, random, rollDice, publish });
    if (death.heroDied)
        return { monster, survived: false, corpse: null, heroDied: true };
    const corpse = death.leavesRemains
        && monsterDeathSquareAllowsObjects(monster.mx, monster.my, state)
        ? await createMonsterRemains(monster, state, {
            zombify: zombifyCorpse,
            noRevive,
            seen: canSeeMonster(monster),
            publish,
        }) : recovery.completedDeath?.corpse ?? null;
    return { monster, survived: false, corpse };
}
const VAMPIRE_FORMS = new Set([226, 227, 228]);
const TORSO_ARMOR = W_ARM | W_ARMC | W_ARMU;
export function monsterSubject(monster) {
    return monsterName(monster, { capitalized: true });
}
export function monsterWearsTorsoArmor(monster) {
    return (monster?.minvent || monster?.inventory || []).some(object => ((object.owornmask ?? 0) & TORSO_ARMOR) !== 0);
}
export async function monsterSelfTouchAfterPolymorph(monster, options = {}) {
    if (monsterWearsGloves(monster))
        return { touched: false, survived: true };
    return monsterSelfTouch(monster, {
        ...options,
        prefix: 'No longer petrify-resistant, ',
    });
}
export async function turnGolemToStone(monster, publish) {
    if (!monsterPolymorphsWhenStoned(monster))
        return null;
    const visible = canSeeMonster(monster);
    if (visible) {
        await publish(`${monsterSubject(monster)} solidifies...`);
    }
    const change = await changeMonsterForm(monster, PM_STONE_GOLEM, game, { publish });
    if (change?.heroDied)
        return change;
    const changed = !!change;
    if (visible) {
        await publish(changed
            ? `Now it's a ${monsterTypeName(monster.mnum)}.`
            : '... and returns to normal.');
    }
    if (changed)
        await newsym(monster.mx, monster.my);
    return { changed, heroDied: false };
}
export async function restoreShapechanger(monster, publish) {
    const baseForm = monster?.cham;
    if (baseForm === undefined || !Number.isInteger(baseForm) || baseForm < 0
        || baseForm === monster.mnum || speciesWasGenocided(baseForm, game)) {
        return null;
    }
    if (VAMPIRE_FORMS.has(baseForm))
        return await reviveStonedVampire(monster, baseForm, publish);
    if (!monsterHasStoneResistance({ mnum: baseForm }))
        return null;
    const oldName = monsterTypeName(monster.mnum, !!monster.female);
    restoreRevertedMonsterHealth(monster);
    const change = await changeMonsterForm(monster, baseForm, game, { publish });
    if (!change || change.heroDied)
        return change;
    monster.cham = -1;
    if (canSeeMonster(monster)) {
        await publish(`The ${oldName} turns into ${monsterTypeName(baseForm)}!`);
    }
    await newsym(monster.mx, monster.my);
    return { changed: true, heroDied: false };
}
function restoreRevertedMonsterHealth(monster) {
    monster.mcanmove = 1;
    monster.mfrozen = 0;
    // C mon.c:set_mon_min_mhpmax(mtmp, 10).
    monster.mhpmax = Math.max(monster.mhpmax ?? 1, (monster.m_lev ?? 0) + 1, 10);
    monster.mhp = monster.mhpmax;
}
// C mon.c:vamp_stone(): a shifted vampire falls in its current form, then
// silently resumes its vampire form and rises instead of petrifying.
async function reviveStonedVampire(monster, baseForm, publish) {
    const posture = monsterIsAmorphous(monster) ? 'coalesces on the'
        : (MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_FLY ? 'drops to the'
            : 'writhes on the';
    const fall = `The lapidifying ${monsterName(monster, {
        article: 'none', suppressSaddle: true, suppressHallucination: true,
        suppressInvisible: true, suppressIt: true,
    })} ${posture} ${surfaceName(monster.mx, monster.my)}`;
    restoreRevertedMonsterHealth(monster);
    if (engulfing_u(monster)) {
        const expulsion = await expelHero(monster, { message: false, publish });
        if (expulsion.died)
            return { changed: true, heroDied: true };
    }
    const location = game.level?.at(monster.mx, monster.my);
    if (monsterIsAmorphous(monster) && location?.typ === DOOR
        && (location.doormask ?? 0) & (D_CLOSED | D_LOCKED)) {
        const spot = findNearbyMonsterPosition(baseForm, monster.mx, monster.my);
        if (spot)
            await relocateMonsterTo(monster, spot.x, spot.y);
    }
    if (canSpotMonster(monster)) {
        await publish(`${fall}!`);
        await displayMessageWindow();
    }
    const change = await changeMonsterForm(monster, baseForm, game, { publish });
    if (change?.heroDied)
        return change;
    monster.cham = monster.mnum === baseForm ? -1 : baseForm;
    if (canSpotMonster(monster)) {
        await publish(`${monsterName(monster, { article: 'a', capitalized: true })} rises from the ${surfaceName(monster.mx, monster.my)} with renewed agility!`);
    }
    await newsym(monster.mx, monster.my);
    return { changed: true, heroDied: false };
}
async function putInStatue(statue, object) {
    clearMonsterCarriedObjectState(object);
    endObjectBurn(object);
    // Arbitrary saved monster inventory: the general container owner
    // awaits the no-longer-held release (an unpaid nested crysknife can
    // charge during the transfer into the statue).
    await addObjectToContainer(statue, object);
}
async function dropBesideStatue(object, x, y, publish) {
    clearMonsterCarriedObjectState(object);
    return landFloorObject(object, x, y, { state: game, publish });
}
function statueFlags(monster) {
    let flags = 0;
    if (monster.female)
        flags |= CORPSTAT_FEMALE;
    else if (!((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_NEUTER))
        flags |= CORPSTAT_MALE;
    if ((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ)
        flags |= CORPSTAT_HISTORIC;
    return flags;
}
async function createStoneRemains(monster, publish) {
    const x = monster.mx;
    const y = monster.my;
    const frequency = (MONSTER_GENO[monster.mnum] ?? 0) & 0x07;
    const leavesStatue = (MONSTER_SIZE[monster.mnum] ?? 0) > 0
        || rn2(2 + Number(frequency > 2)) === 0;
    if (!leavesStatue) {
        const rock = await mksobj(ROCK, true, false);
        placeCreatedObject(rock, x, y, game);
        return await stack_object(rock, game);
    }
    const contained = [];
    for (const object of [...(monster.minvent || [])]) {
        const worn = object.owornmask;
        await removeObjectFromMonsterInventory(monster, object, game, {
            publish: async () => { },
        });
        // monstone saves traits only after removing item-granted properties.
        if (worn)
            applyMonsterEquipmentProperties(monster, object, false);
        if (object.otyp === BOULDER
            || objectResistsDestruction(object, 0, 0)) {
            await dropBesideStatue(object, x, y, publish);
        }
        else {
            contained.push(object);
        }
    }
    monster.minvent = [];
    monster.inventory = monster.minvent;
    monster.hasInventory = false;
    monster.mw = null;
    monster.misc_worn_check = 0;
    const statue = await mkcorpstat(STATUE, monster, monster.mnum, x, y, statueFlags(monster));
    if (monster.name)
        statue.oname = monster.name;
    for (const object of contained)
        await putInStatue(statue, object);
    statue.owt = objectWeight(statue);
    return await stack_object(statue, game);
}
// C mon.c:monstone(). Reversion and life saving precede statue creation.
export async function prepareMonsterPetrification(monster, { publish = plineWithContinuation, } = {}) {
    const restored = await restoreShapechanger(monster, publish);
    if (restored?.heroDied)
        return { heroDied: true };
    if (restored)
        return { changed: true, survived: true };
    monster.mhp = 0;
    const lifeSaver = wornMonsterLifeSaver(monster);
    if (lifeSaver) {
        const visible = cansee(monster.mx, monster.my);
        await lifeSaveMonster(monster, lifeSaver, {
            genocided: speciesWasGenocided(monster.mnum, game),
        });
        if ((monster.mhp ?? 0) > 0)
            return { changed: true, survived: true, messageShown: visible };
    }
    monster.mtrapped = 0;
    const remains = await createStoneRemains(monster, publish);
    if (game.program_state.gameover)
        return { heroDied: true };
    await unmap_invisible(monster.mx, monster.my, false);
    if (cansee(monster.mx, monster.my))
        await newsym(monster.mx, monster.my);
    return { changed: true, survived: false, remains };
}
export async function finishMonsterPetrification(monster, { finishDeath, publish = plineWithContinuation, } = {}) {
    const result = await prepareMonsterPetrification(monster, { publish });
    if (result.heroDied || result.survived)
        return result;
    if (!finishDeath)
        throw new Error('Petrification requires a monster death handler');
    await finishDeath(monster, { noCorpse: true, stoneRemains: result.remains ?? null, publish });
    if (game.program_state.gameover)
        return { heroDied: true };
    return result;
}
// monstone() describes escape after mondead() has released the hero, using
// the monster's final species and the statue or rock it actually left.
export async function describeStoneEngulferEscape(monster, remains, state, publish) {
    if (!remains || !monsterDigests(monster))
        return;
    await publish(`You ${heroLocomotion('jump', state)} through an opening in the new ${objectName(remains, state)}.`);
}
// C mon.c:maybe_mnexto() uses rloc_to() after choosing an accessible square.
export async function maybeMnexto(monster, state) {
    for (let attempt = 0; attempt < 20; attempt++) {
        const destination = findNearbyMonsterPosition(monster.mnum, state.u.ux, state.u.uy, { state });
        if (!destination)
            return null;
        const movesDiagonally = destination.x !== monster.mx
            && destination.y !== monster.my;
        if (!couldsee(destination.x, destination.y)
            || (monster.mnum === PM_GRID_BUG && movesDiagonally))
            continue;
        return await relocateMonsterTo(monster, destination.x, destination.y, { state });
    }
    return null;
}
// C mon.c:m_respond_medusa(). Medusa special action: gaze at the hero.
export async function respondMedusa(monster, options = {}) {
    if (MONSTER_NAME[monster.mnum] !== 'Medusa' || !couldsee(monster.mx, monster.my))
        return undefined;
    const gaze = (MONSTER_ATTACKS[monster.mnum] || []).find(([method]) => method === AT_GAZE);
    return gaze ? resolveMonsterGaze(monster, gaze, options) : undefined;
}
// ── C mon.c:m_respond(), shared by dochug() and immediate monster magic.
// C mon.c:m_respond(), shared by dochug() and immediate monster magic.
export async function respondToImmediateMagic(monster, state = game, { random = rn2, publish = pline, ...gazeOptions } = {}) {
    requirePlayingGame(state);
    const distance = Math.max(Math.abs(monster.mx - state.u.ux), Math.abs(monster.my - state.u.uy));
    if (MONSTER_SOUND[monster.mnum] === 18 && distance <= 1) {
        if (!heroIsDeaf(state)) {
            await publish(`${monsterName(monster, { state, capitalized: true })} shrieks.`);
            await stopHeroOccupation(state);
        }
        if (!random(10)) {
            let species = null;
            if (!random(13)) {
                const adult = MONSTER_NAME.indexOf('purple worm');
                const maximum = Math.trunc((level_difficulty() + state.u.ulevel) / 2);
                species = (MONSTER_DIFFICULTY[adult] ?? 0) > maximum
                    ? MONSTER_NAME.indexOf('baby purple worm') : adult;
            }
            await makemonAt(species, 0, 0);
        }
        aggravateMonsters(state, random);
    }
    const response = await respondMedusa(monster, { state, random, publish, ...gazeOptions });
    if (MONSTER_NAME[monster.mnum] === 'erinys' && !monster.mpeaceful
        && monsterHasLineOfSightToHero(monster, state))
        aggravateMonsters(state, random);
    return response;
}
const M1_ANIMAL = 0x00040000;
const M1_NOTAKE = 0x00000800;
const M2_NOPOLY = 0x00000001;
const M2_MALE = 0x00010000;
const M2_FEMALE = 0x00020000;
const S_VAMPIRE = 48;
const S_DOG = 4;
const S_BAT = 28;
const S_VORTEX = 22;
const PM_WOLF = MONSTER_NAME.indexOf('wolf');
const PM_FOG_CLOUD = MONSTER_NAME.indexOf('fog cloud');
const PM_BLACK_LIGHT = MONSTER_NAME.indexOf('black light');
const PM_ARCHON = MONSTER_NAME.indexOf('Archon');
const PM_VAMPIRE_BAT = MONSTER_NAME.indexOf('vampire bat');
const PM_STALKER = MONSTER_NAME.indexOf('stalker');
const PM_JABBERWOCK = MONSTER_NAME.indexOf('jabberwock');
const PM_VAMPIRE = MONSTER_NAME.indexOf('vampire');
const PM_VAMPIRE_LEADER = MONSTER_NAME.indexOf('vampire leader');
const PM_DOPPELGANGER = MONSTER_NAME.indexOf('doppelganger');
const PM_SANDESTIN = MONSTER_NAME.indexOf('sandestin');
const PM_CHAMELEON = MONSTER_NAME.indexOf('chameleon');
const PM_STUDENT = MONSTER_NAME.indexOf('student');
const PM_APPRENTICE = MONSTER_NAME.indexOf('apprentice');
const POLYMORPH_IMMUNE_MONSTERS = new Set([
    'Nazgul', 'erinys', 'Death', 'Pestilence', 'Famine',
].map(monsterIndexByName));
const PLACEHOLDER_MONSTERS = new Set([
    'orc', 'giant', 'elf', 'human',
].map(monsterIndexByName));
export function monsterIndexByName(name) {
    const mnum = MONSTER_NAME.indexOf(name);
    if (mnum < 0)
        throw new Error(`Unknown monster identity: ${name}`);
    return mnum;
}
function acceptsShapechangerForm(baseMnum, targetMnum) {
    if (!Number.isInteger(targetMnum) || targetMnum < 0
        || speciesWasGenocided(targetMnum, game) || PLACEHOLDER_MONSTERS.has(targetMnum))
        return false;
    if (monsterIsPlayerMonster(targetMnum) || targetMnum === baseMnum)
        return true;
    return !((MONSTER_FLAGS2[targetMnum] ?? 0) & M2_NOPOLY);
}
// C select_newcham_form()'s fifty-attempt fallback draws with validspecmon():
// accept_newcham_form() plus the notake/nohead restriction that keeps
// shopkeepers, priests, vault guards, and the quest leader in bodies that
// can handle objects and speech. Only the Rogue level's early retries
// consult it, matching the native loop condition.
function randomShape(monster, baseMnum) {
    let targetMnum = -1;
    let triesLeft = 50;
    do {
        targetMnum = rn2(SPECIAL_PM);
        --triesLeft;
    } while (triesLeft > 0
        && !validSpecMon(monster, targetMnum, baseMnum, game)
        && triesLeft > 40
        && Is_rogue_level(game.u?.uz)
        && !/^[A-Z]$/.test(monsterClassSymbol(targetMnum)));
    return targetMnum;
}
function dragonArmorForm(monster) {
    const armor = (monster?.minvent || monster?.inventory || []).find(object => ((object.owornmask ?? 0) & W_ARM) !== 0);
    return dragonFormForArmor(armor);
}
function selectOrdinaryPolymorphForm(monster) {
    const armorForm = dragonArmorForm(monster);
    for (let triesLeft = 20; triesLeft > 0; --triesLeft) {
        const targetMnum = armorForm ?? randomShape(monster, -1);
        const wantsUppercase = triesLeft > 15 && Is_rogue_level(game.u?.uz);
        if (acceptsShapechangerForm(-1, targetMnum)
            && (!wantsUppercase
                || /^[A-Z]$/.test(monsterClassSymbol(targetMnum)))) {
            return targetMnum;
        }
    }
    return null;
}
// C select_newcham_form()'s doppelganger case alone; -1 falls through to
// the shared random pick like native NON_PM.
async function pickDoppelgangerChamForm(monster) {
    let targetMnum = -1;
    if (!rn2(7)) {
        targetMnum = pickNastyShape((MONSTER_DIFFICULTY[PM_JABBERWOCK] ?? 0) - 1);
    }
    else if (rn2(3)) {
        targetMnum = await toptenMonsterForm(monster);
    }
    else if (!rn2(3)) {
        targetMnum = rn1(PM_APPRENTICE - PM_STUDENT + 1, PM_STUDENT);
        if (targetMnum === game.urole?.guardnum)
            targetMnum = -1;
    }
    else {
        let triesLeft = 5;
        do {
            targetMnum = rn2(SPECIAL_PM);
            if ((MONSTER_FLAGS1[targetMnum] ?? 0) & M1_HUMANOID
                && !((MONSTER_FLAGS2[targetMnum] ?? 0) & M2_NOPOLY)) {
                break;
            }
            targetMnum = -1;
        } while (--triesLeft > 0);
    }
    return targetMnum;
}
async function selectDoppelgangerFormOnce(monster) {
    const targetMnum = await pickDoppelgangerChamForm(monster);
    return targetMnum < 0 ? randomShape(monster, PM_DOPPELGANGER) : targetMnum;
}
async function selectDoppelgangerForm(monster) {
    for (let triesLeft = 20; triesLeft > 0; --triesLeft) {
        const targetMnum = await selectDoppelgangerFormOnce(monster);
        const wantsUppercase = triesLeft > 15 && Is_rogue_level(game.u.uz);
        if (acceptsShapechangerForm(PM_DOPPELGANGER, targetMnum)
            && (!wantsUppercase || /^[A-Z]$/.test(monsterClassSymbol(targetMnum))))
            return targetMnum;
    }
    return null;
}
function selectChameleonForm(monster) {
    const animals = chameleonAnimals();
    for (let triesLeft = 20; triesLeft > 0; --triesLeft) {
        const targetMnum = !rn2(3)
            ? pickAnimalShape(animals)
            : randomShape(monster, PM_CHAMELEON);
        const wantsUppercase = triesLeft > 15 && Is_rogue_level(game.u.uz);
        if (acceptsShapechangerForm(PM_CHAMELEON, targetMnum)
            && (!wantsUppercase || /^[A-Z]$/.test(monsterClassSymbol(targetMnum))))
            return targetMnum;
    }
    return null;
}
function chameleonAnimals() {
    return Array.from({ length: SPECIAL_PM }, (_, mnum) => mnum)
        .filter(mnum => (MONSTER_FLAGS1[mnum] ?? 0) & M1_ANIMAL);
}
// C pick_animal() gives the Rogue level one extra animal draw. newcham()
// then applies its usual first-five-attempt uppercase preference.
function pickAnimalShape(animals) {
    let species = animals[rn2(animals.length)];
    if (species === undefined)
        throw new RangeError('Chameleon selection is outside its animal list');
    if (Is_rogue_level(game.u.uz) && !/^[A-Z]$/.test(monsterClassSymbol(species)))
        species = animals[rn2(animals.length)];
    if (species === undefined)
        throw new RangeError('Chameleon selection is outside its animal list');
    return species;
}
function selectSandestinForm(monster) {
    for (let triesLeft = 20; triesLeft > 0; --triesLeft) {
        const targetMnum = rn2(7)
            ? pickNastyShape((MONSTER_DIFFICULTY[PM_ARCHON] ?? 0) - 1)
            : randomShape(monster, PM_SANDESTIN);
        const wantsUppercase = triesLeft > 15 && Is_rogue_level(game.u?.uz);
        if (acceptsShapechangerForm(PM_SANDESTIN, targetMnum)
            && (!wantsUppercase || /^[A-Z]$/.test(monsterClassSymbol(targetMnum))))
            return targetMnum;
    }
    return null;
}
export function shapechangerGender(baseMnum, targetMnum, female) {
    const flags = MONSTER_FLAGS2[targetMnum] ?? 0;
    if (flags & M2_MALE)
        return false;
    if (flags & M2_FEMALE)
        return true;
    if (flags & M2_NEUTER)
        return female;
    const toggle = !rn2(10);
    const vampireShape = targetMnum === PM_VAMPIRE
        || targetMnum === PM_VAMPIRE_LEADER
        || targetMnum === PM_VLAD_THE_IMPALER;
    const vampireBase = baseMnum === PM_VAMPIRE
        || baseMnum === PM_VAMPIRE_LEADER
        || baseMnum === PM_VLAD_THE_IMPALER;
    return toggle && !(vampireShape || vampireBase) ? !female : female;
}
function pickVampireShape(monster) {
    const baseMnum = monster.cham;
    if (baseMnum === undefined || baseMnum < 0)
        throw new Error(`Vampire ${monster.m_id} has no natural species`);
    const uppercaseOnly = Is_rogue_level(game.u?.uz);
    let targetMnum = baseMnum;
    const keepsSpecialObject = baseMnum === PM_VLAD_THE_IMPALER
        && monsterCarriesSpecialObject(monster);
    if (!keepsSpecialObject) {
        const wolfChance = baseMnum === PM_VLAD_THE_IMPALER ? 3 : 10;
        if ((baseMnum === PM_VAMPIRE_LEADER || baseMnum === PM_VLAD_THE_IMPALER)
            && !rn2(wolfChance) && !uppercaseOnly
            && !isPoolAt(monster.mx, monster.my)
            && !isLavaAt(monster.mx, monster.my)) {
            targetMnum = PM_WOLF;
        }
        else {
            targetMnum = !rn2(4) && !uppercaseOnly
                ? PM_FOG_CLOUD : PM_VAMPIRE_BAT;
        }
    }
    if (speciesWasGenocided(targetMnum, game)
        || (monster.mnum !== baseMnum && !rn2(4)))
        return baseMnum;
    return targetMnum;
}
function shapechangerProtectionActive() {
    return !!(game.u?.protectionFromShapeChangers
        || game.protectionFromShapeChangers);
}
function naturalShapechanger(mnum) {
    return !!((MONSTER_FLAGS2[mnum] ?? 0) & M2_SHAPESHIFTER);
}
// C mon.c:isspecmon(): shopkeepers, priests, vault guards and the quest
// leader need a body that can handle objects and speech.
function isSpeciallyHandledMonster(monster, state) {
    return !!monster.isshk || !!monster.ispriest || !!monster.isgd
        || monster.m_id === state.quest_status?.leader_m_id;
}
// C mon.c:validspecmon(): accept_newcham_form() plus the special-monster
// notake/nohead restriction.
function validSpecMon(monster, mnum, baseMnum, state) {
    if (mnum < 0)
        return true;
    if (!acceptsShapechangerForm(baseMnum, mnum))
        return false;
    if (isSpeciallyHandledMonster(monster, state)
        && (((MONSTER_FLAGS1[mnum] ?? 0) & M1_NOTAKE) !== 0
            || !monsterHasHead({ mnum })))
        return false;
    return true;
}
// C mon.c:validvamp(): a vampshifter accepts only its own alternate forms
// (class answers are mapped onto them); anyone else reduces to
// validspecmon(). The form may be rewritten in place, like the native
// out-parameter.
function validVampForm(monster, mnum, monsterClass, state) {
    const baseMnum = monster.cham ?? -1;
    if (!monsterIsVampireShifter(monster))
        return { valid: validSpecMon(monster, mnum, baseMnum, state), form: mnum };
    if (baseMnum === PM_VLAD_THE_IMPALER && monsterCarriesSpecialObject(monster, state))
        return { valid: true, form: PM_VLAD_THE_IMPALER };
    if (mnum >= 0 && naturalShapechanger(mnum))
        return { valid: true, form: baseMnum };
    if (mnum === PM_WOLF)
        return { valid: baseMnum !== PM_VAMPIRE, form: mnum };
    if (mnum === PM_FOG_CLOUD || mnum === PM_VAMPIRE_BAT)
        return { valid: true, form: mnum };
    switch (monsterClass) {
        case S_VAMPIRE: return { valid: true, form: baseMnum };
        case S_BAT: return { valid: true, form: PM_VAMPIRE_BAT };
        case S_VORTEX: return { valid: true, form: PM_FOG_CLOUD };
        case S_DOG:
            if (baseMnum !== PM_VAMPIRE)
                return { valid: true, form: PM_WOLF };
            return { valid: false, form: NON_PM };
        default: return { valid: false, form: NON_PM };
    }
}
// C mon.c:wiz_force_cham_form(): the wizard-mode monpolycontrol prompt. The
// player names the next form (or a class, or "random"); five tries, then
// the caller falls back to an arbitrary shape.
async function wizForceChamForm(monster, state) {
    const coordinateMode = state.iflags.getpos_coords
        && state.iflags.getpos_coords !== GPCOORDS_NONE
        ? state.iflags.getpos_coords : GPCOORDS_MAP;
    let prompt = `Change ${monsterName(monster, { state, article: 'your', suppressIt: true })}`
        + ` @ ${coordinateDescription(monster.mx, monster.my, coordinateMode)} into what?`;
    const TRY_LIMIT = 5;
    let triesLeft = TRY_LIMIT;
    let mnum = null;
    let monsterClass = 0;
    for (;;) {
        if (triesLeft === TRY_LIMIT - 1)
            prompt = `${prompt.slice(0, -1)} kind of monster?`;
        monsterClass = 0;
        const answer = await getLine(prompt, (_character, key) => key >= 32 && key < 127);
        const text = answer === null ? null : answer.trim().replace(/\s+/g, ' ');
        // Escape keeps whatever an earlier round left; only a valid answer
        // ever survives one, so that is always "no form".
        if (text === null)
            break;
        if (text === '*' || text.toLowerCase() === 'random') {
            mnum = null;
            break;
        }
        mnum = nameToMonster(text);
        if (mnum < 0) {
            const match = resolveMonsterClass(text);
            monsterClass = match.monsterClass;
            mnum = match.mnum;
            if (monsterClass > 0 && mnum < 0)
                mnum = pickFormFromClass(monsterClass);
        }
        // An answer that names nothing leaves NON_PM like native; the null
        // keeps a later Escape or exhaustion meaning "pick at random"
        // instead of a stale -1 that re-prompts.
        if (mnum < 0)
            mnum = null;
        if (mnum !== null) {
            const shifted = validVampForm(monster, mnum, monsterClass, state);
            if (shifted.valid) {
                mnum = shifted.form;
                break;
            }
            mnum = null;
        }
        await plineWithContinuation("It can't become that.");
        if (--triesLeft <= 0)
            break;
    }
    if (triesLeft <= 0)
        await plineWithContinuation(thats_enough_tries);
    if (monsterIsVampireShifter(monster)) {
        // validvamp() rewrites mndx even when it accepts: Vlad with the
        // Candelabrum keeps his true form from an empty or random answer,
        // and a class answer maps onto the shifter's own forms.
        const shifted = validVampForm(monster, mnum ?? NON_PM, monsterClass, state);
        mnum = shifted.valid ? shifted.form : pickVampireShape(monster);
    }
    return mnum;
}
// C select_newcham_form()'s switch under monpolycontrol: the cham-specific
// draw still consumes its random calls, then the wizard answer overrides it.
async function drawChamFormForControl(monster, baseMnum) {
    if (baseMnum === PM_DOPPELGANGER) {
        await pickDoppelgangerChamForm(monster);
    }
    else if (baseMnum === PM_SANDESTIN) {
        if (rn2(7))
            pickNastyShape((MONSTER_DIFFICULTY[PM_ARCHON] ?? 0) - 1);
    }
    else if (baseMnum === PM_CHAMELEON) {
        if (!rn2(3))
            pickAnimalShape(chameleonAnimals());
    }
    else if (baseMnum === PM_VAMPIRE || baseMnum === PM_VAMPIRE_LEADER
        || baseMnum === PM_VLAD_THE_IMPALER) {
        pickVampireShape(monster);
    }
    else {
        dragonArmorForm(monster);
    }
}
// C newcham()'s twenty-attempt accept loop around select_newcham_form(),
// taken when the player runs monpolycontrol. A rejected answer re-prompts.
async function selectControlledForm(monster, baseMnum, state) {
    for (let triesLeft = 20; triesLeft > 0; --triesLeft) {
        await drawChamFormForControl(monster, baseMnum);
        let mnum = await wizForceChamForm(monster, state);
        if (mnum == null)
            mnum = randomShape(monster, baseMnum);
        const wantsUppercase = triesLeft > 15 && Is_rogue_level(state.u.uz)
            && !/^[A-Z]$/.test(monsterClassSymbol(mnum));
        if (acceptsShapechangerForm(baseMnum, mnum) && !wantsUppercase)
            return mnum;
    }
    return null;
}
// C mon.c:rescham()/normal_shape(). The level array reverses fmon's order;
// the snapshot also preserves the next actor while polymorph changes state.
export async function restoreNaturalMonsterShapes(state = game, publish = plineWithContinuation) {
    requireLiveGame(state);
    for (const monster of [...(state.level?.monsters ?? [])].reverse()) {
        if (monster.mhp <= 0 || (monster.mstate ?? MON_FLOOR) !== MON_FLOOR)
            continue;
        await normalizeMonsterShape(monster, state, publish);
        if (state.program_state.gameover)
            return;
    }
}
// C mon.c:restore_cham(). This restoration is independent of elapsed turns:
// protection can have changed while the monster's level was unloaded.
export async function restoreMonsterShape(monster, state = game) {
    requireLiveGame(state);
    if (state.u.protectionFromShapeChangers || state.protectionFromShapeChangers
        || monster.mcan) {
        await normalizeMonsterShape(monster, state, plineWithContinuation);
    }
    else if (monster.cham === NON_PM) {
        monster.cham = naturalShapechanger(monster.mnum) ? monster.mnum : NON_PM;
    }
}
// C mon.c:normal_shape(), shared by cancellation, protection and restoration.
// A change means a different body, a revealed disguise, or an interrupted meal.
export async function normalizeMonsterShape(monster, state = game, publish = plineWithContinuation) {
    requireLiveGame(state);
    let changed = false;
    const naturalForm = monster.cham;
    if (ismnum(naturalForm)) {
        const cancelled = monster.mcan;
        const change = await changeMonsterForm(monster, naturalForm, state, { showMessage: true, publish });
        changed = !!change;
        if (change?.heroDied || state.program_state.gameover)
            return { changed, heroDied: true };
        monster.cham = NON_PM;
        if (cancelled)
            monster.mcan = 1;
        await newsym(monster.mx, monster.my);
    }
    if (isWereMonster(monster) && !isHumanWereMonster(monster)) {
        changed = await transformWereMonster(monster, state, { publish }) || changed;
        if (state.program_state.gameover)
            return { changed, heroDied: true };
    }
    const appearance = M_AP_TYPE(monster);
    if (appearance === M_AP_NOTHING)
        return { changed, heroDied: false };
    if (monster.meating)
        await finishMonsterEating(monster, state);
    else {
        if (appearance !== M_AP_MONSTER)
            monster.msleeping = 1;
        await revealMonsterAppearance(monster);
    }
    return { changed: true, heroDied: false };
}
// C mon.c:restartcham(). Cancellation still forbids changing form; a sleeping
// mimic regains its ordinary disguise once protection stops suppressing it.
export async function restartMonsterShapechanging(state = game) {
    requireLiveGame(state);
    for (const monster of [...(state.level?.monsters ?? [])].reverse()) {
        if (monster.mhp <= 0 || (monster.mstate ?? MON_FLOOR) !== MON_FLOOR)
            continue;
        if (!monster.mcan)
            monster.cham = naturalShapechanger(monster.mnum) ? monster.mnum : NON_PM;
        if (MONSTER_SYMBOL[monster.mnum] === 13 && monster.msleeping) { // S_MIMIC
            await setMimicAppearance(monster);
            await newsym(monster.mx, monster.my);
        }
    }
}
async function dropBouldersTheNewFormCannotCarry(monster, state, polyspot, publish) {
    if ((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_ROCKTHROW)
        return [];
    const boulders = (monster.minvent || monster.inventory || [])
        .filter(object => object.otyp === BOULDER);
    const dropped = [];
    for (const object of boulders) {
        if (monster.dead || monster.mhp <= 0)
            break;
        if (polyspot) {
            bypassObject(object, state);
        }
        unlinkMonsterObject(monster, object);
        const placed = await landFloorObject(object, monster.mx, monster.my, { state, publish });
        if (placed)
            dropped.push(placed);
    }
    return dropped;
}
async function initialShapechangedMonster(monster, targetMnum) {
    const baseMnum = monster.mnum;
    const female = shapechangerGender(baseMnum, targetMnum, !!monster.female);
    const { level, hp } = newMonsterHitPoints(targetMnum);
    const permanentlyInvisible = targetMnum === PM_STALKER
        || targetMnum === PM_BLACK_LIGHT;
    const oldNaturallyInvisible = baseMnum === PM_STALKER
        || baseMnum === PM_BLACK_LIGHT;
    const inventory = [];
    // Keep the actor already linked on the level while changing its body.
    monster.mnum = targetMnum;
    monster.cham = baseMnum;
    monster.mhp = monster.mhpmax = hp;
    monster.m_lev = level;
    monster.female = female;
    monster.msleeping = monster.msleeping ?? 0;
    monster.mpeaceful = monster.mpeaceful ? 1 : 0;
    monster.mcanmove = 1;
    monster.mcansee = monster.mcansee ?? 1;
    if (!monster.perminvis || oldNaturallyInvisible)
        monster.perminvis = permanentlyInvisible;
    monster.minvis = monster.invis_blkd ? 0 : !!monster.perminvis;
    monster.movement = 0;
    monster.mmove = MONSTER_MOVE[targetMnum] ?? 0;
    monster.mspeed = 0;
    monster.symbol = monsterClassSymbol(targetMnum);
    monster.color = requireMonsterData(MONSTER_COLOR, targetMnum);
    monster.hasInventory = false;
    monster.minvent = monster.inventory = inventory;
    monster.weaponCheck = 0;
    // newcham() owns a fresh worm body, including its tail roll. The
    // caller's MM_NOTAIL only controls an ordinary long-worm birth.
    if (targetMnum === PM_LONG_WORM)
        await initializeMonsterWormBody(monster);
    return monster;
}
export async function initialShapechangedBirth(monster) {
    const baseMnum = monster?.mnum;
    if (!naturalShapechanger(baseMnum) || shapechangerProtectionActive())
        return null;
    monster.cham = baseMnum;
    // makemon() keeps Vlad in his natural body to carry the Candelabrum.
    if (baseMnum === PM_VLAD_THE_IMPALER)
        return null;
    // newcham() saves this name even with NC_SHOW_MSG disabled, so
    // hallucination must choose it before selecting the new body.
    monsterName(monster);
    let targetMnum = null;
    if (game.flags.debug && game._monPolycontrol) {
        // makemon() births a shapechanger through newcham(mtmp, 0), so the
        // wizard prompt owns the first form here as well.
        targetMnum = await selectControlledForm(monster, baseMnum, game);
    }
    else if (baseMnum === PM_DOPPELGANGER) {
        targetMnum = await selectDoppelgangerForm(monster);
        if (targetMnum === PM_DOPPELGANGER)
            targetMnum = null;
    }
    else if (baseMnum === PM_CHAMELEON) {
        targetMnum = selectChameleonForm(monster);
        if (targetMnum === PM_CHAMELEON)
            targetMnum = null;
    }
    else if (baseMnum === PM_SANDESTIN) {
        targetMnum = selectSandestinForm(monster);
    }
    else if (baseMnum === PM_VAMPIRE || baseMnum === PM_VAMPIRE_LEADER) {
        targetMnum = pickVampireShape(monster);
    }
    if (targetMnum === null || targetMnum === baseMnum
        || !acceptsShapechangerForm(baseMnum, targetMnum))
        return null;
    const changed = await initialShapechangedMonster(monster, targetMnum);
    changed.meverseen = 0;
    await newsym(changed.mx, changed.my);
    // newcham() ends with mon_break_armor() even for a newborn without
    // armor; its perceived pronouns still draw while the hero hallucinates.
    await adjustMonsterClothingAfterPolymorph(changed, game);
    await refreshNewMonsterFormPerception(changed, game, plineWithContinuation);
    return changed;
}
// C mon.c:newcham() names the changed form with an x_monnam() call whose
// saddle is always suppressed.
export function monsterFormChangeName(monster, { state = game } = {}) {
    requireLiveGame(state);
    const name = formatMonsterName(monster, state, {
        article: 'your', suppressSaddle: true,
    });
    return name.charAt(0).toUpperCase() + name.slice(1);
}
export async function changeMonsterForm(monster, forcedTargetMnum = null, state = game, { showMessage = false, publish = plineWithContinuation, finishDeath = (target, options) => finishEnvironmentalMonsterDeath(target, state, options), creditHero = !state.context?.mon_moving, polyspot = false, } = {}) {
    requireLiveGame(state);
    let baseMnum = monster.cham !== undefined
        && Number.isInteger(monster.cham) && monster.cham >= 0
        ? monster.cham : -1;
    if (baseMnum < 0 && POLYMORPH_IMMUNE_MONSTERS.has(monster?.mnum))
        return null;
    if (baseMnum < 0 && monster?.mcan
        && naturalShapechanger(monster.mnum)
        && !shapechangerProtectionActive()) {
        baseMnum = monster.mnum;
        monster.cham = baseMnum;
        monster.mcan = 0;
    }
    const oldMnum = monster.mnum;
    const wasSpotted = canSpotMonster(monster);
    const oldSubject = showMessage ? monsterFormChangeName(monster, { state }) : null;
    const oldName = monsterName(monster, { state });
    const oldWasFluid = monsterIsAmorphous(monster) || monsterIsWhirly(monster);
    let targetMnum = forcedTargetMnum;
    if (targetMnum == null && state.flags.debug && state._monPolycontrol) {
        // select_newcham_form(): the wizard prompt overrides the cham pick.
        targetMnum = await selectControlledForm(monster, baseMnum, state);
    }
    else if (targetMnum == null && baseMnum === PM_DOPPELGANGER) {
        targetMnum = await selectDoppelgangerForm(monster);
    }
    else if (targetMnum == null && baseMnum === PM_SANDESTIN) {
        targetMnum = selectSandestinForm(monster);
    }
    else if (targetMnum == null && baseMnum === PM_CHAMELEON) {
        targetMnum = selectChameleonForm(monster);
    }
    else if (targetMnum == null && (baseMnum === PM_VAMPIRE
        || baseMnum === PM_VAMPIRE_LEADER
        || baseMnum === PM_VLAD_THE_IMPALER)) {
        targetMnum = pickVampireShape(monster);
    }
    else if (targetMnum == null) {
        targetMnum = selectOrdinaryPolymorphForm(monster);
    }
    if (targetMnum == null || targetMnum === monster.mnum
        || speciesWasGenocided(targetMnum, game))
        return null;
    if (monster.wormno) {
        await removeMonsterWormBody(monster);
        await placeMonsterOnMap(monster, monster.mx, monster.my);
    }
    if (M_AP_TYPE(monster) && MONSTER_SYMBOL[targetMnum] !== 13)
        await revealMonsterAppearance(monster);
    const oldHp = Math.max(1, monster.mhp ?? 1);
    const oldMax = Math.max(1, monster.mhpmax ?? oldHp);
    const female = shapechangerGender(baseMnum, targetMnum, !!monster.female);
    if (In_endgame(state.u.uz) && monsterIsPlayerMonster(oldMnum)) {
        const name = MGIVENNAME(monster);
        const rank = name.indexOf(' the ');
        if (rank >= 0)
            setMonsterGivenName(monster, name.slice(0, rank));
    }
    const { level, hp } = newMonsterHitPoints(targetMnum);
    const scaledHp = Math.trunc(oldHp * hp / oldMax);
    const oldNaturallyInvisible = monster.mnum === PM_STALKER
        || monster.mnum === PM_BLACK_LIGHT;
    const naturallyInvisible = targetMnum === PM_STALKER
        || targetMnum === PM_BLACK_LIGHT;
    setMonsterSpecies(monster, targetMnum);
    monster.m_lev = level;
    monster.mhpmax = hp;
    monster.mhp = Math.max(1, Math.min(hp, scaledHp));
    monster.female = female;
    let leashReleased = false;
    let leashReleaseVisible = false;
    if (monster.mleashed && !monsterCanBeLeashed(monster)) {
        leashReleaseVisible = canSeeMonster(monster);
        await releaseMonsterLeashWithFeedback(monster, { state, publish });
        leashReleased = true;
    }
    if (monsterEmitsLight(oldMnum) !== monsterEmitsLight(targetMnum))
        state.vision_full_recalc = 1;
    if (!monster.perminvis || oldNaturallyInvisible)
        monster.perminvis = naturallyInvisible;
    monster.minvis = monster.invis_blkd ? 0 : !!monster.perminvis;
    if (monster.mundetected)
        await hideMonsterUnder(monster, state);
    if (state.u.ustuck === monster) {
        if (state.u.uswallow) {
            if (!monsterCanEngulf(monster)) {
                if (!monsterIsNoncorporeal(monster) && !monsterIsWhirly(monster)
                    && !monsterIsAmorphous(monster)
                    && MONSTER_SYMBOL[targetMnum] !== S_LIGHT) {
                    const trail = monsterIsVampireShifter(monster)
                        ? ` which was a shapeshifted ${namelessMonsterName(monster, { state })}`
                        : monsterDigests(monster) ? "'s stomach" : '';
                    await publish(`You ${oldWasFluid ? 'emerge from' : 'break out of'} ${oldName}${trail}!`);
                    monster.mhp = 1;
                    showMessage = false;
                }
                const expulsion = await expelHero(monster, {
                    state, publish, message: false, engulfingSpecies: oldMnum,
                });
                if (expulsion.died)
                    return {
                        oldMnum, newMnum: targetMnum, heroDied: true,
                        leashReleased, leashReleaseVisible,
                    };
            }
            else {
                await swallowed(false);
            }
        }
        else if ((!monsterSpeciesSticks(targetMnum) && !heroFormSticks(state))
            || monsterIsUnsolid(monster)) {
            await releaseHeroFromMonster(monster, { state, publish });
        }
    }
    if (targetMnum === PM_LONG_WORM)
        await initializeMonsterWormBody(monster);
    monster.meverseen = 0;
    await newsym(monster.mx, monster.my);
    let message = null;
    if (showMessage) {
        const nowSpotted = canSpotMonster(monster);
        if (nowSpotted) {
            if (wasSpotted)
                message = `${oldSubject} turns into ${namelessMonsterName(monster, { state, article: 'a' })}!`;
            else
                message = `${monsterName(monster, {
                    state, capitalized: true, article: monster.mtame ? 'your' : 'a',
                    suppressSaddle: false,
                })} appears!`;
            await publish(message);
        }
        else {
            if (wasSpotted) {
                message = `${oldSubject} disappears!`;
                await publish(message);
            }
            // C newcham(): a form the hero cannot spot may still reach the nose.
            await smellUnseenMonster(targetMnum, state, publish);
        }
    }
    if (baseMnum < 0 && MONSTER_SYMBOL[targetMnum] === S_VAMPIRE
        && naturalShapechanger(targetMnum)
        && !shapechangerProtectionActive()) {
        monster.cham = targetMnum;
    }
    const droppedWeapon = await updateMonsterWeaponAfterPolymorph(monster, state, { publish, polyspot });
    const clothing = await adjustMonsterClothingAfterPolymorph(monster, state, { publish, polyspot });
    const selfTouch = await monsterSelfTouchAfterPolymorph(monster, {
        finishDeath, creditHero, publish, state,
    });
    if (selfTouch.heroDied)
        return {
            oldMnum, newMnum: targetMnum, heroDied: true,
            leashReleased, leashReleaseVisible, droppedWeapon,
            droppedClothing: clothing.dropped, destroyedClothing: clothing.destroyed,
            selfTouch, message,
        };
    checkMonsterGearNextTurn(monster);
    const droppedBoulders = selfTouch.survived
        ? await dropBouldersTheNewFormCannotCarry(monster, state, polyspot, publish) : [];
    const steedChange = state.u.usteed === monster
        ? await adjustRiderAfterSteedPolymorph(monster, oldMnum, state, publish) : null;
    if (!steedChange?.died && !state.program_state.gameover)
        await refreshNewMonsterFormPerception(monster, state, publish);
    return {
        oldMnum,
        newMnum: targetMnum,
        heroDied: !!steedChange?.died || !!state.program_state.gameover,
        leashReleased,
        leashReleaseVisible,
        droppedWeapon,
        droppedClothing: clothing.dropped,
        destroyedClothing: clothing.destroyed,
        droppedBoulders,
        selfTouch,
        message,
    };
}
// C mon.c:newcham() tail. A form changed during monster movement gets a
// fresh chance to locate the hero, then tests fear using that new body.
async function refreshNewMonsterFormPerception(monster, state, publish) {
    if (!state.context.mon_moving)
        return;
    if (monster.mux !== state.u.ux || monster.muy !== state.u.uy)
        setMonsterApparentHeroPosition(monster, state, rn2);
    const targetX = monster.mux ?? 0, targetY = monster.muy ?? 0;
    const dx = monster.mx - targetX, dy = monster.my - targetY;
    const nearby = dx * dx + dy * dy < 3
        && !(monster.mnum === PM_GRID_BUG && dx && dy);
    if (!monster.mpeaceful && monsterIsScaredAt(monster, state, targetX, targetY) && nearby)
        await makeMonsterFlee(monster, {
            state, turns: rn1(9, 2), first: true, announce: true, publish,
        });
}
function vampireMayShiftOutOfSight(monster, state) {
    const visible = canSeeMonster(monster);
    const dx = monster.mx - (state.u?.ux ?? monster.mx);
    const dy = monster.my - (state.u?.uy ?? monster.my);
    return !visible || dx * dx + dy * dy > BOLT_LIM * BOLT_LIM;
}
export async function decideMonsterShapeChange(monster, state = game, random = rn2, { publish = plineWithContinuation } = {}) {
    const baseMnum = monster.cham !== undefined
        && Number.isInteger(monster.cham) && monster.cham >= 0
        ? monster.cham : null;
    if (baseMnum === null)
        return null;
    const vampireShifter = baseMnum === PM_VAMPIRE
        || baseMnum === PM_VAMPIRE_LEADER
        || baseMnum === PM_VLAD_THE_IMPALER;
    let targetMnum = null;
    let shouldChange = false;
    if (!vampireShifter) {
        if (!(monster.mspec_used ?? 0) && random(6) === 0) {
            monster.mspec_used = 3 + random(10);
            shouldChange = true;
        }
    }
    else if (!((monster.mstrategy ?? 0) & STRAT_WAITFORU)) {
        const inVampireForm = MONSTER_SYMBOL[monster.mnum] === S_VAMPIRE;
        if (!inVampireForm) {
            if (monster.mhp <= Math.trunc(((monster.mhpmax ?? 0) + 5) / 6)
                && random(4) !== 0) {
                targetMnum = baseMnum;
                shouldChange = true;
            }
            else if (monster.mnum === PM_FOG_CLOUD
                && monster.mhp === monster.mhpmax
                && random(4) === 0
                && vampireMayShiftOutOfSight(monster, state)) {
                targetMnum = pickVampireShape(monster);
                shouldChange = targetMnum !== monster.mnum;
            }
            const square = state.level?.at(monster.mx, monster.my);
            if (shouldChange && monsterIsAmorphous(monster)
                && square?.typ === DOOR && square.doormask & (D_CLOSED | D_LOCKED)) {
                const position = findNearbyMonsterPosition(targetMnum, monster.mx, monster.my, { state, random });
                if (position)
                    await relocateMonsterTo(monster, position.x, position.y, { state, random });
            }
        }
        else if (monster.mhp >= Math.trunc(9 * (monster.mhpmax ?? 0) / 10)
            && random(6) === 0
            && vampireMayShiftOutOfSight(monster, state)) {
            shouldChange = true;
        }
    }
    if (!shouldChange)
        return null;
    const wasFemale = !!monster.female;
    const change = await changeMonsterForm(monster, targetMnum, state, { showMessage: true, publish });
    if (change?.heroDied)
        return change;
    if (change && vampireShifter) {
        const flags = MONSTER_FLAGS2[monster.mnum] ?? 0;
        if (!(flags & (M2_MALE | M2_FEMALE | M2_NEUTER)))
            monster.female = wasFemale;
    }
    return change;
}
// ── C mon.c:usmellmon(). A hero with a sense of smell notices a
// monster they cannot currently spot. Species-specific smells take
// precedence; remaining species fall through to a class-based smell,
// and several species are deliberately smell-free.
const S_DRAGON = 30;
const S_FUNGUS = 32;
const S_UNICORN = 21;
const S_ZOMBIE = 52;
const S_ORC = 15;
const M2_ORC = 0x00000080;
const PM_PONY = 100;
// Species with their own smell, mirroring the mndx switch in usmellmon().
const SPECIES_SMELLS = new Map([
    [81, 'You notice a bovine smell.'], // rothe
    [177, 'You notice a bovine smell.'], // minotaur
    [333, 'You smell body odor.'], // cave dweller
    [332, 'You smell body odor.'], // barbarian
    [371, 'You smell body odor.'], // neanderthal
    [261, "You detect an odor reminiscent of an animal's den."], // human wererat
    [262, "You detect an odor reminiscent of an animal's den."], // human werejackal
    [263, "You detect an odor reminiscent of an animal's den."], // human werewolf
    [91, "You detect an odor reminiscent of an animal's den."], // wererat
    [15, "You detect an odor reminiscent of an animal's den."], // werejackal
    [21, "You detect an odor reminiscent of an animal's den."], // werewolf
    [235, "You detect an odor reminiscent of an animal's den."], // owlbear
    [110, 'You smell steam.'], // steam vortex
    [208, 'Something stinks.'], // green slime
    [164, 'You smell mushrooms.'], // violet fungus
    [163, 'You smell mushrooms.'], // shrieker
]);
// Species the mndx switch holds smell-free so the class switch below
// cannot trigger for them.
const UNSCENTED_SPECIES = new Set([
    291, // horned devil
    302, // balrog
    309, // Asmodeus
    307, // Dispater
    304, // Yeenoghu
    305, // Orcus
    101, // white unicorn
    102, // gray unicorn
    103, // black unicorn
    316, // jellyfish
]);
// C maybe_polyd(is_orc(gy.youmonst.data), Race_if(PM_ORC)): a polymorphed
// hero smells like the current form, an unpolymorphed one like the race.
function heroSmellsAttractiveToOrcs(state) {
    const form = heroMonsterForm(state);
    if (form !== null)
        return !!((MONSTER_FLAGS2[form] ?? 0) & M2_ORC);
    return state.urace?.name === 'orc';
}
export async function smellUnseenMonster(mnum, state = game, publish = plineWithContinuation) {
    if (!Number.isInteger(mnum) || MONSTER_NAME[mnum] === undefined)
        return false;
    if (!heroHasOlfaction(state))
        return false;
    const speciesSmell = SPECIES_SMELLS.get(mnum);
    if (speciesSmell !== undefined) {
        await publish(speciesSmell);
        return true;
    }
    if (UNSCENTED_SPECIES.has(mnum))
        return false;
    switch (MONSTER_SYMBOL[mnum] ?? 0) {
        case S_DOG:
            await publish('You notice a dog smell.');
            return true;
        case S_DRAGON:
            await publish('You smell a dragon!');
            return true;
        case S_FUNGUS:
            await publish('Something smells moldy.');
            return true;
        case S_UNICORN:
            await publish(mnum === PM_PONY
                ? 'You detect an odor reminiscent of a stable.'
                : 'You detect a strong odor reminiscent of a stable.');
            return true;
        case S_ZOMBIE:
            await publish('You smell rotting flesh.');
            return true;
        case S_EEL:
            await publish('You smell fish.');
            return true;
        case S_ORC:
            await publish(heroSmellsAttractiveToOrcs(state)
                ? 'You notice an attractive smell.'
                : 'A foul stench makes you feel a little nauseated.');
            return true;
        default:
            return false;
    }
}
// C mon.c:see_nearby_monsters(). Only a completed timed action records
// nearby species; ordinary map redraws do not add to the close-up count.
export async function seeNearbyMonsters(state = game) {
    const hero = state.u;
    if (!state.level || heroIsHallucinating(state)
        || heroIsBlind(state) && !hero.telepathy)
        return;
    for (let x = hero.ux - 1; x <= hero.ux + 1; x++) {
        for (let y = hero.uy - 1; y <= hero.uy + 1; y++) {
            if (!isok(x, y))
                continue;
            const monster = monsterAtPosition(state.level, x, y);
            if (!monster)
                continue;
            const species = M_AP_TYPE(monster) === M_AP_MONSTER
                ? monster.mappearance : monster.mnum;
            if (species === undefined)
                throw new Error(`Monster ${monster.m_id} has no disguise species`);
            if (state.mvitals?.[species]?.seen_close)
                continue;
            if (canSeeMonster(monster) || monster.mundetected && canSenseMonster(monster)) {
                state.bhitpos.x = x;
                state.bhitpos.y = y;
                state.notonhead = x !== monster.mx || y !== monster.my;
                await seeMonsterCloseup(monster, {
                    onHead: !state.notonhead, state,
                });
            }
        }
    }
}
export async function seeMonsterCloseup(monster, { photo = false, onHead = true, state = game } = {}) {
    requireLiveGame(state);
    if (heroIsHallucinating(state) || heroIsBlind(state) && !state.u.telepathy)
        return;
    const disguise = M_AP_TYPE(monster);
    const actualSpecies = !onHead && monster.mnum === MONSTER_NAME.indexOf('long worm')
        ? MONSTER_NAME.indexOf('long worm tail') : monster.mnum;
    const species = disguise === M_AP_MONSTER ? monster.mappearance : actualSpecies;
    if (species === undefined)
        throw new Error(`Monster ${monster.m_id} has no disguise species`);
    const seenSpecies = disguise === M_AP_MONSTER && !canSenseMonster(monster)
        ? species : actualSpecies;
    const seen = speciesVitals(state, seenSpecies);
    const lifelist = state.context.lifelist || (state.context.lifelist = {});
    if (!seen.seen_close) {
        seen.seen_close = 1;
        lifelist.total_seen_upclose = (lifelist.total_seen_upclose || 0) + 1;
    }
    if (!photo || monster.minvis || monster.mundetected
        || ![M_AP_NOTHING, M_AP_MONSTER].includes(disguise))
        return;
    const vital = speciesVitals(state, species);
    if (vital.photographed)
        return;
    vital.photographed = 1;
    lifelist.total_photographed = (lifelist.total_photographed || 0) + 1;
    if (state.urole?.key === 'tourist' && species === monster.mnum
        && (monster.m_id !== state.context.startingpet_mid
            || species !== state.context.startingpet_typ)) {
        addExperience(monsterExperience(monster, {
            killCount: 0, armorClass: findMonsterArmorClass(monster),
            amphibious: heroIsAmphibious(state),
        }), 0, state);
        await checkExperienceLevel();
    }
}
function speciesVitals(state, species) {
    const vitals = state.mvitals || (state.mvitals = []);
    return vitals[species] ?? (vitals[species] = { mvflags: 0, born: 0, died: 0 });
}
// ---------------------------------------------------------------------------
// C mon.c:mondead() restores a shapechanger's true species before its
// remains are described.
// ---------------------------------------------------------------------------
const HUMAN_WERE_SPECIES = new Map([
    [15, 262], // werejackal, human werejackal
    [21, 263], // werewolf, human werewolf
    [91, 261], // wererat, human wererat
]);
export function restoreMonsterTrueSpecies(monster) {
    const storedSpecies = monster.cham !== undefined
        && Number.isInteger(monster.cham) && monster.cham >= 0
        ? monster.cham : null;
    const trueSpecies = storedSpecies
        ?? HUMAN_WERE_SPECIES.get(monster.mnum);
    if (trueSpecies === undefined || !Number.isInteger(trueSpecies) || trueSpecies < 0)
        return null;
    const oldSpecies = monster.mnum;
    setMonsterSpecies(monster, trueSpecies);
    if (storedSpecies !== null)
        monster.cham = NON_PM;
    return { oldSpecies, trueSpecies };
}
//# sourceMappingURL=mon.js.map