import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys } from '../js/input.js';
import { curseObject } from '../js/object_state.js';
import { DAGGER } from '../js/object_data.js';
import { setPrimaryWeapon, setSecondaryWeapon, setTwoWeaponCombat } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('cursing the secondary weapon during two-weapon combat drops it', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const primary = await addInventoryObject(DAGGER, { spe: 1 });
    const secondary = await addInventoryObject(DAGGER);
    await setPrimaryWeapon(primary);
    await setSecondaryWeapon(secondary);
    setTwoWeaponCombat(true);
    pushKeys(' '.repeat(100));

    await curseObject(secondary);

    assert.equal(secondary.where, 'floor');
    assert.equal(game.inventory.includes(secondary), false);
    assert.equal(game.uswapwep, null);
    assert.equal(game.uwep, primary);
    assert.equal(game.u.twoweap, false);
    assert.equal(game._pending_message, 'Your left hand spasms and drops your dagger!');
});
