import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { gameLogEvents } from '../js/pline.js';
import { doeat, eating_conducts, doeat_nonfood, start_tin } from '../js/eat.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, EGG, FOOD_RATION, FORTUNE_COOKIE, LEATHER_ARMOR, WAX_CANDLE, TIN } from '../js/object_data.js';
import { installPolymorphedHero } from './support/hero-state.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
const GOBLIN = MONSTER_NAME.indexOf('goblin');
function logMessages() {
    return gameLogEvents().map(event => event.text).filter(text => /ate for the first time|consumed animal products|tasted meat/.test(text));
}
void test('a first corpse records first food and its independently scoped animal-products event', async () => {
    await freshObjectRoom({ role: 'monk' });
    requireFixtureGame(game);
    game.u.ualign.record = 10;
    const corpse = await addInventoryObject(CORPSE, { corpsenm: GOBLIN });
    assert.ok(corpse.invlet);
    pushKeys(corpse.invlet + ' '.repeat(10));
    await doeat();
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
    await freshObjectRoom({ role: 'monk' });
    requireFixtureGame(game);
    game.u.ualign.record = 10;
    pushKeys(' '.repeat(5));
    await eating_conducts(GOBLIN);
    await eating_conducts(GOBLIN);
    assert.equal(game.u.uconduct.food, 2);
    assert.equal(game.u.uconduct.unvegetarian, 2);
    assert.equal(game.u.ualign.record, 8);
    assert.deepEqual(logMessages(), ['ate for the first time - goblin']);
});
void test('an ordinary first food suppresses its animal-products log but still counts the ingredient', async () => {
    await freshObjectRoom();
    requireFixtureGame(game);
    const cookie = await addInventoryObject(FORTUNE_COOKIE);
    assert.ok(cookie.invlet);
    pushKeys(cookie.invlet + ' '.repeat(10));
    await doeat();
    assert.equal(game.u.uconduct.food, 1);
    assert.equal(game.u.uconduct.unvegan, 1);
    assert.equal(game.u.uconduct.unvegetarian || 0, 0);
    assert.deepEqual(logMessages(), ['ate for the first time - fortune cookie']);
});
void test('an egg breaks vegan conduct without counting as meat', async () => {
    await freshObjectRoom({ role: 'monk' });
    requireFixtureGame(game);
    const ration = await addInventoryObject(FOOD_RATION);
    const egg = await addInventoryObject(EGG);
    assert.ok(ration.invlet);
    pushKeys(ration.invlet + ' '.repeat(10));
    await doeat();
    const alignment = game.u.ualign.record;
    resetInputState();
    assert.ok(egg.invlet);
    pushKeys(egg.invlet + ' '.repeat(10));
    await doeat();
    assert.equal(game.u.uconduct.unvegan, 1);
    assert.equal(game.u.uconduct.unvegetarian || 0, 0);
    assert.equal(game.u.ualign.record, alignment);
    const dietaryMessage = logMessages()[1];
    assert.ok(dietaryMessage);
    assert.match(dietaryMessage, /^consumed animal products for the first time, by eating an egg$/);
});
void test('wax and leather non-foods use their native diet rules and first-log wording', async () => {
    await freshObjectRoom({ role: 'monk' });
    requireFixtureGame(game);
    game.u.ualign.record = 10;
    const candle = await addInventoryObject(WAX_CANDLE);
    const armor = await addInventoryObject(LEATHER_ARMOR);
    pushKeys(' '.repeat(10));
    await doeat_nonfood(candle, game);
    await doeat_nonfood(armor, game);
    assert.equal(game.u.uconduct.food, 2);
    assert.equal(game.u.uconduct.unvegan, 2);
    assert.equal(game.u.uconduct.unvegetarian, 1);
    assert.equal(game.u.ualign.record, 9);
    const [firstMeal, firstMeat] = logMessages();
    assert.ok(firstMeal && firstMeat);
    assert.match(firstMeal, /^ate for the first time \(.+candle\)$/);
    assert.match(firstMeat, /^tasted meat by-products for the first time, by eating a leather armor$/);
});
void test('spinach only breaks food conduct and records its own first-food description', async () => {
    await freshObjectRoom();
    requireFixtureGame(game);
    installPolymorphedHero('rust monster');
    const tin = await addInventoryObject(TIN, { spe: 1, corpsenm: -1, blessed: true });
    pushKeys(' '.repeat(10));
    await start_tin(tin);
    assert.equal(game.u.uconduct.food, 1);
    assert.equal(game.u.uconduct.unvegan || 0, 0);
    assert.deepEqual(logMessages(), ['ate for the first time (spinach)']);
});
//# sourceMappingURL=food_conduct.test.js.map