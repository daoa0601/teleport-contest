import assert from 'node:assert/strict';
import test from 'node:test';

import { ICE } from '../js/const.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { mklev, saveBonesLevel } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { ICE_BOX, OIL_LAMP } from '../js/object_data.js';
import { addObjectToContainer } from '../js/object_container.js';
import { beginObjectBurn } from '../js/light.js';
import { LEVEL_TIMER_KIND, objectTimers, scheduleLevelTimer, stopAllObjectTimers } from '../js/object_timers.js';
import { init_objects } from '../js/o_init.js';
import { corpseObject, floorObject } from './support/game-objects.js';
import { placeCreatedObject } from '../js/floor_object.js';
import { floorObjects } from './support/level-state.js';
import { memoryStorage } from './support/memory-storage.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createDungeon } from './support/topology.js';

function bonesRoom(storage: ReturnType<typeof memoryStorage>, moves: number): void {
    freshPlayableRoom({ moves, flags: { debug: true }, hero: { uz: { dnum: 0, dlevel: 7 } } });
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D' })];
    game.storage = storage;
    init_objects();
}

void test('bones retain corpse age, lamp fuel, and remaining timer durations on the new hero clock', async () => {
    const storage = memoryStorage();
    bonesRoom(storage, 1000);
    const corpse = placeCreatedObject(await corpseObject(MONSTER_NAME.indexOf('newt'), { age: 990 }), 12, 10);
    const remainingRot = (objectTimers(corpse)[0]?.deadline ?? 0) - game.moves;
    const lamp = await floorObject(OIL_LAMP, 13, 10, { age: 150 });
    beginObjectBurn(lamp, game, game.moves);
    const remainingBurn = (objectTimers(lamp)[0]?.deadline ?? 0) - game.moves;
    const fuel = lamp.age;
    const iceBox = await floorObject(ICE_BOX, 14, 10, { initialize: false });
    const frozenCorpse = await corpseObject(MONSTER_NAME.indexOf('newt'), { ageRelative: true, age: 7 });
    stopAllObjectTimers(frozenCorpse);
    await addObjectToContainer(iceBox, frozenCorpse);
    requireGameLevel().requireAt(15, 10).typ = ICE;
    scheduleLevelTimer(15, 10, LEVEL_TIMER_KIND.MELT_ICE_AWAY, game.moves + 30);
    assert.equal(saveBonesLevel(), true);
    bonesRoom(storage, 100);
    pushKeys('yn');

    await mklev();

    const objects = floorObjects(requireGameLevel());
    const restoredCorpse = objects.find(object => object.ox === 12);
    const restoredLamp = objects.find(object => object.otyp === OIL_LAMP);
    const frozen = objects.find(object => object.otyp === ICE_BOX)?.contents?.[0];
    assert.ok(restoredCorpse);
    assert.ok(restoredLamp);
    assert.ok(frozen);
    assert.equal(game.moves - restoredCorpse.age, 10);
    assert.equal((objectTimers(restoredCorpse)[0]?.deadline ?? 0) - game.moves, remainingRot);
    assert.equal(restoredLamp.age, fuel);
    assert.equal((objectTimers(restoredLamp)[0]?.deadline ?? 0) - game.moves, remainingBurn);
    assert.equal(frozen.age, 7);
    assert.equal(requireGameLevel().levelTimers[0]?.deadline, game.moves + 30);
});
