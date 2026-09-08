import test from 'node:test';
import assert from 'node:assert/strict';

import { NO_MINVENT, W_ARMC } from '../js/const.js';
import { pline } from '../js/display.js';
import { fireDamageChain } from '../js/fire_damage.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { erodeAttackingWeapon, erodeObject } from '../js/object_erosion.js';
import { CLUB, DAGGER, OBJECT_NAMES } from '../js/object_data.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';

const quiet = { publish: async () => {} };

test.beforeEach(() => freshObjectRoom());

test('erosion waits for the preceding message before changing the weapon', async () => {
    const dagger = addInventoryObject(DAGGER);
    const input = resetInputState();
    await pline('You hear a loud rumbling sound somewhere deep in the dungeon.');

    const erosion = erodeObject(dagger, 'rust');
    await input.waitUntilBlocked();
    assert.equal(dagger.oeroded ?? 0, 0);
    input.feed(' ');
    await erosion;

    assert.equal(dagger.oeroded, 1);
});

test('grease protects an iron weapon and can wear off without rusting it', async () => {
    const dagger = addInventoryObject(DAGGER, { greased: true });

    await erodeObject(dagger, 'rust', { ...quiet, random: () => 0 });

    assert.equal(dagger.greased, false);
    assert.equal(dagger.oeroded ?? 0, 0);
});

test('grease does not protect a wooden club from burning', async () => {
    const club = addInventoryObject(CLUB, { greased: true });

    await erodeObject(club, 'burn', quiet);

    assert.equal(club.oeroded, 1);
    assert.equal(club.greased, true);
});

test('rust affects a weapon tool but not an ordinary iron key', async () => {
    const pick = addInventoryObject(OBJECT_NAMES.indexOf('pick-axe'));
    const key = addInventoryObject(OBJECT_NAMES.indexOf('skeleton key'));

    await erodeObject(pick, 'rust', quiet);
    await erodeObject(key, 'rust', quiet);

    assert.equal(pick.oeroded, 1);
    assert.equal(key.oeroded ?? 0, 0);
});

test('a rustproof weapon reveals its protection without taking damage', async () => {
    const dagger = addInventoryObject(DAGGER, { oerodeproof: true, rknown: false });

    await erodeObject(dagger, 'rust', quiet);

    assert.equal(dagger.rknown, true);
    assert.equal(dagger.oeroded ?? 0, 0);
});

test('burning away a monster\'s cloak removes its invisibility', async () => {
    const orc = await createMonsterAt('orc', 11, 10, NO_MINVENT);
    const cloak = knownObject(OBJECT_NAMES.indexOf('cloak of invisibility'), { oeroded: 3 });
    equipMonsterObject(orc, cloak, W_ARMC);
    assert.ok(orc.minvis);

    await erodeObject(cloak, 'burn', { destroy: true, publish: async () => {} });

    assert.equal(cloak.where, 'gone');
    assert.equal(orc.minvent.includes(cloak), false);
    assert.equal(!!orc.minvis, false);
});

test('a fourth fire exposure destroys a completely burnt floor weapon', async () => {
    const club = floorObject(CLUB, 11, 10, { oeroded: 3 });
    const objects = game.level.objects[11][10];

    await fireDamageChain(objects, { force: true, x: 11, y: 10 });

    assert.equal(club.where, 'gone');
    assert.equal(objects.includes(club), false);
});

test('contact with a fire attacker burns a weapon, but steam does not', async () => {
    const ant = await createMonsterAt('fire ant', 11, 10, NO_MINVENT);
    const steam = await createMonsterAt('steam vortex', 12, 10, NO_MINVENT);
    const club = addInventoryObject(CLUB);
    const otherClub = addInventoryObject(CLUB, { spe: 1 });

    await erodeAttackingWeapon(ant, club, { ...quiet, random: () => 0 });
    await erodeAttackingWeapon(steam, otherClub, { ...quiet, random: () => 0 });

    assert.equal(club.oeroded, 1);
    assert.equal(otherClub.oeroded ?? 0, 0);
});
