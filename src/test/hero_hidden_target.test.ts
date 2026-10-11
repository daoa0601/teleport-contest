import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { LARGE_BOX } from '../js/object_data.js';
import { placeObject } from '../js/floor_object.js';
import { pushKey } from '../js/input.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('walking into a hidden hider reveals it under its cover', async () => {
    freshObjectRoom({ gameplaySeed: 4n });

    const box = await knownObject(LARGE_BOX, { bknown: false, typeKnown: false });
    await placeObject(box, 11, 10);
    const spider = await createMonsterAt('cave spider', 11, 10);
    spider.mundetected = 1;

    pushKey('l'.charCodeAt(0));
    await rhack('l'.charCodeAt(0));

    assert.equal(
        game._pending_message,
        "Wait!  There's a cave spider hiding under a large box!",
    );
    assert.equal(spider.mundetected, 0, 'the reveal clears the hidden state');
    assert.equal(game.u.ux, 10, 'the hero never enters the occupied square');
});
