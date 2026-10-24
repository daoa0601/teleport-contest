// C ref: sp_lev.c get_location(), get_location_coord(), is_ok_location().
import { IS_OBSTRUCTED, Is_waterlevel, SPACE_POS, COLNO, ROWNO, isok } from './const.js';
import { impossible } from './diagnostics.js';
import { game, requireGameLevel } from './gstate.js';
import { somexy } from './mkroom.js';
import { BOULDER } from './object_data.js';
import { rn2 } from './rng.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
import type { MapLocation, Position, Room } from './map_types.js';

interface LocationContext {
    xstart: number;
    ystart: number;
    width: number;
    height: number;
    _room?: Room | null | undefined;
}

export const DRY = 0x01;
export const WET = 0x02;
export const HOT = 0x04;
export const SOLID = 0x08;
export const ANY_LOC = 0x10;
export const NO_LOC_WARN = 0x20;
export const SPACELOC = 0x40;

type LocationFilter = (location: MapLocation, x: number, y: number) => boolean;

export async function getLocationCoord(context: LocationContext, coordinate: Position | null,
    humidity: number, filter?: LocationFilter): Promise<Position> {
    // sp_lev.h packs explicit axes as unsigned bytes; only (-1, -1)
    // denotes a random coordinate at the Lua boundary.
    if (coordinate && (coordinate.x !== -1 || coordinate.y !== -1))
        return await getPackedLocationCoord(context, coordinate, humidity, filter);
    const input = { x: -1, y: -1 };
    const point = await getLocation(context, input,
        humidity | NO_LOC_WARN, filter);
    if (point.x === -1 && point.y === -1)
        return await getLocation(context, point, humidity, filter);
    return point;
}

// Callers which always use SP_COORD_PACK do not recognize the random sentinel.
export async function getPackedLocationCoord(context: LocationContext, coordinate: Position,
    humidity: number, filter?: LocationFilter): Promise<Position> {
    return await getLocation(context,
        { x: coordinate.x & 0xff, y: coordinate.y & 0xff }, humidity, filter);
}

export async function getLocation(context: LocationContext, coordinate: Position,
    humidity: number, filter?: LocationFilter): Promise<Position> {
    const room = context._room;
    const mx = room ? room.lx : context.xstart;
    const my = room ? room.ly : context.ystart;
    const sx = room ? room.hx - mx + 1 : context.width;
    const sy = room ? room.hy - my + 1 : context.height;
    let point = { ...coordinate };
    if (point.x >= 0) {
        point.x += mx;
        point.y += my;
    } else {
        let found = false;
        for (let attempt = 0; attempt < 100; attempt++) {
            if (room) somexy(room, point);
            else point = { x: mx + rn2(sx), y: my + rn2(sy) };
            if (isOkLocation(point.x, point.y, humidity, filter)) {
                found = true;
                break;
            }
        }
        if (!found) {
            for (let x = 0; x < sx && !found; x++)
                for (let y = 0; y < sy; y++) {
                    point = { x: mx + x, y: my + y };
                    if (isOkLocation(point.x, point.y, humidity, filter)) {
                        found = true;
                        break;
                    }
                }
            if (!found) {
                if (humidity & NO_LOC_WARN) point = { x: -1, y: -1 };
                else await impossible("get_location:  can't find a place!");
            }
        }
    }
    if (!(humidity & ANY_LOC) && !isok(point.x, point.y))
        point = humidity & NO_LOC_WARN ? { x: -1, y: -1 }
            : { x: (COLNO - 1) & ~1, y: (ROWNO - 1) & ~1 };
    return point;
}

export function isOkLocation(x: number, y: number, humidity: number,
    filter?: LocationFilter): boolean {
    if (Is_waterlevel(game.u.uz)) return true;
    const level = requireGameLevel();
    const location = level.at(x, y);
    if (filter) return !!location && filter(location, x, y);
    if (humidity & ANY_LOC) return true;
    if (!location) return false;
    if ((humidity & SOLID) && IS_OBSTRUCTED(location.typ)) return true;
    if ((humidity & (DRY | SPACELOC)) && SPACE_POS(location.typ)) {
        const boulder = level.objects[x]?.[y]?.some(object => object.otyp === BOULDER);
        if (!boulder || (humidity & SOLID)) return true;
    }
    if ((humidity & WET) && isPoolAt(x, y)) return true;
    return !!((humidity & HOT) && isLavaAt(x, y));
}
