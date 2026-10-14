import test from 'node:test';
import assert from 'node:assert/strict';

import { initializePet } from '../js/dog.js';
import { doGenocide } from '../js/genocide.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { CORPSE, LEASH } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { floorObjectsAt } from './support/level-state.js';
import { createMonsterAt, requireMonsterVital } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

void test('genocide records a pet death and releases its leash without kill credit or a corpse', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const dog = await createMonsterAt('little dog', 11, 10);
    initializePet(dog);
    dog.mleashed = 1;
    const leash = await addInventoryObject(LEASH, { leashmon: dog.m_id });
    const experience = game.u.uexp;
    const kills = game.u.uconduct.killer;
    pushKeys('little dog\n' + ' '.repeat(20));

    await doGenocide(1);

    assert.equal(requireMonsterVital(dog.mnum).died, 1);
    assert.equal(dog.mleashed, 0);
    assert.equal(leash.leashmon, 0);
    assert.equal(level.monsters.includes(dog), false);
    assert.equal(game.u.uexp, experience);
    assert.equal(game.u.uconduct.killer, kills);
    assert.equal(floorObjectsAt(level, 11, 10).some(object => object.otyp === CORPSE), false);
});

void test('genocide announces a surviving shapechanger taking a permitted form', async () => {
    freshObjectRoom({ gameplaySeed: 12n });
    requirePlayingGame(game);
    const monster = await createMonsterAt('jackal', 11, 10);
    monster.cham = MONSTER_NAME.indexOf('chameleon');
    const jackal = monster.mnum;
    pushKeys('jackal\n' + ' '.repeat(20));

    await doGenocide(1);

    assert.notEqual(monster.mnum, jackal);
    assert.ok(monster.mhp > 0);
    assert.match(game._pending_message, /turns into|disappears/);
});
