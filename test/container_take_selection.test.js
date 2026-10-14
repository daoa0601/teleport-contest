import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { CHEST, HEAVY_IRON_BALL, ROCK } from '../js/object_data.js';
import { applyInventoryObject, runExtendedCommand } from './support/commands.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';
void test('selecting a contained item spends a turn even when its heavier burden is declined', async () => {
    freshPlayableRoom();
    const chest = await floorObject(CHEST, 10, 10, {
        initialize: false, olocked: false, otrapped: false, cknown: true,
    });
    await addInventoryObject(ROCK, { quantity: 70 });
    const ball = await knownObject(HEAVY_IRON_BALL, { where: 'contained', container: chest });
    chest.contents = [ball];
    await runExtendedCommand('loot', 'oa\nn    ');
    assert.equal(chest.contents.includes(ball), true);
    assert.equal(game.context.move, 1);
});
void test('cancelling the take-out item menu still discovers the contents without spending a turn', async () => {
    freshPlayableRoom();
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a', initialize: false, olocked: false, otrapped: false, cknown: false,
    });
    const rock = await knownObject(ROCK, { where: 'contained', container: chest });
    chest.contents = [rock];
    await applyInventoryObject(chest, 'o\x1b');
    assert.equal(chest.contents.includes(rock), true);
    assert.equal(chest.cknown, true);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=container_take_selection.test.js.map