import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_LAVA, DRAWBRIDGE_UP } from '../js/const.js';
import { fireDamageObject } from '../js/fire_damage.js';
import { CHEST, CLUB } from '../js/object_data.js';
import { addObjectToContainer } from '../js/object_container.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('contents spilled from a burning chest fall into lava below a raised bridge', async () => {
    const level = freshObjectRoom();
    const chest = await floorObject(CHEST, 12, 10);
    const club = await knownObject(CLUB, { where: 'free' });
    await addObjectToContainer(chest, club);
    const square = level.requireAt(12, 10);
    square.typ = DRAWBRIDGE_UP;
    square.drawbridgemask = DB_LAVA;

    await fireDamageObject(chest, { force: true, x: 12, y: 10, publish: () => {} });

    assert.equal(club.where, 'gone');
    assert.equal(chest.where, 'gone');
});

