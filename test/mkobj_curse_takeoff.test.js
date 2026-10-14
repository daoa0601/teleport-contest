import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { curseObject } from '../js/object_state.js';
import { TWO_HANDED_SWORD } from '../js/object_data.js';
import { setPrimaryWeapon } from '../js/weapon_slots.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('cursing a wielded two-handed weapon cancels queued armor removal', async () => {
    freshObjectRoom();
    const sword = await addInventoryObject(TWO_HANDED_SWORD);
    await setPrimaryWeapon(sword);
    game.context.takeoff = {
        pending: ['uarm'], current: 'uarmc', delay: 2, text: 'disrobing',
    };
    await curseObject(sword);
    assert.equal(game.context.takeoff?.pending.length ?? 0, 0);
    assert.equal(game.context.takeoff?.current ?? null, null);
});
//# sourceMappingURL=mkobj_curse_takeoff.test.js.map