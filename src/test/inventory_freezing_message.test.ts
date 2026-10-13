import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { POT_HEALING } from '../js/object_data.js';
import { destroyColdInventory } from '../js/zap.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('freezing part of a known potion stack names the remaining stack in the plural', async () => {
    freshObjectRoom();
    const potions = await addInventoryObject(POT_HEALING, { quan: 3 });
    const messages: string[] = [];
    let destructionRoll = 0;

    await destroyColdInventory(5, {
        random: limit => limit === 3 && destructionRoll++ === 2 ? 1 : 0,
        rollOne: () => 1,
        publish: async message => { messages.push(message); },
    });

    assert.equal(messages[0], 'Some of your potions of healing freeze and shatter!');
    assert.equal(potions.quan, 1);
    assert.ok(game.inventory.includes(potions));
});
