import test from 'node:test';
import assert from 'node:assert/strict';

import { NO_MINVENT, W_ARMG, W_ARMS } from '../js/const.js';
import { monsterCanCarryObject, monsterCanTouchObject } from '../js/monster_carry.js';
import { MONSTER_NAME } from '../js/monster_data.js';
import { addObjectToMonsterInventory } from '../js/monster_inventory.js';
import { selectHandToHandWeapon } from '../js/monster_weapon.js';
import {
    BELL_OF_OPENING, CLUB, DAGGER, LEATHER_GLOVES, OBJECT_NAMES,
    SMALL_SHIELD, TWO_HANDED_SWORD,
} from '../js/object_data.js';
import { artifactObject, knownObject, untimedCorpse } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const SILVER_SABER = OBJECT_NAMES.indexOf('silver saber');

test('a lawful giant prefers Excalibur to its otherwise favored club', async () => {
    freshObjectRoom();
    const giant = await createMonsterAt('giant', 11, 10, NO_MINVENT);
    const sword = addObjectToMonsterInventory(giant, artifactObject('Excalibur'));
    addObjectToMonsterInventory(giant, knownObject(CLUB));

    assert.equal(selectHandToHandWeapon(giant)?.o_id, sword.o_id);
});

test('an ordinary monster refuses another role\'s self-willed quest weapon', async () => {
    freshObjectRoom();
    const giant = await createMonsterAt('giant', 11, 10, NO_MINVENT);
    addObjectToMonsterInventory(giant, knownObject(CLUB));
    const bow = addObjectToMonsterInventory(giant, artifactObject('The Longbow of Diana'));

    assert.equal(monsterCanTouchObject(giant, bow), false);
    assert.equal(selectHandToHandWeapon(giant)?.otyp, CLUB);
});

test('gloves let a monster choose a petrifying corpse as its weapon', async () => {
    freshObjectRoom();
    const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    soldier.mpeaceful = false;
    addObjectToMonsterInventory(soldier, knownObject(DAGGER));
    const corpse = addObjectToMonsterInventory(soldier,
        untimedCorpse(MONSTER_NAME.indexOf('cockatrice')));
    assert.equal(monsterCanCarryObject(soldier, corpse), false);
    assert.equal(selectHandToHandWeapon(soldier)?.otyp, DAGGER);

    equipMonsterObject(soldier, knownObject(LEATHER_GLOVES), W_ARMG);

    assert.equal(monsterCanCarryObject(soldier, corpse), true);
    assert.equal(selectHandToHandWeapon(soldier)?.o_id, corpse.o_id);
});

test('a werewolf avoids silver and uses a safe dagger', async () => {
    freshObjectRoom();
    const werewolf = await createMonsterAt('werewolf', 11, 10, NO_MINVENT);
    addObjectToMonsterInventory(werewolf, knownObject(DAGGER));
    const saber = addObjectToMonsterInventory(werewolf, knownObject(SILVER_SABER));

    assert.equal(monsterCanTouchObject(werewolf, saber), false);
    assert.equal(selectHandToHandWeapon(werewolf)?.otyp, DAGGER);
});

test('a shield prevents choosing a two-handed weapon', async () => {
    freshObjectRoom();
    const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    addObjectToMonsterInventory(soldier, knownObject(TWO_HANDED_SWORD));
    addObjectToMonsterInventory(soldier, knownObject(DAGGER));
    equipMonsterObject(soldier, knownObject(SMALL_SHIELD), W_ARMS);

    assert.equal(selectHandToHandWeapon(soldier)?.otyp, DAGGER);
});

test('a monster keeps inventory order among safe weapons of the same type', async () => {
    freshObjectRoom();
    const soldier = await createMonsterAt('soldier', 11, 10, NO_MINVENT);
    addObjectToMonsterInventory(soldier, knownObject(DAGGER, { spe: 6 }));
    const first = addObjectToMonsterInventory(soldier, knownObject(DAGGER, { spe: -2 }));

    assert.equal(selectHandToHandWeapon(soldier)?.o_id, first.o_id);
});

test('Orcus can touch the invocation bell but not silver weapons or Demonbane', async () => {
    freshObjectRoom();
    const orcus = await createMonsterAt('Orcus', 11, 10, NO_MINVENT);

    assert.equal(monsterCanTouchObject(orcus, knownObject(BELL_OF_OPENING)), true);
    assert.equal(monsterCanTouchObject(orcus, knownObject(SILVER_SABER)), false);
    assert.equal(monsterCanTouchObject(orcus, artifactObject('Excalibur')), true);
    assert.equal(monsterCanTouchObject(orcus, artifactObject('Demonbane')), false);
    assert.equal(monsterCanTouchObject(orcus,
        untimedCorpse(MONSTER_NAME.indexOf('Death'))), false);
});
