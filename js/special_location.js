// C ref: sp_lev.c get_location(), get_location_coord(), is_ok_location().
import { IS_OBSTRUCTED, Is_waterlevel, SPACE_POS, COLNO, ROWNO, isok } from './const.js';
import { impossible } from './diagnostics.js';
import { game, requireGameLevel } from './gstate.js';
import { somexy } from './mkroom.js';
import { BOULDER } from './object_data.js';
import { rn2 } from './rng.js';
import { isLavaAt, isPoolAt } from './terrain_properties.js';
export const DRY = 0x01;
export const WET = 0x02;
export const HOT = 0x04;
export const SOLID = 0x08;
export const ANY_LOC = 0x10;
export const NO_LOC_WARN = 0x20;
export const SPACELOC = 0x40;
export async function getLocationCoord(context, coordinate, humidity, filter) {
    const random = coordinate === null || (coordinate.x === -1 && coordinate.y === -1);
    // sp_lev.h packs explicit axes as unsigned bytes; only (-1, -1)
    // denotes a random coordinate at the Lua boundary.
    const input = coordinate === null || random ? { x: -1, y: -1 }
        : { x: coordinate.x & 0xff, y: coordinate.y & 0xff };
    const point = await getLocation(context, input, humidity | (random ? NO_LOC_WARN : 0), filter);
    if (random && point.x === -1 && point.y === -1)
        return await getLocation(context, point, humidity, filter);
    return point;
}
export async function getLocation(context, coordinate, humidity, filter) {
    const room = context._room;
    const mx = room ? room.lx : context.xstart;
    const my = room ? room.ly : context.ystart;
    const sx = room ? room.hx - mx + 1 : context.width;
    const sy = room ? room.hy - my + 1 : context.height;
    let point = { ...coordinate };
    if (point.x >= 0) {
        point.x += mx;
        point.y += my;
    }
    else {
        let found = false;
        for (let attempt = 0; attempt < 100; attempt++) {
            if (room)
                somexy(room, point);
            else
                point = { x: mx + rn2(sx), y: my + rn2(sy) };
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
                if (humidity & NO_LOC_WARN)
                    point = { x: -1, y: -1 };
                else
                    await impossible("get_location:  can't find a place!");
            }
        }
    }
    if (!(humidity & ANY_LOC) && !isok(point.x, point.y))
        point = humidity & NO_LOC_WARN ? { x: -1, y: -1 }
            : { x: (COLNO - 1) & ~1, y: (ROWNO - 1) & ~1 };
    return point;
}
export function isOkLocation(x, y, humidity, filter) {
    if (Is_waterlevel(game.u.uz))
        return true;
    const level = requireGameLevel();
    const location = level.at(x, y);
    if (filter)
        return !!location && filter(location, x, y);
    if (humidity & ANY_LOC)
        return true;
    if (!location)
        return false;
    if ((humidity & SOLID) && IS_OBSTRUCTED(location.typ))
        return true;
    if ((humidity & (DRY | SPACELOC)) && SPACE_POS(location.typ)) {
        const boulder = level.objects[x]?.[y]?.some(object => object.otyp === BOULDER);
        if (!boulder || (humidity & SOLID))
            return true;
    }
    if ((humidity & WET) && isPoolAt(x, y))
        return true;
    return !!((humidity & HOT) && isLavaAt(x, y));
}
//# sourceMappingURL=special_location.js.map