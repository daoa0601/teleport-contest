// Object burial and buried-object ownership.
// C refs: dig.c bury_an_obj()/bury_objs() and dungeon.c earth_sense().

import { CORR, ROOM, TT_BURIEDBALL, Upolyd } from './const.js';
import { heroFootName } from './body_parts.js';
import { newsym, plineWithContinuation } from './display.js';
import { MONSTER_NAME } from './monster_data.js';
import { makePlural } from './object_grammar.js';
import { propertyIsActive, refreshMovementProperties } from './properties.js';
import { deleteEngravingAt } from './engrave.js';
import { placeObject, stack_object } from './floor_object.js';
import { isIceAt } from './terrain_properties.js';
import { game, requireGameLevel } from './gstate.js';
import { clearHeroTrap } from './hero_traps.js';
import { punishHero, unpunishHero } from './punishment.js';
import { freeInventoryObject } from './hero_inventory.js';
import { releaseObjectLeash } from './monster_leash.js';
import { maybeUnhideAt } from './monster_hiding.js';
import { shopkeeperName } from './monster_name.js';
import { costlySpot } from './shk.js';
import { stolenValue } from './shop_loss.js';
import { deleteObject } from './object_delete.js';
import { endObjectBurn } from './light.js';
import { unlinkObject } from './object_location.js';
import {
    BOULDER, CORPSE, HEAVY_IRON_BALL, LEASH, POT_OIL, ROCK,
} from './object_data.js';
import { objectMaterial } from './object_material.js';
import { objectResistsDestruction } from './object_state.js';
import {
    OBJECT_TIMER_KIND, scheduleObjectTimer, stopObjectTimer,
} from './object_timers.js';
import { rn1, rnd } from './rng.js';

import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { MessagePublisher } from './display.js';

interface BurialOptions { publish?: MessagePublisher }
export interface BurialResult {
    outcome: 'skipped' | 'interrupted' | 'absorbed' | 'buried';
    next: GameObject | null;
}

const POTION_CLASS = 8;
const COIN_CLASS = 12;

// C dungeon.c:earth_sense(), after placing the hero but before spot effects.
export async function senseBuriedObjects(state: GameState = game): Promise<void> {
    const hero = state.u;
    if (state.urace?.mnum !== MONSTER_NAME.indexOf('dwarf')
        || hero.usteed || Upolyd(hero)
        || propertyIsActive('flying', state)
        || propertyIsActive('levitation', state)) return;
    const level = requireGameLevel(state);
    const typ = level.at(hero.ux, hero.uy)?.typ;
    if (typ !== CORR && typ !== ROOM) return;
    if (level.buriedObjects?.some(object =>
        object.ox === hero.ux && object.oy === hero.uy)) {
        await plineWithContinuation(
            `You sense something below your ${makePlural(heroFootName(state))}.`,
        );
    }
}

export function addBuriedObject(object: GameObject, x: number, y: number, state?: GameState): GameObject;
export function addBuriedObject(object: GameObject | null | undefined, x: number, y: number, state?: GameState): GameObject | null | undefined;
export function addBuriedObject(object: GameObject | null | undefined, x: number, y: number, state: GameState = game): GameObject | null | undefined {
    if (!object) return object;
    removeFloorReference(object, state);
    object.where = 'buried';
    object.buried = true;
    object.ox = x;
    object.oy = y;
    const level = requireGameLevel(state);
    (level.buriedObjects ??= []).unshift(object);
    return object;
}

export async function buryFloorObjectsAt(x: number, y: number, state: GameState = game, {
    publish = plineWithContinuation,
}: BurialOptions = {}): Promise<GameObject[]> {
    const level = requireGameLevel(state);
    const shop = costlySpot(x, y, state);
    const buried: GameObject[] = [];
    let loss = 0;
    let object = level.objects[x]?.[y]?.[0] ?? null;
    while (object) {
        if (shop && !state.context.mon_moving) {
            loss += await stolenValue(object, x, y, !!shop.resident.mpeaceful, {
                silent: true, state, publish,
            });
            if (object.oclass !== COIN_CLASS) object.no_charge = true;
        }
        const result = await buryObject(object, state, { publish });
        if (result.outcome === 'buried') buried.push(object);
        object = result.next;
    }
    deleteEngravingAt(x, y, requireGameLevel(state));
    newsym(x, y);
    maybeUnhideAt(x, y, state);
    if (shop && loss) {
        await publish(`You owe ${shopkeeperName(shop.resident, { state })} ${loss} ${
            loss === 1 ? 'zorkmid' : 'zorkmids'} for burying merchandise.`);
    }
    return buried;
}

export async function buryObject(object: GameObject, state: GameState = game, {
    publish = plineWithContinuation,
}: BurialOptions = {}): Promise<BurialResult> {
    const level = requireGameLevel(state);
    if (object === state.uball) {
        await unpunishHero(state);
        state.u.utrap = rn1(50, 20);
        state.u.utraptype = TT_BURIEDBALL;
        refreshMovementProperties(state);
        state.context.botl = true;
        await publish('The iron ball gets buried!');
    }

    // Unpunishing can delete the next object (the chain) from this pile.
    const pile = level.objects[object.ox]?.[object.oy];
    const index = pile?.indexOf(object) ?? -1;
    const next = pile && index >= 0 ? pile[index + 1] ?? null : null;
    if (object === state.uchain || objectResistsDestruction(object, 0, 0))
        return { outcome: 'skipped', next };

    if (object.otyp === LEASH && object.leashmon) releaseObjectLeash(object, state);
    if (object.lamplit && object.otyp !== POT_OIL) endObjectBurn(object, state);
    if (object.where === 'inventory') {
        await freeInventoryObject(object, state);
        if (state.program_state.gameover) return { outcome: 'interrupted', next };
    } else {
        unlinkObject(object, state);
    }

    const x = object.ox;
    const y = object.oy;
    const underIce = isIceAt(x, y, state);
    if ((object.otyp === ROCK && !underIce) || object.otyp === BOULDER) {
        await deleteObject(object, state);
        return { outcome: 'absorbed', next };
    }

    scheduleBuriedRot(object, underIce, state);
    addBuriedObject(object, x, y, state);
    return { outcome: 'buried', next };
}

function removeFloorReference(object: GameObject, state: GameState): void {
    const pile = state.level?.objects?.[object.ox]?.[object.oy];
    const index = pile?.indexOf(object) ?? -1;
    if (pile && index >= 0) pile.splice(index, 1);
}

function scheduleBuriedRot(object: GameObject, underIce: boolean, state: GameState): void {
    const canRot = underIce
        ? object.oclass === POTION_CLASS
        : objectMaterial(object, state) <= 8;
    if (object.otyp === CORPSE || !canRot
        || objectResistsDestruction(object, 5, 95)) {
        return;
    }
    scheduleObjectTimer(
        object, OBJECT_TIMER_KIND.ROT_ORGANIC,
        (underIce ? 0 : 250) + rnd(250) + (state.moves ?? 0), state,
    );
}


// C dig.c:unearth_objs().  Buried objects return to the floor; an unearthed
// punishment ball drags the hero's chain back into punishment.  Callers
// converting ice terrain should run obj_ice_effects() first.
export async function unearthFloorObjectsAt(x: number, y: number, state: GameState = game): Promise<GameObject[]> {
    const unearthed: GameObject[] = [];
    const level = requireGameLevel(state);
    const ball = buriedBallNear(x, y, state);
    for (const object of [...(level.buriedObjects || [])]) {
        if (object.ox !== x || object.oy !== y) continue;
        if (ball && object === ball
            && state.u?.utrap && state.u.utraptype === TT_BURIEDBALL) {
            await buriedBallToPunishment(state);
            continue;
        }
        const index = level.buriedObjects?.indexOf(object) ?? -1;
        if (index >= 0) level.buriedObjects?.splice(index, 1);
        stopObjectTimer(object, OBJECT_TIMER_KIND.ROT_ORGANIC);
        object.where = 'free';
        object.buried = false;
        await placeObject(object, x, y, state);
        await stack_object(object, state);
        unearthed.push(object);
    }
    deleteEngravingAt(x, y, requireGameLevel(state));
    newsym(x, y);
    return unearthed;
}

// C dig.c:buried_ball(): the buried iron ball at the spot, or the nearest one
// within the +/-2 chain vicinity.
export function buriedBallNear(x: number, y: number, state: GameState): GameObject | null {
    if (state.u?.utrap && state.u.utraptype !== TT_BURIEDBALL) return null;
    let nearest: GameObject | null = null;
    let nearestDistance = Infinity;
    for (const object of state.level?.buriedObjects || []) {
        if (object.otyp !== HEAVY_IRON_BALL) continue;
        if (object.ox === x && object.oy === y) return object;
        const distance = (object.ox - x) ** 2 + (object.oy - y) ** 2;
        if (distance <= 8 && distance < nearestDistance) {
            nearest = object;
            nearestDistance = distance;
        }
    }
    return nearest;
}

// C dig.c:buried_ball_to_punishment().  The ball leaves the ground and the
// chain snaps back to the hero, ending the buried-ball trap.
export async function buriedBallToPunishment(state: GameState = game): Promise<boolean> {
    const hero = state.u;
    const ball = buriedBallNear(hero.ux, hero.uy, state);
    if (!ball) return false;
    const { ox: x, oy: y } = ball;
    unlinkObject(ball, state);
    await punishHero(ball, state);
    clearHeroTrap(state);
    deleteEngravingAt(x, y, requireGameLevel(state));
    newsym(x, y);
    return true;
}
