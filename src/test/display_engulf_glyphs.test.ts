import assert from 'node:assert/strict';
import test from 'node:test';
import { flush_screen, glyphAt, swallowed } from '../js/display.js';
import { GlyphOffset } from '../js/glyph_numbers.js';
import { game } from '../js/gstate.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { requireScreenCell } from './support/screen.js';

for (const symset of ['ASCII', 'DECgraphics']) {
    void test(`an engulfing border uses ${symset} symbols and the swallower's glyphs`, async () => {
        freshObjectRoom();
        game.symset = symset;
        const monster = await createMonsterAt('purple worm', 10, 10);
        game.u.uswallow = 1;
        game.u.ustuck = monster;

        swallowed(true);
        await flush_screen(1);

        assert.equal(requireScreenCell(9, 10).ch, symset === 'ASCII' ? '-' : '⎺');
        assert.equal(requireScreenCell(8, 11).ch, symset === 'ASCII' ? '|' : '│');
        assert.equal(glyphAt(10, 9)?.glyph, GlyphOffset.swallow + monster.mnum * 8 + 1);
    });
}
