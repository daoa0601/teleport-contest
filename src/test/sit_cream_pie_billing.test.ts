import test from 'node:test';
import assert from 'node:assert/strict';
import { game } from '../js/gstate.js';
import { CREAM_PIE } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { runExtendedCommand } from './support/commands.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';

void test('sitting on shop cream pies charges the whole destroyed stack', async () => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop();
    const pies = await floorObject(CREAM_PIE, 10, 10, { quan: 2, quantity: 2 });

    await runExtendedCommand('sit', ' '.repeat(20));

    assert.equal(pies.where, 'onbill');
    assert.ok(shopkeeper.eshk.bill.some(entry => entry.bo_id === pies.o_id
        && entry.useup && entry.bquan === 2));
    assert.equal(game.context.move, 1);
});
