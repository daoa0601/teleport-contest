import assert from 'node:assert/strict';
import test from 'node:test';
import { farlookLocationDescription } from '../js/cmd.js';
import { show_glyph_cell } from '../js/display.js';
import { CmapSymbol, GlyphOffset, cmapToGlyph } from '../js/glyph_numbers.js';
import { NO_COLOR } from '../js/terminal.js';
import { freshObjectRoom } from './support/object-room.js';

void test('look leaves a zap glyph without a terrain name for symbol disambiguation', async () => {
    freshObjectRoom();
    show_glyph_cell(11, 10, '|', NO_COLOR, false, 0, { kind: 'effect', glyph: GlyphOffset.zap });

    assert.equal(await farlookLocationDescription(11, 10), '');
});

void test('look names an indexed valid-position marker', async () => {
    freshObjectRoom();
    show_glyph_cell(11, 10, '$', NO_COLOR, false, 0,
        { kind: 'effect', glyph: cmapToGlyph(CmapSymbol.goodpos) });

    assert.equal(await farlookLocationDescription(11, 10), 'valid position');
});
