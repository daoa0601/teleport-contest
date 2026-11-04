import assert from 'node:assert/strict';
import test from 'node:test';
import { whatDoesCommand } from '../js/pager.js';
import { game } from '../js/gstate.js';
import { freshTurnRoom } from './support/playable-room.js';
import { queueCannedUserInput } from './support/canned-input.js';
import { planInput } from './support/planned-input.js';
// C pager.c:dowhatdoes() asks through yn_function("What command?", NULL,
// '\0', TRUE) (pager.c:2676), and yn_function() asks the player live when
// its one cmdq_pop() returns the user-input placeholder instead of a key
// (cmd.c:5496-5509): the placeholder means "read fresh input here", not a
// cancellation.
void test('a user-input placeholder before the whatdoes question asks it live', async (t) => {
    const input = freshTurnRoom({ flags: { tips: false } });
    queueCannedUserInput();
    planInput(input, t, [
        { prompt: /--More--/, keys: ' ' },
        { prompt: /What command\?/, keys: 'i' },
    ]);
    await whatDoesCommand();
    // The fed 'i' reached dowhatdoes_core(): the live question was asked
    // and answered, and no "No such command" complaint appears for the
    // placeholder having been read as Escape.
    const screen = game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '';
    assert.doesNotMatch(screen, /No such command/);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=whatdoes_user_input.test.js.map