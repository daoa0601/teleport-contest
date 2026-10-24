import assert from 'node:assert/strict';
import test from 'node:test';

import { farlookLocationDescription } from '../js/cmd.js';
import { newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { objectDescription } from '../js/object_description.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('end-of-game farlook omits shirt text while inventory disclosure retains it', async () => {
    freshObjectRoom();
    const shirt = await floorObject(OBJECT_NAMES.indexOf('T-shirt'), 11, 10,
        { known: false, bknown: false, oeroded: 0, oeroded2: 0 });
    newsym(11, 10);
    game.program_state.gameover = true;

    assert.equal(await farlookLocationDescription(11, 10), 'a T-shirt');
    assert.match(await objectDescription(shirt), /with text "/);
});
