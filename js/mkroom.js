// mkroom.js - room coordinate selection.
// C refs: mkroom.c somexy(), somexyspace(); mklev.c occupied().
import { game } from './gstate.js';
import { isPoolOrLavaAt } from './terrain_properties.js';
import { rn1 } from './rng.js';
import { CmapSymbol } from './glyph_numbers.js';
import { AIR, ALTAR, BLCORNER, BRCORNER, CLOUD, CORR, CROSSWALL, DBWALL, DOOR, DRAWBRIDGE_DOWN, FOUNTAIN, GRAVE, HWALL, ICE, IRONBARS, IS_FURNITURE, IS_WALL, LADDER, LAVAPOOL, LAVAWALL, POOL, ROOM, ROOMOFFSET, SINK, STAIRS, STONE, TDWALL, THRONE, TLCORNER, TLWALL, TRCORNER, TREE, TRWALL, TUWALL, VWALL, WATER, isok, } from './const.js';
import { insideRoom } from './room.js';
// C mkroom.c:cmap_to_type(). Display symbols and terrain have separate
// number spaces, including symbols with several appearances for one terrain.
export function cmapToType(symbol) {
    switch (symbol) {
        case CmapSymbol.stone: return STONE;
        case CmapSymbol.vwall: return VWALL;
        case CmapSymbol.hwall: return HWALL;
        case CmapSymbol.tlcorn: return TLCORNER;
        case CmapSymbol.trcorn: return TRCORNER;
        case CmapSymbol.blcorn: return BLCORNER;
        case CmapSymbol.brcorn: return BRCORNER;
        case CmapSymbol.crwall: return CROSSWALL;
        case CmapSymbol.tuwall: return TUWALL;
        case CmapSymbol.tdwall: return TDWALL;
        case CmapSymbol.tlwall: return TLWALL;
        case CmapSymbol.trwall: return TRWALL;
        case CmapSymbol.ndoor:
        case CmapSymbol.vodoor:
        case CmapSymbol.hodoor:
        case CmapSymbol.vcdoor:
        case CmapSymbol.hcdoor: return DOOR;
        case CmapSymbol.bars: return IRONBARS;
        case CmapSymbol.tree: return TREE;
        case CmapSymbol.room:
        case CmapSymbol.darkroom: return ROOM;
        case CmapSymbol.corr:
        case CmapSymbol.litcorr: return CORR;
        case CmapSymbol.upstair:
        case CmapSymbol.dnstair: return STAIRS;
        case CmapSymbol.upladder:
        case CmapSymbol.dnladder: return LADDER;
        case CmapSymbol.altar: return ALTAR;
        case CmapSymbol.grave: return GRAVE;
        case CmapSymbol.throne: return THRONE;
        case CmapSymbol.sink: return SINK;
        case CmapSymbol.fountain: return FOUNTAIN;
        case CmapSymbol.pool: return POOL;
        case CmapSymbol.ice: return ICE;
        case CmapSymbol.lava: return LAVAPOOL;
        case CmapSymbol.vodbridge:
        case CmapSymbol.hodbridge: return DRAWBRIDGE_DOWN;
        case CmapSymbol.vcdbridge:
        case CmapSymbol.hcdbridge: return DBWALL;
        case CmapSymbol.air: return AIR;
        case CmapSymbol.cloud: return CLOUD;
        case CmapSymbol.water: return WATER;
        case CmapSymbol.lavawall: return LAVAWALL;
        default: return STONE;
    }
}
export function somex(room) {
    return rn1(room.hx - room.lx + 1, room.lx);
}
export function somey(room) {
    return rn1(room.hy - room.ly + 1, room.ly);
}
export function occupied(x, y, state = game) {
    const location = state.level?.at?.(x, y);
    if (!location)
        return false;
    const trapped = state.level?.traps?.some(trap => trap.tx === x && trap.ty === y);
    return !!(trapped || IS_FURNITURE(location.typ)
        || isPoolOrLavaAt(x, y, state));
}
export function somexy(room, coordinate, state = game) {
    if (room.irregular) {
        const roomNumber = (room.roomnoidx ?? -1) + ROOMOFFSET;
        let attempts = 0;
        while (attempts++ < 100) {
            coordinate.x = somex(room);
            coordinate.y = somey(room);
            const location = state.level?.at?.(coordinate.x, coordinate.y);
            if (location && !location.edge
                && location.roomno === roomNumber)
                return true;
        }
        for (coordinate.x = room.lx; coordinate.x <= room.hx; coordinate.x++) {
            for (coordinate.y = room.ly; coordinate.y <= room.hy; coordinate.y++) {
                const location = state.level?.at?.(coordinate.x, coordinate.y);
                if (location && !location.edge
                    && location.roomno === roomNumber)
                    return true;
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
        if (location && IS_WALL(location.typ))
            continue;
        if ((room.sbrooms || []).some(subroom => insideRoom(state.level, subroom, coordinate.x, coordinate.y)))
            continue;
        return true;
    }
    return false;
}
export function somexyspace(room, coordinate, state = game) {
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
//# sourceMappingURL=mkroom.js.map