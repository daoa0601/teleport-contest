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
    } finally {
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
        assert.match(game.nhDisplay?.grid.map(row => row.map(cell => cell.ch).join('')).join('\n') ?? '',
            /Full Current Key Bindings List/);
    } finally {
        input.feed('\x1b');
        await action;
    }
    assert.equal(game.context.move, 0);
});

for (const [key, dx, dy, dz] of [
    ['l', 1, 0, 0],
    ['U', 1, -1, 0],
    ['\x08', -1, 0, 0],
    ['<', 0, 0, -1],
    ['>', 0, 0, 1],
    ['~', -1, 1, 0],
    ['3', -1, 1, 0],
    ['!', 1, 0, 0],
] as const) {
    void test(`whatdoes updates the hero direction while describing ${JSON.stringify(key)}`, async () => {
        const input = freshTurnRoom();
        game.u.dx = -1;
        game.u.dy = 1;
        game.u.dz = -1;
        game.commandBindings.bindKey('!'.charCodeAt(0), 'moveeast');
        input.feed('&');
        const action = rhack(0);
        try {
            await input.waitUntilBlocked();
            while (game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('').includes('--More--')) {
                input.feed(' ');
                await input.waitUntilBlocked();
            }
            input.feed(key);
            await action;
            assert.equal(game.u.dx, dx);
            assert.equal(game.u.dy, dy);
            assert.equal(game.u.dz, dz);
            assert.equal(game.u.ux, 10, 'describing movement must not move the hero');
            assert.equal(game.u.uy, 10);
            assert.equal(game.context.move, 0);
        } finally {
            input.feed('\x1b');
            await action;
        }
    });
}
