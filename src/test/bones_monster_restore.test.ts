import assert from 'node:assert/strict';
import test from 'node:test';

import { MM_NOGRP, MM_NOWAIT, NO_MINVENT, NON_PM, W_WEP } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { game, requireGameLevel, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { mklev, saveBonesLevel } from '../js/mklev.js';
import { beginMonsterMove } from '../js/monmove.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { changeMonsterForm } from '../js/monster_polymorph.js';
import { DAGGER, ROCK } from '../js/object_data.js';
import { init_objects } from '../js/o_init.js';
import { grantIntrinsicProperty } from '../js/properties.js';
import { vision_recalc } from '../js/vision.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { memoryStorage } from './support/memory-storage.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshPlayableRoom } from './support/playable-room.js';
import { createDungeon } from './support/topology.js';
import { createStaffedShop } from './support/shop.js';
import { planInput } from './support/planned-input.js';

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

void test('a pet prefers equipment dropped during bones restoration over equally close older equipment', async context => {
    const storage = memoryStorage();
    bonesRoom(storage);
    for (let count = 0; count < 20; count++) await floorObject(ROCK, 8, 8);
    await floorObject(DAGGER, 12, 12);
    const chameleon = await createMonsterAt('chameleon', 16, 12, NO_MINVENT);
    await changeMonsterForm(chameleon, MONSTER_NAME.indexOf('giant'));
    await equipMonsterObject(chameleon, await knownObject(DAGGER), W_WEP);
    assert.equal(saveBonesLevel(), true);
    bonesRoom(storage);
    grantIntrinsicProperty('protectionFromShapeChangers', 'outside', game);
    planInput(resetInputState(), context, [
        { prompt: /Get bones\?/, keys: 'y' },
        { prompt: /giant turns into a chameleon![\s\S]*--More--/, keys: ' ' },
        { prompt: /Unlink bones\?/, keys: 'n' },
    ]);
    await mklev();
    const dropped = requireGameLevel().objects[16]?.[12]?.find(object => object.otyp === DAGGER);
    assert.ok(dropped, 'the restored chameleon must drop its dagger');
    requirePlayingGame(game);
    vision_recalc(0);
    const pet = await createMonsterAt('rust monster', 14, 12, MM_NOGRP | MM_NOWAIT | NO_MINVENT);
    initializePet(pet);
    const input = resetInputState();
    input.beforeRead = () => input.feed(' ');

    await beginMonsterMove(pet, game, limit => Math.min(1, limit - 1));

    // C dog_goal() keeps the first equally close food in fobj. A shape
    // change during getlev() places its dropped weapon before old bones.
    assert.equal(pet.mx, 15, 'the rust monster must approach the newly dropped dagger');
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

for (const name of ['Newcomer', 'Ancestor', 'ANCESTOR']) {
    const sameCustomer = name.toLowerCase() === 'ancestor';
    void test(`a bones shopkeeper recognizes ${name} as ${sameCustomer ? 'the ancestor' : 'a different customer'}`, async () => {
        const storage = memoryStorage();
        bonesRoom(storage);
        const { shopkeeper } = await createStaffedShop({ keeperX: 12, keeperY: 10 });
        shopkeeper.mpeaceful = 0;
        shopkeeper.eshk.customer = 'Ancestor';
        shopkeeper.eshk.surcharge = true;
        shopkeeper.eshk.shoplevel = { dnum: 0, dlevel: 3 };
        assert.equal(saveBonesLevel(), true);
        bonesRoom(storage);
        game.plname = name;
        pushKeys('yn');

        await mklev();

        const restored = requireGameLevel().monsters.find(monster => monster.isshk);
        assert.ok(restored?.eshk);
        assert.deepEqual(restored.eshk.shoplevel, { dnum: 0, dlevel: 7 });
        assert.equal(!!restored.mpeaceful, !sameCustomer);
        assert.equal(!!restored.eshk.surcharge, sameCustomer);
    });
}
