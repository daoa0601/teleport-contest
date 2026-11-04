import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { ARROW, DAGGER, FLINT } from '../js/object_data.js';
import { addInventoryItem } from '../js/invent.js';
import { setPrimaryWeapon, setSecondaryWeapon } from '../js/wield.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('two-weapon refusal describes the plural Eyes artifact as one unsuitable weapon', async () => {
    await freshObjectRoom({ role: 'samurai' });
    const eyes = await addInventoryItem(await artifactObject('The Eyes of the Overworld'));
    assert.ok(eyes.oartifact);
    game._artifactDiscoveries = [eyes.oartifact];
    await setPrimaryWeapon(eyes);
    await setSecondaryWeapon(await addInventoryObject(DAGGER));
    resetInputState();
    await runExtendedCommand('twoweapon');
    assert.match(game._pending_message, /aren't suitable primary weapon\.$/);
    assert.equal(!!game.u.twoweap, false);
    assert.equal(game.context.move, 0);
});
// C wield.c:75 TWOWEAPOK() rejects is_ammo() weapons in either slot;
// wield.c:dotwoweapon() names the first unsuitable object and its slot.
void test('two-weapon combat rejects wielded arrows and sling stones', async () => {
    await freshObjectRoom({ role: 'samurai' });
    await setPrimaryWeapon(await addInventoryObject(ARROW));
    await setSecondaryWeapon(await addInventoryObject(DAGGER));
    resetInputState();
    await runExtendedCommand('twoweapon');
    assert.match(game._pending_message, /arrow isn't a suitable primary weapon\.$/);
    assert.equal(!!game.u.twoweap, false);
    assert.equal(game.context.move, 0);
    await setPrimaryWeapon(await addInventoryObject(DAGGER));
    await setSecondaryWeapon(await addInventoryObject(FLINT));
    resetInputState();
    await runExtendedCommand('twoweapon');
    assert.match(game._pending_message, /flint .*isn't a suitable secondary weapon\.$/);
    assert.equal(!!game.u.twoweap, false);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=two_weapon_suitability.test.js.map