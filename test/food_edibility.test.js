import { requireFixtureGame } from './support/game-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { doeat } from '../js/eat.js';
import { checkFoodEdibility } from '../js/food_edibility.js';
import { game } from '../js/gstate.js';
import { InputGate, bindInputGate, pushKeys } from '../js/input.js';
import { APPLE } from '../js/object_data.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addInventoryObject, untimedCorpse } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { placeCreatedObject } from '../js/floor_object.js';
function foodSenseRoom() {
    freshObjectRoom({ hero: { uedibility: 1 }, flags: { tips: false } });
}
void test('declining a cursed apple spends the food warning without taking a turn or splitting the stack', async () => {
    foodSenseRoom();
    requireFixtureGame(game);
    const apples = await addInventoryObject(APPLE, { cursed: true, quantity: 3 });
    pushKeys(`${apples.invlet}n`);
    await doeat();
    assert.equal(game.u.uedibility, 0);
    assert.equal(game.context.move, 0);
    assert.equal(apples.quantity, 3);
    assert.equal(game.inventory.filter(object => object.otyp === APPLE).length, 1);
    assert.equal(game._occupation, undefined);
    assert.equal(game.u.uconduct.food || 0, 0);
    assert.match(game._lastPlineMessage, /sense of smell returns to normal/);
});
void test('declining a floor cockatrice corpse stops before petrification or food conduct', async () => {
    foodSenseRoom();
    requireFixtureGame(game);
    const corpse = placeCreatedObject(await untimedCorpse(MONSTER_NAME.indexOf('cockatrice')), game.u.ux, game.u.uy);
    pushKeys('yn');
    await doeat();
    assert.equal(game.u.uedibility, 0);
    assert.equal(corpse.where, 'floor');
    assert.equal(game.u.stonedTurns || 0, 0);
    assert.equal(game.u.uconduct.food || 0, 0);
    assert.equal(game.context.move, 0);
});
void test('eating safe food preserves the sense for a later dangerous meal', async () => {
    foodSenseRoom();
    requireFixtureGame(game);
    const apple = await addInventoryObject(APPLE, { blessed: true });
    pushKeys(apple.invlet + ' '.repeat(8));
    await doeat();
    assert.equal(game.u.uedibility, 1);
    assert.equal(game.context.move, 1);
    assert.ok((game.u.uconduct.food ?? 0) > 0);
});
void test('the food warning accounts for time on ice without changing corpse age or location', async () => {
    foodSenseRoom();
    requireFixtureGame(game);
    game.moves = 100;
    const corpse = await untimedCorpse(MONSTER_NAME.indexOf('newt'), { age: 0, on_ice: true, blessed: false, cursed: false });
    const gate = new InputGate();
    bindInputGate(gate);
    const choice = checkFoodEdibility(corpse);
    await gate.waitUntilBlocked();
    assert.match(game._pending_message, /could be rotten!/);
    assert.doesNotMatch(game._pending_message, /tainted/);
    assert.equal(corpse.age, 0);
    assert.equal(corpse.on_ice, true);
    gate.feed('n');
    assert.equal(await choice, false);
    assert.equal(game.u.uedibility, 0);
});
//# sourceMappingURL=food_edibility.test.js.map