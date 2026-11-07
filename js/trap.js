// Trap construction, triggers, damage, petrification, and terrain effects.
// C trap.c: maketrap(), dotrap(), mintrap(), animate_statue(), activate_statue_trap(),
// chest_trap(), b_trapped(), selftouch(), float_up(), float_down(), drown(),
// lava_effects(), lava_damage(), blow_up_landmine(), fall_through(), count_traps(),
// immune_to_trap(), launch_drop_spot(), launch_in_progress(), force_launch_placement(),
// and their native helpers.
import { stack_object } from './invent.js';
import { WEAPON_CLASS, ARMOR_CLASS, TOOL_CLASS, POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS, COIN_CLASS, BALL_CLASS, CHAIN_CLASS, } from './objclass.js';
import { objectClassForType, objectSkill, BAG_OF_TRICKS, BOULDER, BRASS_LANTERN, CAN_OF_GREASE, CANDELABRUM_OF_INVOCATION, CHEST, ICE_BOX, FIRE_HORN, LARGE_BOX, OBJECT_MATERIAL_NAMES, OILSKIN_SACK, MAGIC_LAMP, OIL_LAMP, POT_ACID, POT_OIL, POT_WATER, RED_DRAGON_SCALE_MAIL, RED_DRAGON_SCALES, RIN_FIRE_RESISTANCE, SCR_BLANK_PAPER, SCR_FIRE, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_FIREBALL, SPE_NOVEL, TALLOW_CANDLE, TOWEL, WAN_FIRE, WAX_CANDLE, DWARVISH_CLOAK, CORPSE, DART, STATUE, ARROW, BEARTRAP, LAND_MINE, ROCK, SADDLE, CLOAK_OF_MAGIC_RESISTANCE, GRAY_DRAGON_SCALE_MAIL, GRAY_DRAGON_SCALES, IRON_SHOES, KICKING_BOOTS, objectPropertyName, AMULET_OF_LIFE_SAVING, } from './object_data.js';
import { ANTI_MAGIC, ARROW_TRAP, BEAR_TRAP, DART_TRAP, FIRE_TRAP, HOLE, LANDMINE, LEVEL_TELEP, MAGIC_PORTAL, MAGIC_TRAP, MMOVE_DIED, PIT, POLY_TRAP, ROCKTRAP, ROLLING_BOULDER_TRAP, RUST_TRAP, SLP_GAS_TRAP, SQKY_BOARD, SPIKED_PIT, STATUE_TRAP, TELEP_TRAP, TRAPDOOR, VIBRATING_SQUARE, WEB, Is_waterlevel, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU, W_SWAPWEP, W_WEP, is_pit, TRAPNUM, TRAP_EXPLANATIONS, Upolyd, TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_PIT, TT_WEB, xdir, ydir, M_SEEN_FIRE, is_hole, SHOPBASE, A_CON, A_DEX, A_STR, A_WIS, DISMOUNT_FELL, DOOR, D_BROKEN, D_ISOPEN, D_NODOOR, D_TRAPPED, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, MAXULEV, WT_TOOMUCH_DIAGONAL, M_SEEN_SLEEP, VAULT, Is_stronghold, MGIVENNAME, KILLED_BY, STONING, DISMOUNT_GENERIC, IS_ROOM, Is_airlevel, W_SADDLE, CORR, DB_FLOOR, DB_UNDER, DRAWBRIDGE_UP, D_CLOSED, D_LOCKED, FOUNTAIN, IS_AIR, IS_DOOR, IS_FURNITURE, IS_WALL, Is_knox_level, LEVEL_TIMER_KIND, MM_NOCOUNTBIRTH, MM_NOMSG, ROOM, SCORR, SDOOR, SHOP_HOLE_COST, SINK, STONE, ZAP_POS, TRAPPED_DOOR, TRAPPED_CHEST, BURNING, DISSOLVED, DROWNING, IS_WATERWALL, PLNMSG_BACK_ON_GROUND, A_CHA, BOLT_LIM, COULD_SEE, IRONBARS, IS_OBSTRUCTED, IS_STWALL, IS_TREE, Luck, M_AP_MONSTER, MIGR_RANDOM, W_ACCESSORY, W_ARMOR, WT_ELF, CORPSTAT_HISTORIC, MM_ADJACENTOK, MM_NOTAIL, MM_NOWAIT, NO_MINVENT, M_SEEN_ELEC, FAINTED, WATER, Is_earthlevel, In_sokoban, W_QUIVER, In_endgame, LAVAPOOL, HEAD, ARM, FOOT, LEG, SPINE, HAND, FINGER, LL_DUMP, LL_MINORAC, } from './const.js';
import { isok, promptDirection, heroHasInvoluntaryDelay, setMulti } from './cmd.js';
import { armorSimpleName, heroHasWaterWalking, heroHasDrainResistance, objectIsHardHelmet, heroHasFreeAction, destroyWornArmor, } from './do_wear.js';
import { delobj, consumeObjectCharge, useUpInventoryStack, chooseInventoryObject, inventoryItemDescription, currency, } from './invent.js';
import { objectDescription as fullObjectDescription, verbForSubject, objectNameIsPlural, definiteName, objectCombatName, objectName, observeObjectForNaming, ownedObjectAction, ownedObjectName, simpleObjectName, corpseName, withIndefiniteArticle, objectDescription, makePlural, objectQuestion, simpleObjectNameWithArticle, bareArtifactOrPlainName, killerObjectName, definiteObjectAction, erosionMatters, } from './objnam.js';
import { learnObjectType, observeObject, objectMaterial, recordObjectKnowledge, objectTypeKnown } from './o_init.js';
import { cansee, couldsee, vision_recalc, vision_note_blocker_change, vision_reset } from './vision.js';
import { endObjectBurn, beginObjectBurn, stopLevelTimer, putHeroToSleep } from './timeout.js';
import { LIGHT_TYPES, TIMED_LIGHT_TYPES } from './light.js';
import { iceDescriptionAt, waterbodyName } from './pager.js';
import { game, requireGameLevel, requireInitializedGame, requirePlayingGame, requireLiveGame } from './gstate.js';
import { MONSTER_ALIGNMENT, MONSTER_ATTACKS, MONSTER_BODY_META, MONSTER_GENO, MONSTER_LEVEL, MONSTER_MOVE, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL, MONSTER_SOUND, } from './monster_data.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating, heroIsUnaware } from './senses.js';
import { heroIsFlying, heroSpecies, heroCanSpinWeb, heroHasNoHands, heroFormSticks, heroPassesWalls, heroIsPolymorphed, returnHeroToHumanForm, polymonHero, heroIsUnchanging, polymorphHero, heroFormHidesUnderObjects, heroLikesLava, heroMonsterForm as polymorphedHeroForm, body_part, mbodypart, floatVsFlight } from './polyself.js';
import { isPoolAt, isIceAt, isLavaAt } from './dbridge.js';
import { levelHasCeiling, level_difficulty, specialPrototypeAt, levelAtDepth, depth, dungeonDepth, find_hell, surfaceName, ceilingName, placeHeroOnLevel, updateLastSeenTerrain, In_quest, In_hell, } from './dungeon.js';
import { monsterFliesOrFloats, monsterInAir, angerMonster, finishEnvironmentalMonsterDeath, maybeUnhideAt, finishMonsterKilled, finishMonsterPetrification, monsterSubject, restoreShapechanger, turnGolemToStone, wakeMonster, wakeMonstersNearWithMessages, changeMonsterForm, resolveMonsterLiquid, revealMonsterAppearance, setHeroGrip, wornMonsterLifeSaver, restoreMonsterShape, finishHeroMonsterKill, finishHeroMonsterKillOutcome, } from './mon.js';
import { objectOwnershipPrefix, chargeAlteredUnpaidObject, sellHeroDroppedObject, deleteObject, addShopDamage, shopDig, chargeUnpaidUsage, costlySpot, restoreShopkeeperResidency, stolenValue, insideShopRoomAt, makeAngryShopkeeper, deleteObjectContents, } from './shk.js';
import { monsterWieldedWeapon, unwieldMonsterWeapon, dryTowel, wetTowel, rollPhysicalWeaponDamage, rollPhysicalWeaponDamageAgainstHero } from './weapon.js';
import { isWeaponTool, isBimanualObject, isBlade, objectIsOrganic, objectIsRustprone, objectIsCorrodeable, objectIsCrackable } from './object_properties.js';
import { canSeeMonster, canSpotMonster, map_trap, newsym, shieldeff, flush_screen, lastDirtyMapCursor, show_glyph_cell, canOverwriteTerrain, transientObjectGlyph, feel_newsym, map_invisible, under_water, } from './display.js';
import { objectResistsDestruction, getObjectLocation, blankNovel, burnFloorObjectsAt, destroyFireInventory, destroyFireMonsterInventory, heroHasHalfSpellDamage, meltIce, monsterResistsEffect, poly_obj, restoreMonsterTraits, destroyElectricInventory, fractureRock, } from './zap.js';
import { impossible } from './diagnostics.js';
import { d, rnl, rn2, rnd, rn2Display, rn1 } from './rng.js';
import { DISCARDED_CALL_LOG, recordRandom } from './monster_action_types.js';
import { plineWithContinuation, pline, set_msg_xy, formatSeenMessage, formatFeltMessage, formatHeardMessage, publishHeardMessage, recordGameLogEvent, } from './pline.js';
import { requireInitializedHero } from './hero_types.js';
import { AD_PHYS, AD_CORR, AD_FIRE, AD_RUST, AD_MAGM, AD_RBRE, AT_BREA, AT_MAGC } from './monster_attack_types.js';
import { removeObjectFromMonsterInventory, destroyObjectFromMonsterInventory, findMonsterArmorClass, wornInSlot, applyMonsterEquipmentProperties, initializeMonsterArmor, } from './worn.js';
import { monsterKnowsTrap, monsterLearnsTrap, monstersSeeTrap, monsterResistsSleep, monsterHasFireResistance, monsterHasMagicResistance, monsterHasStoneResistance, monstersForgetHeroResistance, monstersObserveHeroResistance, monsterIsHelpless, monsterPassesWalls, acidic, extra_nasty, is_neuter, likes_gems, metallivorous, monsterDigests, monsterHasNoLimbs, monsterIsAmorphous, monsterIsAnimal, monsterIsBig, monsterIsBreathless, monsterIsClinger, monsterIsFloater, monsterIsFlyer, monsterIsHider, monsterIsHumanoid, monsterIsMindless, monsterIsNonliving, monsterIsUnsolid, monsterIsVampireShifter, monsterIsWhirly, monsterThrowsRocks, strongmonst, monsterObjectPronoun, grounded, passes_rocks, monsterIsGolem, touchPetrifies, heroResistsStoning, formCanBecomeStoneGolem, PM_STONE_GOLEM, cant_drown, monsterIsAmphibious, monsterStagger, isHeroDefender, resistsBlnd, } from './mondata.js';
import { teleportMonsterFromTrap, mlevel_tele_trap, clearFixedTeleportDestination, heroTeleportDestinationOk, heroTeleportTrapBlock, teleds, teleportHero, activateMagicPortal, askTeleportDestination, triggerLevelTeleportTrap, relocateObjectRandomly, heroCanTeleport, heroControlsTeleport, safe_teleds, teleportHeroAtWill, heroTeleportRestricted, finishTeleportArrival, randomTeleportDepth, } from './teleport.js';
import { countLevelFeatures, makemonNear } from './mklev.js';
import { canFallThrough } from './dungeon.js';
import { displayColorName, displayLiquidName, monsterName, monsterName as canonicalMonsterName, monsterName as perceivedMonsterName, objectMonsterName, randomDisplayMonsterName, setMonsterGivenName, randomColorName, monsterTypeName, } from './do_name.js';
import { munstone } from './muse.js';
import { adjustMonsterSpeed, monsterSpeedMessage, removeHeroEquipment } from './worn.js';
import { recordHeroKillConduct, finishHeroDeath, beginHeroLifeSaving, completeHeroLifeSaving, identifyLifeSavingAmulet, } from './end.js';
import { loseHeroExperience, addExperience, checkExperienceLevel } from './exper.js';
import { billDummyObject, mksobj, objectWeight, unlinkObject, mkcorpstat, rndmonnumAdj, objectIsFlammable, objectIsRottable, placeCreatedObject, placeObject, placeObjectSynchronously, remove_object, splitObjectStack, updateIceObjectTimersAt, } from './mkobj.js';
import { buryObject, buryFloorObjectsAt, buriedBallNear, buriedBallToPunishment, unearthFloorObjectsAt, liquidForHole, } from './dig.js';
import { monsterAtPosition, monsterHasMapPosition, dismountHero, steedIsGrounded, monsterOccupiesPosition } from './steed.js';
import { gotoLevel, scheduleLevelChange, woundHeroLegs, dropBoulderIntoLiquid, applyFloorEffects } from './do.js';
import { hasCarriedProperty, hasWornProperty, refreshMovementProperties, existingPropertyRecord, propertySourceIsActive, propertyIsBlocked, propertyIsActive, clearLevitationMasks, levitationAtWill, grantIntrinsicProperty, hasIntrinsicProperty, hasInvokedProperty, removeIntrinsicProperty, } from './properties.js';
import { ordinalSuffix, possessiveName, dist2, distmin } from './hacklib.js';
import { heroHasArtifactDefense, artifactById, hasMagicKey, heroHasCarriedArtifactFlag } from './artifact.js';
import { burnAwayHeroSlime, loseHeroHp, blocksDiagonalDoor, blocksMove, badRock, roomsAt, finishDestinationSpotEffects, EXT_ENCUMBER, HVY_ENCUMBER, calcCapacity, inventoryWeight, nearCapacity, applyHeroLiquidEffects, endVoluntaryMultiTurn, heroLocomotion, applyHeroLocationEffects, heroCanSwim, moveObject, dropEmergencyObject, pickEmergencyDrop, heroResistsFire as heroResistsFireWithoutArtifactDefense, UNENCUMBERED, SLT_ENCUMBER, nomul, setHeroInWater, crawlDestinationAllowed, spotChecks, finishHeroHelplessness, } from './hack.js';
import { adjustAttribute, adjustHeroAlignment, attributeChangeMessage, changeHeroLuck, currentAttribute, exerciseAttribute, minHeroMaxHitPoints, poisonHero } from './attrib.js';
import { displayMessageWindow } from './topl.js';
import { abusePet, tameMonster, makePetWary } from './dog.js';
import { heroCanReachFloor, deleteEngravingAt } from './engrave.js';
import { beginBallAndChainMove, finishBallAndChainMove, fallWithIronBall, heroIsPunished, placeBallAndChain, unplaceBallAndChain } from './ball.js';
import { catchLit, checkHeroLeashes, bringLeashedFollowers, releaseAllMonsterLeashes, splashLitObject } from './apply.js';
import { isDoorMimic, isObjectOrFurnitureMimic, revealMimic, applyMonsterPassiveToObject } from './uhitm.js';
import { setMonsterMalign, makemon, makemonAt } from './makemon.js';
import { promptYesNoQuit } from './query.js';
import { isWeldedPrimary, uswapwepgone, uwepgone } from './wield.js';
import { hitHeroWithObject } from './hero_object_hit.js';
import { splitHeroMonsterForm, heroIsSliming, makeBlinded, makeDeaf, showInvisibilityMessage, splitMonster, makeHallucinated, makeStunned, setPropertyTimeout, } from './potion.js';
import { searchSpecial, somexyspace } from './mkroom.js';
import { impactDrop, shipObject } from './dokick.js';
import { setTrack } from './track.js';
import { putMonsterToSleep } from './mhitm.js';
import { autopickupAtHero, encumber_msg } from './pickup.js';
import { putGeneratedMonsterInventoryInStatue } from './sp_lev.js';
import { setLevelTerrainType } from './mkmaze.js';
import { addObjectToMonsterInventory, removeWornHeroItem } from './steal.js';
import { hasInternalInvisibility, syncHeroInvisibility } from './hero_invisibility.js';
import { onQuestStart, markQuestLeaderAlive } from './quest.js';
import { applyRemoveCurseSpell, bodyGenderFlags, PM_DOPPELGANGER, revivalReplacement, unpunishHero } from './read.js';
import { projectileHitsIronBars } from './mthrowu.js';
import { scatterFloorObjects } from './scatter.js';
import { rangedTargetHitBonus } from './dothrow.js';
import { bot, rankOf, roleSwitch } from './botl.js';
import { createPoisonGasCloud } from './region.js';
import { stopHeroOccupation } from './allmain.js';
import { reset_faint } from './eat.js';
import { holdingMonsterName, holdingMonsterSubject } from './mhitu.js';
// C trap.c:burnarmor()
export async function burnArmorByFire(victim, state, emitMessage, calls = [], random = rn2, { visible = victim === state.u, } = {}) {
    const monster = 'mnum' in victim ? victim : null;
    if (victim !== state.u && !monster)
        throw new TypeError('Armor damage requires the live hero or a monster.');
    const hero = monster === null;
    const inventory = monster ? inventoryOf(monster) : state.inventory;
    for (const towel of inventory) {
        const wetness = towel.otyp === TOWEL ? towel.spe ?? 0 : 0;
        if (wetness <= 0)
            continue;
        const newWetness = recordRoll(random, calls, wetness + 1);
        if (newWetness === wetness)
            continue;
        await dryTowel(towel, newWetness, { state, verbose: visible, publish: emitMessage ?? null });
        break;
    }
    for (;;) {
        const slot = recordRoll(random, calls, 5);
        let object = null;
        let description = '';
        let torso = false;
        if (slot === 0) {
            object = armorAt(monster, state, W_ARMH);
            description = object
                ? `${OBJECT_MATERIAL_NAMES[objectMaterial(object, state)]} ${armorSimpleName(object, state)}`
                : 'helmet';
        }
        else if (slot === 1) {
            torso = true;
            object = armorAt(monster, state, W_ARMC)
                || armorAt(monster, state, W_ARM)
                || armorAt(monster, state, W_ARMU);
            description = !object ? 'armor'
                : object === armorAt(monster, state, W_ARM)
                    ? objectCombatName(object, { state }) : armorSimpleName(object, state);
        }
        else if (slot === 2) {
            object = armorAt(monster, state, W_ARMS);
            description = 'wooden shield';
        }
        else if (slot === 3) {
            object = armorAt(monster, state, W_ARMG);
            description = 'gloves';
        }
        else {
            object = armorAt(monster, state, W_ARMF);
            description = 'boots';
        }
        const result = await erodeObject(object, 'burn', {
            state,
            random,
            luckRandom: range => {
                calls.push(`rnl(${range})`);
                return rnl(range);
            },
            displayName: description,
            publish: async (message) => {
                if (emitMessage && (hero || visible))
                    await emitMessage(message);
            },
        });
        if (torso)
            return true;
        if (result !== 'nothing')
            return false;
    }
}
// Port only: record a diagnostic random-call argument before drawing.
function recordRoll(random, calls, range) {
    calls?.push(range);
    return random(range);
}
// Port only: read a monster's runtime inventory aliases.
function inventoryOf(monster) {
    return monster?.minvent || monster?.inventory || [];
}
// Port only: find an inventory object by worn-mask bits.
function wornObject(monster, mask) {
    return inventoryOf(monster).find(object => ((object.owornmask ?? 0) & mask) !== 0) || null;
}
// Port only: resolve hero or monster armor from runtime equipment state.
function armorAt(monster, state, mask) {
    if (monster)
        return wornObject(monster, mask);
    return {
        [W_ARM]: state.uarm,
        [W_ARMC]: state.uarmc,
        [W_ARMH]: state.uarmh,
        [W_ARMS]: state.uarms,
        [W_ARMG]: state.uarmg,
        [W_ARMF]: state.uarmf,
        [W_ARMU]: state.uarmu,
    }[mask] || null;
}
// Port only: construct a trap-magic outcome with hero survival.
function result(changed, noticed, state) {
    return { changed, noticed, heroDied: !!state.program_state.gameover };
}
// C trap.c:erode_obj().
export async function erodeObject(object, kind, { state = game, publish = plineWithContinuation, random = rn2, luckRandom = rnl, verbose = false, grease = true, destroy = false, pay = false, displayName = null, position, } = {}) {
    if (!object)
        return 'nothing';
    const rule = EROSION[kind];
    if (!rule)
        throw new TypeError(`Unknown erosion: ${kind}`);
    if (object.where === 'inventory' && inventoryResists(kind, state, random))
        return 'nothing';
    const view = objectView(object, state, position, displayName);
    const agreement = view.plural ? 'are' : 'is';
    if (grease && kind !== 'burn' && kind !== 'rot' && object.greased) {
        await protectWithGrease(object, view, state, publish, random);
        return 'greased';
    }
    if (!erosionMatters(object))
        return 'nothing';
    const tell = verbose && state.flags.verbose !== false;
    if (!objectIsVulnerableToErosion(object, kind, state) || (object.oerodeproof && object.rknown)) {
        if (tell && (view.hero || view.monsterVisible)) {
            await publish(`${objectSubject(view, state)} ${agreement} not affected by ${rule.cause}.`);
        }
        return 'nothing';
    }
    if (object.oerodeproof || (object.blessed && luckRandom(4) === 0)) {
        if (state.flags.verbose !== false
            && (verbose || object.oerodeproof) && view.visible) {
            await publish(`Somehow, ${objectSubject(view, state, false)} ${agreement} not affected by the ${rule.cause}.`);
        }
        if (object.oerodeproof)
            object.rknown = true;
        return 'nothing';
    }
    const erosion = object[rule.field] ?? 0;
    const verb = rule.verb + (view.plural ? '' : 's');
    if (erosion < 3) {
        const adverb = erosion === 2 ? ' completely' : erosion ? ' further' : '';
        if (view.visible)
            await publish(`${objectSubject(view, state)} ${verb}${adverb}!`);
        if (pay)
            await chargeAlteredUnpaidObject(object, rule.past, state);
        object[rule.field] = erosion + 1;
        if (view.hero)
            state._armorClassDirty = true;
        return 'damaged';
    }
    if (destroy) {
        object.in_use = true;
        const action = kind === 'crack'
            ? view.plural ? 'shatter' : 'shatters' : `${verb} away`;
        if (view.visible)
            await publish(`${objectSubject(view, state)} ${action}!`);
        if (pay)
            await chargeAlteredUnpaidObject(object, rule.past, state);
        if (object.owornmask) {
            if (view.hero) {
                await removeWornHeroItem(object, state);
                if (state.program_state?.gameover)
                    return 'destroyed';
            }
            else if (view.carrier) {
                await removeObjectFromMonsterInventory(view.carrier, object, state, { publish });
            }
            else {
                object.owornmask = 0;
            }
        }
        await delobj(object, state);
        return 'destroyed';
    }
    if (tell && view.visible) {
        const sense = view.hero && heroIsBlind(state) ? 'feel' : 'look';
        await publish(`${objectSubject(view, state)} ${sense}${view.plural ? '' : 's'} completely ${rule.past}.`);
    }
    return 'nothing';
}
// Part of C trap.c:erode_obj(): choose the material vulnerability for an erosion type.
export function objectIsVulnerableToErosion(object, kind, state = game) {
    if (kind === 'burn')
        return objectIsFlammable(object, state);
    if (kind === 'rust')
        return objectIsRustprone(object, state);
    if (kind === 'corrosion')
        return objectIsCorrodeable(object, state);
    if (kind === 'rot')
        return objectIsRottable(object, state);
    return objectIsCrackable(object, state);
}
// Part of C zap.c:inventory_resistance_check(), zap.c:u_adtyp_resistance_obj(): protect carried items from fire or acid.
function inventoryResists(kind, state, random) {
    if (kind !== 'burn' && kind !== 'corrosion')
        return false;
    const property = kind === 'burn' ? 'fireResistance' : 'acidResistance';
    if (hasWornProperty(property, state) || hasCarriedProperty(property, null, state))
        return random(100) < 99;
    return kind === 'burn' && state.uarmc?.otyp === DWARVISH_CLOAK
        && random(100) < 90;
}
// C trap.c:grease_protect()
async function protectWithGrease(object, view, state, publish, random) {
    if (view && (view.hero || view.monsterVisible)) {
        // Native grease feedback appends 's even when the name ends in s.
        const subject = view.monsterVisible && view.carrier
            ? `${monsterName(view.carrier, { state, capitalized: true })}'s ${view.name}`
            : objectSubject(view, state);
        await publish(`${subject} ${view.plural ? 'are' : 'is'} protected by the layer of grease!`);
    }
    else if (!view) {
        const carrier = objectCarrier(object, state);
        // acid_damage supplies no name; grease_protect names the object only
        // inside this feedback guard, so silent protection cannot reveal it.
        if (object.where === 'inventory' || (carrier && canSeeMonster(carrier))) {
            await publish(`${ownedObjectAction(object, 'are', state)} protected by the layer of grease!`);
        }
    }
    if (random(2) === 0) {
        object.greased = false;
        if (object.where === 'inventory')
            await publish('The grease dissolves.');
    }
}
// Port only: resolve a carried object's monster identity in runtime state.
function objectCarrier(object, state) {
    if (object.where !== 'minvent')
        return null;
    return state.u.usteed && state.u.usteed.m_id === object.carrierMid ? state.u.usteed
        : (state.level?.monsters.find(monster => monster.m_id === object.carrierMid) ?? null);
}
// Part of C trap.c:erode_obj(): determine visibility and naming for erosion feedback.
function objectView(object, state, position = { x: object.ox, y: object.oy }, displayName = null) {
    const hero = object.where === 'inventory';
    const carrier = objectCarrier(object, state);
    const monsterVisible = !!carrier && !hero
        && canSeeMonster(carrier);
    const { x, y } = position;
    const floorVisible = !hero && !carrier && cansee(x, y)
        && (!isPoolAt(x, y, state) || (!!state.u.uinwater
            && Math.max(Math.abs(state.u.ux - x), Math.abs(state.u.uy - y)) <= 1));
    let name = displayName ?? objectCombatName(object, { state });
    if (!hero && !monsterVisible)
        name = name.replace(/^the /iu, '');
    const plural = verbForSubject(name, 'are') === 'are';
    return {
        hero, carrier, monsterVisible, plural, name,
        visible: hero || monsterVisible || floorVisible,
    };
}
// Port only: compose an erosion message's subject from its resolved object view.
function objectSubject(view, state, capitalized = true) {
    if (view.hero)
        return `${capitalized ? 'Your' : 'your'} ${view.name}`;
    if (view.monsterVisible && view.carrier) {
        const owner = monsterName(view.carrier, { state, capitalized });
        return `${possessiveName(owner)} ${view.name}`;
    }
    return `${capitalized ? 'The' : 'the'} ${view.name}`;
}
// C trap.c:mk_trap_statue(). Create the statue and transfer the temporary monster's inventory.
async function mk_trap_statue(x, y, level) {
    // trap.c mk_trap_statue(): avoid a co-aligned unicorn whose eventual
    // attitude would contradict the trap, then let mkcorpstat() perform
    // its independent initialized-statue identity before overwriting it.
    let statueMonster;
    let tryCount = 10;
    do {
        statueMonster = rndmonnumAdj(3, 6);
    } while (--tryCount > 0
        && MONSTER_SYMBOL[statueMonster] === 21
        && likes_gems(statueMonster)
        && Math.sign(game.u?.ualign?.type ?? 0)
            === Math.sign(MONSTER_ALIGNMENT[statueMonster] ?? 0));
    const statue = await mkcorpstat(STATUE, null, statueMonster, x, y, 0);
    const temporary = await makemon(statue.corpsenm ?? null, 0, 0, MM_NOCOUNTBIRTH | MM_NOMSG);
    if (temporary) {
        await putGeneratedMonsterInventoryInStatue(temporary, statue);
        level.monsters = level.monsters.filter(monster => monster !== temporary);
    }
}
// C trap.c:dng_bottom(). Stop at the dungeon bottom or the current progression barrier.
function dng_bottom(destination, state = game) {
    const dnum = destination?.dnum ?? 0;
    const dungeon = state.dungeons?.[dnum];
    let bottom = dungeon?.num_dunlevs
        ?? (destination?.dlevel ?? 1);
    if (In_quest(destination)) {
        const locate = state.specialLevels?.get('x-loca');
        if (locate && (dungeon?.dunlev_ureached ?? 0) < locate.dlevel)
            bottom = locate.dlevel;
    }
    else if (In_hell(destination, state) && !state.u.uevent?.invoked) {
        bottom--;
    }
    return bottom;
}
// C trap.c:hole_destination(). Draw a lower level without passing the effective bottom.
function hole_destination() {
    const dnum = game.u?.uz?.dnum ?? 0;
    const bottom = dng_bottom(game.u.uz);
    let dlevel = game.u?.uz?.dlevel ?? 1;
    while (dlevel < bottom) {
        dlevel++;
        if (rn2(4))
            break;
    }
    return { dnum, dlevel };
}
// C trap.c:maketrap(): construct a trap at (x, y), reusing a replaceable
// trap already on the square; the per-type construction follows.
export async function maketrap(x, y, typ) {
    // trap.c:maketrap() treats the two pseudo-types returned by rndtrap()
    // as failed constructions.  They describe trapped furniture rather than
    // floor traps and must not occupy the coordinate for later lregions.
    if (typ === TRAPPED_DOOR || typ === TRAPPED_CHEST)
        return null;
    if (!game.level) {
        return {
            ttyp: typ, tx: x, ty: y, tseen: typ === HOLE, once: false,
            launch: { x: 0, y: 0 },
        };
    }
    const level = game.level;
    if (!level.traps)
        level.traps = [];
    const oldTrap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    // C reinitializes a destroyable trap in place.  This matters when a Lua
    // random trap lands on a fixed one: t_at() must expose the replacement,
    // not an older duplicate.  Portals and the vibrating square are the two
    // undestroyable floor traps and reject replacement.
    if (oldTrap
        && (oldTrap.ttyp === MAGIC_PORTAL
            || oldTrap.ttyp === VIBRATING_SQUARE))
        return null;
    if (!oldTrap) {
        const terrain = level.at(x, y)?.typ;
        // trap.c:maketrap() rejects terrain before allocating a trap.  In
        // particular, Wiz-strt's random trap can land in a cloud: the Lua
        // location owner accepts that dry square, but maketrap() rejects
        // IS_AIR and its caller must not run the later victim-chance draw.
        if (terrain !== undefined && !canOverwriteTerrain(terrain)
            || isPoolAt(x, y) || isLavaAt(x, y)
            || (terrain !== undefined && IS_FURNITURE(terrain)
                && typ !== PIT && typ !== HOLE)
            || (terrain === DRAWBRIDGE_UP && typ === MAGIC_PORTAL)
            || (terrain !== undefined && IS_AIR(terrain) && typ !== MAGIC_PORTAL)
            || (typ === LEVEL_TELEP && Is_knox_level(game.u.uz))) {
            return null;
        }
    }
    if (oldTrap && game.u.utrap && game.u.ux === x && game.u.uy === y) {
        const trappedIn = game.u.utraptype;
        if ((trappedIn === TT_BEARTRAP && typ !== BEAR_TRAP)
            || (trappedIn === TT_WEB && typ !== WEB)
            || (trappedIn === TT_PIT && !is_pit(typ))
            || (trappedIn === TT_LAVA && !isLavaAt(x, y))) {
            await resetUtrap(false);
        }
    }
    const initializedTrap = {
        // trap.c:maketrap() initializes the one unhideable floor trap as
        // already seen; ordinary trap doors remain concealed.
        ttyp: typ, tx: x, ty: y, tseen: typ === HOLE, once: false,
        launch: { x: 0, y: 0 },
    };
    const trap = oldTrap || initializedTrap;
    if (oldTrap) {
        trap.ttyp = initializedTrap.ttyp;
        trap.tseen = initializedTrap.tseen;
        trap.once = initializedTrap.once;
        trap.launch = initializedTrap.launch;
        delete trap.launch2;
        delete trap.dst;
        delete trap.teledest;
        delete trap.conjoined;
        delete trap.tnote;
        delete trap.madeby_u;
    }
    if (is_pit(typ))
        trap.conjoined = 0;
    if (is_hole(typ)) {
        trap.dst = hole_destination();
    }
    if (is_pit(typ) || is_hole(typ)) {
        // maketrap() owns these effects even when the caller is Lua or
        // wizard trap creation rather than digging.  Preserve the old shop
        // terrain for repair before opening the floor and exposing buried
        // objects.
        const location = level.requireAt(x, y);
        const oldType = location.typ;
        const wasIce = isIceAt(x, y);
        const wallOrDoor = IS_DOOR(oldType) || IS_WALL(oldType);
        if (roomsAt(game.level, x, y, SHOPBASE).length
            && (is_hole(typ) || wallOrDoor)) {
            addShopDamage(x, y, wallOrDoor && !game.context.mon_moving ? SHOP_HOLE_COST : 0);
        }
        if (oldType === DRAWBRIDGE_UP) {
            location.drawbridgemask = ((location.drawbridgemask ?? 0) & ~DB_UNDER) | DB_FLOOR;
            location.flags = location.drawbridgemask;
        }
        else {
            if (IS_ROOM(oldType))
                setLevelTerrainType(x, y, ROOM);
            else if (oldType === STONE || oldType === SCORR)
                setLevelTerrainType(x, y, CORR);
            else if (IS_WALL(oldType) || oldType === SDOOR)
                setLevelTerrainType(x, y, level.flags.is_maze_lev ? ROOM
                    : level.flags.is_cavernous_lev ? CORR : DOOR);
            // These separate JS fields mirror the same native rm.flags union.
            location.flags = 0;
            location.doormask = 0;
            location.wall_info = 0;
            location.altarmask = 0;
            location.ladder = 0;
            location.drawbridgemask = 0;
            location.looted = 0;
            location.icedpool = 0;
            location.emptygrave = 0;
        }
        if (wasIce && !isIceAt(x, y)) {
            updateIceObjectTimersAt(x, y, game, { includeBuried: true });
            stopLevelTimer(x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY);
        }
        if (oldType !== location.typ && (oldType === FOUNTAIN || oldType === SINK))
            countLevelFeatures();
        await unearthFloorObjectsAt(x, y);
        vision_note_blocker_change(x, y);
    }
    else if (typ === STATUE_TRAP) {
        await mk_trap_statue(x, y, level);
    }
    else if (typ === SQKY_BOARD) {
        trap.tnote = choose_trapnote(trap, level);
    }
    else if (typ === ROLLING_BOULDER_TRAP) {
        await mkroll_launch(trap, x, y, level);
    }
    // C trap.c:maketrap() links the new trap into ftrap only after the
    // per-type construction (trap.c:577). The newsym() from unearth_objs()
    // inside that construction therefore cannot observe this trap yet: a
    // hole dug under a standing monster maps the remembered background, not
    // the fresh tseen hole, into hero memory.
    if (!oldTrap)
        level.traps.push(trap);
    if (oldTrap)
        finishSokobanIfSolved();
    return trap;
}
// C trap.c:clamp_hole_destination(). Clamp a saved hole to its effective dungeon bottom.
export function clampHoleDestination(destination, state = game) {
    const dungeon = state.dungeons[destination.dnum];
    if (!dungeon)
        throw new Error(`Hole leads to absent dungeon ${destination.dnum}`);
    if (In_quest(destination) && !state.specialLevels?.get('x-loca'))
        throw new Error('Quest falls require the locate level');
    const bottom = dng_bottom(destination, state);
    return { dnum: destination.dnum, dlevel: Math.min(destination.dlevel, bottom) };
}
// C trap.c:fall_through(). Temporary openings schedule travel; trap callers finish their own arrival.
export async function fall_through(td, trap, { tookPlunge = false } = {}) {
    if (!td) {
        requirePlayingGame(game);
        const hero = game.u;
        const { ux: x, uy: y } = hero;
        const sokoban = game.level.flags.sokoban_rules;
        if (heroIsBlind() && hero.levitating && !sokoban)
            return;
        await plineWithContinuation(`The ${surfaceName(x, y)} opens up under you!`);
        const form = heroSpecies();
        const clings = monsterIsClinger(form);
        const ceilingHider = monsterIsHider(form) && (clings && MONSTER_SYMBOL[form] !== 13 || monsterIsFlyer(form));
        let refusal = null;
        if (!(sokoban && canFallThrough(hero.uz))) {
            if (hero.levitating || hero.ustuck || (!canFallThrough(hero.uz) && !game.level.requireAt(x, y).candig)
                || hero.flying || clings || ceilingHider && hero.uundetected)
                refusal = "You don't fall in.";
            else if ((MONSTER_SIZE[form] ?? 2) >= 4)
                refusal = "You don't fit through.";
            else if (!await bringLeashedFollowers())
                refusal = 'You are jerked back by your pet!';
        }
        if (refusal) {
            await plineWithContinuation(refusal);
            await impactDrop(null, x, y, { publish: plineWithContinuation });
            await displayMessageWindow();
            await plineWithContinuation('The opening under you closes up.');
            return;
        }
        if (hero.ushops?.length)
            await shopDig(1);
        const destination = Is_stronghold(hero.uz) ? game.valley_level
            : { dnum: hero.uz.dnum, dlevel: hero.uz.dlevel + 1 };
        if (!destination)
            throw new Error('The stronghold fall requires the Valley destination.');
        if (!Is_stronghold(hero.uz)) {
            const distance = dungeonDepth(destination.dnum, destination.dlevel)
                - dungeonDepth(hero.uz.dnum, hero.uz.dlevel);
            if (distance > 1)
                await plineWithContinuation(`You fall down a ${distance > 3 ? 'very ' : ''}${distance > 2 ? 'deep ' : ''}shaft!`);
        }
        scheduleLevelChange([destination, {
                arrival: hero.flying ? 'random' : 'falling',
                postMessage: `The hole in the ${ceilingName(x, y)} above you closes up.`
            }]);
        return;
    }
    if (!trap || (trap.ttyp !== HOLE && trap.ttyp !== TRAPDOOR))
        return null;
    requirePlayingGame(game);
    const sokoban = !!game.level?.flags?.sokoban_rules;
    const levitating = !!(game.u?.levitating || game.levitating);
    if (game.blind && levitating && !sokoban)
        return null;
    await feelTrap(trap);
    if (!sokoban && !tookPlunge)
        await plineWithContinuation(trap.ttyp === TRAPDOOR
            ? 'A trap door opens up under you!' : "There's a gaping hole under you!");
    const form = heroMonsterForm();
    const flying = !!(game.u.flying || game.flying);
    const clinging = monsterIsClinger(heroMonsterForm() ?? -1);
    const hidingAbove = game.u.uundetected && monsterIsHider(heroMonsterForm() ?? -1)
        && MONSTER_SYMBOL[form] !== S_MIMIC;
    const tooLarge = Number.isInteger(form)
        && (MONSTER_SIZE[form] ?? 0) >= MZ_HUGE;
    const forced = sokoban && canFallThrough(game.u.uz);
    const avoidsFall = levitating || game.u.ustuck
        || (!canFallThrough(game.u.uz) && !game.level.at(game.u.ux, game.u.uy)?.candig)
        || ((flying || clinging || hidingAbove) && !tookPlunge);
    let refusal;
    if (!forced && avoidsFall)
        refusal = "You don't fall in.";
    else if (!forced && tooLarge)
        refusal = "You don't fit through.";
    else if (!forced) {
        if (!await bringLeashedFollowers(game))
            refusal = 'You are jerked back by your pet!';
    }
    if (refusal) {
        await plineWithContinuation(refusal);
        await impactDrop(null, game.u.ux, game.u.uy, { publish: plineWithContinuation });
        return null;
    }
    if ((flying || clinging) && tookPlunge)
        await plineWithContinuation(`You ${flying ? 'swoop' : 'deliberately drop'} down `
            + `${trap.ttyp === TRAPDOOR ? 'through the trap door' : 'into the gaping hole'}!`);
    if (game.u.ushops?.length)
        await shopDig(1);
    const current = game.u.uz;
    if (Is_stronghold(current)) {
        return { destination: find_hell(), arrival: flying ? 'random' : 'falling' };
    }
    const destination = clampHoleDestination(trap.dst
        ?? { dnum: current.dnum, dlevel: current.dlevel + 1 });
    const distance = dungeonDepth(destination.dnum, destination.dlevel)
        - dungeonDepth(current.dnum, current.dlevel);
    // C fall_through(): only a deliberate plunge while Flying is
    // controlled_flight; a forced Sokoban fall still falls.
    const controlledFlight = flying && tookPlunge;
    if (distance > 1)
        await plineWithContinuation(`You ${controlledFlight ? 'fly' : 'fall'} down a ${distance > 3 ? 'very ' : ''}`
            + `${distance > 2 ? 'deep ' : ''}shaft!`);
    return { destination, arrival: flying ? 'random' : 'falling' };
}
const S_MIMIC = 13;
const PM_CAVE_SPIDER = 94;
const PM_GIANT_SPIDER = 96;
const PM_GREMLIN = 40;
const IRON = 11;
// Port only: require and read the live hero's species.
function heroMonsterForm() {
    requirePlayingGame(game);
    return game.u.umonnum;
}
const MS_GUARDIAN = 38;
const PM_FLESH_GOLEM = MONSTER_NAME.indexOf('flesh golem');
// C trap.c:animate_statue(): release the statue's monster, named from the
// statue, awake and hostile unless the animation is magical.
export async function animateStatue(statue, x, y, { state = game, shatter = false, magic = false, } = {}) {
    if (statue.corpsenm === undefined)
        throw new Error(`Statue ${statue.o_id} has no monster species.`);
    const savedTraits = statue.oextra?.omonst;
    let revival = revivalReplacement(statue.corpsenm, statue, true);
    if (revival == null && (MONSTER_SOUND[statue.corpsenm] ?? 0) === MS_GUARDIAN
        && state.urole?.guardnum !== statue.corpsenm)
        revival = PM_DOPPELGANGER;
    const replacement = revival
        ?? (magic && monsterIsGolem(statue.corpsenm)
            && statue.corpsenm !== PM_FLESH_GOLEM ? PM_FLESH_GOLEM : null);
    const useSavedTraits = replacement == null && !!savedTraits;
    const mnum = replacement ?? savedTraits?.mnum ?? statue.corpsenm;
    let flags = NO_MINVENT | MM_NOMSG;
    if (useSavedTraits) {
        flags |= MM_NOWAIT | MM_NOCOUNTBIRTH | MM_NOTAIL;
    }
    else {
        flags |= bodyGenderFlags(statue);
    }
    const mayMoveAside = magic || replacement === PM_DOPPELGANGER;
    if (mayMoveAside)
        flags |= MM_ADJACENTOK;
    if (replacement === PM_DOPPELGANGER)
        flags |= MM_NOCOUNTBIRTH;
    const creatingAtHero = state.u?.ux === x && state.u?.uy === y;
    const occupied = !!monsterAtPosition(requireGameLevel(state), x, y);
    const monster = creatingAtHero || (occupied && mayMoveAside)
        ? await makemonNear(mnum, x, y, flags, creatingAtHero)
        : await makemonAt(mnum, x, y, flags);
    if (!monster) {
        const unique = !!((MONSTER_GENO[statue.corpsenm] ?? 0) & G_UNIQ);
        return { monster: null, unique };
    }
    if (useSavedTraits) {
        restoreMonsterTraits(monster, savedTraits);
        restoreShopkeeperResidency(monster, state);
        markQuestLeaderAlive(monster, state);
        await newsym(monster.mx, monster.my);
        await restoreMonsterShape(monster, state);
        if (monster.mtame && !monster.isminion)
            await makePetWary(monster, { wasDead: true, state });
    }
    else if (replacement === PM_DOPPELGANGER
        && monster.cham === PM_DOPPELGANGER) {
        await changeMonsterForm(monster, statue.corpsenm);
    }
    const name = statue.oextra?.oname || statue.oname;
    if (name && !((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ))
        setMonsterGivenName(monster, name);
    // C animate_statue(): a mimic shows itself; other hiders stop hiding.
    if (!(await revealMonsterAppearance(monster)).revealed)
        monster.mundetected = 0;
    monster.msleeping = 0;
    if (!magic) {
        monster.mtame = 0;
        monster.pet = false;
        monster.mpeaceful = 0;
        setMonsterMalign(monster, state);
    }
    const verb = magic && monsterIsGolem(statue.corpsenm)
        && statue.corpsenm !== PM_FLESH_GOLEM && canSpotMonster(monster)
        ? 'turns into flesh'
        : !canSpotMonster(monster) ? 'disappears'
            : monsterIsNonliving(monster.mnum) || monsterIsVampireShifter(monster) ? 'moves' : 'comes to life';
    const heroAtStatue = state.u?.ux === x && state.u?.uy === y;
    if (heroAtStatue || magic) {
        const keeper = costlySpot(monster.mx, monster.my, state)?.resident;
        const description = magic && (monster !== keeper || statue.where === 'inventory')
            ? ownedObjectName(statue, state)
            : `${objectOwnershipPrefix(statue, state)}statue`;
        await plineWithContinuation(`${description} ${verb}!`);
    }
    else if (heroIsHallucinating(state)) {
        await plineWithContinuation(`The ${randomDisplayMonsterName()} suddenly seems more animated.`);
    }
    else if (shatter) {
        const description = cansee(x, y)
            ? ownedObjectName(statue, state, { capitalized: false }) : 'a statue';
        await plineWithContinuation(`Instead of shattering, ${description} suddenly ${verb}!`);
    }
    else {
        const description = canSpotMonster(monster)
            ? monsterName(monster, { article: 'a', state })
            : 'something';
        await plineWithContinuation(`You find ${description} posing as a statue.`);
        if (!canSpotMonster(monster) && heroIsBlind(state))
            await map_invisible(x, y);
        await stopHeroOccupation(state);
    }
    const keeper = costlySpot(x, y, state)?.resident;
    if (!state.context?.mon_moving && (magic || shatter) && keeper !== monster
        && keeper && (statue.where === 'inventory' ? statue.unpaid : !statue.no_charge))
        await stolenValue(statue, x, y, !!keeper.mpeaceful, { silent: false, state });
    if (state.urole?.key === 'archeologist'
        && ((statue.spe ?? 0) & CORPSTAT_HISTORIC)) {
        if (!state.context.mon_moving) {
            await plineWithContinuation(formatFeltMessage('guilty that the historic statue is now gone.', state));
            adjustHeroAlignment(-1, state);
        }
        else if (cansee(x, y)) {
            await plineWithContinuation(formatFeltMessage('regret that the historic statue is now gone.', state));
        }
    }
    while (statue.contents?.length) {
        const object = statue.contents.shift();
        if (!object)
            throw new Error('Statue contents changed during transfer.');
        object.where = 'free';
        object.container = null;
        await addObjectToMonsterInventory(monster, object, state);
    }
    await initializeMonsterArmor(monster, state);
    if (statue.owornmask)
        await removeWornHeroItem(statue, state);
    await delobj(statue, state);
    if (state.u?.ux === x && state.u?.uy === y) {
        const pile = state.level?.objects?.[x]?.[y] || [];
        if (state.u.uundetected && heroFormHidesUnderObjects(state) && pile.length === 0)
            state.u.uundetected = 0;
    }
    return { monster, unique: false };
}
// C trap.c:activate_statue_trap(): consume the trap and animate a statue
// on the square, skipping genocided-uniques until a real candidate.
export async function activateStatueTrapAt(x, y, { state = game, shatter = false } = {}) {
    const trap = state.level?.traps?.find(candidate => candidate.tx === x && candidate.ty === y
        && candidate.ttyp === STATUE_TRAP);
    if (!trap)
        return null;
    deleteTrap(trap, state);
    const statues = (state.level?.objects?.[x]?.[y] || [])
        .filter(object => object.otyp === STATUE);
    let monster = null;
    for (const statue of statues) {
        const result = await animateStatue(statue, x, y, { state, shatter });
        monster = result.monster;
        if (monster || !result.unique)
            break;
    }
    await feel_newsym(x, y);
    return monster;
}
// ---------------------------------------------------------------------------
// C trap.c:deltrap()/maybe_finish_sokoban(). Callers own actor release,
// terrain changes, and redraw; raw deletion only removes the trap itself.
// C trap.c:deltrap()
export function deleteTrap(trap, state = game) {
    const level = requireGameLevel(state);
    clearPitConnections(trap, state);
    const index = level.traps.indexOf(trap);
    if (index < 0)
        throw new Error('deleteTrap: trap is not on the level');
    level.traps.splice(index, 1);
    if (trap.ttyp === PIT || trap.ttyp === HOLE)
        finishSokobanIfSolved(state);
}
// trap.c trapeffect_landmine() guards steedintrap() with a static
// recursive_mine flag: the dying steed's dismount must not re-enter the
// still-armed mine before it is converted to a pit.
let landmineSteedHitInProgress = false;
// C trap.c:keep_saddle_with_steedcorpse(): the blast can scatter the dead
// steed's corpse away from the saddle; the captured saddle follows the
// corpse.  C walks fobj and each container's contents, but only moves the
// saddle when get_obj_location() resolves the corpse to a map square; a
// contained corpse has no location, so C leaves the saddle in place yet
// still stops searching.
export async function keepSaddleWithSteedcorpse(steedMid, saddle) {
    if (saddle.where !== 'floor')
        return; // the blast may destroy the saddle
    const visit = async (objects) => {
        for (const object of [...(objects || [])]) {
            if (object.otyp === CORPSE && object.oextra?.omonst?.m_id === steedMid) {
                if (object.where === 'floor') {
                    remove_object(saddle, game);
                    await placeObject(saddle, object.ox, object.oy, game);
                    await stack_object(saddle, game);
                }
                return true;
            }
            if (await visit(object.contents))
                return true;
        }
        return false;
    };
    for (const column of game.level?.objects ?? []) {
        if (!column)
            continue;
        for (const pile of column)
            if (await visit(pile))
                return;
    }
}
const FLAMING = new Set(['fire vortex', 'flaming sphere', 'fire elemental', 'salamander'].map((name) => MONSTER_NAME.indexOf(name)));
const WEB_TEARERS = new Set([
    'titanothere',
    'baluchitherium',
    'purple worm',
    'jabberwock',
    'iron golem',
    'balrog',
    'kraken',
    'mastodon',
    'Orion',
    'Norn',
    'Cyclops',
    'Lord Surtur',
].map((name) => MONSTER_NAME.indexOf(name)));
const S_GIANT = 34, S_DRAGON = 30;
// C trap.c:mu_maybe_destroy_web().
export async function maybeDestroyWeb(target, trap, { state = game, message = true, publish = plineWithContinuation } = {}) {
    const hero = target === state.u;
    const monster = !hero && 'mnum' in target ? target : null;
    if (!hero && !monster)
        throw new TypeError('Web effects require the live hero or a monster.');
    // youmonst.data describes the natural body as well as polymorphed bodies.
    const species = monster?.mnum ?? heroSpecies(state);
    const body = monster ?? { mnum: species };
    const flaming = FLAMING.has(body.mnum);
    if (!monsterIsAmorphous(body) &&
        !monsterIsWhirly(body) &&
        !flaming &&
        !monsterIsUnsolid(body) &&
        MONSTER_NAME[body.mnum] !== 'gelatinous cube')
        return false;
    const destroy = flaming || acidic(body.mnum);
    const owner = trap.madeby_u ? 'your' : 'a';
    if (message) {
        const action = destroy ? (flaming ? 'burn' : 'dissolve') : 'flow through';
        const subject = monster ? monsterName(monster, { capitalized: true, state }) : 'You';
        const verb = hero ? action : action === 'flow through' ? 'flows through' : `${action}s`;
        await publish(`${subject} ${verb} ${owner} spider web${destroy ? '!' : '.'}`);
        if (!hero && !destroy)
            await seeTrap(trap, state);
    }
    if (destroy) {
        deleteTrap(trap, state);
        await newsym(trap.tx, trap.ty);
    }
    return true;
}
// C trap.c:set_utrap(): only a change between trapped and free marks the
// status line, since the trapped conditions follow u.utrap.
// C set_utrap() always ends in float_vs_flight(), which sets disp.botl even
// when a caller already counted u.utrap down to zero (trapmove()).
export function setHeroTrap(turns, type, state = game) {
    state.context.botl = true;
    state.u.utrap = turns;
    state.u.utraptype = turns ? type : 0;
    floatVsFlight(state);
}
// C trap.c:reset_utrap(): leave the trap (set_utrap(0, 0)), optionally
// announcing a regained sense of levitation or flight.
// C trap.c:reset_utrap()
export async function resetUtrap(message = true, state = game) {
    // C trap.c:reset_utrap() snapshots the Levitation/Flying macros, which
    // read the blocked masks that only float_vs_flight() updates; after a
    // bare u.utrap zeroing (hack.c:trapmove()) those masks are still set.
    // The projected hero flags carry exactly that stale state, while a live
    // propertyIsActive() query would already see the trap gone.
    const wasLevitating = !!state.u.levitating;
    const wasFlying = !!state.u.flying;
    setHeroTrap(0, 0, state);
    if (message) {
        if (!wasLevitating && propertyIsActive('levitation', state))
            await floatHeroUp(state);
        if (!wasFlying && propertyIsActive('flying', state))
            await plineWithContinuation('You can fly.');
    }
}
// C trap.c:floor_trigger(). These traps require contact with the floor even
// when their eventual effect (a dart or falling rock) could hit a flyer.
export function trapTriggeredByFloor(trap) {
    return [ARROW_TRAP, DART_TRAP, ROCKTRAP, SQKY_BOARD, BEAR_TRAP,
        LANDMINE, ROLLING_BOULDER_TRAP, SLP_GAS_TRAP, RUST_TRAP, FIRE_TRAP,
        PIT, SPIKED_PIT, HOLE, TRAPDOOR].includes(trap.ttyp);
}
// C trap.c:wearing_iron_shoes().
export function monsterWearsIronShoes(monster) {
    const boots = wornInSlot(monster, W_ARMF);
    return !!boots && objectMaterial(boots) === IRON;
}
// C trap.c:m_harmless_trap().  mfndpos() marks only harmful traps in
// candidate info; dog_move() then applies its separate hero-seen 1/40 rule.
export function monsterTrapIsHarmless(monster, trap, state) {
    const symbol = MONSTER_SYMBOL[monster.mnum];
    const airborne = monsterIsFlyer(monster.mnum) || symbol === S_EYE || symbol === S_LIGHT;
    const sokoban = state.level.flags.sokoban_rules;
    const floorTriggered = trapTriggeredByFloor(trap);
    if (!sokoban && floorTriggered && airborne)
        return true;
    const whirly = symbol === S_VORTEX || monster.mnum === PM_AIR_ELEMENTAL;
    switch (trap.ttyp) {
        case BEAR_TRAP:
            return ((MONSTER_SIZE[monster.mnum] ?? 2) <= 1 ||
                (monsterIsAmorphous({ mnum: monster.mnum }) || monsterIsUnsolid({ mnum: monster.mnum })) ||
                whirly);
        case WEB:
            return ((monsterIsAmorphous({ mnum: monster.mnum }) || monsterIsUnsolid({ mnum: monster.mnum })) ||
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
            return monsterIsClinger(monster.mnum) && !sokoban;
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
// Port only: read a monster's runtime inventory aliases.
function monsterInventory(monster) {
    return monster?.minvent || monster?.inventory || [];
}
// Port only: resolve the runtime monster weapon slot.
function monsterWeapon(monster) {
    return (monster?.mw ||
        monsterInventory(monster).find((object) => object?.wielded || (object?.owornmask ?? 0) & W_WEP));
}
// C trap.c:trapeffect_arrow_trap(): the monster branch — the missile's
// to-hit and material message against the trapped monster.
// C trap.c:trapeffect_dart_trap(): the same flow with a 1-in-6 poisoned
// dart and its sickness outcome.
export async function beginMonsterProjectileTrap(monster, trap, state = game, { random = rn2, rollOne = rnd } = {}) {
    const visibility = monsterTrapVisibility(monster, state);
    if (trap.once && trap.tseen && random(15) === 0) {
        const event = {
            kind: 'spent-projectile-trap',
            trap,
            finished: !(visibility.inSight && visibility.seeSquare),
            ...visibility,
        };
        if (event.finished) {
            deleteTrap(trap, state);
            if (state === game)
                await newsym(monster.mx, monster.my);
        }
        return event;
    }
    trap.once = true;
    const projectileType = trap.ttyp === DART_TRAP ? DART : ARROW;
    const missile = await makeTrapMissile(projectileType, trap);
    if (projectileType === DART && random(6) === 0)
        missile.opoisoned = 1;
    if (visibility.inSight)
        await seeTrap(trap, state);
    const hit = findMonsterArmorClass(monster) + (trap.ttyp === ARROW_TRAP ? 8 : 7) + (missile.spe ?? 0) <=
        rollOne(20);
    return {
        kind: 'projectile-trap',
        trap,
        missile,
        hit,
        killed: false,
        finished: false,
        ...visibility,
    };
}
// Port only: capture monster and square visibility for deferred trap events.
export function monsterTrapVisibility(monster, state = game) {
    const blind = !!state?.blind || (state?.u?.blindTurns ?? 0) > 0;
    const seeSquare = !blind
        && !!((state?.viz_array?.[monster.my]?.[monster.mx] ?? 0) & 0x2);
    const inSight = state?.u?.usteed === monster
        || canSeeMonster(monster);
    return { inSight, seeSquare };
}
// Arrows and darts created by floor traps.
// C ref: trap.c t_missile().
// C trap.c:t_missile().
export async function makeTrapMissile(objectType, trap) {
    const missile = await mksobj(objectType, true, false);
    missile.quan = missile.quantity = 1;
    missile.owt = objectWeight(missile);
    missile.opoisoned = 0;
    missile.ox = trap.tx;
    missile.oy = trap.ty;
    return missile;
}
// C trap.c:trapeffect_rocktrap(): the hero branch — the 1-in-15 empty
// chute, the falling rock, helmet and passes-rocks handling, and the
// damage; the monster branch — the spent-trap chance, then the falling
// rock's thitm() hit.
async function trapeffectRocktrap(mtmp, trap, { state = game, movement, random = rn2, rollDice = d, beginRandom = random, beginRollDice = rollDice, publish = async () => { }, describeMonster, } = {}) {
    if (isHeroDefender(mtmp, state)) {
        const hero = game.u;
        const ceiling = ceilingName(hero.ux, hero.uy, game);
        if (trap.once && trap.tseen && rn2(15) === 0) {
            await plineWithContinuation(`A trap door in the ${ceiling} opens, but nothing falls out!`);
            deleteTrap(trap);
            await newsym(hero.ux, hero.uy);
            return { kind: 'spent-rock-trap', trap, finished: true, inSight: false, seeSquare: false };
        }
        let damage = d(2, 6);
        trap.once = true;
        await feelTrap(trap);
        const rock = await makeTrapMissile(ROCK, trap);
        placeCreatedObject(rock, hero.ux, hero.uy);
        observeObjectForNaming(rock);
        await plineWithContinuation(`A trap door in the ${ceiling} opens and ${withIndefiniteArticle(objectName(rock))} falls on your ${body_part(HEAD, game)}!`);
        let harmless = false;
        const helmet = game.uarmh || hero.uarmh;
        if (helmet) {
            if (passes_rocks(heroMonsterForm() ?? -1)) {
                await plineWithContinuation(`Unfortunately, you are wearing ${simpleObjectNameWithArticle(helmet)}.`);
                damage = 2;
            }
            else if (objectIsHardHelmet(helmet)) {
                await plineWithContinuation('Fortunately, you are wearing a hard helmet.');
                damage = 2;
            }
            else if (game.flags?.verbose !== false) {
                await plineWithContinuation(`${ownedObjectName(helmet)} does not protect you.`);
            }
        }
        else if (passes_rocks(heroMonsterForm() ?? -1)) {
            await plineWithContinuation('It passes harmlessly through you.');
            harmless = true;
        }
        if (!(game.blind || heroIsBlind(game)))
            observeObject(rock, game);
        await stack_object(rock, game);
        await newsym(hero.ux, hero.uy);
        if (!harmless) {
            if (await loseHeroHp(physicalDamage(damage), 'falling rock'))
                return { kind: 'falling-rock', trap, rock, damage, harmless, killed: false, finished: true, inSight: false, seeSquare: false };
            await exerciseAttribute(A_STR, false);
        }
        return { kind: 'falling-rock', trap, rock, damage, harmless, killed: false, finished: true, inSight: false, seeSquare: false };
    }
    const monster = mtmp;
    const describe = describeMonster
        ?? (target => canonicalMonsterName(target, { state, capitalized: true }));
    const visibility = monsterTrapVisibility(monster, state);
    let event;
    if (trap.once && trap.tseen && beginRandom(15) === 0) {
        event = {
            kind: 'spent-rock-trap',
            trap,
            finished: !(visibility.inSight && visibility.seeSquare),
            ...visibility,
        };
    }
    else {
        trap.once = true;
        const rock = await makeTrapMissile(ROCK, trap);
        if (visibility.inSight)
            await seeTrap(trap, state);
        event = {
            kind: 'falling-rock',
            trap,
            rock,
            damage: beginRollDice(2, 6),
            harmless: passes_rocks(monster.mnum),
            killed: false,
            finished: false,
            ...visibility,
        };
    }
    if (event.kind === 'spent-rock-trap') {
        if (event.finished) {
            deleteTrap(trap, state);
            if (state === game)
                await newsym(monster.mx, monster.my);
        }
        else {
            await publish(`A trap door above ${canonicalMonsterName(monster, { state })} opens, but nothing falls out!`);
            deleteTrap(event.trap, state);
            if (state === game)
                await newsym(monster.mx, monster.my);
            event.finished = true;
        }
        return event;
    }
    if (event.seeSquare) {
        const subject = describe(monster);
        // thitm() names the missile before stackobj(); seeing it makes it
        // eligible to join an already observed pile.
        observeObjectForNaming(event.rock, { state });
        await publish(`${subject} is hit by ${await inventoryItemDescription(event.rock)}${event.harmless ? ' but is not harmed.' : '!'}`);
    }
    if (!event.harmless) {
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - event.damage);
        if (monster.mhp <= 0) {
            const death = await finishMonsterTrapDeath(monster, state, {
                damageType: AD_PHYS,
                random,
                publish,
            });
            event.death = death;
            event.killed = !death.survived;
            if (death.heroDied)
                return event;
            if (death.survived)
                monster.dead = false;
        }
    }
    event.rock = await placeRock(event.rock, event.trap, state);
    event.finished = true;
    return event;
}
// Part of C trap.c:trapeffect_rocktrap(): place and stack the fallen rock.
async function placeRock(rock, trap, state) {
    if (state === game)
        placeCreatedObject(rock, trap.tx, trap.ty);
    else {
        rock.ox = trap.tx;
        rock.oy = trap.ty;
        rock.where = 'floor';
        const level = requireGameLevel(state);
        const column = (level.objects[trap.tx] ??= []);
        const pile = (column[trap.ty] ??= []);
        pile.unshift(rock);
    }
    return await stack_object(rock, state);
}
// Port only: duplicate rounded half-physical damage for hero trap effects.
// The full macro port is maybeHalfPhysicalDamage in hack.ts.
function physicalDamage(amount) {
    if (game.u?.halfPhysicalDamage)
        amount = Math.trunc((amount + 1) / 2);
    return amount;
}
// C trap.c:trapeffect_sqky_board(): the hero branch — a flying hero notices
// the board, otherwise it squeaks trapnote()'s note; the monster branch —
// the squeak heard by the hero, waking nearby sleepers (C mon.c:wake_nearby()
// runs at the end).
async function trapeffectSqkyBoard(mtmp, trap, { state = game, movement, publish = async () => { }, viaSitting = false, failedUntrap = false, forceTrap = false, } = {}) {
    if (isHeroDefender(mtmp, state)) {
        requirePlayingGame(game);
        const hero = game.u;
        const blind = !!game.blind || heroIsBlind(game);
        const deaf = !!game.deaf || heroIsDeaf(game);
        const flying = !!(hero.flying || game.flying);
        const airborne = !!(hero.levitating || game.levitating || flying);
        const forced = forceTrap || failedUntrap || (flying && viaSitting);
        if (airborne && !forced) {
            if (!blind) {
                await seeTrap(trap);
                const hallucinating = heroIsHallucinating(game);
                await plineWithContinuation(hallucinating
                    ? 'You notice a crease in the linoleum.'
                    : 'You notice a loose board below you.');
            }
            return null;
        }
        await seeTrap(trap);
        await plineWithContinuation(deaf
            ? 'A board beneath you vibrates.'
            : `A board beneath you squeaks ${squeakyBoardNoteWithArticle(trap.tnote ?? -1) || 'a note'} loudly.`);
        await wakeMonstersNearWithMessages(hero.ux, hero.uy, hero.ulevel * 20, game);
        return null;
    }
    const monster = mtmp;
    if (monsterInAir(monster, state))
        return null;
    const visibility = monsterTrapVisibility(monster, state);
    const deaf = !!state.deaf || heroIsDeaf(state);
    const range = canAlmostSee(state, monster.mx, monster.my) ? BOLT_LIM + 1 : BOLT_LIM - 3;
    const event = {
        kind: 'squeaky-board',
        trap,
        note: squeakyBoardNoteWithArticle(trap.tnote ?? -1),
        deaf,
        mindless: monsterIsMindless(monster.mnum),
        nearby: dist2(monster.mx, monster.my, state.u?.ux ?? monster.mx, state.u?.uy ?? monster.my) <=
            range * range,
        finished: false,
        ...visibility,
    };
    if (event.inSight) {
        if (!event.deaf) {
            await publish(`A board beneath ${monsterName(monster, { state })} squeaks ${event.note} loudly.`);
            await seeTrap(event.trap, state);
        }
        else if (!event.mindless) {
            await publish(`${monsterName(monster, { state, capitalized: true })} stops momentarily and appears to cringe.`);
        }
    }
    else {
        await publishHeardMessage(`${event.note} squeak ${event.nearby ? 'nearby' : 'in the distance'}.`, publish, state);
    }
    await wakeMonstersNearWithMessages(event.trap.tx, event.trap.ty, 40, state, publish);
    event.finished = true;
    return event;
}
// Port only: query potential visibility for an explicit game state.
// This duplicates couldsee in vision.ts.
function canAlmostSee(state, x, y) {
    return !!((state.viz_array?.[y]?.[x] ?? 0) & COULD_SEE);
}
// C trap.c:trapeffect_bear_trap(): the monster branch — big enough, solid
// and grounded monsters are caught and take the d(2,4) bite unless they
// wear iron shoes (wearing_iron_shoes()); evaders only reveal a
// forced trap.
export function beginMonsterBearTrap(monster, trap, state = game, { forced = false } = {}) {
    const event = {
        kind: 'bear-trap',
        trap,
        forced,
        caught: false,
        damage: 0,
        killed: false,
        finished: false,
        ...monsterTrapVisibility(monster, state),
    };
    if (!bearTrapCanCatch(monster, state)) {
        event.finished = true;
        return event;
    }
    monster.mtrapped = 1;
    event.caught = true;
    return event;
}
const MZ_SMALL = 1;
const PM_OWLBEAR = MONSTER_NAME.indexOf('owlbear');
const PM_BUGBEAR = MONSTER_NAME.indexOf('bugbear');
// Part of C trap.c:trapeffect_bear_trap(): test monster size, shape and airborne immunity.
function bearTrapCanCatch(monster, state) {
    return ((MONSTER_SIZE[monster?.mnum] ?? 0) > MZ_SMALL &&
        !monsterIsAmorphous(monster) &&
        !monsterIsWhirly(monster) &&
        !monsterIsUnsolid(monster) &&
        !monsterInAir(monster, state));
}
// C trap.c:trapeffect_slp_gas_trap(): the hero branch — resistors stay
// awake inside the cloud, others fall asleep, and the steed's
// steedintrap() sleep follows; the monster branch — susceptible monsters
// fall asleep and are seen to do so.
async function trapeffectSlpGasTrap(mtmp, trap, { state = game, movement, rollOne = rnd, publish = async () => { }, describeMonster, } = {}) {
    if (isHeroDefender(mtmp, state)) {
        const hero = game.u;
        await seeTrap(trap);
        const breathless = !!hero.breathless
            || monsterIsBreathless(heroMonsterForm() ?? -1);
        if (hero.sleepResistance || breathless) {
            await plineWithContinuation('You are enveloped in a cloud of gas!');
            monstersObserveHeroResistance(M_SEEN_SLEEP, game);
        }
        else {
            await plineWithContinuation('A cloud of gas puts you to sleep!');
            await putHeroToSleep(rnd(25), { state: game });
            monstersForgetHeroResistance(M_SEEN_SLEEP, game);
        }
        const steed = hero.usteed;
        if (steed && !monsterResistsSleep(steed)
            && !monsterIsBreathless(steed.mnum) && !monsterIsHelpless(steed)) {
            steed.mx = hero.ux;
            steed.my = hero.uy;
            if (await putMonsterToSleep(steed, rnd(25))) {
                // C trap.c:3137: Monnam(steed); the name is not in-sight gated.
                const name = monsterName(steed, { capitalized: true });
                await plineWithContinuation(`${name} suddenly falls asleep!`);
            }
        }
        return { kind: 'sleep-gas', slept: true, trap, finished: true, inSight: false, seeSquare: false };
    }
    const monster = mtmp;
    const describe = describeMonster
        ?? (target => monsterName(target, { state, capitalized: true }));
    const visibility = monsterTrapVisibility(monster, state);
    const susceptible = !monsterResistsSleep(monster) &&
        !monsterIsBreathless(monster.mnum) &&
        !monsterIsHelpless(monster);
    const slept = susceptible ? await putMonsterToSleep(monster, rollOne(25)) : false;
    const event = {
        kind: 'sleep-gas',
        trap,
        slept,
        finished: !(slept && visibility.inSight),
        ...visibility,
    };
    if (!event.finished) {
        await publish(`${describe(monster)} suddenly falls asleep!`);
        await seeTrap(event.trap, state);
        event.finished = true;
    }
    return event;
}
// C trap.c:trapeffect_rust_trap(): the hero branch — the rust or water jet
// over worn armor, the gremlin split, and the iron-golem hero's rust; the
// monster branch — the same gush over the monster's gear, with the
// iron-golem collapse and the gremlin split.
async function trapeffectRustTrap(mtmp, trap, { state = game, movement, roll = rn2, luckRoll = rnl, publish = plineWithContinuation, } = {}) {
    if (isHeroDefender(mtmp, state)) {
        const hero = game.u;
        await seeTrap(trap);
        const target = rn2(5);
        if (target === 0) {
            await plineWithContinuation(`A gush of water hits you on the ${body_part(HEAD, game)}!`);
            const helmet = heroObject('uarmh');
            await wetHeroObject(helmet, helmet ? armorSimpleName(helmet, game) : 'helmet');
        }
        else if (target === 1) {
            await plineWithContinuation(`A gush of water hits your left ${body_part(ARM, game)}!`);
            const shield = heroObject('uarms');
            const shieldResult = await wetHeroObject(shield, 'shield');
            if (shieldResult === 'nothing') {
                const primary = heroObject('uwep');
                const secondary = heroObject('uswapwep');
                let weapon = null;
                if (hero.twoweap)
                    weapon = secondary;
                else if (isBimanualObject(primary))
                    weapon = primary;
                await wetHeroObject(weapon);
                const gloves = heroObject('uarmg');
                await wetHeroObject(gloves, gloves ? armorSimpleName(gloves, game) : 'gloves');
            }
        }
        else if (target === 2) {
            await plineWithContinuation(`A gush of water hits your right ${body_part(ARM, game)}!`);
            const weapon = heroObject('uwep');
            await wetHeroObject(weapon);
            const gloves = heroObject('uarmg');
            await wetHeroObject(gloves, gloves ? armorSimpleName(gloves, game) : 'gloves');
        }
        else {
            await plineWithContinuation('A gush of water hits you!');
            for (const object of game.inventory || []) {
                if (!object.lamplit || object === heroObject('uwep'))
                    continue;
                if (hero.twoweap && object === heroObject('uswapwep'))
                    continue;
                await splashLitObject(object, plineWithContinuation, game);
            }
            const cloak = heroObject('uarmc');
            const suit = heroObject('uarm');
            const shirt = heroObject('uarmu');
            if (cloak)
                await wetHeroObject(cloak, armorSimpleName(cloak, game));
            else if (suit)
                await wetHeroObject(suit, armorSimpleName(suit, game));
            else
                await wetHeroObject(shirt, 'shirt');
        }
        if (heroIsPolymorphed(game) && hero.umonnum === PM_IRON_GOLEM) {
            await rustIronGolemHero();
        }
        else if (heroIsPolymorphed(game) && hero.umonnum === PM_GREMLIN
            && rn2(3) !== 0) {
            const clone = await splitHeroMonsterForm(game);
            if (clone)
                await plineWithContinuation('You multiply!');
        }
        return null;
    }
    const monster = mtmp;
    const visibility = monsterTrapVisibility(monster, state);
    if (visibility.inSight)
        await seeTrap(trap, state);
    const event = {
        kind: 'rust-trap', trap, ...visibility, finished: false, killed: false,
    };
    const { inSight } = visibility;
    const targetRoll = roll(5);
    if (inSight) {
        const name = monsterName(monster, { state });
        const arm = mbodypart(monster.mnum, ARM);
        const hit = targetRoll === 0
            ? `A gush of water hits ${name} on the ${mbodypart(monster.mnum, HEAD)}!`
            : targetRoll === 1
                ? `A gush of water hits ${name}'s left ${arm}!`
                : targetRoll === 2
                    ? `A gush of water hits ${name}'s right ${arm}!`
                    : `A gush of water hits ${name}!`;
        await publish(hit);
    }
    const wet = (object, description = null) => waterDamageObject(object, [], state, {
        force: true, description, random: roll, luckRoll, publish,
    });
    if (targetRoll === 0) {
        const helmet = wornObject(monster, W_ARMH);
        await wet(helmet, helmet ? armorSimpleName(helmet, state) : 'helmet');
    }
    else if (targetRoll === 1 || targetRoll === 2) {
        const reachesHand = targetRoll === 2
            || await wet(wornObject(monster, W_ARMS), 'shield') === 'nothing';
        if (reachesHand) {
            const weapon = monsterWieldedWeapon(monster);
            if (targetRoll === 2 || isBimanualObject(weapon))
                await wet(weapon ?? null);
            const gloves = wornObject(monster, W_ARMG);
            await wet(gloves, gloves ? armorSimpleName(gloves, state) : 'gloves');
        }
    }
    else {
        for (const object of inventoryOf(monster)) {
            if (object.lamplit && ((object.owornmask ?? 0) & (W_WEP | W_SWAPWEP)) === 0)
                await splashLitObject(object, publish, state);
        }
        const torso = wornObject(monster, W_ARMC)
            || wornObject(monster, W_ARM)
            || wornObject(monster, W_ARMU);
        await wet(torso, torso ? armorSimpleName(torso, state) : 'shirt');
    }
    if (monster.mnum === PM_IRON_GOLEM) {
        if (inSight) {
            const action = wornMonsterLifeSaver(monster) ? 'starts to fall' : 'falls';
            await publish(`${monsterName(monster, { state, capitalized: true })} ${action} to pieces!`);
        }
        monster.mhp = 0;
        const death = await finishMonsterKilled(monster, state, {
            damageType: AD_RUST, cause: null, random: roll, publish,
        });
        event.death = death;
        event.killed = !death.survived;
        event.finished = true;
        return event;
    }
    // C trap.c:trapeffect_rust_trap(): "else if (mptr == &mons[PM_GREMLIN] && rn2(3))"
    // follows all water_damage() calls and their messages.
    if (monster.mnum === PM_GREMLIN && roll(3) !== 0)
        await splitMonster(monster, state, { monsterMoving: true, publish });
    event.finished = true;
    return event;
}
// Port only: test membership in the runtime hero inventory array.
function carriedByHero(object, state) {
    return (state.inventory || []).includes(object);
}
// Port only: resolve a hero equipment slot across runtime aliases.
function heroObject(slot) {
    return game[slot] || game.u?.[slot] || null;
}
// Port only: publish the shared water-damage result for hero equipment.
async function wetHeroObject(object, description = null) {
    const messages = [];
    const result = await waterDamageObject(object, messages, game, {
        force: true,
        description,
    });
    for (const message of messages)
        await plineWithContinuation(message);
    return result;
}
// Part of C trap.c:trapeffect_rust_trap(): damage or destroy the hero's iron-golem form.
async function rustIronGolemHero() {
    const hero = game.u;
    await plineWithContinuation('You are covered with rust!');
    const damage = physicalDamage(hero.mhmax ?? hero.mh ?? 1);
    hero.mh = (hero.mh ?? 1) - damage;
    if (hero.mh > 0)
        return;
    if (!(hero.unchanging || game.unchanging)) {
        await returnHeroToHumanForm(game);
        return;
    }
    await finishHeroDeath({ killer: 'rusting away' });
}
// C trap.c:trapeffect_fire_trap(): the monster branch — the flame under a
// monster, golem immolation, item destruction, and the maximum-HP scorch.
// The hero branch is the fire-trap case of dotrap: it reveals the
// trap and runs dofiretrap() (triggerHeroFireTrap below).
export async function finishMonsterFireTrap(monster, event, state = game, { publish = plineWithContinuation, random = rn2, rollOne = rnd, describeMonster = monster => perceivedMonsterName(monster, { state, capitalized: true }), } = {}) {
    if (event.finished)
        return event;
    const x = event.trap.tx;
    const y = event.trap.ty;
    const surface = surfaceName(x, y, state);
    if (event.inSight) {
        await publish(`A tower of flame erupts from the ${surface} under ${perceivedMonsterName(monster, { state })}!`);
    }
    else if (event.seeSquare) {
        await publish(formatSeenMessage(`a tower of flame erupt from the ${surface}!`, state));
    }
    event.resisted = monsterHasFireResistance(monster);
    if (event.resisted) {
        if (event.inSight) {
            await shieldeff(monster.mx, monster.my, state);
            await publish(`${describeMonster(monster)} is uninjured.`);
        }
    }
    else {
        event.damage = Math.max(event.originalDamage, golemFireDamage(monster.mnum, monster.mhpmax ?? 1));
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - event.damage);
        let dead = false;
        if (monster.mhp <= 0) {
            const death = await finishMonsterTrapDeath(monster, state, {
                publish,
                random,
                damageType: monster.mnum === PM_PAPER_GOLEM ? 'disintegration' : AD_PHYS,
            });
            event.death = death;
            if (death.survived)
                event.lifeSaved = true;
            dead = !death.survived;
            if (death.heroDied)
                return event;
        }
        if (!dead) {
            event.maximumLoss = random(event.damage + 1);
            monster.mhpmax = Math.max(1, (monster.mhpmax ?? monster.mhp) - event.maximumLoss);
            monster.mhp = Math.min(monster.mhp, monster.mhpmax);
        }
    }
    const torsoBurned = await burnArmorByFire(monster, state, publish, [], random, {
        visible: event.inSight,
    });
    event.possessionsBurned = torsoBurned || random(3) !== 0;
    if (event.possessionsBurned) {
        event.itemDamage = await destroyFireMonsterInventory(monster, event.originalDamage, {
            publish,
            random,
            rollOne,
            visible: event.inSight,
        });
        await igniteItems(monster.minvent || monster.inventory, {
            state,
            publish,
            random,
            visible: event.inSight,
        });
        if ((monster.mhp ?? 0) > 0 && event.itemDamage > 0) {
            monster.mhp = Math.max(0, monster.mhp - event.itemDamage);
            if (monster.mhp <= 0) {
                const death = await finishMonsterKilled(monster, state, {
                    publish,
                    random,
                    damageType: AD_FIRE,
                });
                event.death = death;
                if (death.survived)
                    event.lifeSaved = true;
                if (death.heroDied)
                    return event;
            }
        }
    }
    event.floorObjectsBurned = await burnFloorObjectsAt(x, y, {
        state,
        giveFeedback: event.seeSquare,
        publish,
        random,
    });
    const heroX = state.u?.ux ?? x;
    const heroY = state.u?.uy ?? y;
    if (event.floorObjectsBurned && !event.seeSquare && dist2(x, y, heroX, heroY) <= 9) {
        await publish('You smell smoke.');
    }
    if (isIceAt(x, y, state))
        await meltIce(x, y);
    if (event.seeSquare && state.level?.traps?.includes(event.trap))
        await seeTrap(event.trap, state);
    event.killed = !!monster.dead || (monster.mhp ?? 0) <= 0;
    event.finished = true;
    return event;
}
// Part of C trap.c:trapeffect_fire_trap(): choose material-specific golem fire damage.
function golemFireDamage(form, maximumHitPoints) {
    if (form === PM_PAPER_GOLEM)
        return maximumHitPoints;
    if (form === PM_STRAW_GOLEM)
        return Math.trunc(maximumHitPoints / 2);
    if (form === PM_WOOD_GOLEM)
        return Math.trunc(maximumHitPoints / 4);
    if (form === PM_LEATHER_GOLEM)
        return Math.trunc(maximumHitPoints / 8);
    return 0;
}
// C trap.c:trapeffect_pit(): the hero branch — refusal while flying or
// clinging, the fall and spike messages with iron-shoe protection,
// set_utrap, and the ridden steed's hit; the monster branch — grounded,
// size, and worm checks decide whether the monster falls, the fall
// message, the hit, and the pit's trap result.
async function trapeffectPit(mtmp, trap, { state = game, movement, publish = plineWithContinuation, random, rollOne = rnd, describeMonster, forced = false, viaSitting = false, tookPlunge = false, recursiveTrap = false, } = {}) {
    if (!trap)
        return null;
    if (isHeroDefender(mtmp, state)) {
        requirePlayingGame(game);
        const hero = game.u;
        const clingy = monsterIsClinger(heroMonsterForm() ?? -1);
        const sokoban = !!game.level.flags?.sokoban_rules;
        const previousPit = trapAt(game, hero.ux0, hero.uy0);
        const fromPit = !!hero.utrap && hero.utraptype === TT_PIT
            && previousPit && is_pit(previousPit.ttyp);
        const conjoined = fromPit && pitsAreConjoined(previousPit, trap);
        const adjacent = adjNonconjoinedPit(trap);
        const alreadyKnown = !!trap.tseen;
        const flying = hero.flying || game.flying;
        // C trap.c:1836: plunged is TOOKPLUNGE only.  FAILEDUNTRAP never
        // reaches a pit: untrap() refuses pit targets before try_disarm().
        const plunged = tookPlunge;
        if (!sokoban && (hero.levitating || game.levitating
            || (flying && !plunged && !viaSitting)))
            return null;
        await feelTrap(trap);
        if (!sokoban && clingy && !plunged) {
            if (alreadyKnown) {
                await plineWithContinuation(formatSeenMessage(`${trap.madeby_u ? 'your' : 'a'} ${trap.ttyp === SPIKED_PIT ? 'spiked ' : ''}pit below you.`));
            }
            else {
                await plineWithContinuation(`${trap.madeby_u ? 'Your' : 'A'} pit ${trap.ttyp === SPIKED_PIT ? 'full of spikes ' : ''}opens up under you!`);
                await plineWithContinuation("You don't fall in!");
            }
            return null;
        }
        const steed = hero.usteed;
        // C trap.c:1842-1847: suppress the article in steed messages when using
        // its name (never chosen while hallucinating), and pass the "poor"
        // adjective plus SUPPRESS_SADDLE through x_monnam().  Each branch names
        // the steed only when it prints, so a hallucinating rider draws one
        // random identity per message.
        const steedArticle = MGIVENNAME(steed) && !heroIsHallucinating(game) ? 'none' : 'the';
        // C trap.c:1877: the careful descent is chosen by iflags.menu_requested
        // (the 'm' prefix), not context.nopick: travel sets nopick without it.
        const deliberate = !sokoban && !steed && !!game.iflags.menu_requested && alreadyKnown;
        if (!sokoban) {
            if (steed) {
                await plineWithContinuation(recursiveTrap
                    ? `You and ${monsterName(steed, {
                        state: game, article: steedArticle, suppressSaddle: true,
                    })} fall into ${trap.madeby_u ? 'your' : 'a'} pit!`
                    : `You lead ${monsterName(steed, {
                        state: game, article: steedArticle, adjective: 'poor',
                        suppressSaddle: true,
                    })} into ${trap.madeby_u ? 'your' : 'a'} pit!`);
            }
            else if (deliberate) {
                await plineWithContinuation(`You carefully ${heroLocomotion('lower yourself')} into the pit.`);
            }
            else if (conjoined) {
                await plineWithContinuation('You move into an adjacent pit.');
            }
            else if (adjacent) {
                await plineWithContinuation(`You stumble over debris${rn2(5) === 0 ? ' between the pits' : ''}.`);
            }
            else {
                await plineWithContinuation(`You ${plunged ? (flying ? 'dive' : 'plunge') : 'fall'} into ${trap.madeby_u ? 'your' : 'a'} pit!`);
            }
        }
        const role = String(game.urole?.key || game.urole?.name || '').toLowerCase();
        if (role === 'ranger' && !trap.madeby_u && !trap.once && In_quest(hero.uz)
            && specialPrototypeAt(hero.uz.dnum, hero.uz.dlevel)?.endsWith('-loca')) {
            await plineWithContinuation('Fortunately it has a bottom after all...');
            trap.once = 1;
        }
        else if (heroMonsterForm() === 218 || heroMonsterForm() === PM_PIT_FIEND) {
            await plineWithContinuation("How pitiful.  Isn't that the pits?");
        }
        let spiked = trap.ttyp === SPIKED_PIT;
        const ironShoes = heroIronShoes();
        if (spiked && ironShoes) {
            // C trap.c:1902: Yname2(uarmf) names the worn footgear ("iron
            // shoes", "kicking boots"); the verb stays singular.
            await plineWithContinuation(`${ownedObjectName(ironShoes, game)} protects you from the sharp iron spikes.`);
            spiked = false;
        }
        else if (spiked) {
            await plineWithContinuation(steed
                ? `${monsterName(steed, {
                    state: game, article: steedArticle, adjective: 'poor',
                    suppressSaddle: true, capitalized: true,
                })} ${conjoined ? 'steps' : 'lands'} on a set of sharp iron spikes!`
                : `You ${conjoined ? 'step' : 'land'} on a set of sharp iron spikes!`);
        }
        setHeroTrap(rn2(6) + 2, TT_PIT);
        game.context.botl = true;
        if (steed) {
            // C steedintrap(): a ridden steed takes the pit's hit instead of the hero.
            steed.mx = hero.ux;
            steed.my = hero.uy;
            if (steed.mhp > 0)
                steed.mhp -= rnd(trap.ttyp === PIT ? 6 : 10);
            if (steed.mhp <= 0) {
                // m_detach() dismounts; steedintrap()'s dismount_steed() then
                // finds no steed.
                await finishMonsterTrapDeath(steed, game, { damageType: AD_PHYS });
            }
            return null;
        }
        const mortality = hero.umortality || 0;
        if (spiked) {
            const damage = physicalDamage(rnd(conjoined ? 4 : adjacent ? 6 : 10));
            const killer = plunged ? 'deliberately plunged into a pit of iron spikes'
                : conjoined || deliberate ? 'stepped into a pit of iron spikes'
                    : adjacent ? 'stumbled into a pit of iron spikes'
                        : 'fell into a pit of iron spikes';
            if (await loseHeroHp(damage, killer, { deathCause: killer }))
                return null;
            if (rn2(6) === 0) {
                const poison = await poisonHero({
                    reason: 'spikes',
                    killer: conjoined || adjacent || deliberate
                        ? 'stepping on poison spikes' : 'fall onto poison spikes',
                    attribute: A_STR,
                    fatal: (hero.umortality || 0) > mortality ? 0 : 8,
                });
                if (poison.died)
                    return null;
            }
        }
        else if (!conjoined && !deliberate && !(plunged && (flying || clingy))) {
            const killer = plunged ? 'deliberately plunged into a pit' : 'fell into a pit';
            if (await loseHeroHp(physicalDamage(rnd(adjacent ? 3 : 6)), killer, { deathCause: killer }))
                return null;
        }
        const ball = game.uball || hero.uball;
        if (heroIsPunished(game) && ball && !game.inventory.includes(ball)) {
            await unplaceBallAndChain(game);
            if (await fallWithIronBall(game))
                return null;
            await placeBallAndChain(game);
        }
        if (!conjoined)
            await selfTouchPetrifyingWeapons({ messageStart: 'Falling, you' });
        game.vision_full_recalc = 1;
        await exerciseAttribute(A_STR, false);
        await exerciseAttribute(A_DEX, false);
        return null;
    }
    const monster = mtmp;
    const describe = describeMonster
        ?? (target => canonicalMonsterName(target, { state, capitalized: true }));
    const ungrounded = monsterIsUngrounded(monster, state);
    const sokoban = !!state.level?.flags.sokoban_rules;
    const falls = !(ungrounded && forced && !sokoban);
    const inescapable = forced || sokoban && !trap.madeby_u;
    if (ungrounded && falls && !inescapable)
        return null;
    const visibility = monsterTrapVisibility(monster, state);
    const spiked = trap.ttyp === SPIKED_PIT;
    const relevantSpikes = spiked && !monsterWearsIronShoes(monster);
    if (falls && !monsterPassesWalls(monster.mnum))
        monster.mtrapped = 1;
    const event = {
        kind: 'pit-trap',
        trap,
        spiked,
        relevantSpikes,
        damageSides: relevantSpikes ? 10 : 6,
        killed: false,
        finished: false,
        ...visibility,
        falls,
        dragged: ungrounded && falls,
    };
    if (!event.falls) {
        if (event.inSight) {
            await seeTrap(event.trap, state);
            await publish(`${canonicalMonsterName(monster, { capitalized: true, state })} doesn't fall into the pit.`);
        }
        event.finished = true;
        return event;
    }
    if (event.inSight) {
        const owner = event.trap.madeby_u ? 'your' : 'a';
        await publish(`${describe(monster)} ${event.dragged ? 'is dragged' : 'falls'} into ${owner} pit!`);
        if (monster.mnum === PM_PIT_VIPER || monster.mnum === PM_PIT_FIEND)
            await publish("How pitiful.  Isn't that the pits?");
        await seeTrap(event.trap, state);
    }
    const selfTouch = await monsterSelfTouch(monster, {
        prefix: 'Falling, ',
        finishDeath: (victim, options) => finishEnvironmentalMonsterDeath(victim, state, {
            ...options, publish,
            ...(random === undefined ? {} : { random }),
        }),
        publish,
        state,
    });
    if (!selfTouch.survived) {
        event.killed = true;
        event.finished = true;
        return event;
    }
    const damage = rollOne(event.damageSides);
    monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
    if (monster.mhp <= 0) {
        const death = await finishMonsterTrapDeath(monster, state, {
            damageType: AD_PHYS,
            ...(random === undefined ? {} : { random }),
            publish,
        });
        event.death = death;
        event.killed = !death.survived;
        if (death.survived)
            monster.dead = false;
    }
    event.finished = true;
    return event;
}
const PM_PIT_FIEND = 300;
const PM_PIT_VIPER = 218;
// Part of C trap.c:trapeffect_pit(): exclude airborne and sufficiently long worm bodies from falling.
function monsterIsUngrounded(monster, state) {
    return !grounded(monster.mnum, state)
        || !!monster.wormno && (monster.wormSegments?.length ?? 0) > 5;
}
// Part of C trap.c:wearing_iron_shoes(): inspect the hero's boots.
function heroIronShoes() {
    const boots = heroObject('uarmf');
    return boots && objectMaterial(boots.otyp) === IRON ? boots : null;
}
// C trap.c:trapeffect_telep_trap(): the hero branch — reveal the trap and
// jump; the monster branch is the TELEP_TRAP case of triggerMonsterTrap.
// Also C teleport.c:vault_tele(): inlined here for one-use teleport traps.
// Also C teleport.c:tele_trap(): the whole body after seeTrap() — the
// in_tele_trap guard, the endgame/antimagic/noteleport refusals,
// next_to_u(), the once/fixed-destination/random dispatch and teleds().
async function triggerTeleportTrap(trap, finishTeleport) {
    await seeTrap(trap);
    if (game._inTeleportTrap)
        return false;
    if (typeof finishTeleport !== 'function')
        throw new TypeError('teleport trap needs an arrival handler');
    game._inTeleportTrap = true;
    try {
        const blocked = heroTeleportTrapBlock();
        if (blocked) {
            if (blocked === 'antimagic')
                await shieldeff(game.u.ux, game.u.uy);
            await plineWithContinuation(formatFeltMessage('a wrenching sensation.'));
            return true;
        }
        if (!await bringLeashedFollowers()) {
            await plineWithContinuation('You shudder for a moment.');
            return true;
        }
        let destination = null;
        if (trap.once) {
            deleteTrap(trap);
            await newsym(game.u.ux, game.u.uy);
            const vault = searchSpecial(VAULT);
            if (vault) {
                const vaultSquare = { x: 0, y: 0 };
                if (somexyspace(vault, vaultSquare)
                    && heroTeleportDestinationOk(vaultSquare.x, vaultSquare.y))
                    destination = vaultSquare;
            }
        }
        else if (trap.teledest
            && isok(trap.teledest.x, trap.teledest.y)) {
            setTrack(game);
            const cleared = await clearFixedTeleportDestination(trap.teledest.x, trap.teledest.y);
            if (!cleared.cleared) {
                await plineWithContinuation('You shudder for a moment.');
                return true;
            }
            if (cleared.relocation) {
                await newsym(cleared.relocation.oldx, cleared.relocation.oldy);
                await newsym(cleared.relocation.x, cleared.relocation.y);
            }
            destination = trap.teledest;
        }
        else {
            await teleportHero({ chooseDestination: askTeleportDestination });
            return true;
        }
        if (!destination) {
            // vault_tele() falls back to tele(), including teleport control.
            await teleportHero({ chooseDestination: askTeleportDestination });
            return true;
        }
        await teleds(destination.x, destination.y, game, { finishArrival: finishTeleport });
        return true;
    }
    finally {
        game._inTeleportTrap = false;
    }
}
// C trap.c:trapeffect_web(): the hero branch — webmakers pass through, the
// destroyers tear it, and everyone else is caught with the struggle.
async function triggerWeb(trap, { viaSitting = false, failedUntrap = false, forceTrap = false, noWebMessage = false } = {}) {
    requirePlayingGame(game);
    const hero = game.u;
    await feelTrap(trap);
    const form = heroMonsterForm();
    if (await maybeDestroyWeb(hero, trap, { message: !noWebMessage }))
        return;
    if (form === PM_CAVE_SPIDER || form === PM_GIANT_SPIDER) {
        if (!noWebMessage)
            await plineWithContinuation(trap.madeby_u
                ? 'You take a walk on your web.'
                : 'There is a spider web here.');
        return;
    }
    const steed = hero.usteed;
    if (!noWebMessage) {
        const verb = viaSitting || failedUntrap || forceTrap ? 'are caught by'
            : steed ? `lead ${monsterName(steed, {
                article: steed.name && !heroIsHallucinating(game) ? 'none' : 'the',
                adjective: 'poor', suppressSaddle: true,
            })} into` : `${heroLocomotion('stumble')} into`;
        await plineWithContinuation(`You ${verb} ${trap.madeby_u ? 'your' : 'a'} spider web!`);
    }
    setHeroTrap(1, TT_WEB);
    game.context.botl = true;
    let strength = currentAttribute(A_STR, game);
    if (steed && !noWebMessage) {
        steed.mx = hero.ux;
        steed.my = hero.uy;
        await mintrap(steed, game, { forcetrap: forceTrap });
        if (!steed.mtrapped) {
            await resetUtrap(false);
            return;
        }
        steed.mtrapped = 0;
        if (strongmonst(steed.mnum))
            strength = 17;
        noWebMessage = true;
    }
    const turns = webTrapDuration(strength);
    if (!turns) {
        if (!noWebMessage)
            await plineWithContinuation(`You tear through ${trap.madeby_u ? 'your' : 'a'} web!`);
        deleteTrap(trap);
        await newsym(hero.ux, hero.uy);
    }
    setHeroTrap(turns, TT_WEB);
}
// Part of C trap.c:trapeffect_web(): choose the hero's web duration by strength.
function webTrapDuration(strength) {
    if (strength <= 3)
        return rn2(6) + 6;
    if (strength < 6)
        return rn2(6) + 4;
    if (strength < 9)
        return rn2(4) + 4;
    if (strength < 12)
        return rn2(4) + 2;
    if (strength < 15)
        return rn2(2) + 2;
    if (strength < 18)
        return rnd(2);
    if (strength < 69)
        return 1;
    return 0;
}
// C trap.c:trapeffect_magic_trap(): the hero branch — a 1-in-30 magical
// explosion consumes the trap, otherwise domagictrap() runs and the steed
// takes its own hit; the steed's steedintrap() call is a no-op (its switch
// has no MAGIC_TRAP case). The monster branch is inline in
// triggerMonsterTrap.
async function triggerMagicTrap(trap) {
    await seeTrap(trap);
    if (rn2(30) === 0) {
        deleteTrap(trap);
        await newsym(trap.tx, trap.ty);
        await plineWithContinuation('You are caught in a magical explosion!');
        if (await loseHeroHp(rnd(10), 'magical explosion'))
            return;
        await plineWithContinuation('Your body absorbs some of the magical energy!');
        game.u.uenmax = (game.u.uenmax ?? 0) + 2;
        game.u.uen = game.u.uenmax;
        game.u.uenpeak = Math.max(game.u.uenpeak ?? 0, game.u.uenmax);
        return;
    }
    await triggerHeroMagicTrapEffect();
}
// C trap.c:trapeffect_anti_magic(): the monster branch — iron shoes shed
// the drain silently (wearing_iron_shoes() is
// monsterWornIronShoes), magic resistance shields, and the drained monster
// loses power and maximum hit points.
export async function applyMonsterAntiMagicTrap(monster, { rollDice = d, rollOne = rnd, trap, state = game } = {}) {
    const shoes = monsterWornIronShoes(monster);
    if (shoes && (shoes.spe ?? 0) > 0) {
        shoes.spe--;
        if (Number.isInteger(shoes.enchantment))
            shoes.enchantment = shoes.spe;
        return {
            kind: 'anti-magic-shoes',
            resisted: false,
            absorbedByShoes: true,
            energyDrain: 0,
            damage: 0,
            killed: false,
        };
    }
    if (!monsterHasMagicResistance(monster)) {
        const canUseMagic = !monster.mcan &&
            (MONSTER_ATTACKS[monster.mnum] || []).some(([attackType]) => attackType === AT_MAGC || attackType === AT_BREA);
        const energyDrain = canUseMagic ? rollDice(2, 6) : 0;
        if (energyDrain) {
            monster.mspec_used = (monster.mspec_used ?? 0) + energyDrain;
            if (trap && monsterTrapVisibility(monster, state).inSight)
                await seeTrap(trap, state);
        }
        return {
            kind: energyDrain ? 'anti-magic-drain' : 'anti-magic',
            resisted: false,
            energyDrain,
            damage: 0,
            killed: false,
        };
    }
    let damage = rollOne(4);
    const weapon = monsterWeapon(monster);
    if (artifactById(weapon?.oartifact)?.name === 'Magicbane')
        damage += rollOne(4);
    if (monsterInventory(monster).some((object) => artifactById(object?.oartifact)?.carriedDefense === 'magic')) {
        damage += rollOne(4);
    }
    if (monsterPassesWalls(monster.mnum))
        damage = Math.trunc((damage + 3) / 4);
    if (trap && monsterTrapVisibility(monster, state).inSight)
        await seeTrap(trap, state);
    monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
    return {
        kind: 'anti-magic-damage',
        resisted: true,
        energyDrain: 0,
        damage,
        killed: monster.mhp <= 0,
    };
}
// Part of C trap.c:trapeffect_poly_trap(): find the monster's worn iron boots.
export function monsterWornIronShoes(monster) {
    return monsterInventory(monster).find((object) => objectMaterial(object?.otyp) === IRON && !!((object?.owornmask ?? 0) & W_ARMF));
}
// C trap.c:trapeffect_poly_trap(): the monster branch — worn iron shoes
// are transformed first (wearing_iron_shoes() is
// monsterWornIronShoes), magic resistance shields, and the form change is
// staged with its possessive message.
export async function applyMonsterPolymorphTrap(monster, trap, state = game, { random = rn2 } = {}) {
    const shoes = monsterWornIronShoes(monster);
    if (shoes) {
        return {
            kind: 'polymorph-trap',
            trap,
            changed: false,
            replacementShoes: await transformWornIronShoes(monster, shoes, state),
            finished: true,
        };
    }
    const visibility = monsterTrapVisibility(monster, state);
    if (monsterHasMagicResistance(monster)) {
        return {
            kind: 'polymorph-trap',
            monster,
            trap,
            changed: false,
            shielded: true,
            finished: false,
            ...visibility,
        };
    }
    if (monsterResistsEffect(monster, 12, random)) {
        return {
            kind: 'polymorph-trap',
            trap,
            changed: false,
            resisted: true,
            finished: true,
            ...visibility,
        };
    }
    return {
        kind: 'polymorph-trap',
        monster,
        trap,
        changed: false,
        finished: false,
        ...visibility,
    };
}
// Part of C trap.c:trapeffect_poly_trap(): transform and re-equip a monster's iron boots.
async function transformWornIronShoes(monster, shoes, state) {
    await removeObjectFromMonsterInventory(monster, shoes, state, { silently: true });
    const linked = await addObjectToMonsterInventory(monster, shoes, state);
    if (!linked)
        throw new Error('Worn shoes were not linked into the monster inventory.');
    const replacement = await poly_obj(linked, shoes.otyp === IRON_SHOES ? KICKING_BOOTS : IRON_SHOES, { state });
    if (!replacement)
        throw new Error('Polymorphing monster shoes must leave a replacement.');
    replacement.owornmask = W_ARMF;
    replacement.worn = true;
    monster.misc_worn_check = (monster.misc_worn_check ?? 0) | W_ARMF;
    applyMonsterEquipmentProperties(monster, replacement, true);
    return replacement;
}
// C trap.c:trapeffect_landmine(): the hero branch — the blast, blown-off
// footwear, the pit left behind, and the sobj_at() saddle check
// that keeps the saddle with a dying steed.
async function triggerLandmine(trap, { failedUntrap = false, forceTrap = false, forceBungle = false, } = {}) {
    const hero = game.u;
    let damage = rnd(16);
    if (heroWearsIronShoes())
        damage = Math.trunc((damage + 3) / 4);
    const forcetrap = forceTrap || failedUntrap;
    const airborne = !forcetrap && (hero.levitating || game.levitating
        || hero.flying || game.flying);
    let steedMid = 0;
    let saddle = null;
    if (airborne) {
        const alreadySeen = !!trap.tseen;
        if (!alreadySeen && rn2(3) !== 0)
            return;
        await feelTrap(trap);
        await plineWithContinuation(`${alreadySeen ? 'There is' : 'You discover'} ${trap.madeby_u ? 'the trigger of your mine' : 'a trigger'} in a pile of soil below you.`);
        if (alreadySeen && rn2(3) !== 0)
            return;
        await plineWithContinuation(`KAABLAMM!!!  ${forceBungle ? 'Your inept attempt sets' : 'The air currents set'} ${alreadySeen ? `${trap.madeby_u ? 'your' : 'a'} land mine` : 'it'} off!`);
    }
    else {
        if (landmineSteedHitInProgress)
            return;
        await feelTrap(trap);
        await plineWithContinuation(`KAABLAMM!!!  You triggered ${trap.madeby_u ? 'your' : 'a'} land mine!`);
        const steed = hero.usteed;
        if (steed)
            steedMid = steed.m_id;
        landmineSteedHitInProgress = true;
        try {
            if (steed) {
                // C steedintrap() LANDMINE: thitm(0, steed, NULL, rnd(16), FALSE).
                // m_detach() dismounts a dying steed; steedintrap()'s own
                // dismount_steed() then finds no steed.
                steed.mx = hero.ux;
                steed.my = hero.uy;
                if (steed.mhp > 0)
                    steed.mhp -= rnd(16);
                if (steed.mhp <= 0) {
                    await finishMonsterTrapDeath(steed, game, { damageType: AD_PHYS });
                }
            }
        }
        finally {
            landmineSteedHitInProgress = false;
        }
        if (game.program_state.gameover)
            return;
        saddle = objectAtHero(SADDLE);
        await woundHeroLegs('left', rn2(35) + 41);
        await woundHeroLegs('right', rn2(35) + 41);
        await exerciseAttribute(A_DEX, false);
    }
    trap.ttyp = PIT;
    trap.madeby_u = false;
    if (await loseHeroHp(physicalDamage(damage), 'land mine'))
        return;
    const finishMonsterDeath = async (monster, death = {}) => {
        const killed = await finishHeroMonsterKill(monster, monster.mx, monster.my, {
            showKillMessage: false,
            noCorpse: death.noCorpse ?? false,
        });
        return { monster, survived: !killed };
    };
    await explodeLandMine(trap, game, {
        publish: plineWithContinuation,
        random: rn2,
        rollOne: rnd,
        seeSquare: cansee(hero.ux, hero.uy),
        heroCaused: true,
        finishMonsterDeath,
        finishMonsterKill: finishHeroMonsterKill,
        // C trap.c:2590 blow_up_landmine() -> dig.c:838 liquid_flow() ->
        // dig.c:875 pooleffects(FALSE): a crawl-out of the flooded hole
        // lands through teleds()' spoteffects(TRUE) (teleport.c:568), the
        // shared landing-effect entry applyHeroLiquidEffects() supplies.
        resolveLiquid: () => applyHeroLiquidEffects(plineWithContinuation),
    });
    if (game.program_state.gameover)
        return;
    if (steedMid && saddle && !hero.usteed)
        await keepSaddleWithSteedcorpse(steedMid, saddle);
    await newsym(hero.ux, hero.uy);
    const landing = await dotrapAt(hero.ux, hero.uy, { recursiveTrap: true });
    if (landing.died)
        return;
    await fillPitWithBoulderAt(hero.ux, hero.uy, game);
}
// Part of C trap.c:wearing_iron_shoes(): test the hero's iron boots.
function heroWearsIronShoes() {
    return !!heroIronShoes();
}
// Port only: find a floor object type at the hero's square.
function objectAtHero(type) {
    const hero = game.u;
    return (game.level?.objects?.[hero.ux]?.[hero.uy] || [])
        .find(object => object.otyp === type) || null;
}
// Port only: find a trap by coordinates before invoking its shared effect.
export async function dotrapAt(x, y, options = {}) {
    const trap = game.level?.traps?.find(candidate => candidate.tx === x && candidate.ty === y);
    return dotrap(trap, options);
}
// C trap.c:trapeffect_rolling_boulder_trap(): the hero branch — the click
// and the boulder released from the launch square; the monster branch is
// the ROLLING_BOULDER_TRAP case of triggerMonsterTrap.
async function triggerRollingBoulderTrap(trap) {
    const wasKnown = !!trap.tseen;
    await feelTrap(trap);
    const click = heroIsDeaf(game) ? '' : 'Click!  ';
    await plineWithContinuation(`${click}You trigger a rolling boulder trap!`);
    requirePlayingGame(game);
    const released = await launchRollingBoulder(trap.launch, trap.launch2 ?? trap.launch, {
        state: game, known: wasKnown,
    });
    if (!released)
        await plineWithContinuation(wasKnown
            ? 'No boulder was released.' : 'Fortunately for you, no boulder was released.');
}
// C trap.c:trapeffect_vibrating_square(): the monster branch — the hero
// sees or hears the ground vibrate under the monster, near or far.
export function beginMonsterVibratingSquare(monster, trap, state = game) {
    const visibility = monsterTrapVisibility(monster, state);
    return {
        kind: 'vibrating-square',
        trap,
        wholeBody: monsterHasNoLimbs(monster.mnum) || monsterInAir(monster, state),
        nearby: dist2(monster.mx, monster.my, state.u?.ux ?? monster.mx, state.u?.uy ?? monster.my) <=
            4,
        finished: !visibility.seeSquare,
        ...visibility,
    };
}
// C trap.c:immune_to_trap(). Hero branch: report only clearly visible immunity.
export function immune_to_trap(type, state) {
    const species = heroSpecies(state);
    const body = { mnum: species };
    switch (type) {
        case BEAR_TRAP:
        case SQKY_BOARD:
        case LANDMINE:
        case ROLLING_BOULDER_TRAP:
        case HOLE:
        case TRAPDOOR:
        case PIT:
        case SPIKED_PIT:
            {
                if (type === BEAR_TRAP && ((MONSTER_SIZE[species] ?? 2) <= 1 || monsterIsAmorphous(body)
                    || monsterIsWhirly(body) || monsterIsUnsolid(body)))
                    return true;
                if (state.level?.flags.sokoban_rules && (is_pit(type) || is_hole(type)))
                    return false;
                if (In_sokoban(state.u.uz) && type === ROLLING_BOULDER_TRAP)
                    return true;
                const groundSpecies = heroSpecies(state);
                const symbol = MONSTER_SYMBOL[groundSpecies];
                const ceiling = !In_endgame(state.u.uz) || Is_earthlevel(state.u.uz);
                return !!(state.u.levitating || state.u.flying || monsterIsFlyer(groundSpecies)
                    || symbol === 5 || symbol === 25 || (monsterIsClinger(groundSpecies) && ceiling));
            }
        case SLP_GAS_TRAP:
            return monsterIsBreathless(species); // breathless body
        case LEVEL_TELEP:
        case TELEP_TRAP:
            // Native mon_has_amulet(&youmonst) checks its empty monster
            // inventory, not the hero's carried Amulet.
            return In_endgame(state.u.uz);
        case WEB:
            return monsterIsAmorphous(body) || monsterIsWhirly(body) || monsterIsUnsolid(body)
                || ['cave spider', 'giant spider', 'gelatinous cube', 'fire vortex',
                    'flaming sphere', 'fire elemental', 'salamander'].includes(MONSTER_NAME[species] ?? '');
        case RUST_TRAP:
            if (MONSTER_NAME[species] === 'iron golem')
                return false;
            return !state.inventory.some(object => objectIsRustprone(object)
                && !!object.owornmask && !(object.owornmask & W_QUIVER)
                && (!(object.owornmask & W_SWAPWEP) || state.u.twoweap));
        case VIBRATING_SQUARE:
            return true;
        default:
            return false;
    }
}
// C trap.c:trapeffect_selector(): dispatch the trap effect for the actor
// over the trap type; each case runs the matching trapeffect_ branch.
// C trap.c:trapeffect_statue_trap(): the hero case animates the statue;
// monsters never trigger one.
// C trap.c:trapeffect_magic_portal(): feelTrap plus the buried-ball
// reattachment before the portal owner runs; monsters fall through to
// trapeffect_level_telep()'s monster move.
// trap.c trapeffect_vibrating_square(): the hero branch only feels the
// trap; its symbol just marks the square.
// trap.c trapeffect_fire_trap(): the FIRE_TRAP case reveals the trap and
// runs dofiretrap() through triggerHeroFireTrap.
async function trapeffectSelector(hero, trap, { finishTeleport = null, gotoLevel = null, viaSitting = false, failedUntrap = false, forceTrap = false, forceBungle = false, noWebMessage = false, tookPlunge = false, recursiveTrap = false, } = {}) {
    let died = false;
    let shortCircuited = false;
    switch (trap.ttyp) {
        case HOLE:
        case TRAPDOOR: {
            const fall = await fall_through(true, trap, { tookPlunge });
            if (!fall || !gotoLevel)
                break;
            // C fall_through() leaves domove() on this level until deferred_goto().
            scheduleLevelChange([fall.destination, { arrival: fall.arrival }], gotoLevel);
            break;
        }
        case TELEP_TRAP:
            shortCircuited = await triggerTeleportTrap(trap, finishTeleport);
            break;
        case LEVEL_TELEP:
            await triggerLevelTeleportTrap(trap, gotoLevel, viaSitting || forceTrap);
            break;
        case ARROW_TRAP:
        case DART_TRAP:
            await triggerProjectileTrap(trap);
            break;
        case SQKY_BOARD:
            await trapeffectSqkyBoard(game.u, trap, {
                viaSitting, failedUntrap, forceTrap, publish: plineWithContinuation,
            });
            break;
        case ROCKTRAP:
            await trapeffectRocktrap(game.u, trap, { publish: plineWithContinuation });
            break;
        case ROLLING_BOULDER_TRAP:
            await triggerRollingBoulderTrap(trap);
            break;
        case SLP_GAS_TRAP:
            await trapeffectSlpGasTrap(game.u, trap, { publish: plineWithContinuation });
            break;
        case RUST_TRAP:
            await trapeffectRustTrap(game.u, trap, { publish: plineWithContinuation });
            break;
        case ANTI_MAGIC:
            await triggerHeroAntiMagicTrap(trap);
            break;
        case BEAR_TRAP:
            died = await triggerBearTrap(trap, {
                failedUntrap, forceTrap, viaSitting,
            });
            break;
        case FIRE_TRAP:
            await seeTrap(trap);
            died = (await triggerHeroFireTrap()).died;
            break;
        case MAGIC_PORTAL:
            await feelTrap(trap);
            if (game.u.utraptype === TT_BURIEDBALL)
                await buriedBallToPunishment();
            await activateMagicPortal(trap, gotoLevel);
            break;
        case MAGIC_TRAP:
            await triggerMagicTrap(trap);
            break;
        case POLY_TRAP:
            await triggerHeroPolymorphTrap(trap, viaSitting);
            break;
        case PIT:
        case SPIKED_PIT:
            await trapeffectPit(game.u, trap, { viaSitting, tookPlunge, recursiveTrap });
            break;
        case WEB:
            await triggerWeb(trap, { viaSitting, failedUntrap, forceTrap, noWebMessage });
            break;
        case STATUE_TRAP:
            await activateStatueTrapAt(trap.tx, trap.ty);
            break;
        case LANDMINE:
            await triggerLandmine(trap, { failedUntrap, forceTrap, forceBungle });
            break;
        case VIBRATING_SQUARE:
            await feelTrap(trap);
            break;
    }
    return {
        died: died || !!game.program_state.gameover,
        shortCircuited: !!shortCircuited,
    };
}
// C trap.c:drain_en()
// Hero energy loss.
export function drainHeroEnergy(state, amount, { maximumAlreadyDrained = false, rollOne = rnd } = {}) {
    const hero = state.u;
    let punctuation = maximumAlreadyDrained ? '!' : '.';
    const maximum = hero.uenmax ?? 0;
    if (maximum < 1) {
        if (hero.uen || maximum) {
            hero.uen = 0;
            hero.uenmax = 0;
            state.context.botl = true;
        }
        return formatFeltMessage(`momentarily lethargic${punctuation}`, state);
    }
    if (amount > ((hero.uen ?? 0) + maximum) / 3)
        amount = rollOne(amount);
    if (amount > (hero.uen ?? 0))
        punctuation = '!';
    hero.uen = (hero.uen ?? 0) - amount;
    if (hero.uen < 0) {
        hero.uenmax = Math.max(0, maximum - rollOne(-hero.uen));
        hero.uen = 0;
    }
    else if (hero.uen > maximum) {
        hero.uen = maximum;
    }
    state.context.botl = true;
    return formatFeltMessage(`your magical energy drain away${punctuation}`, state);
}
// Part of C trap.c:trapeffect_anti_magic(): the hero branch (the monster
// branch applyMonsterAntiMagicTrap() holds the citation) —
// positively-enchanted iron shoes shed the drain onto their enchantment;
// otherwise the anti-magic field hits the protected hero (a carried
// artifact's C zap.c:defends_when_carried() bonus included) and drains
// power; the wearing_iron_shoes() test is heroIronShoes().
export async function triggerHeroAntiMagicTrap(trap) {
    const hero = game.u;
    const shoes = heroIronShoes();
    if (shoes && (shoes.spe ?? 0) > 0) {
        await seeTrap(trap);
        await plineWithContinuation(`A lethargic aura surrounds ${ownedObjectName(shoes, game, { capitalized: false })}.`);
        await chargeAlteredUnpaidObject(shoes, 'disenchant', game);
        shoes.spe--;
        if (Number.isInteger(shoes.enchantment))
            shoes.enchantment = shoes.spe;
        return;
    }
    await seeTrap(trap);
    if (hero.antimagic ||
        propertyIsActive('antimagic', game) ||
        heroHasArtifactDefense('magic', game)) {
        const damage = implosionDamage();
        const hitPoints = heroIsPolymorphed(game) ? (hero.mh ?? 1) : (hero.uhp ?? 1);
        const feeling = damage >= hitPoints
            ? 'unbearably torpid!'
            : damage >= Math.trunc(hitPoints / 4)
                ? 'very lethargic.'
                : 'sluggish.';
        await plineWithContinuation(formatFeltMessage(feeling));
        if (await loseHeroHp(damage, 'anti-magic implosion'))
            return;
    }
    let drain = d(2, 6);
    const halfDrain = rnd(Math.trunc(drain / 2));
    let maximumAlreadyDrained = false;
    if ((hero.uenmax ?? 0) > drain) {
        hero.uenmax = (hero.uenmax ?? 0) - halfDrain;
        drain -= halfDrain;
        maximumAlreadyDrained = true;
    }
    await plineWithContinuation(drainHeroEnergy(game, drain, {
        maximumAlreadyDrained,
    }));
}
// Part of C trap.c:trapeffect_anti_magic(): test wall-passing protection against compression.
function heroPassesWallsForAntiMagic() {
    return !!game.u?.passesWalls || monsterPassesWalls(heroMonsterForm());
}
// Part of C trap.c:trapeffect_anti_magic(): test the wielded artifact's magic defense.
function heroWieldsMagicbane() {
    return artifactById(heroObject('uwep')?.oartifact)?.name === 'Magicbane';
}
// Part of C trap.c:trapeffect_anti_magic(): detect carried non-quest magic defense.
function heroCarriesNonQuestMagicDefense() {
    return (game.inventory || []).some((object) => {
        const artifact = artifactById(object?.oartifact);
        return artifact && !artifact.questArtifact && artifact.carriedDefense === 'magic';
    });
}
// Part of C trap.c:trapeffect_anti_magic(): roll and reduce hero compression damage.
function implosionDamage() {
    const hero = game.u;
    let damage = rnd(4);
    if (hero.halfPhysicalDamage ||
        heroHasHalfSpellDamage(game) ||
        heroHasCarriedArtifactFlag('SPFX_HPHDAM', game)) {
        damage += rnd(4);
    }
    if (heroWieldsMagicbane())
        damage += rnd(4);
    if (heroCarriesNonQuestMagicDefense())
        damage += rnd(4);
    if (heroPassesWallsForAntiMagic())
        damage = Math.trunc((damage + 3) / 4);
    return damage;
}
// Port only: form a possessive monster-message subject.
function possessive(subject) {
    return /s$/iu.test(subject) ? `${subject}'` : `${subject}'s`;
}
// C trap.c:trapeffect_dart_trap()
// The dart twin of the arrow trap: the hero branch — the 1-in-15
// exhausted-trap click, the shot at the hero, and the steed's chance to
// take it.  The hero branch of C trap.c:trapeffect_arrow_trap() is merged
// into this port as well; its citation owner is beginMonsterProjectileTrap()
// (the monster branch), which also carries the dart monster branch.
async function triggerProjectileTrap(trap) {
    const hero = game.u;
    const blind = !!game.blind || heroIsBlind(game);
    const arrowTrap = trap.ttyp === ARROW_TRAP;
    const objectType = arrowTrap ? ARROW : DART;
    const noun = arrowTrap ? 'arrow' : 'little dart';
    const subject = arrowTrap ? 'An arrow' : 'A little dart';
    const attackLevel = arrowTrap ? 8 : 7;
    if (trap.once && trap.tseen && rn2(15) === 0) {
        await publishHeardMessage(arrowTrap ? 'a loud click!' : 'a soft click.', plineWithContinuation);
        deleteTrap(trap);
        await newsym(trap.tx, trap.ty);
        return;
    }
    trap.once = true;
    await seeTrap(trap);
    await plineWithContinuation(`${subject} shoots out at you!`);
    const missile = await makeTrapMissile(objectType, trap);
    if (!arrowTrap && rn2(6) === 0)
        missile.opoisoned = 1;
    const damage = physicalDamage(rollPhysicalWeaponDamageAgainstHero(missile, game));
    const steed = hero.usteed;
    if (steed && rn2(2) === 0) {
        // A killed steed's m_detach() already dismounted the hero, so
        // steedintrap()'s own dismount_steed() finds no steed.
        await hitSteedWithTrapMissile(steed, trap, missile, game);
        return;
    }
    const mortality = hero.umortality || 0;
    const hit = await hitHeroWithObject(missile, damage, attackLevel, {
        name: noun,
    });
    if (hit.died)
        return;
    if (hit.hit) {
        if (missile.opoisoned) {
            const poison = await poisonHero({
                reason: 'dart',
                killer: 'little dart',
                attribute: A_CON,
                fatal: (hero.umortality || 0) > mortality ? 0 : 10,
                state: game,
                thrownWeapon: true,
                publish: plineWithContinuation,
            });
            if (poison.died)
                return;
        }
        await deleteObject(missile, game);
        return;
    }
    placeCreatedObject(missile, trap.tx, trap.ty);
    if (!blind)
        observeObject(missile, game);
    await stack_object(missile, game);
    await newsym(trap.tx, trap.ty);
}
// Part of C trap.c:trapeffect_poly_trap(): the hero branch (the monster
// branch applyMonsterPolymorphTrap() holds the citation) — the trigger
// message with the steed's lead-in, the form change or its reversal, the
// worn-gear consequences, and the steed's own steedintrap() polymorph.
export async function triggerHeroPolymorphTrap(trap, viaSitting) {
    requirePlayingGame(game);
    await seeTrap(trap);
    const steed = game.u.usteed;
    const locomotion = heroLocomotion('step');
    const verb = viaSitting ? 'trigger' : steed
        ? `lead ${monsterName(steed, {
            article: steed.name && !heroIsHallucinating(game) ? 'none' : 'the',
            suppressSaddle: true,
        })} onto` : `${locomotion} onto`;
    await plineWithContinuation(`You ${verb} a polymorph trap!`);
    const shoes = game.uarmf || game.u.uarmf;
    if (shoes && objectMaterial(shoes.otyp) === IRON) {
        deleteTrap(trap);
        observeObjectForNaming(shoes);
        await plineWithContinuation(`${ownedObjectName(shoes)} warps strangely.`);
        await poly_obj(shoes, shoes.otyp === IRON_SHOES ? KICKING_BOOTS : IRON_SHOES);
        const replacement = game.uarmf || game.u.uarmf;
        if (replacement) {
            observeObjectForNaming(replacement);
            await plineWithContinuation(`${replacement.invlet} - ${await inventoryItemDescription(replacement)}.`);
        }
        return;
    }
    if (propertyIsActive('antimagic', game) || heroHasArtifactDefense('magic', game)
        || heroIsUnchanging(game)) {
        await shieldeff(game.u.ux, game.u.uy);
        await plineWithContinuation(formatFeltMessage('momentarily different.'));
        return;
    }
    if (steed) {
        steed.mx = game.u.ux;
        steed.my = game.u.uy;
        // C zap.c:resist() maps WAND_CLASS to attack level 12.
        if (!monsterHasMagicResistance(steed) && !monsterResistsEffect(steed, 12, rn2))
            await changeMonsterForm(steed, null, game, {
                showMessage: true, publish: plineWithContinuation,
            });
        if (game.program_state.gameover)
            return;
    }
    deleteTrap(trap);
    await newsym(game.u.ux, game.u.uy);
    await plineWithContinuation(formatFeltMessage('a change coming over you.'));
    await polymorphHero();
}
// Part of C trap.c:trapeffect_bear_trap(): the hero branch (the monster
// branch below holds the citation) — harmless close over amorphous or
// tiny forms, the leg damage, and the TT_BEARTRAP snag.
async function triggerBearTrap(trap, { failedUntrap = false, forceTrap = false, viaSitting = false, } = {}) {
    requirePlayingGame(game);
    const hero = game.u;
    const levitating = hero.levitating || game.levitating;
    const flying = hero.flying || game.flying;
    const forced = forceTrap || failedUntrap;
    const damage = d(2, 4);
    if (!forced && !viaSitting && (levitating || flying))
        return false;
    await feelTrap(trap);
    const subject = trap.madeby_u ? 'Your' : 'A';
    const body = { mnum: heroMonsterForm() };
    if (monsterIsAmorphous(body) || monsterIsWhirly(body) || monsterIsUnsolid(body)) {
        await plineWithContinuation(`${subject} bear trap closes harmlessly through you.`);
        return false;
    }
    if (!hero.usteed && (MONSTER_SIZE[body.mnum] ?? 2) <= 1) {
        await plineWithContinuation(`${subject} bear trap closes harmlessly over you.`);
        return false;
    }
    setHeroTrap(4 + rn2(4), TT_BEARTRAP);
    game.context.botl = true;
    const steed = hero.usteed;
    if (steed) {
        // C trap.c:1508-1509: s_suffix(mon_nam(u.usteed)).
        const possessive = possessiveName(monsterName(steed));
        await plineWithContinuation(`${subject} bear trap closes on ${possessive} ${mbodypart(steed.mnum, FOOT)}!`);
        // C thitm(0, steed, NULL, damage, FALSE): forced damage, no missile.
        steed.mhp -= damage;
        if (steed.mhp <= 0) {
            const death = await finishMonsterTrapDeath(steed, game, { damageType: AD_PHYS });
            if (death.heroDied)
                return true;
            if (!death.survived)
                await resetUtrap(true);
        }
    }
    else {
        await plineWithContinuation(`${subject} bear trap closes on your ${body_part(FOOT)}!`);
        if (['owlbear', 'bugbear'].includes(MONSTER_NAME[body.mnum] ?? ''))
            await plineWithContinuation('You howl in anger!');
        const boots = heroIronShoes();
        if (boots) {
            if (!heroIsBlind(game))
                observeObject(boots, game);
            await plineWithContinuation(`${ownedObjectName(boots)} protects your leg.`);
        }
        else {
            const side = rn2(2) ? 'right' : 'left';
            await woundHeroLegs(side, 10 + rn2(10));
            if (await loseHeroHp(physicalDamage(damage), 'bear trap'))
                return true;
        }
    }
    await exerciseAttribute(A_DEX, false);
    return false;
}
// C trap.c:dotrap(): the hero trap entry.  The prelude runs the Sokoban air
// currents, the check_in_air() fly-over, and the 1-in-5 seen-trap escape
// (conjoined_pits()/adj_nonconjoined_pit() guard a pit the hero left), then
// teaches the steed, projects trap knowledge, and hands the actor to
// trapeffect_selector().  shortCircuited stops remaining spot effects; died
// stops the whole action.
export async function dotrap(trap, { finishTeleport = null, gotoLevel = null, viaSitting = false, failedUntrap = false, forceTrap = false, forceBungle = false, noWebMessage = false, tookPlunge = false, recursiveTrap = false, } = {}) {
    if (!trap)
        return { died: false, shortCircuited: false };
    endVoluntaryMultiTurn();
    requirePlayingGame(game);
    const hero = game.u;
    const pit = is_pit(trap.ttyp);
    const sokobanFall = game.level.flags.sokoban_rules
        && (pit || trap.ttyp === HOLE || trap.ttyp === TRAPDOOR);
    const forced = forceTrap || failedUntrap
        || (trap.ttyp === TELEP_TRAP && trap.teledest
            && isok(trap.teledest.x, trap.teledest.y));
    const owner = trap.madeby_u ? 'your'
        : trap.ttyp === ARROW_TRAP ? 'an' : 'a';
    if (sokobanFall) {
        await plineWithContinuation(`Air currents pull you down into ${owner} ${trapName(trap.ttyp, { ignoreHallucination: true })}!`);
    }
    else if (!forced) {
        const airborne = hero.levitating || game.levitating
            || ((hero.flying || game.flying) && !viaSitting && !tookPlunge);
        if (trapTriggeredByFloor(trap) && airborne) {
            const locomotion = heroLocomotion('step');
            if (trap.tseen)
                await plineWithContinuation(`You ${locomotion} over ${owner} ${trapName(trap.ttyp)}.`);
            return { died: false, shortCircuited: false };
        }
        const previousPit = trapAt(game, hero.ux0, hero.uy0);
        const conjoined = pit && hero.utrap && hero.utraptype === TT_PIT
            && pitsAreConjoined(previousPit, trap);
        const adjacent = adjNonconjoinedPit(trap);
        if (trap.tseen && !hero.fumbling && trap.ttyp !== MAGIC_PORTAL
            && trap.ttyp !== VIBRATING_SQUARE && trap.ttyp !== ANTI_MAGIC
            && !forceBungle && !tookPlunge && !conjoined && !adjacent
            && (rn2(5) === 0 || (pit && monsterIsClinger(heroMonsterForm() ?? -1)))) {
            await plineWithContinuation(`You escape ${owner} ${trapName(trap.ttyp)}.`);
            return { died: false, shortCircuited: false };
        }
    }
    if (hero.usteed)
        monsterLearnsTrap(hero.usteed, trap);
    monstersSeeTrap(game, trap);
    return trapeffectSelector(hero, trap, {
        finishTeleport, gotoLevel, viaSitting, failedUntrap, forceTrap,
        forceBungle, noWebMessage, tookPlunge, recursiveTrap,
    });
}
// tnnames[]: the twelve squeaky-board notes, indexed by tnote.
const SQUEAKY_BOARD_NOTES = [
    'C note', 'D flat', 'D note', 'E flat',
    'E note', 'F note', 'F sharp', 'G note',
    'G sharp', 'A note', 'B flat', 'B note',
];
// C trap.c:trapnote(): the squeaky board's musical note, prefixed with its
// article (an()).
export function squeakyBoardNoteWithArticle(index) {
    const note = SQUEAKY_BOARD_NOTES[index];
    if (!note)
        return '';
    return withIndefiniteArticle(note);
}
// C trap.c:choose_trapnote(). Prefer a note not used by another squeaky board.
function choose_trapnote(trap, level) {
    const used = new Set(level.traps
        .filter(candidate => candidate !== trap && candidate.ttyp === SQKY_BOARD)
        .map(candidate => candidate.tnote));
    const available = [];
    for (let note = 0; note < 12; note++)
        if (!used.has(note))
            available.push(note);
    const selectedNote = available.length
        ? available[rn2(available.length)] : rn2(12);
    if (selectedNote === undefined)
        throw new Error('Squeaky board selected a missing note');
    return selectedNote;
}
// C trap.c:steedintrap() for an arrow or dart trap: thitm() aims the
// missile at the ridden steed on the hero's square.
export async function hitSteedWithTrapMissile(steed, trap, missile, state = game, { publish = plineWithContinuation } = {}) {
    steed.mx = state.u.ux;
    steed.my = state.u.uy;
    const visibility = monsterTrapVisibility(steed, state);
    const hit = findMonsterArmorClass(steed) + (trap.ttyp === ARROW_TRAP ? 8 : 7)
        + (missile.spe ?? 0) <= rnd(20);
    const event = {
        kind: 'projectile-trap', trap, missile, hit, killed: false, finished: false, ...visibility,
    };
    await finishMonsterProjectileTrap(steed, event, state, { publish });
    return event;
}
// Part of C trap.c:thitm(): place and stack a trap missile that missed.
async function placeMissile(missile, trap, state) {
    if (state === game)
        placeCreatedObject(missile, trap.tx, trap.ty);
    else {
        missile.ox = trap.tx;
        missile.oy = trap.ty;
        missile.where = 'floor';
        const level = requireGameLevel(state);
        const column = (level.objects[trap.tx] ??= []);
        const pile = (column[trap.ty] ??= []);
        pile.unshift(missile);
    }
    return await stack_object(missile, state);
}
// Part of C trap.c:thitm(), trap.c:trapeffect_arrow_trap(), trap.c:trapeffect_dart_trap(): finish missile damage or spent-trap feedback.
export async function finishMonsterProjectileTrap(monster, event, state = game, { publish = async () => { }, random = rn2, rollOne = rnd, describeMonster = target => monsterName(target, { state, capitalized: true }), } = {}) {
    if (!event || event.finished)
        return event;
    if (event.kind === 'spent-projectile-trap') {
        const subject = describeMonster(monster);
        await publish(`${subject} triggers a trap but nothing happens.`);
        deleteTrap(event.trap, state);
        if (state === game)
            await newsym(monster.mx, monster.my);
        event.finished = true;
        return event;
    }
    if (event.seeSquare) {
        // trap.c thitm() names the missile with doname(), which also
        // marks a seen missile's appearance as known.
        observeObjectForNaming(event.missile, { state });
        await publish(`${describeMonster(monster)} is ${event.hit ? 'hit' : 'almost hit'} by ${await objectDescription(event.missile)}!`);
    }
    if (event.hit) {
        const damage = Math.max(1, rollPhysicalWeaponDamage(event.missile, monster, { rollOne }));
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - damage);
        await deleteObject(event.missile, state);
        if (monster.mhp <= 0) {
            const death = await finishMonsterTrapDeath(monster, state, {
                damageType: AD_PHYS,
                random,
                publish,
            });
            event.death = death;
            event.killed = !death.survived;
            if (death.survived)
                monster.dead = false;
        }
    }
    else {
        event.missile = await placeMissile(event.missile, event.trap, state);
    }
    event.finished = true;
    return event;
}
// C trap.c:blow_up_landmine(). Scatter objects, destroy terrain, then settle the resulting pit.
export async function explodeLandMine(trap, state = game, { publish = plineWithContinuation, random = rn2, rollOne = rnd, seeSquare = false, heroCaused = !state.context.mon_moving, finishMonsterDeath = null, finishMonsterKill = null, resolveLiquid = null, } = {}) {
    const x = trap.tx;
    const y = trap.ty;
    const oldTyp = state.level?.at?.(x, y)?.typ ?? ROOM;
    await scatterFloorObjects(x, y, 4, {
        state,
        publish,
        random,
        rollOne,
        heroCaused,
        finishMonsterDeath,
        finishMonsterKill,
    });
    if (state.program_state.gameover)
        return null;
    const level = requireGameLevel(state);
    level.engravings = (level.engravings || []).filter(engraving => engraving.x !== x || engraving.y !== y);
    await wakeMonstersNearWithMessages(x, y, 400, state, publish);
    const location = state.level?.at?.(x, y);
    if (location && IS_DOOR(location.typ))
        location.doormask = D_BROKEN;
    const { destroyDrawbridge, findDrawbridgeAt } = await import('./dbridge.js');
    const bridge = findDrawbridgeAt(x, y, state);
    if (bridge) {
        await destroyDrawbridge(bridge.x, bridge.y, state, finishMonsterKill ? { finishMonsterKill } : {});
    }
    if (state.program_state?.gameover)
        return null;
    const survivingTrap = state.level?.traps?.find(candidate => candidate.tx === x && candidate.ty === y) || null;
    if (survivingTrap) {
        if (Is_airlevel(state.u?.uz) || Is_waterlevel(state.u?.uz)) {
            deleteTrap(survivingTrap, state);
        }
        else {
            const liquid = liquidForHole(x, y, state, { random });
            if (liquid !== ROOM) {
                deleteTrap(survivingTrap, state);
                const location = requireGameLevel(state).at(x, y);
                if (!location)
                    throw new Error(`Land mine has no terrain at (${x}, ${y})`);
                location.typ = liquid;
                location.flags = 0;
                updateIceObjectTimersAt(x, y, state);
                await unearthFloorObjectsAt(x, y, state);
                if (seeSquare)
                    await publish(`The hole fills with ${displayLiquidName(liquid === LAVAPOOL ? 'lava' : 'water', state)}!`);
                const pile = state.level?.objects?.[x]?.[y] || [];
                if (liquid === LAVAPOOL) {
                    await fireDamageChain(pile, {
                        state, x, y, force: true,
                        publish: publish,
                        random: random,
                    });
                }
                else {
                    const messages = [];
                    await waterDamageChain(pile, messages, state);
                    if (seeSquare) {
                        for (const message of messages)
                            await publish(message);
                    }
                }
                const effect = await resolveLiquid?.(liquid);
                if (!((effect && 'died' in effect && effect.died) || state.program_state?.gameover))
                    await newsym(x, y);
                if (state.program_state?.gameover)
                    return null;
            }
            else {
                survivingTrap.ttyp = PIT;
                survivingTrap.madeby_u = false;
                await seeTrap(survivingTrap, state);
            }
        }
    }
    // C blow_up_landmine() settles the square however the trap ended.
    await fillPitWithBoulderAt(x, y, state, { publish });
    if (state.program_state?.gameover)
        return null;
    while (isPoolAt(x, y, state) || isLavaAt(x, y, state)) {
        const boulder = state.level?.objects?.[x]?.[y]?.find(object => object.otyp === BOULDER);
        if (!boulder)
            break;
        unlinkObject(boulder, state);
        await dropBoulderIntoLiquid(boulder, x, y, state, { publish, random });
        if (state.program_state?.gameover)
            return null;
    }
    vision_note_blocker_change(x, y);
    spotChecks(x, y, oldTyp, state);
    return survivingTrap && state.level?.traps?.includes(survivingTrap)
        ? survivingTrap : null;
}
// C trap.c:launch_drop_spot(). Retain or clear the object temporarily absent from floor chains.
function launch_drop_spot(object, origin, state) {
    if (object)
        activeLaunches.set(state, { object, origin: { ...origin } });
    else
        activeLaunches.delete(state);
}
const activeLaunches = new WeakMap();
// C trap.c:launch_in_progress(). Test for a launched object retained across end-of-game input.
export function launch_in_progress(state) {
    return activeLaunches.has(state);
}
// C trap.c:force_launch_placement(). Return a retained object to its launch square for bones.
export function force_launch_placement(state) {
    const launch = activeLaunches.get(state);
    if (!launch)
        return;
    unlinkObject(launch.object, state);
    launch.object.otrapped = false;
    placeObjectSynchronously(launch.object, launch.origin.x, launch.origin.y, state);
}
// C trap.c:launch_obj(): roll an object (the boulder) from one square to
// another, resolving each square's occupants, traps and floor effects
// before the final placement; sobj_at(): boulderAt finds the
// missile at either end. C trap.c:launch_drop_spot(): activeLaunches
export async function launchRollingBoulder(start, endpoint, { state = requireInitializedGame(), unseen = false, known = false, publish = plineWithContinuation, random = rn2, rollOne = rnd, rollDice = d, } = {}) {
    requirePlayingGame(state);
    const level = state.level;
    let source = start, destination = endpoint;
    let boulder = boulderAt(source, state);
    if (!boulder) {
        boulder = boulderAt(destination, state);
        if (!boulder)
            return false;
        [source, destination] = [destination, source];
    }
    // C trap.c:3293-3295: taking the last boulder off the launch square
    // exposes anything that was hiding beneath it.
    const tookWholePile = boulder.quan <= 1;
    if (boulder.quan > 1) {
        const single = splitObjectStack(boulder, 1, state);
        if (!single)
            throw new Error(`Cannot launch one boulder from stack ${boulder.o_id}`);
        boulder = single;
    }
    unlinkObject(boulder, state);
    if (tookWholePile)
        await maybeUnhideAt(source.x, source.y, state);
    await newsym(source.x, source.y);
    vision_note_blocker_change(source.x, source.y);
    const digging = state.context.digging;
    if (digging?.pos.x === source.x && digging.pos.y === source.y)
        delete state.context.digging;
    boulder.otrapped = known;
    if (unseen) {
        if (cansee(source.x, source.y)) {
            const name = withIndefiniteArticle(objectCombatName(boulder, { state }));
            await publish(formatSeenMessage(`${name} start to roll.`, state));
        }
        else
            await hear(heroIsHallucinating(state) ? 'someone bowling.'
                : `rumbling ${(source.x - state.u.ux) ** 2 + (source.y - state.u.uy) ** 2 <= 16 ? 'nearby' : 'in the distance'}.`);
    }
    const dx = Math.sign(destination.x - source.x), dy = Math.sign(destination.y - source.y);
    let remaining = distmin(source.x, source.y, destination.x, destination.y);
    let position = { ...source };
    let resting = { ...destination };
    let transient = null;
    let usedUp = false;
    const glyph = transientObjectGlyph(boulder);
    launch_drop_spot(boulder, source, state);
    try {
        while (remaining-- > 0 && !usedUp && !state.program_state.gameover) {
            transient = await animateRollingBoulderCell(boulder, glyph, position.x, position.y, transient);
            const next = { x: position.x + dx, y: position.y + dy };
            if (!isok(next.x, next.y)) {
                resting = position;
                break;
            }
            position = next;
            const monster = monsterAtPosition(level, position.x, position.y);
            if (monster) {
                if (monsterThrowsRocks(monster.mnum) && random(3)) {
                    if (cansee(position.x, position.y))
                        await publish(`${monsterName(monster, { state, capitalized: true })} snatches the boulder.`);
                    boulder.otrapped = false;
                    await addObjectToMonsterInventory(monster, boulder, state);
                    usedUp = true;
                    break;
                }
                usedUp = await hitMonster(monster, boulder);
                if (usedUp || state.program_state.gameover)
                    break;
            }
            else if (state.u.ux === position.x && state.u.uy === position.y) {
                let damage = rollPhysicalWeaponDamageAgainstHero(boulder, state, { rollOne, rollDice });
                if (state.u.halfPhysicalDamage || heroHasCarriedArtifactFlag('SPFX_HPHDAM', state))
                    damage = Math.trunc((damage + 1) / 2);
                if (state.multi)
                    endVoluntaryMultiTurn(state);
                const hit = await hitHeroWithObject(boulder, damage, 9 + (boulder.spe ?? 0), {
                    state, publish, rollOne, killer: killerObjectName(boulder, state),
                });
                if (hit.died)
                    break;
                if (hit.hit)
                    await stopHeroOccupation(state, publish);
            }
            if (await shipObject(boulder, position.x, position.y, { state, publish, random })) {
                usedUp = true;
                break;
            }
            const trap = level.traps.find(candidate => candidate.tx === position.x && candidate.ty === position.y);
            if (trap?.ttyp === LANDMINE && random(10) > 2) {
                await publish(`KAABLAMM!!!${cansee(position.x, position.y) ? '  The rolling boulder triggers a land mine.' : ''}`);
                deleteTrap(trap, state);
                deleteEngravingAt(position.x, position.y, level);
                await placeObject(boulder, position.x, position.y, state);
                boulder.otrapped = false;
                await fractureRock(boulder, position.x, position.y, { state, publish, random });
                await scatterFloorObjects(position.x, position.y, 4, {
                    state, publish, random, rollOne, rollDice,
                    heroCaused: !state.context.mon_moving,
                    finishMonsterDeath: async (target, deathOptions = {}) => {
                        if (state.context.mon_moving)
                            return finishEnvironmentalMonsterDeath(target, state, { ...deathOptions, publish, random });
                        if (deathOptions.deathMessage)
                            await publish(deathOptions.deathMessage);
                        // Debris uses ohitmon's ordinary missile range, so
                        // an unknown boulder trap still gives hero kill credit.
                        const death = await finishHeroMonsterKillOutcome(target, target.mx, target.my, {
                            showKillMessage: false, publish,
                        });
                        return { survived: !death.killed, heroDied: death.heroDied };
                    },
                });
                await newsym(position.x, position.y);
                usedUp = true;
                break;
            }
            if (trap && (trap.ttyp === TELEP_TRAP || trap.ttyp === LEVEL_TELEP)) {
                const newDepth = trap.ttyp === LEVEL_TELEP ? randomTeleportDepth(state, random, rollOne) : null;
                if (newDepth !== depth(state.u.uz, state.dungeons)) {
                    if (cansee(position.x, position.y))
                        await publish('Suddenly the rolling boulder disappears!');
                    else if (!heroIsDeaf(state))
                        await hear('a rumbling stop abruptly.');
                    boulder.otrapped = false;
                    if (newDepth === null)
                        await relocateObjectRandomly(boulder, { state, publish, random });
                    else {
                        const location = levelAtDepth(newDepth, { state });
                        boulder.no_charge = false;
                        boulder.where = 'migrating';
                        boulder.ox = location.dnum;
                        boulder.oy = location.dlevel;
                        boulder.owornmask = MIGR_RANDOM;
                        boulder.migration = { source: { ...state.u.uz }, destination: location, arrival: MIGR_RANDOM };
                        (state.migratingObjects ??= []).unshift(boulder);
                    }
                    await seeTrap(trap, state);
                    usedUp = true;
                    break;
                }
            }
            const floor = await applyFloorEffects(boulder, position.x, position.y, { state, publish, random, verb: 'fall' });
            if (floor.finished) {
                usedUp = true;
                break;
            }
            if (trap && (is_pit(trap.ttyp) || is_hole(trap.ttyp))) {
                resting = position;
                break;
            }
            const other = boulderAt(position, state);
            if (other) {
                const ahead = level.at(position.x + dx, position.y + dy);
                const collision = !remaining || !ahead || IS_OBSTRUCTED(ahead.typ)
                    ? ' as one boulder hits another' : ' as one boulder sets another in motion';
                await hear(`a loud crash${cansee(position.x, position.y) ? collision : ''}!`);
                unlinkObject(other, state);
                other.otrapped = !!boulder.otrapped;
                boulder.otrapped = false;
                await placeObject(boulder, position.x, position.y, state);
                boulder = other;
                await wakeMonstersNearWithMessages(position.x, position.y, 100, state, publish);
            }
            const cell = level.requireAt(position.x, position.y);
            if (cell.typ === DOOR && cell.doormask & (D_CLOSED | D_LOCKED)) {
                if (cansee(position.x, position.y))
                    await publish('The boulder crashes through a door.');
                cell.doormask = D_BROKEN;
                if (remaining)
                    vision_note_blocker_change(position.x, position.y);
            }
            const ahead = level.at(position.x + dx, position.y + dy);
            if (remaining > 0 && ahead) {
                if (ahead.typ === IRONBARS) {
                    const bars = await projectileHitsIronBars(boulder, {
                        x: position.x, y: position.y, barsX: position.x + dx, barsY: position.y + dy,
                        state, publish, random, forceHit: random(20) === 0,
                    });
                    if (bars.blocked) {
                        resting = position;
                        usedUp = bars.destroyed;
                        break;
                    }
                }
                else if (IS_STWALL(ahead.typ) || IS_TREE(ahead.typ)) {
                    resting = position;
                    if (!heroIsDeaf(state))
                        await publish('Thump!');
                    await wakeMonstersNearWithMessages(position.x, position.y, 16, state, publish);
                    break;
                }
            }
        }
    }
    finally {
        if (transient)
            await newsym(transient.x, transient.y);
        launch_drop_spot(null, source, state);
    }
    if (!usedUp && !state.program_state.gameover) {
        boulder.otrapped = false;
        await placeObject(boulder, resting.x, resting.y, state);
        await newsym(resting.x, resting.y);
    }
    return true;
    async function hear(sound) {
        const message = formatHeardMessage(sound, state);
        if (message)
            await publish(message);
    }
    async function hitMonster(monster, object) {
        const visible = cansee(position.x, position.y);
        const spotted = canSpotMonster(monster);
        const mimic = !!monster.m_ap_type && monster.m_ap_type !== M_AP_MONSTER;
        if (visible)
            observeObject(object, state);
        const accuracy = 5 + findMonsterArmorClass(monster) + rangedTargetHitBonus(object, monster, { state });
        if (accuracy < rollOne(20)) {
            if (visible && !mimic) {
                const name = objectCombatName(object, { state });
                const target = state.flags.verbose ? monsterName(monster, { state }) : 'it';
                await publish(`The ${name} misses ${target}.`);
            }
            return false;
        }
        const damage = rollPhysicalWeaponDamage(object, monster, { state, rollOne, rollDice });
        const harmless = passes_rocks(monster.mnum);
        if (mimic)
            await revealMonsterAppearance(monster);
        monster.msleeping = 0;
        if (visible) {
            const ending = harmless
                ? ` but passes harmlessly through ${monsterObjectPronoun(monster, { state, random })}.`
                : damage > 4 ? '!' : '.';
            const name = objectCombatName(object, { state });
            const target = state.flags.verbose ? monsterName(monster, { state }) : 'it';
            await publish(`The ${name} hits ${target}${ending}`);
        }
        if (!harmless) {
            monster.mhp -= damage;
            if (monster.mhp <= 0) {
                if (visible)
                    await publish(`${monsterName(monster, { state, capitalized: true })} is ${monsterIsNonliving(monster.mnum) || monsterIsVampireShifter(monster) || !spotted ? 'destroyed' : 'killed'}!`);
                if (!state.context.mon_moving && object.otrapped)
                    await finishHeroMonsterKillOutcome(monster, monster.mx, monster.my, { showKillMessage: false, publish });
                else
                    await finishEnvironmentalMonsterDeath(monster, state, { publish, random });
            }
        }
        if (!monster.dead && monster.mhp > 0 && !state.context.mon_moving)
            await angerMonster(monster, { attacked: true });
        if (await shipObject(object, position.x, position.y, { state, publish, random }))
            return true;
        const occupant = monsterAtPosition(level, position.x, position.y);
        const floor = await applyFloorEffects(object, position.x, position.y, { state, publish, random, verb: 'fall' });
        if (floor.finished)
            return true;
        await placeObject(object, position.x, position.y, state);
        const defender = occupant ?? (state.u.ux === position.x && state.u.uy === position.y ? state.u : null);
        if (defender)
            await applyMonsterPassiveToObject(defender, object, { state, publish, random });
        object = await stack_object(object, state);
        boulder = object;
        unlinkObject(object, state);
        return false;
    }
}
// Port only: route trap sound text through the shared hearing formatter.
async function hear(text) {
    const message = formatHeardMessage(text);
    if (message)
        await plineWithContinuation(message);
}
// Port only: find a boulder in a runtime floor pile.
function boulderAt(position, state) {
    return state.level.objects[position.x]?.[position.y]?.find(object => object.otyp === BOULDER) ?? null;
}
// Part of C trap.c:launch_obj(): display one visible boulder step and its delay.
export async function animateRollingBoulderCell(boulder, glyph, x, y, previous) {
    if (previous)
        await newsym(previous.x, previous.y);
    if (!cansee(x, y))
        return null;
    await show_glyph_cell(x, y, glyph.ch, glyph.color, glyph.decgfx, glyph.attr, glyph);
    // Keep the animation cursor after the last map cell the display changed.
    const frameCursor = previous
        ? lastDirtyMapCursor() ?? [x, y + 1]
        : [x, y + 1];
    for (let delay = 0; delay < 2; delay++) {
        await flush_screen(1);
        game.nhDisplay?.setCursor(...frameCursor);
        await game.animationFrame?.();
    }
    return { x, y };
}
// C trap.c:seetrap(). Reveal a new trap and redraw its square.
export async function seeTrap(trap, state = game) {
    if (trap.tseen)
        return;
    trap.tseen = true;
    if (state === game)
        await newsym(trap.tx, trap.ty);
}
// C trap.c:feeltrap(). Touch maps even a known trap without requiring sight.
export async function feelTrap(trap, state = game) {
    trap.tseen = true;
    if (state === game) {
        await map_trap(trap, true);
        await newsym(trap.tx, trap.ty);
    }
}
// C trap.c:find_random_launch_coord(). Search both sides in the original direction and distance order.
function find_random_launch_coord(trap, x, y, level) {
    let distance = rn1(5, 4);
    let direction = rn2(8);
    let tries = 0;
    // isclearpath(): any ZAP_POS terrain (pools and lava included) except
    // a closed or locked door, with no pit, hole, or teleport trap.
    let launch = null;
    while (distance >= 2) {
        const dx = xdir[direction], dy = ydir[direction];
        if (dx === undefined || dy === undefined)
            throw new Error(`Rolling boulder trap has invalid direction ${direction}`);
        const lx = x + distance * dx, ly = y + distance * dy;
        const landsInLiquid = isPoolAt(lx, ly) || isLavaAt(lx, ly);
        if (!landsInLiquid && isclearpath(trap, x, y, dx, dy, distance, level)
            && isclearpath(trap, x, y, -dx, -dy, distance, level)) {
            launch = { x: lx, y: ly };
            break;
        }
        direction = (direction + 1) % 8;
        if (++tries % 8 === 0)
            distance--;
    }
    return launch;
}
// C trap.c:mkroll_launch(). Place ammunition and record the two launcher endpoints.
async function mkroll_launch(trap, x, y, level) {
    if (level.flags.sokoban_rules) {
        trap.launch = { x, y };
        trap.launch2 = { x, y };
        return;
    }
    const launch = find_random_launch_coord(trap, x, y, level);
    if (launch) {
        const boulder = await mksobj(BOULDER, true, false);
        placeCreatedObject(boulder, launch.x, launch.y);
        await stack_object(boulder);
        trap.launch = launch;
        await newsym(launch.x, launch.y);
        trap.launch2 = {
            x: x - (launch.x - x), y: y - (launch.y - y),
        };
    }
    else {
        trap.launch = { x, y };
        trap.launch2 = { x, y };
    }
}
// C trap.c:isclearpath(). Reject obstructed terrain and traps that stop a rolling boulder.
function isclearpath(trap, x, y, dx, dy, length, level) {
    for (let step = 1; step <= length; step++) {
        const px = x + step * dx, py = y + step * dy;
        const loc = isok(px, py) ? level.at(px, py) : undefined;
        if (!loc || !ZAP_POS(loc.typ)
            || (IS_DOOR(loc.typ) && (loc.doormask & (D_LOCKED | D_CLOSED)) !== 0))
            return false;
        const blockingTrap = level.traps.some(candidate => candidate !== trap && candidate.tx === px
            && candidate.ty === py
            && (is_pit(candidate.ttyp) || is_hole(candidate.ttyp)
                || (candidate.ttyp >= TELEP_TRAP && candidate.ttyp <= MAGIC_PORTAL)));
        if (blockingTrap)
            return false;
    }
    return true;
}
const MZ_HUGE = 4;
// C trap.c:m_easy_escape_pit(): pit fiends and MZ_HUGE bodies climb out of
// pits without a struggle; C tests monsters and &gy.youmonst alike.
function escapesPitEasily(mnum) {
    return mnum === PM_PIT_FIEND || (MONSTER_SIZE[mnum ?? -1] ?? 0) >= MZ_HUGE;
}
// C trap.c:mintrap().  m_move()'s trapped actor takes its escape roll here,
// and postmov() calls this after a monster steps onto a trap square; source
// effects (dig, kick, throw, zap, polymorph splits) call the same entry with
// their own flags.  This boundary intentionally does not run tunneling,
// pickup, concealment, distfleeck(), or an attack tail; the movement fields
// report deaths, level exits, and staged completions to the caller.
// Also C trap.c:m_easy_escape_pit(): inlined here for already-trapped monsters.
export async function mintrap(monster, state = requireInitializedGame(), { forcetrap = false, forcebungle = false, inAir = false, movement: callerMovement, random = rn2, rollDice = d, rollOne = rnd, calls = DISCARDED_CALL_LOG, publish = plineWithContinuation, describeMonster, finishDeath, } = {}) {
    const movement = callerMovement ?? {
        oldx: monster.mx,
        oldy: monster.my,
        x: monster.mx,
        y: monster.my,
        moved: false,
        forcedTrapLanding: forcetrap,
        forcedTrapBungle: forcebungle,
    };
    const action = { monster, movement, calls, event: null };
    const trap = trapAt(state, monster.mx, monster.my);
    if (!trap) {
        monster.mtrapped = 0; /* perhaps teleported? */
        movement.trapOutcome = 'finished';
        return action;
    }
    if (monster.mtrapped) { /* is currently in the trap */
        // The already-trapped escape roll (trap.c:3741-3789) — noticing an
        // unseen trap under a trapped monster, the 1-in-40 (or easy-pit)
        // escape, the boulder that fills the pit, and the metallivore's
        // snack.  m_easy_escape_pit(): climbsEasily — a pit fiend or a
        // huge body.
        const describe = describeMonster
            ?? (target => canonicalMonsterName(target, { state, capitalized: true }));
        const { mx: x, my: y } = monster;
        const level = requireGameLevel(state);
        const { inSight, seeSquare } = monsterTrapVisibility(monster, state);
        const pit = is_pit(trap.ttyp);
        if (!trap.tseen && seeSquare && inSight
            && (pit || [BEAR_TRAP, HOLE, WEB].includes(trap.ttyp))) {
            await seeTrap(trap, state);
        }
        const climbsEasily = escapesPitEasily(monster.mnum);
        if (random(40) === 0 || (pit && climbsEasily)) {
            const boulder = pit && (level.objects[x]?.[y] || [])
                .some(object => object.otyp === BOULDER);
            if (boulder) {
                if (random(2) === 0) {
                    monster.mtrapped = 0;
                    if (inSight)
                        await publish(`${describe(monster)} pulls free...`);
                    await fillPitWithBoulderAt(x, y, state, { publish });
                }
            }
            else {
                if (inSight) {
                    if (pit) {
                        await publish(`${describe(monster)} climbs ${climbsEasily ? 'easily ' : ''}out of the pit.`);
                    }
                    else if (trap.ttyp === BEAR_TRAP || trap.ttyp === WEB) {
                        // C trapname() draws a hallucinated trap name after Monnam().
                        const subject = describe(monster);
                        await publish(`${subject} pulls free of the ${trapName(trap.ttyp, { state })}.`);
                    }
                }
                monster.mtrapped = 0;
            }
        }
        else if (metallivorous(monster.mnum)) {
            if (trap.ttyp === BEAR_TRAP) {
                if (inSight)
                    await publish(`${describe(monster)} eats a bear trap!`);
                deleteTrap(trap, state);
                monster.meating = 5;
                monster.mtrapped = 0;
            }
            else if (trap.ttyp === SPIKED_PIT) {
                if (inSight)
                    await publish(`${describe(monster)} munches on some spikes!`);
                trap.ttyp = PIT;
                monster.meating = 5;
            }
        }
        movement.trapOutcome = monster.mtrapped ? 'caught' : 'finished';
        return action;
    }
    const sokobanFall = state.level.flags.sokoban_rules && !trap.madeby_u
        && [PIT, SPIKED_PIT, HOLE, TRAPDOOR].includes(trap.ttyp);
    // C check_in_air(): the HURTLING input arrives from the caller (mhurtle)
    // ahead of the steed and FORCETRAP gates, as in the immediate entry this
    // replaces.
    if (inAir && trapTriggeredByFloor(trap) && !sokobanFall) {
        movement.trapOutcome = 'finished';
        return action;
    }
    const fixedTeleport = trap.ttyp === TELEP_TRAP && trap.teledest
        && isok(trap.teledest.x, trap.teledest.y);
    const forced = movement.forcedTrapLanding || fixedTeleport;
    if (monster !== state.u.usteed && !sokobanFall && !forced) {
        if (monsterFliesOrFloats(monster) && trapTriggeredByFloor(trap)) {
            movement.trapOutcome = 'finished';
            return action;
        }
        const alreadyKnown = monsterKnowsTrap(monster, trap)
            || trap.ttyp === HOLE && !monsterIsMindless(monster.mnum);
        if (alreadyKnown && recordRandom(random, calls, 4) !== 0
            && !movement.forcedTrapBungle) {
            const event = { kind: 'known-trap-avoided', trap, damage: 0 };
            movement.trap = event;
            action.event = event;
            movement.trapOutcome = 'finished';
            return action;
        }
    }
    const event = await monsterTrapEffect(monster, trap, state, movement, random, rollDice, rollOne, calls, publish);
    action.event = event ?? movement.trap ?? null;
    if (movement.deferredAfterMonsterTrap) {
        const deferred = action.event;
        if (!deferred)
            throw new Error('A deferred monster trap must retain its event');
        movement.trapOutcome = await finishDeferredMonsterTrap(monster, movement, deferred, state, calls, {
            random, rollDice, rollOne, publish,
            ...(describeMonster ? { describeMonster } : {}),
            ...(finishDeath ? { finishDeath } : {}),
        });
    }
    return action;
}
// Part of C trap.c:trapeffect_selector(): the monster side of the dispatch
// (the hero dispatch holds the citation above); each case runs the monster
// branch of the named trapeffect_ function, in its owner module or inline
// below. trap.c trapeffect_hole(): the grounded, size, and worm checks and
// the Sokoban yank sit inline before the fall.
// C trap.c:trapeffect_level_telep(): the fall itself is the level-teleport
// owner's monster move. trap.c trapeffect_magic_trap(): the monster
// branch replicates a fire trap 1 time in 21 through beginMonsterFireTrap
// (trapeffect_fire_trap()'s monster branch). trap.c trapeffect_telep_trap():
// the monster branch hands the move to the teleport owner's mtele path.
async function monsterTrapEffect(monster, trap, state, movement, random, rollDice, rollOne, calls, publish) {
    const sokobanFall = state.level.flags.sokoban_rules && !trap.madeby_u
        && [PIT, SPIKED_PIT, HOLE, TRAPDOOR].includes(trap.ttyp);
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
        const event = await mlevel_tele_trap(monster, trap, {
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
        const event = await mlevel_tele_trap(monster, trap, {
            state, random, rollOne, force: !!movement.forcedTrapLanding, publish,
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
        const event = await trapeffectRustTrap(monster, trap, {
            state, movement, publish,
            roll: (range) => recordRandom(random, calls, range),
        });
        movement.trap = event;
        movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === PIT || trap.ttyp === SPIKED_PIT) {
        const event = await trapeffectPit(monster, trap, {
            state, movement, publish, random,
            rollOne: (range) => {
                const result = rollOne(range);
                calls.push(`rnd(${range})`);
                return result;
            },
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
        const clinging = monsterIsClinger(monster.mnum) && levelHasCeiling(state);
        const airborne = monsterFliesOrFloats(monster) || clinging;
        const tooLarge = (MONSTER_SIZE[monster.mnum] ?? 2) >= 4;
        const longWorm = !!monster.wormno && (monster.wormSegments?.length ?? 0) > 5;
        if (airborne || tooLarge || longWorm) {
            const seen = canSeeMonster(monster) || monster === state.u.usteed;
            if (movement.forcedTrapLanding && !state.level.flags.sokoban_rules) {
                if (seen) {
                    await seeTrap(trap, state);
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
                await seeTrap(trap, state);
            }
        }
        const event = await mlevel_tele_trap(monster, trap, {
            state, random, rollOne, force: !!movement.forcedTrapLanding, publish,
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
        await newsym(monster.mx, monster.my);
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
        const event = await trapeffectSqkyBoard(monster, trap, { state, movement, publish });
        movement.trap = event;
        if (event)
            movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === SLP_GAS_TRAP) {
        const event = await trapeffectSlpGasTrap(monster, trap, {
            state, movement, publish,
            rollOne: (range) => {
                const result = rollOne(range);
                calls.push(`rnd(${range})`);
                return result;
            },
        });
        movement.trap = event;
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
        const event = await trapeffectRocktrap(monster, trap, {
            state, movement, random,
            beginRandom: (range) => recordRandom(random, calls, range),
            beginRollDice: (count, sides) => {
                const result = rollDice(count, sides);
                calls.push(`d(${count},${sides})`);
                return result;
            },
            publish,
        });
        movement.trap = event;
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
        const effect = await applyMonsterAntiMagicTrap(monster, {
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
// Part of C trap.c:mintrap(): finish the trap-effect completion mintrap()
// staged for its caller, then trap.c:3831-3837's "appears" reveal of a
// newly caught hider.  Updates the movement's death fields and reports
// whether the actor died, left the level, or the hero died.
export async function finishDeferredMonsterTrap(monster, movement, event, state, calls, { random = rn2, rollDice = d, rollOne = rnd, publish = plineWithContinuation, describeMonster, finishDeath = (victim, options) => finishEnvironmentalMonsterDeath(victim, state, options), } = {}) {
    delete movement.deferredAfterMonsterTrap;
    const recordedRandom = (range) => recordRandom(random, calls, range);
    const recordedRollOne = (range) => {
        const result = rollOne(range);
        calls.push(`rnd(${range})`);
        return result;
    };
    switch (event.kind) {
        case 'web-trap':
            await finishMonsterWebTrap(monster, event.trap, {
                state,
                publish,
                ...(describeMonster ? { subject: describeMonster } : {}),
            });
            break;
        case 'bear-trap':
            await finishMonsterBearTrap(monster, event, state, {
                publish,
                random,
                rollDice,
                ...(describeMonster ? { describeMonster } : {}),
            });
            break;
        case 'rust-trap':
            // The effect completed inside trapeffectRustTrap; only the
            // appears-reveal and death fields remain.
            break;
        case 'projectile-trap':
        case 'spent-projectile-trap':
            await finishMonsterProjectileTrap(monster, event, state, {
                publish,
                random,
                rollOne: recordedRollOne,
                ...(describeMonster ? { describeMonster } : {}),
            });
            break;
        case 'anti-magic-drain':
        case 'anti-magic-damage': {
            const death = await finishMonsterAntiMagicTrap(monster, event, state, {
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
            await finishMonsterFireTrap(monster, event, state, {
                publish,
                random,
                rollOne,
                ...(describeMonster ? { describeMonster } : {}),
            });
            break;
        case 'land-mine': {
            // A victim relocated by the blast meets mintrap(FORCETRAP) at
            // its new square, which may end its stay on this level.
            const relocated = { action: null };
            await finishMonsterLandMine(monster, event, state, {
                finishDeath,
                publish,
                random: recordedRandom,
                rollOne: recordedRollOne,
                ...(describeMonster ? { describeMonster } : {}),
                forceTrapAtMonster: async (victim) => {
                    relocated.action = await mintrap(victim, state, {
                        forcetrap: true, random: recordedRandom, rollOne: recordedRollOne,
                        rollDice, publish, finishDeath,
                        ...(describeMonster ? { describeMonster } : {}),
                    });
                },
            });
            const nested = relocated.action?.movement;
            if (nested?.heroDied)
                movement.heroDied = true;
            if (nested?.actorLeftLevel && !movement.heroDied) {
                movement.actorLeftLevel = true;
                movement.actionCompleted = true;
                return 'left-level';
            }
            break;
        }
        case 'pit-trap':
            // The effect completed inside trapeffectPit; only the
            // appears-reveal and death fields remain.
            break;
        case 'falling-rock':
        case 'spent-rock-trap':
            // The effect completed inside trapeffectRocktrap; only the
            // appears-reveal and death fields remain.
            break;
        case 'sleep-gas':
            // The effect completed inside trapeffectSlpGasTrap; only the
            // appears-reveal and death fields remain.
            break;
        case 'squeaky-board':
            // The effect completed inside trapeffectSqkyBoard; only the
            // appears-reveal and death fields remain.
            break;
        case 'vibrating-square':
            await finishMonsterVibratingSquare(monster, event, {
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
    // C trap.c:3831-3837: a monster newly caught by the trap cannot stay
    // hidden under an object; a first sighting reports that it appears.
    if (!monster.dead && (monster.mhp ?? 0) > 0
        && monster.mtrapped) {
        const alreadySpotted = canSpotMonster(monster);
        await maybeUnhideAt(monster.mx, monster.my, state);
        if (!alreadySpotted && canSeeMonster(monster)) {
            await publish(`${canonicalMonsterName(monster, {
                state, capitalized: true, article: 'a',
            })} appears.`);
        }
    }
    if (('heroDied' in event && event.heroDied)
        || ('death' in event && event.death?.heroDied)
        || state.program_state.gameover) {
        movement.heroDied = true;
        return 'hero-died';
    }
    if ('killed' in event && event.killed) {
        movement.actorDied = true;
        movement.postMoveStatus = MMOVE_DIED;
        movement.actionCompleted = true;
        return 'killed';
    }
    return 'finished';
}
// Part of C trap.c:trapeffect_fire_trap(): capture visibility and roll initial monster fire damage.
export function beginMonsterFireTrap(monster, trap, state, { rollDice = d } = {}) {
    const visibility = monsterTrapVisibility(monster, state);
    return {
        kind: 'fire-trap',
        trap,
        originalDamage: rollDice(2, 4),
        damage: 0,
        itemDamage: 0,
        killed: false,
        finished: false,
        ...visibility,
        visible: visibility.inSight,
    };
}
// Port only: identify deferred projectile-trap events.
export function projectileTrapNeedsResume(event) {
    return (event?.kind === 'projectile-trap' ||
        (event?.kind === 'spent-projectile-trap' && !event.finished));
}
// Part of C trap.c:trapeffect_bear_trap(): publish capture and resolve monster damage.
export async function finishMonsterBearTrap(monster, event, state = game, { publish = plineWithContinuation, random = rn2, rollDice = d, describeMonster = target => monsterName(target, { state, capitalized: true }), } = {}) {
    if (!event)
        return event;
    if (event.finished) {
        if (event.forced && event.inSight) {
            await publish(`${describeMonster(monster)} evades ${event.trap.madeby_u ? 'your' : 'a'} bear trap!`);
            await seeTrap(event.trap, state);
        }
        return event;
    }
    if (event.inSight) {
        const owner = event.trap.madeby_u ? 'your' : 'a';
        await publish(`${describeMonster(monster)} is caught in ${owner} bear trap!`);
        await seeTrap(event.trap, state);
    }
    else if (monster.mnum === PM_OWLBEAR || monster.mnum === PM_BUGBEAR) {
        await publishHeardMessage('the roaring of an angry bear!', publish, state);
    }
    if (!monsterWearsIronShoes(monster)) {
        event.damage = rollDice(2, 4);
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - event.damage);
    }
    if (monster.mhp <= 0) {
        const death = await finishMonsterTrapDeath(monster, state, {
            damageType: AD_PHYS,
            random,
            publish,
        });
        event.death = death;
        event.killed = !death.survived;
    }
    event.finished = true;
    return event;
}
// Part of C trap.c:trapeffect_anti_magic(): publish monster energy loss or fatal compression.
export async function finishMonsterAntiMagicTrap(monster, event, state = game, { random = rn2, publish = plineWithContinuation, describeMonster = actor => monsterName(actor, { state, capitalized: true }), } = {}) {
    if (event.energyDrain > 0)
        await publish(`${describeMonster(monster)} seems lethargic.`);
    let death = null;
    if (event.killed) {
        death = await finishMonsterKilled(monster, state, {
            // C uses -AD_MAGM; its sign does not change monkilled's death rules.
            damageType: AD_MAGM,
            cause: event.inSight ? 'compression from an anti-magic field' : null,
            random,
            publish,
        });
        if (death.heroDied)
            return death;
    }
    if (event.kind === 'anti-magic-damage' && event.seeSquare && event.trap && state === game)
        await newsym(event.trap.tx, event.trap.ty);
    return death;
}
// Part of C trap.c:trapeffect_poly_trap(): publish resistance or complete the monster's form change.
export async function finishMonsterPolymorphTrap(event, { publish = async () => { }, finishDeath, state = game, } = {}) {
    if (!event)
        return event;
    if ('shielded' in event) {
        // trap.c trapeffect_poly_trap() -> mon.c:shieldeff_mon(): the
        // shield effect runs whenever the monster's square is visible, and a
        // visible square reports "<mon> resists!".  C reveals the trap only
        // after an actual shape change, so it stays hidden here.
        await shieldeff(event.monster.mx, event.monster.my, state);
        if (event.seeSquare) {
            // mon.c:shieldeff_mon() reports through pline_mon(), which
            // anchors the message at the monster's square.
            set_msg_xy(event.monster.mx, event.monster.my);
            await publish(`${monsterName(event.monster, { state, capitalized: true })} resists!`);
        }
        event.finished = true;
        return event;
    }
    if (event.finished)
        return event;
    const change = await changeMonsterForm(event.monster, null, state, {
        showMessage: true,
        publish,
        polyspot: false,
        ...(finishDeath ? { finishDeath } : {}),
    });
    if (change?.heroDied) {
        event.heroDied = true;
        return event;
    }
    event.changed = !!change;
    event.killed = !!change && !change.selfTouch.survived;
    if (event.inSight) {
        await seeTrap(event.trap, state);
    }
    event.finished = true;
    return event;
}
// Part of C trap.c:trapeffect_landmine(): finish a monster's mine-blast death.
async function finishMineDeath(monster, event, state, options) {
    const death = await finishMonsterTrapDeath(monster, state, {
        damageType: AD_PHYS,
        random: options.random,
        publish: options.publish,
    });
    event.death = death;
    if (!death.survived) {
        event.killed = true;
        return true;
    }
    monster.dead = false;
    return false;
}
// Part of C trap.c:trapeffect_landmine(): force the surviving monster into the new pit.
async function fallIntoMinePit(monster, trap, event, state, options) {
    if (!trap)
        return;
    // The recursive mintrap(FORCETRAP) teaches the new trap type before
    // trapeffect_pit(), including when the victim is immune to the fall.
    monsterLearnsTrap(monster, trap);
    monstersSeeTrap(state, trap);
    const pit = await trapeffectPit(monster, trap, {
        state,
        publish: options.publish,
        random: options.random,
        rollOne: options.rollOne,
        describeMonster: options.describeMonster,
        forced: true,
    });
    if (!pit)
        return;
    if (pit.death)
        event.death = pit.death;
    if (pit.killed)
        event.killed = true;
}
// Part of C trap.c:blow_up_landmine(): resolve liquid exposed by the blast.
async function resolveMineLiquid(monster, state, options) {
    return resolveMonsterLiquid(monster, state, {
        announce: options.publish,
        monsterMoving: true,
        random: options.random,
        finishDeath: async (victim, death) => options.finishDeath(victim, {
            noCorpse: !death.leaveCorpse,
            random: death.random,
            sadFeeling: death.sadFeeling,
            publish: options.publish,
        }),
    });
}
// Part of C trap.c:trapeffect_landmine(): the monster branch — a monster
// lighter than the trigger weight never sets it off, airborne ones rarely
// do, and the blast stages the pit and the kill; an unconscious hero is
// awakened by the explosion (C trap.c:unconscious()).  The hero branch
// (the citation owner) is triggerLandmine() above.
export function beginMonsterLandMine(monster, trap, state = game, { random = rn2, rollOne = rnd } = {}) {
    const visibility = monsterTrapVisibility(monster, state);
    const rawDamage = rollOne(16);
    const damage = monsterWearsIronShoes(monster) ? Math.trunc((rawDamage + 3) / 4) : rawDamage;
    const bodyWeight = MONSTER_BODY_META[monster.mnum]?.[0] ?? 0;
    const triggerWeight = Math.trunc(WT_ELF / 2);
    const triggerRoll = random(Math.max(1, bodyWeight + 1));
    const event = {
        kind: 'land-mine',
        trap,
        damage,
        exploded: false,
        killed: false,
        finished: false,
        airborne: false,
        alreadySeen: !!trap.tseen,
        discoveredTrigger: false,
        ...visibility,
    };
    if (triggerRoll < triggerWeight) {
        event.finished = true;
        return event;
    }
    event.airborne = monsterInAir(monster, state);
    if (event.airborne) {
        event.discoveredTrigger = event.inSight && !trap.tseen;
        // The discovery message can wait for input. Reveal and test the air
        // currents only after that message has returned, as in C.
        if (event.discoveredTrigger)
            return event;
        event.airCurrentRoll = random(3);
        if (event.airCurrentRoll !== 0) {
            event.finished = true;
            return event;
        }
    }
    event.exploded = true;
    return event;
}
// Port only: identify deferred land-mine events.
export function landMineNeedsResume(event) {
    return event?.kind === 'land-mine' && !!(event.exploded || event.discoveredTrigger);
}
// Part of C trap.c:trapeffect_landmine(): finish detonation, damage, the new pit and awakening.
export async function finishMonsterLandMine(monster, event, state = game, { finishDeath, publish = plineWithContinuation, random = rn2, rollOne = rnd, describeMonster = target => canonicalMonsterName(target, { state, capitalized: true }), forceTrapAtMonster, } = {}) {
    if (event.finished)
        return event;
    if (typeof finishDeath !== 'function')
        throw new TypeError('land mine requires the monster death handler');
    if (typeof forceTrapAtMonster !== 'function')
        throw new TypeError('land mine requires the forced monster trap handler');
    const options = {
        finishDeath,
        publish,
        random,
        rollOne,
        describeMonster,
    };
    if (event.discoveredTrigger) {
        await publish(`A trigger appears in a pile of soil below ${canonicalMonsterName(monster, { state })}.`);
        await seeTrap(event.trap, state);
        event.airCurrentRoll = random(3);
        event.exploded = event.airCurrentRoll === 0;
    }
    if (!event.exploded) {
        event.finished = true;
        return event;
    }
    // Native redraws the visible victim before the detonation message can
    // pause for input, including monsters seen only through infravision.
    if (event.inSight)
        await newsym(monster.mx, monster.my);
    if (event.airborne && event.inSight) {
        await publish(`The air currents set ${event.alreadySeen ? 'a land mine' : 'it'} off!`);
    }
    else if (event.inSight) {
        const blast = state.u?.deaf || state.deaf ? '' : 'KAABLAMM!!!  ';
        await publish(`${blast}${describeMonster(monster)} triggers ${event.trap.madeby_u ? 'your' : 'a'} land mine!`);
    }
    else if (!state.u?.deaf && !state.deaf) {
        await publish('Kaablamm!  You hear an explosion in the distance!');
    }
    const pit = await explodeLandMine(event.trap, state, {
        publish,
        random,
        rollOne,
        seeSquare: event.seeSquare,
        finishMonsterDeath: finishDeath,
        resolveLiquid: () => resolveMineLiquid(monster, state, options),
    });
    if (state.program_state.gameover)
        return event;
    if (monster.dead || (monster.mhp ?? 0) <= 0 || !state.level?.monsters?.includes(monster)) {
        event.killed = !!monster.dead || (monster.mhp ?? 0) <= 0;
    }
    else {
        // thitm() hurts the victim even when the blast's liquid relocated it;
        // the recursive mintrap(FORCETRAP) then uses its current square.
        monster.mhp = Math.max(0, (monster.mhp ?? 1) - event.damage);
        const died = monster.mhp <= 0 && await finishMineDeath(monster, event, state, options);
        if (event.death?.heroDied)
            return event;
        if (!died) {
            if (monster.mx === event.trap.tx && monster.my === event.trap.ty)
                await fallIntoMinePit(monster, pit, event, state, options);
            else
                await forceTrapAtMonster(monster);
            if (event.death?.heroDied || state.program_state.gameover)
                return event;
            event.killed = !!monster.dead || (monster.mhp ?? 0) <= 0;
        }
    }
    // C fills the new pit whether or not the victim survived, then cuts
    // short a sleeping or fainted hero's helplessness.
    await fillPitWithBoulderAt(event.trap.tx, event.trap.ty, state, { publish });
    if (heroIsUnconscious(state)) {
        setMulti(-1, state);
        state._helplessDoneMessage = 'The explosion awakens you!';
    }
    event.finished = true;
    return event;
}
// Part of C trap.c:trapeffect_vibrating_square(): publish a monster's vibration feedback.
export async function finishMonsterVibratingSquare(monster, event, { state = game, publish = async () => { }, } = {}) {
    if (!event || event.finished)
        return event;
    await seeTrap(event.trap, state);
    if (!event.inSight) {
        await publish(formatSeenMessage(`the ground vibrate ${event.nearby ? 'nearby' : 'in the distance'}.`));
    }
    else {
        const subject = monsterName(monster, { state });
        const location = event.wholeBody
            ? subject
            : `${possessive(subject)} ${makePlural(mbodypart(monster.mnum, FOOT).replace(/^rear /u, ''))}`;
        await publish(formatSeenMessage(`a strange vibration beneath ${location}.`));
    }
    event.finished = true;
    return event;
}
// Part of C trap.c:trapeffect_web(): catch a monster or tear through its web.
export async function finishMonsterWebTrap(monster, trap, { state = game, publish = plineWithContinuation, subject = () => monsterName(monster, { capitalized: true, state }), } = {}) {
    const species = MONSTER_NAME[monster.mnum];
    if (species === 'cave spider' || species === 'giant spider')
        return;
    const visible = monster === state.u.usteed || canSeeMonster(monster);
    if (await maybeDestroyWeb(monster, trap, { state, message: visible, publish }))
        return;
    const hiddenBear = !visible && (species === 'owlbear' || species === 'bugbear');
    const tear = !hiddenBear &&
        (WEB_TEARERS.has(monster.mnum) ||
            MONSTER_SYMBOL[monster.mnum] === S_GIANT ||
            (MONSTER_SYMBOL[monster.mnum] === S_DRAGON &&
                extra_nasty(monster.mnum)) ||
            (!!monster.wormno && (monster.wormSegments?.length || 0) > 5));
    const owner = trap.madeby_u ? 'your' : 'a';
    if (hiddenBear) {
        await publishHeardMessage('the roaring of a confused bear!', publish, state);
    }
    else if (visible) {
        const name = typeof subject === 'function' ? subject(monster) : subject;
        if (tear) {
            await publish(`${name} tears through ${owner} spider web!`);
        }
        else {
            await publish(`${name} is caught in ${owner} spider web.`);
            await seeTrap(trap, state);
        }
    }
    monster.mtrapped = tear ? 0 : 1;
    if (tear) {
        deleteTrap(trap, state);
        await newsym(monster.mx, monster.my);
    }
}
// C trap.c:instapetrify()
export async function resolveImmediatePetrification({ state = game, killer, publish = plineWithContinuation, die = finishHeroDeath, }) {
    // C trap.c:instapetrify() is a no-op for a stoning-resistant hero.
    if (heroResistsStoning(state))
        return { died: false, transformed: false };
    if (formCanBecomeStoneGolem(state.u.umonnum, state)) {
        const result = await polymonHero(PM_STONE_GOLEM);
        if (result.transformed || result.died)
            return { died: !!result.died, transformed: !!result.transformed };
    }
    await publish('You turn to stone...');
    const died = await die({
        killer,
        killerFormat: KILLED_BY,
        deathVerb: 'turned to stone',
        deathLineShown: true,
        deathType: STONING,
    });
    return { died: !!died, transformed: false };
}
// C trap.c:minstapetrify(). Apply resistance, transformations, slowing, and lethal petrification.
export async function petrifyMonsterImmediately(monster, { creditHero = false, finishDeath, publish = plineWithContinuation, } = {}) {
    if (!monster || monster.dead || (monster.mhp ?? 1) <= 0)
        return { changed: false, survived: false };
    if (monsterHasStoneResistance(monster))
        return { changed: false, survived: true };
    const stoneForm = await turnGolemToStone(monster, publish);
    if (stoneForm?.heroDied)
        return { heroDied: true };
    if (stoneForm)
        return { changed: true, survived: true };
    const restored = await restoreShapechanger(monster, publish);
    if (restored?.heroDied)
        return { heroDied: true };
    if (restored)
        return { changed: true, survived: true };
    const speed = adjustMonsterSpeed(monster, -3);
    // worn.c:mon_adjust_speed() needs sight of the actor. The following
    // minstapetrify() message only needs sight of its square; that difference
    // matters when the hero is inside this monster.
    if (!game.in_mklev && game.flags.verbose !== false
        && speed.canDescribe && canSeeMonster(monster)) {
        const speedMessage = monsterSpeedMessage(speed, monsterSubject(monster));
        if (speedMessage)
            await publish(speedMessage);
    }
    if (cansee(monster.mx, monster.my)) {
        await publish(`${monsterSubject(monster)} turns to stone.`);
    }
    if (creditHero)
        recordHeroKillConduct();
    const x = monster.mx, y = monster.my;
    const result = await finishMonsterPetrification(monster, { finishDeath, publish });
    // xkilled() reports unseen recovery even though monstone() has already
    // returned without handing a surviving monster to the death handler.
    if (creditHero && result.survived && !cansee(x, y))
        await publish('Maybe not...');
    return result;
}
// C trap.c:selftouch(). Check both wielded corpse slots after resistance is lost.
export async function selfTouchPetrifyingWeapons({ messageStart = 'No longer petrify-resistant, you', state = game, publish = pline, die = finishHeroDeath, } = {}) {
    if (heroResistsStoning(state))
        return { touched: false, died: false };
    let touched = false;
    for (let slot = 0; slot < 2; slot++) {
        const weapon = slot === 0
            ? state.uwep || state.u?.uwep
            : state.u?.twoweap
                ? state.uswapwep || state.u?.uswapwep : null;
        if (weapon?.otyp !== CORPSE || !touchPetrifies(weapon.corpsenm))
            continue;
        touched = true;
        // C trap.c:selftouch() names the species with obj_pmname(), not
        // corpse_xname(), so unique and personal species stay unadorned.
        const species = objectMonsterName(weapon);
        await publish(`${messageStart} touch the ${species} corpse.`);
        const result = await resolveImmediatePetrification({
            killer: `${withIndefiniteArticle(species)} corpse`,
            state, publish, die,
        });
        if (result.died)
            return { touched: true, died: true };
        if (!(state.uarmg || state.u?.uarmg) && !heroResistsStoning(state)) {
            // C trap.c:selftouch() unwields through the gone() family.
            if (slot === 0)
                await uwepgone(state);
            else
                await uswapwepgone(state);
        }
    }
    return { touched, died: false };
}
// C trap.c:mselftouch(). Falling can force contact even through gloves;
// newcham() only calls this after the new body has lost its gloves.
export async function monsterSelfTouch(monster, { prefix = '', creditHero = false, finishDeath, publish = plineWithContinuation, state = game, } = {}) {
    const corpse = monsterWieldedWeapon(monster);
    if (!corpse || corpse.otyp !== CORPSE || corpse.corpsenm === undefined
        || !touchPetrifies(corpse.corpsenm)
        || monsterHasStoneResistance(monster)) {
        return { touched: false, survived: true };
    }
    if (cansee(monster.mx, monster.my)) {
        await publish(`${prefix}${selfTouchSubject(monster, prefix)} touches ${corpseName(corpse, { definite: true })}.`);
    }
    const petrification = await petrifyMonsterImmediately(monster, {
        creditHero, finishDeath, publish,
    });
    if (petrification.survived && !monsterWearsGloves(monster)
        && !monsterHasStoneResistance(monster)) {
        await unwieldMonsterWeapon(monster, state, { publish });
    }
    return { touched: true, corpse, ...petrification };
}
// Part of C trap.c:mselftouch() and minstapetrify(): the W_ARMG gloves
// test.  Falling can force contact even through gloves; newcham() only
// calls mselftouch() after the new body has lost its gloves.
export function monsterWearsGloves(monster) {
    return !!((monster?.misc_worn_check ?? 0) & W_ARMG)
        || (monster?.minvent || monster?.inventory || []).some(object => ((object.owornmask ?? 0) & W_ARMG) !== 0);
}
// Part of C trap.c:mselftouch(): adjust the monster subject after an introductory phrase.
function selfTouchSubject(monster, prefix) {
    const subject = monsterSubject(monster);
    if (!prefix || monster.name)
        return subject;
    return subject.charAt(0).toLowerCase() + subject.slice(1);
}
// C trap.c:float_up()
export async function floatHeroUp(state = game, previous = null) {
    // World transitions (trap triggers, pickups, level changes) must run on
    // the live singleton; pure property snapshots keep an injected state.
    requireLiveGame(state);
    state.context.botl = true;
    const hero = state.u;
    // Wearing a levitation source suppresses Flying before this runs, so the
    // flight-loss feedback reads the pre-wear snapshot when the caller
    // captured one (properties.js:captureLevitationState()).
    const wasFlying = previous ? previous.flying : !!hero.flying;
    if (hero.utrap) {
        if (hero.utraptype === TT_PIT) {
            await resetUtrap(false, state);
            await plineWithContinuation(`You float up, out of the ${trapName(PIT, { state })}!`);
            state.vision_full_recalc = 1;
            await fillPitWithBoulderAt(hero.ux, hero.uy, state);
        }
        else if (hero.utraptype === TT_LAVA || hero.utraptype === TT_INFLOOR) {
            await plineWithContinuation(`Your body pulls upward, but your ${makePlural(body_part(LEG, state))} are still stuck.`);
        }
        else if (hero.utraptype === TT_BURIEDBALL) {
            const ball = buriedBallNear(hero.ux, hero.uy, state);
            const terrain = requireGameLevel(state).requireAt(ball?.ox ?? hero.ux, ball?.oy ?? hero.uy);
            await plineWithContinuation(`You feel lighter, but your ${body_part(LEG, state)} is still chained to the ${IS_ROOM(terrain.typ) ? 'floor' : 'ground'}.`);
        }
        else if (hero.utraptype === WEB) {
            // C float_up() compares with WEB, not the hero restraint TT_WEB.
            await plineWithContinuation(`You float up slightly, but you are still stuck in the ${trapName(WEB, { state })}.`);
        }
        else {
            await plineWithContinuation(`You float up slightly, but your ${body_part(LEG, state)} is still stuck.`);
        }
    }
    else if (hero.uinwater) {
        // C float_up() (trap.c:3975) calls spoteffects(TRUE): leaving the
        // water on the way up does consider autopickup.
        await applyHeroLocationEffects();
    }
    else if (hero.uswallow) {
        if (!hero.ustuck)
            throw new Error('A swallowed hero must have a swallowing monster.');
        await plineWithContinuation(monsterIsAnimal(hero.ustuck)
            ? `You float away from the ${surfaceName(hero.ux, hero.uy, state)}.`
            : `You spiral up into ${holdingMonsterName(hero.ustuck, state)}.`);
    }
    else if (heroIsHallucinating(state)) {
        await plineWithContinuation("Up, up, and awaaaay!  You're walking on air!");
    }
    else if (Is_airlevel(hero.uz)) {
        await plineWithContinuation('You gain control over your movements.');
    }
    else {
        await plineWithContinuation('You start to float in the air!');
    }
    const steed = hero.usteed;
    if (steed && !monsterIsFloater(steed.mnum)
        && !monsterIsFlyer(steed.mnum)) {
        if (levitationAtWill(state)) {
            await plineWithContinuation(`${holdingMonsterSubject(steed, state)} magically floats up!`);
        }
        else {
            await plineWithContinuation(`You cannot stay on ${holdingMonsterName(steed, state)}.`);
            await dismountHero(DISMOUNT_GENERIC, { state });
        }
    }
    if (wasFlying)
        await plineWithContinuation('You are no longer able to control your flight.');
    // C float_up() ends with float_vs_flight() (trap.c:4001), which also
    // requests the status repaint.
    floatVsFlight(state);
    await encumber_msg(state);
}
// C trap.c:fill_pit() and do.c:flooreffects()'s boulder/pit branch.
// C trap.c:fill_pit()
export async function fillPitWithBoulderAt(x, y, state = game, { publish = plineWithContinuation, } = {}) {
    requireLiveGame(state);
    const level = requireGameLevel(state);
    const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y
        && (is_pit(candidate.ttyp) || is_hole(candidate.ttyp)));
    const boulder = level.objects[x]?.[y]?.find(object => object.otyp === BOULDER);
    if (!trap || !boulder)
        return { filled: false, trap: trap || null, boulder: boulder || null, buriedFloorObjects: [] };
    // Extraction prevents a monster's death from finding this same boulder
    // recursively when departure cleanup tries to fill its pit.
    unlinkObject(boulder, state);
    const result = await applyFloorEffects(boulder, x, y, { state, publish, verb: 'settle' });
    return {
        filled: !level.traps.includes(trap), trap, boulder,
        buriedFloorObjects: result.buriedFloorObjects || [],
        heroDied: !!result.heroDied || !!state.program_state.gameover,
    };
}
// C trap.c:float_down()
// The raw C bitmask arguments hmask and emask are kept:
// hmask clears intrinsic levitation (TIMEOUT zeroes the timeout, I_SPECIAL
// drops the blessed-potion at-will marker), emask clears extrinsic levitation
// (W_ARTI the invoked artifact; W_SADDLE is never stored in this model — the
// steed contributes through live u.usteed flags — and only suppresses the
// landing message below).  W_ART clears the carried source which keeps the
// hero aloft until a dropped invoked artifact reaches the floor.
// Equipment setters which already removed the worn source pass a
// captureLevitationState() snapshot as `previous`; without one the pre-clear
// state is captured at entry, before the masks above are applied.
export async function floatHeroDown(hmask = 0, emask = 0, state = game, previous = null) {
    // World transitions (liquid entries, trap triggers, pickups, level
    // changes) must run on the live singleton; this guard fires before any
    // property source or mask mutation.
    requireLiveGame(state);
    const hero = state.u;
    const before = previous ?? captureLevitationState(state);
    clearLevitationMasks(hmask, emask, state);
    if (propertyIsActive('levitation', state))
        return 0; // maybe another ring/potion/boots
    if (before.blockedByTerrain || before.blockedByTrap) {
        state.context.botl = true; // float_vs_flight() precedes its feedback.
        // C BLevitation: never actually levitating, so no landing effects.
        // Only a sole floor-trap hold (C BLevitation == I_SPECIAL) speaks.
        const trappedSolely = before.blockedByTrap
            && !before.blockedByTerrain && hero.utrap;
        const hold = hero.utraptype === TT_BEARTRAP ? "trap's jaws"
            : hero.utraptype === TT_WEB ? 'web'
                : hero.utraptype === TT_BURIEDBALL ? 'chain'
                    : hero.utraptype === TT_LAVA ? 'lava'
                        : 'ground'; // TT_INFLOOR
        if (trappedSolely) {
            await plineWithContinuation(`You are no longer trying to float up from the ${hold}.`);
        }
        floatVsFlight(state);
        await encumber_msg(state);
        return 0;
    }
    state.context.botl = true;
    endVoluntaryMultiTurn(state); // C nomul(0)
    if (before.flyingBlocked) {
        // controlled flight is no longer overridden by levitation
        floatVsFlight(state);
        if (propertyIsActive('flying', state)) {
            await plineWithContinuation('You have stopped levitating and are now flying.');
            await encumber_msg(state);
            return 1;
        }
    }
    if (hero.uswallow) {
        await plineWithContinuation(`You float down, but you are still ${monsterDigests(hero.ustuck) ? 'swallowed' : 'engulfed'}.`);
        refreshMovementProperties(state);
        await encumber_msg(state);
        return 1;
    }
    let ballTrap = null;
    if (heroIsPunished(state)) {
        const ball = state.uball || hero.uball;
        const chain = state.uchain || hero.uchain;
        if (ball && chain && ball.where !== 'inventory'
            && !requireGameLevel(state).monsters.some(monster => monsterHasMapPosition(monster, state) &&
                !monster.dead && monster.mx === ball.ox && monster.my === ball.oy)) {
            // C: is_pool() short-circuits before t_at(), so the trap under
            // the ball only exists as a pull target when it is a pit or hole.
            const ballPool = isPoolAt(ball.ox, ball.oy, state);
            const trapUnderBall = ballPool ? null
                : requireGameLevel(state).traps.find(candidate => candidate.tx === ball.ox && candidate.ty === ball.oy) || null;
            if (ballPool || (trapUnderBall
                && (is_pit(trapUnderBall.ttyp) || is_hole(trapUnderBall.ttyp)))) {
                ballTrap = trapUnderBall;
                hero.ux0 = hero.ux;
                hero.uy0 = hero.uy;
                hero.ux = ball.ox;
                hero.uy = ball.oy;
                // C movobj(uchain, uball->ox, uball->oy): shared owner
                // handles the pile unlink/relink, maybe_unhide_at, and
                // both newsym calls
                await moveObject(chain, ball.ox, ball.oy, state);
                await newsym(hero.ux0, hero.uy0);
                state.vision_full_recalc = 1; // in case the hero moved
            }
        }
    }
    let noMsg = false;
    if (!propertyIsActive('flying', state)) {
        if (!hero.uswallow && hero.ustuck) {
            if (heroFormSticks(state)) {
                await plineWithContinuation(`You aren't able to maintain your hold on ${holdingMonsterName(hero.ustuck, state)}.`);
            }
            else {
                await plineWithContinuation(`Startled, ${holdingMonsterName(hero.ustuck, state)} can no longer hold you!`);
            }
            setHeroGrip(null, state);
        }
        // C calls drown() and lava_effects() directly, bypassing
        // spoteffects().  Both entries run through the complete production
        // liquid owner (real teleport chooser, fire inventory handling,
        // landing spot effects); drown()'s relocations land via teleds'
        // spoteffects(TRUE) (teleport.c:568).  Either entry can kill the
        // hero (drowning, burning to a crisp); a dead hero gets no landing
        // message, trap activation, or autopickup.
        // C Wwalking macro: the boots do not count on the Plane of Water.
        if (isPoolAt(hero.ux, hero.uy, state)
            && !(heroHasWaterWalking(state) && !Is_waterlevel(hero.uz))
            && !heroCanSwim(state) && !hero.uinwater) {
            const liquid = await applyHeroLiquidEffects(plineWithContinuation, { entry: 'float-down' });
            if (liquid?.died || state.program_state?.gameover)
                return 1;
            noMsg = !!liquid?.moved; // C drown(): TRUE after relocation or rescue
        }
        const location = requireGameLevel(state).requireAt(hero.ux, hero.uy);
        if (isLavaAt(hero.ux, hero.uy, state) && !state.iflags?.in_lava_effects) {
            const lava = await applyHeroLiquidEffects(plineWithContinuation, { entry: 'float-down' });
            if (lava?.died || state.program_state?.gameover)
                return 1;
            noMsg = true;
        }
    }
    let trap = ballTrap;
    if (!trap) {
        trap = requireGameLevel(state).traps.find(candidate => candidate.tx === hero.ux && candidate.ty === hero.uy) || null;
        if (Is_airlevel(hero.uz)) {
            await plineWithContinuation('You begin to tumble in place.');
        }
        else if (Is_waterlevel(hero.uz) && !noMsg) {
            await plineWithContinuation(formatFeltMessage('heavier.', state));
            /* u.uinwater messages already in spoteffects()/drown() */
        }
        else if (!hero.uinwater && !noMsg && !(emask & W_SADDLE)) {
            if (requireGameLevel(state).flags.sokoban_rules && trap) {
                // Sokoban air currents knock the ending levitator off her feet.
                if (heroIsHallucinating(state)) {
                    await plineWithContinuation("Bummer!  You've crashed.");
                }
                else {
                    await plineWithContinuation('You fall over.');
                }
                if (await loseHeroHp(rnd(2), 'dangerous winds', { state }))
                    return 1;
                if (hero.usteed) {
                    const dismount = await dismountHero(DISMOUNT_FELL, { state });
                    if (dismount.died || state.program_state?.gameover)
                        return 1;
                }
                const contact = await selfTouchPetrifyingWeapons({
                    messageStart: 'As you fall, you', state,
                });
                if (contact.died)
                    return 1;
            }
            else if (hero.usteed && !steedIsGrounded(hero.usteed, state)) {
                await plineWithContinuation('You settle more firmly in the saddle.');
            }
            else if (heroIsHallucinating(state)) {
                await plineWithContinuation(`Bummer!  You've ${isPoolAt(hero.ux, hero.uy, state)
                    ? 'splashed down' : 'hit the ground'}.`);
            }
            else {
                await plineWithContinuation(`You float gently to the ${surfaceName(hero.ux, hero.uy, state)}.`);
            }
        }
    }
    // Levitation gives maximum carrying capacity, so having it end can raise
    // encumbrance: after the landing messages, before traps and autopickup.
    refreshMovementProperties(state);
    await encumber_msg(state);
    // Falling through a trap door changes the level before this returns.
    const levelBefore = { dnum: hero.uz?.dnum, dlevel: hero.uz?.dlevel };
    if (trap && trap.ttyp !== STATUE_TRAP) {
        const hole = trap.ttyp === HOLE || trap.ttyp === TRAPDOOR;
        const blocked = hole && (!canFallThrough(hero.uz) || hero.ustuck);
        if (!blocked && !hero.utrap) { // not already in the trap
            const result = await dotrap(trap, {
                finishTeleport: finishTeleportArrival, gotoLevel,
            });
            if (result.died)
                return 1;
        }
    }
    if (!Is_airlevel(hero.uz) && !Is_waterlevel(hero.uz) && !hero.uswallow
        && hero.uz?.dnum === levelBefore.dnum
        && hero.uz?.dlevel === levelBefore.dlevel)
        await autopickupAtHero();
    return 1;
}
// Part of C trap.c:float_down() and float_up(): both read the stored
// HLevitation/ELevitation/BLevitation/BFlying masks before any caller
// removes a levitation source.  Equipment and effect setters refresh the
// derived state while removing that source, so they snapshot first and
// pass the result through the landing owner's `previous` argument.  Both
// blocked bits are captured separately: terrain and a floor trap can
// block levitation at the same time, and only a sole floor-trap block
// (C BLevitation == I_SPECIAL) gets feedback.
export function captureLevitationState(state = game) {
    const hasSource = propertySourceIsActive('levitation', state);
    const record = existingPropertyRecord('levitation', state);
    return {
        // HLevitation || ELevitation
        hasSource,
        // Levitation macro: sources and not blocked
        active: propertyIsActive('levitation', state),
        // BLevitation FROMOUTSIDE: solid rock or a wall of water
        blockedByTerrain: !!record?.blockedByTerrain,
        // BLevitation I_SPECIAL: the stored floor-trap hold float_vs_flight()
        // left behind (C reads the mask, not u.utrap)
        blockedByTrap: !!record?.blockedByFloat,
        // Flying macro
        flying: propertyIsActive('flying', state),
        // BFlying: flight suppressed by levitation or a floor trap
        flyingBlocked: propertyIsBlocked('flying', state),
    };
}
// C trap.c:climb_pit()
export async function climbOutOfPit() {
    requirePlayingGame(game);
    const hero = game.u;
    if (!hero.utrap || hero.utraptype !== TT_PIT)
        return;
    const pit = trapName(PIT);
    if (heroPassesWalls()) {
        await pline(`You ascend from the ${pit}.`);
        await resetUtrap(false);
        await fillHeroPitWithBoulder();
        game.vision_full_recalc = 1;
        return;
    }
    const creviceRoll = rn2(2);
    if (creviceRoll === 0 && objectAtHero(BOULDER)) {
        await plineWithContinuation(`Your ${body_part(LEG, game)} gets stuck in a crevice.`);
        await pline(`You free your ${body_part(LEG, game)}.`);
        return;
    }
    const canLeaveByAir = hero.flying || game.flying
        || monsterIsClinger(heroMonsterForm() ?? -1);
    if (canLeaveByAir && !game.level?.flags?.sokoban_rules) {
        const locomotion = heroLocomotion('climb');
        await pline(`You ${locomotion} from the ${pit}.`);
        await resetUtrap(false);
        await fillHeroPitWithBoulder();
        game.vision_full_recalc = 1;
        return;
    }
    if (reduceHeroTrapDuration() <= 0 || escapesPitEasily(heroMonsterForm())) {
        await resetUtrap(false);
        const locomotion = game.level.flags.sokoban_rules && hero.levitating
            ? 'struggle against the air currents and float' : hero.usteed ? 'ride' : 'crawl';
        await pline(`You ${locomotion} to the edge of the ${pit}.`);
        await fillHeroPitWithBoulder();
        game.vision_full_recalc = 1;
        return;
    }
    // C trap.c:4224-4228 Norep(): climb_pit() suppresses an immediate repeat
    // without side effects; { noRepeat: true } is pline.c's Norep flag.
    if (hero.dz || game.flags?.verbose !== false) {
        if (hero.usteed) {
            await plineWithContinuation(`${monsterName(hero.usteed, {
                article: 'your', capitalized: true, suppressSaddle: true,
            })} is still in a pit.`, { noRepeat: true });
            return;
        }
        const hallucinating = heroIsHallucinating(game);
        const message = hallucinating && rn2(5) === 0
            ? "You've fallen, and you can't get up."
            : 'You are still in a pit.';
        await plineWithContinuation(message, { noRepeat: true });
    }
}
// Port only: require and decrement the hero's active restraint duration.
export function reduceHeroTrapDuration() {
    const hero = game.u;
    if (hero.utrap === undefined)
        throw new Error('An active hero trap requires a remaining duration.');
    return --hero.utrap;
}
// Part of C trap.c:climb_pit(): fill the hero's vacated pit.
async function fillHeroPitWithBoulder() {
    await fillPitWithBoulderAt(game.u.ux, game.u.uy);
}
// C trap.c:dofiretrap(): the flame effect shared by floor fire traps and
// trapped containers — steam under water, the tower of flame, resistance,
// and the burning of the hero, possessions, floor objects, and ice; the
// maximum-HP burn calls C attrib.c:minuhpmax()/setuhpmax()
// (reduceHeroMaximumHitPoints).
export async function triggerHeroFireTrap(box = null, { publish = plineWithContinuation } = {}) {
    const hero = game.u;
    requireInitializedHero(hero);
    const couldSeeFire = !heroIsBlind();
    const originalDamage = d(2, 4);
    if (box && couldSeeFire)
        observeObject(box);
    const source = box ? objectName(box) : surfaceName(hero.ux, hero.uy);
    const underwater = box && box.where !== 'inventory'
        ? isPoolAt(box.ox, box.oy)
        : !!(game.underwater || hero.uinwater);
    if (underwater) {
        await publish(`A cascade of steamy bubbles erupts from the ${source}!`);
        if (heroResistsFire())
            await publish('You are uninjured.');
        else if (await loseHeroHp(rnd(3), 'boiling water', {
            publish,
            deathCause: 'killed by boiling water',
        }))
            return { died: true };
        return { died: false };
    }
    await publish(`A tower of flame ${box ? 'bursts' : 'erupts'} from the ${source}!`);
    let damage = originalDamage;
    if (heroResistsFire()) {
        await shieldeff(hero.ux, hero.uy);
        monstersObserveHeroResistance(M_SEEN_FIRE);
        damage = rn2(2);
    }
    else if (Upolyd(hero)) {
        damage = Math.max(damage, golemFireDamage(hero.umonnum, hero.mhmax));
        reduceMonsterFormMaximumHitPoints(hero, damage);
        monstersForgetHeroResistance(M_SEEN_FIRE);
    }
    else {
        damage = d(2, 4);
        if (await reduceHeroMaximumHitPoints(hero, damage, publish))
            return { died: true };
        monstersForgetHeroResistance(M_SEEN_FIRE);
    }
    const burned = await burnHeroAndPossessions(damage, originalDamage, publish);
    if (burned.died)
        return burned;
    await burnFloorAndIce(box, couldSeeFire, publish);
    return { died: !!game.program_state.gameover };
}
// Port only: invoke shared armor burning for the live hero.
export function burnHeroArmorByFire(state, emitMessage, calls = [], random = rn2) {
    return burnArmorByFire(state.u, state, emitMessage, calls, random);
}
const PM_STRAW_GOLEM = 249;
const PM_PAPER_GOLEM = 250;
const PM_LEATHER_GOLEM = 253;
const PM_WOOD_GOLEM = 254;
// Port only: combine hero fire resistance with wielded artifact defense.
function heroResistsFire() {
    return !!game.u.fireResistance || heroHasArtifactDefense('fire');
}
// Part of C trap.c:dofiretrap(): reduce the burning hero form's maximum health.
function reduceMonsterFormMaximumHitPoints(hero, damage) {
    const formLevel = MONSTER_LEVEL[hero.umonnum] ?? 0;
    if ((hero.mhmax ?? 1) > formLevel) {
        const range = Math.min(hero.mhmax, damage + 1);
        hero.mhmax -= rn2(range);
    }
    hero.mh = Math.min(hero.mh ?? hero.mhmax, hero.mhmax);
}
// Part of C trap.c:dofiretrap(): reduce maximum hero health after severe burns.
async function reduceHeroMaximumHitPoints(hero, damage, publish) {
    const oldMaximum = hero.uhpmax ?? 1;
    const minimum = minHeroMaxHitPoints(1, game);
    if (hero.uhpmax > minimum) {
        const range = Math.min(hero.uhpmax, damage + 1);
        hero.uhpmax -= rn2(range);
    }
    if (hero.uhpmax < minimum) {
        hero.uhpmax = Math.min(oldMaximum, minimum);
        if (!heroHasDrainResistance(game) && await loseHeroExperience(null, { publish }))
            return true;
    }
    hero.uhp = Math.min(hero.uhp ?? hero.uhpmax, hero.uhpmax);
    return false;
}
// Part of C trap.c:dofiretrap(): damage the hero, remove slime and burn carried gear.
async function burnHeroAndPossessions(damage, originalDamage, publish) {
    if (!damage)
        await publish('You are uninjured.');
    else if (await loseHeroHp(damage, 'tower of flame', { publish }))
        return { died: true };
    await burnAwayHeroSlime(game, publish);
    const torsoChecked = await burnHeroArmorByFire(game, publish, [], rn2);
    if (torsoChecked || rn2(3) !== 0) {
        const items = await destroyFireInventory(originalDamage, { publish });
        if (items.heroDied)
            return { died: true };
        await igniteItems(game.inventory, {
            state: game,
            publish,
        });
    }
    return { died: false };
}
// Part of C trap.c:dofiretrap(): burn floor objects and melt the hero's ice square.
async function burnFloorAndIce(box, couldSeeFire, publish) {
    const hero = game.u;
    if (!box) {
        const burned = await burnFloorObjectsAt(hero.ux, hero.uy, {
            state: game,
            giveFeedback: couldSeeFire,
            publish,
        });
        if (burned && !couldSeeFire)
            await publish('You smell paper burning.');
    }
    if (isIceAt(hero.ux, hero.uy))
        await meltIce(hero.ux, hero.uy);
}
// C trap.c:domagictrap(): the hero's magic-trap outcomes — the 1-in-2
// monster-summoning flash and roar, or the fate table for blindness,
// invisibility, paralysis, and the rest.
export async function triggerHeroMagicTrapEffect() {
    requirePlayingGame(game);
    const currentLevel = game.u.uz;
    const fate = rnd(20);
    if (fate < 10) {
        const count = rnd(4);
        if (!resistsBlnd({ youmonst: true }, game)) {
            await plineWithContinuation('You are momentarily blinded by a flash of light!');
            await makeBlinded(rn1(5, 10), { talk: false });
            if (!heroIsBlind(game))
                await plineWithContinuation('Your vision clears.');
        }
        else if (!heroIsBlind(game)) {
            await plineWithContinuation(formatSeenMessage('a flash of light!'));
        }
        if (!heroIsDeaf(game)) {
            await hear('a deafening roar!');
            await makeDeaf((game.u.deafTurns ?? 0) + rn1(20, 30), { talk: false });
        }
        else {
            await plineWithContinuation(formatFeltMessage('rankled.'));
            await makeDeaf((game.u.deafTurns ?? 0) + rn1(5, 15), { talk: false });
        }
        for (let i = 0; i < count; i++)
            await makemonAt(null, game.u.ux, game.u.uy);
        await wakeMonstersNearWithMessages(game.u.ux, game.u.uy, 49, game);
        return;
    }
    switch (fate) {
        case 10:
            return;
        case 11:
            await toggleIntrinsicInvisibility();
            return;
        case 12:
            await triggerHeroFireTrap();
            return;
        case 13:
            await plineWithContinuation(`A shiver runs up and down your ${body_part(SPINE)}!`);
            return;
        case 14:
            await hear(heroIsHallucinating(game) ? 'the moon howling at you.' : 'distant howling.');
            return;
        case 15:
            if (onQuestStart(game)) {
                const neuter = Upolyd(game.u)
                    && is_neuter(heroSpecies(game));
                await plineWithContinuation(formatFeltMessage(`${game.flags.female || neuter ? 'oddly ' : ''}like the prodigal son.`));
            }
            else {
                const quest = game.dungeons.findIndex(dungeon => dungeon.dname === 'The Quest');
                const atEntrance = game.branches.some(branch => branch.end2.dnum === quest
                    && branch.end1.dnum === currentLevel.dnum && branch.end1.dlevel === currentLevel.dlevel);
                const homeland = heroIsHallucinating(game) ? 'Cleveland'
                    : In_quest(game.u.uz) || atEntrance ? 'your nearby homeland' : 'your distant homeland';
                await plineWithContinuation(`You suddenly yearn for ${homeland}.`);
            }
            return;
        case 16:
            await plineWithContinuation('Your pack shakes violently!');
            return;
        case 17:
            await plineWithContinuation(heroIsHallucinating(game) ? 'You smell hamburgers.' : 'You smell charred flesh.');
            return;
        case 18:
            await plineWithContinuation(formatFeltMessage('tired.'));
            return;
        case 19: {
            const change = adjustAttribute(A_CHA, 1);
            if (change.changed || game.flags.verbose) {
                const message = attributeChangeMessage(A_CHA, change);
                if (message)
                    await plineWithContinuation(message);
            }
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    const x = game.u.ux + dx, y = game.u.uy + dy;
                    if (!isok(x, y))
                        continue;
                    const monster = monsterAtPosition(game.level, x, y);
                    if (monster)
                        await tameMonster(monster, null, { announce: true });
                }
            }
            return;
        }
        case 20: {
            const confusion = game.u.confusionTurns;
            game.u.confusionTurns = 0;
            try {
                await applyRemoveCurseSpell();
            }
            finally {
                if (confusion === undefined)
                    delete game.u.confusionTurns;
                else
                    game.u.confusionTurns = confusion;
            }
            return;
        }
        default:
            return;
    }
}
// Part of C trap.c:domagictrap(): toggle intrinsic invisibility with its feedback.
async function toggleIntrinsicInvisibility() {
    await hear('a low hum.');
    const intrinsic = hasInternalInvisibility(game);
    const other = hasIntrinsicProperty('invisible', 'form', game)
        || hasWornProperty('invisible', game) || hasCarriedProperty('invisible', null, game)
        || hasInvokedProperty('invisible', game);
    if (!intrinsic && !other) {
        if (!heroIsBlind(game))
            await showInvisibilityMessage(game);
    }
    else if (!other) {
        if (!heroIsBlind(game))
            await plineWithContinuation(game.u.seeInvisible
                ? "You can't see through yourself anymore." : 'You can see yourself again!');
    }
    else {
        await plineWithContinuation(formatFeltMessage(`a little more ${intrinsic ? 'obvious' : 'hidden'} now.`));
    }
    if (intrinsic) {
        removeIntrinsicProperty('invisible', game);
        game.u.invisibleTurns = 0;
    }
    else
        grantIntrinsicProperty('invisible', 'outside', game);
    syncHeroInvisibility(game);
    await newsym(game.u.ux, game.u.uy);
}
// C trap.c:fire_damage_chain()
export async function fireDamageChain(objects, { carrier = null, force = false, luckRandom = rnl, publish = async () => { }, random = rn2, state = game, x = carrier?.mx ?? 0, y = carrier?.my ?? 0, } = {}) {
    if (!Array.isArray(objects))
        return 0;
    let destroyed = 0;
    for (const object of [...objects]) {
        if (!await fireDamageObject(object, {
            carrier, force, luckRandom, publish, random, state, x, y,
        }))
            continue;
        destroyed++;
        const index = objects.indexOf(object);
        if (index >= 0)
            objects.splice(index, 1);
    }
    if (destroyed && heroIsBlind(state) && !couldsee(x, y))
        await publish('You smell smoke.');
    return destroyed;
}
// Port only: read an object's runtime class with a metadata fallback.
function objectClass(object) {
    return Number.isInteger(object?.oclass)
        ? object.oclass : objectClassForType(object?.otyp);
}
// Part of C trap.c:fire_damage(): destroy a floor or monster-carried burned object.
async function removeObject(object, context) {
    const { carrier, state, random } = context;
    const inventory = carrier?.minvent || carrier?.inventory || [];
    if (carrier && inventory.includes(object)) {
        if (objectResistsDestruction(object, 0, 0, random))
            return false;
        return destroyObjectFromMonsterInventory(carrier, object, state);
    }
    await delobj(object, state, random);
    return true;
}
// Part of C trap.c:fire_damage(): spill a burned container through floor effects.
async function dropContents(container, context) {
    const contents = [...(container.contents || [])];
    container.contents = [];
    for (const object of contents) {
        object.container = null;
        object.where = 'free';
        const result = await applyFloorEffects(object, context.x, context.y, {
            state: context.state,
            publish: context.publish,
            random: context.random,
        });
        if (result.finished)
            continue;
        // Burned-container contents may include nested containers under
        // hero-caused fire: the awaited placement handles the charge path.
        await placeObject(object, context.x, context.y, context.state);
    }
}
// Part of C trap.c:fire_damage(): burn vulnerable containers and release their contents.
async function burnContainer(object, context) {
    if (object.otyp === STATUE || object.otyp === ICE_BOX)
        return false;
    const chance = object.otyp === CHEST ? 40
        : object.otyp === LARGE_BOX ? 30 : 20;
    // C trap.c:4484 fire_damage() tests Luck; the container survival roll
    // includes the carried luckstone bonus.
    if (!context.force
        && Luck(context.state.u) + 5 > context.random(chance)) {
        return false;
    }
    if (context.squareVisible) {
        await context.publish(`${ownedObjectName(object, context.state)} catches fire and burns.`);
    }
    if ((object.contents || []).length) {
        if (context.squareVisible)
            await context.publish('Its contents fall out.');
        await dropContents(object, context);
    }
    await removeObject(object, context);
    return true;
}
// Part of C trap.c:fire_damage(): burn paper or explode potions with native exceptions.
async function burnPaperOrPotion(object, context) {
    const oclass = objectClass(object);
    if (oclass === SCROLL_CLASS || oclass === SPBOOK_CLASS) {
        if (object.otyp === SCR_FIRE || object.otyp === SPE_FIREBALL)
            return false;
        if (object.otyp === SPE_BOOK_OF_THE_DEAD) {
            if (context.squareVisible)
                await context.publish(`Smoke rises from ${definiteName(objectCombatName(object, {
                    state: context.state, includeCorpseSpecies: false,
                }), context.state)}.`);
            return false;
        }
        if (context.squareVisible) {
            const plural = (object.quan ?? object.quantity ?? 1) > 1;
            const verb = oclass === SCROLL_CLASS && plural
                ? 'catch fire and burn' : 'catches fire and burns';
            await context.publish(`${ownedObjectName(object, context.state)} ${verb}.`);
        }
    }
    else if (oclass === POTION_CLASS) {
        if (context.squareVisible) {
            const plural = (object.quan ?? object.quantity ?? 1) > 1;
            let verb = plural ? 'boil and explode' : 'boils and explodes';
            if (object.otyp === POT_OIL)
                verb = plural ? 'ignite and explode' : 'ignites and explodes';
            await context.publish(`${ownedObjectName(object, context.state)} ${verb}.`);
        }
    }
    else {
        return false;
    }
    await removeObject(object, context);
    return true;
}
// C trap.c:fire_damage()
// C fire_damage(): unlike the chain owner, this has no smoke epilogue.
export async function fireDamageObject(object, { carrier = null, force = false, luckRandom = rnl, publish = async () => { }, random = rn2, state = game, x = carrier?.mx ?? 0, y = carrier?.my ?? 0, } = {}) {
    const squareVisible = state === game
        && !heroIsBlind(state) && couldsee(x, y);
    const context = {
        carrier, force, publish, random,
        squareVisible, state, x, y,
    };
    const ignited = await igniteItems([object], {
        publish, random, state,
        visible: squareVisible,
    });
    if (ignited.length)
        return false;
    const container = object.otyp >= LARGE_BOX
        && object.otyp <= BAG_OF_TRICKS;
    if (container || object.otyp === STATUE)
        return burnContainer(object, context);
    // C trap.c:4507 fire_damage() tests Luck, which includes a carried
    // luckstone's bonus.
    if (!force
        && Luck(state.u) + 5 > random(20)) {
        return false;
    }
    if (await burnPaperOrPotion(object, context))
        return true;
    const erosion = await erodeObject(object, 'burn', {
        state, publish, random, luckRandom,
        destroy: true, position: { x, y },
    });
    return erosion === 'destroyed';
}
const PM_IRON_GOLEM = 259;
const DRAGON_HIDE = 10;
const FIRE_RESISTANT_OBJECTS = new Set([
    RED_DRAGON_SCALE_MAIL,
    RED_DRAGON_SCALES,
    RIN_FIRE_RESISTANCE,
]);
const S_EYE = 5;
const S_LIGHT = 25;
const S_VORTEX = 22;
const PM_AIR_ELEMENTAL = 154;
// C trap.c:lava_damage(). Damage one object thrown or dropped into lava.
export async function lava_damage(object, { state = game, publish = async () => { }, random = rn2, visible = false, x, y, } = {}) {
    // lava_damage() screens every object before checking its material.
    // A destroyed object also passes through delobj() independently.
    if (objectResistsDestruction(object, 0, 0, random)
        && object.otyp !== SPE_BOOK_OF_THE_DEAD)
        return false;
    const burnDirectly = objectMaterial(object, state) < DRAGON_HIDE
        && object.oclass !== SCROLL_CLASS && object.oclass !== SPBOOK_CLASS
        && objectPropertyName(object.otyp) !== 'fireResistance'
        && object.otyp !== WAN_FIRE && object.otyp !== FIRE_HORN
        && !object.oerodeproof && !object.contents?.length;
    const landingX = x ?? object.ox;
    const landingY = y ?? object.oy;
    if (burnDirectly) {
        if (visible) {
            if (object === state._thrownObject || object === state._kickedObject) {
                await publish(object.quan === 1 ? 'It burns up!' : 'They burn up!');
            }
            else {
                observeObjectForNaming(object, { state });
                await publish(formatSeenMessage(`${await fullObjectDescription(object, { state })} hit lava and burn up!`, state));
            }
        }
        await delobj(object, state, random);
    }
    else if (!await fireDamageObject(object, {
        force: true, state, publish, random, x: landingX, y: landingY,
    })) {
        return false;
    }
    return true;
}
// C trap.c:acid_damage()
export async function damageObjectWithAcid(object, { state = game, publish = plineWithContinuation, random = rn2, ...options } = {}) {
    if (!object)
        return;
    if (object.where === 'inventory' && inventoryResists('corrosion', state, random))
        return;
    if (object.greased) {
        await protectWithGrease(object, null, state, publish, random);
    }
    else if (object.oclass === SCROLL_CLASS && object.otyp !== SCR_BLANK_PAPER) {
        const view = objectView(object, state, options.position);
        if (!heroIsBlind(state) && (view.hero || view.monsterVisible))
            await publish(`${objectSubject(view, state)} ${view.plural ? 'fade' : 'fades'}.`);
        object.otyp = SCR_BLANK_PAPER;
        object.spe = 0;
        object.dknown = false;
        if (object.name)
            object.name = 'scroll of blank paper';
        if (object.plural)
            object.plural = 'scrolls of blank paper';
    }
    else {
        await erodeObject(object, 'corrosion', {
            ...options, state, publish, random, verbose: true,
        });
    }
}
// C trap.c:water_damage()
export async function waterDamageObject(object, messages = [], state = game, { force = false, description = null, random = rn2, luckRoll = rnl, rollOne = rnd, publish, mentionWater, acidContext, position } = {}) {
    if (!object)
        return 'nothing';
    const emit = async (message) => {
        if (publish)
            await publish(message);
        else
            messages.push(message);
    };
    if (await splashLitObject(object, emit, state))
        return 'damaged';
    const name = description ?? objectCombatName(object, { state });
    const carried = carriedByHero(object, state);
    const plural = verbForSubject(name, 'are') === 'are';
    const spe = object.spe ?? 0;
    if (object.otyp === CAN_OF_GREASE && spe > 0)
        return 'nothing';
    if (object.otyp === TOWEL && spe < 7) {
        await wetTowel(object, -rollOne(7 - spe), { state, verbose: true, publish: emit });
        return 'nothing';
    }
    if (object.greased) {
        if (random(2) !== 0)
            return 'greased';
        object.greased = false;
        if (carried) {
            observeObjectForNaming(object, { state });
            await emit(`The grease on ${ownedObjectName(object, state, { capitalized: false })} washes off.`);
        }
        // C water_damage(): washed-off acid bypasses luck protection.
        if (object.otyp === POT_ACID)
            return await destroyWetAcidPotion(object, carried, emit, state, acidContext);
        return 'greased';
    }
    if (object.otyp >= LARGE_BOX && object.otyp <= BAG_OF_TRICKS) {
        const waterproof = [OILSKIN_SACK, ICE_BOX, LARGE_BOX, CHEST].includes(object.otyp);
        if (!waterproof || object.cursed && random(3) === 0) {
            if (carried) {
                await emit(`Some ${displayLiquidName('water', state)} gets into your ${name}!`);
                if (!heroIsHallucinating(state))
                    mentionWater?.();
            }
            await damageWaterChain(objectContents(object), messages, state, { random, luckRoll, rollOne, publish: emit,
                ...(position ? { position } : {}),
                ...(acidContext ? { acidContext } : {}) });
        }
        else if (carried && !heroIsBlind(state) && !state.underwater) {
            await emit(`The ${displayLiquidName('water', state)} cannot get into your ${name}.`);
            if (!heroIsHallucinating(state))
                mentionWater?.();
            learnObjectType(object.otyp, state);
        }
        return 'damaged';
    }
    // C trap.c:4771 water_damage() tests Luck, which includes a carried
    // luckstone's bonus.
    const luck = Luck(state.u);
    if (!force && luck + 5 > random(20))
        return 'nothing';
    if (object.oclass === SCROLL_CLASS) {
        if (object.otyp === SCR_BLANK_PAPER)
            return 'nothing';
        if (carried)
            await emit(`Your ${name} ${plural ? 'fade' : 'fades'}.`);
        object.otyp = SCR_BLANK_PAPER;
        object.dknown = false;
        object.spe = 0;
        return 'damaged';
    }
    if (object.oclass === SPBOOK_CLASS) {
        if (object.otyp === SPE_BOOK_OF_THE_DEAD) {
            const position = getObjectLocation(object, state, { contained: true, buried: true });
            if (position) {
                object.ox = position.x;
                object.oy = position.y;
                if (isok(position.x, position.y) && cansee(position.x, position.y))
                    await emit(`Steam rises from ${definiteName(objectCombatName(object, { state, includeCorpseSpecies: false }), state)}.`);
            }
            return 'nothing';
        }
        if (object.otyp === SPE_BLANK_PAPER)
            return 'nothing';
        const novel = object.otyp === SPE_NOVEL;
        if (carried)
            await emit(`Your ${name} ${plural ? 'fade' : 'fades'}.`);
        if (object.spestudied)
            object.spestudied = random(object.spestudied);
        object.otyp = SPE_BLANK_PAPER;
        object.dknown = false;
        if (novel)
            blankNovel(object);
        return 'damaged';
    }
    if (object.oclass === POTION_CLASS) {
        if (object.otyp === POT_ACID) {
            return await destroyWetAcidPotion(object, false, emit, state, acidContext);
        }
        if (object.odiluted) {
            if (carried)
                await emit(`Your ${name} ${plural ? 'dilute' : 'dilutes'} further.`);
            object.otyp = POT_WATER;
            object.dknown = false;
            object.blessed = false;
            object.cursed = false;
            object.buc = 'uncursed';
            object.odiluted = false;
            return 'damaged';
        }
        if (object.otyp === POT_WATER)
            return 'nothing';
        if (carried)
            await emit(`Your ${name} ${plural ? 'dilute' : 'dilutes'}.`);
        object.odiluted = true;
        return 'damaged';
    }
    return erodeObject(object, 'rust', { state, publish: emit, random, luckRandom: luckRoll,
        grease: false, displayName: name, ...(position ? { position } : {}) });
}
// Port only: read the runtime container contents array.
function objectContents(object) {
    return object.contents || [];
}
// C trap.c:pot_acid_damage()
// C pot_acid_damage(): water destroys the bottle without impact or vapors.
async function destroyWetAcidPotion(object, described, emit, state, context) {
    if (heroIsBlind(state) && !carriedByHero(object, state))
        object.dknown = false;
    const plural = object.quan !== 1;
    const repeated = context?.valid && (object.dknown
        ? context.knownExplosions : context.unknownExplosions) > 0;
    const prefix = repeated ? plural ? 'More' : 'Another' : plural ? 'Some' : 'A';
    await emit(described ? `The potion${plural ? 's explode' : ' explodes'}!`
        : `${prefix} ${simpleObjectName(object, state)} ${plural ? 'explode' : 'explodes'}!`);
    if (context?.valid) {
        if (object.dknown)
            context.knownExplosions++;
        else
            context.unknownExplosions++;
    }
    await removeHeroEquipment(object, state);
    await delobj(object, state);
    return 'destroyed';
}
// Part of C trap.c:water_damage_chain(): expose collected messages from shared chain damage.
export async function waterDamageChain(objects, messages = [], state = game, options = {}) {
    if (!objects)
        return messages;
    await damageWaterChain(objects, messages, state, options);
    return messages;
}
// C trap.c:water_damage_chain(). Share the acid context across one exposed object chain.
async function damageWaterChain(objects, messages, state, options) {
    const firstObject = objects[0];
    if (!firstObject)
        return;
    // C water_damage_chain() uses the outer container's location for erosion visibility.
    const position = getObjectLocation(firstObject, state, { contained: true })
        ?? options.position;
    const context = options.acidContext ?? {
        valid: false, knownExplosions: 0, unknownExplosions: 0,
    };
    context.valid = true;
    context.knownExplosions = context.unknownExplosions = 0;
    try {
        for (const object of [...objects]) {
            const result = await waterDamageObject(object, messages, state, { ...options, acidContext: context, ...(position ? { position } : {}) });
            if (result !== 'destroyed')
                continue;
            const index = objects.indexOf(object);
            if (index >= 0)
                objects.splice(index, 1);
        }
    }
    finally {
        // Native nested chains end the shared acid context rather than restoring it.
        context.valid = false;
        context.knownExplosions = context.unknownExplosions = 0;
    }
}
// C trap.c:emergency_disrobe()
export async function emergencyDisrobe(state, random) {
    const capacityLimit = state.uball || state.u?.uball
        ? UNENCUMBERED : SLT_ENCUMBER;
    let dropped = false;
    while (nearCapacity(state) > capacityLimit) {
        const object = pickEmergencyDrop(state, random);
        if (!object)
            return { escaped: false, dropped };
        if (!await dropEmergencyObject(object, state))
            return { escaped: false, dropped, died: true };
        dropped = true;
    }
    // emergency_disrobe() leaves u.uac to moveloop_core()'s find_ac().
    return { escaped: true, dropped };
}
const CRAWL_DX = [-1, -1, 0, 1, 1, 1, 0, -1];
const CRAWL_DY = [0, -1, -1, -1, 0, 1, 1, 1];
// C trap.c:rnd_nextto_goodpos(). Hero branch: shuffle neighbors, then check crawl destinations.
async function rnd_nextto_goodpos(state, x, y, random, publish) {
    const directions = [0, 1, 2, 3, 4, 5, 6, 7];
    for (let remaining = directions.length; remaining > 0; remaining--) {
        const index = random(remaining);
        const selected = directions[index];
        const last = directions[remaining - 1];
        if (selected === undefined || last === undefined)
            throw new RangeError('Crawl direction shuffle received an invalid index.');
        directions[index] = last;
        directions[remaining - 1] = selected;
    }
    for (const direction of directions) {
        const dx = CRAWL_DX[direction];
        const dy = CRAWL_DY[direction];
        if (dx === undefined || dy === undefined)
            throw new RangeError('Unknown crawl direction.');
        const candidate = { x: x + dx, y: y + dy };
        if (await crawlDestinationAllowed(state, candidate.x, candidate.y, random, publish))
            return candidate;
    }
    return null;
}
// C trap.c:back_on_ground(). Both ordinary pool exit and rescue name
// the current surface, including ice beneath a raised drawbridge.
export function backOnGroundMessage(rescued, state) {
    const { ux, uy } = state.u;
    let surface = surfaceName(ux, uy, state);
    let preposition = state.u.levitating || state.u.levitation || state.u.flying ? 'over' : 'on';
    switch (surface) {
        case 'floor':
        case 'ground':
            surface = 'solid ground';
            break;
        case 'ice':
            surface = iceDescriptionAt(ux, uy, { state });
            break;
        case 'bridge':
        case 'altar':
        case 'headstone':
            surface = withIndefiniteArticle(surface);
            break;
        case 'stairs':
        case 'lava':
        case 'bottom':
            surface = `the ${surface}`;
            break;
        case 'air':
            surface = 'the air';
            preposition = 'in';
            break;
        default:
            surface = withIndefiniteArticle(surface);
            preposition = 'in';
    }
    const subject = rescued ? 'You find yourself' : state.flags.verbose ? 'You are back' : 'Back';
    return `${subject} ${preposition} ${surface}.`;
}
// C trap.c:rescued_from_terrain()/back_on_ground(TRUE).
export async function announceTerrainRescue(how, state, publish = plineWithContinuation) {
    const { ux, uy } = state.u;
    const location = state.level.requireAt(ux, uy);
    if (how === DROWNING && isPoolAt(ux, uy, state)) {
        const position = Is_waterlevel(state.u.uz, state) || IS_WATERWALL(location.typ)
            ? 'in the midst' : 'on top';
        await publish(`You find yourself ${position} of ${displayLiquidName('water', state)}.`);
    }
    else if (how === DROWNING && IS_AIR(location.typ)) {
        await publish(`You find yourself in ${Is_waterlevel(state.u.uz, state) ? 'an air bubble' : 'mid air'}.`);
    }
    else if (how !== DROWNING && isPoolAt(ux, uy, state)) {
        await publish(`You find yourself ${state.u.uinwater ? 'in' : 'on'} ${displayLiquidName('water', state)}.`);
    }
    else if (how !== DROWNING && isLavaAt(ux, uy, state)) {
        await publish(`You find yourself on top of ${displayLiquidName('molten lava', state)}.`);
    }
    else {
        await publish(backOnGroundMessage(true, state));
    }
    if (state === game) {
        // C trap.c:5051-5054: mark the message for describe_decor() and
        // adopt the just-disclosed terrain as the previous decor.
        state._lastPlineKind = PLNMSG_BACK_ON_GROUND;
        updateLastSeenTerrain(ux, uy);
        state._prevDecorType = location.lastseentyp ?? location.typ;
    }
}
// C trap.c:drown(). Enter water, try to escape, then handle drowning and rescue.
export async function drown({ state, location, x, y, publish, random, rollDice, rollOne, repaint, resetVision, recalculateVision, applyLandingEffects, chooseTeleportDestination, die, }) {
    const u = state.u;
    // drown() maps the water by touch before any entry message can page.
    if (state === game)
        await feel_newsym(x, y);
    const waterWall = location.typ === WATER;
    let canLiveUnderwater = heroCanLiveUnderwater(state);
    let stayingInPool = false;
    // drown() uses the retained direction, including zero, after relocation.
    if (u.uinwater && isPoolAt(x - (u.dx ?? 0), y - (u.dy ?? 0), state)
        && canLiveUnderwater) {
        if (random(5) !== 0)
            return { entered: true, moved: false, died: false };
        stayingInPool = true;
    }
    if (!u.uinwater) {
        await publish(`You ${waterWall ? 'plunge' : 'fall'} into the ${waterbodyName(x, y, state)}${canLiveUnderwater ? '.' : '!'}`);
        if (!heroCanSwim(state) && !waterWall)
            await publish(heroIsHallucinating(state)
                ? 'You sink like the Titanic.' : 'You sink like a rock.');
    }
    await waterDamageChain(state.inventory, [], state, { publish });
    let formEffect = null;
    if ((u.mtimedone ?? 0) > 0) {
        if (u.umonnum === PM_GREMLIN && random(3) !== 0) {
            const clone = await splitHeroMonsterForm(state);
            if (clone)
                await publish('You multiply!');
            formEffect = clone ? { kind: 'split', clone } : null;
        }
        else if (u.umonnum === PM_IRON_GOLEM) {
            await publish('You rust!');
            let damage = rollDice(2, 6);
            if (u.halfPhysicalDamage)
                damage = Math.trunc((damage + 1) / 2);
            if ((u.mhmax ?? 0) > damage)
                u.mhmax -= damage;
            const died = await loseHeroHp(damage, 'rusting away', {
                state, publish, deathCause: 'killed by rusting away',
            });
            formEffect = { kind: 'rust', damage, died };
        }
    }
    if (formEffect?.died)
        return { entered: true, moved: false, died: true };
    canLiveUnderwater = heroCanLiveUnderwater(state);
    if (stayingInPool) {
        return {
            entered: true, moved: false, died: false, formEffect,
        };
    }
    const leashCount = releaseAllMonsterLeashes(state);
    if (leashCount) {
        await publish(leashCount === 1
            ? 'The leash slips loose.' : 'The leashes slip loose.');
    }
    if (canLiveUnderwater) {
        if (heroDoesNotNeedAir(state)) {
            if (state.flags.verbose)
                await publish("But you aren't drowning.");
            if (!Is_waterlevel(state.u.uz, state))
                await publish(heroIsHallucinating(state) ? 'Your keel hits the bottom.' : 'You touch bottom.');
        }
        // C trap.c:5117-5120: the settling ball and chain are re-placed
        // for the underwater position.
        if (heroIsPunished(state)) {
            await unplaceBallAndChain(state);
            await placeBallAndChain(state);
        }
        await recalculateVision(2);
        await setHeroInWater(true, state);
        // drown() clears the whole map on every dive, even after surfacing
        // has restored land outside the previous underwater viewport.
        if (state === game)
            await under_water(1);
        state.vision_full_recalc = 1;
        return { entered: true, moved: false, died: false };
    }
    // C trap.c:5128 reads Luck, which includes a carried luckstone's bonus.
    const luck = Luck(u);
    if (heroCanTeleport(state) && !heroIsUnaware(state)
        && (heroControlsTeleport(state) || random(3) < luck + 2)) {
        await publish('You attempt a teleport spell.');
        if (heroTeleportRestricted(state)) {
            await publish('The attempted teleport spell fails.');
        }
        else {
            const teleport = await teleportHeroAtWill({
                state, random, rollOne,
                chooseDestination: chooseTeleportDestination,
                publish,
                finishArrival: async (movement) => {
                    if (state.flags.verbose !== false)
                        await publish(`You materialize in ${movement.oldx === movement.x && movement.oldy === movement.y
                            ? 'the same' : 'a different'} location!`);
                    return finishLiquidTeleport(movement, {
                        state, repaint, resetVision, recalculateVision, applyLandingEffects,
                    });
                },
            });
            if (teleport.died)
                return { entered: true, moved: teleport.moved, died: true };
            if (!isPoolAt(u.ux, u.uy, state))
                return teleport.arrival ?? { entered: true, moved: teleport.moved, died: false };
        }
    }
    // C drown(): a mounted hero dismounts before crawling; landing on dry
    // ground ends the drowning.
    if (u.usteed) {
        const from = { x: u.ux, y: u.uy };
        const dismount = await dismountHero(DISMOUNT_GENERIC, { state, random, announce: publish });
        if (dismount.died || state.program_state?.gameover)
            return { entered: true, dismounted: dismount.dismounted, moved: u.ux !== from.x || u.uy !== from.y, died: true };
        if (!isPoolAt(u.ux, u.uy, state))
            return {
                entered: true, dismounted: dismount.dismounted,
                moved: u.ux !== from.x || u.uy !== from.y, died: false,
                from, to: { x: u.ux, y: u.uy },
            };
    }
    if (state.u.usleep)
        await finishHeroHelplessness('Suddenly you wake up!', state, publish);
    if (state.u.uhs === FAINTED)
        await reset_faint({ state });
    // C drown() reads u.ux/u.uy after any teleport or dismount.
    x = u.ux;
    y = u.uy;
    const canMove = !((state._helplessTurns ?? 0) > 0)
        && (!((u.mtimedone ?? 0) > 0) || (MONSTER_MOVE[u.umonnum] ?? 0) > 0);
    const destination = canMove
        ? await rnd_nextto_goodpos(state, x, y, random, publish) : null;
    if (destination) {
        const escape = Is_waterlevel(state.u.uz, state)
            ? { escaped: true, dropped: false }
            : await emergencyDisrobe(state, random);
        if (escape.died)
            return { entered: true, moved: false, died: true };
        await publish(`You try to crawl out of the ${displayLiquidName('water', state)}.`);
        if (escape.dropped)
            await publish('You dump some of your gear to lose weight...');
        if (escape.escaped) {
            await publish('Pheew!  That was close.');
            // C trap.c:5164 relocates through teleds(TELEDS_ALLOW_DRAG),
            // which resets the trap/hold state and drags the ball and chain
            // along, then runs the full destination effects below.
            const { arrival: landing } = await teleds(destination.x, destination.y, state, {
                allowDrag: true,
                finishArrival: () => applyLandingEffects({
                    from: { x, y },
                    to: { x: u.ux, y: u.uy },
                }),
            });
            return {
                entered: true, moved: true, died: !!landing?.died,
                from: { x, y }, to: { x: u.ux, y: u.uy },
            };
        }
        await publish('But in vain.');
    }
    await setHeroInWater(true, state);
    await publish('You drown.');
    for (let attempt = 0; attempt < 2; attempt++) {
        const liquid = waterbodyName(u.ux, u.uy, state);
        const killer = liquid === 'water' ? 'deep water' : liquid;
        const description = liquid === 'water' || liquid === 'limitless water'
            ? killer : withIndefiniteArticle(killer);
        if (!await reviveHeroFromLiquid(state, publish, random)) {
            await die({
                killer,
                deathCause: `drowned in ${description}`,
                deathType: DROWNING,
                possessionAnswer: 'n',
                deathVerb: 'drowned',
            });
        }
        if (state.program_state.gameover)
            return { entered: true, moved: false, died: true };
        // C trap.c:5189 -> safe_teleds(TELEDS_ALLOW_DRAG | TELEDS_TELEPORT)
        // -> teleds(): a light hero may drag an adjacent ball, and the
        // rescue relocation still prints the verbose materialize line
        // (teleport.c:545-547).
        const escape = await safe_teleds(state, {
            random, rollOne, allowDrag: true,
            finishArrival: async (movement) => {
                if (state.flags?.verbose !== false) {
                    await publish(`You materialize in ${movement.oldx === movement.x && movement.oldy === movement.y
                        ? 'the same' : 'a different'} location!`);
                }
                return finishLiquidTeleport(movement, {
                    state, repaint, resetVision, recalculateVision, applyLandingEffects,
                });
            },
        });
        if (escape) {
            if (!escape.arrival.died) {
                await setHeroInWater(false, state);
                state.underwater = false;
                await announceTerrainRescue(DROWNING, state, publish);
            }
            return escape.arrival;
        }
        await publish("You're still drowning.");
    }
    await setHeroInWater(false, state);
    state.underwater = false;
    await announceTerrainRescue(DROWNING, state, publish);
    // C drown() returns TRUE after rescue even when no safe landing exists.
    return { entered: true, moved: true, died: false };
}
const PM_WATER_ELEMENTAL = MONSTER_NAME.indexOf('water elemental');
const PM_FOG_CLOUD = MONSTER_NAME.indexOf('fog cloud');
// Part of C trap.c:drown(): combine swimming and underwater-survival properties.
export function heroCanLiveUnderwater(state) {
    const u = state.u;
    return !!(u.amphibious || u.swimming || u.breathless || u.magicalBreathing
        || cant_drown(polymorphedHeroForm(state) ?? -1));
}
// Part of C end.c:done(): resolve the liquid victim's life-saving amulet.
export async function reviveHeroFromLiquid(state, publish, random) {
    if (state !== game)
        return false;
    // C done() forces status with the raw HP before it records the death.
    await bot();
    const lifeSaving = beginHeroLifeSaving();
    if (!lifeSaving)
        return false;
    await publish('But wait...');
    identifyLifeSavingAmulet(random);
    await publish(`Your medallion ${heroIsBlind(state) ? 'feels warm' : 'begins to glow'}!`);
    await publish(formatFeltMessage('much better!', state));
    await publish('The medallion crumbles to dust!');
    await completeHeroLifeSaving(lifeSaving);
    return true;
}
// Port only: finish shared teleport display and landing effects after liquid escape.
async function finishLiquidTeleport(movement, { state, repaint, resetVision, recalculateVision, applyLandingEffects, }) {
    // spoteffects() announces surfacing before it clears the submerged view.
    const from = { x: movement.oldx, y: movement.oldy };
    const to = { x: movement.x, y: movement.y };
    await repaint(movement.oldx, movement.oldy);
    resetVision();
    await recalculateVision(0);
    const landing = await applyLandingEffects({ from, to });
    return { entered: true, moved: true, died: !!landing?.died, from, to };
}
// Part of C trap.c:drown(): test breathless and amphibious survival.
function heroDoesNotNeedAir(state) {
    const u = state.u;
    return !!(u.amphibious || u.breathless || u.magicalBreathing
        || (monsterIsAmphibious(polymorphedHeroForm(state) ?? -1) || monsterIsBreathless(polymorphedHeroForm(state) ?? -1)));
}
// C trap.c:dountrap()
export async function doUntrap({ state = game, enterTrap = null, } = {}) {
    const problem = untrapAbilityProblem(state);
    if (problem) {
        await pline(problem);
        state.context.move = 0;
        return false;
    }
    const spentTime = await untrap({ state, enterTrap });
    if (state.program_state.gameover)
        return spentTime;
    state.context.move = spentTime ? 1 : 0;
    return spentTime;
}
// C trap.c:could_untrap(): why the hero cannot attempt an untrap —
// encumbrance, no usable hands, holding a stuck victim, welded hands, or
// an unreachable floor.
export function untrapAbilityProblem(state = game, { checkFloor = false } = {}) {
    if (nearCapacity(state) >= HVY_ENCUMBER)
        return "You're too strained to do that.";
    const form = (state.u.mtimedone ?? 0) > 0 ? state.u.umonnum : null;
    if ((heroHasNoHands(state) && !heroCanSpinWeb(state))
        || (form !== null && form !== undefined && Number.isInteger(form) && (MONSTER_MOVE[form] ?? 0) === 0)) {
        return 'And just how do you expect to do that?';
    }
    if (state.u?.ustuck && heroFormSticks(state)) {
        return `You'll have to let go of ${canonicalMonsterName(state.u.ustuck, { state })} first.`;
    }
    if (state.u?.ustuck || weldedTwoHandedWeapon(state))
        return 'Your hands seem to be too busy for that.';
    if (checkFloor && !heroCanReachFloor(state))
        return "You can't reach the floor.";
    return null;
}
// Part of C trap.c:could_untrap(): detect a welded two-handed weapon.
function weldedTwoHandedWeapon(state) {
    const weapon = state.uwep || state.u?.uwep;
    return isWeldedPrimary(weapon, state) && isBimanualObject(weapon);
}
// Part of C trap.c:untrap_prob(): the disarm failure roll; also inlines
// C artifact.c:attacks() — attack?.damageType === 'fire' is the
// fiery-blade test that guarantees the web-cut roll.
function untrapFailureRoll(trap, state, random) {
    let chance = 3;
    if (trap.ttyp === WEB) {
        const blade = webCuttingWeapon(trap, state);
        const artifact = artifactById(blade?.oartifact, state);
        if (blade && (artifact?.name === 'Sting'
            || artifact?.attack?.damageType === 'fire'))
            chance = 1;
        else if (!blade && !heroCanSpinWeb(state))
            chance = 7;
    }
    if (heroIsImpaired(state))
        chance++;
    if (heroIsBlind(state))
        chance++;
    if (heroIsStunned(state))
        chance += 2;
    if (heroIsFumbling(state))
        chance *= 2;
    if (trap.madeby_u)
        chance--;
    const role = state.urole?.key;
    if (role === 'ranger' && trap.ttyp === BEAR_TRAP && chance <= 3)
        return 0;
    if (role === 'rogue') {
        if (random(2 * MAXULEV) < (state.u?.ulevel ?? 1))
            chance--;
        if (state.u?.uhave?.questart && chance > 1)
            chance--;
    }
    else if (role === 'ranger' && chance > 1) {
        chance--;
    }
    return random(Math.max(1, chance));
}
// Finding and removing floor, container, and door traps.
// C ref: trap.c dountrap(), could_untrap(), and untrap().
const G_UNIQ = 0x1000;
const S_HUMAN = 53;
// Port only: combine runtime confusion and hallucination for untrapping.
function heroIsImpaired(state) {
    const hero = state.u;
    return !!hero.confused || (hero.confusionTurns ?? 0) > 0
        || heroIsHallucinating(state);
}
// Port only: read runtime stun state for untrapping.
function heroIsStunned(state) {
    return !!(state.u?.stunned || (state.u?.stunnedTurns ?? 0) > 0);
}
// Port only: read runtime fumbling state for untrapping.
function heroIsFumbling(state) {
    return !!(state.u?.fumbling || (state.u?.fumblingTurns ?? 0) > 0);
}
// Port only: find a living mapped monster head at an untrapping square.
function monsterAt(state, x, y) {
    return state.level?.monsters?.find(monster => monsterHasMapPosition(monster, state) &&
        !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}
// Part of C trap.c:untrap(): choose a blade to cut an unoccupied web.
function webCuttingWeapon(trap, state) {
    if (monsterAt(state, trap.tx, trap.ty))
        return null;
    const primary = state.uwep || state.u?.uwep;
    if (primary && isBlade(primary))
        return primary;
    const secondary = state.uswapwep || state.u?.uswapwep;
    return state.u.twoweap && secondary && isBlade(secondary) ? secondary : null;
}
// C trap.c:cnv_trap_obj(). Convert a set trap before releasing its occupants.
// C trap.c:cnv_trap_obj()
export async function convertTrapToObject(trap, objectType, count, state = game, { bury = false } = {}) {
    requireLiveGame(state);
    const object = await mksobj(objectType, true, false);
    object.quan = object.quantity = count;
    object.owt = objectWeight(object);
    if (objectType !== DART)
        object.opoisoned = 0;
    await placeObject(object, trap.tx, trap.ty, state);
    if (bury) {
        await buryObject(object, state);
    }
    else {
        if (trap.madeby_u)
            await sellHeroDroppedObject(object, trap.tx, trap.ty, state);
        await stack_object(object, state);
    }
    await newsym(trap.tx, trap.ty);
    if (state.u.utrap && state.u.ux === trap.tx && state.u.uy === trap.ty) {
        await resetUtrap(true, state);
        if (state.program_state.gameover)
            return object;
    }
    const monster = monsterAtPosition(requireGameLevel(state), trap.tx, trap.ty);
    if (monster?.mtrapped)
        monster.mtrapped = 0;
    deleteTrap(trap, state);
    return object;
}
// C trap.c:into_vs_onto(). Name movement into a confining or transporting trap.
export function into_vs_onto(type) {
    return [BEAR_TRAP, PIT, SPIKED_PIT, HOLE, TELEP_TRAP, LEVEL_TELEP, MAGIC_PORTAL, WEB].includes(type);
}
// C trap.c:move_into_trap(): while attempting to disarm an adjacent trap,
// the hero has fallen into it.
export async function moveIntoFailedUntrap(trap) {
    const u = game.u;
    const newx = trap.tx;
    const newy = trap.ty;
    const dx = newx - u.ux;
    const dy = newy - u.uy;
    const loc = game.level?.at?.(newx, newy);
    if (!loc || blocksMove(newx, newy)
        || (dx && dy && blocksDiagonalDoor(game.level?.at?.(u.ux, u.uy), loc)))
        return { entered: false, died: false };
    const ballChainMove = await beginBallAndChainMove(newx, newy);
    if (ballChainMove?.blocked)
        return { entered: false, died: !!game.program_state.gameover };
    const oldx = u.ux;
    const oldy = u.uy;
    u.ux0 = oldx;
    u.uy0 = oldy;
    await placeHeroOnLevel(newx, newy);
    u.umoved = true;
    await newsym(oldx, oldy);
    await vision_recalc(1);
    await checkHeroLeashes(oldx, oldy);
    if (game.program_state.gameover)
        return { entered: true, died: true };
    await finishBallAndChainMove(ballChainMove);
    // C move_into_trap() has its own arrival order and does not run the
    // footstep, concealment, or dragging-delay tail of domove_core().
    trap.tseen = false;
    await finishDestinationSpotEffects({
        oldx, oldy, newx: u.ux, newy: u.uy,
        trapOptions: { failedUntrap: true },
    });
    if (game.program_state.gameover)
        return { entered: true, died: true };
    const remainingTrap = game.level?.traps?.find(candidate => candidate.tx === u.ux && candidate.ty === u.uy);
    if (remainingTrap)
        remainingTrap.tseen = true;
    await exerciseAttribute(A_WIS, false);
    return { entered: true, died: false };
}
// C trap.c:try_disarm()
async function tryDisarm(trap, { state, publish, random, rollOne, luckRandom, enterTrap, forceFailure = false, }) {
    const monster = monsterAt(state, trap.tx, trap.ty);
    const holdingTrap = trap.ttyp === BEAR_TRAP || trap.ttyp === WEB;
    if (monster && (!monster.mtrapped || !holdingTrap)) {
        await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} is in the way.`);
        return 0;
    }
    const here = trap.tx === state.u.ux && trap.ty === state.u.uy;
    const boulder = (state.level?.objects?.[trap.tx]?.[trap.ty] || [])
        .some(object => object.otyp === BOULDER);
    if (boulder && !heroPassesWallsForUntrap(state) && !here) {
        await publish('There is a boulder in your way.');
        return 0;
    }
    const dx = trap.tx - state.u.ux;
    const dy = trap.ty - state.u.uy;
    // C trap.c:5461-5469 duplicates only the tight-space core of
    // test_move(): bad rock in both orthogonal squares plus overencumbrance
    // or a big form.  cant_squeeze_thru()'s extra exemptions do not apply.
    const tooTight = !!(dx && dy
        && badRock(heroSpecies(state), state.u.ux, trap.ty, state)
        && badRock(heroSpecies(state), trap.tx, state.u.uy, state)
        && (((state.inventory || []).length > 0
            && inventoryWeight(state) > WT_TOOMUCH_DIAGONAL)
            || monsterIsBig(heroSpecies(state))));
    if (tooTight) {
        await publish(`You are unable to reach the ${trapName(trap.ttyp, { state })}!`);
        return 0;
    }
    // C trap.c:5471-5477 splits this refusal into an unskilled-rider
    // rider_cant_reach() case and a generic one, but can_reach_floor()'s
    // rider check (engrave.c:197-198) precedes anything reachable from
    // untrap(), so a mounted hero is always refused by the main flow and
    // only the generic message is reachable here.
    if (!heroCanReachFloor(state, { checkPit: here })) {
        await publish(`You are unable to reach the ${trapName(trap.ttyp, { state })}!`);
        return 0;
    }
    if (!forceFailure && untrapFailureRoll(trap, state, random) === 0)
        return 2;
    if (luckRandom(5)) {
        await publish('Whoops...');
        if (monster) {
            await failMonsterRescue(monster, trap, {
                state, publish, random, rollOne,
            });
        }
        else if (here) {
            const result = await dotrap(trap, { failedUntrap: true });
            if (result.died)
                return 1;
        }
        else {
            const entered = enterTrap ? await enterTrap(trap) : null;
            if (entered?.died)
                return 1;
            if (!entered?.entered) {
                // C trap.c:into_vs_onto(): "into" for the trap types that
                // catch; only the disarmable subset reaches here.
                const preposition = [BEAR_TRAP, PIT, SPIKED_PIT, WEB]
                    .includes(trap.ttyp) ? 'into' : 'onto';
                await publish(`Fortunately, you don't move ${preposition} it.`);
            }
        }
    }
    else {
        const owner = trap.madeby_u ? 'Your' : here ? 'This' : 'That';
        const action = trap.ttyp === WEB ? 'remove' : 'disarm';
        await publish(`${owner} ${trapName(trap.ttyp, { state })} is difficult to ${action}.`);
    }
    return 1;
}
// Port only: combine runtime and form wall-passing for untrapping.
function heroPassesWallsForUntrap(state) {
    if (state.u.passesWalls)
        return true;
    const form = (state.u.mtimedone ?? 0) > 0 ? state.u.umonnum : null;
    return form !== null && form !== undefined && Number.isInteger(form)
        && monsterPassesWalls(form);
}
// Part of C trap.c:try_disarm(): injure a held monster or become entangled on failed rescue.
async function failMonsterRescue(monster, trap, { state, publish, random, rollOne, }) {
    if (trap.ttyp === BEAR_TRAP) {
        if (monster.mtame)
            await abusePet(monster, state);
        monster.mhp = (monster.mhp ?? 1) - rollOne(4);
        if (monster.mhp <= 0) {
            await finishEnvironmentalMonsterDeath(monster, state, {
                random, publish,
            });
        }
    }
    else if (trap.ttyp === WEB) {
        if (!heroCanSpinWeb(state) && random(3) === 0) {
            const existing = trapAt(state, state.u.ux, state.u.uy);
            const web = existing ?? await maketrap(state.u.ux, state.u.uy, WEB);
            if (web?.ttyp === WEB) {
                await publish("The web sticks to you.  You're caught too!");
                await dotrap(web, { noWebMessage: true });
                if (state.u.usteed && state.u.utrap) {
                    const dismount = await dismountHero(DISMOUNT_FELL);
                    if (dismount.died)
                        return;
                }
            }
        }
        if (monster.mtrapped)
            await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} remains entangled.`);
    }
}
// C trap.c:reward_untrap()
export async function rewardMonsterRescue(trap, monster, { state = game, publish = plineWithContinuation, random = rn2, luckRandom = rnl, } = {}) {
    if (trap.madeby_u)
        return;
    const unique = !!((MONSTER_GENO[monster.mnum] ?? 0) & G_UNIQ);
    if (luckRandom(10) < 8 && !monster.mpeaceful
        && !monsterIsHelplessForUntrap(monster) && !monsterIsMindless(monster.mnum)
        && !unique && MONSTER_SYMBOL[monster.mnum] !== S_HUMAN) {
        monster.mpeaceful = 1;
        setMonsterMalign(monster, state);
        await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} is grateful.`);
    }
    if (random(3) === 0 && luckRandom(8) === 0
        && state.u?.ualign?.type === 1) {
        adjustHeroAlignment(1, state);
        await publish(formatFeltMessage('that you did the right thing.', state));
    }
}
// Port only: read monster helplessness for rescue decisions.
function monsterIsHelplessForUntrap(monster) {
    return !!(monster.msleeping || monster.mfrozen
        || monster.mcanmove === 0);
}
// Part of C trap.c:untrap(): the holding-trap disarm branch (web and bear
// trap); also inlines C artifact.c:attacks() — attack?.damageType === 'fire'
// is the fiery-blade test for the burn-through case.
async function disarmHoldingTrap(trap, options) {
    const result = await tryDisarm(trap, options);
    if (result < 2)
        return result !== 0;
    const { state, publish, random, luckRandom } = options;
    const monster = monsterAt(state, trap.tx, trap.ty);
    if (monster) {
        monster.mtrapped = 0;
        const noun = trap.ttyp === BEAR_TRAP ? 'bear trap' : 'web';
        await publish(`You extract ${canonicalMonsterName(monster, { state })} from ${possessiveTrap(trap)} ${noun}.`);
        await rewardMonsterRescue(trap, monster, {
            state, publish, random, luckRandom,
        });
    }
    else if (trap.ttyp === BEAR_TRAP) {
        await publish(`You disarm ${possessiveTrap(trap)} bear trap.`);
        await convertTrapToObject(trap, BEARTRAP, 1, state);
        return true;
    }
    else {
        // C trap.c:5575-5586 picks the blade without regard to the monster
        // that was just extracted, and names the primary weapon's artifact
        // (bare_artifactname(uwep)) for the fiery-blade message.
        const primary = state.uwep || state.u?.uwep;
        const secondary = state.uswapwep || state.u?.uswapwep;
        const blade = primary && isBlade(primary) ? primary
            : state.u.twoweap && secondary && isBlade(secondary)
                ? secondary : null;
        const artifact = artifactById(blade?.oartifact, state);
        if (blade && artifact && blade === primary && artifact.name === 'Sting')
            await publish(`Sting cuts through ${possessiveTrap(trap)} web!`);
        else if (blade && artifact && artifact.attack?.damageType === 'fire')
            await publish(`${bareArtifactOrPlainName(primary, state)} burns through ${possessiveTrap(trap)} web!`);
        else if (blade)
            await publish(`You cut through ${possessiveTrap(trap)} web.`);
        else
            await publish(`You succeed in removing ${possessiveTrap(trap)} web.`);
        removeTrap(trap, state);
    }
    await newsym(trap.tx, trap.ty);
    return true;
}
// Port only: select trap ownership wording.
function possessiveTrap(trap) {
    return trap?.madeby_u ? 'your' : 'the';
}
// Port only: remove a trap and clear runtime hero and monster restraint state.
function removeTrap(trap, state) {
    deleteTrap(trap, state);
    if (state.u?.utrap && state.u.ux === trap.tx && state.u.uy === trap.ty)
        // Freeing a trapped hero runs the set_utrap(0, 0) path, which also
        // refreshes the stored levitation/flying blocked masks.
        setHeroTrap(0, 0, state);
    const monster = monsterAt(state, trap.tx, trap.ty);
    if (monster?.mtrapped)
        monster.mtrapped = 0;
}
// C trap.c:disarm_landmine()
async function disarmLandmine(trap, options) {
    const result = await tryDisarm(trap, options);
    if (result < 2)
        return result !== 0;
    await options.publish(`You disarm ${possessiveTrap(trap)} land mine.`);
    await convertTrapToObject(trap, LAND_MINE, 1, options.state);
    return true;
}
// C trap.c:disarm_squeaky_board()
async function disarmSqueakyBoard(trap, options) {
    const tool = await chooseSqueakyBoardTool(options);
    if (!tool)
        return false;
    const badTool = tool.cursed
        || ((tool.otyp !== POT_OIL || tool.lamplit)
            && (tool.otyp !== CAN_OF_GREASE || !(tool.spe ?? 0)));
    const result = await tryDisarm(trap, {
        ...options, forceFailure: !!badTool,
    });
    if (result < 2)
        return result !== 0;
    if (tool.otyp === CAN_OF_GREASE) {
        await consumeObjectCharge(tool, { state: options.state });
    }
    else {
        await consumeOne(tool, options.state);
        recordObjectKnowledge(POT_OIL, options.state);
    }
    await options.publish('You repair the squeaky board.');
    removeTrap(trap, options.state);
    await newsym(trap.tx, trap.ty);
    await awardExperience(1, 5, options.state, options.publish);
    return true;
}
// Part of C trap.c:disarm_squeaky_board(): prompt for oil or grease.
// Also C trap.c:unsqueak_ok(): select oil or grease in the object-picker callback.
// Native getobj requests "untrap with" using the unsqueak_ok callback and
// GETOBJ_PROMPT. The unsqueak_ok callback downplays potions other than known oil.
async function chooseSqueakyBoardTool({ state, chooseObject }) {
    return chooseObject('untrap with', object => {
        if (object.otyp === CAN_OF_GREASE)
            return GETOBJ_SUGGEST;
        if (object.otyp === POT_OIL && object.dknown && objectTypeKnown(object, state))
            return GETOBJ_SUGGEST;
        return object.oclass === POTION_CLASS ? GETOBJ_DOWNPLAY : GETOBJ_EXCLUDE;
    }, { forcePrompt: true });
}
// Port only: consume one object and refresh its runtime stack weight.
async function consumeOne(object, state) {
    const quantity = object.quan ?? object.quantity ?? 1;
    if (quantity <= 1) {
        await deleteObject(object, state);
        return;
    }
    object.quan = object.quantity = quantity - 1;
    object.owt = objectWeight(object);
}
// Port only: grant experience and run the shared level-up boundary.
async function awardExperience(experience, scoreBonus, state, publish) {
    addExperience(experience, scoreBonus, state);
    if (state === game)
        await checkExperienceLevel({ publish });
}
// C trap.c:disarm_shooting_trap()
async function disarmShootingTrap(trap, objectType, options) {
    const result = await tryDisarm(trap, options);
    if (result < 2)
        return result !== 0;
    await options.publish(`You disarm ${possessiveTrap(trap)} trap.`);
    const count = 50 - options.luckRandom(50);
    await convertTrapToObject(trap, objectType, count, options.state);
    return true;
}
// C trap.c:try_lift()
async function canLiftMonster(monster, trap, weight, carrying, options) {
    const { state, publish, luckRandom } = options;
    if (calcCapacity(state, weight) < HVY_ENCUMBER)
        return true;
    await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} is ${carrying ? 'carrying too much' : 'too heavy'} for you to lift.`);
    if (!trap.madeby_u && !monster.mpeaceful && monster.mcanmove !== 0
        && !monsterIsMindless(monster.mnum)
        && MONSTER_SYMBOL[monster.mnum] !== S_HUMAN
        && luckRandom(10) < 3) {
        monster.mpeaceful = 1;
        setMonsterMalign(monster, state);
        await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} thinks it was nice of you to try.`);
    }
    return false;
}
// C trap.c:help_monster_out()
async function helpMonsterOut(monster, trap, options) {
    const { state, publish, random, luckRandom } = options;
    if (!monster.mtrapped) {
        await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} isn't trapped.`);
        return false;
    }
    if (nearCapacity(state) >= EXT_ENCUMBER) {
        await publish("You can't do that while carrying so much stuff.");
        return true;
    }
    const failed = untrapFailureRoll(trap, state, random);
    if (failed && !monsterIsHelplessForUntrap(monster)) {
        await publish(`You try to reach out your ${makePlural(body_part(ARM, state))}, but ${canonicalMonsterName(monster, { state })} backs away skeptically.`);
        return true;
    }
    if (touchPetrifies(monster.mnum)
        && !(state.uarmg || state.u?.uarmg)
        && !(state.u.stoneResistance)) {
        const species = monsterTypeName(monster.mnum, !!monster.female);
        await publish(`You grab the trapped ${species} using your bare ${makePlural(body_part(HAND, state))}.`);
        const contact = await resolveImmediatePetrification({
            state,
            killer: `trying to help ${withIndefiniteArticle(species)} out of a pit`,
            publish: plineWithContinuation,
        });
        if (contact.died || !contact.transformed)
            return true;
        await displayMessageWindow();
    }
    if (failed) {
        await publish(`You try to grab ${canonicalMonsterName(monster, { state })}, but cannot get a firm grasp.`);
        if (monster.msleeping) {
            monster.msleeping = 0;
            await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} awakens.`);
        }
        return true;
    }
    await publish(`You reach out your ${makePlural(body_part(ARM, state))} and grab ${canonicalMonsterName(monster, { state })}.`);
    if (monster.msleeping) {
        monster.msleeping = 0;
        await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} awakens.`);
    }
    else if (monster.mfrozen && random(monster.mfrozen) === 0) {
        monster.mcanmove = 1;
        monster.mfrozen = 0;
        await publish(`${canonicalMonsterName(monster, { state, capitalized: true })} stirs.`);
    }
    const bodyWeight = MONSTER_BODY_META[monster.mnum]?.[0] ?? 0;
    if (!await canLiftMonster(monster, trap, bodyWeight, false, options))
        return true;
    const carriedWeight = (monster.minvent || monster.inventory || [])
        .reduce((total, object) => total + objectWeight(object), 0);
    if (carriedWeight
        && !await canLiftMonster(monster, trap, bodyWeight + carriedWeight, true, options))
        return true;
    await publish(`You pull ${canonicalMonsterName(monster, { state })} out of the pit.`);
    monster.mtrapped = 0;
    await rewardMonsterRescue(trap, monster, {
        state, publish, random, luckRandom,
    });
    await fillPitWithBoulder(trap.tx, trap.ty, state, publish);
    return true;
}
// Part of C trap.c:fill_pit(): consume a boulder, fill a pit and bury its floor objects.
async function fillPitWithBoulder(x, y, state, publish) {
    const trap = trapAt(state, x, y);
    if (!trap || (trap.ttyp !== PIT && trap.ttyp !== SPIKED_PIT))
        return false;
    const boulder = (state.level?.objects?.[x]?.[y] || [])
        .find(object => object.otyp === BOULDER);
    if (!boulder)
        return false;
    await deleteObject(boulder, state);
    removeTrap(trap, state);
    await buryFloorObjectsAt(x, y, state, { publish });
    if (!heroIsBlind(state) && cansee(x, y)) {
        await publish('The boulder fills a pit.');
    }
    else if (!heroIsDeaf(state)) {
        await publish('You hear a boulder settle.');
    }
    await newsym(x, y);
    return true;
}
// C trap.c:disarm_box()
async function disarmBox(box, { state, force, publish, random, rollOne, rollDice, }) {
    if (!box.otrapped) {
        await publish(`That ${objectCombatName(box, { state, includeCorpseSpecies: false })} was not trapped.`);
        box.tknown = false;
        return;
    }
    let chance = currentAttribute(A_DEX, state) + (state.u?.ulevel ?? 1);
    if (state.urole?.key === 'rogue')
        chance *= 2;
    if (!force && (heroIsImpaired(state) || heroIsFumbling(state)
        || rollOne(75 + Math.trunc(level_difficulty() / 2)) > chance)) {
        const trap = await triggerChestTrap(box, {
            state, disarm: true, bodyPart: body_part(FINGER, state), publish, random, rollDice,
        });
        if (trap?.died)
            return;
    }
    else {
        await publish('You disarm it!');
        box.otrapped = false;
        box.tknown = true;
        await awardExperience(8, 0, state, publish);
    }
    await exerciseAttribute(A_DEX, true, state);
}
// C trap.c:untrap_box()
async function inspectBox(box, options) {
    const { state, force, ask, publish, random } = options;
    const impaired = heroIsImpaired(state);
    const found = (box.otrapped
        && (force || (!impaired
            && random(MAXULEV + 1 - (state.u?.ulevel ?? 1)) < 10)))
        || box.tknown
        || (!force && impaired && random(3) === 0);
    const alreadyKnown = box.tknown && box.dknown;
    const name = definiteName(objectCombatName(box, { state, includeCorpseSpecies: false }), state);
    if (!found) {
        await publish(`You find no traps on ${name}.`);
        return;
    }
    await publish(alreadyKnown
        ? `There's a trap on ${name}.`
        : `You find a trap on ${name}!`);
    box.tknown = true;
    box.dknown = true;
    if (!impaired)
        await exerciseAttribute(A_WIS, true, state);
    if (await ask('Disarm it?') === 'y')
        await disarmBox(box, options);
}
// C trap.c:untrap()
export async function untrap({ state = game, container = null, door = null, force = false, enterTrap = null, chooseDirection = promptDirection, ask = promptYesNoQuit, chooseObject = chooseInventoryObject, publish = pline, random = rn2, rollOne = rnd, rollDice = d, luckRandom = rnl, } = {}) {
    if (!force && hasMagicKey({ youmonst: true }, state))
        force = true;
    if (container) {
        await inspectBox(container, { state, force, ask, publish, random, rollOne, rollDice });
        return true;
    }
    if (door) {
        if (!isok(door.x, door.y)) {
            await publish('The perils lurking there are beyond your grasp.');
            return false;
        }
        const trap = trapAt(state, door.x, door.y);
        // C chooses the floor-trap name even when only the door is discussed.
        if (trap?.tseen)
            trapName(trap.ttyp, { state });
        return handleDoor(door.x, door.y, {
            state, force, trapSkipped: false, ask, publish, random, rollOne,
        });
    }
    const direction = await chooseDirection();
    if (!direction)
        return false;
    const hero = state.u;
    hero.dx = direction.dx;
    hero.dy = direction.dy;
    hero.dz = direction.dz;
    const x = state.u.ux + direction.dx;
    const y = state.u.uy + direction.dy;
    if (!isok(x, y)) {
        await publish('The perils lurking there are beyond your grasp.');
        return false;
    }
    const here = x === state.u.ux && y === state.u.uy;
    let trap = trapAt(state, x, y);
    if (trap && !trap.tseen)
        trap = null;
    // C untrap() chooses once, including attempts which never name the trap.
    const description = trap ? trapName(trap.ttyp, { state }) : '';
    const boxes = here ? boxesAt(state, x, y) : [];
    const canReachFloor = heroCanReachFloor(state);
    let handleTrap = canReachFloor;
    let trapSkipped = false;
    if (!canReachFloor && (trap || boxes.length)) {
        await publish(unreachableTrapMessage(description, boxes.length, here, state));
        trapSkipped = !!trap;
    }
    else if (canReachFloor && trap) {
        if (boxes.length) {
            if (trap.ttyp === PIT || trap.ttyp === SPIKED_PIT) {
                const position = state.u?.utrap
                    ? " that you're stuck in"
                    : ' while standing on the edge of it';
                await publish(`You can't do much about the ${description}${position}.`);
                handleTrap = false;
                trapSkipped = true;
            }
            else {
                const choice = await chooseFloorTrapOrBox(trap, description, boxes.length, ask);
                if (choice === 'q')
                    return false;
                if (choice === 'n') {
                    handleTrap = false;
                    trapSkipped = true;
                }
            }
        }
        if (handleTrap) {
            return handleFloorTrap(trap, description, {
                state,
                enterTrap,
                chooseObject,
                publish,
                random,
                rollOne,
                rollDice,
                luckRandom,
            });
        }
    }
    if (canReachFloor && boxes.length) {
        const used = await handleBoxes(boxes, {
            state, force, ask, publish, random, rollOne, rollDice,
        });
        if (used !== null)
            return used;
    }
    const doorMimic = monsterAt(state, x, y);
    if (isDoorMimic(doorMimic, state)) {
        await revealMimic(doorMimic, state, publish);
        return true;
    }
    return handleDoor(x, y, {
        state,
        force,
        trapSkipped,
        ask,
        publish,
        random,
        rollOne,
    });
}
// Part of C trap.c:untrap(): collect boxes on the hero's square.
function boxesAt(state, x, y) {
    return (state.level?.objects?.[x]?.[y] || []).filter(object => object.otyp === LARGE_BOX || object.otyp === CHEST);
}
// Part of C trap.c:untrap(): describe floor traps and containers the hero cannot reach.
function unreachableTrapMessage(description, boxCount, here, state) {
    const things = [];
    if (description)
        things.push(withIndefiniteArticle(description));
    if (boxCount)
        things.push(boxCount === 1 ? 'a container' : 'containers');
    const subject = things.join(' and ');
    const plural = things.length > 1 || boxCount > 1;
    const mounted = state.u?.usteed ? ' while mounted' : '';
    const location = here ? 'here' : 'there';
    const object = plural ? 'them' : 'it';
    return `There ${plural ? 'are' : 'is'} ${subject} ${location} `
        + `but you can't reach ${object}${mounted}.`;
}
// Part of C trap.c:untrap(): offer the floor trap before checking containers.
async function chooseFloorTrapOrBox(trap, noun, boxCount, ask) {
    const containers = boxCount === 1 ? 'a container' : 'containers';
    const verb = trap.ttyp === WEB ? 'Remove' : 'Disarm';
    const subject = `There ${boxCount === 1 ? 'is' : 'are'} ${containers} `
        + `and ${withIndefiniteArticle(noun)} here.`;
    return ask(`${subject}  ${verb} the ${noun}?`);
}
// Part of C trap.c:untrap(): dispatch the selected floor trap.
async function handleFloorTrap(trap, description, options) {
    const { state, publish } = options;
    const here = trap.tx === state.u.ux && trap.ty === state.u.uy;
    if (state.u?.utrap) {
        await publish(`You cannot deal with the ${description} while trapped${here ? ' in it' : ''}!`);
        return true;
    }
    const mimic = monsterAt(state, trap.tx, trap.ty);
    if (isObjectOrFurnitureMimic(mimic, state)) {
        await revealMimic(mimic, state, publish);
        return true;
    }
    switch (trap.ttyp) {
        case BEAR_TRAP:
        case WEB:
            return disarmHoldingTrap(trap, options);
        case LANDMINE:
            return disarmLandmine(trap, options);
        case SQKY_BOARD:
            return disarmSqueakyBoard(trap, options);
        case DART_TRAP:
            return disarmShootingTrap(trap, DART, options);
        case ARROW_TRAP:
            return disarmShootingTrap(trap, ARROW, options);
        case PIT:
        case SPIKED_PIT:
            return handlePit(trap, options);
        default:
            await publish(`You cannot disable ${here ? 'this' : 'that'} trap.`);
            return false;
    }
}
// Part of C trap.c:untrap(): offer to rescue a monster in an adjacent pit.
async function handlePit(trap, options) {
    const { state, publish } = options;
    const here = trap.tx === state.u.ux && trap.ty === state.u.uy;
    if (here) {
        await publish('You are already on the edge of the pit.');
        return false;
    }
    const monster = monsterAt(state, trap.tx, trap.ty);
    if (!monster) {
        await publish('Try filling the pit instead.');
        return false;
    }
    return helpMonsterOut(monster, trap, options);
}
// Part of C trap.c:untrap(): prompt for and inspect each floor container.
async function handleBoxes(boxes, { state, force, ask, publish, random, rollOne, rollDice, }) {
    for (const box of boxes) {
        const known = box.tknown && box.dknown;
        if (!known)
            observeObjectForNaming(box, { state });
        const answer = await ask(await objectQuestion(box, {
            prefix: known ? 'Disarm this ' : 'There is ',
            suffix: known ? '' : ' here.  Check it for traps?',
            fallback: 'a box',
            format: async (object, nameState) => known
                ? objectCombatName(object, { state: nameState, includeCorpseSpecies: false })
                : await objectDescription(object, { state: nameState }),
            shortFormat: simpleObjectNameWithArticle,
        }, state));
        if (answer === 'q')
            return false;
        if (answer === 'n')
            continue;
        if (known) {
            await disarmBox(box, {
                state, force, publish, random, rollOne, rollDice,
            });
        }
        else {
            await inspectBox(box, {
                state, force, ask, publish, random, rollOne, rollDice,
            });
        }
        return true;
    }
    await publish('There are no other chests or boxes here.');
    return null;
}
// Part of C trap.c:untrap(): inspect and disarm a door trap.
async function handleDoor(x, y, { state, force, trapSkipped, ask, publish, random, rollOne, }) {
    const door = state.level?.at?.(x, y);
    if (door?.typ !== DOOR) {
        if (!trapSkipped)
            await publish('You know of no traps there.');
        return false;
    }
    if (door.doormask === D_NODOOR) {
        await publish(`You ${heroIsBlind(state) ? 'feel' : 'see'} no door there.`);
        return false;
    }
    if (door.doormask === D_ISOPEN) {
        await publish('This door is safely open.');
        return false;
    }
    if (door.doormask === D_BROKEN) {
        await publish('This door is broken.');
        return false;
    }
    const impaired = heroIsImpaired(state);
    const found = ((door.doormask & D_TRAPPED)
        && (force || (!impaired
            && random(MAXULEV - (state.u?.ulevel ?? 1) + 11) < 10)))
        || (!force && impaired && random(3) === 0);
    if (!found) {
        await publish('You find no traps on the door.');
        return true;
    }
    await publish('You find a trap on the door!');
    await exerciseAttribute(A_WIS, true, state);
    if (await ask('Disarm it?') !== 'y')
        return true;
    if (!(door.doormask & D_TRAPPED)) {
        await publish('This door was not trapped.');
        return true;
    }
    const level = state.u?.ulevel ?? 1;
    const chance = 15 + (state.urole?.key === 'rogue' ? level * 3 : level);
    await exerciseAttribute(A_DEX, true, state);
    if (!force && (impaired || heroIsFumbling(state)
        || rollOne(75 + Math.trunc(level_difficulty() / 2)) > chance)) {
        await publish('You set it off!');
        await triggerDoorTrap(door, x, y, { state, publish, rollOne });
    }
    else {
        await publish('You disarm it!');
        door.doormask &= ~D_TRAPPED;
        await awardExperience(8, 0, state, publish);
    }
    return true;
}
// Part of C trap.c:untrap(): trigger a failed door disarm and update terrain and shop damage.
async function triggerDoorTrap(door, x, y, { state, publish, rollOne }) {
    if (await triggerBoobyTrap('door', { bodypart: true, state, publish, rollOne }))
        return;
    door.doormask = D_NODOOR;
    vision_note_blocker_change(x, y);
    await newsym(x, y);
    if (roomsAt(state.level, x, y, SHOPBASE).length)
        addShopDamage(x, y, 0, state);
}
// C trap.c:openholdingtrap()
export async function openHoldingTrap(target, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (!target)
        return result(false, false, state);
    const { hero, trap } = targetTrap(target, state);
    let description;
    let owner;
    if (hero && state.u.utrap) {
        description = new Map([
            [TT_LAVA, 'molten lava'], [TT_INFLOOR, 'ground'],
            [TT_BURIEDBALL, 'your anchor'], [TT_BEARTRAP, 'bear trap'],
            [TT_PIT, 'pit'], [TT_WEB, 'web'],
        ]).get(state.u.utraptype ?? 0) || 'trap';
        owner = state.u.utraptype === TT_BURIEDBALL ? ''
            : trap?.tseen && trap.madeby_u ? 'your ' : 'the ';
    }
    else {
        if (!trap || ![BEAR_TRAP, WEB].includes(trap.ttyp))
            return result(false, false, state);
        description = trapName(trap.ttyp, { state });
        owner = trap.tseen ? trap.madeby_u ? 'your ' : 'the '
            : /^[aeiou]/i.test(description) ? 'an ' : 'a ';
    }
    if (hero) {
        if (!state.u.utrap)
            return result(false, false, state);
        const steed = state.u.usteed;
        const subject = !steed ? 'You are'
            : state.u.utraptype === TT_BURIEDBALL
                ? `You and ${monsterName(steed, { article: 'your', state })} are`
                : `${monsterName(steed, { capitalized: true, suppressIt: true, state })} is`;
        // Native prints before reset_utrap(), which can announce levitation.
        await plineWithContinuation(`${subject} released from ${owner}${description}.`);
        state.vision_full_recalc = 1;
        await resetUtrap(true, state);
        if (state.vision_full_recalc)
            await vision_recalc(0);
        return result(true, true, state);
    }
    if (!('mnum' in target) || !trap)
        throw new Error('Monster trap release requires a trapped monster.');
    if (!target.mtrapped)
        return result(false, false, state);
    target.mtrapped = 0;
    let noticed = false;
    if (canSpotMonster(target)) {
        noticed = true;
        await plineWithContinuation(`${monsterName(target, { capitalized: true, state })} is released from ${owner}${description}.`);
    }
    else if (trap.tseen && cansee(trap.tx, trap.ty)) {
        noticed = true;
        const text = trap.ttyp === WEB ? `Something is released from ${owner}${description}.`
            : `${owner.charAt(0).toUpperCase()}${owner.slice(1)}${description} opens.`;
        await plineWithContinuation(text);
    }
    if (rn2(2) && Math.max(Math.abs(target.mx - state.u.ux), Math.abs(target.my - state.u.uy)) <= 1)
        await rewardMonsterRescue(trap, target, { state });
    return result(true, noticed, state);
}
// Magic releases and activates traps without removing them.
// C trap.c:openholdingtrap(), closeholdingtrap(), openfallingtrap().
// Part of C trap.c:openholdingtrap(), trap.c:closeholdingtrap(), trap.c:openfallingtrap(): resolve a hero or monster's trap square.
function targetTrap(target, state) {
    const hero = target === state.u || target === state.u.usteed;
    if (!hero && !('mnum' in target))
        throw new TypeError('Trap magic requires the live hero or a monster.');
    const x = 'mnum' in target && !hero ? target.mx : state.u.ux;
    const y = 'mnum' in target && !hero ? target.my : state.u.uy;
    return { hero, trap: state.level.traps.find(t => t.tx === x && t.ty === y) };
}
// C trap.c:closeholdingtrap()
export async function closeHoldingTrap(target, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (!target)
        return result(false, false, state);
    const { hero, trap } = targetTrap(target, state);
    if (!trap || ![BEAR_TRAP, WEB].includes(trap.ttyp))
        return result(false, false, state);
    return activateTrap(target, hero, trap, state, false);
}
// Part of C trap.c:closeholdingtrap(), trap.c:openfallingtrap(): force an eligible hero or monster trap effect.
async function activateTrap(target, hero, trap, state, falling) {
    if (hero) {
        if (state.u.utrap)
            return result(false, false, state);
        await dotrap(trap, {
            forceTrap: true, noWebMessage: !falling && !!state.u.usteed, gotoLevel,
        });
        return result(!!state.u.utrap, true, state);
    }
    if (!('mnum' in target))
        throw new Error('Monster trap activation requires a monster.');
    if (target.mtrapped)
        return result(false, false, state);
    const noticed = cansee(trap.tx, trap.ty) || canSpotMonster(target);
    if (falling && (await wakeMonster(target, { attacked: true })).heroDied)
        return result(false, noticed, state);
    const action = await mintrap(target, state, { forcetrap: true });
    // Native mintrap's nonzero results are caught, dead, or moved.
    const changed = !!target.mtrapped || (target.mhp ?? 1) <= 0
        || action.movement.actorLeftLevel || action.movement.actorDied
        || action.movement.moved;
    return result(!!changed, noticed, state);
}
// C trap.c:openfallingtrap()
export async function openFallingTrap(target, { trapdoorOnly = false, state = game, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (!target)
        return result(false, false, state);
    const { hero, trap } = targetTrap(target, state);
    if (!trap || (![TRAPDOOR, ROCKTRAP].includes(trap.ttyp)
        && (trapdoorOnly || (trap.ttyp !== HOLE && !is_pit(trap.ttyp)))))
        return result(false, false, state);
    return activateTrap(target, hero, trap, state, true);
}
const BLIND_GAS = [
    'humid', 'odorless', 'pungent', 'chilling', 'acrid', 'biting',
];
// C trap.c:chest_trap(). One-shot container traps, including their luck save.
export async function triggerChestTrap(container, { state = game, disarm = false, bodyPart = body_part(HAND, state), random = rn2, rollDice = d, publish = plineWithContinuation, } = {}) {
    if (!container?.otrapped)
        return null;
    const foundLocation = getObjectLocation(container, state);
    if (foundLocation) {
        container.ox = foundLocation.x;
        container.oy = foundLocation.y;
    }
    const location = { x: container.ox, y: container.oy };
    container.tknown = false;
    container.otrapped = false;
    await publish(`You ${disarm ? 'set it off' : 'trigger a trap'}!`);
    await displayMessageWindow();
    const luck = Luck(state.u);
    if (luck > -13 && random(13 + luck) > 7) {
        const savedOutcome = random(13);
        const message = savedOutcome >= 11 ? 'explosive charge is a dud'
            : savedOutcome >= 9 ? 'electric charge is grounded'
                : savedOutcome >= 7 ? 'flame fizzles out'
                    : savedOutcome >= 4 ? 'poisoned needle misses' : 'gas cloud blows away';
        await publish(`But luckily the ${message}!`);
        container.tknown = true;
        return { outcome: 'luck-save', damage: 0, destroyed: false };
    }
    const outcome = random(20) === 0 ? random(26) : luck >= 13 ? 0 : random(13 - luck);
    let result;
    switch (outcome) {
        case 25:
        case 24:
        case 23:
        case 22:
        case 21: {
            const spot = costlySpot(location.x, location.y, state);
            const insider = !!spot && !!insideShopRoomAt(state, state.u.ux, state.u.uy)
                && state.u.ushops?.[0] === spot.roomno;
            await publish(`${definiteObjectAction(container, 'explode', state)}!`);
            const killer = `exploding ${objectCombatName(container, { state, includeCorpseSpecies: false })}`;
            // Charge while the objects and their bills still exist, before damage
            // can end the game and settle the hero's debt through inheritance.
            let loss = spot ? await stolenValue(container, location.x, location.y, spot.resident.mpeaceful, { state, publish, silent: true }) : 0;
            await deleteObjectContents(container, state);
            const ball = state.uball || state.u?.uball;
            const chain = state.uchain || state.u?.uchain;
            if ((chain && chain.ox === location.x && chain.oy === location.y)
                || (ball?.where === 'floor' && ball.ox === location.x && ball.oy === location.y))
                await unpunishHero(state);
            let containerDestroyed = false;
            const pile = [...(state.level?.objects?.[location.x]?.[location.y] || [])];
            for (const object of pile) {
                if (spot)
                    loss += await stolenValue(object, object.ox, object.oy, spot.resident.mpeaceful, { state, publish, silent: true });
                if (object === container)
                    containerDestroyed = true;
                await delobj(object, state);
            }
            await wakeMonstersNearWithMessages(state.u.ux, state.u.uy, (state.u.ulevel ?? 1) * 20, state, publish);
            const rolledDamage = rollDice(6, 6);
            const damage = state.u?.halfPhysicalDamage ? Math.trunc((rolledDamage + 1) / 2) : rolledDamage;
            if (await loseHeroHp(damage, killer, { state, publish })) {
                result = { outcome: 'explosion', damage, destroyed: containerDestroyed, died: true };
                break;
            }
            await exerciseAttribute(A_STR, false, state);
            if (spot && loss) {
                const money = `${loss} ${currency(loss, { state })}`;
                if (insider)
                    await publish(`You owe ${money} for objects destroyed.`);
                else {
                    await publish(`You caused ${money} worth of damage!`);
                    await makeAngryShopkeeper(spot.resident, state);
                }
            }
            result = { outcome: 'explosion', damage, destroyed: containerDestroyed };
            break;
        }
        case 20:
        case 19:
        case 18:
        case 17: {
            await publish(`A cloud of noxious gas billows from ${definiteName(objectCombatName(container, { state, includeCorpseSpecies: false }), state)}.`);
            if (random(3) !== 0) {
                const poison = await poisonHero({
                    reason: 'gas cloud',
                    killer: 'cloud of poison gas',
                    attribute: A_STR,
                    fatal: 15,
                    state,
                    random,
                    rollDice,
                    publish,
                });
                if (poison.died) {
                    result = { outcome: 'noxious-gas', destroyed: false, died: true };
                    break;
                }
            }
            else {
                await createPoisonGasCloud(state, location.x, location.y, 1, 8, random, publish);
            }
            await exerciseAttribute(A_CON, false, state);
            result = { outcome: 'noxious-gas', destroyed: false };
            break;
        }
        case 16:
        case 15:
        case 14:
        case 13: {
            await publish(formatFeltMessage(`a needle prick your ${bodyPart}.`, state));
            const poison = await poisonHero({
                reason: 'needle',
                killer: 'poisoned needle',
                attribute: A_CON,
                fatal: 10,
                state,
                random,
                rollDice,
                publish,
            });
            if (!poison.died)
                await exerciseAttribute(A_CON, false, state);
            {
                result = {
                    outcome: 'poisoned-needle',
                    damage: poison.damage,
                    destroyed: false,
                    died: poison.died,
                };
                break;
            }
        }
        case 12:
        case 11:
        case 10:
        case 9: {
            const fire = await triggerHeroFireTrap(container, { publish });
            result = { outcome: 'fire', destroyed: false, died: fire.died };
            break;
        }
        case 8:
        case 7:
        case 6: {
            const originalDamage = rollDice(4, 4);
            let damage = originalDamage;
            await publish('You are jolted by a surge of electricity!');
            if (state.u?.shockResistance) {
                if (state === game)
                    await shieldeff(state.u.ux, state.u.uy);
                await publish("You don't seem to be affected.");
                monstersObserveHeroResistance(M_SEEN_ELEC, state);
                damage = 0;
            }
            else {
                monstersForgetHeroResistance(M_SEEN_ELEC, state);
            }
            const items = await destroyElectricInventory(originalDamage, {
                state, publish, random,
            });
            if (items.heroDied) {
                result = { outcome: 'electric-shock', died: true };
                break;
            }
            const died = damage > 0 && await loseHeroHp(damage, 'electric shock', { state, publish });
            result = { outcome: 'electric-shock', damage, destroyed: false, died };
            break;
        }
        case 5:
        case 4:
        case 3: {
            if (heroHasFreeAction(state)) {
                await publish('You momentarily stiffen.');
                result = { outcome: 'paralysis', duration: 0, destroyed: false };
                break;
            }
            await publish('Suddenly you are frozen in place!');
            const duration = rollDice(5, 6);
            nomul(-duration, state);
            state._helplessReason = 'frozen by a trap';
            state._helplessDoneMessage = 'You can move again.';
            await exerciseAttribute(A_DEX, false, state);
            result = { outcome: 'paralysis', duration, destroyed: false };
            break;
        }
        case 2:
        case 1:
        case 0: {
            const blind = heroIsBlind(state);
            const description = blind
                ? BLIND_GAS[random(BLIND_GAS.length)]
                : randomColorName(state, random);
            await publish(`A cloud of ${description} gas billows from ${definiteName(objectCombatName(container, { state, includeCorpseSpecies: false }), state)}.`);
            const alreadyStunned = state.u?.stunned
                || (state.u?.stunnedTurns ?? 0) > 0;
            const hallucinating = heroIsHallucinating(state);
            if (!alreadyStunned) {
                if (hallucinating)
                    await publish('What a groovy feeling!');
                else {
                    const movement = monsterStagger(heroSpecies(state), 'stagger');
                    const feeling = state.u.hallucinationResistance ? ''
                        : blind ? ' and get dizzy' : ' and your vision blurs';
                    await publish(`You ${movement}${feeling}...`);
                }
            }
            await makeStunned((state.u.stunnedTurns ?? 0) + 16 + random(7), { state, talk: false });
            await makeHallucinated((state.u.hallucinationTurns ?? 0) + 16 + random(5), {
                state, talk: false, publish,
            });
            result = { outcome: 'stunning-gas', destroyed: false };
            break;
        }
        default: throw new Error(`Invalid chest trap outcome: ${outcome}`);
    }
    // C trap.c:6494-6497: bot() and tknown=1 run after surviving outcomes
    // (including a life-saved or declined death); done() never returns for a
    // real death, so a fatal outcome leaves tknown clear for the bones file.
    if (!result.destroyed && !result.died) {
        await bot();
        container.tknown = true;
    }
    return result;
}
// C trap.c:t_at(). The level keeps at most one trap per square.
export function trapAt(state, x, y) {
    return state?.level?.traps?.find((trap) => trap.tx === x && trap.ty === y);
}
// C trap.c:count_traps(). Count only traps of the requested type on the current level.
export function count_traps(type, state = game) {
    return (state.level?.traps || []).filter(trap => trap.ttyp === type).length;
}
// C trap.c:conjoined_pits(): both pits must be on the map and linked by
// their conjoined bits. C's u_entering_trap2 gate (the hero already caught
// in a pit) is applied by the callers, as dotrap() and trapeffect_pit()
// pass TRUE right after checking u.utrap (trap.c:1838, trap.c:3004).
// The conjoined direction bits are found through sgn()/xytodir() in pitDirection.
export function pitsAreConjoined(first, second) {
    if (!first || !second || !is_pit(first.ttyp) || !is_pit(second.ttyp)
        || !isok(first.tx, first.ty) || !isok(second.tx, second.ty))
        return false;
    const direction = pitDirection(first, second);
    return direction >= 0 && !!((first.conjoined ?? 0) & (1 << direction))
        && !!((second.conjoined ?? 0) & (1 << ((direction + 4) % 8)));
}
// Part of C trap.c:conjoined_pits(): the pit offset it derives with sgn()
// and xytodir(); Math.sign() and the xdir/ydir table lookup are those two
// callees inlined here.
export function pitDirection(from, to) {
    const dx = Math.sign(to.tx - from.tx);
    const dy = Math.sign(to.ty - from.ty);
    return xdir.findIndex((x, i) => i < 8 && x === dx && ydir[i] === dy);
}
// C trap.c:clear_conjoined_pits().
export function clearPitConnections(trap, state = game) {
    if (!trap || !is_pit(trap.ttyp))
        return;
    for (let direction = 0; direction < 8; direction++) {
        if (!((trap.conjoined ?? 0) & (1 << direction)))
            continue;
        const dx = xdir[direction], dy = ydir[direction];
        if (dx === undefined || dy === undefined)
            throw new Error('Missing pit direction.');
        const x = trap.tx + dx, y = trap.ty + dy;
        const other = isok(x, y) ? requireGameLevel(state).traps.find(candidate => candidate.tx === x && candidate.ty === y
            && is_pit(candidate.ttyp)) : null;
        if (other)
            other.conjoined = (other.conjoined ?? 0) & ~(1 << ((direction + 4) % 8));
        trap.conjoined = (trap.conjoined ?? 0) & ~(1 << direction);
    }
}
// C trap.c:adj_nonconjoined_pit(): the hero stepped out of one pit into a
// neighboring pit in a diagonal or cardinal move (xytodir(u.dx, u.dy) !=
// DIR_ERR); the pair is not conjoined.
function adjNonconjoinedPit(adjtrap, state = game) {
    const trapWithHero = trapAt(state, state.u.ux0, state.u.uy0);
    return !!(trapWithHero && adjtrap && state.u.utrap && state.u.utraptype === TT_PIT
        && is_pit(trapWithHero.ttyp) && is_pit(adjtrap.ttyp)
        && (state.u.dx || state.u.dy));
}
// C trap.c:uteetering_at_seen_pit().
export function heroTeetersAtPit(state, trap) {
    return !!trap && is_pit(trap.ttyp) && !!trap.tseen
        && trap.tx === state.u.ux && trap.ty === state.u.uy
        && !(state.u?.utrap && state.u.utraptype === TT_PIT);
}
// C trap.c:uescaped_shaft().
export function heroEscapedShaft(trap) {
    return !!trap && is_hole(trap.ttyp) && !!trap.tseen;
}
// C trap.c:delfloortrap().  Destroys a trap which emanates from the floor,
// freeing a hero or monster caught in it.  Portal-like and special traps are
// not floor traps and are rejected.
export async function deleteFloorTrap(trap, state = game) {
    if (!trap)
        return false;
    const ttyp = trap.ttyp;
    const removable = ttyp === SQKY_BOARD || ttyp === BEAR_TRAP
        || ttyp === LANDMINE || ttyp === FIRE_TRAP || is_pit(ttyp)
        || is_hole(ttyp) || ttyp === TELEP_TRAP || ttyp === LEVEL_TELEP
        || ttyp === WEB || ttyp === MAGIC_TRAP || ttyp === ANTI_MAGIC;
    if (!removable)
        return false;
    if (state.u?.ux === trap.tx && state.u?.uy === trap.ty) {
        // C reset_utrap(TRUE): a freed hero may resume floating.
        if (state.u.utraptype !== TT_BURIEDBALL) {
            await resetUtrap(true, state);
        }
    }
    else {
        const monster = (state.level?.monsters || []).find(candidate => monsterHasMapPosition(candidate, state) &&
            !candidate.dead && monsterOccupiesPosition(candidate, trap.tx, trap.ty));
        if (monster)
            monster.mtrapped = 0;
    }
    deleteTrap(trap, state);
    return true;
}
// C trap.c:b_trapped(). Door and tin explosions share damage and stun rules.
export async function triggerBoobyTrap(item, { bodypart = false, state = game, publish = plineWithContinuation, rollOne = rnd, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const difficulty = level_difficulty();
    const damage = rollOne(5 + (difficulty < 5 ? difficulty : 2 + Math.trunc(difficulty / 2)));
    await publish(`KABOOM!!  The ${item} was booby-trapped!`);
    await wakeMonstersNearWithMessages(state.u.ux, state.u.uy, state.u.ulevel * 20, state, publish);
    const half = state.u.halfPhysicalDamage;
    if (await loseHeroHp(half ? Math.trunc((damage + 1) / 2) : damage, 'explosion', { state, publish }))
        return true;
    await exerciseAttribute(A_STR, false, state);
    if (bodypart)
        await exerciseAttribute(A_CON, false, state);
    await makeStunned((state.u.stunnedTurns || 0) + damage, { state, talk: true, publish });
    return !!state.program_state.gameover;
}
// C trap.c:thitm() redraws the original square after a lethal hit, even
// when make_corpse() already displayed the remains. Life-saving skips it.
export async function finishMonsterTrapDeath(monster, state, options) {
    const x = monster.mx;
    const y = monster.my;
    const death = await finishMonsterKilled(monster, state, options);
    if (!death.survived && !death.heroDied && state === game)
        await newsym(x, y);
    return death;
}
// C trap.c:unconscious(), narrower than Unaware (which also includes fainting).
export function heroIsUnconscious(state = game) {
    if (!heroHasInvoluntaryDelay(state))
        return false;
    const message = state._helplessDoneMessage || '';
    return !!state.u?.usleep || message.startsWith('You awake')
        || message.startsWith('You regain con')
        || message.startsWith('You are consci');
}
// C trap.c:lava_effects(). Keep the recursion counter raised through rescue teleportation.
export async function lava_effects(options) {
    const state = options.state || game;
    const from = { x: state.u.ux, y: state.u.uy };
    const spoteffects = options.applyLandingEffects;
    state.iflags ||= {};
    state.iflags.in_lava_effects = (state.iflags.in_lava_effects || 0) + 1;
    let result;
    try {
        const { location, publish, random, rollDice, rollOne, repaint, resetVision, recalculateVision, applyLandingEffects, die } = options;
        lavaOutcome: {
            // Ordinary death returns no value; damage handling needs the final state.
            // These deaths come through losehp(), which prints "You die..." itself.
            const finishDamageDeath = async (options) => {
                await die({ ...options, deathLineShown: false });
                return !!state.program_state.gameover;
            };
            const hero = state.u;
            const damage = rollDice(6, 6);
            // C lava_effects() maps the liquid by touch before its first message.
            if (state === game)
                await feel_newsym(hero.ux, hero.uy);
            await burnAwayHeroSlime(state, publish);
            if (heroLikesLava(state)) {
                result = { entered: true, moved: false, died: false };
                break lavaOutcome;
            }
            const fireResistant = heroResistsFireWithoutArtifactDefense(state);
            const waterWalkingBeforeBootsBurn = heroHasWaterWalking(state);
            const survives = fireResistant
                || (waterWalkingBeforeBootsBurn && damage < (hero.uhp ?? 0));
            let protectedObject = null;
            if (!survives) {
                for (const object of state.inventory) {
                    if (object.in_use) {
                        if (!protectedObject) {
                            protectedObject = object;
                            object.in_use = false;
                        }
                        else {
                            await impossible(`lava_effects: object #${object.o_id} is already in use; so is #${protectedObject.o_id}.`);
                        }
                        continue;
                    }
                    if (!object.oerodeproof && (objectIsOrganic(object) || object.oclass === POTION_CLASS)
                        && !FIRE_RESISTANT_OBJECTS.has(object.otyp) && object.otyp !== SCR_FIRE
                        && object.otyp !== SPE_FIREBALL && !objectResistsDestruction(object, 0, 0, random))
                        object.in_use = true;
                }
            }
            let bootsBurned = false;
            const boots = state.uarmf || state.u?.uarmf;
            if (boots && (boots.in_use || (!boots.oerodeproof && objectIsOrganic(boots, state)))) {
                await publish(`${ownedObjectAction(boots, 'burst', state)} into flame!`);
                if (boots === protectedObject) {
                    await removeWornHeroItem(boots, state);
                }
                else {
                    await destroyWornArmor(boots, state);
                    boots.worn = false;
                    boots.wornSlot = null;
                    boots.owornmask = 0;
                    boots.where = 'gone';
                }
                bootsBurned = true;
            }
            const waterWalking = heroHasWaterWalking(state);
            if (!fireResistant) {
                if (waterWalking) {
                    await publish(`The ${displayLiquidName('lava', state)} here burns you!`);
                    if (survives) {
                        if (await loseHeroHp(damage, 'molten lava', {
                            state, publish, die: finishDamageDeath, deathCause: 'killed by molten lava',
                        })) {
                            result = { entered: true, moved: false, died: true };
                            break lavaOutcome;
                        }
                        const items = await destroyFireInventory(damage, {
                            state, publish, random, rollOne, die: finishDamageDeath,
                        });
                        if (items.heroDied) {
                            result = { entered: true, moved: false, died: true };
                            break lavaOutcome;
                        }
                        await igniteItems(state.inventory, { state, publish, random });
                        result = { entered: true, moved: false, died: false };
                        break lavaOutcome;
                    }
                }
                else {
                    await publish(`You fall into the ${waterbodyName(hero.ux, hero.uy, state)}!`);
                }
                const lifeSaver = state.uamul || hero.uamul;
                const willSurvive = lifeSaver?.otyp === AMULET_OF_LIFE_SAVING
                    || state.flags?.debug || state.flags?.explore;
                let named = bootsBurned ? 1 : 0;
                let unnamed = 0;
                for (const object of [...(state.inventory || [])]) {
                    if (object === protectedObject) {
                        object.in_use = true;
                        continue;
                    }
                    if (object.otyp === SPE_BOOK_OF_THE_DEAD) {
                        // C: The(xname(obj)) glows a strange hcolor("dark red").
                        if (willSurvive && !heroIsBlind(state)) {
                            observeObject(object, state);
                            await publish(`The ${objectName(object, state)} glows a strange ${displayColorName('dark red', state)}, but remains intact.`);
                        }
                        continue;
                    }
                    if (!object.in_use)
                        continue;
                    const wasWorn = !!object.worn || !!object.owornmask;
                    if (willSurvive && wasWorn) {
                        await publish(`${ownedObjectAction(object, 'burst', state)} into flame!`);
                        named++;
                    }
                    else {
                        unnamed++;
                    }
                    await removeWornHeroItem(object, state);
                    if (state.program_state?.gameover) {
                        result = { entered: true, moved: false, died: true };
                        break lavaOutcome;
                    }
                    await useUpInventoryStack(object, state);
                    if (state.program_state?.gameover) {
                        result = { entered: true, moved: false, died: true };
                        break lavaOutcome;
                    }
                }
                if (willSurvive && unnamed) {
                    const subject = named
                        ? unnamed === 1 ? 'Another item' : 'Other items'
                        : unnamed === 1 ? 'An item' : 'Some items';
                    await publish(`${subject} in your inventory ${unnamed === 1 ? 'has' : 'have'} been destroyed.`);
                }
                if (state.program_state?.gameover) {
                    result = { entered: true, moved: false, died: true };
                    break lavaOutcome;
                }
                let rescue = null;
                for (let attempt = 0; attempt < 2; attempt++) {
                    state.u.uhp = -1;
                    // C trap.c:6922-6934: water elementals, steam vortices, and fog
                    // clouds boil away instead of burning to a crisp.
                    const boilsAway = [PM_WATER_ELEMENTAL, PM_STEAM_VORTEX, PM_FOG_CLOUD]
                        .includes(heroSpecies(state));
                    await publish(`You ${boilsAway ? 'boil away' : 'burn to a crisp'}...`, { urgent: true });
                    if (!await reviveHeroFromLiquid(state, publish, random)) {
                        await die({
                            killer: 'molten lava',
                            possessionAnswer: 'n',
                            deathVerb: 'burned',
                            deathType: BURNING,
                        });
                        if (state.program_state.gameover) {
                            rescue = { entered: true, moved: false, died: true };
                            break;
                        }
                    }
                    if (state.program_state?.gameover) {
                        rescue = { entered: true, moved: false, died: true };
                        break;
                    }
                    const escape = await teleportHeroOutOfLiquid({
                        state, random, rollOne, publish, repaint, resetVision,
                        recalculateVision, applyLandingEffects,
                    });
                    if (escape) {
                        rescue = escape;
                        break;
                    }
                    await publish("You're still burning.");
                }
                if (!rescue) {
                    // C lava_effects(): two recoveries without a landing give the hero
                    // five turns to find another way out before the lava becomes fatal again.
                    if (!heroResistsFireWithoutArtifactDefense(state))
                        setPropertyTimeout('fireResistance', 5, state);
                    if (!heroHasWaterWalking(state))
                        setPropertyTimeout('waterWalking', 5, state);
                    rescue = { entered: true, moved: false, died: false };
                }
                if (rescue.died || rescue.moved) {
                    result = rescue;
                    break lavaOutcome;
                }
                const items = await destroyFireInventory(damage, {
                    state, publish, random, rollOne, die: finishDamageDeath,
                });
                if (items.heroDied) {
                    result = { ...rescue, died: true };
                    break lavaOutcome;
                }
                await igniteItems(state.inventory, { state, publish, random });
                result = rescue;
                break lavaOutcome;
            }
            let sank = false;
            if (!waterWalking
                && (!hero.utrap || hero.utraptype !== TT_LAVA)) {
                setHeroTrap(random(4) + 4 + ((random(4) + 12) << 8), TT_LAVA, state);
                await publish(`You sink into the ${waterbodyName(hero.ux, hero.uy, state)}, but it only burns slightly!`);
                monstersObserveHeroResistance(M_SEEN_FIRE, state);
                if (hero.uhp > 1 && await loseHeroHp(1, 'molten lava', {
                    state, publish, die: finishDamageDeath, deathCause: 'killed by molten lava',
                })) {
                    result = { entered: true, moved: false, died: true, sank: true };
                    break lavaOutcome;
                }
                sank = true;
            }
            const items = await destroyFireInventory(damage, {
                state, publish, random, rollOne, die: finishDamageDeath,
            });
            if (items.heroDied) {
                result = { entered: true, moved: false, died: true, sank };
                break lavaOutcome;
            }
            await igniteItems(state.inventory, { state, publish, random });
            result = { entered: true, moved: false, died: false, sank };
            break lavaOutcome;
        }
    }
    finally {
        state.iflags.in_lava_effects
            = Math.max(0, state.iflags.in_lava_effects - 1);
    }
    // C trap.c:6942-6961: the life-saving rescue's safe_teleds() runs while
    // the counter still suppresses its spoteffects; after the counter drops,
    // a rescue that relocated the hero gets the explicit spoteffects(FALSE)
    // landing -- full destination effects, but auto-pickup suppressed.
    if (result?.moved && !result?.died && spoteffects) {
        // C trap.c:6957: rescued_from_terrain(BURNING) precedes the
        // suppressed-pickup landing effects.
        await announceTerrainRescue(BURNING, state, options.publish);
        const landing = await spoteffects({
            from: result.from ?? from,
            to: { x: state.u.ux, y: state.u.uy },
            pick: false,
        });
        if (landing?.died)
            return { ...result, died: true };
    }
    return result;
}
// Part of C trap.c:lava_effects(), trap.c:sink_into_lava(): attempt safe teleportation out of lava.
export async function teleportHeroOutOfLiquid({ state, random, rollOne, publish, repaint, resetVision, recalculateVision, applyLandingEffects, }) {
    // C trap.c:6936/7021 call safe_teleds(TELEDS_ALLOW_DRAG | TELEDS_TELEPORT):
    // a light hero may drag an adjacent ball, and the verbose materialize
    // line precedes the landing effects (teleport.c:545-547).
    const landing = await safe_teleds(state, {
        random, rollOne, allowDrag: true,
        finishArrival: async (movement) => {
            if (state.flags?.verbose !== false) {
                await publish(`You materialize in ${movement.oldx === movement.x && movement.oldy === movement.y
                    ? 'the same' : 'a different'} location!`);
            }
            return finishLiquidTeleport(movement, {
                state, repaint, resetVision, recalculateVision, applyLandingEffects,
            });
        },
    });
    return landing ? landing.arrival : null;
}
// C trap.c:sink_into_lava().
export async function sinkHeroIntoLava({ state = game, publish = plineWithContinuation, random = rn2, rollOne = rnd, repaint = newsym, resetVision = vision_reset, recalculateVision = vision_recalc, applyLandingEffects = async () => { }, die = finishLiquidDeath, } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    if (!hero?.utrap || hero.utraptype !== TT_LAVA)
        return null;
    const location = state.level?.at?.(hero.ux, hero.uy);
    if (!location || !isLavaAt(state.u.ux, state.u.uy, state)) {
        await resetUtrap(false, state);
        return { escaped: true };
    }
    if (hero.invulnerable || hero.uinvulnerable)
        return { sank: false, died: false };
    if (!heroResistsFireWithoutArtifactDefense(state))
        hero.uhp = Math.trunc(((hero.uhp ?? 1) + 2) / 3);
    hero.utrap -= 1 << 8;
    if (hero.utrap < 1 << 8) {
        await publish('You sink below the surface and die.', { urgent: true });
        await burnAwayHeroSlime(state, publish);
        // sink_into_lava() leaves HP intact for done()'s initial status redraw.
        if (!await reviveHeroFromLiquid(state, publish, random)) {
            await die({
                killer: 'molten lava',
                possessionAnswer: 'n',
                deathVerb: 'dissolved',
                deathType: DISSOLVED,
            });
        }
        if (state.program_state.gameover)
            return { sank: true, died: true };
        await resetUtrap(true, state);
        const airborne = hero.levitating || hero.levitation
            || hero.flying;
        if (!airborne) {
            const escape = await teleportHeroOutOfLiquid({
                state, random, rollOne, publish, repaint, resetVision,
                recalculateVision, applyLandingEffects,
            });
            if (escape)
                return escape;
        }
        return { sank: true, died: false };
    }
    if (!hero.umoved) {
        const message = 'You sink deeper into the lava.';
        const slimeBurns = heroIsSliming(state)
            && rollOne(9) >= (hero.slimedTurns ?? 0);
        // C Norep() compares pline.c's previous individual message, not the
        // joined tty top line.
        if (slimeBurns || state._lastPlineMessage !== message) {
            await publish(message);
        }
        if (slimeBurns)
            await burnAwayHeroSlime(state, publish);
        hero.utrap += rollOne(4);
    }
    return { sank: true, died: false };
}
// C trap.c:sokoban_guilt().
export function sokobanGuilt(state) {
    if (!state.level?.flags?.sokoban_rules)
        return;
    if (!state.u.uconduct)
        state.u.uconduct = {};
    state.u.uconduct.sokocheat = (state.u.uconduct.sokocheat ?? 0) + 1;
    changeHeroLuck(-1, state);
}
// C trap.c:maybe_finish_sokoban()
export function finishSokobanIfSolved(state = game) {
    const level = requireGameLevel(state);
    if (!level.flags.sokoban_rules || state.in_mklev)
        return;
    if (level.traps.some(trap => !trap.madeby_u
        && (trap.ttyp === PIT || trap.ttyp === HOLE)))
        return;
    level.flags.sokoban_rules = false;
    requirePlayingGame(state);
    const dungeon = state.dungeons[state.u.uz.dnum];
    if (!dungeon)
        throw new Error('A solved Sokoban level requires its dungeon.');
    const number = dungeon.entry_lev - state.u.uz.dlevel + 1;
    recordGameLogEvent(`completed ${number}${ordinalSuffix(number)} Sokoban level`, {
        state,
        flags: LL_MINORAC | LL_DUMP,
    });
}
// C trap.c:trapname(). Cosmetic trap choices use the display RNG.
const HALLUCINATED_TRAPS = [
    "bottomless pit",
    "polymorphism trap",
    "devil teleporter",
    "falling boulder trap",
    "anti-anti-magic field",
    "weeping gas trap",
    "queasy board",
    "electrified web",
    "owlbear trap",
    "sand mine",
    "vacillating triangle",
    "death trap",
    "disintegration trap",
    "ice trap",
    "monochrome trap",
    "axeblade trap",
    "pool of boiling oil",
    "pool of quicksand",
    "field of caltrops",
    "buzzsaw trap",
    "spiked floor",
    "revolving wall",
    "uneven floor",
    "finger trap",
    "jack-in-a-box",
    "yellow snow",
    "booby trap",
    "rat trap",
    "poisoned nail",
    "snare",
    "whirlpool",
    "trip wire",
    "roach motel (tm)",
    "negative space",
    "tensor field",
    "singularity",
    "imperial fleet",
    "black hole",
    "thermal detonator",
    "event horizon",
    "entoptic phenomenon",
    "sweet-smelling gas vent",
    "phone booth",
    "exploding runes",
    "never-ending elevator",
    "slime pit",
    "warp zone",
    "illusory floor",
    "pile of poo",
    "honey trap",
    "tourist trap",
    "banana peel",
    "garden rake",
    "whoopie cushion",
    "box and stick trap",
    "fly trap",
    "legal trap",
    "pit of snakes",
    "pollywog trap",
    "slippery slope",
    "thirst trap",
    "suntrap"
];
// C trap.c:trapname()
export function trapName(type, { ignoreHallucination = false, state = game } = {}) {
    if (heroIsHallucinating(state) && !ignoreHallucination) {
        const total = TRAPNUM + HALLUCINATED_TRAPS.length;
        const index = rn2Display(total + 1);
        if (index === total) {
            requirePlayingGame(state);
            const female = Upolyd(state.u) ? state.u.mfemale : state.flags.female;
            const names = rn2(3)
                ? (female && state.urole.name.f ? state.urole.name.f : state.urole.name.m)
                : rankOf(state.u.ulevel, roleSwitch(state), !!female, state);
            return `${names.slice(0, 27)} trap`.toLowerCase();
        }
        if (index >= TRAPNUM) {
            const name = HALLUCINATED_TRAPS[index - TRAPNUM];
            if (name === undefined)
                throw new RangeError(`Invalid hallucinated trap ${index}`);
            return name;
        }
        if (index !== 0)
            type = index;
    }
    const name = TRAP_EXPLANATIONS[type];
    if (name === undefined)
        throw new RangeError(`Invalid native trap type ${type}`);
    return name;
}
// C trap.c:ignite_items()
// Also C apply.c:catch_lit(): each ignitable object catches fire through
// apply.ts:catchLit(), which owns C's catch_lit() body; the loop owns only
// the chain walk and the visibility the caller observed.
export async function igniteItems(objects, { state = game, publish = async () => { }, random = rn2, visible = true, } = {}) {
    const ignited = [];
    for (const object of objects || []) {
        // catch_lit() requires a current location, even during floor effects.
        if (await catchLit(object, { state, publish, random, visible }))
            ignited.push(object);
    }
    return ignited;
}
// C trap.c:trap_ice_effects(): melting ice frees a trapped monster and
// removes the trap beneath it — a landmine or bear trap sinks as its
// object; MAGIC_PORTAL and VIBRATING_SQUARE (undestroyable_trap) survive.
export async function meltIceTrap(x, y) {
    const trap = requireGameLevel(game).traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (!trap)
        return;
    const monster = monsterAtPosition(requireGameLevel(game), x, y);
    if (monster?.mtrapped)
        monster.mtrapped = 0;
    if (trap.ttyp === LANDMINE || trap.ttyp === BEAR_TRAP) {
        await convertTrapToObject(trap, trap.ttyp === LANDMINE ? LAND_MINE : BEARTRAP, 1, game, { bury: true });
    }
    else if (trap.ttyp !== MAGIC_PORTAL && trap.ttyp !== VIBRATING_SQUARE) {
        deleteTrap(trap);
    }
}
// Port only: combine the shared monster stone cure and immediate petrification boundaries.
export async function petrifyMonsterFromContact(monster, { creditHero = false, finishDeath, publish = plineWithContinuation, rollOne = rnd, state = game, } = {}) {
    const cure = await munstone(monster, {
        byHero: creditHero, publish, rollOne, state,
    });
    if (cure.consumed && cure.heroDied)
        return { heroDied: true };
    if (cure.consumed) {
        return {
            changed: true,
            survived: !cure.died,
            cured: !cure.died,
            cure,
        };
    }
    return petrifyMonsterImmediately(monster, {
        creditHero, finishDeath, publish,
    });
}
const PM_STEAM_VORTEX = MONSTER_NAME.indexOf('steam vortex');
const EROSION = {
    burn: { field: 'oeroded', verb: 'smoulder', past: 'burnt', cause: 'heat' },
    rust: { field: 'oeroded', verb: 'rust', past: 'rusted', cause: 'oxidation' },
    rot: { field: 'oeroded2', verb: 'rot', past: 'rotten', cause: 'decay' },
    corrosion: { field: 'oeroded2', verb: 'corrode', past: 'corroded', cause: 'corrosion' },
    crack: { field: 'oeroded', verb: 'crack', past: 'cracked', cause: 'impact' },
};
// Port only: route liquid deaths through the shared death boundary.
export async function finishLiquidDeath(options) {
    // The liquid effect has usually announced the death already. done() still
    // owns life saving and the wizard/explore recovery question.
    return await finishHeroDeath({ ...options, deathLineShown: options.deathLineShown ?? true });
}
//# sourceMappingURL=trap.js.map