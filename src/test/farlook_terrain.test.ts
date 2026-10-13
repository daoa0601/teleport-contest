import test from 'node:test';
import assert from 'node:assert/strict';
import { farlookLocationDescription } from '../js/cmd.js';
import { LAVAPOOL, ROOM } from '../js/const.js';
import { newsym } from '../js/display.js';
import { makeBlinded } from '../js/sight_change.js';
import { vision_recalc } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';

for (const remembered of [false, true]) {
    void test(`farlook describes ${remembered ? 'remembered' : 'visible'} lava`, async () => {
        const level = freshObjectRoom();
        const location = level.requireAt(11, 10);
        location.typ = LAVAPOOL;
        newsym(11, 10);
        if (remembered) {
            await makeBlinded(10, { talk: false });
            vision_recalc(0);
            location.typ = ROOM;
        }

        const description = farlookLocationDescription(11, 10);

        assert.equal(description, 'molten lava');
    });
}
