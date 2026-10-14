import test from 'node:test';
import assert from 'node:assert/strict';
import { rejoinObjectStack, splitObjectStack } from '../js/object_stack.js';
import { DAGGER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('only the most recent split can be undone', async () => {
    freshObjectRoom();
    const daggers = await addInventoryObject(DAGGER, { quan: 4 });
    const first = splitObjectStack(daggers, 1);
    const second = splitObjectStack(daggers, 1);
    assert.ok(first && second);
    assert.equal(await rejoinObjectStack(daggers, first), null);
    assert.equal(daggers.quan, 2);
    assert.equal(await rejoinObjectStack(daggers, second), daggers);
    assert.equal(daggers.quan, 3);
    assert.equal(first.quan, 1);
});
//# sourceMappingURL=mkobj_unsplit.test.js.map