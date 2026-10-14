// Moving a floor object with the kick command.
// C refs: dokick.c really_kick_object() and zap.c bhit(KICKED_WEAPON).

import { artifactById } from './artifacts.js';
import { currentAttribute } from './attrib.js';
import {
    A_STR, DOOR, D_CLOSED, D_LOCKED, ICE, IS_POOL, Is_airlevel,
    Is_waterlevel, WEB, ZAP_POS, is_pit, isok,
} from './const.js';
import { newsym, plineWithContinuation } from './display.js';
import { landFloorObject } from './floor_effects.js';
import { remove_object } from './floor_object.js';
import { splitObjectStack } from './object_stack.js';
import { game } from './gstate.js';
import type { MessagePublisher } from './display.js';
import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
import type { MapLocation } from './map_types.js';
import type { ProjectileFlightCapture } from './thrown_object.js';

import { hitMonsterWithKickedObject } from './hero_ranged_attack.js';
import { breakFloorObject } from './object_breakage.js';
import { BOULDER, KICKING_BOOTS, OBJECT_NAMES } from './object_data.js';
import { rn2, rnd } from './rng.js';
import { flyKickedObject } from './thrown_object.js';
import { heroIsBlind, heroIsDeaf } from './senses.js';
import { inventoryItemDescription } from './invent.js';
import { surfaceName } from './terrain_name.js';
import { scatterFloorObjects } from './scatter.js';
import { objectWeight } from './weight.js';

export interface KickObjectOptions {
    state?: GameState;
    dx?: number;
    dy?: number;
    publish?: MessagePublisher;
    random?: typeof rn2;
    rollOne?: typeof rnd;
    captureFlight?: ProjectileFlightCapture | null;
}


function trapAt(state: GameState, x: number, y: number) {
    return state.level?.traps?.find(trap =>
        trap.tx === x && trap.ty === y) || null;
}

function closedDoor(location: MapLocation | null | undefined) {
    return location?.typ === DOOR
        && !!((location.doormask ?? 0) & (D_CLOSED | D_LOCKED));
}

function heroKnowsMartialArts(state: GameState) {
    return state.urole?.key === 'monk' || state.urole?.key === 'samurai'
        || (state.uarmf || state.u?.uarmf)?.otyp === KICKING_BOOTS;
}

function quantity(object: GameObject) {
    return object.quan ?? object.quantity ?? 1;
}

function unitWeight(object: GameObject) {
    if (quantity(object) === 1) return objectWeight(object);
    return objectWeight({ ...object, quan: 1, quantity: 1 });
}

function objectName(object: GameObject) {
    const name = object.name || OBJECT_NAMES[object.otyp] || 'object';
    const count = quantity(object);
    if (count > 1) return `${count} ${object.plural || `${name}s`}`;
    return `${/^[aeiou]/iu.test(name) ? 'an' : 'a'} ${name}`;
}

function kickRange(
    object: GameObject, state: GameState, dx: number, dy: number, martial: boolean,
    rollOne: typeof rnd,
) {
    let slide = false;
    let range = Math.trunc(currentAttribute(A_STR, state) / 2)
        - Math.trunc((object.oclass === 12 ? objectWeight(object) : unitWeight(object)) / 40);
    if (martial) range += rollOne(3);

    const source = state.level?.at?.(object.ox, object.oy);
    if (source && IS_POOL(source.typ)) {
        range = Math.trunc(range / 3) + 1;
    } else if (Is_airlevel(state.u?.uz) || Is_waterlevel(state.u?.uz)) {
        range += rollOne(3);
    } else {
        if (source?.typ === ICE) { range += rollOne(3); slide = true; }
        if (object.greased) { range += rollOne(3); slide = true; }
    }

    if (artifactById(object.oartifact ?? 0, state)?.name === 'Mjollnir')
        range = 1;
    const nextX = object.ox + dx;
    const nextY = object.oy + dy;
    const next = state.level?.at?.(nextX, nextY);
    if (!isok(nextX, nextY) || !next || !ZAP_POS(next.typ) || closedDoor(next))
        range = 1;
    return { range, slide };
}

export async function kickFloorObject(x: number, y: number, {
    state = game,
    dx = state.u?.dx ?? 0,
    dy = state.u?.dy ?? 0,
    publish = plineWithContinuation,
    random = rn2,
    rollOne = rnd,
    captureFlight = null,
}: KickObjectOptions = {}) {
    const object = state.level?.objects?.[x]?.[y]?.[0];
    if (!object) return false;
    if (object.otyp === BOULDER || object === state.uball || object === state.u.uball
        || object === state.uchain || object === state.u.uchain) return false;

    const trap = trapAt(state, x, y);
    const passesWalls = state.u.passesWalls;
    if (trap && ((is_pit(trap.ttyp) && !passesWalls)
        || trap.ttyp === WEB)) {
        trap.tseen = true;
        await publish(`You can't kick something that's in a ${
            trap.ttyp === WEB ? 'web' : 'pit'}!`);
        return true;
    }
    if ((state.u?.fumbling || (state.u?.fumblingTurns ?? 0) > 0)
        && random(3) === 0) {
        await publish('Your clumsy kick missed.');
        return true;
    }

    const martial = heroKnowsMartialArts(state);
    const { range, slide } = kickRange(object, state, dx, dy, martial, rollOne);
    await publish(`You kick ${objectName(object)}.`);

    const { destroyed } = await breakFloorObject(object, {
        state,
        publish,
        random,
    });
    // A fatal vapor or oil blast ends the action even though the bottle
    // itself reports not destroyed.
    if (destroyed || state.program_state?.gameover) return true;
    if (range < 2) {
        await publish('Thump!');
        return random(3) === 0 || martial;
    }

    if (object.oclass === 12 && quantity(object) > 1) {
        if (random(20) !== 0) {
            if (!heroIsDeaf(state)) await publish('Thwwpingg!');
            const messages = ['scatter the coins', 'knock coins all over the place',
                'send coins flying in all directions'];
            await publish(`You ${messages[random(messages.length)]}!`);
            await scatterFloorObjects(x, y, rollOne(3), {
                state, onlyObject: object, mayDestroy: false, mayFracture: false,
                mayHitHero: true, mayHitMonsters: true, heroCaused: true,
                publish, random, rollOne,
            });
            newsym(x, y);
            return true;
        }
        if (quantity(object) > 300) {
            await publish('Thump!');
            return random(3) === 0 || martial;
        }
    }

    const moving = object.oclass !== 12 && quantity(object) > 1
        ? splitObjectStack(object, 1, state)
        : object;
    if (!moving) throw new Error('A kicked stack must yield an object.');
    if (slide && !heroIsBlind(state)) {
        const name = inventoryItemDescription(moving);
        await publish(`Whee!  ${name.charAt(0).toUpperCase() + name.slice(1)} ${
            quantity(moving) === 1 ? 'slides' : 'slide'} across the ${surfaceName(x, y, state)}.`);
    }
    remove_object(moving, state);
    state._kickedObject = moving;
    try {
        newsym(x, y);
        const flight = await flyKickedObject({
            state,
            object: moving,
            dx,
            dy,
            range,
            captureFlight,
            publish,
            random,
        });
        if (flight.destroyed || flight.migrated) return true;
        if (flight.contact) {
            const contact = await hitMonsterWithKickedObject(
                flight.contact, moving, { state, target: { x: flight.x, y: flight.y } },
            );
            if (contact.heroDied || contact.consumed) return true;
        }

        await landFloorObject(moving, flight.x, flight.y, {
            state,
            publish,
            random,
        });
        newsym(flight.x, flight.y);
        return true;
    } finally {
        if (state._kickedObject === moving) state._kickedObject = null;
    }
}
