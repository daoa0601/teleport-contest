import assert from 'node:assert/strict';
import test from 'node:test';

import { moveloop_core } from '../js/allmain.js';
import { MM_ANGRY, NO_MINVENT, STRAT_ARRIVE, STRAT_WAITFORU } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';

void test('a newly arrived frozen monster clears arrival while retaining its waiting order', async () => {
    freshObjectRoom({ hero: { invisibleTurns: 20 } });
    requirePlayingGame(game);
    const goblin = await createMonsterAt('goblin', 14, 10, MM_ANGRY | NO_MINVENT);
    goblin.mstrategy = STRAT_ARRIVE | STRAT_WAITFORU;
    goblin.mcanmove = 0;
    goblin.mfrozen = 10;
    goblin.movement = 12;
    game._moveloopStarted = game._heroTimePending = true;
    game.u.umovement = 12;
    const input = resetInputState();
    installPagerInput(input, { expected: /goblin/i, limit: 5 });

    await finishAtCommandInput(input, moveloop_core, /.*/);

    assert.equal(goblin.mstrategy & STRAT_ARRIVE, 0);
    assert.ok(goblin.mstrategy & STRAT_WAITFORU);
    assert.deepEqual([goblin.mx, goblin.my], [14, 10]);
});
