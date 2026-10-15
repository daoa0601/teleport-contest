import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT, W_ARM, W_ARMC } from '../js/const.js';
import { game } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { CHAIN_MAIL, ELVEN_CLOAK } from '../js/object_data.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a small animal form loses its armor with an animal pronoun', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    monster.female = false;
    const armor = await equipMonsterObject(monster, await knownObject(CHAIN_MAIL), W_ARM);
    const messages = [];
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('grid bug'), game, {
        publish: async (message) => { messages.push(message); },
    });
    assert.ok(messages.includes("The grid bug's armor falls around it!"), messages.join('\n'));
    assert.equal(armor.where, 'floor');
});
void test('an invisible monster’s lost armor uses the possessive Its', async () => {
    freshObjectRoom();
    const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    await equipMonsterObject(monster, await knownObject(ELVEN_CLOAK), W_ARMC);
    const messages = [];
    await changeMonsterForm(monster, MONSTER_NAME.indexOf('stalker'), game, {
        publish: async (message) => { messages.push(message); },
    });
    assert.ok(messages.includes('Its cloak tears apart!'), messages.join('\n'));
});
//# sourceMappingURL=worn_polymorph_pronouns.test.js.map