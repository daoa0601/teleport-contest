import test from 'node:test';
import assert from 'node:assert/strict';
import { DB_FLOOR, DB_ICE, DRAWBRIDGE_UP } from '../js/const.js';
import { occupied } from '../js/mkroom.js';
import { freshObjectRoom } from './support/object-room.js';
for (const under of [DB_FLOOR, DB_ICE]) {
    void test(`level features may occupy underlay ${under} below a raised bridge`, () => {
        const level = freshObjectRoom();
        const square = level.requireAt(12, 10);
        square.typ = DRAWBRIDGE_UP;
        square.drawbridgemask = under;
        assert.equal(occupied(12, 10), false);
    });
}
//# sourceMappingURL=terrain_underlay_rules.test.js.map