import assert from 'node:assert/strict';
import test from 'node:test';

import { moveloop_core } from '../js/allmain.js';
import { MM_ANGRY, NO_MINVENT, STRAT_WAITFORU } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';

for (const deaf of [false, true]) {
    void test(`an adjacent shrieker wakes distant monsters when the hero is ${deaf ? 'deaf' : 'hearing'}`, async () => {
        freshObjectRoom({ left: 8, right: 25, hero: { deaf } });
        requirePlayingGame(game);
        const sleeper = await createMonsterAt('goblin', 24, 10, MM_ANGRY | NO_MINVENT);
        sleeper.msleeping = 1;
        sleeper.mstrategy = STRAT_WAITFORU;
        sleeper.movement = 0;
        const shrieker = await createMonsterAt('shrieker', 11, 10, MM_ANGRY | NO_MINVENT);
        shrieker.msleeping = 0;
        shrieker.movement = 12;
        game._moveloopStarted = game._heroTimePending = true;
        game.u.umovement = 12;
        const input = resetInputState();
        installPagerInput(input, { expected: /shrieker/i, limit: 5 });

        await finishAtCommandInput(input, moveloop_core, /.*/);

        assert.equal(sleeper.msleeping, 0, 'the shriek alarms monsters beyond ordinary waking range');
        assert.equal(sleeper.mstrategy & STRAT_WAITFORU, 0);
    });
}

void test('an active erinys alerts distant monsters when she can see the hero', async () => {
    freshObjectRoom({ left: 8, right: 25, hero: { uhp: 200, uhpmax: 200 } });
    requirePlayingGame(game);
    const sleeper = await createMonsterAt('goblin', 24, 10, MM_ANGRY | NO_MINVENT);
    sleeper.msleeping = 1;
    sleeper.movement = 0;
    const erinys = await createMonsterAt('erinys', 14, 10, MM_ANGRY | NO_MINVENT);
    erinys.msleeping = 0;
    erinys.movement = 12;
    game._moveloopStarted = game._heroTimePending = true;
    game.u.umovement = 12;
    const input = resetInputState();
    installPagerInput(input, { expected: /erinys/i, limit: 5 });

    await finishAtCommandInput(input, moveloop_core, /.*/);

    assert.equal(sleeper.msleeping, 0);
});
