import assert from 'node:assert/strict';
import test from 'node:test';
import { FOUNTAIN, MAGIC_PORTAL, STAIRS } from '../js/const.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { maketrap, mklev, saveBonesLevel } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
function bonesRoom(storage) {
    freshPlayableRoom({ flags: { debug: true }, hero: { uz: { dnum: 0, dlevel: 7 } } });
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D' })];
    game.storage = storage;
    init_objects();
}
function branchBonesRoom(storage, destination, portal) {
    bonesRoom(storage);
    game.u.uz = { dnum: 1, dlevel: 1 };
    game.dungeons.push(createDungeon({ dname: 'The Gnomish Mines', num_dunlevs: 8, bonetag: 'M' }));
    game.branches = [{
            end1: { dnum: 0, dlevel: destination }, end2: { dnum: 1, dlevel: 1 },
            end1_up: false, type: portal ? 'portal' : 'stair', portal,
        }];
}
for (const connection of ['stairs', 'portal', 'dangling portal']) {
    void test(`bones repair their ${connection} for the new dungeon layout`, async () => {
        const storage = memoryStorage();
        const portal = connection !== 'stairs';
        branchBonesRoom(storage, 3, portal);
        if (portal) {
            const trap = await maketrap(13, 10, MAGIC_PORTAL);
            assert.ok(trap);
            trap.dst = { dnum: 0, dlevel: 3 };
        }
        else {
            requireGameLevel().requireAt(13, 10).typ = STAIRS;
            game.stairs = {
                sx: 13, sy: 10, up: true, isladder: false, u_traversed: false,
                tolev: { dnum: 0, dlevel: 3 }, next: null,
            };
        }
        assert.equal(saveBonesLevel(), true);
        branchBonesRoom(storage, 5, portal);
        if (connection === 'dangling portal')
            game.branches = [];
        pushKeys('yn');
        await mklev();
        if (connection === 'stairs')
            assert.deepEqual(game.stairs?.tolev, { dnum: 0, dlevel: 5 });
        else if (connection === 'portal')
            assert.deepEqual(requireGameLevel().traps.find(trap => trap.ttyp === MAGIC_PORTAL)?.dst, { dnum: 0, dlevel: 5 });
        else
            assert.equal(requireGameLevel().traps.some(trap => trap.ttyp === MAGIC_PORTAL), false);
    });
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
        if (exclusion === 'dungeon')
            dungeon.bonetag = undefined;
        if (exclusion === 'special level')
            game.specialLevels = new Map([['excluded', createSpecialLevel({ dnum: 0, dlevel: 7 })]]);
        if (exclusion === 'bottom')
            dungeon.num_dunlevs = 7;
        if (exclusion === 'branch')
            game.branches = [{
                    end1: { dnum: 0, dlevel: 7 }, end2: { dnum: 1, dlevel: 1 },
                    end1_up: false, type: 'stair', portal: false,
                }];
        if (exclusion === 'invocation') {
            dungeon.flags.hellish = true;
            dungeon.num_dunlevs = 8;
            game.valley_level = createSpecialLevel({ dnum: 0, dlevel: 1, bonetag: 'V' });
        }
        if (exclusion === 'discover')
            game.discover = true;
        pushKeys('yn');
        await mklev();
        assert.equal(!!game._restoredBones, false);
        assert.equal(storage.length, 1, 'excluded bones must remain available for another game');
    });
}
//# sourceMappingURL=bones_restore_admission.test.js.map