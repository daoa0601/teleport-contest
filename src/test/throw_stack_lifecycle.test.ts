import { requirePlayingGame } from '../js/gstate.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { A_STR, ICE, ROOM } from '../js/const.js';
import { game } from '../js/gstate.js';
import { ROCK } from '../js/object_data.js';
import { throwInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { floorObjects } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [terrain, name] of [[ROOM, 'room'], [ICE, 'ice']] as const) {
    void test(`throwing one rock across ${name} leaves the other rocks carried`, async () => {
        const level = freshObjectRoom({ right: 20 });
        requirePlayingGame(game);
        level.requireAt(11, 10).typ = terrain;
        game.u.acurr.a[A_STR] = 10;
        const rocks = await addInventoryObject(ROCK, { quan: 3, invlet: 'a' });

        await throwInventoryObject(rocks, 'l');

        assert.ok(game.inventory.includes(rocks));
        assert.equal(rocks.quan, 2);
        const landed = floorObjects(level).filter(object => object.otyp === ROCK);
        assert.equal(landed.reduce((sum, object) => sum + object.quan, 0), 1);
    });
}
