// Ray attacks, terrain changes, and elemental item damage.
// C ref: zap.c dobuzz(), zap_over_floor(), zhitm(), zhitu(), destroy_items(),
// learnwand(), zappable(), zapnodir(), backfire(), dozap(), zap_steed(),
// zap_updown(), weffects(), zap_map(), and bhit()'s ZAPPED_WAND branch.
import { objectMaterial } from './object_material.js';
import { convertSecretDoor, findit, revealSecretDoor, showMapSpot } from './detect.js';
import { bypassObjectList, nextUnbypassedObject } from './object_bypass.js';
import { formatFeltMessage, publishHeardMessage } from './hero_speech.js';
import { heroFaceName, heroFootName, heroHeadName } from './body_parts.js';
import { monsterHasMapPosition, monsterAtPosition } from './steed.js';
import { chooseInventoryObject } from './inventory_prompt.js';
import { GETOBJ_EXCLUDE, GETOBJ_SUGGEST, PLNMSG_ENVELOPED_IN_GAS, ZAP_POS, isok, ANTI_MAGIC, CORR, DBWALL, D_CLOSED, D_LOCKED, DOOR, DRAWBRIDGE_DOWN, ENGRAVE, EXPL_MAGICAL, HEADSTONE, HOLE, IS_FURNITURE, Is_airlevel, Invocation_lev, LEVEL_TELEP, MAGIC_PORTAL, MAGIC_TRAP, POLY_TRAP, SCORR, TELEP_TRAP, TRAPDOOR, TRAP_EXPLODE, VIBRATING_SQUARE, } from './const.js';
import { objectDirection } from './object_data.js';
import { zapHeroWithObject } from './hero_self_zap.js';
import { updateIceObjectTimersAt, placeCreatedObject, stack_object } from './floor_object.js';
import { isIceAt, isLavaAt, isMoatAt, isPoolAt } from './terrain_properties.js';
import { heroHasArtifactDefense, heroHasCarriedArtifactFlag } from './artifacts.js';
import { exerciseAttribute, exerciseWisdom, currentAttribute } from './attrib.js';
import { A_STR, A_INT, COLNO, DB_FLOOR, DB_ICE, DB_UNDER, DRAWBRIDGE_UP, FOUNTAIN, SHOP_BARS_COST, SHOP_DOOR_COST, D_BROKEN, D_NODOOR, HWALL, ICE, ICED_MOAT, ICED_POOL, IRONBARS, IS_WALL, IS_WATERWALL, Is_rogue_level, Is_waterlevel, ismnum, LAVAWALL, PIT, POOL, ROOM, ROWNO, SDOOR, TT_INFLOOR, TT_LAVA, Upolyd, VWALL, WEB, W_NONDIGGABLE, W_RING, } from './const.js';
import { canSeeMonster, displayColorName, displayLiquidName, docrt, glyphAt, newsym, shieldeff, unmap_invisible, } from './display.js';
import { plineWithContinuation } from './pline.js';
import { formatDraftMessage } from './draft_message.js';
import { ceilingName, surfaceName, waterbodyName } from './terrain_name.js';
import { resetPick } from './lock_context.js';
import { game, requireLiveGame } from './gstate.js';
import { monsterHasFireResistance, monsterHasShockResistance } from './mondata.js';
import { closeDrawbridge, destroyDrawbridge, findDrawbridgeAt, openDrawbridge } from './dbridge.js';
import { drawbridgeUnderlyingType } from './drawbridge_terrain.js';
import { SHOPBASE } from './const.js';
import { roomsAt } from './room.js';
import { setHeroTrap, triggerHeroTrap } from './hero_traps.js';
import { monsterName } from './do_name.js';
import { possessiveName } from './hacklib.js';
import { destroyObjectFromMonsterInventory } from './monworn.js';
import { loseHeroHp } from './hero_damage.js';
import { commandResultCancelled } from './command_state.js';
import { removeHeroAccessory } from './accessory.js';
import { removeHeroEquipment } from './hero_equipment.js';
import { rechargeRing } from './recharge.js';
import { finishHeroDeath } from './end.js';
import { meltIce } from './ice.js';
import { consumeInventoryItem, inventoryItemDescription } from './invent.js';
import { useUpInventoryStack } from './hero_inventory.js';
import { igniteItems, lightDamage, lightRoom } from './light.js';
import { buryFloorObjectsAt } from './buried_object.js';
import { deleteFloorTrap, maketrap, randomEngraving } from './mklev.js';
import { fix_wall_spines } from './mkmaze.js';
import { monsterHasSeductionAttack, monsterResistanceBits } from './mondata.js';
import { finishImmediateMonsterTrap, triggerImmediateMonsterTrap } from './trap.js';
import { makePlural, withIndefiniteArticle, armorUsesPairGrammar } from './object_grammar.js';
import { MONSTER_FLAGS1, MONSTER_LEVEL, MONSTER_MAGIC_RESISTANCE, MONSTER_NAME, monsterIsPlayerMonster, monsterIsWhirly, } from './monster_data.js';
import { DWARVISH_CLOAK, GLOB_OF_GREEN_SLIME, OBJECT_CHARGED, OBJECT_NAMES, OBJECT_PROPERTY, POT_OIL, POT_WATER, RIN_SHOCK_RESISTANCE, SCR_FIRE, SPE_BOOK_OF_THE_DEAD, SPE_FIREBALL, WAN_LIGHTNING, WAN_STRIKING, } from './object_data.js';
import { ROCK, SPE_CANCELLATION, SPE_CURE_SICKNESS, SPE_DETECT_UNSEEN, SPE_DIG, SPE_DRAIN_LIFE, SPE_EXTRA_HEALING, SPE_FINGER_OF_DEATH, SPE_FORCE_BOLT, SPE_HEALING, SPE_KNOCK, SPE_LIGHT, SPE_MAGIC_MISSILE, SPE_POLYMORPH, SPE_SLOW_MONSTER, SPE_STONE_TO_FLESH, SPE_TELEPORT_AWAY, SPE_WIZARD_LOCK, WAN_CANCELLATION, WAN_CREATE_MONSTER, WAN_DIGGING, WAN_ENLIGHTENMENT, WAN_LIGHT, WAN_LOCKING, WAN_MAGIC_MISSILE, WAN_MAKE_INVISIBLE, WAN_OPENING, WAN_POLYMORPH, WAN_PROBING, WAN_SECRET_DOOR_DETECTION, WAN_SLOW_MONSTER, WAN_SPEED_MONSTER, WAN_STASIS, WAN_TELEPORTATION, WAN_WISHING, } from './object_data.js';
import { learnObjectType, observeObject } from './object_knowledge.js';
import { objectResistsDestruction } from './object_state.js';
import { LEVEL_TIMER_KIND, scheduleLevelTimer, stopLevelTimer, } from './object_timers.js';
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
import { chargeUnpaidUsage, addShopDamage, payForShopDamage, objectTypeKnown } from './shk.js';
import { hasWornProperty } from './properties.js';
import { closedRayDoor } from './ray.js';
import { hitMonsterWithRay, zapRayWithObject } from './ray_attack.js';
import { heroIsBlind, heroIsDeaf, heroIsHallucinating } from './senses.js';
import { definiteObjectAction, killerObjectName, objectName, objectNameIsPlural, ownedObjectName, observeObjectForNaming, observeDistantObjectForNaming, pluralizeObjectNoun, } from './objnam.js';
import { delobj } from './object_delete.js';
import { useUpFloorObject } from './floor_consumption.js';
import { requirePlayingGame } from './gstate.js';
import { BOLT_LIM } from './const.js';
import { changeMonsterForm, copyPetData, normalizeMonsterShape, wakeMonster, maybeUnhideAt } from './mon.js';
import { revealMonsterAppearance } from './mon.js';
import { setMonsterPermanentInvisibility } from './worn.js';
import { redrawMonsterWormSegments } from './worm.js';
import { expelHero, holdingMonsterName } from './hero_expulsion.js';
import { adjustMonsterSpeed, monsterSpeedMessage } from './worn.js';
import { checkMonsterGearNextTurn } from './monworn.js';
import { monsterHasMagicResistance } from './anti_magic_trap.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { monsterHitPointsPerLevel, createCritters } from './makemon.js';
import { zapDigWithObject } from './digging_magic.js';
import { objectIsHardHelmet } from './armor.js';
import { impossible } from './diagnostics.js';
import { changeDoorByMagic } from './door_magic.js';
import { recordMappedOverviewState } from './dungeon.js';
import { forceDescribeDecor } from './dungeon_feature.js';
import { deleteEngravingAt, engravingAt, makeEngravingAt, wipeEngravingAt, relocateEngraving, } from './engrave.js';
import { addExperience } from './exper.js';
import { explode } from './explosion.js';
import { beginImmediateZap, finishImmediateZap, hitFloorPileWithWand, hitMonsterWithWand, hitObjectWithWand, } from './immediate_zap.js';
import { doEnlightenmentEffect } from './insight.js';
import { gotoLevel } from './level_change.js';
import { probeMonster, showProbedObjectInventory } from './magic_probe.js';
import { mksobj } from './mkobj.js';
import { okToQuest, onQuestStart } from './quest.js';
import { askTeleportDestination, heroControlsTeleport, teleportHero } from './teleport.js';
import { goodPosition } from './teleport_rules.js';
import { deleteTrap, trapName, closeHoldingTrap, openFallingTrap, openHoldingTrap, } from './trap.js';
import { makeWish } from './wish.js';
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
export function learnWand(object, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (object.oclass === 10)
        return; // Spell pseudo-objects do not rediscover books.
    if (objectTypeKnown(object, state))
        observeObject(object, state);
    else {
        if (!heroIsBlind(state))
            observeObject(object, state);
        if (object.dknown)
            learnObjectType(object.otyp, state);
    }
}
// C zap.c:zappable(). It removes a charge from the wand when one is left.
export async function zappable(wand, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    if (wand.spe < 0 || (wand.spe === 0 && rn2(121) !== 0))
        return false;
    if (wand.spe === 0)
        await plineWithContinuation('You wrest one last charge from the worn-out wand.');
    wand.spe--;
    return true;
}
// C zap.c zapnodir(), also the engrave command's no-direction wand effects.
export async function zapWithoutDirection(source, state) {
    let known = false;
    switch (source.otyp) {
        case WAN_LIGHT:
        case SPE_LIGHT:
            known = source.dknown && !heroIsBlind(state);
            await lightRoom(true, { finishMonsterKill: finishHeroMonsterKill });
            if (state.program_state.gameover)
                return;
            await lightDamage(source, true, 5, { state });
            break;
        case WAN_SECRET_DOOR_DETECTION:
        case SPE_DETECT_UNSEEN:
            known = !!source.dknown;
            await findit();
            break;
        case WAN_STASIS:
            state.level.flags.stasis_until = Math.max(state.level.flags.stasis_until || 0, state.moves + rn2(21) + 10);
            break;
        case WAN_CREATE_MONSTER:
            if (await createCritters(rn2(23) ? 1 : rn2(7) + 2))
                known = !!source.dknown;
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
        if (!objectTypeKnown(source, state))
            addExperience(0, 10, state);
        learnWand(source, { state });
    }
}
// C zap.c:backfire(). Native backfire differs from a failed recharge: every
// wand uses d6 here.
export async function backfireWand(wand, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    wand.in_use = true;
    await plineWithContinuation(`${definiteObjectAction(wand, null, state)} suddenly explodes!`);
    const damage = d(wand.spe + 2, 6);
    const injury = state.u.halfPhysicalDamage ? Math.ceil(damage / 2) : damage;
    if (await loseHeroHp(injury, 'exploding wand', {
        state, deathCause: 'killed by an exploding wand',
    }))
        return;
    await useUpInventoryStack(wand, state);
}
async function finishWandUse(wand) {
    if (!wand || wand.spe >= 0)
        return;
    await plineWithContinuation(`${definiteObjectAction(wand, 'turn')} to dust.`);
    await useUpInventoryStack(wand);
}
// C zap.c:dozap(). Selection/charges surround the shared effect transaction.
export async function dozap() {
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
    let wand = await chooseInventoryObject('zap', object => object?.oclass === WAND_CLASS ? GETOBJ_SUGGEST : GETOBJ_EXCLUDE);
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
    }
    else if (wand.cursed && rn2(100) === 0) {
        await backfireWand(wand);
        if (game.program_state.gameover)
            return;
        await exerciseAttribute(A_STR, false);
        game.context.move = 1;
        return;
    }
    else if (needsDirection && !await promptDirection()) {
        if (!heroIsBlind()) {
            await plineWithContinuation(`${definiteObjectAction(wand, null)} glows and fades.`);
        }
    }
    else if (needsDirection && !game.u.dx && !game.u.dy && !game.u.dz) {
        const effect = await zapHeroWithObject(wand);
        if (effect.heroDied)
            return;
        if (effect.damage) {
            const damage = game.u.halfPhysicalDamage ? Math.ceil(effect.damage / 2) : effect.damage;
            const cause = `zapped ${game.flags.female ? 'herself' : 'himself'} with ${killerObjectName(wand)}`;
            if (await loseHeroHp(damage, cause, { deathCause: cause }))
                return;
        }
    }
    else {
        game._currentWand = wand;
        await applyWandEffect(wand);
        wand = game._currentWand;
        game._currentWand = null;
    }
    if (game.program_state.gameover)
        return;
    await finishWandUse(wand);
    game.context.move = 1;
}
// C zap.c:zap_steed(). Zapping downwards while riding applies the wand to
// the steed first.
async function zapSteed(source, state) {
    const steed = state.u.usteed;
    if (!steed)
        return false;
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
async function zapVertically(source, state) {
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
            }
            else if (dz > 0 && onQuestStart(state) && !okToQuest(state)) {
                let stairs = state.stairs;
                while (stairs && (stairs.isladder || stairs.up || stairs.tolev.dnum !== state.u.uz.dnum))
                    stairs = stairs.next;
                if (stairs?.sx === x && stairs.sy === y) {
                    await plineWithContinuation('The stairs seem to ripple momentarily.');
                    disclose = true;
                }
            }
            if (state.program_state.gameover)
                return disclose;
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
    if (state.program_state.gameover)
        return disclose;
    if (dz > 0) {
        await hitFloorPileWithWand(source, x, y, { state, direction: dz });
        if (!state.program_state.gameover)
            await zapMapAt(x, y, source, { state });
    }
    else if (state.u.uundetected && heroFormHidesUnderObjects(state)) {
        const object = state.level.objects[state.u.ux]?.[state.u.uy]?.[0];
        if (object && await hitObjectWithWand(object, source, { state })) {
            await maybeUnhideAt(state.u.ux, state.u.uy, state);
            disclose = true;
        }
    }
    return disclose;
}
async function strikeOrLockVertically(source, x, y, trap, state) {
    const striking = [WAN_STRIKING, SPE_FORCE_BOLT].includes(source.otyp);
    const { dz = 0 } = state.u, location = state.level.at(x, y);
    if (!location)
        throw new Error(`No map location at ${x},${y}`);
    const bridge = findDrawbridgeAt(x, y, state);
    if (bridge && (location.typ === DRAWBRIDGE_DOWN ? dz > 0 : location.typ === DOOR)) {
        if (striking)
            await destroyDrawbridge(bridge.x, bridge.y, state);
        else
            await closeDrawbridge(bridge.x, bridge.y, state);
        return true;
    }
    if (striking && dz < 0 && rn2(3) && !Is_airlevel(state.u.uz)
        && !Is_waterlevel(state.u.uz) && !(state.underwater || state.u.uinwater) && !onQuestStart(state)) {
        await plineWithContinuation(`A rock is dislodged from the ${ceilingName(x, y, state)} and falls on your ${heroHeadName(state)}.`);
        let damage = rnd(objectIsHardHelmet(state.uarmh || state.u.uarmh) ? 2 : 6);
        if (state.u.halfPhysicalDamage)
            damage = Math.ceil(damage / 2);
        if (await loseHeroHp(damage, 'falling rock', { state }))
            return false;
        const rock = await mksobj(ROCK, false, false);
        await placeCreatedObject(rock, x, y, state);
        observeObjectForNaming(rock, { state });
        await stack_object(rock, state);
        await newsym(x, y);
        return false;
    }
    if (dz <= 0 || !trap)
        return false;
    if (!striking) {
        const effect = await closeHoldingTrap(state.u, { state });
        if (effect.changed)
            return effect.noticed;
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
        if (heroIsBlind(state) || !trap.tseen)
            await plineWithContinuation(`Some ${isIceAt(x, y, state) ? 'frost' : 'dust'} swirls beneath you.`);
        else {
            trap.tseen = 1;
            await newsym(x, y);
            await plineWithContinuation('A trapdoor appears beneath you.');
            return true;
        }
    }
    return false;
}
async function fleshOnTerrain(x, y, state) {
    const { dz = 0 } = state.u;
    if (Is_airlevel(state.u.uz) || Is_waterlevel(state.u.uz) || state.underwater || state.u.uinwater
        || (onQuestStart(state) && dz < 0))
        await plineWithContinuation('Nothing happens.');
    else if (dz < 0)
        await plineWithContinuation(`Blood drips on your ${heroFaceName(state)}.`);
    else if (!state.level.objects[x]?.[y]?.length && engravingAt(x, y)?.engr_type !== ENGRAVE) {
        if (isPoolAt(x, y, state) || isIceAt(x, y, state))
            await plineWithContinuation('Nothing happens.');
        else
            await plineWithContinuation(`Blood ${isLavaAt(x, y, state) ? 'boils' : 'pools'} ${state.u.levitating ? 'beneath' : 'at'} your ${makePlural(heroFootName(state))}.`);
    }
}
async function probeVertically(source, x, y, state) {
    let found = 0;
    if ((state.u.dz ?? 0) < 0)
        await plineWithContinuation(`You probe towards the ${ceilingName(x, y, state)}.`);
    else {
        recordMappedOverviewState();
        const location = state.level.at(x, y);
        if (!location)
            throw new Error(`No map location at ${x},${y}`);
        const remembered = location.lastseentyp;
        found += await hitFloorPileWithWand(source, x, y, { state, direction: state.u.dz ?? 0 });
        const surface = location.typ === DRAWBRIDGE_UP
            ? drawbridgeUnderlyingType(location.drawbridgemask ?? 0) : location.typ;
        await zapMapAt(x, y, source, { state });
        const furniture = surface === ICE || IS_FURNITURE(surface);
        if (furniture && remembered !== location.lastseentyp)
            found++;
        await plineWithContinuation(`You probe beneath ${furniture ? 'it' : `the ${surfaceName(x, y, state)}`}.`);
        found += await displayBuriedInventory(x, y, state);
    }
    if (!found)
        await plineWithContinuation('Your probe reveals nothing.');
}
async function displayBuriedInventory(x, y, state) {
    const pile = state.level.objects[x]?.[y] || [];
    let underwhat = 'here', count = 0;
    if ((isPoolAt(x, y, state) || isLavaAt(x, y, state)) && !(state.underwater || state.u.uinwater) && pile.length) {
        const liquid = displayLiquidName(isPoolAt(x, y, state) ? 'water' : 'lava', state);
        count = pile.length;
        if (pile.length === 1) {
            const object = pile[0];
            if (!object)
                throw new Error('A visible one-object pile must contain its object.');
            const plural = objectNameIsPlural(object, state);
            await plineWithContinuation(`There ${plural ? 'are' : 'is'} ${await inventoryItemDescription(object)} under the ${liquid} here.`);
            underwhat = plural || armorUsesPairGrammar(OBJECT_NAMES[object.otyp] ?? '') ? 'under them' : 'beneath it';
        }
        else {
            await showProbedObjectInventory(pile, `Things that are under the ${liquid} here:`, { state, groupByClass: false });
            underwhat = 'beneath them';
        }
    }
    const buried = (state.level.buriedObjects || []).filter(object => object.ox === x && object.oy === y);
    for (const object of buried)
        observeObject(object, state);
    if (buried.length)
        await showProbedObjectInventory(buried, `Things that are buried ${underwhat}:`, { state });
    return count + buried.length;
}
// C zap.c:weffects(). Zapping and spell casting share the effect dispatch;
// callers own charge use and direction input.
export async function applyWandEffect(source, { state = game } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u, type = source.otyp, direction = objectDirection(type, state);
    const unknown = !objectTypeKnown(source, state);
    let disclose = false;
    exerciseWisdom(true, state);
    if (hero.usteed && direction !== NODIR && !hero.dx && !hero.dy
        && (hero.dz ?? 0) > 0 && await zapSteed(source, state)) {
        disclose = true;
    }
    else if (direction === IMMEDIATE) {
        beginImmediateZap(state);
        if (hero.uswallow) {
            if (!hero.ustuck)
                throw new Error('A swallowed hero must have an engulfing monster.');
            await hitMonsterWithWand(hero.ustuck, source, { state });
        }
        else if (hero.dz)
            disclose = await zapVertically(source, state);
        else
            await traceImmediateZap(source, rn2(8) + 6, state);
        if (!state.program_state.gameover)
            await finishImmediateZap(state);
    }
    else if (direction === NODIR) {
        await zapWithoutDirection(source, state);
    }
    else {
        if (type === WAN_DIGGING || type === SPE_DIG)
            await zapDigWithObject(source, { state });
        else if ((type >= SPE_MAGIC_MISSILE && type <= SPE_FINGER_OF_DEATH)
            || (type >= WAN_MAGIC_MISSILE && type <= WAN_LIGHTNING)) {
            await zapRayWithObject(source, { state });
        }
        else
            await impossible('weffects: unexpected spell or wand');
        disclose = true;
    }
    if (disclose && !state.program_state.gameover) {
        learnWand(source, { state });
        if (unknown)
            addExperience(0, 10, state);
    }
}
// C zap.c:zap_map(). Terrain is affected before occupants and floor piles.
export async function zapMapAt(x, y, source, { state = game } = {}) {
    requirePlayingGame(state);
    let learned = await cancelMagicTrap(x, y, source, state);
    if (state.program_state.gameover)
        return;
    const trap = state.level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if ((state.u.dz ?? 0) > 0)
        await zapEngraving(x, y, source, state);
    else if (!state.u.dz)
        learned = await zapDrawbridge(x, y, source, state) || learned;
    if (state.program_state.gameover)
        return;
    if (source.otyp === WAN_PROBING)
        learned = await probeTerrain(x, y, trap, learned, state);
    if (learned)
        learnWand(source, { state });
}
async function cancelMagicTrap(x, y, source, state) {
    if (![WAN_CANCELLATION, SPE_CANCELLATION].includes(source.otyp))
        return false;
    const trap = state.level.traps.find(candidate => candidate.tx === x && candidate.ty === y);
    if (!trap)
        return false;
    if ([MAGIC_PORTAL, VIBRATING_SQUARE].includes(trap.ttyp)) {
        await shieldeff(x, y);
        if (!cansee(x, y))
            return false;
        trap.tseen = 1;
        await newsym(x, y);
        return true;
    }
    if (![TELEP_TRAP, LEVEL_TELEP, MAGIC_TRAP, ANTI_MAGIC, POLY_TRAP].includes(trap.ttyp))
        return false;
    const visible = cansee(x, y);
    await explode(x, y, -WAN_CANCELLATION, 20 + d(3, 6), TRAP_EXPLODE, EXPL_MAGICAL, { state });
    deleteTrap(trap, state);
    await newsym(x, y);
    return visible;
}
async function zapEngraving(x, y, source, state) {
    const engraving = engravingAt(x, y, state.level);
    if (!engraving || engraving.engr_type === HEADSTONE)
        return;
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
            if (engraving.engr_type !== ENGRAVE)
                break;
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
async function zapDrawbridge(x, y, source, state) {
    const originalType = state.level.requireAt(x, y).typ;
    const bridge = findDrawbridgeAt(x, y, state);
    if (!bridge)
        return false;
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
function sameGlyph(left, right) {
    if (left === right)
        return true;
    if (!left || !right || left.kind !== right.kind)
        return false;
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
async function probeTerrain(x, y, trap, learned, state) {
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
        }
        else if (Is_rogue_level(state.u.uz))
            await plineWithContinuation(formatDraftMessage(false, state));
    }
    else if (surface === SCORR) {
        location.typ = CORR;
        vision_note_blocker_change(x, y);
        await newsym(x, y);
        await plineWithContinuation('Probing exposes a secret corridor.');
        learned = true;
    }
    else if ((surface === ICE || IS_FURNITURE(surface)) && (state.u.dz ?? 0) > 0) {
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
function glyphCharacter(glyph) {
    return glyph && 'ch' in glyph && typeof glyph.ch === 'string' ? glyph.ch : undefined;
}
// C zap.c:bhit(), ZAPPED_WAND branch: a beam-limited walk over the map,
// monsters, floor piles, and doors.
async function traceImmediateZap(source, range, state) {
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
        if (state.program_state.gameover)
            return;
        const location = state.level.at(x, y);
        if (!location)
            throw new Error(`No map location at ${x},${y}`);
        const type = location.typ;
        const monster = monsterAtPosition(state.level, x, y);
        if (monster) {
            state.notonhead = x !== monster.mx || y !== monster.my;
            if (await hitMonsterWithWand(monster, source, { state, x, y }))
                return;
            range -= 3;
        }
        else if (source.otyp === WAN_PROBING && location.remembered_glyph?.kind === 'invisible') {
            await unmap_invisible(x, y);
        }
        if (state.program_state.gameover)
            return;
        if (await hitFloorPileWithWand(source, x, y, { state }))
            range--;
        if (state.program_state.gameover)
            return;
        if ((type === DOOR || type === SDOOR)
            && [WAN_OPENING, WAN_LOCKING, WAN_STRIKING, SPE_KNOCK, SPE_WIZARD_LOCK, SPE_FORCE_BOLT].includes(source.otyp)
            && await changeDoorByMagic(source, x, y, { state })) {
            if (cansee(x, y) || (source.otyp === WAN_STRIKING && !heroIsDeaf(state)))
                learnWand(source, { state });
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
    if (shopDoor)
        await payForShopDamage('destroy', { state });
}
function floorObjectBurns(object) {
    return object?.otyp === GLOB_OF_GREEN_SLIME
        || object?.oclass === SCROLL_CLASS
        || object?.oclass === SPBOOK_CLASS;
}
async function removeBurnedFloorQuantity(object, count, state, heroCaused, publish) {
    const quantity = object.quan ?? object.quantity ?? 1;
    if (!heroCaused && count < quantity) {
        object.quan = quantity - count;
        object.quantity = object.quan;
        object.owt = objectWeight(object);
        return;
    }
    if (heroCaused)
        await useUpFloorObject(object, count, { state, publish });
    else
        await delobj(object, state);
}
function floorBurnMessage(object, destroyed, state) {
    if (object.ox === state.u.ux && object.oy === state.u.uy)
        observeObjectForNaming(object, { state });
    else
        observeDistantObjectForNaming(object, state);
    const name = objectName({ ...object, quan: 1, quantity: 1 }, state);
    if (destroyed > 1)
        return `${destroyed} ${pluralizeObjectNoun(object, name)} burn.`;
    const subject = withIndefiniteArticle(name);
    return `${subject.charAt(0).toUpperCase()}${subject.slice(1)} burns.`;
}
// C zap.c:burn_floor_objects().
export async function burnFloorObjectsAt(x, y, { state = game, giveFeedback = false, heroCaused = false, publish = plineWithContinuation, random = rn2, visible = cansee(x, y), repaint = newsym, } = {}) {
    const pile = state.level?.objects?.[x]?.[y] || [];
    let burned = 0;
    for (const object of [...pile]) {
        if (!floorObjectBurns(object)
            || object.otyp === SCR_FIRE
            || object.otyp === SPE_FIREBALL
            || objectResistsDestruction(object, 2, 100, random))
            continue;
        const quantity = object.quan ?? object.quantity ?? 1;
        let destroyed = 0;
        for (let index = 0; index < quantity; index++) {
            if (random(3) === 0)
                destroyed++;
        }
        if (!destroyed)
            continue;
        const feedback = giveFeedback ? floorBurnMessage(object, destroyed, state) : null;
        await removeBurnedFloorQuantity(object, destroyed, state, heroCaused, publish);
        burned += destroyed;
        if (feedback)
            await publish(feedback);
    }
    await igniteItems(pile, {
        state,
        publish,
        random,
        visible,
    });
    if (burned && couldsee(x, y))
        await repaint(x, y);
    return burned;
}
// C zap.c:start_melt_ice_timeout().
export function startMeltIceTimer(x, y, minimumTime = 0, state = game, random = rn2) {
    let delay = Math.max(minimumTime, 49);
    while (++delay <= 2000) {
        if (random(2000 - delay + 50) === 0)
            break;
    }
    if (delay > 2000)
        return null;
    return scheduleLevelTimer(x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY, (state.moves ?? 0) + delay, state);
}
function firmExistingIce(x, y, state = game) {
    const timer = state.level?.levelTimers?.find(candidate => candidate.x === x && candidate.y === y
        && candidate.kind === LEVEL_TIMER_KIND.MELT_ICE_AWAY);
    if (!timer)
        return;
    const remaining = Math.max(0, timer.deadline - (state.moves ?? 0));
    stopLevelTimer(x, y, LEVEL_TIMER_KIND.MELT_ICE_AWAY, state);
    startMeltIceTimer(x, y, remaining, state);
}
function liquidMonsterAt(x, y, state = game) {
    return state.level?.monsters?.find(monster => monsterHasMapPosition(monster, state) &&
        (monster.mhp ?? 1) > 0 && monster.mx === x && monster.my === y) || null;
}
async function revealStrandedSwimmer(x, y, state = game) {
    const monster = liquidMonsterAt(x, y, state);
    if (!monster || !monster.mundetected
        || !((MONSTER_FLAGS1[monster.mnum] ?? 0) & 0x00000002))
        return;
    monster.mundetected = 0;
    await newsym(x, y);
}
async function freezeLiquidAt(x, y, state, publish) {
    const location = state.level?.at(x, y);
    if (!location)
        return 0;
    if (isIceAt(x, y, state)) {
        firmExistingIce(x, y, state);
        return 0;
    }
    const lavaWall = location.typ === LAVAWALL;
    const lava = isLavaAt(x, y, state);
    if (!isPoolAt(x, y, state) && !lava)
        return 0;
    const visible = cansee(x, y);
    const temperature = state.level?.flags?.temperature || 0;
    const briefFreeze = IS_WATERWALL(location.typ)
        || (lavaWall && rn2(Math.max(2, 5 + temperature * 10)) !== 0);
    if (briefFreeze) {
        if (visible) {
            await publish(`The ${displayLiquidName(lavaWall ? 'lava' : 'water', state)} freezes for a moment.`);
        }
        else {
            await publishHeardMessage('a soft crackling.', publish, state);
        }
        return -1000;
    }
    const waterbody = waterbodyName(x, y, state);
    const wasMoat = isMoatAt(x, y, state);
    if (location.typ === DRAWBRIDGE_UP) {
        location.drawbridgemask = (location.drawbridgemask ?? 0) & ~DB_UNDER;
        location.drawbridgemask |= lava ? DB_FLOOR : DB_ICE;
    }
    else {
        location.icedpool = lava ? 0
            : location.typ === POOL ? ICED_POOL : ICED_MOAT;
        if (lavaWall) {
            const north = state.level?.at(x, y - 1);
            const south = state.level?.at(x, y + 1);
            location.typ = !!north && IS_WALL(north.typ) || !!south && IS_WALL(south.typ)
                ? VWALL : HWALL;
            fix_wall_spines(Math.max(0, x - 1), Math.max(0, y - 1), Math.min(COLNO - 1, x + 1), Math.min(ROWNO - 1, y + 1));
        }
        else {
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
    }
    else if (!lava) {
        await publishHeardMessage('a crackling sound.', publish, state);
    }
    if (state.u?.ux === x && state.u?.uy === y) {
        if (state.u.uinwater) {
            state.u.uinwater = 0;
            state.u.uundetected = 0;
            await docrt();
            state.vision_full_recalc = 1;
        }
        else if (state.u.utrap && state.u.utraptype === TT_LAVA) {
            if (state.u.passesWalls) {
                await publish('You pass through the now-solid rock.');
                await resetHeroTrap(true, state);
            }
            else {
                setHeroTrap(rn1(50, 20), TT_INFLOOR, state);
                await publish('You are firmly stuck in the cooling rock.');
            }
        }
    }
    else {
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
async function evaporatePoolAt(x, y, state, publish, heroCaused) {
    const location = state.level?.at(x, y);
    if (!location || !isPoolAt(x, y, state))
        return 0;
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
        if (visible)
            message = 'The water evaporates.';
    }
    else if (waterLevel) {
        message = visible || !deaf ? 'Some water boils.' : null;
    }
    else if (visible) {
        message = 'Some water evaporates.';
    }
    if (message && !enveloped)
        await publish(message, { noRepeat: true });
    if (location.typ === ROOM) {
        await revealStrandedSwimmer(x, y, state);
        await newsym(x, y);
        const monster = liquidMonsterAt(x, y, state);
        if (pit && state.u.ux === x && state.u.uy === y)
            await triggerHeroTrap(pit);
        else if (pit && monster) {
            requirePlayingGame(state);
            await finishImmediateMonsterTrap(await triggerImmediateMonsterTrap(monster, state), state, { publish });
        }
    }
    return rangeChange;
}
export async function applyRayFloorFeatures(kind, x, y, state = game, { rayNoun = 'bolt', random = rn2, heroCaused = true, explodingWand = 0, heroBurnsObjects = heroCaused, publish = plineWithContinuation } = {}) {
    const location = state.level?.at(x, y);
    if (!location)
        return { absorbed: false, rangeChange: 0 };
    const visible = cansee(x, y);
    let rangeChange = 0;
    let shopDamage = false;
    const yourRay = heroCaused && !explodingWand;
    const wandType = [POT_OIL, SCR_FIRE].includes(explodingWand) ? 0 : explodingWand;
    if (kind === RAY_FIRE) {
        const web = state.level?.traps?.find(candidate => candidate.tx === x && candidate.ty === y && candidate.ttyp === WEB);
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
    }
    else if (kind === RAY_FIRE) {
        rangeChange += await evaporatePoolAt(x, y, state, publish, heroCaused);
    }
    if (state.program_state.gameover)
        return { absorbed: false, rangeChange };
    if (kind === RAY_FIRE && location.typ === FOUNTAIN) {
        await createPoisonGasCloud(state, x, y, rnd(3), 0, random, publish);
        if (visible)
            await publish('Steam billows from the fountain.');
        rangeChange--;
        await dryFountainAt(x, y, { causedByHero: heroBurnsObjects, state, publish, random });
    }
    else if (kind === RAY_COLD) {
        rangeChange += await freezeLiquidAt(x, y, state, publish);
    }
    else if (kind === 'poison' && ZAP_POS(location.typ)) {
        await createPoisonGasCloud(state, x, y, 1, 8, random, publish);
    }
    const damagesBars = location.typ === IRONBARS
        && (kind === RAY_ACID || (kind === RAY_LIGHTNING && random(10) === 0));
    if (damagesBars) {
        const action = kind === RAY_ACID ? 'corrode' : 'melt';
        if ((location.wall_info ?? 0) & W_NONDIGGABLE) {
            if (visible) {
                await publish(`The iron bars ${action} somewhat but remain intact.`, { noRepeat: true });
            }
        }
        else {
            rangeChange -= 3;
            // The message can pause at --More-- with the beam over intact bars.
            if (visible) {
                await publish(`The iron bars ${action}${kind === RAY_ACID ? ' away' : ''}.`, { noRepeat: true });
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
            await publish(`${yourRay ? 'Your' : 'The'} ${rayNoun} reveals a secret door.`);
        }
        else if (Is_rogue_level(state.u.uz)) {
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
            }
            else if (wandType === WAN_STRIKING) {
                await publish('You feel a burst of cool air.');
            }
            else if (kind === RAY_FIRE) {
                await publish('You smell smoke.');
            }
            else if (kind === RAY_COLD) {
                await publishHeardMessage('a deep cracking sound.', publish, state);
            }
            else {
                await publishHeardMessage(kind === RAY_DISINTEGRATION ? 'crashing wood.' : 'crackling.', publish, state);
            }
            const occupation = state._occupation;
            if (occupation?.key === 'pick-lock' && occupation.door === location) {
                await stopHeroOccupation(state, publish);
                resetPick(state);
            }
        }
        else if (visible) {
            await publish(wandType ? 'The door remains intact.'
                : `The door absorbs ${yourRay ? 'your' : 'the'} ${rayNoun}!`);
        }
        else {
            await publish(formatFeltMessage('vibrations.', state));
        }
    }
    if (absorbed)
        rangeChange = -1000;
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
function destroyedDoorMessage(kind) {
    if (kind === RAY_FIRE)
        return 'The door is consumed in flames!';
    if (kind === RAY_COLD)
        return 'The door freezes and shatters!';
    if (kind === RAY_DISINTEGRATION)
        return 'The door disintegrates!';
    return 'The door splinters!';
}
export function applyFireToFloorAt(x, y, state = game) {
    return applyRayFloorFeatures(RAY_FIRE, x, y, state);
}
export function monsterHasElementalResistance(monster, mask) {
    return !!(monsterResistanceBits(monster) & mask);
}
export { hitMonsterWithRay, zapRayWithObject };
function destroyable(object, damageType) {
    if (!object || object.artifact || object.oartifact)
        return false;
    const quantity = object.quan ?? object.quantity ?? 1;
    if (object.in_use && quantity === 1)
        return false;
    const itemClass = object.oclass;
    if (damageType === INVENTORY_DAMAGE.FIRE) {
        if ([SCR_FIRE, SPE_FIREBALL].includes(object.otyp))
            return false;
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
function protectionChance(state, damageType) {
    const hero = state.u;
    const properties = {
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
function heroResists(state, damageType) {
    if (heroHasArtifactDefense(damageType, state))
        return true;
    const hero = state.u;
    if (damageType === INVENTORY_DAMAGE.FIRE)
        return !!(hero.fireResistance);
    if (damageType === INVENTORY_DAMAGE.ELECTRIC)
        return !!(hero.shockResistance);
    return false;
}
function isWornRing(object, state) {
    return object === state.uleft || object === state.uright
        || object === state.u?.uleft || object === state.u?.uright
        || ((object?.owornmask ?? 0) & W_RING) !== 0;
}
function glovesBlockRingShock(object, state) {
    if (!isWornRing(object, state))
        return false;
    const gloves = state.uarmg || state.u?.uarmg;
    if (!gloves)
        return false;
    const material = objectMaterial(gloves.otyp);
    return material < 11 || material > 17;
}
function destructionMessage(object, damageType, count, quantity, state = game) {
    const one = count === 1;
    const prefix = one ? (quantity === 1 ? '' : 'One of ')
        : count < quantity ? 'Some of ' : quantity === 2 ? 'Both of ' : 'All of ';
    // C destroy_items() uses yname()/Yname2(), whose mon_owns() names a pet as "your".
    const name = ownedObjectName(object, state, { capitalized: !prefix });
    if (damageType === INVENTORY_DAMAGE.COLD) {
        return `${prefix}${name} ${one ? 'freezes and shatters' : 'freeze and shatter'}!`;
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
function itemDamage(object, damageType, rollOne) {
    if (damageType === INVENTORY_DAMAGE.COLD)
        return rollOne(4);
    if (damageType === INVENTORY_DAMAGE.ELECTRIC)
        return object.oclass === WAND_CLASS ? rollOne(10) : 0;
    if (object.oclass === POTION_CLASS)
        return rollOne(6);
    if (object.otyp === GLOB_OF_GREEN_SLIME)
        return Math.trunc(((object.owt ?? 1) + 19) / 20);
    return 1;
}
function destroyedItemKiller(object, damageType, count) {
    let killer;
    if (damageType === INVENTORY_DAMAGE.COLD)
        killer = 'shattered potion';
    else if (damageType === INVENTORY_DAMAGE.ELECTRIC)
        killer = 'exploding wand';
    else if (object.oclass === POTION_CLASS)
        killer = object.otyp === POT_OIL ? 'exploding potion' : 'boiling potion';
    else if (object.otyp === GLOB_OF_GREEN_SLIME)
        killer = 'exploding glob of slime';
    else
        killer = object.oclass === SPBOOK_CLASS ? 'burning book' : 'burning scroll';
    return count === 1 ? killer : makePlural(killer);
}
async function destroyChosenItem(object, damageType, { state, publish, random, rollOne, die, }) {
    const unharmed = { damage: 0, heroDied: false };
    const protection = protectionChance(state, damageType);
    if (protection && random(100) < protection)
        return unharmed;
    if (damageType === INVENTORY_DAMAGE.FIRE
        && object.otyp === SPE_BOOK_OF_THE_DEAD) {
        if (!heroIsBlind(state)) {
            observeObject(object, state);
            await publish(`The ${objectName(object, state)} glows a strange ${displayColorName('dark red', state)}, but remains intact.`);
        }
        return unharmed;
    }
    if (damageType === INVENTORY_DAMAGE.ELECTRIC
        && object.oclass === RING_CLASS) {
        if (glovesBlockRingShock(object, state))
            return unharmed;
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
        if (random(3) === 0)
            destroyed++;
    }
    if (!destroyed)
        return unharmed;
    if (!heroIsBlind(state))
        observeObject(object, state);
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
        if (state.program_state.gameover)
            return { damage: 0, heroDied: true };
    }
    else if (object.owornmask)
        await removeHeroEquipment(object, state);
    if (state._currentWand === object)
        state._currentWand = null;
    for (let count = 0; count < destroyed; count++) {
        await consumeInventoryItem(object, state);
        if (state.program_state.gameover)
            return { damage: 0, heroDied: true };
    }
    if (!damage)
        return unharmed;
    if (resistant && resistanceStopsDamage) {
        await publish("You aren't hurt!");
        return unharmed;
    }
    const heroDied = await loseHeroHp(damage, killer, {
        state, publish, die,
        deathCause: destroyed > 1 ? `killed by ${killer}` : null,
    });
    if (!heroDied)
        await exerciseAttribute(A_STR, false, state);
    return { damage, heroDied };
}
export async function destroyInventoryByElement(damageType, sourceDamage, { state = game, publish = plineWithContinuation, random = rn2, rollOne = rnd, die = finishHeroDeath, } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const result = { damage: 0, heroDied: false };
    const limit = destructionLimit(sourceDamage, random);
    if (!limit)
        return result;
    const chosen = chooseStacks(state.inventory, damageType, limit, random, state)
        .map(object => ({ object, deferred: deferHeroItemDestruction(object, state) }));
    if (damageType !== 'cold' && damageType !== 'fire' && damageType !== 'electric') {
        bypassObjectList(state.inventory, false, state);
        return result;
    }
    for (const deferred of [false, true]) {
        for (const entry of chosen) {
            if (entry.deferred !== deferred || !state.inventory.includes(entry.object))
                continue;
            const hit = await destroyChosenItem(entry.object, damageType, {
                state, publish, random, rollOne, die,
            });
            result.damage += hit.damage;
            if (hit.heroDied)
                return { damage: result.damage, heroDied: true };
        }
    }
    bypassObjectList(state.inventory, false, state);
    return result;
}
function deferHeroItemDestruction(object, state) {
    const property = OBJECT_PROPERTY[object.otyp];
    return (!!object.owornmask && (property === 'levitation' || property === 'flying'))
        || (object.otyp === POT_WATER && ismnum(state.u.ulycn)
            && !!(Upolyd(state.u) ? object.blessed : object.cursed));
}
function destructionLimit(sourceDamage, random) {
    let limit = Math.trunc(sourceDamage / 5);
    if (sourceDamage % 5 > random(5))
        limit++;
    return Math.max(0, Math.min(MAX_ITEMS_DESTROYED, limit));
}
function chooseStacks(objects, damageType, limit, random, state) {
    const chosen = Array.from({ length: limit }, () => null);
    let eligible = 0;
    // Even a non-elemental blast traverses inventory and activates bypasses.
    bypassObjectList(objects, false, state);
    let object;
    while ((object = nextUnbypassedObject(objects, state))) {
        if (!destroyable(object, damageType))
            continue;
        const index = eligible < limit ? eligible : random(eligible);
        eligible++;
        if (index < limit)
            chosen[index] = object;
    }
    return chosen.slice(0, Math.min(eligible, limit)).filter((object) => object !== null);
}
async function removeMonsterQuantity(monster, object, count, state, publish) {
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
export async function destroyMonsterInventoryByElement(monster, damageType, sourceDamage, { state = game, publish = plineWithContinuation, random = rn2, rollOne = rnd, visible = false, } = {}) {
    const limit = destructionLimit(sourceDamage, random);
    if (!limit)
        return 0;
    const inventory = monster?.minvent || monster?.inventory || [];
    const chosen = chooseStacks(inventory, damageType, limit, random, state);
    if (damageType !== 'cold' && damageType !== 'fire' && damageType !== 'electric') {
        bypassObjectList(inventory, false, state);
        return 0;
    }
    let damage = 0;
    for (const object of chosen) {
        if (!inventory.includes(object))
            continue;
        if (damageType === INVENTORY_DAMAGE.FIRE
            && object.otyp === SPE_BOOK_OF_THE_DEAD) {
            if (visible) {
                observeDistantObjectForNaming(object, state);
                await publish(`The ${objectName(object, state)} glows a strange ${displayColorName('dark red', state)}, but remains intact.`);
            }
            continue;
        }
        // Native does not recharge a monster's charged ring, but that outcome
        // still spares the ring and skips its destruction roll.
        if (damageType === INVENTORY_DAMAGE.ELECTRIC
            && object.oclass === RING_CLASS
            && OBJECT_CHARGED[object.otyp] && random(3) !== 0)
            continue;
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
            if (random(3) === 0)
                destroyed++;
        }
        if (!destroyed)
            continue;
        if (visible) {
            observeObjectForNaming(object, { state });
            await publish(destructionMessage(object, damageType, destroyed, quantity, state));
        }
        await removeMonsterQuantity(monster, object, destroyed, state, publish);
        if (!resistsItemDamage)
            damage += stackDamage;
    }
    bypassObjectList(monster.minvent ?? monster.inventory ?? [], false, state);
    return damage;
}
export function destroyColdMonsterInventory(monster, sourceDamage, options = {}) {
    return destroyMonsterInventoryByElement(monster, INVENTORY_DAMAGE.COLD, sourceDamage, options);
}
export function destroyFireMonsterInventory(monster, sourceDamage, options = {}) {
    return destroyMonsterInventoryByElement(monster, INVENTORY_DAMAGE.FIRE, sourceDamage, options);
}
export function destroyFireInventory(sourceDamage, options = {}) {
    return destroyInventoryByElement(INVENTORY_DAMAGE.FIRE, sourceDamage, options);
}
export function destroyColdInventory(sourceDamage, options = {}) {
    return destroyInventoryByElement(INVENTORY_DAMAGE.COLD, sourceDamage, options);
}
export function destroyElectricInventory(sourceDamage, options = {}) {
    return destroyInventoryByElement(INVENTORY_DAMAGE.ELECTRIC, sourceDamage, options);
}
// The make-invisible wand against a monster. C zap.c:bhitm().
function knownInvisible(monster, state = game) {
    if (!monster.minvis)
        return false;
    const hero = state.u;
    if (cansee(monster.mx, monster.my) && (hero.seeInvisible
        || (hero.seeInvisibleTurns ?? 0) > 0
        || hero.detectMonsters || state.detectMonsters))
        return true;
    const hasSightedTelepathy = (hero.unblind_telepat_range ?? -1) >= 0
        || state.uarmh?.otyp === 100 || state.uamul?.otyp === 201;
    const distance = (monster.mx - hero.ux) ** 2 + (monster.my - hero.uy) ** 2;
    return !heroIsBlind(state) && hasSightedTelepathy && distance <= BOLT_LIM ** 2;
}
export async function makeMonsterInvisible(monster) {
    const wasInvisible = !!monster.minvis;
    const wasVisible = canSeeMonster(monster);
    await revealMonsterAppearance(monster);
    const name = monsterName(monster, { capitalized: true });
    setMonsterPermanentInvisibility(monster);
    if (!monster.invis_blkd) {
        await newsym(monster.mx, monster.my);
        if (monster.wormno)
            await redrawMonsterWormSegments(monster);
    }
    let identified = false;
    if (!wasInvisible && knownInvisible(monster)) {
        await plineWithContinuation(`${name} turns transparent!`);
        identified = true;
    }
    else if (wasVisible
        && !canSeeMonster(monster)) {
        await plineWithContinuation(`${name} vanishes!`);
    }
    await wakeMonster(monster, { attacked: true });
    return identified;
}
export async function affectMonsterSpeed(monster, kind, source, state, options) {
    const attackLevel = source === 'wand' ? 12 : state.u?.ulevel ?? 1;
    const resisted = monsterResistsEffect(monster, attackLevel, options.random);
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
const POTION_ATTACK_LEVEL = 6;
const PM_LONG_WORM = MONSTER_NAME.indexOf('long worm');
function survived(monster) {
    return !monster.dead && (monster.mhp ?? 0) > 0;
}
function alreadyChangedThisAttack(monster) {
    const corpseSpecies = monster.mcorpsenm;
    const extraCorpseSpecies = monster.mextra?.mcorpsenm;
    return (corpseSpecies !== undefined && Number.isInteger(corpseSpecies) && corpseSpecies >= 0)
        || (extraCorpseSpecies !== undefined && Number.isInteger(extraCorpseSpecies)
            && extraCorpseSpecies >= 0);
}
function markNewLongWorm(monster, state) {
    if (monster.mnum !== PM_LONG_WORM)
        return;
    if (!monster.mextra)
        monster.mextra = {};
    monster.mextra.mcorpsenm = PM_LONG_WORM;
    state.context.bypasses = true;
}
export async function polymorphMonsterFromMagic(monster, { state = game, targetSpotted = false, wakeMonster, publish = plineWithContinuation, showShield, finishDeath, attackLevel = POTION_ATTACK_LEVEL, polyspot = false, } = {}) {
    if (monster.mnum === PM_LONG_WORM
        && alreadyChangedThisAttack(monster)) {
        if ((await wakeMonster?.(monster))?.heroDied)
            return { heroDied: true };
        return { changed: false, alreadyChanged: true, killed: false };
    }
    const magicResistant = monsterHasMagicResistance(monster);
    if (magicResistant)
        await showShield?.(monster);
    const resisted = !magicResistant
        && monsterResistsEffect(monster, attackLevel);
    let systemShock = false;
    let change = null;
    let selfTouch = null;
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
            if (death.heroDied)
                return { heroDied: true };
        }
        else {
            const heroInsideTarget = !!state.u.uswallow
                && state.u.ustuck === monster;
            const changeOptions = {
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
            if (change?.heroDied)
                return {
                    changed: true, change, heroDied: true,
                    magicResistant, resisted, systemShock, killed: false,
                };
            selfTouch = change?.selfTouch || null;
        }
        if (survived(monster))
            markNewLongWorm(monster, state);
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
function copyRestoredTraits(monster, saved) {
    for (const key in saved) {
        if (Object.hasOwn(saved, key))
            monster[key] = saved[key];
    }
}
export function restoreMonsterTraits(monster, saved, { rollOne = rnd, randomBelow = rn2, } = {}) {
    if (!monster || !saved)
        return monster;
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
                created.mhpmax += monsterHitPointsPerLevel({ mnum: saved.mnum, m_lev: created.m_lev }, { rollOne, randomBelow });
            }
            restoredLevel = created.m_lev;
        }
    }
    copyRestoredTraits(monster, saved);
    monster.m_id = created.m_id;
    monster.mx = created.mx;
    monster.my = created.my;
    if (created.mux === undefined)
        delete monster.mux;
    else
        monster.mux = created.mux;
    if (created.muy === undefined)
        delete monster.muy;
    else
        monster.muy = created.muy;
    monster.minvent = created.minvent;
    monster.inventory = monster.minvent;
    monster.hasInventory = monster.minvent.length > 0;
    monster.mw = null;
    if (created.wormno === undefined)
        delete monster.wormno;
    else
        monster.wormno = created.wormno;
    if (created.wormSegments === undefined)
        delete monster.wormSegments;
    else
        monster.wormSegments = created.wormSegments;
    if (created.wormHead === undefined)
        delete monster.wormHead;
    else
        monster.wormHead = created.wormHead;
    if (created.wormGrowTime === undefined)
        delete monster.wormGrowTime;
    else
        monster.wormGrowTime = created.wormGrowTime;
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
    if (!monsterHasSeductionAttack(monster.mnum))
        monster.mcan = 0;
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
export async function cancelMonster(monster, { state = game, attackLevel, random = rn2, allowKill = true, publish = plineWithContinuation, finishMonsterKill = finishHeroMonsterKill, }) {
    if (monsterResistsEffect(monster, attackLevel, random)) {
        return { cancelled: false, resisted: true, killed: false };
    }
    monster.mcan = 1;
    const shape = await normalizeMonsterShape(monster, state, publish);
    if (shape.heroDied)
        return {
            cancelled: true, resisted: false, heroDied: true, changedShape: shape.changed,
        };
    const changedShape = shape.changed;
    const clayGolem = monster.mnum === PM_CLAY_GOLEM;
    if (clayGolem && canSeeMonster(monster)) {
        await publish(`Some writing vanishes from ${possessiveName(monsterName(monster, { state }))} head!`);
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
export function monsterResistsEffect(monster, attackLevel, random = rn2) {
    let defenseLevel = monster?.m_lev ?? 1;
    if (defenseLevel > 50)
        defenseLevel = 50;
    else if (defenseLevel < 1)
        defenseLevel = monsterIsPlayerMonster(monster.mnum) ? game.u.ulevel ?? 1 : 1;
    const resistance = MONSTER_MAGIC_RESISTANCE[monster?.mnum] ?? 0;
    return random(100 + attackLevel - defenseLevel) < resistance;
}
// C youprop.h:Half_spell_damage, including carried artifact extrinsics.
// zap.c:4584-4586 halves wand and spell damage through this property.
export function heroHasHalfSpellDamage(state = game) {
    return !!(state.u?.halfSpellDamage
        || (state.u?.halfSpellDamageTurns ?? 0) > 0
        || heroHasCarriedArtifactFlag('SPFX_HSPDAM', state));
}
// C zap.c:spell_damage_bonus().
export function adjustSpellDamage(damage, state = game) {
    const intelligence = currentAttribute(A_INT, state) ?? 10;
    const level = state.u?.ulevel ?? 1;
    if (intelligence <= 9)
        return damage > 1 ? Math.max(1, damage - 3) : damage;
    if (intelligence <= 13 || level < 5)
        return damage;
    if (intelligence <= 18)
        return damage + 1;
    if (intelligence <= 24 || level < 14)
        return damage + 2;
    return damage + 3;
}
//# sourceMappingURL=zap.js.map