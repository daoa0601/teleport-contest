import assert from 'node:assert/strict';
import test from 'node:test';
import { farlookLocationDescription } from '../js/cmd.js';
import { map_invisible } from '../js/display.js';
import { game } from '../js/gstate.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a remembered unseen monster is just an unseen creature to a blind hero', async () => {
    freshObjectRoom();
    const x = game.u.ux + 2, y = game.u.uy;
    map_invisible(x, y);
    assert.equal(await farlookLocationDescription(x, y), 'remembered, unseen, creature');

    game.u.blindTurns = 20;

    assert.equal(await farlookLocationDescription(x, y), 'unseen creature');
});
