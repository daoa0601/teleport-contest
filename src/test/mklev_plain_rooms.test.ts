import assert from 'node:assert/strict';
import test from 'node:test';

import { OROOM, THEMEROOM } from '../js/const.js';
import { init_dungeons } from '../js/dungeon.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { startLuaCore } from './support/lua-game.js';

void test('a dungeon without a themed-room file creates ordinary rectangular rooms', async t => {
    const state = freshGame({ flags: { bones: false } });
    initRng(999);
    init_objects();
    await init_dungeons();
    await startLuaCore(t);
    const dungeon = state.dungeons[0];
    assert.ok(dungeon);
    dungeon.themeRooms = undefined;
    state.u.uz = { dnum: 0, dlevel: 12 };
    state.specialLevels?.clear();
    state.branches = [];
    for (let seed = 1; seed <= 24; seed++) {
        initRng(seed);

        await mklev();

        const rooms = state.level.rooms.filter(isRoom);
        assert.ok(rooms.some(room => room.rtype === OROOM), 'ordinary rooms must still be generated');
        assert.ok(!rooms.some(room => room.rtype === THEMEROOM),
            `there is no theme script to create themed rooms (seed ${seed})`);
        assert.ok(rooms.filter(room => room.rtype === OROOM).every(room => !room.irregular),
            'plain room creation produces rectangular rooms');
    }
});
