import test from 'node:test';
import assert from 'node:assert/strict';
import { ANTHOLE, COCKNEST, FILL_NORMAL, LEPREHALL, ROOMOFFSET } from '../js/const.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { fillSpecialRoom } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { GOLD_PIECE } from '../js/object_data.js';
import type { Room } from '../js/map_types.js';
import { floorObjects } from './support/level-state.js';
import { freshObjectRoom } from './support/object-room.js';

function specialRoom(type: number): Room {
    const level = freshObjectRoom({ left: 10, right: 12, top: 10, bottom: 11, gameplaySeed: 321 });
    requirePlayingGame(game);
    game.in_mklev = true;
    game.ubirthday = 0;
    const room: Room = {
        lx: 10, hx: 12, ly: 10, hy: 11, rtype: type, rlit: 1,
        needfill: FILL_NORMAL, doorct: 0, fdoor: 0,
        nsubrooms: 0, sbrooms: [], roomnoidx: 0, irregular: false, needjoining: false,
    };
    level.rooms = [room];
    level.nroom = 1;
    for (let x = room.lx; x <= room.hx; x++) {
        for (let y = room.ly; y <= room.hy; y++)
            level.requireAt(x, y).roomno = ROOMOFFSET;
    }
    return room;
}

void test('an anthole is stocked with one sleeping ant species and food', async () => {
    const room = specialRoom(ANTHOLE);

    await fillSpecialRoom(room);

    assert.equal(requireGameLevel().monsters.length, 6);
    const species = new Set(requireGameLevel().monsters.map(monster => MONSTER_NAME[monster.mnum]));
    assert.equal(species.size, 1);
    assert.ok([...species].every(name => ['giant ant', 'soldier ant', 'fire ant'].includes(name ?? '')));
    assert.ok(requireGameLevel().monsters.every(monster => monster.msleeping));
    assert.ok(floorObjects(requireGameLevel()).some(object => object.oclass === 7));
});

void test('a leprechaun hall has sleeping leprechauns and floor gold', async () => {
    const room = specialRoom(LEPREHALL);

    await fillSpecialRoom(room);

    assert.equal(requireGameLevel().monsters.length, 6);
    assert.ok(requireGameLevel().monsters.every(monster => MONSTER_NAME[monster.mnum] === 'leprechaun' && monster.msleeping));
    assert.equal(floorObjects(requireGameLevel()).filter(object => object.otyp === GOLD_PIECE).length, 6);
});

void test('a cockatrice nest fills eligible squares with sleeping cockatrices', async () => {
    const room = specialRoom(COCKNEST);
    room.irregular = true;
    requireGameLevel().requireAt(10, 10).edge = true;

    await fillSpecialRoom(room);

    assert.equal(requireGameLevel().monsters.length, 5);
    assert.ok(requireGameLevel().monsters.every(monster => MONSTER_NAME[monster.mnum] === 'cockatrice' && monster.msleeping));
    assert.ok(requireGameLevel().monsters.every(monster => monster.mx !== 10 || monster.my !== 10));
});
