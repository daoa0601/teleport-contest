// C ref: sp_lev.c get_location(), get_location_coord(), is_ok_location().
import { IS_OBSTRUCTED, Is_waterlevel, SPACE_POS, COLNO, ROWNO } from './const.js';
import { isok } from './cmd.js';
import { impossible } from './diagnostics.js';
import { game, requireGameLevel } from './gstate.js';
import { somexy } from './mkroom.js';
import { BOULDER } from './object_data.js';
import { rn2 } from './rng.js';
import { isLavaAt, isPoolAt } from './dbridge.js';
export const DRY = 0x01;
export const WET = 0x02;
export const HOT = 0x04;
export const SOLID = 0x08;
export const ANY_LOC = 0x10;
export const NO_LOC_WARN = 0x20;
export const SPACELOC = 0x40;
// C sp_lev.c:get_location_coord(). Resolve a packed coordinate, retrying random placement if needed.
// Also C sp_lev.c:get_unpacked_coord(): inlined here (the -1 random
// sentinel and the explicit humidity flags).
export async function get_location_coord(context, coordinate, humidity, filter) {
    // sp_lev.h packs explicit axes as unsigned bytes; only (-1, -1)
    // denotes a random coordinate at the Lua boundary.
    if (coordinate && (coordinate.x !== -1 || coordinate.y !== -1))
        return await getPackedLocationCoord(context, coordinate, humidity, filter);
    const input = { x: -1, y: -1 };
    const point = await get_location(context, input, humidity | NO_LOC_WARN, filter);
    if (point.x === -1 && point.y === -1)
        return await get_location(context, point, humidity, filter);
    return point;
}
// Shared packed-coordinate form: sp_lev.h SP_COORD_PACK/SP_COORD_X/SP_COORD_Y.
// Unlike get_location_coord(), it never recognizes the random sentinel.
export async function getPackedLocationCoord(context, coordinate, humidity, filter) {
    return await get_location(context, { x: coordinate.x & 0xff, y: coordinate.y & 0xff }, humidity, filter);
}
// C sp_lev.c:get_location(). Resolve room/map coordinates and apply humidity constraints.
export async function get_location(context, coordinate, humidity, filter) {
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
            if (is_ok_location(point.x, point.y, humidity, filter)) {
                found = true;
                break;
            }
        }
        if (!found) {
            for (let x = 0; x < sx && !found; x++)
                for (let y = 0; y < sy; y++) {
                    point = { x: mx + x, y: my + y };
                    if (is_ok_location(point.x, point.y, humidity, filter)) {
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
// C sp_lev.c:is_ok_location(). The filter argument represents set_ok_location_func().
export function is_ok_location(x, y, humidity, filter) {
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