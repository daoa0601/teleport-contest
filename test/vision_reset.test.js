import assert from 'node:assert/strict';
import test from 'node:test';
import { cansee, couldsee, init_vision_globals, vision_recalc, } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
void test('initializing vision starts without sight from the previous game', () => {
    freshObjectRoom();
    vision_recalc(0);
    assert.equal(cansee(12, 10), true);
    init_vision_globals();
    assert.equal(cansee(12, 10), false);
    assert.equal(couldsee(12, 10), false);
});
//# sourceMappingURL=vision_reset.test.js.map