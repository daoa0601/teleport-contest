import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { game, requireGameDisplay } from '../js/gstate.js';
import { setPropertyTimeout } from '../js/properties.js';
import { freshTurnRoom } from './support/playable-room.js';

void test('the billionth world turn ends in escape before property timeouts', async () => {
    const input = freshTurnRoom({ moves: 999999999, flags: { disclose: '-i -a -v -c -o -g' } });
    setPropertyTimeout('confusion', 10);
    const messages: string[] = [];
    let reads = 0;
    input.display = {
        async readKey() {
            assert.ok(++reads <= 10, 'The escape summary must finish within ten pages');
            const text = requireGameDisplay().grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
            messages.push(text);
            return /--More--|Hit space to continue/.test(text) ? 32 : 27;
        },
    };
    input.feed('.');
    await moveloop_core();

    await moveloop_core();

    assert.equal(game.moves, 1000000000);
    assert.equal(game.program_state.gameover, true);
    assert.equal(game.u.confusionTurns, 10, 'The final world turn stops before nh_timeout()');
    assert.match(messages.join('\n'), /The dungeon capitulates\./);
    assert.match(messages.join('\n'), /escaped/);
});
