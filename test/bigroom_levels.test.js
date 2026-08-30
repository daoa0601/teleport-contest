import test from 'node:test';
import assert from 'node:assert/strict';

import {
    CLOUD, FOUNTAIN, ICE, IS_WALL, LAVAPOOL, MOAT, ROLLING_BOULDER_TRAP,
    ROOM, STONE, TREE,
} from '../js/const.js';
import { placeHeroAtRandomArrival } from '../js/cmd.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import { generateBigRoom } from '../js/mklev.js';
import { BOULDER } from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';

function newBigRoom(variant, seed = variant * 17) {
    resetGame();
    game.u = {
        ux: 1, uy: 1, ux0: 1, uy0: 1,
        uz: { dnum: 0, dlevel: 11 },
        ulevel: 10, uhp: 50, uhpmax: 50,
        acurr: { a: Array(6).fill(10) },
        amax: { a: Array(6).fill(10) },
        uhave: {}, ualign: { type: 0 },
    };
    game.flags = {};
    game.context = {};
    game.moves = 2;
    game.in_mklev = true;
    game.dungeons = [{
        dname: 'The Dungeons of Doom',
        depth_start: 1,
        num_dunlevs: 30,
        flags: {},
    }];
    game.level = new GameMap();
    game.stairs = null;

    initRng(999n);
    init_objects();
    initRng(BigInt(seed));

    const active = {
        prototype: 'bigrm', variant, defaultLit: false,
        align: ['law', 'neutral', 'chaos'],
    };
    game._activeSpecialLevel = active;
    return active;
}

async function buildBigRoom(variant, seed) {
    const active = newBigRoom(variant, seed);
    await generateBigRoom(active);
    return active;
}

function terrainCount(typ) {
    let count = 0;
    for (let x = 1; x < 80; x++)
        for (let y = 0; y < 21; y++)
            if (game.level.at(x, y)?.typ === typ) count++;
    return count;
}

function stairs() {
    const result = [];
    for (let stair = game.stairs; stair; stair = stair.next)
        result.push(stair);
    return result;
}

function floorObjects() {
    return (game.level.objects || []).flat(2).filter(Boolean);
}

test('all thirteen Big Room scripts build playable special levels', async () => {
    for (let variant = 1; variant <= 13; variant++) {
        const active = await buildBigRoom(variant);
        assert.ok(active.context, `variant ${variant} map`);
        assert.equal(game.level.flags.is_special, true, `variant ${variant}`);
        assert.equal(game.level.flags.is_maze_lev, true, `variant ${variant}`);
        assert.equal(stairs().length, 2, `variant ${variant} stairs`);
        assert.ok(game.level.monsters.length >= 28,
            `variant ${variant} population`);
        assert.ok(floorObjects().length >= 15,
            `variant ${variant} objects`);
    }
});

test('Big Room terrain programs alter the rooms described by Lua', async () => {
    await buildBigRoom(1, 17);
    assert.ok(terrainCount(CLOUD) > 50);

    await buildBigRoom(2, 7);
    assert.ok(terrainCount(ICE) > 100);
    let lit = 0, dark = 0;
    for (let x = 1; x < 80; x++) {
        for (let y = 0; y < 21; y++) {
            if (game.level.at(x, y)?.lit) lit++;
            else dark++;
        }
    }
    assert.ok(lit > 100 && dark > 100);

    await buildBigRoom(5, 9);
    assert.ok(terrainCount(CLOUD) + terrainCount(ICE) > 100);

    await buildBigRoom(6);
    assert.equal(terrainCount(FOUNTAIN), 2);
    assert.equal(terrainCount(TREE), 10);

    await buildBigRoom(9);
    assert.ok(terrainCount(MOAT) > 400);
    assert.ok(terrainCount(LAVAPOOL) > 100);
});

test('the fog maze keeps arrivals and its up stair outside the fog', async () => {
    await buildBigRoom(10);
    assert.ok(terrainCount(CLOUD) > 300);

    const region = game.level.downTeleportRegion;
    assert.ok(region?.exclude);
    const up = stairs().find(stair => stair.up);
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
    const boulders = floorObjects().filter(object => object.otyp === BOULDER);
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
