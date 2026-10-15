import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_FLOOR, DB_ICE, DRAWBRIDGE_DOWN, DRAWBRIDGE_UP, HWALL } from '../js/const.js';
import { BOULDER } from '../js/object_data.js';
import { heroIsSurroundedByRock } from '../js/prayer_trouble.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const under of [DB_FLOOR, DB_ICE] as const) {
    void test(`two boulders cannot be pushed into underlay ${under} to escape surrounding rock`, async () => {
        const level = freshObjectRoom();
        for (let x = 9; x <= 11; x++) for (let y = 9; y <= 11; y++) {
            if (x !== 10 || y !== 10) level.requireAt(x, y).typ = HWALL;
        }
        level.requireAt(11, 10).typ = DRAWBRIDGE_DOWN;
        const square = level.requireAt(12, 10);
        square.typ = DRAWBRIDGE_UP;
        square.drawbridgemask = under;
        await floorObject(BOULDER, 11, 10, { quantity: 2 });

        assert.equal(heroIsSurroundedByRock(), true);
    });
}

