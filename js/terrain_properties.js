// Terrain and airborne predicates shared by placement, movement, and traps.
// C refs: mon.c:m_in_air(), has_ceiling(), Is_waterlevel().
import { game } from './gstate.js';
import { ACCESSIBLE, DB_LAVA, DB_MOAT, DB_UNDER, DOOR, D_CLOSED, D_LOCKED, DRAWBRIDGE_UP, DBWALL, IS_WATERWALL, DB_ICE, ICE, LADDER, STAIRS, LAVAPOOL, LAVAWALL, MOAT, POOL, WATER, isok, } from './const.js';
import { MONSTER_FLAGS1, MONSTER_SYMBOL } from './monster_data.js';
import { drawbridgeUnderlyingType } from './drawbridge_terrain.js';
const M1_FLY = 0x00000001;
const M1_CLING = 0x00000010;
const S_EYE = 5;
const S_LIGHT = 25;
export function levelHasCeiling(state = game) {
    const current = state.u.uz;
    const astral = state.astral_level;
    const earth = state.earth_level;
    const inEndgame = !!current && !!astral && current.dnum === astral.dnum;
    const onEarth = !!current && !!earth
        && current.dnum === earth.dnum && current.dlevel === earth.dlevel;
    return !inEndgame || onEarth;
}
export function monsterFliesOrFloats(monster) {
    if (!monster)
        return false;
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    const symbol = MONSTER_SYMBOL[monster?.mnum];
    return !!(flags & M1_FLY) || symbol === S_EYE || symbol === S_LIGHT;
}
export function monsterInAir(monster, state = game) {
    if (!monster)
        return false;
    if (monsterFliesOrFloats(monster))
        return true;
    const flags = MONSTER_FLAGS1[monster.mnum] ?? 0;
    return !!(flags & M1_CLING)
        && levelHasCeiling(state)
        && !!monster.mundetected;
}
export function levelIsWaterLevel(state = game) {
    const level = state.u?.uz;
    const water = state.water_level;
    return !!level && !!water && level.dnum === water.dnum && level.dlevel === water.dlevel;
}
// C ref: dbridge.c is_pool().
export function isPoolAt(x, y, state = game) {
    if (!isok(x, y))
        return false;
    const location = state.level?.at?.(x, y);
    if (!location)
        return false;
    if ([POOL, MOAT, WATER].includes(location.typ))
        return true;
    return isMoatAt(x, y, state);
}
// C dbridge.c:is_moat(). Juiblex's swamp water is a pool, not a moat.
export function isMoatAt(x, y, state = game) {
    if (!isok(x, y))
        return false;
    const location = state.level?.at(x, y);
    if (!location)
        return false;
    const juiblex = state.juiblex_level;
    const current = state.u.uz;
    const onJuiblex = juiblex && current && current.dnum === juiblex.dnum
        && current.dlevel === juiblex.dlevel;
    return !onJuiblex && (location.typ === MOAT
        || (location.typ === DRAWBRIDGE_UP
            && ((location.drawbridgemask ?? 0) & DB_UNDER) === DB_MOAT));
}
export function isLavaAt(x, y, state = game) {
    if (!isok(x, y))
        return false;
    const location = state.level?.at?.(x, y);
    if (!location)
        return false;
    if (location.typ === LAVAPOOL || location.typ === LAVAWALL)
        return true;
    return location.typ === DRAWBRIDGE_UP
        && ((location.drawbridgemask ?? 0) & DB_UNDER) === DB_LAVA;
}
// C dbridge.c:is_pool_or_lava().
export function isPoolOrLavaAt(x, y, state = game) {
    return isPoolAt(x, y, state) || isLavaAt(x, y, state);
}
// C dbridge.c:is_waterwall(). WATER remains a wall on the Plane of Water.
export function isWaterwallAt(x, y, state = game) {
    if (!isok(x, y))
        return false;
    const location = state.level?.at(x, y);
    return !!location && IS_WATERWALL(location.typ);
}
// C dbridge.c:is_db_wall(): only the closed portcullis, not its span.
export function isDrawbridgeWallAt(x, y, state = game) {
    return state.level?.at(x, y)?.typ === DBWALL;
}
// C display.h:covers_objects()/covers_traps(). Unlike is_lava(), the
// lava check here deliberately excludes lava beneath a raised bridge.
export function terrainCoversObjectsAt(x, y, state = game) {
    const type = state.level?.at(x, y)?.typ;
    return (isPoolAt(x, y, state) && !(state.underwater || state.u.uinwater))
        || type === LAVAPOOL || type === LAVAWALL;
}
// C dbridge.c:is_ice(). A lowered drawbridge covers its frozen water.
export function isIceAt(x, y, state = game) {
    if (!isok(x, y))
        return false;
    const location = state.level?.at(x, y);
    if (!location)
        return false;
    return location.typ === ICE || (location.typ === DRAWBRIDGE_UP
        && ((location.drawbridgemask ?? 0) & DB_UNDER) === DB_ICE);
}
// C monmove.c:accessible(), including SURFACE_AT() at a raised drawbridge.
export function isAccessibleAt(x, y, state = game) {
    const location = state.level?.at(x, y);
    if (!location)
        return false;
    const surface = location.typ === DRAWBRIDGE_UP
        ? drawbridgeUnderlyingType(location.drawbridgemask ?? 0) : location.typ;
    const closedDoor = location.typ === DOOR
        && ((location.doormask ?? 0) & (D_CLOSED | D_LOCKED));
    return ACCESSIBLE(surface) && !closedDoor;
}
// C rm.h:CAN_OVERWRITE_TERRAIN(). Explicit Lua map and feature writes
// have their own native rules and do not use this guard.
export function canOverwriteTerrain(type, state = game) {
    return !!state.iflags.debug_overwrite_stairs || (type !== STAIRS && type !== LADDER);
}
//# sourceMappingURL=terrain_properties.js.map