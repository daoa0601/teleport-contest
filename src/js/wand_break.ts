import type { GameState, PlayingGameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import { requirePlayingGame } from './gstate.js';

// Native apply.c:do_break_wand(). The discarded wand remains a free object
// during its explosion, so inventory destruction cannot consume it twice.

import { currentAttribute } from './attrib.js';
import { heroHandName, heroHeadName } from './body_parts.js';
import { dropBoulderIntoLiquid } from './boulder_pool.js';
import { endVoluntaryMultiTurn } from './command_state.js';
import {
    A_STR, DIGCHECK_FAILED, DIGCHECK_FAIL_BOULDER, EXPL_FIERY, EXPL_FROSTY,
    EXPL_MAGICAL, HOLE, ICE, IS_DOOR, IS_WALL, PARANOID_BREAKWAND, PIT,
    ROOM, SHOPBASE, isok, xdir, ydir,
} from './const.js';
import { digActualHole, digCheck, liquidFlow } from './digging_terrain.js';
import { watchDigging } from './digging_watch.js';
import { bot, plineWithContinuation as pline } from './display.js';
import { explode } from './explosion.js';
import { game, requireLiveGame } from './gstate.js';
import { loseHeroHp } from './hero_damage.js';
import { finishHeroMonsterKill } from './hero_monster_death.js';
import { removeWornHeroItem } from './hero_equipment.js';
import { releaseHold } from './hero_expulsion.js';
import { freeInventoryObject } from './hero_inventory.js';
import { zapHeroWithObject } from './hero_self_zap.js';
import { liquidForHole } from './hole.js';
import {
    beginImmediateZap, finishImmediateZap, hitFloorPileWithWand, hitMonsterWithWand,
} from './immediate_zap.js';
import { lightRoom } from './light.js';
import { canDigDown, makemonAt } from './mklev.js';
import { monsterAtPosition } from './monster_location.js';
import { delobj } from './object_delete.js';
import {
    BOULDER, OBJECT_DESCRIPTIONS, WAN_CANCELLATION, WAN_COLD, WAN_CREATE_MONSTER,
    WAN_DEATH, WAN_DIGGING, WAN_ENLIGHTENMENT, WAN_FIRE, WAN_LIGHT, WAN_LIGHTNING,
    WAN_LOCKING, WAN_MAGIC_MISSILE, WAN_NOTHING, WAN_OPENING, WAN_POLYMORPH,
    WAN_PROBING, WAN_SECRET_DOOR_DETECTION, WAN_STASIS, WAN_STRIKING,
    WAN_TELEPORTATION, WAN_UNDEAD_TURNING, WAN_WISHING,
} from './object_data.js';
import { makePlural } from './object_grammar.js';
import { learnObjectType } from './object_knowledge.js';
import { unlinkObject } from './object_location.js';
import { LEVEL_TIMER_KIND, stopLevelTimer } from './object_timers.js';
import { observeObjectForNaming, ownedObjectName } from './objnam.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { heroHasNoHands } from './polyself.js';
import { paranoidQuery } from './query.js';
import { roomsAt } from './room.js';
import { d, rn2, rnd } from './rng.js';
import { chargeAlteredUnpaidObject, chargeUnpaidUsage } from './shk.js';
import { payForShopDamage } from './shop_damage.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
import { vision_note_blocker_change } from './vision.js';
import { zappable } from './wand_charge.js';
import { heroHasFreeHand } from './weapon_type.js';

const WAND_CLASS = 11;
const inertBreaks = new Set([
    WAN_WISHING, WAN_NOTHING, WAN_LOCKING, WAN_PROBING, WAN_ENLIGHTENMENT,
    WAN_SECRET_DOOR_DETECTION, WAN_STASIS, WAN_OPENING,
]);
const affectsObjects = new Set([
    WAN_STRIKING, WAN_CANCELLATION, WAN_POLYMORPH, WAN_TELEPORTATION, WAN_UNDEAD_TURNING,
]);

export async function breakWand(wand: GameObject, { state = game }: { state?: GameState } = {}) {
    requireLiveGame(state);
    requirePlayingGame(state);
    const description = state.objectDescriptions?.[wand.otyp] ?? OBJECT_DESCRIPTIONS[wand.otyp];
    const fragile = description === 'balsa' || description === 'glass';
    if (heroHasNoHands(state)) {
        observeObjectForNaming(wand, { state });
        const name = ownedObjectName(wand, state, { capitalized: false });
        await pline(`You can't break ${name} without hands!`);
        return { spentTime: false, heroDied: false };
    }
    if (!heroHasFreeHand(state)) {
        await pline(`Your ${makePlural(heroHandName(state))} are occupied!`);
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
    await pline(`Raising ${name} high above your ${heroHeadName(state)}, you ${fragile ? 'snap' : 'break'} it in two!`);
    if (wand.unpaid) {
        await chargeUnpaidUsage(wand, { state });
        await chargeAlteredUnpaidObject(wand, 'destroy', state);
    }
    state._currentWand = wand;
    await freeInventoryObject(wand, state);
    if (state.program_state.gameover) return { spentTime: true, heroDied: true };
    await removeWornHeroItem(wand, state);
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
                if (await loseHeroHp(injury, killer, { state, deathCause: killer }))
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

async function discardBrokenWand(state: GameState) {
    const wand = state._currentWand;
    state._currentWand = null;
    if (wand) await delobj(wand, state);
    endVoluntaryMultiTurn(state);
}

async function affectPile(wand: GameObject, x: number, y: number, state: PlayingGameState) {
    if (!state.level.objects[x]?.[y]?.length) return;
    await hitFloorPileWithWand(wand, x, y, { state });
    if (!state.program_state.gameover) await bot();
}

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
