import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { STRAT_CLOSE, STRAT_WAITFORU, STRAT_WAITMASK } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const species of ['shopkeeper', 'dog']) {
    for (const condition of ['asleep', 'paralyzed']) {
        void test(`a ${condition} ${species} without a shop cannot answer chat or spend a turn`, async () => {
            freshObjectRoom();
            const monster = await createMonsterAt(species, 11, 10);
            monster.mstrategy = STRAT_CLOSE | STRAT_WAITFORU;
            if (condition === 'asleep') monster.msleeping = 1;
            else monster.mcanmove = 0;
            resetInputState().feed('chat\nl');

            await rhack('#'.charCodeAt(0));

            assert.match(game._pending_message, /seems not to notice you\./);
            assert.equal(game.context.move, 0);
            assert.equal((monster.mstrategy ?? 0) & STRAT_WAITMASK,
                STRAT_CLOSE | STRAT_WAITFORU);
            if (condition === 'asleep') assert.equal(monster.msleeping, 1);
            else assert.equal(monster.mcanmove, 0);
        });
    }
}
