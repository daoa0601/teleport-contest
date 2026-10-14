import assert from 'node:assert/strict';
import test from 'node:test';
import { CORPSTAT_FEMALE, CORPSTAT_MALE } from '../js/const.js';
import { addFruit } from '../js/fruit.js';
import { requireGameLevel } from '../js/gstate.js';
import { BAG_OF_TRICKS, LAND_MINE, POT_HEALING, SACK, SPEED_BOOTS } from '../js/object_data.js';
import { recordObjectCall } from '../js/object_knowledge.js';
import { readObjectName } from '../js/objnam.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a potion call name is not interpreted as holy water', async () => {
    freshObjectRoom();
    recordObjectCall(POT_HEALING, 'holy water');
    const result = await readObjectName('uncursed potion called holy water', { wizardWish: true });
    assert.ok(result && !result.noWish);
    assert.equal(result.object.otyp, POT_HEALING);
    assert.equal(result.object.blessed, false);
});
void test('a call name does not arm a wished land mine', async () => {
    freshObjectRoom();
    const result = await readObjectName('land mine called digger', { wizardWish: true });
    assert.ok(result && !result.noWish, 'The mine should be an object');
    assert.equal(result.object.otyp, LAND_MINE);
    assert.equal(requireGameLevel().traps.length, 0);
});
void test('ordinary trapped chest wishes retain a generated trap', async () => {
    freshObjectRoom({ gameplaySeed: 5 });
    const result = await readObjectName('trapped chest');
    assert.ok(result && !result.noWish);
    assert.equal(result.object.otrapped, true);
});
void test('an ordinary untrapped chest wish removes a generated trap', async () => {
    freshObjectRoom({ gameplaySeed: 5 });
    const result = await readObjectName('untrapped chest');
    assert.ok(result && !result.noWish);
    assert.equal(result.object.otrapped, false);
});
void test('broken glass is rejected instead of granting a glass gem', async () => {
    freshObjectRoom();
    const result = await readObjectName('broken glass', { wizardWish: true });
    assert.equal(result, null);
});
void test('an unmatched bag call name falls back to a bag description', async () => {
    freshObjectRoom({ gameplaySeed: 1 });
    const result = await readObjectName('bag called unregistered', { wizardWish: true });
    assert.ok(result && !result.noWish);
    assert.ok(result.object.otyp >= SACK && result.object.otyp <= BAG_OF_TRICKS, `Expected a bag, received object type ${result.object.otyp}`);
});
void test('a plural range noun keeps its class when resolving a call name', async () => {
    freshObjectRoom();
    recordObjectCall(SPEED_BOOTS, 'speedy');
    recordObjectCall(POT_HEALING, 'speedy');
    const result = await readObjectName('boots called speedy', { wizardWish: true });
    assert.ok(result && !result.noWish);
    assert.equal(result.object.otyp, SPEED_BOOTS);
});
void test('an explicit article requests one fruit even with a plural registered label', async () => {
    freshObjectRoom();
    const fruit = addFruit('berries');
    const result = await readObjectName('a berries', { wizardWish: true });
    assert.ok(result && !result.noWish);
    assert.equal(result.object.spe, fruit);
    assert.equal(result.object.quan, 1);
});
void test('a neutral monster alias replaces a wished gender and can depict either sex', async () => {
    const genders = new Set();
    for (let seed = 1; seed <= 12; seed++) {
        freshObjectRoom({ gameplaySeed: seed });
        const result = await readObjectName('female grey dragon statue', { wizardWish: true });
        assert.ok(result && !result.noWish, `Statue wish failed with seed ${seed}`);
        genders.add(result.object.spe);
    }
    assert.ok(genders.has(CORPSTAT_MALE), 'Alias wishes should be able to produce male statues');
    assert.ok(genders.has(CORPSTAT_FEMALE), 'Alias wishes should be able to produce female statues');
});
void test('a canonical neutral monster name preserves the explicit wished gender', async () => {
    freshObjectRoom();
    const result = await readObjectName('female gray dragon statue', { wizardWish: true });
    assert.ok(result && !result.noWish);
    assert.equal(result.object.spe, CORPSTAT_FEMALE);
});
//# sourceMappingURL=wish_review.test.js.map