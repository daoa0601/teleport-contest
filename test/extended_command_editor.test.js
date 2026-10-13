import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenRow } from './support/screen.js';
void test('cancelling an empty extended command clears its prompt from the tty', async () => {
    freshObjectRoom();
    const input = resetInputState();
    input.feed('q\x7f\x7f\x1b');
    await rhack('#'.charCodeAt(0));
    assert.equal(requireScreenRow(0).map(cell => cell.ch).join('').trim(), '');
    assert.equal(game._pending_message, '');
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=extended_command_editor.test.js.map