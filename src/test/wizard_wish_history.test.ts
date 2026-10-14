import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ROCK } from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';

void test('menu-prefixed wizard wishing repeats a previous wish', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    await runExtendedCommand('wizwish', 'rock\n');
    const input = resetInputState();
    input.feed('m\x17');
    input.display = {
        async readKey() {
            const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.match(text, /Wish what\?/);
            assert.match(text, /a - rock/);
            return 'a'.charCodeAt(0);
        },
    };

    await rhack(0);

    assert.equal(game.inventory.find(object => object.otyp === ROCK)?.quan, 2);
    assert.equal(game.u.uconduct.wishes, 2);
    assert.equal(game.context.move, 0);
});
