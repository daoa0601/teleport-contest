import assert from 'node:assert/strict';
import test from 'node:test';
import { addFruit } from '../js/fruit.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { AMULET_OF_YENDOR, BAG_OF_TRICKS, LAND_MINE, LEATHER_ARMOR, ORANGE, OBJECT_DESCRIPTIONS, OBJECT_NAMES, POT_HEALING, SACK, SLIME_MOLD, } from '../js/object_data.js';
import { recordObjectCall } from '../js/object_knowledge.js';
import { readObjectName } from '../js/objnam.js';
import { freshObjectRoom } from './support/object-room.js';
void test('the tool class suffix selects a land mine object before wizard trap dispatch', async () => {
    freshObjectRoom();
    const result = await readObjectName('land mine tool', { wizardWish: true });
    assert.ok(result && !result.noWish, 'A tool-qualified mine should be an object');
    assert.equal(result.object.otyp, LAND_MINE);
    assert.equal(requireGameLevel().traps.length, 0);
});
void test('a rejected paperback wish cannot create wizard terrain', async () => {
    const level = freshObjectRoom();
    const square = level.requireAt(10, 10);
    const terrain = square.typ;
    const result = await readObjectName('paperback fountain', { wizardWish: true });
    assert.equal(result, null);
    assert.equal(square.typ, terrain);
    assert.equal(level.flags.nfountains, 0);
});
void test('Japanese armor names are resolved before adding mail for an armor retry', async () => {
    freshObjectRoom();
    recordObjectCall(LEATHER_ARMOR, 'tanko mail');
    const result = await readObjectName('tanko armor', { wizardWish: true });
    assert.ok(result && !result.noWish);
    assert.equal(result.object.otyp, OBJECT_NAMES.indexOf('plate mail'));
});
void test('a registered fruit is checked before an alias within the tool class', async () => {
    freshObjectRoom();
    const fruitId = addFruit('box tool');
    const result = await readObjectName('box tool', { wizardWish: true });
    assert.ok(result && !result.noWish);
    assert.equal(result.object.otyp, SLIME_MOLD);
    assert.equal(result.object.spe, fruitId);
});
void test('an unmatched called bag with modifiers falls back to the whole tool class', async () => {
    let receivedOtherTool = false;
    for (let seed = 1; seed <= 16; seed++) {
        freshObjectRoom({ gameplaySeed: seed });
        const result = await readObjectName('blessed bag called unregistered', { wizardWish: true });
        assert.ok(result && !result.noWish, `Tool wish rejected for seed ${seed}`);
        assert.equal(result.object.oclass, 6, `Expected a tool for seed ${seed}`);
        assert.equal(result.object.blessed, true, `Blessing lost for seed ${seed}`);
        receivedOtherTool ||= result.object.otyp < SACK || result.object.otyp > BAG_OF_TRICKS;
    }
    assert.ok(receivedOtherTool, 'The fallback should allow tools outside the bag range');
});
void test('the Amulet rule precedes tin contents parsing', async () => {
    freshObjectRoom();
    const result = await readObjectName('tin of the Amulet of Yendor', { wizardWish: true });
    assert.ok(result && !result.noWish);
    assert.equal(result.object.otyp, AMULET_OF_YENDOR);
});
void test('a species-qualified orange enters the ordinary name and description lottery', async () => {
    const received = new Set();
    for (let seed = 1; seed <= 32; seed++) {
        freshObjectRoom({ gameplaySeed: seed });
        recordObjectCall(POT_HEALING, 'orange');
        const result = await readObjectName('giant orange', { wizardWish: true });
        assert.ok(result && !result.noWish, `Orange wish rejected for seed ${seed}`);
        const description = game.objectDescriptions?.[result.object.otyp]
            ?? OBJECT_DESCRIPTIONS[result.object.otyp];
        assert.ok(result.object.otyp === ORANGE || result.object.otyp === POT_HEALING
            || description === 'orange', `Unexpected orange match ${result.object.otyp} for seed ${seed}`);
        received.add(result.object.otyp);
    }
    assert.ok(received.has(ORANGE), 'The actual fruit name must participate');
    assert.ok(received.has(POT_HEALING), 'A matching call name must participate');
});
//# sourceMappingURL=wish_lookup_order.test.js.map