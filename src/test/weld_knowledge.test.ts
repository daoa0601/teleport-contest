import assert from 'node:assert/strict';
import test from 'node:test';
import { wearHeroAccessory } from '../js/accessory.js';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, OBJECT_NAMES, OIL_LAMP, TOWEL, TWO_HANDED_SWORD } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { applyInventoryObject } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

for (const [type, freeHand] of [[DAGGER, true], [TWO_HANDED_SWORD, false]] as const) {
    void test(`checking ${freeHand ? 'a free hand' : 'occupied hands'} to use a towel reveals a welded weapon's curse`, async () => {
        freshObjectRoom();
        const weapon = await addInventoryObject(type, { cursed: true, bknown: false });
        await setPrimaryWeapon(weapon);
        const towel = await addInventoryObject(TOWEL);
        resetInputState();

        await applyInventoryObject(towel);

        assert.equal(weapon.bknown, true);
        assert.equal(game.uwep, weapon);
        assert.equal(game.context.move, 0);
        assert.equal(game._pending_message, freeHand
            ? 'Your face and hands are already clean.' : 'You have no free hand!');
    });
}

void test('viewing attributes discovers a welded weapon while checking a ring of sustain ability', async () => {
    freshObjectRoom();
    const weapon = await addInventoryObject(DAGGER, { cursed: true, bknown: false });
    await setPrimaryWeapon(weapon);
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('sustain ability'));
    await wearHeroAccessory(ring, 'uleft');
    resetInputState().feed('\x1b');

    await rhack(24);

    assert.equal(weapon.bknown, true);
    assert.equal(game.uleft, ring);
    assert.equal(game.context.move, 0);
});

void test('a free-hand check does not reveal the curse of an improvised weapon that cannot weld', async () => {
    freshObjectRoom();
    const lamp = await addInventoryObject(OIL_LAMP, { cursed: true, bknown: false });
    await setPrimaryWeapon(lamp);
    const towel = await addInventoryObject(TOWEL);
    resetInputState();

    await applyInventoryObject(towel);

    assert.equal(lamp.bknown, false);
    assert.equal(game._pending_message, 'Your face and hands are already clean.');
});

void test('putting a ring behind a welded weapon spends only the discovery turn', async () => {
    freshObjectRoom();
    const weapon = await addInventoryObject(DAGGER, { cursed: true, bknown: false });
    await setPrimaryWeapon(weapon);
    const ring = await addInventoryObject(OBJECT_NAMES.indexOf('sustain ability'));

    for (const time of [1, 0]) {
        resetInputState().feed(`${ring.invlet}r`);

        await rhack('P'.charCodeAt(0));

        assert.equal(game.context.move, time);
        assert.equal(weapon.bknown, true);
        assert.ok(!game.uright);
        assert.equal(game._pending_message, 'You cannot free your weapon hand to put on the ring.');
    }
});
