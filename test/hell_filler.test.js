import test from 'node:test';
import assert from 'node:assert/strict';

import { ICE, ROOM, VIBRATING_SQUARE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { generateHellFillerLevel } from '../js/mklev.js';
import { freshSpecialLevel } from './support/special-level.js';

async function buildHell({ seed = 173, invocation = false } = {}) {
    const active = freshSpecialLevel({
        prototype: 'hellfill', seed,
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

test('Hell filler builds playable populated levels', async () => {
    for (const seed of [173, 1038]) {
        await buildHell({ seed });
        assert.ok(game.level.flags.is_maze_lev
            || game.level.flags.is_cavernous_lev);
        assert.equal(stairCount(), 2);
        assert.ok(terrainCount(ROOM, ICE) > 20);
        assert.ok(game.level.monsters.length >= 8);
    }
});

test('the invocation level has a vibrating square instead of a down stair',
    async () => {
        await buildHell({ seed: 519, invocation: true });
        assert.equal(stairCount(), 1);
        assert.equal(game.level.traps.filter(
            trap => trap.ttyp === VIBRATING_SQUARE,
        ).length, 1);
    });
