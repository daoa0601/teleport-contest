// C ref: dungeon.c surface().

import {
    ALTAR, CLOUD, DOOR, DRAWBRIDGE_DOWN, FOUNTAIN, GRAVE, ICE,
    IS_AIR, IS_LAVA, IS_POOL, IS_ROOM, IS_WALL, Is_waterlevel, SDOOR,
} from './const.js';
import { game } from './gstate.js';

export function surfaceName(x, y, state = game) {
    const type = state.level?.at?.(x, y)?.typ;
    if (IS_AIR(type)) return type === CLOUD ? 'cloud' : 'air';
    if (IS_POOL(type))
        return state.underwater || state.u?.uinwater ? 'bottom' : 'water';
    if (type === ICE) return 'ice';
    if (IS_LAVA(type)) return 'lava';
    if (type === DRAWBRIDGE_DOWN) return 'bridge';
    if (type === ALTAR) return 'altar';
    if (type === GRAVE) return 'headstone';
    if (type === FOUNTAIN) return 'fountain';
    if (IS_WALL(type) || type === SDOOR) return 'wall';
    if (type === DOOR) return 'doorway';
    return IS_ROOM(type) ? 'floor' : 'ground';
}

// C ref: dungeon.c ceiling().
export function ceilingName(x, y, state = game) {
    const type = state.level?.at?.(x, y)?.typ;
    if (Is_waterlevel(state.u?.uz)) return 'water above';
    if (IS_AIR(type)) return 'sky';
    if (state.underwater || state.u?.uinwater) return "water's surface";
    return IS_ROOM(type) || IS_WALL(type) || type === DOOR || type === SDOOR
        ? 'ceiling' : 'rock cavern';
}
