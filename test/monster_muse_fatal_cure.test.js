import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { petrifyMonsterFromContact } from '../js/monster_stoning.js';
import { useMonsterStoningCure } from '../js/monster_stoning_cure.js';
import { CORPSE, DAGGER, POT_ACID } from '../js/object_data.js';
import { floorObjectsAt } from './support/level-state.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a fatal acid cure after hero petrification awards experience without breaking pacifism', async () => {
    freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const giant = await createMonsterAt('hill giant', 13, 10, NO_MINVENT);
    giant.mhp = 1;
    const acid = await addObjectToMonsterInventory(giant, await knownObject(POT_ACID), game);
    assert.ok(acid);
    const experience = game.u.uexp ?? 0;
    const messages = [];
    const result = await petrifyMonsterFromContact(giant, {
        state: game, creditHero: true, rollOne: () => 15,
        publish: message => { messages.push(message); },
    });
    assert.equal(result.survived, false);
    assert.equal(game.level.monsters.includes(giant), false);
    assert.equal(game.u.uconduct.killer ?? 0, 0);
    assert.ok((game.u.uexp ?? 0) > experience);
    assert.equal(acid.where, 'gone');
    assert.ok(messages.includes('The hill giant dies!'), messages.join('\n'));
});
void test('a fatal acid cure without hero credit leaves the inventory but no corpse', async () => {
    freshObjectRoom({ heroX: 14, heroY: 10 });
    requirePlayingGame(game);
    const giant = await createMonsterAt('hill giant', 13, 10, NO_MINVENT);
    giant.mhp = 1;
    const acid = await addObjectToMonsterInventory(giant, await knownObject(POT_ACID), game);
    assert.ok(acid);
    const experience = game.u.uexp ?? 0;
    const dagger = await addObjectToMonsterInventory(giant, await knownObject(DAGGER), game);
    assert.ok(dagger);
    const result = await useMonsterStoningCure(giant, { state: game, rollOne: () => 15, publish: () => { } });
    assert.equal(result.died, true);
    assert.equal(game.level.monsters.includes(giant), false);
    assert.equal(game.u.uexp ?? 0, experience);
    assert.equal(floorObjectsAt(game.level, 13, 10).some(object => object.otyp === CORPSE), false);
    assert.ok(floorObjectsAt(game.level, 13, 10).includes(dagger));
    assert.equal(acid.where, 'gone');
});
//# sourceMappingURL=monster_muse_fatal_cure.test.js.map