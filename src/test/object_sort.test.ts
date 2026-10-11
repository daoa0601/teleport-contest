import test from 'node:test';
import assert from 'node:assert/strict';
import { rhack } from '../js/cmd.js';
import { SORTLOOT_INUSE, SORTLOOT_LOOT, SORTLOOT_PETRIFY, W_WEP, W_AMUL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState, pushKeys } from '../js/input.js';
import { mksobj, set_corpsenm } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToContainer } from '../js/object_container.js';
import {
    AMULET_OF_LIFE_SAVING, ARROW, BAG_OF_TRICKS, BOW, CORPSE, DAGGER, DART,
    DIAMOND, FOOD_RATION, GLOB_OF_GRAY_OOZE, ICE_BOX,
    LEATHER_ARMOR, LONG_SWORD, OBJECT_NAMES, POT_BLINDNESS, POT_CONFUSION,
    POT_EXTRA_HEALING, POT_HEALING, POT_WATER, RIN_PROTECTION,
    SACK, TOOLED_HORN, TOWEL, WAN_FIRE, WAX_CANDLE,
} from '../js/object_data.js';
import { lootObjectName } from '../js/objnam.js';
import { learnObjectType, recordObjectCall } from '../js/object_knowledge.js';
import { dodiscovered } from '../js/o_init.js';
import {
    changeInventoryOrder, inventoryOrderSymbols, inventorySortMode, lootSortMode, sortObjects,
} from '../js/object_sort.js';
import { applyNethackrc } from '../js/options.js';
import { pickupAtHero } from '../js/pickup.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { restoreGame, saveGame } from '../js/save.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { memoryStorage } from './support/memory-storage.js';

test.beforeEach(() => freshObjectRoom({ gameplaySeed: 212n }));

function screenText() {
    assert.ok(game.nhDisplay);
    return game.nhDisplay.grid.map(row => row.map(cell => cell.ch).join('')).join('\n');
}

void test('pickup observes a corpse and names its species rather than its cached presentation', async () => {
    const body = await floorObject(CORPSE, game.u.ux, game.u.uy, {
        name: 'corpse', dknown: false, bknown: false,
        corpsenm: MONSTER_NAME.indexOf('goblin'), invlet: 'k',
    });

    await pickupAtHero();

    assert.equal(body.dknown, true);
    assert.equal(game.inventory.includes(body), true);
    assert.match(game._pending_message, /k - a goblin corpse\./);
});

void test('corpse sorting ignores stack quantities and preserves the original container chain', async () => {
    const jackals = await knownObject(CORPSE, { quantity: 2, corpsenm: MONSTER_NAME.indexOf('jackal') });
    const kobold = await knownObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('kobold') });
    const lichen = await knownObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('lichen') });
    const objects = [lichen, kobold, jackals];

    assert.deepEqual(sortObjects(objects, { mode: lootSortMode() }), [jackals, kobold, lichen]);
    assert.equal(objects[0], lichen);
    assert.equal(jackals.quan, 2);
});

void test('floor contents use singular corpse sorting before rendering counts', async () => {
    const input = resetInputState();
    const box = await mksobj(ICE_BOX, false, false);
    placeCreatedObject(box, game.u.ux, game.u.uy);
    for (const [species, quantity] of [['jackal', 2], ['kobold', 1], ['lichen', 1]] as const) {
        const body = await mksobj(CORPSE, false, false);
        set_corpsenm(body, MONSTER_NAME.indexOf(species));
        body.quan = quantity;
        await addObjectToContainer(box, body);
    }
    pushKeys('loot\n:');
    const action = rhack('#'.charCodeAt(0));
    await input.waitUntilBlocked();
    const text = screenText();
    assert.ok(text.indexOf('2 jackal corpses') < text.indexOf('a kobold corpse'));
    assert.ok(text.indexOf('a kobold corpse') < text.indexOf('a lichen corpse'));
    pushKeys(' q');
    await action;
});

void test('normal inventory sorts within a class by lowercase then uppercase inventory letters', async () => {
    const upper = await knownObject(DAGGER, { invlet: 'A' });
    const lower = await knownObject(DAGGER, { invlet: 'z' });
    const first = await knownObject(LONG_SWORD, { invlet: 'a' });

    assert.deepEqual(sortObjects([upper, lower, first], { mode: inventorySortMode() }), [first, lower, upper]);
});

void test('full loot sorting also sorts carried inventory by object name', async () => {
    applyNethackrc('OPTIONS=sortloot:full');
    const sword = await knownObject(LONG_SWORD, { invlet: 'a' });
    const dagger = await knownObject(DAGGER, { invlet: 'b' });

    assert.deepEqual(sortObjects([sword, dagger], { mode: inventorySortMode() }), [dagger, sword]);
});

void test('configured pack order is visible in the actual inventory window, including gold position', async () => {
    const input = resetInputState();
    applyNethackrc('OPTIONS=packorder:%)$');
    await addInventoryObject(DAGGER, { invlet: 'a' });
    await addInventoryObject(FOOD_RATION, { invlet: 'b' });
    setHeroGoldAmount(game, 1);
    const action = rhack('i'.charCodeAt(0));
    await input.waitUntilBlocked();
    const text = screenText();
    assert.ok(text.indexOf('Comestibles') < text.indexOf('Weapons'));
    assert.ok(text.indexOf('Weapons') < text.indexOf('Coins'));
    assert.match(text, /1 gold piece\b/);
    pushKeys(' ');
    await action;
});

void test('pack order fills omitted classes from the previous order and forces omitted gold first', () => {
    assert.equal(changeInventoryOrder('%)'), true);
    assert.match(inventoryOrderSymbols(), /^\$%\)/);
    assert.equal(changeInventoryOrder('=)'), true);
    assert.match(inventoryOrderSymbols(), /^\$=\)%/);
    assert.equal(changeInventoryOrder(')$%'), true);
    assert.match(inventoryOrderSymbols(), /^\)\$%/);
});

void test('bad pack-order entries do not discard the valid requested order', () => {
    assert.equal(changeInventoryOrder(')%)~'), false);
    assert.match(inventoryOrderSymbols(), /^\$%\)/);
});

void test('the discoveries window uses the configured inventory class order', async () => {
    applyNethackrc('OPTIONS=packorder:/!');
    learnObjectType(POT_HEALING);
    learnObjectType(WAN_FIRE);
    const input = resetInputState();
    const showing = dodiscovered();
    await input.waitUntilBlocked();
    const text = screenText();
    assert.match(text, /Wands/);
    assert.match(text, /Potions/);
    assert.ok(text.indexOf('Wands') < text.indexOf('Potions'));
    pushKeys(' ');
    await showing;
});

void test('saving and restoring retains configured class and loot order in actual carried objects', async () => {
    game.plname = 'Loot sorter';
    applyNethackrc('OPTIONS=packorder:/!$,sortloot:full');
    await addInventoryObject(DAGGER, { invlet: 'a' });
    await addInventoryObject(POT_HEALING, { invlet: 'b' });
    await addInventoryObject(WAN_FIRE, { invlet: 'c' });
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    applyNethackrc('OPTIONS=packorder:)%$,sortloot:none');

    assert.equal(restoreGame('Loot sorter', storage), true);

    assert.match(inventoryOrderSymbols(), /^\/!\$/);
    assert.deepEqual(sortObjects(game.inventory, { mode: inventorySortMode() })
        .map(object => object.otyp), [WAN_FIRE, POT_HEALING, DAGGER]);
});

void test('sortloot none retains floor-chain order within the same class and subclass', async () => {
    applyNethackrc('OPTIONS=sortloot:none');
    const lichen = await knownObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('lichen') });
    const jackal = await knownObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('jackal') });

    assert.deepEqual(sortObjects([lichen, jackal], { mode: lootSortMode() }), [lichen, jackal]);
});

void test('disabling sortpack uses native loot class priority and removes inventory headings', async () => {
    applyNethackrc('OPTIONS=!sortpack');
    const ring = await knownObject(RIN_PROTECTION);
    const weapon = await knownObject(DAGGER);
    assert.deepEqual(sortObjects([weapon, ring], { mode: lootSortMode() }), [ring, weapon]);

    const input = resetInputState();
    await addInventoryObject(DAGGER, { invlet: 'a' });
    await addInventoryObject(FOOD_RATION, { invlet: 'b' });
    const action = rhack('i'.charCodeAt(0));
    await input.waitUntilBlocked();
    assert.doesNotMatch(screenText(), /Weapons|Comestibles/);
    pushKeys(' ');
    await action;
});

void test('weapon loot groups ammunition, launchers, missiles, small weapons, and swords', async () => {
    const objects = [];
    for (const type of [LONG_SWORD, DAGGER, DART, BOW, ARROW]) objects.push(await knownObject(type));
    const ordered = sortObjects(objects, { mode: lootSortMode() });
    assert.deepEqual(ordered.map(object => object.otyp), [ARROW, BOW, DART, DAGGER, LONG_SWORD]);
});

void test('containers and discovered pseudo-containers sort before instruments and other tools', async () => {
    const candle = await knownObject(WAX_CANDLE);
    const horn = await knownObject(TOOLED_HORN);
    const tricks = await knownObject(BAG_OF_TRICKS);
    const sack = await knownObject(SACK);

    assert.deepEqual(sortObjects([candle, horn, tricks, sack], { mode: lootSortMode() }), [sack, tricks, horn, candle]);
});

void test('armor loot groups headgear, gloves, boots, shields, cloaks, shirts, and suits', async () => {
    const names = ['helmet', 'leather gloves', 'low boots', 'small shield',
        'cloak of displacement', 'Hawaiian shirt', 'leather armor'];
    const expected = [];
    for (const name of names) expected.push(await knownObject(OBJECT_NAMES.indexOf(name)));

    assert.deepEqual(sortObjects([...expected].reverse(), { mode: lootSortMode() }), expected);
});

void test('unseen, unidentified, called, and discovered objects have separate loot groups', async () => {
    setHeroBlindnessTurns(20);
    const unseen = await knownObject(POT_BLINDNESS, { dknown: false, typeKnown: false });
    const unknown = await knownObject(POT_CONFUSION, { typeKnown: false });
    const called = await knownObject(POT_EXTRA_HEALING, { typeKnown: false });
    const known = await knownObject(POT_HEALING);
    recordObjectCall(called.otyp, 'medicine');

    assert.deepEqual(sortObjects([known, called, unknown, unseen], { mode: lootSortMode() }),
        [unseen, unknown, called, known]);
});

void test('unknown gems do not reveal value through their ordering', async () => {
    setHeroBlindnessTurns(20);
    const diamond = await knownObject(DIAMOND, { dknown: false, typeKnown: false });
    const glassType = OBJECT_NAMES.indexOf('worthless piece of white glass');
    const glass = await knownObject(glassType, { dknown: false, typeKnown: false });

    assert.deepEqual(sortObjects([glass, diamond], { mode: lootSortMode() }), [glass, diamond]);
    assert.equal(diamond.dknown, false);
    assert.equal(glass.dknown, false);
});

void test('sorting observes visible objects but keeps blindness and hallucination knowledge gates', async () => {
    const potion = await knownObject(POT_HEALING, { dknown: false });
    const wand = await knownObject(WAN_FIRE, { dknown: false });
    sortObjects([potion, wand], { mode: lootSortMode() });
    assert.equal(potion.dknown, true);
    assert.equal(wand.dknown, true);
    potion.dknown = wand.dknown = false;
    setHeroBlindnessTurns(20);
    sortObjects([potion, wand], { mode: lootSortMode() });
    assert.equal(potion.dknown, false);
    assert.equal(wand.dknown, false);
    setHeroBlindnessTurns(0);
    game.u.hallucinationTurns = 20;
    sortObjects([potion, wand], { mode: lootSortMode() });
    assert.equal(potion.dknown, false);
    assert.equal(wand.dknown, false);
});

void test('loot names omit individual user labels, quantity, water beatitude, and wet towel prefixes', async () => {
    const water = await knownObject(POT_WATER, { blessed: true, quantity: 3,
        oextra: { oname: 'Emergency' }, odiluted: true });
    const towel = await knownObject(TOWEL, { spe: 5 });
    assert.equal(lootObjectName(water), 'potion of water');
    assert.equal(lootObjectName(towel), 'towelx');
    assert.equal(water.blessed, true);
    assert.equal(water.odiluted, true);
    assert.equal(water.oextra?.oname, 'Emergency');
    assert.equal(towel.spe, 5);
});

void test('wet, moist, and dry towels sort in that order without changing their moisture', async () => {
    const dry = await knownObject(TOWEL, { spe: 0 });
    const moist = await knownObject(TOWEL, { spe: 2 });
    const wet = await knownObject(TOWEL, { spe: 4 });
    assert.deepEqual(sortObjects([dry, moist, wet], { mode: lootSortMode() }), [wet, moist, dry]);
    assert.equal(wet.spe, 4);
});

void test('equal object names prefer known blessed, uncursed, cursed, then unknown beatitude', async () => {
    const unknown = await knownObject(DAGGER, { bknown: false });
    const cursed = await knownObject(DAGGER, { cursed: true });
    const ordinary = await knownObject(DAGGER);
    const blessed = await knownObject(DAGGER, { blessed: true });
    assert.deepEqual(sortObjects([unknown, cursed, ordinary, blessed], { mode: lootSortMode() }), [blessed, ordinary, cursed, unknown]);
});

void test('equal names and beatitude prefer grease, less erosion, known proofing, and better enchantment', async () => {
    const damaged = await knownObject(LONG_SWORD, { oeroded: 2 });
    const ordinary = await knownObject(LONG_SWORD, { spe: 0 });
    const enchanted = await knownObject(LONG_SWORD, { spe: 3 });
    const proofed = await knownObject(LONG_SWORD, { rknown: true, oerodeproof: true });
    const greased = await knownObject(LONG_SWORD, { greased: true });
    assert.deepEqual(sortObjects([damaged, ordinary, enchanted, proofed, greased], { mode: lootSortMode() }),
        [greased, proofed, enchanted, ordinary, damaged]);
});

void test('identical loot remains in its original order and food spe does not act as enchantment', async () => {
    const first = await knownObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('jackal'), spe: 1 });
    const second = await knownObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('jackal'), spe: 2 });
    assert.deepEqual(sortObjects([first, second], { mode: lootSortMode() }), [first, second]);
});

void test('globs of the same species sort by size without shrinking them', async () => {
    const large = await knownObject(GLOB_OF_GRAY_OOZE, { globby: true, owt: 600 });
    const small = await knownObject(GLOB_OF_GRAY_OOZE, { globby: true, owt: 20 });
    assert.deepEqual(sortObjects([large, small], { mode: lootSortMode() }), [small, large]);
    assert.equal(large.owt, 600);
});

void test('in-use ordering puts accessories before weapons and armor while maintaining ties', async () => {
    const armor = await knownObject(LEATHER_ARMOR, { owornmask: 1 });
    const weapon = await knownObject(DAGGER, { owornmask: W_WEP });
    const amulet = await knownObject(AMULET_OF_LIFE_SAVING, { owornmask: W_AMUL });
    assert.deepEqual(sortObjects([armor, weapon, amulet], { mode: SORTLOOT_INUSE }), [amulet, weapon, armor]);
});

void test('a pickup filter retains petrifying corpses when the caller requests touch checks', async () => {
    const food = await knownObject(FOOD_RATION);
    const corpse = await knownObject(CORPSE, { corpsenm: MONSTER_NAME.indexOf('cockatrice') });
    const weapon = await knownObject(DAGGER);
    const ordered = sortObjects([food, corpse, weapon], {
        mode: SORTLOOT_LOOT | SORTLOOT_PETRIFY, filter: object => object.oclass === 2,
    });
    assert.equal(ordered.includes(food), false);
    assert.equal(ordered.includes(corpse), true);
    assert.equal(ordered.includes(weapon), true);
});
