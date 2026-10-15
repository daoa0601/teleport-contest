import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { AMULET_OF_YENDOR, CRYSTAL_BALL, DAGGER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
void test('calling the Amulet uses its special rejection instead of denying ownership', async (t) => {
    freshObjectRoom();
    const amulet = await addInventoryObject(AMULET_OF_YENDOR);
    // A callable item keeps getobj available; the typed Amulet still takes
    // the special rejection path rather than the empty-candidate shortcut.
    await addInventoryObject(CRYSTAL_BALL);
    const input = resetInputState();
    input.feed('call\r');
    planInput(input, t, [
        { prompt: /What do you want to name\?/, keys: 'o' },
        { prompt: /What do you want to call\?/, keys: amulet.invlet },
    ]);
    await rhack('#'.charCodeAt(0));
    assert.equal(game._pending_message, "The Amulet doesn't like being called names.");
});
void test('a rejected invocation target remains owned and receives the silly-thing message', async (t) => {
    freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER);
    const input = resetInputState();
    input.feed('invoke\r');
    // A crystal ball makes invocation available; the typed dagger is still
    // present in inventory even though it is not a likely invocation target.
    await addInventoryObject(CRYSTAL_BALL);
    planInput(input, t, [{ prompt: /What do you want to invoke\?/, keys: dagger.invlet }]);
    await rhack('#'.charCodeAt(0));
    assert.equal(game._pending_message, 'That is a silly thing to invoke.');
    assert.equal(game.inventory.includes(dagger), true);
    assert.equal(game.context.move, 0);
});
void test('a drop command mimes empty hands without repeating its prompt', async (t) => {
    freshObjectRoom();
    await addInventoryObject(DAGGER);
    const input = resetInputState();
    planInput(input, t, [{ prompt: /What do you want to drop\?/, keys: '-' }]);
    await rhack('d'.charCodeAt(0));
    assert.equal(game._pending_message, 'You mime dropping something.');
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=inventory_getobj_rejections.test.js.map