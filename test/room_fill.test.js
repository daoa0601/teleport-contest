import test from 'node:test';
import assert from 'node:assert/strict';
import { ALTAR, FILL_NORMAL, FOUNTAIN, GRAVE, OROOM, ROOM, ROOMOFFSET, SINK, } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { fill_ordinary_room, mksobj, } from '../js/mklev.js';
import { level_difficulty } from '../js/dungeon.js';
import { CHEST, DART, LARGE_BOX, } from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { objectWeight } from '../js/weight.js';
import { floorObjects } from './support/level-state.js';
import { freshGame } from './support/game-state.js';
function roomState({ seed, depth = 1, amulet = false, rogue = false }) {
    freshGame({
        hero: {
            uz: { dnum: 0, dlevel: depth },
            ulevel: Math.max(1, Math.min(depth, 15)),
            uhp: 50, uhpmax: 50,
            uhave: { amulet: amulet ? 1 : 0 },
        },
        flags: {},
        moves: 2,
    });
    requirePlayingGame(game);
    game.in_mklev = true;
    game.dungeons = [{
            dname: 'The Dungeons of Doom',
            depth_start: 1,
            num_dunlevs: 30,
            entry_lev: 1,
            dunlev_ureached: depth,
            flags: { maze_like: false, hellish: false, alignment: null },
            bonetag: undefined, protofile: undefined, levelFill: undefined, themeRooms: undefined,
        }];
    game.oracle_level = { dnum: 0, dlevel: 5, flags: { town: false }, alignment: null };
    if (rogue)
        game.rogue_level = { ...game.u.uz };
    requireGameLevel().nroom = 1;
    const room = {
        lx: 10, hx: 14, ly: 5, hy: 8,
        rtype: OROOM, needfill: FILL_NORMAL,
        rlit: 1, doorct: 0, fdoor: 0, irregular: false, needjoining: false,
        sbrooms: [], nsubrooms: 0, roomnoidx: 0,
    };
    requireGameLevel().rooms = [room];
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            const loc = requireGameLevel().requireAt(x, y);
            loc.typ = ROOM;
            loc.roomno = ROOMOFFSET;
        }
    }
    initRng(999n);
    init_objects();
    initRng(BigInt(seed));
    return room;
}
function roomTerrain(room) {
    const terrain = [];
    for (let x = room.lx; x <= room.hx; x++)
        for (let y = room.ly; y <= room.hy; y++)
            terrain.push(requireGameLevel().requireAt(x, y).typ);
    return terrain;
}
void test('mksobj finalizes stack weight after type-specific initialization', async () => {
    roomState({ seed: 17 });
    const darts = await mksobj(DART, true, false);
    assert.ok(darts.quan >= 6);
    assert.equal(darts.owt, objectWeight(darts));
    assert.ok(darts.owt > objectWeight({ ...darts, quan: 1 }));
});
void test('Amulet difficulty follows the deepest visited level', () => {
    roomState({ seed: 2, depth: 3 });
    game.dungeons.push({
        dname: 'The Gnomish Mines', depth_start: 4, num_dunlevs: 8,
        entry_lev: 1, dunlev_ureached: 5,
        flags: { maze_like: false, hellish: false, alignment: null },
        bonetag: undefined, protofile: undefined, levelFill: undefined, themeRooms: undefined,
    });
    assert.equal(level_difficulty(), 3);
    requirePlayingGame(game);
    game.u.uhave.amulet = 1;
    assert.equal(level_difficulty(), 8);
});
void test('the Amulet short-circuits room spawn chance and guarantees a monster', async () => {
    const ordinaryRoom = roomState({ seed: 2 });
    await fill_ordinary_room(ordinaryRoom, false);
    assert.equal(requireGameLevel().monsters.length, 0);
    const amuletRoom = roomState({ seed: 2, amulet: true });
    await fill_ordinary_room(amuletRoom, false);
    assert.equal(requireGameLevel().monsters.length, 1);
});
void test('Rogue room fill omits non-Rogue features', async () => {
    const rogueRoom = roomState({ seed: 2, rogue: true });
    await fill_ordinary_room(rogueRoom, false);
    assert.equal(roomTerrain(rogueRoom).some(typ => [FOUNTAIN, SINK, ALTAR, GRAVE].includes(typ)), false);
});
void test('grave contents are linked and weighted in the buried object chain', async () => {
    const room = roomState({ seed: 153, depth: 20 });
    await fill_ordinary_room(room, false);
    const grave = (() => {
        for (let x = room.lx; x <= room.hx; x++)
            for (let y = room.ly; y <= room.hy; y++)
                if (requireGameLevel().requireAt(x, y).typ === GRAVE)
                    return { x, y };
        return null;
    })();
    assert.ok(grave);
    const buried = requireGameLevel().buriedObjects;
    assert.ok(buried && buried.length > 0);
    for (const object of buried) {
        assert.equal(object.where, 'buried');
        assert.equal(object.buried, true);
        assert.deepEqual({ x: object.ox, y: object.oy }, grave);
        assert.equal(object.owt, objectWeight(object));
        assert.equal(requireGameLevel().objects?.[grave.x]?.[grave.y]?.includes(object)
            || false, false);
    }
});
void test('supply chest weight includes its contents', async () => {
    const room = roomState({ seed: 1 });
    await fill_ordinary_room(room, true);
    const supplyChest = floorObjects(requireGameLevel()).find(object => [CHEST, LARGE_BOX].includes(object.otyp)
        && (object.contents?.length ?? 0) > 0);
    assert.ok(supplyChest);
    assert.equal(supplyChest.owt, objectWeight(supplyChest));
});
//# sourceMappingURL=room_fill.test.js.map