import { floorObjectsAt } from './support/level-state.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import { NO_MINVENT, W_ARMC } from '../js/const.js';
import { pline } from '../js/display.js';
import { fireDamageChain } from '../js/fire_damage.js';
import { game, requireGameLevel } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { erodeAttackingWeapon, erodeObject } from '../js/object_erosion.js';
import { CLUB, DAGGER, OBJECT_NAMES } from '../js/object_data.js';
import { addInventoryObject, floorObject, knownObject } from './support/game-objects.js';
import { createMonsterAt, equipMonsterObject } from './support/monsters.js';
import { freshObjectRoom } from './support/object-room.js';
import { setMonsterGivenName } from '../js/monster_given_name.js';

const quiet = { publish: async () => {} };

test.beforeEach(() => freshObjectRoom());

void test('erosion waits for the preceding message before changing the weapon', async () => {
    const dagger = await addInventoryObject(DAGGER);
    const input = resetInputState();
    await pline('You hear a loud rumbling sound somewhere deep in the dungeon.');

    const erosion = erodeObject(dagger, 'rust');
    await input.waitUntilBlocked();
    assert.equal(dagger.oeroded ?? 0, 0);
    input.feed(' ');
    await erosion;

    assert.equal(dagger.oeroded, 1);
});

void test('grease protects an iron weapon and can wear off without rusting it', async () => {
    const dagger = await addInventoryObject(DAGGER, { greased: true });

    await erodeObject(dagger, 'rust', { ...quiet, random: () => 0 });

    assert.equal(dagger.greased, false);
    assert.equal(dagger.oeroded ?? 0, 0);
});

void test('grease protection retains the possessive ending on a monster name ending in s', async () => {
    const goblin = await createMonsterAt('goblin', 11, 10, NO_MINVENT);
    setMonsterGivenName(goblin, 'Marcus');
    const dagger = await knownObject(DAGGER, { greased: true });
    await equipMonsterObject(goblin, dagger, 0);
    const messages: string[] = [];

    await erodeObject(dagger, 'rust', {
        random: () => 1,
        publish: async message => { messages.push(message); },
    });

    assert.equal(messages[0], "Marcus's dagger is protected by the layer of grease!");
    assert.equal(dagger.oeroded ?? 0, 0);
});

void test('grease does not protect a wooden club from burning', async () => {
    const club = await addInventoryObject(CLUB, { greased: true });

    await erodeObject(club, 'burn', quiet);

    assert.equal(club.oeroded, 1);
    assert.equal(club.greased, true);
});

void test('rust affects a weapon tool but not an ordinary iron key', async () => {
    const pick = await addInventoryObject(OBJECT_NAMES.indexOf('pick-axe'));
    const key = await addInventoryObject(OBJECT_NAMES.indexOf('skeleton key'));

    await erodeObject(pick, 'rust', quiet);
    await erodeObject(key, 'rust', quiet);

    assert.equal(pick.oeroded, 1);
    assert.equal(key.oeroded ?? 0, 0);
});

void test('a rustproof weapon reveals its protection without taking damage', async () => {
    const dagger = await addInventoryObject(DAGGER, { oerodeproof: true, rknown: false });

    await erodeObject(dagger, 'rust', quiet);

    assert.equal(dagger.rknown, true);
    assert.equal(dagger.oeroded ?? 0, 0);
});

void test('burning away a monster\'s cloak removes its invisibility', async () => {
    const orc = await createMonsterAt('orc', 11, 10, NO_MINVENT);
    const cloak = await knownObject(OBJECT_NAMES.indexOf('cloak of invisibility'), { oeroded: 3 });
    await equipMonsterObject(orc, cloak, W_ARMC);
    assert.ok(orc.minvis);

    await erodeObject(cloak, 'burn', { destroy: true, publish: async () => {} });

    assert.equal(cloak.where, 'gone');
    assert.equal(orc.minvent.includes(cloak), false);
    assert.equal(!!orc.minvis, false);
});

void test('a fourth fire exposure destroys a completely burnt floor weapon', async () => {
    const club = await floorObject(CLUB, 11, 10, { oeroded: 3 });
    const objects = floorObjectsAt(requireGameLevel(game), 11, 10);

    await fireDamageChain(objects, { force: true, x: 11, y: 10 });

    assert.equal(club.where, 'gone');
    assert.equal(objects.includes(club), false);
});

void test('contact with a fire attacker burns a weapon, but steam does not', async () => {
    const ant = await createMonsterAt('fire ant', 11, 10, NO_MINVENT);
    const steam = await createMonsterAt('steam vortex', 12, 10, NO_MINVENT);
    const club = await addInventoryObject(CLUB);
    const otherClub = await addInventoryObject(CLUB, { spe: 1 });

    await erodeAttackingWeapon(ant, club, { ...quiet, random: () => 0 });
    await erodeAttackingWeapon(steam, otherClub, { ...quiet, random: () => 0 });

    assert.equal(club.oeroded, 1);
    assert.equal(otherClub.oeroded ?? 0, 0);
});


void test('corrosion describes covered hands as gloves without exposing the armor type', async () => {
    const gloves = await addInventoryObject(OBJECT_NAMES.indexOf('gauntlets of power'));
    const input = resetInputState();
    const messages: string[] = [];
    input.beforeRead = () => {
        messages.push(game._pending_message || '');
        input.feed(' ');
    };

    await erodeObject(gloves, 'corrosion', {
        displayName: 'gloves', verbose: true,
    });

    messages.push(game._pending_message || '');
    assert.equal(gloves.oeroded2, 1);
    assert.match(messages.join('\n'), /Your gloves corrode!/u);
    assert.ok(!messages.some(message => message.includes('gauntlets of power')));
});
