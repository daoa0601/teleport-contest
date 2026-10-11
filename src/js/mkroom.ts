// mkroom.js - room coordinate selection.
// C refs: mkroom.c somexy(), somexyspace(); mklev.c occupied().

import { game } from './gstate.js';
import { rn1 } from './rng.js';
import {
    CORR, ICE, IS_FURNITURE, IS_LAVA, IS_POOL, IS_WALL,
    ROOM, ROOMOFFSET, isok,
} from './const.js';
import { insideRoom } from './room.js';
import type { GameState } from './game_state.js';
import type { Position, Rectangle, Room } from './map_types.js';

export function somex(room: Rectangle): number {
    return rn1(room.hx - room.lx + 1, room.lx);
}

export function somey(room: Rectangle): number {
    return rn1(room.hy - room.ly + 1, room.ly);
}

export function occupied(x: number, y: number, state: GameState = game): boolean {
    const location = state.level?.at?.(x, y);
    if (!location) return false;
    const trapped = state.level?.traps?.some(trap =>
        trap.tx === x && trap.ty === y);
    return !!(trapped || IS_FURNITURE(location.typ)
        || IS_LAVA(location.typ) || IS_POOL(location.typ));
}

export function somexy(room: Room, coordinate: Position, state: GameState = game): boolean {
    if (room.irregular) {
        const roomNumber = (room.roomnoidx ?? -1) + ROOMOFFSET;
        let attempts = 0;
        while (attempts++ < 100) {
            coordinate.x = somex(room);
            coordinate.y = somey(room);
            const location = state.level?.at?.(coordinate.x, coordinate.y);
            if (location && !location.edge
                && location.roomno === roomNumber) return true;
        }
        for (coordinate.x = room.lx; coordinate.x <= room.hx;
            coordinate.x++) {
            for (coordinate.y = room.ly; coordinate.y <= room.hy;
                coordinate.y++) {
                const location = state.level?.at?.(
                    coordinate.x, coordinate.y,
                );
                if (location && !location.edge
                    && location.roomno === roomNumber) return true;
            }
        }
        return false;
    }

    if (!room.nsubrooms) {
        coordinate.x = somex(room);
        coordinate.y = somey(room);
        return true;
    }

    let attempts = 0;
    while (attempts++ < 100) {
        coordinate.x = somex(room);
        coordinate.y = somey(room);
        const location = state.level?.at?.(coordinate.x, coordinate.y);
        if (location && IS_WALL(location.typ)) continue;
        if ((room.sbrooms || []).some(subroom =>
            insideRoom(
                state.level, subroom, coordinate.x, coordinate.y,
            ))) continue;
        return true;
    }
    return false;
}

export function somexyspace(room: Room, coordinate: Position, state: GameState = game): boolean {
    let attempts = 0;
    let valid;
    do {
        valid = somexy(room, coordinate, state)
            && isok(coordinate.x, coordinate.y)
            && !occupied(coordinate.x, coordinate.y, state);
        if (valid) {
            const location = state.level?.at?.(coordinate.x, coordinate.y);
            valid = !!location && [ROOM, CORR, ICE].includes(location.typ);
        }
    } while (attempts++ < 100 && !valid);
    return !!valid;
}
