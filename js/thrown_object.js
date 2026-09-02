// thrown_object.js — Shared splitobj()/freeinv() ownership for one throw.
// C refs: dothrow.c throw_obj(), invent.c freeinv(), mkobj.c splitobj().

import { LOST_THROWN } from './const.js';
import {
    flush_screen, lastDirtyMapCursor, newsym, show_glyph_cell,
    transientObjectGlyph,
} from './display.js';
import { game } from './gstate.js';
import { splitObjectStack } from './object_stack.js';
import { cansee } from './vision.js';

const EQUIPMENT_SLOTS = [
    'uwep', 'uswapwep', 'uquiver', 'uarm', 'uarmu', 'uarmc', 'uarmh',
    'uarmg', 'uarmf', 'uarms', 'uleft', 'uright', 'uamul', 'ublindf',
];

// The caller must establish eligibility before crossing this boundary.  A
// stack allocates the source child identity before mutating the parent; a
// singleton detaches the exact carried identity.  Both leave throwit() with a
// free object whose loss provenance is LOST_THROWN.
export function detachThrownUnit(
    state, item, selectedQuantity, splitObjectId = null,
) {
    let thrown = item;
    if (selectedQuantity > 1) {
        thrown = splitObjectStack(
            item, 1, state, splitObjectId,
        );
        thrown.invlet = null;
        thrown.where = 'free';
    } else {
        const index = state.inventory.indexOf(item);
        if (index >= 0) state.inventory.splice(index, 1);
        for (const slot of EQUIPMENT_SLOTS) {
            if (state[slot] === item) state[slot] = null;
            if (state.u?.[slot] === item) state.u[slot] = null;
        }
        thrown.owornmask = 0;
        thrown.worn = false;
        thrown.wornSlot = null;
        thrown.ready = false;
        thrown.where = 'free';
    }
    thrown.how_lost = LOST_THROWN;
    return thrown;
}

export async function captureThrownObjectFlight(
    object, flightPath, state = game,
) {
    const glyph = transientObjectGlyph(object);
    let transientCell = null;
    let transientCursor = null;
    try {
        for (const cell of flightPath) {
            if (cansee(cell.x, cell.y)) {
                if (transientCell)
                    newsym(transientCell.x, transientCell.y);
                show_glyph_cell(
                    cell.x, cell.y, glyph.ch, glyph.color,
                    glyph.decgfx, glyph.attr,
                );
                transientCell = cell;
                transientCursor = lastDirtyMapCursor()
                    ?? [cell.x, cell.y + 1];
            }
            const frameCursor = transientCursor ?? lastDirtyMapCursor();
            await flush_screen(1);
            if (frameCursor)
                state.nhDisplay?.setCursor(...frameCursor);
            await state.animationFrame?.();
        }
    } finally {
        if (transientCell)
            newsym(transientCell.x, transientCell.y);
    }
}
