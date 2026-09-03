// What happens when a free object lands on a dungeon square.
// C ref: do.c flooreffects() boulder, lava, and pool branches.

import {
    IS_POOL, LAVAPOOL, MOAT, POOL, WATER, is_hole, is_pit,
} from './const.js';
import { place_object, stack_object } from './floor_object.js';
import { game } from './gstate.js';
import { deleteObject } from './object_delete.js';
import { BOULDER } from './object_data.js';
import { fillPitWithBoulderAt } from './pit_fill.js';
import { rnl, rn2 } from './rng.js';
import { destroyLavaFloorObjects, waterDamageObject } from './trap.js';
import { cansee } from './vision.js';

function squareIsVisible(state, x, y) {
    if (state === game) return cansee(x, y);
    if (state.blind || (state.u?.blindTurns ?? 0) > 0) return false;
    return !state.viz_array || !!(state.viz_array?.[y]?.[x] & 0x2);
}

async function publishAll(messages, publish) {
    for (const message of messages) await publish(message);
}

export async function landFloorObject(
    object,
    x,
    y,
    {
        state = game,
        publish = async () => {},
        random = rn2,
        luckRoll = rnl,
    } = {},
) {
    const location = state.level?.at?.(x, y);
    object.ox = x;
    object.oy = y;

    if (object.otyp === BOULDER
        && [MOAT, POOL, WATER, LAVAPOOL].includes(location?.typ)) {
        place_object(object, x, y, state);
        const { dropBoulderIntoLiquid } = await import('./boulder_pool.js');
        await dropBoulderIntoLiquid(object, x, y, state);
        return null;
    }

    const trap = state.level?.traps?.find(candidate =>
        candidate.tx === x && candidate.ty === y);
    if (object.otyp === BOULDER && trap
        && (is_pit(trap.ttyp) || is_hole(trap.ttyp))) {
        place_object(object, x, y, state);
        if (fillPitWithBoulderAt(x, y, state).filled) return null;
        return stack_object(object, state);
    }

    if (location?.typ === LAVAPOOL) {
        const landed = [object];
        await destroyLavaFloorObjects(landed, {
            publish,
            random,
            visible: squareIsVisible(state, x, y),
        });
        if (!landed.includes(object)) return null;
    } else if (IS_POOL(location?.typ)) {
        const messages = [];
        const result = await waterDamageObject(object, messages, state, {
            random,
            luckRoll,
        });
        await publishAll(messages, publish);
        if (result === 'destroyed') {
            deleteObject(object, state);
            return null;
        }
    }

    place_object(object, x, y, state);
    return stack_object(object, state);
}
