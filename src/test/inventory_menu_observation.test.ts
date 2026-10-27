import assert from 'node:assert/strict';
import test from 'node:test';

import { farlookLocationDescription } from '../js/cmd.js';
import { newsym } from '../js/display.js';
import { game } from '../js/gstate.js';
import { placeHeroOnLevel } from '../js/hero_location.js';
import { selectInventoryObject } from '../js/invent.js';
import { DART, FOOD_RATION, GOLD_PIECE, HELMET, LEATHER_ARMOR } from '../js/object_data.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
// A purse excluded from a letter-filtered inventory menu still becomes
// known: invent.c:display_pickinv() sorts the whole inventory before
// dropping entries the caller's letters did not select, and
// loot_classify() observes every sorted object. The exact quantity then
// survives into a later farlook of the thrown purse.
void test('a letter-filtered inventory menu still observes the unlisted purse', async () => {
    freshObjectRoom();
    await placeHeroOnLevel(10, 8);
    const purse = await addInventoryObject(GOLD_PIECE, {
        quan: 22, dknown: false, observed: false,
    });
    purse.invlet = '$';
    const dart = await addInventoryObject(DART, { quan: 2, dknown: false, observed: false });
    dart.invlet = 'a';
    const food = await addInventoryObject(FOOD_RATION, { dknown: false, observed: false });
    food.invlet = 'b';
    pushKeys('\x1b');

    const selection = await selectInventoryObject({ letters: 'ab' });

    assert.equal(selection.key, 27);
    assert.equal(purse.dknown, true, 'the sort observes gold outside the letter filter');

    game.inventory = game.inventory.filter(object => object !== purse);
    purse.where = 'free';
    await placeCreatedObject(purse, 14, 8);
    newsym(14, 8);

    assert.equal(await farlookLocationDescription(14, 8), '22 gold pieces');
});

void test('an unobserved floor purse keeps a vague quantity in farlook', async () => {
    freshObjectRoom();
    await placeHeroOnLevel(10, 8);
    const spilled = await floorObject(GOLD_PIECE, 14, 8, {
        quan: 22, dknown: false,
    });
    newsym(14, 8);

    assert.equal(await farlookLocationDescription(14, 8), 'some gold pieces');
    assert.equal(spilled.dknown, false);
});

// invent.c:display_pickinv() reassigns position-sequential letters whenever
// fixinv is off (reassign(), invent.c:3146) before filtering its menu by the
// requested letters (invent.c:3271), so a filter built from older letters
// selects whatever the fresh assignments put in those slots.
void test('a letter filter applies to the freshly reassigned letters', async () => {
    freshObjectRoom();
    await placeHeroOnLevel(10, 8);
    game.flags.fixinv = false;
    const dart = await addInventoryObject(DART, { dknown: false, observed: false });
    dart.invlet = 'a';
    const armor = await addInventoryObject(LEATHER_ARMOR, { dknown: false, observed: false });
    armor.invlet = 'c';
    const helmet = await addInventoryObject(HELMET, { dknown: false, observed: false });
    helmet.invlet = 'd';
    const food = await addInventoryObject(FOOD_RATION, { dknown: false, observed: false });
    food.invlet = 'e';
    // A takeoff-style filter built from the worn items' dressed letters.
    const input = resetInputState();
    const selection = selectInventoryObject({ letters: 'cd' });
    await input.waitUntilBlocked();

    const menuText = (game.nhDisplay?.grid ?? [])
        .map(row => row.map(cell => cell.ch).join('')).join('\n');
    input.feed('\x1b');
    assert.equal((await selection).key, 27);

    assert.match(menuText, /helmet/, 'the helmet keeps letter c after reassignment');
    assert.match(menuText, /food ration/, 'the food ration takes letter d after reassignment');
    assert.doesNotMatch(menuText, /leather armor/,
        'the armor moved to letter b and is filtered out');
    assert.equal(armor.invlet, 'b', 'reassign() re-letters the chain positionally');
});
