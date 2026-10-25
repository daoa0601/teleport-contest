// C end.c:done_object_cleanup(), shared by terminal outcomes and saves.
import { isok } from './const.js';
import { game } from './gstate.js';
import { restoreBallAndChainPlacement } from './ball.js';
import { consumeInventoryItem } from './invent.js';
import { placeObjectSynchronously, stack_object } from './floor_object.js';
import { isAccessibleAt } from './terrain_properties.js';
import { plineWithContinuation } from './display.js';
import { objectName, pluralizeObjectNoun } from './objnam.js';
export async function doneObjectCleanup() {
    await finishInUseInventory(true);
    const flightFields = ['_thrownObject', '_kickedObject'];
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
            if (object?.where !== 'free')
                continue;
            placeObjectSynchronously(object, ox, oy);
            await stack_object(object);
            game[field] = null;
        }
    }
    const chain = game.uchain || game.u.uchain;
    if (chain?.where === 'free')
        await restoreBallAndChainPlacement(-1);
}
// C restore.c:inven_inuse(). Announce before consuming, so a pager still
// shows the in-use stack until its message is acknowledged.
export async function finishInUseInventory(quietly) {
    for (const object of [...game.inventory]) {
        if (!object.in_use)
            continue;
        if (!quietly) {
            const noun = objectName(object);
            const name = object.quan === 1 ? noun : pluralizeObjectNoun(object, noun);
            await plineWithContinuation(`Finishing off ${name}...`);
        }
        await consumeInventoryItem(object);
    }
}
//# sourceMappingURL=object_cleanup.js.map