import assert from 'node:assert/strict';
import test from 'node:test';

import { moveloop_core } from '../js/allmain.js';
import { M_AP_OBJECT, MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { GOLD_PIECE } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';

for (const concealment of ['hidden', 'strange object', 'gold']) {
    void test(`a rat can wander away from a hero concealed as ${concealment}`, async () => {
        let away = 0;
        for (let seed = 1; seed <= 12; seed++) {
            freshObjectRoom({ left: 9, right: 16, top: 10, bottom: 10, heroX: 15, heroY: 10 });
            requirePlayingGame(game);
            if (concealment === 'hidden') game.u.uundetected = true;
            else {
                game.u.m_ap_type = M_AP_OBJECT;
                game.u.mappearance = concealment === 'gold' ? GOLD_PIECE : 0;
            }
            const rat = await createMonsterAt('sewer rat', 11, 10, MM_ANGRY | NO_MINVENT);
            rat.msleeping = 0;
            rat.movement = 12;
            game._moveloopStarted = game._heroTimePending = true;
            game.u.umovement = 12;
            initRng(BigInt(seed));
            const input = resetInputState();
            installPagerInput(input, { expected: /rat/i, limit: 5 });

            await finishAtCommandInput(input, moveloop_core, /.*/);

            assert.equal(rat.my, 10);
            if (rat.mx < 11) away++;
        }
        assert.ok(away > 0, `concealment as ${concealment} must prevent unerring pursuit`);
    });
}

void test('a gold-loving orc still pursues a hero disguised as gold', async () => {
    freshObjectRoom({ left: 9, right: 16, top: 10, bottom: 10, heroX: 15, heroY: 10 });
    requirePlayingGame(game);
    game.u.m_ap_type = M_AP_OBJECT;
    game.u.mappearance = GOLD_PIECE;
    const orc = await createMonsterAt('hill orc', 11, 10, MM_ANGRY | NO_MINVENT);
    orc.msleeping = 0;
    orc.movement = 12;
    game._moveloopStarted = game._heroTimePending = true;
    game.u.umovement = 12;
    const input = resetInputState();
    installPagerInput(input, { expected: /orc/i, limit: 5 });

    await finishAtCommandInput(input, moveloop_core, /.*/);

    assert.deepEqual([orc.mx, orc.my], [12, 10]);
});
