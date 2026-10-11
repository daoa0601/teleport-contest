// C trap.c:cnv_trap_obj(). Convert a set trap before releasing its occupants.
import { buryObject } from './buried_object.js';
import { newsym } from './display.js';
import { placeObject, stack_object } from './floor_object.js';
import { game, requireGameLevel, requireLiveGame } from './gstate.js';
import type { GameState } from './game_state.js';
import type { Trap } from './map_types.js';
import type { GameObject } from './object_types.js';
import { mksobj } from './mklev.js';
import { monsterAtPosition } from './monster_location.js';
import { DART } from './object_data.js';
import { sellHeroDroppedObject } from './shop_sell.js';
import { resetHeroTrap } from './terrain_movement.js';
import { deleteTrap } from './trap_lifecycle.js';
import { objectWeight } from './weight.js';

export async function convertTrapToObject(
    trap: Trap, objectType: number, count: number, state: GameState = game, { bury = false } = {},
): Promise<GameObject> {
    requireLiveGame(state);
    const object = await mksobj(objectType, true, false);
    object.quan = object.quantity = count;
    object.owt = objectWeight(object);
    if (objectType !== DART) object.opoisoned = 0;
    await placeObject(object, trap.tx, trap.ty, state);
    if (bury) {
        await buryObject(object, state);
    } else {
        if (trap.madeby_u) await sellHeroDroppedObject(object, trap.tx, trap.ty, state);
        await stack_object(object, state);
    }
    newsym(trap.tx, trap.ty);
    if (state.u.utrap && state.u.ux === trap.tx && state.u.uy === trap.ty) {
        await resetHeroTrap(true, state);
        if (state.program_state.gameover) return object;
    }
    const monster = monsterAtPosition(requireGameLevel(state), trap.tx, trap.ty);
    if (monster?.mtrapped) monster.mtrapped = 0;
    deleteTrap(trap, state);
    return object;
}
