import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { BAG_OF_TRICKS, DWARVISH_MATTOCK, GAUNTLETS_OF_POWER, GRAY_DRAGON_SCALES, OBJECT_NAMES, POT_GAIN_ABILITY, POT_HEALING, SPEED_BOOTS, } from '../js/object_data.js';
import { readObjectName } from '../js/objnam.js';
import { recordObjectCall } from '../js/object_knowledge.js';
import { freshObjectRoom } from './support/object-room.js';
for (const [request, type] of [
    ['speed boots', SPEED_BOOTS],
    ['gauntlets of giant strength', GAUNTLETS_OF_POWER],
    ['dwarven mattock', DWARVISH_MATTOCK],
    ['scroll of recharging', OBJECT_NAMES.indexOf('charging')],
    ['gain abilities potion', POT_GAIN_ABILITY],
    ['tricks', BAG_OF_TRICKS],
    ['grey dragon scales', GRAY_DRAGON_SCALES],
]) {
    void test(`a wish recognizes ${request}`, async () => {
        freshObjectRoom();
        const result = await readObjectName(request);
        assert.ok(result && !result.noWish, `Wish was rejected: ${request}`);
        assert.equal(result.object.otyp, type);
    });
}
void test('wishes recognize an assigned type call name within its class', async () => {
    freshObjectRoom();
    recordObjectCall(POT_HEALING, 'restorative');
    const result = await readObjectName('potion called restorative');
    assert.ok(result && !result.noWish, 'The called potion should be wishable');
    assert.equal(result.object.otyp, POT_HEALING);
});
void test('a class-qualified unknown wish grants a random item of that class', async () => {
    freshObjectRoom();
    const result = await readObjectName('wand of nonexistent magic');
    assert.ok(result && !result.noWish, 'A specified class should fall back to a random object');
    assert.equal(result.object.oclass, 11);
});
void test('a named subrange wish chooses an item in that range', async () => {
    freshObjectRoom();
    const result = await readObjectName('boots');
    assert.ok(result && !result.noWish, 'Boots should select a random pair');
    assert.match(OBJECT_NAMES[result.object.otyp] ?? '', /boots|shoes/);
});
void test('an unqualified unknown name cannot produce an object', async () => {
    freshObjectRoom();
    assert.equal(await readObjectName('nonexistent magic'), null);
    assert.equal(game.inventory.length, 0);
});
//# sourceMappingURL=wish_lookup.test.js.map