import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, OBJECT_NAMES, SHORT_SWORD, SPEAR } from '../js/object_data.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { withMessagePages } from './support/planned-input.js';

void test('returning merchandise moves the last bill item into its place in the payment menu', async () => {
    freshObjectRoom();
    const first = await addInventoryObject(DAGGER);
    const second = await addInventoryObject(OBJECT_NAMES.indexOf('knife'));
    const third = await addInventoryObject(SHORT_SWORD);
    const last = await addInventoryObject(SPEAR);
    const { shopkeeper } = await createStaffedShop({ bill: [first, second, third, last].map(object =>
        ({ bo_id: object.o_id, bquan: 1, price: 4, useup: false })) });
    for (const object of [first, second, third, last]) object.unpaid = true;
    setHeroGoldAmount(game, 4);
    const input = resetInputState();
    input.feed(first.invlet);
    await withMessagePages(() => rhack('d'.charCodeAt(0)), input, /drop/, 1);
    input.feed('a\n');

    await withMessagePages(() => rhack('p'.charCodeAt(0)), input,
        /drop|bought|Thank you/, 3);

    assert.equal(last.unpaid, false);
    assert.equal(second.unpaid, true);
    assert.equal(third.unpaid, true);
    assert.equal(first.where, 'floor');
    assert.equal(shopkeeper.eshk.billct, 2);
    assert.equal(heroGoldAmount(game), 0);
});
