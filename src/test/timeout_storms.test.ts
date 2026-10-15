import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { CLOUD } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { heroIsUnconscious, putHeroToSleep } from '../js/hero_sleep.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { freshTurnRoom } from './support/playable-room.js';
import { installPagerInput } from './support/pager-input.js';

void test('a storm in the hero\'s cloud causes temporary deafness and hiding', async () => {
    const input = freshTurnRoom({ hero: { uhp: 1000, uhpmax: 1000 }, seed: 19n });
    requirePlayingGame(game);
    game.level.flags.stormy = true;
    game.level.requireAt(game.u.ux, game.u.uy).typ = CLOUD;
    grantIntrinsicProperty('shockResistance', 'outside');
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message || game._retained_message); };
    installPagerInput(input, { expected: /./, limit: 30 });
    input.feed('s'.repeat(100));

    for (let turn = 0; turn < 32 && !(game.u.deafTurns ?? 0); turn++)
        await moveloop_core();

    assert.ok((game.u.deafTurns ?? 0) >= 25, 'No deafening thunderstorm in 32 world turns');
    assert.match([...messages, game._pending_message || game._retained_message].join('\n'),
        /Kaboom!!!  Boom!!  Boom!!/);
    assert.equal(game._helplessReason, 'hiding from thunderstorm');
});

for (const sleepTurns of [1, 2, 3, 4]) {
    void test(`thunder replaces sleep only when at most three turns remain (${sleepTurns} remaining)`, async () => {
        const input = freshTurnRoom({ hero: { uhp: 1000, uhpmax: 1000 }, seed: 19n });
        requirePlayingGame(game);
        game.level.flags.stormy = true;
        game.level.requireAt(game.u.ux, game.u.uy).typ = CLOUD;
        grantIntrinsicProperty('shockResistance', 'outside');
        installPagerInput(input, { expected: /./, limit: 40 });
        input.feed('s'.repeat(100));

        for (let turn = 0; turn < 32 && !(game.u.deafTurns ?? 0); turn++) {
            putHeroToSleep(sleepTurns);
            await moveloop_core();
        }

        assert.ok((game.u.deafTurns ?? 0) > 0, 'No deafening thunderstorm in 32 world turns');
        assert.equal(heroIsUnconscious(), sleepTurns > 3,
            'Thunder wakes the hero only when it replaces the sleep delay');
        assert.equal(game._helplessTurns, Math.max(sleepTurns, 3) - 1,
            'The world turn advances the longer of sleep and hiding by one turn');
    });
}
