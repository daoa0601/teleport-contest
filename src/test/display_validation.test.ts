import assert from 'node:assert/strict';
import test from 'node:test';
import { validSavedGlyph } from '../js/display_validation.js';
import { terrain_glyph } from '../js/display.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, STATUE } from '../js/object_data.js';
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

for (const otyp of [CORPSE, STATUE]) {
    for (const corpsenm of [-1, MONSTER_NAME.length, 99999, 0.5, 'jackal']) {
        void test(`saved ${otyp === CORPSE ? 'corpse' : 'statue'} memory rejects invalid species ${corpsenm}`, () => {
            assert.equal(validSavedGlyph({ kind: 'object', ch: '%', color: 0, otyp, corpsenm }), false);
        });
    }
    void test(`saved ${otyp === CORPSE ? 'corpse' : 'statue'} memory accepts the first and last species`, () => {
        for (const corpsenm of [0, MONSTER_NAME.length - 1]) {
            assert.equal(validSavedGlyph({ kind: 'object', ch: '%', color: 0, otyp, corpsenm }), true);
        }
    });
}
