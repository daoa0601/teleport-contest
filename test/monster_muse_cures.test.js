import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { consumeMonsterStoningCure, useMonsterStoningCure } from '../js/monster_stoning_cure.js';
import { POT_ACID } from '../js/object_data.js';
import { knownObject, untimedCorpse } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
for (const adjacent of [true, false]) {
    void test(`watching a monster drink acid ${adjacent ? 'nearby shows its appearance' : 'at a distance keeps its appearance unknown'}`, async () => {
        freshObjectRoom({ heroX: 14, heroY: 10 });
        requirePlayingGame(game);
        const monster = await createMonsterAt('orc', adjacent ? 13 : 10, 10, NO_MINVENT);
        monster.mhp = monster.mhpmax = 100;
        const acid = await addObjectToMonsterInventory(monster, await knownObject(POT_ACID, {
            typeKnown: false, known: false, dknown: false, cursed: true,
        }), game);
        assert.ok(acid);
        assert.ok(game.objectDescriptions);
        game.objectDescriptions[POT_ACID] = 'pink';
        const messages = [];
        const result = await useMonsterStoningCure(monster, {
            state: game, rollOne: () => 1, publish: message => { messages.push(message); },
        });
        assert.equal(result.consumed, true);
        assert.equal(monster.mhp, 99);
        assert.equal(acid.where, 'gone');
        assert.equal(acid.dknown, adjacent);
        assert.ok(messages.includes(`The orc quaffs a cursed ${adjacent ? 'pink ' : ''}potion.`), messages.join('\n'));
        assert.equal(game._knownObjectTypes?.has(POT_ACID) ?? false, false);
    });
}
for (const species of ['bat', 'giant bat', 'vampire bat']) {
    void test(`a lizard cures a ${species} without claiming its natural confusion is steadier`, async () => {
        freshObjectRoom({ heroX: 14, heroY: 10 });
        requirePlayingGame(game);
        const monster = await createMonsterAt(species, 13, 10, NO_MINVENT);
        monster.mconf = 1;
        const lizard = await addObjectToMonsterInventory(monster, await untimedCorpse(MONSTER_NAME.indexOf('lizard')), game);
        assert.ok(lizard);
        const messages = [];
        await consumeMonsterStoningCure(monster, lizard, {
            state: game, stoning: false, publish: message => { messages.push(message); },
        });
        assert.equal(monster.mconf, 0);
        assert.equal(lizard.where, 'gone');
        assert.equal(messages.some(message => message.includes('steadier')), false, messages.join('\n'));
    });
}
//# sourceMappingURL=monster_muse_cures.test.js.map