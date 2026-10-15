import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { MM_ANGRY, NO_MINVENT, STRAT_WAITFORU } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';
for (const invisible of [false, true]) {
    void test(`a waiting goblin ${invisible ? 'does not notice an invisible' : 'notices a visible'} hero`, async () => {
        freshObjectRoom({ heroX: 15, heroY: 10, hero: { invisibleTurns: invisible ? 20 : 0 } });
        requirePlayingGame(game);
        const goblin = await createMonsterAt('goblin', 10, 10, MM_ANGRY | NO_MINVENT);
        goblin.mstrategy = STRAT_WAITFORU;
        goblin.msleeping = 0;
        goblin.movement = 12;
        game._moveloopStarted = game._heroTimePending = true;
        game.u.umovement = 12;
        const input = resetInputState();
        installPagerInput(input, { expected: /goblin/i, limit: 5 });
        await finishAtCommandInput(input, moveloop_core, /.*/);
        assert.equal(!!(goblin.mstrategy & STRAT_WAITFORU), invisible);
        if (invisible)
            assert.deepEqual([goblin.mx, goblin.my], [10, 10]);
    });
}
//# sourceMappingURL=monster_turn_strategy.test.js.map