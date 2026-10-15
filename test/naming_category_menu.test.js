import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { resetInputState } from '../js/input.js';
import { ELVEN_DAGGER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
void test('the naming category menu accepts its legacy individual-object alias', async (t) => {
    freshObjectRoom();
    const dagger = await addInventoryObject(ELVEN_DAGGER, { invlet: 'a' });
    const input = resetInputState();
    input.feed('name\r');
    planInput(input, t, [
        { prompt: /What do you want to name\?/, keys: 'y' },
        { prompt: /What do you want to name\?/, keys: 'a' },
        { prompt: /What do you want to name this elven dagger\?/, keys: 'Keepsake\r' },
    ]);
    await rhack('#'.charCodeAt(0));
    assert.equal(dagger.oextra?.oname, 'Keepsake');
});
//# sourceMappingURL=naming_category_menu.test.js.map