import assert from 'node:assert/strict';
import test from 'node:test';
import { MM_NOGRP, NO_MINVENT } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { mklev, saveBonesLevel } from '../js/mklev.js';
import { monsterStatusLine } from '../js/monster_status.js';
import { restoreGame, saveGame } from '../js/save.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { createDungeon } from './support/topology.js';

void test('restoring a pet with no delivery incentive gives it the native minimum apport', async () => {
    freshObjectRoom({ flags: { debug: true } });
    const pet = await createMonsterAt('little dog', 14, 10, MM_NOGRP | NO_MINVENT);
    initializePet(pet);
    assert.ok(pet.edog);
    pet.edog.apport = 0;
    const storage = memoryStorage();
    assert.equal(await saveGame(storage), true);
    assert.equal(restoreGame(game.plname, storage), true);
    const restored = requireGameLevel().monsters.find(monster => monster.m_id === pet.m_id);
    assert.ok(restored);

    const status = await monsterStatusLine(restored);

    assert.match(status, /apport 1\)/);
});

void test('a bones pet retains its remaining feeding interval on the new hero clock', async () => {
    const storage = memoryStorage();
    const bonesRoom = (moves: number): void => {
        freshObjectRoom({ moves, flags: { debug: true } });
        game.storage = storage;
        game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D' })];
    };
    bonesRoom(100);
    const pet = await createMonsterAt('little dog', 14, 10, MM_NOGRP | NO_MINVENT);
    initializePet(pet);
    assert.ok(pet.edog);
    pet.edog.hungrytime = game.moves + 5000;
    assert.equal(saveBonesLevel(), true);
    bonesRoom(20);
    resetInputState().feed('yn');

    await mklev();

    assert.equal(game._restoredBones, true);
    const restored = requireGameLevel().monsters[0];
    assert.ok(restored);
    initializePet(restored, { everything: false });
    const status = await monsterStatusLine(restored);
    assert.match(status, /hungry 5020;/, 'Retaming must retain the restored longer feeding interval');
});
