import assert from 'node:assert/strict';
import test from 'node:test';

import { moveloop_core } from '../js/allmain.js';
import { MFAST, MM_NOWAIT, NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { initRng } from '../js/rng.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';

void test('a lich can teleport beside the hero and cast an indirect spell in the same turn', async () => {
    let castAfterTeleport = false;
    for (let seed = 1; seed <= 128; seed++) {
        freshObjectRoom({ left: 7, right: 25, top: 6, bottom: 14, hero: { uhp: 500, uhpmax: 500 } });
        requirePlayingGame(game);
        const lich = await createMonsterAt('master lich', 20, 10, MM_NOWAIT | NO_MINVENT);
        lich.mpeaceful = 1;
        lich.msleeping = 0;
        lich.movement = 12;
        game._moveloopStarted = true;
        game._heroTimePending = true;
        game.u.umovement = 12;
        initRng(BigInt(seed));
        const input = resetInputState();
        installPagerInput(input, { expected: /lich|monsters/i, limit: 20 });

        await finishAtCommandInput(input, moveloop_core, /^/);

        if (Math.abs(lich.mx - game.u.ux) <= 1 && Math.abs(lich.my - game.u.uy) <= 1
            && (lich.minvis || lich.permspeed === MFAST)) {
            castAfterTeleport = true;
        }
    }
    assert.equal(castAfterTeleport, true, 'at least one game should exercise teleportation followed by spellcasting');
});
