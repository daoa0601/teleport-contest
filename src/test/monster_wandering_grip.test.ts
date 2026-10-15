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

void test('a confused holder loses its grip when it wanders away from the hero', async () => {
    let escaped = 0;
    for (let seed = 1; seed <= 12; seed++) {
        freshObjectRoom({ hero: { uhp: 200, uhpmax: 200 } });
        requirePlayingGame(game);
        const python = await createMonsterAt('python', 11, 10, MM_ANGRY | NO_MINVENT);
        python.mconf = 1;
        python.msleeping = 0;
        python.movement = 12;
        game.u.ustuck = python;
        game._moveloopStarted = game._heroTimePending = true;
        game.u.umovement = 12;
        initRng(BigInt(seed));
        const input = resetInputState();
        installPagerInput(input, { expected: /python|squeezed/i, limit: 5 });

        await finishAtCommandInput(input, moveloop_core, /.*/);

        if (Math.max(Math.abs(python.mx - game.u.ux), Math.abs(python.my - game.u.uy)) > 1) {
            escaped++;
            assert.equal(game.u.ustuck === python, false, `the python walked away in game ${seed}`);
            assert.ok((python.mspec_used ?? 0) >= 1 && (python.mspec_used ?? 0) <= 2);
        }
    }
    assert.ok(escaped > 0, 'confused movement must sometimes carry the holder away');
});
