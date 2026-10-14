import assert from 'node:assert/strict';
import test from 'node:test';
import { rhack } from '../js/cmd.js';
import { game } from '../js/gstate.js';
import { heroGoldAmount, setHeroGoldAmount } from '../js/hero_gold.js';
import { resetInputState } from '../js/input.js';
import { addCreatedObjectToContainer } from '../js/object_container.js';
import { BAG_OF_HOLDING, DAGGER, POT_HEALING } from '../js/object_data.js';
import { monsterGoldAmount } from '../js/shop_money.js';
import { addInventoryObject, knownObject } from './support/game-objects.js';
import { freshObjectRoom } from './support/object-room.js';
import { createStaffedShop, setShopkeeperGold } from './support/shop.js';

const longCallName = 'the long and winding road through mountains to the distant sea';
const longPersonalName = 'a second long winding road through mountains to distant seas';

for (const { label, callName, personalName, expected } of [
    { label: 'names that fit', callName: 'Keepsake', personalName: 'heirloom',
        expected: /called Keepsake named heirloom/ },
    { label: 'a long call name', callName: longCallName, personalName: 'heirloom',
        expected: /called the long\.\.\. named heirloom/ },
    { label: 'a long personal name', callName: 'Keepsake', personalName: longPersonalName,
        expected: /called Keepsake named a second\.\.\./ },
    { label: 'two long names', callName: longCallName, personalName: longPersonalName,
        expected: /called the long\.\.\. named a second\.\.\./ },
]) {
    for (const quantity of [1, 2]) {
        void test(`dropping ${quantity === 1 ? 'a potion' : 'two potions'} with ${label} preserves the sale question`, async () => {
            freshObjectRoom({ flags: { verbose: false } });
            const potion = await addInventoryObject(POT_HEALING, {
                quan: quantity, typeKnown: false, known: false,
                oextra: { oname: personalName },
            });
            game._objectCallNames = { [POT_HEALING]: callName };
            const { shopkeeper } = await createStaffedShop();
            shopkeeper.eshk.shknam = 'Ada';
            await setShopkeeperGold(shopkeeper, 1000);
            setHeroGoldAmount(game, 0);
            const input = resetInputState();
            input.feed(potion.invlet);

            const dropping = rhack('d'.charCodeAt(0));
            try {
                await input.waitUntilBlocked();
                const prompt = game._pending_message;
                assert.match(prompt, /^Ada offers \d+ gold pieces for your potions? /);
                assert.match(prompt, expected);
                assert.match(prompt, quantity === 1 ? /\.  Sell it\? \[ynaq\] \(y\)/
                    : /\.  Sell them\? \[ynaq\] \(y\)/);
            } finally {
                input.feed('n');
                await dropping;
            }

            assert.equal(potion.oextra?.oname, personalName);
            assert.equal(game._objectCallNames[POT_HEALING], callName);
            assert.equal(potion.where, 'floor');
            assert.equal(potion.no_charge, true);
            assert.equal(heroGoldAmount(game), 0);
            assert.equal(monsterGoldAmount(shopkeeper), 1000);
            assert.equal(game.context.move, 1);
        });
    }
}

for (const { label, keeperName, callName, personalName, expected } of [
    { label: 'two long names', keeperName: 'Ada', callName: longCallName,
        personalName: longPersonalName,
        expected: /bag called the long\.\.\. named a second\.\.\. and its contents\.  Sell them\?/ },
    { label: 'names that require the simple bag description', keeperName: 'Alexandria of the Western Isles',
        callName: 'copperglass', personalName: 'keepsakeone',
        expected: /for your bag and its contents\.  Sell them\?/ },
]) {
    void test(`dropping a filled bag with ${label} keeps its contents in the sale question`, async () => {
        freshObjectRoom({ flags: { verbose: false } });
        const bag = await addInventoryObject(BAG_OF_HOLDING, {
            initialize: false, typeKnown: false, known: false, cknown: true,
            oextra: { oname: personalName },
        });
        await addCreatedObjectToContainer(bag, await knownObject(DAGGER));
        game._objectCallNames = { [BAG_OF_HOLDING]: callName };
        const { shopkeeper } = await createStaffedShop();
        shopkeeper.eshk.shknam = keeperName;
        await setShopkeeperGold(shopkeeper, 1000);
        setHeroGoldAmount(game, 0);
        const input = resetInputState();
        input.feed(bag.invlet);

        const dropping = rhack('d'.charCodeAt(0));
        try {
            await input.waitUntilBlocked();
            assert.match(game._pending_message, expected);
            assert.match(game._pending_message, /Sell them\? \[ynaq\] \(y\)/);
        } finally {
            input.feed('n');
            await dropping;
        }

        assert.equal(bag.oextra?.oname, personalName);
        assert.equal(game._objectCallNames[BAG_OF_HOLDING], callName);
        assert.equal(bag.where, 'floor');
        assert.equal(bag.no_charge, true);
        assert.equal(heroGoldAmount(game), 0);
        assert.equal(monsterGoldAmount(shopkeeper), 1000);
    });
}
