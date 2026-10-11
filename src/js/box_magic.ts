import type { GameState } from './game_state.js';
import type { GameObject } from './object_types.js';
// Locking and opening magic applied to a box. C ref: lock.c boxlock().
import { game } from './gstate.js';
import { plineWithContinuation as pline } from './display.js';
import { OBJECT_NAMES, WAN_POLYMORPH, SPE_POLYMORPH } from './object_data.js';

export async function changeBoxLockByMagic(box: GameObject, source: Pick<GameObject, 'otyp'>, { state = game }: { state?: GameState } = {}) {
    const effect = OBJECT_NAMES[source.otyp];
    if (effect === 'locking' || effect === 'wizard lock') {
        if (box.olocked) return false;
        await pline('Klunk!');
        box.olocked = true;
        box.obroken = false;
        box.lknown = state.urole?.key === 'wizard';
        return true;
    }
    if (effect === 'opening' || effect === 'knock') {
        if (!box.olocked) {
            box.obroken = false;
            return false;
        }
        await pline('Klick!');
        box.olocked = false;
        box.lknown = state.urole?.key === 'wizard';
        return true;
    }
    if (source.otyp === WAN_POLYMORPH || source.otyp === SPE_POLYMORPH) {
        if (state.context?.xlock?.box === box) state.context.xlock = null;
        if (state._occupation?.key === 'pick-lock' && state._occupation.container === box)
            state._occupation = null;
    }
    return false;
}
