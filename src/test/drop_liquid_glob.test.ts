import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { POOL } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { GLOB_OF_BLACK_PUDDING } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('a glob dropped into water stays separate from a neighboring floor glob', async () => {
    freshObjectRoom({ flags: { verbose: false } });
    requirePlayingGame(game);
    const settled = await floorObject(GLOB_OF_BLACK_PUDDING, game.u.ux + 1, game.u.uy);
    const landing = await addInventoryObject(GLOB_OF_BLACK_PUDDING, { invlet: 'a' });
    const settledWeight = settled.owt;
    const landingWeight = landing.owt;
    game.level.requireAt(game.u.ux, game.u.uy).typ = POOL;
    pushKeys('a  ');

    await rhack('d'.charCodeAt(0));

    assert.equal(landing.where, 'floor');
    assert.equal(settled.owt, settledWeight);
    assert.equal(landing.owt, landingWeight);
    assert.equal(landing.ox, game.u.ux);
});
