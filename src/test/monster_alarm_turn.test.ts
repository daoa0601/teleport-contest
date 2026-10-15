import assert from 'node:assert/strict';
import test from 'node:test';

import { moveloop_core } from '../js/allmain.js';
import { MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';

void test('an erinys can rouse a later paralyzed arrival while an earlier one stays frozen', async () => {
    freshObjectRoom({ left: 8, right: 25, hero: { uhp: 200, uhpmax: 200 } });
    requirePlayingGame(game);
    const earlier = await createMonsterAt('goblin', 24, 10, MM_ANGRY | NO_MINVENT);
    const later = await createMonsterAt('goblin', 23, 10, MM_ANGRY | NO_MINVENT);
    for (const monster of [earlier, later]) {
        monster.mcanmove = 0;
        monster.mfrozen = 20;
        monster.movement = 0;
    }
    const erinys = await createMonsterAt('erinys', 14, 10, MM_ANGRY | NO_MINVENT);
    erinys.msleeping = 0;
    erinys.movement = 12;
    game._moveloopStarted = game._heroTimePending = true;
    game.u.umovement = 12;
    initRng(1n);
    const input = resetInputState();
    installPagerInput(input, { expected: /erinys/i, limit: 5 });

    await finishAtCommandInput(input, moveloop_core, /.*/);

    assert.equal(later.mcanmove, 1, 'the later arrival recovers from paralysis');
    assert.equal(later.mfrozen, 0);
    assert.equal(earlier.mcanmove, 0, 'the earlier arrival remains paralyzed');
    assert.equal(earlier.mfrozen, 20);
});
