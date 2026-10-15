import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestContext } from 'node:test';

import { LEVEL_TELEP, SCORR, TRAPDOOR } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { mklev } from '../js/mklev.js';
import { initRng } from '../js/rng.js';
import { roomBindings } from './support/themed-room-bindings.js';

async function ordinaryRooms(t: TestContext, depth: number, depthStart = 1, noTeleport = false) {
    const lua = await roomBindings(t);
    requirePlayingGame(game);
    const dungeon = game.dungeons[0];
    assert.ok(dungeon);
    dungeon.depth_start = depthStart;
    dungeon.num_dunlevs = 40;
    game.u.uz = { dnum: 0, dlevel: depth };
    game.specialLevels?.clear();
    game.medusa_level = undefined;
    game.branches = [];
    await lua.executeAsync(`
        themerooms = {{ frequency = 1, contents = function()
            des.room({ filled = 0, lit = 1 })
        end }}
        function pre_themerooms_generate()
            ${noTeleport ? 'des.level_flags("noteleport")' : ''}
        end
        function post_level_generate() end
    `);
}

void test('level-teleport niches use absolute depth inside a dungeon branch', async t => {
    await ordinaryRooms(t, 3, 16);
    let niches = 0;
    for (let seed = 1; seed <= 24; seed++) {
        initRng(seed);
        await mklev();
        const level = requireGameLevel();
        for (const trap of level.traps.filter(trap => trap.ttyp === LEVEL_TELEP && trap.once)) {
            niches++;
            assert.equal(level.requireAt(trap.tx, trap.ty).typ, SCORR,
                'level-teleport niches retain their secret corridor');
        }
    }
    assert.ok(niches > 0, 'absolute depth 18 must allow level-teleport niches');
});

void test('trapdoor niches stop below absolute depth 24 even with a shallow branch level', async t => {
    await ordinaryRooms(t, 18, 13);
    for (let seed = 1; seed <= 24; seed++) {
        initRng(seed);
        await mklev();
        assert.ok(!requireGameLevel().traps.some(trap => trap.ttyp === TRAPDOOR && trap.once),
            `absolute depth 30 must not contain a trapdoor niche (seed ${seed})`);
    }
});

void test('no-teleport levels do not receive level-teleport niches', async t => {
    await ordinaryRooms(t, 18, 1, true);
    for (let seed = 1; seed <= 24; seed++) {
        initRng(seed);
        await mklev();
        assert.ok(!requireGameLevel().traps.some(trap => trap.ttyp === LEVEL_TELEP),
            `a no-teleport level must reject level-teleport niches (seed ${seed})`);
    }
});

