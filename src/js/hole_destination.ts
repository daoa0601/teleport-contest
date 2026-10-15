// C trap.c:dng_bottom() and clamp_hole_destination(). Saved holes can
// point beyond the current dungeon or a progression barrier.
import { In_hell, In_quest } from './const.js';
import type { DungeonLocation } from './dungeon_types.js';
import type { GameState } from './game_state.js';
import { game } from './gstate.js';

export function clampHoleDestination(destination: DungeonLocation, state: GameState = game): DungeonLocation {
    const dungeon = state.dungeons[destination.dnum];
    if (!dungeon) throw new Error(`Hole leads to absent dungeon ${destination.dnum}`);
    let bottom = dungeon.num_dunlevs;
    if (In_quest(destination)) {
        const locate = state.specialLevels?.get('x-loca');
        if (!locate) throw new Error('Quest falls require the locate level');
        if (dungeon.dunlev_ureached < locate.dlevel) bottom = locate.dlevel;
    } else if (In_hell(destination, state) && !state.u.uevent?.invoked) {
        bottom--;
    }
    return { dnum: destination.dnum, dlevel: Math.min(destination.dlevel, bottom) };
}
