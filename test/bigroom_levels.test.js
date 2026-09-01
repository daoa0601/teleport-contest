import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CLOUD, FOUNTAIN, IS_WALL, ROLLING_BOULDER_TRAP, ROOM, STONE,
} from '../js/const.js';
import { placeHeroAtRandomArrival } from '../js/cmd.js';
import { GameMap } from '../js/game.js';
import { game } from '../js/gstate.js';
import { generateBigRoom } from '../js/mklev.js';
import { BOULDER } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import {
    countTerrain, floorObjects, levelStairs,
} from './support/level-state.js';
import { freshSpecialLevel } from './support/special-level.js';

function newBigRoom(variant, seed = variant * 17) {
    return freshSpecialLevel({
        prototype: 'bigrm', variant, seed,
    });
}

async function buildBigRoom(variant, seed) {
    const active = newBigRoom(variant, seed);
    await generateBigRoom(active);
    return active;
}

test('the first Lua Big Rooms build their maps and apply their wall rules',
    async () => {
        for (let variant = 1; variant <= 3; variant++) {
            const active = await buildBigRoom(variant, variant * 17);

            assert.deepEqual(
                [active.context.width, active.context.height], [75, 18],
            );
            assert.equal(game.level.flags.is_special, true);
            assert.equal(game.level.flags.is_maze_lev, true);
            assert.equal(active.allowFlips, 0);
            assert.equal(levelStairs(game).length, 2);
            assert.ok(game.level.at(
                active.context.xstart, active.context.ystart,
            ).wall_info);
        }
    });

test('bigrm-4 places the four fountains declared by Lua', async () => {
    const active = await buildBigRoom(4);

    for (const [x, y] of [[5, 2], [5, 15], [69, 2], [69, 15]]) {
        assert.equal(
            game.level.at(active.context.xstart + x,
                active.context.ystart + y).typ,
            FOUNTAIN,
        );
    }
});

test('bigrm-7 keeps the tall map inside the level before flipping', async () => {
    const active = await buildBigRoom(7);

    assert.equal(active.context.ystart, 1);
    assert.equal(active.context.height, 19);
    assert.equal(active.allowFlips, 3);
});

test('bigrm-9 applies the nested light regions from Lua', async () => {
    const active = await buildBigRoom(9);
    const at = (x, y) => game.level.at(
        active.context.xstart + x, active.context.ystart + y,
    );

    assert.equal(at(0, 0).lit, false);
    assert.equal(at(30, 9).lit, true);
});

test('bigrm-12 keeps its tall map in bounds and permits horizontal flip',
    async () => {
        const active = await buildBigRoom(12);

        assert.equal(active.context.ystart, 1);
        assert.equal(active.context.height, 19);
        assert.equal(active.allowFlips, 2);
    });

test('the fog maze keeps arrivals and its up stair outside the fog', async () => {
    await buildBigRoom(10);
    assert.ok(countTerrain(game.level, CLOUD) > 300);

    const region = game.level.downTeleportRegion;
    assert.ok(region?.exclude);
    const up = levelStairs(game).find(stair => stair.up);
    assert.ok(up);
    assert.equal(
        up.sx >= region.exclude.lx && up.sx <= region.exclude.hx
            && up.sy >= region.exclude.ly && up.sy <= region.exclude.hy,
        false,
    );

    game.level = new GameMap();
    for (let x = 10; x <= 12; x++) game.level.at(x, 5).typ = ROOM;
    game.u = { ux: 1, uy: 1, ux0: 1, uy0: 1 };
    initRng(4n);
    const placed = placeHeroAtRandomArrival({
        lx: 10, ly: 5, hx: 12, hy: 5,
        exclude: { lx: 10, ly: 5, hx: 11, hy: 5 },
    });
    assert.deepEqual(placed, { x: 12, y: 5 });
});

test('the wide maze uses boulders and rolling-boulder traps', async () => {
    await buildBigRoom(11);
    const boulders = floorObjects(game.level)
        .filter(object => object.otyp === BOULDER);
    const rollingTraps = game.level.traps.filter(
        trap => trap.ttyp === ROLLING_BOULDER_TRAP,
    );
    assert.ok(boulders.length > 40);
    assert.equal(rollingTraps.length, 6);
});

test('the pillar room contains enclosed three-by-three obstacles', async () => {
    await buildBigRoom(13);
    let pillars = 0;
    for (let x = 1; x < 77; x++) {
        for (let y = 0; y < 19; y++) {
            const border = [
                [x, y], [x + 1, y], [x + 2, y],
                [x, y + 1], [x + 2, y + 1],
                [x, y + 2], [x + 1, y + 2], [x + 2, y + 2],
            ];
            if (game.level.at(x + 1, y + 1)?.typ !== STONE
                || !border.every(([wallX, wallY]) =>
                    IS_WALL(game.level.at(wallX, wallY)?.typ))) continue;
            pillars++;
        }
    }
    assert.ok(pillars > 0);
});
