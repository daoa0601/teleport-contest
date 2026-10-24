import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
void test('empty discoveries print a message without opening a text window or using a turn', async () => {
    freshObjectRoom();
    const input = resetInputState();
    input.display = {
        async readKey() {
            assert.fail('Empty discoveries must not request window dismissal');
        },
    };
    try {
        await rhack('\\'.charCodeAt(0));
        assert.equal(game._pending_message, "You haven't discovered anything yet...");
        assert.equal(game.context.move, 0);
    }
    finally {
        input.display = null;
    }
});
//# sourceMappingURL=discovery_empty.test.js.map