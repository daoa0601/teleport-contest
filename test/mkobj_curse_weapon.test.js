import test from 'node:test';
import assert from 'node:assert/strict';
import { game, requirePlayingGame } from '../js/gstate.js';
import { pushKeys, resetInputState } from '../js/input.js';
import { curseObject } from '../js/object_state.js';
import { DAGGER, POT_WATER } from '../js/object_data.js';
import { setPrimaryWeapon, setSecondaryWeapon, setTwoWeaponCombat } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { runExtendedCommand } from './support/commands.js';
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
void test('unholy water announces the count of a dropped secondary weapon stack', async () => {
    freshObjectRoom();
    requirePlayingGame(game);
    const primary = await addInventoryObject(DAGGER, { spe: 1 });
    const secondary = await addInventoryObject(DAGGER, { quan: 3 });
    const water = await addInventoryObject(POT_WATER, { cursed: true });
    await setPrimaryWeapon(primary);
    await setSecondaryWeapon(secondary);
    setTwoWeaponCombat(true);
    const messages = [];
    resetInputState().beforeRead = () => {
        messages.push(game._pending_message || '');
    };
    await runExtendedCommand('dip', secondary.invlet + water.invlet + ' '.repeat(30));
    assert.equal(secondary.where, 'floor');
    assert.equal(secondary.quan, 3);
    assert.equal(game.uswapwep, null);
    assert.equal(game.u.twoweap, false);
    assert.match([...messages, game._pending_message].join('\n'), /Your left hand spasms and drops your 3 daggers!/);
});
//# sourceMappingURL=mkobj_curse_weapon.test.js.map