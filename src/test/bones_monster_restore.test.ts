import assert from 'node:assert/strict';
import test from 'node:test';

import { NO_MINVENT, NON_PM } from '../js/const.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { mklev, saveBonesLevel } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { ROCK } from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { floorObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createDungeon } from './support/topology.js';

function bonesRoom(storage: ReturnType<typeof memoryStorage>): void {
    freshPlayableRoom({ flags: { debug: true }, hero: { uz: { dnum: 0, dlevel: 7 } } });
    game.dungeons = [createDungeon({ dname: 'The Dungeons of Doom', num_dunlevs: 10, bonetag: 'D' })];
    game.storage = storage;
    init_objects();
}

void test('a new hero protection forces a bones shapechanger back to its natural body', async () => {
    const storage = memoryStorage();
    bonesRoom(storage);
    const chameleon = await createMonsterAt('chameleon', 14, 10, NO_MINVENT);
    await changeMonsterForm(chameleon, MONSTER_NAME.indexOf('newt'));
    assert.equal(saveBonesLevel(), true);
    bonesRoom(storage);
    grantIntrinsicProperty('protectionFromShapeChangers', 'outside', game);
    pushKeys('yn');

    await mklev();

    const restored = requireGameLevel().monsters[0];
    assert.ok(restored);
    assert.equal(restored.mnum, MONSTER_NAME.indexOf('chameleon'));
    assert.equal(restored.cham, NON_PM);
});

void test('a bones hider can conceal itself beneath restored floor cover', async () => {
    const storage = memoryStorage();
    bonesRoom(storage);
    const snake = await createMonsterAt('snake', 14, 10, NO_MINVENT);
    await floorObject(ROCK, 14, 10);
    snake.mundetected = 0;
    assert.equal(saveBonesLevel(), true);
    bonesRoom(storage);
    pushKeys('yn');

    await mklev();

    const restored = requireGameLevel().monsters.find(monster => monster.mnum === snake.mnum);
    assert.ok(restored);
    assert.equal(!!restored.mundetected, true);
});
