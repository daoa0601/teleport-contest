import assert from 'node:assert/strict';
import test from 'node:test';
import { EXPL_FIERY, MAGIC_TRAP } from '../js/const.js';
import { digHole } from '../js/digging_terrain.js';
import { glyphAt } from '../js/display.js';
import { explode } from '../js/explosion.js';
import { GlyphOffset } from '../js/glyph_numbers.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { CLR_MAGENTA } from '../js/terminal.js';
import { addTrap } from './support/level-state.js';
import { installPagerInput } from './support/pager-input.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';
void test('an ASCII explosion keeps its border position and fiery glyph type', async () => {
    freshObjectRoom();
    game.symset = 'ASCII';
    let frames = 0;
    game.animationFrame = async () => {
        frames++;
        assert.equal(requireScreenCell(13, 10).ch, '-');
        assert.equal(glyphAt(14, 9)?.glyph, GlyphOffset.explodeFiery + 1);
    };
    await explode(14, 10, 11, 0, 9, EXPL_FIERY);
    assert.ok(frames > 0);
});
void test('digging into a magic trap uses the same magical explosion glyphs', async () => {
    const level = freshObjectRoom({ hero: { uhp: 1000, uhpmax: 1000 } });
    game.symset = 'ASCII';
    addTrap(level, MAGIC_TRAP, 10, 10);
    installPagerInput(resetInputState(), { expected: /trap|blast|Boom|caught/, limit: 8 });
    let frames = 0;
    game.animationFrame = async () => {
        frames++;
        const top = requireScreenCell(9, 10);
        assert.equal(top.ch, '-');
        assert.equal(top.color, CLR_MAGENTA);
        assert.equal(glyphAt(10, 9)?.glyph, GlyphOffset.explodeMagical + 1);
    };
    await digHole({});
    assert.ok(frames > 0);
});
//# sourceMappingURL=display_explosion_glyphs.test.js.map