import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { addInventoryItem } from '../js/u_init.js';
import { setPrimaryWeapon, setSecondaryWeapon } from '../js/weapon_slots.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject, artifactObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('two-weapon refusal describes the plural Eyes artifact as one unsuitable weapon', async () => {
    freshObjectRoom({ role: 'samurai' });
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
//# sourceMappingURL=two_weapon_suitability.test.js.map