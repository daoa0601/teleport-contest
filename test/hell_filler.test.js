import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ICE, IRONBARS, LAVAPOOL, POOL, ROOM, VIBRATING_SQUARE, WATER,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import { generateHellFillerLevel } from '../js/mklev.js';
import { freshSpecialLevel } from './support/special-level.js';

async function buildHell(variant, { seed = variant * 173, invocation = false }
    = {}) {
    const active = freshSpecialLevel({
        prototype: 'hellfill', variant, seed,
        depth: invocation ? 29 : 20,
    });
    game.dungeons[0] = {
        dname: 'Gehennom', depth_start: 1, num_dunlevs: 30,
        flags: { hellish: true },
    };
    await generateHellFillerLevel(active);
}

function terrainCount(...types) {
    const wanted = new Set(types);
    let count = 0;
    for (let x = 1; x < 80; x++)
        for (let y = 0; y < 21; y++)
            if (wanted.has(game.level.at(x, y)?.typ)) count++;
    return count;
}

function stairCount() {
    let count = 0;
    for (let stair = game.stairs; stair; stair = stair.next) count++;
    return count;
}

test('all seven Hell fillers build playable populated levels', async () => {
    for (let variant = 1; variant <= 7; variant++) {
        await buildHell(variant);
        assert.equal(game.level.flags.is_maze_lev, true, `variant ${variant}`);
        assert.equal(stairCount(), 2, `variant ${variant} stairs`);
        assert.ok(terrainCount(ROOM, ICE) > 20, `variant ${variant} floor`);
        assert.ok(game.level.monsters.length >= 9,
            `variant ${variant} population`);
    }
});

test('the lava, bar, cold, and open-cavern variants keep their terrain',
    async () => {
        await buildHell(1);
        assert.ok(terrainCount(LAVAPOOL) > 100);

        await buildHell(4);
        assert.ok(terrainCount(IRONBARS, LAVAPOOL) > 20);

        await buildHell(6);
        assert.equal(game.level.flags.temperature, -1);
        assert.ok(terrainCount(ICE, POOL, WATER) > 10);

        await buildHell(7);
        assert.equal(game.level.flags.is_cavernous_lev, true);
        assert.ok(terrainCount(ROOM) > 100);
    });

test('the invocation level has a vibrating square instead of a down stair',
    async () => {
        await buildHell(3, { invocation: true });
        assert.equal(stairCount(), 1);
        assert.equal(game.level.traps.filter(
            trap => trap.ttyp === VIBRATING_SQUARE,
        ).length, 1);
    });
