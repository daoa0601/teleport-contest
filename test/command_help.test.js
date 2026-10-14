import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { freshTurnRoom } from './support/playable-room.js';
void test('whatdoes describes the command currently bound to the requested key', async () => {
    const input = freshTurnRoom();
    game.commandBindings.bindKey('!'.charCodeAt(0), 'search');
    input.feed('&');
    const action = rhack(0);
    try {
        const waiting = await Promise.race([
            input.waitUntilBlocked().then(() => true), action.then(() => false),
        ]);
        assert.equal(waiting, true, 'whatdoes must request a command key');
        while (game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').includes('--More--')) {
            input.feed(' ');
            await input.waitUntilBlocked();
        }
        input.feed('!');
        await action;
        assert.match(game._pending_message, /! +search for traps and secret doors \(#search\)\./);
        assert.equal(game.context.move, 0);
    }
    finally {
        input.feed('\x1b');
        await action;
    }
});
void test('the full key list shows configured command keys', async () => {
    const input = freshTurnRoom();
    game.commandBindings.bindKey('!'.charCodeAt(0), 'search');
    input.feed('?j');
    const action = rhack(0);
    try {
        const waiting = await Promise.race([
            input.waitUntilBlocked().then(() => true), action.then(() => false),
        ]);
        assert.equal(waiting, true, 'the full key list must wait for dismissal');
        assert.match(game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '', /Full Current Key Bindings List/);
    }
    finally {
        input.feed('\x1b');
        await action;
    }
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=command_help.test.js.map