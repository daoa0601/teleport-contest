import test from 'node:test';
import assert from 'node:assert/strict';

import { POOL, W_AMUL } from '../js/const.js';
import { dropBoulderIntoLiquid } from '../js/boulder_pool.js';
import { game } from '../js/gstate.js';
import { AMULET_OF_LIFE_SAVING, BOULDER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { vision_recalc } from '../js/vision.js';
import { floorObject, knownObject } from './support/game-objects.js';
import {
    createMonsterAt, equipMonsterObject,
} from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

test("a monster's life-saving amulet works when a boulder fills its pool",
    async () => {
        const level = freshObjectRoom();
        level.at(12, 10).typ = POOL;
        game.blind = true;
        game.deaf = true;
        vision_recalc(0);
        const monster = await createMonsterAt('giant', 12, 10);
        monster.mhp = 1;
        const amulet = equipMonsterObject(
            monster,
            knownObject(AMULET_OF_LIFE_SAVING),
            W_AMUL,
        );
        const boulder = floorObject(BOULDER, 12, 10);
        initRng(1n);

        await dropBoulderIntoLiquid(boulder, 12, 10, game);

        assert.equal(monster.dead, false);
        assert.ok(monster.mhp > 0);
        assert.equal(game.level.monsters.includes(monster), true);
        assert.equal(amulet.where, 'gone');
    });
