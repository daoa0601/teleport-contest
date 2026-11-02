import assert from 'node:assert/strict';
import test from 'node:test';
import { W_RINGL } from '../js/const.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { inventoryReport } from '../js/inventory_reports.js';
import { queryObjectClasses } from '../js/pickup.js';
import { DAGGER, POT_HEALING, RIN_PROTECTION } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
void test('a filtered inventory report rejects a queued letter outside its native class filter', async () => {
    await freshObjectRoom();
    const ring = await addInventoryObject(RIN_PROTECTION, { owornmask: W_RINGL });
    ring.invlet = 'a';
    game.uleft = ring;
    const input = resetInputState();
    input.queueCommandKeys('aq');
    const action = await inventoryReport('rings');
    assert.equal(action, null);
    assert.equal(input.takeCommandResponse(), undefined, 'an invalid inventory choice clears the remaining canned answers');
});
void test('looking at inventory during a class query consumes its queued inventory selection', async () => {
    await freshObjectRoom();
    const dagger = await addInventoryObject(DAGGER);
    await addInventoryObject(POT_HEALING);
    const input = resetInputState();
    input.queueCommandKeys(`i\n${dagger.invlet}\n`);
    input.feed(' \x1b');
    const selection = await queryObjectClasses('put in', game.inventory);
    assert.equal(selection?.everything, false);
    assert.equal(selection?.oneAtATime, true);
});
//# sourceMappingURL=inventory_canned_reports.test.js.map