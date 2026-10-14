import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER } from '../js/object_data.js';
import { floorObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
for (const noCharge of [false, true]) {
    void test(`chatting over ${noCharge ? 'your own' : 'shop-owned'} daggers quotes their price without asking for a direction`, async () => {
        freshObjectRoom();
        await createStaffedShop();
        const daggers = await floorObject(DAGGER, 10, 10, { quan: 3, no_charge: noCharge });
        const input = resetInputState();
        input.feed('chat\n.');
        await rhack('#'.charCodeAt(0));
        assert.match(game._pending_message, noCharge ? /daggers, no charge!"$/
            : /daggers, price 4 zorkmids each[,.]/);
        assert.equal(game.context.move, 1);
        assert.equal(daggers.where, 'floor');
        assert.equal(daggers.unpaid ?? false, false);
    });
}
void test('a choking customer cannot ask for a floor merchandise quote', async () => {
    freshObjectRoom();
    await createStaffedShop();
    await floorObject(DAGGER, 10, 10);
    game.u.strangledTurns = 3;
    const input = resetInputState();
    input.feed('chat\n.');
    await rhack('#'.charCodeAt(0));
    assert.match(game._pending_message, /You can't speak\.  You're choking!/);
    assert.equal(game.context.move, 0);
});
//# sourceMappingURL=shop_price_quote.test.js.map