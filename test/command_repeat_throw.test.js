import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { nhgetch } from '../js/input.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshTurnRoom } from './support/playable-room.js';
import { DAGGER } from '../js/object_data.js';
for (const command of ['t', '#throw\n']) {
    void test(`cancelling ${JSON.stringify(command)} at object selection clears throw recall`, async () => {
        const input = freshTurnRoom();
        const dagger = await addInventoryObject(DAGGER);
        input.feed(command + '\x1b');
        await rhack(0);
        assert.equal(game.context.move, 0);
        input.feed('\x01\x1b');
        await rhack(0);
        assert.equal(game._pending_message, 'There is no command available to repeat.');
        assert.equal(game.inventory.includes(dagger), true);
        assert.equal(game.context.move, 0);
        assert.equal(await nhgetch(), 27, 'recall must not reopen the throw prompt');
    });
}
//# sourceMappingURL=command_repeat_throw.test.js.map