// Drawbridge location and movement.
// C ref: dbridge.c find_drawbridge(), open_drawbridge(), close_drawbridge().

import {
    DBWALL, DB_DIR, DB_EAST, DB_NORTH, DB_SOUTH, DB_WEST, DOOR,
    DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, D_NODOOR, IS_DRAWBRIDGE,
    W_NONDIGGABLE, isok,
} from './const.js';
import {
    newsym, plineWithContinuation,
} from './display.js';
import { game } from './gstate.js';
import { stopAllObjectTimers } from './object_timers.js';
import { cansee, vision_note_blocker_change } from './vision.js';

function directionFromBridgeToWall(bridge) {
    const direction = (bridge.drawbridgemask || 0) & DB_DIR;
    if (direction === DB_NORTH) return { dx: 0, dy: -1 };
    if (direction === DB_SOUTH) return { dx: 0, dy: 1 };
    if (direction === DB_EAST) return { dx: 1, dy: 0 };
    return { dx: -1, dy: 0 };
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

export async function openDrawbridge(x, y, state = game) {
    const bridgeLocation = state.level?.at(x, y);
    if (bridgeLocation?.typ !== DRAWBRIDGE_UP) return false;
    const wall = drawbridgeWallAt(x, y, state);
    if (!wall) return false;
    const bridge = { x, y, location: bridgeLocation };
    await announceBridgeMovement(bridge, wall, true, state);

    bridgeLocation.typ = DRAWBRIDGE_DOWN;
    wall.location.typ = DOOR;
    wall.location.doormask = D_NODOOR;
    clearDrawbridgeSquares(bridge, wall, false, state);
    newsym(x, y);
    newsym(wall.x, wall.y);
    vision_note_blocker_change(wall.x, wall.y);
    if (!state.u.uevent) state.u.uevent = {};
    state.u.uevent.uopened_dbridge = true;
    return true;
}

export async function closeDrawbridge(x, y, state = game) {
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
    clearDrawbridgeSquares(bridge, wall, true, state);
    newsym(x, y);
    newsym(wall.x, wall.y);
    vision_note_blocker_change(wall.x, wall.y);
    return true;
}

export async function toggleDrawbridge(x, y, state = game) {
    const location = state.level?.at(x, y);
    if (location?.typ === DRAWBRIDGE_UP)
        return await openDrawbridge(x, y, state);
    if (location?.typ === DRAWBRIDGE_DOWN)
        return await closeDrawbridge(x, y, state);
    return false;
}
