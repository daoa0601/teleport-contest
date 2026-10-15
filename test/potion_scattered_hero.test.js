import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { POT_FRUIT_JUICE } from '../js/object_data.js';
import { scatterFloorObjects } from '../js/scatter.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createMonsterAt } from './support/monsters.js';
void test('a scattered potion that hits the hero deals bottle damage before it evaporates', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const { ux, uy } = game.u;
    const potion = await floorObject(POT_FRUIT_JUICE, ux + 1, uy);
    const messages = [];
    await scatterFloorObjects(ux + 1, uy, 2, {
        mayDestroy: false, random: () => 0, rollOne: () => 1,
        publish: async (message) => { messages.push(message); },
    });
    assert.equal(game.u.uhp, 39);
    assert.equal(potion.where, 'gone');
    assert.ok(messages.some(message => /crashes on your head/.test(message)), messages.join(' | '));
});
void test('an environmental potion impact leaves the monster eating its meal', async () => {
    freshObjectRoom();
    const { ux, uy } = game.u;
    const dog = await createMonsterAt('dog', ux + 1, uy);
    dog.meating = 7;
    await floorObject(POT_FRUIT_JUICE, ux + 2, uy);
    await scatterFloorObjects(ux + 2, uy, 2, {
        mayDestroy: false, random: () => 0, rollOne: () => 1,
    });
    assert.equal(dog.meating, 7);
});
void test('a scattered potion interrupts the hero occupation when its bottle hits', async () => {
    freshObjectRoom();
    game._occupation = { key: 'wipe-face', text: 'wiping your face', remaining: 8 };
    await floorObject(POT_FRUIT_JUICE, 11, 10);
    await scatterFloorObjects(11, 10, 2, {
        mayDestroy: false, random: () => 0, rollOne: () => 1,
    });
    assert.equal(game._occupation, null);
});
//# sourceMappingURL=potion_scattered_hero.test.js.map