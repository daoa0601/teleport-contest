// C end.c:done_object_cleanup(), shared by terminal outcomes and saves.
import { isok } from './const.js';
import { game } from './gstate.js';
import { restoreBallAndChainPlacement } from './ball.js';
import { consumeInventoryItem } from './invent.js';
import { placeObjectSynchronously, stack_object } from './floor_object.js';
import { isAccessibleAt } from './terrain_properties.js';

export async function doneObjectCleanup(): Promise<void> {
    // inven_inuse(TRUE) finishes one item from each active stack, quietly.
    for (const object of [...game.inventory]) {
        if (object.in_use) await consumeInventoryItem(object);
    }

    const flightFields = ['_thrownObject', '_kickedObject'] as const;
    if (flightFields.some(field => game[field]?.where === 'free')) {
        const { ux, uy } = game.u;
        let ox = ux + (game.u.dx ?? 0);
        let oy = uy + (game.u.dy ?? 0);
        if (!isok(ox, oy) || !isAccessibleAt(ox, oy)) {
            ox = ux;
            oy = uy;
        }
        // Native bypasses flooreffects: finish cleanup rather than trigger
        // further destruction, falls, or contact effects from a projectile.
        for (const field of flightFields) {
            const object = game[field];
            if (object?.where !== 'free') continue;
            placeObjectSynchronously(object, ox, oy);
            await stack_object(object);
            game[field] = null;
        }
    }

    const chain = game.uchain || game.u.uchain;
    if (chain?.where === 'free') await restoreBallAndChainPlacement(-1);
}
