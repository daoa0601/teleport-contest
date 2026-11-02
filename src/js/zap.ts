// Ray attacks, terrain changes, and elemental item damage.
// C ref: zap.c dobuzz(), zap_over_floor(), zhitm(), zhitu(), destroy_items(),
// learnwand(), zappable(), zapnodir(), backfire(), dozap(), zap_steed(),
// zap_updown(), weffects(), zap_map(), and bhit()'s ZAPPED_WAND branch.

import { objectMaterial } from './o_init.js';
import { convertSecretDoor, findit, revealSecretDoor, showMapSpot } from './detect.js';
import { formatFeltMessage, publishHeardMessage } from './hero_speech.js';
import { heroFaceName, heroFootName, heroHeadName } from './body_parts.js';
import { monsterHasMapPosition, monsterAtPosition } from './steed.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { GETOBJ_EXCLUDE, GETOBJ_SUGGEST, PLNMSG_ENVELOPED_IN_GAS, ZAP_POS, isok, ANTI_MAGIC, CORR, DBWALL, D_CLOSED, D_LOCKED, DOOR, DRAWBRIDGE_DOWN, ENGRAVE, EXPL_MAGICAL, HEADSTONE, HOLE, IS_FURNITURE, Is_airlevel, Invocation_lev, LEVEL_TELEP, MAGIC_PORTAL, MAGIC_TRAP, POLY_TRAP, SCORR, TELEP_TRAP, TRAPDOOR, TRAP_EXPLODE, VIBRATING_SQUARE, A_CON, A_CHA, W_ARMH, A_WIS, W_ARMG, A_DEX, A_STR, A_INT, W_RING, W_ARMOR, G_GENOD, MAX_OIL_IN_FLASK, MAX_SPELL_STUDY, MM_NOMSG, NO_MINVENT, W_AMUL, W_ART, W_ARTI, W_QUIVER, W_RINGL, W_RINGR, W_SWAPWEP, W_TOOL, W_WEP, COLNO, DB_FLOOR, DB_ICE, DB_UNDER, DRAWBRIDGE_UP, FOUNTAIN, SHOP_BARS_COST, SHOP_DOOR_COST, D_BROKEN, D_NODOOR, HWALL, ICE, ICED_MOAT, ICED_POOL, IRONBARS, IS_WALL, IS_WATERWALL, Is_rogue_level, Is_waterlevel, ismnum, LAVAWALL, PIT, POOL, ROOM, ROWNO, SDOOR, TT_INFLOOR, TT_LAVA, Upolyd, VWALL, WEB, W_NONDIGGABLE, SHOPBASE, BOLT_LIM, LEVEL_TIMER_KIND, OBJECT_TIMER_KIND } from './const.js';
import { objectDirection, OBJECT_SUBTYPE, AMULET_OF_YENDOR, BELL_OF_OPENING, CORPSE, CRYSTAL_BALL, MAGIC_LAMP, SPE_NOVEL, OBJECT_MAGIC, OBJECT_NAMES, POT_ACID, POT_FRUIT_JUICE, POT_SICKNESS, POT_WATER, SCR_BLANK_PAPER, SPE_BLANK_PAPER, SPE_BOOK_OF_THE_DEAD, WAN_CANCELLATION, AMULET_OF_UNCHANGING, BOULDER, CHEST, EGG, ENORMOUS_MEATBALL, FIGURINE, LARGE_BOX, LEASH, MAGIC_MARKER, MEATBALL, MEAT_RING, MEAT_STICK, OIL_LAMP, POT_GAIN_ABILITY, POT_OIL, POT_POLYMORPH, ROCK, SPE_POLYMORPH, STATUE, UNICORN_HORN, getObjectClassBounds, WAN_LIGHT, WAN_LIGHTNING, WAN_POLYMORPH, WAN_WISHING, DWARVISH_CLOAK, GLOB_OF_GREEN_SLIME, OBJECT_CHARGED, OBJECT_PROPERTY, RIN_SHOCK_RESISTANCE, SCR_FIRE, SPE_FIREBALL, WAN_STRIKING, SPE_CURE_SICKNESS, SPE_DETECT_UNSEEN, SPE_DIG, SPE_DRAIN_LIFE, SPE_EXTRA_HEALING, SPE_FINGER_OF_DEATH, SPE_FORCE_BOLT, SPE_HEALING, SPE_KNOCK, SPE_LIGHT, SPE_MAGIC_MISSILE, SPE_SLOW_MONSTER, SPE_STONE_TO_FLESH, SPE_TELEPORT_AWAY, SPE_WIZARD_LOCK, WAN_CREATE_MONSTER, WAN_DIGGING, WAN_ENLIGHTENMENT, WAN_LOCKING, WAN_MAGIC_MISSILE, WAN_MAKE_INVISIBLE, WAN_OPENING, WAN_PROBING, WAN_SECRET_DOOR_DETECTION, WAN_SLOW_MONSTER, WAN_SPEED_MONSTER, WAN_STASIS, WAN_TELEPORTATION, OBJECT_MERGE, TIN } from './object_data.js';
import { zapHeroWithObject } from './hero_self_zap.js';
import { updateIceObjectTimersAt, placeCreatedObject, stack_object, placeObject } from './floor_object.js';
import { isIceAt, isLavaAt, isMoatAt, isPoolAt } from './dbridge.js';

import { heroHasArtifactDefense, heroHasCarriedArtifactFlag, artifactById } from './artifacts.js';
import { exerciseAttribute, exerciseWisdom, currentAttribute } from './attrib.js';
import type { AttributeIndex } from './attrib.js';
import { canSeeMonster, consumeHallucinatedMenuObjectGlyph, displayColorName, displayLiquidName, docrt, glyphAt, newsym, randomDisplayMonsterName, shieldeff, unmap_invisible } from './display.js';
import { plineWithContinuation } from './pline.js';
import type { MessagePublisher } from './pline.js';
import { formatDraftMessage } from './draft_message.js';
import { ceilingName, surfaceName, waterbodyName } from './terrain_name.js';
import { resetPick } from './lock.js';

import { game, requireLiveGame, requirePlayingGame } from './gstate.js';
import { monsterHasFireResistance, monsterHasShockResistance, monsterHasSeductionAttack, monsterResistanceBits } from './mondata.js';
import { closeDrawbridge, destroyDrawbridge, findDrawbridgeAt, openDrawbridge } from './dbridge.js';
import { drawbridgeUnderlyingType } from './dbridge.js';

import { roomsAt } from './room.js';
import { setHeroTrap, triggerHeroTrap } from './hero_traps.js';
import { monsterName } from './do_name.js';
import { possessiveName } from './hacklib.js';
import { destroyObjectFromMonsterInventory, checkMonsterGearNextTurn } from './monworn.js';
import { loseHeroHp } from './hero_damage.js';
import { commandResultCancelled } from './cmd.js';
import { removeHeroAccessory, wearHeroAccessory } from './do_wear.js';

import { removeHeroEquipment, removeWornHeroItem } from './hero_equipment.js';
import { rechargeRing } from './recharge.js';
import { finishHeroDeath } from './end.js';
import type { DeathHandler } from './end.js';
import { meltIce } from './ice.js';
import { consumeInventoryItem, inventoryItemDescription, delobj } from './invent.js';
import { useUpInventoryStack, prepareInventoryAddition, finishInventoryAddition, finishInventoryRemoval } from './hero_inventory.js';
import { igniteItems, lightDamage, lightRoom } from './light.js';
import { buryFloorObjectsAt } from './dig.js';
import { deleteFloorTrap, maketrap, randomEngraving, CANDELABRUM_OF_INVOCATION } from './mklev.js';
import { fix_wall_spines } from './mkmaze.js';
import { finishImmediateMonsterTrap, triggerImmediateMonsterTrap, objectIsVulnerableToErosion, deleteTrap, trapName, closeHoldingTrap, openFallingTrap, openHoldingTrap, erosionMatters } from './trap.js';
import { makePlural, withIndefiniteArticle, armorUsesPairGrammar, objectDescription } from './objnam.js';
import { learnObjectType, observeObject, objectClassForType } from './o_init.js';
import { inventoryClassOrder, lootSortMode, objectClassHeading, sortObjects } from './invent.js';
import { objectQuantity, splitObjectStack } from './mkobj.js';

import { MONSTER_FLAGS1, MONSTER_LEVEL, MONSTER_MAGIC_RESISTANCE, MONSTER_NAME, monsterIsPlayerMonster, monsterIsWhirly, MONSTER_BODY_META, MONSTER_GENO, MONSTER_SYMBOL, requireMonsterData, monsterIsRider } from './monster_data.js';

import { scheduleLevelTimer, stopLevelTimer, objectsInTimerGraph, objectTimers, scheduleObjectTimer, stopObjectTimer, stopObjectTimers } from './timeout.js';
import { applySupportedPotionVapor } from './potion.js';
import { heroHasNoHands, heroFormHidesUnderObjects } from './polyself.js';
import { createPoisonGasCloud } from './regions.js';
import { dryFountainAt } from './fountain.js';
import { dissolveBars } from './projectile_bars.js';
import { resetHeroTrap } from './terrain_movement.js';
import { stopHeroOccupation } from './occupation.js';
import { d, rn1, rn2, rnd } from './rng.js';
import { promptDirection } from './tty_prompts.js';
import { cansee, couldsee, vision_note_blocker_change } from './vision.js';
import { exceedsActionCapacity, objectWeight } from './weight.js';
import { chargeUnpaidUsage, addShopDamage, payForShopDamage, objectTypeKnown, chargeAlteredUnpaidObject, addShopObjectToBill, costlySpot, stolenValue, hotPursuitShopkeeper, makeAngryShopkeeper, deleteObjectContents, shopkeeperInOwnShop, containedBuyCost } from './shk.js';
import { hasWornProperty } from './properties.js';
import { closedRayDoor } from './ray.js';
import { hitMonsterWithRay, zapRayWithObject } from './ray_attack.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { isContainer } from './container.js';

import { AD_MAGM, AD_FIRE, AD_COLD, AD_SLEE, AD_DISN, AD_ELEC, AD_DRST, AD_ACID, AD_SPC1, AD_SPC2 } from './monster_attack_types.js';
import type { DamageType } from './monster_attack_types.js';

import { showInventoryWindow } from './windows.js';
import type { InventorySection } from './windows.js';
import { definiteName, definiteObjectAction, killerObjectName, objectName, objectNameIsPlural, ownedObjectName, observeObjectForNaming, observeDistantObjectForNaming, pluralizeObjectNoun, rndClass } from './objnam.js';
import { useUpFloorObject } from './floor_consumption.js';
import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Monster, SavedMonsterTraits } from './monster_types.js';
import type { Trap } from './map_types.js';
import type { PropertyName } from './property_types.js';
import { changeMonsterForm, copyPetData, normalizeMonsterShape, wakeMonster, maybeUnhideAt, revealMonsterAppearance } from './mon.js';
import type { MonsterDeathOptions, MonsterFormChange, MonsterFormChangeOptions, MonsterSelfTouchResult } from './mon.js';
import { setMonsterPermanentInvisibility, bypassObjectList, nextUnbypassedObject, bypassObject, adjustMonsterSpeed, monsterSpeedMessage } from './worn.js';
import { redrawMonsterWormSegments } from './worm.js';
import { expelHero, holdingMonsterName } from './hero_expulsion.js';
import { monsterHasMagicResistance } from './anti_magic_trap.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import type { HeroMonsterKillOptions } from './hero_monster_death.js';
import { monsterHitPointsPerLevel, createCritters, makemonAt } from './makemon.js';
import type { MonsterHitPointRandom } from './makemon.js';
import { zapDigWithObject } from './dig.js';
import { objectIsHardHelmet, applyArmorOnEffects, armorSlotFor, wearHeroArmor } from './do_wear.js';

import { impossible } from './diagnostics.js';
import { changeDoorByMagic } from './lock.js';

import { recordMappedOverviewState } from './dungeon.js';
import { forceDescribeDecor } from './dungeon_feature.js';
import { deleteEngravingAt, engravingAt, makeEngravingAt, wipeEngravingAt, relocateEngraving } from './engrave.js';
import { addExperience } from './exper.js';
import { explode } from './explosion.js';
import { beginImmediateZap, finishImmediateZap, hitFloorPileWithWand, hitMonsterWithWand, hitObjectWithWand } from './immediate_zap.js';
import { doEnlightenmentEffect, monsterStatusLine } from './insight.js';
import { gotoLevel } from './level_change.js';
import { mksobj, unblessObjectState, uncurseObjectState, mkobj, set_corpsenm, replaceObject, unlinkObject } from './mkobj.js';
import { okToQuest, onQuestStart } from './quest.js';
import { askTeleportDestination, heroControlsTeleport, teleportHero } from './teleport.js';
import { goodPosition } from './teleport_rules.js';
import { makeWish } from './wish.js';
import { bot } from './botl.js';
import { isWeaponTool, isBimanualObject, isPoisonableObject } from './object_properties.js';
import { hatchableEggSpecies, eggSpeciesIsDead } from './egg_species.js';

import { isEyewear, wearEyewear } from './eyewear.js';
import { setPrimaryWeapon, setQuiverObject, setSecondaryWeapon, setTwoWeaponCombat } from './wield.js';
import { releaseObjectLeash } from './leash_apply.js';
import { fractureRock, sokobanGuilt } from './rock_breakage.js';
import { LL_CONDUCT, recordGameLogEvent } from './gamelog.js';
import { animateStatue } from './statue_trap.js';
import { vegetarianCorpse } from './food_traits.js';
import { updateInventoryPresentation } from './u_init.js';
import { changeBoxLockByMagic } from './box_magic.js';
import { shopkeeperName } from './shknam.js';

export interface FloorBurnOptions {
    state?: GameState;
    giveFeedback?: boolean;
    heroCaused?: boolean;
    publish?: MessagePublisher;
    random?: typeof rn2;
    visible?: boolean;
    repaint?: (x: number, y: number) => void | Promise<void>;
}
export interface RayFloorOptions {
    rayNoun?: 'bolt' | 'spell' | 'blast';
    random?: typeof rn2;
    heroCaused?: boolean;
    explodingWand?: number;
    heroBurnsObjects?: boolean;
    publish?: MessagePublisher;
}
export interface InventoryDamageOptions {
    state?: GameState;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollOne?: typeof rnd;
    die?: DeathHandler;
}
export interface MonsterInventoryDamageOptions extends Omit<InventoryDamageOptions, 'die'> {
    visible?: boolean;
}
interface ChosenItemDamageOptions {
    state: PlayingGameState;
    publish: MessagePublisher;
    random: typeof rn2;
    rollOne: typeof rnd;
    die: DeathHandler;
}

const RING_CLASS = 4;
const POTION_CLASS = 8;
const SCROLL_CLASS = 9;
const SPBOOK_CLASS = 10;
const WAND_CLASS = 11;

const NODIR = 1, IMMEDIATE = 2;
const MAX_ITEMS_DESTROYED = 20;
const RAY_FIRE = 'fire';
const RAY_COLD = 'cold';
const RAY_DISINTEGRATION = 'disintegration';
const RAY_LIGHTNING = 'lightning';
const RAY_ACID = 'acid';

export const INVENTORY_DAMAGE = Object.freeze({
    COLD: 'cold',
    FIRE: 'fire',
    ELECTRIC: 'electric',
});

// C zap.c:learnwand().
export function learnWand(object: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (object.oclass === 10) return; // Spell pseudo-objects do not rediscover books.
    if (objectTypeKnown(object, state)) observeObject(object, state);
    else {
        if (!heroIsBlind(state)) observeObject(object, state);
        if (object.dknown) learnObjectType(object.otyp, state);
    }
}

// C zap.c:zappable(). It removes a charge from the wand when one is left.
export async function zappable(wand: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (wand.spe < 0 || (wand.spe === 0 && rn2(121) !== 0)) return false;
    if (wand.spe === 0)
        await plineWithContinuation('You wrest one last charge from the worn-out wand.');
    wand.spe--;
    return true;
}

// C zap.c zapnodir(), also the engrave command's no-direction wand effects.
export async function zapWithoutDirection(source: GameObject, state: PlayingGameState) {
    let known = false;
    switch (source.otyp) {
    case WAN_LIGHT:
    case SPE_LIGHT:
        known = source.dknown && !heroIsBlind(state);
        await lightRoom(true, { finishMonsterKill: finishHeroMonsterKill });
        if (state.program_state.gameover) return;
        await lightDamage(source, true, 5, { state });
        break;
    case WAN_SECRET_DOOR_DETECTION:
    case SPE_DETECT_UNSEEN:
        known = !!source.dknown;
        await findit();
        break;
    case WAN_STASIS:
        state.level.flags.stasis_until = Math.max(state.level.flags.stasis_until || 0,
            state.moves + rn2(21) + 10);
        break;
    case WAN_CREATE_MONSTER:
        if (await createCritters(rn2(23) ? 1 : rn2(7) + 2)) known = !!source.dknown;
        break;
    case WAN_WISHING:
        // zapnodir(): C tests Luck, which includes a carried luckstone's bonus.
        if ((state.u.uluck || 0) + (state.u.moreluck || 0) + rn2(5) < 0)
            await plineWithContinuation('Unfortunately, nothing happens.');
        else {
            known = !!source.dknown;
            await makeWish();
        }
        break;
    case WAN_ENLIGHTENMENT:
        known = !!source.dknown;
        await doEnlightenmentEffect();
        break;
    }
    if (known && !state.program_state.gameover) {
        if (!objectTypeKnown(source, state)) addExperience(0, 10, state);
        learnWand(source, { state });
    }
}

// C zap.c:backfire(). Native backfire differs from a failed recharge: every
// wand uses d6 here.
export async function backfireWand(wand: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    wand.in_use = true;
    await plineWithContinuation(`${definiteObjectAction(wand, null, state)} suddenly explodes!`);
    const damage = d(wand.spe + 2, 6);
    const injury = state.u.halfPhysicalDamage ? Math.ceil(damage / 2) : damage;
    if (await loseHeroHp(injury, 'exploding wand', {
        state, deathCause: 'killed by an exploding wand',
    })) return;
    await useUpInventoryStack(wand, state);
}

async function finishWandUse(wand: GameObject | null) {
    if (!wand || wand.spe >= 0) return;
    await plineWithContinuation(`${definiteObjectAction(wand, 'turn')} to dust.`);
    await useUpInventoryStack(wand);
}

// C zap.c:dozap(). Selection/charges surround the shared effect transaction.
export async function dozap(): Promise<void> {
    requirePlayingGame(game);
    if (heroHasNoHands(game)) {
        await plineWithContinuation("You aren't able to zap anything in your current form.");
        game.context.move = 0;
        return;
    }
    if (exceedsActionCapacity(game)) {
        await plineWithContinuation("You can't do that while carrying so much stuff.");
        game.context.move = 0;
        return;
    }
    let wand = await chooseInventoryObject('zap', object =>
        object?.oclass === WAND_CLASS ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE);
    if (!wand) {
        // zap.c:dozap() returns ECMD_CANCEL when getobj() yields nothing;
        // the rhack seam clears the repeat queue so a later ^A has nothing
        // to redo.
        commandResultCancelled();
        return;
    }
    await chargeUnpaidUsage(wand);
    const needsDirection = objectDirection(wand.otyp, game) !== 1;
    if (!await zappable(wand)) {
        await plineWithContinuation('Nothing happens.');
    } else if (wand.cursed && rn2(100) === 0) {
        await backfireWand(wand);
        if (game.program_state.gameover) return;
        await exerciseAttribute(A_STR, false);
        game.context.move = 1;
        return;
    } else if (needsDirection && !await promptDirection()) {
        if (!heroIsBlind()) {
            await plineWithContinuation(`${definiteObjectAction(wand, null)} glows and fades.`);
        }
    } else if (needsDirection && !game.u.dx && !game.u.dy && !game.u.dz) {
        const effect = await zapHeroWithObject(wand);
        if (effect.heroDied) return;
        if (effect.damage) {
            const damage = game.u.halfPhysicalDamage ? Math.ceil(effect.damage / 2) : effect.damage;
            const cause = `zapped ${game.flags.female ? 'herself' : 'himself'} with ${killerObjectName(wand)}`;
            if (await loseHeroHp(damage, cause, { deathCause: cause })) return;
        }
    } else {
        game._currentWand = wand;
        await applyWandEffect(wand);
        wand = game._currentWand;
        game._currentWand = null;
    }
    if (game.program_state.gameover) return;
    await finishWandUse(wand);
    game.context.move = 1;
}

// C zap.c:zap_steed(). Zapping downwards while riding applies the wand to
// the steed first.
async function zapSteed(source: GameObject, state: PlayingGameState) {
    const steed = state.u.usteed;
    if (!steed) return false;
    state.bhitpos = { x: steed.mx, y: steed.my };
    state.notonhead = false;
    switch (source.otyp) {
    case WAN_PROBING:
        await probeMonster(steed, { state });
        learnWand(source, { state });
        return true;
    case WAN_TELEPORTATION:
    case SPE_TELEPORT_AWAY: {
        const { ux: x, uy: y } = state.u;
        await teleportHero({ chooseDestination: askTeleportDestination });
        if ((heroControlsTeleport(state) && !(state.u.stunned || (state.u.stunnedTurns ?? 0) > 0))
            || !couldsee(x, y) || (state.u.ux - x) ** 2 + (state.u.uy - y) ** 2 >= 16)
            learnWand(source, { state });
        return true;
    }
    case SPE_CURE_SICKNESS:
    case WAN_MAKE_INVISIBLE:
    case WAN_CANCELLATION:
    case SPE_CANCELLATION:
    case WAN_POLYMORPH:
    case SPE_POLYMORPH:
    case WAN_STRIKING:
    case SPE_FORCE_BOLT:
    case WAN_SLOW_MONSTER:
    case SPE_SLOW_MONSTER:
    case WAN_SPEED_MONSTER:
    case SPE_HEALING:
    case SPE_EXTRA_HEALING:
    case SPE_DRAIN_LIFE:
    case WAN_OPENING:
    case SPE_KNOCK:
        await hitMonsterWithWand(steed, source, { state });
        return true;
    default:
        return false;
    }
}

// C zap.c:zap_updown(). Vertical zaps only reach the hero's own square.
async function zapVertically(source: GameObject, state: PlayingGameState) {
    const { ux: x, uy: y, dz = 0 } = state.u;
    const trap = state.level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    let disclose = false;
    switch (source.otyp) {
    case WAN_PROBING:
        await probeVertically(source, x, y, state);
        return true;
    case WAN_OPENING:
    case SPE_KNOCK: {
        const bridge = findDrawbridgeAt(x, y, state);
        if (state.level.requireAt(x, y).typ === DBWALL && bridge) {
            await openDrawbridge(bridge.x, bridge.y, state);
            disclose = true;
        } else if (dz > 0 && onQuestStart(state) && !okToQuest(state)) {
            let stairs = state.stairs;
            while (stairs && (stairs.isladder || stairs.up || stairs.tolev.dnum !== state.u.uz.dnum)) stairs = stairs.next;
            if (stairs?.sx === x && stairs.sy === y) {
                await plineWithContinuation('The stairs seem to ripple momentarily.');
                disclose = true;
            }
        }
        if (state.program_state.gameover) return disclose;
        if (dz > 0) {
            const effect = state.u.utrap ? await openHoldingTrap(state.u, { state })
                : await openFallingTrap(state.u, { state });
            disclose ||= effect.noticed;
        }
        break;
    }
    case WAN_STRIKING:
    case SPE_FORCE_BOLT:
    case WAN_LOCKING:
    case SPE_WIZARD_LOCK:
        disclose = await strikeOrLockVertically(source, x, y, trap, state);
        break;
    case SPE_STONE_TO_FLESH:
        await fleshOnTerrain(x, y, state);
        break;
    }
    if (state.program_state.gameover) return disclose;
    if (dz > 0) {
        await hitFloorPileWithWand(source, x, y, { state, direction: dz });
        if (!state.program_state.gameover) await zapMapAt(x, y, source, { state });
    } else if (state.u.uundetected && heroFormHidesUnderObjects(state)) {
        const object = state.level.objects[state.u.ux]?.[state.u.uy]?.[0];
        if (object && await hitObjectWithWand(object, source, { state })) {
            await maybeUnhideAt(state.u.ux, state.u.uy, state);
            disclose = true;
        }
    }
    return disclose;
}

async function strikeOrLockVertically(source: GameObject, x: number, y: number, trap: Trap | undefined, state: PlayingGameState) {
    const striking = [WAN_STRIKING, SPE_FORCE_BOLT].includes(source.otyp);
    const { dz = 0 } = state.u, location = state.level.at(x, y);
    if (!location) throw new Error(`No map location at ${x},${y}`);
    const bridge = findDrawbridgeAt(x, y, state);
    if (bridge && (location.typ === DRAWBRIDGE_DOWN ? dz > 0 : location.typ === DOOR)) {
        if (striking) await destroyDrawbridge(bridge.x, bridge.y, state);
        else await closeDrawbridge(bridge.x, bridge.y, state);
        return true;
    }
    if (striking && dz < 0 && rn2(3) && !Is_airlevel(state.u.uz)
        && !Is_waterlevel(state.u.uz) && !(state.underwater || state.u.uinwater) && !onQuestStart(state)) {
        await plineWithContinuation(`A rock is dislodged from the ${ceilingName(x, y, state)} and falls on your ${heroHeadName(state)}.`);
        let damage = rnd(objectIsHardHelmet(state.uarmh || state.u.uarmh) ? 2 : 6);
        if (state.u.halfPhysicalDamage) damage = Math.ceil(damage / 2);
        if (await loseHeroHp(damage, 'falling rock', { state })) return false;
        const rock = await mksobj(ROCK, false, false);
        await placeCreatedObject(rock, x, y, state);
        observeObjectForNaming(rock, { state });
        await stack_object(rock, state);
        await newsym(x, y);
        return false;
    }
    if (dz <= 0 || !trap) return false;
    if (!striking) {
        const effect = await closeHoldingTrap(state.u, { state });
        if (effect.changed) return effect.noticed;
    }
    if (striking && trap.ttyp === TRAPDOOR) {
        const known = !!trap.tseen;
        await plineWithContinuation(heroIsBlind(state) && !known ? 'Something beneath you shatters.'
            : !known ? "There's a trapdoor beneath you; it shatters." : 'The trapdoor beneath you shatters.');
        trap.ttyp = HOLE;
        trap.tseen = 1;
        await newsym(x, y);
        await triggerHeroTrap(trap, { gotoLevel });
        return known;
    }
    if (!striking && trap.ttyp === HOLE) {
        trap.ttyp = TRAPDOOR;
        if (heroIsBlind(state) || !trap.tseen) await plineWithContinuation(`Some ${isIceAt(x, y, state) ? 'frost' : 'dust'} swirls beneath you.`);
        else {
            trap.tseen = 1;
            await newsym(x, y);
            await plineWithContinuation('A trapdoor appears beneath you.');
            return true;
        }
    }
    return false;
}

async function fleshOnTerrain(x: number, y: number, state: PlayingGameState) {
    const { dz = 0 } = state.u;
    if (Is_airlevel(state.u.uz) || Is_waterlevel(state.u.uz) || state.underwater || state.u.uinwater
        || (onQuestStart(state) && dz < 0)) await plineWithContinuation('Nothing happens.');
    else if (dz < 0) await plineWithContinuation(`Blood drips on your ${heroFaceName(state)}.`);
    else if (!state.level.objects[x]?.[y]?.length && engravingAt(x, y)?.engr_type !== ENGRAVE) {
        if (isPoolAt(x, y, state) || isIceAt(x, y, state)) await plineWithContinuation('Nothing happens.');
        else await plineWithContinuation(`Blood ${isLavaAt(x, y, state) ? 'boils' : 'pools'} ${state.u.levitating ? 'beneath' : 'at'} your ${makePlural(heroFootName(state))}.`);
    }
}

async function probeVertically(source: GameObject, x: number, y: number, state: PlayingGameState) {
    let found = 0;
    if ((state.u.dz ?? 0) < 0) await plineWithContinuation(`You probe towards the ${ceilingName(x, y, state)}.`);
    else {
        recordMappedOverviewState();
        const location = state.level.at(x, y);
        if (!location) throw new Error(`No map location at ${x},${y}`);
        const remembered = location.lastseentyp;
        found += await hitFloorPileWithWand(source, x, y, { state, direction: state.u.dz ?? 0 });
        const surface = location.typ === DRAWBRIDGE_UP
            ? drawbridgeUnderlyingType(location.drawbridgemask ?? 0) : location.typ;
        await zapMapAt(x, y, source, { state });
        const furniture = surface === ICE || IS_FURNITURE(surface);
        if (furniture && remembered !== location.lastseentyp) found++;
        await plineWithContinuation(`You probe beneath ${furniture ? 'it' : `the ${surfaceName(x, y, state)}`}.`);
        found += await displayBuriedInventory(x, y, state);
    }
    if (!found) await plineWithContinuation('Your probe reveals nothing.');
}

// C invent.c:display_binventory(): objects beneath the probed surface.
async function displayBuriedInventory(x: number, y: number, state: PlayingGameState) {
    const pile = state.level.objects[x]?.[y] || [];
    let underwhat = 'here', count = 0;
    if ((isPoolAt(x, y, state) || isLavaAt(x, y, state)) && !(state.underwater || state.u.uinwater) && pile.length) {
        const liquid = displayLiquidName(isPoolAt(x, y, state) ? 'water' : 'lava', state);
        count = pile.length;
        if (pile.length === 1) {
            const object = pile[0];
            if (!object) throw new Error('A visible one-object pile must contain its object.');
            const plural = objectNameIsPlural(object, state);
            await plineWithContinuation(`There ${plural ? 'are' : 'is'} ${await inventoryItemDescription(object)} under the ${liquid} here.`);
            underwhat = plural || armorUsesPairGrammar(OBJECT_NAMES[object.otyp] ?? '') ? 'under them' : 'beneath it';
        } else {
            await showProbedObjectInventory(pile, `Things that are under the ${liquid} here:`, { state, groupByClass: false });
            underwhat = 'beneath them';
        }
    }
    const buried = (state.level.buriedObjects || []).filter(object => object.ox === x && object.oy === y);
    for (const object of buried) observeObject(object, state);
    if (buried.length) await showProbedObjectInventory(buried, `Things that are buried ${underwhat}:`, { state });
    return count + buried.length;
}

// C zap.c:weffects(). Zapping and spell casting share the effect dispatch;
// callers own charge use and direction input.
export async function applyWandEffect(source: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u, type = source.otyp, direction = objectDirection(type, state);
    const unknown = !objectTypeKnown(source, state);
    let disclose = false;
    exerciseWisdom(true, state);
    if (hero.usteed && direction !== NODIR && !hero.dx && !hero.dy
        && (hero.dz ?? 0) > 0 && await zapSteed(source, state)) {
        disclose = true;
    } else if (direction === IMMEDIATE) {
        beginImmediateZap(state);
        if (hero.uswallow) {
            if (!hero.ustuck) throw new Error('A swallowed hero must have an engulfing monster.');
            await hitMonsterWithWand(hero.ustuck, source, { state });
        } else if (hero.dz) disclose = await zapVertically(source, state);
        else await traceImmediateZap(source, rn2(8) + 6, state);
        if (!state.program_state.gameover) await finishImmediateZap(state);
    } else if (direction === NODIR) {
        await zapWithoutDirection(source, state);
    } else {
        if (type === WAN_DIGGING || type === SPE_DIG) await zapDigWithObject(source, { state });
        else if ((type >= SPE_MAGIC_MISSILE && type <= SPE_FINGER_OF_DEATH)
            || (type >= WAN_MAGIC_MISSILE && type <= WAN_LIGHTNING)) {
            await zapRayWithObject(source, { state });
        } else await impossible('weffects: unexpected spell or wand');
        disclose = true;
    }
    if (disclose && !state.program_state.gameover) {
        learnWand(source, { state });
        if (unknown) addExperience(0, 10, state);
    }
}

// C zap.c:zap_map(). Terrain is affected before occupants and floor piles.
export async function zapMapAt(x: number, y: number, source: GameObject, { state = game }: { state?: GameState } = {}) {
    requirePlayingGame(state);
    let learned = await cancelMagicTrap(x, y, source, state);
    if (state.program_state.gameover) return;
    const trap = state.level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if ((state.u.dz ?? 0) > 0) await zapEngraving(x, y, source, state);
    else if (!state.u.dz) learned = await zapDrawbridge(x, y, source, state) || learned;
    if (state.program_state.gameover) return;
    if (source.otyp === WAN_PROBING)
        learned = await probeTerrain(x, y, trap, learned, state);
    if (learned) learnWand(source, { state });
}

// C zap.c:maybe_explode_trap(): cancellation striking a magic trap.
async function cancelMagicTrap(x: number, y: number, source: GameObject, state: PlayingGameState) {
    if (![WAN_CANCELLATION, SPE_CANCELLATION].includes(source.otyp)) return false;
    const trap = state.level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (!trap) return false;
    if ([MAGIC_PORTAL, VIBRATING_SQUARE].includes(trap.ttyp)) {
        await shieldeff(x, y);
        if (!cansee(x, y)) return false;
        trap.tseen = 1;
        await newsym(x, y);
        return true;
    }
    if (![TELEP_TRAP, LEVEL_TELEP, MAGIC_TRAP, ANTI_MAGIC, POLY_TRAP].includes(trap.ttyp)) return false;
    const visible = cansee(x, y);
    await explode(x, y, -WAN_CANCELLATION, 20 + d(3, 6), TRAP_EXPLODE, EXPL_MAGICAL, { state });
    deleteTrap(trap, state);
    await newsym(x, y);
    return visible;
}

async function zapEngraving(x: number, y: number, source: GameObject, state: PlayingGameState) {
    const engraving = engravingAt(x, y, state.level);
    if (!engraving || engraving.engr_type === HEADSTONE) return;
    switch (source.otyp) {
    case WAN_POLYMORPH:
    case SPE_POLYMORPH: {
        deleteEngravingAt(x, y, state.level);
        const { text, pristine } = randomEngraving();
        makeEngravingAt(x, y, text, pristine, state.moves, 0);
        break;
    }
    case WAN_CANCELLATION:
    case SPE_CANCELLATION:
    case WAN_MAKE_INVISIBLE:
        deleteEngravingAt(x, y, state.level);
        break;
    case WAN_TELEPORTATION:
    case SPE_TELEPORT_AWAY:
        await relocateEngraving(engraving, state);
        break;
    case SPE_STONE_TO_FLESH:
        if (engraving.engr_type !== ENGRAVE) break;
        await plineWithContinuation(heroIsHallucinating(state)
            ? 'The floor runs like butter!' : 'The edges on the floor get smoother.');
        wipeEngravingAt(x, y, d(2, 4), true, state.level);
        break;
    case WAN_STRIKING:
    case SPE_FORCE_BOLT:
        wipeEngravingAt(x, y, d(2, 4), true, state.level);
        break;
    }
}

async function zapDrawbridge(x: number, y: number, source: GameObject, state: PlayingGameState) {
    const originalType = state.level.requireAt(x, y).typ;
    const bridge = findDrawbridgeAt(x, y, state);
    if (!bridge) return false;
    switch (source.otyp) {
    case WAN_OPENING:
    case SPE_KNOCK:
        if (originalType === DBWALL) {
            const visible = cansee(x, y) || cansee(bridge.x, bridge.y);
            await openDrawbridge(bridge.x, bridge.y, state);
            return visible;
        }
        break;
    case WAN_LOCKING:
    case SPE_WIZARD_LOCK: {
        const observed = (cansee(x, y) || cansee(bridge.x, bridge.y))
            && bridge.location.typ === DRAWBRIDGE_DOWN;
        await closeDrawbridge(bridge.x, bridge.y, state);
        return observed;
    }
    case WAN_STRIKING:
    case SPE_FORCE_BOLT:
        if (originalType !== DRAWBRIDGE_UP) {
            await destroyDrawbridge(bridge.x, bridge.y, state);
            return true;
        }
        break;
    }
    return false;
}

function sameGlyph(left: ReturnType<typeof glyphAt>, right: ReturnType<typeof glyphAt>) {
    if (left === right) return true;
    if (!left || !right || left.kind !== right.kind) return false;
    switch (left.kind) {
    case 'terrain': return right.kind === 'terrain' && left.terrainName === right.terrainName;
    case 'object': return right.kind === 'object' && left.otyp === right.otyp;
    case 'monster': return right.kind === 'monster' && left.mnum === right.mnum;
    case 'trap': return right.kind === 'trap' && left.trapType === right.trapType;
    case 'effect':
    case 'engraving':
    case 'invisible':
    case 'nothing':
    case 'unexplored':
    case 'warning':
        return glyphCharacter(left) === glyphCharacter(right);
    }
}

async function probeTerrain(x: number, y: number, trap: Trap | undefined, learned: boolean, state: PlayingGameState) {
    const location = state.level.requireAt(x, y);
    const oldType = location.lastseentyp, oldGlyph = glyphAt(x, y, state);
    await showMapSpot(x, y, { state });
    learned ||= oldType !== location.lastseentyp || !sameGlyph(oldGlyph, glyphAt(x, y, state));
    const surface = location.typ === DRAWBRIDGE_UP
        ? drawbridgeUnderlyingType(location.drawbridgemask ?? 0) : location.typ;
    if (surface === SDOOR) {
        revealSecretDoor(x, y);
        vision_note_blocker_change(x, y);
        await newsym(x, y);
        if (cansee(x, y)) {
            await plineWithContinuation('Probing reveals a secret door.');
            learned = true;
        } else if (Is_rogue_level(state.u.uz)) await plineWithContinuation(formatDraftMessage(false, state));
    } else if (surface === SCORR) {
        location.typ = CORR;
        vision_note_blocker_change(x, y);
        await newsym(x, y);
        await plineWithContinuation('Probing exposes a secret corridor.');
        learned = true;
    } else if ((surface === ICE || IS_FURNITURE(surface)) && (state.u.dz ?? 0) > 0) {
        await forceDescribeDecor({ state, probing: true });
        learned = true;
    }
    if (trap) {
        const seen = trap.tseen, hallucinating = heroIsHallucinating(state);
        trap.tseen = 1;
        await newsym(x, y);
        if (!seen || hallucinating) {
            const name = trapName(trap.ttyp, { state });
            const definite = hallucinating ? !rn2(4)
                : trap.ttyp === VIBRATING_SQUARE && Invocation_lev(state.u.uz, state);
            await plineWithContinuation(`You find ${definite ? `the ${name}!` : `${withIndefiniteArticle(name)}.`}`);
            learned = !hallucinating;
        }
    }
    return learned;
}

function glyphCharacter(glyph: ReturnType<typeof glyphAt>): string | undefined {
    return glyph && 'ch' in glyph && typeof glyph.ch === 'string' ? glyph.ch : undefined;
}

// C zap.c:bhit(), ZAPPED_WAND branch: a beam-limited walk over the map,
// monsters, floor piles, and doors.
async function traceImmediateZap(source: GameObject, range: number, state: PlayingGameState) {
    const { dx = 0, dy = 0, ux, uy } = state.u;
    state.bhitpos = { x: ux, y: uy };
    let shopDoor = false;
    while (range-- > 0) {
        const x = state.bhitpos.x += dx, y = state.bhitpos.y += dy;
        if (!isok(x, y)) {
            state.bhitpos.x -= dx;
            state.bhitpos.y -= dy;
            break;
        }
        await zapMapAt(x, y, source, { state });
        if (state.program_state.gameover) return;
        const location = state.level.at(x, y);
        if (!location) throw new Error(`No map location at ${x},${y}`);
        const type = location.typ;
        const monster = monsterAtPosition(state.level, x, y);
        if (monster) {
            state.notonhead = x !== monster.mx || y !== monster.my;
            if (await hitMonsterWithWand(monster, source, { state, x, y })) return;
            range -= 3;
        } else if (source.otyp === WAN_PROBING && location.remembered_glyph?.kind === 'invisible') {
            await unmap_invisible(x, y);
        }
        if (state.program_state.gameover) return;
        if (await hitFloorPileWithWand(source, x, y, { state })) range--;
        if (state.program_state.gameover) return;
        if ((type === DOOR || type === SDOOR)
            && [WAN_OPENING, WAN_LOCKING, WAN_STRIKING, SPE_KNOCK, SPE_WIZARD_LOCK, SPE_FORCE_BOLT].includes(source.otyp)
            && await changeDoorByMagic(source, x, y, { state })) {
            if (cansee(x, y) || (source.otyp === WAN_STRIKING && !heroIsDeaf(state))) learnWand(source, { state });
            if (location.doormask === D_BROKEN && roomsAt(state.level, x, y, SHOPBASE).length) {
                shopDoor = true;
                addShopDamage(x, y, SHOP_DOOR_COST, state);
            }
        }
        if (!ZAP_POS(type) || (location.typ === DOOR && (location.doormask & (D_CLOSED | D_LOCKED)))) {
            state.bhitpos.x -= dx;
            state.bhitpos.y -= dy;
            break;
        }
    }
    if (shopDoor) await payForShopDamage('destroy', { state });
}

function floorObjectBurns(object: GameObject) {
    return object?.otyp === GLOB_OF_GREEN_SLIME
        || object?.oclass === SCROLL_CLASS
        || object?.oclass === SPBOOK_CLASS;
}

async function removeBurnedFloorQuantity(object: GameObject, count: number, state: GameState, heroCaused: boolean, publish: MessagePublisher) {
    const quantity = object.quan ?? object.quantity ?? 1;
    if (!heroCaused && count < quantity) {
        object.quan = quantity - count;
        object.quantity = object.quan;
        object.owt = objectWeight(object);
        return;
    }
    if (heroCaused) await useUpFloorObject(object, count, { state, publish });
    else await delobj(object, state);
}

function floorBurnMessage(object: GameObject, destroyed: number, state: GameState) {
    if (object.ox === state.u.ux && object.oy === state.u.uy)
        observeObjectForNaming(object, { state });
    else observeDistantObjectForNaming(object, state);
    const name = objectName({ ...object, quan: 1, quantity: 1 }, state);
    if (destroyed > 1)
        return `${destroyed} ${pluralizeObjectNoun(object, name)} burn.`;
    const subject = withIndefiniteArticle(name);
    return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} burns.`;
}

// C zap.c:burn_floor_objects().
export async function burnFloorObjectsAt(
    x: number,
    y: number,
    {
        state = game,
        giveFeedback = false,
        heroCaused = false,
        publish = plineWithContinuation,
        random = rn2,
        visible = cansee(x, y),
        repaint = newsym,
    }: FloorBurnOptions = {},
): Promise<number> {
    const pile = state.level?.objects?.[x]?.[y] || [];
    let burned = 0;
    for (const object of [...pile]) {
        if (!floorObjectBurns(object)
            || object.otyp === SCR_FIRE
            || object.otyp === SPE_FIREBALL
            || objectResistsDestruction(object, 2, 100, random)) continue;
        const quantity = object.quan ?? object.quantity ?? 1;
        let destroyed = 0;
        for (let index = 0; index < quantity; index++) {
            if (random(3) === 0) destroyed++;
        }
        if (!destroyed) continue;
        const feedback = giveFeedback ? floorBurnMessage(object, destroyed, state) : null;
        await removeBurnedFloorQuantity(object, destroyed, state, heroCaused, publish);
        burned += destroyed;
        if (feedback) await publish(feedback);
    }

    await igniteItems(pile, {
        state,
        publish,
        random,
        visible,
    });
    if (burned && couldsee(x, y)) await repaint(x, y);
    return burned;
}

// C zap.c:start_melt_ice_timeout().
export function startMeltIceTimer(
    x: number, y: number, minimumTime = 0, state: GameState = game, random: typeof rn2 = rn2,
) {
    let delay = Math.max(minimumTime, 49);
    while (++delay <= 2000) {
        if (random(2000 - delay + 50) === 0) break;
    }
    if (delay > 2000) return null;
    return scheduleLevelTimer(
        x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY,
        (state.moves ?? 0) + delay, state,
    );
}

function firmExistingIce(x: number, y: number, state: GameState = game) {
    const timer = state.level?.levelTimers?.find(candidate =>
        candidate.x === x && candidate.y === y
        && candidate.kind === LEVEL_TIMER_KIND.MELT_ICE_AWAY,
    );
    if (!timer) return;
    const remaining = Math.max(0, timer.deadline - (state.moves ?? 0));
    stopLevelTimer(x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY, state);
    startMeltIceTimer(x, y, remaining, state);
}

function liquidMonsterAt(x: number, y: number, state: GameState = game) {
    return state.level?.monsters?.find(monster => monsterHasMapPosition(monster, state) &&
        (monster.mhp ?? 1) > 0 && monster.mx === x && monster.my === y,
    ) || null;
}

async function revealStrandedSwimmer(x: number, y: number, state: GameState = game) {
    const monster = liquidMonsterAt(x, y, state);
    if (!monster || !monster.mundetected
        || !((MONSTER_FLAGS1[monster.mnum] ?? 0) & 0x00000002)) return;
    monster.mundetected = 0;
    await newsym(x, y);
}

async function freezeLiquidAt(x: number, y: number, state: GameState, publish: MessagePublisher) {
    const location = state.level?.at(x, y);
    if (!location) return 0;
    if (isIceAt(x, y, state)) {
        firmExistingIce(x, y, state);
        return 0;
    }

    const lavaWall = location.typ === LAVAWALL;
    const lava = isLavaAt(x, y, state);
    if (!isPoolAt(x, y, state) && !lava) return 0;

    const visible = cansee(x, y);
    const temperature = state.level?.flags?.temperature || 0;
    const briefFreeze = IS_WATERWALL(location.typ)
        || (lavaWall && rn2(Math.max(2, 5 + temperature * 10)) !== 0);
    if (briefFreeze) {
        if (visible) {
            await publish(
                `The ${displayLiquidName(lavaWall ? 'lava' : 'water', state)} freezes for a moment.`,
            );
        } else {
            await publishHeardMessage('a soft crackling.', publish, state);
        }
        return -1000;
    }

    const waterbody = waterbodyName(x, y, state);
    const wasMoat = isMoatAt(x, y, state);
    if (location.typ === DRAWBRIDGE_UP) {
        location.drawbridgemask = (location.drawbridgemask ?? 0) & ~DB_UNDER;
        location.drawbridgemask |= lava ? DB_FLOOR : DB_ICE;
    } else {
        location.icedpool = lava ? 0
            : location.typ === POOL ? ICED_POOL : ICED_MOAT;
        if (lavaWall) {
            const north = state.level?.at(x, y - 1);
            const south = state.level?.at(x, y + 1);
            location.typ = !!north && IS_WALL(north.typ) || !!south && IS_WALL(south.typ)
                ? VWALL : HWALL;
            fix_wall_spines(Math.max(0, x - 1), Math.max(0, y - 1),
                Math.min(COLNO - 1, x + 1), Math.min(ROWNO - 1, y + 1));
        } else {
            location.typ = lava ? ROOM : ICE;
        }
    }

    await buryFloorObjectsAt(x, y, state, { publish });
    if (visible) {
        const message = lava
            ? `The ${displayLiquidName('lava', state)} cools and solidifies.`
            : wasMoat ? `The ${waterbody} is bridged with ice!`
                : `The ${displayLiquidName('water', state)} freezes.`;
        await publish(message, { noRepeat: true });
        await newsym(x, y);
    } else if (!lava) {
        await publishHeardMessage('a crackling sound.', publish, state);
    }

    if (state.u?.ux === x && state.u?.uy === y) {
        if (state.u.uinwater) {
            state.u.uinwater = 0;
            state.u.uundetected = 0;
            await docrt();
            state.vision_full_recalc = 1;
        } else if (state.u.utrap && state.u.utraptype === TT_LAVA) {
            if (state.u.passesWalls) {
                await publish('You pass through the now-solid rock.');
                await resetHeroTrap(true, state);
            } else {
                setHeroTrap(rn1(50, 20), TT_INFLOOR, state);
                await publish(
                    'You are firmly stuck in the cooling rock.',
                );
            }
        }
    } else {
        await revealStrandedSwimmer(x, y, state);
    }

    if (!lava) {
        startMeltIceTimer(x, y, 0, state);
        updateIceObjectTimersAt(x, y, state, { includeBuried: true });
    }
    // Cooling changes the surface without changing its vision blocking.
    // A visibility reset here would erase an active ray at the hero.
    return -3;
}

async function evaporatePoolAt(x: number, y: number, state: GameState, publish: MessagePublisher, heroCaused: boolean) {
    const location = state.level?.at(x, y);
    if (!location || !isPoolAt(x, y, state)) return 0;
    const visible = cansee(x, y);
    const deaf = !!(state.u?.deaf || state.deaf);
    const waterLevel = Is_waterlevel(state.u?.uz);
    let enveloped = false;
    if (!waterLevel) {
        await createPoisonGasCloud(state, x, y, rnd(5), 0, rn2, publish);
        enveloped = state._lastPlineKind === PLNMSG_ENVELOPED_IN_GAS;
    }

    let message = !deaf ? 'You hear hissing gas.'
        : heroCaused ? 'That seemed remarkably uneventful.' : null;
    let rangeChange = 0;
    let pit = null;
    if (location.typ === POOL) {
        rangeChange = -3;
        location.typ = ROOM;
        location.flags = 0;
        pit = await maketrap(x, y, PIT);
        if (visible) message = 'The water evaporates.';
    } else if (waterLevel) {
        message = visible || !deaf ? 'Some water boils.' : null;
    } else if (visible) {
        message = 'Some water evaporates.';
    }
    if (message && !enveloped) await publish(message, { noRepeat: true });

    if (location.typ === ROOM) {
        await revealStrandedSwimmer(x, y, state);
        await newsym(x, y);
        const monster = liquidMonsterAt(x, y, state);
        if (pit && state.u.ux === x && state.u.uy === y)
            await triggerHeroTrap(pit);
        else if (pit && monster) {
            requirePlayingGame(state);
            await finishImmediateMonsterTrap(
                await triggerImmediateMonsterTrap(monster, state), state, { publish });
        }
    }
    return rangeChange;
}

// C zap.c:zap_over_floor() for ray and wand spots; mcastu.c reaches it
// through mon_spell_hits_spot() for monster fire and lightning spells.
export async function applyRayFloorFeatures(
    kind: RayFloorKind, x: number, y: number, state: GameState = game,
    { rayNoun = 'bolt', random = rn2, heroCaused = true,
        explodingWand = 0, heroBurnsObjects = heroCaused,
        publish = plineWithContinuation }: RayFloorOptions = {},
): Promise<RayFloorResult> {
    const location = state.level?.at(x, y);
    if (!location) return { absorbed: false, rangeChange: 0 };
    const visible = cansee(x, y);
    let rangeChange = 0;
    let shopDamage = false;
    const yourRay = heroCaused && !explodingWand;
    const wandType = [POT_OIL, SCR_FIRE].includes(explodingWand) ? 0 : explodingWand;

    if (kind === RAY_FIRE) {
        const web = state.level?.traps?.find(candidate =>
            candidate.tx === x && candidate.ty === y && candidate.ttyp === WEB);
        if (web) {
            // zap_over_floor(): a burning web is too flimsy to notice
            // unseen, and the burst message precedes delfloortrap().
            if (visible)
                await publish('A web bursts into flames!');
            // delfloortrap() releases a trapped hero through
            // reset_utrap(TRUE), which may report flight.
            await deleteFloorTrap(web, state);
            await newsym(x, y);
        }
    }

    if (kind === RAY_FIRE && isIceAt(x, y, state)) {
        await meltIce(x, y);
    } else if (kind === RAY_FIRE) {
        rangeChange += await evaporatePoolAt(x, y, state, publish, heroCaused);
    }
    if (state.program_state.gameover) return { absorbed: false, rangeChange };
    if (kind === RAY_FIRE && location.typ === FOUNTAIN) {
        await createPoisonGasCloud(state, x, y, rnd(3), 0, random, publish);
        if (visible) await publish('Steam billows from the fountain.');
        rangeChange--;
        await dryFountainAt(x, y, { causedByHero: heroBurnsObjects, state, publish, random });
    } else if (kind === RAY_COLD) {
        rangeChange += await freezeLiquidAt(x, y, state, publish);
    } else if (kind === 'poison' && ZAP_POS(location.typ)) {
        await createPoisonGasCloud(state, x, y, 1, 8, random, publish);
    }

    const damagesBars = location.typ === IRONBARS
        && (kind === RAY_ACID || (kind === RAY_LIGHTNING && random(10) === 0));
    if (damagesBars) {
        const action = kind === RAY_ACID ? 'corrode' : 'melt';
        if ((location.wall_info ?? 0) & W_NONDIGGABLE) {
            if (visible) {
                await publish(
                    `The iron bars ${action} somewhat but remain intact.`,
                    { noRepeat: true },
                );
            }
        } else {
            rangeChange -= 3;
            // The message can pause at --More-- with the beam over intact bars.
            if (visible) {
                await publish(
                    `The iron bars ${action}${kind === RAY_ACID ? ' away' : ''}.`,
                    { noRepeat: true },
                );
            }
            await dissolveBars(x, y, state);
            if (roomsAt(state.level, x, y, SHOPBASE).length) {
                addShopDamage(x, y, heroCaused ? SHOP_BARS_COST : 0, state);
                shopDamage ||= heroCaused;
            }
        }
    }

    if (location.typ === SDOOR) {
        convertSecretDoor(location, state);
        vision_note_blocker_change(x, y);
        await newsym(x, y);
        if (visible) {
            await publish(
                `${yourRay ? 'Your' : 'The'} ${rayNoun} reveals a secret door.`,
            );
        } else if (Is_rogue_level(state.u.uz)) {
            await publish(formatDraftMessage(false, state, random));
        }
    }

    let absorbed = false;

    if (closedRayDoor(location)) {
        absorbed = true;
        if (kind === RAY_FIRE || kind === RAY_COLD
            || kind === RAY_DISINTEGRATION || kind === RAY_LIGHTNING
            || wandType === WAN_STRIKING) {
            if (roomsAt(state.level, x, y, SHOPBASE).length) {
                addShopDamage(x, y, heroCaused ? SHOP_DOOR_COST : 0, state);
                shopDamage ||= heroCaused;
            }
            location.doormask = kind === RAY_LIGHTNING || wandType === WAN_STRIKING
                ? D_BROKEN : D_NODOOR;
            vision_note_blocker_change(x, y);
            if (visible) {
                await publish(wandType === WAN_STRIKING ? 'The door crashes open!' : destroyedDoorMessage(kind));
                await newsym(x, y);
            } else if (wandType === WAN_STRIKING) {
                await publish('You feel a burst of cool air.');
            } else if (kind === RAY_FIRE) {
                await publish('You smell smoke.');
            } else if (kind === RAY_COLD) {
                await publishHeardMessage('a deep cracking sound.', publish, state);
            } else {
                await publishHeardMessage(kind === RAY_DISINTEGRATION ? 'crashing wood.' : 'crackling.', publish, state);
            }
            const occupation = state._occupation;
            if (occupation?.key === 'pick-lock' && occupation.door === location) {
                await stopHeroOccupation(state, publish);
                resetPick(state);
            }
        } else if (visible) {
            await publish(wandType ? 'The door remains intact.'
                : `The door absorbs ${yourRay ? 'your' : 'the'} ${rayNoun}!`);
        } else {
            await publish(formatFeltMessage('vibrations.', state));
        }
    }
    if (absorbed) rangeChange = -1000;
    if (kind === RAY_FIRE) {
        const burned = await burnFloorObjectsAt(x, y, { state, publish, random, heroCaused: heroBurnsObjects });
        if (burned && couldsee(x, y)) {
            const blind = !!state.blind
                || (state.u?.blindTurns ?? 0) > 0;
            await publish(blind
                ? 'You smell a whiff of smoke.'
                : 'You see a puff of smoke.');
        }
    }
    return { absorbed, rangeChange, shopDamage };
}

function destroyedDoorMessage(kind: RayFloorKind) {
    if (kind === RAY_FIRE) return 'The door is consumed in flames!';
    if (kind === RAY_COLD) return 'The door freezes and shatters!';
    if (kind === RAY_DISINTEGRATION) return 'The door disintegrates!';
    return 'The door splinters!';
}

export function applyFireToFloorAt(x: number, y: number, state: GameState = game) {
    return applyRayFloorFeatures(RAY_FIRE, x, y, state);
}

export function monsterHasElementalResistance(monster: Monster, mask: number): boolean {
    return !!(monsterResistanceBits(monster) & mask);
}

export { hitMonsterWithRay, zapRayWithObject };

function destroyable(object: GameObject, damageType: InventoryDamageType | null | undefined) {
    if (!object || object.artifact || object.oartifact) return false;
    const quantity = object.quan ?? object.quantity ?? 1;
    if (object.in_use && quantity === 1) return false;
    const itemClass = object.oclass;
    if (damageType === INVENTORY_DAMAGE.FIRE) {
        if ([SCR_FIRE, SPE_FIREBALL].includes(object.otyp)) return false;
        return object.otyp === GLOB_OF_GREEN_SLIME
            || [POTION_CLASS, SCROLL_CLASS, SPBOOK_CLASS]
                .includes(itemClass);
    }
    if (damageType === INVENTORY_DAMAGE.COLD)
        return itemClass === POTION_CLASS && object.otyp !== POT_OIL;
    if (damageType === INVENTORY_DAMAGE.ELECTRIC) {
        return [RING_CLASS, WAND_CLASS].includes(itemClass)
            && ![RIN_SHOCK_RESISTANCE, WAN_LIGHTNING]
                .includes(object.otyp);
    }
    return false;
}

function protectionChance(state: GameState, damageType: InventoryDamageType) {
    const hero = state.u;
    const properties: Record<InventoryDamageType, PropertyName> = {
        [INVENTORY_DAMAGE.COLD]: 'coldResistance',
        [INVENTORY_DAMAGE.FIRE]: 'fireResistance',
        [INVENTORY_DAMAGE.ELECTRIC]: 'shockResistance',
    };
    const property = properties[damageType];
    if (hasWornProperty(property, state) || heroHasArtifactDefense(damageType, state))
        return 99;
    const cloak = state.uarmc || hero.uarmc;
    return damageType !== INVENTORY_DAMAGE.ELECTRIC
        && cloak?.otyp === DWARVISH_CLOAK ? 90 : 0;
}

function heroResists(state: GameState, damageType: InventoryDamageType) {
    if (heroHasArtifactDefense(damageType, state)) return true;
    const hero = state.u;
    if (damageType === INVENTORY_DAMAGE.FIRE)
        return !!(hero.fireResistance);
    if (damageType === INVENTORY_DAMAGE.ELECTRIC)
        return !!(hero.shockResistance);
    return false;
}

function isWornRing(object: GameObject, state: GameState) {
    return object === state.uleft || object === state.uright
        || object === state.u?.uleft || object === state.u?.uright
        || ((object?.owornmask ?? 0) & W_RING) !== 0;
}

function glovesBlockRingShock(object: GameObject, state: GameState) {
    if (!isWornRing(object, state)) return false;
    const gloves = state.uarmg || state.u?.uarmg;
    if (!gloves) return false;
    const material = objectMaterial(gloves.otyp);
    return material < 11 || material > 17;
}

function destructionMessage(
    object: GameObject, damageType: InventoryDamageType, count: number, quantity: number, state: GameState = game,
) {
    const one = count === 1;
    const prefix = one ? (quantity === 1 ? '' : 'One of ')
        : count < quantity ? 'Some of ' : quantity === 2 ? 'Both of ' : 'All of ';
    // C destroy_items() uses yname()/Yname2(), whose mon_owns() names a pet as "your".
    const name = ownedObjectName(object, state, { capitalized: !prefix });
    if (damageType === INVENTORY_DAMAGE.COLD) {
        return `${prefix}${name} ${
            one ? 'freezes and shatters' : 'freeze and shatter'
        }!`;
    }
    if (damageType === INVENTORY_DAMAGE.ELECTRIC) {
        const wand = object.oclass === WAND_CLASS;
        return `${prefix}${name} ${wand
            ? 'breaks apart and explodes'
            : 'turns to dust and vanishes'}!`;
    }
    if (object.oclass === POTION_CLASS || object.otyp === GLOB_OF_GREEN_SLIME) {
        const verb = object.otyp === POT_OIL
            ? one ? 'ignites and explodes' : 'ignite and explode'
            : one ? 'boils and explodes' : 'boil and explode';
        return `${prefix}${name} ${verb}!`;
    }
    const verb = one ? 'catches fire and burns' : 'catch fire and burn';
    return `${prefix}${name} ${verb}!`;
}

function itemDamage(object: GameObject, damageType: InventoryDamageType, rollOne: typeof rnd) {
    if (damageType === INVENTORY_DAMAGE.COLD) return rollOne(4);
    if (damageType === INVENTORY_DAMAGE.ELECTRIC)
        return object.oclass === WAND_CLASS ? rollOne(10) : 0;
    if (object.oclass === POTION_CLASS) return rollOne(6);
    if (object.otyp === GLOB_OF_GREEN_SLIME)
        return Math.trunc(((object.owt ?? 1) + 19) / 20);
    return 1;
}

function destroyedItemKiller(object: GameObject, damageType: InventoryDamageType, count: number) {
    let killer;
    if (damageType === INVENTORY_DAMAGE.COLD) killer = 'shattered potion';
    else if (damageType === INVENTORY_DAMAGE.ELECTRIC) killer = 'exploding wand';
    else if (object.oclass === POTION_CLASS)
        killer = object.otyp === POT_OIL ? 'exploding potion' : 'boiling potion';
    else if (object.otyp === GLOB_OF_GREEN_SLIME) killer = 'exploding glob of slime';
    else killer = object.oclass === SPBOOK_CLASS ? 'burning book' : 'burning scroll';
    return count === 1 ? killer : makePlural(killer);
}

async function destroyChosenItem(object: GameObject, damageType: InventoryDamageType, {
    state, publish, random, rollOne, die,
}: ChosenItemDamageOptions): Promise<MagicDamageResult> {
    const unharmed = { damage: 0, heroDied: false };
    const protection = protectionChance(state, damageType);
    if (protection && random(100) < protection) return unharmed;
    if (damageType === INVENTORY_DAMAGE.FIRE
        && object.otyp === SPE_BOOK_OF_THE_DEAD) {
        if (!heroIsBlind(state)) {
            observeObject(object, state);
            await publish(
                `The ${objectName(object, state)} glows a strange ${displayColorName('dark red', state)}, but remains intact.`,
            );
        }
        return unharmed;
    }
    if (damageType === INVENTORY_DAMAGE.ELECTRIC
        && object.oclass === RING_CLASS) {
        if (glovesBlockRingShock(object, state)) return unharmed;
        if (OBJECT_CHARGED[object.otyp] && random(3) !== 0)
            return rechargeRing(object, 0, state, { publish, random, rollOne, die });
    }

    const resistant = heroResists(state, damageType);
    const resistanceStopsDamage = damageType === INVENTORY_DAMAGE.ELECTRIC
        ? object.oclass !== RING_CLASS
        : damageType === INVENTORY_DAMAGE.FIRE
            && object.oclass !== POTION_CLASS
            && object.otyp !== GLOB_OF_GREEN_SLIME;
    const total = object.quan ?? object.quantity ?? 1;
    const quantity = Math.max(0, total - Number(!!object.in_use));
    const damage = itemDamage(object, damageType, rollOne);
    let destroyed = 0;
    for (let index = 0; index < quantity; index++) {
        if (random(3) === 0) destroyed++;
    }
    if (!destroyed) return unharmed;

    if (!heroIsBlind(state)) observeObject(object, state);
    await publish(destructionMessage(object, damageType, destroyed, quantity, state));
    if (damageType === INVENTORY_DAMAGE.FIRE
        && object.oclass === POTION_CLASS) {
        await applySupportedPotionVapor({ state, potion: object, publish });
        if (state.program_state.gameover)
            return { damage: 0, heroDied: true };
    }
    const killer = destroyedItemKiller(object, damageType, destroyed);
    // Native Ring_gone precedes useup, even for a stack with an in-use unit.
    if (isWornRing(object, state)) {
        await removeHeroAccessory(object, state);
        if (state.program_state.gameover) return { damage: 0, heroDied: true };
    } else if (object.owornmask) await removeHeroEquipment(object, state);
    if (state._currentWand === object) state._currentWand = null;
    for (let count = 0; count < destroyed; count++) {
        await consumeInventoryItem(object, state);
        if (state.program_state.gameover) return { damage: 0, heroDied: true };
    }
    if (!damage) return unharmed;
    if (resistant && resistanceStopsDamage) {
        await publish("You aren't hurt!");
        return unharmed;
    }
    const heroDied = await loseHeroHp(damage, killer, {
        state, publish, die,
        deathCause: destroyed > 1 ? `killed by ${killer}` : null,
    });
    if (!heroDied) await exerciseAttribute(A_STR, false, state);
    return { damage, heroDied };
}

export async function destroyInventoryByElement(
    damageType: InventoryDamageType | null | undefined, sourceDamage: number,
    {
        state = game, publish = plineWithContinuation,
        random = rn2, rollOne = rnd, die = finishHeroDeath,
    }: InventoryDamageOptions = {},
): Promise<MagicDamageResult> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const result = { damage: 0, heroDied: false };
    const limit = destructionLimit(sourceDamage, random);
    if (!limit) return result;
    const chosen = chooseStacks(state.inventory, damageType, limit, random, state)
        .map(object => ({ object, deferred: deferHeroItemDestruction(object, state) }));
    if (damageType !== 'cold' && damageType !== 'fire' && damageType !== 'electric') {
        bypassObjectList(state.inventory, false, state);
        return result;
    }
    for (const deferred of [false, true]) {
        for (const entry of chosen) {
            if (entry.deferred !== deferred || !state.inventory.includes(entry.object)) continue;
            const hit = await destroyChosenItem(entry.object, damageType, {
                state, publish, random, rollOne, die,
            });
            result.damage += hit.damage;
            if (hit.heroDied) return { damage: result.damage, heroDied: true };
        }
    }
    bypassObjectList(state.inventory, false, state);
    return result;
}

function deferHeroItemDestruction(object: GameObject, state: GameState) {
    const property = OBJECT_PROPERTY[object.otyp];
    return (!!object.owornmask && (property === 'levitation' || property === 'flying'))
        || (object.otyp === POT_WATER && ismnum(state.u.ulycn)
            && !!(Upolyd(state.u) ? object.blessed : object.cursed));
}

function destructionLimit(sourceDamage: number, random: typeof rn2) {
    let limit = Math.trunc(sourceDamage / 5);
    if (sourceDamage % 5 > random(5)) limit++;
    return Math.max(0, Math.min(MAX_ITEMS_DESTROYED, limit));
}

function chooseStacks(objects: readonly GameObject[], damageType: InventoryDamageType | null | undefined, limit: number, random: typeof rn2, state: GameState): GameObject[] {
    const chosen: (GameObject | null)[] = Array.from({ length: limit }, () => null);
    let eligible = 0;
    // Even a non-elemental blast traverses inventory and activates bypasses.
    bypassObjectList(objects, false, state);
    let object;
    while ((object = nextUnbypassedObject(objects, state))) {
        if (!destroyable(object, damageType)) continue;
        const index = eligible < limit ? eligible : random(eligible);
        eligible++;
        if (index < limit) chosen[index] = object;
    }
    return chosen.slice(0, Math.min(eligible, limit)).filter((object): object is GameObject => object !== null);
}

async function removeMonsterQuantity(
    monster: Monster, object: GameObject, count: number, state: GameState, publish: MessagePublisher,
): Promise<void> {
    const quantity = object.quan ?? object.quantity ?? 1;
    const remaining = quantity - count;
    if (remaining > 0) {
        object.quan = remaining;
        object.quantity = remaining;
        object.owt = objectWeight(object);
        return;
    }
    await destroyObjectFromMonsterInventory(monster, object, state, { publish });
}

export async function destroyMonsterInventoryByElement(
    monster: Monster,
    damageType: InventoryDamageType | null | undefined,
    sourceDamage: number,
    {
        state = game,
        publish = plineWithContinuation,
        random = rn2,
        rollOne = rnd,
        visible = false,
    }: MonsterInventoryDamageOptions = {},
): Promise<number> {
    const limit = destructionLimit(sourceDamage, random);
    if (!limit) return 0;
    const inventory = monster?.minvent || monster?.inventory || [];
    const chosen = chooseStacks(
        inventory, damageType, limit, random, state,
    );
    if (damageType !== 'cold' && damageType !== 'fire' && damageType !== 'electric') {
        bypassObjectList(inventory, false, state);
        return 0;
    }
    let damage = 0;
    for (const object of chosen) {
        if (!inventory.includes(object)) continue;
        if (damageType === INVENTORY_DAMAGE.FIRE
            && object.otyp === SPE_BOOK_OF_THE_DEAD) {
            if (visible) {
                observeDistantObjectForNaming(object, state);
                await publish(
                    `The ${objectName(object, state)} glows a strange ${displayColorName('dark red', state)}, but remains intact.`,
                );
            }
            continue;
        }
        // Native does not recharge a monster's charged ring, but that outcome
        // still spares the ring and skips its destruction roll.
        if (damageType === INVENTORY_DAMAGE.ELECTRIC
            && object.oclass === RING_CLASS
            && OBJECT_CHARGED[object.otyp] && random(3) !== 0) continue;
        const resistsItemDamage = damageType === INVENTORY_DAMAGE.ELECTRIC
            ? object.oclass !== RING_CLASS && monsterHasShockResistance(monster)
            : damageType === INVENTORY_DAMAGE.FIRE
                && object.oclass !== POTION_CLASS
                && object.otyp !== GLOB_OF_GREEN_SLIME
                && monsterHasFireResistance(monster);
        const stackDamage = itemDamage(object, damageType, rollOne);
        const total = object.quan ?? object.quantity ?? 1;
        const quantity = Math.max(0, total - Number(!!object.in_use));
        let destroyed = 0;
        for (let index = 0; index < quantity; index++) {
            if (random(3) === 0) destroyed++;
        }
        if (!destroyed) continue;
        if (visible) {
            observeObjectForNaming(object, { state });
            await publish(destructionMessage(object, damageType, destroyed, quantity, state));
        }
        await removeMonsterQuantity(monster, object, destroyed, state, publish);
        if (!resistsItemDamage) damage += stackDamage;
    }
    bypassObjectList(monster.minvent ?? monster.inventory ?? [], false, state);
    return damage;
}

export function destroyColdMonsterInventory(
    monster: Monster, sourceDamage: number, options: MonsterInventoryDamageOptions = {},
) {
    return destroyMonsterInventoryByElement(
        monster, INVENTORY_DAMAGE.COLD, sourceDamage, options,
    );
}

export function destroyFireMonsterInventory(
    monster: Monster, sourceDamage: number, options: MonsterInventoryDamageOptions = {},
) {
    return destroyMonsterInventoryByElement(
        monster, INVENTORY_DAMAGE.FIRE, sourceDamage, options,
    );
}

export function destroyFireInventory(sourceDamage: number, options: InventoryDamageOptions = {}) {
    return destroyInventoryByElement(
        INVENTORY_DAMAGE.FIRE, sourceDamage, options,
    );
}

export function destroyColdInventory(sourceDamage: number, options: InventoryDamageOptions = {}) {
    return destroyInventoryByElement(
        INVENTORY_DAMAGE.COLD, sourceDamage, options,
    );
}

export function destroyElectricInventory(sourceDamage: number, options: InventoryDamageOptions = {}) {
    return destroyInventoryByElement(
        INVENTORY_DAMAGE.ELECTRIC, sourceDamage, options,
    );
}

// The make-invisible wand against a monster. C zap.c:bhitm().
function knownInvisible(monster: Monster, state: GameState = game) {
    if (!monster.minvis) return false;
    const hero = state.u;
    if (cansee(monster.mx, monster.my) && (hero.seeInvisible
        || (hero.seeInvisibleTurns ?? 0) > 0
        || hero.detectMonsters || state.detectMonsters)) return true;
    const hasSightedTelepathy = (hero.unblind_telepat_range ?? -1) >= 0
        || state.uarmh?.otyp === 100 || state.uamul?.otyp === 201;
    const distance = (monster.mx - hero.ux) ** 2 + (monster.my - hero.uy) ** 2;
    return !heroIsBlind(state) && hasSightedTelepathy && distance <= BOLT_LIM ** 2;
}

export async function makeMonsterInvisible(monster: Monster) {
    const wasInvisible = !!monster.minvis;
    const wasVisible = canSeeMonster(monster);
    await revealMonsterAppearance(monster);
    const name = monsterName(monster, { capitalized: true });

    setMonsterPermanentInvisibility(monster);
    if (!monster.invis_blkd) {
        await newsym(monster.mx, monster.my);
        if (monster.wormno) await redrawMonsterWormSegments(monster);
    }

    let identified = false;
    if (!wasInvisible && knownInvisible(monster)) {
        await plineWithContinuation(`${name} turns transparent!`);
        identified = true;
    } else if (wasVisible
        && !canSeeMonster(monster)) {
        await plineWithContinuation(`${name} vanishes!`);
    }
    await wakeMonster(monster, { attacked: true });
    return identified;
}

// Slow-monster and speed-monster point effects. C zap.c:bhitm().
interface SpeedMagicOptions {
    random: (limit: number) => number;
    roll: (sides: number) => number;
}

export async function affectMonsterSpeed(
    monster: Monster,
    kind: 'speed' | 'slow',
    source: 'wand' | 'spell',
    state: GameState,
    options: SpeedMagicOptions,
): Promise<boolean> {
    const attackLevel = source === 'wand' ? 12 : state.u?.ulevel ?? 1;
    const resisted = monsterResistsEffect(
        monster, attackLevel, options.random,
    );
    let observed = false;
    if (!resisted) {
        await revealMonsterAppearance(monster);
        const speed = adjustMonsterSpeed(monster, kind === 'speed' ? 1 : -1);
        checkMonsterGearNextTurn(monster);
        if (speed.changed && speed.canDescribe && canSeeMonster(monster)) {
            const subject = monsterName(monster, { state, capitalized: true });
            const message = monsterSpeedMessage(speed, subject);
            if (message) {
                await plineWithContinuation(message);
                observed = true;
            }
        }
        if (kind === 'slow' && state.u?.uswallow
            && state.u?.ustuck === monster && monsterIsWhirly(monster)) {
            await plineWithContinuation(`You disrupt ${holdingMonsterName(monster, state)}!`);
            await plineWithContinuation('A huge hole opens up...');
            await expelHero(monster, {
                state, random: options.random, rollOne: options.roll,
            });
        }
    }
    await wakeMonster(monster, { attacked: kind === 'slow' });
    return observed;
}

// Involuntary monster polymorph caused by magic.
// C refs: zap.c bhitm() and mon.c newcham().
type WakeResult = void | { heroDied?: boolean };

interface PolymorphMagicOptions {
    state?: GameState;
    targetSpotted?: boolean;
    wakeMonster?: ((monster: Monster) => WakeResult | Promise<WakeResult>) | null;
    publish?: MessagePublisher;
    showShield?: (monster: Monster) => unknown;
    finishDeath?: ((monster: Monster, options?: MonsterDeathOptions & HeroMonsterKillOptions)
        => { heroDied?: boolean } | Promise<{ heroDied?: boolean }>) | null;
    attackLevel?: number;
    polyspot?: boolean;
}

interface PolymorphMagicDetails {
    changed: boolean;
    change: MonsterFormChange | null;
    selfTouch: MonsterSelfTouchResult | null;
    magicResistant: boolean;
    resisted: boolean;
    systemShock: boolean;
    killed: boolean;
}

export type MonsterMagicPolymorphResult =
    | ({ heroDied: true; alreadyChanged?: never } & Partial<PolymorphMagicDetails>)
    | ({ heroDied?: false; alreadyChanged?: never } & PolymorphMagicDetails)
    | {
        heroDied?: false;
        changed: false;
        alreadyChanged: true;
        killed: false;
        change?: never;
        selfTouch?: never;
        magicResistant?: never;
        resisted?: never;
        systemShock?: never;
    };

const POTION_ATTACK_LEVEL = 6;
// C zap.c:drain_item(). Billing precedes the loss of a charge.
export async function drainObjectEnchantment(object: GameObject | null | undefined, {
    random = rn2, byHero = false, state = game,
}: { random?: typeof rn2; byHero?: boolean; state?: GameState } = {}): Promise<boolean> {
    if (!object || !(object.spe > 0)) return false;
    const weaponTool = object.oclass === TOOL_CLASS && OBJECT_SUBTYPE[object.otyp] !== 0;
    if (!OBJECT_CHARGED[object.otyp]
        && ![WEAPON_CLASS, ARMOR_CLASS].includes(object.oclass) && !weaponTool)
        return false;
    const artifact = artifactById(object.oartifact);
    if (artifact?.defense === 'life-drain' || artifact?.carriedDefense === 'life-drain'
        || objectResistsDestruction(object, 10, 90, random)) return false;
    if (byHero) await chargeAlteredUnpaidObject(object, 'drain', state);
    object.spe--;
    object.enchantment = object.spe;
    if (object.oclass === ARMOR_CLASS && state.inventory.includes(object)
        && object.owornmask)
        state._armorClassDirty = true;
    drainWornBonuses(object, state);
    if (state.context.botl) {
        requireLiveGame(state);
        await bot();
    }
    return true;
}

function drainWornBonuses(object: GameObject, state: GameState): void {
    const name = OBJECT_NAMES[object.otyp];
    const worn = object.owornmask ?? 0;
    const ring = object === (state.uleft || state.u.uleft)
        || object === (state.uright || state.u.uright);
    const attributes: AttributeIndex[] = [];
    if (ring && (worn & W_RING)) {
        if (name === 'gain strength') attributes.push(A_STR);
        else if (name === 'gain constitution') attributes.push(A_CON);
        else if (name === 'adornment') attributes.push(A_CHA);
        else if (name === 'increase accuracy') state.u.uhitinc = (state.u.uhitinc ?? 0) - 1;
        else if (name === 'increase damage') state.u.udaminc = (state.u.udaminc ?? 0) - 1;
    }
    if (ring && name === 'protection') {
        state._armorClassDirty = true;
        state.context.botl = true;
    }
    if (name === 'helm of brilliance' && (worn & W_ARMH)
        && object === (state.uarmh || state.u.uarmh)) attributes.push(A_INT, A_WIS);
    if (name === 'gauntlets of dexterity' && (worn & W_ARMG)
        && object === (state.uarmg || state.u.uarmg)) attributes.push(A_DEX);
    if (!attributes.length) return;
    state.u.abon ??= { a: [0, 0, 0, 0, 0, 0] };
    for (const attribute of attributes) state.u.abon.a[attribute]--;
    state.context.botl = true;
}
const PM_DEATH = 311;
const PM_FAMINE = 313;

export function objectResistsDestruction(
    object: GameObject | null | undefined, ordinaryChance: number, artifactChance: number, random = rn2,
): boolean {
    if (!object) return false;
    if (object.otyp === AMULET_OF_YENDOR
        || object.otyp === SPE_BOOK_OF_THE_DEAD
        || object.otyp === CANDELABRUM_OF_INVOCATION
        || object.otyp === BELL_OF_OPENING
        || (object.otyp === CORPSE
            && object.corpsenm !== undefined
            && object.corpsenm >= PM_DEATH
            && object.corpsenm <= PM_FAMINE)) return true;
    return random(100) < (object.oartifact || object.artifact
        ? artifactChance : ordinaryChance);
}

const PM_LONG_WORM = MONSTER_NAME.indexOf('long worm');
interface ObjectLocationOptions {
    contained?: boolean;
    buried?: boolean;
}

export interface ObjectLocation {
    x: number;
    y: number;
}

// C zap.c:get_obj_location(). Free and migrating objects have no current
// location even when their coordinate fields still contain an old square.
export function getObjectLocation(
    object: GameObject,
    state: GameState = game,
    { contained = false, buried = false }: ObjectLocationOptions = {},
): ObjectLocation | null {
    switch (object.where) {
        case 'free':
        case 'gone':
        case 'migrating':
        case 'onbill':
            return null;
        case 'inventory':
            return { x: state.u.ux, y: state.u.uy };
        case 'floor':
            return { x: object.ox, y: object.oy };
        case 'minvent': {
            const carrier = object.ocarry;
            if (!carrier)
                throw new Error(`Monster-carried object ${object.o_id} has no owner`);
            if (carrier.mx) return { x: carrier.mx, y: carrier.my };
            break;
        }
        case 'buried':
            if (buried) return { x: object.ox, y: object.oy };
            break;
        case 'contained':
            if (contained) {
                const container =
                    object.container ||
                    objectsInTimerGraph(state).find((candidate) =>
                        candidate.contents?.includes(object),
                    );
                if (container) return getObjectLocation(container, state, { contained, buried });
            }
            break;
    }
    return null;
}


function survived(monster: Monster): boolean {
    return !monster.dead && (monster.mhp ?? 0) > 0;
}

function alreadyChangedThisAttack(monster: Monster): boolean {
    const corpseSpecies = monster.mcorpsenm;
    const extraCorpseSpecies = monster.mextra?.mcorpsenm;
    return (corpseSpecies !== undefined && Number.isInteger(corpseSpecies) && corpseSpecies >= 0)
        || (extraCorpseSpecies !== undefined && Number.isInteger(extraCorpseSpecies)
            && extraCorpseSpecies >= 0);
}

function markNewLongWorm(monster: Monster, state: GameState): void {
    if (monster.mnum !== PM_LONG_WORM) return;
    if (!monster.mextra) monster.mextra = {};
    monster.mextra.mcorpsenm = PM_LONG_WORM;
    state.context.bypasses = true;
}

export async function polymorphMonsterFromMagic(monster: Monster, {
    state = game,
    targetSpotted = false,
    wakeMonster,
    publish = plineWithContinuation,
    showShield,
    finishDeath,
    attackLevel = POTION_ATTACK_LEVEL,
    polyspot = false,
}: PolymorphMagicOptions = {}): Promise<MonsterMagicPolymorphResult> {
    if (monster.mnum === PM_LONG_WORM
        && alreadyChangedThisAttack(monster)) {
        if ((await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return { changed: false, alreadyChanged: true, killed: false };
    }

    const magicResistant = monsterHasMagicResistance(monster);
    if (magicResistant) await showShield?.(monster);
    const resisted = !magicResistant
        && monsterResistsEffect(monster, attackLevel);
    let systemShock = false;
    let change: MonsterFormChange | null = null;
    let selfTouch: MonsterSelfTouchResult | null = null;

    if (!magicResistant && !resisted) {
        if (polyspot) {
            bypassObjectList(monster.minvent || monster.inventory || [], true, state);
        }
        const naturalSpecies = monster.cham;
        const naturalShapechanger = naturalSpecies !== undefined
            && Number.isInteger(naturalSpecies) && naturalSpecies >= 0;
        systemShock = !naturalShapechanger && rn2(25) === 0;
        if (systemShock) {
            if (targetSpotted)
                await publish(`${monsterName(monster, { state, capitalized: true })} shudders!`);
            if (!finishDeath)
                throw new Error('polymorph fatality owner unavailable');
            const death = await finishDeath(monster, { noCorpse: true });
            if (death.heroDied) return { heroDied: true };
        } else {
            const heroInsideTarget = !!state.u.uswallow
                && state.u.ustuck === monster;
            const changeOptions: MonsterFormChangeOptions = {
                showMessage: !heroIsHallucinating(state) && (targetSpotted || heroInsideTarget),
                creditHero: true,
                finishDeath: (target, death) => {
                    if (!finishDeath)
                        throw new Error('polymorph self-touch requires a monster death handler');
                    return finishDeath(target, {
                        ...death,
                        showKillMessage: false,
                        recordConduct: false,
                    });
                },
                publish,
                polyspot,
            };
            change = await changeMonsterForm(monster, null, state, changeOptions);
            if (!change && naturalShapechanger)
                change = await changeMonsterForm(monster, naturalSpecies, state, changeOptions);
            if (change?.heroDied) return {
                changed: true, change, heroDied: true,
                magicResistant, resisted, systemShock, killed: false,
            };
            selfTouch = change?.selfTouch || null;
        }
        if (survived(monster)) markNewLongWorm(monster, state);
    }

    const killed = !survived(monster);
    if (!killed && (await wakeMonster?.(monster))?.heroDied)
        return { heroDied: true };
    return {
        changed: !!change,
        change,
        selfTouch,
        magicResistant,
        resisted,
        systemShock,
        killed,
    };
}

// Monster state restored from a corpse or statue. C zap.c:montraits().
// Both arguments have the same trait contract; the target's type determines
// which values the saved record may supply. Inventory/body ownership is restored
// separately below, and only the saved record's own fields are copied.
function copyRestoredTraits<Traits extends SavedMonsterTraits>(
    monster: Traits, saved: NoInfer<Traits>,
): void {
    for (const key in saved) {
        if (Object.hasOwn(saved, key)) monster[key] = saved[key];
    }
}

export function restoreMonsterTraits(
    monster: Monster, saved: SavedMonsterTraits | null | undefined,
    options?: MonsterHitPointRandom,
): Monster;
export function restoreMonsterTraits(
    monster: Monster | null | undefined, saved: SavedMonsterTraits | null | undefined,
    options?: MonsterHitPointRandom,
): Monster | null | undefined;
export function restoreMonsterTraits(
    monster: Monster | null | undefined, saved: SavedMonsterTraits | null | undefined, {
    rollOne = rnd,
    randomBelow = rn2,
}: MonsterHitPointRandom = {}): Monster | null | undefined {
    if (!monster || !saved) return monster;
    const created = {
        m_id: monster.m_id,
        mx: monster.mx,
        my: monster.my,
        mux: monster.mux,
        muy: monster.muy,
        minvent: monster.minvent || [],
        wormno: monster.wormno,
        wormSegments: monster.wormSegments,
        wormHead: monster.wormHead,
        wormGrowTime: monster.wormGrowTime,
        misc_worn_check: monster.misc_worn_check,
        weaponCheck: monster.weaponCheck,
        mtrapseen: monster.mtrapseen,
        mflee: monster.mflee,
        mfleetim: monster.mfleetim,
        mburied: monster.mburied,
        mlstmv: monster.mlstmv,
        mundetected: monster.mundetected,
        m_ap_type: monster.m_ap_type,
        m_lev: monster.m_lev ?? 0,
        mhpmax: monster.mhpmax ?? 1,
    };

    let restoredLevel = saved.m_lev ?? created.m_lev;
    const speciesLevel = MONSTER_LEVEL[saved.mnum] ?? 0;
    if (created.m_lev < speciesLevel) {
        const targetLevel = rollOne(speciesLevel + 1);
        if (targetLevel > created.m_lev) {
            while (created.m_lev < targetLevel) {
                created.m_lev++;
                created.mhpmax += monsterHitPointsPerLevel(
                    { mnum: saved.mnum, m_lev: created.m_lev },
                    { rollOne, randomBelow },
                );
            }
            restoredLevel = created.m_lev;
        }
    }

    copyRestoredTraits(monster, saved);
    monster.m_id = created.m_id;
    monster.mx = created.mx;
    monster.my = created.my;
    if (created.mux === undefined) delete monster.mux;
    else monster.mux = created.mux;
    if (created.muy === undefined) delete monster.muy;
    else monster.muy = created.muy;
    monster.minvent = created.minvent;
    monster.inventory = monster.minvent;
    monster.hasInventory = monster.minvent.length > 0;
    monster.mw = null;
    if (created.wormno === undefined) delete monster.wormno;
    else monster.wormno = created.wormno;
    if (created.wormSegments === undefined) delete monster.wormSegments;
    else monster.wormSegments = created.wormSegments;
    if (created.wormHead === undefined) delete monster.wormHead;
    else monster.wormHead = created.wormHead;
    if (created.wormGrowTime === undefined) delete monster.wormGrowTime;
    else monster.wormGrowTime = created.wormGrowTime;
    monster.misc_worn_check = created.misc_worn_check ?? 0;
    monster.weaponCheck = created.weaponCheck ?? 0;
    monster.mtrapseen = created.mtrapseen ?? 0;
    monster.mflee = created.mflee ?? 0;
    monster.mfleetim = created.mfleetim ?? 0;
    monster.mburied = created.mburied ?? 0;
    monster.mlstmv = created.mlstmv ?? 0;
    monster.mundetected = created.mundetected ?? 0;
    monster.m_ap_type = created.m_ap_type ?? 0;
    monster.m_lev = restoredLevel;
    monster.mhpmax = Math.max(created.mhpmax, saved.mhpmax ?? 1);
    monster.mhp = monster.mhpmax;
    monster.dead = false;
    monster.mrevived = 1;
    monster.mavenge = 0;
    monster.meating = 0;
    monster.mleashed = 0;
    monster.mtrapped = 0;
    monster.msleeping = 0;
    monster.mfrozen = 0;
    monster.mcanmove = 1;
    if (!monsterHasSeductionAttack(monster.mnum)) monster.mcan = 0;
    monster.mcansee = 1;
    monster.mblinded = 0;
    monster.mstun = 0;
    monster.mconf = 0;
    if (monster.edog) {
        monster.edog = copyPetData(monster.edog);
        monster.mextra = { ...(monster.mextra || {}), edog: monster.edog };
    }
    return monster;
}

// Cancellation applied to a monster.
// C ref: zap.c cancel_monst() and mon.c normal_shape().
const PM_CLAY_GOLEM = MONSTER_NAME.indexOf('clay golem');

export interface CancelMonsterOptions {
    state?: GameState;
    attackLevel: number;
    random?: typeof rn2;
    allowKill?: boolean;
    publish?: MessagePublisher;
    finishMonsterKill?: typeof finishHeroMonsterKill;
}

export async function cancelMonster(monster: Monster, {
    state = game,
    attackLevel,
    random = rn2,
    allowKill = true,
    publish = plineWithContinuation,
    finishMonsterKill = finishHeroMonsterKill,
}: CancelMonsterOptions) {
    if (monsterResistsEffect(monster, attackLevel, random)) {
        return { cancelled: false, resisted: true, killed: false };
    }

    monster.mcan = 1;
    const shape = await normalizeMonsterShape(monster, state, publish);
    if (shape.heroDied) return {
        cancelled: true, resisted: false, heroDied: true, changedShape: shape.changed,
    };
    const changedShape = shape.changed;
    const clayGolem = monster.mnum === PM_CLAY_GOLEM;
    if (clayGolem && canSeeMonster(monster)) {
        await publish(
            `Some writing vanishes from ${possessiveName(monsterName(monster, { state }))} head!`,
        );
    }

    let killed = false;
    if (clayGolem && allowKill) {
        killed = await finishMonsterKill(monster, monster.mx, monster.my);
    }
    return {
        cancelled: true,
        resisted: false,
        killed,
        clayGolem,
        changedShape,
    };
}

// C zap.c:resist().
export function monsterResistsEffect(
    monster: Monster, attackLevel: number, random = rn2,
): boolean {
    let defenseLevel = monster?.m_lev ?? 1;
    if (defenseLevel > 50) defenseLevel = 50;
    else if (defenseLevel < 1)
        defenseLevel = monsterIsPlayerMonster(monster.mnum) ? game.u.ulevel ?? 1 : 1;
    const resistance = MONSTER_MAGIC_RESISTANCE[monster?.mnum] ?? 0;
    return random(100 + attackLevel - defenseLevel) < resistance;
}

// C youprop.h:Half_spell_damage, including carried artifact extrinsics.
// zap.c:4584-4586 halves wand and spell damage through this property.
export function heroHasHalfSpellDamage(state: GameState = game) {
    return !!(state.u?.halfSpellDamage
        || (state.u?.halfSpellDamageTurns ?? 0) > 0
        || heroHasCarriedArtifactFlag('SPFX_HSPDAM', state));
}

// C zap.c:spell_damage_bonus().
export function adjustSpellDamage(damage: number, state: GameState = game): number {
    const intelligence = currentAttribute(A_INT, state) ?? 10;
    const level = state.u?.ulevel ?? 1;
    if (intelligence <= 9)
        return damage > 1 ? Math.max(1, damage - 3) : damage;
    if (intelligence <= 13 || level < 5) return damage;
    if (intelligence <= 18) return damage + 1;
    if (intelligence <= 24 || level < 14) return damage + 2;
    return damage + 3;
}

export type InventoryDamageType = 'cold' | 'fire' | 'electric';
export type RayFloorKind = 'fire' | 'cold' | 'disintegration' | 'lightning'
    | 'acid' | 'poison' | 'magic' | 'death' | 'breath' | null;

export interface MagicDamageResult {
    damage: number;
    heroDied: boolean;
}

export interface RayFloorResult {
    absorbed: boolean;
    rangeChange: number;
    shopDamage?: boolean;
}

// Native ray types encode the source in the tens digit and the effect in
// units: zap.c decodes the attack type with zaptype(type) % 10 (zap.c:4245,
// 4788, 5154).
export function rayDamageType(type: number): DamageType {
    const effects: readonly DamageType[] = [AD_MAGM, AD_FIRE, AD_COLD, AD_SLEE,
        AD_DISN, AD_ELEC, AD_DRST, AD_ACID, AD_SPC1, AD_SPC2];
    const damage = effects[Math.abs(type) % 10];
    if (damage === undefined) throw new RangeError(`Invalid native ray type ${type}`);
    return damage;
}

// Probing reveals object descriptions and immediate container contents.
// C refs: zap.c probe_objchain(), probe_monster(), and bhito(WAN_PROBING).
function schroedingersBox(object: GameObject) {
    return object.otyp === LARGE_BOX && object.spe === 1;
}

export async function probeMonster(monster: Monster, {
    state = game, onHead = true, x = monster.mx, y = monster.my, publish = plineWithContinuation,
}: { state?: GameState; onHead?: boolean; x?: number; y?: number; publish?: MessagePublisher } = {}) {
    await publish(await monsterStatusLine(monster, { state, x, y }));
    if (!onHead) return;
    const inventory = monster.minvent || monster.inventory || [];
    if (!inventory.length) {
        const carryingHero = state.u.uswallow && state.u.ustuck === monster;
        // zap.c:probe_monster() formats the name with noit_Monnam():
        // ARTICLE_YOUR plus SUPPRESS_IT, so a tame carrier reads "Your
        // kitten" and hostiles fall back to "The".
        await publish(`${monsterName(monster, { state, capitalized: true, article: 'your', suppressIt: true })} is not carrying anything${carryingHero ? ' besides you' : ''}.`);
        return;
    }
    probeObjectChain(inventory, { state });
    // invent.c:display_minventory() titles the menu with
    // s_suffix(noit_Monnam(mon)) — ARTICLE_YOUR plus SUPPRESS_IT, matching
    // the empty-carrier message above — and shows the monster's whole
    // inventory through query_objlist() with INVORDER_SORT: entries group
    // by class in inv_order under class headings, the tty layer generates
    // the selector letters, and only a leading gold stack keeps its own
    // '$' selector (pickup.c:1129-1139).
    const name = monsterName(monster, { state, capitalized: true, article: 'your', suppressIt: true });
    await showProbedObjectInventory(inventory, `${possessiveName(name)} possessions:`, { state });
}

// C zap.c:probe_objchain().
export function probeObjectChain(inventory: readonly GameObject[], { state = game }: { state?: GameState } = {}) {
    for (const object of inventory) {
        observeObject(object, state);
        if (isContainer(object) || object.otyp === STATUE) {
            object.lknown = true;
            if (!schroedingersBox(object)) object.cknown = true;
        } else if (object.otyp === TIN) object.known = true;
    }
}

export async function probeObject(object: GameObject, { state = game }: { state?: GameState } = {}) {
    let learned = !object.dknown;
    observeObject(object, state);
    if (isContainer(object) || object.otyp === STATUE) {
        object.cknown = object.lknown = true;
        const name = definiteName(objectName(object, state), state);
        if ([CHEST, LARGE_BOX].includes(object.otyp) && !object.tknown) {
            if (object.otrapped) await plineWithContinuation(`${definiteObjectAction(object, 'are', state)} trapped!`);
            object.tknown = true;
        }
        if (!object.contents?.length) await plineWithContinuation(`${definiteObjectAction(object, 'are', state)} empty.`);
        else if (schroedingersBox(object)) {
            const cat = heroIsHallucinating(state) ? randomDisplayMonsterName() : 'cat';
            await plineWithContinuation(`You aren't sure whether ${name} has ${withIndefiniteArticle(cat)} or its corpse inside.`);
            object.cknown = false;
        } else {
            for (const content of object.contents) observeObject(content, state);
            await showProbedObjectInventory(object.contents, `Contents of ${await probedContentsTitle(object, state)}:`, { state });
        }
        learned = true;
    } else if (object.otyp === TIN) {
        learned ||= !object.known || !object.cknown;
        object.known = object.cknown = true;
    } else if (object.otyp === EGG) {
        learned ||= !object.known && (object.corpsenm ?? -1) >= 0;
        object.known = true;
    }
    return learned;
}

// C query_objlist(): PICK_NONE still gives each object a menu identifier,
// so tty assigns letters. INVORDER_SORT adds headings even for one item.
export async function showProbedObjectInventory(objects: readonly GameObject[], title: string, {
    state = game, groupByClass = true,
}: { state?: GameState; groupByClass?: boolean } = {}): Promise<void> {
    const sorted = sortObjects(objects, { mode: lootSortMode({ state }), state });
    const sections: InventorySection<GameObject>[] = [];
    const classes = groupByClass ? inventoryClassOrder(state) : [null];
    let first = true;
    for (const oclass of classes) {
        const members = oclass === null ? sorted
            : sorted.filter(object => (object.oclass || objectClassForType(object.otyp)) === oclass);
        if (!members.length) continue;
        const items = [];
        for (const object of members) {
            consumeHallucinatedMenuObjectGlyph(object);
            items.push({
                ...(first && objectClassForType(object.otyp) === 12 ? { key: '$' } : {}),
                text: await inventoryItemDescription(object), value: object,
            });
            first = false;
        }
        sections.push({ heading: oclass === null ? null : objectClassHeading(oclass), items });
    }
    await showInventoryWindow(sections, { title });
}

// C invent.c:cinv_doname(): the probing contents menu names the box with
// "trapped" inserted before its lock state even though doname() already
// shows a just-learned trap, so a trapped box is named twice.
async function probedContentsTitle(object: GameObject, state: GameState): Promise<string> {
    let name = await objectDescription(object, { state });
    if (!object.otrapped) return name;
    const locked = name.indexOf(' locked ');
    const unlocked = name.indexOf(' unlocked ');
    if (locked >= 0 && (unlocked < 0 || locked < unlocked))
        name = name.replace(' locked ', ' trapped locked ');
    else if (unlocked >= 0)
        name = name.replace(' unlocked ', ' trapped unlocked ');
    return name.replace('an trapped ', 'a trapped ');
}

// Cancellation changes an actual object, including worn bonuses and timers.
// C ref: zap.c cancel_item() and blank_novel().

const SPE_CANCELLATION = OBJECT_NAMES.indexOf('cancellation');
const POT_SEE_INVISIBLE = OBJECT_NAMES.indexOf('see invisible', 297);
export async function cancelObjectMagic(
    object: GameObject, { state = game }: { state?: GameState } = {},
): Promise<void> {
    const originalType = object.otyp;
    const objectClass = object.oclass ?? objectClassForType(originalType);
    removeWornBonuses(object, state);
    const enchanted = !!object.spe
        && ([2, 3].includes(objectClass) || isWeaponTool(object));
    if (OBJECT_MAGIC[originalType] || enchanted
        || originalType === POT_ACID || originalType === POT_SICKNESS
        || (originalType === POT_WATER && (object.blessed || object.cursed))
        || originalType === SPE_NOVEL) {
        const cancelledCharges = objectClass === 11 || originalType === CRYSTAL_BALL ? -1 : 0;
        if (object.spe !== cancelledCharges
            && ![WAN_CANCELLATION, MAGIC_LAMP, CANDELABRUM_OF_INVOCATION].includes(originalType)) {
            await chargeAlteredUnpaidObject(object, 'cancel', state);
            object.spe = cancelledCharges;
            if ('enchantment' in object) object.enchantment = cancelledCharges;
        }
        if (objectClass === 9) {
            await chargeAlteredUnpaidObject(object, 'cancel', state);
            object.otyp = SCR_BLANK_PAPER;
            object.spe = 0;
        } else if (objectClass === 10
            && originalType !== SPE_CANCELLATION && originalType !== SPE_BOOK_OF_THE_DEAD) {
            await chargeAlteredUnpaidObject(object, 'cancel', state);
            object.otyp = SPE_BLANK_PAPER;
            if (originalType === SPE_NOVEL) blankNovel(object);
        } else if (objectClass === 8) {
            await chargeAlteredUnpaidObject(object, originalType !== POT_WATER ? 'cancel'
                : object.cursed ? 'uncurse' : 'unbless', state);
            if (originalType === POT_SICKNESS || originalType === POT_SEE_INVISIBLE)
                object.otyp = POT_FRUIT_JUICE;
            else {
                object.otyp = POT_WATER;
                object.odiluted = 0;
            }
        }
    }
    if (object.otyp === CORPSE && object.timed
        && !monsterIsRider({ mnum: object.corpsenm ?? -1 })) {
        const revival = objectTimers(object).find(timer => timer.kind === OBJECT_TIMER_KIND.REVIVE_MON);
        if (revival) {
            stopObjectTimer(object, OBJECT_TIMER_KIND.REVIVE_MON);
            // C starts a new relative timeout using peek_timer's absolute value.
            scheduleObjectTimer(object, OBJECT_TIMER_KIND.ROT_CORPSE,
                (state.moves ?? 1) + revival.deadline, state);
        }
    }
    unblessObjectState(object);
    uncurseObjectState(object);
}
function removeWornBonuses(object: GameObject, state: GameState): void {
    if (object.where !== 'inventory') return;
    const name = OBJECT_NAMES[object.otyp];
    const worn = object.owornmask ?? 0;
    const amount = object.spe ?? 0;
    const attributes = new Map<string, readonly [number, number]>([
        ['gain strength', [A_STR, W_RING]], ['gain constitution', [A_CON, W_RING]],
        ['adornment', [A_CHA, W_RING]], ['gauntlets of dexterity', [A_DEX, W_ARMG]],
        ['helm of brilliance', [A_INT, W_ARMH]],
    ]);
    const bonus = name ? attributes.get(name) : undefined;
    if (bonus && (worn & bonus[1])) {
        state.context.botl = true;
        state.u.abon ||= { a: [0, 0, 0, 0, 0, 0] };
        state.u.abon.a[bonus[0]] = (state.u.abon.a[bonus[0]] ?? 0) - amount;
        if (name === 'helm of brilliance') state.u.abon.a[A_WIS] = (state.u.abon.a[A_WIS] ?? 0) - amount;
    }
    if ((worn & W_ARMOR) || (name === 'protection' && (worn & W_RING)))
        state.context.botl = true;
    if (!(worn & W_RING)) return;
    if (name === 'increase accuracy') state.u.uhitinc = (state.u.uhitinc ?? 0) - amount;
    if (name === 'increase damage') state.u.udaminc = (state.u.udaminc ?? 0) - amount;
}
export function blankNovel(object: GameObject): void {
    if (object.otyp !== SPE_BLANK_PAPER)
        throw new TypeError('A blanked novel must be a blank spellbook.');
    object.novelidx = 0;
    object.corpsenm = 0;
    delete object.oname;
    delete object.name;
    if (object.oextra) delete object.oextra.oname;
    for (let current: GameObject | null | undefined = object; current; current = current.container)
        current.owt = objectWeight(current);
}

// Object transformations, system shock, and material golems.
// C zap.c:obj_shudders(), do_osshock(), poly_obj(), polyuse(), create_polymon().

const STRANGE_OBJECT = 0;
const WEAPON_CLASS = 2, ARMOR_CLASS = 3, AMULET_CLASS = 5;
const TOOL_CLASS = 6;
const GEM_CLASS = 13, ROCK_CLASS = 14;
const WOOD = 8, FLESH = 4, LEATHER = 7, CLOTH = 6, BONE = 9;
const IRON = 11, METAL = 12, COPPER = 13, SILVER = 14, GOLD = 15;
const PLATINUM = 16, MITHRIL = 17, GLASS = 19, GEMSTONE = 20, MINERAL = 21;
const PAPER = 5;
const LARGEST_INT = 32767;
const PM_CROCODILE = MONSTER_NAME.indexOf('crocodile');
const PM_FLESH_GOLEM = MONSTER_NAME.indexOf('flesh golem');
const S_GOLEM = MONSTER_SYMBOL[PM_FLESH_GOLEM];
const LOW_BOOTS = OBJECT_NAMES.indexOf('low boots');
const isBox = (object: GameObject) => object.otyp === CHEST || object.otyp === LARGE_BOX;
export async function polymorphFloorObject(
    object: GameObject, { state = game }: { state?: GameState } = {},
): Promise<{ affected: boolean; learned: boolean }> {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (obj_unpolyable(object, { state })) return { affected: false, learned: false };
    const conduct = state.u.uconduct ??= {};
    if (!conduct.polypiles)
        recordGameLogEvent(`polymorphed ${state.flags.female ? 'her' : 'his'} first object`, { state, flags: LL_CONDUCT });
    conduct.polypiles = (conduct.polypiles || 0) + 1;
    if (isBox(object))
        await changeBoxLockByMagic(object, { otyp: WAN_POLYMORPH }, { state });
    if (obj_shudders(object, { state })) {
        const cover = state.level.objects[state.u.ux]?.[state.u.uy]?.[0] === object
            && state.u.uundetected && heroFormHidesUnderObjects(state);
        const learned = cansee(object.ox, object.oy);
        await do_osshock(object, { state });
        if (cover) await maybeUnhideAt(state.u.ux, state.u.uy, state);
        return { affected: true, learned };
    }
    const replacement = await poly_obj(object, STRANGE_OBJECT, { state });
    if (!replacement) throw new Error(`Floor polymorph lost replacement for object ${object.o_id}`);
    await newsym(replacement.ox, replacement.oy);
    return { affected: true, learned: false };
}
export function obj_unpolyable(object: GameObject, { state = game }: { state?: GameState } = {}): boolean {
    return [WAN_POLYMORPH, SPE_POLYMORPH, POT_POLYMORPH, AMULET_OF_UNCHANGING]
        .includes(object.otyp) || object === (state.uball || state.u.uball)
        || object === state.uskin || objectResistsDestruction(object, 5, 95);
}
export function obj_shudders(object: GameObject, { state = game }: { state?: GameState } = {}): boolean {
    if (state.context.bypasses && object.bypass) return false;
    let odds = object.oclass === WAND_CLASS || object.cursed ? 3
        : object.blessed ? 12 : 8;
    if (objectQuantity(object) > 4) odds = Math.trunc(odds / 2);
    return !rn2(odds);
}
export async function do_osshock(
    object: GameObject, { state = game }: { state?: GameState } = {},
): Promise<void> {
    requireLiveGame(state);
    requirePlayingGame(state);
    state.context.obj_zapped = true;
    if ((state.context.poly_zapped ?? -1) < 0) {
        const luck = (state.u.uluck || 0) + (state.u.moreluck || 0);
        for (let remaining = objectQuantity(object); remaining > 0; remaining--) {
            if (!rn2(luck + 45)) {
                state.context.poly_zapped = objectMaterial(object, state);
                break;
            }
        }
    }
    const quantity = objectQuantity(object);
    if (quantity > 1) {
        const split = splitObjectStack(object,
            rnd(quantity > LARGEST_INT ? 30000 : quantity - 1), state);
        if (!split) throw new Error(`System shock could not split object ${object.o_id}`);
        object = split;
    }
    await billDestroyedMaterial(object, state);
    await delobj(object, state);
}
export async function poly_obj(
    object: GameObject, id = STRANGE_OBJECT, { state = game }: { state?: GameState } = {},
): Promise<GameObject | null> {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (object.otyp === BOULDER) sokobanGuilt(state);
    const where = object.where;
    let replacement: GameObject | null = await createReplacement(object, id, state);
    finishReplacementType(object, replacement, id, state);
    replacement.owt = objectWeight(replacement);
    const location = getObjectLocation(object, state, { contained: true, buried: true });
    const oldWornMask = (object.owornmask || 0) & ~(W_ART | W_ARTI);
    if (where === 'inventory') updateInventoryPresentation(replacement);
    replaceObject(object, replacement, state);
    if (where === 'inventory') {
        await finishInventoryRemoval(object, state);
        if (state.program_state.gameover) return replacement;
        await prepareInventoryAddition(replacement, state);
        await finishInventoryAddition(replacement, state);
        if (oldWornMask)
            replacement = await replaceWornItem(object, replacement, oldWornMask, state);
        if (state.program_state.gameover) return replacement;
    } else if (where === 'floor') {
        if (!location) throw new Error(`Floor object ${object.o_id} has no location`);
        if (object.otyp !== BOULDER && replacement.otyp === BOULDER
            && (isPoolAt(location.x, location.y, state) || isLavaAt(location.x, location.y, state)))
            await fractureRock(replacement, location.x, location.y, { state, publish: plineWithContinuation });
        if (object.otyp === BOULDER || replacement.otyp === BOULDER)
            vision_note_blocker_change(location.x, location.y);
    }
    await angerObjectOwner(object, replacement, location, state);
    await delobj(object, state);
    return replacement;
}
async function createReplacement(object: GameObject, id: number, state: GameState): Promise<GameObject> {
    let replacement: GameObject;
    if (id === STRANGE_OBJECT) {
        const magic = object.otyp === UNICORN_HORN && object.degraded_horn
            ? 0 : OBJECT_MAGIC[object.otyp];
        replacement = await mkobj(object.oclass, false);
        for (let attempt = 1; attempt < 3 && OBJECT_MAGIC[replacement.otyp] !== magic; attempt++) {
            await delobj(replacement, state);
            replacement = await mkobj(object.oclass, false);
        }
    } else {
        replacement = await mksobj(id, false, false);
        if ([CORPSE, STATUE, FIGURINE].includes(object.otyp)
            && [CORPSE, STATUE, FIGURINE].includes(id))
            set_corpsenm(replacement, representedSpecies(object));
    }
    replacement.quan = replacement.quantity = objectQuantity(object);
    if (object.no_charge === undefined) delete replacement.no_charge;
    else replacement.no_charge = object.no_charge;
    if (object.where === 'inventory') {
        if (object.invlet === undefined) delete replacement.invlet;
        else replacement.invlet = object.invlet;
    }
    if (object.otyp === EGG && object.spe) makeHeroLaidEgg(replacement, state);
    if ([WAND_CLASS, WEAPON_CLASS, ARMOR_CLASS].includes(replacement.oclass))
        replacement.spe = object.spe;
    replacement.recharged = object.recharged || 0;
    replacement.cursed = !!object.cursed;
    replacement.blessed = !!object.blessed;
    copyErosion(object, replacement, state);
    if (object.otrapped && isBox(replacement)) replacement.otrapped = true;
    if (object.opoisoned && isPoisonableObject(replacement)) replacement.opoisoned = true;
    if (id === STRANGE_OBJECT && object.otyp === CORPSE && object.corpsenm === PM_CROCODILE) {
        replacement.otyp = LOW_BOOTS;
        replacement.oclass = ARMOR_CLASS;
        replacement.spe = replacement.oeroded = 0;
        replacement.oerodeproof = true;
        replacement.quan = replacement.quantity = 1;
        replacement.cursed = false;
    }
    if (object.otyp === LEASH && object.leashmon) {
        if (replacement.otyp === LEASH) {
            replacement.leashmon = object.leashmon;
            object.leashmon = 0;
        } else releaseObjectLeash(object, state);
    }
    await deleteObjectContents(replacement, state);
    return replacement;
}
function makeHeroLaidEgg(object: GameObject, state: GameState): void {
    if (object.otyp === EGG) stopObjectTimers(object, state);
    object.otyp = EGG;
    object.corpsenm = -1;
    object.spe = 0;
    for (let attempt = 0; attempt < 100; attempt++) {
        const species = hatchableEggSpecies(rn2(MONSTER_NAME.length));
        if (species >= 0 && !eggSpeciesIsDead(species, state)) {
            object.spe = 1;
            set_corpsenm(object, species);
            return;
        }
    }
}
function copyErosion(source: GameObject, target: GameObject, state: GameState): void {
    if (!erosionMatters(target)) return;
    const primary = (['burn', 'rust', 'crack'] as const).some(kind => objectIsVulnerableToErosion(target, kind, state));
    const secondary = (['corrosion', 'rot'] as const).some(kind => objectIsVulnerableToErosion(target, kind, state));
    if (primary) target.oeroded = source.oeroded || 0;
    if (secondary) target.oeroded2 = source.oeroded2 || 0;
    if (primary || secondary) target.oerodeproof = !!source.oerodeproof;
}
function finishReplacementType(source: GameObject, target: GameObject, id: number, state: GameState): void {
    if (target.quan > 1 && (!OBJECT_MERGE[target.otyp]
        || (id === STRANGE_OBJECT && target.quan > rn2(1000))))
        target.quan = target.quantity = 1;
    switch (target.oclass) {
    case TOOL_CLASS:
        if (target.otyp === MAGIC_LAMP) {
            target.otyp = OIL_LAMP;
            target.age = 1500;
        } else if (target.otyp === MAGIC_MARKER) target.recharged = 1;
        break;
    case WAND_CLASS:
        while ([WAN_WISHING, WAN_POLYMORPH].includes(target.otyp))
            target.otyp = rndClass(WAN_LIGHT, WAN_LIGHTNING);
        if (target.recharged < rn2(7)) target.recharged++;
        break;
    case POTION_CLASS:
        while (target.otyp === POT_POLYMORPH) target.otyp = rndClass(POT_GAIN_ABILITY, POT_WATER);
        if (target.otyp === POT_OIL)
            target.age = source.otyp === POT_OIL ? source.age : MAX_OIL_IN_FLASK;
        else if (source.otyp === POT_OIL) {
            if (target.age === source.age) target.age = state.moves;
            if (source.age < MAX_OIL_IN_FLASK) target.odiluted = true;
        }
        break;
    case SPBOOK_CLASS:
        while (target.otyp === SPE_POLYMORPH)
            target.otyp = rndClass(getObjectClassBounds(SPBOOK_CLASS).first, SPE_BLANK_PAPER);
        if (![SPE_BLANK_PAPER, SPE_NOVEL].includes(target.otyp)) {
            target.spestudied = (source.spestudied || 0) + 1;
            if (target.spestudied > MAX_SPELL_STUDY) {
                target.otyp = SPE_BLANK_PAPER;
                target.spestudied = rn2(target.spestudied);
            }
        }
        break;
    case GEM_CLASS:
        if (target.quan > rnd(4) && objectMaterial(source, state) === MINERAL
            && objectMaterial(target, state) !== MINERAL) {
            target.otyp = ROCK;
            target.quan = target.quantity = Math.trunc(target.quan / 2);
        }
        break;
    }
}
async function replaceWornItem(
    old: GameObject, replacement: GameObject, mask: number, state: PlayingGameState,
): Promise<GameObject | null> {
    const twoHanded = isBimanualObject(old);
    const twoWeapons = !!state.u.twoweap;
    const oldArmorSlot = armorSlotFor(old.otyp);
    await removeWornHeroItem(old, state);
    if (state.program_state.gameover) return replacement;
    if (mask & W_WEP) {
        if (twoHanded || !isBimanualObject(replacement) || !state.uarms)
            await setPrimaryWeapon(replacement, state);
        if (twoWeapons && state.uwep && !isBimanualObject(state.uwep))
            setTwoWeaponCombat(true, state);
    } else if (mask & W_SWAPWEP) {
        if (twoHanded || !isBimanualObject(replacement))
            await setSecondaryWeapon(replacement, state);
        if (twoWeapons && state.uswapwep) setTwoWeaponCombat(true, state);
    } else if (mask & W_QUIVER) {
        await setQuiverObject(replacement, state);
    } else if (oldArmorSlot && oldArmorSlot === armorSlotFor(replacement.otyp)) {
        wearHeroArmor(replacement, state);
        await applyArmorOnEffects(replacement, state);
        return state[oldArmorSlot] ?? null;
    } else if ((mask & (W_RINGL | W_RINGR))
        && (replacement.oclass === RING_CLASS || replacement.otyp === MEAT_RING)) {
        const slot = mask & W_RINGL ? 'uleft' : 'uright';
        await wearHeroAccessory(replacement, slot, state);
        return state[slot] ?? null;
    } else if ((mask & W_AMUL) && replacement.oclass === AMULET_CLASS) {
        await wearHeroAccessory(replacement, 'uamul', state);
        return state.uamul ?? null;
    } else if ((mask & W_TOOL) && isEyewear(replacement)) {
        await wearEyewear(replacement, { checkHead: false });
        return state.ublindf ?? null;
    }
    return replacement;
}
async function angerObjectOwner(
    old: GameObject, replacement: GameObject | null,
    location: ObjectLocation | null, state: PlayingGameState,
): Promise<void> {
    const shopRelevant = old.unpaid || (replacement && replacement.where !== 'inventory');
    if (!location || !shopRelevant) return;
    const { x, y } = location;
    const keeper = costlySpot(x, y, state)?.resident;
    if (!keeper || !shopkeeperInOwnShop(keeper, state)
        || (old.no_charge && !containedBuyCost(old, keeper, { unpaidOnly: false, state }))) return;
    if (keeper.mpeaceful && state.u.ushops?.length
        && roomsAt(state.level, state.u.ux, state.u.uy, 0)[0]
            === roomsAt(state.level, keeper.mx, keeper.my, 0)[0]
        && !costlySpot(state.u.ux, state.u.uy, state)) {
        await makeAngryShopkeeper(keeper, state);
    } else {
        await plineWithContinuation(`${shopkeeperName(keeper, { state, capitalized: true })} ${
            keeper.mpeaceful ? 'gets angry' : 'is furious'}!`, { noRepeat: !keeper.mpeaceful });
        if (keeper.mpeaceful) hotPursuitShopkeeper(keeper, state);
    }
}
async function billDestroyedMaterial(object: GameObject, state: GameState): Promise<void> {
    if (!costlySpot(object.ox, object.oy, state)) return;
    if (state.u.ushops?.length)
        await addShopObjectToBill(object, state, { ininv: false });
    else await stolenValue(object, object.ox, object.oy, false, { silent: false, state });
}
// C zap.c:polyuse().
// C zap.c:create_polymon().
export async function createPolymorphMonsterFromPile(
    x: number, y: number, { state = game }: { state?: GameState } = {},
): Promise<Monster | null> {
    requireLiveGame(state);
    requirePlayingGame(state);
    const kind = state.context.poly_zapped ?? -1;
    if (kind < 0) return null;
    const pile = state.level.objects[x]?.[y] || [];
    let start = 0;
    if (state.context.bypasses) while (pile[start]?.bypass) start++;
    const first = pile[start];
    if (!first || (start === pile.length - 1 && objectQuantity(first) === 1)) return null;
    const { species, material } = golemForMaterial(kind);
    const genocided = (state.mvitals?.[species]?.mvflags || 0) & G_GENOD;
    const monster = await makemonAt(genocided ? null : species, x, y, MM_NOMSG);
    let remaining = requireMonsterData(MONSTER_BODY_META, species)[0];
    for (const object of pile.slice(start)) {
        if (remaining <= 0) break;
        if ((state.context.bypasses && object.bypass)
            || object === (state.uball || state.u.uball)
            || object === (state.uchain || state.u.uchain)
            || objectResistsDestruction(object, 0, 0)) continue;
        if ((objectMaterial(object, state) === kind) !== (rn2(remaining + 1) !== 0)) continue;
        await billDestroyedMaterial(object, state);
        remaining -= objectQuantity(object) < LARGEST_INT ? objectQuantity(object) : remaining;
        await delobj(object, state);
    }
    if (monster && cansee(monster.mx, monster.my))
        await plineWithContinuation(`Some ${material}objects meld, and ${
            monsterName(monster, { article: 'a', state })} arises from the pile!`);
    return monster;
}
function golemForMaterial(kind: number): { species: number; material: string } {
    let name, material;
    switch (kind) {
    case IRON: case METAL: case MITHRIL: name = 'iron golem'; material = 'metal '; break;
    case COPPER: case SILVER: case PLATINUM: case GEMSTONE: case MINERAL:
        name = rn2(2) ? 'stone golem' : 'clay golem'; material = 'lithic '; break;
    case 0: case FLESH: name = 'flesh golem'; material = 'organic '; break;
    case WOOD: name = 'wood golem'; material = 'wood '; break;
    case LEATHER: name = 'leather golem'; material = 'leather '; break;
    case CLOTH: name = 'rope golem'; material = 'cloth '; break;
    case BONE: name = 'skeleton'; material = 'bony '; break;
    case GOLD: name = 'gold golem'; material = 'gold '; break;
    case GLASS: name = 'glass golem'; material = 'glassy '; break;
    case PAPER: name = 'paper golem'; material = 'paper '; break;
    default: name = 'straw golem'; material = '';
    }
    return { species: MONSTER_NAME.indexOf(name), material };
}
// C zap.c:stone_to_flesh_obj(). Animation uses the same owners as traps.
export async function stone_to_flesh_obj(
    object: GameObject, { state = game }: { state?: GameState } = {},
): Promise<number> {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (![MINERAL, GEMSTONE].includes(objectMaterial(object, state))
        || objectResistsDestruction(object, 2, 98)) return 0;
    const { x = 0, y = 0 } = getObjectLocation(object, state) || {};
    let affected = 1, smell = false;
    if (object.oclass === ROCK_CLASS || object.oclass === TOOL_CLASS) {
        if (object.otyp === BOULDER) {
            await poly_obj(object, ENORMOUS_MEATBALL, { state });
            smell = true;
        } else if (object.otyp === STATUE || object.otyp === FIGURINE) {
            const species = representedSpecies(object);
            const golem = MONSTER_SYMBOL[species] === S_GOLEM;
            if (!golem && vegetarianCorpse(species)) {
                await poly_obj(object, MEATBALL, { state });
                smell = true;
            } else affected = await animateStoneObject(object, x, y, golem, state);
        } else affected = 0;
    } else {
        const type = object.oclass === RING_CLASS ? MEAT_RING
            : object.oclass === WAND_CLASS ? MEAT_STICK
                : object.oclass === GEM_CLASS ? MEATBALL : null;
        if (type !== null) {
            await poly_obj(object, type, { state });
            smell = true;
        } else affected = 0;
    }
    if (smell) {
        const vegetarian = state.urole.key === 'monk' || !state.u.uconduct?.unvegetarian
            || !(requireMonsterData(MONSTER_FLAGS1, state.u.umonnum) & 0x20000000);
        await plineWithContinuation(vegetarian
            ? 'You smell the odor of meat.' : 'You smell a delicious smell.', { noRepeat: true });
    }
    await newsym(x, y);
    return affected;
}
async function animateStoneObject(
    object: GameObject, x: number, y: number, golem: boolean, state: PlayingGameState,
): Promise<number> {
    let species = representedSpecies(object);
    let monster: Monster | null;
    const flesh = golem && species !== PM_FLESH_GOLEM;
    if (object.otyp === STATUE) {
        ({ monster } = await animateStatue(object, x, y, { state, magic: true }));
    } else {
        if (flesh) species = PM_FLESH_GOLEM;
        monster = await makemonAt(species, x, y, NO_MINVENT | MM_NOMSG);
        if (monster) {
            const keeper = costlySpot(x, y, state)?.resident;
            if (keeper && (object.where === 'inventory' ? object.unpaid : !object.no_charge))
                await stolenValue(object, x, y, !!keeper.mpeaceful, { silent: false, state });
            stopObjectTimers(object, state);
            if (object.where === 'inventory') await consumeInventoryItem(object);
            else await delobj(object, state);
            if (cansee(monster.mx, monster.my))
                await plineWithContinuation(`The figurine ${flesh ? 'turns to flesh and ' : ''}animates!`);
        }
    }
    if (monster) {
        if (MONSTER_SYMBOL[monster.mnum] === S_GOLEM && monster.mnum !== PM_FLESH_GOLEM)
            await changeMonsterForm(monster, PM_FLESH_GOLEM);
        return 1;
    }
    if (requireMonsterData(MONSTER_GENO, species) & (0x0010 | 0x1000)) return 0;
    for (;;) {
        const content = object.contents?.[0];
        if (!content) break;
        bypassObject(content, state);
        unlinkObject(content, state);
        await placeObject(content, x, y, state);
    }
    await poly_obj(object, CORPSE, { state });
    return 1;
}
function representedSpecies(object: GameObject): number {
    if (object.corpsenm === undefined)
        throw new Error(`Object ${object.o_id} has no represented monster species`);
    return object.corpsenm;
}
