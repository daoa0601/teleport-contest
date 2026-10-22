import assert from 'node:assert/strict';
import test from 'node:test';

import { NO_MINVENT, W_ARMC } from '../js/const.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { adjustMonsterClothingAfterPolymorph } from '../js/monworn.js';
import { MUMMY_WRAPPING, ROBE } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [cloakType, simpleName] of [[MUMMY_WRAPPING, 'wrapping'], [ROBE, 'robe']] as const) {
    void test(`a monster shrinking out of its ${simpleName} uses the cloak's simple name`, async () => {
        freshObjectRoom();
        const monster = await createMonsterAt('gnome', 11, 10, NO_MINVENT);
        await equipMonsterObject(monster, await knownObject(cloakType), W_ARMC);
        monster.mnum = MONSTER_NAME.indexOf('newt');
        const messages: string[] = [];

        await adjustMonsterClothingAfterPolymorph(monster, game, {
            publish: async message => { messages.push(message); },
        });

        assert.ok(messages.includes(`The newt shrinks out of its ${simpleName}!`), messages.join(' | '));
    });
}
