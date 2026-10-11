import { DB_ICE, DB_LAVA, DB_MOAT, DB_UNDER, ICE, LAVAPOOL, MOAT, STONE, } from './const.js';
// C dbridge.c:db_under_typ(), also used by SURFACE_AT.
export function drawbridgeUnderlyingType(mask) {
    switch (mask & DB_UNDER) {
        case DB_ICE: return ICE;
        case DB_LAVA: return LAVAPOOL;
        case DB_MOAT: return MOAT;
        default: return STONE;
    }
}
//# sourceMappingURL=drawbridge_terrain.js.map