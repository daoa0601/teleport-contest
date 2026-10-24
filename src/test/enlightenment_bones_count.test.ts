import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requireGameDisplay, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { doattributes } from '../js/insight.js';
import { freshObjectRoom } from './support/object-room.js';

// C insight.c:enlightenment() "Miscellaneous" section counts every bones
// level loaded this game (u.uroleplay.numbones), with plur() agreement.
void test('enlightenment counts every bones level encountered', async () => {
    freshObjectRoom({ flags: { debug: true } });
    requirePlayingGame(game);
    game.u.uroleplay.numbones = 2;
    const input = resetInputState();
    let text = '';
    let pages = 0;
    input.display = {
        async readKey(): Promise<number> {
            text += '\n' + requireGameDisplay().grid
                .map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.ok(++pages < 40, `Unexpectedly long enlightenment: ${pages} pages`);
            return 32;
        },
    };
    try {
        await doattributes();
    } finally {
        input.display = null;
    }

    assert.match(text, /You have encountered 2 bones levels\./);
    assert.doesNotMatch(text, /encountered 1 bones level/);
});
