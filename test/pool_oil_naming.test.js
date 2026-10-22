import assert from 'node:assert/strict';
import test from 'node:test';
import { A_WIS } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { igniteItems } from '../js/light.js';
import { NO_MINVENT } from '../js/const.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { shopkeeperName } from '../js/monster_name.js';
import { OIL_LAMP, POT_OIL } from '../js/object_data.js';
import { initRng } from '../js/rng.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { objectTypeKnown } from '../js/shk.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createStaffedShop } from './support/shop.js';
void test('a known oil potion catches light with one potion prefix', async () => {
    freshObjectRoom();
    const potion = await addInventoryObject(POT_OIL);
    const messages = [];
    await igniteItems([potion], { state: game, publish: text => { messages.push(text); } });
    assert.equal(messages[0], 'Your potion of oil catches light!');
    assert.equal(potion.lamplit, true);
});
for (const [identified, name] of [[true, 'potion of oil'], [false, 'amber potion']]) {
    void test(`visible ignition observes an unseen ${name} before identifying oil`, async () => {
        freshObjectRoom();
        assert.ok(game.objectDescriptions);
        game.objectDescriptions[POT_OIL] = 'amber';
        const potion = await floorObject(POT_OIL, 11, 10, {
            dknown: false, typeKnown: identified,
        });
        const messages = [];
        await igniteItems([potion], { state: game, publish: text => { messages.push(text); } });
        assert.equal(messages[0], `The ${name} catches light!`);
        assert.equal(potion.dknown, true);
        assert.equal(objectTypeKnown(potion), true);
        assert.equal(potion.lamplit, true);
    });
}
void test('ignition felt while blind does not reveal a potion appearance', async () => {
    freshObjectRoom();
    setHeroBlindnessTurns(10);
    const potion = await addInventoryObject(POT_OIL, {
        dknown: false, typeKnown: false, observed: false,
    });
    const messages = [];
    await igniteItems([potion], { state: game, publish: text => { messages.push(text); } });
    assert.equal(messages[0], 'Your potion feels warm.');
    assert.equal(potion.dknown, false);
    assert.equal(objectTypeKnown(potion), true);
});
void test('unseen ignition does not reveal a potion appearance', async () => {
    freshObjectRoom();
    const potion = await floorObject(POT_OIL, 11, 10, {
        dknown: false, typeKnown: false,
    });
    const messages = [];
    await igniteItems([potion], { state: game, visible: false, publish: text => { messages.push(text); } });
    assert.equal(messages.length, 0);
    assert.equal(potion.dknown, false);
    assert.equal(potion.lamplit, true);
});
void test('igniting more oil credits Wisdom only for the first discovery', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const first = await floorObject(POT_OIL, 11, 10, { typeKnown: false });
    const second = await floorObject(POT_OIL, 12, 10, { typeKnown: false });
    game.u.acurr.a[A_WIS] = 3;
    initRng(1n);
    await igniteItems([first], { visible: false });
    assert.equal(game.u._exercise?.[A_WIS], 1, 'the first oil discovery must exercise Wisdom');
    await igniteItems([second], { visible: false });
    assert.equal(second.lamplit, true);
    assert.equal(game.u._exercise?.[A_WIS], 1, 'known oil must not grant another discovery credit');
});
void test('a lamp for sale catches light in its shopkeeper\'s name', async () => {
    freshPlayableRoom({ heroX: 16 });
    const { shopkeeper } = await createStaffedShop({ keeperX: 14 });
    shopkeeper.eshk.shknam = 'Trahnil';
    const lamp = await floorObject(OIL_LAMP, 11, 10, { age: 1500 });
    const messages = [];
    await igniteItems([lamp], { state: game, publish: text => { messages.push(text); } });
    assert.equal(shopkeeperName(shopkeeper), 'Trahnil');
    assert.equal(messages[0], 'Trahnil\'s oil lamp catches light!');
});
void test('a pet\'s lamp catches light as the hero\'s pet\'s lamp', async () => {
    freshObjectRoom();
    const pet = await createMonsterAt('little dog', 12, 10, NO_MINVENT);
    pet.mtame = 10;
    const lamp = await addObjectToMonsterInventory(pet, await knownObject(OIL_LAMP, { age: 1500 }));
    assert.ok(lamp);
    const messages = [];
    await igniteItems([lamp], { state: game, publish: text => { messages.push(text); } });
    assert.equal(messages[0], 'Your little dog\'s oil lamp catches light!');
});
//# sourceMappingURL=pool_oil_naming.test.js.map