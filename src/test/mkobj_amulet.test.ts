import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { mksobj } from '../js/mklev.js';
import { AMULET_OF_YENDOR, FAKE_AMULET_OF_YENDOR } from '../js/object_data.js';
import { freshObjectRoom } from './support/object-room.js';

void test('only generating the real Amulet enables covetous pursuit of it', async () => {
    freshObjectRoom();
    game.context.made_amulet = false;

    await mksobj(FAKE_AMULET_OF_YENDOR, true, false);
    assert.equal(game.context.made_amulet, false);
    await mksobj(AMULET_OF_YENDOR, true, false);
    assert.equal(game.context.made_amulet, true);
});
