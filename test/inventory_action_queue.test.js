import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { FOUNTAIN } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { answerPrompts } from './support/input-boundaries.js';
import { freshObjectRoom } from './support/object-room.js';
void test('failed inventory engraving leaves the next player command available', async () => {
    const level = freshObjectRoom();
    level.requireAt(game.u.ux, game.u.uy).typ = FOUNTAIN;
    const dagger = await addInventoryObject(DAGGER);
    const input = resetInputState();
    await answerPrompts(rhack('i'.charCodeAt(0)), input, [
        { prompt: /Weapons/, keys: dagger.invlet },
        { prompt: /Do what with the dagger\?/, keys: 'E' },
    ]);
    await rhack(0);
    assert.equal(game._pending_message, "You can't write on the fountain!");
    input.feed('s');
    await answerPrompts(rhack(0), input, []);
    assert.equal(game.context.move, 1);
    assert.equal(game.inventory.includes(dagger), true);
});
//# sourceMappingURL=inventory_action_queue.test.js.map