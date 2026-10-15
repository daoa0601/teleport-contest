import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { addObjectToMonsterInventory, removeObjectFromMonsterInventory } from '../js/monster_inventory.js';
import { initializeMonsterArmor } from '../js/monworn.js';
import { SPEED_BOOTS } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('visible speed changes retain an invisible monster’s perceived description', async () => {
    freshObjectRoom({ hero: { seeInvisible: true } });
    const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    monster.minvis = monster.perminvis = 1;
    const boots = await addObjectToMonsterInventory(monster, await knownObject(SPEED_BOOTS));
    assert.ok(boots);
    await initializeMonsterArmor(monster);
    const messages: string[] = [];

    await removeObjectFromMonsterInventory(monster, boots, game, {
        publish: async message => { messages.push(message); },
    });

    assert.equal(messages[0], 'The invisible soldier seems to be moving slower.');
});
