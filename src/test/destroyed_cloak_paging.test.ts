import assert from 'node:assert/strict';
import test from 'node:test';
import { findArmorClass, wearHeroArmor } from '../js/armor.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { erodeObject } from '../js/object_erosion.js';
import { CLOAK_OF_DISPLACEMENT } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';

void test('destroying a displacement cloak pages its destruction before announcing lost displacement', async () => {
    freshObjectRoom();
    const cloak = await addInventoryObject(CLOAK_OF_DISPLACEMENT, { oeroded: 3, spe: 3 });
    wearHeroArmor(cloak);
    const armorClass = findArmorClass();
    assert.equal(armorClass, 7);
    game.context.mon_moving = true;
    const input = resetInputState();
    const operation = erodeObject(cloak, 'burn', { destroy: true });

    assert.equal(await Promise.race([
        operation.then(() => 'finished'), input.waitUntilBlocked().then(() => 'input'),
    ]), 'input', 'Cloak_off() must announce the loss before delobj() and the next monster');
    assert.match(game.nhDisplay?.grid[0]?.map(cell => cell.ch).join('') ?? '',
        /Your cloak of displacement smoulders away!--More--/);
    assert.equal(game.inventory.includes(cloak), true, 'the cloak is still owned while its loss is announced');
    assert.equal(game.uarmc, null, 'Cloak_off() has already removed its effect');
    assert.equal(game.u.uac, armorClass, 'find_ac() waits for the monster scan to finish');
    input.feed(' ');
    await operation;
    assert.match(game._pending_message, /You feel that monsters no longer have difficulty pinpointing your location\./);
    assert.equal(cloak.where, 'gone');
});
