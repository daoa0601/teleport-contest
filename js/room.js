// room.js — decode NetHack's unified room-number namespace.
//
// C stores ordinary rooms and subrooms in separate arrays but gives map
// locations and resident records one encoded index space: ordinary rooms
// occupy [0, MAXNROFROOMS), then subrooms continue from MAXNROFROOMS.
// ROOMOFFSET is added only when that index is written into levl[].roomno.

import { MAXNROFROOMS, ROOMOFFSET } from './const.js';

export function roomForIndex(level, index) {
    if (!Number.isInteger(index) || index < 0) return null;
    if (index < MAXNROFROOMS)
        return level?.rooms?.[index] || null;
    return level?.subrooms?.[index - MAXNROFROOMS] || null;
}

export function roomForRoomno(level, roomno) {
    if (!Number.isInteger(roomno) || roomno < ROOMOFFSET) return null;
    return roomForIndex(level, roomno - ROOMOFFSET);
}

// C mkroom.c:inside_room().  Rectangular rooms include their one-cell
// perimeter; irregular rooms use the encoded map identity and exclude edge
// cells whose rectangular bounds do not describe their actual shape.
export function insideRoom(level, room, x, y) {
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
export function inTown(level, x, y) {
    if (!level?.flags?.has_town) return false;
    let hasSubrooms = false;
    for (const room of level.rooms || []) {
        // Native rooms are terminated by the first hx <= 0 sentinel.
        if (!(room?.hx > 0)) break;
        if ((room.nsubrooms ?? 0) <= 0) continue;
        hasSubrooms = true;
        if (insideRoom(level, room, x, y)) return true;
    }
    return !hasSubrooms;
}
