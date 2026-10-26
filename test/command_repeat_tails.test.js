import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { freshTurnRoom } from './support/playable-room.js';
void test('repeating an empty-hands wield reads a new choice without showing a prompt', async () => {
    const input = freshTurnRoom();
    input.feed('w-');
    await rhack(0);
    input.feed('\x01');
    const repeat = rhack(0);
    await input.waitUntilBlocked();
    const display = requireGameDisplay();
    const message = display.grid[0]?.map(cell => cell.ch).join('').trimEnd();
    input.feed('\x1b');
    await repeat;
    assert.equal(message, '');
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=command_repeat_tails.test.js.map