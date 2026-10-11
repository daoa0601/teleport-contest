import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { Trap } from './map_types.js';
import { requirePlayingGame } from './gstate.js';

// C zap.c:weffects(), zapnodir(), zap_steed(), zap_updown(), and the
// ZAPPED_WAND branch of bhit(). Callers own charge use and direction input.
import { objectIsHardHelmet } from './armor.js';
import { exerciseWisdom } from './attrib.js';
import { heroFaceName, heroFootName, heroHeadName } from './body_parts.js';
import { askTeleportDestination } from './cmd.js';
import {
    DBWALL, DOOR, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, D_BROKEN, D_CLOSED, D_LOCKED,
    ENGRAVE, HOLE, ICE, IS_FURNITURE, Is_airlevel, Is_waterlevel, SDOOR,
    SHOPBASE, SHOP_DOOR_COST, TRAPDOOR, ZAP_POS, isok,
} from './const.js';
import { closeDrawbridge, destroyDrawbridge, findDrawbridgeAt, openDrawbridge } from './dbridge.js';
import { findit } from './detect.js';
import { impossible } from './diagnostics.js';
import { zapDigWithObject } from './digging_magic.js';
import {
    consumeHallucinatedMenuObjectGlyph, displayLiquidName, newsym,
    plineWithContinuation as pline, unmap_invisible,
} from './display.js';
import { changeDoorByMagic } from './door_magic.js';
import { drawbridgeUnderlyingType } from './drawbridge_terrain.js';
import { recordMappedOverviewState } from './dungeon.js';
import { engravingAt } from './engrave.js';
import { addExperience } from './exper.js';
import { placeCreatedObject, stack_object } from './floor_object.js';
import { game, requireLiveGame } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { triggerHeroTrap } from './hero_traps.js';
import {
    beginImmediateZap, finishImmediateZap, hitFloorPileWithWand,
    hitMonsterWithWand, hitObjectWithWand,
} from './immediate_zap.js';
import { doEnlightenmentEffect } from './insight.js';
import { inventoryItemDescription } from './invent.js';
import { gotoLevel } from './level_change.js';
import { lightDamage, lightRoom } from './light.js';
import { probeMonster } from './magic_probe.js';
import { createCritters, mksobj } from './mklev.js';
import { maybeUnhideAt } from './monster_hiding.js';
import { monsterAtPosition } from './monster_location.js';
import {
    OBJECT_DIR, OBJECT_NAMES, ROCK, SPE_CANCELLATION, SPE_CURE_SICKNESS,
    SPE_DETECT_UNSEEN, SPE_DIG, SPE_DRAIN_LIFE,
    SPE_EXTRA_HEALING, SPE_FINGER_OF_DEATH, SPE_FORCE_BOLT, SPE_HEALING,
    SPE_KNOCK, SPE_LIGHT, SPE_MAGIC_MISSILE, SPE_POLYMORPH, SPE_SLOW_MONSTER,
    SPE_STONE_TO_FLESH, SPE_TELEPORT_AWAY, SPE_WIZARD_LOCK,
    WAN_CANCELLATION, WAN_CREATE_MONSTER, WAN_DIGGING, WAN_ENLIGHTENMENT,
    WAN_LIGHT, WAN_LIGHTNING, WAN_LOCKING, WAN_MAGIC_MISSILE, WAN_MAKE_INVISIBLE,
    WAN_OPENING, WAN_POLYMORPH, WAN_PROBING, WAN_SECRET_DOOR_DETECTION,
    WAN_SLOW_MONSTER, WAN_SPEED_MONSTER, WAN_STASIS, WAN_STRIKING,
    WAN_TELEPORTATION, WAN_WISHING,
} from './object_data.js';
import { armorUsesPairGrammar, makePlural } from './object_grammar.js';
import { observeObject } from './object_knowledge.js';
import { objectNameIsPlural, observeObjectForNaming } from './objnam.js';
import { orderedPickupObjects, pickupObjectClass, pickupClassOrder } from './pickup.js';
import { heroFormHidesUnderObjects } from './polyself.js';
import { okToQuest, onQuestStart } from './quest.js';
import { roomsAt } from './room.js';
import { rn2, rnd } from './rng.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { objectTypeKnown } from './shk.js';
import { addShopDamage, payForShopDamage } from './shop_damage.js';
import { heroControlsTeleport, teleportHero } from './teleport.js';
import { ceilingName, surfaceName } from './terrain_name.js';
import { isIceAt, isLavaAt, isPoolAt } from './terrain_properties.js';
import { closeHoldingTrap, openFallingTrap, openHoldingTrap } from './trap_magic.js';
import { cansee, couldsee } from './vision.js';
import { learnWand } from './wand_charge.js';
import { zapMapAt } from './wand_terrain_magic.js';
import { showInventoryWindow } from './windows.js';
import { makeWish } from './wish.js';
import { zapRayWithObject } from './zap.js';

const NODIR = 1, IMMEDIATE = 2;

export async function applyWandEffect(source: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const hero = state.u, type = source.otyp, direction = OBJECT_DIR[type];
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

async function zapWithoutDirection(source: GameObject, state: PlayingGameState) {
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
        if ((state.u.uluck || 0) + rn2(5) < 0) await pline('Unfortunately, nothing happens.');
        else {
            known = !!source.dknown;
            await makeWish({ announce: state.flags.verbose !== false });
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
            unmap_invisible(x, y);
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
                await pline('The stairs seem to ripple momentarily.');
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
            maybeUnhideAt(state.u.ux, state.u.uy, state);
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
        await pline(`A rock is dislodged from the ${ceilingName(x, y, state)} and falls on your ${heroHeadName(state)}.`);
        let damage = rnd(objectIsHardHelmet(state.uarmh || state.u.uarmh) ? 2 : 6);
        if (state.u.halfPhysicalDamage) damage = Math.ceil(damage / 2);
        if (await loseHeroHp(damage, 'falling rock', { state })) return false;
        const rock = await mksobj(ROCK, false, false);
        await placeCreatedObject(rock, x, y, state);
        observeObjectForNaming(rock, { state });
        await stack_object(rock, state);
        newsym(x, y);
        return false;
    }
    if (dz <= 0 || !trap) return false;
    if (!striking) {
        const effect = await closeHoldingTrap(state.u, { state });
        if (effect.changed) return effect.noticed;
    }
    if (striking && trap.ttyp === TRAPDOOR) {
        const known = !!trap.tseen;
        await pline(heroIsBlind(state) && !known ? 'Something beneath you shatters.'
            : !known ? "There's a trapdoor beneath you; it shatters." : 'The trapdoor beneath you shatters.');
        trap.ttyp = HOLE;
        trap.tseen = 1;
        newsym(x, y);
        await triggerHeroTrap(trap, { gotoLevel });
        return known;
    }
    if (!striking && trap.ttyp === HOLE) {
        trap.ttyp = TRAPDOOR;
        if (heroIsBlind(state) || !trap.tseen) await pline(`Some ${isIceAt(x, y, state) ? 'frost' : 'dust'} swirls beneath you.`);
        else {
            trap.tseen = 1;
            newsym(x, y);
            await pline('A trapdoor appears beneath you.');
            return true;
        }
    }
    return false;
}

async function fleshOnTerrain(x: number, y: number, state: PlayingGameState) {
    const { dz = 0 } = state.u;
    if (Is_airlevel(state.u.uz) || Is_waterlevel(state.u.uz) || state.underwater || state.u.uinwater
        || (onQuestStart(state) && dz < 0)) await pline('Nothing happens.');
    else if (dz < 0) await pline(`Blood drips on your ${heroFaceName(state)}.`);
    else if (!state.level.objects[x]?.[y]?.length && engravingAt(x, y)?.engr_type !== ENGRAVE) {
        if (isPoolAt(x, y, state) || isIceAt(x, y, state)) await pline('Nothing happens.');
        else await pline(`Blood ${isLavaAt(x, y, state) ? 'boils' : 'pools'} ${state.u.levitating ? 'beneath' : 'at'} your ${makePlural(heroFootName(state))}.`);
    }
}

async function probeVertically(source: GameObject, x: number, y: number, state: PlayingGameState) {
    let found = 0;
    if ((state.u.dz ?? 0) < 0) await pline(`You probe towards the ${ceilingName(x, y, state)}.`);
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
        await pline(`You probe beneath ${furniture ? 'it' : `the ${surfaceName(x, y, state)}`}.`);
        found += await displayBuriedInventory(x, y, state);
    }
    if (!found) await pline('Your probe reveals nothing.');
}

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
            await pline(`There ${plural ? 'are' : 'is'} ${inventoryItemDescription(object)} under the ${liquid} here.`);
            underwhat = plural || armorUsesPairGrammar(OBJECT_NAMES[object.otyp] ?? '') ? 'under them' : 'beneath it';
        } else {
            await showProbeObjects(pile, `Things that are under the ${liquid} here:`);
            underwhat = 'beneath them';
        }
    }
    const buried = (state.level.buriedObjects || []).filter(object => object.ox === x && object.oy === y);
    for (const object of buried) observeObject(object, state);
    if (buried.length) await showProbeObjects(orderedPickupObjects(buried), `Things that are buried ${underwhat}:`, true);
    return count + buried.length;
}

async function showProbeObjects(objects: GameObject[], title: string, groupByClass = false) {
    const item = (object: GameObject) => {
        consumeHallucinatedMenuObjectGlyph(object);
        return { text: inventoryItemDescription(object) };
    };
    const sections = groupByClass
        ? pickupClassOrder().map(heading => ({ heading,
            items: objects.filter(object => pickupObjectClass(object) === heading).map(item),
        }))
        : [{ heading: '', items: objects.map(item) }];
    await showInventoryWindow(sections, { title });
}
