// dothrow.js — Throw and fire command front ends, the hero's ranged monster
// contact, and the shared throw helpers.
// C refs: dothrow.c ok_to_throw(), dothrow(), dofire(), throw_obj(),
// thitmonst(), walk_path(), and throwing_weapon(); throw_obj()'s per-missile
// handoff to the flight owners.
import { WEAPON_CLASS, ARMOR_CLASS, RING_CLASS, TOOL_CLASS, POTION_CLASS, SCROLL_CLASS, WAND_CLASS, COIN_CLASS, GEM_CLASS, FOOD_CLASS, BALL_CLASS, VENOM_CLASS, } from './objclass.js';
import { objectClassForType, objectSkill, objectMagic, objectUnique, AKLYS, AMULET_OF_YENDOR, BOOMERANG, BOULDER, BULLWHIP, CORPSE, EGG, SLING, FAKE_AMULET_OF_YENDOR, ACID_VENOM, BLINDING_VENOM, CREAM_PIE, EXPENSIVE_CAMERA, CRYSTAL_BALL, LENSES, MELON, MIRROR, POT_OIL, POT_WATER, STATUE, HEAVY_IRON_BALL, TRIDENT, WAN_STRIKING, BAG_OF_HOLDING, BAG_OF_TRICKS, EUCALYPTUS_LEAF, FLINT, FORTUNE_COOKIE, HARD_GEM_TYPES, KELP_FROND, OILSKIN_SACK, PANCAKE, SACK, SPRIG_OF_WOLFSBANE, ELVEN_ARROW, ELVEN_BOW, ORCISH_ARROW, ORCISH_BOW, YA, YUMI, ROCK, RUBBER_HOSE, OBJ_NAME, GAUNTLETS_OF_FUMBLING, GAUNTLETS_OF_POWER, } from './object_data.js';
import { game, requirePlayingGame, requireLiveGame, requireGameLevel, requireInitializedGame } from './gstate.js';
import { isWeaponTool, isMissileObject, isLauncherAmmunition, isPolearm, isThrowingWeapon, isAxe, isWetTowel, launcherMatchesAmmo, objectIsCrackable, } from './object_properties.js';
import { formatFeltMessage, pline, plineWithContinuation, publishHeardMessage } from './pline.js';
import { beginCommandResult, commandResultCancelled, cmdq_add_ec, cmdq_add_key, setMulti, isok, promptDirection } from './cmd.js';
import { requireInitializedHero } from './hero_types.js';
import { currentAttribute, changeHeroLuck, exerciseAttribute } from './attrib.js';
import { MONSTER_MOVE, MONSTER_SIZE, MONSTER_SYMBOL, MONSTER_NAME, MONSTER_LEVEL, monsterTypeName, MONSTER_ALIGNMENT, } from './monster_data.js';
import { artifactById, artifactToHitBonus } from './artifact.js';
import { heroCannotTake, heroHasNoHands, heroHatesSilver, heroSpecies, polymonHero, heroMonsterForm, body_part } from './polyself.js';
import { isWeldedPrimary, setQuiverObject, setPrimaryWeapon, setSecondaryWeapon, setTwoWeaponCombat, doquiverCore } from './wield.js';
import { GETOBJ_DOWNPLAY, GETOBJ_SUGGEST, A_DEX, A_STR, STR19, IS_WATERWALL, MM_IGNORELAVA, MM_IGNOREWATER, W_ARM, W_ARMC, W_ARMU, IS_SOFT, IS_ALTAR, CQ_CANNED, HOLE, PIT, SPIKED_PIT, TRAPDOOR, MM_NOMSG, M_AP_MONSTER, M_AP_TYPE, D_CLOSED, D_ISOPEN, D_LOCKED, DOOR, FIRE_TRAP, IRONBARS, IS_OBSTRUCTED, IS_STWALL, Is_airlevel, Is_waterlevel, KILLED_BY, LOST_THROWN, MAGIC_PORTAL, STONING, TREE, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_WEB, Upolyd, VIBRATING_SQUARE, W_NONPASSWALL, WT_TO_DMG, ZAP_POS, is_hole, is_pit, SHOPBASE, P_BOW, P_CROSSBOW, P_DAGGER, P_DART, P_EXPERT, P_KNIFE, P_SHURIKEN, P_SKILLED, P_SLING, P_SPEAR, STRAT_WAITMASK, Luck, W_QUIVER, W_WEP, W_SWAPWEP, AKLYS_LIM, RLOC_MSG, HAND, EYE, HEAD, FACE, FOOT, ARM, } from './const.js';
import { weaponHitValue, weaponSkillHitBonus, dryTowel, rollPhysicalWeaponDamageAgainstHero, ensureHeroSkills, skillName, weaponDescription, } from './weapon.js';
import { quiverObjectClass } from './quiver.js';
import { corpseName, killerObjectName, objectCombatName, objectName, observeObjectForNaming, singularObjectName, makePlural, verbForSubject, objectDescription, objectNameIsPlural, simpleObjectName, withIndefiniteArticle, definiteObjectAction, definiteName } from './objnam.js';
import { inventoryItemDescription, delobj, chooseInventoryObject, freeInventoryObject, addInventoryItemBefore, stack_object, fullyIdentifyObject, addInventoryItem, } from './invent.js';
import { objectMaterial, objectTypeKnown } from './o_init.js';
import { rejoinObjectStack, linkObjectToMonsterInventory, placeObjectSynchronously } from './mkobj.js';
import { applyPolearm, applyTool, couldPoleMonster } from './apply.js';
import { snapshotMenuUnderlay } from './wintty.js';
import { captureThrownObjectFlight, detachThrownUnit, finishHeroThrownObjectLanding, flyHeroThrownObject, heroThrowTrajectory, prepareHeroThrownTarget, heroDirectGoldThrowRange, snuffThrownCandle } from './thrown_object.js';
import { wakeMonstersNearWithMessages, angerAttackedMonster, wakeAttackedMonster, finishEnvironmentalMonsterDeath, monsterWearsTorsoArmor, resolveMonsterLiquid, wakeMonster as awakenMonster, angerMonster, finishHeroMonsterKillOutcome } from './mon.js';
import { canLetGo, dropObjectAtHero } from './do.js';
import { wipeHeroEngraving } from './engrave.js';
import { finishQuest, isQuestLeader } from './quest.js';
import { isQuestArtifact } from './questpgr.js';
import { deityName } from './pray.js';
import { encumber_msg } from './pickup.js';
import { hitMonsterWithSupportedPotion, SUPPORTED_MONSTER_POTION_TYPES, applySupportedPotionVapor, heroPotionVaporProfile, makeBlinded } from './potion.js';
import { dist2, possessiveName } from './hacklib.js';
import { resolveGoldMonsterContact, shipObject } from './dokick.js';
import { landObjectOnAltar } from './altar_object.js';
import { captureHeroProjectileName, hitMonsterWithHeroObject, applyCaitiffPenalty, applyMonsterPassiveToObject, } from './uhitm.js';
import { capitalizedDefiniteName } from './objnam.js';
import { rayMissMessage } from './zap.js';
import { applyLowStaminaThrow, applyThrowSlip } from './throw_state.js';
import { cutWorm } from './worm.js';
import { findMonsterArmorClass } from './worn.js';
import { ACCFOOD, dogFood } from './pet_food.js';
import { tameMonster } from './dog.js';
import { flyBoomerang } from './zap.js';
import { monsterHasMapPosition, monsterOccupiesPosition, monsterAtPosition } from './steed.js';
import { canSeeMonster, canSpotMonster, flush_screen, newsym, glyphAt, map_invisible, transientObjectGlyph } from './display.js';
import { goodPosition, randomMonsterRelocation, reportMonsterTeleportRestriction } from './teleport.js';
import { mintrap, petrifyMonsterImmediately, erodeObject, resolveImmediatePetrification, petrifyMonsterFromContact, trapName, dotrap } from './trap.js';
import { stopHeroOccupation } from './allmain.js';
import { cansee, vision_recalc } from './vision.js';
import { rn2, rnd, d, rnl } from './rng.js';
import { updateMonsterRegions, updateHeroRegions } from './region.js';
import { setMonsterApparentHeroPosition } from './monmove.js';
import { monsterSentenceSubject } from './sounds.js';
import { displayLiquidName, monsterName, randomDisplayMonsterName } from './do_name.js';
import { isPoolAt, isLavaAt, isMoatAt, isWaterwallAt } from './dbridge.js';
import { armorSimpleName, heroHasWaterWalking, objectIsHardHelmet, simpleArmorName } from './do_wear.js';
import { setMonsterMalign, makemonAt } from './makemon.js';
import { applyHeroEggLuckPenalty, explodePyroliskEggAt, isPyroliskEgg } from './egg_impact.js';
import { explodeLitOilPotion } from './fire_explosion.js';
import { objectResistsDestruction } from './zap.js';
import { costlySpot, stolenValue, makeAngryShopkeeper, insideShopRoomAt, containedGold, donateGold, objectIsUnpaid, removeObjectAndContentsFromBill, sellHeroDroppedObject, shopResident, chargeUnpaidObjectAsDebt, } from './shk.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { exceedsActionCapacity, checkSpecialRoom, finishDestinationSpotEffects, heroBadRock, heroLiquidEffects, heroTightDiagonalReason, loseHeroHp, nomul, switchHeroTerrain, roomsAt, } from './hack.js';
import { AT_WEAP } from './monster_attack_types.js';
import { propertyIsActive } from './properties.js';
import { monsterProjectileDisplay } from './mthrowu.js';
import { finishHeroDeath } from './end.js';
import { hitHeroWithFallingArtifact } from './falling_artifact.js';
import { hitHeroWithThrownPotion } from './hero_potion_hit.js';
import { levelHasCeiling, placeHeroOnLevel, surfaceName, ceilingName } from './dungeon.js';
import { beginBallAndChainMove, finishBallAndChainMove, heroIsPunished } from './ball.js';
import { monsterObjectPronoun, monsterDigests, monsterHasNoLimbs, monsterHatesBlessings, monsterIsAmorphous, monsterIsFlyer, monsterIsSlithy, monsterIsWhirly, monsterPassesWalls, monsterThrowsRocks, passes_rocks, monsterIsAnimal, monsterIsUnicorn, heroResistsStoning, touchPetrifies, formCanBecomeStoneGolem, eyecount, befriendWithObj, is_domestic, is_elf, is_orc, your_race, canBlnd, } from './mondata.js';
import { detachHeroGold, heroGoldObject } from './sit.js';
import { addObjectToMonsterInventory } from './steal.js';
import { requireShopGame } from './shop_types.js';
import { applyFloorEffects } from './floor_effects.js';
// C dothrow.c:multishot_class_bonus(): the role-specific volley bonuses.
// PM_NINJA shares PM_SAMURAI's YUMI+YA case through C's fallthrough; the
// port's role keys have no ninja.
function multishotClassBonus(role, item, launcher, skill) {
    if (role === 'caveman')
        return skill === -P_SLING || skill === P_SPEAR ? 1 : 0;
    if (role === 'monk')
        return skill === -P_SHURIKEN ? 1 : 0;
    if (role === 'ranger')
        return skill !== P_DAGGER ? 1 : 0;
    if (role === 'rogue')
        return skill === P_DAGGER ? 1 : 0;
    if (role === 'samurai')
        return item.otyp === YA && launcher?.otyp === YUMI ? 1 : 0;
    return 0;
}
// Part of C dothrow.c:throw_obj(): the weakmultishot local (dothrow.c:170-174)
// — these roles, poor dexterity, or fumbling hold the volley back to its
// smaller bonuses.
function weakMultishot(role, skill, state) {
    return role === 'wizard' || role === 'priest'
        || (role === 'healer' && skill !== P_KNIFE)
        || (role === 'tourist' && skill !== -P_DART)
        || state.u?.fumbling || (state.u?.fumblingTurns ?? 0) > 0
        || currentAttribute(A_DEX, state) <= 6;
}
// Part of C dothrow.c:throw_obj(): the race bonus switch (dothrow.c:193-214)
// — the racial bows and the gnome crossbow.  The quest-artifact launcher's
// extra shot follows in the caller.
function raceBonus(race, item, launcher, skill) {
    if (race === 'elf') {
        return item.otyp === ELVEN_ARROW && launcher?.otyp === ELVEN_BOW
            ? 1 : 0;
    }
    if (race === 'orc') {
        return item.otyp === ORCISH_ARROW && launcher?.otyp === ORCISH_BOW
            ? 1 : 0;
    }
    return race === 'gnome' && skill === -P_CROSSBOW ? 1 : 0;
}
// Part of C dothrow.c:throw_obj(): the multishot calculation
// (dothrow.c:158-238) — the skill, role, race and quest-artifact bonuses,
// the crossbow strength cap, then the rnd() roll and the quantity and
// shotlimit clamps.
export function chooseHeroVolleyCount(item, { state = game, shotLimit = 0, random = rnd, } = {}) {
    requirePlayingGame(state);
    const quantity = Math.max(1, item?.quan ?? item?.quantity ?? 1);
    const launcher = launcherMatchesAmmo(item, state.uwep)
        ? state.uwep ?? null : null;
    const objectClass = item?.oclass || objectClassForType(item?.otyp);
    const canVolley = quantity > 1
        && (isLauncherAmmunition(item) ? !!launcher
            : objectClass === WEAPON_CLASS)
        && !state.u?.confused && !((state.u.confusionTurns ?? 0) > 0)
        && !state.u?.stunned && !((state.u.stunnedTurns ?? 0) > 0);
    if (!canVolley)
        return 1;
    const skill = objectSkill(item.otyp);
    const skillLevel = ensureHeroSkills(state)?.[Math.abs(skill)]?.skill ?? 0;
    const role = state.urole.key;
    const race = state.urace.name;
    const weak = weakMultishot(role, skill, state);
    let maximum = 1;
    if (skillLevel >= P_EXPERT)
        maximum++;
    if (skillLevel >= P_SKILLED && !weak)
        maximum++;
    maximum += multishotClassBonus(role, item, launcher, skill);
    if (!weak) {
        maximum += raceBonus(race, item, launcher, skill);
        if (launcher && isQuestArtifact(launcher, state))
            maximum++;
    }
    if (maximum > 1 && skill === -P_CROSSBOW
        && currentAttribute(A_STR, state) < (race === 'gnome' ? 16 : 18)) {
        maximum = random(maximum);
    }
    let count = Math.min(random(maximum), quantity);
    if (shotLimit > 0)
        count = Math.min(count, shotLimit);
    return count;
}
// C dothrow.c:ok_to_throw(): shared by #throw and #fire.  It rejects
// form capabilities before capacity and before either command chooses an
// object; M1_NOTAKE deliberately precedes M1_NOHANDS because forms such
// as brown molds satisfy both and own the stronger message.
async function okToThrow() {
    if (heroCannotTake(game)) {
        await pline('You are physically incapable of throwing or shooting anything.');
        game.context.move = 0;
        return false;
    }
    if (heroHasNoHands(game)) {
        await pline("You can't throw or shoot without hands.");
        game.context.move = 0;
        return false;
    }
    if (exceedsActionCapacity(game)) {
        await pline("You can't do that while carrying so much stuff.");
        game.context.move = 0;
        return false;
    }
    return true;
}
// C dothrow.c:dofire().  Also C dothrow.c:find_launcher(): inlined in the
// fireassist branch that prefers a matching known non-cursed launcher,
// then unknown BUC.
export async function dofire() {
    // C dothrow.c:ok_to_throw() reads the count from gc.command_count; a
    // queued dofire (fireassist swap chains) finds it untouched because
    // no parse() runs between the two commands.
    const shotLimit = Math.max(0, game._commandCount || 0);
    setMulti(0);
    if (!await okToThrow())
        return;
    let fireObject = game.uquiver;
    const weapon = game.uwep;
    const throwWielded = weapon && isAutoReturningThrow(weapon, weapon.owornmask ?? 0, game)
        && (artifactById(weapon.oartifact, game)?.name !== 'Mjollnir'
            || currentAttribute(A_STR) >= STR19(25))
        && (!fireObject || isLauncherAmmunition(fireObject));
    if (throwWielded)
        fireObject = weapon;
    let quiverSelectionSpentTime = false;
    if (!fireObject) {
        if (game.flags?.autoquiver) {
            fireObject = autoquiverCandidate(game);
            if (fireObject) {
                const wasReady = fireObject.ready;
                fireObject.ready = false;
                observeObjectForNaming(fireObject);
                await pline(`You ready: ${fireObject.invlet} - ${await inventoryItemDescription(fireObject)}.`);
                if (wasReady === undefined)
                    delete fireObject.ready;
                else
                    fireObject.ready = wasReady;
                await setQuiverObject(fireObject, game);
            }
            else {
                await pline('You have nothing appropriate for your quiver.');
            }
        }
        else {
            if (game.uwep && isPolearm(game.uwep))
                return applyPolearm(game.uwep, true);
            if (game.uwep?.otyp === BULLWHIP) {
                await applyTool(game.uwep, snapshotMenuUnderlay());
                return;
            }
            const alternate = game.uswapwep || game.u?.uswapwep;
            if (game.flags?.fireassist !== false && alternate && isPolearm(alternate)
                && !(alternate.cursed && alternate.bknown)) {
                // C dothrow.c:522-525: swap to the polearm and retry
                // fire, each as its own queued command.
                cmdq_add_ec(CQ_CANNED, 'doswapweapon');
                cmdq_add_ec(CQ_CANNED, 'dofire');
                game.context.move = 0;
                return;
            }
            await pline('You have no ammunition readied.');
        }
        if (!fireObject) {
            // A repeated direction cannot answer the empty-quiver picker.
            game._inDoAgain = false;
            const selection = await doquiverCore('fire');
            // doquiverCore() reports its own ECMD_CANCEL from the declined
            // verb prompt.
            if (selection.cancelled)
                return;
            fireObject = selection.item;
            quiverSelectionSpentTime = selection.spentTime;
        }
        if (!fireObject) {
            // dofire() keeps the quiver refill's ECMD_TIME in place of the
            // missing missile (dothrow.c:585).
            if (!quiverSelectionSpentTime)
                commandResultCancelled();
            return;
        }
    }
    // dothrow.c:dofire() routes launcher assistance through CQ_CANNED: a
    // matching alternate weapon is swapped in as one timed action, then fire
    // resumes after the complete monster/global turn without consuming a new
    // physical key.  This applies to every matching ammo/launcher pair; role
    // names and recorded command streams do not participate in selection.
    if (fireObject) {
        const matchingLauncher = (launcher) => launcherMatchesAmmo(fireObject, launcher);
        const alternate = game.uswapwep || game.u?.uswapwep || null;
        const fireassist = !throwWielded && game.flags?.fireassist !== false;
        if (fireassist && isLauncherAmmunition(fireObject) && game.uwep && isPolearm(game.uwep)
            && couldPoleMonster(game.uwep, { state: game })) {
            return applyPolearm(game.uwep, true);
        }
        if (fireassist && !matchingLauncher(game.uwep)
            && matchingLauncher(alternate)) {
            // C dothrow.c:567-569: swap weapons and retry fire.
            cmdq_add_ec(CQ_CANNED, 'doswapweapon');
            cmdq_add_ec(CQ_CANNED, 'dofire');
            game.context.move = quiverSelectionSpentTime ? 1 : 0;
            return;
        }
        if (fireassist && !matchingLauncher(game.uwep)) {
            // dothrow.c:find_launcher() scans the live inventory chain.  A
            // known cursed launcher is ineligible; the first known blessed
            // or uncursed match wins immediately, while only the first
            // unknown-BUC match is retained as a fallback.
            let unknownLauncher = null;
            let inventoryLauncher = null;
            for (const candidate of game.inventory || []) {
                if (candidate.cursed && candidate.bknown)
                    continue;
                if (!matchingLauncher(candidate))
                    continue;
                if (candidate.bknown) {
                    inventoryLauncher = candidate;
                    break;
                }
                if (!unknownLauncher)
                    unknownLauncher = candidate;
            }
            inventoryLauncher ||= unknownLauncher;
            if (inventoryLauncher) {
                if (!inventoryLauncher.invlet)
                    throw new Error('Cannot queue a wield command for an object without an inventory letter.');
                // C dothrow.c:573-577: push the old weapon aside, wield
                // the launcher, and retry fire.
                if (game.uwep && !game.flags?.pushweapon)
                    cmdq_add_ec(CQ_CANNED, 'doswapweapon');
                cmdq_add_ec(CQ_CANNED, 'dowield');
                cmdq_add_key(CQ_CANNED, inventoryLauncher.invlet.charCodeAt(0));
                cmdq_add_ec(CQ_CANNED, 'dofire');
                game.context.move = quiverSelectionSpentTime ? 1 : 0;
                return;
            }
        }
        await throwCommand(fireObject, true, shotLimit);
        // dofire() returns the quiver refill's ECMD_TIME in place of the
        // cancelled throw's ECMD_CANCEL (dothrow.c:585), so a refill that
        // spent the turn drops the throw's cancellation.
        if (quiverSelectionSpentTime) {
            beginCommandResult();
            game.context.move = 1;
        }
        return;
    }
}
// C dothrow.c:endmultishot(): if a volley is in flight, the current
// projectile finishes and becomes the last one.  C keeps gm.m_shot in
// global state, so end.c:savelife() cuts a hero's in-flight volley short
// through endmultishot(FALSE) without the announcement; the throw loop
// registers the shared volley object here by reference.
let activeVolley = null;
function beginHeroVolley(volley) {
    activeVolley = volley;
}
function finishHeroVolley() {
    activeVolley = null;
}
export async function endmultishot(verbose, volley = activeVolley, state = game) {
    if (!volley || volley.index >= volley.count)
        return;
    // end.c:savelife() passes FALSE; a monster-moving truncation would cut
    // a volley that no longer belongs to the hero's command.
    if (!verbose && state.context.mon_moving)
        return;
    if (verbose && !state.context.mon_moving) {
        const index = volley.index;
        const suffix = index % 100 >= 11 && index % 100 <= 13 ? 'th'
            : index % 10 === 1 ? 'st' : index % 10 === 2 ? 'nd'
                : index % 10 === 3 ? 'rd' : 'th';
        await plineWithContinuation(`You stop ${volley.shooting ? 'firing' : 'throwing'} after the ${index}${suffix} ${volley.shooting ? 'shot' : 'toss'}.`);
    }
    // Keep the count live so remaining contact messages see the limit.
    volley.count = volley.index;
}
async function finishOrdinarySwallowedThrowKill(monster, projectile, options = {}) {
    return finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, {
        ...options,
        deathContext: {
            kind: 'swallowed-projectile',
            projectile,
        },
    });
}
async function finishOrdinarySwallowedConsumedKill(monster, kind, death = {}) {
    return finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, {
        ...death,
        deathContext: {
            kind,
        },
    });
}
async function finishOrdinaryMapPotionKill(monster, death = {}) {
    return finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, death);
}
// C dothrow.c:dothrow().  Prior to 3.6.0 the count prefix meant one throw
// per turn; ok_to_throw() now sets the shot limit for the whole volley.
export async function dothrow(selectedItem = null) {
    await throwCommand(selectedItem);
}
// C dothrow.c:autoquiver().  The four buckets deliberately have different
// overwrite policies and final precedence.  This is not a first-match or
// generic-throwability search.
export function autoquiverCandidate(state) {
    if (state.uquiver)
        return state.uquiver;
    let currentAmmo = null;
    let missile = null;
    let alternateAmmo = null;
    let miscellaneous = null;
    const currentSling = !!state.uwep && objectSkill(state.uwep.otyp) === P_SLING;
    for (const item of state.inventory || []) {
        if (item.owornmask || item.worn || item.wielded
            || item.alternate || item.ready
            || item === state.uwep || item === state.uswapwep
            || item.oartifact || item.artifact || !item.dknown) {
            continue;
        }
        const objectClass = quiverObjectClass(item);
        const knownType = objectTypeKnown(item, state);
        const ordinarySlingStone = item.otyp === ROCK
            || (item.otyp === FLINT && knownType)
            || (objectClass === GEM_CLASS
                && objectMaterial(item.otyp) === 19 && knownType);
        if (ordinarySlingStone) {
            if (currentSling)
                currentAmmo = item;
            else if (launcherMatchesAmmo(item, state.uswapwep))
                alternateAmmo = item;
            else if (!miscellaneous)
                miscellaneous = item;
        }
        else if (objectClass === GEM_CLASS) {
            continue;
        }
        else if (isLauncherAmmunition(item)) {
            if (launcherMatchesAmmo(item, state.uwep))
                currentAmmo = item;
            else if (launcherMatchesAmmo(item, state.uswapwep))
                alternateAmmo = item;
            else
                miscellaneous = item;
        }
        else if (isMissileObject(item)) {
            missile = item;
        }
        else if (objectClass === WEAPON_CLASS && isThrowingWeapon(item)) {
            if (objectSkill(item.otyp) === P_DAGGER && !missile)
                missile = item;
            else if (item.otyp !== AKLYS)
                miscellaneous = item;
        }
    }
    return currentAmmo || missile || alternateAmmo || miscellaneous;
}
// C dothrow.c:throw_obj().  Also C artifact.c:is_art(): inlined here; the
// Mjollnir checks (wielded before throwing, strength minimum, getobj
// suggestion) compare oartifact names.
// Also C dothrow.c:throw_ok(): inlined as the throwClassification callback
// passed to the inventory chooser.  Splitting the selected arrow stack
// makes a new object id, then obj_resists() is consulted when it lands.
async function throwCommand(selectedItem = null, capabilityChecked = false, suppliedShotLimit = null) {
    const shotLimit = suppliedShotLimit === null
        ? Math.max(0, game._commandCount || 0)
        : Math.max(0, suppliedShotLimit || 0);
    requireInitializedHero(game.u);
    setMulti(0);
    if (!capabilityChecked && !await okToThrow())
        return;
    // getobj("throw") changes its suggested class when the primary weapon is
    // a sling: ordinary weapons become downplayed and GEM_CLASS sling ammo is
    // suggested instead.  Every directly selected inventory letter remains
    // valid even when downplayed.
    const launcher = game.uwep;
    const wieldingSling = !!launcher
        && objectSkill(launcher.otyp) === objectSkill(SLING);
    // C getobj() sorts its candidates independently of the carried chain.
    const throwClassification = (item) => {
        const objectClass = item.oclass || objectClassForType(item.otyp);
        if (item.bknown && isWeldedPrimary(item))
            return GETOBJ_DOWNPLAY;
        if (item.otyp === BOOMERANG || item === game.uwep && (item.otyp === AKLYS
            || artifactById(item.oartifact)?.name === 'Mjollnir'
                && game.urole?.key === 'valkyrie' && currentAttribute(A_STR) >= STR19(25)))
            return GETOBJ_SUGGEST;
        if (item.quan === 1 && (item === game.uwep || item === game.uswapwep && game.u.twoweap))
            return GETOBJ_DOWNPLAY;
        return objectClass === COIN_CLASS || objectClass === (wieldingSling ? GEM_CLASS : WEAPON_CLASS)
            || item.otyp === BOULDER && (monsterThrowsRocks(game.u.umonnum ?? -1))
            ? GETOBJ_SUGGEST : GETOBJ_DOWNPLAY;
    };
    if (!selectedItem) {
        selectedItem = await chooseInventoryObject('throw', throwClassification, { forcePrompt: true, allowCount: true });
    }
    const item = selectedItem;
    if (!item) {
        commandResultCancelled(); // dothrow.c:dothrow() getobj ECMD_CANCEL.
        return;
    }
    const previous = game.inventory[game.inventory.indexOf(item) - 1];
    const splitParent = previous && previous.invlet === item.invlet ? previous : null;
    const selectedObjectClass = item.oclass || objectClassForType(item.otyp);
    const selectedIsGold = selectedObjectClass === COIN_CLASS;
    const directGoldThrow = selectedIsGold && item !== game.uquiver;
    const direction = await promptDirection();
    if (!direction) {
        if (splitParent)
            await rejoinObjectStack(splitParent, item, game);
        // getdir() already cleared its prompt; a message it printed for
        // the rejected key ("What a strange direction!") stays visible in
        // C because throw_obj() just returns ECMD_CANCEL (dothrow.c).
        commandResultCancelled(); // throw_obj() getdir ECMD_CANCEL.
        return;
    }
    const { dx, dy, dz } = direction;
    const selfThrow = !dx && !dy && !dz;
    if (directGoldThrow) {
        if (selfThrow) {
            if (splitParent)
                await rejoinObjectStack(splitParent, item, game);
            await pline('You cannot throw gold at yourself.');
            commandResultCancelled(); // throw_gold() self ECMD_CANCEL.
            game.context.move = 0;
            return;
        }
        await resolveDirectGoldThrow({
            state: game,
            gold: item,
            dx, dy, dz,
            wakeMonster: wakeAttackedMonster,
            angerMonster: angerAttackedMonster,
        });
        game.context.move = 1;
        return;
    }
    if (!await canLetGo(item, 'throw')) {
        if (splitParent)
            await rejoinObjectStack(splitParent, item, game);
        game.context.move = 0;
        return;
    }
    const mjollnir = artifactById(item.oartifact, game)?.name === 'Mjollnir';
    if (mjollnir && item !== game.uwep) {
        if (splitParent)
            await rejoinObjectStack(splitParent, item, game);
        await pline(`The ${objectName(item)} must be wielded before it can be thrown.`);
        game.context.move = 0;
        return;
    }
    if (mjollnir && currentAttribute(A_STR) < STR19(25)
        || item.otyp === BOULDER
            && !monsterThrowsRocks(game.u.umonnum)) {
        if (splitParent)
            await rejoinObjectStack(splitParent, item, game);
        await pline("It's too heavy.");
        game.context.move = 1;
        return;
    }
    if (selfThrow) {
        if (splitParent)
            await rejoinObjectStack(splitParent, item, game);
        await pline('You cannot throw an object at yourself.');
        game.context.move = 0;
        return;
    }
    wipeHeroEngraving(2);
    if (!(game.uarmg || game.u.uarmg) && item.otyp === CORPSE
        && touchPetrifies(item.corpsenm) && !heroResistsStoning(game)) {
        await plineWithContinuation(`You throw ${corpseName(item, { definite: true })} with your bare ${makePlural(body_part(HAND, game))}.`);
        const result = await resolveImmediatePetrification({
            state: game,
            killer: `throwing ${killerObjectName(item, game)} bare-handed`,
        });
        if (result.died || game.program_state.gameover)
            return;
    }
    if (isWetTowel(item))
        await dryTowel(item, -1);
    const volleyCount = chooseHeroVolleyCount(item, { state: game, shotLimit });
    if (volleyCount > 1 || shotLimit > 0) {
        if (volleyCount === 1)
            observeObjectForNaming(item);
        const noun = volleyCount === 1
            ? singularObjectName(item) : objectCombatName(item, { includeCorpseSpecies: false });
        await plineWithContinuation(`You ${launcherMatchesAmmo(item, game.uwep) ? 'shoot' : 'throw'} ${volleyCount} ${noun}.`);
    }
    const volley = {
        count: volleyCount, index: 1, objectType: item.otyp,
        shooting: launcherMatchesAmmo(item, game.uwep),
    };
    // end.c:savelife() truncates m_shot so a life-saved hero fires no
    // further missiles; the loop reads the shared volley for that cut.
    beginHeroVolley(volley);
    try {
        for (; volley.index <= volley.count; volley.index++) {
            const stopVolley = await throwSelectedUnit(item, dx, dy, volley);
            if (game.program_state.gameover)
                return;
            await encumber_msg(game);
            if (game.program_state.gameover || stopVolley)
                break;
        }
    }
    finally {
        finishHeroVolley();
    }
    game.context.move = 1;
}
// throw_obj() hands off one missile at a time. An engulfer can die during a
// volley, so every remaining missile must choose its current destination.
async function throwSelectedUnit(item, dx, dy, volley) {
    if (item.oclass === COIN_CLASS && item === game.uquiver) {
        await resolveQuiveredGoldThrow({
            state: game,
            gold: item,
            dx, dy, dz: game.u.dz ?? 0,
            wakeMonster: wakeAttackedMonster,
        });
        return false;
    }
    const selectedQuantity = item.quantity ?? item.quan ?? 1;
    const thrownObjectClass = item.oclass || objectClassForType(item.otyp);
    if (await resolveSwallowedEggPieOrVenomThrow({
        state: game,
        item,
        selectedQuantity,
        finishKill: (monster) => finishOrdinarySwallowedConsumedKill(monster, item.otyp === EGG ? 'swallowed-egg' : 'swallowed-venom'),
    }))
        return false;
    if (await resolveSwallowedWeaponThrow({
        state: game,
        item,
        objectClass: thrownObjectClass,
        selectedQuantity,
        volley,
        finishKill: finishOrdinarySwallowedThrowKill,
    }))
        return false;
    if (await resolveSwallowedPotionThrow({
        state: game,
        item,
        objectClass: thrownObjectClass,
        selectedQuantity,
        wakeMonster: wakeAttackedMonster,
        wakeNearby: wakeMonstersNearWithMessages,
        finishKill: (monster, death) => finishOrdinarySwallowedConsumedKill(monster, 'swallowed-potion', death),
    }))
        return false;
    if (await resolveSwallowedFoodThrow({
        state: game,
        item,
        objectClass: thrownObjectClass,
        selectedQuantity,
        wakeMonster: wakeAttackedMonster,
    }))
        return false;
    if (await resolveGenericSwallowedThrow({
        state: game,
        item,
        objectClass: thrownObjectClass,
        selectedQuantity,
        wakeMonster: wakeAttackedMonster,
    }))
        return false;
    if (game.u?.uswallow) {
        // Every swallowed object class owns a monster-contact continuation
        // above: C's throwit() never reaches its flight or floor paths
        // while u.uswallow (dothrow.c:1569-1578, 1704-1706).
        throw new Error('a swallowed throw reached no engulfer contact arm');
    }
    if (!game.u?.uswallow && await resolveMapPotionThrow({
        state: game,
        item,
        objectClass: thrownObjectClass,
        selectedQuantity,
        dx,
        dy,
        wakeMonster: wakeAttackedMonster,
        wakeNearby: wakeMonstersNearWithMessages,
        finishKill: finishOrdinaryMapPotionKill,
    }))
        return false;
    if (!game.u?.uswallow && thrownObjectClass === POTION_CLASS)
        throw new Error('map potion impact is not implemented');
    const shotResult = await throwOrdinaryObject({
        state: game,
        item,
        quantity: selectedQuantity,
        dx,
        dy,
        volley,
    });
    return 'stopVolley' in shotResult && !!shotResult.stopVolley;
}
// C dothrow.c:tmiss(). Concealed targets are omitted even when sensed;
// the caller owns whether a missed throw wakes the target.
export async function reportHeroThrownMiss(monster, object, { state = game, publish = plineWithContinuation, volley, target = { x: monster.mx, y: monster.my }, } = {}) {
    const name = captureHeroProjectileName(object, state, volley);
    const appearance = M_AP_TYPE(monster);
    if (!canSeeMonster(monster) || appearance !== 0 && appearance !== M_AP_MONSTER) {
        const verb = objectNameIsPlural(object, state) ? 'miss' : 'misses';
        await publish(`${capitalizedDefiniteName(name, state)} ${verb}.`);
    }
    else
        await publish(rayMissMessage(name, monster, { ...target, state }));
}
function canResolveMapPotionThrow({ state, item, objectClass, selectedQuantity, dx, dy, }) {
    if (state.u?.uswallow || objectClass !== POTION_CLASS
        || !SUPPORTED_MONSTER_POTION_TYPES.has(item?.otyp)
        || !Number.isInteger(selectedQuantity) || selectedQuantity < 1
        || !Number.isInteger(dx) || !Number.isInteger(dy))
        return false;
    return true;
}
function distanceFromHero(state, x, y) {
    return dist2(state.u.ux, state.u.uy, x, y);
}
function hitMonsterWithThrownPotion({ state, monster, potion, wakeMonster, wakeNearby, finishKill, publish, }) {
    return hitMonsterWithSupportedPotion({
        state,
        monster,
        potion,
        wakeMonster,
        wakeNearby,
        finishKill,
        publish,
        targetVisible: cansee(monster.mx, monster.my),
        resolveVapor: true,
        distance: distanceFromHero(state, monster.mx, monster.my),
    });
}
export async function resolveMapPotionThrow({ state = game, item, objectClass, selectedQuantity, splitObjectId = null, dx, dy, wakeMonster = null, wakeNearby = null, finishKill = null, publish = plineWithContinuation, }) {
    if (!canResolveMapPotionThrow({
        state, item, objectClass, selectedQuantity, dx, dy,
    }))
        return false;
    const thrown = await detachThrownUnit(state, item, selectedQuantity, splitObjectId);
    try {
        if (state.program_state?.gameover)
            return true;
        // In C, slipping or low stamina changes the direction after the potion
        // leaves inventory and before it begins moving across the map.
        await applyThrowSlip({ state, object: thrown, publish });
        await applyLowStaminaThrow({ state, object: thrown, publish });
        if (state.u?.dz) {
            const steed = state.u.dz > 0 ? state.u.usteed : null;
            if (steed && rn2(6) !== 0) {
                const impact = await hitMonsterWithThrownPotion({
                    state,
                    monster: steed,
                    potion: thrown,
                    wakeMonster,
                    wakeNearby,
                    finishKill,
                    publish,
                });
                if (impact?.heroDied)
                    return true;
                state.context.move = 1;
                return true;
            }
            if (state.u.dz > 0) {
                await hitFloorWithObject(thrown, { state, publish });
            }
            else {
                await tossObjectUp(thrown, { state, publish });
            }
            state.context.move = 1;
            return true;
        }
        const actualDx = state.u?.dx ?? dx;
        const actualDy = state.u?.dy ?? dy;
        const underwater = state.underwater || state.u?.uinwater;
        const trajectory = underwater
            ? { range: 1, recoil: 0 }
            : heroThrowTrajectory(thrown, state);
        requirePlayingGame(state);
        const flight = await flyHeroThrownObject({
            state,
            object: thrown,
            dx: actualDx,
            dy: actualDy,
            range: trajectory.range,
            display: monsterProjectileDisplay(thrown, state),
            publish,
        });
        if (trajectory.recoil) {
            await hurtleHero(-actualDx, -actualDy, trajectory.recoil, { verbose: true });
            // C throwit() recoils after bhit() (dothrow.c:1682); a fatal
            // hurtle ends in done(), which never returns, so the potion
            // never hits its target or landing square afterwards.
            if (state.program_state?.gameover)
                return true;
        }
        if (flight.destroyed) {
            state.context.move = 1;
            return true;
        }
        if (flight.contact) {
            prepareHeroThrownTarget(flight.contact);
            rnd(20); // thitmonst() computes this before the potion class test
            if (currentAttribute(A_DEX, state) > rnd(25)) {
                const impact = await hitMonsterWithThrownPotion({
                    state,
                    monster: flight.contact,
                    potion: thrown,
                    wakeMonster,
                    wakeNearby,
                    finishKill,
                    publish,
                });
                if (impact?.heroDied)
                    return true;
                state.context.move = 1;
                return true;
            }
            const food = await offerThrownFood(flight.contact, thrown, state);
            if (food?.heroDied || food?.handled)
                return true;
            if (!food) {
                await reportHeroThrownMiss(flight.contact, thrown, { state, publish });
                if (rn2(3) === 0 && (await wakeMonster?.(flight.contact))?.heroDied)
                    return true;
            }
        }
        await finishHeroThrownObjectLanding({
            state,
            object: thrown,
            x: flight.x,
            y: flight.y,
            contactedMonster: flight.contact,
            publish,
        });
        state.context.move = 1;
        return true;
    }
    finally {
        if (state._thrownObject === thrown)
            state._thrownObject = null;
    }
}
// ---------------------------------------------------------------------------
// Moving a monster after a forceful hit.
// C refs: dothrow.c:will_hurtle()/mhurtle()/mhurtle_to_doom()/mhitm_knockback().
// ---------------------------------------------------------------------------
const S_EYE = 5;
const S_LIGHT = 25;
const PM_GRID_BUG = 116;
function monsterAt(state, x, y, ignoredMonster) {
    return state.level?.monsters?.find(monster => monsterHasMapPosition(monster, state) &&
        monster !== ignoredMonster && !monster.dead
        && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}
export function staggerVerb(mnum) {
    const symbol = MONSTER_SYMBOL[mnum];
    if (symbol === S_EYE || symbol === S_LIGHT)
        return 'wobbles';
    if (monsterIsFlyer(mnum))
        return (MONSTER_SIZE[mnum] ?? 2) <= 1
            ? 'flutters' : 'staggers';
    if (monsterIsSlithy(mnum))
        return 'falters';
    if (monsterIsAmorphous({ mnum }))
        return 'trembles';
    if ((MONSTER_MOVE[mnum] ?? 0) === 0)
        return 'pulsates';
    if (monsterHasNoLimbs(mnum))
        return 'falters';
    return 'staggers';
}
// Both hurtle collision paths supply a silent death handler after the trap
// owner has credited the kill, matching minstapetrify(mon, TRUE).
function silentHeroStoning(finishMonsterDeath) {
    return (monster, death = {}) => finishMonsterDeath(monster, {
        ...death, showKillMessage: false, recordConduct: false,
    });
}
async function hurtleOneSquare(monster, dx, dy, { state, announce, nameMonster, finishMonsterDeath, monsterMoving, random, }) {
    const oldX = monster.mx;
    const oldY = monster.my;
    const nextX = oldX + dx;
    const nextY = oldY + dy;
    if (!willMonsterHurtle(monster, state, nextX, nextY, random)) {
        const occupant = monsterAt(state, nextX, nextY, monster);
        if (occupant) {
            if (canSeeMonster(monster)
                || canSeeMonster(occupant)) {
                await announce(`${monsterName(monster, { state, capitalized: true })} bumps into ${monsterName(occupant, { state, article: 'a' })}.`);
            }
            await awakenMonster(occupant, { attacked: !monsterMoving });
            const contact = monsterMoving
                ? { publish: announce, finishDeath: finishMonsterDeath }
                : { publish: announce, finishDeath: silentHeroStoning(finishMonsterDeath), creditHero: true };
            if (touchPetrifies(occupant.mnum) && !monsterWearsTorsoArmor(monster)) {
                await petrifyMonsterImmediately(monster, contact);
                await newsym(monster.mx, monster.my);
            }
            if (touchPetrifies(monster.mnum) && !monsterWearsTorsoArmor(occupant)) {
                await petrifyMonsterImmediately(occupant, contact);
                await newsym(occupant.mx, occupant.my);
            }
        }
        else if (nextX === state.u.ux && nextY === state.u.uy) {
            // C Some_Monnam(): an unseen hurtler is "Someone" or "Something".
            await announce(`${monsterName(monster, { state, capitalized: true, augmentIt: true })} bumps into you.`);
            await stopHeroOccupation(state, announce);
            if (touchPetrifies(state.u.umonnum) && !monsterWearsTorsoArmor(monster)) {
                await petrifyMonsterImmediately(monster, {
                    publish: announce, finishDeath: silentHeroStoning(finishMonsterDeath), creditHero: true,
                });
                await newsym(monster.mx, monster.my);
            }
            const torsoArmor = state.inventory.some(object => (object.owornmask ?? 0) & (W_ARM | W_ARMC | W_ARMU));
            if (touchPetrifies(monster.mnum) && !torsoArmor) {
                const noun = nameMonster(monster).replace(/^(?:the|The|your) /u, '');
                await resolveImmediatePetrification({
                    state, publish: announce,
                    killer: `being hit by ${monster.mtame ? 'your' : 'a'} hurtling ${noun}`,
                });
            }
        }
        return { moved: false, dead: !!monster.dead || monster.mhp <= 0, occupant };
    }
    updateMonsterRegions(monster, state, { x: nextX, y: nextY });
    monster.mx = nextX;
    monster.my = nextY;
    await newsym(oldX, oldY);
    if (monster === state.u.usteed) {
        state.u.ux0 = state.u.ux;
        state.u.uy0 = state.u.uy;
        state.u.ux = nextX;
        state.u.uy = nextY;
        await vision_recalc(0);
    }
    await newsym(nextX, nextY);
    await flush_screen(1);
    await state.animationFrame?.();
    setMonsterApparentHeroPosition(monster, state, random);
    if (IS_WATERWALL(state.level.requireAt(nextX, nextY).typ))
        return { moved: true, stopped: true };
    await applyHurtleTrap(monster, { state, announce, finishMonsterDeath, random }, 'in-flight');
    return {
        moved: true,
        dead: !!monster.dead || monster.mhp <= 0,
        stopped: !!monster.mtrapped || !monster.mcanmove
            || monster.mx !== nextX || monster.my !== nextY
            || (monster !== state.u.usteed && !state.level.monsters.includes(monster)),
    };
}
// C dothrow.c:mhurtle_step() calls mintrap(HURTLING) on each square; mhurtle()
// ends with mintrap(FORCEBUNGLE), which still rolls a known trap's avoidance.
async function applyHurtleTrap(monster, options, stage) {
    const { state, announce, finishMonsterDeath, random } = options;
    await mintrap(monster, state, {
        ...(stage === 'in-flight' ? { inAir: true } : { forcebungle: true }),
        random,
        publish: announce,
        finishDeath: async (target, death) => {
            const outcome = await finishMonsterDeath(target, death);
            if (typeof outcome === 'boolean')
                return { survived: !outcome };
            if ('survived' in outcome)
                return outcome;
            return { survived: !outcome.killed, heroDied: outcome.heroDied };
        },
    });
}
// C dothrow.c:mhurtle().  A monster moves through the air for a few
// squares; mhurtle_step() walks the path and mintrap()/minliquid() settle
// the landing.
export async function hurtleMonster(monster, dx, dy, distance, options = {}) {
    const { monsterMoving = false, state = game, announce = plineWithContinuation, nameMonster = monsterSentenceSubject, random = rn2, } = options;
    requirePlayingGame(state);
    const wakeMonster = options.wakeMonster
        || (() => awakenMonster(monster, { attacked: !monsterMoving }));
    const finishMonsterDeath = options.finishMonsterDeath
        || ((target, death) => finishEnvironmentalMonsterDeath(target, state, {
            ...death, publish: announce, random,
        }));
    const active = {
        state, announce, nameMonster, random, monsterMoving,
        finishMonsterDeath,
        finishLiquidDeath: options.finishLiquidDeath || ((target, liquid) => finishMonsterDeath(target, {
            random: liquid.random,
            noCorpse: !liquid.leaveCorpse,
            sadFeeling: liquid.sadFeeling,
            publish: liquid.publish,
        })),
    };
    const waking = await wakeMonster();
    if (waking?.heroDied)
        return { moved: false, dead: false, heroDied: true };
    monster.movement = 0;
    monster.mstun = 1;
    if ((MONSTER_SIZE[monster.mnum] ?? 0) >= 4 || monster === state.u.ustuck || monster.mtrapped) {
        if (canSeeMonster(monster))
            await announce(`${monsterName(monster, { state, capitalized: true })} doesn't budge!`);
        return { moved: false, dead: false };
    }
    dx = Math.sign(dx);
    dy = Math.sign(dy);
    if (!distance || (!dx && !dy) || (dx && dy && monster.mnum === PM_GRID_BUG))
        return { moved: false, dead: false };
    if (monster.mundetected) {
        monster.mundetected = 0;
        await newsym(monster.mx, monster.my);
    }
    monster.m_ap_type = 0;
    monster.mappearance = 0;
    let result = { moved: false, dead: false };
    for (let step = 0; step < distance; step++) {
        const next = await hurtleOneSquare(monster, dx, dy, active);
        result = { ...next, moved: result.moved || next.moved };
        if (!next.moved || next.dead || next.stopped)
            break;
    }
    if (!monster.dead && monster.mhp > 0
        && (monster === state.u.usteed || state.level.monsters.includes(monster))) {
        if (state.level.traps.some(trap => trap.tx === monster.mx && trap.ty === monster.my))
            await applyHurtleTrap(monster, active, 'landing');
        else
            await resolveMonsterLiquid(monster, state, {
                announce, finishDeath: active.finishLiquidDeath,
                monsterMoving,
            });
    }
    result.dead = !!monster.dead || monster.mhp <= 0;
    return result;
}
// C dothrow.c:will_hurtle(): the size, holder and trap gates, then goodpos()
// decides the destination. goodpos() draws rn2(13) for an S_EEL monster even
// though MM_IGNOREWATER discards the result, shifting the draws after it.
export function willMonsterHurtle(monster, state, x, y, random = rn2) {
    if ((MONSTER_SIZE[monster.mnum] ?? 2) >= 4
        || monster === state.u?.ustuck || monster.mtrapped)
        return false;
    return goodPosition(x, y, { kind: 'monster', monster }, {
        state, gpflags: MM_IGNOREWATER | MM_IGNORELAVA, random,
    });
}
// C dothrow.c:gem_accept(), reached from thitmonst()'s unicorn catch
// (dothrow.c:2087-2099).  Null means ordinary combat; false means caught
// or missed but still free.
export async function offerUnicornGem(monster, object, state) {
    if (object.oclass !== GEM_CLASS || !monsterIsUnicorn(monster.mnum)
        || objectMaterial(object, state) === MINERAL
        || state.uwep && objectSkill(state.uwep.otyp) === P_SLING)
        return null;
    if (!monster.mcanmove || monster.msleeping) {
        await reportHeroThrownMiss(monster, object, { state });
        return false;
    }
    const subject = monsterName(monster, { state, capitalized: true });
    const gem = definiteName(objectName(object, state), state);
    await plineWithContinuation(`${subject} catches${monster.mtame ? ' and drops' : ''} ${gem}.`);
    if (monster.mtame)
        return false;
    const reactionSubject = monsterName(monster, { state, capitalized: true });
    monster.mpeaceful = 1;
    monster.mavenge = 0;
    const aligned = Math.sign(MONSTER_ALIGNMENT[monster.mnum] ?? 0)
        === Math.sign(state.u.ualign?.type ?? 0);
    const realGem = objectMaterial(object, state) === GEMSTONE;
    const identified = object.dknown && objectTypeKnown(object, state);
    const guessed = !!(object.oextra?.oname || object.oname
        || state._objectCallNames?.[object.otyp]);
    const accepted = realGem || !(identified || guessed);
    let reaction = ' is not interested in your junk.';
    if (accepted) {
        let appreciation = 'graciously';
        if (realGem) {
            let luck;
            if (aligned) {
                luck = 1;
                if (guessed)
                    luck = 2;
                if (identified)
                    luck = 5;
            }
            else {
                luck = identified ? rn2(7) - 3 : rn2(3) - 1;
            }
            state.u.uluck = Math.max(-13, Math.min(13, (state.u.uluck ?? 0) + luck));
            appreciation = aligned ? 'gratefully' : 'hesitatingly';
        }
        reaction = ` ${appreciation} accepts your gift.`;
        if (state.u.ushops.length || object.unpaid)
            await settleThrownShopObject(object, monster.mx, monster.my, state, plineWithContinuation, { broken: true });
        await addObjectToMonsterInventory(monster, object, state);
    }
    if (!heroIsBlind(state))
        await plineWithContinuation(reactionSubject + reaction);
    if (!await reportMonsterTeleportRestriction(monster, { state }))
        await randomMonsterRelocation(monster, { state, flags: RLOC_MSG });
    return accepted;
}
// C dothrow.c:omon_adj(), shared by thitmonst()'s to-hit roll and the
// monster ranged attack.  Weapon.c WEAPON_CLASS/GEM_CLASS/TOOL_CLASS feed
// the hitval() branch below.
export function rangedTargetHitBonus(object, defender, { state = game, defenderNotices = false, random = rn2, rollOne = rnd, } = {}) {
    const size = MONSTER_SIZE[defender.mnum];
    if (size === undefined)
        throw new RangeError(`Unknown ranged defender species ${defender.mnum}`);
    let bonus = size - 2;
    if (defender.msleeping)
        bonus += 2;
    const speciesCanMove = MONSTER_MOVE[defender.mnum] !== 0;
    if (!defender.mcanmove || !speciesCanMove) {
        bonus += 4;
        if (defenderNotices && speciesCanMove && random(10) === 0) {
            defender.mcanmove = 1;
            defender.mfrozen = 0;
        }
    }
    if (object.otyp === HEAVY_IRON_BALL) {
        if (object !== state.uball)
            bonus += 2;
    }
    else if (object.otyp === BOULDER) {
        bonus += 6;
    }
    else if (object.oclass === WEAPON_CLASS || object.oclass === GEM_CLASS
        || isWeaponTool(object)) {
        bonus += weaponHitValue(object, defender, { state, random, rollOne });
    }
    return bonus;
}
// Part of C dothrow.c:thitmonst(): the base target number
// (dothrow.c:2027-2076) keys off C's Upolyd; Dexterity replaces Strength,
// distance and target size apply through omon_adj(), and a guaranteed hit
// while swallowed adds the +1000 that no roll can beat.
function heroIsPolymorphed(state) {
    return Upolyd(state.u);
}
function heroStillHasTheirRace(state) {
    if (!heroIsPolymorphed(state))
        return true;
    const raceFlag = state.urace?.selfmask;
    return !!raceFlag
        && !!(your_race(state.u.umonnum, state));
}
function bowGlovePenalty(state) {
    if (!state.uwep || objectSkill(state.uwep.otyp) !== P_BOW)
        return 0;
    const gloves = state.uarmg || state.u?.uarmg;
    if (gloves?.otyp === GAUNTLETS_OF_POWER)
        return -2;
    if (gloves?.otyp === GAUNTLETS_OF_FUMBLING)
        return -3;
    return 0;
}
function bowTrainingHitBonus(state, launcher) {
    if (objectSkill(launcher?.otyp) !== P_BOW
        || !heroStillHasTheirRace(state))
        return 0;
    const elf = state.urace.name === 'elf';
    const samurai = state.urole?.key === 'samurai';
    if (!elf && !samurai)
        return 0;
    const ownBow = (elf && launcher.otyp === ELVEN_BOW)
        || (samurai && launcher.otyp === YUMI);
    return ownBow ? 2 : 1;
}
function dexterityHitBonus(state) {
    const dexterity = currentAttribute(A_DEX, state);
    if (dexterity < 4)
        return -3;
    if (dexterity < 6)
        return -2;
    if (dexterity < 8)
        return -1;
    return dexterity >= 14 ? dexterity - 14 : 0;
}
function baseRangedHitThreshold(monster, weapon, state, random) {
    const distance = Math.max(Math.abs(monster.mx - state.u.ux), Math.abs(monster.my - state.u.uy));
    const polymorphed = heroIsPolymorphed(state);
    const heroLevel = polymorphed
        ? MONSTER_LEVEL[state.u?.umonnum]
            ?? state.u?.ulevel ?? 1
        : state.u?.ulevel ?? 1;
    const threshold = -1
        + Luck(state.u)
        + findMonsterArmorClass(monster)
        + (state.u?.uhitinc ?? 0)
        + heroLevel
        + dexterityHitBonus(state)
        + Math.max(-4, 3 - distance)
        + bowGlovePenalty(state)
        + rangedTargetHitBonus(weapon, monster, { state, defenderNotices: true, random });
    const targetIsOrc = is_orc(monster.mnum);
    const heroIsElf = polymorphed
        ? is_elf(state.u?.umonnum)
        : state.urace.name === 'elf';
    return threshold + (targetIsOrc && heroIsElf ? 1 : 0);
}
function throwingHitBonus(monster, weapon, state) {
    if (isLauncherAmmunition(weapon)) {
        const launcher = state.uwep;
        if (!launcher || !launcherMatchesAmmo(weapon, launcher))
            return -4;
        const erosion = Math.max(launcher.oeroded ?? 0, launcher.oeroded2 ?? 0);
        return launcher.spe - erosion
            + weaponSkillHitBonus(launcher, state)
            + artifactToHitBonus(launcher, monster, rnd, { state })
            + bowTrainingHitBonus(state, launcher);
    }
    const bonus = weapon.otyp === BOOMERANG ? 4
        : isThrowingWeapon(weapon) ? 2 : -2;
    return bonus + weaponSkillHitBonus(weapon, state);
}
function rangedObjectUsesWeaponHit(object) {
    const objectClass = object.oclass ?? objectClassForType(object.otyp);
    const skill = objectSkill(object.otyp);
    return objectClass === WEAPON_CLASS || objectClass === GEM_CLASS
        || (objectClass === TOOL_CLASS && skill !== 0);
}
// Part of C dothrow.c:thitmonst(): the shared miss tail —
// reportHeroThrownMiss() [tmiss()] with its maybe_wakeup roll, plus the
// weapon arm's extra wakeup() for applied polearms (dothrow.c:2196-2198,
// 2235-2238).
async function missRangedObject(monster, object, state, target, applied, volley, publish, random) {
    await reportHeroThrownMiss(monster, object, {
        state, target, publish, ...(volley ? { volley } : {}),
    });
    if (random(3) === 0) {
        if ((await wakeAttackedMonster(monster)).heroDied)
            return { heroDied: true };
    }
    if (applied && (await wakeAttackedMonster(monster)).heroDied)
        return { heroDied: true };
    return { hit: false, consumed: false };
}
const EGG_PIE_AND_VENOM_TYPES = new Set([EGG, CREAM_PIE, BLINDING_VENOM, ACID_VENOM]);
function isHeroThrownEggPieOrVenom(object) {
    return !!object && EGG_PIE_AND_VENOM_TYPES.has(object.otyp);
}
// C dothrow.c:thitmonst(). The object may be thrown (throwit_mon_hit()),
// kicked (dokick.c kick()), or applied at range (apply.c use_pole()); the
// hmode selects the arm. Returned consumed=true means the caller must not
// place the object again. gem_accept() [offerUnicornGem] and omon_adj()
// [rangedTargetHitBonus] are separate C functions; the special_obj_hits_leader()
// macro's quest-leader handoff, the egg/pie/venom Dexterity admission, and
// the befriend_with_obj() taming arm are inlined at their C positions below.
async function hitMonsterWithRangedObject(monster, object, state, mode, { guaranteedHit = false, finishKillWithObject = null, finishMonsterKill = null, checkCaitiff = true, target = { x: monster.mx, y: monster.my }, volley, publish = plineWithContinuation, random = rn2, rollOne = rnd, } = {}) {
    const applied = mode === 'applied';
    if (applied && checkCaitiff)
        await applyCaitiffPenalty(monster, state);
    let threshold = baseRangedHitThreshold(monster, object, state, random);
    if (guaranteedHit)
        threshold += 1000;
    const gift = await offerUnicornGem(monster, object, state);
    if (gift !== null)
        return { hit: true, consumed: gift };
    if (!applied) {
        // C macro special_obj_hits_leader() (dothrow.c:1965-1969) and the
        // leader's catch (dothrow.c:2087-2165): a tossed artifact or other
        // special item is never swung at the quest leader. False means the
        // leader could not catch it, so it falls without an attack roll.
        const unique = !!objectUnique(object.otyp);
        if ((isQuestArtifact(object, state) || unique
            || object.otyp === FAKE_AMULET_OF_YENDOR && !object.known)
            && isQuestLeader(monster, state)) {
            monster.msleeping = 0;
            monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
            if (monster.mcanmove) {
                const name = () => monsterName(monster, { state, capitalized: true, augmentIt: true });
                const itemName = () => definiteName(objectCombatName(object, { state }), state);
                await pline(`${name()} catches ${itemName()}.`);
                if (state.u.uevent?.invoked && unique && object.otyp !== AMULET_OF_YENDOR
                    || !monster.mpeaceful) {
                    if (monster.mpeaceful && !heroIsDeaf(state)) {
                        fullyIdentifyObject(object, state);
                        const item = itemName();
                        await pline(`"${possessiveName(item.charAt(0).toUpperCase() + item.slice(1))} part in this is finished."`);
                        await pline(`"We will guard it in case it is ever needed again, ${deityName(state.u.ualignbase?.[1] ?? state.u.ualign.type, state)} forbid."`);
                    }
                    if (state.u.ushops.length || object.unpaid)
                        await settleThrownShopObject(object, monster.mx, monster.my, state);
                    await addObjectToMonsterInventory(monster, object, state);
                    return { hit: true, consumed: true };
                }
                // C monnear(): a grid bug cannot move or attack diagonally.
                const distance = (monster.mx - state.u.ux) ** 2 + (monster.my - state.u.uy) ** 2;
                const adjacent = distance < 3
                    && (distance !== 2 || MONSTER_NAME[monster.mnum] !== 'grid bug');
                await finishQuest(object, state);
                await pline(`${name()} ${adjacent ? 'hands' : 'tosses'} ${itemName()} back to you.`);
                if (!adjacent) {
                    const dx = state.u.dx ?? 0, dy = state.u.dy ?? 0;
                    const path = [];
                    if (dx || dy) {
                        for (let x = monster.mx - dx, y = monster.my - dy; isok(x, y) && (x !== state.u.ux || y !== state.u.uy); x -= dx, y -= dy)
                            path.push({ x, y });
                    }
                    await captureThrownObjectFlight(object, path, state);
                }
                // C addinv() preserves knowledge gained by xname() and finish_quest().
                await addInventoryItem(object, null, false);
                await encumber_msg(state);
                return { hit: true, consumed: true };
            }
            return { hit: false, consumed: false };
        }
    }
    const dieRoll = rollOne(20);
    const weaponHit = rangedObjectUsesWeaponHit(object);
    const heavyObject = object.otyp === BOULDER || object.otyp === HEAVY_IRON_BALL;
    const swallowedBall = object.otyp === HEAVY_IRON_BALL
        && !!state.u.uswallow && state.u.ustuck === monster && object === state.uball;
    if (weaponHit) {
        if (mode === 'kicked')
            threshold -= isLauncherAmmunition(object) ? 5 : 3;
        else if (mode === 'thrown')
            threshold += throwingHitBonus(monster, object, state);
        else
            threshold += weaponSkillHitBonus(object, state);
    }
    else if (heavyObject) {
        await exerciseAttribute(A_STR, true, state);
    }
    else if (isHeroThrownEggPieOrVenom(object)
        && (guaranteedHit || currentAttribute(A_DEX, state) > rollOne(25))) {
        // C dothrow.c:2256-2260: hmon() uses the projectile up, even when it
        // became a floor rock or an effect spared the target.
        const hit = await hitMonsterWithHeroObject(monster, object, {
            state, mode, target, dieRoll, publish,
            ...(finishMonsterKill ? { finishMonsterDeath: finishMonsterKill } : {}),
        });
        if (hit.heroDied)
            return { heroDied: true };
        return { hit: true, consumed: true };
    }
    else {
        const food = await offerThrownFood(monster, object, state);
        if (food?.heroDied)
            return food;
        if (food)
            return { hit: food.handled, consumed: food.handled };
        return missRangedObject(monster, object, state, target, applied, volley, publish, random);
    }
    if (threshold < dieRoll)
        return missRangedObject(monster, object, state, target, applied, volley, publish, random);
    if (applied)
        state.u.uconduct.weaphit = (state.u.uconduct.weaphit ?? 0) + 1;
    // Ball and boulder attempts exercise Strength above. Unlike weapon hits,
    // their successful attempts exercise Dexterity before hmon's effects.
    if (heavyObject)
        await exerciseAttribute(A_DEX, true, state);
    const chopper = isAxe(object);
    let objectMovedByDeath = false;
    const finishMonsterDeath = finishKillWithObject
        ? async (targetMonster, options) => {
            const death = await finishKillWithObject(targetMonster, object, options);
            objectMovedByDeath = true;
            return death;
        } : undefined;
    const hit = await hitMonsterWithHeroObject(monster, object, {
        mode, dieRoll, target, state,
        ...(volley ? { volley } : {}),
        ...(finishMonsterDeath ? { finishMonsterDeath } : {}),
    });
    if (hit.heroDied)
        return { heroDied: true };
    if (heavyObject)
        return {
            hit: true,
            consumed: hit.objectConsumed || objectMovedByDeath
                || swallowedBall && !hit.survived && !state.u.uswallow,
        };
    if (hit.survived && monster.wormno)
        await cutWorm(monster, target.x, target.y, chopper, { state });
    if (state.program_state.gameover)
        return { heroDied: true };
    await exerciseAttribute(A_DEX, true, state);
    if (hit.objectConsumed || objectMovedByDeath)
        return { hit: true, consumed: true };
    if (shouldMulchMissile(object)) {
        await chargeUnpaidObjectAsDebt(object, state);
        destroyMulchedProjectile(object);
        return { hit: true, consumed: true };
    }
    await applyMonsterPassiveToObject(monster, object);
    return { hit: true, consumed: false };
}
// C dothrow.c:2267-2275: thitmonst()'s befriend_with_obj()/tamedog() arm.
// A null result lets the caller continue to the final tmiss(TRUE) arm, so
// this is also reached from the egg/pie/venom, potion, gold, and swallowed
// throw paths when their Dexterity admission fails. Handled food can be
// consumed or spat back onto the floor, so the caller must not place the
// object again.
export async function offerThrownFood(monster, object, state) {
    if (!befriendWithObj(monster.mnum, object)
        && !(monster.mtame && dogFood(monster, object, rn2, [], state) <= ACCFOOD))
        return null;
    const handled = await tameMonster(monster, object, { state, announce: true });
    if (state.program_state.gameover)
        return { heroDied: true };
    if (!handled) {
        await reportHeroThrownMiss(monster, object, { state });
        monster.msleeping = 0;
        monster.mstrategy = (monster.mstrategy ?? 0) & ~STRAT_WAITMASK;
    }
    return { heroDied: false, handled };
}
export async function hitMonsterWithAppliedWeapon(monster, weapon, { state = game, checkCaitiff = true, target } = {}) {
    requirePlayingGame(state);
    return hitMonsterWithRangedObject(monster, weapon, state, 'applied', { checkCaitiff, ...(target ? { target } : {}) });
}
export async function hitMonsterWithKickedObject(monster, object, { state = game, target = { x: monster.mx, y: monster.my } } = {}) {
    requirePlayingGame(state);
    return hitMonsterWithRangedObject(monster, object, state, 'kicked', { target });
}
export function hitMonsterWithThrownObject(monster, object, { state = game, ...options } = {}) {
    requirePlayingGame(state);
    return hitMonsterWithRangedObject(monster, object, state, 'thrown', options);
}
const GLASS = 19;
const BREAKABLE_TYPES = new Set([
    EXPENSIVE_CAMERA,
    EGG,
    CREAM_PIE,
    MELON,
    ACID_VENOM,
    BLINDING_VENOM,
]);
// C dothrow.c:breaktest().  Checks whether obj (which has just hit
// something hard) is going to break, without breaking it; glass armor
// resists with a 90% chance where other objects use 1%.
export function objectBreaksOnImpact(object, random = rn2) {
    const glassArmor = object.oclass === ARMOR_CLASS
        && objectMaterial(object.otyp) === GLASS;
    const ordinaryResistance = glassArmor ? 90 : 1;
    if (objectResistsDestruction(object, ordinaryResistance, 99, random))
        return false;
    const glassObject = objectMaterial(object.otyp) === GLASS
        && !object.oartifact && !object.artifact
        && object.oclass !== GEM_CLASS;
    return glassObject || object.oclass === POTION_CLASS
        || BREAKABLE_TYPES.has(object.otyp);
}
// C dothrow.c:breakmsg().
async function publishBreakMessage(object, visible, publish, state) {
    if ([EGG, MELON].includes(object.otyp)) {
        await publish('Splat!');
        return;
    }
    if (object.otyp === CREAM_PIE) {
        if (visible)
            await publish('What a mess!');
        return;
    }
    if ([ACID_VENOM, BLINDING_VENOM].includes(object.otyp)) {
        await publish('Splash!');
        return;
    }
    if (!visible) {
        await publishHeardMessage('something shatter!', publish, state);
        return;
    }
    const quantity = object.quan ?? object.quantity ?? 1;
    // C breakmsg(): glass and crystal wands share the default case.
    const intoPieces = object.oclass === WAND_CLASS
        || [LENSES, MIRROR, CRYSTAL_BALL, EXPENSIVE_CAMERA].includes(object.otyp)
        ? ' into a thousand pieces' : '';
    observeObjectForNaming(object, { state });
    const description = await objectDescription(object, { state });
    const subject = description.charAt(0).toUpperCase() + description.slice(1);
    await publish(`${subject} ${quantity === 1 ? 'shatters' : 'shatter'}${intoPieces}!`);
}
async function crackGlassArmor(object, x, y, publish, luckRandom, state) {
    const result = await erodeObject(object, 'crack', {
        state, publish, luckRandom, destroy: true, grease: false, verbose: true,
        position: { x, y }, displayName: armorSimpleName(object, state),
    });
    return result === 'destroyed';
}
async function applyPotionBreakEffect(object, x, y, state, publish) {
    if (object.otyp === POT_OIL && object.lamplit)
        return false;
    const nearby = Math.max(Math.abs(x - state.u.ux), Math.abs(y - state.u.uy)) <= 1;
    if (!nearby)
        return false;
    const profile = heroPotionVaporProfile(state);
    if (object.otyp !== POT_WATER && !state.u?.halfGasDamage) {
        if (!profile.breathless)
            await publish('You smell a peculiar odor...');
        else if (profile.hasEyes) {
            // C dothrow.c breakobj(): the eye name follows the current form's
            // anatomy, pluralized by eyecount() and tensed by vtense().
            const eye = body_part(EYE, state);
            const eyes = eyecount(heroSpecies(state)) === 1 ? eye : makePlural(eye);
            await publish(`Your ${eyes} ${verbForSubject(eyes, 'water')}.`);
        }
    }
    await applySupportedPotionVapor({ state, potion: object, publish });
    return true;
}
async function settleBrokenShopObject(object, x, y, fromInventory, state, publish) {
    if (fromInventory || object.unpaid) {
        if ((state.u.ushops?.length ?? 0) || object.unpaid)
            await settleThrownShopObject(object, x, y, state, publish, { broken: true });
        return;
    }
    const spot = !object.no_charge && costlySpot(x, y, state);
    if (!spot)
        return;
    const { resident, roomno } = spot;
    const shop = resident.eshk;
    if (!shop)
        throw new Error('A costly shop square has no shopkeeper account.');
    const sequence = state._heroActionSeq ?? 0;
    if (sequence !== shop.break_seq)
        shop.seq_peaceful = resident.mpeaceful;
    const loss = await stolenValue(object, x, y, shop.seq_peaceful, {
        silent: false, state, publish,
    });
    if (loss > 0 && sequence !== shop.break_seq
        && (roomno !== state.u.ushops?.[0]
            || !insideShopRoomAt(state, state.u.ux, state.u.uy)))
        await makeAngryShopkeeper(resident, state);
    shop.break_seq = sequence;
}
// C dothrow.c:hero_breaks(): breaktest() [objectBreaksOnImpact], breakmsg()
// [publishBreakMessage], then breakobj() [breakObjectAtLocation].
export async function breakFloorObject(object, { x = object.ox, y = object.oy, fromInventory = false, inView = null, state = game, heroCaused = true, publish = plineWithContinuation, random = rn2, luckRandom = rnl, rollDice = d, summonMonster = makemonAt, } = {}) {
    requireLiveGame(state);
    if (!objectBreaksOnImpact(object, random)) {
        return { destroyed: false, observed: false };
    }
    return breakObjectAtLocation(object, {
        x, y, fromInventory, inView, state, heroCaused, publish, random, luckRandom, rollDice,
        summonMonster,
    });
}
// C dothrow.c:breakobj().  Breakable armor goes through erosion steps;
// other items break unconditionally.
export async function breakObjectAtLocation(object, { x = object.ox, y = object.oy, fromInventory = false, inView = null, state = game, heroCaused = true, showBreakMessage = true, publish = plineWithContinuation, random = rn2, luckRandom = rnl, rollDice = d, summonMonster = makemonAt, } = {}) {
    requireLiveGame(state);
    const visible = !heroIsBlind(state)
        && (inView ?? (fromInventory || cansee(x, y)));
    const audible = !heroIsDeaf(state);
    const glassArmor = objectIsCrackable(object, state);
    if (glassArmor) {
        const destroyed = await crackGlassArmor(object, x, y, publish, luckRandom, state);
        if (destroyed)
            await newsym(x, y);
        return { destroyed, observed: destroyed && (visible || audible) };
    }
    if (showBreakMessage)
        await publishBreakMessage(object, visible, publish, state);
    if (heroCaused && object.otyp === MIRROR) {
        changeHeroLuck(-2, state);
    }
    const cameraDemon = object.otyp === EXPENSIVE_CAMERA
        ? await releaseCameraDemon(object, x, y, {
            state, publish, random, summonMonster,
        }) : null;
    if (object.oclass === POTION_CLASS) {
        // The blast from burning oil must not ignite or destroy the same
        // potion again while breakage is still finishing.
        object.in_use = true;
        await applyPotionBreakEffect(object, x, y, state, publish);
        if (state.program_state?.gameover)
            return { destroyed: false, observed: visible || audible };
    }
    const oilExplosion = object.otyp === POT_OIL && object.lamplit;
    const eggExplosion = isPyroliskEgg(object);
    if (heroCaused)
        applyHeroEggLuckPenalty(object, state);
    if (oilExplosion) {
        // Blast credit follows the active turn, independently of breakage.
        const explosion = await explodeLitOilPotion(object, x, y, {
            state, heroCaused: !state.context.mon_moving, publish, random, rollDice,
        });
        if (explosion.heroDied)
            return { destroyed: false, observed: visible || audible, heroDied: true };
    }
    if (heroCaused)
        await settleBrokenShopObject(object, x, y, fromInventory, state, publish);
    // Fracture callers replace the stone object after breakobj settles its cost.
    if (object.otyp === BOULDER || object.otyp === STATUE)
        return { destroyed: false, observed: false };
    // breakobj() leaves any redraw of the square to its caller.
    await delobj(object, state, random);
    if (eggExplosion) {
        await explodePyroliskEggAt(x, y, {
            state, heroCaused: !state.context.mon_moving, publish, random, rollDice,
        });
    }
    return {
        destroyed: true,
        observed: visible || audible,
        cameraDemon,
    };
}
export async function hitFloorWithObject(object, { verbose = true, state = game, publish = plineWithContinuation } = {}) {
    requireLiveGame(state);
    const hero = state.u;
    const level = requireGameLevel(state);
    const location = level.at(hero.ux, hero.uy);
    if (!location)
        throw new Error('The hero is outside the dungeon map.');
    if (IS_SOFT(location.typ) || hero.uinwater || hero.uswallow)
        return dropObjectAtHero(object, { state, publish });
    if (IS_ALTAR(location.typ)) {
        await landObjectOnAltar(object, { state, publish });
    }
    else if (verbose) {
        // C Doname2(obj) is the capitalized full doname; otense conjugates
        // the verb by quantity.
        const verb = (object.otyp === WAN_STRIKING ? 'strike' : 'hit')
            + (object.quan > 1 ? '' : 's');
        let surf = surfaceName(hero.ux, hero.uy, state);
        const trap = level.traps.find(candidate => candidate.tx === hero.ux && candidate.ty === hero.uy);
        // describe something that might keep the object where it is or
        // precede the next message stating that it falls
        if (trap?.tseen) {
            if (trap.ttyp === TRAPDOOR)
                surf = 'trap door';
            else if (trap.ttyp === HOLE)
                surf = 'edge of the hole';
            else if (trap.ttyp === PIT || trap.ttyp === SPIKED_PIT)
                surf = 'edge of the pit';
        }
        observeObjectForNaming(object, { state });
        const description = await inventoryItemDescription(object);
        await publish(`${description.charAt(0).toUpperCase()}${description.slice(1)} `
            + `${verb} the ${surf}.`);
    }
    const broke = await breakFloorObject(object, {
        state, publish, x: hero.ux, y: hero.uy, fromInventory: true,
    });
    // A fatal break (potion vapor, burning oil) can end the game without
    // destroying the object; gate on the game-over state itself.
    if (broke.destroyed || state.program_state?.gameover)
        return null;
    if (await shipObject(object, hero.ux, hero.uy, { state: requireInitializedGame(state), publish }))
        return null;
    return dropObjectAtHero(object, { impact: true, state, publish });
}
// C dothrow.c:walk_path(). Ordered steps exclude the source and include the target.
export function walkPathCells(fromX, fromY, toX, toY) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    let cx = fromX;
    let cy = fromY;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    let error = 0;
    const sx = dx < 0 ? -1 : 1;
    const sy = dy < 0 ? -1 : 1;
    const cells = [];
    const steps = Math.max(ax, ay);
    for (let index = 0; index < steps; index++) {
        if (ax < ay) {
            cy += sy;
            error += ax << 1;
            if (error > ay) {
                cx += sx;
                error -= ay << 1;
            }
        }
        else {
            cx += sx;
            error += ay << 1;
            if (error > ax) {
                cy += sy;
                error -= ax << 1;
            }
        }
        cells.push({ x: cx, y: cy });
    }
    return cells;
}
// C dothrow.c:release_camera_demon().
const PM_HOMUNCULUS = 51;
const PM_IMP = 52;
export async function releaseCameraDemon(object, x, y, { state = game, publish = plineWithContinuation, random = rn2, summonMonster = makemonAt, } = {}) {
    if (random(3) !== 0)
        return null;
    const mnum = random(3) === 0 ? PM_IMP : PM_HOMUNCULUS;
    const monster = await summonMonster(mnum, x, y, MM_NOMSG);
    if (!monster)
        return null;
    if (canSpotMonster(monster)) {
        const subject = heroIsHallucinating(state)
            ? `A ${randomDisplayMonsterName()}`
            : 'The picture-painting demon';
        await publish(`${subject} is released!`);
    }
    monster.mpeaceful = object.cursed ? 0 : 1;
    setMonsterMalign(monster, state);
    return monster;
}
// C dothrow.c:check_shop_obj()
// Broken objects settle through the hero's current shop. Intact returns
// remove bills or offer a sale before stacking.
// ---------------------------------------------------------------------------
export async function settleThrownShopObject(object, x, y, state = game, publish = plineWithContinuation, { broken = false } = {}) {
    requireLiveGame(state);
    requireShopGame(state);
    const heroShop = state.u.ushops[0];
    const resident = shopResident(heroShop, state);
    if (!resident)
        return false;
    const spot = costlySpot(x, y, state);
    const objectRoom = roomsAt(state.level, x, y, SHOPBASE)[0];
    if (broken || !spot || objectRoom !== heroShop) {
        if (objectIsUnpaid(object))
            await stolenValue(object, state.u.ux, state.u.uy, resident.mpeaceful, {
                state, publish, silent: false,
            });
        if (broken)
            object.no_charge = true;
        return true;
    }
    const previousRoom = state.u.ushops0[0];
    if (objectRoom === heroShop || objectRoom === previousRoom) {
        if (objectIsUnpaid(object)) {
            const gold = containedGold(object, true);
            removeObjectAndContentsFromBill(object, state, { resident });
            if (gold > 0)
                await donateGold(gold, resident, { selling: true, publish });
        }
        else if (x !== resident.mx || y !== resident.my) {
            await sellHeroDroppedObject(object, x, y, state, { publish });
        }
    }
    return true;
}
function heroForm() {
    requirePlayingGame(game);
    return Upolyd(game.u) ? game.u.umonnum : null;
}
function floorBoulder(x, y) {
    return (game.level?.objects?.[x]?.[y] || [])
        .find(object => object.otyp === BOULDER) || null;
}
// C m_at() also finds a long worm by any of its tail segments.
function heroHurtleMonsterAt(x, y) {
    return game.level?.monsters?.find(monster => monsterHasMapPosition(monster) && !monster.dead && (monster.mhp ?? 1) > 0
        && monsterOccupiesPosition(monster, x, y)) || null;
}
function wallPassage(location) {
    const hasAbility = !!(game.u.passesWalls
        || monsterPassesWalls(heroMonsterForm() ?? -1));
    return {
        hasAbility,
        mayPass: hasAbility
            && !(IS_STWALL(location.typ) && (location.wall_info & W_NONPASSWALL)),
    };
}
function obstacleReason(location, openDoorFrame) {
    if (location.typ === TREE)
        return 'bumping into a tree';
    if (openDoorFrame)
        return 'bumping into a door frame';
    if (location.typ === DOOR)
        return 'bumping into a closed door';
    return 'bumping into a wall';
}
// Part of C dothrow.c:hurtle_step(): its losehp(..., why, KILLED_BY)
// (dothrow.c:836) — "killed by bumping into a wall".
async function loseImpactHitPoints(amount, killer) {
    if (game.u.halfPhysicalDamage)
        amount = Math.trunc((amount + 1) / 2);
    return loseHeroHp(amount, killer, { killerFormat: KILLED_BY });
}
function obstacleAt(x, y) {
    const hero = game.u;
    const location = game.level?.at?.(x, y);
    if (!location)
        return null;
    const diagonal = hero.ux !== x && hero.uy !== y;
    const closedDoor = location.typ === DOOR
        && ((location.doormask ?? 0) & (D_CLOSED | D_LOCKED));
    const openDoorFrame = diagonal && location.typ === DOOR
        && !!((location.doormask ?? 0) & D_ISOPEN);
    const passage = wallPassage(location);
    if (!passage.hasAbility || !passage.mayPass) {
        if (IS_OBSTRUCTED(location.typ) || closedDoor || openDoorFrame) {
            return {
                message: openDoorFrame ? 'You hit the door frame!' : 'Ouch!',
                followup: openDoorFrame ? 'Ouch!' : null,
                reason: obstacleReason(location, openDoorFrame),
            };
        }
        if (location.typ === IRONBARS) {
            return {
                message: 'You crash into some iron bars.  Ouch!',
                reason: 'crashing into iron bars',
            };
        }
        const boulder = floorBoulder(x, y);
        if (boulder) {
            return {
                message: `You bump into a ${objectName(boulder)}.  Ouch!`,
                reason: 'bumping into a boulder',
            };
        }
        if (passage.hasAbility && !passage.mayPass) {
            return {
                message: 'You smack into something!',
                reason: 'touching the edge of the universe',
            };
        }
    }
    if ((!passage.hasAbility || !passage.mayPass) && diagonal
        && heroBadRock(game, hero.ux, y)
        && heroBadRock(game, x, hero.uy)) {
        const tight = heroTightDiagonalReason(game);
        if (tight === 1 || tight === 2) {
            return {
                message: tight === 2
                    ? 'You and all your belongings get forcefully wedged into a crevice.'
                    : 'You get forcefully wedged into a crevice.',
                reason: 'wedging into a narrow crevice',
            };
        }
    }
    return null;
}
async function hitObstacle(obstacle, x, y, remaining) {
    await plineWithContinuation(obstacle.message);
    if (obstacle.followup)
        await plineWithContinuation(obstacle.followup);
    if (await loseImpactHitPoints(rnd(2 + remaining), obstacle.reason))
        return;
    await wakeMonstersNearWithMessages(x, y, 10);
}
function heroWearsTorsoArmor() {
    return !!(game.uarmu || game.uarm || game.uarmc
        || game.u?.uarmu || game.u?.uarm || game.u?.uarmc);
}
async function collideWithMonster(monster, x, y, options) {
    const glyph = glyphAt(x, y);
    monster.mundetected = 0;
    const name = monsterName(monster, { article: 'a', augmentIt: true });
    await plineWithContinuation(glyph?.kind === 'monster' || glyph?.kind === 'invisible'
        ? `You bump into ${name}.`
        : `You find ${name} by bumping into ${monsterObjectPronoun(monster, { noIt: true })}.`);
    await awakenMonster(monster);
    if (!canSpotMonster(monster))
        await map_invisible(monster.mx, monster.my);
    await angerMonster(monster);
    // C dothrow.c:hurtle_step() instapetrify()s an unarmored hero.
    if (touchPetrifies(monster.mnum) && !heroWearsTorsoArmor()) {
        const result = await resolveImmediatePetrification({
            killer: `bumping into ${withIndefiniteArticle(monsterTypeName(monster.mnum, !!monster.female))}`,
        });
        if (result.died)
            return;
    }
    const form = heroForm();
    if (form !== null && touchPetrifies(form) && !monsterWearsTorsoArmor(monster)) {
        await petrifyMonsterFromContact(monster, {
            creditHero: true,
            finishDeath: options.finishMonsterDeath ?? undefined,
        });
    }
    await wakeMonstersNearWithMessages(x, y, 10);
}
function anchoredMessage() {
    const type = game.u?.utraptype;
    if (type === TT_WEB)
        return 'You are anchored by the web.';
    if (type === TT_LAVA)
        return `You are anchored by the ${displayLiquidName('lava')}.`;
    if (type === TT_INFLOOR)
        return `You are anchored by the ${surfaceName(game.u.ux, game.u.uy)}.`;
    if (type === TT_BURIEDBALL)
        return 'You are anchored by the buried ball.';
    return 'You are anchored by the trap.';
}
function stopHurtle() {
    nomul(0);
}
async function triggerLandingTrap(trap, options, remaining) {
    requirePlayingGame(game);
    if (!trap)
        return false;
    // Jump's final square is handled by teleds(), after the path walk.
    if (options.jumping && remaining.value < 2)
        return false;
    const before = {
        level: game.level, x: game.u.ux, y: game.u.uy,
    };
    const sokobanFall = game.level.flags.sokoban_rules
        && (is_pit(trap.ttyp) || is_hole(trap.ttyp));
    if (trap.ttyp === VIBRATING_SQUARE)
        await plineWithContinuation('The ground vibrates as you pass it.');
    if ([VIBRATING_SQUARE, FIRE_TRAP, MAGIC_PORTAL].includes(trap.ttyp) || sokobanFall) {
        const result = sokobanFall && options.jumping
            ? { died: false } : await dotrap(trap, options);
        if (result.died)
            return true;
        if (trap.ttyp === MAGIC_PORTAL)
            return true;
        if (sokobanFall) {
            remaining.value = 0;
            return !options.jumping;
        }
    }
    else if (trap.tseen) {
        await plineWithContinuation(`You pass right over ${withIndefiniteArticle(trapName(trap.ttyp))}.`);
    }
    return game.level !== before.level
        || game.u.ux !== before.x || game.u.uy !== before.y;
}
// drown() relocates a hero who crawls out or is rescued through teleds(),
// whose spoteffects() covers the room, trap, and look-here at the landing.
function hurtleTrapOptions(options) {
    const trapOptions = {};
    if (options.finishTeleport)
        trapOptions.finishTeleport = options.finishTeleport;
    if (options.gotoLevel)
        trapOptions.gotoLevel = options.gotoLevel;
    return trapOptions;
}
async function settleLiquid(options, remaining) {
    requirePlayingGame(game);
    const { ux: x, uy: y } = game.u;
    if (isLavaAt(x, y)) {
        if (!options.jumping || remaining.value >= 2)
            await plineWithContinuation('You move over some lava.', { noRepeat: true });
        return false;
    }
    if (!isPoolAt(x, y) || game.u.uinwater)
        return false;
    const staysAboveWater = game.u?.levitating || game.u?.levitation
        || game.u.flying
        || heroHasWaterWalking(game) || options.jumping;
    if (!isWaterwallAt(x, y) && staysAboveWater) {
        if (!Is_waterlevel(game.u?.uz)
            && (!options.jumping || remaining.value >= 2)) {
            await plineWithContinuation(`You move over ${isMoatAt(x, y) ? 'a moat' : 'a pool'}.`, { noRepeat: true });
        }
        return false;
    }
    // C dothrow.c:926-928 resets the counter directly (`gm.multi = 0;
    // (void) drown(); return FALSE;`) so drown() may crawl the hero out;
    // it touches neither gm.multi_reason nor gn.nomovemsg, so hurtle()'s
    // reason and its empty-but-set end message ("") both survive until
    // the next nomul(0) (reason only, hack.c:4170), done_eating() or
    // unmul() consumes them.
    setMulti(0);
    // C hurtle_step() calls drown() directly, then stops even if a swimmer
    // survives in place. pooleffects() would check the steed too early.
    await heroLiquidEffects({
        entry: 'drown',
        chooseTeleportDestination: options.chooseTeleportDestination ?? null,
        applyLandingEffects: ({ from, to, pick = true }) => finishDestinationSpotEffects({
            oldx: from.x, oldy: from.y, newx: to.x, newy: to.y,
            pick, trapOptions: hurtleTrapOptions(options),
        }),
    });
    return true;
}
// C dothrow.c:hurtle_step().  A single step for the hero flying through
// the air from jumping, flying, etc.; the range pointer stops the walk.
async function moveOneSquare(x, y, options, remaining) {
    requirePlayingGame(game);
    if (!isok(x, y)) {
        await plineWithContinuation(formatFeltMessage('the spirits holding you back.'));
        return false;
    }
    updateHeroRegions(game, x, y);
    if (!remaining.value)
        return false;
    const obstacle = obstacleAt(x, y);
    if (obstacle) {
        await hitObstacle(obstacle, x, y, remaining.value);
        return false;
    }
    const monster = heroHurtleMonsterAt(x, y);
    if (monster) {
        await collideWithMonster(monster, x, y, options);
        return false;
    }
    const hero = game.u;
    const diagonal = hero.ux !== x && hero.uy !== y;
    if (diagonal && game.level?.flags?.sokoban_rules
        && heroBadRock(game, hero.ux, y)
        && heroBadRock(game, x, hero.uy)) {
        await plineWithContinuation('You come to an abrupt halt!');
        return false;
    }
    const ballAndChain = await beginBallAndChainMove(x, y);
    if (ballAndChain?.blocked) {
        if (!options.jumping)
            return false;
    }
    if (ballAndChain && !ballAndChain.blocked)
        await finishBallAndChainMove(ballAndChain);
    const oldx = hero.ux;
    const oldy = hero.uy;
    await placeHeroOnLevel(x, y);
    await newsym(oldx, oldy);
    await vision_recalc(1);
    await flush_screen(1);
    const previousLocation = game.level.at(oldx, oldy);
    const currentLocation = game.level.at(x, y);
    if (!previousLocation || !currentLocation)
        throw new Error(`Hurtle moved between invalid map cells ${oldx},${oldy} and ${x},${y}`);
    if (previousLocation.typ !== currentLocation.typ)
        await switchHeroTerrain(game);
    await checkSpecialRoom();
    if (await settleLiquid(options, remaining))
        return false;
    const trap = game.level?.traps?.find(candidate => candidate.tx === x && candidate.ty === y);
    if (await triggerLandingTrap(trap, options, remaining))
        return false;
    remaining.value = Math.max(0, remaining.value - 1);
    if (remaining.value)
        await game.animationFrame?.();
    return true;
}
// C dothrow.c:hurtle_jump() walks an irregular jump with the same
// collisions as hurtle().  The caller owns trap escape, the final landing,
// and the one-turn delay.
export async function hurtleJumpTo(x, y, options = {}) {
    requirePlayingGame(game);
    const path = walkPathCells(game.u.ux, game.u.uy, x, y);
    const remaining = { value: path.length };
    let reached = { x: game.u.ux, y: game.u.uy };
    for (const point of path) {
        if (!await moveOneSquare(point.x, point.y, { ...options, jumping: true }, remaining))
            break;
        reached = point;
    }
    // walk_path() rolls its destination back to the preceding accepted
    // square on failure, even if a portal or liquid moved the actor.
    return reached;
}
// C dothrow.c:hurtle().  The hero moves through the air for a few squares
// as a result of throwing or kicking something; also hurtle_step() below.
export async function hurtleHero(dx, dy, range, { verbose = false, finishTeleport = null, gotoLevel = null, chooseTeleportDestination = null, finishMonsterDeath = null, volley, } = {}) {
    requirePlayingGame(game);
    const ball = game.uball || game.u.uball;
    if (heroIsPunished()
        && (!ball || !game.inventory.includes(ball))) {
        await plineWithContinuation(formatFeltMessage('a tug from the iron ball.'));
        stopHurtle();
        return false;
    }
    if (game.u?.utrap) {
        await plineWithContinuation(anchoredMessage());
        stopHurtle();
        return false;
    }
    dx = Math.sign(dx);
    dy = Math.sign(dy);
    range = Math.max(0, Math.trunc(range));
    if (!range || (!dx && !dy) || game.u?.ustuck)
        return false;
    nomul(-range);
    game._helplessReason = 'moving through the air';
    game._helplessDoneMessage = '';
    if (verbose) {
        await plineWithContinuation(`You ${range > 1 ? 'hurtle' : 'float'} in the opposite direction.`);
    }
    if (volley)
        await endmultishot(true, volley);
    const remaining = { value: range };
    const options = {
        finishTeleport, gotoLevel, chooseTeleportDestination,
        finishMonsterDeath,
    };
    while (remaining.value) {
        const x = game.u.ux + dx;
        const y = game.u.uy + dy;
        if (!await moveOneSquare(x, y, options, remaining))
            break;
    }
    return true;
}
// ---------------------------------------------------------------------------
// Thrown-projectile helpers.
// C refs: dothrow.c harmless_missile() and should_mulch_missile().
// ---------------------------------------------------------------------------
const CLOTH = 6;
// C dothrow.c:harmless_missile(). Contents make an otherwise soft bag hurt.
export function harmlessMissile(object, state = game) {
    switch (object.otyp) {
        case SLING:
        case EUCALYPTUS_LEAF:
        case KELP_FROND:
        case SPRIG_OF_WOLFSBANE:
        case FORTUNE_COOKIE:
        case PANCAKE:
            return true;
        case RUBBER_HOSE:
        case BAG_OF_TRICKS:
            return object.spe < 1;
        case SACK:
        case OILSKIN_SACK:
        case BAG_OF_HOLDING:
            return !object.contents?.length;
        default:
            return object.oclass === SCROLL_CLASS || objectMaterial(object, state) === CLOTH;
    }
}
export function projectileKind(object) {
    // C should_mulch_missile() tests is_ammo(obj) || is_missile(obj); the
    // kind label is the port's own classification of the two branches.
    if (isLauncherAmmunition(object))
        return 'ammunition';
    if (isMissileObject(object))
        return 'missile';
    return null;
}
// C frees a mulched projectile. Remove it from every JavaScript object list.
export function destroyMulchedProjectile(object) {
    if (!object)
        return;
    object.where = 'gone';
    object.ox = object.oy = 0;
    object.ocarry = null;
    delete object.carrierMid;
}
export function shouldMulchMissile(object, { monsterMoving = false } = {}) {
    if (!object || !projectileKind(object)
        || OBJ_NAME(object.otyp) === 'boomerang'
        || objectMagic(object.otyp))
        return false;
    const erosion = Math.max(object.oeroded ?? 0, object.oeroded2 ?? 0);
    const enchantment = object.spe ?? object.enchantment ?? 0;
    const chance = 3 + erosion - enchantment;
    let broken = chance > 1 ? rn2(chance) !== 0 : rn2(4) === 0;
    if (object.blessed
        && (monsterMoving ? rn2(3) === 0 : rnl(4) === 0))
        broken = false;
    if ((HARD_GEM_TYPES.has(object.otyp) || object.otyp === FLINT)
        && rn2(2) === 0)
        broken = false;
    return broken;
}
const SILVER = 14;
const GEMSTONE = 20;
const MINERAL = 21;
// C dothrow.c:toss_up(). The hero tosses an object upwards; it falls back.
export async function tossObjectUp(object, { state = game, publish = plineWithContinuation, random = rn2, rollOne = rnd, } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    const hasCeiling = levelHasCeiling(state);
    const hitsRoof = random(5) !== 0 && !(state.underwater || hero.uinwater);
    const ceiling = ceilingName(hero.ux, hero.uy, state);
    const breakObject = () => breakObjectAtLocation(object, {
        x: hero.ux, y: hero.uy, fromInventory: true, state, publish, random,
    });
    const hitFloor = (verbose) => hitFloorWithObject(object, { state, publish, verbose });
    const petrifier = (object.otyp === EGG || object.otyp === CORPSE)
        && touchPetrifies(object.corpsenm);
    if (hasCeiling && hitsRoof && objectBreaksOnImpact(object, random)) {
        await publish(`${await fallingObjectSubject(object, state)} hits the ${ceiling}.`);
        const broken = await breakObject();
        if (broken.destroyed || state.program_state.gameover)
            return null;
        return hitFloor(false);
    }
    const action = !hasCeiling ? 'flies up into' : hitsRoof ? 'hits' : 'almost hits';
    await publish(`${await fallingObjectSubject(object, state)} ${action} the ${ceiling}, then falls back on top of your ${body_part(HEAD, state)}.`);
    if (object.oclass === POTION_CLASS) {
        await hitHeroWithThrownPotion(object, { state, publish, random, rollOne });
        return null;
    }
    const helmet = state.uarmh || hero.uarmh || null;
    if (objectBreaksOnImpact(object, random)) {
        // C dothrow.c passes &gy.youmonst as both magr and mdef here.
        const blindIncrement = (object.otyp === CREAM_PIE || object.otyp === BLINDING_VENOM)
            && canBlnd({ youmonst: true }, { youmonst: true }, AT_WEAP, object, state)
            ? rollOne(25) : 0;
        const broken = await breakObject();
        if (state.program_state.gameover)
            return null;
        const remaining = broken.destroyed ? null : object;
        if (object.otyp === EGG && petrifier && !heroResistsStoning(state)
            && await petrifyFromFallingObject(remaining, helmet, state, publish))
            return remaining;
        if (object.otyp === EGG || object.otyp === CREAM_PIE || object.otyp === BLINDING_VENOM) {
            await publish(`You've got it all over your ${body_part(FACE, state)}!`);
            if (blindIncrement) {
                if (object.otyp === BLINDING_VENOM && !heroIsBlind(state))
                    await publish('It blinds you!');
                hero.ucreamed = (hero.ucreamed ?? 0) + blindIncrement;
                await makeBlinded((hero.blindTurns ?? 0) + blindIncrement, { state, talk: false, publish });
                if (!heroIsBlind(state))
                    await publish('Your vision quickly clears.');
            }
        }
        return remaining ? hitFloor(false) : null;
    }
    if (harmlessMissile(object, state)) {
        await publish("It doesn't hurt.");
        return hitFloor(false);
    }
    const material = objectMaterial(object, state);
    const silver = material === SILVER;
    const hatesSilver = heroHatesSilver(state);
    const lessDamage = objectIsHardHelmet(helmet) && (!silver || !hatesSilver);
    let harmless = object.oclass !== RING_CLASS && (material === GEMSTONE || material === MINERAL)
        && passes_rocks(heroSpecies(state));
    let damage = rollPhysicalWeaponDamageAgainstHero(object, state, { rollOne });
    let artifactMessage = false;
    if (object.oartifact && !harmless) {
        const artifact = await hitHeroWithFallingArtifact(object, damage, {
            state, publish, random, rollOne, dieRoll: random(18) + 2,
        });
        if (artifact.heroDied)
            return object;
        damage = artifact.damage;
        artifactMessage = artifact.specialMessage;
    }
    if (!damage) {
        const weightDamage = Math.max(1, Math.ceil(object.owt / WT_TO_DMG));
        damage = Math.min(6, weightDamage <= 1 ? 1 : rollOne(weightDamage));
        if (MONSTER_NAME[heroSpecies(state)] === 'shade' && !silver)
            damage = 0;
        if (object.blessed && monsterHatesBlessings({ mnum: heroSpecies(state) }))
            damage += rollOne(4);
        if (silver && hatesSilver)
            damage += rollOne(20);
    }
    if (damage > 1 && lessDamage)
        damage = 1;
    if (damage > 0)
        damage += hero.udaminc ?? 0;
    damage = Math.max(0, damage);
    if (hero.halfPhysicalDamage)
        damage = Math.ceil(damage / 2);
    if (helmet) {
        const helmetName = simpleArmorName(helmet, 'uarmh', state);
        const hp = Upolyd(hero) ? hero.mh : hero.uhp;
        if ((lessDamage && damage < hp) || harmless) {
            if (!artifactMessage)
                await publish(harmless
                    ? `Unfortunately, you are wearing ${withIndefiniteArticle(helmetName)}.`
                    : 'Fortunately, you are wearing a hard helmet.');
        }
        else if (!petrifier && state.flags.verbose !== false) {
            await publish(`Your ${helmetName} does not protect you.`);
        }
        harmless = false;
    }
    else if (petrifier && !heroResistsStoning(state)
        && await petrifyFromFallingObject(object, null, state, publish))
        return object;
    if (silver && hatesSilver)
        await publish('The silver sears you!');
    if (harmless)
        await publish(`The ${simpleObjectName(object, state)} hits you but doesn't hurt.`);
    const landed = await hitFloor(true);
    state._thrownObject = null;
    if (!harmless && !state.program_state.gameover)
        await loseHeroHp(damage, 'falling object', { state, publish });
    return landed;
}
async function fallingObjectSubject(object, state) {
    observeObjectForNaming(object, { state });
    const name = await objectDescription(object, { state });
    return name.charAt(0).toUpperCase() + name.slice(1);
}
async function petrifyFromFallingObject(object, helmet, state, publish) {
    if (formCanBecomeStoneGolem(state.u.umonnum, state)) {
        const result = await polymonHero(MONSTER_NAME.indexOf('stone golem'));
        if (result.transformed)
            return false;
        if (result.died)
            return true;
    }
    if (helmet)
        await publish(`Your ${simpleArmorName(helmet, 'uarmh', state)} fails to protect you.`);
    await publish('You turn to stone.');
    if (object)
        await dropObjectAtHero(object, { state, publish });
    state._thrownObject = null;
    await finishHeroDeath({
        killer: 'elementary physics', killerFormat: KILLED_BY,
        deathVerb: 'turned to stone', deathLineShown: true, deathType: STONING,
    });
    return true;
}
// ---------------------------------------------------------------------------
// Throw-and-return: the AutoReturn() macro (dothrow.c:30-34) and the
// returning-weapon outcome of throwit() (dothrow.c:1710-1777).
// ---------------------------------------------------------------------------
// C dothrow.c:AutoReturn() macro: uwep might already be removed from
// inventory, so the caller passes the owornmask; a wielded aklys or a
// Valkyrie's wielded Mjollnir returns, and every boomerang does.
export function isAutoReturningThrow(object, weaponMask, state) {
    return object.otyp === BOOMERANG || !!(weaponMask & W_WEP)
        && (object.otyp === AKLYS || artifactById(object.oartifact, state)?.name === 'Mjollnir'
            && state.urole?.key === 'valkyrie');
}
// Part of C dothrow.c:throwit(): the impaired local (dothrow.c:1520-1523)
// — Confusion, Stunned, Blind, Hallucination, or Fumbling spoil the catch
// of a returning weapon.
export function throwerIsImpaired(state) {
    return heroIsBlind(state) || heroIsHallucinating(state)
        || state.u.confused || propertyIsActive('confusion', state)
        || state.u.stunned || propertyIsActive('stunned', state)
        || state.u.fumbling || propertyIsActive('fumbling', state);
}
// Part of C dothrow.c:throwit(): the throw-and-return outcome
// (dothrow.c:1710-1777), shared by the map and the engulfed weapon arm.
// A failed return still needs throwit()'s landing at the target square.
export async function finishReturningThrow({ state, object, impact, impaired, twoWeapons, oldSlot, tetherDisplay, }) {
    requirePlayingGame(state);
    if (rn2(100) === 0) {
        await tetherDisplay?.clear();
        await plineWithContinuation(`${definiteObjectAction(object, 'fail', state)} to return!`);
        return false;
    }
    if (tetherDisplay)
        await tetherDisplay.backtrack();
    else
        await showReturnFlight(object, impact, state);
    if (!impaired && rn2(100) !== 0) {
        await plineWithContinuation(`${definiteObjectAction(object, 'return', state)} to your hand!`);
        const returned = await addInventoryItemBefore(object, oldSlot);
        await encumber_msg(state);
        if ((returned.owornmask ?? 0) & W_QUIVER)
            await setQuiverObject(null, state);
        await setPrimaryWeapon(returned, state);
        setTwoWeaponCombat(twoWeapons, state);
        if (cansee(impact.x, impact.y))
            await newsym(impact.x, impact.y);
        return true;
    }
    let damage = rn2(2);
    if (damage === 0) {
        const position = propertyIsActive('levitation', state) ? 'beneath' : 'at';
        const feet = makePlural(body_part(FOOT, state));
        await plineWithContinuation(heroIsBlind(state)
            ? `Something lands ${position} your ${feet}.`
            : `${definiteObjectAction(object, 'return', state)} back to you, landing ${position} your ${feet}.`);
    }
    else {
        damage += rnd(3);
        const arm = body_part(ARM, state);
        await plineWithContinuation(heroIsBlind(state)
            ? `${definiteObjectAction(object, 'hit', state)} your ${arm}!`
            : `${definiteObjectAction(object, 'fly', state)} back toward you, hitting your ${arm}!`);
        if (object.oartifact) {
            const hit = await hitHeroWithFallingArtifact(object, damage, {
                state, publish: plineWithContinuation, random: rn2, rollOne: rnd, dieRoll: 0,
            });
            if (hit.heroDied)
                return true;
            damage = hit.damage;
        }
        if (await loseHeroHp(state.u.halfPhysicalDamage ? Math.ceil(damage / 2) : damage, killerObjectName(object, state), { state, killerFormat: KILLED_BY }))
            return true;
    }
    if (state.u.uswallow) {
        const engulfer = state.u.ustuck;
        if (!engulfer)
            throw new Error('A swallowed returning weapon needs an engulfer.');
        await addObjectToMonsterInventory(engulfer, object, state, { atFront: true });
    }
    else if (!await shipObject(object, state.u.ux, state.u.uy, { state })) {
        await dropObjectAtHero(object, { state });
    }
    return true;
}
// C dothrow.c:sho_obj_return_to_u(). The currently thrown object returns to
// the hero (not for boomerangs); the glyph roll uses the display rng.
async function showReturnFlight(object, impact, state) {
    const dx = state.u.dx ?? 0, dy = state.u.dy ?? 0;
    if (!(dx || dy) || impact.x === state.u.ux && impact.y === state.u.uy)
        return;
    const path = [];
    let x = impact.x - dx, y = impact.y - dy;
    while (isok(x, y) && (x !== state.u.ux || y !== state.u.uy)) {
        path.push({ x, y });
        x -= dx;
        y -= dy;
    }
    const glyph = transientObjectGlyph(object);
    await flush_screen(0);
    await captureThrownObjectFlight(object, path, state, glyph);
}
const PM_AIR_ELEMENTAL = 154;
function possessive(name) {
    return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}
// C dothrow.c:swallowit(). The engulfer picks the object up (steal.c
// mpickobj() clears gt.thrownobj); a thrown chained ball only ends the
// throw without being handed over.
async function swallowit(engulfer, object, state, attachedBall) {
    if (attachedBall)
        return;
    await addObjectToMonsterInventory(engulfer, object, state, { atFront: true });
}
function swallowedWeaponTarget(state, item, objectClass) {
    const engulfer = state.u?.uswallow ? state.u?.ustuck : null;
    if (!engulfer)
        return null;
    const subtype = objectSkill(item.otyp);
    // thitmonst() groups weapons, weptools, and gems into its weapon
    // branch, and gives heavy iron balls and boulders the same hmon()
    // contact with Strength exercised around the guaranteed hit.
    const weaponLike = objectClass === WEAPON_CLASS || objectClass === GEM_CLASS
        || (objectClass === TOOL_CLASS && subtype !== 0)
        || item.otyp === HEAVY_IRON_BALL || item.otyp === BOULDER;
    if (!weaponLike || engulfer.wormno) {
        return null;
    }
    return engulfer;
}
function genericSwallowedEligibility(state, item, objectClass) {
    const engulfer = state.u?.uswallow ? state.u?.ustuck : null;
    if (!engulfer)
        return null;
    // canletgo() (do.c) already refused worn armor and accessories, and
    // throw_obj() (dothrow.c:262-263) releases any remaining weapon, quiver,
    // or ball slot via remove_worn_item() before throwit() runs, so a
    // non-special missile carries no detachable worn state to screen here.
    // Weapon/gem damage, effectful potions, coins, balls, boulders, and eggs
    // or venom own materially different continuations above.  Thrown candles
    // are snuffed by throwit_mon_hit()'s snuff_candle() and other surviving
    // light sources by mpickobj()'s engulfer pickup, so a lit object still
    // follows this vanish-and-transfer arm.
    if ([WEAPON_CLASS, POTION_CLASS, COIN_CLASS, GEM_CLASS, BALL_CLASS, VENOM_CLASS].includes(objectClass)
        || item.otyp === BOULDER
        || item === state.uball || item === state.u?.uball)
        return null;
    if (objectClass === TOOL_CLASS && objectSkill(item.otyp) !== 0)
        return null; // is_weptool()
    return engulfer;
}
function swallowedPotionEligibility(state, item, objectClass, selectedQuantity) {
    const engulfer = state.u?.uswallow ? state.u?.ustuck : null;
    if (!engulfer || objectClass !== POTION_CLASS
        || !SUPPORTED_MONSTER_POTION_TYPES.has(item?.otyp)
        || !Number.isInteger(selectedQuantity) || selectedQuantity < 1) {
        return null;
    }
    return engulfer;
}
// Part of C dothrow.c:throwit(): the u.uswallow arm for a weapon-like
// missile (dothrow.c:1569-1578) — the guaranteed thitmonst() hit, then
// the returning-weapon roll or swallowit()'s transfer to the engulfer.
export async function resolveSwallowedWeaponThrow({ state = game, item, objectClass, selectedQuantity, splitObjectId = null, finishKill, volley, }) {
    const engulfer = swallowedWeaponTarget(state, item, objectClass);
    if (!engulfer)
        return false;
    requirePlayingGame(state);
    const weaponMask = item.owornmask ?? 0;
    const returns = isAutoReturningThrow(item, weaponMask, state);
    const impaired = throwerIsImpaired(state);
    const twoWeapons = !!state.u.twoweap;
    const oldSlot = state.inventory[state.inventory.indexOf(item) + 1] ?? null;
    const thrown = await detachThrownUnit(state, item, selectedQuantity, splitObjectId);
    const attachedBall = thrown === state.uball || thrown === state.u?.uball;
    if (attachedBall) {
        // throwit() parks the chained ball and chain on the hero before the
        // engulfed contact (dothrow.c:1569-1573).
        const chain = state.uchain || state.u?.uchain;
        thrown.ox = state.u.ux;
        thrown.oy = state.u.uy;
        if (chain) {
            chain.ox = state.u.ux;
            chain.oy = state.u.uy;
        }
    }
    let tetherDisplay = null;
    try {
        if (state.program_state?.gameover)
            return true;
        const launched = launcherMatchesAmmo(thrown, state.uwep);
        const slipped = await applyThrowSlip({
            state,
            object: thrown,
            launcher: launched,
            throwingWeapon: isThrowingWeapon(thrown),
        });
        await applyLowStaminaThrow({ state, object: thrown });
        if (item.otyp === AKLYS && !!(weaponMask & W_WEP)) {
            tetherDisplay = monsterProjectileDisplay(thrown, state, { tethered: true });
            await flush_screen(0);
        }
        const impactX = engulfer.mx, impactY = engulfer.my;
        const contact = await hitMonsterWithThrownObject(engulfer, thrown, {
            state,
            guaranteedHit: true,
            ...(volley ? { volley } : {}),
            // xkilled() leaves a killing engulfer's inventory alone for the
            // chained ball (mon.c:3526-3538): expulsion's placebc() keeps it.
            // Other returning or attached missiles manage their own disposal.
            ...(returns || attachedBall ? {} : { finishKillWithObject: finishKill }),
        });
        if (contact.heroDied)
            return true;
        if (!contact.consumed) {
            if (returns && await finishReturningThrow({
                state, object: thrown, impact: { x: impactX, y: impactY },
                impaired: impaired || slipped, twoWeapons, oldSlot, tetherDisplay,
            })) {
                if (!state.program_state.gameover)
                    state.context.move = 1;
                return true;
            }
            if (state.u.uswallow) {
                const currentEngulfer = state.u.ustuck;
                if (!currentEngulfer)
                    throw new Error('A swallowed hero must have an engulfing monster.');
                await swallowit(currentEngulfer, thrown, state, attachedBall);
            }
            else {
                await finishHeroThrownObjectLanding({
                    state, object: thrown, x: impactX, y: impactY,
                    contactedMonster: engulfer,
                });
                if (state.program_state.gameover)
                    return true;
            }
        }
        state.context.move = 1;
        return true;
    }
    finally {
        await tetherDisplay?.clear();
        if (state._thrownObject === thrown)
            state._thrownObject = null;
    }
}
// Part of C dothrow.c:thitmonst(): the guaranteed-hit egg/pie/venom arm
// (dothrow.c:2256-2260) — hmon() uses the projectile up.
export async function resolveSwallowedEggPieOrVenomThrow({ state = game, item, selectedQuantity, splitObjectId = null, finishKill, }) {
    const engulfer = state.u?.uswallow ? state.u?.ustuck : null;
    if (!engulfer || !isHeroThrownEggPieOrVenom(item))
        return false;
    const thrown = await detachThrownUnit(state, item, selectedQuantity, splitObjectId);
    try {
        if (state.program_state?.gameover)
            return true;
        await applyThrowSlip({ state, object: thrown });
        await applyLowStaminaThrow({ state, object: thrown });
        const contact = await hitMonsterWithThrownObject(engulfer, thrown, {
            state,
            guaranteedHit: true,
            finishMonsterKill: finishKill,
        });
        if (contact.heroDied)
            return true;
        state.context.move = 1;
        return true;
    }
    finally {
        if (state._thrownObject === thrown)
            state._thrownObject = null;
    }
}
// Part of C dothrow.c:thitmonst(): the guaranteed-hit potion arm
// (dothrow.c:2262-2265) — potionhit() resolves the vapor inside the
// engulfer.
export async function resolveSwallowedPotionThrow({ state = game, item, objectClass, selectedQuantity, splitObjectId = null, wakeMonster, wakeNearby, finishKill, }) {
    const engulfer = swallowedPotionEligibility(state, item, objectClass, selectedQuantity);
    if (!engulfer)
        return false;
    const thrown = await detachThrownUnit(state, item, selectedQuantity, splitObjectId);
    try {
        if (state.program_state?.gameover)
            return true;
        // throwit() evaluates its cursed/greased slip draw before thitmonst().
        // Potions only enter the displacement branch when greased, but a cursed
        // ungreased identity still consumes the rn2(7) gate.
        await applyThrowSlip({ state, object: thrown });
        await applyLowStaminaThrow({ state, object: thrown });
        rnd(20);
        const impact = await hitMonsterWithSupportedPotion({
            state,
            monster: engulfer,
            potion: thrown,
            wakeMonster,
            wakeNearby,
            finishKill,
            heroCaused: true,
            resolveVapor: true,
            distance: 0,
        });
        if (impact?.heroDied)
            return true;
        state.context.move = 1;
        return true;
    }
    finally {
        if (state._thrownObject === thrown)
            state._thrownObject = null;
    }
}
// Part of C dothrow.c:thitmonst(): the taming/food arm while swallowed
// (dothrow.c:2267-2275 and the guaranteed-hit vanish of 2276-2298).
export async function resolveSwallowedFoodThrow({ state = game, item, objectClass, selectedQuantity, splitObjectId = null, wakeMonster, }) {
    const engulfer = state.u.uswallow ? state.u.ustuck : null;
    if (!engulfer || objectClass !== FOOD_CLASS || isHeroThrownEggPieOrVenom(item))
        return false;
    requireLiveGame(state);
    const thrown = await detachThrownUnit(state, item, selectedQuantity, splitObjectId);
    try {
        if (state.program_state.gameover)
            return true;
        await applyThrowSlip({ state, object: thrown });
        await applyLowStaminaThrow({ state, object: thrown });
        const impactX = engulfer.mx, impactY = engulfer.my;
        prepareHeroThrownTarget(engulfer);
        rnd(20);
        const offer = await offerThrownFood(engulfer, thrown, state);
        if (offer?.heroDied)
            return true;
        if (offer?.handled) {
            state.context.move = 1;
            return true;
        }
        if (!offer) {
            const wake = await wakeMonster(engulfer);
            if (wake.heroDied)
                return true;
            if (thrown.otyp === CORPSE && thrown.corpsenm !== undefined
                && touchPetrifies(thrown.corpsenm) && monsterIsAnimal(engulfer)) {
                const stone = await petrifyMonsterImmediately(engulfer, {
                    creditHero: true,
                    finishDeath: (target, death = {}) => finishHeroMonsterKillOutcome(target, target.mx, target.my, {
                        ...death, showKillMessage: false, recordConduct: false,
                    }),
                });
                if (stone.heroDied)
                    return true;
                // The thrown corpse is still free while the statue is made.
                // Native deletes it after expulsion, so it cannot be recovered
                // from the statue or from the square beneath it.
                if (!state.u.uswallow) {
                    await delobj(thrown, state);
                    state.context.move = 1;
                    return true;
                }
            }
            const trail = monsterDigests(engulfer) ? ' entrails'
                : monsterIsWhirly(engulfer) ? ' currents' : '';
            const name = monsterName(engulfer, { state });
            // C dothrow.c:2298 prints Tobjnam(obj, "vanish"); xname() of a
            // corpse is just "corpse", without the species.
            await plineWithContinuation(`${definiteObjectAction(thrown, 'vanish', state)} into ${trail ? possessive(name) : name}${trail}.`);
        }
        if (state.u.uswallow) {
            const currentEngulfer = state.u.ustuck;
            if (!currentEngulfer)
                throw new Error('A swallowed hero must have an engulfing monster.');
            await swallowit(currentEngulfer, thrown, state, false);
        }
        else {
            // Taming can expel the hero and move the monster away from the
            // original impact cell. A rejected meal lands at that old cell.
            await finishHeroThrownObjectLanding({
                state, object: thrown, x: impactX, y: impactY,
                contactedMonster: monsterAtPosition(requireGameLevel(state), impactX, impactY),
            });
            if (state.program_state.gameover)
                return true;
        }
        state.context.move = 1;
        return true;
    }
    finally {
        if (state._thrownObject === thrown)
            state._thrownObject = null;
    }
}
// Part of C dothrow.c:thitmonst(): the remaining guaranteed-hit arm
// (dothrow.c:2276-2298) — the projectile vanishes into the engulfer's
// entrails or currents.
export async function resolveGenericSwallowedThrow({ state = game, item, objectClass, selectedQuantity, splitObjectId = null, wakeMonster, }) {
    const engulfer = genericSwallowedEligibility(state, item, objectClass);
    if (!engulfer)
        return false;
    // freeinv() occurs before throwit() begins slip/contact handling.
    const thrown = await detachThrownUnit(state, item, selectedQuantity, splitObjectId);
    try {
        if (state.program_state?.gameover)
            return true;
        await applyThrowSlip({ state, object: thrown });
        await applyLowStaminaThrow({ state, object: thrown });
        // throwit_mon_hit() runs snuff_candle() before thitmonst() consumes
        // its d20 targeting roll (dothrow.c:1490-1492, 2152).
        await snuffThrownCandle(thrown, state);
        rnd(20);
        const wake = await wakeMonster(engulfer);
        if (wake.heroDied)
            return true;
        const targetName = monsterName(engulfer, { state });
        const whirly = MONSTER_SYMBOL[engulfer.mnum] === 22
            || engulfer.mnum === PM_AIR_ELEMENTAL;
        const trail = monsterDigests(engulfer)
            ? ' entrails' : whirly ? ' currents' : '';
        const destination = trail
            ? `${possessive(targetName)}${trail}` : targetName;
        await plineWithContinuation(`${definiteObjectAction(thrown, 'vanish', state)} into ${destination}.`);
        await swallowit(engulfer, thrown, state, false);
        state.context.move = 1;
        return true;
    }
    finally {
        if (state._thrownObject === thrown)
            state._thrownObject = null;
    }
}
// C dothrow.c:throwit().  Also C dothrow.c:throwit_return(): the finally
// block clears the tracked thrown object at the end of the throw; zap.c
// bhit() owns the map flight itself.
export async function throwOrdinaryObject({ state = game, item, quantity, splitObjectId = null, dx, dy, volley, }) {
    requirePlayingGame(state);
    const weaponMask = item.owornmask ?? 0;
    const twoWeapons = !!state.u.twoweap;
    const oldSlot = state.inventory[state.inventory.indexOf(item) + 1] ?? null;
    const thrown = await detachThrownUnit(state, item, quantity, splitObjectId);
    let tetherDisplay = null;
    try {
        if (state.program_state?.gameover)
            return { heroDied: true };
        const impaired = throwerIsImpaired(state);
        const returns = isAutoReturningThrow(thrown, weaponMask, state);
        const tethered = thrown.otyp === AKLYS && !!(weaponMask & W_WEP);
        const slipped = await applyThrowSlip({
            state,
            object: thrown,
            launcher: launcherMatchesAmmo(thrown, state.uwep),
            throwingWeapon: isThrowingWeapon(thrown),
        });
        await applyLowStaminaThrow({ state, object: thrown });
        const actualDx = state.u.dx ?? dx;
        const actualDy = state.u.dy ?? dy;
        if (state.u.dz) {
            if (state.u.dz < 0 && returns && !impaired && !slipped) {
                observeObjectForNaming(thrown, { state });
                const subject = definiteName(objectName(thrown, state), state);
                await plineWithContinuation(`${subject.charAt(0).toUpperCase() + subject.slice(1)} hits the ${ceilingName(state.u.ux, state.u.uy, state)} and returns to your hand!`);
                const returned = await returnThrowToInventory(thrown, weaponMask, twoWeapons, oldSlot, state);
                return { object: thrown, landed: returned, stoppedBy: 'vertical' };
            }
            const landed = state.u.dz < 0
                ? await tossObjectUp(thrown, { state })
                : await hitFloorWithObject(thrown, { state });
            if (state.program_state.gameover)
                return { heroDied: true };
            return { object: thrown, landed, stoppedBy: 'vertical' };
        }
        const boomerang = thrown.otyp === BOOMERANG
            && !state.underwater && !state.u.uinwater;
        if (boomerang && (Is_airlevel(state.u.uz) || propertyIsActive('levitation', state)))
            await hurtleHero(-actualDx, -actualDy, 1, {
                verbose: true, ...(volley ? { volley } : {}),
            });
        if (state.program_state.gameover)
            return { heroDied: true };
        const trajectory = heroThrowTrajectory(thrown, state, state.uwep);
        if (isLauncherAmmunition(thrown) && thrown.oclass !== GEM_CLASS
            && !launcherMatchesAmmo(thrown, state.uwep)) {
            const skill = Math.abs(objectSkill(thrown.otyp));
            await plineWithContinuation(`You aren't wielding ${withIndefiniteArticle(skillName(skill, state))}, so you throw your ${weaponDescription(thrown)} by ${body_part(HAND, state)}.`);
        }
        const range = state.underwater || state.u.uinwater ? 1
            : tethered ? Math.min(trajectory.range, AKLYS_LIM) : trajectory.range;
        if (tethered) {
            // The tether stays visible through contact and is erased by the
            // return roll, rather than by bhit()'s ordinary flight cleanup.
            // bhit()'s tmp_at(DISP_TETHER) init flush now lives in
            // flyPhysicalObject(), shared with DISP_FLASH flights.
            tetherDisplay = monsterProjectileDisplay(thrown, state, { tethered: true });
        }
        const flight = boomerang
            ? await flyBoomerang(thrown, actualDx, actualDy, state, volley)
            : await flyHeroThrownObject({
                state,
                object: thrown,
                dx: actualDx,
                dy: actualDy,
                range,
                display: tetherDisplay ?? monsterProjectileDisplay(thrown, state),
            });
        if ('heroDied' in flight && flight.heroDied)
            return { heroDied: true };
        if ('caught' in flight && flight.caught) {
            await exerciseAttribute(A_DEX, true, state);
            const returned = await returnThrowToInventory(thrown, weaponMask, twoWeapons, oldSlot, state);
            return { ...flight, object: thrown, landed: returned };
        }
        if ('consumed' in flight && flight.consumed)
            return { ...flight, consumed: true };
        // bhit() erases a web-stopped returning missile before throwit() recoils.
        if (flight.stoppedBy === 'web')
            await tetherDisplay?.clear();
        if (!boomerang && trajectory.recoil) {
            await hurtleHero(-actualDx, -actualDy, trajectory.recoil, {
                verbose: true, ...(volley ? { volley } : {}),
            });
            if (state.program_state.gameover)
                return { heroDied: true };
        }
        if (flight.destroyed || flight.migrated)
            return flight;
        if (flight.contact) {
            // throwit_mon_hit(): a keeper who caught the missile in flight
            // owns it already; no thitmonst, no landing.
            if (flight.contact.isshk && thrown.where === 'minvent'
                && thrown.ocarry === flight.contact)
                return { ...flight, consumed: true };
            await snuffThrownCandle(thrown, state);
            const contact = await hitMonsterWithThrownObject(flight.contact, thrown, {
                state, target: { x: flight.x, y: flight.y },
                ...(volley ? { volley } : {}),
            });
            if (contact.heroDied)
                return contact;
            if (contact.consumed)
                return { ...flight, consumed: true };
        }
        if (!boomerang && returns && flight.stoppedBy !== 'web'
            && await finishReturningThrow({
                state, object: thrown, impact: flight, impaired: impaired || slipped,
                twoWeapons, oldSlot, tetherDisplay,
            })) {
            if (state.program_state.gameover)
                return { heroDied: true };
            return { ...flight, object: thrown, landed: thrown.where === 'inventory' ? thrown : null };
        }
        await tetherDisplay?.clear();
        const landed = await finishHeroThrownObjectLanding({
            state,
            object: thrown,
            x: flight.x,
            y: flight.y,
            contactedMonster: flight.contact,
        });
        return { ...flight, object: thrown, landed };
    }
    finally {
        await tetherDisplay?.clear();
        if (state._thrownObject === thrown)
            state._thrownObject = null;
    }
}
// C dothrow.c:return_throw_to_inv(): first rejoin the original stack,
// otherwise add without merging and restore the equipment slots removed
// for this throw.
async function returnThrowToInventory(object, weaponMask, twoWeapons, oldSlot, state) {
    const split = state.context.objsplit;
    const siblingId = object.o_id === split?.child_oid ? split.parent_oid
        : object.o_id === split?.parent_oid ? split.child_oid : null;
    const sibling = state.inventory.find(item => item.o_id === siblingId);
    if (sibling) {
        state.inventory.unshift(object);
        object.where = 'inventory';
        const parent = object.o_id === split?.parent_oid ? object : sibling;
        const child = parent === object ? sibling : object;
        const joined = await rejoinObjectStack(parent, child, state);
        if (joined) {
            await encumber_msg(state);
            return joined;
        }
        state.inventory.splice(state.inventory.indexOf(object), 1);
        object.where = 'free';
    }
    object.nomerge = true;
    const returned = await addInventoryItemBefore(object, oldSlot);
    returned.nomerge = false;
    const quivered = !!((returned.owornmask ?? 0) & W_QUIVER);
    const held = !!(((returned.owornmask ?? 0) | weaponMask) & (W_WEP | W_SWAPWEP));
    if (quivered && held)
        await setQuiverObject(null, state);
    if (weaponMask & W_WEP && !state.uwep)
        await setPrimaryWeapon(returned, state);
    else if (weaponMask & W_SWAPWEP && !state.uswapwep)
        await setSecondaryWeapon(returned, state);
    else if (weaponMask & W_QUIVER && !state.uquiver)
        await setQuiverObject(returned, state);
    if (twoWeapons && !state.u.twoweap)
        setTwoWeaponCombat(true, state);
    await encumber_msg(state);
    return returned;
}
async function settleGoldOnFloor(state, gold, x, y, dz = 0) {
    const floor = await applyFloorEffects(gold, x, y, { state, verb: 'fall' });
    if (state.program_state?.gameover || floor.finished)
        return floor.object;
    if (dz > 0)
        await pline(`The gold hits the ${surfaceName(x, y, state)}.`);
    placeObjectSynchronously(gold, x, y);
    // throw_gold() sells unconditionally inside a shop; sellobj() itself
    // decides whether the landing spot belongs to the resident keeper.
    await sellHeroDroppedObject(gold, x, y, state);
    const survivor = await stack_object(gold, state) || gold;
    await newsym(x, y);
    return survivor;
}
async function resolveQuiveredGoldMonsterContact({ state, monster, gold, swallowed = false, wakeMonster = null, }) {
    // dothrow.c:omon_adj() can thaw a mobile species before thitmonst()
    // consumes its ordinary d20 targeting roll. Coins skip the damaging
    // classes, but a metal-eating pet can still catch one as food.
    prepareHeroThrownTarget(monster);
    rnd(20);
    const food = await offerThrownFood(monster, gold, state);
    if (food?.heroDied)
        return true;
    if (food)
        return food.handled;
    if (swallowed) {
        // thitmonst()'s guaranteed-hit arm names the engulfer's entrails or
        // currents (dothrow.c:2276-2298) before swallowit()'s mpickobj().
        await wakeMonster?.(monster);
        const name = monsterName(monster, { state });
        const trail = monsterDigests(monster) ? ' entrails'
            : monsterIsWhirly(monster) ? ' currents' : '';
        const destination = trail
            ? `${possessiveName(name)}${trail}` : name;
        await pline(`The gold piece vanishes into ${destination}.`);
        await addObjectToMonsterInventory(monster, gold, state);
        return true;
    }
    await reportHeroThrownMiss(monster, gold, { state });
    if (rn2(3) === 0)
        await wakeMonster?.(monster);
    return false;
}
export async function resolveDirectGoldThrow({ state, gold, dx = 0, dy = 0, dz = 0, wakeMonster = null, angerMonster = null, }) {
    if (!gold || gold.oclass !== COIN_CLASS || !state.inventory.includes(gold))
        return false;
    await freeInventoryObject(gold, state);
    if (state.u?.uswallow && state.u?.ustuck) {
        const engulfer = state.u.ustuck;
        const swallower = monsterDigests(engulfer)
            ? `${possessiveName(monsterName(engulfer, { state }))} entrails`
            : monsterName(engulfer, { state });
        await pline(`The gold disappears into ${swallower}.`);
        await linkObjectToMonsterInventory(engulfer, gold, { state });
        return true;
    }
    if (dz) {
        // throw_gold() describes the purse bouncing off the ceiling unless
        // the level is open to the sky or the hero is in water.
        if (dz < 0 && !Is_airlevel(state.u?.uz)
            && !(state.underwater || state.u?.uinwater)
            && !Is_waterlevel(state.u?.uz)) {
            await pline(`The gold hits the ${ceilingName(state.u.ux, state.u.uy, state)}, then falls back on top of your ${body_part(HEAD, state)}.`);
            const helmet = state.uarmh ?? state.u?.uarmh ?? null;
            if (helmet) {
                await pline(`Fortunately, you are wearing ${withIndefiniteArticle(simpleArmorName(helmet, 'uarmh', state))}!`);
            }
        }
        await settleGoldOnFloor(state, gold, state.u.ux, state.u.uy, dz);
        return true;
    }
    // throw_gold() never enters bhit() when the purse cannot leave the hero.
    const nextX = state.u.ux + dx;
    const nextY = state.u.uy + dy;
    const next = isok(nextX, nextY) ? state.level?.at(nextX, nextY) : null;
    if (!next || !ZAP_POS(next.typ)
        || next.typ === DOOR && !!(next.doormask & (D_CLOSED | D_LOCKED))) {
        await settleGoldOnFloor(state, gold, state.u.ux, state.u.uy);
        return true;
    }
    requirePlayingGame(state);
    const range = heroDirectGoldThrowRange(gold, state);
    const { x, y, contact } = await flyHeroThrownObject({
        state, object: gold, dx, dy, range,
        display: monsterProjectileDisplay(gold, state),
    });
    if (contact) {
        const caught = await resolveGoldMonsterContact({
            state, monster: contact, gold,
            wakeMonster, angerMonster,
        });
        if (caught)
            return true;
    }
    else if (await shipObject(gold, x, y, {
        state: requireInitializedGame(state), publish: plineWithContinuation,
    })) {
        return true;
    }
    await settleGoldOnFloor(state, gold, x, y);
    return true;
}
export async function resolveQuiveredGoldThrow({ state, gold, dx = 0, dy = 0, dz = 0, wakeMonster = null, }) {
    if (!gold || gold !== heroGoldObject(state) || gold !== state.uquiver)
        return false;
    gold = detachHeroGold(state, 1);
    if (!gold)
        return false;
    // Quivered coins use throwit(), including its message and persistent
    // direction changes. An unquivered purse uses throw_gold() instead.
    state.u.dx = dx;
    state.u.dy = dy;
    state.u.dz = dz;
    await applyThrowSlip({ state, object: gold });
    dx = state.u.dx;
    dy = state.u.dy;
    dz = state.u.dz;
    gold.how_lost = LOST_THROWN;
    if (state.u?.uswallow && state.u?.ustuck) {
        return resolveQuiveredGoldMonsterContact({
            state, monster: state.u.ustuck, gold,
            swallowed: true, wakeMonster,
        });
    }
    if (dz) {
        if (dz < 0) {
            await tossObjectUp(gold, { state });
        }
        else {
            await hitFloorWithObject(gold, { state });
        }
        return true;
    }
    const underwater = !!(state.underwater || state.u?.uinwater);
    const trajectory = heroThrowTrajectory(gold, state);
    requirePlayingGame(state);
    const range = underwater ? 1 : trajectory.range;
    const { x, y, contact } = await flyHeroThrownObject({
        state, object: gold, dx, dy, range,
        display: monsterProjectileDisplay(gold, state),
    });
    // throwit() recoils after bhit(), before resolving the monster contact.
    if (trajectory.recoil) {
        await hurtleHero(-dx, -dy, trajectory.recoil, { verbose: true });
        if (state.program_state.gameover)
            return true;
    }
    if (contact) {
        const handled = await resolveQuiveredGoldMonsterContact({
            state, monster: contact, gold, wakeMonster,
        });
        if (handled)
            return true;
    }
    await finishHeroThrownObjectLanding({
        state, object: gold, x, y, contactedMonster: contact,
    });
    return true;
}
//# sourceMappingURL=dothrow.js.map