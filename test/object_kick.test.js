import test from 'node:test';
import assert from 'node:assert/strict';

import { STONE } from '../js/const.js';
import { game } from '../js/gstate.js';
import { CLUB } from '../js/object_data.js';
import { kickDirection } from './support/commands.js';
import { floorObject } from './support/game-objects.js';
import { floorObjects } from './support/level-state.js';
import { freshGameplayRoom } from './support/playable-room.js';

test('kicking a loose object moves its existing identity', async () => {
    const level = freshGameplayRoom({ role: 'tourist' });
    const club = floorObject(CLUB, 11, 10, { name: 'club' });

    await kickDirection('l');

    assert.equal(floorObjects(level).filter(object => object === club).length, 1);
    assert.deepEqual([club.ox, club.oy], [15, 10]);
});

test('an object cannot be kicked through a wall', async () => {
    const level = freshGameplayRoom({ role: 'tourist' });
    const club = floorObject(CLUB, 11, 10, { name: 'club' });
    level.at(12, 10).typ = STONE;

    await kickDirection('l', [' ']);

    assert.deepEqual([club.ox, club.oy], [11, 10]);
    assert.equal(floorObjects(level).includes(club), true);
});

test('a kicked object can fall down a ladder during flight', async () => {
    const level = freshGameplayRoom({ role: 'tourist' });
    const club = floorObject(CLUB, 11, 10, { name: 'club' });
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
