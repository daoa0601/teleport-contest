import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { resetInputState } from '../js/input.js';
import { DAGGER, SACK } from '../js/object_data.js';
import { floorObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { withMessagePages } from './support/planned-input.js';
for (const deaf of [false, true]) {
    void test(`picking up a stack gives a ${deaf ? 'list' : 'spoken per-item'} price`, async () => {
        freshObjectRoom();
        const { shopkeeper } = await createStaffedShop();
        game.u.deafTurns = deaf ? 10 : 0;
        const daggers = await floorObject(DAGGER, 10, 10, { quan: 3 });
        const messages = [];
        const input = resetInputState();
        input.beforeRead = () => { messages.push(game._pending_message); };
        await withMessagePages(() => rhack(','.charCodeAt(0)), input, /list price|For you|daggers/, 2);
        messages.push(game._pending_message);
        assert.match(messages.join('\n'), deaf ? /The list price of the daggers is 4 zorkmids each\./
            : /only 4 zorkmids per dagger\."/);
        assert.equal(daggers.unpaid, true);
        assert.equal(daggers.where, 'inventory');
        assert.equal(shopkeeper.eshk.bill[0]?.bquan, 3);
        assert.equal(shopkeeper.eshk.bill[0]?.price, 4);
        assert.equal(game.context.move, 1);
    });
}
void test('a level without the shop flag does not bill a floor pickup', async () => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop();
    if (!game.level)
        throw new Error('The shop level must exist.');
    game.level.flags.has_shop = false;
    const dagger = await floorObject(DAGGER, 10, 10);
    await withMessagePages(() => rhack(','.charCodeAt(0)), resetInputState(), /dagger|For you/, 2);
    assert.equal(dagger.unpaid ?? false, false);
    assert.equal(shopkeeper.eshk.billct, 0);
});
void test('contents that overflow a full bill are free, each with its own notice', async () => {
    freshObjectRoom();
    const bill = Array.from({ length: 198 }, (_, index) => ({
        bo_id: 900000 + index, bquan: 1, useup: false, price: 1,
    }));
    const { shopkeeper } = await createStaffedShop({ bill });
    const sack = await floorObject(SACK, 10, 10, { initialize: false, cknown: true });
    const daggers = [
        await knownObject(DAGGER, { where: 'contained', container: sack }),
        await knownObject(DAGGER, { where: 'contained', container: sack }),
        await knownObject(DAGGER, { where: 'contained', container: sack }),
    ];
    sack.contents = daggers;
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };
    await withMessagePages(() => rhack(','.charCodeAt(0)), input, /free|For you|sack/, 6);
    messages.push(game._pending_message);
    const text = messages.join('\n');
    // C add_one_tobill(): the sack and the first dagger fill the bill;
    // each later dagger prints its own notice and stays unbilled.
    assert.equal(text.match(/You got that for free!/g)?.length, 2);
    assert.match(text, /for this sack and its contents\."/);
    assert.equal(shopkeeper.eshk.bill.length, 200);
    assert.deepEqual(daggers.map(dagger => dagger.unpaid ?? false), [true, false, false]);
});
const pickupQuoteCases = [
    { name: 'an angry shopkeeper calls the hero scum',
        prepare: keeper => { keeper.mpeaceful = false; },
        expected: /^"For you, scum; \d+ zorkmids for this dagger\."$/ },
    { name: 'a peaceful surcharging shopkeeper offers no honorific',
        prepare: keeper => { keeper.eshk.surcharge = true; },
        expected: /^"For you, \d+ zorkmids for this dagger\."$/ },
    { name: 'a sleeping shopkeeper leaves only the list price',
        prepare: keeper => { keeper.msleeping = 1; },
        expected: /^The list price of the dagger is \d+ zorkmids\.$/ },
];
for (const { name, prepare, expected } of pickupQuoteCases) {
    void test(name, async () => {
        freshObjectRoom();
        const { shopkeeper } = await createStaffedShop();
        prepare(shopkeeper);
        await floorObject(DAGGER, 10, 10);
        const messages = [];
        const input = resetInputState();
        input.beforeRead = () => { messages.push(game._pending_message); };
        await withMessagePages(() => rhack(','.charCodeAt(0)), input, /price|For you|dagger/, 2);
        messages.push(game._pending_message);
        assert.ok(messages.some(message => expected.test(message)), messages.join('\n'));
    });
}
void test('picking up the hero\'s own sack quotes only its shop contents', async () => {
    freshObjectRoom();
    await createStaffedShop();
    const sack = await floorObject(SACK, 10, 10, { initialize: false, cknown: true, no_charge: true });
    const dagger = await knownObject(DAGGER, { where: 'contained', container: sack });
    sack.contents = [dagger];
    const messages = [];
    const input = resetInputState();
    input.beforeRead = () => { messages.push(game._pending_message); };
    await withMessagePages(() => rhack(','.charCodeAt(0)), input, /For you|sack/, 2);
    messages.push(game._pending_message);
    assert.match(messages.join('\n'), /only \d+ zorkmids for the contents of this sack\."/);
    assert.equal(sack.unpaid ?? false, false);
    assert.equal(dagger.unpaid, true);
});
//# sourceMappingURL=shop_pickup_quote.test.js.map