import assert from 'node:assert/strict';
import test from 'node:test';
import { shieldeff } from '../js/display.js';
import { game } from '../js/gstate.js';
import { freshObjectRoom } from './support/object-room.js';
void test('turning sparkle off suppresses the shield animation', async () => {
    freshObjectRoom({ flags: { sparkle: false } });
    let frames = 0;
    game.animationFrame = async () => { frames++; };
    await shieldeff(11, 10);
    assert.equal(frames, 0);
});
//# sourceMappingURL=display_shield.test.js.map