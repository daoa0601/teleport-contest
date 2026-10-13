import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { HORN_OF_PLENTY } from '../js/object_data.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshPlayableRoom } from './support/playable-room.js';

void test('apply produces blessed food or drink from a blessed horn of plenty', async () => {
    freshPlayableRoom();
    const horn = await addInventoryObject(HORN_OF_PLENTY, { blessed: true, spe: 2, typeKnown: false });

    await applyInventoryObject(horn, '    ');

    const food = game.inventory.find(object => object !== horn);
    assert.ok(food);
    assert.ok(food.oclass === 7 || food.oclass === 8);
    assert.equal(food.blessed, true);
    assert.equal(food.cursed, false);
    assert.equal(horn.spe, 1);
    assert.ok(game._knownObjectTypes?.has(HORN_OF_PLENTY));
    assert.equal(game.context.move, 1);
});

void test('an empty horn of plenty is discovered empty and still takes a turn', async () => {
    freshPlayableRoom();
    const horn = await addInventoryObject(HORN_OF_PLENTY, { spe: 0, cknown: false });

    await applyInventoryObject(horn);

    assert.equal(horn.cknown, true);
    assert.equal(game._pending_message, 'Nothing happens.');
    assert.equal(game.context.move, 1);
});
