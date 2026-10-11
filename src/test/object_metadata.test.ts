import test from 'node:test';
import assert from 'node:assert/strict';

import { game, requirePlayingGame } from '../js/gstate.js';
import { initializeObjectDescriptions } from '../js/o_init.js';
import { wishedObjectPresentation } from '../js/objnam.js';
import { mksobj } from '../js/mklev.js';
import { freshObjectRoom } from './support/object-room.js';
import { initRng } from '../js/rng.js';
import { OBJECT_COLOR } from '../js/object_data.js';
import { objectColor, objectUsesGenericGlyph } from '../js/display.js';

void test('unobserved appearance-sensitive objects use their generic class color', () => {
    game.objectColors = OBJECT_COLOR.slice();
    const potion = { otyp: 300, oclass: 8, dknown: false };

    assert.equal(objectUsesGenericGlyph(potion), true);
    assert.equal(objectColor(potion), OBJECT_COLOR[8]);
    potion.dknown = true;
    assert.equal(objectUsesGenericGlyph(potion), false);
    assert.equal(objectColor(potion), OBJECT_COLOR[300]);
});

void test('object shuffling keeps each unidentified description and color together', () => {
    initRng(116);
    initializeObjectDescriptions();

    assert.ok(game.objectColors);
    assert.ok(game.objectDescriptionIndex);
    for (let otyp = 0; otyp < OBJECT_COLOR.length; otyp++) {
        const description: number | undefined = game.objectDescriptionIndex[otyp];
        assert.ok(description !== undefined);
        assert.equal(
            game.objectColors[otyp],
            OBJECT_COLOR[description],
            `object ${otyp} detached its color from its description`,
        );
    }
});

void test('wished unknown armor uses shuffled appearance and slot grammar', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    game._knownObjectTypes = new Set();
    game.objectDescriptions = [];
    game.objectDescriptions[161] = 'padded gloves';
    game.objectDescriptions[149] = 'tattered cape';

    assert.equal(
        wishedObjectPresentation(await mksobj(161, false, false)).name,
        'pair of padded gloves',
    );
    assert.equal(
        wishedObjectPresentation(await mksobj(149, false, false)).name,
        'tattered cape',
    );
});
