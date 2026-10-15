import assert from 'node:assert/strict';
import test from 'node:test';
import { NO_MINVENT } from '../js/const.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { maybeAbsorbItem } from '../js/monster_item_absorption.js';
import { BOULDER, DAGGER, TWO_HANDED_SWORD } from '../js/object_data.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { makeBlinded } from '../js/sight_change.js';
import { addInventoryObject, artifactObject, knownObject } from './support/game-objects.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { installPagerInput } from './support/pager-input.js';
void test('a mimic cannot absorb a carried boulder', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mimic = await createMonsterAt('small mimic', 11, 10, NO_MINVENT);
    const boulder = await addInventoryObject(BOULDER);
    await maybeAbsorbItem(mimic, boulder, game, 100, 100);
    assert.equal(boulder.where, 'inventory');
    assert.equal(mimic.minvent.length, 0);
});
void test('a neutral mimic refuses the chaotic Stormbringer artifact', async () => {
    freshObjectRoom({ role: 'wizard', hero: { ualign: { type: -1, record: 10 } } });
    requirePlayingGame(game);
    const mimic = await createMonsterAt('small mimic', 11, 10, NO_MINVENT);
    const sword = await addInventoryItem(await artifactObject('Stormbringer'));
    installPagerInput(resetInputState(), { expected: /Stormbringer|mimic/, limit: 4 });
    await maybeAbsorbItem(mimic, sword, game, 100, 100);
    assert.equal(sword.where, 'inventory');
    assert.equal(mimic.minvent.length, 0);
});
void test('an unseen mimic pulls a two-handed weapon from both hands', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mimic = await createMonsterAt('small mimic', 11, 10, NO_MINVENT);
    const sword = await addInventoryObject(TWO_HANDED_SWORD);
    await setPrimaryWeapon(sword);
    await makeBlinded(20, { talk: false });
    installPagerInput(resetInputState(), { expected: /sword|hands/, limit: 4 });
    await maybeAbsorbItem(mimic, sword, game, 100, 100);
    assert.ok(mimic.minvent.includes(sword));
    assert.equal(game.uwep, null);
    assert.match(game._pending_message, /pulled from your hands!/);
});
void test('a mimic absorbs a thrown object without trying to remove it from inventory', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const mimic = await createMonsterAt('small mimic', 11, 10, NO_MINVENT);
    const dagger = await knownObject(DAGGER);
    game._thrownObject = dagger;
    installPagerInput(resetInputState(), { expected: /mimic|dagger/, limit: 4 });
    await maybeAbsorbItem(mimic, dagger, game, 100, 100);
    assert.ok(mimic.minvent.includes(dagger));
    assert.ok(game._thrownObject === null);
    assert.match(game._pending_message, /The small mimic absorbs the dagger!/);
});
//# sourceMappingURL=monster_absorption.test.js.map