// apply.js — Apply/use-tool command and the apply.c tool ports.
// C ref: apply.c doapply(), dorub(), dojump(), do_break_wand(), use_trap(),
// use_whip(), the use_*() tool functions, snuff_lit()/snuff_candle(),
// splash_lit(), catch_lit(), unfixable_trouble_count(), fig_transform()
// and figurine_location_checks(). The catch helper
// stays in light.ts with the burning-object owners; the apply.ts <-> light.ts
// import cycle is function-body-only.

import {
    WEAPON_CLASS, RING_CLASS, TOOL_CLASS, FOOD_CLASS, POTION_CLASS, SPBOOK_CLASS, WAND_CLASS, COIN_CLASS,
    GEM_CLASS,
} from './objclass.js';
import {
    objectClassForType, objectBaseCost, objectSkill, objectMagic, AMULET_OF_YENDOR, BAG_OF_TRICKS, BANANA,
    BEARTRAP, BELL, BELL_OF_OPENING, BLINDFOLD, BOULDER, BRASS_LANTERN, BULLWHIP, CAN_OF_GREASE,
    CANDELABRUM_OF_INVOCATION, CORPSE, CREAM_PIE, CREDIT_CARD, CRYSTAL_BALL, EGG, EUCALYPTUS_LEAF,
    EXPENSIVE_CAMERA, FIGURINE, GRAPPLING_HOOK, HORN_OF_PLENTY, LAND_MINE, LEASH, LENSES, LOCK_PICK,
    LUMP_OF_ROYAL_JELLY, MAGIC_LAMP, MAGIC_MARKER, MAGIC_WHISTLE, MIRROR, OIL_LAMP, POT_OIL, SADDLE, SKELETON_KEY,
    SLIME_MOLD, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_JUMPING, SPE_NOVEL, STATUE, STETHOSCOPE, TALLOW_CANDLE,
    TIN, TIN_OPENER, TIN_WHISTLE, TINNING_KIT, TOUCHSTONE, TOWEL, UNICORN_HORN, WAN_CANCELLATION, WAN_COLD,
    WAN_CREATE_MONSTER, WAN_DEATH, WAN_DIGGING, WAN_ENLIGHTENMENT, WAN_FIRE, WAN_LIGHT, WAN_LIGHTNING,
    WAN_LOCKING, WAN_MAGIC_MISSILE, WAN_NOTHING, WAN_OPENING, WAN_POLYMORPH, WAN_PROBING,
    WAN_SECRET_DOOR_DETECTION, WAN_STASIS, WAN_STRIKING, WAN_TELEPORTATION, WAN_UNDEAD_TURNING, WAN_WISHING,
    WAX_CANDLE,
} from './object_data.js';
import { publishMonsterGrowl, publishMonsterWhimper, publishMonsterYelp } from './sounds.js';
import { OBJ_DESCR, objectTypeColor, learnObjectType, objectMaterial, objectTypeKnown } from './o_init.js';
import {
    armorSimpleName, armorSlotFor, fingersOrGloves, heroHasFreeAction, applyEyewear, removeEyewear,
    heroHasSlipperyHands, heroIsStrangled, heroHasWaterWalking,
} from './do_wear.js';
import { artifactById, speakArtifact, retouchHeroObject } from './artifact.js';
import { currentAttribute } from './attrib.js';

import { bot } from './botl.js';
import {
    dropBoulderIntoLiquid, dropInventoryObjectAtHero, woundHeroLegs, reviveCorpseImmediately, gotoLevel,
    objectNoLongerHeld,
} from './do.js';
import {
    commandResultCancelled, commandResultFailed, commandResultSpentTime, cmdq_add_ec, cmdq_add_key, setMulti,
    isok, paranoidQuery, confusePromptDirection, promptDirection,
} from './cmd.js';
import { A_CHA, A_CON, A_DEX, A_NONE, A_STR, ACCESSIBLE, AIR, BEAR_TRAP, CLOUD, COLNO, CORR, CQ_CANNED, D_CLOSED, D_ISOPEN, D_LOCKED, DIGCHECK_FAIL_BOULDER, DIGCHECK_FAILED, DOOR, EXPL_FIERY, EXPL_FROSTY, EXPL_MAGICAL, G_GONE, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_EXCLUDE_INACCESS, GETOBJ_EXCLUDE_NONINVENT, GETOBJ_EXCLUDE_SELECTABLE, GETOBJ_SUGGEST, HOLE, HOMEMADE_TIN, ICE, IS_AIR, Is_airlevel, IS_DOOR, IS_FURNITURE, IS_OBSTRUCTED, Is_stronghold, IS_STWALL, IS_WALL, Is_waterlevel, KILLED_BY, LANDMINE, LEVEL_TIMER_KIND, LUCKMIN, M_AP_FURNITURE, M_AP_MONSTER, M_AP_OBJECT, M_AP_TYPE, MAXULEV, MM_NOMSG, MONSEEN_INFRAVIS, MONSEEN_NORMAL, MONSEEN_SEEINVIS, NO_KILLER_PREFIX, NO_MINVENT, OBJECT_TIMER_KIND, P_BASIC, P_RIDING, P_SKILLED, P_TWO_WEAPON_COMBAT, PARANOID_BREAKWAND, PIT, PLNMSG_enum, RLOC_MSG, RLOC_NONE, ROOM, ROWNO, SCORR, SDOOR, SHOPBASE, SICK_ALL, SICK_NONVOMITABLE, STATUE_TRAP, STONE, TREE, TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_PIT, TT_WEB, Upolyd, W_NONPASSWALL, WEAK, xdir, ydir, IS_WATERWALL, LAVAWALL, HAND, FACE, FINGER, LEG, FOOT, HEAD, STOMACH, NOSE } from './const.js';
import { use_container, pickupFloorObject, handlesPetrifyingCorpseBareHanded } from './pickup.js';
import { useCrystalBall, convertSecretDoor, findit, openit } from './detect.js';
import {
    digActualHole, digCheck, liquidFlow, liquidForHole, watchDigging, freeHeroFromBuriedBall, usePickAxe,
} from './dig.js';
import { canSeeMonster, canSenseMonster, canSpotMonster, feel_newsym, glyphAt, map_invisible, map_object, newsym, unmap_invisible } from './display.js';
import type { GlyphMetadata } from './display.js';
import { displayColorName, displayLiquidName, monsterLeashName, monsterName, monsterReflexiveAction, objectMonsterName, monsterTypeName } from './do_name.js';
import {
    attachEggHatchTimer, killEgg, beginObjectBurn, endObjectBurn, objectTimers, stopLevelTimer, stopObjectTimer,
    scheduleObjectTimer,
} from './timeout.js';
import type { DueObjectTimer } from './timeout.js';
import { heroHasFreeHand, wipeHeroEngraving, heroCanReachFloor } from './engrave.js';
import { gulp_blnd_check } from './mhitu.js';
import { paralyzeMonster } from './mhitm.js';
import { explode } from './explode.js';
import { makeFamiliar } from './dog.js';
import {
    useUpFloorObject, feelPetrifyingCorpse, willFeelPetrifyingCorpse, holdAnotherObject, freeInventoryObject,
    useUpInventoryStack, consumeInventoryItem, consumeObjectCharge, delobj, inventoryCommandLetter,
    inventoryItemDescription, chooseInventoryObject, getobj, addInventoryItem,
} from './invent.js';
import {
    doBlindingRay, getObjectLocation, releaseHold, zapHeroWithObject, beginImmediateZap, finishImmediateZap,
    hitFloorPileWithWand, hitMonsterWithWand, lightDamage, rayPositionIsOpen, flashBurn,
    objectResistsDestruction, zappable,
} from './zap.js';
import type { GameState, PlayingGameState } from './game_state.js';
import { prepareMapPositionHighlights, selectMapPosition, showGetposInstructions } from './getpos.js';
import { game, requireGameLevel, requireLiveGame, requirePlayingGame } from './gstate.js';
import { heroMayDisplaceMonster, nomul, shouldShowGetposTip, showGetposTip, loseHeroHp, checkHeroAttackOverexertion, heroIsOnStairs, isInvocationPosition, finishDestinationSpotEffects, roomsAt, exceedsActionCapacity, nearCapacity, distu } from './hack.js';
import { distmin, possessiveName } from './hacklib.js';
import { applyCaitiffPenalty, prepareAppliedWeaponAttack, do_attack } from './uhitm.js';
import {
    setHeroGrip, revealMonsterAppearance, wakeMonstersNearWithMessages, monsterInAir,
    moveMonsterNextToHero, monsterFliesOrFloats,
    finishHeroMonsterKill, finishHeroMonsterKillOutcome, finishHurtleMonsterDeath,
} from './mon.js';
import {
    makeDeaf, startHeroSickness, makeConfused, makeHallucinated, makeStunned, releaseDjinni, setSlipperyHands,
    makeBlinded, cureHeroSickness, heroIsVomiting, makeHeroVomiting, heroIsSick, heroIsSliming,
} from './potion.js';
import { hurtleHero, hurtleJumpTo, hitMonsterWithAppliedWeapon, walkPathCells } from './dothrow.js';
import { heroIsInvisible } from './hero_invisibility.js';
import { stumbleOntoMimic } from './uhitm.js';
import {
    heroIsUnaware, blindfolded, heroIsBlind, heroIsBlinded, heroIsDeaf, heroIsHallucinating,
    heroIsUnderwater, setHeroBlindnessTimeout,
} from './senses.js';
import { heroIsBreathless, heroPassesWalls, heroPolyGender, heroSpecies, heroHasNoHands, heroIsFlying, body_part, mbodypart } from './polyself.js';
import { heroStatusLine, monsterStatusLine } from './insight.js';
import {
    dotrap, fillPitWithBoulderAt, deleteTrap, feelTrap, trapName, mintrap, resolveImmediatePetrification,
    resetUtrap, maketrap, activateStatueTrapAt, fireDamageObject,
} from './trap.js';
import { requireInitializedHero } from './hero_types.js';
import { morehungry, vomit, set_tin_variety, use_tin_opener } from './eat.js';
import { stack_object } from './invent.js';
import type { InventoryClassification } from './invent.js';
import { CANDLE_TYPES, LIGHT_TYPES, TIMED_LIGHT_TYPES, transformMagicLampToOilLamp } from './light.js';
import { lightRoom } from './read.js';
import {
    finishTeleportArrival, askTeleportDestination, enexto, goodPosition, heroTeleportRestricted,
    monsterTeleportRestricted, teleds, randomMonsterRelocation, relocateMonsterTo, teleportHeroToRandomPet,
} from './teleport.js';
import { pickLock } from './lock.js';
import { makemonAt, mkclassAligned, useBagOfTricks } from './makemon.js';
import { MAP_SYMBOLS } from './map_symbols.js';
import type { MapLocation, Position } from './map_types.js';
import {

    billDummyObject,

    mksobj,

    objectQuantity,

    rejoinObjectStack,

    splitObjectStack,

    unblessObjectState,

    unlinkObject,

    objectWeight,

    isContainer,

    useHornOfPlenty,

    unlinkMonsterObject,

    placeObject,

    remove_object,

    chargeAlteredUnpaidObject,

} from './mkobj.js';
import {
    is_male, is_neuter, monsterIsClinger, monsterIsFemale, monsterIsSlithy, monsterPossessive,
    monsterSubjectPronoun, monsterHasHead, monsterHasNoLimbs, monsterIsUnsolid, strongmonst, monsterDigests,
    monsterHasEyes, monsterHasProperName, monsterIsBig, monsterIsBreathless, monsterIsDemon, monsterIsHumanoid,
    monsterIsRider, monsterIsUnicorn, monsterIsVampire, monsterIsVampireShifter, monsterIsWhirly, monsterPerceives,
    monsterThrowsRocks, formCanBecomeStoneGolem, heroResistsStoning, touchPetrifies, canBlnd, heroCanBlow,
    monsterHidesUnder, monsterIsAmorphous, monsterIsEel, monsterIsFlyer, monsterPassesWalls,
} from './mondata.js';
import { wakeAttackedMonster } from './mon.js';
import { makeMonsterFlee, isAccessibleAt } from './monmove.js';
import type { RandomBelow } from './monster_action_types.js';
import { AD_BLND, AT_ENGL, AT_WEAP } from './monster_attack_types.js';
import { MONSTER_ATTACKS, MONSTER_FLAGS1, MONSTER_FLAGS2, MONSTER_GENO, MONSTER_MOVE, MONSTER_NAME, MONSTER_NUTRITION, MONSTER_SIZE, MONSTER_SOUND, MONSTER_SYMBOL } from './monster_data.js';
import type { Monster } from './monster_types.js';
import { PLAYABLE_INSTRUMENTS, playInstrument } from './music.js';
import {
    isAxe, isFlimsyObject, isGrayStone, isPick, isPolearm, isWetTowel, isBimanualObject,
} from './object_properties.js';
import type { GameObject, ObjectWhere } from './object_types.js';
import {
    corpseName, definiteName, definiteObjectAction, makePlural, minimalObjectName, objectCombatName,
    objectDescription, objectName, objectNameIsPlural, observeObjectForNaming, ownedObjectName,
    simpleObjectTypeName, singularObjectName, withIndefiniteArticle,
} from './objnam.js';
import {

    formatFeltMessage,

    formatHeardMessage,

    formatSeenMessage,

    pline as syncPline,

    plineWithContinuation,

    plineWithContinuation as pline,

    publishHeardMessage,

    impossible,

} from './pline.js';
import type { MessagePublisher } from './pline.js';
import { propertyIsActive } from './properties.js';
import { unpunishHero } from './read.js';
import { promptChoice, promptYesNo } from './query.js';
import { mon_reflects } from './muse.js';
import { d, rn1, rn2, rnd, rnl } from './rng.js';
import { addShopDamage, carriedObjectOwner, chargeUnpaidUsage, costlySpot, deleteObject, dopay, findObjectOwner, objectOwnershipPrefix, payForShopDamage, shopkeeperIsMuted } from './shk.js';
import {
    ensureHeroSkills, uwepSkillType, dryTowel, heroStrengthDamageBonus, monsterWieldedWeapon,
    unwieldMonsterWeapon,
} from './weapon.js';
import { castSpell, knownSpell } from './spell.js';
import { addObjectToMonsterInventory } from './steal.js';
import { monsterAtPosition, stuckSteed, useSaddle, strikeSteed } from './steed.js';
import { heroIsPetrifying, petrifyFromCorpseContact } from './stoning.js';
import { ceilingName, surfaceName, canDigDown } from './dungeon.js';
import { isLavaAt, isPoolAt, isPoolOrLavaAt } from './dbridge.js';
import type { DirectionSelection } from './cmd.js';
import { summonUndead } from './undead_summoning.js';
import { summonVaultGuardSoon } from './vault.js';
import { cansee, couldsee, howMonsterSeen, vision_note_blocker_change, vision_recalc, vision_reset } from './vision.js';
import { wieldTool, doswapweapon } from './wield.js';
import type { WieldToolResult } from './wield.js';
import { setnotworn, adjustMonsterSpeed } from './worn.js';
import { showPagedPickOneMenu } from './windows.js';
import { snapshotMenuUnderlay } from './wintty.js';
import type { MenuUnderlay } from './wintty.js';
import { monsterCarriesAmulet } from './wizard.js';
import { useMagicMarker } from './write.js';

// C apply.c:use_camera()
export async function useCamera(
    object: GameObject,
    { state = game }: { state?: GameState } = {},
): Promise<{ spentTime: boolean; heroDied: boolean; object: GameObject }> {
    requireLiveGame(state);
    const result = { spentTime: false, heroDied: false, object };
    if (state.u.uinwater || state.underwater) {
        await pline('Using your camera underwater would void the warranty.');
        return result;
    }
    const direction = await promptDirection();
    // apply.c:use_camera() returns ECMD_CANCEL for a refused direction.
    if (!direction) { commandResultCancelled(state); return result; }
    result.spentTime = true;
    if (object.spe <= 0) {
        await pline('Nothing happens.');
        return result;
    }
    await chargeUnpaidUsage(object, { state });
    object.spe--;
    const selfFlash = object.cursed && !rn2(2);
    if (selfFlash || (!state.u.uswallow && !direction.dz && !direction.dx && !direction.dy)) {
        const damage = await lightDamage(object, true, 5, { state });
        if (!state.program_state.gameover) await flashBurn(damage + rnd(25), false, { state });
    } else if (state.u.uswallow) {
        const holder = state.u.ustuck;
        if (!holder) throw new Error('Swallowed camera use requires a holder');
        await pline(
            `You take a picture of ${possessiveName(monsterName(holder))} ${mbodypart(holder.mnum, STOMACH)}.`,
        );
    } else if (direction.dz) {
        await pline(
            `You take a picture of the ${
                direction.dz > 0
                    ? surfaceName(state.u.ux, state.u.uy, state)
                    : ceilingName(state.u.ux, state.u.uy, state)
            }.`,
        );
    } else {
        result.heroDied = await doBlindingRay(object, direction, { state });
    }
    result.heroDied ||= !!state.program_state.gameover;
    return result;
}

// C apply.c:use_towel()
export async function useTowel(object: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    const result = { spentTime: false, heroDied: false, object };
    const hands = makePlural(body_part(HAND, state));
    const eyewear = state.ublindf || state.u.ublindf;
    if (!heroHasFreeHand(state)) {
        await pline(`You have no free ${body_part(HAND, state)}!`);
        return result;
    }
    if (object === eyewear) {
        await pline("You cannot use it while you're wearing it!");
        return result;
    }
    if (object.cursed) {
        const mishap = rn2(3);
        if (mishap === 2) {
            const old = state.u.glibTurns || 0;
            setSlipperyHands(old + rn1(10, 3), state);
            await pline(`Your ${hands} ${old ? 'are filthier than ever' : 'get slimy'}!`);
        } else if (mishap === 1) {
            if (!eyewear) {
                const old = state.u.ucreamed || 0;
                state.u.ucreamed = old + rn1(10, 3);
                await pline(`Yecch!  Your ${body_part(FACE, state)} ${old ? 'has more' : 'now has'} gunk on it!`);
                await makeBlinded((state.u.blindTurns || 0) + state.u.ucreamed - old, { state });
            } else {
                const name = eyewear.otyp === LENSES ? 'lenses'
                    : eyewear.otyp === object.otyp ? 'other towel' : 'blindfold';
                if (eyewear.cursed) await pline(`You push your ${name} ${rn2(2) ? 'cock-eyed' : 'crooked'}.`);
                else {
                    await pline(`You push your ${name} off.`);
                    await removeEyewear(null, { state });
                    if (!state.program_state.gameover) await dropInventoryObjectAtHero(eyewear, { state });
                }
            }
        }
        if (mishap) {
            result.spentTime = true;
            if (!state.program_state.gameover && isWetTowel(object))
                await dryTowel(object, -1, { state, verbose: object === state.uwep });
            result.heroDied = !!state.program_state.gameover;
            return result;
        }
    }
    if ((state.u.glibTurns ?? 0) > 0 || state.u.glib) {
        setSlipperyHands(0, state);
        await pline(`You wipe off your ${state.uarmg ? armorSimpleName(state.uarmg, state) : hands}.`);
    } else if (state.u.ucreamed) {
        setHeroBlindnessTimeout((state.u.blindTurns || 0) - state.u.ucreamed, state);
        state.u.ucreamed = 0;
        if (!heroIsBlinded(state)) {
            await pline("You've got the glop off.");
            const gulp = await gulp_blnd_check({ state });
            if (!gulp.triggered && !gulp.died) {
                setHeroBlindnessTimeout(1, state);
                await makeBlinded(0, { state });
            }
        } else await pline(`Your ${body_part(FACE, state)} feels clean now.`);
    } else {
        await pline(`Your ${body_part(FACE, state)} and ${hands} are already clean.`);
        return result;
    }
    result.spentTime = true;
    result.heroDied = !!state.program_state.gameover;
    if (!result.heroDied && isWetTowel(object))
        await dryTowel(object, -1, { state, verbose: object === state.uwep });
    return result;
}

// C apply.c:use_stethoscope()
export async function useStethoscope(object: GameObject): Promise<boolean> {
    requirePlayingGame(game);
    const hero = game.u;
    const holder = hero.ustuck;
    const interference = !!(hero.uswallow && holder && monsterIsWhirly(holder)
        && !rn2(game.urole.key === 'healer' ? 10 : 3));
    if (heroHasNoHands(game)) {
        await pline('You have no hands!');
        return false;
    }
    if (heroIsDeaf(game)) {
        await pline("You can't hear anything!");
        return false;
    }
    if (!heroHasFreeHand(game)) {
        await pline(`You have no free ${body_part(HAND, game)}.`);
        return false;
    }
    const direction = await promptDirection();
    // apply.c:use_stethoscope() returns ECMD_CANCEL for a refused direction.
    if (!direction) { commandResultCancelled(); return false; }
    const sequence = game._heroActionSeq ?? 0;
    let spentTime = sequence === game._stethoscopeSeq;
    game._stethoscopeSeq = sequence;
    game.bhitpos = { x: hero.ux, y: hero.uy };
    game.notonhead = !!hero.uswallow;
    if (hero.usteed && direction.dz > 0) {
        if (interference && holder) {
            await pline(`${monsterName(holder, { capitalized: true })} interferes.`);
            await pline(await monsterStatusLine(holder));
        } else await pline(await monsterStatusLine(hero.usteed));
        return spentTime;
    }
    if (hero.uswallow && holder && (direction.dx || direction.dy || direction.dz || interference)) {
        if (!direction.dx && !direction.dy && !direction.dz)
            await pline(`${monsterName(holder, { capitalized: true })} interferes.`);
        await pline(await monsterStatusLine(holder));
        return spentTime;
    }
    if (direction.dz) {
        if (hero.uinwater || game.underwater) await publishHeardMessage('faint splashing.', pline);
        else if (direction.dz < 0 || !heroCanReachFloor(game, { checkPit: true })) {
            const destination = direction.dz < 0 ? ceilingName(hero.ux, hero.uy)
                : heroCanReachFloor(game) ? 'bottom of the pit' : surfaceName(hero.ux, hero.uy);
            await pline(`You can't reach the ${destination}.`);
        } else {
            const corpse = await diagnoseFloorObjects(hero.ux, hero.uy);
            if (corpse.found) spentTime ||= corpse.spentTime;
            else if (Is_stronghold(hero.uz)) await publishHeardMessage('the crackling of hellfire.', pline);
            else await pline(`The ${surfaceName(hero.ux, hero.uy)} seems healthy enough.`);
        }
        return spentTime;
    }
    if (object.cursed && !rn2(2)) {
        await publishHeardMessage('your heart beat.', pline);
        return spentTime;
    }
    // Native does a second confdir() after its cursed-heartbeat branch.
    confusePromptDirection(hero);
    if (!hero.dx && !hero.dy) {
        await pline(heroStatusLine(game));
        return spentTime;
    }
    const x = hero.ux + (hero.dx ?? 0), y = hero.uy + (hero.dy ?? 0);
    if (!isok(x, y)) {
        await publishHeardMessage('a faint typing noise.', pline);
        return false;
    }
    const monster = monsterAtPosition(game.level, x, y);
    if (monster) {
        game.bhitpos = { x, y };
        game.notonhead = monster.mx !== x || monster.my !== y;
        await diagnoseMonster(monster, x, y);
        return spentTime;
    }
    if (await unmap_invisible(x, y)) await pline('The invisible monster must have moved.');
    const location = game.level.requireAt(x, y);
    if (location.typ === SDOOR || location.typ === SCORR) {
        const door = location.typ === SDOOR;
        await publishHeardMessage(`a hollow sound.  This must be a secret ${door ? 'door' : 'passage'}!`, pline);
        if (door) convertSecretDoor(location);
        else { location.typ = CORR; location.flags = 0; location.doormask = 0; }
        vision_note_blocker_change(x, y);
        await feel_newsym(x, y);
        return spentTime;
    }
    const floor = await diagnoseFloorObjects(x, y);
    if (!floor.found) await pline('You hear nothing special.');
    return spentTime || floor.spentTime;
}


// Part of C apply.c:use_stethoscope(): the monster-revelation and status-report branch.
// Also C mkobj.c:init_dummyobj(): inlined here (the name-formatting dummy
// object literal with the slime-mold fruit id).
async function diagnoseMonster(monster: Monster, x: number, y: number) {
    // C formats this even when only the later status line is printed.
    // During hallucination each formatting selects a new perceived identity.
    const name = monsterName(monster, {
        article: 'a', suppressIt: true, suppressInvisible: true, suppressSaddle: false,
    });
    if (monster.mundetected) {
        if (!canSpotMonster(monster)) await pline(`There is ${name} hidden there.`);
        monster.mundetected = 0;
        await newsym(monster.mx, monster.my);
    } else if (monster.mappearance) {
        const type = M_AP_TYPE(monster), appearance = monster.mappearance;
        let what = 'thing', plural = false;
        if (type === M_AP_OBJECT) {
            const fruit = monster.mcorpsenm ?? monster.mextra?.mcorpsenm;
            what = appearance === SLIME_MOLD && fruit !== undefined
                ? minimalObjectName({ otyp: appearance, oclass: FOOD_CLASS, dknown: true, spe: fruit }, game)
                : simpleObjectTypeName(appearance, game);
            const slot = armorSlotFor(appearance);
            plural = slot === 'uarmf' || slot === 'uarmg' || appearance === LENSES;
        } else if (type === M_AP_MONSTER) what = monsterTypeName(appearance, monster.female);
        else if (type === M_AP_FURNITURE) what = MAP_SYMBOLS[appearance]?.name ?? 'thing';
        await revealMonsterAppearance(monster);
        await pline(`${plural ? 'Those' : 'That'} ${what} ${plural ? 'are' : 'is'} really ${name}.`);
    } else if (game.flags.verbose && !canSpotMonster(monster)) await pline(`There is ${name} there.`);
    await pline(await monsterStatusLine(monster, { x, y }));
    if (!canSpotMonster(monster)) await map_invisible(x, y);
}

// C apply.c:its_dead()
// The stethoscope's corpse and statue diagnosis.
async function diagnoseFloorObjects(x: number, y: number): Promise<{ found: boolean; spentTime: boolean }> {
    requirePlayingGame(game);
    const pile = game.level.objects[x]?.[y] ?? [];
    const reachable = heroCanReachFloor(game, { checkPit: true });
    const object = pile.find(item => item.otyp === CORPSE && reachable
        || item.otyp === STATUE && (reachable || (MONSTER_SIZE[item.corpsenm ?? -1] ?? 0) !== 0));
    if (!object) return { found: false, spentTime: false };
    if (object.corpsenm === undefined) throw new Error('Stethoscope floor diagnosis needs a monster species.');
    const species = object.corpsenm;
    const one = object.quan === 1 && pile.filter(item => item.otyp === CORPSE).length === 1;
    if (heroIsHallucinating(game)) {
        let diagnosis = object.otyp === STATUE ? "You're both stoned" : "They're dead";
        if (object.otyp === CORPSE && one) {
            diagnosis = `${corpsePronoun(object, species)}'s dead`;
        }
    await publishHeardMessage(`a voice say, "${diagnosis}, Jim."`, pline);
        return { found: true, spentTime: true };
    }
    if (object.otyp === CORPSE) {
        if (heroIsBlind(game)) await map_object(object);
        const reviver = game.urole.key === 'healer' && pile.some(item => item.otyp === CORPSE
            && objectTimers(item).some(timer => timer.kind === OBJECT_TIMER_KIND.REVIVE_MON));
        const here = x === game.u.ux && y === game.u.uy;
        await pline(`You determine that ${one ? here ? 'this' : 'that' : here ? 'these' : 'those'} unfortunate being${one ? '' : 's'} ${one ? 'is' : 'are'}${reviver ? ' mostly' : ''} dead.`);
    } else {
        const name = heroIsBlind(game) ? `${x === game.u.ux && y === game.u.uy ? 'This' : 'That'} ${monsterIsHumanoid(species) ? 'person' : 'creature'}`
            : `${monsterHasProperName(species) ? '' : 'The '}${objectMonsterName(object)}`;
        const health = game.urole.key === 'healer'
            ? game.level.traps.some(trap => trap.tx === x && trap.ty === y && trap.ttyp === STATUE_TRAP) ? 'extraordinary'
                : object.contents?.length ? 'remarkable' : 'fine' : 'fine';
        await pline(`${name} is in ${health} health for a statue.`);
    }
    return { found: true, spentTime: false };
}

// Part of C apply.c:its_dead(): the "He's/She's/It's dead" pronoun of
// the hallucination branch.
function corpsePronoun(corpse: GameObject, species: number): string {
    const saved = corpse.oextra?.omonst;
    if (saved) {
        if (is_neuter(species)) return 'It';
        const personal = monsterIsHumanoid(species)
            || !!((MONSTER_GENO[species] ?? 0) & 0x1000) || monsterHasProperName(species);
        if (!personal) return 'It';
        return saved.female ? 'She' : 'He';
    }
    if (monsterIsFemale(species)) return 'She';
    return is_male(species) ? 'He' : 'It';
}

interface PetSummoningNotice {
    shift: string[];
    appear: string[];
    disappear: string[];
    trapped: number;
}

// Part of C apply.c:doapply(): the whistle dispatch, including the
// blessed eucalyptus leaf case.
export async function useWhistle(object: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    const magic = object.otyp === MAGIC_WHISTLE
        || object.otyp === EUCALYPTUS_LEAF && object.blessed;
    if (!heroCanBlow(state)) {
        await plineWithContinuation('You are incapable of using the whistle.');
    } else if (magic) {
        await blowMagicWhistle(object, state);
    } else {
        await blowOrdinaryWhistle(object, state);
    }
    if (state.program_state.gameover) return { spentTime: true, heroDied: true };
    if (object.otyp === EUCALYPTUS_LEAF && object.blessed && rn2(49) === 0) {
        if (!heroIsBlind(state)) {
            const verb = objectQuantity(object) > 1 ? 'glow' : 'glows';
            await plineWithContinuation(`${ownedObjectName(object, state)} ${verb} ${displayColorName('brown', state)}.`);
            object.bknown = true;
        }
        unblessObjectState(object);
    }
    return { spentTime: true, heroDied: false };
}

// C apply.c:use_whistle()
async function blowOrdinaryWhistle(object: GameObject, state: GameState) {
    if (state.u.uinwater) {
        await plineWithContinuation(`You blow bubbles through ${ownedObjectName(object, state, { capitalized: false })}.`);
        return;
    }
    await plineWithContinuation(heroIsDeaf(state)
        ? formatFeltMessage(`rushing air tickle your ${body_part(NOSE, state)}.`, state)
        : `You produce a ${object.cursed ? 'shrill' : 'high'} whistling sound.`);
    await callNearbyPets(state);
    if (object.cursed) await summonVaultGuardSoon(state);
}

// Part of C apply.c:use_whistle(), apply.c:use_magic_whistle(): the
// wake_nearby() call both share.
async function callNearbyPets(state: GameState) {
    requireInitializedHero(state.u);
    await wakeMonstersNearWithMessages(state.u.ux, state.u.uy,
        state.u.ulevel * 20, state, plineWithContinuation, { petCall: true });
}

// C apply.c:use_magic_whistle()
async function blowMagicWhistle(object: GameObject, state: GameState) {
    if (object.cursed && rn2(2) === 0) {
        const pitch = state.u.uinwater ? 'very high' : 'high';
        const sound = heroIsDeaf(state) ? 'frequency vibration' : 'pitched humming noise';
        await plineWithContinuation(`You produce a ${pitch}-${sound}.`);
        await callNearbyPets(state);
        if (rn2(2) === 0 && !heroTeleportRestricted(state))
            await teleportHeroToRandomPet(state);
        return;
    }
    const quality = heroIsHallucinating(state) ? 'normal'
        : state.u.uinwater && !heroIsDeaf(state) ? 'strange, high-pitched' : 'strange';
    await plineWithContinuation(heroIsDeaf(state)
        ? `You produce a ${quality}, sharp vibration.`
        : `You produce a ${quality} whistling sound.`);
    await summonPets(object, state);
}

// C apply.c:magic_whistled(): relocate every pet next to the hero, free
// trapped ones from filled pits, and summarize the shifts, appearances,
// disappearances, and trapped outcomes; stasis suppresses it.
async function summonPets(object: GameObject, state: GameState) {
    requirePlayingGame(state);
    const level = state.level;
    const stasisUntil = level.flags.stasis_until;
    if (stasisUntil !== undefined && stasisUntil >= state.moves) return;
    const known = objectTypeKnown(object, state);
    const noticed: PetSummoningNotice = { shift: [], appear: [], disappear: [], trapped: 0 };
    for (const pet of [...level.monsters].reverse()) {
        if (pet.mhp <= 0 || !pet.mtame || pet === state.u.usteed) continue;
        if (pet.mtrapped) {
            pet.mtrapped = 0;
            await fillPitWithBoulderAt(pet.mx, pet.my, state);
            if (state.program_state.gameover) return;
        }
        const wasSeen = canSpotMonster(pet);
        const oldName = wasSeen ? petName(pet, state) : null;
        if (M_AP_TYPE(pet)) await revealMonsterAppearance(pet);
        const oldx = pet.mx, oldy = pet.my;
        await moveMonsterNextToHero(pet, state, { flags: known ? RLOC_NONE : RLOC_MSG });
        if (state.program_state.gameover) return;
        if (pet.mx === oldx && pet.my === oldy) continue;
        if (pet.mundetected) {
            pet.mundetected = 0;
            await newsym(pet.mx, pet.my);
        }
        state._lastPlineKind = PLNMSG_enum;
        await mintrap(pet, state, {
            inAir: monsterInAir(pet, state),
        });
        if (state.program_state.gameover) return;
        if (pet.mhp <= 0)
            state.u.uluck = Math.max(LUCKMIN, (state.u.uluck || 0) - 1);
            // C attrib.c:change_luck(-1): a summoned pet dying in a trap.
        if (state._lastPlineKind !== PLNMSG_enum) {
            noticed.trapped++;
            continue;
        }
        const isSeen = pet.mhp > 0 && canSpotMonster(pet);
        if (isSeen) {
            noticed[wasSeen ? 'shift' : 'appear'].push(petName(pet, state));
        } else if (oldName !== null) {
            noticed.disappear.push(oldName);
        }
    }
    if (!known) {
        if (noticed.shift.length + noticed.appear.length + noticed.trapped > 0)
            learnObjectType(object.otyp, state);
        return;
    }
    const message = summonMessage(noticed);
    if (message) await plineWithContinuation(`${message}.`);
}

// Part of C apply.c:magic_whistled(): the y_monnam() name captured for
// the summary message.
function petName(pet: Monster, state: GameState) {
    return monsterName(pet, { state, article: 'your', suppressIt: true });
}

// C apply.c:HowMany()
function creatureCount(count: number) {
    if (count > 4) return count <= 7 ? 'several' : 'many';
    const name = ['zero', 'one', 'two', 'three', 'four'][count];
    if (!name) throw new RangeError(`Invalid creature count: ${count}`);
    return name;
}

// Part of C apply.c:magic_whistled(): the cumulative
// shift/appear/disappear summary message.
function summonMessage({ shift, appear, disappear }: PetSummoningNotice) {
    const groups = [];
    if (shift.length) groups.push(shift.length === 1
        ? `${shift[0]} shifts location` : `${creatureCount(shift.length)} creatures shift locations`);
    if (appear.length) {
        const noun = !shift.length ? 'creatures' : shift.length === 1 ? 'other creatures' : 'others';
        groups.push(appear.length === 1 ? `${appear[0]} appears` : `${creatureCount(appear.length)} ${noun} appear`);
    }
    if (disappear.length) {
        const noun = !shift.length && !appear.length ? 'creatures'
            : shift.length < 2 && appear.length < 2 ? 'other creatures' : 'others';
        groups.push(disappear.length === 1 ? `${disappear[0]} disappears`
            : `${creatureCount(disappear.length)} ${noun} disappear`);
    }
    const message = groups.length < 3 ? groups.join(' and ')
        : `${groups[0]}, ${groups[1]}, and ${groups[2]}`;
    return message ? message.charAt(0).toUpperCase() + message.slice(1) : '';
}

// C apply.c:um_dist().
export function umDist(state: GameState, x: number, y: number, n: number): boolean {
    return Math.abs(state.u.ux - x) > n || Math.abs(state.u.uy - y) > n;
}

const LEASH_PM_LONG_WORM = MONSTER_NAME.indexOf('long worm');

// C apply.c:leashable().  A head is enough to leash a limbless monster.
export function monsterCanBeLeashed(monster: Monster): boolean {
    const hasNoLimbs = monsterHasNoLimbs(monster?.mnum);
    return monster?.mnum !== LEASH_PM_LONG_WORM
        && !monsterIsUnsolid({ mnum: monster?.mnum })
        && (!hasNoLimbs || monsterHasHead({ mnum: monster?.mnum }));
}

// C apply.c:get_mleash().
export function leashAttachedToMonster(monster: Monster | null | undefined, state: GameState = game): GameObject | null {
    return (state.inventory || []).find(object =>
        object.otyp === LEASH && object.leashmon === monster?.m_id) || null;
}

// C apply.c:o_unleash(). The leash need not be in inventory.
// Also C light.c:find_mid(): inlined here for a leashed monster in the
// current level, found by m_id.
export function releaseObjectLeash(leash: GameObject, state: GameState = game): void {
    const monster = requireGameLevel(state).monsters.find(candidate => candidate.m_id === leash.leashmon);
    if (monster) monster.mleashed = 0;
    leash.leashmon = 0;
}

// C apply.c:m_unleash().
export async function releaseMonsterLeash(monster: Monster, feedback: boolean, {
    state = game, publish = plineWithContinuation,
}: { state?: GameState; publish?: MessagePublisher } = {}): Promise<GameObject | null> {
    if (feedback) {
        requireLiveGame(state);
        if (canSeeMonster(monster)) {
            const name = monsterName(monster, { capitalized: true, state });
            const possessive = monsterPossessive(monster, { state });
            await publish(`${name} pulls free of ${possessive} leash!`);
        } else {
            await publish('Your leash falls slack.');
        }
    }
    const leash = leashAttachedToMonster(monster, state);
    if (leash) leash.leashmon = 0;
    monster.mleashed = 0;
    return leash;
}

// C apply.c:unleash_all().
export function releaseAllMonsterLeashes(state: GameState = game): number {
    const attachedLeashes = (state.inventory || []).filter(object =>
        object.otyp === LEASH && object.leashmon);
    for (const monster of state.level?.monsters || [])
        monster.mleashed = 0;
    for (const leash of attachedLeashes) leash.leashmon = 0;
    return attachedLeashes.length;
}

// C apply.c:use_leash(): prompt for the adjacent creature; the two-pet
// cap counts C apply.c:number_leashed()'s attached leashes inline.
export async function useLeash(leash: GameObject): Promise<boolean> {
    const hero = game.u;
    if (hero.uswallow) {
        if (!hero.ustuck) throw new Error('A swallowed hero needs an engulfer.');
        const name = monsterName(hero.ustuck, { suppressIt: true });
        const action = !leash.leashmon ? `leash ${name} from inside`
            : leash.leashmon === hero.ustuck.m_id ? `unleash ${name} from inside`
                : `unleash anything from inside ${name}`;
        await pline(`You can't ${action}.`);
        return false;
    }
    if (!leash.leashmon && game.inventory.filter(object => object.otyp === LEASH && object.leashmon).length >= 2) {
        await pline('You cannot leash any more pets.');
        return false;
    }
    const direction = await promptDirection();
    if (!direction) {
        await pline('Never mind.');
        return false;
    }
    const x = hero.ux + direction.dx, y = hero.uy + direction.dy;
    if (!isok(x, y)) return false;
    if (x === hero.ux && y === hero.uy) {
        if (hero.usteed && direction.dz > 0) {
            await useLeashOnMonster(leash, hero.usteed, x, y, true);
            return true;
        }
        await pline('Leash yourself?  Very funny...');
        return false;
    }
    const monster = monsterAtPosition(requireGameLevel(), x, y);
    if (!monster) {
        await pline('There is no creature there.');
        await unmap_invisible(x, y);
    } else await useLeashOnMonster(leash, monster, x, y, canSpotMonster(monster));
    return true;
}

// C apply.c:use_leash_core(): the attach/remove switch for one creature —
// unseen targets, non-pets, unfit bodies, cursed refusals.
async function useLeashOnMonster(leash: GameObject, monster: Monster, x: number, y: number, spotted: boolean) {
    const level = requireGameLevel();
    const name = () => monsterName(monster, { capitalized: true });
    const petName = () => monsterLeashName(monster);
    if (!spotted && level.requireAt(x, y).remembered_glyph?.kind !== 'invisible') {
        await pline(`You fail to ${leash.leashmon ? 'un' : ''}leash something.`);
        await map_invisible(x, y);
    } else if (!monster.mtame) {
        await pline(`${name()} ${leash.leashmon ? 'is not' : 'cannot be'} leashed!`);
    } else if (!leash.leashmon) {
        if (monster.mleashed) await pline(`This ${spotted ? petName() : 'creature'} is already leashed.`);
        else if (monsterIsUnsolid({ mnum: monster.mnum })) await pline('The leash would just fall off.');
        else if (monsterHasNoLimbs(monster.mnum) && !monsterHasHead({ mnum: monster.mnum }))
            await pline(`${name()} has no extremities the leash would fit.`);
        else if (!monsterCanBeLeashed(monster)) {
            const target = x !== monster.mx || y !== monster.my ? `${possessiveName(petName())} tail` : petName();
            await pline(`The leash won't fit onto ${spotted ? 'your ' : ''}${target}.`);
        } else {
            await pline(`You slip the leash around ${spotted ? 'your ' : ''}${petName()}.`);
            monster.mleashed = 1;
            leash.leashmon = monster.m_id;
            monster.msleeping = 0;
        }
    } else if (leash.leashmon !== monster.m_id) {
        await pline('This leash is not attached to that creature.');
    } else if (leash.cursed) {
        await pline('The leash would not come off!');
        leash.bknown = true;
    } else {
        monster.mleashed = 0;
        leash.leashmon = 0;
        await pline(`You remove the leash from ${spotted ? 'your ' : ''}${petName()}.`);
    }
}

// C apply.c:check_leash()
// Only movement farther from a pet tightens its leash.
export async function checkHeroLeashes(oldX: number, oldY: number) {
    requirePlayingGame(game);
    const distance = (x: number, y: number, monster: Monster) =>
        (x - monster.mx) ** 2 + (y - monster.my) ** 2;
    for (const leash of game.inventory.filter(object => object.otyp === LEASH && object.leashmon)) {
        const monster = game.level.monsters.find(candidate => candidate.m_id === leash.leashmon);
        if (!monster) {
            await impossible("leash in use isn't attached to anything?");
            leash.leashmon = 0;
            continue;
        }
        if (distance(game.u.ux, game.u.uy, monster) <= distance(oldX, oldY, monster)) continue;
        const separation = Math.max(Math.abs(game.u.ux - monster.mx), Math.abs(game.u.uy - monster.my));
        if (separation <= 3) continue;
        if (leash.cursed && !(monsterIsBreathless(monster.mnum))) {
            if (separation > 5 || (monster.mhp -= rnd(2)) <= 0) {
                const pacifism = game.u.uconduct.killer ?? 0;
                await pline(`Your leash chokes ${monsterName(monster)} to death!`);
                await finishHeroMonsterKill(monster, monster.mx, monster.my, { showKillMessage: false });
                if (monster.mhp > 0) game.u.uconduct.killer = pacifism;
            } else {
                await pline(`${monsterName(monster, { capitalized: true })} is choked by the leash!`);
                if (monster.mtame && rn2(monster.mtame)) monster.mtame--;
            }
        } else if (separation > 5) {
            await pline(`${possessiveName(monsterName(monster, { capitalized: true }))} leash snaps loose!`);
            await releaseMonsterLeash(monster, false);
        } else {
            await pline('You pull on the leash.');
            if (MONSTER_SOUND[monster.mnum]) {
                const sound = rn2(3);
                if (sound === 0) await publishMonsterGrowl(monster);
                else if (sound === 1) await publishMonsterYelp(monster);
                else await publishMonsterWhimper(monster);
            }
        }
        if (game.program_state.gameover) return;
    }
}

// Part of C apply.c:next_to_u(): the distance-only half allmain.c:313 uses
// after involuntary teleportation, where the ported moveloop does not run the
// mleashed_next2u relocation (bringLeashedFollowers below owns that half).
export function heroNextToLeashedFollowers(): boolean {
    const level = game.level;
    if (level?.monsters.some(monster => monster.mleashed
        && (monster.mx - game.u.ux) ** 2 + (monster.my - game.u.uy) ** 2 > 2)) return false;
    const steed = game.u.usteed;
    return !(steed && monsterCarriesAmulet(steed));
}

// Part of C apply.c:mleashed_next2u(): the enexto() relocation of one
// leashed follower.
async function moveLeashedMonsterNextToHero(monster: Monster, state: GameState, random: RandomBelow) {
    // C distmin(mtmp->mx, mtmp->my, u.ux, u.uy) > 1.
    if (distmin(monster.mx, monster.my, state.u.ux, state.u.uy) <= 1) return;
    const oldx = monster.mx;
    const oldy = monster.my;
    const destination = enexto(
        monster.mnum, state.u.ux, state.u.uy, { state, random },
    );
    if (!destination) return;
    await relocateMonsterTo(monster, destination.x, destination.y, { state, random });
    if (state === game) {
        await newsym(oldx, oldy);
        await newsym(monster.mx, monster.my);
    }
}

// C apply.c:next_to_u(), used before stairs, falls, and teleportation.
// C apply.c:mleashed_next2u(): each leashed pet relocates beside the hero
// or its leash goes slack; a cursed leash still blocks the follower.
export async function bringLeashedFollowers(state = game, random = rn2) {
    for (const monster of [...(state.level?.monsters || [])].reverse()) {
        if (!monster?.mleashed || (monster.mhp ?? 1) <= 0) continue;
        await moveLeashedMonsterNextToHero(monster, state, random);
        // C apply.c:next_to_u(): distmin(mtmp, you) <= 1.
        if (distmin(monster.mx, monster.my, state.u.ux, state.u.uy) <= 1) continue;

        const leash = leashAttachedToMonster(monster, state);
        if (!leash || leash.cursed) return false;
        await releaseMonsterLeash(monster, false, { state });
        // C apply.c:number_leashed(): a/the from the remaining leash count.
        const leashedCount = requireGameLevel(state).monsters.filter(candidate =>
            candidate.mleashed).length;
        await plineWithContinuation(formatFeltMessage(`${leashedCount > 1 ? 'a' : 'the'} leash go slack.`, state));
    }

    const steed = state.u?.usteed;
    const steedInventory = steed?.minvent || steed?.inventory || [];
    if (steedInventory.some(object => object.otyp === AMULET_OF_YENDOR))
        return false;
    return true;
}

const FLOATING_EYE = MONSTER_NAME.indexOf('floating eye');

const UMBER_HULK = MONSTER_NAME.indexOf('umber hulk');

const MEDUSA = MONSTER_NAME.indexOf('Medusa');

const AMOROUS_DEMON = MONSTER_NAME.indexOf('amorous demon');

const S_NYMPH = 14;

const S_GHOST = 54;

const DIRECT_SIGHT = MONSEEN_NORMAL | MONSEEN_SEEINVIS | MONSEEN_INFRAVIS;

// C apply.c:use_mirror()
export async function useMirror(object: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    const direction = await promptDirection();
    // apply.c:use_mirror() returns ECMD_CANCEL for a refused direction.
    if (!direction) {
        commandResultCancelled(state);
        return { spentTime: false, heroDied: false, object };
    }
    const result = { spentTime: true, heroDied: false, object };
    const hero = state.u;
    const invisible = heroIsInvisible(state);
    const canSeeMirror = !heroIsBlind(state) && (!invisible || seesInvisible(state));
    const simpleName = minimalObjectName(object, state);
    const mirror = object.quan === 1 ? simpleName : makePlural(simpleName);
    if (object.cursed && !rn2(2)) {
        await pline(heroIsBlind(state) ? 'Nothing seems to happen.'
            : `The ${mirror} fogs up and doesn't reflect!`);
        return result;
    }
    if (!direction.dx && !direction.dy && !direction.dz) {
        await seeOwnReflection(mirror, canSeeMirror, state);
        return result;
    }
    if (hero.uswallow) {
        if (canSeeMirror) {
            if (!hero.ustuck) throw new Error('A swallowed hero has no engulfer.');
            await pline(`You reflect ${possessiveName(monsterName(hero.ustuck))} ${mbodypart(hero.ustuck.mnum, STOMACH)}.`);
        }
        return result;
    }
    if (hero.uinwater || state.underwater) {
        if (canSeeMirror) await pline(heroIsHallucinating(state)
            ? 'You give the fish a chance to fix their makeup.'
            : 'You reflect the murky water.');
        return result;
    }
    if (direction.dz) {
        if (canSeeMirror) await pline(`You reflect the ${direction.dz > 0
            ? surfaceName(hero.ux, hero.uy, state) : ceilingName(hero.ux, hero.uy, state)}.`);
        return result;
    }
    const target = mirrorTarget(direction, state);
    if (!target || !target.onHead || (!monsterHasEyes(target.monster.mnum)))
        return result;
    result.heroDied = await showMonsterReflection(target.monster, object, mirror, invisible, state);
    return result;
}

// Part of C apply.c:use_mirror(): the See_invisible test that decides
// whether an invisible hero can see the reflection.
function seesInvisible(state: GameState) {
    return !!state.u.seeInvisible || (state.u.seeInvisibleTurns ?? 0) > 0;
}

// C apply.c:beautiful().
export function heroBeautyDescription(state: GameState = game) {
    const charisma = currentAttribute(A_CHA, state);
    if (charisma >= 25) return 'sublime';
    if (charisma >= 19) return 'splendorous';
    if (charisma >= 16) return heroPolyGender(state) === 1 ? 'beautiful' : 'handsome';
    if (charisma >= 14) return heroPolyGender(state) === 1 ? 'winsome' : 'amiable';
    if (charisma >= 11) return 'cute';
    if (charisma >= 9) return 'plain';
    if (charisma >= 6) return 'homely';
    return charisma >= 4 ? 'ugly' : 'hideous';
}

// Part of C apply.c:use_mirror(): the self-gaze branch (floating-eye
// freeze, vampire, umber hulk, appearance).
async function seeOwnReflection(mirror: string, visible: boolean, state: GameState) {
    const hero = state.u;
    requireInitializedHero(hero);
    const species = heroSpecies(state);
    const hallucinating = heroIsHallucinating(state);
    if (!visible) {
        await pline(`You can't see your ${heroBeautyDescription(state)} ${body_part(FACE, state)}.`);
    } else if (species === FLOATING_EYE) {
        if (heroHasFreeAction(state)) {
            await pline('You stiffen momentarily under your gaze.');
            return;
        }
        await pline(hallucinating ? `Yow!  The ${mirror} stares back!`
            : "Yikes!  You've frozen yourself!");
        if (!hallucinating || !rn2(4)) {
            state._occupation = null;
            nomul(-rnd(MAXULEV + 6 - hero.ulevel), state);
            state._helplessReason = 'gazing into a mirror';
        }
        state._helplessDoneMessage = null;
    } else if (monsterIsVampire(species)
        || (hero.mcham !== undefined && monsterIsVampire(hero.mcham))) {
        await pline("You don't have a reflection.");
    } else if (species === UMBER_HULK) {
        await pline("Huh?  That doesn't look like you!");
        await makeConfused((hero.confusionTurns || 0) + d(3, 4), { state, talk: false });
    } else if (hallucinating) {
        await pline(`You look ${displayColorName(null, state)}.`);
    } else if (hero.sick || (hero.sickTurns ?? 0) > 0) {
        await pline('You look peaked.');
    } else if (hero.uhs >= WEAK) {
        await pline('You look undernourished.');
    } else if (Upolyd(hero)) {
        await pline(`You look like ${withIndefiniteArticle(monsterTypeName(species, state.flags.female))}.`);
    } else {
        await pline(`You look as ${heroBeautyDescription(state)} as ever.`);
    }
}

// Part of C apply.c:use_mirror(): the bhit() beam walk that finds the
// reflection target.
// The invisible beam checks an occupant before its terrain and can pass an
// invisible creature which cannot see itself. It never animates or lights tiles.
function mirrorTarget({ dx, dy }: Pick<DirectionSelection, 'dx' | 'dy'>, state: GameState) {
    const level = requireGameLevel(state);
    let x = state.u.ux, y = state.u.uy;
    for (let distance = 0; distance < COLNO; distance++) {
        x += dx;
        y += dy;
        if (!isok(x, y)) return null;
        const monster = monsterAtPosition(level, x, y);
        if (monster && (!monster.minvis || (monsterPerceives(monster.mnum))))
            return { monster, onHead: monster.mx === x && monster.my === y };
        if (!rayPositionIsOpen(x, y, state)) return null;
    }
    return null;
}

// Part of C apply.c:use_mirror(): the monster-facing branch (Medusa,
// floating eye, nymph fright, unicorn indifference).
async function showMonsterReflection(
    monster: Monster, object: GameObject, mirror: string, invisible: boolean, state: GameState,
): Promise<boolean> {
    const visible = canSeeMonster(monster);
    const ways = visible ? howMonsterSeen(monster) : 0;
    const perceives = monsterPerceives(monster.mnum);
    const able = !monster.mcan && (!monster.minvis || perceives);
    const name = () => monsterName(monster, { capitalized: true, state });
    if (monster.msleeping) {
        if (visible) await pline(`${name()} is too tired to look at your ${mirror}.`);
    } else if (!monster.mcansee) {
        if (visible) await pline(`${name()} can't see anything right now.`);
    } else if (invisible && !perceives) {
        if (visible) await pline(`${name()} fails to notice your ${mirror}.`);
    } else if ((ways & DIRECT_SIGHT) === MONSEEN_INFRAVIS) {
        await pline(`${monsterReflexiveAction(monster, name(), 'are', 'too far away to see', { state })} in the dark.`);
    } else if (monsterIsVampire(monster.mnum) || MONSTER_SYMBOL[monster.mnum] === S_GHOST
        || monsterIsVampireShifter(monster)) {
        if (visible) await pline(`${name()} doesn't have a reflection.`);
    } else if (able && monster.mnum === MEDUSA) {
        const reflection = mon_reflects(monster, state);
        if (reflection) {
            await pline(`The gaze is reflected away by ${possessiveName(monsterName(monster))} ${reflection.noun}!`);
            if (['shield', 'amulet'].includes(reflection.noun)) {
                if (!reflection.object) throw new Error('Reflecting jewelry or armor requires an object.');
                learnObjectType(reflection.object.otyp, state);
            }
            return false;
        }
        if (visible) await pline(`${name()} is turned to stone!`);
        return (await finishHeroMonsterKillOutcome(monster, monster.mx, monster.my,
            { petrified: true })).heroDied;
    } else if (able && monster.mnum === FLOATING_EYE) {
        const gaze = MONSTER_ATTACKS[monster.mnum]?.[0];
        if (!gaze) throw new Error('A floating eye has no gaze attack.');
        let turns = d(monster.m_lev, gaze[3]);
        if (!rn2(4)) turns = 120;
        if (visible) await pline(`${name()} is frozen by its reflection.`);
        else {
            const heard = formatHeardMessage('something stop moving.', state);
            if (heard) await pline(heard);
        }
        paralyzeMonster(monster, (monster.mfrozen || 0) + turns);
    } else if (able && monster.mnum === UMBER_HULK) {
        if (visible) await pline(`${name()} confuses itself!`);
        monster.mconf = 1;
    } else if (able && (MONSTER_SYMBOL[monster.mnum] === S_NYMPH || monster.mnum === AMOROUS_DEMON)) {
        if (visible) {
            await pline(`${monsterReflexiveAction(monster, name(), 'admire', '', { state })} in your ${mirror}.`);
            const pronoun = monsterSubjectPronoun(monster, { state });
            await pline(`${pronoun.charAt(0).toUpperCase()}${pronoun.slice(1)} takes it!`);
        } else await pline(`It steals your ${mirror}!`);
        // C apply.c:1163 uses setnotworn() so a stolen wielded mirror does
        // not arm the "begin bashing with your bare hands" notice.
        await setnotworn(object, state);
        if (state.program_state.gameover) return true;
        await freeInventoryObject(object, state);
        if (state.program_state.gameover) return true;
        await addObjectToMonsterInventory(monster, object, state);
        if (monsterTeleportRestricted(monster, state)) {
            if (canSeeMonster(monster)) await pline(`A mysterious force prevents ${monsterName(monster)} from teleporting!`);
        } else {
            const relocation = await randomMonsterRelocation(monster, { state, flags: RLOC_MSG });
            if (relocation?.died) return true;
        }
    } else if (!monsterIsUnicorn(monster.mnum) && !monsterIsHumanoid(monster.mnum)
        && !(monsterIsDemon(monster.mnum)) && (!monster.minvis || perceives) && rn2(5)) {
        if (monster.mfrozen) {
            await pline(visible ? `You discern no obvious reaction from ${monsterName(monster)}.`
                : formatFeltMessage('a bit silly gesturing the mirror in that direction.', state));
        } else {
            if (visible) await pline(`${name()} is frightened by its reflection.`);
            return (await makeMonsterFlee(monster, { state, turns: d(2, 4), announce: false })).heroDied;
        }
    } else if (!heroIsBlind(state) && (!monster.minvis || seesInvisible(state))) {
        await pline(`${name()} ${monster.minvis && !perceives ? "doesn't seem to notice" : 'ignores'} ${monsterPossessive(monster, { state })} reflection.`);
    }
    return false;
}

const NYMPHS = ['wood nymph', 'water nymph', 'mountain nymph']
    .map(name => MONSTER_NAME.indexOf(name));

// Part of C apply.c:use_bell(): the the(xname()) name of the bell.
function bellName(object: GameObject, state: GameState) {
    const name = objectName(object, state);
    return `the ${objectNameIsPlural(object, state) ? makePlural(name) : name}`;
}

// Part of C apply.c:use_bell(): the capitalized subject-verb prefix of
// the shatter and issue messages.
function bellAction(object: GameObject, verb: string, state: GameState) {
    const name = bellName(object, state);
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${
        objectNameIsPlural(object, state) ? verb : verb === 'have' ? 'has' : `${verb}s`
    }`;
}

// C apply.c:use_bell()
export async function useBell(object: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    requireInitializedHero(state.u);
    const ordinary = object.otyp !== BELL_OF_OPENING || !object.spe;
    const invoking = object.otyp === BELL_OF_OPENING
        && isInvocationPosition(state.u.ux, state.u.uy, state) && !heroIsOnStairs(state);
    let wake = false, learn = false;
    let remainingObject: GameObject | null = object;
    await plineWithContinuation(`You ring ${bellName(object, state)}.`);
    if (state.u.uinwater || state.underwater || state.u.underwater
        || (state.u.uswallow && ordinary)) {
        await plineWithContinuation('But the sound is muffled.');
    } else if (invoking && ordinary) {
        await plineWithContinuation('But it makes no sound.');
        learn = true;
    } else if (ordinary) {
        if (object.cursed && !rn2(4)
            && NYMPHS.every(species => !((state.mvitals?.[species]?.mvflags || 0) & G_GONE))) {
            const species = mkclassAligned(S_NYMPH, 0, A_NONE);
            const nymph = await makemonAt(species, state.u.ux, state.u.uy, NO_MINVENT | MM_NOMSG);
            if (nymph) {
                await plineWithContinuation(`You summon ${monsterName(nymph, { article: 'a', state })}!`);
                if (!objectResistsDestruction(object, 93, 100)) {
                    await plineWithContinuation(`${bellAction(object, 'have', state)} shattered!`);
                    await consumeInventoryItem(object, state);
                    remainingObject = null;
                } else {
                    const fate = rn2(3);
                    if (fate === 1) adjustMonsterSpeed(nymph, 2);
                    else if (fate === 2) {
                        state._helplessDoneMessage = '';
                        state._helplessReason = null;
                        nomul(-rnd(2), state);
                    }
                }
            }
        }
        wake = true;
    } else {
        await consumeObjectCharge(object, { state });
        if (state.u.uswallow) {
            if (object.cursed) await plineWithContinuation('Nothing happens.');
            else await openit(state);
        } else if (object.cursed) {
            await summonUndead({ x: state.u.ux, y: state.u.uy }, { state, flags: NO_MINVENT });
            wake = true;
        } else if (invoking) {
            await plineWithContinuation(`${bellAction(object, 'issue', state)} an unsettling shrill sound...`);
            object.age = state.moves;
            learn = true;
            wake = true;
        } else if (object.blessed) {
            let opened = 0;
            if (state.uchain || state.u.uchain) {
                await unpunishHero(state);
                opened++;
            } else if (state.u.utrap && state.u.utraptype === TT_BURIEDBALL) {
                await freeHeroFromBuriedBall(state);
                opened++;
            }
            opened += await openit(state);
            if (state.program_state.gameover) return {
                spentTime: true, heroDied: true, object: remainingObject,
            };
            await plineWithContinuation(!opened ? 'Nothing happens.'
                : opened === 1 ? 'Something opens...' : 'Things open around you...');
            learn = opened !== 0;
        } else {
            learn = (await findit()) !== 0;
            if (!learn) await plineWithContinuation('Nothing happens.');
        }
    }
    if (learn) {
        learnObjectType(BELL_OF_OPENING, state);
        object.known = true;
    }
    if (wake) await wakeMonstersNearWithMessages(state.u.ux, state.u.uy,
        state.u.ulevel * 20, state, plineWithContinuation, { petCall: true });
    return { spentTime: true, heroDied: !!state.program_state.gameover, object: remainingObject };
}

interface AppliedLightResult {
    spentTime: true;
    heroDied: boolean;
    object: GameObject | null;
}

// Port only: shared spent-time result builder for the apply light family.
function result(object: GameObject | null, state: GameState): AppliedLightResult {
    return { spentTime: true, heroDied: !!state.program_state?.gameover, object };
}

// C obj.h:Is_candle()
function isCandle(object: GameObject) {
    return object.otyp === TALLOW_CANDLE || object.otyp === WAX_CANDLE;
}

// Part of C apply.c:use_lamp(): the Shk_Your() capitalized pronoun
// prefix of the lamp on/off messages.
function lampOwner(object: GameObject, state: GameState) {
    const owner = carriedObjectOwner(object, state);
    return owner.charAt(0).toUpperCase() + owner.slice(1); // C Shk_Your().
}

// Part of C apply.c:use_lamp(), apply.c:use_candle(): the verbalize()
// purchase notice.
async function announcePurchase(message: string) {
    // These apply.c verbalize() calls have no hearing/muteshk gate. The
    // separate usage-fee owner does check those before its own notice.
    await plineWithContinuation(`"${message}"`);
}

// Part of C apply.c:use_candle(): splitting the stack when attaching to
// a partly filled candelabrum.
function splitCarriedObject(object: GameObject, count: number, state: GameState) {
    const split = splitObjectStack(object, count, state);
    if (!split) throw new Error('Lighting requires a valid quantity to split from the stack.');
    return split;
}

// C apply.c:use_lamp()
export async function useLamp(object: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    const lamp = object.otyp === BRASS_LANTERN ? 'lantern'
        : [OIL_LAMP, MAGIC_LAMP].includes(object.otyp) ? 'lamp' : null;
    if (object.lamplit) {
        await plineWithContinuation(lamp ? `${lampOwner(object, state)} ${lamp} is now off.`
            : `You snuff out ${ownedObjectName(object, state, { capitalized: false })}.`);
        endObjectBurn(object, state);
        return result(object, state);
    }
    if (heroIsUnderwater(state)) {
        await plineWithContinuation(isCandle(object)
            ? "Sorry, fire and water don't mix." : 'This is not a diving lamp.');
        return result(object, state);
    }
    if (!isCandle(object) && object.age === 0 || object.otyp === MAGIC_LAMP && object.spe === 0) {
        await plineWithContinuation(object.otyp === BRASS_LANTERN
            ? heroIsBlind(state) ? 'Nothing seems to happen.' : 'Your lantern is out of power.'
            : `This ${objectName(object, state)} has no oil.`);
        return result(object, state);
    }
    if (object.cursed && rn2(2) === 0) {
        if ([OIL_LAMP, MAGIC_LAMP].includes(object.otyp) && rn2(3) === 0) {
            const gloves = state.uarmg || state.u.uarmg;
            const fingers = gloves ? armorSimpleName(gloves, state) : makePlural(body_part(FINGER, state));
            await plineWithContinuation(`The lamp spills and covers your ${fingers} with oil.`);
            setSlipperyHands((state.u.glibTurns ?? 0) + d(2, 10), state);
        } else await plineWithContinuation(heroIsBlind(state) ? 'Nothing seems to happen.'
            : `${definiteObjectAction(object, null, state)} ${objectQuantity(object) === 1 ? 'flickers' : 'flicker'} for a moment, then ${objectQuantity(object) === 1 ? 'dies' : 'die'}.`);
        return result(object, state);
    }
    if (lamp) {
        await chargeUnpaidUsage(object, { state });
        await plineWithContinuation(`${lampOwner(object, state)} ${lamp} is now on.`);
    } else {
        const owner = ownedObjectName(object, state);
        await plineWithContinuation(`${owner}${owner.endsWith('s') ? "'" : "'s"} flame${objectQuantity(object) > 1 ? 's burn' : ' burns'}${heroIsBlind(state) ? '.' : ' brightly!'}`);
        if (object.unpaid && costlySpot(state.u.ux, state.u.uy, state)
            && object.age === 20 * objectBaseCost(object.otyp)) {
            const pronoun = objectQuantity(object) > 1 ? 'them' : 'it';
            await announcePurchase(`You burn ${pronoun}, you bought ${pronoun}!`);
            await billDummyObject(object, state);
        }
    }
    beginObjectBurn(object, state);
    return result(object, state);
}

// C apply.c:use_candelabrum()
export async function useCandelabrum(object: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    const candles = object.spe === 1 ? 'candle' : 'candles';
    if (object.lamplit) {
        await plineWithContinuation(`You snuff the ${candles}.`);
        endObjectBurn(object, state);
        return result(object, state);
    }
    if (object.spe <= 0) {
        await plineWithContinuation(`This ${objectName(object, state)} has no ${candles}.`);
        if (state.inventory.some(isCandle))
            await plineWithContinuation(`To attach candles, apply them instead of the ${objectName(object, state)}.`);
        return result(object, state);
    }
    if (heroIsUnderwater(state)) {
        await plineWithContinuation('You cannot make fire under water.');
        return result(object, state);
    }
    if (state.u.uswallow || object.cursed) {
        if (!heroIsBlind(state)) await plineWithContinuation(`The ${candles} ${object.spe === 1 ? 'flickers' : 'flicker'} for a moment, then ${object.spe === 1 ? 'dies' : 'die'}.`);
        return result(object, state);
    }
    if (object.spe < 7) {
        await plineWithContinuation(`There ${object.spe === 1 ? 'is' : 'are'} only ${object.spe} ${candles} in the ${objectName(object, state)}.`);
        if (!heroIsBlind(state)) await plineWithContinuation(`${object.spe === 1 ? 'It is' : 'They are'} lit.  ${definiteObjectAction(object, null, state)} shines dimly.`);
    } else await plineWithContinuation(`${definiteObjectAction(object, null, state)}'s ${candles} burn${heroIsBlind(state) ? '.' : ' brightly!'}`);
    if (!isInvocationPosition(state.u.ux, state.u.uy, state) || heroIsOnStairs(state)) {
        await plineWithContinuation(`The ${candles} ${object.spe === 1 ? 'is' : 'are'} being rapidly consumed!`);
        object.age = Math.trunc((object.age + 1) / 2);
        if (object.age === 0) {
            await impossible('Candelabrum with candles but no fuel?');
            object.age = 1;
        }
    } else {
        if (object.spe === 7) await plineWithContinuation(heroIsBlind(state)
            ? `${definiteObjectAction(object, null, state)} radiates a strange warmth!`
            : `${definiteObjectAction(object, null, state)} glows with a strange light!`);
        object.known = true;
    }
    beginObjectBurn(object, state);
    return result(object, state);
}

// C apply.c:use_candle()
export async function useCandle(object: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    if (state.u.uswallow) {
        await plineWithContinuation("You don't have enough elbow-room to maneuver.");
        return result(object, state);
    }
    const candelabrum = state.inventory.find(item => item.otyp === CANDELABRUM_OF_INVOCATION);
    if (!candelabrum || candelabrum.spe === 7) return useLamp(object, { state });
    const answer = await promptYesNo(`Attach ${ownedObjectName(object, state, { capitalized: false })} to ${ownedObjectName(candelabrum, state, { capitalized: false })}?`);
    if (answer !== 'y') return useLamp(object, { state });
    const remainder = candelabrum.spe + objectQuantity(object) > 7 ? object : null;
    if (remainder) object = splitCarriedObject(object, 7 - candelabrum.spe, state);
    const wasLit = object.lamplit;
    if (wasLit) endObjectBurn(object, state);
    const count = objectQuantity(object);
    await plineWithContinuation(`You attach ${count}${candelabrum.spe ? ' more' : ''} ${count === 1 ? 'candle' : 'candles'} to the ${objectName(candelabrum, state)}.`);
    if (!candelabrum.spe || candelabrum.age > object.age) candelabrum.age = object.age;
    candelabrum.spe += count;
    if (candelabrum.lamplit && !wasLit)
        await plineWithContinuation(`The new ${count === 1 ? 'candle magically ignites' : 'candles magically ignite'}!`);
    else if (!candelabrum.lamplit && wasLit)
        await plineWithContinuation(count === 1 ? 'It goes out.' : 'They go out.');
    if (object.unpaid) {
        const pronoun = count === 1 ? 'it' : 'them';
        await announcePurchase(`You ${candelabrum.lamplit ? 'burn' : 'use'} ${pronoun}, you bought ${pronoun}!`);
    }
    if (count < 7 && candelabrum.spe === 7)
        await plineWithContinuation(`${definiteObjectAction(candelabrum, null, state)} now has seven${candelabrum.lamplit ? ' lit' : ''} candles attached.`);
    if (candelabrum.lamplit) state.vision_full_recalc = 1;
    await useUpInventoryStack(object, state);
    candelabrum.owt = objectWeight(candelabrum);
    return result(remainder, state);
}
// C apply.c:catch_lit()
// One object catches fire from an external source: the ignitable() and
// get_obj_location() gate, the out-of-fuel and cursed-lamp refusals, the
// Yname2() catch report (visibility is the caller's ignite_items()
// context: OBJ_INVENT or cansee(x,y)), the potion-of-oil discovery, the
// unpaid-use bill, then begin_burn().
export async function catchLit(
    object: GameObject,
    { state = game, publish = async () => {}, random = rn2, visible = true }: CatchLitOptions = {},
): Promise<boolean> {
    if (!getObjectLocation(object, state)) return false;
    if (!catchesFire(object, random)) return false;
    const plural = (object.quan ?? object.quantity ?? 1) > 1;
    const blind = heroIsBlind(state);
    if (visible) {
        const name = lightSourceName(object, state);
        // C catch_lit() names the source with Yname2(): shop, carrier, or your/the.
        const prefix = objectOwnershipPrefix(object, state);
        await publish(blind
            ? `${prefix}${name} ${plural ? 'feel' : 'feels'} warm.`
            : `${prefix}${name} ${
                plural ? 'catch' : 'catches'
            } light!`);
    }
    // C catch_lit() credits discovery even when the fire is unseen.
    if (object.otyp === POT_OIL) learnObjectType(POT_OIL, state);
    // C catch_lit(): an unpaid source that catches while carried is billed
    // for its use on top of its price.
    if (object.where === 'inventory' && object.unpaid
        && costlySpot(state.u.ux, state.u.uy, state)) {
        await chargeUnpaidUsage(object, { state });
        await publish(`"That's in addition to the cost of ${
            ownedObjectName(object, state, { capitalized: false })} ${
            plural ? 'themselves' : 'itself'}, of course."`);
        await billDummyObject(object, state);
    }
    return beginObjectBurn(object, state, state.moves ?? 0);
}

interface CatchLitOptions {
    state?: GameState;
    publish?: MessagePublisher;
    random?: RandomBelow;
    visible?: boolean;
}

// Part of C apply.c:catch_lit(): decide whether an object can catch light.
function catchesFire(object: GameObject | null | undefined, random: RandomBelow): boolean {
    if (!object || object.lamplit || object.in_use
        || !LIGHT_TYPES.has(object.otyp)
        || object.otyp === BRASS_LANTERN) return false;
    if ((object.otyp === MAGIC_LAMP
            || object.otyp === CANDELABRUM_OF_INVOCATION)
        && (object.spe ?? 0) <= 0) return false;
    if (TIMED_LIGHT_TYPES.has(object.otyp) && (object.age ?? 0) <= 0)
        return false;
    if (object.otyp === CANDELABRUM_OF_INVOCATION && object.cursed)
        return false;
    return !([OIL_LAMP, MAGIC_LAMP].includes(object.otyp)
        && object.cursed && random(2) === 0);
}

// Part of C apply.c:catch_lit(): name the ignited light source.
function lightSourceName(object: GameObject, state: GameState) {
    observeObjectForNaming(object, { state });
    const name = objectName(object, state);
    const quantity = object.quan ?? object.quantity ?? 1;
    return quantity > 1 ? makePlural(name) : name;
}


// Only message delivery is observed; display callbacks may return input status.
type Publish = (message: string) => unknown;

// C apply.c:snuff_candle()
// Extinguish a lit candle or candelabrum: Shk_Your()'s owner prefix
// (carriedObjectOwner()), the OBJ_MINVENT cansee() visibility rule, then
// end_burn(). snuff_lit()'s candle tail and the drop/throw/kick/put-in-box
// callers land here.
export async function snuffCandle(
    object: GameObject, state: GameState = game,
    publish: MessagePublisher = plineWithContinuation,
): Promise<boolean> {
    const candle = object.otyp === TALLOW_CANDLE || object.otyp === WAX_CANDLE;
    if ((!candle && object.otyp !== CANDELABRUM_OF_INVOCATION) || !object.lamplit)
        return false;
    const many = candle ? object.quan > 1 : object.spe > 1;
    const location = getObjectLocation(object, state);
    const visible = object.where === 'minvent'
        ? !!location && cansee(location.x, location.y) : !heroIsBlind(state);
    if (visible) {
        await publish(`${carriedObjectOwner(object, state)} ${
            candle ? '' : "candelabrum's "}candle${
            many ? "s' flames are" : "'s flame is"} extinguished.`);
    }
    endObjectBurn(object, state);
    return true;
}

// C apply.c:snuff_lit()
// Also C apply.c:snuff_candle(): the candle tail calls it. Callers keep the
// object in its native ownership phase: in_container() has already removed
// it from inventory.
export async function snuffLitObject(
    object: GameObject, state: GameState = game,
    publish: Publish = plineWithContinuation,
): Promise<boolean> {
    if (!object.lamplit || !LIGHT_TYPES.has(object.otyp)) return false;
    if (CANDLE_TYPES.has(object.otyp)) return snuffCandle(object, state, publish);
    const location = getObjectLocation(object, state);
    const visible = object.where === 'minvent'
        ? !!location && cansee(location.x, location.y) : !heroIsBlind(state);
    if (visible) {
        await publish(`${ownedObjectName(object, state)} ${objectNameIsPlural(object, state) ? 'go' : 'goes'} out!`);
    }
    endObjectBurn(object, state);
    return true;
}

// Part of C apply.c:splash_lit(): decide whether the hero's lantern is submerged.
function heroLanternIsDunked(state: GameState): boolean {
    if (!isPoolAt(state.u.ux, state.u.uy, state)) return false;
    return Is_waterlevel(state.u.uz)
        || !(state.u?.levitating || state.levitating
            || heroIsFlying(state) || heroHasWaterWalking(state));
}

// C apply.c:splash_lit()
// Also C apply.c:snuff_lit(): snuff the splashed light source.
// Each message precedes end_burn, so the darkened view waits for the next
// flush instead of preceding the message.
export async function splashLitObject(object: GameObject | null | undefined, publish: MessagePublisher, state = game): Promise<boolean> {
    if (!object?.lamplit) return false;
    // snuff_lit() handles flames and lanterns, not magical light sources.
    if (![OIL_LAMP, MAGIC_LAMP, BRASS_LANTERN, POT_OIL,
        TALLOW_CANDLE, WAX_CANDLE, CANDELABRUM_OF_INVOCATION].includes(object.otyp))
        return false;
    const carried = (state.inventory || []).includes(object);
    let dunkedLantern = false;
    if (object.otyp === BRASS_LANTERN) {
        let visible = false, audible = false, snuff = true;
        if (carried) {
            visible = !heroIsBlind(state);
            audible = !heroIsDeaf(state);
            dunkedLantern = heroLanternIsDunked(state);
            snuff = false;
        } else if (object.where === 'minvent' && object.ocarry
            && monsterIsHumanoid(object.ocarry.mnum)) {
            const carrier = object.ocarry;
            const position = getObjectLocation(object, state);
            visible = !!position && cansee(position.x, position.y);
            audible = couldsee(carrier.mx, carrier.my)
                && (carrier.mx - state.u.ux) ** 2 + (carrier.my - state.u.uy) ** 2 < 25;
            dunkedLantern = isPoolAt(carrier.mx, carrier.my, state)
                && (!monsterFliesOrFloats(carrier) || Is_waterlevel(state.u.uz));
            snuff = false;
        }
        if (visible || audible) {
            const action = audible && visible
                ? 'crackles and flickers'
                : audible ? 'crackles' : 'flickers';
            await publish(`${ownedObjectName(object, state)} ${action}.`);
        }
        if (!dunkedLantern && !snuff) return false;
    }

    const position = getObjectLocation(object, state);
    const visible = object.where === 'minvent'
        ? !!position && cansee(position.x, position.y) : !heroIsBlind(state);
    if (visible) {
        const candle = object.otyp === TALLOW_CANDLE || object.otyp === WAX_CANDLE;
        if (candle || object.otyp === CANDELABRUM_OF_INVOCATION) {
            const many = candle ? object.quan > 1 : object.spe > 1;
            await publish(`${objectOwnershipPrefix(object, state, { capitalized: true })}${
                candle ? '' : "candelabrum's "}candle${many ? "s' flames are" : "'s flame is"} extinguished.`);
        } else {
            const plural = objectNameIsPlural(object, state);
            await publish(`${ownedObjectName(object, state)} ${plural ? 'go' : 'goes'} out!`);
        }
    }
    if (!endObjectBurn(object, state, state.moves ?? 0))
        object.lamplit = false;
    if (dunkedLantern) {
        const age = object.age ?? 0;
        object.age = age - (age > 200 ? 100 : Math.trunc(age / 2));
    }
    return true;
}

// C apply.c:light_cocktail()
export async function lightCocktail(object: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    if (state.u.uswallow) {
        await plineWithContinuation("You don't have enough elbow-room to maneuver.");
        return result(object, state);
    }
    if (object.lamplit) {
        await plineWithContinuation('You snuff the lit potion.');
        endObjectBurn(object, state);
        if (!object.owornmask) {
            await freeInventoryObject(object, state);
            object = await addInventoryItem(object, null, false);
        }
        return result(object, state);
    }
    if (heroIsUnderwater(state)) {
        await plineWithContinuation('There is not enough oxygen to sustain a fire.');
        return result(object, state);
    }
    const split = objectQuantity(object) > 1;
    if (split) object = splitCarriedObject(object, 1, state);
    const ownership = carriedObjectOwner(object, state);
    const owner = ownership === 'Your' || ownership === 'The'
        ? ownership.toLowerCase() : ownership;
    await plineWithContinuation(`You light ${owner} potion.${heroIsBlind(state) ? '' : '  It gives off a dim light.'}`);
    if (object.unpaid && costlySpot(state.u.ux, state.u.uy, state)) {
        await chargeUnpaidUsage(object, { state });
        await announcePurchase("That's in addition to the cost of the potion, of course.");
        await billDummyObject(object, state);
    }
    learnObjectType(object.otyp, state);
    beginObjectBurn(object, state);
    if (split) {
        unlinkObject(object, state);
        object.nomerge = true;
        const held = await holdAnotherObject(object, {
            state, dropMessage: `You drop ${await inventoryItemDescription(object)}!`,
        });
        if (held.object) held.object.nomerge = false;
        return result(held.object, state);
    }
    return result(object, state);
}

// C apply.c:rub_ok().
function rubEligibleObject(object: GameObject | null | undefined) {
    return object?.otyp === OIL_LAMP || object?.otyp === MAGIC_LAMP
        || object?.otyp === BRASS_LANTERN || isGrayStone(object) || isRoyalJelly(object);
}

// C apply.c:jelly_ok().
async function rubRoyalJelly(jelly: GameObject) {
    const used = await useRoyalJelly(jelly, async () => {
        const egg = await chooseInventoryObject(
            'rub the royal jelly on',
            object => object.otyp === EGG ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE,
            { forcePrompt: true },
        );
        if (egg) game._pending_message = '';
        // apply.c:use_royal_jelly() returns ECMD_CANCEL when getobj() for
        // the egg target is declined.
        else commandResultCancelled();
        return egg;
    });
    game.context.move = used ? 1 : 0;
    return used;
}

// Part of C apply.c:dorub(): the rub command; light.ts:transformMagicLampToOilLamp() contains the extracted conversion.
// C refs: apply.c:dorub(), invent.c:getobj(), wield.c:wield_tool(), and
// cmd.c:CQ_CANNED.  Selecting an unwielded lamp does not rub it immediately:
// wield_tool() installs it, consumes one action, and queues dorub plus the
// inventory letter for the next hero command boundary.
export async function dorub() {
    if (heroHasNoHands(game)) {
        await syncPline("You aren't able to rub anything without hands.");
        game.context.move = 0;
        return;
    }
    const object = await chooseInventoryObject('rub', candidate =>
        rubEligibleObject(candidate) ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE);
    if (!object) {
        // apply.c:dorub() returns ECMD_CANCEL without an object; the
        // rhack seam clears the queues so ^A cannot replay the rub.
        commandResultCancelled();
        return;
    }
    if (isGrayStone(object)) {
        const result = await useGrayStone(object);
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (isRoyalJelly(object)) {
        await rubRoyalJelly(object);
        return;
    }
    const wielded = await wieldTool(
        object,
        'rub',
        { swapWeapons: doswapweapon },
        game,
    );
    if (!wielded.ready) {
        game.context.move = 0;
        return;
    }
    if (wielded.newlyWielded) {
        if (!object.invlet)
            throw new Error('A wielded inventory object must have an inventory letter.');
        // C apply.c:1807-1809 wield_tool() queues dorub plus the object's
        // letter; next turn's dorub() pops the letter from CQ_CANNED.
        cmdq_add_ec(CQ_CANNED, 'dorub');
        cmdq_add_key(CQ_CANNED, object.invlet.charCodeAt(0));
        game.context.move = 1;
        return;
    }

    if (object.otyp === MAGIC_LAMP) {
        if ((object.spe || 0) > 0 && rn2(3) === 0) {
            await chargeUnpaidUsage(object, { alternate: true });
            // C performs the bones-safe lamp transformation before the
            // released monster can grant a fatal artifact wish.
            transformMagicLampToOilLamp(
                object, 1000 + rn2(500), game, game.moves ?? 0,
            );
            requirePlayingGame(game);
            await releaseDjinni(object, game);
            learnObjectType(MAGIC_LAMP);
            game.context.move = 1;
            return;
        }
        if (rn2(2))
            await pline(heroIsBlind(game)
                ? 'You smell smoke.' : 'You see a puff of smoke.');
        else
        await pline('Nothing happens.');
    } else if (object.otyp === BRASS_LANTERN) {
        await pline(
            'Rubbing the electric lamp is not particularly rewarding.',
        );
        await pline('Anyway, nothing exciting happens.');
    } else {
        await pline('Nothing happens.');
    }
    game.context.move = 1;
}

// C apply.c:dojump(): the physical command shares the spell's jump owner.
export async function dojump(): Promise<void> {
    const result = await jumpHero(0);
    game.context.move = result.spentTime ? 1 : 0;
}

export interface JumpResult {
    spentTime: boolean;
    heroDied: boolean;
}

interface JumpAdmission {
    spentTime?: boolean;
    message: string | null;
}

const ANY = 0, HORIZONTAL = 1, VERTICAL = 2, DIAGONAL = 3;

// Port only: shared result builder for the jump family.
function jumpResult(spentTime: boolean, state: GameState): JumpResult {
    return { spentTime, heroDied: !!state.program_state.gameover };
}

// C apply.c:is_valid_jump_pos(): the range, sight, doorway-diagonal, and
// walk-path checks, reported as the refusal message.
// C apply.c:check_jump(): the per-cell walk-path test — walls, closed
// doors, door alignment on the trajectory, and boulders non-throwers
// cannot clear.
// dist2()/distu() is the squared dx*dx+dy*dy; closed_door() is the
// D_CLOSED|D_LOCKED mask; sobj_at() is the pile scan for the boulder.
function jumpRestriction(x: number, y: number, magic: number, state: PlayingGameState): string | null {
    const hero = state.u;
    const dx = x - hero.ux, dy = y - hero.uy;
    const distance = dx * dx + dy * dy;
    // Permanent intrinsic jumping is the limited knight's move. Timed,
    // form, and equipment sources permit the ordinary physical range.
    const sources = hero._propertySources?.jumping;
    const versatile = (hero.jumpingTurns ?? 0) > 0
        || Object.keys(sources?.intrinsic || {}).some(origin =>
            !['role', 'experience', 'race', 'outside'].includes(origin))
        || (sources?.worn?.length ?? 0) > 0 || !!sources?.invoked
        || (sources?.carried?.length ?? 0) > 0;
    if (!magic && !versatile && distance !== 5) return 'Illegal move!';
    if (distance > (magic ? 6 + magic * 3 : 9)) return 'Too far!';
    if (!isok(x, y)) return 'You cannot jump there!';
    if (!cansee(x, y)) return 'You cannot see where to land!';

    const passesWalls = heroPassesWalls(state);
    const diagonal = magic || passesWalls || (!dx && !dy) ? ANY
        : !dy ? HORIZONTAL : !dx ? VERTICAL : DIAGONAL;
    let ax = Math.abs(dx), ay = Math.abs(dy);
    if (ax >= 2 * ay) ay = 0;
    else if (ay >= 2 * ax) ax = 0;
    const trajectory = magic || passesWalls || (!ax && !ay) ? ANY
        : !ay ? HORIZONTAL : !ax ? VERTICAL : DIAGONAL;
    const blocksDoor = (location: MapLocation): boolean => location.typ === DOOR
        && !!(location.doormask & D_ISOPEN) && trajectory !== ANY
        && (trajectory === DIAGONAL
            || !!(trajectory & HORIZONTAL) === !!location.horizontal);
    if (diagonal === DIAGONAL && blocksDoor(state.level.requireAt(hero.ux, hero.uy)))
        return "You can't jump diagonally out of a doorway.";
    if (passesWalls) return null;
    const throwsRocks = monsterThrowsRocks(heroSpecies(state));
    for (const point of walkPathCells(hero.ux, hero.uy, x, y)) {
        const location = state.level.requireAt(point.x, point.y);
        const boulder = (state.level.objects[point.x]?.[point.y] || [])
            .some(object => object.otyp === BOULDER);
        if (IS_STWALL(location.typ) || blocksDoor(location)
            || (location.typ === DOOR && (location.doormask & (D_CLOSED | D_LOCKED)))
            || (boulder && !throwsRocks))
            return 'There is an obstacle preventing that jump.';
    }
    return null;
}

// Part of C apply.c:jump(): the refusal cascade before the landing query
// (no legs, property range, steed, engulfed, held, levitation, burden,
// strength, wounded legs).
async function jumpAdmission(magic: number, state: PlayingGameState): Promise<JumpAdmission | null> {
    const hero = state.u;

    if (!magic && (monsterHasNoLimbs(heroSpecies(state)) || monsterIsSlithy(heroSpecies(state))))
        return { message: "You can't jump; you have no legs!" };
    if (!magic && !propertyIsActive('jumping', state))
        return { message: "You can't jump very far." };
    if (!magic && hero.usteed && await stuckSteed(false, state))
        return { message: null };
    if (hero.uswallow) return { spentTime: !!magic, message: magic
        ? 'You bounce around a little.' : "You've got to be kidding!" };
    if (hero.uinwater) return { spentTime: !!magic, message: magic
        ? 'You swish around a little.' : 'This calls for swimming, not jumping!' };
    if (hero.ustuck) {
        const holder = hero.ustuck;
        if (holder.mtame && !propertyIsActive('conflict', state) && !holder.mconf) {
            setHeroGrip(null, state);
            return { spentTime: true, message: `You pull free from ${monsterName(holder)}.` };
        }
        return { spentTime: !!magic, message: magic
            ? `You writhe a little in the grasp of ${monsterName(holder)}!`
            : `You cannot escape from ${monsterName(holder)}!` };
    }
    if (propertyIsActive('levitation', state) || Is_airlevel(hero.uz) || Is_waterlevel(hero.uz))
        return { spentTime: !!magic, message: magic
            ? 'You flail around a little.' : "You don't have enough traction to jump." };
    if (!magic && nearCapacity(state) > 0)
        return { message: 'You are carrying too much to jump!' };
    if (!magic && ((hero.uhunger ?? 900) <= 100 || currentAttribute(A_STR, state) < 6))
        return { message: 'You lack the strength to jump!' };
    if (!magic && ((hero._woundedLegTurns ?? 0) > 0 || hero._woundedLegSide)) {
        if (hero.usteed)
            return { message: `${monsterName(hero.usteed, { capitalized: true })} is in no shape for jumping.` };
        const both = hero._woundedLegSide === 'both';
        const leg = both ? makePlural(body_part(LEG, state))
            : `${hero._woundedLegSide} ${body_part(LEG, state)}`;
        return { message: `Your ${leg} ${both ? 'are' : 'is'} in no shape for jumping.` };
    }
    if (hero.usteed && hero.utrap)
        return { message: `${monsterName(hero.usteed, { capitalized: true })} is stuck in a trap.` };
    return null;
}

// Part of C apply.c:jump(): the trapped-hero escape switch of a jump
// attempt (bear trap, pit, web, lava, buried ball).
async function escapeJumpTrap(target: Position, state: PlayingGameState): Promise<boolean> {
    const hero = state.u;
    if (hero.utraptype === undefined)
        throw new Error('Escaping a trap requires its trap type.');
    switch (hero.utraptype) {
    case TT_BEARTRAP: {
        const side = rn2(3) ? 'left' : 'right';
        await plineWithContinuation('You rip yourself free of the bear trap!  Ouch!');
        let damage = rnd(10);
        if (hero.halfPhysicalDamage)
            damage = Math.trunc((damage + 1) / 2);
        await loseHeroHp(damage, 'jumping out of a bear trap', { state, killerFormat: KILLED_BY });
        if (state.program_state.gameover) return false;
        await woundHeroLegs(side, rn1(1000, 500), state);
        break;
    }
    case TT_PIT:
        await plineWithContinuation('You leap from the pit!');
        break;
    case TT_WEB: {
        await plineWithContinuation('You tear the web apart as you pull yourself free!');
        const web = state.level.traps.find(trap => trap.tx === hero.ux && trap.ty === hero.uy);
        if (web) deleteTrap(web);
        break;
    }
    case TT_LAVA:
        await plineWithContinuation(`You pull yourself above the ${displayLiquidName('lava', state)}!`);
        target.x = hero.ux; target.y = hero.uy;
        break;
    case TT_BURIEDBALL:
    case TT_INFLOOR:
        await plineWithContinuation(`You strain your ${makePlural(body_part(LEG, state))}, but you're still ${hero.utraptype === TT_INFLOOR ? 'stuck in the floor' : 'attached to the buried ball'}.`);
        await woundHeroLegs('left', rn1(10, 11), state);
        await woundHeroLegs('right', rn1(10, 11), state);
        return false;
    default:
        await impossible(`Jumping out of strange trap (${hero.utraptype})?`, { state });
    }
    await resetUtrap(true, state);
    return true;
}

// C apply.c:jump(): the shared physical/spell jump owner, from the spell
// hand-off and admission checks to the landing effects.
// C apply.c:get_valid_jump_position(): the landing predicate, used both to
// accept the cursor and to build the highlights below.
// C apply.c:display_jump_positions(): the S_goodpos beam over every valid
// landing, rendered by prepareMapPositionHighlights().
export async function jumpHero(magic = 0, { state = game }: { state?: GameState } = {}): Promise<JumpResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (!magic && !propertyIsActive('jumping', state)
        && knownSpell(SPE_JUMPING, state) === 'fresh') {
        return castSpell(SPE_JUMPING, { state });
    }
    const admission = await jumpAdmission(magic, state);
    if (admission) {
        if (admission.message) await plineWithContinuation(admission.message);
        return jumpResult(!!admission.spentTime, state);
    }
    const valid = (x: number, y: number): boolean => isok(x, y)
        && (ACCESSIBLE(state.level.requireAt(x, y).typ) || heroPassesWalls(state))
        && !jumpRestriction(x, y, magic, state);
    await plineWithContinuation('Where do you want to jump?');
    await prepareMapPositionHighlights(valid);
    const firstUse = shouldShowGetposTip();
    if (firstUse) await showGetposTip();
    await showGetposInstructions(state);
    if (firstUse) await plineWithContinuation('Move cursor to the desired position:');
    const target = await selectMapPosition({
        start: { x: state.u.ux, y: state.u.uy }, goal: 'the desired position',
        prompt: state._pending_message,
        isValidLocation: valid,
        highlightHero: false,
    });
    // apply.c:dojump() reports ECMD_CANCEL for Escape and ECMD_FAIL for an
    // invalid or steed-in-place target. The jump spell (magic > 0) consumes
    // the same bits inside spelleffects (spell.c:1585) without reporting
    // them to rhack(), so only the physical command records a result.
    if (!target) {
        if (magic === 0) commandResultCancelled(state);
        return jumpResult(false, state);
    }
    const refusal = jumpRestriction(target.x, target.y, magic, state);
    if (refusal) {
        await plineWithContinuation(refusal);
        if (magic === 0) commandResultFailed(state);
        return jumpResult(false, state);
    }
    const hero = state.u;
    if (hero.usteed && target.x === hero.ux && target.y === hero.uy) {
        await plineWithContinuation(`${monsterName(hero.usteed, { article: 'your', capitalized: true })} isn't capable of jumping in place.`);
        if (magic === 0) commandResultFailed(state);
        return jumpResult(false, state);
    }
    const wasTrapped = !!hero.utrap;
    if (wasTrapped && !await escapeJumpTrap(target, state)) return jumpResult(true, state);
    if (target.x === hero.ux && target.y === hero.uy) {
        if (wasTrapped) await morehungry(rnd(10), { state });
        else {
            const trap = state.level.traps.find(trap => trap.tx === hero.ux && trap.ty === hero.uy);
            if (!trap) {
                await plineWithContinuation(heroIsHallucinating(state)
                    ? 'You hop up and down a bit.' : 'You decide not to jump after all.');
                return jumpResult(false, state);
            }
            await plineWithContinuation(`You jump up and ${propertyIsActive('flying', state) ? 'fly' : 'come'} back down.`);
            await dotrap(trap, { forceTrap: true, tookPlunge: true,
                finishTeleport: finishTeleportArrival, gotoLevel });
        }
        return jumpResult(true, state);
    }
    const destination = await hurtleJumpTo(target.x, target.y, {
        finishTeleport: finishTeleportArrival, gotoLevel,
        finishMonsterDeath: (monster, { noCorpse = true } = {}) =>
            finishHeroMonsterKill(monster, monster.mx, monster.my, {
                showKillMessage: false, noCorpse, recordConduct: false,
            }),
    });
    if (state.program_state.gameover) return jumpResult(true, state);
    await teleds(destination.x, destination.y, state);
    if (state.program_state.gameover) return jumpResult(true, state);
    nomul(-1, state);
    state._helplessReason = 'jumping around';
    state._helplessDoneMessage = '';
    await morehungry(rnd(25), { state });
    return jumpResult(true, state);
}

// C apply.c:use_tinning_kit()
export async function useTinningKit(kit: GameObject) {
    requirePlayingGame(game);
    if (kit.spe <= 0) {
        await pline('You seem to be out of tins.');
        return;
    }
    const corpse = await chooseTinningCorpse();
    if (!corpse) return;
    if (corpse.oeaten) {
        await pline('You cannot tin something which is partly eaten.');
        return;
    }
    if (corpse.corpsenm === undefined) throw new Error('Tinning requires a corpse species.');
    if (touchPetrifies(corpse.corpsenm) && !heroResistsStoning(game) && !game.uarmg) {
        const name = withIndefiniteArticle(corpseName(corpse));
        const transform = formCanBecomeStoneGolem(game.u.umonnum, game);
        await pline(transform ? `You tin ${name} without wearing gloves.`
            : `Tinning ${name} without wearing gloves is a fatal mistake...`);
        await resolveImmediatePetrification({ killer: transform ? '' : `trying to tin ${name} without gloves` });
        if (game.program_state.gameover) return;
    }
    if (monsterIsRider({ mnum: corpse.corpsenm })) {
        const revival = await reviveCorpseImmediately(corpse);
        for (const message of revival?.messages ?? []) await pline(message);
        await pline(revival?.monster ? '"Yes...  But War does not preserve its enemies..."' : 'The corpse evades your grasp.');
        return;
    }
    if (!MONSTER_NUTRITION[corpse.corpsenm]) {
        await pline("That's too insubstantial to tin.");
        return;
    }
    await consumeObjectCharge(kit);
    const tin = await mksobj(TIN, false, false);
    tin.corpsenm = corpse.corpsenm;
    tin.cursed = kit.cursed;
    tin.blessed = kit.blessed;
    tin.owt = objectWeight(tin);
    tin.known = true;
    set_tin_variety(tin, HOMEMADE_TIN);
    if (corpse.where === 'inventory') {
        if (corpse.unpaid) await pline('"You tin it, you bought it!"');
        await consumeInventoryItem(corpse);
    } else {
        if (costlySpot(corpse.ox, corpse.oy, game) && !corpse.no_charge)
            await pline('"You tin it, you bought it!"');
        await useUpFloorObject(corpse, 1);
    }
    observeObjectForNaming(tin);
    await holdAnotherObject(tin, { dropMessage: `You make, but cannot pick up, ${await inventoryItemDescription(tin)}.` });
}

// C apply.c:tinnable().
function tinnable(corpse: GameObject): boolean {
    return corpse.otyp === CORPSE && !corpse.oeaten && !!MONSTER_NUTRITION[corpse.corpsenm ?? -1];
}

// Part of C apply.c:use_tinning_kit(): the corpse chooser through eat.c:floorfood() and tin_ok().
// Also C eat.c:tin_ok(): inlined as the tinning-kit chooser callback at the
// end (food-class corpses that can still be tinned).
async function chooseTinningCorpse(): Promise<GameObject | null> {
    requirePlayingGame(game);
    const hero = game.u;
    let declinedFloorCorpse = false;

    const aboveLiquid = (isPoolAt(hero.ux, hero.uy) || isLavaAt(hero.ux, hero.uy))
        && (propertyIsActive('waterWalking', game) || monsterIsClinger(heroSpecies(game))
            || propertyIsActive('flying', game) && !heroIsBreathless(game));
    if (!game.iflags.menu_requested && heroCanReachFloor(game, { checkPit: true }) && !aboveLiquid) {
        for (const corpse of game.level.objects[hero.ux]?.[hero.uy] ?? []) {
            if (!tinnable(corpse)) continue;
            if (willFeelPetrifyingCorpse(corpse)) {
                await feelPetrifyingCorpse(corpse);
                return null;
            }
            const one = corpse.quan === 1;
            observeObjectForNaming(corpse);
            const answer = await promptChoice(`There ${one ? 'is' : 'are'} ${await inventoryItemDescription(corpse)} here; tin ${one ? 'it' : 'one'}?`, ['y', 'n', 'q'], 'n', { menuable: true });
            if (answer === 'y') return corpse;
            if (answer === 'q') return null;
            declinedFloorCorpse = true;
        }
    }
    const corpse = await chooseInventoryObject('tin', object => {
        if (!object || object.oclass !== FOOD_CLASS) return GETOBJ_EXCLUDE;
        return tinnable(object) ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE_SELECTABLE;
    }, { hands: declinedFloorCorpse ? GETOBJ_EXCLUDE_NONINVENT : GETOBJ_EXCLUDE });
    if (corpse && !tinnable(corpse)) {
        await pline("You can't tin that!");
        return null;
    }
    return corpse;
}

const SICK = 'sickness';

const BLIND = 'blindness';

const HALLUCINATING = 'hallucination';

const VOMITING = 'vomiting';

const CONFUSED = 'confusion';

const STUNNED = 'stun';

const DEAF = 'deafness';

export type HornTrouble = typeof SICK | typeof BLIND | typeof HALLUCINATING
    | typeof VOMITING | typeof CONFUSED | typeof STUNNED | typeof DEAF;

export interface UnicornHornOptions {
    object?: GameObject | null;
    state?: GameState;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollDice?: typeof d;
}

export interface UnicornHornResult {
    used: true;
    spentTime: true;
    caused: HornTrouble | null;
    cured: HornTrouble[];
}

// Part of C apply.c:use_unicorn_horn(): the property-trouble collection
// into the trouble list.
function currentHornTroubles(state: GameState) {
    const hero = state.u;
    const troubles: HornTrouble[] = [];
    if ((hero.sickTurns ?? 0) > 0) troubles.push(SICK);
    if ((hero.blindTurns ?? 0) > (hero.ucreamed ?? 0)
        && !swallowedByBlindingMonster(state)) troubles.push(BLIND);
    if ((hero.hallucinationTurns ?? 0) > 0) troubles.push(HALLUCINATING);
    if ((hero.vomitingTurns ?? 0) > 0) troubles.push(VOMITING);
    if ((hero.confusionTurns ?? 0) > 0) troubles.push(CONFUSED);
    if ((hero.stunnedTurns ?? 0) > 0) troubles.push(STUNNED);
    if ((hero.deafTurns ?? 0) > 0) troubles.push(DEAF);
    return troubles;
}

// Part of C apply.c:use_unicorn_horn(): the engulfing-blinder check that
// keeps swallowed blindness out of the trouble list.
function swallowedByBlindingMonster(state: GameState) {
    if (!state.u?.uswallow || !state.u?.ustuck) return false;
    return (MONSTER_ATTACKS[state.u.ustuck.mnum] || []).some(
        ([attackType, damageType]) =>
            attackType === AT_ENGL && damageType === AD_BLND,
    );
}

// Part of C apply.c:use_unicorn_horn(): the per-trouble cure switch.
async function cureHornTrouble(trouble: HornTrouble, state: GameState, publish: MessagePublisher) {
    const hero = state.u;
    const talk = !heroIsUnaware(state);
    if (trouble === SICK) {
        cureHeroSickness(state, SICK_ALL);
        await publish(formatFeltMessage('cured.  What a relief!', state));
        return;
    }
    if (trouble === BLIND) {
        await makeBlinded(hero.ucreamed ?? 0, { state, talk, publish });
        return;
    }
    if (trouble === HALLUCINATING) {
        await makeHallucinated(0, { state, talk, publish });
        return;
    }
    if (trouble === VOMITING) {
        await makeHeroVomiting(0, { state, talk, publish });
        return;
    }
    if (trouble === CONFUSED) {
        await makeConfused(0, { state, talk, publish });
        return;
    }
    if (trouble === STUNNED) {
        await makeStunned(0, { state, talk, publish });
        return;
    }
    await makeDeaf(0, { state, talk, publish });
}

// Part of C apply.c:use_unicorn_horn(): the cursed-horn trouble switch.
async function causeHornTrouble(
    object: GameObject, state: GameState, publish: MessagePublisher,
    random: typeof rn2, rollDice: typeof d,
): Promise<HornTrouble> {
    const extraTurns = random(90) + 10;
    const trouble = Math.trunc(random(13) / 2);
    if (trouble === 0) {
        const currentTurns = state.u?.sickTurns ?? 0;
        const constitution = currentAttribute(A_CON, state);
        await startHeroSickness({
            state, publish,
            turns: currentTurns
                ? Math.trunc(currentTurns / 3) + 1
                : random(constitution) + 20,
            cause: objectName(object, state),
            type: SICK_NONVOMITABLE,
        });
        return SICK;
    }
    if (trouble === 1) {
        await makeBlinded((state.u.blindTurns ?? 0) + extraTurns, { state, publish });
        return BLIND;
    }
    if (trouble === 2) {
        const hero = state.u;
        // C apply.c:2279 guards this with !Confusion only; plain You()
        // prints for an unconscious hero too, without a dream rephrase.
        if (!(hero.confusionTurns ?? 0)) {
            await publish(`You suddenly feel ${
                heroIsHallucinating(state) ? 'trippy' : 'confused'
            }.`);
        }
        await makeConfused((hero.confusionTurns ?? 0) + extraTurns, { state, publish });
        return CONFUSED;
    }
    if (trouble === 3) {
        await makeStunned((state.u.stunnedTurns ?? 0) + extraTurns, { state, publish });
        return STUNNED;
    }
    if (trouble === 4) {
        if (heroIsVomiting(state)) {
            await vomit({ state, publish, random, rollDice });
        } else {
            await makeHeroVomiting(14, { state });
        }
        return VOMITING;
    }
    if (trouble === 5) {
        await makeHallucinated((state.u.hallucinationTurns ?? 0) + extraTurns, { state, publish });
        return HALLUCINATING;
    }
    if (heroIsDeaf(state)) await publish('Nothing seems to happen.');
    await makeDeaf((state.u.deafTurns ?? 0) + extraTurns, { state, publish });
    return DEAF;
}

// C apply.c:use_unicorn_horn()
export async function useUnicornHorn({
    object = null,
    state = game,
    publish = plineWithContinuation,
    random = rn2,
    rollDice = d,
}: UnicornHornOptions = {}): Promise<UnicornHornResult> {
    if (object?.cursed) {
        const caused = await causeHornTrouble(
            object, state, publish, random, rollDice,
        );
        return { used: true, spentTime: true, caused, cured: [] };
    }

    const troubles = currentHornTroubles(state);
    if (!troubles.length) {
        await publish('Nothing happens.');
        return { used: true, spentTime: true, caused: null, cured: [] };
    }
    if (troubles.length > 1) shuffleTroubles(troubles, random);

    const maximum = rollDice(2, object?.blessed ? 4 : 2);
    const cureCount = Math.min(troubles.length, random(maximum));
    const cured: HornTrouble[] = [];
    for (let index = 0; index < cureCount; index++) {
        const trouble = troubles[index];
        if (!trouble) throw new RangeError('Unicorn horn selected a missing condition.');
        await cureHornTrouble(trouble, state, publish);
        cured.push(trouble);
    }
    if (cured.length) state.context.botl = true;
    else await publish('Nothing seems to happen.');
    return { used: true, spentTime: true, caused: null, cured };
}

// C rnd.c:shuffle_int_array()
function shuffleTroubles(values: HornTrouble[], random: typeof rn2) {
    for (let index = values.length - 1; index > 0; index--) {
        const other = random(index + 1);
        if (other === index) continue;
        const currentValue = values[index];
        const otherValue = values[other];
        if (!currentValue || !otherValue)
            throw new RangeError('Unicorn horn shuffleTroubles selected a missing condition.');
        [values[index], values[other]] = [otherValue, currentValue];
    }
}

type FigurineLocation = Position & (
    { carrier: 'inventory'; monsterCarrier: null }
    | { carrier: 'floor'; monsterCarrier: null }
    | { carrier: 'minvent'; monsterCarrier: Monster }
);

interface FigurineEventBase {
    figurine: GameObject;
    carrier: ObjectWhere;
    message: string | null;
    finished?: true;
}

export interface FigurineTransformation extends FigurineEventBase, Position {
    transformed: true;
    monster: Monster;
    finishPending: boolean;
    waterMessages: string[];
    overdue: boolean;
    redraw: boolean;
    retryScheduled?: never;
}

export interface FigurineRetry extends FigurineEventBase {
    transformed: false;
    monster: null;
    finishPending: false;
    retryScheduled: true;
    retryDelay: number;
    retryDeadline: number;
    waterMessages?: never;
}

export interface FigurineConsumed extends FigurineEventBase {
    transformed: false;
    monster: null;
    finishPending: false;
    retryScheduled?: never;
    waterMessages: string[];
}

export type FigurineTimerEvent = FigurineTransformation | FigurineRetry | FigurineConsumed;

const S_EYE = 5;
const S_MIMIC = 13;
const S_LIGHT = 25;

// Part of C mondata.c:locomotion(): figurine-message copy of the motion-verb
// mapping; C fig_transform() calls locomotion(mtmp->data, "drop"). The
// general port is monsterLocomotion() in mondata.ts.
function figurineLocomotion(mnum: number, fallback = 'drop') {
    const symbol = MONSTER_SYMBOL[mnum];
    if (symbol === S_EYE || symbol === S_LIGHT) return 'float';
    if (monsterIsFlyer(mnum)) return 'fly';
    if (monsterIsSlithy(mnum)) return 'slither';
    if (monsterIsAmorphous({ mnum })) return 'ooze';
    if ((MONSTER_MOVE[mnum] ?? 0) === 0) return 'wiggle';
    if (monsterHasNoLimbs(mnum)) return 'crawl';
    return fallback;
}

// Part of C apply.c:figurine_location_checks(): the silent quietly==TRUE
// verdict fig_transform() applies to the chosen spot.
function figurineMayTransformAt(figurine: GameObject, x: number, y: number, state: GameState) {
    return figurinePlacementFailure(figurine, x, y, state) === null;
}

// C apply.c:figurine_location_checks(): timers use the same rules silently.
export function figurinePlacementFailure(figurine: GameObject, x: number, y: number, state: GameState): string | null {
    if (figurine.where === 'inventory' && state.u.uswallow)
        return "You don't have enough room in here.";
    if (!isok(x, y)) return 'You cannot put the figurine there.';
    const level = state.level;
    const location = level?.at(x, y);
    if (!level || !location) return 'You cannot put the figurine there.';
    const species = figurine.corpsenm;
    if (species === undefined) throw new TypeError('A figurine requires a monster species.');

    const passesWalls = monsterPassesWalls(species);
    const mayPassWall = passesWalls
        && !(location.wall_info & W_NONPASSWALL);
    if (IS_OBSTRUCTED(location.typ) && !mayPassWall) {
        const tree = location.typ === TREE || location.typ === STONE && level.flags.arboreal;
        return `You cannot place a figurine in ${tree ? 'a tree' : 'solid rock'}!`;
    }
    const boulder = state.level?.objects?.[x]?.[y]?.some(
        object => object !== figurine && object.otyp === BOULDER,
    );
    if (boulder && !passesWalls && !monsterThrowsRocks(species))
        return 'You cannot fit the figurine on the boulder.';
    return null;
}

// Part of C zap.c:get_obj_location(): resolves the carrying monster
// (C's figurine->ocarry) for the OBJ_MINVENT case of fig_transform().
function monsterCarryingFigurine(figurine: GameObject, state: GameState) {
    return state.level?.monsters?.find(monster =>
        (monster.minvent || monster.inventory || []).includes(figurine)
    ) || null;
}

// Part of C zap.c:get_obj_location(): the INVENT/FLOOR/MINVENT location
// cases fig_transform() relies on.
function figurineLocation(figurine: GameObject, state: GameState): FigurineLocation | null {
    if (figurine.where === 'inventory') {
        return {
            carrier: 'inventory', monsterCarrier: null,
            x: state.u?.ux, y: state.u?.uy,
        };
    }
    if (figurine.where === 'floor') {
        return {
            carrier: 'floor', monsterCarrier: null,
            x: figurine.ox, y: figurine.oy,
        };
    }
    if (figurine.where === 'minvent') {
        const monsterCarrier = monsterCarryingFigurine(figurine, state);
        if (!monsterCarrier?.mx) return null;
        return {
            carrier: 'minvent', monsterCarrier,
            x: monsterCarrier.mx, y: monsterCarrier.my,
        };
    }
    return null;
}

// Part of C apply.c:fig_transform(): the start_timer(rnd(5000), FIG_TRANSFORM)
// retry when the spot is not okay.
function scheduleFigurineRetry(
    figurine: GameObject, carrier: ObjectWhere, currentTurn: number, state: GameState,
): FigurineRetry {
    const retryDelay = rnd(5000);
    const retryTimer = scheduleObjectTimer(
        figurine, OBJECT_TIMER_KIND.FIG_TRANSFORM,
        currentTurn + retryDelay, state,
    );
    if (!retryTimer) throw new Error('Could not schedule the figurine retry timer.');
    return {
        figurine, monster: null, transformed: false,
        retryScheduled: true, retryDelay,
        retryDeadline: retryTimer.deadline,
        finishPending: false, message: null,
        carrier,
    };
}


// Part of C apply.c:fig_transform(): the OBJ_MINVENT "%s pack|empty water|
// thin air" carrier description (canseemon + wormno + is_pool).
function monsterCarrierDescription(monster: Monster, state: GameState) {
    if (canSeeMonster(monster)
        && (!monster.wormno || cansee(monster.mx, monster.my))) {
        const owner = monsterName(monster, { state, article: 'a' });
        return `${possessiveName(owner)} pack`;
    }
    return isPoolAt(monster.mx, monster.my, state) ? 'empty water' : 'thin air';
}

// Part of C apply.c:fig_transform(): the You_feel/You_see message switch
// for the newly created familiar, including the mundetected "and vanish"
// and hides_under endings.
async function familiarPresentation(
    monster: Monster, figurine: GameObject, location: FigurineLocation, overdue: boolean,
    state: GameState,
) {
    const blind = !!state.blind || (state.u?.blindTurns ?? 0) > 0;
    const seesInvisible = !!(state.u?.seeInvisible
        || (state.u?.seeInvisibleTurns ?? 0) > 0);
    let suppressSight = (!!monster.minvis && !seesInvisible)
        || (MONSTER_SYMBOL[monster.mnum] === S_MIMIC
            && !!monster.m_ap_type);
    let ending = '';
    if (monster.mundetected) {
        const shelter = state.level?.objects?.[monster.mx]?.[monster.my]?.[0];
        if (monsterHidesUnder(monster.mnum)
            && shelter) {
            ending = ` and ${figurineLocomotion(monster.mnum, 'crawl')} under ${
                await objectDescription(shelter, { state })
            }`;
        } else if (MONSTER_SYMBOL[monster.mnum] === S_MIMIC
            || monsterIsEel(monster.mnum)) {
            suppressSight = true;
        } else {
            ending = ' and vanish';
        }
    }

    const movement = figurineLocomotion(monster.mnum);
    const familiar = withIndefiniteArticle(monsterName(monster, { state, article: 'none', exact: true }));
    const visible = cansee(location.x, location.y);
    if (location.carrier === 'inventory') {
        return blind || suppressSight
            ? formatFeltMessage(`something ${movement} from your pack!`, state)
            : formatSeenMessage(`${familiar} ${movement} out of your pack${ending}!`, state);
    }
    if (location.carrier === 'floor') {
        if (!visible || overdue) return null;
        return suppressSight
            ? `${withIndefiniteArticle(objectCombatName(figurine, { state, includeCorpseSpecies: false }))} suddenly vanishes!`
            : formatSeenMessage(`a figurine transform into ${familiar}${ending}!`, state);
    }
    if (!visible || overdue || suppressSight) return null;
    return formatSeenMessage(`${familiar} ${movement} out of ${
        monsterCarrierDescription(location.monsterCarrier, state)
    }${ending}!`, state);
}

// Part of C apply.c:fig_transform(): the "free figurine now" disposition
// (useup when carried, obj_extract_self + obfree otherwise).
function deleteFigurine(figurine: GameObject, state: GameState) {
    if (figurine.where === 'floor') remove_object(figurine);
    else if (figurine.where === 'minvent') {
        const carrier = monsterCarryingFigurine(figurine, state);
        if (carrier) unlinkMonsterObject(carrier, figurine);
    }
    else {
        const index = (state.inventory || []).indexOf(figurine);
        if (index >= 0) state.inventory.splice(index, 1);
    }
    figurine.where = 'gone';
    figurine.ox = figurine.oy = 0;
}

// Part of C apply.c:fig_transform(): the timer callback up to make_familiar()
// and the presentation message, split so the caller publishes the message
// before the finishing phase frees the figurine.
export async function runClaimedFigurineTimer(
    claimed: DueObjectTimer | null | undefined, state: GameState = game, currentTurn = state.moves ?? 0,
): Promise<FigurineTimerEvent | null> {
    if (!claimed || claimed.timer?.kind !== OBJECT_TIMER_KIND.FIG_TRANSFORM)
        return null;
    const figurine = claimed.object;
    if (!figurine || figurine.otyp !== FIGURINE) return null;
    if (typeof figurine.corpsenm !== 'number')
        throw new TypeError('A figurine transformation requires a monster species.');
    const location = figurineLocation(figurine, state);
    if (!location)
        return scheduleFigurineRetry(
            figurine, figurine.where, currentTurn, state,
        );
    const { carrier } = location;
    const onFloor = carrier === 'floor';

    const position = onFloor ? { x: location.x, y: location.y }
        : enexto(
            figurine.corpsenm, location.x, location.y,
        );
    if (!position || !figurineMayTransformAt(
        figurine, position.x, position.y, state,
    )) {
        return scheduleFigurineRetry(
            figurine, carrier, currentTurn, state,
        );
    }
    const waterMessages: string[] = [];
    const monster = await makeFamiliar(
        figurine, position.x, position.y, true,
        { state, announce: async (message: string) => { waterMessages.push(message); } },
    );
    if (!monster) {
        deleteFigurine(figurine, state);
        return {
            figurine, monster: null, transformed: false,
            finishPending: false, message: null, waterMessages, carrier,
        };
    }

    const overdue = claimed.timer.deadline !== currentTurn;
    const message = await familiarPresentation(
        monster, figurine, { ...location, x: position.x, y: position.y },
        overdue, state,
    );
    const floorVisible = onFloor && cansee(position.x, position.y);
    return {
        figurine, monster,
        transformed: true, finishPending: true, message,
        waterMessages,
        overdue,
        carrier,
        x: onFloor ? location.x : monster.mx,
        y: onFloor ? location.y : monster.my,
        redraw: floorVisible && !overdue,
    };
}

// Part of C apply.c:fig_transform(): the tail of the timer callback, after
// the message: free the figurine and redraw its former location.
export async function finishFigurineTimer<T extends FigurineTimerEvent | null | undefined>(
    event: T, state: GameState = game,
): Promise<T> {
    if (!event?.transformed || !event.finishPending) return event;
    deleteFigurine(event.figurine, state);
    if (event.redraw) await newsym(event.x, event.y);
    event.finishPending = false;
    event.finished = true;
    return event;
}

// C apply.c:fig_transform()
// The whole timer callback: runClaimedFigurineTimer() ports the body up to
// the presentation message, the messages publish here (C pline()/You_see()
// run before the figurine is freed), and finishFigurineTimer() ports the
// free-and-redraw tail.
export async function figTransform(
    claimed: DueObjectTimer | null | undefined, state: GameState = game,
    currentTurn: number = state.moves ?? 0,
    publish: MessagePublisher = plineWithContinuation,
): Promise<FigurineTimerEvent | null | undefined> {
    const event = await runClaimedFigurineTimer(claimed, state, currentTurn);
    for (const message of event?.waterMessages || []) await publish(message);
    if (event?.message) await publish(event.message);
    return await finishFigurineTimer(event, state);
}
// C apply.c:use_figurine()
export async function useFigurine(object: GameObject) {
    requireLiveGame(game);
    if (game.u.uswallow) {
        await pline("You don't have enough room in here.");
        return { spentTime: false, object };
    }
    const direction = await promptDirection();
    if (!direction) {
        // apply.c:use_figurine() returns ECMD_CANCEL after zeroing multi.
        setMulti(0);
        commandResultCancelled();
        return { spentTime: false, object };
    }
    const x = game.u.ux + direction.dx, y = game.u.uy + direction.dy;
    const refusal = figurinePlacementFailure(object, x, y, game);
    if (refusal) {
        await pline(refusal);
        return { spentTime: true, object };
    }
    const placement = direction.dx || direction.dy ? 'set the figurine beside you'
        : Is_airlevel(game.u.uz) || Is_waterlevel(game.u.uz) || isPoolAt(x, y, game)
            ? 'release the figurine' : direction.dz < 0 ? 'toss the figurine into the air'
                : 'set the figurine on the ground';
    await pline(`You ${placement} and it ${heroIsBlind(game) ? 'supposedly ' : ''}transforms.`);
    await makeFamiliar(object, x, y, false);
    stopObjectTimer(object, OBJECT_TIMER_KIND.FIG_TRANSFORM);
    await consumeInventoryItem(object, game);
    if (heroIsBlind(game)) await map_invisible(x, y);
    return { spentTime: true, object: null };
}

// C apply.c:use_grease()
export async function useGrease(can: GameObject): Promise<boolean> {
    if (game.u.glib || (game.u.glibTurns ?? 0) > 0) {
        await dropGrease(can);
        return true;
    }
    if (can.spe <= 0) {
        await pline(`${definiteObjectAction(can, can.known ? 'are' : 'seem')} ${can.known ? '' : 'to be '}empty.`);
        return true;
    }
    if ((can.cursed || propertyIsActive('fumbling', game)) && !rn2(2)) {
        await consumeObjectCharge(can);
        await dropGrease(can);
        return true;
    }
    const selection = await getobj('grease', greaseSuggestion, {
        forcePrompt: true, hands: GETOBJ_SUGGEST, handsText: `your ${fingersOrGloves(false)}`,
    });
    // apply.c:use_grease() returns ECMD_CANCEL when getobj() is declined.
    if (selection.cancelled) { commandResultCancelled(); return false; }
    const target = selection.object;
    if (target) {
        const covering = coveringEquipment(target);
        const outermost = covering[0];
        if (outermost) {
            for (const object of covering) observeObjectForNaming(object);
            observeObjectForNaming(target);
            const names = covering.map((object, index) => index && carriedObjectOwner(object, game) === carriedObjectOwner(outermost, game)
                ? objectName(object, game) : ownedObjectName(object, game, { capitalized: false }));
            await pline(`You need to take off ${names.join(' and ')} to grease ${ownedObjectName(target, game, { capitalized: false })}.`);
            return false;
        }
    }
    await consumeObjectCharge(can);
    const old = game.u.glibTurns ?? 0;
    if (target) {
        if (target.otyp !== CORPSE) observeObjectForNaming(target);
        await pline(`You cover ${ownedObjectName(target, game, { capitalized: false })} with a thick layer of grease.`);
        target.greased = true;
        if (can.cursed && !heroHasNoHands(game)) {
            setSlipperyHands(old + rn1(6, 10));
            await pline(`Some of the grease gets all over your ${fingersOrGloves(true)}.`);
        }
    } else {
        setSlipperyHands(old + rn1(11, 5));
        await pline(`You coat your ${fingersOrGloves(true)} with grease.`);
    }
    return true;
}

// C apply.c:grease_ok()
// The getobj() callback for the grease target.
function greaseSuggestion(object: GameObject): InventoryClassification {
    if (object.oclass === COIN_CLASS) return GETOBJ_EXCLUDE;
    return coveringEquipment(object).length ? GETOBJ_EXCLUDE_INACCESS : GETOBJ_SUGGEST;
}

// Part of C do_wear.c:inaccessible_equipment(): the covering list that
// makes worn gear ungreasable.
function coveringEquipment(object: GameObject): GameObject[] {
    if (!object.owornmask) return [];
    const cloak = game.uarmc, suit = game.uarm, gloves = game.uarmg;
    if (object === suit && cloak) return [cloak];
    if (object === game.uarmu) return [cloak, suit].filter(item => item !== null && item !== undefined);
    if ((object === game.uleft || object === game.uright) && gloves) return [gloves];
    return [];
}


// Part of C apply.c:use_grease(): the can slipping from greasy fingers.
async function dropGrease(can: GameObject) {
    await pline(`${definiteObjectAction(can, 'slip')} from your ${fingersOrGloves(false)}.`);
    await dropInventoryObjectAtHero(can);
}

type StoneFeedback = { message: string } | { scratch: boolean; color: string | null };

const LIQUID = 1, WAX = 2, CLOTH = 6, WOOD = 8;

const SILVER = 14, GOLD = 15, GLASS = 19, GEMSTONE = 20, MINERAL = 21;

const SCRITCH = '"scritch, scritch"';

// C decl.c:c_obj_colors: object streaks use these names, not hallucination colors.
const OBJECT_COLOR_NAMES = [
    'black', 'red', 'green', 'brown', 'blue', 'magenta', 'cyan', 'gray',
    'transparent', 'orange', 'bright green', 'yellow', 'bright blue',
    'bright magenta', 'bright cyan', 'white',
];

// C apply.c:use_stone().
// Also C invent.c:any_obj_ok(): inlined as the unknown-stone GETOBJ_SUGGEST
// chooser callback (dodrop in do.ts inlines the same callback).
export async function useGrayStone(stone: GameObject, { state = game }: { state?: GameState } = {}): Promise<{ spentTime: boolean }> {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (!heroIsBlind(state)) observeObjectForNaming(stone, { state });
    const known = stone.otyp === TOUCHSTONE && stone.dknown && objectTypeKnown(stone, state);
    const plural = (stone.quantity ?? stone.quan ?? 1) > 1;
    const object = await chooseInventoryObject(`rub on the stone${plural ? 's' : ''}`,
        target => known ? touchstoneSuggestion(target, state) : GETOBJ_SUGGEST,
        { forcePrompt: true });
    // apply.c:use_stone() returns ECMD_CANCEL when getobj() is declined.
    if (!object) { commandResultCancelled(state); return { spentTime: false }; }
    const quantity = object.quantity ?? object.quan ?? 1;
    if (object === stone && quantity === 1) {
        await plineWithContinuation(`You can't rub the ${objectName(object, state)} on itself.`);
        return { spentTime: false };
    }

    if (stone.otyp === TOUCHSTONE && stone.cursed && object.oclass === GEM_CLASS
        && !isGrayStone(object) && !objectResistsDestruction(object, 80, 100)) {
        const message = heroIsBlind(state) ? formatFeltMessage('something shatter.', state)
            : heroIsHallucinating(state) ? 'Oh, wow, look at the pretty shards.'
                : `A sharp crack shatters ${quantity > 1 ? 'one of ' : ''}the ${stoneNoun(object, state)}.`;
        await plineWithContinuation(message);
        await consumeInventoryItem(object, state);
        return { spentTime: true };
    }
    if (heroIsBlind(state) || heroIsHallucinating(state)) {
        await plineWithContinuation(heroIsBlind(state) ? SCRITCH : 'Oh wow, man: Fractals!');
        return { spentTime: true };
    }

    const material = objectMaterial(object, state);
    const gemLike = object.oclass === GEM_CLASS
        || object.oclass === RING_CLASS && [GEMSTONE, MINERAL].includes(material);
    if (stone.otyp === TOUCHSTONE && object.oclass === GEM_CLASS
        && (stone.blessed || !stone.cursed
            && (state.urole.key === 'archeologist' || state.urace.name === 'gnome'))) {
        learnObjectType(TOUCHSTONE, state);
        learnObjectType(object.otyp, state);
        observeObjectForNaming(object, { state });
        await plineWithContinuation(`${object.invlet} - ${await inventoryItemDescription(object)}.`);
        return { spentTime: true };
    }
    const result = stoneMarks(stone, object, gemLike, material, state);
    if ('message' in result) {
        await plineWithContinuation(result.message);
    } else {
        const name = `stone${plural ? 's' : ''}`;
        await plineWithContinuation(result.scratch
            ? `You make ${result.color ? result.color + ' ' : ''}scratch marks on the ${name}.`
            : result.color ? formatSeenMessage(`${result.color} streaks on the ${name}.`, state) : SCRITCH);
    }
    return { spentTime: true };
}

// C apply.c:touchstone_ok().
function touchstoneSuggestion(object: GameObject | null, state: GameState): InventoryClassification {
    if (!object) return GETOBJ_EXCLUDE;
    if (object.oclass === COIN_CLASS || object.oclass === GEM_CLASS
        && !(object.dknown && objectTypeKnown(object, state))) return GETOBJ_SUGGEST;
    return GETOBJ_DOWNPLAY;
}

// Part of C apply.c:use_stone(): the rubbed object's name in the shatter
// message.
function stoneNoun(object: GameObject, state: GameState): string {
    const name = objectName(object, state);
    return (object.quantity ?? object.quan ?? 1) > 1 ? makePlural(name) : name;
}

// Part of C apply.c:use_stone(): the material switch producing scratch
// marks and streak colors.
function stoneMarks(
    stone: GameObject, object: GameObject, gemLike: boolean, material: number, state: GameState,
): StoneFeedback {
    const colorIndex = objectTypeColor(object.otyp, state);
    const color = colorIndex === undefined ? null : OBJECT_COLOR_NAMES[colorIndex] ?? null;
    if (gemLike) {
        if (stone.otyp !== TOUCHSTONE) return { scratch: true, color };
        if (material === GLASS) return { scratch: true, color: null };
        return { scratch: false, color };
    }
    const plural = (stone.quantity ?? stone.quan ?? 1) > 1;
    switch (material) {
    case CLOTH:
        return { message: `The ${stoneNoun(stone, state)} look${plural ? '' : 's'} a little more polished now.` };
    case LIQUID:
        return { message: object.known
            ? `The ${stoneNoun(stone, state)} ${plural ? 'are' : 'is'} a little wetter now.`
            : 'You must think this is a wetstone, do you?' };
    case WAX: return { scratch: false, color: 'waxy' };
    case WOOD: return { scratch: false, color: 'wooden' };
    case GOLD: return { scratch: true, color: 'golden' };
    case SILVER: return { scratch: true, color: 'silvery' };
    default: return isFlimsyObject(object, state)
        ? { scratch: false, color } : { scratch: stone.otyp !== TOUCHSTONE, color: null };
    }
}

// C apply.c:reset_trapset().
export function resetTrapSetting(state: GameState = game): void {
    state._trapSetting = null;
}

// C apply.c:use_trap().
export async function useSettableTrap(object: GameObject): Promise<GameObject | null> {
    requirePlayingGame(game);
    const hero = game.u;
    const refusal = trapSettingRefusal();
    if (refusal) {
        await pline(`You can't set a trap ${refusal}!`);
        resetTrapSetting();
        return object;
    }
    const type = object.otyp === LAND_MINE ? LANDMINE : BEAR_TRAP;
    const old = game._trapSetting;
    if (old && old.object === object && old.level === game.level && old.x === hero.ux && old.y === hero.uy) {
        await pline(`You resume setting ${objectOwnershipPrefix(object, game, { capitalized: false })}${trapName(type)}.`);
        game._occupation = { key: 'set-trap', text: 'setting the trap' };
        return null;
    }
    const remaining = trapPreparationTime(type, currentAttribute(A_DEX, game), currentAttribute(A_STR, game), heroIsBlind(game));
    // C use_trap() preserves a pending bungle until reset_trapset().
    const progress = { object, level: game.level, x: hero.ux, y: hero.uy, remaining, forceBungle: old?.forceBungle ?? false };
    game._trapSetting = progress;
    if (hero.usteed && (hero.weaponSkills?.[P_RIDING]?.skill ?? 0) < P_BASIC) {
        const bungle = rnl(10) > (propertyIsActive('fumbling', game) || object.cursed ? 3 : 5);
        await pline(`You aren't very skilled at reaching from ${monsterName(hero.usteed)}.`);
        if (await promptYesNo(`Continue your attempt to set the ${trapName(type)}?`) !== 'y') {
            resetTrapSetting();
            return object;
        }
        if (bungle) {
            if (type === LANDMINE) { progress.remaining = 0; progress.forceBungle = true; }
            else {
                resetTrapSetting();
                await pline(`You drop the ${trapName(type)}!`);
                await dropInventoryObjectAtHero(object);
                return object;
            }
        }
    }
    await pline(`You begin setting ${objectOwnershipPrefix(object, game, { capitalized: false })}${trapName(type)}.`);
    if (object.unpaid) {
        const keeper = findObjectOwner(object, hero.ux, hero.uy, game);
        if (!heroIsDeaf(game) && keeper && !shopkeeperIsMuted(keeper)) await pline('"You set it, you buy it!"');
        await billDummyObject(object);
    }
    game._occupation = { key: 'set-trap', text: 'setting the trap' };
    return null;
}

// C apply.c:set_trap().
export async function continueTrapSetting(state: GameState = game): Promise<boolean> {
    requirePlayingGame(state);
    const progress = state._trapSetting;
    if (!progress || progress.object.where !== 'inventory' || !state.inventory.includes(progress.object)
        || progress.level !== state.level || progress.x !== state.u.ux || progress.y !== state.u.uy) {
        resetTrapSetting(state);
        return false;
    }
    if (--progress.remaining > 0) return true;
    const object = progress.object;
    const type = object.otyp === LAND_MINE ? LANDMINE : BEAR_TRAP;
    const trap = await maketrap(state.u.ux, state.u.uy, type);
    if (trap) {
        trap.madeby_u = true;
        await feelTrap(trap, state);
        if (roomsAt(state.level, trap.tx, trap.ty, SHOPBASE).length) addShopDamage(trap.tx, trap.ty, 0, state);
        if (!progress.forceBungle) await pline(`You finish arming the ${trapName(type)}.`);
        // C evaluates this luck roll before checking force_bungle too.
        const bungle = (object.cursed || propertyIsActive('fumbling', state)) && rnl(10) > 5;
        if (bungle || progress.forceBungle) {
            await dotrap(trap, { forceBungle: progress.forceBungle, gotoLevel, finishTeleport: finishTeleportArrival });
            if (state.program_state.gameover) return false;
        }
    } else await pline('Your trap setting attempt fails.');
    await consumeInventoryItem(object, state);
    resetTrapSetting(state);
    return false;
}

// Part of C apply.c:use_trap(): the Dex/Strength/blindness turn count for
// arming.
function trapPreparationTime(type: number, dexterity: number, strength: number, blind: boolean): number {
    let turns = 5;
    if (dexterity > 17) turns = 2;
    else if (dexterity > 12) turns = 3;
    else if (dexterity > 7) turns = 4;
    if (blind) turns *= 2;
    if (type !== BEAR_TRAP || strength >= 18) return turns;
    if (strength > 12) return turns + 1;
    return turns + (strength > 7 ? 2 : 4);
}

// Part of C apply.c:use_trap(): the "can't set a trap" refusal reasons.
function trapSettingRefusal(): string | null {
    requirePlayingGame(game);
    const hero = game.u, level = game.level;
    const location = level.requireAt(hero.ux, hero.uy);
    if (heroHasNoHands(game)) return 'without hands';
    if (hero.stunned || (hero.stunnedTurns ?? 0) > 0) return 'while stunned';
    if (hero.uswallow) return hero.ustuck && monsterDigests(hero.ustuck) ? 'while swallowed' : 'while engulfed';
    if (hero.uinwater || game.underwater) return 'underwater';
    if (propertyIsActive('levitation', game)) return 'while levitating';
    if (isPoolAt(hero.ux, hero.uy)) return 'in water';
    if (isLavaAt(hero.ux, hero.uy)) return 'in lava';
    if (heroIsOnStairs(game)) {
        for (let stair = game.stairs; stair; stair = stair.next)
            if (stair.sx === hero.ux && stair.sy === hero.uy) return stair.isladder ? 'on the ladder' : 'on the stairs';
        return 'on the stairs';
    }
    if (IS_FURNITURE(location.typ) || IS_OBSTRUCTED(location.typ)
        || location.typ === DOOR && (location.doormask & (D_CLOSED | D_LOCKED))
        || level.traps.some(trap => trap.tx === hero.ux && trap.ty === hero.uy)) return 'here';
    if (Is_airlevel(hero.uz) || Is_waterlevel(hero.uz)) {
        if (location.typ === AIR) return 'in midair';
        return location.typ === CLOUD ? 'in a cloud' : 'in this place';
    }
    return null;
}

// C apply.c:use_whip().
export async function useWhip(
    whip: GameObject, { state = game }: { state?: GameState } = {},
): Promise<{ spentTime: boolean }> {
    const hero = state.u;
    // C apply.c:2964-2971: wield_tool() installs the whip first and queues
    // dorub-style continuation: doapply plus the whip's inventory letter.
    const wielded = await wieldTool(
        whip,
        'lash',
        { swapWeapons: doswapweapon },
        state,
    );
    if (!wielded.ready) return { spentTime: false };
    if (wielded.newlyWielded) {
        cmdq_add_ec(CQ_CANNED, 'doapply');
        cmdq_add_key(CQ_CANNED, inventoryCommandLetter(whip).charCodeAt(0));
        return { spentTime: true };
    }
    // C apply.c:2972: getdir(); a refusal reports ECMD_CANCEL and the
    // rhack seam clears both command queues for it.
    const direction = await promptDirection();
    if (!direction) {
        commandResultCancelled();
        return { spentTime: false };
    }
    game._pending_message = '';
    hero.dx = direction.dx;
    hero.dy = direction.dy;
    hero.dz = direction.dz;

    let targetX: number;
    let targetY: number;
    let monster: Monster | null;
    if (hero.uswallow && hero.ustuck) {
        monster = hero.ustuck;
        targetX = monster.mx;
        targetY = monster.my;
    } else {
        // C apply.c:2980: confdir(FALSE) — cmd.ts confusePromptDirection()
        // is its port; getdir() already ran one confdir for a non-vertical
        // answer, and use_whip() applies a second one here.
        confusePromptDirection(hero);
        targetX = hero.ux + hero.dx;
        targetY = hero.uy + hero.dy;
        if (!isok(targetX, targetY)) {
            await pline('You miss.');
            return { spentTime: false };
        }
        monster = monsterAt(targetX, targetY, state);
    }

    // C apply.c:2990-3003: fake some proficiency checks.
    let proficiency = state.urole?.key === 'archeologist' ? 1 : 0;
    const dexterity = currentAttribute(A_DEX, state);
    if (dexterity < 6) proficiency--;
    else if (dexterity >= 14) proficiency += dexterity - 14;
    if (propertyIsActive('fumbling', state)) proficiency--;
    if (proficiency > 3) proficiency = 3;
    if (proficiency < 0) proficiency = 0;

    // C apply.c:3127's whipattack label: the pit branch reaches it by goto
    // when it has no anchor but a monster to strike; the flag carries that
    // monster so the strike block stays narrowed.
    let whipAttack: Monster | null = null;
    const targetLocation = state.level?.at(targetX, targetY);
    if (hero.uswallow) {
        await pline('There is not enough room to flick your bullwhip.');
    } else if (state.underwater || hero.uinwater) {
        await pline('There is too much resistance to flick your bullwhip.');
    } else if (hero.dz < 0) {
        await pline(`You flick a bug off of the ${
            ceilingName(state.u.ux, state.u.uy, state)
        }.`);
    } else if (!hero.dz && targetLocation && (IS_WATERWALL(targetLocation.typ)
        || targetLocation.typ === LAVAWALL)) {
        await pline('You cause a small splash.');
        if (targetLocation.typ === LAVAWALL)
            await fireDamageObject(whip, {
                state, x: targetX, y: targetY, publish: pline,
            });
        return { spentTime: true };
    } else if ((!hero.dx && !hero.dy) || hero.dz > 0) {
        // C apply.c:3023-3028: sometimes you hit your steed by mistake.
        if (hero.usteed && rn2(proficiency + 2) === 0) {
            await pline(`You whip ${monsterName(hero.usteed, { state })}!`);
            await strikeSteed({ state, announce: pline });
            return { spentTime: true };
        }
        if (isPoolOrLavaAt(hero.ux, hero.uy, state)
            || (targetLocation && (IS_WATERWALL(targetLocation.typ)
                || targetLocation.typ === LAVAWALL))) {
            await pline('You cause a small splash.');
            if (isLavaAt(hero.ux, hero.uy, state)) {
                await fireDamageObject(whip, {
                    state, x: hero.ux, y: hero.uy, publish: pline,
                });
            }
            return { spentTime: true };
        }
        // C apply.c:3037-3056: a flyer can reach the floor, so have a shot
        // at snaring something there (Levitation || u.usteed || Flying).
        if (!!(hero.levitating || hero.levitation || state.levitating
            || hero.flying || state.flying) || hero.usteed) {
            const pile = state.level?.objects?.[hero.ux]?.[hero.uy] || [];
            const floorObject = pile[0];
            // C apply.c:3042-3048: PM_HORSE plus its little_to_big (warhorse)
            // and big_to_little (pony) neighbors.
            if (floorObject?.otyp === CORPSE) {
                if (floorObject.corpsenm === undefined)
                    throw new Error('A corpse requires a monster species.');
                const species = monsterTypeName(floorObject.corpsenm).toLowerCase();
                if (species === 'pony' || species === 'horse' || species === 'warhorse') {
                    await pline('Why beat a dead horse?');
                    return { spentTime: true };
                }
            }
            if (floorObject && proficiency) {
                observeObjectForNaming(floorObject, { state });
                // C apply.c:3050 wraps an(singular(otmp, xname)): one item
                // from a stack, "a +0 dagger", never the stack count.
                await pline(
                    `You wrap your bullwhip around ${
                        withIndefiniteArticle(singularObjectName(floorObject, state))} on the ${
                        surfaceName(hero.ux, hero.uy, state)}.`,
                );
                if (rnl(6) !== 0
                    || !await pickupFloorObject(floorObject, 1, true))
                    await pline('The bullwhip slips free.');
                return { spentTime: true };
            }
        }
        // C apply.c:3057-3063: hit your own foot.
        let damage = rnd(2)
            + heroStrengthDamageBonus(state)
            + (whip.spe ?? whip.enchantment ?? 0);
        damage = Math.max(1, damage);
        if (hero.halfPhysicalDamage)
            damage = Math.trunc((damage + 1) / 2);
        await pline(`You hit your ${body_part(FOOT, state)} with your bullwhip.`);
        const female = !!state.flags.female;
        const reflexive = female ? 'herself' : 'himself';
        const possessivePronoun = female ? 'her' : 'his';
        await loseHeroHp(damage,
            `killed ${reflexive} with ${possessivePronoun} bullwhip`,
            { state, publish: pline, killerFormat: NO_KILLER_PREFIX });
        return { spentTime: true };
    } else if ((propertyIsActive('fumbling', state) || heroHasSlipperyHands(state))
        && rn2(5) === 0) {
        await pline(`The bullwhip slips out of your ${body_part(HAND, state)}.`);
        await dropInventoryObjectAtHero(whip, { state });
    } else if (hero.utrap && hero.utraptype === TT_PIT) {
        // C apply.c:3089-3091: boulder beats furniture because it sits on
        // top of it.
        const pile = state.level?.objects?.[targetX]?.[targetY] || [];
        let anchor = pile.some(object => object.otyp === BOULDER)
            ? 'a boulder'
            : targetLocation && IS_FURNITURE(targetLocation.typ)
                ? 'something' : null;
        if (monster && monsterIsBig(monster.mnum)
            && canSpotMonster(monster)) anchor = monsterName(monster, { state });
        if (monster && !anchor) {
            whipAttack = monster; // C apply.c:3101-3102: goto whipattack.
        } else if (anchor) {
            await pline(`You wrap your bullwhip around ${anchor}.`);
            if (proficiency > 0 && rn2(proficiency + 2) !== 0) {
                // C apply.c:3111: enexto() only runs when a monster holds
                // the anchor square; failure leaves nothing to yank to.
                const destination = monster
                    ? enexto(heroSpecies(state), targetX, targetY, { state })
                    : { x: targetX, y: targetY };
                if (destination) {
                    await pline('You yank yourself out of the pit!');
                    // C apply.c:3113-3115: reset_utrap(TRUE) runs before
                    // teleds() in case it has no alternative other than to
                    // put the hero in another trap.
                    await resetUtrap(true, state);
                    const { arrival } = await teleds(
                        destination.x, destination.y, state, {
                            allowDrag: true,
                            finishArrival: async movement => {
                                await newsym(movement.oldx, movement.oldy);
                                vision_reset();
                                await vision_recalc(0);
                                return finishDestinationSpotEffects({
                                    oldx: movement.oldx, oldy: movement.oldy,
                                    newx: movement.x, newy: movement.y,
                                });
                            },
                        },
                    );
                    if (!arrival.died) state.vision_full_recalc = 1;
                }
            } else {
                await pline('The bullwhip slips free.');
            }
            if (monster) await wakeAttackedMonster(monster);
        } else {
            await pline('Snap!');
        }
    } else if (monster) {
        whipAttack = monster;
    } else if (Is_airlevel(hero.uz) || Is_waterlevel(hero.uz)) {
        // it must be air -- water checked above
        await pline('You snap your whip through thin air.');
    } else {
        await pline('Snap!');
    }

    if (whipAttack) {
        const monster = whipAttack;
        // C apply.c:3129: if the monster is unseen, can't attempt to disarm.
        let weapon: GameObject | null = null;
        const spottedBefore = canSpotMonster(monster);
        if (!spottedBefore) {
            // bring non-mimic hider out of hiding, then check visibility
            // again in case being brought out of hiding has exposed it.
            monster.mundetected = 0;
            const spottedNow = canSpotMonster(monster);
            const alreadyMarked = state.level?.at?.(targetX, targetY)
                ?.remembered_glyph?.kind === 'invisible';
            if (spottedNow || !alreadyMarked) {
                // C apply.c:3139 names a now-spotted target with Amonnam():
                // the capitalized form of a_monnam(), so "An acid blob".
                const name = spottedNow
                    ? monsterName(monster, { article: 'a', capitalized: true, state })
                    : 'A monster';
                await pline(`${name} is there that you ${
                    heroIsBlind(state) ? "hadn't noticed" : "couldn't see"}.`);
                if (spottedNow) await newsym(targetX, targetY);
                else await map_invisible(targetX, targetY);
            }
        } else {
            weapon = monsterWieldedWeapon(monster) ?? null;
        }

        if (weapon) {
            // C apply.c:3156: a fumbling hero keeps hold only on !rn2(10).
            let gotWeapon = proficiency > 0
                && (!propertyIsActive('fumbling', state) || rn2(10) === 0);
            const hand = mbodypart(monster.mnum, HAND);
            const hands = isBimanualObject(weapon) ? makePlural(hand) : hand;
            // C apply.c:3158: onambuf = cxname(otmp), captured before any
            // message can change the weapon's knowledge flags.
            const weaponName = objectCombatName(weapon, { state });
            // C apply.c:3166: yname(otmp) — shk_your() prefixes the
            // carrier's name and cxname() carries no beatitude or
            // enchantment.
            await pline(`You wrap your bullwhip around ${
                ownedObjectName(weapon, state, { capitalized: false })}.`);

            if (gotWeapon && weapon.cursed) {
                const wasKnown = !!weapon.bknown;
                weapon.bknown = true;
                const subject = objectQuantity(weapon) === 1 ? 'It is' : 'They are';
                // C apply.c:3168-3170: mhis(mtmp) is the monster's pronoun,
                // not its name with a possessive suffix.
                await pline(`${subject} welded to ${
                    monsterPossessive(monster, { state })} ${hands}${
                    wasKnown ? '.' : '!'}`);
                gotWeapon = false; // can't pull it free
            }
            if (gotWeapon) {
                // C apply.c:3175-3177: obj_extract_self() +
                // possibly_unwield() + setmnotwielded() — a raw unlink
                // plus wield-slot clearing, NOT the worn-item unwear owner
                // (no trap/saddle/extrinsic work, and no crysknife
                // release: the monster's held blade is extracted exactly
                // as it is).  possibly_unwield()'s not-in-inventory branch
                // collapses into the same wield-slot clear because the
                // extraction just ran.
                unlinkMonsterObject(monster, weapon);
                await unwieldMonsterWeapon(monster, state, { weapon, publish: pline });
                switch (rn2(proficiency + 1)) {
                case 2:
                    // to floor near you; C apply.c:3182: yname() again; the
                    // extracted weapon is free, so shk_your() reduces to
                    // "the" and cxname() still shows no BUC.
                    await pline(`You yank ${
                        ownedObjectName(weapon, state, { capitalized: false })} to the ${
                        surfaceName(hero.ux, hero.uy, state)}!`);
                    await placeObject(weapon, hero.ux, hero.uy);
                    await stack_object(weapon, state);
                    break;
                case 3: {
                    // right into your inventory; C apply.c:3209: yname()
                    // for the snatch message as well.
                    await pline(`You snatch ${
                        ownedObjectName(weapon, state, { capitalized: false })}!`);
                    // C apply.c:3210-3229: a snatched corpse is named by
                    // cxname() before it moves, and that name is also the
                    // death reason; a life-saved hero frees the corpse
                    // again from the floor it was placed on for death
                    // cleanup.
                    if (handlesPetrifyingCorpseBareHanded(weapon)) {
                        const name = corpseName(weapon);
                        const corpse = objectQuantity(weapon) === 1
                            ? withIndefiniteArticle(name) : name;
                        const petrification = await petrifyFromCorpseContact(
                            `Snatching ${corpse} is a fatal mistake.`, corpse,
                            async () => {
                                await placeObject(weapon, hero.ux, hero.uy);
                            },
                        );
                        if (petrification) {
                            if (petrification.died) return { spentTime: true };
                            remove_object(weapon);
                        }
                    }
                    // C apply.c:3230: hold_another_object() owns fumbling,
                    // slot, and capacity refusal, dropping the weapon at
                    // the hero's feet.  A fatal artifact blast ends the
                    // game there (artifact.c:958), before use_whip()'s
                    // trailing wakeup().
                    if ((await holdAnotherObject(weapon, {
                        state,
                        dropMessage: `You drop ${await inventoryItemDescription(weapon)}!`,
                    })).heroDied) return { spentTime: true };
                    break;
                }
                default:
                    // to floor beneath mon; C apply.c:3235-3236: the
                    // (onambuf) + s_suffix(mon_nam(mtmp)).
                    await pline(`You yank ${definiteName(weaponName, state)} from ${
                        possessiveName(monsterName(monster, { state }))} ${hands}!`);
                    // C apply.c:3237-3238: obj_no_longer_held() runs before
                    // place_object(); the release repeats inside the
                    // placement owner by design — a fixed crysknife can
                    // survive the first release and revert on the second.
                    // Do not deduplicate this source-owned repetition.
                    await objectNoLongerHeld(weapon, state);
                    await placeObject(weapon, monster.mx, monster.my);
                    await stack_object(weapon, state);
                    break;
                }
            } else {
                await pline('The bullwhip slips free.');
            }
        } else {
            // mtmp isn't wielding a weapon; attack it.  C apply.c:3248:
            // use_whip() stumbles onto an unsensed mimic instead of
            // clearing its disguise silently; sensed mimics just get
            // flicked.
            let snap = true;
            if (monster.m_ap_type
                && !state.u?.protectionFromShapeChangers
                && !state.protectionFromShapeChangers
                && !canSenseMonster(monster)) {
                await stumbleOntoMimic(monster, state);
                snap = false;
            } else {
                await pline(`You flick your bullwhip towards ${monsterName(monster, { state })}.`);
            }
            // C apply.c:3255 reaches do_attack() through uhitm.c
            // force_attack(): anything that is not a pet is struck with
            // forcefight forced on, while a pet keeps do_attack()'s
            // safepet displacement block.  force_attack() answers C's
            // boolean: a declined attack stopped the monster, so the whip
            // does not snap.
            if (proficiency > 0) {
                const safeMonster = !!monster.mtame && !game.context.forcefight
                    && heroMayDisplaceMonster(monster);
                const savedForcefight = game.context.forcefight ?? false;
                if (!monster.mtame) game.context.forcefight = true;
                try {
                    if ((await do_attack(monster, targetX, targetY, { safeMonster })) !== false)
                        return { spentTime: true };
                } finally {
                    game.context.forcefight = savedForcefight;
                }
            }
            if (snap) await pline('Snap!');
        }
        // C apply.c:3261: regardless of mtmp's weapon or hero's proficiency.
        await wakeAttackedMonster(monster);
    }
    return { spentTime: true };
}

export type PolearmResult =
    | { heroDied: true }
    | {
          spentTime: boolean;
          resume?: true;
          cancelled?: true;
          failure?: true;
      };

interface PolearmOptions {
    state?: GameState;
    ensureWielded?: () => Promise<{ ready: boolean; newlyWielded?: boolean }>;
    autohit?: boolean;
}

// C apply.c:glyph_is_poleable()
function poleableGlyph(glyph: GlyphMetadata | null) {
    return glyph?.kind === 'monster' || glyph?.kind === 'invisible' || statueGlyph(glyph);
}

// Part of C display.h:glyph_is_statue(): the screen-memory form use_pole()
// and find_poleable_mon() test (a remembered GlyphMetadata flag, not a
// glyph number; glyph_numbers.ts glyphIsStatue() is the numeric macro).
function statueGlyph(glyph: GlyphMetadata | null) {
    return glyph?.kind === 'object' && !!glyph.statueGlyph;
}

// Part of C apply.c:use_pole(): the sobj_at() pile scan behind a drawn
// statue or boulder glyph.
function floorHasObject(otyp: number, x: number, y: number, state: GameState) {
    // C sobj_at(): any matching object in the pile, not just the drawn top.
    return (state.level?.objects?.[x]?.[y] || []).some((object) => object.otyp === otyp);
}

// Part of C rm.h:m_at(): the polearm targeting read, guarding a level that
// may not exist yet (steed.ts monsterAtPosition() resolves the occupant).
function monsterAt(x: number, y: number, state: GameState) {
    return state.level ? monsterAtPosition(state.level, x, y) : null;
}

// Part of C apply.c:find_poleable_mon(): the Confusion/Stunned/
// Hallucination flag that relaxes polearm targeting.
function heroIsImpaired(state: GameState) {
    const confused = !!state.u?.confused || (state.u?.confusionTurns ?? 0) > 0;
    const stunned = !!state.u?.stunned || (state.u?.stunnedTurns ?? 0) > 0;
    return confused || stunned || heroIsHallucinating(state);
}

// C apply.c:calc_pole_range() reads the hero's skill through weapon.c
// uwep_skill_type() (weapon.js uwepSkillType): dual wielding uses the
// two-weapon skill and otherwise the wielded item's own class, so
// Snickersnee (a katana) measures reach with sword skill, not polearm skill.

// C apply.c:calc_pole_range()
function calcPoleRange(weapon: GameObject, { state = game } = {}) {
    const skillType = uwepSkillType(weapon, state);
    const level = skillType === 0 ? 0 : (ensureHeroSkills(state)?.[skillType]?.skill ?? 0);
    let max = 4;
    if (!(skillType === 0 || level <= P_BASIC)) max = level === P_SKILLED ? 5 : 8;
    return { min: 4, max };
}

// C apply.c:get_valid_polearm_position()
function validPolearmPosition(x: number, y: number, min: number, max: number, state: GameState) {
    if (!isok(x, y)) return false;
    const distance = distu(x, y, state);
    return (
        distance >= min &&
        distance <= max &&
        (cansee(x, y) || (couldsee(x, y) && poleableGlyph(glyphAt(x, y, state))))
    );
}

// C apply.c:find_poleable_mon()
// The single auto-target candidate, if any.
// More than one candidate leaves the cursor on the hero, like C returning
// FALSE without touching the out parameter.
function findPoleableSpot(state: GameState, min: number, max: number) {
    const impaired = heroIsImpaired(state);
    const reach = Math.floor(Math.sqrt(max));
    const loX = Math.max(state.u.ux - reach, 1);
    const hiX = Math.min(state.u.ux + reach, COLNO - 1);
    const loY = Math.max(state.u.uy - reach, 0);
    const hiY = Math.min(state.u.uy + reach, ROWNO - 1);
    let spot: Position | null = null;

    for (let x = loX; x <= hiX; x++) {
        for (let y = loY; y <= hiY; y++) {
            if (!validPolearmPosition(x, y, min, max, state)) continue;
            const glyph = glyphAt(x, y, state);
            if (!impaired && glyph?.kind === 'monster') {
                const monster = monsterAt(x, y, state);
                if (
                    monster &&
                    (monster.mtame || (monster.mpeaceful && state.flags?.confirm !== false))
                )
                    continue;
            }
            if (poleableGlyph(glyph) && (!statueGlyph(glyph) || impaired)) {
                if (spot) return null;
                spot = { x, y };
            }
        }
    }
    return spot;
}

// Part of C apply.c:use_pole(), apply.c:could_pole_mon(): reading the
// remembered polearm target from context.polearm.
function rememberedPolearmMonster(state: GameState) {
    const id = state.context?.polearm?.hitmonId;
    if (id === null || id === undefined) return null;
    return (
        (state.level?.monsters || []).find(
            (monster) => monster.m_id === id && !monster.dead && (monster.mhp ?? 1) > 0,
        ) || null
    );
}

// Part of C apply.c:use_pole(): setting the remembered polearm target in
// context.polearm.
function rememberPolearmTarget(monster: Monster | null, state: GameState) {
    if (!state.context.polearm) state.context.polearm = { hitmonId: null };
    state.context.polearm.hitmonId = monster ? monster.m_id : null;
}

// C apply.c:could_pole_mon()
// The dofire fireassist predicate.
export function couldPoleMonster(weapon: GameObject | null | undefined, { state = game } = {}) {
    if (!weapon || !isPolearm(weapon)) return false;
    const { min, max } = calcPoleRange(weapon, { state });
    if (findPoleableSpot(state, min, max)) return true;
    const remembered = rememberedPolearmMonster(state);
    if (!remembered || !canSenseMonster(remembered)) return false;
    const distance = distu(remembered.mx, remembered.my, state);
    return distance <= max && distance >= min;
}

// C obj.h u_wield_art(ART_SNICKERSNEE): the artifact id lookup
// snickersnee_used_dist_attk() and use_pole() share.
function isArtifactSnickersnee(object: GameObject | null | undefined): boolean {
    return artifactById(object?.oartifact)?.name === 'Snickersnee';
}

// C apply.c:snickersnee_used_dist_attk()
// Was Snickersnee used to attack at distance this turn already?
function snickersneeUsedDistanceAttack(object: GameObject | null | undefined, state: GameState): boolean {
    return !!object
        && object === (state.uwep || state.u?.uwep)
        && isArtifactSnickersnee(object)
        && state.context?.snickersneeTurn === (state.moves ?? 0);
}

// Part of C apply.c:use_pole(): the obstacle wording of the
// "uselessly attack" message.
// C words the obstacle with the displayed cmap glyph's defsyms
// explanation; glyphAt() carries that as terrainName.
function obstacleDescription(glyph: GlyphMetadata | null, x: number, y: number, state: GameState) {
    const typ = state.level?.at(x, y)?.typ;
    if (typ === STONE || typ === SCORR) return 'stone';
    if (glyph?.kind === 'terrain' && glyph.terrainName) return `the ${glyph.terrainName}`;
    return 'an unknown obstacle';
}

// C apply.c:display_polearm_positions(): the S_goodpos highlights over the
// reachable spots, rendered while the cursor selects the strike.
async function choosePolearmTarget(
    start: Position,
    state: GameState,
    min: number,
    max: number,
) {
    await syncPline('Where do you want to hit?');
    const valid = (x: number, y: number) => validPolearmPosition(x, y, min, max, state);
    await prepareMapPositionHighlights(valid);
    const firstUse = shouldShowGetposTip(state);
    if (firstUse) await showGetposTip(state);
    await showGetposInstructions(state);
    if (firstUse) await syncPline('Move cursor to the spot to hit:');

    return selectMapPosition({
        start,
        prompt: state._pending_message,
        goal: 'the spot to hit',
        isValidLocation: valid,
    });
}

// C apply.c:use_pole()
// Also C apply.c:snickersnee_used_dist_attk(): inlined here.
export async function usePolearm(
    object: GameObject,
    { state = game, ensureWielded, autohit = false }: PolearmOptions = {},
): Promise<PolearmResult> {
    if (state.u?.uswallow || state.uswallow) {
        await syncPline("There's not enough room here to use that.");
        return { spentTime: false };
    }

    const wielded = ensureWielded
        ? await ensureWielded()
        : {
              ready: state.uwep === object || state.u.uwep === object,
              newlyWielded: false,
          };
    if (!wielded?.ready) return { spentTime: false };
    if (wielded.newlyWielded) return { spentTime: true, resume: true };

    const { min, max } = calcPoleRange(object, { state });

    // Auto-target: the sole candidate monster, else the remembered target.
    let cc = { x: state.u.ux, y: state.u.uy };
    const unique = findPoleableSpot(state, min, max);
    if (unique) cc = unique;
    else {
        const remembered = rememberedPolearmMonster(state);
        if (remembered && canSenseMonster(remembered)) {
            const distance = distu(remembered.mx, remembered.my, state);
            if (distance <= max && distance >= min) cc = { x: remembered.mx, y: remembered.my };
        }
    }

    if (!autohit) {
        const target = await choosePolearmTarget(cc, state, min, max);
        if (!target) return { spentTime: false, cancelled: true };
        cc = target;
    }

    const glyph = glyphAt(cc.x, cc.y, state);
    const distance = distu(cc.x, cc.y, state);
    if (distance > max) {
        await syncPline('Too far!');
        return { spentTime: false, failure: true };
    }
    if (distance < min) {
        if (autohit && cc.x === state.u.ux && cc.y === state.u.uy)
            await syncPline("Don't know what to hit.");
        else await syncPline('Too close!');
        return { spentTime: false, failure: true };
    }
    if (!cansee(cc.x, cc.y) && !poleableGlyph(glyph)) {
        await syncPline("You won't hit anything if you can't see that spot.");
        return { spentTime: false, failure: true };
    }
    if (!couldsee(cc.x, cc.y)) {
        await syncPline("You can't reach that spot from here.");
        return { spentTime: false, failure: true };
    }

    rememberPolearmTarget(null, state);
    state.bhitpos = { x: cc.x, y: cc.y };
    const monster = monsterAt(cc.x, cc.y, state);
    let freehit = false;

    if (monster) {
        // C attack_checks(): a declined attack or a hidden-monster reveal
        // aborts without reaching thitmonst(). C gb.bhitpos is cc.
        const verdict = await prepareAppliedWeaponAttack(
            monster, object, { state, struckAt: cc });
        if (!verdict.proceed) return { spentTime: verdict.spentTime };
        if (await checkHeroAttackOverexertion()) return { spentTime: true };
        rememberPolearmTarget(monster, state);

        // C apply.c:snickersnee_used_dist_attk(): the wielded Snickersnee
        // already spent its distant strike this turn.
        if (snickersneeUsedDistanceAttack(object, state)) {
            await syncPline("The blade doesn't reach there!");
            return { spentTime: false, failure: true };
        }

        // C charges check_caitiff() before recording the Snickersnee free
        // strike; the shared applied-weapon attack must not repeat it.
        await applyCaitiffPenalty(monster, state);

        if (isArtifactSnickersnee(object)) {
            const previous = state.context?.snickersneeTurn ?? -1;
            freehit = previous !== (state.moves ?? 0);
            state.context.snickersneeTurn = state.moves;
            if (freehit && !heroIsDeaf(state)) await syncPline('Shkinng!');
        }

        state.notonhead = cc.x !== monster.mx || cc.y !== monster.my;
        const hit = await hitMonsterWithAppliedWeapon(monster, object, {
            state,
            checkCaitiff: false,
            target: cc,
        });
        if (hit.heroDied) return hit;
    } else if (statueGlyph(glyph) && floorHasObject(STATUE, cc.x, cc.y, state)) {
        const trapAt = (state.level?.traps || []).some(
            (trap) => trap.tx === cc.x && trap.ty === cc.y && trap.ttyp === STATUE_TRAP,
        );
        // trap.c activate_statue_trap() reports success as the released
        // monster pointer; use_pole() tests only that pointer.
        const activated = trapAt ? !!await activateStatueTrapAt(cc.x, cc.y, { state }) : false;
        if (!activated) {
            await syncPline('Thump!  Your blow bounces harmlessly off the statue.');
            await wakeMonstersNearWithMessages(cc.x, cc.y, 25, state);
        }
    } else {
        await unmap_invisible(cc.x, cc.y);

        if (
            glyph?.kind === 'object' &&
            glyph.otyp === BOULDER &&
            floorHasObject(BOULDER, cc.x, cc.y, state)
        ) {
            await syncPline('Thump!  Your blow bounces harmlessly off the boulder.');
            await wakeMonstersNearWithMessages(cc.x, cc.y, 25, state);
        } else {
            const location = state.level?.at(cc.x, cc.y);
            // apply.c:use_pole() tests accessible(), whose closed_door()
            // half rejects closed doors that the typ-only ACCESSIBLE
            // macro would admit.
            if (!location || !isAccessibleAt(cc.x, cc.y, state) || IS_FURNITURE(location.typ)) {
                await syncPline(
                    `You uselessly attack ${obstacleDescription(glyph, cc.x, cc.y, state)}.`,
                );
            } else {
                await syncPline('You miss; there is no one there to hit.');
            }
        }
    }

    wipeHeroEngraving(2, state);
    return { spentTime: !freehit };
}


// Part of C apply.c:doapply(): the PICK_AXE case, wiring the dig.c
// use_pick_axe() port to the apply dispatch.
async function applyPickAxe(item: GameObject): Promise<void> {
    const result = await usePickAxe(item, {
        state: game,
        readDirection: (prompt: string) => promptDirection(`${prompt} `),
        ensureWielded: () => wieldTool(
            item, 'swing', { swapWeapons: doswapweapon }, game,
        ),
        payShopkeeper: dopay,
        attackMonster: (monster, struckAt, permission) => do_attack(
            monster, struckAt.x, struckAt.y, { permission },
        ),
    });
    if ('died' in result && result.died) return;
    if (result.cancelled) commandResultCancelled(); // dig.c:use_pick_axe() res|ECMD_CANCEL.
    if ('resume' in result && result.resume) {
        // C dig.c:1104-1105 queues doapply plus the tool's letter; the
        // next turn's apply pops the letter from CQ_CANNED.
        cmdq_add_ec(CQ_CANNED, 'doapply');
        cmdq_add_key(CQ_CANNED, inventoryCommandLetter(item).charCodeAt(0));
    }
    game.context.move = 'spentTime' in result && result.spentTime ? 1 : 0;
}

// Part of C apply.c:doapply(): the polearm case wiring use_pole() to the
// apply dispatch.
export async function applyPolearm(item: GameObject, autohit = false): Promise<void> {
    const result = await usePolearm(item, {
        state: game,
        autohit,
        ensureWielded: () => wieldTool(
            item, 'swing', { swapWeapons: doswapweapon }, game,
        ),
    });
    if ('heroDied' in result && result.heroDied) return;
    if ('resume' in result && result.resume) {
        // C apply.c:3441-3443 queues doapply plus the pole's letter; the
        // next turn's apply pops the letter from CQ_CANNED.
        cmdq_add_ec(CQ_CANNED, 'doapply');
        cmdq_add_key(CQ_CANNED, inventoryCommandLetter(item).charCodeAt(0));
    }
    // use_pole() returns ECMD_CANCEL for a refused target prompt and
    // ECMD_FAIL for an out-of-range or unseen one (apply.c:3474-3505).
    if ('cancelled' in result && result.cancelled) commandResultCancelled();
    if ('failure' in result && result.failure) commandResultFailed();
    game.context.move = 'spentTime' in result && result.spentTime ? 1 : 0;
}

// Part of C apply.c:use_cream_pie(): splitting one pie from the stack.
function splitOnePie(stack: GameObject) {
    const quantity = stack.quan ?? stack.quantity ?? 1;
    if (quantity <= 1) return { pie: stack, several: false };

    const pie = splitObjectStack(stack, 1, game);
    if (!pie) throw new Error('A stack of cream pies must yield one pie.');
    return { pie, several: true };
}

// Part of C apply.c:use_cream_pie(): disposing of the used pie
// (setnotworn + useup).
async function deletePie(pie: GameObject) {
    // C apply.c:use_cream_pie() clears the wield slot via setnotworn(),
    // which does not arm the "begin bashing" bare-hands notice.
    await setnotworn(pie, game);
    await chargeAlteredUnpaidObject(pie, 'splatter');
    unlinkObject(pie, game);
    await delobj(pie, game);
}

// C apply.c:use_cream_pie()
export async function useCreamPie(stack: GameObject | null | undefined) {
    if (stack?.otyp !== CREAM_PIE) return false;
    const wasBlind = heroIsBlind(game);
    const wasCreamed = (game.u?.ucreamed ?? 0) > 0;
    const { pie, several } = splitOnePie(stack);
    const hallucinating = heroIsHallucinating(game);

    if (hallucinating) {
        await syncPline('You give yourself a facial.');
    } else {
        observeObjectForNaming(pie);
        const name = definiteName(objectName(pie));
        const target = several ? `one of ${makePlural(name)}` : name;
        await syncPline(`You immerse your ${body_part(FACE)} in ${target}.`);
    }

    if (canBlnd(null, { youmonst: true }, AT_WEAP, pie, game)) {
        const blindIncrement = rnd(25);
        game.u.ucreamed = (game.u.ucreamed ?? 0) + blindIncrement;
        await makeBlinded((game.u.blindTurns ?? 0) + blindIncrement, { talk: false });
        const blind = heroIsBlind(game);
        if (!blind || wasBlind) {
            await plineWithContinuation(
                `There's ${wasCreamed ? 'more ' : ''}sticky goop all over your ${body_part(FACE)}.`,
            );
        } else {
            await plineWithContinuation(
                `You can't see through all the sticky goop on your ${body_part(FACE)}.`,
            );
        }
    }

    await deletePie(pie);
    return true;
}

interface JellyUse {
    jelly: GameObject;
    parent: GameObject | null;
}

const PM_KILLER_BEE = 1;

const PM_QUEEN_BEE = 5;

// Part of C apply.c:use_royal_jelly(): split off one lump (splitobj ->
// splitbill), then freeinv() it so the egg prompt cannot offer it.
// C use_royal_jelly(): split off one lump (splitobj -> splitbill), then
// freeinv() it so the egg prompt cannot offer it.
async function takeOneJelly(stack: GameObject): Promise<JellyUse> {
    if (!game.inventory.includes(stack)) throw new Error('Royal jelly must be carried before applying it.');
    const parent = stack.quan === 1 ? null : stack;
    const jelly = parent ? splitObjectStack(parent, 1, game) : stack;
    if (!jelly) throw new Error('Could not separate one lump from the royal jelly stack.');
    await freeInventoryObject(jelly, game);
    return { jelly, parent };
}

// Part of C apply.c:use_royal_jelly(): returning the unused lump
// (unsplitobj, or a nomerge re-add).
async function putJellyBack(use: JellyUse): Promise<void> {
    if (use.parent) {
        // C unsplitobj() refuses the freed lump, so it never returns.
        await rejoinObjectStack(use.parent, use.jelly, game);
        return;
    }

    const savedNoMerge = use.jelly.nomerge;
    use.jelly.nomerge = true;
    try {
        await addInventoryItem(use.jelly, null, false);
    } finally {
        if (savedNoMerge === undefined) delete use.jelly.nomerge;
        else use.jelly.nomerge = savedNoMerge;
    }
}

// Part of C apply.c:use_royal_jelly(): consuming the used lump.
async function consumeJelly(jelly: GameObject): Promise<void> {
    // C apply.c:use_royal_jelly() clears slots through setnotworn(), which
    // does not arm the bare-hands notice.
    await setnotworn(jelly, game);
    jelly.owornmask = 0;
    jelly.worn = false;
    await deleteObject(jelly);
}

// Part of C apply.c:use_royal_jelly(): the egg quiver messages.
function quiverMessage(egg: GameObject, adverb: 'feebly' | 'briefly'): string {
    return `${definiteObjectAction(egg, 'quiver')} ${adverb}.`;
}

// Port only: type guard for the royal jelly object type — C tests otyp
// inline; the getobj callback that filters the EGG rub targets is cited
// by rubRoyalJelly below.
export function isRoyalJelly(
    object: GameObject | null | undefined,
): object is GameObject & { otyp: typeof LUMP_OF_ROYAL_JELLY } {
    return object?.otyp === LUMP_OF_ROYAL_JELLY;
}

// C apply.c:use_royal_jelly()
export async function useRoyalJelly(
    stack: GameObject | null | undefined,
    chooseTarget: () => GameObject | null | Promise<GameObject | null>,
): Promise<boolean> {
    if (stack?.otyp !== LUMP_OF_ROYAL_JELLY) return false;
    const use = await takeOneJelly(stack);
    const egg = await chooseTarget();
    if (!egg) {
        await putJellyBack(use);
        return false;
    }

    await syncPline(`You smear royal jelly all over ${ownedObjectName(egg, game, { capitalized: false })}.`);
    if (egg.otyp !== EGG) {
        await syncPline('Nothing happens.');
        await consumeJelly(use.jelly);
        return true;
    }
    const oldSpecies = egg.corpsenm ?? -1;
    if (oldSpecies === PM_KILLER_BEE) egg.corpsenm = PM_QUEEN_BEE;

    const wasTimed = objectTimers(egg).length > 0;
    if (use.jelly.cursed) {
        await syncPline(wasTimed || egg.corpsenm !== oldSpecies
            ? quiverMessage(egg, 'feebly')
            : 'Nothing seems to happen.');
        killEgg(egg);
    } else {
        if ((egg.corpsenm ?? -1) !== -1) {
            if (!wasTimed) attachEggHatchTimer(egg);
            if (use.jelly.blessed && !egg.spe) egg.spe = 2;
        }
        const quivers = (!!egg.timed && !wasTimed) || egg.spe === 2
            || egg.corpsenm !== oldSpecies;
        await syncPline(quivers
            ? quiverMessage(egg, 'briefly')
            : 'Nothing seems to happen.');
    }

    await consumeJelly(use.jelly);
    return true;
}

export interface GrapplingHookOptions {
    state?: GameState;
    ensureWielded: () => WieldToolResult | Promise<WieldToolResult>;
    attackMonster?: typeof hitMonsterWithAppliedWeapon;
    hurtle: (dx: number, dy: number) => unknown;
}

export interface GrapplingHookResult {
    spentTime: boolean;
    resume?: true;
}

// Part of C apply.c:use_grapple(): the uwep_skill_type()-based skill
// lookup.
function hookSkill(hook: GameObject, state: GameState) {
    const skillType = state.u.twoweap
        ? P_TWO_WEAPON_COMBAT : Math.abs(objectSkill(hook.otyp));
    return ensureHeroSkills(state)?.[skillType]?.skill ?? 0;
}

// C apply.c:grapple_range().
function hookRange(skill: number) {
    if (skill <= P_BASIC) return 4;
    if (skill === P_SKILLED) return 5;
    return 8;
}

// Part of C apply.c:use_grapple(): the skilled "Aim for what?" menu.
async function chooseAim(x: number, y: number, state: GameState) {
    const surface = surfaceName(x, y, state);
    const rows = [
        `a - an object on the ${surface}`,
        'b - a monster',
        `c - the ${surface}`,
    ];
    const choices = new Map([['a', 1], ['b', 2], ['c', 3]]);
    return showPagedPickOneMenu({
        rows, choices, prompt: 'Aim for what?',
    });
}

// Part of C apply.c:use_grapple(): the "snag an object" outcome.
async function snagObject(x: number, y: number, state: GameState) {
    const object = state.level?.objects?.[x]?.[y]?.[0];
    if (!object) return false;

    await syncPline(`You snag an object from the ${surfaceName(x, y, state)}!`);
    await pickupFloorObject(object, 1);
    await newsym(x, y);
    return true;
}

// C apply.c:3838: "You pull in mon_nam(mtmp)!".
async function pullTinyMonster(monster: Monster, destination: Position, state: GameState) {
    await syncPline(`You pull in ${monsterName(monster, { state })}!`);
    monster.mundetected = 0;
    await relocateMonsterTo(monster, destination.x, destination.y, { state });
}

// Part of C apply.c:use_grapple(): the attack_checks() call before the
// strike.
async function prepareHookAttack(monster: Monster, hook: GameObject, target: Position, state: GameState) {
    const confirmation = state.flags.confirm;
    state.flags.confirm = false;
    try {
        // use_grapple() deliberately proceeds after revealing a hidden target,
        // even when attack_checks() would stop an ordinary melee attack.
        await prepareAppliedWeaponAttack(monster, hook, { state, struckAt: target });
    } finally {
        if (confirmation === undefined) delete state.flags.confirm;
        else state.flags.confirm = confirmation;
    }
    if (!state.program_state.gameover) await applyCaitiffPenalty(monster, state);
}

// Part of C apply.c:use_grapple(): the "You hook yourself!" outcome.
async function damageHero(state: GameState) {
    await syncPline('You hook yourself!');
    let damage = 10 + rn2(10);
    if (state.u.halfPhysicalDamage)
        damage = Math.trunc((damage + 1) / 2);

    return loseHeroHp(damage, 'a grappling hook', { state, publish: syncPline, killerFormat: KILLED_BY });
}

// C apply.c:can_grapple_location().
// C apply.c:display_grapple_positions(): the S_goodpos highlights over the
// hook's range while the cursor selects the target.
async function chooseGrappleTarget(hook: GameObject, state: GameState) {
    await syncPline('Where do you want to hit?');
    const range = hookRange(hookSkill(hook, state));
    const valid = (x: number, y: number) => isok(x, y) && cansee(x, y)
        && distu(x, y, state) <= range;
    await prepareMapPositionHighlights(valid);
    const firstUse = shouldShowGetposTip(state);
    if (firstUse) await showGetposTip(state);
    await showGetposInstructions(state);
    if (firstUse) await syncPline('Move cursor to the spot to hit:');

    return selectMapPosition({
        start: { x: state.u.ux, y: state.u.uy },
        prompt: state._pending_message,
        goal: 'the spot to hit',
        isValidLocation: valid,
        highlightHero: false,
    });
}

// C apply.c:use_grapple().
export async function useGrapplingHook(hook: GameObject, {
    state = game,
    ensureWielded,
    attackMonster = hitMonsterWithAppliedWeapon,
    hurtle,
}: GrapplingHookOptions): Promise<GrapplingHookResult> {
    if (state.u?.uswallow) {
        await syncPline("There's not enough room here to use that.");
        return { spentTime: false };
    }

    const wielded = await ensureWielded();
    if (!wielded?.ready) return { spentTime: false };
    if (wielded.newlyWielded)
        return { spentTime: true, resume: true };

    const target = await chooseGrappleTarget(hook, state);
    if (!target) {
        commandResultCancelled(state);
        return { spentTime: false };
    }

    const range = hookRange(hookSkill(hook, state));
    if (distu(target.x, target.y, state) > range) {
        await syncPline('Too far!');
        return { spentTime: false };
    }
    if (!isok(target.x, target.y) || !cansee(target.x, target.y)) {
        await syncPline("You won't hit anything if you can't see that spot.");
        return { spentTime: false };
    }
    if (!couldsee(target.x, target.y)) {
        await syncPline("You can't reach that spot from here.");
        return { spentTime: false };
    }

    const skill = hookSkill(hook, state);
    let toHit = rn2(5);
    if (skill >= P_SKILLED) {
        toHit = rn2(4);
        const choice = await chooseAim(target.x, target.y, state);
        if (choice !== null && rn2(skill > P_SKILLED ? 20 : 2) !== 0)
            toHit = choice;
    }

    // C use_grapple() evaluates rnd(2) before checking floor reach.
    if (toHit === 2 || rn2(2) === 0) {
        wipeHeroEngraving(rnd(2), state);
    }

    if (toHit === 1
        && await snagObject(target.x, target.y, state)) {
        return { spentTime: true };
    }

    let hitSurface = toHit === 3;
    if (toHit === 2) {
        const monster = monsterAt(target.x, target.y, state);
        if (monster) {
            state.bhitpos = { x: target.x, y: target.y };
            state.notonhead = target.x !== monster.mx || target.y !== monster.my;
            const tiny = (MONSTER_SIZE[monster.mnum] ?? 2) === 0;
            if (tiny && rn2(4) === 0) {
                const destination = enexto(
                    null, state.u.ux, state.u.uy, { state },
                );
                if (destination) {
                    await prepareHookAttack(monster, hook, target, state);
                    if (state.program_state.gameover) return { spentTime: true };
                    await pullTinyMonster(monster, destination, state);
                    return { spentTime: true };
                }
            }

            const large = monsterIsBig(monster.mnum);
            const strong = strongmonst(monster.mnum);
            if ((!large && !strong) || rn2(4) !== 0) {
                await prepareHookAttack(monster, hook, target, state);
                if (state.program_state.gameover) return { spentTime: true };
                await attackMonster(monster, hook, { state, target, checkCaitiff: false });
                return { spentTime: true };
            }
            hitSurface = true;
        }
    }

    if (hitSurface) {
        const location = state.level?.at(target.x, target.y);
        if (!location) throw new Error('The hook target is outside the dungeon map.');
        const terrain = location.typ;
        const surface = surfaceName(target.x, target.y, state);
        if (IS_AIR(terrain) || isPoolAt(target.x, target.y, state)) {
            await syncPline(`The hook slices through the ${surface}.`);
        } else {
            await syncPline(`You are yanked toward the ${surface}!`);
            const from = { x: state.u.ux, y: state.u.uy };
            await hurtle(
                Math.sign(target.x - state.u.ux),
                Math.sign(target.y - state.u.uy),
            );
            // C use_grapple() (apply.c) calls spoteffects(TRUE) only after
            // hurtle() returns; a fatal hurtle ends in done(), which never
            // returns, so the landing square never fires its effects.
            if (state.program_state.gameover) return { spentTime: true };
            // C use_grapple() runs spoteffects(TRUE) after hurtle(): the
            // landing square still triggers its trap and autopickup.
            await finishDestinationSpotEffects({
                oldx: from.x, oldy: from.y,
                newx: state.u.ux, newy: state.u.uy,
            });
        }
        return { spentTime: true };
    }

    if (toHit > 3 && skill <= P_BASIC) {
        await damageHero(state);
        return { spentTime: true };
    }

    await syncPline('Nothing happens.');
    return { spentTime: true };
}

const inertBreaks = new Set([
    WAN_WISHING, WAN_NOTHING, WAN_LOCKING, WAN_PROBING, WAN_ENLIGHTENMENT,
    WAN_SECRET_DOOR_DETECTION, WAN_STASIS, WAN_OPENING,
]);

const affectsObjects = new Set([
    WAN_STRIKING, WAN_CANCELLATION, WAN_POLYMORPH, WAN_TELEPORTATION, WAN_UNDEAD_TURNING,
]);

// C apply.c:do_break_wand(): the confirmation, the wrested charges, and
// the scatter loop with its typing damage and shop billing.
// C apply.c:broken_wand_explode(): the typed explosion, makeknown, and
// current-wand discard at the wand's own square.
// C apply.c:maybe_dunk_boulders(): after each blast, boulders left on
// water or lava sink before the scatter continues.
// sobj_at() is the pile scan for the next boulder on the liquid square.
export async function breakWand(wand: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const description = OBJ_DESCR(wand.otyp, state);
    const fragile = description === 'balsa' || description === 'glass';
    if (heroHasNoHands(state)) {
        observeObjectForNaming(wand, { state });
        const name = ownedObjectName(wand, state, { capitalized: false });
        await pline(`You can't break ${name} without hands!`);
        return { spentTime: false, heroDied: false };
    }
    if (!heroHasFreeHand(state)) {
        await pline(`Your ${makePlural(body_part(HAND, state))} are occupied!`);
        return { spentTime: false, heroDied: false };
    }
    // Native names the wand in the weakness denial or confirmation.
    // The occupied-hands denial above names only the hands.
    observeObjectForNaming(wand, { state });
    const name = ownedObjectName(wand, state, { capitalized: false });
    if (currentAttribute(A_STR, state) < (fragile ? 5 : 10)) {
        await pline(`You don't have the strength to break ${name}!`);
        return { spentTime: false, heroDied: false };
    }
    const paranoid = !!((state.flags.paranoia_bits ?? 0) & PARANOID_BREAKWAND);
    if (!await paranoidQuery(paranoid, `Are you really sure you want to break ${name}?`))
        return { spentTime: false, heroDied: false };
    await pline(`Raising ${name} high above your ${body_part(HEAD, state)}, you ${fragile ? 'snap' : 'break'} it in two!`);
    if (wand.unpaid) {
        await chargeUnpaidUsage(wand, { state });
        await chargeAlteredUnpaidObject(wand, 'destroy', state);
    }
    state._currentWand = wand;
    await freeInventoryObject(wand, state);
    if (state.program_state.gameover) return { spentTime: true, heroDied: true };
    // C apply.c:do_break_wand(): freeinv(obj) + setnotworn(obj); a broken
    // wielded wand must not arm the "begin bashing with your bare hands"
    // notice the way steal.c:remove_worn_item()'s uwepgone() would.
    await setnotworn(wand, state);
    if (state.program_state.gameover) return { spentTime: true, heroDied: true };
    if (!await zappable(wand, { state })) {
        await pline('But nothing else happens...');
        await discardBrokenWand(state);
        return { spentTime: true, heroDied: false };
    }
    // zappable consumed one charge; breakage uses the original charge total.
    // A wrested last charge becomes 1..3 for the explosion.
    wand.spe++;
    if (!wand.spe) wand.spe = rnd(3);
    wand.ox = state.u.ux;
    wand.oy = state.u.uy;
    if (wand.otyp === WAN_OPENING && state.u.ustuck) {
        await releaseHold(state);
        if (state.program_state.gameover) return { spentTime: true, heroDied: true };
        if (wand.dknown) learnObjectType(WAN_OPENING, state);
        await discardBrokenWand(state);
        return { spentTime: true, heroDied: false };
    }
    if (inertBreaks.has(wand.otyp)) {
        await pline('But nothing else happens...');
        await discardBrokenWand(state);
        return { spentTime: true, heroDied: false };
    }
    let damage = wand.spe * 4;
    const rayBreak = [WAN_DEATH, WAN_LIGHTNING, WAN_FIRE, WAN_COLD, WAN_MAGIC_MISSILE].includes(wand.otyp);
    if (rayBreak) {
        if (wand.otyp === WAN_DEATH || wand.otyp === WAN_LIGHTNING) damage *= 4;
        else if (wand.otyp === WAN_FIRE || wand.otyp === WAN_COLD) damage *= 2;
        const style = wand.otyp === WAN_FIRE ? EXPL_FIERY
            : wand.otyp === WAN_COLD ? EXPL_FROSTY : EXPL_MAGICAL;
        await explode(wand.ox, wand.oy, -wand.otyp, damage, WAND_CLASS, style, { state });
        if (state.program_state.gameover) return { spentTime: true, heroDied: true };
        learnObjectType(wand.otyp, state);
        await discardBrokenWand(state);
        return { spentTime: true, heroDied: false };
    }
    if (wand.otyp === WAN_STRIKING) {
        await pline('A wall of force smashes down around you!');
        damage = d(1 + wand.spe, 6);
    }
    await explode(wand.ox, wand.oy, -wand.otyp, rnd(damage), WAND_CLASS, EXPL_MAGICAL, { state });
    if (state.program_state.gameover) return { spentTime: true, heroDied: true };
    beginImmediateZap(state);
    let shopDamage = false, fillMessageShown = false;
    for (let direction = 0; direction <= 8; direction++) {
        const dx = xdir[direction], dy = ydir[direction];
        if (dx === undefined || dy === undefined) throw new Error(`Missing wand break direction ${direction}.`);
        const x = wand.ox + dx, y = wand.oy + dy;
        state.bhitpos = { x, y };
        if (!isok(x, y)) continue;
        if (wand.otyp === WAN_DIGGING) {
            const dug = await digWithBrokenWand(wand, x, y, fillMessageShown, state);
            shopDamage ||= dug.shopDamage;
            fillMessageShown ||= dug.filledWithLiquid;
        } else if (wand.otyp === WAN_CREATE_MONSTER) {
            await makemonAt(null, state.u.ux, state.u.uy);
        } else if (x !== state.u.ux || y !== state.u.uy) {
            const monster = monsterAtPosition(state.level, x, y);
            if (monster) await hitMonsterWithWand(monster, wand, { state, x, y });
            if (state.program_state.gameover) return { spentTime: true, heroDied: true };
            if (affectsObjects.has(wand.otyp)) await affectPile(wand, x, y, state);
        } else {
            if (affectsObjects.has(wand.otyp)) await affectPile(wand, x, y, state);
            if (state.program_state.gameover) return { spentTime: true, heroDied: true };
            const effect = await zapHeroWithObject(wand, { state, ordinary: false });
            if (effect.heroDied) return { spentTime: true, heroDied: true };
            if (effect.damage) {
                const injury = state.u.halfPhysicalDamage ? Math.ceil(effect.damage / 2) : effect.damage;
                const killer = `killed ${state.flags.female ? 'herself' : 'himself'} by breaking a wand`;
                if (await loseHeroHp(injury, killer, { state, killerFormat: NO_KILLER_PREFIX }))
                    return { spentTime: true, heroDied: true };
            }
            await bot();
        }
        if (state.program_state.gameover) return { spentTime: true, heroDied: true };
    }
    await finishImmediateZap(state);
    if (shopDamage) await payForShopDamage('dig into', { state });
    if (wand.otyp === WAN_LIGHT) await lightRoom(true, { finishMonsterKill: finishHeroMonsterKill });
    if (state.program_state.gameover) return { spentTime: true, heroDied: true };
    await discardBrokenWand(state);
    return { spentTime: true, heroDied: false };
}

// C apply.c:discard_broken_wand()
async function discardBrokenWand(state: GameState) {
    const wand = state._currentWand;
    state._currentWand = null;
    if (wand) await delobj(wand, state);
    nomul(0, state);
}

// Part of C apply.c:do_break_wand(): the per-square object-pile zap of
// the ray sweep.
async function affectPile(wand: GameObject, x: number, y: number, state: PlayingGameState) {
    if (!state.level.objects[x]?.[y]?.length) return;
    await hitFloorPileWithWand(wand, x, y, { state });
    if (!state.program_state.gameover) await bot();
}

// Part of C apply.c:do_break_wand(): the terrain effect of one ray
// square — wall watch, liquid fill, pit or hole, and boulder dunking.
async function digWithBrokenWand(wand: GameObject, x: number, y: number, fillMessageShown: boolean, state: PlayingGameState) {
    const result = { shopDamage: false, filledWithLiquid: false };
    const check = digCheck('object', x, y, state);
    if (check < DIGCHECK_FAILED || check === DIGCHECK_FAIL_BOULDER) {
        const location = state.level.at(x, y);
        if (!location) throw new Error(`No map location at ${x},${y}`);
        if (IS_WALL(location.typ) || IS_DOOR(location.typ)) {
            await watchDigging(x, y, { state, magic: true });
            result.shopDamage = roomsAt(state.level, x, y, SHOPBASE).length > 0;
        }
        if (location.typ === ICE) stopLevelTimer(x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY, state);
        const liquid = liquidForHole(x, y, state);
        if (liquid !== ROOM) {
            location.typ = liquid;
            location.flags = 0;
            const trap = state.level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
            await liquidFlow(x, y, liquid, trap ?? null,
                fillMessageShown ? null : 'Some holes are quickly filled with %s!', { state });
            result.filledWithLiquid = true;
        } else {
            const pit = rn2(wand.spe) < 3 || (!canDigDown(state.u.uz) && !location.candig);
            await digActualHole(x, y, 'object', pit ? PIT : HOLE, { state });
        }
    }
    if (state.program_state.gameover) return result;
    await fillPitWithBoulderAt(x, y, state);
    if (state.program_state.gameover) return result;
    while (isPoolAt(x, y, state) || isLavaAt(x, y, state)) {
        const boulder = state.level.objects[x]?.[y]?.find(object => object.otyp === BOULDER);
        if (!boulder) break;
        unlinkObject(boulder, state);
        await dropBoulderIntoLiquid(boulder, x, y, state);
        if (state.program_state.gameover) return result;
    }
    vision_note_blocker_change(x, y);
    return result;
}

// C apply.c:apply_ok().
export function applySuggestion(
    object: GameObject | null | undefined, state: GameState = game,
): InventoryClassification {
    if (!object) return GETOBJ_EXCLUDE;
    const kind = object.oclass || objectClassForType(object.otyp);
    if ([TOOL_CLASS, SPBOOK_CLASS, WAND_CLASS].includes(kind)) return GETOBJ_SUGGEST;
    if (kind === COIN_CLASS) return GETOBJ_DOWNPLAY;
    if (kind === WEAPON_CLASS && (isPick(object) || isAxe(object)
        || isPolearm(object) || object.otyp === BULLWHIP))
        return GETOBJ_SUGGEST;
    if (kind === POTION_CLASS) {
        if (!object.dknown || !objectTypeKnown(object, state)) return GETOBJ_DOWNPLAY;
        if (object.otyp === POT_OIL) return GETOBJ_SUGGEST;
    }
    if ([CREAM_PIE, EUCALYPTUS_LEAF, LUMP_OF_ROYAL_JELLY].includes(object.otyp))
        return GETOBJ_SUGGEST;
    if (object.otyp === BANANA && heroIsHallucinating(state)) return GETOBJ_DOWNPLAY;
    if (isGrayStone(object)) {
        if (!object.dknown) return GETOBJ_SUGGEST;
        if (object.otyp !== TOUCHSTONE && (objectTypeKnown(object, state)
            || objectTypeKnown({ otyp: TOUCHSTONE, oclass: GEM_CLASS }, state)))
            return GETOBJ_EXCLUDE_SELECTABLE;
        return GETOBJ_SUGGEST;
    }
    return GETOBJ_EXCLUDE_SELECTABLE;
}

// C apply.c:doapply()
export async function doapply(): Promise<void> {
    // apply.c:doapply() rejects the current body and excessive load before
    // choosing an object through getobj().
    if (heroHasNoHands(game)) {
        await syncPline(
            "You aren't able to use or apply tools in your current form.",
        );
        game.context.move = 0;
        return;
    }
    if (exceedsActionCapacity(game)) {
        await syncPline("You can't do that while carrying so much stuff.");
        game.context.move = 0;
        return;
    }

    const underlay = snapshotMenuUnderlay();
    const item = await chooseInventoryObject('use or apply', applySuggestion);
    if (!item) {
        commandResultCancelled(); // doapply() returns ECMD_CANCEL without an object.
        return;
    }
    const touch = await retouchHeroObject(item);
    if (touch.rejected || touch.died) {
        game.context.move = 1;
        return;
    }
    if (item.oclass === WAND_CLASS) {
        const result = await breakWand(item);
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    if (item.oclass === SPBOOK_CLASS || item.oclass === COIN_CLASS) {
        const result = item.oclass === SPBOOK_CLASS
            ? await flipThroughBook(item) : await flipCoin(item);
        game.context.move = result.spentTime ? 1 : 0;
        return;
    }
    game.context.move = 0;
    const appliedObject = await applyTool(item, underlay);
    if (!game.program_state.gameover && appliedObject
        && await speakArtifact(appliedObject)) {
        // doapply() ORs arti_speak()'s ECMD_TIME into the tool result, so
        // a cancelled tool use still spends its turn when it speaks.
        commandResultSpentTime();
        game.context.move = 1;
    }
}

// Part of C apply.c:doapply(): the tool switch dispatching each applyable
// object.
// Return the surviving object for the native talking-artifact tail. Applied
// stacks can split or disappear, so each destructive owner returns its object.
export async function applyTool(
    item: GameObject, underlay: MenuUnderlay | null,
): Promise<GameObject | null> {
    if (item.otyp === CRYSTAL_BALL) {
        const object = await useCrystalBall(item);
        game.context.move = 1;
        return object;
    }
    if (item.otyp === LAND_MINE || item.otyp === BEARTRAP) {
        const object = await useSettableTrap(item);
        game.context.move = 1;
        return object;
    }
    if (item.otyp === TINNING_KIT) {
        await useTinningKit(item);
        game.context.move = 1;
        return item;
    }
    if (item.otyp === HORN_OF_PLENTY) {
        await useHornOfPlenty(item);
        game.context.move = 1;
        return item;
    }
    if (item.otyp === BAG_OF_TRICKS) {
        await useBagOfTricks(item);
        game.context.move = 1;
        return item;
    }
    if (item.otyp === SADDLE) {
        game.context.move = await useSaddle(item) ? 1 : 0;
        return item;
    }
    if (item.otyp === CAN_OF_GREASE) {
        game.context.move = await useGrease(item) ? 1 : 0;
        return item;
    }
    if (item.otyp === LEASH) {
        game.context.move = await useLeash(item) ? 1 : 0;
        return item;
    }
    if (item.otyp === FIGURINE) {
        const result = await useFigurine(item);
        game.context.move = result.spentTime ? 1 : 0;
        return result.object;
    }
    if (item.otyp === EXPENSIVE_CAMERA || item.otyp === TOWEL
        || item.otyp === BELL || item.otyp === BELL_OF_OPENING) {
        const result = item.otyp === EXPENSIVE_CAMERA ? await useCamera(item)
            : item.otyp === TOWEL ? await useTowel(item) : await useBell(item);
        game.context.move = result.spentTime ? 1 : 0;
        return result.object;
    }
    if (item.otyp === MIRROR) {
        const result = await useMirror(item);
        game.context.move = result.spentTime ? 1 : 0;
        return result.object;
    }
    if ([TIN_WHISTLE, MAGIC_WHISTLE, EUCALYPTUS_LEAF].includes(item.otyp)) {
        const result = await useWhistle(item);
        game.context.move = result.spentTime ? 1 : 0;
        return item;
    }
    if ([TALLOW_CANDLE, WAX_CANDLE, CANDELABRUM_OF_INVOCATION, POT_OIL,
        OIL_LAMP, BRASS_LANTERN, MAGIC_LAMP].includes(item.otyp)) {
        let result;
        if (item.otyp === CANDELABRUM_OF_INVOCATION) result = await useCandelabrum(item);
        else if (item.otyp === POT_OIL) result = await lightCocktail(item);
        else if ([TALLOW_CANDLE, WAX_CANDLE].includes(item.otyp)) result = await useCandle(item);
        else result = await useLamp(item);
        game.context.move = result.spentTime ? 1 : 0;
        return result.object;
    }
    if (isGrayStone(item)) {
        const result = await useGrayStone(item);
        game.context.move = result.spentTime ? 1 : 0;
        return item;
    }
    if (item.otyp === BULLWHIP) {
        const result = await useWhip(item);
        game.context.move = result.spentTime ? 1 : 0;
        return item;
    }
    if (isPick(item) || isAxe(item)) {
        await applyPickAxe(item);
        return item;
    }
    if (isPolearm(item)) {
        await applyPolearm(item);
        return item;
    }
    if (item.otyp === GRAPPLING_HOOK) {
        const result = await useGrapplingHook(item, {
            state: game,
            ensureWielded: () => wieldTool(
                item,
                'cast',
                { swapWeapons: doswapweapon },
                game,
            ),
            hurtle: (dx: number, dy: number) => hurtleHero(dx, dy, 1, {
                finishTeleport: finishTeleportArrival,
                gotoLevel,
                chooseTeleportDestination: askTeleportDestination,
                finishMonsterDeath: finishHurtleMonsterDeath,
            }),
        });
        if (result.resume) {
            // C apply.c:3744-3746 queues doapply plus the hook's letter;
            // the next turn's apply pops the letter from CQ_CANNED.
            cmdq_add_ec(CQ_CANNED, 'doapply');
            cmdq_add_key(CQ_CANNED, inventoryCommandLetter(item).charCodeAt(0));
        }
        game.context.move = result.spentTime ? 1 : 0;
        return item;
    }
    if ([BLINDFOLD, LENSES].includes(item.otyp)) {
        game._pending_message = '';
        await applyEyewear(item);
        if (game.program_state.gameover) return item;
        game.context.move = 1;
        return item;
    }
    if (isContainer(item)) {
        const result = await use_container(item, {
            held: true,
            underlay,
        });
        if (result.heroDied) return item;
        game.context.move = result.spentTime ? 1 : 0;
        return result.container;
    }
    if (item.otyp === STETHOSCOPE) {
        game.context.move = await useStethoscope(item) ? 1 : 0;
        return item;
    }
    if (item.otyp === TIN_OPENER) {
        const result = await use_tin_opener(item, { state: game, swapWeapons: doswapweapon });
        if (!result.heroDied) game.context.move = Number(result.usedTime);
        return item;
    }
    if (item.otyp === MAGIC_MARKER) {
        game.context.move = Number(await useMagicMarker(item));
        return item;
    }
    if (item.otyp === UNICORN_HORN) {
        const result = await useUnicornHorn({
            object: item,
            state: game,
        });
        game.context.move = result.spentTime ? 1 : 0;
        return item;
    }
    if (PLAYABLE_INSTRUMENTS.has(item.otyp)) {
        game._pending_message = '';
        game._retained_message = '';
        await playInstrument(item, {
            finishMonsterKill: finishHeroMonsterKill,
        });
        return item;
    }
    if (item.otyp === CREAM_PIE) {
        game._pending_message = '';
        await useCreamPie(item);
        game.context.move = 0;
        return null;
    }
    if (isRoyalJelly(item)) {
        const used = await rubRoyalJelly(item);
        return used ? null : item;
    }
    if ([SKELETON_KEY, LOCK_PICK, CREDIT_CARD].includes(item.otyp)) {
        game.context.move = Number(await pickLock(item));
        return item;
    }
    if (item.otyp === BANANA && heroIsHallucinating(game)) {
        await syncPline("It rings! ... But no-one answers.");
        game.context.move = 1;
        return item;
    }
    await syncPline("Sorry, I don't know how to use that.");
    // apply.c's default case returns ECMD_FAIL; the rhack seam clears the
    // queues so a later ^A reports nothing to repeat.
    commandResultFailed();
    return null;
}

// C apply.c:unfixable_trouble_count(FALSE). Restoration does not treat these
// ailments or temporary attribute penalties; they only change its feedback.
export function restorationLeavesTrouble(state: PlayingGameState) {
    const hero = state.u;
    return heroIsPetrifying(state) || heroIsSliming(state) || heroIsStrangled(state)
        || hero.atemp.a[A_DEX] < 0 && (hero._woundedLegTurns ?? 0) > 0
        || hero.atemp.a[A_STR] < 0 && hero.uhs >= WEAK
        || heroIsSick(state) || propertyIsActive('stunned', state)
        || (hero.confusionTurns ?? 0) > 0 || heroIsHallucinating(state)
        || heroIsVomiting(state) || heroIsDeaf(state);
}

const FADED_INK = [
    'fresh', 'slightly faded', 'very faded', 'extremely faded', 'barely visible',
];

// C apply.c:flip_through_book()
export async function flipThroughBook(book: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    if (state.u.uinwater) {
        await plineWithContinuation("You don't want to get the pages even more soggy, do you?");
        return { spentTime: false, heroDied: false };
    }

    const name = minimalObjectName(book, state);
    const pagesOf = (book.quan ?? book.quantity ?? 1) === 1 ? name : makePlural(name);
    await plineWithContinuation(`You flip through the pages of the ${pagesOf}.`);
    const blind = heroIsBlind(state);
    const hallucinating = heroIsHallucinating(state);
    if (book.otyp === SPE_BOOK_OF_THE_DEAD) {
        if (!heroIsDeaf(state)) {
            const sound = hallucinating ? 'chuckling' : 'rustling';
            await publishHeardMessage(`the pages make an unpleasant ${sound} sound.`, plineWithContinuation, state);
        } else if (!blind) {
            const color = displayColorName('red', state);
            await plineWithContinuation(formatSeenMessage(`the pages glow faintly ${color}.`, state));
        } else {
            await plineWithContinuation(formatFeltMessage('the pages tremble.', state));
        }
    } else if (blind) {
        const texture = hallucinating ? 'freshly picked' : 'rough and dry';
        await plineWithContinuation(`The pages feel ${texture}.`);
    } else if (book.otyp === SPE_BLANK_PAPER) {
        const description = hallucinating ? "doesn't have much of a plot"
            : 'has nothing written in it';
        await plineWithContinuation(`This spellbook ${description}.`);
        learnObjectType(book.otyp, state);
    } else if (hallucinating) {
        await plineWithContinuation('You enjoy the animated initials.');
    } else if (book.otyp === SPE_NOVEL) {
        await plineWithContinuation('This looks like it might be interesting to read.');
    } else {
        // apply.c clamps to MAX_SPELL_STUDY (3), so the final fadeness
        // string is unreachable from this flip.
        const studies = Math.min(book.spestudied ?? 0, 3);
        const fading = FADED_INK[studies];
        if (fading === undefined) throw new Error(`Spellbook ${book.o_id} has invalid study count ${studies}`);
        const ink = objectMagic(book.otyp) ? 'magical ink' : 'ink';
        await plineWithContinuation(`The ${ink} in this spellbook is ${fading}.`);
    }
    return { spentTime: true, heroDied: false };
}

// C apply.c:flip_coin()
export async function flipCoin(coin: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    await plineWithContinuation(`You flip ${withIndefiniteArticle(objectName(coin, state))}.`);
    let lost = false;
    if (state.u.uinwater) {
        await plineWithContinuation('It tumbles away.');
        lost = true;
    } else {
        const dexterity = currentAttribute(A_DEX, state);
        if ((state.u.glibTurns ?? 0) > 0 || state.u.fumbling
            || propertyIsActive('fumbling', state)
            || (dexterity < 10 && rn2(dexterity) === 0)) {
            await plineWithContinuation(`It slips between your ${makePlural(body_part(FINGER, state))}.`);
            lost = true;
        }
    }

    if (lost) {
        let dropped = coin;
        if (objectQuantity(coin) > 1) {
            const split = splitObjectStack(coin, 1, state);
            if (!split) throw new Error(`Coin stack ${coin.o_id} could not be split`);
            dropped = split;
        }
        await dropInventoryObjectAtHero(dropped, { state });
    } else if (heroIsHallucinating(state)) {
        await plineWithContinuation(rn2(100) ? 'Wow, a double header!'
            : 'The coin miraculously lands on its edge!');
    } else {
        await plineWithContinuation(`It comes up ${rn2(2) ? 'heads' : 'tails'}.`);
    }
    return { spentTime: true, heroDied: !!state.program_state.gameover };
}
