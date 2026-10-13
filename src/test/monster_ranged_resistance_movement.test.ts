import assert from 'node:assert/strict';
import test from 'node:test';

import { M_SEEN_FIRE, MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { takeMonsterTurn } from '../js/monmove.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const fireResistanceKnown of [true, false]) {
    void test(`a hell hound ${fireResistanceKnown ? 'approaches a hero known to resist fire' : 'backs away to use its fire breath'}`, async () => {
        freshObjectRoom({ left: 8, right: 18, top: 8, bottom: 12, heroX: 13, heroY: 10 });
        requirePlayingGame(game);
        const hound = await createMonsterAt('hell hound', 10, 10, MM_ANGRY | NO_MINVENT);
        hound.msleeping = 0;
        hound.seen_resistance = fireResistanceKnown ? M_SEEN_FIRE : 0;

        await takeMonsterTurn(hound, game, limit => limit - 1);

        assert.equal(hound.mx, fireResistanceKnown ? 11 : 9);
    });
}
