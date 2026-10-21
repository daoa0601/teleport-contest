import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { CLOUD } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { heroIsUnconscious, putHeroToSleep } from '../js/hero_sleep.js';
import { CHAIN_MAIL, SPEED_BOOTS } from '../js/object_data.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { doStorms } from '../js/storms.js';
import { addInventoryObject } from './support/game-objects.js';
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
            await putHeroToSleep(sleepTurns);
            await moveloop_core();
        }

        assert.ok((game.u.deafTurns ?? 0) > 0, 'No deafening thunderstorm in 32 world turns');
        assert.equal(heroIsUnconscious(), sleepTurns > 3,
            'Thunder wakes the hero only when it replaces the sleep delay');
        assert.equal(game._helplessTurns, Math.max(sleepTurns, 3) - 1,
            'The world turn advances the longer of sleep and hiding by one turn');
    });
}

for (const [name, otyp, duration] of [
    ['speed boots', SPEED_BOOTS, 3], ['chain mail', CHAIN_MAIL, 5],
] as const) {
    void test(`thunder keeps ${name} dressing pending until the shared delay ends`, async () => {
        const input = freshTurnRoom({ hero: { uhp: 1000, uhpmax: 1000 }, seed: 19n });
        requirePlayingGame(game);
        const armor = await addInventoryObject(otyp, { known: false });
        grantIntrinsicProperty('shockResistance', 'outside');
        const messages: string[] = [];
        input.beforeRead = () => { messages.push(game._pending_message || game._retained_message); };
        installPagerInput(input, { expected: /./, limit: 60 });
        input.feed(`W${armor.invlet}`);
        await moveloop_core();
        assert.equal(armor.known, false);

        game.level.flags.stormy = true;
        game.level.requireAt(game.u.ux, game.u.uy).typ = CLOUD;
        for (let attempt = 0; attempt < 32 && !(game.u.deafTurns ?? 0); attempt++)
            await doStorms();
        assert.ok((game.u.deafTurns ?? 0) > 0, 'No deafening thunderstorm in 32 attempts');
        game.level.flags.stormy = false;
        input.feed(' '.repeat(100));

        const deadline = game.moves + duration;
        for (let attempt = 0; attempt < duration * 3 && game.moves < deadline; attempt++) {
            await moveloop_core();
            if (game.moves < deadline)
                assert.equal(armor.known, false, `Dressing finished ${deadline - game.moves} turns early`);
        }

        assert.equal(game.moves, deadline);
        assert.equal(armor.known, true, 'Dressing finishes when the shared delay ends');
        const feedback = [...messages, game._pending_message || game._retained_message].join('\n');
        assert.match(feedback, /You can move again\./);
        assert.doesNotMatch(feedback, /You finish your dressing maneuver\./);
    });
}
