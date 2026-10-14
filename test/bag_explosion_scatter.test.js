import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { BAG_OF_HOLDING, CLUB, WAN_CANCELLATION } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { initRng } from '../js/rng.js';
void test('a bag explosion scatters surviving contents away from the destroyed bag', async () => {
    const level = freshPlayableRoom({ left: 5, right: 20, top: 5, bottom: 15 });
    game.u.uhp = game.u.uhpmax = 100;
    const bag = await addInventoryObject(BAG_OF_HOLDING, { invlet: 'a', initialize: false, cknown: true });
    const club = await knownObject(CLUB, { where: 'contained', container: bag });
    bag.contents = [club];
    await addInventoryObject(WAN_CANCELLATION, { invlet: 'b', spe: 1 });
    initRng(1n);
    await applyInventoryObject(bag, 'sb\n' + ' '.repeat(12));
    assert.equal(bag.where, 'gone');
    assert.equal(club.where, 'floor');
    assert.ok(club.ox !== 10 || club.oy !== 10, 'The surviving club travels away from the blast origin.');
    assert.equal(level.objects[club.ox]?.[club.oy]?.includes(club), true);
    assert.equal(club.container, null);
});
//# sourceMappingURL=bag_explosion_scatter.test.js.map