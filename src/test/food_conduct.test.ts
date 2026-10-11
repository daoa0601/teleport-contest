import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { gameLogEvents } from '../js/gamelog.js';
import {
    eatingConducts, recordCorpseDiet, recordFoodConsumption, recordNonfoodConduct,
    recordOrdinaryFoodDiet, recordSpinachConsumption,
} from '../js/food_conduct.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, EGG, FOOD_RATION, FORTUNE_COOKIE, LEATHER_ARMOR, WAX_CANDLE } from '../js/object_data.js';
import { pushKeys } from '../js/input.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

const GOBLIN = MONSTER_NAME.indexOf('goblin');

function logMessages() {
    return gameLogEvents().map(event => event.text);
}

void test('a first corpse records first food and its independently scoped animal-products event', async () => {
    freshObjectRoom({ role: 'monk' });
    requireFixtureGame(game);
    game.u.ualign.record = 10;
    const corpse = await addInventoryObject(CORPSE, { corpsenm: GOBLIN });

    recordFoodConsumption(corpse);
    await recordCorpseDiet(corpse);

    assert.equal(game.u.uconduct.food, 1);
    assert.equal(game.u.uconduct.unvegan, 1);
    assert.equal(game.u.uconduct.unvegetarian, 1);
    assert.equal(game.u.ualign.record, 9);
    assert.deepEqual(logMessages(), [
        'ate for the first time - goblin corpse',
        'consumed animal products for the first time, by eating a goblin corpse',
    ]);
});

void test('a first tin uses one conduct log scope while each meat meal costs Monk alignment', async () => {
    freshObjectRoom({ role: 'monk' });
    requireFixtureGame(game);
    game.u.ualign.record = 10;
    pushKeys(' '.repeat(5));

    await eatingConducts(GOBLIN);
    await eatingConducts(GOBLIN);

    assert.equal(game.u.uconduct.food, 2);
    assert.equal(game.u.uconduct.unvegetarian, 2);
    assert.equal(game.u.ualign.record, 8);
    assert.deepEqual(logMessages(), ['ate for the first time - goblin']);
});

void test('an ordinary first food suppresses its animal-products log but still counts the ingredient', async () => {
    freshObjectRoom();
    requireFixtureGame(game);
    const cookie = await addInventoryObject(FORTUNE_COOKIE);

    const firstFoodLogged = recordFoodConsumption(cookie);
    await recordOrdinaryFoodDiet(cookie, { firstFoodLogged });

    assert.equal(game.u.uconduct.food, 1);
    assert.equal(game.u.uconduct.unvegan, 1);
    assert.equal(game.u.uconduct.unvegetarian || 0, 0);
    assert.deepEqual(logMessages(), ['ate for the first time - fortune cookie']);
});

void test('an egg breaks vegan conduct without counting as meat', async () => {
    freshObjectRoom({ role: 'monk' });
    requireFixtureGame(game);
    const ration = await addInventoryObject(FOOD_RATION);
    const egg = await addInventoryObject(EGG);
    recordFoodConsumption(ration);
    const alignment = game.u.ualign.record;

    const firstFoodLogged = recordFoodConsumption(egg);
    await recordOrdinaryFoodDiet(egg, { firstFoodLogged });

    assert.equal(game.u.uconduct.unvegan, 1);
    assert.equal(game.u.uconduct.unvegetarian || 0, 0);
    assert.equal(game.u.ualign.record, alignment);
    const dietaryMessage = logMessages()[1];
    assert.ok(dietaryMessage);
    assert.match(dietaryMessage, /^consumed animal products for the first time, by eating an egg$/);
});

void test('wax and leather non-foods use their native diet rules and first-log wording', async () => {
    freshObjectRoom({ role: 'monk' });
    requireFixtureGame(game);
    game.u.ualign.record = 10;
    const candle = await addInventoryObject(WAX_CANDLE);
    const armor = await addInventoryObject(LEATHER_ARMOR);

    await recordNonfoodConduct(candle);
    await recordNonfoodConduct(armor);

    assert.equal(game.u.uconduct.food, 2);
    assert.equal(game.u.uconduct.unvegan, 2);
    assert.equal(game.u.uconduct.unvegetarian, 1);
    assert.equal(game.u.ualign.record, 9);
    const [firstMeal, firstMeat] = logMessages();
    assert.ok(firstMeal && firstMeat);
    assert.match(firstMeal, /^ate for the first time \(.+candle\)$/);
    assert.match(firstMeat, /^tasted meat by-products for the first time, by eating a leather armor$/);
});

void test('spinach only breaks food conduct and records its own first-food description', () => {
    freshObjectRoom();
    requireFixtureGame(game);

    recordSpinachConsumption();

    assert.equal(game.u.uconduct.food, 1);
    assert.equal(game.u.uconduct.unvegan || 0, 0);
    assert.deepEqual(logMessages(), ['ate for the first time (spinach)']);
});
