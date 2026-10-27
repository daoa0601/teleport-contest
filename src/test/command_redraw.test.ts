import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { DOOR, D_CLOSED } from '../js/const.js';
import { docrt, flush_screen } from '../js/display.js';
import { game, requireGameDisplay, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { promptDirection } from '../js/tty_prompts.js';
import { freshTurnRoom } from './support/playable-room.js';
import { requireScreenRow } from './support/screen.js';

void test('Ctrl-R rebuilds visible terrain without taking a turn', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    await docrt();
    await flush_screen(1);
    const door = requireGameLevel().requireAt(12, 10);
    door.typ = DOOR;
    door.doormask = D_CLOSED;
    input.feed('\x12');

    await rhack(0);
    await flush_screen(1);

    assert.equal(requireGameDisplay().getChar(12, 12), '+',
        'redraw must replace the old floor with the closed door');
    assert.equal(game.context.move, 0);
});

void test('a bound direction redraw refreshes status before asking again', async () => {
    const input = freshTurnRoom();
    requirePlayingGame(game);
    await docrt();
    await flush_screen(1);
    game.u.uhp -= 3;
    game.commandBindings.bindKey('!'.charCodeAt(0), 'redraw');
    input.feed('!');

    const choosing = promptDirection();
    try {
        await input.waitUntilBlocked();
        const status = requireScreenRow(23).map(cell => cell.ch).join('');
        assert.ok(status.includes(`HP:${game.u.uhp}(${game.u.uhpmax})`),
            `direction redraw must show current health: ${status.trimEnd()}`);
        input.feed('l');
        assert.equal((await choosing)?.dx, 1);
    } finally {
        input.feed('\x1b');
        await choosing;
    }
});
