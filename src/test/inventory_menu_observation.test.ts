import assert from 'node:assert/strict';
import test from 'node:test';

import { farlookLocationDescription } from '../js/cmd.js';
import { newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { placeHeroOnLevel } from '../js/hero_location.js';
import { selectInventoryObject } from '../js/invent.js';
import { DART, FOOD_RATION, GOLD_PIECE } from '../js/object_data.js';
import { pushKeys } from '../js/input.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

// dropping entries the caller's letters did not select; loot_classify()
// observes every sorted object, so an unlisted purse still becomes known and
// a later farlook names its exact quantity.
void test('a letter-filtered inventory menu still observes the unlisted purse', async () => {
    freshObjectRoom();
    await placeHeroOnLevel(10, 8);
    const purse = await addInventoryObject(GOLD_PIECE, {
        quan: 22, dknown: false, observed: false,
    });
    purse.invlet = '$';
    const food = await addInventoryObject(FOOD_RATION, { dknown: false, observed: false });
    food.invlet = 'b';
    const dart = await addInventoryObject(DART, { quan: 2, dknown: false, observed: false });
    dart.invlet = 'a';
    pushKeys('\x1b');

    const selection = await selectInventoryObject({ letters: 'ab' });

    assert.equal(selection.key, 27);
    assert.equal(purse.dknown, true, 'the sort observes gold outside the letter filter');
});

void test('an observed purse keeps its exact quantity after being thrown aside', async () => {
    freshObjectRoom();
    await placeHeroOnLevel(10, 8);
    const spilled = await floorObject(GOLD_PIECE, 14, 8, {
        quan: 22, dknown: true,
    });
    newsym(14, 8);

    assert.equal(await farlookLocationDescription(14, 8), '22 gold pieces');
    assert.equal(spilled.dknown, true);
});
