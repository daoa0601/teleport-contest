import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { BAG_OF_HOLDING, MIRROR, WAN_CANCELLATION } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('a mirror shattered by a bag explosion does not cost the hero luck', async () => {
    freshPlayableRoom({ hero: { uhp: 100, uhpmax: 100, uluck: 0 } });
    const bag = await addInventoryObject(BAG_OF_HOLDING, {
        invlet: 'a', initialize: false, cknown: true,
    });
    const mirror = await knownObject(MIRROR, { where: 'contained', container: bag });
    bag.contents = [mirror];
    await addInventoryObject(WAN_CANCELLATION, { invlet: 'b', spe: 1 });
    initRng(1n);

    await applyInventoryObject(bag, 'sb' + ' '.repeat(8));

    assert.equal(mirror.where, 'gone');
    assert.equal(bag.where, 'gone');
    assert.equal(game.u.uluck, 0);
});
