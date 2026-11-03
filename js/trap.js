import { formatSeenMessage, formatFeltMessage, formatHeardMessage, publishHeardMessage } from './hero_speech.js';
import { ANTI_MAGIC, ARROW_TRAP, BEAR_TRAP, DART_TRAP, FIRE_TRAP, HOLE, LANDMINE, LEVEL_TELEP, MAGIC_PORTAL, MAGIC_TRAP, MMOVE_DIED, PIT, POLY_TRAP, ROCKTRAP, ROLLING_BOULDER_TRAP, RUST_TRAP, SLP_GAS_TRAP, SQKY_BOARD, SPIKED_PIT, STATUE_TRAP, TELEP_TRAP, TRAPDOOR, VIBRATING_SQUARE, WEB, Is_waterlevel, W_ARM, W_ARMC, W_ARMF, W_ARMG, W_ARMH, W_ARMS, W_ARMU, W_SWAPWEP, W_WEP, is_pit, TRAPNUM, TRAP_EXPLANATIONS, Upolyd, TT_BEARTRAP, TT_BURIEDBALL, TT_INFLOOR, TT_LAVA, TT_PIT, TT_WEB, In_hell, In_quest, xdir, ydir, M_SEEN_FIRE, is_hole, SHOPBASE, A_CON, A_DEX, A_STR, A_WIS, DISMOUNT_FELL, DOOR, D_BROKEN, D_ISOPEN, D_NODOOR, D_TRAPPED, GETOBJ_DOWNPLAY, GETOBJ_EXCLUDE, GETOBJ_SUGGEST, MAXULEV, WT_TOOMUCH_DIAGONAL, M_SEEN_SLEEP, VAULT, Is_stronghold, MGIVENNAME, KILLED_BY, STONING, I_SPECIAL, DISMOUNT_GENERIC, IS_ROOM, Is_airlevel, W_SADDLE, CORR, DB_FLOOR, DB_UNDER, DRAWBRIDGE_UP, D_CLOSED, D_LOCKED, FOUNTAIN, IS_AIR, IS_DOOR, IS_FURNITURE, IS_WALL, Is_knox_level, LEVEL_TIMER_KIND, MM_NOCOUNTBIRTH, MM_NOMSG, ROOM, SCORR, SDOOR, SHOP_HOLE_COST, SINK, STONE, ZAP_POS, TRAPPED_DOOR, TRAPPED_CHEST, BURNING, DISSOLVED, DROWNING, IS_WATERWALL, PLNMSG_BACK_ON_GROUND } from './const.js';
import { isok } from './cmd.js';
import { armorSimpleName, heroHasWaterWalking, heroHasDrainResistance, objectIsHardHelmet } from './do_wear.js';
import { delobj, consumeObjectCharge } from './invent.js';
import { objectDescription as fullObjectDescription, verbForSubject, objectNameIsPlural, definiteName, objectCombatName, objectName, observeObjectForNaming, ownedObjectAction, ownedObjectName, simpleObjectName, corpseName, withIndefiniteArticle, objectDescription, makePlural, objectQuestion, simpleObjectNameWithArticle, bareArtifactOrPlainName, killerObjectName } from './objnam.js';
import { learnObjectType, observeObject, objectMaterial, objectClassForType, recordObjectKnowledge } from './o_init.js';
import { cansee, couldsee, vision_recalc, vision_note_blocker_change, vision_reset } from './vision.js';
import { endObjectBurn, beginObjectBurn } from './timeout.js';
import { LIGHT_TYPES, TIMED_LIGHT_TYPES } from './light.js';
import { iceDescriptionAt } from './dungeon_feature.js';
import { game, requireGameLevel, requireInitializedGame, requirePlayingGame, requireLiveGame } from './gstate.js';
import { removeHeroEquipment, removeWornHeroItem } from './hero_equipment.js';
import { useUpInventoryStack } from './hero_inventory.js';
import { MONSTER_FLAGS1, MONSTER_NAME, MONSTER_SIZE, MONSTER_SYMBOL, monsterIsHumanoid, MONSTER_ATTACKS, MONSTER_LEVEL, MONSTER_FLAGS2, monsterIsAmorphous, monsterIsUnsolid, monsterIsWhirly, MONSTER_BODY_META, MONSTER_GENO, MONSTER_MOVE, monsterIsMindless, monsterTypeName, monsterDigests, monsterIsAnimal, requireMonsterData, MONSTER_ALIGNMENT } from './monster_data.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { heroIsFlying, heroSpecies, heroCanSpinWeb, heroHasNoHands, heroFormSticks, heroPassesWalls, heroIsPolymorphed, returnHeroToHumanForm, polymonHero } from './polyself.js';
import { isPoolAt, isIceAt, isLavaAt } from './dbridge.js';
import { levelHasCeiling, level_difficulty, specialPrototypeAt, levelIsWaterLevel as heroIsOnWaterLevel } from './dungeon.js';
import { monsterFliesOrFloats, monsterInAir, angerMonster, finishEnvironmentalMonsterDeath, maybeUnhideAt, finishMonsterKilled, finishMonsterPetrification, monsterSubject, restoreShapechanger, turnGolemToStone, wakeMonster, wakeMonstersNearWithMessages } from './mon.js';
import { objectOwnershipPrefix, chargeAlteredUnpaidObject, sellHeroDroppedObject, deleteObject, objectTypeKnown, addShopDamage, shopDig, billDummyObject, chargeUnpaidUsage, costlySpot } from './shk.js';
import { monsterWieldedWeapon, unwieldMonsterWeapon, dryTowel, wetTowel, rollPhysicalWeaponDamage, rollPhysicalWeaponDamageAgainstHero } from './weapon.js';
import { BAG_OF_TRICKS, BOULDER, BRASS_LANTERN, CAN_OF_GREASE, CANDELABRUM_OF_INVOCATION, CHEST, ICE_BOX, FIRE_HORN, LARGE_BOX, OBJECT_MATERIAL_NAMES, OBJECT_PROPERTY, OILSKIN_SACK, MAGIC_LAMP, OIL_LAMP, POT_ACID, POT_OIL, POT_WATER, RED_DRAGON_SCALE_MAIL, RED_DRAGON_SCALES, RIN_FIRE_RESISTANCE, SCR_BLANK_PAPER, SCR_FIRE, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, SPE_FIREBALL, SPE_NOVEL, TALLOW_CANDLE, TOWEL, WAN_FIRE, WAX_CANDLE, DWARVISH_CLOAK, OBJECT_SUBTYPE, CORPSE, DART, STATUE, ARROW, BEARTRAP, LAND_MINE, ROCK, SADDLE } from './object_data.js';
import { isBimanualObject, isBlade } from './object_properties.js';
import { displayColorName, displayLiquidName, canSeeMonster, canSpotMonster, map_trap, newsym, shieldeff, flush_screen, lastDirtyMapCursor, show_glyph_cell, canOverwriteTerrain, updateLastSeenTerrain } from './display.js';
import { objectResistsDestruction, getObjectLocation, blankNovel, burnFloorObjectsAt, destroyFireInventory, destroyFireMonsterInventory } from './zap.js';
import { impossible } from './diagnostics.js';
import { stopLevelTimer } from './timeout.js';
import { d, rnl, rn2, rnd, rn2Display, rn1 } from './rng.js';
import { DISCARDED_CALL_LOG, recordRandom } from './monster_action_types.js';
import { plineWithContinuation, pline } from './pline.js';
import { requireInitializedHero } from './hero_types.js';
import { AD_PHYS, AD_CORR, AD_FIRE, AD_RUST } from './monster_attack_types.js';
import { removeObjectFromMonsterInventory, destroyObjectFromMonsterInventory, findMonsterArmorClass, wornInSlot } from './monworn.js';
import { monsterKnowsTrap, monsterLearnsTrap, monstersSeeTrap, monsterResistsSleep, monsterHasFireResistance, monsterHasStoneResistance, monstersForgetHeroResistance, monstersObserveHeroResistance, monsterIsBreathless, monsterIsHelpless } from './mondata.js';
import { teleportMonsterFromTrap, teleportMonsterThroughHole, teleportMonsterThroughPortal, teleportMonsterToRandomLevel, clearFixedTeleportDestination, heroTeleportDestinationOk, heroTeleportTrapBlock, moveHeroByTeleport, teleportHero, activateMagicPortal, askTeleportDestination, triggerLevelTeleportTrap } from './teleport.js';
import { canFallThrough, countLevelFeatures } from './mklev.js';
import { monsterName as canonicalMonsterName, monsterName, monsterName as perceivedMonsterName } from './do_name.js';
import { touchPetrifies, selfTouchPetrifyingWeapons, heroResistsStoning, formCanBecomeStoneGolem, PM_STONE_GOLEM } from './stoning.js';
import { useMonsterStoningCure } from './muse.js';
import { adjustMonsterSpeed, monsterSpeedMessage } from './worn.js';
import { recordHeroKillConduct, finishHeroDeath } from './end.js';
import { LL_DUMP, LL_MINORAC, recordGameLogEvent } from './gamelog.js';
import { experienceRankIndex, loseHeroExperience, addExperience, checkExperienceLevel } from './exper.js';
import { mksobj, objectWeight, unlinkObject, createCorpstatAt, rndmonnumAdj } from './mkobj.js';
import { buryObject, buryFloorObjectsAt, buriedBallNear, buriedBallToPunishment, unearthFloorObjectsAt } from './dig.js';
import { placeObject, stack_object, placeCreatedObject, remove_object, updateIceObjectTimersAt } from './floor_object.js';
import { monsterAtPosition, monsterHasMapPosition, dismountHero, steedIsGrounded, monsterOccupiesPosition } from './steed.js';
import { gotoLevel, scheduleLevelChange } from './level_change.js';
import { hasCarriedProperty, hasWornProperty, refreshMovementProperties, existingPropertyRecord, propertySourceIsActive, propertyIsBlocked, propertyIsActive, clearLevitationMasks, levitationAtWill } from './properties.js';
import { ordinalSuffix, possessiveName, dist2, dungeonDepth } from './hacklib.js';
import { applyFloorEffects } from './floor_effects.js';
import { heroHasArtifactDefense, artifactById, heroHasMagicKey } from './artifacts.js';
import { burnAwayHeroSlime, loseHeroHp, blocksDiagonalDoor, blocksMove, heroBadRock, roomsAt, finishDestinationSpotEffects, EXT_ENCUMBER, HVY_ENCUMBER, calcCapacity, inventoryWeight, nearCapacity, applyHeroLiquidEffects, endVoluntaryMultiTurn, heroLocomotion, applyHeroLocationEffects, heroCanSwim, moveObject, dropEmergencyObject, finishLiquidDeath, pickEmergencyDrop, reviveHeroFromLiquid, teleportHeroOutOfLiquid, heroResistsFire as heroResistsFireWithoutArtifactDefense, UNENCUMBERED, SLT_ENCUMBER } from './hack.js';
import { surfaceName, ceilingName } from './terrain_name.js';
import { triggerBoobyTrap } from './booby_trap.js';
import { adjustHeroAlignment } from './alignment.js';
import { currentAttribute, exerciseAttribute, changeHeroLuck } from './attrib.js';
import { triggerChestTrap } from './chest_trap.js';
import { heroArmName, heroFingerName, heroHandName, heroFootName, heroHeadName, heroLegName, monsterFootName } from './body_parts.js';
import { displayMessageWindow } from './tty_topline.js';
import { abusePet } from './dog.js';
import { heroCanReachFloor } from './engrave.js';
import { promptDirection } from './cmd.js';
import { beginBallAndChainMove, finishBallAndChainMove, fallWithIronBall, heroIsPunished, placeBallAndChain, unplaceBallAndChain } from './ball.js';
import { placeHeroOnLevel } from './hero_location.js';
import { checkHeroLeashes, bringLeashedFollowers } from './apply.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { isDoorMimic, isObjectOrFurnitureMimic, revealMimic } from './uhitm.js';
import { setMonsterMalign, makemon } from './makemon.js';
import { promptYesNoQuit } from './query.js';
import { isWeldedPrimary } from './wield.js';
import { hitHeroWithObject } from './hero_object_hit.js';
import { splitHeroMonsterForm } from './potion.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { explodeLandMine } from './landmine_explosion.js';
import { searchSpecial, somexyspace } from './mkroom.js';
import { impactDrop } from './dokick.js';
import { setTrack } from './track.js';
import { activateStatueTrapAt } from './statue_trap.js';
import { poisonHero } from './poison.js';
import { putHeroToSleep } from './timeout.js';
import { putMonsterToSleep } from './mhitm.js';
import { woundHeroLegs } from './do.js';
import { heroHasInvoluntaryDelay } from './cmd.js';
import { autopickupAtHero } from './pickup.js';
import { finishTeleportArrival } from './location_effects.js';
import { holdingMonsterName, holdingMonsterSubject } from './hero_expulsion.js';
import { reportHeroEncumbrance } from './encumbrance.js';
import { setHeroGrip } from './hero_grip.js';
import { putGeneratedMonsterInventoryInStatue } from './sp_lev.js';
import { setLevelTerrainType } from './mkmaze.js';
import { heroIsSliming } from './potion.js';
import { meltIce } from './zap.js';
import { A_CHA, BOLT_LIM, COULD_SEE, IRONBARS, IS_OBSTRUCTED, IS_STWALL, IS_TREE, M_AP_MONSTER, MIGR_RANDOM, W_ACCESSORY, W_ARMOR, WT_ELF } from './const.js';
import { AD_MAGM, AD_RBRE, AT_BREA, AT_MAGC } from './monster_attack_types.js';
import { changeMonsterForm, resolveMonsterLiquid, revealMonsterAppearance } from './mon.js';
import { set_msg_xy } from './pline.js';
import { applyMonsterEquipmentProperties } from './monworn.js';
import { addObjectToMonsterInventory } from './steal.js';
import { monsterObjectPronoun } from './mondata.js';
import { relocateObjectRandomly } from './teleport.js';
import { splitObjectStack } from './mkobj.js';
import { placeObjectSynchronously } from './floor_object.js';
import { grantIntrinsicProperty, hasIntrinsicProperty, hasInvokedProperty, removeIntrinsicProperty } from './properties.js';
import { depth, distmin } from './hacklib.js';
import { heroHasCarriedArtifactFlag } from './artifacts.js';
import { heroFormFlags as heroFormFlagsOfState, heroIsUnchanging, polymorphHero } from './polyself.js';
import { adjustAttribute, attributeChangeMessage } from './attrib.js';
import { heroSpineName, monsterArmName, monsterHeadName } from './body_parts.js';
import { tameMonster } from './dog.js';
import { deleteEngravingAt } from './engrave.js';
import { makemonAt } from './makemon.js';
import { makeBlinded, makeDeaf, showInvisibilityMessage, splitMonster } from './potion.js';
import { finishHeroMonsterKillOutcome } from './hero_monster_death.js';
import { shipObject } from './dokick.js';
import { setMulti } from './cmd.js';
import { levelAtDepth } from './dungeon.js';
import { inventoryItemDescription } from './invent.js';
import { heroHasHalfSpellDamage, monsterResistsEffect, poly_obj } from './zap.js';
import { monsterHasNoLimbs, monsterIsNonliving, monsterIsVampireShifter } from './monster_data.js';
import { transientObjectGlyph } from './display.js';
import { CLOAK_OF_MAGIC_RESISTANCE, GRAY_DRAGON_SCALE_MAIL, GRAY_DRAGON_SCALES, IRON_SHOES, KICKING_BOOTS, OBJECT_NAMES } from './object_data.js';
import { heroResistsBlindingLight } from './blinding_attack.js';
import { hasInternalInvisibility, syncHeroInvisibility } from './hero_invisibility.js';
import { onQuestStart } from './quest.js';
import { applyRemoveCurseSpell } from './read.js';
import { randomTeleportDepth } from './level_teleport.js';
import { stopHeroOccupation } from './occupation.js';
import { projectileHitsIronBars } from './projectile_bars.js';
import { scatterFloorObjects } from './scatter.js';
import { rangedTargetHitBonus } from './dothrow.js';
import { wornMonsterLifeSaver } from './mondeath.js';
import { fractureRock } from './rock_breakage.js';
import { applyMonsterPassiveToObject } from './uhitm.js';
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
const PM_IRON_GOLEM = 259;
const M1_HUMANOID = 0x00020000;
const POTION_CLASS = 8;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const DRAGON_HIDE = 10;
const FIRE_RESISTANT_OBJECTS = new Set([
    RED_DRAGON_SCALE_MAIL,
    RED_DRAGON_SCALES,
    RIN_FIRE_RESISTANCE,
]);
const M1_FLY = 0x00000001;
const M1_AMORPHOUS = 0x00000004;
const M1_CLING = 0x00000010;
const M1_MINDLESS = 0x00010000;
const M1_UNSOLID = 0x00100000;
const S_EYE = 5;
const S_LIGHT = 25;
const S_VORTEX = 22;
const PM_AIR_ELEMENTAL = 154;
function lavaCanBurnObject(object, random) {
    if (!object || object.in_use || object.oerodeproof)
        return false;
    const organic = objectMaterial(object) <= 8;
    if (!organic && object.oclass !== POTION_CLASS)
        return false;
    if (FIRE_RESISTANT_OBJECTS.has(object.otyp)
        || object.otyp === SCR_FIRE || object.otyp === SPE_FIREBALL)
        return false;
    return !objectResistsDestruction(object, 0, 0, random);
}
// C trap.c:lava_effects() flags all doomed items before any death message.
export async function markLavaInventoryForDestruction(state, random) {
    let protectedObject = null;
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
        if (lavaCanBurnObject(object, random))
            object.in_use = true;
    }
    return protectedObject;
}
export async function destroyLavaInventory({ state = game, publish = async () => { }, protectedObject, showMessages = false, previouslyAnnounced = 0, }) {
    let named = previouslyAnnounced;
    let unnamed = 0;
    for (const object of [...(state.inventory || [])]) {
        if (object === protectedObject) {
            object.in_use = true;
            continue;
        }
        if (object.otyp === SPE_BOOK_OF_THE_DEAD) {
            // C: The(xname(obj)) glows a strange hcolor("dark red").
            if (showMessages && !heroIsBlind(state)) {
                observeObject(object, state);
                await publish(`The ${objectName(object, state)} glows a strange ${displayColorName('dark red', state)}, but remains intact.`);
            }
            continue;
        }
        if (!object.in_use)
            continue;
        const wasWorn = !!object.worn || !!object.owornmask;
        if (showMessages && wasWorn) {
            await publish(`${ownedObjectAction(object, 'burst', state)} into flame!`);
            named++;
        }
        else {
            unnamed++;
        }
        await removeWornHeroItem(object, state);
        if (state.program_state?.gameover)
            return named + unnamed - previouslyAnnounced;
        await useUpInventoryStack(object, state);
        if (state.program_state?.gameover)
            return named + unnamed - previouslyAnnounced;
    }
    if (showMessages && unnamed) {
        const subject = named
            ? unnamed === 1 ? 'Another item' : 'Other items'
            : unnamed === 1 ? 'An item' : 'Some items';
        await publish(`${subject} in your inventory ${unnamed === 1 ? 'has' : 'have'} been destroyed.`);
    }
    return named + unnamed - previouslyAnnounced;
}
export async function destroyLavaFloorObjects(objects, { state = game, publish = async () => { }, random = rn2, visible = false, x, y, } = {}) {
    if (!objects)
        return 0;
    let destroyed = 0;
    for (const object of [...objects]) {
        // lava_damage() screens every object before checking its material.
        // A destroyed object also passes through delobj() independently.
        if (objectResistsDestruction(object, 0, 0, random)
            && object.otyp !== SPE_BOOK_OF_THE_DEAD)
            continue;
        const burnDirectly = objectMaterial(object, state) < DRAGON_HIDE
            && object.oclass !== SCROLL_CLASS && object.oclass !== SPBOOK_CLASS
            && OBJECT_PROPERTY[object.otyp] !== 'fireResistance'
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
            continue;
        }
        const index = objects.indexOf(object);
        if (index >= 0)
            objects.splice(index, 1);
        destroyed++;
    }
    return destroyed;
}
function recordRoll(random, calls, range) {
    calls?.push(range);
    return random(range);
}
function inventoryOf(monster) {
    return monster?.minvent || monster?.inventory || [];
}
export function monsterTrapVisibility(monster, state = game) {
    const blind = !!state?.blind || (state?.u?.blindTurns ?? 0) > 0;
    const seeSquare = !blind
        && !!((state?.viz_array?.[monster.my]?.[monster.mx] ?? 0) & 0x2);
    const inSight = state?.u?.usteed === monster
        || canSeeMonster(monster);
    return { inSight, seeSquare };
}
function wornObject(monster, mask) {
    return inventoryOf(monster).find(object => ((object.owornmask ?? 0) & mask) !== 0) || null;
}
function objectContents(object) {
    return object.contents || [];
}
function carriedByHero(object, state) {
    return (state.inventory || []).includes(object);
}
function heroLanternIsDunked(state) {
    if (!isPoolAt(state.u.ux, state.u.uy, state))
        return false;
    return Is_waterlevel(state.u.uz)
        || !(state.u?.levitating || state.levitating
            || heroIsFlying(state) || heroHasWaterWalking(state));
}
// C splash_lit()/snuff_lit(): each message precedes end_burn(), so the
// darkened view waits for the next flush instead of preceding the message.
export async function splashLitObject(object, publish, state = game) {
    if (!object?.lamplit)
        return false;
    // snuff_lit() handles flames and lanterns, not magical light sources.
    if (![OIL_LAMP, MAGIC_LAMP, BRASS_LANTERN, POT_OIL,
        TALLOW_CANDLE, WAX_CANDLE, CANDELABRUM_OF_INVOCATION].includes(object.otyp))
        return false;
    const carried = carriedByHero(object, state);
    let dunkedLantern = false;
    if (object.otyp === BRASS_LANTERN) {
        let visible = false, audible = false, snuff = true;
        if (carried) {
            visible = !heroIsBlind(state);
            audible = !heroIsDeaf(state);
            dunkedLantern = heroLanternIsDunked(state);
            snuff = false;
        }
        else if (object.where === 'minvent' && object.ocarry
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
        if (!dunkedLantern && !snuff)
            return false;
    }
    const position = getObjectLocation(object, state);
    const visible = object.where === 'minvent'
        ? !!position && cansee(position.x, position.y) : !heroIsBlind(state);
    if (visible) {
        const candle = object.otyp === TALLOW_CANDLE || object.otyp === WAX_CANDLE;
        if (candle || object.otyp === CANDELABRUM_OF_INVOCATION) {
            const many = candle ? object.quan > 1 : object.spe > 1;
            await publish(`${objectOwnershipPrefix(object, state, { capitalized: true })}${candle ? '' : "candelabrum's "}candle${many ? "s' flames are" : "'s flame is"} extinguished.`);
        }
        else {
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
function rustMetalObject(object, description, luckRoll) {
    if (!object || objectMaterial(object.otyp) !== 11)
        return { outcome: 'nothing' };
    const proof = !!object.oerodeproof;
    if (proof && object.rknown)
        return { outcome: 'nothing' };
    if (proof) {
        object.rknown = true;
        return {
            outcome: 'nothing', kind: 'rustproof', object, description,
        };
    }
    if (object.blessed && luckRoll(4) === 0)
        return { outcome: 'nothing' };
    const oldErosion = object.oeroded ?? 0;
    if (oldErosion >= 3)
        return { outcome: 'nothing' };
    object.oeroded = oldErosion + 1;
    return {
        outcome: 'damaged', kind: 'rusted', object, description,
        erosion: object.oeroded,
    };
}
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
    const luck = (state.u.uluck ?? 0) + (state.u.moreluck ?? 0);
    if (!force && luck + 5 > random(20))
        return 'nothing';
    if (object.oclass === 9) {
        if (object.otyp === SCR_BLANK_PAPER)
            return 'nothing';
        if (carried)
            await emit(`Your ${name} ${plural ? 'fade' : 'fades'}.`);
        object.otyp = SCR_BLANK_PAPER;
        object.dknown = false;
        object.spe = 0;
        return 'damaged';
    }
    if (object.oclass === 10) {
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
    if (object.oclass === 8) {
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
export async function waterDamageChain(objects, messages = [], state = game, options = {}) {
    if (!objects)
        return messages;
    await damageWaterChain(objects, messages, state, options);
    return messages;
}
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
function extinguishLitObject(object, monster, state) {
    if (!object?.lamplit)
        return null;
    const humanoid = !!((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_HUMANOID);
    if (object.otyp === BRASS_LANTERN && humanoid) {
        return { kind: 'lantern-flickers', object };
    }
    if (!endObjectBurn(object, state, state.moves ?? 0))
        object.lamplit = false;
    return { kind: 'extinguished', object };
}
function rustObject(object, description, monster, state, roll, luckRoll) {
    if (!object)
        return { outcome: 'nothing' };
    const lightEffect = extinguishLitObject(object, monster, state);
    if (lightEffect)
        return { outcome: 'damaged', ...lightEffect };
    if (object.greased) {
        const greaseWashedOff = roll(2) === 0;
        if (greaseWashedOff)
            object.greased = false;
        // C water_damage(): monster-carried grease washes off without feedback.
        return { outcome: 'greased' };
    }
    return rustMetalObject(object, description, luckRoll);
}
function addWaterEffect(event, effect) {
    if (effect?.kind)
        event.effects.push(effect);
    return effect?.outcome || 'nothing';
}
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
export function burnHeroArmorByFire(state, emitMessage, calls = [], random = rn2) {
    return burnArmorByFire(state.u, state, emitMessage, calls, random);
}
export async function applyMonsterRustTrap(monster, state, { roll = rn2, luckRoll = rnl, } = {}) {
    const targetRoll = roll(5);
    const event = {
        kind: 'rust-trap', target: 'body', effects: [],
        damage: 0, killed: false,
    };
    if (targetRoll === 0) {
        event.target = 'head';
        const helmet = wornObject(monster, W_ARMH);
        addWaterEffect(event, rustObject(helmet, helmet ? armorSimpleName(helmet, state) : 'helm', monster, state, roll, luckRoll));
    }
    else if (targetRoll === 1) {
        event.target = 'left-arm';
        const shield = wornObject(monster, W_ARMS);
        const shieldResult = addWaterEffect(event, rustObject(shield, 'shield', monster, state, roll, luckRoll));
        if (shieldResult === 'nothing') {
            const weapon = monsterWieldedWeapon(monster);
            if (weapon && isBimanualObject(weapon)) {
                addWaterEffect(event, rustObject(weapon, objectCombatName(weapon, { state }), monster, state, roll, luckRoll));
            }
            const gloves = wornObject(monster, W_ARMG);
            addWaterEffect(event, rustObject(gloves, gloves ? armorSimpleName(gloves, state) : 'gloves', monster, state, roll, luckRoll));
        }
    }
    else if (targetRoll === 2) {
        event.target = 'right-arm';
        const weapon = monsterWieldedWeapon(monster);
        addWaterEffect(event, rustObject(weapon, weapon ? objectCombatName(weapon, { state }) : 'weapon', monster, state, roll, luckRoll));
        const gloves = wornObject(monster, W_ARMG);
        addWaterEffect(event, rustObject(gloves, gloves ? armorSimpleName(gloves, state) : 'gloves', monster, state, roll, luckRoll));
    }
    else {
        event.target = 'body';
        for (const object of inventoryOf(monster)) {
            if (!object.lamplit
                || ((object.owornmask ?? 0) & (W_WEP | W_SWAPWEP))) {
                continue;
            }
            const effect = extinguishLitObject(object, monster, state);
            if (effect)
                event.effects.push(effect);
        }
        const torso = wornObject(monster, W_ARMC)
            || wornObject(monster, W_ARM)
            || wornObject(monster, W_ARMU);
        addWaterEffect(event, rustObject(torso, torso ? armorSimpleName(torso, state) : 'suit', monster, state, roll, luckRoll));
    }
    // A gremlin's split_mon() follows the gush report (finishMonsterRustTrap).
    if (monster.mnum === PM_IRON_GOLEM)
        event.completelyRusted = true;
    return event;
}
// ---------------------------------------------------------------------------
// C trap.c:mintrap() and the monster trap-effect completions it defers.
// ---------------------------------------------------------------------------
// C trap.c:t_at(). The level keeps at most one trap per square.
export function trapAt(state, x, y) {
    return state?.level?.traps?.find((trap) => trap.tx === x && trap.ty === y);
}
// C trap.c:floor_trigger(). These traps require contact with the floor even
// when their eventual effect (a dart or falling rock) could hit a flyer.
export function trapTriggeredByFloor(trap) {
    return [ARROW_TRAP, DART_TRAP, ROCKTRAP, SQKY_BOARD, BEAR_TRAP,
        LANDMINE, ROLLING_BOULDER_TRAP, SLP_GAS_TRAP, RUST_TRAP, FIRE_TRAP,
        PIT, SPIKED_PIT, HOLE, TRAPDOOR].includes(trap.ttyp);
}
// C ref: trap.c:m_harmless_trap().  mfndpos() marks only harmful traps in
// candidate info; dog_move() then applies its separate hero-seen 1/40 rule.
export function monsterTrapIsHarmless(monster, trap, state) {
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
// C trap.c:mintrap(). Called from m_move()/postmov() after a monster steps
// onto a square, and from the source effects below via the immediate entry.
// C trap.c:trapeffect_selector(): the monster side of the dispatch; each
// case runs the monster branch of the named trapeffect_ function, in its
// owner module or inline below. C trap.c:trapeffect_hole(): the grounded,
// size, and worm checks and the Sokoban yank sit inline before the fall.
// C trap.c:trapeffect_level_telep(): the fall itself is the level-teleport
// owner's monster move. C trap.c:trapeffect_magic_trap(): the monster
// branch replicates a fire trap 1 time in 21 through beginMonsterFireTrap
// (trapeffect_fire_trap()'s monster branch). C trap.c:trapeffect_telep_trap():
// the monster branch hands the move to the teleport owner's mtele path.
export async function triggerMonsterTrap(monster, state, movement, random, rollDice, rollOne, calls, publish = plineWithContinuation) {
    const trap = trapAt(state, monster.mx, monster.my);
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
        const event = beginMonsterSqueakyBoard(monster, trap, state);
        if (!event)
            return null;
        movement.trap = event;
        movement.deferredAfterMonsterTrap = true;
        return event;
    }
    if (trap.ttyp === SLP_GAS_TRAP) {
        const event = await beginMonsterSleepGasTrap(monster, trap, state, {
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
        forcedTrapLanding: force,
        forcedTrapBungle: forceBungle,
    };
    const trap = trapAt(state, monster.mx, monster.my);
    if (!trap) {
        monster.mtrapped = 0;
        return { monster, movement, event: null, calls };
    }
    const floorTriggered = trapTriggeredByFloor(trap);
    const sokobanFall = state.level.flags.sokoban_rules &&
        !trap.madeby_u &&
        [PIT, SPIKED_PIT, HOLE, TRAPDOOR].includes(trap.ttyp);
    // C mintrap() takes its already-trapped branch before any check_in_air().
    if (monster.mtrapped) {
        movement.escapingTrap = true;
        return { monster, movement, event: null, calls };
    }
    if (inAir && floorTriggered && !sokobanFall)
        return { monster, movement, event: null, calls };
    const event = await triggerMonsterTrap(monster, state, movement, random, rollDice, rollOne, calls, publish);
    return { monster, movement, event, calls };
}
// Complete mintrap() for a source effect without running a movement tail.
// C mintrap() gives an already trapped monster its escape roll whatever the
// caller's flags, so a monster caught mid-hurtle rolls again on landing.
export async function finishImmediateMonsterTrap(action, state = requireInitializedGame(), { publish = plineWithContinuation, random = rn2, rollOne = rnd, rollDice = d, finishDeath, describeMonster } = {}) {
    if (action.event?.kind === 'rolling-boulder')
        return action;
    await resumeDeferredMonsterTrap(action, state, {
        publish, random, rollOne, rollDice,
        ...(finishDeath ? { finishDeath } : {}),
        ...(describeMonster ? { describeMonster } : {}),
    });
    return action;
}
// Resume a deferred monster trap event staged by a source effect's
// immediate mintrap() call: the trapped actor's escape roll and any staged
// trap-effect completion, without a movement tail.
export async function resumeDeferredMonsterTrap(action, state, options = {}) {
    const movement = action?.movement;
    if (movement?.escapingTrap) {
        await tryMonsterTrapEscape(action.monster, state, {
            random: options.random ?? rn2,
            publish: options.publish ?? plineWithContinuation,
            ...(options.describeMonster ? { describeMonster: options.describeMonster } : {}),
        });
        delete movement.escapingTrap;
        return action;
    }
    const event = movement?.trap;
    if (!movement?.deferredAfterMonsterTrap)
        return action;
    if (!event)
        throw new Error('A deferred monster trap must retain its event');
    await finishDeferredMonsterTrap(action.monster, movement, event, state, action.calls || DISCARDED_CALL_LOG, options);
    return action;
}
// Finish the trap-effect completion which triggerMonsterTrap() staged for
// mintrap()'s caller, then trap.c:3831-3837's "appears" reveal of a newly
// caught hider.  Updates the movement's death fields and reports whether the
// actor died, left the level, or the hero died.
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
            await finishMonsterRustTrap(monster, event, state, {
                publish,
                random: recordedRandom,
            });
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
                    relocated.action = await finishImmediateMonsterTrap(await triggerImmediateMonsterTrap(victim, state, {
                        force: true, random: recordedRandom, rollOne: recordedRollOne,
                        rollDice, publish,
                    }), state, {
                        publish, random: recordedRandom, rollOne: recordedRollOne, rollDice,
                        finishDeath,
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
            await finishMonsterPitTrap(monster, event, {
                publish,
                random,
                rollOne: recordedRollOne,
                ...(describeMonster ? { describeMonster } : {}),
                state,
            });
            break;
        case 'falling-rock':
        case 'spent-rock-trap':
            await finishMonsterRockTrap(monster, event, state, {
                publish,
                random,
                ...(describeMonster ? { describeMonster } : {}),
            });
            break;
        case 'sleep-gas':
            await finishMonsterSleepGasTrap(monster, event, {
                state,
                publish,
                ...(describeMonster ? { describeMonster } : {}),
            });
            break;
        case 'squeaky-board':
            await finishMonsterSqueakyBoard(monster, event, state, {
                publish,
            });
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
// ── C trap.c:mselftouch() and minstapetrify(). Falling can force
// contact even through gloves; newcham() only calls mselftouch()
// after the new body has lost its gloves.
export function monsterWearsGloves(monster) {
    return !!((monster?.misc_worn_check ?? 0) & W_ARMG)
        || (monster?.minvent || monster?.inventory || []).some(object => ((object.owornmask ?? 0) & W_ARMG) !== 0);
}
function selfTouchSubject(monster, prefix) {
    const subject = monsterSubject(monster);
    if (!prefix || monster.name)
        return subject;
    return subject.charAt(0).toLowerCase() + subject.slice(1);
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
export async function petrifyMonsterFromContact(monster, { creditHero = false, finishDeath, publish = plineWithContinuation, rollOne = rnd, state = game, } = {}) {
    const cure = await useMonsterStoningCure(monster, {
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
const M1_WALLWALK = 0x00000008;
const PM_PIT_FIEND = 300;
const PM_PIT_VIPER = 218;
function monsterIsUngrounded(monster, state) {
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[monster.mnum];
    const clingsToCeiling = !!(flags & M1_CLING) && levelHasCeiling(state);
    return !!(flags & M1_FLY) || clingsToCeiling || symbol === S_EYE || symbol === S_LIGHT
        || !!monster.wormno && (monster.wormSegments?.length ?? 0) > 5;
}
// C trap.c:trapeffect_pit(): the monster branch — grounded, size, and worm
// checks decide whether the monster falls, spiked damage is staged, and
// mtrapped is set for non-wallwalkers.
export function beginMonsterPitTrap(monster, trap, state = game, { forced = false } = {}) {
    if (!trap)
        return null;
    const ungrounded = monsterIsUngrounded(monster, state);
    const sokoban = !!state.level?.flags.sokoban_rules;
    const falls = !(ungrounded && forced && !sokoban);
    const inescapable = forced || sokoban && !trap.madeby_u;
    if (ungrounded && falls && !inescapable)
        return null;
    const visibility = monsterTrapVisibility(monster, state);
    const spiked = trap.ttyp === SPIKED_PIT;
    const relevantSpikes = spiked && !monsterWearsIronShoes(monster);
    if (falls && !((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_WALLWALK))
        monster.mtrapped = 1;
    return {
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
}
// C trap.c:trapeffect_pit(): the monster branch's completion — the fall
// message, the hit, and the pit's trap result.
export async function finishMonsterPitTrap(monster, event, { publish = plineWithContinuation, random, rollOne = rnd, state = game, describeMonster = target => canonicalMonsterName(target, { state, capitalized: true }), } = {}) {
    if (!event || event.finished)
        return event;
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
        await publish(`${describeMonster(monster)} ${event.dragged ? 'is dragged' : 'falls'} into ${owner} pit!`);
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
// ---------------------------------------------------------------------------
// Escape attempts by an already trapped monster. C trap.c:mintrap().
// dochug refreshes stationary monsters; a settling boulder owns its redraw.
// ---------------------------------------------------------------------------
const M1_METALLIVORE = 0x80000000;
const MZ_HUGE = 4;
// C trap.c:mintrap(): the already-trapped escape roll — noticing an unseen
// trap under a trapped monster, the 1-in-40 (or easy-pit) escape, the
// boulder that fills the pit, and the metallivore's snack.
// C trap.c:m_easy_escape_pit(): climbsEasily — a pit fiend or a huge body.
export async function tryMonsterTrapEscape(monster, state = game, { random = rn2, publish = plineWithContinuation, describeMonster = target => canonicalMonsterName(target, { state, capitalized: true }), } = {}) {
    const { mx: x, my: y } = monster;
    const level = requireGameLevel(state);
    const trap = level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (!trap) {
        monster.mtrapped = 0;
        return;
    }
    const { inSight, seeSquare } = monsterTrapVisibility(monster, state);
    const pit = is_pit(trap.ttyp);
    if (!trap.tseen && seeSquare && inSight
        && (pit || [BEAR_TRAP, HOLE, WEB].includes(trap.ttyp))) {
        await seeTrap(trap, state);
    }
    const climbsEasily = (MONSTER_SIZE[monster.mnum] ?? 0) >= MZ_HUGE
        || MONSTER_NAME[monster.mnum] === 'pit fiend';
    if (random(40) === 0 || (pit && climbsEasily)) {
        const boulder = pit && (level.objects[x]?.[y] || [])
            .some(object => object.otyp === BOULDER);
        if (boulder) {
            if (random(2) === 0) {
                monster.mtrapped = 0;
                if (inSight)
                    await publish(`${describeMonster(monster)} pulls free...`);
                await fillPitWithBoulderAt(x, y, state, { publish });
            }
        }
        else {
            if (inSight) {
                if (pit) {
                    await publish(`${describeMonster(monster)} climbs ${climbsEasily ? 'easily ' : ''}out of the pit.`);
                }
                else if (trap.ttyp === BEAR_TRAP || trap.ttyp === WEB) {
                    // C trapname() draws a hallucinated trap name after Monnam().
                    const subject = describeMonster(monster);
                    await publish(`${subject} pulls free of the ${trapName(trap.ttyp, { state })}.`);
                }
            }
            monster.mtrapped = 0;
        }
    }
    else if ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_METALLIVORE) {
        if (trap.ttyp === BEAR_TRAP) {
            if (inSight)
                await publish(`${describeMonster(monster)} eats a bear trap!`);
            deleteTrap(trap, state);
            monster.meating = 5;
            monster.mtrapped = 0;
        }
        else if (trap.ttyp === SPIKED_PIT) {
            if (inSight)
                await publish(`${describeMonster(monster)} munches on some spikes!`);
            trap.ttyp = PIT;
            monster.meating = 5;
        }
    }
}
// C trap.c:deltrap()/maybe_finish_sokoban(). Callers own actor release,
// terrain changes, and redraw; raw deletion only removes the trap itself.
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
export function trapName(type, { ignoreHallucination = false, state = game } = {}) {
    if (heroIsHallucinating(state) && !ignoreHallucination) {
        const total = TRAPNUM + HALLUCINATED_TRAPS.length;
        const index = rn2Display(total + 1);
        if (index === total) {
            requirePlayingGame(state);
            const female = Upolyd(state.u) ? state.u.mfemale : state.flags.female;
            const names = rn2(3) ? state.urole.name
                : state.urole.title[experienceRankIndex(state.u.ulevel)];
            if (!names)
                throw new Error('The hero role has no title for the current rank.');
            return `${(female && names.f ? names.f : names.m).slice(0, 27)} trap`.toLowerCase();
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
// C trap.c:cnv_trap_obj(). Convert a set trap before releasing its occupants.
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
        await resetHeroTrap(true, state);
        if (state.program_state.gameover)
            return object;
    }
    const monster = monsterAtPosition(requireGameLevel(state), trap.tx, trap.ty);
    if (monster?.mtrapped)
        monster.mtrapped = 0;
    deleteTrap(trap, state);
    return object;
}
// Magic releases and activates traps without removing them.
// C trap.c:openholdingtrap(), closeholdingtrap(), openfallingtrap().
function targetTrap(target, state) {
    const hero = target === state.u || target === state.u.usteed;
    if (!hero && !('mnum' in target))
        throw new TypeError('Trap magic requires the live hero or a monster.');
    const x = 'mnum' in target && !hero ? target.mx : state.u.ux;
    const y = 'mnum' in target && !hero ? target.my : state.u.uy;
    return { hero, trap: state.level.traps.find(t => t.tx === x && t.ty === y) };
}
function result(changed, noticed, state) {
    return { changed, noticed, heroDied: !!state.program_state.gameover };
}
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
        await resetHeroTrap(true, state);
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
async function activateTrap(target, hero, trap, state, falling) {
    if (hero) {
        if (state.u.utrap)
            return result(false, false, state);
        await triggerHeroTrap(trap, {
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
    const action = await triggerImmediateMonsterTrap(target, state, { force: true });
    await finishImmediateMonsterTrap(action, state);
    // Native mintrap's nonzero results are caught, dead, or moved.
    const changed = !!target.mtrapped || (target.mhp ?? 1) <= 0
        || action.movement.actorLeftLevel || action.movement.actorDied
        || action.movement.moved;
    return result(!!changed, noticed, state);
}
function isHeroDefender(defender, state) {
    return defender === state.u;
}
const WEAPON_CLASS = 2;
const ARMOR_CLASS = 3;
const TOOL_CLASS = 6;
const BALL_CLASS = 15;
const CHAIN_CLASS = 16;
const PM_STEAM_VORTEX = MONSTER_NAME.indexOf('steam vortex');
const EROSION = {
    burn: { field: 'oeroded', verb: 'smoulder', past: 'burnt', cause: 'heat' },
    rust: { field: 'oeroded', verb: 'rust', past: 'rusted', cause: 'oxidation' },
    rot: { field: 'oeroded2', verb: 'rot', past: 'rotten', cause: 'decay' },
    corrosion: { field: 'oeroded2', verb: 'corrode', past: 'corroded', cause: 'corrosion' },
    crack: { field: 'oeroded', verb: 'crack', past: 'cracked', cause: 'impact' },
};
export async function erodeAttackingWeapon(defender, weapon, { state = game, random = rn2, ...options } = {}) {
    if (!weapon)
        return;
    const species = isHeroDefender(defender, state) ? heroSpecies(state) : defender.mnum;
    const attacks = MONSTER_ATTACKS[species];
    if (!attacks)
        throw new RangeError(`Unknown monster species: ${species}`);
    const hasDamage = (type) => attacks.some(attack => attack[1] === type);
    const kind = hasDamage(AD_CORR) ? 'corrosion'
        : hasDamage(AD_RUST) ? 'rust'
            : hasDamage(AD_FIRE) && species !== PM_STEAM_VORTEX ? 'burn' : null;
    if (kind && random(kind === 'burn' ? 6 : 1) === 0) {
        await erodeObject(weapon, kind, { ...options, state, random, verbose: true });
    }
}
export async function erodeArmor(defender, kind, { state = game, random = rn2, ...options } = {}) {
    const layers = [
        [W_ARMH], [W_ARMC, W_ARM, W_ARMU], [W_ARMS], [W_ARMG], [W_ARMF],
    ];
    const inventory = isHeroDefender(defender, state) ? state.inventory : (defender.minvent ?? []);
    for (;;) {
        const slot = random(5);
        const masks = layers[slot];
        if (!masks)
            throw new RangeError(`Invalid armor erosion slot: ${slot}`);
        let object;
        for (const mask of masks) {
            object = inventory.find(item => (item.owornmask ?? 0) & mask);
            if (object)
                break;
        }
        const result = object
            ? await erodeObject(object, kind, {
                ...options, state, random, verbose: slot === 1,
            }) : 'nothing';
        if (slot === 1 || result !== 'nothing')
            return result;
    }
}
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
function objectCanBurn(object, state) {
    if ([TALLOW_CANDLE, WAX_CANDLE, WAN_FIRE].includes(object.otyp)
        || OBJECT_PROPERTY[object.otyp] === 'fireResistance')
        return false;
    const material = objectMaterial(object, state);
    return (material <= 8 && material !== 1) || material === 18;
}
export function erosionMatters(object) {
    return [WEAPON_CLASS, ARMOR_CLASS, BALL_CLASS, CHAIN_CLASS].includes(object.oclass)
        || (object.oclass === TOOL_CLASS && OBJECT_SUBTYPE[object.otyp] !== 0);
}
export function objectIsVulnerableToErosion(object, kind, state = game) {
    const material = objectMaterial(object, state);
    if (kind === 'burn')
        return objectCanBurn(object, state);
    if (kind === 'rust')
        return material === 11;
    if (kind === 'corrosion')
        return material === 11 || material === 13;
    if (kind === 'rot')
        return (material <= 8 && material !== 1) || material === 10;
    return material === 19 && object.oclass === ARMOR_CLASS;
}
function inventoryResists(kind, state, random) {
    if (kind !== 'burn' && kind !== 'corrosion')
        return false;
    const property = kind === 'burn' ? 'fireResistance' : 'acidResistance';
    if (hasWornProperty(property, state) || hasCarriedProperty(property, null, state))
        return random(100) < 99;
    return kind === 'burn' && state.uarmc?.otyp === DWARVISH_CLOAK
        && random(100) < 90;
}
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
function objectCarrier(object, state) {
    if (object.where !== 'minvent')
        return null;
    return state.u.usteed && state.u.usteed.m_id === object.carrierMid ? state.u.usteed
        : (state.level?.monsters.find(monster => monster.m_id === object.carrierMid) ?? null);
}
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
function objectSubject(view, state, capitalized = true) {
    if (view.hero)
        return `${capitalized ? 'Your' : 'your'} ${view.name}`;
    if (view.monsterVisible && view.carrier) {
        const owner = monsterName(view.carrier, { state, capitalized });
        return `${possessiveName(owner)} ${view.name}`;
    }
    return `${capitalized ? 'The' : 'the'} ${view.name}`;
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
// ── moved from src/js/hero_energy.ts ──
// Hero energy loss.
// C ref: trap.c drain_en().
// C trap.c:drain_en().
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
// ── moved from src/js/hole_destination.ts ──
// C trap.c:dng_bottom() and clamp_hole_destination(). Saved holes can
// point beyond the current dungeon or a progression barrier.
// C trap.c:dng_bottom().
export function clampHoleDestination(destination, state = game) {
    const dungeon = state.dungeons[destination.dnum];
    if (!dungeon)
        throw new Error(`Hole leads to absent dungeon ${destination.dnum}`);
    let bottom = dungeon.num_dunlevs;
    if (In_quest(destination)) {
        const locate = state.specialLevels?.get('x-loca');
        if (!locate)
            throw new Error('Quest falls require the locate level');
        if (dungeon.dunlev_ureached < locate.dlevel)
            bottom = locate.dlevel;
    }
    else if (In_hell(destination, state) && !state.u.uevent?.invoked) {
        bottom--;
    }
    return { dnum: destination.dnum, dlevel: Math.min(destination.dlevel, bottom) };
}
// ── moved from src/js/pit_connections.ts ──
// The offset between two pits: C trap.c:conjoined_pits() derives it with
// sgn() and xytodir(); Math.sign() and the xdir/ydir table lookup are those
// two callees inlined here.
function pitDirection(from, to) {
    const dx = Math.sign(to.tx - from.tx);
    const dy = Math.sign(to.ty - from.ty);
    return xdir.findIndex((x, i) => i < 8 && x === dx && ydir[i] === dy);
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
export function connectPits(first, second) {
    const direction = pitDirection(first, second);
    if (direction < 0)
        return false;
    const opposite = (direction + 4) % 8;
    const changed = !((first.conjoined ?? 0) & (1 << direction))
        || !((second.conjoined ?? 0) & (1 << opposite));
    first.conjoined = (first.conjoined || 0) | (1 << direction);
    second.conjoined = (second.conjoined || 0) | (1 << opposite);
    return changed;
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
function objectClass(object) {
    return Number.isInteger(object?.oclass)
        ? object.oclass : objectClassForType(object?.otyp);
}
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
async function burnContainer(object, context) {
    if (object.otyp === STATUE || object.otyp === ICE_BOX)
        return false;
    const chance = object.otyp === CHEST ? 40
        : object.otyp === LARGE_BOX ? 30 : 20;
    if (!context.force
        && (context.state.u?.uluck ?? 0) + 5 > context.random(chance)) {
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
    if (!force
        && (state.u?.uluck ?? 0) + 5 > random(20)) {
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
const PM_STRAW_GOLEM = 249;
const PM_PAPER_GOLEM = 250;
const PM_LEATHER_GOLEM = 253;
const PM_WOOD_GOLEM = 254;
function heroResistsFire() {
    return !!game.u.fireResistance || heroHasArtifactDefense('fire');
}
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
function reduceMonsterFormMaximumHitPoints(hero, damage) {
    const formLevel = MONSTER_LEVEL[hero.umonnum] ?? 0;
    if ((hero.mhmax ?? 1) > formLevel) {
        const range = Math.min(hero.mhmax, damage + 1);
        hero.mhmax -= rn2(range);
    }
    hero.mh = Math.min(hero.mh ?? hero.mhmax, hero.mhmax);
}
async function reduceHeroMaximumHitPoints(hero, damage, publish) {
    const oldMaximum = hero.uhpmax ?? 1;
    const minimum = Math.max(hero.ulevel ?? 1, 1);
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
// C trap.c:trapeffect_fire_trap(): the monster branch — the flame under a
// monster, golem immolation, item destruction, and the maximum-HP scorch.
// The hero branch is the fire-trap case of triggerHeroTrap: it reveals the
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
// C trap.c:dofiretrap(): the flame effect shared by floor fire traps and
// trapped containers — steam under water, the tower of flame, resistance,
// and the burning of the hero, possessions, floor objects, and ice; the
// maximum-HP burn is C trap.c:minuhpmax() (reduceHeroMaximumHitPoints).
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
// ── moved from src/js/hero_magic_trap.ts ──
const M2_NEUTER = 0x00040000;
// C trap.c:domagictrap(): the hero's magic-trap outcomes — the 1-in-2
// monster-summoning flash and roar, or the fate table for blindness,
// invisibility, paralysis, and the rest.
export async function triggerHeroMagicTrapEffect() {
    requirePlayingGame(game);
    const currentLevel = game.u.uz;
    const fate = rnd(20);
    if (fate < 10) {
        const count = rnd(4);
        if (!heroResistsBlindingLight(game)) {
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
            await plineWithContinuation(`A shiver runs up and down your ${heroSpineName()}!`);
            return;
        case 14:
            await hear(heroIsHallucinating(game) ? 'the moon howling at you.' : 'distant howling.');
            return;
        case 15:
            if (onQuestStart(game)) {
                const neuter = Upolyd(game.u)
                    && !!((MONSTER_FLAGS2[heroSpecies(game)] ?? 0) & M2_NEUTER);
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
async function hear(text) {
    const message = formatHeardMessage(text);
    if (message)
        await plineWithContinuation(message);
}
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
export function projectileTrapNeedsResume(event) {
    return (event?.kind === 'projectile-trap' ||
        (event?.kind === 'spent-projectile-trap' && !event.finished));
}
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
        // C trap.c:thitm() names the missile with doname(), which also
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
function monsterPassesRocks(monster) {
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    return !!(flags & M1_WALLWALK) && !(flags & M1_UNSOLID);
}
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
// C trap.c:trapeffect_rocktrap(): the monster branch — the spent-trap
// chance, then the falling rock's thitm() hit.
export async function beginMonsterRockTrap(monster, trap, state = game, { random = rn2, rollDice = d } = {}) {
    const visibility = monsterTrapVisibility(monster, state);
    if (trap.once && trap.tseen && random(15) === 0) {
        const event = {
            kind: 'spent-rock-trap',
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
    const rock = await makeTrapMissile(ROCK, trap);
    if (visibility.inSight)
        await seeTrap(trap, state);
    return {
        kind: 'falling-rock',
        trap,
        rock,
        damage: rollDice(2, 6),
        harmless: monsterPassesRocks(monster),
        killed: false,
        finished: false,
        ...visibility,
    };
}
export function rockTrapNeedsResume(event) {
    return event?.kind === 'falling-rock' || (event?.kind === 'spent-rock-trap' && !event.finished);
}
export async function finishMonsterRockTrap(monster, event, state = game, { publish = async () => { }, random = rn2, describeMonster = target => canonicalMonsterName(target, { state, capitalized: true }), } = {}) {
    if (!event || event.finished)
        return event;
    if (event.kind === 'spent-rock-trap') {
        await publish(`A trap door above ${canonicalMonsterName(monster, { state })} opens, but nothing falls out!`);
        deleteTrap(event.trap, state);
        if (state === game)
            await newsym(monster.mx, monster.my);
        event.finished = true;
        return event;
    }
    if (event.seeSquare) {
        const subject = describeMonster(monster);
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
function canAlmostSee(state, x, y) {
    return !!((state.viz_array?.[y]?.[x] ?? 0) & COULD_SEE);
}
// C trap.c:trapeffect_sqky_board(): the monster branch — the squeak of
// trapnote()'s note, heard by the hero, waking nearby sleepers
// (C hack.c:wake_nearby() runs at the finish).
export function beginMonsterSqueakyBoard(monster, trap, state = game) {
    if (monsterInAir(monster, state))
        return null;
    const visibility = monsterTrapVisibility(monster, state);
    const deaf = !!state.deaf || heroIsDeaf(state);
    const range = canAlmostSee(state, monster.mx, monster.my) ? BOLT_LIM + 1 : BOLT_LIM - 3;
    return {
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
}
export async function finishMonsterSqueakyBoard(monster, event, state = game, { publish = async () => { }, } = {}) {
    if (!event || event.finished)
        return event;
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
const MZ_SMALL = 1;
const PM_OWLBEAR = MONSTER_NAME.indexOf('owlbear');
const PM_BUGBEAR = MONSTER_NAME.indexOf('bugbear');
function bearTrapCanCatch(monster, state) {
    return ((MONSTER_SIZE[monster?.mnum] ?? 0) > MZ_SMALL &&
        !monsterIsAmorphous(monster) &&
        !monsterIsWhirly(monster) &&
        !monsterIsUnsolid(monster) &&
        !monsterInAir(monster, state));
}
// C trap.c:trapeffect_bear_trap(): the monster branch — big enough, solid
// and grounded monsters are caught and take the d(2,4) bite unless they
// wear iron shoes (C trap.c:wearing_iron_shoes()); evaders only reveal a
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
// C trap.c:trapeffect_slp_gas_trap(): the monster branch — susceptible
// monsters fall asleep and are seen to do so.
export async function beginMonsterSleepGasTrap(monster, trap, state = game, { rollOne = rnd } = {}) {
    const visibility = monsterTrapVisibility(monster, state);
    const susceptible = !monsterResistsSleep(monster) &&
        !monsterIsBreathless(monster) &&
        !monsterIsHelpless(monster);
    const slept = susceptible ? await putMonsterToSleep(monster, rollOne(25)) : false;
    return {
        kind: 'sleep-gas',
        trap,
        slept,
        finished: !(slept && visibility.inSight),
        ...visibility,
    };
}
export function sleepGasTrapNeedsResume(event) {
    return event?.kind === 'sleep-gas' && !event.finished;
}
export async function finishMonsterSleepGasTrap(monster, event, { state = game, publish = async () => { }, describeMonster = target => monsterName(target, { state, capitalized: true }) } = {}) {
    if (!event || event.finished)
        return event;
    await publish(`${describeMonster(monster)} suddenly falls asleep!`);
    await seeTrap(event.trap, state);
    event.finished = true;
    return event;
}
async function presentRustTrap(monster, event, state, publish) {
    if (!event.inSight)
        return;
    const name = monsterName(monster, { state });
    const arm = monsterArmName(monster.mnum);
    const hit = event.target === 'head'
        ? `A gush of water hits ${name} on the ${monsterHeadName(monster.mnum)}!`
        : event.target === 'left-arm'
            ? `A gush of water hits ${name}'s left ${arm}!`
            : event.target === 'right-arm'
                ? `A gush of water hits ${name}'s right ${arm}!`
                : `A gush of water hits ${name}!`;
    await publish(hit);
    for (const effect of event.effects) {
        const objectName = effect.description ||
            OBJECT_NAMES[effect.object?.otyp] ||
            effect.object?.name ||
            'object';
        const owner = possessiveName(monsterName(monster, {
            state, capitalized: effect.kind !== 'rustproof',
        }));
        if (effect.kind === 'rustproof') {
            await publish(`Somehow, ${owner} ${objectName} is not affected by the oxidation.`);
        }
        else if (effect.kind === 'rusted') {
            const adverb = effect.erosion === 3 ? ' completely' : effect.erosion > 1 ? ' further' : '';
            await publish(`${owner} ${objectName} rusts${adverb}!`);
        }
        else if (effect.kind === 'lantern-flickers') {
            await publish(`${owner} ${objectName} crackles and flickers.`);
        }
        else if (effect.kind === 'extinguished') {
            await publish(`${owner} ${objectName} goes out!`);
        }
    }
    if (event.completelyRusted) {
        const action = event.startsToFall ? 'starts to fall' : 'falls';
        await publish(`${monsterName(monster, { state, capitalized: true })} ${action} to pieces!`);
    }
}
// C trap.c:trapeffect_rust_trap(): the monster branch — the rust or water
// jet over the monster's armor, or the iron-golem victim's fall.
export async function beginMonsterRustTrap(monster, trap, state = game, { random = rn2 } = {}) {
    const event = {
        ...await applyMonsterRustTrap(monster, state, { roll: random }),
        ...monsterTrapVisibility(monster, state),
        trap,
        finished: false,
    };
    // C trapeffect_rust_trap(): seetrap() redraws the square, showing the
    // monster on its new spot before the gush message.
    if (event.inSight)
        await seeTrap(trap, state);
    if (event.completelyRusted) {
        event.startsToFall = !!wornMonsterLifeSaver(monster);
        monster.mhp = 0;
    }
    return event;
}
export async function finishMonsterRustTrap(monster, event, state = game, { publish = plineWithContinuation, random = rn2, } = {}) {
    if (!event || event.finished)
        return event;
    await presentRustTrap(monster, event, state, publish);
    // C trapeffect_rust_trap() rolls and splits a gremlin only after the
    // gush and erosion messages.
    if (!event.completelyRusted && monster.mnum === PM_GREMLIN && random(3) !== 0)
        await splitMonster(monster, state, { monsterMoving: true, publish });
    if (event.completelyRusted) {
        const death = await finishMonsterKilled(monster, state, {
            damageType: AD_RUST,
            cause: null,
            random,
            publish,
        });
        event.death = death;
        event.killed = !death.survived;
    }
    event.finished = true;
    return event;
}
const PM_BABY_GRAY_DRAGON = MONSTER_NAME.indexOf('baby gray dragon');
const MAGIC_RESISTANCE_ARMOR = new Set([
    CLOAK_OF_MAGIC_RESISTANCE,
    GRAY_DRAGON_SCALE_MAIL,
    GRAY_DRAGON_SCALES,
]);
// C trap.c:trapeffect_anti_magic(): the hero branch — positively-enchanted
// iron shoes shed the drain onto their enchantment; otherwise the
// anti-magic field hits the protected hero (a carried artifact's
// C zap.c:defends_when_carried() bonus included) and drains power; the
// C trap.c:wearing_iron_shoes() test is heroIronShoes().
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
// C trap.c:trapeffect_anti_magic(): the monster branch — iron shoes shed
// the drain silently (C trap.c:wearing_iron_shoes() is
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
    if ((MONSTER_FLAGS1[monster.mnum] ?? 0) & M1_WALLWALK)
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
function monsterInventory(monster) {
    return monster?.minvent || monster?.inventory || [];
}
function monsterWeapon(monster) {
    return (monster?.mw ||
        monsterInventory(monster).find((object) => object?.wielded || (object?.owornmask ?? 0) & W_WEP));
}
export function monsterHasMagicResistance(monster) {
    if (monster?.mnum === PM_BABY_GRAY_DRAGON ||
        (MONSTER_ATTACKS[monster?.mnum] || []).some(([, damageType]) => damageType === AD_MAGM || damageType === AD_RBRE)) {
        return true;
    }
    const weapon = monsterWeapon(monster);
    if (artifactById(weapon?.oartifact)?.defense === 'magic')
        return true;
    return monsterInventory(monster).some((object) => {
        const artifact = artifactById(object?.oartifact);
        if (artifact?.carriedDefense === 'magic')
            return true;
        return (MAGIC_RESISTANCE_ARMOR.has(object?.otyp) &&
            !!((object?.owornmask ?? 0) & (W_ARMOR | W_ACCESSORY | W_WEP)));
    });
}
export function monsterWornIronShoes(monster) {
    return monsterInventory(monster).find((object) => objectMaterial(object?.otyp) === IRON && !!((object?.owornmask ?? 0) & W_ARMF));
}
function heroPassesWallsForAntiMagic() {
    return !!game.u?.passesWalls || !!(heroFormFlagsOfState(game) & M1_WALLWALK);
}
function heroWieldsMagicbane() {
    return artifactById(heroObject('uwep')?.oartifact)?.name === 'Magicbane';
}
function heroCarriesNonQuestMagicDefense() {
    return (game.inventory || []).some((object) => {
        const artifact = artifactById(object?.oartifact);
        return artifact && !artifact.questArtifact && artifact.carriedDefense === 'magic';
    });
}
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
// C trap.c:trapeffect_poly_trap(): the monster branch — worn iron shoes
// are transformed first (C trap.c:wearing_iron_shoes() is
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
export async function finishMonsterPolymorphTrap(event, { publish = async () => { }, finishDeath, state = game, } = {}) {
    if (!event)
        return event;
    if ('shielded' in event) {
        // C trap.c:trapeffect_poly_trap() -> mon.c:shieldeff_mon(): the
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
async function fallIntoMinePit(monster, trap, event, state, options) {
    if (!trap)
        return;
    // The recursive mintrap(FORCETRAP) teaches the new trap type before
    // trapeffect_pit(), including when the victim is immune to the fall.
    monsterLearnsTrap(monster, trap);
    monstersSeeTrap(state, trap);
    const pit = beginMonsterPitTrap(monster, trap, state, { forced: true });
    if (!pit)
        return;
    await finishMonsterPitTrap(monster, pit, {
        state,
        publish: options.publish,
        random: options.random,
        rollOne: options.rollOne,
        describeMonster: options.describeMonster,
    });
    if (pit.death)
        event.death = pit.death;
    if (pit.killed)
        event.killed = true;
}
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
// C trap.c:trapeffect_landmine(): the monster branch — a monster lighter
// than the trigger weight never sets it off, airborne ones rarely do, and
// the blast stages the pit and the kill; an unconscious hero is awakened
// by the explosion (C hack.c:unconscious()).
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
export function landMineNeedsResume(event) {
    return event?.kind === 'land-mine' && !!(event.exploded || event.discoveredTrigger);
}
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
function possessive(subject) {
    return /s$/iu.test(subject) ? `${subject}'` : `${subject}'s`;
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
            : `${possessive(subject)} ${makePlural(monsterFootName(monster.mnum).replace(/^rear /u, ''))}`;
        await publish(formatSeenMessage(`a strange vibration beneath ${location}.`));
    }
    event.finished = true;
    return event;
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
const M1_ACID = 0x08000000;
const M2_JEWELS = 0x20000000;
const M2_NASTY = 0x02000000;
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
    const destroy = flaming || !!((MONSTER_FLAGS1[body.mnum] ?? 0) & M1_ACID);
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
                (MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_NASTY) ||
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
// ── moved from src/js/pit_fill.ts ──
// C trap.c:fill_pit() and do.c:flooreffects()'s boulder/pit branch.
const M2_ROCKTHROW = 0x08000000;
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
// ── moved from src/js/untrap.ts ──
// Finding and removing floor, container, and door traps.
// C ref: trap.c dountrap(), could_untrap(), and untrap().
const G_UNIQ = 0x1000;
const S_HUMAN = 53;
const MZ_LARGE = 3;
function heroIsImpaired(state) {
    const hero = state.u;
    return !!hero.confused || (hero.confusionTurns ?? 0) > 0
        || heroIsHallucinating(state);
}
function heroIsStunned(state) {
    return !!(state.u?.stunned || (state.u?.stunnedTurns ?? 0) > 0);
}
function heroIsFumbling(state) {
    return !!(state.u?.fumbling || (state.u?.fumblingTurns ?? 0) > 0);
}
function heroPassesWallsForUntrap(state) {
    if (state.u.passesWalls)
        return true;
    const form = (state.u.mtimedone ?? 0) > 0 ? state.u.umonnum : null;
    return form !== null && form !== undefined && Number.isInteger(form)
        && !!((MONSTER_FLAGS1[form] ?? 0) & M1_WALLWALK);
}
function monsterAt(state, x, y) {
    return state.level?.monsters?.find(monster => monsterHasMapPosition(monster, state) &&
        !monster.dead && (monster.mhp ?? 1) > 0
        && monster.mx === x && monster.my === y) || null;
}
function boxesAt(state, x, y) {
    return (state.level?.objects?.[x]?.[y] || []).filter(object => object.otyp === LARGE_BOX || object.otyp === CHEST);
}
function possessiveTrap(trap) {
    return trap?.madeby_u ? 'your' : 'the';
}
function weldedTwoHandedWeapon(state) {
    const weapon = state.uwep || state.u?.uwep;
    return isWeldedPrimary(weapon, state) && isBimanualObject(weapon);
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
export async function untrap({ state = game, container = null, door = null, force = false, enterTrap = null, chooseDirection = promptDirection, ask = promptYesNoQuit, chooseObject = chooseInventoryObject, publish = pline, random = rn2, rollOne = rnd, rollDice = d, luckRandom = rnl, } = {}) {
    if (!force && heroHasMagicKey(state))
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
async function chooseFloorTrapOrBox(trap, noun, boxCount, ask) {
    const containers = boxCount === 1 ? 'a container' : 'containers';
    const verb = trap.ttyp === WEB ? 'Remove' : 'Disarm';
    const subject = `There ${boxCount === 1 ? 'is' : 'are'} ${containers} `
        + `and ${withIndefiniteArticle(noun)} here.`;
    return ask(`${subject}  ${verb} the ${noun}?`);
}
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
function webCuttingWeapon(trap, state) {
    if (monsterAt(state, trap.tx, trap.ty))
        return null;
    const primary = state.uwep || state.u?.uwep;
    if (primary && isBlade(primary))
        return primary;
    const secondary = state.uswapwep || state.u?.uswapwep;
    return state.u.twoweap && secondary && isBlade(secondary) ? secondary : null;
}
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
        && heroBadRock(state, state.u.ux, trap.ty)
        && heroBadRock(state, trap.tx, state.u.uy)
        && (((state.inventory || []).length > 0
            && inventoryWeight(state) > WT_TOOMUCH_DIAGONAL)
            || (MONSTER_SIZE[heroSpecies(state)] ?? 2) >= MZ_LARGE));
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
            const result = await triggerHeroTrap(trap, { failedUntrap: true });
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
                await triggerHeroTrap(web, { noWebMessage: true });
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
async function disarmLandmine(trap, options) {
    const result = await tryDisarm(trap, options);
    if (result < 2)
        return result !== 0;
    await options.publish(`You disarm ${possessiveTrap(trap)} land mine.`);
    await convertTrapToObject(trap, LAND_MINE, 1, options.state);
    return true;
}
async function disarmShootingTrap(trap, objectType, options) {
    const result = await tryDisarm(trap, options);
    if (result < 2)
        return result !== 0;
    await options.publish(`You disarm ${possessiveTrap(trap)} trap.`);
    const count = 50 - options.luckRandom(50);
    await convertTrapToObject(trap, objectType, count, options.state);
    return true;
}
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
// C trap.c:disarm_squeaky_board(): getobj("untrap with", unsqueak_ok,
// GETOBJ_PROMPT).  unsqueak_ok() downplays potions other than known oil.
async function chooseSqueakyBoardTool({ state, chooseObject }) {
    return chooseObject('untrap with', object => {
        if (object.otyp === CAN_OF_GREASE)
            return GETOBJ_SUGGEST;
        if (object.otyp === POT_OIL && object.dknown && objectTypeKnown(object, state))
            return GETOBJ_SUGGEST;
        return object.oclass === POTION_CLASS ? GETOBJ_DOWNPLAY : GETOBJ_EXCLUDE;
    }, { forcePrompt: true });
}
async function consumeOne(object, state) {
    const quantity = object.quan ?? object.quantity ?? 1;
    if (quantity <= 1) {
        await deleteObject(object, state);
        return;
    }
    object.quan = object.quantity = quantity - 1;
    object.owt = objectWeight(object);
}
function removeTrap(trap, state) {
    deleteTrap(trap, state);
    if (state.u?.utrap && state.u.ux === trap.tx && state.u.uy === trap.ty) {
        state.u.utrap = 0;
        state.u.utraptype = 0;
    }
    const monster = monsterAt(state, trap.tx, trap.ty);
    if (monster?.mtrapped)
        monster.mtrapped = 0;
}
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
function monsterIsHelplessForUntrap(monster) {
    return !!(monster.msleeping || monster.mfrozen
        || monster.mcanmove === 0);
}
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
        await publish(`You try to reach out your ${makePlural(heroArmName(state))}, but ${canonicalMonsterName(monster, { state })} backs away skeptically.`);
        return true;
    }
    if (touchPetrifies(monster.mnum)
        && !(state.uarmg || state.u?.uarmg)
        && !(state.u.stoneResistance)) {
        const species = monsterTypeName(monster.mnum, !!monster.female);
        await publish(`You grab the trapped ${species} using your bare ${makePlural(heroHandName(state))}.`);
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
    await publish(`You reach out your ${makePlural(heroArmName(state))} and grab ${canonicalMonsterName(monster, { state })}.`);
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
            state, disarm: true, bodyPart: heroFingerName(state), publish, random, rollDice,
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
async function triggerDoorTrap(door, x, y, { state, publish, rollOne }) {
    if (await triggerBoobyTrap('door', { bodypart: true, state, publish, rollOne }))
        return;
    door.doormask = D_NODOOR;
    vision_note_blocker_change(x, y);
    await newsym(x, y);
    if (roomsAt(state.level, x, y, SHOPBASE).length)
        addShopDamage(x, y, 0, state);
}
async function awardExperience(experience, scoreBonus, state, publish) {
    addExperience(experience, scoreBonus, state);
    if (state === game)
        await checkExperienceLevel({ publish });
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
const M1_HIDE = 0x00000100;
const S_MIMIC = 13;
const M1_BREATHLESS = 0x00000400;
const PM_CAVE_SPIDER = 94;
const PM_GIANT_SPIDER = 96;
const PM_GREMLIN = 40;
const IRON = 11;
const M2_STRONG = 0x04000000;
function heroMonsterForm() {
    requirePlayingGame(game);
    return game.u.umonnum;
}
function heroFormFlags() {
    return MONSTER_FLAGS1[heroMonsterForm()] ?? 0;
}
function physicalDamage(amount) {
    if (game.u?.halfPhysicalDamage)
        amount = Math.trunc((amount + 1) / 2);
    return amount;
}
function heroObject(slot) {
    return game[slot] || game.u?.[slot] || null;
}
function heroIronShoes() {
    const boots = heroObject('uarmf');
    return boots && objectMaterial(boots.otyp) === IRON ? boots : null;
}
function heroWearsIronShoes() {
    return !!heroIronShoes();
}
// C trap.c:trapeffect_pit(): the hero branch — refusal while flying or
// clinging, the fall and spike messages with iron-shoe protection,
// set_utrap, and the ridden steed's hit. C trap.c:t_at(): the previousPit
// find over the level's traps. C trap.c:adj_nonconjoined_pit(): the
// adjacent branch (hero.dx || hero.dy) below.
async function triggerPit(trap, { viaSitting = false, tookPlunge = false, recursiveTrap = false } = {}) {
    requirePlayingGame(game);
    const hero = game.u;
    const formFlags = heroFormFlags();
    const sokoban = !!game.level.flags?.sokoban_rules;
    const previousPit = game.level.traps.find(candidate => candidate.tx === hero.ux0 && candidate.ty === hero.uy0);
    const fromPit = !!hero.utrap && hero.utraptype === TT_PIT
        && previousPit && is_pit(previousPit.ttyp);
    const conjoined = fromPit && pitsAreConjoined(previousPit, trap);
    const adjacent = fromPit && (hero.dx || hero.dy);
    const alreadyKnown = !!trap.tseen;
    const flying = hero.flying || game.flying;
    // C trap.c:1836: plunged is TOOKPLUNGE only.  FAILEDUNTRAP never
    // reaches a pit: untrap() refuses pit targets before try_disarm().
    const plunged = tookPlunge;
    if (!sokoban && (hero.levitating || game.levitating
        || (flying && !plunged && !viaSitting)))
        return;
    await feelTrap(trap);
    if (!sokoban && (formFlags & M1_CLING) && !plunged) {
        if (alreadyKnown) {
            await plineWithContinuation(formatSeenMessage(`${trap.madeby_u ? 'your' : 'a'} ${trap.ttyp === SPIKED_PIT ? 'spiked ' : ''}pit below you.`));
        }
        else {
            await plineWithContinuation(`${trap.madeby_u ? 'Your' : 'A'} pit ${trap.ttyp === SPIKED_PIT ? 'full of spikes ' : ''}opens up under you!`);
            await plineWithContinuation("You don't fall in!");
        }
        return;
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
        return;
    }
    const mortality = hero.umortality || 0;
    if (spiked) {
        const damage = physicalDamage(rnd(conjoined ? 4 : adjacent ? 6 : 10));
        const killer = plunged ? 'deliberately plunged into a pit of iron spikes'
            : conjoined || deliberate ? 'stepped into a pit of iron spikes'
                : adjacent ? 'stumbled into a pit of iron spikes'
                    : 'fell into a pit of iron spikes';
        if (await loseHeroHp(damage, killer, { deathCause: killer }))
            return;
        if (rn2(6) === 0) {
            const poison = await poisonHero({
                reason: 'spikes',
                killer: conjoined || adjacent || deliberate
                    ? 'stepping on poison spikes' : 'fall onto poison spikes',
                attribute: A_STR,
                fatal: (hero.umortality || 0) > mortality ? 0 : 8,
            });
            if (poison.died)
                return;
        }
    }
    else if (!conjoined && !deliberate && !(plunged && (flying || (formFlags & M1_CLING)))) {
        const killer = plunged ? 'deliberately plunged into a pit' : 'fell into a pit';
        if (await loseHeroHp(physicalDamage(rnd(adjacent ? 3 : 6)), killer, { deathCause: killer }))
            return;
    }
    const ball = game.uball || hero.uball;
    if (heroIsPunished(game) && ball && !game.inventory.includes(ball)) {
        await unplaceBallAndChain(game);
        if (await fallWithIronBall(game))
            return;
        await placeBallAndChain(game);
    }
    if (!conjoined)
        await selfTouchPetrifyingWeapons({ messageStart: 'Falling, you' });
    game.vision_full_recalc = 1;
    await exerciseAttribute(A_STR, false);
    await exerciseAttribute(A_DEX, false);
}
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
        const action = await triggerImmediateMonsterTrap(steed, game, { force: forceTrap });
        await finishImmediateMonsterTrap(action, game);
        if (!steed.mtrapped) {
            await resetHeroTrap(false);
            return;
        }
        steed.mtrapped = 0;
        if ((MONSTER_FLAGS2[steed.mnum] ?? 0) & M2_STRONG)
            strength = 17;
        noWebMessage = true;
    }
    const turns = webTrapDuration(strength);
    setHeroTrap(turns, TT_WEB);
    if (!turns) {
        if (!noWebMessage)
            await plineWithContinuation(`You tear through ${trap.madeby_u ? 'your' : 'a'} web!`);
        deleteTrap(trap);
        await newsym(hero.ux, hero.uy);
    }
}
// C trap.c:trapeffect_landmine() guards steedintrap() with a static
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
// C trap.c:trapeffect_landmine(): the hero branch — the blast, blown-off
// footwear, the pit left behind, and the C trap.c:sobj_at() saddle check
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
    const landing = await triggerHeroTrapAt(hero.ux, hero.uy, { recursiveTrap: true });
    if (landing.died)
        return;
    await fillPitWithBoulderAt(hero.ux, hero.uy, game);
}
// C trap.c:set_utrap(): only a change between trapped and free marks the
// status line, since the trapped conditions follow u.utrap.
// C set_utrap() always ends in float_vs_flight(), which sets disp.botl even
// when a caller already counted u.utrap down to zero (trapmove()).
export function setHeroTrap(turns, type, state = game) {
    state.context.botl = true;
    state.u.utrap = turns;
    state.u.utraptype = turns ? type : 0;
    refreshMovementProperties(state);
}
// C trap.c:reset_utrap(FALSE): silently leave the trap, e.g. when
// #wizmakemap replaces the level (cmd.c:makemap_prepost(pre)).
export function clearHeroTrap(state = game) {
    setHeroTrap(0, 0, state);
}
export function reduceHeroTrapDuration() {
    const hero = game.u;
    if (hero.utrap === undefined)
        throw new Error('An active hero trap requires a remaining duration.');
    return --hero.utrap;
}
function objectAtHero(type) {
    const hero = game.u;
    return (game.level?.objects?.[hero.ux]?.[hero.uy] || [])
        .find(object => object.otyp === type) || null;
}
function trapAtHero() {
    const hero = game.u;
    return game.level?.traps?.find(trap => trap.tx === hero.ux && trap.ty === hero.uy) || null;
}
async function fillHeroPitWithBoulder() {
    await fillPitWithBoulderAt(game.u.ux, game.u.uy);
}
function heroEscapesPitEasily() {
    const form = heroMonsterForm();
    return form === PM_PIT_FIEND || (MONSTER_SIZE[form] ?? 2) >= MZ_HUGE;
}
export async function climbOutOfPit() {
    requirePlayingGame(game);
    const hero = game.u;
    if (!hero.utrap || hero.utraptype !== TT_PIT)
        return;
    const pit = trapName(PIT);
    if (heroPassesWalls()) {
        await pline(`You ascend from the ${pit}.`);
        clearHeroTrap();
        await fillHeroPitWithBoulder();
        game.vision_full_recalc = 1;
        return;
    }
    const creviceRoll = rn2(2);
    if (creviceRoll === 0 && objectAtHero(BOULDER)) {
        await plineWithContinuation(`Your ${heroLegName(game)} gets stuck in a crevice.`);
        await pline(`You free your ${heroLegName(game)}.`);
        return;
    }
    const canLeaveByAir = hero.flying || game.flying
        || !!(heroFormFlags() & M1_CLING);
    if (canLeaveByAir && !game.level?.flags?.sokoban_rules) {
        const locomotion = heroLocomotion('climb');
        await pline(`You ${locomotion} from the ${pit}.`);
        clearHeroTrap();
        await fillHeroPitWithBoulder();
        game.vision_full_recalc = 1;
        return;
    }
    if (reduceHeroTrapDuration() <= 0 || heroEscapesPitEasily()) {
        clearHeroTrap();
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
// C trap.c:trapeffect_telep_trap(): the hero branch — reveal the trap and
// jump; the monster branch is the TELEP_TRAP case of triggerMonsterTrap.
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
        await moveHeroByTeleport(destination.x, destination.y, game, { finishArrival: finishTeleport });
        return true;
    }
    finally {
        game._inTeleportTrap = false;
    }
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
// C trap.c:trapeffect_arrow_trap(): the hero branch — the 1-in-15
// exhausted-trap click, the shot at the hero, and the steed's chance to
// take it. C trap.c:trapeffect_dart_trap(): the dart twin, with a 1-in-6
// poisoned missile; the monster branches are beginMonsterProjectileTrap.
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
// C trap.c:trapeffect_sqky_board(): the hero branch — a flying hero
// notices the board, otherwise it squeaks trapnote()'s note.
async function triggerSqueakyBoard(trap, { viaSitting = false, failedUntrap = false, forceTrap = false } = {}) {
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
        return;
    }
    await seeTrap(trap);
    await plineWithContinuation(deaf
        ? 'A board beneath you vibrates.'
        : `A board beneath you squeaks ${squeakyBoardNoteWithArticle(trap.tnote ?? -1) || 'a note'} loudly.`);
    await wakeMonstersNearWithMessages(hero.ux, hero.uy, hero.ulevel * 20, game);
}
function heroPassesRocks() {
    const flags = heroFormFlags();
    return !!(flags & M1_WALLWALK) && !(flags & M1_UNSOLID);
}
// C trap.c:trapeffect_rocktrap(): the hero branch — the 1-in-15 empty
// chute, the falling rock, helmet and passes-rocks handling, and the
// damage; the monster branch is beginMonsterRockTrap.
async function triggerFallingRockTrap(trap) {
    const hero = game.u;
    const ceiling = ceilingName(hero.ux, hero.uy, game);
    if (trap.once && trap.tseen && rn2(15) === 0) {
        await plineWithContinuation(`A trap door in the ${ceiling} opens, but nothing falls out!`);
        deleteTrap(trap);
        await newsym(hero.ux, hero.uy);
        return;
    }
    let damage = d(2, 6);
    trap.once = true;
    await feelTrap(trap);
    const rock = await makeTrapMissile(ROCK, trap);
    placeCreatedObject(rock, hero.ux, hero.uy);
    observeObjectForNaming(rock);
    await plineWithContinuation(`A trap door in the ${ceiling} opens and ${withIndefiniteArticle(objectName(rock))} falls on your ${heroHeadName(game)}!`);
    let harmless = false;
    const helmet = game.uarmh || hero.uarmh;
    if (helmet) {
        if (heroPassesRocks()) {
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
    else if (heroPassesRocks()) {
        await plineWithContinuation('It passes harmlessly through you.');
        harmless = true;
    }
    if (!(game.blind || heroIsBlind(game)))
        observeObject(rock, game);
    await stack_object(rock, game);
    await newsym(hero.ux, hero.uy);
    if (!harmless) {
        if (await loseHeroHp(physicalDamage(damage), 'falling rock'))
            return;
        await exerciseAttribute(A_STR, false);
    }
}
// C trap.c:trapeffect_slp_gas_trap(): the hero branch — resistors stay
// awake inside the cloud, others fall asleep, and the steed's
// steedintrap() sleep follows; the monster branch is
// beginMonsterSleepGasTrap.
async function triggerSleepingGasTrap(trap) {
    const hero = game.u;
    await seeTrap(trap);
    const breathless = !!hero.breathless
        || !!(heroFormFlags() & M1_BREATHLESS);
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
    if (!steed || monsterResistsSleep(steed)
        || monsterIsBreathless(steed) || monsterIsHelpless(steed))
        return;
    steed.mx = hero.ux;
    steed.my = hero.uy;
    if (!await putMonsterToSleep(steed, rnd(25)))
        return;
    // C trap.c:3137: Monnam(steed); the name is not in-sight gated.
    const name = monsterName(steed, { capitalized: true });
    await plineWithContinuation(`${name} suddenly falls asleep!`);
}
// ── moved from src/js/hero_polymorph_trap.ts ──
const WAND_CLASS = 12;
// C trap.c:trapeffect_poly_trap(): the hero branch — the trigger message
// with the steed's lead-in, the form change or its reversal, the worn-gear
// consequences, and the steed's own C trap.c:steedintrap() polymorph.
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
        if (!monsterHasMagicResistance(steed) && !monsterResistsEffect(steed, WAND_CLASS, rn2))
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
const activeLaunches = new WeakMap();
// C launch_in_progress()/force_launch_placement(): bones retain the
// in-flight object at its original launch square so the trap can fire again.
export function restoreLaunchedObjectForBones(state) {
    const launch = activeLaunches.get(state);
    if (!launch)
        return;
    unlinkObject(launch.object, state);
    launch.object.otrapped = false;
    placeObjectSynchronously(launch.object, launch.origin.x, launch.origin.y, state);
}
// C trap.c:launch_obj(): roll an object (the boulder) from one square to
// another, resolving each square's occupants, traps and floor effects
// before the final placement; C trap.c:sobj_at(): boulderAt finds the
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
    activeLaunches.set(state, { object: boulder, origin: { ...source } });
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
                if ((MONSTER_FLAGS2[monster.mnum] ?? 0) & M2_ROCKTHROW && random(3)) {
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
        activeLaunches.delete(state);
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
        const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
        const harmless = !!(flags & M1_WALLWALK) && !(flags & M1_UNSOLID);
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
function boulderAt(position, state) {
    return state.level.objects[position.x]?.[position.y]?.find(object => object.otyp === BOULDER) ?? null;
}
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
// C trap.c:trapeffect_bear_trap(): the hero branch — harmless close over
// amorphous or tiny forms, the leg damage, and the TT_BEARTRAP snag.
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
        await plineWithContinuation(`${subject} bear trap closes on ${possessive} ${monsterFootName(steed.mnum)}!`);
        // C thitm(0, steed, NULL, damage, FALSE): forced damage, no missile.
        steed.mhp -= damage;
        if (steed.mhp <= 0) {
            const death = await finishMonsterTrapDeath(steed, game, { damageType: AD_PHYS });
            if (death.heroDied)
                return true;
            if (!death.survived)
                await resetHeroTrap(true);
        }
    }
    else {
        await plineWithContinuation(`${subject} bear trap closes on your ${heroFootName()}!`);
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
// C trap.c:trapeffect_rust_trap(): the hero branch — the rust or water jet
// over worn armor, the gremlin split, and the iron-golem hero's rust.
async function triggerRustTrap(trap) {
    const hero = game.u;
    await seeTrap(trap);
    const target = rn2(5);
    if (target === 0) {
        await plineWithContinuation(`A gush of water hits you on the ${heroHeadName(game)}!`);
        const helmet = heroObject('uarmh');
        await wetHeroObject(helmet, helmet ? armorSimpleName(helmet, game) : 'helmet');
    }
    else if (target === 1) {
        await plineWithContinuation(`A gush of water hits your left ${heroArmName(game)}!`);
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
        await plineWithContinuation(`A gush of water hits your right ${heroArmName(game)}!`);
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
}
// C trap.c:trapeffect_hole(): the hero branch — the fall refusal on levels
// without a bottom, the trap-door or hole message, and the destination
// draw; the monster branch is inline in triggerMonsterTrap.
export async function prepareHoleFall(trap, { tookPlunge = false } = {}) {
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
    const clinging = !!(heroFormFlags() & M1_CLING);
    const hidingAbove = game.u.uundetected && (heroFormFlags() & M1_HIDE)
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
        if (!game.valley_level)
            throw new Error('A Castle trapdoor requires the Valley destination');
        return { destination: { ...game.valley_level }, arrival: flying ? 'random' : 'falling' };
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
// C trap.c:trapeffect_selector(): the hero-side dispatch over trap type;
// dotrap()'s prelude above the switch runs the Sokoban air currents, the
// check_in_air() fly-over and the 1-in-5 seen-trap escape.
// C trap.c:adj_nonconjoined_pit(): fromPit && (hero.dx || hero.dy) inlines
// its xytodir() != DIR_ERR test; the other pit check belongs to
// pitsAreConjoined. C trap.c:trapeffect_statue_trap(): the hero case
// animates the statue; monsters never trigger one.
// C trap.c:trapeffect_magic_portal(): feelTrap plus the buried-ball
// reattachment before the portal owner runs; monsters fall through to
// C trap.c:trapeffect_level_telep()'s monster move. C trap.c:trapeffect_vibrating_square(): the hero
// branch only feels the trap; its symbol just marks the square.
// C trap.c:trapeffect_fire_trap(): the FIRE_TRAP case reveals the trap
// and runs dofiretrap() through triggerHeroFireTrap.
// shortCircuited stops remaining spot effects; died stops the whole action.
export async function triggerHeroTrap(trap, { finishTeleport = null, gotoLevel = null, viaSitting = false, failedUntrap = false, forceTrap = false, forceBungle = false, noWebMessage = false, tookPlunge = false, recursiveTrap = false, } = {}) {
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
        const previousPit = game.level.traps.find(candidate => candidate.tx === hero.ux0 && candidate.ty === hero.uy0);
        const fromPit = pit && hero.utrap && hero.utraptype === TT_PIT
            && previousPit && is_pit(previousPit.ttyp);
        const conjoined = fromPit && pitsAreConjoined(previousPit, trap);
        const adjacent = fromPit && (hero.dx || hero.dy);
        if (trap.tseen && !hero.fumbling && trap.ttyp !== MAGIC_PORTAL
            && trap.ttyp !== VIBRATING_SQUARE && trap.ttyp !== ANTI_MAGIC
            && !forceBungle && !tookPlunge && !conjoined && !adjacent
            && (rn2(5) === 0 || (pit && (heroFormFlags() & M1_CLING)))) {
            await plineWithContinuation(`You escape ${owner} ${trapName(trap.ttyp)}.`);
            return { died: false, shortCircuited: false };
        }
    }
    if (hero.usteed)
        monsterLearnsTrap(hero.usteed, trap);
    monstersSeeTrap(game, trap);
    let died = false;
    let shortCircuited = false;
    switch (trap.ttyp) {
        case HOLE:
        case TRAPDOOR: {
            const fall = await prepareHoleFall(trap, { tookPlunge });
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
            await triggerSqueakyBoard(trap, { viaSitting, failedUntrap, forceTrap });
            break;
        case ROCKTRAP:
            await triggerFallingRockTrap(trap);
            break;
        case ROLLING_BOULDER_TRAP:
            await triggerRollingBoulderTrap(trap);
            break;
        case SLP_GAS_TRAP:
            await triggerSleepingGasTrap(trap);
            break;
        case RUST_TRAP:
            await triggerRustTrap(trap);
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
            await triggerPit(trap, { viaSitting, tookPlunge, recursiveTrap });
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
export async function triggerHeroTrapAt(x, y, options = {}) {
    const trap = game.level?.traps?.find(candidate => candidate.tx === x && candidate.ty === y);
    return triggerHeroTrap(trap, options);
}
// ── moved from src/js/rock_breakage.ts ──
// C trap.c:sokoban_guilt().  force_bolt.js previously kept this logic beside
// its own boulder conversion; the shared fracture owner now owns it.
export function sokobanGuilt(state) {
    if (!state.level?.flags?.sokoban_rules)
        return;
    if (!state.u.uconduct)
        state.u.uconduct = {};
    state.u.uconduct.sokocheat = (state.u.uconduct.sokocheat ?? 0) + 1;
    changeHeroLuck(-1, state);
}
// ── moved from src/js/hero_sleep.ts ──
// C trap.c:unconscious(), narrower than Unaware (which also includes fainting).
export function heroIsUnconscious(state = game) {
    if (!heroHasInvoluntaryDelay(state))
        return false;
    const message = state._helplessDoneMessage || '';
    return !!state.u?.usleep || message.startsWith('You awake')
        || message.startsWith('You regain con')
        || message.startsWith('You are consci');
}
// ── moved from src/js/dungeon_feature.ts ──
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
// ── moved from src/js/light.ts ──
export async function igniteItems(objects, { state = game, publish = async () => { }, random = rn2, visible = true, } = {}) {
    const ignited = [];
    for (const object of objects || []) {
        // catch_lit() requires a current location, even during floor effects.
        if (!getObjectLocation(object, state))
            continue;
        if (!catchesFire(object, random))
            continue;
        const plural = (object.quan ?? object.quantity ?? 1) > 1;
        const blind = heroIsBlind(state);
        if (visible) {
            const name = lightSourceName(object, state);
            // C catch_lit() names the source with Yname2(): shop, carrier, or your/the.
            const prefix = objectOwnershipPrefix(object, state);
            await publish(blind
                ? `${prefix}${name} ${plural ? 'feel' : 'feels'} warm.`
                : `${prefix}${name} ${plural ? 'catch' : 'catches'} light!`);
        }
        // C apply.c:catch_lit() credits discovery even when the fire is unseen.
        if (object.otyp === POT_OIL)
            learnObjectType(POT_OIL, state);
        // C catch_lit(): an unpaid source that catches while carried is billed
        // for its use on top of its price.
        if (object.where === 'inventory' && object.unpaid
            && costlySpot(state.u.ux, state.u.uy, state)) {
            await chargeUnpaidUsage(object, { state });
            await publish(`"That's in addition to the cost of ${ownedObjectName(object, state, { capitalized: false })} ${plural ? 'themselves' : 'itself'}, of course."`);
            await billDummyObject(object, state);
        }
        if (beginObjectBurn(object, state, state.moves ?? 0))
            ignited.push(object);
    }
    return ignited;
}
// ── moved from src/js/light.ts ──
function catchesFire(object, random) {
    if (!object || object.lamplit || object.in_use
        || !LIGHT_TYPES.has(object.otyp)
        || object.otyp === BRASS_LANTERN)
        return false;
    if ((object.otyp === MAGIC_LAMP
        || object.otyp === CANDELABRUM_OF_INVOCATION)
        && (object.spe ?? 0) <= 0)
        return false;
    if (TIMED_LIGHT_TYPES.has(object.otyp) && (object.age ?? 0) <= 0)
        return false;
    if (object.otyp === CANDELABRUM_OF_INVOCATION && object.cursed)
        return false;
    return !([OIL_LAMP, MAGIC_LAMP].includes(object.otyp)
        && object.cursed && random(2) === 0);
}
function lightSourceName(object, state) {
    observeObjectForNaming(object, { state });
    const name = objectName(object, state);
    const quantity = object.quan ?? object.quantity ?? 1;
    return quantity > 1 ? makePlural(name) : name;
}
// C trap.c:wearing_iron_shoes().
export function monsterWearsIronShoes(monster) {
    const boots = wornInSlot(monster, W_ARMF);
    return !!boots && objectMaterial(boots) === IRON;
}
// ── moved from src/js/stoning.ts ──
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
// ── moved from src/js/properties.ts ──
// C trap.c:float_down()/float_up() read the stored HLevitation/ELevitation/
// BLevitation/BFlying masks before any caller removes a levitation source.
// Equipment and effect setters refresh the derived state while removing that
// source, so they snapshot first and pass the result through the landing
// owner's `previous` argument.  Both blocked bits are captured separately:
// terrain and a floor trap can block levitation at the same time, and only a
// sole floor-trap block (C BLevitation == I_SPECIAL) gets feedback.
export function captureLevitationState(state = game) {
    const hero = state.u;
    const trapped = (hero.utrap ?? 0) > 0 && hero.utraptype !== TT_PIT;
    const hasSource = propertySourceIsActive('levitation', state);
    return {
        // HLevitation || ELevitation
        hasSource,
        // Levitation macro: sources and not blocked
        active: propertyIsActive('levitation', state),
        // BLevitation FROMOUTSIDE: solid rock or a wall of water
        blockedByTerrain: !!existingPropertyRecord('levitation', state)?.blockedByTerrain,
        // BLevitation I_SPECIAL: floor-trap hold over live levitation sources
        blockedByTrap: hasSource && trapped,
        // Flying macro
        flying: propertyIsActive('flying', state),
        // BFlying: flight suppressed by levitation or a floor trap
        flyingBlocked: propertyIsBlocked('flying', state),
    };
}
// ── moved from src/js/terrain_movement.ts ──
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
            clearHeroTrap(state);
            await plineWithContinuation(`You float up, out of the ${trapName(PIT, { state })}!`);
            state.vision_full_recalc = 1;
            await fillPitWithBoulderAt(hero.ux, hero.uy, state);
        }
        else if (hero.utraptype === TT_LAVA || hero.utraptype === TT_INFLOOR) {
            await plineWithContinuation(`Your body pulls upward, but your ${makePlural(heroLegName(state))} are still stuck.`);
        }
        else if (hero.utraptype === TT_BURIEDBALL) {
            const ball = buriedBallNear(hero.ux, hero.uy, state);
            const terrain = requireGameLevel(state).requireAt(ball?.ox ?? hero.ux, ball?.oy ?? hero.uy);
            await plineWithContinuation(`You feel lighter, but your ${heroLegName(state)} is still chained to the ${IS_ROOM(terrain.typ) ? 'floor' : 'ground'}.`);
        }
        else if (hero.utraptype === WEB) {
            // C float_up() compares with WEB, not the hero restraint TT_WEB.
            await plineWithContinuation(`You float up slightly, but you are still stuck in the ${trapName(WEB, { state })}.`);
        }
        else {
            await plineWithContinuation(`You float up slightly, but your ${heroLegName(state)} is still stuck.`);
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
    if (steed && ![5, 25].includes(requireMonsterData(MONSTER_SYMBOL, steed.mnum))
        && !(requireMonsterData(MONSTER_FLAGS1, steed.mnum) & 0x01)) {
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
    refreshMovementProperties(state);
    state.context.botl = true;
    await reportHeroEncumbrance(state);
}
// C trap.c:float_down(hmask, emask).  The raw C bitmask arguments are kept:
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
        if (trappedSolely) {
            await plineWithContinuation(`You are no longer trying to float up from the ${floorTrapHoldName(hero)}.`);
        }
        refreshMovementProperties(state);
        await reportHeroEncumbrance(state);
        return 0;
    }
    state.context.botl = true;
    endVoluntaryMultiTurn(state); // C nomul(0)
    if (before.flyingBlocked) {
        // controlled flight is no longer overridden by levitation
        refreshMovementProperties(state);
        if (propertyIsActive('flying', state)) {
            await plineWithContinuation('You have stopped levitating and are now flying.');
            refreshMovementProperties(state);
            await reportHeroEncumbrance(state);
            return 1;
        }
    }
    if (hero.uswallow) {
        await plineWithContinuation(`You float down, but you are still ${monsterDigests(hero.ustuck) ? 'swallowed' : 'engulfed'}.`);
        refreshMovementProperties(state);
        await reportHeroEncumbrance(state);
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
    await reportHeroEncumbrance(state);
    // Falling through a trap door changes the level before this returns.
    const levelBefore = { dnum: hero.uz?.dnum, dlevel: hero.uz?.dlevel };
    if (trap && trap.ttyp !== STATUE_TRAP) {
        const hole = trap.ttyp === HOLE || trap.ttyp === TRAPDOOR;
        const blocked = hole && (!canFallThrough(hero.uz) || hero.ustuck);
        if (!blocked && !hero.utrap) { // not already in the trap
            const result = await triggerHeroTrap(trap, {
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
// C trap.c:float_down() floor-trap hold names, keyed by u.utraptype.
function floorTrapHoldName(hero) {
    if (hero.utraptype === TT_BEARTRAP)
        return "trap's jaws";
    if (hero.utraptype === TT_WEB)
        return 'web';
    if (hero.utraptype === TT_BURIEDBALL)
        return 'chain';
    if (hero.utraptype === TT_LAVA)
        return 'lava';
    return 'ground'; // TT_INFLOOR
}
// C trap.c:reset_utrap(): leave the trap, optionally announcing a regained
// sense of levitation or flight.
export async function resetHeroTrap(message = true, state = game) {
    // C trap.c:reset_utrap() snapshots the Levitation/Flying macros, which
    // read the blocked masks that only float_vs_flight() updates; after a
    // bare u.utrap zeroing (hack.c:trapmove()) those masks are still set.
    // The projected hero flags carry exactly that stale state, while a live
    // propertyIsActive() query would already see the trap gone.
    const wasLevitating = !!state.u.levitating;
    const wasFlying = !!state.u.flying;
    clearHeroTrap(state);
    if (message) {
        if (!wasLevitating && propertyIsActive('levitation', state))
            await floatHeroUp(state);
        if (!wasFlying && propertyIsActive('flying', state))
            await plineWithContinuation('You can fly.');
    }
}
// ── moved from src/js/floor_reach.ts ──
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
// ── moved from src/js/mklev.ts ──
// C trap.c:maketrap(): construct a trap at (x, y), reusing a replaceable
// trap already on the square; the per-type construction follows.
// C trap.c:hole_destination(): the destination draw for a new hole.
// C trap.c:choose_trapnote(): an unused note for a new squeaky board.
// C trap.c:mkroll_launch(): the rolling-boulder launcher places its
// boulder and records launch and launch2.
// C trap.c:find_random_launch_coord(): the search for a launch square with
// a clear path on both sides of the trigger, neither pool nor lava.
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
            await resetHeroTrap(false);
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
        // C ref: trap.c hole_destination().  Ordinary holes and trapdoors
        // advance at least one level, then have a 3/4 chance to stop at each
        // level until the current dungeon's bottom is reached.
        const dnum = game.u?.uz?.dnum ?? 0;
        const dungeon = game.dungeons?.[dnum];
        let bottom = dungeon?.num_dunlevs
            ?? (game.u?.uz?.dlevel ?? 1);
        if (In_quest(game.u.uz)) {
            const locate = game.specialLevels?.get('x-loca');
            if (locate && (dungeon?.dunlev_ureached ?? 0) < locate.dlevel)
                bottom = locate.dlevel;
        }
        else if (In_hell(game.u.uz) && !game.u.uevent?.invoked) {
            bottom--;
        }
        let dlevel = game.u?.uz?.dlevel ?? 1;
        while (dlevel < bottom) {
            dlevel++;
            if (rn2(4))
                break;
        }
        trap.dst = { dnum, dlevel };
    }
    if (is_pit(typ) || is_hole(typ)) {
        await preparePitOrHoleTerrain(x, y, typ);
    }
    else if (typ === STATUE_TRAP) {
        // trap.c mk_trap_statue(): avoid a co-aligned unicorn whose eventual
        // attitude would contradict the trap, then let mkcorpstat() perform
        // its independent initialized-statue identity before overwriting it.
        let statueMonster;
        let tryCount = 10;
        do {
            statueMonster = rndmonnumAdj(3, 6);
        } while (--tryCount > 0
            && MONSTER_SYMBOL[statueMonster] === 21
            && ((MONSTER_FLAGS2[statueMonster] ?? 0) & M2_JEWELS)
            && Math.sign(game.u?.ualign?.type ?? 0)
                === Math.sign(MONSTER_ALIGNMENT[statueMonster] ?? 0));
        const statue = await createCorpstatAt(STATUE, null, statueMonster, x, y, 0);
        const temporary = await makemon(statue.corpsenm ?? null, 0, 0, MM_NOCOUNTBIRTH | MM_NOMSG);
        if (temporary) {
            await putGeneratedMonsterInventoryInStatue(temporary, statue);
            level.monsters = level.monsters.filter(monster => monster !== temporary);
        }
    }
    else if (typ === SQKY_BOARD) {
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
        trap.tnote = selectedNote;
    }
    else if (typ === ROLLING_BOULDER_TRAP
        && level.flags.sokoban_rules) {
        // Sokoban has no rolling-boulder launchers. The trap stays in place
        // without creating another boulder.
        trap.launch = { x, y };
        trap.launch2 = { x, y };
    }
    else if (typ === ROLLING_BOULDER_TRAP) {
        // C ref: trap.c find_random_launch_coord()/mkroll_launch().  A
        // rolling-boulder trap chooses one distance and starting direction,
        // then searches all eight directions at decreasing distances until
        // both sides of the trigger have a clear path and the launch square
        // is neither pool nor lava.
        let distance = rn1(5, 4);
        let direction = rn2(8);
        let tries = 0;
        // isclearpath(): any ZAP_POS terrain (pools and lava included) except
        // a closed or locked door, with no pit, hole, or teleport trap.
        const isClearPath = (dx, dy, length) => {
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
        };
        let launch = null;
        while (distance >= 2) {
            const dx = xdir[direction], dy = ydir[direction];
            if (dx === undefined || dy === undefined)
                throw new Error(`Rolling boulder trap has invalid direction ${direction}`);
            const lx = x + distance * dx, ly = y + distance * dy;
            const landsInLiquid = isPoolAt(lx, ly) || isLavaAt(lx, ly);
            if (!landsInLiquid && isClearPath(dx, dy, distance)
                && isClearPath(-dx, -dy, distance)) {
                launch = { x: lx, y: ly };
                break;
            }
            direction = (direction + 1) % 8;
            if (++tries % 8 === 0)
                distance--;
        }
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
// C trap.c:maketrap() owns these effects even when the caller is Lua or
// wizard trap creation rather than digging. Preserve the old shop terrain
// for repair before opening the floor and exposing buried objects.
async function preparePitOrHoleTerrain(x, y, trapType) {
    const level = requireGameLevel();
    const location = level.requireAt(x, y);
    const oldType = location.typ;
    const wasIce = isIceAt(x, y);
    const wallOrDoor = IS_DOOR(oldType) || IS_WALL(oldType);
    if (roomsAt(game.level, x, y, SHOPBASE).length
        && (is_hole(trapType) || wallOrDoor)) {
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
            await resetHeroTrap(true, state);
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
// ── moved from src/js/hack.ts ──
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
// C trap.c:sink_into_lava().
export async function sinkHeroIntoLava({ state = game, publish = plineWithContinuation, random = rn2, rollOne = rnd, repaint = newsym, resetVision = vision_reset, recalculateVision = vision_recalc, applyLandingEffects = async () => { }, die = finishLiquidDeath, } = {}) {
    requirePlayingGame(state);
    const hero = state.u;
    if (!hero?.utrap || hero.utraptype !== TT_LAVA)
        return null;
    const location = state.level?.at?.(hero.ux, hero.uy);
    if (!location || !isLavaAt(state.u.ux, state.u.uy, state)) {
        clearHeroTrap(state);
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
        await resetHeroTrap(true, state);
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
// C trap.c:rescued_from_terrain()/back_on_ground(TRUE).
export async function announceTerrainRescue(how, state, publish = plineWithContinuation) {
    const { ux, uy } = state.u;
    const location = state.level.requireAt(ux, uy);
    if (how === DROWNING && isPoolAt(ux, uy, state)) {
        const position = heroIsOnWaterLevel(state) || IS_WATERWALL(location.typ)
            ? 'in the midst' : 'on top';
        await publish(`You find yourself ${position} of ${displayLiquidName('water', state)}.`);
    }
    else if (how === DROWNING && IS_AIR(location.typ)) {
        await publish(`You find yourself in ${heroIsOnWaterLevel(state) ? 'an air bubble' : 'mid air'}.`);
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
// ── moved from src/js/ice.ts ──
// C trap.c:trap_ice_effects(..., TRUE).
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
//# sourceMappingURL=trap.js.map