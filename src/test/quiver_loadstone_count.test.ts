import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { LOADSTONE } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a counted quiver selection remembers the requested loadstones without splitting a cursed stack', async () => {
    freshObjectRoom();
    const stones = await addInventoryObject(LOADSTONE, { cursed: true, quan: 5 });
    resetInputState();

    pushKeys(`2${stones.invlet}`);
    await rhack('Q'.charCodeAt(0));

    assert.equal(stones.quan, 5);
    assert.equal(game.uquiver, stones);
    assert.equal(stones.corpsenm, 2, 'The cursed loadstone count must survive getobj without a split');
    assert.equal(game.inventory.length, 1);
    assert.equal(game.context.move, 0);
});
