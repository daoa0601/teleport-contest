import assert from 'node:assert/strict';
import test from 'node:test';
import { STONE } from '../js/const.js';
import { plineWithContinuation } from '../js/display.js';
import { cansee, couldsee, init_vision_globals, vision_recalc, vision_reset_new_level, } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
void test('initializing vision starts without sight from the previous game', () => {
    freshObjectRoom();
    vision_recalc(0);
    assert.equal(cansee(12, 10), true);
    init_vision_globals();
    assert.equal(cansee(12, 10), false);
    assert.equal(couldsee(12, 10), false);
});
void test('resetting a level refreshes sight before the next message', async () => {
    const level = freshObjectRoom({ top: 10, bottom: 10 });
    assert.equal(cansee(12, 10), true);
    level.requireAt(11, 10).typ = STONE;
    vision_reset_new_level();
    assert.equal(cansee(12, 10), false);
    assert.equal(couldsee(12, 10), false);
    await plineWithContinuation('The dungeon shifts around you.');
    assert.equal(cansee(11, 10), true, 'message output refreshes the new wall');
    assert.equal(couldsee(12, 10), false, 'the new wall closes the old view');
});
//# sourceMappingURL=vision_reset.test.js.map