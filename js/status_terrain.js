// hack.c:classify_terrain() and botl.c:terrain_descr[].
import { CORR, DOOR, DRAWBRIDGE_UP, D_CLOSED, D_ISOPEN, D_LOCKED, D_TRAPPED, Is_earthlevel, Is_juiblex_level, Is_waterlevel, MAX_TYPE, MOAT, ROOM, STONE, TREE, WATER } from './const.js';
import { drawbridgeUnderlyingType } from './drawbridge_terrain.js';
const FLOOR = 39, GROUND = 40, OPEN_DOOR = 41, SHUT_DOOR = 42, SWAMP = 43, SUBMERGED = 44, SEA = 45, WATER_WALL = 46;
const descriptions = [
    'Stone', 'Wall', 'Wall', 'Wall', 'Wall', 'Wall', 'Wall', 'Wall', 'Wall', 'Wall',
    'Wall', 'Wall', 'Portcullis', 'Tree', 'Wall', 'Stone', 'Pool', 'Moat', 'Water', '(gap)',
    'Lava', 'LavaWall', 'Bars', 'Doorway', 'Corridor', 'Room', 'Stairs', 'Ladder', 'Fountain', 'Throne',
    'Sink', 'Grave', 'Altar', 'Ice', 'Bridge', 'Air', 'Cloud', '', 'Wall',
    'Floor', 'Ground', 'Open-door', 'Shut-door', 'Swamp', 'Submerged', 'Sea', 'WaterWall',
];
export function statusTerrain(state) {
    if (state.iflags.terrain_typ === undefined || state.iflags.terrain_typ === MAX_TYPE)
        classifyStatusTerrain(state);
    return descriptions[state.iflags.terrain_typ ?? MAX_TYPE] ?? '';
}
export function classifyStatusTerrain(state) {
    const typ = terrainType(state);
    if (typ === state.iflags.terrain_typ)
        return;
    state.iflags.terrain_typ = typ;
    if (state.flags.terrainstatus && !state.context.run)
        state.context.botl = true;
}
function terrainType(state) {
    const hero = state.u;
    const location = state.level?.at(hero.ux, hero.uy);
    if (!location)
        return MAX_TYPE;
    if (hero.uinwater)
        return SUBMERGED;
    // Native uses lastseentyp so blindness and disguised furniture cannot
    // reveal the real terrain through this optional field.
    const typ = location.lastseentyp ?? STONE;
    switch (typ) {
        case STONE: return state.level?.flags.arboreal ? TREE : STONE;
        case CORR:
        case ROOM: return Is_earthlevel(hero.uz) ? GROUND : FLOOR;
        case DOOR:
            if (location.doormask & D_ISOPEN)
                return OPEN_DOOR;
            return location.doormask & (D_CLOSED | D_LOCKED | D_TRAPPED) ? SHUT_DOOR : DOOR;
        case DRAWBRIDGE_UP: {
            const under = drawbridgeUnderlyingType(location.drawbridgemask ?? 0);
            return under === STONE ? GROUND : under;
        }
        case MOAT:
            if (state.medusa_level && hero.uz?.dnum === state.medusa_level.dnum
                && hero.uz.dlevel === state.medusa_level.dlevel)
                return SEA;
            return Is_juiblex_level(hero.uz) ? SWAMP : MOAT;
        case WATER: return Is_waterlevel(hero.uz) ? WATER : WATER_WALL;
        default: return typ;
    }
}
//# sourceMappingURL=status_terrain.js.map