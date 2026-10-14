import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { applyMonsterPassiveToObject } from '../js/monster_passive.js';
import { LEATHER_GLOVES } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';

void test('a disenchanter describes a pair of gloves as one item when draining it', async () => {
    freshObjectRoom();
    const disenchanter = await createMonsterAt('disenchanter', 11, 10, NO_MINVENT);
    const gloves = await addInventoryObject(LEATHER_GLOVES, { spe: 3 });
    const messages: string[] = [];

    await applyMonsterPassiveToObject(disenchanter, gloves, {
        random: limit => limit - 1, publish: message => { messages.push(message); },
    });

    assert.equal(gloves.spe, 2);
    assert.deepEqual(messages, ['Your pair of leather gloves seems less effective.']);
});

