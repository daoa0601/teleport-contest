import assert from 'node:assert/strict';
import test from 'node:test';

import { game } from '../js/gstate.js';
import { GLOB_OF_GRAY_OOZE } from '../js/object_data.js';
import { ownedObjectName } from '../js/objnam.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('glob shrink feedback includes partly eaten when its caller requests it', async () => {
    freshObjectRoom();
    const glob = await addInventoryObject(GLOB_OF_GRAY_OOZE, { oeaten: 10, owt: 20 });
    game.iflags.partly_eaten_hack = true;

    assert.equal(ownedObjectName(glob), 'Your partly eaten small glob of gray ooze');
});

