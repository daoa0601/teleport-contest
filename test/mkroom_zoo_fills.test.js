import assert from 'node:assert/strict';
import test from 'node:test';
import { ANTHOLE, BARRACKS, BEEHIVE, COCKNEST, COURT, DOOR, GRAVE, HEADSTONE, LEPREHALL, MORGUE, OROOM, SHOPBASE, TEMPLE, THRONE, ZOO, } from '../js/const.js';
import { CHEST, CORPSE, GOLD_PIECE, LARGE_BOX, LUMP_OF_ROYAL_JELLY, MACE, STATUE, } from '../js/object_data.js';
import { init_dungeons } from '../js/dungeon.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { isRoom } from '../js/map_types.js';
import { mklev } from '../js/mklev.js';
import { insideRoom } from '../js/room.js';
import { MONSTER_NAME, MONSTER_SYMBOL } from '../js/monster_data.js';
import { monsterAtPosition } from '../js/monster_location.js';
import { init_objects } from '../js/o_init.js';
import { initRng } from '../js/rng.js';
import { freshGame } from './support/game-state.js';
import { createDungeon } from './support/topology.js';
// C defsym.h monster class numbers used by morguemon()'s output families.
const S_VAMPIRE = 48, S_ZOMBIE = 52, S_WRAITH = 49, S_GHOST = 54, S_DEMON = 56;
const SQUAD_SPECIES = ['soldier', 'sergeant', 'lieutenant', 'captain'];
const RULER_SPECIES = ['gnome ruler', 'dwarf ruler', 'elven monarch', 'ogre tyrant'];
// C mkroom.c:fill_zoo() eligibility for rectangular rooms: SPACE_POS terrain,
// and no stocking in the wall column/row facing the room's first door.
function zooEligibleSquares(level, room) {
    const door = room.doorct ? level.doors[room.fdoor] : null;
    const squares = [];
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++) {
            const location = level.at(x, y);
            if (!location || location.typ <= DOOR)
                continue; // SPACE_POS(typ)
            if (door && ((x === room.lx && door.x === x - 1)
                || (x === room.hx && door.x === x + 1)
                || (y === room.ly && door.y === y - 1)
                || (y === room.hy && door.y === y + 1)))
                continue;
            if (room.rtype === COURT && location.typ === THRONE)
                continue;
            squares.push({ x, y });
        }
    }
    return squares;
}
function objectsAt(level, x, y) {
    return level.objects?.[x]?.[y] ?? [];
}
function findRoom(level, type) {
    return level.rooms.filter(isRoom).find(room => room.rtype === type) ?? null;
}
async function generateLevel(depth, seed, realDungeons = false) {
    freshGame({ moves: 0, flags: { bones: false }, hero: {
            uz: { dnum: 0, dlevel: depth }, ulevel: depth,
        } });
    if (realDungeons) {
        initRng(999);
        init_objects();
        await init_dungeons();
    }
    else {
        game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom',
                num_dunlevs: 60, themeRooms: 'themerms.lua' })];
        initRng(999);
        init_objects();
    }
    initRng(seed);
    await mklev();
    return requireGameLevel();
}
void test('a morgue buries its dead: undead on every eligible square, graves, coffins', async () => {
    const level = await generateLevel(20, 1);
    const room = findRoom(level, MORGUE);
    assert.ok(room, 'depth-20 seed 1 must generate a morgue');
    assert.equal(level.flags.has_morgue, true);
    for (const { x, y } of zooEligibleSquares(level, room)) {
        const monster = monsterAtPosition(level, x, y);
        assert.ok(monster, `morgue square ${x},${y} must hold a monster`);
        assert.ok(monster.msleeping, 'morgue dead rest before disturbance');
        const symbol = MONSTER_SYMBOL[monster.mnum];
        const baseSymbol = monster.cham == null || monster.cham < 0
            ? symbol : MONSTER_SYMBOL[monster.cham];
        assert.ok(symbol === S_ZOMBIE || symbol === S_WRAITH || symbol === S_GHOST
            || symbol === S_DEMON || baseSymbol === S_VAMPIRE, `morgue monster ${MONSTER_NAME[monster.mnum]} must come from morguemon()`);
        const corpses = objectsAt(level, x, y).filter(object => object.otyp === CORPSE);
        assert.ok(corpses.length <= 1, 'a square buries at most one scoreboard corpse');
        const boxes = objectsAt(level, x, y)
            .filter(object => object.otyp === CHEST || object.otyp === LARGE_BOX);
        assert.ok(boxes.length <= 1, 'a square hides at most one box');
        if (level.at(x, y)?.typ === GRAVE) {
            const headstone = (level.engravings ?? [])
                .find(engraving => engraving.x === x && engraving.y === y);
            assert.ok(headstone && headstone.engr_type === HEADSTONE, `grave at ${x},${y} must carry a headstone`);
        }
    }
    assert.ok(zooEligibleSquares(level, room)
        .some(({ x, y }) => level.at(x, y)?.typ === GRAVE), 'the morgue must raise at least one grave');
});
void test('a beehive crowns one queen at its center among sleeping bees and jelly', async () => {
    const level = await generateLevel(24, 7);
    const room = findRoom(level, BEEHIVE);
    assert.ok(room, 'depth-24 seed 7 must generate a beehive');
    assert.equal(level.flags.has_beehive, true);
    const centerX = room.lx + Math.trunc((room.hx - room.lx + 1) / 2);
    const centerY = room.ly + Math.trunc((room.hy - room.ly + 1) / 2);
    let queens = 0;
    for (const { x, y } of zooEligibleSquares(level, room)) {
        const monster = monsterAtPosition(level, x, y);
        assert.ok(monster, `beehive square ${x},${y} must hold a bee`);
        assert.ok(monster.msleeping, 'beehive bees sleep until disturbed');
        if (x === centerX && y === centerY) {
            assert.equal(MONSTER_NAME[monster.mnum], 'queen bee', 'the room center belongs to the queen');
            queens++;
        }
        else {
            assert.equal(MONSTER_NAME[monster.mnum], 'killer bee');
        }
    }
    assert.equal(queens, 1, 'exactly one queen rules the hive');
    assert.ok(zooEligibleSquares(level, room).some(({ x, y }) => objectsAt(level, x, y).some(object => object.otyp === LUMP_OF_ROYAL_JELLY)), 'the hive stores royal jelly');
});
void test('a barracks quarters sleeping soldiers around a payroll chest', async () => {
    const level = await generateLevel(28, 35);
    const room = findRoom(level, BARRACKS);
    assert.ok(room, 'depth-28 seed 35 must generate barracks');
    assert.equal(level.flags.has_barracks, true);
    let boxes = 0;
    for (const { x, y } of zooEligibleSquares(level, room)) {
        const monster = monsterAtPosition(level, x, y);
        assert.ok(monster, `barracks square ${x},${y} must hold a soldier`);
        assert.ok(monster.msleeping, 'garrison soldiers stand down');
        assert.ok(SQUAD_SPECIES.includes(MONSTER_NAME[monster.mnum] ?? ''), `barracks monster ${MONSTER_NAME[monster.mnum]} must come from squadmon()`);
        for (const object of objectsAt(level, x, y))
            if (object.otyp === CHEST || object.otyp === LARGE_BOX)
                boxes++;
    }
    assert.ok(boxes >= 1, 'the payroll chest must be present');
});
void test('a cockatrice nest fills statues with at most four exhibits', async () => {
    const level = await generateLevel(30, 62);
    const room = findRoom(level, COCKNEST);
    assert.ok(room, 'depth-30 seed 62 must generate a cockatrice nest');
    let statues = 0;
    for (const { x, y } of zooEligibleSquares(level, room)) {
        const monster = monsterAtPosition(level, x, y);
        assert.ok(monster, `nest square ${x},${y} must hold a cockatrice`);
        assert.equal(MONSTER_NAME[monster.mnum], 'cockatrice');
        assert.ok(monster.msleeping, 'nest cockatrices sleep');
        for (const statue of objectsAt(level, x, y)
            .filter(object => object.otyp === STATUE)) {
            statues++;
            const contents = statue.contents ?? [];
            assert.ok(contents.length <= 4, `statue at ${x},${y} holds ${contents.length} exhibits`);
        }
    }
    assert.ok(statues > 0, 'the nest must display at least one statue');
});
void test('a court crowns a depth-appropriate ruler with a sceptre and sealed coffer', async () => {
    const level = await generateLevel(5, 4);
    const room = findRoom(level, COURT);
    assert.ok(room, 'depth-5 seed 4 must generate a court');
    assert.equal(level.flags.has_court, true);
    let thrones = 0;
    let throne = null;
    for (let x = room.lx; x <= room.hx; x++)
        for (let y = room.ly; y <= room.hy; y++)
            if (level.at(x, y)?.typ === THRONE) {
                thrones++;
                throne ??= { x, y };
            }
    assert.equal(thrones, 1, 'the court must have exactly one throne');
    assert.ok(throne);
    // C mk_zoo_thronemon() seats the ruler on the throne square; courtmon()
    // may independently draw further gnome-class or giant-class rulers, so
    // the throne occupant, not a level-wide census, is the rule under test.
    const ruler = throne && monsterAtPosition(level, throne.x, throne.y);
    assert.ok(ruler && RULER_SPECIES.includes(MONSTER_NAME[ruler.mnum] ?? ''), 'the throne must seat a ruler');
    if (!ruler)
        throw new Error('unreachable: throne ruler asserted present');
    assert.ok(ruler.msleeping, 'the ruler dozes on the throne');
    assert.equal(ruler.mpeaceful, 0, 'the court resists intruders');
    // C mk_zoo_thronemon(): difficulty 5 draws rnd(5) in 1..5, so only the
    // gnome ruler (1..2) and dwarf ruler (3..5) thrones can appear.
    assert.ok(['gnome ruler', 'dwarf ruler'].includes(MONSTER_NAME[ruler.mnum] ?? ''), `a depth-5 throne cannot seat ${MONSTER_NAME[ruler.mnum]}`);
    const mace = (ruler.minvent ?? []).find(object => object.otyp === MACE);
    assert.ok(mace, 'the ruler pounds a sceptre');
    assert.ok((mace?.spe ?? 0) >= 1, 'princes do not tolerate inferior armaments');
    let coffer = null;
    for (let x = room.lx; x <= room.hx && !coffer; x++)
        for (let y = room.ly; y <= room.hy; y++)
            for (const object of objectsAt(level, x, y))
                if (object.otyp === CHEST && object.spe === 2)
                    coffer = object;
    assert.ok(coffer, 'the royal coffer is marked with spe 2');
    const gold = (coffer?.contents ?? [])
        .find(object => object.otyp === GOLD_PIECE);
    assert.ok(gold && (gold.quan ?? gold.quantity ?? 0) > 0, 'the coffer holds the royal treasure');
});
void test('an ogre tyrant can hold the throne once the difficulty reaches ten', async () => {
    const level = await generateLevel(10, 83);
    const room = findRoom(level, COURT);
    assert.ok(room, 'depth-10 seed 83 must generate a court');
    let throne = null;
    for (let x = room.lx; x <= room.hx && !throne; x++)
        for (let y = room.ly; y <= room.hy; y++)
            if (level.at(x, y)?.typ === THRONE)
                throne = { x, y };
    assert.ok(throne, 'the court must have a throne');
    const occupant = throne && monsterAtPosition(level, throne.x, throne.y);
    assert.equal(occupant && MONSTER_NAME[occupant.mnum], 'ogre tyrant', 'rnd(10) can exceed nine at difficulty ten, seating the ogre tyrant');
});
void test('a zoo leaves the door-facing column empty and covers the rest in gold', async () => {
    const level = await generateLevel(22, 6);
    const room = findRoom(level, ZOO);
    assert.ok(room, 'depth-22 seed 6 must generate a zoo');
    assert.equal(level.flags.has_zoo, true);
    const door = level.doors[room.fdoor];
    assert.ok(door && door.x === room.lx - 1, 'seed 6 zoo must have its first door on the west wall');
    for (let y = room.ly; y <= room.hy; y++) {
        assert.equal(monsterAtPosition(level, room.lx, y), null, `C skips the whole door-facing column (${room.lx},${y})`);
        assert.equal(objectsAt(level, room.lx, y).length, 0);
    }
    let stocked = 0;
    for (const { x, y } of zooEligibleSquares(level, room)) {
        const monster = monsterAtPosition(level, x, y);
        assert.ok(monster, `zoo square ${x},${y} must hold a monster`);
        assert.ok(monster.msleeping, 'zoo animals sleep');
        assert.ok(objectsAt(level, x, y).some(object => object.otyp === GOLD_PIECE), `zoo square ${x},${y} must be carpeted with gold`);
        stocked++;
    }
    assert.ok(stocked > 0);
});
void test('shops keep one lit doorway and never go big wand or book', async () => {
    let shops = 0;
    let bigRooms = 0;
    for (let seed = 1; seed <= 80; seed++) {
        const level = await generateLevel(6, seed, true);
        const room = level.rooms.filter(isRoom)
            .find(candidate => candidate.rtype >= SHOPBASE);
        if (!room)
            continue;
        shops++;
        assert.equal(room.doorct, 1, 'a shop opens through a single door');
        assert.equal(room.rlit, 1, 'a shop room is lit');
        for (let x = room.lx - 1; x <= room.hx + 1; x++)
            for (let y = room.ly - 1; y <= room.hy + 1; y++) {
                const location = level.at(x, y);
                if (location)
                    assert.equal(location.lit, true, `shop border ${x},${y} must be lit`);
            }
        const area = (room.hx - room.lx + 1) * (room.hy - room.ly + 1);
        if (area > 20) {
            bigRooms++;
            assert.ok(room.rtype !== SHOPBASE + 7 && room.rtype !== SHOPBASE + 9, 'big rooms fall back from wand and book shops to the general store');
        }
    }
    assert.ok(shops >= 10, `expected a healthy shop sample, saw ${shops}`);
    assert.ok(bigRooms >= 1, 'sample must include at least one big shop room');
});
void test('pick_room prefers single doors and accepts multi-door rooms one visit in five', async () => {
    // C mkroom.c:pick_room() takes a doorct==1 room without a draw and keeps
    // a multi-doored candidate only when !rn2(5) succeeds.  Swamps are chosen
    // by mkswamp() and shops by mkshop() (doorct==1 only), so neither feeds
    // this sample.  With a multi-door fraction f among stair-free ordinary
    // rooms, always-accept would seat multi-door rooms at rate ~f, while the
    // one-in-five rule predicts f/(5-4f); with f near 0.9 that is 0.69
    // against 0.92, so a 0.82*f ceiling rejects always-accept and 1/3-or-more
    // acceptance while leaving the native rate well below it.
    const pickedTypes = [COURT, ZOO, BEEHIVE, MORGUE, BARRACKS, LEPREHALL,
        COCKNEST, ANTHOLE, TEMPLE];
    let chosen = 0;
    let chosenMulti = 0;
    let stairFree = 0;
    let stairFreeMulti = 0;
    for (let seed = 1; seed <= 400; seed++) {
        const level = await generateLevel(12 + (seed % 18), seed);
        const picked = level.rooms.filter(isRoom)
            .find(room => pickedTypes.includes(room.rtype));
        if (picked) {
            chosen++;
            if (picked.doorct > 1)
                chosenMulti++;
        }
        for (const room of level.rooms.filter(isRoom)) {
            if (room.rtype !== OROOM)
                continue;
            if (roomHasStair(room, true) || roomHasStair(room, false))
                continue;
            stairFree++;
            if (room.doorct > 1)
                stairFreeMulti++;
        }
    }
    assert.ok(chosen >= 100, `expected a broad special-room sample, saw ${chosen}`);
    assert.ok(chosen - chosenMulti >= 5 && chosenMulti >= 5, 'both acceptance outcomes must occur in the sample');
    const populationRate = stairFreeMulti / stairFree;
    const acceptanceRate = chosenMulti / chosen;
    assert.ok(acceptanceRate < 0.82 * populationRate, `multi-door acceptance ${acceptanceRate.toFixed(3)} is too close to the `
        + `population rate ${populationRate.toFixed(3)} for a one-in-five draw`);
});
function roomHasStair(room, up) {
    for (let stair = game.stairs; stair; stair = stair.next) {
        if (!!stair.up !== up)
            continue;
        if (insideRoom(game.level, room, stair.sx, stair.sy))
            return true;
    }
    return false;
}
//# sourceMappingURL=mkroom_zoo_fills.test.js.map