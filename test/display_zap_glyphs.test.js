import assert from 'node:assert/strict';
import test from 'node:test';
import { glyphAt } from '../js/display.js';
import { GlyphOffset } from '../js/glyph_numbers.js';
import { game } from '../js/gstate.js';
import { castNativeRay } from '../js/ray_attack.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
void test('an ASCII cold ray keeps its direction and beam type in the displayed glyph', async () => {
    freshObjectRoom();
    game.symset = 'ASCII';
    let frames = 0;
    game.animationFrame = async () => {
        frames++;
        assert.equal(requireScreenCell(10, 11).ch, '-');
        assert.equal(glyphAt(11, 10)?.glyph, GlyphOffset.zap + 2 * 4 + 1);
    };
    await castNativeRay(2, 0, 'l');
    assert.ok(frames > 0);
});
//# sourceMappingURL=display_zap_glyphs.test.js.map