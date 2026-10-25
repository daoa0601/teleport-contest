import assert from 'node:assert/strict';
import test from 'node:test';

import { CORPSTAT_INIT, NO_MINVENT } from '../js/const.js';
import { decodeBonesPayload } from '../js/bones_validation.js';
import { artifactByName, initializeArtifacts, nameArtifact } from '../js/artifacts.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { createCorpstatAt, mklev, saveBonesLevel } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { removeMonsterFromGame } from '../js/monster_departure.js';
import { CHEST, CORPSE, FOOD_RATION, SCR_MAIL } from '../js/object_data.js';
import { addObjectToContainer } from '../js/object_container.js';
import { OBJECT_TIMER_KIND, objectTimers } from '../js/object_timers.js';
import { init_objects } from '../js/o_init.js';
import { decodeSavedGraph, encodeSavedGraph, isSavedRecord } from '../js/saved_graph.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { floorObjects, floorObjectsAt } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createDungeon } from './support/topology.js';

function bonesRoom(storage: ReturnType<typeof memoryStorage>): void {
    freshPlayableRoom({ flags: { debug: true }, hero: { uz: { dnum: 0, dlevel: 7 } } });
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D' })];
    game.storage = storage;
    init_objects();
    initializeArtifacts(game);
}

void test('a unique corpse in bones loses its revival and becomes a rotting doppelganger', async () => {
    const storage = memoryStorage();
    bonesRoom(storage);
    const death = await createMonsterAt('Death', 12, 10, NO_MINVENT);
    await createCorpstatAt(CORPSE, death, death.mnum, 13, 10, CORPSTAT_INIT);
    await removeMonsterFromGame(death);
    assert.equal(saveBonesLevel(), true);
    bonesRoom(storage);
    pushKeys('yn');

    await mklev();

    const corpse = floorObjects(requireGameLevel()).find(object => object.otyp === CORPSE);
    assert.ok(corpse, 'the unique corpse must remain as ordinary remains');
    assert.equal(corpse.corpsenm, MONSTER_NAME.indexOf('doppelganger'));
    assert.equal(corpse.oextra?.omonst, undefined);
    assert.equal(objectTimers(corpse).some(timer => timer.kind === OBJECT_TIMER_KIND.REVIVE_MON), false);
    assert.equal(objectTimers(corpse).some(timer => timer.kind === OBJECT_TIMER_KIND.ROT_CORPSE), true);
});

void test('bones made in wizard mode retain their wizard origin on restoration', async () => {
    const storage = memoryStorage();
    bonesRoom(storage);
    assert.equal(saveBonesLevel(), true);
    bonesRoom(storage);
    pushKeys('yn');

    await mklev();

    assert.equal(requireGameLevel().flags.wizard_bones, true);
});

void test('restoring bones discards in-use food on the floor and inside containers', async () => {
    const storage = memoryStorage();
    bonesRoom(storage);
    await floorObject(FOOD_RATION, 12, 10);
    const chest = await floorObject(CHEST, 13, 10, { initialize: false });
    await addObjectToContainer(chest, await knownObject(FOOD_RATION));
    assert.equal(saveBonesLevel(), true);
    const key = storage.key(0);
    assert.ok(key);
    const encoded = storage.getItem(key);
    assert.ok(encoded);
    const header = decodeSavedGraph(encoded);
    assert.ok(isSavedRecord(header) && typeof header.version === 'number');
    const payload = decodeBonesPayload(encoded, header.version);
    for (const object of floorObjects(payload.level)) {
        if (object.otyp === FOOD_RATION) object.in_use = true;
        for (const content of object.contents ?? []) content.in_use = true;
    }
    storage.setItem(key, encodeSavedGraph(payload));
    bonesRoom(storage);
    pushKeys('yn');

    await mklev();

    const objects = floorObjects(requireGameLevel());
    assert.equal(objects.some(object => object.otyp === FOOD_RATION), false);
    assert.equal(objects.find(object => object.otyp === CHEST)?.contents?.length, 0);
});

void test('the newest duplicate artifact on the bones floor retains its identity', async () => {
    const storage = memoryStorage();
    bonesRoom(storage);
    const artifact = artifactByName('Grayswandir');
    assert.ok(artifact);
    const older = await floorObject(artifact.baseType, 12, 10);
    assert.equal(nameArtifact(older, artifact), true);
    await floorObject(artifact.baseType, 14, 10, {
        oartifact: artifact.id, artifact: true, oname: artifact.name,
        oextra: { oname: artifact.name },
    });
    assert.equal(saveBonesLevel(), true);
    bonesRoom(storage);
    pushKeys('yn');

    await mklev();

    const objects = floorObjects(requireGameLevel());
    assert.equal(objects.find(object => object.ox === 14)?.oartifact, artifact.id);
    assert.equal(objects.find(object => object.ox === 12)?.oartifact, 0);
});

void test('delivered mail saved in bones becomes next-hero stamps while written mail keeps its origin', async () => {
    const storage = memoryStorage();
    bonesRoom(storage);
    await floorObject(SCR_MAIL, 12, 10, { spe: 0 });
    await floorObject(SCR_MAIL, 13, 10, { spe: 2 });
    assert.equal(saveBonesLevel(), true);
    bonesRoom(storage);
    pushKeys('yn');

    await mklev();

    const delivered = floorObjectsAt(requireGameLevel(), 12, 10).find(object => object.otyp === SCR_MAIL);
    const written = floorObjectsAt(requireGameLevel(), 13, 10).find(object => object.otyp === SCR_MAIL);
    assert.ok(delivered, 'bones lost the delivered mail');
    assert.ok(written, 'bones lost the written mail');
    assert.equal(delivered.spe, 1);
    assert.equal(written.spe, 2);
});
