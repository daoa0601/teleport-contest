import assert from 'node:assert/strict';
import test from 'node:test';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, OIL_LAMP } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { runExtendedCommand } from './support/commands.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a welded weapon refusal names the lamp the hero tried to rub', async () => {
    freshObjectRoom({ flags: { verbose: true } });
    const dagger = await addInventoryObject(DAGGER, { cursed: true });
    const lamp = await addInventoryObject(OIL_LAMP, { oname: 'Night Light' });
    await setPrimaryWeapon(dagger);
    resetInputState();
    await runExtendedCommand('rub', lamp.invlet);
    assert.equal(game._pending_message, 'Since your weapon is welded to your hand, you cannot rub that oil lamp named Night Light.');
    assert.equal(game.uwep, dagger);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=wield_tool_names.test.js.map