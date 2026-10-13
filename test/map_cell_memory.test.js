import assert from 'node:assert/strict';
import test from 'node:test';
import { game, requirePlayingGame } from '../js/gstate.js';
import { cansee, vision_recalc } from '../js/vision.js';
import { freshObjectRoom } from './support/object-room.js';
void test('leaving an unlit Rogue room floor makes that floor disappear into darkness', () => {
    const level = freshObjectRoom({ recalculateVision: false });
    requirePlayingGame(game);
    game.rogue_level = { ...game.u.uz };
    level.requireAt(11, 10).lit = false;
    level.requireAt(11, 10).waslit = false;
    vision_recalc(0);
    assert.equal(cansee(11, 10), true);
    assert.equal(level.requireAt(11, 10).disp_ch, '.');
    game.u.ux = 9;
    vision_recalc(0);
    assert.equal(cansee(11, 10), false);
    assert.equal(level.requireAt(11, 10).disp_ch, ' ');
});
//# sourceMappingURL=map_cell_memory.test.js.map