import assert from 'node:assert/strict';
import test from 'node:test';

import { FOUNTAIN } from '../js/const.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { mklev, saveBonesLevel } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';

function bonesRoom(storage: ReturnType<typeof memoryStorage>): void {
    freshPlayableRoom({ flags: { debug: true }, hero: { uz: { dnum: 0, dlevel: 7 } } });
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D' })];
    game.storage = storage;
    init_objects();
}

for (const exclusion of ['dungeon', 'special level', 'bottom', 'branch', 'invocation', 'discover']) {
    void test(`bones restoration respects the ${exclusion} exclusion even in wizard mode`, async () => {
        const storage = memoryStorage();
        bonesRoom(storage);
        requireGameLevel().requireAt(15, 10).typ = FOUNTAIN;
        assert.equal(saveBonesLevel(), true);
        bonesRoom(storage);
        const dungeon = game.dungeons[0];
        assert.ok(dungeon);
        if (exclusion === 'dungeon') dungeon.bonetag = undefined;
        if (exclusion === 'special level')
            game.specialLevels = new Map([['excluded', createSpecialLevel({ dnum: 0, dlevel: 7 })]]);
        if (exclusion === 'bottom') dungeon.num_dunlevs = 7;
        if (exclusion === 'branch') game.branches = [{
            end1: { dnum: 0, dlevel: 7 }, end2: { dnum: 1, dlevel: 1 },
            end1_up: false, type: 'stair', portal: false,
        }];
        if (exclusion === 'invocation') {
            dungeon.flags.hellish = true;
            dungeon.num_dunlevs = 8;
            game.valley_level = createSpecialLevel({ dnum: 0, dlevel: 1, bonetag: 'V' });
        }
        if (exclusion === 'discover') game.discover = true;
        pushKeys('yn');

        await mklev();

        assert.equal(!!game._restoredBones, false);
        assert.equal(storage.length, 1, 'excluded bones must remain available for another game');
    });
}
