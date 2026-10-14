import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { CHEST } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('the reversed container action discovers an empty container after attempting to put in', async () => {
    freshPlayableRoom();
    const chest = await addInventoryObject(CHEST, {
        invlet: 'a', initialize: false, olocked: false, otrapped: false, cknown: false,
    });

    await applyInventoryObject(chest, 'r    ');

    assert.equal(chest.cknown, true);
    assert.equal(game.context.move, 1);
    assert.match(game._pending_message, /chest is empty\./);
});
