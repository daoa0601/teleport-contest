import test from 'node:test';
import assert from 'node:assert/strict';

import {
    ALTAR, CORR, DOOR, FOUNTAIN, GRAVE, Is_rogue_level, OROOM, ROOM,
    SCORR, SDOOR, SINK, STAIRS, FILL_NONE, FILL_NORMAL, D_NODOOR,
} from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { init_dungeons } from '../js/dungeon.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { initializeArtifacts } from '../js/artifacts.js';
import {
    ARROW, BOW, FAKE_AMULET_OF_YENDOR, FOOD_RATION, MACE, OBJECT_NAMES,
    RING_MAIL, TWO_HANDED_SWORD,
} from '../js/object_data.js';
import { isRoom, type Room } from '../js/map_types.js';
import type { GameMap } from '../js/game.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
import { floorObjects, levelStairs } from './support/level-state.js';

// C do_name.c:roguename() picks one of the three Rogue authors, and monst.h
// numbers the ghost species used by extralev.c makerogueghost().
const ROGUE_PLAYER_NAMES = ['Michael Toy', 'Kenneth Arnold', 'Glenn Wichman'];
const PM_GHOST = 287;
const PLATE_MAIL = OBJECT_NAMES.indexOf('plate mail');
// Stairs are walkable terrain: generate_stairs() can drop one on a room
// cell that a flood fill would otherwise need to enter through.
const PASSABLE_TERRAIN = [ROOM, CORR, SCORR, DOOR, SDOOR, STAIRS];

// Drive the level-generation entry point the way a level arrival does: the
// dungeon descriptor carries the named "rogue" level, and its prototype
// reaches mklev() before the Rogue branch is selected.
async function generateRogueLevel(seed: bigint): Promise<GameMap> {
    freshPlayableRoom({ seed, hero: { uz: { dnum: 0, dlevel: 1 } } });
    requirePlayingGame(game);
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 30 })];
    init_objects();
    initializeArtifacts(game);
    game.specialLevels = new Map([
        ['rogue', createSpecialLevel({ dnum: 0, dlevel: 15 })],
    ]);
    game._specialLevelPrototype = 'rogue';
    game.u.uz = { dnum: 0, dlevel: 15 };
    initRng(seed);
    await mklev();
    return requireGameLevel();
}

function roomsOfLevel(): Room[] {
    const level = requireGameLevel();
    return level.rooms.slice(0, level.nroom).filter(isRoom);
}

// Flood from the first room across walkable Rogue terrain; every real room
// must be reachable because miniwalk links all nine grid cells.
function visitedRoomCells(level: GameMap): Set<number> {
    const rooms = roomsOfLevel();
    const start = rooms[0];
    assert.ok(start, 'the Rogue level has at least one room');
    const seen = new Set<number>([start.lx * 100 + start.ly]);
    const queue: Array<[number, number]> = [[start.lx, start.ly]];
    while (queue.length) {
        const current = queue.shift();
        if (!current) break;
        const [x, y] = current;
        const neighbors: Array<[number, number]> =
            [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
        for (const [nx, ny] of neighbors) {
            const key = nx * 100 + ny;
            if (seen.has(key)) continue;
            if (PASSABLE_TERRAIN.includes(level.at(nx, ny)?.typ ?? -1)) {
                seen.add(key);
                queue.push([nx, ny]);
            }
        }
    }
    return seen;
}

void test('Rogue rooms sit inside their 3x3 grid cells and stay connected', async () => {
    for (const seed of [1n, 7n, 42n]) {
        const level = await generateRogueLevel(seed);
        assert.ok(Is_rogue_level(game.u.uz), 'generation binds the Rogue level location');
        const rooms = roomsOfLevel();
        assert.ok(rooms.length >= 1 && rooms.length <= 9);
        for (const room of rooms) {
            assert.equal(room.rtype, OROOM);
            const cell = [0, 1, 2].flatMap(bx => [0, 1, 2].map(by => ({ bx, by })))
                .find(({ bx, by }) => room.lx >= 26 * bx + 2 && room.hx <= 26 * bx + 24
                    && room.ly >= 7 * by + 1 && room.hy <= 7 * by + 5);
            assert.ok(cell, `room ${room.lx},${room.ly}-${room.hx},${room.hy} fits a grid cell`);
        }
        const reached = visitedRoomCells(level);
        for (const room of rooms) {
            let visited = false;
            for (let x = room.lx; x <= room.hx && !visited; x++)
                for (let y = room.ly; y <= room.hy && !visited; y++)
                    if (reached.has(x * 100 + y)) visited = true;
            assert.ok(visited, 'corridors reach every room through doorways');
        }
    }
});

void test('the Rogue ghost sleeps over its fixed tribute inventory', async () => {
    for (const seed of [1n, 7n, 42n]) {
        await generateRogueLevel(seed);
        const level = requireGameLevel();
        const ghosts = level.monsters.filter(monster => monster.mnum === PM_GHOST);
        assert.equal(ghosts.length, 1);
        const ghost = ghosts[0];
        assert.ok(ghost, 'the single ghost exists');
        assert.equal(ghost.msleeping, 1, 'the bones ghost starts asleep');
        assert.ok(ROGUE_PLAYER_NAMES.includes(ghost.mgivenname ?? ''),
            `ghost is named after a Rogue author, got ${ghost.mgivenname}`);

        const pile = floorObjects(level).filter(object =>
            object.ox === ghost.mx && object.oy === ghost.my);
        const byType = (type: number) => pile.filter(object => object.otyp === type);

        // The bow and arrow volley are always present (extralev.c).
        const bow = byType(BOW)[0];
        assert.equal(byType(BOW).length, 1);
        assert.ok(bow);
        assert.equal(bow.spe, 1);
        const arrow = byType(ARROW)[0];
        assert.equal(byType(ARROW).length, 1);
        assert.ok(arrow);
        assert.equal(arrow.spe, 0);
        assert.ok(arrow.quan >= 25 && arrow.quan <= 34,
            `arrow count ${arrow.quan} uses rn1(10, 25)`);

        // One melee weapon: a mace or a two-handed sword.
        const weapon = [...byType(MACE), ...byType(TWO_HANDED_SWORD)][0];
        assert.equal([...byType(MACE), ...byType(TWO_HANDED_SWORD)].length, 1);
        assert.ok(weapon);
        if (weapon.otyp === MACE)
            assert.ok(weapon.spe >= 1 && weapon.spe <= 3);
        else
            assert.ok(weapon.spe >= -1 && weapon.spe <= 3);

        // One suit of armor: ring mail or plate mail.
        const armor = [...byType(RING_MAIL), ...byType(PLATE_MAIL)][0];
        assert.equal([...byType(RING_MAIL), ...byType(PLATE_MAIL)].length, 1);
        assert.ok(armor);
        if (armor.otyp === RING_MAIL)
            assert.ok(armor.spe >= 0 && armor.spe <= 2);
        else
            assert.ok(armor.spe >= -1 && armor.spe <= 3);

        // Optional tribute items keep their C rolls.
        const ration = byType(FOOD_RATION)[0];
        if (ration) {
            assert.equal(byType(FOOD_RATION).length, 1);
            assert.ok(ration.quan >= 1 && ration.quan <= 7);
        }
        const amulet = byType(FAKE_AMULET_OF_YENDOR)[0];
        if (amulet) {
            assert.equal(byType(FAKE_AMULET_OF_YENDOR).length, 1);
            assert.equal(amulet.known, true);
        }
    }
});

void test('the Rogue level carries both stairways and no ordinary furniture', async () => {
    for (const seed of [1n, 7n, 42n]) {
        const level = await generateRogueLevel(seed);
        let corridors = 0;
        for (let x = 1; x < 80; x++) {
            for (let y = 0; y < 22; y++) {
                const typ = level.at(x, y)?.typ;
                if (typ === CORR || typ === SCORR) corridors++;
                assert.ok(![FOUNTAIN, SINK, ALTAR, GRAVE].includes(typ ?? -1),
                    'Rogue rooms never receive fountains, sinks, altars, or graves');
            }
        }
        assert.ok(corridors > 0, 'corridor carving produced passable corridors');
        const stairs = levelStairs(game);
        assert.equal(stairs.length, 2, 'a mid-dungeon Rogue level has up and down stairs');
        assert.equal(stairs.filter(stair => stair.up).length, 1);
    }
});

void test('Rogue rooms stay unfilled even after a level that filled its rooms', async () => {
    // Ordinary levels mark their themed rooms FILL_NORMAL during generation
    // (C sp_lev des.room "filled"). When the hero leaves, savelev() releases
    // the level and memsets the shared rooms[] array (save.c:564; reached
    // from goto_level's WRITING|FREEING save and from #wizmakemap), so every
    // level generation starts with FILL_NONE slots. The Rogue level drawn
    // right after a filled level therefore never counts a fillable room,
    // never draws the bonus-room selection, and no Rogue room is stocked.
    freshPlayableRoom({ seed: 5n, hero: { uz: { dnum: 0, dlevel: 1 } } });
    requirePlayingGame(game);
    await init_dungeons();
    game.u.uz = { dnum: 0, dlevel: 3 };
    initRng(5n);
    await mklev();
    const ordinary = requireGameLevel();
    assert.ok(roomsOfLevel().some(room => room.needfill === FILL_NORMAL),
        'the ordinary level left fillable rooms behind');
    assert.ok(ordinary.monsters.length > 0, 'ordinary room filling ran');

    const rogueLocation = game.specialLevels?.get('rogue');
    assert.ok(rogueLocation, 'the dungeon descriptor places the rogue level');
    game._specialLevelPrototype = 'rogue';
    game.u.uz = { dnum: rogueLocation.dnum, dlevel: rogueLocation.dlevel };
    initRng(9n);
    await mklev();
    const rogue = requireGameLevel();
    assert.ok(Is_rogue_level(game.u.uz));
    for (const room of roomsOfLevel())
        assert.equal(room.needfill, FILL_NONE,
            'the released level left no fillable room slots');

    // No fill_ordinary_room products anywhere: the only monster is the
    // tribute ghost and the only floor objects are its pile; no traps.
    const ghost = rogue.monsters.find(monster => monster.mnum === PM_GHOST);
    assert.ok(ghost);
    assert.equal(rogue.monsters.length, 1, 'room filling added no monsters');
    assert.equal(rogue.traps.length, 0, 'room filling added no traps');
    for (const object of floorObjects(rogue)) {
        assert.ok(object.ox === ghost.mx && object.oy === ghost.my,
            'the only floor objects are the ghost tribute items');
    }
});

// extralev.c roguecorr()/dodoor(): every corridor endpoint punches a hole
// through the room's wall ring, and dosdoor() forces D_NODOOR on the Rogue
// level, so no doorway there is ever an openable, locked, or trapped door.
// maybe_sdoor(8) still supplies the hole type, so SDOOR holes occur too.
void test('Rogue doorways are wall holes, never openable doors', async () => {
    for (const seed of [2n, 11n, 19n]) {
        const level = await generateRogueLevel(seed);
        const rooms = roomsOfLevel();
        assert.ok(rooms.length > 0, 'the Rogue level has rooms');
        let doorways = 0;
        for (let x = 1; x < 80; x++) {
            for (let y = 0; y < 22; y++) {
                const loc = level.at(x, y);
                if (!loc || (loc.typ !== DOOR && loc.typ !== SDOOR)) continue;
                doorways++;
                assert.equal(loc.doormask, D_NODOOR,
                    `doorway at ${x},${y} is not a plain opening`);
                const besideRoom = rooms.some(room =>
                    (x === room.lx - 1 || x === room.hx + 1)
                        && y >= room.ly - 1 && y <= room.hy + 1
                    || (y === room.ly - 1 || y === room.hy + 1)
                        && x >= room.lx - 1 && x <= room.hx + 1);
                assert.ok(besideRoom, `doorway at ${x},${y} sits on no room wall`);
            }
        }
        assert.ok(doorways > 0, 'corridor carving punched room-wall holes');
        for (const room of rooms) {
            let hole = false;
            for (let x = room.lx - 1; x <= room.hx + 1 && !hole; x++)
                for (const y of [room.ly - 1, room.hy + 1]) {
                    const typ = level.at(x, y)?.typ;
                    if (typ === DOOR || typ === SDOOR) { hole = true; break; }
                }
            for (let y = room.ly; y <= room.hy && !hole; y++)
                for (const x of [room.lx - 1, room.hx + 1]) {
                    const typ = level.at(x, y)?.typ;
                    if (typ === DOOR || typ === SDOOR) { hole = true; break; }
                }
            assert.ok(hole,
                `room ${room.lx},${room.ly}-${room.hx},${room.hy} has no doorway`);
        }
    }
});

// extralev.c roguejoin() draws each corridor as three axis-aligned runs
// whose endpoints stop one step short of the room floors, and corr() makes
// each carved cell a secret corridor one time in fifty.
void test('Rogue corridors never cross a room and sometimes run secret', async () => {
    let secretCorridorSeen = false;
    for (const seed of [3n, 13n, 23n, 31n, 37n]) {
        const level = await generateRogueLevel(seed);
        const rooms = roomsOfLevel();
        for (let x = 1; x < 80; x++) {
            for (let y = 0; y < 22; y++) {
                const typ = level.at(x, y)?.typ;
                if (typ !== CORR && typ !== SCORR) continue;
                if (typ === SCORR) secretCorridorSeen = true;
                const insideRoom = rooms.some(room =>
                    x >= room.lx && x <= room.hx && y >= room.ly && y <= room.hy);
                assert.ok(!insideRoom,
                    `corridor cell ${x},${y} cuts room floor`);
            }
        }
    }
    assert.ok(secretCorridorSeen, 'corr() carved at least one SCORR');
});

// extralev.c makeroguerooms() turns a grid cell into a dummy one fifth of
// the time (never cell 2,2 unless a room already exists). Dummy cells hold
// no room, yet miniwalk still routes corridors across their anchor points.
void test('dummy grid cells carry corridors without rooms', async () => {
    let dummyCellSeen = false, corridorThroughDummy = false;
    for (let seed = 1n; seed <= 12n; seed++) {
        const level = await generateRogueLevel(seed);
        const rooms = roomsOfLevel();
        assert.ok(rooms.length >= 1 && rooms.length <= 9);
        for (let bx = 0; bx < 3; bx++) {
            for (let by = 0; by < 3; by++) {
                const x0 = 26 * bx + 2, x1 = 26 * bx + 24;
                const y0 = 7 * by + 1, y1 = 7 * by + 5;
                const holdsRoom = rooms.some(room =>
                    room.lx >= x0 && room.hx <= x1 && room.ly >= y0 && room.hy <= y1);
                if (holdsRoom) continue;
                dummyCellSeen = true;
                for (let x = x0; x <= x1 && !corridorThroughDummy; x++)
                    for (let y = y0; y <= y1; y++) {
                        const typ = level.at(x, y)?.typ;
                        if (typ === CORR || typ === SCORR) {
                            corridorThroughDummy = true;
                            break;
                        }
                    }
            }
        }
    }
    assert.ok(dummyCellSeen, 'some seed picked a dummy cell over a room');
    assert.ok(corridorThroughDummy,
        'miniwalk routed a corridor across a dummy cell');
});

// extralev.c makerogueghost() places the tribute ghost at somex()/somey()
// of a random real room, so it always stands on that room's floor.
void test('the Rogue ghost stands on a room floor', async () => {
    for (const seed of [5n, 17n, 29n]) {
        const level = await generateRogueLevel(seed);
        const ghost = level.monsters.find(monster => monster.mnum === PM_GHOST);
        assert.ok(ghost, 'the tribute ghost exists');
        const inside = roomsOfLevel().some(room =>
            ghost.mx >= room.lx && ghost.mx <= room.hx
            && ghost.my >= room.ly && ghost.my <= room.hy);
        assert.ok(inside, `ghost at ${ghost.mx},${ghost.my} left every room`);
    }
});
