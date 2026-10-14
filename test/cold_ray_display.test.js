import assert from 'node:assert/strict';
import test from 'node:test';
import { LAVAPOOL, ROOM } from '../js/const.js';
import { flush_screen } from '../js/display.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { castNativeRay } from '../js/ray_attack.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
void test('cooling lava preserves a cold beam across the hero during hit acknowledgment', async () => {
    const level = freshObjectRoom({ hero: { uhp: 100, uhpmax: 100 } });
    level.requireAt(9, 9).typ = LAVAPOOL;
    level.requireAt(11, 11).typ = LAVAPOOL;
    await flush_screen(1);
    const input = resetInputState();
    let sawBeam = false;
    input.beforeRead = () => {
        assert.equal(requireScreenCell(9, 11).ch, '\\');
        sawBeam = true;
        input.feed(' ');
    };
    await castNativeRay(-22, 4, 'n', {
        originX: 8, originY: 8,
        random: () => 6, rollDice: () => 4, rollOne: () => 1,
    });
    await flush_screen(1);
    assert.equal(sawBeam, true, 'The lava message is acknowledged before the hit message.');
    assert.equal(level.requireAt(9, 9).typ, ROOM);
    assert.equal(game.u.uhp, 96);
    assert.equal(requireScreenCell(9, 11).ch, '@');
});
//# sourceMappingURL=cold_ray_display.test.js.map