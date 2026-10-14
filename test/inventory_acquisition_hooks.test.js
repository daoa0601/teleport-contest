import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DART } from '../js/object_data.js';
import { setQuiverObject } from '../js/weapon_slots.js';
import { addInventoryObject, floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { planInput } from './support/planned-input.js';
void test('pickup merges into the quiver before an earlier compatible inventory stack', async (t) => {
    freshObjectRoom();
    const reserve = await addInventoryObject(DART, { quan: 2 });
    const quiver = await addInventoryObject(DART, { quan: 3, nomerge: true });
    quiver.nomerge = false;
    await setQuiverObject(quiver);
    await floorObject(DART, game.u.ux, game.u.uy, { quan: 4 });
    const input = resetInputState();
    planInput(input, t, []);
    await rhack(','.charCodeAt(0));
    assert.equal(reserve.quan, 2);
    assert.equal(quiver.quan, 7);
    assert.equal(game.uquiver, quiver);
});
//# sourceMappingURL=inventory_acquisition_hooks.test.js.map