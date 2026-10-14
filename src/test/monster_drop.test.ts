import test from 'node:test';
import assert from 'node:assert/strict';

import { artifactByName, nameArtifact } from '../js/artifacts.js';
import { LAVAPOOL, MFAST, NO_MINVENT, W_ARMF, W_WEP } from '../js/const.js';
import { initializePet } from '../js/dog.js';
import { pline } from '../js/display.js';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { beginObjectBurn } from '../js/light.js';
import { mklev } from '../js/mklev.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import {
    discardMonsterInventory, dropMonsterObject, dropSpecialMonsterObjects,
    releaseMonsterInventory,
} from '../js/monster_drop.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { addObjectToContainer } from '../js/object_container.js';
import {
    AMULET_OF_YENDOR, CHEST, CRYSKNIFE, GOLD_PIECE, OIL_LAMP, SCR_IDENTIFY,
    SKELETON_KEY, SPEED_BOOTS, WORM_TOOTH,
} from '../js/object_data.js';
import { runExtendedCommand } from './support/commands.js';
import { knownObject } from './support/game-objects.js';
import { createMonsterAt, createSaddledSteed, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { floorObjectsAt } from './support/level-state.js';
import { freshSpecialLevel } from './support/special-level.js';

async function createArtifact(name: string) {
    const artifact = artifactByName(name);
    assert.ok(artifact);
    const object = await knownObject(artifact.baseType);
    assert.ok(nameArtifact(object, artifact));
    return object;
}

void test('an unseen monster dropping a visible object does not reveal its species', async () => {
    freshObjectRoom();
    const kitten = await createMonsterAt('kitten', 11, 10, NO_MINVENT);
    kitten.minvis = true;
    const gold = await addObjectToMonsterInventory(kitten, await knownObject(GOLD_PIECE));
    assert.ok(gold);
    const messages: string[] = [];

    await dropMonsterObject(kitten, gold, game, {
        verbosely: true, publish: async message => { messages.push(message); },
    });

    assert.equal(messages[0], 'It drops a gold piece.');
});

void test('postmortem inventory release drops every remaining object', async () => {
    const level = freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const key = await knownObject(SKELETON_KEY);
    const scroll = await knownObject(SCR_IDENTIFY);
    const lamp = await knownObject(OIL_LAMP);
    for (const object of [key, scroll, lamp])
        await addObjectToMonsterInventory(monster, object);
    game.program_state.gameover = true;

    const dropped = await releaseMonsterInventory(monster);

    assert.equal(monster.minvent.length, 0);
    for (const object of [key, scroll, lamp]) {
        assert.ok(dropped.includes(object));
        assert.equal(object.where, 'floor');
        assert.ok(floorObjectsAt(level, 11, 10).includes(object));
    }
});

void test('a dropped crysknife is named before losing its held form', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const knife = await equipMonsterObject(monster, await knownObject(CRYSKNIFE), W_WEP);
    pushKeys('    ');

    await dropMonsterObject(monster, knife, game, { verbosely: true });

    assert.match(game._pending_message, /drops .*crysknife/);
    assert.equal(knife.otyp, WORM_TOOTH);
    assert.equal(knife.where, 'floor');
    assert.equal(monster.mw, null);
});

void test('a monster keeps its boot speed while the drop message awaits dismissal', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const boots = await equipMonsterObject(monster, await knownObject(SPEED_BOOTS), W_ARMF);
    assert.equal(monster.mspeed, MFAST);
    await pline('You hear a loud rumbling sound somewhere deep in the dungeon.');
    const input = resetInputState();

    const dropping = dropMonsterObject(monster, boots, game, { verbosely: true });
    await input.waitUntilBlocked();
    try {
        assert.equal(monster.mspeed, MFAST);
        assert.equal(boots.where, 'free');
    } finally {
        input.feed('    ');
        await dropping;
    }

    assert.equal(boots.where, 'floor');
    assert.equal(monster.mspeed, 0);
    assert.doesNotMatch(game._pending_message, /slows down/);
});

void test('dropping a ridden saddle leaves it on the floor before the rider falls', async () => {
    freshObjectRoom({ role: 'knight', hero: { ulevel: 30 } });
    requirePlayingGame(game);
    const steed = await createSaddledSteed();
    await runExtendedCommand('ride', 'l');
    assert.equal(game.u.usteed, steed);
    const saddle = steed.saddle;
    assert.ok(saddle);
    const square = { x: steed.mx, y: steed.my };
    await pline('You hear a loud rumbling sound somewhere deep in the dungeon.');
    const input = resetInputState();

    const dropping = dropMonsterObject(steed, saddle);
    await input.waitUntilBlocked();
    try {
        assert.equal(saddle.where, 'floor');
        assert.ok(floorObjectsAt(game.level, square.x, square.y).includes(saddle));
    } finally {
        input.feed(' '.repeat(20));
        await dropping;
    }

    assert.equal(game.u.usteed, null);
    assert.equal(steed.saddle, null);
});

void test('protected drops keep the current quest artifact but not a foreign one', async () => {
    freshObjectRoom({ role: 'caveman' });
    requirePlayingGame(game);
    const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const amulet = await knownObject(AMULET_OF_YENDOR);
    const quest = await createArtifact('The Sceptre of Might');
    const foreignQuest = await createArtifact('The Orb of Detection');
    for (const object of [amulet, quest, foreignQuest])
        await addObjectToMonsterInventory(monster, object);

    await dropSpecialMonsterObjects(monster);

    assert.equal(amulet.where, 'floor');
    assert.equal(quest.where, 'floor');
    assert.equal(foreignQuest.where, 'minvent');
    assert.deepEqual(monster.minvent, [foreignQuest]);
    assert.ok(monster.mhp > 0);
});

void test('a protected object from an off-map monster relocates to the live level', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const amulet = await addObjectToMonsterInventory(monster, await knownObject(AMULET_OF_YENDOR));
    assert.ok(amulet);
    monster.mx = monster.my = 0;

    await dropSpecialMonsterObjects(monster);

    assert.equal(amulet.where, 'floor');
    assert.ok(amulet.ox > 0);
    assert.ok(floorObjectsAt(game.level, amulet.ox, amulet.oy).includes(amulet));
    assert.equal(monster.minvent.length, 0);
});

for (const uncreate of [false, true]) {
    void test(`discarding inventory ${uncreate ? 'allows' : 'prevents'} recreating a discarded artifact`, async () => {
        freshObjectRoom();
        requirePlayingGame(game);
        const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
        const sting = await createArtifact('Sting');
        await addObjectToMonsterInventory(monster, sting);

        await discardMonsterInventory(monster, uncreate);

        assert.equal(sting.where, 'gone');
        assert.equal(monster.minvent.length, 0);
        const artifact = artifactByName('Sting');
    assert.ok(artifact);
        assert.equal(nameArtifact(await knownObject(artifact.baseType), artifact), uncreate);
        assert.ok(monster.mhp > 0);
    });
}

void test('discard removes contents and burning objects without uncreating a contained artifact', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    const chest = await addObjectToMonsterInventory(monster, await knownObject(CHEST));
    assert.ok(chest);
    const sting = await createArtifact('Sting');
    await addObjectToContainer(chest, sting);
    const lamp = await addObjectToMonsterInventory(monster, await knownObject(OIL_LAMP, { age: 200 }));
    assert.ok(lamp);
    beginObjectBurn(lamp);
    assert.equal(lamp.lamplit, true);

    await discardMonsterInventory(monster, true);

    assert.equal(chest.where, 'gone');
    assert.equal(sting.where, 'gone');
    assert.equal(lamp.where, 'gone');
    assert.equal(lamp.lamplit, false);
    assert.equal(lamp.timed, 0);
    assert.equal(monster.minvent.length, 0);
    const artifact = artifactByName('Sting');
    assert.ok(artifact);
    assert.equal(nameArtifact(await knownObject(artifact.baseType), artifact), false);
});

void test('a live monster drop applies lava destruction before floor placement', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const monster = await createMonsterAt('fire giant', 11, 10, NO_MINVENT);
    game.level.requireAt(11, 10).typ = LAVAPOOL;
    const scroll = await addObjectToMonsterInventory(monster, await knownObject(SCR_IDENTIFY));
    assert.ok(scroll);
    pushKeys('    ');

    await dropMonsterObject(monster, scroll);

    assert.equal(scroll.where, 'gone');
    assert.ok(!floorObjectsAt(game.level, 11, 10).includes(scroll));
    assert.equal(monster.minvent.length, 0);
});

void test('a pet releases cargo but keeps its worn equipment and useful key', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const pet = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    initializePet(pet, { state: game });
    const boots = await equipMonsterObject(pet, await knownObject(SPEED_BOOTS), W_ARMF);
    const key = await addObjectToMonsterInventory(pet, await knownObject(SKELETON_KEY));
    assert.ok(key);
    const scroll = await addObjectToMonsterInventory(pet, await knownObject(SCR_IDENTIFY));
    assert.ok(scroll);
    pushKeys('    ');

    await releaseMonsterInventory(pet, game, { isPet: true });

    assert.equal(scroll.where, 'floor');
    assert.equal(boots.where, 'minvent');
    assert.equal(key.where, 'minvent');
    assert.equal(pet.mspeed, MFAST);
    assert.match(game._pending_message, /drops .*scroll/);
});

void test('a vault guard loses its gold rather than dropping it with other cargo', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const guard = await createMonsterAt('guard', 11, 10, NO_MINVENT);
    guard.isgd = true;
    const gold = await addObjectToMonsterInventory(guard, await knownObject(GOLD_PIECE, { quan: 100 }));
    assert.ok(gold);
    const lamp = await addObjectToMonsterInventory(guard, await knownObject(OIL_LAMP));
    assert.ok(lamp);
    pushKeys('    ');

    await releaseMonsterInventory(guard);

    assert.equal(gold.where, 'gone');
    assert.equal(lamp.where, 'floor');
    assert.ok(!floorObjectsAt(game.level, 11, 10).some(object => object.otyp === GOLD_PIECE));
    assert.equal(guard.minvent.length, 0);
    assert.match(game._pending_message, /gold vanishes/);
});

void test('Lua custom inventory gives King Arthur his specified gear without default cargo', async () => {
    freshSpecialLevel({ prototype: 'Kni-strt', seed: 2501, depth: 1 });
    requirePlayingGame(game);
    game._specialLevelPrototype = 'Kni-strt';
    game._activeSpecialLevel = null;

    await mklev();

    const king = game.level.monsters.find(monster => MONSTER_NAME[monster.mnum] === 'King Arthur');
    assert.ok(king);
    const artifact = artifactByName('Excalibur');
    assert.ok(artifact);
    const excalibur = king.minvent?.find(object => object.oartifact === artifact.id);
    assert.ok(excalibur);
    assert.equal(excalibur.where, 'minvent');
    assert.equal(excalibur.blessed, true);
    assert.equal(king.minvent?.length, 2);
    assert.ok(king.mhp > 0);
});
