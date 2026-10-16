import assert from 'node:assert/strict';
import test from 'node:test';
import { doquit } from '../js/end.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';

void test('#quit can leave the tutorial and resume the prior game', async () => {
    freshObjectRoom();
    game._tutorialActive = true;
    game.u.ucamefrom = { dnum: 0, dlevel: 2 };
    game.u.uz = { dnum: 4, dlevel: 1 };
    game.multi = 12;
    game.u.invulnerable = true;
    game.u.usleep = 9;
    const input = resetInputState();
    let questions = 0;
    input.display = {
        async readKey() {
            const screen = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            assert.equal(++questions, 1, 'Leaving the tutorial needs only its own confirmation');
            assert.match(screen, /Switch from the tutorial back to regular play\? \[yn\] \(n\)/);
            return 'y'.charCodeAt(0);
        },
    };

    await doquit();

    assert.equal(!!game.program_state.gameover, false);
    assert.equal(game.u.utolev?.dnum, 0);
    assert.equal(game.u.utolev?.dlevel, 2);
    assert.equal(game._scheduledLevelChange?.preMessage, 'Resuming regular play.');
    assert.equal(game.multi, 0);
    assert.equal(game.u.invulnerable, false);
    assert.equal(game.u.usleep, 0);
});
