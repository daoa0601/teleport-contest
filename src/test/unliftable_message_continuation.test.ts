import test from 'node:test';
import assert from 'node:assert/strict';
import { pline } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { carryableObjectCount } from '../js/lift_object.js';
import { BOULDER, DAGGER } from '../js/object_data.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';

void test('an unliftable object acknowledges earlier arrival prose before reporting its weight', async () => {
    freshObjectRoom();
    await addInventoryObject(DAGGER);
    const boulder = await floorObject(BOULDER, 10, 10, { bknown: false });
    await pline('You smell smoke...');
    const input = resetInputState();

    const count = await answerPrompts(carryableObjectCount({ object: boulder }), input, [
        { prompt: /You smell smoke\.\.\.--More--/, keys: ' ' },
    ]);

    assert.equal(count, 0);
    assert.equal(game._pending_message, 'There is a boulder here, but you cannot lift any more.');
    assert.equal(boulder.where, 'floor');
});
