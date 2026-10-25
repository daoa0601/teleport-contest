import test from 'node:test';
import assert from 'node:assert/strict';
import { W_WEP } from '../js/const.js';
import { game } from '../js/gstate.js';
import { BULLWHIP, DAGGER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

// C apply.c:3050 wraps an(singular(otmp, xname)): a whip snags one item
// from a floor stack, never the whole stack count.
void test('a whip snagging a floor stack wraps around a single item', async () => {
    freshPlayableRoom({ role: 'archeologist', hero: { acurr: { a: [10, 10, 10, 18, 10, 10] } } });
    const whip = await addInventoryObject(BULLWHIP, { wielded: true, owornmask: W_WEP });
    game.uwep = game.u.uwep = whip;
    game.u.levitating = true;
    const stack = await floorObject(DAGGER, game.u.ux, game.u.uy, { quan: 2 });
    initRng(7300n);

    await applyInventoryObject(whip, '.');

    assert.match(game._pending_message, /wrap your bullwhip around a dagger on the floor/);
    assert.doesNotMatch(game._pending_message, /2 daggers/);
    assert.equal(stack.quan, 1);
});
