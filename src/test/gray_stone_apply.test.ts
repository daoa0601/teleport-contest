import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { FLINT, OIL_LAMP, RUBY } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('a gem scratches ordinary flint without leaving a colored streak', async () => {
    freshPlayableRoom();
    const stone = await addInventoryObject(FLINT);
    const ruby = await addInventoryObject(RUBY);
    await addInventoryObject(OIL_LAMP);

    await applyInventoryObject(stone, ruby.invlet);

    assert.equal(game._pending_message, 'You make scratch marks on the stone.');
    assert.equal(game.context.move, 1);
    assert.equal(ruby.where, 'inventory');
});
