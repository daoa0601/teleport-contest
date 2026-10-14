import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, POT_WATER } from '../js/object_data.js';
import { setPrimaryWeapon, setSecondaryWeapon, setTwoWeaponCombat } from '../js/weapon_slots.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('unholy water makes a cursed secondary weapon drop during two-weapon combat', async () => {
    freshObjectRoom();
    const main = await addInventoryObject(DAGGER);
    const secondary = await addInventoryObject(DAGGER, { spe: 1 });
    const water = await addInventoryObject(POT_WATER, { cursed: true });
    await setPrimaryWeapon(main);
    await setSecondaryWeapon(secondary);
    setTwoWeaponCombat(true);
    resetInputState();
    await runExtendedCommand('dip', secondary.invlet + water.invlet + ' '.repeat(30));
    assert.equal(secondary.cursed, true);
    assert.equal(secondary.where, 'floor');
    assert.equal(game.uswapwep, null);
    assert.equal(game.u.twoweap, false);
});
//# sourceMappingURL=potion_curse_secondary.test.js.map