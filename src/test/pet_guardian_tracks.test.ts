import assert from 'node:assert/strict';
import test from 'node:test';
import { moveloop_core } from '../js/allmain.js';
import { MM_EMIN, NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { floorObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';

async function guardianStep(cursed: boolean): Promise<number> {
    freshObjectRoom({ left: 10, right: 22, top: 10, bottom: 10 });
    const guardian = await createMonsterAt('Angel', 20, 10, MM_EMIN | NO_MINVENT);
    guardian.mtame = 10;
    guardian.mpeaceful = 1;
    guardian.isminion = true;
    guardian.mcan = 1;
    guardian.mtrack = [{ x: 19, y: 10 }];
    guardian.movement = 12;
    await floorObject(DAGGER, 21, 10, { cursed });
    game._moveloopStarted = game._heroTimePending = true;
    game.u.umovement = 12;
    const input = resetInputState();
    installPagerInput(input, { expected: /Angel/, limit: 2 });
    initRng(1n);

    await finishAtCommandInput(input, moveloop_core, /^$/);

    return guardian.mx;
}

void test('cursed objects do not change a guardian angel\'s reluctance to retrace its steps', async () => {
    const ordinarySquare = await guardianStep(false);
    const cursedSquare = await guardianStep(true);

    assert.equal(cursedSquare, ordinarySquare,
        'Guardians judge recent tracks using all candidate squares, regardless of object curses');
});
