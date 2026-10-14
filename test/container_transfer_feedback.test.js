import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { CHEST, DART, ROCK } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('container removal describes the picked quantity and the merged inventory total', async () => {
    freshPlayableRoom();
    const carried = await addInventoryObject(DART, { invlet: 'a', quantity: 3 });
    const chest = await floorObject(CHEST, 10, 10, { initialize: false, olocked: false, cknown: true });
    const darts = await knownObject(DART, { where: 'contained', container: chest, quantity: 2 });
    chest.contents = [darts];
    await runExtendedCommand('loot', 'oa\n');
    assert.equal(carried.quan, 5);
    assert.match(game._pending_message, /^a - 2 .*darts \(5 in total\)\.$/);
});
void test('container removal announces a burden increase on its first added item', async () => {
    freshPlayableRoom();
    await addInventoryObject(ROCK, { quantity: 50 });
    const chest = await floorObject(CHEST, 10, 10, { initialize: false, olocked: false, cknown: true });
    const darts = await knownObject(DART, { where: 'contained', container: chest, quantity: 100 });
    chest.contents = [darts];
    await runExtendedCommand('loot', 'oa\n');
    assert.equal(game.inventory.includes(darts), true);
    assert.match(game._pending_message, /^You have a little trouble removing/);
});
//# sourceMappingURL=container_transfer_feedback.test.js.map