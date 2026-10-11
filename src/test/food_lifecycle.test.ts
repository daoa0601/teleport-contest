import { races } from '../js/roles.js';
import type { RaceName } from '../js/roles.js';
import { installPagerInput } from './support/pager-input.js';
import { floorObjectsAt } from './support/level-state.js';
import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { continueCountedCommand, rhack } from '../js/cmd.js';
import { NOT_HUNGRY } from '../js/const.js';
import { reviveCorpseByMagic } from '../js/corpse_revival.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { requireGameLevel, requireGameDisplay, game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CARROT, CRAM_RATION, FOOD_RATION, LEMBAS_WAFER } from '../js/object_data.js';
import { delobj } from '../js/object_delete.js';
import { objectTimers, OBJECT_TIMER_KIND } from '../js/object_timers.js';
import { stopHeroOccupation } from '../js/occupation.js';
import { polymonHero } from '../js/polyself.js';
import { restoreGame, saveGame } from '../js/save.js';
import { runDueTimers } from '../js/timer_effects.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject, corpseObject, floorObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

function mealRoom(raceName: RaceName = 'human') {
    const race = races.find(candidate => candidate.name === raceName);
    assert.ok(race);
    freshObjectRoom({ race, gameplaySeed: 41n, hero: { uhunger: 200, uhs: NOT_HUNGRY } });
    return acknowledgeMessages();
}

function acknowledgeMessages() {
    const input = resetInputState();
    installPagerInput(input, { expected: /eat|eating|meal|corpse|food|tastes|delicious|nauseat|satiat|sick|hungry|finish|chok|reviv|carrot|ration|sack/i, limit: 30 });
    return input;
}

async function finishMeal() {
    for (let turn = 0; game._occupation && turn < 40; turn++)
        await continueCountedCommand(game);
    assert.equal(game._occupation, null, 'the meal finishes within its normal eating time');
}

void test('finishing a floor corpse releases its identity and its decay timer', async () => {
    const input = mealRoom();
    requireFixtureGame(game);
    const corpse = placeCreatedObject(await corpseObject(MONSTER_NAME.indexOf('gnome')),
        game.u.ux, game.u.uy);
    assert.ok(objectTimers(corpse).length, 'the real corpse starts with a decay timer');
    input.feed('y');

    await rhack('e'.charCodeAt(0));
    await finishMeal();

    assert.equal(corpse.where, 'gone');
    assert.equal(objectTimers(corpse).length, 0);
    assert.ok(!floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy).includes(corpse));
    assert.ok(game.u.uhunger > 200);
});

void test('eating one corpse from a floor stack leaves the other corpse able to decay', async () => {
    const input = mealRoom();
    requireFixtureGame(game);
    const corpse = placeCreatedObject(await corpseObject(MONSTER_NAME.indexOf('gnome'),
        { quan: 2, quantity: 2 }), game.u.ux, game.u.uy);
    input.feed('y');

    await rhack('e'.charCodeAt(0));
    await finishMeal();

    const remaining = floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy)[0];
    assert.equal(corpse.where, 'gone');
    assert.ok(remaining !== null && remaining !== undefined);
    assert.equal(remaining.quan, 1);
    const rot = objectTimers(remaining).find(timer => timer.kind === OBJECT_TIMER_KIND.ROT_CORPSE);
    assert.ok(rot, 'the untouched remainder keeps an independent decay timer');
    game.moves = rot.deadline;
    await runDueTimers();
    assert.equal(remaining.where, 'gone');
});

void test('one carried ration is split for eating without consuming the untouched stack', async () => {
    const input = mealRoom();
    requireFixtureGame(game);
    const stack = await addInventoryObject(FOOD_RATION, { quan: 2, age: game.moves });
    input.feed(stack.invlet);

    await rhack('e'.charCodeAt(0));

    assert.equal(stack.quan, 1);
    const meal = game.inventory.find(object => object !== stack);
    assert.ok(meal !== null && meal !== undefined);
    assert.equal(meal.quan, 1);
    assert.ok(meal.oeaten !== null && meal.oeaten !== undefined);
    assert.ok(meal.oeaten > 0);
    assert.notEqual(meal.invlet, stack.invlet);
    await finishMeal();
    assert.equal(meal.where, 'gone');
    assert.ok(game.inventory.includes(stack));
    assert.equal(stack.oeaten || 0, 0);
});

void test('consuming a wielded food item clears the real weapon slot', async () => {
    const input = mealRoom();
    requireFixtureGame(game);
    const carrot = await addInventoryObject(CARROT, { age: game.moves });
    await setPrimaryWeapon(carrot);
    input.feed(carrot.invlet);

    await rhack('e'.charCodeAt(0));

    assert.equal(carrot.where, 'gone');
    assert.equal(game.uwep, null);
    assert.equal(carrot.owornmask, 0);
});

void test('food disappearing during a meal stops further eating without gaining more nutrition', async () => {
    const input = mealRoom();
    requireFixtureGame(game);
    const ration = await floorObject(FOOD_RATION, game.u.ux, game.u.uy, { age: game.moves });
    input.feed('y');
    await rhack('e'.charCodeAt(0));
    const nutrition = game.u.uhunger;

    await delobj(ration);
    await continueCountedCommand(game);

    assert.equal(game._occupation, null);
    assert.equal(game.context.victual, null);
    assert.equal(game.u.uhunger, nutrition);
});

void test('revival interrupts the last bite without consuming the body before its monster returns', async () => {
    const input = mealRoom();
    requireFixtureGame(game);
    const corpse = placeCreatedObject(await corpseObject(MONSTER_NAME.indexOf('sewer rat')),
        game.u.ux, game.u.uy);
    input.feed('y');
    await rhack('e'.charCodeAt(0));
    assert.ok(corpse.oeaten !== undefined);
    for (let bite = 0; corpse.oeaten > 1 && bite < 40; bite++)
        await continueCountedCommand(game);
    assert.ok(game._occupation, 'the meal has its final completion turn left');
    const nutrition = game.u.uhunger;

    const revival = await reviveCorpseByMagic(corpse);
    assert.ok(revival !== null && revival !== undefined);
    assert.ok(revival.monster);
    assert.ok(revival.monster.mhp !== null && revival.monster.mhp !== undefined);
    assert.ok(revival.monster.mhp > 0, 'the body produced a living monster');
    assert.ok(game.level.monsters.includes(revival.monster));
    assert.equal(corpse.where, 'gone');
    assert.equal(game._occupation, null);
    assert.equal(game.context.victual, null);
    assert.equal(game.u.uhunger, nutrition);
});

void test('taking a bite of shop food retains its charge after the food is consumed', async () => {
    mealRoom();
    requireFixtureGame(game);
    const { shopkeeper } = await createStaffedShop();
    const input = acknowledgeMessages();
    const ration = await floorObject(FOOD_RATION, game.u.ux, game.u.uy, { age: game.moves });
    input.feed('y');

    await rhack('e'.charCodeAt(0));
    await finishMeal();

    assert.ok(!floorObjectsAt(requireGameLevel(game), game.u.ux, game.u.uy).includes(ration));
    const entry = shopkeeper.eshk.bill.find(bill => bill.useup);
    assert.ok(entry, 'the meal leaves a real used-up shop bill');
    assert.ok(entry.price > 0);
});

void test('a saved interrupted meal resumes its remaining bites without starting a second meal', async () => {
    const input = mealRoom();
    requireFixtureGame(game);
    game.plname = 'Meal';
    const ration = await addInventoryObject(FOOD_RATION, { age: game.moves });
    input.feed(ration.invlet);
    await rhack('e'.charCodeAt(0));
    await continueCountedCommand(game);
    await stopHeroOccupation();
    const nutrition = game.u.uhunger;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame('Meal', storage), true);
    const restored = game.inventory.find(object => object.otyp === FOOD_RATION);
    assert.ok(restored !== null && restored !== undefined);
    assert.ok(restored.invlet);
    acknowledgeMessages().feed(restored.invlet);

    await rhack('e'.charCodeAt(0));
    await finishMeal();

    assert.equal(restored.where, 'gone');
    assert.equal(game.u.uconduct.food, 1);
    assert.ok(game.u.uhunger > nutrition);
    assert.ok(game.u.uhunger <= 1000, 'resumption does not restore an untouched ration');
});

for (const [race, type, nutrition] of [
    ['elf', LEMBAS_WAFER, 1000], ['orc', LEMBAS_WAFER, 600],
    ['dwarf', CRAM_RATION, 699], // The three bite bonuses each round down.
] as const) {
    void test(`${race} gains the native nutrition from familiar trail food`, async () => {
        const input = mealRoom(race);
        requireFixtureGame(game);
        const food = await addInventoryObject(type);
        input.feed(food.invlet);

        await rhack('e'.charCodeAt(0));
        await finishMeal();

        assert.equal(game.u.uhunger, 200 + nutrition);
    });
}

void test('polymorph changes each later bite without restoring partly eaten food', async () => {
    const input = mealRoom('elf');
    requireFixtureGame(game);
    const food = await addInventoryObject(LEMBAS_WAFER);
    input.feed(food.invlet);
    await rhack('e'.charCodeAt(0));
    assert.equal(game.u.uhunger, 700);
    await stopHeroOccupation();
    await polymonHero(MONSTER_NAME.indexOf('goblin'));
    assert.equal(food.oeaten, 400, 'the race bonus changed nutrition gained, not food remaining');
    input.feed(food.invlet);

    await rhack('e'.charCodeAt(0));
    await finishMeal();

    assert.equal(game.u.uhunger, 1000, 'the goblin body gets the smaller orcish second bite');
    assert.equal(food.where, 'gone');
});
