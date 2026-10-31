import test from 'node:test';
import assert from 'node:assert/strict';
import {
    A_NONE, ALTAR, COLNO, FOUNTAIN, LAVAPOOL, ROOM, ROOMOFFSET,
    ROWNO, SDOOR, W_NONDIGGABLE, W_NONPASSWALL,
} from '../js/const.js';
import { game } from '../js/gstate.js';
import { AMULET_OF_YENDOR } from '../js/object_data.js';
import { shrinePosition, roomHasStair } from '../js/mkroom.js';
import { bound_digging, setLevelTerrainType } from '../js/mkmaze.js';
import { specialShrinePriest } from '../js/priest.js';
import { stairway_add } from '../js/mklev.js';
import { initRng } from '../js/rng.js';
import type { Room } from '../js/map_types.js';
import { freshObjectRoom } from './support/object-room.js';

function plainRoom(overrides: Partial<Room> = {}): Room {
    return {
        lx: 10, hx: 12, ly: 10, hy: 11, rlit: 1, rtype: 0,
        needfill: 0, doorct: 0, fdoor: 0, nsubrooms: 0, sbrooms: [],
        roomnoidx: 0, irregular: false, needjoining: false,
        ...overrides,
    };
}

// C mkroom.c:shrine_pos().  Each axis with an even interior span owns one
// independent rn2(2) tie-breaker between its two central squares; an odd
// span has a single exact center and consumes no draw.
void test('shrine_pos breaks center ties per axis', async () => {
    await freshObjectRoom({ gameplaySeed: 5n });
    const oddWidth = shrinePosition(plainRoom({ lx: 10, hx: 12, ly: 10, hy: 10 }));
    assert.deepEqual(oddWidth, { x: 11, y: 10 });

    for (const seed of [1n, 2n, 3n, 4n]) {
        initRng(seed);
        const even = shrinePosition(plainRoom({ lx: 10, hx: 11, ly: 10, hy: 11 }));
        assert.ok(even.x === 10 || even.x === 11, `x center out of range: ${even.x}`);
        assert.ok(even.y === 10 || even.y === 11, `y center out of range: ${even.y}`);
    }
});

// C mkroom.c:has_upstairs()/has_dnstairs().  A stairway counts for the room
// whose bounds contain it, and only for its own direction.
void test('room stair membership follows bounds and direction', async () => {
    await freshObjectRoom({ gameplaySeed: 9n });
    const room = plainRoom();
    const before = { up: roomHasStair(room, true), down: roomHasStair(room, false) };
    assert.equal(before.up, false);
    assert.equal(before.down, false);

    stairway_add(11, 10, true, false, { dnum: 0, dlevel: 1 });
    assert.equal(roomHasStair(room, true), true);
    assert.equal(roomHasStair(room, false), false);

    stairway_add(40, 10, false, true, { dnum: 0, dlevel: 1 });
    assert.equal(roomHasStair(room, false), false,
        'a stair outside the room bounds never counts');
});

// C mkmaze.c:set_levltyp().  Every lava form becomes lit even when it
// replaces lit-agnostic terrain, and fountain or sink membership changes
// recount the level's feature counters.
void test('set_levltyp lights lava and recounts fountains', async () => {
    const level = await freshObjectRoom({ gameplaySeed: 13n });
    const fountain = level.requireAt(9, 8);
    fountain.typ = FOUNTAIN;
    level.flags.nfountains = 0;

    assert.equal(setLevelTerrainType(9, 8, LAVAPOOL), true);
    assert.equal(fountain.typ, LAVAPOOL);
    assert.equal(fountain.lit, true, 'lava placed by set_levltyp must be lit');
    assert.equal(level.flags.nfountains, 0,
        'replacing the only fountain recounts the level to zero fountains');

    assert.equal(setLevelTerrainType(9, 8, FOUNTAIN), true);
    assert.equal(level.flags.nfountains, 1);

    assert.equal(setLevelTerrainType(9, 8, ROOM), true);
    assert.equal(level.flags.nfountains, 0);
});

// C mkmaze.c:get_level_extends()/bound_digging().  Stone beyond the level's
// usable extent is nondiggable everywhere, and stone strictly outside the
// extent is also impermeable; terrain inside the extent keeps both bits off.
void test('bound_digging marks only stone outside the level extent', async () => {
    const level = await freshObjectRoom({
        left: 30, right: 32, top: 10, bottom: 11, gameplaySeed: 17n,
    });
    for (let x = 1; x < COLNO - 1; x++)
        for (let y = 0; y < ROWNO; y++)
            level.requireAt(x, y).wall_info = 0;

    bound_digging();

    const interior = level.requireAt(31, 10);
    assert.equal(interior.typ, ROOM);
    assert.equal(interior.wall_info & (W_NONDIGGABLE | W_NONPASSWALL), 0);

    const farStone = level.requireAt(70, 20);
    assert.equal(farStone.wall_info & W_NONDIGGABLE, W_NONDIGGABLE);
    assert.equal(farStone.wall_info & W_NONPASSWALL, W_NONPASSWALL);

    const nearStone = level.requireAt(29, 10);
    assert.equal(nearStone.wall_info & W_NONDIGGABLE, W_NONDIGGABLE,
        'stone on the extent edge is still nondiggable');
    assert.equal(nearStone.wall_info & W_NONPASSWALL, 0,
        'stone on the extent edge stays phaseable');
});

// C priest.c:priestini().  A shrine priest registers its temple room,
// shrine square, alignment and level, arrives peaceful and awake, and a
// sanctum priest of the neutral alignment carries the Amulet of Yendor.
void test('priestini registers a shrine priest over the altar', async () => {
    const level = await freshObjectRoom({ gameplaySeed: 21n });
    game.u.uz = { dnum: 0, dlevel: 8 };
    level.requireAt(10, 7).typ = SDOOR;
    const altar = level.requireAt(11, 7);
    altar.typ = ALTAR;
    const temple = plainRoom({ lx: 10, hx: 12, ly: 6, hy: 8 });

    const priest = await specialShrinePriest(temple, 11, 7, 0);
    assert.ok(priest, 'priestini must place a priest beside the altar');
    const shrinePriest = priest.epri;
    assert.ok(shrinePriest, 'the shrine priest registers its extension');
    assert.equal(priest.ispriest, 1);
    assert.equal(priest.mpeaceful, 1);
    assert.equal(priest.msleeping, 0);
    assert.equal(shrinePriest.shroom, ROOMOFFSET);
    assert.deepEqual(shrinePriest.shrpos, { x: 11, y: 7 });
    assert.equal(shrinePriest.shralign, 0);
    assert.deepEqual(shrinePriest.shrlevel, { dnum: 0, dlevel: 8 });
    assert.equal(shrinePriest.parentmid, priest.m_id);
    const inventory = priest.minvent ?? [];
    assert.ok(!inventory.some(object => object.otyp === AMULET_OF_YENDOR));

    // A second priestini pass on the same shrine would have to relocate the
    // first priest, which the bare room fixture cannot complete; give the
    // sanctum priest its own shrine on a fresh level.
    const sanctumLevel = await freshObjectRoom({ gameplaySeed: 23n });
    sanctumLevel.requireAt(11, 7).typ = ALTAR;
    const sanctum = await specialShrinePriest(
        temple, 11, 7, A_NONE, { sanctum: true },
    );
    assert.ok(sanctum, 'the sanctum priest must exist');
    const sanctumInventory = sanctum.minvent ?? [];
    assert.ok(sanctumInventory.some(object => object.otyp === AMULET_OF_YENDOR),
        'the sanctum priest carries the Amulet');
});
