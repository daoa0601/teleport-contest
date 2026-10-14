import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { ELVEN_DAGGER } from '../js/object_data.js';
import { objectTypeKnown } from '../js/shk.js';
import { addInventoryObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { withMessagePages } from './support/planned-input.js';

void test('buying an unfamiliar mundane weapon identifies its type and explains the purchase', async () => {
    freshObjectRoom();
    const dagger = await addInventoryObject(ELVEN_DAGGER, { typeKnown: false });
    assert.equal(objectTypeKnown(dagger), false);
    dagger.unpaid = true;
    const { shopkeeper } = await createStaffedShop({ bill: [
        { bo_id: dagger.o_id, bquan: 1, price: 4, useup: false },
    ] });
    setHeroGoldAmount(game, 4);
    const input = resetInputState();
    input.feed('a\n');
    const messages: string[] = [];
    input.beforeRead = () => { messages.push(game._pending_message); };

    await withMessagePages(() => rhack('p'.charCodeAt(0)), input,
        /elven dagger|runed dagger|Thank you/, 3);
    messages.push(game._pending_message);

    assert.equal(objectTypeKnown(dagger), true);
    assert.match(messages.join('\n'), /elven dagger; you bought it for 4 gold pieces\./);
    assert.equal(dagger.unpaid, false);
    assert.equal(shopkeeper.eshk.billct, 0);
    assert.equal(game.context.move, 1);
});
