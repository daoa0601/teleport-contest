// C ref: dungeon.c surface().

import {
    ALTAR, CLOUD, DOOR, DRAWBRIDGE_DOWN, FOUNTAIN, GRAVE, ICE,
    IS_AIR, IS_LAVA, IS_POOL, IS_ROOM, IS_WALL, Is_waterlevel, Is_earthlevel,
    Is_firelevel, In_quest, SHOPBASE, TEMPLE, VAULT, SDOOR,
    DRAWBRIDGE_UP, LAVAPOOL, LAVAWALL, MOAT, POOL, WATER, isok,
} from './const.js';
import { game, requireGameLevel } from './gstate.js';
import type { GameState } from './game_state.js';
import type { DungeonLocation } from './dungeon_types.js';
import { displayLiquidName } from './display.js';
import { drawbridgeUnderlyingType } from './drawbridge_terrain.js';
import { onQuestStart } from './quest.js';
import { heroIsHallucinating } from './senses.js';
import { roomsAt } from './room.js';

// C pager.c:waterbody_name(). The liquid name is chosen before a caller
// changes terrain, even when that caller will not print it.
export function waterbodyName(x: number, y: number, state: GameState = game): string {
    if (!isok(x, y)) return 'drink';
    const location = requireGameLevel(state).requireAt(x, y);
    const type = location.typ === DRAWBRIDGE_UP
        ? drawbridgeUnderlyingType(location.drawbridgemask ?? 0) : location.typ;
    const hallucinating = heroIsHallucinating(state) && !state.program_state.gameover;
    if (type === LAVAPOOL) return `molten ${displayLiquidName('lava', state)}`;
    if (type === ICE) return hallucinating
        ? `frozen ${displayLiquidName('water', state)}` : 'ice';
    if (type === POOL) return `pool of ${displayLiquidName('water', state)}`;
    if (type === MOAT) {
        if (hallucinating) return `deep ${displayLiquidName('water', state)}`;
        const here = (level: DungeonLocation | null | undefined): boolean =>
            !!level && level.dnum === state.u.uz?.dnum
                && level.dlevel === state.u.uz?.dlevel;
        if (here(state.medusa_level)) return 'shallow sea';
        if (here(state.juiblex_level)) return 'swamp';
        if (state.urole?.key === 'samurai' && onQuestStart(state)) return 'pond';
        return 'moat';
    }
    if (type === WATER) return Is_waterlevel(state.u.uz)
        ? 'limitless water' : `wall of ${displayLiquidName('water', state)}`;
    if (type === LAVAWALL) return `wall of ${displayLiquidName('lava', state)}`;
    return 'water';
}


export function surfaceName(x: number, y: number, state: GameState = game): string {
    const type = state.level?.at?.(x, y)?.typ;
    if (type === undefined) return 'ground';
    if (IS_AIR(type)) return type === CLOUD ? 'cloud' : 'air';
    if (IS_POOL(type))
        return state.underwater || state.u?.uinwater ? 'bottom' : 'water';
    if (type === ICE) return 'ice';
    if (IS_LAVA(type)) return displayLiquidName('lava', state);
    if (type === DRAWBRIDGE_DOWN) return 'bridge';
    if (type === ALTAR) return 'altar';
    if (type === GRAVE) return 'headstone';
    if (type === FOUNTAIN) return 'fountain';
    for (let stair = state.stairs; stair; stair = stair.next) {
        if (stair.sx === x && stair.sy === y) return 'stairs';
    }
    if (IS_WALL(type) || type === SDOOR) return 'wall';
    if (type === DOOR) return 'doorway';
    return IS_ROOM(type) ? 'floor' : 'ground';
}

// C ref: dungeon.c ceiling().
export function ceilingName(x: number, y: number, state: GameState = game): string {
    const type = state.level?.at?.(x, y)?.typ;
    if (roomsAt(state.level, x, y, VAULT).length) return "vault's ceiling";
    if (roomsAt(state.level, x, y, TEMPLE).length) return "temple's ceiling";
    if (roomsAt(state.level, x, y, SHOPBASE).length) return "shop's ceiling";
    if (Is_waterlevel(state.u?.uz)) return 'water above';
    if (type !== undefined && IS_AIR(type)) return 'sky';
    if (Is_firelevel(state.u?.uz)) return 'flames above';
    if (In_quest(state.u?.uz)) return 'expanse above';
    if (state.underwater || state.u?.uinwater) return "water's surface";
    return type !== undefined && ((IS_ROOM(type) && !Is_earthlevel(state.u?.uz))
        || IS_WALL(type) || type === DOOR || type === SDOOR)
        ? 'ceiling' : 'rock cavern';
}
