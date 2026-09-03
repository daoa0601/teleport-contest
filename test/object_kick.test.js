import test from 'node:test';
import assert from 'node:assert/strict';

import { STONE } from '../js/const.js';
import { place_object } from '../js/floor_object.js';
import { game } from '../js/gstate.js';
import { CLUB } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { kickDirection } from './support/commands.js';
import { knownObject } from './support/game-objects.js';
import { floorObjects } from './support/level-state.js';
import { createMonsterAt } from './support/monsters.js';
import { freshGameplayRoom } from './support/playable-room.js';

test('kicking a loose object moves its existing identity', async () => {
    const level = freshGameplayRoom({ role: 'tourist' });
    const club = place_object(knownObject(CLUB, { spe: 0 }), 11, 10);

    await kickDirection('l');

    assert.equal(floorObjects(level).filter(object => object === club).length, 1);
    assert.deepEqual([club.ox, club.oy], [15, 10]);
});

test('an object cannot be kicked through a wall', async () => {
    const level = freshGameplayRoom({ role: 'tourist' });
    const club = place_object(knownObject(CLUB, { spe: 0 }), 11, 10);
    level.at(12, 10).typ = STONE;

    await kickDirection('l', [' ']);

    assert.deepEqual([club.ox, club.oy], [11, 10]);
    assert.equal(floorObjects(level).includes(club), true);
});

test('a kicked object can fall down a ladder during flight', async () => {
    const level = freshGameplayRoom({ role: 'tourist' });
    const club = place_object(knownObject(CLUB, { spe: 0 }), 11, 10);
    game.u.uz = { dnum: 0, dlevel: 1 };
    game.dungeons = [{ num_dunlevs: 2, flags: {} }];
    game.stairs = {
        sx: 13,
        sy: 10,
        up: false,
        isladder: true,
        tolev: { dnum: 0, dlevel: 2 },
        next: null,
    };

    await kickDirection('l', [' ']);

    assert.equal(floorObjects(level).includes(club), false);
    assert.equal(club.where, 'migrating');
});

test('a kicked club can hit a monster before it lands', async () => {
    const level = freshGameplayRoom({ role: 'tourist' });
    const club = place_object(knownObject(CLUB, { spe: 0 }), 11, 10);
    const jackal = await createMonsterAt('jackal', 13, 10);
    Object.assign(jackal, {
        mhp: 20,
        mhpmax: 20,
        mac: 10,
        mcanmove: 0,
        movement: 12,
    });
    initRng(1n);

    await kickDirection('l', ' '.repeat(4));

    assert.ok(jackal.mhp < 20);
    assert.deepEqual([club.ox, club.oy], [13, 10]);
    assert.equal(floorObjects(level).includes(club), true);
});
