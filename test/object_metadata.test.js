import test from 'node:test';
import assert from 'node:assert/strict';

import { game } from '../js/gstate.js';
import { initializeObjectDescriptions } from '../js/o_init.js';
import { wishedObjectPresentation } from '../js/objnam.js';
import { initRng } from '../js/rng.js';
import {
    OBJECT_COLOR, OBJECT_NAMES, OBJECT_SMALL_DAMAGE, OBJECT_LARGE_DAMAGE,
    QUARTERSTAFF,
} from '../js/object_data.js';
import { objectColor, objectUsesGenericGlyph } from '../js/display.js';

test('generated object colors include the source quarterstaff HI_WOOD color', () => {
    assert.equal(OBJECT_COLOR.length, 481);
    assert.equal(OBJECT_NAMES[QUARTERSTAFF], 'quarterstaff');
    assert.equal(OBJECT_COLOR[QUARTERSTAFF], 3);
});

test('generated weapon damage preserves racial short-sword variants', () => {
    assert.equal(OBJECT_SMALL_DAMAGE[48], 5); // orcish short sword
    assert.equal(OBJECT_LARGE_DAMAGE[48], 8);
    assert.equal(OBJECT_SMALL_DAMAGE[54], 8); // long sword
    assert.equal(OBJECT_SMALL_DAMAGE[QUARTERSTAFF], 6);
});

test('unobserved appearance-sensitive objects use their generic class color', () => {
    game.objectColors = OBJECT_COLOR.slice();
    const potion = { otyp: 300, oclass: 8, dknown: false };

    assert.equal(objectUsesGenericGlyph(potion), true);
    assert.equal(objectColor(potion), OBJECT_COLOR[8]);
    potion.dknown = true;
    assert.equal(objectUsesGenericGlyph(potion), false);
    assert.equal(objectColor(potion), OBJECT_COLOR[300]);
});

test('object shuffling keeps each unidentified description and color together', () => {
    initRng(116);
    initializeObjectDescriptions();

    assert.equal(game.objectColors.length, OBJECT_COLOR.length);
    for (let otyp = 0; otyp < OBJECT_COLOR.length; otyp++) {
        assert.equal(
            game.objectColors[otyp],
            OBJECT_COLOR[game.objectDescriptionIndex[otyp]],
            `object ${otyp} detached its color from its description`,
        );
    }
});

test('wished unknown armor uses shuffled appearance and slot grammar', () => {
    game._knownObjectTypes = new Set();
    game.objectDescriptions = [];
    game.objectDescriptions[161] = 'padded gloves';
    game.objectDescriptions[149] = 'tattered cape';

    assert.equal(
        wishedObjectPresentation(161).name,
        'pair of padded gloves',
    );
    assert.equal(
        wishedObjectPresentation(149).name,
        'tattered cape',
    );
});
