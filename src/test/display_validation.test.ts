import assert from 'node:assert/strict';
import test from 'node:test';
import { validSavedGlyph } from '../js/display_validation.js';
import { terrain_glyph } from '../js/display.js';
import { freshObjectRoom } from './support/object-room.js';

void test('saved memory accepts a native terrain glyph', () => {
    const level = freshObjectRoom();
    assert.equal(validSavedGlyph(terrain_glyph(level.requireAt(11, 10), 11, 10)), true);
});

for (const glyph of [-1, 0.5, Number.MAX_SAFE_INTEGER, 'floor']) {
    void test(`saved memory rejects invalid glyph number ${glyph}`, () => {
        const level = freshObjectRoom();
        const terrain = terrain_glyph(level.requireAt(11, 10), 11, 10);
        assert.equal(validSavedGlyph({ ...terrain, glyph }), false);
    });
}
