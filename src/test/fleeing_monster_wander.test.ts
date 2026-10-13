import assert from 'node:assert/strict';
import test from 'node:test';

import { MM_ANGRY, NO_MINVENT } from '../js/const.js';
import { distmin } from '../js/hacklib.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { beginMonsterMove } from '../js/monmove.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const wanders of [true, false]) {
    void test(`a fleeing bat ${wanders ? 'can wander toward the hero' : 'retreats when it keeps its direction'}`, async () => {
        freshObjectRoom({ left: 2, right: 25, heroX: 20, heroY: 10 });
        requirePlayingGame(game);
        const bat = await createMonsterAt('bat', 12, 10, NO_MINVENT | MM_ANGRY);
        bat.mflee = 1;
        const oldDistance = distmin(bat.mx, bat.my, game.u.ux, game.u.uy);
        const random = wanders ? () => 0 : (bound: number) => bound - 1;

        await beginMonsterMove(bat, game, random);

        const distance = distmin(bat.mx, bat.my, game.u.ux, game.u.uy);
        if (wanders) assert.ok(distance < oldDistance, 'wandering can reverse the flight direction');
        else assert.ok(distance > oldDistance, 'directed flight must increase the distance');
    });
}
