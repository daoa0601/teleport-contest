import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { A_INT, A_WIS } from '../js/const.js';
import { plineWithContinuation } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { freshTurnRoom } from './support/playable-room.js';
import { installPagerInput } from './support/pager-input.js';

for (const recovery of ['health', 'energy'] as const) {
    void test(`full ${recovery} recovery pages before later world-turn effects`, async () => {
        const input = freshTurnRoom({ role: 'wizard', heroLevel: 30, moves: 3, energy: 20 });
        requirePlayingGame(game);
        game.u.acurr.a[A_INT] = game.u.acurr.a[A_WIS] = 6;
        if (recovery === 'health') {
            game.u.uhp = game.u.uhpmax - 1;
            game.u.uen = 5;
            grantIntrinsicProperty('regeneration', 'outside');
        } else game.u.uen = 19;
        input.feed('5.');
        await moveloop_core();
        await plineWithContinuation('You inspect the quiet stone archway at the entrance to the passage.');
        const hunger = game.u.uhunger;
        const advancing = moveloop_core();
        const phase = await Promise.race([
            advancing.then(() => 'finished'),
            input.waitUntilBlocked().then(() => 'pager'),
        ]);
        try {
            assert.equal(phase, 'pager', 'Recovery must acknowledge the older prose before continuing');
            assert.equal(game.multi, 0, 'Full recovery stops the counted rest');
            assert.equal(game.u.uhunger, hunger, 'Hunger runs after the recovery announcement');
            if (recovery === 'health') {
                assert.equal(game.u.uhp, game.u.uhpmax);
                assert.equal(game.u.uen, 5, 'Power regeneration waits for the health announcement');
            } else assert.equal(game.u.uen, game.u.uenmax);
        } finally {
            installPagerInput(input, { expected: /archway|full health|full of energy/, limit: 2 });
            if (phase === 'pager') input.feed(' ');
            await advancing;
        }
        assert.ok(game.u.uhunger < hunger);
    });
}
