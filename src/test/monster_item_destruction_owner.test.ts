import assert from 'node:assert/strict';
import test from 'node:test';

import { NO_MINVENT } from '../js/const.js';
import { game } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { POT_HEALING } from '../js/object_data.js';
import { destroyColdMonsterInventory } from '../js/zap.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [tame, owner] of [[true, 'Your little dog'], [false, 'The little dog']] as const) {
    void test(`a ${tame ? 'pet' : 'wild'} carrier's shattered potion is named ${owner}'s`, async () => {
        freshObjectRoom();
        const dog = await createMonsterAt('little dog', 12, 10, NO_MINVENT);
        dog.mtame = tame ? 10 : 0;
        dog.mpeaceful = tame ? 1 : 0;
        const potion = await addObjectToMonsterInventory(dog, await knownObject(POT_HEALING));
        assert.ok(potion);
        const messages: string[] = [];

        await destroyColdMonsterInventory(dog, 10, {
            state: game, random: () => 0, visible: true,
            publish: async message => { messages.push(message); },
        });

        assert.equal(messages[0], `${owner}'s potion of healing freezes and shatters!`);
    });
}
