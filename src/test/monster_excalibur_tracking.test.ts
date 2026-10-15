import assert from 'node:assert/strict';
import test from 'node:test';

import { moveloop_core } from '../js/allmain.js';
import { MM_ANGRY, NO_MINVENT, ROOM } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { setTrack } from '../js/track.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { vision_recalc } from '../js/vision.js';
import { artifactObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { finishAtCommandInput, installPagerInput } from './support/pager-input.js';

for (const excalibur of [false, true]) {
    void test(`an eyeless pudding ${excalibur ? 'tracks Excalibur' : 'cannot follow ordinary tracks'} around a corner`, async () => {
        const level = freshObjectRoom({ left: 8, right: 16, top: 10, bottom: 10,
            heroX: 9, heroY: 10 });
        requirePlayingGame(game);
        setTrack(game);
        game.u.ux = 15;
        game.u.uy = 12;
        for (const y of [11, 12]) level.requireAt(15, y).typ = ROOM;
        vision_recalc(0);
        if (excalibur) await setPrimaryWeapon(await addInventoryItem(await artifactObject('Excalibur')));
        const pudding = await createMonsterAt('black pudding', 10, 10, MM_ANGRY | NO_MINVENT);
        pudding.msleeping = 0;
        pudding.movement = 12;
        game._moveloopStarted = game._heroTimePending = true;
        game.u.umovement = 12;
        const input = resetInputState();
        installPagerInput(input, { expected: /pudding/i, limit: 5 });

        await finishAtCommandInput(input, moveloop_core, /.*/);

        assert.deepEqual([pudding.mx, pudding.my], [excalibur ? 9 : 11, 10]);
    });
}
