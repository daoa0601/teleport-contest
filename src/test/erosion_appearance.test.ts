import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_MINVENT } from '../js/const.js';
import { erodeObject } from '../js/object_erosion.js';
import { OBJECT_NAMES } from '../js/object_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { uninitializedObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('erosion names an unfamiliar monster weapon by its visible appearance', async () => {
    freshObjectRoom();
    const troll = await createMonsterAt('water troll', 11, 10, NO_MINVENT);
    const weapon = await uninitializedObject(OBJECT_NAMES.indexOf('ranseur'), { typeKnown: false });
    await addObjectToMonsterInventory(troll, weapon);
    const messages: string[] = [];

    await erodeObject(weapon, 'rust', {
        publish: async message => { messages.push(message); },
    });

    assert.equal(weapon.oeroded, 1);
    assert.deepEqual(messages, ["The water troll's hilted polearm rusts!"]);
});
