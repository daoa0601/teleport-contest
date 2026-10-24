import test from 'node:test';
import assert from 'node:assert/strict';
import { ALTAR, CORR, DOOR, FOUNTAIN, GRAVE, Is_rogue_level, OROOM, ROOM, SCORR, SDOOR, SINK, } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { mklev } from '../js/mklev.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { initializeArtifacts } from '../js/artifacts.js';
import { ARROW, BOW, FAKE_AMULET_OF_YENDOR, FOOD_RATION, MACE, OBJECT_NAMES, RING_MAIL, TWO_HANDED_SWORD, } from '../js/object_data.js';
import { isRoom } from '../js/map_types.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createDungeon, createSpecialLevel } from './support/topology.js';
import { floorObjects, levelStairs } from './support/level-state.js';
// C do_name.c:roguename() picks one of the three Rogue authors, and monst.h
// numbers the ghost species used by extralev.c makerogueghost().
const ROGUE_PLAYER_NAMES = ['Michael Toy', 'Kenneth Arnold', 'Glenn Wichman'];
const PM_GHOST = 287;
const PLATE_MAIL = OBJECT_NAMES.indexOf('plate mail');
const PASSABLE_TERRAIN = [ROOM, CORR, SCORR, DOOR, SDOOR];
// Drive the level-generation entry point the way a level arrival does: the
// dungeon descriptor carries the named "rogue" level, and its prototype
// reaches mklev() before the Rogue branch is selected.
async function generateRogueLevel(seed) {
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
function roomsOfLevel() {
    const level = requireGameLevel();
    return level.rooms.slice(0, level.nroom).filter(isRoom);
}
// Flood from the first room across walkable Rogue terrain; every real room
// must be reachable because miniwalk links all nine grid cells.
function visitedRoomCells(level) {
    const rooms = roomsOfLevel();
    const start = rooms[0];
    assert.ok(start, 'the Rogue level has at least one room');
    const seen = new Set([start.lx * 100 + start.ly]);
    const queue = [[start.lx, start.ly]];
    while (queue.length) {
        const current = queue.shift();
        if (!current)
            break;
        const [x, y] = current;
        const neighbors = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
        for (const [nx, ny] of neighbors) {
            const key = nx * 100 + ny;
            if (seen.has(key))
                continue;
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
                    if (reached.has(x * 100 + y))
                        visited = true;
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
        assert.ok(ROGUE_PLAYER_NAMES.includes(ghost.mgivenname ?? ''), `ghost is named after a Rogue author, got ${ghost.mgivenname}`);
        const pile = floorObjects(level).filter(object => object.ox === ghost.mx && object.oy === ghost.my);
        const byType = (type) => pile.filter(object => object.otyp === type);
        // The bow and arrow volley are always present (extralev.c).
        const bow = byType(BOW)[0];
        assert.equal(byType(BOW).length, 1);
        assert.ok(bow);
        assert.equal(bow.spe, 1);
        const arrow = byType(ARROW)[0];
        assert.equal(byType(ARROW).length, 1);
        assert.ok(arrow);
        assert.equal(arrow.spe, 0);
        assert.ok(arrow.quan >= 25 && arrow.quan <= 34, `arrow count ${arrow.quan} uses rn1(10, 25)`);
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
                if (typ === CORR || typ === SCORR)
                    corridors++;
                assert.ok(![FOUNTAIN, SINK, ALTAR, GRAVE].includes(typ ?? -1), 'Rogue rooms never receive fountains, sinks, altars, or graves');
            }
        }
        assert.ok(corridors > 0, 'corridor carving produced passable corridors');
        const stairs = levelStairs(game);
        assert.equal(stairs.length, 2, 'a mid-dungeon Rogue level has up and down stairs');
        assert.equal(stairs.filter(stair => stair.up).length, 1);
    }
});
//# sourceMappingURL=rogue_level_generation.test.js.map