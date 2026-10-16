import assert from 'node:assert/strict';
import test from 'node:test';
import { FOUNTAIN } from '../js/const.js';
import { glyphAt, map_background } from '../js/display.js';
import { CmapSymbol, cmapToGlyph } from '../js/glyph_numbers.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a memory-only map update does not change the glyph queried from the display buffer', () => {
    const level = freshObjectRoom();
    level.requireAt(30, 10).typ = FOUNTAIN;
    map_background(30, 10, false);
    assert.equal(level.requireAt(30, 10).remembered_glyph?.kind, 'terrain');
    assert.equal(glyphAt(30, 10)?.kind, 'unexplored');
    map_background(30, 10, true);
    assert.equal(glyphAt(30, 10)?.glyph, cmapToGlyph(CmapSymbol.fountain));
});
void test('an out-of-range display query returns the native room fallback', () => {
    freshObjectRoom();
    assert.equal(glyphAt(-1, 10)?.glyph, cmapToGlyph(CmapSymbol.room));
    assert.equal(glyphAt(80, 21)?.glyph, cmapToGlyph(CmapSymbol.room));
});
//# sourceMappingURL=display_buffer_query.test.js.map