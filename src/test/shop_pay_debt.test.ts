import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { GOLD_PIECE, SACK } from '../js/object_data.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop } from './support/shop.js';
import { withMessagePages } from './support/planned-input.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';

for (const loan of [10, 25]) {
    void test(`paying a 25-zorkmid debt describes its ${loan}-zorkmid gold loan`, async () => {
        freshObjectRoom();
        const { shopkeeper } = await createStaffedShop();
        shopkeeper.eshk.shknam = 'Ada';
        shopkeeper.eshk.debit = 25;
        shopkeeper.eshk.loan = loan;
        shopkeeper.eshk.credit = 5;
        setHeroGoldAmount(game, 20);
        const messages: string[] = [];
        const input = resetInputState();
        input.beforeRead = () => { messages.push(game._pending_message); };

        await withMessagePages(() => rhack('p'.charCodeAt(0)), input,
            /owe|credit|remainder|Thank you/, 4);
        messages.push(game._pending_message);

        assert.match(messages.join('\n'), loan === 25
            ? /25 zorkmids you picked up in the store\./
            : /25 zorkmids for gold picked up and the use of merchandise\./);
        assert.equal(shopkeeper.eshk.debit, 0);
        assert.equal(shopkeeper.eshk.loan, 0);
        assert.equal(shopkeeper.eshk.credit, 0);
        assert.equal(heroGoldAmount(game), 0);
        assert.equal(game.context.move, 1);
    });
}

void test('an unaffordable usage debt mentions stashed gold without offering nonexistent credit', async () => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.debit = 25;
    const sack = await addInventoryObject(SACK);
    await addCreatedObjectToContainer(sack, await knownObject(GOLD_PIECE, { quan: 30 }));
    setHeroGoldAmount(game, 5);

    await withMessagePages(() => rhack('p'.charCodeAt(0)), resetInputState(),
        /owe|enough gold/, 2);

    assert.match(game._pending_message, /But you don't seem to have enough gold\./);
    assert.equal(shopkeeper.eshk.debit, 25);
    assert.equal(heroGoldAmount(game), 5);
    assert.equal(game.context.move, 1);
});

void test('a deaf customer receives a guarded nod after paying a surcharged shopkeeper', async () => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.shknam = 'Ada';
    shopkeeper.eshk.debit = 25;
    shopkeeper.eshk.surcharge = true;
    shopkeeper.female = false;
    game.u.deafTurns = 10;
    setHeroGoldAmount(game, 25);

    await withMessagePages(() => rhack('p'.charCodeAt(0)), resetInputState(),
        /owe|pay that debt|nods|Thank you/, 3);

    assert.match(game._pending_message, /Ada nods at you for shopping in his general store\./);
    assert.equal(heroGoldAmount(game), 0);
    assert.equal(shopkeeper.eshk.debit, 0);
    assert.equal(game.context.move, 1);
});
