import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { igniteItems } from '../js/light.js';
import { POT_OIL } from '../js/object_data.js';
import { setHeroBlindnessTurns } from '../js/senses.js';
import { objectTypeKnown } from '../js/shk.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
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
//# sourceMappingURL=pool_oil_naming.test.js.map