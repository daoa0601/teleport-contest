import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ALTAR, FILL_NORMAL, FOUNTAIN, GRAVE, OROOM, ROOM, ROOMOFFSET,
    SINK, WEB,
} from '../js/const.js';
import { GameMap } from '../js/game.js';
import { game, resetGame } from '../js/gstate.js';
import {
    fill_ordinary_room, level_difficulty, mksobj,
} from '../js/mklev.js';
import {
    CHEST, DART, LARGE_BOX,
} from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { objectWeight } from '../js/weight.js';


const PM_GIANT_SPIDER = 96;

function roomState({ seed, depth = 1, amulet = false, rogue = false }) {
    resetGame();
    game.u = {
        uz: { dnum: 0, dlevel: depth },
        ulevel: Math.max(1, Math.min(depth, 15)),
        uhp: 50, uhpmax: 50,
        acurr: { a: Array(6).fill(10) },
        amax: { a: Array(6).fill(10) },
        uhave: { amulet: amulet ? 1 : 0 },
    };
    game.flags = {};
    game.moves = 2;
    game.in_mklev = true;
    game.dungeons = [{
        dname: 'The Dungeons of Doom',
        depth_start: 1,
        num_dunlevs: 30,
    }];
    game.oracle_level = { dnum: 0, dlevel: 5 };
    if (rogue) game.rogue_level = { ...game.u.uz };

    game.level = new GameMap();
    game.level.nroom = 1;
    const room = {
        lx: 10, hx: 14, ly: 5, hy: 8,
        rtype: OROOM, needfill: FILL_NORMAL,
        sbrooms: [], nsubrooms: 0, roomnoidx: 0,
    };
    game.level.rooms = [room];
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            const loc = game.level.at(x, y);
            loc.typ = ROOM;
            loc.roomno = ROOMOFFSET;
        }
    }

    initRng(999n);
    init_objects();
    initRng(BigInt(seed));
    return room;
}

function floorObjects() {
    return (game.level.objects || []).flat(2).filter(Boolean);
}

function roomTerrain(room) {
    const terrain = [];
    for (let x = room.lx; x <= room.hx; x++)
        for (let y = room.ly; y <= room.hy; y++)
            terrain.push(game.level.at(x, y).typ);
    return terrain;
}

test('mksobj finalizes stack weight after type-specific initialization', () => {
    roomState({ seed: 17 });
    const darts = mksobj(DART, true, false);

    assert.ok(darts.quan >= 6);
    assert.equal(darts.owt, objectWeight(darts));
    assert.ok(darts.owt > objectWeight({ ...darts, quan: 1 }));
});

test('Amulet difficulty follows the deepest visited level', () => {
    roomState({ seed: 2, depth: 3 });
    game.dungeons.push({
        dname: 'The Gnomish Mines', depth_start: 4, num_dunlevs: 8,
    });
    game._levelCache = new Map([['1:5', {}]]);

    assert.equal(level_difficulty(), 3);
    game.u.uhave.amulet = 1;
    assert.equal(level_difficulty(), 8);
});

test('the Amulet short-circuits room spawn chance and guarantees a monster', async () => {
    const ordinaryRoom = roomState({ seed: 2 });
    await fill_ordinary_room(ordinaryRoom, false);
    assert.equal(game.level.monsters.length, 0);

    const amuletRoom = roomState({ seed: 2, amulet: true });
    await fill_ordinary_room(amuletRoom, false);

    assert.equal(game.level.monsters.length, 1);
});

test('a generated giant spider owns its co-located web', async () => {
    const room = roomState({ seed: 241, depth: 10, amulet: true });
    await fill_ordinary_room(room, false);

    const spider = game.level.monsters.find(
        monster => monster.mnum === PM_GIANT_SPIDER,
    );
    assert.ok(spider);
    assert.ok(game.level.traps.some(trap =>
        trap.ttyp === WEB && trap.tx === spider.mx && trap.ty === spider.my));
});

test('Rogue room fill omits non-Rogue features', async () => {
    const rogueRoom = roomState({ seed: 2, rogue: true });
    await fill_ordinary_room(rogueRoom, false);

    assert.equal(
        roomTerrain(rogueRoom).some(typ =>
            [FOUNTAIN, SINK, ALTAR, GRAVE].includes(typ)),
        false,
    );
});

test('grave contents are linked and weighted in the buried object chain', async () => {
    const room = roomState({ seed: 153, depth: 20 });
    await fill_ordinary_room(room, false);

    const grave = (() => {
        for (let x = room.lx; x <= room.hx; x++)
            for (let y = room.ly; y <= room.hy; y++)
                if (game.level.at(x, y).typ === GRAVE) return { x, y };
        return null;
    })();
    assert.ok(grave);
    assert.ok(game.level.buriedObjects.length > 0);
    for (const object of game.level.buriedObjects) {
        assert.equal(object.where, 'buried');
        assert.equal(object.buried, true);
        assert.deepEqual({ x: object.ox, y: object.oy }, grave);
        assert.equal(object.owt, objectWeight(object));
        assert.equal(
            game.level.objects?.[grave.x]?.[grave.y]?.includes(object)
                || false,
            false,
        );
    }
});

test('supply chest commits final contained weight and no bridge usage', async () => {
    const room = roomState({ seed: 1 });
    await fill_ordinary_room(room, true);

    const supplyChest = floorObjects().find(object =>
        [CHEST, LARGE_BOX].includes(object.otyp)
        && object.contents?.length > 0);
    assert.ok(supplyChest);
    assert.equal(supplyChest.owt, objectWeight(supplyChest));
});
