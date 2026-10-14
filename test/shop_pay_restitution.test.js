import { monsterGoldAmount } from '../js/shop_money.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop, setShopkeeperGold } from './support/shop.js';
import { withMessagePages } from './support/planned-input.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { GOLD_PIECE, SACK } from '../js/object_data.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
for (const gold of [49, 50, 100]) {
    void test(`a robbed angry keeper accepts restitution only when ${gold} gold covers half the loss`, async () => {
        freshObjectRoom();
        const { shopkeeper } = await createStaffedShop();
        shopkeeper.eshk.shknam = 'Ada';
        shopkeeper.mpeaceful = 0;
        shopkeeper.eshk.robbed = 100;
        shopkeeper.eshk.following = 1;
        const before = monsterGoldAmount(shopkeeper);
        setHeroGoldAmount(game, gold);
        const messages = [];
        const input = resetInputState();
        input.beforeRead = () => { messages.push(game._pending_message); };
        await withMessagePages(() => rhack('p'.charCodeAt(0)), input, /blood|interest|robbed|compensate|calms down/, 5);
        messages.push(game._pending_message);
        assert.match(messages.join('\n'), /Ada is after blood, not gold!/);
        assert.equal(shopkeeper.mpeaceful, gold >= 50 ? 1 : 0);
        assert.equal(shopkeeper.eshk.following, gold >= 50 ? 0 : 1);
        assert.equal(shopkeeper.eshk.robbed, gold >= 50 ? 0 : 100);
        assert.equal(heroGoldAmount(game), gold >= 50 ? 0 : gold);
        assert.equal(monsterGoldAmount(shopkeeper), before + (gold >= 50 ? gold : 0));
        assert.equal(game.context.move, 1);
    });
}
void test('hidden gold prevents an underpayment from satisfying a robbed keeper', async () => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop();
    shopkeeper.eshk.shknam = 'Ada';
    shopkeeper.mpeaceful = 0;
    shopkeeper.eshk.robbed = 100;
    const sack = await addInventoryObject(SACK);
    await addCreatedObjectToContainer(sack, await knownObject(GOLD_PIECE, { quan: 50 }));
    setHeroGoldAmount(game, 75);
    await withMessagePages(() => rhack('p'.charCodeAt(0)), resetInputState(), /blood|interest/, 2);
    assert.equal(shopkeeper.mpeaceful, 0);
    assert.equal(shopkeeper.eshk.robbed, 100);
    assert.equal(heroGoldAmount(game), 75);
    assert.equal(game.context.move, 1);
});
void test('a peaceful keeper outside the shop accepts all visible gold but rejects less than half the loss', async () => {
    freshObjectRoom();
    const { shopkeeper } = await createStaffedShop({ left: 11 });
    shopkeeper.eshk.shknam = 'Ada';
    shopkeeper.eshk.robbed = 100;
    const before = monsterGoldAmount(shopkeeper);
    setHeroGoldAmount(game, 49);
    await withMessagePages(() => rhack('p'.charCodeAt(0)), resetInputState(), /give Ada|satisfied/, 2);
    assert.equal(heroGoldAmount(game), 0);
    assert.equal(monsterGoldAmount(shopkeeper), before + 49);
    assert.equal(shopkeeper.eshk.robbed, 51);
    assert.match(game._pending_message, /doesn't look satisfied/);
    assert.equal(game.context.move, 1);
});
for (const gold of [999, 1200]) {
    void test(`an angry keeper without losses ${gold >= 1000 ? 'accepts' : 'refuses'} an appeasement payment from ${gold} gold`, async () => {
        freshObjectRoom();
        const { shopkeeper } = await createStaffedShop();
        shopkeeper.eshk.shknam = 'Ada';
        shopkeeper.mpeaceful = 0;
        // A previous customer's offense guarantees acceptance, without a roll.
        shopkeeper.eshk.customer = 'someone else';
        const before = monsterGoldAmount(shopkeeper);
        setHeroGoldAmount(game, gold);
        await withMessagePages(() => rhack('p'.charCodeAt(0)), resetInputState(), /your hide|interest|appease|calms down/, 3);
        assert.equal(heroGoldAmount(game), gold >= 1000 ? gold - 1000 : gold);
        assert.equal(monsterGoldAmount(shopkeeper), before + (gold >= 1000 ? 1000 : 0));
        assert.equal(shopkeeper.mpeaceful, gold >= 1000 ? 1 : 0);
        assert.equal(shopkeeper.eshk.surcharge, true, 'Appeasement leaves the surcharge in place');
        assert.equal(game.context.move, 1);
    });
}
//# sourceMappingURL=shop_pay_restitution.test.js.map