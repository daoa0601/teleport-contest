// room.js — decode NetHack's unified room-number namespace.
//
// C stores ordinary rooms and subrooms in separate arrays but gives map
// locations and resident records one encoded index space: ordinary rooms
// occupy [0, MAXNROFROOMS), then subrooms continue from MAXNROFROOMS.
// ROOMOFFSET is added only when that index is written into levl[].roomno.

import {
    MAXNROFROOMS, NO_ROOM, ROOMOFFSET, SHARED, SHARED_PLUS, SHOPBASE,
} from './const.js';
import type { GameMap } from './game.js';
import type { GameState } from './game_state.js';
import { isRoom } from './map_types.js';
import type { Room } from './map_types.js';

type RoomMap = Pick<GameMap, 'rooms' | 'subrooms' | 'at' | 'flags'>;

export function roomForIndex(level: RoomMap | null | undefined, index: number): Room | null {
    if (!Number.isInteger(index) || index < 0) return null;
    if (index < MAXNROFROOMS) {
        const room = level?.rooms[index];
        return isRoom(room) ? room : null;
    }
    return level?.subrooms?.[index - MAXNROFROOMS] || null;
}

export function roomForRoomno(level: RoomMap | null | undefined, roomno: number): Room | null {
    if (!Number.isInteger(roomno) || roomno < ROOMOFFSET) return null;
    return roomForIndex(level, roomno - ROOMOFFSET);
}

function roomHasType(level: RoomMap | null | undefined, roomno: number, wantedType: number): boolean {
    if (!wantedType) return true;
    const roomType = roomForRoomno(level, roomno)?.rtype;
    return roomType === wantedType
        || wantedType === SHOPBASE && roomType !== undefined && roomType > SHOPBASE;
}

// C hack.c:in_rooms(). A boundary square can belong to the rooms beside it.
export function roomsAt(level: RoomMap | null | undefined, x: number, y: number, wantedType = 0): number[] {
    const roomno = level?.at?.(x, y)?.roomno ?? NO_ROOM;
    if (roomno === NO_ROOM) return [];
    if (roomno !== SHARED && roomno !== SHARED_PLUS) {
        return roomHasType(level, roomno, wantedType) ? [roomno] : [];
    }

    const step = roomno === SHARED ? 2 : 1;
    const rooms: number[] = [];
    for (let nx = x - 1; nx <= x + 1; nx += step) {
        for (let ny = y - 1; ny <= y + 1; ny += step) {
            const neighborRoom = level?.at?.(nx, ny)?.roomno ?? NO_ROOM;
            if (neighborRoom < ROOMOFFSET || rooms.includes(neighborRoom)
                || !roomHasType(level, neighborRoom, wantedType)) continue;
            rooms.unshift(neighborRoom);
        }
    }
    return rooms;
}

// C mkroom.c:inside_room().  Rectangular rooms include their one-cell
// perimeter; irregular rooms use the encoded map identity and exclude edge
// cells whose rectangular bounds do not describe their actual shape.
export function insideRoom(level: RoomMap | null | undefined, room: Room | null | undefined, x: number, y: number): boolean {
    if (!room || !Number.isInteger(x) || !Number.isInteger(y)) return false;
    if (room.irregular) {
        const loc = level?.at?.(x, y);
        return !!loc && !loc.edge
            && loc.roomno === (room.roomnoidx ?? -1) + ROOMOFFSET;
    }
    return x >= room.lx - 1 && x <= room.hx + 1
        && y >= room.ly - 1 && y <= room.hy + 1;
}

// C hack.c:in_town().  A level with town metadata and no room-form subrooms
// treats the whole level as town.  Otherwise, the top-level room which owns
// subrooms is the town envelope, including its ordinary room boundary.
export function inTown(level: RoomMap | null | undefined, x: number, y: number): boolean {
    if (!level?.flags?.has_town) return false;
    let hasSubrooms = false;
    for (const room of level.rooms || []) {
        // Native rooms are terminated by the first hx <= 0 sentinel.
        if (!isRoom(room) || !(room.hx > 0)) break;
        if ((room.nsubrooms ?? 0) <= 0) continue;
        hasSubrooms = true;
        if (insideRoom(level, room, x, y)) return true;
    }
    return !hasSubrooms;
}

// C u_init.c/u_init_misc() and hack.c:move_update().
export function initializeHeroRoomMembership(state: Pick<GameState, 'u' | '_emptyShops'>): void {
    const hero = state.u;
    hero.urooms = [];
    hero.urooms0 = [];
    hero.uentered = [];
    hero.ushops = [];
    hero.ushops0 = [];
    hero.ushops_entered = [];
    hero.ushops_left = [];
    state._emptyShops = [];
}

export function updateHeroRoomMembership(state: Pick<GameState, 'u' | 'level'>, leavingLevel = false): void {
    const u = state.u;
    if (!u.urooms || !u.ushops)
        throw new Error('Hero room membership is not initialized');
    const previousRooms = [...u.urooms];
    const previousShops = [...u.ushops];
    u.urooms0 = previousRooms;
    u.ushops0 = previousShops;
    if (leavingLevel) {
        u.urooms = [];
        u.uentered = [];
        u.ushops = [];
        u.ushops_entered = [];
        u.ushops_left = [...previousShops];
        return;
    }
    u.urooms = roomsAt(state.level, u.ux, u.uy);
    u.uentered = u.urooms.filter(roomno => !previousRooms.includes(roomno));
    const shops = u.urooms.filter(roomno => {
        const room = roomForRoomno(state.level, roomno);
        return room !== null && room.rtype >= SHOPBASE;
    });
    u.ushops = shops;
    u.ushops_entered = shops.filter(roomno => !previousShops.includes(roomno));
    u.ushops_left = previousShops.filter(roomno => !shops.includes(roomno));
}
