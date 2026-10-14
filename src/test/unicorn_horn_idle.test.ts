import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { UNICORN_HORN } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('applying a unicorn horn with no curable trouble says nothing happens', async () => {
    freshPlayableRoom();
    const horn = await addInventoryObject(UNICORN_HORN);

    await applyInventoryObject(horn);

    assert.equal(game._pending_message, 'Nothing happens.');
    assert.equal(game.context.move, 1);
    assert.equal(horn.where, 'inventory');
});
