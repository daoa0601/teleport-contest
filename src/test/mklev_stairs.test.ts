import assert from 'node:assert/strict';
import test from 'node:test';

import { OROOM, VAULT } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { initRng } from '../js/rng.js';
import { levelStairs } from './support/level-state.js';
import { roomBindings } from './support/themed-room-bindings.js';

void test('generated downstairs avoid rooms with upstairs on their perimeter when another room is free', async t => {
    const lua = await roomBindings(t);
    requirePlayingGame(game);
    game.u.uz = { dnum: 0, dlevel: 4 };
    game.specialLevels?.clear();
    game.branches = [];
    await lua.executeAsync(`
        function pre_themerooms_generate() generated_rooms = 0 end
        themerooms = {{ frequency = 1, contents = function()
            generated_rooms = generated_rooms + 1
            des.room({ w = 6, h = 4, lit = 1, filled = 0, contents = function()
                if generated_rooms % 2 == 1 then des.stair("up", 0, -1) end
            end })
        end }}
        function post_level_generate() end
    `);
    for (let seed = 1; seed <= 16; seed++) {
        initRng(seed);
        await mklev();
        const level = requireGameLevel();
        const stairs = levelStairs(game);
        const rooms = level.rooms.filter(isRoom).filter(room => room.rtype !== VAULT);
        const withPerimeterStairs = rooms.filter(room => stairs.some(stair =>
            stair.up && stair.sx === room.lx && stair.sy === room.ly - 1));
        assert.ok(withPerimeterStairs.length > 0, 'the level must have perimeter stairs');
        assert.ok(rooms.some(room => room.rtype === OROOM && !withPerimeterStairs.includes(room)),
            'the level must offer an ordinary room without perimeter stairs');
        const down = stairs.find(stair => !stair.up);
        assert.ok(down, 'the generated level must have downstairs');
        assert.ok(!withPerimeterStairs.some(room =>
            down.sx >= room.lx && down.sx <= room.hx
            && down.sy >= room.ly && down.sy <= room.hy),
        `downstairs must use a room without existing stairs (seed ${seed})`);
    }
});

void test('an ordinary dungeon bottom has upstairs and no downstairs', async t => {
    await roomBindings(t);
    requirePlayingGame(game);
    const dungeon = game.dungeons[0];
    assert.ok(dungeon);
    dungeon.num_dunlevs = 4;
    game.u.uz = { dnum: 0, dlevel: 4 };
    game.specialLevels?.clear();
    game.branches = [];

    await mklev();

    const stairs = levelStairs(game);
    assert.equal(stairs.length, 1);
    assert.equal(stairs[0]?.up, true);
    assert.equal(stairs[0]?.tolev.dlevel, 3);
});
