import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { rhack } from '../js/cmd.js';
import { M_AP_OBJECT, M_AP_TYPE, NO_MINVENT } from '../js/const.js';
import { deleteObject } from '../js/object_delete.js';
import {
    addFruit, changePreferredFruit, fruitFromIndex, fruitFromName,
    fruitName, initializeFruitRegistry,
} from '../js/fruit.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { inventoryItemDescription } from '../js/invent.js';
import { runSegment } from '../js/jsmain.js';
import { mklev, mksobj, saveBonesLevel } from '../js/mklev.js';
import { objectAtMonsterDescription } from '../js/monster_birth.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { objectName, readObjectName } from '../js/objnam.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { FORTUNE_COOKIE, LARGE_BOX, SLIME_MOLD } from '../js/object_data.js';
import { restoreGame, saveGame } from '../js/save.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { floorObjects } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

async function changeFruitThroughOptions(name: string) {
    resetInputState().feed(`a${name}\n\x1b`);
    await rhack('O'.charCodeAt(0));
}

void test('newgame registers the configured fruit before slime molds and mimics can be constructed', async () => {
    const engine = await runSegment({
        storage: memoryStorage(),
        seed: 314, datetime: '20260830190000', moves: ' ',
        nethackrc: [
            'OPTIONS=name:Ada,role:Valkyrie,race:human,gender:female,align:lawful',
            'OPTIONS=!legacy,!tutorial,!autopickup,pettype:none,fruit:Dragon Berries',
        ].join('\n'),
    });
    assert.ok(engine.lastRunResult !== null && engine.lastRunResult !== undefined);
    assert.equal(engine.lastRunResult.kind, 'input-needed');
    const fruit = await mksobj(SLIME_MOLD, true, false);

    assert.equal(objectName(fruit), 'Dragon Berry');
    assert.equal(fruitFromIndex(fruit.spe)?.fname, 'Dragon Berry');
    assert.equal(game.context.current_fruit, fruit.spe);
    assert.equal(game.flags.made_fruit, true);
});

void test('changing an unmaterialized preferred fruit reuses its identity through real options', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    await changeFruitThroughOptions('Mangoes');
    const first = game.context.current_fruit;
    await changeFruitThroughOptions('Berries');
    const fruit = await mksobj(SLIME_MOLD, true, false);

    assert.equal(game.fruits.length, 1);
    assert.equal(fruit.spe, first);
    assert.equal(objectName(fruit), 'Berry');
    assert.equal(game.context.move, 0);
});

void test('changing fruit after creation retains old inventory names and reselects an existing identity', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    await changeFruitThroughOptions('Papayas');
    const old = await addInventoryObject(SLIME_MOLD, { quan: 1 });
    await changeFruitThroughOptions('Guavas');
    const current = await addInventoryObject(SLIME_MOLD, { quan: 1 });

    assert.equal(objectName(old), 'Papaya');
    assert.equal(objectName(current), 'Guava');
    assert.notEqual(old.spe, current.spe);
    assert.match(await inventoryItemDescription(old), /Papaya/);
    assert.match(await inventoryItemDescription(current), /Guava/);
    await changeFruitThroughOptions('Papaya');
    const again = await mksobj(SLIME_MOLD, true, false);
    assert.equal(again.spe, old.spe);
    assert.equal(game.fruits.length, 2);
});

void test('runtime fruit conflicts and juice names follow native singular and compound rules', async () => {
    freshObjectRoom();
    await changeFruitThroughOptions('apples');
    assert.equal(objectName(await mksobj(SLIME_MOLD, true, false)), 'candied apple');
    await changeFruitThroughOptions('goblin corpses');
    assert.equal(objectName(await mksobj(SLIME_MOLD, true, false)), 'candied goblin corpse');
    await changeFruitThroughOptions('slices of pizza');
    assert.equal(fruitName(true), 'pizza juice');
    assert.equal(objectName(await mksobj(SLIME_MOLD, true, false)), 'slice of pizza');
    await changeFruitThroughOptions('children');
    assert.equal(objectName(await mksobj(SLIME_MOLD, true, false)), 'child');
});

void test('fruit wishes distinguish registered names from the generic fruit type and preserve historical IDs', async () => {
    freshObjectRoom();
    await changeFruitThroughOptions('Papaya');
    const old = await mksobj(SLIME_MOLD, true, false);
    await changeFruitThroughOptions('Guava');
    const wishedOld = await readObjectName('a Papaya', { wizardWish: true });
    const wishedCurrent = await readObjectName('slime mold', { wizardWish: true });
    assert.ok(wishedOld && !wishedOld.noWish);
    assert.equal(wishedOld.object.spe, old.spe);
    assert.equal(objectName(wishedOld.object), 'Papaya');
    assert.ok(wishedCurrent && !wishedCurrent.noWish);
    assert.equal(objectName(wishedCurrent.object), 'Guava');
    assert.equal(await readObjectName('papaya', { wizardWish: true }), null, 'named fruit is case sensitive');
    assert.equal(await readObjectName('fruit', { wizardWish: true }), null, 'fruit is not a generic object type');
});

void test('already plural external fruit labels wish and display stacks without a repeated plural suffix', async () => {
    freshObjectRoom();
    const id = addFruit('berries');
    const single = await readObjectName('a berry', { wizardWish: true });
    const stack = await readObjectName('3 berries', { wizardWish: true });
    assert.ok(single && !single.noWish);
    assert.equal(single.object.spe, id);
    assert.equal(single.object.quan, 1);
    assert.ok(stack && !stack.noWish);
    assert.equal(stack.object.spe, id);
    assert.equal(stack.object.quan, 3);
    assert.match(await inventoryItemDescription(stack.object), /3 berries/);
    assert.doesNotMatch(await inventoryItemDescription(stack.object), /berrieses/);
});

void test('a registered fruit does not override a real object wish alias', async () => {
    freshObjectRoom();
    addFruit('cookies');

    const cookie = await readObjectName('a cookie', { wizardWish: true });

    assert.ok(cookie && !cookie.noWish);
    assert.equal(cookie.object.otyp, FORTUNE_COOKIE);
});

void test('saved games restore all fruit identities and the preferred name over startup configuration', async () => {
    const storage = memoryStorage();
    freshObjectRoom();
    requireFixtureGame(game);
    game.plname = 'Ada';
    game.storage = storage;
    await changeFruitThroughOptions('Papaya');
    const old = await addInventoryObject(SLIME_MOLD, { quan: 1 });
    await changeFruitThroughOptions('Guava');
    const current = await addInventoryObject(SLIME_MOLD, { quan: 1 });
    assert.equal(await saveGame(storage), true);
    freshObjectRoom();
    initializeFruitRegistry('Melon');
    game.storage = storage;

    assert.equal(restoreGame('Ada', storage), true);
    assert.equal(game.fruitName, 'Guava');
    assert.equal(game.context.current_fruit, current.spe);
    const restoredOld = game.inventory.find(object => object.spe === old.spe);
    const restoredCurrent = game.inventory.find(object => object.spe === current.spe);
    assert.ok(restoredOld && restoredCurrent);
    assert.equal(objectName(restoredOld), 'Papaya');
    assert.equal(objectName(restoredCurrent), 'Guava');
    assert.equal(objectName(await mksobj(SLIME_MOLD, true, false)), 'Guava');
});

void test('bones carry only existing fruit identities and remap floor, contained, and monster fruit to the new registry', async () => {
    const storage = memoryStorage();
    freshObjectRoom();
    requireFixtureGame(game);
    game.storage = storage;
    game.u.uz = { dnum: 0, dlevel: 8 };
    changePreferredFruit('Papaya');
    const old = await floorObject(SLIME_MOLD, 12, 10);
    const box = await floorObject(LARGE_BOX, 13, 10, { initialize: false });
    await addCreatedObjectToContainer(box, await knownObject(SLIME_MOLD));
    const carrier = await createMonsterAt('archeologist', 14, 10, NO_MINVENT);
    await addObjectToMonsterInventory(carrier, await knownObject(SLIME_MOLD));
    changePreferredFruit('Guava'); // No instance of this identity exists in bones.
    assert.equal(saveBonesLevel(), true);
    freshObjectRoom();
    game.storage = storage;
    game.flags.debug = true;
    game.u.uz = { dnum: 0, dlevel: 8 };
    changePreferredFruit('Pear');
    const preferred = game.context.current_fruit;
    resetInputState().feed('yn');
    await mklev();

    const floor = floorObjects(game.level).find(object => object.otyp === SLIME_MOLD);
    const restoredBox = floorObjects(game.level).find(object => object.otyp === LARGE_BOX);
    assert.ok(restoredBox?.contents);
    const contained = restoredBox.contents[0];
    const carried = game.level.monsters.flatMap(monster => monster.minvent || [])
        .find(object => object.otyp === SLIME_MOLD);
    for (const fruit of [floor, contained, carried] as const) {
        assert.ok(fruit !== null && fruit !== undefined);
        assert.equal(objectName(fruit), 'Papaya');
        assert.notEqual(fruit.spe, old.spe);
    }
    assert.equal(game.context.current_fruit, preferred);
    assert.equal(game.fruitName, 'Pear');
    assert.equal(fruitFromName('Guava'), null);
});

void test('a fruit mimic protects and remembers its represented current fruit after preference changes', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    changePreferredFruit('Papaya');
    const floor = await floorObject(SLIME_MOLD, 12, 10);
    changePreferredFruit('Guava');
    const represented = game.context.current_fruit;
    const mimic = await createMonsterAt('small mimic', 12, 10, NO_MINVENT);
    assert.equal(M_AP_TYPE(mimic), M_AP_OBJECT);
    assert.equal(mimic.mappearance, SLIME_MOLD);
    assert.equal(mimic.mcorpsenm, represented);
    assert.equal(game.flags.made_fruit, true);
    await deleteObject(floor);
    changePreferredFruit('Papaya');
    assert.equal(await objectAtMonsterDescription(mimic), 'a Guava');
    assert.equal(mimic.mcorpsenm, represented);
});

void test('runtime fruit limits reject a new hundred-and-first identity but allow an existing preference', async () => {
    freshObjectRoom();
    for (let count = 1; count < 100; count++) addFruit(`orchard ${count}`);
    assert.equal(changePreferredFruit('new orchard').changed, false);
    assert.equal(changePreferredFruit('orchard 1').changed, true);
    const fruit = await mksobj(SLIME_MOLD, true, false);
    assert.equal(objectName(fruit), 'orchard 1');
});

void test('external fruit overflow chooses an existing identity and leaves the current preference intact', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const current = game.context.current_fruit;
    for (let count = 1; count < 127; count++) addFruit(`orchard ${count}`);
    const reused = addFruit('one more orchard');

    assert.ok(fruitFromIndex(reused));
    assert.equal(game.fruits.length, 127);
    assert.equal(game.context.current_fruit, current);
    assert.equal(game.fruitName, 'slime mold');
});
