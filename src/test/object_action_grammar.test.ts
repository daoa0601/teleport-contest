import assert from 'node:assert/strict';
import test from 'node:test';

import { POT_HEALING } from '../js/object_data.js';
import { ownedObjectAction } from '../js/objnam.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('object action messages conjugate go using the shared native verb rules', async () => {
    freshObjectRoom();
    const potion = await addInventoryObject(POT_HEALING);

    assert.equal(ownedObjectAction(potion, 'go'), 'Your potion of healing goes');
});
