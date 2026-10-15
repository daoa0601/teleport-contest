import test from 'node:test';
import assert from 'node:assert/strict';
import { A_DEX } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { kickDirection } from './support/commands.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('stunning can redirect a kick away from the requested direction', async () => {
    let redirected = false;
    for (let seed = 1n; seed <= 10n && !redirected; seed++) {
        freshPlayableRoom({ seed, hero: { stunned: true, stunnedTurns: 20 } });
        requirePlayingGame(game);
        game.u.acurr.a[A_DEX] = 16;

        await kickDirection('l', ' '.repeat(10));

        redirected = game.u.dx !== 1 || game.u.dy !== 0;
        assert.equal(game.context.move, 1);
    }
    assert.ok(redirected, 'An impaired direction prompt can redirect the chosen kick.');
});
