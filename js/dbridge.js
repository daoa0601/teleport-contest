// Drawbridge location and movement.
// C ref: dbridge.c find_drawbridge(), open_drawbridge(), close_drawbridge().

import {
    DBWALL, DB_DIR, DB_EAST, DB_ICE, DB_LAVA, DB_MOAT, DB_NORTH,
    DB_SOUTH, DB_UNDER, DB_WEST, DOOR, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP,
    D_NODOOR, ICE, ICED_MOAT, IS_DRAWBRIDGE, Is_stronghold, LAVAPOOL,
    MOAT, POOL, ROOM, WATER, W_NONDIGGABLE, isok,
} from './const.js';
import {
    newsym, plineWithContinuation,
} from './display.js';
import { dropBoulderIntoLiquid } from './boulder_pool.js';
import {
    destroyDrawbridgeOccupants, moveDrawbridgeOccupants,
} from './drawbridge_occupants.js';
import { scatterDrawbridgeDebris } from './drawbridge_debris.js';
import { game } from './gstate.js';
import { BOULDER } from './object_data.js';
import { wakeMonstersNear } from './mon.js';
import { stopAllObjectTimers } from './object_timers.js';
import {
    cansee, vision_note_blocker_change, vision_recalc,
} from './vision.js';

function directionFromBridgeToWall(bridge) {
    const direction = (bridge.drawbridgemask || 0) & DB_DIR;
    if (direction === DB_NORTH) return { dx: 0, dy: -1 };
    if (direction === DB_SOUTH) return { dx: 0, dy: 1 };
    if (direction === DB_EAST) return { dx: 1, dy: 0 };
    return { dx: -1, dy: 0 };
}

// C ref: dbridge.c is_pool().
export function isPoolAt(x, y, state = game) {
    const location = state.level?.at?.(x, y);
    if (!location) return false;
    if ([POOL, MOAT, WATER].includes(location.typ)) return true;
    return location.typ === DRAWBRIDGE_UP
        && ((location.drawbridgemask ?? 0) & DB_UNDER) === DB_MOAT;
}

export function isLavaAt(x, y, state = game) {
    const location = state.level?.at?.(x, y);
    if (!location) return false;
    if (location.typ === LAVAPOOL) return true;
    return location.typ === DRAWBRIDGE_UP
        && ((location.drawbridgemask ?? 0) & DB_UNDER) === DB_LAVA;
}

export function drawbridgeWallAt(x, y, state = game) {
    const bridge = state.level?.at(x, y);
    if (!bridge || !IS_DRAWBRIDGE(bridge.typ)) return null;
    const { dx, dy } = directionFromBridgeToWall(bridge);
    const wallX = x + dx;
    const wallY = y + dy;
    if (!isok(wallX, wallY)) return null;
    return { x: wallX, y: wallY, location: state.level.at(wallX, wallY) };
}

function bridgeBesideWall(x, y, state = game) {
    const candidates = [
        { x: x + 1, y, direction: DB_WEST },
        { x: x - 1, y, direction: DB_EAST },
        { x, y: y - 1, direction: DB_SOUTH },
        { x, y: y + 1, direction: DB_NORTH },
    ];
    return candidates.find(candidate => {
        if (!isok(candidate.x, candidate.y)) return false;
        const location = state.level.at(candidate.x, candidate.y);
        return IS_DRAWBRIDGE(location.typ)
            && ((location.drawbridgemask || 0) & DB_DIR)
                === candidate.direction;
    }) || null;
}

export function findDrawbridgeAt(x, y, state = game) {
    if (!isok(x, y) || !state.level) return null;
    const location = state.level.at(x, y);
    if (IS_DRAWBRIDGE(location.typ)) return { x, y, location };
    if (location.typ !== DOOR && location.typ !== DBWALL) return null;
    const bridge = bridgeBesideWall(x, y, state);
    if (!bridge) return null;
    return {
        x: bridge.x,
        y: bridge.y,
        location: state.level.at(bridge.x, bridge.y),
    };
}

function destroyObjectsAt(x, y, state = game) {
    const pile = state.level?.objects?.[x]?.[y] || [];
    for (const object of pile) {
        stopAllObjectTimers(object);
        object.where = 'gone';
        object.ox = 0;
        object.oy = 0;
    }
    if (state.level?.objects?.[x]) state.level.objects[x][y] = [];
}

function removeTrapAt(x, y, state = game) {
    state.level.traps = (state.level?.traps || []).filter(
        trap => trap.tx !== x || trap.ty !== y,
    );
}

function removeEngravingAt(x, y, state = game) {
    state.level.engravings = (state.level?.engravings || []).filter(
        engraving => (engraving.x ?? engraving.ex) !== x
            || (engraving.y ?? engraving.ey) !== y,
    );
}

function clearDrawbridgeSquares(
    bridge,
    wall,
    includeWallObjects,
    state,
) {
    destroyObjectsAt(bridge.x, bridge.y, state);
    if (includeWallObjects) destroyObjectsAt(wall.x, wall.y, state);
    removeTrapAt(bridge.x, bridge.y, state);
    removeTrapAt(wall.x, wall.y, state);
    removeEngravingAt(bridge.x, bridge.y, state);
    removeEngravingAt(wall.x, wall.y, state);
}

function squaredHeroDistance(point, state) {
    const hero = state.u || {};
    return (point.x - (hero.ux || 0)) ** 2
        + (point.y - (hero.uy || 0)) ** 2;
}

async function announceBridgeMovement(bridge, wall, opening, state) {
    if (cansee(bridge.x, bridge.y) || cansee(wall.x, wall.y)) {
        const bridgeDistance = squaredHeroDistance(bridge, state);
        const wallDistance = squaredHeroDistance(wall, state);
        const sameLine = state.u?.ux === bridge.x || state.u?.uy === bridge.y;
        const coming = opening
            ? wallDistance >= bridgeDistance
            : (sameLine && !(state.underwater || state.u?.uinwater))
                || wallDistance < bridgeDistance;
        const movement = coming ? 'coming' : 'going';
        await plineWithContinuation(
            `You see a drawbridge ${movement} ${opening ? 'down' : 'up'}!`,
        );
        return;
    }
    await plineWithContinuation(opening
        ? 'You hear gears turning and chains rattling.'
        : 'You hear chains rattling and gears turning.');
}

function heroAt(point, state) {
    return state.u?.ux === point.x && state.u?.uy === point.y;
}

async function announceBridgeDestruction(bridge, wall, under, state) {
    const overLava = under === DB_LAVA;
    if (under === DB_MOAT || overLava) {
        const liquid = overLava ? 'lava' : 'moat';
        const raised = bridge.location.typ === DRAWBRIDGE_UP;
        const visiblePoint = raised ? wall : bridge;
        if (cansee(visiblePoint.x, visiblePoint.y)
            || heroAt(visiblePoint, state)) {
            await plineWithContinuation(raised
                ? `The portcullis of the drawbridge falls into the ${liquid}!`
                : `The drawbridge collapses into the ${liquid}!`);
        } else if (!state.u?.deaf && !state.deaf) {
            await plineWithContinuation('You hear a loud *SPLASH*!');
        }
        return;
    }

    if (cansee(bridge.x, bridge.y) || heroAt(bridge, state))
        await plineWithContinuation('The drawbridge disintegrates!');
    else if (!state.u?.deaf && !state.deaf)
        await plineWithContinuation('You hear a loud *CRASH*!');
}

export async function openDrawbridge(x, y, state = game, options = {}) {
    const bridgeLocation = state.level?.at(x, y);
    if (bridgeLocation?.typ !== DRAWBRIDGE_UP) return false;
    const wall = drawbridgeWallAt(x, y, state);
    if (!wall) return false;
    const bridge = { x, y, location: bridgeLocation };
    await announceBridgeMovement(bridge, wall, true, state);

    bridgeLocation.typ = DRAWBRIDGE_DOWN;
    wall.location.typ = DOOR;
    wall.location.doormask = D_NODOOR;
    await moveDrawbridgeOccupants(bridge, wall, state, options);
    clearDrawbridgeSquares(bridge, wall, false, state);
    newsym(x, y);
    newsym(wall.x, wall.y);
    vision_note_blocker_change(wall.x, wall.y);
    if (Is_stronghold(state.u?.uz)) {
        if (!state.u.uevent) state.u.uevent = {};
        state.u.uevent.uopened_dbridge = true;
    }
    return true;
}

export async function closeDrawbridge(x, y, state = game, options = {}) {
    const bridgeLocation = state.level?.at(x, y);
    if (bridgeLocation?.typ !== DRAWBRIDGE_DOWN) return false;
    const wall = drawbridgeWallAt(x, y, state);
    if (!wall) return false;
    const bridge = { x, y, location: bridgeLocation };
    await announceBridgeMovement(bridge, wall, false, state);

    bridgeLocation.typ = DRAWBRIDGE_UP;
    wall.location.typ = DBWALL;
    wall.location.horizontal = [DB_NORTH, DB_SOUTH].includes(
        (bridgeLocation.drawbridgemask || 0) & DB_DIR,
    );
    wall.location.wall_info = W_NONDIGGABLE;
    await moveDrawbridgeOccupants(bridge, wall, state, options);
    clearDrawbridgeSquares(bridge, wall, true, state);
    newsym(x, y);
    newsym(wall.x, wall.y);
    vision_note_blocker_change(wall.x, wall.y);
    return true;
}

export async function destroyDrawbridge(x, y, state = game, options = {}) {
    const bridgeLocation = state.level?.at(x, y);
    if (!bridgeLocation || !IS_DRAWBRIDGE(bridgeLocation.typ)) return false;
    const wall = drawbridgeWallAt(x, y, state);
    if (!wall) return false;
    const bridge = { x, y, location: bridgeLocation };
    const under = (bridgeLocation.drawbridgemask || 0) & DB_UNDER;

    await announceBridgeDestruction(bridge, wall, under, state);
    if (under === DB_MOAT || under === DB_LAVA) {
        bridgeLocation.typ = under === DB_LAVA ? LAVAPOOL : MOAT;
        bridgeLocation.drawbridgemask = 0;
        const boulder = state.level.objects?.[x]?.[y]?.find(
            object => object.otyp === BOULDER,
        );
        if (boulder)
            await dropBoulderIntoLiquid(boulder, x, y, state);
    } else {
        bridgeLocation.typ = under === DB_ICE ? ICE : ROOM;
        bridgeLocation.icedpool = under === DB_ICE ? ICED_MOAT : 0;
    }
    wakeMonstersNear(x, y, 500, state);
    wall.location.typ = DOOR;
    wall.location.doormask = D_NODOOR;
    removeTrapAt(bridge.x, bridge.y, state);
    removeTrapAt(wall.x, wall.y, state);
    removeEngravingAt(bridge.x, bridge.y, state);
    removeEngravingAt(wall.x, wall.y, state);
    await scatterDrawbridgeDebris(bridge, wall, state, options);
    newsym(bridge.x, bridge.y);
    newsym(wall.x, wall.y);
    vision_note_blocker_change(wall.x, wall.y);
    vision_recalc(0);

    if (Is_stronghold(state.u?.uz)) {
        if (!state.u.uevent) state.u.uevent = {};
        state.u.uevent.uopened_dbridge = true;
    }
    await destroyDrawbridgeOccupants(bridge, wall, state, options);
    if (Is_stronghold(state.u?.uz))
        state.u.uevent.uheard_tune = 3;
    return true;
}

export async function toggleDrawbridge(x, y, state = game, options = {}) {
    const location = state.level?.at(x, y);
    if (location?.typ === DRAWBRIDGE_UP)
        return await openDrawbridge(x, y, state, options);
    if (location?.typ === DRAWBRIDGE_DOWN)
        return await closeDrawbridge(x, y, state, options);
    return false;
}
