import assert from 'node:assert/strict';
import test from 'node:test';
import { GP_ALLOW_XY, GP_CHECKSCARY } from '../js/const.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { findMonsterNearPosition } from '../js/mklev.js';
import { SCR_SCARE_MONSTER } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('nearby placement may use its center only after every surrounding square fails', () => {
    freshObjectRoom({ left: 14, right: 14, top: 10, bottom: 10 });
    const orc = MONSTER_NAME.indexOf('hill orc');

    const destination = findMonsterNearPosition(orc, 14, 10, { gpflags: GP_ALLOW_XY });

    assert.deepEqual(destination, { x: 14, y: 10 });
    assert.equal(findMonsterNearPosition(orc, 14, 10), null);
});

void test('allowing the center still prefers an available surrounding square', () => {
    freshObjectRoom({ left: 14, right: 15, top: 10, bottom: 10 });
    const orc = MONSTER_NAME.indexOf('hill orc');

    const destination = findMonsterNearPosition(orc, 14, 10, { gpflags: GP_ALLOW_XY });

    assert.deepEqual(destination, { x: 15, y: 10 });
});

void test('an explicit scary-square restriction remains in force after both nearby searches fail', async () => {
    freshObjectRoom({ left: 14, right: 15, top: 10, bottom: 10 });
    await floorObject(SCR_SCARE_MONSTER, 15, 10);
    const orc = MONSTER_NAME.indexOf('hill orc');

    const destination = findMonsterNearPosition(orc, 14, 10, { gpflags: GP_CHECKSCARY });

    assert.equal(destination, null);
});
