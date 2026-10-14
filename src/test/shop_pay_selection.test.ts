import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { planInput, withMessagePages } from './support/planned-input.js';

void test('payment names a visible shopkeeper who is too far away outside the shop', async () => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop({ left: 12, keeperX: 14 });
    shopkeeper.eshk.shknam = 'Ada';

    await rhack('p'.charCodeAt(0));

    assert.equal(game._pending_message, 'Ada is not near enough to receive your payment.');
    assert.equal(game.context.move, 0);
});

void test('an unseen resident cannot receive payment at a distance', async () => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop({ keeperX: 13 });
    shopkeeper.minvis = true;
    shopkeeper.eshk.debit = 25;
    setHeroGoldAmount(game, 100);

    await withMessagePages(() => rhack('p'.charCodeAt(0)), resetInputState(),
        /owe|pay that debt|Thank you/, 3);

    assert.equal(game._pending_message,
        'There appears to be no shopkeeper here to receive your payment.');
    assert.equal(shopkeeper.eshk.debit, 25);
    assert.equal(game.context.move, 0);
});

void test('payment asks whom to pay when several shopkeepers are visible', async (t) => {
    freshObjectRoom();
    await createStaffedShop({ keeperX: 13 });
    await createStaffedShop({ left: 14, keeperX: 15 });
    planInput(resetInputState(), t, [{ prompt: /Pay whom\?/, keys: '.' }]);

    await rhack('p'.charCodeAt(0));

    assert.equal(game._pending_message, 'You are generous to yourself.');
    assert.equal(game.context.move, 0);
});
