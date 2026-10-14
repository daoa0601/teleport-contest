import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { nhgetch } from '../js/input.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
import { AXE, PICK_AXE } from '../js/object_data.js';
for (const { name, type } of [{ name: 'pick-axe', type: PICK_AXE }, { name: 'axe', type: AXE }]) {
    void test(`cancelling the digging direction with a ${name} clears apply recall`, async () => {
        const input = freshTurnRoom();
        const pick = await addInventoryObject(type);
        game.uwep = game.u.uwep = pick;
        input.feed(`a${pick.invlet}\x1b`);
        await rhack(0);
        assert.equal(game.context.move, 0);
        input.feed('\x01\x1b');
        await rhack(0);
        assert.equal(game._pending_message, 'There is no command available to repeat.');
        assert.equal(game.uwep, pick);
        assert.equal(game.context.move, 0);
        assert.equal(await nhgetch(), 27, 'recall must not reopen the digging direction prompt');
    });
}
//# sourceMappingURL=command_repeat_dig.test.js.map